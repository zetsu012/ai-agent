import fs from "fs/promises"
import * as vscode from "vscode"
import { fileExists, PathUtils } from "./CheckpointUtils"

/**
 * CheckpointMigration 类
 *
 * 处理 checkpoint 系统的迁移和清理。
 * 主要用于：
 * - 清理旧版本的 checkpoints
 * - 迁移到新的存储结构
 * - 处理孤立的资源
 */
export class CheckpointMigration {
	/**
	 * 清理旧版本的 checkpoints
	 * 这是一个一次性操作，在扩展更新到新的 checkpoint 系统时运行
	 *
	 * @param vscodeGlobalStorageCoolClinePath - 扩展的全局存储路径
	 * @param outputChannel - VSCode 输出通道，用于日志记录
	 */
	public static async cleanupLegacyCheckpoints(
		vscodeGlobalStorageCoolClinePath: string,
		outputChannel: vscode.OutputChannel,
	): Promise<void> {
		try {
			outputChannel.appendLine("检查旧版本 checkpoints...")

			const tasksDir = PathUtils.joinPath(vscodeGlobalStorageCoolClinePath, "tasks")

			// 检查任务目录是否存在
			if (!(await fileExists(tasksDir))) {
				return // 没有任务目录，无需清理
			}

			// 删除整个任务目录
			await fs.rm(tasksDir, { recursive: true, force: true })
			outputChannel.appendLine("旧版本 checkpoints 清理完成")
		} catch (error) {
			outputChannel.appendLine(`清理旧版本 checkpoints 失败: ${error}`)
			// 不抛出错误，因为这是清理操作
		}
	}

	/**
	 * 迁移到新的存储结构
	 * 将独立的 checkpoint 仓库合并到单一的 shadow git 仓库中
	 *
	 * @param vscodeGlobalStorageCoolClinePath - 扩展的全局存储路径
	 * @param outputChannel - VSCode 输出通道，用于日志记录
	 */
	public static async migrateToNewStructure(
		vscodeGlobalStorageCoolClinePath: string,
		outputChannel: vscode.OutputChannel,
	): Promise<void> {
		try {
			outputChannel.appendLine("开始迁移到新的存储结构...")

			const oldCheckpointsDir = PathUtils.joinPath(vscodeGlobalStorageCoolClinePath, "checkpoints")
			const newCheckpointsDir = PathUtils.joinPath(vscodeGlobalStorageCoolClinePath, "shadow-git")

			// 检查旧目录是否存在
			if (!(await fileExists(oldCheckpointsDir))) {
				// 创建新目录结构
				await fs.mkdir(newCheckpointsDir, { recursive: true })
				return
			}

			// 创建新目录
			await fs.mkdir(newCheckpointsDir, { recursive: true })

			try {
				// 获取所有工作区目录
				const workspaceDirs = await fs.readdir(oldCheckpointsDir)

				for (const workspaceDir of workspaceDirs) {
					const oldWorkspacePath = PathUtils.joinPath(oldCheckpointsDir, workspaceDir)
					const newWorkspacePath = PathUtils.joinPath(newCheckpointsDir, workspaceDir)

					// 如果是目录且包含 .git
					if ((await fs.stat(oldWorkspacePath)).isDirectory()) {
						const gitDir = PathUtils.joinPath(oldWorkspacePath, ".git")
						if (await fileExists(gitDir)) {
							try {
								// 如果目标目录已存在，先删除它
								if (await fileExists(newWorkspacePath)) {
									await fs.rm(newWorkspacePath, { recursive: true, force: true })
								}
								// 移动到新位置
								await fs.rename(oldWorkspacePath, newWorkspacePath)
								outputChannel.appendLine(`已迁移: ${oldWorkspacePath} -> ${newWorkspacePath}`)
							} catch (error) {
								outputChannel.appendLine(`迁移 ${oldWorkspacePath} 失败: ${error}`)
								// 继续处理其他目录
								continue
							}
						}
					}
				}
			} catch (error) {
				outputChannel.appendLine(`读取目录失败: ${error}`)
				// 不抛出错误，继续执行
			}

			// 删除旧目录
			try {
				await fs.rm(oldCheckpointsDir, { recursive: true, force: true })
				outputChannel.appendLine("迁移完成")
			} catch (error) {
				outputChannel.appendLine(`删除旧目录失败: ${error}`)
				// 不抛出错误，因为主要迁移工作已完成
			}
		} catch (error) {
			outputChannel.appendLine(`迁移失败: ${error}`)
			// 不抛出错误，因为这是迁移操作
		}
	}

	/**
	 * 清理孤立的资源
	 * 删除没有对应任务的 checkpoint 分支
	 *
	 * @param vscodeGlobalStorageCoolClinePath - 扩展的全局存储路径
	 * @param activeTasks - 活动任务的 ID 列表
	 * @param outputChannel - VSCode 输出通道，用于日志记录
	 */
	public static async cleanupOrphanedResources(
		vscodeGlobalStorageCoolClinePath: string,
		activeTasks: string[],
		outputChannel: vscode.OutputChannel,
	): Promise<void> {
		try {
			outputChannel.appendLine("开始清理孤立资源...")

			const checkpointsDir = PathUtils.joinPath(vscodeGlobalStorageCoolClinePath, "shadow-git")
			if (!(await fileExists(checkpointsDir))) {
				return
			}

			// 获取所有工作区目录
			const workspaceDirs = await fs.readdir(checkpointsDir)

			for (const workspaceDir of workspaceDirs) {
				const workspacePath = PathUtils.joinPath(checkpointsDir, workspaceDir)
				const gitDir = PathUtils.joinPath(workspacePath, ".git")

				if (await fileExists(gitDir)) {
					// 获取所有分支
					const branchesFile = PathUtils.joinPath(gitDir, "refs", "heads")
					if (await fileExists(branchesFile)) {
						const branches = await fs.readdir(branchesFile)

						// 删除不在活动任务列表中的分支
						for (const branch of branches) {
							const taskId = branch.replace("task-", "")
							if (!activeTasks.includes(taskId)) {
								const branchPath = PathUtils.joinPath(branchesFile, branch)
								await fs.unlink(branchPath)
								outputChannel.appendLine(`已删除孤立分支: ${branch}`)
							}
						}
					}
				}
			}

			outputChannel.appendLine("孤立资源清理完成")
		} catch (error) {
			outputChannel.appendLine(`清理孤立资源失败: ${error}`)
			throw error
		}
	}
}
