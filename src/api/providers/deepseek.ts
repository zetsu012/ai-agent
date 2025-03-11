import { OpenAiHandler } from "./openai"
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { deepSeekModels, deepSeekDefaultModelId } from "../../shared/api"
import { DEEP_SEEK_DEFAULT_TEMPERATURE } from "./constants"

export class DeepSeekHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "deepseek-api-key-not-configured",
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
			modelTemperature: options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
		})
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId
		return {
			id: modelId,
			info: deepSeekModels[modelId as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId],
		}
	}
}
