'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { Loader2 } from 'lucide-react';

/**
 * /dashboard → /dashboard/workspaces/[最初のID] へリダイレクト
 */
export default function DashboardPage() {
  const router = useRouter();
  const { workspaces, loading } = useWorkspaces();

  useEffect(() => {
    if (!loading && workspaces.length > 0) {
      const first = workspaces.sort((a, b) => a.order - b.order)[0];
      router.replace(`/dashboard/workspaces/${first.id}`);
    }
  }, [loading, workspaces, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
