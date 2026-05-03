import { useMemo, useSyncExternalStore } from "react"

export interface ReviewTourRecord {
	diffKey: string
	error: string | null
	generating: boolean
	tour: string
	updatedAt: string
}

const EMPTY_TOUR: ReviewTourRecord = {
	diffKey: "",
	error: null,
	generating: false,
	tour: "",
	updatedAt: ""
}

const listeners = new Set<() => void>()
const tours = new Map<string, ReviewTourRecord>()

function emit(): void {
	for (const listener of listeners) {
		listener()
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

function getTour(cwd: string): ReviewTourRecord {
	return tours.get(cwd) ?? EMPTY_TOUR
}

export function useReviewTour(cwd: string): ReviewTourRecord {
	const read = useMemo(() => () => getTour(cwd), [cwd])
	return useSyncExternalStore(subscribe, read, read)
}

export function saveReviewTour(cwd: string, record: ReviewTourRecord): void {
	tours.set(cwd, record)
	emit()
}
