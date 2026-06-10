'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // initializeUserIfNeeded は AuthProvider の onAuthStateChanged で自動実行される
      router.push('/dashboard');
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に使用されています。');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('有効なメールアドレスを入力してください。');
      } else if (firebaseError.code === 'auth/weak-password') {
        setError('パスワードは6文字以上で入力してください。');
      } else {
        setError('登録に失敗しました。再度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-emerald-500/25">
            <Image
              src="/novabase-logo.png"
              alt="NovaBase"
              width={48}
              height={48}
              className="h-11 w-11 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            NovaBase アカウント作成
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            無料で NovaBase をはじめましょう
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email" className="text-zinc-300">
                メールアドレス
              </Label>
              <Input
                id="register-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password" className="text-zinc-300">
                パスワード
              </Label>
              <Input
                id="register-password"
                type="password"
                placeholder="6文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-zinc-300">
                パスワード確認
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="もう一度入力"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              id="register-button"
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all duration-200 shadow-lg shadow-emerald-600/25"
              disabled={loading}
            >
              {loading ? '登録中...' : 'アカウントを作成'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-500">
          既にアカウントをお持ちの方は{' '}
          <Link
            href="/login"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            ログインはこちら
          </Link>
        </p>
      </div>
    </div>
  );
}
