import { Anthropic } from "@anthropic-ai/sdk"
import axios from "axios"
import { ModelInfo, requestyDefaultModel, requestyDefaultModelId } from "../../shared/api"
import { ApiHandler } from "../index"
import { ApiStream } from "../transform/stream"

export class RequestyHandler implements ApiHandler {
	private baseUrl: string = "https://router.requesty.ai/v1"
	private modelInfo: ModelInfo
	private modelId: string

	constructor(
		private apiKey: string,
		modelId?: string,
		modelInfo?: ModelInfo,
	) {
		this.modelId = modelId || requestyDefaultModelId
		this.modelInfo = modelInfo || requestyDefaultModel
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			// 尝试使用流式响应
			const response = await axios.post(
				`${this.baseUrl}/chat/completions`,
				{
					model: this.modelId,
					messages: [
						{ role: "system", content: systemPrompt },
						...messages.map((msg) => ({
							role: msg.role === "assistant" ? "assistant" : "user",
							content: msg.content,
						})),
					],
					stream: true,
				},
				{
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					responseType: "stream",
				},
			)

			let totalInputTokens = 0
			let totalOutputTokens = 0

			for await (const chunk of response.data) {
				const lines = chunk
					.toString()
					.split("\n")
					.filter((line: string) => line.trim() !== "")

				for (const line of lines) {
					const message = line.replace(/^data: /, "")
					if (message === "[DONE]") {
						break
					}

					try {
						const parsed = JSON.parse(message)
						if (parsed.choices?.[0]?.delta?.content) {
							yield {
								type: "text",
								text: parsed.choices[0].delta.content,
							}
						}
						if (parsed.usage) {
							totalInputTokens = parsed.usage.prompt_tokens || 0
							totalOutputTokens = parsed.usage.completion_tokens || 0
						}
					} catch (error) {
						console.error("Could not parse stream message", message, error)
					}
				}
			}

			yield {
				type: "usage",
				inputTokens: totalInputTokens,
				outputTokens: totalOutputTokens,
			}
		} catch (error) {
			// 如果流式响应失败，回退到非流式响应
			if (error.response?.status === 400 || error.response?.data?.error?.includes("streaming")) {
				const response = await axios.post(
					`${this.baseUrl}/chat/completions`,
					{
						model: this.modelId,
						messages: [
							{ role: "system", content: systemPrompt },
							...messages.map((msg) => ({
								role: msg.role === "assistant" ? "assistant" : "user",
								content: msg.content,
							})),
						],
					},
					{
						headers: {
							Authorization: `Bearer ${this.apiKey}`,
							"Content-Type": "application/json",
						},
					},
				)

				yield {
					type: "text",
					text: response.data.choices[0]?.message?.content || "",
				}

				yield {
					type: "usage",
					inputTokens: response.data.usage?.prompt_tokens || 0,
					outputTokens: response.data.usage?.completion_tokens || 0,
				}
			} else {
				throw error
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.modelId,
			info: this.modelInfo,
		}
	}

	async refreshModels(): Promise<Record<string, ModelInfo>> {
		const response = await axios.get(`${this.baseUrl}/models`, {
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
			},
		})

		return response.data.data.reduce((acc: Record<string, ModelInfo>, model: any) => {
			acc[model.id] = {
				contextWindow: model.context_length,
				maxTokens: model.max_tokens,
				inputPrice: model.pricing.prompt,
				outputPrice: model.pricing.completion,
				supportsImages: model.supports_images || false,
				supportsPromptCache: false,
				supportsComputerUse: true,
				description: model.description,
				reasoningEffort: "medium",
			}
			return acc
		}, {})
	}
}
