import type { Meta, StoryObj } from "@storybook/react"
import {
	HamburgerMenuIcon,
	BorderLeftIcon,
	BorderRightIcon,
	BorderBottomIcon,
	BorderTopIcon,
	TextAlignLeftIcon,
	TextAlignCenterIcon,
	TextAlignRightIcon,
} from "@radix-ui/react-icons"

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuRadioGroup,
} from "@/components/ui"

const meta = {
	title: "UI/DropdownMenu",
	component: DropdownMenu,
	parameters: { layout: "centered" },
	tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	name: "DropdownMenu",
	render: () => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon">
					<HamburgerMenuIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuLabel>Label</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>Item 1</DropdownMenuItem>
					<DropdownMenuItem>
						Item 2<DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
}

export const Basic: Story = {
	render: () => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">Open Menu</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56">
				<DropdownMenuLabel>My Account</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						Profile
						<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						Billing
						<DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						Settings
						<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
}

export const WithSubmenu: Story = {
	render: () => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">Open Menu</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56">
				<DropdownMenuLabel>My Account</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>Profile</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>More Options</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem>About</DropdownMenuItem>
							<DropdownMenuItem>Help</DropdownMenuItem>
							<DropdownMenuItem>Contact</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
}

export const WithCheckboxItems: Story = {
	render: () => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">Open Menu</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56">
				<DropdownMenuLabel>Appearance</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem checked>Show Line Numbers</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem>Show Minimap</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem>Show Breadcrumbs</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
}

export const WithRadioItems: Story = {
	render: () => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">Open Menu</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56">
				<DropdownMenuLabel>Theme</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value="light">
					<DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
}

type DropdownMenuVariantProps = {
	side?: "top" | "bottom" | "left" | "right"
	align?: "start" | "center" | "end"
	children?: React.ReactNode
}

const DropdownMenuVariant = ({ side = "bottom", align = "center", children }: DropdownMenuVariantProps) => (
	<DropdownMenu>
		<DropdownMenuTrigger asChild>
			<Button variant="ghost" size="icon">
				{children}
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent side={side} align={align}>
			<DropdownMenuItem>Foo</DropdownMenuItem>
			<DropdownMenuItem>Bar</DropdownMenuItem>
			<DropdownMenuItem>Baz</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
)

export const Placements: Story = {
	render: () => (
		<div className="flex gap-2">
			<DropdownMenuVariant side="top">
				<BorderTopIcon />
			</DropdownMenuVariant>
			<DropdownMenuVariant side="bottom">
				<BorderBottomIcon />
			</DropdownMenuVariant>
			<DropdownMenuVariant side="left">
				<BorderLeftIcon />
			</DropdownMenuVariant>
			<DropdownMenuVariant side="right">
				<BorderRightIcon />
			</DropdownMenuVariant>
		</div>
	),
}

export const Alignments: Story = {
	render: () => (
		<div className="flex gap-2">
			<DropdownMenuVariant align="center">
				<TextAlignCenterIcon />
			</DropdownMenuVariant>
			<DropdownMenuVariant align="end">
				<TextAlignRightIcon />
			</DropdownMenuVariant>
			<DropdownMenuVariant align="start">
				<TextAlignLeftIcon />
			</DropdownMenuVariant>
		</div>
	),
}
