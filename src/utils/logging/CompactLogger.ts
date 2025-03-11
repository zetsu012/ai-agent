/**
 * @fileoverview 实现主日志记录器,提供结构化日志记录功能
 */

import { ILogger, ICompactTransport, LogMeta, LogLevel, CompactLogEntry } from "./types"

/**
 * 实现主日志记录器
 * @implements {ILogger}
 */
export class CompactLogger implements ILogger {
	/**
	 * 创建新的 CompactLogger 实例
	 * @param transport - 日志传输实例
	 * @param parentMeta - 可选的父级元数据
	 */
	constructor(
		private readonly transport: ICompactTransport,
		private readonly parentMeta?: LogMeta,
	) {}

	/**
	 * 记录调试级别消息
	 * @param message - 要记录的消息
	 * @param meta - 可选的元数据
	 */
	debug(message: string, meta?: LogMeta): void {
		this.log("debug", message, this.combineMeta(meta))
	}

	/**
	 * 记录信息级别消息
	 * @param message - 要记录的消息
	 * @param meta - 可选的元数据
	 */
	info(message: string, meta?: LogMeta): void {
		this.log("info", message, this.combineMeta(meta))
	}

	/**
	 * 记录警告级别消息
	 * @param message - 要记录的消息
	 * @param meta - 可选的元数据
	 */
	warn(message: string, meta?: LogMeta): void {
		this.log("warn", message, this.combineMeta(meta))
	}

	/**
	 * 记录错误级别消息
	 * @param message - 错误消息或错误对象
	 * @param meta - 可选的元数据
	 */
	error(message: string | Error, meta?: LogMeta): void {
		this.handleErrorLog("error", message, meta)
	}

	/**
	 * 记录致命级别消息
	 * @param message - 错误消息或错误对象
	 * @param meta - 可选的元数据
	 */
	fatal(message: string | Error, meta?: LogMeta): void {
		this.handleErrorLog("fatal", message, meta)
	}

	/**
	 * 创建继承当前日志记录器元数据的子日志记录器
	 * @param meta - 子日志记录器的额外元数据
	 * @returns 新的日志记录器实例,具有合并的元数据
	 */
	child(meta: LogMeta): ILogger {
		const combinedMeta = this.parentMeta ? { ...this.parentMeta, ...meta } : meta
		return new CompactLogger(this.transport, combinedMeta)
	}

	/**
	 * 关闭日志记录器及其传输
	 */
	close(): void {
		this.transport.close()
	}

	/**
	 * 处理错误和致命级别消息的特殊错误对象处理
	 * @private
	 * @param level - 日志级别(error 或 fatal)
	 * @param message - 要记录的消息或错误对象
	 * @param meta - 可选的元数据
	 */
	private handleErrorLog(level: "error" | "fatal", message: string | Error, meta?: LogMeta): void {
		if (message instanceof Error) {
			const errorMeta: LogMeta = {
				...meta,
				ctx: meta?.ctx ?? level,
				error: {
					name: message.name,
					message: message.message,
					stack: message.stack,
				},
			}
			this.log(level, message.message, this.combineMeta(errorMeta))
		} else {
			this.log(level, message, this.combineMeta(meta))
		}
	}

	/**
	 * 合并父级和当前元数据,正确处理上下文
	 * @private
	 * @param meta - 要与父级元数据合并的当前元数据
	 * @returns 合并后的元数据或 undefined(如果没有元数据)
	 */
	private combineMeta(meta?: LogMeta): LogMeta | undefined {
		if (!this.parentMeta) {
			return meta
		}
		if (!meta) {
			return this.parentMeta
		}
		return {
			...this.parentMeta,
			...meta,
			ctx: meta.ctx || this.parentMeta.ctx,
		}
	}

	/**
	 * 核心日志记录函数,处理并写入日志条目
	 * @private
	 * @param level - 日志级别
	 * @param message - 要记录的消息
	 * @param meta - 可选的元数据
	 */
	private log(level: LogLevel, message: string, meta?: LogMeta): void {
		const entry: CompactLogEntry = {
			t: Date.now(),
			l: level,
			m: message,
			c: meta?.ctx,
			d: meta ? (({ ctx, ...rest }) => (Object.keys(rest).length > 0 ? rest : undefined))(meta) : undefined,
		}

		this.transport.write(entry)
	}
}
