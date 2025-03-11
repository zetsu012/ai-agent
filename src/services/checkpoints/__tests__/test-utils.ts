import { jest } from "@jest/globals"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as os from "os"
import { CheckpointService } from "../CheckpointService"
import { StorageProvider } from "../types"
import { GitOperations } from "../GitOperations"
import simpleGit from "simple-git"
import { PathUtils } from "../CheckpointUtils"

export interface TestEnvironment {
	workspaceRoot: string
	testFilePath: string
	globalStoragePath: string
	cleanup: () => Promise<void>
}

export async function createTestEnvironment(): Promise<TestEnvironment> {
	const workspaceRoot = await fs.mkdtemp(PathUtils.joinPath(os.tmpdir(), "test-workspace-"))
	const globalStoragePath = await fs.mkdtemp(PathUtils.joinPath(os.tmpdir(), "test-storage-"))

	// 创建测试文件目录和文件
	const testDir = PathUtils.joinPath(workspaceRoot, "src")
	await fs.mkdir(testDir, { recursive: true })

	// 创建测试所需的文件
	await fs.writeFile(PathUtils.joinPath(testDir, "app.js"), "console.log('app');")
	await fs.writeFile(PathUtils.joinPath(testDir, "test.js"), "console.log('test');")

	// 创建必要的目录结构
	const checkpointsDir = PathUtils.joinPath(workspaceRoot, "checkpoints")
	const tasksDir = PathUtils.joinPath(workspaceRoot, "tasks")
	await fs.mkdir(checkpointsDir, { recursive: true })
	await fs.mkdir(tasksDir, { recursive: true })

	// 创建 .gitignore 文件
	await fs.writeFile(PathUtils.joinPath(workspaceRoot, ".gitignore"), "node_modules\n.git\n")

	// 更新 VSCode workspace mock
	const mockWorkspace = vscode.workspace as any
	mockWorkspace.workspaceFolders = [
		{
			uri: vscode.Uri.file(workspaceRoot),
			name: "test",
			index: 0,
		},
	]

	return {
		workspaceRoot,
		testFilePath: PathUtils.joinPath(testDir, "app.js"),
		globalStoragePath,
		cleanup: async () => {
			try {
				await fs.rm(workspaceRoot, { recursive: true, force: true })
				await fs.rm(globalStoragePath, { recursive: true, force: true })
			} catch (error) {
				console.error("清理测试环境时出错:", error)
			}
		},
	}
}

class MockStorageProvider implements StorageProvider {
	private readonly _globalStoragePath: string
	context: any

	constructor(globalStoragePath: string) {
		this._globalStoragePath = globalStoragePath
		this.context = {
			globalStorageUri: vscode.Uri.file(this._globalStoragePath),
		}
	}
}

export async function createTestService(env: TestEnvironment): Promise<CheckpointService> {
	const gitOps = new GitOperations(env.globalStoragePath, env.workspaceRoot)
	const shadowGitDir = PathUtils.joinPath(env.globalStoragePath, "shadow-git", "test-hash")
	const gitPath = PathUtils.joinPath(shadowGitDir, ".git")

	// 确保目录存在
	await fs.mkdir(shadowGitDir, { recursive: true })

	// 初始化 shadow git
	await gitOps.initShadowGit(gitPath)

	// 初始化工作区 git
	const git = simpleGit(env.workspaceRoot)
	await git.init()
	await git.addConfig("core.worktree", env.workspaceRoot)
	await git.add(".")
	await git.commit("Initial commit")

	const provider = new MockStorageProvider(env.globalStoragePath)
	const service = new CheckpointService({
		userProjectPath: env.workspaceRoot,
		taskId: "test-task-1",
		provider,
		log: () => {}, // 静默日志
		vscodeGlobalStorageCoolClinePath: env.globalStoragePath,
	})
	return service
}
