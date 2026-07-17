'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Item } from '@/types';

// ================================================================
// SortableItemRow コンポーネント
// （DnD ハンドル付きのラッパー）
// ================================================================

interface SortableItemRowProps {
  id: string;
  item: Item;
  isDragging?: boolean;
  children: React.ReactNode;
}

export function SortableItemRow({
  id,
  isDragging = false,
  children,
}: SortableItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex items-center',
        (isSortableDragging || isDragging) && 'opacity-50 z-50'
      )}
      {...attributes}
    >
      {/* ドラッグハンドル */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        className={cn(
          'flex h-full items-center px-1 py-2.5 cursor-grab active:cursor-grabbing',
          'text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors',
          'shrink-0 touch-none'
        )}
        aria-label="ドラッグして移動"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {/* アイテム本体 */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ================================================================
// DragOverlay 用プレビューコンポーネント
// ================================================================

interface DragOverlayItemProps {
  item: Item;
}

export function DragOverlayItem({ item }: DragOverlayItemProps) {
  // アイコンマッピング（インライン）
  const typeColors: Record<string, string> = {
    todo: 'text-blue-500',
    md: 'text-purple-500',
    txt: 'text-zinc-500',
    csv: 'text-emerald-500',
  };

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5',
      'bg-background border border-border shadow-2xl',
      'cursor-grabbing opacity-95 w-72 max-w-full',
      'ring-2 ring-primary/20'
    )}>
      <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      <span className={cn('text-xs shrink-0', typeColors[item.type] ?? 'text-muted-foreground')}>
        ●
      </span>
      <span className="flex-1 truncate text-sm font-medium text-foreground">
        {item.title}
      </span>
    </div>
  );
}
