import { ImgHTMLAttributes, useState } from "react"
import { getThumbUrl } from "@/utils/imageUtils"

type EventImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
    src: string
}

// Önce küçük kopyayı dener; sunucuda yoksa (ör. backend henüz güncellenmemişse) orijinale düşer,
// böylece görsel hiçbir durumda kırık görünmez
export function EventImage({ src, onError, ...props }: EventImageProps) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null)
    const thumb = getThumbUrl(src)
    const useOriginal = failedSrc === src || !thumb || thumb === src

    return (
        <img
            {...props}
            src={useOriginal ? src : thumb}
            onError={(e) => {
                if (!useOriginal) setFailedSrc(src)
                onError?.(e)
            }}
        />
    )
}
