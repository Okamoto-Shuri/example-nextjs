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
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Folder } from '@/types';

// ================================================================
// Firestore → Folder 変換
// ================================================================

function toFolder(id: string, data: Record<string, unknown>): Folder {
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

export function useFolders(workspaceId: string | null) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  // ── コレクションパス ──────────────────────────────
  const foldersPath = uid && workspaceId
    ? `users/${uid}/workspaces/${workspaceId}/folders`
    : null;

  const itemsPath = uid && workspaceId
    ? `users/${uid}/workspaces/${workspaceId}/items`
    : null;

  // ── 取得 ─────────────────────────────────────────
  const fetchFolders = useCallback(async () => {
    if (!foldersPath) {
      setFolders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, foldersPath), orderBy('order'));
      const snap = await getDocs(q);
      setFolders(snap.docs.map((d) => toFolder(d.id, d.data())));
    } catch (err) {
      console.error('Failed to fetch folders:', err);
      toast.error('フォルダーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [foldersPath]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // ── 作成 ─────────────────────────────────────────
  const createFolder = useCallback(
    async (name: string): Promise<string | null> => {
      if (!foldersPath) return null;
      if (folders.length >= 20) {
        toast.error('フォルダーは最大20件まで作成できます');
        return null;
      }
      const maxOrder = folders.reduce((m, f) => Math.max(m, f.order), -1);
      const folderRef = doc(collection(db, foldersPath));
      try {
        await setDoc(folderRef, {
          name,
          order: maxOrder + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await fetchFolders();
        return folderRef.id;
      } catch {
        toast.error('フォルダーの作成に失敗しました。再度お試しください。');
        return null;
      }
    },
    [foldersPath, folders, fetchFolders]
  );

  // ── 名前変更 ─────────────────────────────────────
  const renameFolder = useCallback(
    async (folderId: string, newName: string) => {
      if (!foldersPath) return;
      const prev = [...folders];
      setFolders((fs) =>
        fs.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
      );
      try {
        await updateDoc(doc(db, foldersPath, folderId), {
          name: newName,
          updatedAt: serverTimestamp(),
        });
      } catch {
        setFolders(prev);
        toast.error('操作に失敗しました。再度お試しください。');
      }
    },
    [foldersPath, folders]
  );

  // ── 削除（フォルダー内アイテムはルートに移動） ──
  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!foldersPath || !itemsPath) return;
      try {
        // 1. このフォルダーに属するアイテムの folderId を null にリセット
        const itemsSnap = await getDocs(
          query(collection(db, itemsPath), where('folderId', '==', folderId))
        );

        if (itemsSnap.size > 0) {
          for (let i = 0; i < itemsSnap.docs.length; i += 499) {
            const batch = writeBatch(db);
            itemsSnap.docs.slice(i, i + 499).forEach((d) => {
              batch.update(d.ref, {
                folderId: null,
                updatedAt: serverTimestamp(),
              });
            });
            await batch.commit();
          }
        }

        // 2. フォルダー本体を削除
        await deleteDoc(doc(db, foldersPath, folderId));

        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        toast.success('フォルダーを削除しました。アイテムはルートに移動されました。');
      } catch {
        toast.error('削除に失敗しました。再度お試しください。');
      }
    },
    [foldersPath, itemsPath]
  );

  // ── アイテム数取得（削除確認用） ─────────────────
  const getFolderItemCount = useCallback(
    async (folderId: string): Promise<number> => {
      if (!itemsPath) return 0;
      try {
        const snap = await getDocs(
          query(collection(db, itemsPath), where('folderId', '==', folderId))
        );
        return snap.size;
      } catch {
        return 0;
      }
    },
    [itemsPath]
  );

  return {
    folders,
    loading,
    fetchFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    getFolderItemCount,
  };
}
