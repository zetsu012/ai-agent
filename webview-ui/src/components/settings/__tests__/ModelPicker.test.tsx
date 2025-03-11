import { screen, fireEvent, render } from "@testing-library/react"
import { act } from "react"
import { ModelPicker } from "../ModelPicker"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { ModelInfo } from "../../../../../src/shared/api"
import { vscode } from "../../../utils/vscode"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

// 初始化 i18n
i18n.use(initReactI18next).init({
	resources: {
		en: {
			translation: {
				"settings.provider.model.title": "Model",
				"settings.provider.model.selectPlaceholder": "Select a model",
			},
		},
	},
	lng: "en",
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
})

jest.mock("../../../context/ExtensionStateContext", () => ({
	useExtensionState: jest.fn(),
}))

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver
Element.prototype.scrollIntoView = jest.fn()

describe("ModelPicker", () => {
	const mockSetApiConfiguration = jest.fn()
	const mockPostMessage = jest.fn()
	const mockOnUpdateApiConfig = jest.fn()

	const mockModels = {
		model1: {
			contextWindow: 4096,
			supportsPromptCache: false,
			description: "Test model 1",
			maxTokens: 8192,
			inputPrice: 3.0,
			outputPrice: 15.0,
			cacheWritesPrice: 3.75,
			cacheReadsPrice: 0.3,
			supportsImages: true,
			supportsComputerUse: true,
		},
		model2: {
			contextWindow: 8192,
			supportsPromptCache: false,
			description: "Test model 2",
			maxTokens: 8192,
			inputPrice: 3.0,
			outputPrice: 15.0,
			cacheWritesPrice: 3.75,
			cacheReadsPrice: 0.3,
			supportsImages: true,
			supportsComputerUse: true,
		},
	} as Record<string, ModelInfo>

	const defaultProps = {
		defaultModelId: "model1",
		modelsKey: "glamaModels" as const,
		configKey: "glamaModelId" as const,
		infoKey: "glamaModelInfo" as const,
		refreshMessageType: "refreshGlamaModels" as const,
		serviceName: "Test Service",
		serviceUrl: "https://test.service",
		recommendedModel: "model1",
	}

	beforeEach(() => {
		jest.clearAllMocks()
		;(useExtensionState as jest.Mock).mockReturnValue({
			apiConfiguration: { glamaModelId: "model1" },
			setApiConfiguration: mockSetApiConfiguration,
			glamaModels: mockModels,
			onUpdateApiConfig: mockOnUpdateApiConfig,
		})
		;(vscode.postMessage as jest.Mock) = mockPostMessage
	})

	it("应该正确渲染默认状态", async () => {
		await act(async () => {
			render(<ModelPicker {...defaultProps} />)
		})

		expect(screen.getByRole("textbox")).toHaveValue("model1")
	})

	it("选择模型时应该正确更新配置", async () => {
		await act(async () => {
			render(<ModelPicker {...defaultProps} />)
		})

		// 打开下拉菜单
		const input = screen.getByRole("textbox")
		await act(async () => {
			fireEvent.focus(input)
			// 输入搜索词以显示 model2
			fireEvent.change(input, { target: { value: "model2" } })
		})

		// 等待下拉菜单显示并选择 model2
		await act(async () => {
			const options = screen.getAllByRole("option")
			fireEvent.click(options[0])
		})

		expect(mockSetApiConfiguration).toHaveBeenCalledWith({
			glamaModelId: "model2",
			glamaModelInfo: mockModels["model2"],
		})
	})

	it("应该支持键盘导航", async () => {
		await act(async () => {
			render(<ModelPicker {...defaultProps} />)
		})

		const input = screen.getByRole("textbox")
		await act(async () => {
			fireEvent.focus(input)
			// 使用键盘导航
			fireEvent.keyDown(input, { key: "ArrowDown" })
		})

		expect(mockSetApiConfiguration).toHaveBeenCalledWith({
			glamaModelId: "model1",
			glamaModelInfo: mockModels["model1"],
		})
	})

	it("点击刷新按钮应该触发刷新", async () => {
		await act(async () => {
			render(<ModelPicker {...defaultProps} />)
		})

		const refreshButton = screen.getByRole("button")
		await act(async () => {
			fireEvent.click(refreshButton)
		})

		expect(mockPostMessage).toHaveBeenCalledWith({ type: "refreshGlamaModels" })
	})
})
