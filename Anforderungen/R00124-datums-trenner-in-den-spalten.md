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
- Die Aufgaben einer Spalte werden nach diesem Zeitpunkt in **Tagesgruppen** zusammengefasst, in der bestehenden Reihenfolge der Spalte (der Trenner steht **vor** der ersten Aufgabe seiner Gruppe); eine Aufgabe ohne Spaltenwechsel zählt zum Tag ihres ersten Erscheinens. Maßgeblich ist die **tatsächlich gezeichnete** Reihenfolge der Spalte (`reihe` in `vLane`, `web/ansicht.js:773`): bei „Signale oben“ (R00088) **und** bei aktivem Filter folgen die Trenner den **sichtbaren** Karten, nicht dem rohen `sp.aufgaben`.
- Beschriftung: **„Heute“**, **„Gestern“**, sonst das Datum in deutscher Schreibweise mit Jahr (`dd.MM.yyyy`, ADR-0013).

### Einstellung je Spalte
- Je Spalte ist die Anzeige **ein-/ausschaltbar** (`column-dates` in der Board-Datei, Muster `column-checks`/`column-colors`); fehlt der Schlüssel, gilt der **Standard**: in der **Abschlussspalte** an, in allen anderen Spalten aus. Der Schalter im Spalten-Dialog (`.as`) zeigt diesen **wirksamen** Standard — in der Abschlussspalte steht er **an**, auch wenn `column-dates` in der Datei **fehlt** (ein Schalter, der den Standard nicht zeigt, wäre nicht beobachtbar); die **Vorschau** (`setupText`, `web/ansicht.js:1527–1538`) führt `column-dates` mit. Der Schalter misst ≥ 24 px, bei Touch ≥ 44 px (ADR-0012).
- Die Einstellung wird im Spalten-Dialog „Spalten einrichten“ (R00009) gesetzt und über die API (`PUT /api/boards/{slug}/spalten`) geschrieben (ein Commit je Änderung, Autor die handelnde Person); sie reist mit der Board-Datei.

### Anzeige
- Der Trenner ist eine dünne Linie quer durch die Spalte mit der Beschriftung in der Mitte; er ist **nicht bedienbar** (kein Knopf, keine Aktion, kein `tabindex`) und trägt keinen zugänglichen Namen, der eine Aktion verspricht. Er ist ein **`role="listitem"`** in der `role="list"` der Spalte (`.flaeche`, `web/ansicht.js:781`) — als Element der Kartenliste, nicht als eigenes Bedienelement.
- **Im Archiv erscheinen keine Trenner** (Entscheidung der UX-Vorprüfung #119): die Archiv-Sicht zeigt archivierte Karten unabhängig von ihrem Spalteneintritt; ein Trenner wäre dort falsch.
- Die Karten und ihre Reihenfolge, der Spaltenkopf und alle bisherigen Aktionen bleiben unverändert; ein Trenner ändert keine Zahl (z. B. die Belegung im Spaltenkopf) und keinen Bericht.
- **Kontrast**: Linie und Beschriftung des Trenners erfüllen **mindestens 4,5:1** gegen ihren Grund (hell und dunkel); die Beschriftung trägt die Information, die Farbe/Stärke der Linie nie allein (Muster `--kd-line-strong`/`--kd-text`, Material 3 `outline-variant` als Vorbild für den Trenner).
- Auf schmalen Breiten (320, 375, 414 px) scrollt die Seite nicht quer; die Beschriftung bleibt lesbar (kein Überlappen).

## Nicht-funktionale Anforderungen

- **Performance**: eine Spalte mit 500 Aufgaben ist in unter 200 ms gerechnet und gezeichnet (headless Chromium), wie das Board.
- **Barrierefreiheit**: die Beschriftung ist Text; die Farbe/das Muster der Linie ist nie der einzige Unterschied — die Beschriftung („Heute“/„Gestern“/Datum) trägt die Information; Linie und Beschriftung halten ≥ 4,5:1 gegen ihren Grund; der Trenner ist ein `role="listitem"` in der Liste der Spalte, kein Fokus- oder Bedienziel.

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar): Board „fabrik“ mit „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte, Standard an). Bewegungen: 04.11. #1 in „Fertig“; 05.11. #2 in „Fertig“; 05.11. #3 in „Fertig“; 06.11. #4 in „Fertig“. Heute ist der 06.11.2026.

- [ ] Gegeben der Grundbestand, wenn ich das Board ansehe, dann zeigt die Spalte „Fertig“ die Trenner „— Heute —“ vor #4, „— Gestern —“ vor #3 (und #2) und „— 04.11.2026 —“ vor #1, in dieser Reihenfolge von oben nach unten, ohne die Reihenfolge der Karten zu ändern
- [ ] Grenze: Gegeben der Grundbestand und heute ist der 07.11.2026, wenn ich das Board ansehe, dann heißt der oberste Trenner der Spalte „Fertig“ „— Gestern —“ (vor #4) und der darunter „— 05.11.2026 —“ (vor #3 und #2) — „Heute“ kommt nicht vor, weil an diesem Tag (07.11.) keine Aufgabe ankam
- [ ] Standard aus: Gegeben der Grundbestand, wenn ich die Spalte „Eingang“ (nicht die Abschlussspalte, kein `column-dates`) ansehe, dann steht dort **kein** Datums-Trenner
- [ ] Einschalten: Gegeben der Grundbestand, wenn im Spalten-Dialog „Eingang“ die Datums-Trenner eingeschaltet und gespeichert werden (`PUT /api/boards/fabrik/spalten`), dann steht `column-dates` für „Eingang“ in `boards/fabrik.md`, genau ein Commit entsteht, und nach dem Speichern zeigt „Eingang“ die Trenner seiner Ankünfte
- [ ] Preisetikett, Belegung, Berichte unberührt: Gegeben der Grundbestand, wenn ich die Trenner ansehe, dann ist die Belegungszahl im Spaltenkopf „Fertig“ unverändert (4), und ein Klick auf einen Trenner löst keine Aktion aus (kein Fenster, kein Filter, kein Commit); der Trenner ist ein `role="listitem"` in der `role="list"` der Spalte und **kein** Fokus- oder Bedienziel (kein `tabindex`)
- [ ] Standard im Schalter sichtbar: Gegeben der Grundbestand (kein `column-dates` in `boards/fabrik.md`), wenn ich „Spalten einrichten“ öffne, dann steht der Schalter „Datums-Trenner“ für die Abschlussspalte „Fertig“ **an** (wirksamer Standard) und für „Eingang“/„In Arbeit“ **aus**; die Vorschau führt `column-dates` mit; der Schalter misst ≥ 24 px (bei `pointer: coarse` ≥ 44 px)
- [ ] Reihenfolge bei „Signale oben“ und Filter (Entscheidung UX #119): Gegeben der Grundbestand und eine Aufgabe mit Signal in „Fertig“, wenn ich „Signale oben“ einschalte, dann rücken die Trenner mit ihrer Karte und stehen **vor** der jeweils ersten **sichtbaren** Karte ihrer Tagesgruppe (nicht an der Position aus `sp.aufgaben`); dasselbe gilt, wenn ein Filter nur einen Teil der Karten zeigt — die Trenner richten sich nach den sichtbaren Karten
- [ ] Archiv ohne Trenner (Entscheidung UX #119): Gegeben eine archivierte und eine nicht archivierte Karte in „Fertig“, wenn ich ins Archiv wechsle, dann steht dort **kein** Datums-Trenner, und „Fertig“ zeigt nach dem Verlassen des Archivs seine Trenner unverändert
- [ ] Kontrast: Gegeben der Grundbestand, wenn die Trenner in Hell und in Dunkel angesehen werden, dann haben Linie und Beschriftung **mindestens 4,5:1** Kontrast gegen ihren Grund
- [ ] Leerzustand: Gegeben eine Spalte ohne Aufgaben, wenn ich sie ansehe, dann steht dort kein Trenner
- [ ] Nur gelesen: Gegeben der Grundbestand, wenn ich die Trenner ansehe und das Board wieder verlasse, dann ist `boards/fabrik.md` byte-gleich und `git log` unverändert (die Trenner sind Anzeige)
- [ ] Schmales Layout: Gegeben der Grundbestand, wenn die Fensterbreite auf 375 px (und 320 bzw. 414 px) gesetzt wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth` und jede Trenner-Beschriftung ist vollständig sichtbar (kein Überlappen)

## Betroffene Verzeichnisstruktur

Rechnung/Position als reine Funktion in `web/ansicht.js` (oder neben `spalteAm`, ADR-0019 Nachtrag N5), Anzeige in `web/ansicht.js` (Lane-Zeichnung, `vLane` `:768` — Trenner als `role="listitem"` in der `role="list"` der `.flaeche` `:781`, über die gezeichnete `reihe` `:773`), Einstellung in `src/format/board.rs` (`column-dates`), `src/web/mod.rs`/`src/dienst/spalten.rs` (PUT …/spalten), Spalten-Dialog (`vSetup` `:1555`, Schalter `.as` mit wirksamem Standard und Vorschau `setupText` `:1527`), Gestaltung in `web/kd-app.css`. Tests: `e2e/einheit/` (pure) und `e2e/tests/r00124-datums-trenner.spec.js`.

## Technische Überlegungen

### Ablauf
1. **Zeitpunkt je Karte**: aus den Bewegungen (R00042, `S.bew`) den letzten Wechsel in die Spalte nehmen (`spalteAm`).
2. **Gruppieren**: die **sichtbaren** Aufgaben der Spalte in der gezeichneten Reihenfolge (`reihe`, nicht `sp.aufgaben`) in Tagesgruppen; je Gruppe die Beschriftung aus dem Abstand zu heute. Im Archiv keine Trenner.
3. **Zeichnen**: vor der ersten **sichtbaren** Karte jeder Gruppe (außer ggf. der ersten) die Linie mit Beschriftung, als `role="listitem"` in der Liste der Spalte.
4. **Einstellen**: `column-dates` im Spalten-Dialog lesen/schreiben; der Schalter zeigt den **wirksamen** Standard (Abschlussspalte an, auch ohne Schlüssel), die Vorschau führt den Schlüssel mit.

### Grobentwurf
- `datumsTrenner(spalte, reihe, bewegungen, heute)` (reine Funktion, JS) — je **sichtbarer** Aufgabe der Tages-Schlüssel, je Gruppe die Beschriftung; im Archiv leer.
- `trennerText(tag, heute)` (reine Funktion, JS) — „Heute“, „Gestern“ oder `dd.MM.yyyy`.
- `column-dates` in `src/format/board.rs` (Muster `column-checks`), Standard aus der Position (Abschlussspalte).

### Änderungen an bestehenden Klassen
- `Spalte` (`src/modell/board.rs`): Feld für die Datums-Trenner (Standard aus der Position).
- Spalten-Dialog (`web/ansicht.js`, `vSetup` `:1555`): ein Schalter (`.as`) je Spalte, der den wirksamen Standard zeigt; Vorschau `setupText` (`:1527`) führt `column-dates` mit.

## Abhängigkeiten
- Abhängig von: R00009 (Spalten einrichten), R00042 (Bewegungen des Boards), R00109/ADR-0013 (deutsche Datumsanzeige), ADR-0019 Nachtrag N5 (`spalteAm`)
- Gestaltung: **ux-Vorprüfung #119** und Artboard **D0002** „Board“ (gestalter): die Spalten mit Trennern brauchen den Zustand **`#datums-trenner`** in D0002 — er ist dort **noch nicht gezeichnet** und muss vor dem Bau **gezeichnet und vom product-owner freigegeben** werden (Vision-Leitplanke; hell und dunkel, 320/375/414/1280 px). **Bau-Sperre Oberfläche:** F0097/B0579–B0652 warten auf diese Freigabe; die reine Rechnung (B0578) und `column-dates` im Format/`PUT` sind davon frei baubar.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockiert. Empfehlungen des planers (Entscheidungen im Bericht); die **UX-Vorprüfung #119** ist eingearbeitet (siehe Notizen). Offen bleibt allein die **Artboard-Freigabe** (`#datums-trenner` an D0002, product-owner) — sie sperrt nur die Anzeige.

- **Bezugspunkt**: der **letzte Ankunftstag** in der Spalte (`spalteAm`), nicht der Erstellungs- oder Fälligkeitstag — das zeigt die Arbeitsgeschwindigkeit der Spalte.
- **Archiv und Filter (Entscheidung UX #119)**: im **Archiv gar keine** Trenner; bei aktivem Filter und bei „Signale oben“ folgen die Trenner den **sichtbaren** Karten (gezeichnete `reihe`).
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

**Einarbeitung UX-Vorprüfung #119 (2026-11-11, Kartenkommentar #119):** *(Muss)* Die Oberfläche ist **bau-gesperrt**, bis der gestalter den Zustand **`#datums-trenner`** an D0002 gezeichnet und der product-owner ihn freigegeben hat (Abhängigkeiten „Gestaltung“). *(Sollte)* Der Trenner ist ein **`role="listitem"`** in der `role="list"` der Spalte (kein Fokus-/Bedienziel); die Trenner folgen der **gezeichneten** Reihenfolge (`reihe`) auch bei „Signale oben“ und Filter; **im Archiv keine Trenner**; Linie und Beschriftung ≥ 4,5:1 Kontrast; der Schalter **`.as`** zeigt den **wirksamen** Standard (Abschlussspalte an, auch ohne Schlüssel), die **Vorschau** führt `column-dates` mit, das Bedienziel ist ≥ 24 px (Touch ≥ 44 px). *(Entscheidung der UX, übernommen)*: Trenner im Archiv **gar nicht**, bei aktivem Filter über die **sichtbaren** Karten.

**Verwiesenes**
- Karte #119, Absatz 2 (Betreiber): „Spalten sollen Datums-Trenner für die sichtbaren Aufgaben enthalten können …“.
- ADR-0021 „Geltung“: die Datums-Trenner sind eigenes Thema unter D0002.
