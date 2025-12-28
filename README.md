# BizManager Pro v2 - Documentazione Completa

## 📱 Panoramica

BizManager Pro è un'app **mobile-first** per **edili e elettricisti** che traccia:
- **Lavori** (Jobs): progetti con importo, residuo, stato
- **Incassi**: pagamenti dei clienti con auto-creazione di movimenti contabili
- **Preventivi**: quote con righe (qty, prezzo, sconto, IVA) e export PDF
- **Storico Prodotti**: tracciamento acquisti con statistiche (min/max/media/ultimo prezzo)
- **Movimenti Contabili**: base per l'analisi finanziaria

---

## 🎯 4 Tab Principali

### 1. **Home**
- 3 pulsanti grandi: "Nuovo Lavoro", "Registra Incasso", "Nuovo Preventivo"
- Lista **Lavori Aperti** ordinati per **Residuo Decrescente**
- Ogni card mostra: Titolo, Cliente, Commessa, Residuo (evidenziato), Incassato, Totale
- Tap su una card → apre dettaglio lavoro

### 2. **Lavori**
- Form per creare nuovo lavoro: Titolo, Cliente, Commessa, Totale Concordato
- Crea il lavoro e auto-aggiunge cliente alle anagrafiche

### 3. **Preventivi**
- Form per creare preventivo: Cliente, Commessa
- Aggiungi righe: Descrizione, Qty, Prezzo Unitario, Sconto %, IVA %
- Calcolo automatico: Imponibile → IVA → Totale
- Pulsanti:
  - **Stampa**: genera HTML stampabile via window.print()
  - **Conferma Lavoro**: converte il preventivo in un Lavoro (agreedTotal = totale preventivo)
- Nome ditta appare nel PDF

### 4. **Storico Prodotti**
- Filtri: Fornitore (opzionale), Anno (opzionale)
- Risultati raggruppati per prodotto con statistiche:
  - Min prezzo, Media, Max prezzo, Ultimo prezzo
  - Quantità totale acquistata
  - Ultimi acquisti in ordine cronologico inverso

---

## 🏷️ Entità Principali

### **Job** (Lavoro)
```javascript
{
  id: number,
  titolo: string,          // "Impianto Ospeda le"
  commessa: string,        // "CANTIERE_A"
  cliente: string,         // "Rossi Srl"
  agreedTotal: number,     // Totale concordato
  stato: "aperto" | "chiuso",
  note: string,
  createdISO: string       // Data ISO creazione
}
```

### **JobPayment** (Incasso)
```javascript
{
  id: number,
  jobId: number,           // Colleamento a Job
  dateISO: string,
  amount: number,          // Importo incassato
  method: string,          // "bonifico", "contanti", ecc
  note: string
}
```

**Comportamento automatico:**
- Ogni JobPayment crea automaticamente un Movimento di tipo "entrata"
- Movimento ha: desc, commessa, importo, tipo="entrata", controparteNome=cliente, controparteTipo="cliente"
- Se `residuo = agreedTotal - paid <= 0` → Job passa a "chiuso" ✅

### **PurchaseLine** (Acquisto)
```javascript
{
  id: number,
  dateISO: string,
  fornitore: string,       // Nome fornitore
  prodotto: string,        // "Cemento classe 30"
  qty: number,             // Quantità
  unitPrice: number,       // Prezzo unitario
  commessa: string,        // "CANTIERE_A"
  note: string
}
```

### **Quote** (Preventivo)
```javascript
{
  id: number,
  cliente: string,
  commessa: string,
  righe: [
    {
      desc: string,        // "Lavoro scavo"
      qty: number,
      unitPrice: number,
      sconto: number,      // % sconto
      iva: number          // % IVA (default 22)
    }
  ],
  createdISO: string,
  stato: "bozza" | "confermato"
}
```

---

## 🔄 Flussi Principali

### Flusso 1: Creare un Lavoro
1. Home → "Nuovo Lavoro" → Tab Lavori
2. Compila: Titolo, Cliente, Commessa, Totale
3. Premi "Crea Lavoro"
4. Cliente aggiunto automaticamente alle anagrafiche
5. Torna a Home, il lavoro appare in "Lavori Aperti"

### Flusso 2: Registrare un Incasso
1. Home → "Registra Incasso" (se ci sono lavori aperti)
2. Compila: Importo, Metodo
3. Premi "Registra Incasso"
4. **Automaticamente:**
   - JobPayment creato
   - Movimento "entrata" creato
   - Job aggiornato (residuo diminuisce)
   - Se residuo ≤ 0 → Job passa a "chiuso"
5. Torna a Home, residuo aggiornato

### Flusso 3: Creare un Preventivo
1. Home → "Nuovo Preventivo" → Tab Preventivi
2. Compila: Cliente, Commessa
3. Aggiungi righe (desc, qty, prezzo, sconto, IVA)
4. Visualizzi: Imponibile, IVA, Totale in tempo reale
5. Opzioni:
   - **Stampa**: genera PDF con intestazione (nome ditta)
   - **Conferma Lavoro**: crea un Job con agreedTotal = totale preventivo, marca preventivo come "confermato"

### Flusso 4: Tracciare Storico Prodotto
1. Home → Tab "Storico Prodotti"
2. Filtri (opzionali): Fornitore, Anno
3. Premi "Cerca Prodotti"
4. Risultati raggruppati per prodotto + statistiche
5. Ultime acquisizioni visibili sotto ogni prodotto

---

## 💾 Persistenza & Storage

### Storage Key
```
bizmanagerpro_state_v2
```

### AppState Structure
```javascript
{
  version: 2,
  companyName: string,
  saldoIniziale: number,
  lastSyncISO: string | null,
  movimenti: Movimento[],
  anagrafiche: { clienti: [], fornitori: [] },
  jobs: Job[],
  jobPayments: JobPayment[],
  purchaseLines: PurchaseLine[],
  quotes: Quote[]
}
```

### Funzioni di Persistenza
- **saveState()**: salva state corrente in localStorage
- **loadState()**: carica da localStorage, normalizza (v1 → v2 migration)
- **defaultState()**: ritorna state vuoto se localStorage è vuoto
- **downloadBackup()**: scarica JSON con timestamp
- **importBackupFromFile()**: carica file JSON, chiede conferma, sovrascrive state

---

## 🎨 Stile & UX

### Design Tokens
- **Apple Card**: sfondo bianco con blur, border grigio chiaro, shadow soft
- **Input Apple**: background grigio, border blu al focus, padding 12px
- **Button Main**: blu (#007AFF), white text, border-radius 12px
- **Chip**: small badge per tag e stati
- **Mini-row**: riga flessibile grigio chiaro con iconografia

### Mobile-First
- Header staccionato top con chip company-name
- Nav 4 tab orizzontale scrollabile
- Main con max-width e padding safe-area
- Card responsive: 1 colonna mobile, più colonne desktop
- Form input sempre full-width con label integrato

### Colori
- **Blue**: #007AFF (azioni, focus, residuo)
- **Green**: #10B981 (entrate, incassati)
- **Red**: #EF4444 (uscite, errori)
- **Orange**: #F97316 (stato "aperto")
- **Gray**: varie tonalità per UI

---

## 📝 Funzioni Chiave (app.js)

### Jobs
- `getJobPaid(jobId)`: somma di tutte le JobPayment per quel job
- `getJobDue(jobId)`: residuo = agreedTotal - paid
- `createJob()`: crea job e aggiunge cliente alle anagrafiche
- `createJobPayment()`: crea payment, movimento auto, auto-close se residuo ≤ 0
- `updateJobNote()`: aggiorna note di un job

### Quotes
- `createQuote()`: crea preventivo vuoto
- `addQuoteRiga()`: aggiunge una riga al preventivo
- `getQuoteCalc()`: calcola { imponibile, totaleIVA, totale }
- `confirmQuoteAsJob()`: converte preventivo in Job, marca come "confermato"
- `printQuote()`: apre window.print() con HTML template

### Product History
- `getProductHistory(filters)`: ritorna PurchaseLines filtrati (fornitore, anno)
- `getProductStats(prodotto)`: calcola { minPrice, avgPrice, maxPrice, lastPrice, qty, count }

### Rendering
- `renderHomeJobs()`: lista lavori aperti ordinati per residuo DESC
- `renderJobDetail()`: dettaglio job con tab Incassi/Acquisti/Note
- `renderJobPaymentsTab()`: lista incassi
- `renderJobPurchasesTab()`: lista acquisti per la commessa del job
- `renderQuoteDetail()`: mostra righe e totali in tempo reale
- `renderProductHistory()`: mostra prodotti con statistiche

### Utilities
- `persistAndRenderAll()`: normalizza, salva, re-rende tutti i componenti
- `setTab(tabId)`: cambia tab (nasconde altri, mostra selezionato)
- `escapeHTML()`: sanitizza output per evitare XSS

---

## 🔐 Validazioni

### Form
- Titolo/Cliente/Commessa non vuoti
- Importi numerici positivi
- Quantità non zero

### Business Logic
- Job deve avere titolo, cliente, agreedTotal
- JobPayment deve avere jobId e amount > 0
- Quote righe non possono essere vuote
- PurchaseLine deve avere prodotto, fornitore, unitPrice

### Auto-Close
- Job passa a "chiuso" quando `residuo <= 0`

---

## 🚀 Come Usare

### Prima Volta
1. Apri index.html
2. Clicca su "Ditta" (header) → imposta nome aziendale
3. Home → "Nuovo Lavoro" → crea un progetto test
4. Home → "Registra Incasso" → registra un pagamento
5. Vedi il residuo aggiornato, job in lista

### Backup
- Header → Backup: scarica JSON con timestamp
- Header → Import: seleziona JSON salvato precedentemente
- Sovrascrive tutto lo state

### Stampare Preventivo
1. Vai a Preventivi → crea preventivo con righe
2. Premi "Stampa"
3. Si apre finestra print (Ctrl+P o Cmd+P per stampare)
4. PDF contiene nome aziendale, cliente, commessa, righe, totali

---

## 🐛 Troubleshooting

### Dati non salvati
- Controlla localStorage: F12 → Application → Local Storage
- Key: `bizmanagerpro_state_v2`
- Se vuoto, app è in defaultState

### Job non passa a chiuso
- Verifica: residuo = agreedTotal - (sum di JobPayment)
- Calcolo avviene al momento di createJobPayment

### Preventivo non stampa bene
- Browser dev tools: ispeziona HTML generato
- Assicurati che window.print() non sia bloccato da popup blocker

### Importa non funziona
- File deve essere JSON valido con struttura: `{ state: { ... } }`
- Uso: downloadBackup() per generare file corretto

---

## 📌 Checklist Implementazione

✅ State v2 con jobs, jobPayments, purchaseLines, quotes  
✅ Migrazioni v1 → v2 in loadState()  
✅ Rendering liste lavori aperti, ordinati per residuo  
✅ Dettaglio lavoro con tab Incassi/Acquisti/Note  
✅ Registrazione incassi con auto-movimento  
✅ Auto-close lavori quando residuo ≤ 0  
✅ Preventivi con calcolo IVA automatico  
✅ Conferma preventivo → Job  
✅ Print/PDF preventivo con nome ditta  
✅ Storico prodotti con filtri e statistiche  
✅ Tab navigation 4 principali (Home, Lavori, Preventivi, Storico)  
✅ Mobile-first design  
✅ Backup/Import JSON  
✅ Backup/Import funzionanti  

---

## 💡 Prossimi Sviluppi (Opzionali)

- Timeline eventi per job (pagamenti, note aggiunte)
- Foto allegati a lavori
- Integrazione bancaria (API)
- Sincronizzazione cloud
- Report mensuali/annuali
- Gestione pagamenti ricorrenti
- Calcolo marginalità per progetto
- Export Excel/CSV

---

**Versione:** 2.0  
**Ultimo aggiornamento:** Dicembre 2025  
**Developed for:** Imprenditori edili/elettricisti che vogliono semplicità & velocità 🔨⚡
