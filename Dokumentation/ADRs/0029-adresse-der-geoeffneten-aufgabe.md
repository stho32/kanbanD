# ADR-0029: Adresse der geöffneten Aufgabe — `#/board/<slug>/aufgabe/<nr>` als Zusage, die Adresse ist beim Laden die Wahrheit

**Status**: Akzeptiert
**Datum**: 2026-11-16
**Entscheider**: Claude (autonom, architekt, Auftrag Betreiber, Karte #153)
**Kontext-Anforderung**: Karte #153 „Direktlinks auf Aufgaben“ (Wortlaut des Betreibers); Anforderung und WBS-Interaction folgen über den planer (neue Interaction unter D0003 Aufgabe).
**Erprobt durch**: — (die Form folgt der bestehenden Systemantwort `#/wbs/<kürzel>/<id>`, `web/wbs.js:156`, `web/app.js:274`; das Nachführen über `history.pushState` ist gelesen, nicht geprobt — die Probe sind die Kriterien der Anforderung)
**Nachträge**: keine

## Kontext

- Die Oberfläche kennt nur Hash-Adressen: `#/board/<slug>`, `#/aufgaben`, `#/personen`, `#/einrichten`, `#/berichte/<name>`, `#/wbs/<kürzel>[/<id>]` (`web/app.js:114–118`, `:222`). Jede Änderung lädt über `hashchange` neu (`web/app.js:2633`).
- Das Aufgabenfenster ist reiner Sichtzustand `S.ui.offen` (`web/app.js:789`, `:1704`, `:1718`); die Adresse ändert sich beim Öffnen nicht, und keine Adresse öffnet es. Eine Adresse `#/board/<slug>/aufgabe/7` zeigt heute das Board ohne Fenster, weil beide Ausdrücke nur den Anfang lesen (gelesen, nicht geprobt).
- Ein unbekannter Slug fällt heute still auf das erste Board (`web/app.js:227`).
- Der Slug ist Identität und bleibt beim Umbenennen (ADR-0022); die Nummer einer Aufgabe wird nie neu vergeben. Beide taugen deshalb für eine Adresse, die in E-Mails und Chats weiterlebt.
- Die Adresse wird weitergegeben (E-Mail, localchatA) und von Agenten aus Slug und Nummer selbst gebildet — sie ist ab der ersten Auslieferung eine Zusage nach außen und nur mit Bruch fremder Links umkehrbar.

## Optionen

1. **Adresse wird nachgeführt, dazu „Link kopieren“** — der Link steht immer in der Adresszeile, Zurück/Vor und Lesezeichen wirken; Schwäche: ein zweiter Weg, den Sichtzustand zu setzen, muss mit Entwurf und Ebenen (ADR-0010) zusammenspielen.
2. **Nur „Link kopieren“, Adresszeile bleibt** — kleinster Eingriff; Schwäche: ohne sicheren Kontext (`http://<rechnername>:7420`) gibt es keine Zwischenablage und damit gar keinen Weg zum Link.
3. **Pfad-Adressen (`/board/<slug>/aufgabe/<nr>`)** — schönere Links; Schwäche: bricht alle bestehenden Hash-Adressen und verlangt Routen im Server.

## Entscheidung

Option 1.

1. **Form**: `#/board/<slug>/aufgabe/<nr>` (Board mit geöffnetem Fenster) und `#/aufgaben/aufgabe/<nr>` (Aufgabenliste mit geöffnetem Fenster, für Aufgaben ohne Board). `<nr>` sind nur Ziffern. Alle bisherigen Adressen bleiben gültig und unverändert.
2. **Eine Richtung je Anlass**: beim Laden und bei `hashchange` (Link, Zurück/Vor, Eingabe) ist die Adresse die Wahrheit — eine reine Funktion liest Nummer und Board aus dem Hash und setzt das Fenster. Öffnet oder schließt der Mensch das Fenster, schreibt die Aktion die Adresse als neuen Verlaufseintrag, ohne neu zu laden (`history.pushState`).
3. **Nur Navigation**: eine Adresse löst nie einen schreibenden Aufruf aus; Text aus der Adresse wird nie angezeigt — Meldungen nennen nur die geprüfte Nummer.
4. **Der Host** ist `location.origin` des Betrachters; kanbanD kennt keinen „richtigen“ Host.
5. Die Form steht in der README unter „Für Agenten“.

Akzeptierte Schwäche: die Adresse trägt nur Board und Aufgabe, nicht Filter, Reiter oder Archivansicht — der Empfänger sieht das Board mit seinen eigenen Sichteinstellungen.

## Konsequenzen

- Weitere Adressteile (Reiter, Filter) kommen nur hinter `/aufgabe/<nr>` oder als neuer Abschnitt dazu; die beiden Formen ändern sich nicht mehr.
- Durchsetzung: ein E2E-Test öffnet beide Formen in einem frischen Tab und prüft Board und Fenster; ein Einheitentest der Lesefunktion deckt fremde Zeichen, fehlende und überlange Nummern ab.

## Quellen / Bezüge

- `web/app.js:114–118`, `:222–228`, `:316–330`, `:780–793`, `:1704`, `:1718`, `:2192`, `:2633`, `:2738`; `web/wbs.js:156`; `e2e/tests/r00057-wirkungen.spec.js:47–50`
- ADR-0022 (Slug bleibt), ADR-0010 (Ebenen und Esc), ADR-0014 (nur die neueste Antwort)
