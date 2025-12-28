# TESTING CHECKLIST - PrevIA Works

## ✅ FIX IMPLEMENTATE

### 1. **Incassi che non scalavano (ID duplicati)** ✅
- **Status**: VERIFICATO - Nessun ID duplicato trovato nel codice
- **Test**: 
  1. Apri dettaglio lavoro
  2. Aggiungi incasso di 5000€
  3. Verifica che "Incassato" aumenti immediatamente
  4. Verifica che "Residuo" diminuisca
  5. Controlla che la riga incasso appaia nella lista

### 2. **Logo visibile in header + stampa** ✅
- **Implementato**:
  - Contenitore `#header-logo-container` nell'header
  - Funzione `renderBrand()` aggiornata per mostrare logo se presente
  - Upload logo chiama `renderBrand()` subito dopo salvataggio
  - Stampa preventivo include logo ben formattato
- **Test**:
  1. Vai in Impostazioni > Dati azienda
  2. Clicca "Logo" e carica un'immagine
  3. **EXPECTED**: Logo appare immediatamente nell'header (senza refresh)
  4. Crea un preventivo e clicca "Stampa"
  5. **EXPECTED**: Logo appare in alto nella stampa

### 3. **Stampa preventivo professionale** ✅
- **Implementato**:
  - Layout completamente ridisegnato in `printQuote()`
  - Usa `#print-root` come area stampabile
  - Intestazione con logo + dati azienda
  - Box cliente/commessa con sfondo
  - Tabella con header e righe formattate
  - Totali evidenziati
  - Note in box colorato
  - Footer con timestamp
- **Test**:
  1. Apri un preventivo esistente
  2. Clicca "Stampa" (icona stampante)
  3. **EXPECTED**: Anteprima stampa mostra documento pulito, professionale
  4. Verifica: logo, cliente, commessa, tabella, totali, note

### 4. **Eliminazione singola preventivi/lavori** ✅
- **Implementato**:
  - Cestino su card preventivi (già esistente, migliorato)
  - Cestino aggiunto su card lavori (lista + home)
  - `deleteQuote(id)` rimuove singolo preventivo
  - `deleteJobCascade(jobId)` rimuove lavoro + incassi + acquisti + movimenti
  - Conferma prima dell'eliminazione
- **Test Preventivo**:
  1. Vai in "Preventivi"
  2. Clicca cestino su una card preventivo
  3. Conferma eliminazione
  4. **EXPECTED**: Solo quel preventivo viene eliminato, altri rimangono
  
- **Test Lavoro**:
  1. Vai in "Lavori" o "Home"
  2. Clicca cestino su card lavoro
  3. Conferma eliminazione
  4. **EXPECTED**: Lavoro eliminato + incassi + acquisti collegati rimossi
  5. Altri lavori non toccati

### 5. **Movimenti con sourceRef** ✅
- **Implementato**:
  - `createJobPayment()` ora aggiunge `sourceType: "jobPayment"` e `sourceId` ai movimenti
  - `deleteJobCascade()` cancella movimenti con `sourceType === "jobPayment"` e `sourceId` nel set dei payment eliminati
  - Movimenti vecchi senza sourceRef non vengono toccati (sicurezza)
- **Test**:
  1. Crea nuovo lavoro
  2. Aggiungi incasso di 1000€
  3. Controlla stato (job.id memorizzato)
  4. Elimina il lavoro
  5. **EXPECTED**: Movimento incasso viene eliminato
  6. Movimenti di altri lavori NON toccati

### 6. **Pulsante Diagnostica** ✅
- **Implementato**:
  - Bottone "Diagnostica" in Impostazioni > Backup & Dati
  - Funzione `showDiagnosticReport()` genera report completo JSON
  - Report include:
    - appVersion, timestamp, userAgent
    - storage status (disabled, test write)
    - conteggi (jobs, quotes, movimenti, pagamenti, righe, clienti, fornitori)
    - stato corrente (activeJobId, activeQuoteId, activeTab)
    - buffer errori (ultimi 20 errori catturati con window.onerror e unhandledrejection)
  - Sheet modale con textarea e pulsante "Copia"
- **Test**:
  1. Vai in "Altro" (Impostazioni)
  2. Clicca "Diagnostica"
  3. **EXPECTED**: Modale con report JSON dettagliato
  4. Clicca "Copia"
  5. **EXPECTED**: Report copiato negli appunti
  6. Se storage bloccato, report evidenzia `"disabled": true`

### 7. **UX Mobile migliorata** ✅
- **Implementato**:
  - Bottom nav: `position: fixed` via CSS Grid
  - Touch targets: `min-height: 48px` per `.nav-btn`
  - Safe area: `padding-bottom: env(safe-area-inset-bottom)` per notch iPhone
  - `-webkit-tap-highlight-color: transparent` per rimuovere flash blu iOS
  - Layout responsive perfetto: mobile < 768px, desktop >= 768px
- **Test Mobile** (Chrome DevTools - iPhone 12 Pro: 390x844):
  1. Apri DevTools > Device Toolbar > iPhone 12 Pro
  2. **EXPECTED**: Bottom nav sempre visibile in basso, fixed
  3. Tocca ogni tab (Home, Lavori, Preventivi, Storico, Altro)
  4. **EXPECTED**: Touch facile, nessun flash blu, transizione smooth
  5. Scroll content
  6. **EXPECTED**: Bottom nav rimane fixed, non galleggia

- **Test Desktop** (>= 768px):
  1. Ridimensiona finestra > 768px
  2. **EXPECTED**: Bottom nav nascosta, sidebar visibile a sinistra

### 8. **Pulsante Reset Form / Annulla** ✅
- **Implementato**:
  - Wizard preventivo: bottone "Annulla" (`btn-cancel-wizard`) chiude wizard senza creare preventivo
  - Step wizard: bottone "Indietro" torna allo step precedente
  - Sheet creazione lavoro/incasso: bottone "Annulla" (secondario) chiude sheet senza salvare
  - Sheet già implementato con due pulsanti: primario (Salva) e secondario (Annulla)
- **Test**:
  1. Apri wizard "Nuovo preventivo"
  2. Inserisci cliente, vai a step 2
  3. Clicca "Indietro"
  4. **EXPECTED**: Torna a step 1, dati cliente mantenuti
  5. Clicca "X" (Annulla)
  6. **EXPECTED**: Wizard si chiude, nessun preventivo creato
  
  7. Clicca "Nuovo lavoro"
  8. Compila campi
  9. Clicca "Annulla"
  10. **EXPECTED**: Sheet si chiude, nessun lavoro creato

---

## 🧪 TEST COMPLETO END-TO-END

### Scenario 1: Flusso completo lavoro con logo
1. Carica logo aziendale → Verifica appare in header
2. Crea nuovo lavoro (Cliente: "Rossi", Commessa: "CANTIERE_A", Totale: 10000€)
3. Apri dettaglio lavoro
4. Aggiungi incasso 5000€ → Verifica Residuo = 5000€, Incassato = 5000€
5. Aggiungi acquisto (Fornitore: "ElettroShop", Prodotto: "Cavo 10mm", Qty: 50, Prezzo: 2€)
6. Vai in Storico → Cerca "Cavo" → Verifica acquisto presente
7. Torna a lavoro, elimina con cestino
8. **EXPECTED**: Lavoro + incasso + acquisto + movimento eliminati

### Scenario 2: Preventivo + Stampa
1. Crea preventivo (Cliente: "Bianchi", Commessa: "VILLA_B")
2. Aggiungi 3 righe con prezzi, IVA, sconti
3. Clicca "Stampa"
4. **EXPECTED**: Documento professionale con logo, tabella, totali corretti
5. Duplica preventivo → Verifica nuovo preventivo creato
6. Elimina preventivo duplicato con cestino
7. **EXPECTED**: Solo duplicato eliminato, originale rimane

### Scenario 3: Diagnostica con errore
1. Apri console browser (F12)
2. Inserisci errore forzato: `throw new Error("Test errore")`
3. Vai in Diagnostica
4. **EXPECTED**: Report mostra errore nel campo `errors`
5. Copia report e verifica conteggi (jobs, quotes, movimenti)

---

## 🐛 EDGE CASES DA TESTARE

1. **Storage bloccato**:
   - Apri in incognito con blocco localStorage
   - **EXPECTED**: Pill "⚠ Storage offline" visibile, diagnostica indica `disabled: true`

2. **Preventivo vuoto**:
   - Crea preventivo senza righe
   - Stampa
   - **EXPECTED**: Documento valido con totali a 0€

3. **Eliminazione multipla rapida**:
   - Crea 3 lavori
   - Elimina tutti e 3 velocemente
   - **EXPECTED**: Tutti eliminati, nessun errore console

4. **Logo grande**:
   - Carica immagine 4000x3000px
   - **EXPECTED**: Logo ridimensionato automaticamente in header e stampa

5. **Mobile landscape**:
   - Ruota dispositivo in landscape
   - **EXPECTED**: Bottom nav ancora visibile e accessibile

---

## 📱 BROWSERS DA TESTARE

- ✅ Chrome Desktop (Windows/Mac)
- ✅ Firefox Desktop
- ✅ Safari Desktop (Mac)
- ✅ Chrome Mobile (Android)
- ✅ Safari Mobile (iOS)
- ✅ Edge Desktop

---

## 🎯 METRICHE DI SUCCESSO

- [ ] Incassi aggiornano residuo in tempo reale
- [ ] Logo visibile in header e stampa senza refresh
- [ ] Stampa preventivo look professionale
- [ ] Cestino elimina singolo item, non tutto
- [ ] Diagnostica genera report completo copiabile
- [ ] Bottom nav fixed su mobile, touch ≥44px
- [ ] Nessun errore console
- [ ] Responsive fluido 320px - 1920px

---

## 🚀 DEPLOYMENT CHECKLIST

Prima di andare in produzione:

1. [ ] Test completo su tutti i browsers
2. [ ] Test mobile reale (non solo emulatore)
3. [ ] Test con storage bloccato
4. [ ] Test stampa PDF (non solo preview)
5. [ ] Backup database esistente
6. [ ] Verifica performance (Lighthouse score > 90)
7. [ ] Test accessibility (VoiceOver, screen reader)

---

**Data implementazione**: 23 Dicembre 2024
**Versione**: 2.1.0
**Developer**: Senior Frontend Engineer
