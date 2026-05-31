'use client';

import { useState, useCallback } from 'react';
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
import { WorkspaceSchema } from '@/types';
import type { Workspace } from '@/types';

// ================================================================
// 作成ダイアログ
// ================================================================

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<string | null>;
}

export function WorkspaceCreateDialog({
  open,
  onClose,
  onCreate,
}: CreateDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = WorkspaceSchema.safeParse({ name });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    const wsId = await onCreate(name);
    setLoading(false);

    if (wsId) {
      setName('');
      onClose();
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新規ワークスペース</DialogTitle>
          <DialogDescription>
            新しいワークスペースの名前を入力してください。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">ワークスペース名</Label>
              <Input
                id="ws-name"
                placeholder="例: 仕事メモ"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '作成中...' : '作成'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// 名前変更ダイアログ
// ================================================================

interface RenameDialogProps {
  open: boolean;
  workspace: Workspace | null;
  onClose: () => void;
  onRename: (wsId: string, newName: string) => Promise<void>;
}

export function WorkspaceRenameDialog({
  open,
  workspace,
  onClose,
  onRename,
}: RenameDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ダイアログが開いたときに既存の名前をセット
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && workspace) {
        setName(workspace.name);
        setError('');
      }
      if (!isOpen) {
        onClose();
      }
    },
    [workspace, onClose]
  );

  // openが変わったときも名前をリセット
  if (open && workspace && name === '' && name !== workspace.name) {
    setName(workspace.name);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setError('');

    const result = WorkspaceSchema.safeParse({ name });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    await onRename(workspace.id, name);
    setLoading(false);
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ワークスペース名を変更</DialogTitle>
          <DialogDescription>
            新しい名前を入力してください。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ws-rename">ワークスペース名</Label>
              <Input
                id="ws-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '変更中...' : '変更'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// 削除ダイアログ（2段階確認フロー）
// ================================================================

interface DeleteDialogProps {
  open: boolean;
  workspace: Workspace | null;
  itemCount: number;
  onClose: () => void;
  onDelete: (wsId: string) => Promise<string | null>;
}

export function WorkspaceDeleteDialog({
  open,
  workspace,
  itemCount,
  onClose,
  onDelete,
}: DeleteDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmName('');
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!workspace) return;
    setLoading(true);
    await onDelete(workspace.id);
    setLoading(false);
    setConfirmName('');
    onClose();
  };

  const isDeleteEnabled =
    itemCount === 0 || confirmName === workspace?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            ワークスペースを削除
          </DialogTitle>
          <DialogDescription>
            {itemCount === 0 ? (
              <>
                「{workspace?.name}」を削除しますか？
                <br />
                この操作は取り消せません。
              </>
            ) : (
              <>
                「{workspace?.name}」には{' '}
                <strong>{itemCount} 件</strong>のアイテムが含まれています。
                <br />
                削除するとすべてのアイテムが完全に消えます。
                <br />
                元に戻すことはできません。
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {itemCount > 0 && (
          <div className="space-y-2 py-4">
            <Label htmlFor="confirm-delete">
              確認のため、ワークスペース名を入力してください:
            </Label>
            <Input
              id="confirm-delete"
              placeholder={workspace?.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            disabled={!isDeleteEnabled || loading}
            onClick={handleDelete}
          >
            {loading ? '削除中...' : '削除する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
