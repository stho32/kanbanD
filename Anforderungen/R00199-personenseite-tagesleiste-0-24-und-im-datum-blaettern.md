---
id: R00199
status: Offen
datum: 2026-11-19
---

# R00199: Personenseite — Tagesleiste 0–24 Uhr und im Datum blättern

## Beschreibung

Herkunft: Karte #204, Folgeanforderung zu [R00021 Personenübersicht](R00021-personenuebersicht.md). Die Seite „Personen“ (Artboard D0005) zeigt je Person eine Tagesleiste von 6 bis 20 Uhr mit den Zeiten von heute. Nachtläufe der Agenten fallen aus der Leiste, und ein anderer Tag lässt sich nicht ansehen.

**Auftrag des Betreibers als Product Owner, 2026-11-19, wörtlich:** „Ich hätte gerne 0-24 Uhr (Agenten arbeiten schließlich auch nachts) außerdem hätte ich gerne die Möglichkeit im Datum vor und zurückzublättern“. Zuschnitt des product-owner: `AI-Team/po-entscheidungen.md` Z. 333–338; Nachträge aus der UX-Vorprüfung und der Freigabe der Zeichnung Z. 339–346.

**Gewünscht — Regeln:**

1. **Leiste 0–24 Uhr.** Die Tagesleiste reicht von 0 Uhr bis 0 Uhr des Folgetags (Ortszeit), Marken alle 3 Stunden (0, 3, 6, 9, 12, 15, 18, 21, 24), Breite 380 px wie bisher. An Umstelltagen zählt die echte Länge des Tages (23 bzw. 25 Stunden), die Marken stehen auf den echten Ortszeit-Stunden. Die Jetzt-Marke steht nur an heute. Hinweis rechts: „Tagesleiste 0–24 Uhr · schraffiert = läuft“. Quer scrollt bei schmaler Breite weiter nur der Rahmen „Personen“; die Kopfleiste scrollt nie quer.
2. **Blättern Tag für Tag, höchstens bis heute.** Neben dem Datum („Do 19.11.2026“) führt „‹“ zum vorigen und „›“ zum nächsten Tag; an heute ist „›“ deaktiviert. Der Knopf „Heute“ führt zurück und ist nur wirksam, wenn nicht heute gewählt ist. Wer mit „›“ bei heute ankommt, ist auf „heute“ (nicht auf einem festen Datum).
   - **Gruppe:** „‹ Datum › Heute“ ist das erste Kind der Kopfleiste `.leiste`, das Datum steht in `--kd-text` (nicht gedämpft; PO Z. 340). Die Gruppe bricht bei schmaler Breite nur als Ganzes um, das Datum wird nicht gekürzt; DOM-Reihenfolge = Tab-Reihenfolge „‹“, „›“, „Heute“ (PO Z. 343).
   - **Fokus beim Blättern:** Der Fokus bleibt auf dem betätigten Knopf. Wird dieser dadurch deaktiviert („›“ bei Ankunft an heute, „Heute“), geht der Fokus auf „‹“, nie auf `body` (PO Z. 341, WCAG 2.4.3).
   - **Ansage:** Das Datum steht in einem beständigen Knoten mit `aria-live="polite"`, der beim Blättern nur seinen Text wechselt; so sagt ein Bildschirmleser den neuen Tag an (PO Z. 344, WCAG 4.1.3).
3. **Der Tag gehört zum Tab, nicht zur Adresse.** Gemerkt wird „heute“ oder ein festes Datum, wie die Woche des Stundenzettels: ein Seitenwechsel im Tab behält ihn, Neuladen zeigt heute. Wer heute sieht, sieht nach Mitternacht ohne Neuladen den neuen Tag; ein festes Datum bleibt stehen.
4. **Summen folgen dem Tag.** Die Tagesspalte zählt den gewählten Tag (laufende Einträge bis jetzt, höchstens bis Tagesende); die Wochenspalte zählt die ganze Kalenderwoche des gewählten Tages (Montag 0 Uhr bis Sonntag 24 Uhr, laufende Einträge bis jetzt). Spaltenköpfe: an heute „heute“ und „Woche“ wie bisher; an einem anderen Tag trägt die Tagesspalte das Kurzdatum („Di 17.11.“), die Wochenspalte heißt „Woche“ und nennt die Spanne als Titel und Namen („Woche 16.11.–22.11.“).
5. **Ein vergangener Tag ist Rückschau.** Zwei Gruppen: „AKTIV AM Di 17.11.“ (Zeit an dem Tag > 0, auch durch einen damals laufenden Eintrag) und „RUHIG AM Di 17.11.“. Keine Gruppe „läuft jetzt“, kein Stopp-Knopf, kein Laufchip, keine Jetzt-Marke. „Gerade“ zeigt „zuletzt HH:MM“ — das letzte Ende eines Eintrags an diesem Tag — oder „—“, wenn an dem Tag kein Eintrag endet. Ein Eintrag, der über das Tagesende hinaus reicht, steht in der Leiste bis 24 Uhr; schraffiert ist er nur nach Regel 7.
6. **Was bleibt, wie es ist.** „zugewiesen offen“ zeigt an jedem Tag den heutigen Stand (keine Rückrechnung). Heute zeigt die Seite alles wie bisher (drei Gruppen, Stopp, Laufchip mit Vergessen-Kennzeichen nach R00114, „zuletzt …“ wie bisher). Umschalter, „Stillgelegte einblenden“ und der Klick auf eine Person wirken an jedem Tag wie bisher. Zeiten archivierter Aufgaben zählen mit (wie bisher).
7. **Schraffiert ist nur, was jetzt läuft** (an jedem Tag, PO Z. 342). Ein Abschnitt ist schraffiert genau dann, wenn sein Eintrag im Augenblick der Anzeige läuft; ein beendeter Eintrag ist nicht schraffiert, auch wenn er über das Tagesende reichte. Beispiel Mo 16.11.: Claudes beendeter Nachtlauf 23:00 – 02:00 steht von 95,83 % bis 100 % unschraffiert; Mi 18.11.: Claudes Lauf seit 21:00 läuft noch und steht von 87,5 % bis 100 % schraffiert. So gilt der Hinweis „schraffiert = läuft“ wörtlich.

**Außen vor** (PO Z. 337): Datumswähler oder Kalender, Zukunft, Tag in der Adresse, Tastenkürzel, Wochen- oder Mehrtagesleiste, Zoom der Leiste, rückgerechnetes „zugewiesen offen“, Berichtsfilter auf der Personenseite, Änderungen an Gruppen, Umschaltern und dem Personen-Filter-Klick. Verworfen aus der UX-Vorprüfung: feine Linien an den 3-Stunden-Marken (PO Z. 345) und eine sichtbare Wochenspanne statt Titel und Namen (PO Z. 346). Bestand, eigene Bugkarte: Umbruch des Umschalters bei 320 px und Kontrast der Skalenmarken (PO Z. 347).

**Verhältnis zu R00021** (bleibt abgenommen, die neuere Regel geht vor): „Tagesleiste von 6 bis 20 Uhr mit den heutigen Zeiten“ wird zu Regel 1; FA 1 „heute ab 0 Uhr, Woche ab Montag 0 Uhr“ gilt für den gewählten Tag nach Regel 4; FA 3 (Gruppen) gilt für heute, an einem vergangenen Tag gilt Regel 5. Alle übrigen Zusagen von R00021 gelten weiter.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“ und „Zeiterfassung, die zum Arbeiten passt“ (die Nachtarbeit der Agenten wird so sichtbar wie die Tagarbeit der Menschen; was gestern geschah, lässt sich nachsehen). Technik vom architekt vorgegeben (Kartenkommentar #204), kein ADR, keine API. Optionen: entfallen — der Zuschnitt ist entschieden (PO Z. 333–338), die Bauform vom architekt vorgegeben.

### Domänenbezug

Live-Ereignis ([D00005](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)). Neue Fachbegriffe: keine („Tag“, „Woche“, „zuletzt“ wie in R00021).

## Geschäftlicher Nutzen

Der Betreiber sieht auf einen Blick, wann Menschen und Agenten gearbeitet haben, auch nachts, und kann frühere Tage nachsehen, ohne in einen Bericht zu wechseln.

## Akzeptanzkriterien

**Ausgangslage** (über Aufgabendateien herstellbar; Uhr des Browsers Do 19.11.2026 14:00, Ortszeit Europe/Berlin; Personen Stefan `st` (Mensch, ich), Mia `mi` (Mensch), Claude `cl` (Agent)); Board „Entwicklung“ mit „Zu erledigen“, „In Arbeit“, „Erledigt“:

| Aufgabe | Spalte | Zuständig | Zeiteinträge |
|---|---|---|---|
| #1 | In Arbeit | st | st Di 17.11. 09:00–10:30; st seit Do 19.11. 13:30 (läuft) |
| #2 | Zu erledigen | mi, cl | cl Mo 16.11. 23:00 – Di 17.11. 02:00; cl seit Mi 18.11. 21:00 (läuft) |
| #3 | archiviert | mi | mi Mo 16.11. 08:00–08:30 |

Erwartete Werte (Tag / Woche / Gerade; Woche 16.11.–22.11., für So 15.11. Woche 09.11.–15.11.):

| Tag | Stefan | Claude | Mia |
|---|---|---|---|
| Do 19.11. (heute) | 0:30 / 2:00 / läuft #1 | 14:00 / 20:00 / läuft #2 | 0:00 / 0:30 / zuletzt 16.11.2026 |
| Mi 18.11. | 0:00 / 2:00 / — | 3:00 / 20:00 / — | 0:00 / 0:30 / — |
| Di 17.11. | 1:30 / 2:00 / zuletzt 10:30 | 2:00 / 20:00 / zuletzt 02:00 | 0:00 / 0:30 / — |
| Mo 16.11. | 0:00 / 2:00 / — | 1:00 / 20:00 / — | 0:30 / 0:30 / zuletzt 08:30 |
| So 15.11. | 0:00 / 0:00 / — | 0:00 / 0:00 / — | 0:00 / 0:00 / — |

Rechnung Claude Woche: Mo 23–24 (1:00) + Di 0–2 (2:00) + Mi 21–24 (3:00) + Do 0–14 (14:00) = 20:00. Stefan Woche: 1:30 + 0:30 = 2:00. Mia: 0:30 aus der archivierten #3.

- [ ] **AK 1 Leiste 0–24 Uhr:** Gegeben die Ausgangslage, wenn heute angesehen wird, dann trägt die Leiste die Marken 0, 3, 6, 9, 12, 15, 18, 21, 24 (bei 0 %, 12,5 %, 25 %, …, 100 %), die Jetzt-Marke steht bei 58,33 % (14 / 24), Claudes Abschnitt reicht von 0 % bis 58,33 % schraffiert, und der Hinweis lautet „Tagesleiste 0–24 Uhr · schraffiert = läuft“. Die Leiste ist 380 px breit.
- [ ] **AK 2 Lage der Abschnitte:** Gegeben Di 17.11., wenn der Tag angesehen wird, dann beginnt Stefans Abschnitt bei 37,5 % (9 / 24) mit der Breite 6,25 % (1,5 / 24), Claudes Nachtlauf reicht von 0 % bis 8,33 % (2 / 24) und ist nicht schraffiert. Gegeben Mi 18.11., dann reicht Claudes Abschnitt schraffiert von 87,5 % bis 100 % (sein Eintrag läuft jetzt noch). Gegeben Mo 16.11., dann reicht Claudes Abschnitt von 95,83 % (23 / 24) bis 100 % und ist nicht schraffiert (beendet, reichte nur über das Tagesende; Regel 7). Jeder Abschnitt trägt den Titel „#n“ seiner Aufgabe wie bisher.
- [ ] **AK 3 Blättern:** Gegeben heute, wenn zweimal zurückgeblättert wird, dann steht „Mi 18.11.2026“ und danach „Di 17.11.2026“, die Tagesspalte heißt „Di 17.11.“; einmal vorgeblättert steht wieder „Mi 18.11.2026“. Viermal von heute zurück steht „So 15.11.2026“.
- [ ] **AK 4 Summen des gewählten Tages und seiner Woche:** Gegeben die Tage der Tabelle, wenn jeder angesehen wird, dann stehen Tag- und Wochensumme jeder Person wie in der Tabelle; an So 15.11. sind alle Wochensummen 0:00, und die Wochenspalte nennt als Titel und Namen „Woche 09.11.–15.11.“, an Di 17.11. „Woche 16.11.–22.11.“.
- [ ] **AK 5 Vergangener Tag als Rückschau:** Gegeben Di 17.11., wenn der Tag angesehen wird, dann stehen Stefan und Claude unter „AKTIV AM Di 17.11. · 2 Personen“ und Mia unter „RUHIG AM Di 17.11. · 1 Person“; es gibt keine Gruppe „LÄUFT JETZT“, keinen Stopp-Knopf, keinen Laufchip und keine Jetzt-Marke, obwohl #1 und #2 gerade laufen, und kein Abschnitt ist schraffiert (beide Einträge des Tages sind beendet). „Gerade“ zeigt „zuletzt 10:30“, „zuletzt 02:00“ und „—“. Gegeben Mi 18.11., dann steht Claude unter „AKTIV AM Mi 18.11.“ mit „—“ (sein Eintrag endet an diesem Tag nicht), sein Abschnitt ist schraffiert (Regel 7).
- [ ] **AK 6 Grenze heute:** Gegeben heute, dann ist „›“ deaktiviert und „Heute“ wirkungslos (deaktiviert). Gegeben Di 17.11., wenn zweimal vorgeblättert wird, dann steht „Do 19.11.2026“, „›“ ist deaktiviert und die Seite zeigt heute (Spaltenkopf „heute“, Gruppe „LÄUFT JETZT“). Gegeben So 15.11., wenn „Heute“ gewählt wird, dann steht „Do 19.11.2026“. Einen Tag nach heute gibt es nicht.
- [ ] **AK 6a Fokus beim Blättern:** Gegeben Di 17.11.: Steht der Fokus mit Tab auf „›“ und wird zweimal Enter gedrückt, dann steht „Do 19.11.2026“, „›“ ist deaktiviert und der Fokus steht auf „‹“ (nicht auf `body`). Gegeben So 15.11.: Wird „Heute“ mit Enter oder per Tipp gewählt, steht der Fokus auf „‹“. Gegeben Mi 18.11.: Wird „‹“ gewählt, bleibt der Fokus auf „‹“. Geprüft im E2E mit Tastatur und mit `hasTouch`.
- [ ] **AK 6b Ansage des neuen Tages:** Gegeben Di 17.11., dann steht „Di 17.11.2026“ in einem Knoten mit `aria-live="polite"`. Wird „‹“ gewählt, dann trägt derselbe Knoten (dasselbe Element, nicht neu erzeugt) den Text „Mo 16.11.2026“ und weiter `aria-live="polite"`.
- [ ] **AK 7 Tag im Tab, nicht in der Adresse:** Gegeben Di 17.11., wenn ins Board und zurück zu „Personen“ gewechselt wird, dann steht weiter „Di 17.11.2026“, und die Adresse ist dieselbe wie an heute (`#/personen`). Wird die Seite neu geladen, steht „Do 19.11.2026“.
- [ ] **AK 8 „zugewiesen offen“ und archivierte Zeiten:** Gegeben Mo 16.11. und heute, wenn beide angesehen werden, dann zeigt „zugewiesen offen“ an beiden Tagen Stefan „1 · 1 begonnen“, Mia „1 · 0 begonnen“ und Claude „1 · 0 begonnen“ (heutiger Stand; #3 ist archiviert und zählt nicht als offen), und Mias 0:30 aus der archivierten #3 zählen an Mo 16.11. als Tag und als Woche.
- [ ] **AK 9 Umstelltage:** Gegeben ein Eintrag So 25.10.2026 23:15–23:45 (der Tag hat 25 Stunden), wenn der 25.10. angesehen wird, dann zählt der Tag 0:30, der Abschnitt beginnt bei 97 % (24,25 / 25), die Marke „3“ steht bei 16 % (03:00 Uhr ist 4 Stunden nach 0 Uhr), und die Woche 19.10.–25.10. zählt 0:30. Gegeben ein Eintrag So 29.03.2026 22:00 – Mo 30.03.2026 01:00 (der 29.03. hat 23 Stunden), dann zählt der 29.03. 2:00 (nicht 3:00) und der 30.03. 1:00, und am 29.03. steht die Marke „3“ bei 8,70 % (2 / 23).
- [ ] **AK 10 Heute und das Übrige unverändert:** Gegeben heute, dann zeigt die Seite die drei Gruppen wie bisher (Stefan und Claude unter „LÄUFT JETZT · 2 Timer“, Mia unter „HEUTE RUHIG“ mit „zuletzt 16.11.2026“), Stefans Timer lässt sich stoppen, Claudes Laufchip trägt das Vergessen-Kennzeichen nach R00114 (läuft seit 17 Stunden). Gegeben Di 17.11., wenn „nur Agenten“ gewählt wird, dann steht nur Claude da; ein Klick auf „Mia“ zeigt das Board mit Filter `@mi` wie bisher. Die Anzeige schreibt nichts (keine Aufgabendatei ändert sich, kein Commit).
- [ ] **AK 11 Ein Durchlauf über die Zeiten:** Gegeben 5.000 Aufgaben mit zusammen N Zeiteinträgen und 1, 10 bzw. 30 gezeigten Personen, wenn die Zeilen eines gewählten Tages gerechnet werden, dann wird jeder Zeiteintrag höchstens zweimal in einen Zeitpunkt umgewandelt (Zähler ≤ 2 × N, bei allen drei Personenzahlen; heute rot: allein die Anteile für Tag, Woche und Abschnitte wandeln jeden Eintrag dreimal je zweifach um).
- [ ] **AK 12 Mitternacht und Live-Ereignis:** Gegeben heute und die Uhr Do 19.11.2026 23:59:30, wenn eine Minute vergeht, dann steht ohne Neuladen „Fr 20.11.2026“ mit Spaltenkopf „heute“ und „›“ deaktiviert; gegeben stattdessen Di 17.11., dann steht danach weiter „Di 17.11.2026“. Gegeben Di 17.11., wenn über die API für Mia an #2 eine Zeit 15:00–16:00 am 17.11.2026 nachgetragen wird, dann steht Mia ohne Neuladen unter „AKTIV AM Di 17.11.“ mit 1:00, „zuletzt 16:00“ und Woche 1:30.
- [ ] **AK 13 Schmale Breite und Tab-Reihenfolge:** Gegeben Di 17.11. bei 320, 375 und 414 px Breite mit Touch (`hasTouch`), dann ist die Gruppe „‹ Datum › Heute“ das erste Kind der `.leiste`; „‹“, „Di 17.11.2026“, „›“ und „Heute“ stehen in einer Zeile (gleiche Oberkante; bricht die Gruppe um, dann nur als Ganzes); das Datum steht vollständig (Text „Di 17.11.2026“, ohne Auslassung, `scrollWidth` ≤ `clientWidth` des Datumsknotens) in der Farbe `--kd-text`; `scrollWidth` der `.leiste` ist ≤ ihrem `clientWidth`. Mit Tab erreicht man nacheinander „‹“, „›“, „Heute“, und das ist auch ihre DOM-Reihenfolge.

## Betroffene Verzeichnisstruktur

`web/zeiten.js` (rein), `web/ansicht.js` (`vPersonen`), `web/app.js` (Aktionen, Takt), `web/kd-app.css` (falls die Zeichnung es verlangt); Unit-Tests `e2e/einheit/zeiten.test.js`, E2E neu `e2e/tests/r00199-personen-tag-blaettern.spec.js`.

## Technische Überlegungen

Vorgaben des architekt (Kartenkommentar #204, am Code gelesen):

- **Signatur:** `personenZeilen(aufgaben, personen, board, tag, jetzt)` bleibt rein. Ein laufender Eintrag zählt bis `min(jetzt, Tagesende)`.
- **Tagesgrenzen** über die Ortszeit (`setDate(+1)`) statt `t0 + 864e5` (`web/zeiten.js:55`); ebenso das Wochenende (`setDate(+7)`). Umstelltage 29.03. und 25.10. sind Testfälle.
- **Keine API:** `GET /api/aufgaben` liefert archivierte Aufgaben mit ihren Zeiten (`web/app.js:302`, `src/web/endpunkte.rs:59`).
- **Lastprofil:** bei 5.000 Aufgaben braucht `personenZeilen` auf main im p95 648 ms; eine Variante mit einem Durchlauf (einmal gruppieren, einmal parsen) kam auf 117 ms. Vorgabe: genau ein Durchlauf; abgenommen wird der Zähler aus AK 11, die Wanduhr ist Beobachtung, kein Gate.
- **Live:** jedes Live-Ereignis zeichnet die Seite neu, auch an einem vergangenen Tag.
- **Mitternacht:** `S.ui.personenTag = null` heißt „heute“; ändert sich der Tagesbeginn, zeichnet der Takt (`web/app.js:3853`) die Seite neu.
- **Leiste:** Marken auf echten Ortszeit-Stunden, `pos = (t − t0) / (t1 − t0)`; Jetzt-Marke nur heute; `zuletzt` am vergangenen Tag = letztes Ende in `[t0, t1)`.

### Grobentwurf

- `personenZeilen(aufgaben, personen, board, tag, jetzt)` → je Person `{ person, laeuft, tag, woche, abschnitte, offen, begonnen, zuletzt, gruppe }` — Feldnamen entscheidet der Entwickler.
- Tagesgrenzen als kleine reine Hilfen neben `tagesbeginn`/`wochenbeginn`.
- `vPersonen` liest `S.ui.personenTag`; Aktion zum Blättern wie `woche` (`web/app.js:2242`).

## Tests

- **Unit** (`e2e/einheit/zeiten.test.js`, `process.env.TZ = 'Europe/Berlin'`): Tagesgrenzen und Woche an 17.11., 15.11., 29.03., 25.10.; Werte der Tabelle; Gruppen am vergangenen Tag; `zuletzt`; Zähler der Umwandlungen bei 1, 10, 30 Personen (AK 2, 4, 5, 8, 9, 11). Der bestehende Aufruf `personenZeilen(aufgaben, personen, board, jetzt)` wird auf die neue Signatur umgestellt, nicht gelöscht.
- **E2E** (neue Spec mit `page.clock`, Uhr gestellt wie `e2e/tests/r00114-vergessene-timer.spec.js:25`): AK 1–3, 5–7 (mit 6a, 6b), 10, 12, 13 an der Ausgangslage; AK 6a mit Tastatur und mit `hasTouch`, AK 13 in drei Breiten mit `hasTouch`. `e2e/tests/r00021-personen.spec.js` und `e2e/tests/r00114-vergessene-timer.spec.js` bleiben unverändert grün.
- Kein Rust-Test: Server und Dateiformat bleiben unberührt.

## Implementierungshinweise

- Gestaltung: Artboard `Dokumentation/Wireframes/D0005.dc.html`, Zustand `#tagesleiste-blaettern` (Commit 2bf29421; Kopfleiste mit ‹ Datum › Heute, Skala 0–24, vergangener Tag; Bilder tb-heute, tb-vergangen, tb-schraffur, tb-320, tb-fokus), vom product-owner am 2026-11-19 **freigegeben mit Änderung** (PO Z. 339). Die Änderungen sind hier eingearbeitet (Regel 2: Gruppe, Fokus, Ansage; Regel 7: Schraffur; AK 2, 5, 6a, 6b, 13); die Zeichnung zeigt sie schon bis auf die unsichtbare Ansage, ein Nachzeichnen ist nicht nötig. B0978 und B0979 sind damit baubar. Wo Artboard und diese Anforderung abweichen, gilt diese Anforderung.
- Blätterknöpfe in der Größe der vorhandenen `btn-sym` mit `aria-label` („voriger Tag“, „nächster Tag“), Bedienmuster des Stundenzettels (`web/ansicht.js:1246`); Datum über `datumMitWochentag` (`web/kultur.js:42`).
- **Nicht hinein:** Router und Adresse (ADR-0029), Server, Berichtsfilter, Stundenzettel, Gruppen und Umschalter an heute.
- Am Code gelesen, nicht gefahren.

## Abhängigkeiten

R00021 (I0021, erledigt), R00114 (Laufchip mit Vergessen-Kennzeichen, erledigt).

## Manuelle Vorbereitungstätigkeiten

Keine mehr: die Zeichnung an D0005 `#tagesleiste-blaettern` ist freigegeben mit Änderung (PO Z. 339).

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem?

Auslöser: Agenten arbeiten nachts (Claudes Lauf Mo 23:00 – Di 02:00), die Leiste zeigt aber nur 6–20 Uhr und nur heute. Reicht die Leiste von 0 bis 24 Uhr (X), stehen Nachtläufe sichtbar neben der Tagarbeit (Y); lässt sich Tag für Tag zurückblättern und folgen Tag- und Wochensumme dem gewählten Tag (X), sieht der Betreiber auch, wer gestern und vorgestern wann gearbeitet hat (Y) — ohne den Stundenzettel jeder Person einzeln zu öffnen (Z).

## Offene Fragen

Keine. Die Produktfragen sind entschieden (PO Z. 333–338, Nachträge Z. 339–346), die Technik ist vorgegeben (architekt, Karte #204).
