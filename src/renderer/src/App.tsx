import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { SessionDataProvider } from "@renderer/hooks/useSessionData"
import type { JSX } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom"
import Workbench from "./pages/Workbench"

const queryClient = new QueryClient()

export default function App(): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<SessionDataProvider>
				<HashRouter>
					<Routes>
						<Route path="/" element={<Workbench />} />
						<Route path="/workbench" element={<Navigate to="/" replace />} />
						<Route path="/workbench/:tab" element={<Navigate to="/" replace />} />
						<Route path="/project/:projectId/workbench" element={<Workbench />} />
						<Route path="/project/:projectId/workbench/:tab" element={<Workbench />} />
					</Routes>
				</HashRouter>
			</SessionDataProvider>
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	)
}
