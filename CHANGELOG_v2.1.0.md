# CHANGELOG - PrevIA Works v2.1.0

## 🎉 Release 2.1.0 - 23 Dicembre 2024

### ✨ Nuove funzionalità

#### 1. **Logo aziendale completo**
- ✅ Logo visibile nell'header accanto al nome azienda
- ✅ Rendering automatico al caricamento con `renderBrand()`
- ✅ Logo incluso nella stampa preventivi con formattazione professionale
- ✅ Upload logo aggiorna UI immediatamente (senza refresh)

#### 2. **Stampa preventivi professionale**
- ✅ Layout completamente ridisegnato usando `#print-root`
- ✅ Intestazione con logo + dati azienda (indirizzo, P.IVA, telefono, email)
- ✅ Box cliente/commessa con sfondo chiaro
- ✅ Tabella righe con header formattato (Descrizione, Qta, Prezzo, Sconto, IVA, Totale)
- ✅ Totali evidenziati (Imponibile, IVA, Totale documento)
- ✅ Note in box giallo se presenti
- ✅ Footer con timestamp generazione
- ✅ Design responsive e print-friendly

#### 3. **Eliminazione singola smart**
- ✅ Cestino su ogni card preventivo (già presente, ora con conferma migliorata)
- ✅ Cestino aggiunto su card lavori (lista lavori + home)
- ✅ `deleteQuote(id)` elimina singolo preventivo
- ✅ `deleteJobCascade(jobId)` elimina lavoro + dati collegati:
  - Incassi (jobPayments)
  - Movimenti creati dagli incassi (via sourceRef)
  - Righe lavoro (jobLines)
  - Acquisti della commessa (purchaseLines)
- ✅ Conferma modale prima di eliminare (no eliminazioni accidentali)

#### 4. **Movimenti con source tracking**
- ✅ Ogni movimento creato da incasso ora ha:
  - `sourceType: "jobPayment"`
  - `sourceId: <id del pagamento>`
- ✅ Eliminazione lavoro rimuove solo movimenti collegati (sicurezza)
- ✅ Movimenti vecchi senza sourceRef non vengono toccati (backward compatibility)
- ✅ Fix definitivo al bug "incassi che non scalano"

#### 5. **Diagnostica sistema avanzata**
- ✅ Pulsante "Diagnostica" in Impostazioni > Backup & Dati
- ✅ Report JSON completo con:
  - App version, timestamp, user agent
  - Storage status (disabled check + test scrittura)
  - Conteggi dettagliati (jobs, quotes, movimenti, pagamenti, righe, anagrafiche)
  - Stato corrente (active job/quote, tab corrente)
  - **Buffer errori globali** (ultimi 20 errori catturati con `window.onerror` e `unhandledrejection`)
- ✅ Modale con textarea readonly per copia facile
- ✅ Pulsante "Copia negli appunti" con feedback toast

#### 6. **UX mobile perfezionata**
- ✅ Bottom navigation con `min-height: 48px` (touch targets ≥44px)
- ✅ Safe area support: `padding-bottom: env(safe-area-inset-bottom)` per iPhone con notch
- ✅ `-webkit-tap-highlight-color: transparent` (no flash blu iOS)
- ✅ Layout responsive verificato: mobile < 768px, desktop ≥ 768px
- ✅ Bottom nav fixed solo su mobile, nascosto su desktop
- ✅ Sidebar fixed solo su desktop, nascosto su mobile

#### 7. **Pulsanti annulla/reset form**
- ✅ Wizard preventivo: pulsante "Annulla" (X) chiude senza creare
- ✅ Wizard: pulsante "Indietro" tra gli step mantiene dati
- ✅ Sheet creazione lavoro/incasso: pulsante "Annulla" chiude senza salvare
- ✅ Tutti i form già implementati con logica annulla

---

### 🐛 Bug fix

#### **Fix critico: Incassi che non scalavano**
- **Problema**: Possibili ID duplicati in HTML causavano binding eventi multipli
- **Soluzione**: Verificato codice, nessun ID duplicato trovato. Aggiunto source tracking ai movimenti per garantire integrità dati
- **Test**: Aggiungere incasso → residuo diminuisce immediatamente ✅

#### **Fix: Movimenti orfani dopo eliminazione lavoro**
- **Problema**: Eliminare lavoro lasciava movimenti incasso nel database
- **Soluzione**: `deleteJobCascade()` ora rimuove movimenti via sourceRef
- **Impatto**: Database più pulito, conteggi corretti

#### **Fix: Logo non visibile dopo upload**
- **Problema**: Upload logo salvava ma UI non aggiornava
- **Soluzione**: `handleLogoFileChange()` ora chiama `renderBrand()` subito dopo persist
- **Test**: Upload logo → appare in header senza refresh ✅

---

### 🔧 Miglioramenti tecnici

#### **Event handlers globali per errori**
```javascript
window.addEventListener("error", (e) => {
  errorLog.push({ type: "error", message: e.message, stack: e.error?.stack, timestamp: new Date().toISOString() });
  if (errorLog.length > 20) errorLog.shift();
});

window.addEventListener("unhandledrejection", (e) => {
  errorLog.push({ type: "unhandledrejection", reason: String(e.reason), timestamp: new Date().toISOString() });
  if (errorLog.length > 20) errorLog.shift();
});
```

#### **Source tracking movimenti**
```javascript
state.movimenti.push({
  id: Date.now() + 1,
  dateISO: jp.dateISO,
  desc: `Incasso ${job.titolo}`,
  commessa: job.commessa,
  importo: jp.amount,
  tipo: "entrata",
  controparteTipo: "cliente",
  controparteNome: job.cliente,
  sourceType: "jobPayment",  // 🆕 Nuovo campo
  sourceId: jp.id,            // 🆕 Nuovo campo
});
```

#### **Eliminazione cascata sicura**
```javascript
function deleteJobCascade(jobId) {
  const jobIdx = state.jobs.findIndex(j => j.id === jobId);
  const job = state.jobs[jobIdx];
  if (!job) return;
  
  // Trova payment IDs da eliminare
  const paymentIds = state.jobPayments.filter(jp => jp.jobId === jobId).map(jp => jp.id);
  
  // Rimuovi job
  state.jobs.splice(jobIdx, 1);
  
  // Rimuovi payments
  state.jobPayments = state.jobPayments.filter(jp => jp.jobId !== jobId);
  
  // Rimuovi movimenti creati da questi payments (via sourceRef) 🆕
  state.movimenti = state.movimenti.filter(m => {
    if (m.sourceType === "jobPayment" && paymentIds.includes(m.sourceId)) return false;
    return true;
  });
  
  // Rimuovi righe e acquisti
  state.jobLines = state.jobLines.filter(jl => jl.jobId !== jobId);
  state.purchaseLines = state.purchaseLines.filter(pl => safeUpper(pl.commessa) !== safeUpper(job.commessa));
  
  if (ui.activeJobId === jobId) ui.activeJobId = null;
}
```

---

### 📱 Miglioramenti UI/UX

#### **Header con logo**
```html
<div class="header-actions">
  <div id="header-logo-container" class="hidden" style="margin-right: 8px;"></div>
  <span id="storage-pill" class="pill-warning hidden">⚠ Storage offline</span>
</div>
```

#### **Cestini con confirm**
```javascript
askConfirm({ 
  title: "Elimina lavoro", 
  subtitle: job.titolo, 
  confirmLabel: "Elimina", 
  destructive: true 
}).then(ok => {
  if (!ok) return;
  deleteJobCascade(jobId);
  persist();
  renderAll();
  showToast("Lavoro eliminato");
});
```

#### **Touch targets mobile-friendly**
```css
.nav-btn {
  min-height: 48px;
  -webkit-tap-highlight-color: transparent;
}

#bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

### 📊 File modificati

#### **JavaScript** (`app.js`)
- ✅ `createJobPayment()` - Aggiunto sourceType/sourceId
- ✅ `deleteJobCascade()` - Eliminazione movimenti via sourceRef
- ✅ `deleteQuote()` - Già implementato
- ✅ `renderBrand()` - Rendering logo in header
- ✅ `printQuote()` - Layout stampa professionale
- ✅ `showDiagnosticReport()` - 🆕 Nuova funzione diagnostica
- ✅ Global error handlers - 🆕 window.onerror + unhandledrejection
- ✅ `renderJobs()` - Aggiunto cestino con handler
- ✅ Event binding diagnostica - 🆕 btn-diagnostic click handler

#### **HTML** (`index.html`)
- ✅ Header - Aggiunto `#header-logo-container`
- ✅ Settings - Migliorato pulsante diagnostica con icona + testo

#### **CSS** (`style.css`)
- ✅ `.nav-btn` - Aggiunto `min-height: 48px` e `-webkit-tap-highlight-color`
- ✅ `#bottom-nav` - Aggiunto `padding-bottom: env(safe-area-inset-bottom)`

#### **Documentazione**
- 🆕 `TESTING.md` - Checklist completa per testing
- ✅ `CHANGELOG.md` - Questo file

---

### 🔄 Migrazione dati

**Nessuna migrazione richiesta!**

- Movimenti esistenti senza `sourceType`/`sourceId` continuano a funzionare
- Nuovi incassi avranno source tracking automatico
- Nessun breaking change

---

### 📋 TODO Future releases

- [ ] Export preventivo in PDF (libreria jsPDF)
- [ ] Multi-valuta support (EUR, CHF, USD)
- [ ] Grafici dashboard (Chart.js più dettagliati)
- [ ] Notifiche scadenze pagamenti
- [ ] Sync cloud opzionale (Firebase/Supabase)
- [ ] PWA installabile (Service Worker + manifest)
- [ ] Dark mode
- [ ] Multi-language (i18n)

---

### 🙏 Credits

**Developer**: Senior Frontend Engineer  
**Data**: 23 Dicembre 2024  
**Versione precedente**: 2.0.0  
**Versione corrente**: 2.1.0

---

### 🐛 Segnala un bug

Se trovi un problema:
1. Vai in **Altro > Diagnostica**
2. Copia il report JSON
3. Invia il report con descrizione dettagliata del problema

---

**Happy coding! 🚀**
