---
id: R00165
status: Erledigt
datum: 2026-11-15
---

# R00165: Kosteneinträge mit Zeitstempel, Rolle und Spalte

## Beschreibung

Auftrag des Betreibers (2026-11-15, Karte #166), wörtlich:

> „Wenn sich die Kostenposten so noch nicht zuordnen lassen, dann sollten wir das System so ändern, dass sie es zukünftig können. Vielleicht wie zeiteinträge? Das man zu einem bestimmten Zeitpunkt (zum Verschieben in die nächste Spalte) die kosten in der vorherigen Spalte als ein expliziter Eintrag mit Zeitstempel vermerkt: 13.11. 10:34 entwickler Spalte „Entwicklung“ 3,46$“

**Umfang:** Eine Aufgabe trägt eine Liste von **Kosteneinträgen** — je Rollenlauf einer, mit Zeitpunkt, Rolle, Spalte und Betrag. Ein Agent oder ein Mensch legt sie über die API an, ändert und löscht sie; das Aufgabenfenster zeigt sie in der Ansicht „Kosten“, und der Bericht „Kosten“ zählt ab jetzt **angefallene** Kosten statt geschätzter. Format, Kennung, Routen und Statuscodes stehen in [ADR-0028](../Dokumentation/ADRs/0028-kosteneintraege-als-eigener-schluessel-mit-kennung-und-eigener-route.md) und werden hier nicht wiederholt.

> **Schutz des Nutzers: Kein bestehender Kostenposten geht verloren oder wird umgeschrieben (AK 6 und AK 7). Der erste Test des Baus ist der Rundlauf einer alten Datei.**

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf [R00105](R00105-preisetikett-und-kostenbericht.md) (Preisetikett und Kostenbericht), R00090 (Zeiteinträge mit Kennung, Vorbild) und R00084 (Zeitpunkte).

**Beispiel in der Datei** — eine alte Aufgabe mit Posten, die danach einen Eintrag bekommt; der Abschnitt `cost` bleibt, wie er war:

```yaml
cost:
  currency: USD
  items:
    - {text: Planung, min: 0.10, max: 0.20}
    - {text: Bau, amount: 0.30}
cost-entries:
  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD}
```

**Beispiel-Aufruf** (Kopfzeile `X-KanbanD-Wer` wie bei den Zeiteinträgen):

```
POST /api/aufgaben/1/kosteneintraege
{"at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "amount": 3.46, "currency": "USD"}
→ 200, Aufgabe mit kosteneintraege: [{…, "kennung": "entwickler@2026-11-13T10:34+01:00"}]
```

## Akzeptanzkriterien

**Ausgangslage:** Board „fabrik“ mit den Spalten „Eingang“, „Entwicklung“, „Fertig“; #1 in „Entwicklung“, ohne Kosten. Zeitpunkte in der Ortszeit des Servers (im Beispiel +01:00).

### Teil A — Einträge stehen an der Aufgabe und bleiben erhalten (I0153)

- [x] **AK 1a Lesen:** Steht der Eintrag des Beispiels in der Datei von #1, dann liefert `GET /api/aufgaben/1` ihn unter `kosteneintraege` mit `kennung: entwickler@2026-11-13T10:34+01:00`; ohne Einträge liefert es `[]`.
- [x] **AK 6 Alte Posten bleiben:** Gegeben #2 mit `cost.items` (Planung 0,10–0,20, Bau 0,30 USD, über `PATCH cost` gesetzt) und ohne Einträge: sie ist lesbar und nicht defekt; nach einer Änderung des Titels steht der Abschnitt `cost` zeichengleich in der Datei, und es ist kein Eintrag entstanden.
- [x] **AK 7 `PATCH cost` berührt die Einträge nie:** Gegeben #1 mit dem Eintrag des Beispiels: nach `PATCH cost` mit `{currency: "USD", amount: 2.00}` und danach mit `cost: null` steht die Zeile unter `cost-entries` unverändert in der Datei, und `GET` liefert den Eintrag weiter.
- [x] **AK 8 Spalte umbenannt:** Wird „Entwicklung“ nach dem Eintrag in „Bau“ umbenannt, steht im Eintrag weiter `column: Entwicklung`, und #1 ist nicht defekt.

### Teil B — Anlegen, ändern, löschen über die API (I0154)

- [x] **AK 1 Anlegen (Abnahme-Probe der Karte):** Der Beispiel-Aufruf ergibt 200; an #1 steht die Zeile des Beispiels unter `cost-entries`; es ist genau ein Commit entstanden; `GET /api/aufgaben/1` liefert den Eintrag mit `kennung`.
- [x] **AK 2 Zweiter Lauf:** Ein zweiter Aufruf mit `at: 2026-11-13 11:02+01:00` und `amount: 1.20` (gleiche Rolle, gleiche Spalte) ergibt einen zweiten Eintrag; der erste ist unverändert.
- [x] **AK 3 Ungültig:** `amount: -1` oder `column: "Gibtsnicht"` ergibt 400; es entsteht kein Commit, die Datei ist unverändert.
- [x] **AK 4 Kennung:** Derselbe Aufruf ein zweites Mal ergibt 409, nichts wird geschrieben. `PATCH` und `DELETE` auf `…/kosteneintraege/niemand@2026-11-13T10:34+01:00` ergeben 404.
- [x] **AK 5 Ändern und Löschen:** `PATCH …/kosteneintraege/entwickler@2026-11-13T10:34+01:00` mit `{amount: 3.50}` schreibt `amount: 3.50` (ein Commit); `DELETE` auf dieselbe Kennung entfernt den Eintrag (ein Commit), `GET` liefert ihn nicht mehr.

### Teil C — Bericht und Ansicht „Kosten“ (I0155)

**Rechenbeispiel:** #1 in „Entwicklung“ mit den Einträgen 3,46 USD (13.11. 10:34) und 1,20 USD (13.11. 11:02); #2 in „Fertig“ mit den alten Posten aus AK 6 (0,40–0,50 USD); #3 in „Eingang“ nur mit der Schätzung `{currency: USD, amount: 1.63}`; #4 in „Eingang“ ohne Kosten.

- [x] **AK 9 Bericht zählt angefallene Kosten:** Der Bericht „Kosten“ für „fabrik“ zeigt für USD „Einträge 4,66 $“, eine eigene Zeile „ohne Datum / ohne Rolle / ohne Spalte 0,40–0,50 $“ für die alten Posten und „Summe 5,06–5,16 $ · 2 von 4 Aufgaben mit angefallenen Kosten“ (4,66 + 0,40 = 5,06; 4,66 + 0,50 = 5,16). #3 zählt nicht; ihre Karte zeigt weiter „≈ 1,63 $“. Je Währung eine solche Gruppe, ohne Umrechnung. Die Texte des Berichts sagen „angefallene“ statt „geschätzte“ Kosten.
- [x] **AK 10 Ansicht „Kosten“ zeigt die Einträge:** Im Aufgabenfenster von #1 zeigt die Ansicht „Kosten“ je Eintrag Zeitpunkt, Rolle, Spalte und Betrag („13.11.2026 10:34 · entwickler · Entwicklung · 3,46 $“) und die Summe „4,66 $“; sie wird auch angeboten, wenn die Aufgabe Einträge, aber kein Preisetikett trägt, und ist nur lesend.

## Abgelöst aus R00105

Der Bericht zählt angefallene statt geschätzte Kosten. Damit gelten aus [R00105](R00105-preisetikett-und-kostenbericht.md) nicht mehr:

- **Funktionale Anforderungen „Kostenbericht“:** „n sind davon die mit Etikett“, die Summenzeile „… n von m Aufgaben mit Etikett“, die Kopfleiste „geschätzte API-Kosten“, die Menübeschreibung „Geschätzte API-Kosten je Währung …“ und der Leerzustand „Keine Aufgabe mit Preisetikett“ samt Hinweis auf das Feld `cost`.
- **Akzeptanzkriterien „Kostenbericht“** (Z. 161–166, 168, 170, 171, 173, 174): alle Summen über Schätzungen (Grundbestand „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett“), der Leerzustand-Text und die Aktualisierung nach `PATCH cost` mit `amount`.
- **Akzeptanzkriterien „Filterleiste im Kostenbericht“** (Z. 181–191) und die Kriterien zu Währungsreihenfolge und schmalen Breiten (Z. 175–178): die **Regel bleibt** (m, Filter, Umfangstext, Zählwort, USD zuerst, Zurücksetzen, kein Querscrollen), nur der Beispielbestand muss angefallene Kosten tragen.
- **Akzeptanzkriterium „Reiter Kosten“, Leerfall** (Z. 139): „Kosten“ fehlt im Ansichtsmenü nur noch, wenn die Aufgabe weder Etikett noch Einträge trägt.

Unverändert bleiben: `cost` mit `currency`, `basis`, Schätzung und Posten, `PATCH cost`, das Preisetikett auf der Karte und die Tabelle der geschätzten Kosten in der Ansicht „Kosten“.

## Tests

- **Zuerst:** Rundlauf einer Datei mit `cost.items` und `cost-entries` (ADR-0028, „Durchsetzung“); `tests/kosten.rs` bleibt ohne geänderte Erwartung grün — es ist die Wache für AK 6 und AK 7.
- **Erwartung ändert sich** (im Commit so benennen): `e2e/einheit/kosten.test.js`, die sieben Tests zu `kostenbericht` (Z. 98–165: n und Summen über Schätzungen); `e2e/tests/r00105-kostenbericht.spec.js`, zehn Tests mit 21 Stellen „Summe …“, „mit Etikett“, „Keine Aufgabe mit Preisetikett“, „geschätzte API-Kosten“ (US-9, US-10, US-11, US-14 zweimal, US-18, US-19 zweimal, US-20, US-24). Trägt der Grundbestand dieser Spec seine Beträge als alte Posten statt als Schätzung, bleiben die Summen 2,23–3,23 $ stehen, und nur die Wörter ändern sich.
- **Keine geänderte Erwartung:** `e2e/tests/r00105-preisetikett.spec.js`, `tests/` (Rust).

## Implementierungshinweise

- Die drei Teile sind einzeln lieferbar: A zuerst, B und C danach nebeneinander (C stellt seinen Bestand über Dateien her und braucht B nicht).
- Fundstellen: ADR-0028, „Kontext“ und „Quellen“; Bericht `web/kosten.js:61–74`, `web/ansicht.js:1345–1364`. Am Code gelesen, nicht gefahren — die erste Bubble jedes Teils ist deshalb eine Probe am heutigen Stand.
- **Gestaltung Teil C:** folgt dem bestehenden Reiter Kosten (R00105) und der bestehenden Berichtstabelle (heute Summenzeilen je Währung); die Zeichnung klärt der Director getrennt.
- **Nicht hinein:** Bericht nach Zeitraum (#165) · Kosten je Rolle (#167) · Nachtragen und Korrigieren im Aufgabenfenster · Umstellung der Factory auf die neue Route · Überführen alter Posten in Einträge · Währungsumrechnung.

## Offene Fragen

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: Der Bericht „Kosten“ nennt andere Zahlen als bisher — Schätzungen zählen nicht mehr, alte Posten stehen in der Zeile „ohne Datum / ohne Rolle / ohne Spalte“.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Ein Kostenposten sagt heute nur „Bau 0,30 $“ — wann, durch welche Rolle und in welcher Spalte er anfiel, steht nirgends. Schreibt jeder Rollenlauf einen Eintrag mit Zeitpunkt, Rolle und Spalte (X), liegen die Kosten zuordenbar in der Datei (Y), und die Folgekarten können nach Zeitraum (#165) und Rolle (#167) rechnen (Z). Weil alte Posten wörtlich stehen bleiben und sichtbar als „ohne Datum / ohne Rolle / ohne Spalte“ zählen, fehlt dabei kein Betrag.

## Notizen

- Heimat: I0153 (AK 1a, 6, 7, 8) und I0154 (AK 1–5) unter D0007, I0155 (AK 9, 10) unter D0006. Die Nummern der Kriterien folgen der Liste des architekt.
- Optionen: im ADR-0028 entschieden (eigener Schlüssel statt Liste unter `cost` oder Codeblock).
