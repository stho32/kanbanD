// R00241 Laufansicht — Filterwechsel auf großen Läufen ohne Einfrieren (Karte #265, I0231) — AK 1–3 im echten Programm; AK 4 ist die Spec von
// R00239 unverändert, AK 5 die Messung im Bericht (Beobachtung, kein Gate). Technik: ADR-0041 Nachtrag N5 „Durchsetzung“.
// Ausgangslage wie R00239: Board `fabrik` mit `record-transcripts: true`, an #1 liegt T1 aus R00234, über die API abgelegt.
// Mutanten (AK 2) setzt `KD_MUTANTE` ein (hilfen.js, Pfad `/web/kd-app.css`): m1 „Regel entfernt“, m2 „ohne :where“ — der Test muss rot werden.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { T1 } = require('./laufansicht-t1');

const KENNUNG = 'planer@2026-11-21T23:30+01:00';
const INSEL = '#lv-insel';
const STATUS = '#lv-status';
const ZEIGEN = '#lauf fieldset.lv-filt';

/** Der Baum der Hilfstechnik der Insel vor der Regel (R00241 AK 3): erfasst auf Stand ae5f68b, bevor `:where(.lv-l)>li` gebaut war. */
const SCHNAPPSCHUSS = `- list "Einträge des Transkripts der Reihe nach":
  - listitem:
    - group: "Auftrag Projekt: kanbanD · Karte: #247 23:30:00"
  - listitem:
    - group: Systemhinweis <system-reminder>Lies zuerst die Regeln.</system-reminder> 23:30:01
  - listitem: 21 s denkt
  - listitem:
    - group: Bash ls Anforderungen | tail -2 Nächste freie Nummer R00228-wackler-unter-last.md 4 s Tokens unbekannt
  - listitem:
    - group: "Bash grep -n kd-muted web/laeufe.js Fehler: Exit code 1 1 s Tokens unbekannt"
  - listitem: 5 s denkt
  - listitem:
    - group: Read parallel a.md 1→# a 2 s Tokens unbekannt
  - listitem:
    - group: "Read parallel b.md Fehler: <tool_use_error>File does not exist.</tool_use_error> 3 s Tokens unbekannt"
  - listitem:
    - group: Bash git status --short Arbeitsbaum prüfen kein error gefunden Dauer unbekannt Tokens unbekannt
  - listitem: 1 min 5 s wartet
  - listitem:
    - text: Mensch 23:31:50
    - paragraph: Bitte weiter.
  - listitem:
    - text: Agent 23:31:52 Tokens unbekannt
    - paragraph: "Zwischenstand, Ergebnis: befund mitten im Satz."
  - listitem: 38 s denkt
  - listitem:
    - group: SubagentHandback R00229 angelegt. kein Ergebnis Tokens unbekannt
  - listitem: Ende des Transkripts`;

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const sprache = (page, k) => ({
  async oeffnen() {
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(KENNUNG)}`);
    await expect(page.locator('#lv-h1')).toBeVisible();
    await expect(page.locator(STATUS)).toHaveText(/^Ende des Transkripts$/);
  },
  /** Vorgabe ist Nachrichten und Werkzeuge; „Systemhinweise“ dazu, damit alle drei Arten sichtbar sind. */
  async alleDreiArtenZeigen() {
    await page.locator(`${ZEIGEN} input[data-filter="h"]`).check();
    await expect(page.locator(ZEIGEN + ' input[data-filter="h"]')).toBeChecked();
  },
  /** `display` aller Kinder der Insel, gruppiert nach der Rolle der Zeile. */
  displayDerZeilen: () => page.locator(`${INSEL} > li`).evaluateAll(ls => ls.map(l => ({
    id: l.id, nachricht: l.classList.contains('lv-n'), luecke: l.classList.contains('lv-d'), display: getComputedStyle(l).display }))),
});

test.describe('R00241 Laufansicht: Filterwechsel ohne Einfrieren', () => {
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    await lv.hochladen(k.adresse, 1, KENNUNG, 'Detailplanung', lv.gz(T1.map(e => lv.zeile(e)).join('')));
    await s.oeffnen();
    await s.alleDreiArtenZeigen();
  });
  test.afterEach(() => k.stoppen());

  test('AK 1 · US-1: keine Zeile der Insel ist list-item, Nachrichten und Denkzeilen bleiben grid', async () => {
    test.fail(true, 'erwartet rot bis B1262 (Regel :where(.lv-l)>li)');
    const zeilen = await s.displayDerZeilen();
    // Vorbedingung: das Bild zeigt alle drei Arten, sonst wäre die Probe leer
    expect(zeilen.filter(z => z.nachricht).length, 'Nachrichten (lv-n)').toBeGreaterThan(0);
    expect(zeilen.filter(z => z.luecke).length, 'Denkzeilen (lv-d)').toBeGreaterThan(0);
    expect(zeilen.length, 'Zeilen der Insel').toBeGreaterThan(14);
    expect(zeilen.filter(z => z.display === 'list-item').map(z => z.id || 'ohne id'), 'Zeilen mit display: list-item').toEqual([]);
    expect(zeilen.filter(z => (z.nachricht || z.luecke) && z.display !== 'grid').map(z => `${z.id}: ${z.display}`), 'lv-n/lv-d ohne grid').toEqual([]);
  });

  test('AK 3 · US-1: der Baum der Hilfstechnik der Insel bleibt der von vor der Regel', async ({ page }) => {
    expect(await page.locator(INSEL).ariaSnapshot()).toBe(SCHNAPPSCHUSS);
  });
});
