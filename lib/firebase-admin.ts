import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK の初期化を遅延実行する。
 * ビルド時（next build）には環境変数が存在しない場合があるため、
 * トップレベルで initializeApp() を呼ぶとクラッシュする。
 * getAdminApp() を呼んだ時点で初めて初期化を行う。
 */
function getAdminApp(): App {
  if (getApps().length) {
    return getApps()[0];
  }

  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKeyRaw) {
    throw new Error(
      'FIREBASE_ADMIN_PRIVATE_KEY is not set. ' +
      'Make sure the environment variable is configured in Vercel.',
    );
  }

  // Vercel ダッシュボードや .env ファイルで \\n がリテラル文字列として
  // 保存されている場合、実際の改行文字に変換する
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey,
    }),
  });
}

/** 遅延初期化される Auth インスタンス */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

// 後方互換性のため、getter でラップしたエクスポートも用意
// ※ ただし、ビルド時には参照しないこと
let _adminAuth: Auth | null = null;
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    if (!_adminAuth) {
      _adminAuth = getAdminAuth();
    }
    const value = Reflect.get(_adminAuth, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(_adminAuth);
    }
    return value;
  },
});
