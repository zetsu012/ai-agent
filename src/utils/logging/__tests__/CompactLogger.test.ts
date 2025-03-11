/**
 * @fileoverview CompactLogger 的测试用例
 */

import { CompactLogger } from "../CompactLogger"
import { MockTransport } from "./MockTransport"
import { LogMeta } from "../types"

describe("CompactLogger", () => {
	let transport: MockTransport
	let logger: CompactLogger

	beforeEach(() => {
		transport = new MockTransport()
		logger = new CompactLogger(transport)
	})

	afterEach(() => {
		transport.clear()
	})

	it("should log messages at different levels", () => {
		const message = "test message"
		logger.debug(message)
		logger.info(message)
		logger.warn(message)
		logger.error(message)
		logger.fatal(message)

		const entries = transport.getEntries()
		expect(entries).toHaveLength(5)
		expect(entries.map((e) => e.l)).toEqual(["debug", "info", "warn", "error", "fatal"])
		expect(entries.every((e) => e.m === message)).toBe(true)
	})

	it("should handle Error objects in error and fatal logs", () => {
		const error = new Error("test error")
		logger.error(error)
		logger.fatal(error)

		const entries = transport.getEntries()
		expect(entries).toHaveLength(2)
		entries.forEach((entry) => {
			expect(entry.m).toBe(error.message)
			expect(entry.d).toBeDefined()
			if (entry.d) {
				expect(entry.d.error).toHaveProperty("stack")
				expect(entry.d.error).toHaveProperty("name", "Error")
			}
		})
	})

	it("should handle metadata correctly", () => {
		const meta: LogMeta = {
			ctx: "test-context",
			id: "test-id",
			user: "test-user",
		}
		logger.info("test message", meta)

		const [entry] = transport.getEntries()
		expect(entry.c).toBe(meta.ctx)
		expect(entry.d).toHaveProperty("id", meta.id)
		expect(entry.d).toHaveProperty("user", meta.user)
	})

	it("should create child loggers with inherited metadata", () => {
		const parentMeta: LogMeta = { ctx: "parent" }
		const childMeta: LogMeta = { id: "child" }
		const parent = new CompactLogger(transport, parentMeta)
		const child = parent.child(childMeta)

		child.info("test message")

		const [entry] = transport.getEntries()
		expect(entry.c).toBe(parentMeta.ctx)
		expect(entry.d).toHaveProperty("id", childMeta.id)
	})

	it("should handle closing the logger", () => {
		logger.close()
		expect(transport.isTransportClosed()).toBe(true)
		expect(() => logger.info("test")).toThrow()
	})

	it("should include timestamps in log entries", () => {
		logger.info("test message")
		const [entry] = transport.getEntries()
		expect(entry.t).toBeDefined()
		expect(typeof entry.t).toBe("number")
	})
})
