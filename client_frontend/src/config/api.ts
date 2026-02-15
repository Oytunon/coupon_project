/**
 * API Configuration
 * Production'da VITE_API_URL environment variable'ından alınır
 * Development'ta varsayılan olarak localhost kullanılır
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://46.101.96.41:8000';

export { API_URL };


