import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Prisma 6.x: PrismaNeon takes { connectionString } directly (not a Pool)
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })

export const prisma = new PrismaClient({ adapter })
