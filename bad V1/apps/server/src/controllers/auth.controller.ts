import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth';

const COOKIE_NAME = 'st_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function setCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
}

export async function register(req: Request, res: Response) {
  const { email, username, password } = req.body as {
    email: string;
    username: string;
    password: string;
  };

  if (!email || !username || !password) {
    res.status(400).json({ error: 'email, username and password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    res.status(409).json({ error: 'Email or username already taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, username, passwordHash },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  const token = await createSession(user.id, req);
  res.cookie(COOKIE_NAME, token, setCookieOptions());
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, passwordHash: true, createdAt: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = await createSession(user.id, req);
  res.cookie(COOKIE_NAME, token, setCookieOptions());

  const { passwordHash: _ph, ...safeUser } = user;
  res.json({ user: safeUser });
}

export async function logout(req: AuthRequest, res: Response) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { jti: string };
      const tokenHash = crypto.createHash('sha256').update(payload.jti).digest('hex');
      await prisma.session.deleteMany({ where: { token: tokenHash } });
    } catch {
      // ignore invalid token on logout
    }
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
}

async function createSession(userId: string, req: Request): Promise<string> {
  const jti = uuidv4();
  const tokenHash = crypto.createHash('sha256').update(jti).digest('hex');

  await prisma.session.create({
    data: {
      userId,
      token: tokenHash,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + COOKIE_MAX_AGE),
    },
  });

  return jwt.sign({ sub: userId, jti }, env.JWT_SECRET, { expiresIn: '7d' });
}
