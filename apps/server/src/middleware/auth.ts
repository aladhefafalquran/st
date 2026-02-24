import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../db.js'
import { env } from '../env.js'

export interface AuthRequest extends Request {
  userId?: string
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies.st_token
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; jti: string }
    const hash = crypto.createHash('sha256').update(payload.jti).digest('hex')

    const session = await prisma.session.findUnique({ where: { token: hash } })
    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Session expired' })
      return
    }

    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
