import axios from 'axios'

// Create axios instance
// Force relative path for Vercel proxy to avoid Mixed Content (HTTPS -> HTTP) errors
export const apiClient = axios.create({
    baseURL: '/api',
    timeout: 30000, // 30 sn - takılı kalmayı önler
    headers: {
        "Content-Type": "application/json",
    },
})

// Request interceptor: Attach Token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("admin_token")
        if (token) {
            // Backend deps.py supports both X-API-Key and Authorization Bearer
            // Using standard Bearer format for consistency
            config.headers["Authorization"] = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor: Handle 401
apiClient.interceptors.response.use(
    (response) => response, // If success, return response
    (error) => {
        if (error.response && error.response.status === 401) {
            // If 401 (Unauthorized - invalid/expired token), redirect to login unless we are already there
            if (!window.location.pathname.includes("/login")) {
                localStorage.removeItem("admin_token");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error)
    }
)
