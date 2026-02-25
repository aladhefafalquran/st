import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'

// Use built-in WebSocket in Node 22+ (tablet has Node 25)
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: ws } = await import('ws')
  neonConfig.webSocketConstructor = ws
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaNeon(pool)

export const prisma = new PrismaClient({ adapter })
