import { CoolCline } from "../CoolCline"
import { CoolClineProvider } from "../webview/CoolClineProvider"
import { ApiConfiguration, ModelInfo } from "../../shared/api"
import { ApiStreamChunk } from "../../api/transform/stream"
import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import * as os from "os"
import { PathUtils } from "../../services/checkpoints/CheckpointUtils"

// Mock all MCP-related modules
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

// Mock fileExistsAtPath
jest.mock("../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation((filePath) => {
		return filePath.includes("ui_messages.json") || filePath.includes("api_conversation_history.json")
	}),
}))

// Mock fs/promises
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockImplementation(async (dirPath) => {
		// 如果是创建 shadow-git 目录，直接返回成功
		if (dirPath.includes("shadow-git")) {
			return Promise.resolve()
		}
		// 其他目录创建操作正常进行
		return Promise.resolve()
	}),
	writeFile: jest.fn().mockResolvedValue(undefined),
	readFile: jest.fn().mockImplementation((filePath) => {
		if (filePath.includes("ui_messages.json")) {
			return Promise.resolve(
				JSON.stringify([
					{
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "historical task",
					},
				]),
			)
		}
		if (filePath.includes("api_conversation_history.json")) {
			return Promise.resolve("[]")
		}
		return Promise.resolve("[]")
	}),
	unlink: jest.fn().mockResolvedValue(undefined),
	rmdir: jest.fn().mockResolvedValue(undefined),
	access: jest.fn().mockImplementation(async (path) => {
		// 如果是检查 shadow-git 目录，返回不存在
		if (path.includes("shadow-git")) {
			throw new Error("ENOENT")
		}
		return Promise.resolve()
	}),
}))

// Mock dependencies
jest.mock("vscode", () => {
	const mockDisposable = { dispose: jest.fn() }
	const mockEventEmitter = {
		event: jest.fn(),
		fire: jest.fn(),
	}

	const mockTextDocument = {
		uri: {
			fsPath: "/mock/workspace/path/file.ts",
		},
	}

	const mockTextEditor = {
		document: mockTextDocument,
	}

	const mockTab = {
		input: {
			uri: {
				fsPath: "/mock/workspace/path/file.ts",
			},
		},
	}

	const mockTabGroup = {
		tabs: [mockTab],
	}

	return {
		window: {
			createTextEditorDecorationType: jest.fn().mockReturnValue({
				dispose: jest.fn(),
			}),
			createOutputChannel: jest.fn().mockReturnValue({
				append: jest.fn(),
				appendLine: jest.fn(),
				clear: jest.fn(),
				dispose: jest.fn(),
				show: jest.fn(),
				hide: jest.fn(),
				replace: jest.fn(),
				name: "Mock Output Channel",
			}),
			visibleTextEditors: [mockTextEditor],
			tabGroups: {
				all: [mockTabGroup],
				onDidChangeTabs: jest.fn(() => ({ dispose: jest.fn() })),
			},
		},
		workspace: {
			workspaceFolders: [
				{
					uri: {
						fsPath: "/mock/workspace/path",
					},
					name: "mock-workspace",
					index: 0,
				},
			],
			createFileSystemWatcher: jest.fn(() => ({
				onDidCreate: jest.fn(() => mockDisposable),
				onDidDelete: jest.fn(() => mockDisposable),
				onDidChange: jest.fn(() => mockDisposable),
				dispose: jest.fn(),
			})),
			fs: {
				stat: jest.fn().mockResolvedValue({ type: 1 }), // FileType.File = 1
			},
			onDidSaveTextDocument: jest.fn(() => mockDisposable),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: jest.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: jest.fn(),
		},
		TabInputText: jest.fn(),
	}
})

// Mock p-wait-for to resolve immediately
jest.mock("p-wait-for", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(async () => Promise.resolve()),
}))

jest.mock("delay", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(async () => Promise.resolve()),
}))

jest.mock("serialize-error", () => ({
	__esModule: true,
	serializeError: jest.fn().mockImplementation((error) => ({
		name: error.name,
		message: error.message,
		stack: error.stack,
	})),
}))

jest.mock("strip-ansi", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation((str) => str.replace(/\u001B\[\d+m/g, "")),
}))

jest.mock("globby", () => ({
	__esModule: true,
	globby: jest.fn().mockImplementation(async () => []),
}))

jest.mock("os-name", () => ({
	__esModule: true,
	default: jest.fn().mockReturnValue("Mock OS Name"),
}))

jest.mock("default-shell", () => ({
	__esModule: true,
	default: "/bin/bash", // Mock default shell path
}))

describe("CoolCline", () => {
	let mockProvider: jest.Mocked<CoolClineProvider>
	let mockApiConfig: ApiConfiguration
	let mockOutputChannel: any
	let mockExtensionContext: vscode.ExtensionContext

	beforeEach(() => {
		// Setup mock extension context
		const storageUri = {
			fsPath: PathUtils.joinPath(os.tmpdir(), "test-storage"),
		}
		mockExtensionContext = {
			globalState: {
				get: jest.fn().mockImplementation((key) => {
					if (key === "taskHistory") {
						return [
							{
								id: "123",
								ts: Date.now(),
								task: "historical task",
								tokensIn: 100,
								tokensOut: 200,
								cacheWrites: 0,
								cacheReads: 0,
								totalCost: 0.001,
							},
						]
					}
					return undefined
				}),
				update: jest.fn().mockImplementation((key, value) => Promise.resolve()),
				keys: jest.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: jest.fn().mockImplementation((key) => undefined),
				update: jest.fn().mockImplementation((key, value) => Promise.resolve()),
				keys: jest.fn().mockReturnValue([]),
			},
			secrets: {
				get: jest.fn().mockImplementation((key) => Promise.resolve(undefined)),
				store: jest.fn().mockImplementation((key, value) => Promise.resolve()),
				delete: jest.fn().mockImplementation((key) => Promise.resolve()),
			},
			extensionUri: {
				fsPath: "/mock/extension/path",
			},
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
		} as unknown as vscode.ExtensionContext

		// Setup mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
			append: jest.fn(),
			clear: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
		}

		// Setup mock provider with output channel
		mockProvider = new CoolClineProvider(mockExtensionContext, mockOutputChannel) as jest.Mocked<CoolClineProvider>

		// Setup mock API configuration
		mockApiConfig = {
			llmProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key", // Add API key to mock config
		}

		// Mock provider methods
		mockProvider.postMessageToWebview = jest.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = jest.fn().mockResolvedValue(undefined)
		mockProvider.getTaskWithId = jest.fn().mockImplementation(async (id) => ({
			historyItem: {
				id,
				ts: Date.now(),
				task: "historical task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
			},
			taskDirPath: "/mock/storage/path/tasks/123",
			apiConversationHistoryFilePath: "/mock/storage/path/tasks/123/api_conversation_history.json",
			uiMessagesFilePath: "/mock/storage/path/tasks/123/ui_messages.json",
			apiConversationHistory: [],
		}))
	})

	describe("constructor", () => {
		it("should respect provided settings", () => {
			const coolcline = new CoolCline(
				mockProvider,
				mockApiConfig,
				"custom instructions",
				true,
				false,
				0.95,
				"test task",
				undefined,
				undefined,
				undefined,
			)

			expect(coolcline.diffEnabled).toBe(true)
			expect(coolcline.diffStrategy).toBeDefined()
		})

		it("should use default fuzzy match threshold when not provided", () => {
			const coolcline = new CoolCline(
				mockProvider,
				mockApiConfig,
				undefined,
				true,
				false,
				undefined,
				"test task",
				undefined,
				undefined,
				undefined,
			)

			expect(coolcline.fuzzyMatchThreshold).toBe(1.0)
		})

		it("should use provided fuzzy match threshold", () => {
			const getDiffStrategySpy = jest.spyOn(require("../diff/DiffStrategy"), "getDiffStrategy")

			const coolcline = new CoolCline(
				mockProvider,
				mockApiConfig,
				"custom instructions",
				true,
				false,
				1.0,
				"test task",
				undefined,
				undefined,
				undefined,
			)

			expect(coolcline.diffEnabled).toBe(true)
			expect(coolcline.diffStrategy).toBeDefined()
			expect(getDiffStrategySpy).toHaveBeenCalledWith("claude-3-5-sonnet-20241022", 1.0, false)

			getDiffStrategySpy.mockRestore()
		})

		it("should pass default threshold to diff strategy when not provided", () => {
			const getDiffStrategySpy = jest.spyOn(require("../diff/DiffStrategy"), "getDiffStrategy")

			const coolcline = new CoolCline(
				mockProvider,
				mockApiConfig,
				undefined,
				true,
				false,
				undefined,
				"test task",
				undefined,
				undefined,
				undefined,
			)

			expect(coolcline.diffEnabled).toBe(true)
			expect(coolcline.diffStrategy).toBeDefined()
			expect(getDiffStrategySpy).toHaveBeenCalledWith("claude-3-5-sonnet-20241022", 1.0, false)

			getDiffStrategySpy.mockRestore()
		})

		it("should require either task or historyItem", () => {
			expect(() => {
				new CoolCline(
					mockProvider,
					mockApiConfig,
					undefined,
					false,
					false,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
				)
			}).toThrow("Either historyItem or task/images must be provided")
		})
	})

	describe("getEnvironmentDetails", () => {
		let originalDate: DateConstructor
		let mockDate: Date

		beforeEach(() => {
			originalDate = global.Date
			const fixedTime = new Date("2024-01-01T12:00:00Z")
			mockDate = new Date(fixedTime)
			mockDate.getTimezoneOffset = jest.fn().mockReturnValue(420) // UTC-7

			class MockDate extends Date {
				constructor() {
					super()
					return mockDate
				}
				static override now() {
					return mockDate.getTime()
				}
			}

			global.Date = MockDate as DateConstructor

			// Create a proper mock of Intl.DateTimeFormat
			const mockDateTimeFormat = {
				resolvedOptions: () => ({
					timeZone: "America/Los_Angeles",
				}),
				format: () => "1/1/2024, 5:00:00 AM",
			}

			const MockDateTimeFormat = function (this: any) {
				return mockDateTimeFormat
			} as any

			MockDateTimeFormat.prototype = mockDateTimeFormat
			MockDateTimeFormat.supportedLocalesOf = jest.fn().mockReturnValue(["en-US"])

			global.Intl.DateTimeFormat = MockDateTimeFormat
		})

		afterEach(() => {
			global.Date = originalDate
		})

		it("should include timezone information in environment details", async () => {
			const coolcline = new CoolCline(
				mockProvider,
				mockApiConfig,
				undefined,
				false,
				false,
				undefined,
				"test task",
				undefined,
				undefined,
				undefined,
			)

			const details = await coolcline["getEnvironmentDetails"](false)

			// Verify timezone information is present and formatted correctly
			expect(details).toContain("America/Los_Angeles")
			expect(details).toMatch(/UTC-7:00/) // Fixed offset for America/Los_Angeles
			expect(details).toContain("# Current Time")
			expect(details).toMatch(/1\/1\/2024.*5:00:00 AM.*\(America\/Los_Angeles, UTC-7:00\)/) // Full time string format
		})

		describe("API conversation handling", () => {
			it("should clean conversation history before sending to API", async () => {
				const coolcline = new CoolCline(
					mockProvider,
					mockApiConfig,
					undefined,
					false,
					false,
					undefined,
					"test task",
					undefined,
					undefined,
					undefined,
				)

				// Mock the API's createMessage method to capture the conversation history
				const createMessageSpy = jest.fn()
				// Set up mock stream
				const mockStreamForClean = (async function* () {
					yield { type: "text", text: "test response" }
				})()

				// Set up spy
				const cleanMessageSpy = jest.fn().mockReturnValue(mockStreamForClean)
				jest.spyOn(coolcline.api, "createMessage").mockImplementation(cleanMessageSpy)

				// Mock getEnvironmentDetails to return empty details
				jest.spyOn(coolcline as any, "getEnvironmentDetails").mockResolvedValue("")

				// Mock loadContext to return unmodified content
				jest.spyOn(coolcline as any, "loadContext").mockImplementation(async (content) => [content, ""])

				// Add test message to conversation history
				coolcline.apiConversationHistory = [
					{
						role: "user" as const,
						content: [{ type: "text" as const, text: "test message" }],
						ts: Date.now(),
					},
				]

				// Mock abort state
				Object.defineProperty(coolcline, "abort", {
					get: () => false,
					configurable: true,
				})

				// Add a message with extra properties to the conversation history
				const messageWithExtra = {
					role: "user" as const,
					content: [{ type: "text" as const, text: "test message" }],
					ts: Date.now(),
					extraProp: "should be removed",
				}
				coolcline.apiConversationHistory = [messageWithExtra]

				// Trigger an API request
				await coolcline.recursivelyMakeCoolClineRequests([{ type: "text", text: "test request" }], false)

				// Get the conversation history from the first API call
				const history = cleanMessageSpy.mock.calls[0][1]
				expect(history).toBeDefined()
				expect(history.length).toBeGreaterThan(0)

				// Find our test message
				const cleanedMessage = history.find((msg: { content?: Array<{ text: string }> }) =>
					msg.content?.some((content) => content.text === "test message"),
				)
				expect(cleanedMessage).toBeDefined()
				expect(cleanedMessage).toEqual({
					role: "user",
					content: [{ type: "text", text: "test message" }],
				})

				// Verify extra properties were removed
				expect(Object.keys(cleanedMessage!)).toEqual(["role", "content"])
			})

			it("should handle image blocks based on model capabilities", async () => {
				// Create two configurations - one with image support, one without
				const configWithImages = {
					...mockApiConfig,
					apiModelId: "claude-3-sonnet",
				}
				const configWithoutImages = {
					...mockApiConfig,
					apiModelId: "gpt-3.5-turbo",
				}

				// Create test conversation history with mixed content
				const conversationHistory: (Anthropic.MessageParam & { ts?: number })[] = [
					{
						role: "user" as const,
						content: [
							{
								type: "text" as const,
								text: "Here is an image",
							} satisfies Anthropic.TextBlockParam,
							{
								type: "image" as const,
								source: {
									type: "base64" as const,
									media_type: "image/jpeg",
									data: "base64data",
								},
							} satisfies Anthropic.ImageBlockParam,
						],
					},
					{
						role: "assistant" as const,
						content: [
							{
								type: "text" as const,
								text: "I see the image",
							} satisfies Anthropic.TextBlockParam,
						],
					},
				]

				// Test with model that supports images
				const coolclineWithImages = new CoolCline(
					mockProvider,
					configWithImages,
					undefined,
					false,
					false,
					undefined,
					"test task",
					undefined,
					undefined,
					undefined,
				)

				// Mock the model info to indicate image support
				jest.spyOn(coolclineWithImages.api, "getModel").mockReturnValue({
					id: "claude-3-sonnet",
					info: {
						supportsImages: true,
						supportsPromptCache: true,
						supportsComputerUse: true,
						contextWindow: 200000,
						maxTokens: 4096,
						inputPrice: 0.25,
						outputPrice: 0.75,
					} as ModelInfo,
				})
				coolclineWithImages.apiConversationHistory = conversationHistory

				// Test with model that doesn't support images
				const coolclineWithoutImages = new CoolCline(
					mockProvider,
					configWithoutImages,
					undefined,
					false,
					false,
					undefined,
					"test task",
					undefined,
					undefined,
					undefined,
				)

				// Mock the model info to indicate no image support
				jest.spyOn(coolclineWithoutImages.api, "getModel").mockReturnValue({
					id: "gpt-3.5-turbo",
					info: {
						supportsImages: false,
						supportsPromptCache: false,
						supportsComputerUse: false,
						contextWindow: 16000,
						maxTokens: 2048,
						inputPrice: 0.1,
						outputPrice: 0.2,
					} as ModelInfo,
				})
				coolclineWithoutImages.apiConversationHistory = conversationHistory

				// Mock abort state for both instances
				Object.defineProperty(coolclineWithImages, "abort", {
					get: () => false,
					configurable: true,
				})
				Object.defineProperty(coolclineWithoutImages, "abort", {
					get: () => false,
					configurable: true,
				})

				// Mock environment details and context loading
				jest.spyOn(coolclineWithImages as any, "getEnvironmentDetails").mockResolvedValue("")
				jest.spyOn(coolclineWithoutImages as any, "getEnvironmentDetails").mockResolvedValue("")
				jest.spyOn(coolclineWithImages as any, "loadContext").mockImplementation(async (content) => [
					content,
					"",
				])
				jest.spyOn(coolclineWithoutImages as any, "loadContext").mockImplementation(async (content) => [
					content,
					"",
				])

				// Set up mock streams
				const mockStreamWithImages = (async function* () {
					yield { type: "text", text: "test response" }
				})()

				const mockStreamWithoutImages = (async function* () {
					yield { type: "text", text: "test response" }
				})()

				// Set up spies
				const imagesSpy = jest.fn().mockReturnValue(mockStreamWithImages)
				const noImagesSpy = jest.fn().mockReturnValue(mockStreamWithoutImages)

				jest.spyOn(coolclineWithImages.api, "createMessage").mockImplementation(imagesSpy)
				jest.spyOn(coolclineWithoutImages.api, "createMessage").mockImplementation(noImagesSpy)

				// Trigger API requests
				await coolclineWithImages.recursivelyMakeCoolClineRequests(
					[{ type: "text", text: "test request" }],
					false,
				)
				await coolclineWithoutImages.recursivelyMakeCoolClineRequests(
					[{ type: "text", text: "test request" }],
					false,
				)

				// Get the calls
				const imagesCalls = imagesSpy.mock.calls
				const noImagesCalls = noImagesSpy.mock.calls

				// Verify model with image support preserves image blocks
				expect(imagesCalls[0][1][0].content).toHaveLength(2)
				expect(imagesCalls[0][1][0].content[0]).toEqual({ type: "text", text: "Here is an image" })
				expect(imagesCalls[0][1][0].content[1]).toHaveProperty("type", "image")

				// Verify model without image support converts image blocks to text
				expect(noImagesCalls[0][1][0].content).toHaveLength(2)
				expect(noImagesCalls[0][1][0].content[0]).toEqual({ type: "text", text: "Here is an image" })
				expect(noImagesCalls[0][1][0].content[1]).toEqual({
					type: "text",
					text: "[Referenced image in conversation]",
				})
			})

			it("should handle API retry with countdown", async () => {
				const coolcline = new CoolCline(
					mockProvider,
					mockApiConfig,
					undefined,
					false,
					false,
					undefined,
					"test task",
					undefined,
					undefined,
					undefined,
				)

				// Mock API conversation history
				coolcline.apiConversationHistory = [
					{
						role: "user",
						content: [{ type: "text", text: "test message" }],
					},
				]

				// Mock delay to track countdown timing
				const mockDelay = jest.fn()
				jest.spyOn(global, "setTimeout").mockImplementation((cb: any) => {
					mockDelay()
					cb()
					return undefined as any
				})

				// Mock the API request to simulate a failure
				const mockApiReqInfo = {
					request: "test request",
					tokensIn: 100,
					tokensOut: 50,
					cacheWrites: 0,
					cacheReads: 0,
				}

				// Mock coolclineMessages with a previous API request
				coolcline.coolclineMessages = [
					{
						ts: Date.now(),
						type: "say",
						say: "api_req_started",
						text: JSON.stringify(mockApiReqInfo),
					},
				]

				// Mock createMessage to simulate failure then success
				const mockStream = {
					async *[Symbol.asyncIterator]() {
						yield { type: "text" as const, text: "test response" }
					},
					async next() {
						return { done: true, value: { type: "text" as const, text: "test response" } }
					},
					async return() {
						return { done: true, value: undefined }
					},
					async throw(e: any) {
						throw e
					},
					async [Symbol.asyncDispose]() {
						// Cleanup
					},
				} as AsyncGenerator<ApiStreamChunk>

				jest.spyOn(coolcline.api, "createMessage").mockImplementation(() => mockStream)

				// Attempt API request with retry
				const generator = coolcline["attemptApiRequest"](0, 1)
				await generator.next()

				expect(mockDelay).toHaveBeenCalled()
			})

			describe("loadContext", () => {
				it("should process mentions in task and feedback tags", async () => {
					const coolcline = new CoolCline(
						mockProvider,
						mockApiConfig,
						undefined,
						false,
						false,
						undefined,
						"test task",
						undefined,
						undefined,
						undefined,
					)

					// Mock parseMentions to track calls
					const mockParseMentions = jest.fn().mockImplementation((text) => `processed: ${text}`)
					jest.spyOn(require("../../core/mentions"), "parseMentions").mockImplementation(mockParseMentions)

					const userContent = [
						{
							type: "text",
							text: "Regular text with @/some/path",
						} as const,
						{
							type: "text",
							text: "<task>Text with @/some/path in task tags</task>",
						} as const,
						{
							type: "tool_result",
							tool_use_id: "test-id",
							content: [
								{
									type: "text",
									text: "<feedback>Check @/some/path</feedback>",
								},
							],
						} as Anthropic.ToolResultBlockParam,
						{
							type: "tool_result",
							tool_use_id: "test-id-2",
							content: [
								{
									type: "text",
									text: "Regular tool result with @/path",
								},
							],
						} as Anthropic.ToolResultBlockParam,
					]

					// Process the content
					const [processedContent] = await coolcline["loadContext"](userContent)

					// Regular text should not be processed
					expect((processedContent[0] as Anthropic.TextBlockParam).text).toBe("Regular text with @/some/path")

					// Text within task tags should be processed
					expect((processedContent[1] as Anthropic.TextBlockParam).text).toContain("processed:")
					expect(mockParseMentions).toHaveBeenCalledWith(
						"<task>Text with @/some/path in task tags</task>",
						expect.any(String),
						expect.any(Object),
					)

					// Feedback tag content should be processed
					const toolResult1 = processedContent[2] as Anthropic.ToolResultBlockParam
					const content1 = Array.isArray(toolResult1.content) ? toolResult1.content[0] : toolResult1.content
					expect((content1 as Anthropic.TextBlockParam).text).toContain("processed:")
					expect(mockParseMentions).toHaveBeenCalledWith(
						"<feedback>Check @/some/path</feedback>",
						expect.any(String),
						expect.any(Object),
					)

					// Regular tool result should not be processed
					const toolResult2 = processedContent[3] as Anthropic.ToolResultBlockParam
					const content2 = Array.isArray(toolResult2.content) ? toolResult2.content[0] : toolResult2.content
					expect((content2 as Anthropic.TextBlockParam).text).toBe("Regular tool result with @/path")
				})
			})
		})
	})
})
