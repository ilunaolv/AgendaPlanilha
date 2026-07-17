/* =========================================================================
   Agenda do Prefeito — PWA
   Lê a aba "Prefeito" de uma planilha Google Sheets autenticada via Google.
   ========================================================================= */

const CONFIG = {
  CLIENT_ID: "999069950449-9i9pe1l5qvg09cvs0mtpli3s59i6p27r.apps.googleusercontent.com",
  SPREADSHEET_ID: "12B32YPPSnTrhSrV3u8tn87nd5nfKssv_vuUAe4_4YBQ",
  SHEET_NAME: "Prefeito (Em testes)",
  SCOPES: "https://www.googleapis.com/auth/spreadsheets",
  REFRESH_MIN: 15,
};

const GAPI_LOADER = "https://apis.google.com/js/api.js";

let tokenClient = null;
let accessToken = null;
let eventsByDate = new Map();
let selectedDate = startOfDay(new Date());
let viewMode = "dia"; // "dia" | "semana" | "mes"
let lastSync = null;
let refreshTimer = null;

/* ---------- utilidades de data / excel ---------- */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // segunda = 0
  return addDays(x, -dow);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function parseKey(s) {
  const [y, m, d] = s.split("-").map(Number);
  return startOfDay(new Date(y, m - 1, d));
}
function isoKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtBig(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtSmall(d) {
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}
function fmtDayNum(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function excelSerialToDate(serial) {
  if (serial == null) return null;
  const raw = String(serial).trim();
  const asNum = parseFloat(raw.replace(",", "."));
  if (!isNaN(asNum) && /^\d{1,5}(\.\d+)?$/.test(raw) && asNum > 1000) {
    const base = new Date(1899, 11, 30, 0, 0, 0, 0);
    return startOfDay(new Date(base.getTime() + Math.round(asNum) * 86400000));
  }
  let d = parseFlexDate(raw);
  return d ? startOfDay(d) : null;
}
function parseFlexDate(s) {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return new Date(y, Number(m[2]) - 1, Number(m[1]));
  }
  m = s.match(/^(\d{1,2})\s+de\s+([a-zçãõé]+)(?:\s+de\s+(\d{4}))?/i);
  if (m) {
    const meses = {
      jan: 0, janeiro: 0, fev: 1, fevereiro: 1, mar: 2, "março": 2, marco: 2,
      abr: 3, abril: 3, mai: 4, maio: 4, jun: 5, junho: 5, jul: 6, julho: 6,
      ago: 7, agosto: 7, set: 8, "setembro": 8, out: 9, outubro: 9,
      nov: 10, "novembro": 10, dez: 11, dezembro: 11,
    };
    const mes = meses[m[2].toLowerCase()];
    if (mes !== undefined) {
      const ano = m[3] ? Number(m[3]) : new Date().getFullYear();
      return new Date(ano, mes, Number(m[1]));
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function noteNum(s) {
  const n = parseFloat(String(s).replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function timeKey(s) {
  return (s || "99").replace(/[^0-9]/g, "").padStart(4, "0");
}
// Ordena por nota desc (10->0), depois horário asc.
function sortEvents(arr) {
  return [...arr].sort((a, b) => {
    const dn = noteNum(b.note) - noteNum(a.note);
    if (dn !== 0) return dn;
    return timeKey(a.time).localeCompare(timeKey(b.time));
  });
}

/* ---------- UI ---------- */

const el = (id) => document.getElementById(id);
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2600);
}
function show(view) {
  el("loginWrap").style.display = view === "login" ? "flex" : "none";
  el("app").style.display = view === "app" ? "block" : "none";
  el("loader").style.display = view === "loader" ? "block" : "none";
  el("loginBtn").style.display = accessToken ? "none" : "inline-flex";
  el("logoutBtn").style.display = accessToken ? "inline-flex" : "none";
}

function eventCard(e) {
  const isNo = e.presence === "Não" || e.presence === "Nao";
  const badge =
    e.presence === "Sim"
      ? `<span class="badge sim">Confirmado</span>`
      : e.presence === "Reservar"
      ? `<span class="badge res">Reservar</span>`
      : isNo
      ? `<span class="badge nao">Não comparece</span>`
      : "";
  const noteVal = noteNum(e.note);
  const noteCls = noteVal >= 7 ? "note hi" : "note";
  const note = e.note ? `<span class="tag ${noteCls}">📝 Nota ${escapeHtml(e.note)}</span>` : "";
  const sub = isNo && e.rep ? `<span class="tag rep">➡️ No lugar: ${escapeHtml(e.rep)}</span>` : "";
  const repTag = !isNo && e.rep ? `<span class="tag rep">👤 ${escapeHtml(e.rep)}</span>` : "";
  const subField = isNo
    ? `<div class="subbox">
         <input class="subinput" data-row="${e.rowIndex}" placeholder="Quem vai no seu lugar?" value="${escapeHtml(e.rep)}" />
         <button class="savebtn" data-row="${e.rowIndex}">Salvar</button>
       </div>`
    : "";
  return `
  <div class="card">
    <div class="time">🕑 ${escapeHtml(e.time || "—")} ${badge}</div>
    <div class="event">${escapeHtml(e.event || "(sem título)")}</div>
    <div class="meta">${note}${repTag}${sub}</div>
    <div class="actions">
      <button class="mini" data-act="sim" data-row="${e.rowIndex}">✓ Vou</button>
      <button class="mini" data-act="nao" data-row="${e.rowIndex}">✕ Não vou</button>
      <button class="mini" data-act="res" data-row="${e.rowIndex}">⏳ Reservar</button>
    </div>
    ${subField}
  </div>`;
}

function render() {
  const list = el("list");
  const title = el("dateBig");
  const sub = el("dateSmall");

  if (viewMode === "dia") {
    title.textContent = fmtBig(selectedDate);
    sub.textContent = fmtSmall(selectedDate);
    const evs = sortEvents(eventsByDate.get(isoKey(selectedDate)) || []);
    if (!evs.length) {
      list.innerHTML = `<div class="empty">Nenhum compromisso para este dia.</div>`;
    } else {
      list.innerHTML = evs.map(eventCard).join("");
    }
  } else if (viewMode === "semana") {
    const start = startOfWeek(selectedDate);
    const end = addDays(start, 6);
    title.textContent = `${fmtDayNum(start)} – ${fmtDayNum(end)}`;
    sub.textContent = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    let html = "";
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const key = isoKey(day);
      const evs = sortEvents(eventsByDate.get(key) || []);
      html += `<div class="period"><div class="period-head">
        <span class="pd">${day.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
        <span class="pd-num">${day.getDate()}</span>
        <span class="pd-count">${evs.length} ${evs.length === 1 ? "evento" : "eventos"}</span>
      </div>`;
      html += evs.length ? evs.map(eventCard).join("") : `<div class="empty small">—</div>`;
      html += `</div>`;
    }
    list.innerHTML = html;
  } else {
    const start = startOfMonth(selectedDate);
    title.textContent = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    sub.textContent = "Visão mensal";
    let html = "";
    let day = startOfMonth(selectedDate);
    while (day.getMonth() === selectedDate.getMonth()) {
      const key = isoKey(day);
      const evs = sortEvents(eventsByDate.get(key) || []);
      if (evs.length) {
        html += `<div class="period"><div class="period-head">
          <span class="pd">${day.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
          <span class="pd-num">${day.getDate()}</span>
          <span class="pd-count">${evs.length}</span>
        </div>`;
        html += evs.map(eventCard).join("");
        html += `</div>`;
      }
      day = addDays(day, 1);
    }
    list.innerHTML = html || `<div class="empty">Nenhum compromisso neste mês.</div>`;
  }
  wireCards(list);
}

function wireCards(list) {
  list.querySelectorAll("button[data-act]").forEach((b) => {
    b.onclick = async () => {
      const row = Number(b.dataset.row);
      const ev = findEventByRow(row);
      if (!ev) return;
      ev.presence = b.dataset.act === "sim" ? "Sim" : b.dataset.act === "nao" ? "Não" : "Reservar";
      await saveEvent(ev);
    };
  });
  list.querySelectorAll("button.savebtn").forEach((b) => {
    b.onclick = async () => {
      const row = Number(b.dataset.row);
      const ev = findEventByRow(row);
      if (!ev) return;
      const input = list.querySelector(`input.subinput[data-row="${row}"]`);
      ev.rep = input ? input.value.trim() : "";
      await saveEvent(ev);
    };
  });
}

function findEventByRow(row) {
  for (const evs of eventsByDate.values()) {
    const f = evs.find((e) => e.rowIndex === row);
    if (f) return f;
  }
  return null;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function updateSyncInfo() {
  el("syncInfo").textContent = lastSync
    ? `Sincronizado ${lastSync.toLocaleTimeString("pt-BR")} · ${eventsByDate.size} dias`
    : "";
}

/* ---------- Google auth + Sheets ---------- */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar " + src));
    document.head.appendChild(s);
  });
}

async function loadGapi() {
  await loadScript(GAPI_LOADER);
  await new Promise((resolve) => gapi.load("client", () => resolve()));
  await gapi.client.init({});
  await gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4");
}
async function ensureGapi() {
  if (typeof gapi === "undefined" || !gapi.client) await loadGapi();
  if (!gapi.client.sheets) await gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4");
}
async function ensureGsi() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    await loadScript("https://accounts.google.com/gsi/client");
  }
}

async function initAuth() {
  if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.includes("COLOQUE_SEU"))
    throw new Error("Configure CLIENT_ID no app.js.");
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.includes("COLOQUE_O"))
    throw new Error("Configure SPREADSHEET_ID no app.js.");
  await ensureGapi();
  await ensureGsi();
  console.log("[agenda] gapi + gsi prontos");
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (resp) => {
        if (resp.error) { toast("Erro de login: " + resp.error); return; }
        accessToken = resp.access_token;
        gapi.client.setToken({ access_token: accessToken });
        await afterLogin();
      },
    });
  }
}

async function afterLogin() {
  show("loader");
  try {
    await loadEvents();
    const keys = [...eventsByDate.keys()].sort();
    selectedDate = keys.length ? parseKey(keys[0]) : startOfDay(new Date());
    show("app");
    render();
    scheduleRefresh();
  } catch (e) {
    toast("Não foi possível carregar: " + e.message);
    show("app");
  }
}

async function signIn() {
  console.log("[agenda] signIn clicado");
  try {
    if (!tokenClient) { toast("Preparando login…"); await initAuth(); }
    if (!tokenClient) { toast("Falha ao preparar login."); return; }
    tokenClient.requestAccessToken({ prompt: "" });
  } catch (e) {
    console.error("[agenda] erro signIn:", e);
    toast("Erro: " + e.message);
  }
}
function signOut() {
  if (accessToken) { google.accounts.oauth2.revoke(accessToken, () => {}); gapi.client.setToken(null); }
  accessToken = null;
  clearInterval(refreshTimer);
  show("login");
}

async function loadEvents() {
  const range = `'${CONFIG.SHEET_NAME}'!A:F`;
  const r = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range,
  });
  const rows = r.result.values || [];
  console.log("[agenda] linhas lidas:", rows.length);
  eventsByDate = new Map();
  let ignored = 0, validEvents = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = excelSerialToDate(row[0]);
    if (!date) { ignored++; continue; }
    const ev = {
      rowIndex: i + 1,
      time: (row[1] || "").trim(),
      event: (row[2] || "").trim(),
      note: (row[3] || "").trim(),
      presence: (row[4] || "").trim(),
      rep: (row[5] || "").trim(),
    };
    if (!ev.event && !ev.time) continue;
    validEvents++;
    const key = isoKey(date);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key).push(ev);
  }
  console.log("[agenda] eventos válidos:", validEvents, "| datas:", eventsByDate.size);
  lastSync = new Date();
  updateSyncInfo();
}

async function saveEvent(ev) {
  if (!ev.rowIndex) { toast("Evento sem linha associada."); return; }
  const sheet = CONFIG.SHEET_NAME;
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `'${sheet}'!E${ev.rowIndex}`,
    valueInputOption: "RAW",
    values: [[ev.presence]],
  });
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `'${sheet}'!F${ev.rowIndex}`,
    valueInputOption: "RAW",
    values: [[ev.rep || ""]],
  });
  toast("Salvo na planilha ✓");
  await loadEvents();
  render();
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    try { await loadEvents(); render(); } catch (_) {}
  }, CONFIG.REFRESH_MIN * 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && accessToken) {
      loadEvents().then(render).catch(() => {});
    }
  });
}

function navPrev() {
  if (viewMode === "dia") selectedDate = addDays(selectedDate, -1);
  else if (viewMode === "semana") selectedDate = addDays(selectedDate, -7);
  else selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
  render();
}
function navNext() {
  if (viewMode === "dia") selectedDate = addDays(selectedDate, 1);
  else if (viewMode === "semana") selectedDate = addDays(selectedDate, 7);
  else selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
  render();
}
function setMode(m) {
  viewMode = m;
  document.querySelectorAll(".modebtn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === m);
  });
  render();
}

/* ---------- tema (claro/escuro) ---------- */

function applyTheme(light) {
  document.body.classList.toggle("light", light);
  el("themeBtn").textContent = light ? "☀️" : "🌙";
  try { localStorage.setItem("agenda_theme", light ? "light" : "dark"); } catch (_) {}
}
function initTheme() {
  let saved = "dark";
  try { saved = localStorage.getItem("agenda_theme") || "dark"; } catch (_) {}
  applyTheme(saved === "light");
  el("themeBtn").onclick = () => applyTheme(!document.body.classList.contains("light"));
}

/* ---------- bootstrap ---------- */

console.log("[agenda] boot iniciando…");

async function boot() {
  initTheme();
  el("loginBtn").onclick = signIn;
  el("loginBtn2").onclick = signIn;
  el("logoutBtn").onclick = signOut;
  el("refreshBtn").onclick = async () => {
    toast("Atualizando…");
    try { await loadEvents(); render(); toast("Atualizado"); }
    catch (e) { toast("Erro ao atualizar"); }
  };
  el("prevDay").onclick = navPrev;
  el("nextDay").onclick = navNext;
  el("todayBtn").onclick = () => { selectedDate = startOfDay(new Date()); render(); };
  document.querySelectorAll(".modebtn").forEach((b) => {
    b.onclick = () => setMode(b.dataset.mode);
  });

  window.addEventListener("online", () => {
    el("offlinePill").classList.remove("show");
    if (accessToken) loadEvents().then(render).catch(() => {});
  });
  window.addEventListener("offline", () => el("offlinePill").classList.add("show"));

  show("login");
  try {
    await initAuth();
    console.log("[agenda] pronto para login");
  } catch (e) {
    console.error("[agenda] erro initAuth:", e);
    toast("Erro ao iniciar: " + e.message);
  }
}

boot().catch((e) => console.error("[agenda] erro fatal boot:", e));
