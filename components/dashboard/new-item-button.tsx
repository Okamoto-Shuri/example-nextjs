'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  CheckSquare,
  FileText,
  FileType,
  FileSpreadsheet,
} from 'lucide-react';
import { useItems } from '@/hooks/use-items';
import { templates, applyDatePlaceholder } from '@/constants/templates';
import { ImportFileSchema } from '@/types';
import type { ItemInput } from '@/types';

interface NewItemButtonProps {
  createItem: ReturnType<typeof useItems>['createItem'];
}

export function NewItemButton({ createItem }: NewItemButtonProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [pendingDocType, setPendingDocType] = useState<'md' | 'txt' | 'csv' | null>(null);

  // ToDo フォーム state
  const [todoTitle, setTodoTitle] = useState('');
  const [todoContent, setTodoContent] = useState('');
  const [todoLoading, setTodoLoading] = useState(false);

  // ── 種別選択ハンドラ ──────────────────────────────
  const handleTypeSelect = (type: 'todo' | 'md' | 'txt' | 'csv') => {
    if (type === 'todo') {
      setTodoDialogOpen(true);
    } else if (type === 'txt') {
      // テキストはテンプレートなしで直接作成
      handleCreateDoc('txt', '新規テキスト', '');
    } else {
      setPendingDocType(type);
      setTemplateDialogOpen(true);
    }
  };

  // ── ToDo 作成 ─────────────────────────────────────
  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoTitle.trim()) return;

    setTodoLoading(true);
    const input: ItemInput = {
      type: 'todo',
      title: todoTitle.trim(),
      content: todoContent,
      status: 'pending',
    };
    const itemId = await createItem(input);
    setTodoLoading(false);

    if (itemId) {
      setTodoTitle('');
      setTodoContent('');
      setTodoDialogOpen(false);
    }
  };

  // ── ドキュメント作成（テンプレ選択 or 空） ────────
  const handleCreateDoc = async (
    type: 'md' | 'txt' | 'csv',
    title: string,
    content: string
  ) => {
    const input: ItemInput = {
      type,
      title,
      content,
      status: 'in_progress',
    };
    const itemId = await createItem(input);
    if (itemId) {
      setTemplateDialogOpen(false);
      setPendingDocType(null);
      router.push(
        `/dashboard/workspaces/${workspaceId}/doc/${itemId}`
      );
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl || !pendingDocType) return;
    const content = applyDatePlaceholder(tmpl.content);
    handleCreateDoc(pendingDocType, tmpl.name, content);
  };

  // ── インポート ────────────────────────────────────
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.csv';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const validation = ImportFileSchema.safeParse({
        name: file.name,
        size: file.size,
      });
      if (!validation.success) {
        const { toast } = await import('sonner');
        toast.error(validation.error.issues[0].message);
        return;
      }

      const text = await file.text();
      const ext = file.name.split('.').pop() as 'md' | 'txt' | 'csv';
      const title = file.name.replace(/\.(md|txt|csv)$/, '');
      handleCreateDoc(ext, title, text);
    };

    input.click();
  };

  // ── テンプレート一覧（pendingDocType でフィルタ） ─
  const filteredTemplates = templates.filter(
    (t) => t.type === pendingDocType
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button id="new-item-button" className="gap-2">
            <Plus className="h-4 w-4" />
            新規作成
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            className="gap-2"
            onClick={() => handleTypeSelect('todo')}
          >
            <CheckSquare className="h-4 w-4" />
            ToDo
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => handleTypeSelect('md')}
          >
            <FileText className="h-4 w-4" />
            Markdown
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => handleTypeSelect('txt')}
          >
            <FileType className="h-4 w-4" />
            テキスト
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => handleTypeSelect('csv')}
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={handleImport}
          >
            <Plus className="h-4 w-4" />
            ファイルをインポート
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ToDo 作成モーダル（中央ダイアログ） */}
      <Dialog open={todoDialogOpen} onOpenChange={setTodoDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              新規 ToDo
            </DialogTitle>
            <DialogDescription>
              新しいタスクを作成します。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTodo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="todo-title">タイトル</Label>
              <Input
                id="todo-title"
                placeholder="タスク名を入力..."
                value={todoTitle}
                onChange={(e) => setTodoTitle(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-content">本文（任意）</Label>
              <textarea
                id="todo-content"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y"
                placeholder="詳細を入力..."
                value={todoContent}
                onChange={(e) => setTodoContent(e.target.value)}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {todoContent.length}/1000
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTodoDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={!todoTitle.trim() || todoLoading}>
                {todoLoading ? '作成中...' : '作成'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* テンプレート選択ダイアログ */}
      <Dialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open);
          if (!open) setPendingDocType(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>テンプレートを選択</DialogTitle>
            <DialogDescription>
              テンプレートを使って素早く作成できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {/* 空のドキュメント */}
            <button
              className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              onClick={() =>
                handleCreateDoc(
                  pendingDocType!,
                  `新規${pendingDocType === 'md' ? 'Markdown' : 'CSV'}`,
                  ''
                )
              }
            >
              <p className="font-medium text-foreground">空のドキュメント</p>
              <p className="text-sm text-muted-foreground">
                白紙の状態から始めます
              </p>
            </button>

            {/* テンプレート一覧 */}
            {filteredTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
                onClick={() => handleTemplateSelect(tmpl.id)}
              >
                <p className="font-medium text-foreground">{tmpl.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {tmpl.content.slice(0, 80)}...
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

