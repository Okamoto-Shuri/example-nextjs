'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Plus, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WorkspaceItem } from './workspace-item';
import {
  WorkspaceCreateDialog,
  WorkspaceRenameDialog,
  WorkspaceDeleteDialog,
} from './workspace-dialogs';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useAuth } from '@/hooks/use-auth';
import type { Workspace } from '@/types';

export function WorkspaceSidebar() {
  const router = useRouter();
  const params = useParams();
  const currentId = params.workspaceId as string | undefined;

  const { signOut } = useAuth();
  const {
    workspaces,
    loading,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    reorderWorkspaces,
    getItemCount,
  } = useWorkspaces();

  // ── ダイアログ state ──────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetWs, setTargetWs] = useState<Workspace | null>(null);
  const [deleteItemCount, setDeleteItemCount] = useState(0);

  // ── DnD センサー ──────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = workspaces.findIndex((w) => w.id === active.id);
      const newIndex = workspaces.findIndex((w) => w.id === over.id);
      const newOrder = arrayMove(workspaces, oldIndex, newIndex);
      reorderWorkspaces(newOrder);
    },
    [workspaces, reorderWorkspaces]
  );

  // ── ハンドラ ──────────────────────────────────────
  const handleCreate = async (name: string) => {
    const wsId = await createWorkspace(name);
    if (wsId) {
      router.push(`/dashboard/workspaces/${wsId}`);
    }
    return wsId;
  };

  const openRenameDialog = (ws: Workspace) => {
    setTargetWs(ws);
    setRenameOpen(true);
  };

  const openDeleteDialog = async (ws: Workspace) => {
    setTargetWs(ws);
    const count = await getItemCount(ws.id);
    setDeleteItemCount(count);
    setDeleteOpen(true);
  };

  const handleDelete = async (wsId: string) => {
    const nextId = await deleteWorkspace(wsId);
    if (nextId) {
      router.push(`/dashboard/workspaces/${nextId}`);
    }
    return nextId;
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Dashboard
          </span>
        </div>

        <Separator />

        {/* セクションヘッダー */}
        <div className="px-4 pt-4 pb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            ワークスペース
          </span>
        </div>

        {/* ワークスペースリスト */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workspaces.map((w) => w.id)}
                strategy={verticalListSortingStrategy}
              >
                {workspaces.map((ws) => (
                  <WorkspaceItem
                    key={ws.id}
                    workspace={ws}
                    isActive={ws.id === currentId}
                    isLast={workspaces.length === 1}
                    onClick={() =>
                      router.push(`/dashboard/workspaces/${ws.id}`)
                    }
                    onRename={() => openRenameDialog(ws)}
                    onDelete={() => openDeleteDialog(ws)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* 新規作成ボタン */}
        <div className="px-2 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  id="create-workspace-button"
                  variant="ghost"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                  disabled={workspaces.length >= 10}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  新規ワークスペース
                </Button>
              </div>
            </TooltipTrigger>
            {workspaces.length >= 10 && (
              <TooltipContent>
                ワークスペースは最大10件まで作成できます
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        <Separator />

        {/* サインアウト */}
        <div className="px-2 py-2">
          <Button
            id="signout-button"
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            サインアウト
          </Button>
        </div>
      </aside>

      {/* ダイアログ群 */}
      <WorkspaceCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <WorkspaceRenameDialog
        open={renameOpen}
        workspace={targetWs}
        onClose={() => {
          setRenameOpen(false);
          setTargetWs(null);
        }}
        onRename={renameWorkspace}
      />
      <WorkspaceDeleteDialog
        open={deleteOpen}
        workspace={targetWs}
        itemCount={deleteItemCount}
        onClose={() => {
          setDeleteOpen(false);
          setTargetWs(null);
        }}
        onDelete={handleDelete}
      />
    </TooltipProvider>
  );
}
