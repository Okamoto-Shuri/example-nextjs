'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { GripVertical, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/types';

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function WorkspaceItem({
  workspace,
  isActive,
  isLast,
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
      className={cn(
        'group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      {/* ドラッグハンドル */}
      <button
        className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* ワークスペース名 */}
      <button
        className="flex-1 truncate text-left"
        onClick={onClick}
      >
        {workspace.name}
      </button>

      {/* コンテキストメニュー */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
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
    </div>
  );
}
