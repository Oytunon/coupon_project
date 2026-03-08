/** API'den gelen string'de timezone var mı? (Z veya +03:00 gibi) */
function hasTimezone(s: string): boolean {
  return s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)
}

/**
 * Event tarihleri DB'de Türkiye saati (UTC+3) olarak saklanıyor.
 * API timezone bilgisi olmadan döndürüyor (örn: "2026-03-08T22:00:00").
 * JavaScript bazı ortamlarda bunu UTC sanıp 3 saat ileri gösteriyor.
 * Bu yüzden timezone yoksa +03:00 ekleyerek TR saati olarak parse ediyoruz.
 */
export function parseEventDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(NaN)
  const s = String(dateStr).trim()
  const withTz = hasTimezone(s) ? s : s.replace(/\.\d+$/, '') + '+03:00'
  return new Date(withTz)
}

/**
 * Kupon created_at/inserted_at UTC olarak saklanıyor.
 * Timezone yoksa Z ekleyerek UTC olarak parse ediyoruz.
 */
export function parseUtcDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(NaN)
  const s = String(dateStr).trim()
  const withTz = hasTimezone(s) ? s : s.replace(/\.\d+$/, '') + 'Z'
  return new Date(withTz)
}
