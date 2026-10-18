---
id: R00054
status: In Arbeit
datum: 2026-10-18
---

# R00054: WBS-Sicht

## Beschreibung

kanbanD bekommt neben dem Kanban eine eigene Ansichtsart: die WBS einer registrierten Anwendung als eingerückte Tabelle, nach dem Vorbild der Tabelle von `/planung karte` (Skill `work-breakdown-structure`, „Artefakt: Dashboard“, Punkte 1 und 6). Der Kopf zeigt den **Stand** der Anwendung: wie viel funktional (`gruen`), in Bearbeitung (`gelb`) und offen (`rot`) ist. Die Sicht liest die WBS-Datei im Arbeits-Repository und aktualisiert sich live, auch wenn die Datei an kanbanD vorbei geändert wird. Diese Anforderung ist rein lesend.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die WBS als Stand, die Aufgaben als Fortschritt“, „Live überall“.

## Geschäftlicher Nutzen

Der Stand der Anwendung ist jederzeit sichtbar, ohne dass die KI ein HTML-Dashboard erzeugen, auf freiem Port prüfen und öffnen muss.

## Funktionale Anforderungen

- Route `#/wbs/<kürzel>`, Menüpunkt „WBS“ je gebundener Anwendung des aktuellen Boards, Kürzel `g k`.
- Tabelle aller Knoten in Dateireihenfolge, Spalten `ID · Ebene · Knoten · Fertig-Kriterium / Eingabe → Ausgabe · Aufwand · Status · Requirement · Notiz`; der Name ist nach Tiefe eingerückt; Dialog und Interaction sind klappbar; die Zeile trägt die Ampelfarbe, der Status steht zusätzlich als Text-Plakette.
- Ausbaustufe als Namenspräfix (`2 · Blockziffern`), `Braucht` im Tooltip.
- **Kopf:** Stand über die Slice-Liste nach Skill („Slice-Fortschritt“: % `gruen`, % `gelb`, % `rot` über alle zählenden Slices; `option`, `ausbau`, `verworfen`, `bestehend` zählen nicht), aktiver Knoten mit Pfad, laufende Bubbles; „nicht committet“, solange die WBS-Datei im Arbeits-Repository Änderungen hat (`git status`).
- Status oberer Knoten und erreichte Ebene werden in der Sicht nach den Regeln des Skills gerechnet. Ein Widerspruch zur Datei wird je Zeile als Hinweis gezeigt.
- Ein Klick auf eine Requirement-ID öffnet die Anforderung aus dem Register (R00053).
- Live: Der Dateiwächter beobachtet die WBS-Datei jeder registrierten Anwendung außerhalb des kanbanD-Ordners.
- `GET /api/wbs/<kürzel>` liefert `{knoten: [{id, ebene, eltern, name, status, gerechnet, fertig_kriterium, eingabe_ausgabe, aufwand, ausbaustufe, braucht, requirement, notiz, zeile}], stand: {gruen, gelb, rot, slices}, nicht_committet}`; unbekanntes Kürzel → 404, nicht erreichbar → 409.
- Die Spalten der WBS-Tabelle werden über die Kopfzeile zugeordnet; unbekannte Spalten bleiben erhalten und werden ignoriert.

## Akzeptanzkriterien

### Stand
- [ ] WBS mit 4 zählenden Slices (2 `gruen`, 1 `gelb`, 1 `rot`) und einem `option`-Feature → Kopf „50 % funktional · 25 % in Bearbeitung · 25 % offen“
- [ ] Interaction mit Features F1 `gruen`, F2 `rot` → gerechnet `gelb`; steht in der Datei `gruen`, zeigt die Zeile den Widerspruch

### Tabelle
- [ ] Baum A → D → I → B wird mit drei Einrückungsstufen gezeigt; Klappen von D blendet I und B aus
- [ ] Eine zusätzliche Spalte `Phase` in der WBS-Datei stört nicht und bleibt beim Lesen erhalten

### Live und Git
- [ ] Sicht offen, die WBS-Datei im Arbeits-Repository wird mit einem Editor geändert (B0001 `rot` → `gruen`) → die Zeile wird ohne Neuladen grün
- [ ] Ungestagte Änderung in der WBS-Datei → Kopf zeigt „nicht committet“; nach Commit im Arbeits-Repository verschwindet der Hinweis

## Betroffene Verzeichnisstruktur

`src/herkunft.rs` (WBS-Lesen auf alle Spalten erweitern, pure), `src/wbs.rs` (neu, pure: Status- und Ebenen-Rechnung, Stand), `src/dienst/wbs.rs` (neu), `src/waechter.rs` (fremde Pfade), `src/git.rs` (`geaendert`), `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/wbs.js` (neu), `web/ansicht.js`, `web/app.js`, `web/tastatur.js`, `web/kd-app.css`; Tests in den Modulen, `tests/wbs.rs`, `e2e/einheit/wbs.test.js`, `e2e/tests/r00054-wbs-sicht.spec.js`.

## Technische Überlegungen

### Ablauf
1. **Lesen:** `wbs_tabelle(text) -> WbsTabelle` ordnet die Spalten über die Kopfzeile zu.
2. **Rechnen:** `stand(&WbsTabelle) -> Stand` und `gerechneter_status`, `erreichte_ebene` nach Skill; dieselben Rechenbeispiele wie `references/erreichte-ebene-beispiel.md` als Unit-Tests.
3. **Ausliefern:** `/api/wbs/<kürzel>`, Ereignis `wbs` über den bestehenden Ereignisstrom bei Änderung.

### Grobentwurf
- `WbsTabelle` (benannte Collection von `WbsKnoten`) — `fn kinder(&self, id) -> …`, `fn slices(&self) -> …`
- `Stand` (DTO) — Anteile, Zahl der Slices, aktiver Knoten mit Pfad
- `fn stand(t: &WbsTabelle) -> Stand` (pure)

## Tests
- Unit: Spaltenzuordnung, Status-Rechnung, erreichte Ebene, Slice-Stand mit nicht zählenden Status
- Integration: Arbeits-Repository als Temp-Repository, `nicht_committet`, Wächter auf fremdem Pfad
- E2E: Sicht öffnen, Klappen, live grün werden

## Abhängigkeiten
- Abhängig von: R00053
- Blockiert: R00055, R00056

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Heute sieht man den Stand einer Anwendung nur über ein Generat, das die KI bei jeder Änderung neu erzeugen, prüfen und öffnen muss. Wenn kanbanD die WBS-Datei selbst liest und live zeigt, entfällt dieser Schritt vollständig, und der Mensch sieht jede Statusänderung der KI im Moment, in dem sie entsteht. Weil die Rechnung den Regeln des Skills folgt, zeigt die Sicht dieselben Zahlen wie `/planung status`. Die rein lesende Sicht ist der kleinste Schritt mit dem eigentlichen Nutzen und das Fundament, auf dem Schreiben (R00055, R00056) aufsetzt.

## Notizen

- Out of scope, spätere Anforderungen: Slice-Liste mit frei/blockiert, Gliederung nach Wellen, Kanban über Wellen, Netzplan, Graph des aktiven Asts.
