import { VSCodeLink, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import debounce from "debounce"
import { Fzf } from "fzf"
import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { useMount } from "react-use"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { highlightFzfMatch } from "../../utils/highlight"
import { ModelInfoView, normalizeApiConfiguration } from "./ApiOptions"
import { useTranslation } from "react-i18next"
import { DropdownWrapper, DropdownList, DropdownItem, DROPDOWN_Z_INDEX } from "../ui/dropdown"
import { ModelInfo } from "../../../../src/shared/api"

interface ModelPickerProps {
	defaultModelId: string
	modelsKey: "openAiModels" | "openRouterModels" | "glamaModels" | "unboundModels"
	configKey: "openAiModelId" | "openRouterModelId" | "glamaModelId" | "unboundModelId"
	infoKey: "openAiModelInfo" | "openRouterModelInfo" | "glamaModelInfo" | "unboundModelInfo"
	refreshMessageType:
		| "refreshOpenAiModels"
		| "refreshOpenRouterModels"
		| "refreshGlamaModels"
		| "refreshUnboundModels"
	serviceName: string
	serviceUrl: string
	recommendedModel: string
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
	defaultModelId,
	modelsKey,
	configKey,
	infoKey,
	refreshMessageType,
	serviceName,
	serviceUrl,
	recommendedModel,
}) => {
	const { t } = useTranslation()
	const { apiConfiguration, setApiConfiguration, [modelsKey]: models, onUpdateApiConfig } = useExtensionState()
	const modelsRecord = models as Record<string, ModelInfo>
	const [searchTerm, setSearchTerm] = useState(apiConfiguration?.[configKey] || defaultModelId)
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const dropdownListRef = useRef<HTMLDivElement>(null)

	const handleModelChange = (newModelId: string) => {
		const apiConfig = {
			...apiConfiguration,
			[configKey]: newModelId,
			[infoKey]: modelsRecord[newModelId],
		}
		setApiConfiguration(apiConfig)
		onUpdateApiConfig(apiConfig)
		setSearchTerm(newModelId)
	}

	const { selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	useEffect(() => {
		if (apiConfiguration?.[configKey] && apiConfiguration[configKey] !== searchTerm) {
			setSearchTerm(apiConfiguration[configKey])
		}
	}, [apiConfiguration, configKey, searchTerm])

	const debouncedRefreshModels = useMemo(
		() =>
			debounce(() => {
				vscode.postMessage({ type: refreshMessageType })
			}, 50),
		[refreshMessageType],
	)

	useMount(() => {
		debouncedRefreshModels()
		return () => debouncedRefreshModels.clear()
	})

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	const modelIds = useMemo(() => {
		return Object.keys(modelsRecord).sort((a, b) => a.localeCompare(b))
	}, [modelsRecord])

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
			html: result.item.id,
		}))
	}, [searchableItems, searchTerm, fzf])

	useEffect(() => {
		if (modelSearchResults.length === 1) {
			handleModelChange(modelSearchResults[0].id)
		}
	}, [modelSearchResults])

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault()
				setIsDropdownVisible(true)
				setSelectedIndex(0)
				if (modelSearchResults.length > 0) {
					handleModelChange(modelSearchResults[0].id)
				}
				return
			}
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => {
					const next = prev < modelSearchResults.length - 1 ? prev + 1 : prev
					if (next >= 0 && next < modelSearchResults.length) {
						handleModelChange(modelSearchResults[next].id)
					}
					return next
				})
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => {
					const next = prev > 0 ? prev - 1 : prev
					if (next >= 0 && next < modelSearchResults.length) {
						handleModelChange(modelSearchResults[next].id)
					}
					return next
				})
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

	useEffect(() => {
		if (modelSearchResults.length > 0) {
			setSelectedIndex(0)
		}
	}, [modelSearchResults])

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
		vscode.postMessage({ type: refreshMessageType })
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
					<span style={{ fontWeight: 500 }}>Model</span>
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
								setSearchTerm((e.target as HTMLInputElement)?.value)
								setIsDropdownVisible(true)
							}}
							onFocus={() => setIsDropdownVisible(true)}
							onKeyDown={handleKeyDown}
							style={{ width: "100%", zIndex: DROPDOWN_Z_INDEX, position: "relative" }}>
							{searchTerm && (
								<div
									className="input-icon-button codicon codicon-close"
									aria-label="Clear search"
									onClick={() => {
										setSearchTerm("")
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
							<DropdownList ref={dropdownListRef} $zIndex={DROPDOWN_Z_INDEX - 1} role="listbox">
								{modelSearchResults.map((item, index) => (
									<DropdownItem
										key={item.id}
										ref={(el) => (itemRefs.current[index] = el)}
										$selected={index === selectedIndex}
										onMouseEnter={() => setSelectedIndex(index)}
										onClick={() => {
											handleModelChange(item.id)
											setIsDropdownVisible(false)
										}}
										role="option"
										aria-selected={index === selectedIndex}
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
						<VSCodeLink style={{ display: "inline", fontSize: "inherit" }} href={serviceUrl}>
							{serviceName}
						</VSCodeLink>
						{t("settings.provider.model.description.text2").toString()}
						<VSCodeLink
							style={{ display: "inline", fontSize: "inherit" }}
							onClick={() => handleModelChange(recommendedModel)}>
							{recommendedModel}
						</VSCodeLink>
						{t("settings.provider.model.description.text3").toString()}
					</p>
				)}
			</div>
		</>
	)
}
