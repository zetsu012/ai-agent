import fs from "fs/promises"
import { fileExists, PathUtils } from "./CheckpointUtils"

/**
 * CheckpointExclusions 模块
 *
 * 管理 checkpoint 跟踪过程中的文件排除规则。提供：
 *
 * 文件过滤：
 * - 文件类型（构建产物、媒体、缓存文件等）
 * - Git LFS 模式
 * - 环境和配置文件
 * - 临时和缓存文件
 *
 * 模式管理：
 * - 基于类别的可扩展模式系统
 * - 全面的文件类型覆盖
 * - 简单的模式更新和维护
 *
 * Git 集成：
 * - 与 Git 的排除机制无缝集成
 * - 支持工作区特定的 LFS 模式
 * - 在 checkpoint 期间自动更新模式
 */

// 用于临时禁用嵌套 Git 仓库的后缀
export const GIT_DISABLED_SUFFIX = ".disabled"

/**
 * 返回要从 checkpoints 中排除的文件和目录模式的默认列表。
 * 将内置模式与工作区特定的 LFS 模式结合起来。
 *
 * @param lfsPatterns - 可选的工作区 Git LFS 模式数组
 * @returns 要排除的 glob 模式数组
 */
export const getDefaultExclusions = (lfsPatterns: string[] = []): string[] => [
	// 构建和开发产物
	".git/",
	`.git${GIT_DISABLED_SUFFIX}/`,
	...getBuildArtifactPatterns(),

	// 媒体文件
	...getMediaFilePatterns(),

	// 缓存和临时文件
	...getCacheFilePatterns(),

	// 环境和配置文件
	...getConfigFilePatterns(),

	// 大型数据文件
	...getLargeDataFilePatterns(),

	// 数据库文件
	...getDatabaseFilePatterns(),

	// 日志文件
	...getLogFilePatterns(),

	...lfsPatterns,
]

/**
 * 返回常见构建和开发产物目录的模式
 * @returns 构建产物的 glob 模式数组
 */
function getBuildArtifactPatterns(): string[] {
	return [
		".gradle/",
		".idea/",
		".parcel-cache/",
		".pytest_cache/",
		".next/",
		".nuxt/",
		".sass-cache/",
		".vs/",
		".vscode/",
		"Pods/",
		"__pycache__/",
		"bin/",
		"build/",
		"bundle/",
		"coverage/",
		"deps/",
		"dist/",
		"env/",
		"node_modules/",
		"obj/",
		"out/",
		"pkg/",
		"pycache/",
		"target/",
		"venv/",
	]
}

/**
 * 返回媒体文件的模式
 * @returns 媒体文件的 glob 模式数组
 */
function getMediaFilePatterns(): string[] {
	return [
		"*.mp4",
		"*.mov",
		"*.avi",
		"*.wmv",
		"*.flv",
		"*.webm",
		"*.mkv",
		"*.mp3",
		"*.wav",
		"*.ogg",
		"*.flac",
		"*.aac",
		"*.psd",
		"*.ai",
		"*.indd",
		"*.eps",
		"*.tiff",
		"*.tif",
		"*.raw",
		"*.cr2",
		"*.nef",
		"*.orf",
		"*.sr2",
	]
}

/**
 * 返回缓存和临时文件的模式
 * @returns 缓存文件的 glob 模式数组
 */
function getCacheFilePatterns(): string[] {
	return [
		"*.cache",
		"*.tmp",
		"*.temp",
		"*.swp",
		"*.swo",
		"*.bak",
		"*.backup",
		"*~",
		"Thumbs.db",
		".DS_Store",
		".Spotlight-V100",
		".Trashes",
		"ehthumbs.db",
		"desktop.ini",
	]
}

/**
 * 返回环境和配置文件的模式
 * @returns 配置文件的 glob 模式数组
 */
function getConfigFilePatterns(): string[] {
	return [".env", ".env.*", "*.pem", "*.key", "*.crt", "*.cert"]
}

/**
 * 返回大型数据文件的模式
 * @returns 大型数据文件的 glob 模式数组
 */
function getLargeDataFilePatterns(): string[] {
	return [
		"*.zip",
		"*.tar",
		"*.tar.gz",
		"*.tgz",
		"*.tar.bz2",
		"*.tbz2",
		"*.7z",
		"*.rar",
		"*.iso",
		"*.dmg",
		"*.csv",
		"*.tsv",
		"*.parquet",
		"*.avro",
		"*.orc",
	]
}

/**
 * 返回数据库文件的模式
 * @returns 数据库文件的 glob 模式数组
 */
function getDatabaseFilePatterns(): string[] {
	return ["*.db", "*.sqlite", "*.sqlite3", "*.mdb", "*.accdb", "*.frm", "*.ibd", "*.myd", "*.myi", "*.pdb"]
}

/**
 * 返回日志文件的模式
 * @returns 日志文件的 glob 模式数组
 */
function getLogFilePatterns(): string[] {
	return ["*.log", "logs/", "log/"]
}

/**
 * 将排除模式写入 Git 排除文件
 * @param gitPath - .git 目录的路径
 * @param lfsPatterns - 可选的 LFS 模式数组
 */
export const writeExcludesFile = async (gitPath: string, lfsPatterns: string[] = []): Promise<void> => {
	const excludesPath = PathUtils.joinPath(gitPath, "info", "exclude")
	const excludes = getDefaultExclusions(lfsPatterns).join("\n")

	try {
		await fs.mkdir(PathUtils.joinPath(gitPath, "info"), { recursive: true })
		await fs.writeFile(excludesPath, excludes)
	} catch (error) {
		console.error("写入排除文件失败:", error)
	}
}

/**
 * 从工作区获取 Git LFS 模式
 * @param workspacePath - 工作区路径
 * @returns LFS 模式数组
 */
export const getLfsPatterns = async (workspacePath: string): Promise<string[]> => {
	const lfsAttributesPath = PathUtils.joinPath(workspacePath, ".gitattributes")

	if (await fileExists(lfsAttributesPath)) {
		try {
			const content = await fs.readFile(lfsAttributesPath, "utf-8")
			return content
				.split("\n")
				.filter((line) => line.includes("filter=lfs"))
				.map((line) => line.split(" ")[0].trim())
		} catch (error) {
			console.error("读取 .gitattributes 失败:", error)
		}
	}

	return []
}
