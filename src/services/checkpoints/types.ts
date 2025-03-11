import { SimpleGit } from "simple-git"

export interface StorageProvider {
	context: {
		globalStorageUri: { fsPath: string }
	}
}

export interface Checkpoint {
	hash: string
	message: string
	timestamp?: Date
}

export interface CheckpointDiff {
	relativePath: string
	absolutePath: string
	before: string
	after: string
}

export interface CheckpointServiceOptions {
	taskId: string
	git?: SimpleGit
	vscodeGlobalStorageCoolClinePath: string
	userProjectPath: string
	log?: (message: string) => void
	provider?: StorageProvider
}

export enum CheckpointRecoveryMode {
	FILES = "files",
	MESSAGES = "messages",
	FILES_AND_MESSAGES = "files_and_messages",
}
