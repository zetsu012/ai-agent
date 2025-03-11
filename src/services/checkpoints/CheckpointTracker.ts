import fs from "fs/promises"
import simpleGit, { SimpleGit } from "simple-git"
import * as vscode from "vscode"
import { GitOperations } from "./GitOperations"
import { getShadowGitPath, hashWorkingDir, getWorkingDirectory } from "./CheckpointUtils"
import { CheckpointDiff } from "./types"
import { PathUtils } from "./CheckpointUtils"

export interface CheckpointInfo {
	hash: string
	message: string
	timestamp?: Date
}

export interface StorageProvider {
	context: {
		globalStorageUri: { fsPath: string }
	}
}

/**
 * CheckpointTracker 类
 *
 * CoolCline 的 Checkpoints 系统的核心实现，提供版本控制功能，
 * 且不干扰用户的主 Git 仓库。
 *
 * 主要功能：
 * - Shadow Git 仓库管理
 * - 分支管理（branch-per-task 模型）
 * - Checkpoint 操作（创建、比较、恢复）
 * - 文件管理和过滤
 * - 安全特性
 */
export class CheckpointTracker {
	private readonly vscodeGlobalStorageCoolClinePath: string
	private readonly userProjectPath: string
	private readonly cwdHash: string
	private taskId: string
	private cwd: string
	private gitOperations: GitOperations
	private shadowGit?: SimpleGit
	private currentCheckpoint?: string
	private gitPath?: string

	/**
	 * 创建一个新的 CheckpointTracker 实例。
	 *
	 * @param vscodeGlobalStorageCoolClinePath - VSCode 全局存储路径
	 * @param taskId - 任务 ID
	 * @param userProjectPath - 用户工作目录
	 */
	constructor(vscodeGlobalStorageCoolClinePath: string, taskId: string, userProjectPath: string) {
		this.vscodeGlobalStorageCoolClinePath = PathUtils.normalizePath(vscodeGlobalStorageCoolClinePath)
		this.userProjectPath = PathUtils.normalizePath(userProjectPath)
		this.cwdHash = hashWorkingDir(this.userProjectPath)
		this.taskId = taskId
		this.cwd = this.userProjectPath
		this.gitOperations = new GitOperations(this.vscodeGlobalStorageCoolClinePath, this.cwd)
	}

	/**
	 * 初始化 checkpoint 跟踪器。
	 *
	 * @returns Promise<void>
	 */
	private isInitialized = false
	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			return
		}

		console.info("初始化 checkpoint 跟踪器")

		try {
			// 获取 shadow git 路径
			const coolclineShadowGitPath = await getShadowGitPath(
				this.vscodeGlobalStorageCoolClinePath,
				this.taskId,
				this.cwdHash,
			)

			// 初始化 shadow git 仓库
			this.gitPath = await this.gitOperations.initShadowGit(coolclineShadowGitPath)

			// 创建 SimpleGit 实例
			this.shadowGit = simpleGit(PathUtils.dirname(coolclineShadowGitPath))

			// 创建并切换到任务分支
			await this.gitOperations.createTaskBranch(this.taskId, this.gitPath)

			this.isInitialized = true
		} catch (error) {
			console.error("初始化 checkpoint 跟踪器失败:", error)
			throw error
		}
	}

	/**
	 * 创建一个新的 checkpoint。
	 *
	 * @param message - Checkpoint 消息
	 * @returns Promise<CheckpointInfo | undefined> 创建的 checkpoint 信息
	 */
	public async createCheckpoint(message: string): Promise<CheckpointInfo | undefined> {
		if (!this.shadowGit || !this.gitPath) {
			throw new Error("Checkpoint 跟踪器未初始化")
		}

		try {
			// 临时禁用嵌套的 Git 仓库
			await this.gitOperations.renameNestedGitRepos(true)

			// 添加文件
			const addResult = await this.gitOperations.addCheckpointFiles(this.gitPath)
			if (!addResult.success) {
				throw new Error("添加文件失败")
			}

			// 创建提交
			const commitHash = await this.gitOperations.commit(this.gitPath, message)
			this.currentCheckpoint = commitHash

			// 重新启用嵌套的 Git 仓库
			await this.gitOperations.renameNestedGitRepos(false)

			return {
				hash: commitHash,
				message: message,
				timestamp: new Date(),
			}
		} catch (error) {
			console.error("创建 checkpoint 失败:", error)
			// 确保重新启用嵌套的 Git 仓库
			await this.gitOperations.renameNestedGitRepos(false)
			throw error
		}
	}

	/**
	 * 获取两个 checkpoint 之间的差异。
	 *
	 * @param from - 起始 checkpoint 哈希
	 * @param to - 结束 checkpoint 哈希
	 * @returns Promise<Array<{paths: {relative: string, absolute: string}, content: {before: string, after: string}}>>
	 */
	public async getDiff(from: string, to: string): Promise<CheckpointDiff[]> {
		if (!this.shadowGit || !this.gitPath) {
			throw new Error("Checkpoint 跟踪器未初始化")
		}

		const result = await this.gitOperations.getDiff(this.gitPath, from, to)
		return result
	}

	/**
	 * 恢复到指定的 checkpoint。
	 *
	 * @param hash - 要恢复到的 checkpoint 哈希
	 * @returns Promise<void>
	 */
	public async restoreCheckpoint(hash: string): Promise<void> {
		if (!this.shadowGit || !this.gitPath) {
			throw new Error("Checkpoint 跟踪器未初始化")
		}

		try {
			// 临时禁用嵌套的 Git 仓库
			await this.gitOperations.renameNestedGitRepos(true)

			// 重置到指定的 checkpoint
			await this.gitOperations.restoreCheckpoint(this.gitPath, hash)
			this.currentCheckpoint = hash

			// 重新启用嵌套的 Git 仓库
			await this.gitOperations.renameNestedGitRepos(false)
		} catch (error) {
			console.error("恢复 checkpoint 失败:", error)
			// 确保重新启用嵌套的 Git 仓库
			await this.gitOperations.renameNestedGitRepos(false)
			throw error
		}
	}

	/**
	 * 清理任务相关的资源。
	 *
	 * @returns Promise<void>
	 */
	public async cleanup(): Promise<void> {
		if (!this.shadowGit || !this.gitPath) {
			return
		}

		try {
			// 删除任务分支
			await this.gitOperations.deleteTaskBranch(this.taskId, this.gitPath)
		} catch (error) {
			console.error("清理任务资源失败:", error)
			throw error
		}
	}

	/**
	 * 创建一个新的 CheckpointTracker 实例。
	 *
	 * @param provider - 存储提供者
	 * @param taskId - 任务 ID
	 * @returns Promise<CheckpointTracker>
	 */
	public static async create(provider: StorageProvider, taskId: string): Promise<CheckpointTracker> {
		const vscodeGlobalStorageCoolClinePath = provider.context.globalStorageUri.fsPath
		if (!vscodeGlobalStorageCoolClinePath) {
			throw new Error("无法获取 VSCode 全局存储路径")
		}

		const userProjectPath = await getWorkingDirectory()
		const tracker = new CheckpointTracker(vscodeGlobalStorageCoolClinePath, taskId, userProjectPath)
		await tracker.initialize()
		return tracker
	}

	/**
	 * 获取跨任务的差异
	 *
	 * @param fromTaskId - 起始任务 ID
	 * @param fromHash - 起始提交哈希
	 * @param toTaskId - 结束任务 ID
	 * @param toHash - 结束提交哈希
	 * @returns Promise<Array<{paths: {relative: string, absolute: string}, content: {before: string, after: string}}>>
	 */
	public async getDiffAcrossTasks(
		fromTaskId: string,
		fromHash: string,
		toTaskId: string,
		toHash: string,
	): Promise<CheckpointDiff[]> {
		if (!this.shadowGit || !this.gitPath) {
			throw new Error("Checkpoint 跟踪器未初始化")
		}

		return await this.gitOperations.getDiffAcrossTasks(this.gitPath, fromTaskId, fromHash, toTaskId, toHash)
	}

	/**
	 * 暂存当前更改
	 * @returns Promise<boolean> 是否有更改被暂存
	 */
	public async stashChanges(): Promise<boolean> {
		if (!this.shadowGit || !this.gitPath) {
			throw new Error("Checkpoint 跟踪器未初始化")
		}

		return await this.gitOperations.stashChanges(this.gitPath)
	}

	/**
	 * 应用最近的 stash
	 * @returns Promise<boolean> 是否有 stash 被应用
	 */
	public async applyStash(): Promise<boolean> {
		if (!this.shadowGit || !this.gitPath) {
			throw new Error("Checkpoint 跟踪器未初始化")
		}

		return await this.gitOperations.applyStash(this.gitPath)
	}

	/**
	 * 弹出最近的 stash
	 * @returns Promise<boolean> 是否有 stash 被弹出
	 */
	public async popStash(): Promise<boolean> {
		if (!this.shadowGit || !this.gitPath) {
			throw new Error("Checkpoint 跟踪器未初始化")
		}

		return await this.gitOperations.popStash(this.gitPath)
	}
}
