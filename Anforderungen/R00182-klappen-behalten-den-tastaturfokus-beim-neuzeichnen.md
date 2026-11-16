---
id: R00182
status: Neu
datum: 2026-11-16
---

# R00182: Aufgeklappte Abschnitte behalten den Tastaturfokus, wenn die Seite neu zeichnet

## Beschreibung

Herkunft: Karte #191 (aus #141, dort aus #167). Wer per Tastatur im Bericht „Kosten“ auf einer Klappe „Kosten je Rolle“ steht, verliert den Fokus, sobald ein Agent irgendetwas ändert, und muss von vorn durch die Seite tabben. Befund am Code (Stand 2026-11-16, gelesen): Die Kopfzeile einer Klappe (`summary`) trägt keinen Schlüssel, unter dem das Neuzeichnen sie wiederfindet (`web/ansicht.js:1679`, `:1683`; Schlüsselregel `web/sichtzustand.js:22–48`). Dasselbe gilt für die Klappen „Tabellenansicht“ (`:1373`, `:1941`, `:2054`), Fluss (`:1419`, `:1573`), „Zonengrenzen“ des Fever Charts (`:2000`) und das Board-Archiv (`:523`). Fehlender Umfang, kein Fehler: [R00172](R00172-kostenbericht-kosten-je-rolle-aufklappen.md) AK 6 verlangt nur, dass Tab jede Klappe erreicht.

**Gewünscht:** Nach einem [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) steht der Fokus auf derselben Klappe. Regel: ADR-0010 Nachtrag N10 Ziffer 1 — jedes per Tab erreichbare Element trägt einen im Bereich eindeutigen Schlüssel; fehlt er, ist das ein Befund am Markup, kein neuer Mechanismus.

Eine Zeichnung ist nicht nötig: es entsteht kein neues Bedienelement. Zahlt ein auf: [Vision](R00000-vision.md) — die Live-Anzeige nimmt dem Menschen nichts weg.

## Akzeptanzkriterien

**Ausgangslage:** Board mit Kosteneinträgen zweier Rollen in einer Währung (Rollen „entwickler“ und „planer“, wie in `e2e/tests/r00172-kosten-je-rolle.spec.js` über die API angelegt); Bericht „Kosten“ offen. Der fremde Schreibzugriff ist ein zweiter Teilnehmer, der über die API den Titel einer Aufgabe ändert.

- [ ] **AK 1 Fokus bleibt auf der Klappe (Abnahme-Probe der Karte, heute rot):** Gegeben: Bericht „Kosten“ mit zwei Rollen, die Klappe einer Rolle ist offen und trägt den Fokus. Wenn: ein fremder Schreibzugriff an einer Aufgabe eintrifft und die Seite neu zeichnet. Dann: der Fokus steht auf derselben Klappe (nicht auf der Seite), sie ist weiter offen; die Leertaste klappt sie zu.
- [ ] **AK 2 Varianten:** Dasselbe gilt für die äußere Klappe „Kosten je Rolle“, für „Tabellenansicht“ im Burndown und für eine geschlossene Klappe mit Fokus (sie bleibt geschlossen, die Leertaste öffnet sie).
- [ ] **AK 3 Sammelprobe (Wächter für N10 Ziffer 1, heute rot):** In den Berichten und im Aufgabenfenster hat jedes per Tab erreichbare Element einen Schlüssel (`schluessel(…) !== ''`). Was die Probe darüber hinaus findet, bekommt einen `data-halt`, wenn es eine Zeile Markup ist; sonst steht es als Liste im Bericht. Zusätzliche Zeile: nach einem Board-Wechsel liegt der Fokus nicht auf `BODY` (vom architekt nur gelesen, nicht geprobt — heute unbekannt).
- [ ] **AK 4 Bleibt:** Die bestehenden Tests zu Fokus, Sichtzustand und Kostenbericht laufen unverändert grün.

## Tests

E2E als Spec: AK 1 zuerst rot, dann die Varianten, dann die Sammelprobe (Vorbild für das Abtasten aller tabbaren Elemente: `e2e/tests/r00106-fokus-raster.spec.js`). Unit nur, falls sich die Schlüsselregel ändert (`e2e/einheit/sichtzustand.test.js`).

## Implementierungshinweise

- Vorschlag aus N10 Ziffer 1, keine Vorschrift: `data-halt` an der `summary`, z. B. `klappe:<Kennung>`. Am Code gelesen, nicht gefahren.
- **Schadensstelle:** Ein `data-halt` hält nur, wenn er im Bereich eindeutig ist (ADR-0007 N3 Regel 4) — der Schlüssel nimmt die Kennung, nicht den Titel: „Tabellenansicht“ heißt in mehreren Berichten gleich (Fluss hat zwei Klappen dieses Namens, `:1419` und `:1573`); bei den Rollen trägt `data-kr` (Währung/Rolle) die Kennung.
- **Nicht hinein:** Klappzustand der Klappen außerhalb des Kostenberichts über das Neuzeichnen (am Code gelesen: nur „Kosten je Rolle“ hält ihn, `web/app.js:71`) · Aufschieben des Zeichnens (N10 Ziffer 2, Karten #189 und #180) · vorgemerktes Fokusziel (N10 Ziffer 3).

## Warum löst diese Anforderung das Problem?

Auslöser: Die Klappe ist nach dem Neuzeichnen ein neues Element, und der Sicherer findet sie ohne Schlüssel nicht wieder. Trägt jede Klappe einen eindeutigen Schlüssel (X), setzt der Sicherer den Fokus nach dem Zeichnen auf dieselbe Klappe (Y); wer per Tastatur liest, bleibt an seiner Stelle, auch wenn Agenten nebenher schreiben (Z). Die Sammelprobe hält die Regel für künftige Elemente.

## Offene Fragen

Keine.
