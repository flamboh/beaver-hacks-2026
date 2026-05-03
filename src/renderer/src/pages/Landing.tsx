import Aurora from "@renderer/components/Aurora"
import logoUrl from "@renderer/assets/logo.svg"
import type { JSX } from "react"

const AURORA_COLOR_STOPS = ["#67ff6d", "#979fcf", "#2756ff"]

export default function Landing(): JSX.Element {
	return (
		<main className="relative flex h-screen overflow-hidden bg-black text-white">
			<div className="absolute inset-x-0 top-0 h-[62vh] opacity-90">
				<Aurora colorStops={AURORA_COLOR_STOPS} blend={0.51} amplitude={1} speed={0.5} />
			</div>
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),transparent_32%),linear-gradient(to_bottom,rgba(0,0,0,0.05),#050505_72%)]" />
			<section className="relative z-10 flex flex-1 items-center justify-center px-6">
				<div className="flex -translate-y-6 flex-col items-center gap-5">
					<img
						src={logoUrl}
						alt="Nulloth logo"
						className="size-28 drop-shadow-[0_0_32px_rgba(103,255,109,0.20)]"
					/>
					<h1 className="font-raleway text-5xl font-bold tracking-[0.16em] text-white sm:text-6xl">
						Nulloth
					</h1>
				</div>
			</section>
		</main>
	)
}
