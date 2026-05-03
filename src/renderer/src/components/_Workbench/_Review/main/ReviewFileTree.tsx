import type { FileTreeIcons, GitStatusEntry } from "@pierre/trees"
import { FileTree, useFileTree } from "@pierre/trees/react"

const treeCSS = `
	:host {
		--trees-bg-override: #0a0a0a;
		--trees-fg-override: #d4d4d4;
		--trees-muted-fg-override: #737373;
		--trees-border-color-override: rgba(255, 255, 255, 0.08);
		--trees-hover-bg-override: rgba(255, 255, 255, 0.06);
		--trees-selected-bg-override: rgba(255, 255, 255, 0.1);
		--trees-selected-fg-override: #ffffff;
	}

	[data-item-type='file'] > [data-item-section='icon'] {
		display: none;
	}

	[data-item-type='file'] > [data-item-section='decoration'] {
		order: -1;
		flex: 0 0 auto;
		min-width: 0;
		margin-right: 6px;
		color: #d4d4d4;
		cursor: pointer;
	}

	[data-item-type='file'] > [data-item-section='decoration'] > span {
		width: 16px;
		justify-content: center;
	}

	[data-item-type='file'] > [data-item-section='decoration'] svg {
		display: block;
		color: #d4d4d4;
		fill: none;
		stroke: currentColor;
	}
`

const reviewTreeSpriteSheet = `
<svg data-icon-sprite aria-hidden="true" width="0" height="0">
	<symbol id="review-checkbox-empty" viewBox="0 0 24 24">
		<rect width="18" height="18" x="3" y="3" rx="2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
	</symbol>
	<symbol id="review-checkbox-checked" viewBox="0 0 24 24">
		<path d="M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
		<path d="m9 11 3 3L22 4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
	</symbol>
</svg>
`

const reviewTreeIcons = {
	colored: true,
	set: "standard",
	spriteSheet: reviewTreeSpriteSheet
} satisfies FileTreeIcons

interface ReviewFileTreeProps {
	checkedPaths: Set<string>
	gitStatus: GitStatusEntry[]
	onSelectionChange: (paths: readonly string[]) => void
	onTogglePath: (path: string) => void
	paths: string[]
	reviewFilePaths: ReadonlySet<string>
	selectedPath: string
}

function resolveDecorationClickPath(host: HTMLElement, event: MouseEvent): string | null {
	const shadowTarget =
		host.shadowRoot?.elementFromPoint(event.clientX, event.clientY) ??
		(event.composedPath().find((target) => target instanceof Element) as Element | undefined)
	if (!(shadowTarget instanceof Element)) return null

	const decoration = shadowTarget.closest('[data-item-section="decoration"]')
	if (decoration === null) return null

	const row = decoration.closest('[data-type="item"]')
	return row instanceof HTMLElement ? (row.dataset.itemPath ?? null) : null
}

export function ReviewFileTree({
	checkedPaths,
	gitStatus,
	onSelectionChange,
	onTogglePath,
	paths,
	reviewFilePaths,
	selectedPath
}: ReviewFileTreeProps) {
	const tree = useFileTree({
		flattenEmptyDirectories: true,
		gitStatus,
		icons: reviewTreeIcons,
		initialExpansion: "open",
		initialSelectedPaths: [selectedPath || paths[0] || ""],
		onSelectionChange,
		renderRowDecoration: ({ item }) => {
			if (item.kind !== "file") return null
			const checked = checkedPaths.has(item.path)
			return {
				icon: {
					height: 16,
					name: checked ? "review-checkbox-checked" : "review-checkbox-empty",
					viewBox: "0 0 24 24",
					width: 16
				},
				title: checked ? "Selected for review action" : "Click to select"
			}
		},
		paths,
		search: true,
		unsafeCSS: treeCSS
	})

	return (
		<FileTree
			model={tree.model}
			className="min-h-0 flex-1"
			style={{ height: "100%" }}
			onMouseDownCapture={(event) => {
				const path = resolveDecorationClickPath(event.currentTarget, event.nativeEvent)
				if (!path || !reviewFilePaths.has(path)) return
				event.preventDefault()
				event.stopPropagation()
				onTogglePath(path)
			}}
		/>
	)
}
