'use client';

import { use } from 'react';
import { AuthContext, type AuthContextValue } from '@/components/auth/auth-provider';

/**
 * 認証状態を取得するカスタムフック
 * AuthProvider 配下でのみ使用可能
 */
export function useAuth(): AuthContextValue {
  return use(AuthContext);
}
