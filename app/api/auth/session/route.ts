import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const SESSION_EXPIRY_MS = 60 * 60 * 24 * 5 * 1000; // 5日

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();
  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });
    const res = NextResponse.json({ status: 'ok' });
    res.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   SESSION_EXPIRY_MS / 1000,
      path:     '/',
    });
    return res;
  } catch (err) {
    console.error('Session cookie creation failed:', err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

