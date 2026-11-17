---
id: R00180
status: Erledigt
datum: 2026-11-16
---

# R00180: Tastatur — jedes Bedienelement erreichen und auslösen

## Beschreibung

Herkunft: Karte #141 (Teil 1 der Sammelkarte aus #41, #60, #61, #134, #185), Befunde am Code gelesen am 2026-11-16. Wer ohne Maus arbeitet, kommt heute an vier Stellen nicht weiter: aus den Berichten Stundenzettel, „Zeiten nach Aufgabe und Person“ und Durchlaufzeit lässt sich keine Aufgabe öffnen, eine Teilaufgabe lässt sich nicht abhaken, in den Einstellungen lässt sich keine Farbe wählen, und der Titel im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) reagiert auf Enter, aber nicht auf die Leertaste. Fehlender Umfang: [R00106](R00106-fokus-in-fenstern-und-menues.md) führt den Fokus in Fenstern und Menüs, sagt zu diesen Stellen aber nichts.

**Gewünscht:** Alles davon geht mit Tab, Enter und Leertaste. Die Zeile eines Berichts ist als Ganzes ein Tab-Halt (entschieden: ganze Zeile, wie in der Aufgabenliste). Kästchen und ✕ einer Teilaufgabe heißen für Hilfstechnik wie der Stift: ohne Markdown-Zeichen.

Eine Zeichnung ist nicht nötig: es entsteht keine neue sichtbare Bedienung, der Fokusring ist vorhanden. Zahlt ein auf: [Vision](R00000-vision.md) — der Mensch bedient das Board ohne Umweg, auch ohne Maus.

## Akzeptanzkriterien

**Ausgangslage:** ein Board mit Aufgabe #1 „Bericht prüfen“, die in dieser Woche gebuchte Zeit einer Person trägt und die Spalten „von“ und „bis“ der Durchlaufzeit durchlaufen hat; #1 hat zwei offene Teilaufgaben, „Daten holen“ und „`**fett** prüfen`“. Einstellungen mit mindestens einer Klasse und einem Signal. Bedient wird nur mit der Tastatur.

- [x] **AK 1 Aufgabe aus dem Bericht öffnen (Abnahme-Probe der Karte):** In jedem der drei Berichte Stundenzettel, „Zeiten nach Aufgabe und Person“ und Durchlaufzeit ist die Zeile von #1 per Tab erreichbar und trägt den Fokusring; Enter öffnet das Aufgabenfenster von #1, Leertaste ebenso (die Seite rollt dabei nicht). Nach Esc steht der Fokus wieder auf dieser Zeile. Das sind sechs Proben: drei Berichte mal zwei Tasten.
- [x] **AK 2 Teilaufgabe abhaken:** Im Aufgabenfenster von #1 ist das Kästchen von „Daten holen“ per Tab erreichbar. Leertaste hakt ab: der Zähler zeigt 1/2, die Datei der Aufgabe ist geändert, der Fokus steht weiter auf demselben Kästchen. Eine zweite Leertaste nimmt den Haken zurück (0/2).
- [x] **AK 3 Namen ohne Markdown-Zeichen:** Der zugängliche Name des Kästchens und des ✕ der zweiten Teilaufgabe enthält „fett prüfen“ und kein `*` — wie heute schon der Stift.
- [x] **AK 4 Farbe wählen:** In den Einstellungen ist das Farbfeld einer Klasse und das eines Signals per Tab erreichbar; Enter öffnet die Palette, Leertaste ebenso. Eine Farbe der Palette ist per Tab erreichbar und wird mit Enter wie mit Leertaste gewählt: das Farbfeld und die Vorschau zeigen die neue Farbe.
- [x] **AK 5 Leertaste am Titel:** Leertaste auf dem Titel des Aufgabenfensters öffnet die Bearbeitung wie Enter. Grenze: im geöffneten Titelfeld und in jedem anderen Eingabefeld schreibt die Leertaste weiter ein Leerzeichen und löst nichts aus.
- [x] **AK 6 Sammelprobe und Bestand:** In Board, Aufgabenfenster, Aufgabenliste, Personen, jedem Bericht, der WBS-Sicht und den Einstellungen (mit offener Palette) hat jedes Element mit `role=button` oder `role=checkbox` und jede Tabellenzeile mit `data-act` einen Tab-Halt (`tabIndex >= 0`) — heute rot an genau den oben genannten Stellen. Mausklick wirkt an allen Stellen wie bisher; die bestehenden Tests laufen unverändert grün.

## Tests

E2E als Spec, AK 1 und die Sammelprobe aus AK 6 zuerst (heute rot). Je Stelle beide Tasten. Unit für den gemeinsamen Tastenzweig, falls er als reine Funktion entsteht.

## Implementierungshinweise

- Vorschlag, keine Vorschrift: ein Weg für alle — Tab-Halt am Element und ein gemeinsamer Tastenzweig „Enter oder Leertaste löst ein nicht-natives Element mit Rolle `button` oder `checkbox` aus“ (Vorbild `eintragAusloesen`, `web/app.js:1235`), ohne Strg, Alt, Meta; oder echte Knöpfe. Ein Kästchen löst nach Übung nur mit der Leertaste aus. Berichtszeilen wie die Zeilen der Aufgabenliste (`tr[data-zeile]`, `tabindex="0"`, `web/ansicht.js:1101`).
- Fundstellen: Berichtszeilen `web/ansicht.js:1200`, `:1211`, `:1852`; Farbfeld und Palette `:2138`, `:2151` (`k-pal`, `k-farbe`, `s-pal`, `s-farbe`); Kästchen und ✕ `:477`, bereinigter Name `markdownOhneMarken` (`web/markdown.js:92`, genutzt am Stift `web/ansicht.js:471`); Titel `web/ansicht.js:387`, Enter-Zweig `web/app.js:2913`.
- **Schadensstelle:** Der Wiederfinde-Schlüssel des Kästchens (`data-halt="teil-haken:…"`) bleibt, sonst verliert es nach dem Abhaken den Fokus (ADR-0010 N10). Die Leertaste darf in Eingabefeldern nie abgefangen werden.
- **Nicht hinein:** Umsortieren von Teilaufgaben per Tastatur · Fokus beim Neuzeichnen (Karten #189, #191, #192).

## Warum löst diese Anforderung das Problem?

Auslöser: Wer per Tab durch den Stundenzettel geht, überspringt heute jede Zeile und erreicht die Aufgabe nur mit der Maus. Bekommt jedes auslösbare Element einen Tab-Halt und denselben Tastenzweig (X), erreicht die Tastatur jede Stelle, die die Maus erreicht (Y); der Mensch öffnet die Aufgabe, hakt die Teilaufgabe ab und wählt die Farbe, ohne zur Maus zu greifen, und die Sammelprobe hält das für künftige Elemente fest (Z).

## Offene Fragen

Keine.
