import { Button } from "@/components/ui"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmDialogProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
	title: string
	description: string
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, description }: ConfirmDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="w-[90%] sm:w-[400px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex flex-col sm:flex-row gap-2">
					<Button variant="default" onClick={onConfirm}>
						Confirm
					</Button>
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
