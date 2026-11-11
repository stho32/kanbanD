---
id: R00141
status: Neu
datum: 2026-11-11
---

# R00141: Aufgabe endgültig löschen

## Beschreibung

Eine Aufgabe lässt sich endgültig löschen: Aufgabendatei, ihre Zeile aus **allen** Board-Dateien und ihr Anhangsordner verschwinden in **einem** Zug; nur die Git-Historie behält sie (Git ist der Papierkorb). Der Weg läuft über die API (`DELETE /api/aufgaben/{nr}`) und aus der Oberfläche über eine Rückfrage; **auch Agenten dürfen löschen**, aber unter der bestehenden Spalten-Sperre (aus Menschen-Spalten 403, defektes Board 423). „Endgültig löschen“ ist die dritte Bewegung der Archiv-Familie neben „archivieren“ und „zurückholen“ (R00017) und neben „von Board nehmen“ (R00020).

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis“, „Aufgaben sind unabhängige Daten“.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Heute lässt sich eine Aufgabe nur **archivieren** (R00017): `archived: <Datum>` in der Datei, die Zeile bleibt in der Board-Datei, der Anhangsordner bleibt liegen. Für versehentlich angelegte, doppelte oder erledigte Test-Karten gibt es keinen Weg, sie wieder loszuwerden: Sie sammeln sich im Aufgabenordner, belegen die Board-Datei (Archivzeile je Board) und halten Nummer und Schlüssel fest. Trello und Kanboard — die Referenzprodukte der Karte #36 — löschen eine Karte wirklich. Diese Anforderung gibt dem Betreiber und den Agenten denselben Weg: eine Karte, die nie wieder gebraucht wird, verschwindet aus dem Arbeitsbaum; wer sie doch braucht, holt sie aus der Git-Historie zurück (`git checkout`/`git show`).

## Funktionale Anforderungen

### Endgültig löschen über die API

1. `DELETE /api/aufgaben/{nr}` entfernt die Aufgabendatei, ihre Zeile aus **allen** Board-Dateien und ihren Anhangsordner in **einem** Commit. Antwort **200** `{nummer}`.
2. Unbekannte Nummer → **404**; nichts wird geschrieben.
3. Der Commit nennt `#<nr> gelöscht`, bei Anhängen zusätzlich `, k Anhänge`, bei mehreren Boards ` (m Boards)` (Muster `#<nr> archiviert`).
4. Laufende Timer enden mit der Datei; eine Reservierung verschwindet mit ihr (kein eigener Zustand bleibt zurück).
5. Eine Aufgabendatei, die nicht lesbar (defekt) ist, lässt sich löschen; der Löschweg braucht nur ihren Pfad, nicht ihr Modell.

### Spalten-Sperre (auch Agenten dürfen löschen)

6. Ein Agent, dessen Karte auf **irgendeinem** Board in einer Menschen-Spalte liegt (`column-owner: human`), wird **403** `{fehler, spalte, nummer}` abgewiesen; nichts geändert, kein Commit (R00097, ADR-0003). Für Menschen bleibt alles frei.
7. Ist eine Board-Datei des Ordners unlesbar, wird ein Agent mit **423** abgewiesen; nichts geändert (R00120).

### Ein Weg, eine Sperre, ein Commit

8. Der Löschweg läuft über `aktion()`; `aktion()` kann jetzt neben **Schreiben** auch **Entfernen**. Es prüft **alle** Pfade beider Arten vor dem ersten Schreiben oder Entfernen (ADR-0008, zweite Linie).
9. Die Dienstmethode `Kanban::endgueltig_loeschen(wer, nr)` ist die dritte Bewegung der Archiv-Familie und läuft unter derselben Sperre `gesperrt()` wie ihre Geschwister (ADR-0005).

### Oberfläche

10. Das Kartenmenü und das Aufgabenfenster bieten „Endgültig löschen“; die Oberfläche fragt vorher in einer Rückfrage „endgültig löschen“ nach (Warnung: unumkehrbar, wiederherstellbar nur über die Git-Historie).
11. Abbrechen der Rückfrage ändert nichts.

### Geltung und Nachzug

12. Die Regel gilt für das Löschen **einer** Aufgabe. „archivieren“, „zurückholen“ (R00017) und „von Board nehmen“ (R00020) bleiben unberührt.
13. Aspekt X00001 (Schreibweg/Abweichungen/Wächter) wird um den Löschweg und den neuen Board-Datei-Schreiber nachgezogen (Wächter `tests/aufruf_vergessen.rs`); Format A00005 (die Board-Datei verliert eine Zeile, kein Formatwechsel) und Git A00007 (Lösch-Commits; `git::staende` überspringt sie) werden geprüft und fortgeschrieben.

## Nicht-funktionale Anforderungen

- **Atomarität:** eine Löschung ist **ein** Commit (Vision Z. 159–160); schlägt die Pfadprüfung fehl, ist nichts geschrieben und nichts entfernt; eine Abweisung (403/404/423) committet nicht.
- **Rückwärtsverträglich:** kein Formatwechsel; eine Aufgabendatei, die nie gelöscht wird, bleibt byte-gleich; nur die betroffenen Board-Dateien verlieren je eine Zeile.
- **Destruktiv, ohne Rückgängig:** es gibt kein Undo; die Oberfläche sagt es in der Rückfrage, wiederherstellbar nur über `git checkout`/`git show` ([Rückgängig](../Dokumentation/Domaenenwissen/D00008-rueckgaengig.md) gilt hier nicht).
- **Barrierefreiheit:** die Rückfrage ist ein Material-3-Dialog, per Tastatur bedienbar, mit Fokus nach ADR-0010; Zielgrößen nach ADR-0012; bei 320/375/414 px kein Querscrollen (ADR-0015).

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar, Muster `tests/archiv.rs`): laufende Instanz mit **drei** Boards; eine Aufgabe #1 liegt auf **zwei** Boards, hat einen Anhang, einen laufenden Timer und eine Reservierung; das dritte Board kennt sie nicht. Heute ist der 11.11.2026.

### Endgültig löschen

- [ ] **1. Weg und ein Commit (Abnahme, wörtlich):** Gegeben #1 auf zwei von drei Boards, mit einem Anhang, einem laufenden Timer und einer Reservierung, wenn ich `DELETE /api/aufgaben/1` sende, dann antwortet die API `200 {nummer: 1}`, die Aufgabendatei ist nicht mehr da, **beide** Board-Dateien enthalten die Zeile nicht mehr, der Anhangsordner ist weg, das dritte Board ist unverändert, und alles steht in **genau einem** Commit (`git rev-list --count` +1); `git show` zeigt die Löschung; `git log -- aufgaben/0001-…md` findet die Historie weiter; `git status --short` ist sauber.
  - Fällt durch: die Datei liegt noch da; eine Board-Zeile bleibt; der Anhangsordner bleibt; mehr als ein Commit.
  - Prüfebene: Integration, E2E US-1/US-4.
- [ ] **2. Unbekannte Nummer:** Gegeben eine Nummer, die es nicht gibt, wenn ich lösche, dann **404**, nichts geändert, kein Commit.
- [ ] **3. Defekte Aufgabendatei:** Gegeben eine unlesbare Aufgabendatei mit einer Zeile auf einem Board, wenn ich lösche, dann verschwinden Datei und Board-Zeile in einem Commit.
- [ ] **4. Nachricht und Nebenwirkungen:** Gegeben #1 mit zwei Anhängen und auf zwei Boards, wenn ich lösche, dann lautet die Nachricht `#1 gelöscht, 2 Anhänge (2 Boards)`; ein laufender Timer der Nummer existiert danach nicht mehr, eine Reservierung ebenso.

### Spalten-Sperre

- [ ] **5. Agent aus Menschen-Spalte:** Gegeben #1 liegt auf einem der Boards in einer Menschen-Spalte (`column-owner: human`), wenn ein **Agent** #1 löscht, dann **403** `{fehler, spalte, nummer: 1}`, nichts geändert, kein Commit; löscht ein **Mensch**, dann 200 und gelöscht.
  - Fällt durch: der Agent kommt durch; der Mensch wird abgewiesen.
  - Prüfebene: Integration.
- [ ] **6. Defektes Board:** Gegeben eine defekte Board-Datei eines Boards, das #1 kennt, wenn ein **Agent** löscht, dann **423**, nichts geändert (R00120).

### Ein Weg, eine Sperre

- [ ] **7. Zweite Linie (ADR-0008):** Das um Entfernen erweiterte `aktion()` bricht bei doppeltem oder aus dem Ordner führendem Pfad **vor** dem ersten Schreiben/Entfernen ab (`Fehler::Intern`), nichts geschrieben, nichts entfernt (Erweiterung des Tests `aktion_bricht_vor_dem_ersten_schreiben_ab`).
- [ ] **8. Wächter:** Der neue Board-Datei-Schreiber (Löschweg) steht in `SCHREIBER` (`tests/aufruf_vergessen.rs`) und in X00001; ein nicht eingetragener Schreiber macht `board_datei_schreiber_liste_ist_vollstaendig` rot.

### Oberfläche

- [ ] **9. Rückfrage aus dem Kartenmenü:** Gegeben eine Karte auf dem Board, wenn ich im Kartenmenü „Endgültig löschen“ wähle, dann erscheint die Rückfrage „endgültig löschen“ mit dem Hinweis, dass es unumkehrbar ist; bestätige ich, verschwindet die Karte vom Board und die Datei ist weg (ein Commit); breche ich ab, ist nichts geändert.
  - Prüfebene: E2E US-1/US-2.
- [ ] **10. Rückfrage aus dem Aufgabenfenster:** Gegeben das offene Aufgabenfenster einer Karte, wenn ich dort „Endgültig löschen“ wähle und bestätige, dann schließt das Fenster, die Karte ist überall weg; die Rückfrage ist per Tastatur bedienbar, der Fokus geregelt, bei 320/375/414 px ohne Querscrollen.
  - Prüfebene: E2E US-3.
- [ ] **11. Nachbarn unberührt:** Archivieren (R00017), Zurückholen und Von-Board-Nehmen (R00020) verhalten sich unverändert; `cargo test`, `node --test e2e/einheit/` und die betroffenen Playwright-Proben sind grün.

## Betroffene Verzeichnisstruktur

```
src/
├── dienst/
│   ├── mod.rs          # aktion(): Schreiben/Entfernen, alle Pfade vorher geprüft
│   └── archiv.rs       # Kanban::endgueltig_loeschen (dritte Bewegung der Archiv-Familie)
├── modell/board.rs     # Board::abnehmen(nr) (vorhanden) wird genutzt
├── git.rs              # committen nimmt gelöschte Pfade mit (vorhanden)
└── web/
    ├── mod.rs          # Route DELETE /api/aufgaben/{nr}
    └── endpunkte.rs    # Eintrag in /api, /api/endpunkte und openapi
tests/
└── aufgabe_loeschen.rs # neu: Atomarität, 403/423, Nachricht, ein Commit
web/
├── menue.js            # Eintrag „Endgültig löschen“
├── ansicht.js          # Rückfrage (M3-Dialog)
├── app.js              # Aktion endgueltig-loeschen, Senden, Erfolg
└── kd-app.css          # Rückfrage-Gestaltung
e2e/tests/
└── r00141-endgueltig-loeschen.spec.js  # neu
```

Architekt/Doku: `Dokumentation/Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md`, `Dokumentation/Architektur/A00005-format.md`, `A00007-git.md`.

## Technische Überlegungen

Bindende Technik: [ADR-0024](../Dokumentation/ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md) (Akzeptiert 2026-11-11, `7dab08f`; Betreiber-Entscheidung 2026-11-11, Kartenkommentar #36).

### Ablauf

1. **Eingang:** `DELETE /api/aufgaben/{nr}` mit `X-KanbanD-Wer` → Handelnder (`Person`).
2. **Dienst unter der Sperre:** `let _sperre = self.gesperrt();`
   - 2.1 **Prüfung vor jedem Schreiben:** je Board der Boardliste `entnahme_erlaubt` (Agent) bzw. Lesbarkeit (423); die erste Sperre nennt die Spalte (R00097/R00120).
   - 2.2 **Board-Zeilen entfernen:** für jedes Board mit der Karte `Board::abnehmen(nr)` → `board_text(&b, None)`.
   - 2.3 **Ein `aktion()`** mit den Schritten: Aufgabendatei **entfernen**; jede geänderte Board-Datei **schreiben**; jede Datei des Anhangsordners `aufgaben/<nr>-<slug>/` **entfernen** und den leeren Ordner aufräumen.
   - 2.4 **In-Speicher-Zustand:** Startzeitpunkte (`timer_beginn`) der Nummer verwerfen.
3. **Antwort:** 200 `{nummer}`.
4. **Oberfläche:** Kartenmenü/Fenster → Rückfrage → `DELETE`.

### Grobentwurf (Klassen-Entwurf ohne Implementierungen)

Die öffentliche API wächst minimal; die Bausteine gibt es schon (`Board::abnehmen`, `git::committen` mit Löschpfaden, `entnahme_erlaubt`).

- `Schritt` (DTO, immutable) — entweder **Schreiben** (`pfad`, `text`) oder **Entfernen** (`pfad`); ersetzt das `(Pfad, Text)`-Paar von `aktion()`.
- `Kanban::aktion(autor, nachricht, schritte: &[Schritt])` (privat) — prüft **alle** Pfade beider Arten, führt dann alle Schritte aus, committet **einmal** (ADR-0005, ADR-0008).
- `Kanban::endgueltig_loeschen(wer, nr)` — die neue öffentliche Dienstmethode in `src/dienst/archiv.rs`; Rückgabe `u32`.

### Änderungen an bestehenden Klassen

- `src/dienst/mod.rs::aktion` — Signatur auf Schritte umgestellt; **alle** Aufrufstellen mechanisch umgezogen (eigener Commit **vor** dem Feature, ADR-0024 „akzeptierte Schwäche“).
- `src/dienst/archiv.rs` — neue Methode `endgueltig_loeschen`.
- `src/web/mod.rs` / `src/web/endpunkte.rs` — neue Route samt Beschreibung.

### Optionen (Skill `optionen-vor-entscheidung`)

Entschieden im Architektur-Durchgang; vollständiges Tableau und Begründung in [ADR-0024](../Dokumentation/ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md), Abschnitt „Optionen“.

| | A: echte Entfernung über erweitertes `aktion()` (gewählt) | B: eigene Abweichung nach Muster `anhaenge.rs` | C: weiches Löschen (`deleted: true`) | D: Papierkorb-Ordner |
|---|---|---|---|---|
| „endgültig“ | echt | echt | nein (zweites `archived`) | echt (Arbeitsbaum frei) |
| Wege zu Board-Dateien | einer | zwei | einer | einer |
| Wächter | sieht den neuen Schreiber | Nachbau von Hand | — | — |
| Commit | einer (ADR-0005) | einer | einer | Umbenennung statt Löschung |

**Entscheidung: A** (ADR-0024, Akzeptiert; Betreiber-Entscheidung 2026-11-11, Kartenkommentar #36). Verworfenes unter Notizen.

### Gestaltung

Der Bestätigungsdialog „endgültig löschen“ ist ein **neuer Oberflächenzustand**. Nach der Vision-Leitplanke „Keine Gestaltung geht in den Bau, die niemand angesehen hat“ entscheidet die **UX-Vorprüfung** über Wortlaut, Lage und M3-Komponente (Dialog, `role=alertdialog`, Fokus), und der **product-owner gibt den Zustand an Artboard [D0003](../Dokumentation/Wireframes/D0003.dc.html)** (Aufgabenfenster) frei (hell/dunkel, 320/414/1280 px). Der **Auslöser** (Kartenmenü und Aufgabenfenster) ist Teil desselben Zustands. Bis zur Freigabe ist der **Server-Teil** (Endpoint, Dienst, `aktion()`) frei baubar; die Oberflächen-Bubbles warten.

## Tests

Nach Skill `test-pyramide`.

- **Unit:** die reine Pfadprüfung des erweiterten `aktion()` (doppelt, außerhalb) — heute schon im Test `aktion_bricht_vor_dem_ersten_schreiben_ab` (`src/dienst/mod.rs`); kein neuer Unit, wo die Logik an Dateien und Boards hängt.
- **Integration:** neu `tests/aufgabe_loeschen.rs`: AK 1–6 samt Git-Prüfung (`git rev-list --count`, `git show`, `git log -- <pfad>`, `git status`), 403/423, unbekannte Nummer, defekte Aufgabendatei, Nachricht. AK 7 erweitert den bestehenden `aktion`-Test.
- **E2E (Playwright):** neu `e2e/tests/r00141-endgueltig-loeschen.spec.js`: AK 9/10 (Rückfrage aus Kartenmenü und Fenster, Abbruch, Tastatur, Breiten). Muster `e2e/tests/r00112-rueckgaengig.spec.js`.
- **Rot vor dem Bau:** die Akzeptanztests beginnen als `test.fail` mit Verweis auf #36.
- **Gegenproben (Mutanten):** Board-Zeile eines zweiten Boards stehen lassen; Anhang stehen lassen; Löschung ohne Spalten-Sperre; zwei Commits.

## Abhängigkeiten

- **Technik bindend:** [ADR-0024](../Dokumentation/ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md), [ADR-0005](../Dokumentation/ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md) (eine Methode = eine Sperre = ein `aktion()`), [ADR-0008](../Dokumentation/ADRs/0008-board-slug-geprueft-vor-jedem-dateizugriff.md) (Pfadprüfung, zweite Linie), [ADR-0003](../Dokumentation/ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md) (403-Rumpf), [ADR-0021](../Dokumentation/ADRs/0021-karten-verlauf-aus-der-git-geschichte.md) (Git ist das Gedächtnis), Aspekt X00001.
- **Abhängig von (grün):** I0011 Aufgabenfenster (R00011), I0017 Archivieren und zurückholen (R00017), I0086 Spalten mit Eigentümer (R00097), I0110 Härtung Spalten (R00120).
- **Blockiert:** — (Sammel-Löschen, Verlauf gelöschter Karten und Nummern-Wiederverwendung sind offene Fragen, keine Voraussetzung).
- **Gestaltung:** UX-Vorprüfung und Artboard-Freigabe D0003 vor dem Bau der Oberfläche.

## Offene Fragen

1. **Nummer-/Slug-Wiederverwendung:** `naechste_nummer` rechnet aus den vorhandenen Dateinamen; wird die höchste Nummer gelöscht, bekäme die nächste dieselbe. Sollen gelöschte Nummern/Slugs nie wiederverwendet werden? Empfehlung: **nicht** in dieser Anforderung lösen — derselbe Effekt entsteht heute schon beim Entfernen einer Datei von Hand; erst entscheiden, wenn es stört.
2. **Verlauf der gelöschten Karte:** `git::staende` überspringt Lösch-Commits; der Karten-Verlauf (R00123/I0113) endet beim Löschen. Soll er eine gelöschte Karte aus der Historie noch zeigen? Gehört zu I0113/R00123, nicht hier. Empfehlung: der Verlauf endet beim Löschen.
3. **Sammel-Löschen:** `POST /api/aufgaben/loeschen {nummern}` (mehrere in einem Zug) — eigene Planung. Empfehlung: erst nach Bedarf.
4. **Rückwirkende Berichte:** Soll eine gelöschte Karte aus Burndown/Durchsatz ganz verschwinden oder bis zum Löschtag weiterzählen? Empfehlung: verschwinden (der aktuelle Stand liest die Dateien).
5. **Schlüssel (`key`):** nach dem Löschen ist der Fremdschlüssel frei; ein späteres `POST /api/aufgaben` mit demselben `key` legt eine neue Karte an. So gewollt? Empfehlung: ja.
6. **Defekte Aufgabendatei:** Der Löschweg nutzt den Pfad, nicht das Modell — eine defekte Datei lässt sich löschen. Erwünscht („kaputte Datei weg“)? Empfehlung: ja (AK 3).
7. **Endpunktname:** `DELETE /api/aufgaben/{nr}` ist neu und eindeutig neben `DELETE /api/boards/{slug}/aufgaben/{nr}` (von Board nehmen, R00020). Die kürzere Formulierung „DELETE …/aufgaben/{nr}“ in R00097 meint den Board-Weg; keine Änderung nötig, die Benennung im Auge behalten.

## Manuelle Vorbereitungstätigkeiten

- Bildschirmfotos der Rückfrage (aus dem Kartenmenü und aus dem Aufgabenfenster) bei 320, 414 und 1280 px, je hell und dunkel, nach der UX-Vorprüfung auf den Abnahmezettel.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist der Beratungshinweis des product-owners vom 2026-11-03 (Karte #36): kanbanD kennt nur „archivieren“, aber kein echtes Löschen — „übliche Kanban-Funktionen, die fehlen“. Der Schmerzpunkt ist nicht ein fehlender Weg, sondern ein **Sackgassen-Zustand**: Eine Karte, die nie wieder gebraucht wird, bleibt für immer im Aufgabenordner und als Archivzeile in jeder Board-Datei; Nummer und Schlüssel sind auf ewig belegt, und wer die Karte loswerden will, muss von Hand im Dateisystem und in mehreren Board-Dateien aufräumen — genau die Arbeit, für die kanbanD da ist. Wird der Weg über ein um **Entfernen-Schritte erweitertes `aktion()`** geführt (Option A der ADR-0024), dann verschwinden Datei, Board-Zeilen und Anhänge im **selben** Commit, die Entnahme-Sperre (R00097/R00120), die `Board::abnehmen`-Zeile und `git::committen` mit Löschpfaden sind schon da und werden nur benutzt. Die Wirkungskette: der Mensch (oder ein Agent) löscht eine Karte → die Datei und ihre Zeilen gehen in **einem** Commit weg → der Aufgabenordner und die Board-Dateien bleiben klein, die Nummer wird frei, und nichts ist verloren, weil die Git-Historie die Karte behält („Git ist das Gedächtnis“). Der Hebel ist genau diese Stelle — nicht eine neue Datenhaltung (Papierkorb, Marker): gerade weil „die Dateien der einzige Speicher“ und „ein Commit je Aktion“ gelten, ist die Löschung selbst eine gewöhnliche Aktion über das bestehende `aktion()` und braucht keinen zweiten Weg.

## Missing-Docs

- Das Domänenwissen kennt weder „endgültig löschen“ noch „Kartenmenü“. Die drei leicht verwechselbaren Begriffe **archivieren** (R00017), **von Board nehmen** (R00020) und **endgültig löschen** (hier) sollten an einer Stelle abgegrenzt sein. Vorschlag: eigener Eintrag „Aufgabe aus dem Board nehmen oder löschen“.
- Aspekt X00001 (Schreibweg/Abweichungen/Wächter), A00005 (Format) und A00007 (Git) nennen den Löschweg noch nicht — Nachzug als Bubble (F0112).

## Notizen

**Geteilte Dialogkomponente (nur Notiz, kein Umbau):** Die Rückfrage „endgültig löschen" ist eine **gemeinsame `role="alertdialog"`-Komponente**, die auch **R00128** (Board umbenennen, archivieren, löschen) für das Löschen eines Boards benutzt. Das Primitiv erhält Aufrufer-Titel, -rumpf und -bestätigungswort; R00141 setzt den Aufgaben-Wortlaut (unumkehrbar, wiederherstellbar nur über die Git-Historie), R00128 den Board-Wortlaut (Board-Datei entfernt, Aufgaben bleiben). Beide benutzen die Bezeichnung **„endgültig löschen"** (UX-Vorprüfung #35, Entscheidung 2026-11-11: Wortlaut vereinheitlicht). Kein eigener Umbau in R00141 nötig.

**Verworfene Alternativen (Optionen-Tableau der ADR-0024):**

- **B — eigene Abweichung nach Muster `anhaenge.rs`:** zwei Wege zum Schreiben von Board-Dateien; der Wächter (an `aktion()` gebunden) müsste von Hand nachgebaut werden.
- **C — weiches Löschen (`deleted: true`):** nicht „endgültig“, ein zweites `archived`; Nummer und Anhangsordner bleiben belegt.
- **D — Papierkorb-Ordner:** ein zweiter Zustandsort neben `aufgaben/` und `boards/`, den die Leitplanke „Die Dateien sind der einzige Speicher“ ausschließt; Git sieht eine Umbenennung, keine Löschung.

**Bewusst außerhalb:** Sammel-Löschen und Nummern-Wiederverwendung (offene Fragen 1, 3); ein Undo (ADR-0024: nur über Git); die Anzeige gelöschter Karten im Verlauf (gehört zu I0113/R00123).
