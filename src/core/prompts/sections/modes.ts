import * as vscode from "vscode"
import { promises as fs } from "fs"
import { modes, ModeConfig } from "../../../shared/modes"
import { PathUtils } from "../../../services/checkpoints/CheckpointUtils"

export async function getModesSection(context: vscode.ExtensionContext): Promise<string> {
	const settingsDir = PathUtils.joinPath(context.globalStorageUri.fsPath, "settings")
	await fs.mkdir(settingsDir, { recursive: true })
	const customModesPath = PathUtils.joinPath(settingsDir, "coolcline_custom_modes.json")

	return `====

MODES

- When referring to modes, always use their display names. The built-in modes are:
${modes.map((mode: ModeConfig) => `  * "${mode.name}" mode - ${mode.roleDefinition.split(".")[0]}`).join("\n")}
  Custom modes will be referred to by their configured name property.

- Custom modes can be configured by editing the custom modes file at '${customModesPath}'. The file gets created automatically on startup and should always exist. Make sure to read the latest contents before writing to it to avoid overwriting existing modes.

- The following fields are required and must not be empty:
  * slug: A valid slug (lowercase letters, numbers, and hyphens). Must be unique, and shorter is better.
  * name: The display name for the mode
  * roleDefinition: A detailed description of the mode's role and capabilities
  * groups: Array of allowed tool groups (can be empty). Each group can be specified either as a string (e.g., "edit" to allow editing any file) or with file restrictions (e.g., ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }] to only allow editing markdown files)

- The customInstructions field is optional.

- For multi-line text, include newline characters in the string like "This is the first line.\nThis is the next line.\n\nThis is a double line break."

The file should follow this structure:
{
 "customModes": [
   {
     "slug": "designer", // Required: unique slug with lowercase letters, numbers, and hyphens
     "name": "Designer", // Required: mode display name
     "roleDefinition": "You are CoolCline, a UI/UX expert specializing in design systems and frontend development. Your expertise includes:\n- Creating and maintaining design systems\n- Implementing responsive and accessible web interfaces\n- Working with CSS, HTML, and modern frontend frameworks\n- Ensuring consistent user experiences across platforms", // Required: non-empty
     "groups": [ // Required: array of tool groups (can be empty)
       "read",    // Read files group (read_file, search_files, list_files, list_code_definition_names)
       "edit",    // Edit files group (write_to_file, apply_diff) - allows editing any file
       // Or with file restrictions:
       // ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }],  // Edit group that only allows editing markdown files
       "browser", // Browser group (browser_action)
       "command", // Command group (execute_command)
       "mcp"     // MCP group (use_mcp_tool, access_mcp_resource)
     ],
     "customInstructions": "Additional instructions for the Designer mode" // Optional
    }
  ]
}`
}
