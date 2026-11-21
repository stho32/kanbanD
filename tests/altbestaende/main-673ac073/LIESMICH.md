# Belege der Vorversion (main 673ac073, vor R00216)

Geschrieben von einer gebauten Vorversion (Stand vor Karte #208) gegen Dateien dieser Version (R00216 AK 14c):

- `transcripts-ein-eintrag.md` — Aufgabe mit genau einem Eintrag `transcripts` nach einer Titeländerung durch die Vorversion (Blockform, als unbekannter Schlüssel mitgetragen).
- `board-fabrik-nach-zug-der-vorversion.md` — Board „fabrik“ mit `record-transcripts: true`, nachdem die Vorversion #1 nach „Fertig“ gezogen hat: der Schlüssel fehlt.
- `kanbanD-nach-put-der-vorversion.md` — `kanbanD.md` mit `record-transcripts: true`, nachdem die Vorversion über `PUT /api/einstellungen` eine Person ergänzt hat: der Schlüssel fehlt.

In beiden Fällen antwortet diese Version danach auf einen Upload 409 (sichere Richtung); Einträge und Dateien bleiben `vorhanden`. Probe: `vorversion_probe.sh` in der Ablage des Laufs 208-entwickler-1.
