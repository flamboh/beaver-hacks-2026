import { Link } from "react-router-dom"

export default function Header() {
	return (
		<header className="relative flex h-11 items-center justify-between border-b border-white/5 bg-neutral-900 px-3 text-neutral-50">
			<Link
				to="/"
				className="text-sm font-medium uppercase tracking-wide text-neutral-50 hover:text-neutral-300"
			>
				NULLOTH
			</Link>

			<div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-neutral-400">
				Gallery
			</div>

			<div className="w-20" />
		</header>
	)
}
