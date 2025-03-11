import { jest } from "@jest/globals"
import { CheckpointMigration } from "../CheckpointMigration"
import { createTestEnvironment, TestEnvironment } from "./test-utils"
import * as fs from "fs/promises"
import { simpleGit, SimpleGit } from "simple-git"
import { getShadowGitPath, PathUtils } from "../CheckpointUtils"
import * as vscode from "vscode"

describe("CheckpointMigration", () => {
	let env: TestEnvironment
	let git: SimpleGit
	let gitPath: string
	let outputChannel: vscode.OutputChannel

	beforeEach(async () => {
		env = await createTestEnvironment()
		git = simpleGit(env.workspaceRoot)
		await git.init()
		const cwdHash = "test-hash"
		gitPath = await getShadowGitPath(env.globalStoragePath, "test-task-1", cwdHash)
		outputChannel = vscode.window.createOutputChannel("Checkpoint Migration")

		// 创建必要的目录结构
		await fs.mkdir(PathUtils.joinPath(env.workspaceRoot, "checkpoints"), { recursive: true })
		await git.init()
	})

	afterEach(async () => {
		await env.cleanup()
		outputChannel.dispose()
	})

	describe("数据迁移", () => {
		it("应该能够迁移旧版本的检查点", async () => {
			// 创建旧版本的检查点结构
			const oldCheckpointsDir = PathUtils.joinPath(env.workspaceRoot, "checkpoints")
			await fs.mkdir(oldCheckpointsDir, { recursive: true })

			// 创建一些旧的检查点文件
			await fs.writeFile(
				PathUtils.joinPath(oldCheckpointsDir, "checkpoint1.json"),
				JSON.stringify({
					id: "checkpoint1",
					files: [{ path: "test.txt", content: "old content" }],
				}),
			)

			// 执行迁移
			await CheckpointMigration.migrateToNewStructure(env.workspaceRoot, outputChannel)

			// 验证迁移结果
			const newGitExists = await fs
				.access(PathUtils.joinPath(env.workspaceRoot, "shadow-git"))
				.then(() => true)
				.catch(() => false)
			expect(newGitExists).toBe(true)

			// 验证旧数据已被清理
			const oldDirExists = await fs
				.access(oldCheckpointsDir)
				.then(() => true)
				.catch(() => false)
			expect(oldDirExists).toBe(false)
		})

		it("应该能够处理不完整的旧数据", async () => {
			// 创建不完整的旧数据
			const oldCheckpointsDir = PathUtils.joinPath(env.workspaceRoot, "checkpoints")
			await fs.mkdir(oldCheckpointsDir, { recursive: true })

			// 创建一个损坏的检查点文件
			await fs.writeFile(PathUtils.joinPath(oldCheckpointsDir, "corrupt.json"), "invalid json")

			// 执行迁移
			await CheckpointMigration.migrateToNewStructure(env.workspaceRoot, outputChannel)

			// 验证迁移是否正常完成
			const newGitExists = await fs
				.access(PathUtils.joinPath(env.workspaceRoot, "shadow-git"))
				.then(() => true)
				.catch(() => false)
			expect(newGitExists).toBe(true)
		})
	})

	describe("清理操作", () => {
		it("应该能够清理旧的检查点数据", async () => {
			// 创建旧的检查点数据
			const oldCheckpointsDir = PathUtils.joinPath(env.workspaceRoot, "tasks")
			await fs.mkdir(oldCheckpointsDir, { recursive: true })
			await fs.writeFile(PathUtils.joinPath(oldCheckpointsDir, "old.json"), "old data")

			// 执行清理
			await CheckpointMigration.cleanupLegacyCheckpoints(env.workspaceRoot, outputChannel)

			// 验证旧数据已被删除
			const oldDirExists = await fs
				.access(oldCheckpointsDir)
				.then(() => true)
				.catch(() => false)
			expect(oldDirExists).toBe(false)
		})

		it("应该能够安全地处理不存在的旧数据", async () => {
			// 直接尝试清理不存在的数据
			await CheckpointMigration.cleanupLegacyCheckpoints(env.workspaceRoot, outputChannel)

			// 验证操作没有抛出错误
			const dirExists = await fs
				.access(env.workspaceRoot)
				.then(() => true)
				.catch(() => false)
			expect(dirExists).toBe(true)
		})
	})

	describe("错误处理", () => {
		it("应该能够处理迁移过程中的错误", async () => {
			// 创建一个无法访问的目录
			const restrictedDir = PathUtils.joinPath(env.workspaceRoot, "checkpoints")
			await fs.mkdir(restrictedDir, { recursive: true })

			try {
				await fs.chmod(restrictedDir, 0o000) // 移除所有权限
				await CheckpointMigration.migrateToNewStructure(env.workspaceRoot, outputChannel)

				// 验证新目录结构已创建
				const newGitExists = await fs
					.access(PathUtils.joinPath(env.workspaceRoot, "shadow-git"))
					.then(() => true)
					.catch(() => false)
				expect(newGitExists).toBe(true)
			} finally {
				try {
					await fs.chmod(restrictedDir, 0o777)
				} catch (error) {
					// 忽略权限恢复错误
				}
			}
		})

		it("应该能够处理并发迁移", async () => {
			// 创建必要的目录结构
			await fs.mkdir(PathUtils.joinPath(env.workspaceRoot, "checkpoints"), { recursive: true })

			// 同时启动多个迁移操作
			const migrations = Array(5)
				.fill(null)
				.map(() => CheckpointMigration.migrateToNewStructure(env.workspaceRoot, outputChannel))

			// 等待所有迁移完成
			await Promise.all(migrations)

			// 验证最终状态是正确的
			const newGitExists = await fs
				.access(PathUtils.joinPath(env.workspaceRoot, "shadow-git"))
				.then(() => true)
				.catch(() => false)
			expect(newGitExists).toBe(true)
		})
	})

	describe("性能测试", () => {
		it("应该能够高效处理大量检查点", async () => {
			// 创建大量旧检查点
			const oldCheckpointsDir = PathUtils.joinPath(env.workspaceRoot, "checkpoints")
			await fs.mkdir(oldCheckpointsDir, { recursive: true })

			const checkpointCount = 100
			for (let i = 0; i < checkpointCount; i++) {
				await fs.writeFile(
					PathUtils.joinPath(oldCheckpointsDir, `checkpoint${i}.json`),
					JSON.stringify({
						id: `checkpoint${i}`,
						files: [{ path: `file${i}.txt`, content: `content ${i}` }],
					}),
				)
			}

			// 测量迁移时间
			const start = Date.now()
			await CheckpointMigration.migrateToNewStructure(env.workspaceRoot, outputChannel)
			const duration = Date.now() - start

			// 验证性能
			expect(duration).toBeLessThan(10000) // 应该在 10 秒内完成
		})
	})
})
