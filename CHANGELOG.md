# CHANGELOG v2.0

## 🎉 Nuove Funzionalità

### Lavori (Jobs)
- ✅ Entità `Job`: id, titolo, commessa, cliente, agreedTotal, stato, note, createdISO
- ✅ Funzioni: `createJob()`, `getJobDue()`, `getJobPaid()`, `updateJobNote()`
- ✅ Auto-aggiungi cliente alle anagrafiche
- ✅ Dettaglio lavoro con tab Incassi/Acquisti/Note
- ✅ Rendering lista "Lavori Aperti" ordinati per Residuo DESCRESCENTE

### Incassi (JobPayments)
- ✅ Entità `JobPayment`: id, jobId, dateISO, amount, method, note
- ✅ Funzione: `createJobPayment()`
- ✅ **Auto-movimento**: ogni incasso crea movimento "entrata" con:
  - desc = "Incasso {job.titolo}"
  - commessa = commessa lavoro
  - controparteNome = cliente
  - controparteTipo = "cliente"
- ✅ **Auto-close**: se residuo ≤ 0 dopo incasso → job passa a "chiuso"

### Preventivi (Quotes)
- ✅ Entità `Quote`: id, cliente, commessa, righe[], createdISO, stato
- ✅ Righe con: desc, qty, unitPrice, sconto%, iva%
- ✅ Calcolo automatico: Imponibile → IVA → Totale
- ✅ Funzioni: `createQuote()`, `addQuoteRiga()`, `getQuoteCalc()`, `confirmQuoteAsJob()`
- ✅ **Print/PDF**: genera HTML con nome ditta, stampa via window.print()
- ✅ **Conferma Lavoro**: converte preventivo in Job (state=confermato)

### Storico Prodotti
- ✅ Entità `PurchaseLine`: id, dateISO, fornitore, prodotto, qty, unitPrice, commessa, note
- ✅ Funzione: `getProductHistory(filters)` con filtri fornitore/anno
- ✅ Statistiche: `getProductStats(prodotto)` → minPrice, avgPrice, maxPrice, lastPrice, qty, count
- ✅ Rendering: gruppi per prodotto + statistiche + elenco ultimi acquisti

### Navigazione Redesignata
- ❌ Rimossi: Dashboard, Movimenti, Commesse, Anagrafiche (tab vecchi)
- ✅ 4 nuovi tab principali:
  1. **Home**: 3 pulsanti grandi + lista lavori aperti
  2. **Lavori**: form per nuovo lavoro
  3. **Preventivi**: form + dettaglio preventivo
  4. **Storico Prodotti**: ricerca e statistiche
- ✅ Tab interni (nascosti):
  - tab-payment: registrazione incasso
  - tab-job-detail: dettaglio con sub-tab Incassi/Acquisti/Note
  - tab-new-quote: creazione preventivo
  - tab-quote-detail: dettaglio preventivo

### UI/UX
- ✅ Mobile-first: header staccato, nav orizzontale, main scrollabile
- ✅ Card lavori: titolo, cliente, commessa, residuo evidenziato (blu), incassato, totale
- ✅ Form compatti: input full-width, placeholder descrittivi
- ✅ Mini-row: componente riusabile per liste
- ✅ Apple-card style: blur, border soft, shadow leggera
- ✅ Colori distintivi: blue per residuo, green per incassati, orange per "aperto"
- ✅ Tap su job card → apre dettaglio

### Company Name Customization
- ✅ Header button "Ditta" → prompt personalizza nome
- ✅ Nome salvato in state.companyName
- ✅ Appare in header
- ✅ Usato in PDF del preventivo

### Persistenza Migliorata
- ✅ STORAGE_KEY: `bizmanagerpro_state_v2` (separato dalla v1)
- ✅ Migration v1 → v2 in `loadState()`: mantiene movimenti/anagrafiche, aggiunge jobs/payments/purchases/quotes
- ✅ Normalizzazione completa: tipologie, trim, uppercase commesse
- ✅ Backup/Import: include tutte le nuove entità

---

## 🔧 Cambiamenti Tecnici

### app.js
- Refactor struttura: utility → state management → jobs logic → quotes → products → rendering → tabs → init
- Funzioni pure per calcoli: `getJobDue()`, `getProductStats()`, `getQuoteCalc()`
- Event listeners non inline: tutti via `addEventListener()`
- escapeHTML() per output sicuro
- Chart.js mantenuto per futuro (initChart, updateChart pronte)

### index.html
- Header semplificato: logo, company chip, button azioni (Ditta/Backup/Import)
- Nav: 4 tab orizzontali scrollabili
- Main: flex column, max-width, padding safe
- Tab sections con ID esplicito: tab-home, tab-jobs, tab-payment, tab-quotes, tab-products, tab-job-detail, tab-quote-detail
- Form leggerezza: input apple-card, button main/soft
- Nessuna tabella: solo card e mini-row per mobile

### style.css
- Variabili CSS: --bg, --text, --blue, --blue2, --grayInput
- Apple-card: blur, border-radius 20px, shadow soft
- Input-apple: styling consistente, focus animation
- Button-main/soft: stati hover/active
- Tab-btn: underline style (active = blue bottom border)
- Job-card: hover effect, residuo prominente
- Mini-row: layout flex, 2 colonne (left text + right valore)
- Badge, chip, stato visivi
- Media query mobile: input font-size 16px (avoid zoom)

---

## 🔀 Cosa è stato Rimosso

### Precedenti
- ❌ Dashboard tab (KPI, chart, form transazione)
- ❌ Movimenti tab (tabella grande)
- ❌ Commesse tab (analisi filtrata)
- ❌ Anagrafiche tab (gestione CLI/FOR)
- ❌ Header grande con brand SVG
- ❌ inline onclick handlers
- ❌ Render functions disordinate (renderMovimentiTable, renderAnagrafiche, ecc)

### Nuova Struttura
- Movimenti restano nel backend (per future esigenze)
- Anagrafiche auto-generate da jobs/payments
- Chart.js pronto ma non visualizzato (posto per il futuro)
- Form transazione rimosso (non più focus)

---

## 🚀 Come Aggiornare

Se eri su v1:
1. Nuovo STORAGE_KEY → localStorage separation (v1 dati non persi)
2. Se vuoi migrare: backup in v1, import in v2 (migration auto)
3. Svuota localStorage manualmente se vuoi partire da zero

```javascript
// Se vuoi resetare:
localStorage.removeItem("bizmanagerpro_state_v2");
location.reload();
```

---

## 📊 Stato degli Obiettivi

| Requisito | v1 | v2 | Note |
|-----------|----|----|------|
| Movimenti + Commesse | ✅ | ✅ | Mantenuti, background |
| Lavori (Jobs) | ❌ | ✅ | Nuovo |
| Incassi | ❌ | ✅ | Con auto-movimento |
| Preventivi | ❌ | ✅ | Con PDF |
| Storico Prodotti | ❌ | ✅ | Con statistiche |
| Mobile-first | ⚠️ | ✅ | Completamente ripensato |
| 4 Tab Nav | ❌ | ✅ | Home, Lavori, Preventivi, Storico |
| Company Name | ✅ | ✅ | Migliorato |
| Backup/Import | ✅ | ✅ | Esteso alle nuove entità |

---

## 🐛 Bug Fixes / Improvements

- ✅ Form validation più robusto
- ✅ Nomi funzioni coerenti (render*, action*, get*)
- ✅ State normalization centralizzato in loadState()
- ✅ Niente duplicate ID (ogni entity ha ts-based ID unico)
- ✅ Ordinamento automatico (lavori per residuo, acquisti per data)

---

**Rilascio:** Dicembre 2025  
**Versione Stabile:** 2.0
