---
id: R00185
status: Neu
datum: 2026-11-16
---

# R00185: Herkunft entfernen mit Rückgängig, Fußmeldung bleibt stehen, Kartenname des vergessenen Timers stimmt

## Beschreibung

Paket „Rückgängig, Fußmeldung und Timer-Hinweise“ (product-owner 2026-11-15, `AI-Team/po-entscheidungen.md` Z. 247): Karte #102 führt, mit ihr werden #108 und #114 gebaut. Jedes Kriterium trägt die Nummer seiner Karte (`102-…`, `108-…`, `114-…`); ein Mitglied lässt sich herauslösen, ohne dass die anderen ihre Kriterien verlieren.

- **#102 Herkunft entfernen mit Rückgängig** (fehlender Umfang, Vorschlag des product-owner zu #12): Das ✕ an einer Herkunft im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) entfernt heute sofort und ohne Rückweg (`herkunft-weg`, `web/app.js:2264`). Es bekommt dasselbe [Rückgängig](../Dokumentation/Domaenenwissen/D00008-rueckgaengig.md) wie die vier Arten aus [R00112](R00112-entfernen-rueckgaengig-und-sichtbare-entfernen-knoepfe.md), nach ADR-0017 (Gegenaktion mit gemerktem Inhalt). Kein neues ADR, keine Zeichnung: es entsteht kein neues Bedienelement.
- **#108 Zwei stille Fehler aus #12** (falsch gebaut, Code-Review #12): (1) Rückgängig auf eine inzwischen gelöschte Aufgabe wirft einen TypeError, der Nutzer sieht nichts (`aufgabe(z.nummer).teilaufgaben`, `web/app.js:2025`). (2) Eine Fehlermeldung im Fuß des Fensters, die zu keinem Eingabefeld gehört, verschwindet mit dem nächsten angenommenen Schreibweg einer anderen Aktion (`meldungNachErfolgRaeumen`, `web/app.js:863`) — folgen zwei Aktionen dicht aufeinander, steht sie nur einen Augenblick. Für Meldungen mit abgelehnter Eingabe hat R00155 G-3 das schon gelöst; offen ist die Meldung ohne Feld.
- **#114 Kartenname des vergessenen Timers** (falsch gebaut, Code-Review #15): Der Takt schreibt nur den sichtbaren Text des Laufchips fort (`web/app.js:3604`); der Name der Karte für Hilfstechnik (`aria-label`, `web/ansicht.js:801`) nennt bis zum nächsten Zeichnen die alte Dauer.

**Weggefallen (am Code vom 2026-11-16 geprüft):** #114 Punkt 1 „bei mehreren fälligen Timern lebt der eigene Hinweis nur eine Sekunde“ — erledigt seit der Nacharbeit zu #15: eine stehende Erinnerung wartet ihre Lebensdauer ab (`hinweisBleibtStehen`, `web/app.js:3559`), belegt durch `e2e/tests/r00114-vergessene-timer.spec.js:629–631`.

Zahlt ein auf: [Vision](R00000-vision.md) — der Mensch bedient das Board ohne Angst vor dem versehentlichen Klick, und ein Fehlschlag wird gezeigt statt verschluckt.

## Akzeptanzkriterien

**Ausgangslage** (über die API herstellbar; „Ich bin Stefan“, Agent `cl`): #1 mit `origins: [I0001, R00014]` · #2 mit `origins: [I0001]` und den Teilaufgaben „a“, „b“ · #3 mit der Teilaufgabe „c“ und einem beendeten Zeiteintrag 09:00–10:00 von Stefan · #4 auf dem Board mit einem Timer von Stefan, der seit 10 Stunden 59 Minuten läuft.

- [ ] **102-1 Entfernen und Rückgängig (Abnahme-Probe der Karte, heute rot):** Bei #1 ✕ an `I0001` → die Datei hat `origins: [R00014]`, der [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md) (`.toast`) sagt „Herkunft I0001 entfernt“ und trägt `[data-act=rueckgaengig]` → Strg+Z → die Datei hat wieder `origins: [I0001, R00014]` in dieser Reihenfolge, der Hinweis sagt „Herkunft I0001 wiederhergestellt“ ohne Knopf. Dasselbe über den Knopf „rückgängig“ und für `R00014` (kommt an die zweite Stelle zurück). Entfernen und Wiederherstellen sind je ein Commit.
- [ ] **102-2 Letzte Herkunft und fremde Änderung:** Bei #2 ✕ an `I0001` → das Fenster zeigt „ohne Herkunft“, die Datei nennt `I0001` nicht mehr; Rückgängig → Datei `origins: [I0001]`, kein `thin air` bleibt übrig. Ergänzt der Agent bei #1 zwischen Entfernen und Rückgängig `R00020` (Datei `[R00014, R00020]`, im Fenster angekommen), ergibt Rückgängig `[I0001, R00014, R00020]` — seine Herkunft bleibt.
- [ ] **102-3 Tastatur und Ablauf:** Nach dem ✕ steht der Fokus auf dem ✕ der Nachbarin, bei der letzten Herkunft im Feld „Neue Herkunft“; dort wirkt Strg+Z, solange das Feld leer ist, und gehört dem Feld, sobald „R0“ getippt ist (ADR-0017 N2). Nach dem Rückgängig steht der Fokus auf dem ✕ der wiederhergestellten Herkunft. Nach 8 s ist der Knopf fort und Strg+Z ohne Wirkung.
- [ ] **108-1 Rückgängig ohne Aufgabe (Abnahme-Probe der Karte, heute rot):** Bei #2 ✕ an der Teilaufgabe „b“; solange der Hinweis steht, löscht der Agent #2 endgültig (`DELETE /api/aufgaben/2`); Strg+Z → eine sichtbare Meldung, die mit „nicht rückgängig:“ beginnt; `pageerror` bleibt leer, es entsteht kein Commit. Dasselbe, wenn zuvor die Herkunft `I0001` von #2 entfernt wurde.
- [ ] **108-2 Fußmeldung ohne Feld bleibt stehen (Abnahme-Probe der Karte, heute rot):** Im Fenster von #3 den Zeiteintrag löschen, der Agent trägt dieselbe Zeit wieder ein, Strg+Z → im Fuß steht „nicht rückgängig: #3 hat schon eine Zeit 09:00–10:00 von Stefan“. Danach die Teilaufgabe „c“ abhaken (angenommen) → die Meldung steht weiter, daneben „gespeichert hh:mm:ss“. Sie geht, wenn eine andere Meldung ihren Platz nimmt, wenn das Fenster geschlossen oder eine andere Aufgabe geöffnet wird, oder wenn dieselbe Aktion beim nächsten Versuch gelingt (Beispiel im Test mit umgelenkter Anfrage: „Anhang „a.txt“ nicht entfernt: …“ steht; erneutes ✕ an „a.txt“ gelingt → Meldung fort). R00155 G-3 (Meldung mit abgelehnter Eingabe) gilt unverändert.
- [ ] **114-1 Kartenname folgt der Dauer (Abnahme-Probe der Karte, heute rot):** Die Karte #4 zeigt „seit 10 Stunden“, ihr `aria-label` enthält „Timer läuft seit 10 Stunden“. Zwei Minuten später, ohne dass sonst etwas geschieht (kein Live-Ereignis, kein Klick), zeigt der Laufchip „seit 11 Stunden“ **und** das `aria-label` enthält „Timer läuft seit 11 Stunden“ (Rechnung: 10 h 59 min + 2 min = 11 h 01 min, abgerundet 11).

## Tests

Je Kriterium ein Test, der vor dem Fix rot ist. E2E: 102-1 bis 102-3 nach dem Vorbild `e2e/tests/r00112-rueckgaengig.spec.js` (Datei lesen, Commits zählen, Fokus); 108-1 mit `pageerror`-Sammler; 108-2 mit dem 409-Fall aus „US-7“ derselben Spec und einer umgelenkten Anfrage für den zweiten Versuch; 114-1 mit gestellter Uhr (`page.clock`, Vorbild `r00114-vergessene-timer.spec.js`). Die bestehenden Specs zu R00112, R00114, R00155 und R00018 bleiben grün; ändert 108-2 eine bestehende Erwartung, nennt der Commit den Test beim Namen.

## Implementierungshinweise

- **#102, Vorschlag, keine Vorschrift:** neue Art `herkunft {nummer, wert, index}` im `undo` des Hinweises (ADR-0017 Regel 2). Die Gegenaktion ist ein `PATCH /api/aufgaben/{nr}` mit der **heute gezeigten** Liste ohne `thin air`, in die `wert` an `index` (gekappt auf die Länge) eingesetzt ist — nie die beim Klick gemerkte ganze Liste, sonst überschriebe sie Fremdes (Regel 1). Steht die Herkunft schon wieder da, entdoppelt der Server (`eindeutig`, `src/modell/aufgabe.rs:601`). Erfolg und Ablehnung über `rueckgaengigSenden`, Fokus über `fokusNachEntfernen` und `leeresFeldDesEntfernens` (`data-halt` und `data-ort` stehen schon am ✕, `web/ansicht.js:403`).
- Am Code gelesen, nicht gefahren: eine leere Liste schreibt keine Zeile `origins:` (`src/format/aufgabe.rs:446`), das Fenster zeigt dann „ohne Herkunft“. Steht `thin air` ausdrücklich in der Datei, trägt auch dieser Chip ein ✕ (`web/ansicht.js:403`); kein Sonderfall nötig — kommt inzwischen eine echte Herkunft dazu, lehnt der Server das Zurücklegen von `thin air` ab („steht nur allein“), und das ist eine gewöhnliche Ablehnung „nicht rückgängig: …“.
- **Schadensstelle:** Der `PATCH` schreibt die ganze Liste. Ändert ein Agent die Herkunft in der Sekunde zwischen seinem Schreiben und dem Eintreffen des Live-Ereignisses, gewinnt der spätere Schreiber — wie heute schon bei „Neue Herkunft“. In Kauf genommen, kein neuer Endpunkt.
- **#108-1:** Die Aufgabe wird für `teilaufgabe` (und künftig `herkunft`) vor dem Senden aus dem gezeigten Stand gelesen; fehlt sie, gehört die Ablehnung in denselben Weg wie jede andere (`rueckgaengigAusfuehren`: Fuß, wenn das Aufgabenfenster oberster Dialog ist, sonst Hinweis).
- **#108-2:** Heute räumt jeder angenommene Schreibweg die Meldung, außer sie erklärt eine abgelehnte Eingabe (`meldungNachErfolgRaeumen`). Gesucht ist die Entsprechung für Meldungen ohne Feld: die Meldung kennt ihren Auslöser, nur dessen Erfolg räumt sie. Wie der Auslöser benannt wird, entscheidet der Bau. ADR-0015 N2 Ziffer 5 nennt diese Regel noch nicht — Nachtrag durch den architekt, drei Sätze (siehe Offene Fragen).
- **#114:** Der Takt kennt `[data-since][data-fmt="seit"]`; der Kartenname entsteht in `vKarte` aus `seitText` (`web/ansicht.js:801`). Ein Neuzeichnen je Sekunde ist nicht gemeint — nur wenn sich das Wort ändert.
- **Nicht hinein:** Rückgängig für „Neue Herkunft“ · eine Lebensdauer in Sekunden für Fußmeldungen · der Zusatz „seit … in der Spalte“ im Kartennamen (R00126).

## Warum löst diese Anforderung das Problem?

Auslöser #102: ein versehentlicher Klick auf das ✕ einer Herkunft; die Kennung muss heute aus dem Gedächtnis neu getippt werden. Merkt sich der Hinweis Wert und Stelle (X), stellt Strg+Z die Liste wieder her (Y), und die Herkunft verhält sich wie Teilaufgabe, Anhang und Zeit (Z). Auslöser #108: ein Fehlschlag, den niemand sieht — der TypeError erzeugt gar keine Meldung, die Fußmeldung wird vom nächsten Erfolg gelöscht. Steht die Meldung, bis ihr Anlass erledigt ist (X), liest der Mensch sie (Y) und versucht es erneut, statt von einem Erfolg auszugehen (Z). Auslöser #114: Hilfstechnik liest eine Dauer vor, die der Schirm nicht mehr zeigt; folgt der Name dem Text (X), sagen beide dasselbe (Y).

## Offene Fragen

- **An den Betreiber (108-2, Kriterium folgt der Empfehlung):** Wann geht eine Fußmeldung ohne Feld? Empfehlung: sie bleibt über fremde Erfolge stehen und geht mit einer neuen Meldung, dem Schließen des Fensters oder dem Erfolg derselben Aktion — die Karte verlangt „sie bleibt stehen“, und nur so überlebt sie zwei dicht aufeinander folgende Aktionen. Alternative: Punkt streichen, weil R00155 G-3 den Fall mit abgelehnter Eingabe schon trägt; dann entfällt 108-2 allein.
