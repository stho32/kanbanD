---
applications: [kd]
column-phases:
  Entwicklung: Entwicklung
  Entwicklertest: Entwicklertest
column-notes:
  Ohne Mensch nicht lösbar: "Manuell: Schleifen und Entscheidungen, die der Betreiber treffen muss"
  Backlog: "Manuell: Sammlung; der Betreiber gibt frei, indem er Karten nach „Architektur“ legt; hier liegen auch die Karten „Besprechen: …“ aus PO und realist-consultant"
  Architektur: "Team · architekt: prüfen, ob die Karte eine Technikfrage aufwirft; wenn ja entscheiden und als ADR festhalten, sonst sofort weiter; die erste Karte bringt das Architektur-Modell"
  Detailplanung: "Team · planer, ux-reviewer: WBS-Knoten anlegen bzw. Interaction bis Bubble verfeinern, Anforderung schreiben oder abgleichen; ux-reviewer nur als Vorprüfung bei Oberfläche; fachspezialist auf Abruf bei neuen Begriffen"
  Entwicklung: "Team · entwickler: bauen, Test zuerst, Gate (`cargo test`, `node --test e2e/einheit/`, betroffene Playwright-Specs; volle Suite am Kartenende)"
  Nacharbeit: "Team · entwickler: Muss-Befunde aus Auto-Reviews und Entwicklertest beheben (`entw2`, Worktree `kanbanD-entw2`, Zweig `nacharbeit/<nr>`), danach zurück in die Auto-Reviews, nur Rollen mit Befund wiederholen"
  Auto-Reviews: "Team · code-reviewer, security-reviewer, ux-reviewer, rechtschreib-reviewer, architektur-reviewer, legacy-reviewer, observability-reviewer: Reviews parallel am selben Stand, je Rolle eine Teilaufgabe; code-reviewer immer, die übrigen nur, wenn die Karte ihr Thema berührt (Auswahl im Kommentar des Directors beim Zug)"
  Entwicklertest: "Team · entwicklertester: User Story wörtlich im echten Programm auf einer Wegwerf-Instanz"
  Erledigt: "Manuell: fertig: nach bestandenem Entwicklertest direkt hierher, ohne Abnahme-Spalte; beim Zug installiert der Director kanbanD neu und startet das Board neu (siehe „Auslieferung“); letzte Spalte, Abschlussspalte der Berichte"
---

# KanbanD

## Ohne Mensch nicht lösbar

## Backlog

## Architektur

## Detailplanung

## Entwicklung

- [#208](../aufgaben/0208-transkripte-der-agenten-laeufe-an-der-ka.md)

## Nacharbeit

## Auto-Reviews

## Entwicklertest

- [#228](../aufgaben/0228-braucht-zwischen-karten.md)

## Erledigt

- [#207](../aufgaben/0207-commits-an-der-karte-und-review-diff-dir.md)
