# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## プロジェクト概要

NovaBase — 個人〜少人数（最大4名程度）向けの ToDo 管理 + ドキュメント/データ管理を統合したパーソナルダッシュボード。ユーザー間のデータ共有機能はない。Vercel Free + Firebase Spark（無料枠）内での永続運用を設計目標としており、この制約がアーキテクチャ判断（後述）に直結している。詳細な機能仕様・DB設計・画面仕様は README.md を参照。

## コマンド

```bash
npm run dev     # 開発サーバー起動（Next.js, Turbopack）
npm run build   # 本番ビルド
npm run lint    # ESLint
```

テストランナーは未導入。

## アーキテクチャ

### Next.js のバージョンに注意
`package.json` の Next.js は 16.2.6 で、学習データにある Next.js の慣習と異なる破壊的変更を含む。コードを書く前に `node_modules/next/dist/docs/` 配下の該当ガイドを確認すること（AGENTS.md 参照）。この版では **`middleware.ts` ではなく [proxy.ts](proxy.ts) が Edge でのルート保護を担う**（`export function proxy()` + `export const config = { matcher }`）。

### 認証フロー（Firebase Auth + Session Cookie）
NextAuth は不採用。Firebase Authentication に一本化することで Firestore セキュリティルール（`request.auth.uid`）との整合性を保っている。

1. クライアントで `signInWithPopup` / `signInWithEmailAndPassword` → ID トークン取得
2. `POST /api/auth/session`（[app/api/auth/session/route.ts](app/api/auth/session/route.ts)、`runtime = 'nodejs'` 必須）が Admin SDK でトークン検証し、HttpOnly Session Cookie（`__session`）を発行
3. [proxy.ts](proxy.ts) は Edge Runtime で動くため Admin SDK が使えず、Cookie の**存在確認のみ**を行う。実際のアクセス制御は Firestore セキュリティルールが担う多層防御構成
4. サインアウトは `POST /api/auth/signout` が Cookie を破棄

[lib/firebase-admin.ts](lib/firebase-admin.ts) は Admin SDK を遅延初期化している（`getAdminApp()` を呼んだ時点で初期化）。`next build` 時に環境変数が無い状態でトップレベル `initializeApp()` を呼ぶとビルドがクラッシュするため。新規に Admin SDK を使うコードはこのパターンを踏襲すること。

### Firestore データモデルとアクセス方針
- 構造: `users/{userId}/workspaces/{workspaceId}/{folders,items}` — フォルダーとアイテムは同じ階層のサブコレクションで、アイテムは `folderId`（nullable）でフォルダーに紐づく（フォルダー配下のサブコレクションではない）。README.md 6章のスキーマ図には folders コレクションが未反映のため注意。
- セキュリティルールは `users/{userId}/{document=**}` の再帰ワイルドカードで全サブコレクションを一括カバーし、`request.auth.uid == userId` のみをチェックする単純な形（[firestore.rules](firestore.rules)）。ワークスペース数上限（10件）など複雑な制約は Firestore ルールではなくアプリケーション層（hooks）で強制する。
- **`onSnapshot` は使用しない方針。** 無料枠の Read カウントを常時消費するリアルタイムリスナーは避け、操作後に `getDocs` を明示的に再実行する。新規データ取得コードもこの方針に従うこと。
- 書き込み系フック（`use-workspaces.ts`, `use-folders.ts`, `use-items.ts`）は楽観的 UI 更新 → 失敗時にローカル state をロールバックするパターンで統一されている。499件区切りの `writeBatch`（Firestore のバッチ上限500件対策）も踏襲すること。
- バリデーションは [types/index.ts](types/index.ts) の Zod スキーマ（`zod/v4` サブパスからインポート）が唯一の情報源。`ItemSchema` は `type` による discriminated union（`todo` / `md,txt,csv`）。ドキュメント系コンテンツはバイト数（UTF-8 450KB 上限）でチェックしており文字数ではない点に注意。

### UI構成
- shadcn/ui（`components.json` の `style: "radix-nova"`、`baseColor: "neutral"`）+ Tailwind CSS v4。新規 UI プリミティブは `components/ui/` に既存の構成を踏襲して追加する。
- ワークスペースの並び替えは `@dnd-kit`（`workspace-sidebar.tsx` / `sortable-item-row.tsx`）。
- ドキュメントエディタは種別ごとに分離: `components/editors/markdown-editor.tsx`（textarea + プレビュー切り替え）、`components/editors/csv-editor.tsx`（papaparse + react-data-grid）。
- 固定テンプレート文字列は [constants/templates.ts](constants/templates.ts) にハードコードされている（README 11章）。

### 環境変数
`.env.example` を参照。`NEXT_PUBLIC_FIREBASE_*` はクライアント公開用、`FIREBASE_ADMIN_*` はサーバー専用（`NEXT_PUBLIC_` を絶対に付けないこと）。`FIREBASE_ADMIN_PRIVATE_KEY` は改行が `\n` エスケープで1行保存される前提で、[lib/firebase-admin.ts](lib/firebase-admin.ts) 側で実改行に変換している。
