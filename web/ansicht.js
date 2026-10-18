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
  return s + `\nsources:\n  wbs: ${yamlSkalar(e.quellen.wbs)}\n  requirements: ${yamlSkalar(e.quellen.anforderungen)}\n---`;
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
  return `<header class="kz"><div class="kz-z1" title="${esc(z.ordner)}"><button class="kz-btn kz-board${u.pop === 'board' ? ' auf' : ''}" id="t-board" data-act="pop" data-arg="board" aria-haspopup="true">${esc(b ? b.titel : 'kein Board')} ▾</button> <span class="mono">${esc(ordnerName)}</span></div><nav class="kz-nav"><a href="#/board/${esc(u.slug || '')}" class="${u.view === 'board' ? 'an' : ''}">Board</a><a href="#/aufgaben" class="${u.view === 'aufgaben' ? 'an' : ''}">Aufgaben</a><a href="#/personen" class="${u.view === 'personen' ? 'an' : ''}">Personen</a><a href="#" id="t-ber" class="${u.view.startsWith('berichte') ? 'an' : ''}${u.pop === 'ber' ? ' auf' : ''}" data-act="pop" data-arg="ber" aria-haspopup="true">Berichte<span class="dd">▾</span></a><a href="#/einrichten" class="${u.view === 'einrichten' ? 'an' : ''}">Einrichten</a></nav>${u.view === 'aufgaben' ? vListenWerk() : ''}${b && u.view === 'board' ? `<div class="kz-werk"><input class="inp" id="flt" placeholder="Filtern: Titel, #Nr, @wer, class:bug, origin:I0023, label:ui  ( / )" value="${esc(u.filter)}" aria-label="Filter"><span class="seg" role="radiogroup" aria-label="Bereich">${[['alle', 'alle'], ['meine', 'meine'], ['agenten', 'Agenten']].map(([k, t]) => `<span class="${u.bereich === k ? 'an' : ''}" data-act="bereich" data-arg="${k}" role="radio" aria-checked="${u.bereich === k}">${t}</span>`).join('')}</span><button class="kz-btn" data-act="setup" title="Spalten dieses Boards einrichten">Spalten</button></div>` : ''}<div class="kz-z3">${vLaufKnopf()}${S.live ? '' : '<span class="kz-btn leer" title="Die Verbindung zum Server ist unterbrochen; die Seite lädt neu, sobald sie zurück ist.">nicht live</span>'}${vIchKnopf()}</div></header>`;
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
/** Eingabe → Eintrag für die API (Titel mit Angaben, wenn Kürzel erkannt). */
function eintragAus(text) {
  const s = schnelleingabe(text, schnellUmfeld(), new Date());
  const e = { titel: s.titel || text.trim() };
  if (s.zustaendige.length) e.zustaendige = s.zustaendige;
  if (s.klasse) e.klasse = s.klasse;
  if (s.labels.length) e.labels = s.labels;
  if (s.faellig) e.faellig = s.faellig;
  if (s.herkunft.length) e.herkunft = s.herkunft;
  return e;
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
<span class="k">origins</span><span class="w wrap">${a.herkunft.map((x, j) => `<span class="ochip">${vHerkunftChip(x)}<button data-act="herkunft-weg" data-arg="${j}" title="entfernen" aria-label="Herkunft ${esc(x)} entfernen">×</button></span>`).join('') || vHerkunftChip('thin air')}<input class="mini-inp" id="herkunft-neu" placeholder="I0001 / R00014" data-enter="herkunft-neu" title="WBS-Knoten I0001, Anforderung R00014 oder thin air · Enter" aria-label="Neue Herkunft"></span>
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
function vHerkunftChip(x) {
  const q = S.herkunft[x], h = quelleLink(x);
  if (x === 'thin air') return `<span class="org leer" title="ohne Herkunft">thin air</span>`;
  return h ? `<a class="org" href="${esc(h)}" title="${esc(q.name)}${q.status ? ' · ' + esc(q.status) : ''} — im Editor öffnen">${esc(x)}</a>` : `<span class="org" title="Quelle nicht gefunden — Pfade unter Einrichten prüfen">${esc(x)}</span>`;
}
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
  return S.aufgaben.filter(t => t.nummer !== a.nummer && !t.archiviert && t.herkunft.some(h => braucht.includes(h))
    && S.board.spalten.some(sp => sp !== letzte && sp.aufgaben.includes(t.nummer))).map(t => t.nummer);
}

function vKarte(a, fertig) {
  const cl = klasse(a.klasse);
  const tk = a.teilaufgaben.length ? `<span class="tk">☑ ${a.teilaufgaben.filter(t => t.erledigt).length}/${a.teilaufgaben.length}</span>` : '';
  const due = a.faellig ? `<span class="due${!fertig && a.faellig <= isoD(Date.now() + 864e5) ? ' warn' : ''}">${esc(a.faellig)}</span>` : '';
  const ext = S.extern[a.nummer];
  const rs = laufende(a), eigen = rs.some(z => z.wer === S.ich), erster = rs.map(z => zeitMs(z.beginn)).sort((x, y) => x - y)[0];
  const lz = rs.length ? `<span class="lauf${eigen ? ' eigen' : ''}" title="läuft: ${esc(rs.map(z => per(z.wer).name).join(', '))}">${rs.length > 1 ? rs.length + '× ' : ''}<span data-since="${erster}">${hm(Date.now() - erster)}</span></span>` : '';
  return `<div class="ka${fertig ? ' fertig' : ''}${ext ? ' fremd' : ''}${S.ui.offen === a.nummer ? ' offen' : ''}" draggable="true" data-id="${a.nummer}" data-act="oeffnen" data-arg="${a.nummer}" tabindex="0"${cl ? ` data-c="1" style="${cv(cl.farbe)}"` : ''}><div class="r1"><span class="id">#${a.nummer}</span>${vHerkunft(a)}${a.labels.map(l => `<span class="lbl">${esc(l)}</span>`).join('')}${lz}</div>${S.ui.umbenennen === a.nummer ? `<input class="inp umbenennen" id="umbenennen" value="${esc(a.titel)}" data-enter="umbenennen-ok" data-arg="${a.nummer}" aria-label="Neuer Titel">` : `<div class="t" data-dbl="umbenennen" data-arg="${a.nummer}">${esc(a.titel)}</div>`}${vKartenleiste(a)}<div class="r3"><span class="avs">${a.zustaendige.map(pk).join('')}</span>${cl ? `<span class="cls">${esc(cl.bezeichnung)}</span>` : ''}${tk}${due}</div>${(w => w.length ? `<div class="wartet" title="laut WBS (Braucht)">wartet auf ${w.map(n => '#' + n).join(', ')}</div>` : '')(fertig ? [] : wartetAuf(a))}${ext ? `<div class="ein" data-ext="${ext.at}" data-datei="${esc(ext.datei)}">extern · ${esc(ext.datei)} · vor ${Math.round((Date.now() - ext.at) / 1000)} Sek</div>` : ''}</div>`;
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
const KUERZEL_BOARD = [['Rechtsklick · Menütaste · Umschalt + F10', 'Menü der Karte'], ['a', 'Karte archivieren'], ['1 … 9', 'Karte in Spalte 1 … 9'], ['c', 'Verweis „#n Titel“ kopieren'], ['t · m · F2', 'Timer · mir zuweisen · umbenennen'], ['Strg + Z', 'letzte Bewegung / Anlage rückgängig'], ['← → ↑ ↓', 'Karte wählen'], ['Umschalt + ← →', 'Karte in die Nachbarspalte'], ['Umschalt + ↑ ↓', 'Karte in der Spalte verschieben'], ['Enter', 'Karte öffnen'], ['n', 'neue Karte in dieser Spalte'], ['Esc', 'Filter leeren'], ['/', 'Filter']];
const KUERZEL_FENSTER = [['↑ ↓', 'vorige / nächste Karte'], ['t', 'Timer an / aus'], ['m', 'mir zuweisen / mich abnehmen'], ['a', 'archivieren / zurückholen'], ['e', 'Titel bearbeiten'], ['b', 'Beschreibung bearbeiten'], ['Strg + Enter', 'Beschreibung speichern'], ['s', 'neue Teilaufgabe'], ['k', 'Kommentar schreiben'], ['d', 'Inhalt / Datei'], ['Esc', 'schließen']];
const KUERZEL_LISTE = [['↑ ↓', 'Zeile wählen'], ['Enter', 'Aufgabe öffnen'], ['a', 'archivieren / zurückholen'], ['c', 'Verweis kopieren'], ['Umschalt + F10', 'Menü der Zeile'], ['/', 'Filter']];
const KUERZEL_UEBERALL = [['g b', 'Board'], ['g a', 'Aufgaben'], ['g p', 'Personen'], ['g s', 'Stundenzettel'], ['g z', 'Zeiten nach Aufgabe und Person'], ['g v', 'Burndown'], ['g e', 'Einrichten'], ['b', 'Board wechseln'], ['i', 'Ich bin …'], ['Strg + Z', 'rückgängig (solange der Hinweis steht)'], ['?', 'diese Übersicht']];
function hilfeOrt() {
  if (S.ui.offen) return ['Aufgabenfenster', KUERZEL_FENSTER];
  if (S.ui.view === 'board') return ['Board', KUERZEL_BOARD];
  if (S.ui.view === 'aufgaben') return ['Aufgabenliste', KUERZEL_LISTE];
  return null;
}
function vHilfe() {
  const zeilen = liste => liste.map(([k, t]) => `<tr><td>${k.split(' ').map(x => x === '+' ? ' + ' : `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(t)}</td></tr>`).join('');
  const ort = hilfeOrt();
  return `<div class="mod-bg hilfe-bg" data-act="schliessen-hilfe"><div class="hilfe" role="dialog" aria-label="Tastaturkürzel">${ort ? `<h3>HIER: ${esc(ort[0].toUpperCase())}</h3><table>${zeilen(ort[1])}</table>` : ''}<h3>ÜBERALL</h3><table>${zeilen(KUERZEL_UEBERALL)}</table></div></div>`;
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
    return `<div class="km-e${i === ebene.index ? ' an' : ''}${e.aktuell ? ' km-aktuell' : ''}" role="menuitem" data-mp="${p}"${e.unter ? ' aria-haspopup="true"' : ''}${e.aktuell ? ' aria-disabled="true"' : ''}>${e.aktuell ? '✓ ' : ''}${esc(e.text)}<span class="km-k">${e.unter ? '▸' : esc(e.kuerzel || '')}</span>${unterOffen ? `<div class="kmenue unter" role="menu">${vMenueEintraege(e.unter, ebene.unter, aktiv, p)}</div>` : ''}</div>`;
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
  const neu = S.ui.adding === sp.name
    ? `<div class="bahn-add"><input class="inp" id="add-inp" placeholder="Titel · Enter legt an · Liste einfügen legt alle an · Esc" data-enter="add-ok" data-arg="${esc(sp.name)}" data-mehrfach="board" data-schnell="1" aria-label="Titel der neuen Karte"><div class="schnell" id="add-vorschau" aria-live="polite"></div></div>`
    : `<button data-act="add" data-arg="${esc(sp.name)}">+ Karte</button>`;
  const ueber = sp.grenze && karten.length > sp.grenze;
  const boardLeer = i === 0 && !archiv && !gefiltert && S.board.spalten.every(s => !s.aufgaben.length);
  const leerText = boardLeer ? '<div class="leer hilfe-leer">Noch keine Karten.<br>„+ Karte“ oder Taste <kbd>n</kbd> — eine eingefügte Liste legt mehrere an, Kürzel wie <span class="mono">@kürzel</span> oder <span class="mono">due:morgen</span> setzen Felder.</div>' : '';
  return `<section class="bahn" data-col="${esc(sp.name)}"><div class="bahn-kopf${ueber ? ' ueber' : ''}" tabindex="0" data-kopf="${i}" title="Rechtsklick: Menü der Spalte">${esc(sp.name)}${letzte ? ' <span class="ok" title="Abschlussspalte">✓</span>' : ''}${sp.grenze ? ` <span class="v"${ueber ? ' title="Grenze überschritten"' : ''}>Grenze ${sp.grenze}${ueber ? ' · überschritten' : ''}</span>` : ''}<span class="n">${karten.length}</span></div><div class="flaeche">${karten.join('') || leerText || `<div class="leer">${gefiltert ? 'keine Treffer' : 'leer'}</div>`}${archivZahl ? `<div class="nach"><a href="#" data-act="archiv-an">Archiv (${archivZahl})</a></div>` : ''}</div>${archiv ? '' : `<div class="bahn-fuss">${neu}</div>`}</section>`;
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
    return `<tr class="${a.archiviert ? 'ruhe' : ''}" data-zeile="${a.nummer}" tabindex="0"><td class="mono">#${a.nummer}</td><td class="tt"><a href="#" data-act="oeffnen" data-arg="${a.nummer}">${esc(a.titel)}</a>${a.archiviert ? ` <span class="lbl">archiviert ${esc(a.archiviert)}</span>` : ''}</td><td>${cl ? `<span class="cls" style="${cv(cl.farbe)}">${esc(cl.bezeichnung)}</span>` : a.klasse ? esc(a.klasse) : ''}</td><td><span class="avs">${a.zustaendige.map(pk).join('')}</span></td><td class="orte">${orte.length ? orte.map(({ b, sp }) => `<span class="lbl ort">${esc(b.titel)} · ${esc(sp.name)}<button class="lnk" data-act="abnehmen" data-arg="${esc(b.slug)}|${a.nummer}" title="von ${esc(b.titel)} nehmen" aria-label="#${a.nummer} von ${esc(b.titel)} nehmen">✕</button></span>`).join(' ') : '<span class="muted">auf keinem Board</span>'}</td><td>${a.archiviert ? `<button class="btn" data-act="zurueckholen" data-arg="${a.nummer}">zurückholen</button>` : `<button class="btn" id="leg-${a.nummer}" data-act="legen-pop" data-arg="${a.nummer}" aria-haspopup="true">auf Board legen ▾</button>`}</td></tr>`;
  }).join('');
  return `<div class="leiste"><b>Aufgaben</b><span class="muted">alle Dateien unter aufgaben/ · eine Aufgabe kann auf mehreren Boards liegen</span><div class="rechts"><input class="inp" id="liste-neu" placeholder="${me ? '+ Aufgabe ohne Board · Enter' : 'erst „Ich bin …“ wählen'}" data-enter="liste-neu" data-mehrfach="liste" style="width:320px" title="Kürzel: @kürzel class: label: due: I0001" aria-label="Neue Aufgabe ohne Board"${me ? '' : ' disabled'}></div></div>
<div class="body"><table class="pt dicht liste"><thead><tr><th>#</th><th>Titel</th><th>Klasse</th><th>Zuständig</th><th>Liegt auf</th><th></th></tr></thead><tbody>${zeilen || '<tr><td colspan="6" class="muted">keine Aufgaben in diesem Bereich</td></tr>'}</tbody></table></div>`;
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
  return `<div class="pop menue" id="pop" data-for="t-ber" data-al="l" style="width:330px" role="menu"><div class="k">ZEITEN</div>${e('#/berichte/stundenzettel', SVG.zettel, 'Stundenzettel', 'Eine Person, eine Woche: Aufgaben × Tage mit Summen.', v === 'berichte/stundenzettel')}${e('#/berichte/kreuz', SVG.kreuz, 'Zeiten nach Aufgabe und Person', 'Kreuztabelle über den Zeitraum, Summen in beide Richtungen.', v === 'berichte/kreuz')}<div class="k">VERLAUF</div>${e('#/berichte/verlauf', '<path d="M4 6l6 6 4-3 6 9M4 20h16"></path>', 'Burndown und Durchlaufzeit', 'Offene Aufgaben je Tag und Durchlaufzeit je Aufgabe – aus der Git-Geschichte dieses Boards.', v === 'berichte/verlauf')}<div class="k">AUSLEITEN</div>${e('/api/berichte/zeiten.csv', SVG.csv, 'Export als CSV', 'Eine Zeile je Zeiteintrag: Aufgabe, Person, Art, Beginn, Ende, Dauer, Herkunft.')}</div>`;
}
const csvKnopf = '<a class="btn" href="/api/berichte/zeiten.csv" download>CSV</a>';
function vStundenzettel() {
  const u = S.ui, jetzt = Date.now();
  const w0 = (() => { const d = new Date(wochenbeginn(jetzt)); d.setDate(d.getDate() + 7 * (u.wochenVersatz || 0)); return d.getTime(); })();
  const wer = u.sp || S.ich || (personen().find(p => p.aktiv) || {}).kuerzel;
  const s = stundenzettel(S.aufgaben, wer, w0, jetzt), namen = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], heute = tagesbeginn(jetzt);
  const zelle = ms => ms ? hm(ms) : '<span class="muted">·</span>';
  return `<div class="leiste"><b>Stundenzettel</b><span class="seg" role="radiogroup" aria-label="Person">${personen().filter(p => p.aktiv).map(p => `<span class="${p.kuerzel === wer ? 'an' : ''}" data-act="sp" data-arg="${esc(p.kuerzel)}" role="radio" aria-checked="${p.kuerzel === wer}">${esc(p.name)}</span>`).join('')}</span><button class="btn btn-sym" data-act="woche" data-arg="-1" aria-label="vorige Woche">‹</button><span class="mono muted" id="woche">${isoD(s.tage[0])} – ${isoD(s.tage[6])}</span><button class="btn btn-sym" data-act="woche" data-arg="1" aria-label="nächste Woche">›</button><span class="muted" style="font-size:12px">liest nur · Klick auf eine Zeile öffnet die Aufgabe zum Korrigieren</span><div class="rechts">${csvKnopf}</div></div>
<div class="body"><table class="pt dicht" id="stundenzettel"><thead><tr><th>Aufgabe</th>${s.tage.map((t, i) => `<th class="r"${t === heute ? ' style="color:var(--kd-accent-ink)"' : ''}>${namen[i]} <span class="mono">${isoD(t).slice(8)}</span></th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${s.zeilen.map(z => `<tr class="klick" data-act="oeffnen" data-arg="${z.aufgabe.nummer}"><td class="tt"><span class="mono muted">#${z.aufgabe.nummer}</span> ${esc(z.aufgabe.titel)}</td>${z.proTag.map(ms => `<td class="r num">${zelle(ms)}</td>`).join('')}<td class="r num"><b>${hm(z.summe)}</b></td></tr>`).join('') || `<tr><td class="muted" colspan="9">${esc(per(wer || '').name)} hat in dieser Woche keine Zeiten.</td></tr>`}<tr class="grp"><td>SUMME</td>${s.jeTag.map(ms => `<td class="r">${hm(ms)}</td>`).join('')}<td class="r" id="zettelsumme">${hm(s.summe)}</td></tr></tbody></table></div>`;
}
function vKreuz() {
  const u = S.ui, jetzt = Date.now(), zeitraum = u.zeitraum || 'woche';
  const von = zeitraum === 'woche' ? wochenbeginn(jetzt) : zeitraum === '30' ? jetzt - 30 * 864e5 : 0;
  const k = kreuztabelle(S.aufgaben, von, jetzt);
  const zelle = ms => ms ? hm(ms) : '<span class="muted">—</span>';
  return `<div class="leiste"><b>Zeiten nach Aufgabe und Person</b><span class="seg" role="radiogroup" aria-label="Zeitraum">${[['woche', 'diese Woche'], ['30', '30 Tage'], ['alles', 'alles']].map(([z, t]) => `<span class="${zeitraum === z ? 'an' : ''}" data-act="zeitraum" data-arg="${z}" role="radio" aria-checked="${zeitraum === z}">${t}</span>`).join('')}</span><span class="muted" style="font-size:12px">liest nur · korrigiert wird an der Aufgabe</span><div class="rechts">${csvKnopf}</div></div>
<div class="body"><table class="pt dicht" id="kreuz"><thead><tr><th>Aufgabe</th>${k.personen.map(p => `<th class="r">${pk(p)} ${esc(per(p).name)}</th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${k.zeilen.map(z => `<tr class="klick" data-act="oeffnen" data-arg="${z.aufgabe.nummer}"><td class="tt"><span class="mono muted">#${z.aufgabe.nummer}</span> ${esc(z.aufgabe.titel)}</td>${z.jePerson.map(ms => `<td class="r num">${zelle(ms)}</td>`).join('')}<td class="r num"><b>${hm(z.summe)}</b></td></tr>`).join('') || '<tr><td class="muted">Keine Zeiten im Zeitraum.</td></tr>'}<tr class="grp"><td>SUMME</td>${k.jeSpalte.map(ms => `<td class="r">${hm(ms)}</td>`).join('')}<td class="r">${hm(k.summe)}</td></tr></tbody></table></div>`;
}

/* Burndown: eine Serie (offen) in der Akzentfarbe, Umfang als neutrale Bezugslinie. */
const zahl1 = x => x == null ? '—' : x.toFixed(1).replace('.', ',');
function vVerlauf() {
  const v = S.verlauf;
  if (!v) return '<div class="leer">lädt …</div>';
  const t = v.tage, B = 800, H = 260, L = 36, R = 96, O = 16, U = 28;
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
</svg>` : '<div class="leer">Noch kein Stand dieses Boards.</div>';
  const legende = `<div class="dlegende"><span><i class="k-offen"></i>offen</span><span><i class="k-umfang"></i>Umfang (alle Aufgaben auf dem Board)</span></div>`;
  const tabelle = `<details class="tabellenansicht"><summary>Tabellenansicht</summary><table class="pt dicht"><thead><tr><th>Tag</th><th class="r">offen</th><th class="r">Umfang</th></tr></thead><tbody>${t.map(x => `<tr><td class="mono">${x.datum}</td><td class="r num">${x.offen}</td><td class="r num">${x.umfang}</td></tr>`).join('')}</tbody></table></details>`;
  const durchlauf = `<table class="pt dicht" id="durchlauf"><thead><tr><th>Aufgabe</th><th>auf dem Board seit</th><th>in der Abschlussspalte</th><th class="r">Tage</th></tr></thead><tbody>${v.durchlauf.map(d => { const a = aufgabe(d.nummer); return `<tr class="klick" data-act="oeffnen" data-arg="${d.nummer}"><td class="tt"><span class="mono muted">#${d.nummer}</span> ${esc(a ? a.titel : '')}</td><td class="mono">${esc(d.eintritt)}</td><td class="mono">${esc(d.abschluss)}</td><td class="r num">${zahl1(d.tage)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Noch keine Aufgabe in der Abschlussspalte.</td></tr>'}<tr class="grp"><td colspan="3">MITTEL · MEDIAN</td><td class="r" id="durchlauf-kennzahl">${zahl1(v.mittel)} · ${zahl1(v.median)}</td></tr></tbody></table>`;
  return `<div class="leiste"><b>Burndown und Durchlaufzeit</b><span class="muted">${esc(S.board ? S.board.titel : '')} · aus den Commits von boards/${esc(S.ui.slug || '')}.md</span></div>
<div class="body bericht"><h3 class="dtitel">Offene Aufgaben je Tag</h3>${legende}<div class="dflaeche">${svg}<div class="tooltip" id="tooltip" hidden></div></div>${tabelle}<h3 class="dtitel">Durchlaufzeit je Aufgabe</h3>${durchlauf}</div>`;
}

/* ── Einrichten: Personen, Klassen, Quellen ── */
function vEinrichten() {
  const d = S.ui.einr, u = S.ui;
  const personen = d.personen.map((p, i) => `<div class="klz pz${p.aktiv ? '' : ' still'}" data-person="${esc(p.kuerzel)}"><span class="pk ${p.art === 'agent' ? 'pk-a' : 'pk-m'}${p.aktiv ? '' : ' pk-still'}">${esc(p.kuerzel.slice(0, 2).toUpperCase())}</span><span class="key">${esc(p.kuerzel)}</span><input class="inp" data-ef="pname" data-i="${i}" value="${esc(p.name)}" aria-label="Name ${esc(p.kuerzel)}"><span class="seg art"><span class="${p.art === 'human' ? 'an' : ''}" data-act="p-art" data-arg="${i}|human">Mensch</span><span class="${p.art === 'agent' ? 'an' : ''}" data-act="p-art" data-arg="${i}|agent">Agent</span></span><button class="btn btn-sym" data-act="p-still" data-arg="${i}" title="${p.aktiv ? 'stilllegen – nicht mehr wählbar, Name bleibt lesbar' : 'zurückholen'}" aria-label="${p.aktiv ? 'stilllegen' : 'zurückholen'} ${esc(p.kuerzel)}">${p.aktiv ? '⏸' : '↺'}</button></div>`).join('');
  const klassen = d.klassen.map((k, i) => `<div class="klz" data-klasse="${esc(k.schluessel)}"><span class="farbe${u.palFuer === i ? ' an' : ''}" style="${cv(k.farbe)}" data-act="k-pal" data-arg="${i}" title="Farbe wählen" role="button" aria-label="Farbe ${esc(k.schluessel)}"></span><span class="key">${esc(k.schluessel)}</span><input class="inp" data-ef="klabel" data-i="${i}" value="${esc(k.bezeichnung)}" aria-label="Bezeichnung ${esc(k.schluessel)}"><span class="n">${S.aufgaben.filter(a => a.klasse === k.schluessel).length}</span><button class="btn btn-sym" data-act="k-del" data-arg="${i}" title="entfernen – Aufgaben behalten den Schlüssel, ohne Farbe" aria-label="Klasse ${esc(k.schluessel)} entfernen">✕</button></div>${u.palFuer === i ? `<div class="pal"><span class="nm">gewählt: ${esc(k.farbe)}</span><div class="g">${PAL.map(f => `<span style="${cv(f)}" class="${k.farbe === f ? 'an' : ''}" data-act="k-farbe" data-arg="${i}|${f}" title="${f}" role="button" aria-label="${f}"></span>`).join('')}</div><div class="eig">Eigene Farbe <input class="inp mono" data-ef="khex" data-i="${i}" value="${k.farbe.startsWith('#') ? esc(k.farbe) : ''}" placeholder="#b04a8c" aria-label="Eigene Farbe"></div></div>` : ''}`).join('');
  return `<div class="einrichten"><div class="einr breit"><h3>PERSONEN <span class="mono">people:</span></h3><div class="hin">Menschen sind unter „Ich bin …“ wählbar; Agenten nennen sich an der API selbst. Stilllegen statt entfernen – der Name bleibt an Karten und Zeiten lesbar.</div>${personen}<div class="klz pz"><span class="pk pk-0">+</span><input class="inp mono" id="npk" placeholder="kürzel" aria-label="Neues Kürzel"><input class="inp" id="npn" placeholder="Name · Enter" data-enter="p-add" aria-label="Neuer Name"><span class="seg art"><span class="${u.nart !== 'agent' ? 'an' : ''}" data-act="n-art" data-arg="human">Mensch</span><span class="${u.nart === 'agent' ? 'an' : ''}" data-act="n-art" data-arg="agent">Agent</span></span><span></span></div>
<h3>KLASSEN <span class="mono">classes:</span></h3><div class="hin">Eine Aufgabe trägt höchstens eine Klasse; sie färbt die Karte und ist filterbar mit <span class="mono">class:schlüssel</span>.</div>${klassen}<div class="klz"><span class="farbe"></span><input class="inp mono" id="nck" placeholder="schlüssel" aria-label="Neuer Klassenschlüssel"><input class="inp" id="ncl" placeholder="Bezeichnung · Enter" data-enter="k-add" aria-label="Neue Bezeichnung"><span></span><span></span></div>
<h3>QUELLEN <span class="mono">sources:</span></h3><div class="felder"><span class="k">wbs</span><span class="w"><input class="mini-inp full" data-ef="wbs" value="${esc(d.quellen.wbs)}" aria-label="WBS-Pfad"></span><span class="k">requirements</span><span class="w"><input class="mini-inp full" data-ef="anf" value="${esc(d.quellen.anforderungen)}" aria-label="Anforderungspfad"></span></div>
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
  return `<span class="mono">${esc(z.ordner)}</span>${nd ? `<button class="lnk warn" id="t-defekt" data-act="pop" data-arg="defekt">${nd} ${nd === 1 ? 'defekte Datei' : 'defekte Dateien'}</button>` : ''}${z.eingerichtet ? `<span>${z.boards.length} ${z.boards.length === 1 ? 'Board' : 'Boards'}</span>` : '<span>kanbanD.md fehlt</span>'}${S.ui.fehler ? `<span class="fehl">${esc(S.ui.fehler)}</span>` : ''}<span class="rechts"><a href="/api" target="_blank" rel="noopener">API für Agenten</a></span>`;
}
