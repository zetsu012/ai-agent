import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { validateApiConfiguration } from "../../utils/validate"
import { vscode } from "../../utils/vscode"
import ApiOptions from "../settings/ApiOptions"
import { useTranslation } from "react-i18next"
import LanguageSelector from "../common/LanguageSelector"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"

const WelcomeView = () => {
	const { apiConfiguration } = useExtensionState()
	const { t } = useTranslation()

	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [showErrorDialog, setShowErrorDialog] = useState(false)

	const disableLetsGoButton = (apiErrorMessage !== null && apiErrorMessage !== undefined) || !apiConfiguration?.apiKey

	const handleSubmit = () => {
		const errorMsg = validateApiConfiguration(apiConfiguration)
		if (errorMsg) {
			setApiErrorMessage(errorMsg)
			setShowErrorDialog(true)
			return
		}
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration })
	}

	useEffect(() => {
		setApiErrorMessage(validateApiConfiguration(apiConfiguration))
	}, [apiConfiguration])

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				padding: "0 20px",
			}}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "10px 17px 10px 20px",
				}}>
				<h3 style={{ fontWeight: "800", fontSize: 15, margin: 0 }}>{String(t("welcome.title"))}</h3>
				<VSCodeButton onClick={handleSubmit}>{String(t("welcome.letsGo"))}</VSCodeButton>
			</div>
			<p>
				{String(t("welcome.description"))} {String(t("welcome.readmeLink"))}
				{":"}
				<VSCodeLink
					href="https://github.com/coolcline/coolcline/blob/main/docs/user-docs/en/index.md"
					style={{ display: "inline" }}>
					en
				</VSCodeLink>
				{"|"}
				<VSCodeLink
					href="https://gitee.com/coolcline/coolcline/blob/main/docs/user-docs/zh/index.md"
					style={{ display: "inline" }}>
					简体中文
				</VSCodeLink>
			</p>

			<LanguageSelector />

			<b>{String(t("welcome.llmProviderNeeded"))}</b>

			<div style={{ marginTop: "10px" }}>
				<ApiOptions />
			</div>

			<Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
				<DialogContent className="w-[90%] sm:w-[400px]">
					<DialogHeader>
						<DialogTitle>{String(t("common.status.error"))}</DialogTitle>
					</DialogHeader>
					<div className="text-destructive">{apiErrorMessage}</div>
					<div className="flex justify-end mt-4">
						<VSCodeButton onClick={() => setShowErrorDialog(false)}>
							{String(t("common.cancel"))}
						</VSCodeButton>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default WelcomeView
