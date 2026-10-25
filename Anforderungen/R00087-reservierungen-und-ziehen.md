---
id: R00087
status: In Arbeit
datum: 2026-10-25
---

# R00087: Reservierungen und Ziehen

## Beschreibung

Mehrere KI-Agenten — auf einem oder auf mehreren Rechnern, auch mehrere Instanzen derselben Rolle — sollen gegen ein zentrales Board arbeiten, ohne sich dieselbe Karte zu nehmen. Dafür bekommt kanbanD **Reservierungen**: eine Instanz (selbst gewählte GUID) reserviert eine Karte für 24 h, andere Instanzen lassen sie beim Reservieren und Ziehen aus. Der neue Endpunkt **`ziehen`** nimmt atomar die oberste freie Karte einer Spalte, reserviert sie, ordnet sie zu, zieht sie in die Zielspalte und gibt sie zurück. Menschen sehen Reservierungen auf Karte, im Aufgaben-Detail und in einer Liste aller Reservierungen des Boards und können sie dort freigeben.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

N Agenten lassen sich über ein Board synchronisieren — Parallelität über den einzelnen Entwickler-PC hinaus, ohne Doppelarbeit und ohne Absprache zwischen den Agenten.

## Funktionale Anforderungen

### Instanz
- Jeder Aufruf kann im Header `X-KanbanD-Instanz` (oder Feld `instanz`) eine Kennung nennen, 1–64 Zeichen `[A-Za-z0-9._-]`; Reservieren und Ziehen verlangen sie (`400` ohne).

### Reservierung
- Gespeichert in der Aufgabendatei als Frontmatter `reservation: {who: <kürzel>, instance: <kennung>, since: <zeitpunkt mit Versatz>}` und committet; übersteht einen Neustart.
- Gültig 24 h ab `since`; danach gilt sie als nicht vorhanden (kein Aufräumlauf nötig; der nächste Schreibzugriff darf sie entfernen).
- `POST /api/aufgaben/{nr}/reservierung` (braucht Wer und Instanz): frei oder abgelaufen → reserviert; eigene Instanz → verlängert (`since` = jetzt); fremde gültige → `409` mit Inhaber.
- `DELETE /api/aufgaben/{nr}/reservierung`: eigene Instanz → frei; Person mit `art: human` → frei, egal wessen; fremde Instanz eines Agenten → `409`; keine Reservierung → `404`.
- Eine fremde Reservierung sperrt **nur** Reservieren und Ziehen; Kommentare, Zeiten, Felder, Züge bleiben für alle erlaubt.
- Archivieren entfernt die Reservierung.

### Ziehen
- `POST /api/boards/{slug}/ziehen {von, nach?}` (braucht Wer und Instanz), unter einer Sperre in einem Commit:
  1. nimmt in `von` die **oberste** Karte ohne gültige fremde Reservierung (eigene Reservierung zählt als frei), archivierte ausgenommen;
  2. reserviert sie für Wer/Instanz, nimmt Wer in die Zuständigen auf, falls noch nicht drin;
  3. zieht sie nach `nach` — ohne `nach` in die Folgespalte rechts von `von`; ohne Folgespalte `400`; der Zug landet oben (R00086) und löst die Prüfungen wie `bewegen` aus;
  4. Antwort `200` mit `{aufgabe, von, nach, warnungen}`; keine freie Karte → `404` `{fehler: "nichts zu ziehen"}`.
- Zwei gleichzeitige `ziehen` auf dieselbe Spalte mit zwei Karten liefern zwei **verschiedene** Karten.

### Oberfläche
- Karte: Schloss-Symbol mit Kürzel der Person; Tooltip „reserviert von <Name> · Instanz <kennung> · noch <h:mm>“; abgelaufene Reservierungen zeigt sie nicht.
- Aufgaben-Detail: Zeile „Reservierung“ mit Person, Instanz, seit, Restzeit und Knopf „freigeben“.
- Board-Menü: Eintrag „Alle Aufgabenreservierungen anzeigen“ öffnet eine Liste aller gültigen Reservierungen des Boards (Karte, Titel, Spalte, Person, Instanz, seit, noch) mit „freigeben“ je Zeile und „alle freigeben“; Klick auf die Karte öffnet sie.
- Freigeben in der Oberfläche handelt als die gewählte Person (Mensch).

### API-Beschreibung
- `/api` und `/api/endpunkte` beschreiben Instanz, Reservierung und `ziehen`.

## Akzeptanzkriterien

### Reservieren
- [ ] Instanz A reserviert #7 → `reservation` steht in der Datei; Instanz B reserviert #7 → `409` mit Inhaber A
- [ ] A reserviert #7 erneut → `since` wird jetzt; nach 24 h ohne Verlängerung kann B reservieren
- [ ] B (Agent) gibt #7 frei → `409`; Mensch gibt frei → frei; A gibt frei → frei
- [ ] Mit fremder Reservierung darf B kommentieren, Zeit buchen und #7 bewegen

### Ziehen
- [ ] Spalte „Bereit“ = [7, 8, 9], #7 reserviert von B: A zieht ohne `nach` → bekommt #8, #8 steht oben in der Folgespalte, reserviert von A, A zuständig, ein Commit
- [ ] „Bereit“ leer oder nur fremd reserviert → `404` „nichts zu ziehen“
- [ ] `von` ist die letzte Spalte, ohne `nach` → `400`
- [ ] 10 parallele `ziehen` auf eine Spalte mit 10 Karten → 10 verschiedene Karten, keine doppelt (Integrationstest)
- [ ] Ohne Instanz → `400`

### Oberfläche
- [ ] Reservierte Karte zeigt das Schloss; nach Freigabe im Detail verschwindet es live
- [ ] Die Liste „Alle Aufgabenreservierungen anzeigen“ zeigt genau die gültigen Reservierungen des Boards; „alle freigeben“ leert sie

## Betroffene Verzeichnisstruktur

Modell `src/modell/aufgabe.rs` (Feld `reservierung`), Format `src/format/aufgabe.rs` (`reservation`), Dienst neu `src/dienst/reservierung.rs` (Reservieren, Freigeben, Ziehen), Web `src/web/mod.rs`, `src/web/endpunkte.rs`; Oberfläche `web/ansicht.js` (Karte, Detail, Liste), `web/app.js` (Aktionen), `web/menue.js` (Menüeintrag), `web/kd-app.css`; Tests `tests/reservierung.rs`, `e2e/einheit/`, `e2e/tests/r00087-reservierungen.spec.js`.

## Technische Überlegungen

### Ablauf (`ziehen`)
1. Sperre `self.gesperrt()` (wie `bewegen`), Board lesen.
2. Kandidaten = Nummern in `von` in Board-Reihenfolge; erste, deren Aufgabe nicht archiviert ist und keine gültige fremde Reservierung trägt.
3. Aufgabe ändern (Reservierung, Zuständige) und Board ändern (`Board::bewegen` mit Index 0) → **ein** `aktion`-Commit mit beiden Dateien.
4. Warnungen wie `Kanban::warnungen`.

### Grobentwurf
- `Reservierung` (DTO, immutable) — `wer`, `instanz`, `seit`
  - `fn gueltig(&self, jetzt) -> bool` · `fn gehoert(&self, instanz) -> bool`
- `Kanban::reservieren(wer, instanz, nr) -> Aufgabe`
- `Kanban::freigeben(wer, instanz: Option, nr) -> Aufgabe`
- `Kanban::ziehen(wer, instanz, slug, von, nach: Option) -> Gezogen`
- `Gezogen` (DTO) — `aufgabe`, `von`, `nach`, `warnungen`

## Tests
**Unit:** `Reservierung::gueltig` (23:59 h gültig, 24:01 h nicht), Kandidatenwahl (pure Funktion über Board-Reihenfolge und Reservierungen), Folgespalte.
**Integration:** alle Kriterien „Reservieren“ und „Ziehen“ über die HTTP-API, Parallelität mit 10 Tasks.
**E2E:** Schloss auf der Karte, Freigeben im Detail, Liste mit „alle freigeben“.

## Abhängigkeiten
- Abhängig von: R00084 (Zeitpunkt mit Versatz), R00086 (Zug landet oben), R00024
- Blockiert: R00093

## Offene Fragen
- keine — Reservierung, Instanz, 24 h, Sperrumfang und `ziehen` entschieden am 2026-10-25 (Feedback-Runde Punkt 2)

## Manuelle Nachbereitungstätigkeiten
- Agenten-Rollen (z. B. JoinPuya) auf `ziehen` mit eigener Instanz umstellen.

## Notizen
### Verworfene Alternativen
- Karten anderer Personen überspringen: mehrere Instanzen derselben Rolle sind eine Person.
- Schreibsperre für fremde Instanzen: mehr Sperre als nötig; Kommentare und Zeiten anderer bleiben sinnvoll.
- Mehrere Instanzen über git abgleichen: Merge-Konflikte in der Board-Datei.

## Warum löst diese Anforderung das Problem? (Pflicht)

Lesen und Ziehen in zwei Aufrufen → zwei Agenten sehen dieselbe oberste Karte → Doppelarbeit. Ein atomares `ziehen` unter Sperre mit Reservierung je Instanz → jede Karte geht an genau eine Instanz → beliebig viele Agenten auf beliebig vielen Rechnern arbeiten ein Board ab; die Sichtbarkeit in der Oberfläche und die 24-h-Grenze lösen hängengebliebene Reservierungen.
