---
id: R00194
status: Erledigt
datum: 2026-11-17
---

# R00194: Burndown nennt, wie viel vom Zugang selbsterzeugt ist

## Beschreibung

Herkunft: Karte #197 (aus #160 Punkt 3, Betreiber-Freigabe 2026-11-17; Anlass in #154). KI-Läufe erzeugen laufend Aufgaben; der Betreiber will sehen, wie viel vom „+ hinzugekommen“ **Neues** ist und wie viel **selbsterzeugt** (Befund, Härtung, Bug). Ein verlässliches Merkmal in der Aufgabe gibt es nicht (`herkunft` meint den WBS-Knoten); der Label-Filter ([R00081](R00081-berichtsfilter-am-board.md)) zeigt „+“ nur je ein Label getrennt, nicht als Anteil.

**Gewünscht:** Je Board wählt der Mensch über dem Burndown eine Liste von Labels, die „selbsterzeugt“ heißen (z. B. `befund`, `härtung`, `bug`); die Schreiber setzen sie schon an Folgekarten. Der Burndown nennt je Tag und als Summe, wie viele der „+“ **selbsterzeugt** sind. Kein neues Aufgabenfeld, keine Pflicht für Schreiber: ohne eines dieser Labels zählt ein „+“ als Neues. Das Label gilt mit dem **heutigen** Stand der Aufgabe ([R00081](R00081-berichtsfilter-am-board.md)), nicht dem zum Zeitpunkt des Zugangs. Jedes „+“ ist genau eines von **neu · selbsterzeugt · zurückgekommen**; die Summe der drei ist „+“ (Rückläufer sind nie selbsterzeugt, [R00192](R00192-burndown-nennt-ruecklaeufer-als-teil-von-hinzugekommen.md)).

**Speicherort (Entscheidung des Architekten):** `fever: {self-labels: [befund, härtung]}` in der Board-Datei, neben `target-column` und `from-column` ([R00166](R00166-erledigt-heisst-je-board-fuer-burndown-durchsatz-und-fever-chart.md), [R00167](R00167-durchsatz-von-spalte-waehlbar-zugang-als-zweiter-balken.md)), über dieselbe Route `PUT /api/boards/{slug}/fieber`; Begründung ADR-0027 N6. Keine Zeichnung: Auswahlfeld und Zahlen folgen dem vorhandenen Muster von „Erledigt heißt“.

> **In Kauf genommen — bei der Auslieferung sagen:** Eine ältere kanbanD-Version, die dieselbe Board-Datei schreibt, verliert den Schlüssel `self-labels` beim nächsten Schreiben (wie bei `from-column`, R00167); die Zahl verschwindet, keine falsche Zahl.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00192 (gleiche Ereignisfunktion), R00164, R00166, R00081; Vorbild für Speichern und Auswahl: R00166.

## Akzeptanzkriterien

**Ausgangslage:** das Rechenbeispiel aus [R00164](R00164-burndown-zugang-und-abgang-je-tag.md) (Zeitraum 02.–05.11.; „+“ 3 · 2 · 1 · 0 = 6; #1 zieht am 04.11. aus „Fertig“ zurück, ist Rückläufer); #3 und #4 tragen das Label `befund`.

- [x] **AK 1 Auswahl und Speichern:** Über dem Burndown steht „Selbsterzeugt =“ mit Mehrfachauswahl aus den Labels des Boards (Bedienung nach „Erledigt heißt“). Die Wahl `befund` steht danach als `fever: {…, self-labels: [befund]}` in der Board-Datei, mit einem Commit; ohne Wahl bleibt die Datei zeichengleich (kein neuer Schlüssel, die Zahl fehlt).
- [x] **AK 2 Zählung:** Ein „+“ ist selbsterzeugt, wenn die Aufgabe mindestens eines der gewählten Labels trägt und das „+“ **kein** Rückläufer ist. Jedes „+“ ist genau eines von neu, selbsterzeugt, zurückgekommen; an jedem Tag ist die Summe der drei gleich „+“.
- [x] **AK 3 Rechenbeispiel (Abnahme-Probe der Karte):** mit `befund` gewählt: je Tag 02.–05.11. „davon selbsterzeugt“ 1 (#3) · 1 (#4) · 0 · 0; Summe 02.–05.11. „+ 6: davon selbsterzeugt 2 (#3, #4), zurückgekommen 1 (#1), Neues 3“; Berichtsfilter und Zeitraum (R00081) wirken auf die Zahl wie auf „+“.
- [x] **AK 4 Sichtbar:** Tooltip des Tages, Tabellenansicht (Spalte „davon selbsterzeugt“ neben „davon zurückgekommen“) und Kennzahlzeile nennen die Zahl (0 statt leer); die Legende nennt die gewählten Labels und den Satz „zählt nach dem heutigen Stand der Labels“.
- [x] **AK 5 Label kommt nicht vor:** Trägt keine Aufgabe das gewählte Label, steht 0 und der Hinweis „Label … kommt nicht vor“; kein Fehler.
- [x] **AK 6 Nichts sonst ändert sich:** Bilanz, „+“, die übrigen Zahlen, Balken, Durchsatz und „Wie lange noch“ geben dieselben Zahlen wie vorher; das Schreiben der Wahl erhält `target-column`, `from-column` und alle übrigen Schlüssel der Board-Datei, und eine Änderung am Fever Chart erhält `self-labels`.

## Tests

Unit in `e2e/einheit/` (Rechenbeispiel, Disjunktheit mit „zurückgekommen“, Summe gleich „+“, Label-Filter, fehlendes Label); Rust: Rundlauf der Board-Datei ohne und mit `self-labels`, Erhalt bei `PUT …/fieber` und Kartenzug (Vorbild R00167); E2E-Erweiterung der Spec `e2e/tests/r00164-zugang-abgang.spec.js` am Rechenbeispiel.

## Implementierungshinweise

- Karte #195 (R00192, I0182) liefert `ereignisseJeTag` mit `zurueckgekommen`; hier kommt `selbsterzeugt` an derselben Stelle dazu: ein „+“, das kein Rückläufer ist und dessen Aufgabe ein gewähltes Label trägt. Die Labels liest die Funktion mit dem heutigen Stand (`aufgabeZu`, wie `aufgabePasst`, `web/berichte.js:38`). Weder `selbsterzeugt` noch `zurueckgekommen` gehören in `BURNDOWN_EREIGNISSE`.
- Auswahl und Speichern wie B0807/B0808: `vErledigtHeisst` (`web/ansicht.js:1341`), Schreiben über `PUT …/fieber` (`web/app.js:2259`, Felder `zielspalte`, `vonspalte`; neu `selbstlabels`). Rust: `Fieber` (`src/modell/board.rs:191`), `fieber_lesen`/Schreiben (`src/format/board.rs:146–280`), `fieber_setzen` (`src/dienst/fieber.rs:41`), Beschreibung der Route in `src/web/endpunkte.rs:48` und `src/web/mod.rs:588`.
- **Nicht hinein:** Label-Präfixe (R00100, nur ganze Labels) · Herkunft im Durchsatz oder Fluss · Rückrechnung nach Label zum Zeitpunkt des Zugangs · neues Aufgabenfeld · vierter Balken.
- Am Code gelesen, nicht gefahren.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung den Absatz „In Kauf genommen“ wörtlich sagen.

## Warum löst diese Anforderung das Problem?

Auslöser: Der Betreiber sieht ein hohes „+“ und weiß nicht, ob es Neues oder von KI-Läufen selbst Erzeugtes ist. Wählt er die Labels, die „selbsterzeugt“ heißen (X), nennt der Burndown neben jedem „+“ den selbsterzeugten Anteil (Y), und mit „zurückgekommen“ ergibt sich der Rest als Neues, ohne dass jemand die Aufgaben zählt (Z).

## Offene Fragen

Keine.
