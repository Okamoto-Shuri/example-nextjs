import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"

const TOTAL_PAGES = 5

export default async function ArticlePage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const currentPage = Number(id)

    return (
        <>
            <div>ArticlePage - ページ {currentPage}</div>
            <Pagination>
                <PaginationContent>
                    {/* Previous ボタン */}
                    <PaginationItem>
                        <PaginationPrevious
                            href={currentPage > 1 ? `/articles/${currentPage - 1}` : undefined}
                            aria-disabled={currentPage <= 1}
                            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>

                    {/* ページ番号リンク */}
                    {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                            <PaginationLink
                                href={`/articles/${page}`}
                                isActive={page === currentPage}
                            >
                                {page}
                            </PaginationLink>
                        </PaginationItem>
                    ))}

                    {/* Next ボタン */}
                    <PaginationItem>
                        <PaginationNext
                            href={currentPage < TOTAL_PAGES ? `/articles/${currentPage + 1}` : undefined}
                            aria-disabled={currentPage >= TOTAL_PAGES}
                            className={currentPage >= TOTAL_PAGES ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </>
    )
}
