---
id: R00238
status: Erledigt
datum: 2026-11-22
---

# R00238: Laufansicht — Tokens je Lauf und je Schritt, teuerste Schritte

## Beschreibung

Karte #263 (Vorrang, Auftrag des Betreibers: „Wenn die Daten schon da sind, sollten wir sie auch anzeigen.“). Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N3 (`3614a4ee`) mit N3.1 (`b516e4b1`), Punkte 1–5. Produkt `AI-Team/po-entscheidungen.md` Z. 572–580. Zeichnung D0009 `#laufansicht`, Bild 10 und 11 a–f (`456ca322`, freigegeben mit Änderung, Z. 578).

Wer einen Agentenlauf in der Laufansicht öffnet, sieht neben „Kosten“, wie viele Tokens der Lauf verbraucht hat. Jede Antwort des Agenten trägt an ihrer Zeile ihre **neuen Tokens** (Eingabe, Cache-Schreiben und Ausgabe), und aufgeklappt stehen die vier Einzelwerte. Die Liste „Teuerste Schritte“ springt zu den drei Antworten mit den meisten neuen Tokens und nennt, was davor stand. Alles wird aus den gelesenen Einträgen und aus der Karte gerechnet. Server, OpenAPI und Format bleiben unverändert. kanbanD rechnet aus Tokens nie einen Betrag und kennt kein Modell und keine Preistabelle (PO Z. 569).

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): Neben „Was hat am längsten gedauert?“ (R00234) beantwortet die Laufansicht jetzt auch „Was hat am meisten gekostet?“.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Kosteneintrag nennt heute nur den Betrag eines Laufs. Welcher Schritt ihn getrieben hat, sieht niemand. Die Zählung über 300 Läufe (N3 „Belegt“) zeigt: Die neuen Tokens einer Antwort finden die Schritte nach großen Ergebnissen (Median 9.859 Zeichen Ergebnistext davor). Genau dort lässt sich ein Lauf billiger machen, etwa mit einer schmaleren Leseanweisung.

## Funktionale Anforderungen

1. **Lesen** (N3 Punkt 1, N2 Punkt 1): `tokens` gilt nur an Einträgen von `agent`. Es ist ein Objekt mit den Schlüsseln `ein`, `aus`, `cache_lesen` und `cache_schreiben`, und jeder Wert ist eine ganze Zahl ≥ 0 (`Number.isSafeInteger`). Ein falscher Wert oder ein unbekannter Schlüssel fällt weg. Bleibt keiner übrig, fehlt das Feld. Ein fehlender Schlüssel zählt in jeder Summe als 0. Der Eintrag bleibt immer lesbar. Gezeichnet werden nur daraus gerechnete Zahlen.
2. **Zahlform** (PO Z. 573), gleich in Kopf, Zeile und Liste, immer abgerundet: unter 10.000 die volle Zahl mit Tausenderpunkt („8.412“), ab 10.000 „<n> Tsd.“ („35 Tsd.“), ab 1.000.000 „<x,y> Mio.“ mit einer Nachkommastelle („4,3 Mio.“), die als 0 entfällt („1 Mio.“). Die vier Einzelwerte stehen voll mit Tausenderpunkt wie im Kostenbericht (`web/ansicht.js:319`), ein fehlender Schlüssel als 0. Der Kostenbericht bleibt unverändert. **Lesefassung** (UX S1): Jede gekürzte Zahl steht sichtbar als Kurzform mit `aria-hidden` und daneben in einem Element der Klasse `vh` ausgeschrieben („35 Tausend“, „1 Million“, „1,2 Millionen“, „1.234,5 Millionen“; „mindestens“ bleibt davor, „neue Tokens“ folgt unverändert). Die Funktion dafür heißt `tokenLesetext`. Volle Zahlen (unter 10.000, aufgeklappte Einzelwerte) stehen nur einmal. Die Lesefassung ist Technik für Bildschirmleser, sichtbar ändert sich kein Wortlaut aus Z. 572–580.
3. **Neue Tokens** (N3 Punkt 4): `ein + cache_schreiben + aus` einer Antwort. Text „<Zahl> neue Tokens“, in der Einzahl „1 neues Token“ (Z. 574).
4. **Kopf** (N3 Punkt 2, Z. 574, 576): Die Kennzahl „Tokens“ steht rechts neben „Kosten“. Ihr Wert ist die Summe aller vier Werte.
   - Quelle ist `tokens` des Kosteneintrags dieser Kennung, live wie „Kosten“, auch während das Transkript gelesen wird und wenn es fehlt. Weichen Kosteneintrag und Transkript ab, gilt der Kosteneintrag, ohne Hinweis.
   - Fehlt er oder sein `tokens`, und trägt mindestens ein gelesener Eintrag `tokens`, gilt die Summe über die gelesenen Einträge. Darunter steht sichtbar und gedämpft „aus dem Transkript gezählt“. Ist die Grenze erreicht, steht „mindestens <Zahl>“ und darunter „aus dem Transkript gezählt bis zur Grenze des Transkripts“.
   - Fehlt beides, steht „–“ mit dem Lesetext „Tokens unbekannt“, solange gelesen wird „wird gelesen“. Das Zeichen ist `aria-hidden`, der Lesetext steht in einem Element der Klasse `vh`, nie als `aria-label` an einem `span` (R00234 FA 4).
5. **Antwort** (N3 Punkt 3): Eine Antwort beginnt an einem Eintrag von `agent` mit `tokens` und umfasst die unmittelbar folgenden Einträge von `agent` ohne `tokens`. Sie endet am nächsten Eintrag eines anderen `wer` oder am nächsten Eintrag mit `tokens`.
6. **Zeile** (N3 Punkt 3, Z. 576 (a), (b)): Die Zeile des Eintrags, der `tokens` trägt, zeigt „<Zahl> neue Tokens“, unauffällig wie die Dauer und links neben ihr. Ab 981 px steht die Angabe links neben der Dauer, bei 641–980 px unter der Dauer, unter 641 px in der ersten Zeile zwischen Name und Dauer (UX S5). Im DOM steht die Dauer vor der Token-Angabe, wie beide bei 641–980 px übereinanderstehen (UX K4, WCAG 1.3.2). An einer Nachricht von Agent steht sie rechts in deren Kopfzeile. Weitere Zeilen von `agent` derselben Antwort zeigen „–“ mit dem Lesetext „Tokens in der Antwort darüber gezählt“. Zeilen von `agent` ohne Antwort mit `tokens` zeigen „–“ mit „Tokens unbekannt“. Das gilt auch für jede Zeile eines Transkripts ganz ohne `tokens`. Nachrichten von `mensch`, allein stehende Ergebnisse sowie Denk- und Wartezeilen tragen keine Angabe. Aufgeklappt steht vor „Aufruf“ die Überschrift „Tokens“ (Z. 578) mit „Eingabe <n> · Cache-Schreiben <n> · Ausgabe <n> · Cache-Lesen <n>“.
7. **Zeile „Tokens“ unter einer Nachricht von Agent** (N3.1, Z. 579): Trägt die Nachricht `tokens`, steht unter ihrem Text immer eine gedämpfte Zeile „Tokens“ mit den vier Werten in der Form aus FA 6, ohne Aufklappen. Das „·“ ist `aria-hidden`, im `vh`-Element steht dafür ein Komma (UX S6). Die Schrift ist mindestens 11 px groß. Nachrichten ohne eigenes `tokens` bleiben unverändert.
8. **„Teuerste Schritte“** (N3 Punkt 4, Z. 575): Die drei Antworten mit den meisten neuen Tokens stehen absteigend, bei Gleichstand die frühere zuerst, unter „Längste Schritte“ in derselben linken Spalte. Unter dem Titel steht in einem Absatz, gedämpft und vorgelesen: „Gezählt sind die neuen Tokens je Antwort: Eingabe, Cache-Schreiben und Ausgabe. Den schon vorhandenen Kontext (Cache-Lesen) trägt jede Antwort, er zählt hier nicht.“ Der Absatz gehört zum Abschnitt `section.lv-gl`, und die `<ol>` trägt `aria-describedby` auf ihn, damit der Satz beim Tab-Sprung zum ersten Knopf vorgelesen wird (UX S2). Der Wortlaut bleibt der des PO. Ein Eintrag ist mit dem ersten Aufruf der Antwort beschriftet (`schrittText`), ohne Aufruf mit „Nachricht von Agent“. Sein Wert ist „<Zahl> neue Tokens“. Der zugängliche Name des Knopfes lautet `<Beschriftung>, <Wert in Lesefassung>, <nach …>`, durch Kommata getrennt, Teile ohne Anlass entfallen (UX S3). Die Anordnung im Bild bleibt. Lange Beschriftungen und „nach …“ umbrechen wie `.was` (`overflow-wrap:anywhere`) und werden nicht abgeschnitten (UX K3). Darunter steht gedämpft:
   - „nach <Schritt>“, wenn das Ergebnis eines Schritts unmittelbar vor der Antwort stand (`nachNr`);
   - sonst „nach <Dauer> Warten“, wenn seit der vorigen Antwort eine Wartezeile gezeichnet ist (`warten_davor`, die letzte davon, Dauer in der Form der Wartezeile; N3.1, Z. 580);
   - sonst nichts.
   Jeder Eintrag ist ein Knopf mit der Kennung `lv-teu-<i>` und `data-act`. Er springt zur Zeile, die die Tokens trägt (der Träger, bei „Read regeln.md“ also die Nachricht davor, die die Tokens der Antwort trägt; die Aufrufzeile verweist mit „Tokens in der Antwort darüber gezählt“ darauf), und gibt ihr den Fokus wie „Längste Schritte“ (R00234 FA 10). Die Zeile ist danach `document.activeElement`. Ohne `tokens` im Transkript entfällt die Liste. Beide Listen entstehen aus einer Listenfunktion (N3 Punkt 6).
9. **Einmal rechnen** (N3 Punkt 5): Die Auswertung bleibt ein Durchlauf (O(n)) je erfolgreichem Lesen. Die drei teuersten werden über eine Liste fester Länge 3 bestimmt, ohne alle Antworten zu sortieren. Ein Live-Ereignis zeichnet die Kennzahl „Tokens“ aus der Karte neu, ohne die Auswertung neu zu rechnen.

## Nicht-funktionale Anforderungen

- **Leistung** (N3 Punkt 5): 20.000 Zeilen mit `tokens` an jedem Eintrag von `agent` bleiben von der Antwort bis zum Bild unter 300 ms (Q5 aus N1 Punkt 7). Das ist eine Beobachtung im Bericht, kein Gate und ein Tag-Kriterium (8–21 Uhr, Last ≤ 2, `nice -n 10`).
- **Sicherheit** (Review-Punkt N3): Werte aus `tokens` gehen nur als Zahl ins HTML. Kein Preis, kein Modell, kein Betrag aus Tokens.
- **Zugänglichkeit**: Jedes „–“ hat einen Lesetext. Die Kennzahl live sagt nichts zusätzlich an (R00234 AK 10).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00234: gz-Dateien erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/1/transkripte` ab, Kosten über `POST /api/aufgaben/1/kosteneintraege`). Mensch `sh`, Browser headless (Chromium) in `Europe/Berlin`, Board `fabrik` mit `record-transcripts: true`, Aufgabe #1:

| Lauf | Kennung | Transkript | Kosteneintrag |
|---|---|---|---|
| T8 | `planer@2026-11-22T10:00+01:00` | die 12 Einträge unten | keiner (in AK 9 gebucht: 0,95 USD, `tokens` 1.234.567) |
| T9 | `entwickler@2026-11-22T08:00+01:00` | 20.001 Zeilen wie T3 aus R00234; jeder Aufruf (ungerade Zeile) trägt `tokens` `{"aus": 10}` | keiner |
| T4 | wie R00234 (ohne `tokens`) | — | keiner |
| T5 | wie R00234 (Datei gelöscht → `fehlt`) | — | 0,42 USD mit `tokens` 52.000 |

**T8** (Zeit 2026-11-22, Versatz +01:00; `tokens` als `ein / aus / cache_lesen / cache_schreiben`):

| Nr | art · wer | zeit | `tokens` | Inhalt |
|---|---|---|---|---|
| 1 | nachricht · mensch | 10:00:00 | — | „Projekt: kanbanD · Karte: #263“ (Auftrag) |
| 2 | nachricht · agent | 10:00:05 | 3 / 120 / 0 / 18.000 | „Ich lese zuerst die Regeln.“ |
| 3 | aufruf · agent `Read` | 10:00:06 | — | `{"file_path":"regeln.md"}` |
| 4 | ergebnis · werkzeug | 10:00:07 | — | „1→# Regeln“ |
| 5 | aufruf · agent `Bash` | 10:00:20 | 1 / 300 / 18.000 / 34.800 | `{"command":"grep -n tokens web/lauf.js"}` |
| 6 | ergebnis · werkzeug | 10:00:21 | — | „77: tokens“ |
| 7 | aufruf · agent `Bash` | 10:00:30 | 1 / 50 / 52.800 / 400 | `{"command":"git status --short"}` |
| 8 | ergebnis · werkzeug | 10:00:31 | — | „ M web/lauf.js“ |
| 9 | aufruf · agent `Bash` | 10:00:35 | `{"ein": -1, "aus": 1.5}` (fällt weg) | `{"command":"ls"}` |
| 10 | ergebnis · werkzeug | 10:00:36 | — | „a.md“ |
| 11 | nachricht · mensch | 10:05:53 | — | „Bitte weiter.“ |
| 12 | nachricht · agent | 10:05:55 | 2 / 1.500 / 53.200 / 60.000 | „Fertig.“, „Ergebnis: bestanden“, „Commits: keine“ |

**Rechenbeispiel T8** (geprobt gegen ein Modell der Regeln, `gemeinsam/scratchpad/plan-263/modell.js` der Factory): Antworten 2 (mit 3), 5, 7, 12; Nr 9 ist keine Antwort. Summe aller vier: 18.123 + 53.101 + 53.251 + 114.702 = **239.177 → „239 Tsd.“**. Neue Tokens: 2 → 18.123, 5 → 35.101, 7 → 451, 12 → 61.502. Rangfolge 12, 5, 2. Nr 7 hat die zweitgrößte Summe (53.251), aber nur 451 neue Tokens, und steht nicht in der Liste. Wartezeile vor Nr 11: 10:00:36 → 10:05:53 = 317 s = „5 min 17 s wartet“. Nr 12: `nachNr` null (davor Nr 11 von `mensch`), `warten_davor` 317.000. Nr 5: `nachNr` 3 (Ergebnis 4 direkt davor). Nr 2: beide `null`.

### Lesen und Zahlform

- [x] **AK 1 Zahlform:** In Node liefert die gekürzte Form 0 → „0“, 9.999 → „9.999“, 10.000 → „10 Tsd.“, 10.999 → „10 Tsd.“, 999.999 → „999 Tsd.“, 1.000.000 → „1 Mio.“, 1.099.999 → „1 Mio.“, 1.100.000 → „1,1 Mio.“, 4.399.999 → „4,3 Mio.“, 55.083.706 → „55 Mio.“ und 1.234.567.890 → „1.234,5 Mio.“. Die neuen Tokens lesen sich bei 1 „1 neues Token“, bei 0 „0 neue Tokens“ und bei 61.502 „61 Tsd. neue Tokens“. Die volle Form liefert 34.800 → „34.800“. `tokenLesetext` liefert 9.999 → „9.999“, 10.000 → „10 Tausend“, 1.000.000 → „1 Million“, 1.099.999 → „1 Million“, 1.100.000 → „1,1 Millionen“, 4.399.999 → „4,3 Millionen“ und 1.234.567.890 → „1.234,5 Millionen“.
- [x] **AK 2 Lesen und Altbestand:** In Node wird `tokens` an einem Eintrag von `agent` gelesen, `{"aus": 10}` ergibt 10 neue Tokens und Eingabe 0. Es fällt weg an einem Ergebnis und an einer Nachricht von `mensch`, als Zahl, als Liste, mit `-1`, `1.5`, `2**53` und mit einem unbekannten Schlüssel allein. Der Eintrag bleibt in jedem Fall lesbar. Ein Transkript ohne `tokens` (T1 aus R00234) ergibt dieselbe Auswertung wie vor der Karte, bis auf `tokens: null` und eine leere Liste der teuersten (`deepStrictEqual` gegen Literale, aufgenommen vor der ersten Änderung an `web/lauf.js`).

### Kopf

- [x] **AK 3 Kennzahl „Tokens“ nach Quelle:** Gegeben T8 ohne Kosteneintrag, dann steht rechts neben „Kosten“ die Kennzahl „Tokens“ mit „239 Tsd.“ und darunter sichtbar „aus dem Transkript gezählt“. Gegeben T8 mit einem Kosteneintrag dieser Kennung über 0,95 USD und `tokens` 1.234.567, dann steht „1,2 Mio.“ ohne diesen Satz, auch solange die Antwort des Transkripts gehalten wird. Gegeben ein Kosteneintrag ohne `tokens`, dann gilt wieder „239 Tsd.“ mit dem Satz. Gegeben T9, dann steht „mindestens 100 Tsd.“ (10.000 Aufrufe × 10 bis zur Grenze) und darunter „aus dem Transkript gezählt bis zur Grenze des Transkripts“. Gegeben T5, dann steht „52 Tsd.“. Gegeben T4, dann steht „–“, und der `ariaSnapshot()` der Kennzahlen liest „Tokens unbekannt“ ohne das Zeichen „–“ (steht „Tokens“ schon als Beschriftung der Kennzahl, ist der Wortlaut des echten Snapshots dort wörtlich festgehalten, UX K1). Gegeben T8 ohne Kosteneintrag, dann liest der Snapshot „239 Tausend“ und nicht „Tsd.“. Gegeben T8 ohne Kosteneintrag mit gehaltener Antwort, dann liest er „wird gelesen“.

### Zeilen

- [x] **AK 4 Neue Tokens je Zeile:** Gegeben T8, dann zeigt Nr 2 „18 Tsd. neue Tokens“ in der Kopfzeile der Nachricht, Nr 5 „35 Tsd. neue Tokens“ (der `ariaSnapshot()` der Zeile enthält „35 Tausend neue Tokens“ und nicht „Tsd.“), Nr 7 „451 neue Tokens“ und Nr 12 „61 Tsd. neue Tokens“. Nr 3 zeigt „–“ und liest sich „Tokens in der Antwort darüber gezählt“. Nr 9 zeigt „–“ und liest sich „Tokens unbekannt“. Nr 1, Nr 11 und die Wartezeile vor Nr 11 tragen keine Angabe. Aufgeklappt zeigt Nr 5 vor „Aufruf“ die Überschrift „Tokens“ mit „Eingabe 1 · Cache-Schreiben 34.800 · Ausgabe 300 · Cache-Lesen 18.000“. Gegeben T1 aus R00234 (ohne `tokens`), dann zeigt jede Zeile von `agent` „–“ mit „Tokens unbekannt“, und es gibt keine Liste „Teuerste Schritte“. In Node gilt: Zwei Antworten mit `tokens` ohne Eintrag eines anderen `wer` dazwischen sind zwei Antworten. Bei einer Antwort aus Nachricht und zwei parallelen Aufrufen stehen die Tokens an der Nachricht und beide Aufrufe zeigen den Verweis. Die neuen Tokens aller Antworten von T8 ergeben zusammen 115.177.
- [x] **AK 5 Zeile „Tokens“ unter einer Nachricht von Agent** (PO Z. 580, Kriterium 1): Unter einer Nachricht von Agent mit `tokens` steht gedämpft „Tokens“ mit den vier Werten. Gegeben T8, dann steht unter dem Text von Nr 2 ohne Aufklappen „Tokens“ mit „Eingabe 3 · Cache-Schreiben 18.000 · Ausgabe 120 · Cache-Lesen 0“ und unter Nr 12 „Tokens“ mit „Eingabe 2 · Cache-Schreiben 60.000 · Ausgabe 1.500 · Cache-Lesen 53.200“. Die Zeile liegt unter dem Text (`getBoundingClientRect().top` der Zeile ≥ `bottom` des Texts). Der `ariaSnapshot()` der Zeile von Nr 2 liest „Tokens Eingabe 3, Cache-Schreiben 18.000, Ausgabe 120, Cache-Lesen 0“ (Komma statt „·“, das „·“ ist `aria-hidden`). Die Schrift ist ≥ 11 px und ≥ 4,5:1 in beiden Themen gegen die Fläche der Nachricht, nicht gegen das Seitenweiß. Nr 1 und Nr 11 haben keine solche Zeile. Ebenso hat sie eine Nachricht von `agent` ohne eigenes `tokens` nicht, die als zweite in einer Antwort steht (Node).

### Teuerste Schritte

- [x] **AK 6 Rangfolge, Erklärsatz und Anlass:** Gegeben T8, dann steht unter „Längste Schritte“ die Liste „Teuerste Schritte“ mit dem Erklärsatz aus FA 8 wörtlich, sichtbar und im `ariaSnapshot()` des Abschnitts `section.lv-gl`. Die `<ol>` trägt `aria-describedby`, das auf ein Element zeigt, dessen `textContent` der Satz ist (`document.querySelector('.lv-teu').getAttribute('aria-describedby')`). Der Absatz steht ≥ 4,5:1 gegen seine Fläche in beiden Themen. Darunter folgen der Reihe nach (1) „Nachricht von Agent“, „61 Tsd. neue Tokens“, (2) „Bash grep -n tokens web/lauf.js“, darunter „nach Read regeln.md“, „35 Tsd. neue Tokens“, und (3) „Read regeln.md“ ohne „nach …“, „18 Tsd. neue Tokens“. Nr 7 steht nicht darin. Gegeben T9, dann sind es die Antworten der Zeilen 1, 3 und 5, je „10 neue Tokens“ (Gleichstand, die frühere zuerst).
- [x] **AK 7 „nach <Dauer> Warten“** (PO Z. 580, Kriterium 2): Ein Eintrag in „Teuerste Schritte“ ohne `nachNr`, vor dem seit der vorigen Antwort eine Wartezeile gezeichnet ist, zeigt „nach <Dauer> Warten“. Gegeben T8, dann steht unter Eintrag (1) gedämpft „nach 5 min 17 s Warten“, dieselbe Dauer wie die Wartezeile „5 min 17 s wartet“ vor Nr 11. In Node gilt für `warten_davor`: Wartelücke 5.000 ms ergibt 5.000, 4.900 ms ergibt `null`. Bei zwei Wartezeilen zwischen zwei Antworten gilt die letzte. Bei gesetztem `nachNr` ist es `null`, und der Eintrag zeigt „nach <Schritt>“. Eine Wartezeile vor einer Antwort gilt nicht mehr für die nächste Antwort. Eine Lücke ohne gültige `zeit` setzt nichts.
- [x] **AK 8 Springen:** Gegeben T8, wenn `sh` den ersten Eintrag von „Teuerste Schritte“ mit Klick, Enter oder Leertaste wählt, dann hat die Zeile von Nr 12 den Fokus (`document.activeElement.id` ist `lv-s12`, die Trägerzeile). Die Knöpfe haben den zugänglichen Namen „Nachricht von Agent, 61 Tausend neue Tokens, nach 5 min 17 s Warten“ (`lv-teu-1`) und „Bash grep -n tokens web/lauf.js, 35 Tausend neue Tokens, nach Read regeln.md“ (`lv-teu-2`), Rolle `button`, per `ariaSnapshot()`. Wählt `sh` den dritten Eintrag „Read regeln.md“, dann ist `document.activeElement.id` `lv-s2` (die Nachricht, die die Tokens trägt), und `lv-s3` zeigt „–“ mit dem Lesetext „Tokens in der Antwort darüber gezählt“. Die Knöpfe tragen die Kennungen `lv-teu-1` bis `lv-teu-3`, kein `href`, und `lv-top-1` bis `lv-top-3` gibt es weiter genau einmal. Bei 320, 641 und 1280 px liegt der obere Rand der Zeile unter dem Seitenkopf und im Fenster. `location.hash` und `history.length` bleiben gleich, und der Statusbereich ändert sich nicht (`MutationObserver`, Zähler 0).

### Live und Darstellung

- [x] **AK 9 Live:** Gegeben die Laufansicht von T8 ohne Kosteneintrag, mit der Marke `el.__probe = 1` an der Insel und aufgeklapptem Nr 5, wenn ein Kosteneintrag `planer` 2026-11-22T10:00+01:00 über 0,95 USD mit `tokens` 1.234.567 gebucht wird, dann zeigt „Tokens“ „1,2 Mio.“ ohne „aus dem Transkript gezählt“ und „Kosten“ „0,95 $“. Es gibt kein neues `GET …/transkripte/…`, die Insel trägt die Marke noch, Nr 5 ist noch aufgeklappt, und `laufAuswerten` lief genau einmal (Zähler; `grep -c "laufAuswerten(" web/app.js` bleibt 1). Kein Text im Statusbereich und in keiner `aria-live`-Region ändert sich, und der Fokus bleibt.
- [x] **AK 10 Breite, Themen, Zugänglichkeit:** Gegeben T8, dann gilt bei 320, 641, 980 und 1280 px, hell und dunkel, `scrollWidth ≤ clientWidth` an Dokument, Bildlaufbehälter und jeder Zeile. Bei 641 und 980 px liegt die Token-Angabe von Nr 5 unter ihrer Dauer (`top` der Angabe ≥ `bottom` der Dauer), ab 981 px (geprobt bei 981, 1100 und 1280) links neben ihr in derselben Zeile, bei 320 px in der ersten Zeile zwischen Name und Dauer. Lage wird mit `getBoundingClientRect` gemessen, nie mit `innerText`. Token-Angabe, Erklärsatz, „nach …“ und die Zeile „Tokens“ stehen ≥ 4,5:1 gegen ihre Fläche. Die Knöpfe von „Teuerste Schritte“ sind bei grobem Zeiger ≥ 48 px und bei feinem ≥ 24 px hoch. Jedes „–“ einer Token-Angabe ist `aria-hidden`, und keine Token-Angabe trägt ein `aria-label`. Zusätzlich bei 981, 1100 und 320 px mit einer Zeile, die „999 Tsd. neue Tokens“ und die Dauer „59 min 59 s“ trägt: `scrollWidth ≤ clientWidth`, die Angabe bricht nicht in drei Zeilen (Höhe ≤ 2 × Zeilenhöhe), und Name, Angabe und Dauer überlappen sich nicht (`getBoundingClientRect`). An den Knöpfen von „Teuerste Schritte“ ist `scrollWidth ≤ clientWidth` und der Text nicht abgeschnitten, auch mit einem langen Pfad als Beschriftung.

## Betroffene Verzeichnisstruktur

- `web/lauf.js`: Lesen, Zahlform, Auswertung und Zeichnen, rein, in Browser und Node.
- `web/kd-app.css`: Spalte `.tk`, Zeile „Tokens“, Liste `.lv-teu`, mit Tokens aus `web/kd-tokens.css`, keine neue Farbe.
- `web/app.js`: nur die Kosten der Karte mit `tokens` an `laufKopfHtml`; hier wird nichts gerechnet.
- Tests: `e2e/einheit/lauf.test.js`, `lauf-auswerten.test.js`, `lauf-zeichnen.test.js` (Node), `e2e/tests/r00238-laufansicht-tokens.spec.js` (E2E), Hilfen aus `e2e/tests/laufansicht-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **Lesen** (B1237) und **Zahlform** (B1238), parallel.
2. **Auswertung** (B1239): Zusätzlich `tokens` (Summe oder `null`), je Antwort `{nr, tokens, neu, nachNr, warten_davor}`, die Zuordnung jeder Agentenzeile (Träger, Folgezeile, ohne Angabe) und `teuer3`. Alles im selben Durchlauf mit den Variablen laufende Antwort, letzte Ergebniszeile und `wartenSeit`.
3. **Zeichnen** (B1240 Kopf, B1241 Zeilen, B1242 Liste), parallel nach B1239.
4. **Messen** (B1243), danach **Live, Mutanten, Gate** (B1244).

### Grobentwurf

- `tokenKurz(n)`, `tokenVoll(n)`, `neueTokensText(n)` (rein) — FA 2, FA 3.
- `laufAuswerten(zeilen, grenze)` — wie bisher, zusätzlich die Felder aus Schritt 2.
- `laufKopfHtml({zustand, auswertung, kosten}, esc)` — `kosten.tokens` kommt schon über `kostenteil` (`web/laeufe.js:43`).
- `schrittHtml`, `nachrichtHtml` — Angabe aus der Zuordnung der Auswertung, die vier Werte aus dem gelesenen Eintrag.
- `laufTopHtml` wird zur Listenfunktion (Titel, Kennungspräfix, Einträge, Wertform), aus der „Längste Schritte“ und „Teuerste Schritte“ entstehen. #253 setzt später die Filter unter diese Liste, #261 die Beschriftung mit der Absicht.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node):** die Proben aus ADR-0041 N3 und N3.1 „Durchsetzung“ wörtlich, AK 1, 2, 4, 5, 7 und T8 als Ganzes gegen das Rechenbeispiel.
- **E2E (Chromium, headless):** AK 3–10 mit T8, T9, T4, T5 und T1 aus R00234. Antworten werden per `page.route` gehalten, Verneinungen stehen erst nach einem sichtbaren Signal.
- **Mutanten** (eigene Kopie, nicht im Worktree), je von einem benannten Test getötet:
  - m1 Rangfolge nach der Summe aller vier → AK 6 rot (Nr 7 statt Nr 2)
  - m2 Zahlform gerundet statt abgerundet → AK 1 rot (10.999 „11 Tsd.“)
  - m3 Transkript vor dem Kosteneintrag → AK 3 rot („239 Tsd.“ statt „1,2 Mio.“)
  - m4 Antwort endet nicht am Eintrag von `werkzeug` → AK 4 rot (Nr 9 „–“ mit falschem Lesetext)
  - m5 `tokens` auch an Ergebnis und `mensch` übernommen → AK 2 rot
  - m6 `wartenSeit` nach Beginn einer Antwort nicht zurückgesetzt → AK 7 rot
  - m7 Sprung über `href="#lv-s…"` oder Kennung `lv-top-<i>` in beiden Listen → AK 8 rot
  - m8 Auswertung bei Live neu gerechnet → AK 9 rot
  - m9 Zeile „Tokens“ unter der Nachricht nur aufgeklappt → AK 5 rot
  - m10 „nach <Dauer> Warten“ auch bei gesetztem `nachNr` → AK 7 rot
- **Regression:** Die Tests von R00221, R00234 und R00237 bleiben ohne geänderte Erwartung, außer `tokens: null` in den Erwartungen von `eintragPruefen` und `laufAuswerten`.

## Abhängigkeiten

- Abhängig von: [R00234](R00234-laufansicht-ergebnis-und-dauer.md) (I0224, Kopf, Dauer, „Längste Schritte“, Wartezeilen); [R00237](R00237-behebung-paaren-ueber-die-kennung.md) (I0227, Paaren über die Kennung, `eintragPruefen` mit `id`/`zu`).
- Blockiert: Karte #253 (`braucht:263`, Gliederung mit beiden Listen und Filtern), danach #261 (`braucht:253`).

## Offene Fragen

Keine, die den Bau aufhält.

1. **Lesetext an Zeilen von `agent` ohne Angabe** — entschieden: „Tokens unbekannt“ nach PO Z. 576 (b). Der Wortlaut „keine Angabe“ aus N3 Punkt 3 war ein Vorschlag für den PO und ist damit überholt.
2. **Zahlform ab 1.000.000.000** — abgeleitet vom planer aus Z. 573: Der Teil vor dem Komma trägt Tausenderpunkte („1.234,5 Mio.“). Die Grenze ist im echten Bestand nicht erreicht (größter Lauf in D0009 Bild 10: 55 Mio.). Weicht der PO ab, ändert sich nur AK 1.

## Manuelle Vorbereitungstätigkeiten

- Beobachtung Tempo tagsüber einplanen (8–21 Uhr, Last ≤ 2).

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 ist mit N3 nachgeführt; nach dem Bau die Fundstellen prüfen.
- Factory: Transkripte, die vor Factory-Commit `89cb890` abgelegt wurden, tragen keine `tokens` (N3 Folgeaufgaben). Neu ablegen mit dem Werkzeug aus N2 Punkt 4, solange die Rohprotokolle liegen (bis etwa 2026-12-20).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Wunsch des Betreibers an #263: Die Daten liegen im Kosteneintrag und je Antwort im Transkript, die Laufansicht zeigt davon aber nur den Betrag. Diese Anforderung liest `tokens` einmal und ordnet jede Antwort genau einer Zeile zu. Daraus ergeben sich die Kennzahl im Kopf, die neuen Tokens an der Zeile und die drei teuersten Antworten. Gewertet wird nach den neuen Tokens und nicht nach der Summe, denn die Summe wächst mit dem Kontext und zeigt zu 96 % nur das Ende des Laufs (N3 „Belegt“). Wer abnimmt, springt mit einem Klick zur teuersten Antwort und sieht in „nach <Schritt>“ oder „nach <Dauer> Warten“, was davor stand. Das ist meist das große Ergebnis, das man beim nächsten Lauf schmaler lesen lässt.

## Notizen

- **Verworfene Alternativen** (N3 Optionen): K2 (nur Transkript), K3 (beide mit Abweichungsmarke); Z2 (auf Aufrufe verteilen), Z3 (eigene Zeile „Antwort“); S1 (Summe), S2 (Ausgabe), S4 (gewichtet nach Preis, ausgeschlossen durch Z. 569).
- **In Kauf genommen** (N3 Punkt 4): Cache-Lesen zählt in der Rangfolge nicht mit, und ein Token Ausgabe zählt so viel wie ein Token Cache-Schreiben.
- **Nicht übernommen** (UX K2): Der Kopf summiert alle vier Werte, Liste und Zeile nur die neuen. Ein Hinweis darauf ist Sache einer späteren Karte (PO Z. 573–574 hat „davon neu“ im Kopf bewusst verworfen).
- **Zehn Kriterien** (Schlank arbeiten). Weitere Grenzfälle der Zuordnung gehören dem entwickler.
