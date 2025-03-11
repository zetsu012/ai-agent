import React, { useCallback, useMemo, useState } from "react"
import debounce from "debounce"
import { requestyDefaultModelId, ModelInfo } from "../../../../src/shared/api"
import { useExtensionState } from "../../context/ExtensionStateContext"
import SearchModelPicker from "../SearchModelPicker"
import { ModelInfo as SearchModelInfo } from "../SearchModelPicker/types"
import { ModelInfoView } from "../SearchModelPicker/ModelInfoView"
import { vscode } from "../../utils/vscode"

/**
 * 将 Requesty 特定的模型信息转换为通用的 SearchModelInfo 格式
 */
const convertModelInfo = (models: Record<string, ModelInfo> = {}): Record<string, SearchModelInfo> => {
	return Object.entries(models).reduce(
		(acc, [id, info]) => {
			acc[id] = {
				// 基本信息
				id,
				name: id,
				displayName: id,
				description: info.description,

				// 容量限制
				contextWindow: info.contextWindow,
				maxTokens: info.maxTokens,

				// 功能支持
				supportsImages: info.supportsImages ?? false,
				supportsComputerUse: info.supportsComputerUse ?? false,
				supportsPromptCache: info.supportsPromptCache,

				// 价格信息
				pricing: {
					prompt: info.inputPrice,
					completion: info.outputPrice,
					cacheWritesPrice: info.cacheWritesPrice,
					cacheReadsPrice: info.cacheReadsPrice,
				},

				// 其他信息
				reasoningEffort: info.reasoningEffort,
				modelUrl: "https://router.requesty.ai/v1/models",
			}
			return acc
		},
		{} as Record<string, SearchModelInfo>,
	)
}

/**
 * Requesty 模型选择器组件
 */
const RequestyModelPicker: React.FC = () => {
	const { apiConfiguration, setApiConfiguration, requestyModels = {}, onUpdateApiConfig } = useExtensionState()
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

	// 组件挂载时的日志
	React.useEffect(() => {
		// 移除不必要的日志
		return () => {}
	}, [])

	// 监控 requestyModels 的变化
	React.useEffect(() => {
		if (Object.keys(requestyModels).length === 0) {
			refreshModels()
		}
	}, [requestyModels])

	/**
	 * 刷新模型列表
	 */
	const refreshModels = useCallback(
		debounce(() => {
			vscode.postMessage({ type: "refreshRequestyModels" })
		}, 50),
		[],
	)

	/**
	 * 处理模型选择变更
	 */
	const handleModelChange = useCallback(
		(modelId: string) => {
			if (requestyModels[modelId]) {
				const apiConfig = {
					...apiConfiguration,
					requestyModelId: modelId,
					requestyModelInfo: requestyModels[modelId],
				}
				setApiConfiguration(apiConfig)
				setTimeout(() => {
					onUpdateApiConfig(apiConfig)
				}, 0)
			}
		},
		[apiConfiguration, requestyModels, setApiConfiguration, onUpdateApiConfig],
	)

	/**
	 * 自定义模型信息展示
	 */
	const customModelInfo = useCallback(
		(model: SearchModelInfo) => {
			if (!model) return null

			return (
				<ModelInfoView
					selectedModelId={model.id}
					modelInfo={model}
					isDescriptionExpanded={isDescriptionExpanded}
					setIsDescriptionExpanded={setIsDescriptionExpanded}
				/>
			)
		},
		[isDescriptionExpanded],
	)

	// 转换模型数据并缓存结果
	const convertedModels = useMemo(() => {
		return convertModelInfo(requestyModels)
	}, [requestyModels])

	return (
		<SearchModelPicker
			value={apiConfiguration?.requestyModelId || requestyDefaultModelId}
			onValueChange={handleModelChange}
			models={convertedModels}
			defaultModelId={requestyDefaultModelId}
			label="Model"
			placeholder="Search and select a model..."
			onRefreshModels={refreshModels}
			autoRefresh={true}
			customModelInfo={customModelInfo}
			showModelInfo={true}
			searchFields={["id", "name", "description"]}
		/>
	)
}

export default RequestyModelPicker
