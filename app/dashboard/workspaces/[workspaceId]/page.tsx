'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useItems } from '@/hooks/use-items';
import { useFolders } from '@/hooks/use-folders';
import { ViewToggle } from '@/components/dashboard/view-toggle';
import { NewItemButton } from '@/components/dashboard/new-item-button';
import { ItemList } from '@/components/dashboard/item-list';
import { FolderSection } from '@/components/dashboard/folder-section';
import { DragOverlayItem } from '@/components/dashboard/sortable-item-row';
import {
  FolderCreateDialog,
  FolderRenameDialog,
  FolderDeleteDialog,
} from '@/components/dashboard/folder-dialogs';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { Button } from '@/components/ui/button';
import { FolderPlus } from 'lucide-react';
import { serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Folder, Item } from '@/types';

// ================================================================
// ルートドロップゾーン
// ================================================================

function RootDropZone({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={
        isOver
          ? 'absolute inset-0 rounded-lg ring-2 ring-primary/40 bg-primary/5 pointer-events-none z-10'
          : 'hidden'
      }
    />
  );
}

// ================================================================
// ワークスペースページ
// ================================================================

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { user } = useAuth();
  const uid = user?.uid;

  const { workspaces } = useWorkspaces();
  const currentWs = workspaces.find((w) => w.id === workspaceId);

  const {
    items,
    allItems,
    loading,
    filter,
    setFilter,
    createItem,
    toggleStatus,
    deleteItem,
    updateItem,
    deleteCompletedTodos,
    moveItemToFolder,
    reorderItems,
    setItems,
  } = useItems(workspaceId);

  const {
    folders,
    loading: foldersLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    getFolderItemCount,
  } = useFolders(workspaceId);

  // ── フォルダーダイアログ state ────────────────────
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState<Folder | null>(null);
  const [folderItemCount, setFolderItemCount] = useState(0);

  const openRenameFolder = (folder: Folder) => {
    setTargetFolder(folder);
    setRenameFolderOpen(true);
  };

  const openDeleteFolder = async (folder: Folder) => {
    setTargetFolder(folder);
    const count = await getFolderItemCount(folder.id);
    setFolderItemCount(count);
    setDeleteFolderOpen(true);
  };

  // ── DnD state ─────────────────────────────────────
  const [activeItem, setActiveItem] = useState<Item | null>(null);

  // ── DnD センサー ──────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── ルートドロップゾーン ──────────────────────────
  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: 'root-container',
    data: { type: 'root' },
  });

  // ── フォルダーに属さないルートアイテム ───────────
  const rootItems = items.filter(
    (item) => !item.folderId || item.folderId === null
  );

  // 全アイテム数（フィルター前）
  const totalItemCount = allItems.length;

  // ── itemsPath ─────────────────────────────────────
  const itemsPath = uid && workspaceId
    ? `users/${uid}/workspaces/${workspaceId}/items`
    : null;

  // ── DnD ハンドラ ──────────────────────────────────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const dragged = allItems.find((i) => i.id === event.active.id);
      setActiveItem(dragged ?? null);
    },
    [allItems]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const draggedItem = allItems.find((i) => i.id === active.id);
      if (!draggedItem) return;

      const overId = over.id as string;

      // フォルダーヘッダーの上に来た場合 → フォルダーに移動（ライブプレビュー）
      if (overId.startsWith('folder-header-')) {
        const targetFolderId = overId.replace('folder-header-', '');
        if (draggedItem.folderId !== targetFolderId) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === draggedItem.id
                ? { ...item, folderId: targetFolderId }
                : item
            ) as Item[]
          );
        }
        return;
      }

      // ルートコンテナの上に来た場合 → ルートに移動
      if (overId === 'root-container' && draggedItem.folderId !== null) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === draggedItem.id
              ? { ...item, folderId: null }
              : item
          ) as Item[]
        );
        return;
      }

      // 同じコンテナ内の並び替え（他のアイテムの上に来た場合）
      const overItem = allItems.find((i) => i.id === overId);
      if (!overItem) return;

      // 異なるフォルダー間の移動
      if (draggedItem.folderId !== overItem.folderId) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === draggedItem.id
              ? { ...item, folderId: overItem.folderId }
              : item
          ) as Item[]
        );
      }
    },
    [allItems, setItems]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveItem(null);

      if (!over || !itemsPath) return;

      const draggedItem = allItems.find((i) => i.id === active.id);
      if (!draggedItem) return;

      const overId = over.id as string;

      // フォルダーヘッダーへのドロップ → folderId 確定保存
      if (overId.startsWith('folder-header-')) {
        const targetFolderId = overId.replace('folder-header-', '');
        if (draggedItem.folderId !== targetFolderId) {
          try {
            await updateDoc(doc(db, itemsPath, draggedItem.id), {
              folderId: targetFolderId,
              updatedAt: serverTimestamp(),
            });
          } catch {
            // ロールバックは fetchItems で
            const { toast } = await import('sonner');
            toast.error('移動に失敗しました');
          }
        }
        return;
      }

      // ルートへのドロップ
      if (overId === 'root-container') {
        if (draggedItem.folderId !== null) {
          try {
            await updateDoc(doc(db, itemsPath, draggedItem.id), {
              folderId: null,
              updatedAt: serverTimestamp(),
            });
          } catch {
            const { toast } = await import('sonner');
            toast.error('移動に失敗しました');
          }
        }
        return;
      }

      // 同一コンテナ内の並び替え
      const overItem = allItems.find((i) => i.id === overId);
      if (!overItem) return;

      // 最新の state から並び替え
      const currentFolderId = draggedItem.folderId ?? null;
      const containerItems = allItems
        .filter((i) => (i.folderId ?? null) === currentFolderId)
        .sort((a, b) => a.order - b.order);

      const oldIndex = containerItems.findIndex((i) => i.id === active.id);
      const newIndex = containerItems.findIndex((i) => i.id === overId);

      if (oldIndex === newIndex) return;

      const reordered = arrayMove(containerItems, oldIndex, newIndex);

      // order を再割り当て
      const updatedItems = reordered.map((item, index) => ({
        ...item,
        order: index,
      }));

      // allItems 全体を更新
      const newAllItems = allItems.map((item) => {
        const updated = updatedItems.find((u) => u.id === item.id);
        return updated ?? item;
      }) as Item[];

      setItems(newAllItems);

      // Firestore batch 更新
      const batch = writeBatch(db);
      updatedItems.forEach((item) => {
        batch.update(doc(db, itemsPath, item.id), {
          order: item.order,
          updatedAt: serverTimestamp(),
        });
      });
      try {
        await batch.commit();
      } catch {
        const { toast } = await import('sonner');
        toast.error('並び替えの保存に失敗しました');
      }
    },
    [allItems, itemsPath, setItems]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* ヘッダー */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {currentWs?.name ?? 'ワークスペース'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalItemCount} 件のアイテム・{folders.length} 件のフォルダー
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle current={filter} onChange={setFilter} />
            <Button
              id="new-folder-button"
              variant="outline"
              size="default"
              className="gap-2"
              onClick={() => setCreateFolderOpen(true)}
              disabled={folders.length >= 20}
            >
              <FolderPlus className="h-4 w-4" />
              フォルダー
            </Button>
            <NewItemButton createItem={createItem} />
          </div>
        </header>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ルートレベルのアイテム */}
          {(rootItems.length > 0 || (!foldersLoading && folders.length === 0)) && (
            <section>
              {folders.length > 0 && (
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  ルート
                </h2>
              )}
              {/* ルートコンテナ（ドロップ可能） */}
              <div ref={setRootDropRef} className="relative min-h-[40px]">
                <RootDropZone isOver={isRootOver && !!activeItem?.folderId} />
                <ItemList
                  items={rootItems}
                  loading={loading}
                  toggleStatus={toggleStatus}
                  deleteItem={deleteItem}
                  updateItem={updateItem}
                  deleteCompletedTodos={deleteCompletedTodos}
                  moveItemToFolder={moveItemToFolder}
                  allFolders={folders}
                  currentFolderId={null}
                  containerId="root-container"
                />
              </div>
            </section>
          )}

          {/* フォルダーセクション */}
          {folders.length > 0 && (
            <section className="space-y-2">
              {folders.length > 0 && rootItems.length > 0 && (
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  フォルダー
                </h2>
              )}
              {folders.map((folder) => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  items={items}
                  allFolders={folders}
                  loading={loading}
                  toggleStatus={toggleStatus}
                  deleteItem={deleteItem}
                  updateItem={updateItem}
                  deleteCompletedTodos={deleteCompletedTodos}
                  moveItemToFolder={moveItemToFolder}
                  createItem={createItem}
                  onRename={openRenameFolder}
                  onDelete={openDeleteFolder}
                />
              ))}
            </section>
          )}
        </div>

        {/* フォルダーダイアログ群 */}
        <FolderCreateDialog
          open={createFolderOpen}
          onClose={() => setCreateFolderOpen(false)}
          onCreate={createFolder}
        />
        <FolderRenameDialog
          open={renameFolderOpen}
          folder={targetFolder}
          onClose={() => {
            setRenameFolderOpen(false);
            setTargetFolder(null);
          }}
          onRename={renameFolder}
        />
        <FolderDeleteDialog
          open={deleteFolderOpen}
          folder={targetFolder}
          itemCount={folderItemCount}
          onClose={() => {
            setDeleteFolderOpen(false);
            setTargetFolder(null);
          }}
          onDelete={deleteFolder}
        />
      </div>

      {/* DnD ドラッグ中のオーバーレイ */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeItem ? <DragOverlayItem item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
