import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
	root: resolve("src/renderer"),
	resolve: {
		alias: {
			"@renderer": resolve("src/renderer/src")
		}
	},
	server: {
		host: "127.0.0.1",
		port: Number(process.env.PORT) || 5173,
		strictPort: true
	},
	plugins: [react(), tailwindcss()]
})
