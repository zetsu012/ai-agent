import * as assert from "assert"
import * as vscode from "vscode"

import { CoolClineAPI } from "../exports/coolcline"
import { CoolClineProvider } from "../core/webview/CoolClineProvider"

suite("CoolCline Task", () => {
	test("Should handle prompt and response correctly", async function () {
		const timeout = 30000
		const interval = 1000

		const extension = vscode.extensions.getExtension("CoolCline.coolcline")

		if (!extension) {
			assert.fail("Extension not found")
		}

		const api: CoolClineAPI = await extension.activate()
		const provider = api.sidebarProvider as CoolClineProvider
		await provider.updateGlobalState("llmProvider", "openrouter")
		await provider.updateGlobalState("openRouterModelId", "anthropic/claude-3.5-sonnet")
		await provider.storeSecret("openRouterApiKey", process.env.OPENROUTER_API_KEY || "sk-or-v1-fake-api-key")

		// Create webview panel with development options.
		const panel = vscode.window.createWebviewPanel(
			"coolcline.SidebarProvider",
			"CoolCline",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				enableCommandUris: true,
				retainContextWhenHidden: true,
				localResourceRoots: [extension.extensionUri],
			},
		)

		try {
			// Initialize provider with panel.
			await provider.resolveWebviewView(panel)

			// Wait for webview to launch.
			let startTime = Date.now()

			while (Date.now() - startTime < timeout) {
				if (provider.viewLaunched) {
					break
				}

				await new Promise((resolve) => setTimeout(resolve, interval))
			}

			await api.startNewTask("Hello world, what is your name? Respond with 'My name is ...'")

			// Wait for task to appear in history with tokens.
			startTime = Date.now()

			while (Date.now() - startTime < timeout) {
				const state = await provider.getState()
				const task = state.taskHistory?.[0]

				if (task && task.tokensOut > 0) {
					break
				}

				await new Promise((resolve) => setTimeout(resolve, interval))
			}

			if (provider.messages.length === 0) {
				assert.fail("No messages received")
			}

			// console.log("Provider messages:", JSON.stringify(provider.messages, null, 2))

			assert.ok(
				provider.messages.some(({ type, text }) => type === "say" && text?.includes("My name is CoolCline")),
				"Did not receive expected response containing 'My name is CoolCline'",
			)
		} finally {
			panel.dispose()
		}
	})
})
