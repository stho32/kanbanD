---
id: 149
title: "Bug: eine gescheiterte eigene Anfrage vom Board aus meldet auf dem Board nichts"
labels: ["braucht:80"]
cost:
  currency: USD
  basis: gemessen je Rollenlauf aus den Protokollen (werkzeuge/kosten.py)
  items:
    - {text: planer (149-planer-1), amount: 2.68, tokens: 1351744}
    - {text: entwickler (149-entwickler-1), amount: 19.97, tokens: 13733950}
    - {text: entwickler (149-entwickler-2), amount: 5.15, tokens: 7565442}
    - {text: code-reviewer (149-code-reviewer-1), amount: 1.50, tokens: 3274210}
---

Der Kartenknopf .naechste-ziel (web/app.js:1372–1383) setzt den Haken optimistisch und sendet über warteschlange(); scheitert der eigene PATCH, schreibt fensterMelden nur S.ui.fensterFehler, den allein der Fuß eines offenen Aufgabenfensters zeichnet (web/ansicht.js:343) — ohne offenes Fenster sieht der Mensch nichts, und der optimistische Haken bleibt stehen. #80/R00147 grenzt diesen Weg ausdrücklich aus (AK 7 „unverändert"). Vorschlag: denselben Auslöser-Ort wie die Meldung des Nachladens nutzen (Hinweis D00007) und den optimistischen Haken bei gescheiterter eigener Anfrage zurücknehmen. Probe: Server weg, Abhaken auf dem Board → Meldung „nichts geändert" sichtbar auf dem Board, Haken verschwindet; heute keine Meldung, Haken bleibt.

Angelegt aus #80.

```kanbanD-time
2026-11-16 21:14+01:00 · 2026-11-16 21:18+01:00 · plan
2026-11-16 21:19+01:00 · 2026-11-17 05:33+01:00 · entw1
2026-11-17 05:33+01:00 · 2026-11-17 07:55+01:00 · entw1
2026-11-17 07:55+01:00 · 2026-11-17 08:12+01:00 · crev
```

```kanbanD-comments
2026-11-15 10:22+01:00 · dir · **Paket „Warteschlange: Frist und Meldung bei gescheiterter Anfrage“ (product-owner, 2026-11-15, Regel „Kleine Karten bündeln“):** Diese Karte führt das Paket. Mit ihr werden gebaut: #148, #150. Geplant, gebaut, geprüft und zusammengeführt wird einmal am Worktree dieser Karte; die Anforderung nennt je Mitglied eigene Akzeptanzkriterien. Besteht das Paket, ziehen alle Mitglieder gemeinsam nach „Erledigt“.
2026-11-16 21:14+01:00 · dir · Verschoben von „Architektur“ nach „Detailplanung“ — Abarbeitung der Architektur-Karten
2026-11-16 21:18+01:00 · dir · Planung: R00186, Arbeitspaket I0176. Entschieden nach Empfehlung des planers: Frist 15 s; Meldung „Keine Antwort vom Server — bitte prüfen, ob die Änderung ankam.“; Anhänge bleiben ohne Frist (benannte Restlücke). Bau startet, sobald ein entwickler-Platz frei ist.
2026-11-16 21:18+01:00 · dir · Verschoben von „Detailplanung“ nach „Entwicklung“ — geplant
2026-11-17 07:55+01:00 · dir · Verschoben von „Entwicklung“ nach „Auto-Reviews“ — gebaut
2026-11-17 08:12+01:00 · dir · Verschoben von „Auto-Reviews“ nach „Entwicklertest“ — Review bestanden
2026-11-17 08:37+01:00 · dir · Ausgeliefert mit #148 und #150: Scheitert ein Abhaken auf dem Board, steht ein Hinweis und der Haken geht zurück. Eine Anfrage, die nach 15 s keine Antwort hat, bricht mit „Keine Antwort vom Server — bitte prüfen, ob die Änderung ankam.“ ab, statt das Board stillzulegen. Programmfehler beim Nachladen stehen in der Konsole. Gate grün (Rust 838 · Unit 1178 · Playwright 1765, erster Lauf (gemeinsames Gate für #102 und #149)).
2026-11-17 08:37+01:00 · dir · Verschoben von „Entwicklertest“ nach „Erledigt“ — ausgeliefert
```
