import { render, screen, fireEvent } from "@testing-library/react"
import { TemperatureControl } from "../TemperatureControl"

// Mock react-i18next
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const TEST_TEMPERATURE = 0.7
const UPDATED_TEMPERATURE = 0.8
const HIGH_TEMPERATURE = 1.5
const MAX_TEMPERATURE = 2
const LOW_TEMPERATURE = 0.5

describe("TemperatureControl", () => {
	it("renders with default temperature disabled", () => {
		const onChange = jest.fn()
		render(<TemperatureControl value={undefined} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).not.toBeChecked()
		expect(screen.queryByRole("slider")).not.toBeInTheDocument()
	})

	it("renders with custom temperature enabled", () => {
		const onChange = jest.fn()
		render(<TemperatureControl value={TEST_TEMPERATURE} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).toBeChecked()

		const slider = screen.getByRole("slider")
		expect(slider).toBeInTheDocument()
		expect(slider).toHaveValue(String(TEST_TEMPERATURE))
	})

	it("updates when checkbox is toggled", () => {
		const onChange = jest.fn()
		render(<TemperatureControl value={TEST_TEMPERATURE} onChange={onChange} />)

		const checkbox = screen.getByRole("checkbox")

		// Uncheck - should clear temperature
		fireEvent.click(checkbox)
		expect(onChange).toHaveBeenCalledWith(undefined)

		// Check - should restore previous temperature
		fireEvent.click(checkbox)
		expect(onChange).toHaveBeenCalledWith(TEST_TEMPERATURE)
	})

	it("updates temperature when slider changes", () => {
		const onChange = jest.fn()
		render(<TemperatureControl value={TEST_TEMPERATURE} onChange={onChange} />)

		const slider = screen.getByRole("slider")
		fireEvent.change(slider, { target: { value: String(UPDATED_TEMPERATURE) } })

		expect(onChange).toHaveBeenCalledWith(UPDATED_TEMPERATURE)
	})

	it("respects maxValue prop", () => {
		const onChange = jest.fn()
		render(<TemperatureControl value={HIGH_TEMPERATURE} onChange={onChange} maxValue={MAX_TEMPERATURE} />)

		const slider = screen.getByRole("slider")
		expect(slider).toHaveAttribute("max", String(MAX_TEMPERATURE))
	})

	it("syncs checkbox state when value prop changes", () => {
		const onChange = jest.fn()
		const { rerender } = render(<TemperatureControl value={TEST_TEMPERATURE} onChange={onChange} />)

		// Initially checked
		const checkbox = screen.getByRole("checkbox")
		expect(checkbox).toBeChecked()

		// Update to undefined
		rerender(<TemperatureControl value={undefined} onChange={onChange} />)
		expect(checkbox).not.toBeChecked()

		// Update back to a value
		rerender(<TemperatureControl value={LOW_TEMPERATURE} onChange={onChange} />)
		expect(checkbox).toBeChecked()
	})
})
