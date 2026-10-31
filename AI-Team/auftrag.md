---
projekt: /home/shoff/Projekte/kanbanD
board-ordner: /home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard
board: entwicklung
url: http://127.0.0.1:7422
empfaenger: betreiber
betreiber: sh
director: dir
anwendung: kd
realist: vorschlagen
angelegt: 2026-10-31
---

# Auftrag — kanbanD

Aktiviert über `/factory start` aus der Software-Factory (`/home/shoff/Projekte/Software-Factory`). Ein Director, ein Projekt.

## Ziel

kanbanD ist ein Kanban, das ein Ordner ist: Menschen im Browser und KI-Agenten über die API arbeiten auf demselben Board aus Markdown-Dateien, und jede Aktion wird sofort committet, sodass Git das vollständige Gedächtnis ist. Das Team entwickelt es so weiter, dass es als Steuerpult und Übersicht einer Wartungsfabrik taugt (R00095–R00100).

## Einsatz des realist-consultant

Vom Betreiber beim Start festgelegt (2026-10-31), ergänzt `realist: vorschlagen`:

- **Wann**: Der `realist-consultant` berät nicht nur bei Schleifen, sondern immer dann, wenn der `product-owner` einen neuen inhaltlichen Auftrag bekommt (neue Anforderung, Kurskorrektur, neuer Umfang). Er prüft, ob Kriterien und Lösung für ihren Zweck angemessen sind, und schlägt einfachere Fassungen vor.
- **Wer entscheidet**: Der `product-owner` vertritt den Betreiber in der Diskussion und entscheidet nach bestem Wissen und Gewissen und nach der Vision. Er protokolliert in `AI-Team/po-entscheidungen.md`. Der Director setzt nichts selbst um, was nicht der Product Owner entschieden hat.
- **Strittig**: Können sich Product Owner und realist-consultant nicht einigen oder ist die Frage richtungsweisend, legt der Director eine Karte ins **Backlog**: Titel „Besprechen: <Frage>“, die Optionen beider Seiten mit Empfehlung, zuständig `sh`. Der Betreiber stößt sie selbst an, indem er sie mit dem Product Owner bespricht. Bis dahin läuft die betroffene Arbeit nach dem bisherigen Stand weiter oder wird zurückgestellt, nie nach einer der strittigen Fassungen.
