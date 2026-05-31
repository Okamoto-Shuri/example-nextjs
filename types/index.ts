import { z } from 'zod/v4';

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
      code: 'custom',
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
  content: docContentCheck, // バイト数チェック（日本語混在を考慮）
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

export type TodoItemInput = z.infer<typeof TodoItemSchema>;
export type DocItemInput = z.infer<typeof DocItemSchema>;
export type ItemInput = z.infer<typeof ItemSchema>;

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
