import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
console.log('[db] DATABASE_URL:', url ? 'SET (' + url.slice(0, 30) + '...)' : 'NOT SET')

const pool = new Pool({ connectionString: url })
const adapter = new PrismaNeon(pool)
console.log('[db] adapter:', adapter?.constructor?.name ?? 'undefined')

export const prisma = new PrismaClient({ adapter })
console.log('[db] PrismaClient created')
