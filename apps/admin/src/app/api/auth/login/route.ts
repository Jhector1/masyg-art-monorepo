// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';

const prisma     = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('Missing JWT_SECRET');

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  // 1) Validate
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // 2) Lookup & verify
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.password) {
    return NextResponse.json(
      { error: "This account doesn't have a password set. Use the 'Set Password' flow first." },
      { status: 400 }
    );
  }

  if (!user || !await bcrypt.compare(password, user.password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // 3) Sign JWT
  const token = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 4) Return token as HTTP-only cookie
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  return res;
}
