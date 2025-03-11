import { isToolAllowedForMode, FileRestrictionError, ModeConfig } from "../modes"

describe("isToolAllowedForMode", () => {
	const customModes: ModeConfig[] = [
		{
			slug: "custom-mode",
			name: "Custom Mode",
			roleDefinition: "Custom role",
			groups: ["read"],
		},
	]

	it("returns true for tools in allowed groups", () => {
		expect(isToolAllowedForMode("read_file", "custom-mode", customModes)).toBe(true)
		expect(isToolAllowedForMode("codebase_search", "custom-mode", customModes)).toBe(true)
	})

	it("returns false for tools not in allowed groups", () => {
		expect(isToolAllowedForMode("edit_file", "custom-mode", customModes)).toBe(false)
		expect(isToolAllowedForMode("delete_file", "custom-mode", customModes)).toBe(false)
	})

	it("returns false for unknown tools", () => {
		expect(isToolAllowedForMode("unknown_tool", "custom-mode", customModes)).toBe(false)
	})

	it("returns false for unknown modes", () => {
		expect(isToolAllowedForMode("read_file", "unknown-mode", customModes)).toBe(false)
	})

	it("handles file restrictions correctly", () => {
		const modesWithRestrictions: ModeConfig[] = [
			{
				slug: "restricted-mode",
				name: "Restricted Mode",
				roleDefinition: "Restricted role",
				groups: [["read", { fileRegex: "^src/.*\\.ts$" }]],
			},
		]

		const toolParams = {
			relative_workspace_path: "src/test.ts",
		}
		expect(isToolAllowedForMode("read_file", "restricted-mode", modesWithRestrictions, undefined, toolParams)).toBe(
			true,
		)

		const toolParamsOutsideRestriction = {
			relative_workspace_path: "lib/test.js",
		}
		expect(
			isToolAllowedForMode(
				"read_file",
				"restricted-mode",
				modesWithRestrictions,
				undefined,
				toolParamsOutsideRestriction,
			),
		).toBe(false)
	})

	it("handles multiple group entries correctly", () => {
		const modesWithMultipleGroups: ModeConfig[] = [
			{
				slug: "multi-group-mode",
				name: "Multi-Group Mode",
				roleDefinition: "Multi-group role",
				groups: [
					["read", { fileRegex: "^src/.*\\.ts$" }],
					["write", { fileRegex: "^test/.*\\.ts$" }],
				],
			},
		]

		const readParams = {
			relative_workspace_path: "src/test.ts",
		}
		expect(
			isToolAllowedForMode("read_file", "multi-group-mode", modesWithMultipleGroups, undefined, readParams),
		).toBe(true)

		const writeParams = {
			relative_workspace_path: "test/test.ts",
		}
		expect(
			isToolAllowedForMode("edit_file", "multi-group-mode", modesWithMultipleGroups, undefined, writeParams),
		).toBe(true)

		const invalidParams = {
			relative_workspace_path: "lib/test.js",
		}
		expect(
			isToolAllowedForMode("read_file", "multi-group-mode", modesWithMultipleGroups, undefined, invalidParams),
		).toBe(false)
	})

	it("handles tool requirements correctly", () => {
		const toolRequirements = {
			can_read: true,
			can_write: false,
		}

		expect(isToolAllowedForMode("read_file", "custom-mode", customModes, toolRequirements)).toBe(true)
		expect(isToolAllowedForMode("edit_file", "custom-mode", customModes, toolRequirements)).toBe(false)
	})

	it("handles missing tool requirements gracefully", () => {
		const toolRequirements = {}

		expect(isToolAllowedForMode("read_file", "custom-mode", customModes, toolRequirements)).toBe(true)
		expect(isToolAllowedForMode("edit_file", "custom-mode", customModes, toolRequirements)).toBe(false)
	})

	it("handles undefined tool requirements gracefully", () => {
		expect(isToolAllowedForMode("read_file", "custom-mode", customModes, undefined)).toBe(true)
		expect(isToolAllowedForMode("edit_file", "custom-mode", customModes, undefined)).toBe(false)
	})

	it("handles empty groups correctly", () => {
		const modesWithEmptyGroups: ModeConfig[] = [
			{
				slug: "empty-mode",
				name: "Empty Mode",
				roleDefinition: "Empty role",
				groups: [],
			},
		]

		expect(isToolAllowedForMode("read_file", "empty-mode", modesWithEmptyGroups)).toBe(false)
		expect(isToolAllowedForMode("edit_file", "empty-mode", modesWithEmptyGroups)).toBe(false)
	})

	it("handles undefined custom modes gracefully", () => {
		expect(isToolAllowedForMode("read_file", "custom-mode", undefined as unknown as ModeConfig[])).toBe(false)
	})

	it("handles empty custom modes gracefully", () => {
		expect(isToolAllowedForMode("read_file", "custom-mode", [])).toBe(false)
	})
})

describe("FileRestrictionError", () => {
	it("creates an error with the correct message and properties", () => {
		const error = new FileRestrictionError("test-mode", "^src/.*\\.ts$", "TypeScript files in src", "lib/test.js")
		expect(error.message).toBe(
			"File 'lib/test.js' does not match the pattern '^src/.*\\.ts$' (TypeScript files in src) required for mode 'test-mode'",
		)
		expect(error.name).toBe("FileRestrictionError")
	})
})
