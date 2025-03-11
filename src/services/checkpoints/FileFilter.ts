import fs from "fs/promises"
import { existsSync } from "fs"
import { PathUtils } from "./CheckpointUtils"
import ignore from "ignore"

/**
 * 文件过滤配置
 */
export interface FileFilterConfig {
	// 最大文件大小（字节）
	maxFileSize: number

	// 默认排除的文件模式
	defaultExcludes: string[]

	// LFS 文件模式
	lfsPatterns: string[]

	// TODO: 后续通过 UI 配置的自定义规则
	// customRules?: string[];
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FileFilterConfig = {
	maxFileSize: 100 * 1024 * 1024, // 100MB
	defaultExcludes: [
		// 构建输出
		"build/",
		"dist/",
		"out/",
		"target/",

		// 依赖目录
		"node_modules/",
		"vendor/",
		".venv/",
		"venv/",

		// IDE 和编辑器
		".idea/",
		".vscode/",
		"*.swp",
		"*.swo",

		// 临时文件
		"*.tmp",
		"*.temp",
		"*.log",

		// 媒体文件
		"*.jpg",
		"*.jpeg",
		"*.png",
		"*.gif",
		"*.mp4",
		"*.mov",

		// 压缩文件
		"*.zip",
		"*.tar",
		"*.gz",
		"*.rar",

		// 二进制文件
		"*.exe",
		"*.dll",
		"*.so",
		"*.dylib",

		// 数据库文件
		"*.db",
		"*.sqlite",

		// 其他
		".DS_Store",
		"Thumbs.db",
	],
	lfsPatterns: [],
}

/**
 * 文件过滤器
 * 负责处理文件过滤和大文件处理
 */
export class FileFilter {
	private readonly config: FileFilterConfig
	private readonly ignorer: ReturnType<typeof ignore>
	private readonly workspaceRoot: string

	constructor(workspaceRoot: string, config: Partial<FileFilterConfig> = {}) {
		this.workspaceRoot = workspaceRoot
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.ignorer = ignore().add(this.config.defaultExcludes)
	}

	/**
	 * 检查文件是否应该被排除
	 */
	async shouldExclude(filePath: string): Promise<boolean> {
		try {
			// 规范化路径
			const normalizedPath = PathUtils.normalizePath(filePath)
			const relativePath = PathUtils.relativePath(this.workspaceRoot, normalizedPath)

			// 检查是否匹配排除规则
			if (this.ignorer.ignores(relativePath)) {
				return true
			}

			// 检查文件大小
			try {
				const stats = await fs.stat(filePath)
				if (stats.size > this.config.maxFileSize) {
					return true
				}
			} catch (error) {
				// 如果文件不存在，不排除
				return false
			}

			// 检查是否是 LFS 文件
			if (
				this.config.lfsPatterns.some((pattern) => {
					return ignore().add(pattern).ignores(relativePath)
				})
			) {
				return true
			}

			return false
		} catch (error) {
			console.error("检查文件过滤失败:", error)
			return false
		}
	}

	/**
	 * 获取工作区中所有不被排除的文件
	 */
	async getIncludedFiles(): Promise<string[]> {
		const allFiles = await this.getAllFiles(this.workspaceRoot)
		const result: string[] = []

		for (const file of allFiles) {
			if (!(await this.shouldExclude(file))) {
				result.push(file)
			}
		}

		return result
	}

	/**
	 * 递归获取目录下的所有文件
	 */
	private async getAllFiles(dir: string): Promise<string[]> {
		const result: string[] = []

		try {
			const entries = await fs.readdir(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = PathUtils.joinPath(dir, entry.name)

				if (entry.isDirectory()) {
					const subFiles = await this.getAllFiles(fullPath)
					result.push(...subFiles)
				} else {
					result.push(fullPath)
				}
			}
		} catch (error) {
			console.error("获取目录文件失败:", error)
		}

		return result
	}

	/**
	 * 检查文件是否是大文件
	 */
	async isLargeFile(filePath: string): Promise<boolean> {
		try {
			const stats = await fs.stat(filePath)
			return stats.size > this.config.maxFileSize
		} catch (error) {
			return false
		}
	}

	/**
	 * 添加 LFS 模式
	 */
	addLfsPattern(pattern: string): void {
		this.config.lfsPatterns.push(pattern)
	}

	/**
	 * 获取当前配置
	 */
	getConfig(): FileFilterConfig {
		return { ...this.config }
	}
}
