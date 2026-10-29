import { ChevronLeft, ChevronRight } from "lucide-react"

interface PastEventsPaginationProps {
    page: number
    pageCount: number
    onChange: (page: number) => void
}

// 7 sayfaya kadar hepsi; fazlasında ilk/son sayfa + mevcut sayfanın komşuları (mobilde tek satıra sığsın)
function getPageItems(page: number, pageCount: number): (number | "gap")[] {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
    const items: (number | "gap")[] = [1]
    const start = Math.max(2, page - 1)
    const end = Math.min(pageCount - 1, page + 1)
    if (start > 2) items.push("gap")
    for (let p = start; p <= end; p++) items.push(p)
    if (end < pageCount - 1) items.push("gap")
    items.push(pageCount)
    return items
}

export function PastEventsPagination({ page, pageCount, onChange }: PastEventsPaginationProps) {
    if (pageCount <= 1) return null

    const navButton = "flex items-center justify-center h-8 w-8 lg:h-10 lg:w-10 rounded-lg border-2 border-[#D9B648]/60 text-[#D9B648] transition-colors hover:bg-[#D9B648]/10 disabled:opacity-30 disabled:pointer-events-none"

    return (
        <nav aria-label="Geçmiş turnuva sayfaları" className="flex items-center justify-center gap-1 lg:gap-2 pt-3 lg:pt-5">
            <button type="button" className={navButton} onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Önceki sayfa">
                <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
            {getPageItems(page, pageCount).map((item, i) =>
                item === "gap" ? (
                    <span key={`gap-${i}`} className="px-0.5 text-sm text-[#D9B648]/60">…</span>
                ) : (
                    <button
                        key={item}
                        type="button"
                        onClick={() => onChange(item)}
                        aria-current={item === page ? "page" : undefined}
                        className={`h-8 min-w-[2rem] lg:h-10 lg:min-w-[2.5rem] px-1.5 rounded-lg border-2 text-sm lg:text-base font-black tabular-nums transition-colors ${item === page
                            ? "bg-[#D9B648] border-[#D9B648] text-black"
                            : "border-[#D9B648]/60 text-[#F7EBA5] hover:bg-[#D9B648]/10"
                            }`}
                    >
                        {item}
                    </button>
                )
            )}
            <button type="button" className={navButton} onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Sonraki sayfa">
                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
        </nav>
    )
}
