import { truncateConversation, truncateConversationIfNeeded } from "../index"
import { ModelInfo } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"

describe("truncateConversation", () => {
	it("应该保留第一条消息并按指定比例截断消息对", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user" as const, content: "first" },
			{ role: "assistant" as const, content: "second" },
			{ role: "user" as const, content: "third" },
			{ role: "assistant" as const, content: "fourth" },
		]

		const result = truncateConversation(messages, 0.5)

		expect(result).toHaveLength(3)
		expect(result[0]).toBe(messages[0])
		expect(result[1]).toBe(messages[2])
		expect(result[2]).toBe(messages[3])
	})

	it("当消息数量为1时应返回原始消息", () => {
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user" as const, content: "first" }]

		const result = truncateConversation(messages, 0.5)

		expect(result).toBe(messages)
		expect(result).toHaveLength(1)
	})
})

describe("truncateConversationIfNeeded", () => {
	const baseModelInfo: ModelInfo = {
		contextWindow: 100_000,
		maxTokens: 4096,
		supportsPromptCache: false,
	}

	it("当token数远低于阈值时不应截断消息", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user" as const, content: "first" },
			{ role: "assistant" as const, content: "second" },
		]

		const result = truncateConversationIfNeeded(messages, 30_000, baseModelInfo)

		expect(result).toBe(messages)
	})

	it("当token数接近阈值时应截断消息", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user" as const, content: "first" },
			{ role: "assistant" as const, content: "second" },
			{ role: "user" as const, content: "third" },
			{ role: "assistant" as const, content: "fourth" },
		]

		const result = truncateConversationIfNeeded(messages, 76_000, baseModelInfo)

		expect(result).not.toBe(messages)
		expect(result.length).toBeLessThan(messages.length)
	})

	it("对支持prompt缓存的模型应使用不同的截断策略", () => {
		const cachingModelInfo = { ...baseModelInfo, supportsPromptCache: true }
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user" as const, content: "first" },
			{ role: "assistant" as const, content: "second" },
			{ role: "user" as const, content: "third" },
			{ role: "assistant" as const, content: "fourth" },
		]

		const result = truncateConversationIfNeeded(messages, 76_000, cachingModelInfo)

		expect(result).not.toBe(messages)
		expect(result.length).toBeLessThan(messages.length)
	})
})
