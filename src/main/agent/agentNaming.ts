const MAX_AGENT_NAME_LENGTH = 50

export interface GenerateAgentNameInput {
	cwd: string
	prompt: string
}

export interface GenerateAgentNameResult {
	name: string
}

export function buildAgentNamePrompt(prompt: string): string {
	return [
		"You write concise agent names for coding work cards.",
		'Return only JSON with this shape: {"name":"..."}.',
		"Rules:",
		"- Summarize the user's request, do not restate it verbatim.",
		"- Keep it short and specific, 2-5 words.",
		"- Avoid quotes, filler, prefixes, trailing punctuation, and the word Agent.",
		"",
		"User request:",
		prompt
	].join("\n")
}

export function parseAgentName(raw: string): string {
	const json = extractJsonObject(raw)
	try {
		const parsed = JSON.parse(json) as { name?: string }
		if (parsed.name) return sanitizeAgentName(parsed.name)
	} catch {
		return sanitizeAgentName(raw)
	}
	return sanitizeAgentName(raw)
}

export function sanitizeAgentName(raw: string): string {
	const normalized = raw
		.trim()
		.split(/\r?\n/g)[0]
		?.trim()
		.replace(/^['"`]+|['"`]+$/g, "")
		.replace(/[.?!]+$/g, "")
		.trim()
		.replace(/\s+/g, " ")

	if (!normalized) return "New Agent"
	if (normalized.length <= MAX_AGENT_NAME_LENGTH) return normalized
	return `${normalized.slice(0, MAX_AGENT_NAME_LENGTH - 3).trimEnd()}...`
}

function extractJsonObject(raw: string): string {
	const trimmed = raw.trim()
	const start = trimmed.indexOf("{")
	if (start < 0) return trimmed

	let depth = 0
	let inString = false
	let escaping = false
	for (let i = start; i < trimmed.length; i += 1) {
		const char = trimmed[i]
		if (inString) {
			if (escaping) {
				escaping = false
			} else if (char === "\\") {
				escaping = true
			} else if (char === '"') {
				inString = false
			}
			continue
		}
		if (char === '"') {
			inString = true
			continue
		}
		if (char === "{") {
			depth += 1
			continue
		}
		if (char === "}") {
			depth -= 1
			if (depth === 0) return trimmed.slice(start, i + 1)
		}
	}
	return trimmed.slice(start)
}
