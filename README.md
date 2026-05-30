# Personal SaaS Task & Data Dashboard — 詳細設計書

個人利用に特化した、統合型のタスク管理およびドキュメント・データ管理ダッシュボード。  
複数の「ワークスペース」を切り替えることで、プロジェクトや目的別に情報を整理できる。  
**永年無料**（Vercel Free + Firebase Spark）での完全運用を設計目標とする。

---

## 📋 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [技術スタック](#2-技術スタック)
3. [認証設計（Firebase Auth）](#3-認証設計firebase-auth)
4. [機能要件・画面仕様](#4-機能要件画面仕様)
5. [ワークスペース管理仕様（詳細）](#5-ワークスペース管理仕様詳細)
6. [データベース設計（Firestore）](#6-データベース設計firestore)
7. [バリデーション設計（Zod）](#7-バリデーション設計zod)
8. [ディレクトリ構造](#8-ディレクトリ構造)
9. [APIルート設計](#9-apiルート設計)
10. [コスト・パフォーマンス設計](#10-コストパフォーマンス設計)
11. [固定テンプレート仕様](#11-固定テンプレート仕様)
12. [環境変数](#12-環境変数)
13. [セットアップ手順](#13-セットアップ手順)

---

## 1. プロジェクト概要

### 目的
ToDo管理と、Markdown / Plain Text / CSV ドキュメントの管理を一元化するパーソナルダッシュボード。

### 対象ユーザー
個人、または最大4名程度の身内利用。**ユーザー間のデータ共有機能はない。**

### コスト目標
Vercel Free プラン + Firebase Spark プラン（無料枠）の範囲内で永年運用する。

---

## 2. 技術スタック

| 領域 | 採用技術 | 備考 |
|------|---------|------|
| フレームワーク | Next.js 15（App Router） | TypeScript |
| スタイリング | Tailwind CSS + shadcn/ui | |
| 認証 | Firebase Authentication | Google OAuth + Email/Password |
| セッション管理 | Firebase Session Cookie + Admin SDK | HttpOnly Cookie（§3 参照）|
| データベース | Firebase Firestore | |
| バリデーション | Zod | |
| Markdown レンダリング | react-markdown + remark-gfm | プレビューモード専用 |
| CSV パース | papaparse | |
| CSV エディタ | react-data-grid | 表計算ライクなセル編集 |
| ドラッグ & ドロップ | @dnd-kit/core + @dnd-kit/sortable | ワークスペース並び替え |
| デプロイ | Vercel | |

> **⚠️ NextAuth.js は不採用**  
> 認証を Firebase Authentication に一本化する。NextAuth を除外することで、Firestore
> セキュリティルール（`request.auth.uid`）との整合性を確保し、アーキテクチャを単純化する。

### 依存パッケージ（主要）

```bash
npm install firebase firebase-admin \
  react-markdown remark-gfm \
  papaparse react-data-grid \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  zod

npm install -D @types/papaparse
```

---

## 3. 認証設計（Firebase Auth）

### 3.1 全体フロー

```
[クライアント]
  1. signInWithPopup(googleProvider) または signInWithEmailAndPassword()
  2. firebaseUser.getIdToken() で ID トークン取得
  3. POST /api/auth/session  { idToken }

[API Route: /api/auth/session  ← Node.js runtime]
  4. adminAuth.verifyIdToken(idToken)         // Admin SDK でトークン検証
  5. adminAuth.createSessionCookie(idToken)   // Session Cookie 生成
  6. Set-Cookie: __session=...; HttpOnly; Secure; SameSite=Lax

[クライアント]
  7. /dashboard へリダイレクト
```

### 3.2 Middleware によるルート保護

Firebase Admin SDK は **Edge Runtime 非対応**のため、ミドルウェアでは Cookie の**存在確認のみ**を行う。  
実際のデータアクセス制御は Firestore セキュリティルールが多層的に担保する。

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

### 3.3 サインアウト

```
[クライアント]
  1. signOut(auth)            // Firebase Auth ローカル状態クリア
  2. POST /api/auth/signout   // サーバー側で Cookie を無効化
  3. /login へリダイレクト
```

### 3.4 初回ログイン時の初期化処理

`onAuthStateChanged` 内でユーザードキュメントの有無を確認し、**初回のみ** Firestore にユーザーレコードとデフォルトワークスペースを **batch write** で一括作成する。

```typescript
// components/auth/auth-provider.tsx（抜粋）
async function initializeUserIfNeeded(uid: string, email: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return; // 2回目以降はスキップ

  const batch = writeBatch(db);
  // ユーザーレコード
  batch.set(userRef, { email, createdAt: serverTimestamp() });
  // デフォルトワークスペース
  const wsRef = doc(collection(db, `users/${uid}/workspaces`));
  batch.set(wsRef, {
    name: 'マイワークスペース',
    order: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
```

### 3.5 Firebase SDK 初期化ファイル

```typescript
// lib/firebase.ts  （クライアントサイド）
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    });

export const auth = getAuth(app);
export const db   = getFirestore(app);
```

```typescript
// lib/firebase-admin.ts  （サーバーサイド / API Route 専用）
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      // Vercel 環境では \n がエスケープされるため解除が必要
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminAuth = getAuth();
```

### 3.6 セッション有効期限

| 項目 | 設定値 |
|------|--------|
| Session Cookie 有効期限 | **5日** |
| Firebase ID Token 有効期限 | 1時間（Firebase 側固定） |

期限切れ後の次アクセス時: Middleware が Cookie 不在を検知 → `/login` へリダイレクト。

---

## 4. 機能要件・画面仕様

### 4.1 認証画面

#### ログイン `/login`
- Google サインインボタン（`signInWithPopup`）
- Email + Password フォーム（`signInWithEmailAndPassword`）
- 「新規登録はこちら」リンク

#### 新規登録 `/register`
- Email + Password フォーム（`createUserWithEmailAndPassword`）
- 登録後、`initializeUserIfNeeded` を呼び出して Firestore 初期化

### 4.2 ホームダッシュボード `/dashboard/workspaces/[workspaceId]`

**レイアウト:**
```
┌─────────────────────┬──────────────────────────────────────┐
│   WorkspaceSidebar  │         アイテム一覧エリア             │
│                     │  ┌────────────────────────────────┐  │
│  ● マイワークスペース│  │  [すべて] [ToDo] [ドキュメント]  │  │
│  ○ 仕事メモ         │  ├────────────────────────────────┤  │
│  ○ 習慣トラッカー   │  │  アイテムリスト（一覧表示）       │  │
│  ─────────────────  │  └────────────────────────────────┘  │
│  ＋ 新規ワークスペース│                                      │
└─────────────────────┴──────────────────────────────────────┘
```

**ビュー切り替え（クライアントサイドフィルタリング）:**

| ボタン | フィルタ条件 |
|--------|------------|
| すべて | なし |
| ToDoのみ | `item.type === "todo"` |
| ドキュメントのみ | `item.type !== "todo"` |

**アイテム一覧の表示カラム:**

| カラム | 内容 |
|--------|------|
| 種別アイコン | ToDo / MD / TXT / CSV をアイコンで識別 |
| タイトル | クリックで編集画面へ遷移 |
| ステータスバッジ | `pending` / `completed` / `in_progress` |
| 最終更新日時 | 相対時間表示（"2時間前"等）|
| アクションメニュー（⋮） | 「編集」「削除」|

**アイテム取得戦略:** `getDocs` による単発取得。操作完了後に手動で再取得（§10.3 参照）。

### 4.3 ToDo 管理

#### アイテム構造

| フィールド | 型 | 制約 |
|-----------|-----|------|
| `title` | string | 必須、最大 50 文字 |
| `content`（本文） | string | 任意、最大 1,000 文字 |
| `status` | enum | `"pending"` / `"completed"` |

#### CRUD 仕様

| 操作 | UIトリガー | 処理 |
|------|-----------|------|
| 作成 | 「＋ 新規 ToDo」ボタン | shadcn/ui `Sheet`（右スライドドロワー）で入力 |
| 編集 | アイテム行クリック or 「編集」メニュー | 同上ドロワー（既存値プリフィル）|
| ステータス切替 | 行左端のチェックボックス | 楽観的 UI 更新 → `updateDoc` 反映 |
| 削除 | アクションメニュー「削除」| 確認ダイアログなし即削除 + **Undo Toast（3秒）**|

### 4.4 ドキュメント & データ管理

#### Markdown エディタ `/dashboard/workspaces/[workspaceId]/doc/[itemId]`

| モード | UI | |
|--------|-----|--|
| **編集** | `<textarea>` + `font-mono` フォント | 生テキスト直接入力 |
| **プレビュー** | `<ReactMarkdown remarkPlugins={[remarkGfm]}>` | GitHub スタイルレンダリング |

- ヘッダーの「編集 / プレビュー」トグルボタンで切り替え
- **自動保存**: 最後の入力から **3秒後** に Debounce で `updateDoc` を実行
- 「手動保存」ボタンも提供（Debounce キャンセル + 即時保存）

```typescript
// 自動保存の実装イメージ
const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

const handleChange = (value: string) => {
  setContent(value);
  clearTimeout(autoSaveTimer.current);
  autoSaveTimer.current = setTimeout(() => saveDoc(value), 3000);
};
```

#### CSV エディタ

```
ローカルファイル or Firestore の CSV テキスト
  ↓ papaparse.parse()
  2次元配列（string[][]）
  ↓ react-data-grid に渡す
  表計算ライクなセル編集 UI
  ↓（保存時）papaparse.unparse()
  CSV テキスト → Firestore に保存
```

#### インポート（ローカルファイル取り込み）

- 対応拡張子: `.md` `.txt` `.csv`
- **ファイルサイズ上限: 500KB**（`file.size > 500 * 1024` で弾く）
- 実装: `FileReader.readAsText()` でテキスト取得 → 新規アイテムとして Firestore に保存

#### エクスポート（ダウンロード）

```typescript
const handleDownload = (content: string, title: string, type: 'md' | 'txt' | 'csv') => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `${title}.${type}` });
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## 5. ワークスペース管理仕様（詳細）

### 5.1 制約・ルール

| 制約 | 値 | 理由 |
|------|-----|------|
| 最大ワークスペース数 | **10件 / ユーザー** | Firestore Read 数の節約、サイドバーの視認性確保 |
| ワークスペース名 | **1〜30文字** | サイドバー UI の文字折り返し防止 |
| 最小ワークスペース数 | **1件（削除不可）** | アイテムの行き場がなくなることを防止 |
| 初期ワークスペース | 「マイワークスペース」を初回ログイン時に自動生成 | ユーザーが即座に利用開始できるよう |

### 5.2 新規作成

**UIトリガー:** サイドバー最下部の「＋ 新規ワークスペース」ボタン

**上限到達時:** ボタンを `disabled` にし、hover 時に Tooltip「ワークスペースは最大10件まで作成できます」を表示。

**処理フロー:**

```
1. shadcn/ui <Dialog> を開き、名前入力フォームを表示
2. Zod バリデーション（1〜30文字）
3. 現在の workspaces 配列の最大 order 値に +1 した order で addDoc()
4. ダイアログを閉じ、新ワークスペースに router.push() で自動遷移
```

```typescript
// hooks/use-workspaces.ts（抜粋）
const createWorkspace = async (name: string): Promise<void> => {
  if (workspaces.length >= 10) {
    toast.error('ワークスペースは最大10件まで作成できます');
    return;
  }
  const maxOrder = workspaces.reduce((m, w) => Math.max(m, w.order), -1);
  const wsRef = doc(collection(db, `users/${uid}/workspaces`));
  await setDoc(wsRef, {
    name,
    order: maxOrder + 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await refetch(); // ローカル状態を再同期
};
```

### 5.3 名前変更

**UIトリガー:** 各ワークスペース行の `⋮` メニュー → 「名前を変更」

**処理フロー:**

```
1. 現在の名前を初期値として <Dialog> を開く
2. Zod バリデーション（1〜30文字）
3. updateDoc(wsRef, { name: newName, updatedAt: serverTimestamp() })
4. 楽観的 UI 更新（Firestore 応答前にローカル state を即時更新）
   → エラー時にロールバック
```

### 5.4 削除（2段階確認フロー）

**UIトリガー:** `⋮` メニュー → 「削除」

#### Step 0 — 最後の1件チェック
```
workspaces.length === 1
  → toast.error('最後のワークスペースは削除できません')
  → 処理中断
```

#### Step 1 — アイテム数を取得
```typescript
const itemsSnap = await getDocs(
  collection(db, `users/${uid}/workspaces/${wsId}/items`)
);
const itemCount = itemsSnap.size;
```

#### Step 2a — アイテムが 0 件の場合（シンプル確認）
```
┌─────────────────────────────────────────────┐
│  "マイワークスペース" を削除しますか？         │
│  この操作は取り消せません。                   │
│                                             │
│              [キャンセル] [削除する]          │
└─────────────────────────────────────────────┘
```

#### Step 2b — アイテムが 1 件以上の場合（名前入力確認）
```
┌─────────────────────────────────────────────────┐
│  "仕事メモ" には 12 件のアイテムが含まれています。  │
│  削除するとすべてのアイテムが完全に消えます。      │
│  元に戻すことはできません。                      │
│                                                │
│  確認のため、ワークスペース名を入力してください:   │
│  ┌──────────────────────────────────────────┐  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [キャンセル]   [削除する（入力一致時のみ有効）]  │
└─────────────────────────────────────────────────┘
```

```typescript
// 削除ボタンの disabled 制御
const isDeleteEnabled = inputValue === workspace.name;
```

#### 削除実行 — Firestore Batch Delete

Firestore はコレクション削除を自動カスケードしない。サブコレクションの items を先に全件削除してからワークスペース本体を削除する。  
Firestore バッチの **上限は 500 操作 / バッチ** のため、499件ずつ分割して処理する。

```typescript
const deleteWorkspace = async (wsId: string): Promise<void> => {
  // 1. items サブコレクションを全件削除
  const itemsSnap = await getDocs(
    collection(db, `users/${uid}/workspaces/${wsId}/items`)
  );
  const refs = itemsSnap.docs.map(d => d.ref);

  for (let i = 0; i < refs.length; i += 499) {
    const batch = writeBatch(db);
    refs.slice(i, i + 499).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  // 2. ワークスペース本体を削除
  await deleteDoc(doc(db, `users/${uid}/workspaces/${wsId}`));

  // 3. 残存するワークスペースの order=0 のものへ遷移
  const remaining = workspaces.filter(w => w.id !== wsId);
  const next = remaining.sort((a, b) => a.order - b.order)[0];
  router.push(`/dashboard/workspaces/${next.id}`);
};
```

### 5.5 並び替え（ドラッグ & ドロップ）

**使用ライブラリ:** `@dnd-kit/core` + `@dnd-kit/sortable`

**処理フロー:**

```
1. onDragEnd コールバックで新しい順序配列を生成（arrayMove を使用）
2. ローカル state を楽観的更新（UI は即時反映）
3. 全ワークスペースの order を 0, 1, 2... で振り直し
4. 変更のあったドキュメントのみ writeBatch で更新（最大 10 writes）
```

```typescript
const reorderWorkspaces = async (newOrder: Workspace[]): Promise<void> => {
  // 楽観的 UI 更新
  setWorkspaces(newOrder);

  const batch = writeBatch(db);
  let changed = false;
  newOrder.forEach((ws, index) => {
    if (ws.order !== index) {
      batch.update(doc(db, `users/${uid}/workspaces/${ws.id}`), {
        order: index,
        updatedAt: serverTimestamp(),
      });
      changed = true;
    }
  });

  if (changed) {
    try {
      await batch.commit();
    } catch {
      // Firestore 書き込み失敗時はロールバック
      await refetch();
      toast.error('並び替えの保存に失敗しました');
    }
  }
};
```

### 5.6 サイドバー UI コンポーネント構成

```tsx
<WorkspaceSidebar>
  {/* ヘッダー */}
  <div className="sidebar-section-header">ワークスペース</div>

  {/* ドラッグ可能なワークスペースリスト */}
  <DndContext onDragEnd={handleDragEnd}>
    <SortableContext items={workspaces.map(w => w.id)}>
      {workspaces.map(ws => (
        <WorkspaceItem key={ws.id} workspace={ws} isActive={ws.id === currentId}>
          {/* ドラッグハンドル ≡ */}
          <DragHandle />
          {/* ワークスペース名 */}
          <span className="truncate">{ws.name}</span>
          {/* コンテキストメニュー */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">⋮</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => openRenameDialog(ws)}>
                名前を変更
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                disabled={workspaces.length === 1}  {/* 最後の1件は disabled */}
                onClick={() => openDeleteDialog(ws)}
              >
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </WorkspaceItem>
      ))}
    </SortableContext>
  </DndContext>

  {/* 新規作成ボタン */}
  <Button
    variant="ghost"
    className="w-full justify-start"
    disabled={workspaces.length >= 10}
    onClick={openCreateDialog}
  >
    ＋ 新規ワークスペース
  </Button>
</WorkspaceSidebar>

{/* ダイアログ群（ポータルレンダリング） */}
<WorkspaceCreateDialog open={createOpen} onClose={...} />
<WorkspaceRenameDialog open={renameOpen} workspace={target} onClose={...} />
<WorkspaceDeleteDialog
  open={deleteOpen}
  workspace={target}
  itemCount={itemCount}     {/* Step 1 で取得した件数を渡す */}
  onClose={...}
/>
```

### 5.7 エラー状態一覧

| 状況 | UI 表示 | 挙動 |
|------|--------|------|
| 10件上限に達している | 作成ボタン `disabled` + Tooltip | ボタン無効化 |
| 最後の1件を削除しようとした | 削除メニュー `disabled` + `toast.error()` | 処理中断 |
| 削除確認の名前入力が不一致 | 削除ボタン `disabled` | ボタン無効化 |
| Firestore 操作失敗（全般） | `toast.error('操作に失敗しました。再度お試しください。')` | state をロールバック |
| ワークスペース名が空 / 30文字超 | フォーム inline エラーメッセージ | 送信不可 |

---

## 6. データベース設計（Firestore）

### 6.1 コレクション構造

```
users (Collection)
└── {userId} (Document)
     ├── email     : string
     ├── createdAt : timestamp
     └── workspaces (Sub-collection)
          └── {workspaceId} (Document)
               ├── name      : string       # 1〜30文字
               ├── order     : number       # 表示順（0以上の整数）
               ├── createdAt : timestamp
               ├── updatedAt : timestamp
               └── items (Sub-collection)
                    └── {itemId} (Document)
                         ├── type      : "todo" | "md" | "txt" | "csv"
                         ├── title     : string
                         ├── content   : string
                         ├── status    : string   # type により取りうる値が異なる（下表参照）
                         ├── createdAt : timestamp
                         └── updatedAt : timestamp
```

### 6.2 フィールド定義

#### `users/{userId}`

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `email` | string | ログインメールアドレス |
| `createdAt` | timestamp | アカウント作成日時 |

#### `workspaces/{workspaceId}`

| フィールド | 型 | 制約 | 説明 |
|-----------|-----|------|------|
| `name` | string | 1〜30文字 | ワークスペース名 |
| `order` | number | 0以上の整数 | サイドバー表示順 |
| `createdAt` | timestamp | | 作成日時 |
| `updatedAt` | timestamp | | 最終更新日時 |

#### `items/{itemId}`

| フィールド | 型 | 制約 | 説明 |
|-----------|-----|------|------|
| `type` | string | `"todo" \| "md" \| "txt" \| "csv"` | アイテム種別 |
| `title` | string | 1〜50文字 | タイトル |
| `content` | string | todo: 〜1,000文字 / doc: 〜150,000文字（≒ 450KB） | 本文・ファイル内容 |
| `status` | string | type に依存（下表参照） | ステータス |
| `createdAt` | timestamp | | 作成日時 |
| `updatedAt` | timestamp | | 最終更新日時 |

**status の取りうる値:**

| type | 取りうる status | 意味 |
|------|--------------|------|
| `"todo"` | `"pending"` / `"completed"` | 未完了 / 完了 |
| `"md"` `"txt"` `"csv"` | `"in_progress"` / `"completed"` | 作成中 / 完成 |

### 6.3 Firestore アクセスパターン

| 操作 | API | タイミング |
|------|-----|-----------|
| ワークスペース一覧取得 | `getDocs(workspacesRef, orderBy('order'))` | ダッシュボード初回描画時 |
| アイテム一覧取得 | `getDocs(itemsRef, orderBy('updatedAt','desc'), limit(100))` | ワークスペース切り替え時 |
| アイテム作成 | `addDoc(itemsRef, {...})` | 作成ボタン押下時 |
| アイテム更新 | `updateDoc(itemRef, {...})` | 保存時（または Debounce 後）|
| アイテム削除 | `deleteDoc(itemRef)` | 削除確定時 |
| ワークスペース作成 | `setDoc(wsRef, {...})` | 作成ダイアログ確定時 |
| ワークスペース名変更 | `updateDoc(wsRef, { name, updatedAt })` | 変更ダイアログ確定時 |
| ワークスペース削除 | `writeBatch` (items) → `deleteDoc(wsRef)` | 削除確定時 |
| ワークスペース並び替え | `writeBatch`（変更分のみ）| `onDragEnd` 時 |

> **`onSnapshot` は使用しない。**  
> 常時 Read カウントを消費するリアルタイムリスナーは採用せず、操作後に手動で `getDocs` を再実行する。

### 6.4 セキュリティルール

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 再帰ワイルドカード {document=**} で全サブコレクションをカバー
    // 自身の userId と一致するデータのみ読み書き可
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

> **Note:** ワークスペース数の上限（10件）はアプリケーション層で制御する。  
> Firestore ルールでの `count()` チェックはパフォーマンスコストが高いため採用しない。

---

## 7. バリデーション設計（Zod）

```typescript
// src/types/index.ts
import { z } from 'zod';

// ================================================================
// ユーティリティ
// ================================================================

/**
 * バイト数でコンテンツサイズを検証する。
 * 日本語テキストは UTF-8 で 1文字 = 3byte のため、
 * 150,000文字 × 3byte = 450,000byte ≒ 450KB を上限とする。
 * これは Firestore の 1MB/ドキュメント制限に対し十分な安全マージンを確保する。
 */
const docContentCheck = z.string().superRefine((val, ctx) => {
  const bytes = new TextEncoder().encode(val).length;
  if (bytes > 450_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'コンテンツは約150,000文字（450KB）以内で入力してください',
    });
  }
});

// ================================================================
// ワークスペース
// ================================================================

export const WorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'ワークスペース名は必須です')
    .max(30, 'ワークスペース名は30文字以内で入力してください'),
});

export type WorkspaceInput = z.infer<typeof WorkspaceSchema>;

// ================================================================
// ToDo アイテム
// ================================================================

export const TodoItemSchema = z.object({
  type: z.literal('todo'),
  title: z
    .string()
    .min(1, '題名は必須です')
    .max(50, '題名は50文字以内で入力してください'),
  content: z
    .string()
    .max(1000, '本文は1,000文字以内で入力してください')
    .default(''),
  status: z.enum(['pending', 'completed']),
});

// ================================================================
// ドキュメント・データアイテム（MD / TXT / CSV）
// ================================================================

export const DocItemSchema = z.object({
  type: z.enum(['md', 'txt', 'csv']),
  title: z
    .string()
    .min(1, '題名は必須です')
    .max(50, '題名は50文字以内で入力してください'),
  content: docContentCheck,  // バイト数チェック（日本語混在を考慮）
  status: z.enum(['in_progress', 'completed']),
});

// ================================================================
// 統合スキーマ（discriminated union）
// type フィールドで ToDo と Doc を完全分離
// ================================================================

export const ItemSchema = z.discriminatedUnion('type', [
  TodoItemSchema,
  DocItemSchema,
]);

// ================================================================
// ランタイム型
// ================================================================

export type TodoItemInput  = z.infer<typeof TodoItemSchema>;
export type DocItemInput   = z.infer<typeof DocItemSchema>;
export type ItemInput      = z.infer<typeof ItemSchema>;

export type Workspace = WorkspaceInput & {
  id: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TodoItem = TodoItemInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DocItem = DocItemInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Item = TodoItem | DocItem;

// ================================================================
// インポートファイルのバリデーション
// ================================================================

export const ImportFileSchema = z.object({
  name: z.string().regex(/\.(md|txt|csv)$/, '対応形式は .md / .txt / .csv のみです'),
  size: z.number().max(500 * 1024, 'ファイルサイズは500KB以内にしてください'),
});
```

---

## 8. ディレクトリ構造

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx                    # ログイン画面
│   │   └── register/
│   │       └── page.tsx                    # 新規登録画面
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # サイドバー + AuthGuard
│   │   ├── page.tsx                        # /dashboard/workspaces/[最初のID] へリダイレクト
│   │   └── workspaces/
│   │       └── [workspaceId]/
│   │           ├── page.tsx                # アイテム一覧（ホーム）
│   │           ├── todo/
│   │           │   └── [itemId]/
│   │           │       └── page.tsx        # ToDo 編集ページ
│   │           └── doc/
│   │               └── [itemId]/
│   │                   └── page.tsx        # MD / TXT / CSV エディタページ
│   │
│   ├── api/
│   │   └── auth/
│   │       ├── session/
│   │       │   └── route.ts               # POST: Session Cookie 発行
│   │       └── signout/
│   │           └── route.ts               # POST: Session Cookie クリア
│   │
│   ├── layout.tsx                          # RootLayout（AuthProvider でラップ）
│   └── page.tsx                            # LP / /dashboard へのリダイレクト
│
├── components/
│   ├── ui/                                 # shadcn/ui コンポーネント群
│   │
│   ├── auth/
│   │   └── auth-provider.tsx              # Firebase onAuthStateChanged + 初期化処理
│   │
│   ├── dashboard/
│   │   ├── item-list.tsx                  # アイテム一覧テーブル（フィルタリング含む）
│   │   ├── view-toggle.tsx                # すべて / ToDo / ドキュメント フィルタボタン
│   │   ├── new-item-button.tsx            # アイテム新規作成ボタン + 種別ドロップダウン
│   │   └── sidebar/
│   │       ├── workspace-sidebar.tsx      # サイドバー本体（@dnd-kit 統合）
│   │       ├── workspace-item.tsx         # 個別ワークスペース行（SortableItem）
│   │       └── workspace-dialogs.tsx      # 作成・変更・削除ダイアログ群
│   │
│   └── editors/
│       ├── markdown-editor.tsx            # 編集モード（textarea）+ プレビューモード切り替え
│       └── csv-editor.tsx                 # papaparse + react-data-grid ベース CSV エディタ
│
├── constants/
│   └── templates.ts                       # 固定テンプレート文字列（ハードコード）
│
├── hooks/
│   ├── use-auth.ts                        # AuthContext Consumer フック
│   ├── use-workspaces.ts                  # ワークスペース CRUD + 並び替えフック
│   └── use-items.ts                       # アイテム CRUD + フィルタリングフック
│
├── lib/
│   ├── firebase.ts                        # Firebase Client SDK 初期化
│   ├── firebase-admin.ts                  # Firebase Admin SDK 初期化（API Route 専用）
│   └── utils.ts                           # cn() 等ユーティリティ
│
└── types/
    └── index.ts                           # Zod スキーマ・型定義（§7 参照）
```

---

## 9. APIルート設計

### 9.1 `POST /api/auth/session`

| 項目 | 内容 |
|------|------|
| 目的 | Firebase ID トークンを検証し、HttpOnly Session Cookie を発行する |
| ランタイム | `nodejs`（`export const runtime = 'nodejs'` を明示）|
| リクエストボディ | `{ idToken: string }` |
| 成功レスポンス | `200` + `Set-Cookie: __session=...; HttpOnly; Secure; SameSite=Lax` |
| 失敗レスポンス | `401 Unauthorized` |

```typescript
// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const SESSION_EXPIRY_MS = 60 * 60 * 24 * 5 * 1000; // 5日

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();
  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });
    const res = NextResponse.json({ status: 'ok' });
    res.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   SESSION_EXPIRY_MS / 1000,
      path:     '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### 9.2 `POST /api/auth/signout`

| 項目 | 内容 |
|------|------|
| 目的 | Session Cookie を削除する（サインアウト処理）|
| リクエストボディ | なし |
| 成功レスポンス | `200` + `Set-Cookie: __session=; Max-Age=0` |

```typescript
// app/api/auth/signout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ status: 'ok' });
  res.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return res;
}
```

---

## 10. コスト・パフォーマンス設計

### 10.1 Firebase Spark（無料枠）制限

| リソース | 無料上限 / 日 |
|---------|-------------|
| Firestore 読み取り | 50,000 回 |
| Firestore 書き込み | 20,000 回 |
| Firestore 削除 | 20,000 回 |
| Authentication | 10,000 回 |

### 10.2 利用量試算（個人利用ケース）

想定条件: 1日5回ダッシュボードを開く / 1ワークスペースあたり最大50アイテム

| 操作 | 1回あたりの Read/Write | 1日あたり推定 |
|------|----------------------|-------------|
| ワークスペース一覧取得 | Read × 最大10 | 50 Read |
| アイテム一覧取得 | Read × 最大50 | 250 Read |
| アイテム作成・更新・削除 | Write × 1〜5 | 20 Write |
| **合計（推定）** | | **320 Read / 20 Write** |

無料枠 50,000 Read / 20,000 Write に対し **余裕で収まる**。

### 10.3 最適化戦略

1. **`onSnapshot` の完全不使用** — 操作後に `getDocs` を手動で1回実行する
2. **ワークスペース一覧はセッション中にキャッシュ** — ページ遷移のたびに再取得しない（`use-workspaces.ts` 内の state を使い回す）
3. **アイテム一覧はワークスペース切り替え時のみ再取得** — `use-items.ts` で `currentWorkspaceId` を dep にした `useEffect` で管理
4. **`limit(100)` で取得件数に上限** — `orderBy('updatedAt', 'desc') + limit(100)` で無制限取得を防ぐ
5. **楽観的 UI 更新** — Firestore の応答を待たずにローカル state を先行更新し、ユーザー体験を向上。エラー時はロールバック

---

## 11. 固定テンプレート仕様

新規ドキュメント作成時に選択できる5種類の組み込みテンプレート。  
`src/constants/templates.ts` に文字列としてハードコードする。`{{DATE}}` は実行時に現在日付で置換する。

### Markdown テンプレート（3種）

**① デイリージャーナル**
```markdown
# {{DATE}} デイリージャーナル

## 1. 今日の目標・タスク
- [ ] 

## 2. 実績・やったこと

## 3. 振り返り・気づき（KPT）
- **Keep（良かったこと）:**
- **Problem（課題）:**
- **Try（次に試すこと）:**
```

**② アイデア・企画ノート**
```markdown
# アイデアタイトル：

## 概要
どのようなアプリケーション、または機能か。

## 解決する課題

## 主要機能（MVP）
-

## 今後の進め方・メモ
```

**③ 技術備忘録（チートシート）**
```markdown
# 技術スタック名：備忘録・チートシート

## 基本コマンド / スニペット
\`\`\`bash
# コマンド例
\`\`\`

## トラブルシューティング
- **事象:**
- **原因:**
- **解決策:**
```

### CSV テンプレート（2種）

**④ マイルストーン・進捗管理**
```csv
タスク名,期日,優先度,備考
認証機能の実装,2026-06-01,高,Firebase Authの導入
UIコンポーネント配置,2026-06-05,中,shadcn/uiの導入
本番デプロイ,2026-06-10,高,Vercelへのホスティング
```

**⑤ 習慣トラッカー**
```csv
日付,コーディング(h),読書(ページ),筋トレ(y/n),メモ
2026-05-30,2.5,20,y,脚トレの日
2026-05-31,0.0,0,n,オフ
```

---

## 12. 環境変数

### `.env.local` テンプレート

```env
# ── Firebase Client SDK（ブラウザから参照可、NEXT_PUBLIC_ 必須）────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ── Firebase Admin SDK（サーバーサイド専用。NEXT_PUBLIC_ を絶対につけないこと）──
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
# 改行は \n でエスケープして1行で記述する
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

### 取得元

| 変数グループ | 取得元 |
|-------------|--------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Console → プロジェクト設定 → マイアプリ → SDK の設定と構成 |
| `FIREBASE_ADMIN_*` | Firebase Console → プロジェクト設定 → サービスアカウント → 秘密鍵を生成 |

> ⚠️ Vercel の環境変数ダッシュボードに `FIREBASE_ADMIN_PRIVATE_KEY` を登録する際は、  
> ダブルクォートを**含めず**に値（`-----BEGIN PRIVATE KEY-----\n...`）のみを貼り付ける。

---

## 13. セットアップ手順

### 前提条件

- Node.js v20 以上
- Firebase プロジェクト作成済み
  - Firestore Database（本番モード）有効化済み
  - Authentication 有効化済み（Google / メール + パスワード）
- Vercel アカウント作成済み

### 手順

```bash
# 1. リポジトリのクローンと移動
git clone https://github.com/<your-repo>/dashboard.git
cd dashboard

# 2. 依存パッケージのインストール
npm install

# 3. shadcn/ui コンポーネントの追加
npx shadcn@latest init
npx shadcn@latest add button dialog dropdown-menu input label \
  sheet badge separator toast tooltip

# 4. 環境変数の設定
cp .env.example .env.local
# → .env.local を編集して §12 の各値を入力

# 5. Firestore セキュリティルールのデプロイ
npx firebase login
npx firebase deploy --only firestore:rules

# 6. ローカル開発サーバーの起動
npm run dev
# → http://localhost:3000 で動作確認
```

### Vercel へのデプロイ

```bash
# Vercel CLI でデプロイ
npm install -g vercel
vercel --prod
```

Vercel ダッシュボード → Settings → Environment Variables に `.env.local` の内容をすべて登録する。

---