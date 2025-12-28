# Quick Start Guide - BizManager Pro v2

## 🚀 Avvio Veloce (2 minuti)

### 1. Apri l'app
- Apri `index.html` con il browser (Chrome, Safari, Edge consigliati)
- Accetti i permessi di localStorage (auto)

### 2. Personalizza la Ditta (opzionale ma consigliato)
- Clicca **"Ditta"** nell'header in alto a destra
- Scrivi il nome della tua azienda (apparirà nei preventivi PDF)
- OK → salvato ✅

### 3. Crea il Primo Lavoro
1. Home → Pulsante **"Nuovo Lavoro"** (primo pulsante blu)
2. Compila:
   - **Titolo**: "Impianto elettrico ospedale" (es)
   - **Cliente**: "Rossi Costruzioni"
   - **Commessa**: "CANTIERE_A" (o nome progetto)
   - **Totale concordato**: 50000
3. Premi **"Crea Lavoro"**
4. ✅ Torna a Home → vedi il lavoro in "Lavori Aperti"

### 4. Registra un Incasso
1. Home → Pulsante **"Registra Incasso"** (secondo pulsante verde)
2. Compila:
   - **Importo**: 10000
   - **Metodo**: bonifico (o contanti, assegno, ecc)
3. Premi **"Registra Incasso"**
4. ✅ Il residuo del lavoro passa da 50000 → 40000 automaticamente
   - Crea movimento "entrata" dietro le quinte
   - Se residuo diventa ≤ 0 → job si chiude auto (✅ Chiuso)

### 5. Crea un Preventivo
1. Home → Pulsante **"Nuovo Preventivo"** (terzo pulsante viola)
2. Compila:
   - **Cliente**: "Verdi Srl"
   - **Commessa**: "CANTIERE_B"
3. Premi **"Crea Preventivo"**
4. Aggiungi righe:
   - Descrizione: "Scavo manuale"
   - Qty: 10 (ore, giorni, pezzi)
   - Prezzo: 50 (al pezzo/ora)
   - Sconto %: 0
   - IVA %: 22 (default OK)
   - Premi **"Aggiungi Riga"**
5. Ripeti per altre righe (tetto, impianto, ecc)
6. **Calcolo automatico**: vedi Imponibile, IVA, Totale
7. Opzioni:
   - **Stampa**: apre finestra print (Ctrl+P → stampa/PDF)
   - **Conferma Lavoro**: converte il preventivo in un Job (agreedTotal = totale preventivo)

### 6. Visualizza Storico Prodotti
1. Home → Tab **"Storico Prodotti"** (4° tab)
2. Filtri (opzionali):
   - Fornitore: "Dini Batterie"
   - Anno: 2025
3. Premi **"Cerca Prodotti"**
4. Vedi:
   - **Per ogni prodotto**: Min/Media/Max/Ultimo prezzo + qty totale
   - **Elenco acquisti**: data, fornitore, qty, prezzo unitario

---

## 📋 Task Comuni

### Come vedare i dettagli di un Lavoro?
1. Home → Clicca su una card in "Lavori Aperti"
2. Si apre il dettaglio con:
   - **Incassi**: elenco pagamenti ricevuti + form per aggiungerne uno nuovo
   - **Acquisti**: lis acquisti per questa commessa
   - **Note**: testo libero (es. "Cliente ha richiesto variante")

### Come cambiare il nome della ditta?
- Header → "Ditta" → scrivi nuovo nome → OK

### Come fare backup?
- Header → "Backup" → scarica JSON con data/ora

### Come importare backup precedente?
- Header → "Import" → seleziona file JSON scaricato
- **Avvertenza**: sovrascrive TUTTI i dati attuali
- Confirma → importato ✅

### Come inserire un nuovo pagamento per un lavoro?
1. Apri dettaglio lavoro
2. Tab "Incassi" → compila Importo + Metodo
3. **"Aggiungi Incasso"**
4. Automaticamente:
   - Residuo si riduce
   - Se residuo ≤ 0 → job chiuso
   - Movimento entrata creato

### Come cercare acquisti di un fornitore?
1. Tab "Storico Prodotti"
2. Compila Fornitore: "Enel" (es)
3. Premi "Cerca Prodotti"
4. Vedi: min/max/media prezzo per quel fornitore + ultimi acquisti

---

## 🔑 Pulsanti Principale

| Pulsante | Dove | Cosa Fa |
|----------|------|---------|
| 📌 Nuovo Lavoro | Home | → Tab Lavori, form nuovo job |
| 💳 Registra Incasso | Home | → Tab Pagamento, registra payment |
| 📄 Nuovo Preventivo | Home | → Tab Preventivi, form nuovo quote |
| 📝 Ditta (header) | Ovunque | Personalizza nome aziendale |
| 💾 Backup (header) | Ovunque | Scarica JSON |
| 📂 Import (header) | Ovunque | Carica JSON backup |
| Tap card lavoro | Home | Apre dettaglio job |
| Stampa | Preventivo | window.print() → PDF |
| Conferma Lavoro | Preventivo | Converte quote → Job |

---

## 💾 Dati (dove stanno?)

Tutti i dati sono salvati nel **browser** (localStorage):
- Lavori, Incassi, Preventivi, Acquisti
- Se cancelli localStorage → dati persi
- **Backup regolarmente!**

```javascript
// Se apri dev tools (F12 → Application → Local Storage)
// Vedi chiave: "bizmanagerpro_state_v2"
// È un JSON gigante con tutto lo state
```

---

## ⚡ Scorciatoie Tastiera

- **Enter** in form → invia (dove supportato)
- **Ctrl+P** o **Cmd+P** → stampa (nelle pagine print-ready)

---

## 🎨 Design

- **Mobile-first**: ottimizzato per smartphone
- **Apple-style**: card con blur, input arrotondati, colori chiari
- **Fast**: niente server, tutto locale
- **No ads, no tracker**: solo i tuoi dati

---

## ⚠️ Limitazioni Attuali

- ❌ Niente sincronizzazione cloud (salvati solo in browser)
- ❌ Niente integrazione bancaria
- ❌ Niente foto/allegati
- ❌ Niente account/login (single-user)

---

## 🆘 Aiuto

### "Ho perso i dati!"
- Controlla localStorage: F12 → Application → Local Storage
- Se c'è backup JSON precedente → Import
- Altrimenti → partisci da capo (copia dati da email/note)

### "Preventivo non stampa bene"
- Prova: apri Stampa → aumenta margini → salva PDF
- Se sempre brutto → contatta sviluppatore

### "Non mi crea il lavoro"
- Verifica: Titolo, Cliente, Commessa TUTTI compilati
- Totale deve essere numero positivo
- F12 → Console → vedi errori rossi?

### "Incasso non registra"
- Devi avere almeno 1 lavoro aperto
- Importo deve essere numero > 0
- Se residuo diventa 0 → job si chiude (è corretto!)

---

## 📞 Feature Requests / Bug Report

Se trovi bug o vuoi suggerire feature:
1. Screenshot + descrizione
2. Passo-passo per riproducilo
3. Browser + versione OS
4. Contatta sviluppatore

---

**Goditi BizManager Pro! 🚀**  
*Per edili e elettricisti che non hanno tempo per complicazioni.*
