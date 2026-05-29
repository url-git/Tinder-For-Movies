/* ============================================================
   CineMatch – script.js
   ============================================================ */

// ── CONFIG ──────────────────────────────────────────────────
// Klucze pobierane z /api/config (Netlify function) – nie są przechowywane w kodzie
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const API_MOVIES      = "/api/movies";
const API_CONFIG      = "/api/config";

const GENRES = [
  { id: 28,    name: "Akcja",    emoji: "💥" },
  { id: 35,    name: "Komedia",  emoji: "😂" },
  { id: 27,    name: "Horror",   emoji: "👻" },
  { id: 10749, name: "Romans",   emoji: "❤️" },
  { id: 14,    name: "Fantasy",  emoji: "🧙" },
  { id: 53,    name: "Thriller", emoji: "🔪" },
  { id: 18,    name: "Dramat",   emoji: "🎭" },
];

// ── STATE ────────────────────────────────────────────────────
const state = {
  sessionId:    null,
  userId:       null,      // 1 | 2
  movies:       [],        // pełna lista filmów
  currentIndex: 0,
  myVotes:      {},        // movieId → 'like'|'dislike'
  partnerVotes: {},        // movieId → 'like'|'dislike'
  channel:      null,
  isAnimating:  false,
  pendingMatch: null,      // film czekający na ekran match
};

// ── SUPABASE ─────────────────────────────────────────────────
let sb = null;

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  buildGenreGrid();
  showLoading("Inicjalizacja…");

  try {
    const resp = await fetch(API_CONFIG);
    if (!resp.ok) throw new Error("Nie można pobrać konfiguracji.");
    const { url, anonKey } = await resp.json();
    sb = window.supabase.createClient(url, anonKey);
  } catch (err) {
    hideLoading();
    showToast("Błąd konfiguracji: " + err.message);
    showScreen("landing");
    return;
  }

  hideLoading();
  const params = new URLSearchParams(location.search);
  const code   = params.get("session");
  if (code) {
    showScreen("join");
    document.getElementById("join-input").value = code.toUpperCase();
  } else {
    const saved = await tryRestoreSession();
    if (!saved) showScreen("landing");
  }
});

// ── SCREEN ROUTER ────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add("active");
}

// ── GENRE GRID ───────────────────────────────────────────────
function buildGenreGrid() {
  const grid = document.getElementById("genre-grid");
  GENRES.forEach(g => {
    const btn = document.createElement("button");
    btn.className = "genre-card";
    btn.innerHTML = `<span class="genre-emoji">${g.emoji}</span><span>${g.name}</span>`;
    btn.onclick = () => startCreateSession(g);
    grid.appendChild(btn);
  });
}

// ── CREATE SESSION FLOW ──────────────────────────────────────
function showCreateFlow() {
  showScreen("category");
}

async function startCreateSession(genre) {
  showLoading("Pobieramy filmy…");
  try {
    const movies = await fetchMovies(genre.id);
    if (!movies.length) throw new Error("Brak filmów dla wybranego gatunku.");

    const sessionId = randomCode();
    const { error: insertError } = await sb.from("sessions").insert({
      id:       sessionId,
      genre_id: genre.id,
      movies:   movies,
      player_count: 1,
    });
    if (insertError) throw new Error("Nie można zapisać sesji: " + insertError.message);

    state.sessionId    = sessionId;
    state.userId       = 1;
    state.movies       = movies;
    state.currentIndex = 0;
    state.myVotes      = {};
    state.partnerVotes = {};
    saveLocal();

    history.replaceState({}, "", `/?session=${sessionId}`);
    document.getElementById("waiting-code").textContent = sessionId;
    hideLoading();
    showScreen("waiting");
    subscribeToSession();
  } catch (err) {
    hideLoading();
    showToast("Błąd: " + err.message);
  }
}

// ── JOIN SESSION ─────────────────────────────────────────────
async function joinSession() {
  const code = document.getElementById("join-input").value.trim().toUpperCase();
  const errEl = document.getElementById("join-error");
  errEl.classList.add("hidden");

  if (code.length !== 6) { errEl.textContent = "Kod musi mieć 6 znaków."; errEl.classList.remove("hidden"); return; }

  showLoading("Łączę z sesją…");
  try {
    const { data: session, error } = await sb.from("sessions").select("*").eq("id", code).single();
    if (error || !session) throw new Error("Sesja nie istnieje.");
    if (session.player_count >= 2) throw new Error("Sesja jest już pełna.");

    await sb.from("sessions").update({ player_count: 2 }).eq("id", code);

    state.sessionId    = code;
    state.userId       = 2;
    state.movies       = session.movies;
    state.currentIndex = 0;
    state.myVotes      = {};
    state.partnerVotes = {};
    saveLocal();

    // Wczytaj istniejące głosy partnera PRZED subskrypcją
    await loadExistingVotes();

    history.replaceState({}, "", `/?session=${code}`);
    hideLoading();
    startSwiping();
    subscribeToSession();
  } catch (err) {
    hideLoading();
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
}

// ── LOAD EXISTING VOTES (gracz 2 dołącza po tym jak gracz 1 już głosował) ──
async function loadExistingVotes() {
  const { data: votes } = await sb
    .from("votes")
    .select("*")
    .eq("session_id", state.sessionId);

  if (!votes) return;
  const partnerId = state.userId === 1 ? 2 : 1;
  votes.forEach(v => {
    if (v.user_id === state.userId)  state.myVotes[v.movie_id]      = v.vote;
    if (v.user_id === partnerId)     state.partnerVotes[v.movie_id] = v.vote;
  });
}

// ── SUPABASE REALTIME ─────────────────────────────────────────
function subscribeToSession() {
  if (state.channel) state.channel.unsubscribe();

  state.channel = sb
    .channel(`session_${state.sessionId}`)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  "votes",
      filter: `session_id=eq.${state.sessionId}`,
    }, handleIncomingVote)
    .on("postgres_changes", {
      event:  "UPDATE",
      schema: "public",
      table:  "sessions",
      filter: `id=eq.${state.sessionId}`,
    }, handleSessionUpdate)
    .subscribe();
}

function handleSessionUpdate(payload) {
  const session = payload.new;
  // Gracz 1 czeka: gdy player_count staje się 2 → startujemy
  if (state.userId === 1 && session.player_count >= 2 && document.getElementById("screen-waiting").classList.contains("active")) {
    startSwiping();
  }
}

function handleIncomingVote(payload) {
  const v = payload.new;
  if (Number(v.user_id) === state.userId) return; // własny głos
  state.partnerVotes[v.movie_id] = v.vote;
  checkMatch(Number(v.movie_id));
  updatePartnerStatus();
}

// ── START SWIPING ─────────────────────────────────────────────
function startSwiping() {
  showScreen("swiping");
  updateSwipeHeader();
  renderCards();
}

function updateSwipeHeader() {
  document.getElementById("swiping-session-badge").textContent = state.sessionId;
  document.getElementById("swiping-player-badge").textContent  = `Gracz ${state.userId}`;
  updateProgress();
}

function updateProgress() {
  const total   = state.movies.length;
  const current = Math.min(state.currentIndex + 1, total);
  document.getElementById("swiping-progress").textContent = `${current} / ${total}`;
}

// ── RENDER CARDS ──────────────────────────────────────────────
function renderCards() {
  const stack = document.getElementById("card-stack");
  stack.innerHTML = "";

  const movies = state.movies;
  const idx    = state.currentIndex;
  if (idx >= movies.length) { showScreen("finished"); return; }

  // karta w tle (następna)
  if (idx + 1 < movies.length) {
    stack.appendChild(buildCard(movies[idx + 1], false));
  }
  // karta aktywna (na wierzchu)
  stack.appendChild(buildCard(movies[idx], true));
}

function buildCard(movie, isTop) {
  const card = document.createElement("div");
  card.className = `movie-card ${isTop ? "top-card" : "next-card"}`;
  card.dataset.movieId = movie.id;

  const posterUrl = movie.poster_path
    ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
    : null;

  const year    = movie.release_date ? movie.release_date.slice(0, 4) : "";
  const rating  = movie.vote_average ? movie.vote_average.toFixed(1) : null;
  const overview = (movie.overview || "").slice(0, 160) || "Brak opisu.";

  card.innerHTML = `
    ${posterUrl
      ? `<img class="card-poster" src="${posterUrl}" alt="${esc(movie.title)}" loading="lazy" />`
      : `<div class="card-poster-placeholder">🎬</div>`
    }
    <div class="card-info">
      <div>
        <div class="card-meta">
          ${rating ? `<span class="card-rating">⭐ ${rating}</span>` : ""}
          ${year   ? `<span class="card-year">${year}</span>` : ""}
        </div>
        <div class="card-title">${esc(movie.title)}</div>
      </div>
      <div class="card-overview">${esc(overview)}</div>
    </div>
    <div class="card-vote-overlay card-vote-like">   <span class="card-vote-stamp">LUBIĘ</span></div>
    <div class="card-vote-overlay card-vote-dislike"><span class="card-vote-stamp">NOPE</span></div>
  `;
  return card;
}

// ── VOTE ──────────────────────────────────────────────────────
async function vote(type) {
  if (state.isAnimating) return;
  const movies = state.movies;
  if (state.currentIndex >= movies.length) return;

  state.isAnimating = true;
  const movie   = movies[state.currentIndex];
  const movieId = movie.id;

  // animacja karty
  const topCard = document.querySelector(".top-card");
  if (topCard) {
    const overlay = topCard.querySelector(type === "like" ? ".card-vote-like" : ".card-vote-dislike");
    if (overlay) overlay.style.opacity = "1";
    topCard.classList.add(type === "like" ? "card-swipe-right" : "card-swipe-left");
    await sleep(400);
  }

  // zapis głosu
  state.myVotes[movieId] = type;
  state.currentIndex++;
  updateProgress();

  await sb.from("votes").upsert({
    session_id: state.sessionId,
    user_id:    state.userId,
    movie_id:   movieId,
    vote:       type,
  }, { onConflict: "session_id,user_id,movie_id" });

  if (type === "like") checkMatch(movieId);

  renderCards();
  updatePartnerStatus();
  state.isAnimating = false;
}

// ── MATCH LOGIC ───────────────────────────────────────────────
function checkMatch(movieId) {
  const myVote      = state.myVotes[movieId];
  const partnerVote = state.partnerVotes[movieId];
  if (myVote === "like" && partnerVote === "like") {
    const movie = state.movies.find(m => m.id === movieId);
    if (movie) showMatch(movie);
  }
}

function showMatch(movie) {
  state.pendingMatch = movie;
  const posterUrl = movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : "";
  document.getElementById("match-poster").src      = posterUrl;
  document.getElementById("match-title").textContent  = movie.title;
  document.getElementById("match-year").textContent   = movie.release_date?.slice(0, 4) || "";
  spawnConfetti();
  showScreen("match");
}

function continueSwipping() {
  state.pendingMatch = null;
  if (state.currentIndex >= state.movies.length) showScreen("finished");
  else startSwiping();
}

function restartSession() {
  clearLocal();
  state.channel?.unsubscribe();
  Object.assign(state, { sessionId: null, userId: null, movies: [], currentIndex: 0, myVotes: {}, partnerVotes: {}, channel: null, pendingMatch: null });
  history.replaceState({}, "", "/");
  showScreen("landing");
}

// ── PARTNER STATUS INDICATOR ──────────────────────────────────
function updatePartnerStatus() {
  const el      = document.getElementById("partner-status");
  const total   = Object.keys(state.partnerVotes).length;
  el.textContent = total > 0 ? `Partner ocenił: ${total} filmów` : "";
}

// ── TRAILER ───────────────────────────────────────────────────
function openTrailer() {
  const movie = state.movies[state.currentIndex];
  if (!movie) return;
  const q = encodeURIComponent(`${movie.title} ${movie.release_date?.slice(0,4) || ""} zwiastun trailer`);
  window.open(`https://www.youtube.com/results?search_query=${q}`, "_blank", "noopener");
}

// ── WAITING ACTIONS ───────────────────────────────────────────
function copyCode() {
  const code = state.sessionId || "";
  navigator.clipboard.writeText(code).then(() => showToast("Kod skopiowany!"));
}

// ── FETCH MOVIES ──────────────────────────────────────────────
async function fetchMovies(genreId) {
  const url = `${API_MOVIES}?genre=${genreId}&page=1`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();

  const results = (data.results || [])
    .filter(m => m.poster_path && m.overview)
    .slice(0, 30)
    .map(m => ({
      id:           m.id,
      title:        m.title,
      overview:     m.overview.slice(0, 200),
      poster_path:  m.poster_path,
      vote_average: m.vote_average,
      release_date: m.release_date,
    }));

  return shuffle(results);
}

// ── SESSION PERSISTENCE ───────────────────────────────────────
function saveLocal() {
  localStorage.setItem("cinematch_session", JSON.stringify({
    sessionId:    state.sessionId,
    userId:       state.userId,
  }));
}

function clearLocal() {
  localStorage.removeItem("cinematch_session");
}

async function tryRestoreSession() {
  const raw = localStorage.getItem("cinematch_session");
  if (!raw) return false;

  try {
    const { sessionId, userId } = JSON.parse(raw);
    if (!sessionId || !userId) return false;

    showLoading("Przywracam sesję…");
    const { data: session } = await sb.from("sessions").select("*").eq("id", sessionId).single();
    if (!session) { clearLocal(); hideLoading(); return false; }

    state.sessionId    = sessionId;
    state.userId       = userId;
    state.movies       = session.movies;
    state.currentIndex = 0;
    state.myVotes      = {};
    state.partnerVotes = {};

    await loadExistingVotes();
    // przesuń currentIndex za już ocenione filmy tego gracza
    const myVotedIds = new Set(Object.keys(state.myVotes).map(Number));
    while (state.currentIndex < state.movies.length && myVotedIds.has(state.movies[state.currentIndex].id)) {
      state.currentIndex++;
    }

    hideLoading();
    startSwiping();
    subscribeToSession();
    return true;
  } catch {
    clearLocal();
    hideLoading();
    return false;
  }
}

// ── LOADING HELPERS ───────────────────────────────────────────
function showLoading(text = "Ładowanie…") {
  document.getElementById("loading-text").textContent = text;
  document.getElementById("loading-overlay").classList.remove("hidden");
}
function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden");
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2800);
}

// ── CONFETTI ──────────────────────────────────────────────────
function spawnConfetti() {
  const container = document.getElementById("confetti-container");
  container.innerHTML = "";
  const colors = ["#e040fb","#7c4dff","#00e676","#ffc800","#ff4081","#40c4ff"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 10}px;
      height: ${6 + Math.random() * 10}px;
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
      animation-duration: ${1.5 + Math.random() * 2.5}s;
      animation-delay: ${Math.random() * 0.8}s;
    `;
    container.appendChild(el);
  }
}

// ── UTILS ─────────────────────────────────────────────────────
function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
