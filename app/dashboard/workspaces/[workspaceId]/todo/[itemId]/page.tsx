'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function TodoEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const workspaceId = params.workspaceId as string;
  const itemId = params.itemId as string;
  const uid = user?.uid;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          setTitle(data.title);
          setContent(data.content ?? '');
          setStatus(data.status as 'pending' | 'completed');
        } else {
          toast.error('ToDoが見つかりませんでした');
          router.push(`/dashboard/workspaces/${workspaceId}`);
        }
      } catch {
        toast.error('読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [uid, workspaceId, itemId, router]);

  // ── 保存 ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await updateDoc(
        doc(db, `users/${uid}/workspaces/${workspaceId}/items/${itemId}`),
        {
          title,
          content,
          status,
          updatedAt: serverTimestamp(),
        }
      );
      toast.success('保存しました');
    } catch {
      toast.error('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [uid, workspaceId, itemId, title, content, status]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link href={`/dashboard/workspaces/${workspaceId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            ToDo
          </Badge>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* フォーム */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="todo-edit-title">タイトル</Label>
            <Input
              id="todo-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              className="text-lg font-medium"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="todo-edit-content">本文（任意）</Label>
            <textarea
              id="todo-edit-content"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[200px] resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              placeholder="タスクの詳細を入力..."
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/1000
            </p>
          </div>

          <div className="space-y-2">
            <Label>ステータス</Label>
            <div className="flex gap-2">
              <Button
                variant={status === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatus('pending')}
              >
                未完了
              </Button>
              <Button
                variant={status === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatus('completed')}
              >
                完了
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
