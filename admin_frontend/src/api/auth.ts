import { apiClient } from './client'

export const login = async (username: string, password: string) => {
    // Uses URL search params format because OAuth2PasswordRequestForm expects form-data
    const formData = new URLSearchParams()
    formData.append('username', username)
    formData.append('password', password)

    const response = await apiClient.post('/auth/token', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    return response.data
}

export const requestMagicLink = async (email: string) => {
    const response = await apiClient.post('/auth/magic-link', { email })
    return response.data
}

export const verifyMagicLink = async (token: string) => {
    const response = await apiClient.post('/auth/verify-magic-link', { token })
    return response.data
}
