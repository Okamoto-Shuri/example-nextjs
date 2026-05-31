'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { MarkdownEditor } from '@/components/editors/markdown-editor';
import { CsvEditor } from '@/components/editors/csv-editor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function DocEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const workspaceId = params.workspaceId as string;
  const itemId = params.itemId as string;
  const uid = user?.uid;

  const [item, setItem] = useState<{
    type: string;
    title: string;
    content: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── アイテム取得 ──────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const fetchItem = async () => {
      setLoading(true);
      try {
        const docRef = doc(
          db,
          `users/${uid}/workspaces/${workspaceId}/items/${itemId}`
        );
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setItem({
            type: data.type,
            title: data.title,
            content: data.content ?? '',
            status: data.status,
          });
        } else {
          toast.error('アイテムが見つかりませんでした');
          router.push(`/dashboard/workspaces/${workspaceId}`);
        }
      } catch {
        toast.error('アイテムの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [uid, workspaceId, itemId, router]);

  // ── 保存ハンドラ ──────────────────────────────────
  const handleSave = useCallback(
    async (title: string, content: string) => {
      if (!uid) return;
      try {
        await updateDoc(
          doc(db, `users/${uid}/workspaces/${workspaceId}/items/${itemId}`),
          {
            title,
            content,
            updatedAt: serverTimestamp(),
          }
        );
      } catch {
        toast.error('保存に失敗しました。再度お試しください。');
      }
    },
    [uid, workspaceId, itemId]
  );

  // ── ローディング ──────────────────────────────────
  if (loading || !item) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 戻るボタン */}
      <div className="border-b border-border px-4 py-2">
        <Link href={`/dashboard/workspaces/${workspaceId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
      </div>

      {/* エディタ */}
      <div className="flex-1 overflow-hidden">
        {item.type === 'csv' ? (
          <CsvEditor
            title={item.title}
            content={item.content}
            onSave={handleSave}
          />
        ) : (
          <MarkdownEditor
            title={item.title}
            content={item.content}
            type={item.type as 'md' | 'txt'}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
