import fs from "fs/promises"
import { existsSync } from "fs"
import * as vscode from "vscode"
import { PathUtils } from "./CheckpointUtils"
import simpleGit, { SimpleGit } from "simple-git"

/**
 * Checkpoint 恢复和清理管理器
 * 负责处理错误恢复和资源清理
 */
export class CheckpointRecovery {
	private readonly lockFile: string
	private readonly backupDir: string
	private readonly git: SimpleGit

	constructor(
		private readonly vscodeGlobalStorageCoolClinePath: string,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		this.lockFile = PathUtils.joinPath(vscodeGlobalStorageCoolClinePath, ".checkpoint-lock")
		this.backupDir = PathUtils.joinPath(vscodeGlobalStorageCoolClinePath, ".checkpoint-backup")
		this.git = simpleGit(vscodeGlobalStorageCoolClinePath)
	}

	/**
	 * 开始一个事务
	 * @param taskId - 当前任务 ID
	 */
	async beginTransaction(taskId: string): Promise<void> {
		try {
			// 检查是否有未完成的事务
			if (await this.hasUnfinishedTransaction()) {
				await this.recoverFromLastTransaction()
			}

			// 创建备份目录
			await fs.mkdir(this.backupDir, { recursive: true })

			// 创建锁文件
			await fs.writeFile(
				this.lockFile,
				JSON.stringify({
					taskId,
					timestamp: new Date().toISOString(),
					state: "started",
				}),
			)

			// 创建工作区快照
			await this.createWorkspaceSnapshot()
		} catch (error) {
			this.outputChannel.appendLine(`开始事务失败: ${error}`)
			throw error
		}
	}

	/**
	 * 提交事务
	 */
	async commitTransaction(): Promise<void> {
		try {
			// 删除锁文件和备份
			await this.cleanup()
		} catch (error) {
			this.outputChannel.appendLine(`提交事务失败: ${error}`)
			throw error
		}
	}

	/**
	 * 回滚事务
	 */
	async rollbackTransaction(): Promise<void> {
		try {
			if (await this.hasUnfinishedTransaction()) {
				await this.restoreWorkspaceSnapshot()
			}
			await this.cleanup()
		} catch (error) {
			this.outputChannel.appendLine(`回滚事务失败: ${error}`)
			throw error
		}
	}

	/**
	 * 检查是否有未完成的事务
	 */
	private async hasUnfinishedTransaction(): Promise<boolean> {
		return existsSync(this.lockFile)
	}

	/**
	 * 从上一个事务恢复
	 */
	private async recoverFromLastTransaction(): Promise<void> {
		try {
			const lockContent = await fs.readFile(this.lockFile, "utf-8")
			const { state } = JSON.parse(lockContent)

			if (state === "started") {
				await this.restoreWorkspaceSnapshot()
			}

			await this.cleanup()
		} catch (error) {
			this.outputChannel.appendLine(`恢复上一个事务失败: ${error}`)
			throw error
		}
	}

	/**
	 * 创建工作区快照
	 */
	private async createWorkspaceSnapshot(): Promise<void> {
		try {
			// 获取当前工作区状态
			const status = await this.git.status()

			// 保存修改的文件
			for (const file of status.files) {
				const filePath = PathUtils.joinPath(this.vscodeGlobalStorageCoolClinePath, file.path)
				const backupPath = PathUtils.joinPath(this.backupDir, file.path)

				// 创建备份目录
				await fs.mkdir(PathUtils.dirname(backupPath), { recursive: true })

				// 如果文件存在，创建备份
				if (existsSync(filePath)) {
					await fs.copyFile(filePath, backupPath)
				}
			}

			// 保存 Git 状态
			await fs.writeFile(PathUtils.joinPath(this.backupDir, ".git-status"), JSON.stringify(status))
		} catch (error) {
			this.outputChannel.appendLine(`创建工作区快照失败: ${error}`)
			throw error
		}
	}

	/**
	 * 恢复工作区快照
	 */
	private async restoreWorkspaceSnapshot(): Promise<void> {
		try {
			// 读取 Git 状态
			const statusPath = PathUtils.joinPath(this.backupDir, ".git-status")
			if (!existsSync(statusPath)) {
				return
			}

			const statusContent = await fs.readFile(statusPath, "utf-8")
			const status = JSON.parse(statusContent)

			// 恢复文件
			for (const file of status.files) {
				const filePath = PathUtils.joinPath(this.vscodeGlobalStorageCoolClinePath, file.path)
				const backupPath = PathUtils.joinPath(this.backupDir, file.path)

				if (existsSync(backupPath)) {
					await fs.copyFile(backupPath, filePath)
				}
			}
		} catch (error) {
			this.outputChannel.appendLine(`恢复工作区快照失败: ${error}`)
			throw error
		}
	}

	/**
	 * 清理临时文件
	 */
	private async cleanup(): Promise<void> {
		try {
			if (existsSync(this.lockFile)) {
				await fs.unlink(this.lockFile)
			}
			if (existsSync(this.backupDir)) {
				await fs.rm(this.backupDir, { recursive: true, force: true })
			}
		} catch (error) {
			this.outputChannel.appendLine(`清理临时文件失败: ${error}`)
			throw error
		}
	}

	/**
	 * 清理孤立的资源
	 * @param activeTasks - 活动任务列表
	 */
	async cleanupOrphanedResources(activeTasks: string[]): Promise<void> {
		try {
			// 获取所有任务分支
			const branches = await this.git.branch()
			const taskBranches = branches.all.filter((b) => b.startsWith("task-"))

			// 删除不活跃的任务分支
			for (const branch of taskBranches) {
				const taskId = branch.replace("task-", "")
				if (!activeTasks.includes(taskId)) {
					await this.git.deleteLocalBranch(branch, true)
					this.outputChannel.appendLine(`已删除孤立的任务分支: ${branch}`)
				}
			}

			// 清理备份和锁文件
			await this.cleanup()

			// TODO: 清理其他资源（如 LFS 对象、临时文件等）
		} catch (error) {
			this.outputChannel.appendLine(`清理孤立资源失败: ${error}`)
			throw error
		}
	}
}
