import type { McpHub as McpHubType } from "../McpHub"
import type { CoolClineProvider } from "../../../core/webview/CoolClineProvider"
import type { ExtensionContext, Uri } from "vscode"
import type { McpConnection } from "../McpHub"
import { StdioConfigSchema } from "../McpHub"

// 增加测试超时时间到30秒
jest.setTimeout(30000)

const fs = require("fs/promises")
const { McpHub } = require("../McpHub")

jest.mock("vscode")
jest.mock("fs/promises")
jest.mock("../../../core/webview/CoolClineProvider")

// 保持对mockProvider的强引用，防止被垃圾回收
let globalMockProvider: any = null

describe("McpHub", () => {
	let mcpHub: McpHubType
	let mockProvider: Partial<CoolClineProvider>
	const mockSettingsPath = "/mock/settings/path/coolcline_mcp_settings.json"

	beforeEach(() => {
		jest.clearAllMocks()

		const mockUri: Uri = {
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
			fsPath: "/test/path",
			with: jest.fn(),
			toJSON: jest.fn(),
		}

		mockProvider = {
			ensureSettingsDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			ensureMcpServersDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			postMessageToWebview: jest.fn(),
			context: {
				subscriptions: [],
				workspaceState: {} as any,
				globalState: {} as any,
				secrets: {} as any,
				extensionUri: mockUri,
				extensionPath: "/test/path",
				storagePath: "/test/storage",
				logPath: "/test/log",
				asAbsolutePath: jest.fn().mockImplementation((relativePath) => `/test/path/${relativePath}`),
				storageUri: mockUri,
				logUri: mockUri,
				globalStorageUri: mockUri,
				extensionMode: 1,
			} as unknown as ExtensionContext,
		}

		// 设置默认的文件读写模拟
		;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ mcpServers: {} }))
		;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)

		globalMockProvider = mockProvider
		mcpHub = new McpHub(mockProvider as CoolClineProvider)
	})

	afterEach(() => {
		// 确保在每个测试结束后清理资源
		if (mcpHub && typeof mcpHub.dispose === "function") {
			mcpHub.dispose()
		}
	})

	afterAll(() => {
		// 测试结束后清除全局引用
		globalMockProvider = null
	})

	describe("toggleToolAlwaysAllow", () => {
		beforeEach(() => {
			// 重置模拟
			jest.clearAllMocks()

			// 模拟文件访问和读取
			;(fs.access as jest.Mock).mockResolvedValue(undefined)
			;(fs.readFile as jest.Mock).mockResolvedValue(
				JSON.stringify({
					mcpServers: {
						"test-server": {
							command: "node",
							args: ["test.js"],
							alwaysAllow: [],
						},
					},
				}),
			)
			;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)
		})

		it("should add tool to always allow list when enabling", async () => {
			await mcpHub.toggleToolAlwaysAllow("test-server", "new-tool", true)

			// Verify the config was updated correctly
			const writeCall = (fs.writeFile as jest.Mock).mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})

		it("should handle missing server configuration", async () => {
			// 模拟没有服务器配置的情况
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(
				JSON.stringify({
					mcpServers: {},
				}),
			)

			await mcpHub.toggleToolAlwaysAllow("test-server", "new-tool", true)

			// Verify the config was updated correctly
			const writeCall = (fs.writeFile as jest.Mock).mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"]).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})

		it("should remove tool from always allow list when disabling", async () => {
			// 模拟已有工具的情况
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(
				JSON.stringify({
					mcpServers: {
						"test-server": {
							command: "node",
							args: ["test.js"],
							alwaysAllow: ["existing-tool"],
						},
					},
				}),
			)

			await mcpHub.toggleToolAlwaysAllow("test-server", "existing-tool", false)

			// Verify the config was updated correctly
			const writeCall = (fs.writeFile as jest.Mock).mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).not.toContain("existing-tool")
		})

		it("should handle missing mcpServers object", async () => {
			// 模拟没有mcpServers对象的情况
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify({}))

			await mcpHub.toggleToolAlwaysAllow("test-server", "new-tool", true)

			// Verify the config was updated correctly
			const writeCall = (fs.writeFile as jest.Mock).mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"]).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})
	})

	describe("server disabled state", () => {
		it("should toggle server disabled state", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						command: "node",
						args: ["test.js"],
						disabled: false,
					},
				},
			}

			// Mock reading initial config
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

			await mcpHub.toggleServerDisabled("test-server", true)

			// Verify the config was updated correctly
			const writeCall = (fs.writeFile as jest.Mock).mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers["test-server"].disabled).toBe(true)
		})

		it("should filter out disabled servers from getServers", () => {
			const mockConnections: McpConnection[] = [
				{
					server: {
						name: "enabled-server",
						config: "{}",
						status: "connected",
						disabled: false,
					},
					client: {} as any,
					transport: {} as any,
				},
				{
					server: {
						name: "disabled-server",
						config: "{}",
						status: "connected",
						disabled: true,
					},
					client: {} as any,
					transport: {} as any,
				},
			]

			mcpHub.connections = mockConnections
			const servers = mcpHub.getServers()

			expect(servers.length).toBe(1)
			expect(servers[0].name).toBe("enabled-server")
		})

		it("should return all servers including disabled ones from getAllServers", () => {
			const mockConnections: McpConnection[] = [
				{
					server: {
						name: "enabled-server",
						config: "{}",
						status: "connected",
						disabled: false,
					},
					client: {} as any,
					transport: {} as any,
				},
				{
					server: {
						name: "disabled-server",
						config: "{}",
						status: "connected",
						disabled: true,
					},
					client: {} as any,
					transport: {} as any,
				},
			]

			mcpHub.connections = mockConnections
			const servers = mcpHub.getAllServers()

			expect(servers.length).toBe(2)
			expect(servers[0].name).toBe("enabled-server")
			expect(servers[1].name).toBe("disabled-server")
		})

		it("should prevent calling tools on disabled servers", async () => {
			const mockConnection: McpConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				} as any,
				transport: {} as any,
			}

			mcpHub.connections = [mockConnection]

			await expect(mcpHub.callTool("disabled-server", "some-tool", {})).rejects.toThrow(
				'Server "disabled-server" is disabled and cannot be used',
			)
		})

		it("should prevent reading resources from disabled servers", async () => {
			const mockConnection: McpConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn(),
				} as any,
				transport: {} as any,
			}

			mcpHub.connections = [mockConnection]

			await expect(mcpHub.readResource("disabled-server", "some/uri")).rejects.toThrow(
				'Server "disabled-server" is disabled',
			)
		})
	})

	describe("callTool", () => {
		it("should execute tool successfully", async () => {
			// Mock the connection with a minimal client implementation
			const mockConnection: McpConnection = {
				server: {
					name: "test-server",
					config: JSON.stringify({}),
					status: "connected" as const,
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				} as any,
				transport: {
					start: jest.fn(),
					close: jest.fn(),
					stderr: { on: jest.fn() },
				} as any,
			}

			mcpHub.connections = [mockConnection]

			await mcpHub.callTool("test-server", "some-tool", {})

			// Verify the request was made with correct parameters
			expect(mockConnection.client.request).toHaveBeenCalledWith(
				{
					method: "tools/call",
					params: {
						name: "some-tool",
						arguments: {},
					},
				},
				expect.any(Object),
				expect.objectContaining({ timeout: 60000 }), // Default 60 second timeout
			)
		})

		it("should throw error if server not found", async () => {
			await expect(mcpHub.callTool("non-existent-server", "some-tool", {})).rejects.toThrow(
				"No connection found for server: non-existent-server",
			)
		})

		describe("timeout configuration", () => {
			it("should validate timeout values", () => {
				// Test valid timeout values
				const validConfig = {
					command: "test",
					timeout: 60,
				}
				expect(() => StdioConfigSchema.parse(validConfig)).not.toThrow()

				// Test invalid timeout values
				const invalidConfigs = [
					{ command: "test", timeout: 0 }, // Too low
					{ command: "test", timeout: 3601 }, // Too high
					{ command: "test", timeout: -1 }, // Negative
				]

				invalidConfigs.forEach((config) => {
					expect(() => StdioConfigSchema.parse(config)).toThrow()
				})
			})

			it("should use default timeout of 60 seconds if not specified", async () => {
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({ command: "test" }), // No timeout specified
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}

				mcpHub.connections = [mockConnection]
				await mcpHub.callTool("test-server", "test-tool")

				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 60000 }), // 60 seconds in milliseconds
				)
			})

			it("should apply configured timeout to tool calls", async () => {
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({ command: "test", timeout: 120 }), // 2 minutes
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}

				mcpHub.connections = [mockConnection]
				await mcpHub.callTool("test-server", "test-tool")

				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 120000 }), // 120 seconds in milliseconds
				)
			})
		})

		describe("updateServerTimeout", () => {
			it("should update server timeout in settings file", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				// Mock reading initial config
				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				await mcpHub.updateServerTimeout("test-server", 120)

				// Verify the config was updated correctly
				const writeCall = (fs.writeFile as jest.Mock).mock.calls[0]
				const writtenConfig = JSON.parse(writeCall[1])
				expect(writtenConfig.mcpServers["test-server"].timeout).toBe(120)
			})

			it("should fallback to default timeout when config has invalid timeout", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				// Mock initial read
				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				// Update with invalid timeout
				await mcpHub.updateServerTimeout("test-server", 3601)

				// Config is written
				expect(fs.writeFile).toHaveBeenCalled()

				// Setup connection with invalid timeout
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({
							command: "node",
							args: ["test.js"],
							timeout: 3601, // Invalid timeout
						}),
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}

				mcpHub.connections = [mockConnection]

				// Call tool - should use default timeout
				await mcpHub.callTool("test-server", "test-tool")

				// Verify default timeout was used
				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 60000 }), // Default 60 seconds
				)
			})

			it("should accept valid timeout values", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				// Test valid timeout values
				const validTimeouts = [1, 60, 3600]
				for (const timeout of validTimeouts) {
					await mcpHub.updateServerTimeout("test-server", timeout)
					expect(fs.writeFile).toHaveBeenCalled()
					jest.clearAllMocks() // Reset for next iteration
					;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))
				}
			})

			it("should notify webview after updating timeout", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				await mcpHub.updateServerTimeout("test-server", 120)

				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
					expect.objectContaining({
						type: "mcpServers",
					}),
				)
			})
		})
	})
})
