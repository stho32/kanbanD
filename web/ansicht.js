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

/* ── Kopfzeile ── */
function vKopf() {
  const u = S.ui, z = S.zustand;
  if (!z) return '<header class="kz"><div class="kz-z1">kanbanD</div></header>';
  const ordnerName = z.ordner.split('/').filter(Boolean).pop();
  if (!z.eingerichtet || u.first) return `<header class="kz"><div class="kz-z1">${esc(ordnerName)} <span class="mono">${esc(z.ordner)}</span></div><div class="kz-modus"><b>Erster Start</b><span class="muted">Ordner ohne kanbanD.md</span></div></header>`;
  const b = S.board;
  return `<header class="kz"><div class="kz-z1" title="${esc(z.ordner)}">${esc(b ? b.titel : ordnerName)} <span class="mono">${esc(ordnerName)}</span></div><nav class="kz-nav"><a href="#/board/${esc(u.slug || '')}" class="an">Board</a></nav><div class="kz-z3"></div></header>`;
}

/* ── Board ── */
function vLane(sp, i, alle) {
  const letzte = i === alle.length - 1;
  return `<section class="bahn" data-col="${esc(sp.name)}"><div class="bahn-kopf">${esc(sp.name)}${letzte ? ' <span class="ok" title="Abschlussspalte">✓</span>' : ''}${sp.grenze ? ` <span class="v">Grenze ${sp.grenze}</span>` : ''}<span class="n">${sp.aufgaben.length}</span></div><div class="flaeche"><div class="leer">leer</div></div></section>`;
}
function vBoard() {
  const b = S.board;
  if (!b) return `<div class="leer">Kein Board im Ordner <span class="mono">boards/</span>.</div>`;
  return `<div class="bahnen">${b.spalten.map(vLane).join('')}</div>`;
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
