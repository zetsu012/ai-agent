/**
 * @fileoverview 日志记录器入口文件,导出默认实例和测试用的空日志记录器
 */

import * as fs from "fs"
import * as vscode from "vscode"
import { CompactLogger } from "./CompactLogger"
import { CompactTransport } from "./CompactTransport"
import { ILogger } from "./types"
import { PathUtils } from "../../services/checkpoints/CheckpointUtils"

let defaultTransport: CompactTransport | null = null
let defaultLogger: CompactLogger | null = null

// 初始化日志系统
export async function initializeLogger(context: vscode.ExtensionContext) {
	try {
		// 获取正确的存储路径
		const extensionDir = context.globalStorageUri.fsPath
		// console.log("扩展目录路径:", extensionDir)

		// 确保扩展目录存在
		if (!fs.existsSync(extensionDir)) {
			// console.log("创建扩展目录:", extensionDir)
			await fs.promises.mkdir(extensionDir, { recursive: true })
		}

		// 创建日志目录
		const logDir = PathUtils.joinPath(extensionDir, "logs")
		// console.log("日志目录路径:", logDir)
		if (!fs.existsSync(logDir)) {
			// console.log("创建日志目录:", logDir)
			await fs.promises.mkdir(logDir, { recursive: true })
		}

		const logPath = PathUtils.joinPath(logDir, "coolcline.log")
		// console.log("日志文件完整路径:", logPath)

		// 验证目录权限
		try {
			await fs.promises.access(logDir, fs.constants.W_OK)
			// console.log("日志目录权限验证成功")
		} catch (error) {
			console.error("日志目录权限验证失败:", error)
			throw error
		}

		// 创建默认的日志传输实例
		defaultTransport = new CompactTransport({
			level: "debug",
			filePath: logPath,
		})

		// 创建并导出默认的日志记录器实例
		defaultLogger = new CompactLogger(defaultTransport)

		// 写入初始日志以验证系统正常工作
		defaultLogger.info("日志系统初始化成功", {
			ctx: "logging",
			logPath,
			extensionDir,
		})

		return defaultLogger
	} catch (error) {
		console.error("日志系统初始化失败:", error)
		// 记录更详细的错误信息
		if (error instanceof Error) {
			console.error("错误详情:", {
				message: error.message,
				stack: error.stack,
				name: error.name,
			})
		}
		throw error
	}
}

// 导出日志记录器实例
export const logger: ILogger = {
	debug: (...args) => defaultLogger?.debug(...args) ?? noopLogger.debug(...args),
	info: (...args) => defaultLogger?.info(...args) ?? noopLogger.info(...args),
	warn: (...args) => defaultLogger?.warn(...args) ?? noopLogger.warn(...args),
	error: (...args) => defaultLogger?.error(...args) ?? noopLogger.error(...args),
	fatal: (...args) => defaultLogger?.fatal(...args) ?? noopLogger.fatal(...args),
	child: (meta) => defaultLogger?.child(meta) || noopLogger,
	close: () => {
		defaultLogger?.close()
		defaultLogger = null
		defaultTransport = null
	},
}

// 导出一个空的日志记录器,用于生产环境或初始化失败时
export const noopLogger: ILogger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
	fatal: () => {},
	child: () => noopLogger,
	close: () => {},
}

// 导出所有类型和实现
export * from "./types"
export * from "./CompactLogger"
export * from "./CompactTransport"
