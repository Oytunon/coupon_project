/**
 * API Configuration
 * Production'da VITE_API_URL environment variable'ından alınır
 * Development'ta varsayılan olarak localhost kullanılır
 */
const rawUrl = import.meta.env.VITE_API_URL || '';
const API_URL = rawUrl.endsWith('/api') ? rawUrl.slice(0, -4) : rawUrl;

export { API_URL };


