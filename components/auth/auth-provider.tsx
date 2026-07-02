'use client';

import {
  createContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  writeBatch,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// ================================================================
// Context 型
// ================================================================

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

// ================================================================
// 初回ログイン時の Firestore 初期化
// ================================================================

async function initializeUserIfNeeded(uid: string, email: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return; // 2回目以降はスキップ

  const batch = writeBatch(db);
  // ユーザーレコード
  batch.set(userRef, { email, createdAt: serverTimestamp() });
  // デフォルトワークスペース
  const wsRef = doc(collection(db, `users/${uid}/workspaces`));
  batch.set(wsRef, {
    name: 'マイワークスペース',
    order: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

// ================================================================
// セッション Cookie の発行
// ================================================================

async function createSessionCookie(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

// ================================================================
// AuthProvider
// ================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await initializeUserIfNeeded(
            firebaseUser.uid,
            firebaseUser.email ?? ''
          );
          await createSessionCookie(firebaseUser);
          setUser(firebaseUser);
        } catch (err) {
          console.error('Auth initialization error:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    await fetch('/api/auth/signout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, loading, signOut }}>
      {children}
    </AuthContext>
  );
}
