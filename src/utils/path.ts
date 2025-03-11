import * as path from "path"
import os from "os"

/*
The Node.js 'path' module resolves and normalizes paths differently depending on the platform:
- On Windows, it uses backslashes (\) as the default path separator.
- On POSIX-compliant systems (Linux, macOS), it uses forward slashes (/) as the default path separator.

While modules like 'upath' can be used to normalize paths to use forward slashes consistently,
this can create inconsistencies when interfacing with other modules (like vscode.fs) that use
backslashes on Windows.

Our approach:
1. We present paths with forward slashes to the AI and user for consistency.
2. We use the 'arePathsEqual' function for safe path comparisons.
3. Internally, Node.js gracefully handles both backslashes and forward slashes.

This strategy ensures consistent path presentation while leveraging Node.js's built-in
path handling capabilities across different platforms.

Note: When interacting with the file system or VS Code APIs, we still use the native path module
to ensure correct behavior on all platforms. The toPosixPath and arePathsEqual functions are
primarily used for presentation and comparison purposes, not for actual file system operations.

Observations:
- Macos isn't so flexible with mixed separators, whereas windows can handle both. ("Node.js does automatically handle path separators on Windows, converting forward slashes to backslashes as needed. However, on macOS and other Unix-like systems, the path separator is always a forward slash (/), and backslashes are treated as regular characters.")
*/

export function toPosixPath(p: string) {
	// Extended-Length Paths in Windows start with "\\?\" to allow longer paths and bypass usual parsing. If detected, we return the path unmodified to maintain functionality, as altering these paths could break their special syntax.
	const isExtendedLengthPath = p.startsWith("\\\\?\\")

	if (isExtendedLengthPath) {
		return p
	}

	return p.replace(/\\/g, "/")
}

// Declaration merging allows us to add a new method to the String type
// You must import this file in your entry point (extension.ts) to have access at runtime
declare global {
	interface String {
		toPosix(): string
	}
}

String.prototype.toPosix = function (this: string): string {
	return toPosixPath(this)
}

// Safe path comparison that works across different platforms
export function arePathsEqual(path1?: string, path2?: string): boolean {
	if (!path1 && !path2) {
		return true
	}
	if (!path1 || !path2) {
		return false
	}

	// 解析为绝对路径
	path1 = path.resolve(path1)
	path2 = path.resolve(path2)

	// 规范化并比较
	path1 = normalizePath(path1)
	path2 = normalizePath(path2)

	if (process.platform === "win32") {
		return path1.toLowerCase() === path2.toLowerCase()
	}
	return path1 === path2
}

function normalizePath(p: string): string {
	// 首先将路径转换为POSIX格式（除了扩展路径）
	if (!p.startsWith("\\\\?\\")) {
		p = toPosixPath(p)
	}

	// 规范化路径
	p = path.normalize(p)

	// 移除尾部斜杠（除了根路径）
	if (p.length > 1 && (p.endsWith("/") || p.endsWith("\\"))) {
		p = p.slice(0, -1)
	}

	// 处理Windows驱动器号
	if (process.platform === "win32" && /^[a-zA-Z]:/.test(p)) {
		p = p.charAt(0).toLowerCase() + p.slice(1)
	}

	return p
}

function normalizeWindowsPath(p: string): string {
	// 将所有反斜杠转换为正斜杠
	p = p.replace(/\\/g, "/")

	// 处理Windows驱动器号
	if (/^[a-zA-Z]:/.test(p)) {
		p = p.charAt(0).toLowerCase() + p.slice(1)
	}

	return p
}

export function getReadablePath(cwd: string, relPath?: string): string {
	if (!cwd) {
		throw new Error("cwd is required")
	}

	if (!relPath) {
		return path.basename(cwd)
	}

	// 规范化路径
	const normalizedCwd = normalizeWindowsPath(path.resolve(cwd))
	const normalizedPath = normalizeWindowsPath(path.resolve(normalizedCwd, relPath))

	// 如果路径相等，返回目录名
	if (normalizedCwd === normalizedPath) {
		return path.basename(normalizedCwd)
	}

	// 如果是根路径
	if (cwd === "/") {
		return normalizeWindowsPath(path.relative(cwd, normalizedPath))
	}

	// 获取相对路径
	let relativePath = path.relative(normalizedCwd, normalizedPath)

	// 如果相对路径以 .. 开头，返回绝对路径
	if (relativePath.startsWith("..")) {
		return normalizeWindowsPath(normalizedPath)
	}

	// 转换为POSIX格式
	relativePath = normalizeWindowsPath(relativePath)

	// 如果路径包含驱动器号，移除它
	if (/^[a-zA-Z]:/.test(relativePath)) {
		relativePath = relativePath.slice(relativePath.indexOf("/") + 1)
	}

	// 如果路径以 Users/ 开头，移除它
	if (relativePath.startsWith("Users/")) {
		relativePath = relativePath.slice(relativePath.indexOf("/", 6) + 1)
	}

	// 保持尾部斜杠
	if (relPath.endsWith("/") || relPath.endsWith("\\")) {
		relativePath += "/"
	}

	return relativePath
}

export function toRelativePath(filePath: string, cwd: string): string {
	if (!filePath || !cwd) {
		return filePath
	}

	// 规范化路径
	const normalizedCwd = normalizeWindowsPath(path.resolve(cwd))
	const normalizedPath = normalizeWindowsPath(path.resolve(filePath))

	// 如果路径相等，返回文件名
	if (normalizedCwd === normalizedPath) {
		return path.basename(normalizedPath)
	}

	// 获取相对路径
	let relativePath = path.relative(normalizedCwd, normalizedPath)

	// 转换为POSIX格式
	relativePath = normalizeWindowsPath(relativePath)

	// 如果路径包含驱动器号，移除它
	if (/^[a-zA-Z]:/.test(relativePath)) {
		relativePath = relativePath.slice(relativePath.indexOf("/") + 1)
	}

	// 如果路径以 Users/ 开头，移除它
	if (relativePath.startsWith("Users/")) {
		relativePath = relativePath.slice(relativePath.indexOf("/", 6) + 1)
	}

	// 保持尾部斜杠，但避免重复
	if ((filePath.endsWith("/") || filePath.endsWith("\\")) && !relativePath.endsWith("/")) {
		relativePath += "/"
	}

	return relativePath
}
