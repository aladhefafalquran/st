import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function signToken(userId: string) {
  const jti = crypto.randomUUID()
  const token = jwt.sign({ sub: userId, jti }, env.JWT_SECRET, { expiresIn: '7d' })
  const hash = crypto.createHash('sha256').update(jti).digest('hex')
  return { token, hash }
}

router.post('/register', async (req, res) => {
  const { email, username, password } = req.body
  if (!email || !username || !password) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  })
  if (existing) {
    res.status(409).json({ error: 'Email or username already taken' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { email, username, passwordHash },
  })

  const { token, hash } = signToken(user.id)
  await prisma.session.create({
    data: {
      userId: user.id,
      token: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  res.cookie('st_token', token, COOKIE_OPTS)
  res.json({ user: { id: user.id, email: user.email, username: user.username } })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const { token, hash } = signToken(user.id)
  await prisma.session.create({
    data: {
      userId: user.id,
      token: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  res.cookie('st_token', token, COOKIE_OPTS)
  res.json({ user: { id: user.id, email: user.email, username: user.username } })
})

router.post('/logout', requireAuth as any, async (req: AuthRequest, res) => {
  const token = req.cookies.st_token
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { jti: string }
      const hash = crypto.createHash('sha256').update(payload.jti).digest('hex')
      await prisma.session.deleteMany({ where: { token: hash } })
    } catch { /* ignore */ }
  }
  res.clearCookie('st_token')
  res.json({ ok: true })
})

router.get('/me', requireAuth as any, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, createdAt: true },
  })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ user })
})

router.get('/stats', requireAuth as any, async (req: AuthRequest, res) => {
  const [watchlistCount, historyCount] = await Promise.all([
    prisma.watchlist.count({ where: { userId: req.userId! } }),
    prisma.watchHistory.count({ where: { userId: req.userId! } }),
  ])
  res.json({ watchlistCount, historyCount })
})

router.post('/password', requireAuth as any, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(401).json({ error: 'Current password is incorrect' })
    return
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: req.userId! }, data: { passwordHash } })
  res.json({ ok: true })
})

export default router
