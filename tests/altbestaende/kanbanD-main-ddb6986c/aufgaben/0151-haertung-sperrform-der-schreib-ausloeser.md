---
id: 151
title: "Härtung: Sperrform der Schreib-Auslöser (Feinschliff)"
labels: ["braucht:138"]
cost:
  currency: USD
  basis: gemessen je Rollenlauf aus den Protokollen (werkzeuge/kosten.py)
  items:
    - {text: entwickler (151-entwickler-1), amount: 6.60, tokens: 20393747}
---

Sperrform erst ab ~ 200 ms Laufzeit sichtbar (kein Flackern); aria-busy="true" bei sichtbarer Warte-Anzeige; der vorhandene Anhang-✕ setzt bei laufendem Lesevorgang natives `disabled aria-busy` (web/ansicht.js:420) und verliert dabei den Fokus (ADR-0010) — auf die Sperrform (aria-disabled, Fokus bleibt) ziehen.

Angelegt aus #138.

```kanbanD-time
2026-11-16 22:32+01:00 · 2026-11-16 22:38+01:00 · plan
2026-11-17 06:58+01:00 · 2026-11-17 07:17+01:00 · entw1
```

```kanbanD-comments
2026-11-15 10:22+01:00 · dir · Wird mit #141 gebaut (Paket „Barrierefreiheit: Tastatur, Fokus und Struktur“, product-owner 2026-11-15). Diese Karte bleibt bis dahin in „Architektur“ liegen und zieht mit dem Paket nach „Erledigt“.
2026-11-16 21:13+01:00 · dir · Director 2026-11-16: Paket mit #141 aufgelöst; diese Karte wird für sich gebaut.
2026-11-16 22:32+01:00 · dir · Verschoben von „Architektur“ nach „Detailplanung“ — Abarbeitung der Architektur-Karten
2026-11-17 06:58+01:00 · dir · Verschoben von „Detailplanung“ nach „Entwicklung“ — geplant
2026-11-17 07:17+01:00 · dir · Director: Diff geprüft — die Sperre selbst bleibt sofort (kein Doppelklick-Risiko), nur die Dämpfung wartet 200 ms; kein eigener Review-Lauf (Härtungskarte). Die Umstellung von r00112 AK 13 folgt R00190 AK 3 und ist dort benannt.
2026-11-17 07:17+01:00 · dir · Verschoben von „Entwicklung“ nach „Entwicklertest“ — Diff geprüft
2026-11-17 08:26+01:00 · dir · Umgesetzt auf main 0661646 (Konflikte nur WBS und Anhänge), Unit 1164 und r00190/r00112/r00148 grün. Zusammenführen nach dem Gate von #102/#149.
2026-11-17 09:01+01:00 · dir · Ausgeliefert: Ein Schreib-Knopf zeigt seine gesperrte Form erst nach 200 ms — schnelle Antworten flackern nicht mehr; die Sperre gegen Doppelklick wirkt weiter sofort. Das ✕ eines Anhangs behält beim Lesen den Tastaturfokus. Gate grün (Rust 838 · Unit 1191 · Playwright 1786, erster Lauf).
2026-11-17 09:01+01:00 · dir · Verschoben von „Entwicklertest“ nach „Erledigt“ — ausgeliefert
```
