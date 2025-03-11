import * as vscode from "vscode"
import { DecorationController } from "../DecorationController"

// 模拟 vscode 模块
jest.mock("vscode", () => {
	const mockCreateTextEditorDecorationType = jest.fn().mockReturnValue({
		dispose: jest.fn(),
	})

	return {
		window: {
			createTextEditorDecorationType: mockCreateTextEditorDecorationType,
		},
		Range: jest.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
			start: { line: startLine, character: startChar },
			end: { line: endLine, character: endChar },
			with: jest.fn().mockReturnThis(),
			translate: jest.fn().mockReturnThis(),
		})),
		Position: jest.fn().mockImplementation((line, character) => ({
			line,
			character,
		})),
	}
})

describe("DecorationController", () => {
	let decorationController: DecorationController
	let mockEditor: any

	beforeEach(() => {
		jest.clearAllMocks()
		mockEditor = {
			setDecorations: jest.fn(),
		}
		decorationController = new DecorationController("fadedOverlay", mockEditor)
	})

	it("should add lines correctly", () => {
		decorationController.addLines(0, 2)
		expect(mockEditor.setDecorations).toHaveBeenCalled()
	})

	it("should clear decorations", () => {
		decorationController.clear()
		expect(mockEditor.setDecorations).toHaveBeenCalledWith(expect.anything(), [])
	})

	it("should update overlay after line", () => {
		decorationController.updateOverlayAfterLine(1, 5)
		expect(mockEditor.setDecorations).toHaveBeenCalled()
	})

	it("should set active line", () => {
		decorationController.setActiveLine(1)
		expect(mockEditor.setDecorations).toHaveBeenCalled()
	})

	it("should get correct decoration type", () => {
		const fadedController = new DecorationController("fadedOverlay", mockEditor)
		const activeController = new DecorationController("activeLine", mockEditor)

		expect(fadedController.getDecoration()).toBeDefined()
		expect(activeController.getDecoration()).toBeDefined()
	})
})
