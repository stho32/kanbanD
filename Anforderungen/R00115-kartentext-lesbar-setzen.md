---
id: R00115
status: Neu
datum: 2026-11-10
---

# R00115: Kartentext lesbar setzen

## Beschreibung

Zwei Mängel der Karte aus der UX-Durchsicht Material 3 (2026-10-31, Schweregrad Optional), beide im Text der Karte (`.ka`):

1. **Der Titel bricht mitten im Wort.** `.ka .t` setzt `overflow-wrap:anywhere` (`web/kd-app.css:147`): Steht ein Timer-Chip in der Kopfzeile, zerfällt z. B. „Volltextsuche“ in „Volltextsu|che“. Nach ADR-0019 Nachtrag N4 (Commit `5dbaee5`) bricht der Titel nur noch zwischen Wörtern (`break-word` statt `anywhere`), und die Kopfzeile **jeder** Karte mit Platznot bricht um — der Chip steht dann in einer eigenen Zeile unter dem Titel; ohne Platznot bleibt alles in einer Zeile.
2. **Sichtbarer Text unter 11 px.** Material 3 setzt die kleinste Schrift `label-small` auf 11 px (https://m3.material.io/styles/typography/type-scale-tokens, abgerufen 2026-10-31). Unter dieser Grenze liegen heute: Initialen `.pk` 8–9 px (`web/kd-base.css:37`; `web/kd-app.css:67`, `:605`, `:714`), Labels `.lbl` 10,5 px (`web/kd-base.css:45`), Herkunfts-Chip `.org` und Wirkungs-Chip `.wchip` 10,5 px (`web/kd-app.css:172`, `:175`), daneben außerhalb der Karte das Datum der Kopfzeilen-Navigation `.kz-nav a .dd` 9 px (`web/kd-app.css:32`) u. a.

Nicht Teil: Form, Maße und Token-Paar des Timer-Chips (ADR-0019 Regel 6, ADR-0011 — der Laufchip trägt heute schon 11 px); neues Markup, neue Klassen oder neue Zustände; die vergessene Karte und ihre Regeln (R00114, bleiben); API, Dateiformat, Server.

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiterfassung, die zum Arbeiten passt“: wer am Board eine Karte liest, erkennt das Wort wieder, statt es zusammenzusetzen, und liest jede Zeile in einer Schrift, die Material 3 als kleinste lesbare vorsieht.

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Ein Titel, der mitten im Wort zerbricht, muss zusammengesetzt werden, bevor er verstanden ist; das kostet am Board den ersten Blick, der einer Karte gilt. Schriften unter 11 px sind nach Material 3 keine Lesetexte mehr — Initialen und Labels der Karte sind aber genau das: sie entscheiden, wem die Karte gehört und was sie trägt. Mit dem Umbruch zwischen den Wörtern und der 11-px-Grenze liest sich die Karte auf den ersten Blick; die Karten bleiben dabei in ihrer Spalte, nichts scrollt quer.

## Funktionale Anforderungen

### Umbruch des Titels (ADR-0019 Nachtrag N4)

1. `.ka .t` bricht Wörter nicht mehr auseinander, wo Platz zwischen ihnen ist: `overflow-wrap:break-word` statt `anywhere`. Ein Umbruch fällt zwischen zwei Wörtern; ein Wort, das allein nicht mehr in die Zeile passt, darf innerhalb brechen (das erlaubt `break-word` — nötig, sonst überläuft der Titel seine Karte). Der Umbenennen-Titel `.ka .r0 .umbenennen` ist ein einzeiliges Eingabefeld, `overflow-wrap` wirkt dort nicht — ihn hält seine Mindestbreite (FA 3).
2. Der Umbruch der Kopfzeile ist Rückfall an **jeder** Karte mit Platznot, nicht nur an der vergessenen (N4 Regel 1): `flex-wrap:wrap` an `.ka .r0` statt nur `.ka.vergessen .r0`. Passt der Titel nebst Nummer, Signalen und laufendem Timer nicht in eine Zeile, steht der Chip in einer eigenen Zeile unter dem Titel.
3. Der Titel behält in der Kopfzeile seine Mindestbreite 90 px (`min-width:90px` an `.r0 .t` und `.r0 .umbenennen`, heute nur an der vergessenen Karte): auch bei Platznot bleibt der Titel mindestens 90 px breit — kein voller Zeilenverlauf drückt ihn darunter.
4. Ohne Platznot bleibt die Kopfzeile einzeilig — eine Karte, deren Titel samt Chip in eine Zeile passt, bricht nicht um (Früh-Indikator des Nachtrags: eine zweizeilige Kopfzeile ohne Platznot ist ein Befund, kein Zustand).

### Kleinste Schrift 11 px (M3 label-small)

5. Kein sichtbarer Text in einer Karte hat eine berechnete `font-size` unter 11 px: `.pk` (Initialen, auch die kleineren Quadrate `.kz-btn .pk`, `.schnell .pk`, `.bf-chip .pk`), `.lbl`, `.org`, `.wchip` — die umgebenden Maße (Quadrate, `.pk` 16–18 px) dürfen mitwachsen; die Kontraste und Flächen (ADR-0011) bleiben.
6. Dieselbe Grenze gilt außerhalb der Karte an den vier genannten Kleintexten: `.kz-nav a .dd` (Datum der Kopfzeilen-Navigation), `.kz-btn .pk`, `.schnell .pk`, `.bf-chip .pk` — keine dieser Stellen bleibt unter 11 px. Die übrigen Kleintexte des Stylesheets folgen derselben Regel und bleiben der Regel-Notiz (A00009) überlassen, hier nicht geprüft.
7. Nicht sichtbarer Text (visuell verborgene Überschriften `.vh`, ADR-0018) ist von der Grenze nicht betroffen; der Laufchip bleibt bei 11 px wie heute (Regel 6).

## Nicht-funktionale Anforderungen

1. **Barrierefreiheit**: 11 px ist die kleinste Schrift nach M3 `label-small` — darunter liest keine Rolle der Hilfstechnik mehr flüssig; die Grenze gilt für sichtbaren Text, egal in welcher Schriftfamilie.
2. **Breite**: Der neue Umbruch erzeugt kein Querscrollen und keinen Überlauf in die Nachbarspalte (ADR-0012, ADR-0015); die Breitenproben der Karte #15 (`r00114`) laufen mit als Wächter.
3. **Rückwärtskompatibel**: keine Änderung an API, Dateiformat, Commit-Texten oder Markup-Struktur; nur CSS-Werte.
4. **Kontrast unverändert**: Flächen, Schrift- und Punktfarben bleiben die der Tokens (ADR-0011); die Kontrastproben laufen mit.

## Akzeptanzkriterien

Geprüft mit dem Grundbestand aus `user-stories/R00115.md`.

- [ ] **1. Abnahme-Probe der Karte #16, Teil Umbruch (wörtlich)**: „In `.ka .t` endet keine Zeile mitten in einem Wort (Karte mit laufendem Timer, 1280 px).“
  - Besteht: Karte mit dem langen Titel „Volltextsuche über alle Boards und Aufgaben“ und laufendem Timer bei 1280 px — jede sichtbare Zeile des Titels endet an einer Wortgrenze; der Titel ist vollständig lesbar (nicht abgeschnitten).
  - Fällt durch: heute „Volltextsu|che“ — eine Zeile, die mitten im Wort endet (Bestand `overflow-wrap:anywhere`).
  - Prüfebene: E2E `r00115-kartentext.spec.js` US-1.
- [ ] **2. Abnahme-Probe der Karte #16, Teil Schrift (wörtlich)**: „Kein sichtbarer Text in `.ka` hat eine berechnete `font-size` unter 11 px.“
  - Besteht: Karte mit Initialen (eigen und fremd), Label, Herkunfts-Chip und laufendem Timer — `getComputedStyle(...).fontSize` jedes sichtbaren Textelements in `.ka` ≥ 11 px, in Hell und Dunkel.
  - Fällt durch: `.pk` 8/8,5/9 px, `.lbl`/`.org`/`.wchip` 10,5 px (Bestand).
  - Prüfebene: E2E US-3.
- [ ] **3. Kopfzeilen-Umbruch als Rückfall an jeder Karte (N4)**: Karte mit laufendem Timer und Platznot (Titel nebst Nummer, Signal und Chip passt nicht in eine Zeile) — der Chip steht in einer eigenen Zeile unter dem Titel, auch **ohne** vergessenen Timer; der Titel behält ≥ 90 px, auch in Bearbeitung (`.r0 .umbenennen`, ≥ 90 px bei 1280 px). Karte ohne Platznot — Kopfzeile bleibt einzeilig (Früh-Indikator: zweizeilig ohne Platznot ist rot). Die Breitenproben der Karte #15 (`r00114-vergessene-timer.spec.js`, 1280/414/320, ein und zwei Timer) laufen mit und bleiben grün.
  - Prüfebene: E2E US-2; `npx playwright test r00114` grün.
- [ ] **4. Grenzfall langes Einzelwort**: Ein Titel aus einem langen Einzelwort (länger als die Zeile) bricht innerhalb des Wortes (bleibt `break-word` — nötig, sonst überläuft der Titel), bleibt aber ganz im Kartenrechteck, und die Karte bleibt in der Spalte; kein Querscrollen bei 1280, 414 und 320 px.
  - Prüfebene: E2E US-4 (`ziele.spec.js`-Muster).
- [ ] **5. Kleinste Schrift auch außerhalb der Karte**: `.kz-nav a .dd`, `.kz-btn .pk`, `.schnell .pk`, `.bf-chip .pk` haben berechnet ≥ 11 px; kein sichtbarer Text der vier genannten Stellen bleibt darunter.
  - Prüfebene: E2E US-3 (Selektorliste, `getComputedStyle`).

## Betroffene Verzeichnisstruktur

```
web/
├── kd-app.css    # .ka .t break-word statt anywhere (:147), .ka .r0 flex-wrap (:141-Umfeld), .org/.wchip/.kz-btn .pk/.schnell .pk/.bf-chip .pk/.kz-nav a .dd (:32, :67, :172, :175, :605, :714)
├── kd-base.css   # .pk (:37), .lbl (:45)
└── (kein JS, kein Server, kein Format)
e2e/
└── tests/        # r00115-kartentext.spec.js (neu); r00114, r00113, kultur, ziele, kontrast laufen mit
```

## Technische Überlegungen

Nach ADR-0019 Nachtrag N4 (Akzeptiert, Commit `5dbaee5`); Fundstellen am Stand `84a81cc` geprüft (planer): `web/kd-app.css:147` (`overflow-wrap:anywhere`), `:141` (`.ka.vergessen .r0{flex-wrap:wrap}` — wird verallgemeinert), `web/kd-base.css:37/:45`, `web/kd-app.css:32/:67/:172/:175/:605/:714`.

- **Umbruch**: `.ka .r0 { flex-wrap:wrap }` statt `.ka.vergessen .r0`; `min-width:90px` an `.r0 .t`/`.r0 .umbenennen` allgemein; `overflow-wrap:break-word` in `.ka .t`. Die Karte ohne Platznot bleibt einzeilig, weil `flex-wrap` nur bei Überhang umbaut.
- **Schrift**: 11 px (`label-small`) an den kleinen Stellen; die Quadrate (`.pk` 16–18 px) dürfen mitwachsen. Der Laufchip (`.lauf`, 11 px) bleibt unberührt (Regel 6).
- **Wächter**: die Breitenproben der Karte #15 laufen mit (`r00114`); neu ist die Gegenprobe „zweizeilig ohne Platznot“ (AK 3).

### Umfang

Eine kleine Karte (Optional): CSS an zwei Dateien, ein neuer E2E-Strang, keine Bubbles vorgeplant — die Detailplanung dieser Karte bleibt bei der Interaction; Features/Bubbles stellt der Entwickler bei Bedarf (`/planung verfeinern`), geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

Nach Skill `test-pyramide`; jede Szene der User Story ein Test, jeder prüft eine sichtbare Zustandsänderung.

- **E2E (Playwright)**: neu `e2e/tests/r00115-kartentext.spec.js` mit US-1 bis US-4 (Muster `r00114`: `kanbanD-time`-Fixture, laufender Timer; Breitenproben nach `ziele.spec.js`; `getComputedStyle` für die Schriftgrenzen, auch im dunklen Zustand).
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #16; US-1 ist der erste rote Test.
- **Gegenproben (Mutanten)**: `overflow-wrap:anywhere` zurück (AK 1 rot), `.ka .r0` ohne `flex-wrap` (AK 3 rot), eine der Schriften unter 11 px (AK 2/5 rot), zweizeilige Kopfzeile ohne Platznot (AK 3 rot).
- **Mitlaufend grün**: `r00114-vergessene-timer.spec.js`, `r00113-struktur.spec.js`, `kultur.spec.js`, `ziele.spec.js`, `kontrast.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0019 Nachtrag N4 (Kopfzeilen-Umbruch als Rückfall an jeder Karte, `5dbaee5`), Regel 6 (Form/Maße/Token-Paar des Chips bleiben); ADR-0011 (Kontrast), ADR-0012 (Trefferfläche), ADR-0015 (Umbruch als Antwort), ADR-0013 (Anzeigekultur); M3 type scale `label-small` 11 px.
- Abhängig von (grün): I0103 Vergessene Timer (R00114 — dessen Kopfzeilen-Umbruch wird verallgemeinert; die Breitenproben laufen als Wächter mit).
- Blockiert: keine.

## Offene Fragen

Keine — Architektur und Rückfall sind durch ADR-0019 N4 entschieden (Architektur bestanden, `84a81cc`); die 11-px-Frage ist keine Architekturfrage und hier als Anforderung gesetzt.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist ein Umbruch, der keine Rücksicht auf Wörter nimmt: `anywhere` bricht an jedem Zeichen, sobald der Chip Platz braucht — „Volltextsuche“ wird zu „Volltextsu|che“, und der lesende Mensch setzt das Wort erst zusammen, bevor er die Karte versteht. `break-word` verschiebt den Umbruch zwischen die Wörter; nur ein Wort, das allein nicht mehr passt, bricht innerhalb — der Regelfall bleibt lesbar, der Grenzfall bleibt in der Karte. Der Rückfall an jeder Karte (N4) beseitigt zugleich die Sonderrolle der vergessenen Karte: Platznot ist eine Frage des Platzes, nicht des Zustands, und die Kopfzeile gibt nach, statt den Titel auf 54 px zu drücken. Die 11-px-Grenze wirkt in dieselbe Richtung von unten: Initialen und Labels sind Lesetexte über einer farbigen Fläche, und Material 3 nennt mit `label-small` die kleinste Schrift, die das noch ist. Beides zusammen — Umbruch an Wortgrenzen, Schrift ab 11 px — macht die Karte zu etwas, das auf den ersten Blick liest; mehr ist die Karte nicht da.

## Missing-Docs

- `A00009` (Oberfläche): die 11-px-Grenze als Regel notieren, damit neue Stile sie nicht wieder unterschreiten.

## Notizen

- **Elterndialog D0002** (wie R00114): die Karte liegt im Hauptbereich des Boards, Titel, Chip und Labels sind Karteninhalte; die übrigen Stellen (`.kz-nav a .dd`, `.kz-btn .pk`) sind Kleintexte am selben Bild, außerhalb der Karte, und folgen derselben Regel (geprüft, FA 6, AK 5).
- **Kein Blättern vorgeplant**: die Karte ist klein (Optional, zwei CSS-Dateien); die Interaction trägt Umfang und Fertig-Kriterium, Bubbles ergänzt der Entwickler nur, wenn der Bau sie braucht. Der Director kann die Interaction verfeinern lassen, ohne dass etwas veraltet.
- **Optionen (verworfen)**: (a) nur `break-word` ohne Verallgemeinerung des Rückfalls — verworfen, N4 Regel 1 ordnet den Umbruch an jede Karte mit Platznot; (b) Schriftgrenze nur in `.ka` — verworfen, der Architekt nennt `.kz-nav a .dd` u. a. ausdrücklich als betroffen, die Probe der Karte bleibt trotzdem der wörtliche Kern; (c) `break-all` — verworfen, das bricht wie `anywhere` an jedem Zeichen.
- **Bewusst getrennt von R00114**: Die vergessene Karte behält ihre Regeln (min-width 90 px darf dann entfallen, weil allgemein); `r00114` läuft als Wächter mit, damit der Titelbruch der Karte #15 nicht zurückkommt.