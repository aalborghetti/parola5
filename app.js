const WORD_LEN = 5;
const MAX_TRIES = 6;

let solutions = [];
let solutionsSet = new Set();

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
    startNewGame();
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
      .replace(/[\u0300-\u036f]/g, "")
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
  locked = false;
  row = 0;
  col = 0;

  current = Array.from({ length: MAX_TRIES }, () => Array(WORD_LEN).fill(""));
  solution = solutions[Math.floor(Math.random() * solutions.length)];

  document.querySelectorAll(".cell").forEach((cell) => {
    cell.className = "cell";
    cell.textContent = "";
  });

  keyStatus = {};
  resetKeyboardUI();

  setMsg("Scrivi una parola di 5 lettere e premi ↵.");
}

/* ---------------------------
   Input: tastiera fisica
---------------------------- */

function onKeyDown(e) {
  if (locked) return;
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
  if (locked) return;

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
  if (row >= MAX_TRIES) return;

  const guess = current[row].join("");
  if (guess.length !== WORD_LEN || current[row].some((x) => !x)) {
    setMsg("Completa 5 lettere prima di inviare.");
    return;
  }

  // ✅ ora validiamo SOLO contro solutions
  if (!solutionsSet.has(guess)) {
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
