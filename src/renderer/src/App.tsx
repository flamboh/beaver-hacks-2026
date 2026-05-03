import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { SessionDataProvider } from "@renderer/hooks/useSessionData"
import type { JSX } from "react"
import { HashRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Workbench from "./pages/Workbench"

const queryClient = new QueryClient()

export default function App(): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<SessionDataProvider>
				<HashRouter>
					<Routes>
						<Route path="/" element={<Home />} />
						<Route path="/workbench" element={<Workbench />} />
						<Route path="/workbench/:tab" element={<Workbench />} />
					</Routes>
				</HashRouter>
			</SessionDataProvider>
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	)
}
