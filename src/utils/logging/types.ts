/**
 * @fileoverview 日志系统的核心类型定义
 */

/**
 * 表示一个紧凑的日志条目格式,优化用于存储和传输
 */
export interface CompactLogEntry {
	/** 时间戳 */
	t: number
	/** 日志级别 */
	l: LogLevel
	/** 消息内容 */
	m: string
	/** 上下文 */
	c?: string
	/** 额外数据 */
	d?: {
		error?: {
			name: string
			message: string
			stack?: string
		}
		[key: string]: any
	}
}

/** 可用的日志级别(按严重程度升序) */
export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const
/** 表示有效日志级别的类型 */
export type LogLevel = (typeof LOG_LEVELS)[number]

/**
 * 日志条目的元数据结构
 */
export interface LogMeta {
	/** 可选的上下文标识符 */
	ctx?: string
	/** 额外的任意元数据字段 */
	[key: string]: unknown
}

/**
 * CompactTransport 的配置选项
 */
export interface CompactTransportConfig {
	/** 日志级别 */
	level: LogLevel
	/** 日志文件路径 */
	filePath: string
}

/**
 * 日志传输实现的接口
 */
export interface ICompactTransport {
	/**
	 * 写入日志条目到传输目标
	 * @param entry - 要写入的日志条目
	 */
	write(entry: CompactLogEntry): void

	/**
	 * 关闭传输并执行清理
	 */
	close(): void
}

/**
 * 日志记录器实现的接口
 */
export interface ILogger {
	/**
	 * 记录调试消息
	 * @param message - 要记录的消息
	 * @param meta - 可选的元数据
	 */
	debug(message: string, meta?: LogMeta): void

	/**
	 * 记录信息消息
	 * @param message - 要记录的消息
	 * @param meta - 可选的元数据
	 */
	info(message: string, meta?: LogMeta): void

	/**
	 * 记录警告消息
	 * @param message - 要记录的消息
	 * @param meta - 可选的元数据
	 */
	warn(message: string, meta?: LogMeta): void

	/**
	 * 记录错误消息
	 * @param message - 要记录的消息或错误对象
	 * @param meta - 可选的元数据
	 */
	error(message: string | Error, meta?: LogMeta): void

	/**
	 * 记录致命错误消息
	 * @param message - 要记录的消息或错误对象
	 * @param meta - 可选的元数据
	 */
	fatal(message: string | Error, meta?: LogMeta): void

	/**
	 * 创建一个继承当前元数据的子日志记录器
	 * @param meta - 要与父级元数据合并的元数据
	 * @returns 具有合并元数据的新日志记录器实例
	 */
	child(meta: LogMeta): ILogger

	/**
	 * 关闭日志记录器及其传输
	 */
	close(): void
}
