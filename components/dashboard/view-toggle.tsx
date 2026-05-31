'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ViewFilter } from '@/hooks/use-items';

interface ViewToggleProps {
  current: ViewFilter;
  onChange: (filter: ViewFilter) => void;
}

const filters: { value: ViewFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'todo', label: 'ToDo' },
  { value: 'doc', label: 'ドキュメント' },
];

export function ViewToggle({ current, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {filters.map((f) => (
        <Button
          key={f.value}
          id={`filter-${f.value}`}
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-3 text-sm transition-all',
            current === f.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}
