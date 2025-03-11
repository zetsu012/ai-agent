import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import DynamicTextArea from "react-textarea-autosize"
import { mentionRegex, mentionRegexGlobal } from "../../../../src/shared/context-mentions"
import { useExtensionState } from "../../context/ExtensionStateContext"
import {
	ContextMenuOptionType,
	getContextMenuOptions,
	insertMention,
	removeMention,
	shouldShowContextMenu,
} from "../../utils/context-mentions"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import ContextMenu from "./ContextMenu"
import Thumbnails from "../common/Thumbnails"
import { vscode } from "../../utils/vscode"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"
import { Mode, getAllModes } from "../../../../src/shared/modes"
import { CaretIcon } from "../common/CaretIcon"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface ChatTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	mode: Mode
	setMode: (value: Mode) => void
}

const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			textAreaDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			mode,
			setMode,
		},
		ref,
	) => {
		const { t } = useTranslation()
		const { filePaths, openedTabs, currentApiConfigName, listApiConfigMeta, customModes } = useExtensionState()
		const [gitCommits, setGitCommits] = useState<any[]>([])
		const [showDropdown, setShowDropdown] = useState(false)

		// Close dropdown when clicking outside
		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (showDropdown) {
					setShowDropdown(false)
				}
			}
			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}, [showDropdown])

		// Handle enhanced prompt response
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data
				if (message.type === "enhancedPrompt") {
					if (message.text) {
						setInputValue(message.text)
					}
					setIsEnhancingPrompt(false)
				} else if (message.type === "commitSearchResults") {
					const commits = message.commits.map((commit: any) => ({
						type: ContextMenuOptionType.Git,
						value: commit.hash,
						label: commit.subject,
						description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
						icon: "$(git-commit)",
					}))
					setGitCommits(commits)
				}
			}
			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [setInputValue])

		const [thumbnailsHeight, setThumbnailsHeight] = useState(0)
		const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined)
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
		const [isFocused, setIsFocused] = useState(false)
		const [isTaskInProgressDialogOpen, setIsTaskInProgressDialogOpen] = useState(false)

		// Fetch git commits when Git is selected or when typing a hash
		useEffect(() => {
			if (selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(searchQuery)) {
				const message: WebviewMessage = {
					type: "searchCommits",
					query: searchQuery || "",
				} as const
				vscode.postMessage(message)
			}
		}, [selectedType, searchQuery])

		const handleEnhancePrompt = useCallback(() => {
			if (!textAreaDisabled) {
				const trimmedInput = inputValue.trim()
				if (trimmedInput) {
					setIsEnhancingPrompt(true)
					const message = {
						type: "enhancePrompt" as const,
						text: trimmedInput,
					}
					vscode.postMessage(message)
				} else {
					const promptDescription =
						"The 'Enhance Prompt' button helps improve your prompt by providing additional context, clarification, or rephrasing. Try typing a prompt in here and clicking the button again to see how it works."
					setInputValue(promptDescription)
				}
			}
		}, [inputValue, textAreaDisabled, setInputValue])

		const queryItems = useMemo(() => {
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				...gitCommits,
				...openedTabs
					.filter((tab) => tab.path)
					.map((tab) => ({
						type: ContextMenuOptionType.OpenedFile,
						value: "/" + tab.path,
					})),
				...filePaths
					.map((file) => "/" + file)
					.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path)) // Filter out paths that are already in openedTabs
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, gitCommits, openedTabs])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, setShowContextMenu])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					setMode(value as Mode)
					setInputValue("")
					setShowContextMenu(false)
					vscode.postMessage({
						type: "mode",
						text: value,
					})
					return
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)
				if (textAreaRef.current) {
					let insertValue = value || ""
					if (type === ContextMenuOptionType.URL) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = "problems"
					} else if (type === ContextMenuOptionType.Git) {
						insertValue = value || ""
					}

					const { newValue, mentionIndex } = insertMention(
						textAreaRef.current.value,
						cursorPosition,
						insertValue,
					)

					setInputValue(newValue)
					if (newValue) {
						// 只有在有新值时才设置光标位置
						const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
						setCursorPosition(newCursorPosition)
						setIntendedCursorPosition(newCursorPosition)

						// scroll to cursor
						setTimeout(() => {
							if (textAreaRef.current) {
								textAreaRef.current.blur()
								textAreaRef.current.focus()
							}
						}, 0)
					}
				}
			},
			[setInputValue, cursorPosition, setMode],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (showContextMenu) {
					if (event.key === "Escape") {
						setSelectedType(null)
						setSelectedMenuIndex(3) // File by default
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const options = getContextMenuOptions(searchQuery, selectedType, queryItems)
							const optionsLength = options.length

							if (optionsLength === 0) return prevIndex

							// Find selectable options (non-URL types)
							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults,
							)

							if (selectableOptions.length === 0) return -1 // No selectable options

							// Find the index of the next selectable option
							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => option === options[prevIndex],
							)

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) %
								selectableOptions.length

							// Find the index of the selected option in the original options array
							return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
						})
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getContextMenuOptions(searchQuery, selectedType, queryItems)[
							selectedMenuIndex
						]
						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value)
						}
						return
					}
				}

				const isComposing = event.nativeEvent?.isComposing ?? false
				if (event.key === "Enter" && !event.shiftKey && !isComposing) {
					if (textAreaDisabled) {
						vscode.postMessage({
							type: "playSound",
							audioType: "celebration",
						})
						event.preventDefault()
						setIsTaskInProgressDialogOpen(true)
					} else {
						event.preventDefault()
						onSend()
					}
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = inputValue[cursorPosition - 1]
					const charAfterCursor = inputValue[cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"
					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"
					// checks if char before cusor is whitespace after a mention
					if (
						charBeforeIsWhitespace &&
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$")) // "$" is added to ensure the match occurs at the end of the string
					) {
						const newCursorPosition = cursorPosition - 1
						// if mention is followed by another word, then instead of deleting the space separating them we just move the cursor to the end of the mention
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
							setCursorPosition(newCursorPosition)
						}
						setCursorPosition(newCursorPosition)
						setJustDeletedSpaceAfterMention(true)
					} else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(inputValue, cursorPosition)
						if (newText !== inputValue) {
							event.preventDefault()
							setInputValue(newText)
							setIntendedCursorPosition(newPosition) // Store the new cursor position in state
						}
						setJustDeletedSpaceAfterMention(false)
						setShowContextMenu(false)
					} else {
						setJustDeletedSpaceAfterMention(false)
					}
				}
			},
			[
				onSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				inputValue,
				cursorPosition,
				setInputValue,
				justDeletedSpaceAfterMention,
				queryItems,
				textAreaDisabled,
			],
		)

		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition)
				setIntendedCursorPosition(null) // Reset the state
			}
		}, [inputValue, intendedCursorPosition])

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				const newCursorPosition = e.target.selectionStart
				setInputValue(newValue)
				setCursorPosition(newCursorPosition)
				const showMenu = shouldShowContextMenu(newValue, newCursorPosition)

				setShowContextMenu(showMenu)
				if (showMenu) {
					const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
					const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
					setSearchQuery(query)
					if (query.length > 0) {
						setSelectedMenuIndex(0)
					} else {
						setSelectedMenuIndex(3) // Set to "File" option by default
					}
				} else {
					setSearchQuery("")
					setSelectedMenuIndex(-1)
				}
			},
			[setInputValue],
		)

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			// Only hide the context menu if the user didn't click on it
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false)
			}
			setIsFocused(false)
		}, [isMouseDownOnMenu])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				// Check if the pasted content is a URL, add space after so user can easily delete if they don't want it
				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					const trimmedUrl = pastedText.trim()
					const newValue =
						inputValue.slice(0, cursorPosition) + trimmedUrl + " " + inputValue.slice(cursorPosition)
					setInputValue(newValue)
					const newCursorPosition = cursorPosition + trimmedUrl.length + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)
					setShowContextMenu(false)

					// Scroll to new cursor position
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)

					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"]
				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})
				if (!shouldDisableImages && imageItems.length > 0) {
					e.preventDefault()
					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile()
							if (!blob) {
								resolve(null)
								return
							}
							const reader = new FileReader()
							reader.onloadend = () => {
								if (reader.error) {
									console.error("Error reading file:", reader.error)
									resolve(null)
								} else {
									const result = reader.result
									resolve(typeof result === "string" ? result : null)
								}
							}
							reader.readAsDataURL(blob)
						})
					})
					const imageDataArray = await Promise.all(imagePromises)
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
					if (dataUrls.length > 0) {
						setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
					} else {
						console.warn("No valid images were processed")
					}
				}
			},
			[shouldDisableImages, setSelectedImages, cursorPosition, setInputValue, inputValue],
		)

		const handleThumbnailsHeightChange = useCallback((height: number) => {
			setThumbnailsHeight(height)
		}, [])

		useEffect(() => {
			if (selectedImages.length === 0) {
				setThumbnailsHeight(0)
			}
		}, [selectedImages])

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return

			const text = textAreaRef.current.value

			highlightLayerRef.current.innerHTML = text
				.replace(/\n$/, "\n\n")
				.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] || c)
				.replace(mentionRegexGlobal, '<mark class="mention-context-textarea-highlight">$&</mark>')

			highlightLayerRef.current.scrollTop = textAreaRef.current.scrollTop
			highlightLayerRef.current.scrollLeft = textAreaRef.current.scrollLeft
		}, [])

		useLayoutEffect(() => {
			updateHighlights()
		}, [inputValue, updateHighlights])

		const updateCursorPosition = useCallback(() => {
			if (textAreaRef.current) {
				setCursorPosition(textAreaRef.current.selectionStart)
			}
		}, [])

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
					updateCursorPosition()
				}
			},
			[updateCursorPosition],
		)

		const selectStyle = {
			fontSize: "11px",
			cursor: "pointer",
			backgroundColor: "transparent",
			border: "none",
			color: "var(--vscode-foreground)",
			opacity: 0.8,
			outline: "none",
			paddingLeft: "20px",
			paddingRight: "6px",
			WebkitAppearance: "none" as const,
			MozAppearance: "none" as const,
			appearance: "none" as const,
		}

		const optionStyle = {
			backgroundColor: "var(--vscode-dropdown-background)",
			color: "var(--vscode-dropdown-foreground)",
		}

		const caretContainerStyle = {
			position: "absolute" as const,
			left: 6,
			top: "50%",
			transform: "translateY(-45%)",
			pointerEvents: "none" as const,
			opacity: 0.8,
		}

		return (
			<div
				className="chat-text-area"
				style={{
					opacity: 1,
					position: "relative",
					display: "flex",
					flexDirection: "column",
					gap: "8px",
					backgroundColor: "var(--vscode-input-background)",
					margin: "10px 15px",
					padding: "8px",
					outline: "none",
					border: "1px solid",
					borderColor: isFocused ? "var(--vscode-focusBorder)" : "transparent",
					borderRadius: "2px",
				}}
				onDrop={async (e) => {
					e.preventDefault()
					const files = Array.from(e.dataTransfer.files)
					const text = e.dataTransfer.getData("text")
					if (text) {
						const newValue = inputValue.slice(0, cursorPosition) + text + inputValue.slice(cursorPosition)
						setInputValue(newValue)
						const newCursorPosition = cursorPosition + text.length
						setCursorPosition(newCursorPosition)
						setIntendedCursorPosition(newCursorPosition)
						return
					}
					const acceptedTypes = ["png", "jpeg", "webp"]
					const imageFiles = files.filter((file) => {
						const [type, subtype] = file.type.split("/")
						return type === "image" && acceptedTypes.includes(subtype)
					})
					if (!shouldDisableImages && imageFiles.length > 0) {
						const imagePromises = imageFiles.map((file) => {
							return new Promise<string | null>((resolve) => {
								const reader = new FileReader()
								reader.onloadend = () => {
									if (reader.error) {
										console.error("Error reading file:", reader.error)
										resolve(null)
									} else {
										const result = reader.result
										resolve(typeof result === "string" ? result : null)
									}
								}
								reader.readAsDataURL(file)
							})
						})
						const imageDataArray = await Promise.all(imagePromises)
						const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
						if (dataUrls.length > 0) {
							setSelectedImages((prevImages) =>
								[...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE),
							)
							if (typeof vscode !== "undefined") {
								vscode.postMessage({
									type: "draggedImages",
									dataUrls: dataUrls,
								})
							}
						} else {
							console.warn("No valid images were processed")
						}
					}
				}}
				onDragOver={(e) => {
					e.preventDefault()
				}}>
				{showContextMenu && (
					<div
						ref={contextMenuContainerRef}
						style={{
							position: "absolute",
							bottom: "calc(100% - 10px)",
							left: 15,
							right: 15,
							overflowX: "hidden",
						}}
						onMouseDown={handleMenuMouseDown}>
						<ContextMenu
							onSelect={handleMentionSelect}
							searchQuery={searchQuery}
							selectedIndex={selectedMenuIndex}
							setSelectedIndex={setSelectedMenuIndex}
							selectedType={selectedType}
							queryItems={queryItems}
							modes={getAllModes(customModes)}
						/>
					</div>
				)}

				<div
					style={{
						position: "relative",
						flex: "1 1 auto",
						display: "flex",
						flexDirection: "column-reverse",
						minHeight: 0,
						overflow: "hidden",
					}}>
					<div
						ref={highlightLayerRef}
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							whiteSpace: "pre-wrap",
							wordWrap: "break-word",
							color: "transparent",
							overflow: "hidden",
							fontFamily: "var(--vscode-font-family)",
							fontSize: "var(--vscode-editor-font-size)",
							lineHeight: "var(--vscode-editor-line-height)",
							padding: "2px",
							paddingRight: "8px",
							marginBottom: thumbnailsHeight > 0 ? `${thumbnailsHeight + 16}px` : 0,
							zIndex: 1,
						}}
					/>
					<DynamicTextArea
						ref={(el) => {
							if (typeof ref === "function") {
								ref(el)
							} else if (ref) {
								ref.current = el
							}
							textAreaRef.current = el
						}}
						value={inputValue}
						disabled={false}
						onChange={(e) => {
							handleInputChange(e)
							updateHighlights()
						}}
						onFocus={() => setIsFocused(true)}
						onKeyDown={handleKeyDown}
						onKeyUp={handleKeyUp}
						onBlur={handleBlur}
						onPaste={handlePaste}
						onSelect={updateCursorPosition}
						onMouseUp={updateCursorPosition}
						onHeightChange={(height) => {
							if (textAreaBaseHeight === undefined || height < textAreaBaseHeight) {
								setTextAreaBaseHeight(height)
							}
							onHeightChange?.(height)
						}}
						placeholder={placeholderText}
						minRows={3}
						maxRows={15}
						autoFocus={true}
						style={{
							width: "100%",
							outline: "none",
							boxSizing: "border-box",
							backgroundColor: "transparent",
							color: "var(--vscode-input-foreground)",
							borderRadius: 2,
							fontFamily: "var(--vscode-font-family)",
							fontSize: "var(--vscode-editor-font-size)",
							lineHeight: "var(--vscode-editor-line-height)",
							resize: "none",
							overflowX: "hidden",
							overflowY: "auto",
							border: "none",
							padding: "2px",
							paddingRight: "8px",
							marginBottom: thumbnailsHeight > 0 ? `${thumbnailsHeight + 16}px` : 0,
							cursor: "text",
							flex: "0 1 auto",
							zIndex: 2,
							scrollbarWidth: "none",
						}}
						onScroll={() => updateHighlights()}
					/>
				</div>

				{selectedImages.length > 0 && (
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						onHeightChange={handleThumbnailsHeightChange}
						style={{
							position: "absolute",
							bottom: "36px",
							left: "16px",
							zIndex: 2,
							marginBottom: "4px",
						}}
					/>
				)}

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "auto",
						paddingTop: "2px",
					}}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
						}}>
						<div style={{ position: "relative", display: "inline-block" }}>
							<select
								value={mode}
								disabled={false}
								onChange={(e) => {
									const value = e.target.value
									if (value === "prompts-action") {
										window.postMessage({ type: "action", action: "promptsButtonClicked" })
										return
									}
									setMode(value as Mode)
									vscode.postMessage({
										type: "mode",
										text: value,
									})
								}}
								style={{
									...selectStyle,
									minWidth: "70px",
									flex: "0 0 auto",
									opacity: 1,
								}}>
								{getAllModes(customModes).map((mode) => (
									<option key={mode.slug} value={mode.slug} style={{ ...optionStyle }}>
										{mode.name}
									</option>
								))}
								<option
									disabled
									style={{
										borderTop: "1px solid var(--vscode-dropdown-border)",
										...optionStyle,
									}}>
									────
								</option>
								<option value="prompts-action" style={{ ...optionStyle }}>
									{String(t("chat.actions.edit"))}
								</option>
							</select>
							<div style={caretContainerStyle}>
								<CaretIcon />
							</div>
						</div>

						<div
							style={{
								position: "relative",
								display: "inline-block",
								flex: "1 1 auto",
								minWidth: 0,
								maxWidth: "150px",
								overflow: "hidden",
							}}>
							<select
								value={currentApiConfigName || ""}
								disabled={false}
								onChange={(e) => {
									const value = e.target.value
									if (value === "settings-action") {
										window.postMessage({ type: "action", action: "settingsButtonClicked" })
										return
									}
									vscode.postMessage({
										type: "loadApiConfiguration",
										text: value,
									})
								}}
								style={{
									...selectStyle,
									width: "100%",
									textOverflow: "ellipsis",
								}}>
								{(listApiConfigMeta || []).map((config) => (
									<option
										key={config.name}
										value={config.name}
										style={{
											...optionStyle,
										}}>
										{config.name}
									</option>
								))}
								<option
									disabled
									style={{
										borderTop: "1px solid var(--vscode-dropdown-border)",
										...optionStyle,
									}}>
									────
								</option>
								<option value="settings-action" style={{ ...optionStyle }}>
									{String(t("chat.actions.edit"))}
								</option>
							</select>
							<div style={caretContainerStyle}>
								<CaretIcon />
							</div>
						</div>
					</div>

					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "12px",
						}}>
						<div style={{ display: "flex", alignItems: "center" }}>
							{isEnhancingPrompt ? (
								<span
									className="codicon codicon-sync codicon-modifier-spin"
									style={{
										color: "var(--vscode-input-foreground)",
										opacity: 0.5,
										fontSize: 16.5,
										marginRight: 10,
									}}
								/>
							) : (
								<span
									role="button"
									aria-label="enhance prompt"
									data-testid="enhance-prompt-button"
									className={`input-icon-button ${
										textAreaDisabled ? "disabled" : ""
									} codicon codicon-sparkle`}
									onClick={() => !textAreaDisabled && handleEnhancePrompt()}
									style={{ fontSize: 16.5 }}
								/>
							)}
						</div>
						<span
							className={`input-icon-button ${
								shouldDisableImages ? "disabled" : ""
							} codicon codicon-device-camera`}
							onClick={() => !shouldDisableImages && onSelectImages()}
							style={{ fontSize: 16.5 }}
						/>
						<span
							title={textAreaDisabled ? "取消任务" : "发送消息"}
							className={`input-icon-button codicon ${
								textAreaDisabled ? "codicon-sync codicon-modifier-spin" : "codicon-send"
							}`}
							onClick={() => {
								if (textAreaDisabled) {
									// setIsTaskInProgressDialogOpen(true) // 如果是在发送中，点击就取消任务，不用弹窗对话框
									vscode.postMessage({ type: "cancelTask" })
									vscode.postMessage({
										type: "playSound",
										audioType: "celebration",
									})
								} else {
									onSend()
								}
							}}
							style={{ fontSize: 15 }}
						/>
					</div>
				</div>
				<Dialog open={isTaskInProgressDialogOpen} onOpenChange={setIsTaskInProgressDialogOpen}>
					<DialogContent className="w-[90%] sm:w-[400px]">
						<DialogHeader>
							<DialogTitle>{String(t("chat.messages.warning"))}</DialogTitle>
							<DialogDescription className="text-destructive">
								{String(t("chat.messages.taskIsRunningNote"))}
								<ol>
									<li>{String(t("chat.messages.taskIsRunningSelect1"))}</li>
									<li>{String(t("chat.messages.taskIsRunningSelect2"))}</li>
								</ol>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full">
							<VSCodeButton
								className="w-full sm:w-auto"
								onClick={() => setIsTaskInProgressDialogOpen(false)}>
								{String(t("chat.actions.await"))}
							</VSCodeButton>
							<VSCodeButton
								className="w-full sm:w-auto"
								onClick={() => {
									setIsTaskInProgressDialogOpen(false)
									vscode.postMessage({ type: "cancelTask" })
									vscode.postMessage({
										type: "playSound",
										audioType: "notification",
									})
								}}>
								{String(t("chat.actions.cancelTask"))}
							</VSCodeButton>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		)
	},
)

export default ChatTextArea
