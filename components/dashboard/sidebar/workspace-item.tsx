'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenuButton,
  SidebarMenuAction,
} from '@/components/ui/sidebar';
import { GripVertical, MoreVertical, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/types';

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive: boolean;
  isLast: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function WorkspaceItem({
  workspace,
  isActive,
  isLast,
  isCollapsed,
  onClick,
  onRename,
  onDelete,
}: WorkspaceItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workspace.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50')}
    >
      <SidebarMenuButton
        isActive={isActive}
        onClick={onClick}
        tooltip={workspace.name}
        className="group/workspace-item"
      >
        {/* ドラッグハンドル — collapsed時は非表示 */}
        {!isCollapsed && (
          <div
            className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover/workspace-item:opacity-100 transition-opacity shrink-0"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-3.5" />
          </div>
        )}

        {/* collapsed時のアイコン */}
        {isCollapsed && <FolderOpen className="size-4" />}

        <span className="truncate">{workspace.name}</span>
      </SidebarMenuButton>

      {/* コンテキストメニュー — collapsed時は非表示 */}
      {!isCollapsed && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover>
              <MoreVertical className="size-3.5" />
              <span className="sr-only">メニュー</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onRename}>
              名前を変更
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={isLast}
              onClick={onDelete}
            >
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
