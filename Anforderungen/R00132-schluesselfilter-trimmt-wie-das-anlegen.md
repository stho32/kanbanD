---
id: R00132
status: Neu
datum: 2026-11-11
---

# R00132: Schlüsselfilter trimmt beim Lesen wie beim Anlegen

## Beschreibung

Der Filter `GET /api/aufgaben?key=<text>` vergleicht heute den rohen Abfragewert mit dem gespeicherten Schlüssel. Ein Schlüssel wird beim Anlegen aber vorne und hinten getrimmt (`Fremdschluessel::pruefen`, R00098), deshalb findet eine Suche mit umgebendem Leerraum ihre Karte nicht: `POST /api/aufgaben {key: "  k1  "}` speichert `k1`, `GET /api/aufgaben?key=%20k1%20` liefert `[]`. Diese Anforderung lässt den Filter denselben Trim anwenden wie das Anlegen; sonst bleibt der Filter aus R00098 unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

Die Sensoren der Wartungsfabrik bilden einen Schlüssel aus Repository, Bedingung und Fundstelle und legen damit idempotent an (R00098). Beim Lesen — jede Vorabprüfung, `erledigen` (R00099) — bauen sie denselben Schlüssel oft aus mehreren Textteilen zusammen. Ein führendes oder abschließendes Leerzeichen, etwa aus einer mehrzeiligen Konfiguration, einem doppelten Trennzeichen oder einer ungenauen Eingabe, darf dann nicht dazu führen, dass der Sensor seine eigene Karte nicht findet und sie für neu hält. Lesen und Schreiben müssen denselben Wert als gleich ansehen.

## Funktionale Anforderungen

- `GET /api/aufgaben?key=<text>` trimmt `<text>` vorne und hinten, bevor verglichen wird; `Fremdschluessel::pruefen` (R00098) trimmt beim Schreiben genauso.
- Nach dem Trimmen gelten die Regeln aus R00098 unverändert: Vergleich genau mit Groß/Klein, mehrere `key` mit ODER, die Archivregel aus R00092 (Archivierte nur mit `archivierte=ja|nur`).
- Ergibt das Trimmen einen leeren Wert, trifft der Filter nichts — wie heute `?key=` ohne Wert — und antwortet nicht mit 400.
- Kein anderer Filter ändert sein Verhalten: `label` (R00095), `zustaendig`, `klasse`, `signal` usw. bleiben unverändert.

## Nicht-funktionale Anforderungen

- Keine Änderung am Dateiformat und an der Suchart (lineare Suche über die Aufgaben, wie die heutigen Filter).
- Keine Änderung an der Anlege- und Wiederöffnungslogik (R00098); nur der Lesepfad wird angeglichen.

## Akzeptanzkriterien

Alle Beispiele spielen im Ordner mit dem Board „fabrik“. Gegeben eine offene Karte #7 mit `key: k1`.

### Trimmen wie beim Anlegen
- [ ] Gegeben #7 trägt `key: k1`, wenn `GET /api/aufgaben?key=%20k1%20` ankommt, dann ist die Antwort `[#7]` (Abnahme-Probe der Karte #47).
- [ ] Gegeben #7 trägt `key: k1`, wenn `GET /api/aufgaben?key=%09k1%0A` ankommt (Tabulator davor, Umbruch dahinter), dann ist die Antwort `[#7]`.
- [ ] Gegeben #7 trägt `key: k1`, wenn `GET /api/aufgaben?key=k1` ankommt, dann ist die Antwort `[#7]` (unverändert).

### Grenzen
- [ ] Gegeben `?key=%20%20` (nur Leerraum), wenn die Abfrage ankommt, dann ist die Antwort `[]`, ohne 400.
- [ ] Gegeben #7 trägt `k1`, wenn `?key=%20K1%20` ankommt, dann ist die Antwort `[]` (nach dem Trimmen zählt Groß/Klein weiter, R00098).
- [ ] Gegeben #7 trägt `k1` und #9 trägt `k9`, wenn `?key=%20k1%20&key=k9` ankommt, dann ist die Antwort `[#7, #9]` (mehrere `key` mit ODER wie heute).
- [ ] Gegeben #7 trägt `k1` und ist archiviert, wenn `?key=%20k1%20` ankommt, dann ist die Antwort `[]`; mit `&archivierte=ja` wieder `[#7]`.

### Bestand bleibt
- [ ] Gegeben #7 trägt `key: k1`, wenn `?key=` (leer) ankommt, dann ist die Antwort `[]` ohne 400 (unverändert, R00098).
- [ ] `?key=k` trifft `k1` nicht (kein Teilstück, unverändert).

## Betroffene Verzeichnisstruktur

Filter in `src/dienst/aufgabenfilter.rs` (`aus_paaren`, Fall `key`). Unit-Tests stehen im selben Modul, Integrationstests unter `tests/` (Muster `tests/label_filter.rs`).

## Technische Überlegungen

### Ablauf
1. Paar `key=<text>` lesen und `<text>.trim()` anwenden (genau wie `Fremdschluessel::pruefen` beim Schreiben).
2. Der getrimmte Wert geht unverändert in die heutige Prüfung `a.schluessel.text() == k`; ist er leer, trifft er nichts.

### Grobentwurf
- `Aufgabenfilter::aus_paaren`, Zweig `"key" => f.schluessel.push(v.trim().to_string())`.

### Änderungen an bestehenden Klassen
- nur `Aufgabenfilter::aus_paaren` in `src/dienst/aufgabenfilter.rs`.

## Tests

**Unit:** `aufgabenfilter.rs` — `("key", "  k1  ")` trifft die Aufgabe mit `k1`; `("key", "   ")` trifft nichts; `("key", " K1 ")` trifft `k1` nicht; zwei `key`-Paare mit ODER; leeres `key` trifft nichts ohne Fehler.
**Integration:** `GET /api/aufgaben?key=%20k1%20` gegen einen echten Ordner mit `#7 key: k1`.
**E2E:** keine, die Oberfläche ist nicht betroffen.

## Abhängigkeiten
- Abhängig von: R00098 (Fremdschlüssel und Filter `key`), R00092 (Filter und Archivregel)
- Abgrenzung: R00098 und R00095 bleiben unverändert.

## Offene Fragen
- keine

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist Entwicklertest #4: Ein Sensor legt mit `key: "  k1  "` an, kanbanD speichert `k1`, doch derselbe Sensor findet seine Karte mit `?key=%20k1%20` nicht mehr. Ursache ist ein Bruch in der Zusage „ein Schlüssel wird getrimmt“: das Schreiben trimmt (`Fremdschluessel::pruefen`), das Lesen nicht. Meldet der Sensor denselben Befund erneut, hält er seine Karte für neu — genau die Dublette, die R00098 verhindern sollte. Der Hebel sitzt im Filter, weil dort der einzige Pfad liegt, der den rohen Abfragewert mit dem getrimmten Bestand vergleicht; ein Trim beim Lesen stellt die Gleichheit von Lesen und Schreiben mit einer Zeile wieder her, während die Suche selbst unverändert genau und groß-/kleinschreibungssensibel bleibt.

## Missing-Docs
- keine

## Notizen

**Optionen-Tableau**
- *Filter beim Lesen trimmen (gewählt):* eine Zeile in `Aufgabenfilter::aus_paaren`, deckt den gebrochenen Bezug Lesen↔Schreiben; die Suche bleibt exakt und groß-/kleinschreibungssensibel.
- *Suche im Modell tolerant machen (`Schluesseltreffer::suchen` vergleicht getrimmt):* verschiebt die Regel an eine zweite Stelle und macht auch den Dublettenvergleich beim Anlegen weicher, obwohl dort schon getrimmt gespeichert wird — mehr Fläche, kein Zugewinn (R00098 ist abgenommen).
- *Nur dokumentieren, dass der Sensor den Schlüssel ohne Leerraum senden muss:* lässt den Fehler im aufrufenden System, jedes sendende Programm müsste es wissen; verworfen (der Betreiber will die Konsistenz im Bestand, Karte #47).

**Herkunft:** Befundkarte #47 „Filter nach Schlüssel trimmt nicht wie das Anlegen“ (Entwicklertest #4). Architektur bestanden (arch): keine Technikfrage, Bugfix/Konsistenz `key`-Trim Lesen = Schreiben (R00098/F0027), kein ADR.

**Eigene Anforderung statt Fortschreiben von R00098:** R00098 ist abgenommen (WBS I0089 grün); diese kleine Konsistenz bekommt eine eigene Nummer, R00098 bleibt unverändert. WBS als **eigene Interaction I0122 unter D0007** (nicht als Bubble an F0027/I0089 — ein neuer roter Nachfahre öffnet die Abnahme von I0089 wieder; `AI-Team/gelerntes.md` 2026-11-11, Vorbilder I0107 und I0117). Bubble B0614 ist der Bau.
