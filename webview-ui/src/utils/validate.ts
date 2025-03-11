import { ApiConfiguration, glamaDefaultModelId, openRouterDefaultModelId } from "../../../src/shared/api"
import { ModelInfo } from "../../../src/shared/api"
import i18next from "i18next"

export function validateApiConfiguration(apiConfiguration?: ApiConfiguration): string | undefined {
	if (apiConfiguration) {
		switch (apiConfiguration.llmProvider) {
			case "anthropic":
				if (!apiConfiguration.apiKey) {
					return i18next.t("common.validation.provideApiKey")
				}
				break
			case "glama":
				if (!apiConfiguration.glamaApiKey) {
					return i18next.t("common.validation.provideApiKey")
				}
				break
			case "bedrock":
				if (!apiConfiguration.awsRegion) {
					return i18next.t("common.validation.provideRegion")
				}
				break
			case "openrouter":
				if (!apiConfiguration.openRouterApiKey) {
					return i18next.t("common.validation.provideApiKey")
				}
				break
			case "vertex":
				if (!apiConfiguration.vertexProjectId || !apiConfiguration.vertexRegion) {
					return i18next.t("common.validation.provideProjectAndRegion")
				}
				break
			case "gemini":
				if (!apiConfiguration.geminiApiKey) {
					return i18next.t("common.validation.provideApiKey")
				}
				break
			case "openai-native":
				if (!apiConfiguration.openAiNativeApiKey) {
					return i18next.t("common.validation.provideApiKey")
				}
				break
			case "mistral":
				if (!apiConfiguration.mistralApiKey) {
					return i18next.t("common.validation.provideApiKey")
				}
				break
			case "requesty":
				if (!apiConfiguration.requestyApiKey) {
					return i18next.t("common.validation.provideApiKey")
				}
				break
			case "openai":
				if (
					!apiConfiguration.openAiBaseUrl ||
					!apiConfiguration.openAiApiKey ||
					!apiConfiguration.openAiModelId
				) {
					return i18next.t("common.validation.provideBaseUrlAndKey")
				}
				break
			case "ollama":
				if (!apiConfiguration.ollamaModelId) {
					return i18next.t("common.validation.provideModelId")
				}
				break
			case "lmstudio":
				if (!apiConfiguration.lmStudioModelId) {
					return i18next.t("common.validation.provideModelId")
				}
				break
			case "vscode-lm":
				if (!apiConfiguration.vsCodeLmModelSelector) {
					return i18next.t("common.validation.provideModelSelector")
				}
				break
		}
	}
	return undefined
}

export function validateModelId(
	apiConfiguration?: ApiConfiguration,
	glamaModels?: Record<string, ModelInfo>,
	openRouterModels?: Record<string, ModelInfo>,
): string | undefined {
	if (apiConfiguration) {
		switch (apiConfiguration.llmProvider) {
			case "glama":
				const glamaModelId = apiConfiguration.glamaModelId || glamaDefaultModelId // in case the user hasn't changed the model id, it will be undefined by default
				if (!glamaModelId) {
					return i18next.t("common.validation.provideModelId")
				}
				if (glamaModels && !Object.keys(glamaModels).includes(glamaModelId)) {
					// even if the model list endpoint failed, extensionstatecontext will always have the default model info
					return i18next.t("common.validation.modelNotAvailable")
				}
				break
			case "openrouter":
				const modelId = apiConfiguration.openRouterModelId || openRouterDefaultModelId // in case the user hasn't changed the model id, it will be undefined by default
				if (!modelId) {
					return i18next.t("common.validation.provideModelId")
				}
				if (openRouterModels && !Object.keys(openRouterModels).includes(modelId)) {
					// even if the model list endpoint failed, extensionstatecontext will always have the default model info
					return i18next.t("common.validation.modelNotAvailable")
				}
				break
		}
	}
	return undefined
}
