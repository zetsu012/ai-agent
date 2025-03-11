import * as vscode from "vscode"

export class DecorationController {
	private fadedOverlayDecorationType: vscode.TextEditorDecorationType
	private activeLineDecorationType: vscode.TextEditorDecorationType
	private decorationType: "fadedOverlay" | "activeLine"
	private editor: vscode.TextEditor
	private ranges: vscode.Range[] = []

	constructor(decorationType: "fadedOverlay" | "activeLine", editor: vscode.TextEditor) {
		this.decorationType = decorationType
		this.editor = editor

		// 创建装饰类型
		this.fadedOverlayDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(255, 255, 0, 0.1)",
			opacity: "0.4",
			isWholeLine: true,
		})

		this.activeLineDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(255, 255, 0, 0.3)",
			opacity: "1",
			isWholeLine: true,
			border: "1px solid rgba(255, 255, 0, 0.5)",
		})
	}

	getDecoration() {
		switch (this.decorationType) {
			case "fadedOverlay":
				return this.fadedOverlayDecorationType
			case "activeLine":
				return this.activeLineDecorationType
		}
	}

	addLines(startIndex: number, numLines: number) {
		// Guard against invalid inputs
		if (startIndex < 0 || numLines <= 0) {
			return
		}

		const lastRange = this.ranges[this.ranges.length - 1]
		if (lastRange && lastRange.end.line === startIndex - 1) {
			this.ranges[this.ranges.length - 1] = lastRange.with(undefined, lastRange.end.translate(numLines))
		} else {
			const endLine = startIndex + numLines - 1
			this.ranges.push(new vscode.Range(startIndex, 0, endLine, Number.MAX_SAFE_INTEGER))
		}

		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}

	clear() {
		this.ranges = []
		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}

	updateOverlayAfterLine(line: number, totalLines: number) {
		// Remove any existing ranges that start at or after the current line
		this.ranges = this.ranges.filter((range) => range.end.line < line)

		// Add a new range for all lines after the current line
		if (line < totalLines - 1) {
			this.ranges.push(
				new vscode.Range(
					new vscode.Position(line + 1, 0),
					new vscode.Position(totalLines - 1, Number.MAX_SAFE_INTEGER),
				),
			)
		}

		// Apply the updated decorations
		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}

	setActiveLine(line: number) {
		this.ranges = [new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)]
		this.editor.setDecorations(this.getDecoration(), this.ranges)
	}
}
