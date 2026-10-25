---
id: R00092
status: In Arbeit
datum: 2026-10-25
---

# R00092: API aufräumen — Antwortform, archivierte Karten, Filter

## Beschreibung

Drei Reibungen eines Agenten mit der API: `GET /api/aufgaben/{nr}` verpackt die Karte als `{aufgabe, pfad, text}`, während alle schreibenden Aufrufe sie direkt liefern; die Board-Antworten führen archivierte Karten in den Spalten (die Board-Datei behält sie absichtlich für „zurückholen“, R00017); `GET /api/aufgaben` liefert immer alles. Künftig gilt eine Regel **„ein Objekt direkt, eine Liste verpackt“**, Board-Antworten lassen archivierte Karten weg, und `GET /api/aufgaben` filtert über Abfrageparameter.

Zahlt ein auf: [Vision](R00000-vision.md) — KI-Agenten über die API als gleichwertige Nutzer.

## Geschäftlicher Nutzen

Agenten-Skripte werden kürzer und robuster: eine Antwortform, dieselbe Sicht wie die Oberfläche, nur die Karten, die gebraucht werden.

## Funktionale Anforderungen

### Antwortform
- `GET /api/aufgaben/{nr}` liefert die Karte direkt; `pfad` und `text` stehen als zusätzliche Felder in ihr. Defekte Datei: weiter `423` mit `{fehler, pfad, text}`.
- Regel in der API-Beschreibung: ein Objekt direkt; eine Liste verpackt unter ihrem Sammlungsnamen (`{aufgaben: …}`, `{personen: …}`), weil Listen Zusatzangaben tragen; Statusantworten `{geaendert}` u. ä. bleiben.
- Oberfläche und `~/.claude/commands/testen/kanband.py` (falls betroffen) werden mit umgestellt.

### Archivierte Karten
- `GET /api/boards` und `GET /api/boards/{slug}` lassen archivierte Karten aus `spalten[].aufgaben` weg; mit `?archivierte=ja` sind sie dabei.
- Die Board-Datei bleibt unverändert (Platz für „zurückholen“).
- `bewegen`, `ziehen` und Prüfungen arbeiten weiter auf der Board-Datei.

### Filter an `GET /api/aufgaben`
- Parameter: `board` (Karten auf diesem Board), `spalte` (braucht `board`, sonst `400`), `klasse`, `signal` (inkl. `due`), `zustaendig` (Kürzel), `reserviert=ja|nein|<instanz>` (R00087), `archivierte=ja|nein|nur`.
- Verschiedene Parameter verknüpft UND, derselbe Parameter mehrfach ODER (`?klasse=a&klasse=b`).
- Ohne Parameter: Verhalten wie heute (alle, auch archivierte), damit bestehende Aufrufer nicht brechen; sobald ein Filterparameter genannt ist, gilt `archivierte=nein` als Standard.
- `defekte` bleibt in der Antwort.

## Akzeptanzkriterien

- [ ] `GET /api/aufgaben/7` → Objekt mit `nummer: 7`, `titel`, `pfad`, `text` auf oberster Ebene
- [ ] Oberfläche öffnet Aufgaben und defekte Dateien wie bisher (E2E)
- [ ] Backlog-Datei [89, 90, 91], #89 und #91 archiviert → `GET /api/boards/x` zeigt [90]; `?archivierte=ja` zeigt [89, 90, 91]
- [ ] Zurückholen von #89 → steht wieder an Position 0
- [ ] `GET /api/aufgaben?board=x&spalte=Backlog&klasse=vorrang` → genau die nicht archivierten Vorrang-Karten in Backlog
- [ ] `?klasse=a&klasse=b` → Karten mit Klasse a oder b
- [ ] `?spalte=Backlog` ohne `board` → `400`
- [ ] Ohne Parameter → alle Aufgaben wie bisher

## Betroffene Verzeichnisstruktur

`src/web/mod.rs` (Handler `aufgabe_lesen`, `board`, `boards`, `aufgaben`), Filterlogik als pure Funktion in neuem Modul `src/dienst/aufgabenfilter.rs`, `src/web/endpunkte.rs`, `web/app.js`; Tests `tests/`, Unit im Filtermodul.

## Technische Überlegungen

- `Aufgabenfilter` (DTO aus Query, axum `Query` mit wiederholten Parametern über `serde_html_form` oder manuelles Parsen von `RawQuery`) — `fn passt(&self, a: &Aufgabe, board: Option<&Board>, jetzt) -> bool`.
- Board-Antwort: Kopie des Boards, in der die archivierten Nummern gefiltert sind.

## Tests
**Unit:** `Aufgabenfilter::passt` (UND/ODER, archivierte Standardwerte). **Integration:** alle API-Kriterien. **E2E:** Aufgabe öffnen, defekte Datei.

## Abhängigkeiten
- Abhängig von: R00017, R00024, R00087 (für `reserviert`)
- Blockiert: R00093

## Offene Fragen
- keine — Regel, Weglassen und Parameter entschieden am 2026-10-25 (Feedback-Runde Punkte 12–14)

## Notizen
### Verworfene Alternativen
- Überall Hülle `{daten}`: bricht jeden Aufrufer.
- Archivierte ganz vom Board nehmen: Platz für „zurückholen“ ginge verloren.
- Filtersprache der Oberfläche serverseitig: zweite Implementierung derselben Sprache.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ausreißer in der Form, Rohdaten mit archivierten Karten, kein Filter → jedes Skript braucht Sonderfälle → Skripte scheitern oder filtern falsch. Eine Regel, dieselbe Sicht wie die Oberfläche, Filter im Server → ein Agent bekommt genau, was er erwartet.
