import { MistralHandler } from "../mistral"
import { ApiHandlerOptions } from "../../../shared/api"
import { Mistral } from "@mistralai/mistralai"

// Mock Mistral client
const mockStreamCreate = jest.fn()
jest.mock("@mistralai/mistralai", () => {
	return {
		Mistral: jest.fn().mockImplementation(() => ({
			chat: {
				stream: mockStreamCreate.mockImplementation(async () => ({
					async *[Symbol.asyncIterator]() {
						yield {
							data: {
								choices: [
									{
										delta: {
											content: "Test response",
										},
									},
								],
								usage: {
									promptTokens: 10,
									completionTokens: 5,
								},
							},
						}
					},
				})),
			},
		})),
	}
})

describe("MistralHandler", () => {
	let handler: MistralHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			mistralApiKey: "test-api-key",
			apiModelId: "codestral-latest",
		}
		handler = new MistralHandler(mockOptions)
		mockStreamCreate.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(MistralHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should use default API key if not provided", () => {
			const handlerWithoutKey = new MistralHandler({
				...mockOptions,
				mistralApiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(MistralHandler)
			expect(Mistral).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "mistral-api-key-not-configured",
				}),
			)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages = [
			{
				role: "user" as const,
				content: "Hello!",
			},
		]

		it("should handle streaming responses", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})
	})

	describe("getModel", () => {
		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new MistralHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBeDefined()
			expect(model.info).toBeDefined()
		})

		it("should return specified model if valid model ID is provided", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
		})
	})
})
