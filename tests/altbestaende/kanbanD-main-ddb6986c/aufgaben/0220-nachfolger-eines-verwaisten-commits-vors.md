---
id: 220
title: Nachfolger eines verwaisten Commits vorschlagen (patch-id)
labels: [feature, sicherheit, "braucht:211", "braucht:219"]
---

**Scheibe A5** (ADR-0032 N1.7, vorgeschlagen; Betreiber-Entscheidung 2026-11-19: eigene spätere Karte): GET …/commits/{verweis}/nachfolger nur für Verweise im Zustand verwaist. Gesucht werden Commits auf Zweigen mit gleicher patch-id --stable.

- Nur auf Klick, ersetzt nie selbst.
- Zuerst eine Sondierung von höchstens 30 min zur Suchtiefe (gemessen 3,0 s für 1.000 Commits).

Nutzen: Menschen, die von Hand rebasen, finden den Nachfolger eines verwaisten Commits.

Kommt am Ende von Teil A, nach A2 und A1b. Keine Voraussetzung für B.
