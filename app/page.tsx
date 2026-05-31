import { redirect } from "next/navigation";

/**
 * ルートページ — /dashboard へリダイレクト
 * Middleware が未認証を検知した場合は /login へ転送される
 */
export default function Home() {
  redirect("/dashboard");
}
