'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Item, ItemInput } from '@/types';

// ================================================================
// フィルタ型
// ================================================================

export type ViewFilter = 'all' | 'todo' | 'doc';

// ================================================================
// Firestore → Item 変換
// ================================================================

function toItem(id: string, data: Record<string, unknown>): Item {
  const base = {
    id,
    type: data.type as string,
    title: data.title as string,
    content: (data.content as string) ?? '',
    status: data.status as string,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  };
  return base as Item;
}

// ================================================================
// Hook
// ================================================================

export function useItems(workspaceId: string | null) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>('all');

  // Undo 用に最後に削除したアイテムを保持
  const deletedItemRef = useRef<{ item: Item; wsId: string } | null>(null);

  // ── コレクションパス ──────────────────────────────
  const itemsPath = uid && workspaceId
    ? `users/${uid}/workspaces/${workspaceId}/items`
    : null;

  // ── 取得 ─────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    if (!itemsPath) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, itemsPath),
        orderBy('updatedAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => toItem(d.id, d.data())));
    } catch (err) {
      console.error('Failed to fetch items:', err);
      toast.error('アイテムの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [itemsPath]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ── フィルタリング ───────────────────────────────
  const filteredItems = items.filter((item) => {
    if (filter === 'todo') return item.type === 'todo';
    if (filter === 'doc') return item.type !== 'todo';
    return true;
  });

  // ── 作成 ─────────────────────────────────────────
  const createItem = useCallback(
    async (input: ItemInput): Promise<string | null> => {
      if (!itemsPath) return null;
      try {
        const docRef = await addDoc(collection(db, itemsPath), {
          ...input,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await fetchItems();
        return docRef.id;
      } catch {
        toast.error('アイテムの作成に失敗しました。再度お試しください。');
        return null;
      }
    },
    [itemsPath, fetchItems]
  );

  // ── 更新 ─────────────────────────────────────────
  const updateItem = useCallback(
    async (itemId: string, data: Partial<ItemInput>) => {
      if (!itemsPath) return;
      try {
        await updateDoc(doc(db, itemsPath, itemId), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        // ローカル state の楽観的更新
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, ...data, updatedAt: new Date() }
              : item
          ) as Item[]
        );
      } catch {
        toast.error('操作に失敗しました。再度お試しください。');
        await fetchItems(); // ロールバック
      }
    },
    [itemsPath, fetchItems]
  );

  // ── ステータス切替（楽観的 UI） ─────────────────
  const toggleStatus = useCallback(
    async (item: Item) => {
      const newStatus =
        item.type === 'todo'
          ? item.status === 'pending'
            ? 'completed'
            : 'pending'
          : item.status === 'in_progress'
            ? 'completed'
            : 'in_progress';
      await updateItem(item.id, { status: newStatus } as Partial<ItemInput>);
    },
    [updateItem]
  );

  // ── 削除（Undo Toast 3秒） ──────────────────────
  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!itemsPath) return;

      const targetItem = items.find((i) => i.id === itemId);
      if (!targetItem || !workspaceId) return;

      // 楽観的に削除
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      deletedItemRef.current = { item: targetItem, wsId: workspaceId };

      // Undo Toast
      toast('アイテムを削除しました', {
        action: {
          label: '元に戻す',
          onClick: async () => {
            const saved = deletedItemRef.current;
            if (!saved || !uid) return;
            try {
              const restorePath = `users/${uid}/workspaces/${saved.wsId}/items`;
              await addDoc(collection(db, restorePath), {
                type: saved.item.type,
                title: saved.item.title,
                content: saved.item.content,
                status: saved.item.status,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              await fetchItems();
              toast.success('アイテムを復元しました');
            } catch {
              toast.error('復元に失敗しました');
            }
            deletedItemRef.current = null;
          },
        },
        duration: 3000,
      });

      // 実際の削除
      try {
        await deleteDoc(doc(db, itemsPath, itemId));
      } catch {
        // 削除に失敗した場合はロールバック
        if (targetItem) {
          setItems((prev) => [...prev, targetItem]);
        }
        toast.error('削除に失敗しました。再度お試しください。');
      }
    },
    [itemsPath, items, workspaceId, uid, fetchItems]
  );

  return {
    items: filteredItems,
    allItems: items,
    loading,
    filter,
    setFilter,
    fetchItems,
    createItem,
    updateItem,
    toggleStatus,
    deleteItem,
  };
}
