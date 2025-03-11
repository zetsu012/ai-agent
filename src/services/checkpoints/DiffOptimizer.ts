import { SimpleGit, DiffResult } from "simple-git"
import { CacheManager } from "./CacheManager"
import { PathUtils } from "./CheckpointUtils"
import pLimit from "p-limit"

/**
 * Diff 计算优化器
 * 实现增量 diff 计算和并发控制
 */
export class DiffOptimizer {
	private readonly cache: CacheManager
	private readonly concurrencyLimit: number
	private readonly limiter: ReturnType<typeof pLimit>

	constructor(
		private readonly git: SimpleGit,
		concurrencyLimit = 5,
	) {
		this.cache = CacheManager.getInstance()
		this.concurrencyLimit = concurrencyLimit
		this.limiter = pLimit(concurrencyLimit)
	}

	/**
	 * 计算两个提交之间的差异
	 * 使用增量计算和缓存优化性能
	 */
	async computeDiff(
		fromHash: string,
		toHash: string,
	): Promise<
		Array<{
			relativePath: string
			absolutePath: string
			before: string
			after: string
		}>
	> {
		const cacheKey = `diff:${fromHash}:${toHash}`
		const cached = this.cache.get<any[]>(cacheKey)
		if (cached) {
			return cached
		}

		// 获取变更的文件列表
		const summary = await this.git.diffSummary([fromHash, toHash])
		const result = []

		// 并发获取文件内容
		const promises = summary.files.map((file) =>
			this.limiter(async () => {
				const relativePath = PathUtils.normalizePath(file.file)
				const absolutePath = PathUtils.handleLongPath(relativePath)

				let before = ""
				let after = ""

				// 检查文件是否有实际变更
				if (!file.binary) {
					try {
						before = await this.git.show([`${fromHash}:${file.file}`])
					} catch (error) {
						// 文件在 fromHash 中不存在
					}

					try {
						after = await this.git.show([`${toHash}:${file.file}`])
					} catch (error) {
						// 文件在 toHash 中不存在
					}
				}

				return {
					relativePath,
					absolutePath,
					before,
					after,
				}
			}),
		)

		const diffs = await Promise.all(promises)
		result.push(...diffs)

		// 缓存结果
		this.cache.set(cacheKey, result)

		return result
	}

	/**
	 * 计算增量差异
	 * 只处理实际变更的部分
	 */
	async computeIncrementalDiff(
		baseHash: string,
		targetHash: string,
		lastKnownHash?: string,
	): Promise<
		Array<{
			relativePath: string
			absolutePath: string
			before: string
			after: string
		}>
	> {
		// 如果有上一次的哈希，计算增量差异
		if (lastKnownHash) {
			const incrementalChanges = await this.git.diffSummary([lastKnownHash, targetHash])
			if (incrementalChanges.files.length > 0) {
				// 有变化，计算增量差异
				return this.computeDiff(lastKnownHash, targetHash)
			}
			// 没有变化，返回缓存的结果
			const cacheKey = `diff:${baseHash}:${lastKnownHash}`
			const cached = this.cache.get<any[]>(cacheKey)
			if (cached) {
				return cached
			}
		}

		// 如果没有增量信息或缓存，计算完整差异
		return this.computeDiff(baseHash, targetHash)
	}

	/**
	 * 预热缓存
	 * 预先计算可能需要的差异
	 */
	async warmupCache(commits: string[]): Promise<void> {
		// 限制并发数量
		const tasks = []
		for (let i = 0; i < commits.length - 1; i++) {
			for (let j = i + 1; j < commits.length; j++) {
				const fromHash = commits[i]
				const toHash = commits[j]
				const cacheKey = `diff:${fromHash}:${toHash}`

				// 如果缓存中没有，添加到任务列表
				if (!this.cache.get(cacheKey)) {
					tasks.push(
						this.limiter(async () => {
							await this.computeDiff(fromHash, toHash)
						}),
					)
				}
			}
		}

		// 并发执行预热任务
		await Promise.all(tasks)
	}

	/**
	 * 清理过期的缓存
	 */
	clearExpiredCache(): void {
		this.cache.clearExpired()
	}
}
