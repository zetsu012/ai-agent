const mockI18n = {
	t: (key: string) => {
		const translations: { [key: string]: string } = {
			"history.search.placeholder": "Fuzzy search history...",
			"history.sort.newest": "Newest",
			"history.sort.oldest": "Oldest",
			"history.sort.mostExpensive": "Most Expensive",
			"history.sort.mostTokens": "Most Tokens",
			"history.sort.mostRelevant": "Most Relevant",
			"history.preview.promptCopied": "Prompt Copied to Clipboard",
			"mcp.tools.alwaysAllow": "Always allow",
			"mcp.tools.parameters": "Parameters",
		}
		return translations[key] || key
	},
	use: () => mockI18n,
	init: () => Promise.resolve(mockI18n),
	changeLanguage: () => Promise.resolve(),
}

export default mockI18n
export const initReactI18next = {
	type: "3rdParty",
	init: () => {},
}
export const getLanguageCode = (lang: string) => lang
export const getDisplayLanguage = (code: string) => code
