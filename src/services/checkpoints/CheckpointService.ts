import { SimpleGit, simpleGit } from "simple-git"
import * as vscode from "vscode"
import { CheckpointTracker } from "./CheckpointTracker"
import { CheckpointMigration } from "./CheckpointMigration"
import { GitOperations } from "./GitOperations"
import { getWorkingDirectory, PathUtils, getShadowGitPath, hashWorkingDir } from "./CheckpointUtils"
import { StorageProvider, Checkpoint, CheckpointDiff, CheckpointServiceOptions } from "./types"

/**
 * Checkpoint 恢复模式
 */
// export type RestoreMode = "files" | "messages" | "files_and_messages"
export type DiffMode = "full" | "checkpoint" | "cross_task"

export interface CrossTaskDiffOptions {
	fromTaskId: string
	fromHash: string
	toTaskId: string
	toHash: string
}

/**
 * Checkpoint 服务类
 * 作为唯一的对外接口，整合所有 checkpoint 相关功能
 */
export class CheckpointService {
	private static readonly USER_NAME = "CoolCline"
	private static readonly USER_EMAIL = "support@coolcline.com"
	private static readonly CLEANUP_THRESHOLD = 50 // 检查点数量阈值
	private static readonly MAX_DIFF_SIZE = 1024 * 1024 * 10 // 10MB

	private readonly outputChannel: vscode.OutputChannel
	private readonly tracker: CheckpointTracker
	private readonly gitOps: GitOperations
	private lastCheckpoint?: string
	private git: SimpleGit
	private readonly vscodeGlobalStorageCoolClinePath: string
	private readonly userProjectPath: string
	private readonly _taskId: string
	private readonly log: (message: string) => void
	private gitPath?: string
	private isInitialized = false // 添加初始化状态标志

	constructor(options: CheckpointServiceOptions) {
		this.vscodeGlobalStorageCoolClinePath = PathUtils.normalizePath(
			options.provider?.context.globalStorageUri.fsPath ?? "",
		)
		this.userProjectPath = PathUtils.normalizePath(options.userProjectPath)
		this.git = options.git || simpleGit(this.vscodeGlobalStorageCoolClinePath)
		this._taskId = options.taskId
		this.log = options.log || console.log
		this.outputChannel = vscode.window.createOutputChannel("Checkpoint Service")
		this.tracker = new CheckpointTracker(this.vscodeGlobalStorageCoolClinePath, this._taskId, this.userProjectPath)
		this.gitOps = new GitOperations(this.vscodeGlobalStorageCoolClinePath, this.userProjectPath)
	}

	get taskId(): string {
		return this._taskId
	}

	/**
	 * 创建 CheckpointService 实例
	 * 核心职责：
	 * 1. 获取用户项目路径（通过 getWorkingDirectory）
	 * 2. 规范化全局存储路径（使用 PathUtils）
	 * 3. 构造服务实例（依赖注入）
	 */
	public static async create(taskId: string, provider: StorageProvider): Promise<CheckpointService> {
		const userProjectPath = await getWorkingDirectory()
		return new CheckpointService({
			userProjectPath: PathUtils.normalizePath(userProjectPath),
			vscodeGlobalStorageCoolClinePath: PathUtils.normalizePath(provider.context.globalStorageUri.fsPath),
			taskId,
			provider,
			log: console.log,
		})
	}

	/**
	 * 初始化 checkpoint 服务
	 * CoolCline.ts 中先调用 create，之后才用 create 的服务 initialize，伪代码为
	 * const service = await CheckpointService.create(...)
	 * await service.initialize()
	 *
	 * 核心职责：
	 * 1. 执行数据迁移（当前注释掉）
	 * 2. 初始化 tracker 组件
	 * 3. 处理服务启动逻辑
	 */
	public async initialize(): Promise<void> {
		try {
			// 暂时跳过迁移步骤
			// await CheckpointMigration.cleanupLegacyCheckpoints(this.userProjectPath, this.outputChannel)
			// await CheckpointMigration.migrateToNewStructure(this.userProjectPath, this.outputChannel)

			// 直接初始化 tracker
			try {
				await this.tracker.initialize()
				this.isInitialized = true // 初始化成功后设置标志
			} catch (error) {
				this.outputChannel.appendLine(`tracker 初始化失败: ${error}`)
				throw error
			}

			// 获取 shadow git 路径
			const coolclineShadowGitPath = await getShadowGitPath(
				this.vscodeGlobalStorageCoolClinePath,
				this._taskId,
				hashWorkingDir(this.userProjectPath),
			)
			this.gitPath = coolclineShadowGitPath
		} catch (error) {
			this.outputChannel.appendLine(`初始化失败: ${error}`)
			throw error
		}
	}

	/**
	 * 保存 checkpoint
	 * @param message - checkpoint 消息
	 */
	public async saveCheckpoint(message: string): Promise<Checkpoint> {
		if (!this.gitPath) {
			throw new Error("Checkpoint 服务未初始化")
		}

		if (!this.isInitialized) {
			await this.tracker.initialize()
		}

		const commitHash = await this.gitOps.commit(this.gitPath, message)
		await this.scheduleCleanup() // 在创建新的 checkpoint 后执行清理
		return {
			hash: commitHash,
			message,
			timestamp: new Date(),
		}
	}

	/**
	 * 获取文件差异
	 */
	public async getDiff(hash1: string, hash2?: string): Promise<CheckpointDiff[]> {
		if (!this.gitPath) {
			throw new Error("Checkpoint 服务未初始化")
		}
		// console.log("CheckpointService.ts 中执行 getDiff hash1: ", hash1)
		// console.log("CheckpointService.ts 中执行 getDiff hash2: ", hash2)
		const changes = await this.gitOps.getDiff(this.gitPath, hash1, hash2)
		return this.optimizeDiff(changes)
	}

	/**
	 * 比较两个任务之间的差异
	 */
	public async getDiffAcrossTasks(otherTaskId: string, fromHash: string, toHash: string): Promise<CheckpointDiff[]> {
		try {
			const otherTracker = new CheckpointTracker(this.userProjectPath, otherTaskId, this.userProjectPath)
			return await otherTracker.getDiff(fromHash, toHash)
		} catch (error) {
			this.outputChannel.appendLine(`获取跨任务差异失败: ${error}`)
			throw error
		}
	}

	/**
	 * 恢复到指定的 checkpoint
	 * @param commitHash - 要恢复到的 commit hash
	 * @param mode - 恢复模式
	 */
	public async restoreCheckpoint(commitHash: string): Promise<void> {
		if (!this.gitPath) {
			throw new Error("Checkpoint 服务未初始化")
		}
		console.log("CheckpointService.ts 中执行 restoreCheckpoint commitHash: ", commitHash)
		try {
			// 暂存当前更改
			const hasStash = await this.tracker.stashChanges()

			try {
				await this.tracker.restoreCheckpoint(commitHash)

				// 如果有暂存的更改，尝试重新应用
				if (hasStash) {
					await this.tracker.stashChanges()
				}
			} catch (error) {
				// 如果恢复失败且有暂存的更改，恢复暂存
				if (hasStash) {
					await this.tracker.stashChanges()
				}
				throw error
			}
		} catch (error) {
			this.outputChannel.appendLine(`恢复 checkpoint 失败: ${error}`)
			throw error
		}
	}

	/**
	 * 获取 checkpoint 历史记录
	 */
	public async getHistory(): Promise<Checkpoint[]> {
		if (!this.gitPath) {
			throw new Error("Checkpoint 服务未初始化")
		}
		const commits = await this.gitOps.getCommits(this.gitPath)
		return commits.map((commit) => ({
			hash: commit.hash,
			message: commit.message,
			timestamp: new Date(commit.date),
		}))
	}

	/**
	 * 清理孤立的资源
	 */
	public async cleanup(activeTasks: string[]): Promise<void> {
		try {
			await CheckpointMigration.cleanupOrphanedResources(this.userProjectPath, activeTasks, this.outputChannel)
			await this.tracker.cleanup()
		} catch (error) {
			this.outputChannel.appendLine(`清理失败: ${error}`)
			throw error
		}
	}

	/**
	 * 销毁服务实例
	 */
	public dispose(): void {
		this.outputChannel.dispose()
	}

	private async scheduleCleanup() {
		if (!this.gitPath) {
			throw new Error("Checkpoint 服务未初始化")
		}
		try {
			const checkpoints = await this.getHistory()
			if (checkpoints.length > CheckpointService.CLEANUP_THRESHOLD) {
				// 保留最近的 checkpoints
				const checkpointsToRemove = checkpoints
					.slice(CheckpointService.CLEANUP_THRESHOLD)
					.map((checkpoint: Checkpoint) => checkpoint.hash)
				await this.gitOps.cleanupCheckpoints(this.gitPath, checkpointsToRemove)
				this.log(`Cleaned up ${checkpointsToRemove.length} old checkpoints`)
			}
		} catch (error) {
			this.log(`Failed to cleanup checkpoints: ${error}`)
		}
	}

	private optimizeDiff(changes: CheckpointDiff[]): CheckpointDiff[] {
		return changes.filter((change) => {
			const totalSize = (change.before?.length || 0) + (change.after?.length || 0)
			return totalSize <= CheckpointService.MAX_DIFF_SIZE
		})
	}
}
