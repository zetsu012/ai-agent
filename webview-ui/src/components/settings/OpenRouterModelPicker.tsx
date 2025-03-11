import React, { useCallback, useMemo, useState } from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import debounce from "debounce"
import { openRouterDefaultModelId } from "../../../../src/shared/api"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import SearchModelPicker from "../SearchModelPicker"
import { ModelInfo as SearchModelInfo } from "../SearchModelPicker/types"
import { ModelInfo as OpenRouterModelInfo } from "../../../../src/shared/api"
import { ModelInfoView } from "../SearchModelPicker/ModelInfoView"

/**
 * 将 provider 特定的模型信息转换为通用的 SearchModelInfo 格式
 *
 * @param models - provider 特定的模型信息映射
 * @returns 标准化的模型信息映射
 *
 * 注意：
 * 1. 确保所有必需字段都被正确映射
 * 2. 可选字段使用条件展开运算符添加
 * 3. 为了保持一致性，使用模型 ID 作为 name 和 displayName 的默认值
 */
const convertModelInfo = (models: Record<string, OpenRouterModelInfo>): Record<string, SearchModelInfo> => {
	const result = Object.entries(models).reduce(
		(acc, [id, info]) => {
			acc[id] = {
				// 基本信息
				id, // 模型唯一标识符
				name: id, // 模型名称，默认使用 ID
				displayName: id, // 显示名称，默认使用 ID
				description: info.description, // 模型描述

				// 容量限制
				contextWindow: info.contextWindow,
				maxTokens: info.maxTokens,

				// 功能支持
				supportsImages: info.supportsImages ?? false,
				supportsComputerUse: info.supportsComputerUse ?? false,
				supportsPromptCache: info.supportsPromptCache ?? false,

				// 价格信息
				pricing: {
					prompt: info.inputPrice,
					completion: info.outputPrice,
					...(info.cacheWritesPrice !== undefined && { cacheWrites: info.cacheWritesPrice }),
					...(info.cacheReadsPrice !== undefined && { cacheReads: info.cacheReadsPrice }),
				},

				// 其他信息
				reasoningEffort: info.reasoningEffort,
				modelUrl: "https://openrouter.ai/models", // provider 特定的模型详情页
			}
			return acc
		},
		{} as Record<string, SearchModelInfo>,
	)
	return result
}

/**
 * OpenRouter 模型选择器组件
 *
 * 使用通用的 SearchModelPicker 组件来实现模型选择功能。
 * 主要职责：
 * 1. 转换模型数据格式
 * 2. 处理模型选择事件
 * 3. 管理模型描述的展开状态
 * 4. 提供模型刷新功能
 */
const OpenRouterModelPicker: React.FC = () => {
	const { apiConfiguration, setApiConfiguration, openRouterModels, onUpdateApiConfig } = useExtensionState()
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

	/**
	 * 刷新模型列表
	 * 使用 debounce 防止频繁刷新
	 */
	const refreshModels = useCallback(
		debounce(() => {
			vscode.postMessage({ type: "refreshOpenRouterModels" })
		}, 50),
		[],
	)

	/**
	 * 处理模型选择变更
	 * 1. 更新本地配置
	 * 2. 通知外部配置更新
	 */
	const handleModelChange = useCallback(
		(modelId: string) => {
			if (openRouterModels[modelId]) {
				const apiConfig = {
					...apiConfiguration,
					openRouterModelId: modelId,
					openRouterModelInfo: openRouterModels[modelId],
				}
				setApiConfiguration(apiConfig)
				setTimeout(() => {
					onUpdateApiConfig(apiConfig)
				}, 0)
			}
		},
		[apiConfiguration, openRouterModels, setApiConfiguration, onUpdateApiConfig],
	)

	/**
	 * 自定义模型信息展示
	 * 使用 ModelInfoView 组件统一展示模型详细信息
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
	const convertedModels = useMemo(() => convertModelInfo(openRouterModels), [openRouterModels])

	return (
		<SearchModelPicker
			// 基础配置
			value={apiConfiguration?.openRouterModelId || openRouterDefaultModelId}
			onValueChange={handleModelChange}
			models={convertedModels}
			defaultModelId={openRouterDefaultModelId}
			// UI 配置
			label="Model"
			placeholder="Search and select a model..."
			// 功能配置
			onRefreshModels={refreshModels}
			autoRefresh={true}
			customModelInfo={customModelInfo}
			showModelInfo={true}
			// 搜索配置
			searchFields={["id", "name", "description"]}
		/>
	)
}

export default OpenRouterModelPicker
