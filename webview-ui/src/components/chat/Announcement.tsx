import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
// import VSCodeButtonLink from "./VSCodeButtonLink"
// import { getOpenRouterAuthUrl } from "./ApiOptions"
// import { vscode } from "../utils/vscode"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
}
/*
You must update the latestAnnouncementId in CoolClineProvider for new announcements to show to users. This new id will be compared with whats in state for the 'last announcement shown', and if it's different then the announcement will render. As soon as an announcement is shown, the id will be updated in state. This ensures that announcements are not shown more than once, even if the user doesn't close it themselves.
*/
const Announcement = ({ version, hideAnnouncement }: AnnouncementProps) => {
	const { t } = useTranslation()
	return (
		<div
			style={{
				padding: "0 20px",
				marginBottom: "20px",
				flexShrink: 0,
			}}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
					gap: "10px",
				}}>
				<h2 style={{ margin: "0 0 8px" }}>
					{String(t("chat.announcement.title"))} {version}
				</h2>
				<VSCodeButton
					appearance="icon"
					onClick={hideAnnouncement}
					style={{ padding: "3px", flexShrink: 0, height: "24px" }}>
					<span className="codicon codicon-close"></span>
				</VSCodeButton>
			</div>

			<h3 style={{ margin: "12px 0 8px" }}>{String(t("chat.announcement.customization.title"))}</h3>
			<p style={{ margin: "5px 0px" }}>
				{String(t("chat.announcement.customization.description"))}
				<ul style={{ margin: "4px 0 6px 20px", padding: 0 }}>
					<li>{String(t("chat.announcement.customization.examples.qa"))}</li>
					<li>{String(t("chat.announcement.customization.examples.pm"))}</li>
					<li>{String(t("chat.announcement.customization.examples.ui"))}</li>
					<li>{String(t("chat.announcement.customization.examples.reviewer"))}</li>
				</ul>
				{String(t("chat.announcement.customization.getStarted"))}
			</p>

			<h3 style={{ margin: "12px 0 8px" }}>{String(t("chat.announcement.join.title"))}</h3>
			<p style={{ margin: "5px 0px" }}>
				{String(t("chat.announcement.join.description"))}{" "}
				<VSCodeLink href="https://www.reddit.com/r/CoolCline" style={{ display: "inline" }}>
					reddit.com/r/CoolCline
				</VSCodeLink>
				.
			</p>
		</div>
	)
}

export default memo(Announcement)
