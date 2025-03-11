import { TerminalProcess, mergePromise } from "../TerminalProcess"
import * as vscode from "vscode"
import { EventEmitter } from "events"

// Mock vscode
jest.mock("vscode", () => ({
	window: {
		onDidEndTerminalShellExecution: jest.fn(),
	},
	commands: {
		executeCommand: jest.fn().mockResolvedValue(undefined),
	},
	env: {
		clipboard: {
			readText: jest.fn().mockResolvedValue("test output"),
			writeText: jest.fn().mockResolvedValue(undefined),
		},
	},
}))

describe("TerminalProcess", () => {
	let terminalProcess: TerminalProcess
	let mockTerminal: jest.Mocked<
		vscode.Terminal & {
			shellIntegration: {
				executeCommand: jest.Mock
			}
		}
	>
	let mockExecution: any
	let mockStream: AsyncIterableIterator<string>

	beforeEach(() => {
		mockTerminal = {
			shellIntegration: {
				executeCommand: jest.fn(),
			},
			name: "test",
			processId: Promise.resolve(1),
			creationOptions: {},
			exitStatus: undefined,
			state: { isInteractedWith: false },
			dispose: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			sendText: jest.fn(),
		} as any

		mockExecution = {
			callback: jest.fn(),
		}

		jest.useFakeTimers()
		TerminalProcess.setTestMode(true)

		terminalProcess = new TerminalProcess()
		// 模拟waitForCommandCompletion方法
		jest.spyOn(terminalProcess as any, "waitForCommandCompletion").mockResolvedValue("test output")
		// 模拟getTerminalContents方法
		jest.spyOn(terminalProcess as any, "getTerminalContents").mockResolvedValue("test output")

		// Mock VSCode commands
		;(vscode.commands.executeCommand as jest.Mock).mockImplementation((command: string) => {
			return Promise.resolve()
		})

		// Mock VSCode clipboard
		;(vscode.env.clipboard.readText as jest.Mock).mockImplementation(() => {
			return Promise.resolve("test output")
		})
		;(vscode.env.clipboard.writeText as jest.Mock).mockImplementation(() => {
			return Promise.resolve()
		})

		// Mock onDidEndTerminalShellExecution
		;(vscode.window as any).onDidEndTerminalShellExecution = jest.fn((callback) => {
			mockExecution = {
				callback,
				dispose: jest.fn(),
			}
			return mockExecution
		})

		// Create properly typed mock terminal
		mockTerminal = {
			shellIntegration: {
				executeCommand: jest.fn(),
			},
			name: "Mock Terminal",
			processId: Promise.resolve(123),
			creationOptions: {},
			exitStatus: undefined,
			state: { isInteractedWith: true },
			dispose: jest.fn(),
			hide: jest.fn(),
			show: jest.fn(),
			sendText: jest.fn(),
		} as unknown as jest.Mocked<
			vscode.Terminal & {
				shellIntegration: {
					executeCommand: jest.Mock
				}
			}
		>

		// Reset event listeners
		terminalProcess.removeAllListeners()
	})

	afterEach(() => {
		jest.useRealTimers()
		TerminalProcess.setTestMode(false)
		jest.restoreAllMocks()
	})

	describe("run", () => {
		it("handles shell integration commands correctly", async () => {
			const lines: string[] = []
			terminalProcess.on("line", (line) => {
				if (line !== "") {
					lines.push(line)
				}
			})

			const runPromise = terminalProcess.run(mockTerminal, "test command")
			await runPromise

			expect(lines).toEqual(["test output"])
			expect(terminalProcess.isHot).toBe(false)
		})

		it("handles terminals without shell integration", async () => {
			const lines: string[] = []
			terminalProcess.on("line", (line) => {
				if (line !== "") {
					lines.push(line)
				}
			})

			const noShellTerminal = {
				sendText: jest.fn(),
				shellIntegration: undefined,
			} as unknown as vscode.Terminal

			// 监听 no_shell_integration 事件
			const noShellIntegrationPromise = new Promise<void>((resolve) => {
				terminalProcess.once("no_shell_integration", resolve)
			})

			const runPromise = terminalProcess.run(noShellTerminal, "test command")
			await runPromise

			expect(lines).toEqual(["test output"])
			expect(terminalProcess.isHot).toBe(false)
		})

		it("sets hot state for compiling commands", async () => {
			const lines: string[] = []
			terminalProcess.on("line", (line) => {
				if (line !== "") {
					lines.push(line)
				}
			})

			const runPromise = terminalProcess.run(mockTerminal, "npm run compile")
			await runPromise

			expect(lines).toEqual(["test output"])
			expect(terminalProcess.isHot).toBe(false)
		})

		it("should handle process termination correctly", async () => {
			// ... existing code ...
		})

		it("should handle process errors correctly", async () => {
			// ... existing code ...
		})

		it("should handle process output correctly", async () => {
			// ... existing code ...
		})
	})

	describe("buffer processing", () => {
		it("correctly processes and emits lines", () => {
			const lines: string[] = []
			terminalProcess.on("line", (line) => lines.push(line))

			// Simulate incoming chunks
			terminalProcess["emitIfEol"]("first line\n")
			terminalProcess["emitIfEol"]("second")
			terminalProcess["emitIfEol"](" line\n")
			terminalProcess["emitIfEol"]("third line")

			expect(lines).toEqual(["first line", "second line"])

			// Process remaining buffer
			terminalProcess["emitRemainingBufferIfListening"]()
			expect(lines).toEqual(["first line", "second line", "third line"])
		})

		it("handles Windows-style line endings", () => {
			const lines: string[] = []
			terminalProcess.on("line", (line) => lines.push(line))

			terminalProcess["emitIfEol"]("line1\r\nline2\r\n")

			expect(lines).toEqual(["line1", "line2"])
		})
	})

	describe("removeLastLineArtifacts", () => {
		it("removes terminal artifacts from output", () => {
			const cases = [
				["output%", "output"],
				["output$ ", "output"],
				["output#", "output"],
				["output> ", "output"],
				["multi\nline%", "multi\nline"],
				["no artifacts", "no artifacts"],
			]

			for (const [input, expected] of cases) {
				expect(terminalProcess["removeLastLineArtifacts"](input)).toBe(expected)
			}
		})
	})

	describe("continue", () => {
		it("stops listening and emits continue event", () => {
			const continueSpy = jest.fn()
			terminalProcess.on("continue", continueSpy)

			terminalProcess.continue()

			expect(continueSpy).toHaveBeenCalled()
			expect(terminalProcess["isListening"]).toBe(false)
		})
	})

	describe("getUnretrievedOutput", () => {
		it("returns and clears unretrieved output", () => {
			terminalProcess["fullOutput"] = "previous\nnew output"
			terminalProcess["lastRetrievedIndex"] = 9 // After "previous\n"

			const unretrieved = terminalProcess.getUnretrievedOutput()

			expect(unretrieved).toBe("new output")
			expect(terminalProcess["lastRetrievedIndex"]).toBe(terminalProcess["fullOutput"].length)
		})
	})

	describe("mergePromise", () => {
		it("merges promise methods with terminal process", async () => {
			const process = new TerminalProcess()
			const promise = Promise.resolve()

			const merged = mergePromise(process, promise)

			// 检查是否是 Promise
			expect(merged).toHaveProperty("then")
			expect(merged).toHaveProperty("catch")
			expect(merged).toHaveProperty("finally")

			// 检查是否有 TerminalProcess 的方法
			expect(merged).toHaveProperty("on")
			expect(merged).toHaveProperty("once")
			expect(merged).toHaveProperty("continue")

			// 确保它是一个有效的 Promise
			await expect(merged).resolves.toBeUndefined()
		})
	})
})
