

// app/api/auth/me/route.ts (NextAuth-backed)
import { authOptions } from "@acme/core/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user: session.user });
}


// // File: src/app/api/auth/me/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { PrismaClient } from '@prisma/client';
// import jwt from 'jsonwebtoken';

// const prisma = new PrismaClient();
// // Ensure JWT_SECRET is defined and narrowed to string
// const secret = process.env.JWT_SECRET;
// if (!secret) {
//   throw new Error('JWT_SECRET environment variable is not defined');
// }

// /**
//  * GET /api/auth/me
//  * Returns the authenticated user's profile
//  */
// export async function GET(request: NextRequest) {
//   try {
//     const authHeader = request.headers.get('Authorization');
//     if (!authHeader?.startsWith('Bearer ')) {
//       return NextResponse.json({ error: 'Authorization token missing' }, { status: 401 });
//     }

//     const token = authHeader.replace('Bearer ', '');
  
//     let payload: unknown;
//     try {
//       payload = jwt.verify(token, secret || 'my secret');
  
//     } catch (err) {
//       console.log(err);
//       return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
//     }

//     // Validate payload structure
//     if (typeof payload !== 'object' || payload === null || !('userId' in payload)) {
//       return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
//     }

//     const { userId } = payload as { userId: string };
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
//     });

//     if (!user) {
//       return NextResponse.json({ error: 'User not found' }, { status: 404 });
//     }

//     return NextResponse.json({ user });
//   } catch (error) {
//     console.error('Auth Me Error:', error);
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }
