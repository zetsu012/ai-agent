import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { Fzf } from "fzf"
import { ModelInfo, SearchModelPickerProps, SearchableModel } from "./types"
import { DropdownWrapper, DropdownList, DropdownItem } from "./styles"
import { ModelInfoView } from "./ModelInfoView"
import { highlightFzfMatch } from "../../utils/highlight"

const DEFAULT_SEARCH_FIELDS = ["id", "name"]

const SearchModelPicker: React.FC<SearchModelPickerProps> = ({
	value,
	onValueChange,
	models,
	defaultModelId,
	label,
	placeholder = "Search and select a model...",
	disabled = false,
	searchFields = DEFAULT_SEARCH_FIELDS,
	onRefreshModels,
	autoRefresh = true,
	showModelInfo = true,
	customModelInfo,
	maxDropdownHeight,
	className,
	style,
	emptyMessage = "No models found",
	onUpdateConfig,
}) => {
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const [searchText, setSearchText] = useState("")
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const dropdownListRef = useRef<HTMLDivElement>(null)

	// 自动刷新
	useEffect(() => {
		if (autoRefresh && onRefreshModels) {
			onRefreshModels()
		}
	}, [autoRefresh, onRefreshModels])

	// 准备可搜索项
	const searchableModels = useMemo(() => {
		return Object.entries(models).map(([id, model]): SearchableModel => {
			const modelText = [id, model.name].filter(Boolean).join(" ")
			return {
				...model,
				searchText: modelText.toLowerCase(),
				descriptionText: model.description?.toLowerCase() || "",
				displayHtml: model.displayName || `${id}${model.name ? ` - ${model.name}` : ""}`,
			}
		})
	}, [models, searchFields])

	// 创建搜索实例
	const modelFzf = useMemo(() => {
		return new Fzf(searchableModels, {
			selector: (item) => item.searchText,
		})
	}, [searchableModels])

	const descriptionFzf = useMemo(() => {
		return new Fzf(searchableModels, {
			selector: (item) => item.descriptionText,
		})
	}, [searchableModels])

	// 处理高亮文本
	const renderHighlightedText = (text: string, positions: Set<number>, className: string) => {
		if (!positions.size) return text

		const segments: { text: string; highlight: boolean }[] = []
		let currentPos = 0

		// 将文本分割成高亮和非高亮段
		Array.from(positions)
			.sort((a, b) => a - b)
			.forEach((pos) => {
				if (pos > currentPos) {
					segments.push({
						text: text.slice(currentPos, pos),
						highlight: false,
					})
				}
				segments.push({
					text: text[pos],
					highlight: true,
				})
				currentPos = pos + 1
			})

		// 添加剩余的文本
		if (currentPos < text.length) {
			segments.push({
				text: text.slice(currentPos),
				highlight: false,
			})
		}

		// 渲染文本段
		return segments.map((segment, index) =>
			segment.highlight ? (
				<span key={index} className={className}>
					{segment.text}
				</span>
			) : (
				segment.text
			),
		)
	}

	// 处理搜索结果
	const searchResults = useMemo(() => {
		if (!searchText) return searchableModels

		const searchLower = searchText.toLowerCase()

		// 搜索模型名称
		const modelResults = modelFzf.find(searchLower).map((result) => ({
			...result.item,
			score: result.score * 2, // 模型名称匹配得分加倍
			matchType: "model" as const,
			positions: result.positions,
		}))

		// 搜索描述
		const descriptionResults = descriptionFzf.find(searchLower).map((result) => ({
			...result.item,
			score: result.score,
			matchType: "description" as const,
			positions: result.positions,
		}))

		// 合并结果并去重
		const allResults = [...modelResults, ...descriptionResults]
		const uniqueResults = allResults.reduce(
			(acc, curr) => {
				const existing = acc.find((item) => item.id === curr.id)
				if (!existing || existing.score < curr.score) {
					if (existing) {
						acc = acc.filter((item) => item.id !== curr.id)
					}
					acc.push(curr)
				}
				return acc
			},
			[] as typeof allResults,
		)

		// 按分数排序
		return uniqueResults
			.sort((a, b) => {
				// 首先按匹配类型排序
				if (a.matchType !== b.matchType) {
					return a.matchType === "model" ? -1 : 1
				}
				// 然后按分数排序
				return b.score - a.score
			})
			.map((result) => ({
				...result,
				displayHtml: (
					<div>
						<div
							style={{
								fontWeight: 500,
								color: "var(--vscode-editor-foreground)",
							}}>
							{renderHighlightedText(
								result.displayName || result.id,
								result.matchType === "model" ? result.positions : new Set(),
								"model-item-highlight",
							)}
						</div>
						{result.description && (
							<div
								style={{
									fontSize: "12px",
									color: "var(--vscode-descriptionForeground)",
									marginTop: 2,
									whiteSpace: "normal",
									wordBreak: "break-word",
								}}>
								{renderHighlightedText(
									result.description,
									result.matchType === "description" ? result.positions : new Set(),
									"model-item-highlight",
								)}
							</div>
						)}
					</div>
				),
			}))
	}, [searchText, modelFzf, descriptionFzf, searchableModels])

	// 处理点击外部关闭下拉列表
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	// 处理键盘导航
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) return

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
					const selectedModel = searchResults[selectedIndex]
					setSearchText("")
					setIsDropdownVisible(false)
					// 确保在状态更新后再触发值更新
					setTimeout(() => {
						onValueChange(selectedModel.id)
					}, 0)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSelectedIndex(-1)
				setSearchText("")
				break
		}
	}

	// 当搜索词变化时重置选中索引
	useEffect(() => {
		setSelectedIndex(-1)
		if (dropdownListRef.current) {
			dropdownListRef.current.scrollTop = 0
		}
	}, [searchText])

	// 确保选中项可见
	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	const selectedModel = models[value]
	const hasValidModel = Object.keys(models).some((id) => id.toLowerCase() === value.toLowerCase())

	return (
		<div className={className} style={style}>
			<style>
				{`
        .model-item-highlight {
          background-color: var(--vscode-editor-findMatchHighlightBackground);
          color: inherit;
          border-radius: 2px;
          padding: 0 2px;
          margin: 0 -2px;
        }
        `}
			</style>
			{label && (
				<label htmlFor="search-model-picker">
					<span style={{ fontWeight: 500 }}>{label}</span>
				</label>
			)}
			<DropdownWrapper ref={dropdownRef}>
				<VSCodeTextField
					id="search-model-picker"
					placeholder={isDropdownVisible ? placeholder : value}
					value={isDropdownVisible ? searchText : value}
					disabled={disabled}
					onInput={(e) => {
						const newValue = (e.target as HTMLInputElement).value
						setSearchText(newValue)
						setIsDropdownVisible(true)
					}}
					onFocus={() => {
						setIsDropdownVisible(true)
						setSearchText("")
					}}
					onBlur={() => {
						if (!searchText) {
							setTimeout(() => {
								setIsDropdownVisible(false)
							}, 200) // 给点击事件一个处理的机会
						}
					}}
					onKeyDown={handleKeyDown}
					style={{ width: "100%", position: "relative" }}>
					{(isDropdownVisible ? searchText : value) && (
						<div
							className="input-icon-button codicon codicon-close"
							aria-label="Clear search"
							onClick={() => {
								setSearchText("")
								if (!isDropdownVisible) {
									const newValue = defaultModelId || ""
									onValueChange(newValue)
								}
								setIsDropdownVisible(true)
							}}
							slot="end"
							style={{
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								height: "100%",
							}}
						/>
					)}
				</VSCodeTextField>
				{isDropdownVisible && (
					<DropdownList
						ref={dropdownListRef}
						style={maxDropdownHeight ? { maxHeight: maxDropdownHeight } : undefined}>
						{searchResults.length > 0 ? (
							searchResults.map((model, index) => (
								<DropdownItem
									key={model.id}
									ref={(el) => (itemRefs.current[index] = el)}
									$isSelected={index === selectedIndex}
									onMouseEnter={() => setSelectedIndex(index)}
									onClick={(e) => {
										e.preventDefault()
										e.stopPropagation()
										setSearchText("")
										setIsDropdownVisible(false)
										setTimeout(() => {
											onValueChange(model.id)
										}, 0)
									}}>
									{model.displayHtml}
								</DropdownItem>
							))
						) : (
							<div
								style={{
									padding: "8px 10px",
									color: "var(--vscode-descriptionForeground)",
									fontSize: "12px",
								}}>
								{emptyMessage}
							</div>
						)}
					</DropdownList>
				)}
			</DropdownWrapper>

			{showModelInfo && hasValidModel && selectedModel && (
				<div>
					{customModelInfo ? (
						customModelInfo(selectedModel)
					) : (
						<ModelInfoView
							selectedModelId={value}
							modelInfo={selectedModel}
							isDescriptionExpanded={isDescriptionExpanded}
							setIsDescriptionExpanded={setIsDescriptionExpanded}
						/>
					)}
				</div>
			)}
		</div>
	)
}

export default SearchModelPicker
