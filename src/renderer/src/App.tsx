import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { JSX } from "react"
import { HashRouter, Navigate, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Workbench from "./pages/Workbench"

const queryClient = new QueryClient()

export default function App(): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<HashRouter>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/workbench" element={<Navigate to="/" replace />} />
					<Route path="/workbench/:tab" element={<Navigate to="/" replace />} />
					<Route path="/project/:projectId/workbench" element={<Workbench />} />
					<Route path="/project/:projectId/workbench/:tab" element={<Workbench />} />
				</Routes>
			</HashRouter>
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	)
}
