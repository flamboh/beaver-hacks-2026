import { Link } from "react-router-dom"
import logoUrl from "@renderer/assets/logo.png"

export default function Header() {
	return (
		<header className="relative flex h-11 items-center justify-between border-b border-white/5 bg-neutral-900 px-3 text-neutral-50">
			<Link
				to="/"
				onClick={(event) => {
					event.preventDefault()
					window.location.reload()
				}}
				className="group flex cursor-pointer items-center gap-2 text-sm font-medium uppercase tracking-wide text-neutral-50 hover:text-neutral-300"
			>
				<img
					src={logoUrl}
					alt=""
					className="size-10 transition-opacity duration-150 group-hover:opacity-70"
				/>
				NULLOTH
			</Link>

			<div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-neutral-400">
				Gallery
			</div>

			<div className="w-20" />
		</header>
	)
}
