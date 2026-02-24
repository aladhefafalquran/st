import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.['st_token'];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; jti: string };
    const tokenHash = crypto.createHash('sha256').update(payload.jti).digest('hex');

    const session = await prisma.session.findUnique({
      where: { token: tokenHash },
    });

    if (!session || session.expiresAt < new Date()) {
      res.clearCookie('st_token');
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    req.userId = payload.sub;
    next();
  } catch {
    res.clearCookie('st_token');
    res.status(401).json({ error: 'Invalid token' });
  }
}
