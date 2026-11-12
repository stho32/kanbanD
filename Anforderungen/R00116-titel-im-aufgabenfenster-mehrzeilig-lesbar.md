---
id: R00116
status: Neu
datum: 2026-11-10
---

# R00116: Titel im Aufgabenfenster mehrzeilig lesbar

## Beschreibung

Der Mangel aus [R00115](R00115-kartentext-lesbar-setzen.md) am Board gilt im Aufgabenfenster genauso: Das Fenster rendert den Titel als einzeiliges Eingabefeld (`input.titel`, `web/ansicht.js` `vFenster`), `overflow-wrap` wirkt dort nicht — ein langer Titel scrollt im Feld waagrecht statt umzubrechen; wer ihn lesen will, scrollt (Karte #115, Folge aus #16/R00115). Die Fenstertasten (R00106) und der Sicherer aus ADR-0007 Nachtrag N1 bleiben unberührt.

Nach **ADR-0007 Nachtrag N2** (Akzeptiert, Commit `75c7853`, Architektur bestanden 2026-11-10) liest der Titel künftig zweistufig, nach dem Hausmuster `besch-lesen`/`S.ui.beschreibungBearbeiten` (`web/ansicht.js`, `web/app.js`):

1. **Lesen**: mehrzeiliges `<div data-act="titel-bearbeiten">` mit `overflow-wrap:break-word` — Umbruch zwischen Wörtern wie auf der Boardkarte (R00115 FA 1); ein Wort, das allein nicht in die Zeile passt, darf innerhalb brechen (sonst überläuft es das Fenster). Zugänglich nach Muster `besch-lesen`: `tabindex="0" role="button" aria-label="Titel bearbeiten" title="Klick bearbeitet"`.
2. **Bearbeiten**: Klick oder Enter auf das Lesediv (oder Taste `e`) wechselt in den Zustand `S.ui.titelBearbeiten` mit dem einzeiligen `<input data-af="titel">` wie heute (Wert, `aria-label="Titel"`). Bewusst in Kauf genommen (ADR-0007 N2): Beim Eingeben scrollt ein langer Titel im einzeiligen Feld waagrecht — die Karte verlangt Lesbarkeit, nicht mehrzeiliges Eingeben.

Nicht Teil: `<textarea>` oder `contenteditable` (vom ADR verworfen, siehe Optionen); Esc im Titelfeld (**#54**, eigene Karte — der Bearbeitungszustand macht sie adressierbar, hier nur der Hinweis); API, Dateiformat, Server; Form, Maße und Typografie außerhalb `.titel`.

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiterfassung, die zum Arbeiten passt“: wer eine Aufgabe im Fenster öffnet, liest den ganzen Titel auf einen Blick, statt im einzeiligen Feld zu scrollen.

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Das Aufgabenfenster ist der Ort, an dem eine Karte gelesen und entschieden wird; ein Titel, der nur mit waagrechtem Scrollen lesbar ist, verlangt für das erste Wort des ersten Blicks eine Handbewegung, die keine Information bringt. Mit dem mehrzeiligen Lesediv liest sich der Titel wie auf der Boardkarte — ganz, wortweise, ohne Scrollen — und das Bearbeiten bleibt eine Handlung (Klick, Enter, `e`), statt einem Zustand, den man suchen muss.

## Funktionale Anforderungen

### Lesen (ADR-0007 N2)

1. Ist das Fenster geöffnet und `S.ui.titelBearbeiten` nicht gesetzt, zeigt der Titelplatz ein mehrzeiliges `<div data-act="titel-bearbeiten">` mit `overflow-wrap:break-word`: Ein Umbruch fällt zwischen zwei Wörtern; ein Wort, das allein nicht in die Zeile passt, darf innerhalb brechen (nötig, sonst überläuft der Titel das Fenster). Kein horizontales Scrollen des Fensterkörpers wegen des Titels, bei 1280 und 320 px.
2. Das Lesediv ist zugänglich nach Muster `besch-lesen` (`web/ansicht.js:278`): `tabindex="0" role="button" aria-label="Titel bearbeiten" title="Klick bearbeitet"`.
3. Typografie des Lesedivs wie heute `.titel` (`web/kd-app.css`): Schriftstärke 600, Schriftgröße 20 px, Zeilenhöhe 1,25 — Form, Maße und Typografie ändern sich nicht, nur das Element.

### Bearbeiten (Muster `besch-lesen`, ADR-0007 N2)

4. Klick auf das Lesediv, Enter bei fokussiertem Lesediv und Taste `e` im Fenster setzen `S.ui.titelBearbeiten` und zeichnen das einzeilige `<input data-af="titel">` mit dem heutigen Wert und `aria-label="Titel"`; der Fokus steht im Eingabefeld. Schließen und erneutes Öffnen (`oeffnen`) setzt `titelBearbeiten` zurück (Muster `beschreibungBearbeiten`, `web/app.js:580`).
5. Die Taste `e` öffnet den Bearbeitungszustand auch nach einem Neuzeichnen (Live-Ereignis, fremder Schreibaufruf): heutiges `fokus('[data-af="titel"]')` (`web/app.js:2095`) wird zum act — Muster `'b' → act('beschreibung-bearbeiten')` (`web/app.js:2096`).

### Umfeld unverändert

6. **Kein Blättern** *(aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144/#145))*: ↑/↓ wechseln im Aufgabenfenster keine Aufgabe mehr — R00144 FA 9 hat den Blätter-Hörer samt Guard (`!/INPUT|TEXTAREA|SELECT/`) gestrichen, das Lesediv braucht damit keine Sonderregel, im Lese- wie im Bearbeitungszustand. Bis dahin galt: „↑/↓ blättern im Fenster weiter, solange der Fokus nicht in einem Eingabefeld steht; die Blättertasten bleiben bedienbar.“ Der Titel bleibt mehrzeilig lesbar, `e` und Klick bearbeiten ihn.
7. Esc schließt das Fenster wie heute; das Verhalten des Titelfelds unter Esc (speichern/verwerfen) ist **#54** und bleibt hier unberührt.
8. Der Sicherer aus ADR-0007 N1 ändert sich nicht: das Lesediv ist über seinen Aktions-Schlüssel `data-act="titel-bearbeiten"` gesichert, das Eingabefeld über `data-af="titel"` (Feldschlüssel) — beide Zustände überstehen das Neuzeichnen durch ein Live-Ereignis.

## Nicht-funktionale Anforderungen

1. **Breite**: Der Umbruch erzeugt kein Querscrollen des Fensterkörpers (ADR-0012, ADR-0015); die Breitenproben (`ziele.spec.js`) laufen mit als Wächter, bei 1280 und 320 px.
2. **Barrierefreiheit**: Lesediv mit Rolle, Name und Tabulator (FA 2); Eingabefeld mit Name wie heute. `r00106` läuft mit als Wächter (Fokus in Fenstern und Menüs).
3. **Rückwärtskompatibel**: keine Änderung an API, Dateiformat oder Speichern — jede Änderung am Titel geht wie heute sofort in die Datei; nur Sichtzustand und Elemente.
4. **Kontrast unverändert**: Farben und Flächen bleiben die der Tokens (ADR-0011); die Kontrastproben laufen mit.

## Akzeptanzkriterien

Geprüft mit dem Grundbestand aus `user-stories/R00116.md` (Muster `r00115-kartentext.spec.js`).

- [ ] **1. Abnahme-Probe der Karte #115 (wörtlich)**: „Karte mit sehr langem Titel im Aufgabenfenster bei 1280 und 320 px: Der Titel ist vollständig sichtbar, ohne horizontales Scrollen; kein Wort endet mitten gebrochen, wo es in die Zeile passt (Range-Sonde wie r00115); Bearbeiten (Klick/Enter/`e`) und Blättern (↑/↓) bleiben bedienbar; bei fokussiertem Lesediv übersteht der Fokus ein Live-Ereignis (ADR-0007 N1); `e` öffnet die Bearbeitung auch nach dem Neuzeichnen.“ *(Blättern ist aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144/#145), R00144 FA 9 — das Kriterium gilt ohne diesen Teil; „Bearbeiten“ steht unverändert.)*
  - Besteht: Fenster der Karte „Volltextsuche über alle Boards und Aufgaben“ bei 1280 und 320 px — jede sichtbare Zeile des Titels endet an einer Wortgrenze (Range-Sonde: kein Wort mit `getClientRects().length > 1`, wo die Zeile es fassen könnte), alle Zeilen liegen im sichtbaren Fensterkörper, `scrollWidth` des Körpers ≤ `clientWidth` + 1.
  - Fällt durch: heute — Titel im einzeiligen `input`, langer Titel nur mit horizontem Scrollen lesbar.
  - Prüfebene: E2E `r00116-fenstertitel.spec.js` US-1.
- [ ] **2. Lesediv zugänglich und getreu**: Der Titelplatz ist ein `<div>` mit `tabindex="0"`, `role="button"`, zugänglichem Namen „Titel bearbeiten“ (Forderung FA 2); berechnete Schriftstärke 600, Schriftgröße 20 px, Zeilenhöhe 1,25 × 20 px (FA 3, `getComputedStyle`).
  - Prüfebene: E2E US-2.
- [ ] **3. Bearbeiten öffnen (drei Wege)**: Klick auf das Lesediv, Enter bei fokussiertem Lesediv und Taste `e` zeichnen das `<input data-af="titel">` mit dem heutigen Titelwert, und der Fokus steht im Feld; Schließen und erneutes Öffnen zeigt wieder das Lesediv (`titelBearbeiten` zurückgesetzt, FA 4/5).
  - Prüfebene: E2E US-3.
- [ ] **4. Live-Ereignis bei fokussiertem Lesediv**: Fremder Schreibaufruf (Titeländerung über die API) bei fokussiertem Lesediv — nach dem Neuzeichnen steht der Fokus wieder auf dem Lesediv (gleicher Schlüssel `titel-bearbeiten`, Sicherer N1/FA 8), und `e` öffnet danach die Bearbeitung (FA 5).
  - Prüfebene: E2E US-4.
- [ ] **5. Kein Blättern mehr (aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144/#145))**: ↑/↓ mit Fokus auf dem Lesediv wechseln die Aufgabe nicht mehr (FA 6 in der Fassung nach #144, R00144 FA 9); die Wächter `r00106` (Fokus in Fenstern und Menüs), `r00115`, `r00114`, `ziele`, `kontrast` laufen mit und bleiben grün.
  - Prüfebene: E2E US-5; `npx playwright test r00106 r00115 r00114 ziele kontrast` grün.
- [ ] **6. Grenzfall langes Einzelwort**: Titel „Donaudampfschifffahrtskapitänsanwärterunterricht“ (ein Wort, länger als die Zeile) — es bricht innerhalb des Wortes, bleibt ganz im sichtbaren Fensterkörper, kein horizontales Scrollen bei 1280 und 320 px.
  - Prüfebene: E2E US-6 (`ziele.spec.js`-Muster).

## Betroffene Verzeichnisstruktur

```
web/
├── ansicht.js    # vFenster (:278): Lesediv statt/neben input.titel nach Muster besch-lesen
├── app.js        # act 'titel-bearbeiten' (u.titelBearbeiten, Fokus), 'e'-Taste (:2095) → act, Enter auf Lesediv (:1907-Muster), Zurücksetzen (:580/:1758-Muster)
├── sichtzustand.js  # Sicherer: data-act-Liste um 'titel-bearbeiten' (Muster beschreibung-bearbeiten)
└── kd-app.css    # .titel-lesen (o. Ä.): overflow-wrap:break-word, Typografie wie .titel
e2e/
└── tests/        # r00116-fenstertitel.spec.js (neu); r00106, r00115, r00114, ziele, kontrast laufen mit
```

## Technische Überlegungen

Nach ADR-0007 Nachtrag N2 (Akzeptiert, Commit `75c7853`); Fundstellen am Stand `75c7853` geprüft (planer): `web/ansicht.js:278` (`input.titel` in `vFenster`, daneben `besch-lesen` als Muster), `web/app.js:2095` (`'e': fokus('[data-af="titel"]')`), `:2096` (`'b' → act`), `:1566` (act `beschreibung-bearbeiten`), `:580`/`:1758` (Zustand zurücksetzen), `:1907` (Enter auf `besch-lesen`), `:1951` (Guard ↑/↓), `web/sichtzustand.js` (Sicherer).

- **Elementwahl**: entschieden im ADR — Lesediv + einzeiliges Eingabefeld im Zustand `S.ui.titelBearbeiten`; verworfen `<textarea>` (Titel ist im Dateiformat eine Zeile, Enter fügte Umbruch ein, bräuchte Sonderregeln) und `contenteditable` (kein Formularfeld, kein `change`, der Sicherer kennt Wert und Auswahl nicht — die Fehlerklasse des ADR).
- **Sicherung**: Lesediv über Aktions-Schlüssel in der `data-act`-Liste des Sicherers (Muster `beschreibung-bearbeiten`), Eingabefeld über `data-af` — der EINGABEFELD-Test des Sicherers deckt beide.
- **Tasten**: `e` wird vom Fokus zum act (zeigt den Zustand auch an, wenn das Feld noch nicht existierte); ↑/↓ brauchen keine Änderung (der Guard prüft `tagName`, ein `div` passt nicht) — mit der Streichung des Blätterns (#144) entfallen sie ganz (R00144 FA 9).
- **Wächter**: `r00106` (Fokus-Raster und -Rückfall), `r00115` (Kartentext), `r00114` (Breiten), `ziele`, `kontrast` laufen mit; `node --test e2e/einheit/`.

### Umfang

Eine kleine Karte: ein Zustand + Elementwechsel in `vFenster`, drei Tasten/Wege hinein, ein CSS-Block, ein neuer E2E-Strang — keine Bubbles vorgeplant; der Entwickler stellt sie bei Bedarf (`/planung verfeinern`), geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

Nach Skill `test-pyramide`; jede Szene der User Story ein Test, jeder prüft eine sichtbare Zustandsänderung.

- **E2E (Playwright)**: neu `e2e/tests/r00116-fenstertitel.spec.js` mit US-1 bis US-6 (Muster `r00115`: `kanbanD-time`-Fixture, Range-Sonde der Wörter, `breiteMessen` aus `ziele-hilfen`, `getComputedStyle` für Typografie; Live-Ereignis über API-Schreibaufruf wie `r00106`-Fokus-Tests).
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #115; US-1 ist der erste rote Test.
- **Gegenproben (Mutanten)**: `overflow-wrap:anywhere` zurück (AK 1 rot), `titelBearbeiten` nie gesetzt — `e` fokussiert ins Leere (AK 3 rot), Sicherer ohne `titel-bearbeiten`-Schlüssel — Fokus nach Live-Ereignis verloren (AK 4 rot), Guard auch auf `div` (AK 5 rot).
- **Mitlaufend grün**: `r00106` (alle Dateien), `r00115`, `r00114`, `kultur`, `ziele`, `kontrast`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0007 Nachtrag N1 (Sicherer, `847289a`) und Nachtrag N2 (Elementwahl, `75c7853`); ADR-0009 (Sichtzustand `S.ui`), ADR-0012 (Trefferfläche), ADR-0015 (Umbruch als Antwort), ADR-0011 (Kontrast); R00106 (Fenstertasten), R00115 (Umbruch zwischen Wörtern — das Fenster holt sich dieselbe Regel).
- Abhängig von (grün): I0104 Kartentext lesbar setzen (R00115 — dessen CSS-Regeln bleiben; das Fenster ergänzt sie um das Lesediv).
- Blockiert: keine. Adressierbar macht diese Karte #54 („Esc im Titelfeld speichert statt zu verwerfen“).

## Offene Fragen

Keine — die Elementwahl ist durch ADR-0007 N2 entschieden (Architektur bestanden, `75c7853`); Form, Maße und Typografie des Lesedivs legt FA 3 fest (konsistent mit `.titel` heute, im Rahmen des ADR: „Form, Maße und Typografie bleiben Detailplanung/UX“).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist ein Eingabefeld an einer Lesestelle: `input.titel` zeigt den Titel als eine Zeile, egal wie lang — und der lesende Mensch scrollt waagrecht, um ihn ganz zu sehen. Das Lesediv bringt dieselbe Wirkung wie auf der Boardkarte (R00115): der Platz gibt nach, der Umbruch fällt zwischen Wörter, der Titel ist mit einem Blick ganz da. Das Muster `besch-lesen` macht die Bearbeitung zu einer bedienbaren Handlung statt eines versteckten Modus — Klick, Enter und `e` öffnen dasselbe Feld wie heute, und der Sicherer aus N1 hält Fokus und Zustand über das Neuzeichnen eines Live-Ereignisses. Damit liest sich das Fenster so, wie die Karte verspricht: ganz, wortweise, ohne Scrollen — und das Bearbeiten bleibt da, wo es war.

## Missing-Docs

Keine — A00009 (Oberfläche) bekommt keine neue Regel; die Typografie erbt `.titel`.

## Notizen

- **#54 bleibt draußen**: „Esc im Titelfeld speichert statt zu verwerfen“ ist eine eigene Karte; der Bearbeitungszustand `S.ui.titelBearbeiten` macht sie erst richtig adressierbar (Esc trifft dann ein Feld, nicht den Lesemodus). Hier bleibt Esc wie heute: Fenster schließen.
- **Kauf genommen** (ADR-0007 N2): im einzeiligen Eingabefeld scrollt ein langer Titel waagrecht — die Karte verlangt Lesbarkeit, nicht mehrzeiliges Eingeben; ein mehrzeiliges Eingeben wäre `<textarea>` und ist verworfen.
- **Elterndialog D0002** (wie I0104): das Aufgabenfenster liegt im Hauptbereich des Boards; Titel und Bearbeiten sind Fensterinhalte desselben Dialogs (das Blättern ist durch Betreiber-Entscheidung 2026-11-12 (#144) gestrichen, nicht mehr Fensterinhalt).
- **Kein Blättern vorgeplant**: kleine Karte (ein Zustand, ein CSS-Block, ein E2E-Strang); Bubbles ergänzt der Entwickler nur, wenn der Bau sie braucht.
- **Optionen (verworfen im ADR, hier nicht vorgesehen)**: (a) `<textarea>` als einziges Element — der Titel ist im Dateiformat eine Zeile, Enter fügte einen Umbruch ein und bräuchte Sonderregeln, die es im Haus nicht gibt; (b) `contenteditable` — kein Formularfeld, kein `change`, der Sicherer kennt Wert und Auswahl nicht, halb Getipptes fiele beim `innerHTML`-Ersetzen eines Live-Ereignisses (die Fehlerklasse von ADR-0007).