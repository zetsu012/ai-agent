import styled from "styled-components"

export const DROPDOWN_Z_INDEX = 1_000

export const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

export const DropdownList = styled.div<{ $zIndex: number }>`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${({ $zIndex }) => $zIndex};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

export const DropdownItem = styled.div<{ $selected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ $selected }) => ($selected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`
