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
  return `<header class="kz"><div class="kz-z1" title="${esc(z.ordner)}"><button class="kz-btn kz-board${u.pop === 'board' ? ' auf' : ''}" id="t-board" data-act="pop" data-arg="board" aria-haspopup="true">${esc(b ? b.titel : 'kein Board')} ▾</button> <span class="mono">${esc(ordnerName)}</span></div><nav class="kz-nav"><a href="#/board/${esc(u.slug || '')}" class="an">Board</a></nav>${b ? `<div class="kz-werk"><button class="kz-btn" data-act="setup" title="Spalten dieses Boards einrichten">Spalten</button></div>` : ''}<div class="kz-z3">${S.live ? '' : '<span class="kz-btn leer" title="Die Verbindung zum Server ist unterbrochen; die Seite lädt neu, sobald sie zurück ist.">nicht live</span>'}${vIchKnopf()}</div></header>`;
}

function vIchKnopf() {
  const me = S.ich && personen().find(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv);
  return `<button class="kz-btn${S.ui.pop === 'ich' ? ' auf' : ''}${me ? '' : ' leer'}" id="t-ich" data-act="pop" data-arg="ich" aria-haspopup="true">${me ? pk(me.kuerzel) + esc(me.name) : 'nicht gewählt'} ▾</button>`;
}

/* ── Popover ── */
function vBoardPop() {
  const u = S.ui;
  return `<div class="pop" id="pop" data-for="t-board" data-al="l" style="width:300px" role="menu"><h4>BOARDS <span class="mono">boards/</span></h4>${S.zustand.boards.map(b => `<div class="iz${b.slug === u.slug ? ' an' : ''}" data-act="board-wahl" data-arg="${esc(b.slug)}" role="menuitem">${esc(b.titel)}<span class="muted mono">${esc(b.slug)}.md</span></div>`).join('')}<div class="iz neu"><input class="inp" id="board-neu" placeholder="Neues Board · Enter" data-enter="board-neu" aria-label="Name des neuen Boards"></div>${u.popFehler ? `<div class="warnh" role="alert">${esc(u.popFehler)}</div>` : ''}<div class="fuss">Alle Boards zeigen denselben Aufgabenbestand.</div></div>`;
}

function vPop() {
  const u = S.ui;
  if (u.pop === 'board') return vBoardPop();
  if (u.pop !== 'ich') return '';
  const ps = personen();
  const waehlbar = ps.filter(p => p.art === 'human' && p.aktiv);
  const nicht = ps.filter(p => p.art === 'agent' || !p.aktiv);
  return `<div class="pop" id="pop" data-for="t-ich" data-al="r" style="width:280px" role="menu"><h4>ICH BIN … <span class="mono">people:</span></h4>${u.ichNoetig ? '<div class="warnh">Für diese Aktion zuerst wählen, wer du bist.</div>' : ''}${waehlbar.map(p => `<div class="iz${p.kuerzel === S.ich ? ' an' : ''}" data-act="ich" data-arg="${esc(p.kuerzel)}" role="menuitem">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.kuerzel === S.ich ? 'gewählt' : ''}</span></div>`).join('')}${nicht.map(p => `<div class="iz aus" aria-disabled="true">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.aktiv === false ? 'stillgelegt' : 'Agent · nennt sich selbst'}</span></div>`).join('')}<div class="fuss">Die Wahl gilt nur für diesen Tab.</div></div>`;
}

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
  return `<div class="ka${fertig ? ' fertig' : ''}${ext ? ' fremd' : ''}" draggable="true" data-id="${a.nummer}"${cl ? ` data-c="1" style="${cv(cl.farbe)}"` : ''}><div class="r1"><span class="id">#${a.nummer}</span>${vHerkunft(a)}${a.labels.map(l => `<span class="lbl">${esc(l)}</span>`).join('')}</div><div class="t">${esc(a.titel)}</div><div class="r3"><span class="avs">${a.zustaendige.map(pk).join('')}</span>${cl ? `<span class="cls">${esc(cl.bezeichnung)}</span>` : ''}${tk}${due}</div>${ext ? `<div class="ein" data-ext="${ext.at}" data-datei="${esc(ext.datei)}">extern · ${esc(ext.datei)} · vor ${Math.round((Date.now() - ext.at) / 1000)} Sek</div>` : ''}</div>`;
}

function vFehlt(nr) {
  return `<div class="ka fehlt" draggable="true" data-id="${nr}"><div class="r1"><span class="id">#${nr}</span></div><div class="t">#${nr} — Aufgabe fehlt</div><div class="r3">keine Datei unter aufgaben/</div></div>`;
}

/* ── Board ── */
function vLane(sp, i, alle) {
  const letzte = i === alle.length - 1;
  const karten = sp.aufgaben.map(nr => { const a = aufgabe(nr); return a ? (a.archiviert ? '' : vKarte(a, letzte)) : vFehlt(nr); }).filter(Boolean);
  const neu = S.ui.adding === sp.name
    ? `<div class="bahn-add"><input class="inp" id="add-inp" placeholder="Titel · Enter legt an · Esc bricht ab" data-enter="add-ok" data-arg="${esc(sp.name)}" aria-label="Titel der neuen Karte"></div>`
    : `<button data-act="add" data-arg="${esc(sp.name)}">+ Karte</button>`;
  const ueber = sp.grenze && karten.length > sp.grenze;
  return `<section class="bahn" data-col="${esc(sp.name)}"><div class="bahn-kopf${ueber ? ' ueber' : ''}">${esc(sp.name)}${letzte ? ' <span class="ok" title="Abschlussspalte">✓</span>' : ''}${sp.grenze ? ` <span class="v"${ueber ? ' title="Grenze überschritten"' : ''}>Grenze ${sp.grenze}${ueber ? ' · überschritten' : ''}</span>` : ''}<span class="n">${karten.length}</span></div><div class="flaeche">${karten.join('') || '<div class="leer">leer</div>'}</div><div class="bahn-fuss">${neu}</div></section>`;
}
function vBoard() {
  const b = S.board;
  if (!b) return `<div class="leer">Kein Board im Ordner <span class="mono">boards/</span>.</div>`;
  return `<div class="bahnen">${b.spalten.map(vLane).join('')}</div>`;
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
