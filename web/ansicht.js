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
/** Der Abschnitt `classes:` — in kanbanD.md und in der Board-Datei dieselbe Form; ein leerer Satz ist `classes: {}`. */
function klassenText(klassen) {
  return 'classes:' + (klassen.length ? '' : ' {}') + klassen.map(k => `\n  ${yamlSkalar(k.schluessel)}: {label: ${yamlSkalar(k.bezeichnung)}, color: ${yamlSkalar(k.farbe)}}`).join('');
}
function einstellungenText(e) {
  let s = '---\npeople:' + (e.personen.length ? '' : ' {}');
  for (const p of e.personen) s += `\n  ${yamlSkalar(p.kuerzel)}: {name: ${yamlSkalar(p.name)}, kind: ${p.art === 'agent' ? 'agent' : 'human'}${p.aktiv === false ? ', active: false' : ''}}`;
  s += '\n' + klassenText(ungestrichen(e.klassen));
  if ((e.signale || []).length) s += '\nsignals:' + e.signale.map(g => `\n  ${yamlSkalar(g.schluessel)}: {label: ${yamlSkalar(g.bezeichnung)}, color: ${yamlSkalar(g.farbe)}}`).join('');
  const pfade = q => pfadeZurDatei(q).map(([schluessel, wert]) => `${schluessel}: ${yamlSkalar(wert)}`);
  s += '\nsources:' + pfade(e.quellen).map(zeile => `\n  ${zeile}`).join('');
  const register = [...(e.quellen.anwendungen || [])].sort((a, b) => (a.kuerzel < b.kuerzel ? -1 : a.kuerzel > b.kuerzel ? 1 : 0));
  if (register.length) s += '\n  applications:' + register.map(a => `\n    ${yamlSkalar(a.kuerzel)}: {name: ${yamlSkalar(a.name.trim())}, ${pfade(a).join(', ')}}`).join('');
  return s + '\n---' + EINSTELLUNGEN_TEXT;
}
/** Der Text unter dem Frontmatter von kanbanD.md, wie src/format/einstellungen.rs `schreiben` ihn schreibt (R00209 AK 11). */
const EINSTELLUNGEN_TEXT = '\n\n# kanbanD\n\nEinstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).\nPersonen werden stillgelegt (`active: false`), nicht entfernt.\n';
function boardText(titel, spalten) {
  return `# ${titel}\n` + spalten.map(s => `\n## ${s}\n`).join('');
}

const personen = () => (S.zustand && S.zustand.einstellungen ? S.zustand.einstellungen.personen : []);
const per = k => personen().find(p => p.kuerzel === k) || { kuerzel: k, name: k, art: 'human', aktiv: true };
const pk = k => { const p = per(k); return `<span class="pk ${p.art === 'agent' ? 'pk-a' : 'pk-m'}${p.aktiv === false ? ' pk-still' : ''}" title="${esc(p.name)}${p.aktiv === false ? ' (stillgelegt)' : ''}">${esc(k.slice(0, 2).toUpperCase())}</span>`; };

/* ── Kopfzeile ── */
function vKopf() {
  const u = S.ui, z = S.zustand;
  if (!z) return '<header class="kz"><div class="kz-reihe"><div class="kz-z1">kanbanD</div></div></header>';
  const ordnerName = z.ordner.split('/').filter(Boolean).pop();
  if (u.setup) return `<header class="kz modus" data-stufe="${u.stufe}"><div class="kz-reihe"><div class="kz-z1">${esc(S.board.titel)} <span class="mono">boards/${esc(S.board.slug)}.md</span></div><div class="kz-modus"><b>Spalten einrichten</b><span class="muted">schreibt nur die Board-Datei, Aufgaben bleiben unberührt</span>${u.setup.fehler ? `<span class="fehl-kopf" role="alert">${esc(u.setup.fehler)}</span>` : ''}<div class="rechts"><button class="kz-btn" data-act="setup-weg">Verwerfen</button><button class="kz-btn haupt" data-act="setup-ok">Fertig</button>${vIchKnopf()}</div></div></div></header>`;
  if (u.view === 'review') return vReviewKopf();
  if (!z.eingerichtet || u.first) return `<header class="kz" data-stufe="${u.stufe}"><div class="kz-reihe"><div class="kz-z1">${esc(ordnerName)} <span class="mono">${esc(z.ordner)}</span></div><div class="kz-modus"><b>Erster Start</b><span class="muted">Ordner ohne kanbanD.md</span></div></div></header>`;
  const plaetze = kopfPlaetze(u.stufe, kopfAnsicht());
  const element = kopfElemente();
  return `<header class="kz" data-stufe="${u.stufe}">${plaetze.reihen.map(reihe => `<div class="kz-reihe">${reihe.map(schluessel => element[schluessel]()).join('')}</div>`).join('')}</header>`;
}

function kopfAnsicht() {
  if (S.board && S.ui.view === 'board') return 'board';
  if (S.ui.view === 'aufgaben') return 'aufgaben';
  return 'sonst';
}

/** Je Platz aus kopfPlaetze (web/kopfzeile.js) das Markup des Elements. */
function kopfElemente() {
  const u = S.ui, b = S.board;
  return {
    board: () => `<div class="kz-z1"><button class="kz-btn kz-board${u.pop === 'board' ? ' auf' : ''}" id="t-board" data-act="pop" data-arg="board" aria-haspopup="dialog" title="${esc(S.zustand.ordner)}"><span class="kz-board-name">${esc(b ? b.titel : 'kein Board')}</span> ▾</button></div>`,
    navigation: vNavigation,
    seitenmenue: vSeitenKnopf,
    filter: () => `<input class="inp" id="flt" placeholder="Filtern: Text, #Nr, @wer, class:bug, origin:I0023, label:ui  ( / )" value="${esc(u.filter)}" aria-label="Filter">`,
    bereich: vBereich,
    bereichChips: vBereichChips,
    listenbereich: vListenbereich,
    neu: () => '<button type="button" class="kz-btn neu-btn" data-act="add" data-arg="" title="Neue Aufgabe (n)" aria-label="+ Neue Aufgabe">+ <span class="lang">Neue Aufgabe</span></button>',
    luecke: () => '<span class="kz-luecke"></span>',
    lauf: vLaufKnopf,
    live: () => S.live ? '' : '<span class="kz-btn leer kz-live" title="Die Verbindung zum Server ist unterbrochen; die Seite lädt neu, sobald sie zurück ist.">nicht live</span>',
    ich: vIchKnopf,
    mehr: () => `<button type="button" class="kz-btn kz-mehr${u.pop === 'mehr' ? ' auf' : ''}" id="t-mehr" data-act="pop" data-arg="mehr" aria-haspopup="menu" aria-label="Mehr" title="Mehr">${DREI_PUNKTE}</button>`,
  };
}
const DREI_PUNKTE = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>';
/** Der Papierkorb des Kopf-Auslösers „Endgültig löschen“ (R00141, D0003): Strich-Symbol, wie die übrigen `.i`-Zeichen. */
const PAPIERKORB = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M10 7V5h4v2M8 7l1 12h6l1-12"></path></svg>';

/** Die aktuelle Seite: Klasse an fürs Auge, aria-current für die Hilfstechnik — beide aus demselben Wahrheitswert (R00113, ADR-0018 Regel 5). */
function aktuelleSeite(istAktuell) {
  if (istAktuell) return { klasse: 'an', attribut: ' aria-current="page"' };
  return { klasse: '', attribut: '' };
}
const cssKlassen = (...namen) => namen.filter(Boolean).join(' ');

/** Die Leiste ab 600 px trägt nur die zwei häufigen Ziele Board und Berichte ▾ (R00140); die vier seltenen stehen im Menü „…“. */
function vNavigation() {
  const u = S.ui;
  const board = aktuelleSeite(u.view === 'board'), berichte = aktuelleSeite(u.view.startsWith('berichte'));
  return `<nav class="kz-nav"><a href="#/board/${esc(u.slug || '')}" class="${board.klasse}"${board.attribut}>Board</a><a href="#" id="t-ber" class="${berichte.klasse}${u.pop === 'ber' ? ' auf' : ''}"${berichte.attribut} data-act="pop" data-arg="ber" aria-haspopup="menu">Berichte<span class="dd">▾</span></a></nav>`;
}

/** Unter 600 px ersetzt ein Knopf mit dem Namen der aktuellen Seite die Navigationsleiste (R00101, PO 2026-10-31). */
function vSeitenKnopf() {
  const name = seitenName();
  return `<button type="button" class="kz-btn kz-seite${S.ui.pop === 'seite' ? ' auf' : ''}" id="t-seite" data-act="pop" data-arg="seite" aria-haspopup="menu" aria-label="Seite: ${name}">${name} ▾</button>`;
}

const seitenName = () => seitenNameVon(S.ui.view);

/** Unter 600 px trägt das Seitenmenü dieselben zwei Ziele wie die Leiste (R00140); die vier seltenen liegen im Menü „…“. */
function vSeitenPop() {
  const u = S.ui, name = seitenName();
  const ziel = (titel, hash) => {
    const zielEintrag = aktuelleSeite(name === titel);
    return `<a class="${cssKlassen('iz', zielEintrag.klasse)}"${zielEintrag.attribut} href="${hash}" data-act="seite" data-arg="${hash}" role="menuitem" tabindex="-1">${esc(titel)}</a>`;
  };
  const berichteEintrag = aktuelleSeite(name === 'Berichte');
  const berichte = `<button type="button" class="${cssKlassen('iz', berichteEintrag.klasse)}"${berichteEintrag.attribut} data-act="pop" data-arg="ber" role="menuitem" tabindex="-1" aria-haspopup="menu">Berichte<span class="muted">▸</span></button>`;
  return `<div class="pop kz-menue" id="pop" data-for="t-seite" data-al="l" role="menu" aria-label="Seite"><div class="pop-kopf">SEITE</div>${ziel('Board', '#/board/' + esc(u.slug || ''))}${berichte}</div>`;
}

const BEREICHE = [['alle', 'alle'], ['meine', 'meine'], ['agenten', 'Agenten']];
function vBereich() {
  const u = S.ui;
  return `<span class="seg" role="radiogroup" aria-label="Bereich">${BEREICHE.map(([k, t]) => `<span class="${u.bereich === k ? 'an' : ''}" data-act="bereich" data-arg="${k}" role="radio" aria-checked="${u.bereich === k}">${t}</span>`).join('')}</span>`;
}

/** Unter 840 px steht der Bereich als Filter-Chips (M3) in der Werkzeugzeile; die Tippfläche kommt aus der zentralen Regel für pointer: coarse.
 *  Der gewählte Zustand trägt ein sichtbares Häkchen (R00117, ADR-0011 Regel 3 + M3); `aria-checked` bleibt die Wahrheit und der
 *  zugängliche Name bleibt die Beschriftung — das Zeichen ist rein darstellend (aria-hidden). */
function vBereichChips() {
  const u = S.ui;
  return `<span class="kz-chips" role="radiogroup" aria-label="Bereich">${BEREICHE.map(([k, t]) => `<button type="button" class="kz-chip${u.bereich === k ? ' an' : ''}" data-act="bereich" data-arg="${k}" role="radio" aria-checked="${u.bereich === k}">${u.bereich === k ? '<span class="kz-auswahl-haken" aria-hidden="true">✓</span> ' : ''}${t}</button>`).join('')}</span>`;
}

/** Menü „Mehr“ (R00140, UX-Vorprüfung #105): die vier seltenen Ziele als erste Gruppe, darunter genau ein
 *  Trenner, dann die Werkzeuge. Jeder Eintrag löst dieselbe Aktion aus wie früher sein Knopf. */
function vMehrPop() {
  const u = S.ui;
  /** Ein Ziel in der Form von vSeitenPop: menuitem-Link mit tabindex="-1", Ziel im Hash, Markierung über aktuelleSeite. */
  const mehrZiel = (titel, istAktuell, hash) => {
    const eintrag = aktuelleSeite(istAktuell);
    return `<a class="${cssKlassen('iz', eintrag.klasse)}"${eintrag.attribut} href="${hash}" data-act="seite" data-arg="${hash}" role="menuitem" tabindex="-1">${esc(titel)}</a>`;
  };
  const wbs = gebunden().map(a => {
    const titel = gebunden().length > 1 ? 'WBS · ' + a.kuerzel : 'WBS';
    return mehrZiel(titel, u.view === 'wbs' && wbsKuerzel() === a.kuerzel, '#/wbs/' + esc(encodeURIComponent(a.kuerzel)));
  }).join('');
  const ziele = `${mehrZiel('Aufgaben', u.view === 'aufgaben', '#/aufgaben')}${mehrZiel('Personen', u.view === 'personen', '#/personen')}${wbs}${mehrZiel('Einrichten', u.view === 'einrichten', '#/einrichten')}`;
  const eintrag = {
    signale: () => `<button type="button" class="iz${u.signaleOben ? ' an' : ''}" id="signale-oben" role="menuitemcheckbox" tabindex="-1" aria-checked="${!!u.signaleOben}" data-act="signale-oben" title="Karten mit Signal zuerst zeigen — nur die Anzeige, die Reihenfolge im Board bleibt">${u.signaleOben ? '<span class="kz-auswahl-haken" aria-hidden="true">☑</span>' : ''}Signale oben</button>`,
    spalten: () => '<button type="button" class="iz" id="mehr-spalten" role="menuitem" tabindex="-1" data-act="setup" title="Spalten dieses Boards einrichten">Spalten einrichten</button>',
    darstellung: vThemaEintrag,
    lauf: () => alleLaufenden().length ? `<button type="button" class="iz" id="mehr-lauf" role="menuitem" tabindex="-1" data-act="pop" data-arg="lauf">Läuft gerade<span class="muted">${alleLaufenden().length}</span></button>` : '',
    ich: () => `<button type="button" class="iz" id="mehr-ich" role="menuitem" tabindex="-1" data-act="pop" data-arg="ich">Ich bin …<span class="muted">${esc(ichNameOderLeer())}</span></button>`,
  };
  const plaetze = kopfPlaetze(u.stufe, kopfAnsicht());
  return `<div class="pop kz-menue" id="pop" data-for="t-mehr" data-al="r" role="menu" aria-label="Mehr"><div class="pop-kopf">MEHR</div>${ziele}<div role="separator"></div>${plaetze.mehr.map(schluessel => eintrag[schluessel]()).join('')}</div>`;
}

function ichNameOderLeer() {
  const me = ichPerson();
  if (me) return me.name;
  return 'nicht gewählt';
}

const THEMA_NAME = { system: 'System', light: 'Hell', dark: 'Dunkel' }, THEMA_ZEICHEN = { system: '◐', light: '☀', dark: '☾' };
/** Darstellung reihum System → Hell → Dunkel (R00070). */
function vThemaEintrag() {
  const t = S.thema, weiter = THEMEN[(THEMEN.indexOf(t) + 1) % THEMEN.length];
  return `<button type="button" class="iz" id="t-thema" role="menuitem" tabindex="-1" data-act="thema" data-thema="${t}" title="Darstellung: ${THEMA_NAME[t]} — Klick: ${THEMA_NAME[weiter]}" aria-label="Darstellung: ${THEMA_NAME[t]}">Darstellung: ${THEMA_NAME[t]}<span class="muted">${THEMA_ZEICHEN[t]}</span></button>`;
}
const UHR = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>';
function vLaufKnopf() {
  const n = alleLaufenden().length;
  return n ? `<button class="kz-btn${S.ui.pop === 'lauf' ? ' auf' : ''}" id="t-lauf" data-act="pop" data-arg="lauf" aria-haspopup="dialog">${UHR}${n}<span class="lang"> ${n === 1 ? 'läuft' : 'laufen'}</span></button>` : '';
}

function vLaufPop() {
  const r = alleLaufenden().sort((x, y) => zeitMs(x.z.beginn) - zeitMs(y.z.beginn));
  return `<div class="pop" id="pop" data-for="t-lauf" data-al="r" style="width:450px" role="dialog" aria-label="Läuft gerade"><h4 class="pop-kopf">LÄUFT GERADE <span class="mono">${r.length} Timer · ${new Set(r.map(x => x.a.nummer)).size} Aufgaben</span></h4>${r.map(({ a, z }) => `<div class="pz2${z.wer === S.ich ? ' eigen' : ''}" data-act="oeffnen" data-arg="${a.nummer}">${pk(z.wer)}<button type="button" class="id" data-act="oeffnen" data-arg="${a.nummer}" aria-label="#${a.nummer} öffnen">#${a.nummer}</button><span class="t">${esc(a.titel)}<small>${esc(per(z.wer).name)}${z.wer === S.ich ? ' · ich' : ''} · seit ${esc(ortszeit(z.beginn).slice(11))}</small></span>${vLaufChip({ beginn: laufBeginn(a, z), eigen: z.wer === S.ich, rahmen: 'b' })}<button class="btn${z.wer === S.ich ? ' btn-haupt' : ''}" data-act="stop" data-arg="${a.nummer}|${esc(z.wer)}" title="stoppen" aria-label="Timer von ${esc(per(z.wer).name)} stoppen">■</button></div>`).join('')}<div class="fuss">Klick auf eine Zeile öffnet die Aufgabe · fremde Timer lassen sich stoppen</div></div>`;
}

const ICH_LEER = 'nicht gewählt';
/** „Ich bin …“ im Kopf (R00003). Ohne gewählte Person zeigt compact nur einen hohlen Chip und ▾ (R00200, 99 px „nicht gewählt ▾“
    ließen die Kopfzeile bei 320 px quer scrollen): der Name steht als versteckter Text im Knopf, damit er aus dem Inhalt kommt
    (WCAG 2.5.3), und als Tooltip; ▾ ist ausgeblendet, damit es nicht mitgelesen wird. Ab medium steht „nicht gewählt ▾“ sichtbar. */
function vIchKnopf() {
  const me = S.ich && personen().find(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv);
  const kopf = `<button class="kz-btn${S.ui.pop === 'ich' ? ' auf' : ''}${me ? '' : ' leer'}" id="t-ich" data-act="pop" data-arg="ich" aria-haspopup="menu"`;
  if (me) return `${kopf}>${pk(me.kuerzel)}<span class="ich-name">${esc(me.name)}</span> ▾</button>`;
  if (S.ui.stufe === 'compact') return `${kopf} title="${ICH_LEER}"><span class="pk pk-0"></span><span class="vh">${ICH_LEER}</span><span aria-hidden="true">▾</span></button>`;
  return `${kopf}>${ICH_LEER} ▾</button>`;
}
/* ── Schnelleingabe: Vorschau der erkannten Felder ── */
function schnellUmfeld() { return { personen: personen().filter(p => p.aktiv), klassen: vorratDerNeuenAufgabe() }; }
/** Die erkannte Klasse der Schnelleingabe aus dem Vorrat des Zielboards; kennt er sie nicht, steht ihr Schlüssel ohne Farbe. */
function vSchnellKlasse(schluessel) {
  if (!schluessel) return '';
  const cl = vorratDerNeuenAufgabe().find(k => k.schluessel === schluessel);
  if (!cl) return `<span class="cls">${esc(schluessel)}</span>`;
  return `<span class="cls" style="${cv(cl.farbe)}">${esc(cl.bezeichnung)}</span>`;
}
function vSchnellVorschau(text) {
  const s = schnelleingabe(text, schnellUmfeld(), new Date());
  const teile = [...s.zustaendige.map(k => pk(k) + esc(per(k).name)), vSchnellKlasse(s.klasse), ...s.labels.map(l => `<span class="lbl">${esc(l)}</span>`), s.faellig ? `<span class="due">fällig ${esc(datumLang(s.faellig))}</span>` : '', ...s.herkunft.map(h => `<span class="org">${esc(h)}</span>`)].filter(Boolean);
  return teile.length ? `<span class="muted">→ ${esc(s.titel)}</span>${teile.join('')}` : '<span class="muted">@kürzel · class: · label: · due:morgen · I0001</span>';
}
/** Beschriftung einer Feldzeile mit Schlüssel (ADR-0013 N1): deutsch aus FELDER, darunter der Schlüssel der Datei in Mono, nie in `.k`. */
function vBeschriftung(schluessel) {
  return `<span class="kb"><span class="k">${esc(FELDER[schluessel])}</span><span class="sl">${esc(schluessel)}</span></span>`;
}
/** Die vier Feldzeilen der Seitenleiste und ihre Beschriftungsschlüssel in `FELDER` (R00146 FA 4/12). */
const FELD_BESCHRIFTUNG = { spalte: 'column', klasse: 'class', labels: 'labels', faellig: 'due' };
/** Eine Feldzeile (Spalte, Klasse, Labels, Fällig) mit Beschriftung und Wert — die eine Stelle für „Details“ und die schmale
    Spalte im Inhalt (R00146 FA 4/12). Der Wert trägt denselben Schlüssel `data-af` wie sein Gegenstück; `schmal` (Spalte)
    stellt die Beschriftung über den Wert und lässt die Schnellknöpfe am Datumsfeld weg (S3). */
function vFeldZeile(feld, a, schmal) {
  const umbruch = feld === 'faellig' && !schmal ? ' wrap' : '';
  return `${vBeschriftung(FELD_BESCHRIFTUNG[feld])}<span class="w${umbruch}">${vFeldWert(feld, a, schmal)}</span>`;
}
/** Der Wert einer Feldzeile; „Spalte“ kennt drei Fälle: bewegen (Board), „nicht auf diesem Board“ (kein Board) und, schmal,
    den Fokusrückfall `#inhalt-spalte`, wenn das Feld unter einem Live-Ereignis wegfällt (R00146 FA 14, ADR-0010 N7). */
function vFeldWert(feld, a, schmal) {
  if (feld === 'spalte') {
    const spalte = S.board && S.board.spalten.find(sp => sp.aufgaben.includes(a.nummer));
    if (!spalte) return '<span class="muted">nicht auf diesem Board</span>';
    const ort = schmal ? ' data-ort="#inhalt-spalte"' : '';
    return `<select data-af="spalte" aria-label="Spalte"${ort}>${S.board.spalten.map(sp => `<option${sp === spalte ? ' selected' : ''}>${esc(sp.name)}</option>`).join('')}</select>`;
  }
  if (feld === 'klasse') return vKlassenWahl('data-af', a.klasse, vorrat(a));
  if (feld === 'labels') return `<input class="mini-inp full" data-af="labels" value="${esc(a.labels.join(', '))}" placeholder="ui, daten" aria-label="Labels">`;
  const knoepfe = schmal ? '' : `<span class="due-knoepfe">${[['0', 'heute'], ['1', 'morgen'], ['7', '+1 Woche']].map(([n, t]) => `<button class="as" data-act="faellig" data-arg="${n}">${t}</button>`).join('')}${a.faellig ? '<button class="as" data-act="faellig" data-arg="" aria-label="Fälligkeit entfernen">✕</button>' : ''}</span>`;
  return `<input type="date" class="mini-inp" data-af="faellig" value="${esc(a.faellig || '')}" aria-label="Fälligkeit">${knoepfe}`;
}
/* ── Dialog „Neue Aufgabe“ — alle Felder sofort, wie in Kanbanflow ── */
/** id der Meldung im Fuß von „Neue Aufgabe“; bleibt über jedes Neuzeichnen gleich, damit der Titel auf sie verweisen kann. */
const NEU_MELDUNG = 'neu-meldung';
/** Solange die Meldung den leeren Titel betrifft, ist der Titel ungültig und verweist auf sie (R00111 AK 5). */
function titelVerweis(f) {
  const titelFehlt = f.fehler && f.fehlerFeld === 'titel';
  if (!titelFehlt) return '';
  return ` aria-invalid="true" aria-describedby="${NEU_MELDUNG}"`;
}
/** Überschrift zweiter Ebene mit dem Namen des Fensters, verborgen vor dem sichtbaren Kopf: die Abschnitte (h3) folgen ohne Sprung (R00184, ADR-0018 Regel 2). */
const vFensterUeberschrift = name => `<h2 class="vh">${esc(name)}</h2>`;

function vNeu() {
  const f = S.ui.neu;
  if (!f) return '';
  const boards = (S.boards || []).filter(x => !x.archiviert);
  const b = boards.find(x => x.slug === f.board);
  const ps = personen().filter(p => p.aktiv);
  const klassen = vorratDerNeuenAufgabe(), cl = klassen.find(k => k.schluessel === f.klasse);
  const stil = cl ? ` style="${cv(cl.farbe)}"` : '';
  const haupt = `<div class="mod-main"><input class="titel" id="neu-titel" data-nf="titel" value="${esc(f.titel)}" placeholder="Titel · Enter legt an · Liste einfügen legt alle an" data-mehrfach="neu" aria-label="Titel der neuen Aufgabe"${titelVerweis(f)}><div class="schnell" id="neu-vorschau" aria-live="polite">${f.titel.trim() ? vSchnellVorschau(f.titel) : '<span class="muted">Kürzel: @kürzel · class: · label: · due:morgen · I0001</span>'}</div>
<div class="abs"><h3>BESCHREIBUNG</h3><textarea class="besch" data-nf="beschreibung" placeholder="Beschreibung in Markdown" aria-label="Beschreibung der neuen Aufgabe">${esc(f.beschreibung)}</textarea></div>
<div class="abs"><h3>TEILAUFGABEN <span class="mono">${f.teil.length}</span></h3>${f.teil.map(t => `<div class="chk"><i></i><span>${esc(t.text)}</span><button class="btn btn-sym x" data-act="nf-teil-weg" data-arg="${esc(t.kennung)}" data-halt="nf-teil-weg:${esc(t.text)}" data-ort="#neu-teil" aria-label="Teilaufgabe ${esc(t.text)} entfernen">✕</button></div>`).join('')}<input class="inp add" id="neu-teil" placeholder="+ Teilaufgabe · Enter · Liste einfügen" data-enter="nf-teil" data-mehrfach="neu-teil" aria-label="Neue Teilaufgabe der neuen Aufgabe"></div></div>`;
  const seite = `<aside class="mod-side"><div class="felder">
${vBeschriftung('board')}<span class="w"><select data-nf="board" aria-label="Board"><option value="">— kein Board —</option>${boards.map(x => `<option value="${esc(x.slug)}"${x.slug === f.board ? ' selected' : ''}>${esc(x.titel)}</option>`).join('')}</select></span>
${b ? `${vBeschriftung('column')}<span class="w"><select data-nf="spalte" aria-label="Spalte">${b.spalten.map(sp => `<option${sp.name === f.spalte ? ' selected' : ''}>${esc(sp.name)}</option>`).join('')}</select></span>` : ''}
${vBeschriftung('class')}<span class="w">${vKlassenWahl('data-nf', f.klasse, klassen)}</span>
${vBeschriftung('assignees')}<span class="w wrap" role="group" aria-label="Zuständig">${ps.map(p => `<button class="as${f.zust.includes(p.kuerzel) ? ' an' : ''}" data-act="nf-zust" data-arg="${esc(p.kuerzel)}" aria-pressed="${f.zust.includes(p.kuerzel)}">${pk(p.kuerzel)}${esc(p.name)}</button>`).join('')}</span>
${vBeschriftung('labels')}<span class="w"><input class="mini-inp full" data-nf="labels" value="${esc(f.labels)}" placeholder="ui, daten" aria-label="Labels der neuen Aufgabe"></span>
${vBeschriftung('due')}<span class="w wrap"><input type="date" class="mini-inp" data-nf="faellig" value="${esc(f.faellig)}" aria-label="Fälligkeit der neuen Aufgabe"><span class="due-knoepfe">${[['0', 'heute'], ['1', 'morgen'], ['7', '+1 Woche']].map(([n, t]) => `<button class="as" data-act="nf-faellig" data-arg="${n}">${t}</button>`).join('')}</span></span>
${vBeschriftung('origins')}<span class="w"><input class="mini-inp full" data-nf="herkunft" value="${esc(f.herkunft)}" placeholder="I0001 R00014" title="${HERKUNFT_HILFE}" aria-label="Herkunft der neuen Aufgabe"></span></div></aside>`;
  const fuss = `<div class="mod-fuss neu-fuss">${f.fehler ? `<span class="fehl" id="${NEU_MELDUNG}" role="alert">${esc(f.fehler)}</span>` : '<span class="tastenhinweis"><kbd>Enter</kbd> im Titel oder <kbd>Strg</kbd>+<kbd>Enter</kbd> legt an · <kbd>Umschalt</kbd>+<kbd>Strg</kbd>+<kbd>Enter</kbd> und weitere · <kbd>Esc</kbd> abbrechen</span>'}<span class="nf-knoepfe"><button class="btn" data-act="nf-zu">Abbrechen</button><button class="btn" data-act="nf-anlegen" data-arg="weitere">Anlegen und weitere</button><button class="btn btn-haupt" data-act="nf-anlegen" data-arg="">Anlegen</button></span></div>`;
  return `<div class="mod-bg" data-act="nf-zu-bg"><div class="mod neu" id="neu-fenster" role="dialog" aria-label="Neue Aufgabe"${stil}>${vFensterUeberschrift('Neue Aufgabe')}<div class="mod-kopf"><span class="id">Neue Aufgabe</span>${b ? `<span class="pfad">${esc(b.titel)} · ${esc(f.spalte || '')}</span>` : '<span class="pfad">ohne Board</span>'}<div class="rechts"><button class="btn btn-sym" data-act="nf-zu" aria-label="Schließen">✕</button></div></div><div class="mod-body">${haupt}${seite}</div>${vHinweisAnker('neu')}${fuss}</div></div>`;
}

/* ── Aufgabenfenster (Artboard D0003) ── */
const uhr = t => new Date(t).toTimeString().slice(0, 8);
const ARCHIV = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4"></rect><path d="M5 8v11h14V8M9 12h6"></path></svg>';
const KETTE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"></path></svg>';
const ARCHIV_HOCH = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4"></rect><path d="M5 8v11h14V8M12 16v-5M9 13l3-3 3 3"></path></svg>';
/** Der Ansichts-Auslöser im Fensterkopf (R00145 FA 4/5): Textknopf mit Caret, `aria-haspopup`/`aria-expanded`, Name „Ansicht: <Name>“. */
const ANSICHT_KNOPF = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
/** Die gewählte Ansicht einer Aufgabe: der gemerkte Schlüssel, wenn die Aufgabe ihn führt, sonst „Inhalt“ (R00145 FA 2, generisch). */
function ansichtDerAufgabe(a) {
  return rueckfallAnsicht(reiterSchluessel(a), S.ui.tab);
}
/** Auslöser und Menü des Ansichtswechsels (R00145): eine Liste, ein Zustand (`S.ui.tab`), Menüform `menuitemradio` mit `aria-checked`.
    Die Markierung trägt `aria-checked` am Eintrag und ein sichtbares ✓ im festen Gutter (`.fm-haken`), damit alle Texte gleich beginnen. */
function vAnsichtWahl(a, gewaehlt) {
  const offen = S.ui.fensterMenue === 'ansicht';
  const name = (reiterDerAufgabe(a).find(([k]) => k === gewaehlt) || [null, 'Inhalt'])[1];
  const knopf = `<button type="button" class="fm-aus" data-act="fenster-menue" data-arg="ansicht" aria-haspopup="menu" aria-expanded="${offen}" aria-label="Ansicht: ${esc(name)}">${esc(name)}<span class="fm-caret" aria-hidden="true">▾</span></button>`;
  const eintraege = reiterDerAufgabe(a).map(([k, t]) => {
    const an = k === gewaehlt;
    return `<button type="button" role="menuitemradio" aria-checked="${an}" tabindex="-1" class="fm-e${an ? ' an' : ''}" data-act="fenster-ansicht" data-arg="${k}"><span class="fm-haken" aria-hidden="true">${an ? '✓' : ''}</span><span class="fm-text">${esc(t)}</span></button>`;
  }).join('');
  const menue = offen ? `<div class="fm" role="menu" aria-label="Ansicht der Aufgabe" data-art="ansicht">${eintraege}</div>` : '';
  return `<span class="fm-anker">${knopf}${menue}</span>`;
}

/** Panel „Kosten“ (R00105, R00165 AK 10): oben die Schätzung bzw. die alten Posten aus dem Preisetikett, darunter die
    Kosteneinträge; nur lesend. Ein Name ohne Silbengrenze scrollt in .ko-scroll quer. */
function vKostenPanel(a) {
  return `<div class="mod-main ko-panel">${vKostenSchaetzung(a)}${vKosteneintraege(a.kosteneintraege || [])}<p class="ko-hin">liest nur · gesetzt über die API</p></div>`;
}
function vKostenSchaetzung(a) {
  if (!a.cost) return '<p class="ko-hin ko-ohne">Keine Schätzung an dieser Aufgabe.</p>';
  const k = kostenInCent(a.cost), t = kostentabelle(k);
  const rumpf = t.zeilen.map(z => vKostenZeile(z.text, z, t.spalteTokens, k.waehrung, '')).join('');
  let zaehlt = 'Schätzung · zählt im Bericht „Kosten“ nicht';
  if (hatAltePosten(a)) zaehlt = 'Posten ohne Datum / ohne Rolle / ohne Spalte · zählen im Bericht „Kosten“ als angefallen';
  return `<div class="ko-scroll" tabindex="0" role="group" aria-label="${esc(t.beschriftung)}"><table class="ko-tab"><caption>${esc(t.beschriftung)}</caption><thead>${vKostenKopf(t.spalteTokens)}</thead><tbody>${rumpf}</tbody>${vKostenSumme(t, k.waehrung)}</table></div>${vKostenBasis(t.basis)}<p class="ko-hin ko-zaehlt">${zaehlt}</p>`;
}
/** Tabelle der Kosteneinträge: neueste oben, je Währung eine Summenzeile; Rolle und Spalte stehen, wie sie gespeichert sind. */
function vKosteneintraege(eintraege) {
  if (!eintraege.length) return '';
  const t = kosteneintragstabelle(eintraege);
  let kopfTokens = '';
  if (t.spalteTokens) kopfTokens = '<th scope="col" class="r tk">Tokens</th>';
  const kopf = `<tr><th scope="col">Zeitpunkt</th><th scope="col">Rolle</th><th scope="col">Spalte</th>${kopfTokens}<th scope="col" class="r">Betrag</th></tr>`;
  const rumpf = t.zeilen.map(z => `<tr><th scope="row" class="zp">${esc(zeitpunktLang(z.zeitpunkt))}</th><td class="t">${esc(z.rolle)}</td><td class="t">${esc(z.spalte)}</td>${vEintragTokens(t.spalteTokens, z.tokens, '—')}<td class="r">${esc(geld(z.cent, z.waehrung))}</td></tr>`).join('');
  const fuss = t.summen.map(s => `<tr class="ko-summe"><th scope="row" colspan="3">Summe</th>${vEintragTokens(t.spalteTokens, s.tokens, '')}<td class="r">${esc(geld(s.cent, s.waehrung))}</td></tr>`).join('');
  return `<div class="ko-scroll ko-eintraege" tabindex="0" role="group" aria-label="Angefallene API-Kosten"><table class="ko-tab"><caption>Angefallene API-Kosten</caption><thead>${kopf}</thead><tbody>${rumpf}</tbody><tfoot>${fuss}</tfoot></table></div>`;
}
/** Zelle der Tokens: ohne Wert `ohneWert` — „—“ in einer Eintragszeile, leer in den weiteren Summenzeilen. */
function vEintragTokens(spalteTokens, tokens, ohneWert) {
  if (!spalteTokens) return '';
  if (tokens == null) return `<td class="r tk leer">${ohneWert}</td>`;
  return `<td class="r tk">${tokens.toLocaleString('de-DE')}</td>`;
}
function vKostenKopf(spalteTokens) {
  let tokens = '';
  if (spalteTokens) tokens = '<th scope="col" class="r">Tokens</th>';
  return `<tr><th scope="col">Position</th>${tokens}<th scope="col" class="r">niedrig</th><th scope="col" class="r">hoch</th></tr>`;
}
function vKostenZeile(text, z, spalteTokens, waehrung, klasse) {
  const betrag = cent => `<td class="r">${esc(geld(cent, waehrung))}</td>`;
  return `<tr${klasse}><th scope="row">${vPositionsname(text)}</th>${vTokenZelle(spalteTokens, z.tokens)}${betrag(z.niedrig)}${betrag(z.hoch)}</tr>`;
}
/** Ein Wort ohne zwei Vokalgruppen hat keine Silbengrenze: die Trennung nach Wörterbuch fände dort falsche Stellen (US-23), es bleibt ganz. */
const ohneSilbengrenze = wort => (wort.match(/[aeiouyäöü]+/gi) || []).length < 2;
function vPositionsname(text) {
  return text.split(/(\s+)/).map(teil => {
    if (/^\s*$/.test(teil) || !ohneSilbengrenze(teil)) return esc(teil);
    return `<span class="ganz">${esc(teil)}</span>`;
  }).join('');
}
function vTokenZelle(spalteTokens, tokens) {
  if (!spalteTokens) return '';
  if (tokens == null) return '<td class="r leer">—</td>';
  return `<td class="r">${tokens.toLocaleString('de-DE')}</td>`;
}
function vKostenSumme(t, waehrung) {
  if (!t.summe) return '';
  return `<tfoot>${vKostenZeile('Summe', t.summe, t.spalteTokens, waehrung, ' class="ko-summe"')}</tfoot>`;
}
function vKostenBasis(basis) {
  if (!basis) return '';
  return `<p class="ko-basis">Basis: ${esc(basis)}</p>`;
}

/** Der Aktions-Auslöser (⋮) und sein Menü (R00144 FA 2/3/6): Symbol-only, `aria-haspopup`/`aria-expanded`, Name mit der Nummer.
    Einträge mit Symbol in einer 16-px-Ikonspalte (danach 8 px); kein Titel, keine Kürzel. Reihenfolge (R00174): Link kopieren ·
    Trenner · Archivieren bzw. Zurückholen · Trenner · Endgültig löschen. */
function vFensterAktionen(a) {
  const offen = S.ui.fensterMenue === 'aktionen';
  const knopf = `<button type="button" class="btn btn-sym" data-act="fenster-menue" data-arg="aktionen" aria-haspopup="menu" aria-expanded="${offen}" aria-label="Weitere Aktionen für Aufgabe #${a.nummer}" title="Weitere Aktionen">${DREI_PUNKTE}</button>`;
  if (!offen) return `<span class="fm-anker">${knopf}</span>`;
  const archivieren = a.archiviert
    ? `<button type="button" role="menuitem" tabindex="-1" class="fm-e" data-act="zurueckholen" data-arg="${a.nummer}"><span class="fm-ikon" aria-hidden="true">${ARCHIV_HOCH}</span><span class="fm-text">Zurückholen</span></button>`
    : `<button type="button" role="menuitem" tabindex="-1" class="fm-e" data-act="archivieren" data-arg="${a.nummer}"><span class="fm-ikon" aria-hidden="true">${ARCHIV}</span><span class="fm-text">Archivieren</span></button>`;
  const linkKopieren = `<button type="button" role="menuitem" tabindex="-1" class="fm-e" data-act="link-kopieren" data-arg="${a.nummer}"><span class="fm-ikon" aria-hidden="true">${KETTE}</span><span class="fm-text">Link kopieren</span></button>`;
  const loeschen = `<button type="button" role="menuitem" tabindex="-1" class="fm-e warn" data-act="endgueltig-loeschen" data-arg="${a.nummer}"><span class="fm-ikon" aria-hidden="true">${PAPIERKORB}</span><span class="fm-text">Endgültig löschen</span></button>`;
  return `<span class="fm-anker">${knopf}<div class="fm" role="menu" aria-label="Weitere Aktionen für Aufgabe #${a.nummer}" data-art="aktionen">${linkKopieren}<div class="fm-tr" role="separator"></div>${archivieren}<div class="fm-tr" role="separator"></div>${loeschen}</div></span>`;
}
/** Die Zeile „Zuständig“ der Spalte ist nur lesend (R00146 FA 3): nur die gewählten Zuständigen, je Initiale als Verzierung
    (`aria-hidden`) plus Name als Text, in einer Gruppe „Zuständig“; kein Bedienelement, kein Chip, Leerfall „niemand“.
    Geändert werden sie allein in „Details“ (R00039) — es gibt keinen zweiten Schreibweg. */
function vZustaendigLesen(a) {
  const namen = a.zustaendige.map(k => ({ k, name: per(k).name }));
  const inhalt = namen.length
    ? namen.map(({ k, name }) => `<span class="zz"><span aria-hidden="true">${pk(k)}</span> ${esc(name)}</span>`).join('<span class="zz-tr" aria-hidden="true">·</span>')
    : '<span class="muted">niemand</span>';
  return `${vBeschriftung('assignees')}<span class="w wrap" role="group" aria-label="Zuständig">${inhalt}</span>`;
}
/** Die schmale Spalte im Inhalt (R00146 FA 1–5, 12–14): die vier bearbeitbaren Feldzeilen aus demselben Zeichner wie
    „Details“ und darunter die nur lesende Zeile „Zuständig“, Beschriftung über dem Wert, ohne sichtbare Überschrift als
    benannte Gruppe. `#inhalt-spalte` ist der Fokusrückfall, wenn ein Feld unter einem Live-Ereignis wegfällt (FA 14, ADR-0010 N7). */
const SPALTE_FELDER = ['spalte', 'klasse', 'labels', 'faellig'];
function vInhaltSpalte(a) {
  return `<aside class="mod-spalte" id="inhalt-spalte" role="group" aria-label="Angaben zur Aufgabe" tabindex="-1"><div class="felder felder-schmal">${SPALTE_FELDER.map(feld => vFeldZeile(feld, a, true)).join('')}${vZustaendigLesen(a)}</div></aside>`;
}
function vFenster() {
  const a = aufgabe(S.ui.offen);
  if (!a) return '';
  const u = S.ui, cl = klasse(a.klasse, a);
  const pfad = 'aufgaben/' + a.datei, wurzel = S.zustand.ordner;
  // Genau eine Ansicht ist gewählt (R00145 FA 2/6): der gemerkte Schlüssel, sonst „Inhalt“ — generisch für jede entfallende Ansicht.
  const tab = ansichtDerAufgabe(a);
  // Kopf rechts (R00144 FA 1): Ansicht, ↗, ⋮, ✕ — Lücken 8 px, kein Trenner, keine Blätterknöpfe, kein Zähler, kein beschrifteter Lösch-Auslöser.
  const kopf = `<div class="mod-kopf"><span class="id">#${a.nummer}</span>${cl ? `<span class="cls">${esc(cl.bezeichnung)}</span>` : ''}<span class="pfad">${esc(pfad)}</span><div class="rechts">${vAnsichtWahl(a, tab)}<a class="btn btn-sym" id="vsc" href="vscode://file${esc(wurzel)}/${esc(pfad)}" title="In VS Code öffnen">↗</a>${vFensterAktionen(a)}<button class="btn btn-sym" data-act="schliessen" title="Schließen (Esc)" aria-label="Schließen">✕</button></div></div>`;
  const archivLeiste = a.archiviert ? `<div class="archbar">Archiviert am ${esc(datumLang(a.archiviert))} · nicht auf dem Board, Datei und Zeiten bleiben<button class="lnk" data-act="zurueckholen" data-arg="${a.nummer}">Zurückholen</button></div>` : '';
  const fuss = `<div class="mod-fuss"><span class="gs">${u.gespeichert ? 'gespeichert ' + uhr(u.gespeichert) : 'jede Änderung geht sofort in die Datei'}</span>${u.fensterFehler ? `<span class="fehl" id="${FENSTER_MELDUNG}" role="alert" data-meldung="${u.fensterMeldungNr || 0}">${esc(u.fensterFehler)}</span>` : ''}<span class="tastenhinweis" style="margin-left:auto"><kbd>Esc</kbd> Eingabe verwerfen · erneut schließen</span><button type="button" class="btn eingabe-verwerfen" data-act="eingabe-verwerfen">Eingabe verwerfen</button></div>`;
  const stil = cl ? ` style="${cv(cl.farbe)}"` : '';
  // Genau eine gezeichnete Ansicht (R00145 FA 6): role=group mit dem Namen der Ansicht, kein tabpanel, kein aria-current.
  const panel = tab === 'datei' ? `<div class="mod-main"><pre class="md" id="dateitext">${esc(u.datei ? u.datei.text : '')}</pre></div>`
    : tab === 'kosten' ? vKostenPanel(a)
    : tab === 'commits' ? vCommitsPanel()
    : tab === 'laeufe' ? vLaeufePanel(a)
    : tab === 'verlauf' ? vVerlaufPanel()
    : tab === 'zeiten' ? `<div class="mod-main">${vFensterSeite(a)}</div>`
    : tab === 'details' ? `<div class="mod-main">${vFensterDetails(a)}</div>`
    : `<div class="mod-main">${vFensterInhalt(a)}</div>${vInhaltSpalte(a)}`;
  return `<div class="mod-bg" data-act="schliessen-bg"><div class="mod" id="fenster" tabindex="-1" role="dialog" aria-label="Aufgabe #${a.nummer}"${stil}>${vFensterUeberschrift('Aufgabe #' + a.nummer)}${kopf}${archivLeiste}<div class="mod-body ${tab === 'inhalt' ? 'mit-spalte' : 'voll'}" data-ansicht="${tab}" role="group" aria-label="Ansicht: ${esc((reiterDerAufgabe(a).find(([k]) => k === tab) || [null, 'Inhalt'])[1])}">${panel}</div>${vHinweisAnker('fenster')}${fuss}</div></div>`;
}
/** Der Reiter „Inhalt“ (R00127): die Arbeit an der Aufgabe — Titel, Beschreibung, Teilaufgaben, Kommentare, Durchläufe, sonst nichts. */
function vFensterInhalt(a) {
  const u = S.ui;
  // Titel liest mehrzeilig (ADR-0007 N2): Lesediv nach Muster besch-lesen, Bearbeiten einzeilig im Zustand titelBearbeiten
  const titelFeld = u.titelBearbeiten
    ? `<input class="titel" data-af="titel"${vEntwurf(a, TITEL_FELD, a.titel)} aria-label="Titel">`
    : `<div class="titel titel-lesen" data-act="titel-bearbeiten" tabindex="0" role="button" aria-label="Titel bearbeiten" title="Klick bearbeitet">${esc(a.titel)}</div>`;
  return `${titelFeld}${vBeschreibung(a)}${vFensterAbschnitte(a)}`;
}
/** Die Beschreibung (R00030, R00162): mit Text und außerhalb des Bearbeitens reiner Text zum Auswählen und Kopieren, der
    Stift auf der Zeile der Überschrift beginnt das Bearbeiten (Artboard D0003 `#beschreibung-stift`); sonst direkt das Textfeld. */
function vBeschreibung(a) {
  const liest = Boolean(a.beschreibung) && !S.ui.beschreibungBearbeiten;
  if (!liest) return `<div class="abs"><h3 class="besch-kopf">BESCHREIBUNG</h3><textarea class="besch" id="beschreibung" data-af="beschreibung" placeholder="Beschreibung in Markdown" aria-label="Beschreibung">${esc(a.beschreibung)}</textarea></div>`;
  const stift = '<button type="button" class="btn btn-sym besch-stift" data-act="beschreibung-bearbeiten" title="Beschreibung bearbeiten (b)" aria-label="Beschreibung bearbeiten">✎</button>';
  return `<div class="abs"><h3 class="besch-kopf">BESCHREIBUNG ${stift}</h3><div class="besch-lesen md-text">${markdownHtml(a.beschreibung)}</div></div>`;
}
/** Der Reiter „Details“ (R00127): die Felder der bisherigen Seitenleiste (R00011/R00109); „Spalte“ bewegt die Karte (R00006). Einspaltig, ohne .mod-side. */
function vFensterDetails(a) {
  const ps = personen().filter(p => p.aktiv || a.zustaendige.includes(p.kuerzel));
  return `<div class="felder felder-details">${vSchluesselFeld(a)}${vFeldZeile('spalte', a)}
${vFeldZeile('klasse', a)}
${vBeschriftung('origins')}<span class="w wrap">${a.herkunft.map((x, j) => `<span class="ochip">${vHerkunftChip(x)}<button data-act="herkunft-weg" data-arg="${j}" data-halt="herkunft-weg:${esc(x)}" data-ort="#herkunft-neu" title="entfernen" aria-label="Herkunft ${esc(herkunftAnzeige(x))} entfernen">×</button></span>`).join('') || vHerkunftChip('thin air')}<input class="mini-inp" id="herkunft-neu"${vEntwurf(a, HERKUNFT_FELD)} placeholder="I0001 / kd:I0001 / R00014" data-enter="herkunft-neu" title="${HERKUNFT_HILFE}" aria-label="Neue Herkunft"></span>
${vWirkungenFeld(a)}
${vPhasenFeld(a)}${vSignalFeld(a)}${vZaehlungFeld(a)}${vReservierungFeld(a)}
${vBeschriftung('assignees')}<span class="w wrap" role="group" aria-label="Zuständig">${ps.map(p => `<button class="as${a.zustaendige.includes(p.kuerzel) ? ' an' : ''}" data-act="zustaendig" data-arg="${esc(p.kuerzel)}"${p.aktiv ? '' : ' disabled title="stillgelegt"'} aria-pressed="${a.zustaendige.includes(p.kuerzel)}">${pk(p.kuerzel)}${esc(p.name)}</button>`).join('')}</span>
${vFeldZeile('labels', a)}
${vFeldZeile('faellig', a)}
${a.estimate ? `${vBeschriftung('estimate')}<span class="w mono">${hm(a.estimate * 6e4)}</span>` : ''}</div>`;
}
/* Abschnitte des Inhalts (R00127 S2, R00145 FA 11): Teilaufgaben, Anhänge, Kommentare, Durchläufe — Zeiten und Felder stehen in eigenen Ansichten. */
function vFensterAbschnitte(a) {
  return vTeilaufgaben(a) + vAnhaenge(a) + vKommentare(a) + vDurchlaeufe(a);
}
/** Durchläufe (R00094) als Tabelle, neueste oben; ohne Durchläufe kein Abschnitt. */
function vDurchlaeufe(a) {
  // neueste oben; in derselben Minute entscheidet die Reihenfolge im Block
  const ds = (a.durchlaeufe || []).map((d, i) => ({ d, i })).sort((x, y) => zeitMs(y.d.zeitpunkt) - zeitMs(x.d.zeitpunkt) || y.i - x.i).map(x => x.d);
  if (!ds.length) return '';
  const zeilen = ds.map(d => `<tr><td class="mono">${esc(zeitpunktKurz(d.zeitpunkt, isoD(Date.now())))}</td><td>${esc(d.phase)}</td><td><span class="erg ${esc(d.ergebnis)}">${esc(d.ergebnis)}</span></td><td>${pk(d.wer)}${esc(per(d.wer).name)}</td><td class="r mono">${d.dauer_minuten == null ? '–' : hm(d.dauer_minuten * 6e4)}</td><td>${esc(d.text)}</td></tr>`).join('');
  // Eigene Querscroll-Fläche je Tabelle (R00123-Muster, PO #146): die sechs Spalten scrollen im Rahmen, nie das Fenster;
  // per Tastatur erreichbar, damit die Tabelle auch auf dem Telefon ganz zugänglich bleibt.
  return `<div class="abs" id="durchlaeufe"><h3>DURCHLÄUFE <span class="mono">kanbanD-runs · ${ds.length}</span></h3><div class="bericht-rahmen" tabindex="0" role="group" aria-label="Durchläufe der Aufgabe #${a.nummer}"><table class="pt dicht dl-tab"><thead><tr><th>Zeit</th><th>Phase</th><th>Ergebnis</th><th>Wer</th><th class="r">Dauer</th><th>Text</th></tr></thead><tbody>${zeilen}</tbody></table></div></div>`;
}
/** Der Karten-Verlauf (R00123): nur lesend, aus der Git-Geschichte gerechnet; Tabelle neueste oben, Zeit mit Jahr. */
const VERLAUF_ART = { erstellt: 'erstellt', bewegt: 'bewegt', archiviert: 'archiviert', zurueckgeholt: 'zurückgeholt', geloescht: 'gelöscht' };
function vVerlaufWeg(e) {
  if (e.art !== 'bewegt') return '—';
  const von = e.von == null ? 'auf das Board gelegt' : esc(e.von);
  const nach = e.nach == null ? 'vom Board genommen' : esc(e.nach);
  return `${von} → ${nach}`;
}
/** „Wer“: Kürzel und Name wie die Durchläufe-Tabelle; ein fremder Autor (keine Person) erscheint mit seinem Git-Namen. */
function vVerlaufWer(wer) {
  const p = personen().find(p => p.kuerzel === wer);
  return p ? `${pk(wer)}${esc(p.name)}` : esc(wer);
}
/** Die Ansicht „Commits“ (R00205): nur lesend; Zustand und Zeichnen stehen in web/commits.js, gelesen wird in app.js (commitsLesen). */
function vCommitsPanel() {
  const basis = S.ui.view === 'aufgaben' ? 'aufgaben' : 'board';
  const ziel = verweis => reviewAdresseBilden({ basis, slug: S.ui.slug, nummer: S.ui.offen, commit: verweis });
  return commitsAnsichtHtml(S.ui.commits || { status: 'laedt', stand: null }, esc, ziel);
}
/** Die Ansicht „Läufe“ (R00219): nur lesend; Zusammenführen und Zeichnen in web/laeufe.js, gelesen wird in app.js (laeufeLesen).
    Die Kosten kommen aus dem aktuellen Stand der Aufgabe, der Zustand der Transkripte aus der letzten Antwort. */
function vLaeufePanel(a) {
  const l = S.ui.laeufe || { laedt: true, ergebnis: null };
  // Die Insel (ADR-0039 N1, app.js laeufeInselPruefen): bleibt die alte Tabelle stehen, kommt nur ihr Platzhalter in den Text
  const tabelle = laeufeInsel.gehalten ? LAEUFE_INSEL_PLATZHALTER : laeufeInsel.text;
  return laeufeAnsichtHtml(l, a.kosteneintraege || [], esc, tabelle === null ? undefined : tabelle);
}
function vVerlaufPanel() {
  const u = S.ui;
  if (u.verlaufFehler) return `<div class="mod-main vh-panel"><p class="fehl" role="alert">${esc(u.verlaufFehler)}</p><p class="vh-hin">liest nur · gerechnet aus der Git-Geschichte</p></div>`;
  if (!u.verlauf) return `<div class="mod-main vh-panel"><p class="vh-laedt" role="status">lädt …</p></div>`;
  const ds = u.verlauf.eintraege || [];
  const hin = '<p class="vh-hin">liest nur · gerechnet aus der Git-Geschichte</p>';
  if (!ds.length) return `<div class="mod-main vh-panel"><p class="vh-leer">Kein Verlauf — diese Aufgabe steht noch in keiner Fassung.</p>${hin}</div>`;
  const zeilen = ds.map(e => `<tr><td class="mono">${esc(zeitpunktLang(e.zeitpunkt))}</td><td>${esc(VERLAUF_ART[e.art] || e.art)}</td><td>${vVerlaufWeg(e)}</td><td>${e.art === 'bewegt' && e.board ? esc(e.board) : '—'}</td><td>${vVerlaufWer(e.wer)}</td></tr>`).join('');
  return `<div class="mod-main vh-panel"><div class="bericht-rahmen" tabindex="0" role="group" aria-label="Verlauf"><table class="pt dicht vh-tab"><thead><tr><th scope="col">Zeit</th><th scope="col">Art</th><th scope="col">von → nach</th><th scope="col">Board</th><th scope="col">Wer</th></tr></thead><tbody>${zeilen}</tbody></table></div>${hin}</div>`;
}
const groesse = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1).replace('.', ',') + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
/** Anhänge im Inhalt (R00145 FA 11/12): Überschrift `ANHÄNGE <n>` ohne Dateinamen, Zeile mit Name, Größe und ✕; der Leerfall zeigt
    die Zeile „+ Datei wählen oder hierher ziehen“, keinen leeren Kasten. Die Fläche ist Ablageziel (app.js, `dragover`/`drop`). */
function vAnhaenge(a) {
  const liste = S.ui.anhaenge || [];
  return `<div class="abs anh" id="anhaenge"><h3>ANHÄNGE <span class="mono">${liste.length}</span></h3>${liste.map(x => `<div class="anh-z"><a href="/api/aufgaben/${a.nummer}/anhaenge/${encodeURIComponent(x.name)}" target="_blank" rel="noopener">${esc(x.name)}</a><span class="mono muted">${groesse(x.groesse)}</span><button class="btn btn-sym x" data-act="anhang-weg" data-arg="${esc(x.name)}" aria-label="Anhang ${esc(x.name)} entfernen">✕</button></div>`).join('')}<label class="inp add anh-wahl">+ Datei wählen oder hierher ziehen<input type="file" id="anhang-datei" multiple hidden aria-label="Anhang hinzufügen"></label></div>`;
}
function ichPerson() {
  return S.ich && personen().find(p => p.kuerzel === S.ich && p.art === 'human' && p.aktiv);
}
/** Kommentare (R00013, R00178): fremder Text gelangt nur über `markdownHtml` ins Fenster, gerendert wie die Beschreibung
    (ADR-0030); das Feld darunter bleibt reiner Text. */
function vKommentare(a) {
  const me = ichPerson();
  return `<div class="abs"><h3>KOMMENTARE <span class="mono">kanbanD-comments · ${a.kommentare.length}</span></h3>${a.kommentare.map(k => `<div class="km">${pk(k.wer)}<div><div class="md-text">${markdownHtml(k.text)}</div><span class="mono">${esc(per(k.wer).name)} · ${esc(zeitpunktLang(k.zeitpunkt))}</span></div></div>`).join('')}<textarea class="inp add km-inp" id="km-inp" rows="1" placeholder="${me ? '+ Kommentar als ' + esc(me.name) + ' · Enter (Umschalt+Enter: neue Zeile)' : 'erst „Ich bin …“ wählen'}" data-enter="kommentar" aria-label="Neuer Kommentar"${me ? '' : ' disabled'}></textarea></div>`;
}
/** Lesesicht des Texts einer Teilaufgabe (R00177, Artboard D0003 `#markdown-elemente`): in der Zeile formatiert, ohne Rolle
    und ohne Tab-Halt — ein Link darin stünde sonst in einem Knopf (ADR-0030 Punkt 8). Ein Klick neben einen Link bearbeitet
    den Rohtext; für die Tastatur steht dahinter der Stift, auf ihn kehrt der Fokus nach dem Bearbeiten zurück. Sein
    Zeichen kommt aus dem CSS: der Text der Zeile bleibt der Text der Teilaufgabe. */
function vTeilLesen(t, j) {
  const text = `<span class="teil-text" data-act="teil-bearbeiten" data-arg="${j}">${markdownInline(t.text)}</span>`;
  const stift = `<button type="button" class="btn btn-sym teil-stift" data-act="teil-stift" data-arg="${j}" data-halt="teil:${esc(t.text)}" data-ort="#teil-neu" title="Text bearbeiten" aria-label="Teilaufgabe bearbeiten: ${markdownOhneMarken(t.text)}"></button>`;
  return text + stift;
}
/** Kästchen hakt ab, Klick auf den Text oder der Stift bearbeitet ihn (R00066, R00177), Ziehen ordnet um (R00067). */
function vTeilaufgaben(a) {
  const ok = a.teilaufgaben.filter(t => t.erledigt).length;
  return `<div class="abs"><h3>TEILAUFGABEN <span class="mono">${ok}/${a.teilaufgaben.length}</span></h3>${a.teilaufgaben.map((t, j) => `<div class="chk${t.erledigt ? ' ok' : ''}" data-teil="${j}" draggable="${!((S.ui.teilEdit || {}).nr === a.nummer && S.ui.teilEdit.i === j)}"><i data-act="teil" data-arg="${j}" data-halt="teil-haken:${esc(t.text)}" tabindex="0" role="checkbox" aria-checked="${t.erledigt}" aria-label="${markdownOhneMarken(t.text)}">${t.erledigt ? '✓' : ''}</i>${(S.ui.teilEdit || {}).nr === a.nummer && S.ui.teilEdit.i === j ? `<input class="inp teil-edit" id="teil-edit" value="${esc(t.text)}" data-enter="teil-text" data-arg="${j}" aria-label="Teilaufgabe bearbeiten">` : vTeilLesen(t, j)}<button class="btn btn-sym x" data-act="teil-weg" data-arg="${j}" data-halt="teil-weg:${esc(t.text)}" data-ort="#teil-neu" title="entfernen" aria-label="Teilaufgabe ${markdownOhneMarken(t.text)} entfernen">✕</button></div>`).join('')}<input class="inp add" placeholder="+ Teilaufgabe · Enter" data-enter="teil-neu" id="teil-neu" data-mehrfach="teil" aria-label="Neue Teilaufgabe"></div>`;
}
function vFensterSeite(a) {
  const rs = laufende(a), meins = rs.find(z => z.wer === S.ich), me = ichPerson();
  return `<div class="abs"><h3>LÄUFT GERADE <span class="mono">${rs.length} Timer</span></h3>${rs.length ? `<div class="tl">${rs.map(z => `<div class="tz${z.wer === S.ich ? ' eigen' : ''}" data-timer="${esc(z.wer)}">${pk(z.wer)}<span>${esc(per(z.wer).name)} <span class="muted">${z.wer === S.ich ? '· ich ' : ''}· seit ${esc(ortszeit(z.beginn).slice(11))}</span></span>${vLaufChip({ beginn: laufBeginn(a, z), eigen: z.wer === S.ich, rahmen: 'b' })}<button class="btn${z.wer === S.ich ? ' btn-haupt' : ''}" data-act="stop" data-arg="${a.nummer}|${esc(z.wer)}" title="${z.wer === S.ich ? 'meinen Timer' : esc(per(z.wer).name) + 's Timer'} stoppen" aria-label="Timer von ${esc(per(z.wer).name)} stoppen">■</button></div>`).join('')}</div>` : ''}${meins ? '' : `<button class="btn btn-haupt start" data-act="start" data-arg="${a.nummer}">▶ ${me ? 'Meinen Timer starten' : 'Timer starten …'}</button>`}</div>` + vZeiten(a);
}
function vZeiten(a) {
  const jetzt = Date.now(), me = ichPerson(), u = S.ui;
  const dauer = z => z.ende ? zeitMs(z.ende) - zeitMs(z.beginn) : jetzt - laufBeginn(a, z);
  const summe = summeMs(a.zeiten, jetzt, z => laufBeginn(a, z));
  const zeilen = a.zeiten.map((z, i) => ({ z, i })).sort((x, y) => zeitMs(y.z.beginn) - zeitMs(x.z.beginn)).map(({ z, i }) => u.zeitEdit === z.kennung
    ? `<tr class="edit"><td colspan="5"><input class="mini-inp" id="z-beginn" value="${esc(z.beginn)}" aria-label="Beginn" data-enter="zeit-ok" data-arg="${esc(z.kennung)}">${z.ende ? `<input class="mini-inp" id="z-ende" value="${esc(z.ende)}" aria-label="Ende" data-enter="zeit-ok" data-arg="${esc(z.kennung)}">` : ' <span class="muted">läuft</span>'}<button class="btn btn-sym" data-act="zeit-ok" data-arg="${esc(z.kennung)}" aria-label="Korrektur speichern">✓</button></td></tr>`
    : `<tr data-zeit="${i}" data-kennung="${esc(z.kennung)}"><td class="mono">${esc(datumKurz(ortszeit(z.beginn), isoD(Date.now())))}</td><td class="mono">${esc(ortszeit(z.beginn).slice(11))}–${z.ende ? esc(ortszeit(z.ende).slice(11)) : '…'}</td><td>${pk(z.wer)}</td><td class="r">${z.ende ? hm(dauer(z)) : vLaufChip({ beginn: laufBeginn(a, z), eigen: z.wer === S.ich, sekunden: false })}</td><td class="x"><button class="btn btn-sym" data-act="zeit-edit" data-arg="${esc(z.kennung)}" title="korrigieren" aria-label="Zeit ${i + 1} korrigieren">✎</button>${z.ende ? `<button class="btn btn-sym" data-act="zeit-weg" data-arg="${esc(z.kennung)}" title="Eintrag löschen" aria-label="Zeit ${i + 1} löschen">✕</button>` : ''}</td></tr>`).join('');
  return `<div class="abs"><h3>ZEITEN <span class="mono" id="zeitsumme">kanbanD-time · ${hm(summe)}</span></h3><table class="zt">${zeilen}</table><input class="inp add" id="zeit-neu"${vEntwurf(a, ZEIT_FELD)} placeholder="${me ? '+ Zeit nachtragen, z. B. 0:45 · Enter' : 'erst „Ich bin …“ wählen'}" data-enter="zeit-neu" aria-label="Zeit nachtragen"${me ? '' : ' disabled'}></div>`;
}

/* ── Popover ── */
const defekteBoards = (zustand = S.zustand) => (zustand.defekte || []).filter(d => /^boards\/[^/]+\.md$/.test(d.pfad)).map(d => d.pfad.slice(7, -3));
/** Archivierte Boards (R00128): aus der vollen Board-Liste (`?archivierte=ja`) — `zustand.boards` und `S.boards` im Schalter. */
const archivierteBoards = () => (S.boards || []).filter(b => b.archiviert);
/** Der ⋮-Aktionsauslöser einer Board-Zeile (M1/M8): eigener Knopf, `aria-haspopup="menu"`, Name mit Boardnamen. */
function vBoardDrei(titel, slug, auf) {
  return `<button type="button" class="bdrei${auf ? ' auf' : ''}" data-act="board-menue" data-arg="${esc(slug)}" aria-haspopup="menu" aria-expanded="${auf}" aria-label="Aktionen für Board „${esc(titel)}“">${DREI_PUNKTE}</button>`;
}
/** Das Zeilenmenü eines Boards (M1/S1): Umbenennen, Archivieren bzw. „wieder öffnen“, Löschen in `--kd-warn`. */
function vBoardMenue(titel, slug, archiviert) {
  const eintrag = (act, text, warn) => `<button type="button" role="menuitem" tabindex="-1"${warn ? ' class="warn"' : ''} data-act="${act}" data-arg="${esc(slug)}">${text}</button>`;
  const auslagern = archiviert ? eintrag('board-wieder-oeffnen', 'wieder öffnen') : eintrag('board-archivieren', 'Archivieren');
  return `<div class="bmenue" role="menu" aria-label="Aktionen für Board „${esc(titel)}“">${eintrag('board-umbenennen', 'Umbenennen')}${auslagern}${eintrag('board-loeschen', 'Löschen', true)}</div>`;
}
function vBoardPop() {
  const u = S.ui;
  // Härtung #129/1 (ux): die getippte Zeichenkette steht im Zustand (`S.ui.boardUmbenennenWert`, gesetzt beim Beginn
  // der Sitzung und im `input`-Ereignis) und wird im Feld gezeichnet — nach einem 400 zeigt das Feld die abgelehnte
  // Eingabe samt Feldfehler (Artboard D0002), nicht wieder den Titel des Boards.
  const umbenennenZeile = (slug, titel) => {
    return `<div class="bzeile edit"><input class="inp" id="board-umbenennen" value="${esc(u.boardUmbenennenWert)}" aria-label="Neuer Name für Board „${esc(titel)}“" data-enter="board-umbenennen-ok" data-arg="${esc(slug)}"${u.popFehler ? ' aria-invalid="true" aria-describedby="board-fehler"' : ''}><button type="button" class="btn btn-sym" data-act="board-umbenennen-ok" data-arg="${esc(slug)}" aria-label="Umbenennen bestätigen (Enter)">✓</button><button type="button" class="btn btn-sym" data-act="board-umbenennen-ab" data-arg="${esc(slug)}" aria-label="Verwerfen (Esc)">✕</button></div>`;
  };
  // `defekt` = eine defekte Board-Datei (R00025): derselbe Weg zum Umbenennen, nur mit der Marke „defekt“ statt des Slugs.
  const zeile = (b, defekt) => {
    if (u.boardUmbenennen === b.slug) return umbenennenZeile(b.slug, b.titel);
    const marke = defekt ? '<span class="muted mono warn">defekt</span>' : `<span class="muted mono">${esc(b.slug)}.md</span>`;
    return `<div class="bzeile"><button type="button" class="iz${b.slug === u.slug ? ' an' : ''}" data-act="board-wahl" data-arg="${esc(b.slug)}">${esc(b.titel)}${marke}</button>${vBoardDrei(b.titel, b.slug, u.boardMenue === b.slug)}</div>${u.boardMenue === b.slug ? vBoardMenue(b.titel, b.slug, false) : ''}`;
  };
  const defekte = defekteBoards().map(s => zeile({ slug: s, titel: s }, true)).join('');
  const archiv = archivierteBoards();
  const archivBlock = archiv.length ? `<details class="barch"${u.boardMenue && archiv.some(b => b.slug === u.boardMenue) ? ' open' : ''}><summary data-halt="klappe:archivierte-boards">ARCHIVIERT (${archiv.length})</summary>${archiv.map(b => u.boardUmbenennen === b.slug ? umbenennenZeile(b.slug, b.titel) : `<div class="barchz"><div class="bz1"><span class="bname">${esc(b.titel)}</span><span class="muted mono">${esc(b.slug)}.md</span>${vBoardDrei(b.titel, b.slug, u.boardMenue === b.slug)}</div><div class="bz2"><span>archiviert am ${esc(datumLang(b.archiviert))}</span><button type="button" class="lnk" data-act="board-wieder-oeffnen" data-arg="${esc(b.slug)}">wieder öffnen</button></div>${u.boardMenue === b.slug ? vBoardMenue(b.titel, b.slug, true) : ''}</div>`).join('')}</details>` : '';
  const fehler = u.popFehler ? `<div class="warnh" id="board-fehler" role="alert">${esc(u.popFehler)}</div>` : '';
  return `<div class="pop" id="pop" data-for="t-board" data-al="l" style="width:300px" role="dialog" aria-label="Boards"><h4 class="pop-kopf">BOARDS <span class="mono">boards/</span></h4>${S.zustand.boards.map(b => zeile(b)).join('')}${defekte}${S.board ? `<button type="button" class="iz" data-act="pop" data-arg="reservierungen" id="reservierungen-zeigen">Alle Aufgabenreservierungen anzeigen<span class="muted mono">${reservierteDesBoards().length}</span></button>` : ''}<div class="iz neu"><input class="inp" id="board-neu" placeholder="Neues Board · Enter" data-enter="board-neu" aria-label="Name des neuen Boards"></div>${archivBlock}${fehler}<div class="fuss">Alle Boards zeigen denselben Aufgabenbestand.</div></div>`;
}

/** Der geteilte Bestätigungsdialog `alertdialog` (R00128 M2/M3/M8/M9; **dieselbe Komponente wie R00141**, B6): der
    Aufrufer liefert zugänglichen Namen, Rumpf und Bestätigungswort in `S.ui.alDialog` — hier wird nur gerendert. */
function vAlDialog() {
  const d = S.ui.alDialog;
  if (!d) return '';
  const fehler = d.fehler ? `<div class="warnh" role="alert">${esc(d.fehler)}</div>` : '';
  return `<div class="al-bg"><div class="al-dialog${d.gefahr ? ' al-gefahr' : ''}" id="al-dialog" role="alertdialog" aria-modal="true" aria-labelledby="al-titel" aria-describedby="al-text"><div class="al-kopf" id="al-titel">${esc(d.name)}</div><div class="al-text" id="al-text">${d.rumpf}</div>${fehler}<div class="al-fuss"><button type="button" class="al-knopf" id="al-abbrechen" data-act="al-abbrechen">Abbrechen</button><button type="button" class="al-knopf${d.gefahr ? ' al-gefahr-knopf' : ''}" data-act="al-bestaetigen">${esc(d.bestaetigen)}</button></div></div></div>`;
}


function vPop() {
  const u = S.ui;
  if (u.pop === 'board') return vBoardPop();
  if (u.pop === 'mehr') return vMehrPop();
  if (u.pop === 'seite') return vSeitenPop();
  if (u.pop === 'lauf') return alleLaufenden().length ? vLaufPop() : '';
  if (u.pop === 'legen') return vLegenPop();
  if (u.pop === 'ber') return vBerichtePop();
  if (u.pop === 'defekt') return vDefektePop();
  if (u.pop === 'reservierungen') return vReservierungenPop();
  if (u.pop === 'wbs-status') return vWbsStatusPop();
  if (u.pop === 'wbs-neu') return vWbsNeuPop();
  if (u.pop === 'wbs-verwerfen') return vWbsVerwerfenPop();
  if (u.pop !== 'ich') return '';
  const ps = personen();
  const waehlbar = ps.filter(p => p.art === 'human' && p.aktiv);
  const nicht = ps.filter(p => p.art === 'agent' || !p.aktiv);
  // Überschrift, Hinweis und Fuß stehen neben dem Menü und benennen bzw. beschreiben es (R00106)
  let hinweis = '';
  let beschrieben = '';
  if (u.ichNoetig) {
    hinweis = '<div class="warnh" id="ich-hinweis">Für diese Aktion zuerst wählen, wer du bist.</div>';
    beschrieben = ' aria-describedby="ich-hinweis"';
  }
  return `<div class="pop" id="pop" data-for="t-ich" data-al="r" style="width:280px"><h4 class="pop-kopf" id="ich-titel">ICH BIN …</h4>${hinweis}<div role="menu" aria-labelledby="ich-titel"${beschrieben}>${waehlbar.map(p => `<div class="iz${p.kuerzel === S.ich ? ' an' : ''}" data-act="ich" data-arg="${esc(p.kuerzel)}" role="menuitemradio" aria-checked="${p.kuerzel === S.ich}" tabindex="-1">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.kuerzel === S.ich ? 'gewählt' : ''}</span></div>`).join('')}${nicht.map(p => `<div class="iz aus" role="menuitemradio" aria-checked="false" aria-disabled="true">${pk(p.kuerzel)}${esc(p.name)}<span class="muted">${p.aktiv === false ? 'stillgelegt' : 'Agent · nennt sich selbst'}</span></div>`).join('')}</div><div class="fuss">Die Wahl gilt nur für diesen Tab.</div></div>`;
}

/** Die **eine** Textregel der Blase (R00119, ADR-0020 Nachtrag N1): der Wortlaut je Auslöser — sichtbarer Text =
 *  zugänglicher Name (`aria-label`, FA 2, ADR-0018); der Streifen-Knopf der zugeklappten Spalte überschreibt ihn über
 *  `data-tip-text`, weil sein Name nur „… aufklappen, gehört dem …“ lautet. Beide Wege benutzen sie: `vTipp()` hier und
 *  das unmittelbare Stellen in web/app.js. */
function tippText(el) {
  return el.dataset.tipText || el.getAttribute('aria-label') || '';
}

/**
 * Erklärtext auf Anforderung (R00119, ADR-0020 Option B): genau **eine** nicht-modale Blase `role="tooltip"`,
 * die der Renderer aus `S.ui.tooltip` zeichnet (ADR-0007) und die außerhalb des Scrollcontainers `.bahnen` liegt
 * (in `#over`, fest positioniert wie `#pop`). Sie nimmt keinen Fokus. Ohne Auslöser im Dokument oder ohne Text ist
 * der Kasten verborgen und der Zustand fällt weg — ein Live-Ereignis hinterlässt so keinen verwaisten Tooltip.
 * Gezeigt wird sie auf Anforderung (Fokus, langer Druck) durch web/app.js; der sichtbare Text ist der zugängliche
 * Name des Auslösers (`aria-label`) bzw. dessen `data-tip-text` (Streifen-Knopf).
 */
function vTipp() {
  const t = S.ui.tooltip;
  const el = t && [...document.querySelectorAll('[data-tip]')].find(x => x.dataset.tip === t.fuer);
  const text = el ? tippText(el) : '';
  if (!text) { S.ui.tooltip = null; return '<div class="kd-tipp" id="kd-tipp" role="tooltip" hidden></div>'; }
  return `<div class="kd-tipp" id="kd-tipp" role="tooltip">${esc(text)}</div>`;
}

/* ── Zeiten ── */
/* zeitMs, ortszeit, anteil, personenZeilen, stundenmarken, lageImTag, tagesende: web/zeiten.js */
// `hm` (Dauer als h:mm) steht in web/zeiten.js und ist dort auch gegen die geschätzte Zeit (R00129) getestet.
const hms = ms => { const s = Math.max(0, Math.floor(ms / 1e3)); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
/**
 * Laufchip an allen fünf Zeichenstellen (R00114, ADR-0019 Regel 2): im vergessenen Zustand der Satz statt der Zahl.
 * `rahmen` ist der Rahmen des Bestands unter der Schwelle: `span` (Karte, Zeittabelle, Personen) oder `b` (Pop, Fensterblock).
 */
function vLaufChip({ beginn, eigen, anzahl = 1, namen = '', sekunden = true, rahmen = 'span' }) {
  const laufzeit = Date.now() - beginn;
  const vergessen = istVergessen(laufzeit);
  let zahl = hm(laufzeit), format = '';
  if (sekunden) { zahl = hms(laufzeit); format = ' data-fmt="s"'; }
  // unter der Schwelle bleibt das Markup des Bestands an seiner Stelle (FA 11)
  if (!vergessen && rahmen === 'b') return `<b data-since="${beginn}"${format}>${zahl}</b>`;
  let klassen = 'lauf';
  if (eigen) klassen += ' eigen';
  if (vergessen) klassen += ' vergessen';
  const titel = namen ? ` title="läuft: ${esc(namen)}"` : '';
  if (vergessen) return `<span class="${klassen}"${titel}><span data-since="${beginn}" data-fmt="seit">${seitText(laufzeit)}</span></span>`;
  let zaehler = '';
  if (anzahl > 1) zaehler = `${anzahl}× `;
  return `<span class="${klassen}"${titel}>${zaehler}<span data-since="${beginn}"${format}>${zahl}</span></span>`;
}
/** Auswahl der Klasse; Auswahl und Einträge tragen die Klassenfarbe wie die Karte. Eine unbekannte Klasse bleibt als Eintrag ohne Farbe stehen. */
function vKlassenWahl(attr, wert, klassen) {
  const cl = klassen.find(k => k.schluessel === wert);
  const eintrag = k => `<option value="${esc(k.schluessel)}" style="${cv(k.farbe)}"${k.schluessel === wert ? ' selected' : ''}>${esc(k.bezeichnung)}</option>`;
  return `<select class="klwahl" ${attr}="klasse" aria-label="Klasse"${cl ? ` style="${cv(cl.farbe)}"` : ''}><option value="">— keine —</option>${klassen.map(eintrag).join('')}${wert && !cl ? `<option selected>${esc(wert)}</option>` : ''}</select>`;
}
const laufende = a => a.zeiten.filter(z => !z.ende);
/** Beginn eines laufenden Timers in ms: die Datei kennt nur Minuten — ein in diesem Browser gestarteter Timer zählt ab seiner Startsekunde. */
const laufBeginn = (a, z) => Math.max(zeitMs(z.beginn), S.timerStart[`${a.nummer}|${z.wer}`] || 0);
const alleLaufenden = () => S.aufgaben.filter(a => !a.archiviert).flatMap(a => laufende(a).map(z => ({ a, z })));

/* ── Karten ── */
const PAL = ['yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'magenta', 'violet', 'indigo', 'blue', 'sky', 'cyan', 'teal', 'green', 'lime', 'grey'];
const cv = farbe => !farbe ? '' : PAL.includes(farbe) ? `--c:var(--kd-c-${farbe});--cl:var(--kd-c-${farbe}-line)` : `--c:color-mix(in srgb,${farbe} var(--kd-klasse-anteil),var(--kd-surface));--cl:${farbe}`;
/** Sichten außerhalb eines Boards (ADR-0031 Regel 3); Board und Berichte gelten dem gezeigten Board. */
const AUSSERHALB_EINES_BOARDS = ['aufgaben', 'personen', 'einrichten', 'wbs'];
const ausserhalbEinesBoards = () => AUSSERHALB_EINES_BOARDS.includes(S.ui.view);
/** Der Klassenvorrat der Sicht (R00195, ADR-0031 Regel 2, 3 und 8): auf einem Board und in seinen Berichten der des
    gezeigten Boards — sein eigener Satz, sonst die Vorgabe des Ordners; außerhalb eines Boards der des ersten Boards der
    Aufgabe `a`, sonst die Vorgabe. Bei defekter kanbanD.md ohne eigenen Satz keine Klasse (R00113). */
function vorrat(a) {
  if (ausserhalbEinesBoards()) return klassenvorratDerAufgabe(a ? a.nummer : null, S.boards || [], S.zustand.einstellungen);
  return klassenvorrat(S.board, S.zustand.einstellungen);
}
/** Der Klassenvorrat für „Neue Aufgabe“: der des gewählten Boards, ohne Board die Vorgabe des Ordners (ADR-0031 Regel 6). */
function vorratDerNeuenAufgabe() {
  const neu = S.ui.neu;
  const ziel = neu && neu.board ? (S.boards || []).find(b => b.slug === neu.board) : null;
  return klassenvorrat(ziel || null, S.zustand.einstellungen);
}
const klasse = (k, a) => k && vorrat(a).find(c => c.schluessel === k);
/** Ob die Sicht den Klassenvorrat kennt: bei defekter kanbanD.md nur, wenn ein eigener Satz gilt — sonst wäre jede Klasse fremd. */
const vorratBekannt = a => !S.einstellungenDefekt || vorrat(a).length > 0;
/** Der Schlüssel einer fremden Klasse (D00012): die Aufgabe trägt ihn, der geltende Klassenvorrat kennt ihn nicht; sonst ''. */
const fremdeKlasse = a => a.klasse && vorratBekannt(a) && !klasse(a.klasse, a) ? a.klasse : '';
/** Die fremde Klasse auf der Karte: der Schlüssel als Text ohne Farbe (R00195 AK 6); der Name der Karte nennt ihn schon. */
const vFremdeKlasse = a => (fremd => fremd ? `<span class="kb-fremd" aria-hidden="true" title="Klasse ${esc(fremd)}">${esc(fremd)}</span>` : '')(fremdeKlasse(a));
const aufgabe = nr => S.aufgaben.find(a => a.nummer === nr);
const isoD = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/** Hilfstext der Herkunftsfelder: was man eingeben kann, der Eingabewert „ohne Herkunft“ in Anführungszeichen. */
const HERKUNFT_HILFE = `WBS-Knoten I0001, Anforderung R00014, mit Kürzel der Anwendung kd:I0001, oder „${OHNE_HERKUNFT}“ · Enter`;
/** id der Meldung im Fuß des Aufgabenfensters; bleibt über jedes Neuzeichnen gleich, damit ein Feld auf sie verweisen kann. */
const FENSTER_MELDUNG = 'fenster-meldung';
/** Kennung des Felds „Neue Herkunft“ an einer Meldung des Aufgabenfensters (`S.ui.fensterFehlerFeld`) und am einen Entwurf (`S.ui.entwurf`). */
const HERKUNFT_FELD = 'herkunft';
/** Kennung des Titelfelds an Meldung und Entwurf (R00155 #96). */
const TITEL_FELD = 'titel';
/** Kennung des Felds „Zeit nachtragen“ an Meldung und Entwurf (R00155 #93). */
const ZEIT_FELD = 'zeit';
/** Wert und Verweis eines Entwurfsfelds — die eine Stelle für alle Felder (ADR-0015 N2, R00155 G-1): die abgelehnte Eingabe
    dieser Aufgabe statt `gezeichnet`, und solange die Meldung das Feld nennt, ungültig mit Verweis auf sie (R00111 AK 1). */
function vEntwurf(a, feld, gezeichnet = '') {
  const abgelehnt = entwurfswert(S.ui.entwurf, a.nummer, feld);
  const wert = abgelehnt === null ? gezeichnet : abgelehnt;
  return ` value="${esc(wert)}"${meldungsverweis(S.ui.entwurf, { text: S.ui.fensterFehler, feld: S.ui.fensterFehlerFeld }, a.nummer, feld, FENSTER_MELDUNG)}`;
}

/** Standardanwendung und Register zusammen — wie der Server zählt (web/register.js). */
function anwendungenImOrdner() {
  const q = (S.zustand && S.zustand.einstellungen && S.zustand.einstellungen.quellen) || {};
  return anwendungenZahl(q);
}
/** Ohne Kürzel bei mehreren Anwendungen (R00053, R00212): gerechnet aus Text und Register, nicht aufgelöst. */
const mehrdeutig = x => !x.includes(':') && x !== 'thin air' && anwendungenImOrdner() > 1;
/** Die Herkunft als Text (R00212): kein Link, kein `title`, kein Zeiger — nur „ohne Herkunft“ und „mehrdeutig“ tragen ihren Hinweis. */
function vHerkunftChip(x) {
  // Der inhaltliche Schlüssel des Sicherers (R00138, ADR-0007 N3 Regel 2): die Stelle (Reihenfolge) überlebt eine fremde Liste nicht.
  const halt = ` data-halt="herkunft:${esc(x)}"`;
  if (x === 'thin air') return `<span class="org leer"${halt} title="${OHNE_HERKUNFT}">${OHNE_HERKUNFT}</span>`;
  if (mehrdeutig(x)) return `<span class="org mehrdeutig"${halt} title="mehrdeutig — mehrere Anwendungen registriert; mit Kürzel schreiben, z. B. kd:${esc(x)}">${esc(x)} · mehrdeutig</span>`;
  return `<span class="org"${halt}>${esc(x)}</span>`;
}
/** Wirkungen einer Aufgabe auf die WBS als Chips + / ↻ / − mit Link zur Zeile in der WBS-Sicht (R00057). */
function vWirkungChip(w) {
  const c = wirkungChip(w);
  return `<a class="wchip ${esc(c.aktion)}" href="${esc(c.ziel)}" data-act="wbs-zu" data-arg="${esc(c.ziel)}" title="${esc(c.titel)}">${esc(c.text)}</a>`;
}
/** Ampel und Schalter einer Wirkung: die Ampel zeigt den Zielzustand (R00072) — grün gebaut bzw. verworfen, rot offen,
 *  grau WBS nicht lesbar; der Schalter zeigt und schaltet den Eintritt (R00071). */
function vEintritt(x, j) {
  const s = (S.ui.eintritt || []).find(z => z.i === j) || {}, e = s.eingetreten, name = esc(wirkungChip(x).text);
  const ampel = s.erfuellt == null ? ['grau', 'WBS nicht lesbar — Stand unbekannt'] : s.erfuellt ? ['an', 'im Zielzustand'] : ['aus', 'noch nicht im Zielzustand'];
  return `<i class="ampel ${ampel[0]}" title="${ampel[1]}" aria-hidden="true"></i>${vWirkungChip(x)}<button class="as schalter${e ? ' an' : ''}" data-act="wirkung-eintritt" data-arg="${j}|${!e}" aria-pressed="${!!e}" aria-label="Wirkung ${name} eingetreten"${e == null ? ' disabled' : ''} title="${e ? 'eingetreten — Klick nimmt die Änderung an der WBS zurück' : 'nicht eingetreten — Klick führt die Änderung an der WBS aus'}">eingetreten</button>`;
}
/** Feld `wbs-effects` im Aufgabenfenster: Chips mit Ampel, Schalter und ×, darunter das Formular einer neuen Wirkung. */
function vWirkungenFeld(a) {
  const register = (S.zustand.einstellungen.quellen.anwendungen || []), w = a.wirkungen || [];
  if (!register.length && !w.length) return '';
  const chips = w.map((x, j) => `<span class="ochip wirkung">${vEintritt(x, j)}<button data-act="wirkung-weg" data-arg="${j}" data-halt="wirkung-weg:${esc(wirkungChip(x).text)}" data-ort='[data-act="wirkung-neu"]' title="aus der Aufgabe entfernen — die WBS bleibt" aria-label="Wirkung ${esc(wirkungChip(x).text)} entfernen">×</button></span>`).join('');
  const knopf = register.length && !S.ui.wirkungNeu ? `<button class="lnk" data-act="wirkung-neu" title="Wirkung auf die WBS vermerken: anlegen, überarbeiten, verwerfen — die WBS ändert sich erst mit dem Schalter „eingetreten“">+ Wirkung</button>` : '';
  return `${vBeschriftung('wbs-effects')}<span class="w wrap" id="wirkungen" role="group" aria-label="Wirkungen">${chips}${knopf}</span>${S.ui.wirkungNeu ? vWirkungForm(register) : ''}`;
}
/** Feld `phases` (R00058): je Phase nach der Entwicklung ein Schalter „entfällt“ — gedrückt steht die Phase in phases.skipped. */
function vPhasenFeld(a) {
  const folge = (S.board && S.board.phasen && S.board.phasen.folge) || [], weg = (a.phasen && a.phasen.uebersprungen) || [];
  const namen = [...folge.slice(1).map(p => p.name), ...weg.filter(n => !folge.some(p => p.name === n))];
  if (!namen.length) return '';
  return `${vBeschriftung('phases')}<span class="w wrap" id="phasen-entfallen" role="group" aria-label="Phasen">${namen.map(n => `<button class="as${weg.includes(n) ? ' an' : ''}" data-act="phase-entfaellt" data-arg="${esc(n)}" aria-pressed="${weg.includes(n)}" title="${weg.includes(n) ? 'entfällt — zählt in dieser Phase nicht; Klick nimmt sie wieder auf' : 'Klick: Phase entfällt für diese Aufgabe'}">${esc(n)} entfällt</button>`).join('')}</span>`;
}
/** Feld „Signale“ (R00076): je eingerichtetem Signal ein Schalter; ein nicht mehr eingerichtetes, das die Aufgabe trägt, lässt sich nur zurücknehmen. */
function vSignalFeld(a) {
  const alle = [...signale().map(g => g.schluessel), ...(a.signale || []).filter(s => !signalDef(s))];
  if (!alle.length) return '';
  const schalter = s => {
    const an = (a.signale || []).includes(s), g = signalDef(s), name = g ? g.bezeichnung : s;
    return `<button class="as sig${an ? ' an' : ''}" data-act="signal-fenster" data-arg="${esc(s)}" aria-pressed="${an}" aria-label="Signal ${esc(name)}" style="--sg:${esc(signalFarbe(s))}" title="${an ? 'gesetzt — Klick nimmt es zurück' : 'Klick setzt das Signal'} (signals: ${esc(s)})">${FACKEL}${esc(name)}</button>`;
  };
  return `${vBeschriftung('signals')}<span class="w wrap" id="signale" role="group" aria-label="Signale">${alle.map(schalter).join('')}</span>`;
}
/** Feld „Zählt in Berichten“ (R00060): je Bericht ein Schalter; „(Standard)“, solange der Schlüssel fehlt. Klick nimmt aus bzw. setzt zurück. */
function vZaehlungFeld(a) {
  const r = a.reporting || {};
  const schalter = (bericht, name) => {
    const zaehlt = r[bericht] !== false, standard = !(bericht in r);
    return `<button class="as${zaehlt ? ' an' : ''}" data-act="zaehlung" data-arg="${bericht}" aria-pressed="${zaehlt}" aria-label="zählt in ${name}" title="${zaehlt ? `zählt in ${name} — Klick nimmt die Aufgabe aus (reporting.${bericht}: false)` : `zählt nicht in ${name} — Klick setzt auf den Standard zurück`}">${name}${standard ? ' <span class="muted">(Standard)</span>' : ''}</button>`;
  };
  return `${vBeschriftung('reporting')}<span class="w wrap" id="zaehlung" role="group" aria-label="Zählt in Berichten">${schalter('burndown', 'Burndown')}${schalter('forecast', 'Wie lange noch')}</span>`;
}
/** Formular einer neuen Wirkung — „vermerken“ ändert die WBS nicht, eintreten lässt sie der Schalter am Chip (R00071). */
function vWirkungForm(register) {
  const f = S.ui.wirkungNeu, wahl = (n, titel, werte) => `<span class="k">${titel}</span><span class="w"><select data-wf="${n}" id="wirkung-${n}" aria-label="${titel}">${werte.map(([v, t]) => `<option value="${esc(v)}"${v === f[n] ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></span>`;
  const feld = (n, titel, ph) => `<span class="k">${titel}</span><span class="w"><input class="mini-inp full" id="wirkung-${n}" data-wf="${n}" value="${esc(f[n])}" placeholder="${esc(ph)}" data-enter="wirkung-setzen" aria-label="${titel}"></span>`;
  const anlegen = f.action === 'create';
  const felder = wahl('action', 'Aktion', [['create', '+ anlegen'], ['rework', '↻ überarbeiten'], ['remove', '− verwerfen']]) + wahl('application', 'Anwendung', register.map(x => [x.kuerzel, `${x.kuerzel} · ${x.name}`]))
    + (anlegen ? feld('parent', 'Eltern', 'D0002') + wahl('level', 'Ebene', ['Dialog', 'Interaction', 'Feature', 'Bubble'].map(e => [e, e])) + feld('name', 'Name', 'was entsteht') + feld('done_criterion', 'Fertig', 'US-1') : feld('node', 'Knoten', 'D0002'));
  return `<div class="wirkung-form" role="group" aria-label="Neue Wirkung"><div class="felder">${felder}</div>${f.fehler ? `<div class="warnh" role="alert">${esc(f.fehler)}</div>` : ''}<div class="fuss"><span class="muted">eingetreten: ${anlegen ? 'neuer Knoten rot mit der nächsten freien ID' : f.action === 'rework' ? 'Knoten und zählende Nachfahren rot' : 'Knoten und Nachfahren verworfen'} · vermerken ändert die WBS noch nicht</span><button class="btn" data-act="wirkung-zu">abbrechen</button><button class="btn btn-haupt" data-act="wirkung-setzen">vermerken</button></div></div>`;
}
/** Ein Punkt für alle Wirkungen der Karte (R00072): grün im Zielzustand, rot offen, grau WBS nicht geladen; kein Link —
 *  Chips, Links und Schalter stehen im Aufgabenfenster. */
function vWirkungsPunkt(a) {
  const p = wirkungsPunkt(a, S.pruefWbs || {});
  if (!p) return '';
  const wort = { an: 'alle im Zielzustand', aus: 'noch nicht alle im Zielzustand', grau: 'Stand unbekannt' }[p.stand];
  return `<span class="wpunkt ${p.stand}" role="img" aria-label="WBS-Wirkungen: ${wort}" title="${esc(`WBS-Wirkungen: ${wort}\n${p.zeilen.join('\n')}`)}"></span>`;
}
function vHerkunft(a) {
  const o = a.herkunft.length ? a.herkunft : ['thin air'];
  return `<span class="orgs">${o.map(vHerkunftChip).join('')}</span>`;
}
/** Rotes Ausrufezeichen, solange eine Prüfung einer Spalte links der Karte nicht erfüllt ist (R00059); Tooltip: Prüfung und Knoten. */
function vAusruf(a) {
  const offen = S.board ? kartenPruefungen(S.board, a, S.pruefWbs || {}) : [];
  return offen.length ? `<span class="ausruf" data-pruefung="${esc(offen.map(w => w.pruefung).join(' '))}" title="${esc(offen.map(w => `${w.pruefung}: ${w.details.join(', ')}`).join(' · '))}" aria-label="Prüfung nicht erfüllt">!</span>` : '';
}
/** Σ der gebuchten Zeit (R00089): abgeschlossene als Basis, laufende zählt der Sekundentakt über `data-summe-seit` weiter. */
function vSumme(a) {
  const jetzt = Date.now(), beginn = z => laufBeginn(a, z), gesamt = summeMs(a.zeiten, jetzt, beginn);
  if (!gesamt && !laufende(a).length) return '';
  const basis = summeMs(a.zeiten.filter(z => z.ende), jetzt), seit = laufende(a).map(beginn).join(',');
  const anteile = summeJePerson(a.zeiten, jetzt, beginn).map(x => `${per(x.wer).name} ${hm(x.ms)}`).join(' · ');
  return `<span class="sum" data-summe-basis="${basis}" data-summe-seit="${seit}" title="${esc(anteile)}" aria-label="gebuchte Zeit ${hm(gesamt)}: ${esc(anteile)}">Σ ${hm(gesamt)}</span>`;
}
/** Preisetikett (R00105): sichtbar die Mitte, Hinweis und versteckter Name nennen die Grenzen; steht Σ unmittelbar daneben, hängt das Komma am Betrag. Die Karte ruft es nur ohne angefallene Kosten auf (R00198: „Ist“ verdrängt das Etikett). */
function vPreisetikett(a, vorSumme) {
  if (!a.cost) return '';
  const texte = preisetikett(kostenInCent(a.cost));
  let sichtbar = texte.sichtbar;
  if (vorSumme) sichtbar += ',';
  return `<span class="preis" title="${esc(texte.hinweis)}"><span class="vh">${esc(texte.name)}</span><span aria-hidden="true">${esc(sichtbar)}</span></span>`;
}
/** Angefallene Kosten (R00196, Zeichnung D0002 #angefallene-kosten): je Währung ein Betrag, „Ist“ vor dem ersten, „·“ am
    vorderen Betrag; der Name steht versteckt im Element, der Hinweis nennt keinen Betrag. Ohne angefallene Kosten kein Element. */
function vAngefallen(a) {
  const texte = angefallenAufKarte(a), letzter = texte.betraege.length - 1;
  if (letzter < 0) return '';
  const einheiten = texte.betraege.map((betrag, stelle) => `<span class="ag-b">${stelle === 0 ? '<span class="ag-k">Ist</span> ' : ''}${esc(betrag)}${stelle < letzter ? ' ·' : ''}</span>`);
  return `<span class="angefallen" title="angefallene Kosten"><span class="vh">${esc(texte.name)}</span><span aria-hidden="true">${einheiten.join(' ')}</span></span>`;
}
/** Geschätzte Zeit (R00129, ADR-0023): eigenes `<span>`, sichtbar `≈ h:mm` (aria-hidden), Name als `.vh` im Element, kein Bedienziel. */
function vSchaetzung(a) {
  if (!a.estimate) return '';
  const wert = hm(a.estimate * 6e4);
  return `<span class="schaetzung"><span class="vh">Geschätzt ${wert}</span><span aria-hidden="true">≈ ${wert}</span></span>`;
}
/** Die Spaltenwechsel einer Aufgabe aus den geladenen Bewegungen des Boards (`S.bew`, R00126); ohne Bewegungen leer.
    Der Blick ist gemerkt: ein Zeichnen ohne neues Laden baut die Zuordnung nicht neu. */
let wechselStand = null, wechselJeAufgabe = new Map();
function wechselDerAufgabe(nr) {
  if (wechselStand !== S.bew) {
    wechselStand = S.bew;
    wechselJeAufgabe = new Map(((S.bew && S.bew.aufgaben) || []).map(x => [x.nummer, x.wechsel]));
  }
  return wechselJeAufgabe.get(nr);
}
function vKarte(a, fertig, spalte) {
  const cl = klasse(a.klasse, a), sig = ersteSignal(a, signale().map(g => g.schluessel));
  const tk = a.teilaufgaben.length ? `<span class="tk">☑ ${a.teilaufgaben.filter(t => t.erledigt).length}/${a.teilaufgaben.length}</span>` : '';
  // vorgelesen wird „fällig“ mit Jahr, die sichtbare Kurzform bleibt stumm
  const due = a.faellig ? `<span class="vh">fällig ${esc(datumLang(a.faellig))}</span><span class="due${!fertig && a.faellig <= isoD(Date.now() + 864e5) ? ' warn' : ''}" aria-hidden="true" title="fällig ${esc(datumLang(a.faellig))}">${esc(datumKurz(a.faellig, isoD(Date.now())))}</span>` : '';
  const ext = S.extern[a.nummer];
  const rs = laufende(a), eigen = rs.some(z => z.wer === S.ich), erster = rs.map(z => laufBeginn(a, z)).sort((x, y) => x - y)[0];
  const laufzeit = rs.length ? Date.now() - erster : 0;
  const vergessen = istVergessen(laufzeit);
  const alter = alterText(wechselDerAufgabe(a.nummer), spalte, Date.now());
  let seit = '', alterVoll = '';
  if (alter) {
    seit = `<span class="seit" aria-hidden="true">${esc(alter.kurz)}</span>`;
    alterVoll = alter.voll;
  }
  const zusaetze = [vergessen ? `Timer läuft ${seitText(laufzeit)}` : ''];
  if (alterVoll) zusaetze.push(alterVoll);
  const lz = rs.length ? vLaufChip({ beginn: erster, eigen, anzahl: rs.length, namen: rs.map(z => per(z.wer).name).join(', ') }) : '';
  const gewaehlt = S.ui.auswahl.includes(a.nummer), summe = vSumme(a), angefallen = vAngefallen(a);
  return `<div class="ka${fertig ? ' fertig' : ''}${ext ? ' fremd' : ''}${S.ui.offen === a.nummer ? ' offen' : ''}${gewaehlt ? ' gewaehlt' : ''}${vergessen ? ' vergessen' : ''}" role="listitem" aria-label="${esc(kartenName(a, vorratBekannt(a) ? vorrat(a) : null, gewaehlt, zusaetze))}" draggable="true" data-id="${a.nummer}" data-act="oeffnen" data-arg="${a.nummer}" tabindex="0"${cl ? ` data-c="${esc(a.klasse)}"` : ''}${cl && !PAL.includes(cl.farbe) ? ' data-eigen' : ''}${sig ? ` data-sig="${esc(sig)}"` : ''}${cl || sig ? ` style="${[cl && cv(cl.farbe), sig && '--sg:' + esc(signalFarbe(sig))].filter(Boolean).join(';')}"` : ''}><div class="r0">${vWirkungsPunkt(a)}<span class="id">#${a.nummer}</span>${S.ui.umbenennen === a.nummer ? `<input class="inp umbenennen" id="umbenennen" value="${esc(a.titel)}" data-enter="umbenennen-ok" data-arg="${a.nummer}" aria-label="Neuer Titel">` : `<div class="t" data-dbl="umbenennen" data-arg="${a.nummer}">${esc(a.titel)}</div>`}${vSignale(a, fertig)}${(e => e ? `<span class="ecke" data-leiste="1">${e}</span>` : '')(lz + vStoppKnopf(a))}</div>${(r1 => r1 ? `<div class="r1">${r1}</div>` : '')(`${vAusruf(a)}${a.labels.map(l => `<span class="lbl">${esc(l)}</span>`).join('')}`)}${fertig ? '' : vNaechsteTeilaufgabe(a)}<div class="r3">${vFremdeKlasse(a)}<span class="rechts">${angefallen || vPreisetikett(a, summe.length > 0)}${summe}${seit}${vSchaetzung(a)}${tk}${due}${vHerkunft(a)}${vSchloss(a)}<span class="avs">${a.zustaendige.map(pk).join('')}</span></span></div>${ext ? `<div class="ein" data-ext="${ext.at}" data-datei="${esc(ext.datei)}">extern · ${esc(ext.datei)} · vor ${Math.round((Date.now() - ext.at) / 1000)} Sek</div>` : ''}</div>`;
}

/** Die defekte Datei zu einer Aufgabennummer (über den Dateinamen). */
function defektZuNummer(nr) {
  return (S.zustand.defekte || []).find(d => d.pfad.startsWith('aufgaben/') && parseInt(d.pfad.slice(9), 10) === nr);
}
function vDefekt(nr, d) {
  return `<div class="ka defekt" role="listitem" aria-label="${esc(kartenNameDefekt(nr))}" data-id="${nr}" data-act="defekt-oeffnen" data-arg="${nr}" tabindex="0"><div class="r1"><span class="id">#${nr}</span><span class="lbl warn">nur lesbar</span></div><div class="t">#${nr} — Datei defekt</div><div class="r3 fehlertext">${esc(d.fehler)}</div></div>`;
}
function vDefektFenster() {
  const d = S.ui.defektDatei;
  if (!d) return '';
  return `<div class="mod-bg" data-act="schliessen-bg"><div class="mod" id="defekt-fenster" role="dialog" aria-label="Defekte Datei #${S.ui.offenDefekt}" style="--cl:var(--kd-warn)"><div class="mod-kopf"><span class="id">#${S.ui.offenDefekt}</span><span class="lbl warn">defekt · nur lesbar</span><span class="pfad">${esc(d.pfad)}</span><div class="rechts"><a class="btn btn-sym" href="vscode://file${esc(S.zustand.ordner)}/${esc(d.pfad)}" title="Im Editor reparieren">↗</a><button class="btn btn-sym" data-act="schliessen" aria-label="Schließen">✕</button></div></div><div class="archbar warnbar" role="alert">${esc(d.fehler)}</div><div class="mod-body voll"><div class="mod-main"><pre class="md" id="defekttext">${esc(d.text)}</pre></div></div>${vHinweisAnker('defekt')}<div class="mod-fuss"><span>Die Datei ist nur lesbar, bis sie im Editor repariert ist; danach erscheint die Aufgabe ohne Neuladen.</span></div></div></div>`;
}
const KUERZEL_BOARD = [['p', 'Zuständige zuweisen (Dialog)'], ['Rechtsklick · Menütaste · Umschalt + F10', 'Menü der Karte'], ['a · Entf', 'Karte archivieren'], ['1 … 9', 'Karte in Spalte 1 … 9'], ['c', 'Verweis „#n Titel“ kopieren'], ['t · Leertaste', 'eigenen Timer an / aus'], ['m · F2', 'mir zuweisen · umbenennen'], ['Strg + Z', 'letzte Aktion rückgängig'], ['← → ↑ ↓', 'Karte wählen'], ['Umschalt + ← →', 'Karte in die Nachbarspalte'], ['Alt + ↑ ↓', 'Karte in der Spalte verschieben'], ['Strg + Klick', 'Karte zur Auswahl hinzu / heraus'], ['Umschalt + Klick · Umschalt + ↑ ↓', 'Reihe auswählen'], ['Esc', 'Auswahl aufheben'], ['Enter', 'Karte öffnen'], ['n', 'Neue Aufgabe in dieser Spalte (Dialog)'], ['Esc', 'Filter leeren'], ['/', 'Filter']];
const KUERZEL_FENSTER = [['t', 'Timer an / aus'], ['m', 'mir zuweisen / mich abnehmen'], ['a', 'archivieren / zurückholen'], ['e', 'Titel bearbeiten'], ['b', 'Beschreibung bearbeiten'], ['Strg + Enter', 'Beschreibung speichern'], ['s', 'neue Teilaufgabe'], ['k', 'Kommentar schreiben'], ['d', 'Inhalt / Datei'], ['Esc', 'Eingabe verwerfen; ohne Eingabe schließen']];
const KUERZEL_LISTE = [['↑ ↓', 'Zeile wählen'], ['Enter', 'Aufgabe öffnen'], ['n', 'Neue Aufgabe ohne Board'], ['a · Entf', 'archivieren / zurückholen'], ['c', 'Verweis kopieren'], ['Umschalt + F10', 'Menü der Zeile'], ['Ziehen', 'Zeile auf eine Spalte oder ins Archiv'], ['/', 'Filter']];
const KUERZEL_NEU = [['Enter (im Titel) · Strg + Enter', 'anlegen'], ['Umschalt + Strg + Enter', 'anlegen und weitere'], ['Enter (Teilaufgabe)', 'Teilaufgabe anfügen'], ['Esc', 'abbrechen']];
const KUERZEL_UEBERALL = [['g b', 'Board'], ['g a', 'Aufgaben'], ['g p', 'Personen'], ['g s', 'Stundenzettel'], ['g z', 'Zeiten nach Aufgabe und Person'], ['g v', 'Burndown'], ['g d', 'Durchlaufzeit'], ['g w', 'Wie lange noch'], ['g f', 'Projekt-Fever-Chart'], ['g k', 'WBS der gebundenen Anwendung'], ['g e', 'Einrichten'], ['n', 'Neue Aufgabe'], ['b', 'Board wechseln'], ['i', 'Ich bin …'], ['Strg + Z', 'rückgängig (solange der Hinweis steht)'], ['?', 'diese Übersicht']];
function hilfeOrt() {
  if (S.ui.offen) return ['Aufgabenfenster', KUERZEL_FENSTER];
  if (S.ui.view === 'board') return ['Board', KUERZEL_BOARD];
  if (S.ui.view === 'aufgaben') return ['Aufgabenliste', KUERZEL_LISTE];
  return null;
}
function vHilfe() {
  const zeilen = liste => liste.map(([k, t]) => `<tr><td>${k.split(' ').map(x => x === '+' ? ' + ' : `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(t)}</td></tr>`).join('');
  const ort = hilfeOrt();
  return `<div class="mod-bg hilfe-bg" data-act="schliessen-hilfe"><div class="hilfe" id="hilfe" tabindex="-1" role="dialog" aria-label="Tastaturkürzel">${ort ? `<h3>HIER: ${esc(ort[0].toUpperCase())}</h3><table>${zeilen(ort[1])}</table>` : ''}<h3>ÜBERALL</h3><table>${zeilen(KUERZEL_UEBERALL)}</table><h3>NEUE AUFGABE</h3><table>${zeilen(KUERZEL_NEU)}</table><p class="muted hilfe-quelle">Belegung nach gängiger Kanban-Konvention (Kanbanflow, Kanban Tool, Kanboard).</p></div></div>`;
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
    return `<div class="km-e${i === ebene.index ? ' an' : ''}${e.aktuell ? ' km-aktuell' : ''}${e.warn ? ' km-warn' : ''}" role="menuitem" tabindex="-1" data-mp="${p}"${e.unter ? ' aria-haspopup="true"' : ''}${e.aktuell ? ' aria-disabled="true"' : ''}>${e.aktuell || e.haken ? '✓ ' : '<span class="km-ohne"></span>'}${esc(e.text)}<span class="km-k">${e.unter ? (e.kuerzel ? esc(e.kuerzel) + ' ▸' : '▸') : esc(e.kuerzel || '')}</span>${unterOffen ? `<div class="kmenue unter" role="menu" aria-label="${esc(e.text)}">${vMenueEintraege(e.unter, ebene.unter, aktiv, p)}</div>` : ''}</div>`;
  }).join('');
}
function vMenue() {
  const m = S.ui.menue;
  if (!m) return '';
  return `<div class="kmenue" id="kmenue" role="menu" aria-label="${esc(m.titel)}" style="left:${m.x}px;top:${m.y}px"><div class="km-titel">${esc(m.titel)}</div>${vMenueEintraege(m.eintraege, m, true, '')}</div>`;
}

/* ── Reservierungen (R00087) ── */
const SCHLOSS = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
/** Die Reservierung, solange sie hält — eine abgelaufene zeigt die Oberfläche nicht, auch in einem lange offenen Tab. */
const gueltigeReservierung = a => a && reservierungRest(a.reservierung, Date.now()) ? a.reservierung : null;
const reservierungText = r => `reserviert von ${per(r.wer).name} · Instanz ${r.instanz} · noch ${hm(reservierungRest(r, Date.now()))}`;
function vSchloss(a) {
  const r = gueltigeReservierung(a);
  return r ? `<span class="schloss" title="${esc(reservierungText(r))}" aria-label="${esc(reservierungText(r))}">${SCHLOSS}${esc(r.wer)}</span>` : '';
}
/** Präfix der Schlüssel, die das Fenster „Neue Aufgabe“ vergibt (R00148 AK 18/21) — reserviert: Sensoren und Agenten
    bilden ihre Schlüssel aus Repository, Bedingung und Fundstelle (R00098). */
const FENSTER_SCHLUESSEL = 'neu-';
/** Der Fremdschlüssel wird nur beim Anlegen gesetzt (R00098) — hier nur lesbar. Ein Fenster-Schlüssel bleibt in der
    Datei, ist aber kein Fremdschlüssel und steht nicht in „Details“ (R00148 AK 21). */
function vSchluesselFeld(a) {
  if (!a.key || a.key.startsWith(FENSTER_SCHLUESSEL)) return '';
  return `${vBeschriftung('key')}<span class="w mono" id="schluessel">${esc(a.key)}</span>`;
}
function vReservierungFeld(a) {
  const r = gueltigeReservierung(a);
  if (!r) return '';
  return `${vBeschriftung('reservation')}<span class="w wrap" id="reservierung">${pk(r.wer)}<span>${esc(per(r.wer).name)} · Instanz <span class="mono">${esc(r.instanz)}</span> · seit ${esc(ortszeit(r.seit).slice(11))} · noch ${hm(reservierungRest(r, Date.now()))}</span><button class="as" data-act="freigeben" data-arg="${a.nummer}">freigeben</button></span>`;
}
/** Gültige Reservierungen auf dem offenen Board, in Board-Reihenfolge. */
const reservierteDesBoards = () => S.board ? S.board.spalten.flatMap(sp => sp.aufgaben.map(n => ({ sp, a: aufgabe(n) }))).filter(x => x.a && !x.a.archiviert && gueltigeReservierung(x.a)) : [];
function vReservierungenPop() {
  const zeilen = reservierteDesBoards();
  const tabelle = zeilen.length ? `<div class="res-rahmen"><table class="pt dicht" id="reservierungen"><thead><tr><th>Karte</th><th>Titel</th><th>Spalte</th><th>Person</th><th>Instanz</th><th>seit</th><th class="r">noch</th><th></th></tr></thead><tbody>${zeilen.map(({ sp, a }) => { const r = a.reservierung; return `<tr data-reserviert="${a.nummer}"><td><a href="#" class="id" data-act="oeffnen" data-arg="${a.nummer}">#${a.nummer}</a></td><td>${esc(a.titel)}</td><td>${esc(sp.name)}</td><td>${pk(r.wer)}${esc(per(r.wer).name)}</td><td class="mono">${esc(r.instanz)}</td><td class="mono">${esc(zeitpunktLang(r.seit))}</td><td class="r num">${hm(reservierungRest(r, Date.now()))}</td><td><button class="btn" data-act="freigeben" data-arg="${a.nummer}">freigeben</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="leer">Keine gültigen Reservierungen auf diesem Board.</div>';
  return `<div class="pop" id="pop" data-for="t-board" data-al="l" style="width:820px;max-width:calc(100vw - 32px)" role="dialog" aria-label="Aufgabenreservierungen"><h4 class="pop-kopf">AUFGABENRESERVIERUNGEN <span class="mono">${zeilen.length}</span></h4>${tabelle}<div class="fuss">Eine Reservierung hält 24 h; Agenten lassen reservierte Karten beim Ziehen aus.${zeilen.length ? ` <button class="btn" data-act="alle-freigeben" style="margin-left:auto">alle freigeben</button>` : ''}</div></div>`;
}

function vDefektePop() {
  const ds = S.zustand.defekte || [];
  return `<div class="pop" id="pop" data-for="t-defekt" data-al="l" style="width:520px" role="dialog" aria-label="Defekte Dateien"><h4 class="pop-kopf">DEFEKTE DATEIEN <span class="mono">${ds.length}</span></h4>${ds.map(d => `<div class="dz"><a class="mono" href="vscode://file${esc(S.zustand.ordner)}/${esc(d.pfad)}">${esc(d.pfad)}</a><span>${esc(d.fehler)}</span></div>`).join('')}<div class="fuss">Reparieren im Editor oder mit Git; kanbanD zeigt die Änderung sofort.</div></div>`;
}

/** Erste offene Teilaufgabe als nächster Schritt; Kästchen und Text sind ein Ziel und haken sie ab (R00108). */
function vNaechsteTeilaufgabe(a) {
  const i = a.teilaufgaben.findIndex(t => !t.erledigt);
  if (i < 0) return '';
  return `<div class="naechste" data-leiste="1"><button class="naechste-ziel" data-act="teil-karte" data-arg="${a.nummer}|${i}" role="checkbox" aria-checked="false" aria-label="${esc(a.teilaufgaben[i].text)} abhaken"><i class="naechste-box" aria-hidden="true"></i><span>${esc(a.teilaufgaben[i].text)}</span></button></div>`;
}

/** Stoppknopf rechts oben, solange der eigene Timer läuft; gestartet wird über Menü oder Taste t. Klicks darauf öffnen die Karte nicht. */
function vStoppKnopf(a) {
  if (a.archiviert || !laufende(a).some(z => z.wer === S.ich)) return '';
  return `<button class="kl" data-act="stop" data-arg="${a.nummer}|${esc(S.ich)}" title="meinen Timer stoppen (t)" aria-label="Timer an #${a.nummer} stoppen">■</button>`;
}

/** Dialog „Zuständige zuweisen“ für eine oder mehrere Karten: Auswahl wird erst mit Speichern übertragen (R00064, R00065).
    Ein gemischtes Kästchen (auf einigen Karten zuständig) bekommt nach dem Zeichnen `indeterminate`. */
function vZuweisen() {
  const z = S.ui.zuweisen, as = z.nummern.map(aufgabe).filter(Boolean);
  if (!as.length) return '';
  const zeilen = Object.entries(z.wahl).map(([k, w]) => {
    const p = per(k), gesperrt = !p.aktiv && w === 'aus';
    return `<label class="zw-p${p.aktiv ? '' : ' still'}"${gesperrt ? ' aria-disabled="true" title="stillgelegt – nicht wieder zuweisbar"' : ''}><input type="checkbox" data-act="zuweisen-wahl" data-arg="${esc(k)}"${w === 'an' ? ' checked' : ''}${w === 'gemischt' ? ' data-gemischt="1"' : ''}${gesperrt ? ' disabled' : ''}>${pk(k)}<span>${esc(p.name)}</span>${p.aktiv ? '' : '<span class="muted">stillgelegt</span>'}</label>`;
  }).join('');
  const name = as.length === 1 ? `#${as[0].nummer}` : `${as.length} Karten`, kopf = as.length === 1 ? `#${as[0].nummer} ${esc(as[0].titel)}` : as.map(a => '#' + a.nummer).join(', ');
  return `<div class="mod-bg" data-act="zuweisen-bg"><div class="zuweisen" id="zuweisen" role="dialog" aria-label="Zuständige für ${name}"><h4>ZUSTÄNDIGE <span class="mono">${kopf}</span></h4><div class="zw-liste">${zeilen}</div><div class="zw-fuss"><button class="btn" data-act="zuweisen-ab">Abbrechen</button><button class="btn btn-haupt" data-act="zuweisen-ok">Speichern</button></div></div></div>`;
}

function vFehlt(nr) {
  return `<div class="ka fehlt" role="listitem" aria-label="${esc(kartenNameFehlt(nr))}" draggable="true" data-id="${nr}"><div class="r1"><span class="id">#${nr}</span></div><div class="t">#${nr} — Aufgabe fehlt</div><div class="r3">keine Datei unter aufgaben/</div></div>`;
}

/* ── Signale (R00076): Fackel je gesetztem Signal, Kalender für die Fälligkeit ── */
const FACKEL = '<svg class="i-sig" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .8c3.4 3 5.2 5.7 5.2 8.2a5.2 5.2 0 0 1-10.4 0c0-1.8.9-3.6 2.5-5.2.2 1.7 1.1 2.9 2.2 3.4-.3-2.4-.1-4.5.5-6.4z"></path><path d="M5.8 13.2h12.4l-2.8 4.3H8.6z"></path><rect x="10.4" y="17.2" width="3.2" height="6.4" rx="1.2"></rect></svg>';
const KALENDER = '<svg class="i-sig strich" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M3.5 10h17M8 3v4M16 3v4"></path></svg>';
const signale = () => (S.zustand.einstellungen && S.zustand.einstellungen.signale) || [];
const signalDef = s => signale().find(g => g.schluessel === s);
const signalFarbe = s => (g => g ? terminFarbe(g.farbe) : 'var(--kd-muted)')(signalDef(s));
/** Die Signale der Karte: gesetzte als Knopf (Klick nimmt zurück), die Fälligkeit als Kalender. */
function vSignale(a, fertig) {
  const s = aufgabenSignale(a, isoD(Date.now()), fertig);
  if (!s.length) return '';
  return `<span class="sigs">${s.map(x => {
    if (x.faellig) { const t = x.faellig === 'heute' ? 'heute fällig' : `überfällig seit ${esc(datumLang(a.faellig))}`; return `<span class="signal faellig ${x.faellig}" role="img" aria-label="${t}" title="${t}">${KALENDER}</span>`; }
    const g = signalDef(x.schluessel), name = g ? g.bezeichnung : x.schluessel;
    return `<button class="signal" data-act="signal-aus" data-arg="${a.nummer}|${esc(x.schluessel)}" style="--sg:${esc(signalFarbe(x.schluessel))}" aria-label="Signal ${esc(name)} zurücknehmen" title="${esc(name)} — Klick nimmt das Signal zurück">${FACKEL}</button>`;
  }).join('')}</span>`;
}
/** Signale im Spaltenkopf: je Signal Symbol und Zahl der sichtbaren Karten, die es tragen; Klick filtert. */
function vKopfSignale(sichtbar, letzte) {
  const heute = isoD(Date.now()), zahl = {};
  sichtbar.forEach(a => aufgabenSignale(a, heute, letzte).forEach(x => { zahl[x.schluessel] = (zahl[x.schluessel] || 0) + 1; }));
  const reihe = [...signale().map(g => g.schluessel), ...Object.keys(zahl).filter(s => s !== 'due' && !signalDef(s)), 'due'].filter(s => zahl[s]);
  return reihe.map(s => {
    const n = zahl[s], name = s === 'due' ? 'fällig (heute oder überschritten)' : (signalDef(s) || { bezeichnung: s }).bezeichnung;
    return `<button class="sigz${s === 'due' ? ' faellig' : ''}" data-signal="${esc(s)}" data-act="signal-filter" data-arg="${esc(s)}" style="--sg:${s === 'due' ? 'var(--kd-c-red-line)' : esc(signalFarbe(s))}" title="${n} ${n === 1 ? 'Karte' : 'Karten'}: ${esc(name)} — Klick filtert (signal:${esc(s)})" aria-label="${n} ${esc(name)}">${s === 'due' ? KALENDER : FACKEL}×${n}</button>`;
  }).join('');
}

/* ── Board ── */
/** Wortlaut je Eigentümer (R00097): Tooltip und aria-label des Kopfzeichens, Hinweissatz unter der Auswahl. */
const EIGENTUEMER_TEXT = {
  human: 'Spalte gehört dem Menschen — Agenten können Karten hineinlegen, aber nicht herausnehmen',
  agent: 'Spalte gehört den Agenten — kennzeichnet nur, sperrt nichts',
  '': 'Kein Eigentümer — Menschen und Agenten nehmen Karten frei heraus',
  roh: 'Unbekannter Eigentümer „<Rohwert>“ — bleibt erhalten',
};
/** Der Hinweissatz der Auswahl: bei gewähltem Rohwert der Rohwert-Satz, sonst der Satz der Wahl (R00120). */
const eigentuemerText = sp => sp.eigentuemer === 'roh' ? EIGENTUEMER_TEXT.roh.replace('<Rohwert>', sp.roh) : EIGENTUEMER_TEXT[sp.eigentuemer || ''];
/** Zusatz im aria-label des zugeklappten Streifens (R00097). */
const EIGENTUEMER_STREIFEN = { human: 'gehört dem Menschen', agent: 'gehört den Agenten' };
const EIGENTUEMER_SYMBOL = {
  human: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"></path></svg>',
  agent: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M3 12v4M21 12v4"></path><rect x="5" y="7" width="14" height="13"></rect><path d="M9 12v1.5M15 12v1.5" stroke-width="2.6"></path></svg>',
};
/** Kopfzeichen des Eigentümers (R00097): ohne Eigentümer nichts; im Kopf benannt und Auslöser des Erklärtextes (R00119),
 *  Tab-Stopp, kein `title`; im Streifen nur Schmuck (aria-hidden) — dort trägt der Streifen-Knopf die Erklärung. */
function vEigentuemerZeichen(eigentuemer, imStreifen, spalte) {
  if (!EIGENTUEMER_SYMBOL[eigentuemer]) return '';
  const klasse = eigentuemer === 'human' ? 'm' : 'a';
  const benannt = imStreifen ? 'aria-hidden="true"' : `role="img" tabindex="0" data-tip="eig:${esc(spalte)}" data-halt="eig:${esc(spalte)}" aria-label="${EIGENTUEMER_TEXT[eigentuemer]}"`;
  return `<span class="eig-z ${klasse}" ${benannt}>${EIGENTUEMER_SYMBOL[eigentuemer]}</span>`;
}
/** Erklärtext der Grenze (R00119 FA 1): sichtbarer Text und „höchstens n Karten in dieser Spalte“; der sichtbare Text steht wörtlich davor (WCAG 2.5.3). */
const grenzeTipp = (n, ueber) => `Grenze ${n}${ueber ? ' · überschritten' : ''} — höchstens ${n} Karten in dieser Spalte`;
/** Der Spaltenname als verborgene Überschrift zweiter Ebene (R00113, ADR-0018 Regel 2): Hilfstechnik springt damit von Spalte zu Spalte. */
const vSpaltenUeberschrift = sp => `<h2 class="vh">${esc(sp.name)}</h2>`;
/** Zugeklappte Spalte (R00074): Kopf nur mit der Zahl, darunter ein Streifen mit dem gedrehten Namen, der aufklappt. */
function vLaneZu(sp, i, zahl, ueber, farbe) {
  const titel = `${sp.name} · ${zahl} ${zahl === 1 ? 'Aufgabe' : 'Aufgaben'}${sp.grenze ? ` · Grenze ${sp.grenze}${ueber ? ' · überschritten' : ''}` : ''} — Klick klappt auf`;
  // Der Streifen trägt nur das Eigentümer-Zeichen; ist eines gesetzt, ist der Knopf der Auslöser des Erklärtextes
  // (R00119 FA 4). Sein Name nennt „aufklappen, gehört dem …“ und trägt den vollen Satz nicht, daher aria-describedby.
  const erklaerung = EIGENTUEMER_SYMBOL[sp.eigentuemer] ? ` data-tip="klapp:${esc(sp.name)}" data-tip-text="${esc(EIGENTUEMER_TEXT[sp.eigentuemer])}" aria-describedby="eig-erklaer-${i}"` : '';
  const beschreibung = EIGENTUEMER_SYMBOL[sp.eigentuemer] ? `<span class="vh" id="eig-erklaer-${i}">${esc(EIGENTUEMER_TEXT[sp.eigentuemer])}</span>` : '';
  return `<section class="bahn zu${sp.farbe ? ' gefaerbt' : ''}" data-col="${esc(sp.name)}"${farbe}>${vSpaltenUeberschrift(sp)}<div class="bahn-kopf${ueber ? ' ueber' : ''}" tabindex="0" data-kopf="${i}" data-halt="kopf:${esc(sp.name)}" title="Rechtsklick: Menü der Spalte"><span class="n">${zahl}</span></div><button class="flaeche zu-streifen" aria-expanded="false" data-act="spalte-auf" data-arg="${esc(sp.name)}" data-halt="klapp:${esc(sp.name)}"${erklaerung} aria-label="${esc(sp.name)} aufklappen${EIGENTUEMER_STREIFEN[sp.eigentuemer] ? `, ${EIGENTUEMER_STREIFEN[sp.eigentuemer]}` : ''}" title="${esc(titel)}">${vEigentuemerZeichen(sp.eigentuemer, true)}<span class="zu-name">${esc(sp.name)}</span>${beschreibung}</button></section>`;
}
/** Der Datums-Trenner (R00124): dünne Linie mit Beschriftung, `role="listitem"` in der Liste der Spalte, nicht bedienbar. */
const vDatumsTrenner = text => `<div class="dtrenn" role="listitem"><span class="dtrenn-l" aria-hidden="true"></span><span class="dtrenn-t">— ${esc(text)} —</span><span class="dtrenn-l" aria-hidden="true"></span></div>`;
function vLane(sp, i, alle) {
  const letzte = i === alle.length - 1;
  const archiv = imArchiv(), gefiltert = S.ui.filter.trim() !== '' && !(archiv && S.ui.filter.trim() === 'is:archived') || S.ui.bereich !== 'alle';
  const um = umfeld();
  // „Signale oben“ (R00088) ändert nur die Anzeige; die Board-Datei behält ihre Reihenfolge
  const reihe = S.ui.signaleOben ? signaleOben(sp.aufgaben, aufgabe) : sp.aufgaben;
  // Sichtbare Karten in gezeichneter Reihenfolge — Grundlage der Tagesgruppen der Datums-Trenner (R00124)
  const sichtbar = reihe.map(nr => { const a = aufgabe(nr); return a && !!a.archiviert === archiv && passt(a, S.ui.filter, um) ? a : null; }).filter(Boolean);
  // `column-dates`: der wirksame Standard ist die Abschlussspalte an, sonst aus (R00124); im Archiv keine Trenner
  const trennerAn = sp.datums_trenner == null ? letzte : sp.datums_trenner;
  const trenner = trennerAn && !archiv ? datumsTrenner(sp.name, sichtbar.map(a => a.nummer), S.bew, um.heute) : new Map();
  const karten = reihe.map(nr => {
    const a = aufgabe(nr);
    if (!a) return archiv || gefiltert ? null : { nr, html: defektZuNummer(nr) ? vDefekt(nr, defektZuNummer(nr)) : vFehlt(nr) };
    if (!!a.archiviert !== archiv || !passt(a, S.ui.filter, um)) return null;
    return { nr, html: vKarte(a, letzte, sp.name) };
  }).filter(Boolean);
  // Tagesgruppen-Trenner (R00124) vor der ersten sichtbaren Karte ihrer Gruppe; der Trenner zählt nicht als Karte
  const inhalt = karten.map(k => (k.nr != null && trenner.get(k.nr) ? vDatumsTrenner(trenner.get(k.nr)) : '') + k.html).join('');
  const archivZahl = letzte && !archiv ? archivierteDesBoards().length : 0;
  const ueber = sp.grenze && karten.length > sp.grenze;
  const farbe = sp.farbe ? ` style="--sf:${esc(sp.farbe)}"` : '';
  if (spaltenZu().includes(sp.name)) return vLaneZu(sp, i, karten.length, ueber, farbe);
  const boardLeer = i === 0 && !archiv && !gefiltert && S.board.spalten.every(s => !s.aufgaben.length);
  const leerText = boardLeer ? '<div class="leer hilfe-leer" role="listitem">Noch keine Karten.<br>Taste <kbd>n</kbd> oder „+“ im Spaltenkopf öffnet „Neue Aufgabe“ — eine eingefügte Liste legt mehrere an, Kürzel wie <span class="mono">@kürzel</span> oder <span class="mono">due:morgen</span> setzen Felder.</div>' : '';
  return `<section class="bahn${sp.farbe ? ' gefaerbt' : ''}" data-col="${esc(sp.name)}"${farbe}>${vSpaltenUeberschrift(sp)}<div class="bahn-kopf${ueber ? ' ueber' : ''}" tabindex="0" data-kopf="${i}" data-halt="kopf:${esc(sp.name)}" title="Rechtsklick: Menü der Spalte"><button class="bk-name" aria-expanded="true" data-act="spalte-zu" data-arg="${esc(sp.name)}" data-halt="klapp:${esc(sp.name)}" aria-label="${esc(sp.name)} zuklappen" title="Klick klappt die Spalte zusammen"><span class="bk-text">${esc(sp.name)}</span><svg class="i bk-klapp" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6l-6 6 6 6M19 6l-6 6 6 6"></path></svg></button>${vEigentuemerZeichen(sp.eigentuemer, false, sp.name)}${sp.notiz ? ` <span class="info" tabindex="0" data-tip="info:${esc(sp.name)}" data-halt="info:${esc(sp.name)}" aria-label="${esc('Kommentar: ' + sp.notiz)}">ⓘ</span>` : ''}${letzte ? ` <span class="ok" tabindex="0" data-tip="ok:${esc(sp.name)}" data-halt="ok:${esc(sp.name)}" aria-label="Abschlussspalte">✓</span>` : ''}${sp.phase && sp.phase !== sp.name ? ` <span class="v ph" tabindex="0" data-tip="ph:${esc(sp.name)}" data-halt="ph:${esc(sp.name)}" aria-label="${esc('Phase: ' + sp.phase)}">${esc(sp.phase)}</span>` : ''}${sp.grenze ? ` <span class="v" tabindex="0" data-tip="grenze:${esc(sp.name)}" data-halt="grenze:${esc(sp.name)}" aria-label="${esc(grenzeTipp(sp.grenze, ueber))}">Grenze ${sp.grenze}${ueber ? ' · überschritten' : ''}</span>` : ''}${vKopfSignale(sichtbar, letzte)}<span class="n">${karten.length}</span>${archiv ? '' : `<button class="kopf-plus" data-act="add" data-arg="${esc(sp.name)}" title="Neue Aufgabe in „${esc(sp.name)}“ (n)" aria-label="Neue Aufgabe in ${esc(sp.name)}">+</button>`}</div><div class="flaeche" role="list" data-halt="spalte:${esc(sp.name)}">${inhalt || leerText || `<div class="leer" role="listitem">${gefiltert ? 'keine Treffer' : 'leer'}</div>`}${archivZahl ? `<div class="nach" role="listitem"><a href="#" data-act="archiv-an">Archiv (${archivZahl})</a></div>` : ''}</div></section>`;
}
const archivierteDesBoards = () => S.board ? S.board.spalten.flatMap(sp => sp.aufgaben).filter(n => { const a = aufgabe(n); return a && a.archiviert; }) : [];
function vBoard() {
  const b = S.board;
  if (S.boardDefekt) return `<div class="defektflaeche" role="alert"><h2>boards/${esc(S.boardDefekt.slug)}.md ist defekt</h2><p>${esc(S.boardDefekt.fehler)}</p><p><a href="vscode://file${esc(S.zustand.ordner)}/boards/${esc(S.boardDefekt.slug)}.md">Im Editor reparieren</a> · andere Boards über den Boardnamen oben links.</p></div>`;
  if (!b) return `<div class="leer leer-board"><div class="leer-titel">Kein Board · neues anlegen</div><p class="muted">Es gibt kein offenes Board. Ein neues entsteht als Datei <span class="mono">boards/&lt;slug&gt;.md</span>.</p><input class="inp" id="board-neu-leer" placeholder="Neues Board · Enter" data-enter="board-neu" aria-label="Name des neuen Boards"></div>`;
  const leiste = imArchiv() ? `<div class="archbar">Archiv · ${archivierteDesBoards().length} Karten · Dateien bleiben im Ordner, Zeiten zählen in Berichten weiter<button class="lnk" data-act="archiv-aus">Archiv verlassen</button></div>` : '';
  return `${S.einstellungenDefekt ? `<div class="archbar warnbar" role="alert">kanbanD.md ist defekt — Personen und Klassen fehlen, bis die Datei repariert ist</div>` : ''}${vBoardHinweise(b)}${leiste}<div class="bahnen">${b.spalten.map(vLane).join('')}</div>${vLegende()}`;
}
/** Was an den Phasen-Spalten (R00058) und den Prüfungen (R00059) nicht stimmt: Reihenfolge gegen die Phasenfolge, abweichende Folgen gebundener Anwendungen, unbekannte Prüfungen. */
function vBoardHinweise(b) {
  const h = (b.phasen && b.phasen.hinweise) || [];
  const p = b.hinweise || [];
  return (h.length ? `<div class="archbar phasenbar" role="status" id="phasen-hinweis"><b>Phasen</b>${h.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '') + (p.length ? `<div class="archbar phasenbar" role="status" id="pruefungen-hinweis"><b>Prüfungen</b>${p.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '');
}
const imArchiv = () => archivGefiltert(S.ui.filter);
const umfeld = () => ({ ich: S.ich, bereich: S.ui.bereich, personen: personen(), heute: isoD(Date.now()), abgeschlossen: abgeschlossene() });
/** Nummern in der Abschlussspalte des Boards — dort ist eine Fälligkeit kein Signal mehr (R00076). */
const abgeschlossene = () => new Set(S.board && S.board.spalten.length ? S.board.spalten[S.board.spalten.length - 1].aufgaben : []);
function vLegende() {
  const klassen = vorrat();
  if (!klassen.length || !S.board) return '';
  const nummern = S.board.spalten.flatMap(sp => sp.aufgaben);
  const sichtbar = nummern.map(aufgabe).filter(a => a && !!a.archiviert === imArchiv() && passt(a, S.ui.filter, umfeld()));
  const jetzt = (filterWoerter(S.ui.filter).find(([k]) => k === 'class') || [])[1];
  const knopf = (k, text, n, stil) => `<button class="${jetzt === k ? 'an' : ''}" data-act="legende" data-arg="${esc(k)}" title="filtern: class:${esc(k)}"${stil}><span class="sw${k === 'none' ? ' leer' : ''}"></span>${esc(text)}<span class="n">${n}</span></button>`;
  return `<div class="leg" aria-label="Legende"><span class="tt">LEGENDE</span>${klassen.map(k => knopf(k.schluessel, k.bezeichnung, sichtbar.filter(a => a.klasse === k.schluessel).length, ` style="${cv(k.farbe)}"`)).join('')}${knopf('none', 'ohne Klasse', sichtbar.filter(a => !a.klasse).length, '')}<span class="rechts">Klick filtert · <span class="mono">class:</span></span></div>`;
}
/** Der Dialog, in dem der Hinweis steht: der oberste offene modale Dialog mit Fuß (R00112, ADR-0017 Regel 5); null heißt unten über allem. */
function hinweisDialog() {
  const oberster = ebenen(S.ui).filter(ebene => ebene.modal).at(-1);
  if (!oberster || !dialogMitHinweis(oberster.art)) return null;
  return oberster.art;
}

/** Dialoge mit Hinweis-Anker, sobald ihr Inhalt gezeichnet ist; Zuweisen und Hilfe haben keinen. */
function dialogMitHinweis(art) {
  const u = S.ui;
  if (art === 'defekt') return !!u.defektDatei;
  if (art === 'neu') return true;
  if (art === 'fenster') return !!aufgabe(u.offen);
  return false;
}

/** Anker des Hinweises zwischen Körper und Fuß des Dialogs `art` — leer, wenn der Hinweis nicht dort steht. */
function vHinweisAnker(art) {
  return S.ui.hinweis && hinweisDialog() === art ? `<div class="hinweis-anker">${vHinweisInhalt()}</div>` : '';
}

function vHinweis() {
  return hinweisDialog() ? '' : vHinweisInhalt();
}

function vHinweisInhalt() {
  const t = S.ui.hinweis;
  if (t && t.warnungen) return `<div class="toast warn" role="alert" id="pruef-warnung"><span class="ausruf" aria-hidden="true">!</span><span>${esc(t.text)}</span>${t.warnungen.map(w => `<span>${esc(w.text)} ${warnungsKnoten(w).map(k => `<a class="lnk" href="${esc(k.ziel)}" data-act="wbs-zu" data-arg="${esc(k.ziel)}" title="${esc(k.titel)}">${esc(k.text)}</a>`).join(' ')}</span>`).join('')}</div>`;
  if (!t) return '';
  return `<div class="toast" role="status"><span class="txt">${esc(t.text)}</span>${vHinweisUndo(t)}${vHinweisAktion(t)}</div>`;
}

/** „rückgängig“ nur, wenn der Hinweis eine Gegenaktion gemerkt hat (ADR-0017). */
function vHinweisUndo(t) {
  if (!t.undo) return '';
  return `<button class="lnk" data-act="rueckgaengig" title="Strg+Z">rückgängig</button>`;
}
/** Die benannte Aktion eines Hinweises (R00114 FA 16): nie neben einem Rückgängig, nie per Tastenkürzel. */
function vHinweisAktion(t) {
  if (!t.aktion || t.undo) return '';
  return `<button class="lnk" data-act="${esc(t.aktion.act)}" data-arg="${esc(t.aktion.arg)}">${esc(t.aktion.text)}</button>`;
}

/* ── Aufgabenliste (Artboard D0004) ── */
const liegtAuf = a => (S.boards || []).flatMap(b => b.spalten.filter(sp => sp.aufgaben.includes(a.nummer)).map(sp => ({ b, sp })));
function listenBereich(a, bereich) {
  if (bereich === 'archiv') return !!a.archiviert;
  if (bereich === 'ohne') return !a.archiviert && !liegtAuf(a).length;
  return true;
}
function vListenbereich() {
  const u = S.ui, zahl = b => S.aufgaben.filter(a => listenBereich(a, b)).length;
  return `<span class="seg" role="radiogroup" aria-label="Aufgabenbereich">${[['alle', 'alle'], ['ohne', 'ohne Board'], ['archiv', 'archiviert']].map(([k, t]) => `<span class="${u.listBereich === k ? 'an' : ''}" data-act="list-bereich" data-arg="${k}" role="radio" aria-checked="${u.listBereich === k}">${t} <span class="mono">${zahl(k)}</span></span>`).join('')}</span>`;
}
function vAufgaben() {
  const u = S.ui, me = ichPerson();
  // einmal je Zeichnen, nicht je Zeile: das erste Board jeder Aufgabe (ADR-0031 Regel 3)
  const erstesBoard = erstesBoardJeAufgabe(S.boards || []);
  const zeilen = S.aufgaben.filter(a => listenBereich(a, u.listBereich) && passt(a, u.filter, { ich: S.ich, bereich: 'alle', personen: personen() })).map(a => {
    const cl = a.klasse && klassenvorrat(erstesBoard.get(a.nummer) || null, S.zustand.einstellungen).find(k => k.schluessel === a.klasse), orte = liegtAuf(a);
    return `<tr class="${a.archiviert ? 'ruhe' : ''}" data-zeile="${a.nummer}" tabindex="0"${a.archiviert ? '' : ' draggable="true" title="Ziehen auf eine Spalte rechts oder ins Archiv"'}><td class="mono">#${a.nummer}</td><td class="tt"><a href="#" data-act="oeffnen" data-arg="${a.nummer}">${esc(a.titel)}</a>${a.archiviert ? ` <span class="lbl">archiviert ${esc(datumLang(a.archiviert))}</span>` : ''}</td><td>${cl ? `<span class="cls" style="${cv(cl.farbe)}">${esc(cl.bezeichnung)}</span>` : a.klasse ? esc(a.klasse) : ''}</td><td><span class="avs">${a.zustaendige.map(pk).join('')}</span></td><td class="orte">${orte.length ? orte.map(({ b, sp }) => `<span class="lbl ort">${esc(b.titel)} · ${esc(sp.name)}<button class="lnk lnk-x" data-act="abnehmen" data-arg="${esc(b.slug)}|${a.nummer}" title="von ${esc(b.titel)} nehmen" aria-label="#${a.nummer} von ${esc(b.titel)} nehmen">✕</button></span>`).join(' ') : '<span class="muted">auf keinem Board</span>'}</td><td>${a.archiviert ? `<button class="btn" data-act="zurueckholen" data-arg="${a.nummer}">Zurückholen</button>` : `<button class="btn" id="leg-${a.nummer}" data-act="legen-pop" data-arg="${a.nummer}" aria-haspopup="menu">auf Board legen ▾</button>`}</td></tr>`;
  }).join('');
  return `<div class="leiste"><b>Aufgaben</b><span class="muted">alle Dateien unter aufgaben/ · eine Aufgabe kann auf mehreren Boards liegen</span><div class="rechts"><button class="btn btn-haupt" data-act="add" data-arg="-" title="Neue Aufgabe ohne Board (n)">+ Neue Aufgabe</button></div></div>
<div class="body liste-mit-zielen"><table class="pt dicht liste"><thead><tr><th>#</th><th>Titel</th><th>Klasse</th><th>Zuständig</th><th>Liegt auf</th><th></th></tr></thead><tbody>${zeilen || '<tr><td colspan="6" class="muted">keine Aufgaben in diesem Bereich</td></tr>'}</tbody></table>${vZiele()}</div>`;
}
/** Ablageziele beim Ziehen aus der Liste: jede Spalte jedes Boards, dazu das Archiv. */
function vZiele() {
  const boards = (S.boards || []).filter(b => !b.archiviert).map(b => `<div class="ziel-board"><b>${esc(b.titel)}</b>${b.spalten.map(sp => `<div class="ziel" data-ziel="${esc(b.slug)}|${esc(sp.name)}" aria-label="Ziel ${esc(b.titel)} · ${esc(sp.name)}">${esc(sp.name)}<span class="mono">${sp.aufgaben.length}</span></div>`).join('')}</div>`).join('');
  return `<aside class="ziele" aria-label="Ziehen auf"><h2 class="ziele-kopf">ZIEHEN AUF</h2>${boards}<div class="ziel ziel-archiv" data-ziel="archiv" aria-label="Ziel Archiv">Archiv</div></aside>`;
}
function vLegenPop() {
  const nr = S.ui.legenNr, a = aufgabe(nr);
  if (!a) return '';
  const frei = (S.boards || []).filter(b => !b.archiviert && !b.spalten.some(sp => sp.aufgaben.includes(nr)));
  return `<div class="pop" id="pop" data-for="leg-${nr}" data-al="r" style="width:300px" role="menu" aria-label="#${nr} auf Board legen"><div class="pop-kopf">#${nr} AUF BOARD LEGEN</div>${frei.length ? frei.map(b => b.spalten.map(sp => `<div class="iz" data-act="legen" data-arg="${esc(b.slug)}|${nr}|${esc(sp.name)}" role="menuitem" tabindex="-1">${esc(b.titel)} · ${esc(sp.name)}</div>`).join('')).join('') : '<div class="fuss">liegt schon auf allen Boards</div>'}</div>`;
}

/* ── Personen (Artboard D0005) ── */
function vPersonen() {
  const u = S.ui, jetzt = Date.now(), tag = u.personenTag || jetzt, t0 = tagesbeginn(tag), t1 = tagesende(tag), istHeute = t0 === tagesbeginn(jetzt);
  const kurzdatum = datumMitWochentag(t0).slice(0, -4);
  const pos = t => lageImTag(t, t0, t1);
  const alle = personen();
  const gezeigt = alle.filter(p => (u.stillAuch || p.aktiv) && (u.pBereich === 'alle' || (u.pBereich === 'm' ? p.art === 'human' : p.art === 'agent')));
  const zeilen = personenZeilen(S.aufgaben, gezeigt, S.board, tag, jetzt);
  const G = istHeute ? ['LÄUFT JETZT', 'HEUTE AKTIV', 'HEUTE RUHIG'] : [null, `AKTIV AM ${kurzdatum}`, `RUHIG AM ${kurzdatum}`];
  let html = '';
  for (let g = 0; g < 3; g++) {
    const ds = zeilen.filter(d => d.gruppe === g);
    if (!ds.length) continue;
    html += `<tr class="grp"><td colspan="6">${G[g]} <span>· ${g === 0 ? ds.reduce((s, d) => s + d.laeuft.length, 0) + ' Timer' : ds.length + (ds.length === 1 ? ' Person' : ' Personen')}</span></td></tr>`;
    html += ds.map(d => {
      const k = d.person.kuerzel;
      const leiste = d.abschnitte.map(x => { const a = pos(x.von), b = pos(x.bis); return b > a ? `<i class="${x.laeuft ? 'l' : d.person.art === 'agent' ? 'a' : ''}" style="left:${a}%;width:${Math.max(0.5, b - a)}%" title="#${x.nummer}"></i>` : ''; }).join('');
      const gerade = istHeute && d.laeuft.length ? `<div class="akt">${d.laeuft.map(x => `<div class="z">${vLaufChip({ beginn: laufBeginn(x.a, x.z), eigen: k === S.ich, sekunden: false })}<a href="#" class="id" data-act="oeffnen" data-arg="${x.a.nummer}">#${x.a.nummer}</a><span class="t">${esc(x.a.titel)}</span><button class="btn stop${k === S.ich ? ' btn-haupt' : ''}" data-act="stop" data-arg="${x.a.nummer}|${esc(k)}" aria-label="Timer von ${esc(d.person.name)} stoppen">■</button></div>`).join('')}</div>`
        : `<span class="muted">${d.zuletzt ? 'zuletzt ' + (d.zuletzt >= t0 ? new Date(d.zuletzt).toTimeString().slice(0, 5) : datumAusMs(d.zuletzt)) : '—'}</span>`;
      return `<tr class="${d.gruppe === 2 ? 'ruhe' : ''}" data-person="${esc(k)}"><td><a href="#" class="wer" data-act="person-filter" data-arg="${esc(k)}" title="Board auf @${esc(k)} filtern">${pk(k)}<span><b>${esc(d.person.name)}</b><small>${d.person.aktiv ? (k === S.ich ? 'ich' : d.person.art === 'agent' ? 'Agent' : '&nbsp;') : 'stillgelegt'}</small></span></a></td><td>${gerade}</td><td><div class="tagl">${leiste}${istHeute ? `<span class="jetzt" style="left:${pos(jetzt)}%"></span>` : ''}</div></td><td class="r num heute">${hm(d.tag)}</td><td class="r num muted">${hm(d.woche)}</td><td class="r"><span class="num">${d.offen}</span> <span class="muted" style="font-size:11px">· ${d.begonnen} begonnen</span></td></tr>`;
    }).join('');
  }
  const still = alle.filter(p => !p.aktiv).length;
  const wochenspanne = `Woche ${datumAusMs(wochenbeginn(tag)).slice(0, 6)}–${datumAusMs(wochenende(tag) - 1).slice(0, 6)}`;
  let bereiche = PERSONEN_BEREICHE;
  if (S.ui.stufe === 'compact') bereiche = PERSONEN_BEREICHE_KURZ;
  return `<div class="leiste">${vTagWahl(t0, istHeute)}<span class="seg seg-personen" role="radiogroup" aria-label="Personen">${bereiche.map(([k, t]) => `<span class="${u.pBereich === k ? 'an' : ''}" data-act="p-bereich" data-arg="${k}" role="radio" aria-checked="${u.pBereich === k}">${t}</span>`).join('')}</span>${still ? `<label class="chk-s" data-act="still-auch"><i class="${u.stillAuch ? 'an' : ''}">${u.stillAuch ? '✓' : ''}</i>Stillgelegte einblenden (${still})</label>` : ''}<div class="rechts muted">Tagesleiste 0–24 Uhr · schraffiert = läuft</div></div>
<div class="body">${berichtRahmen('Personen')}<table class="pt"><thead><tr><th style="width:190px">Person</th><th>Gerade</th><th><div class="skala">${stundenmarken(tag).map(m => `<span style="left:${pos(m.zeitpunkt)}%">${m.stunde}</span>`).join('')}</div></th><th class="r">${istHeute ? 'heute' : kurzdatum}</th>${istHeute ? '<th class="r">Woche</th>' : `<th class="r" title="${wochenspanne}" aria-label="${wochenspanne}">Woche</th>`}<th class="r">zugewiesen offen</th></tr></thead><tbody>${html}</tbody></table></div></div>`;
}

/** Die Segmente des Umschalters „Personen“ (R00021); in compact stehen die kurzen Namen, damit jedes Segment bei 320 px in eine Zeile passt (R00200). */
const PERSONEN_BEREICHE = [['alle', 'Menschen + Agenten'], ['m', 'nur Menschen'], ['a', 'nur Agenten']];
const PERSONEN_BEREICHE_KURZ = [['alle', 'alle'], ['m', 'Menschen'], ['a', 'Agenten']];

/** id des Datumsknotens der Personenseite; render behält ihn über jedes Neuzeichnen (datumsknotenBehalten). */
const PERSONEN_TAG = 'personen-tag';
/** „‹ Datum › Heute“ der Personenseite (R00199 Regel 2): blättert bis heute; das Datum steht in einem beständigen Knoten mit
    aria-live (render behält ihn, datumsknotenBehalten), damit ein Bildschirmleser den neuen Tag ansagt. */
function vTagWahl(t0, istHeute) {
  const anHeute = istHeute ? ' disabled' : '';
  return `<span class="tag-wahl" role="group" aria-label="Tag"><button class="btn btn-sym" id="tag-zurueck" data-act="p-tag" data-arg="-1" aria-label="voriger Tag">‹</button><span class="tag-datum" id="${PERSONEN_TAG}" aria-live="polite">${datumMitWochentag(t0)}</span><button class="btn btn-sym" data-act="p-tag" data-arg="1" aria-label="nächster Tag"${anHeute}>›</button><button class="btn" data-act="p-tag" data-arg="0"${anHeute}>Heute</button></span>`;
}

/* ── Berichte (Artboard D0006) — lesen nur, korrigiert wird an der Aufgabe ── */
const SVG = { zettel: '<path d="M4 4h16v16H4zM4 9h16M9 4v16"></path>', tabelle: '<path d="M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16"></path>', kreuz: '<path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16"></path>', csv: '<path d="M12 4v11M8 11l4 4 4-4M4 19h16"></path>', etikett: '<path d="M4 4h8l9 9-8 8-9-9z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle>' };
function berichteAusloeser() {
  if (S.ui.stufe === 'compact') return 't-seite';
  return 't-ber';
}
function vBerichtePop() {
  /** Ein Eintrag; der offene Bericht trägt Klasse und aria-current aus demselben Wahrheitswert (R00184, ADR-0018 Regel 5 und Nachtrag N3). */
  const e = (href, svg, t, s, istOffen) => {
    const seite = aktuelleSeite(istOffen);
    return `<a class="${cssKlassen('e', seite.klasse)}"${seite.attribut} href="${href}" role="menuitem" tabindex="-1"${href.startsWith('/api') ? ' download' : ''}><svg class="i" viewBox="0 0 24 24">${svg}</svg><b>${t}</b><small>${s}</small></a>`;
  };
  const v = S.ui.view;
  return `<div class="pop menue" id="pop" data-for="${berichteAusloeser()}" data-al="l" style="width:330px" role="menu" aria-label="Berichte"><div class="k">ZEITEN</div>${e('#/berichte/stundenzettel', SVG.zettel, BERICHTSNAMEN.stundenzettel, 'Eine Person, eine Woche: Aufgaben × Tage mit Summen.', v === 'berichte/stundenzettel')}${e('#/berichte/kreuz', SVG.kreuz, BERICHTSNAMEN.kreuz, 'Kreuztabelle über den Zeitraum, Summen in beide Richtungen.', v === 'berichte/kreuz')}<div class="k">VERLAUF</div>${e('#/berichte/verlauf', '<path d="M4 6l6 6 4-3 6 9M4 20h16"></path>', BERICHTSNAMEN.verlauf, 'Offene Aufgaben je Tag im gewählten Zeitraum – aus der Git-Geschichte dieses Boards.', v === 'berichte/verlauf')}${e('#/berichte/fluss', '<path d="M4 20h6l4-1 6-2v3l-6 2-4 1H4z"></path><path d="M4 15h6l4-1 6-2v3l-6 2-4 1H4z"></path><path d="M4 10h6l4-1 6-2v3l-6 2-4 1H4z"></path>', BERICHTSNAMEN.fluss, 'Bestand je Spalte über die Zeit – gestapelte Bänder aus der Git-Geschichte dieses Boards.', v === 'berichte/fluss')}${e('#/berichte/durchsatz', '<path d="M4 20h16"></path><path d="M7 20V12M12 20V6M17 20V15"></path>', BERICHTSNAMEN.durchsatz, 'Erledigte Aufgaben je Zeitraum – Balken aus der Git-Geschichte dieses Boards.', v === 'berichte/durchsatz')}${e('#/berichte/prognose', '<path d="M4 20h16M4 6l5 5 4-2 4 6M17 15l3-6"></path>', BERICHTSNAMEN.prognose, 'Monte-Carlo-Prognose je Spalte aus dem Durchsatz dieses Boards – rechnet live mit.', v === 'berichte/prognose')}${e('#/berichte/fieber', '<path d="M4 20h16M4 20V4"></path><path d="M6 17l4-3 3 1 5-7"></path><circle cx="18" cy="8" r="1.6"></circle>', BERICHTSNAMEN.fieber, 'Fortschritt gegen Pufferverbrauch bis zum Zieltermin – CCPM-Fieberdiagramm dieses Boards.', v === 'berichte/fieber')}${e('#/berichte/durchlauf', '<path d="M4 20h16M4 20V4M8 15h.01M11 11h.01M14 13h.01M17 7h.01"></path>', BERICHTSNAMEN.durchlauf, 'Wie lange Aufgaben von einer Spalte bis zu einer anderen brauchen – Lead und Cycle Time.', v === 'berichte/durchlauf')}<div class="k">BESTAND</div>${e('#/berichte/bestand', SVG.tabelle, BERICHTSNAMEN.bestand, 'Offene Aufgaben je Label-Paar, gefärbt nach der dringendsten Klasse – Klick öffnet das Board.', v === 'berichte/bestand')}${e('#/berichte/kosten', SVG.etikett, BERICHTSNAMEN.kosten, 'Angefallene API-Kosten je Währung – alle Spalten, auch archivierte Aufgaben.', v === 'berichte/kosten')}<div class="k">AUSLEITEN</div>${e('/api/berichte/zeiten.csv', SVG.csv, 'Export als CSV', 'Eine Zeile je Zeiteintrag: Aufgabe, Person, Art, Beginn, Ende, Dauer, Herkunft.')}</div>`;
}
/** Gemeinsame Filterleiste aller Berichte (R00043); `leiste`: Schlüssel in BERICHTSLEISTEN (web/berichte.js), dort stehen die Gruppen je Bericht. */
function vBerichtsfilter(leiste) {
  const teile = BERICHTSLEISTEN[leiste];
  const f = S.ui.bf, jetzt = Date.now();
  const chip = (act, arg, an, inhalt, titel) => `<button class="bf-chip${an ? ' an' : ''}" data-act="${act}" data-arg="${esc(arg)}" aria-pressed="${an}" title="${esc(titel)}">${inhalt}</button>`;
  const gruppe = (k, inhalt) => inhalt ? `<div class="bf-gruppe"><span class="bf-k">${k}</span><span class="bf-werte">${inhalt}</span></div>` : '';
  // Rechnen ab (R00081): der Projektstart, für die Berichte aus den Bewegungen des Boards
  const start = S.board && S.board.start, erster = S.bew && ersterTag(S.bew);
  const ab = teile.start ? gruppe('Rechnen ab', `<input type="date" class="mini-inp" data-fb="start" value="${esc(start || '')}" aria-label="Rechnen ab"><span class="muted">${start ? 'davor zählt nichts; ein gewählter Zeitraum überstimmt das' : `leer = ab der ersten Aufgabe${erster ? ` (${datumAusMs(isoTag(erster))})` : ''}`}</span>`) : '';
  // Messbasis der Prognose (R00083): die letzten N Tage, gleitend — statt eines Kalenderzeitraums
  const mb = teile.messbasis ? gruppe('Messbasis', `<span class="muted">letzte</span><input type="number" class="mini-inp bf-tage" min="1" max="3650" data-bf="messbasisTage" value="${f.messbasisTage}" aria-label="Messbasis in Tagen"><span class="muted">Tage, gleitend — beginnt nie vor „Rechnen ab“ und nie vor der ersten Aufgabe</span>`) : '';
  let zr = '';
  if (teile.zeitraum || teile.zeitraumBleibt) {
    zr = gruppe(teile.zeitraumTitel || 'Zeitraum', vZeitraumFelder(f, jetzt));
  }
  const klassen = vorrat();
  const farben = klassen.map(k => chip('bf-farbe', k.schluessel, !f.ohneFarben.includes(k.schluessel), `<i class="bf-farbe" style="${cv(k.farbe)}"></i>${esc(k.bezeichnung)}`, f.ohneFarben.includes(k.schluessel) ? 'ausgeschlossen — Klick nimmt wieder auf' : 'Klick schließt aus')).join('')
    + chip('bf-farbe', '', !f.ohneFarben.includes(''), '<i class="bf-farbe"></i>ohne Klasse', 'Aufgaben ohne Klasse');
  const spalten = teile.spalten && S.board ? S.board.spalten.map(sp => chip('bf-spalte', sp.name, !f.ohneSpalten.includes(sp.name), esc(sp.name), f.ohneSpalten.includes(sp.name) ? 'ausgeschlossen — Klick nimmt wieder auf' : 'Klick schließt aus')).join('') : '';
  const personenListe = personen().filter(p => p.aktiv || f.personen.includes(p.kuerzel));
  const leute = teile.personen ? personenListe.map(p => chip('bf-person', p.kuerzel, f.personen.includes(p.kuerzel), `${pk(p.kuerzel)}${esc(p.name)}`, teile.personen === 'zeit' ? 'nur Zeiten dieser Person' : 'nur Aufgaben, für die die Person zuständig ist')).join('') : '';
  const alleLabels = [...new Set(S.aufgaben.flatMap(a => a.labels))].sort();
  const labels = alleLabels.map(l => chip('bf-label', l, f.labels.includes(l), esc(l), 'nur Aufgaben mit diesem Label')).join('');
  const n = leistenAnzahl(f, teile);
  // Zusammenfassung der zugeklappten Box: wie viele wirken, ab wann gerechnet wird, ob gespeichert
  const lokal = S.ui.bfLokal && S.ui.bfLokal.ungespeichert;
  const zusammen = [`Filter · ${n ? `${n} aktiv` : 'keine'}`, teile.messbasis ? `Messbasis ${f.messbasisTage} T` : '', teile.start ? (start ? `Rechnen ab ${datumAusMs(isoTag(start))}` : 'Rechnen ab der ersten Aufgabe') : '', teile.zeitraumGiltNicht ? 'Zeitraum gilt hier nicht' : '', lokal ? 'nicht gespeichert — zum Speichern „Ich bin …“ wählen' : ''].filter(Boolean).join(' · ');
  return `<details class="bfilter-box"${S.ui.bfOffen ? ' open' : ''}><summary class="bf-zusammen${lokal ? ' lokal' : ''}">${esc(zusammen)}</summary><div class="bfilter" role="group" aria-label="Berichtsfilter">${ab}${mb}${zr}${gruppe('Farben', farben)}${gruppe('Spalten', spalten)}${gruppe(teile.personen === 'zeit' ? 'Zeit von' : 'Zuständig', leute)}${gruppe('Labels', labels)}<div class="bf-fuss"><span class="muted">gespeichert in boards/${esc(S.ui.slug || '')}.md, gilt für alle Berichte dieses Boards und alle, die es ansehen</span>${n ? `<button class="btn bf-leeren" data-act="bf-leeren" data-arg="${leiste}" title="${esc(zuruecksetzenHinweis(teile))}">Zurücksetzen <span class="mono">${n}</span></button>` : ''}</div></div></details>`;
}
/** Die drei Felder des Zeitraums (Berichtsfilter, R00043): Auswahl und „von – bis“; bei einem benannten Zeitraum zeigen
    die Datumsfelder seine Grenzen. */
function vZeitraumFelder(f, jetzt) {
  const g = zeitraumGrenzen(f, jetzt);
  const von = f.zeitraum === 'eigen' ? f.von : g.von ? isoD(g.von) : '';
  const bis = f.zeitraum === 'eigen' ? f.bis : g.bis !== Infinity ? isoD(letzterTag(g.bis)) : '';
  return `<select class="mini-inp" data-bf="zeitraum" aria-label="Zeitraum">${ZEITRAEUME.map(([k, t]) => `<option value="${k}"${k === f.zeitraum ? ' selected' : ''}>${t}</option>`).join('')}</select><input type="date" class="mini-inp" data-bf="von" value="${esc(von)}" aria-label="Zeitraum von"><span class="muted">–</span><input type="date" class="mini-inp" data-bf="bis" value="${esc(bis)}" aria-label="Zeitraum bis">`;
}
const PERSONENWAHL = 'stundenzettel-person';
/** Die Personenwahl des Stundenzettels (R00201): eine Auswahlliste, so breit wie ihr längster Eintrag und nie breiter als die
    Leiste. Ist die angezeigte Person keine aktive, steht „— Person wählen —“ als gesperrter erster Eintrag da. */
function vPersonenwahl(wer) {
  const aktive = personen().filter(p => p.aktiv);
  const angezeigteIstAktiv = aktive.some(p => p.kuerzel === wer);
  let leereintrag = '';
  if (!angezeigteIstAktiv) leereintrag = '<option value="" selected disabled>— Person wählen —</option>';
  const eintraege = aktive.map(p => `<option value="${esc(p.kuerzel)}"${p.kuerzel === wer ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  return `<select class="mini-inp personenwahl" id="${PERSONENWAHL}" aria-label="Person">${leereintrag}${eintraege}</select>`;
}
const csvKnopf = '<a class="btn" href="/api/berichte/zeiten.csv" download>CSV</a>';
function vStundenzettel() {
  const u = S.ui, jetzt = Date.now();
  const w0 = (() => { const d = new Date(wochenbeginn(jetzt)); d.setDate(d.getDate() + 7 * (u.wochenVersatz || 0)); return d.getTime(); })();
  const wer = u.sp || S.ich || (personen().find(p => p.aktiv) || {}).kuerzel;
  const s = stundenzettel(S.aufgaben.filter(a => aufgabePasst({ ...u.bf, personen: [] }, a)), wer, w0, jetzt), namen = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], heute = tagesbeginn(jetzt);
  const zelle = ms => ms ? hm(ms) : '<span class="muted">·</span>';
  return `<div class="leiste"><b>Stundenzettel</b>${vPersonenwahl(wer)}<button class="btn btn-sym" data-act="woche" data-arg="-1" aria-label="vorige Woche">‹</button><span class="mono muted" id="woche">${datumAusMs(s.tage[0])} – ${datumAusMs(s.tage[6])}</span><button class="btn btn-sym" data-act="woche" data-arg="1" aria-label="nächste Woche">›</button><span class="muted" style="font-size:12px">liest nur · Klick auf eine Zeile öffnet die Aufgabe zum Korrigieren</span><div class="rechts">${csvKnopf}</div></div>${vBerichtsfilter('stundenzettel')}
<div class="body">${berichtRahmen('Stundenzettel')}<table class="pt dicht" id="stundenzettel"><thead><tr><th>Aufgabe</th>${s.tage.map((t, i) => `<th class="r"${t === heute ? ' style="color:var(--kd-accent-ink)"' : ''}>${namen[i]} <span class="mono">${datumKurz(isoD(t), isoD(Date.now()))}</span></th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${s.zeilen.map(z => `<tr class="klick" data-act="oeffnen" data-arg="${z.aufgabe.nummer}" data-halt="zeile:${z.aufgabe.nummer}" tabindex="0"><td class="tt"><span class="mono muted">#${z.aufgabe.nummer}</span> ${esc(z.aufgabe.titel)}</td>${z.proTag.map(ms => `<td class="r num">${zelle(ms)}</td>`).join('')}<td class="r num"><b>${hm(z.summe)}</b></td></tr>`).join('') || `<tr><td class="muted" colspan="9">${esc(per(wer || '').name)} hat in dieser Woche keine Zeiten.</td></tr>`}<tr class="grp"><td>SUMME</td>${s.jeTag.map(ms => `<td class="r">${hm(ms)}</td>`).join('')}<td class="r" id="zettelsumme">${hm(s.summe)}</td></tr></tbody></table></div></div>`;
}
/** Öffnender Rahmen um eine Berichtstabelle (PO Z. 137): nur er scrollt bei schmaler Breite quer, per Tastatur erreichbar wie .ko-scroll. */
function berichtRahmen(beschriftung) {
  return `<div class="bericht-rahmen" tabindex="0" role="group" aria-label="${esc(beschriftung)}">`;
}
function vKreuz() {
  const jetzt = Date.now(), g = zeitraumGrenzen(S.ui.bf, jetzt);
  const k = kreuztabelle(zeitenGefiltert(S.aufgaben, S.ui.bf), g.von, jetzt, g.bis);
  const zelle = ms => ms ? hm(ms) : '<span class="muted">—</span>';
  return `<div class="leiste"><b>Zeiten nach Aufgabe und Person</b><span class="muted" style="font-size:12px">liest nur · korrigiert wird an der Aufgabe</span><div class="rechts">${csvKnopf}</div></div>${vBerichtsfilter('zeiten')}
<div class="body">${berichtRahmen('Zeiten nach Aufgabe und Person')}<table class="pt dicht" id="kreuz"><thead><tr><th>Aufgabe</th>${k.personen.map(p => `<th class="r">${pk(p)} ${esc(per(p).name)}</th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${k.zeilen.map(z => `<tr class="klick" data-act="oeffnen" data-arg="${z.aufgabe.nummer}" data-halt="zeile:${z.aufgabe.nummer}" tabindex="0"><td class="tt"><span class="mono muted">#${z.aufgabe.nummer}</span> ${esc(z.aufgabe.titel)}</td>${z.jePerson.map(ms => `<td class="r num">${zelle(ms)}</td>`).join('')}<td class="r num"><b>${hm(z.summe)}</b></td></tr>`).join('') || '<tr><td class="muted">Keine Zeiten im Zeitraum.</td></tr>'}<tr class="grp"><td>SUMME</td>${k.jeSpalte.map(ms => `<td class="r">${hm(ms)}</td>`).join('')}<td class="r">${hm(k.summe)}</td></tr></tbody></table></div></div>`;
}

/* Diagramme (R00073): x-Achse zweizeilig mit Jahr; Fläche mit Vollbild-Knopf und Tooltip. Das Fadenkreuz folgt dem Zeiger über
   die ganze Zeichenfläche — `data-achse` (l, breite, t0, t1, stetig) übersetzt die Position in einen Tag, `S.diagrammTip(tag)`
   liefert den Inhalt des Tooltips. */
const achsDatum = (ms, x, y) => { const [tagMonat, jahr] = achsenMarke(ms); return `<text class="achse achse-x" x="${x}" y="${y}" text-anchor="middle"><tspan x="${x}">${tagMonat}</tspan><tspan x="${x}" dy="12">${jahr}</tspan></text>`; };
const achsAttribut = (l, breite, t0, t1, stetig) => `data-achse="${[l, breite, t0, t1, stetig ? 1 : 0].join(',')}"`;
const fadenkreuz = (o, u) => `<line class="fadenkreuz" id="fadenkreuz" y1="${o}" y2="${u}" x1="-10" x2="-10"></line>`;
function vDiagrammFlaeche(svg, extra = '') {
  const an = !!S.ui.vollbild;
  return `<div class="dflaeche${extra}${an ? ' vollbild' : ''}"><button class="btn vollbild-knopf" data-act="vollbild" aria-pressed="${an}" aria-label="${an ? 'Vollbild beenden' : 'Diagramm im Vollbild'}" title="${an ? 'Vollbild beenden (Esc)' : 'Diagramm im Vollbild'}">${an ? '✕ Vollbild beenden' : '⛶ Vollbild'}</button>${svg}<div class="tooltip" id="tooltip" hidden></div></div>`;
}

/* Burndown: eine Serie (offen) in der Akzentfarbe, Umfang als neutrale Bezugslinie. */
/** Die drei Ereignisgrößen je Tag (R00164) mit Vorzeichen und Farbfeld — Tooltip, Tabellenansicht, Kennzahlzeile und Legende nennen sie gleich. */
const BURNDOWN_EREIGNISSE = [['hinzugekommen', '+', 'k-plus'], ['erledigt', '−', 'k-erledigt'], ['entfernt', '−', 'k-entfernt']];
/** Farbfeld einer Größe: dasselbe Zeichen wie ihr Balken; stumm, weil Vorzeichen und Wort daneben stehen. */
const burndownFeld = klasse => `<i class="${klasse}" aria-hidden="true"></i>`;
/** Die Teilmenge von „+“ (R00192): Rückläufer aus der Zielspalte — kein Posten, deshalb nicht in `BURNDOWN_EREIGNISSE`, ohne
    Farbfeld und Balken; sie steht in Tooltip, Kennzahlzeile und Tabellenansicht gleich hinter „+ hinzugekommen“. */
const BURNDOWN_DAVON = 'davon zurückgekommen';
/** Hinter einem Posten die Teilmenge, nur hinter „+“: `zeile(wert)` baut sie für den Ort. */
const mitTeilmenge = (groesse, zeile, wert) => groesse === 'hinzugekommen' ? zeile(wert) : '';
/** Die Teilmengen von „+“ in der Reihenfolge ihrer Zeilen und Spalten: „davon selbsterzeugt“ (R00194) nur mit gewählten
    Labels, dann „davon zurückgekommen“ (R00192); je Eintrag Wort und Feld des Tages. */
const BURNDOWN_SELBST = 'davon selbsterzeugt';
const burndownTeilmengen = selbstGewaehlt => [...(selbstGewaehlt ? [[BURNDOWN_SELBST, 'selbsterzeugt']] : []), [BURNDOWN_DAVON, 'zurueckgekommen']];
/** Die Labels unter „Selbsterzeugt =“ des gewählten Boards (R00194, ADR-0027 N6); ohne Wahl leer. */
function selbstLabels() {
  if (S.board && S.board.fieber && S.board.fieber.selbstlabels) return S.board.fieber.selbstlabels;
  return [];
}
/** Alle Labels der Aufgaben, sortiert — dieselbe Quelle wie die Label-Gruppe des Berichtsfilters. */
const alleAufgabenLabels = () => [...new Set(S.aufgaben.flatMap(a => a.labels))].sort();
/** Wort einer Größe in Kennzahl, Tooltip und Legende: „erledigt“ nennt einen gewählten Zielblock (R00166 AK 10, `zielWorte`). */
function burndownWort(groesse, zielWorte) {
  if (groesse !== 'erledigt' || !zielWorte) return groesse;
  return `erledigt (${esc(zielWorte.kurz)})`;
}
/** Legende unter dem Diagramm (R00164 AK 9): die drei Größen, ab wo „+“ zählt, und warum „erledigt“ über dem Durchsatz liegen
    kann — samt der Teilmenge „davon zurückgekommen“ (R00192 AK 4); mit gewähltem Zielblock dazu, was „erledigt“ hier heißt. */
function vBurndownLegende(zielWorte, selbst = []) {
  let wasErledigtHeisst = '';
  if (zielWorte) wasErledigtHeisst = `<br>Erledigt heißt hier: ${esc(zielWorte.lang)}. Ein Zug zurück nach links zählt als „+ hinzugekommen“.`;
  return `<div class="dlegende bd-legende" id="bd-legende">${BURNDOWN_EREIGNISSE.map(([groesse, zeichen, feld]) => `<span>${burndownFeld(feld)}${zeichen} ${burndownWort(groesse, zielWorte)}</span>`).join('')}</div>
<p class="bd-hinweis">„+“ zählt ab dem Eintritt in eine gezählte Spalte; ausgeschlossene Spalten zählen nicht.<br>„− erledigt“ kann über dem Durchsatz liegen: Nacharbeit wird erneut erledigt und zählt jedes Mal.<br>„${BURNDOWN_DAVON}“ zählt Nacharbeit aus der Zielspalte: Aufgaben, die von dort zurück nach links gezogen wurden — deshalb kann „− erledigt“ über dem Durchsatz liegen.${wasErledigtHeisst}</p>${vSelbstLegende(selbst)}`;
}
/** Legendensatz zu „davon selbsterzeugt“ (R00194 AK 4, AK 5): die gewählten Labels, der heutige Stand und je Label, das
    keine Aufgabe trägt, ein Hinweis; ohne Wahl nichts. */
function vSelbstLegende(selbst) {
  if (!selbst.length) return '';
  const namen = selbst.map(l => `„${esc(l)}“`).join(', ');
  const vorhanden = alleAufgabenLabels(), fehlen = selbst.filter(l => !vorhanden.includes(l));
  const fehlt = fehlen.length ? ` <span class="fehl" id="bd-selbst-fehlt">${fehlen.map(l => `Label „${esc(l)}“ kommt nicht vor.`).join(' ')}</span>` : '';
  return `<p class="bd-hinweis" id="bd-selbst-satz">„${BURNDOWN_SELBST}“ zählt „+“ von Aufgaben mit dem Label ${namen} — zählt nach dem heutigen Stand der Labels; Rückläufer zählen nur als zurückgekommen, der Rest ist neu.${fehlt}</p>`;
}
/** Kennzahlzeile des Burndowns: die Summen der Ereignisse über die gezeigten Tage. */
function vBurndownKennzahl(tage, zielWorte, selbstGewaehlt = false) {
  const summe = groesse => tage.reduce((n, x) => n + x[groesse], 0);
  let davon = n => `<small class="bd-davon" id="bd-davon">${BURNDOWN_DAVON} <b>${n}</b></small>`;
  // mit gewählten Labels (R00194): die ganze Zerlegung von „+“ — selbsterzeugt, zurückgekommen, der Rest neu
  if (selbstGewaehlt) {
    const selbst = summe('selbsterzeugt');
    davon = n => `<small class="bd-davon" id="bd-davon">${BURNDOWN_SELBST} <b>${selbst}</b> · zurückgekommen <b>${n}</b> · neu <b>${summe('hinzugekommen') - selbst - n}</b></small>`;
  }
  return `<div class="kennzahlen" id="bd-kennzahl">${BURNDOWN_EREIGNISSE.map(([groesse, zeichen, feld]) => `<span>${burndownFeld(feld)}${zeichen} <b>${summe(groesse)}</b> ${burndownWort(groesse, zielWorte)}</span>${mitTeilmenge(groesse, davon, summe('zurueckgekommen'))}`).join('')}</div>`;
}
/** Das Band unter den Linien (R00164 AK 7, Zeichnung D0006 #burndown-zugang-abgang): je Tag ein Balkenplatz um `sx(i)` —
    „+“ nach oben, „erledigt“ nach unten, „entfernt“ darunter als hohle, schraffierte Kontur; rechts die Skala. */
function vBurndownBand(t, sx, links, rechts) {
  const { null: nulllinie, hoehe } = BURNDOWN_BAND, KONTUR = 1.5;
  let tagesabstand = rechts - links;
  if (t.length > 1) tagesabstand /= t.length - 1;
  const b = burndownBalken(t, tagesabstand), halb = b.breite / 2;
  const rechteck = (klasse, i, { y, hoehe }, rand = 0, fuellung = '') => hoehe ? `<rect class="${klasse}" x="${(sx(i) - halb + rand / 2).toFixed(2)}" y="${(y + rand / 2).toFixed(2)}" width="${(b.breite - rand).toFixed(2)}" height="${Math.max(0.5, hoehe - rand).toFixed(2)}"${fuellung}></rect>` : '';
  let schraffur = 'none';
  if (b.schraffiert) schraffur = 'url(#bd-schraffur)';
  const balken = b.tage.map((x, i) => rechteck('bd-plus', i, x.hinzugekommen) + rechteck('bd-erledigt', i, x.erledigt) + rechteck('bd-entfernt', i, x.entfernt, KONTUR, ` fill="${schraffur}"`)).join('');
  const rahmen = [nulllinie - hoehe, nulllinie + hoehe].map(y => `<line class="gitter" x1="${links}" x2="${rechts}" y1="${y}" y2="${y}"></line>`).join('');
  const skalaX = (rechts + halb + 8).toFixed(1);
  return `<defs><pattern id="bd-schraffur" class="bd-schraffur" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4"></line></pattern></defs>
${rahmen}<g id="bd-balken">${balken}</g><line class="bd-null" x1="${(links - halb).toFixed(1)}" x2="${(rechts + halb).toFixed(1)}" y1="${nulllinie}" y2="${nulllinie}"></line>
<text class="achse bd-skala" x="${skalaX}" y="${nulllinie - hoehe + 4}">+${b.skala}</text><text class="achse bd-skala" x="${skalaX}" y="${nulllinie + hoehe + 4}">−${b.skala}</text>`;
}
const zahl1 = x => x == null ? '—' : x.toFixed(1).replace('.', ',');
/** „Erledigt heißt“ des gewählten Boards (R00166): der Zielblock aus der Board-Datei, aufgelöst unter dem Berichtsfilter. */
function erledigtHeisst() {
  let zielspalte = null;
  if (S.board && S.board.fieber) zielspalte = S.board.fieber.zielspalte;
  return zielblock(S.bew, S.ui.bf, zielspalte);
}
/** „Zugang ab“ des gewählten Boards (R00167): der Von-Block aus der Board-Datei, aufgelöst unter dem Berichtsfilter gegen
    den Zielblock `ziel` — allein für den Durchsatz. */
function zugangAb(ziel) {
  let vonspalte = null, zielSchluessel = null;
  if (S.board && S.board.fieber) vonspalte = S.board.fieber.vonspalte;
  if (ziel.zaehlt) zielSchluessel = ziel.zaehlt.schluessel;
  return vonblock(S.bew, S.ui.bf, vonspalte, zielSchluessel);
}
/** Wofür „Erledigt heißt“ gilt (R00169, Zeichnung D0006 #fluss-erledigt-heisst) — der eine Wortlaut für alle vier Berichte;
    der Durchsatz setzt ihn mit „Zugang ab“ zusammen. */
const ZIEL_GILT_FUER = 'Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards; in der Durchlaufzeit als Vorgabe für „bis“';
const GILT_FUER_ZIEL = `gilt für ${ZIEL_GILT_FUER}`;
const GILT_FUER_VON_UND_ZIEL = `„Zugang ab“ gilt nur für den Durchsatz, „Erledigt heißt“ für ${ZIEL_GILT_FUER}`;
/** Die Auswahl „Erledigt heißt“ (R00079) samt Geltungssatz — dasselbe Element in Fever Chart, Burndown, Durchsatz und
    Kumulativem Fluss; der letzte Block ist der Standard und trägt den leeren Wert. `ziel` kommt aus `zielblock`. */
function vZielAuswahl(ziel, geltung = GILT_FUER_ZIEL) {
  const letzter = ziel.bloecke.length - 1;
  const eintraege = ziel.bloecke.map((block, i) => {
    let wert = esc(block.schluessel), zusatz = '', gewaehlt = '';
    if (i === letzter) { wert = ''; zusatz = ' (Standard)'; }
    if (!ziel.verschwunden && ziel.zaehlt && block.schluessel === ziel.zaehlt.schluessel) gewaehlt = ' selected';
    return `<option value="${wert}"${gewaehlt}>${esc(block.titel)}${zusatz}</option>`;
  }).join('');
  let verschwunden = '';
  if (ziel.verschwunden) verschwunden = `<option value="${esc(ziel.verschwunden)}" selected>„${esc(ziel.verschwunden)}“ — gibt es nicht mehr</option>`;
  return `<label>Erledigt heißt <select class="mini-inp" data-fb="zielspalte" aria-label="Erledigt heißt">${eintraege}${verschwunden}</select></label><span class="muted">${geltung}</span>`;
}
/** Die Auswahl „Zugang ab“ des Durchsatzes (R00167, Zeichnung D0006 #durchsatz-von): die erste Spalte ist der Standard und
    trägt den leeren Wert; eine Wahl, die es nicht mehr gibt, steht gewählt am Ende. `von` kommt aus `vonblock`. */
function vVonAuswahl(von) {
  let gewaehlterWert = von.gewaehlt || '', verschwunden = '';
  if (von.verschwunden) {
    gewaehlterWert = null;
    verschwunden = `<option value="${esc(von.verschwunden)}" selected>„${esc(von.verschwunden)}“ — gibt es nicht mehr</option>`;
  }
  const eintraege = von.eintraege.map(eintrag => {
    let zusatz = '', gewaehlt = '';
    if (eintrag.wert === '') zusatz = ' (Standard)';
    if (eintrag.wert === gewaehlterWert) gewaehlt = ' selected';
    return `<option value="${esc(eintrag.wert)}"${gewaehlt}>${esc(eintrag.titel)}${zusatz}</option>`;
  }).join('');
  return `<label>Zugang ab <select class="mini-inp" data-fb="vonspalte" aria-label="Zugang ab">${eintraege}${verschwunden}</select></label>`;
}
/** Hinweise zur Von-Spalte: es gibt sie nicht mehr (dann zählt die erste Spalte) oder sie liegt nicht links vom Ziel (dann
    zeigt der Durchsatz keinen Zugang). */
function vVonHinweis(von) {
  if (von.verschwunden) return `<span class="fehl" id="fb-von-weg">Spalte „${esc(von.verschwunden)}“ für „Zugang ab“ gibt es nicht mehr — gerechnet wird ab „${esc(von.name)}“.</span>`;
  if (!von.gueltig) return '<span class="fehl" id="fb-von-rechts">„Zugang ab“ muss links von „Erledigt heißt“ liegen — der Zugang wird nicht gezeigt.</span>';
  return '';
}
/** Hinweis zu einer gespeicherten Zielspalte, die es nicht mehr gibt (R00079) — `gerechnetMit` nennt, was stattdessen zählt.
    Ohne Wahl und mit im Berichtsfilter ausgeschlossener Abschlussspalte `ausgeschlossen` (R00169 AK 8) steht stattdessen, dass
    mit dem letzten sichtbaren Block gerechnet wird — kein Fehler, sondern Folge des eigenen Filters. */
function vZielHinweis(verschwunden, gerechnetMit, ausgeschlossen = null) {
  if (verschwunden) return `<span class="fehl" id="fb-ziel-weg">Zielspalte „${esc(verschwunden)}“ gibt es nicht mehr — gerechnet wird mit „${esc(gerechnetMit)}“.</span>`;
  if (ausgeschlossen) return `<span class="muted" id="fb-ziel-filter">„${esc(ausgeschlossen)}“ ist im Filter ausgeschlossen — gerechnet wird mit „${esc(gerechnetMit)}“.</span>`;
  return '';
}
/** Die Zeile „Erledigt heißt“ über Burndown, Durchsatz und Kumulativem Fluss (R00166, R00169, Zeichnung D0006
    #erledigt-heisst): Auswahl, Geltungssatz, ein Fehler des Speicherns und der Hinweis auf eine verschwundene Wahl oder die
    ausgeschlossene Abschlussspalte — dann rechnen sie bis zum Standard. Mit `von`
    (nur der Durchsatz, R00167) steht „Zugang ab“ links davor, der Geltungssatz nennt beide, die Hinweise zum Ziel zuerst. */
function vErledigtHeisst(ziel, von = null) {
  let fehler = '', name = 'Erledigt heißt', auswahlen = vZielAuswahl(ziel), vonHinweis = '';
  if (S.ui.fbFehler) fehler = `<span class="fehl" role="alert">${esc(S.ui.fbFehler)}</span>`;
  if (von) {
    name = 'Zugang ab und Erledigt heißt';
    auswahlen = vVonAuswahl(von) + vZielAuswahl(ziel, GILT_FUER_VON_UND_ZIEL);
    vonHinweis = vVonHinweis(von);
  }
  return `<section class="fb-einst" role="group" aria-label="${name}">${auswahlen}${fehler}${vZielHinweis(ziel.verschwunden, ziel.standard, ziel.ausgeschlossen)}${vonHinweis}</section>`;
}
/** Die Auswahl „Selbsterzeugt =“ über dem Burndown (R00194 AK 1, Bedienung nach „Erledigt heißt“): je Label der Aufgaben ein
    Umschalter, gewählte vorbelegt — auch ein gewähltes, das keine Aufgabe mehr trägt, damit es abwählbar bleibt. */
function vSelbstAuswahl(selbst) {
  const labels = [...new Set([...alleAufgabenLabels(), ...selbst])].sort();
  const chip = l => { const an = selbst.includes(l); return `<button class="bf-chip${an ? ' an' : ''}" data-act="fb-selbst" data-arg="${esc(l)}" aria-pressed="${an}" title="${an ? 'zählt als selbsterzeugt — Klick nimmt heraus' : 'Klick zählt „+“ mit diesem Label als selbsterzeugt'}">${esc(l)}</button>`; };
  let werte = '<span class="muted">keine Labels an den Aufgaben</span>';
  if (labels.length) werte = labels.map(chip).join('');
  return `<section class="fb-einst" role="group" aria-label="Selbsterzeugt =" id="bd-selbst-wahl"><span>Selbsterzeugt =</span>${werte}<span class="muted">gilt für den Burndown dieses Boards</span></section>`;
}
function vVerlauf() {
  if (!S.bew) return '<div class="leer">lädt …</div>';
  const ziel = erledigtHeisst(), selbst = selbstLabels(), teilmengen = burndownTeilmengen(selbst.length > 0);
  const t = burndown(S.bew, S.ui.bf, aufgabe, Date.now(), S.board && S.board.start, ziel.gewaehlt, selbst), B = 800;
  const H = 272, L = 36, R = 96, O = 16, U = 40;
  const HOEHE_MIT_BAND = 352, BAND_UNTEN = 312, MARKEN_Y = 330;
  const max = Math.max(1, ...t.map(x => x.umfang));
  const sx = i => L + (t.length < 2 ? (B - L - R) / 2 : i * (B - L - R) / (t.length - 1));
  const sy = y => O + (H - O - U) * (1 - y / max);
  const linie = k => t.map((x, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(x[k]).toFixed(1)}`).join('');
  const schritt = Math.max(1, Math.ceil(max / 4));
  const ticks = []; for (let y = 0; y <= max; y += schritt) ticks.push(y);
  const xTicks = xMarken(t.length);
  const letzte = t[t.length - 1];
  const tage = t.map(x => isoTag(x.datum));
  S.diagrammTip = tg => { const x = t[tage.indexOf(tg)]; return x ? `<b>${datumMitWochentag(tg)}</b><span><i class="k-offen"></i>offen ${x.offen}</span><span><i class="k-umfang"></i>Umfang ${x.umfang}</span>${BURNDOWN_EREIGNISSE.map(([groesse, zeichen, feld]) => `<span>${burndownFeld(feld)}${zeichen} ${burndownWort(groesse, ziel.worte)} ${x[groesse]}</span>${mitTeilmenge(groesse, () => teilmengen.map(([wort, schluessel]) => `<small class="tip-davon">${wort} ${x[schluessel]}</small>`).join(''))}`).join('')}` : ''; };
  const svg = t.length ? `<svg class="diagramm" viewBox="0 0 ${B} ${HOEHE_MIT_BAND}" role="img" aria-label="Offene Aufgaben je Tag, darunter Zugang und Abgang je Tag" ${achsAttribut(L, B - L - R, tage[0], tage[tage.length - 1])}>
${ticks.map(y => `<line class="gitter" x1="${L}" x2="${B - R}" y1="${sy(y)}" y2="${sy(y)}"></line><text class="achse" x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`).join('')}
${xTicks.map(i => achsDatum(tage[i], sx(i), MARKEN_Y)).join('')}
<path class="umfang" d="${linie('umfang')}"></path><path class="offen" d="${linie('offen')}"></path>
<circle class="punkt" cx="${sx(t.length - 1)}" cy="${sy(letzte.offen)}" r="4"></circle>
<text class="endwert" x="${sx(t.length - 1) + 10}" y="${sy(letzte.offen) + 4}">offen ${letzte.offen}</text>
<text class="endwert leise" x="${sx(t.length - 1) + 10}" y="${sy(letzte.umfang) + (letzte.umfang === letzte.offen ? 18 : 4)}">Umfang ${letzte.umfang}</text>
${vBurndownBand(t, sx, L, B - R)}
${fadenkreuz(O, BAND_UNTEN)}
</svg>` : `<div class="leer">${S.bew.aufgaben.length ? 'Keine Aufgabe im Zeitraum.' : 'Noch kein Stand dieses Boards.'}</div>`;
  const legende = `<div class="dlegende"><span><i class="k-offen"></i>offen</span><span><i class="k-umfang"></i>Umfang (gezählte Aufgaben auf dem Board)</span></div>`;
  const weg = ausgenommen(S.bew, 'burndown', S.ui.bf, aufgabe, Date.now(), ziel.gewaehlt);
  const nicht = `<h2 class="dtitel">Nicht enthalten</h2><ul class="wl-liste" id="bd-nicht"><li>Ausgenommen (<span class="mono">reporting.burndown: false</span>): ${weg}.</li></ul>`;
  const tabelle = `<details class="tabellenansicht bd-tabelle"><summary data-halt="klappe:tabelle-burndown">Tabellenansicht</summary>${berichtRahmen('Burndown je Tag')}<table class="pt dicht"><thead><tr><th>Tag</th><th class="r">offen</th><th class="r">Umfang</th>${BURNDOWN_EREIGNISSE.map(([groesse, zeichen]) => `<th class="r">${zeichen} ${groesse}</th>${mitTeilmenge(groesse, () => teilmengen.map(([wort]) => `<th class="r">${wort}</th>`).join(''))}`).join('')}</tr></thead><tbody>${t.map(x => `<tr><td class="mono">${datumLang(x.datum)}</td><td class="r num">${x.offen}</td><td class="r num">${x.umfang}</td>${BURNDOWN_EREIGNISSE.map(([groesse]) => `<td class="r num">${x[groesse]}</td>${mitTeilmenge(groesse, () => teilmengen.map(([, schluessel]) => `<td class="r num">${x[schluessel]}</td>`).join(''))}`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  let wasZaehlt = 'offen = nicht in der Abschlussspalte';
  if (ziel.worte) wasZaehlt = `erledigt = ${esc(ziel.worte.lang)}`;
  return `<div class="leiste"><b>Burndown</b><span class="muted">${esc(S.board ? S.board.titel : '')} · aus den Commits von boards/${esc(S.ui.slug || '')}.md · ${wasZaehlt}</span></div>${vBerichtsfilter('burndown')}
<div class="body bericht">${vErledigtHeisst(ziel)}${vSelbstAuswahl(selbst)}${t.length ? vBurndownKennzahl(t, ziel.worte, selbst.length > 0) : ''}<h2 class="dtitel">Offene Aufgaben je Tag</h2>${legende}${t.length ? vDiagrammFlaeche(svg) + vBurndownLegende(ziel.worte, selbst) : svg}${tabelle}${nicht}</div>`;
}

/* Kumulativer Fluss (R00121): gestapelte Bänder je Spalte und zwei kumulierte Ränder über die Zeit; „Erledigt heißt“ wählt,
   was als offen und als fertig zählt (R00169, Zeichnung D0006 #fluss-erledigt-heisst). */
/** Bandton einer Spalte: ihre eingestellte Spaltenfarbe, sonst der Ton ihrer Position aus der Klassenpalette
    (`PAL`) in Board-Reihenfolge, als `-line`-Fassung für ein Diagramm. */
const flussTon = (farbe, i) => farbe || `var(--kd-c-${PAL[i % PAL.length]}-line)`;
function vFluss() {
  const kopfMit = zusatz => `<div class="leiste"><b>Kumulativer Fluss</b> <span class="muted" style="font-size:12px">· Bestand je Spalte über die Zeit${zusatz}</span></div>`;
  if (!S.bew) return `${kopfMit('')}<div class="body bericht"><div class="fluss-leer"><p class="fluss-satz muted">lädt …</p></div>${vFlussTabelle([], S.board ? S.board.spalten.map(sp => sp.name) : [])}</div>`;
  const jetzt = Date.now(), ziel = erledigtHeisst();
  let fertigHeisst = '';
  if (ziel.worte) fertigHeisst = ` · fertig heißt: ${esc(ziel.worte.lang)}`;
  const kopf = kopfMit(fertigHeisst);
  const weg = ausgenommen(S.bew, 'burndown', S.ui.bf, aufgabe, jetzt, ziel.gewaehlt);
  const nicht = `<h2 class="dtitel">Nicht enthalten</h2><ul class="wl-liste" id="fl-nicht"><li>Ausgenommen (<span class="mono">reporting.burndown: false</span>): ${weg}.</li></ul>`;
  const d = fluss(S.bew, S.ui.bf, aufgabe, jetzt, S.board && S.board.start, ziel.gewaehlt);
  const spalten = d.spalten, t = d.tage;
  const ton = (name, i) => flussTon((S.board.spalten.find(sp => sp.name === name) || {}).farbe, i);
  S.diagrammTip = tg => { const stand = t.find(x => isoTag(x.datum) === tg); if (!stand) return ''; const [datum, ...rest] = flussName(stand.datum, stand, spalten).split(' · '); return `<b>${esc(datum)}</b> · ${rest.map(esc).join(' · ')}`; };
  // leer, wenn kein Tag einen Stapel trägt (keine Aufgabe im Zeitraum) — kein Stand, wenn das Board keine Bewegung hat
  if (!t.length || t.every(x => !x.gesamt)) {
    const satz = S.bew.aufgaben.length ? 'Keine Aufgabe im Zeitraum.' : 'Noch kein Stand dieses Boards.';
    const knopf = leistenAnzahl(S.ui.bf, BERICHTSLEISTEN.fluss) ? '<button class="btn bf-leeren" data-act="bf-leeren" data-arg="fluss">Zurücksetzen</button>' : '';
    return `${kopf}${vBerichtsfilter('fluss')}<div class="body bericht">${vErledigtHeisst(ziel)}<div class="fluss-leer"><p class="fluss-satz">${satz}</p>${knopf}</div>${vFlussTabelle(t, spalten)}${nicht}</div>`;
  }
  return `${kopf}${vBerichtsfilter('fluss')}<div class="body bericht">${vErledigtHeisst(ziel)}${vFlussFlaeche(t, spalten, ton)}${vFlussLegende(spalten, ton, ziel.worte)}${vFlussTabelle(t, spalten)}${nicht}</div>`;
}
/** Legende: je Spalte ein Farbfeld in ihrem Bandton und der Name, dann „angekommen“/„fertig“ — mit gewähltem Zielblock
    „fertig (ab „B“)“; nur Text, kein Knopf. */
function vFlussLegende(spalten, ton, zielWorte) {
  const le = (inner, wort) => `<span class="fluss-le">${inner}${esc(wort)}</span>`;
  let fertig = 'fertig';
  if (zielWorte) fertig = `fertig (${zielWorte.kurz})`;
  return `<div class="fluss-leg" aria-label="Legende">${spalten.map((name, i) => le(`<span class="fluss-sw" style="background:${esc(ton(name, i))}"></span>`, name)).join('')}${le('<span class="fluss-linie"></span>', 'angekommen')}${le('<span class="fluss-linie f"></span>', fertig)}<span class="rechts">zeigt nur, filtert nicht</span></div>`;
}
/** Die textliche Entsprechung der Fläche: je Tag eine Zeile mit jeder Spalte und den kumulierten Rändern, in
    einem tastaturerreichbaren Querscroll-Rahmen (`.bericht-rahmen`, in jedem Zustand vorhanden). */
function vFlussTabelle(t, spalten) {
  const kopf = `<tr><th scope="col">Tag</th>${spalten.map(s => `<th scope="col">${esc(s)}</th>`).join('')}<th scope="col">offen</th><th scope="col">gesamt</th><th scope="col">angekommen</th><th scope="col">fertig</th></tr>`;
  const zeilen = t.map(x => `<tr><td class="mono">${datumLang(x.datum)}</td>${spalten.map(s => `<td>${x.jeSpalte[s] || 0}</td>`).join('')}<td>${x.offen}</td><td>${x.gesamt}</td><td>${x.angekommen}</td><td>${x.fertig}</td></tr>`).join('');
  return `<details class="fluss-tabs"><summary data-halt="klappe:tabelle-fluss">Tabellenansicht</summary>${berichtRahmen('Kumulativer Fluss je Tag')}<table class="fluss-tab"><thead>${kopf}</thead><tbody>${zeilen}</tbody></table></div></details>`;
}
const FLUSS_B = 800, FLUSS_H = 272, FLUSS_L = 44, FLUSS_R = 120, FLUSS_O = 24, FLUSS_U = 44;
/** Mindestabstand der beiden Randbeschriftungen: eine Zeile der 12-px-Schrift samt Zeilenabstand (wie „Umfang“ im Burndown). */
const FLUSS_ZEILE = 24;
/** Die Zeichenfläche: gestapelte Bänder (unten erste Spalte, oben letzte), y-Achse bis `max(gesamt, angekommen, fertig)`. */
function vFlussFlaeche(t, spalten, ton) {
  const max = flussMax(t);
  const breite = FLUSS_B - FLUSS_L - FLUSS_R, unten = FLUSS_H - FLUSS_U;
  const sy = v => Math.round(FLUSS_O + (unten - FLUSS_O) * (1 - v / max));
  const xs = t.map((x, i) => Math.round(FLUSS_L + (t.length < 2 ? breite / 2 : i * breite / (t.length - 1))));
  const punkte = werte => werte.map((v, i) => `${xs[i]},${sy(v)}`);
  const linie = werte => `M${punkte(werte).join('L')}`;
  const bandPfad = (oben, unter) => `${linie(oben)}L${punkte(unter).reverse().join('L')}Z`;
  const stapel = k => t.map(x => spalten.slice(0, k + 1).reduce((s, name) => s + (x.jeSpalte[name] || 0), 0));
  const bänder = spalten.map((name, k) => `<path class="band" fill="${esc(ton(name, k))}" d="${bandPfad(stapel(k), k ? stapel(k - 1) : t.map(() => 0))}"></path>`).join('');
  const schritt = Math.max(1, Math.ceil(max / 4));
  const ticks = []; for (let y = 0; y <= max; y += schritt) ticks.push(y);
  const tage = t.map(x => isoTag(x.datum));
  const marken = xMarken(t.length);
  const letzte = t[t.length - 1];
  // Randbeschriftungen nie übereinander (R00188 55-3 e): „angekommen“ ≥ „fertig“, liegt sie näher als eine Zeile, rückt sie nach oben
  const yFertig = sy(letzte.fertig) + 4, yAngekommen = Math.min(sy(letzte.angekommen) + 4, yFertig - FLUSS_ZEILE);
  const rand = (klasse, wort, v, y) => `<text class="randtext ${klasse}" x="${FLUSS_L + breite + 8}" y="${y}">${wort} ${v}</text>`;
  const svg = `<svg class="diagramm cfd" viewBox="0 0 ${FLUSS_B} ${FLUSS_H}" role="img" aria-label="Kumulativer Fluss: Bestand je Spalte je Tag" ${achsAttribut(FLUSS_L, breite, tage[0], tage[tage.length - 1])}>
${ticks.map(v => `<line class="gitter" x1="${FLUSS_L}" x2="${FLUSS_L + breite}" y1="${sy(v)}" y2="${sy(v)}"></line><text class="achse achse-y" x="${FLUSS_L - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`).join('')}
${marken.map(i => achsDatum(tage[i], xs[i], unten + 18)).join('')}
${bänder}<path class="ang" d="${linie(t.map(x => x.angekommen))}"></path><path class="fer" d="${linie(t.map(x => x.fertig))}"></path>
${rand('a', 'angekommen', letzte.angekommen, yAngekommen)}${rand('f', 'fertig', letzte.fertig, yFertig)}
${fadenkreuz(FLUSS_O, unten)}
</svg>`;
  return vDiagrammFlaeche(svg);
}

/* Durchsatz je Zeitraum (R00122, Artboard D0006 „Durchsatz“): je Kalenderperiode ein Balkenpaar — links der Zugang ab der
   Von-Spalte, rechts der Abgang, die Aufgaben, die das Ziel erreicht haben — mit gestrichelter Ø-Linie des Abgangs;
   „Zugang ab“ wählt die Von-Spalte (R00167, Zeichnung #durchsatz-von), „Erledigt heißt“ das Ziel (R00166).
   Rechnung: durchsatz() in web/berichte.js. */
const DUS_B = 800, DUS_H = 272, DUS_L = 44, DUS_R = 120, DUS_O = 24, DUS_U = 44;
/** Einheitenwort („je Woche“) der Auflösung. */
const dusWort = e => (DURCHSATZ_EINHEITEN.find(([k]) => k === e) || [null, ''])[1];
/** Zusatz „bis „B““ der Durchsatz-Texte bei gewähltem Zielblock (R00166 AK 10), eingefasst von `davor` und `danach`; ohne Wahl leer. */
function dusBis(zielWorte, davor, danach = '') {
  if (!zielWorte) return '';
  return `${davor}${esc(zielWorte.bis)}${danach}`;
}
/** Zusatz „ab „Arbeit““ der Durchsatz-Texte bei gewählter Von-Spalte (R00167), mit `davor` eingeleitet; ohne Wahl und ohne
    gezeigten Zugang leer. `zugang` ist der Von-Block aus `vonblock` oder null. */
function dusAb(zugang, davor) {
  if (!zugang || !zugang.worte.ab) return '';
  return `${davor}${esc(zugang.worte.ab)}`;
}
function vDurchsatz() {
  const u = S.ui;
  const kopfMit = zusatz => `<div class="leiste"><b>Durchsatz je Zeitraum</b> <span class="muted" style="font-size:12px">· Zugang und Abgang je Periode${zusatz}</span></div>`;
  if (!S.bew) return `${kopfMit('')}<div class="body bericht"><div class="fluss-leer"><p class="fluss-satz muted">lädt …</p></div></div>`;
  const einheit = DURCHSATZ_EINHEITEN.some(([k]) => k === u.dusEinheit) ? u.dusEinheit : DURCHSATZ_STANDARD;
  const ziel = erledigtHeisst(), von = zugangAb(ziel);
  // der Zugang wird nur gezeigt, wenn die Von-Spalte links vom Ziel liegt (AK 5) — sonst steht allein der Abgang
  let zugang = null;
  if (von.gueltig) zugang = von;
  const kopf = kopfMit(dusAb(zugang, ' · ') + dusBis(ziel.worte, ' · '));
  const d = durchsatz(S.bew, u.bf, aufgabe, Date.now(), S.board && S.board.start, einheit, ziel.gewaehlt, von.gewaehlt);
  const zurueck = leistenAnzahl(u.bf, BERICHTSLEISTEN.durchsatz) ? '<button class="btn bf-leeren" data-act="bf-leeren" data-arg="durchsatz">Zurücksetzen</button>' : '';
  const zustand = satz => `${kopf}${vBerichtsfilter('durchsatz')}<div class="body bericht">${vErledigtHeisst(ziel, von)}<div class="fluss-leer"><p class="fluss-satz">${satz}</p>${zurueck}</div></div>`;
  if (!S.bew.aufgaben.length) return zustand('Noch kein Stand dieses Boards.');
  if (d.zielAusgeschlossen) return zustand(`Die Zielspalte „${esc(d.ziel.name)}“ ist ausgeschlossen.`);
  const gezeigterZugang = zugang ? d.zugangGesamt : 0;
  if (!d.gesamt && !gezeigterZugang) return zustand('Keine Aufgabe im Zeitraum.');
  return `${kopf}${vBerichtsfilter('durchsatz')}<div class="body bericht">${vErledigtHeisst(ziel, von)}
${vDurchsatzKennzahlen(d, ziel.worte, zugang)}
${vDurchsatzUm(einheit)}
${vDurchsatzFlaeche(d, einheit, ziel.worte, zugang)}${vDurchsatzLegende(d, einheit, ziel.worte, zugang)}
${vDurchsatzTabelle(d, einheit, zugang)}
${d.ausgenommen ? vDurchsatzNicht(d.ausgenommen) : ''}</div>`;
}
/** Kennzahlenzeile (M4, R00167): Zugang und Abgang je mit Summe und Ø je Periode, dazu die Zahl der Perioden — alle folgen
    der Auflösung; ohne gezeigten Zugang steht allein der Abgang. */
function vDurchsatzKennzahlen(d, zielWorte, zugang) {
  const n = d.perioden.length, je = dusWort(d.einheit);
  let zugangZahl = '';
  if (zugang) zugangZahl = `<span><i class="k-zugang"></i>Zugang <b>${d.zugangGesamt}</b>${dusAb(zugang, ' ')} · Ø <b>${zahl1(d.zugangDurchschnitt)}</b> ${je}</span>`;
  return `<div class="kennzahlen" id="dus-kennzahl">${zugangZahl}<span><i class="k-abgang"></i>Abgang <b>${d.gesamt}</b>${dusBis(zielWorte, ' ')} · Ø <b>${zahl1(d.durchschnitt)}</b> ${je}</span><span><b>${n}</b> ${n === 1 ? 'Periode' : 'Perioden'}</span></div>`;
}
/** Auflösungs-Umschalter (M3): .seg-Radiogruppe mit zugänglichem Namen, sichtbarem Auswahlzustand, per Tastatur bedienbar. */
function vDurchsatzUm(einheit) {
  return `<div class="dus-um"><span class="bf-k">Auflösung</span><span class="seg" role="radiogroup" aria-label="Auflösung">${DURCHSATZ_EINHEITEN.map(([k, t]) => `<span class="${k === einheit ? 'an' : ''}" role="radio" aria-checked="${k === einheit}" data-act="dus-einheit" data-arg="${k}">${t}</span>`).join('')}</span></div>`;
}
const vDurchsatzNicht = n => `<div class="kennzahlen" id="dus-nicht"><span>Nicht enthalten: ausgenommen <b>${n}</b></span></div>`;
/** Legende: die zwei Balken und die Ø-Linie des Abgangs; die Zahlen stehen in Tabelle und Tooltip (keine Farbe allein).
    Darunter, was der Zugang zählt — „erstmals“, deshalb darf er vom „+ hinzugekommen“ des Burndowns abweichen (R00167 AK 8).
    Ohne gezeigten Zugang entfallen sein Eintrag und die zwei Sätze. */
function vDurchsatzLegende(d, einheit, zielWorte, zugang) {
  let zugangEintrag = '', zugangSaetze = '';
  if (zugang) {
    zugangEintrag = `<span class="fluss-le"><span class="fluss-sw zugang"></span>Zugang (erstmals ab „${esc(zugang.name)}“)</span>`;
    zugangSaetze = `\n<p class="bd-hinweis" id="dus-zugang-satz">„Zugang“ zählt jede Aufgabe einmal: in der Periode, in der sie ${esc(zugang.worte.genannt)} oder eine Spalte rechts davon erstmals erreicht; Rückläufer zählen nicht erneut.<br>Deshalb darf der Zugang vom „+ hinzugekommen“ des Burndowns abweichen: dort zählt Nacharbeit jedes Mal.</p>`;
  }
  return `<div class="fluss-leg" aria-label="Legende">${zugangEintrag}<span class="fluss-le"><span class="fluss-sw"></span>Abgang: erledigte Aufgaben${dusBis(zielWorte, ' (', ')')}</span><span class="fluss-le"><span class="fluss-linie f"></span>Ø Abgang ${zahl1(d.durchschnitt)} ${dusWort(einheit)}</span><span class="rechts">zeigt nur, filtert nicht</span></div>${zugangSaetze}`;
}
/** Tooltip einer Periode: „03.11.2026 · Zugang 2 ab „Arbeit“ · Abgang 0 bis „B““ — der Zugang nur, wenn er gezeigt wird. */
function dusTip(p, einheit, zielWorte, zugang) {
  let zugangTeil = '';
  if (zugang) zugangTeil = `<i class="k-zugang"></i>Zugang ${p.zugang}${dusAb(zugang, ' ')} · `;
  return `<b>${esc(durchsatzTip(p, einheit))}</b> · ${zugangTeil}<i class="k-abgang"></i>Abgang ${p.anzahl}${dusBis(zielWorte, ' ')}`;
}
/** Das Balkenpaar einer Periode um ihre Mitte `x`: Zugang links (hohl, Kontur 2 nach innen — bei schmalen Balken voll), Abgang
    rechts in --kd-accent; bei 0 kein Rechteck. Ohne gezeigten Zugang steht der Abgang allein an seinem Platz rechts. */
function dusBalken(p, x, sy, unten, masse, zugang) {
  let rechtecke = '';
  if (zugang && p.zugang) {
    const links = x - masse.paar / 2, oben = sy(p.zugang);
    if (masse.zugangVoll) rechtecke += `<rect class="balken zugang voll" x="${links.toFixed(1)}" y="${oben}" width="${masse.breite.toFixed(1)}" height="${(unten - oben).toFixed(1)}"></rect>`;
    else rechtecke += `<rect class="balken zugang" x="${(links + 1).toFixed(1)}" y="${oben + 1}" width="${(masse.breite - 2).toFixed(1)}" height="${(unten - oben - 1).toFixed(1)}"></rect>`;
  }
  if (p.anzahl) rechtecke += `<rect class="balken" x="${(x + masse.luecke / 2).toFixed(1)}" y="${sy(p.anzahl)}" width="${masse.breite.toFixed(1)}" height="${(unten - sy(p.anzahl)).toFixed(1)}"></rect>`;
  return rechtecke;
}
/** Die Zeichenfläche: je Periode ein Balkenpaar (Zugang in --kd-agent, Abgang in --kd-accent) auf einer y-Skala bis zum
    höchsten Wert beider, Grundlinie und eine Marke je Periode (auch bei 0), gestrichelte Ø-Linie des Abgangs in --kd-warn
    mit Halo-Beschriftung, x-Achse je Auflösung. */
function vDurchsatzFlaeche(d, einheit, zielWorte, zugang) {
  const t = d.perioden;
  let max = Math.max(1, ...t.map(x => x.anzahl));
  if (zugang) max = Math.max(max, ...t.map(x => x.zugang));
  const breite = DUS_B - DUS_L - DUS_R, unten = DUS_H - DUS_U;
  const sy = v => Math.round(DUS_O + (unten - DUS_O) * (1 - v / max));
  const slot = breite / t.length, masse = durchsatzPaar(breite, t.length);
  const xs = i => DUS_L + slot * (i + 0.5);
  const schritt = Math.max(1, Math.ceil(max / 4)), ticks = [];
  for (let v = 0; v <= max; v += schritt) ticks.push(v);
  const t1 = t[t.length - 1].bis;
  const marken = xMarken(t.length);
  const achse = i => {
    const m = durchsatzMarke(t[i], einheit), x = xs(i).toFixed(1);
    return m.unten
      ? `<text class="achse achse-x" x="${x}" y="${unten + 18}" text-anchor="middle"><tspan x="${x}">${esc(m.oben)}</tspan><tspan x="${x}" dy="12">${esc(m.unten)}</tspan></text>`
      : `<text class="achse achse-x" x="${x}" y="${unten + 22}" text-anchor="middle">${esc(m.oben)}</text>`;
  };
  S.diagrammTip = tg => { const p = t.find(x => tg >= x.von && tg < x.bis); return p ? dusTip(p, einheit, zielWorte, zugang) : ''; };
  const svg = `<svg class="diagramm dus" viewBox="0 0 ${DUS_B} ${DUS_H}" role="img" aria-label="Durchsatz je Zeitraum: Zugang und Abgang je Periode" ${achsAttribut(DUS_L, breite, t[0].von, t1)}>
${ticks.map(v => `<line class="gitter" x1="${DUS_L}" x2="${DUS_L + breite}" y1="${sy(v)}" y2="${sy(v)}"></line><text class="achse" x="${DUS_L - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`).join('')}
<line class="grund" x1="${DUS_L}" x2="${DUS_L + breite}" y1="${unten}" y2="${unten}"></line>
${t.map((x, i) => dusBalken(x, xs(i), sy, unten, masse, zugang)).join('')}
${marken.map(i => `<line class="marke" x1="${xs(i).toFixed(1)}" x2="${xs(i).toFixed(1)}" y1="${unten}" y2="${unten + 5}"></line>`).join('')}
<line class="rate" x1="${DUS_L}" x2="${DUS_L + breite}" y1="${sy(d.durchschnitt)}" y2="${sy(d.durchschnitt)}"></line><text class="ratetext" x="${DUS_L + breite + 8}" y="${sy(d.durchschnitt) + 4}">Ø Abgang ${zahl1(d.durchschnitt)}</text>
${marken.map(achse).join('')}
${fadenkreuz(DUS_O, unten)}
</svg>`;
  return vDiagrammFlaeche(svg);
}
/** Die textliche Entsprechung (M5): je Periode eine Zeile mit Zugang und Abgang, „Summe“ als th scope=row, im
    tastaturerreichbaren .bericht-rahmen; ohne gezeigten Zugang entfällt seine Spalte. */
function vDurchsatzTabelle(d, einheit, zugang) {
  const zugangZelle = wert => zugang ? `<td class="r">${wert}</td>` : '';
  let zugangKopf = '';
  if (zugang) zugangKopf = '<th scope="col" class="r">Zugang</th>';
  const zeilen = d.perioden.map(p => `<tr><td>${esc(durchsatzName(p, einheit))}</td>${zugangZelle(p.zugang)}<td class="r">${p.anzahl}</td></tr>`).join('');
  return `<details class="fluss-tabs"><summary data-halt="klappe:tabelle-durchsatz">Tabellenansicht</summary>${berichtRahmen('Durchsatz je Zeitraum')}<table class="fluss-tab"><thead><tr><th scope="col">Zeitraum</th>${zugangKopf}<th scope="col" class="r">Abgang</th></tr></thead><tbody>${zeilen}</tbody><tfoot><tr><th scope="row">Summe</th>${zugangZelle(d.zugangGesamt)}<td class="r">${d.gesamt}</td></tr></tfoot></table></div></details>`;
}

/** Kostenbericht (R00105 US-9 bis US-14, R00165 AK 9, R00171): je Währung die angefallenen Kosten — Kosteneinträge, alte
    Posten und ihre Summe — über alle Spalten und das Archiv, darunter die Aufgaben mit Einträgen; reine Schätzungen werden
    nur gezählt. Ein gewählter Zeitraum lässt nur die Einträge darin zählen (Zeichnung D0006 #kosten-zeitraum-abschnitt). */
function vKosten() {
  const kopf = `<div class="leiste"><b>Kosten</b> <span class="muted" style="font-size:12px">· angefallene API-Kosten</span></div>${vBerichtsfilter('kosten')}`;
  if (!S.board) return `${kopf}<div class="body"><div class="leer">lädt …</div></div>`;
  const jetzt = Date.now(), filter = S.ui.bf;
  const aufstellung = kostenaufstellung(S.board, S.aufgaben, filter, jetzt);
  const aktiv = filterAnzahl(filterOhneZeitraum(filter)) > 0;
  return `${kopf}${vKostenBereich(filter, jetzt, aufstellung.grenzenWeg)}<div class="body" id="kosten">${vKostenInhalt(aufstellung, kostenUmfang(filter, aufstellung.bereich), aktiv)}</div>`;
}
/** Die Bereichszeile unter der Filterbox: der Zeitraum des Berichtsfilters, der Spaltenabschnitt und — nur wenn ein
    Bereich gewählt ist — der eine Knopf, der beide aufhebt; eine gespeicherte Grenze, die es nicht mehr gibt, wird genannt. */
function vKostenBereich(f, jetzt, grenzenWeg) {
  const wahl = kostenSpaltenwahl(S.board, f), weg = seite => grenzenWeg.find(g => g.seite === seite);
  const abschnitt = `<span class="kost-feld"><b>Spalte</b>${vKostenSpalte('von', 'kostenVonSpalte', wahl.von, weg('von'))}${vKostenSpalte('bis', 'kostenBisSpalte', wahl.bis, weg('bis'))}</span>`;
  let grenzeWeg = '';
  if (grenzenWeg.length) grenzeWeg = `<span class="fehl" id="kost-grenze-weg">${grenzenWeg.map(g => `Spalte „${esc(g.name)}“ (${g.seite}) gibt es nicht mehr — diese Grenze gilt als „alle“.`).join(' ')}</span>`;
  let leeren = '';
  if (kostenbereichGewaehlt(f)) leeren = '<button class="btn bf-leeren" id="kost-bereich-leeren" data-act="kost-bereich-leeren" aria-label="Zeitraum und Spaltenabschnitt zurücksetzen">Zurücksetzen</button>';
  return `<section class="fb-einst kost-bereich" id="kost-bereich" role="group" aria-label="Zeitraum und Spaltenabschnitt"><span class="kost-feld"><b>Zeitraum</b>${vZeitraumFelder(f, jetzt)}</span>${abschnitt}${leeren}${grenzeWeg}<span class="muted">Der Zeitraum gilt für alle Berichte dieses Boards, der Spaltenabschnitt nur für die Kosten · beide Grenzen zählen mit</span></section>`;
}
/** Eine Auswahl des Spaltenabschnitts: „alle“ (Vorgabe, leerer Wert), dann die Spalten des Boards — Spaltennamen sind
    fremder Text und stehen nur als Text und als Wert da. Eine gespeicherte Grenze, die es nicht mehr gibt, steht gewählt
    am Ende (wie beim Fever Chart). */
function vKostenSpalte(seite, feld, eintraege, verschwunden) {
  let nichtMehrDa = '';
  if (verschwunden) nichtMehrDa = `<option value="${esc(verschwunden.name)}" selected>„${esc(verschwunden.name)}“ — gibt es nicht mehr</option>`;
  const optionen = eintraege.map(e => {
    let merkmale = '';
    if (e.gewaehlt) merkmale += ' selected';
    if (e.gesperrt) merkmale += ' disabled';
    return `<option value="${esc(e.name)}"${merkmale}>${esc(e.name)}</option>`;
  }).join('');
  return `<label>${seite} <select class="mini-inp" id="kost-${seite}-spalte" data-bf="${feld}" aria-label="Spalte ${seite}"><option value="">alle</option>${optionen}${nichtMehrDa}</select></label>`;
}
function vKostenInhalt(aufstellung, umfang, aktiv) {
  if (aufstellung.gruppen.some(g => g.summe)) return vKostenSummen(aufstellung, umfang);
  let knopf = '';
  if (aktiv) knopf = '<button class="btn bf-leeren kost-reset" data-act="bf-leeren" data-arg="kosten">Zurücksetzen</button>';
  if (aktiv && aufstellung.m === 0) return `<div class="kost-leer"><p class="kost-satz">Keine Aufgaben, die zu den Filtern der Berichte passen.</p>${knopf}</div>`;
  if (aufstellung.bereich) return vKostenBereichLeer(aufstellung, umfang, knopf);
  return vKostenLeer(aufstellung, umfang, knopf);
}
function vKostenSummen(aufstellung, umfang) {
  const mehrereWaehrungen = aufstellung.gruppen.length > 1;
  const gruppen = aufstellung.gruppen.map(g => vKostenGruppe(g, aufstellung, umfang) + vKostenListe(g, aufstellung.bereich, mehrereWaehrungen)).join('');
  let stand = '';
  if (aufstellung.gruppen.some(g => g.aufgaben.length)) stand = `<p class="kost-hinweis kost-stand">${esc(kostenStandSatz(aufstellung.erledigtAb))}</p>`;
  const rollen = aufstellung.gruppen.map(g => vKostenRollen(g, aufstellung.bereich, mehrereWaehrungen)).join('');
  return `<div class="kost-summen">${gruppen}${stand}${vNurSchaetzung(aufstellung.nurSchaetzung)}${rollen}</div>`;
}
/** Eine Gruppe je Währung: „Einträge“ und die Zeile der alten Posten nur, wenn es sie gibt, „Summe“ immer — außer in einer
    Währung, in der im gewählten Bereich nichts zählt. Was nicht in der Summe steht, folgt hinter ihr. */
function vKostenGruppe(g, aufstellung, umfang) {
  let eintraege = '', posten = '', summe = '', imBereich = '';
  if (aufstellung.bereich) imBereich = ' im gewählten Bereich';
  if (g.summe && g.summe.eintraege != null) eintraege = vKostenTeilzeile('Einträge', geld(g.summe.eintraege, g.waehrung));
  if (g.summe && g.summe.posten) posten = vKostenTeilzeile(OHNE_DATUM, spanne(g.summe.posten.niedrig, g.summe.posten.hoch, g.waehrung, '–'));
  if (g.summe) summe = `<p class="kost-zeile kost-gesamt"><b class="kost-wort">Summe</b> <span class="kost-betrag">${spanne(g.summe.niedrig, g.summe.hoch, g.waehrung, '–')}</span> <span class="kost-umfang">· ${g.summe.n} von ${aufstellung.m} ${zaehlwort(aufstellung.m, 'Aufgabe', 'Aufgaben')} mit angefallenen Kosten${imBereich}, ${umfang}</span></p>`;
  const aussen = kostenAussen(g).map(z => `<p class="kost-zeile kost-teilzeile kost-aussen"><span class="kost-wort">${z.wort}</span> <span class="kost-betrag">${z.betrag}</span> <span class="kost-umfang">· ${z.grund}</span></p>`).join('');
  return `<div class="kost-gruppe" role="group" aria-label="Angefallene Kosten in ${esc(g.waehrung)}">${eintraege}${posten}${summe}${aussen}</div>`;
}
const OHNE_DATUM = 'ohne Datum / ohne Rolle / ohne Spalte';
/** Was im gewählten Bereich neben der Summe steht und nicht mitzählt → [{wort, betrag, grund}]; ohne Bereich nichts. */
function kostenAussen(g) {
  const zeilen = [];
  if (g.fremdeSpalte != null) zeilen.push({ wort: 'Spalte nicht auf diesem Board', betrag: geld(g.fremdeSpalte, g.waehrung), grund: 'nicht in der Summe – Einträge aus einer Spalte, die dieses Board nicht führt' });
  if (g.altePostenAussen) zeilen.push({ wort: OHNE_DATUM, betrag: spanne(g.altePostenAussen.niedrig, g.altePostenAussen.hoch, g.waehrung, '–'), grund: 'nicht in der Summe – ohne Datum und Spalte keinem Bereich zuzuordnen' });
  return zeilen;
}
/** Der Satz unter der Liste: von wann der „Stand“ ist und ab welcher Spalte „erledigt“ gilt. */
function kostenStandSatz(erledigtAb) {
  const anfang = `„Stand“ ist der von heute · „erledigt“ heißt hier: in „${erledigtAb.spalte}“`;
  if (erledigtAb.grund === 'bis') return `${anfang} oder rechts davon (Bis-Spalte des Abschnitts).`;
  if (erledigtAb.grund === 'ziel') return `${anfang} oder rechts davon (Zielspalte des Boards).`;
  return `${anfang} (letzte Spalte des Boards).`;
}
/** Die Aufgaben hinter der Summe einer Währung, nach Nummer, mit ihrem Stand; Titel sind fremder Text und stehen nur als
    Text da. */
function vKostenListe(g, bereich, mehrereWaehrungen) {
  if (!g.aufgaben.length) return '';
  let name = 'Aufgaben mit Einträgen';
  if (bereich) name += ' im gewählten Bereich';
  if (mehrereWaehrungen) name += ` (${g.waehrung})`;
  const zeilen = g.aufgaben.map(a => `<tr><td class="nr">#${a.nummer}</td><th scope="row" class="tt" title="${esc(a.titel)}">${esc(a.titel)}</th><td class="r">${geld(a.cent, g.waehrung)}</td><td class="kost-kz">${a.kennzeichen}</td></tr>`).join('');
  return `<table class="kost-liste"><caption>${esc(name)}</caption><thead><tr><th scope="col" class="nr">Nr.</th><th scope="col" class="tt">Aufgabe</th><th scope="col" class="r">Betrag</th><th scope="col" class="kost-kz">Stand</th></tr></thead><tbody>${zeilen}</tbody></table>`;
}
/** „Kosten je Rolle“ einer Währung (R00172, Zeichnung D0006 #kosten-je-rolle): eine Klappe, darin je Rolle eine Klappe
    mit ihrem Betrag, dann „Rollen zusammen“ und — wenn es alte Posten gibt — die Zeile „ohne Rolle“. Ohne zählende
    Einträge keine Klappe. Die Kennung `data-kr` (Währung, darunter Währung/Rolle) trägt den Klappzustand über das
    Neuzeichnen; Rollennamen sind fremder Text und stehen nur als Text und als Attributwert da. */
function vKostenRollen(g, bereich, mehrereWaehrungen) {
  if (!g.rollen.length) return '';
  let titel = 'Kosten je Rolle';
  if (mehrereWaehrungen) titel += ` · ${g.waehrung}`;
  const offen = S.ui.kostRollenOffen.get(S.ui.slug) || new Set(), offenMerkmal = kennung => {
    if (offen.has(kennung)) return ' open';
    return '';
  };
  const rollen = g.rollen.map(rolle => vKostenRolle(rolle, g.waehrung, offenMerkmal(`${g.waehrung}/${rolle.rolle}`))).join('');
  const zusammen = g.rollen.reduce((summe, rolle) => summe + rolle.cent, 0);
  const schluss = `<p class="kost-rsumme"><span class="kost-rname">Rollen zusammen</span> <span class="r">${esc(geld(zusammen, g.waehrung))}</span> <span class="kost-umfang">· gleich „Einträge“</span></p>`;
  return `<details class="kost-rollen" id="kost-rollen-${esc(g.waehrung)}" data-kr="${esc(g.waehrung)}"${offenMerkmal(g.waehrung)}><summary data-halt="klappe:kosten:${esc(g.waehrung)}">${esc(titel)}</summary>${rollen}${schluss}${vKostenOhneRolle(g, bereich)}</details>`;
}
function vKostenRolle(rolle, waehrung, offenMerkmal) {
  const aufgaben = rolle.aufgaben.map(a => `<li><div class="kost-rzeile"><span class="nr">#${a.nummer}</span> <span class="tt">${esc(a.titel)}</span> <span class="r">${esc(geld(a.cent, waehrung))}</span></div>${vKostenRolleneintraege(a.eintraege, waehrung)}</li>`).join('');
  return `<details class="kost-rolle" data-kr="${esc(`${waehrung}/${rolle.rolle}`)}"${offenMerkmal}><summary data-halt="klappe:kosten:${esc(`${waehrung}/${rolle.rolle}`)}"><span class="kost-rname">${esc(rolle.rolle)}</span> <span class="r">${esc(geld(rolle.cent, waehrung))}</span></summary><ul class="kost-raufg" aria-label="${esc(`Aufgaben der Rolle ${rolle.rolle}`)}">${aufgaben}</ul></details>`;
}
/** Die Einträge einer Aufgabe unter ihrer Rolle: Zeitpunkt in der Ortszeit des Betrachters und Spalte — fremder Text. */
function vKostenRolleneintraege(eintraege, waehrung) {
  const zeilen = eintraege.map(e => `<li><span class="zs">${esc(`${zeitpunktLang(e.at)} · ${e.spalte}`)}</span> <span class="r">${esc(geld(e.cent, waehrung))}</span></li>`).join('');
  return `<ul class="kost-reintr" aria-label="Einträge">${zeilen}</ul>`;
}
/** „ohne Rolle“ sind allein die alten Posten: ohne Bereich zählen sie in der Summe mit, im gewählten Bereich stehen sie
    daneben. Keine Klappe; ohne alte Posten keine Zeile. */
function vKostenOhneRolle(g, bereich) {
  let posten = g.summe.posten, klasse = 'kost-ohne-rolle', zusatz = 'zählt in der Summe mit';
  if (bereich) {
    posten = g.altePostenAussen;
    klasse += ' kost-aussen';
    zusatz = 'nicht in der Summe';
  }
  if (!posten) return '';
  return `<p class="${klasse}"><span class="kost-rname">ohne Rolle</span> <span class="r">${esc(spanne(posten.niedrig, posten.hoch, g.waehrung, '–'))}</span> <span class="kost-umfang">· ${zusatz}</span></p>`;
}
/** Im gewählten Bereich zählt nichts: der Satz und, was daneben steht — der Knopf, der den Bereich aufhebt, steht in der
    Bereichszeile; `knopf` hebt wie in den übrigen Leerzuständen die Filter auf. */
function vKostenBereichLeer(aufstellung, umfang, knopf) {
  const aussen = aufstellung.gruppen.flatMap(g => kostenAussen(g)).map(z => `<p class="kost-hinweis">${z.wort} <span class="kost-betrag">${z.betrag}</span> · ${z.grund}</p>`).join('');
  return `<div class="kost-leer"><p class="kost-satz">Im gewählten Bereich sind keine Kosten angefallen · 0 von ${aufstellung.m} ${zaehlwort(aufstellung.m, 'Aufgabe', 'Aufgaben')}, ${umfang}</p>${aussen}${vNurSchaetzung(aufstellung.nurSchaetzung)}${knopf}</div>`;
}
function vKostenTeilzeile(wort, betrag) {
  return `<p class="kost-zeile kost-teilzeile"><span class="kost-wort">${wort}</span> <span class="kost-betrag">${betrag}</span></p>`;
}
/** Aufgaben mit Schätzung, aber ohne Einträge und ohne alte Posten: nicht gezählt, aber genannt — nie still weggelassen. */
function vNurSchaetzung(anzahl) {
  if (anzahl === 0) return '';
  return `<p class="kost-hinweis kost-schaetz">${anzahl} ${zaehlwort(anzahl, 'Aufgabe', 'Aufgaben')} nur mit Schätzung · nicht gezählt</p>`;
}
function vKostenLeer(bericht, umfang, knopf) {
  return `<div class="kost-leer"><p class="kost-satz">Keine Aufgabe mit angefallenen Kosten · 0 von ${bericht.m} ${zaehlwort(bericht.m, 'Aufgabe', 'Aufgaben')}, ${umfang}</p>${vNurSchaetzung(bericht.nurSchaetzung)}<p class="kost-hinweis">Kosteneinträge legt ein Agent über die API an (<code class="mono">POST /api/aufgaben/{nr}/kosteneintraege</code>).</p><p class="kost-hinweis"><a class="kost-api" href="/api" target="_blank" rel="noopener">API für Agenten</a></p>${knopf}</div>`;
}

/** Bericht „Bestand nach Labels“ (R00100): offene Aufgaben je Paar aus zwei Label-Präfixen — liest nur. */
function vBestand() {
  const kopf = `<div class="leiste"><b>Bestand nach Labels</b> <span class="muted" style="font-size:12px">· liest nur · Klick auf eine Zahl öffnet das Board</span></div>${vBerichtsfilter('bestand')}`;
  if (!S.board) return `${kopf}<div class="body"><div class="leer">lädt …</div></div>`;
  const filter = filterOhneZeitraum(S.ui.bf);
  const achsen = bestandAchsen(filter);
  return `${kopf}<div class="body" id="bestand">${vBestandAchsen(achsen)}${vBestandInhalt(achsen, filter)}</div>`;
}
/** Die Auswahlfelder „Zeilen“ und „Spalten“ mit allen Präfixen der offenen Aufgaben und den gespeicherten; darunter,
    falls die Wahl nur in dieser Ansicht gilt, warum. Ohne Achsen (unter zwei Präfixen) nichts. */
function vBestandAchsen(achsen) {
  const wahl = praefixe(offeneAufgaben(S.aufgaben, S.board)).map(p => p.praefix);
  if (!achsen) return vBestandEinFeld(wahl);
  for (const gespeichert of [achsen.zeilen, achsen.spalten]) if (!wahl.some(p => p.toLowerCase() === gespeichert.toLowerCase())) wahl.push(gespeichert);
  return `<div class="best-achsen" id="bestand-achsen">${vBestandFeld('Zeilen', 'zeilen', wahl, achsen.zeilen)}${vBestandFeld('Spalten', 'spalten', wahl, achsen.spalten)}<button class="btn best-tausch" data-act="bestand-tauschen">⇄ Achsen tauschen</button>${vBestandStatus()}</div>`;
}
/** Unter zwei Präfixen (Artboard D0006): nur „Zeilen“ mit dem vorhandenen Präfix, Tauschen gesperrt; ohne Präfix kein Feld. */
function vBestandEinFeld(wahl) {
  if (!wahl.length) return '';
  return `<div class="best-achsen" id="bestand-achsen">${vBestandFeld('Zeilen', 'zeilen', wahl, wahl[0])}<button class="btn best-tausch" disabled title="Tauschen braucht zwei Präfixe — die offenen Aufgaben haben nur eines">⇄ Achsen tauschen</button></div>`;
}
function vBestandFeld(name, schluessel, wahl, gewaehlt) {
  const optionen = wahl.map(p => `<option value="${esc(p)}"${p.toLowerCase() === gewaehlt.toLowerCase() ? ' selected' : ''}>${esc(p)}</option>`).join('');
  return `<span class="best-feld"><label for="best-${schluessel}">${name}</label><select class="mini-inp best-sel" id="best-${schluessel}" data-bestand="${schluessel}">${optionen}</select></span>`;
}
function vBestandStatus() {
  const lokal = bestandLokal();
  if (lokal && lokal.fehler) return `<span class="best-status fehler" role="status">Achsen nicht gespeichert: ${esc(lokal.fehler)}</span>`;
  if (lokal && lokal.ungespeichert) return '<span class="best-status lokal" role="status">nicht gespeichert — zum Speichern „Ich bin …“ wählen</span>';
  return '';
}
/** Die Wahl dieser Ansicht, solange sie nicht im Board steht — nur für das gewählte Board. */
function bestandLokal() {
  const lokal = S.ui.bestandLokal;
  return lokal && lokal.slug === S.ui.slug ? lokal : null;
}
/** Achsen des Berichts: die Wahl dieser Ansicht, solange sie nicht gespeichert ist, dann die gespeicherte Einstellung des Boards, sonst der Vorschlag aus den offenen Aufgaben nach der
    Filterleiste — lässt die nichts übrig, aus allen offenen, damit ein leerer Filter nicht als fehlende Labels erscheint;
    schreibt nichts. Unter zwei Präfixen null. */
function bestandAchsen(filter) {
  const lokal = bestandLokal();
  if (lokal) return lokal.achsen;
  if (S.board.bestand) return S.board.bestand;
  return vorschlag(praefixe(offeneAufgaben(S.aufgaben, S.board, filter))) || vorschlag(praefixe(offeneAufgaben(S.aufgaben, S.board)));
}
function vBestandInhalt(achsen, filter) {
  if (!achsen) return '<p class="best-leer">Für diese Tabelle braucht das Board Labels mit zwei verschiedenen Präfixen, z. B. repo:shop und nc:304.</p>';
  const klassen = vorrat();
  const tabelle = bestandNachLabels(S.aufgaben, S.board, klassen.map(k => k.schluessel), achsen.zeilen, achsen.spalten, filter);
  if (!tabelle.summen.gesamt) return vBestandLeer(filterAnzahl(filter) > 0);
  return vBestandTabelle(tabelle, achsen, klassen) + vBestandLegende(klassen);
}
/** Legende der Klassen in Dringlichkeitsreihenfolge, „ohne Klasse“ mit leerem Farbfeld wie in der Board-Legende; zeigt nur, filtert nicht. */
function vBestandLegende(klassen) {
  const eintraege = klassen.map(k => `<span class="best-le"><span class="sw" style="${cv(k.farbe)}"></span>${esc(k.bezeichnung)}</span>`).join('');
  return `<div class="leg best-leg" aria-label="Legende"><span class="tt">LEGENDE</span>${eintraege}<span class="best-le"><span class="sw leer"></span>ohne Klasse</span><span class="rechts">zeigt nur, filtert nicht</span></div>`;
}
/** Leerzustand: mit aktiven Filtern der Berichte der Knopf „Zurücksetzen“ (ohne Zahl, PO Z. 77). */
function vBestandLeer(gefiltert) {
  const knopf = gefiltert ? '<button class="btn bf-leeren" data-act="bf-leeren" data-arg="bestand">Zurücksetzen</button>' : '';
  return `<div class="best-leer"><span>Keine offenen Aufgaben, die zu den Filtern der Berichte passen.</span>${knopf}</div>`;
}
function vBestandTabelle(t, achsen, klassen) {
  const zelle = (zeile, spalte, z) => vBestandZelle({ zeile, spalte, zelle: z }, achsen, klassen);
  const kopf = `<tr><th scope="col" class="ecke">${esc(achsen.zeilen)} ↓ · ${esc(achsen.spalten)} →</th>${t.spalten.map(s => `<th scope="col" class="r">${esc(s.wert)}</th>`).join('')}<th scope="col" class="r">Summe</th></tr>`;
  const zeilen = t.zeilen.map((z, i) => `<tr><th scope="row">${esc(z.wert)}</th>${t.spalten.map((s, j) => zelle(z, s, t.zellen[i][j])).join('')}${zelle(z, null, { zahl: t.summen.zeilen[i] })}</tr>`).join('');
  const summen = `<tr class="grp best-summe"><th scope="row">Summe</th>${t.spalten.map((s, j) => zelle(null, s, { zahl: t.summen.spalten[j] })).join('')}${zelle(null, null, { zahl: t.summen.gesamt })}</tr>`;
  return `<div class="best-scroll" id="best-scroll"><table class="pt dicht best-tab" aria-label="Bestand nach Labels: ${esc(achsen.zeilen)} × ${esc(achsen.spalten)}"><thead>${kopf}</thead><tbody>${zeilen}${summen}</tbody></table></div><p class="best-erkl">Eine Zahl öffnet das Board mit diesen Aufgaben. Nicht klickbar sind „(ohne …)“ und die Summen. Das Board übernimmt die Filter der Berichte nicht und zeigt auch die Abschlussspalte.</p>`;
}
/** Eine Stelle der Tabelle: Summe fett, leere Zelle „—“, sonst die Zahl in der Farbe der dringendsten Klasse, mit Zielfilter als Link aufs Board; Name als title und aria-label am Link bzw. an der Zelle. */
function vBestandZelle(stelle, achsen, klassen) {
  const name = esc(zellName(stelle, achsen, klassen)), z = stelle.zelle;
  const benannt = `title="${name}" aria-label="${name}"`;
  if (!stelle.zeile || !stelle.spalte) return `<td class="r num" ${benannt}><b>${z.zahl}</b></td>`;
  if (!z.zahl) return `<td class="r" ${benannt}><span class="muted">—</span></td>`;
  const klasse = klassen.find(k => k.schluessel === z.dringendste);
  const farbe = klasse ? ` style="${cv(klasse.farbe)}"` : '';
  const ziel = zielfilter(stelle, achsen);
  if (!ziel) return `<td class="r${klasse ? ' k' : ''}"${farbe} ${benannt}><span class="bz-t">${z.zahl}</span></td>`;
  return `<td class="r${klasse ? ' k' : ''}"${farbe}><a class="bz" href="#/board/${esc(S.ui.slug || '')}" data-act="bestand-zelle" data-arg="${esc(ziel)}" ${benannt}>${z.zahl}</a></td>`;
}

/* Durchlaufzeit (R00045): Streudiagramm Ankunft × Tage, Median und 85 % als Bezugslinien. „bis“ öffnet mit der Zielspalte des
   Boards, eine abweichende Wahl ist am Gerät gemerkt (R00169, Zeichnung D0006 #fluss-erledigt-heisst). */
/** Der Satz hinter „bis“: die Wahl weicht von „Erledigt heißt“ ab — genannt wird der Block, der auf dem Board zählt — oder
    sie folgt ihm; ohne Zielblock und ohne Abweichung steht nichts. `strecke` kommt aus `durchlaufWahl`. */
function vDurchlaufStand(ziel, strecke) {
  let satz = '';
  if (ziel.worte) satz = `folgt „Erledigt heißt“: ${esc(ziel.worte.lang)}`;
  if (strecke.bisWeichtAb) {
    let zaehlt = ziel.standard;
    if (ziel.zaehlt) zaehlt = ziel.zaehlt.schluessel;
    satz = `weicht ab von „Erledigt heißt“ („${esc(zaehlt)}“) · nur an diesem Gerät`;
  }
  if (!satz) return '';
  return `<span class="muted dl-stand" id="dl-bis-stand">${satz}</span>`;
}
/** Der Weg zurück zur Vorgabe des Boards — nur, wenn am Gerät etwas gemerkt ist (von oder bis weicht ab). */
function vDurchlaufZurueck(strecke) {
  if (!strecke.weichtAb) return '';
  const vorgabe = `von „${esc(strecke.vorgabe.von)}“ bis „${esc(strecke.vorgabe.bis)}“`;
  return `<button type="button" class="btn dl-vorgabe" data-act="dl-vorgabe" aria-label="Zurück zur Vorgabe: ${vorgabe}">Zurück zur Vorgabe</button>`;
}
function vDurchlauf() {
  if (!S.bew) return '<div class="leer">lädt …</div>';
  const sp = S.bew.spalten, u = S.ui;
  const ziel = erledigtHeisst(), strecke = durchlaufWahl(S.bew, ziel.gewaehlt, durchlaufGemerkt()), { von, bis } = strecke;
  const d = durchlaufzeiten(S.bew, u.bf, aufgabe, Date.now(), von, bis, S.board && S.board.start);
  const stand = vDurchlaufStand(ziel, strecke);
  let bisBeschrieben = '';
  if (stand) bisBeschrieben = ' aria-describedby="dl-bis-stand"';
  const wahl = (k, wert, titel, zusatz = '') => `<label class="dl-wahl">${titel} <select class="mini-inp" data-dl="${k}" aria-label="${titel} Spalte"${zusatz}>${sp.map(s => `<option${s === wert ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`;
  const kopf = `<div class="leiste"><b>Durchlaufzeit</b>${wahl('dlVon', von, 'von')}${wahl('dlBis', bis, 'bis', bisBeschrieben)}${stand}${vDurchlaufZurueck(strecke)}<span class="muted">${esc(S.board ? S.board.titel : '')} · erstes Erreichen der Spalte oder einer rechts davon · aus den Commits von boards/${esc(u.slug || '')}.md</span></div>${vBerichtsfilter('durchlaufzeit')}`;
  if (!d.gueltig) return `${kopf}<div class="body bericht"><div class="leer">„von“ muss links von „bis“ liegen.</div></div>`;
  const B = 800, H = 292, L = 40, R = 110, O = 16, U = 40, l = d.liste;
  const t0 = Math.min(...l.map(x => x.ankunft)), t1 = Math.max(...l.map(x => x.ankunft));
  const ymax = Math.max(1, ...l.map(x => x.tage)) * 1.1;
  const sx = t => L + (t1 === t0 ? (B - L - R) / 2 : (t - t0) / (t1 - t0) * (B - L - R)), sy = y => O + (H - O - U) * (1 - y / ymax);
  const schritt = Math.max(1, Math.ceil(ymax / 4)), ticks = [];
  for (let y = 0; y <= ymax; y += schritt) ticks.push(y);
  const xt = t1 === t0 ? [t0] : [0, 1, 2, 3, 4].map(i => t0 + (t1 - t0) * i / 4);
  const bezug = (wert, cls, text) => `<line class="${cls}" x1="${L}" x2="${B - R}" y1="${sy(wert)}" y2="${sy(wert)}"></line><text class="endwert leise" x="${B - R + 8}" y="${sy(wert) + 4}">${text} ${zahl1(wert)} T</text>`;
  const punktText = x => { const a = aufgabe(x.nummer); return `#${x.nummer} ${a ? a.titel : ''} · ${zahl1(x.tage)} Tage`; };
  S.diagrammTip = tg => { const da = l.filter(x => isoTag(isoD(x.ankunft)) === tg); return `<b>Ankunft ${datumMitWochentag(tg)}</b><span>${da.length ? `${da.length} ${da.length === 1 ? 'Aufgabe' : 'Aufgaben'} angekommen` : 'keine Aufgabe angekommen'}</span>${da.map(x => `<span>${esc(punktText(x))}</span>`).join('')}`; };
  const svg = l.length ? `<svg class="diagramm streu" viewBox="0 0 ${B} ${H}" role="img" aria-label="Durchlaufzeit je Aufgabe nach Ankunftstag" ${achsAttribut(L, B - L - R, t0, t1, true)}>
${ticks.map(y => `<line class="gitter" x1="${L}" x2="${B - R}" y1="${sy(y)}" y2="${sy(y)}"></line><text class="achse" x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`).join('')}
${xt.map(t => achsDatum(t, sx(t), H - U + 18)).join('')}
${bezug(d.p85, 'p85', '85 %')}${bezug(d.median, 'median', 'Median')}
${fadenkreuz(O, H - U)}
${l.map(x => `<circle class="punkt klick" cx="${sx(x.ankunft).toFixed(1)}" cy="${sy(x.tage).toFixed(1)}" r="5" data-act="oeffnen" data-arg="${x.nummer}" aria-label="${esc(punktText(x))} · angekommen ${datumMitWochentag(x.ankunft)}"></circle>`).join('')}
</svg>` : '<div class="leer">Keine Aufgabe hat im Zeitraum „bis“ erreicht.</div>';
  const kennzahlen = `<div class="kennzahlen" id="durchlauf-kennzahl"><span><b>${d.anzahl}</b> Aufgaben</span><span>Mittel <b>${zahl1(d.mittel)}</b> T</span><span>Median <b>${zahl1(d.median)}</b> T</span><span>85 % in <b>${zahl1(d.p85)}</b> T oder weniger</span></div>`;
  const tabelle = `<table class="pt dicht" id="durchlauf"><thead><tr><th>Aufgabe</th><th>in „${esc(von)}“</th><th>in „${esc(bis)}“</th><th class="r">Tage</th></tr></thead><tbody>${l.map(x => { const a = aufgabe(x.nummer); return `<tr class="klick" data-act="oeffnen" data-arg="${x.nummer}" data-halt="zeile:${x.nummer}" tabindex="0"><td class="tt"><span class="mono muted">#${x.nummer}</span> ${esc(a ? a.titel : '')}</td><td class="mono">${zeitpunktAusMs(x.eintritt)}</td><td class="mono">${zeitpunktAusMs(x.ankunft)}</td><td class="r num">${zahl1(x.tage)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>`;
  const legende = '<div class="dlegende"><span><i class="k-punkt"></i>eine Aufgabe</span><span><i class="k-median"></i>Median</span><span><i class="k-p85"></i>85 %</span></div>';
  return `${kopf}<div class="body bericht">${kennzahlen}<h2 class="dtitel">Tage je Aufgabe nach Ankunft in „${esc(bis)}“</h2>${legende}${l.length ? vDiagrammFlaeche(svg) : svg}<h2 class="dtitel">Aufgaben</h2>${berichtRahmen('Aufgaben')}${tabelle}</div></div>`;
}

/* Wie lange noch (R00046): je Spalte noch nicht erreicht, Monte-Carlo-Fächer, Blöcke mit Perzentilen.
   Serienfarben: Slots 1–3 der validierten dataviz-Palette, feste Reihenfolge von links nach rechts. */
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
  const zielKnopf = (t, i) => `<button class="btn btn-sym tm-ziel${t.ziel ? ' an' : ''}" data-act="tf-ziel" data-arg="${i}" aria-pressed="${!!t.ziel}" aria-label="Termin ${esc(t.name)} ist Zieltermin" title="${t.ziel ? 'Zieltermin des Fever Charts — Klick nimmt die Markierung zurück' : 'als Zieltermin des Fever Charts markieren'}">${t.ziel ? '◉' : '○'}</button>`;
  const zeilen = termine.map((t, i) => `<tr data-termin="${esc(t.name)}"><td>${zielKnopf(t, i)}</td><td><svg class="tm-vorschau" viewBox="0 0 44 10" aria-hidden="true"><line x1="2" x2="42" y1="5" y2="5" style="${terminStil(t)}"></line></svg></td><td>${esc(t.name)}</td><td class="mono">${datumMitWochentag(isoTag(t.datum))}</td><td>${fertig ? esc(chanceText(terminChance(fertig, t.datum, Date.now()))) : '—'}</td><td class="r"><button class="btn btn-sym" data-act="tf-bearbeiten" data-arg="${i}" aria-label="Termin ${esc(t.name)} ändern" title="ändern">✎</button><button class="btn btn-sym" data-act="tf-entfernen" data-arg="${i}" aria-label="Termin ${esc(t.name)} entfernen" title="entfernen">✕</button></td></tr>`).join('');
  const wahl = (feld, werte, titel) => `<select class="mini-inp" data-tf="${feld}" aria-label="${titel}">${werte.map(([k, t]) => `<option value="${k}"${f[feld] === k ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const FARBNAMEN = { yellow: 'gelb', amber: 'bernstein', orange: 'orange', red: 'rot', rose: 'rosé', pink: 'pink', magenta: 'magenta', violet: 'violett', indigo: 'indigo', blue: 'blau', sky: 'himmelblau', cyan: 'cyan', teal: 'petrol', green: 'grün', lime: 'limette', grey: 'grau' };
  const farben = PAL.map(x => [x, FARBNAMEN[x] || x]);
  if (f.farbe.startsWith('#')) farben.push([f.farbe, f.farbe]);
  const formular = `<div class="tm-form" role="group" aria-label="${f.i == null ? 'Neuer Termin' : 'Termin ändern'}"><input class="mini-inp" data-tf="name" value="${esc(f.name)}" placeholder="Name, z. B. Deadline" aria-label="Name des Termins"><input type="date" class="mini-inp" data-tf="datum" value="${esc(f.datum)}" aria-label="Datum des Termins">${wahl('farbe', farben, 'Farbe des Termins')}<input class="mini-inp tm-hex" data-tf="hex" value="${f.farbe.startsWith('#') ? esc(f.farbe) : ''}" placeholder="#rrggbb" aria-label="Eigene Farbe des Termins">${wahl('linie', [['durchgehend', 'durchgehend'], ['gestrichelt', 'gestrichelt'], ['gepunktet', 'gepunktet']], 'Linie des Termins')}${wahl('staerke', [['fein', 'fein'], ['normal', 'normal'], ['fett', 'fett']], 'Stärke des Termins')}<svg class="tm-vorschau" viewBox="0 0 44 10" aria-label="Vorschau"><line x1="2" x2="42" y1="5" y2="5" style="${terminStil(f)}"></line></svg><button class="btn btn-haupt" data-act="tf-speichern">${f.i == null ? 'Termin anlegen' : 'Übernehmen'}</button>${f.i == null ? '' : '<button class="btn" data-act="tf-abbrechen">Abbrechen</button>'}${u.tfFehler ? `<span class="fehl" role="alert">${esc(u.tfFehler)}</span>` : ''}</div>`;
  return `<section class="wl-termine"><h2 class="dtitel">Termine <span class="muted">· stehen in boards/${esc(u.slug || '')}.md, für alle sichtbar</span></h2>${termine.length ? `<table class="pt dicht" id="termine"><thead><tr><th title="Zieltermin des Projekt-Fever-Charts">Ziel</th><th>Linie</th><th>Name</th><th>Datum</th><th>Chance „${esc(fertig ? fertig.schluessel : '')}“</th><th></th></tr></thead><tbody>${zeilen}</tbody></table>` : '<p class="muted">Noch keine Termine — etwa eine Deadline als fette rote Linie.</p>'}${formular}</section>`;
}
/* Ein Block heißt je Spalte „erreicht“, je Phase (R00058) „durchlaufen“. */
const blockOffen = ph => ph.phase ? `„${ph.phase}“ noch nicht durchlaufen` : `noch nicht in „${ph.spalte}“`;
const blockStand = ph => ph.phase ? `${ph.phase} durchlaufen ${ph.erreicht} von ${ph.nenner}` : `„${ph.spalte}“ ${ph.erreicht} von ${ph.nenner} erreicht`;
function vPrognose() {
  if (!S.bew) return '<div class="leer">lädt …</div>';
  const jetzt = Date.now(), p = prognose(S.bew, S.ui.bf, aufgabe, jetzt, S.bew.phasen, { start: S.board && S.board.start }), u = S.ui;
  const stand = new Date(jetzt).toTimeString().slice(0, 8);
  const kopf = `<div class="leiste"><b>Wie lange noch</b><span class="muted">${esc(S.board ? S.board.titel : '')} · Stand ${datumMitWochentag(jetzt)} ${stand} · <span class="live-punkt" title="rechnet neu, sobald sich das Board ändert"></span>live</span></div>${vBerichtsfilter('wieLangeNoch')}`;
  if (!p.phasen.length) return `${kopf}<div class="body bericht"><div class="leer">Es braucht mindestens zwei gezählte Spalten.</div></div>`;
  const fertig = p.phasen[p.phasen.length - 1];
  const zahlen = `<p class="wl-kopf" id="wl-kopf"><strong>${fertig.erreicht} von ${fertig.nenner} fertig</strong>${p.phasen.slice(0, -1).map(ph => ` · ${esc(blockStand(ph))}`).join('')}</p>`;
  // Diagramm: höchstens drei Serien, die rechten Spalten (nahe „fertig“)
  const auswahl = diagrammBloecke(p.phasen), serien = auswahl.gezeigt.map((ph, i) => ({ ph, k: 'wl-s' + (i + 1) }));
  const W = 960, H = 412, L = 48, R = 24, O = 24, U = 52, pw = W - L - R, ph_ = H - O - U;
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
    const pts = p.tage.map(d => [d.t, d.offen[s.ph.schluessel]]);
    linien += `<path class="wl-offen ${s.k}" d="${pfad(pts)}"></path>`;
    marken += `<circle class="wl-mk ${s.k}" cx="${x(p.heute).toFixed(1)}" cy="${y(s.ph.offen).toFixed(1)}" r="4"></circle>`;
    if (!s.ph.zeilen) return;
    const z = Object.fromEntries(s.ph.zeilen.map(r => [r.p, r]));
    const x0 = x(p.heute), y0 = y(s.ph.offen), y1 = y(0);
    faecher += `<polygon class="wl-band ${s.k}" points="${x0.toFixed(1)},${y0.toFixed(1)} ${x(z[50].datum7).toFixed(1)},${y1} ${x(z[95].datum7).toFixed(1)},${y1}"></polygon>`;
    [[50, 'wl-p50'], [85, 'wl-p85'], [95, 'wl-p95']].forEach(([q, cls], stufe) => {
      const xe = x(z[q].datum7), rand = xe > W - R - 80;
      faecher += `<line class="${cls} ${s.k}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${xe.toFixed(1)}" y2="${y1}"></line><text class="wl-lbl" x="${(rand ? W - 2 : xe).toFixed(1)}" y="${(y1 - 8 - 13 * stufe - 42 * si).toFixed(1)}" text-anchor="${rand ? 'end' : 'middle'}">${esc(s.ph.schluessel.slice(0, 10))} P${q} ${datumAusMs(z[q].datum7)}</text>`;
    });
  });
  // Tooltip: bis heute die gezählten Stände, danach je Spalte die Chance, bis zu diesem Tag fertig zu sein
  const bisDahin = ph => ph.phase ? `„${ph.phase}“ durchlaufen bis dahin` : `„${ph.spalte}“ erreicht bis dahin`;
  S.diagrammTip = tg => {
    const d = p.tage.find(x => x.t === tg), kopf = `<b>${datumMitWochentag(tg)}${tg === p.heute ? ' (heute)' : ''}</b>`;
    const amTag = termine.filter(t => isoTag(t.datum) === tg).map(t => `<span>Termin: ${esc(t.name)}</span>`).join('');
    if (d) return kopf + [`Umfang ${d.umfang}`, ...p.phasen.map(ph => `${blockOffen(ph)}: ${d.offen[ph.schluessel]}`)].map(z => `<span>${esc(z)}</span>`).join('') + amTag;
    if (tg < p.heute) return kopf + amTag;
    return kopf + p.phasen.map(ph => `<span>${esc(bisDahin(ph))}: ${esc(chanceText(terminChance(ph, isoD(tg), jetzt)))}</span>`).join('') + amTag;
  };
  const svg = `<svg class="diagramm wl" viewBox="0 0 ${W} ${H}" role="img" aria-label="Noch nicht erreichte Aufgaben je Spalte mit Prognose" ${achsAttribut(L, pw, t0, t1)}>
${yt.map(v => `<line class="gitter" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"></line><text class="achse" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
${xt.map(t => achsDatum(t, x(t).toFixed(1), H - U + 18)).join('')}
<path class="umfang" d="${pfad(p.tage.map(d => [d.t, d.umfang]))}"></path>
${faecher}${linien}${marken}
<line class="wl-heute" x1="${x(p.heute)}" x2="${x(p.heute)}" y1="${O}" y2="${H - U}"></line><text class="wl-lbl" x="${x(p.heute) + 4}" y="${O + 10}">heute</text>
${termine.filter(t => isoTag(t.datum) >= t0 && isoTag(t.datum) <= t1).map((t, i) => { const xt = x(isoTag(t.datum)), rechts = xt > W - R - 140; return `<g class="wl-termin" data-termin="${esc(t.name)}"><line x1="${xt.toFixed(1)}" x2="${xt.toFixed(1)}" y1="${O}" y2="${H - U}" style="${terminStil(t)}"></line><text class="wl-tlbl" x="${(xt + (rechts ? -5 : 5)).toFixed(1)}" y="${O + 26 + 14 * (i % 4)}" text-anchor="${rechts ? 'end' : 'start'}">${esc(t.name)} ${datumAusMs(isoTag(t.datum))}</text></g>`; }).join('')}
${fadenkreuz(O, H - U)}
</svg>`;
  const legende = `<div class="dlegende wl-legende"><span><i class="k-umfang"></i>Umfang</span>${serien.map(s => `<span><i class="wl-k ${s.k}"></i>${esc(blockOffen(s.ph))} — ${s.ph.zeilen ? 'Prognose P50 · P85 gestrichelt · P95 gepunktet' : 'keine Prognose'}</span>`).join('')}${auswahl.ohnePrognose.length ? `<span class="muted" id="wl-ohne">ohne Prognose (unter ${MIN_LAEUFE} Läufen in der Messbasis): ${esc(auswahl.ohnePrognose.map(ph => ph.schluessel).join(', '))}</span>` : ''}</div>`;
  const tabelle = `<details class="tabellenansicht"><summary data-halt="klappe:tabelle-prognose">Tabellenansicht</summary><table class="pt dicht"><thead><tr><th>Tag</th><th class="r">Umfang</th>${p.phasen.map(ph => `<th class="r">${esc(blockOffen(ph))}</th>`).join('')}</tr></thead><tbody>${p.tage.map(d => `<tr><td class="mono">${datumAusMs(d.t)}</td><td class="r num">${d.umfang}</td>${p.phasen.map(ph => `<td class="r num">${d.offen[ph.schluessel]}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
  const bloecke = p.phasen.map(ph => {
    const anteil = ph.nenner ? ph.erreicht / ph.nenner : 1, wort = ph.phase ? 'DURCHLAUFEN' : 'ERREICHT';
    const kopfzeile = `<div class="wl-phase-kopf"><h3>${esc(ph.titel)} <span class="wl-badge">${ph.erreicht} VON ${ph.nenner} ${wort}</span></h3><div class="wl-fortschritt" role="img" aria-label="${Math.round(100 * anteil)} Prozent ${wort.toLowerCase()}"><i style="width:${Math.round(100 * anteil)}%"></i></div></div>`;
    const reihe = ph.reihe7.length > 60 ? '… ' + ph.reihe7.slice(-60).join(' ') : ph.reihe7.join(' ');
    const messung = ph.laeufe ? `<p class="sek">Durchsatz Ø ${zahl1(ph.durchsatz)} je Kalendertag aus ${ph.laeufe} ${ph.laeufe === 1 ? 'Lauf' : 'Läufen'} · Tagesreihe: <span class="mono">${reihe}</span></p>` : '';
    let inhalt;
    if (!ph.offen) inhalt = `<p>Alle ${ph.nenner} Aufgaben haben ${ph.phase ? `„${esc(ph.phase)}“ durchlaufen` : `„${esc(ph.spalte)}“ erreicht`}.</p>`;
    else if (!ph.zeilen) inhalt = `<p>${ph.offen} offen — keine Prognose unter ${MIN_LAEUFE} Läufen in der Messbasis (gemessen: ${ph.laeufe}).</p>`;
    else inhalt = `<div class="wl-scroll"><table class="pt dicht wl-tab"><thead><tr><th>Mit X % Wkt.</th><th>Fertig zum, 7-Tage-Woche</th><th>Fertig zum, 5-Tage-Woche</th><th>Restliche Dauer</th><th>Nicht vor (${p.nachPhasen ? 'Vorphase' : 'Spalte links'})</th></tr></thead><tbody>${ph.zeilen.map(z => `<tr><td>${z.p} %</td><td>${datumMitWochentag(z.datum7)}</td><td>${datumMitWochentag(z.datum5)}</td><td>${z.kalendertage} Kalendertage · ${z.arbeitstage} Arbeitstage</td><td>${z.untergrenze7 ? datumMitWochentag(z.untergrenze7) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
    // Zugang gegen Abgang (R00168): nur in Blöcken mit Prognose; der Abgang ist die Zahl aus „Durchsatz Ø“
    const hinweis = zugangGegenAbgang(ph);
    let mittel = '', keinEnde = '';
    if (hinweis) mittel = `<p class="sek">Zugang Ø ${zahl1(hinweis.zugangJeTag)}, Abgang Ø ${zahl1(hinweis.abgangJeTag)} je Kalendertag in der Messbasis.</p>`;
    if (hinweis && hinweis.keinEndeAbsehbar) keinEnde = '<p>Bei diesem Zugang kein Ende absehbar: Die Prognose rechnet nur mit den heute offenen Aufgaben.</p>';
    const mitZugang = vMitZugang(ph);
    const termin = termine.length ? `<ul class="wl-tchance">${termine.map(t => `<li><svg class="tm-vorschau" viewBox="0 0 44 10" aria-hidden="true"><line x1="2" x2="42" y1="5" y2="5" style="${terminStil(t)}"></line></svg>${esc(t.name)} · bis ${datumMitWochentag(isoTag(t.datum))}: <b>${esc(chanceText(terminChance(ph, t.datum, jetzt)))}</b></li>`).join('')}</ul>` : '';
    return `<section class="wl-phase" style="--anteil:${anteil}" ${ph.phase ? `data-phase="${esc(ph.phase)}"` : `data-spalte="${esc(ph.spalte)}"`}>${kopfzeile}${inhalt}${keinEnde}${mitZugang}${termin}${messung}${mittel}</section>`;
  }).join('');
  const ohneBoard = S.aufgaben.filter(a => !a.archiviert && !(S.boards || []).some(b => b.spalten.some(sp => sp.aufgaben.includes(a.nummer)))).length;
  const aufBoard = S.board ? S.board.spalten.reduce((s, sp) => s + sp.aufgaben.length, 0) : 0;
  const nicht = `<h2 class="dtitel">Nicht enthalten</h2><ul class="wl-liste"><li>Aufgaben ohne Board: ${ohneBoard}.</li><li>Auf diesem Board, aber ausgeschlossen (Spalte, Farbe, Person, Label): ${Math.max(0, aufBoard - p.umfang - p.verworfen - p.ausgenommen)}.</li><li>Archiviert außerhalb der Abschlussspalte (gelten als verworfen): ${p.verworfen}.</li><li id="wl-ausgenommen">Ausgenommen (<span class="mono">reporting.forecast: false</span>): ${p.ausgenommen}.</li></ul>`;
  const methodik = `<h2 class="dtitel">Lesehinweise und Methodik</h2><ul class="wl-liste"><li>Quelle: die Git-Geschichte von <span class="mono">boards/${esc(u.slug || '')}.md</span>; jede Bewegung ist ein Commit. Der Bericht rechnet neu, sobald sich das Board ändert.</li>${p.nachPhasen ? `<li>Das Board ist an die Anwendung „${esc(S.bew.phasen.anwendung)}“ gebunden; gerechnet wird je Phase (${esc(S.bew.phasen.folge.map(x => x.name).join(' → '))}), nicht je Spalte. Eine Aufgabe hat eine Phase durchlaufen, sobald sie in einer Spalte einer späteren Phase oder in der Abschlussspalte liegt oder lag; zwei Spalten derselben Phase sind gleich weit. Im Durchsatz zählt das erste Durchlaufen, offen ist, was heute noch nicht so weit ist (ein Zug nach links öffnet die Phase wieder). „Gleich wie“ fällt mit der genannten Phase zusammen, „eingebettet in“ gilt mit der Vorphase, wenn die Aufgabe das Label trägt; <span class="mono">phases.skipped</span> nimmt eine Aufgabe aus Zähler, Nenner und Durchsatz der Phase.</li>` : '<li>Eine Aufgabe hat eine Spalte erreicht, sobald sie dort oder rechts davon liegt; es zählt das erste Erreichen. Je Spalte (außer der ersten) eine Kurve „noch nicht erreicht“.</li>'}<li>Prognose: ${(10000).toLocaleString('de-DE')} Ziehungen mit Zurücklegen aus der Tagesreihe der Spalte (erreichte Aufgaben je Kalendertag in der Messbasis: die letzten ${u.bf.messbasisTage} Tage, nie vor „Rechnen ab“ und nie vor der ersten Aufgabe auf dem Board; Nulltage eingeschlossen), bis die offenen Aufgaben erreicht sind; Perzentile über die gezogenen Tage. Kein Puffer, kein Zuschlag. Eine Spalte wird nie früher prognostiziert als die Spalte links davon — deren Datum steht als Untergrenze dabei, nicht verrechnet.</li><li>Zugang: Aufgaben, die in der Messbasis offen wurden (neu oder zurückgeholt), abzüglich der entfernten; Abgang ist der Durchsatz. Die Prognose rechnet ohne Zugang.</li><li>Mit Zugang wie in der Messbasis: dieselben Ziehungen, dazu je Tag ein Zugang, gezogen aus dem Zugang je Kalendertag (bzw. Werktag) derselben Messbasis — hinzugekommen minus entfernt, je Tag nie unter 0. Zugang wie in der Messbasis, ohne Rückläufer-Sonderbehandlung, gleichbleibend; deshalb nie früher als die Prognose ohne Zugang. Bei hohem Zugang kann sie kein Ende finden: nach 365 gezogenen Tagen steht „kein Ende innerhalb von 365 Tagen“. Die Tabelle steht nur bei einem Zugang über 0.</li><li>5-Tage-Woche: Tagesreihe nur über Werktage (Ankünfte am Wochenende zählen zum nächsten Werktag), gezählt ab heute nur Mo bis Fr.</li><li>Termine: Anteil der Ziehungen, die bis zum Termin fertig sind — in der 7-Tage-Woche nach Kalendertagen, in der 5-Tage-Woche nach Werktagen bis einschließlich Termin.</li><li>Unter ${MIN_LAEUFE} Läufen in der Messbasis gibt es keine Perzentile. Das Diagramm zeigt höchstens drei Spalten farbig: die rechten mit Prognose — ungemessene rechts davon nennt die Legende; die Tabellenansicht und die Blöcke führen jede Spalte.</li></ul>`;
  return `${kopf}<div class="body bericht wl-seite">${zahlen}<div class="wl-panel"><h2 class="dtitel">Noch nicht erreicht je Spalte, mit Prognose-Fächer</h2>${legende}${vDiagrammFlaeche(svg, ' wl-flaeche')}${tabelle}</div>${vTermine(p)}${bloecke}${nicht}${methodik}</div>`;
}

/** Zweite Tabelle eines Blocks (R00193): die Prognose mit Zugang wie in der Messbasis, Spalten wie die erste ohne „Nicht vor“;
    ohne `mitZugang` (Zugang 0, keine Prognose) nichts. */
function vMitZugang(ph) {
  if (!ph.mitZugang) return '';
  const KEIN_ENDE = 'kein Ende innerhalb von 365 Tagen';
  const datum = ms => ms === null ? KEIN_ENDE : datumMitWochentag(ms);
  const dauer = (tage, einheit) => tage === null ? `über 365 ${einheit}` : `${tage} ${einheit}`;
  const zeilen = ph.mitZugang.map(z => `<tr><td>${z.p} %</td><td>${datum(z.datum7)}</td><td>${datum(z.datum5)}</td><td>${dauer(z.kalendertage, 'Kalendertage')} · ${dauer(z.arbeitstage, 'Arbeitstage')}</td></tr>`).join('');
  return `<div class="wl-mit-zugang"><p><strong>Mit Zugang wie in der Messbasis</strong></p><div class="wl-scroll"><table class="pt dicht wl-tab"><thead><tr><th>Mit X % Wkt.</th><th>Fertig zum, 7-Tage-Woche</th><th>Fertig zum, 5-Tage-Woche</th><th>Restliche Dauer</th></tr></thead><tbody>${zeilen}</tbody></table></div></div>`;
}

/* ── Projekt-Fever-Chart (R00078): Fortschritt (x) gegen Pufferverbrauch (y) je Tag, vor schräg begrenzten Zonen ── */
const ZONENNAME = { gruen: 'grün', gelb: 'gelb', rot: 'rot', schwarz: 'schwarz — Puffer überzogen' };
/** Start, Cache-Schlüssel, Einstellungen und alle Tage (Cache, frisch gerechnet, heute live) des gewählten Boards. */
function fieberStand() {
  if (!S.bew || !S.board) return null;
  const start = S.board.start || ersterTag(S.bew);
  if (!start) return { start: null };
  // Zielspalte (R00079): ein Block aus „Wie lange noch“; gibt es ihn nicht mehr, gilt der letzte
  const f = S.board.fieber, { bloecke, block, zaehlt, verschwunden, ausgeschlossen } = zielblock(S.bew, S.ui.bf, f.zielspalte);
  const schluessel = fieberSchluessel(start, S.ui.bf, block && block.schluessel);
  const zielTermin = (S.board.termine || []).find(t => t.ziel) || null;
  const cache = ((S.fieberCache && S.fieberCache.abschnitte || []).find(a => a.schluessel === schluessel) || {}).tage || [];
  const neu = S.ui.fieberNeu && S.ui.fieberNeu.schluessel === schluessel ? Object.values(S.ui.fieberNeu.tage) : [];
  const tage = new Map([...cache, ...neu].map(t => [t.datum, t]));
  const heute = isoD(Date.now());
  if (start <= heute) tage.set(heute, fieberTag(S.bew, S.ui.bf, aufgabe, heute, S.bew.phasen, start, block && block.schluessel));
  const e = { start, ziel: zielTermin && zielTermin.datum, puffer: f.puffer, woche: f.woche, perzentil: f.perzentil, gelb: f.gelb, rot: f.rot };
  return { start, schluessel, zielTermin, e, cache, tage: [...tage.values()], heute, bloecke, block, zaehlt, verschwunden, ausgeschlossen };
}
function vFieber() {
  if (!S.bew || !S.fieberCache) return '<div class="leer">lädt …</div>';
  const u = S.ui, st = fieberStand(), b = S.board, f = b.fieber, jetzt = Date.now();
  const kopf = `<div class="leiste"><b>Projekt-Fever-Chart</b><span class="muted">${esc(b.titel)} · Stand ${datumMitWochentag(jetzt)} · <span class="live-punkt" title="rechnet neu, sobald sich das Board ändert"></span>live</span></div>${vBerichtsfilter('fieber')}`;
  if (!st.start) return `${kopf}<div class="body bericht"><div class="leer">Noch keine Aufgabe auf diesem Board — ohne Start kein Projekt.</div></div>`;
  const einheit = f.woche === 5 ? 'Arbeitstage' : 'Kalendertage', plan = fieberPlan(st.e);
  const termine = b.termine || [];
  const zahl = (k, i, titel) => `<input type="number" class="mini-inp fb-zahl" min="0" max="1000" data-fb="${k}${i}" value="${f[k][i]}" aria-label="${titel}">`;
  const einst = `<section class="fb-einst" role="group" aria-label="Einstellungen des Fever Charts">
<label>Zieltermin <select class="mini-inp" data-fb="ziel" aria-label="Zieltermin"><option value="">— wählen —</option>${termine.map((t, i) => `<option value="${i}"${t.ziel ? ' selected' : ''}>${esc(t.name)} · ${datumAusMs(isoTag(t.datum))}</option>`).join('')}</select></label>
<label>Puffer <input type="number" class="mini-inp fb-zahl" min="1" data-fb="puffer" value="${f.puffer == null ? '' : f.puffer}" aria-label="Puffer in Tagen"> ${einheit}</label><button class="btn" data-act="fb-vorschlag" title="1/3 der Gesamtdauer — die CCPM-Regel „Puffer = 50 % der Kette“"${st.e.ziel ? '' : ' disabled'}>Puffer vorschlagen</button>
${vZielAuswahl(st)}
<label>Perzentil <select class="mini-inp" data-fb="perzentil" aria-label="Perzentil der Prognose">${PERZENTILE.map(q => `<option value="${q}"${q === f.perzentil ? ' selected' : ''}>P${q}</option>`).join('')}</select></label>
<label>Auflösung <select class="mini-inp" data-fb="aufloesung" aria-label="Auflösung">${[[1, 'Tag'], [7, 'Woche (alle 7 T)'], [30, 'Monat (30 T)']].map(([n, t]) => `<option value="${n}"${n === (f.aufloesung || 1) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label>Einheit <select class="mini-inp" data-fb="woche" aria-label="Einheit"><option value="5"${f.woche === 5 ? ' selected' : ''}>Arbeitstage</option><option value="7"${f.woche === 7 ? ' selected' : ''}>Kalendertage</option></select></label>
<details class="fb-zonen"><summary data-halt="klappe:zonengrenzen">Zonengrenzen</summary><span>Gelb ab ${zahl('gelb', 0, 'Gelb ab bei 0 % Fortschritt')} % → ${zahl('gelb', 1, 'Gelb ab bei 100 % Fortschritt')} %</span><span>Rot ab ${zahl('rot', 0, 'Rot ab bei 0 % Fortschritt')} % → ${zahl('rot', 1, 'Rot ab bei 100 % Fortschritt')} %</span><span class="muted">Verbrauch bei 0 % und bei 100 % Fortschritt, gerade dazwischen; über 100 % schwarz</span></details>
${u.fbFehler ? `<span class="fehl" role="alert">${esc(u.fbFehler)}</span>` : ''}${vZielHinweis(st.verschwunden, st.zaehlt ? st.zaehlt.schluessel : '', st.ausgeschlossen)}</section>`;
  const lauf = u.fieberLauf && u.fieberLauf.schluessel === st.schluessel;
  const status = `<p class="muted fb-status" id="fieber-lauf">${lauf ? `rechnet ${u.fieberLauf.n} von ${u.fieberLauf.von} ${zaehlwort(u.fieberLauf.von, 'Tag', 'Tagen')} …` : `${st.cache.length} ${st.cache.length === 1 ? 'Tag' : 'Tage'} aus dem Cache <span class="mono">berichte/${esc(u.slug)}-fieber.md</span> · heute live gerechnet`} <button class="btn" data-act="fb-verwerfen" title="löscht den Cache dieses Boards und rechnet alle Tage neu">Cache verwerfen und neu rechnen</button></p>`;
  let inhalt;
  if (!st.zielTermin) inhalt = `<div class="leer" id="fb-hinweis">Wähle einen Zieltermin${termine.length ? ' oben' : ' — lege dazu in <a href="#/berichte/prognose">Wie lange noch</a> einen Termin an'}.</div>`;
  else if (!f.puffer) inhalt = `<div class="leer" id="fb-hinweis">Der Puffer fehlt — „Puffer vorschlagen“ setzt 1/3 der Gesamtdauer (${pufferVorschlag(dauerIn(f.woche, st.start, st.e.ziel))} ${einheit}).</div>`;
  else if (plan.fehler) inhalt = `<div class="leer" id="fb-hinweis">${esc(plan.fehler)}.</div>`;
  else inhalt = vFieberDiagramm(st, plan, einheit);
  return `${kopf}<div class="body bericht fb-seite">${einst}${status}${inhalt}${vFieberMethodik()}</div>`;
}
function vFieberDiagramm(st, plan, einheit) {
  const e = st.e, punkte = fieberAusduennen(fieberPunkte(st.tage, e), S.board.fieber.aufloesung || 1), titel = S.board.titel;
  const kennzahl = `<div class="kennzahlen" id="fb-kennzahl"><span>erledigt = <b>${esc(st.zaehlt ? st.zaehlt.titel : '')}</b></span><span>Gesamtdauer <b>${plan.gesamt}</b> ${einheit}</span><span>Arbeitsbereich <b>${plan.arbeit}</b> bis ${datumMitWochentag(isoTag(plan.planende))}</span><span>Puffer <b>${plan.puffer}</b></span><span>Zieltermin <b>${datumAusMs(isoTag(e.ziel))}</b></span></div>`;
  if (!punkte.length) {
    const b = prognose(S.bew, S.ui.bf, aufgabe, Date.now(), S.bew.phasen, { start: e.start, nurLetzter: true, block: st.block && st.block.schluessel }).phasen[0];
    return `${kennzahl}<div class="leer" id="fb-hinweis">Noch keine Prognose — sie braucht ${MIN_LAEUFE} erledigte Aufgaben in der Messbasis${b ? `, bisher ${b.laeufe}` : ''}.</div>`;
  }
  const W = 960, H = 500, L = 56, R = 24, O = 16, U = 44, pw = W - L - R, ph = H - O - U;
  const bs = punkte.map(x => x.b);
  // Achse wächst mit den Werten bis ±1000 %; die Schrittweite hält die Beschriftungen bei höchstens zwölf
  const roh = [Math.min(-20, Math.min(...bs) - 5), Math.max(120, Math.max(...bs) + 10)];
  const schritt = [10, 20, 25, 50, 100, 200, 250].find(n => (Math.min(1000, roh[1]) - Math.max(-1000, roh[0])) / n <= 12) || 500;
  const ymin = Math.max(-1000, Math.floor(roh[0] / schritt) * schritt), ymax = Math.min(1000, Math.ceil(roh[1] / schritt) * schritt);
  const x = p => L + pw * p / 100, y = v => O + ph * (ymax - Math.max(ymin, Math.min(ymax, v))) / (ymax - ymin), f1 = n => n.toFixed(1);
  const poly = (cls, pts) => `<polygon class="fb-zone ${cls}" points="${pts.map(([p, v]) => `${f1(x(p))},${f1(O + ph * (ymax - v) / (ymax - ymin))}`).join(' ')}"></polygon>`;
  const [g0, g1] = e.gelb, [r0, r1] = e.rot;
  const zonen = poly('gruen', [[0, ymin], [100, ymin], [100, g1], [0, g0]]) + poly('gelb', [[0, g0], [100, g1], [100, r1], [0, r0]]) + poly('rot', [[0, r0], [100, r1], [100, ymax], [0, ymax]]) + (ymax > 100 ? `<rect class="fb-zone schwarz" x="${L}" y="${O}" width="${pw}" height="${f1(y(100) - O)}"></rect>` : '');
  const yt = []; for (let v = Math.ceil(ymin / schritt) * schritt; v <= ymax; v += schritt) yt.push(v);
  if (!yt.includes(100) && ymax >= 100) yt.push(100);
  const gitter = yt.map(v => `<line class="gitter${v === 0 || v === 100 ? ' fb-marke' : ''}" x1="${L}" x2="${W - R}" y1="${f1(y(v))}" y2="${f1(y(v))}"></line><text class="achse" x="${L - 8}" y="${f1(y(v) + 4)}" text-anchor="end">${v} %</text>`).join('') + [0, 25, 50, 75, 100].map(p => `<line class="gitter" x1="${f1(x(p))}" x2="${f1(x(p))}" y1="${O}" y2="${H - U}"></line><text class="achse" x="${f1(x(p))}" y="${H - U + 18}" text-anchor="middle">${p} %</text>`).join('');
  const zonenText = `<text class="fb-ztext" x="${W - R - 6}" y="${f1(y(ymin) - 8)}" text-anchor="end">GRÜN</text><text class="fb-ztext" id="fb-vorplan" x="${L + 6}" y="${f1(y(0) + 16)}">VOR PLAN — PUFFER GEWONNEN</text><text class="fb-ztext" x="${W - R - 6}" y="${f1(y((g1 + r1) / 2) + 4)}" text-anchor="end">GELB</text><text class="fb-ztext" x="${L + 6}" y="${f1(Math.max(O + 14, y(Math.min(100, r0 + 30))))}">ROT</text>${ymax > 100 ? `<text class="fb-ztext hell" x="${L + 6}" y="${f1(O + 14)}">ÜBER 100 % — PUFFER ÜBERZOGEN</text>` : ''}`;
  const lage = punkte.map(pt => [x(pt.p), y(pt.b)]);
  const letzter = punkte[punkte.length - 1], istHeute = letzter.datum === st.heute;
  const bahn = `<path class="fb-bahn" d="${lage.map(([a, c], i) => `${i ? 'L' : 'M'}${f1(a)},${f1(c)}`).join('')}"></path>` + lage.slice(0, -1).map(([a, c], i) => `<circle class="fb-punkt ${punkte[i].zone}" cx="${f1(a)}" cy="${f1(c)}" r="3.5" data-datum="${punkte[i].datum}"></circle>`).join('');
  const [lx, ly] = lage[lage.length - 1], rechts = lx > W - R - 220;
  // über die Achse hinaus: Pfeil am Rand statt eines Punkts, der unter anderen verschwindet
  const ueber = punkte.map((pt, i) => pt.b > ymax || pt.b < ymin ? `<text class="fb-ueber" x="${f1(lage[i][0])}" y="${f1(pt.b > ymax ? O + 10 : H - U - 4)}" text-anchor="middle">${pt.b > ymax ? '▲' : '▼'}</text>` : '').join('');
  const aktuell = `<circle class="fb-aktuell ${letzter.zone}" id="fb-aktuell" cx="${f1(lx)}" cy="${f1(ly)}" r="8" data-datum="${letzter.datum}" data-zone="${letzter.zone}"></circle><text class="fb-name" x="${f1(lx + (rechts ? -14 : 14))}" y="${f1(Math.max(O + 14, ly - 10))}" text-anchor="${rechts ? 'end' : 'start'}">${esc(titel)} · ${ZONENNAME[letzter.zone].split(' ')[0]}${istHeute ? '' : ` · ${datumAusMs(isoTag(letzter.datum))}`}</text>`;
  const ende = pt => `${datumMitWochentag(isoTag(pt.ende))}`;
  S.fieberLage = lage;
  // Negativ ist richtig, heißt aber „vor Plan“ (R00082); früher kleiner Umfang erklärt tiefe Punkte
  const gewonnen = pt => pt.abstand < 0 ? `Puffer gewonnen: ${-pt.abstand} ${-pt.abstand === 1 ? einheit.slice(0, -1) : einheit} vor Planende` : '';
  const damals = pt => pt.umfang < 0.8 * letzter.umfang ? `Umfang damals ${pt.umfang}, heute ${letzter.umfang} — die Prognose kannte nur die damaligen Aufgaben` : '';
  S.fieberTip = i => { const pt = punkte[i]; return `<b>${datumMitWochentag(isoTag(pt.datum))}${pt.datum === st.heute ? ' (heute)' : ''}</b><span>Fortschritt ${zahl1(pt.p)} % (${pt.erledigt} von ${pt.umfang}: ${esc(st.zaehlt ? st.zaehlt.titel : '')})</span><span>Pufferverbrauch ${zahl1(pt.b)} %</span>${gewonnen(pt) ? `<span class="fb-gewonnen">${gewonnen(pt)}</span>` : ''}${damals(pt) ? `<span class="fb-damals">${esc(damals(pt))}</span>` : ''}<span><i class="fb-k ${pt.zone}"></i>Zone ${ZONENNAME[pt.zone]}</span><span>prognostiziert fertig ${ende(pt)} (P${e.perzentil})</span><span>Planende ${datumMitWochentag(isoTag(plan.planende))} · Zieltermin ${datumMitWochentag(isoTag(e.ziel))}</span>`; };
  const svg = `<svg class="diagramm fieber" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fieberdiagramm: Fortschritt gegen Pufferverbrauch, heute ${zahl1(letzter.p)} % Fortschritt und ${zahl1(letzter.b)} % Verbrauch, Zone ${ZONENNAME[letzter.zone]}">
<defs><clipPath id="fb-flaeche"><rect x="${L}" y="${O}" width="${pw}" height="${ph}"></rect></clipPath></defs>
<g clip-path="url(#fb-flaeche)">${zonen}</g>${gitter}${zonenText}
<text class="achse" x="${L + pw / 2}" y="${H - 6}" text-anchor="middle">Fortschritt — erledigte Aufgaben</text><text class="achse" transform="translate(12 ${O + ph / 2}) rotate(-90)" text-anchor="middle">Pufferverbrauch</text>
${bahn}${ueber}${aktuell}
</svg>`;
  const vorher = st.tage.filter(t => t.umfang && t.datum >= st.start && t.datum < punkte[0].datum).length;
  const gemessen = vorher ? `<p class="muted" id="fb-gemessen">ab ${datumAusMs(isoTag(punkte[0].datum))} gemessen — vorher zu wenig Läufe für eine Prognose.</p>` : '';
  const heuteText = `<div class="kennzahlen fb-heute" id="fb-stand"><span>${istHeute ? 'heute' : datumAusMs(isoTag(letzter.datum))}: Fortschritt <b>${zahl1(letzter.p)} %</b></span><span>Pufferverbrauch <b>${zahl1(letzter.b)} %</b>${gewonnen(letzter) ? ` (${gewonnen(letzter)})` : ''}</span><span class="fb-zonenwort ${letzter.zone}">Zone <b>${ZONENNAME[letzter.zone]}</b></span><span>prognostiziert fertig <b>${datumAusMs(isoTag(letzter.ende))}</b></span></div>`;
  const tabelle = `<details class="tabellenansicht"><summary data-halt="klappe:tabelle-fieber">Tabellenansicht</summary><table class="pt dicht" id="fb-tabelle"><thead><tr><th>Tag</th><th class="r">erledigt</th><th class="r">Fortschritt</th><th>prognostiziert fertig</th><th class="r">Verbrauch</th><th>Zone</th></tr></thead><tbody>${punkte.map(pt => `<tr><td class="mono">${datumLang(pt.datum)}</td><td class="r num">${pt.erledigt} / ${pt.umfang}</td><td class="r num">${zahl1(pt.p)} %</td><td class="mono">${datumLang(pt.ende)}</td><td class="r num">${zahl1(pt.b)} %</td><td>${ZONENNAME[pt.zone]}</td></tr>`).join('')}</tbody></table></details>`;
  const legende = `<div class="dlegende"><span><i class="fb-k gruen"></i>grün</span><span><i class="fb-k gelb"></i>gelb</span><span><i class="fb-k rot"></i>rot</span><span><i class="fb-k schwarz"></i>über 100 %</span><span><i class="k-umfang"></i>Bahn, ein Punkt je ${{ 1: 'Tag', 7: 'Woche', 30: 'Monat' }[S.board.fieber.aufloesung] || 'Tag'}; groß: der letzte Stand</span></div>`;
  return `${kennzahl}${heuteText}<div class="wl-panel"><h2 class="dtitel">Fortschritt gegen Pufferverbrauch</h2>${legende}${gemessen}${vDiagrammFlaeche(svg, ' fb-flaeche')}${tabelle}</div>`;
}
function vFieberMethodik() {
  return `<h2 class="dtitel">Lesehinweise und Methodik</h2><ul class="wl-liste"><li>Fortschritt: Anteil der Aufgaben, die die Zielspalte erreicht bzw. ihre Phase durchlaufen haben — ohne Wahl die Abschlussspalte bzw. die letzte Phase („Erledigt heißt“) —, am Umfang des Tages. Prognose und Durchsatz gehören zu demselben Block wie in „Wie lange noch“. Neue Aufgaben senken ihn — der Punkt springt nach links.</li><li>Gesamtdauer = Projektstart bis Zieltermin in der Einheit; davon ist der Puffer abgezogen, der Rest ist der Arbeitsbereich mit seinem Planende.</li><li>Für jeden Tag rechnet der Bericht die Prognose aus „Wie lange noch“ mit dem Wissen dieses Tages (Messbasis: die ${S.ui.bf.messbasisTage} Tage vor diesem Tag, nie vor „Rechnen ab“ und nie vor der ersten Aufgabe; nur der gewählte Block) und nimmt das gewählte Perzentil als prognostiziertes Ende. Pufferverbrauch = (Ende − Planende) / Puffer; negativ heißt: die Prognose war vor dem Planende fertig, Puffer gewonnen — der Tooltip nennt die Tage. Tief im Grünen liegen oft frühe Tage mit kleinem Umfang: die Prognose kannte nur die Aufgaben, die damals auf dem Board standen; ist der Umfang seitdem stark gewachsen, sagt das der Tooltip. Steht die Arbeit still, steigt der Verbrauch allein, weil Zeit vergeht.</li><li>Zonen: die Grenzen steigen von links nach rechts — früher Verbrauch ist gefährlicher, weil noch die ganze Arbeit folgt. Genau auf einer Grenze gilt die höhere Zone.</li><li>Auflösung: gerechnet wird je Tag; „Woche“ und „Monat“ zeigen vom letzten Stand rückwärts jeden 7. bzw. 30. Tag (fehlt dort ein Punkt, der davor) — Umschalten rechnet nichts neu.</li><li>Ohne ${MIN_LAEUFE} Läufe in der Messbasis kein Punkt. In Arbeitstagen nur Werktage. Die Bahn endet am ersten Tag mit 100 %.</li><li>Cache: je Projektstart und Berichtsfilter ein Abschnitt; Zieltermin, Puffer, Perzentil, Einheit und Zonen rechnen nichts neu. Der heutige Tag wird nie gespeichert, fehlende Tage ergänzt der Bericht beim Öffnen (Commit von „kanbanD“).</li></ul>`;
}

/* ── WBS-Sicht (R00054): Tabelle nach /planung karte, Stand im Kopf, live aus dem Arbeits-Repository ── */
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
    ? `<button class="ampel ${esc(k.gerechnet)} setzbar${S.ui.pop === 'wbs-status' && S.ui.wbsKnoten === k.id ? ' auf' : ''}" id="wbs-st-${esc(k.id)}" data-act="wbs-status-pop" data-arg="${esc(k.id)}" aria-haspopup="menu" title="Status von ${esc(k.id)} setzen" aria-label="Status von ${esc(k.id)}: ${esc(k.gerechnet)} — setzen">${esc(k.gerechnet)}</button>`
    : `<span class="ampel ${esc(k.gerechnet)}${gerechnet ? ' gerechnet' : ''}"${gerechnet ? ' title="gerechnet aus den Kindern"' : ''}>${esc(k.gerechnet)}</span>`;
  return gerechnet && k.gerechnet !== k.status ? p + `<span class="wbs-widerspruch" title="In der Datei steht „${esc(k.status)}“, gerechnet aus den Kindern: ${esc(k.gerechnet)}">Datei: ${esc(k.status)}</span>` : p;
}
function vWbsTabelle(w) {
  const tiefe = tiefen(w.knoten), eltern = mitKindern(w.knoten, false), gerechnet = mitKindern(w.knoten, true);
  const zu = zugeklappt(w.knoten, wbsKlapp(), w.stand.pfad), weg = ausgeblendet(w.knoten, zu);
  const wirkend = wirkungenJeKnoten(S.aufgaben, w.kuerzel);
  const aufgabenAn = id => (wirkend[id] || []).length ? `<span class="wbs-aufgaben">${wirkend[id].map(x => `<button class="lnk wbs-aufgabe${x.archiviert ? ' arch' : ''}" data-aktion="${esc(x.aktion)}" data-act="oeffnen" data-arg="${x.nummer}" title="#${x.nummer} ${esc(x.titel)} — ${esc((WIRKUNG[x.aktion] || {}).wort || x.aktion)}${x.archiviert ? ' · archiviert' : ''}">#${x.nummer}</button>`).join('')}</span>` : '';
  const req = zelle => esc(zelle).replace(/\bR\d{5}\b/g, id => w.anforderungen[id] ? `<a href="vscode://file${esc(w.anforderungen[id])}" title="Anforderung ${id} im Editor öffnen">${id}</a>` : id);
  const zeilen = w.knoten.map(k => {
    const klapp = klappbar(k, eltern) ? `<button class="klapp" data-act="wbs-klapp" data-arg="${esc(k.id)}" aria-label="${esc(k.id)} ${zu.has(k.id) ? 'aufklappen' : 'zuklappen'}" aria-expanded="${!zu.has(k.id)}">${zu.has(k.id) ? '+' : '−'}</button>` : '<span class="klapp-platz"></span>';
    const was = k.ebene === 'Bubble' && k.eingabe_ausgabe ? k.eingabe_ausgabe : k.fertig_kriterium;
    return `<tr class="wbs-z ${esc(k.gerechnet)}" id="wbs-${esc(k.id)}" data-id="${esc(k.id)}" data-ebene="${esc(k.ebene)}" data-eltern="${esc(k.eltern)}"${weg.has(k.id) ? ' hidden' : ''}><td class="mono"><a href="vscode://file${esc(w.datei)}:${k.zeile}" title="Zeile ${k.zeile} im Editor öffnen">${esc(k.id)}</a></td><td class="wbs-ebene" title="erreicht: ${esc(k.erreicht)}">${esc(k.ebene)}</td><td class="wbs-name" style="padding-left:calc(var(--kd-s3) + ${tiefe[k.id]} * 18px)"${k.braucht.length ? ` title="braucht: ${esc(k.braucht.join(', '))}"` : ''}>${klapp}<span class="n">${esc(anzeigename(k))}</span>${aufgabenAn(k.id)}${kindEbenen(k).length ? `<button class="lnk wbs-plus" id="wbs-neu-${esc(k.id)}" data-act="wbs-neu-pop" data-arg="${esc(k.id)}" aria-label="Knoten unter ${esc(k.id)} anlegen" title="Knoten unter ${esc(k.id)} anlegen">+ Knoten</button>` : ''}</td><td class="wbs-text">${esc(was)}</td><td>${k.aufwand ? esc(k.aufwand) + 'h' : '—'}</td><td>${vWbsStatus(k, gerechnet.has(k.id), statusSetzbar(k, gerechnet))}</td><td class="mono">${req(k.requirement)}</td><td class="wbs-text">${esc(k.notiz)}</td></tr>`;
  }).join('');
  return `<div class="wbs-tabelle"><table class="pt dicht"><thead><tr><th>ID</th><th>Ebene</th><th>Knoten</th><th>Fertig-Kriterium / Eingabe → Ausgabe</th><th>Aufwand</th><th>Status</th><th>Requirement</th><th>Notiz</th></tr></thead><tbody>${zeilen}</tbody></table></div>`;
}

/** Wahl des Status an einem Blatt: rot · gelb · gruen; kanbanD schreibt die WBS-Datei und committet dort nicht. */
function vWbsStatusPop() {
  const id = S.ui.wbsKnoten, k = S.wbs && S.wbs.knoten.find(x => x.id === id);
  if (!k) return '';
  return `<div class="pop" id="pop" data-for="wbs-st-${esc(id)}" data-al="l" style="width:240px" role="menu" aria-label="Status von ${esc(id)}"><div class="pop-kopf">STATUS <span class="mono">${esc(id)}</span></div>${STATUS_WAHL.map(s => `<div class="iz${s === k.status ? ' an' : ''}" data-act="wbs-status" data-arg="${esc(id)}|${s}" role="menuitem" tabindex="-1"><span class="ampel ${s}">${s}</span><span class="muted">${s === k.status ? 'gesetzt' : ''}</span></div>`).join('')}<div class="fuss">Schreibt die WBS-Datei im Arbeits-Repository, ohne Commit.</div></div>`;
}

/** Neuer Knoten unter einem Eltern-Knoten: Ebene, Name, Fertig-Kriterium; Bubbles dazu Eingabe → Ausgabe und Aufwand. */
function vWbsNeuPop() {
  const f = S.ui.wbsNeu, k = f && S.wbs && S.wbs.knoten.find(x => x.id === f.eltern);
  if (!k) return '';
  const ebenen = kindEbenen(k), feld = (n, titel, ph) => `<span class="k">${titel}</span><span class="w"><input class="mini-inp full" id="wbs-neu-${n}" data-wn="${n}" value="${esc(f[n])}" placeholder="${esc(ph)}" data-enter="wbs-neu-anlegen" aria-label="${esc(titel)}"></span>`;
  return `<div class="pop wbs-neu" id="pop" data-for="wbs-neu-${esc(k.id)}" data-al="l" style="width:420px" role="dialog" aria-label="Knoten unter ${esc(k.id)} anlegen"><h4 class="pop-kopf">NEUER KNOTEN <span class="mono">unter ${esc(k.id)} ${esc(k.name)}</span></h4><div class="felder"><span class="k">Ebene</span><span class="w"><select id="wbs-neu-ebene" data-wn="ebene" aria-label="Ebene">${ebenen.map(e => `<option${e === f.ebene ? ' selected' : ''}>${e}</option>`).join('')}</select></span>${feld('name', 'Name', 'was entsteht')}${feld('fertig_kriterium', 'Fertig', f.ebene === 'Bubble' ? 'Test gruen' : 'US-1')}${f.ebene === 'Bubble' ? feld('eingabe_ausgabe', 'Eingabe → Ausgabe', 'Eingabe → Ausgabe') + feld('aufwand', 'Aufwand', '0,5-1') : ''}</div>${f.fehler ? `<div class="warnh" role="alert">${esc(f.fehler)}</div>` : ''}<div class="fuss"><span>rot mit der nächsten freien ID · ohne Commit</span><button class="btn btn-haupt" data-act="wbs-neu-anlegen">anlegen</button></div></div>`;
}

/** Rückfrage vor dem Verwerfen: was mitgeht, Grund für die Notiz. */
function vWbsVerwerfenPop() {
  const id = S.ui.wbsVerwerfen, k = S.wbs && S.wbs.knoten.find(x => x.id === id);
  if (!k) return '';
  const mit = nachfahren(S.wbs.knoten, id).filter(zaehlt).length;
  return `<div class="pop wbs-verwerfen" id="pop" data-for="wbs-${esc(id)}" data-al="l" style="width:420px" role="dialog" aria-label="${esc(id)} verwerfen"><h4 class="pop-kopf">VERWERFEN <span class="mono">${esc(id)} ${esc(k.name)}</span></h4><p class="hin">${mit ? `Mit ${esc(id)} werden ${mit} Knoten darunter verworfen.` : `${esc(id)} wird verworfen.`} Keine Zeile wird gelöscht; die Zeilen bleiben durchgestrichen stehen und zählen nicht mehr im Stand.</p><div class="felder"><span class="k">Grund</span><span class="w"><input class="mini-inp full" id="wbs-verwerfen-grund" placeholder="kommt in die Notiz" data-enter="wbs-verwerfen" data-arg="${esc(id)}" aria-label="Grund"></span></div><div class="fuss"><button class="btn" data-act="wbs-verwerfen-zu">abbrechen</button><button class="btn btn-haupt" data-act="wbs-verwerfen" data-arg="${esc(id)}">verwerfen</button></div></div>`;
}

/* ── Einrichten: Personen, Klassen, Quellen, Anwendungen ── */
/** Erreichbarkeit eines Pfads zu WBS oder Anforderungen, wie der Server sie zuletzt gemeldet hat — nur solange der Pfad
    gespeichert ist; ein leeres Feld trägt kein Wort (R00209: beide Felder sind nicht mehr nötig). */
function vErreichbar(a, feld) {
  const g = (S.anwendungen || {})[a.kuerzel];
  if (!a[feld]) return '';
  if (!g || g[feld] !== a[feld]) return `<span class="erreich ${REPOSITORY_ZUSTAENDE.ungeprueft.klasse}">${REPOSITORY_ZUSTAENDE.ungeprueft.wort}</span>`;
  return g.erreichbar[feld] ? `<span class="erreich ja" title="Pfad gefunden">erreichbar</span>` : `<span class="erreich nein" title="Pfad nicht gefunden — die Anwendung ist nicht erreichbar, alle Boards bleiben benutzbar">nicht erreichbar</span>`;
}
/** Was der Server zum Repository einer Anwendung zuletzt gemeldet hat: {repository, erreichbar} oder nichts. */
function gespeichertesRepository(kuerzel) {
  const g = (S.anwendungen || {})[kuerzel];
  if (!g) return undefined;
  return { repository: g.repository, erreichbar: g.erreichbar.repository };
}
/** Das Feld „Repository“ mit seinem sichtbaren Zustandswort (PO Z. 434), das mit dem Feld vorgelesen wird. */
function vRepositoryFeld({ ef, i, wert, beschriftung, zustandId, gespeichert }) {
  const z = repositoryZustand(wert, gespeichert);
  const index = i === undefined ? '' : ` data-i="${i}"`;
  return `${vBeschriftung('repository')}<span class="w"><input class="mini-inp full" data-ef="${ef}"${index} value="${esc(wert)}" title="${esc(wert)}" placeholder="/voller/pfad/zum/Repository" aria-label="${esc(beschriftung)}" aria-describedby="${zustandId}"><span class="erreich ${z.klasse}" id="${zustandId}">${z.wort}</span></span>`;
}
/** Hinweis unter dem gefüllten Feld „WBS“ einer Anwendung (PO Z. 435) — ruhig, ohne Sperre; bei leerem Feld verborgen. */
const WBS_HINWEIS = 'Die Factory erkennt die Anwendung an diesem Pfad. Leeren erst, wenn die Factory umgestellt ist.';
function vRegister(d) {
  const register = d.quellen.anwendungen || [];
  const zeilen = register.map((a, i) => {
    const repository = vRepositoryFeld({ ef: 'arepo', i, wert: a.repository || '', beschriftung: `Repository ${a.kuerzel}`, zustandId: `anw-repo-${i}`, gespeichert: gespeichertesRepository(a.kuerzel) });
    const hinweisId = `anw-wbs-hinweis-${i}`, mitWbs = Boolean(a.wbs);
    const beschrieben = mitWbs ? ` aria-describedby="${hinweisId}"` : '';
    const wbs = `${vBeschriftung('wbs')}<span class="w"><input class="mini-inp full" data-ef="awbs" data-i="${i}" value="${esc(a.wbs)}" title="${esc(a.wbs)}" placeholder="/voller/pfad/Dokumentation/Planung/app.md" aria-label="WBS-Pfad ${esc(a.kuerzel)}"${beschrieben}>${vErreichbar(a, 'wbs')}</span><div class="feld-hinweis" id="${hinweisId}"${mitWbs ? '' : ' hidden'}>${WBS_HINWEIS}</div>`;
    const anforderungen = `${vBeschriftung('requirements')}<span class="w"><input class="mini-inp full" data-ef="aanf" data-i="${i}" value="${esc(a.anforderungen)}" title="${esc(a.anforderungen)}" placeholder="/voller/pfad/Anforderungen" aria-label="Anforderungspfad ${esc(a.kuerzel)}">${vErreichbar(a, 'anforderungen')}</span>`;
    return `<div class="anw" data-anwendung="${esc(a.kuerzel)}"><div class="klz az"><span class="pk pk-0">${esc(a.kuerzel.slice(0, 2).toUpperCase())}</span><span class="key">${esc(a.kuerzel)}</span><input class="inp" data-ef="aname" data-i="${i}" value="${esc(a.name)}" aria-label="Name der Anwendung ${esc(a.kuerzel)}"><span></span><button class="btn btn-sym" data-act="a-del" data-arg="${i}" title="aus dem Register entfernen – Aufgaben behalten ihre Herkunft" aria-label="Anwendung ${esc(a.kuerzel)} entfernen">✕</button></div><div class="felder">${repository}${wbs}${anforderungen}</div></div>`;
  }).join('');
  return `${zeilen}<div class="klz az"><span class="pk pk-0">+</span><input class="inp mono" id="nak" placeholder="kürzel" aria-label="Neues Anwendungskürzel"><input class="inp" id="nan" placeholder="Name · Enter" data-enter="a-add" aria-label="Neuer Anwendungsname"><span></span><span></span></div>`;
}
/** Die Quellen (Standardanwendung ohne Kürzel): Repository mit Zustandswort wie eine Anwendung, dazu WBS und Anforderungen. */
function vQuellen(d) {
  const repository = vRepositoryFeld({ ef: 'repo', wert: d.quellen.repository || '', beschriftung: 'Repository', zustandId: 'quellen-repo', gespeichert: S.quellenStand || undefined });
  return `<div class="felder">${repository}${vBeschriftung('wbs')}<span class="w"><input class="mini-inp full" data-ef="wbs" value="${esc(d.quellen.wbs)}" title="${esc(d.quellen.wbs)}" aria-label="WBS-Pfad"></span>${vBeschriftung('requirements')}<span class="w"><input class="mini-inp full" data-ef="anf" value="${esc(d.quellen.anforderungen)}" title="${esc(d.quellen.anforderungen)}" aria-label="Anforderungspfad"></span></div>`;
}

/** Die Klassen eines Entwurfs, wie sie gespeichert werden: ohne die gestrichenen Zeilen und ohne deren Marke. */
const ungestrichen = klassen => klassen.filter(k => !k.gestrichen).map(({ gestrichen, ...klasse }) => klasse);
/** Der Klassen-Editor (R00010, R00195): je Klasse eine Zeile mit Farbe, Schlüssel, Bezeichnung und Zahl der Karten, darunter
    die Neu-Zeile. Derselbe Editor pflegt die Vorgabe des Ordners („Einrichten“) und die eigenen Klassen eines Boards
    („Spalten einrichten“); welche Liste er bearbeitet, sagt `klassenEntwurf()` in app.js. `karten` nennt je Schlüssel die
    Zahl der Karten nach der Zählregel des Ortes — dieselbe Zahl steht in der Zeile und in der Hinweiszeile. */
function vKlassenEditor(klassen, karten) {
  const zeilen = klassen.map((k, i) => k.gestrichen ? vKlasseGestrichen(k, i, klassen, karten) : vKlassenZeile(k, i, karten)).join('');
  return `${zeilen}<div class="klz"><span class="farbe"></span><input class="inp mono" id="nck" placeholder="schlüssel" aria-label="Neuer Klassenschlüssel"><input class="inp" id="ncl" placeholder="Bezeichnung · Enter" data-enter="k-add" aria-label="Neue Bezeichnung"><span></span><span></span></div>`;
}
function vKlassenZeile(k, i, karten) {
  const u = S.ui;
  const palette = u.palFuer === i ? `<div class="pal"><span class="nm">gewählt: ${esc(k.farbe)}</span><div class="g">${PAL.map(f => `<span style="${cv(f)}" class="${k.farbe === f ? 'an' : ''}" data-act="k-farbe" data-arg="${i}|${f}" title="${f}" tabindex="0" role="button" aria-label="${f}"></span>`).join('')}</div><div class="eig">Eigene Farbe <input class="inp mono" data-ef="khex" data-i="${i}" value="${k.farbe.startsWith('#') ? esc(k.farbe) : ''}" placeholder="#b04a8c" aria-label="Eigene Farbe"></div></div>` : '';
  return `<div class="klz" data-klasse="${esc(k.schluessel)}"><span class="farbe${u.palFuer === i ? ' an' : ''}" style="${cv(k.farbe)}" data-act="k-pal" data-arg="${i}" title="Farbe wählen" tabindex="0" role="button" aria-label="Farbe ${esc(k.schluessel)}"></span><span class="key">${esc(k.schluessel)}</span><input class="inp" data-ef="klabel" data-i="${i}" value="${esc(k.bezeichnung)}" aria-label="Bezeichnung ${esc(k.schluessel)}"><span class="n">${karten[k.schluessel] || 0}</span><button class="btn btn-sym" data-act="k-del" data-arg="${i}" title="entfernen – Aufgaben behalten den Schlüssel, ohne Farbe" aria-label="Klasse ${esc(k.schluessel)} entfernen">✕</button></div>${palette}`;
}
/** Eine gestrichene Klasse bleibt bis zum Speichern als Zeile stehen (R00195 AK 9, Zeichnung D0002 #klassen-hinweiszeile):
    durchgestrichen und mit dem Wort „gestrichen“, nicht mehr bedienbar, „zurücknehmen“ stellt sie wieder her. Tragen Karten
    die Klasse und führt keine andere Zeile den Schlüssel, steht darunter die Hinweiszeile mit ihrer Zahl. */
function vKlasseGestrichen(k, i, klassen, karten) {
  const neuAngelegt = klassen.some(andere => !andere.gestrichen && andere.schluessel === k.schluessel);
  const hinweis = neuAngelegt ? '' : hinweisGestrichen(karten[k.schluessel]);
  const beschrieben = hinweis ? ` aria-describedby="kl-hinweis-${i}"` : '';
  return `<div class="klz gestrichen" data-klasse="${esc(k.schluessel)}"><span class="farbe" style="${cv(k.farbe)}" aria-hidden="true"></span><span class="key">${esc(k.schluessel)}</span><span class="kl-alt"><s>${esc(k.bezeichnung)}</s><span class="kl-marke">gestrichen</span></span><span class="n">${karten[k.schluessel] || 0}</span><button class="btn" data-act="k-zurueck" data-arg="${i}" aria-label="Klasse ${esc(k.schluessel)} zurücknehmen"${beschrieben}>zurücknehmen</button></div>${hinweis ? `<div class="kb-hinweis" id="kl-hinweis-${i}" role="status">${esc(hinweis)}</div>` : ''}`;
}
function vEinrichten() {
  const d = S.ui.einr, u = S.ui;
  const personen = d.personen.map((p, i) => `<div class="klz pz${p.aktiv ? '' : ' still'}" data-person="${esc(p.kuerzel)}"><span class="pk ${p.art === 'agent' ? 'pk-a' : 'pk-m'}${p.aktiv ? '' : ' pk-still'}" title="${esc(p.name)}${p.aktiv ? '' : ' (stillgelegt)'}">${esc(p.kuerzel.slice(0, 2).toUpperCase())}</span><span class="key">${esc(p.kuerzel)}</span><input class="inp" data-ef="pname" data-i="${i}" value="${esc(p.name)}" aria-label="Name ${esc(p.kuerzel)}"><span class="seg art" role="radiogroup" aria-label="Art ${esc(p.kuerzel)}"><span class="${p.art === 'human' ? 'an' : ''}" data-act="p-art" data-arg="${i}|human" role="radio" aria-checked="${p.art === 'human'}">Mensch</span><span class="${p.art === 'agent' ? 'an' : ''}" data-act="p-art" data-arg="${i}|agent" role="radio" aria-checked="${p.art === 'agent'}">Agent</span></span><button class="btn btn-sym" data-act="p-still" data-arg="${i}" title="${p.aktiv ? 'stilllegen – nicht mehr wählbar, Name bleibt lesbar' : 'zurückholen'}" aria-label="${p.aktiv ? 'stilllegen' : 'zurückholen'} ${esc(p.kuerzel)}">${p.aktiv ? '⏸' : '↺'}</button></div>`).join('');
  const klassen = vKlassenEditor(d.klassen, kartenJeKlasseInDerVorgabe(S.boards || [], S.aufgaben));
  return `<div class="einrichten"><div class="einr breit"><h2 class="einr-kopf">PERSONEN <span class="mono">people:</span></h2><div class="hin">Menschen sind unter „Ich bin …“ wählbar; Agenten nennen sich an der API selbst. Stilllegen statt entfernen – der Name bleibt an Karten und Zeiten lesbar.</div>${personen}<div class="klz pz"><span class="pk pk-0">+</span><input class="inp mono" id="npk" placeholder="kürzel" aria-label="Neues Kürzel"><input class="inp" id="npn" placeholder="Name · Enter" data-enter="p-add" aria-label="Neuer Name"><span class="seg art" role="radiogroup" aria-label="Art der neuen Person"><span class="${u.nart !== 'agent' ? 'an' : ''}" data-act="n-art" data-arg="human" role="radio" aria-checked="${u.nart !== 'agent'}">Mensch</span><span class="${u.nart === 'agent' ? 'an' : ''}" data-act="n-art" data-arg="agent" role="radio" aria-checked="${u.nart === 'agent'}">Agent</span></span><span></span></div>
<h2 class="einr-kopf">KLASSEN <span class="mono">classes:</span></h2><div class="hin">Eine Aufgabe trägt höchstens eine Klasse; sie färbt die Karte und ist filterbar mit <span class="mono">class:schlüssel</span>.</div>${klassen}
${vSignaleEinrichten(d)}
<h2 class="einr-kopf">QUELLEN <span class="mono">sources:</span></h2>${vQuellen(d)}
<h2 class="einr-kopf">ANWENDUNGEN <span class="mono">sources.applications:</span></h2><div class="hin">Je Anwendung ein Kürzel und der Pfad ihres Repositorys; ein Ordner darin genügt. Daraus liest kanbanD die Commits zu Verweisen wie <span class="mono">kd:&lt;hash&gt;</span>. WBS und Anforderungen braucht nur noch die Factory; die Felder entfallen, sobald sie umgestellt ist. Aufgaben nennen ihre Herkunft als <span class="mono">kd:I0007</span>; Boards binden mit <span class="mono">applications: [kd]</span>.</div>${vRegister(d)}
${d.fehler ? `<div class="warnh" id="einr-fehler" role="alert" tabindex="-1">${esc(d.fehler)}</div>` : ''}<div class="zeile-knoepfe"><button class="btn btn-haupt" data-act="einr-ok">Speichern</button><button class="btn" data-act="einr-weg">Verwerfen</button>${d.gespeichert ? '<span class="muted" id="einr-gespeichert">gespeichert</span>' : ''}</div></div>
<aside class="einr"><h2 class="einr-kopf">KANBAND.MD <span class="mono">Vorschau</span></h2><pre class="yaml" id="einr-vorschau">${esc(einstellungenText(d))}</pre></aside></div>`;
}

/** Signale einrichten (R00076): wie Klassen — Schlüssel, Bedeutung, Farbe; `due` ist die Fälligkeit und gerechnet. */
function vSignaleEinrichten(d) {
  const u = S.ui, liste = d.signale || [];
  const zeilen = liste.map((g, i) => `<div class="klz" data-signal="${esc(g.schluessel)}"><span class="farbe sigfarbe${u.sPalFuer === i ? ' an' : ''}" style="--sg:${esc(terminFarbe(g.farbe))}" data-act="s-pal" data-arg="${i}" title="Farbe wählen" tabindex="0" role="button" aria-label="Farbe Signal ${esc(g.schluessel)}">${FACKEL}</span><span class="key">${esc(g.schluessel)}</span><input class="inp" data-ef="slabel" data-i="${i}" value="${esc(g.bezeichnung)}" aria-label="Bedeutung ${esc(g.schluessel)}"><span class="n">${S.aufgaben.filter(a => (a.signale || []).includes(g.schluessel)).length}</span><button class="btn btn-sym" data-act="s-del" data-arg="${i}" title="entfernen – Aufgaben behalten das Signal, ohne Farbe" aria-label="Signal ${esc(g.schluessel)} entfernen">✕</button></div>${u.sPalFuer === i ? `<div class="pal"><span class="nm">gewählt: ${esc(g.farbe)}</span><div class="g">${PAL.map(f => `<span style="${cv(f)}" class="${g.farbe === f ? 'an' : ''}" data-act="s-farbe" data-arg="${i}|${f}" title="${f}" tabindex="0" role="button" aria-label="${f}"></span>`).join('')}</div><div class="eig">Eigene Farbe <input class="inp mono" data-ef="shex" data-i="${i}" value="${g.farbe.startsWith('#') ? esc(g.farbe) : ''}" placeholder="#b04a8c" aria-label="Eigene Farbe Signal"></div></div>` : ''}`).join('');
  return `<h2 class="einr-kopf">SIGNALE <span class="mono">signals:</span></h2><div class="hin">Ein Signal hebt eine Aufgabe hervor — gesetzt per Klick im Aufgabenfenster oder über die API (<span class="mono">PUT /api/aufgaben/{nr}/signale/{schlüssel}</span>), zurückgenommen mit einem Klick auf die Fackel. Filterbar mit <span class="mono">signal:schlüssel</span>; <span class="mono">signal:due</span> ist die Fälligkeit (heute oder überschritten).</div>${zeilen}<div class="klz"><span class="farbe"></span><input class="inp mono" id="nsk" placeholder="schlüssel" aria-label="Neuer Signalschlüssel"><input class="inp" id="nsl" placeholder="Bedeutung · Enter" data-enter="s-add" aria-label="Neue Bedeutung"><span></span><span></span></div>`;
}

/* ── Spalten einrichten ── */
/** Gesendet wird `eigentuemer` nur bei Änderung — sonst bleibt auch ein unbekannter Rohwert in der Datei (R00120). */
const eigentuemerGeaendert = sp => (sp.eigentuemer || '') !== (sp.eigentuemerAlt || '');
const eigentuemerInDatei = sp => sp.eigentuemer === 'roh' ? sp.roh : (sp.eigentuemer || '');
function setupText(d) {
  const grenzen = d.spalten.filter(s => +s.grenze > 0);
  const pruefend = d.spalten.filter(s => (s.pruefungen || []).length);
  const kopf = (grenzen.length ? 'limits:\n' + grenzen.map(s => `  ${yamlSkalar(s.name)}: ${+s.grenze}`).join('\n') + '\n' : '')
    + (pruefend.length ? 'column-checks:\n' + pruefend.map(s => `  ${yamlSkalar(s.name)}: [${s.pruefungen.map(yamlSkalar).join(', ')}]`).join('\n') + '\n' : '')
    + [['column-notes', 'notiz'], ['column-colors', 'farbe']].map(([k, f]) => (m => m.length ? `${k}:\n` + m.map(s => `  ${yamlSkalar(s.name)}: ${yamlSkalar(s[f].trim())}`).join('\n') + '\n' : '')(d.spalten.filter(s => (s[f] || '').trim()))).join('')
    // Datums-Trenner (R00124): die Vorschau führt `column-dates` mit, das Geschriebene stimmt damit überein
    + 'column-dates:\n' + d.spalten.map(s => `  ${yamlSkalar(s.name)}: ${s.datumsTrenner}`).join('\n') + '\n';
  const eigner = d.spalten.filter(eigentuemerInDatei);
  const besitz = eigner.length ? 'column-owner:\n' + eigner.map(s => `  ${yamlSkalar(s.name)}: ${yamlSkalar(eigentuemerInDatei(s))}`).join('\n') + '\n' : '';
  const bindung = Array.isArray(d.anwendungen) ? `applications: [${d.anwendungen.map(yamlSkalar).join(', ')}]\n` : '';
  const eigene = setupKlassen(d);
  const klassen = eigene ? klassenText(eigene) + '\n' : '';
  return (klassen || bindung || kopf || besitz ? '---\n' + klassen + bindung + kopf + besitz + '---\n\n' : '')
    + `# ${S.board.titel}\n` + d.spalten.map(s => `\n## ${s.name}\n` + (s.n ? `\n… ${s.n} Aufgabenzeilen\n` : '')).join('');
}
/** Bindung des Boards an registrierte Anwendungen (R00062): ein Schalter je Anwendung und „keine“; ohne Register nichts. */
function vBindungFeld(d) {
  const register = S.zustand.einstellungen.quellen.anwendungen || [];
  if (!register.length) return '';
  const an = gebundeneAnwendungen({ anwendungen: d.anwendungen }, register).map(a => a.kuerzel), standard = d.anwendungen == null;
  const schalter = (k, text, ein, titel) => `<button class="as${ein ? ' an' : ''}" data-act="bind" data-arg="${esc(k)}" aria-pressed="${ein}" aria-label="Bindung ${esc(text)}" title="${esc(titel)}">${esc(text)}</button>`;
  return `<h2 class="einr-kopf">GEBUNDEN AN${standard ? ' <span class="mono">(Standard)</span>' : ''}</h2><div class="r2 wrap">${register.map(a => schalter(a.kuerzel, a.name, an.includes(a.kuerzel), `WBS-Sicht, Phasen-Spalten und Prüfungen aus „${a.name}“ (${a.kuerzel})`)).join('')}${schalter('', 'keine', !an.length, 'reines Kanban: applications: [] — keine Phasen, keine WBS-Sicht; vorhandene Spalten bleiben')}</div>`;
}
/** Die eigenen Klassen im Entwurf von „Spalten einrichten“, wie sie gespeichert würden: `null` heißt Vorgabe des Ordners. */
const setupKlassen = d => d.klassenWahl === 'eigen' ? ungestrichen(d.klassen) : null;
/** Abschnitt „Klassen dieses Boards“ (R00195 AK 8, Zeichnung D0002 #klassen-dieses-boards): die Wahl zwischen der Vorgabe des
    Ordners und eigenen Klassen; bei „eigene Klassen“ der Klassen-Editor aus „Einrichten“. Geschrieben wird erst mit „Fertig“. */
function vBoardKlassen(d) {
  const eigen = d.klassenWahl === 'eigen';
  // Rückkehr zur Vorgabe (AK 10): hat das Board einen gespeicherten eigenen Satz, sagt eine Zeile, was „Fertig“ entfernt.
  const gespeichert = Array.isArray(S.board.klassen) ? S.board.klassen : [];
  const rueckkehr = eigen ? '' : hinweisRueckkehr(gespeichert.length, fremdNachRueckkehr(S.board, S.zustand.einstellungen, S.aufgaben));
  const radio = (wert, text, beschrieben = '') => `<span class="${d.klassenWahl === wert ? 'an' : ''}" data-act="klassen-wahl" data-arg="${wert}" role="radio" aria-checked="${d.klassenWahl === wert}"${beschrieben}>${text}</span>`;
  const wahl = `<div class="kl-wahl"><span class="seg" role="radiogroup" aria-label="Klassen dieses Boards">${radio('vorgabe', 'Vorgabe des Ordners', rueckkehr ? ' aria-describedby="kl-hinweis-rueckkehr"' : '')}${radio('eigen', 'eigene Klassen')}</span></div>`;
  const vorgabe = vorgabeDesOrdners(S.zustand.einstellungen).map(k => k.bezeichnung).join(', ') || 'keine';
  const inhalt = eigen
    ? `<div class="hin">Eigene Klassen gelten nur auf diesem Board; begonnen wird mit einer Kopie der Vorgabe. Aufgaben behalten ihren Schlüssel.</div>${vKlassenEditor(d.klassen, kartenJeKlasseAufBoard(S.board, S.aufgaben))}${d.klassenFehler ? `<div class="warnh" role="alert">${esc(d.klassenFehler)}</div>` : ''}`
    : `<div class="hin">Dieses Board zeigt die Klassen des Ordners: ${esc(vorgabe)}. Gepflegt werden sie unter „Einrichten“.</div>${rueckkehr ? `<div class="kb-hinweis" id="kl-hinweis-rueckkehr" role="status">${esc(rueckkehr)}</div>` : ''}`;
  return `<section id="klassen-dieses-boards" aria-label="Klassen dieses Boards"><h2 class="einr-kopf">KLASSEN DIESES BOARDS <span class="mono">classes:</span></h2>${wahl}${inhalt}</section>`;
}
/** Auswahl „Eigentümer“ mit Hinweissatz (aria-describedby, R00120); ein unbekannter Rohwert ist als eigene Option vorausgewählt. */
function vEigentuemerWahl(sp, i) {
  const wahl = sp.eigentuemer || '';
  const basis = [['', '— keiner —'], ['human', 'Mensch'], ['agent', 'Agent']].map(([w, text]) => `<option value="${w}"${w === wahl ? ' selected' : ''}>${text}</option>`).join('');
  const rohOption = sp.roh ? `<option value="roh"${wahl === 'roh' ? ' selected' : ''}>„${esc(sp.roh)}“ (unbekannt)</option>` : '';
  const roh = sp.roh ? `<span class="mono eig-roh"${eigentuemerGeaendert(sp) ? ' hidden' : ''}>${esc(sp.roh)}</span>` : '';
  return `<div class="r2 eig-zeile"><label for="eig-${i}">Eigentümer</label><select class="inp eig-wahl" id="eig-${i}" data-sf="eigentuemer" data-i="${i}"${wahl === 'roh' ? ` title="„${esc(sp.roh)}“ (unbekannt)"` : ''} aria-label="Eigentümer ${esc(sp.name)}" aria-describedby="eig-hin-${i}">${basis}${rohOption}</select>${roh}</div><div class="eig-hin" id="eig-hin-${i}">${esc(eigentuemerText(sp))}</div>`;
}
function vSetup() {
  const d = S.ui.setup;
  const bahnen = d.spalten.map((sp, i) => `<section class="bahn${sp.farbe ? ' gefaerbt' : ''}" style="--bw:236px${sp.farbe ? `;--sf:${esc(sp.farbe)}` : ''}"><div class="bk-ed"><div class="r"><input class="inp" data-sf="name" data-i="${i}" value="${esc(sp.name)}" aria-label="Spaltenname ${i + 1}"><button class="btn btn-sym" data-act="col-l" data-arg="${i}"${i === 0 ? ' disabled' : ''} title="nach links">←</button><button class="btn btn-sym" data-act="col-r" data-arg="${i}"${i === d.spalten.length - 1 ? ' disabled' : ''} title="nach rechts">→</button><button class="btn btn-sym" data-act="col-del" data-arg="${i}"${sp.n ? ` disabled title="enthält ${sp.n} Karten – erst leeren"` : ' title="entfernen"'} aria-label="Spalte ${esc(sp.name)} entfernen">✕</button></div><div class="r2"><span>${sp.n} Karten</span>${sp.alt && sp.alt !== sp.name ? `<span class="mono">war: ${esc(sp.alt)}</span>` : ''}${!sp.alt ? '<span class="mono">neu</span>' : ''}<span style="margin-left:auto">Grenze <input class="inp" data-sf="grenze" data-i="${i}" value="${sp.grenze || ''}" aria-label="Grenze ${esc(sp.name)}" inputmode="numeric"></span></div><div class="r2">${(an => `<button class="as${an ? ' an' : ''}" data-act="col-pruef" data-arg="${i}" aria-pressed="${an}" aria-label="Prüfung wbs-effects-green ${esc(sp.name)}" title="Beim Weiterziehen nach rechts warnen, wenn nicht alle Knoten der Wirkungen grün sind — sperrt nicht">prüft: WBS grün</button>`)((sp.pruefungen || []).includes('wbs-effects-green'))}${(sp.pruefungen || []).filter(n => n !== 'wbs-effects-green').map(n => `<span class="mono" title="unbekannte Prüfung — bleibt erhalten">${esc(n)}</span>`).join('')}</div><div class="r2">${(an => `<button class="as dates${an ? ' an' : ''}" data-act="col-dates" data-arg="${i}" aria-pressed="${an}" aria-label="Datums-Trenner ${esc(sp.name)}" title="Dünne beschriftete Datums-Trenner zwischen den Aufgaben dieser Spalte — nach dem Tag, an dem die Karte in die Spalte kam">Datums-Trenner</button>`)(sp.datumsTrenner)}</div><div class="r2"><input class="inp kommentar" data-sf="notiz" data-i="${i}" value="${esc(sp.notiz || '')}" placeholder="Kommentar (ⓘ im Kopf)" aria-label="Kommentar ${esc(sp.name)}"></div><div class="r2">Farbe <input type="color" class="farbwahl" data-sf="farbe" data-i="${i}" value="${esc(sp.farbe || '#ffffff')}" aria-label="Farbe ${esc(sp.name)}"><span class="mono">${sp.farbe ? esc(sp.farbe) : 'keine'}</span>${sp.farbe ? `<button class="btn btn-sym" data-act="col-farbe-weg" data-arg="${i}" title="Farbe entfernen" aria-label="Farbe ${esc(sp.name)} entfernen">✕</button>` : ''}</div>${vEigentuemerWahl(sp, i)}</div><div class="flaeche ruhig"></div></section>`).join('');
  const neu = `<section class="bahn-neu"><div class="bk-ed"><div class="r"><input class="inp" id="col-new" placeholder="neue Spalte · Enter" data-enter="col-add" aria-label="Neue Spalte"></div><div class="r2">wird vor der Abschlussspalte eingefügt</div></div></section>`;
  return `<div class="setup"><div class="bahnen">${bahnen}${neu}</div><aside class="einr">${vBindungFeld(d)}${vBoardKlassen(d)}<h2 class="einr-kopf">BOARDS/${esc(S.board.slug).toUpperCase()}.MD <span class="mono">Vorschau</span></h2><pre class="yaml" id="setup-vorschau">${esc(setupText(d))}</pre></aside></div>`;
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
<div class="felder">${vBeschriftung('ich')}<span class="w"><input class="mini-inp" data-fr="kuerzel" value="${esc(f.kuerzel)}" placeholder="kürzel" style="width:70px" aria-label="Kürzel"><input class="mini-inp full" data-fr="name" value="${esc(f.name)}" placeholder="Dein Name" aria-label="Name"></span>
${vBeschriftung('agents')}<span class="w wrap">${ag.map(([k, n]) => `<button class="as${f.agenten[k] ? ' an' : ''}" data-act="fr-agent" data-arg="${k}" aria-pressed="${!!f.agenten[k]}"><span class="pk pk-a">${k.toUpperCase()}</span>${n}</button>`).join('')}</span>
${vBeschriftung('board')}<span class="w"><input class="mini-inp full" data-fr="board" value="${esc(f.board)}" aria-label="Board"></span>
${vBeschriftung('spalten')}<span class="w"><input class="mini-inp full" data-fr="spalten" value="${esc(f.spalten)}" title="durch Komma getrennt; die letzte ist die Abschlussspalte" aria-label="Spalten"></span>
${vBeschriftung('wbs')}<span class="w"><input class="mini-inp full" data-fr="wbs" value="${esc(f.wbs)}" placeholder="Dokumentation/Planung/projekt.md" aria-label="WBS"></span>
${vBeschriftung('requirements')}<span class="w"><input class="mini-inp full" data-fr="anf" value="${esc(f.anf)}" placeholder="Anforderungen/" aria-label="Anforderungen"></span></div>
${f.fehler ? `<div class="fehl" role="alert">${esc(f.fehler)}</div>` : ''}
<div class="zeile"><button class="btn btn-haupt" data-act="first-ok">Einrichten und committen</button></div></div>
<aside class="first-r"><h3>KANBAND.MD <span class="mono">wird angelegt</span></h3><pre class="yaml" id="vorschau-einstellungen">${esc(einstellungenText(ersteEinstellungen(f)))}</pre><h3>BOARDS/${esc(slug(f.board) || '…').toUpperCase()}.MD</h3><pre class="yaml" id="vorschau-board">${esc(boardText(f.board.trim(), spaltenListe(f)))}</pre></aside></div>`;
}

function vStatus() {
  const z = S.zustand;
  if (!z) return '';
  const nd = (z.defekte || []).length;
  return `<span class="mono">${esc(z.ordner)}</span>${nd ? `<button class="lnk warn" id="t-defekt" data-act="pop" data-arg="defekt" aria-haspopup="dialog">${nd} ${nd === 1 ? 'defekte Datei' : 'defekte Dateien'}</button>` : ''}${z.eingerichtet ? `<span>${z.boards.length} ${z.boards.length === 1 ? 'Board' : 'Boards'}</span>` : '<span>kanbanD.md fehlt</span>'}${S.ui.fehler ? `<span class="fehl">${esc(S.ui.fehler)}</span>` : ''}${(n => n ? `<span class="auswahl-zahl">${n} ${n === 1 ? 'Karte' : 'Karten'} ausgewählt</span>` : '')(S.ui.auswahl.length)}<span class="rechts"><button class="lnk" data-act="hilfe" title="Tastenkürzel (?)">Tastenkürzel <kbd>?</kbd></button><a href="/api" target="_blank" rel="noopener">API für Agenten</a></span>`;
}
