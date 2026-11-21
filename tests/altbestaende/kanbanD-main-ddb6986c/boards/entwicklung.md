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

- [#237](../aufgaben/0237-lastprobe-r00208-fuer-den-gesamt-diff-na.md)

## Architektur

- [#210](../aufgaben/0210-laufansicht-transkript-eines-agentenlauf.md)
- [#216](../aufgaben/0216-syntax-hervorhebung-in-der-review-ansich.md)
- [#217](../aufgaben/0217-reiter-laeufe-im-aufgabenfenster.md)
- [#218](../aufgaben/0218-schalter-transkripte-erfassen-in-einrich.md)
- [#220](../aufgaben/0220-nachfolger-eines-verwaisten-commits-vors.md)
- [#227](../aufgaben/0227-phasen-werden-gewoehnliche-spalten.md)

## Detailplanung

## Entwicklung

## Nacharbeit

## Auto-Reviews

## Entwicklertest

## Erledigt

- [#151](../aufgaben/0151-haertung-sperrform-der-schreib-ausloeser.md)
- [#150](../aufgaben/0150-haertung-r00147-fensterfall-des-gescheit.md)
- [#149](../aufgaben/0149-bug-eine-gescheiterte-eigene-anfrage-vom.md)
