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
  return `<header class="kz"><div class="kz-z1" title="${esc(z.ordner)}"><button class="kz-btn kz-board${u.pop === 'board' ? ' auf' : ''}" id="t-board" data-act="pop" data-arg="board" aria-haspopup="true">${esc(b ? b.titel : 'kein Board')} ▾</button> <span class="mono">${esc(ordnerName)}</span></div><nav class="kz-nav"><a href="#/board/${esc(u.slug || '')}" class="${u.view === 'board' ? 'an' : ''}">Board</a><a href="#/einrichten" class="${u.view === 'einrichten' ? 'an' : ''}">Einrichten</a></nav>${b && u.view === 'board' ? `<div class="kz-werk"><button class="kz-btn" data-act="setup" title="Spalten dieses Boards einrichten">Spalten</button></div>` : ''}<div class="kz-z3">${vLaufKnopf()}${S.live ? '' : '<span class="kz-btn leer" title="Die Verbindung zum Server ist unterbrochen; die Seite lädt neu, sobald sie zurück ist.">nicht live</span>'}${vIchKnopf()}</div></header>`;
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

/* ── Aufgabenfenster (Artboard D0003) ── */
const uhr = t => new Date(t).toTimeString().slice(0, 8);
/** Nummern der sichtbaren Karten in Board-Reihenfolge — zum Blättern. */
function sichtbareReihe() {
  const passt = a => a && !!a.archiviert === !!S.ui.archiv;
  if (!S.board) return S.aufgaben.filter(passt).map(a => a.nummer);
  return S.board.spalten.flatMap(sp => sp.aufgaben.filter(n => passt(aufgabe(n))));
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
  const haupt = `<div class="mod-main"><input class="titel" data-af="titel" value="${esc(a.titel)}" aria-label="Titel"><div class="abs"><h3>BESCHREIBUNG</h3><textarea class="besch" data-af="beschreibung" placeholder="Beschreibung in Markdown" aria-label="Beschreibung">${esc(a.beschreibung)}</textarea></div>${vFensterAbschnitte(a)}</div>`;
  const ps = personen().filter(p => p.aktiv || a.zustaendige.includes(p.kuerzel));
  const seite = `<aside class="mod-side">${vFensterSeite(a)}<div class="felder"><span class="k">column</span><span class="w">${spalte ? `<select data-af="spalte" aria-label="Spalte">${S.board.spalten.map(sp => `<option${sp === spalte ? ' selected' : ''}>${esc(sp.name)}</option>`).join('')}</select>` : '<span class="muted">nicht auf diesem Board</span>'}</span>
<span class="k">class</span><span class="w"><select data-af="klasse" aria-label="Klasse"><option value="">— keine —</option>${(S.zustand.einstellungen.klassen).map(k => `<option value="${esc(k.schluessel)}"${k.schluessel === a.klasse ? ' selected' : ''}>${esc(k.bezeichnung)}</option>`).join('')}${a.klasse && !cl ? `<option selected>${esc(a.klasse)}</option>` : ''}</select></span>
<span class="k">assignees</span><span class="w wrap">${ps.map(p => `<button class="as${a.zustaendige.includes(p.kuerzel) ? ' an' : ''}" data-act="zustaendig" data-arg="${esc(p.kuerzel)}"${p.aktiv ? '' : ' disabled title="stillgelegt"'} aria-pressed="${a.zustaendige.includes(p.kuerzel)}">${pk(p.kuerzel)}${esc(p.name)}</button>`).join('')}</span>
<span class="k">labels</span><span class="w"><input class="mini-inp full" data-af="labels" value="${esc(a.labels.join(', '))}" placeholder="ui, daten" aria-label="Labels"></span>
<span class="k">due</span><span class="w"><input type="date" class="mini-inp" data-af="faellig" value="${esc(a.faellig || '')}" aria-label="Fälligkeit"></span></div></aside>`;
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
  return `<div class="abs"><h3>TEILAUFGABEN <span class="mono">${ok}/${a.teilaufgaben.length}</span></h3>${a.teilaufgaben.map((t, j) => `<div class="chk${t.erledigt ? ' ok' : ''}"><i data-act="teil" data-arg="${j}" role="checkbox" aria-checked="${t.erledigt}" aria-label="${esc(t.text)}">${t.erledigt ? '✓' : ''}</i><span data-act="teil" data-arg="${j}">${esc(t.text)}</span><button class="btn btn-sym x" data-act="teil-weg" data-arg="${j}" title="entfernen" aria-label="Teilaufgabe ${esc(t.text)} entfernen">✕</button></div>`).join('')}<input class="inp add" placeholder="+ Teilaufgabe · Enter" data-enter="teil-neu" id="teil-neu" aria-label="Neue Teilaufgabe"></div>`;
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
function vBoardPop() {
  const u = S.ui;
  return `<div class="pop" id="pop" data-for="t-board" data-al="l" style="width:300px" role="menu"><h4>BOARDS <span class="mono">boards/</span></h4>${S.zustand.boards.map(b => `<div class="iz${b.slug === u.slug ? ' an' : ''}" data-act="board-wahl" data-arg="${esc(b.slug)}" role="menuitem">${esc(b.titel)}<span class="muted mono">${esc(b.slug)}.md</span></div>`).join('')}<div class="iz neu"><input class="inp" id="board-neu" placeholder="Neues Board · Enter" data-enter="board-neu" aria-label="Name des neuen Boards"></div>${u.popFehler ? `<div class="warnh" role="alert">${esc(u.popFehler)}</div>` : ''}<div class="fuss">Alle Boards zeigen denselben Aufgabenbestand.</div></div>`;
}

function vPop() {
  const u = S.ui;
  if (u.pop === 'board') return vBoardPop();
  if (u.pop === 'lauf') return alleLaufenden().length ? vLaufPop() : '';
  if (u.pop !== 'ich') return '';
  const ps = personen();
  const waehlbar = ps.filter(p => p.art === 'human' && p.aktiv);
  const nicht = ps.filter(p => p.art === 'agent' || !p.aktiv);
  return `<div class="pop" id="pop" data-for="t-ich" data-al="r" style="width:280px" role="menu"><h4>ICH BIN … <span class="mono">people:</span></h4>${u.ichNoetig ? '<div class="warnh">Für diese Aktion zuerst wählen, wer du bist.</div>' : ''}${waehlbar.map(p => `<div class="iz${p.kuerzel === S.ich ? ' an' : ''}" data-act="ich" data-arg="${esc(p.kuerzel)}" role="menuitem">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.kuerzel === S.ich ? 'gewählt' : ''}</span></div>`).join('')}${nicht.map(p => `<div class="iz aus" aria-disabled="true">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.aktiv === false ? 'stillgelegt' : 'Agent · nennt sich selbst'}</span></div>`).join('')}<div class="fuss">Die Wahl gilt nur für diesen Tab.</div></div>`;
}

/* ── Zeiten ── */
/** `JJJJ-MM-TT HH:MM` (Ortszeit) → Millisekunden */
const zeitMs = z => { const [d, t] = z.split(' '); const [j, m, tg] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(j, m - 1, tg, h, mi).getTime(); };
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

function vHerkunft(a) {
  const o = a.herkunft.length ? a.herkunft : ['thin air'];
  return `<span class="orgs">${o.map(x => `<span class="org${x === 'thin air' ? ' leer' : ''}">${esc(x)}</span>`).join('')}</span>`;
}

function vKarte(a, fertig) {
  const cl = klasse(a.klasse);
  const tk = a.teilaufgaben.length ? `<span class="tk">☑ ${a.teilaufgaben.filter(t => t.erledigt).length}/${a.teilaufgaben.length}</span>` : '';
  const due = a.faellig ? `<span class="due${!fertig && a.faellig <= isoD(Date.now() + 864e5) ? ' warn' : ''}">${esc(a.faellig)}</span>` : '';
  const ext = S.extern[a.nummer];
  const rs = laufende(a), eigen = rs.some(z => z.wer === S.ich), erster = rs.map(z => zeitMs(z.beginn)).sort((x, y) => x - y)[0];
  const lz = rs.length ? `<span class="lauf${eigen ? ' eigen' : ''}" title="läuft: ${esc(rs.map(z => per(z.wer).name).join(', '))}">${rs.length > 1 ? rs.length + '× ' : ''}<span data-since="${erster}">${hm(Date.now() - erster)}</span></span>` : '';
  return `<div class="ka${fertig ? ' fertig' : ''}${ext ? ' fremd' : ''}${S.ui.offen === a.nummer ? ' offen' : ''}" draggable="true" data-id="${a.nummer}" data-act="oeffnen" data-arg="${a.nummer}" tabindex="0"${cl ? ` data-c="1" style="${cv(cl.farbe)}"` : ''}><div class="r1"><span class="id">#${a.nummer}</span>${vHerkunft(a)}${a.labels.map(l => `<span class="lbl">${esc(l)}</span>`).join('')}${lz}</div><div class="t">${esc(a.titel)}</div><div class="r3"><span class="avs">${a.zustaendige.map(pk).join('')}</span>${cl ? `<span class="cls">${esc(cl.bezeichnung)}</span>` : ''}${tk}${due}</div>${ext ? `<div class="ein" data-ext="${ext.at}" data-datei="${esc(ext.datei)}">extern · ${esc(ext.datei)} · vor ${Math.round((Date.now() - ext.at) / 1000)} Sek</div>` : ''}</div>`;
}

function vFehlt(nr) {
  return `<div class="ka fehlt" draggable="true" data-id="${nr}"><div class="r1"><span class="id">#${nr}</span></div><div class="t">#${nr} — Aufgabe fehlt</div><div class="r3">keine Datei unter aufgaben/</div></div>`;
}

/* ── Board ── */
function vLane(sp, i, alle) {
  const letzte = i === alle.length - 1;
  const archiv = S.ui.archiv;
  const karten = sp.aufgaben.map(nr => { const a = aufgabe(nr); return a ? (!!a.archiviert === !!archiv ? vKarte(a, letzte) : '') : archiv ? '' : vFehlt(nr); }).filter(Boolean);
  const imArchiv = letzte && !archiv ? archivierteDesBoards().length : 0;
  const neu = S.ui.adding === sp.name
    ? `<div class="bahn-add"><input class="inp" id="add-inp" placeholder="Titel · Enter legt an · Esc bricht ab" data-enter="add-ok" data-arg="${esc(sp.name)}" aria-label="Titel der neuen Karte"></div>`
    : `<button data-act="add" data-arg="${esc(sp.name)}">+ Karte</button>`;
  const ueber = sp.grenze && karten.length > sp.grenze;
  return `<section class="bahn" data-col="${esc(sp.name)}"><div class="bahn-kopf${ueber ? ' ueber' : ''}">${esc(sp.name)}${letzte ? ' <span class="ok" title="Abschlussspalte">✓</span>' : ''}${sp.grenze ? ` <span class="v"${ueber ? ' title="Grenze überschritten"' : ''}>Grenze ${sp.grenze}${ueber ? ' · überschritten' : ''}</span>` : ''}<span class="n">${karten.length}</span></div><div class="flaeche">${karten.join('') || '<div class="leer">leer</div>'}${imArchiv ? `<div class="nach"><a href="#" data-act="archiv-an">Archiv (${imArchiv})</a></div>` : ''}</div>${archiv ? '' : `<div class="bahn-fuss">${neu}</div>`}</section>`;
}
const archivierteDesBoards = () => S.board ? S.board.spalten.flatMap(sp => sp.aufgaben).filter(n => { const a = aufgabe(n); return a && a.archiviert; }) : [];
function vBoard() {
  const b = S.board;
  if (!b) return `<div class="leer">Kein Board im Ordner <span class="mono">boards/</span>.</div>`;
  const leiste = S.ui.archiv ? `<div class="archbar">Archiv · ${archivierteDesBoards().length} Karten · Dateien bleiben im Ordner, Zeiten zählen in Berichten weiter<button class="lnk" data-act="archiv-aus">Archiv verlassen</button></div>` : '';
  return `${leiste}<div class="bahnen">${b.spalten.map(vLane).join('')}</div>`;
}
function vHinweis() {
  const t = S.ui.hinweis;
  return t ? `<div class="toast" role="status">${esc(t.text)}${t.rueckgaengig ? `<button class="lnk" data-act="zurueckholen" data-arg="${t.rueckgaengig}">rückgängig</button>` : ''}</div>` : '';
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
  return `<span class="mono">${esc(z.ordner)}</span>${z.eingerichtet ? `<span>${z.boards.length} ${z.boards.length === 1 ? 'Board' : 'Boards'}</span>` : '<span>kanbanD.md fehlt</span>'}${S.ui.fehler ? `<span class="fehl">${esc(S.ui.fehler)}</span>` : ''}`;
}
