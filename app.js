const WORD_LEN = 5;
const MAX_TRIES = 6;
const FLIP_MS = 350;

const STATE_KEY = "parola5_state";
const STATS_KEY = "parola5_stats";

let solutions = [];
let solutionsSet = new Set();

let solution = "";
let row = 0;
let col = 0;
let current = Array.from({ length: MAX_TRIES }, () => Array(WORD_LEN).fill(""));
let cellColors = Array.from({ length: MAX_TRIES }, () => Array(WORD_LEN).fill(null));
let locked = false;
let animating = false;
let gameId = 0;

let keyStatus = {};

const boardEl = document.getElementById("board");
const msgEl = document.getElementById("msg");
const statsEl = document.getElementById("stats");
const newGameBtn = document.getElementById("newGame");
const keyboardEl = document.getElementById("keyboard");

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  if (!boardEl) throw new Error("Elemento #board non trovato in index.html");

  buildBoard();
  buildKeyboard();

  window.addEventListener("keydown", onKeyDown);
  newGameBtn?.addEventListener("click", startNewGame);

  try {
    await loadWords();
    if (!restoreState()) {
      startNewGame();
    }
  } catch (err) {
    console.error(err);
    setMsg("Errore caricamento words.json. Controlla Console e che il file sia presente.");
  }
}

function buildBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < MAX_TRIES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.dataset.row = String(r);

    for (let c = 0; c < WORD_LEN; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.col = String(c);
      rowEl.appendChild(cell);
    }
    boardEl.appendChild(rowEl);
  }
}

async function loadWords() {
  const res = await fetch("words.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossibile caricare words.json (${res.status})`);
  const data = await res.json();

  const clean = (w) =>
    String(w)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z]/g, "");

  const uniq = (arr) => {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      if (!seen.has(x)) {
        seen.add(x);
        out.push(x);
      }
    }
    return out;
  };

  solutions = uniq((data.solutions || []).map(clean)).filter((w) => w.length === WORD_LEN);
  solutionsSet = new Set(solutions);

  if (solutions.length === 0) throw new Error("Nessuna parola valida in solutions.");
}

/* ---------------------------
   Nuova partita
---------------------------- */

function startNewGame() {
  gameId++;
  locked = false;
  animating = false;
  row = 0;
  col = 0;

  current = Array.from({ length: MAX_TRIES }, () => Array(WORD_LEN).fill(""));
  cellColors = Array.from({ length: MAX_TRIES }, () => Array(WORD_LEN).fill(null));
  solution = solutions[Math.floor(Math.random() * solutions.length)];

  document.querySelectorAll(".cell").forEach((cell) => {
    cell.className = "cell";
    cell.textContent = "";
  });

  keyStatus = {};
  resetKeyboardUI();

  if (statsEl) statsEl.hidden = true;
  setMsg("Scrivi una parola di 5 lettere e premi ↵.");
  clearState();
}

/* ---------------------------
   Input: tastiera fisica
---------------------------- */

function onKeyDown(e) {
  if (locked || animating) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key;

  if (key === "Enter") return submitGuess();
  if (key === "Backspace") return backspace();

  if (/^[a-zA-Z]$/.test(key)) typeLetter(key.toLowerCase());
}

/* ---------------------------
   Tastiera on-screen
---------------------------- */

function buildKeyboard() {
  if (!keyboardEl) return;
  keyboardEl.innerHTML = "";

  const rows = [
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l"],
    ["enter","z","x","c","v","b","n","m","back"]
  ];

  rows.forEach((keys, idx) => {
    const rowEl = document.createElement("div");
    rowEl.className = `krow r${idx + 1}`;

    keys.forEach((k) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.dataset.key = k;

      if (k === "enter") {
        btn.textContent = "↵";
        btn.classList.add("wide");
        btn.setAttribute("aria-label", "Invio");
      } else if (k === "back") {
        btn.textContent = "⌫";
        btn.classList.add("wide");
        btn.setAttribute("aria-label", "Cancella");
      } else {
        btn.textContent = k.toUpperCase();
        btn.setAttribute("aria-label", `Lettera ${k.toUpperCase()}`);
      }

      btn.addEventListener("click", () => handleVirtualKey(k));
      rowEl.appendChild(btn);
    });

    keyboardEl.appendChild(rowEl);
  });
}

function handleVirtualKey(k) {
  if (locked || animating) return;

  if (k === "enter") return submitGuess();
  if (k === "back") return backspace();
  if (/^[a-z]$/.test(k)) return typeLetter(k);
}

/* ---------------------------
   Inserimento / logica
---------------------------- */

function typeLetter(ch) {
  if (row >= MAX_TRIES) return;
  if (col >= WORD_LEN) return;

  current[row][col] = ch;
  renderCell(row, col, ch, { filled: true });
  col++;
}

function backspace() {
  if (row >= MAX_TRIES) return;
  if (col === 0) return;

  col--;
  current[row][col] = "";
  renderCell(row, col, "", { filled: false, clearStatus: true });
}

function submitGuess() {
  if (row >= MAX_TRIES || locked || animating) return;

  const guess = current[row].join("");
  if (guess.length !== WORD_LEN || current[row].some((x) => !x)) {
    setMsg("Completa 5 lettere prima di inviare.");
    return;
  }

  if (!solutionsSet.has(guess)) {
    setMsg("Parola non in elenco.");
    return;
  }

  animating = true;
  const guessMarks = evaluateGuess(guess, solution);
  const currentRow = row;
  const thisGame = gameId;

  applyMarksAnimated(currentRow, guessMarks, thisGame, () => {
    animating = false;
    cellColors[currentRow] = [...guessMarks];
    updateKeyboardFromGuess(guess, guessMarks);

    if (guess === solution) {
      locked = true;
      setMsg("Bravo! Hai indovinato!");
      renderStats(updateStats(true, currentRow + 1));
      clearState();
      return;
    }

    row++;
    col = 0;

    if (row >= MAX_TRIES) {
      locked = true;
      setMsg(`Peccato! La parola era: ${solution.toUpperCase()}`);
      renderStats(updateStats(false, 0));
      clearState();
      return;
    }

    setMsg("Continua…");
    saveState();
  });
}

function evaluateGuess(guess, sol) {
  const result = Array(WORD_LEN).fill("gray");
  const solArr = sol.split("");
  const guessArr = guess.split("");

  // verdi
  for (let i = 0; i < WORD_LEN; i++) {
    if (guessArr[i] === solArr[i]) {
      result[i] = "green";
      solArr[i] = null;
    }
  }

  // conteggi residui
  const remaining = {};
  for (const ch of solArr) {
    if (!ch) continue;
    remaining[ch] = (remaining[ch] || 0) + 1;
  }

  // gialli
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === "green") continue;
    const ch = guessArr[i];
    if (remaining[ch] > 0) {
      result[i] = "yellow";
      remaining[ch]--;
    }
  }

  return result;
}

/* ---------------------------
   Render griglia
---------------------------- */

function applyMarksAnimated(r, marks, gen, onDone) {
  for (let c = 0; c < WORD_LEN; c++) {
    const cell = getCell(r, c);
    const delay = c * FLIP_MS;
    setTimeout(() => {
      if (gen !== gameId) return;
      cell.classList.add("flipping");
      setTimeout(() => {
        if (gen !== gameId) return;
        cell.classList.remove("gray", "yellow", "green");
        cell.classList.add(marks[c]);
      }, FLIP_MS / 2);
      cell.addEventListener("animationend", () => cell.classList.remove("flipping"), { once: true });
    }, delay);
  }
  setTimeout(() => { if (gen === gameId) onDone(); }, (WORD_LEN - 1) * FLIP_MS + FLIP_MS);
}

function renderCell(r, c, ch, opts = {}) {
  const cell = getCell(r, c);
  cell.textContent = ch ? ch.toUpperCase() : "";

  if (opts.filled) cell.classList.add("filled");
  else cell.classList.remove("filled");

  if (opts.clearStatus) cell.classList.remove("gray", "yellow", "green");
}

function getCell(r, c) {
  const rowEl = boardEl.querySelector(`.row[data-row="${r}"]`);
  return rowEl.querySelector(`.cell[data-col="${c}"]`);
}

function setMsg(text) {
  if (msgEl) msgEl.textContent = text;
}

/* ---------------------------
   Tastiera: colori stato
---------------------------- */

function resetKeyboardUI() {
  if (!keyboardEl) return;
  keyboardEl.querySelectorAll(".key").forEach((k) => {
    k.classList.remove("gray", "yellow", "green");
  });
}

function upgradeStatus(prev, next) {
  const rank = { gray: 1, yellow: 2, green: 3 };
  if (!prev) return next;
  return rank[next] > rank[prev] ? next : prev;
}

function setKeyColor(letter, status) {
  if (!keyboardEl) return;
  const keyBtn = keyboardEl.querySelector(`.key[data-key="${letter}"]`);
  if (!keyBtn) return;
  keyBtn.classList.remove("gray", "yellow", "green");
  keyBtn.classList.add(status);
}

function updateKeyboardFromGuess(guess, marks) {
  for (let i = 0; i < WORD_LEN; i++) {
    const ch = guess[i];
    const st = marks[i];
    keyStatus[ch] = upgradeStatus(keyStatus[ch], st);
    setKeyColor(ch, keyStatus[ch]);
  }
}

/* ---------------------------
   Persistenza stato
---------------------------- */

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      solution, current, cellColors, row, col, keyStatus
    }));
  } catch (_) {}
}

function clearState() {
  localStorage.removeItem(STATE_KEY);
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY));
    if (!saved?.solution) return false;
    if (!solutionsSet.has(saved.solution)) { clearState(); return false; }

    solution = saved.solution;
    current = saved.current;
    cellColors = saved.cellColors;
    row = saved.row;
    col = saved.col;
    keyStatus = saved.keyStatus || {};

    for (let r = 0; r < row; r++) {
      for (let c = 0; c < WORD_LEN; c++) {
        renderCell(r, c, current[r][c], { filled: true });
        if (cellColors[r][c]) getCell(r, c).classList.add(cellColors[r][c]);
      }
    }
    for (let c = 0; c < col; c++) {
      renderCell(row, c, current[row][c], { filled: true });
    }

    for (const [letter, status] of Object.entries(keyStatus)) {
      setKeyColor(letter, status);
    }

    setMsg("Bentornato! Continua la tua partita.");
    return true;
  } catch (_) {
    clearState();
    return false;
  }
}

/* ---------------------------
   Statistiche
---------------------------- */

function defaultStats() {
  return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0] };
}

function loadStats() {
  try {
    return { ...defaultStats(), ...JSON.parse(localStorage.getItem(STATS_KEY)) };
  } catch (_) { return defaultStats(); }
}

function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (_) {}
}

function updateStats(won, guessCount) {
  const s = loadStats();
  s.played++;
  if (won) {
    s.won++;
    s.currentStreak++;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
    if (guessCount >= 1 && guessCount <= MAX_TRIES) s.distribution[guessCount - 1]++;
  } else {
    s.currentStreak = 0;
  }
  saveStats(s);
  return s;
}

function renderStats(s) {
  if (!statsEl) return;
  const pct = s.played > 0 ? Math.round(s.won / s.played * 100) : 0;
  statsEl.innerHTML = `
    <div class="stats-item"><strong>${s.played}</strong>Partite</div>
    <div class="stats-item"><strong>${pct}%</strong>Vittorie</div>
    <div class="stats-item"><strong>${s.currentStreak}</strong>Serie</div>
    <div class="stats-item"><strong>${s.maxStreak}</strong>Record</div>
  `;
  statsEl.hidden = false;
}
