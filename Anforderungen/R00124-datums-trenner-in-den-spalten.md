---
id: R00124
status: Neu
datum: 2026-11-11
---

# R00124: Datums-Trenner in den Spalten

## Beschreibung

Eine Spalte des Boards kann zwischen ihren Aufgaben **Datums-Trenner** zeigen: dünne, beschriftete Linien „— Heute —“, „— Gestern —“, „— 04.11.2026 —“. Sie ordnen die Karten nach dem Tag, an dem sie in die Spalte kamen, und machen auf einen Blick sichtbar, wie sich Arbeit in einer Spalte über die Tage verteilt („Arbeitsgeschwindigkeit“). Die Anzeige ist je Spalte ein- und ausschaltbar und in der **Abschlussspalte per Default an**. Die Reihenfolge der Karten bleibt unverändert; die Trenner stehen zwischen den Aufgaben. Sie werden im Browser aus den Bewegungen des Boards gerechnet (R00042); die Einstellung steht in der Board-Datei. Dies ist das zweite Thema der Karte #119 und gehört unter den Dialog **D0002** (Board), nicht zum Karten-Verlauf (R00123, ADR-0021 „Geltung“).

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen rechnen aus dem, was geschehen ist“, „Git als Archiv inklusive Zeiten“.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wer eine volle Abschlussspalte ansieht, kann heute nicht erkennen, welche Karten gestern und welche vor einer Woche fertig wurden — sie stehen als eine lange Reihe. Die Datums-Trenner machen den Fluss in der Spalte lesbar: ein Blick zeigt, wie viel an welchem Tag ankam. Die Information liegt bereits in der Git-Geschichte (R00042, ADR-0019 Nachtrag N5 `spalteAm`), sie muss nur sichtbar gemacht werden; es entsteht keine neue Datenhaltung.

## Funktionale Anforderungen

### Rechnung
- Grundlage ist je Aufgabe der Zeitpunkt, an dem sie **zuletzt** in die Spalte kam (Spaltenwechsel aus den Bewegungen des Boards, R00042/`spalteAm`, ADR-0019 Nachtrag N5); kein neuer Endpunkt, kein Cache.
- Die Aufgaben einer Spalte werden nach diesem Zeitpunkt in **Tagesgruppen** zusammengefasst, in der bestehenden Reihenfolge der Spalte (der Trenner steht **vor** der ersten Aufgabe seiner Gruppe); eine Aufgabe ohne Spaltenwechsel zählt zum Tag ihres ersten Erscheinens.
- Beschriftung: **„Heute“**, **„Gestern“**, sonst das Datum in deutscher Schreibweise mit Jahr (`dd.MM.yyyy`, ADR-0013).

### Einstellung je Spalte
- Je Spalte ist die Anzeige **ein-/ausschaltbar** (`column-dates` in der Board-Datei, Muster `column-checks`/`column-colors`); fehlt der Schlüssel, gilt der **Standard**: in der **Abschlussspalte** an, in allen anderen Spalten aus.
- Die Einstellung wird im Spalten-Dialog „Spalten einrichten“ (R00009) gesetzt und über die API (`PUT /api/boards/{slug}/spalten`) geschrieben (ein Commit je Änderung, Autor die handelnde Person); sie reist mit der Board-Datei.

### Anzeige
- Der Trenner ist eine dünne Linie quer durch die Spalte mit der Beschriftung in der Mitte; er ist **nicht bedienbar** (kein Knopf, keine Aktion) und trägt keinen zugänglichen Namen, der eine Aktion verspricht.
- Die Karten und ihre Reihenfolge, der Spaltenkopf und alle bisherigen Aktionen bleiben unverändert; ein Trenner ändert keine Zahl (z. B. die Belegung im Spaltenkopf) und keinen Bericht.
- Auf schmalen Breiten (320, 375, 414 px) scrollt die Seite nicht quer; die Beschriftung bleibt lesbar (kein Überlappen).

## Nicht-funktionale Anforderungen

- **Performance**: eine Spalte mit 500 Aufgaben ist in unter 200 ms gerechnet und gezeichnet (headless Chromium), wie das Board.
- **Barrierefreiheit**: die Beschriftung ist Text; die Farbe/das Muster der Linie ist nie der einzige Unterschied — die Beschriftung („Heute“/„Gestern“/Datum) trägt die Information.

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar): Board „fabrik“ mit „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte, Standard an). Bewegungen: 04.11. #1 in „Fertig“; 05.11. #2 in „Fertig“; 05.11. #3 in „Fertig“; 06.11. #4 in „Fertig“. Heute ist der 06.11.2026.

- [ ] Gegeben der Grundbestand, wenn ich das Board ansehe, dann zeigt die Spalte „Fertig“ die Trenner „— Heute —“ vor #4, „— Gestern —“ vor #3 (und #2) und „— 04.11.2026 —“ vor #1, in dieser Reihenfolge von oben nach unten, ohne die Reihenfolge der Karten zu ändern
- [ ] Grenze: Gegeben der Grundbestand und heute ist der 07.11.2026, wenn ich das Board ansehe, dann heißt der oberste Trenner der Spalte „Fertig“ „— Gestern —“ (vor #4) und der darunter „— 05.11.2026 —“ (vor #3 und #2) — „Heute“ kommt nicht vor, weil an diesem Tag (07.11.) keine Aufgabe ankam
- [ ] Standard aus: Gegeben der Grundbestand, wenn ich die Spalte „Eingang“ (nicht die Abschlussspalte, kein `column-dates`) ansehe, dann steht dort **kein** Datums-Trenner
- [ ] Einschalten: Gegeben der Grundbestand, wenn im Spalten-Dialog „Eingang“ die Datums-Trenner eingeschaltet und gespeichert werden (`PUT /api/boards/fabrik/spalten`), dann steht `column-dates` für „Eingang“ in `boards/fabrik.md`, genau ein Commit entsteht, und nach dem Speichern zeigt „Eingang“ die Trenner seiner Ankünfte
- [ ] Preisetikett, Belegung, Berichte unberührt: Gegeben der Grundbestand, wenn ich die Trenner ansehe, dann ist die Belegungszahl im Spaltenkopf „Fertig“ unverändert (4), und ein Klick auf einen Trenner löst keine Aktion aus (kein Fenster, kein Filter, kein Commit)
- [ ] Leerzustand: Gegeben eine Spalte ohne Aufgaben, wenn ich sie ansehe, dann steht dort kein Trenner
- [ ] Nur gelesen: Gegeben der Grundbestand, wenn ich die Trenner ansehe und das Board wieder verlasse, dann ist `boards/fabrik.md` byte-gleich und `git log` unverändert (die Trenner sind Anzeige)
- [ ] Schmales Layout: Gegeben der Grundbestand, wenn die Fensterbreite auf 375 px (und 320 bzw. 414 px) gesetzt wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth` und jede Trenner-Beschriftung ist vollständig sichtbar (kein Überlappen)

## Betroffene Verzeichnisstruktur

Rechnung/Position als reine Funktion in `web/ansicht.js` (oder neben `spalteAm`, ADR-0019 Nachtrag N5), Anzeige in `web/ansicht.js` (Lane-Zeichnung), Einstellung in `src/format/board.rs` (`column-dates`), `src/web/mod.rs`/`src/dienst/spalten.rs` (PUT …/spalten), Spalten-Dialog in `web/ansicht.js`, Gestaltung in `web/kd-app.css`. Tests: `e2e/einheit/` (pure) und `e2e/tests/r00124-datums-trenner.spec.js`.

## Technische Überlegungen

### Ablauf
1. **Zeitpunkt je Karte**: aus den Bewegungen (R00042, `S.bew`) den letzten Wechsel in die Spalte nehmen (`spalteAm`).
2. **Gruppieren**: die Aufgaben der Spalte in ihrer Reihenfolge in Tagesgruppen; je Gruppe die Beschriftung aus dem Abstand zu heute.
3. **Zeichnen**: vor der ersten Karte jeder Gruppe (außer ggf. der ersten) die Linie mit Beschriftung.
4. **Einstellen**: `column-dates` im Spalten-Dialog lesen/schreiben.

### Grobentwurf
- `datumsTrenner(spalte, bewegungen, heute)` (reine Funktion, JS) — je Aufgabe der Tages-Schlüssel, je Gruppe die Beschriftung.
- `trennerText(tag, heute)` (reine Funktion, JS) — „Heute“, „Gestern“ oder `dd.MM.yyyy`.
- `column-dates` in `src/format/board.rs` (Muster `column-checks`).

### Änderungen an bestehenden Klassen
- `Spalte` (`src/modell/board.rs`): Feld für die Datums-Trenner (Standard aus der Position).
- Spalten-Dialog (`web/ansicht.js`): ein Schalter je Spalte.

## Abhängigkeiten
- Abhängig von: R00009 (Spalten einrichten), R00042 (Bewegungen des Boards), R00109/ADR-0013 (deutsche Datumsanzeige), ADR-0019 Nachtrag N5 (`spalteAm`)
- Gestaltung: **ux-Vorprüfung** und ggf. Artboard **D0002** „Board“ (gestalter), freigegeben vor dem Bau der Oberfläche (Vision-Leitplanke) — der gezeichnete Zustand ist die Spalte mit Trennern, hell und dunkel.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockiert. Empfehlungen des planers (Entscheidungen im Bericht):

- **Bezugspunkt**: der **letzte Ankunftstag** in der Spalte (`spalteAm`), nicht der Erstellungs- oder Fälligkeitstag — das zeigt die Arbeitsgeschwindigkeit der Spalte.
- **Gruppierung**: **je Kalendertag**; eine Aufgabe ohne Wechsel zählt zum Tag ihres ersten Erscheinens; keine Wochen-/Monatsgruppierung jetzt (Ausbaustufe).
- **Standard**: Abschlussspalte **an**, alle anderen **aus** (Karte #119 wörtlich).
- **Ablage**: `column-dates` in der Board-Datei (Muster `column-checks`), setzbar wie die übrigen Spalteneigenschaften.
- **Beschriftung**: „Heute“/„Gestern“/`dd.MM.yyyy` (ADR-0013).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass eine lange Abschlussspalte „flach“ aussieht: Man erkennt nicht, welche Karten heute und welche vor einer Woche fertig wurden, obwohl genau das die Arbeitsgeschwindigkeit zeigt. Die Änderung setzt nur eine Anzeige auf Daten, die schon da sind — der Tag der Ankunft in der Spalte steht in der Git-Geschichte der Board-Datei. Die Wirkungskette: vorhandene Bewegungen → Tagesgruppen je Spalte → beschriftete Trenner → der Mensch liest die Verteilung in der Spalte auf einen Blick, statt Karten nach Datum zu sortieren.

## Missing-Docs
- Ob die Trenner später auch **wochen- oder monatsweise** gruppieren oder in den **Berichten** (Burndown/CFD) erscheinen sollen, ist in keiner Anforderung beschrieben. Ausbaustufe.

## Notizen

**Eigenes Thema unter D0002.** Diese Anforderung ist bewusst von R00123 (Karten-Verlauf) getrennt: ADR-0021 „Geltung“ stellt fest, dass die Datums-Trenner ein eigenes Thema unter D0002 sind und nicht Teil der Verlaufs-ADR. Karte #119 trägt beide Themen in zwei Absätzen.

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — je Aufgabe der letzte Ankunftstag, Tagesgruppen mit Heute/Gestern/Datum** (gewählt): zeigt die Arbeitsgeschwindigkeit direkt aus den vorhandenen Bewegungen.
- **B — nach Fälligkeit gruppieren**: zeigt nicht den Fluss in der Spalte und braucht ein anderes Datum; verworfen.
- **C — Erstellungs-/Archivierungszeitpunkt der Karte**: zeigt nicht, wann sie in **diese** Spalte kam; verworfen.

**Verwiesenes**
- Karte #119, Absatz 2 (Betreiber): „Spalten sollen Datums-Trenner für die sichtbaren Aufgaben enthalten können …“.
- ADR-0021 „Geltung“: die Datums-Trenner sind eigenes Thema unter D0002.
