/**
 * @fileoverview 用于测试的模拟日志传输实现
 */

import { ICompactTransport, CompactLogEntry } from "../types"

/**
 * 模拟日志传输,用于测试
 */
export class MockTransport implements ICompactTransport {
	private entries: CompactLogEntry[] = []
	private isClosed = false

	/**
	 * 写入日志条目
	 * @param entry - 要写入的日志条目
	 */
	write(entry: CompactLogEntry): void {
		if (this.isClosed) {
			throw new Error("Cannot write to closed transport")
		}
		this.entries.push(entry)
	}

	/**
	 * 关闭传输
	 */
	close(): void {
		this.isClosed = true
	}

	/**
	 * 获取所有记录的日志条目
	 * @returns 日志条目数组
	 */
	getEntries(): CompactLogEntry[] {
		return this.entries
	}

	/**
	 * 清除所有记录的日志条目
	 */
	clear(): void {
		this.entries = []
	}

	/**
	 * 检查传输是否已关闭
	 * @returns 是否已关闭
	 */
	isTransportClosed(): boolean {
		return this.isClosed
	}
}
