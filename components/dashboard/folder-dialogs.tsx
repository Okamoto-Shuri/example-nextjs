'use client';

import { useState, useEffect } from 'react';
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
import { FolderOpen, AlertTriangle } from 'lucide-react';
import type { Folder } from '@/types';

// ================================================================
// フォルダー作成ダイアログ
// ================================================================

interface FolderCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<string | null>;
}

export function FolderCreateDialog({
  open,
  onClose,
  onCreate,
}: FolderCreateDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // ダイアログを開くたびにリセット
  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const id = await onCreate(name.trim());
    setLoading(false);
    if (id) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            新規フォルダー
          </DialogTitle>
          <DialogDescription>
            フォルダー名を入力してください。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-create-name">フォルダー名</Label>
            <Input
              id="folder-create-name"
              placeholder="フォルダー名を入力..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? '作成中...' : '作成'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// フォルダーリネームダイアログ
// ================================================================

interface FolderRenameDialogProps {
  open: boolean;
  folder: Folder | null;
  onClose: () => void;
  onRename: (folderId: string, newName: string) => Promise<void>;
}

export function FolderRenameDialog({
  open,
  folder,
  onClose,
  onRename,
}: FolderRenameDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && folder) setName(folder.name);
  }, [open, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folder || !name.trim() || name.trim() === folder.name) {
      onClose();
      return;
    }
    setLoading(true);
    await onRename(folder.id, name.trim());
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            フォルダーの名前を変更
          </DialogTitle>
          <DialogDescription>
            新しいフォルダー名を入力してください。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-rename-name">フォルダー名</Label>
            <Input
              id="folder-rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// フォルダー削除確認ダイアログ
// ================================================================

interface FolderDeleteDialogProps {
  open: boolean;
  folder: Folder | null;
  itemCount: number;
  onClose: () => void;
  onDelete: (folderId: string) => Promise<void>;
}

export function FolderDeleteDialog({
  open,
  folder,
  itemCount,
  onClose,
  onDelete,
}: FolderDeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!folder) return;
    setLoading(true);
    await onDelete(folder.id);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            フォルダーの削除
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                「{folder?.name}」を削除しますか？
              </p>
              {itemCount > 0 && (
                <p className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-amber-700 dark:text-amber-400">
                  このフォルダー内の {itemCount} 件のアイテムはルートレベルに移動されます（削除されません）。
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            id="folder-delete-confirm"
            type="button"
            variant="destructive"
            disabled={loading}
            onClick={handleDelete}
          >
            {loading ? '削除中...' : '削除する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
