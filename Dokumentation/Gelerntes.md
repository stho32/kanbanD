# Gelerntes

Je Lauf eine Zeile: Erkenntnis über die Sache, Folge.

| Datum | Lauf | Erkenntnis | Folge |
|---|---|---|---|
| 2026-10-18 | R00053 | Eine Herkunft hat zwei Schreibweisen (`I0007` und `kd:I0007`), die bei genau einer Anwendung denselben Knoten meinen — Vergleiche über Aufgaben hinweg brauchen eine kanonische Schreibweise vom Server (`schluessel`), sonst rechnet jeder Konsument die Auflösung nach. | Folgeslices (WBS-Sicht, Wirkungen R00057) vergleichen nur über `schluessel` bzw. `Herkunftsschluessel::qualifiziert`, nie über den Rohtext aus `origins`. |
| 2026-10-18 | R00054 | Wer eine Datei in einem fremden Repository live zeigt und „nicht committet“ meldet, muss neben der Datei auch das Git-Verzeichnis (`index`, `HEAD`) beobachten — und jede Git-Abfrage im Ereignispfad darf den Index nicht schreiben (`GIT_OPTIONAL_LOCKS=0`), sonst erzeugt die Anzeige selbst die nächste Änderung. | R00055/R00056 schreiben die WBS-Datei: eigene Schreibzugriffe als eigen markieren (`Eigene` kennt bisher nur Pfade im Ordner), nie im Arbeits-Repository committen; der fremde Wächter meldet die Änderung ohnehin. |
