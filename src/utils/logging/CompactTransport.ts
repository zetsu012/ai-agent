/**
 * @fileoverview 实现紧凑日志传输系统,支持文件输出功能
 */

import * as fs from "fs"
import { PathUtils } from "../../services/checkpoints/CheckpointUtils"
import { CompactTransportConfig, ICompactTransport, CompactLogEntry, LogLevel, LOG_LEVELS } from "./types"

/**
 * 根据配置的最低级别判断日志条目是否应该被处理
 * @param configLevel - 配置中的最低日志级别
 * @param entryLevel - 当前日志条目的级别
 * @returns 是否应该处理该条目
 */
function isLevelEnabled(configLevel: LogLevel, entryLevel: string): boolean {
	const configIdx = LOG_LEVELS.indexOf(configLevel)
	const entryIdx = LOG_LEVELS.indexOf(entryLevel as LogLevel)
	return entryIdx >= configIdx
}

/**
 * 实现支持文件输出的紧凑日志传输
 * @implements {ICompactTransport}
 */
export class CompactTransport implements ICompactTransport {
	private logStream: fs.WriteStream | null = null
	private logDir: string
	private logPath: string
	private writeQueue: string[] = []
	private isWriting: boolean = false

	/**
	 * 创建新的 CompactTransport 实例
	 * @param config - 传输配置
	 */
	constructor(private config: CompactTransportConfig) {
		this.logDir = PathUtils.dirname(config.filePath)
		this.logPath = config.filePath
		this.initializeLogFile()
	}

	private async initializeLogFile() {
		try {
			// 确保日志目录存在
			if (!fs.existsSync(this.logDir)) {
				await fs.promises.mkdir(this.logDir, { recursive: true })
			}

			// 验证目录权限
			try {
				await fs.promises.access(this.logDir, fs.constants.W_OK)
			} catch (error) {
				throw new Error(`没有日志目录的写入权限: ${this.logDir}`)
			}

			// 创建或打开日志文件流
			this.logStream = fs.createWriteStream(this.logPath, {
				flags: "a", // append 模式
				encoding: "utf8",
				mode: 0o644, // 设置文件权限
			})

			// 等待流准备就绪
			await new Promise<void>((resolve, reject) => {
				if (!this.logStream) {
					reject(new Error("日志流创建失败"))
					return
				}

				const timeoutId = setTimeout(() => {
					reject(new Error("日志流初始化超时"))
				}, 5000) // 5秒超时

				this.logStream.once("error", (error) => {
					clearTimeout(timeoutId)
					reject(error)
				})

				// Node.js的WriteStream没有'ready'事件，使用'open'事件代替
				this.logStream.once("open", () => {
					clearTimeout(timeoutId)
					if (this.logStream) {
						this.logStream.removeListener("error", reject)
					}
					resolve()
				})
			})

			// 处理错误事件
			if (this.logStream) {
				this.logStream.on("error", (error) => {
					console.error("日志流错误:", error)
					this.logStream = null
					setTimeout(() => this.initializeLogFile(), 1000)
				})
			}

			// 如果有待写入的日志，开始处理
			if (this.writeQueue.length > 0) {
				await this.processWriteQueue()
			}
		} catch (error) {
			const errorMessage = `初始化日志文件失败: ${error instanceof Error ? error.message : String(error)}`
			throw new Error(errorMessage)
		}
	}

	/**
	 * 将日志条目写入配置的输出(控制台和/或文件)
	 * @param entry - 要写入的日志条目
	 */
	write(entry: CompactLogEntry): void {
		// 检查日志级别
		if (!isLevelEnabled(this.config.level, entry.l)) {
			return
		}

		const logLine = JSON.stringify(entry) + "\n"

		if (!this.logStream) {
			// 如果日志流还未初始化，加入队列
			this.writeQueue.push(logLine)
			return
		}

		this.writeQueue.push(logLine)
		if (!this.isWriting) {
			this.processWriteQueue()
		}
	}

	private async processWriteQueue() {
		if (this.isWriting || this.writeQueue.length === 0 || !this.logStream) {
			return
		}

		this.isWriting = true

		try {
			while (this.writeQueue.length > 0) {
				const line = this.writeQueue.shift()
				if (line) {
					// 使用 Promise 包装写入操作
					await new Promise<void>((resolve, reject) => {
						if (!this.logStream) {
							reject(new Error("日志流未初始化"))
							return
						}

						this.logStream.write(line, (error) => {
							if (error) {
								reject(error)
							} else {
								resolve()
							}
						})
					})
				}
			}
		} catch (error) {
			console.error("处理日志写入队列时出错:", error)
		} finally {
			this.isWriting = false
		}
	}

	/**
	 * 关闭传输并写入会话结束标记
	 */
	close(): void {
		if (this.logStream) {
			this.logStream.end()
			this.logStream = null
		}
	}
}
