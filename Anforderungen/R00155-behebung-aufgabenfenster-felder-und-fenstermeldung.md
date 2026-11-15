---
id: R00155
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00011
---

# R00155: Behebung — Aufgabenfenster: Esc verwirft den Entwurf, die abgelehnte Eingabe bleibt stehen, Schlüssel als Hilfstext, Meldung über der Bildschirmtastatur

## Beschreibung

Paket „Aufgabenfenster: Felder und Fenstermeldung“ (product-owner 2026-11-15, Regel „Kleine Karten bündeln“): die Karte **#54** führt, mitgebaut werden **#96**, **#93**, **#87** und **#97**. Alle fünf betreffen das Aufgabenfenster (D0003) und dieselben Dateien. Diese Anforderung nennt **je Mitglied einen eigenen Block** von Akzeptanzkriterien mit eigener Kennung (`54-…`, `54B-…`, `96-…`, `93-…`, `87-…`, `97-…`); ein Mitglied lässt sich herauslösen, ohne dass sich die Kennungen der übrigen ändern.

| Mitglied | heute | erwartet | Technik |
|---|---|---|---|
| **#54** Esc im Titelfeld speichert statt zu verwerfen | Esc im geänderten Titelfeld speichert den Titel (ein `PATCH`, ein Commit) **und** schließt das Fenster; dasselbe bei Beschreibung und Labels | Esc tut je Druck genau eines, das Innerste zuerst: hat das fokussierte Textfeld einen Entwurf oder einen Bearbeitungsmodus, verwirft Esc ihn ohne Schreibweg und das Fenster bleibt offen; sonst schließt Esc | [ADR-0010 N9](../Dokumentation/ADRs/0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) |
| **#96** Titelfeld ohne `aria-invalid` bei abgelehntem Titel | nach der Ablehnung zeigt das Fenster das Lesediv mit dem alten Titel — kein Eingabefeld, das ungültig sein könnte, die Eingabe ist fort | das Titelfeld bleibt Eingabefeld mit der abgelehnten Eingabe, trägt `aria-invalid="true"` und verweist auf die Fenstermeldung | [ADR-0015 N2](../Dokumentation/ADRs/0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) |
| **#93** „Zeit nachtragen“ verliert die abgelehnte Eingabe | nach „abc“ + Enter steht die Meldung, das Feld ist leer und trägt kein `aria-invalid` | die Eingabe bleibt zur Berichtigung stehen, das Feld verweist auf die Meldung | ADR-0015 N2 |
| **#87** Schlüssel als Hilfstext für drei Felder | „Zählt in Berichten“, „Signale“ und „Schlüssel“ stehen ohne Dateischlüssel in den Details | unter der Beschriftung steht `reporting`, `signals` bzw. `key` als Mono-Hilfstext in eigenem Element | ADR-0013 N1, `vBeschriftung` |
| **#97** Bildschirmtastatur beim Laden | ist der sichtbare Bereich schon beim Laden verkleinert, bleibt die Fenstermeldung bis zum nächsten Ereignis verdeckt | beim Start wird einmal gerechnet | [ADR-0016 N1](../Dokumentation/ADRs/0016-fenster-folgen-dem-sichtbaren-bereich.md) |

Die technischen Entscheidungen stehen in den drei Nachträgen (Commits `4c86cc5`, `00b9534`); diese Anforderung macht sie prüfbar und ändert sie nicht. **Der Architekt hat alles aus dem Code gelesen und nichts am laufenden Programm erprobt** — der erste Schritt jedes Mitglieds ist deshalb die Probe am heutigen Stand (rot aus dem richtigen Grund).

Entscheidungen, wörtlich (`AI-Team/po-entscheidungen.md`, 2026-11-15, Fragen 1 und 2 zu #54; Kartenkommentare):

- Betreiber 2026-11-13 (#54): „Esc verwirft. Esc ist im Haus überall der Abbruch (Dialog, Umbenennen, Menü, Hinweis); im Titelfeld verwirft es die laufende Eingabe, Enter speichert weiter.“
- product-owner, Frage 1: „Zwei Stufen: ein Esc verwirft den Titel, verlässt nur den Bearbeitungsmodus und gibt den Fokus an „Titel bearbeiten“ zurück; erst das zweite Esc schließt das Fenster“.
- product-owner, Frage 2: „Eine Regel für das ganze Fenster, gebaut in #54: Esc verwirft den offenen Entwurf des Feldes und lässt das Fenster offen; erst das zweite Esc schließt.“ Sie gilt „für jedes Textfeld mit Entwurf — Titel, Beschreibung, Labels; Felder ohne Entwurf bleiben unberührt (Spalte, Klasse, Fällig schreiben im Moment der Auswahl; „Geschätzt“ ist heute nur Anzeige)“. „#161 entscheidet die Regel nicht neu“.
- Betreiber 2026-11-13 (#87): „nur die drei freigegebenen Felder. `reporting`, `signals`, `key` bekommen den Dateischlüssel als Mono-Hilfstext; `ich`, `agents`, `board`, `spalten` nicht — die Felder des ersten Starts sprechen mit dem Menschen.“

**Die Beschreibung ist ein eigener Block (`54B`).** Der Betreiber weiß, dass Esc künftig auch den Entwurf der Beschreibung verwirft, und kann das zurücknehmen. Ein Nein trifft nur die Kriterien `54B-…`, die Story US-5 und die Bubble B0723; dann bleibt die Beschreibung beim heutigen Verhalten, alle übrigen Kriterien gelten unverändert.

**Fußhinweis „Esc schließen“ (Anmerkung des product-owner, gegengeprüft):** Der Hinweis stimmt mit der zweistufigen Regel nicht mehr. Er steht im Fuß genau dann, wenn jemand mit einem Entwurf im Feld sitzt — neben „jede Änderung geht sofort in die Datei“; wer ihm folgt, verliert den Entwurf ohne Vorwarnung, wo Esc bisher gespeichert hat. Der Text wird deshalb geändert (Kriterium 54-11): im Fuß und in der Kürzelhilfe „Eingabe verwerfen, sonst schließen“. Kein neues Element, kein neuer Zustand, bis 640 px bleibt der Tastenhinweis wie heute ausgeblendet.

Begriff **Entwurf** (ADR-0010 N9 Ziffer 4): der Wert eines Textfelds weicht vom gezeichneten Stand ab (getippt, oder nach einem Neuzeichnen zurückgesetzt und noch nicht gemeldet), oder das Feld trägt die abgelehnte Eingabe aus ADR-0015 N2.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis. Jede Aktion in kanbanD ergibt einen eigenen Commit.“ Ein Esc, das speichert, erzeugt einen Commit, den niemand wollte; eine abgelehnte Eingabe, die verschwindet, lässt den Menschen ohne das, was er berichtigen soll.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Seitenleiste](../Dokumentation/Domaenenwissen/D00003-seitenleiste.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Ursachenanalyse

### Root Cause

Belegt am Code (Stand `0e3f24b`), **nicht am laufenden Programm erprobt**:

1. **#54** — Die Esc-Kaskade endet bei offenem Aufgabenfenster in `if (S.ui.offen) { if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) t.blur(); S.ui.offen = null; … }` (`web/app.js:2496`). `blur()` löst im geänderten Feld `change` aus, der `change`-Hörer ruft `aufgabeAendern` (`web/app.js:2287–2296`); `focusout` trägt einen zurückgesetzten Wert nach (`aenderungNachtragen`, `web/app.js:2206`, `web/sichtzustand.js:139–143`). Vorbild im selben Fenster: `teilEdit` (`web/app.js:2494`) beendet bei Esc nur den Modus.
2. **#96** — Der `change`-Hörer setzt `titelBearbeiten = false` und ruft `aufgabeAendern` ohne Feldkennung (`web/app.js:2292–2295`); nach der Ablehnung zeichnet `render()` das Lesediv (`web/ansicht.js:358–360`).
3. **#93** — `zeit-neu` ruft `schreiben(…)` (`web/app.js:1910–1915`), das die Meldung ohne Feldkennung setzt (`web/app.js:535`); `#zeit-neu` wird leer neu gezeichnet (`web/ansicht.js:445`). Die Feldkennung trägt heute nur die Herkunft (`herkunftVerweis`, `web/ansicht.js:598–605`; Entwurf in `S.ui.herkunftEntwurf`, `web/app.js:1899–1901`).
4. **#87** — kein Fehler im engen Sinn: die drei Zeilen schreiben `<span class="k">…</span>` von Hand (`web/ansicht.js:661`, `:670`, `:829`), `FELDER` (`web/kultur.js:66`) kennt die drei Schlüssel nicht. R00109 hat sie bewusst einzeilig gelassen und diese Folgekarte angelegt.
5. **#97** — Die Bindung meldet beim Start nur die Hörer an (`web/app.js:2429–2432`); gerechnet wird erst mit dem ersten `resize` oder `scroll`.

### Betroffene Komponenten

- `web/app.js` (Esc-Kaskade, `change`-Hörer, `fensterMelden`, `schreiben`, Aktionen `herkunft-neu` und `zeit-neu`, Bindung an den sichtbaren Bereich)
- `web/ansicht.js` (Titelfeld, `#zeit-neu`, Verweis auf die Meldung, drei Feldzeilen, Fußhinweis `:343`, Kürzelhilfe `:777`)
- `web/kultur.js` (`FELDER`), `web/sichtzustand.js` (nur genutzt), eventuell `web/kd-app.css`
- E2E-Specs unter `e2e/tests/`
- **unverändert**: Server und API

## Lösungsvorschlag

### Langfristige Lösung

Je Mitglied die Entscheidung des Architekten, wörtlich aus den Nachträgen:

- **#54** (ADR-0010 N9): ein Zweig in der Esc-Kaskade **vor** `S.ui.offen`. Er setzt den Feldwert auf den gezeichneten Stand zurück, hakt das Feld als gemeldet ab (`aenderungGemeldet`), räumt den Entwurf des Felds samt der an ihn gebundenen Meldung und verlässt den Bearbeitungsmodus, wo es einen gibt. Enter und das Verlassen speichern weiter.
- **#96, #93** (ADR-0015 N2): jede Ablehnung nennt ihr Feld; **ein** Entwurf `{ nummer, feld, wert }` je Fenster (`herkunftEntwurf` geht darin auf); der Renderer zeichnet das genannte Feld über **eine** Funktion mit Entwurf, `aria-invalid="true"` und `aria-describedby="fenster-meldung"`. Die Kennung `fenster-meldung` bleibt (Karte #86 baut darauf).
- **#87**: drei Einträge in `FELDER`, die drei Zeilen rufen `vBeschriftung`.
- **#97** (ADR-0016 N1): nach dem Anmelden der Hörer einmal `sichtbarenBereichSetzen()`.

### Optionen

Die Varianten sind in den Nachträgen abgewogen und entschieden; hier nur die Wahl:

| Mitglied | gewählt | verworfen |
|---|---|---|
| #54 | zwei Stufen, eine Regel für jedes Textfeld mit Entwurf | ein Esc verwirft und schließt sofort (einzige Stelle im Haus, an der Esc zweierlei täte); nur das Titelfeld (zweite Esc-Regel in einem Fenster) |
| #96, #93 | ein Entwurf je Fenster, eine Verweis-Funktion | je Feld ein eigener Entwurf (jeder neue Fall vergisst eine der vier Stellen); nur `aria-invalid` ohne stehende Eingabe (das Feld zeigte den alten Wert als ungültig) |
| #87 | Muster aus R00109 anwenden | keine Variante — die Lage unter der Beschriftung ist freigegeben |
| #97 | einmal beim Start rechnen | keine Variante |

### Alternative Ansätze

- **Fußhinweis unverändert lassen**: kostet nichts, verschweigt aber den Verlust des Entwurfs an der Stelle, an der er eintritt.
- **Fußhinweis je Zustand wechseln** („verwerfen“ nur mit Entwurf): das Fenster zeichnet beim Tippen nicht neu; ein eigener Zeichenweg nur für den Hinweis wäre mehr Bau als Nutzen.

## Test-Strategie

### Tests zur Reproduktion

Je Mitglied eine E2E-Probe am echten Programm, vor dem Bau rot aus dem genannten Grund (Vorschlag: `e2e/tests/r00155-esc-verwirft.spec.js`, `r00155-abgelehnte-eingabe.spec.js`, Ergänzung in `r00111-tastatur.spec.js` und den Kultur-Specs). „Nichts geschrieben“ wird überall gleich gemessen: kein `PATCH` und kein `POST` im Netzwerkprotokoll ab dem Tastendruck, die Datei der Aufgabe byteweise gleich, `git rev-list --count HEAD` unverändert, der Text „gespeichert …“ im Fuß unverändert.

### Code-Extraktion für isoliertes Testing

Empfehlung, Wahl des Entwicklers: die Frage „hat dieses Feld einen Entwurf?“ und die Funktion, die den Verweis auf die Meldung zeichnet, als reine Funktionen — dann sind die Feldarten der Tabelle aus ADR-0010 N9 auch als Unit-Test fahrbar (`e2e/einheit/`).

### Regressionstests

- `e2e/tests/r00116-fenstertitel.spec.js` Zeilen 155, 163, 169 erwarten heute, dass **ein** Esc aus dem Bearbeitungsmodus des Titels das Fenster schließt. Sie werden auf zwei Esc umgestellt; R00116 FA 7 („Esc schließt das Fenster wie heute“) gilt für den Bearbeitungsmodus nicht mehr.
- `e2e/tests/r00109-k-beschriftung.spec.js:75` erwartet heute die nackten Beschriftungen „Schlüssel“ und „Zählt in Berichten“; mit #87 tragen sie einen Schlüssel.
- `e2e/tests/r00111-meldungen-schmal.spec.js` (Herkunft „X1“, Zeilen 125, 177, 198, 220) und `r00111-tastatur.spec.js` (Tastatur nach dem Fokus) bleiben ohne geänderte Erwartung grün.
- `r00144-kopf-aktionen.spec.js:84` und `r00111-meldungen-schmal.spec.js:137/249/374` suchen den Fußhinweis über das Wort „schließen“ — es bleibt im neuen Text enthalten.
- Die eigenen Esc-Zweige bleiben: Menü und Pop zuerst, Umbenennen auf der Karte (R00029), Teilaufgabe im Bearbeiten (`teilEdit`, R00066), Zeit im Bearbeiten (`zeitEdit`).
- Alle Ebenen: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test` (volle Suite ohne `nice` und ohne parallele Last, `AI-Team/gelerntes.md` 2026-11-10).

## Akzeptanzkriterien

Grundbestand, über die API herstellbar: Board `entwicklung`; Karte #1 „Abnahme prüfen“ mit Beschreibung „Erster Absatz“ und Labels `ui, daten`; Karte #2 „Zweite Aufgabe“ ohne Beschreibung; Person `st` (Mensch) im Browser gewählt, Person `bot` (Agent) für fremde Änderungen über die API. 1280 px, hell, wo nichts anderes steht. „Nichts geschrieben“ wie unter „Tests zur Reproduktion“.

### Paket (Pflicht)

- [ ] **P-1** Je Mitglied ist der Reproduktionstest ohne Fix rot und mit Fix grün; das heutige Ergebnis steht je Probe im Commit (der Architekt hat nichts erprobt).
- [ ] **P-2** Der ursprüngliche Fehler tritt in den Szenarien der User Story (US-1 bis US-9) nicht mehr auf.
- [ ] **P-3** Keine neuen Fehler: alle Tests aller Ebenen grün.

### Mitglied #54 — Esc verwirft den Entwurf (Titel, Labels, Enter-Felder; ADR-0010 N9)

- [ ] **54-1 (heute rot) Abnahme-Probe der Karte #54, wörtlich:** „Titel ändern, Esc → Datei und git unverändert, alter Titel sichtbar.“ Gegeben das Aufgabenfenster von #1 ist offen und der Titel wird bearbeitet; **wenn** „Abnahme geprüft“ ins Titelfeld getippt und Esc gedrückt wird; **dann** bleibt das Fenster offen, der Titel liest „Abnahme prüfen“, der Fokus steht auf „Titel bearbeiten“, und nichts ist geschrieben. Heute: ein `PATCH`, ein Commit, Fenster zu.
- [ ] **54-2** Gegeben die Lage nach 54-1; **wenn** Esc ein zweites Mal gedrückt wird; **dann** ist das Fenster zu, der Fokus steht auf Karte #1, und nichts ist geschrieben.
- [ ] **54-3** Gegeben der Titel von #1 wird bearbeitet und ist unverändert; **wenn** Esc gedrückt wird; **dann** ist der Bearbeitungsmodus beendet, das Fenster offen und der Fokus auf „Titel bearbeiten“; ein zweites Esc schließt.
- [ ] **54-4 (heute rot) Labels.** Gegeben das Labels-Feld von #1 zeigt `ui, daten`; **wenn** `ui, daten, neu` getippt und Esc gedrückt wird; **dann** zeigt das Feld `ui, daten`, der Fokus steht im Feld, das Fenster ist offen, und nichts ist geschrieben. Ein weiteres Esc im unveränderten Feld schließt das Fenster.
- [ ] **54-5 Labels nach einem Live-Ereignis.** Gegeben im Labels-Feld von #1 steht getippt `ui, daten, neu`, und `bot` ändert über die API den Titel von #2 (das Fenster zeichnet neu); **wenn** Esc gedrückt und das Feld danach mit Tab verlassen wird; **dann** ist nichts geschrieben, die Datei von #1 trägt weiter die Labels `ui, daten`.
- [ ] **54-6 (heute rot) Enter-Felder.** Gegeben das Aufgabenfenster von #1; **wenn** in das Feld der Tabelle der Text getippt und Esc gedrückt wird; **dann** ist das Feld leer, der Fokus im Feld, das Fenster offen, und nichts ist geschrieben. Ein weiteres Esc im leeren Feld schließt das Fenster. Heute schließt schon das erste Esc.

  | Feld | getippt |
  |---|---|
  | „Neue Herkunft“ (`#herkunft-neu`) | `I00` |
  | neue Teilaufgabe (`#teil-neu`) | `Entwurf` |
  | „Zeit nachtragen“ (`#zeit-neu`) | `0:4` |

- [ ] **54-7 Abgelehnte Herkunft.** Gegeben in „Neue Herkunft“ von #1 wurde `X1` mit Enter abgelehnt (Meldung steht, das Feld ist ungültig — R00111 AK 1); **wenn** Esc gedrückt wird; **dann** ist das Feld leer, die Meldung fort, das Feld trägt weder `aria-invalid` noch `aria-describedby`, das Fenster ist offen; nach dem nächsten Neuzeichnen (`bot` ändert #2) steht `X1` nicht wieder im Feld.
- [ ] **54-8 Die Meldung eines anderen Felds bleibt.** Gegeben `X1` wurde in „Neue Herkunft“ abgelehnt; **wenn** im Labels-Feld `neu` getippt und Esc gedrückt wird; **dann** zeigt Labels wieder `ui, daten`, und die Meldung zu `X1` samt ungültigem Herkunftsfeld steht weiter.
- [ ] **54-9 Felder ohne Entwurf.** Gegeben der Fokus steht im Feld Spalte, Klasse bzw. Fällig von #1 (drei Fälle); **wenn** Esc gedrückt wird; **dann** ist das Fenster beim ersten Esc zu, und nichts ist geschrieben.
- [ ] **54-10 Gegenprobe: Enter und Verlassen speichern.** Gegeben der Titel von #1 wird bearbeitet; **wenn** „Abnahme geprüft“ getippt und Enter gedrückt wird; **dann** steht `title: Abnahme geprüft` in der Datei, und es gibt genau einen neuen Commit von `st`. Ebenso: `ui, daten, neu` in Labels und Tab → gespeichert, ein Commit.
- [ ] **54-11 Fußhinweis und Kürzelhilfe (sichtbarer Text).** Gegeben das Aufgabenfenster von #1 bei 1280 px; **dann** lautet der Tastenhinweis im Fuß „Esc Eingabe verwerfen, sonst schließen“ (`Esc` als Taste gesetzt), und die Kürzelhilfe (`?`) führt im Abschnitt des Aufgabenfensters „Esc — Eingabe verwerfen, sonst schließen“. Bis 640 px bleibt der Tastenhinweis im Fuß wie heute ausgeblendet.

### Mitglied #54, Block Beschreibung — herauslösbar (`54B`)

Nimmt der Betreiber die Regel für die Beschreibung zurück, entfällt genau dieser Block (mit US-5 und B0723); die Beschreibung verhält sich dann bei Esc wie heute.

- [ ] **54B-1 (heute rot)** Gegeben die Beschreibung von #1 („Erster Absatz“) wird bearbeitet; **wenn** „ und mehr“ angehängt und Esc gedrückt wird; **dann** liest die Beschreibung „Erster Absatz“, der Fokus steht auf „Beschreibung bearbeiten“, das Fenster ist offen, und nichts ist geschrieben. Ein zweites Esc schließt.
- [ ] **54B-2** Gegeben die Beschreibung von #1 wird bearbeitet und ist unverändert; **wenn** Esc gedrückt wird; **dann** ist der Bearbeitungsmodus beendet und das Fenster offen.
- [ ] **54B-3 (heute rot) Leere Beschreibung.** Gegeben #2 ohne Beschreibung (das Textfeld steht sofort da); **wenn** „Notiz“ getippt und Esc gedrückt wird; **dann** ist das Feld leer, der Fokus im Feld, das Fenster offen, und nichts ist geschrieben. Ein weiteres Esc im leeren Feld schließt.
- [ ] **54B-4 Gegenprobe.** Strg+Enter und das Verlassen des Felds speichern die Beschreibung wie bisher (je ein Commit).

### Mitglied #96 — abgelehnter Titel bleibt im Feld (ADR-0015 N2)

- [ ] **96-1 (heute rot) Abnahme-Probe der Karte #96, wörtlich:** „Titel leeren und speichern → Titelfeld aria-invalid=true, describedby verweist auf die Meldung; nach Korrektur entfernt.“ Gegeben der Titel von #1 wird bearbeitet; **wenn** das Feld geleert und Enter gedrückt wird; **dann** steht die Meldung „Die Aufgabe braucht einen Titel“ als `alert` im Fuß, das Titelfeld ist weiter Eingabefeld, leer, hat den Fokus, trägt `aria-invalid="true"` und `aria-describedby="fenster-meldung"`, ein Element mit dieser Kennung ist vorhanden, und die Datei trägt weiter `title: Abnahme prüfen`. Heute: Lesediv mit altem Titel, kein Feld.
- [ ] **96-2 Berichtigung.** Gegeben die Lage nach 96-1; **wenn** „Abnahme geprüft“ getippt und Enter gedrückt wird; **dann** ist der Titel gespeichert (ein Commit), die Meldung fort, der Titel liest „Abnahme geprüft“, und kein Feld des Fensters trägt `aria-invalid`.
- [ ] **96-3 Verlassen statt Enter.** Gegeben der Titel von #1 wird bearbeitet; **wenn** das Feld geleert und mit Tab verlassen wird; **dann** gilt dasselbe wie in 96-1 — das Titelfeld bleibt Eingabefeld, ist ungültig und hat den Fokus (ADR-0015 Regel 4).
- [ ] **96-4 Nur das eine Feld.** In der Lage nach 96-1 trägt kein anderes Feld des Fensters `aria-invalid` oder `aria-describedby="fenster-meldung"`.
- [ ] **96-5 Esc nach der Ablehnung** (gilt, solange #54 im Paket ist). Gegeben die Lage nach 96-1; **wenn** Esc gedrückt wird; **dann** liest der Titel „Abnahme prüfen“, die Meldung ist fort, der Fokus steht auf „Titel bearbeiten“, das Fenster ist offen.
- [ ] **96-6 Der Entwurf gehört zur offenen Aufgabe.** Gegeben die Lage nach 96-1; **wenn** das Fenster geschlossen und #1 bzw. #2 geöffnet wird; **dann** steht der Titel im Lesezustand, keine Meldung, kein ungültiges Feld.

### Mitglied #93 — „Zeit nachtragen“ behält die abgelehnte Eingabe (ADR-0015 N2)

Die Karte nennt keine eigene Abnahme-Probe; ihre Erwartung wörtlich: „Eingabe bleibt zur Berichtigung stehen, Feld verweist auf die Meldung (wie „Neue Herkunft“, R00111).“

- [ ] **93-1 (heute rot)** Gegeben das Aufgabenfenster von #1 in der Ansicht „Zeiten“; **wenn** `abc` in „Zeit nachtragen“ getippt und Enter gedrückt wird; **dann** steht die Meldung „Dauer „abc“: z. B. 0:45, 1,5 oder 90 min“ als `alert` im Fuß, das Feld zeigt `abc`, hat den Fokus, trägt `aria-invalid="true"` und `aria-describedby="fenster-meldung"` (Element vorhanden), und es ist keine Zeit eingetragen. Heute: Feld leer, kein `aria-invalid`.
- [ ] **93-2 Berichtigung.** Gegeben die Lage nach 93-1; **wenn** das Feld auf `0:45` berichtigt und Enter gedrückt wird; **dann** ist eine Zeit von 0:45 eingetragen (ein Commit), das Feld leer, die Meldung fort, und kein Feld trägt `aria-invalid`.
- [ ] **93-3 Übersteht das Neuzeichnen.** Gegeben die Lage nach 93-1; **wenn** `bot` den Titel von #2 ändert; **dann** zeigt das Feld weiter `abc` und ist ungültig, die Meldung steht.
- [ ] **93-4 Ein ungültiges Feld.** Gegeben `X1` wurde in „Neue Herkunft“ abgelehnt; **wenn** danach `abc` in „Zeit nachtragen“ abgelehnt wird; **dann** nennt die eine Meldung die Dauer, „Zeit nachtragen“ ist ungültig, und „Neue Herkunft“ trägt weder `aria-invalid` noch `aria-describedby`.
- [ ] **93-5 Esc nach der Ablehnung** (gilt, solange #54 im Paket ist). Gegeben die Lage nach 93-1; **wenn** Esc gedrückt wird; **dann** ist das Feld leer, die Meldung fort, kein `aria-invalid`, das Fenster offen; nach dem nächsten Neuzeichnen steht `abc` nicht wieder im Feld.
- [ ] **93-6 Der Entwurf gehört zur offenen Aufgabe.** Gegeben die Lage nach 93-1; **wenn** das Fenster geschlossen und #2 geöffnet wird; **dann** ist „Zeit nachtragen“ leer, keine Meldung, kein ungültiges Feld.

### Mitglieder #96 und #93 gemeinsam

- [ ] **G-1 Ein Entwurf je Fenster** (Review-Punkt für `architektur-reviewer` und `code-reviewer`, ADR-0015 N2): es gibt genau einen Zustand für die abgelehnte Eingabe und eine Funktion, die den Verweis auf die Meldung zeichnet; `herkunftEntwurf` ist darin aufgegangen. Ein zweiter Entwurfszustand ist ein Befund. Gilt, solange eines der beiden Mitglieder im Paket ist.

### Mitglied #87 — Schlüssel als Hilfstext für drei Felder

- [ ] **87-1 Abnahme der Karte #87, wörtlich:** „Die drei Felder im Aufgabenfenster zeigen unter der Beschriftung `reporting`, `signals` bzw. `key` in Mono in eigenem Element; bei 320 px scrollt nichts quer.“ Gegeben eine Aufgabe, über die API mit `key: ticket-17` angelegt, und ein eingerichtetes Signal; **wenn** ihre Details geöffnet werden; **dann** steht unter „Schlüssel“ `key`, unter „Signale“ `signals` und unter „Zählt in Berichten“ `reporting` — je in einem eigenen Element außerhalb der Beschriftung, in der Mono-Schrift und Farbe der übrigen Schlüssel (R00109, 10,5/14, `--kd-muted`).
- [ ] **87-2** Die drei Beschriftungen lauten unverändert „Schlüssel“, „Signale“, „Zählt in Berichten“; die Gruppen behalten ihren zugänglichen Namen („Signale“, „Zählt in Berichten“), der Schlüssel ist nicht Teil davon.
- [ ] **87-3** Bei 320 px scrollt in den Details nichts quer (Fenster und jede Feldzeile), hell und dunkel; jede der drei Zeilen ist mindestens 38 px hoch wie die übrigen Zeilen mit Schlüssel.
- [ ] **87-4 Grenze (Betreiber 2026-11-13).** Die Felder des ersten Starts und von „Einrichten“ (`ich`, `agents`, `board`, `spalten`) und die Anzeige „wartet auf“ sind unverändert; die bestehenden Kultur-Specs bleiben dort ohne geänderte Erwartung grün.
- [ ] **87-5** Die drei Schlüssel stehen in `FELDER` (`web/kultur.js`), die drei Zeilen zeichnen über `vBeschriftung` — keine vierte Stelle mit eigenem Markup.

### Mitglied #97 — Bildschirmtastatur beim Laden (ADR-0016 N1)

- [ ] **97-1 (heute rot) Abnahme-Probe der Karte #97, wörtlich:** „Tastatur vor dem Laden nachgebildet → Meldung im sichtbaren Bereich.“ Gegeben 414 px mit Touch, der sichtbare Bereich ist **vor** dem Laden der Seite verkleinert (Init-Skript, dieselbe Höhe wie im Test „nach dem Fokus“), und danach kommt kein `resize` und kein `scroll`; **wenn** das Aufgabenfenster von #1 geöffnet und `X1` in „Neue Herkunft“ mit Enter abgelehnt wird; **dann** liegen Meldung und Feld ganz im sichtbaren Bereich.
- [ ] **97-2** Der Test „Tastatur nach dem Fokus“ (R00111 AK 11, `r00111-tastatur.spec.js:95`) bleibt ohne geänderte Erwartung grün.
- [ ] **97-3** Desktop 1280 × 800 ohne Nachbildung: nach dem Start ist `--kd-vv-oben` nicht gesetzt (`r00111-tastatur.spec.js:153` bleibt grün).
- [ ] **97-4** Ohne `window.visualViewport` lädt die Seite ohne Fehler in der Konsole, und nichts wird gesetzt.

### Mutanten (test-ehrlichkeit)

Je Mutant: Stelle per `page.route` in der ausgelieferten Datei ersetzen (Muster `mutanteEinsetzen`, `r00111-*.spec.js`), nichts ins Repository schreiben. Das Ergebnis (Mutant, Kriterium, rot ja/nein) steht je Mitglied im Bericht des Baus.

- [ ] **M-54a** Esc-Zweig ohne Zurücksetzen des Werts (Esc speichert wieder) → 54-1, 54-4 rot
- [ ] **M-54b** Esc-Zweig hinter `S.ui.offen` (Fenster schließt beim ersten Esc) → 54-1, 54-6 rot
- [ ] **M-54c** Zurücksetzen ohne `aenderungGemeldet` → 54-5 rot
- [ ] **M-54d** Entwurf der abgelehnten Eingabe bei Esc nicht geräumt → 54-7 rot
- [ ] **M-54e** Esc-Regel greift für jedes `INPUT`/`SELECT` → 54-9 rot
- [ ] **M-54f** Verwerfen auch beim Verlassen → 54-10 rot
- [ ] **M-54B** Esc-Zweig ohne die Beschreibung → 54B-1, 54B-3 rot
- [ ] **M-96** Aufruf des Titels ohne Feldkennung → 96-1 rot
- [ ] **M-93a** Aufruf von „Zeit nachtragen“ ohne Feldkennung → 93-1 rot
- [ ] **M-93b** Entwurf nach Erfolg nicht geleert (alter Wert steht im Feld) → 93-2 rot
- [ ] **M-87** eine der drei Zeilen wieder mit nacktem `.k` → 87-1 rot
- [ ] **M-97a** „rechnet nicht beim Start“ → 97-1 rot
- [ ] **M-97b** „liest nur beim Start, ohne Hörer“ → 97-2 rot

## Implementierungshinweise

- **Probe zuerst, je Mitglied**: das heutige Verhalten messen, bevor gebaut wird. Weicht es vom gelesenen Stand ab (z. B. Esc speichert in Labels nicht), geht das an den Architekten — kein gelockertes Kriterium.
- **Ungeprobte Annahmen**: (a) `aenderungGemeldet` verhindert nach einem Live-Ereignis das Nachtragen beim Verlassen (54-5); (b) nach einer Ablehnung beim Verlassen bleibt `titelBearbeiten` an, obwohl der `focusout`-Zeitgeber nach 50 ms den Modus beendet, wenn der Fokus nicht im Titelfeld steht (`web/app.js:2209–2211`, Kriterium 96-3); (c) der Init-Skript-Weg bildet die Tastatur vor dem Laden nach, ohne dass ein Ereignis nachkommt (97-1).
- Proben mit Live-Ereignis (54-5, 54-7, 93-3) sind nicht auswertbar, wenn der Ordner-Wächter der Maschine ausfällt (`AI-Team/gelerntes.md`, #80 Architektur, inotify); dann das Neuzeichnen über einen Ansichtswechsel im Fenster herstellen und das im Bericht nennen.
- `web/`-Dateien sind eingebettet — sichtbar erst nach `cargo build` und Neustart.
- Karte **#161** (Stift an der Beschreibung) ändert später nur das Rückgabeziel des Fokus der Beschreibung; die Regel entscheidet sie nicht neu.
- Reihenfolge und Herauslösen: #87 und #97 hängen an keinem anderen Mitglied. #96 und #93 teilen den einen Entwurf (B0726). #54 braucht den Entwurf nur für die Kriterien 96-5 und 93-5; ohne #96 und #93 räumt Esc den heutigen `herkunftEntwurf` (54-7).

## Offene Fragen

- **An den product-owner, hält den Bau nicht auf:** Wortlaut des geänderten Fußhinweises und des Eintrags der Kürzelhilfe — „Eingabe verwerfen, sonst schließen“ (Kriterium 54-11). Bis zur Antwort gilt dieser Wortlaut; der `rechtschreib-reviewer` prüft ihn. Kein Artboard nötig: kein neues Element, kein neuer Zustand, nur Text in einem vorhandenen Hinweis.
- Keine weitere. Eine sichtbare Hervorhebung des ungültigen Felds gibt es heute nicht (auch nicht bei „Neue Herkunft“); sie ist nicht Umfang.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Zettelzeile am Gerät für #97: Seite mit offener Bildschirmtastatur neu laden — die Nachbildung vor dem Laden ist künstlich (ADR-0016 N1, akzeptierte Schwäche).

## Warum löst diese Anforderung das Problem? (Pflicht)

- **#54**: Esc ruft heute `blur()`, das Verlassen speichert (X). Steht der Verwerfen-Zweig vor dem Schließen und setzt er den Wert zurück, bevor das Feld verlassen wird, feuert kein Schreibweg (Y); der Mensch sieht den alten Wert, die Datei und `git log` bleiben, wie sie waren (Z).
- **#96, #93**: Die Ablehnung nennt ihr Feld nicht und der Renderer zeichnet das Feld ohne die Eingabe (X). Nennt jede Ablehnung ihr Feld und hält ein Entwurf den Wert (Y), steht die Eingabe zur Berichtigung da, und Hilfstechnik hört am Feld, dass und warum es ungültig ist (Z).
- **#87**: Drei Zeilen zeichnen ihre Beschriftung von Hand (X); über `vBeschriftung` (Y) nennt jede Feldzeile der Details den Schlüssel, unter dem der Wert in der Datei steht (Z).
- **#97**: Gerechnet wird erst mit dem ersten Ereignis (X); einmal beim Start gerechnet (Y), liegt die Meldung auch dann im sichtbaren Bereich, wenn die Tastatur schon beim Laden offen ist (Z).

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-15)**: eigene Interaction **I0142** unter D0003 (Aufgabe), 12 Bubbles B0720–B0731, je Mitglied im Namen erkennbar. Eigene Interaction nach der Projektlehre (`AI-Team/gelerntes.md` 2026-11-11, 2026-11-13): I0011 (R00011), I0098 (R00109), I0100 (R00111) und der Slice zu R00116 sind abgenommen und bleiben zu.
- **Weiche (`befunde-einplanen`)**: #54 falsch gebaut (Betreiber 2026-11-13: Esc ist überall der Abbruch); #96 und #93 falsch gebaut gegen die Regel aus R00111 AK 1, die nur für „Neue Herkunft“ gebaut wurde; #87 reifer (Folgekarte aus R00109, PO Z. 157); #97 falsch gebaut gegen ADR-0016 (Mutant „liest nur beim Start“ überlebte). Ein Dokument im Bug-Format, weil das Paket eine Karte führt; `ursprungslauf: R00011` für die führende Karte, die übrigen Läufe: R00111 (#96, #93, #97), R00109 (#87).
- **Abnahme-Proben**: #54, #96, #87, #97 wörtlich übernommen (54-1, 96-1, 87-1, 97-1); #93 trägt keine eigene Probe, ihre Erwartung steht wörtlich über dem Block.
- **Aufgehoben durch diese Anforderung**: R00116 FA 7 für den Bearbeitungsmodus des Titels; der Wortlaut „Esc schließen“ aus R00144 FA (Fuß) und R00111 Z. 134; R00011 „Esc schließt“ gilt weiter für das Fenster ohne Entwurf.
- **Nicht Umfang**: Rückweg des Fokus an den Stift (#161); stabiler Meldungsknoten und Wiederansage (#86); die Felder des ersten Starts (#87, Betreiber); „Label in Name“ in Einrichten (Kartenkommentar #87 vom 2026-11-08 — durch die Betreiber-Entscheidung „nur die drei Felder“ nicht Teil dieser Karte); das Fenster „Neue Aufgabe“ (eigener Esc-Weg, „abbrechen“).
- **Priorität**: Mittel — #54 schreibt ungewollt in Datei und Git; die übrigen sind Zugänglichkeit und Feinschliff.
- **Betroffene Nutzer**: wer im Aufgabenfenster arbeitet — mit Tastatur, Screenreader oder Bildschirmtastatur.
- **Workaround #54**: den alten Titel wieder eintippen (zweiter Commit).
