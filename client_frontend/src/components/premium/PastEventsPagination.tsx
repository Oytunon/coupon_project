import { ChevronLeft, ChevronRight } from "lucide-react"

interface PastEventsPaginationProps {
    page: number
    pageCount: number
    onChange: (page: number) => void
}

const MAX_DOTS = 9

// Çok sayfada mevcut sayfayı ortalayan kayan pencere (en fazla 9 nokta)
function getVisiblePages(page: number, pageCount: number): number[] {
    const count = Math.min(pageCount, MAX_DOTS)
    const start = Math.min(Math.max(1, page - Math.floor(count / 2)), pageCount - count + 1)
    return Array.from({ length: count }, (_, i) => start + i)
}

export function PastEventsPagination({ page, pageCount, onChange }: PastEventsPaginationProps) {
    if (pageCount <= 1) return null

    const arrowButton = "flex items-center justify-center h-9 w-9 lg:h-10 lg:w-10 rounded-full border border-[#D9B648]/40 text-[#D9B648] transition-all duration-300 hover:border-[#D9B648] hover:bg-[#D9B648]/10 disabled:opacity-25 disabled:pointer-events-none"

    return (
        <nav aria-label="Geçmiş turnuva sayfaları" className="flex items-center justify-center gap-3 lg:gap-4 pt-3 lg:pt-5">
            <button type="button" className={arrowButton} onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Önceki sayfa">
                <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
            {/* Slider noktalarıyla aynı dil; nokta küçük, dokunma alanı padding ile büyütüldü */}
            <div className="flex items-center">
                {getVisiblePages(page, pageCount).map(p => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onChange(p)}
                        aria-label={`Sayfa ${p}`}
                        aria-current={p === page ? "page" : undefined}
                        className="group p-1.5"
                    >
                        <span className={`block h-2 rounded-full transition-all duration-300 ${p === page
                            ? "w-8 bg-[#D9B648]"
                            : "w-2 bg-gray-600 group-hover:bg-gray-500"
                            }`} />
                    </button>
                ))}
            </div>
            <button type="button" className={arrowButton} onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Sonraki sayfa">
                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
        </nav>
    )
}
