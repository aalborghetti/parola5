// app.js — Wordle-like ITA (5 lettere) + tastiera on-screen (mobile) + colori tasti

const WORD_LEN = 5;
const MAX_TRIES = 6;

let words = { solutions: [], allowed: [] };
let allowedSet = new Set();

let solution = "";
let row = 0;
let col = 0;
let current = Array.from({ length: MAX_TRIES }, () => Array(WORD_LEN).fill(""));
let locked = false;

// stato tastiera: lettera -> "gray" | "yellow" | "green"
let keyStatus = {};

const boardEl = document.getElementById("board");
const msgEl = document.getElementById("msg");
const newGameBtn = document.getElementById("newGame");
const keyboardEl = document.getElementById("keyboard");

init();

async function init() {
  buildBoard();
  buildKeyboard(); // <- tastiera cliccabile/touch

  // input da tastiera fisica
  window.addEventListener("keydown", onKeyDown);

  // nuova partita
  newGameBtn?.addEventListener("click", startNewGame);

  try {
    await loadWords();
    startNewGame();
  } catch (err) {
    console.error(err);
    setMsg("Errore caricamento parole. Controlla che words.json sia presente e valido (vedi Console).");
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
      .replace(/[\u0300-\u036f]/g, "") // diacritici
      .replace(/[^a-z]/g, ""); // solo a-z

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

  const solutions = uniq((data.solutions || []).map(clean)).filter((w) => w.length === WORD_LEN);
  const allowed = uniq((data.allowed || []).map(clean)).filter((w) => w.length === WORD_LEN);

  const set = new Set(allowed);
  for (const w of solutions) set.add(w);

  words = { solutions, allowed: Array.from(set) };
  allowedSet = set;

  if (words.solutions.length === 0) throw new Error("Nessuna parola valida in solutions.");
}

function startNewGame() {
  locked = false;
  row = 0;
  col = 0;

  current = Array.from({ length: MAX_TRIES }, () => Array(WORD_LEN).fill(""));
  solution = words.solutions[Math.floor(Math.random() * words.solutions.length)];

  // reset griglia
  document.querySelectorAll(".cell").forEach((cell) => {
    cell.className = "cell";
    cell.textContent = "";
  });

  // reset tastiera colori
  keyStatus = {};
  resetKeyboardUI();

  setMsg("Scrivi una parola di 5 lettere e premi Invio.");
  // console.log("DEBUG solution:", solution);
}

/* ---------------------------
   Input: tastiera fisica
---------------------------- */

function onKeyDown(e) {
  if (locked) return;

  // ignora combinazioni per non rompere shortcut
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key;

  if (key === "Enter") {
    e.preventDefault();
    submitGuess();
    return;
  }
  if (key === "Backspace") {
    e.preventDefault();
    backspace();
    return;
  }

  if (/^[a-zA-Z]$/.test(key)) {
    e.preventDefault();
    typeLetter(key.toLowerCase());
  }
}

/* ---------------------------
   Input: tastiera on-screen
---------------------------- */

function buildKeyboard() {
  if (!keyboardEl) return;
  keyboardEl.innerHTML = "";

  const rows = [
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l"],
    ["enter","z","x","c","v","b","n","m","back"]
  ];

  rows.forEach((keys) => {
    const rowEl = document.createElement("div");
    rowEl.className = "krow";

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

      // click/touch
      btn.addEventListener("click", () => handleVirtualKey(k));
      rowEl.appendChild(btn);
    });

    keyboardEl.appendChild(rowEl);
  });
}

function handleVirtualKey(k) {
  if (locked) return;

  if (k === "enter") return submitGuess();
  if (k === "back") return backspace();
  if (/^[a-z]$/.test(k)) return typeLetter(k);
}

/* ---------------------------
   Logica inserimento
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
  if (row >= MAX_TRIES) return;

  const guess = current[row].join("");

  if (guess.length !== WORD_LEN || current[row].some((x) => !x)) {
    setMsg("Completa 5 lettere prima di premere Invio.");
    return;
  }

  if (!allowedSet.has(guess)) {
    setMsg("Parola non in elenco.");
    return;
  }

  const marks = evaluateGuess(guess, solution);
  applyMarks(row, marks);
  updateKeyboardFromGuess(guess, marks);

  if (guess === solution) {
    locked = true;
    setMsg("Bravo! Hai indovinato 🎉");
    return;
  }

  row++;
  col = 0;

  if (row >= MAX_TRIES) {
    locked = true;
    setMsg(`Peccato! La parola era: ${solution.toUpperCase()}`);
    return;
  }

  setMsg("Continua…");
}

/**
 * Ritorna array di 5 stati: "green" | "yellow" | "gray"
 * Gestione doppioni corretta con conteggio residuo.
 */
function evaluateGuess(guess, sol) {
  const result = Array(WORD_LEN).fill("gray");
  const solArr = sol.split("");
  const guessArr = guess.split("");

  // 1) verdi
  for (let i = 0; i < WORD_LEN; i++) {
    if (guessArr[i] === solArr[i]) {
      result[i] = "green";
      solArr[i] = null; // consumata
    }
  }

  // 2) conteggi residui (solo lettere non verdi)
  const remaining = {};
  for (const ch of solArr) {
    if (!ch) continue;
    remaining[ch] = (remaining[ch] || 0) + 1;
  }

  // 3) gialli
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

function applyMarks(r, marks) {
  for (let c = 0; c < WORD_LEN; c++) {
    const cell = getCell(r, c);
    cell.classList.remove("gray", "yellow", "green");
    cell.classList.add(marks[c]);
  }
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

// priorità colori: green > yellow > gray
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
    const st = marks[i]; // "green"|"yellow"|"gray"
    keyStatus[ch] = upgradeStatus(keyStatus[ch], st);
    setKeyColor(ch, keyStatus[ch]);
  }
}
