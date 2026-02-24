import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  TMDB_API_KEY: z.string().min(1), // accepts both short API key and Bearer Read Access Token
  OPENSUBTITLES_API_KEY: z.string().min(1),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  // Comma-separated Stremio addon base URLs. Add Arabic or other addon URLs here.
  STREMIO_ADDONS: z.string().default('https://torrentio.strem.fun'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
