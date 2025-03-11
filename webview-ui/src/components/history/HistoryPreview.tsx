import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { memo } from "react"
import { formatLargeNumber } from "../../utils/format"
import { useTranslation } from "react-i18next"
import { useCopyToClipboard } from "../../utils/clipboard"

type HistoryPreviewProps = {
	showHistoryView: () => void
}

const HistoryPreview = ({ showHistoryView }: HistoryPreviewProps) => {
	const { taskHistory } = useExtensionState()
	const { t } = useTranslation()
	const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()

	const handleHistorySelect = (id: string) => {
		vscode.postMessage({ type: "showTaskWithId", text: id })
	}

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp)
		return date
			?.toLocaleString("en-US", {
				month: "long",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})
			.replace(", ", " ")
			.replace(" at", ",")
			.toUpperCase()
	}

	if (!taskHistory?.length) {
		return null
	}

	const recentTasks = taskHistory
		.filter((item) => item.ts && item.task)
		.sort((a, b) => b.ts - a.ts)
		.slice(0, 3)

	return (
		<div style={{ flexShrink: 0 }}>
			{showCopyFeedback && <div className="copy-modal">{String(t("history.preview.promptCopied"))}</div>}
			<style>
				{`
					.history-preview-item {
						background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 65%, transparent);
						border-radius: 4px;
						position: relative;
						overflow: hidden;
						opacity: 0.8;
						cursor: pointer;
						margin-bottom: 12px;
					}
					.history-preview-item:hover {
						background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 100%, transparent);
						opacity: 1;
						pointer-events: auto;
					}
					.copy-modal {
						position: fixed;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);
						background-color: var(--vscode-notifications-background);
						color: var(--vscode-notifications-foreground);
						padding: 12px 20px;
						border-radius: 4px;
						box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
						z-index: 1000;
						transition: opacity 0.2s ease-in-out;
					}
				`}
			</style>

			<div
				style={{
					color: "var(--vscode-descriptionForeground)",
					margin: "10px 20px 10px 20px",
					display: "flex",
					alignItems: "center",
				}}>
				<span
					className="codicon codicon-comment-discussion"
					style={{ marginRight: "4px", transform: "scale(0.9)" }}></span>
				<span
					style={{
						fontWeight: 500,
						fontSize: "0.85em",
						textTransform: "uppercase",
					}}>
					{String(t("history.preview.recentTasks"))}
				</span>
			</div>

			<div style={{ padding: "0px 20px 0 20px" }}>
				{recentTasks.map((item) => (
					<div key={item.id} className="history-preview-item" onClick={() => handleHistorySelect(item.id)}>
						<div style={{ padding: "12px" }}>
							<div style={{ marginBottom: "8px" }}>
								<span
									style={{
										color: "var(--vscode-descriptionForeground)",
										fontWeight: 500,
										fontSize: "0.85em",
										textTransform: "uppercase",
									}}>
									{formatDate(item.ts)}
								</span>
							</div>
							<div
								style={{
									fontSize: "var(--vscode-font-size)",
									color: "var(--vscode-descriptionForeground)",
									marginBottom: "8px",
									display: "-webkit-box",
									WebkitLineClamp: 3,
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
									whiteSpace: "pre-wrap",
									wordBreak: "break-word",
									overflowWrap: "anywhere",
								}}>
								{item.task}
							</div>
							<div style={{ fontSize: "0.85em", color: "var(--vscode-descriptionForeground)" }}>
								<span>
									{String(t("history.preview.metrics.tokens"))}: ↑
									{formatLargeNumber(item.tokensIn || 0)} ↓{formatLargeNumber(item.tokensOut || 0)}
								</span>
								{!!item.cacheWrites && (
									<>
										{" • "}
										<span>
											{String(t("history.preview.metrics.cache"))}: +
											{formatLargeNumber(item.cacheWrites || 0)} →{" "}
											{formatLargeNumber(item.cacheReads || 0)}
										</span>
									</>
								)}
								{!!item.totalCost && (
									<>
										{" • "}
										<span>
											{String(t("history.preview.metrics.apiCost"))}: $
											{item.totalCost?.toFixed(4)}
										</span>
									</>
								)}
							</div>
							<button
								title={String(t("history.preview.copyPrompt"))}
								aria-label={String(t("history.preview.copyPrompt"))}
								className="copy-button"
								data-appearance="icon"
								onClick={(e) => copyWithFeedback(item.task, e)}>
								<span className="codicon codicon-copy"></span>
							</button>
						</div>
					</div>
				))}
				<div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
					<VSCodeButton
						appearance="icon"
						onClick={() => showHistoryView()}
						style={{
							opacity: 0.9,
						}}>
						<div
							style={{
								fontSize: "var(--vscode-font-size)",
								color: "var(--vscode-descriptionForeground)",
							}}>
							{String(t("history.preview.viewAll"))}
						</div>
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
}

export default memo(HistoryPreview)
