// npx jest src/services/checkpoints/__tests__/CheckpointService.test.ts

import { jest } from "@jest/globals"
import * as fs from "fs/promises"
import "../../../utils/path"
import { CheckpointService } from "../CheckpointService"
import { createTestEnvironment, createTestService, TestEnvironment } from "./test-utils"
import { PathUtils } from "../CheckpointUtils"

jest.setTimeout(30000)

describe("CheckpointService", () => {
	let env: TestEnvironment
	let service: CheckpointService

	beforeEach(async () => {
		env = await createTestEnvironment()
		service = await createTestService(env)
	})

	afterEach(async () => {
		await env.cleanup()
	})

	describe("初始化", () => {
		it("应该能够正确初始化服务", async () => {
			await service.initialize()
			expect(service.taskId).toBe("test-task-1")
		})

		it("应该能够处理重复初始化", async () => {
			await service.initialize()
			await service.initialize() // 不应该抛出错误
		})
	})

	describe("检查点操作", () => {
		beforeEach(async () => {
			await service.initialize()
		})

		it("应该能够保存检查点", async () => {
			const checkpoint = await service.saveCheckpoint("测试检查点")
			expect(checkpoint).toBeDefined()
			expect(checkpoint.hash).toBeDefined()
		})

		it("应该能够获取检查点历史", async () => {
			await service.saveCheckpoint("检查点1")
			await service.saveCheckpoint("检查点2")

			const history = await service.getHistory()
			expect(history.length).toBe(2)
		})

		it("应该能够创建和提交单个文件的变更", async () => {
			// 创建初始文件
			await fs.writeFile(env.testFilePath, "initial content")

			// 保存初始检查点
			const checkpoint1 = await service.saveCheckpoint("初始检查点")

			// 修改文件
			await fs.writeFile(env.testFilePath, "modified content")

			// 保存新检查点
			const checkpoint2 = await service.saveCheckpoint("修改后的检查点")

			// 获取差异
			const diff = await service.getDiff(checkpoint1.hash, checkpoint2.hash)
			expect(diff).toBeDefined()
		})

		it("应该能够处理多个文件的变更", async () => {
			// 创建多个测试文件
			const testFile2Path = PathUtils.joinPath(env.workspaceRoot, "src", "test2.txt")
			await fs.writeFile(testFile2Path, "file 2 content")

			// 保存初始检查点
			const checkpoint1 = await service.saveCheckpoint("初始检查点")

			// 修改文件
			await fs.writeFile(env.testFilePath, "modified content")
			await fs.writeFile(testFile2Path, "modified file 2 content")

			// 保存新检查点
			const checkpoint2 = await service.saveCheckpoint("修改后的检查点")

			// 获取差异
			const diff = await service.getDiff(checkpoint1.hash, checkpoint2.hash)
			expect(diff).toBeDefined()
		})
	})

	describe("错误处理", () => {
		it("应该能够处理无效的检查点哈希", async () => {
			await expect(service.getDiff("invalid-hash-1", "invalid-hash-2")).rejects.toThrow()
		})

		it("应该能够处理未初始化的服务", async () => {
			await expect(service.saveCheckpoint("Test checkpoint")).rejects.toThrow()
		})
	})
})
