/* kanbanD — Zustand, Laden, Handlungen, Ereignisse. Der Ordner ist die Wahrheit; die Seite fragt nach. */
const S = { zustand: null, board: null, aufgaben: [], ich: null, extern: {}, live: true, ui: { slug: null, first: null, fehler: null, pop: null, filter: '', bereich: 'alle', auswahl: [], anker: null, vergessen: new Set(), vergessenOffen: false, erinnert: new Set(), tooltip: null, fensterMenue: null, laufend: new Set() } };
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
/* „Umbrechen“ der Review-Seite (R00248): ein Wert für alle Karten, gemerkt im Browser (ADR-0042 N5.1); ohne Speicher gilt er bis zum Neuladen */
S.ui.umbrechen = (() => { try { return umbrechenLesen(window.localStorage); } catch (_) { return false; } })();
/* „Nebeneinander“ (R00249 FA 6, ADR-0042 N6.6): derselbe Weg unter eigenem Schlüssel */
S.ui.nebeneinander = (() => { try { return schalterLesen(window.localStorage, NEBENEINANDER_SCHLUESSEL); } catch (_) { return false; } })();
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
/** Klappen „Kosten je Rolle“ (R00172): je Board die Menge der offenen Kennungen `data-kr` — nur für die Sitzung, nichts
    wird gespeichert. Jedes Neuzeichnen setzt `open` daraus (vKostenRollen). */
S.ui.kostRollenOffen = new Map();
document.addEventListener('toggle', e => {
  if (!e.target.matches || !e.target.matches('.kost-rollen, .kost-rolle')) return;
  const offen = S.ui.kostRollenOffen.get(S.ui.slug) || new Set();
  if (e.target.open) offen.add(e.target.dataset.kr);
  else offen.delete(e.target.dataset.kr);
  S.ui.kostRollenOffen.set(S.ui.slug, offen);
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

/** Die Frist je Anfrage (R00186, ADR-0025 Nachtrag N4): vom Absenden bis zum gelesenen Antworttext. 15 s sind eine Hypothese
    mit weitem Abstand zu den Antwortzeiten des lokalen Servers. Anhänge und die Live-Verbindung laufen nicht hierüber. */
const ANTWORT_FRIST_MS = 15000;
/** Der Satz nach abgelaufener Frist: der Server kann die Änderung noch gespeichert haben — nie „nichts geändert“. */
const FRIST_FEHLER = 'Keine Antwort vom Server — bitte prüfen, ob die Änderung ankam.';

/** Fragt den Server und liefert das gelesene JSON. Jede Anfrage endet spätestens mit der Frist; ihr Fehler hat die Form
    des Netzfehlers (`status: 0`, `daten: null`) und läuft durch dieselben Wege. Nichts wird von selbst erneut gesendet. */
async function api(methode, pfad, daten) {
  const headers = {};
  if (daten) headers['Content-Type'] = 'application/json';
  if (S.ich) headers['X-KanbanD-Wer'] = S.ich;
  const { r, text } = await mitFrist(async signal => {
    let r;
    try {
      r = await fetch(pfad, { method: methode, headers, body: daten ? JSON.stringify(daten) : undefined, signal });
    } catch (_) {
      throw Object.assign(new Error(NETZ_FEHLER), { status: 0, daten: null });
    }
    return { r, text: await r.text() };
  }, ANTWORT_FRIST_MS, () => Object.assign(new Error(FRIST_FEHLER), { status: 0, daten: null }));
  const json = text ? JSON.parse(text) : null;
  if (!r.ok) throw Object.assign(new Error(json && json.fehler || r.statusText), { status: r.status, daten: json });
  return json;
}

/* ── Vorschau in „Einrichten“ (R00250, ADR-0043 N1): Trockenlauf des Servers mit dem Rumpf, den „Speichern“ senden würde ── */
const VORSCHAU_ENTPRELLT_MS = 250;
const VORSCHAU_GEDAEMPFT_MS = 400;
/** Der Rumpf von `PUT /api/einstellungen` aus dem Entwurf — derselbe für „Speichern“ und die Vorschau. */
function einrichtenRumpf(einr) {
  const { fehler, gespeichert, ...entwurf } = einr;
  return { ...entwurf, klassen: ungestrichen(entwurf.klassen) };
}
const einrVorschau = vorschauTakt({
  // läuft nicht durch die Schlange: sie schreibt nicht und darf „Speichern“ nicht aufhalten (N1.2 Punkt 2)
  anfrage: () => api('POST', '/api/einstellungen/vorschau', einrichtenRumpf(S.ui.einr)).then(daten => ({ status: 200, daten }), f => ({ status: f.status || 0, daten: f.daten, meldung: f.message })),
  zeigen: z => { S.ui.vorschau = z; vorschauZeigen(); },
  uhr: { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: w => clearTimeout(w) },
  entprellMs: VORSCHAU_ENTPRELLT_MS,
  daempfMs: VORSCHAU_GEDAEMPFT_MS,
});
/** Den Stand der Vorschau ohne Neuzeichnen setzen — der Fokus bleibt im Feld. */
function vorschauZeigen() {
  const pre = $('#einr-vorschau'), zeile = $('#einr-vorschau-stand'), z = S.ui.vorschau;
  if (!pre || !zeile || !z) return;
  pre.textContent = z.text;
  pre.dataset.stand = z.stand;
  pre.setAttribute('aria-busy', String(z.stand === 'wartet'));
  pre.classList.toggle('gedaempft', z.gedaempft);
  zeile.textContent = z.meldung;
}
/** Fingerabdruck des Entwurfs: ändert ihn eine Aktion, fragt die Vorschau sofort (N1.2 Punkt 1). */
const einrFingerabdruck = () => (S.ui.einr ? JSON.stringify(einrichtenRumpf(S.ui.einr)) : null);

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
  const seite = { ansicht: S.ui.view, ersterStart: Boolean(S.ui.first), boardTitel: boardTitelDerSeite() };
  return `<h1 class="vh">${esc(seitenUeberschrift(seite))}</h1>`;
}
function boardTitelDerSeite() {
  if (S.boardDefekt || !S.board) return '';
  return S.board.titel;
}
/** Die Review-Seite trägt ihre Überschrift erster Ebene selbst im Kopf („Review“, R00207 FA 5). */
const vMain = () => {
  if (S.ui.view === 'review') return vReview();
  if (S.ui.view === 'lauf') return vLauf();
  return vSeitenUeberschrift() + vHaupt();
};

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
  return vBoard();
}

const kopie = x => JSON.parse(JSON.stringify(x));

function gewaehltesBoard(zustand) {
  const gewuenscht = adresseLesen(location.hash).slug;
  const slugs = [...zustand.boards.map(b => b.slug), ...defekteBoards(zustand)];
  let zuletzt = null;
  try { zuletzt = localStorage.getItem('kanbanD.board'); } catch (_) { }
  if (!gewuenscht && zuletzt && slugs.includes(zuletzt)) return zuletzt;
  return gewuenscht && slugs.includes(gewuenscht) ? gewuenscht : slugs[0] || null;
}

/** Was der Server zuletzt geliefert hat, und wohin die Adresse zeigt. Ein Ereignis, nach dem das gleich bleibt — das Echo
    eines eigenen Schreibzugriffs —, zeichnet nicht neu: sonst ersetzt
    es die Seite, während jemand klickt oder liest (R00061). */
let geladenerStand = null;
/** Der Grund, den `/api/zustand` unter `defekte` für die Board-Datei nennt — sonst leer. */
const defekterGrund = (slug, zustand) => ((zustand.defekte || []).find(d => d.pfad === 'boards/' + slug + '.md') || {}).fehler;
const serverStand = () => JSON.stringify([location.hash, S.zustand, S.board, S.boardDefekt, S.aufgaben, S.boards, S.bew, S.fieberCache, S.anwendungen, S.quellenStand, S.transkripteVorgabe, S.ui.datei, S.ui.anhaenge, S.ui.defektDatei]);

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
  if (einstellungenDefekt) zustand.einstellungen = { personen: [], klassen: [], quellen: { repository: '', anwendungen: [] } };
  const sicht = zustand.eingerichtet ? await sichtLaden(zustand) : null;
  if (!uebernehmen({ start, zuletzt: zuletztStand, marke, schlangeOffen: schlangeOffen() })) {
    wennVerworfen(zuletztStand > start);
    return false;
  }
  zuletztStand = start;
  fieberGesendet.clear();
  // Alles auf einmal übernehmen: eine Aktion oder ein Zeichnen während des Ladens sieht nie einen halben Stand (R00061).
  const neu = { zustand, einstellungenDefekt };
  if (sicht) Object.assign(neu, sicht.haupt);
  Object.assign(S, neu);
  if (sicht) await sichtFolgen(sicht, start);
  else S.ui.first = S.ui.first || { kuerzel: '', name: '', agenten: { cl: true }, board: 'Entwicklung', spalten: 'Zu erledigen, In Arbeit, Erledigt' };
  const nachgetragen = externNachtragen();
  const stand = serverStand();
  if (nurBeiAenderung && stand === geladenerStand && !nachgetragen) return false;
  geladenerStand = stand;
  render();
  fieberNachtragen();
}

/** Alles, was ein Laden für die Ansicht der Adresse liest — nur lokal gesammelt, übernommen erst über `sichtUebernehmen`. */
async function sichtLaden(zustand) {
  const hash = location.hash;
  const view = adresseLesen(hash).sicht;
  const slug = gewaehltesBoard(zustand);
  let fbFehler = null;
  // Das Board zuerst, dann was davon abhängt (R00061); sein Lesen schreibt nichts (ADR-0034 N4 Regel 3).
  let boardDefekt = null;
  // 423: Board-Datei defekt (R00025); 400: Dateiname nicht in Board-Form (R00104) — beide als Defektfläche, der Grund aus `defekte`
  const board = slug ? await api('GET', '/api/boards/' + encodeURIComponent(slug) + '?archivierte=ja').catch(f => { if (f.status !== 423 && f.status !== 400) throw f; boardDefekt = { slug, fehler: defekterGrund(slug, zustand) || f.message }; return null; }) : null;
  // Board-Berichte rechnen im Browser aus den Spaltenwechseln (R00042); die Board-Ansicht braucht sie für die Datums-Trenner (R00124).
  // Sie laufen in derselben Sammelabfrage wie die übrigen — ein einziger Aufbau, kein zusätzliches Zeichnen. Ein defektes
  // Board (423) wird gar nicht erst gefragt; in der Board-Ansicht ist ein Fehler kein Grund, die Seite nicht zu zeichnen.
  const bewegungenPfad = '/api/berichte/bewegungen?board=' + encodeURIComponent(slug || '');
  const bewegungenNoetig = Boolean(slug) && (view === 'board' ? !boardDefekt : /^berichte\/(verlauf|fluss|durchsatz|durchlauf|prognose|fieber)$/.test(view));
  const [aufgaben, boards, bew] = await Promise.all([
    api('GET', '/api/aufgaben'),
    // die Oberfläche zeigt das Archiv selbst und braucht deshalb die archivierten Karten in den Spalten (R00092)
    api('GET', '/api/boards?archivierte=ja'),
    bewegungenNoetig ? (view === 'board' ? api('GET', bewegungenPfad).catch(() => null) : api('GET', bewegungenPfad)) : Promise.resolve(null),
  ]);
  // Fever Chart (R00078): der Cache der gerechneten Tage
  const fieberCache = view === 'berichte/fieber' && slug ? await api('GET', `/api/boards/${encodeURIComponent(slug)}/fieber/cache`).catch(f => { if (f.status !== 423) throw f; fbFehler = f.message; return { abschnitte: [] }; }) : null;
  // Erreichbarkeit der registrierten Anwendungen zeigt nur die Einstellungsseite (R00053)
  const anwendungen = view === 'einrichten' ? await api('GET', '/api/anwendungen') : S.anwendungen;
  // dazu das Repository der Quellen, wie es gespeichert ist, mit Erreichbarkeit (R00209 AK 10)
  const einstellungen = view === 'einrichten' ? await api('GET', '/api/einstellungen') : null;
  const quellenStand = einstellungen ? quellenStandAus(einstellungen) : S.quellenStand;
  // die Vorgabe „Transkripte erfassen“, wie sie in kanbanD.md steht — /api/zustand trägt sie nicht (R00220 FA 6, ADR-0036 G8)
  const transkripteVorgabe = einstellungen ? einstellungen.transkripte_erfassen ?? null : S.transkripteVorgabe;
  return { view, slug, hash, fbFehler, haupt: { boardDefekt, board, aufgaben: aufgaben.aufgaben, boards, bew, fieberCache, anwendungen, quellenStand, transkripteVorgabe } };
}

/** Aus `GET /api/einstellungen`: das gespeicherte Repository der Quellen und ob sein Ordner da ist. */
function quellenStandAus(einstellungen) {
  return { repository: einstellungen.quellen.repository, erreichbar: einstellungen.quellen.erreichbar.repository };
}

/** Nach der Übernahme: die gelesene Sicht samt ihrer Folgen für Vollbild, Einrichten und gemerktes Board, dann das offene Fenster. */
async function sichtFolgen({ view, slug, hash, fbFehler }, start) {
  S.ui.first = null;
  const vorher = S.ui.view;
  S.ui.view = view;
  if (view !== vorher && S.ui.vollbild) vollbildSetzen(false);
  if (view !== 'einrichten') { S.ui.einr = null; S.ui.ts = null; einrVorschau.schliessen(); S.ui.vorschau = null; }
  else {
    if (!S.ui.einr) S.ui.einr = kopie(S.zustand.einstellungen);
    // beim Öffnen und nach jedem Nachladen: eine fremde Änderung an kanbanD.md ändert den Trockenlauf (N1.2 Punkt 1)
    einrVorschau.anstossen(true);
  }
  if (view === 'einrichten' && S.ui.zuTranskripten) { S.ui.zuTranskripten = false; S.ui.fokus = '#transkripte-kopf'; }
  S.ui.slug = slug;
  try { if (slug) localStorage.setItem('kanbanD.board', slug); } catch (_) { }
  if (fbFehler) S.ui.fbFehler = fbFehler;
  S.ui.bf = berichtsfilterAusBoard();
  if (hash !== adresseGefolgt && hash === location.hash) fensterDerAdresseFolgen(hash);
  if (S.ui.offen) await dateiLaden(start);
  if (S.ui.offenDefekt) await defektLaden(start);
  linkAuswerten();
}

/** Die Adresse, der das Fenster zuletzt gefolgt ist. Beim Laden und bei `hashchange` ist die Adresse die Wahrheit (ADR-0029
    Regel 2) — aber nur einmal je Adresse: ein Laden aus anderem Anlass (Live-Ereignis, eigene Änderung) öffnet kein Fenster
    wieder, das der Mensch inzwischen geschlossen hat, und schließt keines, das er inzwischen geöffnet hat. Ein Laden, das noch
    für eine frühere Adresse begann, folgt ihr nicht mehr. */
let adresseGefolgt = null;

/** Führt die Adresse dem Fenster nach (R00174 AK 2, ADR-0029 Regel 2) — ohne `hashchange`-Laden. Öffnen aus der Ansicht
    schreibt einen neuen Verlaufseintrag und markiert ihn; der Wechsel zu einer anderen Aufgabe ersetzt den Eintrag. Schließen
    stapelt nie: aus einem markierten Eintrag geht es im Verlauf einen Schritt zurück auf die Ansicht, aus jedem anderen
    (Link, Lesezeichen) ersetzt es den Eintrag durch die Adresse der Ansicht. Ist eine Navigation unterwegs (die Adresse ist
    noch nicht befolgt, ihre Ansicht noch nicht geladen, oder der Schritt zurück läuft), wird nichts geschrieben. */
function adresseNachfuehren() {
  const u = S.ui;
  const navigationUnterwegs = location.hash !== adresseGefolgt || rueckwegUnterwegs;
  const seiteMitAufgabenadresse = (u.view === 'board' && Boolean(u.slug)) || u.view === 'aufgaben';
  const adresse = adresseLesen(location.hash);
  const ansichtNochNichtGeladen = adresse.sicht !== u.view;
  if (navigationUnterwegs || !seiteMitAufgabenadresse || ansichtNochNichtGeladen) return;
  const gezeigt = u.offen || u.offenDefekt || null;
  if (adresse.nummer === gezeigt) return;
  const ziel = adresseBilden({ sicht: u.view, slug: u.slug, nummer: gezeigt });
  const geoeffnet = !adresse.nummer;
  const geschlossen = !gezeigt;
  if (geoeffnet) history.pushState(AUS_DER_ANSICHT_GEOEFFNET, '', ziel);
  else if (geschlossen && ausDerAnsichtGeoeffnet()) { rueckwegUnterwegs = true; history.back(); return; }
  else history.replaceState(history.state, '', ziel);
  adresseGefolgt = location.hash;
}

/** Marke am Verlaufseintrag eines Fensters, das in dieser Sitzung aus seiner Ansicht geöffnet wurde: der Eintrag davor ist
    dieselbe Ansicht ohne Fenster. Sie liegt im `history.state` des Eintrags und überlebt Zurück, Vor und Neuladen; ein Link
    oder Lesezeichen trägt sie nicht. */
const AUS_DER_ANSICHT_GEOEFFNET = { kdFensterAusAnsicht: true };
const ausDerAnsichtGeoeffnet = () => Boolean(history.state) && history.state.kdFensterAusAnsicht === true;

/** Wahr, solange der Schritt zurück nach dem Schließen läuft: `history.back()` meldet sich erst später mit `hashchange`. */
let rueckwegUnterwegs = false;

/** Der Schritt zurück nach dem Schließen ist angekommen: das Fenster ist schon weg, die Ansicht steht — die Adresse gilt als
    befolgt, ohne Laden. Wahr, wenn damit alles getan ist; hat der Mensch inzwischen eine Aufgabe geöffnet, bekommt sie jetzt
    ihre Adresse. Führt der Schritt wider Erwarten auf eine andere Ansicht, folgt ihr der übliche Weg. */
function rueckwegAngekommen() {
  rueckwegUnterwegs = false;
  const adresse = adresseLesen(location.hash);
  const dieselbeAnsicht = adresse.sicht === S.ui.view && (!adresse.slug || adresse.slug === S.ui.slug) && !adresse.nummer;
  if (!dieselbeAnsicht) return false;
  adresseGefolgt = location.hash;
  adresseNachfuehren();
  return true;
}

/** Stellt das Fenster auf die Aufgabe der Adresse (R00174): ohne Nummer schließt es, mit einer anderen Nummer wechselt es wie
    beim Klick auf eine andere Karte. Geladen wird über den Weg des Defekt-Fensters, der die drei Antworten des Servers schon
    unterscheidet (da, defekt, nicht da). Nur lesend — aus einer Adresse entsteht nie ein Schreibzugriff außer dem, den das
    Verlassen eines Felds mit Entwurf ohnehin auslöst. */
function fensterDerAdresseFolgen(hash) {
  const u = S.ui;
  const adresse = adresseLesen(hash);
  const gezeigt = u.offen || u.offenDefekt || null;
  if (adresse.nummer === gezeigt) { adresseGefolgt = hash; return; }
  fensterfeldVerlassen();
  u.offen = null; u.offenDefekt = null; u.defektDatei = null; u.datei = null; u.fensterMenue = null; u.entwurf = null;
  u.linkZiel = null;
  adresseGefolgt = hash;
  if (!adresse.nummer) return;
  // Hat das Verlassen einen Entwurf abgeschickt, übernimmt das Fenster erst mit dem Nachladen der Warteschlange eine Antwort
  // (R00110) — bis dahin steht nur das Ziel. Öffnet der Mensch inzwischen eine Aufgabe, verfällt es (fensterZuruecksetzen).
  fensterZuruecksetzen();
  u.offenDefekt = adresse.nummer;
  u.linkZiel = { nummer: adresse.nummer, slug: adresse.slug, hash };
}

/** Verlässt das Feld des Aufgabenfensters, in dem der Fokus steht — sein Entwurf wird gespeichert wie beim Schließen über ✕. */
function fensterfeldVerlassen() {
  verlassenNachholen();
  const feld = document.activeElement;
  const imFenster = Boolean(feld) && Boolean(feld.closest) && Boolean(feld.closest('#fenster'));
  if (imFenster && /INPUT|TEXTAREA|SELECT/.test(feld.tagName)) feld.blur();
}

/** Sagt nach dem Öffnen über eine Adresse, was nicht zum Link passt (R00174 AK 5) — je Link einmal und höchstens ein Hinweis.
    Genannt wird nur die geprüfte Nummer, nie Text aus der Adresse. Solange das Fenster seine Antwort noch nicht hat, wartet
    die Auswertung auf das nächste Laden. */
function linkAuswerten() {
  const u = S.ui;
  const ziel = u.linkZiel;
  if (!ziel) return;
  const antwortFehlt = u.offenDefekt === ziel.nummer && !u.defektDatei;
  if (antwortFehlt) return;
  u.linkZiel = null;
  const offen = u.offen === ziel.nummer || u.offenDefekt === ziel.nummer;
  if (!offen) {
    hinweisZeigen(`Aufgabe #${ziel.nummer} gibt es nicht`);
    adresseErsetzen(ziel.hash, null);
    return;
  }
  if (u.view !== 'board') return;
  if (ziel.slug !== u.slug) {
    hinweisZeigen('Board aus dem Link gibt es nicht');
    adresseErsetzen(ziel.hash, ziel.nummer);
    return;
  }
  if (!liegtAufDemGezeigtenBoard(ziel.nummer)) hinweisZeigen(`#${ziel.nummer} liegt nicht auf diesem Board`);
}

/** Wahr, wenn die Karte auf dem gezeigten Board zu sehen ist; eine archivierte nur bei eingeschaltetem Archiv. Ohne lesbares Board wahr. */
function liegtAufDemGezeigtenBoard(nummer) {
  if (!S.board) return true;
  const aufDemBoard = S.board.spalten.some(spalte => spalte.aufgaben.includes(nummer));
  const karte = aufgabe(nummer);
  const imArchivVerborgen = Boolean(karte) && Boolean(karte.archiviert) && !imArchiv();
  return aufDemBoard && !imArchivVerborgen;
}

/** Berichtigt die Adresse `hash` eines Links, der nicht passte, ohne neuen Verlaufseintrag: sie nennt danach, was gezeigt
    wird. Steht inzwischen eine andere Adresse da, bleibt sie stehen. */
function adresseErsetzen(hash, nummer) {
  const ohneBoard = S.ui.view === 'board' && !S.ui.slug;
  if (location.hash !== hash || ohneBoard) return;
  const berichtigt = adresseBilden({ sicht: S.ui.view, slug: S.ui.slug, nummer });
  history.replaceState(null, '', berichtigt);
  adresseGefolgt = location.hash;
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
    neu.tage[datum] = fieberTag(S.bew, S.ui.bf, aufgabe, datum, st.start, st.block && st.block.schluessel);
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

/** Lädt Datei und Anhänge des Fensters; übernommen nur, solange dieselbe Aufgabe offen ist und keine neuere Antwort
    des Fensters übernommen wurde (R00110, ADR-0014 Regel 6). Innerhalb von `laden` unter dessen Nummer `start`. `gleicherTakt`: das
    Umschalten aus der Reparatur hat das Fenster unter derselben Nummer schon übernommen — sie gilt dann als nicht überholt. */
async function dateiLaden(start = naechsterTakt(), { gleicherTakt = false } = {}) {
  const nummer = S.ui.offen;
  const aktuell = () => S.ui.offen === nummer && uebernehmen({ start, zuletzt: gleicherTakt ? zuletztFenster - 1 : zuletztFenster, marke, schlangeOffen: schlangeOffen() });
  try {
    const datei = await api('GET', '/api/aufgaben/' + nummer);
    const anhaenge = await api('GET', `/api/aufgaben/${nummer}/anhaenge`);
    // Der Reiter „Verlauf“ (R00123) rechnet bei jeder Änderung neu; ein Fehler trifft nur den Reiter, nicht die Datei
    let verlauf = null, verlaufFehler = null;
    if (S.ui.tab === 'verlauf') {
      try { verlauf = await api('GET', `/api/aufgaben/${nummer}/verlauf`); }
      catch (g) { verlaufFehler = g.message; }
    }
    if (!aktuell()) return;
    zuletztFenster = start;
    S.ui.datei = datei; S.ui.anhaenge = anhaenge;
    S.ui.verlauf = verlauf; S.ui.verlaufFehler = verlaufFehler;
  } catch (f) {
    if (!aktuell()) return;
    zuletztFenster = start;
    if (f.status === 404) S.ui.offen = null;
    S.ui.datei = null; S.ui.anhaenge = [];
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
    try { await anhangSenden(S.ui.offen, d, d.name); } catch (f) { fensterMelden(f.message, null, 'anhang-neu'); break; }
    gespeichertMelden(null, 'anhang-neu');
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
/** Ergebnis einer Anfrage, die `durchDieSchlange` gescheitert durch die Kette trägt. */
const GESCHEITERT = Symbol('gescheitert');
const eigene = warteschlangeFuehren({
  laden: () => laden(),
  vorLaden: () => { marke = takt; },
  gespeichert: ergebnis => { if (ergebnis !== GESCHEITERT) S.ui.gespeichert = Date.now(); },
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

/** Zustandswort am Feld „Repository“ beim Tippen nachführen, ohne neu zu zeichnen (der Fokus bleibt im Feld). */
function repositoryZustandZeigen(marke, wert, gespeichert) {
  if (!marke) return;
  const z = repositoryZustand(wert, gespeichert);
  marke.textContent = z.wort;
  marke.className = `erreich ${z.klasse}`;
}

/** Gibt die Sperre eines Auslösers frei, sobald seine Anfrage beantwortet ist — auch bei einem Fehlschlag (ADR-0025 Regel 2). */
function sperreFreigeben(laufender) {
  if (!laufender) return;
  laufender.frei = true;
  laufender.namen.forEach(sperre.beenden);
  sperrenMarkieren();
}

/** Jede schreibende Anfrage läuft durch die eine Stelle (ADR-0025 Regel 6, R00148 AK 17): die Warteschlange hält
    Reihenfolge und Kettenende, damit zwei Schreib-Auslöser nie überlappen. Die Ablehnung geht an den Aufrufer weiter,
    damit seine Meldung die einzige bleibt (R00147) — die Schlange meldet diesen Fehlschlag dann nicht. */
function durchDieSchlange(anfrage) {
  let ergebnis = null, fehler = null;
  // der Fehlschlag kommt erst nach dem Nachladen beim Aufrufer an; bis dahin trägt die Kette ihn als Marke, damit sie ihn nicht als gespeichert merkt (R00188 55-1)
  return warteschlange(() => Promise.resolve(anfrage()).then(r => { ergebnis = r; return r; }, f => { fehler = f; return GESCHEITERT; })).then(() => {
    if (fehler) throw fehler;
    return ergebnis;
  });
}

/** Die Klassenliste, die der Klassen-Editor gerade bearbeitet: in „Spalten einrichten“ die eigenen Klassen des Boards,
    sonst die Vorgabe des Ordners in „Einrichten“ (R00195: ein Editor, zwei Orte). */
const klassenEntwurf = () => S.ui.setup ? S.ui.setup.klassen : S.ui.einr.klassen;
/** Die Meldung des Klassen-Editors steht dort, wo er steht. */
function klassenFehlerSetzen(text) {
  if (S.ui.setup) S.ui.setup.klassenFehler = text; else S.ui.einr.fehler = text;
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
    aus dem der Aufruf kommt: eine Ablehnung macht es ungültig, die angenommene Eingabe ist kein Entwurf mehr (ADR-0015 N2).
    Wahr, wenn der Server angenommen hat — die stehende Meldung sagt das nicht, sie kann von einer früheren Aktion sein (R00185 108-2). */
function schreiben(methode, pfad, daten, feld = null) {
  const ausloeser = anfrageName(methode, pfad);
  return durchDieSchlange(async () => {
    try {
      await api(methode, pfad, daten);
      gespeichertMelden(feld, ausloeser);
      if (feld) S.ui.entwurf = null;
      return true;
    } catch (f) {
      fensterMelden(f.message, feld, ausloeser);
      S.ui.fehler = f.message;
      // innen die Marke für die Kette (sonst stempelt sie „gespeichert“, R00188 55-1), nach außen ein Wahrheitswert (R00185 108-2)
      return GESCHEITERT;
    }
  }).then(r => r !== GESCHEITERT);
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

/** Legt die gemerkte Herkunft an ihre Stelle der heute gezeigten Liste zurück (R00185 102-1, 102-2). Ist die Aufgabe
    inzwischen fort, gibt es keine Liste zum Einsetzen: das ist eine Ablehnung wie jede andere (108-1). */
function herkunftZuruecklegen(z) {
  let stelle = 0;
  const senden = async () => {
    const a = aufgabe(z.nummer);
    if (!a) throw new Error(`#${z.nummer} gibt es nicht mehr`);
    const liste = herkunftZurueckgelegt(a.herkunft, z.wert, z.index);
    stelle = liste.indexOf(z.wert);
    return durchDieSchlange(() => api('PATCH', `/api/aufgaben/${z.nummer}`, { herkunft: liste }));
  };
  return rueckgaengigAusfuehren(senden, () => `Herkunft ${herkunftAnzeige(z.wert)} wiederhergestellt`, gelungen => {
    const ziele = [];
    if (gelungen) ziele.push(knopfSelektor('herkunft-weg', stelle));
    ziele.push('#herkunft-neu');
    return ziele;
  });
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
    if (S.ui.offen) meldungNachErfolgRaeumen(null, RUECKGAENGIG);
  } catch (f) {
    S.ui.fokus = ziele(false);
    // Ist das Aufgabenfenster oberster Dialog, gehört die Ablehnung in dessen Fuß (ADR-0015), sonst in den Hinweis darüber
    const imFensterFuss = hinweisDialog() === 'fenster';
    if (imFensterFuss) fensterMelden(`nicht rückgängig: ${f.message}`, null, RUECKGAENGIG);
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
    Eine neue Meldung nimmt den Platz: die abgelehnte Eingabe eines anderen Felds geht mit ihrer Meldung (R00155 G-3 c).
    `ausloeser` nennt die Aktion, die gescheitert ist: nur ihr Erfolg räumt eine Meldung ohne Feld (R00185 108-2).
    Ein Fehlschlag nimmt auch „gespeichert …“ aus dem Fuß: daneben stünde sonst ein Erfolg, den es nicht gab (R00188 55-1). */
function fensterMelden(text, feld = null, ausloeser = null) {
  if (text) {
    abgelehnteEingabeRaeumen(feld);
    S.ui.gespeichert = null;
  }
  S.ui.fensterFehler = text;
  S.ui.fensterFehlerFeld = feld;
  S.ui.fensterFehlerAusloeser = ausloeser;
  // jede gesetzte Meldung ist eine neue, auch mit gleichem Text — sie bekommt einen neuen Knoten (R00189)
  S.ui.fensterMeldungNr = (S.ui.fensterMeldungNr || 0) + 1;
}

/** Setzt den Knoten der Fenstermeldung aus dem vorigen Zeichnen an die Stelle des frisch gezeichneten, wenn es dieselbe
    Meldung ist: ein Vorleseprogramm sagt sie dann nicht bei jedem Neuzeichnen wieder an (R00189, ADR-0015 N3). `vorher` ist
    nur gesetzt, wenn dasselbe Aufgabenfenster offen blieb; Text und Kennung kommen weiter aus `S.ui.fensterFehler`. */
function meldungsknotenBehalten(vorher) {
  const neu = document.getElementById(FENSTER_MELDUNG);
  const dieselbe = vorher && neu && vorher.dataset.meldung === neu.dataset.meldung && vorher.textContent === neu.textContent;
  if (dieselbe) neu.replaceWith(vorher);
}

/** Der Datumsknoten der Personenseite bleibt beim Neuzeichnen derselbe und wechselt nur seinen Text: so sagt ein
    Bildschirmleser den neuen Tag an (aria-live, R00199 AK 6b, WCAG 4.1.3). */
function datumsknotenBehalten(vorher) {
  const neu = document.getElementById(PERSONEN_TAG);
  if (!vorher || !neu) return;
  neu.replaceWith(vorher);
  if (vorher.textContent !== neu.textContent) vorher.textContent = neu.textContent;
}

/* ── Ansicht „Commits“ (R00205): gelesen wird beim Öffnen der Ansicht und über „Neu lesen“, sonst nie ── */
const COMMITS_STATUS = 'commits-status';

/** Der Statusbereich der Ansicht bleibt beim Neuzeichnen derselbe Knoten und wechselt nur Klasse und Text: so sagt ein
    Bildschirmleser den neuen Stand an (R00205 AK 6/10, WCAG 4.1.3), und ein Wechsel der Aufgabe hält ihn nicht fest. */
function commitsStatusBehalten(vorher) {
  const neu = document.getElementById(COMMITS_STATUS);
  if (!vorher || !neu || vorher === neu) return;
  neu.replaceWith(vorher);
  vorher.className = neu.className;
  // nur ein neuer Text ist eine Ansage: derselbe Text bei jedem Neuzeichnen hieße für einen Beobachter jedes Mal eine (R00218 AK 13)
  if (vorher.textContent !== neu.textContent) vorher.textContent = neu.textContent;
}

/* ── Ansicht „Läufe“ (R00219, ADR-0039 L2): gelesen wird beim Öffnen, über „Neu lesen“ / „Erneut versuchen“ und genau einmal,
   wenn sich die Menge der Kennungen in `a.transkripte` nach einem Live-Ereignis ändert; Kosten zeichnen ohne Lesen ── */
const LAEUFE_KNOTEN = ['laeufe-status', 'laeufe-neu', 'laeufe-erneut'];
/** Statusbereich und „Erneut versuchen“ der Laufansicht bleiben beim Neuzeichnen dieselben Knoten (FA 8, FA 11). */
const LAUF_KNOTEN = ['lv-status', 'lv-erneut'];

/** Vor jedem Zeichnen: ist „Läufe“ die gezeigte Ansicht, liest sie, wenn für diese Aufgabe noch nichts gelesen ist oder die
    Kennungsmenge seit dem letzten Lesen eine andere ist; ist es nicht die gezeigte Ansicht, fällt der Zustand weg. */
function laeufeAnstossen() {
  const nr = S.ui.offen, a = nr && aufgabe(nr);
  if (!a || ansichtDerAufgabe(a) !== 'laeufe') { S.ui.laeufe = null; return; }
  const l = S.ui.laeufe;
  if (l && l.nr === nr && !kennungsmengeGeaendert(a.transkripte || [], l.kennungen)) return;
  laeufeLesen(nr);
}

/** Liest `GET /api/aufgaben/{nr}/transkripte`. Bis zur Antwort bleibt das letzte Ergebnis stehen; die Antwort gilt nur, wenn
    dieses Lesen das neueste ist, die Aufgabe noch dieselbe offen und „Läufe“ noch die gezeigte Ansicht (ADR-0014). Der Fokus
    wandert nur von „Erneut versuchen“ nach einem Erfolg auf „Neu lesen“ — und nur, wenn er beim Eintreffen noch dort liegt. */
/* ── Schalter „Transkripte erfassen“ (R00220, ADR-0036 Nachtrag „Umschalten“): nicht Teil des Entwurfs von „Einrichten“ ── */
/** Der geschriebene Wert: an der Vorgabe aus GET /api/einstellungen, am Board aus GET /api/boards. */
function schalterGespeichert(slug) {
  if (slug === null) return S.transkripteVorgabe ?? null;
  const b = (S.boards || []).find(x => x.slug === slug);
  return b ? b.transkripte_erfassen ?? null : null;
}

/** Ein Umschalten: sofort ein PUT durch den Schreibweg; bis zur Antwort ist nur diese Gruppe gesperrt und zeigt die neue Wahl.
    Erfolg: der geschriebene Wert gilt sofort (auch für Boards „wie Vorgabe“ und die Vorschau), der Satz nach der wirksamen Lage.
    Fehler: die Wahl springt zurück, der Satz nennt Meldung und Status; nur ohne Verbindung mit „Erneut versuchen“. */
function schalterUmstellen(slug, wahl) {
  const schluessel = slug === null ? '' : slug;
  const pfad = slug === null ? '/api/einstellungen/transkripte' : `/api/boards/${encodeURIComponent(slug)}/transkripte`;
  const titel = slug === null ? null : ((S.boards || []).find(b => b.slug === slug) || { titel: slug }).titel;
  const tsVorher = S.ui.ts = S.ui.ts || {};
  tsVorher[schluessel] = { ...(tsVorher[schluessel] || {}), laeuft: wahl };
  durchDieSchlange(() => api('PUT', pfad, schalterRumpf(slug, wahl))).then(antwort => {
    if (slug === null) { S.transkripteVorgabe = antwort.erfassen; if (S.ui.einr) einrVorschau.anstossen(true); }
    else (S.boards || []).filter(b => b.slug === slug).forEach(b => { b.transkripte_erfassen = antwort.erfassen; });
    return { art: 'ok', text: schalterErfolgsSatz(titel, antwort.wirksam) };
  }, f => ({ art: 'fehler', text: schalterFehlerSatz({ status: f.status || 0, fehler: f.message }), erneut: f.status ? null : wahl })).then(satz => {
    // Ansicht inzwischen verlassen: nichts zu zeichnen
    if (S.ui.ts !== tsVorher) return;
    const aufErneut = document.activeElement && document.activeElement.matches('.ts-erneut');
    tsVorher[schluessel] = { laeuft: null, satz };
    if (aufErneut) S.ui.fokus = `[data-ts="${CSS.escape(schluessel)}"] [role="radio"][aria-checked="true"]`;
    render();
  });
}

async function laeufeLesen(nr) {
  const vorher = S.ui.laeufe && S.ui.laeufe.nr === nr ? S.ui.laeufe : null;
  const kennungen = (aufgabe(nr).transkripte || []).map(t => t.kennung);
  const lauf = S.ui.laeufe = { nr, laedt: true, kennungen, ergebnis: vorher ? vorher.ergebnis : null, insel: vorher ? vorher.insel : null };
  let ergebnis;
  try {
    ergebnis = { art: 'liste', antwort: await api('GET', `/api/aufgaben/${nr}/transkripte`), stand: uhr(Date.now()) };
  } catch (g) {
    ergebnis = { art: 'fehler', fehler: { status: g.status || 0, fehler: g.message } };
  }
  const a = S.ui.offen === nr && aufgabe(nr);
  if (S.ui.laeufe !== lauf || !a || ansichtDerAufgabe(a) !== 'laeufe') return;
  S.ui.laeufe = { ...lauf, laedt: false, ergebnis };
  const aufErneut = document.activeElement && document.activeElement.id === 'laeufe-erneut';
  if (aufErneut && ergebnis.art === 'liste') S.ui.fokus = '#laeufe-neu';
  // Zurück aus der Laufansicht (FA 3): Fokus auf „Ansehen“ derselben Kennung, sonst auf die Überschrift von „Läufe“
  const zurueck = S.ui.fokusNachLaeufe;
  if (zurueck && zurueck.nr === nr) {
    S.ui.fokusNachLaeufe = null;
    const ansehen = ergebnis.art === 'liste' && zurueck.kennung && ergebnis.antwort.transkripte.some(t => t.kennung === zurueck.kennung && t.zustand === 'vorhanden');
    S.ui.fokus = ansehen ? `#fenster a.lf-an[data-arg="${CSS.escape(zurueck.kennung)}"]` : '#laeufe-kopf';
  }
  render();
}

/** Die Tabelle der Ansicht als Insel (ADR-0039 N1): ist ihr HTML-Text gleich dem zuletzt eingesetzten derselben Aufgabe, bleibt
    der alte Knoten im Dokument, und `#over` wird entlang des Pfads zu ihm abgeglichen statt neu geschrieben. Der Text ist der
    Schlüssel und liegt in `S.ui.laeufe.insel` — so kann kein Eingang (Antwort, Kosten, Zustandswort) vergessen werden. */
const LAEUFE_INSEL_PLATZHALTER = '<div class="lf-rahmen" id="lf-insel"></div>';

/** Baut den Text der Tabelle, vergleicht ihn mit dem zuletzt eingesetzten und merkt den neuen als Schlüssel in `S.ui.laeufe.insel`.
    Liefert `{text, gehalten}`: `gehalten` ist die alte Tabelle, wenn sie stehen bleibt, sonst `null`; ohne Ansicht beides `null`. */
function laeufeInselVergleichenUndMerken() {
  const l = S.ui.laeufe, a = S.ui.offen && !S.ui.setup && aufgabe(S.ui.offen);
  if (!l || !a || ansichtDerAufgabe(a) !== 'laeufe') return { text: null, gehalten: null };
  const basis = S.ui.view === 'aufgaben' ? 'aufgaben' : 'board';
  const ansehen = kennung => laufAdresseBilden({ basis, slug: S.ui.slug, nummer: S.ui.offen, kennung });
  const text = laeufeTabelleHtml(l, a.kosteneintraege || [], esc, ansehen);
  const alt = $('#over').dataset.offen === String(S.ui.offen) ? document.getElementById('lf-insel') : null;
  const gleich = Boolean(alt && text && l.insel === text);
  l.insel = text;
  return { text, gehalten: gleich ? alt : null };
}

/** `#over` neu zeichnen: steht die Insel, auf dem Weg von `hauptbereichErsetzen` (sie bleibt im Dokument); weicht dabei der Pfad
    ab, steht nach dem Ersetzen der leere Platzhalter — an seine Stelle kommt der Text der Tabelle (Code-Review #217 Sollte 1). */
function ueberErsetzen(html, insel) {
  const ueber = $('#over');
  if (!insel.gehalten) { ueber.innerHTML = html; return; }
  if (hauptbereichErsetzen(ueber, html, null, insel.gehalten)) return;
  document.getElementById('lf-insel').outerHTML = insel.text;
}

/** Statusbereich, „Neu lesen“ und „Erneut versuchen“ bleiben beim Neuzeichnen dieselben Knoten (R00219 AK 10): sie übernehmen
    nur Attribute und Inhalt des neu gezeichneten Knotens. So sagt der Statusbereich nur eine Änderung an, und der Fokus bleibt. */
function laeufeKnotenBehalten(vorher) {
  for (const alt of vorher) {
    const neu = document.getElementById(alt.id);
    if (!neu || neu === alt) continue;
    for (const name of alt.getAttributeNames()) if (!neu.hasAttribute(name)) alt.removeAttribute(name);
    for (const name of neu.getAttributeNames()) if (alt.getAttribute(name) !== neu.getAttribute(name)) alt.setAttribute(name, neu.getAttribute(name));
    if (alt.innerHTML !== neu.innerHTML) alt.innerHTML = neu.innerHTML;
    neu.replaceWith(alt);
  }
}

/** Die Live-Region „<k> von <n> gesehen“ trägt nach jedem Zeichnen den aktuellen Text und bleibt derselbe Knoten, solange sie dieselbe
    Seite meint (R00246 FA 2). Ihr Text wird nur mit `aria-live` geändert, wenn ein Haken ihn ändert (`gesehenAnsage` der Seite,
    einmal verbraucht); das Nachführen beim Laden, Nachladen oder Blättern geschieht bei entferntem `aria-live` und sagt nichts an.
    Zu einem anderen Commit kommt ein neuer Knoten mit dem Text des neuen Stands. `aria-live` kommt per `setTimeout(0)` zurück —
    beim Einhängen wie beim Nachführen. */
function gesehenAnsageBehalten(vorher) {
  const neu = document.getElementById('rv-gesehen');
  if (!neu || vorher === neu) return;
  const ansage = S.ui.review && S.ui.review.gesehenAnsage;
  if (S.ui.review) S.ui.review.gesehenAnsage = '';
  if (vorher && vorher.dataset.fuer === neu.dataset.fuer) {
    const text = neu.textContent;
    const haken = Boolean(ansage) && vorher.textContent !== ansage;
    if (haken) vorher.setAttribute('aria-live', 'polite');
    else vorher.removeAttribute('aria-live');
    neu.replaceWith(vorher);
    vorher.textContent = haken ? ansage : text;
  }
  setTimeout(() => {
    const region = document.getElementById('rv-gesehen');
    if (region) region.setAttribute('aria-live', 'polite');
  }, 0);
}

/** „i von n“ der Review-Seite bleibt derselbe Knoten (`aria-live`, R00207 FA 3): nur so sagt ein Bildschirmleser den Schritt an. */
function ansageBehalten(vorher, id) {
  const neu = document.getElementById(id);
  if (!vorher || !neu || vorher === neu) return;
  neu.replaceWith(vorher);
  if (vorher.textContent !== neu.textContent) vorher.textContent = neu.textContent;
}

/** Vor jedem Zeichnen: ist „Commits“ die gezeigte Ansicht und für diese Aufgabe noch nichts gelesen, beginnt das Lesen jetzt (einmal);
    ist es nicht die gezeigte Ansicht, fällt der Zustand weg — das nächste Öffnen liest neu. Ein Live-Ereignis liest nie neu. */
function commitsAnstossen() {
  const nr = S.ui.offen, a = nr && aufgabe(nr);
  if (!a || ansichtDerAufgabe(a) !== 'commits') { S.ui.commits = null; return; }
  if (S.ui.commits && S.ui.commits.nr === nr) return;
  commitsLesen(nr);
}

/** Liest `GET /api/aufgaben/{nr}/commits` und zeichnet das Ergebnis — aber nur, wenn die Aufgabe noch dieselbe offen und
    „Commits“ noch dieselbe Ansicht ist und niemand inzwischen neu gelesen hat; sonst wird die Antwort verworfen (R00205 AK 6). */
async function commitsLesen(nr, { still = false, fokusAuf = null, ausloeser = null } = {}) {
  const vorher = S.ui.commits && S.ui.commits.nr === nr ? S.ui.commits : null;
  // still (nach Ersetzen oder Entfernen, R00218 AK 9): die Liste bleibt stehen, der Statusbereich behält den Satz des Erfolgs
  const lauf = S.ui.commits = still && vorher && vorher.status === 'liste' ? { ...vorher, nf: null }
    : { nr, status: 'laedt', eintraege: [], stand: vorher ? vorher.stand : null, klappen: new Set() };
  let ergebnis;
  try {
    const antwort = await api('GET', `/api/aufgaben/${nr}/commits`);
    ergebnis = { status: 'liste', eintraege: antwort.commits, stand: uhr(Date.now()) };
  } catch (g) {
    ergebnis = { status: 'fehler', fehler: { status: g.status || 0, fehler: g.message }, stand: lauf.stand };
  }
  const a = S.ui.offen === nr && aufgabe(nr);
  if (S.ui.commits !== lauf || !a || ansichtDerAufgabe(a) !== 'commits') return;
  S.ui.commits = still ? { nr, klappen: new Set(), ...ergebnis, ansage: lauf.ansage, erfolg: lauf.erfolg } : { nr, klappen: new Set(), ...ergebnis };
  // Fokus auf den Kurz-Hash-Verweis des Nachfolgers — erst jetzt, da der Satz im Statusbereich steht, und nur vom Auslöser oder body (AK 13)
  if (fokusAuf && ergebnis.status === 'liste' && ergebnis.eintraege.some(e => e.verweis === fokusAuf) && fokusNochAm(ausloeser)) {
    S.ui.fokus = `#fenster a.cl-ziel[data-arg="${CSS.escape(fokusAuf)}"]`;
  }
  // Zurück von der Review-Seite (R00207 FA 13): Fokus auf den Verweis, von dem sie geöffnet wurde, sonst auf die Ansichtswahl
  const zurueck = S.ui.fokusNachListe;
  if (zurueck && zurueck.nr === nr) {
    S.ui.fokusNachListe = null;
    const verweis = zurueck.verweis && ergebnis.status === 'liste' && ergebnis.eintraege.some(e => e.verweis === zurueck.verweis);
    S.ui.fokus = verweis ? `#fenster a.cl-ziel[data-arg="${CSS.escape(zurueck.verweis)}"]` : '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
  }
  render();
}

/* ── Review-Seite eines Commits (R00207, ADR-0033): eigene Adresse, zwei Anfragen beim Öffnen, Diffbereich als stehende Insel ── */

/** Marke am Verlaufseintrag einer Review-Seite, die aus der Ansicht „Commits“ geöffnet wurde: der Eintrag davor ist das Fenster. */
const REVIEW_AUS_DER_LISTE = { kdReviewAusListe: true };
const reviewAusDerListe = () => Boolean(history.state) && history.state.kdReviewAusListe === true;
/** Fristen des Diffs (ADR-0033 Punkt 3, ADR-0032 N4.1/N5.1): bis zum Kopf und für den Rumpf. */
const DIFF_FRIST_KOPF_MS = 15000;
const DIFF_FRIST_RUMPF_MS = 60000;
/** Bis zu dieser Breite stehen „Zurück“ und „Vor“ als Symbolknöpfe (R00207 FA 3). */
const reviewSchmal = () => matchMedia('(max-width:640px)').matches;

/** Liest den Diff mit eigener Frist: 15 s bis zum Kopf, 60 s für den Rumpf. Fehler haben die Form von `api` (`status`, `message`,
    `daten`); eine abgelaufene Frist zählt als Zeitgrenze (503). Ein Abbruch durch den Browser gibt das Budget des Servers frei;
    `abbruchSignal` bricht von außen ab (Adresswechsel), die Antwort wird dann ohnehin verworfen. */
async function diffHolen(pfad, abbruchSignal = null) {
  return mitFristen(pfad, abbruchSignal, async (r, netzFehler) => {
    if (!r.ok) await antwortFehler(r, netzFehler);
    let text;
    try { text = await r.text(); } catch (_) { throw netzFehler(); }
    try { return text ? JSON.parse(text) : null; } catch (_) { return null; }
  });
}

/** Die Frist-Mechanik des Diffs, geteilt mit der Laufansicht (ADR-0041 Punkt 4): 15 s bis zum Kopf, dann 60 s für `rumpf(r,
    netzFehler, abbruch)`. `netzFehler()` ist der Fehler eines gescheiterten Lesens — nach Ablauf der Frist die Zeitgrenze (503,
    `frist`), sonst keine Verbindung (0). */
async function mitFristen(pfad, abbruchSignal, rumpf) {
  const abbruch = new AbortController();
  if (abbruchSignal) abbruchSignal.addEventListener('abort', () => abbruch.abort(), { once: true });
  let frist = setTimeout(() => abbruch.abort(), DIFF_FRIST_KOPF_MS);
  const netzFehler = () => {
    if (abbruch.signal.aborted) return Object.assign(new Error('Das Programm antwortete nicht innerhalb der Frist'), { status: 503, daten: null, frist: true });
    return Object.assign(new Error(NETZ_FEHLER), { status: 0, daten: null });
  };
  try {
    let r;
    try { r = await fetch(pfad, { signal: abbruch.signal }); } catch (_) { throw netzFehler(); }
    clearTimeout(frist);
    frist = setTimeout(() => abbruch.abort(), DIFF_FRIST_RUMPF_MS);
    return await rumpf(r, netzFehler, abbruch);
  } finally {
    clearTimeout(frist);
  }
}

/** Wirft den Fehler einer Antwort ohne Erfolg in der Form von `api` (`status`, `message` aus `fehler`, `daten`). */
async function antwortFehler(r, netzFehler) {
  let text;
  try { text = await r.text(); } catch (_) { throw netzFehler(); }
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  throw Object.assign(new Error((json && json.fehler) || r.statusText), { status: r.status, daten: json });
}

const fehlerVon = g => ({ status: g.status || 0, fehler: g.message, daten: g.daten || null });

/** Vor jedem Zeichnen: ist die Review-Seite gezeigt und ihre Adresse neu, beginnt das Lesen jetzt (einmal je Adresse); ein Wechsel
    des Commits derselben Aufgabe liest nur den Diff. Ist sie nicht gezeigt, fällt ihr Zustand weg. Ein Live-Ereignis liest nie. */
function reviewAnstossen() {
  if (S.ui.view !== 'review') {
    if (S.ui.review) {
      S.ui.fokusNachListe = { nr: S.ui.review.nr, verweis: S.ui.review.herkunft };
      reviewNachladenAbbrechen(S.ui.review);
      reviewAlleAbbrechen(S.ui.review);
    }
    S.ui.review = null;
    return;
  }
  const hash = location.hash, adresse = adresseLesen(hash);
  const a = adresse.review;
  let r = S.ui.review;
  if (!a || (r && r.adresse === hash)) return;
  const gleicheSeite = Boolean(r) && r.nr === a.nummer && r.basis === a.basis && r.slug === adresse.slug;
  if (r) { reviewNachladenAbbrechen(r); reviewAlleAbbrechen(r); }
  if (!gleicheSeite) {
    r = S.ui.review = { nr: a.nummer, basis: a.basis, slug: adresse.slug, liste: null, diff: null, alle: null, klappenJe: {}, herkunft: S.ui.reviewHerkunft || null, richtung: null, gesehen: new Set(), gesehenOffen: [], gesehenFehler: false };
    S.ui.reviewHerkunft = null;
  }
  let ansicht = 'commit';
  if (!a.commit && !a.ungueltig) ansicht = 'alle';
  // jede Adresse beginnt wie beim Laden: die linke Spalte hinter dem Aufklapper zu (R00235 FA 11)
  // die Ansage der Wahl gilt nur für die Adresse, die die Leiste gewählt hat (R00245 FA 6); die Zweigliste beginnt zu (FA 9)
  Object.assign(r, { adresse: hash, commit: a.commit, ungueltig: a.ungueltig, ansicht, fokusOffen: true, laufend: null, schlange: [], railOffen: false, zweigeOffen: false, wahlAnsage: r.wahlNaechste || '', wahlNaechste: null, gesehenAnsage: null });
  if (a.ungueltig) { r.diff = null; reviewFokus(r); return; }
  if (!gleicheSeite) reviewListeLesen(r);
  r.diff = null;
  r.alle = null;
  // „Alle Änderungen“ (R00210 FA 1): die Adresse bleibt, gelesen wird der Gesamt-Diff; kein Zustand übersteht das Umschalten
  if (ansicht === 'alle') reviewAlleLesen(r);
  else if (a.commit.includes(':')) reviewDiffLesen(r, a.commit);
  else reviewPraefixAufloesen(r);
}

/** Ein Präfix ohne Kürzel aus einem geteilten Link (R00207 AK 2): die API kennt Präfixe nur mit Kürzel (R00206 FA 2). Ist die Liste
    da, wird er über die Hashes aller Einträge mit Hash zum vollen Verweis; passt er zu keinem oder zu mehreren, geht er wörtlich
    hinaus und die API sagt, was ihm fehlt. Ohne Liste geht er nie hinaus: liest sie noch, wartet er, scheitert sie, meldet die Seite
    das mit „Erneut versuchen“ (reviewBild). Gezählt wird danach wie immer über den vollen Hash der Antwort (Rand a). */
function reviewPraefixAufloesen(r) {
  if (!r.commit || r.commit.includes(':') || r.diff || !r.liste || r.liste.status !== 'da') return;
  const praefix = r.commit.toLowerCase();
  const passend = r.liste.eintraege.filter(e => e.hash && e.hash.toLowerCase().startsWith(praefix));
  reviewDiffLesen(r, passend.length === 1 ? passend[0].verweis : r.commit);
}

/** „Erneut versuchen“ am Diff: liest den Verweis, der zuletzt hinausging — beim Präfix ohne Kürzel also den aufgelösten; ging
    noch keiner hinaus, wird der Präfix wie beim ersten Mal über die Liste aufgelöst (Code-Review #209 M1). */
function reviewDiffWiederholen(r) {
  const verweis = r.diff ? r.diff.verweis : r.commit;
  r.diff = null;
  if (verweis.includes(':')) reviewDiffLesen(r, verweis);
  else reviewPraefixAufloesen(r);
}

/* ── Nachfolger eines verwaisten Commits (R00218 FA 9–13): gesucht wird nur auf Klick, höchstens eine Suche und ein Ergebnis je Aufgabe;
   Zustand in `S.ui.commits.nf`, eine späte Antwort gilt nur, solange Aufgabe, Ansicht, Liste und Suche dieselben sind. ── */

/** Liegt der Fokus noch auf dem Auslöser (Kennung) oder auf `body`? Nur dann führt die Oberfläche ihn weiter (AK 13). Ein Auslöser, der beim
    Neuzeichnen wegfiel, hat den Fokus auf `body` zurückgelassen und zählt so mit. */
function fokusNochAm(kennung) {
  const aktiv = document.activeElement;
  return !aktiv || aktiv === document.body || (kennung && aktiv.id === kennung);
}

/** Wird an der Aufgabe gerade gesucht oder geschrieben? Dann sind alle Auslöser der Suche gesperrt (AK 7, AK 10). */
const nachfolgerGesperrt = c => Boolean(c.nf && (c.nf.status === 'laedt' || c.nf.schreibt));

/** Die Werte, mit denen web/commits.js das Ergebnis zeichnet. */
function nachfolgerAnsicht(c) {
  const nf = c.nf;
  if (!nf) return { verweis: null, laedt: null, deutung: null, klappen: new Set(), schreibt: null, meldung: null, gesperrt: false };
  return {
    verweis: nf.verweis, laedt: nf.status === 'laedt' ? nf.verweis : null,
    deutung: nf.status === 'da' ? nachfolgerDeuten(nf.antwort, nf.verweis, nf.gewechselt) : null,
    klappen: nf.klappen, schreibt: nf.schreibt, meldung: nf.meldung, gesperrt: nachfolgerGesperrt(c),
  };
}

/** Gilt die Antwort noch? Dieselbe Aufgabe offen, „Commits“ gezeigt, dieselbe Liste und dieselbe Suche. */
function nachfolgerNoch(c, nf) {
  const a = S.ui.offen === c.nr && aufgabe(c.nr);
  return Boolean(a && ansichtDerAufgabe(a) === 'commits' && S.ui.commits === c && c.nf === nf);
}

/** „Nachfolger suchen“ und „Erneut versuchen“: genau ein `GET …/nachfolger`; ein angezeigtes Ergebnis verschwindet. */
async function nachfolgerSuchen(verweis) {
  const c = S.ui.commits;
  if (!c || c.status !== 'liste' || nachfolgerGesperrt(c)) return;
  const i = c.eintraege.findIndex(e => e.verweis === verweis && e.zustand === 'verwaist');
  if (i < 0) return;
  const ausloeser = `nf-such-${i}`;
  const nf = c.nf = { verweis, status: 'laedt', ausloeser, klappen: new Set(), gewechselt: new Set(), meldung: null, schreibt: null };
  // angesagt wird „Sucht …“ im einen Statusbereich der Liste, nicht am Fokusziel (AK 13); der Fokus bleibt am Auslöser des Eintrags
  c.ansage = NACHFOLGER_LAEDT;
  c.erfolg = false;
  if (fokusNochAm(ausloeser) || document.activeElement.id === 'nf-erneut') S.ui.fokus = '#' + ausloeser;
  render();
  let antwort;
  try {
    antwort = { status: 200, rumpf: await api('GET', `/api/aufgaben/${c.nr}/commits/${encodeURIComponent(verweis)}/nachfolger`) };
  } catch (g) {
    antwort = { status: g.status || 0, fehler: g.message };
  }
  if (!nachfolgerNoch(c, nf)) return;
  nf.status = 'da';
  nf.antwort = antwort;
  // Start und Ergebnis sind zwei Ereignisse (PO Z. 487, R00218 FA 13): steht der Fokus noch am Auslöser oder auf body, wird der Statusbereich
  // still geleert und die Gruppe bekommt den Fokus (ihr erster Satz ist ihre Beschreibung); sonst steht der erste Satz der Gruppe im
  // Statusbereich, und der Fokus bleibt, wo der Mensch ihn hingesetzt hat
  if (fokusNochAm(ausloeser)) {
    c.ansage = '';
    S.ui.fokus = '#nf-gruppe';
  } else {
    const d = nachfolgerDeuten(antwort, verweis, nf.gewechselt);
    c.ansage = d.kopf || d.saetze[0];
  }
  render();
}

/** „Ersetzen“ (`POST …/commits/ersetzen` mit genau dem Paar) und „Verwaisten Verweis entfernen“ (`DELETE …/commits/<verwaist>`) über den
    einen Schreibweg (ADR-0025 Regel 6), ohne Dialog. Danach liest die Ansicht die Liste einmal still neu; ein 409 mit dem Verweis des
    verwaisten Eintrags wechselt den Kandidaten in die Form „an der Aufgabe“ (Z. 460). */
async function nachfolgerSchreiben(aktion, j) {
  const c = S.ui.commits, nf = c && c.nf;
  if (!nf || nf.status !== 'da' || nf.schreibt) return;
  const k = nachfolgerDeuten(nf.antwort, nf.verweis, nf.gewechselt).kandidaten[j];
  if (!k) return;
  const ausloeser = `nf-knopf-${j}`;
  nf.schreibt = { kandidat: k.verweis, aktion };
  nf.meldung = null;
  // der Statusbereich steht leer im Dokument, bevor der Satz des Erfolgs hineinkommt (AK 13)
  c.ansage = '';
  c.erfolg = false;
  S.ui.fokus = '#' + ausloeser;
  render();
  let fehler = null;
  try {
    if (aktion === 'ersetzen') await durchDieSchlange(() => api('POST', `/api/aufgaben/${c.nr}/commits/ersetzen`, { ersetzungen: [{ alt: nf.verweis, neu: k.verweis }] }));
    else await durchDieSchlange(() => api('DELETE', `/api/aufgaben/${c.nr}/commits/${encodeURIComponent(nf.verweis)}`));
  } catch (f) {
    fehler = f;
  }
  if (!nachfolgerNoch(c, nf)) return;
  nf.schreibt = null;
  if (fehler) {
    const m = schreibfehlerText(aktion, { status: fehler.status || 0, verweis: fehler.daten && fehler.daten.verweis, fehler: fehler.message }, nf.verweis, k.verweis);
    if (m.wechsel) nf.gewechselt.add(k.verweis);
    nf.meldung = { kandidat: k.verweis, text: m.text, live: !m.wechsel };
    if (fokusNochAm(ausloeser)) S.ui.fokus = '#' + ausloeser;
    render();
    return;
  }
  c.ansage = erfolgText(aktion, nf.verweis, k.verweis);
  c.erfolg = true;
  render();
  await commitsLesen(c.nr, { still: true, fokusAuf: k.verweis, ausloeser });
}

/** Liest `GET …/commits`; die Antwort gilt nur, solange dieselbe Seite steht und niemand inzwischen neu gelesen hat. */
async function reviewListeLesen(r) {
  const lauf = r.liste = { status: 'laedt' };
  let ergebnis;
  try {
    const antwort = await api('GET', `/api/aufgaben/${r.nr}/commits`);
    ergebnis = { status: 'da', eintraege: antwort.commits };
  } catch (g) {
    ergebnis = { status: 'fehler', fehler: fehlerVon(g) };
  }
  if (S.ui.review !== r || r.liste !== lauf) return;
  // die Leiste wächst mit der Liste (R00245): nichts unterhalb springt (Leseposition wie R00210 FA 8)
  const merk = reviewLesepositionMerken();
  r.liste = ergebnis;
  reviewPraefixAufloesen(r);
  // wartet „Alle Änderungen“ nach einer 404 der ersten Anwendung auf die Liste, geht es jetzt weiter (R00224 FA 3)
  if (r.ansicht === 'alle' && r.alle && r.alle.erste.status === 'fehlt') {
    reviewAlleAusListe(r, r.alle);
    reviewAlleWeiter(r, r.alle);
  }
  reviewFokus(r);
  render();
  reviewLesepositionHalten(merk);
}

/** Ersetzt die Adresse der Seite durch die mit `verweis`, ohne Verlaufseintrag; die Marke „aus der Liste“ bleibt. */
function reviewAdresseErsetzen(r, verweis) {
  history.replaceState(history.state, '', reviewAdresseBilden({ basis: r.basis, slug: r.slug, nummer: r.nr, commit: verweis }));
  adresseGefolgt = location.hash;
}

/** Liest den Diff zu `verweis`; eine Antwort für einen inzwischen verlassenen Commit wird verworfen (ADR-0014). */
async function reviewDiffLesen(r, verweis) {
  const lauf = r.diff = { status: 'laedt', verweis };
  let ergebnis;
  try {
    const antwort = await diffHolen(`/api/aufgaben/${r.nr}/diff?commit=${encodeURIComponent(verweis)}`);
    ergebnis = { status: 'da', verweis, antwort };
  } catch (g) {
    ergebnis = { status: 'fehler', verweis, fehler: fehlerVon(g) };
  }
  if (S.ui.review !== r || r.diff !== lauf) return;
  r.diff = ergebnis;
  if (ergebnis.status === 'da') reviewDateienAufbauen(r, ergebnis.antwort);
  reviewFokus(r);
  render();
}

/** Dateien und Klappen beim Aufbau: der Plan des Budgets, oder das Bild, das dieser Commit auf dieser Seite zuletzt hatte. Die Gruppen
    beginnen immer wie beim Laden: Code und Tests offen, Doku zu (R00235 FA 4, PO Z. 550). */
function reviewDateienAufbauen(r, antwort) {
  const hash = antwort.commits[0].hash;
  r.dateien = antwort.dateien.slice();
  r.hinweise = (antwort.hinweise || []).slice();
  reviewGesehenLesen(r);
  const gesehen = r.dateien.map(d => r.gesehen.has(commitDateiSchluessel(hash, d)));
  const plan = aufklappPlanSeite(r.dateien, r.hinweise, { rest: BUDGET_ZEILEN, gesperrt: false, erste: true }, gesehen);
  const gemerkt = r.klappenJe[hash];
  r.staende = r.dateien.map((d, i) => {
    // gesehene beginnen zu (R00246 FA 5); ohne Haken steht eine Datei ohne Code offen mit ihrem Satz
    let offen = plan.offen[i] || (!gesehen[i] && d.status !== 'D' && dateiZustand(d, r.hinweise) !== 'patch');
    if (gemerkt) offen = gemerkt[i];
    return { offen, budgetZu: plan.budgetZu[i], laden: null, fehler: null, gesehen: gesehen[i] };
  });
  r.gruppenOffen = gruppenAnfang();
  r.gesehenFuer = hash;
  r.gesehenAnsage = '';
}

/* ── „Gesehen“ (R00246): Speicher im Browser je Karte, Haken je Datei, Fortschritt „<k> von <n> gesehen“ ── */

/** `localStorage`, oder null, wenn schon der Zugriff darauf scheitert (gesperrt); nie ein Wurf in die Seite (FA 10). */
function gesehenSpeicher() {
  try { return window.localStorage; } catch (_) { return null; }
}

/** Liest die Haken der Karte frisch; noch nicht gespeicherte Haken dieser Seite gelten darüber. Scheitert der Speicher, bleiben die
    Haken der Seite und der Satz zum Speicher erscheint (FA 10). */
function reviewGesehenLesen(r) {
  const gelesen = gesehenLesen(gesehenSpeicher(), r.slug || '', r.nr);
  if (gelesen.fehler) { r.gesehenFehler = true; return; }
  const menge = new Set(gelesen.gesehen);
  r.gesehenOffen.forEach(([schluessel, ja]) => {
    if (ja) menge.add(schluessel);
    else menge.delete(schluessel);
  });
  r.gesehen = menge;
}

const reviewGesehenZahl = staende => staende.filter(st => st.gesehen).length;

/** Haken setzen oder entfernen (FA 4, 7, 10): frisch lesen, Eintrag ändern, schreiben; die Datei klappt ein bzw. wieder auf. */
function reviewGesehenSchalten(r, { st, d, schluessel, hinweise }) {
  const ja = !st.gesehen;
  const aenderungen = [...r.gesehenOffen, [schluessel, ja]];
  const ergebnis = gesehenSchreiben(gesehenSpeicher(), r.slug || '', r.nr, aenderungen, Date.now());
  if (ergebnis.fehler) {
    if (ja) r.gesehen.add(schluessel);
    else r.gesehen.delete(schluessel);
    r.gesehenOffen = aenderungen;
  } else {
    r.gesehen = new Set(ergebnis.gesehen);
    r.gesehenOffen = [];
  }
  r.gesehenFehler = ergebnis.fehler;
  st.gesehen = ja;
  st.offen = !ja && reviewOffenOhneHaken(d, hinweise);
}

/** Wie eine Datei ohne Haken steht (FA 4): Code zeigt sie offen; neue Dateien über 500 Zeilen und gelöschte bleiben zu, nachzuladende,
    große und binäre stehen offen mit ihrem Satz. */
function reviewOffenOhneHaken(d, hinweise) {
  if (istFolge(d)) return true;
  if (d.status === 'D') return false;
  if (dateiZustand(d, hinweise) !== 'patch') return true;
  return !grosseNeueDatei(d);
}

/** Der Ort eines Kästchens aus `data-arg`: in „Ein Commit“ der Index, in „Alle Änderungen“ „<a>:<i>“. */
function reviewGesehenOrt(r, arg) {
  const ort = reviewOrt(r, arg);
  if (ort) {
    const antwort = r.alle.abschnitte[ort.a].antwort, d = antwort.dateien[ort.i];
    return { st: ort.st, d, hinweise: antwort.hinweise, schluessel: alleDateiSchluessel(antwort.anwendung, d), id: `${ort.a}-${ort.i}`, a: ort.a, i: ort.i };
  }
  const i = +arg;
  if (!r || r.ansicht === 'alle' || !r.staende || !r.staende[i] || !r.diff || r.diff.status !== 'da') return null;
  return { st: r.staende[i], d: r.dateien[i], hinweise: r.hinweise, schluessel: commitDateiSchluessel(r.diff.antwort.commits[0].hash, r.dateien[i]), id: String(i), a: null, i };
}

/** Nach dem Schalten: die Haken aller Dateien folgen dem gelesenen Stand (ein anderer Tab kann einen gesetzt haben, FA 10); neu
    gezeichnet werden die geschaltete Datei und jede, deren Haken sich dabei änderte. */
function reviewGesehenNachziehen(r, ort) {
  if (ort.a === null) {
    const hash = r.diff.antwort.commits[0].hash;
    r.staende.forEach((st, i) => {
      const gesehen = r.gesehen.has(commitDateiSchluessel(hash, r.dateien[i]));
      if (i !== ort.i && st.gesehen === gesehen) return;
      st.gesehen = gesehen;
      reviewDateiNeu(r, i);
    });
    r.gesehenAnsage = gesehenAnsage(reviewGesehenZahl(r.staende), r.staende.length);
    return;
  }
  r.alle.abschnitte.forEach((ab, a) => {
    if (ab.status !== 'da') return;
    let geaendert = false;
    ab.staende.forEach((st, i) => {
      const gesehen = r.gesehen.has(alleDateiSchluessel(ab.antwort.anwendung, ab.antwort.dateien[i]));
      if ((a !== ort.a || i !== ort.i) && st.gesehen === gesehen) return;
      st.gesehen = gesehen;
      geaendert = true;
      reviewGesamtDateiNeu(r, a, i);
    });
    if (geaendert) reviewAbschnittListeNeu(r, a);
  });
  const z = reviewAlleGesehen(r.alle);
  r.gesehenAnsage = gesehenAnsage(z.k, z.n);
}

/** Zähler in „Alle Änderungen“ (FA 2): k und n über die geladenen Abschnitte, `ungeladen` die ladenden, wartenden und gescheiterten. */
function reviewAlleGesehen(alle) {
  const geladen = alle.abschnitte.filter(ab => ab.status === 'da');
  const staende = geladen.flatMap(ab => ab.staende);
  return { k: reviewGesehenZahl(staende), n: staende.length, ungeladen: alle.abschnitte.length - geladen.length };
}

/** Die Dateiliste eines Abschnitts liegt in der stehenden Insel: nach einem Haken wird nur sie neu gezeichnet. */
function reviewAbschnittListeNeu(r, a) {
  const alt = document.getElementById(`rv-a${a}-liste`);
  if (alt) alt.outerHTML = abschnittListeHtml(r.alle.abschnitte[a], a, esc);
}

/** Klappzustand der Gruppen beim Laden einer Seite oder eines Abschnitts (R00235 FA 4). */
const gruppenAnfang = () => ({ code: true, test: true, doku: false });

/** Was die Seite gerade zeigt (R00207 FA 2, 4, 8): eine Meldung, das Laden oder den Diff samt Folge. */
function reviewBild(r) {
  if (r.ungueltig) return { art: 'ungueltig' };
  const liste = r.liste || { status: 'laedt' };
  if (liste.status === 'fehler' && fehlerArt(liste.fehler, 'commits') === 'aufgabe_unbekannt') return { art: 'unbekannt' };
  if (r.ansicht === 'alle') {
    const erste = (r.alle && r.alle.erste) || { status: 'laedt' };
    if (erste.status === 'fehler' && erste.fehler.status === 404) return { art: 'alle_ohne_verweise' };
    if (erste.status === 'fehlt' && liste.status === 'fehler') return { art: 'alle_liste_fehler' };
    if (erste.status === 'fehler') return { art: 'alle_fehler' };
    if (erste.status === 'da') return { art: 'alle' };
    return { art: 'alle_laedt' };
  }
  // ein Präfix ohne Kürzel wartet auf die Liste; ohne sie gibt es keinen Diff
  const praefixWartet = !r.commit.includes(':') && !r.diff;
  if (praefixWartet && liste.status === 'fehler') return { art: 'liste_fehler' };
  if (!r.diff || r.diff.status === 'laedt') return { art: 'laedt' };
  if (r.diff.status === 'fehler') return { art: 'diff_fehler' };
  const c = r.diff.antwort.commits[0];
  const f = liste.status === 'da' ? folge(liste.eintraege, c.hash) : null;
  return { art: 'diff', commit: c, folge: f && f.art === 'keine' ? { art: 'fremd', erster: null } : f, liste };
}

/** Fokus nach dem Aufbau (R00207 FA 13), einmal je Adresse und nach „Erneut versuchen“: auf die Meldung, den Commit-Kopf, den
    Blätterknopf der Richtung (fehlt er am Rand, den anderen) oder den Rückweg. Solange noch gelesen wird, wartet er. */
function reviewFokus(r) {
  if (!r.fokusOffen) return;
  const b = reviewBild(r);
  if (b.art === 'laedt' || b.art === 'alle_laedt' || (b.art === 'diff' && b.liste.status === 'laedt')) return;
  r.fokusOffen = false;
  // nach dem Umschalten bleibt der Fokus auf dem gewählten Teil des Umschalters (R00210 FA 13)
  if (r.fokusZiel) { S.ui.fokus = r.fokusZiel; r.fokusZiel = null; return; }
  if (b.art === 'alle') { S.ui.fokus = '#rv-rueckweg'; return; }
  if (b.art !== 'diff') { S.ui.fokus = '#rv-meld'; return; }
  if (b.liste.status === 'fehler') { S.ui.fokus = '#rv-ctitel'; return; }
  const f = b.folge;
  const richtung = r.richtung;
  r.richtung = null;
  if (richtung && f.art === 'folge') {
    const andere = richtung === 'vor' ? 'zurueck' : 'vor';
    S.ui.fokus = f[richtung] ? `#rv-${richtung}` : `#rv-${andere}`;
    return;
  }
  S.ui.fokus = '#rv-rueckweg';
}

/** Schlüssel der Insel (ADR-0033 Punkt 4): Aufgabe und voller Hash des gezeigten Diffs; ohne Diff keiner. */
function reviewInselSchluessel() {
  const r = S.ui.review;
  if (S.ui.view !== 'review' || !r) return null;
  if (r.ansicht === 'alle') {
    if (r.alle && r.alle.erste.status === 'da') return `${r.nr}:alle`;
    return null;
  }
  if (!r.diff || r.diff.status !== 'da') return null;
  return `${r.nr}:${r.diff.antwort.commits[0].hash}`;
}

/** Die Insel des letzten Zeichnens, wenn sie zum gezeigten Diff gehört: sie bleibt derselbe Knoten. */
let inselGehalten = null;

/** Klappen des gezeigten Commits merken, damit Zurück und Vor dasselbe Bild ergeben. */
function reviewKlappenMerken(r) {
  if (r.diff && r.diff.status === 'da') r.klappenJe[r.diff.antwort.commits[0].hash] = r.staende.map(s => s.offen);
}

/** Woher die Knöpfe einer Datei in „Ein Commit“ ihre Ziele nehmen (R00236): Aufgabe, Verweis des Commits, Wurzel der Antwort. */
function reviewQuelle(r) {
  return { nr: r.nr, commit: r.diff.antwort.commits[0].verweis, wurzel: r.diff.antwort.wurzel, nebeneinander: S.ui.nebeneinander };
}

/** Zeichnet nur den Abschnitt einer Datei in der Insel neu (Aufklappen, Einklappen, Nachladen). Stand der Fokus darin, steht er
    danach auf demselben Element, fehlt es, auf dem Kopf der Datei — nie auf body (UX-Review #209 M1, WCAG 2.4.3). */
function reviewDateiNeu(r, i) {
  const alt = document.getElementById('rv-d' + i);
  if (alt) {
    const fokus = alt.contains(document.activeElement) ? document.activeElement.id : null;
    alt.outerHTML = dateiHtml(r.dateien[i], i, r.staende[i], r.hinweise, esc, { id: i, arg: i, quelle: reviewQuelle(r) });
    if (fokus !== null) {
      // über den einen Fokusweg (fokusVersuchen), ohne zu rollen: der Fokus bleibt, wo er war
      const ziel = fokus && document.getElementById(fokus) ? '#' + CSS.escape(fokus) : '#rv-dk' + i;
      fokusVersuchen(ziel, null, null, { selektor: ziel, sichtbar: false });
    }
  }
  reviewKlappenMerken(r);
}

/* ── Gruppen der Review-Seite (R00235 FA 3, 4, 8; PO Z. 543, 550, 552) ── */

/** Öffnet „Alle aufklappen“ die Datei? Mit `patch`, außer der großen neuen Datei (FA 6); eine Folge-Datei mit einem Schritt mit `patch`. */
function reviewAufklappbar(d, hinweise) {
  if (istFolge(d)) return d.schritte.some(x => dateiZustand(x, hinweise) === 'patch');
  return dateiZustand(d, hinweise) === 'patch' && !grosseNeueDatei(d);
}

/** Öffnet der Mensch die Gruppe „Doku und Planung“, zeigen sich ihre Dateien offen — gelöschte und große neue bleiben zu (R00235,
    Entscheidung des planers zu Bild 7 e). Die Gruppen Code und Tests beginnen offen; sie schalten nur sich selbst. */
function reviewGruppeOeffnen(gruppen, art, dateien, staende, hinweise) {
  gruppen[art] = true;
  if (art !== 'doku') return;
  dateiGruppen(dateien).filter(g => g.art === art).flatMap(g => g.indizes).forEach(i => {
    if (dateien[i].status !== 'D' && reviewAufklappbar(dateien[i], hinweise)) staende[i].offen = true;
  });
}

/** Zeichnet eine Gruppe in der Insel neu; stand der Fokus darin, steht er danach auf demselben Element, sonst auf dem Gruppenkopf. */
function reviewKnotenNeu(id, html, kopf) {
  const alt = document.getElementById(id);
  if (!alt) return;
  const fokus = alt.contains(document.activeElement) ? document.activeElement.id : null;
  alt.outerHTML = html;
  if (fokus === null) return;
  const ziel = fokus && document.getElementById(fokus) ? '#' + CSS.escape(fokus) : kopf;
  fokusVersuchen(ziel, null, null, { selektor: ziel, sichtbar: false });
}

function reviewGruppeNeu(r, art) {
  const g = dateiGruppen(r.dateien).find(x => x.art === art);
  if (!g) return;
  reviewKnotenNeu(`rv-g-${art}`, commitGruppeHtml(g, r.dateien, r.staende, r.hinweise, esc, r.gruppenOffen[art], reviewQuelle(r)), `#rv-gk-${art}`);
  reviewKlappenMerken(r);
}

function reviewGesamtGruppeNeu(r, a, art) {
  const ab = r.alle.abschnitte[a];
  if (!dateiGruppen(ab.antwort.dateien).some(x => x.art === art)) return;
  reviewKnotenNeu(`rv-g${a}-${art}`, abschnittGruppeHtml(ab, a, art, reviewGesamtKontext(r)), `#rv-gk${a}-${art}`);
  reviewAlleKlappenMerken(r);
}

/** Der Gruppenkopf schaltet seine Gruppe; der Fokus bleibt auf ihm (PO Z. 552 (b)). `arg` ist die Art oder „<a>:<art>“. */
function reviewGruppeSchalten(r, arg) {
  const alle = /^(\d+):(\w+)$/.exec(String(arg));
  if (alle && r.ansicht === 'alle' && r.alle) {
    const a = +alle[1], art = alle[2], ab = r.alle.abschnitte[a];
    if (!ab || ab.status !== 'da') return;
    if (ab.gruppen[art]) ab.gruppen[art] = false;
    else reviewGruppeOeffnen(ab.gruppen, art, ab.antwort.dateien, ab.staende, ab.antwort.hinweise);
    reviewGesamtGruppeNeu(r, a, art);
    S.ui.fokus = `#rv-gk${a}-${art}`;
    return;
  }
  if (!r.gruppenOffen || !(arg in r.gruppenOffen)) return;
  if (r.gruppenOffen[arg]) r.gruppenOffen[arg] = false;
  else reviewGruppeOeffnen(r.gruppenOffen, arg, r.dateien, r.staende, r.hinweise);
  reviewGruppeNeu(r, arg);
  S.ui.fokus = `#rv-gk-${arg}`;
}

/** Bricht die laufende Anfrage `datei=` ab, wenn die Seite ihre Adresse wechselt oder verlassen wird (Code-Review #209 M2): das gibt
    das Budget des Servers frei; die Antwort gälte ohnehin nicht mehr. */
function reviewNachladenAbbrechen(r) {
  if (r.laufend) r.laufend.abbruch.abort();
  r.laufend = null;
}

/** Nachladen einer Datei (ADR-0033 Punkt 6): höchstens eine Anfrage `datei=` zur Zeit; weitere warten sichtbar und starten von
    selbst, sobald die vorige zu Ende ist — auch mit Fehler. Nie eine Wiederholung ohne Klick. */
function reviewNachladen(r, i) {
  const st = r.staende[i];
  if (st.laden === 'laeuft' || st.laden === 'wartet') return;
  st.offen = true;
  if (r.laufend !== null) { st.laden = 'wartet'; r.schlange.push(i); reviewDateiNeu(r, i); return; }
  reviewDateiLaden(r, i);
}

/** Lädt Datei `i` nach. Jede Anfrage trägt ihren eigenen Lauf: eine Antwort gilt nur, solange genau dieser Lauf der laufende ist —
    nie über den Index, denn nach einem Adresswechsel kann dieselbe Nummer neu laden (Code-Review #209 M2). */
async function reviewDateiLaden(r, i) {
  const st = r.staende[i], d = r.dateien[i], c = r.diff.antwort.commits[0];
  const verweis = (r.diff.antwort.anwendung ? `${r.diff.antwort.anwendung}:` : '') + c.hash;
  const lauf = r.laufend = { i, abbruch: new AbortController() };
  st.laden = 'laeuft';
  st.fehler = null;
  reviewDateiNeu(r, i);
  let antwort = null, fehler = null;
  try {
    antwort = await diffHolen(`/api/aufgaben/${r.nr}/diff?commit=${encodeURIComponent(verweis)}&datei=${encodeURIComponent(d.neu ?? d.alt)}`, lauf.abbruch.signal);
  } catch (g) {
    fehler = fehlerVon(g);
  }
  if (S.ui.review !== r || r.laufend !== lauf) return;
  r.laufend = null;
  const neu = antwort && zuordnen(r.dateien, i, antwort.dateien);
  if (neu) {
    r.dateien[i] = neu;
    r.hinweise.push(...(antwort.hinweise || []).filter(h => h.art === 'zu_gross_zum_anzeigen'));
    st.laden = null;
  } else {
    st.laden = 'fehler';
    const f = fehler || { status: 404, fehler: 'Die Datei fehlt in der Antwort' };
    st.fehler = { art: fehlerArt(f, 'diff'), status: f.status, text: esc(f.status === 0 ? 'keine Verbindung zum Programm' : f.fehler || 'unbekannter Fehler') };
  }
  const fokusInDerDatei = document.activeElement && document.activeElement.closest && document.activeElement.closest('#rv-d' + i);
  reviewDateiNeu(r, i);
  if (fokusInDerDatei || document.activeElement === document.body) S.ui.fokus = '#rv-dk' + i;
  const naechste = r.schlange.shift();
  if (naechste !== undefined) reviewDateiLaden(r, naechste);
  render();
}

/* ── Alle Änderungen der Aufgabe (R00210, ADR-0033 N1): Abschnitte je Anwendung, eine Reihe für alle Anfragen an `…/diff` ── */

/** Ort einer Datei des Gesamtbilds aus `data-arg` „<a>:<i>“; null in „Ein Commit“ oder ohne geladenen Abschnitt. */
function reviewOrt(r, arg) {
  if (!r || r.ansicht !== 'alle' || !r.alle || !/^\d+:\d+$/.test(String(arg))) return null;
  const [a, i] = String(arg).split(':').map(Number);
  const ab = r.alle.abschnitte[a];
  if (!ab || ab.status !== 'da' || !ab.staende[i]) return null;
  return { a, i, st: ab.staende[i] };
}

/* ── Pfad kopieren (R00236 FA 8, 9): Bestätigung in der Statusregion am Knopf, ohne Zwischenablage ein markiertes Feld ── */

/** Datei, Stand, Kennung und Wurzel hinter `arg` eines Knopfs „Pfad“ — in „Ein Commit“ der Index, in „Alle Änderungen“ „<a>:<i>“. */
function reviewPfadOrt(r, arg) {
  const ort = reviewOrt(r, arg);
  if (ort) {
    const antwort = r.alle.abschnitte[ort.a].antwort;
    return { d: antwort.dateien[ort.i], st: ort.st, id: `${ort.a}-${ort.i}`, wurzel: antwort.wurzel };
  }
  const i = +arg;
  if (!r || !r.staende || !r.staende[i] || !r.diff || r.diff.status !== 'da') return null;
  return { d: r.dateien[i], st: r.staende[i], id: String(i), wurzel: r.diff.antwort.wurzel };
}

/** Die Auflage „Pfad kopiert“ lebt 2–10 s (AK 7); die Hinweise der Seite stehen 8 s (PO Z. 541). */
const PFAD_KOPIERT_DAUER = 5000;
/** Die eine sichtbare Auflage `{st, id, uhr}` und das eine Feld `{st, id}` der Seite. */
let pfadKopiert = null;
let pfadFeld = null;

/** Kopiert `<wurzel>/<pfad>` roh; gelingt es nicht (kein sicherer Kontext, Schreiben verweigert), steht der Pfad markiert im Feld —
    nie eine stille Fehlanzeige. Ein Druck auf „Pfad“ nimmt das Feld jeder Datei weg. */
async function pfadKopieren(ort) {
  const text = kopierPfad(ort.wurzel, ort.d);
  pfadFeldWeg();
  if (await linkInDieZwischenablage(text)) pfadKopiertZeigen(ort);
  else pfadFeldZeigen(ort, text);
}

/** Setzt nur den Text der Statusregion, die schon leer im Kopf steht: so wird sie angesagt, und nichts daneben verschiebt sich. */
function pfadKopiertZeigen(ort) {
  pfadKopiertWeg();
  ort.st.pfadOk = true;
  pfadKopiert = { st: ort.st, id: ort.id, uhr: setTimeout(pfadKopiertWeg, PFAD_KOPIERT_DAUER) };
  const region = document.getElementById('rv-ok' + ort.id);
  if (region) region.textContent = 'Pfad kopiert';
}

function pfadKopiertWeg() {
  if (!pfadKopiert) return;
  clearTimeout(pfadKopiert.uhr);
  pfadKopiert.st.pfadOk = false;
  const region = document.getElementById('rv-ok' + pfadKopiert.id);
  if (region) region.textContent = '';
  pfadKopiert = null;
}

/** Das Feld steht unter dem Kopf der Datei, hat den Fokus, und der Pfad ist ganz markiert (FA 9). Es lebt im Stand der Datei: ein
    Neuzeichnen zeichnet es wieder. */
function pfadFeldZeigen(ort, text) {
  ort.st.pfadFeld = text;
  pfadFeld = { st: ort.st, id: ort.id };
  const abschnitt = document.getElementById('rv-d' + ort.id);
  if (!abschnitt) return;
  abschnitt.querySelector(':scope > .ru-k').insertAdjacentHTML('afterend', pfadFeldHtml(ort.id, text, esc));
  pfadFeldMarkieren();
}

/** Fokus über den einen Fokusweg (fokusVersuchen), ohne zu rollen; danach der ganze Pfad markiert. */
function pfadFeldMarkieren() {
  const ziel = '#' + CSS.escape('rv-pfin' + pfadFeld.id);
  if (!fokusVersuchen(ziel, null, null, { selektor: ziel, sichtbar: false })) return;
  $(ziel).select();
}

function pfadFeldWeg() {
  if (!pfadFeld) return;
  pfadFeld.st.pfadFeld = null;
  const feld = document.getElementById('rv-pf' + pfadFeld.id);
  if (feld) feld.remove();
  pfadFeld = null;
}

/** Esc im Feld nimmt es weg; der Fokus geht an „Pfad“ derselben Datei (PO Z. 559). */
function pfadFeldSchliessen() {
  const id = pfadFeld.id;
  pfadFeldWeg();
  const ziel = '#' + CSS.escape('rv-pk' + id);
  fokusVersuchen(ziel, null, null, { selektor: ziel, sichtbar: false });
}

/** Folgt einem Link nach VS Code wie ein Klick auf einen Verweis: kurz im Code-Bereich eingehängt, damit derselbe Weg gilt wie für
    den Knopf „VS Code“ (der Klick-Handler lässt `vscode:`-Verweise dem Browser). */
function vscodeFolgen(link, ort) {
  const verweis = document.createElement('a');
  verweis.href = link;
  verweis.hidden = true;
  ort.append(verweis);
  verweis.click();
  verweis.remove();
}

/** Bricht die laufende Anfrage des Gesamtbilds ab und leert die Reihe (N1.2): Umschalten, Adresswechsel, Verlassen. */
function reviewAlleAbbrechen(r) {
  const alle = r.alle;
  if (!alle) return;
  if (alle.reihe.laufend) alle.reihe.laufend.abbruch.abort();
  alle.reihe.laufend = null;
  alle.reihe.wartend = [];
  alle.reihe.anwendungen = [];
}

/** Öffnet „Alle Änderungen“: ein neues Gesamtbild, die erste Anfrage ohne `anwendung` durch die Reihe. */
function reviewAlleLesen(r) {
  reviewAlleAbbrechen(r);
  const alle = r.alle = { erste: { status: 'laedt' }, abschnitte: [], vonListe: [], reihe: { laufend: null, wartend: [], anwendungen: [] }, plan: { rest: BUDGET_ZEILEN, gesperrt: false, erste: true }, ansage: '' };
  r.gesehenFuer = 'alle';
  r.gesehenAnsage = '';
  reviewAlleAnfragen(r, alle, { art: 'erste' });
}

/** Die nächste Anfrage der Reihe starten (naechsteAnfrage aus gesamt.js): Datei vor noch nicht begonnenen Anwendungen. */
function reviewAlleWeiter(r, alle) {
  const naechste = naechsteAnfrage(alle.reihe);
  if (!naechste) return;
  if (naechste.art === 'datei') {
    alle.reihe.wartend.shift();
    reviewAlleAnfragen(r, alle, naechste);
    return;
  }
  alle.reihe.anwendungen.shift();
  reviewAlleAnfragen(r, alle, { art: 'anwendung', a: alle.abschnitte.findIndex(ab => ab.kuerzel === naechste.kuerzel && ab.status === 'wartet') });
}

/** Eine Anfrage an `…/diff` mit eigenem Lauf (Lehre #209): die Antwort gilt nur, solange genau dieser Lauf der laufende des
    Gesamtbilds ist — nie über Index, Kürzel oder Namen. `If-None-Match` setzt die Seite nicht selbst (N1.2). */
async function reviewAlleAnfragen(r, alle, auftrag) {
  const lauf = alle.reihe.laufend = { ...auftrag, abbruch: new AbortController() };
  let pfad = `/api/aufgaben/${r.nr}/diff`;
  if (auftrag.art === 'anwendung') {
    const ab = alle.abschnitte[auftrag.a];
    ab.status = 'laedt';
    pfad += `?anwendung=${encodeURIComponent(ab.kuerzel)}`;
  }
  if (auftrag.art === 'datei') {
    const ab = alle.abschnitte[auftrag.a], d = ab.antwort.dateien[auftrag.i], st = ab.staende[auftrag.i];
    st.laden = 'laeuft';
    st.fehler = null;
    st.wartetAuf = null;
    // der Name aus der Antwort, nie ein Text der Oberfläche; `anwendung=` immer, bei der Standardanwendung leer (N1.6)
    pfad += `?datei=${encodeURIComponent(istFolge(d) ? d.pfad : d.neu ?? d.alt)}&anwendung=${encodeURIComponent(ab.antwort.anwendung)}`;
  }
  reviewAlleNachziehen(r, alle, auftrag);
  let antwort = null, fehler = null;
  try {
    antwort = await diffHolen(pfad, lauf.abbruch.signal);
  } catch (g) {
    fehler = fehlerVon(g);
  }
  if (S.ui.review !== r || r.alle !== alle || alle.reihe.laufend !== lauf) return;
  alle.reihe.laufend = null;
  const merk = reviewLesepositionMerken();
  if (auftrag.art === 'erste') reviewAlleErste(r, alle, antwort, fehler);
  if (auftrag.art === 'anwendung') reviewAlleAbschnitt(r, alle, auftrag.a, antwort, fehler);
  if (auftrag.art === 'datei') reviewAlleDatei(r, alle, auftrag, antwort, fehler);
  reviewAlleWeiter(r, alle);
  reviewAnsageSetzen(r, alle);
  reviewFokus(r);
  render();
  reviewLesepositionHalten(merk);
}

/** Die erste Antwort: Abschnitt der ersten Anwendung, dazu je weitere Anwendung ein wartender Abschnitt in der Reihe. Eine 404 mit
    `zustand` heißt: die erste Anwendung ist nicht erreichbar, die Anwendungen kommen aus der Liste der Commits (R00224 FA 2, 3). */
function reviewAlleErste(r, alle, antwort, fehler) {
  if (fehler && fehler.status === 404 && fehler.daten && fehler.daten.zustand) {
    alle.erste = { status: 'fehlt', fehler };
    reviewAlleAusListe(r, alle);
    return;
  }
  if (fehler) { alle.erste = { status: 'fehler', fehler }; return; }
  alle.erste = { status: 'da' };
  alle.abschnitte.push(reviewAbschnittAufbauen(r, alle, antwort));
  weitereAnwendungen(antwort.hinweise).forEach(kuerzel => {
    alle.abschnitte.push({ status: 'wartet', kuerzel });
    alle.reihe.anwendungen.push(kuerzel);
  });
}

/** Nach einer 404 der ersten Anwendung, sobald die Liste da ist: je Kürzel der Liste ein wartender Abschnitt in der Reihe, auch für die
    fehlende Anwendung, und die seitenweiten Hinweise der Liste (R00224 FA 3, 4). Ohne Liste wartet die Seite weiter. */
function reviewAlleAusListe(r, alle) {
  if (!r.liste || r.liste.status !== 'da') return;
  alle.erste = { status: 'da' };
  alle.vonListe = listenHinweise(r.liste.eintraege);
  anwendungenAusListe(r.liste.eintraege).forEach(kuerzel => {
    alle.abschnitte.push({ status: 'wartet', kuerzel });
    alle.reihe.anwendungen.push(kuerzel);
  });
}

/** Ein geladener Abschnitt: Klappen aus dem Plan des seitenweiten Budgets, oder wie zuletzt bei gleicher Dateiliste (`alle:<kürzel>`). */
function reviewAbschnittAufbauen(r, alle, antwort) {
  const dateien = antwort.dateien;
  reviewGesehenLesen(r);
  const gesehen = dateien.map(d => r.gesehen.has(alleDateiSchluessel(antwort.anwendung, d)));
  const { offen, budgetZu, stand } = aufklappPlanSeite(dateien, antwort.hinweise, alle.plan, gesehen);
  alle.plan = stand;
  const gemerkt = r.klappenJe[`alle:${antwort.anwendung}`];
  const namen = dateien.map(d => (istFolge(d) ? d.pfad : d.neu ?? d.alt)).join('\n');
  const ohnePatch = d => !istFolge(d) && d.status !== 'D' && dateiZustand(d, antwort.hinweise) !== 'patch';
  const staende = dateien.map((d, i) => {
    // gesehene beginnen zu (R00246 FA 5)
    let auf = offen[i] || (!gesehen[i] && (ohnePatch(d) || (istFolge(d) && !d.schritte.some(s => dateiZustand(s, antwort.hinweise) === 'patch'))));
    if (gemerkt && gemerkt.namen === namen) auf = gemerkt.offen[i];
    return { offen: auf, budgetZu: budgetZu[i], laden: null, fehler: null, wartetAuf: null, gesehen: gesehen[i] };
  });
  return { status: 'da', kuerzel: antwort.anwendung, antwort: { ...antwort, dateien: dateien.slice(), hinweise: (antwort.hinweise || []).slice() }, staende, namen, gruppen: gruppenAnfang() };
}

function reviewAlleAbschnitt(r, alle, a, antwort, fehler) {
  if (fehler) {
    alle.abschnitte[a] = { status: 'fehler', kuerzel: alle.abschnitte[a].kuerzel, fehler: { ...fehler, art: fehlerArt(fehler, 'diff') } };
  } else {
    alle.abschnitte[a] = reviewAbschnittAufbauen(r, alle, antwort);
  }
  reviewAbschnittNeu(r, alle, a);
}

/** Die Antwort auf `datei=` ersetzt den Eintrag (zuordnenGesamt); eine Folge-Datei öffnet danach ganz. */
function reviewAlleDatei(r, alle, { a, i }, antwort, fehler) {
  const ab = alle.abschnitte[a], st = ab.staende[i];
  const neu = antwort && zuordnenGesamt(ab.antwort.dateien, i, antwort.dateien);
  if (neu) {
    ab.antwort.dateien[i] = neu;
    ab.antwort.hinweise.push(...(antwort.hinweise || []).filter(h => h.art === 'zu_gross_zum_anzeigen'));
    st.laden = null;
  } else {
    st.laden = 'fehler';
    const f = fehler || { status: 404, fehler: 'Die Datei fehlt in der Antwort' };
    st.fehler = { art: fehlerArt(f, 'diff'), status: f.status, text: esc(f.status === 0 ? 'keine Verbindung zum Programm' : f.fehler || 'unbekannter Fehler') };
  }
  st.offen = true;
  const fokusInDerDatei = document.activeElement && document.activeElement.closest && document.activeElement.closest(`#rv-d${a}-${i}`);
  reviewGesamtDateiNeu(r, a, i);
  if (fokusInDerDatei || document.activeElement === document.body) S.ui.fokus = `#rv-dk${a}-${i}`;
}

/** Worauf ein wartender Abschnitt wartet: das rohe Kürzel des Abschnitts der laufenden Anfrage (Anwendung oder `datei=`; '' ist
    die Standardanwendung), null ohne laufende Anfrage eines Abschnitts. Die eine Rechnung für Start, Nachladen und „Erneut versuchen“
    (Code-Review M1); maskiert wird erst beim Einsetzen. */
function wartetAufVon(alle) {
  const laufend = alle.reihe.laufend;
  if (!laufend || laufend.art === 'erste') return null;
  return alle.abschnitte[laufend.a].kuerzel;
}

/** Worauf eine wartende Datei wartet: auf die laufende Anwendung, hinter einer laufenden Datei auf „die andere Datei“ (null). */
function dateiWartetAufVon(alle) {
  const laufend = alle.reihe.laufend;
  if (!laufend || laufend.art !== 'anwendung') return null;
  return wartetAufVon(alle);
}

/** Nach dem Start einer Anfrage: der startende Abschnitt bzw. die startende Datei und alle wartenden zeigen, worauf sie warten. */
function reviewAlleNachziehen(r, alle, auftrag) {
  if (alle.erste.status !== 'da') { render(); return; }
  const wartetAuf = wartetAufVon(alle);
  alle.abschnitte.forEach((ab, a) => {
    if (ab.status === 'wartet' && ab.wartetAuf !== wartetAuf) { ab.wartetAuf = wartetAuf; reviewAbschnittNeu(r, alle, a); }
    if (ab.status === 'laedt' && auftrag.art === 'anwendung' && auftrag.a === a) reviewAbschnittNeu(r, alle, a);
  });
  alle.reihe.wartend.forEach(({ a, i }) => {
    const st = alle.abschnitte[a].staende[i];
    const auf = dateiWartetAufVon(alle);
    if (st.wartetAuf !== auf) { st.wartetAuf = auf; reviewGesamtDateiNeu(r, a, i); }
  });
  if (auftrag.art === 'datei') reviewGesamtDateiNeu(r, auftrag.a, auftrag.i);
  render();
}

/** Die Ansage (R00210 FA 3, UX-Vorprüfung M1): erst, wenn alle Abschnitte entschieden sind; Zahlen der geladenen, jeder gescheiterte einmal. */
function reviewAnsageSetzen(r, alle) {
  if (alle.erste.status !== 'da') return;
  if (alle.abschnitte.some(ab => ab.status === 'laedt' || ab.status === 'wartet')) return;
  const gescheitert = alle.abschnitte.filter(ab => ab.status === 'fehler').map(ab => ab.kuerzel);
  alle.ansage = ansageText(r.nr, abschnittSummen(alle.abschnitte), gescheitert);
}

/** Kontext des Zeichnens für gesamt.js: maskieren, Adresse eines Commits, Titel aus der Liste. */
function reviewGesamtKontext(r) {
  const titelVon = verweis => {
    const e = r.liste && r.liste.status === 'da' && r.liste.eintraege.find(x => x.verweis === verweis);
    return (e && e.titel) || null;
  };
  return { esc, nr: r.nr, adresse: verweis => reviewAdresseBilden({ basis: r.basis, slug: r.slug, nummer: r.nr, commit: verweis }), titelVon, nebeneinander: S.ui.nebeneinander };
}

/** Hängt einen Abschnitt in die stehende Insel (N1.3): nur sein Knoten wird ersetzt. Stand der Fokus darin, steht er danach auf
    der Überschrift des Abschnitts — nie auf body. */
function reviewAbschnittNeu(r, alle, a) {
  const alt = document.getElementById(`rv-a${a}`);
  if (!alt) return;
  const fokusDarin = alt.contains(document.activeElement);
  alt.outerHTML = abschnittHtml(alle.abschnitte[a], a, reviewGesamtKontext(r));
  const seite = document.getElementById('rv-seite-hw');
  const seiteNeu = seitenHinweiseHtml(seitenHinweise([...alle.abschnitte.filter(ab => ab.status === 'da').map(ab => ab.antwort.hinweise), alle.vonListe]), esc);
  if (seite && seite.outerHTML !== seiteNeu) seite.outerHTML = seiteNeu;
  if (fokusDarin) fokusVersuchen(`#rv-a${a}-t`, null, null, { selektor: `#rv-a${a}-t`, sichtbar: false });
}

/** Zeichnet eine Datei des Gesamtbilds neu (Klappe, Nachladen); der Fokus bleibt auf demselben Element oder geht auf den Kopf. */
function reviewGesamtDateiNeu(r, a, i) {
  const alt = document.getElementById(`rv-d${a}-${i}`);
  const ab = r.alle.abschnitte[a];
  if (alt) {
    const fokus = alt.contains(document.activeElement) ? document.activeElement.id : null;
    alt.outerHTML = abschnittDateiHtml(ab, a, i, reviewGesamtKontext(r));
    if (fokus !== null) {
      const ziel = fokus && document.getElementById(fokus) ? '#' + CSS.escape(fokus) : `#rv-dk${a}-${i}`;
      fokusVersuchen(ziel, null, null, { selektor: ziel, sichtbar: false });
    }
  }
  reviewAlleKlappenMerken(r);
}

/** Klappen je Anwendung merken (`alle:<kürzel>`), gültig nur bei gleicher Dateiliste. */
function reviewAlleKlappenMerken(r) {
  if (!r.alle) return;
  r.alle.abschnitte.forEach(ab => {
    if (ab.status === 'da') r.klappenJe[`alle:${ab.kuerzel}`] = { namen: ab.namen, offen: ab.staende.map(st => st.offen) };
  });
}

/** „Nachladen“ / „Änderungen anzeigen“ im Gesamtbild: in die Reihe vor die noch nicht begonnenen Anwendungen (N1.2). */
function reviewAlleNachladen(r, a, i) {
  const alle = r.alle, st = alle.abschnitte[a].staende[i];
  if (st.laden === 'laeuft' || st.laden === 'wartet') return;
  st.offen = true;
  if (alle.reihe.laufend) {
    st.laden = 'wartet';
    st.wartetAuf = dateiWartetAufVon(alle);
    alle.reihe.wartend.push({ a, i });
    reviewGesamtDateiNeu(r, a, i);
    return;
  }
  reviewAlleAnfragen(r, alle, { art: 'datei', a, i });
}

/** „Erneut versuchen“ am Abschnitt: genau eine Anfrage, vor den noch nicht begonnenen Anwendungen; Fokus auf die Überschrift. */
function reviewAbschnittErneut(r, a) {
  const alle = r.alle, ab = alle && alle.abschnitte[a];
  if (!ab || ab.status !== 'fehler') return;
  alle.abschnitte[a] = { status: 'wartet', kuerzel: ab.kuerzel, wartetAuf: wartetAufVon(alle) };
  alle.reihe.anwendungen.unshift(ab.kuerzel);
  // die alte Ansage gilt nicht mehr: die Region wird sofort leer, der neue Text kommt, wenn alle Abschnitte entschieden sind (AK 11)
  alle.ansage = '';
  reviewAbschnittNeu(r, alle, a);
  S.ui.fokus = `#rv-a${a}-t`;
  reviewAlleWeiter(r, alle);
}

/** Leseposition (R00210 FA 8, S5): die Lage des ersten Abschnitts vor dem Zeichnen; danach wird die Rolle um die Verschiebung
    nachgeführt, sodass nichts oberhalb der Leseposition springt (die Leiste kann ihre Höhe ändern). */
function reviewLesepositionMerken() {
  const anker = document.getElementById('rv-a0'), rolle = document.getElementById('review');
  if (!anker || !rolle) return null;
  return { anker, oben: anker.getBoundingClientRect().top };
}

function reviewLesepositionHalten(merk) {
  if (!merk || !merk.anker.isConnected) return;
  const verschiebung = merk.anker.getBoundingClientRect().top - merk.oben;
  if (verschiebung) document.getElementById('review').scrollTop += verschiebung;
}

/** Die oberste im Bild stehende Zeile der Rolle samt ihrer Lage (R00248 FA 3, ADR-0042 N6.2): ein `elementFromPoint` an der Oberkante
    von `#review`; trifft es keine Zeile, gilt der Kopf der Datei, sonst der erste Abschnitt. Gehalten wird sie mit `reviewLesepositionHalten`. */
function reviewLeseZeileMerken() {
  const rolle = document.getElementById('review');
  if (!rolle) return null;
  const r = rolle.getBoundingClientRect();
  const getroffen = document.elementFromPoint(r.left + r.width / 2, r.top + 1);
  let anker = null;
  if (getroffen) anker = getroffen.closest('tr') || (getroffen.closest('section.df') || document.createElement('i')).querySelector('.df-k');
  if (!anker) return reviewLesepositionMerken();
  return { anker, oben: anker.getBoundingClientRect().top };
}

/** Der Schalter „Umbrechen“: nur eine Klasse an `#review`, kein Neuzeichnen; die Leseposition bleibt sofort und im nächsten Bild. */
function reviewUmbrechenSetzen(an) {
  S.ui.umbrechen = an;
  umbrechenSchreiben(gesehenSpeicher(), an);
  const rolle = document.getElementById('review');
  if (!rolle) return;
  const merk = reviewLeseZeileMerken();
  rolle.classList.toggle('umbr', an);
  reviewLesepositionHalten(merk);
  requestAnimationFrame(() => reviewLesepositionHalten(merk));
}

/** Der Schalter „Nebeneinander“ (R00249 FA 5, ADR-0042 N6.1, N6.2): je offener Datei wird nur ihr Code-Bereich `.df-sc` neu gezeichnet,
    ohne Anfrage; Köpfe, Gruppen, „Gesehen“ und der Fokus am Schalter bleiben dieselben Knoten. Die Lesezeile bleibt an ihrem Platz,
    sofort und im nächsten Bild. */
function reviewNebeneinanderSetzen(an) {
  S.ui.nebeneinander = an;
  schalterSchreiben(gesehenSpeicher(), NEBENEINANDER_SCHLUESSEL, an);
  const r = S.ui.review;
  if (!r || !document.getElementById('review')) return;
  const merk = reviewLeseZeileNachKennung();
  reviewCodeBereicheNeu(r);
  reviewLeseZeileNachKennungHalten(merk);
  requestAnimationFrame(() => reviewLeseZeileNachKennungHalten(merk));
}

/** Ersetzt in jeder Datei der Insel die Code-Bereiche durch die aus dem Zustand neu gezeichneten (gleiche Zahl, gleiche Reihenfolge). */
function reviewCodeBereicheNeu(r) {
  const vorlage = document.createElement('template');
  for (const abschnitt of document.querySelectorAll('#rv-insel section.df')) {
    const alt = abschnitt.querySelectorAll('.df-sc');
    if (!alt.length) continue;
    vorlage.innerHTML = reviewDateiHtmlZu(r, abschnitt.id);
    const neu = vorlage.content.querySelectorAll('.df-sc');
    if (neu.length !== alt.length) continue;
    alt.forEach((bereich, k) => bereich.replaceWith(neu[k]));
  }
}

/** Das HTML der Datei zum Abschnitt `rv-d<i>` („Ein Commit“) bzw. `rv-d<a>-<i>` („Alle Änderungen“) aus dem Zustand der Seite. */
function reviewDateiHtmlZu(r, id) {
  const [, a, i] = /^rv-d(\d+)(?:-(\d+))?$/.exec(id) || [];
  if (r.ansicht === 'alle') return abschnittDateiHtml(r.alle.abschnitte[a], Number(a), Number(i), reviewGesamtKontext(r));
  return dateiHtml(r.dateien[a], Number(a), r.staende[a], r.hinweise, esc, { id: Number(a), arg: Number(a), quelle: reviewQuelle(r) });
}

/** Die Lesezeile über ihre Kennung (ADR-0042 N6.2): ein `elementFromPoint` an der Oberkante der Rolle; gemerkt werden Ordnungszahl `n`
    ihres `.df-sc`, kleinstes `data-z` `z` und Lage `oben`, dazu der Kopf ihrer Datei als Rückfall. Trifft der Punkt keine Zeile, gilt der Anker von `reviewLeseZeileMerken` (Kopf der Datei, erster Abschnitt). */
function reviewLeseZeileNachKennung() {
  const rolle = document.getElementById('review');
  const r = rolle.getBoundingClientRect();
  const getroffen = document.elementFromPoint(reviewNummernSpalte(rolle, r), r.top + 1);
  const zeile = getroffen && getroffen.closest('.df-sc tr');
  const kennungen = zeile ? Array.from(zeile.querySelectorAll('[data-z]'), zelle => Number(zelle.dataset.z)) : [];
  if (!kennungen.length) return { rueckfall: reviewLeseZeileMerken() };
  const bereich = zeile.closest('.df-sc');
  const kopf = bereich.closest('section.df').querySelector('.df-k');
  return { n: Array.from(rolle.querySelectorAll('.df-sc')).indexOf(bereich), z: Math.min(...kennungen), oben: zeile.getBoundingClientRect().top, rueckfall: { anker: kopf, oben: kopf.getBoundingClientRect().top } };
}

/** Waagerecht in der Spalte der Nummern: kurze Zeilen reichen nicht bis zur Mitte der Rolle, die Nummernzelle steht in jeder Zeile.
    Gemessen am Block (nie übersprungen) und am Innenabstand der Tabelle, ohne Layout in einem übersprungenen Block zu erzwingen. */
function reviewNummernSpalte(rolle, r) {
  const block = rolle.querySelector('.dz-b');
  if (!block) return r.left + r.width / 2;
  return block.getBoundingClientRect().left + (parseFloat(getComputedStyle(block.firstElementChild).paddingLeft) || 0) + 4;
}

function reviewLeseZeileNachKennungHalten(merk) {
  const bereich = merk.n === undefined ? null : document.querySelectorAll('#review .df-sc')[merk.n];
  const zelle = bereich && bereich.querySelector(`[data-z="${merk.z}"]`);
  if (!zelle) { reviewLesepositionHalten(merk.rueckfall); return; }
  const verschiebung = zelle.closest('tr').getBoundingClientRect().top - merk.oben;
  if (verschiebung) document.getElementById('review').scrollTop += verschiebung;
}

/** Die Seite „Alle Änderungen“ (Hauptbereich): Commit-Leiste, darunter Summe und Ansage, dann die Insel oder ein Zustand. */
function vReviewAlle(r, b) {
  const alle = r.alle;
  const ansage = `<p class="vh" id="rv-ansage" aria-live="polite" aria-atomic="true">${esc((alle && alle.ansage) || '')}</p>`;
  if (b.art === 'alle_ohne_verweise') return meldungHtml({ rolle: 'status', kopf: 'Keine Änderungen zu zeigen.', text: 'An dieser Aufgabe sind keine Commit-Verweise hinterlegt.', knoepfe: knopf('Zurück zur Liste der Commits', 'review-liste') });
  let inhalt;
  if (b.art === 'alle_laedt') inhalt = '<p class="rv-laedt" id="rv-laedt" role="status" aria-busy="true">Liest die Änderungen der Aufgabe …</p>';
  else if (b.art === 'alle_fehler') inhalt = diffFehlerHtml(alle.erste.fehler, null, esc);
  else if (b.art === 'alle_liste_fehler') inhalt = reviewListeFehltHtml(r);
  else if (inselGehalten) inhalt = `<div class="rv-alle" id="rv-insel" data-insel="${esc(reviewInselSchluessel())}"></div>`;
  else inhalt = gesamtInselHtml(r.nr, alle.abschnitte, reviewGesamtKontext(r), alle.vonListe);
  let summe = '';
  if (b.art === 'alle') {
    const offen = alle.abschnitte.some(ab => ab.status === 'da' && ab.staende.some(st => st.offen));
    const mitDateien = alle.abschnitte.some(ab => ab.status === 'da' && ab.antwort.dateien.length);
    let knopfAlle = '';
    if (mitDateien) knopfAlle = knopf(offen ? 'Alle einklappen' : 'Alle aufklappen', 'review-alle', null, 'rv-alle') + umbrechenSchalterHtml(S.ui.umbrechen) + nebeneinanderSchalterHtml(S.ui.nebeneinander);
    summe = `<div class="sum"><span id="rv-summe">${summeHtml(alle.abschnitte, esc)}</span>${knopfAlle}</div>`;
    const mitListe = alle.abschnitte.map((ab, a) => [ab, a]).filter(([ab]) => ab.status === 'da' && ab.antwort.dateien.length);
    if (mitListe.length) summe += reviewAufklapperHtml(r, abschnittSummen(alle.abschnitte).dateien, mitListe.map(([, a]) => `rv-a${a}-rail`).join(' '));
    const z = reviewAlleGesehen(alle);
    summe += gesehenZeileHtml({ ...z, fuer: r.gesehenFuer, speicherFehlt: r.gesehenFehler }, esc);
  }
  return `${reviewLeisteHtml(r, b)}<div class="rv-leiste">${summe}${ansage}</div>${inhalt}`;
}

/** Die erste Anwendung ist nicht erreichbar und die Liste der Commits scheitert (R00224 FA 5, PO Z. 511): eine Seitenmeldung mit dem
    grund der ersten Antwort und dem Grund der Liste; „Erneut versuchen“ liest beides. Die Ansage-Region bleibt leer. */
function reviewListeFehltHtml(r) {
  const satz = zustandSatz('repository_fehlt', '', r.alle.erste.fehler.daten.grund);
  const hinweis = satz.hinweis ? `<p class="rv-hin">${esc(satz.hinweis)}</p>` : '';
  const liste = `<p class="rv-satz">${esc(listeFehlerText(r.liste.fehler))} Die übrigen Anwendungen der Aufgabe sind deshalb nicht zu sehen.</p>`;
  return meldungHtml({ ton: satz.ton, rolle: 'alert', bild: zustandsSymbol(satz.symbol), zeilen: true, kopf: 'Das Repository einer Anwendung dieser Aufgabe ist nicht erreichbar.', rumpf: hinweis + liste, knoepfe: knopf('Erneut versuchen', 'review-erneut', 'alle', 'rv-erneut') });
}

/** Die Seite (Hauptbereich) aus dem Zustand; der Kopf steht in `#kopf` (vReviewKopf). */
function vReview() {
  const r = S.ui.review;
  if (!r) return '<div class="rv" id="review"></div>';
  const b = reviewBild(r);
  let railKlasse = '';
  if (r.railOffen) railKlasse = ' rail-offen';
  if (S.ui.umbrechen) railKlasse += ' umbr';
  const seite = inhalt => `<div class="rv${railKlasse}" id="review">${inhalt}</div>`;
  const erneut = ziel => knopf('Erneut versuchen', 'review-erneut', ziel, 'rv-erneut');
  const zurListe = knopf('Zur Liste der Commits', 'review-liste');
  if (b.art === 'ungueltig') return seite(meldungHtml({ rolle: 'status', kopf: 'Verweis ungültig.', text: 'Die Adresse nennt keinen Commit in gültiger Form.', knoepfe: zurListe }));
  if (b.art === 'unbekannt') return seite(meldungHtml({ rolle: 'status', kopf: `Aufgabe #${r.nr} gibt es nicht.`, knoepfe: knopf(r.basis === 'board' ? 'Zum Board' : 'Zu den Aufgaben', 'review-weg') }));
  if (r.ansicht === 'alle') return seite(vReviewAlle(r, b));
  if (b.art === 'diff') return seite(reviewDiffHtml(r, b));
  // die Leiste steht auch beim Laden und bei Fehlern (R00210 FA 2, S8; R00245 FA 7)
  const leiste = reviewLeisteHtml(r, b);
  if (b.art === 'liste_fehler') return seite(leiste + meldungHtml({ ton: 'fehl', rolle: 'alert', zeichen: 'achtung', kopf: esc(listeFehlerText(r.liste.fehler)), knoepfe: erneut('liste') + zurListe }));
  if (b.art === 'diff_fehler') return seite(leiste + diffFehlerHtml(r.diff.fehler, r.diff.verweis, esc));
  return seite(leiste + `<p class="rv-laedt" id="rv-laedt" role="status" aria-busy="true">Liest den Diff von ${esc(kurzVerweis(r.commit))} …</p>`);
}

/** Die Commit-Leiste beider Ansichten (R00245 FA 1–7): aus der schon gelesenen Liste, ohne eigene Anfrage (ADR-0042 Punkt 5). */
function reviewLeisteHtml(r, b) {
  const liste = r.liste || { status: 'laedt' };
  let werte = { status: liste.status };
  if (liste.status === 'da') werte = { status: 'da', folge: leistenFolge(liste.eintraege) };
  const seite = commit => reviewAdresseBilden({ basis: r.basis, slug: r.slug, nummer: r.nr, commit });
  return leisteHtml({ liste: werte, gezeigt: reviewGezeigt(r, b), alleHref: seite(null), adresse: seite, ansage: r.wahlAnsage }, esc);
}

/** Fokusziel und Ansage der Wahl von `verweis` in der Leiste (FA 6): der Eintrag und „Commit <i> von <n>: <kurz>“ wie beim Blättern. */
function reviewLeistenWahl(r, verweis) {
  if (!r.liste || r.liste.status !== 'da') return null;
  const commits = leistenFolge(r.liste.eintraege).commits;
  const i = commits.findIndex(c => c.verweis === verweis);
  if (i < 0) return null;
  return { fokus: `#rv-l${i + 1}`, ansage: `Commit ${i + 1} von ${commits.length}: ${commits[i].kurz}` };
}

/** Was die Leiste als gezeigt kennzeichnet (FA 5, 7): `'alle'`, den vollen Hash des gezeigten Commits der Folge oder null — beim
    Laden des Diffs den Eintrag, dessen Verweis die Adresse wörtlich nennt; ein Commit außerhalb der Folge (Rand b) keinen. */
function reviewGezeigt(r, b) {
  if (r.ansicht === 'alle') return 'alle';
  if (b.art === 'diff') {
    if (b.folge && b.folge.art === 'folge') return b.commit.hash;
    return null;
  }
  const liste = r.liste;
  if (!liste || liste.status !== 'da') return null;
  const genannt = liste.eintraege.find(e => e.verweis === r.commit && e.hash);
  if (!genannt) return null;
  return genannt.hash;
}

function reviewDiffHtml(r, b) {
  const antwort = r.diff.antwort, c = b.commit;
  const kurz = (antwort.anwendung ? `${antwort.anwendung}:` : '') + c.hash.slice(0, 7);
  let navigation = '';
  if (b.liste.status === 'fehler') navigation = `<div class="rv-lfehl" role="alert"><p>Die Liste der Commits ließ sich nicht lesen; das Blättern ist nicht möglich.</p>${knopf('Erneut versuchen', 'review-erneut', 'liste', 'rv-erneut')}</div>`;
  else if (b.folge && b.folge.art === 'folge') navigation = blaetternHtml(b.folge, esc(kurz), reviewSchmal(), Boolean(r.wahlAnsage));
  else if (b.folge) navigation = fremdHtml(kurz, esc);
  const offen = r.staende.some(s => s.offen);
  const alle = r.dateien.length ? knopf(offen ? 'Alle einklappen' : 'Alle aufklappen', 'review-alle', null, 'rv-alle') + umbrechenSchalterHtml(S.ui.umbrechen) + nebeneinanderSchalterHtml(S.ui.nebeneinander) : '';
  const summe = `<div class="sum"><span>${dateienWort(c.dateien)} · <span class="pl">+${tausender(c.plus)}</span> <span class="mi">−${tausender(c.minus)}</span></span>${alle}</div>`;
  const eintrag = b.liste.status === 'da' ? b.liste.eintraege.find(e => e.hash && e.hash.toLowerCase() === c.hash.toLowerCase()) : null;
  const leer = !r.dateien.length;
  let liste = '<p class="rv-leer">Dieser Commit ändert keine Dateien.</p>';
  let aufklapper = '';
  if (!leer) {
    liste = `<div class="rv-liste" id="rv-liste">${dateilisteHtml(r.dateien, esc, r.staende)}</div>`;
    aufklapper = reviewAufklapperHtml(r, r.dateien.length, 'rv-liste');
  }
  const rail = commitKopfHtml(c, antwort.anwendung, eintrag, esc, r.zweigeOffen) + liste;
  const schluessel = reviewInselSchluessel();
  const insel = leer ? '' : inselGehalten ? `<div class="rv-dateien" id="rv-insel" data-insel="${esc(schluessel)}"></div>` : inselHtml(schluessel, r.dateien, r.staende, r.hinweise, esc, r.gruppenOffen, reviewQuelle(r));
  const gesehen = gesehenZeileHtml({ k: reviewGesehenZahl(r.staende), n: r.staende.length, fuer: r.gesehenFuer, ungeladen: 0, speicherFehlt: r.gesehenFehler }, esc);
  return `${reviewLeisteHtml(r, b)}<div class="rv-leiste">${navigation}${summe}${aufklapper}${gesehen}</div><div class="rv-rumpf"><div class="rv-rail">${rail}</div><div class="rv-haupt">${gekapptHtml(r.hinweise)}${insel}</div></div>`;
}

/** Nach jedem Zeichnen liegt der gezeigte Eintrag der Leiste samt Fokusring ganz in ihrem sichtbaren Teil (R00245 FA 13): gerollt wird
    nur die Leiste über `scrollTop`, nie die Seite (kein `scrollIntoView`). */
function reviewLeisteEinpassen() {
  const leiste = document.getElementById('rv-ls');
  const gezeigt = leiste && leiste.querySelector('li > a[aria-current="page"]');
  if (!gezeigt) return;
  const sicht = leiste.getBoundingClientRect().top + leiste.clientTop, e = gezeigt.getBoundingClientRect();
  const stand = leiste.scrollTop;
  const lage = { stand, hoehe: leiste.clientHeight, oben: e.top - sicht + stand, unten: e.bottom - sicht + stand };
  const neu = leistenRollstand(lage, LEISTE_RING);
  if (neu !== stand) leiste.scrollTop = neu;
}
/** Platz des Fokusrings eines Eintrags: 2 px Linie und 2 px Abstand (kd-app.css `.rv-ce:focus-visible`). */
const LEISTE_RING = 4;

/** Aufklapper „Dateien (<n>) und Commits“ (R00235 FA 11, PO Z. 549): bis 1099 px stehen Dateiliste und Commits dahinter, beim Öffnen
    der Seite zu; ab 1100 px blendet das CSS ihn aus, die Liste steht links. `steuert` sind die Kennungen der Listen. */
function reviewAufklapperHtml(r, n, steuert) {
  return `<button type="button" class="btn rv-auf" id="rv-auf" data-act="review-rail" aria-expanded="${r.railOffen}" aria-controls="${steuert}">${symbol('pfeil', ' rv-auf-pf')}Dateien (${tausender(n)}) und Commits</button>`;
}

/** Kopf der Review-Seite (Artboard `#diff-fenster`): Rückweg „← #nr“, „Review“ als h1, Titel der Aufgabe, „liest nur“. */
function vReviewKopf() {
  const r = S.ui.review;
  const a = r && aufgabe(r.nr);
  const rueckweg = a ? `<a class="rv-rueck" id="rv-rueckweg" href="${esc(adresseBilden({ sicht: r.basis, slug: r.slug, nummer: r.nr }))}" data-act="review-zurueck">← #${r.nr}</a>` : '';
  return `<header class="kz rv-kz" data-stufe="${S.ui.stufe}"><div class="kz-reihe">${rueckweg}<h1 class="rv-h1">Review</h1><span class="rv-titel">${a ? esc(a.titel) : ''}</span><span class="rv-liest">liest nur</span></div></header>`;
}

/** Zurück ins Aufgabenfenster mit der Ansicht „Commits“ (FA 10): aus der Liste geöffnet ein Schritt zurück, sonst ersetzt. */
function reviewZurueck() {
  const r = S.ui.review;
  if (!r) return;
  S.ui.tab = 'commits';
  if (reviewAusDerListe()) { history.back(); return; }
  history.replaceState(null, '', adresseBilden({ sicht: r.basis, slug: r.slug, nummer: r.nr }));
  adresseGewechselt();
}

/** Öffnet die Review-Seite aus der Ansicht „Commits“ mit einem neuen Verlaufseintrag samt Marke (ADR-0033 Punkt 2). */
function reviewOeffnen(verweis) {
  const u = S.ui;
  if (!u.offen) return;
  u.reviewHerkunft = verweis || null;
  const basis = u.view === 'aufgaben' ? 'aufgaben' : 'board';
  history.pushState(REVIEW_AUS_DER_LISTE, '', reviewAdresseBilden({ basis, slug: u.slug, nummer: u.offen, commit: verweis || null }));
  adresseGewechselt();
}

/* ── Laufansicht (R00221, ADR-0041): eigene Adresse hinter `/aufgabe/<nr>`, ein Lesen im Strom mit Grenze, Einträge als Insel ── */

/** Marke am Verlaufseintrag einer Laufansicht, die über „Ansehen“ geöffnet wurde: der Eintrag davor ist das Fenster mit „Läufe“. */
const LAUF_AUS_DER_LISTE = { kdLaufAusListe: true };
const laufAusDerListe = () => Boolean(history.state) && history.state.kdLaufAusListe === true;

/** Die gespeicherte Kennung, die die Adresse sucht (FA 2): nur ein Textvergleich mit `a.transkripte`; ohne Treffer null. */
function laufTreffer(v) {
  const a = aufgabe(v.nr);
  if (!a || v.gesucht === null) return null;
  return (a.transkripte || []).find(t => t.kennung === v.gesucht) || null;
}

/** Die Zeile von `laeufe()` zum Treffer — Kopf und Leiste kommen aus dem Stand der Aufgabe, ohne eigenes Lesen (FA 4). */
function laufZeile(v) {
  const treffer = laufTreffer(v), a = aufgabe(v.nr);
  if (!treffer) return null;
  return laeufe(a.transkripte || [], a.kosteneintraege || []).find(z => z.transkript && z.kennung === treffer.kennung) || null;
}

/** Vor jedem Zeichnen: ist die Laufansicht gezeigt und ihre Adresse neu, beginnt das Lesen jetzt (einmal je Adresse). Ist sie
    nicht gezeigt, bricht die laufende Anfrage ab, der Zustand fällt weg, und der Fokus soll zurück auf „Ansehen“ (FA 3). */
function laufAnstossen() {
  const v = S.ui.lauf;
  if (S.ui.view !== 'lauf') {
    if (v) {
      laufAbbrechen(v);
      const treffer = laufTreffer(v);
      S.ui.fokusNachLaeufe = { nr: v.nr, kennung: treffer ? treffer.kennung : null };
    }
    S.ui.lauf = null;
    return;
  }
  const hash = location.hash, adresse = adresseLesen(hash);
  if (!adresse.lauf || (v && v.adresse === hash)) return;
  if (v) laufAbbrechen(v);
  const l = adresse.lauf;
  S.ui.lauf = { adresse: hash, nr: l.nummer, basis: l.basis, slug: adresse.slug, gesucht: l.kennung, laedt: false, ergebnis: null, anfrage: null, erneut: false, insel: null,
    filter: FILTER_VORGABE, ansage: null, geblaettert: false };
  S.ui.fokus = '#lv-h1';
  // geblättert (R00239 FA 6, FA 12): die Filter kommen mit, der Fokus bleibt auf dem Link
  const wechsel = laufWechselNehmen(hash);
  if (wechsel) {
    S.ui.lauf.filter = wechsel.filter;
    S.ui.lauf.geblaettert = true;
    S.ui.fokus = wechsel.fokus;
  }
  laufLesen(S.ui.lauf);
}

/** Der Merker des Blätterns, wenn er zu dieser Adresse gehört; er gilt genau einmal. */
function laufWechselNehmen(hash) {
  const wechsel = S.ui.laufWechsel;
  S.ui.laufWechsel = null;
  if (wechsel && wechsel.adresse === hash) return wechsel;
  return null;
}

/** Die Läufe der Aufgabe als Folge um die gezeigte Kennung (R00239 FA 10), aus dem Stand der Aufgabe, ohne Anfrage; sonst null. */
function laufFolge(v) {
  const a = aufgabe(v.nr);
  if (!a) return null;
  return laeufeFolge(a.transkripte || [], v.gesucht);
}

/** Endansage nach dem Blättern (R00239 FA 12, PO Z. 589): „Lauf k von n, Rolle …“ vor dem Satz des Zustands; einmal gesetzt, damit
    ein späteres Live-Ereignis sie nicht ändert. */
function laufWechselAnsage(v) {
  const satz = laufAnsage({ laedt: false, ergebnis: v.ergebnis });
  const folge = laufFolge(v);
  if (!folge) return satz;
  return laufBlaetternAnsage(folge, satz);
}

/** „‹ Voriger Lauf“ / „Nächster Lauf ›“ (R00239 FA 12, ADR-0041 N1 Punkt 5): ersetzt die Adresse ohne Verlaufseintrag — der Eintrag
    behält seinen Zustand, „‹ #<nr>“ führt weiter zu „Läufe“; die Filter kommen mit, der Fokus bleibt auf dem gewählten Link. */
function laufBlaettern(kennung) {
  const v = S.ui.lauf, folge = v && laufFolge(v);
  if (!folge) return;
  let fokus = '#lv-nach';
  if (folge.vorige && folge.vorige.kennung === kennung) fokus = '#lv-vor';
  const adresse = laufAdresseBilden({ basis: v.basis, slug: v.slug, nummer: v.nr, kennung });
  S.ui.laufWechsel = { adresse, filter: v.filter, fokus };
  history.replaceState(history.state, '', adresse);
  adresseGewechselt();
}

/** Bricht die laufende Anfrage ab: Verlassen, ein Wechsel der Kennung oder ein neues Lesen (ADR-0041 Punkt 4). */
function laufAbbrechen(v) {
  if (v.anfrage) v.anfrage.abbruch.abort();
  v.anfrage = null;
}

/** Liest das Transkript des Treffers einmal und zeichnet einmal: nach sauberem Ende oder an der Grenze (FA 5). Die Antwort gilt nur,
    solange dieselbe Seite mit derselben Anfrage steht (ADR-0014). Ohne Treffer geht keine Anfrage hinaus; das Ergebnis kommt dann
    erst im nächsten Schritt, damit der Statusbereich vorher stand und die Meldung genau einmal sagt (FA 11, UX N1). */
async function laufLesen(v) {
  laufAbbrechen(v);
  v.ansage = null;
  const anfrage = v.anfrage = { abbruch: new AbortController() };
  const treffer = laufTreffer(v);
  v.laedt = Boolean(treffer) || v.erneut;
  let ergebnis;
  if (!treffer) {
    await new Promise(weiter => setTimeout(weiter, 0));
    ergebnis = { art: 'fehler', fehler: { art: 'unbekannt' } };
  } else {
    ergebnis = await transkriptLesen(`/api/aufgaben/${v.nr}/transkripte/${encodeURIComponent(treffer.kennung)}`, anfrage.abbruch.signal);
  }
  if (S.ui.lauf !== v || v.anfrage !== anfrage) return;
  v.anfrage = null;
  v.laedt = false;
  v.ergebnis = ergebnis;
  if (v.geblaettert) v.ansage = laufWechselAnsage(v);
  const nachOben = v.erneut;
  if (v.erneut) S.ui.fokus = ergebnis.art === 'fehler' ? '#lv-erneut' : '#lv-h1';
  v.erneut = false;
  render();
  const seite = document.getElementById('lauf');
  if (nachOben && seite) seite.scrollTop = 0;
}

/** `GET …/transkripte/{kennung}` mit den Fristen des Diffs → `{art: 'eintraege', html, grenze}`, `{art: 'fehlt'}` oder
    `{art: 'fehler', fehler}`. Entpackt im Strom; an der Grenze bricht das Lesen ab und gibt das Budget des Servers frei — das
    ist kein Fehler. Jeder Fehler vor dem Ende verwirft das Gelesene (ADR-0041 Punkt 4). */
async function transkriptLesen(pfad, abbruchSignal) {
  try {
    const gelesen = await mitFristen(pfad, abbruchSignal, async (r, netzFehler, abbruch) => {
      if (!r.ok) await antwortFehler(r, netzFehler);
      const quelle = { netz: false };
      const zeilen = [];
      let grenze = false;
      try {
        for await (const s of zeilenLesen(entpacktLesen(r.body, quelle), LAUF_GRENZEN)) {
          if ('grenze' in s) grenze = s.grenze;
          else zeilen.push(s);
        }
      } catch (g) {
        if (quelle.netz || abbruch.signal.aborted) throw netzFehler();
        throw g;
      }
      if (grenze) abbruch.abort();
      return { zeilen, grenze };
    });
    // einmal je erfolgreichem Lesen ausgewertet (R00234 FA 11); Live zeichnet Kopf und Kennzahlen aus dieser Auswertung neu
    const auswertung = laufAuswerten(gelesen.zeilen, gelesen.grenze);
    return { art: 'eintraege', grenze: gelesen.grenze, zeilen: gelesen.zeilen, auswertung, bericht: laufBerichtHtml(auswertung, esc), html: laufHtml(gelesen.zeilen, gelesen.grenze, esc, auswertung) };
  } catch (g) {
    // FA 8: Server, Verbindung, Entpacken, `fehlt` — jede andere Ausnahme beim Lesen oder Zeichnen heißt „verarbeiten“ (PO Z. 495)
    const fehler = laufFehlerArt(g);
    if (fehler.art === 'fehlt') return { art: 'fehlt' };
    return { art: 'fehler', fehler };
  }
}

/** Die Bytes des Rumpfs entpackt, als Folge von Stücken für `zeilenLesen`. Ein Fehler der Verbindung ist in `quelle.netz` vermerkt,
    damit er nicht als „lässt sich nicht entpacken“ gilt; endet das Lesen vorzeitig (Grenze), wird der Strom abgebrochen. */
async function* entpacktLesen(rumpf, quelle) {
  const roh = rumpf.getReader();
  const beobachtet = new ReadableStream({
    async pull(steuerung) {
      let stueck;
      try { stueck = await roh.read(); } catch (g) { quelle.netz = true; steuerung.error(g); return; }
      if (stueck.done) steuerung.close();
      else steuerung.enqueue(stueck.value);
    },
    cancel: grund => roh.cancel(grund),
  });
  const leser = beobachtet.pipeThrough(new DecompressionStream('gzip')).getReader();
  let fertig = false;
  try {
    for (;;) {
      let stueck;
      // nur ein Fehler des Entpackens heißt „lässt sich nicht entpacken“ (abgeschnitten, Prüfsumme, zwei Glieder)
      try { stueck = await leser.read(); } catch (g) { throw quelle.netz ? g : Object.assign(new Error('entpacken'), { entpacken: true }); }
      if (stueck.done) { fertig = true; return; }
      yield stueck.value;
    }
  } finally {
    if (!fertig) leser.cancel().catch(() => { });
  }
}

/** Kopf der Laufansicht (Zeichnung `#laufansicht`): Rückweg „‹ #nr“, „Lauf“ als h1 mit Rolle und Zeitpunkt, „liest nur“. */
function vLaufKopf() {
  const v = S.ui.lauf;
  const zeile = v && laufZeile(v);
  const zurueck = v ? `<a class="rv-rueck" id="lv-rueckweg" href="${esc(adresseBilden({ sicht: v.basis, slug: v.slug, nummer: v.nr }))}" data-act="lauf-zurueck" aria-label="Zurück zur Aufgabe #${v.nr}"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>#${v.nr}</a>` : '';
  const titel = zeile ? `<span class="rv-titel">${laeufeTitelHtml(zeile, esc)}</span>` : '';
  return `<header class="kz rv-kz lv-kz" data-stufe="${S.ui.stufe}"><div class="kz-reihe">${zurueck}<h1 class="rv-h1" id="lv-h1" tabindex="-1">Lauf</h1>${titel}<span class="rv-liest">liest nur</span></div></header>`;
}

/** Ab 641 px steht „Zeigen“ als erstes Kind des Seitenfelds, darunter bis 640 px (R00243 FA 4); der Wechsel zeichnet neu. */
const laufSeitenfeldBreit = () => matchMedia('(min-width:641px)').matches;
/** Steht „Zeigen“ im gezeichneten Seitenfeld als erstes Kind? Ohne Seitenfeld oder ohne Listen (nichts zu ordnen) so wie verlangt. */
function laufFeldZuerst() {
  const feld = document.querySelector('.lv-gl');
  if (!feld || feld.childElementCount === 1) return laufSeitenfeldBreit();
  return feld.firstElementChild.matches('fieldset.lv-filt');
}

/** Die Einträge des letzten Zeichnens, wenn sie zum gezeigten Ergebnis gehören: sie bleiben derselbe Knoten (ADR-0041 Punkt 5). */
let laufInselGehalten = null;
const LAUF_INSEL_PLATZHALTER = '<ol class="lv-l" id="lv-insel" data-ohne-rollstand></ol>';

/** Die Seite (Hauptbereich): Leiste aus dem Stand der Aufgabe, darunter Statusbereich und Ergebnis. */
function vLauf() {
  const v = S.ui.lauf;
  if (!v) return '<div class="lv" id="lauf"></div>';
  const zeile = laufZeile(v);
  const e = v.ergebnis;
  let insel = '';
  // der Bericht steht vor der Insel, nicht in ihr: ein Filter der Einträge verbirgt ihn nie (R00234 FA 5)
  // der Bericht steht im Dokument vor der Gliederung: unter 641 px liest er sich zuerst (PO Z. 590); daneben ordnet ihn das Raster
  if (e && e.art === 'eintraege') insel = `<div class="lv-rumpf2">${e.bericht}${laufTopHtml(e.auswertung, esc, laufFilterHtml(v.filter), laufSeitenfeldBreit())}<div class="lv-haupt">${laufKeineFehlerHtml(e.auswertung, v.filter)}${laufInselGehalten ? LAUF_INSEL_PLATZHALTER : laufInselText(e)}</div></div>`;
  const kopf = laufKopfHtml({ zustand: laufKopfZustand(v), auswertung: e && e.auswertung, kosten: zeile && zeile.kosten }, esc);
  let zeitachse = '';
  if (e && e.art === 'eintraege') zeitachse = laufZeitachseHtml(e.auswertung);
  let leiste = '';
  if (zeile) leiste = laeufeLeisteHtml(zeile, esc, groesse, laeufeBlaetternHtml(laufFolge(v), kennung => laufAdresseBilden({ basis: v.basis, slug: v.slug, nummer: v.nr, kennung }), esc));
  return `<div class="lv" id="lauf">${leiste}${kopf}${zeitachse}${laufRumpfHtml(v, insel, esc)}</div>`;
}

/** Zustand des Kopfs (R00234 FA 3, FA 4): Einträge gelesen, liest gerade (auch erneut) oder ohne Einträge (fehlt, Fehler). */
function laufKopfZustand(v) {
  if (v.ergebnis && v.ergebnis.art === 'eintraege') return 'eintraege';
  if (v.laedt || !v.ergebnis) return 'liest';
  return 'ohne';
}

/** Vor dem Zeichnen: steht die Insel des gezeigten Ergebnisses im Dokument, bleibt sie; der Schlüssel ist das Ergebnis selbst. */
function laufInselVorher() {
  const v = S.ui.lauf, alt = document.getElementById('lv-insel');
  if (S.ui.view !== 'lauf' || !v || !v.insel || !alt) return null;
  return v.insel.knoten === alt && v.insel.ergebnis === v.ergebnis ? alt : null;
}

/** Nach dem Zeichnen: der Knoten der Einträge und das Ergebnis, zu dem er gehört; fiel der Pfad anders aus, kommt der Text hinein. */
function laufInselNachher(gehalten, gehaltenGeblieben) {
  const v = S.ui.lauf;
  if (S.ui.view !== 'lauf' || !v) return;
  const e = v.ergebnis;
  if (gehalten && !gehaltenGeblieben && e && e.art === 'eintraege') document.getElementById('lv-insel').outerHTML = laufInselText(e);
  const knoten = document.getElementById('lv-insel');
  v.insel = knoten ? { knoten, ergebnis: e } : null;
  if (knoten) laufFilterAnInsel(knoten, v.filter);
  laufSeitenfeldOhneRollstand();
  // eingesetzt: der Text fällt aus dem Zustand (ADR-0041 Punkt 5); muss die Insel neu entstehen, wird er aus den Einträgen gebaut
  if (knoten && e && e.art === 'eintraege') e.html = null;
}

/** Das Seitenfeld rollt ab 641 px innen und steht nach jedem Zeichnen oben, damit „Zeigen“ sichtbar ist (R00243 FA 5): die Marke nimmt es
    aus dem Merken der Rollstände (`sichtzustand.js`), das beim nächsten Zeichnen den alten Stand sonst zurücklegte. */
function laufSeitenfeldOhneRollstand() {
  const feld = document.querySelector('#lauf .lv-gl');
  if (feld && !feld.hasAttribute('data-ohne-rollstand')) feld.setAttribute('data-ohne-rollstand', '');
}

/** Der Stand der Filter als Attribute an der Insel (R00239 FA 6): nach jedem Zeichnen gesetzt — nach frischem Aufbau, Live und Wechsel;
    das CSS blendet die Zeilen aus, die Insel bleibt derselbe Knoten. */
function laufFilterAnInsel(knoten, filter) {
  const zeigen = laufZeigenWert(filter);
  if (knoten.getAttribute('data-zeigen') !== zeigen) knoten.setAttribute('data-zeigen', zeigen);
  if (knoten.hasAttribute('data-nur-fehler') !== filter.f) knoten.toggleAttribute('data-nur-fehler', filter.f);
}

/** Der Text der Einträge: einmal beim Lesen gebaut; nach dem Einsetzen nur noch aus den Einträgen, wenn die Insel neu entsteht. */
function laufInselText(e) {
  return e.html === null ? laufHtml(e.zeilen, e.grenze, esc, e.auswertung) : e.html;
}

/** Öffnet die Laufansicht aus „Läufe“ mit einem neuen Verlaufseintrag samt Marke (ADR-0041 Punkt 2). */
function laufOeffnen(kennung) {
  const u = S.ui;
  if (!u.offen) return;
  const basis = u.view === 'aufgaben' ? 'aufgaben' : 'board';
  history.pushState(LAUF_AUS_DER_LISTE, '', laufAdresseBilden({ basis, slug: u.slug, nummer: u.offen, kennung }));
  adresseGewechselt();
}

/** „Längste Schritte“ (R00234 FA 10): die Zeile unter den Seitenkopf holen, ohne die Adresse zu ändern und ohne Ansage; bei
    `prefers-reduced-motion: reduce` ohne Animation. */
function laufZeileZeigen(id) {
  const zeile = document.getElementById(id);
  if (!zeile) return;
  const ohneBewegung = matchMedia('(prefers-reduced-motion: reduce)').matches;
  zeile.scrollIntoView({ block: 'start', behavior: ohneBewegung ? 'instant' : 'smooth' });
  laufZeileNachfuehren(zeile);
}

/** Höchstens so viele Bilder (etwa 2 s) führt `laufZeileNachfuehren` die Zeile nach. */
const NACHFUEHREN_BILDER = 120;
/** Eingaben des Menschen, die das Nachführen beenden: er rollt selbst. */
const NACHFUEHREN_ENDE = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
let laufNachfuehrung = 0;

/** Die Einträge vor der Zeile tragen bis zu ihrem ersten Zeichnen nur die geschätzte Höhe (`content-visibility`, ADR-0041
    Punkt 5); werden sie beim Rollen gemessen, rückt die Zeile aus dem Blick (Befund Entwicklertest #251). Darum: ruht die Lage
    der Zeile zwei Bilder lang, ohne Animation erneut an sie rollen — über die ganze Frist von `NACHFUEHREN_BILDER` Bildern, denn
    die Messung kann auch ein Bild nach einem ruhigen Stand noch kommen (R00238: höhere Zeilen, Sprung ohne Animation). Ein neuer
    Sprung oder eine Eingabe des Menschen beendet das Nachführen. Die Insel bleibt, wie sie ist. */
function laufZeileNachfuehren(zeile) {
  const lauf = ++laufNachfuehrung;
  const beenden = () => { if (lauf === laufNachfuehrung) laufNachfuehrung++; };
  NACHFUEHREN_ENDE.forEach(art => addEventListener(art, beenden, { capture: true, passive: true, once: true }));
  const aufraeumen = () => NACHFUEHREN_ENDE.forEach(art => removeEventListener(art, beenden, { capture: true }));
  let bilder = 0, ruhig = 0, lage = zeile.getBoundingClientRect().top;
  const schritt = () => {
    const vorbei = lauf !== laufNachfuehrung || ++bilder > NACHFUEHREN_BILDER || !zeile.isConnected;
    if (vorbei) { aufraeumen(); return; }
    const jetzt = zeile.getBoundingClientRect().top;
    ruhig = Math.abs(jetzt - lage) < 1 ? ruhig + 1 : 0;
    lage = jetzt;
    if (ruhig >= 2) {
      zeile.scrollIntoView({ block: 'start', behavior: 'instant' });
      lage = zeile.getBoundingClientRect().top;
      ruhig = 0;
    }
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}

/** Zurück ins Aufgabenfenster mit der Ansicht „Läufe“ (FA 3): über „Ansehen“ geöffnet ein Schritt zurück, sonst ersetzt. */
function laufZurueck() {
  const v = S.ui.lauf;
  if (!v) return;
  S.ui.tab = 'laeufe';
  if (laufAusDerListe()) { history.back(); return; }
  history.replaceState(null, '', adresseBilden({ sicht: v.basis, slug: v.slug, nummer: v.nr }));
  adresseGewechselt();
}

/** Zeichnet den Hauptbereich neu und lässt dabei die Personenwahl des Stundenzettels als denselben Knoten stehen, damit ein
    fremdes Live-Ereignis eine offene Liste nicht schließt und der Fokus nicht springt (R00201 AK 9). Chromium schließt die
    Liste schon, wenn der Knoten nur verschoben wird (auch mit `moveBefore`, geprobt in Chromium 159): er darf seinen Platz im
    Dokument nicht verlassen. Darum bleibt der Pfad von #main bis zur Liste stehen; ersetzt werden die Geschwister auf jeder Stufe,
    an der Liste die Einträge und die Wahl. Zeichnet die neue Ansicht den Pfad anders, wird wie sonst alles ersetzt.
    Die Wurzel ist `#main` oder `#over` (Insel der Ansicht „Läufe“, ADR-0039 N1). Liefert, ob der bleibende Knoten stehen blieb. */
function hauptbereichErsetzen(hauptbereich, html, personenwahlVorher, inselVorher = null) {
  const vorlage = document.createElement('template');
  vorlage.innerHTML = html;
  // Die Insel der Review-Seite (ADR-0033 Punkt 4) bleibt auf demselben Weg stehen wie die Personenwahl: ihr Pfad bleibt, der
  // Platzhalter mit demselben Schlüssel wird nicht eingesetzt — Klappen, Nachgeladenes, Textauswahl und Leseposition bleiben.
  const bleibend = inselVorher || personenwahlVorher;
  const personenwahlNeu = bleibend && vorlage.content.querySelector('#' + bleibend.id);
  const altPfad = pfadZu(bleibend, hauptbereich);
  const neuPfad = pfadZu(personenwahlNeu, vorlage.content);
  if (!pfadeGleichenSich(altPfad, neuPfad)) {
    hauptbereich.replaceChildren(vorlage.content);
    return false;
  }
  let altEltern = hauptbereich;
  let neuEltern = vorlage.content;
  altPfad.slice(0, -1).forEach((altKnoten, stufe) => {
    const neuKnoten = neuPfad[stufe];
    geschwisterErsetzen(altEltern, altKnoten, neuEltern, neuKnoten);
    attributeAbgleichen(altKnoten, neuKnoten);
    altEltern = altKnoten;
    neuEltern = neuKnoten;
  });
  if (!inselVorher) personenwahlAbgleichen(personenwahlVorher, personenwahlNeu);
  geschwisterErsetzen(altEltern, bleibend, neuEltern, personenwahlNeu);
  return true;
}

/** Elemente von der Wurzel (ausgeschlossen) bis `knoten`; leer, wenn `knoten` fehlt oder nicht unter der Wurzel liegt. */
function pfadZu(knoten, wurzel) {
  const pfad = [];
  let aktuell = knoten;
  while (aktuell && aktuell !== wurzel) {
    pfad.unshift(aktuell);
    aktuell = aktuell.parentNode;
  }
  if (aktuell !== wurzel) return [];
  return pfad;
}

function pfadeGleichenSich(altPfad, neuPfad) {
  if (altPfad.length === 0 || altPfad.length !== neuPfad.length) return false;
  return altPfad.every((altKnoten, stufe) => altKnoten.tagName === neuPfad[stufe].tagName);
}

/** Ersetzt alles neben `altKnoten` in `altEltern` durch das, was neben `neuKnoten` in `neuEltern` steht; die beiden bleiben außen vor. */
function geschwisterErsetzen(altEltern, altKnoten, neuEltern, neuKnoten) {
  const neueKinder = Array.from(neuEltern.childNodes);
  const stelle = neueKinder.indexOf(neuKnoten);
  Array.from(altEltern.childNodes).filter(kind => kind !== altKnoten).forEach(kind => kind.remove());
  altEltern.prepend(...neueKinder.slice(0, stelle));
  altEltern.append(...neueKinder.slice(stelle + 1));
}

function attributeAbgleichen(altKnoten, neuKnoten) {
  Array.from(altKnoten.attributes).filter(attribut => !neuKnoten.hasAttribute(attribut.name)).forEach(attribut => altKnoten.removeAttribute(attribut.name));
  Array.from(neuKnoten.attributes).filter(attribut => altKnoten.getAttribute(attribut.name) !== attribut.value).forEach(attribut => altKnoten.setAttribute(attribut.name, attribut.value));
}

/** Nur Einträge und Wahl ziehen nach; ein Knoten mit gleichem Inhalt wird nicht angefasst. */
function personenwahlAbgleichen(vorher, neu) {
  const wahl = neu.value;
  attributeAbgleichen(vorher, neu);
  if (vorher.innerHTML !== neu.innerHTML) vorher.replaceChildren(...neu.childNodes);
  vorher.value = wahl;
}

/** Name einer schreibenden Anfrage als Auslöser einer Meldung: dieselbe Anfrage ist dieselbe Aktion. */
const anfrageName = (methode, pfad) => `${methode} ${pfad}`;
/** Auslöser aller Meldungen und Erfolge eines Rückgängig. */
const RUECKGAENGIG = 'rueckgaengig';

/** Meldung und abgelehnte Eingabe des Fensters stehen und gehen nur gemeinsam (R00155 G-3). Räumt beide, wenn die abgelehnte
    Eingabe nicht zu `feld` gehört — ihr Feld zeigt wieder den Stand der Datei, der Titel den Lesezustand. Wahr, wenn geräumt wurde. */
function abgelehnteEingabeRaeumen(feld = null) {
  const u = S.ui;
  const abgelehnt = abgelehntesFeld(u.entwurf, { text: u.fensterFehler, feld: u.fensterFehlerFeld }, u.offen);
  if (abgelehnt === null || abgelehnt === feld) return false;
  u.entwurf = null;
  u.fensterFehler = null;
  u.fensterFehlerFeld = null;
  u.fensterFehlerAusloeser = null;
  if (abgelehnt === TITEL_FELD) u.titelBearbeiten = false;
  return true;
}

/** Ein Schreibweg des Aufgabenfensters ist angenommen; `feld` nennt das Eingabefeld, aus dem er kam, `ausloeser` die Aktion.
    Die Meldung geht nur, wenn sie zu diesem Erfolg gehört (`meldungGehtMitErfolg`): die abgelehnte Eingabe eines anderen
    Felds (R00155 G-3) und die Meldung einer anderen Aktion (R00185 108-2) bleiben stehen. */
function meldungNachErfolgRaeumen(feld = null, ausloeser = null) {
  const u = S.ui;
  const meldung = { text: u.fensterFehler, feld: u.fensterFehlerFeld, ausloeser: u.fensterFehlerAusloeser };
  if (meldungGehtMitErfolg(u.entwurf, meldung, u.offen, { feld, ausloeser })) fensterMelden(null);
}
/** Wie `meldungNachErfolgRaeumen`, dazu „gespeichert hh:mm:ss“ im Fuß. */
function gespeichertMelden(feld = null, ausloeser = null) {
  S.ui.gespeichert = Date.now();
  meldungNachErfolgRaeumen(feld, ausloeser);
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

/** Der Link auf die Aufgabe in der gezeigten Ansicht (R00174): auf dem Board mit dessen Slug, sonst über die Aufgabenliste.
    Der Host ist der des Betrachters (ADR-0029 Regel 4). */
function linkDerAufgabe(nummer) {
  let sicht = 'aufgaben';
  if (S.ui.view === 'board' && S.ui.slug) sicht = 'board';
  return location.origin + location.pathname + adresseBilden({ sicht, slug: S.ui.slug, nummer });
}

/** Wahr, wenn der Text in der Zwischenablage liegt; falsch, wenn der Browser sie verweigert oder keine hat (unsicherer Kontext). */
async function linkInDieZwischenablage(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (_) { return false; }
}

/** Räumt weg, was das Fenster für die vorige Aufgabe hielt — vor jedem Öffnen einer Aufgabe. */
function fensterZuruecksetzen() {
  const u = S.ui;
  u.pop = null; u.zeitEdit = null; u.beschreibungBearbeiten = false; u.titelBearbeiten = false;
  // Die gewählte Ansicht bleibt beim Öffnen einer anderen Aufgabe (R00145 FA 9); führt die Aufgabe sie nicht, fällt sie
  // in vFenster über reiterSchluessel auf „Inhalt“. Die Inhalte der vorigen Aufgabe fallen sofort weg (R00110/R00123).
  u.fensterMenue = null; u.gespeichert = null; fensterMelden(null);
  u.entwurf = null; u.datei = null; u.anhaenge = [];
  u.verlauf = null; u.verlaufFehler = null; u.commits = null;
  // ein Ziel aus der Adresse, das noch auf seine Antwort wartet, gilt nicht mehr (R00174)
  u.offenDefekt = null; u.defektDatei = null; u.linkZiel = null;
}

/** Öffnet das Aufgabenfenster auf dem Reiter Inhalt und lädt seine Datei; was der Aufrufer zusätzlich braucht, setzt er danach. */
async function fensterOeffnen(nummer) {
  const u = S.ui;
  fensterZuruecksetzen();
  u.offen = nummer;
  // bei gewähltem Verlauf zuerst die leere Tabelle zeichnen — nie Zeilen der vorigen Aufgabe (R00123)
  if (u.tab === 'verlauf') render();
  await dateiLaden();
}

/** `feld` nennt das Eingabefeld, aus dem die Änderung kommt; eine Ablehnung macht es ungültig. */
async function aufgabeAendern(nummer, aenderung, feld = null) {
  if (ichNoetig()) { render(); return false; }
  let gelungen = true;
  // dieselbe Aktion ist die Änderung derselben Felder derselben Aufgabe
  const ausloeser = `${anfrageName('PATCH', '/api/aufgaben/' + nummer)} ${Object.keys(aenderung).join(',')}`;
  try {
    await durchDieSchlange(() => api('PATCH', '/api/aufgaben/' + nummer, aenderung));
    gespeichertMelden(feld, ausloeser);
  } catch (f) { fensterMelden(f.message, feld, ausloeser); gelungen = false; }
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
    dem Stift (R00162 AK 7). Wer mit Tab oder Klick weiterging, behält sein Ziel — auch, wenn er erst nach dem Vormerken
    klickt und das Zeichnen erst mit der Antwort des Servers kommt: das Ziel ist nur vorgemerkt (R00191 AK 4). */
function fokusNachBeschreibung() {
  if (document.activeElement === document.body) S.ui.fokusVorgemerkt = BEARBEITUNGSMODUS.beschreibung.ausloeser;
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
  menueOeffnen(`${nummern.length} Karten`, massenMenue(nummern, { spalten: S.board.spalten.map(sp => sp.name), klassen: vorrat(), boards }), x, y);
}
/** Im Dialog gelten nur Esc und Enter; die Leertaste schaltet das Kästchen selbst um. */
function zuweisenTaste(e, t) {
  if (e.key === 'Escape') { e.preventDefault(); act('zuweisen-ab'); }
  else if (e.key === 'Enter' && t.tagName !== 'BUTTON') { e.preventDefault(); act('zuweisen-ok'); }
}

/* Datum zu Ende tippen (R00179, ADR-0010 N10 Ziffer 2): Ein Zeichnen ersetzt das Datumsfeld, und das neue Feld beginnt
   wieder beim Tag — der Browser gibt nicht preis, in welchem Teil (Tag, Monat, Jahr) getippt wurde. Solange in einem
   Datumsfeld getippt wird, wartet das Zeichnen deshalb wie beim Zug und wird danach genau einmal nachgeholt. Die Eingabe
   beginnt mit einer Ziffer und endet ohne Frist: wenn das Datum gespeichert oder verworfen ist, das Feld verlassen wird,
   eine Taste etwas auslöst (Esc, Tastenkürzel), ein Zeiger woanders drückt oder die Adresse wechselt.
   Verlässt ein Zeiger das Datumsfeld, speichert das Verlassen mitten in der Geste; auch dieses Zeichnen wartet, bis der
   Zeiger losgelassen ist — sonst ersetzte es das Ziel des Klicks, bevor er es erreicht (R00191, N10 Ziffer 2, dritte Lage). */
/** Das Datumsfeld, in dem gerade getippt wird — mit und ohne Knopf. */
let datumseingabe = null;
/** Wahr zwischen Drücken und Loslassen eines Zeigers: das nachgeholte Zeichnen ersetzte sonst das Ziel des Klicks. */
let zeigerUnten = false;
/** Wahr zwischen Drücken und Loslassen eines Zeigers, der ein fokussiertes Datumsfeld verlässt. */
let zeigerVerlaesstDatumsfeld = false;
/** Nur ein Feld, das den Fokus trägt, hält das Zeichnen auf: verliert es ihn, ohne dass der Browser ein Verlassen meldet
    (ein verborgenes Feld), bliebe die Seite sonst stehen. */
const datumseingabeLaeuft = () => datumseingabe !== null && document.activeElement === datumseingabe;
function datumseingabeBeenden() {
  if (datumseingabe === null) return;
  datumseingabe = null;
  // erst nach dem, was die Eingabe beendet hat: zeichnet es selbst (Speichern, Fenster schließen), ist nichts mehr nachzuholen
  setTimeout(zeichnenNachholen, 0);
}
function zeichnenNachholen() {
  if (S.ui.nachDatum && !zeigerUnten) render();
}
document.addEventListener('keydown', e => {
  const bedeutung = datumstaste(e);
  const imDatumsfeld = Boolean(e.target.matches) && e.target.matches('input[type="date"]');
  if (bedeutung === 'beginnt' && imDatumsfeld) datumseingabe = e.target;
  if (bedeutung === 'endet') datumseingabeBeenden();
}, true);
document.addEventListener('pointerdown', e => {
  zeigerUnten = true;
  const aktiv = document.activeElement;
  zeigerVerlaesstDatumsfeld = Boolean(aktiv) && aktiv.matches('input[type="date"]') && e.target !== aktiv;
  // ein Zeigerdruck im selben Feld setzt nur die Marke um; die Eingabe läuft weiter
  if (e.target !== datumseingabe) datumseingabeBeenden();
}, true);
function zeigerLosgelassen() {
  zeigerUnten = false;
  zeigerVerlaesstDatumsfeld = false;
  // nach dem Klick, der auf das Loslassen folgt
  setTimeout(zeichnenNachholen, 0);
}
for (const zeigerLos of ['pointerup', 'pointercancel']) document.addEventListener(zeigerLos, zeigerLosgelassen, true);
// Ohne Loslassen endet die Geste auch: das Kontextmenü des Browsers und ein Fenster, das den Fokus verliert, schlucken das
// „pointerup“ — die Seite stünde sonst still, bis der nächste Klick kommt (Review #192)
document.addEventListener('contextmenu', zeigerLosgelassen, true);
window.addEventListener('blur', zeigerLosgelassen);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') zeigerLosgelassen(); });

/** Die Lebensdauer eines Hinweises zählt ab seinem ersten Zeigen (R00186): wartete das Zeichnen hinter einem Zug oder einer
    Datumseingabe länger als sie, verfiele die Meldung sonst, ohne je gestanden zu haben. */
function hinweisLebensdauerBeginnen() {
  const h = S.ui.hinweis;
  if (!h || h.gezeigt) return;
  h.at = Date.now();
  h.gezeigt = true;
}

function render() {
  // Während eines Zuges nicht neu zeichnen — die gezogene Karte würde unter dem Zeiger ersetzt.
  if (typeof zug !== 'undefined' && zug != null) { S.ui.nachZug = true; return; }
  // Während einer getippten Datumseingabe ebenso wenig — das neue Feld begänne wieder beim Tag (R00179).
  if (datumseingabeLaeuft()) { S.ui.nachDatum = true; return; }
  // Ebenso, solange ein Zeiger, der das Datumsfeld verlassen hat, noch gedrückt ist — sein Ziel stünde sonst nicht mehr da (R00191).
  if (zeigerVerlaesstDatumsfeld) { S.ui.nachDatum = true; return; }
  // Ein Feld, das auf „Eingabe verwerfen“ wartet, übersteht das Ersetzen nicht: vorher verlassen, damit sein Entwurf nicht still verloren geht
  verlassenNachholen();
  adresseNachfuehren();
  S.renders = (S.renders || 0) + 1;
  S.ui.nachZug = false;
  S.ui.nachDatum = false;
  hinweisLebensdauerBeginnen();
  S.ui.stufe = stufeAusBreite(innerWidth);
  const aktiv = document.activeElement;
  // Ein Menüeintrag, der das Menü offen lässt (Signale oben, Darstellung), behält den Fokus für die Tastatur.
  const menueEintragImFokus = !S.ui.fokus && aktiv && aktiv.id && aktiv.closest('#pop') && S.ui.pop;
  if (menueEintragImFokus) S.ui.fokus = '#' + CSS.escape(aktiv.id);
  reiterRueckfallImFenster(aktiv);
  commitsAnstossen();
  laeufeAnstossen();
  reviewAnstossen();
  laufAnstossen();
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
  const gezogen = bereiche.flatMap(bereich => gezogeneHoehen(bereich, 'textarea.besch'));
  // Karten und Zeilen führt die Tastatur über fokusKarte und fokusZeile — dort ist das Ziel ausdrücklich
  const zielGefuehrt = Boolean(aktiv && aktiv.matches && aktiv.matches('.ka[data-id], tr[data-zeile]'));
  const fokus = zielGefuehrt ? null : fokusstand(aktiv, bereiche);
  // Ein Element mit inhaltsbezogenem data-halt hält nie über die Stelle: ist sein Inhalt mehrdeutig (derselbe Text
  // zweimal) oder verschwindet er unter dem Menschen (fremder Textwechsel), hält der Sicherer nichts, und der Fokus
  // fällt auf den Ort seines Abschnitts (#teil-neu, #herkunft-neu) — nie auf ein fremdes ✕ oder eine
  // fremde Zeile und nicht eigens ins Fenster (R00138, R00134, ADR-0007 N3 Regel 4, ADR-0010 N7).
  let ortDesFokus = null;
  if (!S.ui.fokus && aktiv && aktiv.dataset && aktiv.dataset.ort) ortDesFokus = aktiv.dataset.ort;
  // Vor dem Ersetzen merken, solange der Auslöser noch im Dokument hängt
  const ausloeser = ausloeserSelektor(aktiv);
  const aktivWarSichtbar = imSichtbereich(aktiv);
  const meldungVorher = $('#over').dataset.offen === String(S.ui.offen || '') ? document.getElementById(FENSTER_MELDUNG) : null;
  const tagVorher = document.getElementById(PERSONEN_TAG);
  const commitsStatusVorher = $('#over').dataset.offen === String(S.ui.offen || '') ? document.getElementById(COMMITS_STATUS) : null;
  const laeufeKnotenVorher = $('#over').dataset.offen === String(S.ui.offen || '') ? LAEUFE_KNOTEN.map(id => document.getElementById(id)).filter(Boolean) : [];
  // die Live-Region am Kandidaten, der gerade schreibt (R00218 AK 10): sie steht vor dem Satz im Dokument und bleibt derselbe Knoten
  const nfMeldungVorher = $('#over').dataset.offen === String(S.ui.offen || '') ? document.getElementById('nf-meld') : null;
  // je Zeile des Schalters bleibt der Statusbereich derselbe Knoten: angesagt wird nur ein neuer Satz (R00220 AK 10)
  const schalterStatusVorher = $('#main').dataset.sicht === sicht ? [...document.querySelectorAll('#transkripte [role="status"][id]')] : [];
  const personenwahlVorher = document.getElementById(PERSONENWAHL);
  const inselAlt = document.getElementById('rv-insel');
  inselGehalten = inselAlt && inselAlt.dataset.insel === reviewInselSchluessel() ? inselAlt : null;
  laufInselGehalten = laufInselVorher();
  const laufKnotenVorher = S.ui.view === 'lauf' ? LAUF_KNOTEN.map(id => document.getElementById(id)).filter(Boolean) : [];
  const reviewPosVorher = document.getElementById('rv-pos');
  const reviewAnsageVorher = document.getElementById('rv-ansage');
  const reviewWahlVorher = document.getElementById('rv-wahl');
  const reviewLaedtVorher = document.getElementById('rv-laedt');
  const reviewGesehenVorher = document.getElementById('rv-gesehen');
  const reviewSpeicherVorher = document.getElementById('rv-gesehen-speicher');
  // Die Auswahl gilt nur auf diesem Board und nur für Karten, die noch darauf liegen (R00065)
  if ($('#main').dataset.sicht !== sicht) auswahlAufheben();
  S.ui.auswahl = S.ui.auswahl.filter(n => S.board && S.board.spalten.some(sp => sp.aufgaben.includes(n)) && aufgabe(n) && !aufgabe(n).archiviert);
  // Beim Ersetzen meldet der Browser für das fokussierte, getippte Feld „change“, solange es noch im Dokument hängt;
  // das ist kein Verlassen und speichert nichts (R00103). Der Wert kommt über den Sicherer zurück.
  S.neuzeichnen = true;
  try {
    $('#kopf').innerHTML = vKopf();
    const gehaltenGeblieben = hauptbereichErsetzen($('#main'), vMain(), personenwahlVorher, inselGehalten || laufInselGehalten);
    laufInselNachher(laufInselGehalten, gehaltenGeblieben);
    laeufeKnotenBehalten(laufKnotenVorher);
    $('#main').dataset.sicht = sicht;
    const laeufeInsel = laeufeInselVergleichenUndMerken();
    const ueber = (S.ui.neu ? vNeu() : '') + (S.ui.offen && !S.ui.setup ? vFenster(laeufeInsel) : '') + (S.ui.offenDefekt ? vDefektFenster() : '') + vPop() + vAlDialog() + vHinweis() + (S.ui.hilfe ? vHilfe() : '') + (S.ui.zuweisen ? vZuweisen() : '') + vMenue() + vTipp();
    // Steht die Insel der Ansicht „Läufe“, wird `#over` auf demselben Weg wie `#main` abgeglichen: sie bleibt im Dokument (ADR-0039 N1)
    ueberErsetzen(ueber, laeufeInsel);
    $('#over').dataset.offen = String(S.ui.offen || '');
    meldungsknotenBehalten(meldungVorher);
    datumsknotenBehalten(tagVorher);
    commitsStatusBehalten(commitsStatusVorher);
    laeufeKnotenBehalten(laeufeKnotenVorher);
    ansageBehalten(nfMeldungVorher, 'nf-meld');
    laeufeKnotenBehalten(schalterStatusVorher);
    ansageBehalten(reviewPosVorher, 'rv-pos');
    ansageBehalten(reviewAnsageVorher, 'rv-ansage');
    ansageBehalten(reviewWahlVorher, 'rv-wahl');
    // der Ladesatz der Seite ist ein Start-Ereignis: ein Neuzeichnen während des Ladens sagt ihn nicht ein zweites Mal an (R00230 S2)
    ansageBehalten(reviewLaedtVorher, 'rv-laedt');
    gesehenAnsageBehalten(reviewGesehenVorher);
    ansageBehalten(reviewSpeicherVorher, 'rv-gesehen-speicher');
  } finally {
    inselGehalten = null;
    laufInselGehalten = null;
    S.neuzeichnen = false;
  }
  hinweisEinpassen();
  gezogeneHoehenSetzen(gezogen);
  rollstaendeSetzen(rollen);
  reviewLeisteEinpassen();
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
  // Gesperrte Gruppe (R00220 AK 10): Pfeile, Leertaste und Enter ändern weder Wahl noch Fokus und schicken nichts
  if (gruppe.getAttribute('aria-disabled') === 'true') {
    const verbraucht = ereignis.key === ' ' || ereignis.key === 'Enter' || radioSchritt(1, 0, ereignis.key) !== null;
    if (verbraucht) ereignis.preventDefault();
    return verbraucht;
  }
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

/** Enter und Leertaste auf dem fokussierten Bedienelement, das kein nativer Knopf ist, wirken wie der Klick darauf
    (R00180; die Entscheidung rechnet tasteLoestAus in web/tastatur.js). Die Taste ist damit verbraucht — die Seite rollt
    nicht; eine gehaltene Taste löst nur einmal aus. */
function bedienelementTaste(ereignis) {
  const fokussiert = ereignis.target;
  if (!fokussiert.getAttribute) return false;
  const element = { tag: fokussiert.tagName, rolle: fokussiert.getAttribute('role'), aktion: fokussiert.dataset.act };
  const druck = { taste: ereignis.key, strg: ereignis.ctrlKey, alt: ereignis.altKey, meta: ereignis.metaKey };
  if (!tasteLoestAus(element, druck)) return false;
  ereignis.preventDefault();
  if (!ereignis.repeat) fokussiert.click();
  return true;
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
  const ebene = $(oberste.selektor), aktiv = document.activeElement;
  const tabbare = tabbareIn(ebene);
  const index = tabbare.indexOf(aktiv);
  // Fokus in der Ebene auf einem nicht tabbaren Element (tabindex=-1): der Nachbar in Dokumentreihenfolge, nicht Anfang oder Ende (R00218 Nacharbeit 1)
  const zwischen = index < 0 && aktiv && aktiv !== ebene && ebene.contains(aktiv);
  // davor stehen alle tabbaren Elemente, denen der Fokus folgt — auch ein umschließendes (etwa der scrollbare Rahmen der Liste), seine Kinder nicht
  const davor = zwischen ? tabbare.filter(t => t.compareDocumentPosition(aktiv) & Node.DOCUMENT_POSITION_FOLLOWING).length : 0;
  const ziel = zwischen ? fallenSchrittZwischen(tabbare.length, davor, ereignis.shiftKey) : fallenSchritt(tabbare.length, index, ereignis.shiftKey);
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
  const ziele = fokusZiel({ ausdruecklich: S.ui.fokus, gesichert: Boolean(gesichert), gesichertInOberster: true, ort, vorgemerkt: S.ui.fokusVorgemerkt, geschlossen: geschlossen.at(-1) || null, geoeffnet: geoeffnet.at(-1) || null, oberste, fuehrung: fuehrungsziel(), vorher: fokusVorher });
  S.ui.fokus = null;
  S.ui.fokusVorgemerkt = null;
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
  const seite = { ansicht: S.ui.view, boardTitel: boardTitelDerSeite(), review: reviewTitel() };
  return fenstertitelName(seite, { zaehler: alleLaufenden().length });
}

/** Nummer und Kurzform des gezeigten Commits für den Fenstertitel der Review-Seite (R00207 FA 5). */
function reviewTitel() {
  const r = S.ui.review;
  if (S.ui.view !== 'review' || !r) return null;
  if (r.ansicht === 'alle') return { nummer: r.nr, kurz: 'Alle Änderungen' };
  const c = r.diff && r.diff.status === 'da' && r.diff.antwort.commits[0];
  const kurz = c ? (r.diff.antwort.anwendung ? `${r.diff.antwort.anwendung}:` : '') + c.hash.slice(0, 7) : kurzVerweis(r.commit || '');
  return { nummer: r.nr, kurz };
}

/** Selektor des Stifts einer Teilaufgabe im Aufgabenfenster — nach dem Bearbeiten kehrt der Fokus dorthin zurück (R00177). */
function stiftDerTeilaufgabe(index) {
  return `[role=dialog] .teil-stift[data-arg="${index}"]`;
}

/** Der Stift (✎) der Zeit mit dieser Kennung — der Auslöser der Zeitkorrektur, an den Esc den Fokus zurückgibt (R00181). */
function stiftDerZeit(kennung) {
  return '[role=dialog] ' + knopfSelektor('zeit-edit', kennung);
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
function ausloeserGesperrt(a, arg, el, wert, laufende = sperre) {
  const aktionOhneWert = aktionsName(a, arg);
  if (wert !== undefined) return laufende.laeuft(aktionOhneWert) || laufende.laeuft(aktionsName(a, arg, wert));
  return laufende.laeuftAktion(aktionOhneWert) || (el != null && laufende.laeuft(ausloeserVon(el)));
}

/** Ab wann ein gesperrter Auslöser seine Sperrform zeigt (R00190): eine schnellere Antwort lässt ihn in Ruheform. */
const SPERRFORM_AB_MS = 200;

/** Zeigt den Sperrzustand am Knoten (ADR-0025 Regel 2): höchstens `aria-disabled="true"`, nie natives `disabled` —
    das nähme den Knoten aus der Tabreihenfolge und der Fokus fiele auf BODY (ADR-0010). Kein Neuzeichnen: ein Zeichnen
    hier verbrauchte das Fokusziel der Aktion (R00112 FA 8). Die Sperre und `aria-disabled` stehen sofort; die sichtbare
    Form hängt an `data-sperrform` und kommt erst nach `SPERRFORM_AB_MS` (R00190) — am Knoten, nicht im Stil, damit sie
    ein Neuzeichnen übersteht. */
function sperrenMarkieren() {
  for (const el of document.querySelectorAll('[data-act][aria-disabled]')) el.removeAttribute('aria-disabled');
  for (const el of document.querySelectorAll('[data-act][data-sperrform]')) el.removeAttribute('data-sperrform');
  if (!sperre.namen().length) return;
  const gedaempft = sperre.gedaempft();
  for (const el of document.querySelectorAll('[data-act]')) {
    if (!ausloeserGesperrt(el.dataset.act, el.dataset.arg, el)) continue;
    el.setAttribute('aria-disabled', 'true');
    if (ausloeserGesperrt(el.dataset.act, el.dataset.arg, el, undefined, gedaempft)) el.setAttribute('data-sperrform', '');
  }
}

/** Läuft der Auslöser nach der Frist noch, zeigt er seine Sperrform; ist er schon frei, bleibt alles in Ruhe (R00190). */
function sperrformNachFrist(laufender) {
  setTimeout(() => {
    if (laufender.frei) return;
    laufender.namen.forEach(sperre.daempfen);
    sperrenMarkieren();
  }, SPERRFORM_AB_MS);
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
  sperrformNachFrist(laufender);
  const entwurfVorher = einrFingerabdruck();
  try {
    await aktion(a, arg, wert);
  } finally {
    // eine Aktion, die den Entwurf ändert, und jedes beendete „Speichern“ fragen die Vorschau sofort (N1.2 Punkt 1)
    if (S.ui.einr && (a === 'einr-ok' || einrFingerabdruck() !== entwurfVorher)) einrVorschau.anstossen(true);
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
            if (!u.offen) { u.fehler = f.message; return GESCHEITERT; }
            fensterMelden(f.message, null, 'bewegen');
            return GESCHEITERT;
          }
          if (u.offen && u.fensterFehler) meldungNachErfolgRaeumen(null, 'bewegen');
          if (r.bewegt && vorher && !bw.rueckgaengig) u.hinweis = { text: `#${bw.nummer} nach „${bw.spalte}“`, undo: { art: 'bewegen', nummer: bw.nummer, ...vorher }, at: Date.now() };
          if (bw.rueckgaengig) u.hinweis = { text: `#${bw.nummer} zurück nach „${bw.spalte}“`, at: Date.now() };
          // Warnung der WIP-Grenze: der Zug ist ausgeführt, die Warnung bleibt länger stehen
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
      case 'defekt-oeffnen': u.pop = null; u.linkZiel = null; u.offenDefekt = +arg; await defektLaden(); break;
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
      case 'ts-wahl': {
        // R00220 FA 8: gesperrte Gruppe und gleiche Wahl schicken nichts (AK 6); ohne gewählte Person „Ich bin …“
        const trenner = arg.indexOf(':'), wahl = arg.slice(0, trenner), schluessel = arg.slice(trenner + 1);
        const slug = schluessel === '' ? null : schluessel;
        if (((u.ts || {})[schluessel] || {}).laeuft) break;
        if (wahl === schalterWahl(slug, schalterGespeichert(slug))) break;
        if (!S.ich) { ichNoetig(); break; }
        schalterUmstellen(slug, wahl);
        break;
      }
      case 'transkripte-einrichten': {
        // Verweis aus „Läufe“ (R00220 FA 10, AK 9): „Einrichten“ öffnet am Abschnitt TRANSKRIPTE, der Fokus steht auf dessen
        // Überschrift — gesetzt erst, wenn die Ansicht steht (sichtFolgen), damit das schließende Fenster ihn nicht zurücknimmt
        u.zuTranskripten = true;
        if (location.hash === '#/einrichten') { u.zuTranskripten = false; u.fokus = '#transkripte-kopf'; break; }
        location.hash = '#/einrichten';
        return;
      }
      case 'ts-erneut': {
        // „Erneut versuchen“ nur ohne Verbindung (Wortlaut 24): dasselbe PUT noch einmal
        const zustand = (u.ts || {})[arg] || {};
        if (zustand.laeuft || !zustand.satz || !zustand.satz.erneut) break;
        schalterUmstellen(arg === '' ? null : arg, zustand.satz.erneut);
        break;
      }
      case 'laeufe-lesen': {
        // „Neu lesen“ und „Erneut versuchen“ (R00219 FA 7/8): beim Lesen ohne Wirkung, sonst genau ein weiteres Lesen; der Fokus bleibt
        if (!u.laeufe || u.laeufe.laedt) break;
        laeufeLesen(u.offen);
        break;
      }
      case 'commits-lesen': {
        // „Neu lesen“ und „Erneut versuchen“ (R00205 FA 2): beim Lesen ohne Wirkung, sonst genau ein weiterer Aufruf
        if (!u.commits || u.commits.status === 'laedt') break;
        u.fokus = '#commits-neu';
        commitsLesen(u.offen);
        break;
      }
      case 'review-oeffnen': reviewOeffnen(arg); return;
      case 'lauf-oeffnen': laufOeffnen(arg); return;
      case 'lauf-zurueck': laufZurueck(); return;
      case 'lauf-blaettern': laufBlaettern(arg); return;
      case 'lauf-springe': {
        // der Fokus geht über die Rangfolge des Neuzeichnens (S.ui.fokus); gerollt wird danach, an die Zeile unter dem Seitenkopf
        const zeile = document.getElementById(arg);
        if (!zeile) return;
        // verbirgt ein Filter die Zeile, schaltet der Sprung ihn um — ohne Ansage (R00239 FA 9)
        if (u.lauf) u.lauf.filter = laufSprungFilter(u.lauf.filter, zeile.dataset.art || 'n', zeile.hasAttribute('data-fehler'));
        u.fokus = '#' + CSS.escape(arg);
        render();
        laufZeileZeigen(arg);
        return;
      }
      case 'lauf-filter': {
        // ein Kästchen von „Zeigen“ (R00239 FA 5, FA 6): neuer Stand, eine Ansage aus der Auswertung; die Insel bleibt, gerechnet wird nichts
        const v = u.lauf;
        if (!v || !v.ergebnis || v.ergebnis.art !== 'eintraege') return;
        v.filter = { ...v.filter, [arg]: !v.filter[arg] };
        v.ansage = laufFilterAnsage(v.ergebnis.auswertung.zeilenArten, v.filter, arg, v.ergebnis.auswertung.eingebettet);
        // jeder Wechsel sagt an, auch bei gleichem Satz: der Statusbereich wird vor der Ansage geleert (PO Z. 616, Vorbild fensterMelden R00189);
        // das Leeren ist keine Ansage, eine Zeitschwelle gibt es nicht
        const status = document.getElementById('lv-status');
        if (status) status.textContent = '';
        u.fokus = '#lv-f-' + arg;
        render();
        return;
      }
      case 'lauf-erneut': {
        // „Erneut versuchen“ (FA 8): derselbe Knoten, gesperrt bis zum Ergebnis; ein Klick in dieser Zeit liest nicht noch einmal
        const v = u.lauf;
        if (!v || v.laedt) break;
        v.erneut = true;
        laufLesen(v);
        break;
      }
      case 'review-zurueck':
      case 'review-liste': reviewZurueck(); return;
      case 'review-weg': {
        const r = u.review;
        if (r) location.hash = adresseBilden({ sicht: r.basis, slug: r.slug, nummer: null });
        return;
      }
      case 'review-blaettern': {
        const r = u.review, b = r && reviewBild(r);
        const ziel = b && b.art === 'diff' && b.folge && b.folge.art === 'folge' && b.folge[arg];
        if (!ziel) break;
        reviewKlappenMerken(r);
        r.richtung = arg;
        reviewAdresseErsetzen(r, ziel);
        break;
      }
      case 'review-erster': {
        const r = u.review, b = r && reviewBild(r);
        if (!b || !b.folge || !b.folge.erster) break;
        reviewKlappenMerken(r);
        r.richtung = 'vor';
        reviewAdresseErsetzen(r, b.folge.erster);
        break;
      }
      case 'review-commit':
      case 'review-leiste':
      case 'review-alle-zeigen': {
        // Leiste, Commit-Liste, Schrittköpfe, „einzeln ansehen“ (R00210 FA 2, R00245 FA 6): ersetzt den Verlaufseintrag, die Marke
        // bleibt; nach der Wahl in der Leiste steht der Fokus auf dem gewählten Eintrag der neuen Leiste, und die Wahl eines Commits
        // sagt „Commit <i> von <n>: <kurz>“ an
        const r = u.review;
        if (!r) break;
        reviewKlappenMerken(r);
        reviewAlleKlappenMerken(r);
        if (a === 'review-alle-zeigen') r.fokusZiel = u.fokus = '#rv-u-alle';
        if (a === 'review-leiste') {
          const wahl = reviewLeistenWahl(r, arg);
          if (wahl) { r.fokusZiel = u.fokus = wahl.fokus; r.wahlNaechste = wahl.ansage; }
        }
        reviewAdresseErsetzen(r, a === 'review-alle-zeigen' ? null : arg);
        break;
      }
      case 'review-zweige': {
        // „+<k> Zweige“ (R00245 FA 9): öffnet und schließt die Liste aller Namen, der Fokus bleibt auf dem Knopf
        const r = u.review;
        if (!r) break;
        r.zweigeOffen = !r.zweigeOffen;
        u.fokus = '#rv-zw-mehr';
        break;
      }
      case 'review-zum-code': {
        // „Zum Code“ (R00245 FA 14): der Fokus geht auf den Anfang der Dateien, nicht auf den Kopf
        const erstes = [...document.querySelectorAll('#rv-insel :is(a[href], button, [tabindex="0"])')].find(e => e.id && e.getClientRects().length);
        if (erstes) u.fokus = '#' + CSS.escape(erstes.id);
        break;
      }
      case 'review-abschnitt-erneut': {
        const r = u.review;
        if (r && r.ansicht === 'alle') reviewAbschnittErneut(r, +arg);
        break;
      }
      case 'review-erneut': {
        const r = u.review;
        if (!r) break;
        r.fokusOffen = true;
        if (arg === 'diff' && r.ansicht === 'alle' && r.alle && r.alle.erste.status === 'fehler') { reviewAlleLesen(r); break; }
        if (arg === 'alle' && r.ansicht === 'alle') { reviewListeLesen(r); reviewAlleLesen(r); break; }
        if (arg === 'liste' && (!r.liste || r.liste.status !== 'laedt')) reviewListeLesen(r);
        if (arg === 'diff' && r.commit && (!r.diff || r.diff.status !== 'laedt')) reviewDiffWiederholen(r);
        break;
      }
      case 'review-gesehen': {
        const r = u.review, ort = reviewGesehenOrt(r, arg);
        if (!ort) break;
        reviewGesehenSchalten(r, ort);
        reviewGesehenNachziehen(r, ort);
        u.fokus = '#rv-gs' + ort.id;
        break;
      }
      case 'review-klappe': {
        const r = u.review, ort = reviewOrt(r, arg);
        if (ort) {
          ort.st.offen = !ort.st.offen;
          reviewGesamtDateiNeu(r, ort.a, ort.i);
          u.fokus = `#rv-dk${ort.a}-${ort.i}`;
          break;
        }
        const i = +arg;
        if (!r || !r.staende || !r.staende[i]) break;
        r.staende[i].offen = !r.staende[i].offen;
        reviewDateiNeu(r, i);
        u.fokus = '#rv-dk' + i;
        break;
      }
      case 'review-datei': {
        // Gruppe und Datei auf, auch wenn eins davon zu war (R00235 FA 8); `scroll-margin` am Kopf hält den Fokusring im Blick
        const r = u.review, ort = reviewOrt(r, arg);
        if (ort) {
          const ab = r.alle.abschnitte[ort.a], art = dateiArt(dateiPfad(ab.antwort.dateien[ort.i]));
          if (!ab.gruppen[art]) { reviewGruppeOeffnen(ab.gruppen, art, ab.antwort.dateien, ab.staende, ab.antwort.hinweise); reviewGesamtGruppeNeu(r, ort.a, art); }
          if (!ort.st.offen) { ort.st.offen = true; reviewGesamtDateiNeu(r, ort.a, ort.i); }
          u.fokus = `#rv-dk${ort.a}-${ort.i}`;
          render();
          const kopf = document.getElementById(`rv-dk${ort.a}-${ort.i}`);
          if (kopf) kopf.scrollIntoView({ block: 'start' });
          return;
        }
        const i = +arg;
        if (!r || !r.staende || !r.staende[i]) break;
        const art = dateiArt(dateiPfad(r.dateien[i]));
        if (!r.gruppenOffen[art]) { reviewGruppeOeffnen(r.gruppenOffen, art, r.dateien, r.staende, r.hinweise); reviewGruppeNeu(r, art); }
        if (!r.staende[i].offen) { r.staende[i].offen = true; reviewDateiNeu(r, i); }
        u.fokus = '#rv-dk' + i;
        render();
        const kopf = document.getElementById('rv-dk' + i);
        if (kopf) kopf.scrollIntoView({ block: 'start' });
        return;
      }
      case 'review-gruppe': {
        if (u.review) reviewGruppeSchalten(u.review, arg);
        break;
      }
      case 'review-rail': {
        const r = u.review;
        if (!r) break;
        r.railOffen = !r.railOffen;
        u.fokus = '#rv-auf';
        break;
      }
      case 'review-alle': {
        const r = u.review;
        if (r && r.ansicht === 'alle' && r.alle) {
          const geladen = r.alle.abschnitte.map((ab, a) => [ab, a]).filter(([ab]) => ab.status === 'da');
          const zuklappen = geladen.some(([ab]) => ab.staende.some(st => st.offen));
          // „Alle einklappen“ schließt nur die Dateien, „Alle aufklappen“ auch die Gruppen (R00235 FA 4, PO Z. 550)
          geladen.forEach(([ab, a]) => {
            if (!zuklappen) Object.keys(ab.gruppen).forEach(art => { ab.gruppen[art] = true; });
            ab.staende.forEach((st, i) => {
              const soll = !zuklappen && reviewAufklappbar(ab.antwort.dateien[i], ab.antwort.hinweise);
              if (st.offen === soll) return;
              st.offen = soll;
              reviewGesamtDateiNeu(r, a, i);
            });
            if (!zuklappen) Object.keys(ab.gruppen).forEach(art => reviewGesamtGruppeNeu(r, a, art));
          });
          u.fokus = '#rv-alle';
          break;
        }
        if (!r || !r.staende) break;
        const zuklappen = r.staende.some(st => st.offen);
        if (!zuklappen) Object.keys(r.gruppenOffen).forEach(art => { r.gruppenOffen[art] = true; });
        r.staende.forEach((st, i) => {
          const soll = !zuklappen && reviewAufklappbar(r.dateien[i], r.hinweise);
          if (st.offen === soll) return;
          st.offen = soll;
          reviewDateiNeu(r, i);
        });
        if (!zuklappen) Object.keys(r.gruppenOffen).forEach(art => reviewGruppeNeu(r, art));
        u.fokus = '#rv-alle';
        break;
      }
      case 'review-pfad': {
        const ort = reviewPfadOrt(u.review, arg);
        if (ort) await pfadKopieren(ort);
        return;
      }
      case 'review-nachladen': {
        const r = u.review, ort = reviewOrt(r, arg);
        if (ort) {
          reviewAlleNachladen(r, ort.a, ort.i);
          u.fokus = `#rv-dk${ort.a}-${ort.i}`;
          break;
        }
        const i = +arg;
        if (!r || !r.staende || !r.staende[i]) break;
        reviewNachladen(r, i);
        u.fokus = '#rv-dk' + i;
        break;
      }
      case 'nf-suchen': nachfolgerSuchen(arg); return;
      case 'nf-klappe': {
        const nf = u.commits && u.commits.nf;
        if (!nf) break;
        if (!nf.klappen.delete(+arg)) nf.klappen.add(+arg);
        break;
      }
      case 'nf-ersetzen':
      case 'nf-entfernen': {
        if (ichNoetig()) break;
        await nachfolgerSchreiben(a === 'nf-ersetzen' ? 'ersetzen' : 'entfernen', +arg);
        return;
      }
      case 'commits-klappe': {
        const klappen = u.commits && u.commits.klappen;
        if (!klappen) break;
        if (!klappen.delete(+arg)) klappen.add(+arg);
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
        // Kam die Änderung nicht an, geht der vorschnelle Haken zurück (R00186 149-1): die Karte widerspricht weder der Meldung
        // noch der Datei. Gezeichnet wird mit der Meldung der Schlange; gelingt das Nachladen, zeigt es ohnehin die Datei.
        const hakenZurueck = fehler => {
          const teilaufgabe = aufgabe(nr) && aufgabe(nr).teilaufgaben[i];
          if (teilaufgabe) teilaufgabe.erledigt = false;
          throw fehler;
        };
        warteschlange(() => api('PATCH', `/api/aufgaben/${nr}/teilaufgaben/${i}`, { erledigt: true }).catch(hakenZurueck));
        return;
      }
      case 'teil': {
        if (ichNoetig()) break;
        const t = aufgabe(u.offen).teilaufgaben[+arg];
        await schreiben('PATCH', `/api/aufgaben/${u.offen}/teilaufgaben/${arg}`, { erledigt: !t.erledigt });
        return;
      }
      case 'teil-stift':
      case 'teil-bearbeiten': if (ichNoetig()) break; u.teilEdit = { nr: u.offen, i: +arg }; u.fokus = '#teil-edit'; break;
      case 'teil-text': {
        const e = u.teilEdit, text = (wert || '').trim();
        u.teilEdit = null;
        // Mit Enter gespeichert: zurück auf den Stift; beim Verlassen per Klick bleibt der Fokus, wo er hingeht
        if (e && document.activeElement === $('#teil-edit')) u.fokus = stiftDerTeilaufgabe(e.i);
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
        const entfernt = await schreiben('DELETE', `/api/aufgaben/${u.offen}/teilaufgaben/${arg}`);
        if (entfernt) u.hinweis = { text: `Teilaufgabe „${t.text}“ entfernt`, undo, feld: '#teil-neu', at: Date.now() };
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
        const archiviert = await schreiben('POST', `/api/aufgaben/${arg}/archivieren`);
        if (archiviert) { if (!imArchiv() && !ausKopfMenue) u.offen = null; u.hinweis = { text: `#${arg} archiviert · archived: in der Datei, laufende Timer gestoppt`, undo: { art: 'zurueckholen', nummern: [+arg] }, at: Date.now() }; }
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
        if (z.art === 'herkunft') {
          await herkunftZuruecklegen(z);
          break;
        }
        if (z.art === 'teilaufgabe') {
          // Der Server legt sie an `position`, hinter dem Ende ans Ende; ist die Aufgabe fort, lehnt er ab (R00185 108-1)
          const a = aufgabe(z.nummer);
          let stelle = 0;
          if (a) stelle = Math.min(z.position, a.teilaufgaben.length);
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
        const zurueckgeholt = await schreiben('POST', `/api/aufgaben/${arg}/zurueckholen`);
        if (zurueckgeholt) u.hinweis = { text: `#${arg} zurückgeholt`, at: Date.now() };
        break;
      }
      case 'p-bereich': u.pBereich = arg; break;
      case 'sp': u.sp = arg; break;
      case 'dus-einheit': u.dusEinheit = arg; break;
      case 'dl-vorgabe': durchlaufAmGeraetMerken({}); u.fokus = 'select[data-dl="dlBis"]'; break;
      case 'woche': u.wochenVersatz = (u.wochenVersatz || 0) + +arg; break;
      case 'p-tag':
        u.personenTag = personenTagBlaettern(u.personenTag, +arg, Date.now());
        // an heute sind „›“ und „Heute“ deaktiviert und verlören den Fokus an body (R00199 AK 6a)
        if (!u.personenTag) u.fokus = '#tag-zurueck';
        break;
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
      case 'fb-selbst': {
        if (ichNoetig()) break;
        return fieberEinstellen(stand => ({ ...stand, gelb: [...stand.gelb], rot: [...stand.rot], selbstlabels: umschalten(stand.selbstlabels || [], arg) }));
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
      case 'kost-bereich-leeren': u.fokus = '#kost-bereich [data-bf="zeitraum"]'; await berichtsfilterSetzen({ zeitraum: 'alles', von: '', bis: '', kostenVonSpalte: '', kostenBisSpalte: '' }); break; // der Knopf verschwindet mit dem Bereich: Fokus auf das Feld „Zeitraum“
      case 'bf-leeren': u.fokus = '.bf-zusammen'; await berichtsfilterSetzen(filterZuruecksetzen(u.bf, BERICHTSLEISTEN[arg])); break; // der Knopf verschwindet mit dem Filter: Fokus auf die Zusammenfassung (ADR-0010)
      case 'still-auch': u.stillAuch = !u.stillAuch; break;
      case 'bestand-tauschen': return bestandAchsenSetzen('tauschen');
      case 'bestand-zelle': filterSetzen(arg); u.bereich = 'alle'; location.hash = '#/board/' + (u.slug || ''); return;
      case 'person-filter': filterSetzen('@' + arg); u.bereich = 'alle'; location.hash = '#/board/' + (u.slug || ''); return;
      case 'list-bereich': u.listBereich = arg; merken('kanbanD.listBereich', arg); break;
      case 'legen-pop': u.legenNr = +arg; u.pop = u.pop === 'legen' ? null : 'legen'; break;
      case 'liste-ablegen': {
        if (ichNoetig()) break;
        const [nr, slug, spalte] = arg.split('|');
        u.fokusZeile = +nr;
        if (slug === 'archiv') return act('archivieren', nr);
        const b = (S.boards || []).find(x => x.slug === slug);
        const liegt = b && b.spalten.some(sp => sp.aufgaben.includes(+nr));
        let gelegt;
        if (liegt) {
          const index = b.spalten.find(sp => sp.name === spalte).aufgaben.filter(n => n !== +nr).length;
          gelegt = await schreiben('POST', `/api/boards/${encodeURIComponent(slug)}/bewegen`, { nummer: +nr, spalte, index });
        } else {
          gelegt = await schreiben('POST', `/api/boards/${encodeURIComponent(slug)}/aufgaben`, { nummer: +nr, spalte });
        }
        if (gelegt) u.hinweis = { text: `#${nr} nach ${b ? b.titel : slug} · ${spalte}`, at: Date.now() };
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
        const genommen = await schreiben('DELETE', `/api/boards/${encodeURIComponent(slug)}/aufgaben/${nr}`);
        if (genommen && platz) u.hinweis = { text: `#${nr} von „${platz.titel}“ genommen`, undo: platz, at: Date.now() };
        break;
      }
      case 'anhang-weg': {
        if (ichNoetig()) break;
        // Erst lesen, dann löschen (ADR-0017 Regel 3): ohne gelesenen Inhalt gibt es kein Rückgängig, also auch kein Löschen
        const nummer = u.offen, pfad = `/api/aufgaben/${nummer}/anhaenge/${encodeURIComponent(arg)}`;
        // Während des Lesens trägt das ✕ die Sperrform wie jeder Auslöser (`act`) und behält den Fokus — kein Zeichnen hier,
        // es verbrauchte das Fokusziel (R00190 AK 3, R00112 FA 8)
        let blob;
        try { blob = await anhangLesen(pfad); } catch (f) { fensterMelden(`Anhang „${arg}“ nicht entfernt: ${f.message}`, null, anfrageName('DELETE', pfad)); u.fokus = knopfSelektor('anhang-weg', arg); break; }
        // Ohne Nachbarn bleibt der Fokus beim Fenster: die Dateiwahl ist kein tabbares Feld
        fokusNachEntfernen('anhang-weg', arg, nachbarArgument('#anhaenge', 'anhang-weg', arg), null);
        const entfernt = await schreiben('DELETE', pfad);
        if (entfernt) u.hinweis = { text: `Anhang „${arg}“ entfernt`, undo: { art: 'anhang', nummer, name: arg, blob }, at: Date.now() };
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
        // Gemerkt vor dem Senden aus dem gezeigten Stand (R00185 102-1, ADR-0017 Regel 2): Wert und Stelle, nie die ganze Liste
        const nummer = u.offen, liste = aufgabe(nummer).herkunft, index = Number(arg), wert = liste[index];
        // Die Herkünfte tragen ihre Stelle als Argument: die Nachbarin heißt nach dem Entfernen so wie ihre neue Stelle
        let nachbar = null;
        const stelle = nachbarNachEntfernen(liste.length, index);
        if (stelle >= 0) nachbar = String(stelle);
        fokusNachEntfernen('herkunft-weg', arg, nachbar, '#herkunft-neu');
        const entfernt = await aufgabeAendern(nummer, { herkunft: liste.filter((_, j) => j !== index) });
        if (entfernt) u.hinweis = { text: `Herkunft ${herkunftAnzeige(wert)} entfernt`, undo: { art: 'herkunft', nummer, wert, index }, feld: '#herkunft-neu', at: Date.now() };
        break;
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
        const geloescht = await schreiben('DELETE', `/api/aufgaben/${u.offen}/zeiten/${encodeURIComponent(arg)}`);
        if (geloescht) u.hinweis = { text: `${zeitBeschrieben(undo)} gelöscht`, undo, feld: '#zeit-neu', at: Date.now() };
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
      case 'link-kopieren': {
        const ausKopfMenue = Boolean(u.fensterMenue);
        if (ausKopfMenue) { u.fensterMenue = null; u.fokus = '#fenster [data-act="fenster-menue"][data-arg="aktionen"]'; }
        const kopiert = await linkInDieZwischenablage(linkDerAufgabe(+arg));
        // Verweigert der Browser das Kopieren, trägt die Adresszeile den Link (R00174 AK 7) — dazu muss die Aufgabe offen sein.
        if (!kopiert && u.offen !== +arg) await fensterOeffnen(+arg);
        hinweisZeigen(linkRueckmeldung({ kopiert, hostname: location.hostname }));
        break;
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
      case 'setup': u.pop = null; u.setup = { spalten: S.board.spalten.map((sp, i) => ({ name: sp.name, alt: sp.name, grenze: sp.grenze || '', n: sp.aufgaben.length, notiz: sp.notiz || '', farbe: sp.farbe || '', eigentuemer: sp.eigentuemer || (sp.eigentuemer_unbekannt ? 'roh' : ''), eigentuemerAlt: sp.eigentuemer || (sp.eigentuemer_unbekannt ? 'roh' : ''), roh: sp.eigentuemer_unbekannt || '', datumsTrenner: sp.datums_trenner == null ? i === S.board.spalten.length - 1 : sp.datums_trenner })), anwendungen: S.board.anwendungen == null ? null : [...S.board.anwendungen], klassenWahl: S.board.klassen ? 'eigen' : 'vorgabe', klassen: S.board.klassen ? kopie(S.board.klassen) : null, klassenFehler: null }; u.palFuer = null; break;
      case 'bind': u.setup.anwendungen = bindungUmschalten(u.setup.anwendungen, arg, S.zustand.einstellungen.quellen.anwendungen || []); break;
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
        u.einr.quellen.anwendungen = [...(u.einr.quellen.anwendungen || []), { kuerzel, name, repository: '' }];
        u.fokus = `[data-ef="arepo"][data-i="${u.einr.quellen.anwendungen.length - 1}"]`;
        break;
      }
      case 'a-del': {
        // Der Fokus geht auf die Nachbarzeile (die nachrückende, sonst die vorige), ohne Zeile auf „Neues Anwendungskürzel“ (R00209 AK 10)
        const register = u.einr.quellen.anwendungen;
        register.splice(+arg, 1); entwurfGeaendert();
        const nachbar = Math.min(+arg, register.length - 1);
        if (nachbar >= 0) u.fokus = `[data-act="a-del"][data-arg="${nachbar}"]`;
        else u.fokus = '#nak';
        break;
      }
      case 'klassen-wahl': {
        // „eigene Klassen“ beginnt mit einer Kopie der Vorgabe (R00195 AK 8); der bearbeitete Satz übersteht das Hin- und Herschalten
        if (arg === 'eigen' && !u.setup.klassen) u.setup.klassen = kopie(vorgabeDesOrdners(S.zustand.einstellungen));
        u.setup.klassenWahl = arg; u.setup.klassenFehler = null; u.palFuer = null;
        break;
      }
      case 'k-pal': u.palFuer = u.palFuer === +arg ? null : +arg; break;
      case 'k-farbe': { const [i, f] = arg.split('|'); klassenEntwurf()[+i].farbe = f; break; }
      case 'k-del': {
        // Die gestrichene Klasse bleibt bis zum Speichern als Zeile stehen (R00195 AK 9); der Fokus geht auf „zurücknehmen“.
        klassenEntwurf()[+arg].gestrichen = true; entwurfGeaendert(); u.palFuer = null;
        if (u.setup) u.setup.klassenFehler = null;
        u.fokus = `[data-act="k-zurueck"][data-arg="${+arg}"]`;
        break;
      }
      case 'k-zurueck': delete klassenEntwurf()[+arg].gestrichen; u.fokus = `[data-act="k-del"][data-arg="${+arg}"]`; break;
      case 'k-add': {
        const schluessel = ($('#nck').value || '').trim().toLowerCase(), bezeichnung = (wert || '').trim();
        if (!schluessel || !bezeichnung) { klassenFehlerSetzen('Schlüssel und Bezeichnung nötig'); break; }
        const belegt = klassenEntwurf().map(k => k.farbe);
        klassenEntwurf().push({ schluessel, bezeichnung, farbe: PAL.find(f => !belegt.includes(f)) || 'grey' });
        if (u.setup) u.setup.klassenFehler = null;
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
        const daten = einrichtenRumpf(u.einr);
        const gesendet = einstellungenText(u.einr), standVorher = S.zustand;
        try {
          await durchDieSchlange(() => api('PUT', '/api/einstellungen', daten));
          u.palFuer = null;
          // Wer die Ansicht inzwischen verlassen hat, hat keinen Entwurf mehr; das Speichern ist angekommen (R00215 AK 11)
          if (!u.einr) break;
          // Die Schlange hat schon nachgeladen; der Entwurf bleibt dabei bis hier stehen, damit keine Eingabe ins Leere geht.
          // Wer während des Speicherns weitergetippt hat, behält seine Eingabe, ungespeichert (R00215 AK 8).
          const weitergetippt = einstellungenText(u.einr) !== gesendet;
          if (!weitergetippt) {
            // Ein neues S.zustand heißt: die Schlange hat nachgeladen, der Entwurf entsteht aus dem geladenen Stand.
            // Sonst bleibt der Entwurf, der dem Gesendeten gleicht — ohne die Meldung eines früheren, gescheiterten Versuchs.
            if (S.zustand !== standVorher) u.einr = kopie(S.zustand.einstellungen);
            u.einr.fehler = null;
            u.einr.gespeichert = true;
          }
          render();
          break;
        } catch (f) {
          // Ansicht schon verlassen: die Meldung der Anfrage geht in die Fußzeile wie bei jeder anderen Aktion (R00215 AK 11)
          if (!u.einr) throw f;
          // Der Entwurf bleibt stehen; der Fokus liegt auf der Meldung, nie auf body (R00209 AK 12)
          u.einr.fehler = f.message; u.fokus = '#einr-fehler';
          break;
        }
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
        d.splice(Math.max(0, d.length - 1), 0, { name, alt: null, grenze: '', n: 0, notiz: '', farbe: '', datumsTrenner: false });
        u.fokus = '#col-new';
        break;
      }
      case 'setup-ok': {
        if (ichNoetig()) break;
        return durchDieSchlange(async () => {
          try {
            // Datums-Trenner (R00124): nur senden, wenn mindestens eine Spalte vom Positions-Standard abweicht —
            // ein bloßes Speichern ohne Änderung bleibt byte-gleich (nur Abweichendes, wie column-notes/column-colors)
            const letzteSpalte = u.setup.spalten.length - 1;
            const trennerAbweichend = u.setup.spalten.some((sp, i) => sp.datumsTrenner !== (i === letzteSpalte));
            // Die Klassen gehen zuerst hinaus (R00195 AK 3): ein ungültiger Satz ist gemeldet, bevor die Spalten geschrieben
            // sind; die Meldung des Servers steht unter dem Editor, die Eingaben bleiben stehen.
            const klassen = setupKlassen(u.setup);
            if (JSON.stringify(klassen) !== JSON.stringify(S.board.klassen || null)) {
              try {
                await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/klassen`, { klassen });
              } catch (f) { u.setup.klassenFehler = f.message; return; }
            }
            await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/spalten`, u.setup.spalten.map((sp, i) => ({ name: sp.name.trim(), alt: sp.alt, grenze: +sp.grenze > 0 ? +sp.grenze : null, notiz: sp.notiz, farbe: sp.farbe, ...(trennerAbweichend ? { datums_trenner: sp.datumsTrenner } : {}), ...(eigentuemerGeaendert(sp) ? { eigentuemer: sp.eigentuemer === 'roh' ? null : (sp.eigentuemer || null) } : {}) })));
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
  // Verlassen beendet die getippte Datumseingabe (R00179); solange sie läuft, ersetzt kein Zeichnen das Feld
  if (e.target === datumseingabe) datumseingabeBeenden();
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
  // ein „change“, das hier nachgetragen wird, kommt mit dem Verlassen: ein unfertiges Datum hält es nicht mehr (R00173)
  verlassenesFeld = feld;
  if (!S.neuzeichnen) gehaltenesDatumAbschliessen(feld);
  // Verlassen eines Felds meldet den getippten Wert nach, für den noch kein „change“ gewirkt hat (R00103, R00155 54-13)
  if (!S.neuzeichnen) aenderungNachtragen(feld);
  verlassenesFeld = null;
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

/* Datum tippen (R00173): Ein Datumsfeld meldet beim Tippen jede Ziffer als fertiges Datum — „12112026“ ergibt die Jahre
   0002, 0020, 0202, 2026, über einem gespeicherten Datum zuvor schon Tag und Monat. Speichern und Neuzeichnen mitten im
   Tippen nähmen die Eingabe aus dem Feld: bis das Jahr steht, wird die Änderung gehalten. */
const DATUMSFELD_OHNE_KNOPF = 'input[type="date"][data-bf], input[type="date"][data-fb], input[type="date"][data-af]';
/** Die letzte Taste war eine Ziffer in diesem Datumsfeld: `{ feld, jahrVorDerZiffer }` — das Jahr, das das Feld zuletzt trug
    (ein Zwischenstand ohne Datum lässt es stehen); jede andere Taste und jeder Zeigerdruck beenden das Tippen. */
let datumstippen = null;
/** Das Datumsfeld, dessen gemeldete Änderung gehalten ist. */
let gehaltenesDatumsfeld = null;
/** Das Feld, dessen Verlassen gerade behandelt wird. `document.activeElement` taugt dafür nicht: springt die Eingabe im
    Datumsfeld vom Tag zum Monat, meldet der Browser die Änderung, während kurz kein Element den Fokus trägt. */
let verlassenesFeld = null;
document.addEventListener('keydown', e => {
  const feld = e.target;
  const imDatumsfeld = Boolean(feld.matches) && feld.matches(DATUMSFELD_OHNE_KNOPF);
  const istZiffer = /^\d$/.test(e.key);
  if (imDatumsfeld && istZiffer) { datumstippen = { feld, jahrVorDerZiffer: jahrVorDerNaechstenZiffer(feld) }; return; }
  datumstippen = null;
  // Enter nimmt ein fertiges Datum an, auch wenn nur Tag oder Monat getippt wurde; ein unfertiges bleibt gehalten
  if (imDatumsfeld && e.key === 'Enter' && gehaltenesDatumsfeld === feld && datumFertig(feld.value)) feld.dispatchEvent(new Event('change', { bubbles: true }));
}, true);
document.addEventListener('pointerdown', () => { datumstippen = null; }, true);

/** Das Jahr, das das Feld zuletzt trug: trägt es gerade kein Datum (31.11.), gilt weiter das Jahr von davor. */
function jahrVorDerNaechstenZiffer(feld) {
  const jahr = jahrDesDatums(feld.value);
  const tipptWeiter = datumstippen !== null && datumstippen.feld === feld;
  if (jahr === null && tipptWeiter) return datumstippen.jahrVorDerZiffer;
  return jahr;
}
/** Wahr, wenn die gemeldete Änderung des Datumsfelds jetzt gespeichert wird; sonst ist sie gehalten oder verworfen. */
function datumsaenderungWirkt(feld) {
  const eingabe = { wert: feld.value, verlassen: verlassenesFeld === feld };
  if (datumstippen && datumstippen.feld === feld) eingabe.jahrVorDerZiffer = datumstippen.jahrVorDerZiffer;
  const urteil = datumsaenderung(eingabe);
  if (urteil === 'halten') { gehaltenesDatumsfeld = feld; return false; }
  // gespeichert oder verworfen: die getippte Eingabe ist zu Ende, was jetzt zeichnet, zeichnet (R00179)
  if (datumseingabe === feld) datumseingabeBeenden();
  if (gehaltenesDatumsfeld === feld) gehaltenesDatumsfeld = null;
  if (urteil === 'verwerfen') { feld.value = feld.defaultValue; return false; }
  return true;
}
/** Beim Verlassen: ein gehaltenes fertiges Datum wird gespeichert, ein unfertiges weicht dem gespeicherten Wert. */
function gehaltenesDatumAbschliessen(feld) {
  if (gehaltenesDatumsfeld !== feld) return;
  gehaltenesDatumsfeld = null;
  datumstippen = null;
  if (datumFertig(feld.value)) feld.dispatchEvent(new Event('change', { bubbles: true }));
  else feld.value = feld.defaultValue;
}

/** Ein „change“, das der Browser beim Verlassen eines Textfelds des Aufgabenfensters meldet. Es kommt vor dem „focusout“ und
    weiß nicht, wohin der Fokus geht — auf „Eingabe verwerfen“ darf es nicht speichern (R00155 54-13). */
function meldetBeimVerlassen(ereignis) {
  const feld = ereignis.target;
  const istTextfeld = feld.tagName === 'TEXTAREA' || (feld.tagName === 'INPUT' && feld.type === 'text');
  return ereignis.isTrusted && istTextfeld && Boolean(feld.dataset.af) && Boolean(S.ui.offen) && document.activeElement !== feld;
}
document.addEventListener('change', e => {
  if (S.neuzeichnen) return;
  if (e.target.matches('input[data-umbrechen]')) { reviewUmbrechenSetzen(e.target.checked); return; }
  if (e.target.matches('input[data-nebeneinander]')) { reviewNebeneinanderSetzen(e.target.checked); return; }
  // das „focusout“ gleich danach kennt das Ziel des Fokus und trägt die Änderung nach
  if (meldetBeimVerlassen(e)) { aenderungAufschieben(e.target); return; }
  aenderungGemeldet(e.target);
  if (e.target.matches(DATUMSFELD_OHNE_KNOPF) && !datumsaenderungWirkt(e.target)) return;
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
  if (e.target.id === PERSONENWAHL) { act('sp', e.target.value); return; }
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
    if (bf === 'von' || bf === 'bis') aenderung.zeitraum = 'eigen';
    berichtsfilterSetzen(aenderung);
    render();
    return;
  }
  const nf = e.target.dataset && e.target.dataset.nf;
  if (nf && S.ui.neu && (nf === 'board' || nf === 'spalte' || nf === 'klasse')) {
    S.ui.neu[nf] = e.target.value;
    if (nf === 'board') {
      const b = (S.boards || []).find(x => x.slug === e.target.value);
      S.ui.neu.spalte = b && b.spalten[0] ? b.spalten[0].name : '';
      // Die gewählte Klasse gilt nur, wenn auch das neue Board sie führt (R00195) — sonst wiese der Server das Anlegen ab.
      if (!vorratDerNeuenAufgabe().some(k => k.schluessel === S.ui.neu.klasse)) S.ui.neu.klasse = '';
    }
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
// „Pfad kopiert“ geht beim nächsten Klick, wo er auch hinfällt, und sofort, wenn der Fokus „Pfad“ verlässt (R00236 FA 8); ein
// Knopf, den ein Neuzeichnen aus dem Dokument nimmt, hat ihn nicht verlassen (Chrome meldet dann `focusout`, Firefox nicht)
document.addEventListener('click', () => pfadKopiertWeg(), true);
document.addEventListener('focusout', e => {
  if (pfadKopiert && e.target.id === 'rv-pk' + pfadKopiert.id && e.target.isConnected) pfadKopiertWeg();
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
  // ein gesperrtes Kästchen von „Zeigen“ (R00239 FA 5, PO Z. 588): Klick und Leertaste ändern weder Haken noch Liste
  if (e.target.closest('#lauf input[data-filter][aria-disabled="true"]')) { e.preventDefault(); return; }
  // eine Nummer der neuen Seite springt nach VS Code an ihre Zeile; der Codetext daneben nie (R00236 FA 7)
  const sprungNummer = e.target.closest('td.ru-nk');
  if (sprungNummer) { vscodeFolgen(`${sprungNummer.closest('.df-sc').dataset.vsc}:${sprungNummer.textContent}`, sprungNummer); return; }
  // Ein Link im Text einer Teilaufgabe folgt dem Link: der Klick bearbeitet die Zeile nicht (R00177 AK 3)
  if (e.target.closest('.teil-text a')) return;
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
  // Eine Wahl des Schalters „Transkripte erfassen“ (R00220): ohne data-act, damit die allgemeine Sperre ihr aria-disabled nicht
  // anfasst — gesperrt ist die ganze Gruppe bis zur Antwort, nicht nur der gedrückte Knopf
  const schalterKnopf = e.target.closest('[data-ts-wahl]');
  if (schalterKnopf) { act('ts-wahl', schalterKnopf.dataset.tsWahl, undefined, null, e.detail); return; }
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
  // Ein Review-Verweis mit Umschalt-, Strg- oder Meta-Taste bleibt ein Link (neuer Tab, neues Fenster; ADR-0033 Punkt 2)
  // Der gezeigte Eintrag der Leiste führt auf die eigene Adresse: sein Klick bewirkt nichts, auch keine Zeichnung (R00245 FA 6)
  if (el.tagName === 'A' && el.closest('#rv-ls') && el.getAttribute('aria-current') === 'page' && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)) { e.preventDefault(); return; }
  if (el.tagName === 'A' && ['review-oeffnen', 'review-commit', 'review-leiste', 'review-alle-zeigen', 'lauf-oeffnen', 'lauf-zurueck', 'lauf-blaettern'].includes(el.dataset.act) && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)) return;
  if (el.tagName === 'A') e.preventDefault();
  act(el.dataset.act, el.dataset.arg, undefined, el, e.detail);
});
document.addEventListener('input', e => {
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
  if ((ef === 'klabel' || ef === 'khex') && S.ui.setup) {
    const k = S.ui.setup.klassen[+e.target.dataset.i], v = e.target.value;
    if (ef === 'klabel') k.bezeichnung = v;
    if (ef === 'khex' && /^#[0-9a-f]{6}$/i.test(v.trim())) k.farbe = v.trim().toLowerCase();
    if (S.ui.setup.klassenFehler) { S.ui.setup.klassenFehler = null; const meldung = $('#klassen-dieses-boards [role="alert"]'); if (meldung) meldung.remove(); }
    $('#setup-vorschau').textContent = setupText(S.ui.setup);
    return;
  }
  if (ef && S.ui.einr) {
    const d = S.ui.einr, i = +e.target.dataset.i, v = e.target.value;
    if (ef === 'pname') d.personen[i].name = v;
    if (ef === 'klabel') d.klassen[i].bezeichnung = v;
    if (ef === 'slabel') d.signale[i].bezeichnung = v;
    if (ef === 'shex' && /^#[0-9a-f]{6}$/i.test(v.trim())) d.signale[i].farbe = v.trim().toLowerCase();
    if (ef === 'khex' && /^#[0-9a-f]{6}$/i.test(v.trim())) d.klassen[i].farbe = v.trim().toLowerCase();
    if (ef === 'repo') d.quellen.repository = v;
    if (ef === 'aname') d.quellen.anwendungen[i].name = v;
    if (ef === 'arepo') d.quellen.anwendungen[i].repository = v;
    d.fehler = null;
    // „gespeichert“ gilt nur bis zur nächsten Eingabe (R00215 AK 8) — ohne Neuzeichnen, der Fokus bleibt im Feld
    if (d.gespeichert) { d.gespeichert = false; const marke = $('#einr-gespeichert'); if (marke) marke.remove(); }
    if (['repo', 'arepo'].includes(ef)) e.target.title = v;
    if (ef === 'repo') repositoryZustandZeigen($('#quellen-repo'), v, S.quellenStand || undefined);
    if (ef === 'arepo') repositoryZustandZeigen($(`#anw-repo-${i}`), v, gespeichertesRepository(d.quellen.anwendungen[i].kuerzel));
    einrVorschau.anstossen(false);
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
/** Zurück, Vor, ein Link oder eine getippte Adresse (ADR-0029 Regel 2): das Fenster folgt der Adresse sofort — was der Mensch
    danach öffnet, gilt —, die Ansicht folgt mit dem Laden. */
function adresseGewechselt() {
  if (rueckwegUnterwegs && rueckwegAngekommen()) return;
  // die neue Ansicht wartet nicht auf ein Datumsfeld der alten (R00179)
  datumseingabeBeenden();
  const eingerichtet = Boolean(S.zustand) && Boolean(S.zustand.eingerichtet);
  if (eingerichtet && location.hash !== adresseGefolgt) { fensterDerAdresseFolgen(location.hash); render(); }
  laden();
}
window.addEventListener('hashchange', adresseGewechselt);

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
  // Die Blätterknöpfe der Review-Seite wechseln bei 640 px zwischen Text und Symbol samt Namen (R00207 FA 3)
  const reviewGewechselt = S.ui.view === 'review' && Boolean(document.querySelector('#review .bl-k .t')) === reviewSchmal();
  // „Zeigen“ wechselt bei 641 px den Platz im Seitenfeld, im Dokument und damit in der Tab-Reihenfolge (R00243 FA 4)
  const laufGewechselt = S.ui.view === 'lauf' && laufFeldZuerst() !== laufSeitenfeldBreit();
  if (stufeGewechselt || reviewGewechselt || laufGewechselt) render();
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
  // Titel, Berichtszeile, Kästchen und Farbwähler sind keine nativen Knöpfe: Enter und Leertaste lösen sie aus (R00116, R00180)
  if (bedienelementTaste(e)) return;
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
  if (e.key === 'Escape' && pfadFeld && t.classList && t.classList.contains('ru-pfin')) { e.preventDefault(); pfadFeldSchliessen(); return; }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !S.ui.offen && $('#flt')) {
    e.preventDefault();
    $('#flt').focus();
    return;
  }
  if (e.key === 'Escape') {
    if (S.ui.pop) { S.ui.fokus = ausloeserDesMenues(); S.ui.pop = null; S.ui.ichNoetig = false; render(); return; }
    if (S.ui.umbenennen) { const n = S.ui.umbenennen; S.ui.umbenennen = null; S.ui.fokusKarte = n; render(); return; }
    if (S.ui.teilEdit) { S.ui.fokus = stiftDerTeilaufgabe(S.ui.teilEdit.i); S.ui.teilEdit = null; render(); return; }
    // die Zeitkorrektur ist ein Bearbeitungsmodus: Esc beendet nur sie, ohne Schreibweg — ihre Felder schreiben allein über `zeit-ok` (R00181)
    if (S.ui.zeitEdit) { S.ui.fokus = stiftDerZeit(S.ui.zeitEdit); S.ui.zeitEdit = null; render(); return; }
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
  const eintraege = kartenMenue(a, { spalten: S.board.spalten.map(sp => sp.name), spalte: spalte && spalte.name, klassen: vorrat(), boards, ich: S.ich, meinerLaeuft: laufende(a).some(z => z.wer === S.ich), meine: a.zustaendige.includes(S.ich) });
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
  if (g.ziel) { e.preventDefault(); location.hash = g.ziel === '#/board/' ? '#/board/' + (u.slug || '') : g.ziel; return true; }
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
  /** Titel einer Aufgabe im geladenen Stand — auch wenn er noch nicht gezeichnet ist (R00179). */
  titel: nr => aufgabe(nr).titel,
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

/** Setzt das Wort einer in Worten gezeigten Dauer. Der Name der Karte nennt dieselbe Dauer („Timer läuft seit 10 Stunden“)
    und folgt im selben Takt, ohne Neuzeichnen (R00185 114-1; R00114 US-2: der Tageswechsel zeichnet nicht). */
function seitWortSetzen(el, wort) {
  const alt = el.textContent;
  if (alt === wort) return;
  el.textContent = wort;
  const karte = el.closest('.ka[aria-label]');
  if (karte) karte.setAttribute('aria-label', karte.getAttribute('aria-label').replace(`Timer läuft ${alt}`, `Timer läuft ${wort}`));
}

/** Tag des letzten Takts, an dem gezeichnet werden konnte: wechselt er, zeigt die Personenseite an „heute“ den neuen Tag (R00199 AK 12). */
let taktTag = tagesbeginn(Date.now());
/** Wahr, wenn seit dem letzten Takt Mitternacht war und die Personenseite „heute“ zeigt; ein fester Tag bleibt stehen. */
function personenTagGewechselt(jetzt) {
  const tag = tagesbeginn(jetzt);
  if (tag === taktTag) return false;
  taktTag = tag;
  return S.ui.view === 'personen' && !S.ui.personenTag;
}

setInterval(() => {
  const jetzt = Date.now();
  let neu = false;
  const zeichnenMoeglich = zug == null && !S.ui.neu;
  for (const [n, x] of Object.entries(S.extern)) if (jetzt - x.at >= 10000) { delete S.extern[n]; neu = true; }
  // ein Hinweis, der noch nie gezeichnet wurde, verfällt nicht (R00186): seine Lebensdauer beginnt erst mit dem Zeigen
  if (S.ui.hinweis && S.ui.hinweis.gezeigt && jetzt - S.ui.hinweis.at > (S.ui.hinweis.dauer || 8000)) { S.ui.hinweis = null; neu = true; }
  // Ein Fehlschlag, der hinter einem Rückgängig-Hinweis gewartet hat, erscheint nach dessen Ablauf (R00147 AK 9)
  if (!S.ui.hinweis && S.ui.hinweisWarten) { S.ui.hinweis = S.ui.hinweisWarten; S.ui.hinweisWarten = null; neu = true; }
  taktVergessen(jetzt);
  // das Zeichnen unterbleibt hinter einem Zug oder „Neue Aufgabe“ und wird beim nächsten Takt nachgeholt (FA 22)
  if (S.ui.vergessenOffen && zeichnenMoeglich) { S.ui.vergessenOffen = false; neu = true; }
  // die Erinnerung entsteht erst, wenn sie auch gezeichnet wird: sonst verfällt sie in ihrer Lebensdauer, ohne je zu stehen (B1)
  if (zeichnenMoeglich && erinnerungPruefen(jetzt)) neu = true;
  if (zeichnenMoeglich && personenTagGewechselt(jetzt)) neu = true;
  document.querySelectorAll('[data-summe-basis]').forEach(el => { const seit = el.dataset.summeSeit ? el.dataset.summeSeit.split(',').map(Number) : []; el.textContent = 'Σ ' + hm(+el.dataset.summeBasis + seit.reduce((s, t) => s + Math.max(0, jetzt - t), 0)); });
  document.querySelectorAll('[data-since]').forEach(el => {
    const d = jetzt - +el.dataset.since;
    if (el.dataset.fmt === 'seit') seitWortSetzen(el, seitText(d));
    else if (el.dataset.fmt === 's') el.textContent = hms(d);
    else el.textContent = hm(d);
  });
  document.querySelectorAll('[data-ext]').forEach(el => { el.textContent = `extern · ${el.dataset.datei} · vor ${Math.round((jetzt - +el.dataset.ext) / 1000)} Sek`; });
  if (neu && zeichnenMoeglich) render();
  liveWaechter();
}, 1000);

liveVerbinden();
laden().catch(f => { S.ui.fehler = f.message; render(); });
