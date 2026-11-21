# ADR-0039: Reiter „Läufe“ — Lauf und Kosteneintrag werden in der Seite über die Kennung zusammengeführt, gelesen wird `GET …/transkripte` beim Öffnen und bei geänderter Menge der Kennungen, kein neuer Endpunkt

**Status**: Akzeptiert. Die Messprobe für 1000 Einträge (Punkt 7) ist der erste Test des Baus; im Nachtbetrieb wurde nichts gefahren. Offen sind nur Fragen der Darstellung an den PO und den gestalter. An der Technik ändern sie nichts.
**Datum**: 2026-11-21
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #217, Lauf 217-architekt-1)
**Kontext-Anforderung**: — (Karte #217, Scheibe D1 „Reiter Läufe“; die Anforderung schreibt der planer). Bezug: po-entscheidungen Z. 370, 384–388; ADR-0014, ADR-0028, ADR-0030, ADR-0032 Punkt 10, ADR-0036 mit Nachtrag „Gebaut“ G1–G9
**Erprobt durch**: — (am Code gelesen, Stand `665848b2`; nichts gefahren, Nachtbetrieb ohne Build und Lastprobe)

## Kontext

- **Belegt (Code)**:
  - `GET /api/aufgaben/{nr}` und das Live-Ereignis tragen `kosteneintraege: [{at, role, column, amount, currency, tokens?, kennung}]` und `transkripte: [{kennung, at, role, column, bytes}]`. Die Transkripte erscheinen dort nur mit lesbaren Einträgen und ohne Zugriff auf das Dateisystem (`src/modell/aufgabe.rs:418–422`, `src/web/mod.rs:848`).
  - `GET /api/aufgaben/{nr}/transkripte` liefert `{erfassen, boards_aus, transkripte: [{kennung?, at?, role?, column?, bytes?, zustand}]}`. Je Eintrag kostet das ein `symlink_metadata`, ein Öffnen und drei gelesene Byte. Ein formwidriger Eintrag hat `kennung: null` und den Zustand `unlesbar` (`src/dienst/transkripte.rs:254–271`).
  - Beide Kennungen entstehen in derselben Funktion `modell::kosteneintrag::kennung` (`src/modell/kosteneintrag.rs:115`). Sie liefert `role@JJJJ-MM-TTTHH:MM±HH:MM` mit vereinheitlichtem Zeitpunkt. Der Vergleich als Text ist deshalb genau, auch wenn ein Kosteneintrag von Hand mit `Z` statt Versatz geschrieben wurde. Die Spalte gehört nicht zur Kennung.
  - Doppelte Kennungen lehnt die API ab: bei Kosteneinträgen mit 409 (ADR-0028 Punkt 5), bei Transkripten mit 409 auch bei gleichem gefaltetem Dateinamen (`kennung_frei`, `src/dienst/transkripte.rs:429`). Eine von Hand bearbeitete Datei kann trotzdem Doppel tragen, weil das Lesen nicht prüft.
  - Muster der Reiter: `web/reiter.js` legt fest, welche Reiter es gibt und wann sie sichtbar sind, und zwar allein aus den Daten der Aufgabe. „Commits“ steht nur, wenn `commits` nicht leer ist. „Kosten“ zeichnet aus `a.kosteneintraege` (`web/kosten.js:294–307`, live, ohne eigenes Lesen). „Commits“ liest `GET …/commits` beim Öffnen und über „Neu lesen“. Ein Live-Ereignis liest dort nie (`web/app.js:946–999`, R00205 FA 2, PO Punkt 7). Der Grund ist Git im Arbeits-Repository. Eine späte Antwort wird verworfen (ADR-0014).
  - Das Zeichenmodell zeichnet das Fenster bei jedem Live-Ereignis mit geändertem Stand per `innerHTML` neu (A00009, ADR-0007).
- **Vermutet, nicht gemessen**: `GET …/transkripte` braucht für 1000 Einträge warm deutlich unter 200 ms. Das sind 1000 Mal Stat, Öffnen und 3 Byte, ohne Git. Die JSON-Antwort hat etwa 1000 × 150 B ≈ 150 KB und läuft nicht über das Antwortbudget (ADR-0032 N5.1 gilt für Diffs und Downloads).

Qualitätsziele (Szenarien mit Maß):

- **Q1 Richtig zusammengeführt**: Ein Lauf mit Transkript und Kosteneintrag gleicher Kennung steht als **eine** Zeile mit beiden Teilen da. Ein Teil ohne Partner geht nie verloren und wird nie einem fremden Partner zugeordnet.
- **Q2 Live**: Bucht die Factory den Kosteneintrag eines Laufs, ändert sich die Zeile im offenen Fenster in < 1 s (Lastprofil „Live“). Ein neu abgelegtes Transkript erscheint mit Zustand ebenfalls in < 1 s.
- **Q3 Begrenzt**: Eine Aufgabe mit 1000 Transkripten und 1000 Kosteneinträgen: `GET …/transkripte` warm p95 < 200 ms (Lastprofil lesend). Das Zeichnen des Reiters braucht im Browser < 100 ms je Neuzeichnen.

## Optionen

| Variante | Stärke | Schwäche |
|---|---|---|
| **S — in der Seite: reine Funktion über `GET …/transkripte` und `kosteneintraege` der Aufgabe** (gewählt) | kein Eingriff in den gerade gebauten Vertrag von #208; die Kosten kommen live über das Ereignis, ohne neues Lesen; im Node-Test prüfbar wie `web/commits.js`; eine Quelle für Geldbeträge (die Aufgabe), wie im Reiter „Kosten“ | zwei Quellen mit verschiedener Frische (Kosten live, Zustand gelesen); ein Agent bekommt die Zusammenführung nicht über die API |
| F — neues Lesefeld: `GET …/transkripte` trägt je Eintrag `kosten` und eine Liste `kosten_ohne_transkript` | eine Antwort, ein Stand; Agenten sehen die Zusammenführung | ändert den Vertrag von #208 (OpenAPI, Tests, Entwicklertest); `dienst::transkripte` hängt dann an der Kostenlogik (Währung, Betrag); dieselben Beträge kämen in zwei Antworten; ein gebuchter Kosteneintrag erscheint erst nach einem neuen Lesen |
| E — eigener Endpunkt `GET …/laeufe` als Lesemodell | sauber getrennt, in der API prüfbar | neue Route, Schema und Tests für eine reine Anzeige; kein Aufrufer außer der Seite (die Factory kennt ihre Läufe selbst); die Kosten veralten wie bei F |

Für das Lesen des Zustands:

| Variante | Stärke | Schwäche |
|---|---|---|
| L1 — wie „Commits“: beim Öffnen und über „Neu lesen“, nie live | ein Muster für beide Reiter | ein neues oder gelöschtes Transkript stimmt erst nach „Neu lesen“ mit dem Menü und den Kosten überein; verfehlt Q2 |
| **L2 — beim Öffnen, über „Neu lesen“ und einmal, wenn sich die Menge der Kennungen in `a.transkripte` gegenüber dem letzten Lesen ändert** (gewählt) | trifft Q2; liest nur bei Ablegen oder Löschen, also höchstens einmal je Lauf; ohne Git ist das Lesen billig | weicht von „Commits“ ab; braucht einen Vergleich der Kennungsmengen und die Regel „nur die neueste Antwort“ |
| L3 — bei jedem Live-Ereignis der offenen Aufgabe | einfach | liest auch bei jeder Bearbeitung, die keinen Lauf betrifft (Kommentar, Timer), bei 1000 Einträgen also 1000 Stat je Tastendruck eines Kollegen |

## Entscheidung

**Gewählt: S mit L2.** In Kauf genommen: Agenten bekommen die Zusammenführung nicht über die API, und der Reiter liest anders als „Commits“.

1. **Ort**: Ein reines Modul `web/laeufe.js` ist im Browser und in Node nutzbar, wie `web/commits.js`. Die Funktion `laeufe(transkripte, kosteneintraege)` bekommt die Einträge der letzten Antwort von `GET …/transkripte` und `a.kosteneintraege` der Aufgabe im aktuellen Stand. Sie liefert die Zeilen `{kennung, at, role, column, transkript: {bytes, zustand} | null, kosten: {amount, currency, tokens, column} | null}`. Am Server ändert sich nichts.
2. **Schlüssel**: die `kennung` des Servers, als Text verglichen. Die Seite bildet nie eine eigene Kennung. Die Spalte zählt beim Zuordnen nicht. Bei gleicher Kennung und verschiedener Spalte ist es derselbe Lauf, und die Zeile trägt beide Spalten (`column` aus dem Transkript, `kosten.column` aus dem Kosteneintrag). Ob und wie die Abweichung sichtbar wird, zeichnet der gestalter.
3. **Ohne Partner und Doppel**:
   - Ein Transkript ohne Kosteneintrag ist eine Zeile mit `kosten: null`.
   - Ein Kosteneintrag ohne Transkript ist eine Zeile mit `transkript: null`. Ob sie im Reiter erscheint, entscheidet der PO (Frage 1). Die Funktion liefert sie in jedem Fall, gefiltert wird beim Zeichnen.
   - Ein `unlesbar`er Eintrag ohne Kennung wird nie zugeordnet und ist eine eigene Zeile.
   - Bei Doppeln aus einer von Hand bearbeiteten Datei paart sich je Kennung das erste Transkript mit dem ersten Kosteneintrag, jeweils in der Reihenfolge der Datei. Jedes weitere Doppel steht allein. Nichts wird zusammengezählt oder verworfen.
4. **Zustand und Wörter**: Die Zustände der Antwort werden ohne eigene Deutung übernommen. `fehlt` heißt „liegt nicht auf diesem Rechner“ (Karte, ADR-0036 Regel 5). Ein Kosteneintrag ohne Transkript ist kein `fehlt`, denn es gibt keinen Eintrag, dessen Datei fehlen könnte. Er braucht ein eigenes Wort (Frage 1). Fremder Text (Rolle, Spalte) wird erst beim Zeichnen maskiert, Bidi-Steuerzeichen werden wie in `web/commits.js` (`ohneSteuerzeichen`) entfernt (ADR-0030).
5. **Sichtbarkeit des Reiters**: aus dem Stand der Aufgabe, ohne Lesen. Der Reiter steht, wenn `a.transkripte` nicht leer ist, so wie bei „Commits“ (`web/reiter.js`). Eine Aufgabe nur mit Kosteneinträgen hat keinen Reiter „Läufe“, sonst trüge fast jede Karte der Factory einen zweiten Reiter „Kosten“. Eine Aufgabe, deren Transkripte alle formwidrig sind, hat keinen Reiter, weil `a.transkripte` nur lesbare Einträge enthält. Der Eintrag bleibt in der Datei, und die API zeigt ihn (Inkauf). Wo der Reiter in der Reihe steht, legt der gestalter fest (Vorschlag: hinter „Commits“, vor „Verlauf“).
6. **Lesen (L2)**: `GET …/transkripte` beim Öffnen des Reiters und über „Neu lesen“. Dazu genau einmal, wenn die Menge der `kennung` in `a.transkripte` nach einem Live-Ereignis von der Menge der letzten Antwort abweicht. Bis die Antwort da ist, bleiben die alten Zeilen stehen, und der Statusbereich meldet das Laden. Ein Transkript aus dem Stand, das in der letzten Antwort noch fehlt, erscheint nicht vorab ohne Zustand. Eine späte Antwort wird verworfen, wenn inzwischen neu gelesen wurde, die Aufgabe gewechselt hat oder der Reiter nicht mehr gezeigt wird (Muster `commitsLesen`, ADR-0014). Kosten zeichnen bei jedem Ereignis neu und lösen kein Lesen aus. Verlässt man den Reiter, fällt sein Zustand weg. Ein Fehler beim Lesen zeigt die Meldung mit „Erneut versuchen“, die Kosten bleiben dabei sichtbar.
7. **Größe**: Bis 1000 Zeilen werden ohne Seiten und ohne Nachladen gezeichnet. Messprobe als erstes Kriterium des Baus: 1000 Transkripte und 1000 Kosteneinträge an einer Aufgabe, Release-Build. `GET …/transkripte` warm p95 < 200 ms, die Antwort < 250 KB. Der Reiter zeichnet in Chromium in < 100 ms je `render()`. Reißt eine der Grenzen, kommt die Frage zurück an den architekten (Abhilfe dann Zeichnen in Stücken oder Seiten, nicht ein Umbau am Server).
8. **Reihenfolge**: nach dem Zeitpunkt der Kennung über `zeitMs` (`web/zeiten.js`, wie im Reiter „Kosten“). Bei Gleichstand gilt die Reihenfolge der Datei, Transkripte vor Kosteneinträgen ohne Transkript. Zeilen ohne Kennung kommen ans Ende. Die Richtung (neueste oder älteste zuerst) wählt der gestalter. „Kosten“ zeigt die neuesten zuerst, „Commits“ die ältesten.
9. **Ziel einer Zeile**: In D1 hat eine Zeile kein Ziel. #210 (D2) gibt den Zeilen mit `vorhanden` ein Ziel auf die Laufansicht. Ein Herunterladen-Link ist nicht Teil von D1.

## Konsequenzen

**Positiv:** D1 ist eine reine Karte der Oberfläche ohne Änderung am Server, an OpenAPI oder am Format. Die Zusammenführung hängt an einer Funktion mit Node-Tests. Kosten sind live, der Zustand folgt Ablegen und Löschen. Es gibt keinen zweiten Weg für Geldbeträge.

**Negativ / Inkauf:**
- Ein Agent sieht die Zusammenführung nicht in einer Antwort. Er liest beides (`GET /api/aufgaben/{nr}`, `…/transkripte`) und vergleicht die `kennung`.
- „Läufe“ liest bei Live-Ereignissen, „Commits“ nicht. Der Unterschied hat einen Grund (kein Git) und steht in der Anforderung.
- Wird eine Datei auf der Platte gelöscht, ohne dass sich der Eintrag ändert, zeigt der Reiter das erst nach „Neu lesen“ (kein Ereignis, wie bei „Commits“).

**Durchsetzung:**
- Node-Test `laeufe()`: (a) gleiche Kennung bei verschiedener Spalte ergibt eine Zeile mit beiden Spalten. (b) Ein Transkript ohne Kosten ergibt `kosten: null`. (c) Kosten ohne Transkript ergeben `transkript: null` mit dem Zustand nicht `fehlt`. (d) `unlesbar` ohne Kennung wird nie zugeordnet. (e) Je zwei Doppel derselben Kennung ergeben genau zwei Paare in der Reihenfolge der Datei. (f) `role@…+01:00` und ein Kosteneintrag mit `Z` derselben Minute: verglichen wird nur die Kennung des Servers. Mutant „Spalte gehört zum Schlüssel“ macht (a) rot.
- E2E: Das Fenster steht offen auf „Läufe“. Ein Kosteneintrag wird per API gebucht, die Zeile zeigt den Betrag ohne neues `GET …/transkripte` (Zähler über `page.route`). Ein Transkript wird abgelegt, danach genau ein `GET …/transkripte`, und die Zeile erscheint mit Zustand. Ein Kommentar an der Aufgabe löst kein `GET …/transkripte` aus. Eine gehaltene Antwort, die nach dem Wechsel der Aufgabe kommt, zeichnet nichts.
- E2E: Ein Eintrag, dessen Datei entfernt wurde, zeigt „liegt nicht auf diesem Rechner“.
- Messprobe nach Punkt 7 mit dem Ergebnis im Bericht des entwicklertesters.

## Folgeentscheidungen / Aufgaben

- [ ] Anforderung über den planer (Punkte 1–9, Antworten des PO auf die Fragen).
- [ ] Offen für #210 (D2, nicht hier entschieden): eigene Adresse der Laufansicht (Muster ADR-0029/ADR-0033?). Wie die Kennung in die Adresse kommt: sie enthält `@`, `:`, `+` und Leerzeichen, also kodieren, und auflösen nur über den Vergleich mit Einträgen, nie als Pfad. Grenze für Zeichen oder Zeilen beim Entpacken von bis zu 10 MB gz im Browser (`DecompressionStream`, ADR-0032 Punkt 10), Lesen im Strom oder als Ganzes, Darstellung defekter Zeilen. Mit `zustand ≠ vorhanden` hat eine Zeile kein Ziel (Punkt 9).
- [ ] Offen für #218 (C2): ob der Reiter `erfassen: false` und `boards_aus` als Hinweis zeigt. Die Daten liefert die Antwort schon. Die Zeichnung für D1, D2 und C2 entsteht in einem Lauf des gestalters.
- [ ] Modell nach dem Bau nachführen (A00009).

## Quellen / Bezüge

- ADR-0036 Regel 4 und 5, Nachtrag G8 (Lesefelder)
- ADR-0028 Punkt 4 und 5 (Kennung, doppelte Kennung)
- ADR-0014 (nur die neueste Antwort), R00205 FA 2 (Lesen der „Commits“)
- po-entscheidungen Z. 370 (ein Transkript ohne Kosteneintrag ist erlaubt), Z. 384–388 (Zuschnitt D1)

## Nachtrag 2026-11-21 N1: Abhilfe für das Zeichnen — die Tabelle bleibt derselbe Knoten an ihrem Platz, solange ihr HTML gleich ist (Karte #217, R00219 AK 1, Frage des entwicklers nach Punkt 7)

**Status bleibt `Akzeptiert`.** Punkt 7 sah für eine gerissene Grenze „Zeichnen in Stücken oder Seiten“ vor. Gewählt wird stattdessen eine Insel wie `rv-insel` (ADR-0033 Punkt 4): Die Tabelle bleibt als Knoten an ihrem Platz. Stücke und Seiten entfallen. Am Server ändert sich nichts.

### Anlass (Messwerte des entwicklers, Zweig `karte/217`, Stand `42dbe787`)

- `GET …/transkripte`: p95 54–65 ms, grün.
- Zeichnen: Der größte `render()` je Lauf brauchte 161–172 ms bei 1.000 Zeilen und einer Last von 1,4–1,7. Die Grenze ist 100 ms. „Inhalt“ braucht 5–6,5 ms.
- Davon entfallen etwa 32 ms auf `laeufeAnsichtHtml`, vor allem auf das Geldformat. `laeufe()` braucht 1,5 ms. Der Rest geht in das Parsen, die Stile und das Layout der 1.000 Zeilen. Den Formatierer zwischenzuspeichern spart etwa 20 ms.

### Was AK 1 misst

Der Teil Zeichnen von AK 1 misst das **Neuzeichnen bei gleichen Daten**. Die Messprobe (`e2e/tests/r00219-ansicht-laeufe.spec.js`, `KD_MESSPROBE=1`) wartet, bis 1.000 Zeilen stehen. Danach ruft sie 20-mal `render()` mit erzwungenem Layout (`mitLayout < 100`). Dazwischen ändert sich weder die Antwort noch ein Kosteneintrag. Das erste Zeichnen nach dem Lesen misst AK 1 nicht. Im Betrieb ist das Neuzeichnen bei gleichen Daten auch der häufige Fall: `render()` zeichnet das ganze `#over` bei jedem Live-Ereignis des Boards neu, auch wenn ein Kollege an einer anderen Karte tippt.

### Probe (gebaut, im Scratchpad des architekten, nicht im Projekt)

Gemessen mit `web/laeufe.js` und den drei CSS-Dateien vom Stand `42dbe787`, 1.000 Zeilen, Chromium headless (Playwright des Projekts), Fenster 1280 × 900, 21.11. 08:27 Uhr, Last 0,9, `nice -n 10`. Je Variante 20 Durchläufe mit erzwungenem Layout, drei Läufe:

| Variante | größter Wert | Median |
|---|---|---|
| alles neu (`innerHTML`, heute) | 126–143 ms | 103–113 ms |
| nur der HTML-Text (`laeufeAnsichtHtml`) | 36–44 ms | 33–34 ms |
| alte Tabelle ab- und wieder eingehängt | 79–104 ms | 60–70 ms |
| **Tabelle bleibt im Dokument, nur die Geschwister werden getauscht** | **2–3 ms** | **1,8–1,9 ms** |
| erstes Zeichnen | 107–171 ms | — |

Ohne den Rest des Fensters liegt die Probe unter den Werten des entwicklers. Die Verhältnisse sind dieselben. Wichtig ist der dritte Befund: **Ab- und wieder Einhängen hilft nicht.** Ein ausgehängter Knoten verliert seine Layout-Boxen. Beim Einsetzen rechnet Chromium Stile und Layout der 1.000 Zeilen neu. Nur wenn der Knoten im Dokument bleibt, kostet das Neuzeichnen fast nichts.

### Varianten

| Variante | Neuzeichnen bei gleichen Daten | Schwäche | Wahl |
|---|---|---|---|
| A1 Stücke: `render()` zeichnet z. B. 200 Zeilen, der Rest folgt über `requestAnimationFrame` | `render()` < 100 ms | Bei jedem Ereignis fällt dieselbe Arbeit an, nur über mehrere Frames verteilt. Die Tabelle schrumpft und wächst wieder, die Leseposition springt. Bis das letzte Stück steht, finden Strg+F und Bildschirmleser nur einen Teil. Die Grenze hielte damit nur auf dem Papier. | verworfen |
| A2 Seiten | < 100 ms | Widerspricht R00219 (1.000 Zeilen am Stück, ohne Seiten) und der Zeichnung D0009 `#laeufe` („eine Liste ohne Seiten“). | verworfen |
| C Nur die sichtbaren Zeilen im DOM (Virtualisierung) | < 100 ms | Wie A2: nicht „am Stück“. Dazu fallen Strg+F, Textauswahl und die Tabellenrollen für Bildschirmleser weg. | verworfen |
| D Abgleich Zeile für Zeile mit Schlüssel | < 100 ms, auch bei einem neuen Kosteneintrag | Doppel derselben Kennung (Punkt 3) brauchen einen eigenen Schlüssel je Zeile. Die Reihenfolge muss mit abgeglichen werden. Das ist viel Code für einen Fall, den AK 1 nicht misst. | zurückgestellt |
| **B Insel: Die Tabelle bleibt derselbe Knoten an ihrem Platz, solange ihr HTML gleich ist** | ≈ Rest des Fensters + HTML-Text ≈ 40 ms, mit zwischengespeichertem Formatierer ≈ 20 ms | Das erste Zeichnen und das Zeichnen nach einer geänderten Zeile (neue Antwort, Kosteneintrag dieser Aufgabe) bleiben bei 110–170 ms. In `#over` kommt ein zweiter Ort mit gehaltenem Knoten dazu. | **gewählt** |

### Was der Nachtrag festlegt

1. **Insel.** Die Tabelle (`.lf-rahmen`) ist eine Insel nach dem Muster `rv-insel`. Ist ihr HTML-Text gleich dem des letzten Zeichnens derselben Aufgabe, bleibt der alte Knoten **im Dokument**. Er wird nicht eingesetzt, sondern nur seine Geschwister entlang des Pfads werden getauscht, wie bei `hauptbereichErsetzen` mit `pfadZu`, `geschwisterErsetzen` und `attributeAbgleichen`. Für `#over` heißt das: Ist die Insel da, wird `#over` nicht mehr als Ganzes über `innerHTML` geschrieben, sondern über denselben Weg mit `#over` als Wurzel. Die vorhandenen Funktionen werden dafür um die Wurzel als Parameter erweitert, keine zweite Fassung. Weicht der Pfad ab (andere Ansicht, Fehlerbild, andere Aufgabe), wird alles neu gezeichnet wie heute.
2. **Der Schlüssel ist der HTML-Text der Tabelle selbst.** Er ist kein Fingerabdruck aus ausgewählten Feldern. Die Seite baut den Text bei jedem `render()` (≈ 32 ms) und vergleicht ihn mit dem zuletzt eingesetzten Text. Der Text wird im Zustand der Ansicht gehalten (`S.ui.laeufe`), nicht als Attribut im DOM. So kann kein Eingang vergessen werden: Antwort, Kosten, `gelesen`, Zustandswort und Spalte der Kosten. Das ist dieselbe Regel wie `innerHTML !==` in `personenwahlAbgleichen` und `laeufeKnotenBehalten`. Ein eigener Schlüssel aus Feldern wäre billiger (≈ 8 ms), braucht aber eine eigene Probe gegen veraltete Zeilen. Er ist nicht nötig, weil 40 ms unter der Grenze liegen.
3. **Den Formatierer zwischenzuspeichern ist erlaubt, aber nicht verlangt.** Gemeint ist `Intl.NumberFormat` je Währung in `geld`. Das spart etwa 20 ms je Zeichnen, auch beim ersten Zeichnen. Ändert sich dadurch die Ausgabe von `geld` für einen Betrag, ist das ein Befund, denn es gibt nur einen Weg für Geldbeträge (Konsequenzen „Positiv“).
4. **Kopf und Fuß bleiben außerhalb der Insel.** Gemeint sind Zahl, Status, „Neu lesen“, Meldung und Hinweis. Sie werden wie bisher neu gezeichnet. `laeufeKnotenBehalten` bleibt für den Statusbereich zuständig (einzige Live-Region, AK 10). Die Insel enthält in D1 keine fokussierbaren Elemente (Punkt 9). Bekommt #210 (D2) Ziele an den Zeilen, gilt die Fokusregel der Review-Insel (ADR-0033 Punkt 4).
5. **Grenze für AK 1.** Die Grenze von 100 ms je `render()` gilt für das Neuzeichnen bei gleicher Tabelle. Das ist der Fall, den AK 1 misst. Erwartet werden etwa 40 ms bei der Last der Messung des entwicklers, ohne zwischengespeicherten Formatierer. Das ist eine Schätzung aus dessen Aufteilung (Rest des Fensters ≈ 6 ms + `laeufe()` 1,5 ms + Text 32 ms) und der Probe oben (Insel ≈ 2 ms). Gemessen wird sie erst mit der Messprobe von AK 1. Das erste Zeichnen und das Zeichnen nach einer geänderten Zeile bleiben bei 110–170 ms. Das ist Inkauf: Es passiert einmal je Öffnen, je Antwort und je Kosteneintrag dieser Aufgabe. Es wird beobachtet, nicht im Gate geprüft. Die Messprobe nennt den Wert des ersten Zeichnens zusätzlich im Bericht.
6. **Kein Ab- und Einhängen.** Eine Umsetzung, die die alte Tabelle aushängt und wieder einsetzt (etwa `replaceWith` nach `innerHTML`), ist ein Befund. Laut Probe spart sie nur das Parsen, nicht Stile und Layout (60–100 ms).

### Durchsetzung (ergänzt)

- **E2E, Insel hält:** „Läufe“ mit Zeilen ist offen. Die Tabelle bekommt eine Marke (`page.evaluate`, `el.__probe = 1`). Ein Kommentar an der Aufgabe und eine Änderung an einer anderen Karte lassen denselben Knoten stehen: Die Marke ist da, und es gibt kein `GET …/transkripte`. Ein per API gebuchter Kosteneintrag ersetzt den Knoten: Die Marke ist weg, und der neue Betrag steht in der Zeile. Mutant „Schlüssel immer gleich“ macht den zweiten Teil rot. Mutant „Insel nie gehalten“ macht den ersten Teil rot.
- **Messprobe AK 1** unverändert (20-mal `render()` mit Layout, jedes < 100 ms). Zusätzlich steht im Bericht das erste Zeichnen nach dem Lesen, als Beobachtung.
- **Review-Punkt:** Ein Neuzeichnen von `#over` als Ganzes, solange die Insel steht, oder ein Ab- und Einhängen der Tabelle ist ein Befund (Punkt 1, Punkt 6).

### Offen

- Die nicht-funktionale Anforderung „Performance“ in R00219 sagt „Zeichnen der Ansicht in Chromium < 100 ms je `render()`“, ohne Einschränkung. Das erste Zeichnen hält diese Grenze nicht. AK 1 misst nur das Neuzeichnen. Frage an den PO (siehe Bericht 217-architekt-2). Empfehlung: den Wortlaut der Anforderung an das anpassen, was AK 1 misst, und das erste Zeichnen als Beobachtung ohne Grenze im Gate führen.
- D (Abgleich Zeile für Zeile), falls das Zeichnen nach einem Kosteneintrag im Betrieb stört.
