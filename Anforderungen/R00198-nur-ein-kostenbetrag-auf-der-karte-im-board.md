---
id: R00198
status: Neu
datum: 2026-11-19
---

# R00198: Nur ein Kostenbetrag auf der Karte im Board — Preisetikett entfällt, sobald „Ist“ da ist

## Beschreibung

Herkunft: Karte #203, Kurskorrektur zu [R00196](R00196-angefallene-kosten-auf-der-karte-im-board.md) (Karte #201). Seit R00196 zeigt eine Karte im Board das Preisetikett „≈ …“ ([R00105](R00105-preisetikett-und-kostenbericht.md)) und die angefallenen Kosten „Ist …“ nebeneinander. Auf Boards, deren Karten ihre Kosten als alte Posten (`cost.items`) tragen, steht dadurch derselbe Betrag zweimal auf der Karte („≈ 0,45 $ Ist 0,40–0,50 $“). Was R00196 als Sonderfall in Kauf nahm, ist dort der Normalfall.

**Entscheidung des Betreibers als Product Owner, 2026-11-19, wörtlich:** „3. Etikett ausblenden, sobald „Ist“ da ist. Die Karte zeigt nur noch „Ist …“, die Schätzung verschwindet aus der Kartenzeile.“ (`AI-Team/po-entscheidungen.md`, Zeilen 328–331).

**Gewünscht — Regeln:**

1. **„Ist“ verdrängt das Etikett.** Zeigt die Karte angefallene Kosten („Ist …“), steht in der Kartenzeile kein Preisetikett „≈ …“, gleich in welcher Währung Schätzung und angefallene Kosten stehen (PO Z. 331). Nur Schätzung → nur das Etikett, wie bisher; ohne beides nichts.
2. **„Ist“ bleibt, wie es ist** (PO Z. 329–330): dieselbe Zahl wie der ungefilterte Bericht „Kosten“, alte Posten zählen mit und stehen als Spanne („Ist 0,40–0,50 $“, keine Mitte, kein „≈“); je Währung ein Betrag, USD zuerst, danach alphabetisch nach ISO-Code; Name „Angefallene Kosten: …“ als versteckter Text.
3. **Die Schätzung geht nicht verloren:** sie bleibt im Reiter „Kosten“ des Aufgabenfensters lesbar (R00105) und zählt im Bericht „Kosten“ wie bisher.

**Verhältnis zu den Vorgängern** (beide bleiben abgenommen, die neuere Regel geht vor):

- R00196 Regel 1 „Beides nebeneinander“ und der Absatz „In Kauf genommen“ gelten nicht mehr; AK 2 und AK 4 von R00196 (#2 und #5 mit „≈ …“ vor „Ist …“) sind durch AK 2 und AK 4 dieser Anforderung ersetzt. Alle übrigen Zusagen von R00196 gelten weiter.
- R00105, Abschnitt „Preisetikett auf der Karte“: Das Etikett erscheint nur noch auf Karten ohne angefallene Kosten. Weil alte Posten als angefallen zählen (R00165), zeigt eine Karte mit Positionen kein Etikett mehr: das Kriterium „Positionen 0,10–0,20, 0,20–0,40 und 0,30 USD → Karte zeigt „≈ 0,75 $““ wird zu „Karte zeigt „Ist 0,60–0,90 $““. Mitte, Rundung, Name und Komma-Regel des Etiketts gelten unverändert, wo es erscheint.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“ (was ein Agent bucht, liest der Mensch im Board auf einen Blick, ohne denselben Betrag zweimal zu sehen). Keine Technikfrage, kein ADR (architekt). Optionen: entfallen — der Betreiber hat zwischen den Varianten entschieden (Variante 3).

## Akzeptanzkriterien

**Ausgangslage** (die von R00196, um #6 erweitert; über die API herstellbar: `PATCH cost`, `POST /api/aufgaben/{nr}/kosteneintraege`): Board „fabrik“ mit „Eingang“, „Entwicklung“, „Fertig“.

| Aufgabe | Spalte | Schätzung (`cost`) | Kosteneinträge | Karte zeigt (neu) | bisher (R00196) |
|---|---|---|---|---|---|
| #1 | Entwicklung | — | 3,46 USD, 1,20 USD (13.11.) | „Ist 4,66 $“ | gleich |
| #2 | Fertig | alte Posten: Planung 0,10–0,20, Bau 0,30 USD | — | „Ist 0,40–0,50 $“ | „≈ 0,45 $ Ist 0,40–0,50 $“ |
| #3 | Eingang | `amount: 1.63` USD | — | „≈ 1,63 $“ | gleich |
| #4 | Eingang | — | — | keinen Betrag | gleich |
| #5 | Eingang | `amount: 2.00` USD | 2,00 EUR, 1,00 USD, 0,50 USD (13.11.); 46 Minuten gebuchte Zeit | „Ist 1,50 $ · 2,00 € Σ 0:46“ | „≈ 2,00 $ Ist 1,50 $ · 2,00 € Σ 0:46“ |
| #6 | Eingang | `amount: 3.00` USD | 2,00 EUR (13.11.) | „Ist 2,00 €“ | „≈ 3,00 $ Ist 2,00 €“ |

- [ ] **AK 1 Nur Kosteneinträge:** Gegeben #1, wenn das Board angesehen wird, dann zeigt die Karte „Ist 4,66 $“ (3,46 + 1,20) und kein Preisetikett — wie bisher.
- [ ] **AK 2 Alte Posten zeigen nur „Ist“:** Gegeben #2, wenn das Board angesehen wird, dann zeigt die Karte nur „Ist 0,40–0,50 $“ (0,10 + 0,30; 0,20 + 0,30) — kein „≈ 0,45 $“, kein Preisetikett. Bekommt #2 über die API den Kosteneintrag 4,66 USD, zeigt die Karte ohne Neuladen „Ist 5,06–5,16 $“ und weiter kein Etikett.
- [ ] **AK 3 Übergang ohne Neuladen:** Gegeben #3 mit nur „≈ 1,63 $“, wenn über die API der Kosteneintrag 0,10 USD gebucht wird, dann zeigt die Karte ohne Neuladen „Ist 0,10 $“ und das Etikett „≈ 1,63 $“ ist verschwunden.
- [ ] **AK 4 Schätzung und Einträge, mehrere Währungen:** Gegeben #5, wenn das Board angesehen wird, dann lautet der sichtbare Kostentext der Kartenzeile „Ist 1,50 $ · 2,00 € Σ 0:46“ (1,00 + 0,50 USD; USD vor EUR, keine Umrechnung) — kein „≈ 2,00 $“, zwischen „2,00 €“ und „Σ“ kein Komma.
- [ ] **AK 5 Andere Währung verdrängt das Etikett auch:** Gegeben #6 mit Schätzung 3,00 USD und angefallen nur 2,00 EUR, wenn das Board angesehen wird, dann zeigt die Karte nur „Ist 2,00 €“ und kein „≈ 3,00 $“ (PO Z. 331: keine Abwägung je Währung).
- [ ] **AK 6 Nur Schätzung, nichts:** Gegeben #3, wenn das Board angesehen wird, dann zeigt die Karte nur „≈ 1,63 $“; gegeben eine Karte mit Spanne 0,60–1,60 USD und 46 Minuten gebuchter Zeit, dann „≈ 1,10 $, Σ 0:46“ (Komma-Regel aus R00105 unverändert). Gegeben #4, dann zeigt die Karte keinen Betrag, kein „0,00 $“ und kein leeres Element.
- [ ] **AK 7 Vorgelesen genau ein Betrag:** Gegeben #2 und #5, wenn die Kartenzeile mit Hilfstechnik gelesen wird, dann hört man an #2 „Angefallene Kosten: 0,40 bis 0,50 $“ und an #5 „Angefallene Kosten: 1,50 $, 2,00 €“, an keiner der beiden „Preisetikett: geschätzt …“. An #3 heißt das Etikett wie bisher „Preisetikett: geschätzt 1,63 $, API-Kosten“.
- [ ] **AK 8 Die Schätzung bleibt im Fenster und im Bericht:** Gegeben #5, wenn das Aufgabenfenster geöffnet wird, dann gibt es den Reiter „Kosten“ und er zeigt die Schätzung 2,00 $ wie bisher (R00105). Der ungefilterte Bericht „Kosten“ für „fabrik“ nennt dieselben Summen wie vor der Änderung (USD 4,66 + 0,40–0,50 + 1,50 = „6,56–6,66 $“; EUR 2,00 + 2,00 = „4,00 €“).
- [ ] **AK 9 Nichts sonst ändert sich:** Die Anzeige schreibt nichts (keine Aufgabendatei ändert sich, kein Commit entsteht). Bei 320 px zeigt #5 „Ist 1,50 $ · 2,00 €“ und „Σ 0:46“ ohne Querscrollen; kein Betrag bricht in sich um (R00196 AK 7 gilt weiter). Defekte Karten zeigen keinen Betrag.

## Tests

E2E neue Spec `e2e/tests/r00198-nur-ein-kostenbetrag-auf-der-karte.spec.js` an der Ausgangslage (AK 1–9; AK 3 mit Buchung über die API und Merker gegen Neuladen). Bestehende Specs, deren Erwartung diese Anforderung ändert, werden auf die neue Regel umgestellt, nicht gelöscht, und nennen R00198 im Testnamen oder Kommentar: `e2e/tests/r00196-angefallen-auf-der-karte.spec.js` (Erwartungen an #2 und #5 mit „≈ …“) und `e2e/tests/r00105-preisetikett.spec.js` (Karte mit Positionen „≈ 0,75 $“ → „Ist 0,60–0,90 $“, kein `.preis`). Kein Unit-Test nötig: `web/kosten.js` ändert sich nicht. Kein Rust-Test: Server und Dateiformat bleiben unberührt.

## Implementierungshinweise

- **Ort:** `vKarte` in `web/ansicht.js:846` — ist `angefallen` (aus `vAngefallen`) nicht leer, steht nur es in der Zeile; sonst `vPreisetikett(a, summe.length > 0)`. JSDoc von `vPreisetikett` (`web/ansicht.js:795`) nachziehen (der Satz „keine angefallenen Kosten dazwischen“ wird hinfällig). Vorgabe architekt.
- Die Regel ist identisch mit `nurSchaetzung` in `web/kosten.js:63` (Etikett genau dann, wenn Schätzung, aber weder Einträge noch alte Posten); maßgeblich für die Prüfung ist das sichtbare „Ist“.
- **Nicht hinein:** `web/kosten.js`, Reiter „Kosten“, Bericht „Kosten“, Name und Form von „Ist …“, Name, Mitte und Komma-Regel des Etiketts, Aufgabenliste.
- Zeichnung: Das Artboard `Dokumentation/Wireframes/D0002.dc.html`, Zustand `#angefallene-kosten`, zeigt heute das Nebeneinander; es wird vom gestalter nachgezogen. Für den Bau ist es nicht nötig (es fällt nur ein Element weg, keine neue Anordnung). Wo Artboard und diese Anforderung abweichen, gilt diese Anforderung.
- Am Code gelesen, nicht gefahren.

## Abhängigkeiten

R00196 (I0186, erledigt), R00105 (I0093, erledigt), R00165 (I0155, erledigt).

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem?

Auslöser: Auf den Boards des Betreibers tragen die Karten ihre Kosten als alte Posten; dieselben Posten erscheinen dann als Schätzung „≈ 0,45 $“ und als angefallen „Ist 0,40–0,50 $“. Verschwindet das Etikett, sobald „Ist“ da ist (X), steht auf jeder Karte genau ein Kostenbetrag (Y), und der Betreiber liest im Board nicht mehr zwei Zahlen für dasselbe Geld oder hält die Schätzung für einen zweiten Betrag (Z).

## Offene Fragen

Keine. Die Produktfragen sind entschieden (PO Z. 328–331).
