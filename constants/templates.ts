export type TemplateType = 'md' | 'csv';

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
}

/**
 * {{DATE}} プレースホルダーを現在日付（YYYY-MM-DD）で置換する
 */
export function applyDatePlaceholder(content: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return content.replace(/\{\{DATE\}\}/g, today);
}

export const templates: Template[] = [
  // ── Markdown テンプレート ──────────────────────────
  {
    id: 'daily-journal',
    name: 'デイリージャーナル',
    type: 'md',
    content: `# {{DATE}} デイリージャーナル

## 1. 今日の目標・タスク
- [ ] 

## 2. 実績・やったこと

## 3. 振り返り・気づき（KPT）
- **Keep（良かったこと）:**
- **Problem（課題）:**
- **Try（次に試すこと）:**
`,
  },
  {
    id: 'idea-note',
    name: 'アイデア・企画ノート',
    type: 'md',
    content: `# アイデアタイトル：

## 概要
どのようなアプリケーション、または機能か。

## 解決する課題

## 主要機能（MVP）
-

## 今後の進め方・メモ
`,
  },
  {
    id: 'tech-cheatsheet',
    name: '技術備忘録（チートシート）',
    type: 'md',
    content: `# 技術スタック名：備忘録・チートシート

## 基本コマンド / スニペット
\`\`\`bash
# コマンド例
\`\`\`

## トラブルシューティング
- **事象:**
- **原因:**
- **解決策:**
`,
  },

  // ── CSV テンプレート ──────────────────────────────
  {
    id: 'milestone-tracker',
    name: 'マイルストーン・進捗管理',
    type: 'csv',
    content: `タスク名,期日,優先度,備考
認証機能の実装,2026-06-01,高,Firebase Authの導入
UIコンポーネント配置,2026-06-05,中,shadcn/uiの導入
本番デプロイ,2026-06-10,高,Vercelへのホスティング`,
  },
  {
    id: 'habit-tracker',
    name: '習慣トラッカー',
    type: 'csv',
    content: `日付,コーディング(h),読書(ページ),筋トレ(y/n),メモ
2026-05-30,2.5,20,y,脚トレの日
2026-05-31,0.0,0,n,オフ`,
  },
];
