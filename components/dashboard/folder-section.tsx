'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  ChevronRight,
  FolderOpen,
  Folder as FolderIcon,
  MoreVertical,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ItemList } from '@/components/dashboard/item-list';
import { NewItemButton } from '@/components/dashboard/new-item-button';
import type { Folder, Item } from '@/types';
import type { useItems } from '@/hooks/use-items';

// ================================================================
// FolderSection コンポーネント
// ================================================================

interface FolderSectionProps {
  folder: Folder;
  items: Item[];
  allFolders: Folder[];
  loading: boolean;
  toggleStatus: ReturnType<typeof useItems>['toggleStatus'];
  deleteItem: ReturnType<typeof useItems>['deleteItem'];
  updateItem: ReturnType<typeof useItems>['updateItem'];
  deleteCompletedTodos: ReturnType<typeof useItems>['deleteCompletedTodos'];
  moveItemToFolder: ReturnType<typeof useItems>['moveItemToFolder'];
  createItem: ReturnType<typeof useItems>['createItem'];
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  defaultOpen?: boolean;
}

export function FolderSection({
  folder,
  items,
  allFolders,
  loading,
  toggleStatus,
  deleteItem,
  updateItem,
  deleteCompletedTodos,
  moveItemToFolder,
  createItem,
  onRename,
  onDelete,
  defaultOpen = true,
}: FolderSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const folderItems = items.filter((item) => item.folderId === folder.id);

  // ── フォルダーヘッダーをドロップターゲットにする ─
  // id: `folder-header-{folderId}` として workspace page の onDragEnd で識別
  const { setNodeRef: setHeaderDropRef, isOver: isHeaderOver } = useDroppable({
    id: `folder-header-${folder.id}`,
    data: { type: 'folder-header', folderId: folder.id },
  });

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      {/* フォルダーヘッダー（ドロップ可能） */}
      <div
        ref={setHeaderDropRef}
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none',
          'transition-colors group',
          isHeaderOver
            ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/30'
            : 'bg-muted/40 hover:bg-muted/70'
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {/* ドロップ中のビジュアルヒント */}
        {isHeaderOver && (
          <span className="text-xs text-primary font-medium shrink-0">
            ここに移動
          </span>
        )}

        {/* 展開/折りたたみアイコン */}
        {!isHeaderOver && (
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
              isOpen && 'rotate-90'
            )}
          />
        )}

        {/* フォルダーアイコン */}
        {isOpen || isHeaderOver ? (
          <FolderOpen className={cn('h-4 w-4 shrink-0', isHeaderOver ? 'text-primary' : 'text-amber-500')} />
        ) : (
          <FolderIcon className="h-4 w-4 text-amber-500 shrink-0" />
        )}

        {/* フォルダー名 */}
        <span className={cn(
          'flex-1 text-sm font-medium truncate',
          isHeaderOver ? 'text-primary' : 'text-foreground'
        )}>
          {folder.name}
        </span>

        {/* アイテム数バッジ */}
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {folderItems.length} 件
        </span>

        {/* アクションメニュー */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRename(folder);
              }}
            >
              名前を変更
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder);
              }}
            >
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* フォルダー内コンテンツ */}
      {isOpen && (
        <div className="px-3 py-2 bg-background">
          {folderItems.length === 0 && !loading ? (
            <div className={cn(
              'flex flex-col items-center justify-center py-6 text-center gap-2 rounded-lg transition-colors',
              isHeaderOver && 'bg-primary/5'
            )}>
              <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                このフォルダーは空です
              </p>
              <div onClick={(e) => e.stopPropagation()}>
                <NewItemButton
                  createItem={createItem}
                  folderId={folder.id}
                  variant="outline"
                  size="sm"
                  label={
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      アイテムを追加
                    </span>
                  }
                />
              </div>
            </div>
          ) : (
            <ItemList
              items={folderItems}
              loading={loading}
              toggleStatus={toggleStatus}
              deleteItem={deleteItem}
              updateItem={updateItem}
              deleteCompletedTodos={deleteCompletedTodos}
              moveItemToFolder={moveItemToFolder}
              allFolders={allFolders}
              currentFolderId={folder.id}
              containerId={`folder-${folder.id}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
