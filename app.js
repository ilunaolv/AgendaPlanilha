/* =========================================================================
   Agenda do Prefeito — PWA
   Compatível com iOS/Safari. Credenciais em config.js (ver config.example.js).
   ========================================================================= */

const CONFIG = window.AGENDACONFIG || {};
const PEOPLE = (window.AGENDACONFIG && window.AGENDACONFIG.PEOPLE) || [];

const GAPI_LOADER = "https://apis.google.com/js/api.js";
const GIS_LOADER = "https://accounts.google.com/gsi/client";
const NOTIF_ADVANCE_MS = (CONFIG.NOTIF_ADVANCE_MIN || 60) * 60 * 1000;
const SCRIPT_TIMEOUT_MS = 15000;

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let eventsByDate = new Map();
let selectedDate = startOfDay(new Date());
let viewMode = "dia";
let lastSync = null;
let refreshTimer = null;
let hasUpdatePending = false;
const LAST_VERSION_KEY = "agenda_last_version";
let currentFilter = "todos";
let searchQuery = "";
let isRefreshingToken = false;
let tokenRefreshPromise = null;
const EVENTS_CACHE_KEY = "agenda_events_cache";
const EVENTS_CACHE_TTL_MS = 2 * 60 * 1000;
const PERMISSION_DENIED_CACHE_KEY = "agenda_permission_denied";
const PERMISSION_DENIED_TTL_MS = 10 * 60 * 1000;
const NOTIF_ENABLED_KEY = "agenda_notif_enabled";
let notifEnabled = false;
let notifQueue = [];
let notifIndex = 0;

/* ---------- persistência de token ---------- */

function saveToken(tok, expiresIn) {
  accessToken = tok;
  tokenExpiry = Date.now() + (expiresIn || 3600) * 1000;
  try { localStorage.setItem("agenda_token", JSON.stringify({ tok, exp: tokenExpiry })); } catch (_) {}
}
function loadToken() {
  try {
    const raw = localStorage.getItem("agenda_token");
    if (!raw) return false;
    const { tok, exp } = JSON.parse(raw);
    if (!tok) return false;
    accessToken = tok;
    tokenExpiry = exp;
    return true;
  } catch (_) { return false; }
}
function clearToken() {
  accessToken = null;
  tokenExpiry = 0;
  try { localStorage.removeItem("agenda_token"); } catch (_) {}
}
async function refreshAccessToken() {
  if (!tokenClient || isRefreshingToken) return false;
  try {
    isRefreshingToken = true;
    tokenRefreshPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout na renovacao do token"));
      }, 10000);
      const originalCallback = tokenClient.callback;
      tokenClient.callback = (resp) => {
        clearTimeout(timeout);
        tokenClient.callback = originalCallback;
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
        } else {
          saveToken(resp.access_token, resp.expires_in);
          gapi.client.setToken({ access_token: accessToken });
          resolve();
        }
      };
      tokenClient.requestAccessToken({ prompt: "" });
    });
    await tokenRefreshPromise;
    return true;
  } catch (e) {
    console.error("[agenda] erro ao renovar token:", e);
    return false;
  } finally {
    isRefreshingToken = false;
    tokenRefreshPromise = null;
  }
}
async function ensureValidToken() {
  if (!accessToken) return false;
  const now = Date.now();
  const expiresIn = tokenExpiry - now;
  if (expiresIn > 5 * 60 * 1000) return true;
  if (expiresIn <= 0) {
    const ok = await refreshAccessToken();
    if (!ok) {
      clearToken();
      show("login");
      toast("Sessao expirada. Faca login novamente.");
      return false;
    }
    return true;
  }
  return true;
}

/* ---------- utilidades de data ---------- */

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
  const dow = (x.getDay() + 6) % 7;
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
  return parseFlexDate(raw);
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
function sortEvents(arr) {
  return [...arr].sort((a, b) => timeKey(a.time).localeCompare(timeKey(b.time)));
}
function normPresence(p) {
  if (p === "Sim") return "Sim";
  if (p === "Reservar") return "Reservar";
  if (p === "Não" || p === "Nao") return "Não";
  return "";
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
function showLoading(on, msg) {
  const o = el("loadingOverlay");
  if (!o) return;
  const m = o.querySelector(".loading-msg");
  if (m) m.textContent = msg || "Carregando…";
  o.style.display = on ? "flex" : "none";
}
function show(view) {
  el("loginWrap").style.display = view === "login" ? "flex" : "none";
  el("app").style.display = view === "app" ? "block" : "none";
  el("loader").style.display = view === "loader" ? "block" : "none";
  el("loginBtn").style.display = accessToken ? "none" : "inline-flex";
  el("logoutBtn").style.display = accessToken ? "inline-flex" : "none";
}

function eventCard(e) {
  const p = normPresence(e.presence);
  const isNo = p === "Não";
  const badge =
    p === "Sim" ? `<span class="badge sim">Confirmado</span>`
    : p === "Reservar" ? `<span class="badge res">Reservar</span>`
    : isNo ? `<span class="badge nao">Não comparece</span>` : "";
  const noteVal = noteNum(e.note);
  let noteCls = "note";
  if (noteVal >= 9) noteCls = "note blue";
  else if (noteVal >= 7) noteCls = "note orange";
  else if (noteVal >= 1) noteCls = "note gray";
  const note = e.note ? `<span class="tag ${noteCls}">📝 Nota ${escapeHtml(e.note)}</span>` : "";
  const loc = e.local ? `<span class="tag loc">📍 ${escapeHtml(e.local)}</span>` : "";
  const sub = isNo && e.rep ? `<span class="tag rep">➡️ No lugar: ${escapeHtml(e.rep)}</span>` : "";
  const repTag = !isNo && e.rep ? `<span class="tag rep">👤 ${escapeHtml(e.rep)}</span>` : "";
  const act = (val) => `mini${p === val ? " active-" + val.toLowerCase() : ""}`;
  const subField = `<button class="pickbtn" data-row="${e.rowIndex}">Selecionar representante/acompanhante</button>`;
  const locBtn = `<button class="locbtn" data-row="${e.rowIndex}">📍 ${e.local ? "Abrir no Maps" : "Informar local"}</button>`;
  return `
  <div class="card">
    <div class="time">🕑 ${escapeHtml(e.time || "—")} ${badge}</div>
    <div class="event">${escapeHtml(e.event || "(sem título)")}</div>
    <div class="meta">${note}${loc}${repTag}${sub}</div>
    <div class="actions">
      <button class="${act("Sim")}" data-act="sim" data-row="${e.rowIndex}">✓ Vou</button>
      <button class="${act("Não")}" data-act="nao" data-row="${e.rowIndex}">✕ Não vou</button>
      <button class="${act("Reservar")}" data-act="res" data-row="${e.rowIndex}">⏳ Reservar</button>
    </div>
    ${locBtn}
    ${subField}
  </div>`;
}

function getFilteredEvents(evs) {
  let filtered = evs;
  if (currentFilter !== "todos") {
    filtered = filtered.filter((ev) => normPresence(ev.presence) === currentFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((ev) =>
      (ev.event || "").toLowerCase().includes(q) ||
      (ev.local || "").toLowerCase().includes(q) ||
      (ev.rep || "").toLowerCase().includes(q)
    );
  }
  return filtered;
}

function render() {
  const list = el("list");
  const title = el("dateBig");
  const sub = el("dateSmall");

  if (viewMode === "dia") {
    title.textContent = fmtBig(selectedDate);
    sub.textContent = fmtSmall(selectedDate);
    const evs = getFilteredEvents(sortEvents(eventsByDate.get(isoKey(selectedDate)) || []));
    if (evs.length) {
      list.innerHTML = evs.map(eventCard).join("");
    } else {
      const datas = [...eventsByDate.keys()].sort();
      const hint = datas.length ? `Há eventos em ${datas.length} dia(s). Use ‹ › para navegar.` : "Nenhum compromisso para este dia.";
      list.innerHTML = `<div class="empty">${hint}</div>`;
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
      const evs = getFilteredEvents(sortEvents(eventsByDate.get(key) || []));
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
      const evs = getFilteredEvents(sortEvents(eventsByDate.get(key) || []));
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
  updateTodayBtn();
  wireCards(list);
}

function wireCards(list) {
  list.querySelectorAll("button[data-act]").forEach((b) => {
    b.onclick = async () => {
      const {ev} = findEventByRow(Number(b.dataset.row));
      if (!ev) return;
      ev.presence = b.dataset.act === "sim" ? "Sim" : b.dataset.act === "nao" ? "Não" : "Reservar";
      if (ev.presence !== "Não") ev.rep = "";
      if ((ev.presence === "Não" || ev.presence === "Reservar") && ev.rep) {
        const reps = ev.rep.split(",").map((s) => s.trim()).filter(Boolean);
        if (reps.length) {
          const now = new Date();
          const evDate = parseKey(isoKey(selectedDate));
          const timeStr = (ev.time || "").replace(/[^0-9]/g, "");
          if (timeStr) {
            const hh = parseInt(timeStr.slice(0, 2), 10) || 0;
            const mm = parseInt(timeStr.slice(2, 4), 10) || 0;
            evDate.setHours(hh, mm, 0, 0);
            const diff = evDate - now;
            const mins = Math.max(1, Math.floor(diff / 60000));
            showNotifModal(ev, reps, mins);
          }
        }
      }
      await saveEvent(ev);
    };
  });
  list.querySelectorAll("button.pickbtn").forEach((b) => {
    b.onclick = () => openPicker(Number(b.dataset.row));
  });
  list.querySelectorAll("button.locbtn").forEach((b) => {
    b.onclick = () => openLoc(Number(b.dataset.row));
  });
}

function findEventByRow(row) {
  for (const [key, evs] of eventsByDate) {
    const f = evs.find((e) => e.rowIndex === row);
    if (f) return { key, ev: f };
  }
  return null;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function updateTodayBtn() {
  const btn = el("todayBtn");
  if (!btn) return;
  const today = startOfDay(new Date());
  const isToday = isoKey(selectedDate) === isoKey(today);
  btn.classList.toggle("today-indicator", isToday);
}
function updateSyncInfo() {
  el("syncInfo").textContent = lastSync
    ? `Sincronizado ${lastSync.toLocaleTimeString("pt-BR")} · ${eventsByDate.size} dias`
    : "";
  updatePendingBtn();
}
function updatePendingBtn() {
  const btn = el("updatePendingBtn");
  if (!btn) return;
  btn.style.display = hasUpdatePending ? "block" : "none";
}
function checkPendingUpdate() {
  const savedVer = localStorage.getItem(LAST_VERSION_KEY);
  const curVer = "v" + new Date().toISOString().slice(0, 10);
  hasUpdatePending = savedVer !== curVer;
  if (hasUpdatePending) {
    localStorage.setItem(LAST_VERSION_KEY, curVer);
  }
  updatePendingBtn();
}

/* ---------- notificacoes por evento ---------- */

function loadNotifEnabled() {
  try {
    notifEnabled = localStorage.getItem(NOTIF_ENABLED_KEY) === "1";
  } catch (_) {
    notifEnabled = false;
  }
}
function saveNotifEnabled() {
  try {
    localStorage.setItem(NOTIF_ENABLED_KEY, notifEnabled ? "1" : "0");
  } catch (_) {}
}
function updateNotifBtn() {
  const btn = el("testNotifBtn");
  if (!btn) return;
  btn.textContent = notifEnabled ? "🔔" : "🔕";
}
async function toggleNotifPermission() {
  if (!("Notification" in window)) {
    toast("Notificacoes nao suportadas.");
    return;
  }
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm === "granted") {
    notifEnabled = !notifEnabled;
    saveNotifEnabled();
    updateNotifBtn();
    toast(notifEnabled ? "Notificacoes ativadas" : "Notificacoes desativadas");
    if (notifEnabled) checkNotifNow(true);
  } else {
    toast("Permissao de notificacao negada.");
  }
}

async function checkNotifNow(autoOpen) {
  if (!notifEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const queue = [];
  for (const [key, evs] of eventsByDate) {
    for (const ev of evs) {
      const timeStr = (ev.time || "").replace(/[^0-9]/g, "");
      if (!timeStr) continue;
      const hh = parseInt(timeStr.slice(0, 2), 10) || 0;
      const mm = parseInt(timeStr.slice(2, 4), 10) || 0;
      const evDate = parseKey(key);
      evDate.setHours(hh, mm, 0, 0);
      const diff = evDate - now;
      if (diff > 0 && diff < NOTIF_ADVANCE_MS) {
        queue.push({ ev, mins: Math.floor(diff / 60000) });
      }
    }
  }
  if (!queue.length) return;
  notifQueue = queue;
  notifIndex = 0;
  const { ev, mins } = queue[0];
  const reps = (ev.rep || "").split(",").map((s) => s.trim()).filter(Boolean);
  const hasReps = reps.length && (ev.presence === "Não" || ev.presence === "Reservar");
  const showModal = autoOpen || hasReps;
  if (showModal && hasReps) {
    showNotifModal(ev, reps, mins, queue.length > 1);
  } else if (showModal && !hasReps) {
    showNotifModal(ev, reps, mins, queue.length > 1);
  }
  const body = mins > 0
    ? `Inicia em ${mins} minuto(s) — ${ev.event || "Evento"}`
    : `🕑 ${ev.time || ""} — ${ev.event || "Evento"}`;
  new Notification("Agenda do Prefeito", {
    body,
    icon: "icon.svg",
  });
}

let currentNotifOverlay = null;
function showNotifModal(ev, reps, mins, hasMore) {
  if (currentNotifOverlay) currentNotifOverlay.remove();
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const repList = reps.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  const {key} = findEventByRow(ev.rowIndex) || {};
  const dateStr = key ? fmtBig(parseKey(key)) : "";
  const timeStr = ev.time ? `às ${escapeHtml(ev.time)}` : "";
  const localStr = ev.local ? `Local: ${escapeHtml(ev.local)}` : "";
  const details = [dateStr, timeStr, localStr].filter(Boolean).join("<br>");
  const isLast = !hasMore && notifIndex >= notifQueue.length - 1;
  const navHtml = hasMore
    ? `<button class="primary" id="notifNext">Proximo aviso (${notifQueue.length - notifIndex - 1} restantes)</button>`
    : "";
  overlay.innerHTML = `
    <div class="modal notif-modal">
      <h3>Notificação de evento</h3>
      <p><b>${escapeHtml(ev.event || "Evento")}</b> será realizado daqui ${mins} minuto(s).</p>
      ${details ? `<p>${details}</p>` : ""}
      <p>Os representantes/acompanhantes abaixo irão comparecer:</p>
      <ul class="rep-list">${repList}</ul>
      ${navHtml}
      ${isLast ? `<button class="primary close-btn" id="notifModalClose">Fechar</button>` : ""}
    </div>`;
  document.body.appendChild(overlay);
  currentNotifOverlay = overlay;
  const close = () => {
    overlay.remove();
    currentNotifOverlay = null;
    notifQueue = [];
    notifIndex = 0;
  };
  if (isLast) {
    overlay.querySelector("#notifModalClose").onclick = close;
  }
  if (hasMore) {
    const nextBtn = overlay.querySelector("#notifNext");
    if (nextBtn) {
      nextBtn.onclick = async () => {
        overlay.remove();
        notifIndex += 1;
        const nextIdx = notifIndex % notifQueue.length;
        const nextItem = notifQueue[nextIdx];
        const nextReps = (nextItem.ev.rep || "").split(",").map((s) => s.trim()).filter(Boolean);
        const more = notifQueue.length > 1;
        showNotifModal(nextItem.ev, nextReps, nextItem.mins, more);
      };
    }
  }
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

/* ---------- modais ---------- */

function openPicker(row) {
  const {ev} = findEventByRow(row);
  if (!ev) {
    toast("Evento não encontrado para este representante.");
    return;
  }
  const current = (ev.rep || "").split(",").map((s) => s.trim()).filter(Boolean);
  const others = current.filter((c) => !PEOPLE.includes(c));
  const sel = new Set(current);
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  let opts = PEOPLE.map((p) =>
    `<label class="pick"><input type="checkbox" value="${escapeHtml(p)}" ${sel.has(p) ? "checked" : ""}/> ${escapeHtml(p)}</label>`
  ).join("");
  if (others.length) {
    opts += others.map((o) =>
      `<label class="pick"><input type="checkbox" value="${escapeHtml(o)}" checked/> ${escapeHtml(o)}</label>`
    ).join("");
  }
  overlay.innerHTML = `
    <div class="modal">
      <h3>Selecionar representante/acompanhante</h3>
      <div class="picklist">${opts || '<div class="empty small">Nenhuma pessoa cadastrada</div>'}</div>
      <label class="pick"><input type="checkbox" id="pickOutro"/> Outro…</label>
      <input class="subinput" id="pickOutroTxt" placeholder="Digite o nome" style="display:none;margin-top:8px;width:100%" />
      <div class="modal-actions">
        <button id="pickCancel">Cancelar</button>
        <button class="primary" id="pickOk">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const outro = overlay.querySelector("#pickOutro");
  const outroTxt = overlay.querySelector("#pickOutroTxt");
  outro.onchange = () => { outroTxt.style.display = outro.checked ? "block" : "none"; };
  overlay.querySelector("#pickCancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelector("#pickOk").onclick = async () => {
    const chosen = [...overlay.querySelectorAll('input[type=checkbox]:not(#pickOutro):checked')]
      .map((c) => c.value.trim()).filter(Boolean);
    if (outro.checked && outroTxt.value.trim()) chosen.push(outroTxt.value.trim());
    ev.rep = chosen.join(", ");
    overlay.remove();
    await saveEvent(ev);
  };
}

function openLoc(row) {
  const {ev} = findEventByRow(row);
  if (!ev) return;
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const mapsUrl = ev.local ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.local)}` : "";
  overlay.innerHTML = `
    <div class="modal">
      <h3>Local do evento</h3>
      <input class="subinput" id="locTxt" placeholder="Ex: Paço Municipal" value="${escapeHtml(ev.local || "")}" style="width:100%" />
      ${mapsUrl ? `<a class="loclink" href="${mapsUrl}" target="_blank" rel="noopener">🗺 Abrir no Google Maps</a>` : ""}
      <div class="modal-actions">
        <button id="locCancel">Cancelar</button>
        <button class="primary" id="locOk">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#locCancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelector("#locOk").onclick = async () => {
    ev.local = overlay.querySelector("#locTxt").value.trim();
    overlay.remove();
    await saveEvent(ev);
    if (ev.local) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.local)}`;
      window.open(url, "_blank");
    }
  };
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
async function withTimeout(promise, ms, label) {
  let timeout;
  const wrapped = promise.then(
    (v) => { clearTimeout(timeout); return v; },
    (e) => { clearTimeout(timeout); throw e; }
  );
  return Promise.race([
    wrapped,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} excedeu o tempo limite (${ms / 1000}s).`)), ms);
    }),
  ]);
}

async function loadGapi() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await withTimeout(loadScript(GAPI_LOADER), SCRIPT_TIMEOUT_MS, "Carregamento do Google API");
      await withTimeout(new Promise((resolve) => gapi.load("client", () => resolve())), SCRIPT_TIMEOUT_MS, "Inicializacao do gapi");
      await withTimeout(gapi.client.init({}), SCRIPT_TIMEOUT_MS, "Inicializacao do cliente Google");
      await withTimeout(gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4"), SCRIPT_TIMEOUT_MS, "Carregamento do Sheets API");
      console.log("[agenda] gapi carregado (tentativa", attempt, ")");
      return;
    } catch (e) {
      console.error("[agenda] loadGapi tentativa", attempt, "erro:", e);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw new Error("Falha ao carregar Google API após 3 tentativas. Verifique sua conexão.");
}
async function ensureGapi() {
  if (typeof gapi === "undefined" || !gapi.client) await loadGapi();
  if (!gapi.client.sheets) await gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4");
}
async function ensureGsi() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    await withTimeout(loadScript(GIS_LOADER), SCRIPT_TIMEOUT_MS, "Carregamento do Google Identity");
  }
}

async function initAuth() {
  if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.includes("SEU_CLIENT_ID"))
    throw new Error("Crie config.js a partir de config.example.js e preencha CLIENT_ID.");
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.includes("ID_DA_PLANILHA"))
    throw new Error("Crie config.js a partir de config.example.js e preencha SPREADSHEET_ID.");
  await ensureGapi();
  await ensureGsi();
  console.log("[agenda] gapi + gsi prontos");
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (resp) => {
        if (resp.error) {
          showLoading(false);
          if (resp.error === "origin_mismatch" || (resp.error_description || "").includes("origin_mismatch")) {
            toast("Erro: origem não autorizada. Adicione a URL nas Origens JS do Google Cloud.");
          } else if (resp.error === "access_denied") {
            toast("Login cancelado.");
          } else {
            toast("Erro de login: " + (resp.error_description || resp.error));
          }
          console.error("[agenda] oauth error:", resp);
          return;
        }
        saveToken(resp.access_token, resp.expires_in);
        gapi.client.setToken({ access_token: accessToken });
        await afterLogin();
      },
    });
  }
}

async function afterLogin() {
  showLoading(true, "Carregando agenda…");
  try {
    await ensureGapi();
    if ((CONFIG.SHEET_NAME || "").trim().toLowerCase().startsWith("prefeito")) {
      // ok
    } else {
      throw new Error("SHEET_NAME_INVALID");
    }
    await loadEventsFresh();
    selectedDate = startOfDay(new Date());
    show("app");
    render();
    scheduleRefresh();
    toast(`Sincronizado: ${eventsByDate.size} dias`);
    console.log("[agenda] carregado, eventos:", eventsByDate.size, "dias");
    if (notifEnabled) checkNotifNow(true);
  } catch (e) {
    console.error("[agenda] afterLogin erro:", e);
    const msg = (e && (e.message || e.error_description || JSON.stringify(e))) || "erro desconhecido";
    if (msg === "PERMISSION_DENIED" || String(msg).toLowerCase().includes("permission") || String(msg).includes("403")) {
      toast("Acesso negado: você não tem permissão para esta planilha.");
      clearToken();
      gapi.client.setToken(null);
      accessToken = null;
      show("login");
    } else if (msg === "PERMISSION_DENIED_CACHED") {
      toast("Acesso negado: você não tem permissão para esta planilha.");
      clearToken();
      gapi.client.setToken(null);
      accessToken = null;
      show("login");
    } else if (msg === "SHEET_NAME_INVALID") {
      toast("Configuracao invalida: a aba da planilha deve ser 'Prefeito'.");
      clearToken();
      gapi.client.setToken(null);
      accessToken = null;
      show("login");
    } else {
      toast("Não foi possível carregar: " + msg);
      selectedDate = startOfDay(new Date());
      show("app");
      render();
    }
  } finally {
    showLoading(false);
  }
}

async function signIn() {
  console.log("[agenda] signIn clicado");
  try {
    if (!tokenClient) { toast("Preparando login…"); await initAuth(); }
    if (!tokenClient) { toast("Falha ao preparar login."); return; }
    showLoading(true, "Abrindo login…");
    let didOpen = false;
    try {
      tokenClient.requestAccessToken({ prompt: "" });
      didOpen = true;
    } catch (_) {
      tokenClient.requestAccessToken({ prompt: "consent" });
      didOpen = true;
    }
    if (!didOpen) throw new Error("Não foi possível abrir o login Google.");
  } catch (e) {
    console.error("[agenda] erro signIn:", e);
    toast("Erro: " + e.message);
    showLoading(false);
  }
}
function signOut() {
  clearToken();
  if (accessToken) { try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch (_) {} }
  gapi.client.setToken(null);
  accessToken = null;
  clearInterval(refreshTimer);
  clearEventsCache();
  clearPermissionDeniedCache();
  notifEnabled = false;
  saveNotifEnabled();
  updateNotifBtn();
  show("login");
}

function getCachedEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > EVENTS_CACHE_TTL_MS) return null;
    return data;
  } catch (_) { return null; }
}
function setCachedEvents(data) {
  try {
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}
function clearEventsCache() {
  try { localStorage.removeItem(EVENTS_CACHE_KEY); } catch (_) {}
}
function cachePermissionDenied() {
  try { localStorage.setItem(PERMISSION_DENIED_CACHE_KEY, String(Date.now())); } catch (_) {}
}
function isPermissionDeniedCached() {
  try {
    const raw = localStorage.getItem(PERMISSION_DENIED_CACHE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (Date.now() - ts > PERMISSION_DENIED_TTL_MS) {
      localStorage.removeItem(PERMISSION_DENIED_CACHE_KEY);
      return false;
    }
    return true;
  } catch (_) { return false; }
}
function clearPermissionDeniedCache() {
  try { localStorage.removeItem(PERMISSION_DENIED_CACHE_KEY); } catch (_) {}
}

async function loadEvents() {
  await loadEventsInner(false);
}
async function loadEventsFresh() {
  await loadEventsInner(true);
}
async function loadEventsInner(force) {
  if (!(await ensureValidToken())) return;
  if (isPermissionDeniedCached()) {
    throw new Error("PERMISSION_DENIED_CACHED");
  }
  if (!force) {
    const cached = getCachedEvents();
    if (cached && cached.length) {
      eventsByDate = new Map();
      for (const item of cached) {
        eventsByDate.set(item.key, item.evs);
      }
      lastSync = new Date();
      updateSyncInfo();
      return;
    }
  }
  const range = `'${CONFIG.SHEET_NAME}'!A:G`;
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range,
      });
      const rows = r.result.values || [];
      console.log(`[agenda] tentativa ${attempt}: linhas lidas:`, rows.length);
      if (!rows.length) console.warn("[agenda] planilha retornou vazio — verifique nome da aba/range");
      eventsByDate = new Map();
      let loaded = 0;
      let skippedDate = 0;
      let skippedEmpty = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rawDate = row[0];
        const date = excelSerialToDate(rawDate);
        if (!date) {
          skippedDate++;
          if (attempt === 1 && i <= 5) {
            console.warn(`[agenda] linha ${i+1}: data inválida/parse falhou:`, rawDate);
          }
          continue;
        }
        const ev = {
          rowIndex: i + 1,
          time: (row[1] || "").trim(),
          event: (row[2] || "").trim(),
          note: (row[3] || "").trim(),
          presence: (row[4] || "").trim(),
          rep: (row[5] || "").trim(),
          local: (row[6] || "").trim(),
        };
        if (!ev.event && !ev.time) { skippedEmpty++; continue; }
        loaded++;
        const key = isoKey(date);
        if (!eventsByDate.has(key)) eventsByDate.set(key, []);
        eventsByDate.get(key).push(ev);
      }
      console.log(`[agenda] tentativa ${attempt}: eventos carregados:`, loaded, "| datas:", eventsByDate.size, "| pulados sem data:", skippedDate, "| pulados vazios:", skippedEmpty);
      if (!loaded) console.warn("[agenda] nenhum evento válido — verifique colunas/data/horário/evento");
      lastSync = new Date();
      updateSyncInfo();
      const cacheData = [];
      for (const [key, evs] of eventsByDate) {
        cacheData.push({ key, evs });
      }
      setCachedEvents(cacheData);
      clearPermissionDeniedCache();
      return;
    } catch (e) {
      lastErr = e;
      const status = (e && e.result && e.result.status) || (e && e.status) || 0;
      if (status === 403 || status === 401) {
        cachePermissionDenied();
        throw new Error("PERMISSION_DENIED");
      }
      console.error(`[agenda] loadEvents tentativa ${attempt} erro:`, e);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr || new Error("Falha ao carregar eventos após 2 tentativas");
}

async function saveEvent(ev) {
  if (!(await ensureValidToken())) return;
  if (!ev.rowIndex) { toast("Evento sem linha associada."); return; }
  const sheet = CONFIG.SHEET_NAME;
  showLoading(true, "Salvando…");
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `'${sheet}'!E${ev.rowIndex}`,
      valueInputOption: "RAW", values: [[ev.presence]],
    });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `'${sheet}'!F${ev.rowIndex}`,
      valueInputOption: "RAW", values: [[ev.rep || ""]],
    });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `'${sheet}'!G${ev.rowIndex}`,
      valueInputOption: "RAW", values: [[ev.local || ""]],
    });
    toast("Salvo na planilha ✓");
    clearEventsCache();
    await loadEvents();
    render();
  } catch (e) {
    toast("Erro ao salvar: " + e.message);
  } finally {
    showLoading(false);
  }
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    try { await loadEventsFresh(); render(); if (notifEnabled) checkNotifNow(); } catch (_) {}
  }, CONFIG.REFRESH_MIN * 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && accessToken) {
      loadEventsFresh().then((r) => { render(); if (notifEnabled) checkNotifNow(); }).catch(() => {});
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

/* ---------- tema ---------- */

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

/* ---------- bootstrap (iOS-safe) ---------- */

async function boot() {
  initTheme();
  loadNotifEnabled();
  updateNotifBtn();
  checkPendingUpdate();
  el("loginBtn").onclick = signIn;
  el("loginBtn2").onclick = signIn;
  el("logoutBtn").onclick = signOut;
  el("refreshBtn").onclick = async () => {
    showLoading(true, "Atualizando…");
    try { await loadEventsFresh(); render(); toast("Atualizado"); }
    catch (e) { toast("Erro ao atualizar"); }
    finally { showLoading(false); }
  };
  const upBtn = el("updatePendingBtn");
  if (upBtn) upBtn.onclick = async () => {
    hasUpdatePending = false;
    updatePendingBtn();
    showLoading(true, "Atualizando…");
    try { await loadEventsFresh(); render(); toast("Atualizado"); }
    catch (e) { toast("Erro ao atualizar"); }
    finally { showLoading(false); }
  };
  el("prevDay").onclick = navPrev;
  el("nextDay").onclick = navNext;
  el("todayBtn").onclick = () => { selectedDate = startOfDay(new Date()); render(); };
  document.querySelectorAll(".modebtn").forEach((b) => {
    b.onclick = () => setMode(b.dataset.mode);
  });
  document.querySelectorAll("#filterBar button").forEach((b) => {
    b.onclick = () => {
      currentFilter = b.dataset.filter;
      document.querySelectorAll("#filterBar button").forEach((x) => x.classList.toggle("active", x === b));
      render();
    };
  });
  const searchInput = el("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });
  }
  const testNotifBtn = el("testNotifBtn");
  if (testNotifBtn) {
    testNotifBtn.onclick = toggleNotifPermission;
  }
  window.addEventListener("online", () => {
    el("offlinePill").classList.remove("show");
    if (accessToken) loadEventsFresh().then(render).catch(() => {});
  });
  window.addEventListener("offline", () => el("offlinePill").classList.add("show"));

  if (loadToken()) {
    const valid = await ensureValidToken();
    if (!valid) return;
    show("loader");
    try {
      await ensureGapi();
      gapi.client.setToken({ access_token: accessToken });
      await afterLogin();
    } catch (e) {
      console.error("[agenda] falha ao reusar token:", e);
      clearToken();
      showLoading(false);
      show("login");
      toast("Nao foi possivel reconectar. Faca login novamente.");
    }
  } else {
    show("login");
    initAuth()
      .then(() => console.log("[agenda] pronto para login"))
      .catch((e) => {
        console.error("[agenda] erro initAuth:", e);
        toast("Erro ao iniciar: " + (e && e.message ? e.message : "verifique sua conexao"));
      });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
