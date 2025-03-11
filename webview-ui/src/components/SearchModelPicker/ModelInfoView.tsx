import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import React from "react"
import { ModelDescriptionMarkdown } from "./ModelDescriptionMarkdown"
import { ModelInfo } from "./types"
import { formatLargeNumber } from "../../utils/format"

interface ModelInfoViewProps {
	selectedModelId: string
	modelInfo: ModelInfo
	isDescriptionExpanded: boolean
	setIsDescriptionExpanded: (expanded: boolean) => void
}

export const ModelInfoView: React.FC<ModelInfoViewProps> = ({
	selectedModelId,
	modelInfo,
	isDescriptionExpanded,
	setIsDescriptionExpanded,
}) => {
	return (
		<div
			style={{
				marginTop: 8,
				padding: "8px",
				backgroundColor: "var(--vscode-editor-background)",
				border: "1px solid var(--vscode-widget-border)",
				borderRadius: "4px",
				fontSize: "12px",
				color: "var(--vscode-descriptionForeground)",
			}}>
			{/* 描述部分 */}
			{modelInfo.description && (
				<div style={{ marginBottom: "12px" }}>
					<ModelDescriptionMarkdown
						markdown={modelInfo.description}
						modelId={selectedModelId}
						isExpanded={isDescriptionExpanded}
						setIsExpanded={setIsDescriptionExpanded}
					/>
				</div>
			)}

			{/* 功能支持信息 */}
			<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
				<div
					style={{
						color: modelInfo.supportsImages
							? "var(--vscode-charts-green)"
							: "var(--vscode-errorForeground)",
					}}>
					{modelInfo.supportsImages ? "✓" : "✕"} {modelInfo.supportsImages ? "Supports" : "Does not support"}{" "}
					images
				</div>
				<div
					style={{
						color: modelInfo.supportsComputerUse
							? "var(--vscode-charts-green)"
							: "var(--vscode-errorForeground)",
					}}>
					{modelInfo.supportsComputerUse ? "✓" : "✕"}{" "}
					{modelInfo.supportsComputerUse ? "Supports" : "Does not support"} computer use
				</div>
				<div
					style={{
						color: modelInfo.supportsPromptCache
							? "var(--vscode-charts-green)"
							: "var(--vscode-errorForeground)",
					}}>
					{modelInfo.supportsPromptCache ? "✓" : "✕"}{" "}
					{modelInfo.supportsPromptCache ? "Supports" : "Does not support"} prompt caching
				</div>
			</div>

			{/* Token 信息 */}
			<div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
				{modelInfo.maxTokens && <div>Max output: {formatLargeNumber(modelInfo.maxTokens)} tokens</div>}
				{modelInfo.contextWindow && (
					<div>Context window: {formatLargeNumber(modelInfo.contextWindow)} tokens</div>
				)}
			</div>

			{/* 价格信息 */}
			<div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
				{modelInfo.pricing?.prompt !== undefined && (
					<div>Input price: ${modelInfo.pricing?.prompt.toFixed(2)}/million tokens</div>
				)}
				{modelInfo.pricing?.completion !== undefined && (
					<div>Output price: ${modelInfo.pricing?.completion.toFixed(2)}/million tokens</div>
				)}
				{modelInfo.pricing?.cacheWritesPrice && (
					<div>Cache writes: ${modelInfo.pricing?.cacheWritesPrice.toFixed(2)}/million tokens</div>
				)}
				{modelInfo.pricing?.cacheReadsPrice && (
					<div>Cache reads: ${modelInfo.pricing?.cacheReadsPrice.toFixed(2)}/million tokens</div>
				)}
			</div>

			{/* 模型链接 */}
			{modelInfo.modelUrl && (
				<div style={{ marginTop: "8px" }}>
					<VSCodeLink href={modelInfo.modelUrl} style={{ fontSize: "inherit" }}>
						see more
					</VSCodeLink>
				</div>
			)}
		</div>
	)
}
