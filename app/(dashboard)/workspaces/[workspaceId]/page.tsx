'use client';

import { useParams } from 'next/navigation';
import { useItems } from '@/hooks/use-items';
import { ViewToggle } from '@/components/dashboard/view-toggle';
import { NewItemButton } from '@/components/dashboard/new-item-button';
import { ItemList } from '@/components/dashboard/item-list';
import { useWorkspaces } from '@/hooks/use-workspaces';

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { workspaces } = useWorkspaces();
  const currentWs = workspaces.find((w) => w.id === workspaceId);

  const {
    items,
    loading,
    filter,
    setFilter,
    createItem,
    toggleStatus,
    deleteItem,
    updateItem,
  } = useItems(workspaceId);

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {currentWs?.name ?? 'ワークスペース'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} 件のアイテム
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle current={filter} onChange={setFilter} />
          <NewItemButton createItem={createItem} />
        </div>
      </header>

      {/* アイテム一覧 */}
      <div className="flex-1 overflow-y-auto p-6">
        <ItemList
          items={items}
          loading={loading}
          toggleStatus={toggleStatus}
          deleteItem={deleteItem}
          updateItem={updateItem}
        />
      </div>
    </div>
  );
}
