/**
 * Open Library — "I want to read"
 * API: https://openlibrary.org/search.json  (no key)
 */

const API_URL = "https://openlibrary.org/search.json";
const COVER_BASE = "https://covers.openlibrary.org/b/id";
const FIELDS = "key,title,author_name,first_publish_year,cover_i,edition_count";
const PAGE_SIZE = 24;

const TOPICS = [
  "Harry Potter", "1984", "Dune", "Sapiens", "Atomic Habits",
  "The Alchemist", "Pride and Prejudice", "Lord of the Rings",
  "Ngugi", "Things Fall Apart", "Brave New World", "The Hobbit",
  "To Kill a Mockingbird", "The Great Gatsby", "Crime and Punishment",
  "One Hundred Years of Solitude", "Beloved", "The Catcher in the Rye",
  "Fahrenheit 451", "Animal Farm", "The Little Prince", "Frankenstein",
  "Dracula", "Jane Eyre", "Wuthering Heights", "Moby Dick",
  "War and Peace", "Anna Karenina", "Don Quixote", "Les Misérables",
  "Philosophy", "Science", "History", "Poetry", "Biography",
  "Mystery", "Fantasy", "Romance", "Thriller", "Self-help",
];

const COLORS = ["c-purple", "c-blue", "c-green"];

// DOM
const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const btn = document.getElementById("search-btn");
const btnText = btn.querySelector(".btn-text");
const btnLoader = btn.querySelector(".btn-loader");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const resultsSection = document.getElementById("results-section");
const resultsCount = document.getElementById("results-count");
const loadMoreWrap = document.getElementById("load-more-wrap");
const loadMoreBtn = document.getElementById("load-more-btn");
const adInline = document.getElementById("ad-inline");
const topicCloud = document.getElementById("topic-cloud");
const chipsEl = document.getElementById("chips");

// State
let currentQuery = "";
let currentPage = 1;
let totalFound = 0;
let isLoading = false;

// ─── Helpers ──────────────────────────────────────────────

function setLoading(on) {
  isLoading = on;
  btn.disabled = on;
  btnText.hidden = on;
  btnLoader.hidden = !on;
  loadMoreBtn.disabled = on;
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

function coverUrl(id) {
  return id ? `${COVER_BASE}/${id}-M.jpg` : null;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ─── Floating topic cloud ─────────────────────────────────

function buildTopicCloud() {
  topicCloud.innerHTML = "";
  const shuffled = [...TOPICS].sort(() => Math.random() - 0.5);

  shuffled.forEach((topic, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `cloud-topic ${COLORS[i % 3]}`;
    el.textContent = topic;
    el.dataset.q = topic;

    // Random position
    const top = 5 + Math.random() * 85;
    const left = 2 + Math.random() * 90;
    el.style.top = `${top}%`;
    el.style.left = `${left}%`;
    el.style.animationDuration = `${6 + Math.random() * 8}s`;
    el.style.animationDelay = `${-Math.random() * 10}s`;

    el.addEventListener("click", () => {
      input.value = topic;
      doSearch(topic, true);
    });

    topicCloud.appendChild(el);
  });
}

// ─── Chips ────────────────────────────────────────────────

chipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const q = chip.dataset.q;
  input.value = q;
  doSearch(q, true);
});

// ─── Card ─────────────────────────────────────────────────

function createCard(book, index) {
  const title = book.title || "Untitled";
  const authors = book.author_name?.join(", ") || "Unknown";
  const year = book.first_publish_year || "";
  const cover = coverUrl(book.cover_i);
  const href = book.key ? `https://openlibrary.org${book.key}` : "#";

  const a = document.createElement("a");
  a.className = "book-card";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.style.animationDelay = `${Math.min(index * 35, 350)}ms`;

  const coverWrap = document.createElement("div");
  coverWrap.className = "book-cover-wrap";

  if (cover) {
    const img = document.createElement("img");
    img.className = "book-cover";
    img.src = cover;
    img.alt = title;
    img.loading = "lazy";
    img.onerror = () => {
      coverWrap.innerHTML = `<span class="book-cover-placeholder">📖</span>`;
    };
    coverWrap.appendChild(img);
  } else {
    coverWrap.innerHTML = `<span class="book-cover-placeholder">📖</span>`;
  }

  const info = document.createElement("div");
  info.className = "book-info";
  info.innerHTML = `
    <div class="book-title">${escapeHtml(title)}</div>
    <div class="book-author">${escapeHtml(authors)}</div>
    ${year ? `<div class="book-year">${year}</div>` : ""}
  `;

  a.appendChild(coverWrap);
  a.appendChild(info);
  return a;
}

// ─── Render ───────────────────────────────────────────────

function renderResults(docs, append = false) {
  if (!append) resultsEl.innerHTML = "";

  if (!docs.length && !append) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <span class="big-emoji">🔍</span>
        <p>No books found. Try another search.</p>
      </div>`;
    loadMoreWrap.hidden = true;
    return;
  }

  const frag = document.createDocumentFragment();
  docs.forEach((b, i) => frag.appendChild(createCard(b, i)));
  resultsEl.appendChild(frag);

  const shown = resultsEl.querySelectorAll(".book-card").length;
  loadMoreWrap.hidden = shown >= totalFound;
}

// ─── Fetch ────────────────────────────────────────────────

async function fetchBooks(query, page = 1) {
  const url = new URL(API_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("limit", PAGE_SIZE);
  url.searchParams.set("page", page);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function doSearch(query, reset = true) {
  if (!query.trim() || isLoading) return;

  currentQuery = query.trim();
  if (reset) {
    currentPage = 1;
    resultsEl.innerHTML = "";
  }

  setLoading(true);
  setStatus(reset ? "Searching…" : "Loading more…");
  resultsSection.hidden = false;
  adInline.hidden = false;

  // Scroll to results on first search
  if (reset) {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  try {
    const data = await fetchBooks(currentQuery, currentPage);
    totalFound = data.numFound || 0;
    const docs = data.docs || [];

    resultsCount.textContent = totalFound
      ? `${totalFound.toLocaleString()} books found`
      : "";

    if (!docs.length && reset) {
      setStatus("No results found.", true);
    } else {
      setStatus("");
    }

    renderResults(docs, !reset);
  } catch (err) {
    console.error(err);
    setStatus("Could not reach Open Library. Try again.", true);
    if (reset) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <span class="big-emoji">⚠️</span>
          <p>Something went wrong. Check your connection.</p>
        </div>`;
    }
  } finally {
    setLoading(false);
  }
}

// ─── Events ───────────────────────────────────────────────

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  doSearch(q, true);
});

loadMoreBtn.addEventListener("click", () => {
  if (isLoading || !currentQuery) return;
  currentPage += 1;
  doSearch(currentQuery, false);
});

// Init
buildTopicCloud();
input.focus();
