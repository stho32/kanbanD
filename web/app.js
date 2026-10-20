/* kanbanD — Zustand, Laden, Handlungen, Ereignisse. Der Ordner ist die Wahrheit; die Seite fragt nach. */
const S = { zustand: null, board: null, aufgaben: [], herkunft: {}, ich: null, extern: {}, live: true, ui: { slug: null, first: null, fehler: null, pop: null, filter: '', bereich: 'alle', auswahl: [], anker: null } };
const gemerkt = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const merken = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) { } };
S.ui.filter = gemerkt('kanbanD.filter') || '';
S.ui.bereich = gemerkt('kanbanD.bereich') || 'alle';
S.ui.listBereich = gemerkt('kanbanD.listBereich') || 'alle';
S.ui.pBereich = 'alle';
const TERMIN_LEER = { i: null, name: '', datum: '', farbe: 'red', linie: 'durchgehend', staerke: 'normal' };
S.ui.tf = { ...TERMIN_LEER };
const THEMEN = ['system', 'light', 'dark'];
/** Darstellung am Wurzelelement: `system` folgt prefers-color-scheme, sonst erzwungen (R00070). */
function themaAnwenden(t) {
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
S.thema = (t => THEMEN.includes(t) ? t : 'system')((() => { try { return localStorage.getItem('kanbanD.thema'); } catch (_) { return null; } })());
themaAnwenden(S.thema);
S.timerStart = (() => { try { return JSON.parse(localStorage.getItem('kanbanD.timer-start') || '{}'); } catch (_) { return {}; } })();
/** Merkt die Startsekunde eines hier gestarteten Timers (`nr|wer`); älter als ein Tag fällt heraus. */
function timerStartMerken(schluessel, ms) {
  const grenze = Date.now() - 864e5;
  S.timerStart = Object.fromEntries(Object.entries({ ...S.timerStart, [schluessel]: ms }).filter(([k, v]) => v !== null && v > grenze));
  try { localStorage.setItem('kanbanD.timer-start', JSON.stringify(S.timerStart)); } catch (_) { }
}
S.ui.bf = (() => { try { return filterAus(localStorage.getItem('kanbanD.berichtsfilter')); } catch (_) { return filterAus(''); } })();
function berichtsfilterSetzen(aenderung) {
  S.ui.bf = { ...S.ui.bf, ...aenderung };
  try { localStorage.setItem('kanbanD.berichtsfilter', JSON.stringify(S.ui.bf)); } catch (_) { }
}
const umschalten = (liste, x) => liste.includes(x) ? liste.filter(y => y !== x) : [...liste, x];

function filterSetzen(text) {
  S.ui.filter = text;
  merken('kanbanD.filter', text);
}
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
  if (!r.ok) throw Object.assign(new Error(json && json.fehler || r.statusText), { status: r.status, daten: json });
  return json;
}

function ansichtAusAdresse() {
  if (/^#\/wbs\//.test(location.hash)) return 'wbs';
  const m = /^#\/(einrichten|aufgaben|personen|berichte\/stundenzettel|berichte\/kreuz|berichte\/verlauf|berichte\/durchlauf|berichte\/prognose)/.exec(location.hash);
  return m ? m[1] : 'board';
}
/** Kürzel der Anwendung in `#/wbs/<kürzel>`. */
const wbsKuerzel = () => decodeURIComponent((/^#\/wbs\/([^/]*)/.exec(location.hash) || [])[1] || '');
/** Gewählter Klappzustand der WBS-Sicht je Anwendung ({id: offen?}); überdauert das Neuladen. */
function wbsKlapp() {
  const k = wbsKuerzel();
  if (!S.ui.wbsKlapp || S.ui.wbsKlapp.k !== k) {
    let kl = {};
    try { kl = JSON.parse(localStorage.getItem('kanbanD.wbs-klapp.' + k) || '{}'); } catch (_) { }
    S.ui.wbsKlapp = { k, kl };
  }
  return S.ui.wbsKlapp.kl;
}
function wbsKlappMerken() {
  try { localStorage.setItem('kanbanD.wbs-klapp.' + wbsKuerzel(), JSON.stringify(wbsKlapp())); } catch (_) { }
}
/** Anwendungen, an die das aktuelle Board gebunden ist (R00053, R00054). */
const gebunden = () => gebundeneAnwendungen(S.board, (S.zustand && S.zustand.einstellungen && S.zustand.einstellungen.quellen.anwendungen) || []);

function vHaupt() {
  if (S.ui.first) return vFirst();
  if (S.ui.setup) return vSetup();
  if (S.ui.view === 'einrichten' && S.ui.einr) return vEinrichten();
  if (S.ui.view === 'aufgaben') return vAufgaben();
  if (S.ui.view === 'personen') return vPersonen();
  if (S.ui.view === 'berichte/stundenzettel') return vStundenzettel();
  if (S.ui.view === 'berichte/kreuz') return vKreuz();
  if (S.ui.view === 'berichte/verlauf') return vVerlauf();
  if (S.ui.view === 'berichte/durchlauf') return vDurchlauf();
  if (S.ui.view === 'berichte/prognose') return vPrognose();
  if (S.ui.view === 'wbs') return vWbs();
  return vBoard();
}

const kopie = x => JSON.parse(JSON.stringify(x));

function gewaehltesBoard() {
  const m = /^#\/board\/([^/]+)/.exec(location.hash);
  const slugs = [...S.zustand.boards.map(b => b.slug), ...defekteBoards()];
  let zuletzt = null;
  try { zuletzt = localStorage.getItem('kanbanD.board'); } catch (_) { }
  if (!m && zuletzt && slugs.includes(zuletzt)) return zuletzt;
  return m && slugs.includes(m[1]) ? m[1] : slugs[0] || null;
}

/** Was der Server zuletzt geliefert hat, und wohin die Adresse zeigt. Ein Ereignis, nach dem das gleich bleibt — das Echo
    eines eigenen Schreibzugriffs, auch der Phasen-Spalten, die das erste Lesen nachträgt —, zeichnet nicht neu: sonst ersetzt
    es die Seite, während jemand klickt oder liest (R00061). */
let geladenerStand = null;
const serverStand = () => JSON.stringify([location.hash, S.zustand, S.board, S.boardDefekt, S.aufgaben, S.herkunft, S.boards, S.bew, S.anwendungen, S.wbs, S.wbsFehler, S.pruefWbs, S.ui.datei, S.ui.anhaenge, S.ui.defektDatei]);

/** Lädt den Stand vom Server und zeichnet; `nurBeiAenderung` (Live-Ereignis) zeichnet nur, wenn sich etwas geändert hat.
    Als Objekt, weil `laden` auch Ereignis-Handler ist (`hashchange` übergibt sein Ereignis). */
async function laden({ nurBeiAenderung = false } = {}) {
  S.zustand = await api('GET', '/api/zustand');
  S.einstellungenDefekt = S.zustand.eingerichtet && !S.zustand.einstellungen;
  if (S.einstellungenDefekt) S.zustand.einstellungen = { personen: [], klassen: [], quellen: { wbs: '', anforderungen: '', anwendungen: [] } };
  if (!S.zustand.eingerichtet) {
    S.ui.first = S.ui.first || { kuerzel: '', name: '', agenten: { cl: true }, board: 'Entwicklung', spalten: 'Zu erledigen, In Arbeit, Erledigt', wbs: '', anf: '' };
  } else {
    S.ui.first = null;
    S.ui.view = ansichtAusAdresse();
    if (S.ui.view !== 'einrichten') S.ui.einr = null;
    else if (!S.ui.einr) S.ui.einr = kopie(S.zustand.einstellungen);
    S.ui.slug = gewaehltesBoard();
    try { if (S.ui.slug) localStorage.setItem('kanbanD.board', S.ui.slug); } catch (_) { }
    // Das Board zuerst: sein Lesen kann Phasen-Spalten nachtragen (ein Commit) — was danach gelesen wird, zeigt schon diesen
    // Stand, sodass das Echo des Commits nichts Neues bringt und nicht neu zeichnet (R00061).
    let boardDefekt = null;
    const board = S.ui.slug ? await api('GET', '/api/boards/' + encodeURIComponent(S.ui.slug)).catch(f => { if (f.status !== 423) throw f; boardDefekt = { slug: S.ui.slug, fehler: f.message }; return null; }) : null;
    const [aufgaben, herkunft, boards] = await Promise.all([
      api('GET', '/api/aufgaben'),
      api('GET', '/api/herkunft'),
      api('GET', '/api/boards'),
    ]);
    // Board-Berichte rechnen im Browser aus den Spaltenwechseln (R00042)
    const bew = /^berichte\/(verlauf|durchlauf|prognose)$/.test(S.ui.view) && S.ui.slug ? await api('GET', '/api/berichte/bewegungen?board=' + encodeURIComponent(S.ui.slug)) : null;
    // Erreichbarkeit der registrierten Anwendungen zeigt nur die Einstellungsseite (R00053)
    const anwendungen = S.ui.view === 'einrichten' ? await api('GET', '/api/anwendungen') : S.anwendungen;
    let wbs = null, wbsFehler = null;
    if (S.ui.view === 'wbs' && wbsKuerzel()) wbs = await api('GET', '/api/wbs/' + encodeURIComponent(wbsKuerzel())).catch(f => { wbsFehler = f.message; return null; });
    // Ausrufezeichen der Prüfungen (R00059): die WBS jeder Anwendung, auf die Karten des Boards wirken — live nach jedem Ereignis
    const pruefWbs = {};
    if (S.ui.view === 'board') await Promise.all(pruefWbsAnwendungen(board, aufgaben.aufgaben).map(k => api('GET', '/api/wbs/' + encodeURIComponent(k)).then(w => { pruefWbs[k] = w; }, () => { pruefWbs[k] = null; })));
    // Alles auf einmal übernehmen: eine Aktion oder ein Zeichnen während des Ladens sieht nie einen halben Stand —
    // vorher war S.wbs für die Dauer der Anfrage null, und ein Klick auf Zuklappen ging verloren (R00061).
    Object.assign(S, { boardDefekt, board, aufgaben: aufgaben.aufgaben, herkunft, boards, bew, anwendungen, wbs, wbsFehler, pruefWbs });
    if (S.ui.offen) await dateiLaden();
    if (S.ui.offenDefekt) await defektLaden();
  }
  const stand = serverStand();
  if (nurBeiAenderung && stand === geladenerStand) return false;
  geladenerStand = stand;
  render();
  // `#/wbs/<kürzel>/<id>` zeigt die Zeile einmal — spätere Ereignisse laden neu, ohne erneut zu springen
  const ziel = S.ui.view === 'wbs' && S.wbs && wbsZiel(location.hash);
  if (ziel && S.ui.wbsGesprungen !== location.hash) { S.ui.wbsGesprungen = location.hash; await act('wbs-gehe', ziel); }
  else if (!ziel) S.ui.wbsGesprungen = null;
}

/** Schreibende Aktionen brauchen eine Identität; fehlt sie, öffnet sich „Ich bin …“ mit Hinweis. */
function ichNoetig() {
  if (S.ich && personen().some(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv)) return false;
  S.ui.pop = 'ich'; S.ui.ichNoetig = true;
  return true;
}

async function defektLaden() {
  try {
    await api('GET', '/api/aufgaben/' + S.ui.offenDefekt);
    S.ui.offen = S.ui.offenDefekt; S.ui.offenDefekt = null; S.ui.defektDatei = null; // repariert
    await dateiLaden();
  } catch (f) {
    if (f.status === 423) S.ui.defektDatei = { pfad: f.daten.pfad, text: f.daten.text, fehler: f.message };
    else { S.ui.offenDefekt = null; S.ui.defektDatei = null; }
  }
}

async function dateiLaden() {
  try {
    S.ui.datei = await api('GET', '/api/aufgaben/' + S.ui.offen);
    S.ui.anhaenge = await api('GET', `/api/aufgaben/${S.ui.offen}/anhaenge`);
  } catch (f) { if (f.status === 404) S.ui.offen = null; S.ui.datei = null; S.ui.anhaenge = []; }
}

async function anhaengeHochladen(dateien) {
  if (ichNoetig()) { render(); return; }
  for (const d of dateien) {
    const form = new FormData();
    form.append('datei', d, d.name);
    const r = await fetch(`/api/aufgaben/${S.ui.offen}/anhaenge`, { method: 'POST', headers: { 'X-KanbanD-Wer': S.ich }, body: form });
    if (!r.ok) { S.ui.fensterFehler = (await r.json().catch(() => ({}))).fehler || r.statusText; break; }
    S.ui.gespeichert = Date.now();
  }
  await laden();
}

/** Termine des Boards ersetzen; bei Erfolg das Formular leeren (R00047). */
async function termineSchreiben(liste, formularLeeren) {
  const u = S.ui;
  try {
    await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/termine`, liste);
    u.tfFehler = null;
    if (formularLeeren) u.tf = { ...TERMIN_LEER };
  } catch (f) { u.tfFehler = f.message; }
  return laden();
}

/** Anfragen strikt nacheinander; ist die Schlange leer, wird einmal neu geladen. */
let schlange = Promise.resolve(), schlangeOffen = 0;
function warteschlange(anfrage) {
  schlangeOffen++;
  schlange = schlange.then(anfrage).then(() => { S.ui.gespeichert = Date.now(); }).catch(f => { S.ui.fensterFehler = f.message; }).then(() => {
    if (--schlangeOffen === 0) return laden();
  });
  return schlange;
}

/** Ein Eintrag aus Titel und den Feldern des Dialogs; Kürzel im Titel ergänzen die Felder. */
function neuEintrag(titel, f) {
  const s = schnelleingabe(titel, schnellUmfeld(), new Date());
  const vereint = (a, b) => [...new Set([...a, ...b])];
  const labels = f.labels.split(',').map(x => x.trim()).filter(Boolean);
  const herkunft = f.herkunft.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
  // @kürzel ersetzt die Vorbelegung (mich), solange niemand die Zuständigen von Hand gewählt hat (R00028)
  const zust = s.zustaendige.length ? (f.zustGewaehlt ? vereint(f.zust, s.zustaendige) : s.zustaendige) : f.zust;
  const e = { titel: s.titel || titel.trim(), zustaendige: zust, labels: vereint(labels, s.labels), herkunft: vereint(herkunft, s.herkunft) };
  if (s.klasse || f.klasse) e.klasse = s.klasse || f.klasse;
  if (s.faellig || f.faellig) e.faellig = s.faellig || f.faellig;
  return e;
}
async function neueAufgabeAnlegen(weitere, zeilen) {
  const u = S.ui, f = u.neu;
  if (!f || ichNoetig()) { render(); return; }
  const titel = $('#neu-titel') ? $('#neu-titel').value : f.titel;
  const liste = zeilen || [titel];
  if (!liste.some(t => t.trim())) { f.fehler = 'Die Aufgabe braucht einen Titel'; u.fokus = '#neu-titel'; render(); return; }
  const ziel = f.board ? { board: f.board, spalte: f.spalte } : {};
  try {
    let neu;
    if (liste.length === 1) {
      neu = [await api('POST', '/api/aufgaben', { ...neuEintrag(liste[0], f), beschreibung: f.beschreibung, teilaufgaben: f.teil, ...ziel })];
    } else {
      neu = await api('POST', '/api/aufgaben/mehrere', { titel: liste.map(t => neuEintrag(t, f)), ...ziel });
    }
    u.hinweis = { text: neu.length === 1 ? `#${neu[0].nummer} angelegt` : `${neu.length} Aufgaben angelegt`, undo: { art: 'archivieren', nummern: neu.map(a => a.nummer) }, at: Date.now() };
    if (weitere) { Object.assign(f, { titel: '', beschreibung: '', teil: [], fehler: null }); u.fokus = '#neu-titel'; }
    else u.neu = null;
  } catch (x) { f.fehler = x.message; }
  return laden();
}

/** Schreibender Aufruf aus dem Aufgabenfenster: Fehler erscheinen im Fuß, danach wird neu geladen. */
async function schreiben(methode, pfad, daten) {
  try {
    await api(methode, pfad, daten);
    S.ui.gespeichert = Date.now(); S.ui.fensterFehler = null;
  } catch (f) { S.ui.fensterFehler = f.message; S.ui.fehler = f.message; }
  await laden();
}

async function aufgabeAendern(nummer, aenderung) {
  if (ichNoetig()) { render(); return; }
  try {
    await api('PATCH', '/api/aufgaben/' + nummer, aenderung);
    S.ui.gespeichert = Date.now(); S.ui.fensterFehler = null;
  } catch (f) { S.ui.fensterFehler = f.message; }
  await laden();
}

/** Schließt den Dialog „Zuständige zuweisen“; Karte bzw. Zeile bekommt den Fokus zurück. */
function zuweisenSchliessen() {
  const z = S.ui.zuweisen;
  S.ui.zuweisen = null;
  if (S.ui.view === 'board') S.ui.fokusKarte = z.nummern[0]; else S.ui.fokusZeile = z.nummern[0];
  return z;
}
const nummernAus = l => String(l).split(',').map(Number);

/** Mehrere Aufgaben in einem Commit (R00065). */
async function mehrereAendern(aenderungen) {
  if (ichNoetig()) { render(); return; }
  try {
    await api('PATCH', '/api/aufgaben/mehrere', { aenderungen });
    S.ui.gespeichert = Date.now(); S.ui.fensterFehler = null;
  } catch (f) { S.ui.fehler = f.message; }
  await laden();
}

/** Mehrere Karten an `index` der Spalte, in Lesereihenfolge; rückgängig legt jede an ihren alten Platz. */
function mehrereBewegen(nummern, spalte, index) {
  const { ziele, zurueck } = mehrfachZiele(brettSpalten(), nummern, spalte, index);
  return zieleSenden(ziele, zurueck, `${ziele.length} Karten nach „${spalte}“`);
}
const brettSpalten = () => S.board.spalten.map(sp => ({ name: sp.name, karten: sp.aufgaben }));
async function zieleSenden(ziele, zurueck, text) {
  const u = S.ui;
  if (ichNoetig()) { render(); return; }
  // gleich sichtbar machen, dann vom Server bestätigen lassen
  spaltenNach(brettSpalten(), ziele).forEach((s, i) => { S.board.spalten[i].aufgaben = s.karten; });
  render();
  try {
    const r = await api('POST', `/api/boards/${encodeURIComponent(u.slug)}/bewegen-mehrere`, { ziele });
    if (r.bewegt) u.hinweis = { text, at: Date.now(), ...(zurueck ? { undo: { art: 'ziele', ziele: zurueck } } : {}), ...(r.warnungen && r.warnungen.length ? { warnungen: r.warnungen, dauer: 20000 } : {}) };
  } catch (f) { u.fehler = f.message; }
  return laden();
}

/** Strg + Klick schaltet eine Karte um, Umschalt + Klick wählt die Reihe vom Anker (R00065). */
function auswahlKlick(nr, e) {
  const u = S.ui;
  if (e.shiftKey) {
    const anker = u.anker != null ? u.anker : (u.fokusKarte || nr), r = reihe(sichtbareSpalten(), anker, nr);
    u.auswahl = e.ctrlKey || e.metaKey ? [...new Set([...u.auswahl, ...r])] : r;
    u.anker = anker;
  } else {
    u.auswahl = umschalten(u.auswahl, nr);
    u.anker = nr;
  }
  u.fokusKarte = nr;
  render();
}
function auswahlAufheben() { S.ui.auswahl = []; S.ui.anker = null; }

/** Menü für die ausgewählten Karten, Titel „n Karten“. */
function menueFuerAuswahl(x, y) {
  const nummern = lesereihenfolge(brettSpalten()).filter(n => S.ui.auswahl.includes(n));
  const boards = (S.boards || []).filter(b => b.slug !== S.ui.slug && b.spalten.length).map(b => ({ slug: b.slug, titel: b.titel, spalte: b.spalten[0].name }));
  menueOeffnen(`${nummern.length} Karten`, massenMenue(nummern, { spalten: S.board.spalten.map(sp => sp.name), klassen: S.zustand.einstellungen.klassen, boards }), x, y);
}
/** Im Dialog gelten nur Esc und Enter; die Leertaste schaltet das Kästchen selbst um. */
function zuweisenTaste(e, t) {
  if (e.key === 'Escape') { e.preventDefault(); act('zuweisen-ab'); }
  else if (e.key === 'Enter' && t.tagName !== 'BUTTON') { e.preventDefault(); act('zuweisen-ok'); }
}

function render() {
  // Während eines Zuges nicht neu zeichnen — die gezogene Karte würde unter dem Zeiger ersetzt.
  if (typeof zug !== 'undefined' && zug != null) { S.ui.nachZug = true; return; }
  S.ui.nachZug = false;
  // Das aktive Eingabefeld übersteht das Neuzeichnen: Wert, Cursor, Fokus
  const aktiv = document.activeElement;
  const halten = aktiv && aktiv.id && /INPUT|TEXTAREA/.test(aktiv.tagName) && !S.ui.fokus ? { id: aktiv.id, wert: aktiv.value, von: aktiv.selectionStart, bis: aktiv.selectionEnd } : null;
  document.title = fenstertitel();
  // Neuzeichnen in derselben Sicht hält die Leseposition — sonst springt das Board unter dem Kontextmenü weg.
  const sicht = `${S.ui.view}/${S.ui.slug || ''}/${S.ui.setup ? 'setup' : ''}`;
  const rollen = $('#main').dataset.sicht === sicht ? rollpositionen() : [];
  // Die Auswahl gilt nur auf diesem Board und nur für Karten, die noch darauf liegen (R00065)
  if ($('#main').dataset.sicht !== sicht) auswahlAufheben();
  S.ui.auswahl = S.ui.auswahl.filter(n => S.board && S.board.spalten.some(sp => sp.aufgaben.includes(n)) && aufgabe(n) && !aufgabe(n).archiviert);
  $('#kopf').innerHTML = vKopf();
  $('#main').innerHTML = vHaupt();
  $('#main').dataset.sicht = sicht;
  rollpositionenSetzen(rollen);
  $('#over').innerHTML = (S.ui.neu ? vNeu() : '') + (S.ui.offen && !S.ui.setup ? vFenster() : '') + (S.ui.offenDefekt ? vDefektFenster() : '') + vPop() + vHinweis() + (S.ui.hilfe ? vHilfe() : '') + (S.ui.zuweisen ? vZuweisen() : '') + vMenue();
  document.querySelectorAll('#zuweisen [data-gemischt]').forEach(x => { x.indeterminate = true; });
  menueEinpassen();
  $('#stat').innerHTML = vStatus();
  popPlatzieren();
  let gehalten = false;
  if (halten) {
    const el = document.getElementById(halten.id);
    if (el) { el.value = halten.wert; el.focus(); gehalten = true; try { el.setSelectionRange(halten.von, halten.bis); } catch (_) { } }
  }
  if (gehalten) { /* das Feld behält den Fokus */ }
  else if (S.ui.fokus) { const f = $(S.ui.fokus); S.ui.fokus = null; if (f) f.focus(); }
  else if (S.ui.fokusKarte && !S.ui.offen && !S.ui.hilfe && !S.ui.zuweisen && S.ui.view === 'board') { const k = $(`.ka[data-id="${S.ui.fokusKarte}"]`); if (k) k.focus(); }
  else if (S.ui.fokusZeile && !S.ui.offen && !S.ui.hilfe && !S.ui.zuweisen && S.ui.view === 'aufgaben') { const z = $(`tr[data-zeile="${S.ui.fokusZeile}"]`); if (z) z.focus(); }
}

/** Gescrollte Flächen der Hauptsicht, je mit dem Selektor, der sie nach dem Neuzeichnen wiederfindet. */
function rollpositionen() {
  const spalten = [...document.querySelectorAll('.bahn[data-col] > .flaeche')].map(f => [`.bahn[data-col="${CSS.escape(f.parentElement.dataset.col)}"] > .flaeche`, f]);
  return [['.body', $('.body')], ['.wbs-tabelle', $('.wbs-tabelle')], ['.bahnen', $('.bahnen')], ...spalten]
    .filter(([, el]) => el && (el.scrollLeft || el.scrollTop))
    .map(([sel, el]) => ({ sel, links: el.scrollLeft, oben: el.scrollTop }));
}
function rollpositionenSetzen(rollen) {
  for (const r of rollen) {
    const el = $(r.sel);
    if (el) { el.scrollLeft = r.links; el.scrollTop = r.oben; }
  }
}

function fenstertitel() {
  if (!S.zustand || !S.zustand.eingerichtet) return 'kanbanD';
  if (S.ui.view === 'wbs' && S.wbs) return `${prozente(S.wbs.stand).gruen} % · WBS · ${S.wbs.name} — kanbanD`;
  const seiten = { aufgaben: 'Aufgaben', personen: 'Personen', einrichten: 'Einrichten', 'berichte/stundenzettel': 'Stundenzettel', 'berichte/kreuz': 'Zeiten', 'berichte/verlauf': 'Burndown', 'berichte/durchlauf': 'Durchlaufzeit', 'berichte/prognose': 'Wie lange noch' };
  const n = alleLaufenden().length;
  return `${n ? `(${n} ▶) ` : ''}${seiten[S.ui.view] || (S.board ? S.board.titel : 'Board')} — kanbanD`;
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
      case 'pop': u.pop = u.pop === arg ? null : arg; u.popFehler = null; if (arg !== 'ich') u.ichNoetig = false; if (u.pop === 'board') u.fokus = '#board-neu'; break;
      case 'board-wahl': u.pop = null; location.hash = '#/board/' + arg; return;
      case 'board-neu': {
        const titel = (wert || '').trim();
        if (!titel) break;
        if (ichNoetig()) break;
        try {
          const r = await api('POST', '/api/boards', { titel });
          u.pop = null;
          location.hash = '#/board/' + r.board;
          return;
        } catch (f) { u.popFehler = f.message; u.fokus = '#board-neu'; break; }
      }
      case 'ich': ichSetzen(arg); u.pop = null; u.ichNoetig = false; break;
      case 'add': {
        // arg: Spaltenname des aktuellen Boards, '' = erste Spalte, '-' = ohne Board
        if (ichNoetig()) break;
        const ohne = arg === '-' || !S.board || u.view !== 'board';
        const spalte = ohne ? '' : (arg || (S.board.spalten[0] || {}).name || '');
        u.offen = null; u.pop = null; u.menue = null;
        u.neu = { board: ohne ? '' : u.slug, spalte, titel: '', beschreibung: '', teil: [], klasse: '', zust: S.ich && per(S.ich).art === 'human' ? [S.ich] : [], labels: '', faellig: '', herkunft: '', fehler: null };
        u.fokus = '#neu-titel';
        break;
      }
      case 'nf-zu': case 'nf-zu-bg': u.neu = null; break;
      case 'nf-teil': { const t = (wert || '').trim(); if (t) u.neu.teil.push(t); u.fokus = '#neu-teil'; break; }
      case 'nf-teil-weg': u.neu.teil.splice(+arg, 1); u.fokus = '#neu-teil'; break;
      case 'nf-zust': { const z = u.neu.zust; u.neu.zust = z.includes(arg) ? z.filter(k => k !== arg) : [...z, arg]; u.neu.zustGewaehlt = true; break; }
      case 'nf-faellig': { const d = new Date(); d.setDate(d.getDate() + +arg); u.neu.faellig = isoD(d); break; }
      case 'nf-anlegen': return neueAufgabeAnlegen(arg === 'weitere');
      case 'bewegen': {
        if (ichNoetig()) break;
        const bw = JSON.parse(arg);
        // gleich sichtbar machen, dann vom Server bestätigen lassen
        const quelle = S.board.spalten.find(sp => sp.aufgaben.includes(bw.nummer));
        const vorher = quelle && { spalte: quelle.name, index: quelle.aufgaben.indexOf(bw.nummer) };
        if (quelle) {
          quelle.aufgaben = quelle.aufgaben.filter(n => n !== bw.nummer);
          S.board.spalten.find(sp => sp.name === bw.spalte).aufgaben.splice(bw.index, 0, bw.nummer);
          render();
        }
        const r = await api('POST', `/api/boards/${encodeURIComponent(u.slug)}/bewegen`, bw);
        if (r.bewegt && vorher && !bw.rueckgaengig) u.hinweis = { text: `#${bw.nummer} nach „${bw.spalte}“`, undo: { art: 'bewegen', nummer: bw.nummer, ...vorher }, at: Date.now() };
        if (bw.rueckgaengig) u.hinweis = { text: `#${bw.nummer} zurück nach „${bw.spalte}“`, at: Date.now() };
        // Plausibilitätsprüfung (R00059): der Zug ist ausgeführt, die Warnung bleibt länger stehen
        if (r.warnungen && r.warnungen.length) u.hinweis = { text: `#${bw.nummer} nach „${bw.spalte}“`, warnungen: r.warnungen, at: Date.now(), dauer: 20000 };
        return laden();
      }
      case 'oeffnen': if (zug != null) break; u.pop = null; u.wirkungNeu = null; u.zeitEdit = null; u.beschreibungBearbeiten = false; u.offen = +arg; u.tab = 'inhalt'; u.gespeichert = null; u.fensterFehler = null; await dateiLaden(); break;
      case 'schliessen': case 'schliessen-bg': u.offen = null; u.datei = null; u.offenDefekt = null; u.defektDatei = null; break;
      case 'schliessen-hilfe': u.hilfe = false; break;
      case 'hilfe': u.hilfe = true; break;
      case 'defekt-oeffnen': u.pop = null; u.offenDefekt = +arg; await defektLaden(); break;
      case 'tab': u.tab = arg; break;
      case 'blaettern': {
        const reihe = sichtbareReihe();
        if (!reihe.length) break;
        const i = reihe.indexOf(u.offen);
        u.offen = reihe[((i < 0 ? 0 : i) + +arg + reihe.length) % reihe.length];
        u.gespeichert = null; u.fensterFehler = null;
        await dateiLaden();
        break;
      }
      case 'teil-karte': {
        if (ichNoetig()) break;
        const [nr, i] = arg.split('|').map(Number);
        aufgabe(nr).teilaufgaben[i].erledigt = true;
        u.fokusKarte = nr;
        render();
        warteschlange(() => api('PATCH', `/api/aufgaben/${nr}/teilaufgaben/${i}`, { erledigt: true }));
        return;
      }
      case 'teil': {
        if (ichNoetig()) break;
        const t = aufgabe(u.offen).teilaufgaben[+arg];
        await schreiben('PATCH', `/api/aufgaben/${u.offen}/teilaufgaben/${arg}`, { erledigt: !t.erledigt });
        return;
      }
      case 'teil-bearbeiten': if (ichNoetig()) break; u.teilEdit = { nr: u.offen, i: +arg }; u.fokus = '#teil-edit'; break;
      case 'teil-text': {
        const e = u.teilEdit, text = (wert || '').trim();
        u.teilEdit = null;
        const t = e && aufgabe(e.nr) && aufgabe(e.nr).teilaufgaben[e.i];
        if (!t || !text || text === t.text) break;
        // sofort zeigen, geordnet im Hintergrund senden (R00037)
        t.text = text;
        render();
        warteschlange(() => api('PATCH', `/api/aufgaben/${e.nr}/teilaufgaben/${e.i}`, { text }));
        return;
      }
      case 'teil-ordnen': {
        if (ichNoetig()) break;
        // nach = Einfügestelle in der alten Liste; nach dem Herausnehmen rückt alles dahinter eins vor
        const [von, nach] = arg.split('|').map(Number), position = nach > von ? nach - 1 : nach, nr = u.offen;
        if (position === von) break;
        const liste = aufgabe(nr).teilaufgaben;
        liste.splice(position, 0, liste.splice(von, 1)[0]);
        render();
        warteschlange(() => api('PATCH', `/api/aufgaben/${nr}/teilaufgaben/${von}`, { position }));
        return;
      }
      case 'teil-weg': if (ichNoetig()) break; await schreiben('DELETE', `/api/aufgaben/${u.offen}/teilaufgaben/${arg}`); return;
      case 'teil-neu': {
        const text = (wert || '').trim();
        if (!text || ichNoetig()) break;
        // sofort zeigen, Feld leeren; senden geordnet im Hintergrund
        const nr = u.offen, a = aufgabe(nr);
        a.teilaufgaben.push({ text, erledigt: false });
        const feld = $('#teil-neu');
        if (feld) feld.value = '';
        u.fokus = '#teil-neu';
        render();
        warteschlange(() => api('POST', `/api/aufgaben/${nr}/teilaufgaben`, { text }));
        return;
      }
      case 'kommentar': {
        if (!(wert || '').trim() || ichNoetig()) break;
        u.fokus = '#km-inp';
        await schreiben('POST', `/api/aufgaben/${u.offen}/kommentare`, { text: wert });
        return;
      }
      case 'start': if (ichNoetig()) break; timerStartMerken(`${arg}|${S.ich}`, Date.now()); await schreiben('POST', `/api/aufgaben/${arg}/timer/start`); return;
      case 'stop': {
        if (ichNoetig()) break;
        const [nr, wer] = arg.split('|');
        await schreiben('POST', `/api/aufgaben/${nr}/timer/stop`, { wer });
        return;
      }
      case 'archiv-an': filterSetzen((u.filter.replace(/is:\S+\s*/g, '') + ' is:archived').trim()); u.offen = null; break;
      case 'archiv-aus': filterSetzen(u.filter.replace(/is:\S+\s*/g, '').trim()); u.offen = null; break;
      case 'bereich': u.bereich = arg; merken('kanbanD.bereich', arg); break;
      case 'legende': filterSetzen(klasseUmschalten(u.filter, arg)); break;
      case 'archivieren': {
        if (ichNoetig()) break;
        await schreiben('POST', `/api/aufgaben/${arg}/archivieren`);
        if (!u.fensterFehler) { if (!imArchiv()) u.offen = null; u.hinweis = { text: `#${arg} archiviert · archived: in der Datei, laufende Timer gestoppt`, undo: { art: 'zurueckholen', nummern: [+arg] }, at: Date.now() }; }
        break;
      }
      case 'rueckgaengig': {
        const h = u.hinweis;
        if (!h || !h.undo || ichNoetig()) break;
        u.hinweis = null;
        const z = h.undo;
        if (z.art === 'bewegen') return act('bewegen', JSON.stringify({ nummer: z.nummer, spalte: z.spalte, index: z.index, rueckgaengig: true }));
        if (z.art === 'ziele') return zieleSenden(z.ziele, null, `${z.ziele.length} Karten zurückgelegt`);
        await schreiben('POST', `/api/aufgaben/${z.art}`, { nummern: z.nummern });
        u.hinweis = { text: z.art === 'archivieren' ? `${z.nummern.length === 1 ? '#' + z.nummern[0] : z.nummern.length + ' Aufgaben'} archiviert` : `#${z.nummern[0]} zurückgeholt`, at: Date.now() };
        break;
      }
      case 'zurueckholen': {
        if (ichNoetig()) break;
        await schreiben('POST', `/api/aufgaben/${arg}/zurueckholen`);
        if (!u.fensterFehler) u.hinweis = { text: `#${arg} zurückgeholt`, at: Date.now() };
        break;
      }
      case 'p-bereich': u.pBereich = arg; break;
      case 'sp': u.sp = arg; break;
      case 'woche': u.wochenVersatz = (u.wochenVersatz || 0) + +arg; break;
      case 'bf-farbe': berichtsfilterSetzen({ ohneFarben: umschalten(u.bf.ohneFarben, arg) }); break;
      case 'bf-spalte': berichtsfilterSetzen({ ohneSpalten: umschalten(u.bf.ohneSpalten, arg) }); break;
      case 'bf-person': berichtsfilterSetzen({ personen: umschalten(u.bf.personen, arg) }); break;
      case 'bf-label': berichtsfilterSetzen({ labels: umschalten(u.bf.labels, arg) }); break;
      case 'tf-bearbeiten': { const t = S.board.termine[+arg]; u.tf = { i: +arg, ...t }; u.tfFehler = null; u.fokus = '[data-tf="name"]'; break; }
      case 'tf-abbrechen': u.tf = { ...TERMIN_LEER }; u.tfFehler = null; break;
      case 'tf-entfernen': {
        if (ichNoetig()) break;
        return termineSchreiben(S.board.termine.filter((_, i) => i !== +arg));
      }
      case 'tf-speichern': {
        if (ichNoetig()) break;
        const f = u.tf, neu = { name: f.name.trim(), datum: f.datum, farbe: f.farbe, linie: f.linie, staerke: f.staerke };
        if (!neu.name) { u.tfFehler = 'Der Termin braucht einen Namen'; break; }
        if (!neu.datum) { u.tfFehler = 'Der Termin braucht ein Datum'; break; }
        const liste = S.board.termine.slice();
        if (f.i == null) liste.push(neu); else liste[f.i] = neu;
        return termineSchreiben(liste, true);
      }
      case 'bf-leeren': berichtsfilterSetzen({ ...FILTER_LEER }); break;
      case 'still-auch': u.stillAuch = !u.stillAuch; break;
      case 'person-filter': filterSetzen('@' + arg); u.bereich = 'alle'; location.hash = '#/board/' + (u.slug || ''); return;
      case 'wbs-klapp': {
        const kl = wbsKlapp(), zu = zugeklappt(S.wbs.knoten, kl, S.wbs.stand.pfad);
        kl[arg] = zu.has(arg);
        wbsKlappMerken();
        u.fokus = `[data-act="wbs-klapp"][data-arg="${arg}"]`;
        break;
      }
      case 'wbs-status-pop': {
        if (ichNoetig()) break;
        u.wbsKnoten = arg; u.pop = u.pop === 'wbs-status' ? null : 'wbs-status';
        break;
      }
      case 'wbs-status': {
        if (ichNoetig()) break;
        const [id, status] = arg.split('|');
        u.pop = null;
        try { await api('PATCH', `/api/wbs/${encodeURIComponent(wbsKuerzel())}/knoten/${encodeURIComponent(id)}`, { status }); }
        catch (f) { u.hinweis = { text: `${id} nicht gesetzt: ${f.message}`, at: Date.now() }; }
        u.fokus = `#wbs-st-${id}`;
        return laden();
      }
      case 'wbs-neu-pop': {
        if (ichNoetig()) break;
        const k = S.wbs.knoten.find(x => x.id === arg);
        u.wbsNeu = { eltern: arg, ebene: kindEbenen(k)[0], name: '', fertig_kriterium: '', eingabe_ausgabe: '', aufwand: '', fehler: null };
        u.pop = 'wbs-neu'; u.fokus = '#wbs-neu-name';
        break;
      }
      case 'wbs-neu-anlegen': {
        const f = u.wbsNeu;
        if (!f || ichNoetig()) break;
        const bubble = f.ebene === 'Bubble';
        try {
          const r = await api('POST', `/api/wbs/${encodeURIComponent(wbsKuerzel())}/knoten`, { ebene: f.ebene, eltern: f.eltern, name: f.name, fertig_kriterium: f.fertig_kriterium, eingabe_ausgabe: bubble ? f.eingabe_ausgabe : '', aufwand: bubble ? f.aufwand : '' });
          u.pop = null; u.wbsNeu = null;
          u.hinweis = { text: `${r.id} angelegt · WBS-Datei nicht committet`, at: Date.now() };
          await laden();
          return act('wbs-gehe', r.id);
        } catch (fehler) { f.fehler = fehler.message; u.fokus = '#wbs-neu-name'; break; }
      }
      case 'wbs-verwerfen-frage': if (ichNoetig()) break; u.wbsVerwerfen = arg; u.pop = 'wbs-verwerfen'; u.fokus = '#wbs-verwerfen-grund'; break;
      case 'wbs-verwerfen-zu': u.pop = null; u.wbsVerwerfen = null; break;
      case 'wbs-verwerfen': {
        if (ichNoetig()) break;
        const feld = $('#wbs-verwerfen-grund'), grund = wert != null ? wert : (feld ? feld.value : '');
        u.pop = null; u.wbsVerwerfen = null;
        try {
          await api('POST', `/api/wbs/${encodeURIComponent(wbsKuerzel())}/knoten/${encodeURIComponent(arg)}/verwerfen`, { grund });
          u.hinweis = { text: `${arg} verworfen · WBS-Datei nicht committet`, at: Date.now() };
        } catch (f) { u.hinweis = { text: `${arg} nicht verworfen: ${f.message}`, at: Date.now() }; }
        return laden();
      }
      case 'wirkung-neu': {
        if (ichNoetig()) break;
        const register = S.zustand.einstellungen.quellen.anwendungen || [];
        u.wirkungNeu = { action: 'create', application: (gebunden()[0] || register[0] || {}).kuerzel || '', node: '', parent: '', level: 'Interaction', name: '', done_criterion: '', fehler: null };
        u.fokus = '#wirkung-parent';
        break;
      }
      case 'wirkung-zu': u.wirkungNeu = null; break;
      case 'wirkung-setzen': {
        const f = u.wirkungNeu;
        if (!f || ichNoetig()) break;
        try { await api('PATCH', `/api/aufgaben/${u.offen}/wbs-effects`, wirkungEingabe(f)); }
        catch (fehler) { f.fehler = fehler.message; u.fokus = f.action === 'create' ? '#wirkung-parent' : '#wirkung-node'; break; }
        u.wirkungNeu = null; u.gespeichert = Date.now(); u.fensterFehler = null;
        return laden();
      }
      case 'wirkung-weg': {
        if (ichNoetig()) break;
        try { await api('DELETE', `/api/aufgaben/${u.offen}/wbs-effects/${arg}`); u.gespeichert = Date.now(); u.fensterFehler = null; }
        catch (fehler) { u.fensterFehler = fehler.message; }
        return laden();
      }
      case 'wbs-zu': u.offen = null; u.pop = null; u.wbsGesprungen = null; if (location.hash === arg) return laden(); location.hash = arg; return;
      case 'wbs-gehe': {
        const kl = wbsKlapp(), nach = new Map(S.wbs.knoten.map(k => [k.id, k]));
        const gesehen = new Set();
        for (let e = nach.get((nach.get(arg) || {}).eltern); e && !gesehen.has(e.id); e = nach.get(e.eltern)) { gesehen.add(e.id); kl[e.id] = true; }
        wbsKlappMerken();
        render();
        const z = document.getElementById('wbs-' + arg);
        if (z) { z.scrollIntoView({ block: 'center' }); z.classList.add('ziel'); }
        return;
      }
      case 'list-bereich': u.listBereich = arg; merken('kanbanD.listBereich', arg); break;
      case 'legen-pop': u.legenNr = +arg; u.pop = u.pop === 'legen' ? null : 'legen'; break;
      case 'liste-ablegen': {
        if (ichNoetig()) break;
        const [nr, slug, spalte] = arg.split('|');
        u.fokusZeile = +nr;
        if (slug === 'archiv') return act('archivieren', nr);
        const b = (S.boards || []).find(x => x.slug === slug);
        const liegt = b && b.spalten.some(sp => sp.aufgaben.includes(+nr));
        if (liegt) {
          const index = b.spalten.find(sp => sp.name === spalte).aufgaben.filter(n => n !== +nr).length;
          await schreiben('POST', `/api/boards/${encodeURIComponent(slug)}/bewegen`, { nummer: +nr, spalte, index });
        } else {
          await schreiben('POST', `/api/boards/${encodeURIComponent(slug)}/aufgaben`, { nummer: +nr, spalte });
        }
        if (!u.fensterFehler) u.hinweis = { text: `#${nr} nach ${b ? b.titel : slug} · ${spalte}`, at: Date.now() };
        break; // der Hinweis entsteht nach dem Laden — selbst zeichnen, nicht auf das Echo des Commits warten (R00061)
      }
      case 'legen': {
        if (ichNoetig()) break;
        const [slug, nr, spalte] = arg.split('|');
        u.pop = null;
        await schreiben('POST', `/api/boards/${encodeURIComponent(slug)}/aufgaben`, { nummer: +nr, spalte });
        return;
      }
      case 'abnehmen': {
        if (ichNoetig()) break;
        const [slug, nr] = arg.split('|');
        await schreiben('DELETE', `/api/boards/${encodeURIComponent(slug)}/aufgaben/${nr}`);
        return;
      }
      case 'anhang-weg': if (ichNoetig()) break; await schreiben('DELETE', `/api/aufgaben/${u.offen}/anhaenge/${encodeURIComponent(arg)}`); return;
      case 'herkunft-neu': {
        if (!(wert || '').trim() || ichNoetig()) break;
        const a = aufgabe(u.offen), alt = a.herkunft.filter(x => x !== 'thin air');
        u.fokus = '#herkunft-neu';
        return aufgabeAendern(u.offen, { herkunft: wert.trim().toLowerCase() === 'thin air' ? ['thin air'] : [...alt, wert.trim()] });
      }
      case 'herkunft-weg': {
        if (ichNoetig()) break;
        const a = aufgabe(u.offen);
        return aufgabeAendern(u.offen, { herkunft: a.herkunft.filter((_, j) => j !== +arg) });
      }
      case 'zeit-neu': {
        if (!(wert || '').trim() || ichNoetig()) break;
        u.fokus = '#zeit-neu';
        await schreiben('POST', `/api/aufgaben/${u.offen}/zeiten`, { dauer: wert });
        return;
      }
      case 'zeit-edit': u.zeitEdit = +arg; u.fokus = '#z-beginn'; break;
      case 'zeit-ok': {
        if (ichNoetig()) break;
        const ende = $('#z-ende');
        const korrektur = { beginn: $('#z-beginn').value.trim(), ...(ende ? { ende: ende.value.trim() } : {}) };
        u.zeitEdit = null;
        await schreiben('PATCH', `/api/aufgaben/${u.offen}/zeiten/${arg}`, korrektur);
        return;
      }
      case 'zeit-weg': if (ichNoetig()) break; await schreiben('DELETE', `/api/aufgaben/${u.offen}/zeiten/${arg}`); return;
      case 'spalte-archivieren': {
        if (ichNoetig()) break;
        const nummern = S.board.spalten.find(sp => sp.name === arg).aufgaben.filter(n => { const a = aufgabe(n); return a && !a.archiviert; });
        try {
          const geaendert = await api('POST', '/api/aufgaben/archivieren', { nummern });
          u.hinweis = { text: `${geaendert.length} ${geaendert.length === 1 ? 'Karte' : 'Karten'} aus „${arg}“ archiviert`, undo: { art: 'zurueckholen', nummern: geaendert }, at: Date.now() };
        } catch (f) { u.fehler = f.message; }
        return laden();
      }
      case 'spalte-schieben': {
        if (ichNoetig()) break;
        const [i, d] = arg.split('|').map(Number);
        const neu = S.board.spalten.map(sp => ({ name: sp.name, alt: sp.name, grenze: sp.grenze || null }));
        [neu[i], neu[i + d]] = [neu[i + d], neu[i]];
        try { await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/spalten`, neu); } catch (f) { u.fehler = f.message; }
        return laden();
      }
      case 'verschieben': { const [nr, spalte] = arg.split('|'); u.fokusKarte = +nr; return act('bewegen', JSON.stringify({ nummer: +nr, spalte, index: 9999 })); }
      case 'klasse-setzen': { const [nr, k] = arg.split('|'); if (ichNoetig()) break; return aufgabeAendern(+nr, { klasse: k || null }); }
      case 'faellig-karte': {
        const [nr, n] = arg.split('|');
        if (ichNoetig()) break;
        const d = new Date(); d.setDate(d.getDate() + (+n || 0));
        return aufgabeAendern(+nr, { faellig: n === '' ? null : isoD(d) });
      }
      case 'kopieren': {
        const a = aufgabe(+arg), text = `#${a.nummer} ${a.titel}`;
        try { await navigator.clipboard.writeText(text); u.hinweis = { text: `„${text}“ kopiert`, at: Date.now() }; }
        catch (_) { u.hinweis = { text: `Kopieren nicht erlaubt — ${text}`, at: Date.now() }; }
        break;
      }
      case 'zuweisen': {
        if (ichNoetig()) break;
        const nummern = nummernAus(arg);
        u.zuweisen = { nummern, wahl: zuweisenStart(nummern.map(aufgabe), personen()) };
        u.fokus = '#zuweisen [data-act="zuweisen-wahl"]';
        break;
      }
      case 'zuweisen-wahl': {
        u.zuweisen.wahl[arg] = zuweisenWeiter(u.zuweisen.wahl[arg]);
        u.fokus = `#zuweisen [data-arg="${CSS.escape(arg)}"]`;
        break;
      }
      case 'zuweisen-ab': case 'zuweisen-bg': zuweisenSchliessen(); break;
      case 'zuweisen-ok': {
        const { nummern, wahl } = zuweisenSchliessen();
        const aenderungen = nummern.map(aufgabe).map(a => ({ nummer: a.nummer, vorher: a.zustaendige, zustaendige: zustaendigeNach(a.zustaendige, wahl, personen()) }))
          .filter(x => x.zustaendige.join() !== x.vorher.join()).map(({ nummer, zustaendige }) => ({ nummer, zustaendige }));
        if (!aenderungen.length) break;
        return mehrereAendern(aenderungen);
      }
      /* Massenaktionen (R00065): das Argument beginnt bzw. endet mit der Nummernliste „3,5“ */
      case 'm-verschieben': {
        const [l, spalte] = arg.split('|'), nummern = nummernAus(l);
        const index = S.board.spalten.find(sp => sp.name === spalte).aufgaben.filter(n => !nummern.includes(n)).length;
        return mehrereBewegen(nummern, spalte, index);
      }
      case 'm-klasse': { const [l, k] = arg.split('|'); return mehrereAendern(nummernAus(l).map(nummer => ({ nummer, klasse: k || null }))); }
      case 'm-faellig': {
        const [l, n] = arg.split('|'), d = new Date();
        d.setDate(d.getDate() + (+n || 0));
        return mehrereAendern(nummernAus(l).map(nummer => ({ nummer, faellig: n === '' ? null : isoD(d) })));
      }
      case 'm-mich': {
        if (ichNoetig()) break;
        const aenderungen = nummernAus(arg).map(aufgabe).filter(a => !a.zustaendige.includes(S.ich)).map(a => ({ nummer: a.nummer, zustaendige: [...a.zustaendige, S.ich] }));
        if (!aenderungen.length) break;
        return mehrereAendern(aenderungen);
      }
      case 'm-legen': {
        if (ichNoetig()) break;
        const [slug, spalte, l] = arg.split('|');
        await schreiben('POST', `/api/boards/${encodeURIComponent(slug)}/aufgaben/mehrere`, { nummern: nummernAus(l), spalte });
        return;
      }
      case 'm-archivieren': {
        if (ichNoetig()) break;
        try {
          const geaendert = await api('POST', '/api/aufgaben/archivieren', { nummern: nummernAus(arg) });
          u.auswahl = [];
          u.hinweis = { text: `${geaendert.length} ${geaendert.length === 1 ? 'Karte' : 'Karten'} archiviert`, undo: { art: 'zurueckholen', nummern: geaendert }, at: Date.now() };
        } catch (f) { u.fehler = f.message; }
        return laden();
      }
      case 'mich': {
        if (ichNoetig()) break;
        const a = aufgabe(+arg), z = a.zustaendige.includes(S.ich) ? a.zustaendige.filter(k => k !== S.ich) : [...a.zustaendige, S.ich];
        u.fokusKarte = +arg;
        return aufgabeAendern(+arg, { zustaendige: z });
      }
      case 'umbenennen': if (ichNoetig()) break; u.umbenennen = +arg; u.fokus = '#umbenennen'; break;
      case 'umbenennen-ok': {
        const a = aufgabe(+arg), titel = (wert || '').trim();
        u.umbenennen = null; u.fokusKarte = +arg;
        if (!titel || titel === a.titel) break;
        return aufgabeAendern(+arg, { titel });
      }
      case 'faellig': {
        const d = new Date(); d.setDate(d.getDate() + (+arg || 0));
        return aufgabeAendern(u.offen, { faellig: arg === '' ? null : isoD(d) });
      }
      case 'beschreibung-bearbeiten': u.beschreibungBearbeiten = true; u.fokus = '#beschreibung'; break;
      case 'zustaendig': {
        const a = aufgabe(u.offen), z = a.zustaendige.includes(arg) ? a.zustaendige.filter(k => k !== arg) : [...a.zustaendige, arg];
        return aufgabeAendern(u.offen, { zustaendige: z });
      }
      case 'zaehlung': {
        // zählt (Standard oder true) → false; false → Schlüssel entfernen, der Standard gilt wieder
        const r = aufgabe(u.offen).reporting || {};
        return aufgabeAendern(u.offen, { reporting: { [arg]: r[arg] === false ? null : false } });
      }
      case 'phase-entfaellt': {
        const weg = (aufgabe(u.offen).phasen || {}).uebersprungen || [];
        return aufgabeAendern(u.offen, { phasen: { uebersprungen: weg.includes(arg) ? weg.filter(n => n !== arg) : [...weg, arg] } });
      }
      case 'setup': u.pop = null; u.setup = { spalten: S.board.spalten.map(sp => ({ name: sp.name, alt: sp.name, grenze: sp.grenze || '', n: sp.aufgaben.length, pruefungen: [...(sp.pruefungen || [])], notiz: sp.notiz || '', farbe: sp.farbe || '' })), anwendungen: S.board.anwendungen == null ? null : [...S.board.anwendungen] }; break;
      case 'bind': u.setup.anwendungen = bindungUmschalten(u.setup.anwendungen, arg, S.zustand.einstellungen.quellen.anwendungen || []); break;
      case 'col-pruef': { const sp = u.setup.spalten[+arg]; sp.pruefungen = umschalten(sp.pruefungen, 'wbs-effects-green'); break; }
      case 'setup-weg': u.setup = null; break;
      case 'p-art': { const [i, art] = arg.split('|'); u.einr.personen[+i].art = art; break; }
      case 'p-still': { const p = u.einr.personen[+arg]; p.aktiv = !p.aktiv; break; }
      case 'n-art': u.nart = arg; break;
      case 'p-add': {
        const kuerzel = ($('#npk').value || '').trim().toLowerCase(), name = (wert || '').trim();
        if (!kuerzel || !name) { u.einr.fehler = 'Kürzel und Name nötig'; break; }
        u.einr.personen.push({ kuerzel, name, art: u.nart === 'agent' ? 'agent' : 'human', aktiv: true });
        u.fokus = '#npk';
        break;
      }
      case 'a-add': {
        const kuerzel = ($('#nak').value || '').trim().toLowerCase(), name = (wert || '').trim();
        if (!kuerzel || !name) { u.einr.fehler = 'Kürzel und Name nötig'; break; }
        u.einr.quellen.anwendungen = [...(u.einr.quellen.anwendungen || []), { kuerzel, name, wbs: '', anforderungen: '' }];
        u.fokus = `[data-ef="awbs"][data-i="${u.einr.quellen.anwendungen.length - 1}"]`;
        break;
      }
      case 'a-del': u.einr.quellen.anwendungen.splice(+arg, 1); break;
      case 'k-pal': u.palFuer = u.palFuer === +arg ? null : +arg; break;
      case 'k-farbe': { const [i, f] = arg.split('|'); u.einr.klassen[+i].farbe = f; break; }
      case 'k-del': u.einr.klassen.splice(+arg, 1); u.palFuer = null; break;
      case 'k-add': {
        const schluessel = ($('#nck').value || '').trim().toLowerCase(), bezeichnung = (wert || '').trim();
        if (!schluessel || !bezeichnung) { u.einr.fehler = 'Schlüssel und Bezeichnung nötig'; break; }
        const belegt = u.einr.klassen.map(k => k.farbe);
        u.einr.klassen.push({ schluessel, bezeichnung, farbe: PAL.find(f => !belegt.includes(f)) || 'grey' });
        u.fokus = '#nck';
        break;
      }
      case 'einr-weg': u.einr = kopie(S.zustand.einstellungen); u.palFuer = null; break;
      case 'einr-ok': {
        if (ichNoetig()) break;
        const { fehler, gespeichert, ...daten } = u.einr;
        try {
          await api('PUT', '/api/einstellungen', daten);
          u.einr = null; u.palFuer = null;
          await laden();
          u.einr.gespeichert = true;
          break;
        } catch (f) { u.einr.fehler = f.message; break; }
      }
      case 'col-l': case 'col-r': {
        const d = u.setup.spalten, i = +arg, j = a === 'col-l' ? i - 1 : i + 1;
        if (j >= 0 && j < d.length) [d[i], d[j]] = [d[j], d[i]];
        break;
      }
      case 'col-del': u.setup.spalten.splice(+arg, 1); break;
      case 'thema': {
        S.thema = THEMEN[(THEMEN.indexOf(S.thema) + 1) % THEMEN.length];
        themaAnwenden(S.thema);
        try { localStorage.setItem('kanbanD.thema', S.thema); } catch (_) { }
        break;
      }
      case 'col-farbe-weg': u.setup.spalten[+arg].farbe = ''; break;
      case 'col-add': {
        const name = (wert || '').trim();
        if (!name) break;
        const d = u.setup.spalten;
        d.splice(Math.max(0, d.length - 1), 0, { name, alt: null, grenze: '', n: 0, pruefungen: [], notiz: '', farbe: '' });
        u.fokus = '#col-new';
        break;
      }
      case 'setup-ok': {
        if (ichNoetig()) break;
        try {
          await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/spalten`, u.setup.spalten.map(sp => ({ name: sp.name.trim(), alt: sp.alt, grenze: +sp.grenze > 0 ? +sp.grenze : null, pruefungen: sp.pruefungen, notiz: sp.notiz, farbe: sp.farbe })));
          if (u.setup.anwendungen && JSON.stringify(u.setup.anwendungen) !== JSON.stringify(S.board.anwendungen)) await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/anwendungen`, u.setup.anwendungen);
          u.setup = null;
          return laden();
        } catch (f) { u.setup.fehler = f.message; break; }
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
    if (!u.first) await laden().catch(() => { });
  }
  render();
}

document.addEventListener('dblclick', e => {
  const t = e.target.closest && e.target.closest('[data-dbl]');
  if (t) { e.preventDefault(); clearTimeout(S.titelKlick); act(t.dataset.dbl, t.dataset.arg); }
});
document.addEventListener('focusout', e => {
  // Verlassen ohne Änderung: wieder formatiert zeigen (mit Änderung sorgt „change“ dafür).
  if (e.target.id === 'beschreibung' && S.ui.beschreibungBearbeiten) setTimeout(() => { if (S.ui.beschreibungBearbeiten && document.activeElement !== $('#beschreibung')) { S.ui.beschreibungBearbeiten = false; render(); } }, 50);
  // Verlassen des Teilaufgaben-Feldes speichert (R00066); nach Enter oder Esc ist teilEdit schon leer
  if (e.target.id === 'teil-edit' && S.ui.teilEdit) { const wert = e.target.value; setTimeout(() => { if (S.ui.teilEdit && document.activeElement !== $('#teil-edit')) act('teil-text', '', wert); }, 0); }
  if (e.target.id === 'umbenennen' && S.ui.umbenennen) setTimeout(() => { if (S.ui.umbenennen && document.activeElement !== $('#umbenennen')) { S.ui.umbenennen = null; render(); } }, 0);
});

document.addEventListener('change', e => {
  // Aktion und Ebene einer Wirkung ändern, welche Felder das Formular zeigt
  if (e.target.dataset && e.target.dataset.wf && e.target.tagName === 'SELECT' && S.ui.wirkungNeu) { S.ui.wirkungNeu[e.target.dataset.wf] = e.target.value; S.ui.wirkungNeu.fehler = null; render(); return; }
  const tf = e.target.dataset && e.target.dataset.tf;
  if (tf) {
    // nicht neu zeichnen: das Formular behält Fokus und Eingaben, nur die Vorschau folgt
    if (tf === 'hex') { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value.trim())) S.ui.tf.farbe = e.target.value.trim().toLowerCase(); }
    else S.ui.tf[tf] = e.target.value;
    const vorschau = $('.tm-form .tm-vorschau line');
    if (vorschau) vorschau.setAttribute('style', terminStil(S.ui.tf));
    return;
  }
  if (e.target.dataset && e.target.dataset.wn === 'ebene' && S.ui.wbsNeu) { S.ui.wbsNeu.ebene = e.target.value; S.ui.wbsNeu.fehler = null; render(); return; }
  if (e.target.dataset && e.target.dataset.dl) { S.ui[e.target.dataset.dl] = e.target.value; render(); return; }
  const bf = e.target.dataset && e.target.dataset.bf;
  if (bf) {
    const aenderung = { [bf]: e.target.value };
    if (bf !== 'zeitraum') aenderung.zeitraum = 'eigen';
    berichtsfilterSetzen(aenderung);
    render();
    return;
  }
  const nf = e.target.dataset && e.target.dataset.nf;
  if (nf && S.ui.neu && (nf === 'board' || nf === 'spalte' || nf === 'klasse')) {
    S.ui.neu[nf] = e.target.value;
    if (nf === 'board') { const b = (S.boards || []).find(x => x.slug === e.target.value); S.ui.neu.spalte = b && b.spalten[0] ? b.spalten[0].name : ''; }
    render();
    return;
  }
  if (e.target.id === 'anhang-datei') { anhaengeHochladen([...e.target.files]); return; }
  const af = e.target.dataset && e.target.dataset.af;
  if (!af || !S.ui.offen) return;
  const v = e.target.value;
  if (af === 'spalte') { act('bewegen', JSON.stringify({ nummer: S.ui.offen, spalte: v, index: 9999 })); return; }
  if (af === 'beschreibung') S.ui.beschreibungBearbeiten = false;
  const aenderung = af === 'labels' ? { labels: v.split(',').map(s => s.trim()).filter(Boolean) }
    : af === 'klasse' || af === 'faellig' ? { [af]: v || null } : { [af]: v };
  aufgabeAendern(S.ui.offen, aenderung);
});

// Umschalt/Strg + Klick auf eine Karte markiert keinen Text
document.addEventListener('mousedown', e => {
  if ((e.shiftKey || e.ctrlKey || e.metaKey) && e.target.closest && e.target.closest('.ka[data-id]')) e.preventDefault();
});
document.addEventListener('click', e => {
  if (S.ui.menue) {
    const z = e.target.closest('.km-e[data-mp]');
    if (!z) { if (!e.target.closest('#kmenue')) menueZu(); return; }
    const pfad = z.dataset.mp.split('.').map(Number);
    const eintrag = pfad.length === 1 ? S.ui.menue.eintraege[pfad[0]] : S.ui.menue.eintraege[pfad[0]].unter[pfad[1]];
    if (eintrag.unter) { S.ui.menue.index = pfad[0]; S.ui.menue.unter = { von: pfad[0], eintraege: eintrag.unter, index: menueSchritt(eintrag.unter, -1, 1) }; render(); return; }
    menueAusfuehren(eintrag);
    return;
  }
  if (e.target.closest('a[href^="vscode:"]')) return;
  if (e.target.closest('.menue a[href^="#"]')) { S.ui.pop = null; return; }
  // Mehrfachauswahl (R00065): Strg/Umschalt + Klick wählt, jeder andere Klick außerhalb der Dialoge hebt sie auf
  const kk = S.ui.view === 'board' && e.target.closest('.ka[data-id]:not(.fehlt):not(.defekt)');
  if (kk && (e.ctrlKey || e.metaKey || e.shiftKey) && !e.target.closest('[data-leiste]')) { auswahlKlick(+kk.dataset.id, e); return; }
  const aufheben = S.ui.auswahl.length > 0 && !e.target.closest('#over') && !e.target.closest('[data-leiste]');
  if (aufheben) auswahlAufheben();
  const el = e.target.closest('[data-act]');
  if (S.ui.pop && !e.target.closest('.pop') && !(el && el.dataset.act === 'pop')) {
    S.ui.pop = null; S.ui.ichNoetig = false;
    if (!el) { render(); return; }
  }
  if (!el || el.disabled) { if (aufheben) render(); return; }
  if (['schliessen-bg', 'nf-zu-bg', 'zuweisen-bg'].includes(el.dataset.act) && e.target !== el) return;
  if (el.dataset.act === 'oeffnen' && (e.target.closest('[data-leiste]') || e.target.closest('#umbenennen'))) return;
  // Klick auf den Titel öffnet erst, wenn kein Doppelklick (Umbenennen) folgt.
  if (el.dataset.act === 'oeffnen' && e.target.closest('[data-dbl]')) {
    clearTimeout(S.titelKlick);
    if (e.detail > 1) return;
    S.titelKlick = setTimeout(() => act('oeffnen', el.dataset.arg), 250);
    return;
  }
  if (el.tagName === 'A') e.preventDefault();
  act(el.dataset.act, el.dataset.arg);
});
document.addEventListener('input', e => {
  const wf = e.target.dataset && e.target.dataset.wf;
  if (wf && S.ui.wirkungNeu) { S.ui.wirkungNeu[wf] = e.target.value; return; }
  const wn = e.target.dataset && e.target.dataset.wn;
  if (wn && S.ui.wbsNeu && wn !== 'ebene') { S.ui.wbsNeu[wn] = e.target.value; return; }
  if (e.target.dataset && (e.target.dataset.tf === 'name' || e.target.dataset.tf === 'datum')) { S.ui.tf[e.target.dataset.tf] = e.target.value; return; }
  const nf = e.target.dataset && e.target.dataset.nf;
  if (nf && S.ui.neu) {
    S.ui.neu[nf] = e.target.value;
    S.ui.neu.fehler = null;
    if (nf === 'titel') { const v = $('#neu-vorschau'); if (v) v.innerHTML = e.target.value.trim() ? vSchnellVorschau(e.target.value) : ''; }
    return;
  }
  if (e.target.id === 'flt') {
    filterSetzen(e.target.value);
    $('#main').innerHTML = vHaupt();
    return;
  }
  const sf = e.target.dataset && e.target.dataset.sf;
  if (sf && S.ui.setup) {
    const sp = S.ui.setup.spalten[+e.target.dataset.i];
    sp[sf] = sf === 'grenze' ? e.target.value.replace(/\D/g, '') : e.target.value;
    S.ui.setup.fehler = null;
    if (sf === 'farbe') { const bahn = e.target.closest('.bahn'); bahn.classList.add('gefaerbt'); bahn.style.setProperty('--sf', sp.farbe); e.target.nextElementSibling.textContent = sp.farbe; }
    $('#setup-vorschau').textContent = setupText(S.ui.setup);
    return;
  }
  const ef = e.target.dataset && e.target.dataset.ef;
  if (ef && S.ui.einr) {
    const d = S.ui.einr, i = +e.target.dataset.i, v = e.target.value;
    if (ef === 'pname') d.personen[i].name = v;
    if (ef === 'klabel') d.klassen[i].bezeichnung = v;
    if (ef === 'khex' && /^#[0-9a-f]{6}$/i.test(v.trim())) d.klassen[i].farbe = v.trim().toLowerCase();
    if (ef === 'wbs') d.quellen.wbs = v;
    if (ef === 'anf') d.quellen.anforderungen = v;
    if (ef === 'aname') d.quellen.anwendungen[i].name = v;
    if (ef === 'awbs') d.quellen.anwendungen[i].wbs = v;
    if (ef === 'aanf') d.quellen.anwendungen[i].anforderungen = v;
    d.fehler = null; d.gespeichert = false;
    $('#einr-vorschau').textContent = einstellungenText(d);
    return;
  }
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
  if (S.ui.menue) { menueTaste(e); return; }
  if (e.key === 'Enter' && t.classList && t.classList.contains('besch-lesen')) { e.preventDefault(); act('beschreibung-bearbeiten'); return; }
  if (e.key === 'Enter' && t.dataset && t.dataset.enter && !e.shiftKey) {
    e.preventDefault();
    act(t.dataset.enter, t.dataset.arg, t.value);
    return;
  }
  if (S.ui.neu) {
    if (e.key === 'Escape') { e.preventDefault(); S.ui.neu = null; render(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); neueAufgabeAnlegen(e.shiftKey); return; }
    if (e.key === 'Enter' && t.id === 'neu-titel') { e.preventDefault(); neueAufgabeAnlegen(e.shiftKey); return; }
    if (!(e.key === 'Enter' && t.dataset && t.dataset.enter)) return;
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && t.id === 'beschreibung') { e.preventDefault(); t.blur(); return; }
  if (e.key === 'Escape' && t.id === 'flt') {
    if (S.ui.filter) { t.value = ''; filterSetzen(''); render(); $('#flt').focus(); } else t.blur();
    return;
  }
  if (S.ui.hilfe && (e.key === 'Escape' || e.key === '?')) { S.ui.hilfe = false; render(); return; }
  if (S.ui.zuweisen) { zuweisenTaste(e, t); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && S.ui.hinweis && S.ui.hinweis.undo) {
    e.preventDefault();
    act('rueckgaengig');
    return;
  }
  if (ueberallTaste(e, t)) return;
  if (!S.ui.offen && !S.ui.pop && menueTasteAufZiel(e, t)) return;
  if (brettTaste(e, t)) return;
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !S.ui.offen && $('#flt')) {
    e.preventDefault();
    $('#flt').focus();
    return;
  }
  if (e.key === 'Escape') {
    if (S.ui.pop) { S.ui.pop = null; S.ui.ichNoetig = false; render(); return; }
    if (S.ui.umbenennen) { const n = S.ui.umbenennen; S.ui.umbenennen = null; S.ui.fokusKarte = n; render(); return; }
    if (S.ui.teilEdit) { S.ui.teilEdit = null; render(); return; }
    if (S.ui.setup) { S.ui.setup = null; render(); return; }
    if (S.ui.offen) { if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) t.blur(); S.ui.offen = null; render(); return; }
    if (S.ui.offenDefekt) { S.ui.offenDefekt = null; S.ui.defektDatei = null; render(); return; }
    if (S.ui.auswahl.length) { auswahlAufheben(); render(); return; }
  }
  if (S.ui.offen && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    act('blaettern', e.key === 'ArrowDown' ? '1' : '-1');
  }
});

/* Kontextmenü: Modell aus menue.js, Zustand in S.ui.menue = {titel, x, y, eintraege, index, unter: {von, eintraege, index}} */
function menueFuerKarte(nr, x, y) {
  const a = aufgabe(nr);
  if (!a || !S.board) return;
  if (S.ui.auswahl.length > 1 && S.ui.auswahl.includes(nr)) { menueFuerAuswahl(x, y); return; }
  auswahlAufheben();
  const spalte = S.board.spalten.find(sp => sp.aufgaben.includes(nr));
  const boards = (S.boards || []).filter(b => !b.spalten.some(sp => sp.aufgaben.includes(nr)) && b.spalten.length).map(b => ({ slug: b.slug, titel: b.titel, spalte: b.spalten[0].name }));
  const eintraege = kartenMenue(a, { spalten: S.board.spalten.map(sp => sp.name), spalte: spalte && spalte.name, klassen: S.zustand.einstellungen.klassen, boards, ich: S.ich, meinerLaeuft: laufende(a).some(z => z.wer === S.ich), meine: a.zustaendige.includes(S.ich) });
  S.ui.fokusKarte = nr;
  S.ui.pop = null;
  S.ui.menue = { titel: `#${nr} ${a.titel}`, x, y, eintraege, index: menueSchritt(eintraege, -1, 1), unter: null };
  render();
}
function menueOeffnen(titel, eintraege, x, y) {
  S.ui.pop = null;
  S.ui.menue = { titel, x, y, eintraege, index: menueSchritt(eintraege, -1, 1), unter: null };
  render();
}
function menueFuerSpalte(i, x, y) {
  const sp = S.board.spalten[i];
  const offen = sp.aufgaben.filter(n => { const a = aufgabe(n); return a && !a.archiviert; }).length;
  menueOeffnen(`Spalte „${sp.name}“`, spaltenMenue(sp.name, i, S.board.spalten.length, offen), x, y);
}
function menueFuerZeile(nr, x, y) {
  const a = aufgabe(nr);
  const liegtAufBoards = (S.boards || []).flatMap(b => b.spalten.filter(sp => sp.aufgaben.includes(nr)).map(sp => ({ slug: b.slug, titel: b.titel, spalte: sp.name })));
  const frei = (S.boards || []).filter(b => !b.spalten.some(sp => sp.aufgaben.includes(nr))).map(b => ({ slug: b.slug, titel: b.titel, spalten: b.spalten.map(sp => sp.name) }));
  menueOeffnen(`#${nr} ${a.titel}`, listenMenue(a, { liegtAuf: liegtAufBoards, frei }), x, y);
}
function menueEinpassen() {
  const el = $('#kmenue');
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.right > innerWidth - 4) el.style.left = Math.max(4, innerWidth - r.width - 4) + 'px';
  if (r.bottom > innerHeight - 4) el.style.top = Math.max(4, innerHeight - r.height - 4) + 'px';
  el.querySelectorAll('.kmenue.unter').forEach(u => { const ur = u.getBoundingClientRect(); if (ur.right > innerWidth - 4) u.classList.add('links'); });
}
function menueZu() { S.ui.menue = null; render(); }
function menueAusfuehren(e) {
  if (!e || e.trenner || e.aktuell) return;
  if (e.unter) return;
  S.ui.menue = null;
  act(e.act, e.arg);
  render();
}
function menueTaste(ev) {
  const m = S.ui.menue;
  const ebene = m.unter || m;
  const k = ev.key;
  ev.preventDefault();
  if (k === 'Escape' || k === 'Tab') { menueZu(); return; }
  if (k === 'ArrowDown' || k === 'ArrowUp') ebene.index = menueSchritt(ebene.eintraege, ebene.index, k === 'ArrowDown' ? 1 : -1);
  else if (k === 'Home' || k === 'End') ebene.index = menueSchritt(ebene.eintraege, ebene.index, k === 'Home' ? 'anfang' : 'ende');
  else if (k === 'ArrowLeft' && m.unter) m.unter = null;
  else if ((k === 'ArrowRight' || k === 'Enter' || k === ' ') && !m.unter && m.eintraege[m.index] && m.eintraege[m.index].unter) {
    const u = m.eintraege[m.index].unter;
    m.unter = { von: m.index, eintraege: u, index: menueSchritt(u, -1, 1) };
  } else if (k === 'Enter' || k === ' ') { menueAusfuehren(ebene.eintraege[ebene.index]); return; }
  else {
    // Kürzel im Menü: wie auf dem Board
    const treffer = ebene.eintraege.find(e => e.kuerzel && e.kuerzel.toLowerCase() === k.toLowerCase() && !e.aktuell);
    if (treffer) { menueAusfuehren(treffer); return; }
  }
  render();
}
document.addEventListener('contextmenu', e => {
  if (!e.target.closest) return;
  const wbsZeile = S.ui.view === 'wbs' && S.wbs && e.target.closest('tr.wbs-z[data-id]');
  if (wbsZeile) {
    const k = S.wbs.knoten.find(x => x.id === wbsZeile.dataset.id), eintraege = k ? wbsZeilenMenue(k) : [];
    if (eintraege.length) { e.preventDefault(); menueOeffnen(`${k.id} ${k.name}`, eintraege, e.clientX, e.clientY); }
    return;
  }
  const karte = e.target.closest('.ka[data-id]:not(.fehlt):not(.defekt)'), kopf = e.target.closest('.bahn-kopf[data-kopf]'), zeile = e.target.closest('tr[data-zeile]');
  if (karte && S.ui.view === 'board') { e.preventDefault(); menueFuerKarte(+karte.dataset.id, e.clientX, e.clientY); }
  else if (kopf && S.ui.view === 'board' && !S.ui.setup) { e.preventDefault(); menueFuerSpalte(+kopf.dataset.kopf, e.clientX, e.clientY); }
  else if (zeile) { e.preventDefault(); menueFuerZeile(+zeile.dataset.zeile, e.clientX, e.clientY); }
});
/** Menütaste oder Umschalt+F10 auf Spaltenkopf oder Listenzeile; Enter auf einer Zeile öffnet die Aufgabe. */
function menueTasteAufZiel(e, t) {
  const menuetaste = e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10');
  const kopf = t.closest && t.closest('.bahn-kopf[data-kopf]'), zeile = t.closest && t.closest('tr[data-zeile]');
  if (!kopf && !zeile) return false;
  const r = t.getBoundingClientRect();
  if (menuetaste) { e.preventDefault(); if (kopf) menueFuerSpalte(+kopf.dataset.kopf, r.left + 16, r.bottom); else menueFuerZeile(+zeile.dataset.zeile, r.left + 40, r.bottom); return true; }
  if (zeile && e.key === 'Enter') { e.preventDefault(); act('oeffnen', zeile.dataset.zeile); return true; }
  if (kopf && e.key === 'n') { e.preventDefault(); act('add', S.board.spalten[+kopf.dataset.kopf].name); return true; }
  return false;
}
document.addEventListener('mouseover', e => {
  const m = S.ui.menue;
  const z = m && e.target.closest && e.target.closest('.km-e[data-mp]');
  if (!z) return;
  const pfad = z.dataset.mp.split('.').map(Number);
  if (pfad.length === 1) {
    // offen ist schon, was offen sein soll — auch wenn der erste Eintrag ein Untermenü hat (Menü „n Karten“)
    if (m.index === pfad[0] && (m.unter ? m.unter.von === pfad[0] : !m.eintraege[pfad[0]].unter)) return;
    m.index = pfad[0];
    const eintrag = m.eintraege[pfad[0]];
    m.unter = eintrag.unter ? { von: pfad[0], eintraege: eintrag.unter, index: -1 } : null;
  } else if (m.unter && m.unter.index !== pfad[1]) m.unter.index = pfad[1];
  else return;
  render();
});

/* Kürzel überall, im Aufgabenfenster und in der Aufgabenliste */
function ueberallTaste(e, t) {
  const u = S.ui;
  if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || e.ctrlKey || e.metaKey || e.altKey || u.menue || u.first || u.setup || u.neu) return false;
  if (e.key === '?') { u.hilfe = true; render(); return true; }
  if (u.hilfe) return false;
  if (u.offen) return fensterTaste(e);
  if (u.pop || u.offenDefekt) return false;
  const g = gFolge(S.gVorher, e.key);
  clearTimeout(S.gUhr);
  S.gVorher = g.warte ? 'g' : null;
  if (g.warte) { S.gUhr = setTimeout(() => { S.gVorher = null; }, 1500); e.preventDefault(); return true; }
  if (g.ziel) { e.preventDefault(); location.hash = g.ziel === '#/board/' ? '#/board/' + (u.slug || '') : g.ziel === '#/wbs/' ? '#/wbs/' + encodeURIComponent((gebunden()[0] || {}).kuerzel || '') : g.ziel; return true; }
  if (e.key === 'b' || e.key === 'i') { e.preventDefault(); act('pop', e.key === 'b' ? 'board' : 'ich'); return true; }
  if (u.view === 'aufgaben') return listenTaste(e, t);
  if (e.key === 'n' && u.view !== 'board') { e.preventDefault(); act('add', '-'); return true; }
  return false;
}
function fensterTaste(e) {
  const nr = S.ui.offen, a = aufgabe(nr);
  if (!a) return false;
  const fokus = sel => { const el = $(sel); if (el) { e.preventDefault(); el.focus(); } return true; };
  switch (e.key) {
    case 't': e.preventDefault(); laufende(a).some(z => z.wer === S.ich) ? act('stop', `${nr}|${S.ich}`) : act('start', String(nr)); return true;
    case 'm': e.preventDefault(); act('mich', String(nr)); return true;
    case 'a': e.preventDefault(); act(a.archiviert ? 'zurueckholen' : 'archivieren', String(nr)); return true;
    case 'e': return fokus('[data-af="titel"]');
    case 'b': e.preventDefault(); act('beschreibung-bearbeiten'); return true;
    case 's': return fokus('#teil-neu');
    case 'k': return fokus('#km-inp');
    case 'd': e.preventDefault(); act('tab', S.ui.tab === 'datei' ? 'inhalt' : 'datei'); return true;
    default: return false;
  }
}
function listenTaste(e, t) {
  const zeilen = [...document.querySelectorAll('tr[data-zeile]')];
  const jetzt = t.closest && t.closest('tr[data-zeile]');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!zeilen.length) return false;
    e.preventDefault();
    const i = zeilen.indexOf(jetzt);
    const n = i < 0 ? 0 : Math.max(0, Math.min(zeilen.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    zeilen[n].focus();
    S.ui.fokusZeile = +zeilen[n].dataset.zeile;
    return true;
  }
  if (e.key === 'n') { e.preventDefault(); act('add', '-'); return true; }
  if (jetzt && (e.key === 'a' || e.key === 'Delete' || e.key === 'c')) {
    e.preventDefault();
    const a = aufgabe(+jetzt.dataset.zeile);
    S.ui.fokusZeile = a.nummer;
    act(e.key === 'c' ? 'kopieren' : a.archiviert ? 'zurueckholen' : 'archivieren', String(a.nummer));
    return true;
  }
  return false;
}

/* Tastatur auf dem Board: Pfeile wählen, Umschalt+Pfeile verschieben, Enter öffnet, n legt an, ? hilft. */
const RICHTUNG = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'hoch', ArrowDown: 'runter' };
function brettTaste(e, t) {
  const u = S.ui;
  const senkrecht = e.key === 'ArrowUp' || e.key === 'ArrowDown';
  if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || u.neu || u.offen || u.offenDefekt || u.setup || u.pop || u.view !== 'board' || !S.board || e.ctrlKey || e.metaKey || (e.altKey && !senkrecht)) return false;
  const karte = t.closest && t.closest('.ka[data-id]');
  const nr = karte ? +karte.dataset.id : null;
  if (e.key === 'Enter' && karte) { act(karte.dataset.act, karte.dataset.arg); return true; }
  if (karte && e.key === 'p' && aufgabe(nr)) { e.preventDefault(); act('zuweisen', String(nr)); return true; }
  if (karte && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
    e.preventDefault();
    const r = karte.getBoundingClientRect();
    menueFuerKarte(nr, r.left + 24, r.top + 24);
    return true;
  }
  if (karte && aufgabe(nr) && (e.key === 'a' || e.key === 'Delete' || e.key === 'c' || /^[1-9]$/.test(e.key))) {
    e.preventDefault();
    if (e.key === 'a' || e.key === 'Delete') act('archivieren', String(nr));
    else if (e.key === 'c') act('kopieren', String(nr));
    else {
      const sp = S.board.spalten[+e.key - 1];
      if (sp && !sp.aufgaben.includes(nr)) act('verschieben', `${nr}|${sp.name}`);
    }
    return true;
  }
  if (karte && (e.key === 't' || e.key === ' ' || e.key === 'm' || e.key === 'F2')) {
    e.preventDefault();
    const a = aufgabe(nr);
    if (!a) return true;
    u.fokusKarte = nr;
    if (e.key === 'F2') act('umbenennen', String(nr));
    else if (e.key === 'm') act('mich', String(nr));
    else if (laufende(a).some(z => z.wer === S.ich)) act('stop', `${nr}|${S.ich}`);
    else act('start', String(nr));
    return true;
  }
  if (e.key === 'n') {
    const spalte = karte ? karte.closest('.bahn').dataset.col : S.board.spalten[0] && S.board.spalten[0].name;
    if (spalte) { e.preventDefault(); act('add', spalte); }
    return true;
  }
  const r = RICHTUNG[e.key];
  if (!r) return false;
  e.preventDefault();
  // Umschalt + ↑/↓ erweitert die Auswahl; getauscht wird mit Alt + ↑/↓ (R00065)
  if (e.shiftKey && senkrecht) {
    const n = nr == null ? null : nachbar(sichtbareSpalten(), nr, r);
    if (n == null) return true;
    u.auswahl = [...new Set([...u.auswahl, nr, n])];
    if (u.anker == null) u.anker = nr;
    u.fokusKarte = n;
    render();
    return true;
  }
  if (e.shiftKey || e.altKey) {
    if (nr == null) return true;
    const z = verschiebeziel(sichtbareSpalten(), nr, r);
    if (z) { u.fokusKarte = nr; act('bewegen', JSON.stringify({ nummer: nr, ...z })); }
    return true;
  }
  const n = nachbar(sichtbareSpalten(), nr, r);
  if (n != null) { u.fokusKarte = n; const k = $(`.ka[data-id="${n}"]`); if (k) k.focus(); }
  return true;
}

/* Ziehen: obere Hälfte = davor, untere = dahinter, freie Fläche = ans Ende. */
let zug = null, ziel = null, zugMenge = null;
const einfuegeMarkenWeg = () => document.querySelectorAll('.ins-b,.ins-a,.ins-end').forEach(x => x.classList.remove('ins-b', 'ins-a', 'ins-end'));
/* Ziehen aus der Aufgabenliste auf die Ziele daneben */
let zugZeile = null;
document.addEventListener('dragstart', e => {
  const z = e.target.closest && e.target.closest('tr[data-zeile][draggable]');
  if (!z) return;
  zugZeile = +z.dataset.zeile;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', '#' + zugZeile); } catch (_) { }
  setTimeout(() => z.classList.add('zieht'));
});
document.addEventListener('dragover', e => {
  if (zugZeile == null) return;
  document.querySelectorAll('.ziel.ueber').forEach(x => x.classList.remove('ueber'));
  const z = e.target.closest && e.target.closest('[data-ziel]');
  if (!z) return;
  e.preventDefault();
  z.classList.add('ueber');
});
document.addEventListener('drop', e => {
  if (zugZeile == null) return;
  const z = e.target.closest && e.target.closest('[data-ziel]');
  const nr = zugZeile;
  zugZeile = null;
  if (!z) return;
  e.preventDefault();
  act('liste-ablegen', `${nr}|${z.dataset.ziel}`);
});
document.addEventListener('dragend', () => {
  zugZeile = null;
  document.querySelectorAll('.ziel.ueber,tr.zieht').forEach(x => x.classList.remove('ueber', 'zieht'));
});
document.addEventListener('dragstart', e => {
  const k = e.target.closest && e.target.closest('.ka[draggable]');
  if (!k) return;
  zug = +k.dataset.id;
  // eine ausgewählte Karte nimmt die ganze Auswahl mit (R00065)
  zugMenge = S.ui.auswahl.length > 1 && S.ui.auswahl.includes(zug) ? [...S.ui.auswahl] : null;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', String(zug)); } catch (_) { }
  setTimeout(() => (zugMenge || [zug]).forEach(n => { const x = $(`.ka[data-id="${n}"]`); if (x) x.classList.add('zieht'); }));
});
/* Teilaufgaben im Aufgabenfenster umordnen (R00067): obere Hälfte = davor, untere = dahinter */
let zugTeil = null, zielTeil = null;
const teilMarkenWeg = () => document.querySelectorAll('.chk.ins-b,.chk.ins-a,.chk.zieht').forEach(x => x.classList.remove('ins-b', 'ins-a', 'zieht'));
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('.chk[data-teil][draggable="true"]');
  if (!c) return;
  zugTeil = +c.dataset.teil; zielTeil = null;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', c.textContent); } catch (_) { }
  setTimeout(() => c.classList.add('zieht'));
});
document.addEventListener('dragover', e => {
  if (zugTeil == null) return;
  const c = e.target.closest && e.target.closest('.chk[data-teil]');
  if (!c) return;
  e.preventDefault();
  document.querySelectorAll('.chk.ins-b,.chk.ins-a').forEach(x => x.classList.remove('ins-b', 'ins-a'));
  const r = c.getBoundingClientRect(), davor = e.clientY < r.top + r.height / 2;
  c.classList.add(davor ? 'ins-b' : 'ins-a');
  zielTeil = +c.dataset.teil + (davor ? 0 : 1);
});
document.addEventListener('drop', e => {
  if (zugTeil == null) return;
  e.preventDefault();
  const von = zugTeil, nach = zielTeil;
  zugTeil = null; zielTeil = null;
  teilMarkenWeg();
  if (nach != null) act('teil-ordnen', `${von}|${nach}`);
});
document.addEventListener('dragend', () => { zugTeil = null; zielTeil = null; teilMarkenWeg(); });
/* Mehrzeiliges Einfügen: je Zeile eine Aufgabe bzw. Teilaufgabe, in einem Commit. */
document.addEventListener('paste', async e => {
  const art = e.target.dataset && e.target.dataset.mehrfach;
  if (!art) return;
  const zeilen = zeilenAusText(e.clipboardData && e.clipboardData.getData('text'));
  if (zeilen.length < 2) return;
  e.preventDefault();
  if (ichNoetig()) { render(); return; }
  const u = S.ui;
  if (art === 'neu') { await neueAufgabeAnlegen(true, zeilen); return; }
  if (art === 'neu-teil') { u.neu.teil.push(...zeilen); u.fokus = '#neu-teil'; render(); return; }
  if (art === 'teil') {
    u.fokus = '#teil-neu';
    await schreiben('POST', `/api/aufgaben/${u.offen}/teilaufgaben/mehrere`, { texte: zeilen });
    u.hinweis = { text: `${zeilen.length} Teilaufgaben ergänzt`, at: Date.now() };
  }
  u.fokus = '#teil-neu';
  render();
});

/* Tooltip der Verlaufsdiagramme: Fadenkreuz und Werte des Tages unter dem Zeiger (data-tip: Zeilen mit | getrennt) */
document.addEventListener('mouseover', e => {
  const r = e.target.closest && e.target.closest('rect.treffer');
  const tip = $('#tooltip'), kreuz = $('#fadenkreuz');
  if (!tip || !kreuz) return;
  if (!r) { tip.hidden = true; kreuz.setAttribute('x1', -10); kreuz.setAttribute('x2', -10); return; }
  const mitte = +r.getAttribute('x') + +r.getAttribute('width') / 2;
  kreuz.setAttribute('x1', mitte); kreuz.setAttribute('x2', mitte);
  if (r.dataset.tip) {
    const [kopf, ...zeilen] = r.dataset.tip.split('|');
    tip.innerHTML = `<b>${esc(kopf)}</b>${zeilen.map(z => `<span>${esc(z)}</span>`).join('')}`;
  } else {
    const x = S.bdTage[+r.dataset.tag];
    tip.innerHTML = `<b>${x.datum}</b><span><i class="k-offen"></i>offen ${x.offen}</span><span><i class="k-umfang"></i>Umfang ${x.umfang}</span>`;
  }
  tip.hidden = false;
  const flaeche = r.closest('.dflaeche').getBoundingClientRect(), rb = r.getBoundingClientRect();
  tip.style.left = Math.min(flaeche.width - 150, Math.max(0, rb.left - flaeche.left + rb.width / 2 + 8)) + 'px';
});

/* Dateien aus dem Rechner auf „Anhänge“ ziehen */
document.addEventListener('dragover', e => {
  if (zug == null && e.target.closest && e.target.closest('#anhaenge') && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
    e.preventDefault();
    e.target.closest('#anhaenge').classList.add('ziel');
  }
});
document.addEventListener('drop', e => {
  const ziel = zug == null && e.target.closest && e.target.closest('#anhaenge');
  if (ziel && e.dataTransfer.files.length) { e.preventDefault(); anhaengeHochladen([...e.dataTransfer.files]); }
});
document.addEventListener('dragover', e => {
  if (zug == null) return;
  const bahn = e.target.closest('.bahn[data-col]');
  if (!bahn) return;
  e.preventDefault();
  einfuegeMarkenWeg();
  const k = e.target.closest('.ka[data-id]'), spalte = bahn.dataset.col;
  const bewegte = zugMenge || [zug];
  const andere = [...bahn.querySelectorAll('.ka[data-id]')].filter(x => !bewegte.includes(+x.dataset.id));
  if (k && !bewegte.includes(+k.dataset.id)) {
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
  const nummer = zug, z = ziel, menge = zugMenge;
  zug = null; ziel = null; zugMenge = null;
  if (S.ui.nachZug) render();
  einfuegeMarkenWeg();
  if (z && menge) mehrereBewegen(menge, z.spalte, z.index);
  else if (z) act('bewegen', JSON.stringify({ nummer, ...z }));
});
document.addEventListener('dragend', () => {
  zug = null; ziel = null; zugMenge = null; einfuegeMarkenWeg();
  document.querySelectorAll('.zieht').forEach(x => x.classList.remove('zieht'));
  if (S.ui.nachZug) render();
});

/* Live: jede Änderung im Ordner lädt neu; Änderungen von außen markieren die betroffenen Karten 10 s. */
function spaltenJeAufgabe() {
  const m = {};
  if (S.board) S.board.spalten.forEach(sp => sp.aufgaben.forEach(n => { m[n] = sp.name; }));
  return m;
}

async function ereignis(e) {
  if (schlangeOffen > 0) return; // eigene Anfragen laufen noch; danach wird ohnehin neu geladen
  const vorher = spaltenJeAufgabe();
  const neu = await laden({ nurBeiAenderung: true });
  if (!e.extern || neu === false) return;
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
  q.onerror = () => { delete document.documentElement.dataset.live; if (S.live) { S.live = false; render(); } };
  q.onopen = () => {
    document.documentElement.dataset.live = 'verbunden'; // Prüfpunkt: ab jetzt kommt jede Änderung an
    if (!S.live) {
      S.live = true;
      laden().then(() => { S.ui.hinweis = { text: 'Wieder verbunden · Stand nachgeladen', at: Date.now() }; render(); }).catch(() => { });
    }
  };
  S.ereignisquelle = q;
}

setInterval(() => {
  const jetzt = Date.now();
  let neu = false;
  for (const [n, x] of Object.entries(S.extern)) if (jetzt - x.at >= 10000) { delete S.extern[n]; neu = true; }
  if (S.ui.hinweis && jetzt - S.ui.hinweis.at > (S.ui.hinweis.dauer || 8000)) { S.ui.hinweis = null; neu = true; }
  document.querySelectorAll('[data-since]').forEach(el => { const d = jetzt - +el.dataset.since; el.textContent = el.dataset.fmt === 's' ? hms(d) : hm(d); });
  document.querySelectorAll('[data-ext]').forEach(el => { el.textContent = `extern · ${el.dataset.datei} · vor ${Math.round((jetzt - +el.dataset.ext) / 1000)} Sek`; });
  if (neu && zug == null && !S.ui.neu) render();
}, 1000);

liveVerbinden();
laden().catch(f => { S.ui.fehler = f.message; render(); });
