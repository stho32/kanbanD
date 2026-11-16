---
id: R00176
status: Erledigt
datum: 2026-11-16
---

# R00176: Markdown — Tabellen in der Beschreibung

## Beschreibung

Herkunft: Karte #184, Betreiber am 2026-11-16 wörtlich: „Ich hab nämlich immer wieder aufgaben die in der Read Only Sicht z.B. Tabellen im Markdown format (in der Kartendetail-Ansicht) nicht als Tabelle rendern sondern einfach nur als Text.“ Fehlender Umfang, kein Fehler: [R00030](R00030-beschreibung-als-markdown-lesen.md) zählt die Elemente abschließend auf. Heute erscheint eine Tabelle im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) als Absatz mit Zeilenumbrüchen.

**Gewünscht:** Eine Tabelle nach GFM — Kopfzeile, Trennzeile, Zeilen — wird in der Lesesicht der Beschreibung eine Tabelle. Die Trennzeile gilt, wenn sie mindestens ein `|` trägt, jede Zelle mindestens ein `-` und sie so viele Spalten hat wie die Kopfzeile. Die Sicherheit regelt [ADR-0030](../Dokumentation/ADRs/0030-markdown-aus-fremdem-text-erst-maskieren-feste-elemente.md) (Punkte 1–8); die Adressprüfung baut Karte #187 voraus.

**Wirkung auf den Bestand (gezählt am Board des Projekts, 182 Aufgaben): keine gespeicherte Beschreibung sieht danach anders aus — keine trägt eine Tabelle, drei mit `|` im Fließtext bleiben Text.**

Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0003.dc.html#markdown-elemente`. Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“ (Markdown bleibt Markdown, kanbanD zeigt es lesbar).

## Akzeptanzkriterien

- [x] **AK 1 Abnahme-Probe der Karte:** Gegeben die Beschreibung `| Spalte | Wert |` / `|:---|---:|` / `| **a** | 1 |` / `| <script>alert(1)</script> | 2 |` (vier Zeilen). Wenn ich die Aufgabe öffne, dann steht dort eine Tabelle mit zwei Spalten, „Wert“ rechtsbündig, „a“ fett, und das Skript als sichtbarer Text. Heute rot: ein Absatz mit Zeilenumbrüchen.
- [x] **AK 2 Ausrichtung:** `:---` richtet die Spalte links aus, `:---:` mittig, `---:` rechts; die Ausgabe trägt dafür eine von drei festen Klassen, nie `style` oder `align`.
- [x] **AK 3 Zellen:** Fett, kursiv, Code und Links wirken in Zellen wie im Absatz; `\|` in einer Zelle bleibt ein `|`. Bei drei Spalten im Kopf zeigt die Zeile `| a | b |` eine leere dritte Zelle, von `| a | b | c | d |` erscheint „d“ nicht.
- [x] **AK 4 Ohne gültige Trennzeile bleibt es Text:** `| a | b |` / `| c | d |` ohne Trennzeile oder mit einer Trennzeile anderer Spaltenzahl erscheint wie heute als Absatz.
- [x] **AK 5 Nachbarn:** Eine Tabelle direkt unter einer Textzeile (ohne Leerzeile) beendet den Absatz und wird Tabelle; unter einem Listenpunkt beendet sie die Liste.
- [x] **AK 6 Schmal:** Bei 375 px Breite scrollt eine Tabelle mit acht Spalten waagrecht in sich; das Fenster scrollt nicht waagrecht.
- [x] **AK 7 Fremder Text:** Die feindlichen Texte aus ADR-0030 bleiben Text, auch in Zellen und in der Kopfzeile.
- [x] **AK 8 Bleibt:** Alles, was heute gerendert wird, wird weiter gleich gerendert (fester Vergleich), außer: eine Kopfzeile mit gültiger Trennzeile wird Tabelle.
- [x] **AK 9 Größe (Nachtrag 2026-11-16 nach dem Security-Review):** Eine Tabelle hat höchstens 50 Spalten, und alle Tabellen einer Beschreibung zusammen haben höchstens 5000 Zellen (Kopfzeilen mitgezählt). Was darüber liegt, bleibt als ganzer Block Text wie ohne Trennzeile — kein abgeschnittenes Stück Tabelle, keine Meldung. Probe: 2000 Spalten × 2000 Zeilen aus 12 KB ergeben keine Tabelle und eine Ausgabe unter 50 KB (vorher 36 MB in 7,6 s); 50 Spalten × 99 Zeilen unter dem Kopf sind noch eine Tabelle.

## Tests

Unit zuerst (AK 1 rot), fester Vergleich um die gewollte Abweichung erweitert; E2E als Spec für AK 1 und AK 6.

## Implementierungshinweise

- Bauart (architekt, mit `node` geprobt): eigener Zweig in `web/markdown.js` mit Vorausblick wie der Codeblock; Hülle zum Scrollen unter einer gemeinsamen Klasse, die R00178 für Kommentare wiederverwendet.
- **Nicht hinein:** Tabelle in einer Liste · geschachtelte Listen, Trennlinie, `####`, `_kursiv_`, Durchstreichen (R00178) · Bilder · rohes HTML · Checklisten als Kästchen.

## Warum löst diese Anforderung das Problem?

Auslöser: Agenten schreiben Vergleiche als Tabelle, der Mensch liest Zeilen voller Striche. Wird die Tabelle als Tabelle gezeigt (X), stehen Werte in Spalten unter ihrer Überschrift (Y); der Mensch erfasst den Vergleich in der Lesesicht, ohne ihn im Kopf auszurichten (Z).

## Offene Fragen

Keine.
