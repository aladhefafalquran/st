import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { env } from './env.js'
import authRouter from './routes/auth.js'
import tmdbRouter from './routes/tmdb.js'
import subtitlesRouter from './routes/subtitles.js'
import watchlistRouter from './routes/watchlist.js'
import historyRouter from './routes/history.js'

const app = express()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}))

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}))

app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/tmdb', tmdbRouter)
app.use('/api/subtitles', subtitlesRouter)
app.use('/api/watchlist', watchlistRouter)
app.use('/api/history', historyRouter)

app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`)
})
