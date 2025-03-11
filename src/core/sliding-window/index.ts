import { Anthropic } from "@anthropic-ai/sdk"
import { ModelInfo } from "../../shared/api"

/**
 * 截断对话，通过移除一定比例的消息。
 *
 * 第一条消息始终保留，并且从开始（不包括第一条）移除指定比例（向下取整为偶数）
 * 的消息。
 *
 * @param {Anthropic.Messages.MessageParam[]} messages - 对话消息。
 * @param {number} fracToRemove - 要移除的消息比例（0到1之间）。
 * @returns {Anthropic.Messages.MessageParam[]} 截断后的对话消息。
 */
export function truncateConversation(
	messages: Anthropic.Messages.MessageParam[],
	fracToRemove: number,
): Anthropic.Messages.MessageParam[] {
	if (messages.length <= 1) return messages

	// 保留第一条消息
	const firstMessage = messages[0]
	const remainingMessages = messages.slice(1)

	// 计算要保留的消息对数量（每对包含一个用户消息和一个助手消息）
	const pairs = Math.floor(remainingMessages.length / 2)
	const pairsToKeep = Math.ceil(pairs * (1 - fracToRemove))
	const messagesToKeep = pairsToKeep * 2

	// 保留第一条消息和最后几对消息
	return [firstMessage, ...remainingMessages.slice(remainingMessages.length - messagesToKeep)]
}

/**
 * 根据总token数是否超过模型限制来有条件地截断对话消息。
 *
 * 根据模型是否支持prompt缓存，使用不同的最大token阈值和截断比例。
 * 如果当前总token数超过阈值，则使用适当的比例截断对话。
 *
 * @param {Anthropic.Messages.MessageParam[]} messages - 对话消息。
 * @param {number} totalTokens - 对话中的总token数。
 * @param {ModelInfo} modelInfo - 模型元数据，包括上下文窗口大小和prompt缓存支持。
 * @returns {Anthropic.Messages.MessageParam[]} 原始或截断后的对话消息。
 */
export function truncateConversationIfNeeded(
	messages: Anthropic.Messages.MessageParam[],
	totalTokens: number,
	modelInfo: ModelInfo,
): Anthropic.Messages.MessageParam[] {
	const maxTokens = modelInfo.supportsPromptCache
		? getMaxTokensForPromptCachingModels(modelInfo)
		: getMaxTokensForNonPromptCachingModels(modelInfo)

	// 如果总token数接近或超过最大值，进行截断
	if (totalTokens >= maxTokens * 0.95) {
		const truncFraction = modelInfo.supportsPromptCache
			? getTruncFractionForPromptCachingModels()
			: getTruncFractionForNonPromptCachingModels(modelInfo)

		return truncateConversation(messages, truncFraction)
	}

	return messages
}

/**
 * 计算支持prompt缓存的模型的最大允许token数。
 *
 * 最大值计算为(contextWindow - 40000)和contextWindow的80%中的较大值。
 *
 * @param {ModelInfo} modelInfo - 包含上下文窗口大小的模型信息。
 * @returns {number} prompt缓存模型允许的最大token数。
 */
function getMaxTokensForPromptCachingModels(modelInfo: ModelInfo): number {
	return Math.max(modelInfo.contextWindow - 40_000, modelInfo.contextWindow * 0.8)
}

/**
 * 提供支持prompt缓存的模型的消息截断比例。
 *
 * @returns {number} prompt缓存模型的截断比例（固定为0.5）。
 */
function getTruncFractionForPromptCachingModels(): number {
	return 0.5
}

/**
 * 计算不支持prompt缓存的模型的最大允许token数。
 *
 * 最大值计算为(contextWindow - 40000)和contextWindow的80%中的较大值。
 *
 * @param {ModelInfo} modelInfo - 包含上下文窗口大小的模型信息。
 * @returns {number} 非prompt缓存模型允许的最大token数。
 */
function getMaxTokensForNonPromptCachingModels(modelInfo: ModelInfo): number {
	return Math.max(modelInfo.contextWindow - 40_000, modelInfo.contextWindow * 0.8)
}

/**
 * 提供不支持prompt缓存的模型的消息截断比例。
 *
 * @param {ModelInfo} modelInfo - 模型信息。
 * @returns {number} 非prompt缓存模型的截断比例（最大为0.2）。
 */
function getTruncFractionForNonPromptCachingModels(modelInfo: ModelInfo): number {
	return Math.min(40_000 / modelInfo.contextWindow, 0.2)
}

// 为了向后兼容，保留原有函数但使用新实现
export function truncateHalfConversation(
	messages: Anthropic.Messages.MessageParam[],
): Anthropic.Messages.MessageParam[] {
	return truncateConversation(messages, 0.5)
}
