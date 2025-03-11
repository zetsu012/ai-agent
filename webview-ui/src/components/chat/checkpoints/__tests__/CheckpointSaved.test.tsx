import { render, screen } from "@testing-library/react"
import { CheckpointSaved } from "../CheckpointSaved"

// Mock CheckpointMenu since we test it separately
jest.mock("../CheckpointMenu", () => ({
	CheckpointMenu: () => <div data-testid="checkpoint-menu" />,
}))

describe("CheckpointSaved", () => {
	const defaultProps: Parameters<typeof CheckpointSaved>[0] = {
		ts: 1234567890,
		commitHash: "abc123",
	}

	it("should render checkpoint layout correctly", () => {
		render(<CheckpointSaved {...defaultProps} />)
		expect(screen.getByTestId("checkpoint-menu")).toBeInTheDocument()
	})

	it("should pass current checkpoint hash correctly", () => {
		const { rerender } = render(<CheckpointSaved {...defaultProps} currentCheckpointHash="xyz789" />)
		expect(screen.getByTestId("checkpoint-menu")).toBeInTheDocument()

		rerender(<CheckpointSaved {...defaultProps} currentCheckpointHash="abc123" />)
		expect(screen.getByTestId("checkpoint-menu")).toBeInTheDocument()
	})
})
