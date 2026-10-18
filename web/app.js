/* kanbanD — Zustand, Laden, Handlungen, Ereignisse. Der Ordner ist die Wahrheit; die Seite fragt nach. */
const S = { zustand: null, board: null, aufgaben: [], ich: null, extern: {}, live: true, ui: { slug: null, first: null, fehler: null, pop: null } };
try { S.ich = sessionStorage.getItem('kanbanD.ich'); } catch (_) { }

function ichSetzen(k) {
  S.ich = k;
  try { sessionStorage.setItem('kanbanD.ich', k); } catch (_) { }
}

async function api(methode, pfad, daten) {
  const headers = {};
  if (daten) headers['Content-Type'] = 'application/json';
  if (S.ich) headers['X-KanbanD-Wer'] = S.ich;
  const r = await fetch(pfad, { method: methode, headers, body: daten ? JSON.stringify(daten) : undefined });
  const text = await r.text();
  const json = text ? JSON.parse(text) : null;
  if (!r.ok) throw Object.assign(new Error(json && json.fehler || r.statusText), { status: r.status });
  return json;
}

function gewaehltesBoard() {
  const m = /^#\/board\/([^/]+)/.exec(location.hash);
  const slugs = S.zustand.boards.map(b => b.slug);
  return m && slugs.includes(m[1]) ? m[1] : slugs[0] || null;
}

async function laden() {
  S.zustand = await api('GET', '/api/zustand');
  if (!S.zustand.eingerichtet) {
    S.ui.first = S.ui.first || { kuerzel: '', name: '', agenten: { cl: true }, board: 'Entwicklung', spalten: 'Zu erledigen, In Arbeit, Erledigt', wbs: '', anf: '' };
  } else {
    S.ui.first = null;
    S.ui.slug = gewaehltesBoard();
    const [board, aufgaben] = await Promise.all([
      S.ui.slug ? api('GET', '/api/boards/' + encodeURIComponent(S.ui.slug)) : null,
      api('GET', '/api/aufgaben'),
    ]);
    S.board = board;
    S.aufgaben = aufgaben.aufgaben;
  }
  render();
}

/** Schreibende Aktionen brauchen eine Identität; fehlt sie, öffnet sich „Ich bin …“ mit Hinweis. */
function ichNoetig() {
  if (S.ich && personen().some(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv)) return false;
  S.ui.pop = 'ich'; S.ui.ichNoetig = true;
  return true;
}

function render() {
  $('#kopf').innerHTML = vKopf();
  $('#main').innerHTML = S.ui.first ? vFirst() : vBoard();
  $('#over').innerHTML = vPop();
  $('#stat').innerHTML = vStatus();
  popPlatzieren();
  if (S.ui.fokus) { const f = $(S.ui.fokus); S.ui.fokus = null; if (f) f.focus(); }
}

function popPlatzieren() {
  const p = $('#pop');
  if (!p) return;
  const t = document.getElementById(p.dataset.for);
  if (!t) { S.ui.pop = null; p.remove(); return; }
  const r = t.getBoundingClientRect();
  p.style.top = (r.bottom + 2) + 'px';
  p.style.left = (p.dataset.al === 'r' ? Math.max(4, r.right - p.offsetWidth) : r.left) + 'px';
}

async function act(a, arg, wert) {
  const u = S.ui;
  try {
    switch (a) {
      case 'pop': u.pop = u.pop === arg ? null : arg; if (arg !== 'ich') u.ichNoetig = false; break;
      case 'ich': ichSetzen(arg); u.pop = null; u.ichNoetig = false; break;
      case 'add': if (ichNoetig()) break; u.adding = arg; u.fokus = '#add-inp'; break;
      case 'add-ok': {
        const titel = (wert || '').trim();
        if (!titel) { u.adding = null; break; }
        if (ichNoetig()) break;
        await api('POST', '/api/aufgaben', { titel, board: u.slug, spalte: arg });
        u.fokus = '#add-inp';
        return laden();
      }
      case 'bewegen': {
        if (ichNoetig()) break;
        const bw = JSON.parse(arg);
        // gleich sichtbar machen, dann vom Server bestätigen lassen
        const quelle = S.board.spalten.find(sp => sp.aufgaben.includes(bw.nummer));
        if (quelle) {
          quelle.aufgaben = quelle.aufgaben.filter(n => n !== bw.nummer);
          S.board.spalten.find(sp => sp.name === bw.spalte).aufgaben.splice(bw.index, 0, bw.nummer);
          render();
        }
        await api('POST', `/api/boards/${encodeURIComponent(u.slug)}/bewegen`, bw);
        return laden();
      }
      case 'fr-agent': u.first.agenten[arg] = !u.first.agenten[arg]; break;
      case 'first-ok': {
        const f = u.first, e = ersteEinstellungen(f);
        const antwort = await api('POST', '/api/einrichten', {
          ich: { kuerzel: e.personen[0].kuerzel, name: e.personen[0].name },
          agenten: e.personen.slice(1).map(p => ({ kuerzel: p.kuerzel, name: p.name })),
          board: f.board.trim(), spalten: spaltenListe(f), quellen: e.quellen,
        });
        ichSetzen(e.personen[0].kuerzel);
        location.hash = '#/board/' + antwort.board;
        return laden();
      }
      default: return;
    }
  } catch (fehler) {
    if (u.first) u.first.fehler = fehler.message; else u.fehler = fehler.message;
    if (!u.first) await /* Live: jede Änderung im Ordner lädt neu; Änderungen von außen markieren die betroffenen Karten 10 s. */
function spaltenJeAufgabe() {
  const m = {};
  if (S.board) S.board.spalten.forEach(sp => sp.aufgaben.forEach(n => { m[n] = sp.name; }));
  return m;
}

async function ereignis(e) {
  const vorher = spaltenJeAufgabe();
  await laden();
  if (!e.extern) return;
  const jetzt = Date.now();
  for (const a of S.aufgaben) if (e.pfade.includes('aufgaben/' + a.datei)) S.extern[a.nummer] = { at: jetzt, datei: 'aufgaben/' + a.datei };
  const boardDatei = S.ui.slug && 'boards/' + S.ui.slug + '.md';
  if (boardDatei && e.pfade.includes(boardDatei)) {
    const nachher = spaltenJeAufgabe();
    for (const n of Object.keys(nachher)) if (vorher[n] !== nachher[n]) S.extern[n] = { at: jetzt, datei: boardDatei };
  }
  render();
}

function liveVerbinden() {
  if (typeof EventSource === 'undefined') return;
  const q = new EventSource('/api/ereignisse');
  q.onmessage = m => ereignis(JSON.parse(m.data)).catch(() => { });
  q.onerror = () => { if (S.live) { S.live = false; render(); } };
  q.onopen = () => { if (!S.live) { S.live = true; laden().catch(() => { }); } };
}

setInterval(() => {
  const jetzt = Date.now();
  let neu = false;
  for (const [n, x] of Object.entries(S.extern)) if (jetzt - x.at >= 10000) { delete S.extern[n]; neu = true; }
  document.querySelectorAll('[data-ext]').forEach(el => { el.textContent = `extern · ${el.dataset.datei} · vor ${Math.round((jetzt - +el.dataset.ext) / 1000)} Sek`; });
  if (neu && zug == null && !S.ui.adding) render();
}, 1000);

liveVerbinden();
laden().catch(() => { });
  }
  render();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (S.ui.pop && !e.target.closest('.pop') && !(el && el.dataset.act === 'pop')) {
    S.ui.pop = null; S.ui.ichNoetig = false;
    if (!el) { render(); return; }
  }
  if (!el || el.disabled) return;
  if (el.tagName === 'A') e.preventDefault();
  act(el.dataset.act, el.dataset.arg);
});
document.addEventListener('input', e => {
  const fr = e.target.dataset && e.target.dataset.fr;
  if (fr && S.ui.first) {
    S.ui.first[fr] = e.target.value;
    S.ui.first.fehler = null;
    $('#vorschau-einstellungen').textContent = einstellungenText(ersteEinstellungen(S.ui.first));
    $('#vorschau-board').textContent = boardText(S.ui.first.board.trim(), spaltenListe(S.ui.first));
  }
});
window.addEventListener('hashchange', laden);
window.addEventListener('resize', popPlatzieren);
document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Enter' && t.dataset && t.dataset.enter && !e.shiftKey) {
    e.preventDefault();
    act(t.dataset.enter, t.dataset.arg, t.value);
    return;
  }
  if (e.key === 'Escape') {
    if (S.ui.pop) { S.ui.pop = null; S.ui.ichNoetig = false; render(); return; }
    if (S.ui.adding) { S.ui.adding = null; render(); return; }
  }
});

/* Ziehen: obere Hälfte = davor, untere = dahinter, freie Fläche = ans Ende. */
let zug = null, ziel = null;
const einfuegeMarkenWeg = () => document.querySelectorAll('.ins-b,.ins-a,.ins-end').forEach(x => x.classList.remove('ins-b', 'ins-a', 'ins-end'));
document.addEventListener('dragstart', e => {
  const k = e.target.closest && e.target.closest('.ka[draggable]');
  if (!k) return;
  zug = +k.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', String(zug)); } catch (_) { }
  setTimeout(() => k.classList.add('zieht'));
});
document.addEventListener('dragover', e => {
  if (zug == null) return;
  const bahn = e.target.closest('.bahn[data-col]');
  if (!bahn) return;
  e.preventDefault();
  einfuegeMarkenWeg();
  const k = e.target.closest('.ka[data-id]'), spalte = bahn.dataset.col;
  const andere = [...bahn.querySelectorAll('.ka[data-id]')].filter(x => +x.dataset.id !== zug);
  if (k && +k.dataset.id !== zug) {
    const r = k.getBoundingClientRect(), davor = e.clientY < r.top + r.height / 2;
    k.classList.add(davor ? 'ins-b' : 'ins-a');
    ziel = { spalte, index: andere.indexOf(k) + (davor ? 0 : 1) };
  } else if (!k) {
    if (andere.length) andere[andere.length - 1].classList.add('ins-a'); else bahn.classList.add('ins-end');
    ziel = { spalte, index: andere.length };
  }
});
document.addEventListener('drop', e => {
  if (zug == null) return;
  e.preventDefault();
  const nummer = zug, z = ziel;
  zug = null; ziel = null;
  einfuegeMarkenWeg();
  if (z) act('bewegen', JSON.stringify({ nummer, ...z }));
});
document.addEventListener('dragend', () => {
  zug = null; ziel = null; einfuegeMarkenWeg();
  document.querySelectorAll('.zieht').forEach(x => x.classList.remove('zieht'));
});

/* Live: jede Änderung im Ordner lädt neu; Änderungen von außen markieren die betroffenen Karten 10 s. */
function spaltenJeAufgabe() {
  const m = {};
  if (S.board) S.board.spalten.forEach(sp => sp.aufgaben.forEach(n => { m[n] = sp.name; }));
  return m;
}

async function ereignis(e) {
  const vorher = spaltenJeAufgabe();
  await laden();
  if (!e.extern) return;
  const jetzt = Date.now();
  for (const a of S.aufgaben) if (e.pfade.includes('aufgaben/' + a.datei)) S.extern[a.nummer] = { at: jetzt, datei: 'aufgaben/' + a.datei };
  const boardDatei = S.ui.slug && 'boards/' + S.ui.slug + '.md';
  if (boardDatei && e.pfade.includes(boardDatei)) {
    const nachher = spaltenJeAufgabe();
    for (const n of Object.keys(nachher)) if (vorher[n] !== nachher[n]) S.extern[n] = { at: jetzt, datei: boardDatei };
  }
  render();
}

function liveVerbinden() {
  if (typeof EventSource === 'undefined') return;
  const q = new EventSource('/api/ereignisse');
  q.onmessage = m => ereignis(JSON.parse(m.data)).catch(() => { });
  q.onerror = () => { if (S.live) { S.live = false; render(); } };
  q.onopen = () => { if (!S.live) { S.live = true; laden().catch(() => { }); } };
}

setInterval(() => {
  const jetzt = Date.now();
  let neu = false;
  for (const [n, x] of Object.entries(S.extern)) if (jetzt - x.at >= 10000) { delete S.extern[n]; neu = true; }
  document.querySelectorAll('[data-ext]').forEach(el => { el.textContent = `extern · ${el.dataset.datei} · vor ${Math.round((jetzt - +el.dataset.ext) / 1000)} Sek`; });
  if (neu && zug == null && !S.ui.adding) render();
}, 1000);

liveVerbinden();
laden().catch(f => { S.ui.fehler = f.message; render(); });
