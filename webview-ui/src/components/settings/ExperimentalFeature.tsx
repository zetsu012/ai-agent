import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"

interface ExperimentalFeatureProps {
	name: string
	description: string
	enabled: boolean
	onChange: (enabled: boolean) => void
}

const ExperimentalFeature = ({ name, description, enabled, onChange }: ExperimentalFeatureProps) => {
	const { t } = useTranslation()

	return (
		<div
			style={{
				marginTop: 10,
				paddingLeft: 10,
				borderLeft: "2px solid var(--vscode-button-background)",
			}}>
			<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
				<span style={{ color: "var(--vscode-errorForeground)" }}>⚠️</span>
				<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
					<span style={{ fontWeight: "500" }}>{t(name).toString()}</span>
				</VSCodeCheckbox>
			</div>
			<p
				style={{
					fontSize: "12px",
					marginBottom: 15,
					color: "var(--vscode-descriptionForeground)",
				}}>
				{t(description).toString()}
			</p>
		</div>
	)
}

export default ExperimentalFeature
