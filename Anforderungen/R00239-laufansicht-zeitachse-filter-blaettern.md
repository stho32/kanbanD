---
id: R00239
status: Neu
datum: 2026-11-22
---

# R00239: Laufansicht — Zeitachse, Filter und Blättern zwischen den Läufen

## Beschreibung

Karte #253, Scheibe B „Überblick und Navigation“ (PO Z. 522). Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N1 Punkt 2 (Zeitachse, Gliederung mit Filtern) und Punkt 5 (Blättern), N3 Punkt 6 (Reihenfolge #263 → #253 → #261). Produkt `AI-Team/po-entscheidungen.md` Z. 517, 520 (8)–(10), 521, 524, 527–530. Zeichnung D0009 `#laufansicht` Bild 1, 1a, 7, 8, 9, Notizen „Zeitachse (B)“, „Gliederung links“, „Blättern (B)“ und Notiz zu Bild 10 („Ansatz für #253“).

Wer einen Agentenlauf in der Laufansicht öffnet, sieht unter dem Kopf eine **Zeitachse**, die den Lauf nach Werkzeugen, Denken und Warten aufteilt. Links unter „Längste Schritte“ und „Teuerste Schritte“ blendet **„Zeigen“** Nachrichten, Werkzeuge und Systemhinweise ein und aus oder zeigt nur Fehler. In der Leiste **blättert** er mit „‹ Voriger Lauf“ und „Nächster Lauf ›“ durch alle Läufe der Karte, ohne zurück in „Läufe“ zu gehen. Alles wird aus der vorhandenen Auswertung und aus der Karte gezeichnet. Server, OpenAPI und Format bleiben unverändert.

Gebaut wird auf dem Stand nach #263 (R00238): Die linke Spalte enthält dann „Längste Schritte“ und „Teuerste Schritte“ aus **einer Listenfunktion** (R00238 FA 8). Diese Anforderung verwendet sie unverändert und setzt die Filter darunter.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): R00234 beantwortet „War das ein sinnvolles Vorgehen?“ und „Was hat am längsten gedauert?“ für einen Lauf. Diese Anforderung zeigt, wie sich die Zeit über den Lauf verteilt, macht lange Läufe auf das Wesentliche filterbar und führt durch alle Läufe einer Karte.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Ein Entwicklerlauf hat 185 Werkzeugaufrufe und über 70 Minuten (D0009 Bild 10). Ob die Zeit in Werkzeugen, im Denken oder im Warten auf den Menschen lag, zeigt der Kopf nur als Summe. Die Zeitachse zeigt, **wann** im Lauf sie lag. Unter „nur Fehler“ stehen die gescheiterten Schritte neben dem gemeldeten Ergebnis. Wer eine Karte abnimmt, prüft alle Läufe der Reihe nach, statt für jeden in „Läufe“ zurückzugehen.

## Funktionale Anforderungen

1. **Stücke der Zeitachse** (N1 Punkt 2): Die Zeitachse ist die Folge der Lücken aus N1 Punkt 1 in den Arten **Werkzeuge**, **Denken** und **Warten** (Zuordnung nach `lueckenArt`, N1 „Nach dem Bau“). Benachbarte Lücken derselben Art verschmelzen zu einem Stück. Eine Lücke von 0 ms bildet kein Stück und trennt keine Stücke. Alle Zeitpunkte liegen auf einer Achse: Ein Stück beginnt bei der ersten Zeit des Laufs plus der Summe der Lücken davor. Steigen die Zeiten an, ist das die Uhrzeit des Eintrags vor der Lücke. Die Breite eines Stücks ist sein Anteil an der Gesamtdauer, mindestens 1 px.
2. **Fächer** (N1 Punkt 2, PO Z. 530): Sind es mehr als 200 Stücke, wird die Gesamtdauer in 200 gleich lange Fächer geteilt. Jedes Fach trägt die Art, deren Lücken darin am meisten Zeit haben. Bei Gleichstand gilt die Reihenfolge Werkzeuge, Denken, Warten. Benachbarte Fächer derselben Art bleiben getrennt, es sind immer 200.
3. **Zeichnung der Zeitachse** (PO Z. 520 (9), 527, 528; Notiz „Zeitachse (B)“): Überschrift „Zeitachse“. Die Legende „Werkzeuge“, „Denken“, „Warten“ steht immer mit allen drei Arten. Darunter steht der Balken, links darunter die erste und rechts die letzte Zeit als „hh:mm:ss“ in Ortszeit (letzte = erste + Gesamtdauer). Die Farben sind Werkzeuge `--kd-accent`, Denken `--kd-agent`, Warten `--kd-mensch` gestreift mit `--kd-mensch-weak`; Teile der Art Warten unter 6 px Breite sind einfarbig `--kd-mensch`, ab 6 px tragen sie das Muster (Takt 4 + 2 px; UX-Vorprüfung S5). **Breite ohne Überlauf** (UX-Vorprüfung M1): Die Fläche zwischen zwei Stücken ist eine 1-px-Linie in `--kd-surface` am rechten Rand des Stücks, innerhalb seiner Breite, und entfällt bei Stücken unter 3 px. Fächer sind gleich breit (± 0,5 px), haben keine Mindestbreite und keinen Abstand. Stücke sind mindestens 1 px breit. Was die Mindestbreite einem Stück dazugibt, geht den übrigen ab: Die Teile füllen zusammen genau die Balkenbreite, auch bei 320 px (Balken dort 288 px breit, gemessen am Artboard; 200 Stücke brauchen höchstens 200 px Mindestbreite). Der Tooltip (`title`) eines Stücks lautet „<Art> <Dauer> ab hh:mm:ss“, der eines Fachs „überwiegend <Art>, hh:mm:ss–hh:mm:ss“. Vorgelesen wird der Balken als Ganzes (`role="img"`) mit „Zeitachse: Werkzeuge <Dauer>, Denken <Dauer>, Warten <Dauer>“. Ein Teil mit 0 ms entfällt, ein Teil über 0 und unter 1 s heißt „< 1 s“ (Z. 527). Die Dauerform ist die aus R00234 FA 2 (`dauerText`).
4. **Wann es keine Zeitachse gibt**: Es gibt keine Zeitachse bei „Dauer unbekannt“ (R00234 FA 3), bei einer Gesamtdauer von 0 ms und in den Zuständen ohne gelesene Einträge (lädt, liegt nicht auf diesem Rechner, Lesen gescheitert; PO Z. 526). An der Grenze zeigt sie das Gelesene.
5. **Filter „Zeigen“** (N1 Punkt 2, PO Z. 520 (10); Bild 1, 1a): Ein `fieldset` mit der Legende „Zeigen“ und vier Kästchen: „Nachrichten“ (Vorgabe an), „Werkzeuge“ (an), „Systemhinweise“ (aus) und „nur Fehler“ (aus). Jede Zeile der Liste gehört zu genau einer Art:
   - **Nachrichten**: jede Nachricht außer Systemhinweisen, also auch der eingeklappte Auftrag.
   - **Werkzeuge**: jede Schrittzeile (Aufruf mit oder ohne Ergebnis, Ergebnis ohne Aufruf).
   - **Systemhinweise**: die eingeklappten Systemhinweise (R00234 FA 9).
   - Eine **Denk- oder Wartezeile** gehört zur Art des Eintrags dahinter, denn ihre Lücke gehört ihm (N1 Punkt 1).

   Eine Zeile ist sichtbar, wenn das Kästchen ihrer Art an ist. Ist „nur Fehler“ an, sind nur Schrittzeilen mit Fehler (R00234 FA 8) sichtbar. Die anderen drei Kästchen behalten dann ihren Stand und wirken wieder, sobald „nur Fehler“ aus ist. Solange „nur Fehler“ angehakt ist, tragen „Nachrichten“, „Werkzeuge“ und „Systemhinweise“ die Sperrform von Z. 216 (`aria-disabled="true"`, fokussierbar, gedämpft, ein angehaktes bleibt angehakt; PO Z. 588). Klick oder Leertaste ändert dann weder Kästchen noch Liste noch Statusbereich. „Ende des Transkripts“ bzw. der Satz zur Grenze bleibt immer stehen.
6. **Filter nur über CSS** (N1 Punkt 2, Q4): Der Stand der Filter ist ein Attribut an der Wurzel der Insel (`#lv-insel`). Ein Wechsel ändert nur dieses Attribut und den Text des Statusbereichs. Die Insel bleibt derselbe Knoten, die Auswertung wird nicht neu gerechnet, und es geht keine Anfrage hinaus. Der Stand liegt in `S.ui.lauf` und wird nach einem frischen Aufbau der Insel und nach jedem Live-Ereignis wieder gesetzt. Beim Blättern nimmt der neue Lauf den Stand der Filter mit; beim Öffnen aus „Läufe“ oder über eine Adresse gilt die Vorgabe (PO Z. 583).

   **Ansage** (PO Z. 587): Nach jedem Wechsel eines Kästchens sagt `#lv-status` genau einmal an: „<s> von <g> Einträgen sichtbar.“ (bei g = 1: „<s> von 1 Eintrag sichtbar.“); bei s = 0 mit „nur Fehler“ an: „Keine Fehler erkannt.“; bei s = 0 sonst: „Keine Einträge sichtbar.“. g sind alle Zeilen der Liste (bei T1 die 14 aus „Zeilen von T1 und ihre Art“), ohne Bericht und ohne „Ende des Transkripts“; s die davon sichtbaren. s und g kommen aus der vorhandenen Auswertung, nicht aus dem DOM. Jeder Wechsel ist eine eigene Ansage, ohne Bündeln; der neue Text ersetzt den alten. Ein Klick auf ein gesperrtes Kästchen sagt nichts an. Die sichtbare Zeile aus FA 7 und die leere Liste tragen weder `role` noch `aria-live` und keinen eigenen Satz (PO Z. 584).
7. **„nur Fehler“ ohne Treffer und der Bericht** (PO Z. 520 (6), 529; Bild 8): Hat der Lauf keine erkannten Fehler und ist „nur Fehler“ an, steht an der Stelle der Einträge gedämpft „Keine Fehler erkannt. Erkannt werden ein Exit-Code ungleich 0 und Fehler des Werkzeugs.“. Die Karte „Bericht“ bzw. die Zeile „Kein Bericht erkannt: …“ bleibt unter jedem Filter stehen. Die Filter wirken nur auf die Einträge der Liste.
8. **Lage der Gliederung** (Notiz „Gliederung links“, Notiz zu Bild 10): Die linke Spalte enthält von oben „Längste Schritte“, „Teuerste Schritte“ (beide aus der Listenfunktion von R00238, unverändert) und darunter „Zeigen“. Ab 981 px ist sie 232 px breit, bei 641–980 px 200 px. Unter 641 px ist die Reihenfolge (PO Z. 590, geht hier D0009 `#laufansicht` vor): Kopf mit Kennzahlen und Zeitachse, Blättern, Karte „Bericht“ bzw. „Kein Bericht erkannt: …“, dann die Gliederung („Längste Schritte“, „Teuerste Schritte“, „Zeigen“ mit den Filtern in einer Zeile, die umbricht), dann die Einträge. Lese- und Tab-Reihenfolge folgen der sichtbaren Reihenfolge. Entfallen beide Listen (Dauer unbekannt, keine `tokens`), steht „Zeigen“ allein (Bild 7).
9. **Sprung in eine verborgene Zeile**: Wählt der Mensch in einer der beiden Listen einen Eintrag, dessen Zeile ein Filter verbirgt, wird zuerst „nur Fehler“ ausgeschaltet, falls es an ist. Danach wird das Kästchen der Art der Zeile eingeschaltet, falls es aus ist. Erst dann springt die Ansicht wie in R00234 FA 10. Die geänderten Kästchen sind sichtbar angehakt. Ist die Zeile sichtbar, etwa eine Fehlerzeile unter „nur Fehler“, ändert sich kein Kästchen (UX-Vorprüfung S2 b). Der Sprung sagt nichts an, auch wenn er Kästchen umschaltet (R00234 AK 9).
10. **Folge der Läufe** (N1 Punkt 5, PO Z. 521): Die Läufe der Karte sind die Einträge von `a.transkripte` mit Kennung, in jedem Zustand, ohne Anfrage. Sie stehen aufsteigend nach dem Zeitpunkt der Kennung (`kennungMs`), bei Gleichstand in der Reihenfolge von `a.transkripte`, ohne Zeitpunkt am Ende. Lauf 1 ist der älteste. Kosteneinträge ohne Transkript zählen nicht. Steht die gezeigte Kennung nicht in der Folge, entfällt das Blättern.
11. **Blättern** (N1 Punkt 5, PO Z. 520 (8); Bild 9, Notiz „Blättern (B)“): Rechts in der Leiste stehen „‹ Voriger Lauf“ · „Lauf <k> von <n>“ · „Nächster Lauf ›“. Beide Links sind echte `<a href>` auf `laufAdresseBilden` des Nachbarn, in der Form `.btn`. Am ersten bzw. letzten Lauf steht der Link in der Sperrform von Z. 216/484: `aria-disabled="true"`, ohne `href`, mit `role="link"` und `tabindex="0"` weiter fokussierbar, Schrift `--kd-faint`, Kontur `--kd-line` (UX-Vorprüfung S6). Die Pfeile „‹“ und „›“ stehen `aria-hidden`, die Links heißen „Voriger Lauf“ und „Nächster Lauf“. Bei einem Lauf sind beide gesperrt („Lauf 1 von 1“). Schmal bricht das Blättern in eine eigene Zeile.
12. **Wechsel** (N1 Punkt 5): Ein einfacher Linksklick ohne Umschalt-, Steuer- oder Metataste wechselt über `act` mit `replaceState`. `history.length` wächst nicht, und der Eintrag behält seinen Zustand, sodass „‹ #<nr>“ weiter auf „Läufe“ führt (ADR-0041 Punkt 2). Ein Klick mit Taste bleibt dem Browser. Der Wechsel bricht die laufende Anfrage ab (Punkt 4). Ein Lauf im Zustand `fehlt` zeigt Bild 4 ohne Anfrage. Der Fokus bleibt auf dem gewählten Link, auch wenn er danach gesperrt ist, und fällt nie auf `body`. **Ansage nach dem Wechsel** (PO Z. 589): „Lauf <k> von <n>, <Rolle>. <Zustandssatz>“; am ersten Lauf „Lauf 1 von <n>, <Rolle>, erster Lauf. <Zustandssatz>“, am letzten „Lauf <n> von <n>, <Rolle>, letzter Lauf. <Zustandssatz>“. `<Zustandssatz>` ist der bisherige Schlusssatz des Zustands unverändert (`laufAnsage`: „Ende des Transkripts“, der Satz zur Grenze, „Das Transkript liegt nicht auf diesem Rechner.“, Lesen gescheitert). Fehlt die Rolle, entfällt sie samt Komma. Die Ansage beim Start des Lesens („Liest das Transkript …“) bleibt (Z. 484 S-B): ab dem Klick zwei Änderungen, ab der Freigabe eine, ohne Lesen (`fehlt`) eine; beide nur in `#lv-status`. Ein Klick auf einen gesperrten Link ändert nichts und sagt nichts an. Beim Öffnen aus „Läufe“ oder über eine Adresse bleibt die Ansage wie in #251, ohne „Lauf <k> von <n>“.
13. **Live** (N1 Punkte 5, 6): Ein Live-Ereignis zeichnet die Leiste mit „Lauf <k> von <n>“ und den Kopf aus der Karte neu. Kommt ein Transkript hinzu, ändern sich k und n, ohne dass das gezeigte Transkript neu gelesen wird. Insel, Filter und Auswertung bleiben.

## Nicht-funktionale Anforderungen

- **Leistung** (N1 Punkt 6): Es bleibt bei einer Auswertung je Lesen. Die Stücke entstehen im selben Durchlauf, die Fächer danach in O(Stücke + 200). Zeitachse, Filter und Blättern rechnen bei Live und beim Filterwechsel nichts neu (`grep -c "laufAuswerten(" web/app.js` bleibt 1). T3 (20.000 gelesene Zeilen, 19.999 Stücke) bleibt von der Antwort bis zum Bild unter 300 ms. Das ist eine Beobachtung im Bericht, kein Gate und ein Tag-Kriterium (8–21 Uhr, Last ≤ 2, `nice -n 10`).
- **Zugänglichkeit**: Kästchen und Links sind mit der Tastatur bedienbar, Ziele bei grobem Zeiger ≥ 48 px und bei feinem ≥ 24 px. Die Stücke stehen ≥ 3:1 gegen `--kd-surface` (Notiz „Zeitachse (B)“), Text ≥ 4,5:1, ausgenommen der Text gesperrter Bedienelemente (≥ 3:1, PO Z. 484 S-A). Ein Filterwechsel sagt sein Ergebnis im Statusbereich an (FA 6); einzige Live-Region bleibt `#lv-status` (Z. 481 a). Gesperrte Links und Kästchen lesen sich als nicht verfügbar.
- **Sicherheit**: Tooltips und Lesetexte enthalten nur gerechnete Dauern, Uhrzeiten und feste Wörter. Die Kennung im `href` geht nur über `laufAdresseBilden`.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00234: gz-Dateien erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/<nr>/transkripte` ab, Kosten über `POST /api/aufgaben/<nr>/kosteneintraege`). Mensch `sh`, Browser headless (Chromium) in `Europe/Berlin`, Board `fabrik` mit `record-transcripts: true`. Aufgabe #1 trägt T1, T3, T4 und T5 aus R00234 und dazu:

| Lauf | Kennung | Transkript | Kosteneintrag |
|---|---|---|---|
| T10 | `tester@2026-11-22T10:00+01:00` | 202 Einträge, Eintrag k mit `zeit` 10:00:00 + (k − 1) s; ungerade ein Aufruf `Bash` von `agent` (`{"command":"true"}`), gerade sein Ergebnis „ok“ | — |
| T11 | `entwickler@2026-11-22T10:30+01:00` | wie T10, aber 201 Einträge ab 10:30:00 | — |
| K1 | `pruefer@2026-11-21T12:00+01:00` | kein Transkript | 0,10 USD |

Aufgabe #2 trägt nur T12 = `planer@2026-11-21T09:00+01:00` mit den Einträgen von T1.

**Rechenbeispiel T1** (Einträge und Lücken aus R00234 „Rechenbeispiel T1“, geprobt gegen ein Modell der Regeln, `gemeinsam/scratchpad/plan-253/modell.js` der Factory): 9 Stücke — Warten 1 s ab 23:30:00 · Denken 21 s ab 23:30:01 · Werkzeuge 4 s ab 23:30:22 · Denken 4 s (4.999 ms) ab 23:30:26 · Werkzeuge 1 s ab 23:30:30 · Denken 5 s (5.000 + 500 ms, verschmolzen) ab 23:30:31 · Werkzeuge 8 s (2 + 1 + 5 s, verschmolzen, über Nr 11 ohne Zeit) ab 23:30:37 · Warten 1 min 5 s ab 23:30:45 · Denken 39 s (1.501 + 38.000 ms) ab 23:31:50. Summe 150.000 ms, je Art 13 s / 1 min 11 s / 1 min 6 s wie im Kopf.

**Rechenbeispiel T10** (dasselbe Modell): 201 Lücken zu je 1 s, abwechselnd Werkzeuge (gerade Einträge) und Denken, also 201 Stücke → 200 Fächer zu je 1.005 ms. Fach i (1–200) reicht von 1.005 · (i − 1) bis 1.005 · i ms. Bis Fach 100 überwiegt das Stück, in dem es beginnt, ab Fach 101 das folgende. Fach 1 „überwiegend Werkzeuge, 10:00:00–10:00:01“, Fach 2 „überwiegend Denken, 10:00:01–10:00:02“, Fach 100 „überwiegend Denken, 10:01:39–10:01:40“, Fach 101 „überwiegend Denken, 10:01:40–10:01:41“, Fach 200 „überwiegend Werkzeuge, 10:03:19–10:03:21“; zusammen 100 Werkzeuge und 100 Denken. T11 hat genau 200 Stücke und keine Fächer.

**Folge an #1** (FA 10): T3 (21.11. 08:00) · T5 (22:00) · T1 (23:30) · T4 (23:40) · T10 (22.11. 10:00) · T11 (10:30), also n = 6; K1 zählt nicht.

**Zeilen von T1 und ihre Art** (FA 5; die 14 Einträge der Liste aus R00234 AK 7): Nachrichten — Nr 1 (Auftrag), „1 min 5 s wartet“, Nr 13, Nr 14; Systemhinweise — Nr 2; Werkzeuge — „21 s denkt“, 3+4, 5+6, „5 s denkt“, 7+9, 8+10, 11+12, „38 s denkt“, 15. Fehler: 5+6 und 8+10.

### Zeitachse

- [ ] **AK 1 Stücke:** Gegeben die Laufansicht von T1, dann steht zwischen Kopf und Einträgen „Zeitachse“ mit dem Balken aus den 9 Stücken des Rechenbeispiels, in dieser Reihenfolge. Die Tooltips lauten „Warten 1 s ab 23:30:00“, „Denken 21 s ab 23:30:01“, „Werkzeuge 4 s ab 23:30:22“, „Denken 4 s ab 23:30:26“, „Werkzeuge 1 s ab 23:30:30“, „Denken 5 s ab 23:30:31“, „Werkzeuge 8 s ab 23:30:37“, „Warten 1 min 5 s ab 23:30:45“ und „Denken 39 s ab 23:31:50“. Die Breite jedes Stücks ist Dauer / 150.000 ms der Balkenbreite (± 1 px, gemessen mit `getBoundingClientRect` bei 1280 px), mindestens 1 px; die Trennlinie liegt innerhalb dieser Breite (FA 3). Die Mindestbreite greift bei T1 nicht: Das kürzeste Stück (1 s) ist 1/150 der Balkenbreite, ab 150 px Balken also ≥ 1 px. Links unter dem Balken steht „23:30:00“, rechts „23:32:30“. In Node gilt: Eine Lücke von 0 ms zwischen zwei Denklücken ergibt ein einziges Denkstück, und eine negative Lücke ergibt kein Stück.
- [ ] **AK 2 Vorgelesen, Legende und Sonderfälle:** Gegeben T1, dann trägt der Balken `role="img"` und den zugänglichen Namen „Zeitachse: Werkzeuge 13 s, Denken 1 min 11 s, Warten 1 min 6 s“ (`ariaSnapshot()`). Gegeben T3, dann lautet er „Zeitachse: Werkzeuge 2 h 46 min, Denken 2 h 46 min“ ohne „Warten“, und die Legende zeigt trotzdem „Werkzeuge“, „Denken“ und „Warten“. Gegeben T4 („Dauer unbekannt“), T5 (`fehlt`), T1 mit gehaltener Antwort oder T1 mit 503 per `page.route`, dann gibt es keine Zeitachse. In Node gibt es auch bei zwei Einträgen mit derselben Zeit (Gesamtdauer 0 ms) keine, und ein Teil von 400 ms liest sich „< 1 s“.
- [ ] **AK 3 Fächer ab 201 Stücken:** Gegeben T10, dann hat der Balken genau 200 Fächer, 100 in der Farbe von Werkzeuge und 100 in der von Denken. Die Tooltips von Fach 1, 2, 100, 101 und 200 lauten wörtlich wie im Rechenbeispiel. Gegeben T11, dann hat er 200 Stücke mit den Tooltips „Werkzeuge 1 s ab 10:30:00“ bis „Denken 1 s ab 10:33:19“ und kein Fach. Gegeben T3 (19.999 Stücke bis zur Grenze), dann hat er 200 Fächer, und Fach 1 lautet „überwiegend Werkzeuge, 08:00:00–08:01:39“. In Node gilt: Haben in einem Fach Werkzeuge und Denken gleich viel Zeit, trägt es Werkzeuge, bei Denken und Warten Denken.

### Filter

- [ ] **AK 4 Vorgabe und Wirkung:** Gegeben T1, dann steht unter „Zeigen“ „Nachrichten“ und „Werkzeuge“ angehakt, „Systemhinweise“ und „nur Fehler“ nicht. Sichtbar sind 13 Zeilen, alle außer Nr 2. Ist „Systemhinweise“ an, sind es 14. Ist danach „Werkzeuge“ aus, sind es 5 (Nr 1, „1 min 5 s wartet“, Nr 13, Nr 14 und Nr 2), und keine Denkzeile steht mehr da. Ist dazu „Nachrichten“ aus, ist es nur Nr 2. Gezählt wird mit `getBoundingClientRect().height > 0` je `li` der Insel. Bei jedem Wechsel trägt die Insel die Marke `el.__probe = 1` weiter, `laufAuswerten` lief genau einmal (Zähler), und es geht keine Anfrage hinaus. Der Statusbereich ändert sich je Wechsel genau einmal (`MutationObserver`) und sagt der Reihe nach „14 von 14 Einträgen sichtbar.“, „5 von 14 Einträgen sichtbar.“ und „1 von 14 Einträgen sichtbar.“. Ist danach auch „Systemhinweise“ aus, sagt er „Keine Einträge sichtbar.“, und in der Liste steht kein eigener Satz. In Node lautet der Satz bei einer Liste aus einer sichtbaren Zeile „1 von 1 Eintrag sichtbar.“.
- [ ] **AK 5 „nur Fehler“ mit und ohne Treffer:** Gegeben T1, wenn `sh` „nur Fehler“ anhakt, dann sind genau die Zeilen 5+6 („Exit code 1“) und 8+10 (`<tool_use_error>`) sichtbar, und der Statusbereich sagt „2 von 14 Einträgen sichtbar.“. Die Karte „Bericht“ steht weiter über ihnen, und „Ende des Transkripts“ steht darunter. Solange „nur Fehler“ angehakt ist, tragen die drei anderen Kästchen `aria-disabled="true"` und behalten ihren Stand; ein Klick auf „Werkzeuge“ ändert weder Kästchen noch Liste noch Statusbereich. Hakt `sh` „nur Fehler“ wieder ab, sind es wieder die 13 Zeilen der Vorgabe („13 von 14 Einträgen sichtbar.“), und die drei Kästchen wirken wieder. Gegeben T4 (Bild 8), wenn `sh` „nur Fehler“ anhakt, dann steht an der Stelle der Einträge gedämpft und lesbar „Keine Fehler erkannt. Erkannt werden ein Exit-Code ungleich 0 und Fehler des Werkzeugs.“, „Fehler erkannt“ zeigt „0“, und die Zeile „Kein Bericht erkannt: …“ steht weiter da. Der Statusbereich sagt „Keine Fehler erkannt.“, und die sichtbare Zeile trägt weder `role` noch `aria-live`. Unter T1 steht dieser Satz nie.
- [ ] **AK 6 Lage, Bestand und Sprung:** Gegeben T1, dann steht „Zeigen“ in der linken Spalte unter „Längste Schritte“. In Node steht es bei einer Auswertung mit `tokens` unter „Teuerste Schritte“, und beide Listen kommen aus der Listenfunktion von R00238. Gegeben T4, dann steht „Zeigen“ ohne Listen (Bild 7). Gegeben T1 mit „Werkzeuge“ aus und „nur Fehler“ an, wenn ein Kosteneintrag `pruefer` 2026-11-21T12:30+01:00 über 0,20 USD gebucht wird (Live-Ereignis), dann bleibt der Stand der Kästchen und der Zeilen. Wählt `sh` danach in „Längste Schritte“ den zweiten Eintrag („denkt · vor SubagentHandback …“, 38 s), dann ist „nur Fehler“ aus, „Werkzeuge“ angehakt, und die Denkzeile vor Nr 15 hat den Fokus (`document.activeElement.id`), unter dem Seitenkopf und im Fenster; der Statusbereich ändert sich durch den Sprung nicht (`MutationObserver`, Zähler 0). Wählt `sh` unter der Vorgabe den ersten Eintrag („1 min 5 s“, sichtbar), ändert sich kein Kästchen. In Node gilt: Ist die Zielzeile sichtbar, etwa eine Fehlerzeile unter „nur Fehler“ mit „Werkzeuge“ aus, ändert der Sprung kein Kästchen.

### Blättern

- [ ] **AK 7 Folge, Wortlaut und Sperrform:** Gegeben die Laufansicht von T1, dann steht rechts in der Leiste „‹ Voriger Lauf“, „Lauf 3 von 6“ und „Nächster Lauf ›“. Der vorige Link zeigt auf die Adresse von T5, der nächste auf die von T4 (`href` gleich `laufAdresseBilden`). Gegeben T3, dann steht „Lauf 1 von 6“, und „‹ Voriger Lauf“ ist gesperrt. Gegeben T11, dann steht „Lauf 6 von 6“, und „Nächster Lauf ›“ ist gesperrt. Gegeben T12 an #2, dann steht „Lauf 1 von 1“, und beide sind gesperrt (Bild 9). Gesperrt heißt: `aria-disabled="true"`, `role="link"`, `tabindex="0"`, kein `href`, mit Tab erreichbar, `ariaSnapshot()` zeigt `link "Nächster Lauf" [disabled]` (Pfeil nicht im Namen), Schrift in der berechneten Farbe von `--kd-faint` und Kontur in der von `--kd-line`, hell und dunkel. Ein Klick darauf ändert nichts. Gegeben T5, dann zeigt die Seite „liegt nicht auf diesem Rechner“ mit „Lauf 2 von 6“ ohne Anfrage an `…/transkripte/…`. In Node gilt: Zwei Kennungen mit demselben Zeitpunkt behalten die Reihenfolge von `a.transkripte`, eine Kennung ohne lesbaren Zeitpunkt steht am Ende, und steht die gezeigte Kennung nicht in der Folge, gibt es kein Blättern.
- [ ] **AK 8 Wechsel ohne Verlaufseintrag:** Gegeben #1 offen in „Läufe“, `sh` wählt bei T3 „Ansehen“, die Antwort von T3 wird gehalten (`page.route`). Wenn `sh` mit Klick „Nächster Lauf ›“ wählt, dann endet die gehaltene Anfrage abgebrochen (`requestfailed`), die Seite zeigt T5 mit „Lauf 2 von 6“, und eine spätere Antwort für T3 ändert sie nicht. Wählt `sh` danach mit Enter noch zweimal „Nächster Lauf ›“, steht T4 mit „Lauf 4 von 6“ da. `location.hash` ist die Adresse von T4, `history.length` ist dieselbe wie nach „Ansehen“, und der Fokus liegt auf „Nächster Lauf ›“. Die Endansagen im Statusbereich lauten der Reihe nach „Lauf 2 von 6, code-reviewer. Das Transkript liegt nicht auf diesem Rechner.“, „Lauf 3 von 6, planer. Ende des Transkripts“ und „Lauf 4 von 6, architekt. Ende des Transkripts“, je Wechsel genau eine (`MutationObserver`: bei T1 und T4 ab dem Klick zwei Änderungen mit „Liest das Transkript …“ davor, bei T5 eine). „‹ #1“ führt danach zu „Läufe“ von #1. Gegeben T10 mit Fokus auf „Nächster Lauf ›“, wenn `sh` ihn wählt, dann steht T11 da, der Fokus liegt auf dem jetzt gesperrten „Nächster Lauf ›“, nicht auf `body`, und der Statusbereich sagt „Lauf 6 von 6, entwickler, letzter Lauf. Ende des Transkripts“. Ein Klick auf den gesperrten Link ändert den Statusbereich nicht. **Filter beim Blättern** (PO Z. 583): Gegeben T1 mit „nur Fehler“ angehakt, wenn `sh` „Nächster Lauf ›“ wählt, dann ist bei T4 „nur Fehler“ angehakt, und an der Stelle der Einträge steht „Keine Fehler erkannt. Erkannt werden …“. Nach „‹ #1“ und „Ansehen“ bei T1 gilt wieder die Vorgabe. In Node gilt: Am ersten Lauf lautet die Ansage etwa „Lauf 1 von 6, entwickler, erster Lauf. Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.“, und ohne Rolle entfällt sie samt Komma.

### Live und Darstellung

- [ ] **AK 9 Live:** Gegeben die Laufansicht von T1 mit „Lauf 3 von 6“, der Marke `el.__probe = 1` an der Insel, „Systemhinweise“ an und aufgeklapptem Nr 3, wenn über die API ein Transkript `planer@2026-11-21T07:00+01:00` an #1 abgelegt wird, dann steht „Lauf 4 von 7“, und „‹ Voriger Lauf“ zeigt weiter auf T5. Das Transkript von T1 wird nicht neu angefragt. Die Insel trägt die Marke noch, Nr 3 ist noch aufgeklappt, „Systemhinweise“ ist noch an, `laufAuswerten` lief genau einmal, und der Fokus bleibt. Kein Text im Statusbereich und in keiner `aria-live`-Region ändert sich.
- [ ] **AK 10 Breite, Themen, Zugänglichkeit:** Gegeben T1 und T10, dann gilt bei 320, 641, 980 und 1280 px, hell und dunkel, `scrollWidth ≤ clientWidth` an Dokument, Bildlaufbehälter, Leiste und Zeitachse. Gegeben T1, T3, T10 und T11, dann gilt bei 320, 375 und 414 px am Balken `scrollWidth ≤ clientWidth`, die rechte Kante des letzten Teils liegt höchstens 0,5 px rechts der rechten Kante des Balkens, und die Fächer von T10 sind gleich breit (± 0,5 px). Die linke Spalte ist bei 1280 px 232 px und bei 980 px 200 px breit. Bei 320 px liegt die Karte „Bericht“ über „Längste Schritte“ und „Zeigen“ über dem ersten Eintrag (je `bottom` ≤ `top`), die Karte steht im Dokument vor der Gliederung (`compareDocumentPosition`), und das Blättern steht in einer eigenen Zeile unter Rolle und Zeitpunkt. Die drei Farben der Stücke stehen in beiden Themen ≥ 3:1 gegen `--kd-surface`, ein Warten-Teil unter 6 px einfarbig. Wörter von Zeitachse, Legende, Filtern, Blättern und der Satz aus AK 5 stehen ≥ 4,5:1; ausgenommen der Text gesperrter Links und Kästchen (`aria-disabled="true"`), er steht ≥ 3:1 (PO Z. 484 S-A); „Lauf <k> von <n>“ steht immer ≥ 4,5:1. Ein gesperrter, fokussierter Link oder ein gesperrtes Kästchen trägt einen Fokusring von ≥ 2 px und ≥ 3:1. Kästchen samt Beschriftung und die Links des Blätterns sind bei grobem Zeiger ≥ 48 px und bei feinem ≥ 24 px hoch, und jeder trägt einen sichtbaren Fokusring (`outline-width` ≥ 2 px). Die Legende ist `aria-hidden`, kein Stück und kein Fach ist ein Tab-Ziel. Die Lage wird mit `getBoundingClientRect` gemessen, nie mit `innerText`.

## Betroffene Verzeichnisstruktur

- `web/lauf.js`: Stücke und Fächer in der Auswertung, Zeichnung der Zeitachse, Art je Zeile als Klasse, „Zeigen“ in der linken Spalte, rein, in Browser und Node.
- `web/laeufe.js`: Folge der Läufe und „Lauf k von n“ in der Leiste (`laeufeLeisteHtml`, `kennungMs`).
- `web/app.js`: `act` für Filter, Blättern und den Sprung in eine verborgene Zeile; Filterstand in `S.ui.lauf`; Fokus nach dem Blättern statt `#lv-h1`. Hier wird nichts gerechnet.
- `web/kd-app.css`: `.lv-za`, `.lv-filt`, Sichtbarkeit je Filterattribut, Blättern in der Leiste; nur Tokens aus `web/kd-tokens.css`, keine neue Farbe.
- Tests: `e2e/einheit/lauf.test.js`, `lauf-zeichnen.test.js`, `laeufe.test.js` (Node), `e2e/tests/r00239-laufansicht-zeitachse-filter-blaettern.spec.js` (E2E), Hilfen aus `e2e/tests/laufansicht-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Drei Stränge, die nach dem Stand von #263 parallel baubar sind:

1. **Zeitachse**: rechnen (B1245), dann zeichnen (B1246).
2. **Filter**: Art je Zeile mit Attribut und CSS (B1247), dann Zustand, Lage und Sprung (B1248).
3. **Blättern**: Folge und Leiste (B1249), dann Wechsel, Abbruch, Fokus und Live (B1250).
4. Danach **Messen** (B1251) und **Probe im echten Programm, Mutanten, Gate** (B1252).

### Grobentwurf

- `laufAuswerten(zeilen, grenze)` liefert zusätzlich `zeitachse: {erste, gesamt, stuecke: [{art, ab, dauer}], faecher: null | [{art, ab, bis}]}`. Die Stücke entstehen im Durchlauf, der die Lücken ohnehin bildet. Die Fächer werden danach über die Stücke gerechnet, ohne zweiten Durchlauf über die Zeilen.
- Jede Zeile der Insel trägt ihre Art als Klasse (`nachricht`, `werkzeug`, `hinweis`; Denkzeilen die des Eintrags dahinter) und Fehlerzeilen zusätzlich `fehler`. Die Insel trägt den Filterstand als Attribut (etwa `data-zeigen="nachricht werkzeug"`, `data-nur-fehler`). Das CSS blendet mit `display:none` aus.
- „Keine Fehler erkannt …“ steht nur, wenn die Auswertung 0 Fehler hat. Es sitzt als Element in der Insel und erscheint nur unter dem Attribut für „nur Fehler“.
- Folge und Nachbarn sind eine reine Funktion aus `a.transkripte` und der gezeigten Kennung, in Node testbar.
- Die Sätze der Ansagen sind reine Funktionen, in Node testbar: der Filtersatz aus den Zahlen der Auswertung und dem Filterstand (FA 6), der Satz nach dem Blättern aus k, n, Rolle und dem Satz von `laufAnsage` (FA 12).

### Hinweise

- **Bestandstests**: Mit der Vorgabe „Systemhinweise aus“ ist der Systemhinweis von T1 nicht mehr sichtbar. Der Test zu R00234 AK 8 (`r00234-laufansicht-ergebnis-und-dauer.spec.js:289`) hakt dafür vorher „Systemhinweise“ an. Das ist die einzige erlaubte Änderung an einer Erwartung. R00234 bleibt unverändert.
- `laufAnstossen` setzt beim Wechsel der Adresse den Fokus auf `#lv-h1`. Beim Blättern gilt stattdessen FA 12.
- Der Sprung aus beiden Listen läuft über denselben `act`. FA 9 gilt deshalb für „Längste Schritte“ und „Teuerste Schritte“ ohne Änderung an der Listenfunktion.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node):** die Proben aus ADR-0041 N1 „Durchsetzung“ für Scheibe B wörtlich (201 Stücke ergeben 200 Fächer). Dazu T1 und T10 als Ganzes gegen die Rechenbeispiele, 0-ms-Lücke, negative Lücke, Gesamtdauer 0, Gleichstand im Fach, Folge mit Gleichstand und ohne Zeitpunkt, Kennung außerhalb der Folge, Art je Zeile.
- **E2E (Chromium, headless):** AK 1–10. Dazu wörtlich aus N1 „Durchsetzung“: Ein Filter lässt die Marke an der Insel stehen (`el.__probe`). Blättern hält `history.length` gleich, „‹ #<nr>“ führt zu „Läufe“, und die vorige Anfrage wird abgebrochen. Antworten werden per `page.route` gehalten, Verneinungen stehen erst nach einem sichtbaren Signal.
- **Mutanten** (eigene Kopie, nicht im Worktree), je von einem benannten Test getötet:
  - m1 benachbarte Lücken gleicher Art nicht verschmolzen → AK 1 rot (13 statt 9 Stücke)
  - m2 Fächer schon ab 200 Stücken (`>=` statt `>`) → AK 3 rot (T11)
  - m3 Fach nach der Art an seinem Anfang statt nach der überwiegenden → AK 3 rot (Fach 101)
  - m4 Teil mit 0 ms im vorgelesenen Balken → AK 2 rot (T3)
  - m5 Legende nur mit vorkommenden Arten → AK 2 rot (T3)
  - m6 Filterwechsel zeichnet die Insel neu → AK 4 rot (`__probe`)
  - m7 Denkzeile ohne Art des Eintrags dahinter (immer sichtbar) → AK 4 rot (8 statt 5 Zeilen)
  - m8 Bericht in der Insel, unter „nur Fehler“ verborgen → AK 5 rot
  - m9 Blättern mit `pushState` → AK 8 rot (`history.length`)
  - m10 Folge absteigend → AK 7 rot („Lauf 4 von 6“ an T1)
  - m11 Filterstand fällt beim Live-Ereignis weg → AK 6 rot
  - m12 Sprung in eine verborgene Zeile ohne Umschalten der Filter → AK 6 rot (Fokus nicht auf der Zeile)
  - m13 Filterwechsel ohne Ansage → AK 4 rot (kein „14 von 14 Einträgen sichtbar.“)
  - m14 Ansage nach dem Blättern ohne „Lauf <k> von <n>“ → AK 8 rot
  - m15 Filter beim Blättern auf die Vorgabe zurückgesetzt → AK 8 rot („nur Fehler“ bei T4 nicht angehakt)
  - m16 Abstand zwischen den Teilen als `gap` statt Linie im Teil → AK 10 rot (T11 bei 320 px läuft über)
- **Regression:** Die Tests von R00221, R00234, R00237 und R00238 bleiben ohne geänderte Erwartung, bis auf R00234 AK 8 (Hinweise).

## Abhängigkeiten

- Abhängig von: [R00234](R00234-laufansicht-ergebnis-und-dauer.md) (I0224: Auswertung, Lücken, Fehler, „Längste Schritte“, Sprung); [R00238](R00238-laufansicht-tokens-je-lauf-und-schritt.md) (I0228, Karte #263: Listenfunktion für beide Listen, „Teuerste Schritte“). Gebaut wird auf dem Stand nach #263 (`braucht:263`, N3 Punkt 6).
- Blockiert: Karte #261 (`braucht:253`, Beschriftung mit der Absicht über die Listenfunktion).

## Offene Fragen

Die Fragen 1–6 der ersten Fassung hat der PO entschieden (`AI-Team/po-entscheidungen.md` Z. 581–586): 1, 2, 4, 5 und 6 wie empfohlen, 3 abweichend (Filter beim Blättern mitnehmen, FA 6). Nach der UX-Vorprüfung entschieden: Ansage des Filterwechsels (Z. 587), gesperrte Arten-Kästchen unter „nur Fehler“ (Z. 588), Wortlaut der Ansage beim Blättern (Z. 589), Bericht vor der Gliederung unter 641 px (Z. 590).

Offen, ohne den Bau aufzuhalten:

1. **Ansage beim Sprung** (UX-Vorprüfung S2 a): Schaltet der Sprung Kästchen um, sagt er das bisher nicht an (FA 9, wie R00234 AK 9). Vorschlag des ux-reviewer: ein Satz im Statusbereich, etwa „„Werkzeuge“ eingeblendet, „nur Fehler“ ausgeschaltet.“
2. **Sichtbarer Zähler unter „Zeigen“** (UX-Vorprüfung S1): „13 von 14 Einträgen“ gedämpft unter den Kästchen. Z. 584 und 587 lassen die leere Liste ohne eigenen Satz; ein sichtbarer Zähler wäre neue Gestaltung.

## Manuelle Vorbereitungstätigkeiten

- Bauen erst, wenn #263 auf `main` ist (`braucht:263`). Der Zweig `karte/253` wird vorher auf `main` gebracht.
- Beobachtung Tempo tagsüber einplanen (8–21 Uhr, Last ≤ 2).

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 (Laufansicht) um Zeitachse, Filter und Blättern nachführen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Entwurf „Laufansicht – Vorschlag“ des Betreibers, Scheibe B (PO Z. 522). Nach R00234 sieht der Mensch je Lauf die Summen und die drei längsten Schritte. Wo im Lauf die Zeit lag, sieht er nicht, und durch 185 Aufrufe muss er rollen. Die Zeitachse ordnet jede Lücke aus derselben Auswertung ihrer Art und Lage zu. Ein langes Werkzeugstück am Ende zeigt so einen Wartebefehl, ein Warten in der Mitte eine Rückfrage. Der Filter „nur Fehler“ zeigt die gescheiterten Schritte direkt unter dem Bericht, und wer abnimmt, sieht sofort, ob „bestanden“ zu ihnen passt. Mit dem Blättern prüft er alle Läufe der Karte nacheinander, ohne den Rückweg über „Läufe“.

## Notizen

- **Verworfene Alternativen** (N1 „Optionen zu den Abschnitten“): R (Abschnitte aus Werkzeugen und Pfaden ableiten), F (neues Feld `abschnitt`). Der Betreiber hat „ohne Abschnitte“ entschieden (PO Z. 517).
- **Filter über Neuzeichnen** verworfen: Die Insel bliebe nicht derselbe Knoten (ADR-0041 Punkt 5, Q4), Klappzustand und Lage gingen verloren.
- **Zehn Kriterien** (Schlank arbeiten). Weitere Grenzfälle der Zeitachse gehören dem entwickler.
