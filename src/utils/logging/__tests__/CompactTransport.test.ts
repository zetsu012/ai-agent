/**
 * @fileoverview CompactTransport 的测试用例
 */

import { CompactTransport } from "../CompactTransport"
import { CompactLogEntry, LogLevel } from "../types"
import * as fs from "fs"
import * as os from "os"
import { PathUtils } from "../../../services/checkpoints/CheckpointUtils"

describe("CompactTransport", () => {
	let transport: CompactTransport
	let logFilePath: string

	beforeEach(() => {
		logFilePath = PathUtils.joinPath(os.tmpdir(), `test-log-${Date.now()}.log`)
		transport = new CompactTransport({
			level: "debug",
			filePath: logFilePath,
		})
	})

	afterEach(() => {
		transport.close()
		if (fs.existsSync(logFilePath)) {
			fs.unlinkSync(logFilePath)
		}
	})

	it("should create log file and write entries", async () => {
		const entry: CompactLogEntry = {
			t: Date.now(),
			l: "info",
			m: "test message",
		}

		transport.write(entry)
		await new Promise((resolve) => setTimeout(resolve, 500)) // 增加等待时间
		transport.close()

		expect(fs.existsSync(logFilePath)).toBe(true)
		const fileContent = fs.readFileSync(logFilePath, "utf-8")
		expect(fileContent).toContain(entry.m)
	})

	it("should respect log level filtering", async () => {
		const transport = new CompactTransport({
			level: "warn",
			filePath: logFilePath,
		})

		transport.write({
			t: Date.now(),
			l: "debug" as const,
			m: "debug message",
		})

		transport.write({
			t: Date.now(),
			l: "info" as const,
			m: "info message",
		})

		transport.write({
			t: Date.now(),
			l: "warn" as const,
			m: "warn message",
		})

		await new Promise((resolve) => setTimeout(resolve, 100)) // 等待文件初始化
		transport.close()

		const fileContent = fs.readFileSync(logFilePath, "utf-8")

		expect(fileContent).not.toContain("debug message")
		expect(fileContent).not.toContain("info message")
		expect(fileContent).toContain("warn message")
	})

	it("should handle concurrent writes", async () => {
		const entries = Array.from({ length: 100 }, (_, i) => ({
			t: Date.now(),
			l: "info" as const,
			m: `message ${i}`,
		}))

		entries.forEach((entry) => transport.write(entry))
		await new Promise((resolve) => setTimeout(resolve, 1000)) // 增加等待时间
		transport.close()

		const fileContent = fs.readFileSync(logFilePath, "utf-8")
		entries.forEach((entry) => {
			expect(fileContent).toContain(entry.m)
		})
	})

	it("should handle metadata in log entries", async () => {
		const entry: CompactLogEntry = {
			t: Date.now(),
			l: "info",
			m: "test with metadata",
			d: { userId: "123", action: "login" },
		}

		transport.write(entry)
		await new Promise((resolve) => setTimeout(resolve, 500)) // 增加等待时间
		transport.close()

		const fileContent = fs.readFileSync(logFilePath, "utf-8")
		expect(fileContent).toContain("test with metadata")
		expect(fileContent).toContain("userId")
	})

	it("should handle errors gracefully", () => {
		// 使用临时目录下的不存在目录
		const nonexistentPath = PathUtils.joinPath(os.tmpdir(), "nonexistent", "test.log")
		const invalidTransport = new CompactTransport({
			level: "info",
			filePath: nonexistentPath,
		})

		expect(() => {
			invalidTransport.write({
				t: Date.now(),
				l: "info",
				m: "test message",
			})
		}).not.toThrow()

		invalidTransport.close()
	})
})
