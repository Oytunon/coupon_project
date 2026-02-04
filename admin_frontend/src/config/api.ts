/**
 * API Configuration
 * Production'da VITE_API_URL environment variable'ından alınır
 * Development'ta varsayılan olarak localhost kullanılır
 */
// Production'da Vercel proxy kullanılması için relative path (/api) kullanılır.
// Bu sayede HTTPS -> HTTP hatası (Mixed Content) engellenir.
const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '/api';

export { API_URL };


