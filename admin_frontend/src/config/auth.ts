/**
 * API Authentication Configuration
 * Frontend'den API'ye istek atarken kullanılacak token
 * 
 * Production'da VITE_API_TOKEN environment variable'ından alınır
 * Development'ta null olabilir (eğer API_TOKEN set edilmemişse)
 */
const API_TOKEN = import.meta.env.VITE_API_TOKEN || null;

/**
 * API isteklerinde kullanılacak header'ları döndürür
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Eğer API_TOKEN varsa, header'a ekle
  if (API_TOKEN) {
    headers['X-API-Key'] = API_TOKEN;
  }

  return headers;
}

export { API_TOKEN };


