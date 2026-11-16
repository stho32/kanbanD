/* kanbanD — Zustand, Laden, Handlungen, Ereignisse. Der Ordner ist die Wahrheit; die Seite fragt nach. */
const S = { zustand: null, board: null, aufgaben: [], herkunft: {}, ich: null, extern: {}, live: true, ui: { slug: null, first: null, fehler: null, pop: null, filter: '', bereich: 'alle', auswahl: [], anker: null, vergessen: new Set(), vergessenOffen: false, erinnert: new Set(), tooltip: null, fensterMenue: null, laufend: new Set() } };
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
/* Berichtsfilter (R00081): steht am Board (`report-filter:`), für alle. Eine Änderung wirkt sofort und wird mit gewählter
   Person gespeichert; bis die Antwort da ist — oder ohne Person ganz — gilt der lokale Stand (`bfLokal`). */
S.ui.bf = filterAus('');
S.ui.signaleOben = (() => { try { return localStorage.getItem('kanbanD.signale-oben') === '1'; } catch (_) { return false; } })();
/** Bei „Signale oben“ ist die Anzeige nicht die echte Reihenfolge — ein Zug daraus wäre ein Zug an die falsche Stelle (R00088). */
function zugGesperrt() {
  if (!S.ui.signaleOben) return false;
  S.ui.hinweis = { text: 'Bei „Signale oben“ nicht umsortierbar — zum Verschieben das Kontextmenü nutzen oder den Schalter ausschalten', at: Date.now() };
  render();
  return true;
}
S.ui.bfOffen = (() => { try { return localStorage.getItem('kanbanD.berichtsfilter-offen') === '1'; } catch (_) { return false; } })();
function berichtsfilterSetzen(aenderung) {
  S.ui.bf = { ...S.ui.bf, ...aenderung };
  const ich = S.ich && personen().some(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv);
  const lokal = S.ui.bfLokal = { slug: S.ui.slug, filter: S.ui.bf, ungespeichert: !ich };
  if (!ich || !S.ui.slug) return;
  return durchDieSchlange(() => api('PUT', `/api/boards/${encodeURIComponent(S.ui.slug)}/berichtsfilter`, S.ui.bf)
    .then(() => { if (S.ui.bfLokal === lokal) S.ui.bfLokal = null; }, f => { S.ui.fehler = 'Berichtsfilter nicht gespeichert: ' + f.message; lokal.ungespeichert = true; }));
}
/** Neue Achsen für „Bestand nach Labels“ nach einer Wahl (Feld „zeilen“, „spalten“ oder „tauschen“): genau ein PUT …/bestand;
    ohne gewählte Person oder bei einem Fehler gilt die Wahl nur in dieser Ansicht. Ändert die Wahl nichts oder gibt es
    unter zwei Präfixen noch keine Achsen, nichts. */
function bestandAchsenSetzen(feld, praefix) {
  const jetzt = bestandAchsen(filterOhneZeitraum(S.ui.bf));
  if (!jetzt) return;
  const neu = achsenNachWahl(jetzt, feld, praefix);
  if (!neu) return;
  const ich = !!ichPerson();
  const lokal = S.ui.bestandLokal = { slug: S.ui.slug, achsen: neu, ungespeichert: !ich, fehler: null };
  render();
  if (!ich || !S.ui.slug) return;
  return durchDieSchlange(() => api('PUT', `/api/boards/${encodeURIComponent(S.ui.slug)}/bestand`, neu)
    .then(() => { if (S.ui.bestandLokal === lokal) S.ui.bestandLokal = null; }, f => { lokal.fehler = f.message; }));
}
/** Der Filter des gewählten Boards — oder der lokale, solange er nicht gespeichert ist. */
function berichtsfilterAusBoard() {
  if (S.ui.bfLokal && S.ui.bfLokal.slug === S.ui.slug) return S.ui.bfLokal.filter;
  S.ui.bfLokal = null;
  return filterAus(JSON.stringify((S.board && S.board.berichtsfilter) || {}));
}
document.addEventListener('toggle', e => {
  if (!e.target.classList || !e.target.classList.contains('bfilter-box')) return;
  S.ui.bfOffen = e.target.open;
  try { localStorage.setItem('kanbanD.berichtsfilter-offen', S.ui.bfOffen ? '1' : '0'); } catch (_) { }
}, true);
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

/** Der deutsche Satz für einen abgebrochenen Netzweg (Karte #127): `fetch` wirft dann einen TypeError mit englischem Text
    („Failed to fetch“), angezeigt wird aber überall `f.message`. */
const NETZ_FEHLER = 'Keine Verbindung zum Server — nichts geändert.';

async function api(methode, pfad, daten) {
  const headers = {};
  if (daten) headers['Content-Type'] = 'application/json';
  if (S.ich) headers['X-KanbanD-Wer'] = S.ich;
  let r;
  try {
    r = await fetch(pfad, { method: methode, headers, body: daten ? JSON.stringify(daten) : undefined });
  } catch (_) {
    throw Object.assign(new Error(NETZ_FEHLER), { status: 0, daten: null });
  }
  const text = await r.text();
  const json = text ? JSON.parse(text) : null;
  if (!r.ok) throw Object.assign(new Error(json && json.fehler || r.statusText), { status: r.status, daten: json });
  return json;
}

function ansichtAusAdresse() {
  if (/^#\/wbs\//.test(location.hash)) return 'wbs';
  const m = /^#\/(einrichten|aufgaben|personen|berichte\/stundenzettel|berichte\/kreuz|berichte\/verlauf|berichte\/fluss|berichte\/durchsatz|berichte\/durchlauf|berichte\/prognose|berichte\/fieber|berichte\/kosten|berichte\/bestand)/.exec(location.hash);
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
/** Zugeklappte Spalten des Boards (R00074): je Betrachter und Board im Browser-Speicher, keine Datei ändert sich. */
function spaltenZu() {
  const slug = S.ui.slug || '';
  if (!S.ui.spaltenZu || S.ui.spaltenZu.slug !== slug) {
    let zu = [];
    try { zu = JSON.parse(localStorage.getItem('kanbanD.spalten-zu.' + slug) || '[]'); } catch (_) { }
    S.ui.spaltenZu = { slug, zu: Array.isArray(zu) ? zu : [] };
  }
  return S.ui.spaltenZu.zu;
}
function spalteKlappen(name, zu) {
  const liste = spaltenZu().filter(n => n !== name);
  if (zu) liste.push(name);
  S.ui.spaltenZu.zu = liste;
  try { localStorage.setItem('kanbanD.spalten-zu.' + S.ui.spaltenZu.slug, JSON.stringify(liste)); } catch (_) { }
}
/** Am Gerät gemerkte Wahl von/bis der Durchlaufzeit (R00169, ADR-0027 N5 Punkt 3): je Betrachter und Board im Browser-Speicher,
    nur was von der Vorgabe des Boards abweicht (`durchlaufMerken`) — keine Datei ändert sich. */
function durchlaufGemerkt() {
  const slug = S.ui.slug || '';
  if (!S.ui.dlGemerkt || S.ui.dlGemerkt.slug !== slug) {
    let wahl = null;
    try { wahl = JSON.parse(localStorage.getItem('kanbanD.durchlaufzeit.' + slug) || '{}'); } catch (_) { }
    if (!wahl || typeof wahl !== 'object') wahl = {};
    S.ui.dlGemerkt = { slug, wahl };
  }
  return S.ui.dlGemerkt.wahl;
}
/** Merkt die Wahl des Boards am Gerät; eine leere Wahl löscht den Eintrag — der Bericht folgt wieder dem Board. */
function durchlaufAmGeraetMerken(wahl) {
  durchlaufGemerkt();
  S.ui.dlGemerkt.wahl = wahl;
  const schluessel = 'kanbanD.durchlaufzeit.' + S.ui.dlGemerkt.slug;
  try {
    if (Object.keys(wahl).length) localStorage.setItem(schluessel, JSON.stringify(wahl));
    else localStorage.removeItem(schluessel);
  } catch (_) { }
}
/** Stellt „von“ (`dlVon`) oder „bis“ (`dlBis`) der Durchlaufzeit auf `spalte`; gemerkt wird, was danach von der Vorgabe abweicht. */
function durchlaufWaehlen(feld, spalte) {
  const wahl = durchlaufWahl(S.bew, erledigtHeisst().gewaehlt, durchlaufGemerkt());
  let von = wahl.von, bis = wahl.bis;
  if (feld === 'dlVon') von = spalte;
  if (feld === 'dlBis') bis = spalte;
  durchlaufAmGeraetMerken(durchlaufMerken(wahl.vorgabe, von, bis));
}
/** Anwendungen, an die das aktuelle Board gebunden ist (R00053, R00054). */
const gebunden = () => gebundeneAnwendungen(S.board, (S.zustand && S.zustand.einstellungen && S.zustand.einstellungen.quellen.anwendungen) || []);

/** Die verborgene Überschrift erster Ebene vor jeder Sicht (R00113, ADR-0018 Regel 2): keine Sicht schreibt selbst eine h1. */
function vSeitenUeberschrift() {
  const seite = { ansicht: S.ui.view, ersterStart: Boolean(S.ui.first), boardTitel: boardTitelDerSeite(), anwendung: anwendungDerSeite() };
  return `<h1 class="vh">${esc(seitenUeberschrift(seite))}</h1>`;
}
function boardTitelDerSeite() {
  if (S.boardDefekt || !S.board) return '';
  return S.board.titel;
}
function anwendungDerSeite() {
  const anwendung = gebunden().find(a => a.kuerzel === wbsKuerzel());
  if (!anwendung) return '';
  return anwendung.name;
}
const vMain = () => vSeitenUeberschrift() + vHaupt();

function vHaupt() {
  if (S.ui.first) return vFirst();
  if (S.ui.setup) return vSetup();
  if (S.ui.view === 'einrichten' && S.ui.einr) return vEinrichten();
  if (S.ui.view === 'aufgaben') return vAufgaben();
  if (S.ui.view === 'personen') return vPersonen();
  if (S.ui.view === 'berichte/stundenzettel') return vStundenzettel();
  if (S.ui.view === 'berichte/kreuz') return vKreuz();
  if (S.ui.view === 'berichte/verlauf') return vVerlauf();
  if (S.ui.view === 'berichte/fluss') return vFluss();
  if (S.ui.view === 'berichte/durchsatz') return vDurchsatz();
  if (S.ui.view === 'berichte/durchlauf') return vDurchlauf();
  if (S.ui.view === 'berichte/prognose') return vPrognose();
  if (S.ui.view === 'berichte/fieber') return vFieber();
  if (S.ui.view === 'berichte/kosten') return vKosten();
  if (S.ui.view === 'berichte/bestand') return vBestand();
  if (S.ui.view === 'wbs') return vWbs();
  return vBoard();
}

const kopie = x => JSON.parse(JSON.stringify(x));

function gewaehltesBoard(zustand) {
  const m = /^#\/board\/([^/]+)/.exec(location.hash);
  const slugs = [...zustand.boards.map(b => b.slug), ...defekteBoards(zustand)];
  let zuletzt = null;
  try { zuletzt = localStorage.getItem('kanbanD.board'); } catch (_) { }
  if (!m && zuletzt && slugs.includes(zuletzt)) return zuletzt;
  return m && slugs.includes(m[1]) ? m[1] : slugs[0] || null;
}

/** Was der Server zuletzt geliefert hat, und wohin die Adresse zeigt. Ein Ereignis, nach dem das gleich bleibt — das Echo
    eines eigenen Schreibzugriffs, auch der Phasen-Spalten, die das erste Lesen nachträgt —, zeichnet nicht neu: sonst ersetzt
    es die Seite, während jemand klickt oder liest (R00061). */
let geladenerStand = null;
/** Der Grund, den `/api/zustand` unter `defekte` für die Board-Datei nennt — sonst leer. */
const defekterGrund = (slug, zustand) => ((zustand.defekte || []).find(d => d.pfad === 'boards/' + slug + '.md') || {}).fehler;
const serverStand = () => JSON.stringify([location.hash, S.zustand, S.board, S.boardDefekt, S.aufgaben, S.herkunft, S.boards, S.bew, S.fieberCache, S.anwendungen, S.wbs, S.wbsFehler, S.pruefWbs, S.ui.datei, S.ui.anhaenge, S.ui.defektDatei]);

/** Nur die neueste Antwort wird übernommen (R00110, ADR-0014): jedes Laden zieht beim Start eine Nummer aus dem Takt; übernommen
    wird nur, was neuer ist als das zuletzt übernommene desselben Ziels — Hauptstand oder Fenster — und als die Marke der Schlange. */
let takt = 0, zuletztStand = 0, zuletztFenster = 0, marke = 0;
const naechsterTakt = () => ++takt;
/** Pfade und Spalten von Ereignissen „extern“, deren Laden verworfen wurde — das nächste übernommene Laden markiert sie. */
const externVerworfen = [];

/** Lädt den Stand vom Server und zeichnet; `nurBeiAenderung` (Live-Ereignis) zeichnet nur, wenn sich etwas geändert hat.
    Ist inzwischen ein neueres Laden übernommen oder wartet eine eigene Änderung, wird nichts übernommen, nichts gezeichnet,
    `wennVerworfen(ueberholt)` gerufen — `ueberholt`, wenn ein neueres Laden schon übernommen ist — und `false` zurückgegeben
    (R00110). Als Objekt, weil `laden` auch Ereignis-Handler ist (`hashchange` übergibt sein Ereignis). */
async function laden({ nurBeiAenderung = false, wennVerworfen = () => { } } = {}) {
  const start = naechsterTakt();
  const zustand = await api('GET', '/api/zustand');
  const einstellungenDefekt = zustand.eingerichtet && !zustand.einstellungen;
  if (einstellungenDefekt) zustand.einstellungen = { personen: [], klassen: [], quellen: { wbs: '', anforderungen: '', anwendungen: [] } };
  const sicht = zustand.eingerichtet ? await sichtLaden(zustand) : null;
  if (!uebernehmen({ start, zuletzt: zuletztStand, marke, schlangeOffen: schlangeOffen() })) {
    wennVerworfen(zuletztStand > start);
    return false;
  }
  zuletztStand = start;
  fieberGesendet.clear();
  // Alles auf einmal übernehmen: eine Aktion oder ein Zeichnen während des Ladens sieht nie einen halben Stand —
  // vorher war S.wbs für die Dauer der Anfrage null, und ein Klick auf Zuklappen ging verloren (R00061).
  const neu = { zustand, einstellungenDefekt };
  if (sicht) Object.assign(neu, sicht.haupt);
  Object.assign(S, neu);
  if (sicht) await sichtFolgen(sicht, start);
  else S.ui.first = S.ui.first || { kuerzel: '', name: '', agenten: { cl: true }, board: 'Entwicklung', spalten: 'Zu erledigen, In Arbeit, Erledigt', wbs: '', anf: '' };
  const nachgetragen = externNachtragen();
  const stand = serverStand();
  if (nurBeiAenderung && stand === geladenerStand && !nachgetragen) return false;
  geladenerStand = stand;
  render();
  // `#/wbs/<kürzel>/<id>` zeigt die Zeile einmal — spätere Ereignisse laden neu, ohne erneut zu springen
  const ziel = S.ui.view === 'wbs' && S.wbs && wbsZiel(location.hash);
  if (ziel && S.ui.wbsGesprungen !== location.hash) { S.ui.wbsGesprungen = location.hash; await act('wbs-gehe', ziel); }
  else if (!ziel) S.ui.wbsGesprungen = null;
  fieberNachtragen();
}

/** Alles, was ein Laden für die Ansicht der Adresse liest — nur lokal gesammelt, übernommen erst über `sichtUebernehmen`. */
async function sichtLaden(zustand) {
  const view = ansichtAusAdresse();
  const slug = gewaehltesBoard(zustand);
  let fbFehler = null;
  // Das Board zuerst: sein Lesen kann Phasen-Spalten nachtragen (ein Commit) — was danach gelesen wird, zeigt schon diesen
  // Stand, sodass das Echo des Commits nichts Neues bringt und nicht neu zeichnet (R00061).
  let boardDefekt = null;
  // 423: Board-Datei defekt (R00025); 400: Dateiname nicht in Board-Form (R00104) — beide als Defektfläche, der Grund aus `defekte`
  const board = slug ? await api('GET', '/api/boards/' + encodeURIComponent(slug) + '?archivierte=ja').catch(f => { if (f.status !== 423 && f.status !== 400) throw f; boardDefekt = { slug, fehler: defekterGrund(slug, zustand) || f.message }; return null; }) : null;
  // Board-Berichte rechnen im Browser aus den Spaltenwechseln (R00042); die Board-Ansicht braucht sie für die Datums-Trenner (R00124).
  // Sie laufen in derselben Sammelabfrage wie die übrigen — ein einziger Aufbau, kein zusätzliches Zeichnen. Ein defektes
  // Board (423) wird gar nicht erst gefragt; in der Board-Ansicht ist ein Fehler kein Grund, die Seite nicht zu zeichnen.
  const bewegungenPfad = '/api/berichte/bewegungen?board=' + encodeURIComponent(slug || '');
  const bewegungenNoetig = Boolean(slug) && (view === 'board' ? !boardDefekt : /^berichte\/(verlauf|fluss|durchsatz|durchlauf|prognose|fieber)$/.test(view));
  const [aufgaben, herkunft, boards, bew] = await Promise.all([
    api('GET', '/api/aufgaben'),
    api('GET', '/api/herkunft'),
    // die Oberfläche zeigt das Archiv selbst und braucht deshalb die archivierten Karten in den Spalten (R00092)
    api('GET', '/api/boards?archivierte=ja'),
    bewegungenNoetig ? (view === 'board' ? api('GET', bewegungenPfad).catch(() => null) : api('GET', bewegungenPfad)) : Promise.resolve(null),
  ]);
  // Fever Chart (R00078): der Cache der gerechneten Tage
  const fieberCache = view === 'berichte/fieber' && slug ? await api('GET', `/api/boards/${encodeURIComponent(slug)}/fieber/cache`).catch(f => { if (f.status !== 423) throw f; fbFehler = f.message; return { abschnitte: [] }; }) : null;
  // Erreichbarkeit der registrierten Anwendungen zeigt nur die Einstellungsseite (R00053)
  const anwendungen = view === 'einrichten' ? await api('GET', '/api/anwendungen') : S.anwendungen;
  let wbs = null, wbsFehler = null;
  if (view === 'wbs' && wbsKuerzel()) wbs = await api('GET', '/api/wbs/' + encodeURIComponent(wbsKuerzel())).catch(f => { wbsFehler = f.message; return null; });
  // Ausrufezeichen der Prüfungen (R00059): die WBS jeder Anwendung, auf die Karten des Boards wirken — live nach jedem Ereignis
  const pruefWbs = {};
  // dazu die WBS der Anwendungen, deren Wirkungen der Punkt am Chip zeigt (R00071)
  if (view === 'board') await Promise.all([...new Set([...pruefWbsAnwendungen(board, aufgaben.aufgaben), ...wirkungsAnwendungen(board, aufgaben.aufgaben)])].map(k => api('GET', '/api/wbs/' + encodeURIComponent(k)).then(w => { pruefWbs[k] = w; }, () => { pruefWbs[k] = null; })));
  return { view, slug, fbFehler, haupt: { boardDefekt, board, aufgaben: aufgaben.aufgaben, herkunft, boards, bew, fieberCache, anwendungen, wbs, wbsFehler, pruefWbs } };
}

/** Nach der Übernahme: die gelesene Sicht samt ihrer Folgen für Vollbild, Einrichten und gemerktes Board, dann das offene Fenster. */
async function sichtFolgen({ view, slug, fbFehler }, start) {
  S.ui.first = null;
  const vorher = S.ui.view;
  S.ui.view = view;
  if (view !== vorher && S.ui.vollbild) vollbildSetzen(false);
  if (view !== 'einrichten') S.ui.einr = null;
  else if (!S.ui.einr) S.ui.einr = kopie(S.zustand.einstellungen);
  S.ui.slug = slug;
  try { if (slug) localStorage.setItem('kanbanD.board', slug); } catch (_) { }
  if (fbFehler) S.ui.fbFehler = fbFehler;
  S.ui.bf = berichtsfilterAusBoard();
  if (S.ui.offen) await dateiLaden(start);
  if (S.ui.offenDefekt) await defektLaden(start);
}

/** Fever Chart (R00078): rechnet die Tage vom Start bis gestern, die im Cache fehlen, in Häppchen (die Seite bleibt bedienbar)
    und gibt sie dem Server; der committet sie als „kanbanD“. Läuft je Schlüssel einmal; wechselt Ansicht oder Filter, bricht es ab.
    Die erste Meldung erscheint schon beim ersten fehlenden Tag (R00134), damit auch „von 1 Tag“ sichtbar ist. */
async function fieberNachtragen() {
  const st = S.ui.view === 'berichte/fieber' && fieberStand();
  if (!st || !st.start || (S.ui.fieberLauf && S.ui.fieberLauf.schluessel === st.schluessel)) return;
  if (!S.ui.fieberNeu || S.ui.fieberNeu.schluessel !== st.schluessel) S.ui.fieberNeu = { schluessel: st.schluessel, tage: {} };
  const neu = S.ui.fieberNeu, imCache = new Set(st.cache.map(t => t.datum));
  const fehlt = fehlendeTage(st.start, [...imCache, ...Object.keys(neu.tage)], Date.now());
  const lauf = S.ui.fieberLauf = { schluessel: st.schluessel, n: 0, von: fehlt.length };
  const weiter = () => { const jetzt = S.ui.fieberLauf === lauf && S.ui.view === 'berichte/fieber' && fieberStand(); return !!jetzt && jetzt.schluessel === st.schluessel; };
  for (const [i, datum] of fehlt.entries()) {
    neu.tage[datum] = fieberTag(S.bew, S.ui.bf, aufgabe, datum, S.bew.phasen, st.start, st.block && st.block.schluessel);
    if (i === 0 || i % 4 === 3) {
      lauf.n = i + 1;
      const el = $('#fieber-lauf');
      if (el && el.firstChild) el.firstChild.textContent = `rechnet ${lauf.n} von ${lauf.von} ${zaehlwort(lauf.von, 'Tag', 'Tagen')} … `;
      await new Promise(r => setTimeout(r, 0));
      if (!weiter()) { if (S.ui.fieberLauf === lauf) S.ui.fieberLauf = null; return; }
    }
  }
  const senden = Object.values(neu.tage).filter(t => !imCache.has(t.datum) && t.datum < isoD(Date.now()));
  if (senden.length) {
    try { await durchDieSchlange(() => api('POST', `/api/boards/${encodeURIComponent(S.ui.slug)}/fieber/cache`, { schluessel: st.schluessel, tage: senden })); }
    catch (f) { S.ui.fbFehler = 'Cache nicht gespeichert: ' + f.message; }
  }
  if (S.ui.fieberLauf !== lauf) return;
  S.ui.fieberLauf = null;
  if (senden.length) {
    // der Cache steht jetzt auf dem Server: neu lesen; zeichnet auch dann, wenn das Live-Ereignis schneller war
    S.fieberCache = await api('GET', `/api/boards/${encodeURIComponent(S.ui.slug)}/fieber/cache`).catch(() => S.fieberCache);
  }
  render();
}

/** Zuletzt erfolgreich gesendete Einstellungen des Fever Charts je Board; sie gelten, bis ein Laden übernommen wird. */
const fieberGesendet = new Map();

/** Einstellungen des Fever Charts ändern; ein Fehler steht am Formular. `aendern(stand)` liefert das ganze Objekt und läuft
    erst im Glied der Schlange (ADR-0025 Regel 7): `S.board` erneuert sich erst nach dem letzten Glied, deshalb ist der Stand
    das zuletzt Gesendete dieses Boards — sonst schriebe eine zweite schnelle Änderung die erste zurück (R00170). */
async function fieberEinstellen(aendern) {
  const board = S.board;
  S.ui.fbFehler = null;
  try {
    await durchDieSchlange(async () => {
      const einstellungen = aendern(fieberGesendet.get(board.slug) || board.fieber);
      await api('PUT', `/api/boards/${encodeURIComponent(board.slug)}/fieber`, einstellungen);
      fieberGesendet.set(board.slug, einstellungen);
    });
  } catch (x) { S.ui.fbFehler = x.message; }
  return laden();
}

/** Schreibende Aktionen brauchen eine Identität; fehlt sie, öffnet sich „Ich bin …“ mit Hinweis. */
function ichNoetig() {
  if (S.ich && personen().some(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv)) return false;
  S.ui.pop = 'ich'; S.ui.ichNoetig = true;
  return true;
}

/** Lädt die defekte Datei des Fensters; übernommen nur, solange das Fenster dieselbe Aufgabe zeigt — defekt oder schon repariert —
    und keine neuere Antwort des Fensters übernommen wurde (R00110, ADR-0014 Regel 6). Innerhalb von `laden` unter dessen Nummer
    `start`. „Repariert“ rückt `zuletztFenster` schon beim Umschalten vor — eine ältere Antwort „defekt“, die währenddessen ankommt,
    schaltet nicht zurück (Nacharbeit 2) —, und das folgende `dateiLaden` übernimmt unter derselben Nummer (`gleicherTakt`). */
async function defektLaden(start = naechsterTakt()) {
  const nummer = S.ui.offenDefekt;
  const aktuell = () => (S.ui.offenDefekt === nummer || S.ui.offen === nummer) && uebernehmen({ start, zuletzt: zuletztFenster, marke, schlangeOffen: schlangeOffen() });
  try {
    await api('GET', '/api/aufgaben/' + nummer);
    if (!aktuell()) return;
    zuletztFenster = start;
    S.ui.offen = nummer; S.ui.offenDefekt = null; S.ui.defektDatei = null; // repariert
    await dateiLaden(start, { gleicherTakt: true });
  } catch (f) {
    if (!aktuell()) return;
    zuletztFenster = start;
    S.ui.offen = null; S.ui.datei = null;
    if (f.status === 423) { S.ui.offenDefekt = nummer; S.ui.defektDatei = { pfad: f.daten.pfad, text: f.daten.text, fehler: f.message }; }
    else { S.ui.offenDefekt = null; S.ui.defektDatei = null; }
  }
}

/** Lädt Datei, Anhänge und WBS-Eintritt des Fensters; übernommen nur, solange dieselbe Aufgabe offen ist und keine neuere Antwort
    des Fensters übernommen wurde (R00110, ADR-0014 Regel 6). Innerhalb von `laden` unter dessen Nummer `start`. `gleicherTakt`: das
    Umschalten aus der Reparatur hat das Fenster unter derselben Nummer schon übernommen — sie gilt dann als nicht überholt. */
async function dateiLaden(start = naechsterTakt(), { gleicherTakt = false } = {}) {
  const nummer = S.ui.offen;
  const aktuell = () => S.ui.offen === nummer && uebernehmen({ start, zuletzt: gleicherTakt ? zuletztFenster - 1 : zuletztFenster, marke, schlangeOffen: schlangeOffen() });
  try {
    const datei = await api('GET', '/api/aufgaben/' + nummer);
    const anhaenge = await api('GET', `/api/aufgaben/${nummer}/anhaenge`);
    const eintritt = await api('GET', `/api/aufgaben/${nummer}/wbs-effects`).catch(() => []);
    // Der Reiter „Verlauf“ (R00123) rechnet bei jeder Änderung neu; ein Fehler trifft nur den Reiter, nicht die Datei
    let verlauf = null, verlaufFehler = null;
    if (S.ui.tab === 'verlauf') {
      try { verlauf = await api('GET', `/api/aufgaben/${nummer}/verlauf`); }
      catch (g) { verlaufFehler = g.message; }
    }
    if (!aktuell()) return;
    zuletztFenster = start;
    S.ui.datei = datei; S.ui.anhaenge = anhaenge; S.ui.eintritt = eintritt;
    S.ui.verlauf = verlauf; S.ui.verlaufFehler = verlaufFehler;
  } catch (f) {
    if (!aktuell()) return;
    zuletztFenster = start;
    if (f.status === 404) S.ui.offen = null;
    S.ui.datei = null; S.ui.anhaenge = []; S.ui.eintritt = [];
    S.ui.verlauf = null; S.ui.verlaufFehler = null;
  }
}

/** Inhalt eines Anhangs als Blob; wirft mit dem Grund des Servers. */
async function anhangLesen(pfad) {
  let r;
  try { r = await fetch(pfad); } catch (_) { throw new Error(NETZ_FEHLER); }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).fehler || r.statusText);
  return r.blob();
}

async function anhaengeHochladen(dateien) {
  if (ichNoetig()) { render(); return; }
  for (const d of dateien) {
    try { await anhangSenden(S.ui.offen, d, d.name); } catch (f) { fensterMelden(f.message); break; }
    S.ui.gespeichert = Date.now();
  }
  render();
}

/** Lädt `datei` als Multipart unter `name` an Aufgabe `nummer` hoch; liefert den Anhang des Servers, wirft mit seinem Grund. */
/** Ein Anhang geht als Multipart hoch — der eine Netzaufruf für Dateien, durch dieselbe Stelle wie jeder andere Schreibweg. */
function anhangSenden(nummer, datei, name) {
  return durchDieSchlange(async () => {
    const form = new FormData();
    form.append('datei', datei, name);
    let r;
    try { r = await fetch(`/api/aufgaben/${nummer}/anhaenge`, { method: 'POST', headers: { 'X-KanbanD-Wer': S.ich }, body: form }); } catch (_) { throw new Error(NETZ_FEHLER); }
    const antwort = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(antwort.fehler || r.statusText);
    return antwort;
  });
}

/** Termine des Boards ersetzen; bei Erfolg das Formular leeren (R00047). */
async function termineSchreiben(liste, formularLeeren) {
  const u = S.ui;
  try {
    await durchDieSchlange(() => api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/termine`, liste));
    u.tfFehler = null;
    if (formularLeeren) u.tf = { ...TERMIN_LEER };
  } catch (f) { u.tfFehler = f.message; }
  render();
}

/** Anfragen strikt nacheinander; ist die Schlange leer, wird einmal neu geladen. Vor diesem Laden setzt sie die Marke: was davor
    gestartet ist, las womöglich einen Stand ohne die eigenen Änderungen und wird verworfen (R00110, ADR-0014 Regel 3).
    Das Kettenende endet in jedem Fall erfüllt und meldet je Fehlschlag einmal am Auslöser (R00147, ADR-0025 Regel 3). */
const eigene = warteschlangeFuehren({
  laden: () => laden(),
  vorLaden: () => { marke = takt; },
  gespeichert: () => { S.ui.gespeichert = Date.now(); },
  melden: schlangeMelden,
});
/** Wie viele eigene Anfragen gerade laufen; solange welche warten, wird kein geladener Stand übernommen (R00110). */
const schlangeOffen = () => eigene.offen();
/** Der Auslöser, dessen Aktion gerade läuft — der Schreibweg ordnet seine Anfrage ihm zu (ADR-0025 Regel 6). */
let laufenderAusloeser = null;

function warteschlange(anfrage) {
  const laufender = laufenderAusloeser;
  if (laufender) laufender.anfrage = laufender.schreibt = true;
  return eigene.einreihen(anfrage, S.ui.offen ? 'fenster' : 'board', () => sperreFreigeben(laufender));
}

/** Eine Aktion ohne Anfrage, die einen Entwurf ändert (eine Zeile einer Liste, die erst später geschrieben wird), hat
    Schreibwirkung wie eine Anfrage: der zweite Klick ihrer Geste träfe die nachgerückte Zeile (R00148 AK 11, ADR-0025 N2). */
function entwurfGeaendert() {
  if (laufenderAusloeser) laufenderAusloeser.schreibt = true;
}

/** Gibt die Sperre eines Auslösers frei, sobald seine Anfrage beantwortet ist — auch bei einem Fehlschlag (ADR-0025 Regel 2). */
function sperreFreigeben(laufender) {
  if (!laufender) return;
  laufender.namen.forEach(sperre.beenden);
  sperrenMarkieren();
}

/** Jede schreibende Anfrage läuft durch die eine Stelle (ADR-0025 Regel 6, R00148 AK 17): die Warteschlange hält
    Reihenfolge und Kettenende, damit zwei Schreib-Auslöser nie überlappen. Die Ablehnung geht an den Aufrufer weiter,
    damit seine Meldung die einzige bleibt (R00147) — die Schlange meldet diesen Fehlschlag dann nicht. */
function durchDieSchlange(anfrage) {
  let ergebnis = null, fehler = null;
  return warteschlange(() => Promise.resolve(anfrage()).then(r => { ergebnis = r; }, f => { fehler = f; })).then(() => {
    if (fehler) throw fehler;
    return ergebnis;
  });
}

/** Ein Eintrag aus Titel und den Feldern des Dialogs; Kürzel im Titel ergänzen die Felder. */
function neuEintrag(titel, f) {
  const s = schnelleingabe(titel, schnellUmfeld(), new Date());
  const vereint = (a, b) => [...new Set([...a, ...b])];
  const labels = f.labels.split(',').map(x => x.trim()).filter(Boolean);
  const herkunft = herkunftAusFeld(f.herkunft, s.herkunft);
  // @kürzel ersetzt die Vorbelegung (mich), solange niemand die Zuständigen von Hand gewählt hat (R00028)
  const zust = s.zustaendige.length ? (f.zustGewaehlt ? vereint(f.zust, s.zustaendige) : s.zustaendige) : f.zust;
  const e = { titel: s.titel || titel.trim(), zustaendige: zust, labels: vereint(labels, s.labels), herkunft: vereint(herkunft, s.herkunft) };
  if (s.klasse || f.klasse) e.klasse = s.klasse || f.klasse;
  if (s.faellig || f.faellig) e.faellig = s.faellig || f.faellig;
  return e;
}
/** Ein Schlüssel je geöffnetem Fenster „Neue Aufgabe" (R00148 AK 18, ADR-0025 Regel 5): derselbe Formularstand schickt
    ihn bei jedem Anlegen mit, sodass ein wiederholter Aufruf keine zweite Karte erzeugt (R00098). */
function anlegeSchluessel() {
  return `${FENSTER_SCHLUESSEL}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Kennung einer Entwurfszeile im Fenster „Neue Aufgabe" (R00148 AK 11, ADR-0025 Nachtrag N2): im Zustand vergeben,
    keine Stelle — nach dem Entfernen rücken die Zeilen nach, und die Stelle träfe dann die falsche (Mutant M5). */
let entwurfsNummer = 0;
function entwurfsKennung() {
  entwurfsNummer++;
  return `entwurf-${entwurfsNummer}`;
}

async function neueAufgabeAnlegen(weitere, zeilen) {
  const u = S.ui, f = u.neu;
  if (!f || ichNoetig()) { render(); return; }
  const titel = $('#neu-titel') ? $('#neu-titel').value : f.titel;
  const liste = zeilen || [titel];
  if (!liste.some(t => t.trim())) { f.fehler = 'Die Aufgabe braucht einen Titel'; f.fehlerFeld = 'titel'; u.fokus = '#neu-titel'; render(); return; }
  f.fehlerFeld = null;
  const ziel = f.board ? { board: f.board, spalte: f.spalte } : {};
  return durchDieSchlange(async () => {
    try {
      let neu;
      if (liste.length === 1) {
        neu = [await api('POST', '/api/aufgaben', { ...neuEintrag(liste[0], f), key: f.schluessel, beschreibung: f.beschreibung, teilaufgaben: f.teil.map(t => t.text), ...ziel })];
      } else {
        neu = await api('POST', '/api/aufgaben/mehrere', { titel: liste.map((t, i) => ({ ...neuEintrag(t, f), key: `${f.schluessel}-${i}` })), ...ziel });
      }
      u.hinweis = { text: neu.length === 1 ? `#${neu[0].nummer} angelegt` : `${neu.length} Aufgaben angelegt`, undo: { art: 'archivieren', nummern: neu.map(a => a.nummer) }, at: Date.now() };
      // „Anlegen und weitere“ leert das Formular: die nächste Füllung ist eine neue Aufgabe und bekommt einen neuen Schlüssel
      // (R00148 AK 18), sonst antwortete der zweite POST mit „neu: false“ und legte nichts an.
      if (weitere) { Object.assign(f, { titel: '', beschreibung: '', teil: [], fehler: null, schluessel: anlegeSchluessel() }); u.fokus = '#neu-titel'; }
      else u.neu = null;
    } catch (x) { f.fehler = x.message; }
  });
}

/** Schreibender Aufruf aus dem Aufgabenfenster: läuft durch die eine Stelle (ADR-0025 Regel 6, R00148 AK 17) und
    meldet einen Fehlschlag im Fuß; neu geladen wird, sobald die Schlange leer ist (R00110). `feld` nennt das Eingabefeld,
    aus dem der Aufruf kommt: eine Ablehnung macht es ungültig, die angenommene Eingabe ist kein Entwurf mehr (ADR-0015 N2). */
function schreiben(methode, pfad, daten, feld = null) {
  return durchDieSchlange(async () => {
    try {
      await api(methode, pfad, daten);
      gespeichertMelden(feld);
      if (feld) S.ui.entwurf = null;
    } catch (f) { fensterMelden(f.message, feld); S.ui.fehler = f.message; }
  });
}

/** Platz einer Karte auf einem Board aus dem gezeigten Stand, gemerkt für das Rückgängig (R00112, ADR-0017 Regel 1). */
function platzAufBoard(slug, nummer) {
  const board = (S.boards || []).find(b => b.slug === slug);
  if (!board) return null;
  const spalte = board.spalten.find(sp => sp.aufgaben.includes(nummer));
  if (!spalte) return null;
  return { art: 'legen', slug, titel: board.titel, nummer, spalte: spalte.name, index: spalte.aufgaben.indexOf(nummer) };
}

/** „Zeit 09:00–10:00 von Stefan“ — Uhrzeiten in Ortszeit wie die Zeile im Fenster. */
function zeitBeschrieben(z) {
  return `Zeit ${ortszeit(z.beginn).slice(11)}–${ortszeit(z.ende).slice(11)} von ${per(z.wer).name}`;
}

/** Selektor des Knopfs mit der Aktion `act` und dem Argument `arg`. */
function knopfSelektor(act, arg) {
  return `[data-act="${act}"][data-arg="${CSS.escape(String(arg))}"]`;
}

/** Argument des Knopfs, der nach dem Entfernen von `arg` an dessen Stelle rückt — in der gezeigten Reihenfolge in `bereich`. */
function nachbarArgument(bereich, act, arg) {
  const argumente = [...document.querySelectorAll(`${bereich} [data-act="${act}"]`)].map(knopf => knopf.dataset.arg);
  const index = argumente.indexOf(arg);
  if (index < 0) return null;
  const nachbar = argumente.filter(x => x !== arg)[nachbarNachEntfernen(argumente.length, index)];
  if (nachbar === undefined) return null;
  return nachbar;
}

/** Fokus nach dem Entfernen (R00112 FA 8): das eigene ✕, solange es noch steht (abgelehnt), sonst das des Nachbarn,
    sonst `ort` — das Eingabefeld bzw. die Zeile des Abschnitts. */
function fokusNachEntfernen(act, arg, nachbarArg, ort) {
  const ziele = [knopfSelektor(act, arg)];
  if (nachbarArg !== null) ziele.push(knopfSelektor(act, nachbarArg));
  if (ort) ziele.push(ort);
  S.ui.fokus = ziele;
}

/** Fokus nach dem Rückgängig einer Teilaufgabe: ihr ✕ an `stelle`, wenn sie wieder da ist, sonst das Eingabefeld. */
function teilFokus(gelungen, stelle) {
  const ziele = [];
  if (gelungen) ziele.push(knopfSelektor('teil-weg', stelle));
  ziele.push('#teil-neu');
  return ziele;
}

/** Das Eingabefeld, auf das das Entfernen den Fokus gesetzt hat, solange es leer ist (R00112 FA 2 und FA 8): dort gibt
    es nichts Getipptes zurückzunehmen, also gilt Strg+Z dem Entfernen. */
function leeresFeldDesEntfernens(feld) {
  const ort = S.ui.hinweis.feld;
  return Boolean(ort) && feld.matches(ort) && feld.value === '';
}

/** Sendet die Gegenaktion eines Rückgängig als JSON; `erfolg` ist der Hinweis danach, `ziele` der Fokus. */
function rueckgaengigSenden(methode, pfad, daten, erfolg, ziele) {
  return rueckgaengigAusfuehren(() => durchDieSchlange(() => api(methode, pfad, daten)), () => erfolg, ziele);
}

/** Trägt die gemerkte Zeit wieder ein; ist sie schon da, nennt die Ablehnung sie wie die Zeile im Fenster statt mit ihrer Kennung. */
async function zeitZuruecklegen(z) {
  try {
    return await durchDieSchlange(() => api('POST', `/api/aufgaben/${z.nummer}/zeiten`, { wer: z.wer, beginn: z.beginn, ende: z.ende }));
  } catch (f) {
    if (f.status !== 409) throw f;
    throw new Error(`#${z.nummer} hat schon eine ${zeitBeschrieben(z)}`);
  }
}

/** Lädt den gemerkten Blob unter seinem Namen hoch; bei belegtem Namen vergibt der Server einen freien (R00112 AK 16). */
function anhangZuruecklegen(z) {
  return rueckgaengigAusfuehren(() => anhangSenden(z.nummer, z.blob, z.name), antwort => anhangWiederhergestellt(z.name, antwort.name), (gelungen, antwort) => {
    let name = z.name;
    if (gelungen) name = antwort.name;
    return [knopfSelektor('anhang-weg', name), '#anhaenge [data-act="anhang-weg"]'];
  });
}

/** Hinweis nach dem Zurücklegen; nennt den neuen Namen, wenn der Server wegen Belegung einen anderen vergeben hat. */
function anhangWiederhergestellt(gemerkt, vergeben) {
  const umbenannt = vergeben !== gemerkt;
  if (umbenannt) return `Anhang als „${vergeben}“ wiederhergestellt`;
  return `Anhang „${gemerkt}“ wiederhergestellt`;
}

/** Führt die Gegenaktion `senden` aus; Erfolg steht als Hinweis ohne Knopf da (ADR-0017 Regel 6), die Ablehnung im Fuß oder im Hinweis.
    `ziele(gelungen, antwort)` nennt den Fokus danach (R00112 FA 8): das wiederhergestellte Element, sonst den Ort des
    Entfernens — auch bei der Ablehnung, denn dann steht das Element meist schon wieder da. */
async function rueckgaengigAusfuehren(senden, erfolg, ziele) {
  try {
    const antwort = await senden();
    S.ui.hinweis = { text: erfolg(antwort), at: Date.now() };
    S.ui.fokus = ziele(true, antwort);
    if (S.ui.offen) meldungNachErfolgRaeumen();
  } catch (f) {
    S.ui.fokus = ziele(false);
    // Ist das Aufgabenfenster oberster Dialog, gehört die Ablehnung in dessen Fuß (ADR-0015), sonst in den Hinweis darüber
    const imFensterFuss = hinweisDialog() === 'fenster';
    if (imFensterFuss) fensterMelden(`nicht rückgängig: ${f.message}`);
    else S.ui.hinweis = { text: `nicht rückgängig: ${f.message}`, at: Date.now() };
  }
  render();
}

/** Der Hinweis im Fenster deckt den unteren Rand des Körpers; seine Höhe hält dort den Fokus frei (scroll-padding, PO Z. 162). */
function hinweisEinpassen() {
  const hinweis = $('.hinweis-anker .toast');
  if (!hinweis) return;
  hinweis.closest('.mod').style.setProperty('--kd-hinweis-h', hinweis.offsetHeight + 'px');
  fokusAusDemHinweis();
}

/** Die sequentielle Tab-Navigation holt ein Ziel nicht von selbst unter dem Hinweis hervor — Chromium scrollt nur so weit,
    dass die Oberkante sichtbar ist, und missachtet dabei `scroll-padding`. Liegt das fokussierte Ziel im Rechteck des
    Hinweises, wird es über den reservierten Streifen geholt (`scroll-padding-bottom` aus `hinweisEinpassen`). Gilt beim
    Erscheinen des Hinweises und bei jedem Fokuswechsel (Tab, Klick, Skript) — unabhängig von der Kopfhöhe (R00112,
    „Fokus nie unter dem Hinweis“). */
function fokusAusDemHinweis() {
  const hinweis = $('.hinweis-anker .toast');
  const ziel = document.activeElement;
  if (!hinweis || !ziel || ziel === document.body || hinweis.contains(ziel)) return;
  const f = ziel.getBoundingClientRect(), h = hinweis.getBoundingClientRect();
  if (f.left < h.right && f.right > h.left && f.top < h.bottom && f.bottom > h.top) ziel.scrollIntoView({ block: 'nearest' });
}

/** Setzt die Meldung im Fuß des Aufgabenfensters; `feld` nennt das Eingabefeld, das sie betrifft — nur dieses wird ungültig.
    Eine neue Meldung nimmt den Platz: die abgelehnte Eingabe eines anderen Felds geht mit ihrer Meldung (R00155 G-3 c). */
function fensterMelden(text, feld = null) {
  if (text) abgelehnteEingabeRaeumen(feld);
  S.ui.fensterFehler = text;
  S.ui.fensterFehlerFeld = feld;
}

/** Meldung und abgelehnte Eingabe des Fensters stehen und gehen nur gemeinsam (R00155 G-3). Räumt beide, wenn die abgelehnte
    Eingabe nicht zu `feld` gehört — ihr Feld zeigt wieder den Stand der Datei, der Titel den Lesezustand. Wahr, wenn geräumt wurde. */
function abgelehnteEingabeRaeumen(feld = null) {
  const u = S.ui;
  const abgelehnt = abgelehntesFeld(u.entwurf, { text: u.fensterFehler, feld: u.fensterFehlerFeld }, u.offen);
  if (abgelehnt === null || abgelehnt === feld) return false;
  u.entwurf = null;
  u.fensterFehler = null;
  u.fensterFehlerFeld = null;
  if (abgelehnt === TITEL_FELD) u.titelBearbeiten = false;
  return true;
}

/** Ein Schreibweg des Aufgabenfensters ist angenommen; `feld` nennt das Eingabefeld, aus dem er kam. Die Meldung geht — außer
    sie erklärt die abgelehnte Eingabe eines anderen Felds: dann bleiben beide stehen (R00155 G-3). */
function meldungNachErfolgRaeumen(feld = null) {
  const u = S.ui;
  const abgelehnt = abgelehntesFeld(u.entwurf, { text: u.fensterFehler, feld: u.fensterFehlerFeld }, u.offen);
  if (abgelehnt !== null && abgelehnt !== feld) return;
  fensterMelden(null);
}
/** Wie `meldungNachErfolgRaeumen`, dazu „gespeichert hh:mm:ss“ im Fuß. */
function gespeichertMelden(feld = null) {
  S.ui.gespeichert = Date.now();
  meldungNachErfolgRaeumen(feld);
}

/** Die abgeschickte Eingabe eines Felds nimmt den einen Platz des Fensters (G-1, G-2); sie bleibt stehen, wenn der Server
    sie ablehnt. Die abgelehnte Eingabe eines anderen Felds weicht samt ihrer Meldung (G-3). */
function entwurfAbschicken(feld, wert) {
  abgelehnteEingabeRaeumen(feld);
  S.ui.entwurf = { nummer: S.ui.offen, feld, wert };
}

/** Zeigt eine Meldung im Hinweis (D00007, R00147): knopflos, `role="status"`, auf dem Board unten und im offenen Fenster
    an dessen Hinweis-Anker. Steht ein Rückgängig-Hinweis, wartet sie dessen Ablauf ab, statt ihn zu verdrängen (AK 9). */
function hinweisZeigen(text, dauer) {
  const neu = { text, at: Date.now() };
  if (dauer) neu.dauer = dauer;
  if (S.ui.hinweis && S.ui.hinweis.undo) { S.ui.hinweisWarten = neu; return; }
  S.ui.hinweis = neu;
}

/** Die Meldung des gescheiterten Nachladens (R00147 AK 5): die eigene Änderung ist gespeichert — „nichts geändert" wäre falsch. */
const NACH_LADE_FEHLER = 'Änderung gespeichert — Ansicht nicht neu geladen.';

/** Meldet einen Fehlschlag der Warteschlange dort, wo ausgelöst wurde (R00147 AK 5–8, ADR-0025 Nachtrag N1): im
    Aufgabenfenster in dessen Fuß (gescheiterte eigene Änderung) bzw. an seinem Hinweis-Anker (gescheitertes Nachladen),
    auf dem Board im Hinweis (D00007). 20 s Lebensdauer, weil die Meldung das einzige Zeichen der veralteten Ansicht ist. */
function schlangeMelden(art, fehler, ausloeser) {
  const text = art === 'laden' ? NACH_LADE_FEHLER : fehler.message;
  if (art === 'anfrage' && ausloeser === 'fenster' && S.ui.offen) fensterMelden(text);
  else hinweisZeigen(text, 20000);
  // der Fehlschlag kann der letzte Schritt sein (auch das Nachladen scheiterte) — ohne Zeichnen bliebe die Meldung unsichtbar
  render();
}

/** Öffnet das Aufgabenfenster auf dem Reiter Inhalt und lädt seine Datei; was der Aufrufer zusätzlich braucht, setzt er danach. */
async function fensterOeffnen(nummer) {
  const u = S.ui;
  u.pop = null; u.wirkungNeu = null; u.zeitEdit = null; u.beschreibungBearbeiten = false; u.titelBearbeiten = false;
  // Die gewählte Ansicht bleibt beim Öffnen einer anderen Aufgabe (R00145 FA 9); führt die Aufgabe sie nicht, fällt sie
  // in vFenster über reiterSchluessel auf „Inhalt“. Die Inhalte der vorigen Aufgabe fallen sofort weg (R00110/R00123).
  u.offen = nummer; u.fensterMenue = null; u.gespeichert = null; fensterMelden(null);
  u.entwurf = null; u.datei = null; u.anhaenge = []; u.eintritt = [];
  u.verlauf = null; u.verlaufFehler = null;
  // bei gewähltem Verlauf zuerst die leere Tabelle zeichnen — nie Zeilen der vorigen Aufgabe (R00123)
  if (u.tab === 'verlauf') render();
  await dateiLaden();
}

/** `feld` nennt das Eingabefeld, aus dem die Änderung kommt; eine Ablehnung macht es ungültig. */
async function aufgabeAendern(nummer, aenderung, feld = null) {
  if (ichNoetig()) { render(); return false; }
  let gelungen = true;
  try {
    await durchDieSchlange(() => api('PATCH', '/api/aufgaben/' + nummer, aenderung));
    gespeichertMelden(feld);
  } catch (f) { fensterMelden(f.message, feld); gelungen = false; }
  render();
  return gelungen;
}

/** Speichert den Titel der offenen Aufgabe. Eine abgelehnte Eingabe bleibt als der eine Entwurf im Titelfeld stehen:
    das Feld bleibt Eingabefeld, behält den Fokus und verweist auf die Meldung (ADR-0015 N2, R00155 #96). */
async function titelSpeichern(wert) {
  const u = S.ui;
  const nummer = u.offen;
  if (ichNoetig()) { u.titelBearbeiten = false; render(); return; }
  entwurfAbschicken(TITEL_FELD, wert);
  const gelungen = await aufgabeAendern(nummer, { titel: wert }, TITEL_FELD);
  if (u.offen !== nummer) return;
  if (gelungen) { u.entwurf = null; u.titelBearbeiten = false; }
  else { u.titelBearbeiten = true; u.fokus = '[data-af="titel"]'; }
  render();
}

/** Felder, deren Eingabe abgeschickt und noch nicht beantwortet ist. Der Text steht dann noch im Feld, ist aber kein
    Entwurf mehr: Esc nimmt ihn nicht zurück und schließt das Fenster wie ohne Eingabe (R00155 54-10). */
const abgeschickteFelder = new Set();
const feldname = feld => feld.id || feld.dataset.af;

/** Führt den Schreibweg eines Felds aus; bis er endet — Antwort gezeichnet —, gilt die Eingabe als abgeschickt. */
function abschicken(feld, schreibweg) {
  const name = feldname(feld);
  abgeschickteFelder.add(name);
  return Promise.resolve(schreibweg()).finally(() => abgeschickteFelder.delete(name));
}

/** Kennung, unter der ein Feld des Aufgabenfensters den einen Entwurf und seine Meldung führt; null für Felder ohne. */
function entwurfskennung(feld) {
  if (feld.dataset.af === 'titel') return TITEL_FELD;
  if (feld.id === 'herkunft-neu') return HERKUNFT_FELD;
  if (feld.id === 'zeit-neu') return ZEIT_FELD;
  return null;
}

/** Felder mit Lesezustand: der Zustand, der ihr Bearbeiten hält, und der Auslöser, an den der Fokus zurückgeht (ADR-0010 N9 Ziffer 1). */
const BEARBEITUNGSMODUS = {
  titel: { zustand: 'titelBearbeiten', ausloeser: '[data-act="titel-bearbeiten"]' },
  beschreibung: { zustand: 'beschreibungBearbeiten', ausloeser: '[data-act="beschreibung-bearbeiten"]' },
};
/** Nach dem Bearbeiten der Beschreibung fiele der Fokus auf BODY (Strg+Enter): das nächste Zeichnen gibt ihn ihrem Auslöser,
    dem Stift (R00162 AK 7). Wer mit Tab oder Klick weiterging, behält sein Ziel. */
function fokusNachBeschreibung() {
  if (document.activeElement === document.body) S.ui.fokus = BEARBEITUNGSMODUS.beschreibung.ausloeser;
}

/** Verwirft, was das Feld des Aufgabenfensters an Entwurf oder Bearbeitungsmodus hat — ohne Schreibweg (ADR-0010 N9):
    der Wert geht auf den gezeichneten Stand zurück, bevor das Feld verlassen wird, sein Entwurf und die Meldung dazu
    verschwinden. `nurEntwurf` lässt einen unveränderten Bearbeitungsmodus stehen. Falsch, wenn es nichts zu verwerfen gab. */
function eingabeVerwerfen(feld, nurEntwurf = false) {
  const u = S.ui;
  const verworfen = verwerfbares(feld);
  if (!verworfen || (nurEntwurf && !verworfen.hatEntwurf)) return false;
  feld.value = verworfen.wert;
  aenderungGemeldet(feld);
  if (verworfen.haeltEntwurf) u.entwurf = null;
  if (verworfen.kennung !== null && u.fensterFehlerFeld === verworfen.kennung) fensterMelden(null);
  if (verworfen.verlaesstModus) { u[verworfen.modus.zustand] = false; u.fokus = verworfen.modus.ausloeser; }
  // der Knopf hatte den Fokus: nach dem Verwerfen steht er wie nach Esc im Feld (R00155 54-13)
  else if (document.activeElement !== feld) u.fokus = feldSelektor(feld);
  render();
  return true;
}
const feldSelektor = feld => feld.id ? '#' + feld.id : `#fenster [data-af="${feld.dataset.af}"]`;

/** Was das Feld des Aufgabenfensters nach der Esc-Regel zu verwerfen hat (`verwerfung`), dazu seine Entwurfskennung und sein
    Bearbeitungsmodus; null, wenn es nichts zu verwerfen gibt. */
function verwerfbares(feld) {
  const u = S.ui;
  if (!feld.dataset || abgeschickteFelder.has(feldname(feld))) return null;
  const kennung = entwurfskennung(feld);
  const haeltEntwurf = kennung !== null && entwurfswert(u.entwurf, u.offen, kennung) !== null;
  const modus = BEARBEITUNGSMODUS[feld.dataset.af];
  const imModus = Boolean(modus) && u[modus.zustand];
  const verworfen = verwerfung({ af: feld.dataset.af, id: feld.id, wert: feld.value, gezeichnet: feld.defaultValue, imModus, haeltEntwurf });
  if (!verworfen) return null;
  return { ...verworfen, kennung, haeltEntwurf, modus };
}

/** Das Textfeld des Aufgabenfensters, von dem der Fokus unmittelbar auf „Eingabe verwerfen“ ging (R00155 54-13) — so löst
    Hilfstechnik den Knopf aus. Solange der Fokus auf dem Knopf steht, gilt das Feld als nicht verlassen: sein Entwurf ist
    weder gespeichert noch verworfen. Der Knopf verwirft ihn; gibt er den Fokus weiter, wird das Verlassen nachgeholt. */
let feldVorDemVerwerfen = null;
const istVerwerfenKnopf = element => Boolean(element) && Boolean(element.dataset) && element.dataset.act === 'eingabe-verwerfen';

/** Wahr, wenn der Fokus von einem Feld mit Entwurf auf „Eingabe verwerfen“ geht; das Feld ist dann gemerkt. */
function wartetAufVerwerfen(feld, fokusziel) {
  if (!S.ui.offen || !istVerwerfenKnopf(fokusziel)) return false;
  const verworfen = verwerfbares(feld);
  if (!verworfen || !verworfen.hatEntwurf) return false;
  feldVorDemVerwerfen = feld;
  return true;
}

/** Holt das Verlassen des Felds nach, das auf „Eingabe verwerfen“ wartete: sein Entwurf wird gespeichert wie beim Verlassen. */
function verlassenNachholen() {
  const feld = feldVorDemVerwerfen;
  feldVorDemVerwerfen = null;
  if (feld) feldVerlassen(feld);
}

/** Der Knopf „Eingabe verwerfen“ im Fensterfuß (R00155 54-12): je Tipp genau eines, das Feld mit Fokus zuerst — (1) sein
    Entwurf, wie Esc im selben Feld; hat der Knopf selbst den Fokus, ist es das Feld unmittelbar davor (54-13); (2) sonst die abgelehnte Eingabe des Fensters, der Fokus bleibt, wo er war; (3) sonst
    nichts. Er schließt das Fenster nie. */
function eingabeVerwerfenPerKnopf() {
  const vorDemKnopf = feldVorDemVerwerfen;
  feldVorDemVerwerfen = null;
  if (vorDemKnopf && vorDemKnopf.isConnected && eingabeVerwerfen(vorDemKnopf, true)) return;
  const aktiv = document.activeElement;
  const fokusImFenster = Boolean(aktiv) && Boolean(aktiv.closest('#fenster'));
  if (fokusImFenster && eingabeVerwerfen(aktiv, true)) return;
  if (abgelehnteEingabeRaeumen()) render();
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
    await durchDieSchlange(() => api('PATCH', '/api/aufgaben/mehrere', { aenderungen }));
    gespeichertMelden();
  } catch (f) { S.ui.fehler = f.message; }
  render();
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
    const r = await durchDieSchlange(() => api('POST', `/api/boards/${encodeURIComponent(u.slug)}/bewegen-mehrere`, { ziele }));
    if (r.bewegt) u.hinweis = { text, at: Date.now(), ...(zurueck ? { undo: { art: 'ziele', ziele: zurueck } } : {}), ...(r.warnungen && r.warnungen.length ? { warnungen: r.warnungen, dauer: 20000 } : {}) };
  } catch (f) { u.fehler = f.message; }
  render();
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
  const boards = (S.boards || []).filter(b => b.slug !== S.ui.slug && !b.archiviert && b.spalten.length).map(b => ({ slug: b.slug, titel: b.titel, spalte: b.spalten[0].name }));
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
  // Ein Feld, das auf „Eingabe verwerfen“ wartet, übersteht das Ersetzen nicht: vorher verlassen, damit sein Entwurf nicht still verloren geht
  verlassenNachholen();
  S.renders = (S.renders || 0) + 1;
  S.ui.nachZug = false;
  S.ui.stufe = stufeAusBreite(innerWidth);
  const aktiv = document.activeElement;
  // Ein Menüeintrag, der das Menü offen lässt (Signale oben, Darstellung), behält den Fokus für die Tastatur.
  const menueEintragImFokus = !S.ui.fokus && aktiv && aktiv.id && aktiv.closest('#pop') && S.ui.pop;
  if (menueEintragImFokus) S.ui.fokus = '#' + CSS.escape(aktiv.id);
  reiterRueckfallImFenster(aktiv);
  document.title = fenstertitel();
  // Neuzeichnen in derselben Sicht und bei derselben offenen Aufgabe hält die Leseposition (R00103, ADR-0007) —
  // sonst springt das Board unter dem Kontextmenü weg und das Aufgabenfenster bei jedem Live-Ereignis nach oben.
  const sicht = `${S.ui.view}/${S.ui.slug || ''}/${S.ui.setup ? 'setup' : ''}`;
  // Das fokussierte Element übersteht es ebenso: der Fokus, bei Eingabefeldern auch Cursor und — nur wenn getippt wurde — der Wert.
  // Jeder Bereich der Seite zählt (Kopf, Statuszeile, künftige); nur Haupt und Fenster hinter ihren Wächtern —
  // nach einem Sichtwechsel träfe derselbe Schlüssel ein anderes Element.
  const bereiche = [...$('#app').children].filter(bereich => bereich.id !== 'main');
  if ($('#main').dataset.sicht === sicht) bereiche.push($('#main'));
  if ($('#over').dataset.offen === String(S.ui.offen || '')) bereiche.push($('#over'));
  const rollen = bereiche.flatMap(bereich => rollstaende(bereich));
  // Karten und Zeilen führt die Tastatur über fokusKarte und fokusZeile — dort ist das Ziel ausdrücklich
  const zielGefuehrt = Boolean(aktiv && aktiv.matches && aktiv.matches('.ka[data-id], tr[data-zeile]'));
  const fokus = zielGefuehrt ? null : fokusstand(aktiv, bereiche);
  // Ein Element mit inhaltsbezogenem data-halt hält nie über die Stelle: ist sein Inhalt mehrdeutig (derselbe Text
  // zweimal) oder verschwindet er unter dem Menschen (fremder Textwechsel), hält der Sicherer nichts, und der Fokus
  // fällt auf den Ort seines Abschnitts (#teil-neu, #herkunft-neu, „+ Wirkung“) — nie auf ein fremdes ✕ oder eine
  // fremde Zeile und nicht eigens ins Fenster (R00138, R00134, ADR-0007 N3 Regel 4, ADR-0010 N7).
  let ortDesFokus = null;
  if (!S.ui.fokus && aktiv && aktiv.dataset && aktiv.dataset.ort) ortDesFokus = aktiv.dataset.ort;
  // Vor dem Ersetzen merken, solange der Auslöser noch im Dokument hängt
  const ausloeser = ausloeserSelektor(aktiv);
  const aktivWarSichtbar = imSichtbereich(aktiv);
  // Die Auswahl gilt nur auf diesem Board und nur für Karten, die noch darauf liegen (R00065)
  if ($('#main').dataset.sicht !== sicht) auswahlAufheben();
  S.ui.auswahl = S.ui.auswahl.filter(n => S.board && S.board.spalten.some(sp => sp.aufgaben.includes(n)) && aufgabe(n) && !aufgabe(n).archiviert);
  // Beim Ersetzen meldet der Browser für das fokussierte, getippte Feld „change“, solange es noch im Dokument hängt;
  // das ist kein Verlassen und speichert nichts (R00103). Der Wert kommt über den Sicherer zurück.
  S.neuzeichnen = true;
  try {
    $('#kopf').innerHTML = vKopf();
    $('#main').innerHTML = vMain();
    $('#main').dataset.sicht = sicht;
    $('#over').innerHTML = (S.ui.neu ? vNeu() : '') + (S.ui.offen && !S.ui.setup ? vFenster() : '') + (S.ui.offenDefekt ? vDefektFenster() : '') + vPop() + vAlDialog() + vHinweis() + (S.ui.hilfe ? vHilfe() : '') + (S.ui.zuweisen ? vZuweisen() : '') + vMenue() + vTipp();
    $('#over').dataset.offen = String(S.ui.offen || '');
  } finally {
    S.neuzeichnen = false;
  }
  hinweisEinpassen();
  rollstaendeSetzen(rollen);
  sperrenMarkieren();
  document.querySelectorAll('#zuweisen [data-gemischt]').forEach(x => { x.indeterminate = true; });
  menueEinpassen();
  fensterMenueEinpassen();
  $('#stat').innerHTML = vStatus();
  popPlatzieren();
  tippPlatzieren();
  fokusFuehren(aktiv, ausloeser, fokus, aktivWarSichtbar, ortDesFokus);
}

/* Fokusführung über Ebenen (R00106, ADR-0010): die Entscheidungen rechnet web/fokus.js, hier wird nur angewendet. */
const TABBAR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]';

/** Unter dem obersten offenen Dialog ist alles inert; der Dialog selbst ist aria-modal. Menüs sind nicht modal. */
function ebenenAbschirmen(liste) {
  $('#app').inert = false;
  const dialoge = liste.filter(ebene => ebene.modal).map(ebene => $(ebene.selektor)).filter(Boolean);
  if (!dialoge.length) return;
  const oberster = dialoge.pop();
  oberster.setAttribute('aria-modal', 'true');
  $('#app').inert = true;
  // Der abgedunkelte Hintergrund gehört zum Dialog und bleibt klickbar; tiefere Dialoge samt Hintergrund nicht
  for (const tiefer of dialoge) (tiefer.closest('.mod-bg') || tiefer).inert = true;
}

/** Menü- und Fenster-Auslöser tragen aria-expanded: „true“ nur der, für den der Pop gerade offen ist. */
function ausloeserMarkieren() {
  const pop = $('#pop');
  const offenFuer = pop ? pop.dataset.for : '';
  for (const knopf of document.querySelectorAll('[aria-haspopup="menu"][id], [aria-haspopup="dialog"][id]')) knopf.setAttribute('aria-expanded', String(knopf.id === offenFuer));
}

/** Ein Tab-Halt je Radiogruppe: das gewählte Radio trägt tabindex 0, ohne Wahl das erste, alle anderen -1. */
function radiogruppenFuehren() {
  for (const gruppe of document.querySelectorAll('[role="radiogroup"]')) {
    const radios = [...gruppe.querySelectorAll('[role="radio"]')];
    const gewaehlt = Math.max(0, radios.findIndex(r => r.getAttribute('aria-checked') === 'true'));
    radios.forEach((r, i) => r.setAttribute('tabindex', i === gewaehlt ? '0' : '-1'));
  }
}

/** Im Radio: Pfeile wählen das Nachbar-Radio wie ein Klick und fokussieren es, Leertaste wählt das fokussierte; wahr, wenn die Taste verbraucht ist. */
function radioTaste(ereignis) {
  const jetzt = ereignis.target;
  const gruppe = jetzt.closest && jetzt.getAttribute('role') === 'radio' && jetzt.closest('[role="radiogroup"]');
  if (!gruppe || ereignis.ctrlKey || ereignis.metaKey || ereignis.altKey) return false;
  if (ereignis.key === ' ') { ereignis.preventDefault(); jetzt.click(); return true; }
  const radios = [...gruppe.querySelectorAll('[role="radio"]')];
  const ziel = radioSchritt(radios.length, radios.indexOf(jetzt), ereignis.key);
  if (ziel === null) return false;
  ereignis.preventDefault();
  const name = gruppe.getAttribute('aria-label'), wert = radios[ziel].dataset.arg;
  radios[ziel].click();
  gewaehltesRadioFokussieren(name, wert);
  return true;
}

/** Nach dem Neuzeichnen: das Radio mit dem Wert in der sichtbaren Gruppe gleichen Namens. */
function gewaehltesRadioFokussieren(name, wert) {
  const gruppen = [...document.querySelectorAll('[role="radiogroup"]')].filter(g => g.getAttribute('aria-label') === name && g.getClientRects().length);
  const radio = gruppen.map(g => [...g.querySelectorAll('[role="radio"]')].find(r => r.dataset.arg === wert)).find(Boolean);
  if (radio) radio.focus();
}

const MENUE_RICHTUNG = { ArrowDown: 1, ArrowUp: -1, Home: 'anfang', End: 'ende' };

/** Enter und Leertaste auf einem Eintrag, der kein Knopf ist, lösen ihn wie ein Klick aus; Knöpfe tun das selbst. */
function eintragAusloesen(ereignis, eintraege) {
  const eintrag = document.activeElement;
  if ((ereignis.key !== 'Enter' && ereignis.key !== ' ') || !eintraege.includes(eintrag) || eintrag.tagName === 'BUTTON') return false;
  ereignis.preventDefault();
  eintrag.click();
  return true;
}

/** Im nicht-modalen Pop-Fenster: Tab am Rand schließt (nach vorn wie im Menü, zurück auf den Auslöser), Pfeile tun nichts außer in Feldern; wahr, wenn die Taste verbraucht ist. */
function popFensterTaste(ereignis) {
  const oberste = vorigeEbenen.at(-1);
  if (!oberste || !oberste.fenster) return false;
  if (ereignis.key === 'Tab') return fensterRandTaste(ereignis);
  if (!ereignis.key.startsWith('Arrow')) return false;
  if (!/INPUT|TEXTAREA|SELECT/.test(ereignis.target.tagName)) ereignis.preventDefault();
  return true;
}

function fensterRandTaste(ereignis) {
  const tabbare = tabbareIn($('#pop'));
  const rand = fensterRand(tabbare.length, tabbare.indexOf(document.activeElement), ereignis.shiftKey);
  if (rand === 'weiter') return false;
  if (rand === 'ausloeser') ereignis.preventDefault();
  // der Fokus steht vor der Standardaktion auf dem Auslöser: Tab führt von dort weiter, Umschalt+Tab ist verbraucht
  popZuMitTab();
  return true;
}

/** Tab im Menü schließt es: der Fokus steht vor der Standardaktion auf dem Auslöser, der Browser führt ihn von dort weiter. */
function popZuMitTab() {
  S.ui.fokus = ausloeserDesMenues();
  S.ui.pop = null;
  S.ui.ichNoetig = false;
  render();
}

/** Im offenen Pop-Menü: Pfeile, Pos1 und Ende führen den DOM-Fokus über die wählbaren Einträge, Tab schließt; wahr, wenn die Taste verbraucht ist. */
function popMenueTaste(ereignis) {
  const menue = $('#pop[role="menu"]') || $('#pop [role="menu"]');
  if (!menue) return false;
  if (ereignis.key === 'Tab') { popZuMitTab(); return true; }
  const eintraege = [...menue.querySelectorAll('[role^="menuitem"]')];
  if (eintragAusloesen(ereignis, eintraege)) return true;
  if (!Object.hasOwn(MENUE_RICHTUNG, ereignis.key)) return false;
  // menueSchritt überspringt, was „aktuell“ ist — hier die nicht wählbaren Einträge
  const modell = eintraege.map(eintrag => ({ aktuell: eintrag.getAttribute('aria-disabled') === 'true' }));
  const ziel = menueSchritt(modell, eintraege.indexOf(document.activeElement), MENUE_RICHTUNG[ereignis.key]);
  ereignis.preventDefault();
  if (ziel >= 0) eintraege[ziel].focus();
  return true;
}

/** Tabbare, sichtbare Elemente eines Bereichs in Dokumentreihenfolge. */
function tabbareIn(bereich) {
  return [...bereich.querySelectorAll(TABBAR)].filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
}

/** Tab und Umschalt+Tab laufen im obersten offenen Dialog um, statt ihn zu verlassen; wahr, wenn die Taste verbraucht ist. */
function fallenTaste(ereignis) {
  const oberste = ebenen(S.ui).at(-1);
  if (!oberste || !oberste.modal || !$(oberste.selektor)) return false;
  const tabbare = tabbareIn($(oberste.selektor));
  const ziel = fallenSchritt(tabbare.length, tabbare.indexOf(document.activeElement), ereignis.shiftKey);
  ereignis.preventDefault();
  if (ziel >= 0) tabbare[ziel].focus();
  return true;
}

/** Fällt die gemerkte Ansicht weg (Live-Ereignis, fehlendes Etikett), zeigt das Fenster „Inhalt“ (R00145 FA 2/9, generisch);
    war das Ansichtsmenü offen, schließt es und der Fokus steht am Auslöser. */
function reiterRueckfallImFenster(aktiv) {
  const offen = S.ui.offen && aufgabe(S.ui.offen);
  // Auch der Fokus im Panel zählt: mit der verschwindenden Ansicht wird der gezeichnete Inhalt ersetzt, der Fokus
  // hätte kein Ziel mehr — er gehört an den Auslöser, der die neue Ansicht ansagt (R00145 FA 9 letzter Satz, B2).
  const fokusBeiAnsicht = Boolean(aktiv && aktiv.closest && aktiv.closest(`${ANSICHT_KNOPF}, #fenster [role="menu"][data-art="ansicht"], #fenster .mod-body`));
  // ohne offene Aufgabe gibt es nichts zu prüfen: der gemerkte Stand bleibt für das nächste Fenster (R00145 FA 9)
  const rueckfall = offen ? reiterRueckfall({ tab: S.ui.tab, schluessel: reiterSchluessel(offen), fokusBeiReiter: fokusBeiAnsicht }) : null;
  if (!rueckfall) return;
  S.ui.tab = rueckfall.tab;
  if (S.ui.fensterMenue === 'ansicht') S.ui.fensterMenue = null;
  if (rueckfall.fokus) S.ui.fokus = rueckfall.fokus;
}

/** Die Ebenen des letzten Neuzeichnens und je Ebene der Auslöser, der sie geöffnet hat. */
let vorigeEbenen = [];
const gemerkteAusloeser = {};

let vorigerPop = null;

/** Ein offenes Pop wurde gegen ein anderes getauscht (etwa Mehr → Boards per Klick), und zwar über dessen eigenen Auslöser:
 *  dann gibt das neue Pop den Fokus diesem Auslöser zurück, nicht dem des alten (R00106, Karte #8 S2). */
function popGewechseltDurch(ausloeser) {
  const pop = $('#pop');
  if (!pop || !vorigerPop || !S.ui.pop || S.ui.pop === vorigerPop || !ausloeser) return false;
  const element = $(ausloeser);
  return Boolean(element) && element.id === pop.dataset.for;
}

/** Selektor, unter dem sich der Auslöser nach dem Neuzeichnen wiederfindet: Karte, Zeile, sonst der Schlüssel des Sicherers. */
function ausloeserSelektor(aktiv) {
  if (!aktiv || aktiv === document.body || !aktiv.isConnected) return null;
  if (aktiv.matches('.ka[data-id]')) return `.ka[data-id="${aktiv.dataset.id}"]`;
  if (aktiv.matches('tr[data-zeile]')) return `tr[data-zeile="${aktiv.dataset.zeile}"]`;
  const stand = fokusstand(aktiv, [document.body]);
  if (!stand) return null;
  return stand.schluessel;
}

/** Nach dem Neuzeichnen: Ebenen abschirmen, dann das erste Fokusziel der Rangfolge aus web/fokus.js setzen. */
function fokusFuehren(aktiv, ausloeser, gesichert, aktivWarSichtbar, ort) {
  const vorher = vorigeEbenen;
  const arten = liste => liste.map(ebene => ebene.art);
  const geoeffnet = ebenen(S.ui).filter(ebene => !arten(vorher).includes(ebene.art));
  for (const ebene of geoeffnet) gemerkteAusloeser[ebene.art] = ausloeser;
  if (popGewechseltDurch(ausloeser)) gemerkteAusloeser.pop = ausloeser;
  vorigerPop = S.ui.pop || null;
  const geschlossen = vorher.filter(ebene => !arten(ebenen(S.ui)).includes(ebene.art));
  for (const ebene of geschlossen) delete gemerkteAusloeser[ebene.art];
  const jetzt = ebenen(S.ui, gemerkteAusloeser);
  vorigeEbenen = jetzt;
  ebenenAbschirmen(jetzt);
  ausloeserMarkieren();
  radiogruppenFuehren();
  const oberste = jetzt.at(-1) || null;
  const fokusVorher = { stand: fokusStandVorher(aktiv), selektor: ausloeser, sichtbar: aktivWarSichtbar };
  const ziele = fokusZiel({ ausdruecklich: S.ui.fokus, gesichert: Boolean(gesichert), gesichertInOberster: true, ort, geschlossen: geschlossen.at(-1) || null, geoeffnet: geoeffnet.at(-1) || null, oberste, fuehrung: fuehrungsziel(), vorher: fokusVorher });
  S.ui.fokus = null;
  const gesetzt = ziele.some(ziel => fokusVersuchen(ziel, gesichert, oberste, fokusVorher));
  // Rückfall (R00106 Z. 102–104, PO Z. 111/113): das erste tabbare Element nur in einer nach dem Neuzeichnen offenen Ebene.
  // Ohne offene Ebene bleibt es beim BODY — auch wenn die letzte gerade schloss und ihr Auslöser fort ist. Hatte sie nie
  // einen Auslöser (aus BODY geöffnet, Z. 142), gibt es nichts zurückzugeben: dann in den Hauptbereich.
  const ohneAusloeserGeschlossen = !oberste && geschlossen.length > 0 && !geschlossen.at(-1).rueckgabe.length;
  if (!gesetzt && oberste && !fokusSitztIn(oberste)) ersterTabbarer($(oberste.selektor));
  if (!gesetzt && ohneAusloeserGeschlossen) ersterTabbarer($('#main'));
}

/** Was vor dem Neuzeichnen fokussiert war: nichts (BODY), noch im Dokument oder mit dem Neuzeichnen ersetzt. */
function fokusStandVorher(aktiv) {
  if (!aktiv || aktiv === document.body) return 'nichts';
  if (aktiv.isConnected) return 'gehalten';
  return 'verloren';
}

/** Ob das Element im Fenster und in jedem scrollenden Vorfahren zu sehen ist — vor dem Ersetzen gemessen. */
function imSichtbereich(element) {
  if (!element || element === document.body || !element.isConnected) return false;
  const elementRect = element.getBoundingClientRect();
  const ueberlappt = rahmenRect => elementRect.right > rahmenRect.left && elementRect.left < rahmenRect.right && elementRect.bottom > rahmenRect.top && elementRect.top < rahmenRect.bottom;
  if (!ueberlappt({ left: 0, top: 0, right: innerWidth, bottom: innerHeight })) return false;
  for (let rahmen = element.parentElement; rahmen && rahmen !== document.body; rahmen = rahmen.parentElement) {
    const scrollt = rahmen.scrollWidth > rahmen.clientWidth || rahmen.scrollHeight > rahmen.clientHeight;
    if (scrollt && !ueberlappt(rahmen.getBoundingClientRect())) return false;
  }
  return true;
}

/** Karte im Board bzw. Zeile in der Aufgabenliste, die die Tastatur zuletzt geführt hat. */
function fuehrungsziel() {
  if (S.ui.view === 'board' && S.ui.fokusKarte) return `.ka[data-id="${S.ui.fokusKarte}"]`;
  if (S.ui.view === 'aufgaben' && S.ui.fokusZeile) return `tr[data-zeile="${S.ui.fokusZeile}"]`;
  return null;
}

/** Ein Ziel setzen; der Sicherer zählt nur, wenn sein Element in der obersten Ebene liegt. Wahr, wenn der Fokus sitzt. */
function fokusVersuchen(ziel, gesichert, oberste, fokusVorher) {
  if (ziel === GESICHERT) return fokusSetzen(gesichert) && liegtIn(document.activeElement, oberste);
  const element = $(ziel);
  if (!element) return false;
  element.focus({ preventScroll: ohneRollen(ziel, fokusVorher) });
  return document.activeElement === element;
}

function liegtIn(element, ebene) {
  if (!ebene) return true;
  const bereich = $(ebene.selektor);
  return Boolean(bereich) && bereich.contains(element);
}

/** Der Fokus steht auf einem Element der obersten Ebene bzw., ohne Ebene, irgendwo außer auf BODY. */
function fokusSitztIn(oberste) {
  const element = document.activeElement;
  return Boolean(element) && element !== document.body && liegtIn(element, oberste);
}

/** Rückfall: das erste tabbare Element im Bereich (oberste offene Ebene bzw. Hauptbereich). */
function ersterTabbarer(bereich) {
  const erstes = bereich && tabbareIn(bereich)[0];
  if (erstes) erstes.focus({ preventScroll: true });
}

function fenstertitel() {
  if (!S.zustand || !S.zustand.eingerichtet) return 'kanbanD';
  const seite = { ansicht: S.ui.view, boardTitel: boardTitelDerSeite(), anwendung: anwendungDerSeite() };
  return fenstertitelName(seite, { zaehler: alleLaufenden().length, wbsStand: S.wbs && prozente(S.wbs.stand).gruen, wbsName: S.wbs && S.wbs.name });
}

/** Selektor des Texts einer Teilaufgabe im Aufgabenfenster — nach dem Bearbeiten kehrt der Fokus dorthin zurück. */
function textDerTeilaufgabe(index) {
  return `[role=dialog] [data-act="teil-bearbeiten"][data-arg="${index}"]`;
}

/** Selektor des Knopfs, der das offene Menü geöffnet hat — Esc gibt ihm den Fokus zurück. */
function ausloeserDesMenues() {
  const pop = $('#pop');
  if (!pop || !document.getElementById(pop.dataset.for)) return null;
  return '#' + CSS.escape(pop.dataset.for);
}

function popPlatzieren() {
  const p = $('#pop');
  // Ein Pop ohne Inhalt (Lauf ohne laufenden Timer) oder ohne Auslöser ist zu — auch im Zustand, sonst rechnet die
  // Fokusführung mit einer Ebene, die es nicht gibt (R00106).
  if (!p) { S.ui.pop = null; return; }
  const t = document.getElementById(p.dataset.for);
  if (!t) { S.ui.pop = null; p.remove(); return; }
  const r = t.getBoundingClientRect();
  p.style.top = popOben(r, p.offsetHeight, innerHeight) + 'px';
  p.style.left = Math.max(4, Math.min(p.dataset.al === 'r' ? r.right - p.offsetWidth : r.left, innerWidth - p.offsetWidth - 4)) + 'px';
}

/** Unter dem Auslöser, wenn das Pop dort ganz ins Fenster passt; sonst darüber — etwa beim Auslöser in der Statuszeile (Karte #8 S4). */
function popOben(ausloeserRect, popHoehe, fensterHoehe) {
  const obenDarunter = ausloeserRect.bottom + 2;
  const passtDarunter = obenDarunter + popHoehe <= fensterHoehe;
  if (passtDarunter) return obenDarunter;
  return Math.max(4, ausloeserRect.top - 2 - popHoehe);
}

/* Erklärtext auf Anforderung (R00119, ADR-0020): Zustand in S.ui.tooltip = { fuer: data-tip-Schlüssel }, der eine
   nicht-modale Tooltip ohne Fokus. Die Blase selbst zeichnet `vTipp()` in `#over` (ADR-0007); hier steht nur die
   Bedienung — zeigen bei Fokus und langem Druck, verbergen bei Esc und (Touch) Tippen außerhalb — und die Position. */

/** Der Auslöser des offenen Tooltips im (nach dem Neuzeichnen neuen) Dokument; null, wenn es ihn nicht mehr gibt. */
function tippAusloeser() {
  if (!S.ui.tooltip) return null;
  return [...document.querySelectorAll('[data-tip]')].find(x => x.dataset.tip === S.ui.tooltip.fuer) || null;
}

/** Die eine Blase für diesen Auslöser zeigen: Zustand setzen, den von `vTipp()` gezeichneten Kasten füllen und stellen. */
function tippZeigen(el) {
  S.ui.tooltip = { fuer: el.dataset.tip };
  const blase = $('#kd-tipp');
  if (!blase) return;
  blase.textContent = tippText(el);
  blase.hidden = false;
  tippPlatzieren();
}

/** Die Blase ausblenden und den Zustand löschen — der nächste Render zeichnet sie verborgen und leer. */
function tippVerbergen() {
  if (!S.ui.tooltip) return;
  S.ui.tooltip = null;
  const blase = $('#kd-tipp');
  if (blase) { blase.hidden = true; blase.textContent = ''; }
}

/** Position über die Logik von `popPlatzieren`: unter dem Auslöser, sonst darüber; an der Fensterkante umgeklappt. */
function tippPlatzieren() {
  const blase = $('#kd-tipp');
  if (!blase || blase.hidden) return;
  const el = tippAusloeser();
  if (!el) { tippVerbergen(); return; }
  const r = el.getBoundingClientRect();
  blase.style.top = popOben(r, blase.offsetHeight, innerHeight) + 'px';
  blase.style.left = Math.max(4, Math.min(r.left, innerWidth - blase.offsetWidth - 4)) + 'px';
}

/** Der Board-Titel zu einem Slug — aus dem offenen Umschalter oder der vollen Board-Liste; sonst der Slug. */
function boardName(slug) {
  const b = (S.zustand.boards || []).find(x => x.slug === slug) || (S.boards || []).find(x => x.slug === slug);
  return b ? b.titel : slug;
}

/** Umbenennen (R00128 M10/S3): PATCH {titel}; ein 400 zeigt die Servermeldung als Feldfehler in `popFehler`, das Feld bleibt offen.
    Die getippte Zeichenkette hält `S.ui.boardUmbenennenWert` (Härtung #129/1) — gesetzt beim Beginn der Sitzung und im Feld. */
async function boardUmbenennen(slug, eingegebenerWert) {
  // Der ✓-Knopf trägt keinen Wert mit: dann gilt die im Feld gehaltene Eingabe.
  let eingabe = eingegebenerWert;
  if (eingabe === undefined) eingabe = S.ui.boardUmbenennenWert;
  const titel = eingabe.trim();
  try {
    await durchDieSchlange(() => api('PATCH', `/api/boards/${encodeURIComponent(slug)}`, { titel }));
  } catch (f) {
    S.ui.popFehler = f.message;
    S.ui.fokus = '#board-umbenennen';
    render();
    return;
  }
  S.ui.boardUmbenennen = null;
  S.ui.popFehler = null;
  S.ui.hinweis = { text: `Board „${titel}“ umbenannt`, at: Date.now() };
  S.ui.fokus = `[data-act="board-wahl"][data-arg="${slug}"]`;
  render();
  render();
}

/** Die Daten des geteilten Bestätigungsdialogs für ein Board (R00128): Name, Rumpf und Bestätigungswort — die
    Komponente `vAlDialog` rendert sie, das Ausführen hängt an `art`. */
function boardAlDialog(art, slug) {
  const titel = boardName(slug);
  const loeschen = art === 'loeschen';
  return {
    art: loeschen ? 'board-loeschen' : 'board-archivieren',
    slug,
    titel,
    name: loeschen ? `${titel} endgültig löschen` : `${titel} archivieren`,
    rumpf: loeschen
      ? `Die Board-Datei <code>boards/${esc(slug)}.md</code> wird entfernt. Die Aufgaben bleiben erhalten; wiederherstellbar nur über die Git-Geschichte.`
      : `Das Board <b>${esc(titel)}</b> wird archiviert. Es fällt aus der Liste; die Datei <code>boards/${esc(slug)}.md</code> bleibt erhalten und lässt sich jederzeit wieder öffnen.`,
    bestaetigen: loeschen ? 'endgültig löschen' : 'Archivieren',
    gefahr: loeschen,
    ausloeser: `[data-act="board-menue"][data-arg="${slug}"]`,
  };
}

/** Abbrechen des Bestätigungsdialogs (M2): Fokus zurück an den gemerkten Auslöser — nie BODY. */
function alAbbrechen() {
  const d = S.ui.alDialog;
  S.ui.alDialog = null;
  S.ui.fokus = d && d.ausloeser ? d.ausloeser : null;
  render();
}

/** Bestätigen (R00128 M4, R00141): `art` sagt, was zu tun ist; ein Fehler bleibt als `role=alert` **im Dialog** (B3),
    ohne Erfolgsmeldung und ohne Commit. */
async function alBestaetigen() {
  const d = S.ui.alDialog;
  if (!d) return;
  if (d.art === 'aufgabe-loeschen') return aufgabeLoeschenBestaetigen(d);
  const reihe = (S.zustand.boards || []).map(b => b.slug);
  try {
    if (d.art === 'board-loeschen') await durchDieSchlange(() => api('DELETE', `/api/boards/${encodeURIComponent(d.slug)}`));
    else await durchDieSchlange(() => api('PATCH', `/api/boards/${encodeURIComponent(d.slug)}`, { archiviert: true }));
  } catch (f) {
    S.ui.alDialog.fehler = f.message;
    S.ui.fokus = '#al-abbrechen';
    render();
    return;
  }
  S.ui.hinweis = { text: d.art === 'board-loeschen' ? `Board „${d.titel}“ endgültig gelöscht` : `Board „${d.titel}“ archiviert`, at: Date.now() };
  S.ui.alDialog = null;
  S.ui.fokus = naechsteBoardZeile(reihe, d.slug);
  render();
  render();
}

/** Auf dem Board sichtbare Karten in Spaltenfolge, ohne archivierte — die Nachbarschaft beim Verschwinden (B4). */
function kartenReihe() {
  return S.board ? S.board.spalten.flatMap(sp => sp.aufgaben).filter(n => { const a = aufgabe(n); return a && !a.archiviert; }) : [];
}

/** Fokus nach dem Verschwinden einer Karte (B4): die Karte, die ihre Stelle übernimmt, sonst die letzte, sonst ein
    benanntes Ersatzziel (`#t-board`) — nie BODY. */
function naechsteKarteNachLoeschen(index) {
  const jetzt = kartenReihe();
  if (!jetzt.length) return '#t-board';
  const stelle = Math.max(0, Math.min(index < 0 ? 0 : index, jetzt.length - 1));
  return [`.ka[data-id="${jetzt[stelle]}"]`, '#t-board'];
}

/** Die Rückfrage „endgültig löschen“ öffnen (R00141 B1/B2): dieselbe `alertdialog`-Komponente wie beim Board; Name,
    Rumpf und Bestätigungswort liefert der Aufrufer. `ausFenster` steuert, ob das Aufgabenfenster danach schließt (B4). */
function dialogAufgabeLoeschen(nr, ausFenster, ausloeser) {
  const a = aufgabe(nr);
  if (!a) return;
  const reihe = kartenReihe();
  S.ui.alDialog = {
    art: 'aufgabe-loeschen',
    nummer: nr,
    ausFenster,
    ausloeser,
    name: `#${nr} ${a.titel} endgültig löschen`,
    rumpf: `Aufgabe #${nr} „${esc(a.titel)}“ wird endgültig gelöscht: ihre Datei, ihre Zeile in allen Boards und ihre Anhänge verschwinden. Das ist nicht rückgängig zu machen; wiederherstellbar nur über die Git-Geschichte.`,
    bestaetigen: 'endgültig löschen',
    gefahr: true,
    reiheVorher: reihe,
    index: reihe.indexOf(nr),
  };
}

/** Endgültig löschen bestätigen (R00141): **ein** Commit; Fehler als `role=alert` im Dialog (B3); danach Fokus auf die
    nächste Karte (B4), aus der Fenster-Ansicht schließt das Fenster; **kein Undo** (B5). */
async function aufgabeLoeschenBestaetigen(d) {
  try {
    await durchDieSchlange(() => api('DELETE', `/api/aufgaben/${d.nummer}`));
  } catch (f) {
    S.ui.alDialog.fehler = f.message;
    S.ui.fokus = '#al-abbrechen';
    render();
    return;
  }
  if (d.ausFenster) S.ui.offen = null;
  S.ui.hinweis = { text: `#${d.nummer} endgültig gelöscht`, at: Date.now() };
  S.ui.alDialog = null;
  S.ui.fokus = naechsteKarteNachLoeschen(d.index);
  render();
  render();
}

/** Der Fokus nach dem Verschwinden einer Board-Zeile (M6): die nächste offene Zeile, sonst #t-board — nie BODY. */
function naechsteBoardZeile(reiheVorher, slug) {
  const uebrig = (S.zustand.boards || []).map(b => b.slug);
  const i = reiheVorher.indexOf(slug);
  const naechster = (i >= 0 ? reiheVorher.slice(i + 1) : reiheVorher).find(s => uebrig.includes(s)) || uebrig[0] || null;
  return naechster ? `[data-act="board-wahl"][data-arg="${naechster}"]` : '#t-board';
}

/** Ein archiviertes Board wieder öffnen (M5): PATCH {archiviert:false}; zurück in die offene Liste. */
async function boardWiederOeffnen(slug) {
  const titel = boardName(slug);
  try {
    await durchDieSchlange(() => api('PATCH', `/api/boards/${encodeURIComponent(slug)}`, { archiviert: false }));
  } catch (f) {
    S.ui.popFehler = f.message;
    render();
    return;
  }
  S.ui.hinweis = { text: `Board „${titel}“ wieder geöffnet`, at: Date.now() };
  S.ui.fokus = `[data-act="board-wahl"][data-arg="${slug}"]`;
  render();
  render();
}

/** Die Sperre der laufenden Auslöser (ADR-0025 Regel 1). Der Zustand liegt im Sichtzustand (`S.ui.laufend`) und
    übersteht das Neuzeichnen; er hängt nicht am DOM-Knoten. */
const sperre = sperreFuehren(S.ui.laufend);

/** Der Anker eines Auslösers: der nächste Knoten mit stabiler Kennung (Karte, Zeile, Teilaufgabe, Fenster) — sonst die Seite. */
function ankerVon(el) {
  for (let k = el; k && k !== document.body; k = k.parentElement) {
    const d = k.dataset || {};
    if (d.id || d.zeile != null || d.teil != null || k.id) return k;
  }
  return document.body;
}

/** Kennung des Ankers: Karte, Zeile und Teilaufgabe über ihre Nummer, sonst die id des Knotens. */
function ankerKennung(anker) {
  const d = anker.dataset || {};
  if (d.id) return `ka-${d.id}`;
  if (d.zeile != null) return `zeile-${d.zeile}`;
  if (d.teil != null) return `teil-${d.teil}`;
  return anker.id ? `#${anker.id}` : '#seite';
}

/** Kennung eines Auslösers aus dem getroffenen Element: Aktion und Ort in der gezeichneten Fläche (ADR-0025 Regel 1).
    Der Ort zählt den wievielten Auslöser derselben Aktion sein Anker trägt — das Argument zählt nicht mit. */
function ausloeserVon(el) {
  const anker = ankerVon(el);
  const gleichartige = [...anker.querySelectorAll(`[data-act="${CSS.escape(el.dataset.act)}"]`)];
  return ausloeserName({ aktion: el.dataset.act, anker: ankerKennung(anker), argument: el.dataset.arg }, gleichartige.indexOf(el));
}

/** Die Kennungen, unter denen ein Auslöser läuft (ADR-0025 Regel 1): die Aktion mit ihrem Argument — so fallen Knopf
    und Tastenkürzel derselben Aktion zusammen (Taste „a“ und Menüpunkt „Archivieren“, R00148 AK 12) — und, mit Element,
    sein Ort: die Kartenleiste schreibt ihr Argument beim Neuzeichnen um, ihr Ort bleibt (AK 5/6). Enter im Feld läuft
    unter Aktion, Argument und Wert. */
function ausloeserNamen(a, arg, el, wert) {
  if (wert !== undefined) return [aktionsName(a, arg, wert)];
  return el ? [aktionsName(a, arg), ausloeserVon(el)] : [aktionsName(a, arg)];
}

/** Läuft derselbe Auslöser schon? Knopf und Taste treffen jede laufende Füllung ihrer Aktion; Enter im Feld trifft den
    laufenden Knopf derselben Aktion und denselben Wert — nicht einen neuen Eintrag (R00148 AK 12, R00037). */
function ausloeserGesperrt(a, arg, el, wert) {
  const aktionOhneWert = aktionsName(a, arg);
  if (wert !== undefined) return sperre.laeuft(aktionOhneWert) || sperre.laeuft(aktionsName(a, arg, wert));
  return sperre.laeuftAktion(aktionOhneWert) || (el != null && sperre.laeuft(ausloeserVon(el)));
}

/** Zeigt den Sperrzustand am Knoten (ADR-0025 Regel 2): höchstens `aria-disabled="true"`, nie natives `disabled` —
    das nähme den Knoten aus der Tabreihenfolge und der Fokus fiele auf BODY (ADR-0010). Kein Neuzeichnen: ein Zeichnen
    hier verbrauchte das Fokusziel der Aktion (R00112 FA 8). */
function sperrenMarkieren() {
  for (const el of document.querySelectorAll('[data-act][aria-disabled]')) el.removeAttribute('aria-disabled');
  if (!sperre.namen().length) return;
  for (const el of document.querySelectorAll('[data-act]')) {
    if (ausloeserGesperrt(el.dataset.act, el.dataset.arg, el)) el.setAttribute('aria-disabled', 'true');
  }
}

/** Der zuletzt angenommene Klick: hat seine Aktion Schreibwirkung (`schreibt`), ist ein weiterer Klick derselben
    Geste (`detail > 1`) keine neue Handlung (R00148 AK 12/15). */
let letzterKlick = null;

async function act(a, arg, wert, el, detail) {
  // Ein Doppelklick auf einen Schreib-Auslöser ist eine Handlung: der zweite Klick derselben Geste trifft einen anderen
  // Knoten, wenn die schnelle Antwort die Stelle nachrücken ließ — er hat keine Wirkung (R00148 AK 6/11). Schreibwirkung
  // heißt: die Aktion des ersten Klicks hat eine Anfrage durch den Schreibweg gestellt (gesetzt in `warteschlange`) oder
  // einen Entwurf geändert (`entwurfGeaendert`) — keine Liste von Aktionen; ein Auslöser ohne Schreibwirkung (Blättern,
  // Aufklappen, Menü) nimmt jeden Klick an (AK 15).
  if (detail > 1 && letzterKlick && letzterKlick.schreibt) return;
  // Genau ein Auslöser je Aktion (ADR-0025 Regel 1): solange seine Anfrage läuft, hat derselbe Auslöser keine Wirkung —
  // auf jedem Weg: Klick, Enter im Feld, Tastenkürzel (AK 12).
  if (ausloeserGesperrt(a, arg, el, wert)) return;
  const namen = ausloeserNamen(a, arg, el, wert);
  const voriger = laufenderAusloeser;
  const laufender = laufenderAusloeser = { namen, anfrage: false, schreibt: false };
  if (detail > 0) letzterKlick = laufender;
  namen.forEach(sperre.starten);
  sperrenMarkieren();
  try {
    await aktion(a, arg, wert);
  } finally {
    laufenderAusloeser = voriger;
    // Eine Aktion ohne Anfrage endet mit dem Klick; hat sie eine, endet die Sperre mit deren Antwort (ADR-0025 Regel 2).
    if (!laufender.anfrage) sperreFreigeben(laufender);
  }
}

/** Der Rumpf der Aktion; Sperre und Freigabe umschließt `act`. */
async function aktion(a, arg, wert) {
  const u = S.ui;
  try {
    switch (a) {
      case 'pop': u.pop = u.pop === arg ? null : arg; u.popFehler = null; if (arg !== 'ich') u.ichNoetig = false; break;
      case 'seite': u.pop = null; if (location.hash === arg) break; location.hash = arg; return;
      case 'board-wahl': u.pop = null; location.hash = '#/board/' + arg; return;
      case 'board-neu': {
        const titel = (wert || '').trim();
        if (!titel) break;
        if (ichNoetig()) break;
        try {
          const r = await durchDieSchlange(() => api('POST', '/api/boards', { titel }));
          u.pop = null;
          location.hash = '#/board/' + r.board;
          return;
        } catch (f) { u.popFehler = f.message; u.fokus = '#board-neu'; break; }
      }
      case 'board-menue': u.popFehler = null; u.boardUmbenennen = null; u.boardMenue = u.boardMenue === arg ? null : arg; break;
      case 'board-umbenennen': u.boardMenue = null; u.boardUmbenennen = arg; u.boardUmbenennenWert = boardName(arg); u.popFehler = null; u.fokus = '#board-umbenennen'; break;
      case 'board-umbenennen-ab': u.boardUmbenennen = null; u.popFehler = null; u.fokus = `[data-act="board-wahl"][data-arg="${arg}"]`; break;
      case 'board-umbenennen-ok': return boardUmbenennen(arg, wert);
      case 'board-archivieren': u.boardMenue = null; u.fokus = null; u.alDialog = boardAlDialog('archivieren', arg); break;
      case 'board-loeschen': u.boardMenue = null; u.fokus = null; u.alDialog = boardAlDialog('loeschen', arg); break;
      case 'endgueltig-loeschen': {
        // Löschen darf jeder mit Identität — auch Agenten (ADR-0024); nur ohne gewählte Person fragt kanbanD nach.
        if (!S.ich) { ichNoetig(); break; }
        const nr = +arg;
        const ausFenster = u.offen === nr;
        u.menue = null;
        u.fensterMenue = null;
        u.fokus = null;
        // Aus dem Kopf-Menü kommt die Rückfrage über dem ⋮-Auslöser; Abbrechen gibt den Fokus dorthin zurück (R00144 FA 7).
        dialogAufgabeLoeschen(nr, ausFenster, ausFenster ? `[data-act="fenster-menue"][data-arg="aktionen"]` : `.ka[data-id="${nr}"]`);
        break;
      }
      case 'al-abbrechen': alAbbrechen(); break;
      case 'al-bestaetigen': return alBestaetigen();
      case 'board-wieder-oeffnen': return boardWiederOeffnen(arg);
      case 'ich': ichSetzen(arg); u.pop = null; u.ichNoetig = false; break;
      case 'add': {
        // arg: Spaltenname des aktuellen Boards, '' = erste Spalte, '-' = ohne Board
        if (ichNoetig()) break;
        const ohne = arg === '-' || !S.board || u.view !== 'board';
        const spalte = ohne ? '' : (arg || (S.board.spalten[0] || {}).name || '');
        u.offen = null; u.pop = null; u.menue = null;
        u.neu = { board: ohne ? '' : u.slug, spalte, schluessel: anlegeSchluessel(), titel: '', beschreibung: '', teil: [], klasse: '', zust: S.ich && per(S.ich).art === 'human' ? [S.ich] : [], labels: '', faellig: '', herkunft: '', fehler: null };
        u.fokus = '#neu-titel';
        break;
      }
      case 'nf-zu': case 'nf-zu-bg': u.neu = null; break;
      case 'nf-teil': { const t = (wert || '').trim(); if (t) u.neu.teil.push({ kennung: entwurfsKennung(), text: t }); u.fokus = '#neu-teil'; break; }
      case 'nf-teil-weg': u.neu.teil = u.neu.teil.filter(t => t.kennung !== arg); entwurfGeaendert(); u.fokus = '#neu-teil'; break;
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
        return durchDieSchlange(async () => {
          let r;
          try {
            r = await api('POST', `/api/boards/${encodeURIComponent(u.slug)}/bewegen`, bw);
          } catch (f) {
            // Aus dem offenen Aufgabenfenster gemeldet, steht die Ablehnung im Fuß des Fensters (R00146 FA 9, 403/409);
            // vom Board gezogen bleibt sie wie bisher in der Statuszeile. Das Laden nimmt die vorschnelle Bewegung zurück.
            if (!u.offen) { u.fehler = f.message; return; }
            fensterMelden(f.message);
            return;
          }
          if (u.offen && u.fensterFehler) meldungNachErfolgRaeumen();
          if (r.bewegt && vorher && !bw.rueckgaengig) u.hinweis = { text: `#${bw.nummer} nach „${bw.spalte}“`, undo: { art: 'bewegen', nummer: bw.nummer, ...vorher }, at: Date.now() };
          if (bw.rueckgaengig) u.hinweis = { text: `#${bw.nummer} zurück nach „${bw.spalte}“`, at: Date.now() };
          // Plausibilitätsprüfung (R00059): der Zug ist ausgeführt, die Warnung bleibt länger stehen
          if (r.warnungen && r.warnungen.length) u.hinweis = { text: `#${bw.nummer} nach „${bw.spalte}“`, warnungen: r.warnungen, at: Date.now(), dauer: 20000 };
        });
      }
      case 'oeffnen': if (zug != null) break; await fensterOeffnen(+arg); break;
      case 'zeit-korrigieren': {
        // arg: `nr|kennung` des Eintrags (R00114 FA 19) — der Editor wird nach dem Öffnen gesetzt, `fensterOeffnen` löscht ihn
        const [nummer, kennung] = String(arg).split('|');
        if (zug != null) break;
        await fensterOeffnen(+nummer);
        // geprüft wird an der eben geladenen Datei, nicht am vielleicht veralteten Stand des Boards (FA 19)
        const eintrag = (u.datei || { zeiten: [] }).zeiten.find(z => z.kennung === kennung);
        if (!eintrag) { fensterMelden('Der Zeiteintrag ist nicht mehr da.'); break; }
        u.tab = 'zeiten';
        u.zeitEdit = kennung;
        u.fokus = '#z-beginn';
        break;
      }
      case 'schliessen': case 'schliessen-bg': u.offen = null; u.fensterMenue = null; u.datei = null; u.offenDefekt = null; u.defektDatei = null; u.entwurf = null; break;
      case 'schliessen-hilfe': u.hilfe = false; break;
      case 'hilfe': u.hilfe = true; break;
      case 'defekt-oeffnen': u.pop = null; u.offenDefekt = +arg; await defektLaden(); break;
      case 'fenster-menue': {
        // Höchstens ein Kopf-Menü offen (R00145 FA 7, R00144 FA 6): das andere schließt, der Fokus folgt dem neuen Menü.
        u.fensterMenue = u.fensterMenue === arg ? null : arg;
        // Beide Menüs sind dieselbe Fokus-Ebene (`fenstermenue`): ein Wechsel gilt der Ebene nicht als neues Öffnen,
        // deshalb merkt sie ihren Auslöser hier. Sonst gäbe sie den Fokus später an das zuerst geöffnete Menü zurück (B1).
        if (u.fensterMenue) gemerkteAusloeser.fenstermenue = `#fenster [data-act="fenster-menue"][data-arg="${arg}"]`;
        else u.fokus = `#fenster [data-act="fenster-menue"][data-arg="${arg}"]`;
        break;
      }
      case 'fenster-ansicht': {
        // Wahl aus dem Menü (R00145 FA 7): Menü zu, Fokus am Auslöser, der die neue Ansicht nennt.
        u.tab = arg;
        u.fensterMenue = null;
        // Der Fokus geht über die Ebene zurück an den Auslöser: der gewählte Eintrag verschwindet mit dem Menü, und
        // `geschlossen.rueckgabe` trägt den Auslöser, der das Menü geöffnet hat (ADR-0010, R00145 FA 7).
        // Verlauf (R00123): beim Öffnen leeren und laden — nie Zeilen der vorigen Aufgabe
        if (arg === 'verlauf') { u.verlauf = null; u.verlaufFehler = null; render(); await dateiLaden(); }
        break;
      }
      case 'teil-karte': {
        if (ichNoetig()) break;
        const [nr, i] = arg.split('|').map(Number);
        aufgabe(nr).teilaufgaben[i].erledigt = true;
        u.fokusKarte = nr;
        // Lag der Fokus auf dem Abhaken der nächsten Teilaufgabe, bleibt er dort und trifft die nächste offene;
        // ohne sie führt fokusKarte (R00108)
        const fokusAufNaechsterTeilaufgabe = Boolean(document.activeElement && document.activeElement.matches('.naechste-ziel'));
        if (fokusAufNaechsterTeilaufgabe) u.fokus = `.ka[data-id="${nr}"] .naechste-ziel`;
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
        // Mit Enter gespeichert: zurück auf den Text; beim Verlassen per Klick bleibt der Fokus, wo er hingeht
        if (e && document.activeElement === $('#teil-edit')) u.fokus = textDerTeilaufgabe(e.i);
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
      case 'teil-weg': {
        if (ichNoetig()) break;
        // Gemerkt vor dem Senden aus dem gezeigten Stand (R00112 AK 1): Text, Haken und Stelle
        const t = aufgabe(u.offen).teilaufgaben[Number(arg)];
        const undo = { art: 'teilaufgabe', nummer: u.offen, text: t.text, erledigt: t.erledigt, position: Number(arg) };
        // Die Teilaufgaben tragen ihre Stelle als Argument: der Nachbar heißt nach dem Entfernen so wie seine neue Stelle
        let nachbar = null;
        const stelle = nachbarNachEntfernen(aufgabe(u.offen).teilaufgaben.length, Number(arg));
        if (stelle >= 0) nachbar = String(stelle);
        fokusNachEntfernen('teil-weg', arg, nachbar, '#teil-neu');
        await schreiben('DELETE', `/api/aufgaben/${u.offen}/teilaufgaben/${arg}`);
        if (!u.fensterFehler) u.hinweis = { text: `Teilaufgabe „${t.text}“ entfernt`, undo, feld: '#teil-neu', at: Date.now() };
        break;
      }
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
      case 'start': if (ichNoetig()) break; u.tab = 'zeiten'; timerStartMerken(`${arg}|${S.ich}`, Date.now()); await schreiben('POST', `/api/aufgaben/${arg}/timer/start`); return;
      case 'stop': {
        if (ichNoetig()) break;
        u.tab = 'zeiten';
        const [nr, wer] = arg.split('|');
        await schreiben('POST', `/api/aufgaben/${nr}/timer/stop`, { wer });
        return;
      }
      case 'archiv-an': filterSetzen((u.filter.replace(/is:\S+\s*/g, '') + ' is:archived').trim()); u.offen = null; break;
      case 'archiv-aus': filterSetzen(u.filter.replace(/is:\S+\s*/g, '').trim()); u.offen = null; break;
      case 'bereich': u.bereich = arg; merken('kanbanD.bereich', arg); break;
      case 'signale-oben': u.signaleOben = !u.signaleOben; try { localStorage.setItem('kanbanD.signale-oben', u.signaleOben ? '1' : '0'); } catch (_) { } break;
      case 'legende': filterSetzen(klasseUmschalten(u.filter, arg)); break;
      case 'signal-filter': filterSetzen(signalUmschalten(u.filter, arg)); break;
      case 'signal-aus': case 'signal-fenster': {
        // Karte: Klick auf die Fackel nimmt zurück; Fenster: Schalter setzt oder nimmt zurück (R00076)
        const [nr, s] = a === 'signal-aus' ? arg.split('|') : [u.offen, arg];
        if (ichNoetig()) break;
        const an = a === 'signal-fenster' && !(aufgabe(+nr).signale || []).includes(s);
        return schreiben(an ? 'PUT' : 'DELETE', `/api/aufgaben/${nr}/signale/${encodeURIComponent(s)}`);
      }
      // R00087: freigeben als die gewählte Person (Mensch) — der Server erlaubt das für jede Reservierung
      case 'freigeben': if (ichNoetig()) break; await schreiben('DELETE', `/api/aufgaben/${arg}/reservierung`); return;
      case 'alle-freigeben': {
        if (ichNoetig()) break;
        // Ein Auslöser, eine Aktion: alle Anfragen in einem Glied der Schlange — die Sperre endet erst mit der letzten Antwort
        await durchDieSchlange(async () => {
          for (const { a } of reservierteDesBoards()) await api('DELETE', `/api/aufgaben/${a.nummer}/reservierung`).catch(f => { fensterMelden(f.message); });
        });
        render();
        return;
      }
      case 'archivieren': {
        if (ichNoetig()) break;
        // Aus dem ⋮-Menü bleibt das Fenster offen (R00144 AK: Fokus zurück am ⋮) und zeigt die Archivleiste; sonst schließt es wie heute.
        const ausKopfMenue = Boolean(u.fensterMenue);
        if (ausKopfMenue) { u.fensterMenue = null; u.fokus = '#fenster [data-act="fenster-menue"][data-arg="aktionen"]'; }
        await schreiben('POST', `/api/aufgaben/${arg}/archivieren`);
        if (!u.fensterFehler) { if (!imArchiv() && !ausKopfMenue) u.offen = null; u.hinweis = { text: `#${arg} archiviert · archived: in der Datei, laufende Timer gestoppt`, undo: { art: 'zurueckholen', nummern: [+arg] }, at: Date.now() }; }
        break;
      }
      case 'rueckgaengig': {
        const h = u.hinweis;
        if (!h || !h.undo || ichNoetig()) break;
        u.hinweis = null;
        const z = h.undo;
        if (z.art === 'bewegen') return act('bewegen', JSON.stringify({ nummer: z.nummer, spalte: z.spalte, index: z.index, rueckgaengig: true }));
        if (z.art === 'ziele') return zieleSenden(z.ziele, null, `${z.ziele.length} Karten zurückgelegt`);
        if (z.art === 'legen') {
          await rueckgaengigSenden('POST', `/api/boards/${encodeURIComponent(z.slug)}/aufgaben`, { nummer: z.nummer, spalte: z.spalte, index: z.index }, `#${z.nummer} wieder auf „${z.titel}“ · Spalte ${z.spalte}`, () => [knopfSelektor('abnehmen', `${z.slug}|${z.nummer}`), `tr[data-zeile="${z.nummer}"]`]);
          break;
        }
        if (z.art === 'anhang') {
          await anhangZuruecklegen(z);
          break;
        }
        if (z.art === 'teilaufgabe') {
          // Der Server legt sie an `position`, hinter dem Ende ans Ende
          const stelle = Math.min(z.position, aufgabe(z.nummer).teilaufgaben.length);
          await rueckgaengigSenden('POST', `/api/aufgaben/${z.nummer}/teilaufgaben`, { text: z.text, position: z.position, erledigt: z.erledigt }, `Teilaufgabe „${z.text}“ wiederhergestellt`, gelungen => teilFokus(gelungen, stelle));
          break;
        }
        if (z.art === 'zeit') {
          await rueckgaengigAusfuehren(() => zeitZuruecklegen(z), () => `${zeitBeschrieben(z)} wiederhergestellt`, () => [knopfSelektor('zeit-weg', z.kennung), '#zeit-neu']);
          break;
        }
        await schreiben('POST', `/api/aufgaben/${z.art}`, { nummern: z.nummern });
        u.hinweis = { text: z.art === 'archivieren' ? `${z.nummern.length === 1 ? '#' + z.nummern[0] : z.nummern.length + ' Aufgaben'} archiviert` : `#${z.nummern[0]} zurückgeholt`, at: Date.now() };
        break;
      }
      case 'zurueckholen': {
        if (ichNoetig()) break;
        if (u.fensterMenue) { u.fensterMenue = null; u.fokus = '#fenster [data-act="fenster-menue"][data-arg="aktionen"]'; }
        await schreiben('POST', `/api/aufgaben/${arg}/zurueckholen`);
        if (!u.fensterFehler) u.hinweis = { text: `#${arg} zurückgeholt`, at: Date.now() };
        break;
      }
      case 'p-bereich': u.pBereich = arg; break;
      case 'sp': u.sp = arg; break;
      case 'dus-einheit': u.dusEinheit = arg; break;
      case 'dl-vorgabe': durchlaufAmGeraetMerken({}); u.fokus = 'select[data-dl="dlBis"]'; break;
      case 'woche': u.wochenVersatz = (u.wochenVersatz || 0) + +arg; break;
      case 'bf-farbe': await berichtsfilterSetzen({ ohneFarben: umschalten(u.bf.ohneFarben, arg) }); break;
      case 'bf-spalte': await berichtsfilterSetzen({ ohneSpalten: umschalten(u.bf.ohneSpalten, arg) }); break;
      case 'bf-person': await berichtsfilterSetzen({ personen: umschalten(u.bf.personen, arg) }); break;
      case 'bf-label': await berichtsfilterSetzen({ labels: umschalten(u.bf.labels, arg) }); break;
      case 'tf-bearbeiten': { const t = S.board.termine[+arg]; u.tf = { i: +arg, ...t }; u.tfFehler = null; u.fokus = '[data-tf="name"]'; break; }
      case 'tf-abbrechen': u.tf = { ...TERMIN_LEER }; u.tfFehler = null; break;
      case 'tf-ziel': {
        if (ichNoetig()) break;
        return termineSchreiben(S.board.termine.map((t, i) => ({ ...t, ziel: i === +arg && !t.ziel })));
      }
      case 'fb-setzen': {
        if (ichNoetig()) break;
        const b = S.board;
        if (arg === 'start') {
          try { await durchDieSchlange(() => api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/start`, { start: wert || null })); u.fbFehler = null; } catch (f) { u.fbFehler = f.message; }
          render();
          return;
        }
        if (arg === 'ziel') return termineSchreiben(b.termine.map((t, i) => ({ ...t, ziel: wert !== '' && i === +wert })));
        return fieberEinstellen(stand => {
          const f = { ...stand, gelb: [...stand.gelb], rot: [...stand.rot] };
          if (arg === 'puffer') f.puffer = wert === '' ? null : Math.max(1, Math.round(+wert));
          else if (arg === 'perzentil' || arg === 'woche' || arg === 'aufloesung') f[arg] = +wert;
          else if (arg === 'zielspalte' || arg === 'vonspalte') f[arg] = wert || null;
          else f[arg.slice(0, -1)][+arg.slice(-1)] = Math.max(0, Math.round(+wert));
          return f;
        });
      }
      case 'fb-vorschlag': {
        if (ichNoetig()) break;
        const st = fieberStand();
        if (!st || !st.e.ziel) break;
        return fieberEinstellen(stand => ({ ...stand, puffer: pufferVorschlag(dauerIn(stand.woche, st.start, st.e.ziel)) }));
      }
      case 'fb-verwerfen': {
        try { await durchDieSchlange(() => api('DELETE', `/api/boards/${encodeURIComponent(u.slug)}/fieber/cache`)); u.fbFehler = null; } catch (f) { u.fbFehler = f.message; }
        u.fieberNeu = null; u.fieberLauf = null;
        render();
        return;
      }
      case 'tf-entfernen': {
        if (ichNoetig()) break;
        return termineSchreiben(S.board.termine.filter((_, i) => i !== +arg));
      }
      case 'tf-speichern': {
        if (ichNoetig()) break;
        const f = u.tf, neu = { name: f.name.trim(), datum: f.datum, farbe: f.farbe, linie: f.linie, staerke: f.staerke, ziel: !!f.ziel };
        if (!neu.name) { u.tfFehler = 'Der Termin braucht einen Namen'; break; }
        if (!neu.datum) { u.tfFehler = 'Der Termin braucht ein Datum'; break; }
        const liste = S.board.termine.slice();
        if (f.i == null) liste.push(neu); else liste[f.i] = neu;
        return termineSchreiben(liste, true);
      }
      case 'bf-leeren': u.fokus = '.bf-zusammen'; await berichtsfilterSetzen(filterZuruecksetzen(u.bf, BERICHTSLEISTEN[arg])); break; // der Knopf verschwindet mit dem Filter: Fokus auf die Zusammenfassung (ADR-0010)
      case 'still-auch': u.stillAuch = !u.stillAuch; break;
      case 'bestand-tauschen': return bestandAchsenSetzen('tauschen');
      case 'bestand-zelle': filterSetzen(arg); u.bereich = 'alle'; location.hash = '#/board/' + (u.slug || ''); return;
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
        return durchDieSchlange(async () => {
          try { await api('PATCH', `/api/wbs/${encodeURIComponent(wbsKuerzel())}/knoten/${encodeURIComponent(id)}`, { status }); }
          catch (f) { u.hinweis = { text: `${id} nicht gesetzt: ${f.message}`, at: Date.now() }; }
          u.fokus = `#wbs-st-${id}`;
        });
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
          const r = await durchDieSchlange(() => api('POST', `/api/wbs/${encodeURIComponent(wbsKuerzel())}/knoten`, { ebene: f.ebene, eltern: f.eltern, name: f.name, fertig_kriterium: f.fertig_kriterium, eingabe_ausgabe: bubble ? f.eingabe_ausgabe : '', aufwand: bubble ? f.aufwand : '' }));
          u.pop = null; u.wbsNeu = null;
          u.hinweis = { text: `${r.id} angelegt · WBS-Datei nicht committet`, at: Date.now() };
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
          await durchDieSchlange(() => api('POST', `/api/wbs/${encodeURIComponent(wbsKuerzel())}/knoten/${encodeURIComponent(arg)}/verwerfen`, { grund }));
          u.hinweis = { text: `${arg} verworfen · WBS-Datei nicht committet`, at: Date.now() };
        } catch (f) { u.hinweis = { text: `${arg} nicht verworfen: ${f.message}`, at: Date.now() }; }
        render();
        return;
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
        return durchDieSchlange(async () => {
          try { await api('PATCH', `/api/aufgaben/${u.offen}/wbs-effects`, wirkungEingabe(f)); }
          catch (fehler) { f.fehler = fehler.message; u.fokus = f.action === 'create' ? '#wirkung-parent' : '#wirkung-node'; return; }
          u.wirkungNeu = null; gespeichertMelden();
        });
      }
      case 'wirkung-eintritt': {
        if (ichNoetig()) break;
        const [i, an] = arg.split('|');
        return durchDieSchlange(async () => {
          try { await api('POST', `/api/aufgaben/${u.offen}/wbs-effects/${i}/eintritt`, { an: an === 'true' }); gespeichertMelden(); }
          catch (fehler) { fensterMelden(fehler.message); }
        });
      }
      case 'wirkung-weg': {
        if (ichNoetig()) break;
        return durchDieSchlange(async () => {
          try { await api('DELETE', `/api/aufgaben/${u.offen}/wbs-effects/${arg}`); gespeichertMelden(); }
          catch (fehler) { fensterMelden(fehler.message); }
        });
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
        const platz = platzAufBoard(slug, +nr);
        const zeile = `tr[data-zeile="${nr}"]`;
        fokusNachEntfernen('abnehmen', arg, nachbarArgument(zeile, 'abnehmen', arg), zeile);
        await schreiben('DELETE', `/api/boards/${encodeURIComponent(slug)}/aufgaben/${nr}`);
        if (!u.fensterFehler && platz) u.hinweis = { text: `#${nr} von „${platz.titel}“ genommen`, undo: platz, at: Date.now() };
        break;
      }
      case 'anhang-weg': {
        if (ichNoetig()) break;
        // Erst lesen, dann löschen (ADR-0017 Regel 3): ohne gelesenen Inhalt gibt es kein Rückgängig, also auch kein Löschen
        const nummer = u.offen, pfad = `/api/aufgaben/${nummer}/anhaenge/${encodeURIComponent(arg)}`;
        u.anhangLiest = arg;
        render();
        let blob;
        try { blob = await anhangLesen(pfad); } catch (f) { fensterMelden(`Anhang „${arg}“ nicht entfernt: ${f.message}`); u.fokus = knopfSelektor('anhang-weg', arg); break; } finally { u.anhangLiest = null; }
        // Ohne Nachbarn bleibt der Fokus beim Fenster: die Dateiwahl ist kein tabbares Feld
        fokusNachEntfernen('anhang-weg', arg, nachbarArgument('#anhaenge', 'anhang-weg', arg), null);
        await schreiben('DELETE', pfad);
        if (!u.fensterFehler) u.hinweis = { text: `Anhang „${arg}“ entfernt`, undo: { art: 'anhang', nummer, name: arg, blob }, at: Date.now() };
        break;
      }
      case 'herkunft-neu': {
        if (!(wert || '').trim() || ichNoetig()) break;
        const a = aufgabe(u.offen), alt = a.herkunft.filter(x => x !== 'thin air');
        u.fokus = '#herkunft-neu';
        // eine abgelehnte Eingabe bleibt im Feld stehen, damit man sie berichtigen kann
        entwurfAbschicken(HERKUNFT_FELD, wert);
        const gelungen = await aufgabeAendern(u.offen, { herkunft: istOhneHerkunft(wert) ? ['thin air'] : [...alt, wert.trim()] }, HERKUNFT_FELD);
        if (gelungen) u.entwurf = null;
        render();
        return;
      }
      case 'herkunft-weg': {
        if (ichNoetig()) break;
        const a = aufgabe(u.offen);
        return aufgabeAendern(u.offen, { herkunft: a.herkunft.filter((_, j) => j !== +arg) });
      }
      case 'zeit-neu': {
        if (!(wert || '').trim() || ichNoetig()) break;
        u.tab = 'zeiten'; u.fokus = '#zeit-neu';
        // eine abgelehnte Eingabe bleibt im Feld stehen, damit man sie berichtigen kann
        entwurfAbschicken(ZEIT_FELD, wert);
        await schreiben('POST', `/api/aufgaben/${u.offen}/zeiten`, { dauer: wert }, ZEIT_FELD);
        return;
      }
      case 'zeit-edit': u.tab = 'zeiten'; u.zeitEdit = arg; u.fokus = '#z-beginn'; break;
      case 'zeit-ok': {
        if (ichNoetig()) break;
        const ende = $('#z-ende');
        const korrektur = { beginn: $('#z-beginn').value.trim(), ...(ende ? { ende: ende.value.trim() } : {}) };
        u.zeitEdit = null;
        await schreiben('PATCH', `/api/aufgaben/${u.offen}/zeiten/${encodeURIComponent(arg)}`, korrektur);
        return;
      }
      case 'zeit-weg': {
        if (ichNoetig()) break;
        // Gemerkt vor dem Senden aus dem gezeigten Stand (R00112 AK 1): POST …/zeiten vergibt dieselbe Kennung
        const z = aufgabe(u.offen).zeiten.find(x => x.kennung === arg);
        const undo = { art: 'zeit', nummer: u.offen, kennung: arg, wer: z.wer, beginn: z.beginn, ende: z.ende };
        fokusNachEntfernen('zeit-weg', arg, nachbarArgument('#fenster .zt', 'zeit-weg', arg), '#zeit-neu');
        await schreiben('DELETE', `/api/aufgaben/${u.offen}/zeiten/${encodeURIComponent(arg)}`);
        if (!u.fensterFehler) u.hinweis = { text: `${zeitBeschrieben(undo)} gelöscht`, undo, feld: '#zeit-neu', at: Date.now() };
        break;
      }
      case 'spalte-archivieren': {
        if (ichNoetig()) break;
        const nummern = S.board.spalten.find(sp => sp.name === arg).aufgaben.filter(n => { const a = aufgabe(n); return a && !a.archiviert; });
        try {
          const geaendert = await durchDieSchlange(() => api('POST', '/api/aufgaben/archivieren', { nummern }));
          u.hinweis = { text: `${geaendert.length} ${geaendert.length === 1 ? 'Karte' : 'Karten'} aus „${arg}“ archiviert`, undo: { art: 'zurueckholen', nummern: geaendert }, at: Date.now() };
        } catch (f) { u.fehler = f.message; }
        render();
        return;
      }
      case 'spalte-schieben': {
        if (ichNoetig()) break;
        const [i, d] = arg.split('|').map(Number);
        const neu = S.board.spalten.map(sp => ({ name: sp.name, alt: sp.name, grenze: sp.grenze || null }));
        [neu[i], neu[i + d]] = [neu[i + d], neu[i]];
        try { await durchDieSchlange(() => api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/spalten`, neu)); } catch (f) { u.fehler = f.message; }
        render();
        return;
      }
      case 'verschieben': { const [nr, spalte] = arg.split('|'); u.fokusKarte = +nr; return act('bewegen', JSON.stringify({ nummer: +nr, spalte, index: 9999 })); }
      case 'klasse-setzen': { const [nr, k] = arg.split('|'); if (ichNoetig()) break; return aufgabeAendern(+nr, { klasse: k || null }); }
      case 'faellig-karte': {
        const [nr, n] = arg.split('|');
        if (ichNoetig()) break;
        const d = new Date(); d.setDate(d.getDate() + (+n || 0));
        return aufgabeAendern(+nr, { faellig: n === '' ? null : isoD(d) });
      }
      case 'duplizieren': {
        // Kopie der Karte in derselben Spalte (R00142); kein Zwischendialog, die Kopie ist die Quelle plus Zusatz
        if (ichNoetig()) break;
        const nr = +arg;
        const spalte = S.board && (S.board.spalten.find(sp => sp.aufgaben.includes(nr)) || {}).name;
        const ziel = S.board && spalte ? { board: S.board.slug, spalte } : {};
        // der Fokus bleibt auf der Quellkarte, auch wenn die Kopie unten in der Spalte erscheint (S2)
        u.fokusKarte = nr;
        u.fokus = `.ka[data-id="${nr}"]`;
        try {
          const kopie = await durchDieSchlange(() => api('POST', `/api/aufgaben/${nr}/duplizieren`, ziel));
          u.hinweis = { text: `#${kopie.nummer} „${kopie.titel}“ angelegt`, undo: { art: 'archivieren', nummern: [kopie.nummer] }, at: Date.now() };
        } catch (f) { u.hinweis = { text: f.message, at: Date.now() }; }
        render();
        return;
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
          const geaendert = await durchDieSchlange(() => api('POST', '/api/aufgaben/archivieren', { nummern: nummernAus(arg) }));
          u.auswahl = [];
          u.hinweis = { text: `${geaendert.length} ${geaendert.length === 1 ? 'Karte' : 'Karten'} archiviert`, undo: { art: 'zurueckholen', nummern: geaendert }, at: Date.now() };
        } catch (f) { u.fehler = f.message; }
        render();
        return;
      }
      case 'mich': {
        if (ichNoetig()) break;
        const a = aufgabe(+arg), z = a.zustaendige.includes(S.ich) ? a.zustaendige.filter(k => k !== S.ich) : [...a.zustaendige, S.ich];
        u.tab = 'details';
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
      case 'beschreibung-bearbeiten': u.tab = 'inhalt'; u.beschreibungBearbeiten = true; u.fokus = '#beschreibung'; break;
      case 'eingabe-verwerfen': eingabeVerwerfenPerKnopf(); return;
      case 'titel-bearbeiten': u.tab = 'inhalt'; u.titelBearbeiten = true; u.fokus = '[data-af="titel"]'; break;
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
      case 'setup': u.pop = null; u.setup = { spalten: S.board.spalten.map((sp, i) => ({ name: sp.name, alt: sp.name, grenze: sp.grenze || '', n: sp.aufgaben.length, pruefungen: [...(sp.pruefungen || [])], notiz: sp.notiz || '', farbe: sp.farbe || '', eigentuemer: sp.eigentuemer || (sp.eigentuemer_unbekannt ? 'roh' : ''), eigentuemerAlt: sp.eigentuemer || (sp.eigentuemer_unbekannt ? 'roh' : ''), roh: sp.eigentuemer_unbekannt || '', datumsTrenner: sp.datums_trenner == null ? i === S.board.spalten.length - 1 : sp.datums_trenner })), anwendungen: S.board.anwendungen == null ? null : [...S.board.anwendungen] }; break;
      case 'bind': u.setup.anwendungen = bindungUmschalten(u.setup.anwendungen, arg, S.zustand.einstellungen.quellen.anwendungen || []); break;
      case 'col-pruef': { const sp = u.setup.spalten[+arg]; sp.pruefungen = umschalten(sp.pruefungen, 'wbs-effects-green'); break; }
      case 'col-dates': { const sp = u.setup.spalten[+arg]; sp.datumsTrenner = !sp.datumsTrenner; break; }
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
      case 'a-del': u.einr.quellen.anwendungen.splice(+arg, 1); entwurfGeaendert(); break;
      case 'k-pal': u.palFuer = u.palFuer === +arg ? null : +arg; break;
      case 'k-farbe': { const [i, f] = arg.split('|'); u.einr.klassen[+i].farbe = f; break; }
      case 'k-del': u.einr.klassen.splice(+arg, 1); entwurfGeaendert(); u.palFuer = null; break;
      case 'k-add': {
        const schluessel = ($('#nck').value || '').trim().toLowerCase(), bezeichnung = (wert || '').trim();
        if (!schluessel || !bezeichnung) { u.einr.fehler = 'Schlüssel und Bezeichnung nötig'; break; }
        const belegt = u.einr.klassen.map(k => k.farbe);
        u.einr.klassen.push({ schluessel, bezeichnung, farbe: PAL.find(f => !belegt.includes(f)) || 'grey' });
        u.fokus = '#nck';
        break;
      }
      case 's-pal': u.sPalFuer = u.sPalFuer === +arg ? null : +arg; break;
      case 's-farbe': { const [i, f] = arg.split('|'); u.einr.signale[+i].farbe = f; break; }
      case 's-del': u.einr.signale.splice(+arg, 1); entwurfGeaendert(); u.sPalFuer = null; break;
      case 's-add': {
        const schluessel = ($('#nsk').value || '').trim().toLowerCase(), bezeichnung = (wert || '').trim();
        if (!schluessel || !bezeichnung) { u.einr.fehler = 'Schlüssel und Bedeutung nötig'; break; }
        if (schluessel === 'due') { u.einr.fehler = '„due“ ist das Signal der Fälligkeit und wird gerechnet'; break; }
        u.einr.signale = u.einr.signale || [];
        const belegt = u.einr.signale.map(g => g.farbe);
        u.einr.signale.push({ schluessel, bezeichnung, farbe: PAL.find(f => !belegt.includes(f)) || 'grey' });
        u.einr.fehler = null; u.fokus = '#nsk';
        break;
      }
      case 'einr-weg': u.einr = kopie(S.zustand.einstellungen); u.palFuer = null; u.sPalFuer = null; break;
      case 'einr-ok': {
        if (ichNoetig()) break;
        const { fehler, gespeichert, ...daten } = u.einr;
        try {
          await durchDieSchlange(() => api('PUT', '/api/einstellungen', daten));
          u.einr = null; u.palFuer = null;
          // Das Neuladen legt die Einrichtungsansicht neu an (sichtFolgen) — erst danach trägt sie „gespeichert“.
          await laden();
          u.einr.gespeichert = true;
          render();
          break;
        } catch (f) { u.einr.fehler = f.message; break; }
      }
      case 'col-l': case 'col-r': {
        const d = u.setup.spalten, i = +arg, j = a === 'col-l' ? i - 1 : i + 1;
        if (j >= 0 && j < d.length) [d[i], d[j]] = [d[j], d[i]];
        break;
      }
      case 'col-del': u.setup.spalten.splice(+arg, 1); entwurfGeaendert(); break;
      case 'thema': {
        S.thema = THEMEN[(THEMEN.indexOf(S.thema) + 1) % THEMEN.length];
        themaAnwenden(S.thema);
        try { localStorage.setItem('kanbanD.thema', S.thema); } catch (_) { }
        break;
      }
      case 'vollbild': vollbildSetzen(!u.vollbild); break;
      case 'spalte-zu': spalteKlappen(arg, true); break;
      case 'spalte-auf': spalteKlappen(arg, false); break;
      case 'col-farbe-weg': u.setup.spalten[+arg].farbe = ''; break;
      case 'col-add': {
        const name = (wert || '').trim();
        if (!name) break;
        const d = u.setup.spalten;
        d.splice(Math.max(0, d.length - 1), 0, { name, alt: null, grenze: '', n: 0, pruefungen: [], notiz: '', farbe: '', datumsTrenner: false });
        u.fokus = '#col-new';
        break;
      }
      case 'setup-ok': {
        if (ichNoetig()) break;
        return durchDieSchlange(async () => {
          try {
            // Datums-Trenner (R00124): nur senden, wenn mindestens eine Spalte vom Positions-Standard abweicht —
            // ein bloßes Speichern ohne Änderung bleibt byte-gleich (nur Abweichendes, wie column-checks/column-colors)
            const letzteSpalte = u.setup.spalten.length - 1;
            const trennerAbweichend = u.setup.spalten.some((sp, i) => sp.datumsTrenner !== (i === letzteSpalte));
            await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/spalten`, u.setup.spalten.map((sp, i) => ({ name: sp.name.trim(), alt: sp.alt, grenze: +sp.grenze > 0 ? +sp.grenze : null, pruefungen: sp.pruefungen, notiz: sp.notiz, farbe: sp.farbe, ...(trennerAbweichend ? { datums_trenner: sp.datumsTrenner } : {}), ...(eigentuemerGeaendert(sp) ? { eigentuemer: sp.eigentuemer === 'roh' ? null : (sp.eigentuemer || null) } : {}) })));
            if (u.setup.anwendungen && JSON.stringify(u.setup.anwendungen) !== JSON.stringify(S.board.anwendungen)) await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/anwendungen`, u.setup.anwendungen);
            u.setup = null;
          } catch (f) { u.setup.fehler = f.message; }
        });
      }
      case 'fr-agent': u.first.agenten[arg] = !u.first.agenten[arg]; break;
      case 'first-ok': {
        const f = u.first, e = ersteEinstellungen(f);
        const antwort = await durchDieSchlange(() => api('POST', '/api/einrichten', {
          ich: { kuerzel: e.personen[0].kuerzel, name: e.personen[0].name },
          agenten: e.personen.slice(1).map(p => ({ kuerzel: p.kuerzel, name: p.name })),
          board: f.board.trim(), spalten: spaltenListe(f), quellen: e.quellen,
        }));
        ichSetzen(e.personen[0].kuerzel);
        location.hash = '#/board/' + antwort.board;
        return;
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
/** Die Führung folgt dem echten Fokus: auch eine per Tab, Klick oder Skript fokussierte Karte bzw. Zeile ist nach
 *  dem nächsten Neuzeichnen — etwa durch ein Live-Ereignis — wieder das Ziel (R00106, Karte #8 M2). */
function fuehrungNachziehen(element) {
  if (!element.matches) return;
  if (element.matches('.ka[data-id]')) S.ui.fokusKarte = +element.dataset.id;
  else if (element.matches('tr[data-zeile]')) S.ui.fokusZeile = +element.dataset.zeile;
}
document.addEventListener('focusin', e => fuehrungNachziehen(e.target));
document.addEventListener('focusin', () => fokusAusDemHinweis());
document.addEventListener('focusout', e => {
  // Ersetzen ist kein Verlassen; ein Feld mit Entwurf, dessen Fokus auf „Eingabe verwerfen“ geht, ist noch nicht verlassen (R00155 54-13)
  if (!S.neuzeichnen && wartetAufVerwerfen(e.target, e.relatedTarget)) return;
  if (!S.neuzeichnen && istVerwerfenKnopf(e.target) && feldVorDemVerwerfen) {
    // zurück ins selbe Feld: es wurde nie verlassen
    if (e.relatedTarget === feldVorDemVerwerfen) feldVorDemVerwerfen = null;
    else verlassenNachholen();
    return;
  }
  feldVerlassen(e.target);
});
function feldVerlassen(feld) {
  // Verlassen eines Felds meldet den getippten Wert nach, für den noch kein „change“ gewirkt hat (R00103, R00155 54-13)
  if (!S.neuzeichnen) aenderungNachtragen(feld);
  // Verlassen ohne Änderung: wieder formatiert zeigen (mit Änderung sorgt „change“ dafür).
  if (feld.id === 'beschreibung' && S.ui.beschreibungBearbeiten) setTimeout(() => { if (S.ui.beschreibungBearbeiten && document.activeElement !== $('#beschreibung')) { S.ui.beschreibungBearbeiten = false; fokusNachBeschreibung(); render(); } }, 50);
  // Verlassen des Titelfeldes ohne Änderung: wieder das Lesediv zeigen (R00116, Muster Beschreibung :1708)
  if (feld.dataset && feld.dataset.af === 'titel' && S.ui.titelBearbeiten) setTimeout(() => {
    const titelWartetAufBerichtigung = entwurfswert(S.ui.entwurf, S.ui.offen, TITEL_FELD) !== null;
    if (S.ui.titelBearbeiten && !titelWartetAufBerichtigung && document.activeElement !== document.querySelector('#fenster [data-af="titel"]')) { S.ui.titelBearbeiten = false; render(); }
  }, 50);
  // Verlassen des Teilaufgaben-Feldes speichert (R00066); nach Enter oder Esc ist teilEdit schon leer
  if (feld.id === 'teil-edit' && S.ui.teilEdit) { const wert = feld.value; setTimeout(() => { if (S.ui.teilEdit && document.activeElement !== $('#teil-edit')) act('teil-text', '', wert); }, 0); }
  if (feld.id === 'umbenennen' && S.ui.umbenennen) setTimeout(() => { if (S.ui.umbenennen && document.activeElement !== $('#umbenennen')) { S.ui.umbenennen = null; render(); } }, 0);
}

/* Erklärtext auf Anforderung (R00119, ADR-0020): Fokus zeigt ihn, Verlassen blendet ihn aus; langer Druck auf Touch
   zeigt ihn, ein Tippen außerhalb (pointerdown) blendet ihn aus. Hier wird nur gezeigt/verborgen und gestellt — der
   Zustand liegt in S.ui.tooltip, damit ein Neuzeichnen die Blase reproduziert (ADR-0007, `vTipp()`). */
document.addEventListener('focusin', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el) { if (!S.ui.tooltip || S.ui.tooltip.fuer !== el.dataset.tip) tippZeigen(el); }
  else if (S.ui.tooltip) tippVerbergen();
});
document.addEventListener('focusout', e => {
  // Beim Neuzeichnen wird das fokussierte Element ersetzt; das ist kein Verlassen (ADR-0007)
  if (S.neuzeichnen) return;
  if (!e.relatedTarget) tippVerbergen();
});
let tippDruck = null;
const tippDruckAbbrechen = () => { if (tippDruck) { clearTimeout(tippDruck.timer); tippDruck = null; } };
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el) { tippVerbergen(); return; }
  tippDruckAbbrechen();
  tippDruck = { el, x: e.clientX, y: e.clientY, timer: setTimeout(() => { tippDruck = null; tippZeigen(el); }, 500) };
});
document.addEventListener('pointermove', e => {
  if (tippDruck && (Math.abs(e.clientX - tippDruck.x) > 10 || Math.abs(e.clientY - tippDruck.y) > 10)) tippDruckAbbrechen();
});
document.addEventListener('pointerup', tippDruckAbbrechen);
document.addEventListener('pointercancel', tippDruckAbbrechen);
document.addEventListener('scroll', tippPlatzieren, true);

/** Ein „change“, das der Browser beim Verlassen eines Textfelds des Aufgabenfensters meldet. Es kommt vor dem „focusout“ und
    weiß nicht, wohin der Fokus geht — auf „Eingabe verwerfen“ darf es nicht speichern (R00155 54-13). */
function meldetBeimVerlassen(ereignis) {
  const feld = ereignis.target;
  const istTextfeld = feld.tagName === 'TEXTAREA' || (feld.tagName === 'INPUT' && feld.type === 'text');
  return ereignis.isTrusted && istTextfeld && Boolean(feld.dataset.af) && Boolean(S.ui.offen) && document.activeElement !== feld;
}
document.addEventListener('change', e => {
  if (S.neuzeichnen) return;
  // das „focusout“ gleich danach kennt das Ziel des Fokus und trägt die Änderung nach
  if (meldetBeimVerlassen(e)) { aenderungAufschieben(e.target); return; }
  aenderungGemeldet(e.target);
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
  if (e.target.dataset && e.target.dataset.bestand) { bestandAchsenSetzen(e.target.dataset.bestand, e.target.value); return; }
  if (e.target.dataset && e.target.dataset.wn === 'ebene' && S.ui.wbsNeu) { S.ui.wbsNeu.ebene = e.target.value; S.ui.wbsNeu.fehler = null; render(); return; }
  if (e.target.dataset && e.target.dataset.dl) { durchlaufWaehlen(e.target.dataset.dl, e.target.value); render(); return; }
  if (e.target.dataset && e.target.dataset.fb) { act('fb-setzen', e.target.dataset.fb, e.target.value); return; }
  const bf = e.target.dataset && e.target.dataset.bf;
  if (bf) {
    if (bf === 'messbasisTage') {
      const n = Math.round(+e.target.value);
      if (n >= 1 && n <= 3650) berichtsfilterSetzen({ messbasisTage: n });
      render();
      return;
    }
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
  if (af === 'beschreibung') { S.ui.beschreibungBearbeiten = false; setTimeout(fokusNachBeschreibung, 0); }
  if (af === 'titel') { abschicken(e.target, () => titelSpeichern(v)); return; }
  const aenderung = af === 'labels' ? { labels: v.split(',').map(s => s.trim()).filter(Boolean) }
    : af === 'klasse' || af === 'faellig' ? { [af]: v || null } : { [af]: v };
  abschicken(e.target, () => aufgabeAendern(S.ui.offen, aenderung));
});

// Umschalt/Strg + Klick auf eine Karte markiert keinen Text
document.addEventListener('mousedown', e => {
  if ((e.shiftKey || e.ctrlKey || e.metaKey) && e.target.closest && e.target.closest('.ka[data-id]')) e.preventDefault();
});
// Der Knopf „Eingabe verwerfen“ nimmt dem Feld den Fokus nicht: das Verlassen speicherte sonst, was er verwerfen soll (R00155 54-12)
document.addEventListener('mousedown', e => {
  if (e.target.closest && e.target.closest('[data-act="eingabe-verwerfen"]')) e.preventDefault();
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
  if (S.ui.pop && !e.target.closest('.pop') && !e.target.closest('.al-bg') && !(el && el.dataset.act === 'pop')) {
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
  act(el.dataset.act, el.dataset.arg, undefined, el, e.detail);
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
  // Die getippte Zeichenkette des Board-Umbenennens hält der Zustand (Härtung #129/1): der nächste Render zeichnet sie
  // weiter, auch nach einem Feldfehler — und der ✓-Knopf (Klick trägt keinen Wert mit) bestätigt dieselbe Eingabe.
  if (e.target.id === 'board-umbenennen') { S.ui.boardUmbenennenWert = e.target.value; return; }
  // der Entwurf folgt dem Feld, damit ein Neuzeichnen die eigene Berichtigung stehen lässt
  if (e.target.id === 'herkunft-neu' && S.ui.offen) { S.ui.entwurf = entwurfNachTippen(S.ui.entwurf, S.ui.offen, HERKUNFT_FELD, e.target.value); return; }
  if (e.target.id === 'flt') {
    filterSetzen(e.target.value);
    $('#main').innerHTML = vMain();
    return;
  }
  const sf = e.target.dataset && e.target.dataset.sf;
  if (sf && S.ui.setup) {
    const sp = S.ui.setup.spalten[+e.target.dataset.i];
    sp[sf] = sf === 'grenze' ? e.target.value.replace(/\D/g, '') : e.target.value;
    S.ui.setup.fehler = null;
    if (sf === 'eigentuemer') { sp.beruehrt = true; $(`#eig-hin-${e.target.dataset.i}`).textContent = eigentuemerText(sp); const roh = e.target.parentElement.querySelector('.eig-roh'); if (roh) roh.hidden = eigentuemerGeaendert(sp); }
    if (sf === 'farbe') { const bahn = e.target.closest('.bahn'); bahn.classList.add('gefaerbt'); bahn.style.setProperty('--sf', sp.farbe); e.target.nextElementSibling.textContent = sp.farbe; }
    $('#setup-vorschau').textContent = setupText(S.ui.setup);
    return;
  }
  const ef = e.target.dataset && e.target.dataset.ef;
  if (ef && S.ui.einr) {
    const d = S.ui.einr, i = +e.target.dataset.i, v = e.target.value;
    if (ef === 'pname') d.personen[i].name = v;
    if (ef === 'klabel') d.klassen[i].bezeichnung = v;
    if (ef === 'slabel') d.signale[i].bezeichnung = v;
    if (ef === 'shex' && /^#[0-9a-f]{6}$/i.test(v.trim())) d.signale[i].farbe = v.trim().toLowerCase();
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

/**
 * Das Fenster folgt dem sichtbaren Bereich, wenn die Bildschirmtastatur ihn verdeckt (ADR-0016): zwei Variablen an der Wurzel,
 * gelesen nur von `.mod-bg`. Gesetzt nur bei verdecktem Bereich ohne Zoom, sonst entfernt; kein Fokus, kein Neuzeichnen.
 */
function sichtbarenBereichSetzen() {
  const versatz = tastaturVersatzInPx(innerHeight, window.visualViewport);
  const wurzelStil = document.documentElement.style;
  if (versatz.bereichIstVerdeckt) {
    wurzelStil.setProperty('--kd-vv-oben', `${versatz.oben}px`);
    wurzelStil.setProperty('--kd-vv-unten', `${versatz.unten}px`);
  } else {
    wurzelStil.removeProperty('--kd-vv-oben');
    wurzelStil.removeProperty('--kd-vv-unten');
  }
}
/** Wie weit der sichtbare Bereich oben und unten vom Layout-Bereich abweicht; ein Zoom mit zwei Fingern zählt nicht als Verdecken (ADR-0016 Regel 2). */
function tastaturVersatzInPx(layoutHoeheInPx, bereich) {
  const ZOOM_TOLERANZ = 0.01;
  const RUNDUNGS_TOLERANZ_IN_PX = 1;
  const oben = bereich.offsetTop;
  const unten = Math.max(0, layoutHoeheInPx - bereich.offsetTop - bereich.height);
  const bereichIstUngezoomt = Math.abs(bereich.scale - 1) < ZOOM_TOLERANZ;
  const randIstVerdeckt = unten > RUNDUNGS_TOLERANZ_IN_PX || oben > RUNDUNGS_TOLERANZ_IN_PX;
  return { bereichIstVerdeckt: bereichIstUngezoomt && randIstVerdeckt, oben, unten };
}
let sichtbarerBereichGeplant = false;
/** Höchstens ein Setzen je Frame, egal wie viele `resize`- und `scroll`-Ereignisse kommen (ADR-0016 Regel 1). */
function sichtbarenBereichPlanen() {
  if (sichtbarerBereichGeplant) return;
  sichtbarerBereichGeplant = true;
  requestAnimationFrame(() => { sichtbarerBereichGeplant = false; sichtbarenBereichSetzen(); });
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', sichtbarenBereichPlanen);
  visualViewport.addEventListener('scroll', sichtbarenBereichPlanen);
  // einmal beim Start (ADR-0016 N1): ist der Bereich schon beim Laden verdeckt, kommt womöglich kein Ereignis mehr
  sichtbarenBereichSetzen();
}
window.addEventListener('resize', () => {
  const stufeGewechselt = stufeAusBreite(innerWidth) !== S.ui.stufe;
  if (stufeGewechselt) render();
  else { popPlatzieren(); tippPlatzieren(); }
});
document.addEventListener('keydown', e => {
  const t = e.target;
  // Esc schließt den Erklärtext zuerst — an der Spitze der Kaskade, vor Pop und Fenstern (R00119 FA 8, ADR-0020)
  if (e.key === 'Escape' && S.ui.tooltip) { e.preventDefault(); tippVerbergen(); return; }
  if (S.ui.alDialog && e.key === 'Escape') { e.preventDefault(); alAbbrechen(); return; }
  // Esc im Umbenennen-Feld des Board-Umschalters schließt nur die Eingabe, nicht den ganzen Umschalter (R00128 M10)
  if (e.key === 'Escape' && S.ui.boardUmbenennen) { e.preventDefault(); act('board-umbenennen-ab', S.ui.boardUmbenennen); return; }
  if (S.ui.menue) { menueTaste(e); return; }
  if (S.ui.fensterMenue && fensterMenueTaste(e)) return;
  if (e.key === 'Tab' && fallenTaste(e)) return;
  if (S.ui.pop && (popMenueTaste(e) || popFensterTaste(e))) return;
  if (radioTaste(e)) return;
  // Enter auf dem Lesediv des Titels öffnet die Bearbeitung (R00116, Muster besch-lesen)
  if (e.key === 'Enter' && t.dataset && t.dataset.act === 'titel-bearbeiten') { e.preventDefault(); act('titel-bearbeiten'); return; }
  if ((e.key === 'Enter' || e.key === ' ') && t.dataset && t.dataset.act === 'teil-bearbeiten') { e.preventDefault(); act('teil-bearbeiten', t.dataset.arg); return; }
  // Enter in einem Feld der Berichtsfilter nimmt den Wert an wie ein „change“: hat ein Neuzeichnen den getippten Wert in
  // ein neues Feld gerettet, meldet der Browser dafür kein „change“ — ohne Enter bliebe er ungespeichert.
  if (e.key === 'Enter' && t.dataset && t.dataset.bf) { aenderungNachtragen(t); return; }
  // Ebenso Titel und Labels des Aufgabenfensters (R00155 54-14). Das eigene „change“ des Browsers entfällt dann — sonst speicherte Enter zweimal.
  if (e.key === 'Enter' && t.tagName === 'INPUT' && t.dataset && t.dataset.af && aenderungNachtragen(t)) { e.preventDefault(); return; }
  if (e.key === 'Enter' && t.dataset && t.dataset.enter && !e.shiftKey) {
    e.preventDefault();
    abschicken(t, () => act(t.dataset.enter, t.dataset.arg, t.value));
    return;
  }
  if (S.ui.neu) {
    if (e.key === 'Escape') { e.preventDefault(); S.ui.neu = null; render(); return; }
    // Enter im Titel und Strg+Enter sind der Auslöser „Anlegen“ bzw. „Anlegen und weitere“ — über den Verteiler, damit die
    // Sperre auch hier gilt (R00148 AK 12)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || t.id === 'neu-titel')) { e.preventDefault(); act('nf-anlegen', e.shiftKey ? 'weitere' : ''); return; }
    if (!(e.key === 'Enter' && t.dataset && t.dataset.enter)) return;
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && t.id === 'beschreibung') { e.preventDefault(); t.blur(); return; }
  if (e.key === 'Escape' && t.id === 'flt') {
    if (S.ui.filter) { t.value = ''; filterSetzen(''); S.ui.fokus = '#flt'; render(); } else t.blur();
    return;
  }
  if (S.ui.hilfe && (e.key === 'Escape' || e.key === '?')) { S.ui.hilfe = false; render(); return; }
  if (S.ui.vollbild && e.key === 'Escape') { vollbildSetzen(false); render(); return; }
  if (S.ui.zuweisen) { zuweisenTaste(e, t); return; }
  const rueckgaengigTaste = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && S.ui.hinweis && S.ui.hinweis.undo;
  if (rueckgaengigTaste && (!/INPUT|TEXTAREA|SELECT/.test(t.tagName) || leeresFeldDesEntfernens(t))) {
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
    if (S.ui.pop) { S.ui.fokus = ausloeserDesMenues(); S.ui.pop = null; S.ui.ichNoetig = false; render(); return; }
    if (S.ui.umbenennen) { const n = S.ui.umbenennen; S.ui.umbenennen = null; S.ui.fokusKarte = n; render(); return; }
    if (S.ui.teilEdit) { S.ui.fokus = textDerTeilaufgabe(S.ui.teilEdit.i); S.ui.teilEdit = null; render(); return; }
    if (S.ui.setup) { S.ui.setup = null; render(); return; }
    if (S.ui.offen && eingabeVerwerfen(t)) { e.preventDefault(); return; }
    if (S.ui.offen) { verlassenNachholen(); if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) t.blur(); S.ui.offen = null; S.ui.entwurf = null; render(); return; }
    if (S.ui.offenDefekt) { S.ui.offenDefekt = null; S.ui.defektDatei = null; render(); return; }
    if (S.ui.auswahl.length) { auswahlAufheben(); render(); return; }
  }
});

/* Kontextmenü: Modell aus menue.js, Zustand in S.ui.menue = {titel, x, y, eintraege, index, unter: {von, eintraege, index}} */
function menueFuerKarte(nr, x, y) {
  const a = aufgabe(nr);
  if (!a || !S.board) return;
  if (S.ui.auswahl.length > 1 && S.ui.auswahl.includes(nr)) { menueFuerAuswahl(x, y); return; }
  auswahlAufheben();
  const spalte = S.board.spalten.find(sp => sp.aufgaben.includes(nr));
  const boards = (S.boards || []).filter(b => !b.archiviert && !b.spalten.some(sp => sp.aufgaben.includes(nr)) && b.spalten.length).map(b => ({ slug: b.slug, titel: b.titel, spalte: b.spalten[0].name }));
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
  const frei = (S.boards || []).filter(b => !b.archiviert && !b.spalten.some(sp => sp.aufgaben.includes(nr))).map(b => ({ slug: b.slug, titel: b.titel, spalten: b.spalten.map(sp => sp.name) }));
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
/** Das Kopf-Menü endet an der Endkante seines Auslösers; passt es dort nicht ins Bild, rückt es an den Rand (ADR-0015 vor Ausrichtung). */
function fensterMenueEinpassen() {
  const el = $('#fenster [role="menu"]');
  if (!el) return;
  const r = el.getBoundingClientRect();
  const versatz = Math.max(0, 8 - r.left) - Math.max(0, r.right - (innerWidth - 8));
  if (versatz) el.style.transform = `translateX(${versatz}px)`;
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
  S.ui.fokus = kmenueEintrag(m);
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
/** Menütaste oder Umschalt+F10 auf Spaltenkopf oder Listenzeile; Enter auf der Zeile selbst öffnet die Aufgabe — auf einem Knopf darin wirkt der Knopf. */
function menueTasteAufZiel(e, t) {
  const menuetaste = e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10');
  const kopf = t.closest && t.closest('.bahn-kopf[data-kopf]'), zeile = t.closest && t.closest('tr[data-zeile]');
  if (!kopf && !zeile) return false;
  const r = t.getBoundingClientRect();
  if (menuetaste) { e.preventDefault(); if (kopf) menueFuerSpalte(+kopf.dataset.kopf, r.left + 16, r.bottom); else menueFuerZeile(+zeile.dataset.zeile, r.left + 40, r.bottom); return true; }
  if (zeile === t && e.key === 'Enter') { e.preventDefault(); act('oeffnen', zeile.dataset.zeile); return true; }
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
  S.ui.fokus = kmenueEintrag(m);
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
  switch (e.key) {
    case 't': e.preventDefault(); laufende(a).some(z => z.wer === S.ich) ? act('stop', `${nr}|${S.ich}`) : act('start', String(nr)); return true;
    case 'm': e.preventDefault(); act('mich', String(nr)); return true;
    case 'a': e.preventDefault(); act(a.archiviert ? 'zurueckholen' : 'archivieren', String(nr)); return true;
    case 'e': e.preventDefault(); act('titel-bearbeiten'); return true;
    case 'b': e.preventDefault(); act('beschreibung-bearbeiten'); return true;
    case 's': e.preventDefault(); S.ui.tab = 'inhalt'; S.ui.fokus = '#teil-neu'; render(); return true;
    case 'k': e.preventDefault(); S.ui.tab = 'inhalt'; S.ui.fokus = '#km-inp'; render(); return true;
    case 'd': e.preventDefault(); ansichtUmschalten(); return true;
    default: return false;
  }
}
/** `d` wechselt Inhalt ↔ Datei (R00145 FA 8) und lässt den Fokus am Auslöser, dessen Name die neue Ansicht ansagt. */
function ansichtUmschalten() {
  const ziel = S.ui.tab === 'datei' ? 'inhalt' : 'datei';
  S.ui.tab = ziel;
  S.ui.fokus = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
  render();
}
/** Im offenen Kopf-Menü (R00144 FA 6, R00145 FA 7): Pfeile/Pos1/Ende führen über die Einträge, Enter und Leertaste wählen,
 *  Esc und Tab schließen mit Rückgabe an den Auslöser. Solange es offen ist, greifen die Fenster-Kürzel nicht. */
function fensterMenueTaste(e) {
  const menue = $('#fenster [role="menu"]');
  if (!menue) return false;
  const art = menue.dataset.art;
  const schliessen = () => {
    S.ui.fensterMenue = null;
    S.ui.fokus = `#fenster [data-act="fenster-menue"][data-arg="${art}"]`;
    render();
  };
  if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); schliessen(); return true; }
  const eintraege = [...menue.querySelectorAll('[role^="menuitem"]')];
  if (eintragAusloesen(e, eintraege)) return true;
  if (Object.hasOwn(MENUE_RICHTUNG, e.key)) {
    e.preventDefault();
    const modell = eintraege.map(() => ({ aktuell: false }));
    const ziel = menueSchritt(modell, eintraege.indexOf(document.activeElement), MENUE_RICHTUNG[e.key]);
    if (ziel >= 0) eintraege[ziel].focus();
    return true;
  }
  // alles Übrige ist gesperrt: kein `a`, `t`, `d`, kein Tippen im Fenster hinter dem Menü
  return true;
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
  // Enter und Leertaste auf einem Knopf in der Karte (Teilaufgabe, Signal, Stopp) lösen den Knopf aus, nicht die Karte (R00108)
  const fokusAufKnopfInKarte = Boolean(karte) && t !== karte && Boolean(t.closest('button'));
  if (fokusAufKnopfInKarte && (e.key === 'Enter' || e.key === ' ')) return false;
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
    if (nr == null || zugGesperrt()) return true;
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
  if (art === 'neu-teil') { u.neu.teil.push(...zeilen.map(text => ({ kennung: entwurfsKennung(), text }))); u.fokus = '#neu-teil'; render(); return; }
  if (art === 'teil') {
    u.fokus = '#teil-neu';
    await schreiben('POST', `/api/aufgaben/${u.offen}/teilaufgaben/mehrere`, { texte: zeilen });
    u.hinweis = { text: `${zeilen.length} Teilaufgaben ergänzt`, at: Date.now() };
  }
  u.fokus = '#teil-neu';
  render();
});

/* Tooltip der Diagramme (R00073): der Zeiger wird über die ganze Zeichenfläche in einen Tag übersetzt (`data-achse`), das
   Fadenkreuz steht auf diesem Tag — bei stetiger Achse am Zeiger —, den Inhalt liefert die Ansicht über `S.diagrammTip`. */
document.addEventListener('mousemove', e => {
  const tip = $('#tooltip'), kreuz = $('#fadenkreuz');
  if (tip && S.ui.view === 'berichte/fieber') { fieberTipp(tip, e); return; }
  if (!tip || !kreuz) return;
  const svg = e.target.closest && e.target.closest('svg.diagramm[data-achse]');
  const tag = svg && diagrammTag(svg, e);
  if (tag == null) { tip.hidden = true; kreuz.setAttribute('x1', -10); kreuz.setAttribute('x2', -10); return; }
  kreuz.setAttribute('x1', tag.x); kreuz.setAttribute('x2', tag.x);
  tip.innerHTML = S.diagrammTip ? S.diagrammTip(tag.t) : '';
  tip.hidden = !tip.innerHTML;
  const flaeche = svg.closest('.dflaeche').getBoundingClientRect();
  tip.style.left = Math.min(flaeche.width - tip.offsetWidth - 4, Math.max(0, e.clientX - flaeche.left + 14)) + 'px';
});
/** Fever Chart (R00078): der Tooltip gehört zum nächsten Punkt der Bahn im Umkreis des Zeigers. */
function fieberTipp(tip, e) {
  const svg = e.target.closest && e.target.closest('svg.diagramm.fieber');
  let naechster = null;
  if (svg && S.fieberLage) {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    S.fieberLage.forEach(([x, y], i) => { const d = Math.hypot(x - q.x, y - q.y); if (d < 24 && (!naechster || d <= naechster.d)) naechster = { d, i }; });
  }
  if (!naechster) { tip.hidden = true; return; }
  tip.innerHTML = S.fieberTip(naechster.i);
  tip.hidden = false;
  const flaeche = svg.closest('.dflaeche').getBoundingClientRect();
  tip.style.left = Math.min(flaeche.width - tip.offsetWidth - 4, Math.max(0, e.clientX - flaeche.left + 14)) + 'px';
  tip.style.top = Math.min(flaeche.height - tip.offsetHeight - 4, Math.max(0, e.clientY - flaeche.top + 14)) + 'px';
}
/** Tag unter dem Zeiger und x des Fadenkreuzes in Koordinaten des Diagramms; null außerhalb der Zeichenfläche. */
function diagrammTag(svg, e) {
  const [l, breite, t0, t1, stetig] = svg.dataset.achse.split(',').map(Number);
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const x = pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  const t = tagAnPosition(x, { l, breite, t0, t1, stetig });
  if (t == null) return null;
  return { t, x: stetig || t1 <= t0 ? x : l + breite * (t - t0) / (t1 - t0) };
}

/* Vollbild der Diagramme (R00073): ein Zustand, damit es das Neuzeichnen übersteht; die Fullscreen-API kommt dazu, wo der Browser sie erlaubt. */
function vollbildSetzen(an) {
  S.ui.vollbild = an;
  try {
    if (an && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
    if (!an && document.fullscreenElement) document.exitFullscreen().catch(() => { });
  } catch (_) { }
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && S.ui.vollbild) { S.ui.vollbild = false; render(); }
});

/* Dateien aus dem Rechner auf „Anhänge“ ziehen (R00116) bzw. in der Ansicht „Inhalt“ auf deren Fläche ablegen (R00145 FA 12):
   außerhalb des Anhang-Abschnitts wird der Browser-Wechsel auf die Datei abgefangen, abgelegt wird nur im Abschnitt. */
const dateiZug = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
const inhaltFlaeche = e => Boolean(S.ui.offen) && ansichtDerAufgabe(aufgabe(S.ui.offen)) === 'inhalt' && Boolean(e.target.closest && e.target.closest('#fenster .mod-body'));
document.addEventListener('dragover', e => {
  if (zug != null || !dateiZug(e)) return;
  const abschnitt = e.target.closest && e.target.closest('#anhaenge');
  if (abschnitt) { e.preventDefault(); abschnitt.classList.add('ziel'); return; }
  if (inhaltFlaeche(e)) e.preventDefault();
});
document.addEventListener('drop', e => {
  if (zug != null || !dateiZug(e)) return;
  const abschnitt = e.target.closest && e.target.closest('#anhaenge');
  document.querySelectorAll('#anhaenge.ziel').forEach(x => x.classList.remove('ziel'));
  if (abschnitt && e.dataTransfer.files.length) { e.preventDefault(); anhaengeHochladen([...e.dataTransfer.files]); return; }
  if (inhaltFlaeche(e)) e.preventDefault();
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
  } else if (bahn.classList.contains('zu')) { // zugeklappt (R00074): keine Karten im Bild, ans Ende der Spalte
    bahn.classList.add('ins-end');
    ziel = { spalte, index: S.board.spalten.find(s => s.name === spalte).aufgaben.filter(n => !bewegte.includes(n)).length };
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
  if (z && zugGesperrt()) return;
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
  if (schlangeOffen() > 0) return; // eigene Anfragen laufen noch; danach wird ohnehin neu geladen
  const vorher = spaltenJeAufgabe();
  // Verworfen ist nicht „unverändert“: die Pfade gehen ans nächste übernommene Laden, sonst fehlte die Markierung (R00110 Regel 7).
  // Ist schon ein neueres übernommen, kommt keins mehr nach — dann markiert der Stand, der das verworfene überholt hat.
  const wennVerworfen = ueberholt => {
    if (!e.extern) return;
    externVerworfen.push({ pfade: e.pfade, vorher });
    if (ueberholt && externNachtragen()) render();
  };
  const neu = await laden({ nurBeiAenderung: true, wennVerworfen });
  if (!e.extern || neu === false) return;
  externMarkieren(e.pfade, vorher);
  render();
}

/** Markiert 10 s die Aufgaben, deren Datei unter `pfade` ist, und — bei geändertem Board — die verschobenen gegenüber `vorher`. */
function externMarkieren(pfade, vorher) {
  const jetzt = Date.now();
  for (const a of S.aufgaben) if (pfade.includes('aufgaben/' + a.datei)) S.extern[a.nummer] = { at: jetzt, datei: 'aufgaben/' + a.datei };
  const boardDatei = S.ui.slug && 'boards/' + S.ui.slug + '.md';
  if (boardDatei && pfade.includes(boardDatei)) {
    const nachher = spaltenJeAufgabe();
    for (const n of Object.keys(nachher)) if (vorher[n] !== nachher[n]) S.extern[n] = { at: jetzt, datei: boardDatei };
  }
}

/** Trägt die Markierungen verworfener Ereignis-Ladevorgänge nach; `true`, wenn es welche gab. */
function externNachtragen() {
  const gemerkt = externVerworfen.splice(0);
  for (const { pfade, vorher } of gemerkt) externMarkieren(pfade, vorher);
  return gemerkt.length > 0;
}

function liveGetrennt() {
  delete document.documentElement.dataset.live;
  if (S.live) { S.live = false; render(); }
}

function liveVerbinden() {
  if (typeof EventSource === 'undefined') return;
  const q = new EventSource('/api/ereignisse');
  S.liveZuletzt = Date.now();
  q.onmessage = m => { S.liveZuletzt = Date.now(); ereignis(JSON.parse(m.data)).catch(() => { }); };
  // der Herzschlag zeigt nur, dass die Leitung lebt — er zeichnet nichts neu (R00085)
  q.kdHerzschlag = () => { S.liveZuletzt = Date.now(); };
  q.addEventListener('herzschlag', q.kdHerzschlag);
  // Neu verbindet allein der Wächter, mit Rückzug — EventSource soll nicht zusätzlich selbst wiederholen
  q.onerror = () => { q.close(); liveGetrennt(); };
  q.onopen = () => {
    S.liveZuletzt = Date.now();
    S.liveVersuch = 0;
    document.documentElement.dataset.live = 'verbunden'; // Prüfpunkt: ab jetzt kommt jede Änderung an
    if (!S.live) {
      S.live = true;
      laden().then(() => { S.ui.hinweis = { text: 'Wieder verbunden · Stand nachgeladen', at: Date.now() }; render(); }).catch(() => { });
    }
  };
  S.ereignisquelle = q;
}

/** Wächter (R00085): schließt eine geschlossene oder stille Verbindung und baut sie nach dem Rückzug neu auf — nie zwei zugleich. */
function liveWaechter(sofort = false) {
  const q = S.ereignisquelle;
  if (!q || S.liveWartet) return;
  if (entscheide({ zuletzt: S.liveZuletzt, jetzt: Date.now(), zustand: q.readyState, sofort }) !== 'neu') return;
  q.close();
  liveGetrennt();
  S.liveWartet = true;
  setTimeout(() => { S.liveWartet = false; liveVerbinden(); }, rueckzug(S.liveVersuch || 0));
  S.liveVersuch = (S.liveVersuch || 0) + 1;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') liveWaechter(true); });
window.addEventListener('online', () => liveWaechter(true));

/* Testschnittstelle der E2E-Tests: die Leitung still legen, ohne sie zu schließen; Neuzeichnen zählen */
window.kdTest = {
  liveStilllegen() { const q = S.ereignisquelle; q.onmessage = q.onerror = null; q.removeEventListener('herzschlag', q.kdHerzschlag); },
  renders: () => S.renders || 0,
  /** Wahr, wenn der zuletzt geladene Stand gezeichnet ist — kein Laden steht zwischen Übernahme und Zeichnen (R00103). */
  gezeichnet: () => geladenerStand === serverStand(),
  /** Der Server meldet sich real alle 15 s; stellt ein Test die Uhr vor, hält er die Verbindung damit frisch. */
  herzschlag: () => { S.liveZuletzt = Date.now(); },
  /** Zahl der Kommentare einer Aufgabe im geladenen Stand. */
  kommentare: nr => aufgabe(nr).kommentare.length,
};

/** Vergessene Timer im Takt (R00114, ADR-0019 Regel 3): er entscheidet keinen Zustand, er merkt nur die Kante und lässt einmal zeichnen. */
function taktVergessen(jetzt) {
  const laufend = new Set();
  for (const { a, z } of alleLaufenden()) {
    const schluessel = `${a.nummer}|${z.wer}`;
    laufend.add(schluessel);
    if (!istVergessen(jetzt - laufBeginn(a, z))) continue;
    if (S.ui.vergessen.has(schluessel)) continue;
    S.ui.vergessen.add(schluessel);
    S.ui.vergessenOffen = true;
  }
  // was nicht mehr läuft, ist nicht mehr vergessen: gestoppt, gelöscht, korrigiert, archiviert (FA 18)
  for (const schluessel of S.ui.vergessen) if (!laufend.has(schluessel)) S.ui.vergessen.delete(schluessel);
  const erinnert = new Set(alleLaufenden().map(({ a, z }) => erinnerungsSchluessel(a, z)));
  for (const schluessel of S.ui.erinnert) if (!erinnert.has(schluessel)) S.ui.erinnert.delete(schluessel);
}

/** Erinnerungsschlüssel eines Eintrags (FA 18): je Tab und gewählter Identität einer; die Kennung nennt den Lauf,
    damit ein neuer Lauf derselben Person auf derselben Aufgabe wieder erinnert. */
const erinnerungsSchluessel = (a, z) => `${a.nummer}|${z.kennung}|${S.ich || ''}`;

/**
 * Bleibt der stehende Hinweis, statt von einer neuen Erinnerung ersetzt zu werden? Ein Rückgängig bleibt bis zum Ablauf
 * (FA 17), eine Erinnerung wartet ihre Lebensdauer ab (FA 14: erst der eigene, danach die fremden) — nur eine knopflose
 * weicht der Erinnerung mit Aktion, weil die Identitätswahl sie nachholt (M4, FA 18).
 */
function hinweisBleibtStehen(mitAktion) {
  const t = S.ui.hinweis;
  if (!t) return false;
  if (t.undo) return true;
  if (!t.erinnerung) return false;
  return !(mitAktion && !t.aktion);
}

/** Erinnerung an vergessene Timer (R00114, ADR-0019 Regel 4): ein Hinweis je Tab und Identität, der eigene zuerst. */
function erinnerungPruefen(jetzt) {
  // im verborgenen Tab entsteht kein Hinweis; der Übergang wird beim Sichtbarwerden nachgeholt (FA 18)
  if (document.visibilityState !== 'visible') return false;
  const offen = alleLaufenden().filter(({ a, z }) => istVergessen(jetzt - laufBeginn(a, z)));
  const kandidat = offen.sort((x, y) => (x.z.wer === S.ich ? 0 : 1) - (y.z.wer === S.ich ? 0 : 1))
    .find(({ a, z }) => !S.ui.erinnert.has(erinnerungsSchluessel(a, z)));
  if (!kandidat) return false;
  if (hinweisBleibtStehen(kandidat.z.wer === S.ich)) return false;
  erinnerungZeigen(kandidat);
  return true;
}

/** Der Hinweis nennt Person, Aufgabe und Dauer; „Zeit korrigieren“ bietet nur der eigene Eintrag an (FA 15, PO Z. 182). */
function erinnerungZeigen({ a, z }) {
  const schluessel = erinnerungsSchluessel(a, z);
  S.ui.erinnert.add(schluessel);
  let text = `Timer von ${per(z.wer).name} zu #${a.nummer} läuft ${seitText(Date.now() - laufBeginn(a, z))}`;
  if (!S.ich) text += ' — wähle „Ich bin …“';
  S.ui.hinweis = { text, erinnerung: schluessel, at: Date.now() };
  if (z.wer === S.ich) S.ui.hinweis.aktion = { text: 'Zeit korrigieren', act: 'zeit-korrigieren', arg: `${a.nummer}|${z.kennung}` };
}

setInterval(() => {
  const jetzt = Date.now();
  let neu = false;
  const zeichnenMoeglich = zug == null && !S.ui.neu;
  for (const [n, x] of Object.entries(S.extern)) if (jetzt - x.at >= 10000) { delete S.extern[n]; neu = true; }
  if (S.ui.hinweis && jetzt - S.ui.hinweis.at > (S.ui.hinweis.dauer || 8000)) { S.ui.hinweis = null; neu = true; }
  // Ein Fehlschlag, der hinter einem Rückgängig-Hinweis gewartet hat, erscheint nach dessen Ablauf (R00147 AK 9)
  if (!S.ui.hinweis && S.ui.hinweisWarten) { S.ui.hinweis = S.ui.hinweisWarten; S.ui.hinweisWarten = null; neu = true; }
  taktVergessen(jetzt);
  // das Zeichnen unterbleibt hinter einem Zug oder „Neue Aufgabe“ und wird beim nächsten Takt nachgeholt (FA 22)
  if (S.ui.vergessenOffen && zeichnenMoeglich) { S.ui.vergessenOffen = false; neu = true; }
  // die Erinnerung entsteht erst, wenn sie auch gezeichnet wird: sonst verfällt sie in ihrer Lebensdauer, ohne je zu stehen (B1)
  if (zeichnenMoeglich && erinnerungPruefen(jetzt)) neu = true;
  document.querySelectorAll('[data-summe-basis]').forEach(el => { const seit = el.dataset.summeSeit ? el.dataset.summeSeit.split(',').map(Number) : []; el.textContent = 'Σ ' + hm(+el.dataset.summeBasis + seit.reduce((s, t) => s + Math.max(0, jetzt - t), 0)); });
  document.querySelectorAll('[data-since]').forEach(el => {
    const d = jetzt - +el.dataset.since;
    if (el.dataset.fmt === 'seit') el.textContent = seitText(d);
    else if (el.dataset.fmt === 's') el.textContent = hms(d);
    else el.textContent = hm(d);
  });
  document.querySelectorAll('[data-ext]').forEach(el => { el.textContent = `extern · ${el.dataset.datei} · vor ${Math.round((jetzt - +el.dataset.ext) / 1000)} Sek`; });
  if (neu && zeichnenMoeglich) render();
  liveWaechter();
}, 1000);

liveVerbinden();
laden().catch(f => { S.ui.fehler = f.message; render(); });
