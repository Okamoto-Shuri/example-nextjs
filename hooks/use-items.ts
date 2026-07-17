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
  writeBatch,
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
    folderId: (data.folderId as string | null) ?? null,
    order: (data.order as number) ?? 0,
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

  // ── 取得（updatedAt で全件取得 → クライアント側で order ソート） ───
  // ※ orderBy('order') はフィールド未存在のドキュメントを除外してしまうため、
  //    updatedAt で取得してクライアント側でソートする
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
      const fetched = snap.docs.map((d) => toItem(d.id, d.data()));
      // クライアント側ソート：order 昇順、同値なら updatedAt 降順
      fetched.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      setItems(fetched);
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
    async (input: ItemInput, folderId?: string | null): Promise<string | null> => {
      if (!itemsPath) return null;
      // 現在の最大 order の次の値を割り当てる
      const maxOrder = items.reduce((m, i) => Math.max(m, i.order), -1);
      try {
        const docRef = await addDoc(collection(db, itemsPath), {
          ...input,
          folderId: folderId ?? null,
          order: maxOrder + 1,
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
    [itemsPath, items, fetchItems]
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
                folderId: saved.item.folderId ?? null,
                order: saved.item.order,
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

  // ── 完了済み ToDo 一括削除 ─────────────────────────
  const deleteCompletedTodos = useCallback(
    async () => {
      if (!itemsPath) return;

      const completedTodos = items.filter(
        (item) => item.type === 'todo' && item.status === 'completed'
      );
      if (completedTodos.length === 0) return;

      // 楽観的に削除
      const completedIds = new Set(completedTodos.map((i) => i.id));
      setItems((prev) => prev.filter((i) => !completedIds.has(i.id)));

      const count = completedTodos.length;
      toast.success(`${count}件の完了済みToDoを削除しました`);

      // 実際の削除（並列実行）
      const results = await Promise.allSettled(
        completedTodos.map((item) =>
          deleteDoc(doc(db, itemsPath, item.id))
        )
      );

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        toast.error(`${failures.length}件の削除に失敗しました`);
        await fetchItems(); // ロールバック
      }
    },
    [itemsPath, items, fetchItems]
  );

  // ── フォルダー移動 ────────────────────────────────
  const moveItemToFolder = useCallback(
    async (itemId: string, folderId: string | null) => {
      if (!itemsPath) return;
      try {
        await updateDoc(doc(db, itemsPath, itemId), {
          folderId: folderId ?? null,
          updatedAt: serverTimestamp(),
        });
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, folderId: folderId ?? null, updatedAt: new Date() }
              : item
          ) as Item[]
        );
      } catch {
        toast.error('移動に失敗しました。再度お試しください。');
        await fetchItems();
      }
    },
    [itemsPath, fetchItems]
  );

  // ── 並び替え（DnD 後に呼ぶ） ─────────────────────
  // newItems: 新しい並び順のアイテム配列（ローカル state 更新済み前提）
  // この関数は楽観的更新後の Firestore 書き込み専用
  const reorderItems = useCallback(
    async (newItems: Item[]) => {
      if (!itemsPath) return;
      const prev = [...items];
      // ローカル state を即時更新
      setItems(newItems);

      // 変更があった order のみ batch 更新
      const batch = writeBatch(db);
      let changed = false;
      newItems.forEach((item, index) => {
        if (item.order !== index) {
          batch.update(doc(db, itemsPath, item.id), {
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
          setItems(prev); // ロールバック
          toast.error('並び替えの保存に失敗しました');
        }
      }
    },
    [itemsPath, items]
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
    deleteCompletedTodos,
    moveItemToFolder,
    reorderItems,
    setItems,
  };
}
