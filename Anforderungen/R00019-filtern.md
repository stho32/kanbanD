---
id: R00019
status: Erledigt
datum: 2026-10-18
---

# R00019: Filtern

## Beschreibung

Das Board lässt sich über ein Filterfeld in der Kopfzeile eingrenzen: Freitext sucht in Titel, Beschreibung, Kommentaren und Teilaufgaben, dazu Schlüsselwörter für Nummer, Person, Klasse, Herkunft, Label und Archiv. Ein Umschalter zeigt alle, nur meine oder nur Agenten-Aufgaben; eine Legende unter dem Board zeigt die Klassen mit ihrer Zahl und filtert per Klick.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … per Tastatur bedienbar“; Herkunft filterbar (Wireframes).

## Geschäftlicher Nutzen

Auch auf vollen Boards findet man das Gesuchte in Sekunden.

## Funktionale Anforderungen

- Wörter werden mit UND verknüpft; Groß-/Kleinschreibung zählt nicht.
- Ein freies Wort muss im Text der Aufgabe vorkommen — im Titel, in der Beschreibung, in einem Kommentar oder in einer Teilaufgabe. Die vier Felder sind ODER, die Wörter UND verknüpft (Karte #31, fortgeschrieben 2026-11-11).
- `#12` → Nummer 12; `@st` → `st` ist zuständig; `class:bug`, `class:none`; `origin:I0023`, `origin:"thin air"`; `label:ui`; `is:archived` → Archivansicht; jedes andere Wort (auch `x:y` mit unbekanntem Schlüssel) muss im Text vorkommen.
- Umschalter: „alle“, „meine“ (ich bin zuständig), „Agenten“ (ein Agent ist zuständig).
- Die Spaltenzahl zählt nur Treffer; leere Spalten zeigen „keine Treffer“.
- Legende: je Klasse Farbe, Bezeichnung und Zahl der sichtbaren Karten, dazu „ohne Klasse“; Klick setzt bzw. entfernt `class:<schlüssel>` im Filter.
- `/` setzt den Fokus ins Filterfeld; Esc leert es.
- Filter und Umschalter bleiben je Tab über ein Neuladen erhalten.

## Akzeptanzkriterien

- [x] `passt`: „kopf class:feature“ trifft #12 „Kopfzeile verdichten“ (feature), nicht #13 „Kopfzeile“ (bug); „#12“ trifft nur 12; „@cl“ nur Aufgaben mit cl; `origin:"thin air"` nur Aufgaben ohne Herkunft; `class:none` nur ohne Klasse; `label:UI` trifft `ui`
- [x] Oberfläche: „class:bug“ zeigt nur Fehler-Karten, Spaltenzahlen passen; Klick auf „Fehler“ in der Legende entfernt den Filter wieder
- [x] Oberfläche: „meine“ zeigt nur Karten, für die ich zuständig bin
- [x] Oberfläche: `/` fokussiert das Filterfeld, Esc leert es

### Freitext in Beschreibung, Kommentaren und Teilaufgaben (Karte #31, fortgeschrieben 2026-11-11)

- [ ] `passt`: „wartung“ trifft eine Aufgabe, deren Titel das Wort nicht enthält, deren Beschreibung es aber nennt; ebenso, wenn nur ein Kommentar oder nur eine Teilaufgabe es nennt
- [ ] Felder ODER, Wörter UND: „wartung schieber“ trifft, wenn „wartung“ in der Beschreibung und „schieber“ in einer Teilaufgabe steht; fehlt eines der beiden Wörter im ganzen Text, trifft es nicht
- [ ] ohne Groß/Klein in allen Feldern: „WARTUNG“ trifft „wartung“ in einer Teilaufgabe
- [ ] unverändert: `#12`, `@st`, `class:`, `origin:`, `label:`, `is:archived` wirken wie bisher; ein unbekannter Schlüssel `x:y` sucht weiter als Wort im ganzen Text
- [ ] Oberfläche: der Platzhalter des Filterfelds nennt die Textfelder; `/` fokussiert, Esc leert wie bisher

## Betroffene Verzeichnisstruktur

`web/filter.js` (pure, auch in Node ladbar), `web/ansicht.js`, `web/app.js`; Unit-Tests `e2e/einheit/filter.test.js` (`node --test`), E2E `e2e/tests/r00019-filtern.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `filterWoerter(text) -> [[schlüssel, wert]]`, `passt(aufgabe, text, {ich, personen}) -> bool` (pure)

## Tests
- Unit: alle Schlüsselwörter, Anführungszeichen, UND-Verknüpfung
- Unit: freie Wörter über Titel, Beschreibung, Kommentar- und Teilaufgabentext, Felder ODER und Wörter UND, ohne Groß/Klein (Karte #31)
- E2E: Filterfeld, Legende, Umschalter, Tastatur

## Abhängigkeiten
- Abhängig von: R00005, R00010

## Offene Fragen
- Sollen Treffer im Kartentext hervorgehoben werden (Karte #31)? Erster Wurf: nein — eine Hervorhebung braucht eine eigene Gestaltung (Marke, M3) und ist umkehrbar nachrüstbar.
- Soll das Filterfeld die Zahl der Treffer nennen (Karte #31)? Erster Wurf: nein — die Spaltenzahlen und die Legende zeigen die Treffer schon.

## Fortschreibung

### 2026-11-11 — Volltext in Beschreibung, Kommentaren und Teilaufgaben (Karte #31, Interaktion I0117)

**Anlass.** Der Freitextfilter prüfte nur den Titel (`web/filter.js` `passt`, Zweig `k === ''`), obwohl das Aufgabenobjekt der API Beschreibung, Kommentare und Teilaufgaben schon liefert. Die R00019-Beratung des product-owner vom 2026-11-03 (Karte #31) nennt die üblichen Kanban-Funktionen, die fehlen — Volltext über alle Textfelder ist eine davon.

**Entscheidung (architekt, Kartenkommentar 2026-11-11, kein ADR — keine Technikfrage).** Die Titel-Einengung in `passt` wird auf Titel, Beschreibung, Kommentartexte und Teilaufgabentexte erweitert; Felder ODER, Wörter UND, ohne Groß/Klein. Kein neuer Endpunkt, kein neues Feld: die Daten liegen schon im Aufgabenobjekt.

**Heimat.** R00019 bleibt die Anforderung (Nachzug, kein neues Dokument): dieselbe Fähigkeit „Filtern" und derselbe Ausdruck `passt` werden erweitert; eine zweite Anforderung würde den einen Kontrakt in zwei teilen. Der zugehörige WBS-Knoten ist eine **eigene Interaction** I0117 unter D0002, nicht eine Bubble an der grünen I0019: ein neuer roter Nachfahre öffnet die Abnahme von I0019 wieder (Härtungs-/Abgrenzungsregel, Vorbild I0107 für die fortgeschriebene R00009; `AI-Team/gelerntes.md` 2026-11-11).

**Nachgezogen in dieser Fassung:** die Beschreibung, FA 2 (freies Wort) und FA 3 (unbekannter Schlüssel) sowie die Akzeptanzkriterien „Freitext in Beschreibung, Kommentaren und Teilaufgaben"; dazu der Platzhalter des Filterfelds (`web/ansicht.js:60`) von „Titel" zu „Text".

**Wächter:** `e2e/einheit/filter.test.js` (Unit) und `e2e/tests/r00019-filtern.spec.js` (E2E, um die Textfelder erweitert); die vorhandenen AK von R00019 bleiben unberührt.

**Wirkungskette:** Ein freies Wort trifft jetzt auch Karten, die es nur in der Beschreibung, einem Kommentar oder einer Teilaufgabe nennen (X); man findet auf dem vollen Board auch das, was nicht im Titel steht (Y); die Suche verhält sich wie in den verglichenen Werkzeugen und spart den Umweg über das Aufgabenfenster (Z).

**Status:** Der ursprüngliche Umfang ist ausgeliefert, die Fassung bleibt darum `Erledigt`; die neuen, noch offenen Kriterien gehören zur Interaktion I0117 (Karte #31). Den Statuswechsel beim Abschluss setzt allein `/implementierung`.

