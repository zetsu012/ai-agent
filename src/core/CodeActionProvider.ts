import * as vscode from "vscode"
import { EditorUtils } from "./EditorUtils"

export const ACTION_NAMES = {
	EXPLAIN: "CoolCline: Explain Code",
	FIX: "CoolCline: Fix Code",
	FIX_LOGIC: "CoolCline: Fix Logic",
	IMPROVE: "CoolCline: Improve Code",
	ADD_TO_CONTEXT: "CoolCline: Add to Context",
} as const

export const COMMAND_IDS = {
	EXPLAIN: "coolcline.explainCode",
	FIX: "coolcline.fixCode",
	IMPROVE: "coolcline.improveCode",
	ADD_TO_CONTEXT: "coolcline.addToContext",
} as const

export class CodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix,
		vscode.CodeActionKind.RefactorRewrite,
	]

	private createAction(title: string, kind: vscode.CodeActionKind, command: string, args: any[]): vscode.CodeAction {
		const action = new vscode.CodeAction(title, kind)
		action.command = { command, title, arguments: args }
		return action
	}

	private createActionPair(
		baseTitle: string,
		kind: vscode.CodeActionKind,
		baseCommand: string,
		args: any[],
	): vscode.CodeAction[] {
		return [
			this.createAction(`${baseTitle} in New Task`, kind, baseCommand, args),
			this.createAction(`${baseTitle} in Current Task`, kind, `${baseCommand}InCurrentTask`, args),
		]
	}

	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
	): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
		try {
			const effectiveRange = EditorUtils.getEffectiveRange(document, range)
			if (!effectiveRange) {
				return []
			}

			const filePath = EditorUtils.getFilePath(document)
			const actions: vscode.CodeAction[] = []

			actions.push(
				...this.createActionPair(ACTION_NAMES.EXPLAIN, vscode.CodeActionKind.QuickFix, COMMAND_IDS.EXPLAIN, [
					filePath,
					effectiveRange.text,
				]),
			)

			if (context.diagnostics.length > 0) {
				const relevantDiagnostics = context.diagnostics.filter((d) =>
					EditorUtils.hasIntersectingRange(effectiveRange.range, d.range),
				)

				if (relevantDiagnostics.length > 0) {
					const diagnosticMessages = relevantDiagnostics.map(EditorUtils.createDiagnosticData)
					actions.push(
						...this.createActionPair(ACTION_NAMES.FIX, vscode.CodeActionKind.QuickFix, COMMAND_IDS.FIX, [
							filePath,
							effectiveRange.text,
							diagnosticMessages,
						]),
					)
				}
			} else {
				actions.push(
					...this.createActionPair(ACTION_NAMES.FIX_LOGIC, vscode.CodeActionKind.QuickFix, COMMAND_IDS.FIX, [
						filePath,
						effectiveRange.text,
					]),
				)
			}

			actions.push(
				...this.createActionPair(
					ACTION_NAMES.IMPROVE,
					vscode.CodeActionKind.RefactorRewrite,
					COMMAND_IDS.IMPROVE,
					[filePath, effectiveRange.text],
				),
			)

			actions.push(
				this.createAction(
					ACTION_NAMES.ADD_TO_CONTEXT,
					vscode.CodeActionKind.QuickFix,
					COMMAND_IDS.ADD_TO_CONTEXT,
					[filePath, effectiveRange.text],
				),
			)

			return actions
		} catch (error) {
			console.error("Error providing code actions:", error)
			return []
		}
	}
}
