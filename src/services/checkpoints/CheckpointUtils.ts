import { mkdir } from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import os from "os"
import crypto from "crypto"
import { arePathsEqual as pathsAreEqual, toPosixPath as convertToPosixPath } from "../../utils/path"

/**
 * 路径工具类
 * 处理所有路径相关的操作，确保跨平台兼容性
 */
class PathUtils {
	/**
	 * 将路径转换为 POSIX 格式
	 * Windows 上将反斜杠转换为正斜杠
	 */
	static toPosixPath(filePath: string): string {
		return convertToPosixPath(filePath)
	}

	/**
	 * 规范化路径并转换为 POSIX 格式
	 */
	static normalizePath(filePath: string): string {
		// normalize 解析 ./.. 段，删除重复的斜杠，标准化路径分隔符
		let normalized = path.normalize(filePath)
		// 删除尾部斜杠（除了根路径）
		if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
			normalized = normalized.slice(0, -1)
		}
		return this.toPosixPath(normalized)
	}

	/**
	 * 比较两个路径是否相同（跨平台兼容）
	 */
	static pathsEqual(path1: string, path2: string): boolean {
		return pathsAreEqual(path1, path2)
	}

	/**
	 * 连接路径片段（跨平台兼容）
	 */
	static joinPath(...paths: string[]): string {
		return this.toPosixPath(path.join(...paths))
	}

	/**
	 * 获取相对路径（跨平台兼容）
	 */
	static relativePath(from: string, to: string): string {
		return this.toPosixPath(path.relative(from, to))
	}

	/**
	 * 处理长路径（Windows）
	 * 如果路径超过 Windows 的 MAX_PATH 限制（260 字符），
	 * 添加 "\\?\" 前缀以支持长路径
	 */
	static handleLongPath(filePath: string): string {
		if (process.platform === "win32") {
			const normalizedPath = this.normalizePath(filePath)
			if (normalizedPath.length >= 260 && !normalizedPath.startsWith("\\\\?\\")) {
				return `\\\\?\\${normalizedPath}`
			}
		}
		return filePath
	}

	/**
	 * 检查路径是否是绝对路径
	 */
	static isAbsolute(filePath: string): boolean {
		return path.isAbsolute(filePath)
	}

	/**
	 * 获取路径的目录名
	 */
	static dirname(filePath: string): string {
		return this.normalizePath(path.dirname(filePath))
	}

	/**
	 * 获取路径的基本名称
	 */
	static basename(filePath: string): string {
		return path.basename(filePath)
	}

	/**
	 * 获取路径的扩展名
	 */
	static extname(filePath: string): string {
		return path.extname(filePath)
	}
}

/**
 * 获取 shadow Git 仓库在 globalStorage 中的路径。
 * 使用 branch-per-task 结构。
 *
 * 路径结构:
 * globalStorage/
 *   checkpoints/
 *     {cwdHash}/
 *       .git/
 *
 * @param vscodeGlobalStorageCoolClinePath - VS Code 全局存储路径
 * @param taskId - 任务 ID
 * @param cwdHash - 工作目录路径的哈希值
 * @returns Promise<string> shadow git 目录的绝对路径
 * @throws Error 如果全局存储路径无效
 */
export async function getShadowGitPath(
	vscodeGlobalStorageCoolClinePath: string,
	taskId: string,
	cwdHash: string,
): Promise<string> {
	if (!vscodeGlobalStorageCoolClinePath) {
		throw new Error("Global storage uri is invalid")
	}
	// 直接使用 shadow-git 目录
	const shadowGitDir = PathUtils.joinPath(vscodeGlobalStorageCoolClinePath, "shadow-git", cwdHash)
	await mkdir(shadowGitDir, { recursive: true })
	return PathUtils.joinPath(shadowGitDir, ".git")
}

/**
 * 获取当前工作目录。
 * 验证 checkpoints 不在受保护的目录中使用，如 home、Desktop、Documents 或 Downloads。
 *
 * 受保护的目录:
 * - 用户的主目录
 * - 桌面
 * - 文档
 * - 下载
 *
 * @returns Promise<string> 当前工作目录的绝对路径
 * @throws Error 如果未检测到工作区或在受保护的目录中
 */
export async function getWorkingDirectory(): Promise<string> {
	const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
	if (!cwd) {
		throw new Error("No workspace detected. Please open CoolCline in a workspace to use checkpoints.")
	}

	const homedir = os.homedir()
	const desktopPath = PathUtils.joinPath(homedir, "Desktop")
	const documentsPath = PathUtils.joinPath(homedir, "Documents")
	const downloadsPath = PathUtils.joinPath(homedir, "Downloads")

	// 使用 pathsEqual 进行比较，确保跨平台兼容性
	if (PathUtils.pathsEqual(cwd, homedir)) {
		throw new Error("Cannot use checkpoints in home directory")
	}
	if (PathUtils.pathsEqual(cwd, desktopPath)) {
		throw new Error("Cannot use checkpoints in desktop directory")
	}
	if (PathUtils.pathsEqual(cwd, documentsPath)) {
		throw new Error("Cannot use checkpoints in documents directory")
	}
	if (PathUtils.pathsEqual(cwd, downloadsPath)) {
		throw new Error("Cannot use checkpoints in downloads directory")
	}

	return PathUtils.normalizePath(cwd)
}

/**
 * 计算工作目录的哈希值。
 * 用于在 globalStorage 中创建唯一的目录名。
 *
 * @param cwd - 工作目录路径
 * @returns string 工作目录的哈希值
 */
export function hashWorkingDir(cwd: string): string {
	return crypto.createHash("sha256").update(PathUtils.normalizePath(cwd)).digest("hex").slice(0, 8)
}

/**
 * 检查文件是否存在。
 *
 * @param filePath - 要检查的文件路径
 * @returns Promise<boolean> 文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
		return true
	} catch (e) {
		return false
	}
}

/**
 * 跨平台的路径比较。
 * 在 Windows 上忽略大小写，在其他平台区分大小写。
 *
 * @param path1 - 第一个路径
 * @param path2 - 第二个路径
 * @returns boolean 路径是否相等
 */
export function arePathsEqual(path1?: string, path2?: string): boolean {
	return pathsAreEqual(path1, path2)
}

// 导出工具类
export { PathUtils }
