import { Router } from 'express'
import axios from 'axios'
import { env } from '../env.js'

const router: Router = Router()

const tmdb = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  headers: { Authorization: `Bearer ${env.TMDB_API_KEY}` },
})

async function proxyGet(path: string, params?: Record<string, string>) {
  const res = await tmdb.get(path, { params })
  return res.data
}

router.get('/trending', async (_req, res) => {
  const data = await proxyGet('/trending/all/week')
  res.json(data)
})

router.get('/movies/popular', async (_req, res) => {
  const data = await proxyGet('/movie/popular')
  res.json(data)
})

router.get('/movies/top-rated', async (_req, res) => {
  const data = await proxyGet('/movie/top_rated')
  res.json(data)
})

router.get('/tv/popular', async (_req, res) => {
  const data = await proxyGet('/tv/popular')
  res.json(data)
})

router.get('/movies/:id', async (req, res) => {
  const data = await proxyGet(`/movie/${req.params.id}`, {
    append_to_response: 'videos,credits,external_ids',
  })
  res.json(data)
})

router.get('/tv/:id', async (req, res) => {
  const data = await proxyGet(`/tv/${req.params.id}`, {
    append_to_response: 'external_ids,seasons',
  })
  res.json(data)
})

router.get('/tv/:id/season/:season', async (req, res) => {
  const data = await proxyGet(`/tv/${req.params.id}/season/${req.params.season}`)
  res.json(data)
})

router.get('/movies/:id/similar', async (req, res) => {
  const data = await proxyGet(`/movie/${req.params.id}/recommendations`)
  res.json(data)
})

router.get('/tv/:id/similar', async (req, res) => {
  const data = await proxyGet(`/tv/${req.params.id}/recommendations`)
  res.json(data)
})

router.get('/discover', async (req, res) => {
  const { type, genreId, page = '1' } = req.query as Record<string, string>
  const endpoint = type === 'tv' ? '/discover/tv' : '/discover/movie'
  const data = await proxyGet(endpoint, {
    with_genres: genreId,
    page,
    sort_by: 'popularity.desc',
  })
  res.json(data)
})

router.get('/search', async (req, res) => {
  const q = req.query.q as string
  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' })
    return
  }
  const data = await proxyGet('/search/multi', { query: q })
  res.json(data)
})

export default router
