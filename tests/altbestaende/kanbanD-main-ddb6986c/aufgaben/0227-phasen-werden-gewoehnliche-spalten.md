---
id: 227
title: Phasen werden gewöhnliche Spalten
labels: [feature, datenformat, oberflaeche, "braucht:224"]
---

Scheibe **S3** des Rückbaus der WBS (ADR-0034, PO Z. 433): Phasen-Spalten werden gewöhnliche Spalten. `column-phases` fällt beim nächsten Schreiben einer Aktion weg, beim Start entsteht kein Commit. **Gesperrt**, bis die Factory-Pflege und die globalen Befehle ausgerollt sind.

Abnahme-Probe: Ein Board mit `column-phases` liefert kein `phasen` und erzeugt keinen Auto-Commit. Die Berichte sind gleich denen desselben Boards ohne `column-phases`.
