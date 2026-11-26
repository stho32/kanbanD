---
id: R00254
status: Neu
datum: 2026-11-26
---

# R00254: Durchsatz — Zahlen an den Balken und drei Ø je Tag (Zugang, Abgang, Netto)

## Beschreibung

Auftrag des Betreibers (sh, 2026-11-26, Karte #277), wörtlich:

> Ich hätte gerne "zügig" eine Überarbeitung an der Durchsatz-Statistik. Die Durchsatz-Statistik soll lesbarer werden, derzeit kann man die Zahlen pro Zeiteinheit nur kompliziert in der Statistik ablesen, wenn man mit der Maus rüberhovert. Die Zahlen sollten gut lesbar ohne Hover bereits in der Statistik stehen. Der Durchschnittswert ist gut, aber wir brauchen 3: Durchschnitt an täglich neuen Aufgaben, Durchschnitt an täglich erledigten Aufgaben und (hier bin ich mir über den Begriff nicht sicher brutto/netto? naja, also:) Die Durchschnittliche Differenz zwischen beidem, also die Menge der Aufgaben die tatsächlich abgearbeitet wurde, wenn man die Menge an Aufgaben hinzurechnet, die hinzukommen.

Entscheidungen des product-owner (`AI-Team/po-entscheidungen.md` Z. 718–723, 2026-11-26) — hier umgesetzt, nicht neu verhandelt:

- **Begriff.** „Netto“ = Abgang − Zugang, mit Vorzeichen und Richtungswort: positiv `+` und „baut ab“, negativ `−` (U+2212) und „staut auf“, null ohne Vorzeichen und „ausgeglichen“. „Zugang“ und „Abgang“ bleiben (keine Umbenennung in „neu“ und „erledigt“; „neu“ ist im Burndown schon belegt).
- **Je Tag.** Die drei Ø in der Kennzahlenzeile stehen immer je Kalendertag: Summe ÷ Kalendertage des dargestellten Zeitraums, dieselben Tage wie bei der Auflösung „Tag“. Sie ändern sich beim Umschalten der Auflösung nicht. Netto-Ø = (Abgang − Zugang) ÷ Tage, nicht die Differenz gerundeter Werte. Die Ø-Linien im Diagramm folgen der Auflösung (sonst passen sie nicht zur Balkenhöhe) und nennen ihre Einheit.
- **Zahlen an den Balken.** Zahl mittig über jedem Balken, auch 0; passt eine nicht, entfallen alle, mit einem Satz unter der Fläche.
- **Netto wird nicht gezeichnet**, es kommt als Zahl in die Kennzahlenzeile und als Spalte in die Tabellenansicht.
- **Zeichnung** (Vorgabe für den Bau): `Dokumentation/Wireframes/D0006.dc.html#durchsatz-zahlen` (Zustand neben `#durchsatz-von`, vom gestalter gezeichnet, Freigabe durch den product-owner). Wo Zeichnung und diese Anforderung im Wortlaut abweichen, gilt die Anforderung; Lage, Abstände und Farben gelten nach der Zeichnung.

**Verhältnis zu R00122 und R00167** (beide bleiben abgenommen, ihre Dateien erhalten nur einen Vermerk; Vorbild: Härtung als eigene Interaction, `AI-Team/gelerntes.md` 2026-11-11): Die Kennzahlenzeile von [R00122](R00122-bericht-durchsatz-je-zeitraum.md) (M4, AK 1 und 2: „Ø <x> je Tag|je Woche|je Monat“, Einheit und Ø wechseln mit der Auflösung) und von [R00167](R00167-durchsatz-von-spalte-waehlbar-zugang-als-zweiter-balken.md) (AK 8: Ø Zugang und Ø Abgang je Periode) gelten ab dieser Anforderung in der hier festgelegten Fassung: **je Kalendertag, unabhängig von der Auflösung**. Der Ø je Periode geht nicht verloren — er steht an der Ø-Linie im Diagramm. Alles andere an R00122 und R00167 (Zugang und Abgang rechnen, Von-Spalte, Balkenpaar, Tooltip, Tabelle, Zustände) bleibt wie abgenommen.

**Nicht dazu:** Netto als Linie oder Balken · Umbenennen von Zugang und Abgang · jede Änderung an der Rechnung von Zugang und Abgang (erstes Erreichen bleibt) · Burndown, Prognose, Fever Chart · Werktage · ein Schalter für die Zahlen · gespeicherte Auflösung.

Zahlt ein auf: [Vision](R00000-vision.md) — Berichte, die eine Frage ohne Rätseln beantworten; hier „Baut das Board ab oder staut es auf?“ (R00167 „Warum“) mit einer Zahl statt dreier Hover-Besuche. Widerspruch zur Vision: keiner. Optionen: entfallen, Begriff, Bezugsgröße und Darstellung sind vom product-owner entschieden (Z. 718–723, Alternativen dort: „Saldo“ lässt die Richtung offen, „Bestandsänderung“ hat das umgekehrte Vorzeichen und wäre falsch, weil Rückläufer und Entfernte fehlen).

### Domänenbezug

Glossar: Zugang und Abgang wie in [R00167](R00167-durchsatz-von-spalte-waehlbar-zugang-als-zweiter-balken.md) („erstmals erreicht“). Neuer Fachbegriff: **Netto** (Abgang − Zugang einer Periode oder des Zeitraums). Er zählt nur, was Zugang und Abgang des Durchsatzes zählen — Rückläufer und vom Board genommene Aufgaben nicht; er ist **nicht** die Änderung des offenen Bestands (die zeigt der Burndown). Aufnahme ins Glossar: `fachspezialist` über den Director (Vorschlag, kein Hindernis für den Bau).

## Akzeptanzkriterien

**Rechenbeispiel A (= R00167):** Board Backlog · Arbeit · Erledigt (ohne Phasen), Zielspalte nicht gewählt, drei Aufgaben, Zeitraum 02.11.–04.11.2026 (3 Tage), Auflösung „Tag“; Bewegungen und Zahlen je Tag wie in der Tabelle von R00167:

| Tag | Von = Backlog: Zugang · Abgang · Netto | Von = Arbeit: Zugang · Abgang · Netto |
|---|---|---|
| 02.11. | 3 · 0 · −3 | 0 · 0 · 0 |
| 03.11. | 0 · 0 · 0 | 2 · 0 · −2 |
| 04.11. | 0 · 1 · +1 | 0 · 1 · +1 |
| Summe | 3 · 1 · −2 | 2 · 1 · −1 |

Ø je Tag (Summe ÷ 3): Backlog Zugang 1,0, Abgang 0,3 (0,33), Netto −0,7 (−0,67); Arbeit Zugang 0,7 (0,67), Abgang 0,3, Netto −0,3 (−0,33).

**Rechenbeispiel B (= Grundbestand von R00122):** Board „fabrik“ mit Eingang · In Arbeit · Fertig, Von = erste Spalte (ohne Wahl), Bewegungen wie dort (Zugang durch Anlegen: #1 02.11., #2 03.11., #3 04.11., #4 09.11.; Abgang: #1 04.11., #2 05.11., #3 09.11., #4 11.11.). Zeitraum 05.11.–11.11. (7 Tage): Zugang 1 (#4), Abgang 3 (#2, #3, #4), Netto +2; Ø 1 ÷ 7 = 0,14 → 0,1, 3 ÷ 7 = 0,43 → 0,4, 2 ÷ 7 = 0,29 → +0,3. Zeitraum 02.11.–11.11. (10 Tage): Zugang 4, Abgang 4, Netto 0, Ø 0,4 · 0,4 · 0,0.

Die Zahlen sind gegen die Regel nachgerechnet (Tabelle oben, Rechenprobe des planer 2026-11-26); der entwickler legt sie vor dem Bau als Unit-Probe auf `durchsatz()` fest.

- [ ] **AK 1 Drei Ø je Tag** (Integration auf `durchsatz()`, E2E für den Wortlaut): Gegeben Beispiel A mit Von = Backlog und Auflösung Tag, wenn der Durchsatz geöffnet wird, dann steht in der Kennzahlenzeile „Zugang 3 · Ø 1,0 je Tag“, „Abgang 1 · Ø 0,3 je Tag“ und „Netto −2 · Ø −0,7 je Tag · staut auf“, dahinter „3 Perioden“. Gegeben dasselbe mit Von = Arbeit, dann „Zugang 2 · Ø 0,7 je Tag“, „Abgang 1 · Ø 0,3 je Tag“ und „Netto −1 · Ø −0,3 je Tag · staut auf“. Der Zusatz „ab „Arbeit““ am Zugang und „bis „B““ am Abgang bleibt wie heute.
- [ ] **AK 2 Die Auflösung ändert die Ø nicht** (Integration und E2E): Gegeben Beispiel A mit Von = Backlog, wenn die Auflösung auf „je Woche“ und auf „je Monat“ umgeschaltet wird, dann stehen dieselben drei Zeilen wie in AK 1 (Nenner bleibt 3 Kalendertage). Die Ø-Linien im Diagramm folgen der Auflösung und nennen ihre Einheit, je gezeigter Größe eine (Zugang, Abgang): in „je Woche“ „Ø Zugang 3,0 je Woche“ und „Ø Abgang 1,0 je Woche“, in „je Monat“ „Ø Zugang 3,0 je Monat“ und „Ø Abgang 1,0 je Monat“, in „je Tag“ „Ø Zugang 1,0 je Tag“ und „Ø Abgang 0,3 je Tag“.
- [ ] **AK 3 Vorzeichen und Wort** (Integration): Gegeben Beispiel B mit Zeitraum 05.11.–11.11., dann „Zugang 1 · Ø 0,1 je Tag“, „Abgang 3 · Ø 0,4 je Tag“ und „Netto +2 · Ø +0,3 je Tag · baut ab“. Gegeben B mit Zeitraum 02.11.–11.11., dann „Netto 0 · Ø 0,0 je Tag · ausgeglichen“. Das Minus ist U+2212, nicht der Bindestrich. Das Netto-Ø ist aus den Summen gerechnet, nicht aus den gerundeten Ø: Zugang 1 und Abgang 2 über 7 Tage ergeben „Netto +1 · Ø +0,1 je Tag · baut ab“ (1 ÷ 7 = 0,14), nicht +0,2 (0,3 − 0,1). Grenzfall: Ist die Summe +1 über 30 Tage (Ø 0,03), steht „Netto +1 · Ø 0,0 je Tag · baut ab“ — der auf 0,0 gerundete Ø hat kein Vorzeichen, Vorzeichen und Wort folgen der Summe.
- [ ] **AK 4 Zahlen an den Balken** (E2E, Darstellung): Gegeben Beispiel A mit Von = Backlog, Auflösung Tag, wenn der Durchsatz geöffnet wird (ohne Zeiger), dann steht über jedem der sechs Balken seine Zahl, je Tag Zugang links, Abgang rechts: 02.11. „3“ und „0“, 03.11. „0“ und „0“, 04.11. „0“ und „1“; auch die 0 steht, an der Grundlinie. Die Zahlen sind so groß wie die Achsenbeschriftung (Schriftgröße 11 wie `.diagramm .achse`), liegen außerhalb der Fläche des Balkens und haben in Hell und Dunkel mindestens 4,5:1 gegen `--kd-surface`.
- [ ] **AK 5 Viele Perioden: alle oder keine** (E2E): Gegeben Beispiel A bis über 90 Tage fortgeschrieben (90 Perioden je Tag) oder ein Zeitraum, in dem die breiteste Zahl nicht über ihren Balken passt, ohne die Nachbarzahl zu berühren (Abstand mindestens 2 Einheiten), wenn der Durchsatz geöffnet wird, dann steht keine einzige Zahl an den Balken, und unter der Fläche steht „Zu viele Perioden für Zahlen an den Balken — gröbere Auflösung wählen oder die Tabellenansicht öffnen.“ Tooltip, Tabellenansicht und Ø-Linien sind unverändert. Gegenprobe: Beim Umschalten auf „je Woche“ (wenige Perioden) stehen die Zahlen wieder, und der Satz ist fort. Einzelne Zahlen fehlen nie.
- [ ] **AK 6 Von nicht links vom Ziel** (Integration und E2E): Gegeben Beispiel A mit Von = Erledigt, wenn der Durchsatz geöffnet wird, dann gibt es keinen Zugang und keine Netto-Zeile, die Kennzahlenzeile nennt „Abgang 1 · Ø 0,3 je Tag“, die Zahlen stehen nur an den Abgangsbalken (0 · 0 · 1), und die Tabellenansicht hat keine Spalte „Netto“.
- [ ] **AK 7 Legende und Tabelle** (E2E): Gegeben Beispiel A mit Von = Backlog, wenn der Durchsatz geöffnet wird, dann steht in der Legende „Netto = Abgang − Zugang; Rückläufer und vom Board genommene Aufgaben zählen nicht — den offenen Bestand zeigt der Burndown.“ Die Tabellenansicht hat die Spalte „Netto“ mit Vorzeichen: 02.11. −3, 03.11. 0, 04.11. +1, Summe −2. Netto wird weder als Linie noch als Balken gezeichnet.
- [ ] **AK 8 Schmales Layout** (E2E): Gegeben Beispiel A mit Von = Backlog bei 375, 320 und 414 px, wenn der Durchsatz geöffnet wird, dann gilt `document.documentElement.scrollWidth ≤ clientWidth`, die drei Kennzahlzeilen brechen um statt hinauszuragen, und die Zahlen an den Balken haben die Größe der Achsenbeschriftung (oder entfallen alle nach AK 5, mit dem Satz).
- [ ] **AK 9 Bestandstests angepasst** (Gate): Die Specs `e2e/tests/r00122-durchsatz.spec.js` und `e2e/tests/r00167-von-spalte.spec.js` und die Unit-Tests von `durchsatz()` prüfen die Kennzahlenzeile in der Fassung dieser Anforderung (je Tag statt je Periode) und sind grün; die Vermerke in R00122 und R00167 stehen.

## Tests

Test zuerst, Ebene je Kriterium (Interactor je Interaction, E2E nur für Browser-Eigenes): AK 1 bis 3 und 6 als Unit-/Integrationstest auf `durchsatz()` mit den Beispielen A und B (Tage, Summen, Ø je Tag, Netto, Vorzeichen, Wort), danach der Wortlaut als E2E; AK 4, 5, 7 und 8 sind Darstellung und brauchen den Browser (Kontrast, Messung der Zahlbreite, `scrollWidth`). Mutanten, die rot werden müssen: Ø je Periode statt je Tag (AK 2: Wochen-Ø springt) · Netto als Differenz der gerundeten Ø (Zugang 1, Abgang 2 über 7 Tage prüft es: +0,1, nicht +0,2) · Bindestrich statt U+2212 · Vorzeichen bei auf 0,0 gerundetem Ø · Zahl nur an Balken > 0 (0 fehlt) · Einzelne Zahlen statt alle oder keine · Zahl im Balken statt darüber · Netto-Zeile ohne Zugang · Vorzeichen des Netto vertauscht (Zugang − Abgang). Rechnerisch ist der Tageszähler Kalendertage, nicht Perioden: ein Zeitraum über eine Zeitumstellung (Europe/Berlin, 25.10.–27.10.2026 = 3 Tage) ergibt 3, nicht 72 Stunden ÷ 24 gerundet.

## Implementierungshinweise

- Rechnung: `durchsatz()` (`web/berichte.js:451`) liefert zusätzlich Kalendertage des Zeitraums (aus `von` und `bis`), Ø je Tag für Zugang, Abgang und Netto sowie Netto je Periode und Summe; `anzahl`, `zugang`, `gesamt`, `durchschnitt` (je Periode, für die Ø-Linien) bleiben. Keine Änderung an `ankunftIm`, `erreicht`, Filtern.
- Anzeige: `vDurchsatzKennzahlen` (`web/ansicht.js:1569`), `vDurchsatzFlaeche` (`:1612`), `vDurchsatzLegende` (`:1583`), `vDurchsatzTabelle` (`:1644`), Balken `dusBalken`. Die zweite Ø-Linie (Zugang) und die Einheit an beiden Linien sind neu; heute steht nur „Ø Abgang“ ohne Einheit an der Linie und in der Legende.
- Oberfläche: Lage, Abstände und Farben nach `Dokumentation/Wireframes/D0006.dc.html#durchsatz-zahlen`; Material 3 vor dem Artboard nur dort, wo es nichts festlegt (`gemeinsam/regeln.md`, Gestaltung).
- Nicht hinein: ein Schalter für die Zahlen · eine Änderung am Datenformat oder an der API (der Durchsatz rechnet im Browser, nichts wird gespeichert).

## Warum löst diese Anforderung das Problem?

Auslöser: Der Betreiber öffnet den Durchsatz und will wissen, ob das Board gerade mehr erledigt, als hinzukommt. Heute muss er über jeden Balken fahren und die Zahlen im Kopf summieren (X); das Ø ist nur das der erledigten Aufgaben und springt beim Umschalten der Auflösung. Danach stehen die Zahlen an den Balken, und drei feste Ø je Tag sagen in einer Zeile, wie viel hinzukommt, wie viel erledigt wird und was unterm Strich bleibt, mit dem Wort „baut ab“ oder „staut auf“ (Y). Er liest die Antwort, ohne zu rechnen, zu hovern oder die Auflösung zu bedenken (Z).

## Offene Fragen

Keine, die den Bau aufhält. Zur Kenntnis (planer-Entscheidung, Empfehlung angenommen): „Ø-Linien“ (Mehrzahl) liest die Anforderung als je gezeigter Größe eine Linie, also eine zweite für den Zugang; die Zeichnung `#durchsatz-zahlen` zeigt sie laut PO-Auftrag („zwei Ø-Linien mit Einheit“). Platz für die längeren Beschriftungen am rechten Rand (heute 120 Einheiten) klärt die Zeichnung.

## Notizen

- Priorität: Hoch („zügig“, Betreiber). Karte #277, Labels `oberflaeche`, `text` (kein `datenformat`: Board-Datei und API bleiben unverändert).
- Zuschnitt (product-owner, Z. 723): eine Karte, eine neue Anforderung, eigene Interaction I0244 unter D0006 neben I0112 (R00122) und I0157 (R00167); die abgenommenen Anforderungen gehen nicht wieder auf.
- Der Tageszähler „Kalendertage des dargestellten Zeitraums“ ist der Zeitraum, den auch die Auflösung „Tag“ zeigt (Beginn bis heute bzw. gewählter Zeitraum, nie vor „Rechnen ab“ und nie vor der ersten Aufgabe); ein Zeitraum aus 3 Tagen ergibt den Nenner 3, unabhängig davon, ob als Woche oder Monat dargestellt.
