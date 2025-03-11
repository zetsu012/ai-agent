// npx jest src/core/webview/__tests__/CoolClineProvider.test.ts

import * as vscode from "vscode"
import axios from "axios"

import { CoolClineProvider } from "../CoolClineProvider"
import { ExtensionMessage, ExtensionState } from "../../../shared/ExtensionMessage"
import { setSoundEnabled } from "../../../utils/sound"
import { defaultModeSlug } from "../../../shared/modes"
import { experimentDefault } from "../../../shared/experiments"

// Mock custom-instructions module
const mockAddCustomInstructions = jest.fn()

jest.mock("../../prompts/sections/custom-instructions", () => ({
	addCustomInstructions: mockAddCustomInstructions,
}))

// Mock delay module
jest.mock("delay", () => {
	const delayFn = (ms: number) => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return delayFn
})

// Mock MCP-related modules
jest.mock(
	"@modelcontextprotocol/sdk/types.js",
	() => ({
		CallToolResultSchema: {},
		ListResourcesResultSchema: {},
		ListResourceTemplatesResultSchema: {},
		ListToolsResultSchema: {},
		ReadResourceResultSchema: {},
		ErrorCode: {
			InvalidRequest: "InvalidRequest",
			MethodNotFound: "MethodNotFound",
			InternalError: "InternalError",
		},
		McpError: class McpError extends Error {
			code: string
			constructor(code: string, message: string) {
				super(message)
				this.code = code
				this.name = "McpError"
			}
		},
	}),
	{ virtual: true },
)

jest.mock(
	"@modelcontextprotocol/sdk/client/index.js",
	() => ({
		Client: jest.fn().mockImplementation(() => ({
			connect: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
			listTools: jest.fn().mockResolvedValue({ tools: [] }),
			callTool: jest.fn().mockResolvedValue({ content: [] }),
		})),
	}),
	{ virtual: true },
)

jest.mock(
	"@modelcontextprotocol/sdk/client/stdio.js",
	() => ({
		StdioClientTransport: jest.fn().mockImplementation(() => ({
			connect: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
		})),
	}),
	{ virtual: true },
)

// Mock DiffStrategy
jest.mock("../../diff/DiffStrategy", () => ({
	getDiffStrategy: jest.fn().mockImplementation(() => ({
		getToolDescription: jest.fn().mockReturnValue("apply_diff tool description"),
	})),
}))

// Mock dependencies
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	OutputChannel: jest.fn(),
	WebviewView: jest.fn(),
	Uri: {
		joinPath: jest.fn(),
		file: jest.fn(),
	},
	window: {
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
	},
	workspace: {
		getConfiguration: jest.fn().mockReturnValue({
			get: jest.fn().mockReturnValue([]),
			update: jest.fn(),
		}),
		onDidChangeConfiguration: jest.fn().mockImplementation((callback) => ({
			dispose: jest.fn(),
		})),
		onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
		onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
		onDidOpenTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
		onDidCloseTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
}))

// Mock sound utility
jest.mock("../../../utils/sound", () => ({
	setSoundEnabled: jest.fn(),
}))

// Mock ESM modules
jest.mock("p-wait-for", () => ({
	__esModule: true,
	default: jest.fn().mockResolvedValue(undefined),
}))

// Mock fs/promises
jest.mock("fs/promises", () => ({
	mkdir: jest.fn(),
	writeFile: jest.fn(),
	readFile: jest.fn(),
	unlink: jest.fn(),
	rmdir: jest.fn(),
}))

// Mock axios
jest.mock("axios", () => ({
	get: jest.fn().mockResolvedValue({ data: { data: [] } }),
	post: jest.fn(),
}))

// Mock buildApiHandler
jest.mock("../../../api", () => ({
	buildApiHandler: jest.fn(),
}))

// Mock system prompt
jest.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: jest.fn().mockImplementation(async () => "mocked system prompt"),
	codeMode: "code",
}))

// Mock WorkspaceTracker
jest.mock("../../../integrations/workspace/WorkspaceTracker", () => {
	return jest.fn().mockImplementation(() => ({
		initializeFilePaths: jest.fn(),
		dispose: jest.fn(),
	}))
})

// Mock CoolCline
jest.mock("../../CoolCline", () => ({
	CoolCline: jest
		.fn()
		.mockImplementation(
			(provider, apiConfiguration, customInstructions, diffEnabled, fuzzyMatchThreshold, task, taskId) => ({
				abortTask: jest.fn(),
				handleWebviewAskResponse: jest.fn(),
				coolclineMessages: [],
				apiConversationHistory: [],
				overwriteCoolClineMessages: jest.fn(),
				overwriteApiConversationHistory: jest.fn(),
				taskId: taskId || "test-task-id",
			}),
		),
}))

// Mock extract-text
jest.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: jest.fn().mockImplementation(async (filePath: string) => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const lines = content.split("\n")
		return lines.map((line, index) => `${index + 1} | ${line}`).join("\n")
	}),
}))

// Spy on console.error and console.log to suppress expected messages
beforeAll(() => {
	jest.spyOn(console, "error").mockImplementation(() => {})
	jest.spyOn(console, "log").mockImplementation(() => {})
})

afterAll(() => {
	jest.restoreAllMocks()
})

// 在文件顶部添加类型定义
interface MockWebview extends vscode.Webview {
	messageHandler: ((message: any) => Promise<void>) | null
}

interface MockWebviewView extends vscode.WebviewView {
	webview: MockWebview
}

describe("CoolClineProvider", () => {
	let provider: CoolClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: MockWebviewView
	let mockPostMessage: jest.Mock

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Mock context
		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: jest.fn().mockImplementation((key: string) => {
					switch (key) {
						case "mode":
							return "architect"
						case "currentApiConfigName":
							return "new-config"
						default:
							return undefined
					}
				}),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			},
			secrets: {
				get: jest.fn(),
				store: jest.fn(),
				delete: jest.fn(),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		// Mock CustomModesManager
		const mockCustomModesManager = {
			updateCustomMode: jest.fn().mockResolvedValue(undefined),
			getCustomModes: jest.fn().mockResolvedValue({}),
			dispose: jest.fn(),
		}

		// Mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
			clear: jest.fn(),
			dispose: jest.fn(),
		} as unknown as vscode.OutputChannel

		// Mock webview
		mockPostMessage = jest.fn()
		mockWebviewView = {
			webview: {
				postMessage: mockPostMessage,
				html: "",
				options: {},
				messageHandler: null as ((message: any) => Promise<void>) | null,
				onDidReceiveMessage: jest.fn().mockImplementation((handler) => {
					;(mockWebviewView.webview as MockWebview).messageHandler = handler
					return { dispose: jest.fn() }
				}),
				asWebviewUri: jest.fn(),
				cspSource: "",
			} as unknown as MockWebview,
			visible: true,
			onDidDispose: jest.fn().mockImplementation((callback) => {
				callback()
				return { dispose: jest.fn() }
			}),
			onDidChangeVisibility: jest.fn().mockImplementation((callback) => {
				return { dispose: jest.fn() }
			}),
			viewType: "test-view",
			show: jest.fn(),
		} as unknown as MockWebviewView

		provider = new CoolClineProvider(mockContext, mockOutputChannel)

		// @ts-ignore - Accessing private property for testing.
		provider.customModesManager = mockCustomModesManager
	})

	test("constructor initializes correctly", () => {
		expect(provider).toBeInstanceOf(CoolClineProvider)
		// Since getVisibleInstance returns the last instance where view.visible is true
		// @ts-ignore - accessing private property for testing
		provider.view = mockWebviewView
		expect(CoolClineProvider.getVisibleInstance()).toBe(provider)
	})

	test("resolveWebviewView sets up webview correctly", async () => {
		await provider.resolveWebviewView(mockWebviewView)

		expect(mockWebviewView.webview.options).toEqual({
			enableScripts: true,
			localResourceRoots: [mockContext.extensionUri],
		})

		expect(mockWebviewView.webview.html).toContain("<!DOCTYPE html>")
	})

	test("resolveWebviewView sets up webview correctly in development mode even if local server is not running", async () => {
		provider = new CoolClineProvider(
			{ ...mockContext, extensionMode: vscode.ExtensionMode.Development },
			mockOutputChannel,
		)
		;(axios.get as jest.Mock).mockRejectedValueOnce(new Error("Network error"))

		await provider.resolveWebviewView(mockWebviewView)

		expect(mockWebviewView.webview.options).toEqual({
			enableScripts: true,
			localResourceRoots: [mockContext.extensionUri],
		})

		expect(mockWebviewView.webview.html).toContain("<!DOCTYPE html>")
	})

	test("postMessageToWebview sends message to webview", async () => {
		await provider.resolveWebviewView(mockWebviewView)

		const mockState: ExtensionState = {
			version: "1.0.0",
			preferredLanguage: "English",
			coolclineMessages: [],
			taskHistory: [],
			shouldShowAnnouncement: false,
			apiConfiguration: {
				llmProvider: "openrouter",
			},
			customInstructions: undefined,
			requestyModels: {},
			alwaysAllowReadOnly: false,
			alwaysAllowWrite: false,
			alwaysAllowExecute: false,
			alwaysAllowBrowser: false,
			alwaysAllowMcp: false,
			alwaysAllowModeSwitch: false,
			soundEnabled: false,
			diffEnabled: true,
			soundVolume: 0.5,
			browserViewportSize: "900x600",
			screenshotQuality: 75,
			fuzzyMatchThreshold: 1.0,
			writeDelayMs: 1000,
			terminalOutputLineLimit: 500,
			mcpEnabled: true,
			enableMcpServerCreation: true,
			alwaysApproveResubmit: false,
			requestDelaySeconds: 10,
			rateLimitSeconds: 0,
			currentApiConfigName: "default",
			listApiConfigMeta: [],
			mode: "default",
			customModePrompts: {},
			customSupportPrompts: {},
			enhancementApiConfigId: undefined,
			autoApprovalEnabled: false,
			customModes: [],
			experiments: experimentDefault,
			checkpointsEnabled: true,
			uriScheme: "vscode",
		}

		const message: ExtensionMessage = {
			type: "state",
			state: mockState,
		}
		await provider.postMessageToWebview(message)

		expect(mockPostMessage).toHaveBeenCalledWith(message)
	})

	test("handles webviewDidLaunch message", async () => {
		await provider.resolveWebviewView(mockWebviewView)

		// Get the message handler from onDidReceiveMessage
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		// Simulate webviewDidLaunch message
		await messageHandler({ type: "webviewDidLaunch" })

		// Should post state and theme to webview
		expect(mockPostMessage).toHaveBeenCalled()
	})

	test("clearTask aborts current task", async () => {
		const mockAbortTask = jest.fn()
		// @ts-ignore - accessing private property for testing
		provider.coolcline = { abortTask: mockAbortTask }

		await provider.clearTask()

		expect(mockAbortTask).toHaveBeenCalled()
		// @ts-ignore - accessing private property for testing
		expect(provider.coolcline).toBeUndefined()
	})

	test("getState returns correct initial state", async () => {
		const state = await provider.getState()

		expect(state).toHaveProperty("apiConfiguration")
		expect(state.apiConfiguration).toHaveProperty("llmProvider")
		expect(state).toHaveProperty("customInstructions")
		expect(state).toHaveProperty("alwaysAllowReadOnly")
		expect(state).toHaveProperty("alwaysAllowWrite")
		expect(state).toHaveProperty("alwaysAllowExecute")
		expect(state).toHaveProperty("alwaysAllowBrowser")
		expect(state).toHaveProperty("taskHistory")
		expect(state).toHaveProperty("soundEnabled")
		expect(state).toHaveProperty("diffEnabled")
		expect(state).toHaveProperty("writeDelayMs")
	})

	test("preferredLanguage defaults to VSCode language when not set", async () => {
		// Mock VSCode language as Spanish
		;(vscode.env as any).language = "es-ES"

		const state = await provider.getState()
		expect(state.preferredLanguage).toBe("Spanish")
	})

	test("preferredLanguage defaults to English for unsupported VSCode language", async () => {
		// Mock VSCode language as an unsupported language
		;(vscode.env as any).language = "unsupported-LANG"

		const state = await provider.getState()
		expect(state.preferredLanguage).toBe("English")
	})

	test("diffEnabled defaults to true when not set", async () => {
		// Mock globalState.get to return undefined for diffEnabled
		;(mockContext.globalState.get as jest.Mock).mockReturnValue(undefined)

		const state = await provider.getState()

		expect(state.diffEnabled).toBe(true)
	})

	test("writeDelayMs defaults to 1000ms", async () => {
		// Mock globalState.get to return undefined for writeDelayMs
		;(mockContext.globalState.get as jest.Mock).mockImplementation((key: string) => {
			if (key === "writeDelayMs") {
				return undefined
			}
			return null
		})

		const state = await provider.getState()
		expect(state.writeDelayMs).toBe(1000)
	})

	test("handles writeDelayMs message", async () => {
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		await messageHandler({ type: "writeDelayMs", value: 2000 })

		expect(mockContext.globalState.update).toHaveBeenCalledWith("writeDelayMs", 2000)
		expect(mockPostMessage).toHaveBeenCalled()
	})

	test("updates sound utility when sound setting changes", async () => {
		await provider.resolveWebviewView(mockWebviewView)

		// Get the message handler from onDidReceiveMessage
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		// Simulate setting sound to enabled
		await messageHandler({ type: "soundEnabled", bool: true })
		expect(setSoundEnabled).toHaveBeenCalledWith(true)
		expect(mockContext.globalState.update).toHaveBeenCalledWith("soundEnabled", true)
		expect(mockPostMessage).toHaveBeenCalled()

		// Simulate setting sound to disabled
		await messageHandler({ type: "soundEnabled", bool: false })
		expect(setSoundEnabled).toHaveBeenCalledWith(false)
		expect(mockContext.globalState.update).toHaveBeenCalledWith("soundEnabled", false)
		expect(mockPostMessage).toHaveBeenCalled()
	})

	test("requestDelaySeconds defaults to 5 seconds", async () => {
		// Mock globalState.get to return undefined for requestDelaySeconds
		;(mockContext.globalState.get as jest.Mock).mockImplementation((key: string) => {
			if (key === "requestDelaySeconds") {
				return undefined
			}
			return null
		})

		const state = await provider.getState()
		expect(state.requestDelaySeconds).toBe(10)
	})

	test("alwaysApproveResubmit defaults to false", async () => {
		// Mock globalState.get to return undefined for alwaysApproveResubmit
		;(mockContext.globalState.get as jest.Mock).mockReturnValue(undefined)

		const state = await provider.getState()
		expect(state.alwaysApproveResubmit).toBe(false)
	})

	test("loads saved API config when switching modes", async () => {
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		// Mock ConfigManager methods
		provider.configManager = {
			getModeConfigId: jest.fn().mockResolvedValue("test-id"),
			listConfig: jest.fn().mockResolvedValue([{ name: "test-config", id: "test-id", llmProvider: "anthropic" }]),
			loadConfig: jest.fn().mockResolvedValue({ llmProvider: "anthropic" }),
			setModeConfig: jest.fn(),
		} as any

		// Switch to architect mode
		await messageHandler({ type: "mode", text: "architect" })

		// Should load the saved config for architect mode
		expect(provider.configManager.getModeConfigId).toHaveBeenCalledWith("architect")
		expect(provider.configManager.loadConfig).toHaveBeenCalledWith("test-config")
		expect(mockContext.globalState.update).toHaveBeenCalledWith("currentApiConfigName", "test-config")
	})

	test("saves current config when switching to mode without config", async () => {
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		// Mock ConfigManager methods
		provider.configManager = {
			getModeConfigId: jest.fn().mockResolvedValue(undefined),
			listConfig: jest
				.fn()
				.mockResolvedValue([{ name: "current-config", id: "current-id", llmProvider: "anthropic" }]),
			setModeConfig: jest.fn(),
		} as any

		// Mock current config name
		;(mockContext.globalState.get as jest.Mock).mockImplementation((key: string) => {
			if (key === "currentApiConfigName") {
				return "current-config"
			}
			return undefined
		})

		// Switch to architect mode
		await messageHandler({ type: "mode", text: "architect" })

		// Should save current config as default for architect mode
		expect(provider.configManager.setModeConfig).toHaveBeenCalledWith("architect", "current-id")
	})

	test("saves config as default for current mode when loading config", async () => {
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		provider.configManager = {
			loadConfig: jest.fn().mockResolvedValue({ llmProvider: "anthropic", id: "new-id" }),
			listConfig: jest.fn().mockResolvedValue([{ name: "new-config", id: "new-id", llmProvider: "anthropic" }]),
			setModeConfig: jest.fn(),
			getModeConfigId: jest.fn().mockResolvedValue(undefined),
		} as any

		// First set the mode
		await messageHandler({ type: "mode", text: "architect" })

		// Then load the config
		await messageHandler({ type: "loadApiConfiguration", text: "new-config" })

		// Should save new config as default for architect mode
		expect(provider.configManager.setModeConfig).toHaveBeenCalledWith("architect", "new-id")
	})

	test("handles request delay settings messages", async () => {
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		// Test alwaysApproveResubmit
		await messageHandler({ type: "alwaysApproveResubmit", bool: true })
		expect(mockContext.globalState.update).toHaveBeenCalledWith("alwaysApproveResubmit", true)
		expect(mockPostMessage).toHaveBeenCalled()

		// Test requestDelaySeconds
		await messageHandler({ type: "requestDelaySeconds", value: 10 })
		expect(mockContext.globalState.update).toHaveBeenCalledWith("requestDelaySeconds", 10)
		expect(mockPostMessage).toHaveBeenCalled()
	})

	test("handles updatePrompt message correctly", async () => {
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		// Mock existing prompts
		const existingPrompts = {
			code: "existing code prompt",
			architect: "existing architect prompt",
		}
		;(mockContext.globalState.get as jest.Mock).mockImplementation((key: string) => {
			if (key === "customModePrompts") {
				return existingPrompts
			}
			return undefined
		})

		// Test updating a prompt
		await messageHandler({
			type: "updatePrompt",
			promptMode: "code",
			customPrompt: "new code prompt",
		})

		// Verify state was updated correctly
		expect(mockContext.globalState.update).toHaveBeenCalledWith("customModePrompts", {
			...existingPrompts,
			code: "new code prompt",
		})

		// Verify state was posted to webview
		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "state",
				state: expect.objectContaining({
					customModePrompts: {
						...existingPrompts,
						code: "new code prompt",
					},
				}),
			}),
		)
	})

	test("customModePrompts defaults to empty object", async () => {
		// Mock globalState.get to return undefined for customModePrompts
		;(mockContext.globalState.get as jest.Mock).mockImplementation((key: string) => {
			if (key === "customModePrompts") {
				return undefined
			}
			return null
		})

		const state = await provider.getState()
		expect(state.customModePrompts).toEqual({})
	})

	test("uses mode-specific custom instructions in CoolCline initialization", async () => {
		// Setup mock state
		const modeCustomInstructions = "Code mode instructions"
		const mockApiConfig = {
			llmProvider: "openrouter",
			openRouterModelInfo: { supportsComputerUse: true },
		}

		jest.spyOn(provider, "getState").mockResolvedValue({
			apiConfiguration: mockApiConfig,
			customModePrompts: {
				code: { customInstructions: modeCustomInstructions },
			},
			mode: "code",
			diffEnabled: true,
			fuzzyMatchThreshold: 1.0,
			experiments: experimentDefault,
		} as any)

		// Reset CoolCline mock
		const { CoolCline } = require("../../CoolCline")
		;(CoolCline as jest.Mock).mockClear()

		// Initialize CoolCline with a task
		await provider.initCoolClineWithTask("Test task")

		// Verify CoolCline was initialized with mode-specific instructions
		expect(CoolCline).toHaveBeenCalledWith(
			provider,
			mockApiConfig,
			modeCustomInstructions,
			true,
			undefined,
			1,
			"Test task",
			undefined,
			undefined,
			{ experimentalDiffStrategy: false, insert_content: false, search_and_replace: false },
		)
	})
	test("handles mode-specific custom instructions updates", async () => {
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		// Mock existing prompts
		const existingPrompts = {
			code: {
				roleDefinition: "Code role",
				customInstructions: "Old instructions",
			},
		}
		mockContext.globalState.get = jest.fn((key: string) => {
			if (key === "customModePrompts") {
				return existingPrompts
			}
			return undefined
		})

		// Update custom instructions for code mode
		await messageHandler({
			type: "updatePrompt",
			promptMode: "code",
			customPrompt: {
				roleDefinition: "Code role",
				customInstructions: "New instructions",
			},
		})

		// Verify state was updated correctly
		expect(mockContext.globalState.update).toHaveBeenCalledWith("customModePrompts", {
			code: {
				roleDefinition: "Code role",
				customInstructions: "New instructions",
			},
		})
	})

	test("saves mode config when updating API configuration", async () => {
		// Setup mock context with mode and config name
		mockContext = {
			...mockContext,
			globalState: {
				...mockContext.globalState,
				get: jest.fn((key: string) => {
					if (key === "mode") {
						return "code"
					} else if (key === "currentApiConfigName") {
						return "test-config"
					}
					return undefined
				}),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			},
		} as unknown as vscode.ExtensionContext

		// Create new provider with updated mock context
		provider = new CoolClineProvider(mockContext, mockOutputChannel)
		await provider.resolveWebviewView(mockWebviewView)
		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

		provider.configManager = {
			listConfig: jest.fn().mockResolvedValue([{ name: "test-config", id: "test-id", llmProvider: "anthropic" }]),
			setModeConfig: jest.fn(),
		} as any

		// Update API configuration
		await messageHandler({
			type: "apiConfiguration",
			apiConfiguration: { llmProvider: "anthropic" },
		})

		// Should save config as default for current mode
		expect(provider.configManager.setModeConfig).toHaveBeenCalledWith("code", "test-id")
	})

	test("file content includes line numbers", async () => {
		const { extractTextFromFile } = require("../../../integrations/misc/extract-text")
		const result = await extractTextFromFile("test.js")
		expect(result).toBe("1 | const x = 1;\n2 | const y = 2;\n3 | const z = 3;")
	})

	describe("deleteMessage", () => {
		beforeEach(async () => {
			// Mock window.showInformationMessage
			;(vscode.window.showInformationMessage as jest.Mock) = jest.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test('handles "Just this message" deletion correctly', async () => {
			// Mock user selecting "Just this message"
			;(vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("Just this message")

			// Setup mock messages
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback" }, // User message 1
				{ ts: 2000, type: "say", say: "tool" }, // Tool message
				{ ts: 3000, type: "say", say: "text", value: 4000 }, // Message to delete
				{ ts: 4000, type: "say", say: "browser_action" }, // Response to delete
				{ ts: 5000, type: "say", say: "user_feedback" }, // Next user message
				{ ts: 6000, type: "say", say: "user_feedback" }, // Final message
			]

			const mockApiHistory = [{ ts: 1000 }, { ts: 2000 }, { ts: 3000 }, { ts: 4000 }, { ts: 5000 }, { ts: 6000 }]

			// Setup CoolCline instance with mock data
			const mockCoolCline = {
				coolclineMessages: mockMessages,
				apiConversationHistory: mockApiHistory,
				overwriteCoolClineMessages: jest.fn(),
				overwriteApiConversationHistory: jest.fn(),
				taskId: "test-task-id",
				abortTask: jest.fn(),
				handleWebviewAskResponse: jest.fn(),
			}
			// @ts-ignore - accessing private property for testing
			provider.coolcline = mockCoolCline

			// Mock getTaskWithId
			;(provider as any).getTaskWithId = jest.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			// Trigger message deletion
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]
			await messageHandler({ type: "deleteMessage", value: 4000 })

			// Verify correct messages were kept
			expect(mockCoolCline.overwriteCoolClineMessages).toHaveBeenCalledWith([
				mockMessages[0],
				mockMessages[1],
				mockMessages[4],
				mockMessages[5],
			])

			// Verify correct API messages were kept
			expect(mockCoolCline.overwriteApiConversationHistory).toHaveBeenCalledWith([
				mockApiHistory[0],
				mockApiHistory[1],
				mockApiHistory[4],
				mockApiHistory[5],
			])
		})

		test('handles "This and all subsequent messages" deletion correctly', async () => {
			// Mock user selecting "This and all subsequent messages"
			;(vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("This and all subsequent messages")

			// Setup mock messages
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback" },
				{ ts: 2000, type: "say", say: "text", value: 3000 }, // Message to delete
				{ ts: 3000, type: "say", say: "user_feedback" },
				{ ts: 4000, type: "say", say: "user_feedback" },
			]

			const mockApiHistory = [{ ts: 1000 }, { ts: 2000 }, { ts: 3000 }, { ts: 4000 }]

			// Setup CoolCline instance with mock data
			const mockCoolCline = {
				coolclineMessages: mockMessages,
				apiConversationHistory: mockApiHistory,
				overwriteCoolClineMessages: jest.fn(),
				overwriteApiConversationHistory: jest.fn(),
				taskId: "test-task-id",
				abortTask: jest.fn(),
				handleWebviewAskResponse: jest.fn(),
			}
			// @ts-ignore - accessing private property for testing
			provider.coolcline = mockCoolCline

			// Mock getTaskWithId
			;(provider as any).getTaskWithId = jest.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			// Trigger message deletion
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]
			await messageHandler({ type: "deleteMessage", value: 3000 })

			// Verify only messages before the deleted message were kept
			expect(mockCoolCline.overwriteCoolClineMessages).toHaveBeenCalledWith([mockMessages[0]])

			// Verify only API messages before the deleted message were kept
			expect(mockCoolCline.overwriteApiConversationHistory).toHaveBeenCalledWith([mockApiHistory[0]])
		})

		test("handles Cancel correctly", async () => {
			// Mock user selecting "Cancel"
			;(vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("Cancel")

			const mockCoolCline = {
				coolclineMessages: [{ ts: 1000 }, { ts: 2000 }],
				apiConversationHistory: [{ ts: 1000 }, { ts: 2000 }],
				overwriteCoolClineMessages: jest.fn(),
				overwriteApiConversationHistory: jest.fn(),
				taskId: "test-task-id",
			}
			// @ts-ignore - accessing private property for testing
			provider.coolcline = mockCoolCline

			// Trigger message deletion
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]
			await messageHandler({ type: "deleteMessage", value: 2000 })

			// Verify no messages were deleted
			expect(mockCoolCline.overwriteCoolClineMessages).not.toHaveBeenCalled()
			expect(mockCoolCline.overwriteApiConversationHistory).not.toHaveBeenCalled()
		})
	})

	describe("getSystemPrompt", () => {
		beforeEach(async () => {
			mockPostMessage.mockClear()
			await provider.resolveWebviewView(mockWebviewView)
			// Reset and setup mock
			mockAddCustomInstructions.mockClear()
			mockAddCustomInstructions.mockImplementation(
				(modeInstructions: string, globalInstructions: string, cwd: string) => {
					return Promise.resolve(modeInstructions || globalInstructions || "")
				},
			)
		})

		const getMessageHandler = () => {
			const mockCalls = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls
			expect(mockCalls.length).toBeGreaterThan(0)
			return mockCalls[0][0]
		}

		test("handles mcpEnabled setting correctly", async () => {
			// Mock getState to return mcpEnabled: true
			jest.spyOn(provider, "getState").mockResolvedValue({
				apiConfiguration: {
					llmProvider: "openrouter" as const,
					openRouterModelInfo: {
						supportsComputerUse: true,
						supportsPromptCache: false,
						maxTokens: 4096,
						contextWindow: 8192,
						supportsImages: false,
						inputPrice: 0.0,
						outputPrice: 0.0,
						description: undefined,
					},
				},
				mcpEnabled: true,
				enableMcpServerCreation: false,
				mode: "code" as const,
				experiments: experimentDefault,
			} as any)

			const handler1 = getMessageHandler()
			expect(typeof handler1).toBe("function")
			await handler1({ type: "getSystemPrompt", mode: "code" })

			// Verify mcpHub is passed when mcpEnabled is true
			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "systemPrompt",
					text: expect.any(String),
				}),
			)

			// Mock getState to return mcpEnabled: false
			jest.spyOn(provider, "getState").mockResolvedValue({
				apiConfiguration: {
					llmProvider: "openrouter" as const,
					openRouterModelInfo: {
						supportsComputerUse: true,
						supportsPromptCache: false,
						maxTokens: 4096,
						contextWindow: 8192,
						supportsImages: false,
						inputPrice: 0.0,
						outputPrice: 0.0,
						description: undefined,
					},
				},
				mcpEnabled: false,
				enableMcpServerCreation: false,
				mode: "code" as const,
				experiments: experimentDefault,
			} as any)

			const handler2 = getMessageHandler()
			await handler2({ type: "getSystemPrompt", mode: "code" })

			// Verify mcpHub is not passed when mcpEnabled is false
			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "systemPrompt",
					text: expect.any(String),
				}),
			)
		})

		test("handles errors gracefully", async () => {
			// Mock SYSTEM_PROMPT to throw an error
			const systemPrompt = require("../../prompts/system")
			jest.spyOn(systemPrompt, "SYSTEM_PROMPT").mockRejectedValueOnce(new Error("Test error"))

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]
			await messageHandler({ type: "getSystemPrompt", mode: "code" })

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to get system prompt")
		})

		test("uses code mode custom instructions", async () => {
			// Get the mock function
			const mockAddCustomInstructions = (jest.requireMock("../../prompts/sections/custom-instructions") as any)
				.addCustomInstructions

			// Clear any previous calls
			mockAddCustomInstructions.mockClear()

			// Mock SYSTEM_PROMPT
			const systemPromptModule = require("../../prompts/system")
			jest.spyOn(systemPromptModule, "SYSTEM_PROMPT").mockImplementation(async () => {
				await mockAddCustomInstructions("Code mode specific instructions", "", "/mock/path")
				return "mocked system prompt"
			})

			// Trigger getSystemPrompt
			const promptHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]
			await promptHandler({ type: "getSystemPrompt" })

			// Verify mock was called with code mode instructions
			expect(mockAddCustomInstructions).toHaveBeenCalledWith(
				"Code mode specific instructions",
				"",
				expect.any(String),
			)
		})

		test("passes diffStrategy and diffEnabled to SYSTEM_PROMPT when previewing", async () => {
			// Mock getState to return experimentalDiffStrategy, diffEnabled and fuzzyMatchThreshold
			jest.spyOn(provider, "getState").mockResolvedValue({
				apiConfiguration: {
					llmProvider: "openrouter",
					apiModelId: "test-model",
					openRouterModelInfo: { supportsComputerUse: true },
				},
				customModePrompts: {},
				mode: "code",
				enableMcpServerCreation: true,
				mcpEnabled: false,
				browserViewportSize: "900x600",
				experimentalDiffStrategy: true,
				diffEnabled: true,
				fuzzyMatchThreshold: 0.8,
				experiments: experimentDefault,
			} as any)

			// Mock SYSTEM_PROMPT to verify diffStrategy and diffEnabled are passed
			const systemPromptModule = require("../../prompts/system")
			const systemPromptSpy = jest.spyOn(systemPromptModule, "SYSTEM_PROMPT")

			// Trigger getSystemPrompt
			const handler = getMessageHandler()
			await handler({ type: "getSystemPrompt", mode: "code" })

			// Verify SYSTEM_PROMPT was called with correct arguments
			expect(systemPromptSpy).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.any(String), // cwd
				true, // supportsComputerUse
				undefined, // mcpHub (disabled)
				expect.objectContaining({
					// diffStrategy
					getToolDescription: expect.any(Function),
				}),
				"900x600", // browserViewportSize
				"code", // mode
				{}, // customModePrompts
				{}, // customModes
				undefined, // effectiveInstructions
				undefined, // preferredLanguage
				true, // diffEnabled
				experimentDefault,
				true,
			)

			// Run the test again to verify it's consistent
			await handler({ type: "getSystemPrompt", mode: "code" })
			expect(systemPromptSpy).toHaveBeenCalledTimes(2)
		})

		test("passes diffEnabled: false to SYSTEM_PROMPT when diff is disabled", async () => {
			// Mock getState to return diffEnabled: false
			jest.spyOn(provider, "getState").mockResolvedValue({
				apiConfiguration: {
					llmProvider: "openrouter",
					apiModelId: "test-model",
					openRouterModelInfo: { supportsComputerUse: true },
				},
				customModePrompts: {},
				mode: "code",
				mcpEnabled: false,
				browserViewportSize: "900x600",
				experimentalDiffStrategy: true,
				diffEnabled: false,
				fuzzyMatchThreshold: 0.8,
				experiments: experimentDefault,
				enableMcpServerCreation: true,
			} as any)

			// Mock SYSTEM_PROMPT to verify diffEnabled is passed as false
			const systemPromptModule = require("../../prompts/system")
			const systemPromptSpy = jest.spyOn(systemPromptModule, "SYSTEM_PROMPT")

			// Trigger getSystemPrompt
			const handler = getMessageHandler()
			await handler({ type: "getSystemPrompt", mode: "code" })

			// Verify SYSTEM_PROMPT was called with diffEnabled: false
			expect(systemPromptSpy).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.any(String), // cwd
				true, // supportsComputerUse
				undefined, // mcpHub (disabled)
				expect.objectContaining({
					// diffStrategy
					getToolDescription: expect.any(Function),
				}),
				"900x600", // browserViewportSize
				"code", // mode
				{}, // customModePrompts
				{}, // customModes
				undefined, // effectiveInstructions
				undefined, // preferredLanguage
				false, // diffEnabled
				experimentDefault,
				true,
			)
		})

		test("uses correct mode-specific instructions when mode is specified", async () => {
			// Mock getState to return architect mode instructions
			jest.spyOn(provider, "getState").mockResolvedValue({
				apiConfiguration: {
					llmProvider: "openrouter",
					openRouterModelInfo: { supportsComputerUse: true },
				},
				customModePrompts: {
					architect: { customInstructions: "Architect mode instructions" },
				},
				mode: "architect",
				enableMcpServerCreation: false,
				mcpEnabled: false,
				browserViewportSize: "900x600",
				experiments: experimentDefault,
			} as any)

			// Mock SYSTEM_PROMPT to call addCustomInstructions
			const systemPromptModule = require("../../prompts/system")
			jest.spyOn(systemPromptModule, "SYSTEM_PROMPT").mockImplementation(async () => {
				await mockAddCustomInstructions("Architect mode instructions", "", "/mock/path")
				return "mocked system prompt"
			})

			// Resolve webview and trigger getSystemPrompt
			await provider.resolveWebviewView(mockWebviewView)
			const architectHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]
			await architectHandler({ type: "getSystemPrompt" })

			// Verify architect mode instructions were used
			expect(mockAddCustomInstructions).toHaveBeenCalledWith(
				"Architect mode instructions",
				"",
				expect.any(String),
			)
		})
	})

	describe("handleModeSwitch", () => {
		beforeEach(async () => {
			// Set up webview for each test
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("loads saved API config when switching modes", async () => {
			// Mock ConfigManager methods
			provider.configManager = {
				getModeConfigId: jest.fn().mockResolvedValue("saved-config-id"),
				listConfig: jest
					.fn()
					.mockResolvedValue([{ name: "saved-config", id: "saved-config-id", llmProvider: "anthropic" }]),
				loadConfig: jest.fn().mockResolvedValue({ llmProvider: "anthropic" }),
				setModeConfig: jest.fn(),
			} as any

			// Switch to architect mode
			await provider.handleModeSwitch("architect")

			// Verify mode was updated
			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")

			// Verify saved config was loaded
			expect(provider.configManager.getModeConfigId).toHaveBeenCalledWith("architect")
			expect(provider.configManager.loadConfig).toHaveBeenCalledWith("saved-config")
			expect(mockContext.globalState.update).toHaveBeenCalledWith("currentApiConfigName", "saved-config")

			// Verify state was posted to webview
			expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }))
		})

		test("saves current config when switching to mode without config", async () => {
			// Mock ConfigManager methods
			provider.configManager = {
				getModeConfigId: jest.fn().mockResolvedValue(undefined),
				listConfig: jest
					.fn()
					.mockResolvedValue([{ name: "current-config", id: "current-id", llmProvider: "anthropic" }]),
				setModeConfig: jest.fn(),
			} as any

			// Mock current config name
			;(mockContext.globalState.get as jest.Mock).mockImplementation((key: string) => {
				if (key === "currentApiConfigName") return "current-config"
				return undefined
			})

			// Switch to architect mode
			await provider.handleModeSwitch("architect")

			// Verify mode was updated
			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")

			// Verify current config was saved as default for new mode
			expect(provider.configManager.setModeConfig).toHaveBeenCalledWith("architect", "current-id")

			// Verify state was posted to webview
			expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }))
		})
	})

	describe("updateCustomMode", () => {
		test("updates both file and state when updating custom mode", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0]

			// Mock CustomModesManager methods
			provider.customModesManager = {
				updateCustomMode: jest.fn().mockResolvedValue(undefined),
				getCustomModes: jest.fn().mockResolvedValue({
					"test-mode": {
						slug: "test-mode",
						name: "Test Mode",
						roleDefinition: "Updated role definition",
						groups: ["read"] as const,
					},
				}),
				dispose: jest.fn(),
			} as any

			// Test updating a custom mode
			await messageHandler({
				type: "updateCustomMode",
				modeConfig: {
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Updated role definition",
					groups: ["read"] as const,
				},
			})

			// Verify CustomModesManager.updateCustomMode was called
			expect(provider.customModesManager.updateCustomMode).toHaveBeenCalledWith(
				"test-mode",
				expect.objectContaining({
					slug: "test-mode",
					roleDefinition: "Updated role definition",
				}),
			)

			// Verify state was updated
			expect(mockContext.globalState.update).toHaveBeenCalledWith(
				"customModes",
				expect.objectContaining({
					"test-mode": expect.objectContaining({
						slug: "test-mode",
						roleDefinition: "Updated role definition",
					}),
				}),
			)

			// Verify state was posted to webview
			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "state",
					state: expect.objectContaining({
						customModes: expect.objectContaining({
							"test-mode": expect.objectContaining({
								slug: "test-mode",
								roleDefinition: "Updated role definition",
							}),
						}),
					}),
				}),
			)
		})
	})

	describe("upsertApiConfiguration", () => {
		test("handles error in upsertApiConfiguration gracefully", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview as MockWebview).messageHandler
			expect(messageHandler).not.toBeNull()

			// Mock ConfigManager methods to simulate error
			provider.configManager = {
				setModeConfig: jest.fn().mockRejectedValue(new Error("Failed to update mode config")),
				listConfig: jest
					.fn()
					.mockResolvedValue([{ name: "test-config", id: "test-id", llmProvider: "anthropic" }]),
			} as any

			// Mock getState to provide necessary data
			jest.spyOn(provider, "getState").mockResolvedValue({
				mode: "code",
				currentApiConfigName: "test-config",
			} as any)

			// Trigger updateApiConfiguration
			await messageHandler!({
				type: "upsertApiConfiguration",
				text: "test-config",
				apiConfiguration: {
					llmProvider: "anthropic",
					apiKey: "test-key",
				},
			})

			// Verify error was logged and user was notified
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Error create new api configuration"),
			)
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to create api configuration")
		})

		test("handles successful upsertApiConfiguration", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview as MockWebview).messageHandler
			expect(messageHandler).not.toBeNull()

			// Mock ConfigManager methods
			provider.configManager = {
				saveConfig: jest.fn().mockResolvedValue(undefined),
				listConfig: jest
					.fn()
					.mockResolvedValue([{ name: "test-config", id: "test-id", llmProvider: "anthropic" }]),
			} as any

			const testApiConfig = {
				llmProvider: "anthropic" as const,
				apiKey: "test-key",
			}

			// Trigger upsertApiConfiguration
			await messageHandler!({
				type: "upsertApiConfiguration",
				text: "test-config",
				apiConfiguration: testApiConfig,
			})

			// Verify config was saved
			expect(provider.configManager.saveConfig).toHaveBeenCalledWith("test-config", testApiConfig)

			// Verify state updates
			expect(mockContext.globalState.update).toHaveBeenCalledWith("listApiConfigMeta", [
				{ name: "test-config", id: "test-id", llmProvider: "anthropic" },
			])
			expect(mockContext.globalState.update).toHaveBeenCalledWith("currentApiConfigName", "test-config")

			// Verify state was posted to webview
			expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }))
		})

		test("handles buildApiHandler error in updateApiConfiguration", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview as MockWebview).messageHandler
			expect(messageHandler).not.toBeNull()

			// Mock buildApiHandler to throw an error
			const { buildApiHandler } = require("../../../api")
			;(buildApiHandler as jest.Mock).mockImplementationOnce(() => {
				throw new Error("API handler error")
			})

			// Mock ConfigManager methods
			provider.configManager = {
				saveConfig: jest.fn().mockResolvedValue(undefined),
				listConfig: jest
					.fn()
					.mockResolvedValue([{ name: "test-config", id: "test-id", llmProvider: "anthropic" }]),
			} as any

			// Setup mock CoolCline instance
			const mockCoolCline = {
				api: undefined,
				abortTask: jest.fn(),
			}
			// @ts-ignore - accessing private property for testing
			provider.coolcline = mockCoolCline

			const testApiConfig = {
				llmProvider: "anthropic" as const,
				apiKey: "test-key",
			}

			// Trigger upsertApiConfiguration
			await messageHandler!({
				type: "upsertApiConfiguration",
				text: "test-config",
				apiConfiguration: testApiConfig,
			})

			// Verify error handling
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Error create new api configuration"),
			)
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to create api configuration")

			// Verify state was still updated
			expect(mockContext.globalState.update).toHaveBeenCalledWith("listApiConfigMeta", [
				{ name: "test-config", id: "test-id", llmProvider: "anthropic" },
			])
			expect(mockContext.globalState.update).toHaveBeenCalledWith("currentApiConfigName", "test-config")
		})
	})

	describe("handleTerminalAction", () => {
		it("should handle terminal add to context action", async () => {
			const mockProvider = {
				getState: jest.fn().mockResolvedValue({ customSupportPrompts: undefined }),
				postMessageToWebview: jest.fn(),
			}

			jest.spyOn(CoolClineProvider, "getInstance").mockResolvedValue(mockProvider as any)

			await CoolClineProvider.handleTerminalAction("coolcline.terminalAddToContext", "TERMINAL_ADD_TO_CONTEXT", {
				terminalContent: "test content",
			})

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: expect.stringContaining("test content"),
			})
		})

		it("should handle terminal fix command in current task", async () => {
			const mockProvider = {
				getState: jest.fn().mockResolvedValue({ customSupportPrompts: undefined }),
				postMessageToWebview: jest.fn(),
				coolcline: {}, // 模拟存在的 coolcline 实例
			}

			jest.spyOn(CoolClineProvider, "getInstance").mockResolvedValue(mockProvider as any)

			await CoolClineProvider.handleTerminalAction("coolcline.terminalFixCommandInCurrentTask", "TERMINAL_FIX", {
				terminalContent: "test command",
			})

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "invoke",
				invoke: "sendMessage",
				text: expect.stringContaining("test command"),
			})
		})

		it("should handle terminal explain command with new task", async () => {
			const mockProvider = {
				getState: jest.fn().mockResolvedValue({ customSupportPrompts: undefined }),
				postMessageToWebview: jest.fn(),
				initCoolClineWithTask: jest.fn(),
			}

			jest.spyOn(CoolClineProvider, "getInstance").mockResolvedValue(mockProvider as any)

			await CoolClineProvider.handleTerminalAction("coolcline.terminalExplainCommand", "TERMINAL_EXPLAIN", {
				terminalContent: "test command",
			})

			expect(mockProvider.initCoolClineWithTask).toHaveBeenCalledWith(expect.stringContaining("test command"))
		})

		it("should do nothing when no provider is available", async () => {
			jest.spyOn(CoolClineProvider, "getInstance").mockResolvedValue(undefined)

			await CoolClineProvider.handleTerminalAction("coolcline.terminalAddToContext", "TERMINAL_ADD_TO_CONTEXT", {
				terminalContent: "test content",
			})

			// 验证没有抛出错误
		})

		it("should use custom support prompts when available", async () => {
			const customPrompt = "Custom prompt template: ${terminalContent}"
			const mockProvider = {
				getState: jest.fn().mockResolvedValue({
					customSupportPrompts: {
						TERMINAL_ADD_TO_CONTEXT: customPrompt,
					},
				}),
				postMessageToWebview: jest.fn(),
			}

			jest.spyOn(CoolClineProvider, "getInstance").mockResolvedValue(mockProvider as any)

			await CoolClineProvider.handleTerminalAction("coolcline.terminalAddToContext", "TERMINAL_ADD_TO_CONTEXT", {
				terminalContent: "test content",
			})

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: "Custom prompt template: test content",
			})
		})
	})
})
