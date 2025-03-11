import { ModelInfo } from "../components/SearchModelPicker/types"

export class ModelService {
	private baseUrl: string

	constructor(baseUrl: string = "/api") {
		this.baseUrl = baseUrl
	}

	/**
	 * 获取所有可用的模型信息
	 * 这个方法会从后端获取已经整合好的模型信息
	 */
	async getAllModels(): Promise<ModelInfo[]> {
		try {
			const response = await fetch(`${this.baseUrl}/models`)

			if (!response.ok) {
				throw new Error(`Failed to fetch models: ${response.statusText}`)
			}

			const data = await response.json()
			return data.models
		} catch (error) {
			console.error("Failed to fetch models:", error)
			return []
		}
	}

	/**
	 * 获取指定模型的详细信息
	 */
	async getModelInfo(modelId: string): Promise<ModelInfo | null> {
		try {
			const response = await fetch(`${this.baseUrl}/models/${modelId}`)

			if (!response.ok) {
				throw new Error(`Failed to fetch model info: ${response.statusText}`)
			}

			const data = await response.json()
			return data.model
		} catch (error) {
			console.error(`Failed to fetch model info for ${modelId}:`, error)
			return null
		}
	}

	/**
	 * 刷新模型缓存
	 * 这个方法会触发后端重新从各个提供商获取最新的模型信息
	 */
	async refreshModels(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/models/refresh`, {
				method: "POST",
			})

			return response.ok
		} catch (error) {
			console.error("Failed to refresh models:", error)
			return false
		}
	}
}
