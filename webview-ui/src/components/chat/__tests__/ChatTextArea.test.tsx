import { render, fireEvent, screen, waitFor } from "@testing-library/react"
import ChatTextArea from "../ChatTextArea"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"
import { defaultModeSlug } from "../../../../../src/shared/modes"

// Mock modules
jest.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))
jest.mock("../../../components/common/CodeBlock")
jest.mock("../../../components/common/MarkdownBlock")

// Get the mocked postMessage function
const mockPostMessage = vscode.postMessage as jest.Mock

// Mock ExtensionStateContext
jest.mock("../../../context/ExtensionStateContext")

describe("ChatTextArea", () => {
	const defaultProps = {
		inputValue: "",
		setInputValue: jest.fn(),
		onSend: jest.fn(),
		textAreaDisabled: false,
		onSelectImages: jest.fn(),
		shouldDisableImages: false,
		placeholderText: "Type a message...",
		selectedImages: [],
		setSelectedImages: jest.fn(),
		onHeightChange: jest.fn(),
		mode: defaultModeSlug,
		setMode: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
		// Default mock implementation for useExtensionState
		;(useExtensionState as jest.Mock).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			apiConfiguration: {
				llmProvider: "anthropic",
			},
		})
	})

	describe("enhance prompt button", () => {
		it("should be disabled when textAreaDisabled is true", () => {
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
			})

			render(<ChatTextArea {...defaultProps} textAreaDisabled={true} />)
			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			expect(enhanceButton).toHaveClass("disabled")
		})
	})

	describe("handleEnhancePrompt", () => {
		it("should send message with correct configuration when clicked", () => {
			const apiConfiguration = {
				llmProvider: "openrouter",
				apiKey: "test-key",
			}

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration,
			})

			render(<ChatTextArea {...defaultProps} inputValue="Test prompt" />)

			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			fireEvent.click(enhanceButton)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "enhancePrompt",
				text: "Test prompt",
			})
		})

		it("should not send message when input is empty", () => {
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					llmProvider: "openrouter",
				},
			})

			render(<ChatTextArea {...defaultProps} inputValue="" />)

			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			fireEvent.click(enhanceButton)

			expect(mockPostMessage).not.toHaveBeenCalled()
		})

		it("should show sync state while enhancing", () => {
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					llmProvider: "openrouter",
				},
			})

			render(<ChatTextArea {...defaultProps} inputValue="Test prompt" />)

			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			fireEvent.click(enhanceButton)

			const syncSpinner = screen.getByText("", { selector: ".codicon-sync" })
			expect(syncSpinner).toBeInTheDocument()
		})
	})

	describe("effect dependencies", () => {
		it("should update when apiConfiguration changes", () => {
			const { rerender } = render(<ChatTextArea {...defaultProps} />)

			// Update apiConfiguration
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					llmProvider: "openrouter",
					newSetting: "test",
				},
			})

			rerender(<ChatTextArea {...defaultProps} />)

			// Verify the enhance button appears after apiConfiguration changes
			expect(screen.getByRole("button", { name: /enhance prompt/i })).toBeInTheDocument()
		})
	})

	describe("enhanced prompt response", () => {
		it("should update input value when receiving enhanced prompt", () => {
			const setInputValue = jest.fn()

			render(<ChatTextArea {...defaultProps} setInputValue={setInputValue} />)

			// Simulate receiving enhanced prompt message
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "enhancedPrompt",
						text: "Enhanced test prompt",
					},
				}),
			)

			expect(setInputValue).toHaveBeenCalledWith("Enhanced test prompt")
		})
	})

	describe("mode switching with slash command", () => {
		it("should show mode list when typing slash", () => {
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} />)
			const textarea = screen.getByRole("textbox")

			fireEvent.change(textarea, { target: { value: "/" } })

			// 在上下文菜单中查找包含 Test Mode 的选项
			const menuOptions = screen.getAllByTestId(/^context-menu-option-/)
			const testModeOption = menuOptions.find((option) => option.textContent?.includes("Test Mode"))
			expect(testModeOption).toBeTruthy()
			expect(testModeOption).toHaveTextContent("Test role definition")
		})

		it("should filter modes when typing after slash", () => {
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
				{
					slug: "other-mode",
					name: "Other Mode",
					roleDefinition: "Other role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} />)
			const textarea = screen.getByRole("textbox")

			fireEvent.change(textarea, { target: { value: "/test" } })

			// 验证过滤结果
			const menuOptions = screen.getAllByTestId(/^context-menu-option-/)
			const testModeOption = menuOptions.find((option) => option.textContent?.includes("Test Mode"))
			const otherModeOption = menuOptions.find((option) => option.textContent?.includes("Other Mode"))

			expect(testModeOption).toBeTruthy()
			expect(otherModeOption).toBeFalsy()
		})

		it("should switch mode when selecting from list", async () => {
			const setMode = jest.fn()
			const setInputValue = jest.fn()
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} setMode={setMode} setInputValue={setInputValue} />)
			const textarea = screen.getByRole("textbox")

			// 输入斜杠命令
			fireEvent.change(textarea, { target: { value: "/" } })

			// 等待模式列表显示
			const menuOptions = await screen.findAllByTestId(/^context-menu-option-/)
			const testModeOption = menuOptions.find((option) => option.textContent?.includes("Test Mode"))
			expect(testModeOption).toBeTruthy()

			// 选择测试模式
			if (testModeOption) {
				fireEvent.mouseDown(testModeOption)
			}

			// 验证模式切换
			expect(setMode).toHaveBeenCalledWith("test-mode")
			expect(setInputValue).toHaveBeenCalledWith("")
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "mode",
				text: "test-mode",
			})
		})

		it("should clear input after switching mode", () => {
			const setInputValue = jest.fn()
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} setInputValue={setInputValue} />)
			const textarea = screen.getByRole("textbox")

			// 输入斜杠命令
			fireEvent.change(textarea, { target: { value: "/" } })

			// 选择测试模式
			const menuOptions = screen.getAllByTestId(/^context-menu-option-/)
			const testModeOption = menuOptions.find((option) => option.textContent?.includes("Test Mode"))
			if (testModeOption) {
				fireEvent.mouseDown(testModeOption)
			}

			expect(setInputValue).toHaveBeenCalledWith("")
		})

		it("should hide mode list when input is not a slash command", () => {
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} />)
			const textarea = screen.getByRole("textbox")

			// 先显示模式列表
			fireEvent.change(textarea, { target: { value: "/" } })
			expect(screen.getAllByTestId(/^context-menu-option-/)).not.toHaveLength(0)

			// 输入非斜杠命令文本
			fireEvent.change(textarea, { target: { value: "hello" } })
			expect(screen.queryByTestId(/^context-menu-option-/)).toBeNull()
		})

		it("should handle empty customModes gracefully", () => {
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes: [],
			})

			render(<ChatTextArea {...defaultProps} />)
			const textarea = screen.getByRole("textbox")

			fireEvent.change(textarea, { target: { value: "/" } })

			// 应该显示默认的模式选项
			const menuOptions = screen.getAllByTestId(/^context-menu-option-/)
			expect(menuOptions.length).toBeGreaterThan(0)
			expect(menuOptions[0]).toHaveTextContent(/Code|Architect|Ask/)
		})

		it("should handle fuzzy search with partial mode name", () => {
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
				{
					slug: "test-mode-2",
					name: "Another Test Mode",
					roleDefinition: "Another test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} />)
			const textarea = screen.getByRole("textbox")

			// 使用模糊搜索
			fireEvent.change(textarea, { target: { value: "/tst" } })

			const menuOptions = screen.getAllByTestId(/^context-menu-option-/)
			expect(menuOptions.some((option) => option.textContent?.includes("Test Mode"))).toBeTruthy()
			expect(menuOptions.some((option) => option.textContent?.includes("Another Test Mode"))).toBeTruthy()
		})

		it("should update bottom mode selector after switching mode via slash command", async () => {
			const setMode = jest.fn()
			const setInputValue = jest.fn()
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} setMode={setMode} setInputValue={setInputValue} />)
			const textarea = screen.getByRole("textbox")

			// 输入斜杠命令
			fireEvent.change(textarea, { target: { value: "/" } })

			// 选择测试模式
			const menuOptions = await screen.findAllByTestId(/^context-menu-option-/)
			const testModeOption = menuOptions.find((option) => option.textContent?.includes("Test Mode"))
			if (testModeOption) {
				fireEvent.mouseDown(testModeOption)
			}

			// 验证模式切换
			expect(setMode).toHaveBeenCalledWith("test-mode")
			expect(setInputValue).toHaveBeenCalledWith("")
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "mode",
				text: "test-mode",
			})
		})

		it("should sync mode changes between slash command and bottom selector", async () => {
			const setMode = jest.fn()
			const setInputValue = jest.fn()
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			render(<ChatTextArea {...defaultProps} setMode={setMode} setInputValue={setInputValue} />)
			const textarea = screen.getByRole("textbox")

			// 输入斜杠命令
			fireEvent.change(textarea, { target: { value: "/" } })

			// 选择测试模式
			const menuOptions = await screen.findAllByTestId(/^context-menu-option-/)
			const testModeOption = menuOptions.find((option) => option.textContent?.includes("Test Mode"))
			if (testModeOption) {
				fireEvent.mouseDown(testModeOption)
			}

			// 验证模式切换
			expect(setMode).toHaveBeenCalledWith("test-mode")
			expect(setInputValue).toHaveBeenCalledWith("")
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "mode",
				text: "test-mode",
			})
		})

		it("should trigger same side effects when switching mode via either method", async () => {
			const setMode = jest.fn()
			const setInputValue = jest.fn()
			const customModes = [
				{
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Test role definition",
					groups: ["read"],
				},
			]

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				customModes,
			})

			const { rerender } = render(
				<ChatTextArea {...defaultProps} setMode={setMode} setInputValue={setInputValue} mode="code" />,
			)

			// 通过底部选择器切换模式
			const bottomModeSelector = screen.getAllByRole("combobox")[0]
			fireEvent.change(bottomModeSelector, { target: { value: "test-mode" } })

			// 验证通过底部选择器切换的效果
			expect(setMode).toHaveBeenCalledWith("test-mode")
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "mode",
				text: "test-mode",
			})

			// 重置 mock
			setMode.mockClear()
			mockPostMessage.mockClear()

			// 通过斜杠命令切换模式
			const textarea = screen.getByRole("textbox")
			fireEvent.change(textarea, { target: { value: "/" } })

			// 选择测试模式
			const menuOptions = await screen.findAllByTestId(/^context-menu-option-/)
			const testModeOption = menuOptions.find((option) => option.textContent?.includes("Test Mode"))
			if (testModeOption) {
				fireEvent.mouseDown(testModeOption)
			}

			// 验证通过斜杠命令切换的效果
			expect(setMode).toHaveBeenCalledWith("test-mode")
			expect(setInputValue).toHaveBeenCalledWith("")
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "mode",
				text: "test-mode",
			})
		})
	})
})
