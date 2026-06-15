# Parola5

**Parola5** è un gioco di parole in stile *Wordle*, in italiano, scritto in HTML, CSS e JavaScript puro (vanilla), senza dipendenze né build step. L'obiettivo è indovinare una parola segreta di **5 lettere** entro **6 tentativi**.

## 🎮 Come si gioca

1. Apri la pagina: viene scelta a caso una parola segreta di 5 lettere.
2. Digita una parola di 5 lettere (tastiera fisica oppure tastiera a schermo) e premi **↵ (Invio)**.
3. Ogni lettera viene colorata in base al risultato:
   - 🟩 **Verde** — lettera giusta nella posizione giusta.
   - 🟨 **Giallo** — lettera presente nella parola ma in posizione diversa.
   - ⬛ **Grigio** — lettera non presente nella parola.
4. Hai 6 tentativi. Vinci se indovini la parola; altrimenti, al sesto errore, viene rivelata la soluzione.
5. A fine partita compaiono le **statistiche** (partite giocate, % vittorie, serie attuale, record).
6. Premi **Nuova partita** per ricominciare con una nuova parola.

> 💾 Se chiudi o ricarichi la pagina a partita in corso, la trovi **ripresa al punto in cui l'avevi lasciata** (parola, tentativi e colori). Le statistiche sono conservate tra una sessione e l'altra.

> ⚠️ Una parola può essere inviata solo se è presente nell'elenco (`words.json`). In caso contrario compare il messaggio *"Parola non in elenco."*

## ✨ Caratteristiche

- Tastiera **fisica** e tastiera **a schermo** (on-screen), entrambe funzionanti.
- I tasti della tastiera a schermo si colorano in base allo stato migliore raggiunto per ciascuna lettera (verde > giallo > grigio).
- Gestione corretta delle **lettere doppie** (conteggio degli abbinamenti residui dopo i verdi).
- **Animazione "flip"** delle celle alla conferma del tentativo (350 ms per cella, in sequenza).
- **Statistiche persistenti** (partite, % vittorie, serie attuale, record) salvate nel browser.
- **Ripresa automatica** della partita in corso dopo ricarica/chiusura della pagina.
- Interfaccia responsive con tema scuro.
- Accessibilità: attributi `aria-label` e `aria-live` per messaggi di stato.
- Nessuna dipendenza esterna, nessun framework, nessun server applicativo: è un sito statico.

## 📁 Struttura del progetto

| File | Descrizione |
|------|-------------|
| `index.html` | Markup della pagina: header, griglia di gioco (`#board`), area messaggi (`#msg`), pannello statistiche (`#stats`), tastiera (`#keyboard`) e pulsante *Nuova partita*. |
| `style.css` | Stili (tema scuro): griglia 6×5, colori degli esiti (verde/giallo/grigio), animazione flip, pannello statistiche e layout responsive della tastiera. |
| `app.js` | Logica di gioco: caricamento parole, gestione input, valutazione dei tentativi, animazione, statistiche, persistenza, rendering e stato della tastiera. |
| `words.json` | Dizionario delle parole valide. Oggetto JSON con la chiave `solutions`: un array di **2528** parole italiane di 5 lettere di uso comune. |
| `favicon.svg` | Icona del sito: griglia 3×3 in stile bandiera italiana (verde in alto a sinistra, bianco sulla diagonale, rosso in basso a destra), SVG scalabile. |

## ⚙️ Come funziona (dettagli tecnici)

- **Caricamento parole** (`loadWords`): `fetch("words.json")` con `cache: "no-store"`. Le parole vengono normalizzate (minuscole, rimozione accenti via `NFD`, solo caratteri `a-z`), deduplicate e filtrate a esattamente 5 lettere.
- **Lista unica**: lo stesso elenco `solutions` è usato sia come **insieme delle possibili soluzioni** (la parola segreta è estratta a caso da qui) sia come **dizionario di validazione** dei tentativi.
- **Valutazione** (`evaluateGuess`): prima vengono assegnati i **verdi**, poi i **gialli** in base al conteggio delle lettere residue, evitando falsi positivi sui duplicati.
- **Stato tastiera** (`upgradeStatus`): ogni lettera mantiene lo stato di rango più alto raggiunto (`gray` < `yellow` < `green`).
- **Animazione** (`applyMarksAnimated`): le celle ruotano in sequenza (`FLIP_MS = 350` ms ciascuna) e il colore viene scambiato a metà flip. Durante l'animazione l'input è bloccato (`animating`). Un token `gameId` annulla i timer ancora pendenti se si avvia una nuova partita, evitando che colorino la griglia nuova.
- **Persistenza** (`saveState`/`restoreState`): a ogni tentativo lo stato (parola, lettere, colori, riga/colonna, stato tastiera) è salvato in `localStorage` (`parola5_state`) e ripristinato all'avvio; viene rimosso a partita conclusa o all'avvio di una nuova.
- **Statistiche** (`loadStats`/`updateStats`): partite giocate, vittorie, serie attuale, record e distribuzione dei tentativi sono salvate in `localStorage` (`parola5_stats`) e mostrate nel pannello `#stats` a fine partita.
- **Costanti**: `WORD_LEN = 5`, `MAX_TRIES = 6`, `FLIP_MS = 350` (definite in cima a `app.js`).

## 🚀 Avvio in locale

Poiché l'app usa `fetch()` per caricare `words.json`, **non può essere aperta con un doppio clic** su `index.html` (`file://` blocca le richieste). Serve un piccolo server HTTP statico.

**Con Python:**

```bash
cd Parola5
python -m http.server 8000
```

Poi apri <http://localhost:8000> nel browser.

**Con Node.js (npx):**

```bash
cd Parola5
npx serve
```

**Con l'estensione VS Code "Live Server":** apri la cartella e usa *"Go Live"*.

## 🧪 Stato verifica

L'app è stata verificata servendola via HTTP locale:

- `index.html` → `HTTP 200`
- `app.js` → `HTTP 200`
- `words.json` → `HTTP 200` (35.420 byte, 2528 parole valide di 5 lettere)

## 🛠️ Personalizzazione

- **Cambiare il dizionario**: modifica l'array `solutions` in `words.json` (solo parole di 5 lettere; accenti e maiuscole vengono normalizzati automaticamente).
- **Cambiare lunghezza parola o numero di tentativi**: modifica `WORD_LEN` e `MAX_TRIES` in `app.js` (adatta anche la griglia in `style.css`).
- **Velocità animazione**: modifica `FLIP_MS` in `app.js` (allinea la durata in `.cell.flipping` dentro `style.css`, che deve valere il doppio del tempo di scambio colore, cioè `FLIP_MS`).
- **Tema/colori**: modifica le classi `.green`, `.yellow`, `.gray` e le variabili in `style.css`.
- **Azzerare statistiche/partita**: da console del browser, `localStorage.removeItem("parola5_stats")` e `localStorage.removeItem("parola5_state")`.

## 📦 Tecnologie

- HTML5
- CSS3 (Grid, Flexbox, tema scuro)
- JavaScript ES6+ (vanilla, nessuna dipendenza)
