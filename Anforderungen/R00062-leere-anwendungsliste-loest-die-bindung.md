---
id: R00062
status: Neu
datum: 2026-10-18
ursprung: Bug-Report
---

# R00062: Leere Anwendungsliste löst die Bindung

## Beschreibung

Ein Board kann sich heute nicht von der WBS lösen: Bei genau einer registrierten Anwendung gilt ein Board als gebunden, auch wenn es `applications: []` ausdrücklich nennt. Beim Anbinden von `kanbanD-test` hat dadurch auch das Board „Abnahme“ Phasen-Spalten bekommen (Commit `2107655` dort). Die Bindung ist laut Entscheidung 0:N; „0“ muss ausdrückbar sein.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Board bindet keine bis mehrere Anwendungen“.

## Ursache

R00053 schrieb „Fehlt der Schlüssel oder ist er leer, ist das Board ein reines Kanban. Bei genau einer registrierten Anwendung gilt sie als gebunden.“ — zwei Sätze, die sich für die leere Liste widersprechen. R00054 (`gebundeneAnwendungen` in `web/wbs.js`) und R00058 (`Phasenfolge der gebundenen Anwendung`) haben die zweite Lesart gewählt; der Server liest `applications` beim Schreiben nicht zurück, wenn die Liste leer ist.

## Lösung

- **Fehlt** `applications` im Board-Frontmatter: Standard — bei genau einer registrierten Anwendung gebunden (unverändert).
- **Steht** `applications: []`: reines Kanban, keine WBS-Sicht im Menü, keine Phasen-Spalten, keine Prüfungen gegen die WBS, Prognose je Spalte.
- Das Board-Format schreibt `applications: []` stabil zurück (Rundlauf), statt die leere Liste wegzulassen.
- `PUT /api/boards/{slug}/anwendungen` mit `[kürzel…]` setzt die Bindung (leere Liste = lösen); ein Commit „Anwendungen von „<Board>“: …“. Unbekanntes Kürzel → 400. Der Spalten-Dialog (R00009) zeigt die Bindung mit Schaltern je registrierter Anwendung und „keine“.
- Bereits nachgetragene Phasen-Spalten bleiben beim Lösen stehen (keine stille Änderung); `column-phases` bleibt in der Datei, wirkt aber nicht.

## Akzeptanzkriterien

- [ ] Register mit genau `kd`; Board ohne `applications` → gebunden, Phasen-Spalten werden nachgetragen; Board mit `applications: []` → `GET /api/boards/{slug}` liefert `phasen: null`, kein Commit beim Lesen
- [ ] Rundlauf: `applications: []` bleibt nach Bewegen, Spalten setzen und Termine setzen in der Datei
- [ ] `PUT …/anwendungen []` an einem gebundenen Board → ein Commit, danach `phasen: null`, Menü ohne „WBS“ für dieses Board; `["xx"]` → 400
- [ ] Bestehende Tests aus R00053, R00054, R00058 bleiben grün

## Tests
- Unit: Lesen und Schreiben von fehlendem und leerem `applications`; Bindungsregel in `web/wbs.js`
- Integration: Lesen ohne Nachtragen bei leerer Liste, Endpunkt mit Commit
- E2E: Bindung im Spalten-Dialog lösen

## Abhängigkeiten
- Abhängig von: R00053, R00054, R00058

## Offene Fragen
- keine

## Manuelle Nachbereitungstätigkeiten
- In `/home/shoff/kanbanD-test` das Board „Abnahme“ mit `applications: []` lösen und die leeren Spalten „Entwicklung“ und „Entwicklertest“ entfernen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ohne ausdrückbare „0“ zwingt ein einziger Registereintrag jedes Board unter die Phasen der Anwendung, und kanbanD ändert Boards, die mit der Anwendung nichts zu tun haben. Wenn eine ausdrücklich leere Liste die Bindung löst und das Fehlen des Schlüssels der bequeme Standard bleibt, behalten Boards mit einer Anwendung ihren Komfort und alle anderen ihre Struktur. Der Endpunkt macht das Lösen zu einer sichtbaren Aktion mit Commit, statt einer Handänderung an der Datei.
