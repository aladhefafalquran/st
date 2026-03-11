const TMDB_API_KEY = '36aa3c2fbff074f35b3a9063752ce321';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const VIDSRC_BASE_URL = 'https://vidsrc.xyz/embed'; 

// State
let currentItem = null;
let currentImdbId = null;
let activeCategory = 'movie'; 
let currentPage = 1;
let currentGenreId = null;
let currentLang = null;
let currentQuery = '';
let currentView = 'home'; 
let currentSeason = 1;
let currentEpisode = 1;

// UI Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const homeSections = document.getElementById('homeSections');
const genreSection = document.getElementById('genreSection');
const genreList = document.getElementById('genreList');
const trendingMovies = document.getElementById('trendingMovies');
const trendingTV = document.getElementById('trendingTV');
const searchResults = document.getElementById('searchResults');
const moviesGrid = document.getElementById('moviesGrid');
const backToHome = document.getElementById('backToHome');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const scrollTopBtn = document.getElementById('scrollTopBtn');

const navHome = document.getElementById('navHome');
const navMovies = document.getElementById('navMovies');
const navTV = document.getElementById('navTV');
const navTags = document.getElementById('navTags');

const detailsModal = document.getElementById('detailsModal');
const closeDetails = document.getElementById('closeDetails');
const detailsPoster = document.getElementById('detailsPoster');
const detailsTitle = document.getElementById('detailsTitle');
const detailsOverview = document.getElementById('detailsOverview');
const detailsMeta = document.getElementById('detailsMeta');
const tvSelector = document.getElementById('tvSelector');
const movieActions = document.getElementById('movieActions');
const seasonSelect = document.getElementById('seasonSelect');
const episodesGrid = document.getElementById('episodesGrid');
const playMovieBtn = document.getElementById('playMovieBtn');
const detailsRecommendations = document.getElementById('detailsRecommendations');
const detailsRecommendationsGrid = document.getElementById('detailsRecommendationsGrid');

const playerContainer = document.getElementById('playerContainer');
const videoFrame = document.getElementById('videoFrame');
const closePlayerBtn = document.getElementById('closePlayerBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const playerEpisodeSelector = document.getElementById('playerEpisodeSelector');
const playerSeasonSelect = document.getElementById('playerSeasonSelect');
const playerEpisodesGrid = document.getElementById('playerEpisodesGrid');
const playerRecommendations = document.getElementById('playerRecommendations');
const recommendationsGrid = document.getElementById('recommendationsGrid');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  fetchTrending();
  setupEventListeners();
  
  window.electronAPI.onExitCinemaMode(() => {
    document.body.classList.remove('cinema-mode');
    fullscreenBtn.innerText = 'ملء الشاشة';
  });
  
  window.electronAPI.onEnterCinemaMode(() => {
    if (!playerContainer.classList.contains('hidden')) {
      document.body.classList.add('cinema-mode');
      fullscreenBtn.innerText = 'خروج';
    }
  });
});

function setupEventListeners() {
  searchBtn.addEventListener('click', () => {
    currentQuery = searchInput.value;
    searchMovies(currentQuery, 1, false);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      currentQuery = searchInput.value;
      searchMovies(currentQuery, 1, false);
    }
  });

  navHome.addEventListener('click', (e) => { e.preventDefault(); setActiveNav(navHome); showHome(); });
  navMovies.addEventListener('click', (e) => { e.preventDefault(); activeCategory = 'movie'; setActiveNav(navMovies); showFiltered('movie', 1, false); });
  navTV.addEventListener('click', (e) => { e.preventDefault(); activeCategory = 'tv'; setActiveNav(navTV); showFiltered('tv', 1, false); });
  navTags.addEventListener('click', (e) => { e.preventDefault(); setActiveNav(navTags); showTags(); });

  backToHome.addEventListener('click', showHome);
  closeDetails.addEventListener('click', () => { 
    detailsModal.classList.add('hidden'); 
    detailsRecommendations.classList.add('hidden'); 
  });
  closePlayerBtn.addEventListener('click', stopPlayback);
  fullscreenBtn.addEventListener('click', toggleFullscreen);

  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    if (currentView === 'search') searchMovies(currentQuery, currentPage, true);
    else if (currentView === 'filter') showFiltered(activeCategory, currentPage, true);
    else if (currentView === 'genre') filterByGenre(currentGenreId, currentPage, true);
    else if (currentView === 'lang') filterByLang(currentLang, currentPage, true);
  });

  scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) scrollTopBtn.classList.add('show');
    else scrollTopBtn.classList.remove('show');
  });

  seasonSelect.addEventListener('change', (e) => {
    currentSeason = e.target.value;
    loadEpisodes(currentItem.id, currentSeason, episodesGrid);
  });

  playerSeasonSelect.addEventListener('change', (e) => {
    currentSeason = e.target.value;
    loadEpisodes(currentItem.id, currentSeason, playerEpisodesGrid);
  });

  playMovieBtn.addEventListener('click', () => {
    const type = (currentItem.media_type === 'tv' || !currentItem.original_title) ? 'tv' : 'movie';
    playSource(type, currentImdbId);
  });
}

// --- Core Functions ---

async function fetchTrending() {
  try {
    const movieRes = await fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`);
    const movieData = await movieRes.json();
    displayItems(movieData.results, trendingMovies, false);

    const tvRes = await fetch(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`);
    const tvData = await tvRes.json();
    displayItems(tvData.results, trendingTV, false);
  } catch (e) { console.error(e); }
}

async function searchMovies(query, page = 1, append = false) {
  if (!query) return;
  currentView = 'search';
  currentPage = page;
  try {
    const res = await fetch(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`);
    const data = await res.json();
    homeSections.classList.add('hidden');
    searchResults.classList.remove('hidden');
    document.querySelector('#searchResults h2').innerText = 'نتائج البحث';
    displayItems(data.results, moviesGrid, append);
    if (data.total_pages > page) loadMoreBtn.classList.remove('hidden');
    else loadMoreBtn.classList.add('hidden');
  } catch (e) { console.error(e); }
}

function displayItems(items, container, append = false) {
  if (!append) container.innerHTML = '';
  
  if (container === recommendationsGrid || container === detailsRecommendationsGrid) {
    container.classList.add('movies-grid-horizontal');
    container.classList.remove('movies-grid');
  } else {
    container.classList.add('movies-grid');
    container.classList.remove('movies-grid-horizontal');
  }

  items.forEach(item => {
    if (!item.poster_path) return;
    const card = document.createElement('div');
    card.className = 'movie-card';
    const title = item.original_title || item.original_name || item.title || item.name;
    card.innerHTML = `<img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${title}"><h3>${title}</h3>`;
    card.addEventListener('click', () => {
      if (!playerContainer.classList.contains('hidden')) stopPlayback();
      showDetails(item);
    });
    container.appendChild(card);
  });
}

async function showDetails(item) {
  currentItem = item;
  const type = (item.media_type === 'tv' || !item.original_title) ? 'tv' : 'movie';
  detailsModal.classList.remove('hidden');
  detailsPoster.src = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
  detailsTitle.innerText = item.original_title || item.original_name || item.title || item.name;
  detailsOverview.innerText = item.overview || 'لا يوجد وصف متاح.';
  detailsMeta.innerHTML = `<span>⭐ ${item.vote_average}</span>`;
  
  tvSelector.classList.add('hidden');
  movieActions.classList.add('hidden');

  try {
    const extRes = await fetch(`${TMDB_BASE_URL}/${type}/${item.id}/external_ids?api_key=${TMDB_API_KEY}`);
    const extData = await extRes.json();
    currentImdbId = extData.imdb_id;

    if (type === 'tv') {
      tvSelector.classList.remove('hidden');
      loadSeasons(item.id, seasonSelect, episodesGrid);
    } else {
      movieActions.classList.remove('hidden');
    }
    fetchRecommendations(type, item.id, detailsRecommendations, detailsRecommendationsGrid);
  } catch (e) { console.error(e); }
}

async function loadSeasons(tvId, selectEl, gridEl) {
  const res = await fetch(`${TMDB_BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}`);
  const data = await res.json();
  const options = data.seasons.filter(s => s.season_number > 0).map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('');
  
  seasonSelect.innerHTML = options;
  playerSeasonSelect.innerHTML = options;

  if (data.seasons.length > 0) {
    currentSeason = 1;
    selectEl.value = 1;
    loadEpisodes(tvId, 1, gridEl);
  }
}

async function loadEpisodes(tvId, seasonNum, gridEl) {
  const res = await fetch(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNum}?api_key=${TMDB_API_KEY}`);
  const data = await res.json();
  
  gridEl.innerHTML = '';
  data.episodes.forEach(ep => {
    const isActive = (currentSeason == seasonNum && currentEpisode == ep.episode_number && !playerContainer.classList.contains('hidden'));
    const thumb = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : 'https://via.placeholder.com/300x170?text=No+Preview';
    
    const card = document.createElement('div');
    card.className = `episode-card ${isActive ? 'active' : ''}`;
    card.innerHTML = `
      <img class="episode-thumbnail" src="${thumb}">
      ${isActive ? '<span class="now-watching-badge">تشاهده الآن</span>' : ''}
      <div class="episode-info">
        <span class="episode-number">Ep ${ep.episode_number}</span>
        <span class="episode-name">${ep.name}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      playSource('tv', currentImdbId, seasonNum, ep.episode_number, `${detailsTitle.innerText} - S${seasonNum}E${ep.episode_number}`);
    });
    gridEl.appendChild(card);
  });
}

async function playSource(type, imdbId, season = 1, episode = 1, title = '') {
  currentSeason = season;
  currentEpisode = episode;
  detailsModal.classList.add('hidden');
  homeSections.classList.add('hidden');
  searchResults.classList.add('hidden');
  playerContainer.classList.remove('hidden');
  nowPlayingTitle.innerText = title || detailsTitle.innerText;

  let embedUrl = `${VIDSRC_BASE_URL}/${type}?imdb=${imdbId}`;
  if (type === 'tv') embedUrl += `&s=${season}&e=${episode}`;
  videoFrame.src = embedUrl;

  if (type === 'tv') {
    playerEpisodeSelector.classList.remove('hidden');
    loadEpisodes(currentItem.id, season, playerEpisodesGrid);
    playerSeasonSelect.value = season;
  } else playerEpisodeSelector.classList.add('hidden');

  const itemType = (currentItem.media_type === 'tv' || !currentItem.original_title) ? 'tv' : 'movie';
  fetchRecommendations(itemType, currentItem.id, playerRecommendations, recommendationsGrid);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function fetchRecommendations(type, id, containerEl, gridEl) {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      containerEl.classList.remove('hidden');
      displayItems(data.results, gridEl, false);
    } else containerEl.classList.add('hidden');
  } catch (e) { console.error(e); }
}

function showHome() {
  currentView = 'home';
  homeSections.classList.remove('hidden');
  genreSection.classList.add('hidden');
  searchResults.classList.add('hidden');
  playerContainer.classList.add('hidden');
  loadMoreBtn.classList.add('hidden');
  fetchTrending();
}

async function showFiltered(type, page = 1, append = false) {
  currentView = 'filter'; currentPage = page;
  try {
    const res = await fetch(`${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&page=${page}`);
    const data = await res.json();
    homeSections.classList.add('hidden'); searchResults.classList.remove('hidden');
    document.querySelector('#searchResults h2').innerText = type === 'movie' ? 'أفلام' : 'مسلسلات';
    displayItems(data.results, moviesGrid, append);
    if (data.total_pages > page) loadMoreBtn.classList.remove('hidden');
    else loadMoreBtn.classList.add('hidden');
  } catch (e) { console.error(e); }
}

async function showTags() {
  homeSections.classList.remove('hidden');
  genreSection.classList.remove('hidden');
  searchResults.classList.add('hidden');
  playerContainer.classList.add('hidden');
  loadMoreBtn.classList.add('hidden');
  try {
    const res = await fetch(`${TMDB_BASE_URL}/genre/${activeCategory}/list?api_key=${TMDB_API_KEY}&language=ar`);
    const data = await res.json();
    displayGenres(data.genres);
  } catch (e) { console.error(e); }
}

function displayGenres(genres) {
  genreList.innerHTML = '';
  const customTags = [{ id: 'anime', name: 'أنمي', genreId: 16 }, { id: 'kdrama', name: 'دراما كورية', lang: 'ko' }];
  genres.forEach(genre => {
    const tag = document.createElement('div');
    tag.className = 'tag-item'; tag.innerText = genre.name;
    tag.onclick = () => filterByGenre(genre.id, 1, false);
    genreList.appendChild(tag);
  });
  customTags.forEach(ct => {
    const tag = document.createElement('div');
    tag.className = 'tag-item'; tag.innerText = ct.name;
    tag.onclick = () => ct.id === 'kdrama' ? filterByLang(ct.lang, 1, false) : filterByGenre(ct.genreId, 1, false);
    genreList.appendChild(tag);
  });
}

async function filterByGenre(genreId, page = 1, append = false) {
  currentView = 'genre'; currentGenreId = genreId; currentPage = page;
  try {
    const res = await fetch(`${TMDB_BASE_URL}/discover/${activeCategory}?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`);
    const data = await res.json();
    homeSections.classList.add('hidden'); searchResults.classList.remove('hidden');
    document.querySelector('#searchResults h2').innerText = 'نتائج التصنيف';
    displayItems(data.results, moviesGrid, append);
    if (data.total_pages > page) loadMoreBtn.classList.remove('hidden');
    else loadMoreBtn.classList.add('hidden');
  } catch (e) { console.error(e); }
}

async function filterByLang(lang, page = 1, append = false) {
  currentView = 'lang'; currentLang = lang; currentPage = page;
  try {
    const res = await fetch(`${TMDB_BASE_URL}/discover/${activeCategory}?api_key=${TMDB_API_KEY}&with_original_language=${lang}&sort_by=popularity.desc&page=${page}`);
    const data = await res.json();
    homeSections.classList.add('hidden'); searchResults.classList.remove('hidden');
    document.querySelector('#searchResults h2').innerText = 'نتائج التصنيف';
    displayItems(data.results, moviesGrid, append);
    if (data.total_pages > page) loadMoreBtn.classList.remove('hidden');
    else loadMoreBtn.classList.add('hidden');
  } catch (e) { console.error(e); }
}

function setActiveNav(el) {
  [navHome, navMovies, navTV, navTags].forEach(nav => nav.classList.remove('active'));
  el.classList.add('active');
}

function stopPlayback() {
  document.body.classList.remove('cinema-mode');
  videoFrame.src = '';
  playerRecommendations.classList.add('hidden');
  showHome();
}

function toggleFullscreen() {
  const isCinema = document.body.classList.toggle('cinema-mode');
  fullscreenBtn.innerText = isCinema ? 'خروج' : 'ملء الشاشة';
}
