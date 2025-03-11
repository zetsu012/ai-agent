import { VSCodeLink, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import debounce from "debounce"
import { Fzf } from "fzf"
import React, { KeyboardEvent, memo, useEffect, useMemo, useRef, useState } from "react"
import { useRemark } from "react-remark"
import { useMount } from "react-use"
import styled from "styled-components"
import { glamaDefaultModelId } from "../../../../src/shared/api"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { highlightFzfMatch } from "../../utils/highlight"
import { ModelInfoView, normalizeApiConfiguration } from "./ApiOptions"
import { useTranslation } from "react-i18next"

const GlamaModelPicker: React.FC = () => {
	const { t } = useTranslation()
	const { apiConfiguration, setApiConfiguration, glamaModels, onUpdateApiConfig } = useExtensionState()
	const [searchTerm, setSearchTerm] = useState(apiConfiguration?.glamaModelId || glamaDefaultModelId)
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const dropdownListRef = useRef<HTMLDivElement>(null)

	const handleModelChange = (newModelId: string) => {
		// could be setting invalid model id/undefined info but validation will catch it
		const apiConfig = {
			...apiConfiguration,
			glamaModelId: newModelId,
			glamaModelInfo: glamaModels[newModelId],
		}
		setApiConfiguration(apiConfig)
		onUpdateApiConfig(apiConfig)

		setSearchTerm(newModelId)
	}

	const { selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	useEffect(() => {
		if (apiConfiguration?.glamaModelId && apiConfiguration?.glamaModelId !== searchTerm) {
			setSearchTerm(apiConfiguration?.glamaModelId)
		}
	}, [apiConfiguration, searchTerm])

	const debouncedRefreshModels = useMemo(
		() =>
			debounce(() => {
				vscode.postMessage({ type: "refreshGlamaModels" })
			}, 50),
		[],
	)

	useMount(() => {
		debouncedRefreshModels()

		// Cleanup debounced function
		return () => {
			debouncedRefreshModels.clear()
		}
	})

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

	const modelIds = useMemo(() => {
		return Object.keys(glamaModels).sort((a, b) => a.localeCompare(b))
	}, [glamaModels])

	const searchableItems = useMemo(() => {
		return modelIds.map((id) => ({
			id,
			html: id,
		}))
	}, [modelIds])

	const fzf = useMemo(() => {
		return new Fzf(searchableItems, {
			selector: (item) => item.html,
		})
	}, [searchableItems])

	const modelSearchResults = useMemo(() => {
		if (!searchTerm) return searchableItems

		const searchResults = fzf.find(searchTerm)
		return searchResults.map((result) => ({
			...result.item,
			html: highlightFzfMatch(result.item.html, Array.from(result.positions), "model-item-highlight"),
		}))
	}, [searchableItems, searchTerm, fzf])

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) return

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < modelSearchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < modelSearchResults.length) {
					handleModelChange(modelSearchResults[selectedIndex].id)
					setIsDropdownVisible(false)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSelectedIndex(-1)
				break
		}
	}

	const hasInfo = useMemo(() => {
		return modelIds.some((id) => id.toLowerCase() === searchTerm.toLowerCase())
	}, [modelIds, searchTerm])

	useEffect(() => {
		setSelectedIndex(-1)
		if (dropdownListRef.current) {
			dropdownListRef.current.scrollTop = 0
		}
	}, [searchTerm])

	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	const handleRefreshModels = () => {
		vscode.postMessage({ type: "refreshGlamaModels" })
	}

	return (
		<>
			<style>
				{`
				.model-item-highlight {
					background-color: var(--vscode-editor-findMatchHighlightBackground);
					color: inherit;
				}
				`}
			</style>
			<div style={{ marginTop: 3 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
					<span>Model</span>
					<VSCodeButton appearance="icon" onClick={handleRefreshModels} style={{ padding: 5, margin: 0 }}>
						<span className="codicon codicon-refresh" />
					</VSCodeButton>
				</div>

				<div className="dropdown-container">
					<DropdownWrapper ref={dropdownRef}>
						<VSCodeTextField
							id="model-search"
							placeholder={t("settings.provider.model.selectPlaceholder").toString()}
							value={searchTerm}
							onInput={(e) => {
								handleModelChange((e.target as HTMLInputElement)?.value?.toLowerCase())
								setIsDropdownVisible(true)
							}}
							onFocus={() => setIsDropdownVisible(true)}
							onKeyDown={handleKeyDown}
							style={{ width: "100%", zIndex: GLAMA_MODEL_PICKER_Z_INDEX, position: "relative" }}>
							{searchTerm && (
								<div
									className="input-icon-button codicon codicon-close"
									aria-label="Clear search"
									onClick={() => {
										handleModelChange("")
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
							<DropdownList ref={dropdownListRef}>
								{modelSearchResults.map((item, index) => (
									<DropdownItem
										key={item.id}
										ref={(el) => (itemRefs.current[index] = el)}
										isSelected={index === selectedIndex}
										onMouseEnter={() => setSelectedIndex(index)}
										onClick={() => {
											handleModelChange(item.id)
											setIsDropdownVisible(false)
										}}
										dangerouslySetInnerHTML={{
											__html: item.html,
										}}
									/>
								))}
							</DropdownList>
						)}
					</DropdownWrapper>
				</div>

				{hasInfo ? (
					<ModelInfoView
						selectedModelId={selectedModelId}
						modelInfo={selectedModelInfo}
						isDescriptionExpanded={isDescriptionExpanded}
						setIsDescriptionExpanded={setIsDescriptionExpanded}
					/>
				) : (
					<p
						style={{
							fontSize: "12px",
							marginTop: 0,
							color: "var(--vscode-descriptionForeground)",
						}}>
						{t("settings.provider.model.description.text1").toString()}
						<VSCodeLink style={{ display: "inline", fontSize: "inherit" }} href="https://glama.ai/models">
							{t("settings.provider.model.description.glama").toString()}
						</VSCodeLink>
						{t("settings.provider.model.description.text2").toString()}
						<VSCodeLink
							style={{ display: "inline", fontSize: "inherit" }}
							onClick={() => handleModelChange("anthropic/claude-3.5-sonnet")}>
							{t("settings.provider.model.description.anthropic").toString()}
						</VSCodeLink>
						{t("settings.provider.model.description.text3").toString()}
					</p>
				)}
			</div>
		</>
	)
}

export default memo(GlamaModelPicker)

// Dropdown

const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

export const GLAMA_MODEL_PICKER_Z_INDEX = 1_000

const DropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${GLAMA_MODEL_PICKER_Z_INDEX - 1};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

const DropdownItem = styled.div<{ isSelected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`

// Markdown

const StyledMarkdown = styled.div`
	font-family:
		var(--vscode-font-family),
		system-ui,
		-apple-system,
		BlinkMacSystemFont,
		"Segoe UI",
		Roboto,
		Oxygen,
		Ubuntu,
		Cantarell,
		"Open Sans",
		"Helvetica Neue",
		sans-serif;
	font-size: 12px;
	color: var(--vscode-descriptionForeground);

	p,
	li,
	ol,
	ul {
		line-height: 1.25;
		margin: 0;
	}

	ol,
	ul {
		padding-left: 1.5em;
		margin-left: 0;
	}

	p {
		white-space: pre-wrap;
	}

	a {
		text-decoration: none;
	}
	a {
		&:hover {
			text-decoration: underline;
		}
	}
`

export const ModelDescriptionMarkdown = memo(
	({
		markdown,
		key,
		isExpanded,
		setIsExpanded,
	}: {
		markdown?: string
		key: string
		isExpanded: boolean
		setIsExpanded: (isExpanded: boolean) => void
	}) => {
		const { t } = useTranslation()
		const [reactContent, setMarkdown] = useRemark()
		const [showSeeMore, setShowSeeMore] = useState(false)
		const textContainerRef = useRef<HTMLDivElement>(null)
		const textRef = useRef<HTMLDivElement>(null)

		useEffect(() => {
			setMarkdown(markdown || "")
		}, [markdown, setMarkdown])

		useEffect(() => {
			if (textRef.current && textContainerRef.current) {
				const { scrollHeight } = textRef.current
				const { clientHeight } = textContainerRef.current
				const isOverflowing = scrollHeight > clientHeight
				setShowSeeMore(isOverflowing)
			}
		}, [reactContent, setIsExpanded])

		return (
			<StyledMarkdown key={key} style={{ display: "inline-block", marginBottom: 0 }}>
				<div
					ref={textContainerRef}
					style={{
						overflowY: isExpanded ? "auto" : "hidden",
						position: "relative",
						wordBreak: "break-word",
						overflowWrap: "anywhere",
					}}>
					<div
						ref={textRef}
						style={{
							display: "-webkit-box",
							WebkitLineClamp: isExpanded ? "unset" : 3,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}}>
						{reactContent}
					</div>
					{!isExpanded && showSeeMore && (
						<div
							style={{
								position: "absolute",
								right: 0,
								bottom: 0,
								display: "flex",
								alignItems: "center",
							}}>
							<div
								style={{
									width: 30,
									height: "1.2em",
									background:
										"linear-gradient(to right, transparent, var(--vscode-sideBar-background))",
								}}
							/>
							<VSCodeLink
								style={{
									fontSize: "inherit",
									paddingRight: 0,
									paddingLeft: 3,
									backgroundColor: "var(--vscode-sideBar-background)",
								}}
								onClick={() => setIsExpanded(true)}>
								{t("chat.task.seeMore").toString()}
							</VSCodeLink>
						</div>
					)}
				</div>
			</StyledMarkdown>
		)
	},
)
