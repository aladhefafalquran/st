export interface TMDBMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  genres?: { id: number; name: string }[]
  runtime?: number
  tagline?: string
  status?: string
  external_ids?: { imdb_id?: string }
  videos?: { results: TMDBVideo[] }
  credits?: { cast: TMDBCast[]; crew: TMDBCrew[] }
}

export interface TMDBTVShow {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  genres?: { id: number; name: string }[]
  number_of_seasons?: number
  seasons?: TMDBSeason[]
  tagline?: string
  status?: string
  external_ids?: { imdb_id?: string }
}

export interface TMDBSeason {
  id: number
  season_number: number
  name: string
  episode_count: number
  poster_path: string | null
  air_date: string
  episodes?: TMDBEpisode[]
}

export interface TMDBEpisode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  air_date: string
  still_path: string | null
  vote_average: number
  runtime?: number
}

export interface TMDBVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

export interface TMDBCast {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TMDBCrew {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDBSearchResult {
  id: number
  media_type: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average: number
  overview: string
}

export interface TMDBPaginatedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}
