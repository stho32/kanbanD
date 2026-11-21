// Ausgangslage von R00219 (Ansicht „Läufe“): Board `fabrik` erfasst Transkripte, Board `zweit` nicht (`record-transcripts`
// von Hand in der Board-Datei, R00216 AK 5). Die Aufgaben trennen ihre Proben: #1 die Läufe L1–L6, #2 nur Kosten, #3 auf
// `zweit`, #4 Breitendaten und fremder Text, #5 wie #1 mit einem Commit-Verweis, #6 genau ein Transkript ohne Kosten.
// Einträge und Dateien stehen vor dem Start in der Aufgabendatei bzw. unter `transkripte/` wie nach dem Ablegen über die API;
// was die Proben live ablegen, buchen oder löschen, geht über die API (`ablegen`, `buchen`, `entfernen`).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const AGENT = 'entw1';
const MENSCH = 'sh';
const L = {
  L1: 'planer@2026-11-20T09:00+01:00',
  L2: 'entwickler@2026-11-20T10:00+01:00',
  L3: 'code-reviewer@2026-11-20T11:00+01:00',
  L4: 'entwicklertester@2026-11-20T12:00+01:00',
  L5: 'architekt@2026-11-20T08:00+01:00',
};
const SPALTEN = ['Detailplanung', 'Architektur', 'Entwicklung', 'Reviews', 'Entwicklertest'];
const ROLLE_40 = 'r'.repeat(40);
const SPALTE_60 = 'S'.repeat(60);
const SPALTE_FREMD = '<img src=x onerror=window.pwn=1> ‮"x"';
const BOARD_60 = 'b'.repeat(60);

/** gzip-Kennbytes und Füllung: der Server entpackt nicht, er prüft Größe und die ersten drei Byte (ADR-0036 Regel 5). */
const gzipDaten = bytes => Buffer.concat([Buffer.from([0x1f, 0x8b, 0x08]), Buffer.alloc(bytes - 3, 0x5a)]);

/** Zeitpunkt der Datei aus der Kennung: `role@2026-11-20T09:00+01:00` → `2026-11-20 09:00+01:00`. */
const zeitAus = kennung => kennung.slice(kennung.lastIndexOf('@') + 1).replace('T', ' ');
const rolleAus = kennung => kennung.slice(0, kennung.lastIndexOf('@'));
/** Dateiname wie `Transkripteintrag::dateiname` (Rolle hier schon gefaltet): `planer@2026-11-20T0900+0100.jsonl.gz`. */
const dateiname = kennung => `${rolleAus(kennung)}@${zeitAus(kennung).replace(' ', 'T').replace(/:/g, '')}.jsonl.gz`;

const transkriptZeile = (kennung, spalte, bytes) => `  - {at: ${zeitAus(kennung)}, role: ${rolleAus(kennung)}, column: ${spalte}, bytes: ${bytes}}\n`;
const kostenZeile = (kennung, spalte, betrag) => `  - {at: ${zeitAus(kennung)}, role: ${rolleAus(kennung)}, column: ${JSON.stringify(spalte)}, amount: ${betrag}, currency: USD}\n`;

/** Eine Aufgabendatei mit `transcripts` und `cost-entries`; `dateien` legt je Kennung die Datei mit dieser Größe an. */
function aufgabe(nr, titel, { transkripte = '', kosten = '', zusatz = '' } = {}) {
  const teile = [`id: ${nr}`, `title: ${titel}`];
  if (zusatz) teile.push(zusatz.trimEnd());
  if (transkripte) teile.push('transcripts:\n' + transkripte.trimEnd());
  if (kosten) teile.push('cost-entries:\n' + kosten.trimEnd());
  return `---\n${teile.join('\n')}\n---\n`;
}

const BYTES = 2048;
/** #1 (R00219 Ausgangslage): L1, L2 vorhanden; L3 ohne Datei (`fehlt`); L5 um ein Byte länger (`abweichend`); L6 formwidrig; L4 nur Kosten. */
const TRANSKRIPTE_1 = transkriptZeile(L.L1, 'Detailplanung', BYTES) + transkriptZeile(L.L2, 'Entwicklung', BYTES)
  + transkriptZeile(L.L3, 'Reviews', BYTES) + transkriptZeile(L.L5, 'Architektur', BYTES) + '  - {bytes: zwei}\n';
const KOSTEN_1 = kostenZeile(L.L1, 'Detailplanung', 0.42) + kostenZeile(L.L2, 'Reviews', 1.80) + kostenZeile(L.L4, 'Entwicklertest', 0.30) + kostenZeile(L.L5, 'Architektur', 0.55);
const DATEIEN_1 = [[L.L1, BYTES], [L.L2, BYTES], [L.L5, BYTES + 1]];

const L3_ZWEIT = 'entwickler@2026-11-20T15:00+01:00';
const L_ZWEIT_KOSTEN = 'entwickler@2026-11-21T09:00+01:00';
const L_BREIT = `${ROLLE_40}@2026-11-20T16:00+01:00`;
const L_EINZEL = 'planer@2026-11-19T09:00+01:00';

function boardDatei(name, erfassen, eintraege) {
  const spalten = SPALTEN.map(s => `## ${s}\n\n${eintraege[s] || ''}`).join('\n');
  return `---\nrecord-transcripts: ${erfassen}\n---\n\n# ${name}\n\n${spalten}`;
}

/** Die Ausgangslage im Ordner, committet; die Dateien unter `transkripte/` bleiben unversioniert wie nach dem Ablegen. */
function ausgangslage() {
  const kanbanD = `---\npeople:\n  sh: {name: Stefan, kind: human}\n  entw1: {name: Entwickler eins, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n---\n`;
  const link = (nr, slug) => `- [#${nr}](../aufgaben/000${nr}-${slug}.md)\n`;
  const dateien = {
    'kanbanD.md': kanbanD,
    'boards/fabrik.md': boardDatei('fabrik', true, { Entwicklung: link(1, 'laeufe') + link(2, 'nur-kosten') + link(4, 'breit') + link(5, 'mit-commit') + link(6, 'einzeln') }),
    'boards/zweit.md': boardDatei('zweit', false, { Entwicklung: link(3, 'zweit'), Reviews: link(4, 'breit') }),
    'aufgaben/0001-laeufe.md': aufgabe(1, 'Läufe L1 bis L6', { transkripte: TRANSKRIPTE_1, kosten: KOSTEN_1 }),
    'aufgaben/0002-nur-kosten.md': aufgabe(2, 'Nur Kosten', { kosten: kostenZeile('planer@2026-11-20T09:30+01:00', 'Detailplanung', 0.10) }),
    'aufgaben/0003-zweit.md': aufgabe(3, 'Auf zweit', { transkripte: transkriptZeile(L3_ZWEIT, 'Entwicklung', BYTES), kosten: kostenZeile(L_ZWEIT_KOSTEN, 'Entwicklung', 0.20) }),
    'aufgaben/0004-breit.md': aufgabe(4, 'Breitendaten', {
      transkripte: TRANSKRIPTE_1 + transkriptZeile(L_BREIT, 'Entwicklung', BYTES),
      kosten: KOSTEN_1 + kostenZeile(L_BREIT, SPALTE_60, 0.70) + kostenZeile(`fremd@2026-11-20T17:00+01:00`, SPALTE_FREMD, 0.05),
    }),
    'aufgaben/0005-mit-commit.md': aufgabe(5, 'Mit Commit', { transkripte: TRANSKRIPTE_1, kosten: KOSTEN_1, zusatz: 'commits: [kd:a41e0c5]' }),
    'aufgaben/0006-einzeln.md': aufgabe(6, 'Ein Lauf', { transkripte: transkriptZeile(L_EINZEL, 'Detailplanung', BYTES) }),
  };
  const transkriptdateien = [
    ...[1, 4, 5].flatMap(nr => DATEIEN_1.map(([k, b]) => [nr, k, b])),
    [3, L3_ZWEIT, BYTES], [4, L_BREIT, BYTES], [6, L_EINZEL, BYTES],
  ];
  return ordner => {
    for (const [rel, inhalt] of Object.entries(dateien)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'Ausgangslage R00219']);
    for (const [nr, kennung, bytes] of transkriptdateien) {
      const ziel = path.join(ordner, 'transkripte', String(nr).padStart(4, '0'), dateiname(kennung));
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      fs.writeFileSync(ziel, gzipDaten(bytes));
    }
    fs.writeFileSync(path.join(ordner, 'transkripte/.gitignore'), '*\n');
  };
}

/** Über die API: ein Transkript ablegen (multipart, die Datei zuletzt). */
async function ablegen(adresse, nr, kennung, spalte) {
  const form = new FormData();
  form.append('at', zeitAus(kennung));
  form.append('role', rolleAus(kennung));
  form.append('column', spalte);
  form.append('datei', new Blob([gzipDaten(BYTES)]), 'lauf.jsonl.gz');
  const antwort = await fetch(`${adresse}api/aufgaben/${nr}/transkripte`, { method: 'POST', headers: { 'X-KanbanD-Wer': AGENT }, body: form });
  if (antwort.status !== 201) throw new Error(`ablegen ${kennung}: ${antwort.status} ${await antwort.text()}`);
}

/** Über die API: einen Kosteneintrag buchen. */
async function buchen(adresse, nr, kennung, spalte, betrag) {
  const antwort = await fetch(`${adresse}api/aufgaben/${nr}/kosteneintraege`, {
    method: 'POST', headers: { 'X-KanbanD-Wer': AGENT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ at: zeitAus(kennung), role: rolleAus(kennung), column: spalte, amount: betrag, currency: 'USD' }),
  });
  if (antwort.status !== 201 && antwort.status !== 200) throw new Error(`buchen ${kennung}: ${antwort.status} ${await antwort.text()}`);
}

/** Über die API: ein Transkript entfernen. */
async function entfernen(adresse, nr, kennung) {
  const antwort = await fetch(`${adresse}api/aufgaben/${nr}/transkripte/${encodeURIComponent(kennung)}`, { method: 'DELETE', headers: { 'X-KanbanD-Wer': AGENT } });
  if (!antwort.ok) throw new Error(`entfernen ${kennung}: ${antwort.status} ${await antwort.text()}`);
}

/** Über die API: als Mensch kommentieren. */
async function kommentieren(adresse, nr, text) {
  const antwort = await fetch(`${adresse}api/aufgaben/${nr}/kommentare`, {
    method: 'POST', headers: { 'X-KanbanD-Wer': MENSCH, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  });
  if (!antwort.ok) throw new Error(`kommentieren: ${antwort.status} ${await antwort.text()}`);
}

module.exports = { L, L3_ZWEIT, L_ZWEIT_KOSTEN, L_BREIT, L_EINZEL, ROLLE_40, SPALTE_60, SPALTE_FREMD, BOARD_60, AGENT, MENSCH, BYTES, ausgangslage, ablegen, buchen, entfernen, kommentieren, gzipDaten, dateiname };
