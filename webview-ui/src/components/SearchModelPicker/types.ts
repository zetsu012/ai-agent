export interface ModelInfo {
	id: string
	name: string
	description?: string
	displayName?: string
	contextWindow?: number
	maxTokens?: number
	supportsImages: boolean
	supportsComputerUse: boolean
	supportsPromptCache: boolean
	pricing?: {
		prompt?: number
		completion?: number
		cacheWritesPrice?: number
		cacheReadsPrice?: number
	}
	reasoningEffort?: "low" | "medium" | "high"
	modelUrl?: string
	[key: string]: any
}

export interface OpenRouterModelInfo {
	id: string
	name: string
	description?: string
	context_length: number
	architecture: {
		modality: string
		tokenizer: string
		instruct_type: string | null
	}
	pricing: {
		prompt: string
		completion: string
		image: string
		request: string
	}
	top_provider: {
		context_length: number | null
		max_completion_tokens: number | null
		is_moderated: boolean
	}
}

export interface RequestyModelInfo {
	id: string
	object: string
	created: number
	owned_by: string
	input_price: number
	caching_price: number
	cached_price: number
	output_price: number
	max_output_tokens: number
	context_window: number
	supports_caching: boolean
	description: string
}

export interface SearchModelPickerProps {
	// 基础配置
	value: string
	onValueChange: (value: string) => void
	// 数据源配置
	models: Record<string, ModelInfo>
	defaultModelId?: string
	// 展示配置
	label?: string
	placeholder?: string
	disabled?: boolean
	// 搜索配置
	searchFields?: string[] // 指定要搜索的字段，默认 ['id', 'name']
	// 刷新配置
	onRefreshModels?: () => void
	autoRefresh?: boolean // 是否自动刷新
	// 展示配置
	showModelInfo?: boolean // 是否显示模型信息
	customModelInfo?: (model: ModelInfo) => React.ReactNode // 自定义模型信息展示
	// 样式配置
	maxDropdownHeight?: number
	className?: string
	style?: React.CSSProperties
	// 空结果配置
	emptyMessage?: string
	// API 配置
	onUpdateConfig?: (config: any) => void
}

export interface SearchableModel extends ModelInfo {
	searchText: string // 用于搜索的文本
	displayHtml: string // 用于显示的 HTML
}

// 将 OpenRouter 模型信息转换为统一格式
export function convertOpenRouterModel(model: OpenRouterModelInfo): ModelInfo {
	return {
		id: model.id,
		name: model.name,
		description: model.description,
		contextWindow: model.context_length,
		maxTokens: model.top_provider.max_completion_tokens || undefined,

		// 根据 architecture 判断功能支持
		supportsImages: model.architecture.modality.includes("image"),
		supportsComputerUse: true, // OpenRouter 默认支持
		supportsPromptCache: false, // OpenRouter 目前不支持

		pricing: {
			prompt: model.pricing.prompt === "-1" ? undefined : parseFloat(model.pricing.prompt),
			completion: model.pricing.completion === "-1" ? undefined : parseFloat(model.pricing.completion),
		},

		modelUrl: `https://openrouter.ai/models/${model.id}`,
	}
}

// 将 Requesty 模型信息转换为统一格式
export function convertRequestyModel(model: RequestyModelInfo): ModelInfo {
	return {
		id: model.id,
		name: model.id, // 使用 id 作为名称
		description: model.description,
		contextWindow: model.context_window,
		maxTokens: model.max_output_tokens,

		// 功能支持
		supportsImages: false, // 暂未提供这个字段
		supportsComputerUse: false, // 暂未提供这个字段
		supportsPromptCache: model.supports_caching,

		pricing: {
			prompt: model.input_price * 1_000_000, // 转换为每百万 token 的价格
			completion: model.output_price * 1_000_000,
			cacheWritesPrice: model.caching_price * 1_000_000,
			cacheReadsPrice: model.cached_price * 1_000_000,
		},

		modelUrl: `https://router.requesty.ai/v1/models`,
	}
}
