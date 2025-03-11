import { OllamaHandler } from "../ollama"
import { ApiHandlerOptions } from "../../../shared/api"
import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"
import { DEEP_SEEK_DEFAULT_TEMPERATURE, OLLAMA_DEFAULT_TEMPERATURE } from "../constants"

// Mock OpenAI client
const mockCreate = jest.fn()
jest.mock("openai", () => {
	return {
		__esModule: true,
		default: jest.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate.mockImplementation(async (options) => {
						if (!options.stream) {
							return {
								id: "test-completion",
								choices: [
									{
										message: { role: "assistant", content: "Test response" },
										finish_reason: "stop",
										index: 0,
									},
								],
								usage: {
									prompt_tokens: 10,
									completion_tokens: 5,
									total_tokens: 15,
								},
							}
						}

						return {
							[Symbol.asyncIterator]: async function* () {
								yield {
									choices: [
										{
											delta: { content: "Test response" },
											index: 0,
										},
									],
									usage: null,
								}
								yield {
									choices: [
										{
											delta: {},
											index: 0,
										},
									],
									usage: {
										prompt_tokens: 10,
										completion_tokens: 5,
										total_tokens: 15,
									},
								}
							},
						}
					}),
				},
			},
		})),
	}
})

describe("OllamaHandler", () => {
	let handler: OllamaHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiModelId: "llama2",
			ollamaModelId: "llama2",
			ollamaBaseUrl: "http://localhost:11434/v1",
		}
		handler = new OllamaHandler(mockOptions)
		mockCreate.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(OllamaHandler)
			expect(handler.getModel().id).toBe(mockOptions.ollamaModelId)
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutUrl = new OllamaHandler({
				apiModelId: "llama2",
				ollamaModelId: "llama2",
			})
			expect(handlerWithoutUrl).toBeInstanceOf(OllamaHandler)
		})
	})

	describe("model identification", () => {
		const testCases = [
			// 标准 R1 模型名称
			{ modelId: "deepseek-r1", expected: true },
			{ modelId: "deepseek_r1", expected: true },
			{ modelId: "deepseekr1", expected: true },
			// 带版本号和后缀的 R1 模型
			{ modelId: "deepseek-r1-7b", expected: true },
			{ modelId: "deepseek-r1-13b-chat", expected: true },
			{ modelId: "deepseek-r1-v1.0", expected: true },
			{ modelId: "deepseek-r1-instruct", expected: true },
			// 自定义命名的 R1 模型
			{ modelId: "my-deepseek-r1-model", expected: true },
			{ modelId: "custom_deepseek_r1_v2", expected: true },
			{ modelId: "local-deepseekr1-test", expected: true },
			// 大小写变体
			{ modelId: "DeepSeek-R1", expected: true },
			{ modelId: "DEEPSEEK_R1", expected: true },
			{ modelId: "DeepSeekR1", expected: true },
			// 非 R1 模型
			{ modelId: "llama2", expected: false },
			{ modelId: "mistral", expected: false },
			{ modelId: "deepseek-coder", expected: false },
			{ modelId: "deepseek-chat", expected: false },
			{ modelId: "deepseek-reasoner", expected: false },
			// 边界情况
			{ modelId: "deepseek-r12", expected: false }, // 避免误匹配数字后缀
			{ modelId: "deepseek-r1n", expected: false }, // 避免误匹配字母后缀
			{ modelId: "fake-r1-model", expected: false }, // 不包含完整关键字
		]

		testCases.forEach(({ modelId, expected }) => {
			it(`should ${expected ? "identify" : "not identify"} "${modelId}" as R1 model`, async () => {
				const testHandler = new OllamaHandler({
					...mockOptions,
					ollamaModelId: modelId,
				})
				const stream = testHandler.createMessage("test", [])
				const chunks: any[] = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
				expect(mockCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						temperature: expected ? DEEP_SEEK_DEFAULT_TEMPERATURE : OLLAMA_DEFAULT_TEMPERATURE,
					}),
				)
			})
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello!",
					},
				],
			},
		]

		it("should handle streaming responses for regular models", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: OLLAMA_DEFAULT_TEMPERATURE,
				}),
			)
		})

		it("should handle streaming responses for R1 models", async () => {
			const r1Handler = new OllamaHandler({
				...mockOptions,
				ollamaModelId: "deepseek-r1",
			})
			const stream = r1Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: DEEP_SEEK_DEFAULT_TEMPERATURE,
				}),
			)
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("API Error")
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully for regular models", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: mockOptions.ollamaModelId,
				messages: [{ role: "user", content: "Test prompt" }],
				temperature: OLLAMA_DEFAULT_TEMPERATURE,
				top_p: undefined,
				stream: false,
			})
		})

		it("should complete prompt successfully for R1 models", async () => {
			const mockClient = {
				chat: {
					completions: {
						create: jest.fn().mockResolvedValue({
							choices: [{ message: { content: "Test response" } }],
						}),
					},
				},
			}
			// @ts-ignore - 为了测试目的忽略类型检查
			const r1Handler = new OllamaHandler({
				ollamaBaseUrl: "http://localhost:11434",
				ollamaModelId: "deepseek-r1", // 改用真正的 R1 模型进行测试
			})
			// @ts-ignore - 为了测试目的覆盖私有属性
			r1Handler.client = mockClient
			const result = await r1Handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
				model: "deepseek-r1",
				messages: expect.any(Array),
				stream: false,
				temperature: DEEP_SEEK_DEFAULT_TEMPERATURE,
			})
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Ollama completion error: API Error")
		})

		it("should handle empty response", async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [{ message: { content: "" } }],
			})
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(mockOptions.ollamaModelId)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(-1)
			expect(modelInfo.info.contextWindow).toBe(128_000)
		})
	})
})
