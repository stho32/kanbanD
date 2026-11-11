---
id: R00123
status: Neu
datum: 2026-11-11
---

# R00123: Karten-Verlauf im Aufgabenfenster

## Beschreibung

Der Weg jeder Aufgabe über ihre Boards wird nachvollziehbar: wann sie angelegt, wann sie von welcher Spalte in welche bewegt (auch „vom Board genommen“), wann sie archiviert und zurückgeholt und wann sie gelöscht wurde — und wer jeweils gehandelt hat. Der Verlauf erscheint als **eigener Reiter „Verlauf“** in den Aufgaben-Details, neueste Einträge oben. Er wird **aus der Git-Geschichte** der Aufgabendatei und der Board-Dateien **gerechnet** (ADR-0021, ableiten statt speichern); „wer“ ist der Commit-Autor. Ein neuer, rein lesender Endpunkt `GET /api/aufgaben/{nr}/verlauf` liefert die Einträge, die Oberfläche zeigt sie in einer Tabelle.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis … wann eine Aufgabe angelegt, geändert und wohin sie bewegt wurde, steht in den Commits“ und „An jeder Änderung ist ablesbar, wer gehandelt hat: kanbanD committet unter dem Namen der handelnden Person“.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wer heute wissen will, wer wann welche Aufgabe wohin verschoben hat oder wann sie „Erledigt“ erreicht hat, muss die Git-Historie der Board-Datei von Hand lesen: `git log` über die Board-Datei, `git show` je Commit, den Bezug zur Nummer selbst herstellen. Der Karten-Verlauf bringt diese Frage an die Karte selbst — der Weg ist eine Frage **je Karte**, nicht je Board. Er nutzt, was Git ohnehin festhält (Leitplanke „Ein Commit je Aktion“), gilt **rückwirkend** für die ganze Vergangenheit und für Änderungen von außen (Editor, Agent, `git pull`) und kostet **keine zweite Datenhaltung**. Weil kanbanD unter dem Namen der handelnden Person committet, ist der Verlauf zugleich der Nachweis, wer gehandelt hat.

## Funktionale Anforderungen

### Lese-Endpunkt `GET /api/aufgaben/{nr}/verlauf`
- Neu und **rein lesend**: der Endpunkt liefert den Verlauf der Aufgabe als Liste von Einträgen, **neueste zuerst**, je Eintrag `zeitpunkt` (mit Versatz, R00084), `art`, `wer`; bei einer Bewegung dazu `von`, `nach` (jeweils Spaltenname oder `null`) und `board` (der Slug des Boards, auf dem sie geschah), bei „erstellt“ ggf. die erste Spalte.
- **Arten**: `erstellt` (erster Commit, der die Aufgabendatei enthält), `bewegt` (Spaltenwechsel in einer Board-Datei; `nach: null` = „vom Board genommen“, `von: null` = „auf das Board gelegt“), `archiviert` (Commit, der `archived` setzt), `zurueckgeholt` (Commit, der `archived` entfernt), `geloescht` (Commit, der die Aufgabendatei entfernt).
- **Ein Commit je Aktion → ein Eintrag.** Ein Eintrag steht höchstens einmal je Commit; legt ein Commit die Aufgabe an und stellt sie zugleich auf ein Board, ist das **ein** Eintrag `erstellt` (mit der Spalte), kein zweiter `bewegt`.
- **„wer“ ist der Commit-Autor** aus `git log` (`%ae`): `<kürzel>@kanbanD` wird auf das Personenkürzel zurückgeführt (Anzeige wie die Durchläufe-Tabelle, I0081); ein fremder Autor (kanbanD-externer Commit) erscheint mit seinem **Git-Namen unverändert**.
- **Alle Boards zusammen**: eine Aufgabe auf mehreren Boards hat je Board eine eigene Bewegungsfolge; der Endpunkt führt sie **zeitlich zusammen** und nennt je Bewegungseintrag das Board. Ein Board-Filter ist nicht Teil dieser Anforderung (Ausbaustufe).
- **Erledigt** ist kein eigener Art-Wert: das Betreten der Abschlussspalte ist ein `bewegt`-Eintrag mit `nach` = Name der Abschlussspalte.
- Der Endpunkt steht in `GET /api/endpunkte` und `GET /api/openapi.json` (Antwortschema der Einträge). Unbekannte Nummer (keine Aufgabendatei und keine Bewegung in irgendeiner Board-Datei) → 404 `{fehler}`.
- **Kein Schreibweg** (ADR-0021): der Endpunkt ändert weder Datei noch Index, committet nichts.

### Reiter „Verlauf“ in den Aufgaben-Details
- Die Reiterleiste des Aufgabenfensters (Muster I0093/R00105, Rolle `tab`/`tablist` aus B0375) trägt einen weiteren Reiter **„Verlauf“**, **immer sichtbar** (jede Aufgabe hat mindestens die Erstellung). Reihenfolge: „Inhalt“, „Datei“, „Kosten“ (nur mit Etikett), „Verlauf“. Die vier Reiter des Kopfes (mit Etikett: Inhalt, Datei, Kosten, Verlauf) brachen bislang bei 320/375/414 px quer; sie **brechen bei Bedarf in weitere Zeilen um** (flex-wrap im Kopf, Entscheidung E1 aus R00127/I0115), **kein Querscrollen**, jeder Reiter ≥ 24 px, bei Touch ≥ 44 px (ADR-0012).
- Das Panel zeigt eine **Tabelle**, neueste oben, mit den Spalten **Zeit** (Datum mit Jahr und Uhrzeit in deutscher Schreibweise, ADR-0013), **Art**, **von → nach** (bei Bewegung; sonst leer), **Board** (nur bei Bewegung), **Wer** (Kürzel und Name wie die Durchläufe-Tabelle). Die **Zeit-Spalte nutzt `zeitpunktLang`** (`web/kultur.js`, immer `TT.MM.JJJJ HH:MM` **mit Jahr**) — **nicht** die Kurzform `zeitpunktKurz` der Durchläufe-Tabelle (`web/ansicht.js:306`), damit das Jahr auch im laufenden Jahr sichtbar bleibt. Die **Art** ist ein deutsches Wort (`erstellt`, `bewegt`, `archiviert`, `zurückgeholt`, `gelöscht`); „vom Board genommen“ und „auf das Board gelegt“ stehen ausgeschrieben statt als `null`.
- Der Reiter **liest nur**: kein Eingabefeld, kein Knopf, der die Datei ändert; sichtbar steht „liest nur · gerechnet aus der Git-Geschichte“. Die Aufgabendatei trägt **keinen** Verlaufs-Datenblock.
- **Wechsel der Aufgabe (Muss)**: Blättert man mit ↑/↓ (Karte wechseln) zur nächsten Aufgabe, **während „Verlauf“ gewählt ist**, **leert** das Panel zuerst die Tabelle und lädt dann den Verlauf der **neuen** Aufgabe; es stehen **nie** Zeilen der vorigen Aufgabe (auch nicht kurz). Das folgt dem Muster von R00110 Nacharbeit 1 (`blaettern` verwirft beim Wechsel den Stand der vorigen Aufgabe, `web/app.js:1116–1117`).
- **Zustände des Panels**: Während der Endpunkt antwortet, steht an der Stelle der Tabelle „lädt …“ (kein leerer Rahmen, keine Zeilen der vorigen Aufgabe); scheitert das Lesen, steht die Fehlermeldung des Fensters (role=alert), nicht eine leere Tabelle. Zellen ohne Wert (kein Board, kein von/nach) tragen „—“; „vom Board genommen“ und „auf das Board gelegt“ stehen ausgeschrieben (siehe Tabellen-Spalten oben).
- **Leerzustand**: gibt es keinen Eintrag (Datei nie in Git — z. B. noch nicht committet), steht statt der Tabelle „Kein Verlauf — diese Aufgabe steht noch in keiner Fassung.“
- Der Reiter rechnet bei jeder Änderung im Ordner neu (Live, D00005).

## Nicht-funktionale Anforderungen

- **Performance**: eine Aufgabe mit 100 Verlaufs-Einträgen über 5 Boards ist in unter 200 ms gelesen und gezeichnet (headless Chromium); gerechnet wird je Öffnen und je Live-Ereignis, nicht dauerhaft vorgehalten (ADR-0021, akzeptierte Schwäche).
- **Barrierefreiheit**: der Reiter ist ein `role="tab"` mit `aria-selected`/`aria-controls` in einer `role="tablist"` (B0375); die Tabelle hat `th scope="col"`; die Art hängt an keinem Zeichen allein, sondern am Wort; Datumsangaben stehen im Klartext (nicht als Symbol). Zielgrößen der Reiter nach ADR-0012 (≥ 24 px, bei Touch ≥ 44 px).
- **Schmales Layout**: bei 320, 375 und 414 px scrollt die Seite nicht quer und der Kopf des Aufgabenfensters bleibt `scrollWidth ≤ clientWidth`; die Reiterleiste bricht bei Bedarf in weitere Zeilen um (E1, flex-wrap im Kopf); die Tabelle scrollt in sich (Querscroll-Rahmen wie beim Kosten-Reiter).

## Akzeptanzkriterien

**Grundbestand für die Beispiele** (über die API herstellbar; die Commit-Zeiten setzt die Probe mit `GIT_AUTHOR_DATE`, die Autoren über `X-KanbanD-Wer`): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (letzte Spalte = Abschlussspalte). Aufgabe #1 (`aufgaben/0001-…md`):

- 01.10.2026 09:00 · `sh`: #1 angelegt und in „Eingang“ gelegt (ein Commit, beide Dateien)
- 02.10.2026 09:00 · `cl`: #1 nach „In Arbeit“ bewegt
- 03.10.2026 09:00 · `cl`: #1 nach „Fertig“ bewegt (Abschlussspalte)
- 04.10.2026 09:00 · `sh`: #1 archiviert
- 05.10.2026 09:00 · `sh`: #1 zurückgeholt
- 06.10.2026 09:00 · `sh`: #1 vom Board genommen

### Rechnung (Endpunkt)
- [ ] Gegeben der Grundbestand, wenn `GET /api/aufgaben/1/verlauf` aufgerufen wird, dann liefert er **sechs** Einträge, neueste zuerst: `06.10.2026 09:00 · bewegt · Fertig → vom Board genommen · fabrik · sh`, `05.10.2026 09:00 · zurueckgeholt · sh`, `04.10.2026 09:00 · archiviert · sh`, `03.10.2026 09:00 · bewegt · In Arbeit → Fertig · fabrik · cl`, `02.10.2026 09:00 · bewegt · Eingang → In Arbeit · fabrik · cl`, `01.10.2026 09:00 · erstellt · Eingang · sh`
- [ ] Anlegen in einer Spalte ist **ein** Eintrag: Gegeben der Grundbestand, wenn der Verlauf gelesen wird, dann ist der 01.10. genau **ein** Eintrag `erstellt` mit der Spalte „Eingang“ (kein zweiter Eintrag `bewegt` zur selben Zeit, also sechs Einträge und nicht sieben)
- [ ] Erledigt als Bewegung: Gegeben der Grundbestand, wenn der Verlauf gelesen wird, dann trägt der 03.10. den Art `bewegt` mit `von` „In Arbeit“ und `nach` „Fertig“ (kein eigener Art `erledigt`)
- [ ] Vom Board genommen: Gegeben der Grundbestand, wenn der Verlauf gelesen wird, dann zeigt der 06.10. den Schritt „Fertig“ → „vom Board genommen“ (ausgeschrieben, nicht leerer Text, nicht `null`)
- [ ] Autoren je Eintrag: Gegeben der Grundbestand, wenn der Verlauf gelesen wird, dann steht an den Einträgen vom 01./04./05./06.10. als Wer `sh` und an denen vom 02./03.10. `cl` — jeder Eintrag trägt seinen eigenen Autor, nicht den heutigen Betrachter
- [ ] Fremder Autor: Gegeben ein Commit, der die Board-Zeile von Hand mit `GIT_AUTHOR_EMAIL=extern@example.org` und `GIT_AUTHOR_NAME=Extern` am 07.10. bewegt, wenn der Verlauf gelesen wird, dann steht an diesem Eintrag als Wer „Extern“ unverändert (keine leere Zelle, kein Kürzel erfunden)
- [ ] Mehrere Boards: Gegeben #1 wird zusätzlich auf Board „privat“ in dessen erste Spalte gelegt und am 08.10. dort weiterbewegt, wenn der Verlauf gelesen wird, dann nennt jeder Bewegungseintrag sein Board („fabrik“ bzw. „privat“), zeitlich gemischt, und die beiden Bewegungsfolgen stehen nebeneinander
- [ ] Gelöschte Datei: Gegeben die Aufgabendatei von #1 wird am 09.10. entfernt (Commit), wenn `GET /api/aufgaben/1/verlauf` aufgerufen wird, dann endet der Verlauf mit dem Eintrag `geloescht` (09.10., Autor des Lösch-Commits) und die früheren sechs Einträge bleiben erhalten
- [ ] Unbekannte Nummer: Gegeben keine Aufgabendatei und keine Board-Zeile mit #99, wenn `GET /api/aufgaben/99/verlauf` aufgerufen wird, dann antwortet er 404 `{fehler}`
- [ ] Register: Gegeben der Endpunkt ist gebaut, wenn `GET /api/endpunkte` und `GET /api/openapi.json` gelesen werden, dann führen beide `GET /api/aufgaben/{nr}/verlauf` mit dem Antwortschema der Einträge

### Darstellung (Reiter)
- [ ] Gegeben der Grundbestand, wenn #1 im Aufgabenfenster geöffnet und der Reiter „Verlauf“ gewählt wird, dann zeigt die Tabelle sechs Zeilen mit den Spalten „Zeit · Art · von → nach · Board · Wer“, neueste oben, die Zeit als „06.10.2026 09:00“ (deutsch, mit Jahr), die Art als Wort (`erstellt`, `bewegt`, `archiviert`, `zurückgeholt`), die Bewegung als „Fertig → vom Board genommen“, „In Arbeit → Fertig“ bzw. „Eingang → In Arbeit“ und das Board als „fabrik“
- [ ] Reiterleiste: Gegeben #1 ohne Preisetikett im Aufgabenfenster, wenn der Kopf betrachtet wird, dann hat die `role="tablist"` „Ansicht der Aufgabe“ genau die Reiter „Inhalt“, „Datei“, „Verlauf“ (in dieser Reihenfolge), der Reiter „Verlauf“ ist `aria-selected`, wenn gewählt, und mit `←`/`→` erreichbar (B0375); Gegeben #1 mit `cost`, dann steht „Kosten“ zwischen „Datei“ und „Verlauf“
- [ ] Nur gelesen: Gegeben #1 im Reiter „Verlauf“, wenn der Reiter geöffnet, angesehen und wieder verlassen wird, dann ist `aufgaben/0001-…md` byte-gleich, `boards/fabrik.md` byte-gleich und `git log` unverändert; das Panel trägt kein Eingabefeld und keinen schreibenden Knopf
- [ ] Kein Datenblock: Gegeben der Grundbestand, wenn die Aufgabendatei und die Board-Datei gelesen werden, dann steht in keiner von beiden ein Verlaufs-Datenblock (kein `kanbanD-log`/`kanbanD-verlauf` o. ä.)
- [ ] Leerzustand: Gegeben eine gerade angelegte Aufgabe, deren Datei noch nicht committet ist (kein Stand in Git), wenn der Reiter „Verlauf“ geöffnet wird, dann steht statt der Tabelle „Kein Verlauf — diese Aufgabe steht noch in keiner Fassung.“
- [ ] Wechsel per Pfeil leert das Panel (Muss): Gegeben #1 im Reiter „Verlauf“ mit sechs Zeilen und #2 mit einem anderen Verlauf in derselben sichtbaren Reihe, wenn ich mit ↓ zur nächsten Karte blättere, dann steht in der Tabelle **zu keinem Zeitpunkt** eine Zeile von #1 — das Panel zeigt beim Wechsel „lädt …“ und danach ausschließlich den Verlauf von #2 (nie Zeilen der vorigen Aufgabe)
- [ ] Zustände des Panels: Gegeben der Reiter „Verlauf“ von #1 wird gewählt, wenn der Endpunkt noch antwortet, dann steht „lädt …“ an der Stelle der Tabelle (keine leere Tabelle, keine Zeilen der vorigen Aufgabe); antwortet der Endpunkt mit Fehler, dann steht die Meldung des Fensters (role=alert): keine leere Tabelle, kein Absturz
- [ ] Leere Zellen: Gegeben ein `erstellt`-, `archiviert`-, `zurueckgeholt`- oder `geloescht`-Eintrag (kein Board, kein von/nach), wenn die Zeile betrachtet wird, dann tragen die Zellen „Board“ und „von → nach“ den Platzhalter „—“ (nicht leer, nicht `null`); bei einem Bewegungseintrag nach `null` steht „Fertig → vom Board genommen“ ausgeschrieben
- [ ] Live: Gegeben #1 im Reiter „Verlauf“ mit sechs Einträgen, wenn über die API ein weiterer Zug committet wird (`POST /api/boards/fabrik/bewegen {nummer: 1, spalte: „In Arbeit“}`) und das Live-Ereignis eintrifft, dann steht die neue Zeile ohne Neuladen spätestens 1 s nach der Antwort der API oben (D00005)

### Kultur und Breiten
- [ ] Deutsche Anzeige: Gegeben der Grundbestand, wenn der Reiter „Verlauf“ geöffnet wird, dann steht an jeder Zeile das Datum als `TT.MM.JJJJ HH:MM` im deutschen Format **mit Jahr** (über `zeitpunktLang`, nicht die Kurzform `zeitpunktKurz`) und den Art als deutsches Wort (ADR-0013); keine ISO-Datumsangabe, kein englischer Art-Schlüssel sichtbar, kein `TT.MM. HH:MM` ohne Jahr
- [ ] Schmales Layout: Gegeben der Grundbestand, wenn die Fensterbreite auf 375 px (und 320 bzw. 414 px) gesetzt und der Reiter „Verlauf“ geöffnet wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth`, `scrollWidth ≤ clientWidth` am Fensterkopf, die Reiterleiste ist ganz sichtbar (sie bricht bei Bedarf in weitere Zeilen um, kein Querscrollen), und die Tabelle scrollt in sich in einem tastaturerreichbaren Querscroll-Rahmen
- [ ] Zielgrößen: Gegeben der Reiter „Verlauf“ ist gewählt, wenn die Reiterleiste gemessen wird, dann ist jeder Reiter mindestens 24 px hoch und bei `pointer: coarse` mindestens 44 px (ADR-0012)

### Nicht-funktional
- [ ] Gegeben eine Aufgabe mit 100 Verlaufs-Einträgen über 5 Boards, wenn der Reiter „Verlauf“ geöffnet wird, dann sind Lesen und Zeichnen zusammen in unter 200 ms fertig (headless Chromium)
- [ ] Gegeben der Grundbestand, wenn der Reiter mit einem Screenreader-Baum gelesen wird, dann nennt die Tabelle jede Kopfzelle über `th scope="col"` und steht die Art als Wort (keine Information allein an Farbe oder Zeichen)

## Betroffene Verzeichnisstruktur

Server: `src/git.rs` (`staende` liefert den Autor mit), `src/verlauf.rs` (reine Funktion `kartenverlauf`, neben `bewegungen`), `src/dienst/` (Lesedienst, der die Board- und Aufgabendatei-Historie zusammenführt), `src/web/mod.rs` (Route), `src/web/endpunkte.rs` und `src/web/openapi.rs` (Beschreibung und Schema). Oberfläche: `web/ansicht.js` (`REITER` um `verlauf`, `vVerlaufPanel` mit den Zuständen lädt/Fehler/leer, Tabelle über `zeitpunktLang` aus `web/kultur.js`, „—“-Platzhalter, geleert beim Blättern nach Muster `blaettern`/R00110), `web/kd-app.css` (Tabelle, Reiterleiste-Umbruch). Tests: `tests/verlauf.rs` (Endpunkt, gegen einen echten Ordner mit Git), `e2e/tests/r00123-kartenverlauf.spec.js`. **Kein neuer Schreibweg, keine neue Ablage, kein Cache.**

## Technische Überlegungen

### Ablauf
1. **Historie lesen**
   - 1.1 `git::staende(wurzel, rel)` (erweitert um den Autor) für `aufgaben/<nr>-…md` und für jede `boards/<slug>.md`.
   - 1.2 Lösch-Commits der Aufgabendatei gesondert lesen (`git log --diff-filter=D`), weil `git::staende` Commits überspringt, in denen die Datei gelöscht ist (`src/git.rs:59–60`).
2. **Zusammenführen** (pure): `kartenverlauf(board_staende_je_board, aufgabe_staende, loesch_commit)` → Einträge je Commit; Bewegung aus dem Vergleich aufeinanderfolgender Board-Stände (`bewegungen`-Logik in `src/verlauf.rs:68`), Archiv/Zurückholen aus dem Wechsel des `archived`-Feldes (`src/modell/aufgabe.rs:374`), Erstellung aus dem ersten Commit, Löschung aus 1.2.
3. **Antworten**: Handler `GET /api/aufgaben/{nr}/verlauf`, 404 ohne jede Spur, sonst die Liste.
4. **Anzeigen**: der Reiter holt den Endpunkt beim Öffnen und bei jedem Live-Ereignis (D00005) und zeichnet die Tabelle.

### Grobentwurf

**Wichtige Einstiegsstellen:** Aufgabenfenster (`web/ansicht.js`, `REITER`/`vFenster`), Fensterkürzel `d` (`web/app.js`), Route `GET /api/aufgaben/{nr}` (Nachbar in `src/web/mod.rs`).

- `Stand` (DTO, immutable) — ein committeter Stand: Zeitpunkt, Inhalt, Autor (Name und E-Mail).
- `KartenEintrag` (DTO, immutable) — ein Eintrag: Zeitpunkt, Art, Wer, Board (optional), von/nach (optional).
- `Kartenverlauf` (benannte Collection) — die Einträge, neueste zuerst; `Leer()`.
- `kartenverlauf(staende, aufgabe, loeschung, personen) -> Kartenverlauf` (reine Funktion, IOSP) — führt die Historie je Commit zusammen, bildet `%ae` auf das Kürzel zurück.
- `Kanban::karten_verlauf(nr)` (Integration, fängt Fehler) — liest 1.1/1.2, ruft `kartenverlauf`.
- `vVerlaufPanel(a)` (Ansicht) — die Tabelle des Reiters.

### Änderungen an bestehenden Klassen
- `git::staende` (`src/git.rs:61`): Rückgabe um den Autor erweitern (aus `git log --format=%an %ae %at`); der bestehende Aufrufer `src/dienst/verlauf.rs` zieht nach.
- `REITER` (`web/ansicht.js:222`): um `['verlauf', 'Verlauf']` ergänzen; `vFenster` zeichnet das Panel.
- `src/verlauf.rs`: die Bewegungslogik aus `bewegungen` (`:68`) wird wiederverwendet, nicht dupliziert.

## Tests

**Unit (Rust):** `kartenverlauf` mit dem Rechenbeispiel der AK (fünf Commits, zwei Autoren, vom Board genommen, Rückkehr, gelöscht, mehrere Boards, unbekannte Nummer → leer); `%ae`-Rückabbildung mit fremdem Autor.
**Integration (Rust):** `tests/verlauf.rs` gegen einen echten Ordner mit Git: der Grundbestand über die API, `GET /api/aufgaben/1/verlauf` mit exakt den Einträgen, 404 für #99, `/api/endpunkte` und `/api/openapi.json` nennen den Pfad, `git log` und beide Dateien nach dem Lesen unverändert.
**E2E:** `e2e/tests/r00123-kartenverlauf.spec.js`: Reiter öffnen, Tabelle (Zeit deutsch **mit Jahr** über `zeitpunktLang`, Art, von → nach, Board, Wer, „—“ in leeren Zellen), Reiterleiste (2/3/4 Reiter, `←`/`→`, Umbruch bei 320/375/414 px), **Blättern per ↑/↓ leert das Panel** (zwei Karten mit verschiedenem Verlauf, nie eine Zeile der vorigen), **Ladezustand „lädt …“** und **Fehlerzustand** (Endpunkt antwortet langsam bzw. mit Fehler), Nur-gelesen (Datei und `git log` gleich), Leerzustand, Fremdautor, mehrere Boards, Live, schmales Layout (320/375/414 px), Zielgrößen, Screenreader-Baum, Leistung (100 Einträge < 200 ms), kein Datenblock (`grep` in den Dateien).

## Abhängigkeiten
- Abhängig von: R00042 (Bewegungen aus der Git-Geschichte), R00105/B0375 (Reiterleiste als `tablist`), R00084 (Zeitpunkte mit Versatz), R00017 (archivieren/zurückholen), R00020 (vom Board nehmen)
- Gestaltung: **ux-Vorprüfung #119** vor dem Bau und Artboard **D0003** „Aufgabe“ (gestalter, `/wireframe verfeinern D0003`): der Reiter „Verlauf“ ist ein **neuer Tab** mit neuer Tabelle und braucht den Zustand **`#reiter-verlauf`** in D0003 — er ist dort **noch nicht gezeichnet** und muss vor dem Bau **gezeichnet und vom product-owner freigegeben** werden (`AI-Team/po-entscheidungen.md`, Vision-Leitplanke „Jede Gestaltung wird freigegeben“). **Bau-Sperre Oberfläche:** F0096/B0575–B0650 warten auf diese Freigabe. Der Endpunkt und die reine Rechnung (F0095) sind davon frei baubar.
- Blockiert: R00124 (Datums-Trenner, eigenes Thema unter D0002) nicht durch diese Anforderung — siehe Notizen.

## Offene Fragen

Keine, die den Bau blockieren. Die Fragen aus ADR-0021 sind entschieden (Empfehlungen des planers, im Dokument eingearbeitet, Entscheidungen im Bericht); die **UX-Vorprüfung #119** ist eingearbeitet (siehe Notizen). Offen bleibt allein die **Artboard-Freigabe** (`#reiter-verlauf` an D0003, product-owner) — sie sperrt nur die Oberfläche, **nicht** Endpunkt und Rechnung (F0095).

- **Umfang**: **voller Umfang** — Erstellung, Bewegung (von/nach, auch vom Board genommen / auf das Board gelegt), Archivierung, Zurückholen und Löschung der Datei. Die Karte nennt alle vier Bewegungsarten; der volle Umfang ist die Linie der ADR.
- **„wer“**: **Commit-Autor**; `%ae` = `<kürzel>@kanbanD` → Kürzel, sonst Git-Name unverändert (Vorschlag der ADR).
- **Je Board**: der Endpunkt führt **alle Boards zusammen**, je Bewegungseintrag das Board genannt; ein `?board=`-Filter ist Ausbaustufe.
- **Löschung**: „vom Board genommen“ = Bewegung mit `nach: null`; eine **gelöschte Aufgabendatei** ergibt einen eigenen Eintrag `geloescht` (der Lösch-Commit, mit Autor). Beide sind in der Anforderung.
- **Tab vs. Abschnitt**: **Reiter** (Karte und ADR), immer sichtbar.
- **Zeitraum/Filter**: **kein** Filter; eine Karte hat wenige Einträge, die Tabelle ist vollständig.

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Frage „wer hat wann diese Karte von X nach Y geschoben, und wann wurde sie fertig?“ — heute unbeantwortbar ohne Git-Kenntnisse: Man liest `git log` über die Board-Datei und stellt den Bezug zur Nummer selbst her. Die Vision sagt bereits, dass genau diese Information in den Commits steht („wann eine Aufgabe angelegt, geändert und wohin sie bewegt wurde“), und kanbanD committet unter dem Namen der handelnden Person — der Verlauf muss also nicht **erhoben**, sondern nur **sichtbar gemacht** werden. Der Hebel ist die vorhandene Git-Geschichte: Aus ihr rechnet die Anforderung Erstellung, Bewegung, Archiv und Löschung samt Autor, ohne einen zweiten Speicher und ohne einen neuen Schreibweg (ADR-0021). Die Wirkungskette: vorhandene Commits → gerechneter Karten-Verlauf in den Aufgaben-Details → der Mensch liest an der Karte selbst, wer wann gehandelt hat und wann sie „Erledigt“ erreichte → er braucht weder Git noch die Board-Datei. Eine vorgelagerte Änderung (Verlaufs-Datenblock in der Karte) wäre eine zweite Datenhaltung und fehlte für die ganze Vergangenheit; eine nachgelagerte (nur rohe Commits anzeigen) ließe den Nutzer selbst diffen.

## Missing-Docs

- Ob der Verlauf später **je Board filterbar** (`?board=`) oder **auf einen Zeitraum** eingegrenzt werden soll, ist in keiner Anforderung beschrieben. Der planer empfiehlt: keine Eingrenzung jetzt; eine Board-Auswahl ist eine Ausbaustufe.
- Der Umgang des Endpunkts mit einer **umbenannten** Aufgabendatei (Nummer bleibt, Titel ändert den Dateinamen) ist in keiner Anforderung beschrieben. Der planer nimmt an, dass die Nummer die Karte identifiziert und die Historie über den Nummern-Präfix (`NNNN-`) gefunden wird; der Entwickler kann das beim Bau bestätigen.

## Notizen

**Optionen-Tableau (Skill `optionen-vor-entscheidung`):**

- **A — Verlauf aus der Git-Geschichte rechnen** (gewählt, ADR-0021 Option A): neuer Lese-Endpunkt, „wer“ aus dem Commit-Autor; kein zweiter Speicher, rückwirkend, gilt für Änderungen von außen.
- **B — Verlaufs-Datenblock in der Karte** (ADR-0021 Option B, `kanbanD-log`): beim Anlegen/Bewegen/Archivieren einen Eintrag anhängen. Schnell zu lesen, aber eine zweite Datenhaltung, größerer Diff, fehlt für die Vergangenheit — verworfen (bricht „Die Dateien sind der einzige Speicher“).
- **C — Rohliste der Commits** an der Karte (Hash, Zeit, Autor, ohne „Art“): kleinster Umfang, aber der Nutzer muss je Eintrag erneut diffen; verworfen.

Zur Zerlegung innerhalb von A:
- **Umfang — nur Bewegungen · Bewegungen + Erstellung/Archiv · voll inkl. Löschung**: gewählt **voll inkl. Löschung** (Kartentitel nennt Erstellungen, Bewegungen, Archivierungen, Löschungen).
- **Einheit eines Eintrags — je Commit oder je Stand/Wechsel**: gewählt **je Commit** (ein Satz Einträge, keine Doppelung von Erstellung und erstem Spalteneintritt).
- **Art der Anzeige — Reiter oder Abschnitt im Reiter „Inhalt“**: gewählt **Reiter** (Karte: „als eigener Tab in den Aufgaben-Details“).

**Einarbeitung UX-Vorprüfung #119 (2026-11-11, Kartenkommentar #119):** *(Muss)* Beim Blättern per ↑/↓ bei gewähltem Reiter „Verlauf“ **leert** das Panel die Tabelle sofort und lädt den Verlauf der neuen Aufgabe — nie Zeilen der vorigen (FA, AK „Wechsel per Pfeil leert das Panel“, B0650; Muster R00110 Nacharbeit 1). *(Muss)* Die Oberfläche ist **bau-gesperrt**, bis der gestalter den Zustand **`#reiter-verlauf`** an D0003 gezeichnet und der product-owner ihn freigegeben hat (Abhängigkeiten „Gestaltung“). *(Sollte)* Die Zeit-Spalte nutzt `zeitpunktLang` (`web/kultur.js`) statt der Durchläufe-Kurzform `zeitpunktKurz`; der Reiter kennt einen **Ladezustand** („lädt …“) und einen **Fehlerzustand** (Meldung des Fensters); leere Zellen tragen „—“; der **4-Reiter-Kopf** (Inhalt, Datei, Kosten, Verlauf) bleibt bei 320/375/414 px ohne Querscrollen (die Reiterleiste bricht um, jeder Reiter ≥ 24 px, Touch ≥ 44 px; E1 aus R00127).

**Verworfene Alternativen**
- *Eigener Datenblock* (`kanbanD-verlauf` in der Aufgabendatei): verboten durch ADR-0021; ein Review-Befund, falls er entsteht.
- *Ein schreibender Endpunkt*, der den Verlauf fortschreibt: verboten durch ADR-0021; es gibt keinen neuen Schreibweg.
- *Verlauf im Board-Bericht statt an der Karte*: die Frage ist je Karte, nicht je Board; R00042 deckt die Board-Sicht bereits ab.
- *Nur die letzte Spalte als „erledigt“-Eintrag heben*: ein eigenes Art `erledigt` verschleiert die Bewegung; die Gegenwart der bewegten Karte ist der bessere Beleg.

**Verwiesenes**
- Karte #119 (Betreiber, „Log aller Erstellungen/Bewegungen/Archivierungen/Löschungen je Karte als eigener Tab“); #33 geht darin auf (Duplikat, archiviert).
- ADR-0021 „Karten-Verlauf aus der Git-Geschichte gerechnet — ableiten statt speichern“ (13c9d20).
- Die **Datums-Trenner** aus Karte #119, Absatz 2, sind **eigenes Thema unter D0002** und als eigene Anforderung R00124 festgehalten (ADR-0021 „Geltung“), nicht Teil dieser Anforderung.

**Begriff „Verlauf“ doppelt belegt (Notiz zu Karte #119):** „Verlauf“ meint in diesem Projekt **zwei** Dinge — (1) den **Bericht** in der Berichte-Gruppe (`#/berichte/verlauf`, das Burndown, `web/tastatur.js:37`, `web/ansicht.js:963` „Burndown“) und (2) den **Kartenreiter** „Verlauf“ im Aufgabenfenster (diese Anforderung). Beide sind Kontexte desselben Wortes; nach der Glossar-Regel (`rollen/fachspezialist/glossar-pflege.md`, „Kontexte und Homonyme“) gehören sie als zwei Einträge ins Glossar (`Dokumentation/Domaenenwissen/`, Homonym, gegenseitig verlinkt). Der **fachspezialist** legt die Einträge an (`/domaenenwissen anlegen`); der planner schreibt keine Glossareinträge (Rollengrenze).
