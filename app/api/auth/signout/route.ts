import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ status: 'ok' });
  res.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return res;
}
