import * as vscode from "vscode"
import { registerTerminalActions } from "../registerTerminalActions"
import { CoolClineProvider } from "../../core/webview/CoolClineProvider"
import { TerminalManager } from "../../integrations/terminal/TerminalManager"

jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	commands: {
		registerCommand: jest.fn(),
	},
	window: {
		showWarningMessage: jest.fn(),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
}))
jest.mock("../../core/webview/CoolClineProvider")
jest.mock("../../integrations/terminal/TerminalManager")

describe("registerTerminalActions", () => {
	let mockContext: vscode.ExtensionContext
	let mockTerminalManager: jest.Mocked<TerminalManager>
	let mockSubscriptions: any[]

	beforeEach(() => {
		jest.clearAllMocks()
		mockSubscriptions = []
		mockContext = {
			subscriptions: mockSubscriptions,
		} as any
		mockTerminalManager = new TerminalManager() as jest.Mocked<TerminalManager>
		;(TerminalManager as jest.Mock).mockImplementation(() => mockTerminalManager)
		;(vscode.commands.registerCommand as jest.Mock).mockImplementation((cmd, handler) => ({
			command: cmd,
			handler,
		}))
	})

	it("should register all terminal commands", () => {
		registerTerminalActions(mockContext)

		// 验证是否注册了所有命令
		expect(mockSubscriptions).toHaveLength(5) // ADD_TO_CONTEXT + 2 * (FIX + EXPLAIN)
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"coolcline.terminalAddToContext",
			expect.any(Function),
		)
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"coolcline.terminalFixCommand",
			expect.any(Function),
		)
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"coolcline.terminalFixCommandInCurrentTask",
			expect.any(Function),
		)
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"coolcline.terminalExplainCommand",
			expect.any(Function),
		)
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"coolcline.terminalExplainCommandInCurrentTask",
			expect.any(Function),
		)
	})

	it("should handle terminal content selection", async () => {
		registerTerminalActions(mockContext)

		// 获取注册的命令处理函数
		const commandHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]

		// 模拟没有选择内容的情况
		mockTerminalManager.getTerminalContents.mockResolvedValueOnce("terminal content")
		await commandHandler({})

		expect(mockTerminalManager.getTerminalContents).toHaveBeenCalled()
		expect(CoolClineProvider.handleTerminalAction).toHaveBeenCalledWith(
			"coolcline.terminalAddToContext",
			"TERMINAL_ADD_TO_CONTEXT",
			{
				terminalContent: "terminal content",
			},
		)
	})

	it("should show warning when no content is available", async () => {
		registerTerminalActions(mockContext)

		// 获取注册的命令处理函数
		const commandHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]

		// 模拟没有内容的情况
		mockTerminalManager.getTerminalContents.mockResolvedValueOnce("")
		await commandHandler({})

		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("No terminal content selected")
		expect(CoolClineProvider.handleTerminalAction).not.toHaveBeenCalled()
	})

	it("should use selected content when available", async () => {
		registerTerminalActions(mockContext)

		// 获取注册的命令处理函数
		const commandHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1]

		// 模拟有选择内容的情况
		mockTerminalManager.getTerminalContents.mockResolvedValueOnce("")
		await commandHandler({ selection: "selected content" })

		expect(mockTerminalManager.getTerminalContents).not.toHaveBeenCalled()
		expect(CoolClineProvider.handleTerminalAction).toHaveBeenCalledWith(
			"coolcline.terminalAddToContext",
			"TERMINAL_ADD_TO_CONTEXT",
			{
				terminalContent: "selected content",
			},
		)
	})
})
