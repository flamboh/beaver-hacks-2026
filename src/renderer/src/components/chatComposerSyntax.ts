export type ComposerToken =
	| { kind: "file"; query: string; start: number; end: number }
	| { kind: "skill"; query: string; start: number; end: number }

export interface ComposerSuggestion {
	id: string
	label: string
	detail: string | null
	insertText: string
}

function tokenBounds(text: string, cursor: number): { start: number; end: number } {
	const safeCursor = Math.max(0, Math.min(cursor, text.length))
	const before = text.slice(0, safeCursor)
	const after = text.slice(safeCursor)
	const start = before.search(/\S+$/)
	const endOffset = after.search(/\s/)
	return {
		start: start === -1 ? safeCursor : start,
		end: safeCursor + (endOffset === -1 ? after.length : endOffset)
	}
}

export function activeComposerToken(text: string, cursor: number): ComposerToken | null {
	const bounds = tokenBounds(text, cursor)
	const token = text.slice(bounds.start, bounds.end)
	if (token.startsWith("@")) {
		return { kind: "file", query: token.slice(1), ...bounds }
	}

	const firstLineEnd = text.indexOf("\n")
	const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd)
	if (token.startsWith("/") && !firstLine.startsWith("/ ")) {
		return { kind: "skill", query: token.slice(1), ...bounds }
	}

	return null
}

export function replaceComposerToken(
	text: string,
	token: ComposerToken,
	insertText: string
): { text: string; cursor: number } {
	const needsQuotes = token.kind === "file" && /\s/.test(insertText) && !insertText.includes('"')
	const inserted = `${needsQuotes ? `"${insertText}"` : insertText} `
	return {
		text: `${text.slice(0, token.start)}${inserted}${text.slice(token.end)}`,
		cursor: token.start + inserted.length
	}
}

export function fuzzyIncludes(value: string, query: string): boolean {
	const needle = query.trim().toLowerCase()
	if (!needle) return true
	let offset = 0
	const haystack = value.toLowerCase()
	for (const char of needle) {
		const index = haystack.indexOf(char, offset)
		if (index === -1) return false
		offset = index + 1
	}
	return true
}
