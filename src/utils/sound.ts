import * as vscode from "vscode"
import { PathUtils } from "../services/checkpoints/CheckpointUtils"

/**
 * Minimum interval (in milliseconds) to prevent continuous playback
 */
const MIN_PLAY_INTERVAL = 500

/**
 * Timestamp of when sound was last played
 */
let lastPlayedTime = 0

/**
 * Determine if a file is a WAV file
 * @param filepath string
 * @returns boolean
 */
export function isWavFile(filepath: string): boolean {
	return PathUtils.extname(filepath).toLowerCase() === ".wav"
}

let isSoundEnabled = false
let volume = 0.5

/**
 * Set sound configuration
 * @param enabled boolean
 */
export const setSoundEnabled = (enabled: boolean): void => {
	isSoundEnabled = enabled
}

/**
 * Set sound volume
 * @param volume number
 */
export const setSoundVolume = (newVolume: number): void => {
	volume = newVolume
}

/**
 * Play a sound file
 * @param filepath string
 * @return void
 */
export const playSound = (filepath: string): void => {
	try {
		if (!isSoundEnabled) {
			return
		}

		if (!filepath) {
			return
		}

		if (!isWavFile(filepath)) {
			throw new Error("Only wav files are supported.")
		}

		const currentTime = Date.now()
		if (currentTime - lastPlayedTime < MIN_PLAY_INTERVAL) {
			return // Skip playback within minimum interval to prevent continuous playback
		}

		const sound = require("sound-play")
		sound.play(filepath, volume).catch(() => {
			throw new Error("Failed to play sound effect")
		})

		lastPlayedTime = currentTime
	} catch (error: any) {
		vscode.window.showErrorMessage(error.message)
	}
}
