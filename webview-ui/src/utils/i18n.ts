import i18n from "i18next"
import { initReactI18next } from "react-i18next"

// 导入语言资源
import en from "../../../assets/i18n/en.json"
import zhCN from "../../../assets/i18n/zh.json"
import zhTW from "../../../assets/i18n/zh-TW.json"
import ja from "../../../assets/i18n/ja.json"
import ko from "../../../assets/i18n/ko.json"
import ar from "../../../assets/i18n/ar.json"
import ptBR from "../../../assets/i18n/pt-BR.json"
import cs from "../../../assets/i18n/cs.json"
import fr from "../../../assets/i18n/fr.json"
import de from "../../../assets/i18n/de.json"
import hi from "../../../assets/i18n/hi.json"
import hu from "../../../assets/i18n/hu.json"
import it from "../../../assets/i18n/it.json"
import pl from "../../../assets/i18n/pl.json"
import pt from "../../../assets/i18n/pt.json"
import ru from "../../../assets/i18n/ru.json"
import es from "../../../assets/i18n/es.json"
import tr from "../../../assets/i18n/tr.json"

declare module "i18next" {
	interface CustomTypeOptions {
		resources: {
			en: typeof en
			"zh-CN": typeof zhCN
			"zh-TW": typeof zhTW
			ja: typeof ja
			ko: typeof ko
			ar: typeof ar
			"pt-BR": typeof ptBR
			cs: typeof cs
			fr: typeof fr
			de: typeof de
			hi: typeof hi
			hu: typeof hu
			it: typeof it
			pl: typeof pl
			pt: typeof pt
			ru: typeof ru
			es: typeof es
			tr: typeof tr
		}
	}
}

// 获取初始语言设置
function getInitialLanguage(): string {
	try {
		// 尝试从 vscode-state 元数据中获取语言设置
		const stateElement = document.querySelector('meta[name="vscode-state"]')
		if (stateElement) {
			const state = JSON.parse(decodeURIComponent(stateElement.getAttribute("content") || "{}"))
			if (state.preferredLanguage) {
				// console.log("Found initial language in vscode state:", state.preferredLanguage)
				return state.preferredLanguage
			}
		}
	} catch (error) {
		console.warn("Failed to get initial language from vscode state:", error)
	}

	// console.log("Using default language: English")
	return "English"
}

// 语言代码映射
const languageMap: { [key: string]: string } = {
	English: "en",
	"Simplified Chinese": "zh-CN",
	"Traditional Chinese": "zh-TW",
	"中文（简体）": "zh-CN",
	"中文（繁體）": "zh-TW",
	Japanese: "ja",
	日本語: "ja",
	Korean: "ko",
	한국어: "ko",
	Arabic: "ar",
	العربية: "ar",
	"Brazilian Portuguese": "pt-BR",
	"Português (Brasil)": "pt-BR",
	Czech: "cs",
	Čeština: "cs",
	French: "fr",
	Français: "fr",
	German: "de",
	Deutsch: "de",
	Hindi: "hi",
	हिन्दी: "hi",
	Hungarian: "hu",
	Magyar: "hu",
	Italian: "it",
	Italiano: "it",
	Polish: "pl",
	Polski: "pl",
	Portuguese: "pt",
	Português: "pt",
	Russian: "ru",
	Русский: "ru",
	Spanish: "es",
	Español: "es",
	Turkish: "tr",
	Türkçe: "tr",
	en: "en",
	"zh-CN": "zh-CN",
	"zh-TW": "zh-TW",
	ja: "ja",
	ko: "ko",
	ar: "ar",
	"pt-BR": "pt-BR",
	cs: "cs",
	fr: "fr",
	de: "de",
	hi: "hi",
	hu: "hu",
	it: "it",
	pl: "pl",
	pt: "pt",
	ru: "ru",
	es: "es",
	tr: "tr",
}

// 显示名称映射
const displayMap: { [key: string]: string } = {
	en: "English",
	"zh-CN": "中文（简体）",
	"zh-TW": "中文（繁體）",
	ja: "日本語",
	ko: "한국어",
	ar: "العربية",
	"pt-BR": "Português (Brasil)",
	cs: "Čeština",
	fr: "Français",
	de: "Deutsch",
	hi: "हिन्दी",
	hu: "Magyar",
	it: "Italiano",
	pl: "Polski",
	pt: "Português",
	ru: "Русский",
	es: "Español",
	tr: "Türkçe",
	English: "English",
	"Simplified Chinese": "中文（简体）",
	"Traditional Chinese": "中文（繁體）",
	Japanese: "日本語",
	Korean: "한국어",
	Arabic: "العربية",
	"Brazilian Portuguese": "Português (Brasil)",
	Czech: "Čeština",
	French: "Français",
	German: "Deutsch",
	Hindi: "हिन्दी",
	Hungarian: "Magyar",
	Italian: "Italiano",
	Polish: "Polski",
	Portuguese: "Português",
	Russian: "Русский",
	Spanish: "Español",
	Turkish: "Türkçe",
}

// 获取语言代码
export function getLanguageCode(language: string): string {
	const code = languageMap[language]
	if (!code) {
		console.warn(`Unknown language: ${language}, falling back to English`)
		return "en"
	}
	return code
}

// 获取显示语言名称
export function getDisplayLanguage(code: string): string {
	return displayMap[code] || "English"
}

// 初始化 i18next
const initialLanguage = getInitialLanguage()
const langCode = getLanguageCode(initialLanguage)

// console.log("Initializing i18n with language:", { initialLanguage, langCode })

const i18nInstance = i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		"zh-CN": { translation: zhCN },
		"zh-TW": { translation: zhTW },
		ja: { translation: ja },
		ko: { translation: ko },
		ar: { translation: ar },
		"pt-BR": { translation: ptBR },
		cs: { translation: cs },
		fr: { translation: fr },
		de: { translation: de },
		hi: { translation: hi },
		hu: { translation: hu },
		it: { translation: it },
		pl: { translation: pl },
		pt: { translation: pt },
		ru: { translation: ru },
		es: { translation: es },
		tr: { translation: tr },
	},
	lng: langCode,
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
	debug: true,
})

// 切换语言
export async function changeLanguage(language: string): Promise<string | null> {
	// console.log("Changing language to:", language)
	const langCode = getLanguageCode(language)

	if (!langCode) {
		console.warn(`Invalid language code for: ${language}`)
		return null
	}

	if (!i18n.languages.includes(langCode)) {
		console.warn(`Language ${langCode} is not loaded`)
		return null
	}

	try {
		await i18n.changeLanguage(langCode)
		// console.log("Language successfully changed to:", langCode)
		return langCode
	} catch (error) {
		console.error("Failed to change language:", error)
		return null
	}
}

// 初始化语言设置
export async function initializeLanguage(preferredLanguage?: string): Promise<void> {
	// console.log("Initializing language with preferred language:", preferredLanguage)

	if (!preferredLanguage) {
		// console.log("No preferred language provided, using default")
		return
	}

	const result = await changeLanguage(preferredLanguage)
	if (result) {
		// console.log("Language initialized successfully to:", result)
	} else {
		console.warn("Failed to initialize language, using default")
	}
}

export default i18n
