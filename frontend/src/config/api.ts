/**
 * API Configuration
 * Production'da VITE_API_URL environment variable'ından alınır
 * Development'ta varsayılan olarak localhost kullanılır
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export { API_URL };


