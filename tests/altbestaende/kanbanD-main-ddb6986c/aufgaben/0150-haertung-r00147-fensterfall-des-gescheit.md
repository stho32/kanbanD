---
id: 150
title: "Härtung R00147: Fensterfall des gescheiterten Nachladens als Probe"
labels: ["braucht:80"]
---

R00147 AK 5/6 prüfen den Board-Fall (Hinweis D00007). Bei Auslösung im Aufgabenfenster zeichnet derselbe Hinweis an dessen Anker; das ist gebaut, aber nicht geprobt. Probe: Aufgabe im Fenster öffnen, eigene Teilaufgabe abhaken, nächsten GET /api/zustand per page.route hart scheitern lassen → genau eine Meldung an #fenster .hinweis-anker (role=status), nicht im Fuß, Text „Änderung gespeichert — Ansicht nicht neu geladen.“; Gegenprobe: scheitert auch der PATCH, steht im Fuß „nichts geändert“.

Angelegt aus #80.

```kanbanD-comments
2026-11-14 15:05+01:00 · dir · Aus den Auto-Reviews von #80 (Warteschlange endet erfüllt, 2026-11-14), zur Entscheidung beim Bau dieser Karte: (1) observability-reviewer, Sollte: web/warteschlange.js:25 und :31 fangen Netz- und Programmfehler gleich; ein Programmfehler beim Nachladen bleibt ohne Spur in der Konsole. Probe (heute rot): Gegeben die Warteschlange führt eine eigene Anfrage aus; wenn das Nachladen einen Programmfehler wirft (Server antwortet 200 mit ungültigem JSON); dann erscheint am Auslöser weiterhin genau eine Meldung und der Fehler ist als console.error erkennbar. (2) code-reviewer, Sollte: keine Probe für US-3 (fremde Änderung erscheint nach dem Fehlschlag ohne Zutun) — von der Rolle grün geprobt, als Test nicht festgehalten.
2026-11-14 15:30+01:00 · dir · Aus dem UX-Review von #80 (2026-11-14), vom planer bei #138 hierher verwiesen: der Schreibweg des Aufgabenfensters (schreiben in web/app.js: Kästchen, Löschen, Kommentar) meldet bei gescheitertem Nachladen „nichts geändert“ in der Statusleiste, obwohl die Änderung gespeichert ist — sichtbare Falschaussage, beim Bau dieser Karte mit abdecken.
2026-11-15 10:22+01:00 · dir · Wird mit #149 gebaut (Paket „Warteschlange: Frist und Meldung bei gescheiterter Anfrage“, product-owner 2026-11-15). Diese Karte bleibt bis dahin in „Architektur“ liegen und zieht mit dem Paket nach „Erledigt“.
2026-11-17 08:37+01:00 · dir · Verschoben von „Architektur“ nach „Erledigt“ — ausgeliefert
```
