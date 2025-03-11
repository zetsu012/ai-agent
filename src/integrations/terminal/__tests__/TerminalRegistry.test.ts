import * as vscode from "vscode"
import { TerminalRegistry } from "../TerminalRegistry"

// Mock vscode.window.createTerminal
const mockCreateTerminal = jest.fn()
jest.mock("vscode", () => ({
	window: {
		createTerminal: (...args: any[]) => {
			mockCreateTerminal(...args)
			return {
				exitStatus: undefined,
				sendText: jest.fn(),
				shellIntegration: undefined,
				show: jest.fn(),
			}
		},
	},
	ThemeIcon: jest.fn(),
}))

describe("TerminalRegistry", () => {
	beforeEach(() => {
		mockCreateTerminal.mockClear()
	})

	describe("createTerminal", () => {
		it("creates terminal with PAGER set to cat", () => {
			TerminalRegistry.createTerminal("/test/path")

			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
				name: "CoolCline",
				iconPath: expect.any(Object),
				shellIntegration: true,
				env: {
					PAGER: "cat",
				},
			})
		})
	})
})
