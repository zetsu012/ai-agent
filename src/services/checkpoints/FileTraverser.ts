import fs from "fs/promises"
import { existsSync } from "fs"
import { PathUtils } from "./CheckpointUtils"
import { FileFilter } from "./FileFilter"
import pLimit from "p-limit"
import { Worker } from "worker_threads"

/**
 * 文件遍历配置
 */
export interface TraverseConfig {
	// 并发数
	concurrency: number
	// 是否使用 worker 线程
	useWorker: boolean
	// 批处理大小
	batchSize: number
	// 是否跳过隐藏文件
	skipHidden: boolean
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TraverseConfig = {
	concurrency: 5,
	useWorker: true,
	batchSize: 1000,
	skipHidden: true,
}

/**
 * 文件遍历优化器
 * 使用并发和 worker 线程优化文件遍历性能
 */
export class FileTraverser {
	private readonly config: TraverseConfig
	private readonly limiter: ReturnType<typeof pLimit>
	private readonly fileFilter: FileFilter
	private workers: Worker[] = []

	constructor(
		private readonly workspaceRoot: string,
		config: Partial<TraverseConfig> = {},
	) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.limiter = pLimit(this.config.concurrency)
		this.fileFilter = new FileFilter(workspaceRoot)
	}

	/**
	 * 遍历目录获取所有文件
	 * 使用并发和批处理优化性能
	 */
	async traverseFiles(): Promise<string[]> {
		const allFiles: string[] = []
		const batches: string[][] = [[]]
		let currentBatch = 0

		// 递归遍历目录
		const traverse = async (dir: string) => {
			try {
				const entries = await fs.readdir(dir, { withFileTypes: true })

				for (const entry of entries) {
					// 跳过隐藏文件
					if (this.config.skipHidden && entry.name.startsWith(".")) {
						continue
					}

					const fullPath = PathUtils.joinPath(dir, entry.name)

					if (entry.isDirectory()) {
						// 递归遍历子目录
						await traverse(fullPath)
					} else if (entry.isFile()) {
						// 添加到当前批次
						if (batches[currentBatch].length >= this.config.batchSize) {
							currentBatch++
							batches[currentBatch] = []
						}
						batches[currentBatch].push(fullPath)
					}
				}
			} catch (error) {
				console.error("遍历目录失败:", error)
			}
		}

		// 开始遍历
		await traverse(this.workspaceRoot)

		// 并发处理每个批次
		const processedBatches = await Promise.all(batches.map((batch) => this.processBatch(batch)))

		// 合并结果
		for (const batch of processedBatches) {
			allFiles.push(...batch)
		}

		return allFiles
	}

	/**
	 * 处理文件批次
	 * 使用 worker 线程或并发处理
	 */
	private async processBatch(files: string[]): Promise<string[]> {
		if (this.config.useWorker) {
			return this.processWithWorker(files)
		} else {
			return this.processWithConcurrency(files)
		}
	}

	/**
	 * 使用 worker 线程处理文件
	 */
	private async processWithWorker(files: string[]): Promise<string[]> {
		// TODO: 实现 worker 线程处理
		// 由于 worker 线程实现较复杂，这里先使用并发处理
		return this.processWithConcurrency(files)
	}

	/**
	 * 使用并发处理文件
	 */
	private async processWithConcurrency(files: string[]): Promise<string[]> {
		const result: string[] = []

		const promises = files.map((file) =>
			this.limiter(async () => {
				if (!(await this.fileFilter.shouldExclude(file))) {
					return file
				}
				return undefined
			}),
		)

		const processed = await Promise.all(promises)
		result.push(...processed.filter((file): file is string => file !== undefined))

		return result
	}

	/**
	 * 清理资源
	 */
	dispose(): void {
		// 停止所有 worker 线程
		for (const worker of this.workers) {
			worker.terminate()
		}
		this.workers = []
	}
}
