import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string(),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string(),
  TMDB_API_KEY: z.string(),
  OPENSUBTITLES_API_KEY: z.string(),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  STREMIO_ADDONS: z.string().default('https://torrentio.strem.fun'),
})

export const env = envSchema.parse(process.env)
