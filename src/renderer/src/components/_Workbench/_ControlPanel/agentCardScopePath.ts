export function parseScopePath(path: string): string {
	if (!path) return ""
	const parts = path.replace(/\\/g, "/").split("/")
	return (
		parts.findLast((segment) => segment.endsWith(".md") || segment.endsWith(".txt")) ??
		parts.at(-1) ??
		""
	)
}
