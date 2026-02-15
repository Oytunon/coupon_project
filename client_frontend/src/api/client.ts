import axios from 'axios'

// Create axios instance
// Force relative path for Vercel proxy to avoid Mixed Content (HTTPS -> HTTP) errors
export const apiClient = axios.create({
    baseURL: '',
    headers: {
        "Content-Type": "application/json",
    },
})

export type PublicEvent = {
    id: number
    name: string
    description: string
    status: "active" | "ended" | "paused"
    start_date: string
    end_date: string
    participant_count: number
    image_url?: string
    rules?: {
        min_stake?: number
        min_odd?: number
        min_combination?: number
        min_deposit?: number
        [key: string]: any
    }
}


export async function getPublicEvents() {
    const res = await apiClient.get<PublicEvent[]>('/api/client/events')
    return res.data
}

export type League = {
    id: number
    name: string
    sport_id?: number
    region?: string
}

export async function getLeagues() {
    const res = await apiClient.get<League[]>('/api/client/leagues')
    return res.data
}

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
            // If 401/403, redirect to login unless we are already there
            if (!window.location.pathname.includes("/login")) {
                localStorage.removeItem("admin_token");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error)
    }
)
