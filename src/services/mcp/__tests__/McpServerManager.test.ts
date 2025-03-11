import * as vscode from "vscode"
import { McpServerManager } from "../McpServerManager"
import { McpHub } from "../McpHub"
import { CoolClineProvider } from "../../../core/webview/CoolClineProvider"

jest.mock("vscode")
jest.mock("../McpHub")
jest.mock("../../../core/webview/CoolClineProvider")

describe("McpServerManager", () => {
	let mockContext: vscode.ExtensionContext
	let mockProvider: jest.Mocked<CoolClineProvider>

	beforeEach(() => {
		// 重置所有模拟
		jest.clearAllMocks()

		// 创建模拟的 ExtensionContext
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn().mockResolvedValue(undefined),
			},
		} as unknown as vscode.ExtensionContext

		// 创建模拟的 CoolClineProvider
		mockProvider = {
			postMessageToWebview: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<CoolClineProvider>

		// 重置单例状态
		McpServerManager["instance"] = null
		McpServerManager["providers"].clear()
	})

	describe("getInstance", () => {
		it("应该创建新实例并注册提供者", async () => {
			const instance = await McpServerManager.getInstance(mockContext, mockProvider)

			expect(instance).toBeInstanceOf(McpHub)
			expect(McpServerManager["instance"]).toBe(instance)
			expect(McpServerManager["providers"].has(mockProvider)).toBe(true)
			expect(mockContext.globalState.update).toHaveBeenCalledWith(
				McpServerManager["GLOBAL_STATE_KEY"],
				expect.any(String),
			)
		})

		it("应该重用现有实例并注册新提供者", async () => {
			const firstInstance = await McpServerManager.getInstance(mockContext, mockProvider)
			const mockProvider2 = {
				postMessageToWebview: jest.fn().mockResolvedValue(undefined),
			} as unknown as jest.Mocked<CoolClineProvider>

			const secondInstance = await McpServerManager.getInstance(mockContext, mockProvider2)

			expect(secondInstance).toBe(firstInstance)
			expect(McpServerManager["providers"].size).toBe(2)
			expect(McpServerManager["providers"].has(mockProvider2)).toBe(true)
		})
	})

	describe("unregisterProvider", () => {
		it("应该从跟踪集合中移除提供者", async () => {
			await McpServerManager.getInstance(mockContext, mockProvider)
			expect(McpServerManager["providers"].has(mockProvider)).toBe(true)

			McpServerManager.unregisterProvider(mockProvider)
			expect(McpServerManager["providers"].has(mockProvider)).toBe(false)
		})
	})

	describe("notifyProviders", () => {
		it("应该通知所有注册的提供者", async () => {
			const mockProvider2 = {
				postMessageToWebview: jest.fn().mockResolvedValue(undefined),
			} as unknown as jest.Mocked<CoolClineProvider>

			await McpServerManager.getInstance(mockContext, mockProvider)
			await McpServerManager.getInstance(mockContext, mockProvider2)

			const message = { type: "test", data: "test" }
			McpServerManager.notifyProviders(message)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(message)
			expect(mockProvider2.postMessageToWebview).toHaveBeenCalledWith(message)
		})

		it("应该处理通知失败的情况", async () => {
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
			mockProvider.postMessageToWebview.mockRejectedValue(new Error("通知失败"))

			await McpServerManager.getInstance(mockContext, mockProvider)

			// 等待异步操作完成
			await new Promise(process.nextTick)
			McpServerManager.notifyProviders({ type: "test" })
			await new Promise(process.nextTick)

			expect(consoleErrorSpy).toHaveBeenCalled()
			consoleErrorSpy.mockRestore()
		})
	})

	describe("cleanup", () => {
		it("应该清理实例和所有资源", async () => {
			const instance = await McpServerManager.getInstance(mockContext, mockProvider)
			await McpServerManager.cleanup(mockContext)

			expect(McpServerManager["instance"]).toBeNull()
			expect(McpServerManager["providers"].size).toBe(0)
			expect(instance.dispose).toHaveBeenCalled()
			expect(mockContext.globalState.update).toHaveBeenCalledWith(McpServerManager["GLOBAL_STATE_KEY"], undefined)
		})

		it("如果没有实例应该安全地执行", async () => {
			await McpServerManager.cleanup(mockContext)
			expect(mockContext.globalState.update).not.toHaveBeenCalled()
		})
	})
})
