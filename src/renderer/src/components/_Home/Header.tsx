export default function Header() {
	return (
		<header
			className="flex h-14 items-center justify-between border-b border-neutral-800
    bg-neutral-900 px-6 text-neutral-50"
		>
			<div className="text-sm font-bold uppercase text-neutral-50">Nulloth</div>

			<div className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Gallery</div>

			<div className="w-20" />
		</header>
	)
}
