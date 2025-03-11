import * as vscode from "vscode"
import { TerminalManager } from "../TerminalManager"

jest.mock("vscode", () => ({
	env: {
		clipboard: {
			readText: jest.fn(),
			writeText: jest.fn(),
		},
	},
	commands: {
		executeCommand: jest.fn(),
	},
	window: {
		onDidStartTerminalShellExecution: jest.fn(),
	},
}))

describe("TerminalManager", () => {
	let terminalManager: TerminalManager

	beforeEach(() => {
		terminalManager = new TerminalManager()
		;(vscode.commands.executeCommand as jest.Mock).mockReset()
		;(vscode.env.clipboard.readText as jest.Mock).mockReset()
		;(vscode.env.clipboard.writeText as jest.Mock).mockReset()
		;(vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined)
	})

	describe("getTerminalContents", () => {
		const terminalContent = "terminal content"
		const originalContent = "original content"

		beforeEach(() => {
			jest.clearAllMocks()
			let clipboardContent = originalContent
			;(vscode.env.clipboard.readText as jest.Mock).mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				return clipboardContent
			})
			;(vscode.env.clipboard.writeText as jest.Mock).mockImplementation(async (text: string) => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				clipboardContent = text
			})
			;(vscode.commands.executeCommand as jest.Mock).mockImplementation(async (command: string) => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				if (command === "workbench.action.terminal.copySelection") {
					clipboardContent = terminalContent
				}
				return undefined
			})
		})

		it("should get all terminal content when commands is -1", async () => {
			const result = await terminalManager.getTerminalContents(-1)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.terminal.clearSelection")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
				"workbench.action.terminal.selectToPreviousCommand",
			)
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.terminal.copySelection")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.terminal.clearSelection")
			expect(result).toBe(terminalContent)
		})

		it("should get specific number of commands when commands > 0", async () => {
			const result = await terminalManager.getTerminalContents(1)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
				"workbench.action.terminal.selectToPreviousCommand",
			)
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.terminal.copySelection")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.terminal.clearSelection")
			expect(result).toBe(terminalContent)
		})

		it("should return empty string when no content is copied", async () => {
			const sameContent = "same content"
			let clipboardContent = sameContent
			;(vscode.env.clipboard.readText as jest.Mock).mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				return clipboardContent
			})
			;(vscode.commands.executeCommand as jest.Mock).mockImplementation(async (command: string) => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				if (command === "workbench.action.terminal.copySelection") {
					clipboardContent = sameContent
				}
				return undefined
			})

			const result = await terminalManager.getTerminalContents(-1)

			expect(result).toBe("")
		})

		it("should restore clipboard on error", async () => {
			;(vscode.commands.executeCommand as jest.Mock).mockRejectedValue(new Error("Test error"))

			await expect(terminalManager.getTerminalContents(-1)).rejects.toThrow("Test error")
			expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(originalContent)
		})

		it("should process multi-line content correctly", async () => {
			const multiLineContent = "command\noutput line 2"
			let clipboardContent = originalContent
			;(vscode.env.clipboard.readText as jest.Mock).mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				return clipboardContent
			})
			;(vscode.env.clipboard.writeText as jest.Mock).mockImplementation(async (text: string) => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				clipboardContent = text
			})
			;(vscode.commands.executeCommand as jest.Mock).mockImplementation(async (command: string) => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				if (command === "workbench.action.terminal.copySelection") {
					clipboardContent = multiLineContent
				}
				return undefined
			})

			const result = await terminalManager.getTerminalContents(-1)

			expect(result).toBe(multiLineContent)
		})
	})
})
