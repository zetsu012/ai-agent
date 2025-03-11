import { useState, useCallback } from "react"

/**
 * 复制到剪贴板的选项
 */
interface CopyOptions {
	/** 显示成功反馈的持续时间(毫秒)，默认2000 */
	feedbackDuration?: number
	/** 复制成功时的回调 */
	onSuccess?: () => void
	/** 复制失败时的回调 */
	onError?: (error: Error) => void
}

/**
 * 复制文本到剪贴板，带错误处理
 */
export const copyToClipboard = async (text: string, options?: CopyOptions): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text)
		options?.onSuccess?.()
		return true
	} catch (error) {
		const err = error instanceof Error ? error : new Error("复制到剪贴板失败")
		options?.onError?.(err)
		console.error("复制到剪贴板失败:", err)
		return false
	}
}

/**
 * React Hook，用于管理剪贴板复制状态和反馈
 */
export const useCopyToClipboard = (feedbackDuration = 2000) => {
	const [showCopyFeedback, setShowCopyFeedback] = useState(false)

	const copyWithFeedback = useCallback(
		async (text: string, e?: React.MouseEvent) => {
			e?.stopPropagation()

			const success = await copyToClipboard(text, {
				onSuccess: () => {
					setShowCopyFeedback(true)
					setTimeout(() => setShowCopyFeedback(false), feedbackDuration)
				},
			})

			return success
		},
		[feedbackDuration],
	)

	return {
		showCopyFeedback,
		copyWithFeedback,
	}
}
