import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"

/** 現在のページの前後に表示するページ数 */
const SIBLINGS = 2

type Props = {
    params: Promise<{ id: string }>
}

/**
 * 現在のページを中心に表示するページ番号の配列を生成する。
 * ページ数に上限はなく、常に現在のページの周辺を表示する。
 */
function getPageRange(currentPage: number, siblings: number): number[] {
    const totalVisible = siblings * 2 + 1
    let start = Math.max(1, currentPage - siblings)
    const end = start + totalVisible - 1
    // 先頭付近の場合、常に totalVisible 個表示されるよう start を調整
    if (start < 1) {
        start = 1
    }
    const pages: number[] = []
    for (let i = start; i <= end; i++) {
        pages.push(i)
    }
    return pages
}

export default async function ArticlePage({ params }: Props) {
    const { id } = await params
    const currentPage = Math.max(1, Number(id) || 1)
    const pages = getPageRange(currentPage, SIBLINGS)

    const showStartEllipsis = pages[0] > 2
    const showFirstPage = pages[0] > 1

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

                    {/* 先頭ページ (1) へのリンク */}
                    {showFirstPage && (
                        <PaginationItem>
                            <PaginationLink href="/articles/1">
                                1
                            </PaginationLink>
                        </PaginationItem>
                    )}

                    {/* 先頭側の省略記号 */}
                    {showStartEllipsis && (
                        <PaginationItem>
                            <PaginationEllipsis />
                        </PaginationItem>
                    )}

                    {/* 現在のページ周辺のページ番号リンク */}
                    {pages.map((page) => (
                        <PaginationItem key={page}>
                            <PaginationLink
                                href={`/articles/${page}`}
                                isActive={page === currentPage}
                            >
                                {page}
                            </PaginationLink>
                        </PaginationItem>
                    ))}

                    {/* 末尾側の省略記号（ページ数無制限なので常に表示） */}
                    <PaginationItem>
                        <PaginationEllipsis />
                    </PaginationItem>

                    {/* Next ボタン */}
                    <PaginationItem>
                        <PaginationNext
                            href={`/articles/${currentPage + 1}`}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </>
    )
}
