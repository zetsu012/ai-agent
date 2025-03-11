import { render, screen, fireEvent, within } from "@testing-library/react"
import { CheckpointMenu } from "../CheckpointMenu"
import { vscode } from "../../../../utils/vscode"

// Mock vscode module
jest.mock("../../../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

describe("CheckpointMenu", () => {
	const props = {
		ts: 1234567890,
		commitHash: "abc123",
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders compare button", () => {
		render(<CheckpointMenu {...props} />)
		expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument()
	})

	it("renders restore button", () => {
		render(<CheckpointMenu {...props} />)
		const restoreButton = screen.getByRole("button", { name: "Restore" })
		expect(restoreButton).toBeInTheDocument()
	})

	it("shows restore options when clicking restore button", () => {
		render(<CheckpointMenu {...props} />)
		const restoreButton = screen.getByRole("button", { name: "Restore" })
		fireEvent.click(restoreButton)

		expect(screen.getByRole("button", { name: "Restore Files & Messages" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Restore Messages Only" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Restore Files Only" })).toBeInTheDocument()
	})

	it("calls checkpoint diff when clicking compare button", () => {
		render(<CheckpointMenu {...props} />)
		const compareButton = screen.getByRole("button", { name: "Compare" })
		fireEvent.click(compareButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "checkpointDiff",
			payload: {
				ts: props.ts,
				commitHash: props.commitHash,
				mode: "checkpoint",
			},
		})
	})

	it("shows confirmation dialog when clicking restore options", async () => {
		render(<CheckpointMenu {...props} />)

		// Open restore menu
		const restoreButton = screen.getByRole("button", { name: "Restore" })
		fireEvent.click(restoreButton)

		// Click Restore Files & Messages
		const restoreFilesAndMessagesButton = screen.getByRole("button", { name: "Restore Files & Messages" })
		fireEvent.click(restoreFilesAndMessagesButton)

		// Check confirmation dialog
		expect(screen.getByText("Warning")).toBeInTheDocument()
		expect(
			screen.getByText(
				/This action will restore project files to the state at this checkpoint and delete all messages after this point. This cannot be undone. Are you sure you want to continue?/,
			),
		).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
	})

	it("calls restore with correct mode when confirming restore", async () => {
		render(<CheckpointMenu {...props} />)

		// Open restore menu
		const restoreButton = screen.getByRole("button", { name: "Restore" })
		fireEvent.click(restoreButton)

		// Click Restore Files & Messages
		const restoreFilesAndMessagesButton = screen.getByRole("button", { name: "Restore Files & Messages" })
		fireEvent.click(restoreFilesAndMessagesButton)

		// Click confirm
		const confirmButton = screen.getByRole("button", { name: "Confirm" })
		fireEvent.click(confirmButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "checkpointRestore",
			payload: {
				ts: props.ts,
				commitHash: props.commitHash,
				mode: "files_and_messages",
			},
		})
	})

	const defaultProps = {
		ts: 1234567890,
		commitHash: "abc123",
		currentCheckpointHash: "def456",
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should show bookmark icon", () => {
		render(<CheckpointMenu {...defaultProps} />)
		expect(screen.getByText("", { selector: "i.codicon-bookmark" })).toBeInTheDocument()
	})

	it("should show restore options for non-current checkpoint", () => {
		render(<CheckpointMenu {...defaultProps} currentCheckpointHash="xyz789" />)

		// Open restore menu
		const restoreButton = screen.getByRole("button", { name: "Restore" })
		fireEvent.click(restoreButton)

		expect(screen.getByRole("button", { name: "Restore Files Only" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Restore Messages Only" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Restore Files & Messages" })).toBeInTheDocument()
	})

	it("should handle confirmation flow correctly", () => {
		render(<CheckpointMenu {...defaultProps} />)

		// Open restore menu
		const restoreButton = screen.getByRole("button", { name: "Restore" })
		fireEvent.click(restoreButton)

		// Click Restore Files & Messages
		const restoreFilesAndMessagesButton = screen.getByRole("button", { name: "Restore Files & Messages" })
		fireEvent.click(restoreFilesAndMessagesButton)

		// Check confirmation dialog
		expect(screen.getByText("Warning")).toBeInTheDocument()
		expect(
			screen.getByText(
				/This action will restore project files to the state at this checkpoint and delete all messages after this point. This cannot be undone. Are you sure you want to continue?/,
			),
		).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()

		// Click Cancel
		const cancelButton = screen.getByRole("button", { name: "Cancel" })
		fireEvent.click(cancelButton)

		// Dialog should be closed
		expect(screen.queryByText("Warning")).not.toBeInTheDocument()
	})
})
