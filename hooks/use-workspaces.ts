'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Workspace } from '@/types';

// ================================================================
// Firestore → Workspace 変換
// ================================================================

function toWorkspace(id: string, data: Record<string, unknown>): Workspace {
  return {
    id,
    name: data.name as string,
    order: data.order as number,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  };
}

// ================================================================
// Hook
// ================================================================

export function useWorkspaces() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  // ── 取得 ─────────────────────────────────────────
  const fetchWorkspaces = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, `users/${uid}/workspaces`),
        orderBy('order')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => toWorkspace(d.id, d.data()));
      setWorkspaces(list);
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
      toast.error('ワークスペースの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // ── 作成 ─────────────────────────────────────────
  const createWorkspace = useCallback(
    async (name: string): Promise<string | null> => {
      if (!uid) return null;
      if (workspaces.length >= 10) {
        toast.error('ワークスペースは最大10件まで作成できます');
        return null;
      }
      const maxOrder = workspaces.reduce((m, w) => Math.max(m, w.order), -1);
      const wsRef = doc(collection(db, `users/${uid}/workspaces`));
      try {
        await setDoc(wsRef, {
          name,
          order: maxOrder + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await fetchWorkspaces();
        return wsRef.id;
      } catch {
        toast.error('ワークスペースの作成に失敗しました。再度お試しください。');
        return null;
      }
    },
    [uid, workspaces, fetchWorkspaces]
  );

  // ── 名前変更 ─────────────────────────────────────
  const renameWorkspace = useCallback(
    async (wsId: string, newName: string) => {
      if (!uid) return;
      // 楽観的 UI 更新
      const prev = [...workspaces];
      setWorkspaces((ws) =>
        ws.map((w) => (w.id === wsId ? { ...w, name: newName } : w))
      );
      try {
        await updateDoc(doc(db, `users/${uid}/workspaces/${wsId}`), {
          name: newName,
          updatedAt: serverTimestamp(),
        });
      } catch {
        setWorkspaces(prev); // ロールバック
        toast.error('操作に失敗しました。再度お試しください。');
      }
    },
    [uid, workspaces]
  );

  // ── 削除 ─────────────────────────────────────────
  const deleteWorkspace = useCallback(
    async (wsId: string): Promise<string | null> => {
      if (!uid) return null;
      if (workspaces.length === 1) {
        toast.error('最後のワークスペースは削除できません');
        return null;
      }

      try {
        // 1. items サブコレクションを全件削除
        const itemsSnap = await getDocs(
          collection(db, `users/${uid}/workspaces/${wsId}/items`)
        );
        const refs = itemsSnap.docs.map((d) => d.ref);

        for (let i = 0; i < refs.length; i += 499) {
          const batch = writeBatch(db);
          refs.slice(i, i + 499).forEach((ref) => batch.delete(ref));
          await batch.commit();
        }

        // 2. ワークスペース本体を削除
        await deleteDoc(doc(db, `users/${uid}/workspaces/${wsId}`));

        // 3. 残存するワークスペースの order=0 のものへ遷移
        const remaining = workspaces.filter((w) => w.id !== wsId);
        const next = remaining.sort((a, b) => a.order - b.order)[0];
        setWorkspaces(remaining);

        return next?.id ?? null;
      } catch {
        toast.error('操作に失敗しました。再度お試しください。');
        return null;
      }
    },
    [uid, workspaces]
  );

  // ── 並び替え ─────────────────────────────────────
  const reorderWorkspaces = useCallback(
    async (newOrder: Workspace[]) => {
      if (!uid) return;
      // 楽観的 UI 更新
      const prev = [...workspaces];
      setWorkspaces(newOrder);

      const batch = writeBatch(db);
      let changed = false;
      newOrder.forEach((ws, index) => {
        if (ws.order !== index) {
          batch.update(doc(db, `users/${uid}/workspaces/${ws.id}`), {
            order: index,
            updatedAt: serverTimestamp(),
          });
          changed = true;
        }
      });

      if (changed) {
        try {
          await batch.commit();
        } catch {
          setWorkspaces(prev); // ロールバック
          toast.error('並び替えの保存に失敗しました');
        }
      }
    },
    [uid, workspaces]
  );

  // ── アイテム数取得（削除確認用） ───────────────────
  const getItemCount = useCallback(
    async (wsId: string): Promise<number> => {
      if (!uid) return 0;
      try {
        const snap = await getDocs(
          collection(db, `users/${uid}/workspaces/${wsId}/items`)
        );
        return snap.size;
      } catch {
        return 0;
      }
    },
    [uid]
  );

  return {
    workspaces,
    loading,
    fetchWorkspaces,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    reorderWorkspaces,
    getItemCount,
  };
}
