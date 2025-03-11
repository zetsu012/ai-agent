import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface TemperatureControlProps {
	value: number | undefined
	onChange: (value: number | undefined) => void
	maxValue?: number // Some providers like OpenAI use 0-2 range
}

export const TemperatureControl = ({ value, onChange, maxValue = 1 }: TemperatureControlProps) => {
	const { t } = useTranslation()
	const [isCustomTemperature, setIsCustomTemperature] = useState(value !== undefined)

	// Sync internal state with prop changes when switching profiles
	useEffect(() => {
		const hasCustomTemperature = value !== undefined
		setIsCustomTemperature(hasCustomTemperature)
	}, [value])

	return (
		<div
			style={{
				marginTop: 10,
				marginBottom: 15,
				paddingLeft: 0,
				// borderLeft: "2px solid var(--vscode-button-background)", // 类似引用效果
			}}>
			<VSCodeCheckbox
				checked={isCustomTemperature}
				onChange={(e: any) => {
					const isChecked = e.target.checked
					setIsCustomTemperature(isChecked)
					if (!isChecked) {
						onChange(undefined) // Reset to provider default
					} else if (value !== undefined) {
						onChange(value) // Use the value from apiConfiguration, if set
					}
				}}>
				<span>{t("settings.provider.temperature.title")}</span>
			</VSCodeCheckbox>

			<p style={{ fontSize: "12px", marginTop: "5px", color: "var(--vscode-descriptionForeground)" }}>
				{t("settings.provider.temperature.description")}
			</p>

			{isCustomTemperature && (
				<div style={{ marginTop: "15px" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<input
							type="range"
							min="0"
							max={maxValue}
							step="0.05"
							value={value ?? 0.0}
							onChange={(e) => {
								const newValue = parseFloat(e.target.value)
								onChange(isNaN(newValue) ? undefined : newValue)
							}}
							style={{
								flexGrow: 1,
								accentColor: "var(--vscode-button-background)",
								height: "2px",
							}}
						/>
						<span
							style={{
								minWidth: "45px",
								textAlign: "left",
								color: "var(--vscode-descriptionForeground)",
							}}>
							{value?.toFixed(2) ?? "0.00"}
						</span>
					</div>
				</div>
			)}
		</div>
	)
}
