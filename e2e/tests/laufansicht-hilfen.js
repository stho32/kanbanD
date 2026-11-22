// Ausgangslage von R00221 (Laufansicht): Board `fabrik` erfasst Transkripte, #1 trägt die Läufe L1–L9 (R00221 „Ausgangslage“).
// Die gz-Dateien erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/{nr}/transkripte` ab — der Server prüft nur die
// Kennbytes, also tragen auch die defekten den Zustand `vorhanden`. L3 wird danach im Ordner gelöscht (`fehlt`).
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const AGENT = 'entw1';
const MENSCH = 'sh';
const L = {
  L1: 'entwickler@2026-11-20T10:00+01:00',
  L2: 'planer@2026-11-20T09:00+01:00',
  L3: 'code-reviewer@2026-11-20T11:00+01:00',
  L4: 'a/b c%?@2026-11-20T13:00+01:00',
  L5: 'abgeschnitten@2026-11-20T14:00+01:00',
  L6: 'pruefsumme@2026-11-20T15:00+01:00',
  L7: 'zweiglied@2026-11-20T16:00+01:00',
  L8: 'bombe@2026-11-20T17:00+01:00',
  L9: 'einzeile@2026-11-20T18:00+01:00',
};

const zeile = o => JSON.stringify(o) + '\n';
/** Datei G (sechs Zeilen, R00221 AK 2). */
const G = [
  '{"zeit":"2026-11-20T10:00:41+01:00","art":"nachricht","wer":"agent","name":"entwickler","text":"Ich lese zuerst **die Anforderung**."}',
  '{"zeit":"2026-11-20T10:00:42+01:00","art":"werkzeugaufruf","wer":"agent","name":"Read","text":"Anforderungen/R00219.md"}',
  '   ',
  '{"art":"nachricht"',
  '{"zeit":"2026-11-20T09:00:43Z","art":"werkzeugergebnis","wer":"werkzeug","name":"Read","text":"---\\nid: R00219\\nstatus: Neu"}',
  '{"zeit":"gestern","art":"nachricht","wer":"mensch","text":"Passt."}',
].join('\n') + '\n';
/** Datei F (fremder Text). */
const F = zeile({ art: 'nachricht', wer: 'agent', name: 'planer', text: '<script>window.pwn=1</script> [x](javascript:window.pwn=2)' })
  + zeile({ art: 'werkzeugaufruf', wer: 'agent', name: 'Bash‮hs', text: 'echo <img src=x onerror=window.pwn=3>‮abc\nzweite Zeile' });

/** Pseudozufälliger, fester Text: komprimiert schlecht wie echte Läufe. */
function fuellung(laenge, saat) {
  let x = saat, aus = '';
  const zeichen = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJ0123456789.,;:-';
  while (aus.length < laenge) { x = (x * 1103515245 + 12345) % 2147483648; aus += zeichen[x % zeichen.length]; }
  return aus;
}
/** 856 Zeilen, zusammen etwa 1,6 MB entpackt — die Größe des größten echten Laufs. */
const GROSS = Array.from({ length: 856 }, (_, i) => zeile({ zeit: '2026-11-20T15:00:00+01:00', art: i % 2 ? 'werkzeugergebnis' : 'nachricht', wer: i % 2 ? 'werkzeug' : 'agent', name: 'Read', text: fuellung(1860, i + 1) })).join('');

const gz = text => zlib.gzipSync(Buffer.from(text));
/** CRC32 im Schluss verändert: entpackbar bis zum Ende, dann „incorrect data check“. */
function pruefsummeFalsch(text) {
  const d = Buffer.from(gz(text));
  d[d.length - 8] ^= 0xff;
  return d;
}
let bombeDaten = null;
/** ≈ 500 MB entpackt aus gültigen Zeilen zu je ≈ 1 KB; einmal je Prozess gerechnet. */
function bombe() {
  if (bombeDaten) return bombeDaten;
  const z = zeile({ art: 'nachricht', wer: 'agent', text: 'b'.repeat(980) });
  const block = Buffer.from(z.repeat(Math.floor(1048576 / z.length)));
  const deflate = zlib.createGzip({ level: 9 });
  const teile = [];
  deflate.on('data', d => teile.push(d));
  for (let i = 0; i < 500; i++) deflate.write(block);
  deflate.end();
  return new Promise(fertig => deflate.on('end', () => { bombeDaten = Buffer.concat(teile); fertig(bombeDaten); }));
}
const EINZEILE = () => gz(zeile({ art: 'nachricht', wer: 'agent', text: 'e'.repeat(17 * 1048576) }));

const DATEIEN = async () => [
  [L.L1, 'Entwicklung', gz(G)],
  [L.L2, 'Detailplanung', gz(F)],
  [L.L3, 'Reviews', gz(G)],
  [L.L4, 'Entwicklung', gz(zeile({ zeit: '2026-11-20T13:00:05+01:00', art: 'nachricht', wer: 'agent', name: 'a/b c%?', text: 'Ein Eintrag von L4.' }))],
  [L.L5, 'Entwicklung', gz(GROSS).subarray(0, -100)],
  [L.L6, 'Entwicklung', pruefsummeFalsch(GROSS)],
  [L.L7, 'Entwicklung', Buffer.concat([gz(G), gz(G)])],
  [L.L8, 'Entwicklung', await bombe()],
  [L.L9, 'Entwicklung', EINZEILE()],
];

const zeitAus = kennung => kennung.slice(kennung.lastIndexOf('@') + 1).replace('T', ' ');
const rolleAus = kennung => kennung.slice(0, kennung.lastIndexOf('@'));

/** Ordner mit Board `fabrik` (erfasst) und #1, #2; die Läufe kommen erst mit `ablegen` über die API. */
function ausgangslage() {
  return ordner => {
    const spalten = ['Detailplanung', 'Entwicklung', 'Reviews'];
    const dateien = {
      'kanbanD.md': `---\npeople:\n  sh: {name: Stefan, kind: human}\n  entw1: {name: Entwickler eins, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n---\n`,
      'boards/fabrik.md': `---\nrecord-transcripts: true\n---\n\n# fabrik\n\n${spalten.map(s => `## ${s}\n\n${s === 'Entwicklung' ? '- [#1](../aufgaben/0001-laeufe.md)\n- [#2](../aufgaben/0002-andere.md)\n' : ''}`).join('\n')}`,
      'aufgaben/0001-laeufe.md': '---\nid: 1\ntitle: Läufe L1 bis L9\n---\n',
      'aufgaben/0002-andere.md': '---\nid: 2\ntitle: Eine andere Aufgabe\n---\n',
    };
    for (const [rel, inhalt] of Object.entries(dateien)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'Ausgangslage R00221']);
  };
}

async function hochladen(adresse, nr, kennung, spalte, daten) {
  const form = new FormData();
  form.append('at', zeitAus(kennung));
  form.append('role', rolleAus(kennung));
  form.append('column', spalte);
  form.append('datei', new Blob([daten]), 'lauf.jsonl.gz');
  const antwort = await fetch(`${adresse}api/aufgaben/${nr}/transkripte`, { method: 'POST', headers: { 'X-KanbanD-Wer': AGENT }, body: form });
  if (antwort.status !== 201) throw new Error(`ablegen ${kennung}: ${antwort.status} ${await antwort.text()}`);
  return antwort.json();
}

/** Über die API: einen Kosteneintrag buchen, auf Wunsch mit `tokens` (R00238). */
async function buchen(adresse, nr, kennung, spalte, betrag, tokens) {
  const eintrag = { at: zeitAus(kennung), role: rolleAus(kennung), column: spalte, amount: betrag, currency: 'USD' };
  if (tokens !== undefined) eintrag.tokens = tokens;
  const antwort = await fetch(`${adresse}api/aufgaben/${nr}/kosteneintraege`, {
    method: 'POST', headers: { 'X-KanbanD-Wer': AGENT, 'Content-Type': 'application/json' },
    body: JSON.stringify(eintrag),
  });
  if (!antwort.ok) throw new Error(`buchen ${kennung}: ${antwort.status} ${await antwort.text()}`);
}

/** L1–L9 an #1 ablegen, L1 mit Kosten in „Reviews“, danach die Datei von L3 löschen. Liefert die Bytes je Kennung. */
async function ablegen(k) {
  const bytes = {};
  for (const [kennung, spalte, daten] of await DATEIEN()) bytes[kennung] = (await hochladen(k.adresse, 1, kennung, spalte, daten)).bytes;
  await buchen(k.adresse, 1, L.L1, 'Reviews', 1.80);
  const ordner = path.join(k.ordner, 'transkripte/0001');
  const l3 = fs.readdirSync(ordner).find(n => n.startsWith('code-reviewer@'));
  fs.rmSync(path.join(ordner, l3));
  return bytes;
}

async function kommentieren(adresse, nr, text) {
  const antwort = await fetch(`${adresse}api/aufgaben/${nr}/kommentare`, {
    method: 'POST', headers: { 'X-KanbanD-Wer': MENSCH, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  });
  if (!antwort.ok) throw new Error(`kommentieren: ${antwort.status} ${await antwort.text()}`);
}

module.exports = { L, AGENT, MENSCH, G, GROSS, ausgangslage, ablegen, buchen, kommentieren, hochladen, gz, zeile };
