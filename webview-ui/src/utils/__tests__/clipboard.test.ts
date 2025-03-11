import { renderHook, act } from "@testing-library/react"
import { copyToClipboard, useCopyToClipboard } from "../clipboard"

describe("clipboard utils", () => {
	beforeEach(() => {
		// 模拟剪贴板API
		Object.assign(navigator, {
			clipboard: {
				writeText: jest.fn(),
			},
		})
		jest.useFakeTimers()
	})

	afterEach(() => {
		jest.clearAllMocks()
		jest.clearAllTimers()
	})

	describe("copyToClipboard", () => {
		it("成功复制文本到剪贴板", async () => {
			const text = "测试文本"
			const onSuccess = jest.fn()
			;(navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined)

			const result = await copyToClipboard(text, { onSuccess })

			expect(result).toBe(true)
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text)
			expect(onSuccess).toHaveBeenCalled()
		})

		it("处理复制失败的情况", async () => {
			const text = "测试文本"
			const onError = jest.fn()
			const error = new Error("复制失败")
			;(navigator.clipboard.writeText as jest.Mock).mockRejectedValue(error)

			const result = await copyToClipboard(text, { onError })

			expect(result).toBe(false)
			expect(onError).toHaveBeenCalledWith(error)
		})
	})

	describe("useCopyToClipboard", () => {
		it("提供复制功能和反馈状态", async () => {
			;(navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined)

			const { result } = renderHook(() => useCopyToClipboard())

			expect(result.current.showCopyFeedback).toBe(false)

			await act(async () => {
				await result.current.copyWithFeedback("测试文本")
			})

			expect(result.current.showCopyFeedback).toBe(true)

			act(() => {
				jest.advanceTimersByTime(2000)
			})

			expect(result.current.showCopyFeedback).toBe(false)
		})

		it("使用自定义反馈持续时间", async () => {
			;(navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined)

			const { result } = renderHook(() => useCopyToClipboard(1000))

			await act(async () => {
				await result.current.copyWithFeedback("测试文本")
			})

			expect(result.current.showCopyFeedback).toBe(true)

			act(() => {
				jest.advanceTimersByTime(500)
			})
			expect(result.current.showCopyFeedback).toBe(true)

			act(() => {
				jest.advanceTimersByTime(500)
			})
			expect(result.current.showCopyFeedback).toBe(false)
		})

		it("处理事件阻止冒泡", async () => {
			const mockEvent = {
				stopPropagation: jest.fn(),
			}

			const { result } = renderHook(() => useCopyToClipboard())

			await act(async () => {
				await result.current.copyWithFeedback("测试文本", mockEvent as any)
			})

			expect(mockEvent.stopPropagation).toHaveBeenCalled()
		})
	})
})
