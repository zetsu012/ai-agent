import React from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { useTranslation } from "react-i18next"
import i18n, { getLanguageCode } from "../../utils/i18n"
import { vscode } from "../../utils/vscode"

const LanguageSelector = () => {
	const { preferredLanguage, setPreferredLanguage } = useExtensionState()
	const { t } = useTranslation()

	return (
		<div style={{ marginBottom: "20px" }}>
			<div style={{ marginBottom: "4px" }}>{String(t("prompts.settings.language.title"))}</div>
			<select
				value={preferredLanguage}
				onChange={(e) => {
					const newLanguage = e.target.value
					const langCode = getLanguageCode(newLanguage)
					console.log("Changing language:", { newLanguage, langCode })

					// 更新 React 状态
					setPreferredLanguage(newLanguage)

					// 更新 i18next
					i18n.changeLanguage(langCode)
						.then(() => {
							console.log("Language changed to:", i18n.language)
						})
						.catch((err) => {
							console.error("Failed to change language:", err)
						})

					// 通知 VSCode
					vscode.postMessage({
						type: "preferredLanguage",
						text: newLanguage,
					})
				}}
				style={{
					width: "100%",
					padding: "4px 8px",
					backgroundColor: "var(--vscode-input-background)",
					color: "var(--vscode-input-foreground)",
					border: "1px solid var(--vscode-input-border)",
					borderRadius: "2px",
					height: "28px",
				}}>
				<option value="English">English</option>
				<option value="Simplified Chinese">Simplified Chinese - 简体中文</option>
				<option value="Traditional Chinese">Traditional Chinese - 繁體中文</option>
				<option value="Arabic">Arabic - العربية</option>
				<option value="Brazilian Portuguese">Portuguese - Português (Brasil)</option>
				<option value="Czech">Czech - Čeština</option>
				<option value="French">French - Français</option>
				<option value="German">German - Deutsch</option>
				<option value="Hindi">Hindi - हिन्दी</option>
				<option value="Hungarian">Hungarian - Magyar</option>
				<option value="Italian">Italian - Italiano</option>
				<option value="Japanese">Japanese - 日本語</option>
				<option value="Korean">Korean - 한국어</option>
				<option value="Polish">Polish - Polski</option>
				<option value="Portuguese">Portuguese - Português (Portugal)</option>
				<option value="Russian">Russian - Русский</option>
				<option value="Spanish">Spanish - Español</option>
				<option value="Turkish">Turkish - Türkçe</option>
			</select>
			<p
				style={{
					fontSize: "12px",
					marginTop: "5px",
					color: "var(--vscode-descriptionForeground)",
				}}>
				{String(t("prompts.settings.language.description"))}
			</p>
		</div>
	)
}

export default LanguageSelector
