import { Anthropic } from "@anthropic-ai/sdk"
import axios from "axios"
import OpenAI from "openai"
import { ApiHandler, SingleCompletionHandler } from "../"
import { ApiHandlerOptions, ModelInfo, glamaDefaultModelId, glamaDefaultModelInfo } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import delay from "delay"
import { GLAMA_DEFAULT_TEMPERATURE } from "./constants"

export class GlamaHandler implements ApiHandler, SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		const baseURL = "https://glama.ai/api/gateway/openai/v1"
		const apiKey = this.options.glamaApiKey ?? "glama-api-key-not-configured"
		this.client = new OpenAI({ baseURL, apiKey })
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// Convert Anthropic messages to OpenAI format
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// this is specifically for claude models (some models may 'support prompt caching' automatically without this)
		if (this.getModel().id.startsWith("anthropic/claude-3")) {
			openAiMessages[0] = {
				role: "system",
				content: [
					{
						type: "text",
						text: systemPrompt,
						// @ts-ignore-next-line
						cache_control: { type: "ephemeral" },
					},
				],
			}

			// Add cache_control to the last two user messages
			// (note: this works because we only ever add one user message at a time,
			// but if we added multiple we'd need to mark the user message before the last assistant message)
			const lastTwoUserMessages = openAiMessages.filter((msg) => msg.role === "user").slice(-2)
			lastTwoUserMessages.forEach((msg) => {
				if (typeof msg.content === "string") {
					msg.content = [{ type: "text", text: msg.content }]
				}
				if (Array.isArray(msg.content)) {
					// NOTE: this is fine since env details will always be added at the end.
					// but if it weren't there, and the user added a image_url type message,
					// it would pop a text part before it and then move it after to the end.
					let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

					if (!lastTextPart) {
						lastTextPart = { type: "text", text: "..." }
						msg.content.push(lastTextPart)
					}
					// @ts-ignore-next-line
					lastTextPart["cache_control"] = { type: "ephemeral" }
				}
			})
		}

		// Required by Anthropic
		// Other providers default to max tokens allowed.
		let maxTokens: number | undefined

		if (this.getModel().id.startsWith("anthropic/")) {
			if (this.getModel().id.includes("claude-3-7")) {
				maxTokens = 128_000
			} else {
				maxTokens = 8192
			}
		}

		const requestOptions: OpenAI.Chat.ChatCompletionCreateParams = {
			model: this.getModel().id,
			max_tokens: maxTokens,
			messages: openAiMessages,
			stream: true,
		}

		if (this.supportsTemperature()) {
			requestOptions.temperature = this.options.modelTemperature ?? GLAMA_DEFAULT_TEMPERATURE
		}

		const { data: completion, response } = await this.client.chat.completions
			.create(requestOptions, {
				headers: {
					"X-Glama-Metadata": JSON.stringify({
						labels: [
							{
								key: "app",
								// ${publisher}.${name}，${publisher} 是发布者，${name} 是扩展名，注意是要用 package.json 中的 publisher 和 name，区分大小写
								value: "vscode.CoolCline.coolcline",
							},
						],
					}),
				},
			})
			.withResponse()

		const completionRequestId = response.headers.get("x-completion-request-id")

		for await (const chunk of completion) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}
		}

		try {
			let attempt = 0

			const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

			while (attempt++ < 10) {
				// In case of an interrupted request, we need to wait for the upstream API to finish processing the request
				// before we can fetch information about the token usage and cost.
				const response = await axios.get(
					`https://glama.ai/api/gateway/v1/completion-requests/${completionRequestId}`,
					{
						headers: {
							Authorization: `Bearer ${this.options.glamaApiKey}`,
						},
					},
				)

				const completionRequest = response.data

				if (completionRequest.tokenUsage && completionRequest.totalCostUsd) {
					yield {
						type: "usage",
						cacheWriteTokens: completionRequest.tokenUsage.cacheCreationInputTokens,
						cacheReadTokens: completionRequest.tokenUsage.cacheReadInputTokens,
						inputTokens: completionRequest.tokenUsage.promptTokens,
						outputTokens: completionRequest.tokenUsage.completionTokens,
						totalCost: parseFloat(completionRequest.totalCostUsd),
					}

					break
				}

				await delay(200)
			}
		} catch (error) {
			console.error("Error fetching Glama completion details", error)
		}
	}

	private supportsTemperature(): boolean {
		return !this.getModel().id.startsWith("openai/o3-mini")
	}

	getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.glamaModelId
		const modelInfo = this.options.glamaModelInfo

		if (modelId && modelInfo) {
			return { id: modelId, info: modelInfo }
		}

		return { id: glamaDefaultModelId, info: glamaDefaultModelInfo }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
			}

			if (this.supportsTemperature()) {
				requestOptions.temperature = this.options.modelTemperature ?? GLAMA_DEFAULT_TEMPERATURE
			}

			if (this.getModel().id.startsWith("anthropic/")) {
				if (this.getModel().id.includes("claude-3-7")) {
					requestOptions.max_tokens = 128_000
				} else {
					requestOptions.max_tokens = 8192
				}
			}

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Glama completion error: ${error.message}`)
			}
			throw error
		}
	}
}
