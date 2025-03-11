import styled from "styled-components"

export const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

export const DropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: 1000;
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

export const DropdownItem = styled.div<{ $isSelected?: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ $isSelected }) =>
		$isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit"};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`
