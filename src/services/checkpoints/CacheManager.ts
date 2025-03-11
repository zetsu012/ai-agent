import { PathUtils } from "./CheckpointUtils"

/**
 * 缓存项
 */
interface CacheItem<T> {
	data: T
	timestamp: number
	expiry: number
}

/**
 * 缓存配置
 */
interface CacheConfig {
	// 默认过期时间（毫秒）
	defaultExpiry: number
	// 最大缓存项数
	maxItems: number
}

/**
 * 缓存管理器
 * 用于优化性能，减少重复操作
 */
export class CacheManager {
	private static instance: CacheManager
	private cache: Map<string, CacheItem<any>>
	private config: CacheConfig

	private constructor() {
		this.cache = new Map()
		this.config = {
			defaultExpiry: 5 * 60 * 1000, // 5分钟
			maxItems: 1000,
		}
	}

	/**
	 * 获取单例实例
	 */
	public static getInstance(): CacheManager {
		if (!CacheManager.instance) {
			CacheManager.instance = new CacheManager()
		}
		return CacheManager.instance
	}

	/**
	 * 设置缓存项
	 */
	public set<T>(key: string, value: T, expiry?: number): void {
		// 如果缓存已满，删除最旧的项
		if (this.cache.size >= this.config.maxItems) {
			const oldestKey = Array.from(this.cache.entries()).sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0]
			this.cache.delete(oldestKey)
		}

		this.cache.set(key, {
			data: value,
			timestamp: Date.now(),
			expiry: expiry || this.config.defaultExpiry,
		})
	}

	/**
	 * 获取缓存项
	 */
	public get<T>(key: string): T | undefined {
		const item = this.cache.get(key)
		if (!item) {
			return undefined
		}

		// 检查是否过期
		if (Date.now() - item.timestamp > item.expiry) {
			this.cache.delete(key)
			return undefined
		}

		return item.data as T
	}

	/**
	 * 删除缓存项
	 */
	public delete(key: string): void {
		this.cache.delete(key)
	}

	/**
	 * 清除所有缓存
	 */
	public clear(): void {
		this.cache.clear()
	}

	/**
	 * 清除过期的缓存项
	 */
	public clearExpired(): void {
		const now = Date.now()
		for (const [key, item] of this.cache.entries()) {
			if (now - item.timestamp > item.expiry) {
				this.cache.delete(key)
			}
		}
	}

	/**
	 * 获取缓存统计信息
	 */
	public getStats(): { size: number; maxItems: number } {
		return {
			size: this.cache.size,
			maxItems: this.config.maxItems,
		}
	}

	/**
	 * 更新配置
	 */
	public updateConfig(config: Partial<CacheConfig>): void {
		this.config = { ...this.config, ...config }
	}
}
