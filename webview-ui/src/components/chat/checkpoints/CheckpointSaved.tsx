import { CheckpointMenu } from "./CheckpointMenu"

type CheckpointSavedProps = {
	ts: number
	commitHash: string
	currentCheckpointHash?: string
}

export const CheckpointSaved = (props: CheckpointSavedProps) => {
	return <CheckpointMenu {...props} />
}
