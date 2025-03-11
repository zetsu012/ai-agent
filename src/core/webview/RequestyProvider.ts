import * as fs from "fs/promises"
import * as vscode from "vscode"
import { ModelInfo } from "../../shared/api"
import { GlobalFileNames } from "./CoolClineProvider"
import { RequestyHandler } from "../../api/providers/requesty"
import { PathUtils } from "../../services/checkpoints/CheckpointUtils"

export class RequestyProvider {
	private filePath: string

	constructor(
		cachePath: string,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		this.filePath = PathUtils.joinPath(cachePath, GlobalFileNames.requestyModels)
	}

	async readModels(): Promise<Record<string, ModelInfo> | undefined> {
		try {
			const content = await fs.readFile(this.filePath, "utf-8")
			return JSON.parse(content)
		} catch (error) {
			this.outputChannel.appendLine(`Error reading Requesty models: ${error}`)
			return undefined
		}
	}

	async refreshModels(apiKey?: string): Promise<Record<string, ModelInfo> | undefined> {
		if (!apiKey) {
			this.outputChannel.appendLine("No Requesty API key provided")
			return undefined
		}

		try {
			const handler = new RequestyHandler(apiKey)
			const models = await handler.refreshModels()

			await fs.mkdir(PathUtils.dirname(this.filePath), { recursive: true })
			await fs.writeFile(this.filePath, JSON.stringify(models, null, 2))

			return models
		} catch (error) {
			this.outputChannel.appendLine(`Error refreshing Requesty models: ${error}`)
			return undefined
		}
	}
}
