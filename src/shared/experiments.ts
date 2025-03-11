export const EXPERIMENT_IDS = {
	DIFF_STRATEGY: "experimentalDiffStrategy",
	SEARCH_AND_REPLACE: "search_and_replace",
	INSERT_BLOCK: "insert_content",
} as const

export type ExperimentKey = keyof typeof EXPERIMENT_IDS
export type ExperimentId = valueof<typeof EXPERIMENT_IDS>

export interface ExperimentConfig {
	name: string
	description: string
	enabled: boolean
}

type valueof<X> = X[keyof X]

export const experimentConfigsMap: Record<ExperimentKey, ExperimentConfig> = {
	DIFF_STRATEGY: {
		name: "settings.experiments.features.DIFF_STRATEGY.name",
		description: "settings.experiments.features.DIFF_STRATEGY.description",
		enabled: false,
	},
	SEARCH_AND_REPLACE: {
		name: "settings.experiments.features.SEARCH_AND_REPLACE.name",
		description: "settings.experiments.features.SEARCH_AND_REPLACE.description",
		enabled: false,
	},
	INSERT_BLOCK: {
		name: "settings.experiments.features.INSERT_BLOCK.name",
		description: "settings.experiments.features.INSERT_BLOCK.description",
		enabled: false,
	},
}

export const experimentDefault = Object.fromEntries(
	Object.entries(experimentConfigsMap).map(([_, config]) => [
		EXPERIMENT_IDS[_ as keyof typeof EXPERIMENT_IDS] as ExperimentId,
		config.enabled,
	]),
) as Record<ExperimentId, boolean>

export const experiments = {
	get: (id: ExperimentKey): ExperimentConfig | undefined => {
		return experimentConfigsMap[id]
	},
	isEnabled: (experimentsConfig: Record<ExperimentId, boolean>, id: ExperimentId): boolean => {
		return experimentsConfig[id] ?? experimentDefault[id]
	},
} as const

// Expose experiment details for UI - pre-compute from map for better performance
export const experimentLabels = Object.fromEntries(
	Object.entries(experimentConfigsMap).map(([_, config]) => [
		EXPERIMENT_IDS[_ as keyof typeof EXPERIMENT_IDS] as ExperimentId,
		config.name,
	]),
) as Record<string, string>

export const experimentDescriptions = Object.fromEntries(
	Object.entries(experimentConfigsMap).map(([_, config]) => [
		EXPERIMENT_IDS[_ as keyof typeof EXPERIMENT_IDS] as ExperimentId,
		config.description,
	]),
) as Record<string, string>
