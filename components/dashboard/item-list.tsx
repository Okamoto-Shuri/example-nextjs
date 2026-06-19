'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CheckSquare,
  FileText,
  FileType,
  FileSpreadsheet,
  MoreVertical,
  Square,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Item, ItemInput } from '@/types';
import type { useItems } from '@/hooks/use-items';

// ================================================================
// 相対時間表示ユーティリティ
// ================================================================

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 30) return `${days}日前`;
  return date.toLocaleDateString('ja-JP');
}

// ================================================================
// アイコンマッピング
// ================================================================

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'todo':
      return <CheckSquare className="h-4 w-4 text-blue-500" />;
    case 'md':
      return <FileText className="h-4 w-4 text-purple-500" />;
    case 'txt':
      return <FileType className="h-4 w-4 text-zinc-500" />;
    case 'csv':
      return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

// ================================================================
// ステータスバッジ
// ================================================================

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: '未完了', variant: 'outline' as const, className: 'text-amber-600 border-amber-300' },
    completed: { label: '完了', variant: 'outline' as const, className: 'text-emerald-600 border-emerald-300' },
    in_progress: { label: '作成中', variant: 'outline' as const, className: 'text-blue-600 border-blue-300' },
  }[status] ?? { label: status, variant: 'outline' as const, className: '' };

  return (
    <Badge variant={config.variant} className={cn('text-xs', config.className)}>
      {config.label}
    </Badge>
  );
}

// ================================================================
// メインコンポーネント
// ================================================================

interface ItemListProps {
  items: Item[];
  loading: boolean;
  toggleStatus: ReturnType<typeof useItems>['toggleStatus'];
  deleteItem: ReturnType<typeof useItems>['deleteItem'];
  updateItem: ReturnType<typeof useItems>['updateItem'];
  deleteCompletedTodos: ReturnType<typeof useItems>['deleteCompletedTodos'];
}

export function ItemList({
  items,
  loading,
  toggleStatus,
  deleteItem,
  updateItem,
  deleteCompletedTodos,
}: ItemListProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // ToDo 編集ダイアログ state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // 削除確認ダイアログ state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetItem, setDeleteTargetItem] = useState<Item | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 一括削除ダイアログ state
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const handleItemClick = (item: Item) => {
    if (item.type === 'todo') {
      // ToDo は中央モーダルで編集
      setEditItem(item);
      setEditTitle(item.title);
      setEditContent(item.content);
      setEditDialogOpen(true);
    } else {
      // ドキュメントはエディタページへ遷移
      router.push(
        `/dashboard/workspaces/${workspaceId}/doc/${item.id}`
      );
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !editTitle.trim()) return;

    setEditLoading(true);
    await updateItem(editItem.id, {
      title: editTitle.trim(),
      content: editContent,
    } as Partial<ItemInput>);
    setEditLoading(false);
    setEditDialogOpen(false);
    setEditItem(null);
  };

  // ── 削除確認 ──────────────────────────────────────
  const handleDeleteRequest = (item: Item) => {
    setDeleteTargetItem(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetItem) return;
    setDeleteLoading(true);
    await deleteItem(deleteTargetItem.id);
    setDeleteLoading(false);
    setDeleteDialogOpen(false);
    setDeleteTargetItem(null);
    // 編集ダイアログが開いていたら閉じる
    if (editDialogOpen) {
      setEditDialogOpen(false);
      setEditItem(null);
    }
  };

  // ── ローディング ──────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  // ── 空状態 ────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          アイテムがありません
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          右上の「新規作成」ボタンから、ToDoやドキュメントを追加しましょう。
        </p>
      </div>
    );
  }

  // ── 完了済みToDo数 ────────────────────────────────
  const completedTodoCount = items.filter(
    (item) => item.type === 'todo' && item.status === 'completed'
  ).length;

  // ── 一括削除ハンドラ ──────────────────────────────
  const handleBulkDeleteConfirm = async () => {
    setBulkDeleteLoading(true);
    await deleteCompletedTodos();
    setBulkDeleteLoading(false);
    setBulkDeleteDialogOpen(false);
  };

  // ── アイテム一覧 ──────────────────────────────────
  return (
    <>
      {/* 完了済みToDo一括削除ボタン */}
      {completedTodoCount > 0 && (
        <div className="flex items-center justify-end mb-3">
          <Button
            id="bulk-delete-completed"
            variant="outline"
            size="sm"
            className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-colors text-[10px] h-6 px-1"
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            完了済みを一括削除（{completedTodoCount}件）
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50 cursor-pointer"
          >
            {/* チェックボックス（ToDoのみ） */}
            {item.type === 'todo' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStatus(item);
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </button>
            ) : (
              <div className="shrink-0">
                <TypeIcon type={item.type} />
              </div>
            )}

            {/* タイトル + クリックエリア */}
            <button
              className={cn(
                'flex-1 truncate text-left text-sm',
                item.status === 'completed' && item.type === 'todo'
                  ? 'line-through text-muted-foreground'
                  : 'text-foreground'
              )}
              onClick={() => handleItemClick(item)}
            >
              {item.title}
            </button>

            {/* ステータスバッジ */}
            <StatusBadge status={item.status} />

            {/* 最終更新日時 */}
            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
              {relativeTime(item.updatedAt)}
            </span>

            {/* アクションメニュー */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => handleItemClick(item)}>
                  編集
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDeleteRequest(item)}
                >
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* ToDo 編集モーダル */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              ToDo を編集
            </DialogTitle>
            <DialogDescription>
              タスクの内容を編集します。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">タイトル</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">本文（任意）</Label>
              <textarea
                id="edit-content"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {editContent.length}/1000
              </p>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={() => {
                  if (editItem) {
                    handleDeleteRequest(editItem);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={!editTitle.trim() || editLoading}
                >
                  {editLoading ? '保存中...' : '保存'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              削除の確認
            </DialogTitle>
            <DialogDescription>
              「{deleteTargetItem?.title}」を削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTargetItem(null);
              }}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteLoading}
              onClick={handleDeleteConfirm}
            >
              {deleteLoading ? '削除中...' : '削除する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完了済みToDo 一括削除確認ダイアログ */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              完了済みToDoの一括削除
            </DialogTitle>
            <DialogDescription>
              完了済みのToDo {completedTodoCount}件をすべて削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkDeleteDialogOpen(false);
              }}
            >
              キャンセル
            </Button>
            <Button
              id="bulk-delete-confirm"
              type="button"
              variant="destructive"
              disabled={bulkDeleteLoading}
              onClick={handleBulkDeleteConfirm}
            >
              {bulkDeleteLoading ? '削除中...' : `${completedTodoCount}件を削除する`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

