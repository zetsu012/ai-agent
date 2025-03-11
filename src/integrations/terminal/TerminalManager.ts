import pWaitFor from "p-wait-for"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path"
import { mergePromise, TerminalProcess, TerminalProcessResultPromise } from "./TerminalProcess"
import { TerminalInfo, TerminalRegistry } from "./TerminalRegistry"
import { logger } from "../../utils/logging"

/*
TerminalManager:
- Creates/reuses terminals
- Runs commands via runCommand(), returning a TerminalProcess
- Handles shell integration events

TerminalProcess extends EventEmitter and implements Promise:
- Emits 'line' events with output while promise is pending
- process.continue() resolves promise and stops event emission
- Allows real-time output handling or background execution

getUnretrievedOutput() fetches latest output for ongoing commands

Enables flexible command execution:
- Await for completion
- Listen to real-time events
- Continue execution in background
- Retrieve missed output later

Notes:
- it turns out some shellIntegration APIs are available on cursor, although not on older versions of vscode
- "By default, the shell integration script should automatically activate on supported shells launched from VS Code."
Supported shells:
Linux/macOS: bash, fish, pwsh, zsh
Windows: pwsh


Example:

const terminalManager = new TerminalManager(context);

// Run a command
const process = terminalManager.runCommand('npm install', '/path/to/project');

process.on('line', (line) => {
    console.log(line);
});

// To wait for the process to complete naturally:
await process;

// Or to continue execution even if the command is still running:
process.continue();

// Later, if you need to get the unretrieved output:
const unretrievedOutput = terminalManager.getUnretrievedOutput(terminalId);
console.log('Unretrieved output:', unretrievedOutput);

Resources:
- https://github.com/microsoft/vscode/issues/226655
- https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api
- https://code.visualstudio.com/docs/terminal/shell-integration
- https://code.visualstudio.com/api/references/vscode-api#Terminal
- https://github.com/microsoft/vscode-extension-samples/blob/main/terminal-sample/src/extension.ts
- https://github.com/microsoft/vscode-extension-samples/blob/main/shell-integration-sample/src/extension.ts
*/

/*
The new shellIntegration API gives us access to terminal command execution output handling.
However, we don't update our VSCode type definitions or engine requirements to maintain compatibility
with older VSCode versions. Users on older versions will automatically fall back to using sendText
for terminal command execution.
Interestingly, some environments like Cursor enable these APIs even without the latest VSCode engine.
This approach allows us to leverage advanced features when available while ensuring broad compatibility.
*/
declare module "vscode" {
	// https://github.com/microsoft/vscode/blob/f0417069c62e20f3667506f4b7e53ca0004b4e3e/src/vscode-dts/vscode.d.ts#L10794
	interface Window {
		onDidChangeTerminalShellIntegration?: (
			listener: (e: { terminal: vscode.Terminal; shellIntegration: TerminalShellIntegration }) => any,
			thisArgs?: any,
			disposables?: vscode.Disposable[],
		) => vscode.Disposable
	}
}

// Extend the Terminal type to include our custom properties
interface TerminalShellIntegration {
	readonly cwd?: vscode.Uri
	readonly executeCommand: (commandLine: string) => {
		exitCode: Promise<number | undefined>
		read: () => AsyncIterable<string>
	}
}

type ExtendedTerminal = vscode.Terminal & {
	readonly shellIntegration?: TerminalShellIntegration
}

export class TerminalManager {
	private terminalIds: Set<number> = new Set()
	private processes: Map<number, TerminalProcess> = new Map()
	private disposables: vscode.Disposable[] = []
	private shellIntegrationActivated: Map<number, boolean> = new Map()

	constructor() {
		// 监听 shell integration 激活事件
		try {
			const shellIntegrationDisposable = (vscode.window as vscode.Window).onDidChangeTerminalShellIntegration?.(
				(e) => {
					const terminal = e.terminal as ExtendedTerminal
					const shellIntegration = e.shellIntegration

					if (typeof shellIntegration?.executeCommand === "function") {
						terminal.processId.then((id) => {
							if (id) {
								this.shellIntegrationActivated.set(id, true)
								logger.debug("Shell integration 已激活", {
									ctx: "terminal",
									terminalName: terminal.name,
									terminalId: id,
									hasExecuteCommand: true,
								})
							}
						})
					}
				},
			)
			if (shellIntegrationDisposable) {
				this.disposables.push(shellIntegrationDisposable)
			}
		} catch (error) {
			logger.warn("Shell integration 事件监听注册失败", {
				ctx: "terminal",
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	runCommand(terminalInfo: TerminalInfo, command: string): TerminalProcessResultPromise {
		terminalInfo.busy = true
		terminalInfo.lastCommand = command
		const process = new TerminalProcess()
		this.processes.set(terminalInfo.id, process)

		process.once("completed", () => {
			terminalInfo.busy = false
		})

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => {
				resolve()
			})
			process.once("error", (error) => {
				logger.error(`终端 ${terminalInfo.id} 执行出错:`, {
					ctx: "terminal",
					error: error instanceof Error ? error.message : String(error),
				})
				reject(error)
			})
		})

		const terminal = terminalInfo.terminal as ExtendedTerminal
		const resultPromise = mergePromise(process, promise)

		// 在后台执行命令
		;(async () => {
			// 检查是否已经激活
			const shellIntegration = terminal.shellIntegration
			const hasExecuteCommand = typeof shellIntegration?.executeCommand === "function"

			if (hasExecuteCommand) {
				process.run(terminal, command)
				return
			}

			// 如果还没激活，等待激活
			const terminalId = await terminal.processId
			if (terminalId) {
				try {
					await pWaitFor(() => this.shellIntegrationActivated.get(terminalId) === true, { timeout: 3000 })
					process.run(terminal, command)
				} catch (error) {
					// 如果等待超时，使用传统方式执行
					logger.warn("Shell integration 等待超时，使用传统方式执行", {
						ctx: "terminal",
						terminalName: terminal.name,
						terminalId,
					})
					process.run(terminal, command)
				}
			} else {
				// 如果无法获取 terminalId，直接使用传统方式
				process.run(terminal, command)
			}
		})()

		return resultPromise
	}

	async getOrCreateTerminal(cwd: string): Promise<TerminalInfo> {
		const terminals = TerminalRegistry.getAllTerminals()

		// 首先尝试找到匹配的终端
		const matchingTerminal = terminals.find((t) => {
			if (t.busy) {
				return false
			}
			const terminal = t.terminal as ExtendedTerminal
			const terminalCwd = terminal.shellIntegration?.cwd
			if (!terminalCwd) {
				return false
			}
			return arePathsEqual(vscode.Uri.file(cwd).fsPath, terminalCwd.fsPath)
		})
		if (matchingTerminal) {
			this.terminalIds.add(matchingTerminal.id)
			return matchingTerminal
		}

		// 如果没有匹配的，尝试找到空闲的终端
		const availableTerminal = terminals.find((t) => !t.busy)
		if (availableTerminal) {
			await this.runCommand(availableTerminal, `cd "${cwd}"`)
			this.terminalIds.add(availableTerminal.id)
			return availableTerminal
		}

		// 如果都没有，创建新终端
		const newTerminalInfo = await TerminalRegistry.createTerminal(cwd)
		this.terminalIds.add(newTerminalInfo.id)
		return newTerminalInfo
	}

	getTerminals(busy: boolean): { id: number; lastCommand: string }[] {
		return Array.from(this.terminalIds)
			.map((id) => TerminalRegistry.getTerminal(id))
			.filter((t): t is TerminalInfo => t !== undefined && t.busy === busy)
			.map((t) => ({ id: t.id, lastCommand: t.lastCommand }))
	}

	getUnretrievedOutput(terminalId: number): string {
		if (!this.terminalIds.has(terminalId)) {
			return ""
		}
		const process = this.processes.get(terminalId)
		return process ? process.getUnretrievedOutput() : ""
	}

	isProcessHot(terminalId: number): boolean {
		const process = this.processes.get(terminalId)
		return process ? process.isHot : false
	}

	async getTerminalContents(commands = -1): Promise<string> {
		// 保存原始剪贴板内容
		const originalContent = await vscode.env.clipboard.readText()

		try {
			// 清除当前选择
			await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")

			// 根据 commands 参数选择不同的选择策略
			if (commands < 0) {
				// await vscode.commands.executeCommand("workbench.action.terminal.selectAll")
				await vscode.commands.executeCommand("workbench.action.terminal.selectToPreviousCommand")
			} else {
				await vscode.commands.executeCommand("workbench.action.terminal.selectToPreviousCommand")
			}

			// 复制选中内容
			await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

			// 获取复制的内容
			const content = await vscode.env.clipboard.readText()

			// 清除选择
			await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")

			// 恢复原始剪贴板内容
			await vscode.env.clipboard.writeText(originalContent)

			// 如果内容未变，说明可能没有复制成功
			if (content === originalContent) {
				return ""
			}

			return content
		} catch (error) {
			// 确保恢复剪贴板内容
			await vscode.env.clipboard.writeText(originalContent)
			throw error
		}
	}

	disposeAll() {
		this.terminalIds.clear()
		this.processes.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
	}
}
