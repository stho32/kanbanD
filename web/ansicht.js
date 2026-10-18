/* kanbanD — Darstellung. Jede Funktion liefert HTML aus dem Zustand S. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function slug(t) {
  return t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');
}

/* Vorschau der Dateien — dieselbe Form, die das Programm schreibt. */
function yamlSkalar(s) {
  const schlicht = s !== '' && /^[\p{L}\p{N} _.\/()-]+$/u.test(s) && !/^[ .-]/.test(s) && !/ $/.test(s)
    && !/^(true|false|yes|no|on|off|null|~)$/i.test(s) && isNaN(Number(s));
  return schlicht ? s : JSON.stringify(s);
}
function einstellungenText(e) {
  let s = '---\npeople:' + (e.personen.length ? '' : ' {}');
  for (const p of e.personen) s += `\n  ${yamlSkalar(p.kuerzel)}: {name: ${yamlSkalar(p.name)}, kind: ${p.art === 'agent' ? 'agent' : 'human'}${p.aktiv === false ? ', active: false' : ''}}`;
  s += '\nclasses:' + (e.klassen.length ? '' : ' {}');
  for (const k of e.klassen) s += `\n  ${yamlSkalar(k.schluessel)}: {label: ${yamlSkalar(k.bezeichnung)}, color: ${yamlSkalar(k.farbe)}}`;
  s += `\nsources:\n  wbs: ${yamlSkalar(e.quellen.wbs)}\n  requirements: ${yamlSkalar(e.quellen.anforderungen)}`;
  const register = [...(e.quellen.anwendungen || [])].sort((a, b) => (a.kuerzel < b.kuerzel ? -1 : a.kuerzel > b.kuerzel ? 1 : 0));
  if (register.length) s += '\n  applications:' + register.map(a => `\n    ${yamlSkalar(a.kuerzel)}: {name: ${yamlSkalar(a.name)}, wbs: ${yamlSkalar(a.wbs)}, requirements: ${yamlSkalar(a.anforderungen)}}`).join('');
  return s + '\n---';
}
function boardText(titel, spalten) {
  return `# ${titel}\n` + spalten.map(s => `\n## ${s}\n`).join('');
}

const personen = () => (S.zustand && S.zustand.einstellungen ? S.zustand.einstellungen.personen : []);
const per = k => personen().find(p => p.kuerzel === k) || { kuerzel: k, name: k, art: 'human', aktiv: true };
const pk = k => { const p = per(k); return `<span class="pk ${p.art === 'agent' ? 'pk-a' : 'pk-m'}${p.aktiv === false ? ' pk-still' : ''}" title="${esc(p.name)}${p.aktiv === false ? ' (stillgelegt)' : ''}">${esc(k.slice(0, 2).toUpperCase())}</span>`; };

/* ── Kopfzeile ── */
function vKopf() {
  const u = S.ui, z = S.zustand;
  if (!z) return '<header class="kz"><div class="kz-z1">kanbanD</div></header>';
  const ordnerName = z.ordner.split('/').filter(Boolean).pop();
  if (u.setup) return `<header class="kz modus"><div class="kz-z1">${esc(S.board.titel)} <span class="mono">boards/${esc(S.board.slug)}.md</span></div><div class="kz-modus"><b>Spalten einrichten</b><span class="muted">schreibt nur die Board-Datei, Aufgaben bleiben unberührt</span>${u.setup.fehler ? `<span class="fehl-kopf" role="alert">${esc(u.setup.fehler)}</span>` : ''}<div class="rechts"><button class="kz-btn" data-act="setup-weg">Verwerfen</button><button class="kz-btn haupt" data-act="setup-ok">Fertig</button></div></div></header>`;
  if (!z.eingerichtet || u.first) return `<header class="kz"><div class="kz-z1">${esc(ordnerName)} <span class="mono">${esc(z.ordner)}</span></div><div class="kz-modus"><b>Erster Start</b><span class="muted">Ordner ohne kanbanD.md</span></div></header>`;
  const b = S.board;
  return `<header class="kz"><div class="kz-z1" title="${esc(z.ordner)}"><button class="kz-btn kz-board${u.pop === 'board' ? ' auf' : ''}" id="t-board" data-act="pop" data-arg="board" aria-haspopup="true">${esc(b ? b.titel : 'kein Board')} ▾</button> <span class="mono">${esc(ordnerName)}</span></div><nav class="kz-nav"><a href="#/board/${esc(u.slug || '')}" class="${u.view === 'board' ? 'an' : ''}">Board</a><a href="#/aufgaben" class="${u.view === 'aufgaben' ? 'an' : ''}">Aufgaben</a><a href="#/personen" class="${u.view === 'personen' ? 'an' : ''}">Personen</a><a href="#" id="t-ber" class="${u.view.startsWith('berichte') ? 'an' : ''}${u.pop === 'ber' ? ' auf' : ''}" data-act="pop" data-arg="ber" aria-haspopup="true">Berichte<span class="dd">▾</span></a>${vWbsMenue()}<a href="#/einrichten" class="${u.view === 'einrichten' ? 'an' : ''}">Einrichten</a></nav>${u.view === 'aufgaben' ? vListenWerk() : ''}${b && u.view === 'board' ? `<div class="kz-werk"><input class="inp" id="flt" placeholder="Filtern: Titel, #Nr, @wer, class:bug, origin:I0023, label:ui  ( / )" value="${esc(u.filter)}" aria-label="Filter"><span class="seg" role="radiogroup" aria-label="Bereich">${[['alle', 'alle'], ['meine', 'meine'], ['agenten', 'Agenten']].map(([k, t]) => `<span class="${u.bereich === k ? 'an' : ''}" data-act="bereich" data-arg="${k}" role="radio" aria-checked="${u.bereich === k}">${t}</span>`).join('')}</span><button class="kz-btn" data-act="setup" title="Spalten dieses Boards einrichten">Spalten</button><button class="kz-btn neu-btn" data-act="add" data-arg="" title="Neue Aufgabe (n)">+ Neue Aufgabe</button></div>` : ''}<div class="kz-z3">${vLaufKnopf()}${S.live ? '' : '<span class="kz-btn leer" title="Die Verbindung zum Server ist unterbrochen; die Seite lädt neu, sobald sie zurück ist.">nicht live</span>'}${vIchKnopf()}</div></header>`;
}

const UHR = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>';
function vLaufKnopf() {
  const n = alleLaufenden().length;
  return n ? `<button class="kz-btn${S.ui.pop === 'lauf' ? ' auf' : ''}" id="t-lauf" data-act="pop" data-arg="lauf" aria-haspopup="true">${UHR}${n} ${n === 1 ? 'läuft' : 'laufen'}</button>` : '';
}

function vLaufPop() {
  const r = alleLaufenden().sort((x, y) => zeitMs(x.z.beginn) - zeitMs(y.z.beginn)), jetzt = Date.now();
  return `<div class="pop" id="pop" data-for="t-lauf" data-al="r" style="width:450px" role="menu"><h4>LÄUFT GERADE <span class="mono">${r.length} Timer · ${new Set(r.map(x => x.a.nummer)).size} Aufgaben</span></h4>${r.map(({ a, z }) => `<div class="pz2${z.wer === S.ich ? ' eigen' : ''}" data-act="oeffnen" data-arg="${a.nummer}" role="menuitem">${pk(z.wer)}<span class="id">#${a.nummer}</span><span class="t">${esc(a.titel)}<small>${esc(per(z.wer).name)}${z.wer === S.ich ? ' · ich' : ''} · seit ${esc(z.beginn.slice(11))}</small></span><b data-since="${zeitMs(z.beginn)}" data-fmt="s">${hms(jetzt - zeitMs(z.beginn))}</b><button class="btn${z.wer === S.ich ? ' btn-haupt' : ''}" data-act="stop" data-arg="${a.nummer}|${esc(z.wer)}" title="stoppen" aria-label="Timer von ${esc(per(z.wer).name)} stoppen">■</button></div>`).join('')}<div class="fuss">Klick auf eine Zeile öffnet die Aufgabe · fremde Timer lassen sich stoppen</div></div>`;
}

function vIchKnopf() {
  const me = S.ich && personen().find(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv);
  return `<button class="kz-btn${S.ui.pop === 'ich' ? ' auf' : ''}${me ? '' : ' leer'}" id="t-ich" data-act="pop" data-arg="ich" aria-haspopup="true">${me ? pk(me.kuerzel) + esc(me.name) : 'nicht gewählt'} ▾</button>`;
}

/* ── Schnelleingabe: Vorschau der erkannten Felder ── */
function schnellUmfeld() { return { personen: personen().filter(p => p.aktiv), klassen: S.zustand.einstellungen.klassen }; }
function vSchnellVorschau(text) {
  const s = schnelleingabe(text, schnellUmfeld(), new Date());
  const teile = [...s.zustaendige.map(k => pk(k) + esc(per(k).name)), s.klasse ? `<span class="cls" style="${cv((klasse(s.klasse) || {}).farbe)}">${esc(klasse(s.klasse).bezeichnung)}</span>` : '', ...s.labels.map(l => `<span class="lbl">${esc(l)}</span>`), s.faellig ? `<span class="due">fällig ${esc(s.faellig)}</span>` : '', ...s.herkunft.map(h => `<span class="org">${esc(h)}</span>`)].filter(Boolean);
  return teile.length ? `<span class="muted">→ ${esc(s.titel)}</span>${teile.join('')}` : '<span class="muted">@kürzel · class: · label: · due:morgen · I0001</span>';
}
/* ── Dialog „Neue Aufgabe“ — alle Felder sofort, wie in Kanbanflow ── */
function vNeu() {
  const f = S.ui.neu;
  if (!f) return '';
  const boards = S.boards || [];
  const b = boards.find(x => x.slug === f.board);
  const ps = personen().filter(p => p.aktiv);
  const cl = klasse(f.klasse);
  const stil = cl ? ` style="${cv(cl.farbe)}"` : '';
  const haupt = `<div class="mod-main"><input class="titel" id="neu-titel" data-nf="titel" value="${esc(f.titel)}" placeholder="Titel · Enter legt an · Liste einfügen legt alle an" data-mehrfach="neu" aria-label="Titel der neuen Aufgabe"><div class="schnell" id="neu-vorschau" aria-live="polite">${f.titel.trim() ? vSchnellVorschau(f.titel) : '<span class="muted">Kürzel: @kürzel · class: · label: · due:morgen · I0001</span>'}</div>
<div class="abs"><h3>BESCHREIBUNG</h3><textarea class="besch" data-nf="beschreibung" placeholder="Beschreibung in Markdown" aria-label="Beschreibung der neuen Aufgabe">${esc(f.beschreibung)}</textarea></div>
<div class="abs"><h3>TEILAUFGABEN <span class="mono">${f.teil.length}</span></h3>${f.teil.map((t, j) => `<div class="chk"><i></i><span>${esc(t)}</span><button class="btn btn-sym x" data-act="nf-teil-weg" data-arg="${j}" aria-label="Teilaufgabe ${esc(t)} entfernen">✕</button></div>`).join('')}<input class="inp add" id="neu-teil" placeholder="+ Teilaufgabe · Enter · Liste einfügen" data-enter="nf-teil" data-mehrfach="neu-teil" aria-label="Neue Teilaufgabe der neuen Aufgabe"></div></div>`;
  const seite = `<aside class="mod-side"><div class="felder">
<span class="k">board</span><span class="w"><select data-nf="board" aria-label="Board"><option value="">— kein Board —</option>${boards.map(x => `<option value="${esc(x.slug)}"${x.slug === f.board ? ' selected' : ''}>${esc(x.titel)}</option>`).join('')}</select></span>
${b ? `<span class="k">column</span><span class="w"><select data-nf="spalte" aria-label="Spalte">${b.spalten.map(sp => `<option${sp.name === f.spalte ? ' selected' : ''}>${esc(sp.name)}</option>`).join('')}</select></span>` : ''}
<span class="k">class</span><span class="w"><select data-nf="klasse" aria-label="Klasse"><option value="">— keine —</option>${S.zustand.einstellungen.klassen.map(k => `<option value="${esc(k.schluessel)}"${k.schluessel === f.klasse ? ' selected' : ''}>${esc(k.bezeichnung)}</option>`).join('')}</select></span>
<span class="k">assignees</span><span class="w wrap">${ps.map(p => `<button class="as${f.zust.includes(p.kuerzel) ? ' an' : ''}" data-act="nf-zust" data-arg="${esc(p.kuerzel)}" aria-pressed="${f.zust.includes(p.kuerzel)}">${pk(p.kuerzel)}${esc(p.name)}</button>`).join('')}</span>
<span class="k">labels</span><span class="w"><input class="mini-inp full" data-nf="labels" value="${esc(f.labels)}" placeholder="ui, daten" aria-label="Labels der neuen Aufgabe"></span>
<span class="k">due</span><span class="w wrap"><input type="date" class="mini-inp" data-nf="faellig" value="${esc(f.faellig)}" aria-label="Fälligkeit der neuen Aufgabe"><span class="due-knoepfe">${[['0', 'heute'], ['1', 'morgen'], ['7', '+1 Woche']].map(([n, t]) => `<button class="as" data-act="nf-faellig" data-arg="${n}">${t}</button>`).join('')}</span></span>
<span class="k">origins</span><span class="w"><input class="mini-inp full" data-nf="herkunft" value="${esc(f.herkunft)}" placeholder="I0001 R00014" aria-label="Herkunft der neuen Aufgabe"></span></div></aside>`;
  const fuss = `<div class="mod-fuss neu-fuss">${f.fehler ? `<span class="fehl" role="alert">${esc(f.fehler)}</span>` : '<span><kbd>Enter</kbd> im Titel oder <kbd>Strg</kbd>+<kbd>Enter</kbd> legt an · <kbd>Umschalt</kbd>+<kbd>Strg</kbd>+<kbd>Enter</kbd> und weitere · <kbd>Esc</kbd> abbrechen</span>'}<span style="margin-left:auto;display:flex;gap:6px"><button class="btn" data-act="nf-zu">Abbrechen</button><button class="btn" data-act="nf-anlegen" data-arg="weitere">Anlegen und weitere</button><button class="btn btn-haupt" data-act="nf-anlegen" data-arg="">Anlegen</button></span></div>`;
  return `<div class="mod-bg" data-act="nf-zu-bg"><div class="mod neu" role="dialog" aria-label="Neue Aufgabe"${stil}><div class="mod-kopf"><span class="id">Neue Aufgabe</span>${b ? `<span class="pfad">${esc(b.titel)} · ${esc(f.spalte || '')}</span>` : '<span class="pfad">ohne Board</span>'}<div class="rechts"><button class="btn btn-sym" data-act="nf-zu" aria-label="Schließen">✕</button></div></div><div class="mod-body">${haupt}${seite}</div>${fuss}</div></div>`;
}

/* ── Aufgabenfenster (Artboard D0003) ── */
const uhr = t => new Date(t).toTimeString().slice(0, 8);
/** Nummern der sichtbaren Karten in Board-Reihenfolge — zum Blättern. */
function sichtbareReihe() {
  const sichtbar = a => a && !!a.archiviert === imArchiv() && passt(a, S.ui.filter, umfeld());
  if (!S.board) return S.aufgaben.filter(sichtbar).map(a => a.nummer);
  return S.board.spalten.flatMap(sp => sp.aufgaben.filter(n => sichtbar(aufgabe(n))));
}

function vFenster() {
  const a = aufgabe(S.ui.offen);
  if (!a) return '';
  const u = S.ui, cl = klasse(a.klasse), reihe = sichtbareReihe(), i = reihe.indexOf(a.nummer);
  const pfad = 'aufgaben/' + a.datei, wurzel = S.zustand.ordner;
  const spalte = S.board && S.board.spalten.find(sp => sp.aufgaben.includes(a.nummer));
  const kopf = `<div class="mod-kopf"><span class="id">#${a.nummer}</span>${cl ? `<span class="cls">${esc(cl.bezeichnung)}</span>` : ''}<span class="pfad">${esc(pfad)}</span><div class="rechts"><span class="seg">${[['inhalt', 'Inhalt'], ['datei', 'Datei']].map(([k, t]) => `<span class="${u.tab === k ? 'an' : ''}" data-act="tab" data-arg="${k}" role="tab" aria-selected="${u.tab === k}">${t}</span>`).join('')}</span><span class="nav">${i + 1} / ${reihe.length}</span><button class="btn btn-sym" data-act="blaettern" data-arg="-1" title="vorige Karte (↑)" aria-label="vorige Karte">↑</button><button class="btn btn-sym" data-act="blaettern" data-arg="1" title="nächste Karte (↓)" aria-label="nächste Karte">↓</button><a class="btn btn-sym" id="vsc" href="vscode://file${esc(wurzel)}/${esc(pfad)}" title="In VS Code öffnen">↗</a>${a.archiviert ? `<button class="btn btn-sym" data-act="zurueckholen" data-arg="${a.nummer}" title="Aus dem Archiv zurückholen" aria-label="Zurückholen">↺</button>` : `<button class="btn btn-sym" data-act="archivieren" data-arg="${a.nummer}" title="Archivieren – verschwindet vom Board, Datei bleibt" aria-label="Archivieren">▭</button>`}<button class="btn btn-sym" data-act="schliessen" title="Schließen (Esc)" aria-label="Schließen">✕</button></div></div>`;
  const archivLeiste = a.archiviert ? `<div class="archbar">Archiviert am ${esc(a.archiviert)} · nicht auf dem Board, Datei und Zeiten bleiben<button class="lnk" data-act="zurueckholen" data-arg="${a.nummer}">zurückholen</button></div>` : '';
  const fuss = `<div class="mod-fuss"><span class="gs">${u.gespeichert ? 'gespeichert ' + uhr(u.gespeichert) : 'jede Änderung geht sofort in die Datei'}</span>${u.fensterFehler ? `<span class="fehl" role="alert">${esc(u.fensterFehler)}</span>` : ''}<span style="margin-left:auto"><kbd>Esc</kbd> schließen · <kbd>↑</kbd><kbd>↓</kbd> Karte wechseln</span></div>`;
  const stil = cl ? ` style="${cv(cl.farbe)}"` : '';
  if (u.tab === 'datei') return `<div class="mod-bg" data-act="schliessen-bg"><div class="mod" role="dialog" aria-label="Aufgabe #${a.nummer}"${stil}>${kopf}${archivLeiste}<div class="mod-body voll"><div class="mod-main"><pre class="md" id="dateitext">${esc(u.datei ? u.datei.text : '')}</pre></div></div>${fuss}</div></div>`;
  const haupt = `<div class="mod-main"><input class="titel" data-af="titel" value="${esc(a.titel)}" aria-label="Titel"><div class="abs"><h3>BESCHREIBUNG</h3>${a.beschreibung && !S.ui.beschreibungBearbeiten ? `<div class="besch-lesen" data-act="beschreibung-bearbeiten" tabindex="0" role="button" aria-label="Beschreibung bearbeiten" title="Klick bearbeitet">${markdownHtml(a.beschreibung)}</div>` : `<textarea class="besch" id="beschreibung" data-af="beschreibung" placeholder="Beschreibung in Markdown" aria-label="Beschreibung">${esc(a.beschreibung)}</textarea>`}</div>${vFensterAbschnitte(a)}</div>`;
  const ps = personen().filter(p => p.aktiv || a.zustaendige.includes(p.kuerzel));
  const seite = `<aside class="mod-side">${vFensterSeite(a)}<div class="felder"><span class="k">column</span><span class="w">${spalte ? `<select data-af="spalte" aria-label="Spalte">${S.board.spalten.map(sp => `<option${sp === spalte ? ' selected' : ''}>${esc(sp.name)}</option>`).join('')}</select>` : '<span class="muted">nicht auf diesem Board</span>'}</span>
<span class="k">class</span><span class="w"><select data-af="klasse" aria-label="Klasse"><option value="">— keine —</option>${(S.zustand.einstellungen.klassen).map(k => `<option value="${esc(k.schluessel)}"${k.schluessel === a.klasse ? ' selected' : ''}>${esc(k.bezeichnung)}</option>`).join('')}${a.klasse && !cl ? `<option selected>${esc(a.klasse)}</option>` : ''}</select></span>
<span class="k">origins</span><span class="w wrap">${a.herkunft.map((x, j) => `<span class="ochip">${vHerkunftChip(x)}<button data-act="herkunft-weg" data-arg="${j}" title="entfernen" aria-label="Herkunft ${esc(x)} entfernen">×</button></span>`).join('') || vHerkunftChip('thin air')}<input class="mini-inp" id="herkunft-neu" placeholder="I0001 / kd:I0001 / R00014" data-enter="herkunft-neu" title="WBS-Knoten I0001, Anforderung R00014, mit Kürzel der Anwendung kd:I0001, oder thin air · Enter" aria-label="Neue Herkunft"></span>
${vWirkungenFeld(a)}
${(w => w.length ? `<span class="k">wartet auf</span><span class="w wrap">${w.map(n => `<a href="#" class="org" data-act="oeffnen" data-arg="${n}">#${n}</a>`).join('')}</span>` : '')(wartetAuf(a))}
<span class="k">assignees</span><span class="w wrap">${ps.map(p => `<button class="as${a.zustaendige.includes(p.kuerzel) ? ' an' : ''}" data-act="zustaendig" data-arg="${esc(p.kuerzel)}"${p.aktiv ? '' : ' disabled title="stillgelegt"'} aria-pressed="${a.zustaendige.includes(p.kuerzel)}">${pk(p.kuerzel)}${esc(p.name)}</button>`).join('')}</span>
<span class="k">labels</span><span class="w"><input class="mini-inp full" data-af="labels" value="${esc(a.labels.join(', '))}" placeholder="ui, daten" aria-label="Labels"></span>
<span class="k">due</span><span class="w wrap"><input type="date" class="mini-inp" data-af="faellig" value="${esc(a.faellig || '')}" aria-label="Fälligkeit"><span class="due-knoepfe">${[['0', 'heute'], ['1', 'morgen'], ['7', '+1 Woche']].map(([n, t]) => `<button class="as" data-act="faellig" data-arg="${n}">${t}</button>`).join('')}${a.faellig ? '<button class="as" data-act="faellig" data-arg="" aria-label="Fälligkeit entfernen">✕</button>' : ''}</span></span></div></aside>`;
  return `<div class="mod-bg" data-act="schliessen-bg"><div class="mod" role="dialog" aria-label="Aufgabe #${a.nummer}"${stil}>${kopf}${archivLeiste}<div class="mod-body">${haupt}${seite}</div>${fuss}</div></div>`;
}
/* Abschnitte, die spätere Ausbaustufen füllen (Teilaufgaben, Kommentare, Timer, Zeiten, Anhänge). */
function vFensterAbschnitte(a) {
  return vTeilaufgaben(a) + vAnhaenge(a) + vKommentare(a);
}
const groesse = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1).replace('.', ',') + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
function vAnhaenge(a) {
  const liste = S.ui.anhaenge || [];
  return `<div class="abs anh" id="anhaenge"><h3>ANHÄNGE <span class="mono">${esc(a.datei.replace(/\.md$/, ''))}/ · ${liste.length}</span></h3>${liste.map(x => `<div class="anh-z"><a href="/api/aufgaben/${a.nummer}/anhaenge/${encodeURIComponent(x.name)}" target="_blank" rel="noopener">${esc(x.name)}</a><span class="mono muted">${groesse(x.groesse)}</span><button class="btn btn-sym x" data-act="anhang-weg" data-arg="${esc(x.name)}" aria-label="Anhang ${esc(x.name)} entfernen">✕</button></div>`).join('')}<label class="inp add anh-wahl">+ Datei wählen oder hierher ziehen<input type="file" id="anhang-datei" multiple hidden aria-label="Anhang hinzufügen"></label></div>`;
}
function ichPerson() {
  return S.ich && personen().find(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv);
}
function vKommentare(a) {
  const me = ichPerson();
  return `<div class="abs"><h3>KOMMENTARE <span class="mono">kanbanD-comments · ${a.kommentare.length}</span></h3>${a.kommentare.map(k => `<div class="km">${pk(k.wer)}<div><p>${esc(k.text).replace(/\n/g, '<br>')}</p><span class="mono">${esc(per(k.wer).name)} · ${esc(k.zeitpunkt)}</span></div></div>`).join('')}<textarea class="inp add km-inp" id="km-inp" rows="1" placeholder="${me ? '+ Kommentar als ' + esc(me.name) + ' · Enter (Umschalt+Enter: neue Zeile)' : 'erst „Ich bin …“ wählen'}" data-enter="kommentar" aria-label="Neuer Kommentar"${me ? '' : ' disabled'}></textarea></div>`;
}
function vTeilaufgaben(a) {
  const ok = a.teilaufgaben.filter(t => t.erledigt).length;
  return `<div class="abs"><h3>TEILAUFGABEN <span class="mono">${ok}/${a.teilaufgaben.length}</span></h3>${a.teilaufgaben.map((t, j) => `<div class="chk${t.erledigt ? ' ok' : ''}"><i data-act="teil" data-arg="${j}" role="checkbox" aria-checked="${t.erledigt}" aria-label="${esc(t.text)}">${t.erledigt ? '✓' : ''}</i><span data-act="teil" data-arg="${j}">${esc(t.text)}</span><button class="btn btn-sym x" data-act="teil-weg" data-arg="${j}" title="entfernen" aria-label="Teilaufgabe ${esc(t.text)} entfernen">✕</button></div>`).join('')}<input class="inp add" placeholder="+ Teilaufgabe · Enter" data-enter="teil-neu" id="teil-neu" data-mehrfach="teil" aria-label="Neue Teilaufgabe"></div>`;
}
function vFensterSeite(a) {
  const rs = laufende(a), meins = rs.find(z => z.wer === S.ich), me = ichPerson(), jetzt = Date.now();
  return `<div class="abs"><h3>LÄUFT GERADE <span class="mono">${rs.length} Timer</span></h3>${rs.length ? `<div class="tl">${rs.map(z => `<div class="tz${z.wer === S.ich ? ' eigen' : ''}" data-timer="${esc(z.wer)}">${pk(z.wer)}<span>${esc(per(z.wer).name)} <span class="muted">${z.wer === S.ich ? '· ich ' : ''}· seit ${esc(z.beginn.slice(11))}</span></span><b data-since="${zeitMs(z.beginn)}" data-fmt="s">${hms(jetzt - zeitMs(z.beginn))}</b><button class="btn${z.wer === S.ich ? ' btn-haupt' : ''}" data-act="stop" data-arg="${a.nummer}|${esc(z.wer)}" title="${z.wer === S.ich ? 'meinen Timer' : esc(per(z.wer).name) + 's Timer'} stoppen" aria-label="Timer von ${esc(per(z.wer).name)} stoppen">■</button></div>`).join('')}</div>` : ''}${meins ? '' : `<button class="btn btn-haupt start" data-act="start" data-arg="${a.nummer}">▶ ${me ? 'Meinen Timer starten' : 'Timer starten …'}</button>`}</div>` + vZeiten(a);
}
function vZeiten(a) {
  const jetzt = Date.now(), me = ichPerson(), u = S.ui;
  const dauer = z => (z.ende ? zeitMs(z.ende) : jetzt) - zeitMs(z.beginn);
  const summe = a.zeiten.reduce((s, z) => s + dauer(z), 0);
  const zeilen = a.zeiten.map((z, i) => ({ z, i })).sort((x, y) => zeitMs(y.z.beginn) - zeitMs(x.z.beginn)).map(({ z, i }) => u.zeitEdit === i
    ? `<tr class="edit"><td colspan="5"><input class="mini-inp" id="z-beginn" value="${esc(z.beginn)}" aria-label="Beginn" data-enter="zeit-ok" data-arg="${i}">${z.ende ? `<input class="mini-inp" id="z-ende" value="${esc(z.ende)}" aria-label="Ende" data-enter="zeit-ok" data-arg="${i}">` : ' <span class="muted">läuft</span>'}<button class="btn btn-sym" data-act="zeit-ok" data-arg="${i}" aria-label="Korrektur speichern">✓</button></td></tr>`
    : `<tr data-zeit="${i}"><td class="mono">${esc(z.beginn.slice(5, 10))}</td><td class="mono">${esc(z.beginn.slice(11))}–${z.ende ? esc(z.ende.slice(11)) : '…'}</td><td>${pk(z.wer)}</td><td class="r">${z.ende ? hm(dauer(z)) : `<span class="lauf${z.wer === S.ich ? ' eigen' : ''}"><span data-since="${zeitMs(z.beginn)}">${hm(dauer(z))}</span></span>`}</td><td class="x"><button class="btn btn-sym" data-act="zeit-edit" data-arg="${i}" title="korrigieren" aria-label="Zeit ${i + 1} korrigieren">✎</button>${z.ende ? `<button class="btn btn-sym" data-act="zeit-weg" data-arg="${i}" title="Eintrag löschen" aria-label="Zeit ${i + 1} löschen">✕</button>` : ''}</td></tr>`).join('');
  return `<div class="abs"><h3>ZEITEN <span class="mono" id="zeitsumme">kanbanD-time · ${hm(summe)}</span></h3><table class="zt">${zeilen}</table><input class="inp add" id="zeit-neu" placeholder="${me ? '+ Zeit nachtragen, z. B. 0:45 · Enter' : 'erst „Ich bin …“ wählen'}" data-enter="zeit-neu" aria-label="Zeit nachtragen"${me ? '' : ' disabled'}></div>`;
}

/* ── Popover ── */
const defekteBoards = () => (S.zustand.defekte || []).filter(d => /^boards\/[^/]+\.md$/.test(d.pfad)).map(d => d.pfad.slice(7, -3));
function vBoardPop() {
  const u = S.ui;
  return `<div class="pop" id="pop" data-for="t-board" data-al="l" style="width:300px" role="menu"><h4>BOARDS <span class="mono">boards/</span></h4>${S.zustand.boards.map(b => `<div class="iz${b.slug === u.slug ? ' an' : ''}" data-act="board-wahl" data-arg="${esc(b.slug)}" role="menuitem">${esc(b.titel)}<span class="muted mono">${esc(b.slug)}.md</span></div>`).join('')}${defekteBoards().map(s => `<div class="iz${s === u.slug ? ' an' : ''}" data-act="board-wahl" data-arg="${esc(s)}" role="menuitem">${esc(s)}<span class="muted mono warn">defekt</span></div>`).join('')}<div class="iz neu"><input class="inp" id="board-neu" placeholder="Neues Board · Enter" data-enter="board-neu" aria-label="Name des neuen Boards"></div>${u.popFehler ? `<div class="warnh" role="alert">${esc(u.popFehler)}</div>` : ''}<div class="fuss">Alle Boards zeigen denselben Aufgabenbestand.</div></div>`;
}

function vPop() {
  const u = S.ui;
  if (u.pop === 'board') return vBoardPop();
  if (u.pop === 'lauf') return alleLaufenden().length ? vLaufPop() : '';
  if (u.pop === 'legen') return vLegenPop();
  if (u.pop === 'ber') return vBerichtePop();
  if (u.pop === 'defekt') return vDefektePop();
  if (u.pop === 'wbs-status') return vWbsStatusPop();
  if (u.pop === 'wbs-neu') return vWbsNeuPop();
  if (u.pop === 'wbs-verwerfen') return vWbsVerwerfenPop();
  if (u.pop !== 'ich') return '';
  const ps = personen();
  const waehlbar = ps.filter(p => p.art === 'human' && p.aktiv);
  const nicht = ps.filter(p => p.art === 'agent' || !p.aktiv);
  return `<div class="pop" id="pop" data-for="t-ich" data-al="r" style="width:280px" role="menu"><h4>ICH BIN … <span class="mono">people:</span></h4>${u.ichNoetig ? '<div class="warnh">Für diese Aktion zuerst wählen, wer du bist.</div>' : ''}${waehlbar.map(p => `<div class="iz${p.kuerzel === S.ich ? ' an' : ''}" data-act="ich" data-arg="${esc(p.kuerzel)}" role="menuitem">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.kuerzel === S.ich ? 'gewählt' : ''}</span></div>`).join('')}${nicht.map(p => `<div class="iz aus" aria-disabled="true">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.aktiv === false ? 'stillgelegt' : 'Agent · nennt sich selbst'}</span></div>`).join('')}<div class="fuss">Die Wahl gilt nur für diesen Tab.</div></div>`;
}

/* ── Zeiten ── */
/* zeitMs, anteil, personenZeilen: web/zeiten.js */
const hm = ms => { const m = Math.max(0, Math.floor(ms / 6e4)); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
const hms = ms => { const s = Math.max(0, Math.floor(ms / 1e3)); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const laufende = a => a.zeiten.filter(z => !z.ende);
const alleLaufenden = () => S.aufgaben.filter(a => !a.archiviert).flatMap(a => laufende(a).map(z => ({ a, z })));

/* ── Karten ── */
const PAL = ['yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'magenta', 'violet', 'indigo', 'blue', 'sky', 'cyan', 'teal', 'green', 'lime', 'grey'];
const cv = farbe => !farbe ? '' : PAL.includes(farbe) ? `--c:var(--kd-c-${farbe});--cl:var(--kd-c-${farbe}-line)` : `--c:color-mix(in srgb,${farbe} 14%,#fff);--cl:${farbe}`;
const klasse = k => k && S.zustand.einstellungen && S.zustand.einstellungen.klassen.find(c => c.schluessel === k);
const aufgabe = nr => S.aufgaben.find(a => a.nummer === nr);
const isoD = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function quelleLink(x) {
  const q = S.herkunft[x];
  return q ? `vscode://file${q.datei}:${q.zeile}` : null;
}
/** Standardanwendung (sources.wbs/requirements) und Register zusammen — wie der Server zählt. */
function anwendungenZahl() {
  const q = (S.zustand && S.zustand.einstellungen && S.zustand.einstellungen.quellen) || {};
  return (q.wbs || q.anforderungen ? 1 : 0) + (q.anwendungen || []).length;
}
/** Ohne Kürzel bei mehreren Anwendungen: der Server liefert sie bewusst nicht (R00053). */
const mehrdeutig = x => !x.includes(':') && x !== 'thin air' && !S.herkunft[x] && anwendungenZahl() > 1;
function vHerkunftChip(x) {
  const q = S.herkunft[x], h = quelleLink(x);
  if (x === 'thin air') return `<span class="org leer" title="ohne Herkunft">thin air</span>`;
  if (mehrdeutig(x)) return `<span class="org mehrdeutig" title="mehrdeutig — mehrere Anwendungen registriert; mit Kürzel schreiben, z. B. kd:${esc(x)}">${esc(x)} · mehrdeutig</span>`;
  return h ? `<a class="org" href="${esc(h)}" title="${esc(q.name)}${q.status ? ' · ' + esc(q.status) : ''} — im Editor öffnen">${esc(x)}</a>` : `<span class="org" title="Quelle nicht gefunden — Pfade unter Einrichten prüfen">${esc(x)}</span>`;
}
/** Wirkungen einer Aufgabe auf die WBS als Chips + / ↻ / − mit Link zur Zeile in der WBS-Sicht (R00057). */
function vWirkungChip(w) {
  const c = wirkungChip(w);
  return `<a class="wchip ${esc(c.aktion)}" href="${esc(c.ziel)}" data-act="wbs-zu" data-arg="${esc(c.ziel)}" title="${esc(c.titel)}">${esc(c.text)}</a>`;
}
/** Feld `wbs-effects` im Aufgabenfenster: Chips mit ×, darunter das Formular einer neuen Wirkung. */
function vWirkungenFeld(a) {
  const register = (S.zustand.einstellungen.quellen.anwendungen || []), w = a.wirkungen || [];
  if (!register.length && !w.length) return '';
  const chips = w.map((x, j) => `<span class="ochip">${vWirkungChip(x)}<button data-act="wirkung-weg" data-arg="${j}" title="aus der Aufgabe entfernen — die WBS bleibt" aria-label="Wirkung ${esc(wirkungChip(x).text)} entfernen">×</button></span>`).join('');
  const knopf = register.length && !S.ui.wirkungNeu ? `<button class="lnk" data-act="wirkung-neu" title="Wirkung auf die WBS: anlegen, überarbeiten, verwerfen — sofort">+ Wirkung</button>` : '';
  return `<span class="k">wbs-effects</span><span class="w wrap" id="wirkungen">${chips}${knopf}</span>${S.ui.wirkungNeu ? vWirkungForm(register) : ''}`;
}
/** Formular einer neuen Wirkung — die Wirkung tritt mit „wirken“ sofort ein. */
function vWirkungForm(register) {
  const f = S.ui.wirkungNeu, wahl = (n, titel, werte) => `<span class="k">${titel}</span><span class="w"><select data-wf="${n}" id="wirkung-${n}" aria-label="${titel}">${werte.map(([v, t]) => `<option value="${esc(v)}"${v === f[n] ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></span>`;
  const feld = (n, titel, ph) => `<span class="k">${titel}</span><span class="w"><input class="mini-inp full" id="wirkung-${n}" data-wf="${n}" value="${esc(f[n])}" placeholder="${esc(ph)}" data-enter="wirkung-setzen" aria-label="${titel}"></span>`;
  const anlegen = f.action === 'create';
  const felder = wahl('action', 'Aktion', [['create', '+ anlegen'], ['rework', '↻ überarbeiten'], ['remove', '− verwerfen']]) + wahl('application', 'Anwendung', register.map(x => [x.kuerzel, `${x.kuerzel} · ${x.name}`]))
    + (anlegen ? feld('parent', 'Eltern', 'D0002') + wahl('level', 'Ebene', ['Dialog', 'Interaction', 'Feature', 'Bubble'].map(e => [e, e])) + feld('name', 'Name', 'was entsteht') + feld('done_criterion', 'Fertig', 'US-1') : feld('node', 'Knoten', 'D0002'));
  return `<div class="wirkung-form" role="group" aria-label="Neue Wirkung"><div class="felder">${felder}</div>${f.fehler ? `<div class="warnh" role="alert">${esc(f.fehler)}</div>` : ''}<div class="fuss"><span class="muted">${anlegen ? 'neuer Knoten rot mit der nächsten freien ID' : f.action === 'rework' ? 'Knoten und zählende Nachfahren rot' : 'Knoten und Nachfahren verworfen'} · sofort, ohne Commit im Arbeits-Repository</span><button class="btn" data-act="wirkung-zu">abbrechen</button><button class="btn btn-haupt" data-act="wirkung-setzen">wirken</button></div></div>`;
}
const vWirkungen = a => (a.wirkungen || []).length ? `<span class="wchips">${a.wirkungen.map(vWirkungChip).join('')}</span>` : '';
function vHerkunft(a) {
  const o = a.herkunft.length ? a.herkunft : ['thin air'];
  return `<span class="orgs">${o.map(vHerkunftChip).join('')}</span>`;
}
/** Aufgaben auf diesem Board, auf die `a` laut WBS (Braucht) wartet: nicht archiviert, nicht in der Abschlussspalte. */
function wartetAuf(a) {
  if (!S.board) return [];
  const letzte = S.board.spalten[S.board.spalten.length - 1];
  const braucht = a.herkunft.flatMap(x => (S.herkunft[x] && S.herkunft[x].braucht) || []);
  if (!braucht.length) return [];
  // qualifiziert vergleichen: I0005 und kd:I0005 sind derselbe Knoten, wenn kd die einzige Anwendung ist
  const kanon = h => (S.herkunft[h] && S.herkunft[h].schluessel) || h;
  return S.aufgaben.filter(t => t.nummer !== a.nummer && !t.archiviert && t.herkunft.some(h => braucht.includes(kanon(h)))
    && S.board.spalten.some(sp => sp !== letzte && sp.aufgaben.includes(t.nummer))).map(t => t.nummer);
}

function vKarte(a, fertig) {
  const cl = klasse(a.klasse);
  const tk = a.teilaufgaben.length ? `<span class="tk">☑ ${a.teilaufgaben.filter(t => t.erledigt).length}/${a.teilaufgaben.length}</span>` : '';
  const due = a.faellig ? `<span class="due${!fertig && a.faellig <= isoD(Date.now() + 864e5) ? ' warn' : ''}">${esc(a.faellig)}</span>` : '';
  const ext = S.extern[a.nummer];
  const rs = laufende(a), eigen = rs.some(z => z.wer === S.ich), erster = rs.map(z => zeitMs(z.beginn)).sort((x, y) => x - y)[0];
  const lz = rs.length ? `<span class="lauf${eigen ? ' eigen' : ''}" title="läuft: ${esc(rs.map(z => per(z.wer).name).join(', '))}">${rs.length > 1 ? rs.length + '× ' : ''}<span data-since="${erster}">${hm(Date.now() - erster)}</span></span>` : '';
  return `<div class="ka${fertig ? ' fertig' : ''}${ext ? ' fremd' : ''}${S.ui.offen === a.nummer ? ' offen' : ''}" draggable="true" data-id="${a.nummer}" data-act="oeffnen" data-arg="${a.nummer}" tabindex="0"${cl ? ` data-c="1" style="${cv(cl.farbe)}"` : ''}><div class="r1"><span class="id">#${a.nummer}</span>${vHerkunft(a)}${vWirkungen(a)}${a.labels.map(l => `<span class="lbl">${esc(l)}</span>`).join('')}${lz}</div>${S.ui.umbenennen === a.nummer ? `<input class="inp umbenennen" id="umbenennen" value="${esc(a.titel)}" data-enter="umbenennen-ok" data-arg="${a.nummer}" aria-label="Neuer Titel">` : `<div class="t" data-dbl="umbenennen" data-arg="${a.nummer}">${esc(a.titel)}</div>`}${fertig ? '' : vNaechsteTeilaufgabe(a)}${vKartenleiste(a)}<div class="r3"><span class="avs">${a.zustaendige.map(pk).join('')}</span>${cl ? `<span class="cls">${esc(cl.bezeichnung)}</span>` : ''}${tk}${due}</div>${(w => w.length ? `<div class="wartet" title="laut WBS (Braucht)">wartet auf ${w.map(n => '#' + n).join(', ')}</div>` : '')(fertig ? [] : wartetAuf(a))}${ext ? `<div class="ein" data-ext="${ext.at}" data-datei="${esc(ext.datei)}">extern · ${esc(ext.datei)} · vor ${Math.round((Date.now() - ext.at) / 1000)} Sek</div>` : ''}</div>`;
}

/** Die defekte Datei zu einer Aufgabennummer (über den Dateinamen). */
function defektZuNummer(nr) {
  return (S.zustand.defekte || []).find(d => d.pfad.startsWith('aufgaben/') && parseInt(d.pfad.slice(9), 10) === nr);
}
function vDefekt(nr, d) {
  return `<div class="ka defekt" data-id="${nr}" data-act="defekt-oeffnen" data-arg="${nr}" tabindex="0"><div class="r1"><span class="id">#${nr}</span><span class="lbl warn">nur lesbar</span></div><div class="t">#${nr} — Datei defekt</div><div class="r3 fehlertext">${esc(d.fehler)}</div></div>`;
}
function vDefektFenster() {
  const d = S.ui.defektDatei;
  if (!d) return '';
  return `<div class="mod-bg" data-act="schliessen-bg"><div class="mod" role="dialog" aria-label="Defekte Datei #${S.ui.offenDefekt}" style="--cl:var(--kd-warn)"><div class="mod-kopf"><span class="id">#${S.ui.offenDefekt}</span><span class="lbl warn">defekt · nur lesbar</span><span class="pfad">${esc(d.pfad)}</span><div class="rechts"><a class="btn btn-sym" href="vscode://file${esc(S.zustand.ordner)}/${esc(d.pfad)}" title="Im Editor reparieren">↗</a><button class="btn btn-sym" data-act="schliessen" aria-label="Schließen">✕</button></div></div><div class="archbar warnbar" role="alert">${esc(d.fehler)}</div><div class="mod-body voll"><div class="mod-main"><pre class="md" id="defekttext">${esc(d.text)}</pre></div></div><div class="mod-fuss"><span>Die Datei ist nur lesbar, bis sie im Editor repariert ist; danach erscheint die Aufgabe ohne Neuladen.</span></div></div></div>`;
}
const KUERZEL_BOARD = [['p', 'Zuständige setzen'], ['Rechtsklick · Menütaste · Umschalt + F10', 'Menü der Karte'], ['a · Entf', 'Karte archivieren'], ['1 … 9', 'Karte in Spalte 1 … 9'], ['c', 'Verweis „#n Titel“ kopieren'], ['t · Leertaste', 'eigenen Timer an / aus'], ['m · F2', 'mir zuweisen · umbenennen'], ['Strg + Z', 'letzte Bewegung / Anlage rückgängig'], ['← → ↑ ↓', 'Karte wählen'], ['Umschalt + ← →', 'Karte in die Nachbarspalte'], ['Umschalt + ↑ ↓', 'Karte in der Spalte verschieben'], ['Enter', 'Karte öffnen'], ['n', 'Neue Aufgabe in dieser Spalte (Dialog)'], ['Esc', 'Filter leeren'], ['/', 'Filter']];
const KUERZEL_FENSTER = [['↑ ↓', 'vorige / nächste Karte'], ['t', 'Timer an / aus'], ['m', 'mir zuweisen / mich abnehmen'], ['a', 'archivieren / zurückholen'], ['e', 'Titel bearbeiten'], ['b', 'Beschreibung bearbeiten'], ['Strg + Enter', 'Beschreibung speichern'], ['s', 'neue Teilaufgabe'], ['k', 'Kommentar schreiben'], ['d', 'Inhalt / Datei'], ['Esc', 'schließen']];
const KUERZEL_LISTE = [['↑ ↓', 'Zeile wählen'], ['Enter', 'Aufgabe öffnen'], ['n', 'Neue Aufgabe ohne Board'], ['a · Entf', 'archivieren / zurückholen'], ['c', 'Verweis kopieren'], ['Umschalt + F10', 'Menü der Zeile'], ['Ziehen', 'Zeile auf eine Spalte oder ins Archiv'], ['/', 'Filter']];
const KUERZEL_NEU = [['Enter (im Titel) · Strg + Enter', 'anlegen'], ['Umschalt + Strg + Enter', 'anlegen und weitere'], ['Enter (Teilaufgabe)', 'Teilaufgabe anfügen'], ['Esc', 'abbrechen']];
const KUERZEL_UEBERALL = [['g b', 'Board'], ['g a', 'Aufgaben'], ['g p', 'Personen'], ['g s', 'Stundenzettel'], ['g z', 'Zeiten nach Aufgabe und Person'], ['g v', 'Burndown'], ['g d', 'Durchlaufzeit'], ['g w', 'Wie lange noch'], ['g k', 'WBS der gebundenen Anwendung'], ['g e', 'Einrichten'], ['n', 'Neue Aufgabe'], ['b', 'Board wechseln'], ['i', 'Ich bin …'], ['Strg + Z', 'rückgängig (solange der Hinweis steht)'], ['?', 'diese Übersicht']];
function hilfeOrt() {
  if (S.ui.offen) return ['Aufgabenfenster', KUERZEL_FENSTER];
  if (S.ui.view === 'board') return ['Board', KUERZEL_BOARD];
  if (S.ui.view === 'aufgaben') return ['Aufgabenliste', KUERZEL_LISTE];
  return null;
}
function vHilfe() {
  const zeilen = liste => liste.map(([k, t]) => `<tr><td>${k.split(' ').map(x => x === '+' ? ' + ' : `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(t)}</td></tr>`).join('');
  const ort = hilfeOrt();
  return `<div class="mod-bg hilfe-bg" data-act="schliessen-hilfe"><div class="hilfe" role="dialog" aria-label="Tastaturkürzel">${ort ? `<h3>HIER: ${esc(ort[0].toUpperCase())}</h3><table>${zeilen(ort[1])}</table>` : ''}<h3>ÜBERALL</h3><table>${zeilen(KUERZEL_UEBERALL)}</table><h3>NEUE AUFGABE</h3><table>${zeilen(KUERZEL_NEU)}</table><p class="muted hilfe-quelle">Belegung nach gängiger Kanban-Konvention (Kanbanflow, Kanban Tool, Kanboard).</p></div></div>`;
}
/** Sichtbare Karten je Spalte des Boards — Grundlage der Tastaturziele. */
function sichtbareSpalten() {
  if (!S.board) return [];
  return [...document.querySelectorAll('.bahn[data-col]')].map(b => ({ name: b.dataset.col, karten: [...b.querySelectorAll('.ka[data-id]')].map(k => +k.dataset.id) }));
}

/* ── Kontextmenü ── */
function vMenueEintraege(eintraege, ebene, aktiv, pfad) {
  return eintraege.map((e, i) => {
    if (e.trenner) return '<div class="km-tr" role="separator"></div>';
    const p = pfad === '' ? String(i) : `${pfad}.${i}`;
    const unterOffen = ebene.unter && ebene.unter.von === i;
    return `<div class="km-e${i === ebene.index ? ' an' : ''}${e.aktuell ? ' km-aktuell' : ''}" role="menuitem" data-mp="${p}"${e.unter ? ' aria-haspopup="true"' : ''}${e.aktuell ? ' aria-disabled="true"' : ''}>${e.aktuell || e.haken ? '✓ ' : '<span class="km-ohne"></span>'}${esc(e.text)}<span class="km-k">${e.unter ? (e.kuerzel ? esc(e.kuerzel) + ' ▸' : '▸') : esc(e.kuerzel || '')}</span>${unterOffen ? `<div class="kmenue unter" role="menu">${vMenueEintraege(e.unter, ebene.unter, aktiv, p)}</div>` : ''}</div>`;
  }).join('');
}
function vMenue() {
  const m = S.ui.menue;
  if (!m) return '';
  return `<div class="kmenue" id="kmenue" role="menu" aria-label="${esc(m.titel)}" style="left:${m.x}px;top:${m.y}px"><div class="km-titel">${esc(m.titel)}</div>${vMenueEintraege(m.eintraege, m, true, '')}</div>`;
}

function vDefektePop() {
  const ds = S.zustand.defekte || [];
  return `<div class="pop" id="pop" data-for="t-defekt" data-al="l" style="width:520px" role="menu"><h4>DEFEKTE DATEIEN <span class="mono">${ds.length}</span></h4>${ds.map(d => `<div class="dz"><a class="mono" href="vscode://file${esc(S.zustand.ordner)}/${esc(d.pfad)}">${esc(d.pfad)}</a><span>${esc(d.fehler)}</span></div>`).join('')}<div class="fuss">Reparieren im Editor oder mit Git; kanbanD zeigt die Änderung sofort.</div></div>`;
}

/** Erste offene Teilaufgabe als nächster Schritt; das Kästchen hakt sie ab. */
function vNaechsteTeilaufgabe(a) {
  const i = a.teilaufgaben.findIndex(t => !t.erledigt);
  if (i < 0) return '';
  return `<div class="naechste" data-leiste="1"><button class="naechste-box" data-act="teil-karte" data-arg="${a.nummer}|${i}" role="checkbox" aria-checked="false" aria-label="${esc(a.teilaufgaben[i].text)} abhaken"></button><span>${esc(a.teilaufgaben[i].text)}</span></div>`;
}

/** Leiste beim Zeigen: eigener Timer, eigene Zuständigkeit. Klicks darin öffnen die Karte nicht. */
function vKartenleiste(a) {
  if (a.archiviert) return '';
  const meinerLaeuft = laufende(a).some(z => z.wer === S.ich), meine = a.zustaendige.includes(S.ich);
  return `<div class="kleiste" data-leiste="1">${meinerLaeuft ? `<button class="kl" data-act="stop" data-arg="${a.nummer}|${esc(S.ich)}" title="meinen Timer stoppen (t)" aria-label="Timer an #${a.nummer} stoppen">■</button>` : `<button class="kl" data-act="start" data-arg="${a.nummer}" title="meinen Timer starten (t)" aria-label="Timer an #${a.nummer} starten">▶</button>`}<button class="kl" data-act="mich" data-arg="${a.nummer}" title="${meine ? 'mich abnehmen' : 'mir zuweisen'} (m)" aria-label="${meine ? 'mich von' : 'mich zu'} #${a.nummer}">${meine ? '− mich' : '+ mich'}</button></div>`;
}

function vFehlt(nr) {
  return `<div class="ka fehlt" draggable="true" data-id="${nr}"><div class="r1"><span class="id">#${nr}</span></div><div class="t">#${nr} — Aufgabe fehlt</div><div class="r3">keine Datei unter aufgaben/</div></div>`;
}

/* ── Board ── */
function vLane(sp, i, alle) {
  const letzte = i === alle.length - 1;
  const archiv = imArchiv(), gefiltert = S.ui.filter.trim() !== '' && !(archiv && S.ui.filter.trim() === 'is:archived') || S.ui.bereich !== 'alle';
  const karten = sp.aufgaben.map(nr => { const a = aufgabe(nr); return a ? (!!a.archiviert === archiv && passt(a, S.ui.filter, umfeld()) ? vKarte(a, letzte) : '') : archiv || gefiltert ? '' : defektZuNummer(nr) ? vDefekt(nr, defektZuNummer(nr)) : vFehlt(nr); }).filter(Boolean);
  const archivZahl = letzte && !archiv ? archivierteDesBoards().length : 0;
  const ueber = sp.grenze && karten.length > sp.grenze;
  const boardLeer = i === 0 && !archiv && !gefiltert && S.board.spalten.every(s => !s.aufgaben.length);
  const leerText = boardLeer ? '<div class="leer hilfe-leer">Noch keine Karten.<br>Taste <kbd>n</kbd> oder „+“ im Spaltenkopf öffnet „Neue Aufgabe“ — eine eingefügte Liste legt mehrere an, Kürzel wie <span class="mono">@kürzel</span> oder <span class="mono">due:morgen</span> setzen Felder.</div>' : '';
  return `<section class="bahn" data-col="${esc(sp.name)}"><div class="bahn-kopf${ueber ? ' ueber' : ''}" tabindex="0" data-kopf="${i}" title="Rechtsklick: Menü der Spalte">${esc(sp.name)}${letzte ? ' <span class="ok" title="Abschlussspalte">✓</span>' : ''}${sp.grenze ? ` <span class="v"${ueber ? ' title="Grenze überschritten"' : ''}>Grenze ${sp.grenze}${ueber ? ' · überschritten' : ''}</span>` : ''}<span class="n">${karten.length}</span>${archiv ? '' : `<button class="kopf-plus" data-act="add" data-arg="${esc(sp.name)}" title="Neue Aufgabe in „${esc(sp.name)}“ (n)" aria-label="Neue Aufgabe in ${esc(sp.name)}">+</button>`}</div><div class="flaeche">${karten.join('') || leerText || `<div class="leer">${gefiltert ? 'keine Treffer' : 'leer'}</div>`}${archivZahl ? `<div class="nach"><a href="#" data-act="archiv-an">Archiv (${archivZahl})</a></div>` : ''}</div></section>`;
}
const archivierteDesBoards = () => S.board ? S.board.spalten.flatMap(sp => sp.aufgaben).filter(n => { const a = aufgabe(n); return a && a.archiviert; }) : [];
function vBoard() {
  const b = S.board;
  if (S.boardDefekt) return `<div class="defektflaeche" role="alert"><h2>boards/${esc(S.boardDefekt.slug)}.md ist defekt</h2><p>${esc(S.boardDefekt.fehler)}</p><p><a href="vscode://file${esc(S.zustand.ordner)}/boards/${esc(S.boardDefekt.slug)}.md">Im Editor reparieren</a> · andere Boards über den Boardnamen oben links.</p></div>`;
  if (!b) return `<div class="leer">Kein Board im Ordner <span class="mono">boards/</span>.</div>`;
  const leiste = imArchiv() ? `<div class="archbar">Archiv · ${archivierteDesBoards().length} Karten · Dateien bleiben im Ordner, Zeiten zählen in Berichten weiter<button class="lnk" data-act="archiv-aus">Archiv verlassen</button></div>` : '';
  return `${S.einstellungenDefekt ? `<div class="archbar warnbar" role="alert">kanbanD.md ist defekt — Personen und Klassen fehlen, bis die Datei repariert ist</div>` : ''}${leiste}<div class="bahnen">${b.spalten.map(vLane).join('')}</div>${vLegende()}`;
}
const imArchiv = () => archivGefiltert(S.ui.filter);
const umfeld = () => ({ ich: S.ich, bereich: S.ui.bereich, personen: personen() });
function vLegende() {
  const klassen = S.zustand.einstellungen.klassen;
  if (!klassen.length || !S.board) return '';
  const nummern = S.board.spalten.flatMap(sp => sp.aufgaben);
  const sichtbar = nummern.map(aufgabe).filter(a => a && !!a.archiviert === imArchiv() && passt(a, S.ui.filter, umfeld()));
  const jetzt = (filterWoerter(S.ui.filter).find(([k]) => k === 'class') || [])[1];
  const knopf = (k, text, n, stil) => `<button class="${jetzt === k ? 'an' : ''}" data-act="legende" data-arg="${esc(k)}" title="filtern: class:${esc(k)}"${stil}><span class="sw${k === 'none' ? ' leer' : ''}"></span>${esc(text)}<span class="n">${n}</span></button>`;
  return `<div class="leg" aria-label="Legende"><span class="tt">LEGENDE</span>${klassen.map(k => knopf(k.schluessel, k.bezeichnung, sichtbar.filter(a => a.klasse === k.schluessel).length, ` style="${cv(k.farbe)}"`)).join('')}${knopf('none', 'ohne Klasse', sichtbar.filter(a => !a.klasse).length, '')}<span class="rechts">Klick filtert · <span class="mono">class:</span></span></div>`;
}
function vHinweis() {
  const t = S.ui.hinweis;
  return t ? `<div class="toast" role="status">${esc(t.text)}${t.undo ? `<button class="lnk" data-act="rueckgaengig" title="Strg+Z">rückgängig</button>` : ''}</div>` : '';
}

/* ── Aufgabenliste (Artboard D0004) ── */
const liegtAuf = a => (S.boards || []).flatMap(b => b.spalten.filter(sp => sp.aufgaben.includes(a.nummer)).map(sp => ({ b, sp })));
function listenBereich(a, bereich) {
  if (bereich === 'archiv') return !!a.archiviert;
  if (bereich === 'ohne') return !a.archiviert && !liegtAuf(a).length;
  return true;
}
function vListenWerk() {
  const u = S.ui, zahl = b => S.aufgaben.filter(a => listenBereich(a, b)).length;
  return `<div class="kz-werk"><input class="inp" id="flt" placeholder="Filtern: Titel, #Nr, @wer, class:bug, origin:I0023, label:ui  ( / )" value="${esc(u.filter)}" aria-label="Filter"><span class="seg" role="radiogroup" aria-label="Aufgabenbereich">${[['alle', 'alle'], ['ohne', 'ohne Board'], ['archiv', 'archiviert']].map(([k, t]) => `<span class="${u.listBereich === k ? 'an' : ''}" data-act="list-bereich" data-arg="${k}" role="radio" aria-checked="${u.listBereich === k}">${t} <span class="mono">${zahl(k)}</span></span>`).join('')}</span></div>`;
}
function vAufgaben() {
  const u = S.ui, me = ichPerson();
  const zeilen = S.aufgaben.filter(a => listenBereich(a, u.listBereich) && passt(a, u.filter, { ich: S.ich, bereich: 'alle', personen: personen() })).map(a => {
    const cl = klasse(a.klasse), orte = liegtAuf(a);
    return `<tr class="${a.archiviert ? 'ruhe' : ''}" data-zeile="${a.nummer}" tabindex="0"${a.archiviert ? '' : ' draggable="true" title="Ziehen auf eine Spalte rechts oder ins Archiv"'}><td class="mono">#${a.nummer}</td><td class="tt"><a href="#" data-act="oeffnen" data-arg="${a.nummer}">${esc(a.titel)}</a>${a.archiviert ? ` <span class="lbl">archiviert ${esc(a.archiviert)}</span>` : ''}</td><td>${cl ? `<span class="cls" style="${cv(cl.farbe)}">${esc(cl.bezeichnung)}</span>` : a.klasse ? esc(a.klasse) : ''}</td><td><span class="avs">${a.zustaendige.map(pk).join('')}</span></td><td class="orte">${orte.length ? orte.map(({ b, sp }) => `<span class="lbl ort">${esc(b.titel)} · ${esc(sp.name)}<button class="lnk" data-act="abnehmen" data-arg="${esc(b.slug)}|${a.nummer}" title="von ${esc(b.titel)} nehmen" aria-label="#${a.nummer} von ${esc(b.titel)} nehmen">✕</button></span>`).join(' ') : '<span class="muted">auf keinem Board</span>'}</td><td>${a.archiviert ? `<button class="btn" data-act="zurueckholen" data-arg="${a.nummer}">zurückholen</button>` : `<button class="btn" id="leg-${a.nummer}" data-act="legen-pop" data-arg="${a.nummer}" aria-haspopup="true">auf Board legen ▾</button>`}</td></tr>`;
  }).join('');
  return `<div class="leiste"><b>Aufgaben</b><span class="muted">alle Dateien unter aufgaben/ · eine Aufgabe kann auf mehreren Boards liegen</span><div class="rechts"><button class="btn btn-haupt" data-act="add" data-arg="-" title="Neue Aufgabe ohne Board (n)">+ Neue Aufgabe</button></div></div>
<div class="body liste-mit-zielen"><table class="pt dicht liste"><thead><tr><th>#</th><th>Titel</th><th>Klasse</th><th>Zuständig</th><th>Liegt auf</th><th></th></tr></thead><tbody>${zeilen || '<tr><td colspan="6" class="muted">keine Aufgaben in diesem Bereich</td></tr>'}</tbody></table>${vZiele()}</div>`;
}
/** Ablageziele beim Ziehen aus der Liste: jede Spalte jedes Boards, dazu das Archiv. */
function vZiele() {
  const boards = (S.boards || []).map(b => `<div class="ziel-board"><b>${esc(b.titel)}</b>${b.spalten.map(sp => `<div class="ziel" data-ziel="${esc(b.slug)}|${esc(sp.name)}" aria-label="Ziel ${esc(b.titel)} · ${esc(sp.name)}">${esc(sp.name)}<span class="mono">${sp.aufgaben.length}</span></div>`).join('')}</div>`).join('');
  return `<aside class="ziele" aria-label="Ziehen auf"><h4>ZIEHEN AUF</h4>${boards}<div class="ziel ziel-archiv" data-ziel="archiv" aria-label="Ziel Archiv">Archiv</div></aside>`;
}
function vLegenPop() {
  const nr = S.ui.legenNr, a = aufgabe(nr);
  if (!a) return '';
  const frei = (S.boards || []).filter(b => !b.spalten.some(sp => sp.aufgaben.includes(nr)));
  return `<div class="pop" id="pop" data-for="leg-${nr}" data-al="r" style="width:300px" role="menu"><h4>#${nr} AUF BOARD LEGEN</h4>${frei.length ? frei.map(b => b.spalten.map(sp => `<div class="iz" data-act="legen" data-arg="${esc(b.slug)}|${nr}|${esc(sp.name)}" role="menuitem">${esc(b.titel)} · ${esc(sp.name)}</div>`).join('')).join('') : '<div class="fuss">liegt schon auf allen Boards</div>'}</div>`;
}

/* ── Personen (Artboard D0005) ── */
function vPersonen() {
  const u = S.ui, jetzt = Date.now(), W0 = 6, W1 = 20, t0 = tagesbeginn(jetzt);
  const pos = t => Math.max(0, Math.min(100, ((t - t0) / 36e5 - W0) / (W1 - W0) * 100));
  const alle = personen();
  const gezeigt = alle.filter(p => (u.stillAuch || p.aktiv) && (u.pBereich === 'alle' || (u.pBereich === 'm' ? p.art === 'human' : p.art === 'agent')));
  const zeilen = personenZeilen(S.aufgaben, gezeigt, S.board, jetzt);
  const G = ['LÄUFT JETZT', 'HEUTE AKTIV', 'HEUTE RUHIG'];
  let html = '';
  for (let g = 0; g < 3; g++) {
    const ds = zeilen.filter(d => d.gruppe === g);
    if (!ds.length) continue;
    html += `<tr class="grp"><td colspan="6">${G[g]} <span>· ${g === 0 ? ds.reduce((s, d) => s + d.laeuft.length, 0) + ' Timer' : ds.length + (ds.length === 1 ? ' Person' : ' Personen')}</span></td></tr>`;
    html += ds.map(d => {
      const k = d.person.kuerzel;
      const leiste = d.abschnitte.map(x => { const a = pos(x.von), b = pos(x.bis); return b > a ? `<i class="${x.laeuft ? 'l' : d.person.art === 'agent' ? 'a' : ''}" style="left:${a}%;width:${Math.max(0.5, b - a)}%" title="#${x.nummer}"></i>` : ''; }).join('');
      const gerade = d.laeuft.length ? `<div class="akt">${d.laeuft.map(x => `<div class="z"><span class="lauf${k === S.ich ? ' eigen' : ''}"><span data-since="${zeitMs(x.z.beginn)}">${hm(jetzt - zeitMs(x.z.beginn))}</span></span><a href="#" class="id" data-act="oeffnen" data-arg="${x.a.nummer}">#${x.a.nummer}</a><span class="t">${esc(x.a.titel)}</span><button class="btn stop${k === S.ich ? ' btn-haupt' : ''}" data-act="stop" data-arg="${x.a.nummer}|${esc(k)}" aria-label="Timer von ${esc(d.person.name)} stoppen">■</button></div>`).join('')}</div>`
        : `<span class="muted">${d.zuletzt ? 'zuletzt ' + (d.zuletzt >= t0 ? new Date(d.zuletzt).toTimeString().slice(0, 5) : isoD(d.zuletzt)) : '—'}</span>`;
      return `<tr class="${d.gruppe === 2 ? 'ruhe' : ''}" data-person="${esc(k)}"><td><a href="#" class="wer" data-act="person-filter" data-arg="${esc(k)}" title="Board auf @${esc(k)} filtern">${pk(k)}<span><b>${esc(d.person.name)}</b><small>${d.person.aktiv ? (k === S.ich ? 'ich' : d.person.art === 'agent' ? 'Agent' : '&nbsp;') : 'stillgelegt'}</small></span></a></td><td>${gerade}</td><td><div class="tagl">${leiste}<span class="jetzt" style="left:${pos(jetzt)}%"></span></div></td><td class="r num heute">${hm(d.heute)}</td><td class="r num muted">${hm(d.woche)}</td><td class="r"><span class="num">${d.offen}</span> <span class="muted" style="font-size:11px">· ${d.begonnen} begonnen</span></td></tr>`;
    }).join('');
  }
  const still = alle.filter(p => !p.aktiv).length;
  return `<div class="leiste"><span class="seg" role="radiogroup" aria-label="Personen">${[['alle', 'Menschen + Agenten'], ['m', 'nur Menschen'], ['a', 'nur Agenten']].map(([k, t]) => `<span class="${u.pBereich === k ? 'an' : ''}" data-act="p-bereich" data-arg="${k}" role="radio" aria-checked="${u.pBereich === k}">${t}</span>`).join('')}</span>${still ? `<label class="chk-s" data-act="still-auch"><i class="${u.stillAuch ? 'an' : ''}">${u.stillAuch ? '✓' : ''}</i>Stillgelegte einblenden (${still})</label>` : ''}<div class="rechts muted">Tagesleiste ${W0}–${W1} Uhr · schraffiert = läuft</div></div>
<div class="body"><table class="pt"><thead><tr><th style="width:190px">Person</th><th>Gerade</th><th><div class="skala">${[6, 8, 10, 12, 14, 16, 18, 20].map(h => `<span style="left:${(h - W0) / (W1 - W0) * 100}%">${h}</span>`).join('')}</div></th><th class="r">heute</th><th class="r">Woche</th><th class="r">zugewiesen offen</th></tr></thead><tbody>${html}</tbody></table></div>`;
}

/* ── Berichte (Artboard D0006) — lesen nur, korrigiert wird an der Aufgabe ── */
const SVG = { zettel: '<path d="M4 4h16v16H4zM4 9h16M9 4v16"></path>', kreuz: '<path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16"></path>', csv: '<path d="M12 4v11M8 11l4 4 4-4M4 19h16"></path>' };
function vBerichtePop() {
  const e = (href, svg, t, s, an) => `<a class="e${an ? ' an' : ''}" href="${href}" role="menuitem"${href.startsWith('/api') ? ' download' : ''}><svg class="i" viewBox="0 0 24 24">${svg}</svg><b>${t}</b><small>${s}</small></a>`;
  const v = S.ui.view;
  return `<div class="pop menue" id="pop" data-for="t-ber" data-al="l" style="width:330px" role="menu"><div class="k">ZEITEN</div>${e('#/berichte/stundenzettel', SVG.zettel, 'Stundenzettel', 'Eine Person, eine Woche: Aufgaben × Tage mit Summen.', v === 'berichte/stundenzettel')}${e('#/berichte/kreuz', SVG.kreuz, 'Zeiten nach Aufgabe und Person', 'Kreuztabelle über den Zeitraum, Summen in beide Richtungen.', v === 'berichte/kreuz')}<div class="k">VERLAUF</div>${e('#/berichte/verlauf', '<path d="M4 6l6 6 4-3 6 9M4 20h16"></path>', 'Burndown', 'Offene Aufgaben je Tag im gewählten Zeitraum – aus der Git-Geschichte dieses Boards.', v === 'berichte/verlauf')}${e('#/berichte/prognose', '<path d="M4 20h16M4 6l5 5 4-2 4 6M17 15l3-6"></path>', 'Wie lange noch', 'Monte-Carlo-Prognose je Spalte aus dem Durchsatz dieses Boards – rechnet live mit.', v === 'berichte/prognose')}${e('#/berichte/durchlauf', '<path d="M4 20h16M4 20V4M8 15h.01M11 11h.01M14 13h.01M17 7h.01"></path>', 'Durchlaufzeit', 'Wie lange Aufgaben von einer Spalte bis zu einer anderen brauchen – Lead und Cycle Time.', v === 'berichte/durchlauf')}<div class="k">AUSLEITEN</div>${e('/api/berichte/zeiten.csv', SVG.csv, 'Export als CSV', 'Eine Zeile je Zeiteintrag: Aufgabe, Person, Art, Beginn, Ende, Dauer, Herkunft.')}</div>`;
}
/** Gemeinsame Filterleiste aller Berichte (R00043); `teile`: zeitraum, spalten, personen ('zeit' | 'zustaendig'). */
function vBerichtsfilter(teile) {
  const f = S.ui.bf, jetzt = Date.now();
  const chip = (act, arg, an, inhalt, titel) => `<button class="bf-chip${an ? ' an' : ''}" data-act="${act}" data-arg="${esc(arg)}" aria-pressed="${an}" title="${esc(titel)}">${inhalt}</button>`;
  const gruppe = (k, chips) => chips ? `<span class="bf-gruppe"><span class="bf-k">${k}</span>${chips}</span>` : '';
  let zr = '';
  if (teile.zeitraum) {
    const g = zeitraumGrenzen(f, jetzt);
    const von = f.zeitraum === 'eigen' ? f.von : g.von ? isoD(g.von) : '';
    const bis = f.zeitraum === 'eigen' ? f.bis : g.bis !== Infinity ? isoD(g.bis - 864e5) : '';
    zr = `<span class="bf-gruppe"><span class="bf-k">${teile.zeitraumTitel || 'Zeitraum'}</span><select class="mini-inp" data-bf="zeitraum" aria-label="Zeitraum">${ZEITRAEUME.map(([k, t]) => `<option value="${k}"${k === f.zeitraum ? ' selected' : ''}>${t}</option>`).join('')}</select><input type="date" class="mini-inp" data-bf="von" value="${esc(von)}" aria-label="Zeitraum von"><span class="muted">–</span><input type="date" class="mini-inp" data-bf="bis" value="${esc(bis)}" aria-label="Zeitraum bis"></span>`;
  }
  const klassen = S.zustand.einstellungen.klassen;
  const farben = klassen.map(k => chip('bf-farbe', k.schluessel, !f.ohneFarben.includes(k.schluessel), `<i class="bf-farbe" style="${cv(k.farbe)}"></i>${esc(k.bezeichnung)}`, f.ohneFarben.includes(k.schluessel) ? 'ausgeschlossen — Klick nimmt wieder auf' : 'Klick schließt aus')).join('')
    + chip('bf-farbe', '', !f.ohneFarben.includes(''), '<i class="bf-farbe"></i>ohne Klasse', 'Aufgaben ohne Klasse');
  const spalten = teile.spalten && S.board ? S.board.spalten.map(sp => chip('bf-spalte', sp.name, !f.ohneSpalten.includes(sp.name), esc(sp.name), f.ohneSpalten.includes(sp.name) ? 'ausgeschlossen — Klick nimmt wieder auf' : 'Klick schließt aus')).join('') : '';
  const personenListe = personen().filter(p => p.aktiv || f.personen.includes(p.kuerzel));
  const leute = teile.personen ? personenListe.map(p => chip('bf-person', p.kuerzel, f.personen.includes(p.kuerzel), `${pk(p.kuerzel)}${esc(p.name)}`, teile.personen === 'zeit' ? 'nur Zeiten dieser Person' : 'nur Aufgaben, für die die Person zuständig ist')).join('') : '';
  const alleLabels = [...new Set(S.aufgaben.flatMap(a => a.labels))].sort();
  const labels = alleLabels.map(l => chip('bf-label', l, f.labels.includes(l), esc(l), 'nur Aufgaben mit diesem Label')).join('');
  const n = filterAnzahl(teile.zeitraum ? f : { ...f, zeitraum: 'alles' });
  return `<div class="bfilter" role="group" aria-label="Berichtsfilter">${zr}${gruppe('Farben', farben)}${gruppe('Spalten', spalten)}${gruppe(teile.personen === 'zeit' ? 'Zeit von' : 'Zuständig', leute)}${gruppe('Labels', labels)}${n ? `<button class="btn bf-leeren" data-act="bf-leeren" title="alle Berichtsfilter aufheben">Zurücksetzen <span class="mono">${n}</span></button>` : ''}</div>`;
}
const csvKnopf = '<a class="btn" href="/api/berichte/zeiten.csv" download>CSV</a>';
function vStundenzettel() {
  const u = S.ui, jetzt = Date.now();
  const w0 = (() => { const d = new Date(wochenbeginn(jetzt)); d.setDate(d.getDate() + 7 * (u.wochenVersatz || 0)); return d.getTime(); })();
  const wer = u.sp || S.ich || (personen().find(p => p.aktiv) || {}).kuerzel;
  const s = stundenzettel(S.aufgaben.filter(a => aufgabePasst({ ...u.bf, personen: [] }, a)), wer, w0, jetzt), namen = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], heute = tagesbeginn(jetzt);
  const zelle = ms => ms ? hm(ms) : '<span class="muted">·</span>';
  return `<div class="leiste"><b>Stundenzettel</b><span class="seg" role="radiogroup" aria-label="Person">${personen().filter(p => p.aktiv).map(p => `<span class="${p.kuerzel === wer ? 'an' : ''}" data-act="sp" data-arg="${esc(p.kuerzel)}" role="radio" aria-checked="${p.kuerzel === wer}">${esc(p.name)}</span>`).join('')}</span><button class="btn btn-sym" data-act="woche" data-arg="-1" aria-label="vorige Woche">‹</button><span class="mono muted" id="woche">${isoD(s.tage[0])} – ${isoD(s.tage[6])}</span><button class="btn btn-sym" data-act="woche" data-arg="1" aria-label="nächste Woche">›</button><span class="muted" style="font-size:12px">liest nur · Klick auf eine Zeile öffnet die Aufgabe zum Korrigieren</span><div class="rechts">${csvKnopf}</div></div>${vBerichtsfilter({})}
<div class="body"><table class="pt dicht" id="stundenzettel"><thead><tr><th>Aufgabe</th>${s.tage.map((t, i) => `<th class="r"${t === heute ? ' style="color:var(--kd-accent-ink)"' : ''}>${namen[i]} <span class="mono">${isoD(t).slice(8)}</span></th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${s.zeilen.map(z => `<tr class="klick" data-act="oeffnen" data-arg="${z.aufgabe.nummer}"><td class="tt"><span class="mono muted">#${z.aufgabe.nummer}</span> ${esc(z.aufgabe.titel)}</td>${z.proTag.map(ms => `<td class="r num">${zelle(ms)}</td>`).join('')}<td class="r num"><b>${hm(z.summe)}</b></td></tr>`).join('') || `<tr><td class="muted" colspan="9">${esc(per(wer || '').name)} hat in dieser Woche keine Zeiten.</td></tr>`}<tr class="grp"><td>SUMME</td>${s.jeTag.map(ms => `<td class="r">${hm(ms)}</td>`).join('')}<td class="r" id="zettelsumme">${hm(s.summe)}</td></tr></tbody></table></div>`;
}
function vKreuz() {
  const jetzt = Date.now(), g = zeitraumGrenzen(S.ui.bf, jetzt);
  const k = kreuztabelle(zeitenGefiltert(S.aufgaben, S.ui.bf), g.von, jetzt, g.bis);
  const zelle = ms => ms ? hm(ms) : '<span class="muted">—</span>';
  return `<div class="leiste"><b>Zeiten nach Aufgabe und Person</b><span class="muted" style="font-size:12px">liest nur · korrigiert wird an der Aufgabe</span><div class="rechts">${csvKnopf}</div></div>${vBerichtsfilter({ zeitraum: true, personen: 'zeit' })}
<div class="body"><table class="pt dicht" id="kreuz"><thead><tr><th>Aufgabe</th>${k.personen.map(p => `<th class="r">${pk(p)} ${esc(per(p).name)}</th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${k.zeilen.map(z => `<tr class="klick" data-act="oeffnen" data-arg="${z.aufgabe.nummer}"><td class="tt"><span class="mono muted">#${z.aufgabe.nummer}</span> ${esc(z.aufgabe.titel)}</td>${z.jePerson.map(ms => `<td class="r num">${zelle(ms)}</td>`).join('')}<td class="r num"><b>${hm(z.summe)}</b></td></tr>`).join('') || '<tr><td class="muted">Keine Zeiten im Zeitraum.</td></tr>'}<tr class="grp"><td>SUMME</td>${k.jeSpalte.map(ms => `<td class="r">${hm(ms)}</td>`).join('')}<td class="r">${hm(k.summe)}</td></tr></tbody></table></div>`;
}

/* Burndown: eine Serie (offen) in der Akzentfarbe, Umfang als neutrale Bezugslinie. */
const zahl1 = x => x == null ? '—' : x.toFixed(1).replace('.', ',');
function vVerlauf() {
  if (!S.bew) return '<div class="leer">lädt …</div>';
  const t = burndown(S.bew, S.ui.bf, aufgabe, Date.now()), B = 800;
  S.bdTage = t;
  const H = 260, L = 36, R = 96, O = 16, U = 28;
  const max = Math.max(1, ...t.map(x => x.umfang));
  const sx = i => L + (t.length < 2 ? (B - L - R) / 2 : i * (B - L - R) / (t.length - 1));
  const sy = y => O + (H - O - U) * (1 - y / max);
  const linie = k => t.map((x, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(x[k]).toFixed(1)}`).join('');
  const schritt = Math.max(1, Math.ceil(max / 4));
  const ticks = []; for (let y = 0; y <= max; y += schritt) ticks.push(y);
  const xTicks = t.map((x, i) => ({ x, i })).filter(({ i }) => t.length <= 8 || i % Math.ceil(t.length / 8) === 0 || i === t.length - 1);
  const letzte = t[t.length - 1];
  const svg = t.length ? `<svg class="diagramm" viewBox="0 0 ${B} ${H}" role="img" aria-label="Offene Aufgaben je Tag">
${ticks.map(y => `<line class="gitter" x1="${L}" x2="${B - R}" y1="${sy(y)}" y2="${sy(y)}"></line><text class="achse" x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`).join('')}
${xTicks.map(({ x, i }) => `<text class="achse" x="${sx(i)}" y="${H - 8}" text-anchor="middle">${x.datum.slice(8)}.${x.datum.slice(5, 7)}.</text>`).join('')}
<path class="umfang" d="${linie('umfang')}"></path><path class="offen" d="${linie('offen')}"></path>
<circle class="punkt" cx="${sx(t.length - 1)}" cy="${sy(letzte.offen)}" r="4"></circle>
<text class="endwert" x="${sx(t.length - 1) + 10}" y="${sy(letzte.offen) + 4}">offen ${letzte.offen}</text>
<text class="endwert leise" x="${sx(t.length - 1) + 10}" y="${sy(letzte.umfang) + (letzte.umfang === letzte.offen ? 18 : 4)}">Umfang ${letzte.umfang}</text>
<line class="fadenkreuz" id="fadenkreuz" y1="${O}" y2="${H - U}" x1="-10" x2="-10"></line>
${t.map((x, i) => `<rect class="treffer" x="${sx(i) - (B - L - R) / Math.max(1, t.length - 1) / 2}" y="${O}" width="${(B - L - R) / Math.max(1, t.length - 1)}" height="${H - O - U}" data-tag="${i}"></rect>`).join('')}
</svg>` : `<div class="leer">${S.bew.aufgaben.length ? 'Keine Aufgabe im Zeitraum.' : 'Noch kein Stand dieses Boards.'}</div>`;
  const legende = `<div class="dlegende"><span><i class="k-offen"></i>offen</span><span><i class="k-umfang"></i>Umfang (gezählte Aufgaben auf dem Board)</span></div>`;
  const tabelle = `<details class="tabellenansicht"><summary>Tabellenansicht</summary><table class="pt dicht"><thead><tr><th>Tag</th><th class="r">offen</th><th class="r">Umfang</th></tr></thead><tbody>${t.map(x => `<tr><td class="mono">${x.datum}</td><td class="r num">${x.offen}</td><td class="r num">${x.umfang}</td></tr>`).join('')}</tbody></table></details>`;
  return `<div class="leiste"><b>Burndown</b><span class="muted">${esc(S.board ? S.board.titel : '')} · aus den Commits von boards/${esc(S.ui.slug || '')}.md · offen = nicht in der Abschlussspalte</span></div>${vBerichtsfilter({ zeitraum: true, spalten: true, personen: 'zustaendig' })}
<div class="body bericht"><h3 class="dtitel">Offene Aufgaben je Tag</h3>${legende}<div class="dflaeche">${svg}<div class="tooltip" id="tooltip" hidden></div></div>${tabelle}</div>`;
}

/* Durchlaufzeit (R00045): Streudiagramm Ankunft × Tage, Median und 85 % als Bezugslinien. */
function vDurchlauf() {
  if (!S.bew) return '<div class="leer">lädt …</div>';
  const sp = S.bew.spalten, u = S.ui;
  const von = sp.includes(u.dlVon) ? u.dlVon : sp[0], bis = sp.includes(u.dlBis) ? u.dlBis : sp[sp.length - 1];
  const d = durchlaufzeiten(S.bew, u.bf, aufgabe, Date.now(), von, bis);
  const wahl = (k, wert, titel) => `<label class="dl-wahl">${titel} <select class="mini-inp" data-dl="${k}" aria-label="${titel} Spalte">${sp.map(s => `<option${s === wert ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`;
  const kopf = `<div class="leiste"><b>Durchlaufzeit</b>${wahl('dlVon', von, 'von')}${wahl('dlBis', bis, 'bis')}<span class="muted">${esc(S.board ? S.board.titel : '')} · erstes Erreichen der Spalte oder einer rechts davon · aus den Commits von boards/${esc(u.slug || '')}.md</span></div>${vBerichtsfilter({ zeitraum: true, personen: 'zustaendig' })}`;
  if (!d.gueltig) return `${kopf}<div class="body bericht"><div class="leer">„von“ muss links von „bis“ liegen.</div></div>`;
  const B = 800, H = 280, L = 40, R = 110, O = 16, U = 28, l = d.liste;
  const t0 = Math.min(...l.map(x => x.ankunft)), t1 = Math.max(...l.map(x => x.ankunft));
  const ymax = Math.max(1, ...l.map(x => x.tage)) * 1.1;
  const sx = t => L + (t1 === t0 ? (B - L - R) / 2 : (t - t0) / (t1 - t0) * (B - L - R)), sy = y => O + (H - O - U) * (1 - y / ymax);
  const schritt = Math.max(1, Math.ceil(ymax / 4)), ticks = [];
  for (let y = 0; y <= ymax; y += schritt) ticks.push(y);
  const datum = ms => { const x = new Date(ms); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.`; };
  const xt = t1 === t0 ? [t0] : [0, 1, 2, 3, 4].map(i => t0 + (t1 - t0) * i / 4);
  const bezug = (wert, cls, text) => `<line class="${cls}" x1="${L}" x2="${B - R}" y1="${sy(wert)}" y2="${sy(wert)}"></line><text class="endwert leise" x="${B - R + 8}" y="${sy(wert) + 4}">${text} ${zahl1(wert)} T</text>`;
  const svg = l.length ? `<svg class="diagramm streu" viewBox="0 0 ${B} ${H}" role="img" aria-label="Durchlaufzeit je Aufgabe nach Ankunftstag">
${ticks.map(y => `<line class="gitter" x1="${L}" x2="${B - R}" y1="${sy(y)}" y2="${sy(y)}"></line><text class="achse" x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`).join('')}
${xt.map(t => `<text class="achse" x="${sx(t)}" y="${H - 8}" text-anchor="middle">${datum(t)}</text>`).join('')}
${bezug(d.p85, 'p85', '85 %')}${bezug(d.median, 'median', 'Median')}
${l.map(x => { const a = aufgabe(x.nummer); return `<circle class="punkt klick" cx="${sx(x.ankunft).toFixed(1)}" cy="${sy(x.tage).toFixed(1)}" r="5" data-act="oeffnen" data-arg="${x.nummer}"><title>#${x.nummer} ${esc(a ? a.titel : '')} · ${zahl1(x.tage)} Tage · angekommen ${datum(x.ankunft)}</title></circle>`; }).join('')}
</svg>` : '<div class="leer">Keine Aufgabe hat im Zeitraum „bis“ erreicht.</div>';
  const fmt = ms => { const x = new Date(ms), p = n => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`; };
  const kennzahlen = `<div class="kennzahlen" id="durchlauf-kennzahl"><span><b>${d.anzahl}</b> Aufgaben</span><span>Mittel <b>${zahl1(d.mittel)}</b> T</span><span>Median <b>${zahl1(d.median)}</b> T</span><span>85 % in <b>${zahl1(d.p85)}</b> T oder weniger</span></div>`;
  const tabelle = `<table class="pt dicht" id="durchlauf"><thead><tr><th>Aufgabe</th><th>in „${esc(von)}“</th><th>in „${esc(bis)}“</th><th class="r">Tage</th></tr></thead><tbody>${l.map(x => { const a = aufgabe(x.nummer); return `<tr class="klick" data-act="oeffnen" data-arg="${x.nummer}"><td class="tt"><span class="mono muted">#${x.nummer}</span> ${esc(a ? a.titel : '')}</td><td class="mono">${fmt(x.eintritt)}</td><td class="mono">${fmt(x.ankunft)}</td><td class="r num">${zahl1(x.tage)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>`;
  const legende = '<div class="dlegende"><span><i class="k-punkt"></i>eine Aufgabe</span><span><i class="k-median"></i>Median</span><span><i class="k-p85"></i>85 %</span></div>';
  return `${kopf}<div class="body bericht">${kennzahlen}<h3 class="dtitel">Tage je Aufgabe nach Ankunft in „${esc(bis)}“</h3>${legende}<div class="dflaeche">${svg}</div><h3 class="dtitel">Aufgaben</h3>${tabelle}</div>`;
}

/* Wie lange noch (R00046): je Spalte noch nicht erreicht, Monte-Carlo-Fächer, Blöcke mit Perzentilen.
   Serienfarben: Slots 1–3 der validierten dataviz-Palette, feste Reihenfolge von links nach rechts. */
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const deDatum = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${WOCHENTAG[d.getDay()]} ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; };
const kurzDatum = ms => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };
/* Termine (R00047): Darstellung einer Linie aus Farbe, Art und Stärke */
const TERMIN_STAERKE = { fein: 1.25, normal: 2, fett: 4 };
const TERMIN_ART = { durchgehend: '', gestrichelt: '9 6', gepunktet: '1.5 5' };
const terminFarbe = f => PAL.includes(f) ? `var(--kd-c-${f}-line)` : f;
const terminStil = t => `stroke:${terminFarbe(t.farbe)};stroke-width:${TERMIN_STAERKE[t.staerke] || 2};stroke-dasharray:${TERMIN_ART[t.linie] || ''}`;
const prozent = x => Math.round(x * 100) + ' %';
function chanceText(c) {
  if (c.art === 'vorbei') return 'vorbei';
  if (c.art === 'erreicht') return 'erreicht';
  if (c.art === 'ungemessen') return 'keine Aussage';
  return `${prozent(c.p7)} · ${prozent(c.p5)} in der 5-Tage-Woche`;
}
function vTermine(p) {
  const u = S.ui, termine = (S.board && S.board.termine) || [], f = u.tf;
  const fertig = p.phasen[p.phasen.length - 1];
  const zeilen = termine.map((t, i) => `<tr data-termin="${esc(t.name)}"><td><svg class="tm-vorschau" viewBox="0 0 44 10" aria-hidden="true"><line x1="2" x2="42" y1="5" y2="5" style="${terminStil(t)}"></line></svg></td><td>${esc(t.name)}</td><td class="mono">${deDatum(isoTag(t.datum))}</td><td>${fertig ? esc(chanceText(terminChance(fertig, t.datum, Date.now()))) : '—'}</td><td class="r"><button class="btn btn-sym" data-act="tf-bearbeiten" data-arg="${i}" aria-label="Termin ${esc(t.name)} ändern" title="ändern">✎</button><button class="btn btn-sym" data-act="tf-entfernen" data-arg="${i}" aria-label="Termin ${esc(t.name)} entfernen" title="entfernen">✕</button></td></tr>`).join('');
  const wahl = (feld, werte, titel) => `<select class="mini-inp" data-tf="${feld}" aria-label="${titel}">${werte.map(([k, t]) => `<option value="${k}"${f[feld] === k ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const FARBNAMEN = { yellow: 'gelb', amber: 'bernstein', orange: 'orange', red: 'rot', rose: 'rosé', pink: 'pink', magenta: 'magenta', violet: 'violett', indigo: 'indigo', blue: 'blau', sky: 'himmelblau', cyan: 'cyan', teal: 'petrol', green: 'grün', lime: 'limette', grey: 'grau' };
  const farben = PAL.map(x => [x, FARBNAMEN[x] || x]);
  if (f.farbe.startsWith('#')) farben.push([f.farbe, f.farbe]);
  const formular = `<div class="tm-form" role="group" aria-label="${f.i == null ? 'Neuer Termin' : 'Termin ändern'}"><input class="mini-inp" data-tf="name" value="${esc(f.name)}" placeholder="Name, z. B. Deadline" aria-label="Name des Termins"><input type="date" class="mini-inp" data-tf="datum" value="${esc(f.datum)}" aria-label="Datum des Termins">${wahl('farbe', farben, 'Farbe des Termins')}<input class="mini-inp tm-hex" data-tf="hex" value="${f.farbe.startsWith('#') ? esc(f.farbe) : ''}" placeholder="#rrggbb" aria-label="Eigene Farbe des Termins">${wahl('linie', [['durchgehend', 'durchgehend'], ['gestrichelt', 'gestrichelt'], ['gepunktet', 'gepunktet']], 'Linie des Termins')}${wahl('staerke', [['fein', 'fein'], ['normal', 'normal'], ['fett', 'fett']], 'Stärke des Termins')}<svg class="tm-vorschau" viewBox="0 0 44 10" aria-label="Vorschau"><line x1="2" x2="42" y1="5" y2="5" style="${terminStil(f)}"></line></svg><button class="btn btn-haupt" data-act="tf-speichern">${f.i == null ? 'Termin anlegen' : 'Übernehmen'}</button>${f.i == null ? '' : '<button class="btn" data-act="tf-abbrechen">Abbrechen</button>'}${u.tfFehler ? `<span class="fehl" role="alert">${esc(u.tfFehler)}</span>` : ''}</div>`;
  return `<section class="wl-termine"><h3 class="dtitel">Termine <span class="muted">· stehen in boards/${esc(u.slug || '')}.md, für alle sichtbar</span></h3>${termine.length ? `<table class="pt dicht" id="termine"><thead><tr><th>Linie</th><th>Name</th><th>Datum</th><th>Chance „${esc(fertig ? fertig.spalte : '')}“</th><th></th></tr></thead><tbody>${zeilen}</tbody></table>` : '<p class="muted">Noch keine Termine — etwa eine Deadline als fette rote Linie.</p>'}${formular}</section>`;
}
function vPrognose() {
  if (!S.bew) return '<div class="leer">lädt …</div>';
  const jetzt = Date.now(), p = prognose(S.bew, S.ui.bf, aufgabe, jetzt), u = S.ui;
  const stand = new Date(jetzt).toTimeString().slice(0, 8);
  const kopf = `<div class="leiste"><b>Wie lange noch</b><span class="muted">${esc(S.board ? S.board.titel : '')} · Stand ${deDatum(jetzt)} ${stand} · <span class="live-punkt" title="rechnet neu, sobald sich das Board ändert"></span>live</span></div>${vBerichtsfilter({ zeitraum: true, zeitraumTitel: 'Messbasis', spalten: true, personen: 'zustaendig' })}`;
  if (!p.phasen.length) return `${kopf}<div class="body bericht"><div class="leer">Es braucht mindestens zwei gezählte Spalten.</div></div>`;
  const fertig = p.phasen[p.phasen.length - 1];
  const zahlen = `<p class="wl-kopf" id="wl-kopf"><strong>${fertig.erreicht} von ${p.umfang} fertig</strong>${p.phasen.slice(0, -1).map(ph => ` · „${esc(ph.spalte)}“ ${ph.erreicht} von ${p.umfang} erreicht`).join('')}</p>`;
  // Diagramm: höchstens drei Serien, die rechten Spalten (nahe „fertig“)
  const serien = p.phasen.slice(-3).map((ph, i) => ({ ph, k: 'wl-s' + (i + 1) }));
  const W = 960, H = 400, L = 48, R = 24, O = 24, U = 40, pw = W - L - R, ph_ = H - O - U;
  const t0 = p.tage.length ? p.tage[0].t : p.heute;
  const enden = serien.flatMap(s => s.ph.zeilen ? [s.ph.zeilen[3].datum7] : []);
  const termine = (S.board && S.board.termine) || [];
  const terminTage = termine.map(t => isoTag(t.datum)).filter(t => t >= t0);
  const t1 = Math.min(Math.max(p.heute + 864e5, ...enden, ...terminTage) + 864e5, p.heute + 3 * 366 * 864e5);
  const ymax = Math.max(1, ...p.tage.map(x => x.umfang), p.umfang);
  const x = t => L + pw * (t - t0) / Math.max(t1 - t0, 1), y = v => O + ph_ * (1 - v / ymax);
  const schritt = Math.max(1, Math.ceil(ymax / 5)), yt = [];
  for (let v = 0; v <= ymax; v += schritt) yt.push(v);
  const xn = 8, xt = [...Array(xn + 1)].map((_, i) => t0 + (t1 - t0) * i / xn);
  const pfad = werte => werte.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
  let faecher = '', linien = '', marken = '';
  serien.forEach((s, si) => {
    const pts = p.tage.map(d => [d.t, d.offen[s.ph.spalte]]);
    linien += `<path class="wl-offen ${s.k}" d="${pfad(pts)}"></path>`;
    marken += `<circle class="wl-mk ${s.k}" cx="${x(p.heute).toFixed(1)}" cy="${y(s.ph.offen).toFixed(1)}" r="4"></circle>`;
    if (!s.ph.zeilen) return;
    const z = Object.fromEntries(s.ph.zeilen.map(r => [r.p, r]));
    const x0 = x(p.heute), y0 = y(s.ph.offen), y1 = y(0);
    faecher += `<polygon class="wl-band ${s.k}" points="${x0.toFixed(1)},${y0.toFixed(1)} ${x(z[50].datum7).toFixed(1)},${y1} ${x(z[95].datum7).toFixed(1)},${y1}"></polygon>`;
    [[50, 'wl-p50'], [85, 'wl-p85'], [95, 'wl-p95']].forEach(([q, cls], stufe) => {
      const xe = x(z[q].datum7);
      faecher += `<line class="${cls} ${s.k}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${xe.toFixed(1)}" y2="${y1}"></line><text class="wl-lbl" x="${xe.toFixed(1)}" y="${(y1 - 8 - 13 * stufe - 42 * si).toFixed(1)}" text-anchor="middle">${esc(s.ph.spalte.slice(0, 10))} P${q} ${kurzDatum(z[q].datum7)}</text>`;
    });
  });
  const tip = d => [kurzDatum(d.t) + (d.t === p.heute ? ' (heute)' : ''), 'Umfang ' + d.umfang, ...p.phasen.map(ph => `noch nicht in „${ph.spalte}“: ${d.offen[ph.spalte]}`)].map(esc).join('|');
  const breite = pw * 864e5 / Math.max(t1 - t0, 1);
  const svg = `<svg class="diagramm wl" viewBox="0 0 ${W} ${H}" role="img" aria-label="Noch nicht erreichte Aufgaben je Spalte mit Prognose">
${yt.map(v => `<line class="gitter" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"></line><text class="achse" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
${xt.map(t => `<text class="achse" x="${x(t).toFixed(1)}" y="${H - U + 18}" text-anchor="middle">${kurzDatum(t)}</text>`).join('')}
<path class="umfang" d="${pfad(p.tage.map(d => [d.t, d.umfang]))}"></path>
${faecher}${linien}${marken}
<line class="wl-heute" x1="${x(p.heute)}" x2="${x(p.heute)}" y1="${O}" y2="${H - U}"></line><text class="wl-lbl" x="${x(p.heute) + 4}" y="${O + 10}">heute</text>
${termine.filter(t => isoTag(t.datum) >= t0 && isoTag(t.datum) <= t1).map((t, i) => { const xt = x(isoTag(t.datum)), rechts = xt > W - R - 140; return `<g class="wl-termin" data-termin="${esc(t.name)}"><line x1="${xt.toFixed(1)}" x2="${xt.toFixed(1)}" y1="${O}" y2="${H - U}" style="${terminStil(t)}"></line><text class="wl-tlbl" x="${(xt + (rechts ? -5 : 5)).toFixed(1)}" y="${O + 26 + 14 * (i % 4)}" text-anchor="${rechts ? 'end' : 'start'}">${esc(t.name)} ${kurzDatum(isoTag(t.datum))}</text></g>`; }).join('')}
<line class="fadenkreuz" id="fadenkreuz" y1="${O}" y2="${H - U}" x1="-10" x2="-10"></line>
${p.tage.map((d, i) => `<rect class="treffer" x="${(x(d.t) - breite / 2).toFixed(1)}" y="${O}" width="${breite.toFixed(1)}" height="${ph_}" data-tag="${i}" data-tip="${tip(d)}"></rect>`).join('')}
</svg>`;
  const legende = `<div class="dlegende wl-legende"><span><i class="k-umfang"></i>Umfang</span>${serien.map(s => `<span><i class="wl-k ${s.k}"></i>noch nicht in „${esc(s.ph.spalte)}“ — Prognose P50 · P85 gestrichelt · P95 gepunktet</span>`).join('')}</div>`;
  const tabelle = `<details class="tabellenansicht"><summary>Tabellenansicht</summary><table class="pt dicht"><thead><tr><th>Tag</th><th class="r">Umfang</th>${p.phasen.map(ph => `<th class="r">noch nicht in „${esc(ph.spalte)}“</th>`).join('')}</tr></thead><tbody>${p.tage.map(d => `<tr><td class="mono">${isoD(d.t)}</td><td class="r num">${d.umfang}</td>${p.phasen.map(ph => `<td class="r num">${d.offen[ph.spalte]}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
  const bloecke = p.phasen.map(ph => {
    const anteil = p.umfang ? ph.erreicht / p.umfang : 1, hue = Math.round(120 * anteil);
    const kopfzeile = `<div class="wl-phase-kopf"><h3>Spalte „${esc(ph.spalte)}“ <span class="wl-badge">${ph.erreicht} VON ${p.umfang} ERREICHT</span></h3><div class="wl-fortschritt" role="img" aria-label="${Math.round(100 * anteil)} Prozent erreicht"><i style="width:${Math.round(100 * anteil)}%"></i></div></div>`;
    const reihe = ph.reihe7.length > 60 ? '… ' + ph.reihe7.slice(-60).join(' ') : ph.reihe7.join(' ');
    const messung = ph.laeufe ? `<p class="sek">Durchsatz Ø ${zahl1(ph.durchsatz)} je Kalendertag aus ${ph.laeufe} ${ph.laeufe === 1 ? 'Lauf' : 'Läufen'} · Tagesreihe: <span class="mono">${reihe}</span></p>` : '';
    let inhalt;
    if (!ph.offen) inhalt = `<p>Alle ${p.umfang} Aufgaben haben „${esc(ph.spalte)}“ erreicht.</p>`;
    else if (!ph.zeilen) inhalt = `<p>${ph.offen} offen — keine Prognose unter ${MIN_LAEUFE} Läufen in der Messbasis (gemessen: ${ph.laeufe}).</p>`;
    else inhalt = `<div class="wl-scroll"><table class="pt dicht wl-tab"><thead><tr><th>Mit X % Wkt.</th><th>Fertig zum, 7-Tage-Woche</th><th>Fertig zum, 5-Tage-Woche</th><th>Restliche Dauer</th><th>Nicht vor (Spalte links)</th></tr></thead><tbody>${ph.zeilen.map(z => `<tr><td>${z.p} %</td><td>${deDatum(z.datum7)}</td><td>${deDatum(z.datum5)}</td><td>${z.kalendertage} Kalendertage · ${z.arbeitstage} Arbeitstage</td><td>${z.untergrenze7 ? deDatum(z.untergrenze7) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
    const termin = termine.length ? `<ul class="wl-tchance">${termine.map(t => `<li><svg class="tm-vorschau" viewBox="0 0 44 10" aria-hidden="true"><line x1="2" x2="42" y1="5" y2="5" style="${terminStil(t)}"></line></svg>${esc(t.name)} · bis ${deDatum(isoTag(t.datum))}: <b>${esc(chanceText(terminChance(ph, t.datum, jetzt)))}</b></li>`).join('')}</ul>` : '';
    return `<section class="wl-phase" style="--h:${hue}" data-spalte="${esc(ph.spalte)}">${kopfzeile}${inhalt}${termin}${messung}</section>`;
  }).join('');
  const ohneBoard = S.aufgaben.filter(a => !a.archiviert && !(S.boards || []).some(b => b.spalten.some(sp => sp.aufgaben.includes(a.nummer)))).length;
  const aufBoard = S.board ? S.board.spalten.reduce((s, sp) => s + sp.aufgaben.length, 0) : 0;
  const nicht = `<h3 class="dtitel">Nicht enthalten</h3><ul class="wl-liste"><li>Aufgaben ohne Board: ${ohneBoard}.</li><li>Auf diesem Board, aber ausgeschlossen (Spalte, Farbe, Person, Label): ${Math.max(0, aufBoard - p.umfang - p.verworfen)}.</li><li>Archiviert außerhalb der Abschlussspalte (gelten als verworfen): ${p.verworfen}.</li></ul>`;
  const methodik = `<h3 class="dtitel">Lesehinweise und Methodik</h3><ul class="wl-liste"><li>Quelle: die Git-Geschichte von <span class="mono">boards/${esc(u.slug || '')}.md</span>; jede Bewegung ist ein Commit. Der Bericht rechnet neu, sobald sich das Board ändert.</li><li>Eine Aufgabe hat eine Spalte erreicht, sobald sie dort oder rechts davon liegt; es zählt das erste Erreichen. Je Spalte (außer der ersten) eine Kurve „noch nicht erreicht“.</li><li>Prognose: ${(10000).toLocaleString('de-DE')} Ziehungen mit Zurücklegen aus der Tagesreihe der Spalte (erreichte Aufgaben je Kalendertag ab dem ersten Lauf oder ab Beginn der Messbasis, Nulltage eingeschlossen), bis die offenen Aufgaben erreicht sind; Perzentile über die gezogenen Tage. Kein Puffer, kein Zuschlag. Eine Spalte wird nie früher prognostiziert als die Spalte links davon — deren Datum steht als Untergrenze dabei, nicht verrechnet.</li><li>5-Tage-Woche: Tagesreihe nur über Werktage (Ankünfte am Wochenende zählen zum nächsten Werktag), gezählt ab heute nur Mo bis Fr.</li><li>Termine: Anteil der Ziehungen, die bis zum Termin fertig sind — in der 7-Tage-Woche nach Kalendertagen, in der 5-Tage-Woche nach Werktagen bis einschließlich Termin.</li><li>Unter ${MIN_LAEUFE} Läufen in der Messbasis gibt es keine Perzentile. Das Diagramm zeigt höchstens die drei rechten Spalten farbig; die Tabellenansicht und die Blöcke führen jede Spalte.</li></ul>`;
  return `${kopf}<div class="body bericht wl-seite">${zahlen}<div class="wl-panel"><h3 class="dtitel">Noch nicht erreicht je Spalte, mit Prognose-Fächer</h3>${legende}<div class="dflaeche wl-flaeche">${svg}<div class="tooltip" id="tooltip" hidden></div></div>${tabelle}</div>${vTermine(p)}${bloecke}${nicht}${methodik}</div>`;
}

/* ── WBS-Sicht (R00054): Tabelle nach /planung karte, Stand im Kopf, live aus dem Arbeits-Repository ── */
/** Ein Menüpunkt je gebundener Anwendung; bei mehreren mit Kürzel. */
function vWbsMenue() {
  const g = gebunden(), k = wbsKuerzel();
  return g.map(a => `<a href="#/wbs/${esc(encodeURIComponent(a.kuerzel))}" class="${S.ui.view === 'wbs' && k === a.kuerzel ? 'an' : ''}" title="WBS von ${esc(a.name)} (g k)">${g.length > 1 ? 'WBS · ' + esc(a.kuerzel) : 'WBS'}</a>`).join('');
}
function vWbs() {
  if (!wbsKuerzel()) return `<div class="body bericht"><p class="muted">Dieses Board ist an keine Anwendung gebunden. Anwendungen registrierst du unter <a href="#/einrichten">Einrichten</a>; ein Board bindet sie mit <span class="mono">applications: [kd]</span>.</p></div>`;
  if (S.wbsFehler) return `<div class="body bericht"><div class="warnh" role="alert">${esc(S.wbsFehler)}</div></div>`;
  if (!S.wbs) return '';
  return `<div class="body bericht wbs-seite">${vWbsKopf(S.wbs)}${vWbsTabelle(S.wbs)}</div>`;
}
/** Der Kopf zeigt nur den Stand: Slice-Fortschritt, aktiver Pfad, was läuft, ob die Datei committet ist. */
function vWbsKopf(w) {
  const s = w.stand, p = prozente(s), nach = new Map(w.knoten.map(k => [k.id, k]));
  const knopf = id => `<button class="lnk" data-act="wbs-gehe" data-arg="${esc(id)}" title="zur Zeile ${esc(id)}">${esc(nach.get(id).name)} <span class="mono">${esc(id)}</span></button>`;
  const pfad = s.pfad.length ? s.pfad.map(knopf).join('<span class="trenner">›</span>') : '<span class="muted">nichts offen</span>';
  const laufend = s.laufend.length ? s.laufend.map(knopf).join(', ') : s.aktiv ? `nichts in Arbeit — nächster Knoten: ${knopf(s.aktiv)}` : 'nichts in Arbeit, nichts offen';
  const nc = w.nicht_committet ? `<span class="wbs-nc" title="Die WBS-Datei hat Änderungen, die im Arbeits-Repository nicht committet sind — kanbanD committet dort nie">nicht committet</span>` : '';
  return `<div class="wbs-kopf"><h2 class="wbs-titel">WBS · ${esc(w.name)} <span class="mono">${esc(w.datei)}</span>${nc}</h2><div class="wbs-stand"><span>${s.gruen} von ${s.slices} Slices funktional · ${s.gelb} in Bearbeitung · ${s.rot} offen</span><b id="wbs-stand">${esc(standText(s))}</b></div><div class="wbs-balken" role="img" aria-label="${esc(standText(s))}"><i class="gruen" style="width:${p.gruen}%"></i><i class="gelb" style="width:${p.gelb}%"></i><i class="rot" style="width:${p.rot}%"></i></div><div class="wbs-zeile"><span class="k">aktiv</span><span class="wbs-pfad">${pfad}</span></div><div class="wbs-zeile"><span class="k">in Arbeit</span><span class="wbs-laufend">${laufend}</span></div></div>`;
}
/** Die Plakette: gesetzt gefüllt, gerechnet umrandet; widerspricht die Datei, steht ihr Wert daneben. */
function vWbsStatus(k, gerechnet, setzbar) {
  const p = setzbar
    ? `<button class="ampel ${esc(k.gerechnet)} setzbar${S.ui.pop === 'wbs-status' && S.ui.wbsKnoten === k.id ? ' auf' : ''}" id="wbs-st-${esc(k.id)}" data-act="wbs-status-pop" data-arg="${esc(k.id)}" aria-haspopup="true" title="Status von ${esc(k.id)} setzen" aria-label="Status von ${esc(k.id)}: ${esc(k.gerechnet)} — setzen">${esc(k.gerechnet)}</button>`
    : `<span class="ampel ${esc(k.gerechnet)}${gerechnet ? ' gerechnet' : ''}"${gerechnet ? ' title="gerechnet aus den Kindern"' : ''}>${esc(k.gerechnet)}</span>`;
  return gerechnet && k.gerechnet !== k.status ? p + `<span class="wbs-widerspruch" title="In der Datei steht „${esc(k.status)}“, gerechnet aus den Kindern: ${esc(k.gerechnet)}">Datei: ${esc(k.status)}</span>` : p;
}
function vWbsTabelle(w) {
  const tiefe = tiefen(w.knoten), eltern = mitKindern(w.knoten, false), gerechnet = mitKindern(w.knoten, true);
  const zu = zugeklappt(w.knoten, wbsKlapp(), w.stand.pfad), weg = ausgeblendet(w.knoten, zu);
  const req = zelle => esc(zelle).replace(/\bR\d{5}\b/g, id => w.anforderungen[id] ? `<a href="vscode://file${esc(w.anforderungen[id])}" title="Anforderung ${id} im Editor öffnen">${id}</a>` : id);
  const zeilen = w.knoten.map(k => {
    const klapp = klappbar(k, eltern) ? `<button class="klapp" data-act="wbs-klapp" data-arg="${esc(k.id)}" aria-label="${esc(k.id)} ${zu.has(k.id) ? 'aufklappen' : 'zuklappen'}" aria-expanded="${!zu.has(k.id)}">${zu.has(k.id) ? '+' : '−'}</button>` : '<span class="klapp-platz"></span>';
    const was = k.ebene === 'Bubble' && k.eingabe_ausgabe ? k.eingabe_ausgabe : k.fertig_kriterium;
    return `<tr class="wbs-z ${esc(k.gerechnet)}" id="wbs-${esc(k.id)}" data-id="${esc(k.id)}" data-ebene="${esc(k.ebene)}" data-eltern="${esc(k.eltern)}"${weg.has(k.id) ? ' hidden' : ''}><td class="mono"><a href="vscode://file${esc(w.datei)}:${k.zeile}" title="Zeile ${k.zeile} im Editor öffnen">${esc(k.id)}</a></td><td class="wbs-ebene" title="erreicht: ${esc(k.erreicht)}">${esc(k.ebene)}</td><td class="wbs-name" style="padding-left:calc(var(--kd-s3) + ${tiefe[k.id]} * 18px)"${k.braucht.length ? ` title="braucht: ${esc(k.braucht.join(', '))}"` : ''}>${klapp}<span class="n">${esc(anzeigename(k))}</span>${kindEbenen(k).length ? `<button class="lnk wbs-plus" id="wbs-neu-${esc(k.id)}" data-act="wbs-neu-pop" data-arg="${esc(k.id)}" aria-label="Knoten unter ${esc(k.id)} anlegen" title="Knoten unter ${esc(k.id)} anlegen">+ Knoten</button>` : ''}</td><td class="wbs-text">${esc(was)}</td><td>${k.aufwand ? esc(k.aufwand) + 'h' : '—'}</td><td>${vWbsStatus(k, gerechnet.has(k.id), statusSetzbar(k, gerechnet))}</td><td class="mono">${req(k.requirement)}</td><td class="wbs-text">${esc(k.notiz)}</td></tr>`;
  }).join('');
  return `<div class="wbs-tabelle"><table class="pt dicht"><thead><tr><th>ID</th><th>Ebene</th><th>Knoten</th><th>Fertig-Kriterium / Eingabe → Ausgabe</th><th>Aufwand</th><th>Status</th><th>Requirement</th><th>Notiz</th></tr></thead><tbody>${zeilen}</tbody></table></div>`;
}

/** Wahl des Status an einem Blatt: rot · gelb · gruen; kanbanD schreibt die WBS-Datei und committet dort nicht. */
function vWbsStatusPop() {
  const id = S.ui.wbsKnoten, k = S.wbs && S.wbs.knoten.find(x => x.id === id);
  if (!k) return '';
  return `<div class="pop" id="pop" data-for="wbs-st-${esc(id)}" data-al="l" style="width:240px" role="menu" aria-label="Status von ${esc(id)}"><h4>STATUS <span class="mono">${esc(id)}</span></h4>${STATUS_WAHL.map(s => `<div class="iz${s === k.status ? ' an' : ''}" data-act="wbs-status" data-arg="${esc(id)}|${s}" role="menuitem"><span class="ampel ${s}">${s}</span><span class="muted">${s === k.status ? 'gesetzt' : ''}</span></div>`).join('')}<div class="fuss">Schreibt die WBS-Datei im Arbeits-Repository, ohne Commit.</div></div>`;
}

/** Neuer Knoten unter einem Eltern-Knoten: Ebene, Name, Fertig-Kriterium; Bubbles dazu Eingabe → Ausgabe und Aufwand. */
function vWbsNeuPop() {
  const f = S.ui.wbsNeu, k = f && S.wbs && S.wbs.knoten.find(x => x.id === f.eltern);
  if (!k) return '';
  const ebenen = kindEbenen(k), feld = (n, titel, ph) => `<span class="k">${titel}</span><span class="w"><input class="mini-inp full" id="wbs-neu-${n}" data-wn="${n}" value="${esc(f[n])}" placeholder="${esc(ph)}" data-enter="wbs-neu-anlegen" aria-label="${esc(titel)}"></span>`;
  return `<div class="pop wbs-neu" id="pop" data-for="wbs-neu-${esc(k.id)}" data-al="l" style="width:420px" role="dialog" aria-label="Knoten unter ${esc(k.id)} anlegen"><h4>NEUER KNOTEN <span class="mono">unter ${esc(k.id)} ${esc(k.name)}</span></h4><div class="felder"><span class="k">Ebene</span><span class="w"><select id="wbs-neu-ebene" data-wn="ebene" aria-label="Ebene">${ebenen.map(e => `<option${e === f.ebene ? ' selected' : ''}>${e}</option>`).join('')}</select></span>${feld('name', 'Name', 'was entsteht')}${feld('fertig_kriterium', 'Fertig', f.ebene === 'Bubble' ? 'Test gruen' : 'US-1')}${f.ebene === 'Bubble' ? feld('eingabe_ausgabe', 'Eingabe → Ausgabe', 'Eingabe → Ausgabe') + feld('aufwand', 'Aufwand', '0,5-1') : ''}</div>${f.fehler ? `<div class="warnh" role="alert">${esc(f.fehler)}</div>` : ''}<div class="fuss"><span>rot mit der nächsten freien ID · ohne Commit</span><button class="btn btn-haupt" data-act="wbs-neu-anlegen">anlegen</button></div></div>`;
}

/** Rückfrage vor dem Verwerfen: was mitgeht, Grund für die Notiz. */
function vWbsVerwerfenPop() {
  const id = S.ui.wbsVerwerfen, k = S.wbs && S.wbs.knoten.find(x => x.id === id);
  if (!k) return '';
  const mit = nachfahren(S.wbs.knoten, id).filter(zaehlt).length;
  return `<div class="pop wbs-verwerfen" id="pop" data-for="wbs-${esc(id)}" data-al="l" style="width:420px" role="dialog" aria-label="${esc(id)} verwerfen"><h4>VERWERFEN <span class="mono">${esc(id)} ${esc(k.name)}</span></h4><p class="hin">${mit ? `Mit ${esc(id)} werden ${mit} Knoten darunter verworfen.` : `${esc(id)} wird verworfen.`} Keine Zeile wird gelöscht; die Zeilen bleiben durchgestrichen stehen und zählen nicht mehr im Stand.</p><div class="felder"><span class="k">Grund</span><span class="w"><input class="mini-inp full" id="wbs-verwerfen-grund" placeholder="kommt in die Notiz" data-enter="wbs-verwerfen" data-arg="${esc(id)}" aria-label="Grund"></span></div><div class="fuss"><button class="btn" data-act="wbs-verwerfen-zu">abbrechen</button><button class="btn btn-haupt" data-act="wbs-verwerfen" data-arg="${esc(id)}">verwerfen</button></div></div>`;
}

/* ── Einrichten: Personen, Klassen, Quellen, Anwendungen ── */
/** Erreichbarkeit eines Pfads, wie der Server sie zuletzt gemeldet hat — nur solange der Pfad gespeichert ist. */
function vErreichbar(a, feld) {
  const g = (S.anwendungen || {})[a.kuerzel];
  if (!g || g[feld] !== a[feld]) return `<span class="erreich" title="wird beim Speichern geprüft">—</span>`;
  return g.erreichbar[feld] ? `<span class="erreich ja" title="Pfad gefunden">erreichbar</span>` : `<span class="erreich nein" title="Pfad nicht gefunden — die Anwendung ist nicht erreichbar, alle Boards bleiben benutzbar">nicht erreichbar</span>`;
}
function vRegister(d) {
  const register = d.quellen.anwendungen || [];
  const zeilen = register.map((a, i) => `<div class="anw" data-anwendung="${esc(a.kuerzel)}"><div class="klz az"><span class="pk pk-0">${esc(a.kuerzel.slice(0, 2).toUpperCase())}</span><span class="key">${esc(a.kuerzel)}</span><input class="inp" data-ef="aname" data-i="${i}" value="${esc(a.name)}" aria-label="Name der Anwendung ${esc(a.kuerzel)}"><span></span><button class="btn btn-sym" data-act="a-del" data-arg="${i}" title="aus dem Register entfernen – Aufgaben behalten ihre Herkunft" aria-label="Anwendung ${esc(a.kuerzel)} entfernen">✕</button></div><div class="felder"><span class="k">wbs</span><span class="w"><input class="mini-inp full" data-ef="awbs" data-i="${i}" value="${esc(a.wbs)}" placeholder="/voller/pfad/Dokumentation/Planung/app.md" aria-label="WBS-Pfad ${esc(a.kuerzel)}">${vErreichbar(a, 'wbs')}</span><span class="k">requirements</span><span class="w"><input class="mini-inp full" data-ef="aanf" data-i="${i}" value="${esc(a.anforderungen)}" placeholder="/voller/pfad/Anforderungen" aria-label="Anforderungspfad ${esc(a.kuerzel)}">${vErreichbar(a, 'anforderungen')}</span></div></div>`).join('');
  return `${zeilen}<div class="klz az"><span class="pk pk-0">+</span><input class="inp mono" id="nak" placeholder="kürzel" aria-label="Neues Anwendungskürzel"><input class="inp" id="nan" placeholder="Name · Enter" data-enter="a-add" aria-label="Neuer Anwendungsname"><span></span><span></span></div>`;
}

function vEinrichten() {
  const d = S.ui.einr, u = S.ui;
  const personen = d.personen.map((p, i) => `<div class="klz pz${p.aktiv ? '' : ' still'}" data-person="${esc(p.kuerzel)}"><span class="pk ${p.art === 'agent' ? 'pk-a' : 'pk-m'}${p.aktiv ? '' : ' pk-still'}">${esc(p.kuerzel.slice(0, 2).toUpperCase())}</span><span class="key">${esc(p.kuerzel)}</span><input class="inp" data-ef="pname" data-i="${i}" value="${esc(p.name)}" aria-label="Name ${esc(p.kuerzel)}"><span class="seg art"><span class="${p.art === 'human' ? 'an' : ''}" data-act="p-art" data-arg="${i}|human">Mensch</span><span class="${p.art === 'agent' ? 'an' : ''}" data-act="p-art" data-arg="${i}|agent">Agent</span></span><button class="btn btn-sym" data-act="p-still" data-arg="${i}" title="${p.aktiv ? 'stilllegen – nicht mehr wählbar, Name bleibt lesbar' : 'zurückholen'}" aria-label="${p.aktiv ? 'stilllegen' : 'zurückholen'} ${esc(p.kuerzel)}">${p.aktiv ? '⏸' : '↺'}</button></div>`).join('');
  const klassen = d.klassen.map((k, i) => `<div class="klz" data-klasse="${esc(k.schluessel)}"><span class="farbe${u.palFuer === i ? ' an' : ''}" style="${cv(k.farbe)}" data-act="k-pal" data-arg="${i}" title="Farbe wählen" role="button" aria-label="Farbe ${esc(k.schluessel)}"></span><span class="key">${esc(k.schluessel)}</span><input class="inp" data-ef="klabel" data-i="${i}" value="${esc(k.bezeichnung)}" aria-label="Bezeichnung ${esc(k.schluessel)}"><span class="n">${S.aufgaben.filter(a => a.klasse === k.schluessel).length}</span><button class="btn btn-sym" data-act="k-del" data-arg="${i}" title="entfernen – Aufgaben behalten den Schlüssel, ohne Farbe" aria-label="Klasse ${esc(k.schluessel)} entfernen">✕</button></div>${u.palFuer === i ? `<div class="pal"><span class="nm">gewählt: ${esc(k.farbe)}</span><div class="g">${PAL.map(f => `<span style="${cv(f)}" class="${k.farbe === f ? 'an' : ''}" data-act="k-farbe" data-arg="${i}|${f}" title="${f}" role="button" aria-label="${f}"></span>`).join('')}</div><div class="eig">Eigene Farbe <input class="inp mono" data-ef="khex" data-i="${i}" value="${k.farbe.startsWith('#') ? esc(k.farbe) : ''}" placeholder="#b04a8c" aria-label="Eigene Farbe"></div></div>` : ''}`).join('');
  return `<div class="einrichten"><div class="einr breit"><h3>PERSONEN <span class="mono">people:</span></h3><div class="hin">Menschen sind unter „Ich bin …“ wählbar; Agenten nennen sich an der API selbst. Stilllegen statt entfernen – der Name bleibt an Karten und Zeiten lesbar.</div>${personen}<div class="klz pz"><span class="pk pk-0">+</span><input class="inp mono" id="npk" placeholder="kürzel" aria-label="Neues Kürzel"><input class="inp" id="npn" placeholder="Name · Enter" data-enter="p-add" aria-label="Neuer Name"><span class="seg art"><span class="${u.nart !== 'agent' ? 'an' : ''}" data-act="n-art" data-arg="human">Mensch</span><span class="${u.nart === 'agent' ? 'an' : ''}" data-act="n-art" data-arg="agent">Agent</span></span><span></span></div>
<h3>KLASSEN <span class="mono">classes:</span></h3><div class="hin">Eine Aufgabe trägt höchstens eine Klasse; sie färbt die Karte und ist filterbar mit <span class="mono">class:schlüssel</span>.</div>${klassen}<div class="klz"><span class="farbe"></span><input class="inp mono" id="nck" placeholder="schlüssel" aria-label="Neuer Klassenschlüssel"><input class="inp" id="ncl" placeholder="Bezeichnung · Enter" data-enter="k-add" aria-label="Neue Bezeichnung"><span></span><span></span></div>
<h3>QUELLEN <span class="mono">sources:</span></h3><div class="felder"><span class="k">wbs</span><span class="w"><input class="mini-inp full" data-ef="wbs" value="${esc(d.quellen.wbs)}" aria-label="WBS-Pfad"></span><span class="k">requirements</span><span class="w"><input class="mini-inp full" data-ef="anf" value="${esc(d.quellen.anforderungen)}" aria-label="Anforderungspfad"></span></div>
<h3>ANWENDUNGEN <span class="mono">sources.applications:</span></h3><div class="hin">Je Anwendung ein Kürzel und die vollen Pfade zu WBS und Anforderungen im Arbeits-Repository. Aufgaben nennen ihre Herkunft dann als <span class="mono">kd:I0007</span>; Boards binden Anwendungen mit <span class="mono">applications: [kd]</span>.</div>${vRegister(d)}
${d.fehler ? `<div class="warnh" role="alert">${esc(d.fehler)}</div>` : ''}<div class="zeile-knoepfe"><button class="btn btn-haupt" data-act="einr-ok">Speichern</button><button class="btn" data-act="einr-weg">Verwerfen</button>${d.gespeichert ? '<span class="muted">gespeichert</span>' : ''}</div></div>
<aside class="einr"><h3>KANBAND.MD <span class="mono">Vorschau</span></h3><pre class="yaml" id="einr-vorschau">${esc(einstellungenText(d))}</pre></aside></div>`;
}

/* ── Spalten einrichten ── */
function setupText(d) {
  const grenzen = d.spalten.filter(s => +s.grenze > 0);
  return (grenzen.length ? '---\nlimits:\n' + grenzen.map(s => `  ${yamlSkalar(s.name)}: ${+s.grenze}`).join('\n') + '\n---\n\n' : '')
    + `# ${S.board.titel}\n` + d.spalten.map(s => `\n## ${s.name}\n` + (s.n ? `\n… ${s.n} Aufgabenzeilen\n` : '')).join('');
}
function vSetup() {
  const d = S.ui.setup;
  const bahnen = d.spalten.map((sp, i) => `<section class="bahn" style="--bw:236px"><div class="bk-ed"><div class="r"><input class="inp" data-sf="name" data-i="${i}" value="${esc(sp.name)}" aria-label="Spaltenname ${i + 1}"><button class="btn btn-sym" data-act="col-l" data-arg="${i}"${i === 0 ? ' disabled' : ''} title="nach links">←</button><button class="btn btn-sym" data-act="col-r" data-arg="${i}"${i === d.spalten.length - 1 ? ' disabled' : ''} title="nach rechts">→</button><button class="btn btn-sym" data-act="col-del" data-arg="${i}"${sp.n ? ` disabled title="enthält ${sp.n} Karten – erst leeren"` : ' title="entfernen"'} aria-label="Spalte ${esc(sp.name)} entfernen">✕</button></div><div class="r2"><span>${sp.n} Karten</span>${sp.alt && sp.alt !== sp.name ? `<span class="mono">war: ${esc(sp.alt)}</span>` : ''}${!sp.alt ? '<span class="mono">neu</span>' : ''}<span style="margin-left:auto">Grenze <input class="inp" data-sf="grenze" data-i="${i}" value="${sp.grenze || ''}" aria-label="Grenze ${esc(sp.name)}" inputmode="numeric"></span></div></div><div class="flaeche ruhig"></div></section>`).join('');
  const neu = `<section class="bahn-neu"><div class="bk-ed"><div class="r"><input class="inp" id="col-new" placeholder="neue Spalte · Enter" data-enter="col-add" aria-label="Neue Spalte"></div><div class="r2">wird vor der Abschlussspalte eingefügt</div></div></section>`;
  return `<div class="setup"><div class="bahnen">${bahnen}${neu}</div><aside class="einr"><h3>BOARDS/${esc(S.board.slug).toUpperCase()}.MD <span class="mono">Vorschau</span></h3><pre class="yaml" id="setup-vorschau">${esc(setupText(d))}</pre></aside></div>`;
}

/* ── Erster Start ── */
function ersteEinstellungen(f) {
  const ag = [['cl', 'Claude'], ['cx', 'Codex']].filter(([k]) => f.agenten[k]);
  return {
    personen: [{ kuerzel: f.kuerzel.trim(), name: f.name.trim(), art: 'human' }, ...ag.map(([k, n]) => ({ kuerzel: k, name: n, art: 'agent' }))],
    klassen: [],
    quellen: { wbs: f.wbs.trim(), anforderungen: f.anf.trim() },
  };
}
const spaltenListe = f => f.spalten.split(',').map(s => s.trim()).filter(Boolean);
function vFirst() {
  const f = S.ui.first, z = S.zustand, ag = [['cl', 'Claude'], ['cx', 'Codex']];
  return `<div class="first"><div class="first-l"><h2>Kanban in <span class="mono">${esc(z.ordner)}</span> einrichten</h2>
<p class="muted">Hier liegt noch keine <span class="mono">kanbanD.md</span>. kanbanD legt sie und das erste Board unter <span class="mono">boards/</span> an und committet beides als eine Aktion unter deinem Namen. Aufgaben entstehen später einzeln unter <span class="mono">aufgaben/</span>.</p>
<div class="felder"><span class="k">ich</span><span class="w"><input class="mini-inp" data-fr="kuerzel" value="${esc(f.kuerzel)}" placeholder="kürzel" style="width:70px" aria-label="Kürzel"><input class="mini-inp full" data-fr="name" value="${esc(f.name)}" placeholder="Dein Name" aria-label="Name"></span>
<span class="k">agents</span><span class="w wrap">${ag.map(([k, n]) => `<button class="as${f.agenten[k] ? ' an' : ''}" data-act="fr-agent" data-arg="${k}" aria-pressed="${!!f.agenten[k]}"><span class="pk pk-a">${k.toUpperCase()}</span>${n}</button>`).join('')}</span>
<span class="k">board</span><span class="w"><input class="mini-inp full" data-fr="board" value="${esc(f.board)}" aria-label="Board"></span>
<span class="k">spalten</span><span class="w"><input class="mini-inp full" data-fr="spalten" value="${esc(f.spalten)}" title="durch Komma getrennt; die letzte ist die Abschlussspalte" aria-label="Spalten"></span>
<span class="k">wbs</span><span class="w"><input class="mini-inp full" data-fr="wbs" value="${esc(f.wbs)}" placeholder="Dokumentation/Planung/projekt.md" aria-label="WBS"></span>
<span class="k">anforderungen</span><span class="w"><input class="mini-inp full" data-fr="anf" value="${esc(f.anf)}" placeholder="Anforderungen/" aria-label="Anforderungen"></span></div>
${f.fehler ? `<div class="fehl" role="alert">${esc(f.fehler)}</div>` : ''}
<div class="zeile"><button class="btn btn-haupt" data-act="first-ok">Einrichten und committen</button></div></div>
<aside class="first-r"><h3>KANBAND.MD <span class="mono">wird angelegt</span></h3><pre class="yaml" id="vorschau-einstellungen">${esc(einstellungenText(ersteEinstellungen(f)))}</pre><h3>BOARDS/${esc(slug(f.board) || '…').toUpperCase()}.MD</h3><pre class="yaml" id="vorschau-board">${esc(boardText(f.board.trim(), spaltenListe(f)))}</pre></aside></div>`;
}

function vStatus() {
  const z = S.zustand;
  if (!z) return '';
  const nd = (z.defekte || []).length;
  return `<span class="mono">${esc(z.ordner)}</span>${nd ? `<button class="lnk warn" id="t-defekt" data-act="pop" data-arg="defekt">${nd} ${nd === 1 ? 'defekte Datei' : 'defekte Dateien'}</button>` : ''}${z.eingerichtet ? `<span>${z.boards.length} ${z.boards.length === 1 ? 'Board' : 'Boards'}</span>` : '<span>kanbanD.md fehlt</span>'}${S.ui.fehler ? `<span class="fehl">${esc(S.ui.fehler)}</span>` : ''}<span class="rechts"><button class="lnk" data-act="hilfe" title="Tastenkürzel (?)">Tastenkürzel <kbd>?</kbd></button><a href="/api" target="_blank" rel="noopener">API für Agenten</a></span>`;
}
