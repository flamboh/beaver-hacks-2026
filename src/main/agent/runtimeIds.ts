import { generatedId } from "./codexJsonRpc"

export function assistantMessageId(turnId: string | null, itemId: string | null): string {
	return `assistant:${itemId ?? turnId ?? generatedId("message")}`
}
