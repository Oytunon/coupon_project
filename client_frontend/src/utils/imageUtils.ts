// Liste kartları görseli en fazla ~280px gösteriyor; 1080px'lik (~1 MB) orijinal yerine
// sunucunun ürettiği küçük WebP kopyası istenir (backend: /media/thumb/{genişlik}/{dosya})
export const EVENT_THUMB_WIDTH = 600

export function getThumbUrl(url: string | null | undefined): string | null {
    if (!url) return null
    // Yalnızca sunucuya yüklenen görsellerin küçük kopyası var; diğer adresler olduğu gibi kalır
    if (!url.startsWith("/media/") || url.startsWith("/media/thumb/")) return url
    return `/media/thumb/${EVENT_THUMB_WIDTH}/${url.slice("/media/".length)}`
}
