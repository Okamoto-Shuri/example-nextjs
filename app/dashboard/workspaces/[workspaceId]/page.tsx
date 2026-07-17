'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useItems } from '@/hooks/use-items';
import { useFolders } from '@/hooks/use-folders';
import { ViewToggle } from '@/components/dashboard/view-toggle';
import { NewItemButton } from '@/components/dashboard/new-item-button';
import { ItemList } from '@/components/dashboard/item-list';
import { FolderSection } from '@/components/dashboard/folder-section';
import {
  FolderCreateDialog,
  FolderRenameDialog,
  FolderDeleteDialog,
} from '@/components/dashboard/folder-dialogs';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { Button } from '@/components/ui/button';
import { FolderPlus } from 'lucide-react';
import type { Folder } from '@/types';

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

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

  // フォルダーに属さないルートアイテム
  const rootItems = items.filter(
    (item) => !item.folderId || item.folderId === null
  );

  // 全アイテム数（フィルター前）
  const totalItemCount = allItems.length;

  return (
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ルートレベルのアイテム */}
        {(rootItems.length > 0 || (!foldersLoading && folders.length === 0)) && (
          <section>
            {folders.length > 0 && (
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                ルート
              </h2>
            )}
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
            />
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
  );
}
