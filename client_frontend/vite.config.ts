import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '')

    // Fallback to localhost if not set
    const target = env.VITE_API_URL || 'http://localhost:8000'

    console.log(`🚀 Proxy target set to: ${target}`)

    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        server: {
            proxy: {
                '/api': {
                    target: target,
                    changeOrigin: true,
                },
                '/auth': {
                    target: target,
                    changeOrigin: true,
                },
                '/media': {
                    target: target,
                    changeOrigin: true,
                }
            }
        }
    }
})
