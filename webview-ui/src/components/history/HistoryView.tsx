import { VSCodeButton, VSCodeTextField, VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { Virtuoso } from "react-virtuoso"
import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from "react"
import { Fzf } from "fzf"
import { formatLargeNumber } from "../../utils/format"
import { highlightFzfMatch } from "../../utils/highlight"
import { useCopyToClipboard } from "../../utils/clipboard"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "../ui/ConfirmDialog"
import styled from "styled-components"
import { createPortal } from "react-dom"
import { useFloating, offset, flip, shift } from "@floating-ui/react"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const { taskHistory } = useExtensionState()
	const { t } = useTranslation()
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()
	const [showConfirmDialog, setShowConfirmDialog] = useState(false)
	const [showDeleteMenu, setShowDeleteMenu] = useState(false)
	const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
		title: string
		description: string
		onConfirm: () => void
	}>({ title: "", description: "", onConfirm: () => {} })

	const deleteButtonRef = useRef<HTMLDivElement | null>(null)
	const menuRef = useRef<HTMLDivElement | null>(null)

	const { refs, floatingStyles, update, placement } = useFloating({
		placement: "bottom-end",
		middleware: [
			offset({
				mainAxis: 6,
				crossAxis: 0,
			}),
			flip({
				fallbackPlacements: ["top-end"],
			}),
			shift({
				padding: 8,
			}),
		],
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null, type: "button" | "tooltip") => {
			if (type === "button") {
				deleteButtonRef.current = node
				refs.setReference(node)
			} else {
				menuRef.current = node
				refs.setFloating(node)
			}
		},
		[refs],
	)

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(event.target as Node) &&
				deleteButtonRef.current &&
				!deleteButtonRef.current.contains(event.target as Node)
			) {
				setShowDeleteMenu(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	// 打开选择的历史消息
	const handleHistorySelect = (id: string) => {
		vscode.postMessage({ type: "showTaskWithId", text: id })
	}

	// 删除所有历史消息
	const handleDeleteAllProjectsAllHistory = () => {
		setShowDeleteMenu(false)
		setConfirmDialogConfig({
			title: "Delete All Projects All History",
			description:
				"Are you sure you want to delete all history records from all projects? This action cannot be undone.",
			onConfirm: () => {
				vscode.postMessage({ type: "deleteAllProjectsAllHistory" as any })
				setShowConfirmDialog(false)
			},
		})
		setShowConfirmDialog(true)
	}

	// 删除当前项目的所有历史消息
	const handleDeleteThisProjectAllHistory = () => {
		setShowDeleteMenu(false)
		setConfirmDialogConfig({
			title: "Delete This Project All History",
			description:
				"Are you sure you want to delete all history records for this project? This action cannot be undone.",
			onConfirm: () => {
				vscode.postMessage({ type: "deleteThisProjectAllHistory" as any })
				setShowConfirmDialog(false)
			},
		})
		setShowConfirmDialog(true)
	}

	// 删除选择的历史消息
	const handleDeleteHistoryItem = (id: string) => {
		setConfirmDialogConfig({
			title: "Delete Task",
			description: "Are you sure you want to delete this task? This action cannot be undone.",
			onConfirm: () => {
				vscode.postMessage({ type: "deleteTaskWithId", text: id })
				setShowConfirmDialog(false)
			},
		})
		setShowConfirmDialog(true)
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

	const presentableTasks = useMemo(() => {
		return taskHistory.filter((item) => item.ts && item.task)
	}, [taskHistory])

	const fzf = useMemo(() => {
		return new Fzf(presentableTasks, {
			selector: (item) => item.task,
		})
	}, [presentableTasks])

	const taskHistorySearchResults = useMemo(() => {
		let results = presentableTasks
		if (searchQuery) {
			const searchResults = fzf.find(searchQuery)
			results = searchResults.map((result) => ({
				...result.item,
				task: highlightFzfMatch(result.item.task, Array.from(result.positions)),
			}))
		}

		// First apply search if needed
		const searchResults = searchQuery ? results : presentableTasks

		// Then sort the results
		return [...searchResults].sort((a, b) => {
			switch (sortOption) {
				case "oldest":
					return (a.ts || 0) - (b.ts || 0)
				case "mostExpensive":
					return (b.totalCost || 0) - (a.totalCost || 0)
				case "mostTokens":
					const aTokens = (a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0)
					const bTokens = (b.tokensIn || 0) + (b.tokensOut || 0) + (b.cacheWrites || 0) + (b.cacheReads || 0)
					return bTokens - aTokens
				case "mostRelevant":
					// Keep fuse order if searching, otherwise sort by newest
					return searchQuery ? 0 : (b.ts || 0) - (a.ts || 0)
				case "newest":
				default:
					return (b.ts || 0) - (a.ts || 0)
			}
		})
	}, [presentableTasks, searchQuery, fzf, sortOption])

	return (
		<>
			<style>
				{`
					.history-item:hover {
						background-color: var(--vscode-list-hoverBackground);
					}
					.delete-button, .export-button, .copy-button {
						opacity: 0;
						pointer-events: none;
					}
					.history-item:hover .delete-button,
					.history-item:hover .export-button,
					.history-item:hover .copy-button {
						opacity: 1;
						pointer-events: auto;
					}
					.history-item-highlight {
						background-color: var(--vscode-editor-findMatchHighlightBackground);
						color: inherit;
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
					.delete-button-container {
						position: relative;
					}
					.delete-menu {
						position: fixed;
						background: var(--vscode-editor-background);
						border: 1px solid var(--vscode-editorGroup-border);
						border-radius: 4px;
						z-index: 1000;
						min-width: 240px;
						box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
						padding: 4px;
					}
					.delete-menu-item {
						display: flex;
						align-items: center;
						gap: 8px;
						padding: 8px 12px;
						color: var(--vscode-foreground);
						cursor: pointer;
						font-size: 13px;
						width: 100%;
						border: none;
						background: none;
						text-align: left;
						border-radius: 3px;
						transition: background-color 0.1s ease;
					}
					.delete-menu-item:hover {
						background: var(--vscode-list-hoverBackground);
					}
					.delete-menu-item .codicon {
						font-size: 14px;
						color: var(--vscode-descriptionForeground);
						flex-shrink: 0;
					}
					.delete-menu::after {
						content: '';
						position: absolute;
						right: 7px;
						top: -4px;
						width: 8px;
						height: 8px;
						background: var(--vscode-editor-background);
						border-left: 1px solid var(--vscode-editorGroup-border);
						border-top: 1px solid var(--vscode-editorGroup-border);
						transform: rotate(45deg);
						z-index: 1;
					}
					.delete-menu[data-placement^='top']::after {
						top: auto;
						bottom: -4px;
						transform: rotate(225deg);
					}
					.delete-menu::before {
						content: '';
						position: absolute;
						top: 0;
						left: 0;
						right: 0;
						height: 4px;
						background: var(--vscode-editor-background);
					}
				`}
			</style>
			{showCopyFeedback && <div className="copy-modal">{String(t("history.preview.promptCopied"))}</div>}
			<div
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "10px 17px 10px 20px",
					}}>
					<h3 style={{ fontWeight: "800", fontSize: 15, margin: 0 }}>{String(t("history.title"))}</h3>
					<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
						<div className="delete-button-container" ref={(node) => setRefs(node, "button")}>
							<VSCodeButton
								appearance="icon"
								onClick={() => {
									setShowDeleteMenu(true)
									update()
								}}>
								<span className="codicon codicon-trash"></span>
							</VSCodeButton>
							{showDeleteMenu &&
								createPortal(
									<div
										className="delete-menu"
										ref={(node) => setRefs(node, "tooltip")}
										data-placement={placement}
										style={floatingStyles}>
										<button
											className="delete-menu-item"
											onClick={handleDeleteThisProjectAllHistory}>
											<i className="codicon codicon-trash"></i>
											<span>Delete This Project All History</span>
										</button>
										<button
											className="delete-menu-item"
											onClick={handleDeleteAllProjectsAllHistory}>
											<i className="codicon codicon-trash"></i>
											<span>Delete All Projects All History</span>
										</button>
									</div>,
									document.body,
								)}
						</div>
						<VSCodeButton onClick={onDone}>{String(t("common.done"))}</VSCodeButton>
					</div>
				</div>
				<div style={{ padding: "5px 17px 6px 17px" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						<VSCodeTextField
							style={{ width: "100%" }}
							placeholder={String(t("history.search.placeholder"))}
							value={searchQuery}
							onInput={(e) => {
								const newValue = (e.target as HTMLInputElement)?.value
								setSearchQuery(newValue)
								if (newValue && !searchQuery && sortOption !== "mostRelevant") {
									setLastNonRelevantSort(sortOption)
									setSortOption("mostRelevant")
								}
							}}>
							<div
								slot="start"
								className="codicon codicon-search"
								style={{ fontSize: 13, marginTop: 2.5, opacity: 0.8 }}></div>
							{searchQuery && (
								<div
									className="input-icon-button codicon codicon-close"
									aria-label={String(t("history.search.clear"))}
									onClick={() => setSearchQuery("")}
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
						<VSCodeRadioGroup
							style={{ display: "flex", flexWrap: "wrap" }}
							value={sortOption}
							role="radiogroup"
							onChange={(e) => setSortOption((e.target as HTMLInputElement).value as SortOption)}>
							<VSCodeRadio value="newest">{String(t("history.sort.newest"))}</VSCodeRadio>
							<VSCodeRadio value="oldest">{String(t("history.sort.oldest"))}</VSCodeRadio>
							<VSCodeRadio value="mostExpensive">{String(t("history.sort.mostExpensive"))}</VSCodeRadio>
							<VSCodeRadio value="mostTokens">{String(t("history.sort.mostTokens"))}</VSCodeRadio>
							<VSCodeRadio
								value="mostRelevant"
								disabled={!searchQuery}
								style={{ opacity: searchQuery ? 1 : 0.5 }}>
								{String(t("history.sort.mostRelevant"))}
							</VSCodeRadio>
						</VSCodeRadioGroup>
					</div>
				</div>
				<div style={{ flexGrow: 1, overflowY: "auto", margin: 0 }}>
					<Virtuoso
						style={{
							flexGrow: 1,
							overflowY: "scroll",
						}}
						data={taskHistorySearchResults}
						data-testid="virtuoso-container"
						components={{
							List: React.forwardRef((props, ref) => (
								<div {...props} ref={ref} data-testid="virtuoso-item-list" />
							)),
						}}
						itemContent={(index, item) => (
							<div
								key={item.id}
								data-testid={`task-item-${item.id}`}
								className="history-item"
								style={{
									cursor: "pointer",
									borderBottom:
										index < taskHistory.length - 1
											? "1px solid var(--vscode-panel-border)"
											: "none",
								}}
								onClick={() => handleHistorySelect(item.id)}>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "8px",
										padding: "12px 20px",
										position: "relative",
									}}>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										}}>
										<span
											style={{
												color: "var(--vscode-descriptionForeground)",
												fontWeight: 500,
												fontSize: "0.85em",
												textTransform: "uppercase",
											}}>
											{formatDate(item.ts)}
										</span>
										<div style={{ display: "flex", gap: "4px" }}>
											<button
												title={String(t("history.preview.copyPrompt"))}
												className="copy-button"
												data-appearance="icon"
												onClick={(e) => copyWithFeedback(item.task, e)}>
												<span className="codicon codicon-copy"></span>
											</button>
											<button
												title="Delete Task"
												className="delete-button"
												data-appearance="icon"
												onClick={(e) => {
													e.stopPropagation()
													handleDeleteHistoryItem(item.id)
												}}>
												<span className="codicon codicon-trash"></span>
											</button>
										</div>
									</div>
									<div
										style={{
											fontSize: "var(--vscode-font-size)",
											color: "var(--vscode-foreground)",
											display: "-webkit-box",
											WebkitLineClamp: 3,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
											whiteSpace: "pre-wrap",
											wordBreak: "break-word",
											overflowWrap: "anywhere",
										}}
										dangerouslySetInnerHTML={{ __html: item.task }}
									/>
									<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
										<div
											data-testid="tokens-container"
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
											}}>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "4px",
													flexWrap: "wrap",
												}}>
												<span
													style={{
														fontWeight: 500,
														color: "var(--vscode-descriptionForeground)",
													}}>
													Tokens:
												</span>
												<span
													data-testid="tokens-in"
													style={{
														display: "flex",
														alignItems: "center",
														gap: "3px",
														color: "var(--vscode-descriptionForeground)",
													}}>
													<i
														className="codicon codicon-arrow-up"
														style={{
															fontSize: "12px",
															fontWeight: "bold",
															marginBottom: "-2px",
														}}
													/>
													{formatLargeNumber(item.tokensIn || 0)}
												</span>
												<span
													data-testid="tokens-out"
													style={{
														display: "flex",
														alignItems: "center",
														gap: "3px",
														color: "var(--vscode-descriptionForeground)",
													}}>
													<i
														className="codicon codicon-arrow-down"
														style={{
															fontSize: "12px",
															fontWeight: "bold",
															marginBottom: "-2px",
														}}
													/>
													{formatLargeNumber(item.tokensOut || 0)}
												</span>
											</div>
											{!item.totalCost && <ExportButton itemId={item.id} />}
										</div>

										{!!item.cacheWrites && (
											<div
												data-testid="cache-container"
												style={{
													display: "flex",
													alignItems: "center",
													gap: "4px",
													flexWrap: "wrap",
												}}>
												<span
													style={{
														fontWeight: 500,
														color: "var(--vscode-descriptionForeground)",
													}}>
													Cache:
												</span>
												<span
													data-testid="cache-writes"
													style={{
														display: "flex",
														alignItems: "center",
														gap: "3px",
														color: "var(--vscode-descriptionForeground)",
													}}>
													<i
														className="codicon codicon-database"
														style={{
															fontSize: "12px",
															fontWeight: "bold",
															marginBottom: "-1px",
														}}
													/>
													+{formatLargeNumber(item.cacheWrites || 0)}
												</span>
												<span
													data-testid="cache-reads"
													style={{
														display: "flex",
														alignItems: "center",
														gap: "3px",
														color: "var(--vscode-descriptionForeground)",
													}}>
													<i
														className="codicon codicon-arrow-right"
														style={{
															fontSize: "12px",
															fontWeight: "bold",
															marginBottom: 0,
														}}
													/>
													{formatLargeNumber(item.cacheReads || 0)}
												</span>
											</div>
										)}
										{!!item.totalCost && (
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
													marginTop: -2,
												}}>
												<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
													<span
														style={{
															fontWeight: 500,
															color: "var(--vscode-descriptionForeground)",
														}}>
														API Cost:
													</span>
													<span style={{ color: "var(--vscode-descriptionForeground)" }}>
														${item.totalCost?.toFixed(4)}
													</span>
												</div>
												<ExportButton itemId={item.id} />
											</div>
										)}
									</div>
								</div>
							</div>
						)}
					/>
				</div>
			</div>
			<ConfirmDialog
				isOpen={showConfirmDialog}
				onClose={() => setShowConfirmDialog(false)}
				onConfirm={() => {
					confirmDialogConfig.onConfirm()
					setShowConfirmDialog(false)
				}}
				title={confirmDialogConfig.title}
				description={confirmDialogConfig.description}
			/>
		</>
	)
}

const ExportButton = ({ itemId }: { itemId: string }) => (
	<VSCodeButton
		className="export-button"
		appearance="icon"
		onClick={(e) => {
			e.stopPropagation()
			vscode.postMessage({ type: "exportTaskWithId", text: itemId })
		}}>
		<div style={{ fontSize: "11px", fontWeight: 500, opacity: 1 }}>EXPORT</div>
	</VSCodeButton>
)

export default memo(HistoryView)
