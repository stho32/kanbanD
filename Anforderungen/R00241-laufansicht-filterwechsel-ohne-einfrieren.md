---
id: R00241
status: Erledigt
datum: 2026-11-22
---

# R00241: Laufansicht — Filterwechsel auf großen Läufen ohne Einfrieren

## Beschreibung

Karte #265. Auf einem Lauf mit 1.000 Zeilen kostet ein Filterwechsel (R00239 FA 5) 0,36 bis 0,45 s, auf einem Lauf an der Grenze des Transkripts (T3, 10.003 Zeilen) Minuten. Ursache ist nicht der Filter, sondern die Zeilen der Insel: jede ist ein `li` mit `display: list-item`, und der Browser nummeriert die folgenden Listenelemente bei jeder verborgenen Zeile neu. Die Anforderung stellt die Zeilen auf `display: block` um, ohne dass sich etwas anderes ändert. Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N5 (Variante A), Kriterium `AI-Team/po-entscheidungen.md` Z. 615.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): die Filter aus R00239 helfen nur, wenn sie auch auf einem langen Lauf sofort wirken.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)

## Geschäftlicher Nutzen

Wer in der Abnahme einen langen Lauf auf „nur Fehler“ eingrenzt, wartet heute auf einem Lauf mit 1.000 Zeilen knapp eine halbe Sekunde, auf T3 Minuten, in denen die Seite nicht reagiert. Danach reagiert jeder Wechsel im Rahmen von 200 ms (gut) bzw. 500 ms (Grenze, INP).

## Funktionale Anforderungen

1. **Zeilen der Insel sind `display: block`** (ADR-0041 N5 Punkt 1): In `web/kd-app.css` steht bei der Regel für `.lv-l>li` die Regel `:where(.lv-l)>li{display:block}` mit einem Kommentar zum Grund. Ihre Spezifität ist 0,0,1, damit `.lv-n` und `.lv-d` (`grid`) und alle anderen Klassen der Zeilen ihr eigenes `display` behalten.
2. **Sonst nichts ändert sich**: Filter (Attribute an `#lv-insel`, nur CSS), Selektoren, `laufFilterAnInsel`, Ansage, Zählung, Sperrform, Sprung und Fokus bleiben wie in R00239. `web/lauf.js` und `web/app.js` bleiben unverändert.
3. **Regel für künftige Zeilenarten** (N5 Punkt 2): Eine neue Zeilenart der Insel setzt `display` selbst oder bleibt bei der `:where`-Regel; sie wird nie `list-item`.

## Nicht-funktionale Anforderungen

- **Leistung** (PO Z. 615): Auf einem Lauf mit 1.000 Zeilen der Liste braucht jeder Filterwechsel (Verbergen und Wiederanzeigen, jedes der vier Kästchen) vom Klick bis zum nächsten Bild höchstens 200 ms, auf T3 höchstens 500 ms; Median aus fünf Wechseln, tagsüber bei Last ≤ 2, `nice -n 10`. Das ist eine **Beobachtung im Bericht, kein Gate** (AK 5); das Gate trägt die Stilprobe (AK 1, 2).
- **Zugänglichkeit**: der Baum der Hilfstechnik bleibt gleich (AK 3).

## Akzeptanzkriterien

**Ausgangslage:** wie R00239 „Ausgangslage“ (Board `fabrik` mit `record-transcripts: true`, Mensch `sh`, Chromium headless in `Europe/Berlin`, Läufe über `POST /api/aufgaben/<nr>/transkripte` mit `zlib`-gz-Dateien). Die Laufansicht von T1 aus R00234 mit „Nachrichten“, „Werkzeuge“ und „Systemhinweise“ angehakt.

- [x] **AK 1 (Stilprobe)** Gegeben T1 mit allen drei Arten sichtbar, wenn die Insel gezeichnet ist, dann ist `getComputedStyle(li).display` für kein `#lv-insel>li` `list-item` (Zähler 0), und jedes `#lv-insel>li.lv-n` und `#lv-insel>li.lv-d` hat `grid` (Zähler der Abweichler 0).
- [x] **AK 2 (Mutanten)** Gegeben AK 1 grün, wenn der Mutant „Regel entfernt“ eingesetzt wird, dann ist AK 1 rot (Zähler der `list-item` > 0); wenn der Mutant „`.lv-l>li{display:block}` ohne `:where`“ eingesetzt wird, dann ist AK 1 rot (`.lv-n` ist `block`); beide in einer eigenen Kopie, je vom benannten Test getötet.
- [x] **AK 3 (Rolle)** Gegeben T1 wie in AK 1, wenn der `ariaSnapshot` der Insel genommen wird, dann ist er gleich dem vor der Regel erfassten (dieselben `listitem` in der `list` „Einträge des Transkripts der Reihe nach“).
- [x] **AK 4 (Verhalten)** Gegeben die Spec von R00239 (`e2e/tests/r00239-laufansicht-zeitachse-filter-blaettern.spec.js`) ohne geänderte Erwartung, wenn sie läuft, dann ist sie grün — Ansage, Zählung, Sperrform, Sprung, Fokus und die Marke `el.__probe` an der Insel eingeschlossen.
- [x] **AK 5 (Messung, Beobachtung)** Gegeben ein Lauf mit 2.000 Einträgen (≈ 1.000 Zeilen) und T3, wenn je Kästchen fünfmal hin und zurück gewechselt wird, dann nennt der Bericht je Kästchen den Median vom Klick bis nach dem nächsten Bild und die Last nach `uptime` (gemessen bei Last ≤ 2, `nice -n 10`); erwartet ≤ 200 ms bzw. ≤ 500 ms (Messung der Architektur: ≤ 44 ms bzw. ≤ 377 ms bei Last 3, ADR-0041 N5). Eine Überschreitung ist kein Fehlschlag des Gates, sondern eine Frage an den architekt (Variante B, N5).

Grenz- und Leerfälle: ein Lauf ohne Zeilen hat keine Zeile ohne `display: list-item` zu prüfen (Zähler 0 gilt trivial); Fehlerfall ist der Mutant aus AK 2.

## Betroffene Verzeichnisstruktur

- `web/kd-app.css` — die eine Regel bei `.lv-l>li` (`:1758`).
- `e2e/tests/` — neue Spec für AK 1–3 neben der Spec von R00239; AK 4 ist diese Spec unverändert.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1261 Stilprobe, Mutanten, Schnappschuss zuerst**: Spec rot (Zähler > 0), `ariaSnapshot` vor dem Bau als erwarteter Text ablegen, Mutanten benennen.
2. **B1262 Regel**: `:where(.lv-l)>li{display:block}` mit Kommentar; Stilprobe grün, Mutanten rot.
3. **B1263 Verhalten, Messung, Gate**: Spec von R00239 grün, Messung für den Bericht, Modell A00009 „Ist“ nachführen.

### Grobentwurf

Keine Klassen. Einstiegsstelle: die CSS-Regel bei `.lv-l>li`. Gemessene Ursache und die verworfenen Varianten B–E stehen in ADR-0041 N5 „Optionen“.

### Änderungen an bestehenden Klassen

Keine.

## Tests

**E2E:** AK 1–4 als Playwright-Spec gegen das gestartete Programm; **Unit:** keine, es gibt keine Logik. Die Wanduhr (AK 5) ist keine Prüfung, sondern ein Wert im Bericht (`gemeinsam/gelerntes.md`, „Grenzen, die Arbeit begrenzen“).

## Abhängigkeiten

- Abhängig von: [R00239](R00239-laufansicht-zeitachse-filter-blaettern.md) (I0229: Insel, Filter, Ansage; die Karte baut auf dem Zweig `karte/253`, `braucht:253`).
- Blockiert: nichts. Auf `main` steht schon N4 (#261, R00240); N5 kommt beim Zusammenführen dahinter.

## Offene Fragen

Keine, die den Bau aufhält. Die UX-Vorprüfung entfällt: keine Gestaltung, kein Text, keine Bedienung ändert sich (AK 3, 4 beweisen es).

## Manuelle Vorbereitungstätigkeiten

- Messung tagsüber einplanen (8–21 Uhr, Last ≤ 2).

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 „Ist“ zu N5 nachführen (Regel steht, Stand ersetzt).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist Code-Review #253 A1: 1.000 Zeilen 0,36 s, 5.000 Zeilen 58 s. Der Filter setzt ein Attribut, das Zeilen verbirgt; jede verborgene `li` mit `display: list-item` lässt den Browser die Ordnungszahlen der folgenden Zeilen neu rechnen, bei k verborgenen von n Zeilen O(n·k). Als `display: block` hat eine Zeile keine Ordnungszahl, das Verbergen kostet O(1) je Zeile, und gemessen sinkt es von 450 ms auf 7 ms (1.003 Zeilen). Die Nachrichten- und Denkzeilen behalten ihr Raster, weil die Regel nur Spezifität 0,0,1 hat.

## Notizen

- **Verworfen** (ADR-0041 N5 „Optionen“): B Verbergen in Blöcken, C Klasse je Zeile, D Neuaufbau, E Virtualisierung.
- **Fünf Kriterien** (Schlank arbeiten).
