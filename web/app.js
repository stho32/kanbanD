/* kanbanD — Zustand, Laden, Handlungen, Ereignisse. Der Ordner ist die Wahrheit; die Seite fragt nach. */
const S = { zustand: null, board: null, aufgaben: [], herkunft: {}, ich: null, extern: {}, live: true, ui: { slug: null, first: null, fehler: null, pop: null, filter: '', bereich: 'alle' } };
const gemerkt = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const merken = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) { } };
S.ui.filter = gemerkt('kanbanD.filter') || '';
S.ui.bereich = gemerkt('kanbanD.bereich') || 'alle';
S.ui.listBereich = gemerkt('kanbanD.listBereich') || 'alle';
S.ui.pBereich = 'alle';

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
  const m = /^#\/(einrichten|aufgaben|personen|berichte\/stundenzettel|berichte\/kreuz|berichte\/verlauf)/.exec(location.hash);
  return m ? m[1] : 'board';
}

function vHaupt() {
  if (S.ui.first) return vFirst();
  if (S.ui.setup) return vSetup();
  if (S.ui.view === 'einrichten' && S.ui.einr) return vEinrichten();
  if (S.ui.view === 'aufgaben') return vAufgaben();
  if (S.ui.view === 'personen') return vPersonen();
  if (S.ui.view === 'berichte/stundenzettel') return vStundenzettel();
  if (S.ui.view === 'berichte/kreuz') return vKreuz();
  if (S.ui.view === 'berichte/verlauf') return vVerlauf();
  return vBoard();
}

const kopie = x => JSON.parse(JSON.stringify(x));

function gewaehltesBoard() {
  const m = /^#\/board\/([^/]+)/.exec(location.hash);
  const slugs = [...S.zustand.boards.map(b => b.slug), ...defekteBoards()];
  return m && slugs.includes(m[1]) ? m[1] : slugs[0] || null;
}

async function laden() {
  S.zustand = await api('GET', '/api/zustand');
  S.einstellungenDefekt = S.zustand.eingerichtet && !S.zustand.einstellungen;
  if (S.einstellungenDefekt) S.zustand.einstellungen = { personen: [], klassen: [], quellen: { wbs: '', anforderungen: '' } };
  if (!S.zustand.eingerichtet) {
    S.ui.first = S.ui.first || { kuerzel: '', name: '', agenten: { cl: true }, board: 'Entwicklung', spalten: 'Zu erledigen, In Arbeit, Erledigt', wbs: '', anf: '' };
  } else {
    S.ui.first = null;
    S.ui.view = ansichtAusAdresse();
    if (S.ui.view !== 'einrichten') S.ui.einr = null;
    else if (!S.ui.einr) S.ui.einr = kopie(S.zustand.einstellungen);
    S.ui.slug = gewaehltesBoard();
    S.boardDefekt = null;
    const [board, aufgaben, herkunft, boards] = await Promise.all([
      S.ui.slug ? api('GET', '/api/boards/' + encodeURIComponent(S.ui.slug)).catch(f => { if (f.status !== 423) throw f; S.boardDefekt = { slug: S.ui.slug, fehler: f.message }; return null; }) : null,
      api('GET', '/api/aufgaben'),
      api('GET', '/api/herkunft'),
      S.ui.view === 'aufgaben' ? api('GET', '/api/boards') : null,
    ]);
    S.boards = boards;
    S.verlauf = S.ui.view === 'berichte/verlauf' && S.ui.slug ? await api('GET', '/api/berichte/verlauf?board=' + encodeURIComponent(S.ui.slug)) : null;
    S.herkunft = herkunft;
    S.board = board;
    S.aufgaben = aufgaben.aufgaben;
    if (S.ui.offen) await dateiLaden();
    if (S.ui.offenDefekt) await defektLaden();
  }
  render();
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

function render() {
  // Während eines Zuges nicht neu zeichnen — die gezogene Karte würde unter dem Zeiger ersetzt.
  if (typeof zug !== 'undefined' && zug != null) { S.ui.nachZug = true; return; }
  S.ui.nachZug = false;
  $('#kopf').innerHTML = vKopf();
  $('#main').innerHTML = vHaupt();
  $('#over').innerHTML = (S.ui.offen && !S.ui.setup ? vFenster() : '') + (S.ui.offenDefekt ? vDefektFenster() : '') + vPop() + vHinweis() + (S.ui.hilfe ? vHilfe() : '');
  $('#stat').innerHTML = vStatus();
  popPlatzieren();
  if (S.ui.fokus) { const f = $(S.ui.fokus); S.ui.fokus = null; if (f) f.focus(); }
  else if (S.ui.fokusKarte && !S.ui.offen && !S.ui.hilfe) { const k = $(`.ka[data-id="${S.ui.fokusKarte}"]`); if (k) k.focus(); }
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
      case 'add': if (ichNoetig()) break; u.adding = arg; u.fokus = '#add-inp'; break;
      case 'add-ok': {
        const titel = (wert || '').trim();
        if (!titel) { u.adding = null; break; }
        if (ichNoetig()) break;
        const neu = await api('POST', '/api/aufgaben', { ...eintragAus(titel), board: u.slug, spalte: arg });
        u.fokus = '#add-inp';
        u.hinweis = { text: `#${neu.nummer} angelegt`, undo: { art: 'archivieren', nummern: [neu.nummer] }, at: Date.now() };
        return laden();
      }
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
        return laden();
      }
      case 'oeffnen': if (zug != null) break; u.pop = null; u.zeitEdit = null; u.beschreibungBearbeiten = false; u.offen = +arg; u.tab = 'inhalt'; u.gespeichert = null; u.fensterFehler = null; await dateiLaden(); break;
      case 'schliessen': case 'schliessen-bg': u.offen = null; u.datei = null; u.offenDefekt = null; u.defektDatei = null; break;
      case 'schliessen-hilfe': u.hilfe = false; break;
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
      case 'teil': {
        if (ichNoetig()) break;
        const t = aufgabe(u.offen).teilaufgaben[+arg];
        await schreiben('PATCH', `/api/aufgaben/${u.offen}/teilaufgaben/${arg}`, { erledigt: !t.erledigt });
        return;
      }
      case 'teil-weg': if (ichNoetig()) break; await schreiben('DELETE', `/api/aufgaben/${u.offen}/teilaufgaben/${arg}`); return;
      case 'teil-neu': {
        if (!(wert || '').trim() || ichNoetig()) break;
        u.fokus = '#teil-neu';
        await schreiben('POST', `/api/aufgaben/${u.offen}/teilaufgaben`, { text: wert });
        return;
      }
      case 'kommentar': {
        if (!(wert || '').trim() || ichNoetig()) break;
        u.fokus = '#km-inp';
        await schreiben('POST', `/api/aufgaben/${u.offen}/kommentare`, { text: wert });
        return;
      }
      case 'start': if (ichNoetig()) break; await schreiben('POST', `/api/aufgaben/${arg}/timer/start`); return;
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
        for (const n of z.nummern) await schreiben('POST', `/api/aufgaben/${n}/${z.art}`);
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
      case 'zeitraum': u.zeitraum = arg; break;
      case 'still-auch': u.stillAuch = !u.stillAuch; break;
      case 'person-filter': filterSetzen('@' + arg); u.bereich = 'alle'; location.hash = '#/board/' + (u.slug || ''); return;
      case 'list-bereich': u.listBereich = arg; merken('kanbanD.listBereich', arg); break;
      case 'legen-pop': u.legenNr = +arg; u.pop = u.pop === 'legen' ? null : 'legen'; break;
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
      case 'liste-neu': {
        if (!(wert || '').trim() || ichNoetig()) break;
        u.fokus = '#liste-neu';
        try {
          const neu = await api('POST', '/api/aufgaben', eintragAus(wert));
          u.hinweis = { text: `#${neu.nummer} angelegt`, undo: { art: 'archivieren', nummern: [neu.nummer] }, at: Date.now() };
        } catch (f) { u.fehler = f.message; }
        return laden();
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
      case 'setup': u.pop = null; u.setup = { spalten: S.board.spalten.map(sp => ({ name: sp.name, alt: sp.name, grenze: sp.grenze || '', n: sp.aufgaben.length })) }; break;
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
      case 'col-add': {
        const name = (wert || '').trim();
        if (!name) break;
        const d = u.setup.spalten;
        d.splice(Math.max(0, d.length - 1), 0, { name, alt: null, grenze: '', n: 0 });
        u.fokus = '#col-new';
        break;
      }
      case 'setup-ok': {
        if (ichNoetig()) break;
        try {
          await api('PUT', `/api/boards/${encodeURIComponent(u.slug)}/spalten`, u.setup.spalten.map(sp => ({ name: sp.name.trim(), alt: sp.alt, grenze: +sp.grenze > 0 ? +sp.grenze : null })));
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
  if (e.target.id === 'umbenennen' && S.ui.umbenennen) setTimeout(() => { if (S.ui.umbenennen && document.activeElement !== $('#umbenennen')) { S.ui.umbenennen = null; render(); } }, 0);
});

document.addEventListener('change', e => {
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

document.addEventListener('click', e => {
  if (e.target.closest('a[href^="vscode:"]')) return;
  if (e.target.closest('.menue a[href^="#"]')) { S.ui.pop = null; return; }
  const el = e.target.closest('[data-act]');
  if (S.ui.pop && !e.target.closest('.pop') && !(el && el.dataset.act === 'pop')) {
    S.ui.pop = null; S.ui.ichNoetig = false;
    if (!el) { render(); return; }
  }
  if (!el || el.disabled) return;
  if (el.dataset.act === 'schliessen-bg' && e.target !== el) return;
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
  if (e.target.dataset && e.target.dataset.schnell) {
    const v = $('#add-vorschau');
    if (v) v.innerHTML = e.target.value.trim() ? vSchnellVorschau(e.target.value) : '';
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
  if (e.key === 'Enter' && t.classList && t.classList.contains('besch-lesen')) { e.preventDefault(); act('beschreibung-bearbeiten'); return; }
  if (e.key === 'Enter' && t.dataset && t.dataset.enter && !e.shiftKey) {
    e.preventDefault();
    act(t.dataset.enter, t.dataset.arg, t.value);
    return;
  }
  if (e.key === 'Escape' && t.id === 'flt') {
    if (S.ui.filter) { filterSetzen(''); render(); $('#flt').focus(); } else t.blur();
    return;
  }
  if (S.ui.hilfe && (e.key === 'Escape' || e.key === '?')) { S.ui.hilfe = false; render(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && S.ui.hinweis && S.ui.hinweis.undo) {
    e.preventDefault();
    act('rueckgaengig');
    return;
  }
  if (brettTaste(e, t)) return;
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !S.ui.offen && $('#flt')) {
    e.preventDefault();
    $('#flt').focus();
    return;
  }
  if (e.key === 'Escape') {
    if (S.ui.pop) { S.ui.pop = null; S.ui.ichNoetig = false; render(); return; }
    if (S.ui.adding) { S.ui.adding = null; render(); return; }
    if (S.ui.umbenennen) { const n = S.ui.umbenennen; S.ui.umbenennen = null; S.ui.fokusKarte = n; render(); return; }
    if (S.ui.setup) { S.ui.setup = null; render(); return; }
    if (S.ui.offen) { if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) t.blur(); S.ui.offen = null; render(); return; }
    if (S.ui.offenDefekt) { S.ui.offenDefekt = null; S.ui.defektDatei = null; render(); return; }
  }
  if (S.ui.offen && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    act('blaettern', e.key === 'ArrowDown' ? '1' : '-1');
  }
});

/* Tastatur auf dem Board: Pfeile wählen, Umschalt+Pfeile verschieben, Enter öffnet, n legt an, ? hilft. */
const RICHTUNG = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'hoch', ArrowDown: 'runter' };
function brettTaste(e, t) {
  const u = S.ui;
  if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || u.offen || u.offenDefekt || u.setup || u.pop || u.view !== 'board' || !S.board || e.ctrlKey || e.metaKey || e.altKey) return false;
  const karte = t.closest && t.closest('.ka[data-id]');
  const nr = karte ? +karte.dataset.id : null;
  if (e.key === '?') { u.hilfe = true; render(); return true; }
  if (e.key === 'Enter' && karte) { act(karte.dataset.act, karte.dataset.arg); return true; }
  if (karte && (e.key === 't' || e.key === 'm' || e.key === 'F2')) {
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
  if (e.shiftKey) {
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
/* Mehrzeiliges Einfügen: je Zeile eine Aufgabe bzw. Teilaufgabe, in einem Commit. */
document.addEventListener('paste', async e => {
  const art = e.target.dataset && e.target.dataset.mehrfach;
  if (!art) return;
  const zeilen = zeilenAusText(e.clipboardData && e.clipboardData.getData('text'));
  if (zeilen.length < 2) return;
  e.preventDefault();
  if (ichNoetig()) { render(); return; }
  const u = S.ui;
  if (art === 'teil') {
    u.fokus = '#teil-neu';
    await schreiben('POST', `/api/aufgaben/${u.offen}/teilaufgaben/mehrere`, { texte: zeilen });
    u.hinweis = { text: `${zeilen.length} Teilaufgaben ergänzt`, at: Date.now() };
  } else {
    u.fokus = art === 'board' ? '#add-inp' : '#liste-neu';
    const eintraege = zeilen.map(eintragAus);
    const daten = art === 'board' ? { titel: eintraege, board: u.slug, spalte: e.target.dataset.arg } : { titel: eintraege };
    let neu = [];
    try { neu = await api('POST', '/api/aufgaben/mehrere', daten); } catch (f) { u.fehler = f.message; }
    await laden();
    if (neu.length) u.hinweis = { text: `${neu.length} Aufgaben angelegt`, undo: { art: 'archivieren', nummern: neu.map(a => a.nummer) }, at: Date.now() };
  }
  u.fokus = art === 'teil' ? '#teil-neu' : art === 'board' ? '#add-inp' : '#liste-neu';
  render();
});

/* Tooltip des Burndowns: Fadenkreuz und Werte des Tages unter dem Zeiger */
document.addEventListener('mouseover', e => {
  const r = e.target.closest && e.target.closest('rect.treffer');
  const tip = $('#tooltip'), kreuz = $('#fadenkreuz');
  if (!tip || !kreuz) return;
  if (!r) { tip.hidden = true; kreuz.setAttribute('x1', -10); kreuz.setAttribute('x2', -10); return; }
  const x = S.verlauf.tage[+r.dataset.tag], mitte = +r.getAttribute('x') + +r.getAttribute('width') / 2;
  kreuz.setAttribute('x1', mitte); kreuz.setAttribute('x2', mitte);
  tip.innerHTML = `<b>${x.datum}</b><span><i class="k-offen"></i>offen ${x.offen}</span><span><i class="k-umfang"></i>Umfang ${x.umfang}</span>`;
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
  if (S.ui.nachZug) render();
  einfuegeMarkenWeg();
  if (z) act('bewegen', JSON.stringify({ nummer, ...z }));
});
document.addEventListener('dragend', () => {
  zug = null; ziel = null; einfuegeMarkenWeg();
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
  if (S.ui.hinweis && jetzt - S.ui.hinweis.at > 8000) { S.ui.hinweis = null; neu = true; }
  document.querySelectorAll('[data-since]').forEach(el => { const d = jetzt - +el.dataset.since; el.textContent = el.dataset.fmt === 's' ? hms(d) : hm(d); });
  document.querySelectorAll('[data-ext]').forEach(el => { el.textContent = `extern · ${el.dataset.datei} · vor ${Math.round((jetzt - +el.dataset.ext) / 1000)} Sek`; });
  if (neu && zug == null && !S.ui.adding) render();
}, 1000);

liveVerbinden();
laden().catch(f => { S.ui.fehler = f.message; render(); });
