---
id: R00192
status: Neu
datum: 2026-11-17
---

# R00192: Burndown nennt Rückläufer als Teil von „+ hinzugekommen“

## Beschreibung

Herkunft: Karte #195 (aus #160 Punkt 1, Betreiber-Freigabe 2026-11-17 „freigeben und bauen“). Im Burndown zählt eine Aufgabe, die aus der Zielspalte zurück nach links zieht, als „+ hinzugekommen“ und später wieder als „− erledigt“ ([R00164](R00164-burndown-zugang-und-abgang-je-tag.md) AK 4). Wie viel vom „+“ solche Nacharbeit ist, sieht niemand.

**Gewünscht:** Der Burndown nennt je Tag und als Summe des Zeitraums, **wie viele der „+“ Rückläufer sind** („davon zurückgekommen“). Das ist eine **Teilmenge von „+“**, kein vierter Posten: Bilanz, „offen“, „Umfang“, „− erledigt“, „− entfernt“ und die Balken bleiben, wie sie sind. Keine Zeichnung: es entstehen nur Zahlen an vorhandenen Stellen (Tooltip, Tabellenansicht, Kennzahlzeile, Legende).

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00164, R00166 (Zielspalte), R00081.

## Akzeptanzkriterien

**Ausgangslage:** das Rechenbeispiel aus R00164 (Spalten „Eingang“, „In Arbeit“, „Fertig“; Zeitraum 02.–05.11.; #1 am 04.11. aus „Fertig“ zurück nach „In Arbeit“).

- [ ] **AK 1 Zählung:** Ein „+“ ist ein Rückläufer, wenn die Aufgabe unmittelbar davor erledigt war (im Bestand, Zielblock nach „Erledigt heißt“, R00166) und nun offen ist. Neu angelegt, aus dem Archiv geholt, vom Board genommen und zurück oder in eine gezählte Spalte eingetreten sind keine Rückläufer.
- [ ] **AK 2 Rechenbeispiel:** 02.11. „+ 3, davon zurückgekommen 0“; 03.11. „+ 2, davon zurückgekommen 0“; 04.11. „+ 1, davon zurückgekommen 1“; 05.11. „+ 0, davon zurückgekommen 0“; Summen 02.–05.11.: „+ 6, davon zurückgekommen 1“.
- [ ] **AK 3 Zahlen sichtbar:** Tooltip des Tages (Zeile „davon zurückgekommen“ unter „+ hinzugekommen“), Tabellenansicht (Spalte „davon zurückgekommen“ rechts von „+ hinzugekommen“) und Kennzahlzeile („davon zurückgekommen 1“ hinter „+ 6 hinzugekommen“) nennen die Zahl; 0 statt leer.
- [ ] **AK 4 Legende:** Ein Satz sagt, dass „davon zurückgekommen“ Nacharbeit aus der Zielspalte zählt und „− erledigt“ dadurch über dem Durchsatz liegen kann; der Satz „Ein Zug zurück nach links zählt als + hinzugekommen“ bleibt.
- [ ] **AK 5 Nichts sonst ändert sich:** Bilanz, „offen“, „Umfang“, „+“, „− erledigt“, „− entfernt“, Balken, Filter, Zeitraum und „Rechnen ab“ geben dieselben Zahlen wie vor der Anforderung; Board-Datei, API und übrige Berichte unverändert; nichts wird gespeichert. Die Zahl „davon zurückgekommen“ ist an jedem Tag höchstens „+“.
- [ ] **AK 6 Mit Zielspalte:** Ist in „Erledigt heißt“ ein Block gewählt (R00166), ist Rückläufer, wer aus dem Block oder rechts davon nach links hinaus zieht (Beispiel: Block „In Arbeit“, #2 zieht am 04.11. von „In Arbeit“ nach „Eingang“ → „davon zurückgekommen“ 1).

## Tests

Unit in `e2e/einheit/` (Rechenbeispiel, jeder Übergang aus AK 1, Zielblock, `zurueckgekommen ≤ hinzugekommen`), E2E-Erweiterung der Spec `e2e/tests/r00164-zugang-abgang.spec.js` am Rechenbeispiel (Tooltip, Tabelle, Kennzahlzeile, Legende).

## Implementierungshinweise

- Die Ereignisfunktion `ereignisseJeTag`/`ereignisArt` (`web/berichte.js`) bleibt die eine Stelle: `ereignisArt` liefert weiter `hinzugekommen`; eine benannte Prüfung „Rückläufer?“ (vorher `da`, erledigt, im Bestand; nachher offen) zählt zusätzlich `zurueckgekommen` je Tag. So bleibt es eine Teilmenge von „+“ und Karte #197 (Zugang nach Herkunft) setzt auf derselben Stelle auf.
- Zeichnen: `BURNDOWN_EREIGNISSE` ist die Liste der drei Posten (Legende, Balken, Kennzahl); „davon zurückgekommen“ gehört **nicht** hinein, sondern bekommt eine eigene Zeile an Tooltip, Tabelle, Kennzahlzeile und Legende (`web/ansicht.js` `vBurndownKennzahl`, `vBurndownLegende`, Tooltip und Tabelle um :1367/:1380).
- `reporting.burndown` und Berichtsfilter wirken wie auf „+“; der Rückgriff von „Wie lange noch“ auf `hinzugekommen − entfernt` (:672) bleibt unberührt.
- **Nicht hinein:** vierter Balken, Herkunft des Zugangs (#197), Eingriff in Durchsatz, Fluss oder Fever Chart, Server, Datenformat.
- Am Code gelesen, nicht gefahren.

## Warum löst diese Anforderung das Problem?

Auslöser: Der Betreiber sieht ein hohes „+“ und weiß nicht, ob es neue Arbeit oder Nacharbeit ist. Zählt der Bericht die Rückläufer als Teil von „+“ (X), steht neben jedem „+“, wie viel davon zurückkam (Y), und er liest ohne Rechnen ab, ob „− erledigt“ über dem Durchsatz wegen Nacharbeit liegt (Z).

## Offene Fragen

Keine.
