import { ZodError } from "zod"
import { CustomModeSchema, validateCustomMode } from "../CustomModesSchema"
import { ModeConfig } from "../../../shared/modes"

describe("CustomModeSchema", () => {
	describe("validateCustomMode", () => {
		test("accepts valid mode configuration", () => {
			const validMode = {
				slug: "test",
				name: "Test Mode",
				roleDefinition: "Test role definition",
				groups: ["read"] as const,
			} satisfies ModeConfig

			expect(() => validateCustomMode(validMode)).not.toThrow()
		})

		test("accepts mode with multiple groups", () => {
			const validMode = {
				slug: "test",
				name: "Test Mode",
				roleDefinition: "Test role definition",
				groups: ["read", "write", "browser"] as const,
			} satisfies ModeConfig

			expect(() => validateCustomMode(validMode)).not.toThrow()
		})

		test("accepts mode with optional customInstructions", () => {
			const validMode = {
				slug: "test",
				name: "Test Mode",
				roleDefinition: "Test role definition",
				customInstructions: "Custom instructions",
				groups: ["read"] as const,
			} satisfies ModeConfig

			expect(() => validateCustomMode(validMode)).not.toThrow()
		})

		test("rejects missing required fields", () => {
			const invalidModes = [
				{}, // All fields missing
				{ name: "Test" }, // Missing most fields
				{
					name: "Test",
					roleDefinition: "Role",
				}, // Missing slug and groups
			]

			invalidModes.forEach((invalidMode) => {
				expect(() => validateCustomMode(invalidMode)).toThrow(ZodError)
			})
		})

		test("rejects invalid slug format", () => {
			const invalidMode = {
				slug: "not@a@valid@slug",
				name: "Test Mode",
				roleDefinition: "Test role definition",
				groups: ["read"] as const,
			} satisfies Omit<ModeConfig, "slug"> & { slug: string }

			expect(() => validateCustomMode(invalidMode)).toThrow(ZodError)
			expect(() => validateCustomMode(invalidMode)).toThrow("Slug must contain only letters numbers and dashes")
		})

		test("rejects empty strings in required fields", () => {
			const emptyNameMode = {
				slug: "123e4567-e89b-12d3-a456-426614174000",
				name: "",
				roleDefinition: "Test role definition",
				groups: ["read"] as const,
			} satisfies ModeConfig

			const emptyRoleMode = {
				slug: "123e4567-e89b-12d3-a456-426614174000",
				name: "Test Mode",
				roleDefinition: "",
				groups: ["read"] as const,
			} satisfies ModeConfig

			expect(() => validateCustomMode(emptyNameMode)).toThrow("Name is required")
			expect(() => validateCustomMode(emptyRoleMode)).toThrow("Role definition is required")
		})

		test("rejects invalid group configurations", () => {
			const invalidGroupMode = {
				slug: "123e4567-e89b-12d3-a456-426614174000",
				name: "Test Mode",
				roleDefinition: "Test role definition",
				groups: ["not-a-valid-group"] as any,
			}

			expect(() => validateCustomMode(invalidGroupMode)).toThrow(ZodError)
		})

		test("rejects empty groups array", () => {
			const invalidMode = {
				slug: "123e4567-e89b-12d3-a456-426614174000",
				name: "Test Mode",
				roleDefinition: "Test role definition",
				groups: [] as const,
			} satisfies ModeConfig

			expect(() => validateCustomMode(invalidMode)).toThrow("At least one tool group is required")
		})

		test("handles null and undefined gracefully", () => {
			expect(() => validateCustomMode(null)).toThrow(ZodError)
			expect(() => validateCustomMode(undefined)).toThrow(ZodError)
		})

		test("rejects non-object inputs", () => {
			const invalidInputs = [42, "string", true, [], () => {}]

			invalidInputs.forEach((input) => {
				expect(() => validateCustomMode(input)).toThrow(ZodError)
			})
		})

		it("rejects mode with invalid slug", () => {
			const invalidMode = {
				slug: "test@invalid",
				name: "Test",
				roleDefinition: "Test",
				groups: ["read"],
			} satisfies ModeConfig

			expect(() => validateCustomMode(invalidMode)).toThrow()
		})

		it("rejects mode with empty name", () => {
			const invalidMode = {
				slug: "test",
				name: "",
				roleDefinition: "Test",
				groups: ["read"],
			} satisfies ModeConfig

			expect(() => validateCustomMode(invalidMode)).toThrow()
		})

		it("rejects mode with empty roleDefinition", () => {
			const invalidMode = {
				slug: "test",
				name: "Test",
				roleDefinition: "",
				groups: ["read"],
			} satisfies ModeConfig

			expect(() => validateCustomMode(invalidMode)).toThrow()
		})

		it("rejects mode with invalid groups", () => {
			const invalidMode = {
				slug: "test",
				name: "Test",
				roleDefinition: "Test",
				groups: ["invalid-group"],
			} as unknown as ModeConfig

			expect(() => validateCustomMode(invalidMode)).toThrow()
		})

		it("rejects mode with empty groups", () => {
			const invalidMode = {
				slug: "test",
				name: "Test",
				roleDefinition: "Test",
				groups: [],
			} satisfies ModeConfig

			expect(() => validateCustomMode(invalidMode)).toThrow()
		})
	})

	describe("fileRegex", () => {
		it("validates a mode with file restrictions and descriptions", () => {
			const modeWithJustRegex = {
				slug: "test",
				name: "Test",
				roleDefinition: "Test",
				groups: ["read", ["write", { fileRegex: "^src/.*\\.ts$" }]],
			} satisfies ModeConfig

			const modeWithDescription = {
				slug: "test",
				name: "Test",
				roleDefinition: "Test",
				groups: ["read", ["write", { fileRegex: "^src/.*\\.ts$", description: "TypeScript files in src" }]],
			} satisfies ModeConfig

			expect(() => CustomModeSchema.parse(modeWithJustRegex)).not.toThrow()
			expect(() => CustomModeSchema.parse(modeWithDescription)).not.toThrow()
		})

		it("validates file regex patterns", () => {
			const validPatterns = ["^src/.*\\.ts$", ".*\\.js$", "^test/", "\\.(ts|js)$"]

			validPatterns.forEach((pattern) => {
				const mode = {
					slug: "test",
					name: "Test",
					roleDefinition: "Test",
					groups: ["read", ["write", { fileRegex: pattern }]],
				} satisfies ModeConfig
				expect(() => CustomModeSchema.parse(mode)).not.toThrow()
			})

			const invalidPatterns = ["[", "(", "\\"]

			invalidPatterns.forEach((pattern) => {
				const mode = {
					slug: "test",
					name: "Test",
					roleDefinition: "Test",
					groups: ["read", ["write", { fileRegex: pattern }]],
				} satisfies ModeConfig
				expect(() => CustomModeSchema.parse(mode)).toThrow()
			})
		})

		it("prevents duplicate groups", () => {
			const modeWithDuplicates = {
				slug: "test",
				name: "Test",
				roleDefinition: "Test",
				groups: [
					"read",
					["read", { fileRegex: "^src/.*\\.ts$" }],
					["write", { fileRegex: "^test/.*\\.ts$" }],
					["write", { fileRegex: "^src/.*\\.ts$" }],
				],
			} satisfies ModeConfig

			expect(() => CustomModeSchema.parse(modeWithDuplicates)).toThrow(/Duplicate groups/)
		})

		it("requires at least one group", () => {
			const modeWithNoGroups = {
				slug: "test",
				name: "Test",
				roleDefinition: "Test",
				groups: [],
			}

			expect(() => CustomModeSchema.parse(modeWithNoGroups)).toThrow(/At least one tool group is required/)
		})
	})
})
