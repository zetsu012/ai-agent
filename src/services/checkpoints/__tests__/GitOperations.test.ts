import { jest } from "@jest/globals"
import { GitOperations } from "../GitOperations"
import { createTestEnvironment, TestEnvironment } from "./test-utils"
import { SimpleGit } from "simple-git"
import * as fs from "fs/promises"
import { getShadowGitPath, PathUtils } from "../CheckpointUtils"
import { CheckpointDiff } from "../types"

describe("GitOperations", () => {
	let env: TestEnvironment
	let gitOps: GitOperations
	let gitPath: string

	beforeEach(async () => {
		env = await createTestEnvironment()
		gitOps = new GitOperations(env.globalStoragePath, env.workspaceRoot)
		gitPath = await getShadowGitPath(env.globalStoragePath, "test-task", "test-hash")
		await gitOps.initShadowGit(gitPath)
	})

	afterEach(async () => {
		await env.cleanup()
	})

	describe("基本操作", () => {
		it("应该能够初始化 shadow git 仓库", async () => {
			const newGitPath = await getShadowGitPath(env.globalStoragePath, "new-task", "new-hash")
			const result = await gitOps.initShadowGit(newGitPath)
			expect(result).toBe(newGitPath)
		})

		it("应该能够创建任务分支", async () => {
			await gitOps.createTaskBranch("test-task", gitPath)
			const git = require("simple-git")(PathUtils.dirname(gitPath))
			const branches = await git.branch()
			expect(branches.current).toBe("task-test-task")
		})
	})

	describe("提交操作", () => {
		beforeEach(async () => {
			await gitOps.createTaskBranch("test-task", gitPath)
		})

		it("应该能够创建提交", async () => {
			const testFile = PathUtils.joinPath(env.workspaceRoot, "test.txt")
			await fs.writeFile(testFile, "test content")
			await gitOps.addCheckpointFiles(gitPath)
			const commit = await gitOps.commit(gitPath, "test commit")
			expect(typeof commit).toBe("string")
			expect(commit).toMatch(/^[a-f0-9]{40}$/)
		})

		it("应该能够获取提交历史", async () => {
			const testFile = PathUtils.joinPath(env.workspaceRoot, "test.txt")
			await fs.writeFile(testFile, "test content")
			await gitOps.addCheckpointFiles(gitPath)
			const commitHash = await gitOps.commit(gitPath, "test commit")

			const commits = await gitOps.getCommits(gitPath)
			expect(commits.length).toBeGreaterThan(0)
			expect(commits[0].hash).toBe(commitHash)
			expect(commits[0].message).toBe("test commit")
		})
	})

	describe("差异操作", () => {
		beforeEach(async () => {
			await gitOps.createTaskBranch("test-task", gitPath)
		})

		it("应该能够获取工作目录的差异", async () => {
			const testFile = PathUtils.joinPath(env.workspaceRoot, "test.txt")
			await fs.writeFile(testFile, "initial content")
			await gitOps.addCheckpointFiles(gitPath)
			const commitHash = await gitOps.commit(gitPath, "initial commit")

			await fs.writeFile(testFile, "modified content")
			const diffs = await gitOps.getDiffWithWorkingDir(gitPath, commitHash)
			expect(diffs.length).toBeGreaterThan(0)
			expect(diffs[0].before).toBe("initial content")
			expect(diffs[0].after).toBe("modified content")
		})

		it("应该能够处理错误情况", async () => {
			await expect(gitOps.getDiffWithWorkingDir(gitPath, "invalid-hash")).rejects.toThrow()
		})
	})

	describe("基本 Git 操作", () => {
		it("应该能够添加文件并提交", async () => {
			await fs.writeFile(env.testFilePath, "test content")
			await gitOps.addCheckpointFiles(gitPath)
			const commitHash = await gitOps.commit(gitPath, "Test commit")
			expect(commitHash).toMatch(/^[a-f0-9]{40}$/)

			const commits = await gitOps.getCommits(gitPath)
			expect(commits.length).toBeGreaterThan(0)
			expect(commits[0].message).toBe("Test commit")
		})

		it("应该能够获取文件差异", async () => {
			await fs.writeFile(env.testFilePath, "initial content")
			await gitOps.addCheckpointFiles(gitPath)
			const firstCommit = await gitOps.commit(gitPath, "Initial commit")

			await fs.writeFile(env.testFilePath, "modified content")
			await gitOps.addCheckpointFiles(gitPath)
			const secondCommit = await gitOps.commit(gitPath, "Modified commit")

			const diff = await gitOps.getDiffBetweenCommits(gitPath, firstCommit, secondCommit)
			expect(diff).toHaveLength(1)
			expect(diff[0].before).toBe("initial content")
			expect(diff[0].after).toBe("modified content")
		})
	})

	describe("分支操作", () => {
		it("应该能够创建和删除任务分支", async () => {
			const taskId = "test-task"
			await gitOps.createTaskBranch(taskId, gitPath)

			const commits = await gitOps.getCommits(gitPath)
			expect(commits.length).toBeGreaterThan(0)

			await gitOps.deleteTaskBranch(taskId, gitPath)
		})
	})

	describe("错误处理", () => {
		it("应该能够处理无效的提交哈希", async () => {
			await expect(gitOps.getDiffBetweenCommits(gitPath, "invalid-hash-1", "invalid-hash-2")).rejects.toThrow()
		})
	})

	describe("性能测试", () => {
		it("应该能够处理大量文件", async () => {
			const fileCount = 100
			const files: string[] = []

			for (let i = 0; i < fileCount; i++) {
				const filePath = PathUtils.joinPath(env.workspaceRoot, `test-${i}.txt`)
				await fs.writeFile(filePath, `content-${i}`)
				files.push(filePath)
			}

			await gitOps.addCheckpointFiles(gitPath)
			const commitHash = await gitOps.commit(gitPath, "Bulk commit")
			expect(commitHash).toMatch(/^[a-f0-9]{40}$/)

			const commits = await gitOps.getCommits(gitPath)
			expect(commits.length).toBeGreaterThan(0)
			expect(commits[0].message).toBe("Bulk commit")
		})

		it("应该能够处理大文件", async () => {
			const largeFilePath = PathUtils.joinPath(env.workspaceRoot, "large-file.txt")
			const content = "x".repeat(5 * 1024 * 1024) // 5MB
			await fs.writeFile(largeFilePath, content)

			await gitOps.addCheckpointFiles(gitPath)
			const commitHash = await gitOps.commit(gitPath, "Large file commit")
			expect(commitHash).toMatch(/^[a-f0-9]{40}$/)

			const commits = await gitOps.getCommits(gitPath)
			expect(commits.length).toBeGreaterThan(0)
			expect(commits[0].message).toBe("Large file commit")
		})
	})

	describe("跨任务操作", () => {
		it("应该能够获取跨任务的差异", async () => {
			const task1 = "task-1"
			const task2 = "task-2"

			await gitOps.createTaskBranch(task1, gitPath)
			await fs.writeFile(env.testFilePath, "task1 content")
			await gitOps.addCheckpointFiles(gitPath)
			const task1Hash = await gitOps.commit(gitPath, "Task 1 commit")

			await gitOps.createTaskBranch(task2, gitPath)
			await fs.writeFile(env.testFilePath, "task2 content")
			await gitOps.addCheckpointFiles(gitPath)
			const task2Hash = await gitOps.commit(gitPath, "Task 2 commit")

			const diff = await gitOps.getDiffAcrossTasks(gitPath, task1, task1Hash, task2, task2Hash)

			expect(diff).toHaveLength(1)
			expect(diff[0].before).toBe("task1 content")
			expect(diff[0].after).toBe("task2 content")
		})
	})
})
