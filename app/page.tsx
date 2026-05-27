import Link from "next/link";

export default function Home() {
  return (
    <>
      <Link href="/detail">DetailPageへ移動</Link>
      <Link href="/articles/1">ArticlePageへ移動</Link>
    </>
  );
}
