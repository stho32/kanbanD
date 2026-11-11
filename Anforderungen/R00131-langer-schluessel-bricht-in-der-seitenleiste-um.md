---
id: R00131
status: Neu
datum: 2026-11-11
---

# R00131: Langer Schlüssel bricht in der Seitenleiste um

## Beschreibung

Das Aufgabenfenster zeigt den Fremdschlüssel der Aufgabe (`key`, 1–200 Zeichen) in der [Seitenleiste](../Dokumentation/Domaenenwissen/D00003-seitenleiste.md) als Wert des Feldes „Schlüssel" (`vSchluesselFeld`, `web/ansicht.js`; `<span class="w mono" id="schluessel">`). Ein Schlüssel mit 200 Zeichen **ohne Leerzeichen** — der Regelfall eines Fremdschlüssels aus einem anderen System — bricht heute nicht um: der Wert läuft rechts aus seiner Zelle und aus der Seitenleiste heraus, und die Seitenleiste scrollt waagrecht (Befund aus Entwicklertest #4, Karte #46, bei 1400 px; Vorschlag der Karte: Umbruch an beliebiger Stelle).

Nach dieser Anforderung bricht der Wert **an beliebiger Stelle** um (der Schlüssel ist ein Maschinenwort ohne Wortgrenzen), bleibt ganz in seiner Feldzeile, und die Seitenleiste scrollt nicht quer. Es ist die Antwort „Umbruch statt Abschneiden" (ADR-0012, ADR-0015 Nachtrag N1, ADR-0019 Nachtrag N4), umgesetzt an einer Stelle: der Wertspalte der Felder-Tabelle.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … es folgt gewohnten Konventionen": jede Feldzeile der Seitenleiste bleibt in ihrem Rahmen.

Nicht Teil: der Pfad in der Kopfzeile des Fensters (`.mod-kopf .pfad`, kürzt weiterhin mit Auslassungszeichen, R00011), der Kartentext am Board (R00115) und der Fenstertitel (R00116) — eigene Anforderungen; die Herkunftsfelder mit ihren Chips; API, Dateiformat, Server; ein neues Markup, eine neue Klasse oder ein neuer Zustand.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Seitenleiste](../Dokumentation/Domaenenwissen/D00003-seitenleiste.md)

## Geschäftlicher Nutzen

Der Fremdschlüssel verbindet die Aufgabe mit dem fremden System, aus dem sie stammt (Ticket-Nummer, Vorgangs-ID). Ein Schlüssel ohne Leerzeichen — der Normalfall — bricht heute nicht um und wird am rechten Rand der Seitenleiste abgeschnitten; wer ihn ganz lesen will, muss die Seitenleiste waagrecht scrollen, und die letzten Zeichen, die den Schlüssel eindeutig machen, liegen außerhalb des Blicks. Mit dem Umbruch an beliebiger Stelle liest der Mensch den ganzen Schlüssel in seiner Feldzeile; die Seitenleiste bleibt ruhig, und keine Information geht verloren.

## Funktionale Anforderungen

### Umbruch des Wertes (ADR-0012, ADR-0015 N1, ADR-0019 N4)

1. Die Wertspalte der Felder-Tabelle, `.felder .w` (`web/kd-app.css`), erhält `min-width:0` und einen Umbruch **an beliebiger Stelle** — `overflow-wrap:anywhere`. Ein Schlüssel ohne Leerzeichen bricht dadurch innerhalb des Wortes um.
2. Die Regel ist an `.felder .w` allgemein gesetzt, nicht nur am Schlüssel: jede künftige Textwert-Zelle der Felder-Tabelle (Seitenleiste und „Neue Aufgabe", die dieselben Klassen trägt) erbt sie. Zellen mit Auswahlfeld, Eingabefeld oder Chips sind von einem Textumbruch nicht betroffen (ersetzte Elemente brechen nicht).
3. Der Schlüssel bleibt **vollständig lesbar**: kein Abschneiden, kein Auslassungszeichen, keine Kürzung; Schrift (`.mono`, 12 px) und Aufbau der Feldzeile (Beschriftung links, Wert rechts) bleiben wie heute.
4. Ein leerer Schlüssel zeigt die Feldzeile nicht (heute so; keine Änderung). Der Fremdschlüssel wird nur beim Anlegen gesetzt (R00098) — das Feld bleibt nur lesbar.

## Nicht-funktionale Anforderungen

1. **Breite**: Der Umbruch erzeugt kein Querscrollen — weder in der Seitenleiste (`.mod-side`, das heute `overflow:auto` trägt) noch in der Wertspalte (`.felder .w`); bei 1400 px und im schmalen Layout (320, 375, 414 px). Die Breitenproben (`ziele.spec.js`) laufen als Wächter mit (ADR-0012, ADR-0015).
2. **Barrierefreiheit**: Der Wert ist Text; der Umbruch ändert weder den zugänglichen Namen der Feldzeile noch die Reihenfolge. Kein Text geht verloren.
3. **Rückwärtskompatibel**: nur CSS — keine Änderung an Markup, JavaScript, API, Dateiformat oder Commit-Texten.
4. **Unverändert**: Farben, Flächen und Kontraste bleiben die der Tokens (ADR-0011); die Kontrastproben laufen mit.

## Akzeptanzkriterien

Grundbestand (über die API herstellbar, Muster `r00114`/`r00115`): Board „entwicklung“ mit den Spalten „Zu erledigen“, „In Arbeit“, „Erledigt“; Aufgabe #1 trägt den Titel „Volltextsuche über alle Boards und Aufgaben“ und einen Schlüssel `key` von genau **200 Zeichen ohne Leerzeichen** (`POST /api/aufgaben {titel, key}`), Aufgabe #2 ohne Schlüssel.

- [ ] **1. Abnahme-Probe der Karte #46 (wörtlich)**: „Bei 1400 px trägt eine Aufgabe den Schlüssel von 200 Zeichen ohne Leerzeichen; kein Querscrollen in `.mod-side`/`.felder .w`, Rechteck im Rahmen.“
  - Besteht: Aufgabenfenster von #1 bei 1400 px — `modSide.scrollWidth ≤ modSide.clientWidth`, `schluessel.scrollWidth ≤ schluessel.clientWidth`, die rechte Kante des Schlüssels liegt nicht rechts der rechten Kante von `.felder` und `.mod-side`; der Schlüssel steht vollständig (alle 200 Zeichen, über mehrere Zeilen umgebrochen).
  - Fällt durch: heute — `.mod-side` scrollt quer (Probe: Überlauf 1151 px bei 1400 px), der Wert läuft über den Rand und wird rechts abgeschnitten.
  - Prüfebene: E2E `r00131-schluessel-umbruch.spec.js` US-1.
- [ ] **2. Grenzfall: ein Wort ohne Leerzeichen**: Der 200-Zeichen-Schlüssel ist ein einziges Wort, länger als die Wertspalte — er bricht innerhalb des Wortes um, bleibt ganz im Rechteck der Feldzeile, und nichts wird mit Auslassungszeichen gekürzt.
  - Prüfebene: E2E US-2.
- [ ] **3. Schmales Layout**: Bei 375 und 320 px scrollt die Seite und die Seitenleiste nicht quer; die Feldzeile wächst in die Höhe statt über den Rand zu laufen. Die Wächter `ziele`, `kontrast`, `kultur`, `r00115` und `r00116` laufen mit und bleiben grün.
  - Prüfebene: E2E US-3.
- [ ] **4. Leerer Schlüssel und Nachbarschaft unberührt**: Ohne Schlüssel zeigt #2 die Feldzeile „Schlüssel" nicht (Markup wie heute); der Fenstertitel (R00116), der Pfad in der Kopfzeile (kürzt weiter mit Auslassungszeichen) und die übrigen Felder der Seitenleiste sind unverändert.
  - Prüfebene: E2E US-4.

## Betroffene Verzeichnisstruktur

```
web/
└── kd-app.css   # .felder .w: min-width:0;overflow-wrap:anywhere (:355-Umfeld)
e2e/
└── tests/       # r00131-schluessel-umbruch.spec.js (neu); ziele, kontrast, kultur, r00115, r00116 laufen mit
```

Kein JavaScript, kein Server, kein Dateiformat, keine Migration, kein Commit.

## Technische Überlegungen

Keine neue Architekturentscheidung: der Umbruch ist die Antwort (ADR-0012, ADR-0015 N1, ADR-0019 N4); die Stelle ist die Wertspalte der Felder-Tabelle. Fundstellen am Stand `643567b` (planer): `web/ansicht.js:652–654` (`vSchluesselFeld`, `<span class="w mono" id="schluessel">`), eingebaut in `vFenster` `web/ansicht.js:286`; `web/kd-app.css:348` (`.felder`-Grid `84px minmax(0,1fr)`), `:349` (`.felder>*{display:flex}`), `:320` (`.mod-side{overflow:auto}`).

- **Der Mangel**: Der Wert steht als direktes Textkind im Flex-Rahmen `.w`. Dessen anonymes Flex-Element zieht seine Mindestbreite aus dem längsten Wort; `min-width:0` am Rahmen allein hilft deshalb nicht — der Wert wächst über die Grid-Spur hinaus, und `.mod-side` scrollt quer.
- **Probe (planer, Headless-Chromium, isolierte Seite mit den echten Stilen `kd-tokens.css`/`kd-base.css`/`kd-app.css`, 1400 × 800, 200-Zeichen-Schlüssel, Markup der Feldzeile)**:
  | CSS an `.felder .w` | `.mod-side` Überlauf | `.w` Überlauf | Zeilenhöhe |
  |---|---|---|---|
  | ohne Fix | 1151 px | 1163 px | 30 px |
  | `min-width:0` + `overflow-wrap:break-word` (Vorgabe) | 1151 px | 1163 px | 30 px |
  | `min-width:0` + `overflow-wrap:anywhere` | 0 px | 0 px | 119 px |
- **Gewählt**: `min-width:0` + `overflow-wrap:anywhere`. Grund: `break-word` bricht nur zwischen Wörtern und verkleinert die Mindestbreite **nicht**; an dieser Stelle wirkt es nicht (Probe). `anywhere` bricht an beliebiger Stelle und ist genau der Vorschlag der Karte („Umbruch an beliebiger Stelle"). Für einen Schlüssel ohne Wortgrenzen ist das die richtige Wahl und steht ADR-0019 N4 nicht entgegen — dort trägt `.ka .t` einen Satz mit Wörtern, hier ein Maschinenwort ohne. Verworfen: `break-word` allein oder mit `display:block` (mehr CSS/Änderung des Rahmens, kein Vorteil) und Kürzen mit `text-overflow:ellipsis` (die Karte verlangt Lesbarkeit, nicht Kürzung).

### Umfang

Eine kleine Karte (Optional): eine CSS-Regel, ein E2E-Strang, keine Bubbles vorgeplant. Features/Bubbles stellt der Entwickler bei Bedarf (`/planung verfeinern`); geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

Nach Skill `test-pyramide`; jede Szene der User Story ein Test, jeder prüft eine sichtbare Zustandsänderung.

- **E2E (Playwright)**: neu `e2e/tests/r00131-schluessel-umbruch.spec.js` mit US-1 bis US-4 (Grundbestand über die API: `POST /api/aufgaben {titel, key}` mit 200 Zeichen; Fenster öffnen; `scrollWidth`-Proben an `.mod-side` und `#schluessel`; `setViewportSize` 1400/375/320; Muster `r00114`/`r00115`).
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #46; US-1 ist der erste rote Test.
- **Gegenproben (Mutanten)**: die Regel ganz entfernt (AK 1 rot); nur `min-width:0` ohne `overflow-wrap` (AK 1 rot); `overflow-wrap:break-word` statt `anywhere` (AK 1 rot).
- **Mitlaufend grün**: `ziele.spec.js`, `kontrast.spec.js`, `kultur.spec.js`, `r00115-kartentext.spec.js`, `r00116-fenstertitel.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0012 (Zielgrößen und Messprobe), ADR-0015 Nachtrag N1 (Umbruch nach Bedarf), ADR-0019 Nachtrag N4 (Umbruch als Antwort), ADR-0011 (Kontrast); R00011 (Aufgabenfenster und Seitenleiste), R00098 (Fremdschlüssel nur beim Anlegen).
- Abhängig von (grün): I0011 Aufgabe ansehen und bearbeiten (trägt das Feld „Schlüssel"), I0036 Neue Aufgabe (dieselben `.felder`).
- Blockiert: keine.

## Offene Fragen

Keine — der Umbruch ist die Antwort (Architektur bestanden, Kartenkommentar #46, 2026-11-11), die Stelle ist gesetzt. **Anmerkung**: Die Architektur-Vorgabe nannte `overflow-wrap:break-word`; die Probe zeigt, dass nur `overflow-wrap:anywhere` an dieser Stelle wirkt (Technische Überlegungen, Tabelle). Die Entscheidung dafür steht im Bericht des planers; sie ändert keine der getroffenen Festlegungen (Umbruch, kein Querscrollen, Rechteck im Rahmen).

## Manuelle Vorbereitungstätigkeiten

Bildschirmfoto der Seitenleiste mit dem 200-Zeichen-Schlüssel bei 1400 px (und im schmalen Layout) auf den Abnahmezettel. Kein neues Artboard: der Umbruch ist ein Rückfall, kein neuer Zustand (ux liefert nur den Bild-Beleg).

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist eine Wertspalte, die einer Maschinenzeichenkette nicht nachgibt: Der Fremdschlüssel eines fremden Systems hat keine Leerzeichen, an denen ein Umbruch greifen könnte, und die Zelle wächst lieber über ihre Spur hinaus, als das Wort zu brechen — die Seitenleiste scrollt quer, und der Schlüssel wird am Rand abgeschnitten. Weil das kein Datenproblem ist, sondern eine Frage des Platzes, gehört die Antwort in die Anzeige: eine einzige CSS-Regel an der Wertspalte lässt den Wert an beliebiger Stelle brechen (`overflow-wrap:anywhere`), der Schlüssel bleibt ganz in seiner Feldzeile und die Seitenleiste ruhig. Der Hebel ist genau diese Stelle — nicht die Kartenkarte (R00115) und nicht der Fenstertitel (R00116), die je eine eigene Anforderung tragen, und keine Kürzung mit Auslassungszeichen, die gerade die letzten, eindeutigen Zeichen des Schlüssels verschluckte. Die Wirkungskette: ein Schlüssel ohne Leerzeichen → bricht an beliebiger Stelle um → der Mensch liest den ganzen Schlüssel in der Seitenleiste, ohne quer zu scrollen.

## Missing-Docs

Keine — `A00009` (Oberfläche) bekommt keine neue Regel; die Wertspalte erbt die vorhandene Breitenregel (ADR-0015).

## Notizen

**Elterndialog D0003** (Aufgabenfenster, Seitenseite): Das Feld „Schlüssel" ist ein Feld der Seitenleiste (`vFensterSeite`/`vSchluesselFeld`), nicht des Hauptbereichs. Muster: R00115 (Kartentext lesbar setzen, I0104) und R00116 (Titel im Aufgabenfenster, I0105), die denselben Rückfall „Umbruch als Antwort" tragen.

**Kein neues Artboard**: der Umbruch ist ein Rückfall, kein neuer Zustand; ux liefert nur ein Bildschirmfoto als Beleg auf den Abnahmezettel — wie R00110, R00112 (Umbruch/✕), R00115.

**Optionen (kurz, Skill `optionen-vor-entscheidung`):**
- **A — `min-width:0` + `overflow-wrap:anywhere` an `.felder .w`** (gewählt): bricht an beliebiger Stelle, deckt jeden künftigen langen Wert der Feldspalte; eine Regel, kein Markup.
- **B — `overflow-wrap:break-word` (+ `display:block` am Rahmen)**: bricht nur zwischen Wörtern; wirkt am anonymen Textkind des Flex-Rahmens nicht ohne zusätzliche Änderung des Rahmens, mehr CSS ohne Vorteil für ein Wort ohne Leerzeichen; verworfen.
- **C — Kürzen mit `text-overflow:ellipsis`**: hält die Zeile einzeilig, verschluckt aber gerade die eindeutigen Zeichen des Schlüssels; widerspricht dem Zweck (Schlüssel lesbar); verworfen.

**Verwiesenes**
- Karte #46 „Langer Schlüssel läuft im Aufgabenfenster über den Rand" (Aus Entwicklertest #4, Anmerkung UX; Kartenkommentar #46: keine Technikfrage, Umbruch, neue Interaction unter D0003, kein Artboard).
- ADR-0015 Nachtrag N1 (Umbruch nach Bedarf), ADR-0019 Nachtrag N4 (Umbruch als Antwort), ADR-0012 (Messprobe), ADR-0011 (Kontrast).
