---
id: R00268
status: Neu
datum: 2026-11-27
---

# R00268: Laufansicht — Commits als Striche in der Zeitachse, Verdichtung nach Abstand

## Beschreibung

Ausbaustufe 2 von [R00251](R00251-laufansicht-commits-des-laufs-als-marker.md) (Karte #271, WBS F0199, vorher B1327 `ausbau`): Wer einen Lauf liest, sieht jeden Commit dieses Laufs zusätzlich als Strich in der Zeitachse, an der Stelle der kumulierten Dauer bis zum Ergebnis seines Schritts, und kann von dort mit einem Klick zur Marker-Zeile springen. Die Striche verdichten sich von links nach rechts nach ihrem Abstand, damit sie auf jeder Breite (320 und 1280 px) getrennt bleiben und einzeln bedienbar sind; ein Lauf ohne Commit lässt die Zeitachse unverändert. Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N8; Produkt `AI-Team/po-entscheidungen.md` Z. 664 (a), 691, 697; Zeichnung D0009 `#laufansicht` Bild 15.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): die Zeitachse zeigt, wann im Lauf committet wurde; der Strich verbindet den Zeitpunkt mit der Marker-Zeile, nur lesend (Nicht-Ziel „Kein Git-Client“ bleibt gewahrt).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) (ersetzt die Insel der Einträge nicht; die Zeitachse steht außerhalb der Insel)

## Geschäftlicher Nutzen

Ausbaustufe 1 ([R00251](R00251-laufansicht-commits-des-laufs-als-marker.md)) zeigt jeden Commit an seiner Schrittzeile. Die Zeitachse ist die zweite Darstellung derselben Marker: sie beantwortet die Frage „wann im Lauf wurde committet, relativ zu den Werkzeugen und Denkschritten“. Gezählt in ADR-0041 N7 „Belegt“ (5 Karten, alle Transkripte): 89 Aufrufe mit `git … commit`, davon 86 mit `-q`; die Zeitachse ordnet sie räumlich ein und führt mit einem Klick zur Zeile. Ohne sie bleibt die Zeitachse der einzige Teil der Laufansicht, der Commits verschweigt.

## Funktionale Anforderungen

1. **Striche** (R00251 FA 7, ADR-0041 N8 Punkt 1): Je Stelle ein Strich über den Fächern an der kumulierten Dauer bis zum Ergebnis des Schritts — **derselbe Maßstab wie die Stücke und Fächer** (N1 Punkt 2), aus derselben Auswertung, ohne Rückblick —, Beschriftung Kurzhash; mehrere Marker am selben Schritt verschmelzen zu **einer** Stelle, Beschriftung „<n> Commits“ (n = Zahl der Marker an dieser Stelle). Höchstens 100 Striche; sind mehr Marker da, sagt der Lesetext die Kürzung an („<gezeigt> von <gesamt> Commits“, FA 8) — kein stiller Verlust. Alles Rechnende bleibt in `web/lauf-commits.js`; `web/app.js` rechnet keine Positionen.
2. **Verdichtung nach Abstand** (UX-Vorprüfung M1, ADR-0041 N8 Punkt 6): Von links nach rechts geht ein Strich in den vorigen Knopf auf, wenn ihre Mitten weniger als 24 px auseinanderlägen **oder** ihre Beschriftungen sich überschneiden würden (Mittenabstand < halbe Summe der Beschriftungsbreiten). Der zusammengefasste Knopf steht an der Stelle seines **ersten** Strichs und heißt „<n> Commits“, n = **Summe der Marker** (nicht der Striche davor). Danach liegen die Mitten benachbarter Knöpfe ≥ 24 px auseinander, Knöpfe mit Beschriftung ≥ um die Beschriftungsbreite, und keine Beschriftungen überschneiden sich. **Randform:** Der erste und der letzte Knopf werden am Rand der Zeitachse ausgerichtet — Spiegel der vorhandenen rechten Randform `.lv-ck>li.re` (D0009 Bild 15, `transform: translateX(-100 %)`) —, damit jede Beschriftung ganz in der Zeitachse liegt; die Mitten benachbarter Knöpfe bleiben dabei ≥ 24 px auseinander.
3. **Zwei Durchläufe im selben Vorgang, Breitenwechsel** (ADR-0041 N8 Punkte 2, 3): Beim Zeichnen werden die Knöpfe zuerst unverdichtet gesetzt, **unmittelbar danach, in derselben Aufgabe**, gemessen, verdichtet und **nur die Knopfleiste** ersetzt (kein Neulesen des Transkripts, kein Flackern); die Breiten gelten erst nach `document.fonts.ready`, sonst folgt eine zweite Messung. Ein **Durchlauf** ist: unverdichtet setzen → messen → verdichten → Knopfleiste **einmal** ersetzen; die `fonts.ready`-Nachmessung ist ein eigener Durchlauf. Ein Fenstergröße-Wechsel wiederholt **nur** Messen + Verdichten + Knopfleiste ersetzen, **ohne `render()` und ohne neue Anfrage**; das Ergebnis wird je `(Achsenbreite, Strichzahl)` gemerkt.
4. **Gruppe und Namen** (UX-Vorprüfung M2, ADR-0041 N8 Punkt 4): Die Knöpfe (`.lv-ckb`) stehen in einem `div[role="group"][aria-label="Commits der Zeitachse"]` **neben** dem `role="img"`-Balken, **nie darin**; der Balken bleibt aus der Tab-Reihenfolge. Name eines Knopfs „Commit <kurzhash>, zur Zeile springen“, verdichtet „<n> Commits, zur ersten Zeile springen“; der Name enthält den sichtbaren Text (`span.t`).
5. **Tastatur** (UX-Vorprüfung S1, ADR-0041 N8 Punkt 4): **ein** Tab-Stopp über wandernden `tabindex` (genau ein Knopf `0`, die übrigen `-1`; beim ersten Zeichnen der erste, sonst der zuletzt fokussierte); Pfeil links/rechts bewegt den Fokus auf den vorigen/nächsten Knopf, Pos1/Ende auf den ersten/letzten. Der erste Tab in die Gruppe trifft genau einen Knopf; der nächste Tab **verlässt die Gruppe** wieder (das Ziel liegt außerhalb, `closest('[role="group"]')` ist `null`), gleich wie viele Striche es gibt. Baut ein Live-Ereignis die Knopfleiste neu (Lauf aktiv), bleibt genau **ein** `tabindex="0"`; er gehört dem zuletzt fokussierten Knopf (war der Fokus nicht in der Gruppe, dem ersten), und der Fokus kehrt in die neue Leiste zurück statt auf `body` zu fallen.
6. **Sprung** (UX-Vorprüfung S2, S3; ADR-0041 N8 Punkt 5): Ein Knopf springt zu seiner Marker-Zeile (`.lv-cm`), ein verdichteter zur ersten seiner Marker-Zeilen — über `data-act`/`data-ziel` (`lv-cm<nr>`), `scrollIntoView` und Fokus; **nie** über `href="#…"` (der Hash ist die Adresse der Seite, ADR-0029). Die Marker-Zeile trägt danach den Fokus mit **vollständig sichtbarem** Fokusumriss (≥ 2 px breit, Kontrast ≥ 3 : 1 zum Grund, hell und dunkel; nicht vom Balken, der Zeitachse oder dem Seitenrand abgeschnitten); bei `prefers-reduced-motion: reduce` ohne weiches Scrollen.
7. **Zielfläche** (PO Z. 664 (a)): Jeder Strich-Knopf hat im Bau eine Zielfläche von mindestens `--kd-ziel` in der **Höhe** (`min-block-size`), auf jeder Breite; die **Breite bleibt wie gezeichnet**. Gemessen wird die Zielfläche, nicht der Strich.
8. **Legende und Lesetext** (PO Z. 691, UX-Vorprüfung S5): Die Legende führt „Commit“ **nur**, wenn der Lauf mindestens einen Strich hat; der Lesetext der Zeitachse endet dann mit „, <n> Commits“, bei genau einem Marker mit „, 1 Commit“ (n = Zahl der Marker), bei gekürzter Anzeige (FA 1) mit „, <gezeigt> von <gesamt> Commits“. Ein Lauf ohne Strich (auch einer mit Text-Marker, aber ohne Zeitachse) zeigt Zeitachse, Legende und Lesetext **byte-gleich** wie vor dieser Anforderung.
9. **Filter** (ADR-0041 N8 Punkt 9): Die Striche gehören zur Zeitachse **außerhalb** der Insel; ein Filterwechsel ändert weiter nur Attribute an der Wurzel der Insel und lässt die Striche stehen.
10. **Reinheit** (ADR-0041 N8 Punkt 1): `zeitachseStriche`/`stricheVerdichten` liegen rein in `web/lauf-commits.js` (Browser und Node, ohne DOM und `fetch`); `web/lauf.js` zeichnet nur; kein zweiter Weg rechnet `anteil`.

## Nicht-funktionale Anforderungen

- **Sicherheit** (Label `sicherheit`, ADR-0041 N8 Review-Punkt): In `href`, `title`, `data-*` oder eine Anfrage fließt weiterhin **kein** Text aus dem Transkript; der Sprung nutzt nur `data-act`/`data-ziel` aus den Kartenmarkern, `data-ziel` ist `lv-cm<nr>` mit einer Zahl.
- **Zugänglichkeit**: Striche tragen Text, nicht nur Farbe; Name, Gruppe, Rollen, Fokusumriss und Zielfläche wie M2/PO Z. 664 (a); Text ≥ 4,5 : 1, Strich mit Rand ≥ 3 : 1 (gemessen vom gestalter).
- **Leistung**: Verdichtung ist billig (höchstens 100 Knöpfe, Ergebnis je Breite gemerkt); der Breitenwechsel löst keine Anfrage und kein `render()` aus. Kein Wanduhr-Gate.
- **Architektur** (Review-Punkt `architektur-reviewer`): gerechnet wird nur in `web/lauf-commits.js` (rein); `web/app.js` misst nur und rechnet keine Position.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über Git und die API wie in R00251: Aufgabe #1 trägt T17 mit den Markern C1′, C2, C3 (Text-Marker C4), C5a, C5b; Unit-Proben in Node). Mensch `sh`, Browser headless (Chromium) in `Europe/Berlin`, hell und dunkel. Alle Inhalte erfunden. „Strich“ = Knopf `.lv-ckb` in der Zeitachse; „Mitte“ = Mittelpunkt seines Rechtecks (`getBoundingClientRect`, Lehre #232); „im Blick“ = das Rechteck liegt ganz im Viewport; „grober Zeiger“ = Kontext mit `hasTouch: true` und `isMobile: true`.

### Lage und Verdichtung

- [ ] **AK 1 Striche an ihrer Stelle:** Gegeben T17 bei 1280 px, wenn `sh` den Lauf öffnet, dann trägt die Zeitachse fünf Striche: an den Stellen der Ergebnisse 3, 9, 13 und 15 je einen mit dem Kurzhash des Commits, an der Stelle des Ergebnisses 7 einen mit „2 Commits“ (Summe n = 6); die Legende nennt „Commit“. Lage, Rechenbeispiel: hat ein Lauf 100 s kumulierte Dauer und liegt das Ergebnis bei 25 s, steht der Strich bei 25 % der Balkenbreite (±1 px). Heute rot (keine Striche). Probe: neue E2E-Spec `r00268-laufansicht-zeitachse-striche.spec.js` an T17, Position über `getBoundingClientRect`, `outerHTML` von `.lv-za`.
- [ ] **AK 2 Verdichtung nach Abstand (M1 wörtlich):** Gegeben 40 Commit-Schritte, gleichmäßig verteilt, bei 320 px mit grobem Zeiger und bei 1280 px, wenn `sh` den Lauf öffnet, dann liegen die Mitten benachbarter Strich-Knöpfe ≥ 24 px auseinander, Knöpfe mit Beschriftung ≥ um die Beschriftungsbreite, keine Beschriftungen überschneiden sich, die Summe der `n` aller Knöpfe ist 40, und `document.elementFromPoint(Mitte)?.closest('.lv-ckb')` ist dieser Knopf. Rechenbeispiel (Beschriftungen je 52 px breit): Striche bei 10, 20, 50, 60 und 130 px → 10, 20, 50, 60 gehen in einen Knopf „4 Commits“ bei 10 px auf, 130 bleibt eigener Knopf (Summe der Marker 5). Heute rot. **Muss, linker Rand (271-ux-reviewer-1):** Gegeben 40 gleichmäßig verteilte Commit-Schritte bei 320 px (grober Zeiger) und bei 1280 px, dann hat das Rechteck jeder Beschriftung (`span.t`) `left ≥ 0` und `right ≤ Viewportbreite`, liegt ganz in `.lv-za`, und die Mitten benachbarter Knöpfe bleiben ≥ 24 px; heute rot (links −13,0 px). Ausrichtung wie in FA 2 (erster/letzter Knopf am Rand, Spiegel von `.lv-ck>li.re`). Probe: E2E mit 40 Schritten, beide Breiten; Unit `stricheVerdichten` an den Grenzen (Mittenabstand genau 24 px bleibt getrennt, 23,9 px geht auf; Abstand genau Beschriftungsbreite bleibt, ein Pixel weniger geht auf; der zusammengefasste Knopf trägt den `left`-Wert des ersten Strichs).
- [ ] **AK 3 Zwei Durchläufe im selben Vorgang, Breitenwechsel ohne Anfrage:** Gegeben T17, wenn `sh` die Fensterbreite von 1280 auf 320 px und zurück ändert, dann sind Knopfzahl, Mitten und Überschneidungen bei jeder Breite neu eingehalten (`ResizeObserver`), **ohne** eine neue `GET …/transkripte`- oder `GET …/commits`-Anfrage (Zähler) und **ohne** dass die Insel `#lv-insel` ersetzt wird (`el.__probe` bleibt); je Durchlauf (unverdichtet setzen → messen → verdichten; die `fonts.ready`-Nachmessung ist ein eigener Durchlauf) wird die Knopfleiste genau einmal ersetzt — gezählt: nach `await document.fonts.ready` genau eine Ersetzung je Breitenwechsel, beim ersten Aufbau eine oder zwei, nie mehr. Heute rot. Probe: E2E-Breitenwechsel mit Anfragezähler, Ersetzungszähler und `el.__probe`.

### Gruppe, Tastatur, Sprung, Zielfläche

- [ ] **AK 4 Gruppe und Namen (M2 wörtlich):** Gegeben T17, wenn `sh` die Zeitachse ansieht, dann stehen die Knöpfe (`.lv-ckb`) in einem `div[role="group"]` mit `aria-label="Commits der Zeitachse"` **neben** dem `role="img"`-Balken — jeder Knopf: `el.closest('[role="img"]') === null`; Name eines Knopfs „Commit <kurzhash>, zur Zeile springen“, verdichtet „<n> Commits, zur ersten Zeile springen“, enthält den sichtbaren Text. Heute rot. Probe: E2E, Attribut- und Namensprüfung.
- [ ] **AK 5 Tastatur (S1):** Gegeben T17, wenn `sh` von dem Bedienelement vor der Zeitachse tabbt, dann trifft der erste Tab genau einen Strich-Knopf (Zähler der Knöpfe mit `tabindex="0"` ist 1), der nächste Tab **verlässt die Gruppe** (`document.activeElement.closest('[role="group"]') === null`) — gleich wie viele Striche es gibt (5 wie 100); Pfeil rechts/links bewegt den Fokus auf den nächsten/vorigen Knopf, Pos1/Ende auf den ersten/letzten; Enter auf dem fokussierten Knopf springt wie ein Klick; der Fokusumriss des fokussierten Knopfs liegt bei 320 und 1280 px ganz im Viewport und wird von keinem Vorfahren mit `overflow: hidden` abgeschnitten; baut ein Live-Ereignis die Leiste neu (Lauf aktiv), ist danach wieder genau ein `tabindex="0"` gesetzt, und lag der Fokus in der Gruppe, trägt ihn ein Knopf der neuen Leiste, nicht `body`. Heute rot. Probe: E2E-Zählung der Tabs, Pfeil-/Pos1-/Ende-Läufe, Umriss gegen den Viewport, Live-Ereignis über die vorhandene Probe aus R00239.
- [ ] **AK 6 Sprung und Fokus (S2, S3):** Gegeben T17, wenn `sh` den Knopf „2 Commits“ anklickt, dann liegt die Marker-Zeile von C2 (die erste der beiden) ganz im Blick, `document.activeElement` ist diese `.lv-cm` mit sichtbarem Fokusumriss (≥ 2 px breit, Kontrast ≥ 3 : 1 zum Grund, hell und dunkel, ganz im Blick — heute hat `.lv-cm` keine `:focus`-Regel), und die Adresse ändert sich nicht (kein `#…`-Sprung, ADR-0029); mit `prefers-reduced-motion: reduce` ist die Zeile ohne weiches Scrollen sofort im Blick. Heute rot. Probe: E2E in beiden Einstellungen.
- [ ] **AK 7 Zielfläche (PO Z. 664 (a)):** Gegeben T17 bei 320 px mit grobem Zeiger und bei 1280 px, wenn `sh` die Striche ansieht, dann hat jeder Strich-Knopf `getBoundingClientRect().height ≥ --kd-ziel` (±1), die Breite bleibt wie gezeichnet, der Strich mit Rand hebt sich mit ≥ 3 : 1 vom Grund ab und die Beschriftung mit ≥ 4,5 : 1 (hell und dunkel). Heute rot. Probe: E2E, `getBoundingClientRect`, Kontrastmessung.

### Legende, Lesetext, Filter, Grenzen

- [ ] **AK 8 Legende und Lesetext (Z. 691, S5):** Gegeben T17, wenn `sh` die Zeitachse ansieht, dann nennt die Legende „Commit“, und der Lesetext der Zeitachse endet mit „, 6 Commits“; ein Lauf mit genau einem Marker endet mit „, 1 Commit“; ein Lauf ohne Strich (auch einer mit Text-Marker, aber ohne Zeitachse) zeigt Zeitachse, Legende und Lesetext byte-gleich wie vor dieser Anforderung. Heute: der erste Teil rot, der zweite (ohne Strich byte-gleich) am heutigen Stand grün — Bestandskontrolle. Probe: E2E + `outerHTML`-Vergleich von `.lv-za` gegen den Stand vor der Karte.
- [ ] **AK 9 Filter und Grenzen:** Gegeben T17, wenn `sh` den Filter „nur Fehler“ (und jeden anderen Filter) wählt, dann bleiben alle fünf Striche sichtbar (nur Attribute an der Wurzel der Insel ändern sich); gegeben 101 Striche in einem Lauf, dann stehen höchstens 100 Knöpfe und der Lesetext nennt beide Zahlen („, 100 von 101 Commits“, nicht 100); gegeben kein Marker mit gültiger Zeit, dann ist die Liste der Striche leer und die Zeitachse byte-gleich. Heute rot. Probe: E2E Filtersichten; Unit `stricheVerdichten` (101 Striche → ≤ 100 Knöpfe; 0 Striche → leere Liste) und `zeitachseStriche` (drei Marker am selben Schritt → ein Knopf „3 Commits“; Marker ohne gültige Zeit entfallen).

## Betroffene Verzeichnisstruktur

- `web/lauf-commits.js` (erweitert): `zeitachseStriche(striche…)`, `stricheVerdichten(striche, breitenPx, achsenBreitePx)`, Konstanten `MITTE_ABSTAND = 24`, `STRICHE = 100` — rein, kein DOM, kein `fetch`.
- `web/lauf.js`: `laufZeitachseHtml` (`ul.lv-ck`, `li`, `button.lv-ckb`, `span.t`, `i`), `LEGENDE`, `zeitachseLesetext`.
- `web/app.js`: messen (`getBoundingClientRect`), zwei Durchläufe im selben Vorgang, `ResizeObserver`, wandernder `tabindex`, Pfeile/Pos1/Ende, Sprung (`scrollIntoView`, Fokus), Filter unberührt.
- `web/kd-app.css`: nur Tokens, `.lv-ck`, `.lv-ckb` (Anhalt D0009 Bild 15, CSS `.lv-ck`/`.lv-ckb`).
- Tests: `e2e/einheit/lauf-commits.test.js` (erweitert), `e2e/tests/r00268-laufansicht-zeitachse-striche.spec.js` (neu), Ausgangslage T17 (`e2e/tests/laufansicht-t17.js`).

## Technische Überlegungen

### Ablauf (Vorplanung; welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1465** `zeitachseStriche` + `stricheVerdichten` (rein), zwei Durchläufe, `ResizeObserver`.
2. **B1466** Gruppe, Tastatur, Sprung, Zielfläche, Legende, Lesetext, Probe und Gate.

### Grobentwurf

- `zeitachseStriche(auswertung, marker, karte)` → je Strich `{schrittNr, anteil, art, kurzhash?, titel, anzahl}`; `anteil` = kumulierte Dauer bis zum Ergebnis / Gesamtdauer (derselbe Wert wie Stück/Fach).
- `stricheVerdichten(striche, breitenPx, achsenBreitePx)` → verdichtete Knöpfe nach M1 (Position `anteil`, gemessene Beschriftungsbreiten px, Achsenbreite px).

### Änderungen an bestehenden Klassen

- `laufZeitachseHtml` (`web/lauf.js`) erhält die Knopfleiste; `zeitachseLesetext`/`LEGENDE` bekommen die Commit-Zahl bzw. den Eintrag; `web/app.js` bekommt die Messung und den Beobachter (der Kopf wird bei jedem `render()` neu gebaut, die Insel bleibt).

### Hinweise

- **Verdichtung nach Abstand** erweitert ADR-0041 N7 Punkt 6 (dort „gleiche Stelle und höchstens 100“); die Regel misst Beschriftungsbreiten im Browser, die Zuordnung bleibt rein (Hinweis an den architekt, N8).
- **Kein zweiter Weg** für `anteil`: Striche nutzen denselben Maßstab wie Stücke und Fächer (N1 Punkt 2).
- `D0009` Bild 15 reicht für die Strich-Teile (Lage, Kurzhash-Beschriftung, verdichteter Strich „3 Commits“, Legende „Commit“); die Rolle `role="group"`, die neuen Knopf-Namen, der Tastatur-Fokusumriss und die Zielfläche bei 320 px sind Bau-Eigenschaften (PO Z. 664 (a)), keine Neuzeichnung (gestalter, N8 Folgeaufgaben).

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`, Test zuerst je Bubble.

- **Unit (Node):** `stricheVerdichten` mit vorgegebenen Breiten (40 gleichmäßige Striche, Achse 300 px, Beschriftung 20 px → Σn = 40, Mitten ≥ 24 px, keine Überschneidung; zwei Knöpfe mit überschneidenden Beschriftungen bei 24 px → zusammen; Grenzen 24/23,9 px und genau/ein Pixel weniger als die Beschriftungsbreite; `left` des ersten Strichs; 101 → ≤ 100; keine Striche → leere Liste); `zeitachseStriche` (drei Marker am selben Schritt → „3 Commits“; Marker ohne gültige Zeit entfallen; `anteil` = kumulierte Dauer / Gesamtdauer).
- **E2E (Chromium headless, T17, hell und dunkel, 320 und 1280 px):** AK 1–9.
- **Mutanten** (in eigener Kopie, je von einem benannten Test getötet): **m12** keine Verdichtung an gleicher Stelle (AK 7); **m15** nur gleiche Stelle, nicht nach Abstand (AK 2, M1); **m16** Knöpfe innerhalb des `role="img"` (AK 4, M2); **m17** Legende „Commit“ auch ohne Strich (AK 8); **m18** die 24-px-Bedingung weggelassen (nur Beschriftungsbreite, AK 2); **m19** Verdichtung beim Breitenwechsel nicht wiederholt (AK 3); **m20** „n“ zählt die Knöpfe statt der Marker (AK 1, AK 2); **m21** jeder Knopf ein Tab-Stopp statt roving (AK 5).
- **Regression:** R00221, R00239, R00244, R00251 bleiben grün; ein Lauf ohne Marker ist byte-gleich (`outerHTML` von `.lv-za`).

## Abhängigkeiten

- Abhängig von: [R00251](R00251-laufansicht-commits-des-laufs-als-marker.md) (Stufe 1, F0198, grün), [R00221](R00221-laufansicht-transkript-eines-agentenlaufs-lesen.md) (I0211), [R00239](R00239-laufansicht-zeitachse-filter-blaettern.md) (I0229, Zeitachse), [R00245](R00245-review-seite-commit-leiste-und-verdichteter-commit-kopf.md) (I0235); die Marker stehen in `web/lauf-commits.js` aus Stufe 1. Zeichnung D0009 `#laufansicht` Bild 15 (freigegeben mit Änderung, Z. 664).
- Blockiert: nichts.

## Offene Fragen

Keine, die den Bau aufhält. Die Fragen 3 (Wort „Commit“ im Link) und 4 (Zeitachse als eigene Karte) sind entschieden (PO Z. 696, 697); die Produktentscheidungen (Z. 664 (a) Zielfläche, Z. 691 Legende nur mit Strich) sind eingearbeitet.

## Manuelle Vorbereitungstätigkeiten

- Keine. T17 und die Marker entstehen im Test.

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 (`web/lauf-commits.js`) um `zeitachseStriche`/`stricheVerdichten`, die Zeitachse-Striche und die Gruppe nachführen (architekt, N8 Folgeaufgaben).

## Warum löst diese Anforderung das Problem?

Auslöser ist die Frage des Betreibers, ob er aus dem Transkript gleich ins Diff springen kann; Stufe 1 legt die Marker an die Schrittzeile. Die Zeitachse beantwortet die zweite Hälfte: **wann** im Lauf wurde committet, im Verhältnis zu Werkzeug- und Denkschritten. Wirkungskette: eine Rolle committet im Lauf → der Marker kennt Schritt und Commit → `zeitachseStriche` setzt einen Strich an die kumulierte Dauer des Ergebnisses → die Verdichtung nach Abstand hält die Striche auch auf 320 px getrennt → wer den Lauf liest, sieht die Commits auf der Zeitachse und springt mit einem Klick zur Zeile. Gerade *diese* Änderung ist der Hebel, weil die Zuordnung (Stufe 1) schon steht: Stufe 2 macht dasselbe Verhalten in der zweiten Darstellung sichtbar, ohne Server, Format oder Zuordnung anzutasten.

## Missing-Docs

- Keine.

## Notizen

- **Ausbaustufe 2** (Karte #271, WBS F0199, Status `rot`; PO Z. 697). R00251 bleibt unverändert; diese Anforderung nimmt R00251 FA 7, AK 7 und die Strich-Teile von AK 8 sowie US-4 auf. Zwei Bubbles (B1465 Lage und Verdichtung, B1466 Gruppe/Tastatur/Sprung/Legende/Lesetext), Aufwand-Spanne 1-2 je Bubble (Summe 2-4, Hypothese; gemessen: keine Ist-Zeiten).
- **Entscheidungen des planers:** (1) B1327 als Bubble der Ausbaustufe war ein Platzhalter (Rolling Wave, #269 konnte nur B-Kennungen vergeben); die Ausbaukette wird lesbar geführt, darum ist Stufe 1 als Feature F0198 nachgezogen (die grünen Bubbles wandern darunter) und Stufe 2 ist Feature F0199, B1327 ist `verworfen` (nie gebaut). (2) Zwei Bubbles wie in ADR-0041 N8 „Folgeaufgaben“ verlangt (kein eigener Probe-/Gate-Knoten; Probe und Gate trägt B1466, das Muster der übrigen Läufe). (3) **Kein eigenes Optionen-Tableau:** die Technik ist in ADR-0041 N8 „Optionen“ entschieden (D1 zwei Durchläufe, Z1 Zeitachse außerhalb der Insel mit `ResizeObserver`, T1 roving tabindex) und gilt hier unverändert.
- Nummern über `main` und alle Zweige `karte/*` gegenzählt: R00268, I0241 (belegt), F0198–F0199, B1465–B1466 (höchste vorher R00267, I0257, F0197, B1464).
- **UX-Vorprüfung `271-ux-reviewer-1` eingearbeitet (2026-11-27), je Änderung eine Zeile:**
  - **Muss, linker Rand:** FA 2, AK 2 und US-3 verlangen, dass die Beschriftung des ersten Knopfs bei 320 px ganz sichtbar ist (Randform als Spiegel von `.lv-ck>li.re`); Probe wörtlich aus dem Bericht (40 Striche, 320/1280 px, `span.t` `left ≥ 0`, ganz in `.lv-za`, Mitten ≥ 24 px; heute rot, links −13,0 px). Keine neue Zeichnung (ux-reviewer: „Zeichnung nötig: nein“).
  - **S1 Tab-Zählung:** FA 5 und AK 5 sprechen nicht mehr von „zweiter Tab = erstes Bedienelement des ersten Schritts“ und „≤ 2 Tabs“ (zwischen Zeitachse und Insel stehen Filter-Kästchen und Top-Listen, ≥ 5 Tabs), sondern von „der nächste Tab verlässt die Gruppe“.
  - **S2 Trefferprobe:** AK 2 und US-3 nutzen `document.elementFromPoint(Mitte)?.closest('.lv-ckb')` statt „genau diesen Knopf“ (der Treffer ist das `i` im Knopf).
  - **S3 Ersetzungszähler:** FA 3 definiert den Durchlauf und AK 3 zählt die Ersetzungen eindeutig gegen die `fonts.ready`-Nachmessung.
  - **S4 Fokusumriss:** FA 6 und AK 6 nennen Werte (≥ 2 px, ≥ 3 : 1, ganz im Blick) — `.lv-cm` hat heute keine `:focus`-Regel.
  - **S5/S6 über 100 Striche:** FA 1, FA 8 und AK 9 verlangen die Ansage „<gezeigt> von <gesamt> Commits“ statt stiller Kürzung.
  - **S7 Lauf aktiv:** FA 5 und AK 5 verlangen nach dem Neuaufbau durch ein Live-Ereignis genau ein `tabindex="0"` und den Fokus zurück in der Leiste.
  - **Optional übernommen:** Textkontrast ≥ 4,5 : 1 in AK 7. **Verworfen (je ein Grund):** Lesetext mit „;“ statt Komma — ändert AK 8/US-1 und die byte-gleiche Bestandskontrolle ohne UX-Gewinn; „byte-gleich“ als golden string — ist bereits als `outerHTML`-Vergleich gegen den Vorstand geprüft; Ein-Marker-Lauf eigens als Fixture — AK 8 deckt „, 1 Commit“ ab; Touch-Affordance ohne Hover — im Kriterium steht kein Hover, D0009 zeichnet den Zustand nicht; D0009-Wortlaut „an der Zeitachse“ — reine Redaktion, unsichtbar.
- Nicht Teil (aus R00251, Z. 645): Commits früherer Phasen als Link, amend/rebase/cherry-pick, Diff-Vorschau, Sprung von der Review-Seite zurück an die Stelle, eigener Filter, Stufe 2 `?felder=zuordnung` (nur nach Messung, N7 Punkt 9).
