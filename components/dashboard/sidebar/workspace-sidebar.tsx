'use client';

import Image from 'next/image';

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
import { Plus, LogOut, ChevronsUpDown } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const { state } = useSidebar();

  const { user, signOut } = useAuth();
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
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        {/* ── ヘッダー ── */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden bg-white">
                    <Image
                      src="/novabase-logo.png"
                      alt="NovaBase"
                      width={32}
                      height={32}
                      className="size-7 object-contain"
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-bold text-base tracking-tight">NovaBase</span>
                    <span className="truncate text-xs text-muted-foreground">
                      ワークスペース管理
                    </span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        {/* ── ワークスペースリスト ── */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>ワークスペース</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {loading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    ))}
                  </>
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
                        <SidebarMenuItem key={ws.id}>
                          <WorkspaceItem
                            workspace={ws}
                            isActive={ws.id === currentId}
                            isLast={workspaces.length === 1}
                            isCollapsed={state === 'collapsed'}
                            onClick={() =>
                              router.push(`/dashboard/workspaces/${ws.id}`)
                            }
                            onRename={() => openRenameDialog(ws)}
                            onDelete={() => openDeleteDialog(ws)}
                          />
                        </SidebarMenuItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {/* 新規作成ボタン */}
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <SidebarMenuButton
                          onClick={() => setCreateOpen(true)}
                          disabled={workspaces.length >= 10}
                          tooltip="新規ワークスペース"
                        >
                          <Plus className="size-4" />
                          <span>新規ワークスペース</span>
                        </SidebarMenuButton>
                      </div>
                    </TooltipTrigger>
                    {workspaces.length >= 10 && (
                      <TooltipContent>
                        ワークスペースは最大10件まで作成できます
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        {/* ── フッター (サインアウト) ── */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 text-white text-xs font-bold uppercase">
                      {user?.email?.charAt(0) ?? 'U'}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.displayName ?? 'ユーザー'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email ?? ''}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 size-4" />
                    サインアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

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
    </>
  );
}
