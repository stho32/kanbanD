---
id: R00065
status: Erledigt
datum: 2026-10-19
---

# R00065: Mehrfachauswahl auf dem Board

## Beschreibung

Wie im Windows-Explorer lassen sich auf dem Board mehrere Karten auswählen — mit Strg + Klick einzeln, mit Umschalt + Klick als Reihe — und dann gemeinsam bearbeiten: über das Rechtsklick-Menü als Massenaktion oder per Ziehen an ein neues Ziel. Jede Massenaktion ist ein Commit und mit einem Strg + Z rückgängig, wo die Einzelaktion das auch ist.

Löst ab: aus R00026 die Belegung Umschalt + ↑ / ↓ für „mit der Nachbarkarte tauschen“ (jetzt Alt + ↑ / ↓).

Zahlt ein auf: [Vision](R00000-vision.md) — „bedienbar ohne Umweg“ und „Ein eigenes Design, früh vom Menschen gesehen“.

## Geschäftlicher Nutzen

Aufräumen, Verteilen und Weiterziehen vieler Karten (nach einem Planungstermin, beim Sprintwechsel) dauert einen Zug statt einen je Karte, und die Versionsgeschichte zeigt einen Commit statt zwanzig.

## Funktionale Anforderungen

- **Strg + Klick** (macOS: Cmd + Klick) nimmt eine Karte in die Auswahl auf oder heraus und setzt den Anker.
- **Umschalt + Klick** wählt alle sichtbaren Karten vom Anker bis zur angeklickten — in Lesereihenfolge: Spalte für Spalte von links nach rechts, darin von oben nach unten. Strg + Umschalt + Klick ergänzt die Reihe zur bestehenden Auswahl. Ohne Anker gilt die fokussierte Karte als Anker.
- **Umschalt + ↑ / ↓** auf einer fokussierten Karte erweitert die Auswahl in der Spalte und bewegt den Fokus mit. Das Tauschen mit der Nachbarkarte, bisher Umschalt + ↑ / ↓ (R00026), wandert auf **Alt + ↑ / ↓**; Umschalt + ← / → behält seine bisherige Bedeutung.
- Ein **normaler Klick** auf eine Karte öffnet sie wie bisher und hebt die Auswahl auf; **Esc** und ein Klick auf eine freie Fläche heben sie ebenfalls auf; ein Wechsel von Board oder Sicht verwirft sie.
- Ausgewählte Karten tragen eine deutliche Markierung und `aria-selected="true"`; die Statuszeile zeigt „n Karten ausgewählt“.
- **Rechtsklick auf eine ausgewählte Karte** (bei mindestens zwei ausgewählten) öffnet das Menü „n Karten“: Verschieben nach ▸, Klasse ▸, Fälligkeit ▸, Zuständige zuweisen …, Mir zuweisen, Auf Board legen ▸, Archivieren. Rechtsklick auf eine nicht ausgewählte Karte hebt die Auswahl auf und öffnet das Einzelmenü.
- **Zuständige zuweisen …** öffnet den Dialog aus R00064 für alle ausgewählten Karten: angehakt ist, wer auf allen zuständig ist, teilweise gewählt (`aria-checked="mixed"`), wer auf einigen zuständig ist. Ein teilweise gewähltes Kästchen bleibt beim Speichern unverändert je Karte; ein Klick schaltet es auf „alle“, ein weiterer auf „keine“.
- **Verschieben nach**, **Klasse**, **Fälligkeit**, **Mir zuweisen**, **Zuständige**: ein Commit für alle Karten. **Auf Board legen**: ein Commit, Karten, die dort schon liegen, bleiben unberührt. **Archivieren**: ein Commit wie „Spalte archivieren“, rückgängig mit Strg + Z.
- **Ziehen** einer ausgewählten Karte nimmt alle ausgewählten mit; sie landen an der Einfügemarke der Zielspalte untereinander in Lesereihenfolge — ein Commit, rückgängig mit einem Strg + Z (jede Karte zurück an ihre alte Stelle). Ziehen einer nicht ausgewählten Karte bewegt nur sie.
- Nach einer Massenaktion bleibt die Auswahl bestehen (außer nach Archivieren), damit weitere Aktionen folgen können.
- Server: `POST /api/boards/{slug}/bewegen-mehrere {ziele: [{nummer, spalte, index}]}` — nimmt alle genannten Karten heraus und setzt sie der Reihe nach an `index` ihrer Spalte; ein Commit; Antwort `{bewegt, warnungen}` wie beim einzelnen Zug. `PATCH /api/aufgaben/mehrere {aenderungen: [{nummer, …Felder wie PATCH /api/aufgaben/{nr}}]}` — ein Commit. `POST /api/boards/{slug}/aufgaben/mehrere {nummern, spalte?}` — ein Commit.
- Nicht enthalten: Mehrfachauswahl in der Aufgabenliste (eigene Anforderung), Timer für mehrere Karten.

## Akzeptanzkriterien

- [x] Strg + Klick auf #1 und #3 → beide ausgewählt, Statuszeile „2 Karten ausgewählt“, kein Aufgabenfenster offen; erneutes Strg + Klick auf #3 nimmt sie heraus
- [x] Umschalt + Klick von #1 (Spalte A) bis #4 (Spalte B) wählt die Lesereihenfolge dazwischen; Esc hebt die Auswahl auf
- [x] Umschalt + ↓ auf einer fokussierten Karte erweitert die Auswahl um die nächste Karte der Spalte, ohne zu verschieben; Alt + ↑ tauscht mit der Nachbarkarte
- [x] Menümodell: „n Karten“ mit den genannten Einträgen; Verschieben, Klasse, Fälligkeit tragen die Nummernliste im Argument
- [x] Massen-Verschieben über das Menü → alle Karten in der Zielspalte, ein Commit; Strg + Z stellt die alten Plätze her
- [x] Ziehen einer ausgewählten Karte bewegt alle ausgewählten an die Einfügemarke in Lesereihenfolge, ein Commit; Strg + Z stellt sie wieder her
- [x] Massen-Klasse, -Fälligkeit, -Mir zuweisen: ein Commit `#a, #b geändert: …`
- [x] Dialog für mehrere Karten: gemischtes Kästchen bleibt beim Speichern je Karte unverändert; angehakt setzt auf allen, abgewählt nimmt auf allen ab
- [x] Massen-Archivieren: ein Commit, Strg + Z holt alle zurück
- [x] Massen-Auf-Board-legen: ein Commit, schon liegende Karten unberührt
- [x] Server: `bewegen-mehrere`, `PATCH mehrere` und `aufgaben/mehrere` je ein Commit, fehlerhafte Angaben (unbekannte Spalte, Karte nicht auf dem Board, ungültiges Feld) ändern nichts

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/dienst/bewegen.rs`, `src/dienst/aufgabe_aendern.rs`, `src/dienst/zuordnung.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`; `web/menue.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/mehrfach.rs`, `e2e/einheit/menue.test.js`, `e2e/tests/r00065-mehrfachauswahl.spec.js`.

## Abhängigkeiten
- Abhängig von: R00033, R00064

## Offene Fragen
- keine
