import PaginationPage from "@/components/Pagination/Pagination";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function ArticlePage({ params }: Props) {
    const { id } = await params
    const currentPage = Math.max(1, Number(id) || 1)
    return (
        <>
            <div>ArticlePage - ページ {currentPage}</div>
            <PaginationPage params={params} />
        </>
    );
}