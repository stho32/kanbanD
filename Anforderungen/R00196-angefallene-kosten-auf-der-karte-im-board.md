---
id: R00196
status: Erledigt
datum: 2026-11-18
---

# R00196: Angefallene Kosten auf der Karte im Board

## Beschreibung

Herkunft: Karte #201 (Betreiber als Product Owner, 2026-11-18): „Ich hab auf einem Board ein paar Karten auf denen Gemeinkosten gebucht sind. Ich sehe die Kosten auf dem Tab Kosten im Kartendetail aber nicht auf der Karte im Board. Warum?“ Die Karte im Board zeigt heute nur das Preisetikett, also die Schätzung ([R00105](R00105-preisetikett-und-kostenbericht.md)); Kosteneinträge ([R00165](R00165-kosteneintraege-mit-zeitstempel-rolle-und-spalte.md)) stehen nur in der Ansicht „Kosten“ des Aufgabenfensters und im Bericht „Kosten“.

**Gewünscht:** Eine Karte mit angefallenen Kosten zeigt deren Summe auch im Board, in der Kartenzeile neben dem Preisetikett. Regeln (Entscheidungen des product-owner, `AI-Team/po-entscheidungen.md`, 2026-11-18, #201 Fragen 1–4):

1. **Beides nebeneinander.** Das Preisetikett „≈ …“ bleibt, wie es ist; die angefallene Summe steht zusätzlich dahinter, vor „Σ“. Nur Kosteneinträge → nur die Summe; nur Schätzung → nur das Etikett; ohne beides nichts (kein „0,00 $“).
2. **Dieselbe Zahl wie im ungefilterten Bericht „Kosten“.** Kosteneinträge plus alte Posten (`cost.items`); tragen die Posten eine Spanne, steht eine Spanne („5,06–5,16 $“), sonst ein Betrag. Die Karte zählt immer alle Einträge der Aufgabe; Zeitraum und Spaltenabschnitt des Berichts wirken auf sie nicht.
3. **Je Währung ein Betrag**, USD zuerst, danach alphabetisch nach ISO-Code, ohne Umrechnung; alle Währungen stehen sichtbar auf der Karte.
4. **Name für Hilfstechnik** als visuell versteckter Text: „Angefallene Kosten: 4,66 $“, bei Spanne „Angefallene Kosten: 5,06 bis 5,16 $“, bei mehreren Währungen ein Name mit allen Beträgen, durch Komma getrennt. Sichtbar steht nur der Betrag bzw. die Spanne, ohne „≈“ und ohne das Wort „angefallen“; der sichtbare Teil ist `aria-hidden`, kein `aria-label`.

> **In Kauf genommen (PO, Frage 2):** Stammt das Preisetikett einer Karte allein aus alten Posten, stehen dieselben Posten als Schätzung („≈ 0,45 $“) und als angefallen („0,40–0,50 $“) nebeneinander — keine Sonderregel.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“ (was ein Agent über die API bucht, sieht der Mensch im Browser) und „Live überall, egal woher die Änderung kommt“. Baut auf R00165 (Kosteneinträge, Rechnung der angefallenen Kosten) und R00105 (Preisetikett auf der Karte). Keine Technikfrage, kein ADR (architekt, Kommentar an #201). Optionen: entfallen — die vier Produktfragen sind entschieden.

## Akzeptanzkriterien

**Ausgangslage** (Rechenbeispiel aus R00165 Teil C, um #5 erweitert; über die API herstellbar: `PATCH cost`, `POST /api/aufgaben/{nr}/kosteneintraege`): Board „fabrik“ mit „Eingang“, „Entwicklung“, „Fertig“.

| Aufgabe | Spalte | Schätzung (`cost`) | Kosteneinträge | Karte zeigt |
|---|---|---|---|---|
| #1 | Entwicklung | — | 3,46 USD (13.11. 10:34), 1,20 USD (13.11. 11:02) | „4,66 $“ |
| #2 | Fertig | alte Posten: Planung 0,10–0,20, Bau 0,30 USD | — | „≈ 0,45 $“ und „0,40–0,50 $“ |
| #3 | Eingang | `amount: 1.63` USD | — | „≈ 1,63 $“ |
| #4 | Eingang | — | — | keinen Betrag |
| #5 | Eingang | `amount: 2.00` USD | 2,00 EUR, 1,00 USD, 0,50 USD (alle 13.11.); 46 Minuten gebuchte Zeit | „≈ 2,00 $“, „1,50 $“, „2,00 €“, „Σ 0:46“ |

- [x] **AK 1 Nur Kosteneinträge:** Die Karte #1 zeigt im Board „Ist 4,66 $“ (3,46 + 1,20; das Kennzeichen „Ist“ steht nach der Zeichnung D0002 `#angefallene-kosten` einmal vor dem ersten angefallenen Betrag), ohne „≈“ und ohne Preisetikett.
- [x] **AK 2 Alte Posten und Spanne:** Die Karte #2 zeigt „≈ 0,45 $“ (Mitte (40 + 50 + 1) ÷ 2 abgerundet = 45 Cent, wie bisher) und dahinter „Ist 0,40–0,50 $“. Bekommt #2 über die API den Kosteneintrag 4,66 USD, zeigt die Karte ohne Neuladen „Ist 5,06–5,16 $“ (4,66 + 0,40; 4,66 + 0,50).
- [x] **AK 3 Nur Schätzung, nichts:** Die Karte #3 zeigt nur „≈ 1,63 $“. Die Karte #4 zeigt keinen Betrag, kein „0,00 $“ und kein leeres Element für angefallene Kosten.
- [x] **AK 4 Schätzung, mehrere Währungen, Reihenfolge:** Die Karte #5 zeigt in dieser Reihenfolge „≈ 2,00 $“, „Ist 1,50 $ ·“ (1,00 + 0,50), „2,00 €“, „Σ 0:46“ — sichtbarer Text nach der Zeichnung „≈ 2,00 $ Ist 1,50 $ · 2,00 € Σ 0:46“, zwischen den drei Gruppen kein Komma; USD vor EUR, keine Umrechnung, kein Betrag fehlt.
- [x] **AK 5 Name für Hilfstechnik:** Der Name der angefallenen Kosten lautet an #1 „Angefallene Kosten: 4,66 $“, an #2 „Angefallene Kosten: 0,40 bis 0,50 $“, an #5 „Angefallene Kosten: 1,50 $, 2,00 €“. Er steht als visuell versteckter Text im Element; der sichtbare Teil trägt `aria-hidden="true"`, das Element kein `aria-label`. Gegenprobe: der sichtbare Text der Karte #1 (`innerText`) enthält „4,66 $“, aber nicht „Angefallene Kosten“. Der Name des Preisetiketts („Preisetikett: geschätzt …, API-Kosten“) bleibt unverändert.
- [x] **AK 6 Dieselbe Zahl wie der Bericht, unabhängig vom Berichtszeitraum:** Die Beträge der Karten ergeben je Währung die Summe des ungefilterten Berichts „Kosten“ für „fabrik“: USD 4,66 + 0,40–0,50 + 1,50 = „6,56–6,66 $“, EUR „2,00 €“. Ist im Bericht der Zeitraum 14.11.–14.11. gewählt (kein Eintrag darin), zeigen die Karten im Board weiter dieselben Beträge.
- [x] **AK 7 Schmal, Hell und Dunkel:** Bei 320 px Breite zeigt #5 alle drei Beträge und „Σ 0:46“; kein Betrag bricht in sich um (Zahl bzw. Spanne und Währungszeichen stehen in einer Zeile), Karte und Seite scrollen nicht quer ([R00187](R00187-schmale-breite-320-bis-414-px-kein-querscrollen-nichts-abgeschnitten.md)). Anordnung, Abstände und Trennzeichen folgen dem freigegebenen Artboard `Dokumentation/Wireframes/D0002.dc.html`, Zustand „Angefallene Kosten auf der Karte“; Schätzung und angefallene Summe sind sehend unterscheidbar (mindestens „≈“ an der Schätzung); Kontrast der Beträge mindestens 4,5:1 in Hell und Dunkel.
- [x] **AK 8 Nichts sonst ändert sich:** Eine Karte ohne Kosteneinträge und ohne alte Posten sieht aus wie vorher, samt Komma-Regel aus R00105 („≈ 1,10 $, Σ 0:46“; die Spec `e2e/tests/r00105-preisetikett.spec.js` bleibt unverändert grün). Die Anzeige schreibt nichts: keine Aufgabendatei ändert sich, kein Commit entsteht. Defekte Karten zeigen keinen Betrag.

## Tests

Unit in `e2e/einheit/kosten.test.js` (Texte je Aufgabe der Ausgangslage, #2 mit zusätzlichem Eintrag, Reihenfolge der Währungen, Leerfall liefert nichts); E2E neue Spec `e2e/tests/r00196-angefallen-auf-der-karte.spec.js` an der Ausgangslage (AK 1–8, 320 px, Name aus dem Zugänglichkeitsbaum). Kein Rust-Test: Server und Dateiformat bleiben unberührt.

## Implementierungshinweise

- **Keine zweite Summenlogik:** `angefalleneKosten(a, bereich)` (`web/kosten.js:153`) ohne gesetzten Bereich liefert je Währung Einträge und Spanne der alten Posten; die Summe je Währung ist „Einträge + Posten“ wie in `mitSumme` (`web/kosten.js:175`). Die Funktion ist heute nicht exportiert. Text über `spanne(niedrig, hoch, waehrung, '–')` bzw. `' bis '` für den Namen (`web/kosten.js:30`) — am 2026-11-18 mit den Werten der Ausgangslage geprobt: „4,66 $“, „0,40–0,50 $“, „5,06 bis 5,16 $“, „2,00 €“.
- **Daten sind da:** das Board hat alle Aufgaben samt `kosteneintraege` über `GET /api/aufgaben` (`web/app.js:302`); keine neue Route, kein neues Feld.
- **Zeichenstück:** neben `vPreisetikett` und `vSumme` (`web/ansicht.js:758–772`), eingesetzt in `.r3 .rechts` (`web/ansicht.js:808`); Muster für den versteckten Namen: `<span class="vh">` + `aria-hidden` wie am Preisetikett. Das Komma des Preisetiketts hängt heute davon ab, ob „Σ“ folgt (`vPreisetikett(a, vorSumme)`); was zwischen Etikett, angefallener Summe und „Σ“ steht, legt das Artboard fest. Währung und Betrag kommen aus der Aufgabendatei: maskiert einsetzen (`esc`).
- **Zeichnung zuerst:** Zustand „Angefallene Kosten auf der Karte“ in `Dokumentation/Wireframes/D0002.dc.html` (gestalter; Fälle #1, #2, #5, 320 px, Hell und Dunkel), Freigabe durch den product-owner, danach bauen.
- **Nicht hinein:** Summe in der Aufgabenliste oder im Spaltenkopf · Kosteneinträge im Board anlegen oder ändern · Umrechnung · Filter oder Zeitraum für die Karte · Änderung am Preisetikett, am Bericht oder an der Ansicht „Kosten“.
- Am Code gelesen; gefahren nur die Textfunktionen.

## Abhängigkeiten

R00165 (I0155, erledigt), R00105 (I0093, erledigt); Artboard D0002 (offen).

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung den Absatz „In Kauf genommen“ wörtlich sagen.

## Warum löst diese Anforderung das Problem?

Auslöser: Der Betreiber bucht Gemeinkosten als Kosteneinträge auf Karten, sieht im Board aber keinen Betrag, weil die Karte nur die Schätzung zeigt. Zeigt die Karte die Summe der angefallenen Kosten mit der Rechnung des Berichts (X), steht der Betrag dort, wo er das Board ohnehin liest (Y), und er muss keine Karte mehr öffnen, um zu sehen, auf welchen Karten Kosten liegen und wie viel (Z).

## Offene Fragen

Keine. Die Anordnung in der Kartenzeile zeichnet der gestalter; sie ist Teil von AK 7.
