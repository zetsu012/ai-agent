import {
	VSCodeButton,
	VSCodeCheckbox,
	VSCodeLink,
	VSCodePanels,
	VSCodePanelTab,
	VSCodePanelView,
} from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { vscode } from "../../utils/vscode"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { McpServer } from "../../../../src/shared/mcp"
import McpToolRow from "./McpToolRow"
import McpResourceRow from "./McpResourceRow"
import McpEnabledToggle from "./McpEnabledToggle"
import { useTranslation } from "react-i18next"

type McpViewProps = {
	onDone: () => void
}

const McpView = ({ onDone }: McpViewProps) => {
	const {
		mcpServers: servers,
		alwaysAllowMcp,
		mcpEnabled,
		enableMcpServerCreation,
		setEnableMcpServerCreation,
	} = useExtensionState()

	const { t } = useTranslation()

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: "flex",
				flexDirection: "column",
			}}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "10px 17px 10px 20px",
				}}>
				<h3 style={{ fontWeight: "800", fontSize: 15, margin: 0 }}>{String(t("mcp.title"))}</h3>
				<VSCodeButton onClick={onDone}>{String(t("common.done"))}</VSCodeButton>
			</div>

			<div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
				<div
					style={{
						color: "var(--vscode-foreground)",
						fontSize: "13px",
						marginBottom: "10px",
						marginTop: "5px",
					}}>
					<>
						<VSCodeLink href="https://github.com/modelcontextprotocol" style={{ display: "inline" }}>
							{String(t("mcp.modelContextProtocol"))}
						</VSCodeLink>
						{String(t("mcp.description.part1"))}
						<VSCodeLink
							href="https://github.com/modelcontextprotocol/servers"
							style={{ display: "inline" }}>
							{String(t("mcp.communityServers"))}
						</VSCodeLink>
						{String(t("mcp.description.part2"))}
					</>
				</div>

				<McpEnabledToggle />

				{mcpEnabled && (
					<>
						<div style={{ marginBottom: 15 }}>
							<VSCodeCheckbox
								checked={enableMcpServerCreation}
								onChange={(e: any) => {
									setEnableMcpServerCreation(e.target.checked)
									vscode.postMessage({ type: "enableMcpServerCreation", bool: e.target.checked })
								}}>
								<span style={{ fontWeight: "500" }}>{String(t("mcp.serverCreation.title"))}</span>
							</VSCodeCheckbox>
							<p
								style={{
									fontSize: "12px",
									marginTop: "5px",
									color: "var(--vscode-descriptionForeground)",
								}}>
								{String(t("mcp.serverCreation.description"))}
							</p>
						</div>

						{/* Server List */}
						{servers.length > 0 && (
							<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
								{servers.map((server) => (
									<ServerRow key={server.name} server={server} alwaysAllowMcp={alwaysAllowMcp} />
								))}
							</div>
						)}

						{/* Edit Settings Button */}
						<div style={{ marginTop: "10px", width: "100%" }}>
							<VSCodeButton
								appearance="secondary"
								style={{ width: "100%" }}
								onClick={() => {
									vscode.postMessage({ type: "openMcpSettings" })
								}}>
								<span className="codicon codicon-edit" style={{ marginRight: "6px" }}></span>
								{String(t("mcp.editSettings"))}
							</VSCodeButton>
						</div>
					</>
				)}

				{/* Bottom padding */}
				<div style={{ height: "20px" }} />
			</div>
		</div>
	)
}

// Server Row Component
const ServerRow = ({ server, alwaysAllowMcp }: { server: McpServer; alwaysAllowMcp?: boolean }) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const [timeoutValue, setTimeoutValue] = useState(() => {
		const configTimeout = JSON.parse(server.config)?.timeout
		return configTimeout ?? 60 // Default 1 minute (60 seconds)
	})

	const { t } = useTranslation()

	const timeoutOptions = [
		{ value: 15, label: t("mcp.timeout.15") },
		{ value: 30, label: t("mcp.timeout.30") },
		{ value: 60, label: t("mcp.timeout.60") },
		{ value: 300, label: t("mcp.timeout.300") },
		{ value: 600, label: t("mcp.timeout.600") },
		{ value: 900, label: t("mcp.timeout.900") },
		{ value: 1800, label: t("mcp.timeout.1800") },
		{ value: 3600, label: t("mcp.timeout.3600") },
	]

	const getStatusColor = () => {
		switch (server.status) {
			case "connected":
				return "var(--vscode-testing-iconPassed)"
			case "connecting":
				return "var(--vscode-charts-yellow)"
			case "disconnected":
				return "var(--vscode-testing-iconFailed)"
		}
	}

	const handleRowClick = () => {
		if (!server.error) {
			setIsExpanded(!isExpanded)
		}
	}

	const handleRestart = () => {
		vscode.postMessage({
			type: "restartMcpServer",
			text: server.name,
		})
	}

	const handleTimeoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const seconds = parseInt(event.target.value)
		setTimeoutValue(seconds)
		vscode.postMessage({
			type: "updateMcpTimeout",
			serverName: server.name,
			timeout: seconds,
		})
	}

	return (
		<div style={{ marginBottom: "10px" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					padding: "8px",
					background: "var(--vscode-textCodeBlock-background)",
					cursor: server.error ? "default" : "pointer",
					borderRadius: isExpanded || server.error ? "4px 4px 0 0" : "4px",
					opacity: server.disabled ? 0.6 : 1,
				}}
				onClick={handleRowClick}>
				{!server.error && (
					<span
						className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
						style={{ marginRight: "8px" }}
					/>
				)}
				<span style={{ flex: 1 }}>{server.name}</span>
				<div
					style={{ display: "flex", alignItems: "center", marginRight: "8px" }}
					onClick={(e) => e.stopPropagation()}>
					<VSCodeButton
						appearance="icon"
						onClick={handleRestart}
						disabled={server.status === "connecting"}
						style={{ marginRight: "8px" }}>
						<span className="codicon codicon-refresh" style={{ fontSize: "14px" }}></span>
					</VSCodeButton>
					<div
						role="switch"
						aria-checked={!server.disabled}
						tabIndex={0}
						style={{
							width: "20px",
							height: "10px",
							backgroundColor: server.disabled
								? "var(--vscode-titleBar-inactiveForeground)"
								: "var(--vscode-button-background)",
							borderRadius: "5px",
							position: "relative",
							cursor: "pointer",
							transition: "background-color 0.2s",
							opacity: server.disabled ? 0.4 : 0.8,
						}}
						onClick={() => {
							vscode.postMessage({
								type: "toggleMcpServer",
								serverName: server.name,
								disabled: !server.disabled,
							})
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault()
								vscode.postMessage({
									type: "toggleMcpServer",
									serverName: server.name,
									disabled: !server.disabled,
								})
							}
						}}>
						<div
							style={{
								width: "6px",
								height: "6px",
								backgroundColor: "var(--vscode-titleBar-activeForeground)",
								borderRadius: "50%",
								position: "absolute",
								top: "2px",
								left: server.disabled ? "2px" : "12px",
								transition: "left 0.2s",
							}}
						/>
					</div>
				</div>
				<div
					style={{
						width: "8px",
						height: "8px",
						borderRadius: "50%",
						background: getStatusColor(),
						marginLeft: "8px",
					}}
				/>
			</div>

			{server.error ? (
				<div
					style={{
						fontSize: "13px",
						background: "var(--vscode-textCodeBlock-background)",
						borderRadius: "0 0 4px 4px",
						width: "100%",
					}}>
					<div
						style={{
							color: "var(--vscode-testing-iconFailed)",
							marginBottom: "8px",
							padding: "0 10px",
							overflowWrap: "break-word",
							wordBreak: "break-word",
						}}>
						{server.error}
					</div>
					<VSCodeButton
						appearance="secondary"
						onClick={handleRestart}
						disabled={server.status === "connecting"}
						style={{ width: "calc(100% - 20px)", margin: "0 10px 10px 10px" }}>
						{server.status === "connecting"
							? String(t("mcp.server.retrying"))
							: String(t("mcp.server.retry"))}
					</VSCodeButton>
				</div>
			) : (
				isExpanded && (
					<div
						style={{
							background: "var(--vscode-textCodeBlock-background)",
							padding: "0 10px 10px 10px",
							fontSize: "13px",
							borderRadius: "0 0 4px 4px",
						}}>
						<VSCodePanels style={{ marginBottom: "10px" }}>
							<VSCodePanelTab id="tools">
								{String(t("mcp.tools.title"))} ({server.tools?.length || 0})
							</VSCodePanelTab>
							<VSCodePanelTab id="resources">
								{String(t("mcp.resources.title"))} (
								{[...(server.resourceTemplates || []), ...(server.resources || [])].length || 0})
							</VSCodePanelTab>

							<VSCodePanelView id="tools-view">
								{server.tools && server.tools.length > 0 ? (
									<div
										style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
										{server.tools.map((tool) => (
											<McpToolRow
												key={tool.name}
												tool={tool}
												serverName={server.name}
												alwaysAllowMcp={alwaysAllowMcp}
											/>
										))}
									</div>
								) : (
									<div style={{ padding: "10px 0", color: "var(--vscode-descriptionForeground)" }}>
										{String(t("mcp.tools.noTools"))}
									</div>
								)}
							</VSCodePanelView>

							<VSCodePanelView id="resources-view">
								{(server.resources && server.resources.length > 0) ||
								(server.resourceTemplates && server.resourceTemplates.length > 0) ? (
									<div
										style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
										{[...(server.resourceTemplates || []), ...(server.resources || [])].map(
											(item) => (
												<McpResourceRow
													key={"uriTemplate" in item ? item.uriTemplate : item.uri}
													item={item}
												/>
											),
										)}
									</div>
								) : (
									<div style={{ padding: "10px 0", color: "var(--vscode-descriptionForeground)" }}>
										{String(t("mcp.resources.noResources"))}
									</div>
								)}
							</VSCodePanelView>
						</VSCodePanels>

						{/* Network Timeout */}
						<div style={{ padding: "10px 7px" }}>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "10px",
									marginBottom: "8px",
								}}>
								<span>{String(t("mcp.timeout.title"))}</span>
								<select
									value={timeoutValue}
									onChange={handleTimeoutChange}
									style={{
										flex: 1,
										padding: "4px",
										background: "var(--vscode-dropdown-background)",
										color: "var(--vscode-dropdown-foreground)",
										border: "1px solid var(--vscode-dropdown-border)",
										borderRadius: "2px",
										outline: "none",
										cursor: "pointer",
									}}>
									{timeoutOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
							<span
								style={{
									fontSize: "12px",
									color: "var(--vscode-descriptionForeground)",
									display: "block",
								}}>
								{String(t("mcp.timeout.description"))}
							</span>
						</div>
					</div>
				)
			)}
		</div>
	)
}

export default McpView
