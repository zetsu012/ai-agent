import * as vscode from "vscode"
import { CoolClineProvider } from "../core/webview/CoolClineProvider"
import { TerminalManager } from "../integrations/terminal/TerminalManager"

const TERMINAL_COMMAND_IDS = {
	ADD_TO_CONTEXT: "coolcline.terminalAddToContext",
	FIX: "coolcline.terminalFixCommand",
	FIX_IN_CURRENT_TASK: "coolcline.terminalFixCommandInCurrentTask",
	EXPLAIN: "coolcline.terminalExplainCommand",
	EXPLAIN_IN_CURRENT_TASK: "coolcline.terminalExplainCommandInCurrentTask",
} as const

export const registerTerminalActions = (context: vscode.ExtensionContext) => {
	const terminalManager = new TerminalManager()

	registerTerminalAction(context, terminalManager, TERMINAL_COMMAND_IDS.ADD_TO_CONTEXT, "TERMINAL_ADD_TO_CONTEXT")

	registerTerminalActionPair(
		context,
		terminalManager,
		TERMINAL_COMMAND_IDS.FIX,
		"TERMINAL_FIX",
		"What would you like CoolCline to fix?",
	)

	registerTerminalActionPair(
		context,
		terminalManager,
		TERMINAL_COMMAND_IDS.EXPLAIN,
		"TERMINAL_EXPLAIN",
		"What would you like CoolCline to explain?",
	)
}

const registerTerminalAction = (
	context: vscode.ExtensionContext,
	terminalManager: TerminalManager,
	command: string,
	promptType: "TERMINAL_ADD_TO_CONTEXT" | "TERMINAL_FIX" | "TERMINAL_EXPLAIN",
	inputPrompt?: string,
) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(command, async (args: any) => {
			let content = args.selection
			if (!content || content === "") {
				content = await terminalManager.getTerminalContents(promptType === "TERMINAL_ADD_TO_CONTEXT" ? -1 : 1)
			}

			if (!content) {
				vscode.window.showWarningMessage("No terminal content selected")
				return
			}

			const params: Record<string, string | any[]> = {
				terminalContent: content,
			}

			if (inputPrompt) {
				params.userInput =
					(await vscode.window.showInputBox({
						prompt: inputPrompt,
					})) ?? ""
			}

			await CoolClineProvider.handleTerminalAction(command, promptType, params)
		}),
	)
}

const registerTerminalActionPair = (
	context: vscode.ExtensionContext,
	terminalManager: TerminalManager,
	baseCommand: string,
	promptType: "TERMINAL_ADD_TO_CONTEXT" | "TERMINAL_FIX" | "TERMINAL_EXPLAIN",
	inputPrompt?: string,
) => {
	// Register new task version
	registerTerminalAction(context, terminalManager, baseCommand, promptType, inputPrompt)
	// Register current task version
	registerTerminalAction(context, terminalManager, `${baseCommand}InCurrentTask`, promptType, inputPrompt)
}
