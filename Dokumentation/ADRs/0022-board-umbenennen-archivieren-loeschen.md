# ADR-0022: Board umbenennen, archivieren, löschen — Titel ändern, `archived` im Board-Frontmatter, Datei löschen; der Slug bleibt

**Status**: Akzeptiert
**Datum**: 2026-11-11
**Entscheider**: Claude (autonom, architekt, Auftrag Betreiber Karte #35)
**Kontext-Anforderung**: Karte #35 „Board umbenennen, archivieren, löschen in der Oberfläche“; Anforderung und WBS-Interaction folgen über den planner (neue Interaction unter D0002).
**Erprobt durch**: — (getragen von der bestehenden Systemantwort und den Leitplanken: `<ordner>/boards/<slug>.md`, ein Board = eine Datei; Aufgabenarchiv `archived:` mit bleibender Datei, R00017; Git als Gedächtnis)
**Nachträge**: keine

## Kontext

- **Karte #35** verlangt die üblichen Kanban-Funktionen, die heute fehlen: ein Board **umbenennen**, **archivieren** und **löschen** in der Oberfläche (Herkunft: Beratung product-owner 2026-11-03; Referenz Trello, Planka, Wekan; Priorität PO niedrig). R00008 kennt nur **Wechseln und Anlegen** (`Anforderungen/R00008-boards-wechseln-und-anlegen.md`); heute geht alles Weitere nur über den Editor.
- **Vorprüfung (Kartenkommentar #35, 2026-11-11)**: Die Technikfrage ist **ja** — Umbenennen/Archivieren/Löschen berührt **Ordneraufbau und Format**: ein Board ist **eine Datei `boards/<slug>.md`**, und der **Slug** ist zugleich **Dateiname**, **URL-Kennung** und Schlüssel des **Berichte-Caches**. Ein Board-Archiv und eine Löschroute gibt es nicht. Daher neue ADR (Betreiberfreigabe).
- **Vision** `Anforderungen/R00000-vision.md`:
  - Z. 16–22: „kanbanD ist ein Kanban, das ein Ordner ist … je Board eine Markdown-Datei … Jede Aktion wird sofort committet, so ist Git das vollständige Gedächtnis.“
  - Z. 55–59: „**Das Board besitzt seine Struktur.** Ein Board ist eine Markdown-Datei im Boardverzeichnis.“
  - Leitplanke Z. 135–139: „**Ordneraufbau.** … `<ordner>/boards/` die Boards (`<slug>.md`). Eine Board-Datei hat je Spalte eine Überschrift und je Aufgabe darunter eine Zeile.“
  - Leitplanke Z. 150–153: „**Die Dateien sind der einzige Speicher.** … Ein Index oder Cache darf existieren, muss sich aber jederzeit aus den Dateien neu aufbauen lassen und wird nicht versioniert.“
  - Leitplanke Z. 154–158: „**Git-freundliche Form.** Die Dateien … haben **stabile IDs** … ändern sich nur dort, wo sich etwas ändert.“
  - Z. 61–66: „**Git ist das Gedächtnis.** … Die Git-Geschichte ist damit das vollständige Archiv“; Leitplanke Z. 159–160: „**Ein Commit je Aktion.**“
- **Belegt (Code)**:
  - `Board` führt **`slug` und `titel` getrennt** (`src/modell/board.rs:301–303`). Der `slug` ist der Dateiname (`src/ablage.rs:193` `board_pfad`), der `titel` die `# `-Überschrift (`src/format/board.rs:42–43` liest, `:376` schreibt).
  - `Ordner::boards` liest **flach** alle `boards/*.md` (`src/ablage.rs:63–78`, `markdown_dateien` `:135–155`); `Ordner::board` prüft die Form **vor** dem Lesen (ADR-0008, `src/ablage.rs:125–132`).
  - **Kein Board-Archiv, keine Löschroute**: `src/web/endpunkte.rs:34–51` kennt nur `GET`/`POST /api/boards` und `PUT` je Einstellung — kein `PATCH`/`DELETE` auf `/api/boards/{slug}`.
  - Der **Slug** steht in der Adresse `#/board/<slug>` (R00008) und im **Berichte-Cache** `berichte/<slug>-fieber.md` (`src/dienst/fieber.rs:1`, `:62`, `:101`, `:109`).
  - Anlegen `Kanban::board_anlegen` (`src/dienst/board_anlegen.rs:18–38`): **409** bei belegtem Slug (`:33–35`).
  - **Aufgabenarchiv als Vorbild**: `archived: <Datum>` in der Aufgabendatei, die Zeile **bleibt**, laufende Timer enden (R00017; `src/dienst/archiv.rs`).
- **Die Gabelung**: (A) nur den **Titel** ändern und den Slug als Identität stehen lassen, (B) den **Slug/Dateinamen** mitziehen, (C) einen **Unterordner** als Archiv.

## Optionen

### Option A: Titel ändern, `archived`-Flag, Datei löschen — der Slug bleibt (gewählt)

Umbenennen schreibt nur die `# `-Überschrift neu (`Board.titel`); der **Slug bleibt** Dateiname, URL und Cache-Schlüssel. Archivieren setzt `archived: <JJJJ-MM-TT>` ins Board-Frontmatter, die Datei bleibt liegen; archivierte Boards fallen aus Liste und Schalter. Löschen entfernt die Board-Datei.

- Stärke: **leitplankentreu** (ein Board bleibt eine Datei unter `boards/`, kein zweiter Ort, keine Leitplanken-Änderung); **stabile Identität** (URL, Lesezeichen und `berichte/<slug>-fieber.md` überleben das Umbenennen); **konsistent zum Aufgabenarchiv** (`archived:` + bleibende Datei, R00017); **Git ist der Papierkorb** (Löschung wiederherstellbar, Vision Z. 61–66); kleine Diffs (Überschrift ändern, eine Zeile ergänzen).
- Nachteil: nach dem Umbenennen sind **Titel und Dateiname verschieden** (der Dateiname ist die stabile Identität, nicht der Anzeigename); das Board-Frontmatter bekommt einen **neuen Schlüssel** (Formatänderung A00005); Liste und Schalter müssen archivierte Boards ausblenden, sonst ist „archiviert“ unsichtbar.

### Option B: Slug/Dateiname umbenennen

Umbenennen zieht den Slug mit: die Datei `boards/<alt>.md` wird zu `boards/<neu>.md` (der Dateiname bleibt das Bild des Titels).

- Stärke: ein Board, ein Name — Dateiname und Anzeige laufen nicht auseinander.
- Nachteil: der **Slug ist Identität** — Adresse `#/board/<slug>`, Lesezeichen und der Berichte-Cache `berichte/<slug>-fieber.md` brechen; die Datei muss verschoben werden (Git erkennt Umbenennungen nur heuristisch), ein **belegter Ziel-Slug wäre 409**; „stabile IDs“ (Z. 154) wird verletzt.

### Option C: Unterordner `boards/archiv/`

Archivierte Boards wandern nach `boards/archiv/<slug>.md`; Zurückholen verschiebt sie zurück.

- Stärke: das Archiv ist im Dateibaum sichtbar; Aus- und Einlagern ist ein Datei-Zug.
- Nachteil: **zweiter Ort/Unterordner** — die Leitplanke „Ordneraufbau“ (Z. 135–139) nennt `boards/<slug>.md` **flach**, und `Ordner::boards` scannt flach (`src/ablage.rs:63–78`); Verschieben über Ordner hinweg und die nötige Leitplanken-Änderung bräuchten **Betreiberfreigabe**.

### Option D (Ergänzung, keine Alternative): die Datei physisch löschen statt in einen Papierkorb verschieben

- Git ist der Papierkorb (Z. 61–66); die Git-Geschichte hält die gelöschte Board-Datei. Kein zweiter Ort, kein `.bak`.

## Entscheidung

**Gewählt: Option A.**

1. **Umbenennen = Titel ändern, der Slug bleibt.** `Board` führt `slug` (Identität: Dateiname, URL, Cache-Schlüssel) und `titel` (Anzeigename) schon getrennt (`src/modell/board.rs:301–303`). `PATCH /api/boards/{slug}` mit `{titel}` schreibt nur die Überschrift neu. Dateiname, `#/board/<slug>`, Lesezeichen und `berichte/<slug>-fieber.md` bleiben unverändert — „stabile IDs“ (Z. 154).
2. **Archivieren = `archived: <JJJJ-MM-TT>`** ins Board-Frontmatter (neuer Schlüssel, Formatänderung A00005); sonst ändert sich nichts, die Datei bleibt liegen. Ein archiviertes Board fällt aus `GET /api/boards` und aus `zustand.boards` (der Board-Schalter) heraus, bleibt aber über `?archivierte=ja` erreichbar — dieselbe Sprache wie das Kartenarchiv. Datum wie in der Aufgabe (R00017) gibt „archiviert am“ her; `false`/fehlender Schlüssel = offen.
3. **Löschen = die Datei löschen** (`boards/<slug>.md`, dazu der verwaiste Cache `berichte/<slug>-fieber.md`), **ein Commit**; über die Git-Geschichte wiederherstellbar (Z. 61–66). Kein Papierkorb, kein zweiter Ort.
4. **Der Slug bleibt beim Umbenennen stehen; deshalb entsteht beim Umbenennen kein 409.** Ein **belegter Slug** bleibt eine Abweisung des **Anlegens** (`POST /api/boards`, `src/dienst/board_anlegen.rs:33–35`); bei Option B wäre 409 `{fehler}` die richtige Antwort auf einen belegten **Ziel-Slug** — Kapitel 1 verwirft genau diese Slug-Wanderung.

**Akzeptierte Schwäche.** Ich nehme bewusst in Kauf:

- **Titel ≠ Dateiname.** Nach dem Umbenennen zeigt der Titel einen anderen Namen als Datei/URL; der Slug ist bewusst nur eine stabile technische Identität, kein Anzeigename (wie die Aufgabendatei `0001-…md`, deren Titel sich ändern darf).
- **Formatänderung.** Ein neuer Board-Frontmatter-Schlüssel `archived`; das Modell `Board` bekommt ein Feld, wodurch sich die `Board { … }`-Literale in Code und Tests anpassen (einmalige Kosten).
- **Archiv nur über einen Schalter sichtbar.** Liste und Oberfläche müssen archivierte Boards ausblenden/hervorheben; ohne das wäre „archiviert“ unsichtbar.
- **Löschen ist scharf.** Ein Commit entfernt die Board-Datei; wer sie nicht über Git zurückholt, verliert die Struktur. Die Aufgaben bleiben als unabhängige Daten erhalten (Z. 51–53).

## Konsequenzen

**Positiv:**

- **Leitplankentreu.** Ein Board bleibt eine Datei unter `boards/` (`<slug>.md`); kein zweiter Ort, keine Leitplanken-Änderung.
- **Stabile Identität.** URL, Lesezeichen und Berichte-Cache überleben das Umbenennen; der Cache bleibt gültig (anders als bei Option B).
- **Einheitlich.** Das Board-Archiv spiegelt das Aufgabenarchiv (`archived:` + bleibende Datei); Git bleibt der Papierkorb.
- **Kleine Diffs.** Umbenennen ändert eine Überschriftzeile, Archivieren fügt eine Frontmatter-Zeile hinzu („Git-freundliche Form“, Z. 154–158).

**Negativ / In Kauf zu nehmen:**

- Die vier akzeptierten Schwächen oben (Titel ≠ Dateiname, Formatänderung, Sichtbarkeit des Archivs, scharfes Löschen).
- Ein gelöschtes Board lässt seine Karten als **unzugeordnete** Aufgaben zurück; sie sind über die Aufgabenliste weiter sichtbar, aber von keinem Board mehr getragen (Vision Z. 51–53, „Eine Aufgabe auf keinem Board bleibt sichtbar“).

**Ausprägung des Schreibwegs (Soll):**

- **Neue Wege** auf `/api/boards/{slug}`, beide als Methode von `Kanban` nach der Hausantwort X00001 (`gesperrt()` → Prüfung → `aktion()`; **eine öffentliche Methode = eine Sperre = ein Commit**, ADR-0005), in `src/dienst/board_anlegen.rs` (oder ein eigenes `board_verwalten.rs`):
  - **`PATCH /api/boards/{slug}`** `{titel?, archiviert?}` — Titel ändern (nicht leer, sonst 400) und/oder Archiv setzen (`true` → `archived: <heute>`, `false` → Schlüssel weg). Ohne Änderung **kein Commit**. Antwort das Board. Unbekanntes Board 404, ungültige Slug-Form 400 (beide über `Ordner::board`, ADR-0008).
  - **`DELETE /api/boards/{slug}`** — löscht `boards/<slug>.md` (und `berichte/<slug>-fieber.md`), **ein Commit**. Unbekannt 404.
- **Routen und Liste**: `GET /api/boards` und `zustand.boards` lassen archivierte Boards weg; `?archivierte=ja` nimmt sie auf (Sprache des Kartenarchivs). Das Board-JSON trägt `archiviert: <Datum> | null`.
- **Eigentümer-Sperre (R00097, R00120)**: **Umbenennen** bewegt keine Karte → frei. **Archivieren und Löschen** nehmen einem Board alle Karten aus dem Blick und werden wie „vom Board nehmen“/„archivieren“ geprüft: liegt eine Karte des Boards in einer **Menschen-Spalte**, ist ein Agent gesperrt → **403 `{fehler, spalte, nummer}`** (über alle Spalten, fail-safe; die Sperre hängt an `Board::entnahme_erlaubt`, `src/modell/board.rs:547–559`, und `entnahme_pruefen`, `src/dienst/zugregeln.rs`); der Mensch ist frei. So umgeht kein Agent R00097 über das Löschen eines ganzen Boards.
- **Das Anlegen bleibt unberührt**: `POST /api/boards` und sein **409** bei belegtem Slug (`src/dienst/board_anlegen.rs:33–35`).
- **Erkennung**: die neuen Board-Schreiber tauchen unter `board_pfad(` in `src/dienst/` auf — in X00001 als Board-Schreiber **ohne Kartenzug** einzuordnen (Ausnahmen-Liste), `DELETE` als neuer **Löschweg**.

**Nachziehen im Modell (Soll):**

- **A00005 Format**: Board-Frontmatter liest/schreibt `archived: <JJJJ-MM-TT>` (`src/format/board.rs`), mit Rundlauf-Test (Muster `report-labels`, `:671–693`); der `---`-Block erscheint auch, wenn nur `archived` gesetzt ist (`:311`). Ein ungültiges Datum ist ein `Formatfehler` (wie `start`, `:30–33`).
- **A00006 Modell**: `Board` bekommt `archiviert: Option<String>`; die `Board { … }`-Literale anpassen (`src/modell/board.rs`, Tests in `src/format/board.rs`).
- **A00007 Git**: Löschen ist kein „Text schreiben“ — `aktion()` (`src/dienst/mod.rs:163–173`) schreibt Text. Für `DELETE` wird die Datei entfernt und der Pfad committet (**ein Commit**); vorher alle Pfade prüfen (zweite Linie, ADR-0008).
- **X00001 Schreibweg und Regeln an Zügen**: die Tabelle um die drei Board-Aktionen ergänzen (umbenennen / archivieren / löschen), Eigentümer-Spalte für archivieren und löschen „ja (alle Spalten des Boards)“, die neuen Board-Datei-Schreiber in die Ausnahmen-Liste.

**Durchsetzung / Proben:**

- **Rundlauf-Probe (Format)**: Board mit `archived: 2026-11-11` schreiben → lesen → byte-gleich; ohne Schlüssel kein `archived`; ungültiges Datum → `Formatfehler` (kein stiller Verlust).
- **Slug-Probe (die Kernentscheidung)**: Board umbenennen → `#/board/<slug>` und `berichte/<slug>-fieber.md` **unverändert**; `GET /api/boards/{slug}` liefert **alten Slug, neuen Titel**.
- **Listen-Probe**: archiviertes Board fehlt in `GET /api/boards` und in `zustand.boards`, ist mit `?archivierte=ja` dabei; `archiviert` erscheint im Board-JSON.
- **Sperr-Probe**: Agent archiviert/löscht ein Board mit einer Karte in einer Menschen-Spalte → **403 `{fehler, spalte, nummer}`**, nichts geschrieben; Mensch frei; **Umbenennen frei**.
- **Lösch-Probe**: `DELETE` → Board-Datei (und Cache) weg, **genau ein Commit**, Board aus der Liste; die Karten bleiben als unabhängige Aufgaben erhalten (`GET /api/aufgaben`).
- **Review-Punkt `architektur-reviewer`/`code-reviewer`**: ein **zweiter Archiv-/Papierkorb-Ort** (`boards/archiv/`, `<slug>.md.bak`, Papierkorb) oder ein beim Umbenennen **wandernder Slug** ist ein **Befund** — er bricht diese ADR. Ein Board-Schreibweg außerhalb von `gesperrt()` → `aktion()` ist ein Befund (X00001).

**Geltung:** **Makro** für die Verwaltung von Boards (umbenennen, archivieren, löschen). Die Oberfläche (Board-Schalter/Menü) und die neue Interaction unter D0002 sind WBS-Stoff (planner/ux), nicht diese ADR.

**Folgeentscheidungen / Aufgaben:**

- [ ] Anforderung aus Karte #35 nach dieser ADR (Vorschlag im Bericht an den Director).
- [ ] WBS: neue Interaction unter D0002 (über den planner).
- [x] ADR-0022 an den Bausteinen A00003/A00004/A00005/A00006/A00007 und am Aspekt X00001 verlinken (Section `Entscheidungen`). *(erledigt 2026-11-11, [DOC]: A00003–A00007 unter `Entscheidungen`; am Aspekt X00001 im Löschweg-Absatz verlinkt — Aspekte führen die fünf Sections Hausantwort/Systemantwort/Abweichungen/Offene Fragen/Notizen, keine `Entscheidungen`-Section)*

## Offene Fragen

- **Letztes Board.** Darf das letzte Board archiviert oder gelöscht werden? Vorschlag: ja — die Instanz darf ohne Board dastehen (leerer Zustand, Board-Schalter „Kein Board · neues anlegen“); ein neues entsteht mit `POST /api/boards`. Alternative: 409 „das letzte Board bleibt“. Entscheidung beim PO/UX (Artboard).
- **Slug umbenennen (Option B).** Kein Weg ändert den Slug. Soll ein künftiges „Slug umbenennen“ überhaupt kommen? Vorgabe: nur mit **eigener ADR**, weil es URL, Lesezeichen und Cache bricht.
- **Archiv sichtbar?** Nur ausblenden, oder im Schalter als eigener Abschnitt „Archiviert (n)“ wie das Kartenarchiv? UX-Thema unter D0002.
- **Cache beim Löschen.** `berichte/<slug>-fieber.md` mitlöschen (Vorschlag, ein Commit) oder verwaisen lassen (er ist ein Cache, Z. 150–153, jederzeit neu rechenbar)?

## Quellen / Bezüge

- Karte #35 „Board umbenennen, archivieren, löschen in der Oberfläche“ (Herkunft Beratung product-owner 2026-11-03); Vorprüfung Kartenkommentar #35 (2026-11-11)
- Vision `Anforderungen/R00000-vision.md`: Z. 16–22, 51–59, 61–66, 135–139, 150–158, 159–160
- `Anforderungen/R00008-boards-wechseln-und-anlegen.md` (Anlegen, 409, `#/board/<slug>`), `Anforderungen/R00017-archivieren-und-zurueckholen.md` (`archived:`, Datei bleibt)
- `src/modell/board.rs:301–303` (`Board { slug, titel }`), `:547–559` (`entnahme_erlaubt`); `src/ablage.rs:63–78` (`boards`), `:125–132` (`board`), `:193` (`board_pfad`); `src/format/board.rs:10–79` (lesen), `:287–390` (schreiben), `:671–693` (Rundlauf-Muster); `src/dienst/board_anlegen.rs:18–38` (anlegen, 409); `src/dienst/mod.rs:163–173` (`aktion`); `src/dienst/fieber.rs:1`, `:62`, `:101`, `:109` (Cache-Pfad); `src/web/endpunkte.rs:34–51` (Board-Endpunkte)
- [ADR-0005](0005-zusammengesetzte-aktionen-in-einem-commit.md), [ADR-0006](0006-einstellung-verboten-als-dritte-abweisung.md), [ADR-0008](0008-board-slug-geprueft-vor-jedem-dateizugriff.md)
- Bausteine [A00005 Format](../Architektur/A00005-format.md), [A00007 Git](../Architektur/A00007-git.md); Aspekt [X00001 Schreibweg](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md)
