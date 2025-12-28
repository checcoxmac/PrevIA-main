"use strict";

// ---------------------------------------------------------------------------
// CONFIG & UTILITIES
// ---------------------------------------------------------------------------
const APP_VERSION = "2.0.0";
const STORAGE_KEY = "previa_works_state_v2";
const formatMoney = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const $ = (sel) => document.querySelector(sel);

// Safe storage wrapper (fallback to RAM)
const memoryStore = {};
let storageDisabled = false;
let storageDisabledReason = "";
const errorLog = []; // Buffer errori per diagnostica
const safeStorage = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch (err) { storageDisabled = true; storageDisabledReason = err?.message || "localStorage unavailable"; return memoryStore[key] ?? null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { storageDisabled = true; storageDisabledReason = err?.message || "localStorage unavailable"; memoryStore[key] = value; }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); } catch (err) { storageDisabled = true; storageDisabledReason = err?.message || "localStorage unavailable"; delete memoryStore[key]; }
  }
};

// Global error handlers per diagnostica
window.addEventListener("error", (e) => {
  errorLog.push({ type: "error", message: e.message, stack: e.error?.stack, timestamp: new Date().toISOString() });
  if (errorLog.length > 20) errorLog.shift();
});
window.addEventListener("unhandledrejection", (e) => {
  errorLog.push({ type: "unhandledrejection", reason: String(e.reason), timestamp: new Date().toISOString() });
  if (errorLog.length > 20) errorLog.shift();
});

function nowISO() { return new Date().toISOString(); }
function toISODateOnly(d = new Date()) { const t = new Date(d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; }
function safeUpper(v) { return String(v ?? "").trim().toUpperCase(); }
function safeTrim(v) { return String(v ?? "").trim(); }
function parseImporto(v) { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; }
function parseItalianFloat(v) { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function localeSortIT(a, b) { return a.localeCompare(b, "it", { sensitivity: "base" }); }
function uniq(arr) { return Array.from(new Set(arr)); }
function fmtShortDate(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("it-IT"); }
function fmtDayMonth(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }); }
function escapeHTML(str) { return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
function defaultState() {
  return {
    version: 2,
    companyName: "La tua ditta",
    companyLogoDataUrl: null,
    companyInfo: { address: "", piva: "", phone: "", email: "" },
    quoteCounter: 1,
    selectedQuoteId: null,
    saldoIniziale: 0,
    lastSyncISO: null,
    movimenti: [],
    anagrafiche: { clienti: [], fornitori: [] },
    jobs: [],
    jobPayments: [],
    jobLines: [],
    purchaseLines: [],
    quotes: [],
  };
}

function loadState() {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);

    const st = {
      version: 2,
      companyName: safeTrim(parsed.companyName || "La tua ditta") || "La tua ditta",
      companyLogoDataUrl: parsed.companyLogoDataUrl || null,
      companyInfo: {
        address: safeTrim(parsed.companyInfo?.address || ""),
        piva: safeTrim(parsed.companyInfo?.piva || ""),
        phone: safeTrim(parsed.companyInfo?.phone || ""),
        email: safeTrim(parsed.companyInfo?.email || ""),
      },
      quoteCounter: Number(parsed.quoteCounter) || 1,
      selectedQuoteId: Number(parsed.selectedQuoteId) || null,
      saldoIniziale: Number(parsed.saldoIniziale) || 0,
      lastSyncISO: parsed.lastSyncISO || null,
      movimenti: Array.isArray(parsed.movimenti) ? parsed.movimenti : [],
      anagrafiche: {
        clienti: Array.isArray(parsed.anagrafiche?.clienti) ? parsed.anagrafiche.clienti : [],
        fornitori: Array.isArray(parsed.anagrafiche?.fornitori) ? parsed.anagrafiche.fornitori : [],
      },
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      jobPayments: Array.isArray(parsed.jobPayments) ? parsed.jobPayments : [],
      jobLines: Array.isArray(parsed.jobLines) ? parsed.jobLines : [],
      purchaseLines: Array.isArray(parsed.purchaseLines) ? parsed.purchaseLines : [],
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
    };

    st.movimenti = st.movimenti
      .map(m => ({
        id: Number(m.id) || Date.now(),
        dateISO: m.dateISO ? String(m.dateISO) : nowISO(),
        desc: safeTrim(m.desc),
        commessa: safeUpper(m.commessa),
        importo: Number(m.importo) || 0,
        tipo: m.tipo === "uscita" ? "uscita" : "entrata",
        controparteTipo: ["cliente", "fornitore", "altro"].includes(m.controparteTipo) ? m.controparteTipo : "cliente",
        controparteNome: safeTrim(m.controparteNome),
      }))
      .filter(m => m.desc && Number.isFinite(m.importo) && m.importo >= 0);

    st.anagrafiche.clienti = uniq(st.anagrafiche.clienti.map(safeTrim).filter(Boolean)).sort(localeSortIT);
    st.anagrafiche.fornitori = uniq(st.anagrafiche.fornitori.map(safeTrim).filter(Boolean)).sort(localeSortIT);

    st.jobs = st.jobs.map(j => ({
      id: Number(j.id) || Date.now(),
      titolo: safeTrim(j.titolo),
      commessa: safeUpper(j.commessa),
      cliente: safeTrim(j.cliente),
      agreedTotal: Number(j.agreedTotal) || 0,
      stato: ["aperto", "chiuso", "archived"].includes(j.stato) ? j.stato : "aperto",
      note: safeTrim(j.note),
      createdISO: j.createdISO ? String(j.createdISO) : nowISO(),
    })).filter(j => j.titolo && j.cliente && Number.isFinite(j.agreedTotal));

    st.jobPayments = st.jobPayments.map(jp => ({
      id: Number(jp.id) || Date.now(),
      jobId: Number(jp.jobId) || 0,
      dateISO: jp.dateISO ? String(jp.dateISO) : nowISO(),
      amount: Number(jp.amount) || 0,
      method: safeTrim(jp.method) || "bonifico",
      note: safeTrim(jp.note),
    })).filter(jp => jp.jobId && jp.amount > 0);

    st.jobLines = st.jobLines.map(jl => ({
      id: Number(jl.id) || Date.now(),
      jobId: Number(jl.jobId) || 0,
      kind: jl.kind === "lavorazione" ? "lavorazione" : "materiale",
      desc: safeTrim(jl.desc),
      qty: Number(jl.qty) || 1,
      unit: safeTrim(jl.unit) || "pz",
      unitPrice: Number(jl.unitPrice) || 0,
      note: safeTrim(jl.note),
      done: Boolean(jl.done),
      createdISO: jl.createdISO ? String(jl.createdISO) : nowISO(),
    })).filter(jl => jl.jobId && jl.desc);

    st.purchaseLines = st.purchaseLines.map(pl => ({
      id: Number(pl.id) || Date.now(),
      dateISO: pl.dateISO ? String(pl.dateISO) : nowISO(),
      fornitore: safeTrim(pl.fornitore),
      prodotto: safeTrim(pl.prodotto),
      qty: Number(pl.qty) || 1,
      unit: safeTrim(pl.unit) || "pz",
      unitPrice: Number(pl.unitPrice) || 0,
      commessa: safeUpper(pl.commessa),
      note: safeTrim(pl.note),
    })).filter(pl => pl.prodotto && pl.fornitore && Number.isFinite(pl.unitPrice));

    st.quotes = st.quotes.map(q => {
      const righe = Array.isArray(q.righe) ? q.righe.map(r => ({
        desc: safeTrim(r.desc),
        qty: parseItalianFloat(r.qty || 1),
        unitPrice: parseItalianFloat(r.unitPrice || 0),
        sconto: parseItalianFloat(r.sconto || 0),
        iva: parseItalianFloat(r.iva || 22),
      })) : [];

      const calc = righe.reduce((acc, r) => {
        const sub = r.qty * r.unitPrice * (1 - r.sconto / 100);
        acc.taxable += sub;
        acc.vat += sub * (r.iva / 100);
        return acc;
      }, { taxable: 0, vat: 0 });
      const totals = q.totals || {};

      return {
        id: Number(q.id) || Date.now(),
        number: Number(q.number) || 0,
        dateISO: q.dateISO ? String(q.dateISO) : nowISO(),
        cliente: safeTrim(q.cliente),
        commessa: safeUpper(q.commessa),
        status: q.status === "locked" || q.stato === "confermato" ? "locked" : "draft",
        notes: safeTrim(q.notes || q.note || ""),
        righe,
        totals: {
          taxable: Number(totals.taxable) || Math.round(calc.taxable * 100) / 100,
          vat: Number(totals.vat) || Math.round(calc.vat * 100) / 100,
          total: Number(totals.total) || Math.round((calc.taxable + calc.vat) * 100) / 100,
        },
      };
    }).filter(q => q.cliente && q.commessa);

    return st;
  } catch {
    return defaultState();
  }
}

let state = loadState();
let chart = null;
const ui = {
  activeTab: "home",
  jobFilter: "open",
  jobSearch: "",
  jobDetailTab: "incassi",
  activeJobId: null,
  quoteWizardStep: 1,
  wizardCliente: "",
  activeQuoteId: state.selectedQuoteId || state.quotes[0]?.id || null,
};

function saveState() {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persist() {
  saveState();
  renderStorageWarning();
}

// ---------------------------------------------------------------------------
// DOMAIN LOGIC
// ---------------------------------------------------------------------------
function upsertAnagrafica(tipo, nome) {
  const n = safeTrim(nome);
  if (!n) return;
  if (tipo === "cliente") state.anagrafiche.clienti = uniq([...state.anagrafiche.clienti, n]).sort(localeSortIT);
  if (tipo === "fornitore") state.anagrafiche.fornitori = uniq([...state.anagrafiche.fornitori, n]).sort(localeSortIT);
}

function getJobPaid(jobId) { return state.jobPayments.filter(jp => jp.jobId === jobId).reduce((acc, jp) => acc + jp.amount, 0); }
function getJobDue(jobId) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return 0;
  return Math.max(0, job.agreedTotal - getJobPaid(jobId));
}
function getJobLinesCost(jobId) { return state.jobLines.filter(jl => jl.jobId === jobId && jl.unitPrice > 0).reduce((acc, jl) => acc + jl.qty * jl.unitPrice, 0); }

function createJob({ titolo, cliente, commessa, total, note = "" }) {
  const job = {
    id: Date.now(),
    titolo: safeTrim(titolo),
    cliente: safeTrim(cliente),
    commessa: safeUpper(commessa),
    agreedTotal: parseImporto(total),
    stato: "aperto",
    note: safeTrim(note),
    createdISO: nowISO(),
  };
  state.jobs.push(job);
  upsertAnagrafica("cliente", cliente);
  return job;
}

function deleteJobCascade(jobId) {
  const jobIdx = state.jobs.findIndex(j => j.id === jobId);
  const job = state.jobs[jobIdx];
  if (!job) return;
  
  // Trova i payment IDs da eliminare
  const paymentIds = state.jobPayments.filter(jp => jp.jobId === jobId).map(jp => jp.id);
  
  // Rimuovi job
  state.jobs.splice(jobIdx, 1);
  
  // Rimuovi payments collegati
  state.jobPayments = state.jobPayments.filter(jp => jp.jobId !== jobId);
  
  // Rimuovi movimenti creati da questi payments (via sourceRef)
  state.movimenti = state.movimenti.filter(m => {
    if (m.sourceType === "jobPayment" && paymentIds.includes(m.sourceId)) return false;
    return true;
  });
  
  // Rimuovi righe e acquisti collegati
  state.jobLines = state.jobLines.filter(jl => jl.jobId !== jobId);
  state.purchaseLines = state.purchaseLines.filter(pl => safeUpper(pl.commessa) !== safeUpper(job.commessa));
  
  if (ui.activeJobId === jobId) ui.activeJobId = null;
}

function createJobPayment({ jobId, amount, method, note, dateISO }) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return null;
  const jp = {
    id: Date.now(),
    jobId,
    dateISO: dateISO || `${toISODateOnly()}T12:00:00Z`,
    amount: parseImporto(amount),
    method: safeTrim(method) || "bonifico",
    note: safeTrim(note),
  };
  if (!jp.amount || jp.amount <= 0) return null;
  state.jobPayments.push(jp);
  state.movimenti.push({
    id: Date.now() + 1,
    dateISO: jp.dateISO,
    desc: `Incasso ${job.titolo}`,
    commessa: job.commessa,
    importo: jp.amount,
    tipo: "entrata",
    controparteTipo: "cliente",
    controparteNome: job.cliente,
    sourceType: "jobPayment",
    sourceId: jp.id,
  });
  if (getJobDue(jobId) <= 0) job.stato = "chiuso";
  return jp;
}

function createPurchaseLine({ fornitore, prodotto, qty, unit, unitPrice, commessa, note, dateISO }) {
  const line = {
    id: Date.now(),
    fornitore: safeTrim(fornitore),
    prodotto: safeTrim(prodotto),
    qty: parseItalianFloat(qty || 1),
    unit: safeTrim(unit) || "pz",
    unitPrice: parseItalianFloat(unitPrice || 0),
    commessa: safeUpper(commessa),
    note: safeTrim(note),
    dateISO: dateISO || `${toISODateOnly()}T12:00:00Z`,
  };
  if (!line.prodotto || !line.fornitore) return null;
  state.purchaseLines.push(line);
  state.movimenti.push({
    id: Date.now() + 2,
    dateISO: line.dateISO,
    desc: `Acquisto ${line.prodotto}`,
    commessa: line.commessa,
    importo: line.qty * line.unitPrice,
    tipo: "uscita",
    controparteTipo: "fornitore",
    controparteNome: line.fornitore,
  });
  upsertAnagrafica("fornitore", line.fornitore);
  return line;
}

function createJobLine({ jobId, kind, desc, qty, unit, unitPrice, note }) {
  const jl = {
    id: Date.now(),
    jobId,
    kind: kind === "lavorazione" ? "lavorazione" : "materiale",
    desc: safeTrim(desc),
    qty: parseItalianFloat(qty || 1),
    unit: safeTrim(unit) || "pz",
    unitPrice: parseItalianFloat(unitPrice || 0),
    note: safeTrim(note),
    done: false,
    createdISO: nowISO(),
  };
  if (!jl.desc) return null;
  state.jobLines.push(jl);
  return jl;
}
function toggleJobLineDone(id) { const jl = state.jobLines.find(l => l.id === id); if (jl) jl.done = !jl.done; }
function deleteJobLine(id) { state.jobLines = state.jobLines.filter(l => l.id !== id); }

// Quote helpers
function recalcQuoteTotals(quote) {
  const calc = quote.righe.reduce((acc, r) => {
    const sub = (parseItalianFloat(r.qty) || 0) * (parseItalianFloat(r.unitPrice) || 0) * (1 - (parseItalianFloat(r.sconto) || 0) / 100);
    acc.taxable += sub;
    acc.vat += sub * ((parseItalianFloat(r.iva) || 0) / 100);
    return acc;
  }, { taxable: 0, vat: 0 });
  quote.totals = {
    taxable: Math.round(calc.taxable * 100) / 100,
    vat: Math.round(calc.vat * 100) / 100,
    total: Math.round((calc.taxable + calc.vat) * 100) / 100,
  };
}

function createQuote(cliente, commessa) {
  const quote = {
    id: Date.now(),
    number: state.quoteCounter++,
    dateISO: nowISO(),
    cliente: safeTrim(cliente),
    commessa: safeUpper(commessa),
    status: "draft",
    notes: "",
    righe: [],
    totals: { taxable: 0, vat: 0, total: 0 },
  };
  state.quotes.push(quote);
  state.selectedQuoteId = quote.id;
  return quote;
}

function deleteQuote(quoteId) {
  state.quotes = state.quotes.filter(q => q.id !== quoteId);
  if (state.selectedQuoteId === quoteId) {
    state.selectedQuoteId = state.quotes[0]?.id || null;
    ui.activeQuoteId = state.selectedQuoteId;
  }
}

function duplicateQuote(quoteId) {
  const q = state.quotes.find(q => q.id === quoteId);
  if (!q) return null;
  const copy = {
    ...q,
    id: Date.now(),
    number: state.quoteCounter++,
    status: "draft",
    dateISO: nowISO(),
    righe: q.righe.map(r => ({ ...r })),
    totals: { ...q.totals },
  };
  state.quotes.push(copy);
  state.selectedQuoteId = copy.id;
  ui.activeQuoteId = copy.id;
  return copy;
}

function confirmQuoteAsJob(quoteId) {
  const q = state.quotes.find(q => q.id === quoteId);
  if (!q) return null;
  recalcQuoteTotals(q);
  const job = createJob({
    titolo: `Preventivo #${q.number} - ${q.cliente}`,
    cliente: q.cliente,
    commessa: q.commessa,
    total: q.totals.total,
    note: `Da preventivo #${q.number}`,
  });
  q.righe.forEach(r => {
    createJobLine({ jobId: job.id, kind: "lavorazione", desc: r.desc, qty: r.qty, unit: "pz", unitPrice: r.unitPrice, note: "" });
  });
  q.status = "locked";
  return job;
}

function resetQuoteData(quoteId, clearHeader = false) {
  const q = state.quotes.find(q => q.id === quoteId);
  if (!q) return;
  q.status = "draft";
  q.righe = [];
  q.totals = { taxable: 0, vat: 0, total: 0 };
  if (clearHeader) { q.cliente = ""; q.commessa = ""; q.notes = ""; }
}

// ---------------------------------------------------------------------------
// RENDER HELPERS
// ---------------------------------------------------------------------------
function renderStorageWarning() {
  const pill = $("#storage-pill");
  if (!pill) return;
  if (storageDisabled) pill.classList.remove("hidden"); else pill.classList.add("hidden");
}

function renderBrand() {
  const chip = $("#company-name-chip");
  const name = safeTrim(state.companyName) || "La tua ditta";
  if (chip) chip.textContent = name;
  document.title = `PrevIA Works · ${name}`;
  
  // Mostra logo in header se presente
  const logoContainer = $("#header-logo-container");
  if (logoContainer) {
    if (state.companyLogoDataUrl) {
      logoContainer.innerHTML = `<img src="${state.companyLogoDataUrl}" alt="Logo" style="max-width: 80px; max-height: 40px; object-fit: contain;" />`;
      logoContainer.classList.remove("hidden");
    } else {
      logoContainer.innerHTML = "";
      logoContainer.classList.add("hidden");
    }
  }
}

function renderNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === ui.activeTab);
  });
  const views = ["home", "jobs", "job-detail", "quotes", "history", "settings"];
  views.forEach(v => {
    const el = $(`#view-${v}`);
    if (el) el.classList.toggle("hidden", ui.activeTab !== v);
  });
}

function renderCompanyForm() {
  $("#company-name-input")?.setAttribute("value", state.companyName || "");
  $("#company-address")?.setAttribute("value", state.companyInfo.address || "");
  $("#company-piva")?.setAttribute("value", state.companyInfo.piva || "");
  $("#company-phone")?.setAttribute("value", state.companyInfo.phone || "");
  $("#company-email")?.setAttribute("value", state.companyInfo.email || "");
}

function monthlyTotals() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const movs = state.movimenti.filter(m => {
    const d = new Date(m.dateISO);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  let entrate = 0, uscite = 0;
  movs.forEach(m => { if (m.tipo === "entrata") entrate += m.importo; else uscite += m.importo; });
  return { entrate, uscite };
}

function monthlySeries(months = 12) {
  const now = new Date();
  const labels = [];
  const entrate = [];
  const uscite = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    labels.push(d.toLocaleDateString("it-IT", { month: "short" }));
    const movs = state.movimenti.filter(mv => {
      const md = new Date(mv.dateISO);
      return md.getFullYear() === y && md.getMonth() === m;
    });
    let inc = 0;
    let out = 0;
    movs.forEach(mv => {
      if (mv.tipo === "entrata") inc += mv.importo;
      else out += mv.importo;
    });
    entrate.push(Math.round(inc * 100) / 100);
    uscite.push(Math.round(out * 100) / 100);
  }

  return { labels, entrate, uscite };
}

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------
function renderHome() {
  const kpiDue = $("#kpi-due");
  const kpiIncome = $("#kpi-income");
  const kpiOutcome = $("#kpi-outcome");
  if (kpiDue) kpiDue.textContent = formatMoney.format(state.jobs.filter(j => j.stato === "aperto").reduce((acc, j) => acc + getJobDue(j.id), 0));
  const { entrate, uscite } = monthlyTotals();
  if (kpiIncome) kpiIncome.textContent = formatMoney.format(entrate);
  if (kpiOutcome) kpiOutcome.textContent = formatMoney.format(uscite);

  const wrap = $("#home-open-jobs");
  if (!wrap) return;
  const openJobs = state.jobs.filter(j => j.stato === "aperto").sort((a, b) => getJobDue(b.id) - getJobDue(a.id));
  if (openJobs.length === 0) {
    wrap.innerHTML = '<p class="text-sm text-slate-500">Nessun lavoro aperto. Crea il primo lavoro.</p>';
    return;
  }
  wrap.innerHTML = openJobs.map(job => {
    const due = getJobDue(job.id);
    const paid = getJobPaid(job.id);
    return `
      <article class="job-card" data-job="${job.id}">
        <div class="job-card-header">
          <div>
            <p class="font-semibold">${escapeHTML(job.titolo)}</p>
            <p class="text-xs text-slate-500">${escapeHTML(job.cliente)} · ${escapeHTML(job.commessa)}</p>
          </div>
          <div class="job-card-actions">
            <span class="badge warning">Residuo</span>
            <button type="button" class="icon-btn danger" data-trash="${job.id}" aria-label="Elimina lavoro">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="flex items-end justify-between mt-3">
          <div>
            <p class="text-xs text-slate-500">Residuo</p>
            <p class="text-xl font-extrabold text-indigo-600">${formatMoney.format(due)}</p>
          </div>
          <div class="text-right text-xs text-slate-500">
            <div>Incassato: <strong>${formatMoney.format(paid)}</strong></div>
            <div>Totale: <strong>${formatMoney.format(job.agreedTotal)}</strong></div>
          </div>
        </div>
      </article>`;
  }).join("");

  wrap.querySelectorAll("[data-job]").forEach(card => {
    const id = Number(card.dataset.job);
    card.addEventListener("click", () => openJobDetail(id));
  });
  wrap.querySelectorAll("[data-trash]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      askConfirm({
        title: "Eliminare solo questo lavoro?",
        subtitle: state.jobs.find(j => j.id === Number(btn.dataset.trash))?.titolo || "",
        confirmLabel: "Elimina",
        destructive: true,
        body: `<p class="text-sm text-slate-600">Saranno rimossi incassi, movimenti collegati, righe e acquisti di questa commessa.</p>`
      }).then(ok => {
        if (!ok) return;
        deleteJobCascade(Number(btn.dataset.trash));
        persist();
        renderAll();
        showToast("Lavoro eliminato");
      });
    });
  });
}

function renderQuickActions() {
  const wrap = $("#quick-actions");
  if (!wrap) return;
  wrap.innerHTML = `
    <button id="qa-job" type="button" class="action-tile">
      <span class="icon-badge"><i class="fa-solid fa-briefcase"></i></span>
      <span>
        <p class="tile-title">Nuovo lavoro</p>
        <p class="tile-sub">Crea una nuova commessa</p>
      </span>
    </button>
    <button id="qa-payment" type="button" class="action-tile">
      <span class="icon-badge success"><i class="fa-solid fa-coins"></i></span>
      <span>
        <p class="tile-title">Nuovo incasso</p>
        <p class="tile-sub">Registra un pagamento</p>
      </span>
    </button>
    <button id="qa-quote" type="button" class="action-tile">
      <span class="icon-badge info"><i class="fa-solid fa-file-invoice"></i></span>
      <span>
        <p class="tile-title">Nuovo preventivo</p>
        <p class="tile-sub">Avvia il wizard rapido</p>
      </span>
    </button>
  `;
}

function renderHomeChart() {
  const canvas = $("#kpi-chart");
  if (!canvas || typeof Chart === "undefined") return;
  const { labels, entrate, uscite } = monthlySeries(12);
  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Entrate",
          data: entrate,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
        {
          label: "Uscite",
          data: uscite,
          borderColor: "#f43f5e",
          backgroundColor: "rgba(244, 63, 94, 0.1)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "bottom", labels: { usePointStyle: true } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney.format(ctx.parsed.y || 0)}` } },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: {
            callback: (value) => formatMoney.format(value),
          },
          grid: { color: "rgba(148, 163, 184, 0.2)" },
        },
      },
    },
  });
}

function renderHomeRecentMovements() {
  const wrap = $("#home-recent-movements");
  if (!wrap) return;
  const items = [...state.movimenti]
    .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO))
    .slice(0, 5);

  if (!items.length) {
    wrap.innerHTML = '<p class="text-sm text-slate-500">Nessun movimento registrato.</p>';
    return;
  }

  wrap.innerHTML = items.map(m => `
    <div class="list-row">
      <div class="left">
        <div class="title">${escapeHTML(m.desc || (m.tipo === "entrata" ? "Entrata" : "Uscita"))}</div>
        <div class="meta">${fmtShortDate(m.dateISO)} · ${escapeHTML(m.controparteNome || "N/D")}</div>
      </div>
      <div class="text-right">
        <div class="title ${m.tipo === "entrata" ? "text-emerald-600" : "text-rose-600"}">${formatMoney.format(m.importo)}</div>
        <div class="meta">${m.tipo === "entrata" ? "Entrata" : "Uscita"}</div>
      </div>
    </div>
  `).join("");
}

// ---------------------------------------------------------------------------
// JOBS LIST & DETAIL
// ---------------------------------------------------------------------------
function renderJobs() {
  const wrap = $("#jobs-list");
  if (!wrap) return;
  const query = ui.jobSearch ? safeUpper(ui.jobSearch) : "";
  const filtered = state.jobs.filter(j => {
    const matches = !query || safeUpper(j.cliente + j.commessa + j.titolo).includes(query);
    if (!matches) return false;
    if (ui.jobFilter === "open") return j.stato === "aperto";
    if (ui.jobFilter === "closed") return j.stato === "chiuso";
    if (ui.jobFilter === "archived") return j.stato === "archived";
    return true;
  }).sort((a, b) => new Date(b.createdISO) - new Date(a.createdISO));

  wrap.innerHTML = filtered.map(job => {
    const due = getJobDue(job.id);
    const paid = getJobPaid(job.id);
    const badge = job.stato === "chiuso" ? "success" : job.stato === "archived" ? "" : "warning";
    const label = job.stato === "chiuso" ? "Chiuso" : job.stato === "archived" ? "Archiviato" : "Aperto";
    return `
      <article class="list-row" data-job="${job.id}">
        <div class="left">
          <div class="title">${escapeHTML(job.titolo)}</div>
          <div class="meta">${escapeHTML(job.cliente)} · ${escapeHTML(job.commessa)}</div>
        </div>
        <div class="text-right text-sm">
          <div><strong>${formatMoney.format(due)}</strong></div>
          <div class="meta">Incassato ${formatMoney.format(paid)}</div>
        </div>
        <div class="list-row-actions">
          <span class="badge ${badge}">${label}</span>
          <button type="button" class="icon-btn danger" data-job-del="${job.id}" aria-label="Elimina lavoro">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </article>`;
  }).join("");

  wrap.querySelectorAll("[data-job]").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-job-del]")) return;
      openJobDetail(Number(card.dataset.job));
    });
  });
  
  wrap.querySelectorAll("[data-job-del]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const jobId = Number(btn.dataset.jobDel);
      const job = state.jobs.find(j => j.id === jobId);
      askConfirm({ 
        title: "Eliminare solo questo lavoro?", 
        subtitle: job ? job.titolo : "", 
        confirmLabel: "Elimina", 
        destructive: true 
      }).then(ok => {
        if (!ok) return;
        deleteJobCascade(jobId);
        persist();
        renderJobs();
        renderHome();
        showToast("Lavoro eliminato");
      });
    });
  });
}

function openJobDetail(jobId) {
  ui.activeJobId = jobId;
  ui.activeTab = "job-detail";
  renderNav();
  renderJobDetail();
}

function renderJobDetail() {
  const job = state.jobs.find(j => j.id === ui.activeJobId);
  if (!job) return;
  $("#job-title").textContent = job.titolo;
  $("#job-meta").textContent = `${job.cliente} · ${job.commessa}`;
  const badge = $("#job-status");
  const statusLabel = job.stato === "chiuso" ? "Chiuso" : job.stato === "archived" ? "Archiviato" : "Aperto";
  if (badge) {
    badge.textContent = statusLabel;
    badge.className = `badge ${job.stato === "chiuso" ? "success" : job.stato === "archived" ? "" : "warning"}`;
  }
  $("#job-due").textContent = formatMoney.format(getJobDue(job.id));
  $("#job-paid").textContent = formatMoney.format(getJobPaid(job.id));
  $("#job-total").textContent = formatMoney.format(job.agreedTotal);
  $("#job-note-input").value = job.note || "";
  renderJobDetailTabs();
}

function renderJobDetailTabs() {
  const jobId = ui.activeJobId;
  if (!jobId) return;
  // tabs state
  document.querySelectorAll("#job-detail-tabs .segment-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === ui.jobDetailTab);
  });
  ["incassi", "acquisti", "righe", "note"].forEach(name => {
    const pane = $(`#job-${name}`);
    if (pane) pane.classList.toggle("hidden", ui.jobDetailTab !== name);
  });

  if (ui.jobDetailTab === "incassi") {
    const wrap = $("#job-incassi");
    const payments = state.jobPayments.filter(jp => jp.jobId === jobId).sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
    wrap.innerHTML = payments.length ? payments.map(p => `<div class="list-row"><div class="left"><div class="title">${formatMoney.format(p.amount)}</div><div class="meta">${fmtShortDate(p.dateISO)} · ${escapeHTML(p.method || "")}</div></div><div class="meta">${p.note ? escapeHTML(p.note) : ""}</div></div>`).join("") : '<p class="text-sm text-slate-500">Nessun incasso registrato.</p>';
  }
  if (ui.jobDetailTab === "acquisti") {
    const wrap = $("#job-acquisti");
    const job = state.jobs.find(j => j.id === jobId);
    const list = state.purchaseLines.filter(pl => safeUpper(pl.commessa) === safeUpper(job.commessa)).sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
    wrap.innerHTML = list.length ? list.map(l => `<div class="list-row"><div class="left"><div class="title">${escapeHTML(l.prodotto)}</div><div class="meta">${fmtShortDate(l.dateISO)} · ${escapeHTML(l.fornitore)}</div></div><div class="text-right"><div class="title">${formatMoney.format(l.qty * l.unitPrice)}</div><div class="meta">${l.qty} @ ${formatMoney.format(l.unitPrice)}</div></div></div>`).join("") : '<p class="text-sm text-slate-500">Nessun acquisto per questa commessa.</p>';
  }
  if (ui.jobDetailTab === "righe") {
    const wrap = $("#job-righe");
    const lines = state.jobLines.filter(l => l.jobId === jobId).sort((a, b) => new Date(a.createdISO) - new Date(b.createdISO));
    wrap.innerHTML = lines.length ? lines.map(l => `<div class="job-line ${l.done ? "done" : ""}" data-line="${l.id}"><input type="checkbox" ${l.done ? "checked" : ""} data-line-toggle="${l.id}" aria-label="Completata" /><div><div class="title">${escapeHTML(l.desc)}</div><div class="meta">${l.kind === "lavorazione" ? "🔧" : "📦"} ${l.qty} ${escapeHTML(l.unit)}${l.unitPrice ? " · " + formatMoney.format(l.qty * l.unitPrice) : ""}${l.note ? " · " + escapeHTML(l.note) : ""}</div></div><button type="button" class="btn-ghost danger" data-line-del="${l.id}"><i class="fa-solid fa-trash"></i></button></div>`).join("") : '<p class="text-sm text-slate-500">Nessuna riga lavoro.</p>';
    wrap.querySelectorAll("[data-line-toggle]").forEach(cb => cb.addEventListener("change", () => { toggleJobLineDone(Number(cb.dataset.lineToggle)); persist(); renderJobDetailTabs(); }));
    wrap.querySelectorAll("[data-line-del]").forEach(btn => btn.addEventListener("click", () => { deleteJobLine(Number(btn.dataset.lineDel)); persist(); renderJobDetailTabs(); }));
  }
}

// ---------------------------------------------------------------------------
// QUOTES
// ---------------------------------------------------------------------------
function renderQuotesList() {
  const wrap = $("#quotes-list");
  if (!wrap) return;
  const q = safeUpper($("#quotes-search")?.value || "");
  const list = [...state.quotes].sort((a, b) => b.number - a.number).filter(qt => !q || safeUpper(qt.cliente + qt.commessa).includes(q));
  wrap.innerHTML = list.length ? list.map(qt => `<article class="quote-card ${qt.id === ui.activeQuoteId ? "active" : ""}" data-quote="${qt.id}"><div class="flex items-start justify-between gap-2"><div><p class="font-semibold">Prev. #${qt.number}</p><p class="text-xs text-slate-500">${escapeHTML(qt.cliente)}</p><p class="text-xs text-slate-400">${escapeHTML(qt.commessa)}</p></div><span class="badge ${qt.status === "locked" ? "success" : ""}">${qt.status === "locked" ? "LOCKED" : "DRAFT"}</span></div><div class="flex items-center justify-between mt-3 text-sm"><span>${fmtShortDate(qt.dateISO)}</span><strong>${formatMoney.format(qt.totals.total)}</strong></div><div class="flex gap-2 mt-2"><button type="button" class="btn-ghost" data-quote-print="${qt.id}"><i class="fa-solid fa-print"></i></button><button type="button" class="btn-ghost" data-quote-dup="${qt.id}"><i class="fa-solid fa-copy"></i></button><button type="button" class="btn-ghost danger" data-quote-del="${qt.id}"><i class="fa-solid fa-trash"></i></button></div></article>`).join("") : '<p class="text-sm text-slate-500">Nessun preventivo.</p>';

  wrap.querySelectorAll("[data-quote]").forEach(card => card.addEventListener("click", e => {
    if (e.target.closest("button")) return;
    ui.activeQuoteId = Number(card.dataset.quote);
    state.selectedQuoteId = ui.activeQuoteId;
    renderQuotes();
  }));
  wrap.querySelectorAll("[data-quote-print]").forEach(btn => btn.addEventListener("click", e => { e.stopPropagation(); printQuote(Number(btn.dataset.quotePrint)); }));
  wrap.querySelectorAll("[data-quote-dup]").forEach(btn => btn.addEventListener("click", e => { e.stopPropagation(); const copy = duplicateQuote(Number(btn.dataset.quoteDup)); persist(); renderQuotes(); showToast("Preventivo duplicato"); }));
  wrap.querySelectorAll("[data-quote-del]").forEach(btn => btn.addEventListener("click", e => { e.stopPropagation(); const id = Number(btn.dataset.quoteDel); const qt = state.quotes.find(q => q.id === id); askConfirm({ title: "Eliminare solo questo preventivo?", subtitle: qt ? qt.cliente : "", confirmLabel: "Elimina", destructive: true }).then(ok => { if (!ok) return; deleteQuote(id); persist(); renderQuotes(); showToast("Preventivo eliminato"); }); }));
}

function renderQuoteEditor() {
  const empty = $("#quote-empty");
  const wizard = $("#quote-wizard");
  const editor = $("#quote-editor");
  if (!ui.activeQuoteId) {
    empty?.classList.remove("hidden");
    wizard?.classList.add("hidden");
    editor?.classList.add("hidden");
    return;
  }
  const quote = state.quotes.find(q => q.id === ui.activeQuoteId);
  if (!quote) return;
  empty?.classList.add("hidden");
  wizard?.classList.add("hidden");
  editor?.classList.remove("hidden");

  recalcQuoteTotals(quote);

  $("#qe-number").textContent = quote.number;
  $("#qe-date").textContent = fmtShortDate(quote.dateISO);
  const status = $("#qe-status");
  if (status) { status.textContent = quote.status === "locked" ? "LOCKED" : "DRAFT"; status.className = `badge ${quote.status === "locked" ? "success" : ""}`; }
  const locked = quote.status === "locked";
  ["#qe-client", "#qe-commessa", "#qe-notes"].forEach(sel => { const el = $(sel); if (el) { el.value = sel === "#qe-commessa" ? quote.commessa : sel === "#qe-client" ? quote.cliente : quote.notes; el.disabled = locked; } });
  renderQuoteRows();
  renderQuoteTotals();
  $("#btn-quote-lock")?.classList.toggle("hidden", locked);
  $("#btn-quote-unlock")?.classList.toggle("hidden", !locked);
}

function renderQuoteRows() {
  const wrap = $("#quote-rows");
  const quote = state.quotes.find(q => q.id === ui.activeQuoteId);
  if (!wrap || !quote) return;
  const locked = quote.status === "locked";
  wrap.innerHTML = quote.righe.length ? quote.righe.map((r, idx) => `<div class="row-card"><div class="left"><p class="title">${escapeHTML(r.desc)}</p><p class="meta">Qta ${r.qty} · Prezzo ${formatMoney.format(r.unitPrice)} · Sconto ${r.sconto || 0}% · IVA ${r.iva || 0}%</p></div><div class="text-right"><p class="title">${formatMoney.format((r.qty || 0) * (r.unitPrice || 0) * (1 - (r.sconto || 0) / 100) * (1 + (r.iva || 0) / 100))}</p>${!locked ? `<button type="button" class="btn-ghost danger" data-row-del="${idx}"><i class="fa-solid fa-trash"></i></button>` : ""}</div></div>`).join("") : '<p class="text-sm text-slate-500">Nessuna riga.</p>';
  if (!locked) {
    wrap.querySelectorAll("[data-row-del]").forEach(btn => btn.addEventListener("click", () => { quote.righe.splice(Number(btn.dataset.rowDel), 1); recalcQuoteTotals(quote); persist(); renderQuotes(); showToast("Riga eliminata"); }));
  }
}

function renderQuoteTotals() {
  const quote = state.quotes.find(q => q.id === ui.activeQuoteId);
  if (!quote) return;
  $("#qt-taxable").textContent = formatMoney.format(quote.totals.taxable);
  $("#qt-iva").textContent = formatMoney.format(quote.totals.vat);
  $("#qt-total").textContent = formatMoney.format(quote.totals.total);
}

function renderQuotes() {
  renderQuotesList();
  renderQuoteEditor();
}

// ---------------------------------------------------------------------------
// HISTORY
// ---------------------------------------------------------------------------
function getProductHistory(filters = {}) {
  let lines = [...state.purchaseLines];
  if (filters.prodotto) lines = lines.filter(l => safeUpper(l.prodotto).includes(safeUpper(filters.prodotto)));
  if (filters.fornitore) lines = lines.filter(l => safeUpper(l.fornitore).includes(safeUpper(filters.fornitore)));
  if (filters.year) lines = lines.filter(l => new Date(l.dateISO).getFullYear() === Number(filters.year));
  if (filters.month && filters.month !== 'all') lines = lines.filter(l => (new Date(l.dateISO).getMonth() + 1) === Number(filters.month));
  if (filters.commessa) lines = lines.filter(l => safeUpper(l.commessa).includes(safeUpper(filters.commessa)));
  if (filters.order === 'price') return lines.sort((a, b) => (a.unitPrice - b.unitPrice));
  return lines.sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
}

function getProductStats(prodotto, year) {
  let lines = state.purchaseLines.filter(l => safeUpper(l.prodotto).includes(safeUpper(prodotto)));
  if (year) lines = lines.filter(l => new Date(l.dateISO).getFullYear() === Number(year));
  if (!lines.length) return { minPrice: 0, maxPrice: 0, avgPrice: 0, lastPrice: 0, qty: 0, count: 0 };
  const prices = lines.map(l => l.unitPrice);
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgPrice: Math.round((sum / prices.length) * 100) / 100,
    lastPrice: lines[0].unitPrice,
    qty: lines.reduce((a, l) => a + l.qty, 0),
    count: lines.length,
  };
}

function renderHistory() {
  const q = safeTrim($("#history-search")?.value || "");
  const forn = safeTrim($("#history-supplier")?.value || "");
  const year = safeTrim($("#history-year")?.value || "");
  const month = $("#history-month")?.value || 'all';
  const commessa = safeTrim($("#history-commessa")?.value || "");
  const order = $("#history-order")?.value || 'date-desc';
  const lines = getProductHistory({ prodotto: q, fornitore: forn, year, month, commessa, order });
  const wrap = $("#history-results");
  if (!wrap) return;
  if (!lines.length) { wrap.innerHTML = '<p class="text-sm text-slate-500">Nessun risultato.</p>'; return; }
  const byProd = lines.reduce((acc, l) => { const key = safeUpper(l.prodotto); acc[key] = acc[key] || []; acc[key].push(l); return acc; }, {});
  wrap.innerHTML = Object.entries(byProd).map(([prod, arr]) => {
    const s = getProductStats(prod, year);
    return `<div class="surface space-y-2">
      <div class="flex items-center justify-between">
        <div>
          <p class="surface-title">${escapeHTML(prod)}</p>
          <p class="text-xs text-slate-500">${s.count} acquisti · ${s.qty} unità</p>
        </div>
        <div class="text-right text-sm">
          <div>Ultimo ${formatMoney.format(s.lastPrice)}</div>
          <div>Min ${formatMoney.format(s.minPrice)}</div>
          <div>Med ${formatMoney.format(s.avgPrice)}</div>
          <div>Max ${formatMoney.format(s.maxPrice)}</div>
        </div>
      </div>
      ${arr.map(l => `<div class="list-row">
        <div class="left">
          <div class="title">${escapeHTML(l.fornitore)}</div>
          <div class="meta">${fmtShortDate(l.dateISO)} · Commessa ${escapeHTML(l.commessa || '-')}</div>
        </div>
        <div class="text-right">
          <div class="title">${formatMoney.format(l.qty * l.unitPrice)}</div>
          <div class="meta">${l.qty} ${escapeHTML(l.unit || 'pz')} @ ${formatMoney.format(l.unitPrice)}</div>
        </div>
      </div>`).join("")}
    </div>`;
  }).join("");
}

function exportPurchasesCSV(lines) {
  const header = ["dateISO","fornitore","prodotto","qty","unita","prezzoUnit","totale","commessa","note"]; 
  const rows = lines.map(l => [
    l.dateISO,
    l.fornitore,
    l.prodotto,
    l.qty,
    l.unit || 'pz',
    l.unitPrice,
    Math.round(l.qty * l.unitPrice * 100)/100,
    l.commessa || '',
    (l.note || '').replace(/\n/g,' ')
  ]);
  const csv = [header.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  const now = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `acquisti_${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPurchasesJSON(lines) {
  const payload = { purchaseLines: lines };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const now = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `acquisti_${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------
function renderSettings() {
  renderCompanyForm();
}

function updateCompanyFromInputs() {
  state.companyName = safeTrim($("#company-name-input")?.value || state.companyName);
  state.companyInfo = {
    address: safeTrim($("#company-address")?.value || ""),
    piva: safeTrim($("#company-piva")?.value || ""),
    phone: safeTrim($("#company-phone")?.value || ""),
    email: safeTrim($("#company-email")?.value || ""),
  };
  persist();
  renderBrand();
  showToast("Dati azienda salvati");
}

// ---------------------------------------------------------------------------
// SHEET & TOAST
// ---------------------------------------------------------------------------
function showToast(msg, ms = 2400) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), ms);
}

function closeSheet() {
  $("#sheet-overlay")?.classList.add("hidden");
  $("#sheet-body")?.replaceChildren();
}

function openSheet({ title, subtitle, body, primaryLabel = "Salva", secondaryLabel = "Annulla", destructive = false, onSubmit, onCancel }) {
  const overlay = $("#sheet-overlay");
  if (!overlay) return;
  $("#sheet-title").textContent = title || "";
  $("#sheet-subtitle").textContent = subtitle || "";
  $("#sheet-body").innerHTML = body || "";
  const primary = $("#sheet-primary");
  const secondary = $("#sheet-secondary");
  primary.textContent = primaryLabel;
  primary.className = destructive ? "btn-danger" : "btn-main";
  secondary.textContent = secondaryLabel;
  overlay.classList.remove("hidden");

  const cleanup = () => { closeSheet(); secondary.replaceWith(secondary.cloneNode(true)); primary.replaceWith(primary.cloneNode(true)); };
  $("#sheet-close").onclick = () => { cleanup(); onCancel?.(); };
  $("#sheet-secondary").onclick = () => { cleanup(); onCancel?.(); };
  $("#sheet-primary").onclick = async () => {
    const ok = onSubmit ? await onSubmit() : true;
    if (ok !== false) cleanup();
  };
}

function askConfirm({ title, subtitle = "", confirmLabel = "Conferma", cancelLabel = "Annulla", destructive = false, body = "" }) {
  return new Promise(resolve => {
    openSheet({
      title,
      subtitle,
      body,
      primaryLabel: confirmLabel,
      secondaryLabel: cancelLabel,
      destructive,
      onSubmit: () => { resolve(true); return true; },
      onCancel: () => resolve(false),
    });
  });
}

// ---------------------------------------------------------------------------
// ACTIONS & HANDLERS
// ---------------------------------------------------------------------------
function openSheetJobCreate() {
  openSheet({
    title: "Nuovo lavoro",
    subtitle: "Cliente · Commessa",
    body: `
      <label class="input-label">Titolo</label>
      <input id="sheet-job-title" class="input" placeholder="Es. Impianto" />
      <label class="input-label mt-2">Cliente</label>
      <input id="sheet-job-client" class="input" placeholder="Cliente" />
      <label class="input-label mt-2">Commessa/Cantiere</label>
      <input id="sheet-job-commessa" class="input" placeholder="CODICE" />
      <label class="input-label mt-2">Totale concordato</label>
      <input id="sheet-job-total" class="input" type="number" step="0.01" placeholder="0" />
    `,
    onSubmit: () => {
      const titolo = safeTrim($("#sheet-job-title").value);
      const cliente = safeTrim($("#sheet-job-client").value);
      const commessa = safeTrim($("#sheet-job-commessa").value);
      const total = parseImporto($("#sheet-job-total").value);
      if (!titolo || !cliente || !commessa || !Number.isFinite(total) || total <= 0) { showToast("Compila tutti i campi"); return false; }
      createJob({ titolo, cliente, commessa, total });
      persist();
      renderAll();
      showToast("Lavoro creato");
      return true;
    }
  });
}

function openSheetPayment(jobId) {
  const openJobs = state.jobs.filter(j => j.stato === "aperto" || j.id === jobId);
  if (!openJobs.length) { showToast("Nessun lavoro disponibile"); return; }
  openSheet({
    title: "Nuovo incasso",
    subtitle: "Registrazione pagamento",
    body: `
      <label class="input-label">Lavoro</label>
      <select id="sheet-pay-job" class="input">${openJobs.map(j => `<option value="${j.id}" ${j.id === jobId ? "selected" : ""}>${escapeHTML(j.titolo)} (${escapeHTML(j.cliente)})</option>`).join("")}</select>
      <label class="input-label mt-2">Importo</label>
      <input id="sheet-pay-amount" class="input" type="number" step="0.01" placeholder="0" />
      <label class="input-label mt-2">Metodo</label>
      <input id="sheet-pay-method" class="input" value="bonifico" />
      <label class="input-label mt-2">Nota</label>
      <input id="sheet-pay-note" class="input" placeholder="Opzionale" />
      <label class="input-label mt-2">Data</label>
      <input id="sheet-pay-date" class="input" type="date" value="${toISODateOnly()}" />
    `,
    onSubmit: () => {
      const sel = Number($("#sheet-pay-job").value);
      const amt = parseImporto($("#sheet-pay-amount").value);
      if (!sel || !amt || amt <= 0) { showToast("Importo non valido"); return false; }
      const ok = createJobPayment({ jobId: sel, amount: amt, method: $("#sheet-pay-method").value, note: $("#sheet-pay-note").value, dateISO: `${$("#sheet-pay-date").value}T12:00:00Z` });
      if (!ok) { showToast("Errore salvataggio"); return false; }
      persist();
      renderAll();
      showToast("Incasso registrato");
      return true;
    }
  });
}

function openSheetPurchase(jobId) {
  const job = state.jobs.find(j => j.id === jobId);
  openSheet({
    title: "Nuovo acquisto",
    subtitle: job ? job.titolo : "",
    body: `
      <label class="input-label">Fornitore</label>
      <input id="sheet-pur-forn" class="input" />
      <label class="input-label mt-2">Prodotto</label>
      <input id="sheet-pur-prod" class="input" />
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div>
          <label class="input-label">Qta</label>
          <input id="sheet-pur-qty" class="input" value="1" />
        </div>
        <div>
          <label class="input-label">Prezzo unit.</label>
          <input id="sheet-pur-price" class="input" value="0" />
        </div>
      </div>
      <label class="input-label mt-2">Commessa</label>
      <input id="sheet-pur-comm" class="input" value="${escapeHTML(job?.commessa || "")}" />
      <label class="input-label mt-2">Nota</label>
      <input id="sheet-pur-note" class="input" />
      <label class="input-label mt-2">Data</label>
      <input id="sheet-pur-date" class="input" type="date" value="${toISODateOnly()}" />
    `,
    onSubmit: () => {
      const forn = safeTrim($("#sheet-pur-forn").value);
      const prod = safeTrim($("#sheet-pur-prod").value);
      if (!forn || !prod) { showToast("Compila fornitore e prodotto"); return false; }
      createPurchaseLine({
        fornitore: forn,
        prodotto: prod,
        qty: $("#sheet-pur-qty").value,
        unitPrice: $("#sheet-pur-price").value,
        commessa: $("#sheet-pur-comm").value || job?.commessa,
        note: $("#sheet-pur-note").value,
        dateISO: `${$("#sheet-pur-date").value}T12:00:00Z`,
      });
      persist();
      renderAll();
      showToast("Acquisto registrato");
      return true;
    }
  });
}

function openSheetJobLine(jobId) {
  openSheet({
    title: "Nuova riga lavoro",
    subtitle: "Materiale o lavorazione",
    body: `
      <label class="input-label">Tipo</label>
      <select id="sheet-line-kind" class="input"><option value="materiale">Materiale</option><option value="lavorazione">Lavorazione</option></select>
      <label class="input-label mt-2">Descrizione</label>
      <input id="sheet-line-desc" class="input" placeholder="Descrizione" />
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div><label class="input-label">Qta</label><input id="sheet-line-qty" class="input" value="1" /></div>
        <div><label class="input-label">Unità</label><input id="sheet-line-unit" class="input" value="pz" /></div>
      </div>
      <label class="input-label mt-2">Prezzo (opz.)</label>
      <input id="sheet-line-price" class="input" />
      <label class="input-label mt-2">Nota</label>
      <input id="sheet-line-note" class="input" />
    `,
    onSubmit: () => {
      const desc = safeTrim($("#sheet-line-desc").value);
      if (!desc) { showToast("Descrizione obbligatoria"); return false; }
      createJobLine({
        jobId,
        kind: $("#sheet-line-kind").value,
        desc,
        qty: $("#sheet-line-qty").value,
        unit: $("#sheet-line-unit").value,
        unitPrice: $("#sheet-line-price").value,
        note: $("#sheet-line-note").value,
      });
      persist();
      renderAll();
      showToast("Riga aggiunta");
      return true;
    }
  });
}

function openSheetQuoteRow() {
  if (!ui.activeQuoteId) { showToast("Seleziona un preventivo"); return; }
  const quote = state.quotes.find(q => q.id === ui.activeQuoteId);
  if (!quote || quote.status === "locked") { showToast("Preventivo bloccato"); return; }
  openSheet({
    title: "Aggiungi riga",
    subtitle: "Articolo o servizio",
    body: `
      <label class="input-label">Descrizione</label><input id="sheet-row-desc" class="input" />
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div><label class="input-label">Qta</label><input id="sheet-row-qty" class="input" value="1" /></div>
        <div><label class="input-label">Prezzo</label><input id="sheet-row-price" class="input" value="0" /></div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div><label class="input-label">Sconto %</label><input id="sheet-row-sconto" class="input" value="0" /></div>
        <div><label class="input-label">IVA %</label><input id="sheet-row-iva" class="input" value="22" /></div>
      </div>
    `,
    onSubmit: () => {
      const desc = safeTrim($("#sheet-row-desc").value);
      const qty = parseItalianFloat($("#sheet-row-qty").value);
      const price = parseItalianFloat($("#sheet-row-price").value);
      if (!desc || qty <= 0) { showToast("Compila descrizione e quantità"); return false; }
      quote.righe.push({ desc, qty, unitPrice: price, sconto: parseItalianFloat($("#sheet-row-sconto").value), iva: parseItalianFloat($("#sheet-row-iva").value) });
      recalcQuoteTotals(quote);
      persist();
      renderQuotes();
      showToast("Riga aggiunta");
      return true;
    }
  });
}

function openResetAll() {
  openSheet({
    title: "Reset totale",
    subtitle: "Digita RESET per confermare",
    body: `<p class="text-sm text-slate-600">Azione irreversibile. Verranno eliminati lavori, incassi, preventivi e backup locali.</p><input id="sheet-reset-text" class="input" placeholder="RESET" />`,
    primaryLabel: "Reset",
    destructive: true,
    onSubmit: () => {
      if (safeUpper($("#sheet-reset-text").value) !== "RESET") { showToast("Scrivi RESET per confermare"); return false; }
      safeStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      ui.activeJobId = null;
      ui.activeQuoteId = null;
      persist();
      renderAll();
      showToast("Archivio azzerato");
      return true;
    }
  });
}

function openExportJob() {
  if (!state.jobs.length) { showToast("Nessun lavoro"); return; }
  openSheet({
    title: "Export fascicolo",
    subtitle: "Seleziona lavoro",
    body: `<select id="sheet-export-job" class="input">${state.jobs.map(j => `<option value="${j.id}">${escapeHTML(j.titolo)}</option>`).join("")}</select>`,
    primaryLabel: "Esporta",
    onSubmit: () => {
      const id = Number($("#sheet-export-job").value);
      const job = state.jobs.find(j => j.id === id);
      if (!job) return false;
      const payload = {
        job,
        payments: state.jobPayments.filter(p => p.jobId === id),
        lines: state.jobLines.filter(l => l.jobId === id),
        purchases: state.purchaseLines.filter(p => safeUpper(p.commessa) === safeUpper(job.commessa)),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `fascicolo_${job.commessa || job.id}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Fascicolo esportato");
      return true;
    }
  });
}

function buildQuotePrintHTML(quote) {
  let logoHTML = "";
  if (state.companyLogoDataUrl) {
    logoHTML = `<img src="${state.companyLogoDataUrl}" alt="Logo" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:8px;display:block;" />`;
  }

  const rowsHTML = quote.righe.map(r => {
    const sub = r.qty * r.unitPrice * (1 - r.sconto / 100);
    const tot = sub * (1 + r.iva / 100);
    return `<tr>
      <td>${escapeHTML(r.desc)}</td>
      <td style="text-align:center;">${r.qty}</td>
      <td style="text-align:right;">${formatMoney.format(r.unitPrice)}</td>
      <td style="text-align:center;">${r.sconto}%</td>
      <td style="text-align:center;">${r.iva}%</td>
      <td style="text-align:right;font-weight:700;">${formatMoney.format(tot)}</td>
    </tr>`;
  }).join("");

  return `
    <div class="print-doc">
      <div class="print-header">
        <div style="flex:1;">
          ${logoHTML}
          <h1>${escapeHTML(state.companyName)}</h1>
          <div class="print-subtle">
            ${state.companyInfo.address ? escapeHTML(state.companyInfo.address) + "<br/>" : ""}
            ${state.companyInfo.piva ? "P.IVA: " + escapeHTML(state.companyInfo.piva) + "<br/>" : ""}
            ${state.companyInfo.phone ? "Tel: " + escapeHTML(state.companyInfo.phone) + "<br/>" : ""}
            ${state.companyInfo.email ? escapeHTML(state.companyInfo.email) : ""}
          </div>
        </div>
        <div style="text-align:right;min-width:180px;">
          <p class="print-doc-title">PREVENTIVO</p>
          <p style="margin:0 0 4px 0;font-weight:700;font-size:16px;">N° ${quote.number}</p>
          <p style="margin:0;font-size:13px;color:#64748b;">Data: ${fmtShortDate(quote.dateISO)}</p>
        </div>
      </div>

      <div class="print-info-box">
        <div class="print-grid">
          <div><strong style="color:#64748b;font-weight:600;">Cliente:</strong><br/>${escapeHTML(quote.cliente)}</div>
          <div><strong style="color:#64748b;font-weight:600;">Commessa:</strong><br/>${escapeHTML(quote.commessa)}</div>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th style="text-align:left;">Descrizione</th>
            <th style="text-align:center;width:60px;">Qta</th>
            <th style="text-align:right;width:100px;">Prezzo</th>
            <th style="text-align:center;width:70px;">Sconto</th>
            <th style="text-align:center;width:60px;">IVA</th>
            <th style="text-align:right;width:100px;">Totale</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>

      <div class="print-summary">
        <div class="print-summary-row">
          <span style="color:#64748b;">Imponibile</span>
          <strong>${formatMoney.format(quote.totals.taxable)}</strong>
        </div>
        <div class="print-summary-row">
          <span style="color:#64748b;">IVA</span>
          <strong>${formatMoney.format(quote.totals.vat)}</strong>
        </div>
        <div class="print-summary-row total">
          <span style="font-weight:700;">Totale documento</span>
          <strong style="color:#4f46e5;">${formatMoney.format(quote.totals.total)}</strong>
        </div>
      </div>

      ${quote.notes ? `<div class="print-alert"><strong>Note:</strong><br/>${escapeHTML(quote.notes)}</div>` : ""}

      <div class="print-signatures">
        <div class="print-signature-box">Firma azienda</div>
        <div class="print-signature-box">Firma cliente</div>
      </div>

      <div class="print-footer">
        Documento generato il ${new Date().toLocaleDateString("it-IT")} - PrevIA Works
      </div>
    </div>`;
}

function buildJobReportHTML(job) {
  const payments = state.jobPayments.filter(p => p.jobId === job.id);
  const lines = state.jobLines.filter(l => l.jobId === job.id);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(job.agreedTotal - totalPaid, 0);
  const doneLines = lines.filter(l => l.done);
  const doneTotal = doneLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  let logoHTML = "";
  if (state.companyLogoDataUrl) {
    logoHTML = `<img src="${state.companyLogoDataUrl}" alt="Logo" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:8px;display:block;" />`;
  }

  const paymentsRows = payments.length
    ? payments.map(p => `<tr>
        <td>${fmtShortDate(p.dateISO)}</td>
        <td>${escapeHTML(p.method)}</td>
        <td style="text-align:right;">${formatMoney.format(p.amount)}</td>
        <td>${escapeHTML(p.note || "-")}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Nessun incasso registrato</td></tr>`;

  const linesRows = lines.length
    ? lines.map(l => `<tr>
        <td>${escapeHTML(l.kind)}</td>
        <td>${escapeHTML(l.desc)}</td>
        <td style="text-align:center;">${l.qty} ${escapeHTML(l.unit)}</td>
        <td style="text-align:right;">${formatMoney.format(l.unitPrice)}</td>
        <td style="text-align:right;">${formatMoney.format(l.qty * l.unitPrice)}</td>
        <td style="text-align:center;">${l.done ? "Completato" : "In corso"}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Nessuna riga registrata</td></tr>`;

  return `
    <div class="print-doc">
      <div class="print-header">
        <div style="flex:1;">
          ${logoHTML}
          <h1>${escapeHTML(state.companyName)}</h1>
          <div class="print-subtle">
            ${state.companyInfo.address ? escapeHTML(state.companyInfo.address) + "<br/>" : ""}
            ${state.companyInfo.piva ? "P.IVA: " + escapeHTML(state.companyInfo.piva) + "<br/>" : ""}
            ${state.companyInfo.phone ? "Tel: " + escapeHTML(state.companyInfo.phone) + "<br/>" : ""}
            ${state.companyInfo.email ? escapeHTML(state.companyInfo.email) : ""}
          </div>
        </div>
        <div style="text-align:right;min-width:180px;">
          <p class="print-doc-title">REPORT PAGAMENTI</p>
          <p style="margin:0 0 4px 0;font-weight:700;font-size:16px;">${escapeHTML(job.titolo)}</p>
          <p style="margin:0;font-size:13px;color:#64748b;">Data: ${new Date().toLocaleDateString("it-IT")}</p>
        </div>
      </div>

      <div class="print-info-box">
        <div class="print-grid">
          <div><strong style="color:#64748b;font-weight:600;">Cliente:</strong><br/>${escapeHTML(job.cliente)}</div>
          <div><strong style="color:#64748b;font-weight:600;">Commessa:</strong><br/>${escapeHTML(job.commessa)}</div>
          <div><strong style="color:#64748b;font-weight:600;">Totale concordato:</strong><br/>${formatMoney.format(job.agreedTotal)}</div>
          <div><strong style="color:#64748b;font-weight:600;">Lavoro svolto (righe completate):</strong><br/>${formatMoney.format(doneTotal)}</div>
        </div>
      </div>

      <div class="print-summary">
        <div class="print-summary-row">
          <span style="color:#64748b;">Incassato</span>
          <strong>${formatMoney.format(totalPaid)}</strong>
        </div>
        <div class="print-summary-row total">
          <span style="font-weight:700;">Residuo da pagare</span>
          <strong style="color:#4f46e5;">${formatMoney.format(remaining)}</strong>
        </div>
      </div>

      <h3 style="margin:24px 0 10px 0;font-size:16px;">Incassi registrati</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th style="text-align:left;width:90px;">Data</th>
            <th style="text-align:left;width:120px;">Metodo</th>
            <th style="text-align:right;width:120px;">Importo</th>
            <th style="text-align:left;">Note</th>
          </tr>
        </thead>
        <tbody>${paymentsRows}</tbody>
      </table>

      <h3 style="margin:24px 0 10px 0;font-size:16px;">Lavoro svolto</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th style="text-align:left;width:90px;">Tipo</th>
            <th style="text-align:left;">Descrizione</th>
            <th style="text-align:center;width:110px;">Qta</th>
            <th style="text-align:right;width:90px;">Prezzo</th>
            <th style="text-align:right;width:110px;">Totale</th>
            <th style="text-align:center;width:110px;">Stato</th>
          </tr>
        </thead>
        <tbody>${linesRows}</tbody>
      </table>

      <div class="print-signatures">
        <div class="print-signature-box">Firma azienda</div>
        <div class="print-signature-box">Firma cliente</div>
      </div>

      <div class="print-footer">
        Documento generato il ${new Date().toLocaleDateString("it-IT")} - PrevIA Works
      </div>
    </div>`;
}

function waitForNextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function waitForImages(root) {
  if (!root) return Promise.resolve();
  const images = Array.from(root.querySelectorAll("img"));
  if (!images.length) return Promise.resolve();
  return Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  }));
}

function waitForPrintReady(root) {
  const fontsReady = document.fonts?.ready?.catch(() => {}) || Promise.resolve();
  return Promise.all([waitForNextFrame(), waitForImages(root), fontsReady]);
}

function preparePrintRoot(html, { offscreen = false } = {}) {
  const root = $("#print-root");
  if (!root) return null;
  root.innerHTML = html;
  root.classList.remove("hidden");
  root.classList.toggle("print-offscreen", offscreen);
  document.body.classList.add("print-mode");
  root.getBoundingClientRect();
  return root;
}

function cleanupPrintRoot() {
  const root = $("#print-root");
  if (!root) return;
  root.classList.add("hidden");
  root.classList.remove("print-offscreen");
  root.innerHTML = "";
  document.body.classList.remove("print-mode");
}

function printQuote(id) {
  const quote = state.quotes.find(q => q.id === id);
  if (!quote) return;
  recalcQuoteTotals(quote);
  const root = preparePrintRoot(buildQuotePrintHTML(quote));
  if (!root) return;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupPrintRoot();
    window.removeEventListener("afterprint", handleAfterPrint);
    document.removeEventListener("visibilitychange", handleVisibility);
    clearTimeout(fallbackTimer);
  };

  const handleAfterPrint = () => cleanup();
  const handleVisibility = () => {
    if (document.visibilityState === "visible") cleanup();
  };

  window.addEventListener("afterprint", handleAfterPrint);
  document.addEventListener("visibilitychange", handleVisibility);
  const fallbackTimer = setTimeout(() => cleanup(), 15000);

  waitForPrintReady(root)
    .then(() => window.print())
    .catch(() => window.print());
}

function downloadQuotePdf(id) {
  const quote = state.quotes.find(q => q.id === id);
  if (!quote) return;
  if (!window.html2pdf) {
    showToast("Download PDF non disponibile");
    return;
  }
  recalcQuoteTotals(quote);
  const root = preparePrintRoot(buildQuotePrintHTML(quote), { offscreen: true });
  if (!root) return;
  const filename = `preventivo_${quote.number || quote.id}.pdf`;
  const options = {
    margin: 10,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
  waitForPrintReady(root)
    .then(() => window.html2pdf().set(options).from(root).save())
    .then(() => cleanupPrintRoot())
    .catch(() => {
      cleanupPrintRoot();
      showToast("Errore durante il download del PDF");
    });
}

function downloadJobReportPdf(id) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) return;
  if (!window.html2pdf) {
    showToast("Download PDF non disponibile");
    return;
  }
  const root = preparePrintRoot(buildJobReportHTML(job), { offscreen: true });
  if (!root) return;
  const filename = `report_pagamenti_${job.commessa || job.id}.pdf`;
  const options = {
    margin: 10,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
  waitForPrintReady(root)
    .then(() => window.html2pdf().set(options).from(root).save())
    .then(() => cleanupPrintRoot())
    .catch(() => {
      cleanupPrintRoot();
      showToast("Errore durante il download del PDF");
    });
}

// ---------------------------------------------------------------------------
// INIT & EVENTS
// ---------------------------------------------------------------------------
function renderAll() {
  renderBrand();
  renderNav();
  renderHome();
  renderHomeChart();
  renderHomeRecentMovements();
  renderJobs();
  if (ui.activeJobId) {
    // Aggiorna immediatamente i KPI del dettaglio lavoro (incassi/acconti inclusi)
    renderJobDetail();
  } else {
    renderJobDetailTabs();
  }
  renderQuotes();
  renderHistory();
  renderSettings();
  renderStorageWarning();
}

function initEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => { ui.activeTab = btn.dataset.tab; renderNav(); }));
  $("#btn-home-view-all")?.addEventListener("click", () => { ui.activeTab = "jobs"; renderNav(); renderJobs(); });
  $("#btn-job-back")?.addEventListener("click", () => { ui.activeTab = "jobs"; ui.activeJobId = null; renderNav(); });
  $("#btn-home-new")?.addEventListener("click", openSheetJobCreate);
  $("#qa-job")?.addEventListener("click", openSheetJobCreate);
  $("#qa-payment")?.addEventListener("click", () => openSheetPayment());
  $("#qa-quote")?.addEventListener("click", () => { ui.activeTab = "quotes"; ui.activeQuoteId = null; renderNav(); openWizard(); });
  $("#btn-jobs-new")?.addEventListener("click", openSheetJobCreate);
  $("#jobs-search")?.addEventListener("input", (e) => { ui.jobSearch = e.target.value; renderJobs(); });
  $("#jobs-filters")?.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => { ui.jobFilter = chip.dataset.filter; document.querySelectorAll("#jobs-filters .chip").forEach(c => c.classList.remove("active")); chip.classList.add("active"); renderJobs(); }));
  $("#job-detail-tabs")?.querySelectorAll(".segment-btn").forEach(btn => btn.addEventListener("click", () => { ui.jobDetailTab = btn.dataset.tab; renderJobDetailTabs(); }));
  $("#btn-add-payment")?.addEventListener("click", () => openSheetPayment(ui.activeJobId));
  $("#btn-add-purchase")?.addEventListener("click", () => openSheetPurchase(ui.activeJobId));
  $("#btn-add-line")?.addEventListener("click", () => openSheetJobLine(ui.activeJobId));
  $("#btn-job-report-pdf")?.addEventListener("click", () => { if (ui.activeJobId) downloadJobReportPdf(ui.activeJobId); });
  $("#btn-save-job-note")?.addEventListener("click", () => { const job = state.jobs.find(j => j.id === ui.activeJobId); if (job) { job.note = safeTrim($("#job-note-input").value); persist(); showToast("Note salvate"); } });
  $("#btn-job-delete")?.addEventListener("click", () => { if (!ui.activeJobId) return; const job = state.jobs.find(j => j.id === ui.activeJobId); askConfirm({ title: "Elimina lavoro", subtitle: job?.titolo || "", destructive: true }).then(ok => { if (!ok) return; deleteJobCascade(ui.activeJobId); persist(); ui.activeTab = "jobs"; renderAll(); showToast("Lavoro eliminato"); }); });
  $("#btn-open-quote-wizard")?.addEventListener("click", openWizard);
  $("#btn-cancel-wizard")?.addEventListener("click", closeWizard);
  $("#btn-wizard-next")?.addEventListener("click", () => wizardStep(2));
  $("#btn-wizard-back")?.addEventListener("click", () => wizardStep(1));
  $("#btn-wizard-create")?.addEventListener("click", createQuoteFromWizardFlow);
  $("#wizard-cliente")?.addEventListener("input", e => showWizardSuggestions(e.target.value));
  $("#quotes-search")?.addEventListener("input", renderQuotes);
  $("#btn-add-row")?.addEventListener("click", openSheetQuoteRow);
  $("#btn-quote-lock")?.addEventListener("click", () => { const q = state.quotes.find(q => q.id === ui.activeQuoteId); if (!q) return; recalcQuoteTotals(q); q.status = "locked"; persist(); renderQuotes(); });
  $("#btn-quote-unlock")?.addEventListener("click", () => { const q = state.quotes.find(q => q.id === ui.activeQuoteId); if (!q) return; q.status = "draft"; persist(); renderQuotes(); });
  $("#btn-quote-reset")?.addEventListener("click", () => { if (!ui.activeQuoteId) return; askConfirm({ title: "Reset preventivo", subtitle: "Cancella righe", destructive: false }).then(ok => { if (!ok) return; resetQuoteData(ui.activeQuoteId, false); persist(); renderQuotes(); }); });
  $("#btn-quote-delete")?.addEventListener("click", () => { if (!ui.activeQuoteId) return; const q = state.quotes.find(q => q.id === ui.activeQuoteId); askConfirm({ title: "Elimina preventivo", subtitle: q?.cliente || "", destructive: true }).then(ok => { if (!ok) return; deleteQuote(ui.activeQuoteId); persist(); renderQuotes(); }); });
  $("#btn-quote-print")?.addEventListener("click", () => printQuote(ui.activeQuoteId));
  $("#btn-quote-pdf")?.addEventListener("click", () => downloadQuotePdf(ui.activeQuoteId));
  $("#btn-quote-duplicate")?.addEventListener("click", () => { const copy = duplicateQuote(ui.activeQuoteId); if (copy) { persist(); renderQuotes(); showToast("Duplicato"); } });
  $("#btn-quote-confirm")?.addEventListener("click", () => { const job = confirmQuoteAsJob(ui.activeQuoteId); if (job) { persist(); renderAll(); showToast("Convertito in lavoro"); } });
  $("#btn-history-search")?.addEventListener("click", renderHistory);
  // History: default date and supplier autocomplete
  $("#history-new-date")?.setAttribute("value", toISODateOnly());
  $("#history-new-supplier")?.addEventListener("input", e => {
    const val = safeTrim(e.target.value);
    const suggest = $("#history-supplier-suggest");
    if (!suggest) return;
    const items = state.anagrafiche.fornitori.filter(f => safeUpper(f).includes(safeUpper(val))).slice(0, 6);
    if (!val || !items.length) { suggest.classList.add("hidden"); suggest.innerHTML = ""; return; }
    suggest.innerHTML = items.map(f => `<button type="button" data-sup="${escapeHTML(f)}">${escapeHTML(f)}</button>`).join("");
    suggest.classList.remove("hidden");
    suggest.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => { $("#history-new-supplier").value = btn.dataset.sup; suggest.classList.add("hidden"); }));
  });
  // History: live total compute
  const recomputeTotal = () => {
    const qty = parseImporto($("#history-new-qty")?.value || 0);
    const up = parseImporto($("#history-new-unitprice")?.value || 0);
    const tot = Number.isFinite(qty) && Number.isFinite(up) ? Math.round(qty * up * 100)/100 : 0;
    $("#history-new-total") && ($("#history-new-total").value = tot ? formatMoney.format(tot) : "0 €");
  };
  $("#history-new-qty")?.addEventListener("input", recomputeTotal);
  $("#history-new-unitprice")?.addEventListener("input", recomputeTotal);
  // History: save new purchase
  $("#btn-history-save-purchase")?.addEventListener("click", () => {
    const line = createPurchaseLine({
      fornitore: $("#history-new-supplier")?.value,
      prodotto: $("#history-new-product")?.value,
      qty: $("#history-new-qty")?.value,
      unit: $("#history-new-unit")?.value,
      unitPrice: $("#history-new-unitprice")?.value,
      commessa: $("#history-new-commessa")?.value,
      note: $("#history-new-note")?.value,
      dateISO: `${$("#history-new-date")?.value || toISODateOnly()}T12:00:00Z`,
    });
    if (!line) { showToast("Compila campi obbligatori"); return; }
    persist();
    renderHistory();
    showToast("Acquisto salvato");
    $("#history-new-product").value = "";
    $("#history-new-qty").value = "1";
    $("#history-new-unit").value = "pz";
    $("#history-new-unitprice").value = "0";
    $("#history-new-total").value = "0 €";
    $("#history-new-note").value = "";
  });
  // History: export filtered results
  $("#btn-history-export-csv")?.addEventListener("click", () => {
    const q = safeTrim($("#history-search")?.value || "");
    const forn = safeTrim($("#history-supplier")?.value || "");
    const year = safeTrim($("#history-year")?.value || "");
    const month = $("#history-month")?.value || 'all';
    const commessa = safeTrim($("#history-commessa")?.value || "");
    const order = $("#history-order")?.value || 'date-desc';
    const lines = getProductHistory({ prodotto: q, fornitore: forn, year, month, commessa, order });
    exportPurchasesCSV(lines);
  });
  $("#btn-history-export-json")?.addEventListener("click", () => {
    const q = safeTrim($("#history-search")?.value || "");
    const forn = safeTrim($("#history-supplier")?.value || "");
    const year = safeTrim($("#history-year")?.value || "");
    const month = $("#history-month")?.value || 'all';
    const commessa = safeTrim($("#history-commessa")?.value || "");
    const order = $("#history-order")?.value || 'date-desc';
    const lines = getProductHistory({ prodotto: q, fornitore: forn, year, month, commessa, order });
    exportPurchasesJSON(lines);
  });
  // History: import purchases
  $("#purchase-import")?.addEventListener("change", e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.purchaseLines) ? parsed.purchaseLines : [];
        if (!incoming.length) throw new Error("Formato non valido");
        let duplicates = 0, added = 0;
        incoming.forEach(pl => {
          const dateISO = pl.dateISO ? String(pl.dateISO) : `${toISODateOnly()}T12:00:00Z`;
          const fornitore = safeTrim(pl.fornitore);
          const prodotto = safeTrim(pl.prodotto);
          const qty = parseItalianFloat(pl.qty || 1);
          const unitPrice = parseItalianFloat(pl.unitPrice || 0);
          const tot = Math.round(qty * unitPrice * 100)/100;
          const exists = state.purchaseLines.some(l => l.dateISO === dateISO && safeUpper(l.fornitore) === safeUpper(fornitore) && safeUpper(l.prodotto) === safeUpper(prodotto) && Math.round(l.qty * l.unitPrice * 100)/100 === tot);
          if (exists) { duplicates++; return; }
          const line = createPurchaseLine({ fornitore, prodotto, qty, unit: safeTrim(pl.unit) || 'pz', unitPrice, commessa: pl.commessa, note: pl.note, dateISO });
          if (line) added++;
        });
        persist();
        renderHistory();
        showToast(`${added} importati · ${duplicates} duplicati ignorati`);
      } catch {
        showToast("File non valido");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
  $("#btn-save-company")?.addEventListener("click", updateCompanyFromInputs);
  $("#btn-backup")?.addEventListener("click", () => downloadBackup());
  $("#file-import")?.addEventListener("change", e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!parsed?.state) throw new Error(); state = loadState(); state = parsed.state ? { ...defaultState(), ...parsed.state } : state; persist(); renderAll(); showToast("Import completato"); } catch { showToast("File non valido"); } }; reader.readAsText(file); e.target.value = ""; });
  $("#btn-logo-upload")?.addEventListener("click", () => $("#logo-file-input")?.click());
  $("#logo-file-input")?.addEventListener("change", e => { 
    const file = e.target.files?.[0]; 
    if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = () => { 
      state.companyLogoDataUrl = reader.result; 
      persist(); 
      renderBrand(); 
      showToast("Logo aggiornato"); 
    }; 
    reader.readAsDataURL(file); 
    e.target.value = ""; 
  });
  $("#btn-reset-all")?.addEventListener("click", openResetAll);
  $("#btn-export-job")?.addEventListener("click", openExportJob);
  $("#btn-diagnostic")?.addEventListener("click", showDiagnosticReport);
  $("#btn-header-diagnostic")?.addEventListener("click", showDiagnosticReport);
}

// Wizard helpers
function openWizard() {
  ui.activeQuoteId = null;
  $("#quote-empty")?.classList.add("hidden");
  $("#quote-wizard")?.classList.remove("hidden");
  $("#quote-editor")?.classList.add("hidden");
  wizardStep(1);
}
function closeWizard() { $("#quote-wizard")?.classList.add("hidden"); renderQuoteEditor(); }
function wizardStep(step) {
  ui.quoteWizardStep = step;
  $("#wizard-step-label").textContent = step;
  $("#wizard-step-1")?.classList.toggle("hidden", step !== 1);
  $("#wizard-step-2")?.classList.toggle("hidden", step !== 2);
}
function showWizardSuggestions(val) {
  const suggest = $("#wizard-cliente-suggest");
  if (!suggest) return;
  const items = state.anagrafiche.clienti.filter(c => safeUpper(c).includes(safeUpper(val))).slice(0, 6);
  if (!val || !items.length) { suggest.classList.add("hidden"); return; }
  suggest.innerHTML = items.map(c => `<button type="button" data-client="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("");
  suggest.classList.remove("hidden");
  suggest.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => { $("#wizard-cliente").value = btn.dataset.client; suggest.classList.add("hidden"); }));
}
function createQuoteFromWizardFlow() {
  const cliente = safeTrim($("#wizard-cliente")?.value || "");
  const commessa = safeTrim($("#wizard-commessa")?.value || "");
  if (!cliente || !commessa) { showToast("Cliente e commessa obbligatori"); return; }
  const quote = createQuote(cliente, commessa);
  ui.activeQuoteId = quote.id;
  closeWizard();
  persist();
  renderQuotes();
  showToast("Preventivo creato");
}

// ---------------------------------------------------------------------------
// DIAGNOSTICA
// ---------------------------------------------------------------------------
function showDiagnosticReport() {
  const now = new Date();
  // Coerenza e controlli rapidi
  const quotesTotalsMismatches = [];
  state.quotes.forEach(q => {
    const righe = Array.isArray(q.righe) ? q.righe : [];
    const calc = righe.reduce((acc, r) => {
      const qty = parseItalianFloat(r.qty || 0);
      const price = parseItalianFloat(r.unitPrice || 0);
      const sconto = parseItalianFloat(r.sconto || 0);
      const iva = parseItalianFloat(r.iva || 0);
      const sub = qty * price * (1 - sconto / 100);
      acc.taxable += sub;
      acc.vat += sub * (iva / 100);
      return acc;
    }, { taxable: 0, vat: 0 });
    const exp = {
      taxable: Math.round(calc.taxable * 100) / 100,
      vat: Math.round(calc.vat * 100) / 100,
      total: Math.round((calc.taxable + calc.vat) * 100) / 100,
    };
    if (Math.abs((q.totals?.taxable || 0) - exp.taxable) > 0.01 || Math.abs((q.totals?.vat || 0) - exp.vat) > 0.01 || Math.abs((q.totals?.total || 0) - exp.total) > 0.01) {
      quotesTotalsMismatches.push({ id: q.id, number: q.number, stored: q.totals, expected: exp });
    }
  });

  const jobsResiduals = [];
  state.jobs.forEach(j => {
    const paid = getJobPaid(j.id);
    const due = Math.round((j.agreedTotal - paid) * 100) / 100;
    if (!Number.isFinite(due) || Math.abs(due) > j.agreedTotal * 10 || due < -0.01) {
      jobsResiduals.push({ id: j.id, titolo: j.titolo, agreedTotal: j.agreedTotal, paid, due });
    }
  });

  const invalidNumbers = [];
  state.jobPayments.forEach(p => { if (!Number.isFinite(p.amount) || p.amount <= 0) invalidNumbers.push({ entity: 'jobPayment', id: p.id, amount: p.amount }); });
  state.jobLines.forEach(l => { if (!Number.isFinite(l.qty) || !Number.isFinite(l.unitPrice) || l.qty < 0 || l.unitPrice < 0) invalidNumbers.push({ entity: 'jobLine', id: l.id, qty: l.qty, unitPrice: l.unitPrice }); });
  state.movimenti.forEach(m => { if (!Number.isFinite(m.importo) || m.importo < 0) invalidNumbers.push({ entity: 'movimento', id: m.id, importo: m.importo, tipo: m.tipo }); });
  const purchaseTotalsMismatch = [];
  state.purchaseLines.forEach(l => {
    const total = Math.round(l.qty * l.unitPrice * 100) / 100;
    if (!Number.isFinite(total) || total < 0) purchaseTotalsMismatch.push({ id: l.id, dateISO: l.dateISO, prodotto: l.prodotto, fornitore: l.fornitore, qty: l.qty, unitPrice: l.unitPrice, computedTotal: total });
  });

  const jobLinesByJob = state.jobs.reduce((acc, j) => { acc[j.id] = state.jobLines.filter(l => l.jobId === j.id).length; return acc; }, {});

  const report = {
    appVersion: APP_VERSION || state.version || "n/a",
    timestamp: now.toISOString(),
    timestampLocal: now.toLocaleString("it-IT"),
    userAgent: navigator.userAgent,
    storage: {
      disabled: storageDisabled,
      reason: storageDisabledReason || null,
      testWrite: (() => {
        try {
          localStorage.setItem("__test__", "1");
          localStorage.removeItem("__test__");
          return "OK";
        } catch {
          return "FAILED";
        }
      })(),
    },
    counts: {
      jobs: state.jobs.length,
      jobsOpen: state.jobs.filter(j => j.stato === "aperto").length,
      jobsClosed: state.jobs.filter(j => j.stato === "chiuso").length,
      quotes: state.quotes.length,
      quotesDraft: state.quotes.filter(q => q.status === "draft").length,
      quotesLocked: state.quotes.filter(q => q.status === "locked").length,
      movimenti: state.movimenti.length,
      jobPayments: state.jobPayments.length,
      jobLines: state.jobLines.length,
      purchaseLines: state.purchaseLines.length,
      clienti: state.anagrafiche.clienti.length,
      fornitori: state.anagrafiche.fornitori.length,
    },
    currentState: {
      activeJobId: ui.activeJobId,
      activeQuoteId: ui.activeQuoteId,
      activeTab: ui.activeTab,
    },
    checks: {
      jobLinesPersisted: state.jobLines.length > 0 ? `OK (${state.jobLines.length})` : "EMPTY",
      jobLinesPerJob: jobLinesByJob,
      quotesTotalsMismatches,
      jobsResiduals,
      invalidNumbers,
      purchaseTotalsMismatch,
    },
    errors: errorLog.slice(-20),
  };

  openSheet({
    title: "Diagnostica Sistema",
    subtitle: "Report tecnico",
    body: `
      <label class="input-label">Report (copia e invia allo sviluppatore)</label>
      <textarea id="diagnostic-report-text" class="input" rows="12" readonly style="font-family:monospace;font-size:11px;line-height:1.4;">${escapeHTML(JSON.stringify(report, null, 2))}</textarea>
    `,
    primaryLabel: "Copia",
    secondaryLabel: "Chiudi",
    onSubmit: () => {
      const text = JSON.stringify(report, null, 2);
      navigator.clipboard?.writeText(text).then(() => {
        showToast("Report copiato negli appunti");
      }).catch(() => {
        showToast("Impossibile copiare automaticamente");
      });
      return false; // Non chiudere sheet
    },
  });
}

// ---------------------------------------------------------------------------
// START
// ---------------------------------------------------------------------------
function init() {
  renderStorageWarning();
  renderBrand();
  renderQuickActions();
  initEvents();
  renderAll();
}

init();
