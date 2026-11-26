---
id: R00259
status: Neu
datum: 2026-11-26
---

# R00259: Braucht zwischen Karten — „wartet auf #n“ an der Karte und im Aufgabenfenster

## Beschreibung

Karte #235, Scheibe **S2 Oberfläche** von [ADR-0035](../Dokumentation/ADRs/0035-braucht-zwischen-karten-als-label.md) (Punkt 7 und Nachtrag N1, Punkte 1–8; Abnahme-Probe S2). S1 ([R00214](R00214-braucht-zwischen-karten-deutung-pruefung-an-der-tuer-und-lesefeld-in-der-api.md)) liefert je Aufgabe `braucht: [{nummer, titel, erledigt}]`; diese Anforderung zeigt es. Entscheidungen des PO (`AI-Team/po-entscheidungen.md` Z. 706–708, 724–733): die Karte zeigt eine fehlende Abhängigkeit als denselben Chip mit Sanduhr, Tooltip „#n fehlt“, zugänglicher Name „wartet auf #n, fehlt“, Warnfarbe nur im Fenster; offene „wartet auf“ stehen auch an Karten der letzten Spalte.

Die Gestaltung zeichnet der gestalter: [D0002](../Dokumentation/Wireframes/D0002.dc.html) (Chip mit Sanduhr; zwei Chips bei 320 px) und [D0003](../Dokumentation/Wireframes/D0003.dc.html) (drei Zustände, ×, Fehlertext bei 400, Herkunfts-Chip als `span.org`); der product-owner hat am 2026-11-26 freigegeben (Z. 732). Die Kriterien nennen diese **Zustände**, nicht Pixel; sie gelten auch, solange die Artboards noch nicht gezeichnet sind.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Aufgaben sind der Stand“, „`Braucht`-Beziehungen bleiben echte Abhängigkeiten zwischen Karten“ (Vision Z. 106–107).

### Domänenbezug

Begriffe: Aufgabe, Karte, Aufgabenfenster, Board, Spalte (letzte Spalte), Label, archiviert, Abhängigkeit (braucht), erledigt (wie R00214). Ein Glossar-Eintrag für „Abhängigkeit (braucht)“ fehlt (Missing-Docs, wie R00214).

## Geschäftlicher Nutzen

Seit R00214 kann ein Agent per API fragen, worauf eine Karte wartet; ein Mensch sieht es noch nicht: `braucht:1` erscheint als Label-Chip, und das Textfeld lässt ihn Abhängigkeiten tippen, ohne zu sehen, ob sie offen sind (Stand 2026-11-23: 41 Aufgabendateien mit 47 solchen Labels in zwei Ordnern, R00214). Mit dieser Anforderung sieht die Projektleitung am Board auf einen Blick, welche Karten warten und worauf, und kann eine Abhängigkeit mit einem Klick lösen.

## Funktionale Anforderungen

**Quelle und Deutung**
- Karte und Fenster lesen allein das Feld `braucht` der geladenen Aufgabe (`GET /api/aufgaben`); keine zweite Anfrage, kein Nachschlagen in anderen Aufgaben, kein Zwischenzustand „unbekannt“.
- Welche Labels als Abhängigkeit statt als Label erscheinen, entscheidet der Browser mit derselben Regel wie der Server (R00214 „Deutung“: ohne Groß/Klein `braucht:<n>`, `n` ≥ 1 ohne führende Null; andere Formen bleiben gewöhnliche Labels); eine reine Funktion mit Unit-Test.
- Fehlt `braucht` an einer Aufgabe, zeigt sie ihre Labels wie vor dieser Anforderung.

**Karte**
- Je offener Abhängigkeit ein Chip „wartet auf #n“ mit Sanduhr; Tooltip der Titel der gebrauchten Karte. Erledigte Abhängigkeiten erscheinen an der Karte nicht.
- Fehlt die Datei der gebrauchten Karte (`titel: null`): derselbe Chip, Tooltip „#n fehlt“, keine Warnfarbe.
- Die gedeuteten Labels erscheinen nicht zusätzlich als Label-Chip.
- Der zugängliche Name der Karte nennt „wartet auf #n“, bei fehlender Datei „wartet auf #n, fehlt“.
- Die Karte zeigt ihre offenen Abhängigkeiten in jeder Spalte, auch in der letzten.
- Der Chip ist kein eigenes Bedienelement der Karte; der Klick öffnet die Karte selbst.
- Bei 320 px bleiben zwei Chips sichtbar (bei Bedarf Umbruch), ohne Querscrollen; auch sechs offene Abhängigkeiten liegen bei 320 px ganz im Bild, ohne Querscrollen.

**Aufgabenfenster** (Reiter „Details“ und schmale Spalte im Inhalt)
- Drei Zustände: offen „wartet auf #n Titel“; erledigt „#n erledigt“ (gedämpft); fehlt „#n fehlt“ (Warnung). Der Zustand steht im Wortlaut, nicht nur in der Farbe.
- Klick auf „wartet auf“ oder „erledigt“ öffnet die gebrauchte Karte über `…/aufgabe/<n>`, auch auf einem anderen Board oder archiviert; „#n fehlt“ ist nicht klickbar.
- Das Label-Feld zeigt nur die übrigen Labels; die Abhängigkeiten stehen als Chips in derselben Zeile davor. Speichern schickt die gedeuteten Labels der gespeicherten Liste wörtlich und in ihrer Reihenfolge mit, danach die Einträge des Felds.
- **×** an einer Abhängigkeit entfernt **jedes** Label, das auf diese Nummer deutet (auch `BRAUCHT:12` neben `braucht:12`), per `PATCH labels`; Hinweis „Abhängigkeit #n entfernt“ mit „rückgängig“. „rückgängig“ fügt das Label neu hinzu und geht durch die Tür von R00214 (ist die Karte inzwischen gelöscht, zeigt der Hinweis den Wortlaut des Servers, „Aufgabe #n gibt es nicht (braucht:n)“).
- **400 am Label-Feld** (jede, nicht nur `braucht:`): die Eingabe bleibt im Feld stehen, das Feld trägt `aria-invalid="true"` und verweist mit `aria-describedby` auf die Fenstermeldung mit dem Wortlaut des Servers; nichts wird geschrieben.

**Aktualität**
- Wird die gebrauchte Karte erledigt, zurückgezogen oder zurückgelegt, zeigen Karte und offenes Fenster binnen 1 s ohne Neuladen den neuen Zustand (Live-Ereignis, kein eigener Wächter).

## Nicht-funktionale Anforderungen

- Keine API-Änderung, keine zusätzliche Anfrage, keine Änderung an `werkzeuge/` der Factory.
- Barrierefreiheit: Kontrast in Hell und Dunkel (WCAG 1.4.3 Text ≥ 4,5:1, auch gedämpft; 1.4.11 Sanduhr, ×, Chiprand, Fokusring ≥ 3:1); Zustand nicht allein an der Farbe (1.4.1).
- Eine Wanduhr-Grenze ist **kein** Gate-Kriterium; „binnen 1 s“ (AK 2) wird ereignisgenau abgewartet (Zeitkriterium: Budget „spätestens nach“ mit Ereignis statt Polling-Raster).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API; „von Hand“ mit Git nur AK 3): Eigener Ordner auf freiem Port, Board `e` mit „Offen“, „In Arbeit“, „Fertig“ (letzte). #1 „Gerüst“ in Offen; #2 „Bau“ in Offen mit Labels `[ui, braucht:1]`; #3 „Doku“ in Offen mit `[braucht:1, braucht:4]`; #4 „Alt“ archiviert; #5 „Frei“ in Offen ohne Labels. Am Stand vor der Karte zeigt #2 zwei Label-Chips „ui“ und „braucht:1“ und kein „wartet auf“.

### Karte

- [ ] **AK 1** Gegeben die Ausgangslage. Wenn das Board gezeigt wird, dann trägt #2 genau einen Chip „wartet auf #1“ mit Sanduhr und dem Tooltip „Gerüst“; ihr einziger Label-Chip ist „ui“, keiner enthält „braucht“. #3 trägt genau einen Chip „wartet auf #1“ (für #4, archiviert, keinen). Der zugängliche Name der Karte #2 enthält „wartet auf #1“. #5 trägt keinen.
- [ ] **AK 2** Gegeben die Ausgangslage und das Fenster #2 offen. Wenn ein anderer Agent #1 per API nach „Fertig“ zieht, dann tragen #2 und #3 binnen 1 s und ohne Neuladen keinen Chip „wartet auf“, und das Fenster #2 zeigt „#1 erledigt“ (gedämpft). Zurück nach „Offen“: beide Chips sind wieder da. (Rechenbeispiel: erledigt = archiviert ODER letzte Spalte.)
- [ ] **AK 3** Gegeben #5, von Hand mit `braucht:999` committet (keine Datei 999). Wenn das Board gezeigt wird, dann trägt #5 einen Chip „wartet auf #999“ mit Sanduhr und dem Tooltip „#999 fehlt“, ohne Warnfarbe; sein zugänglicher Name lautet „… wartet auf #999, fehlt“.
- [ ] **AK 4** Gegeben #6 „Fertig-Karte“ in „Fertig“ mit `braucht:1` (#1 in Offen). Wenn das Board gezeigt wird, dann trägt #6 den Chip „wartet auf #1“ und ihr zugänglicher Name nennt ihn; ist #1 erledigt, trägt #6 keinen.
- [ ] **AK 5** Gegeben #3 mit `braucht:1` und `braucht:7` (#7 in Offen, beide offen) bei 320 px Breite. Wenn das Board gezeigt wird, dann sind beide Chips sichtbar (bei Bedarf Umbruch), und das Board scrollt nicht quer. **Variante:** sechs offene Abhängigkeiten bei 320 px — alle sechs Chips ganz im Bild (jedes Chip-Rechteck innerhalb der Karte), kein Querscrollen.

### Aufgabenfenster

- [ ] **AK 6** Gegeben die Ausgangslage mit #5 aus AK 3. Wenn das Fenster #3 geöffnet wird, dann zeigt es in „Details“ und in der schmalen Spalte „wartet auf #1 Gerüst“ und „#4 erledigt“; das Fenster #5 zeigt „#999 fehlt“ als Warnung, nicht klickbar (kein Link, kein Tastaturfokus als Bedienelement).
- [ ] **AK 7** Gegeben das Fenster #3. Wenn „wartet auf #1 Gerüst“ angeklickt wird, dann öffnet sich das Fenster #1 und die Adresse endet auf `/aufgabe/1`; „#4 erledigt“ öffnet #4 (archiviert).

### Label-Feld und ×

- [ ] **AK 8** Gegeben das Fenster #2. Wenn das Label-Feld gezeigt wird, dann steht darin „ui“, nicht „braucht:1“. Gibt die Person „ui, prio“ ein und speichert, dann trägt die Datei `braucht:1`, `ui`, `prio` in dieser Folge (ein Commit) und der Chip „wartet auf #1“ bleibt.
- [ ] **AK 9** Gegeben das Fenster #2. Wenn × an „wartet auf #1“ gedrückt wird, dann trägt die Datei kein `braucht:1` mehr, `ui` bleibt, genau ein Commit entsteht, die Karte trägt keinen Chip; der Hinweis lautet „Abhängigkeit #1 entfernt“ mit „rückgängig“ (Nummer wie am Chip „#n“, nicht `braucht:1`), und „rückgängig“ stellt das Label wieder her. Gegeben #2 von Hand mit `[braucht:1, BRAUCHT:1]`: ein × entfernt beide. Gegeben #1 inzwischen gelöscht: „rückgängig“ zeigt im Hinweis den Wortlaut des Servers „Aufgabe #1 gibt es nicht (braucht:1)“ und schreibt nichts.
- [ ] **AK 10** Gegeben das Fenster #5 aus der Ausgangslage (ohne Labels) — nicht die von Hand mit `braucht:999` aus AK 3. Wenn die Person `braucht:999` ins Label-Feld schreibt und speichert, dann zeigt die Fenstermeldung „Aufgabe #999 gibt es nicht (braucht:999)“, das Feld behält „braucht:999“, trägt `aria-invalid="true"` und `aria-describedby` auf die Meldung; die Datei ist bytegleich, kein Commit. Ebenso `braucht:5` → „#5 kann nicht auf sich selbst warten“; ebenso eine 400 ohne `braucht` (z. B. ein Label über der Längengrenze) → Eingabe bleibt, Meldung im Wortlaut des Servers. Nach erfolgreichem Speichern ist das Feld nicht mehr ungültig.

### Deutung und Aufbau

- [ ] **AK 11** (Unit, Node) Gegeben die Labels aus R00214 AK 3 (`[BRAUCHT:3, braucht:1, Braucht:1, braucht:abc, braucht:kd#12, braucht:012, braucht:0, braucht:999]`) und die Formen aus AK 7 von R00214. Wenn die Deutungsfunktion sie liest, dann ergibt sie die Nummern `3, 1, 999` in dieser Reihenfolge, die übrigen fünf bleiben Labels; dieselbe Nummer erscheint einmal.
- [ ] **AK 12** Gegeben die Ausgangslage. Wenn das Board und das Fenster #2 geöffnet werden, dann geht von der Seite genau eine Anfrage `GET /api/aufgaben` je Aufbau aus; keine Anfrage `GET /api/aufgaben/<n>` für die gebrauchten Karten (Zähler am Server-Log bzw. Netzwerkereignis).

### Gestalt

- [ ] **AK 13** (ux-reviewer, gemessen in Hell und Dunkel) Der Text der Zustände offen, erledigt (gedämpft) und fehlt (Warnung) hat ≥ 4,5:1 gegen seinen Grund; Sanduhr, ×, Chiprand (wo er den Zustand trägt) und Fokusring ≥ 3:1; „erledigt“ und „fehlt“ stehen als Wort.
- [ ] **AK 14** Gegeben die Artboards D0002 und D0003 vom product-owner freigegeben. Wenn die Oberfläche gebaut ist, dann zeigt sie die dort gezeichneten Zustände (D0002: Chip mit Sanduhr, zwei Chips bei 320 px; D0003: drei Zustände, ×, Fehlertext bei 400, Herkunfts-Chip als `span.org` unverändert neben den Abhängigkeits-Chips); Abweichungen nennt der entwickler im Bericht mit M3-Fundstelle.

## Betroffene Verzeichnisstruktur

- Deutung: neues reines Modul im Browser (Vorbild `web/kartenname.js`), Unit-Test dazu.
- Karte und Fenster: `web/ansicht.js` (Karte, `aufgabe()`, `vFeldZeile('labels')`), `web/kartenname.js` (Zusätze), `web/app.js` (Speichern, ×, Entwurf wie `entwurfskennung`), `web/kd-app.css`.
- Doku: `A00009-oberflaeche.md` (Soll → Ist), ADR-0035 N1 Verweis.
- Tests: Unit (Deutung, `kartenName`), E2E `e2e/tests/r00259-braucht-oberflaeche.spec.js` (Browser-Eigenes: Darstellung, Fokus, Live).

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Siehe WBS I0249 (B1382–B1393). Interactor-Regel: Die Deutung ist eine reine Funktion; DOM-Zeichnen und Ereignisse sind dünne Adapter. Ebene je Kriterium: Unit AK 11 (und `kartenName` zu AK 1/3/4); Integration entfällt (keine API-Änderung); E2E AK 1–10, 12 (Darstellung, Live, Tastatur, Aria sind Browser-Eigenes, kein Hot Path außer AK 2).

### Hinweise

- Neue Modifier nicht `leer` nennen (gelerntes 2026-11-06, `.leer`).
- Gate ohne Wanduhr-Grenze; AK 2 wartet ereignisgenau (Lehre #278, `rollen/planer/zeitkriterien.md`).

## Tests

- **Unit:** Deutung (AK 11), `kartenName` mit „wartet auf“/„fehlt“ (AK 1, 3, 4).
- **E2E:** AK 1–10, 12 gegen eigenen Ordner auf freiem Port, am Stand vor der Karte rot; AK 13 Messung durch ux-reviewer.

## Abhängigkeiten

- **Abhängig von:** [R00214](R00214-braucht-zwischen-karten-deutung-pruefung-an-der-tuer-und-lesefeld-in-der-api.md) (S1, erledigt: Lesefeld und Tür); Artboards D0002/D0003 (gestalter) für AK 14 — der product-owner hat am 2026-11-26 freigegeben (D0002 frei; D0003 frei mit Änderung, Nachzeichnung durch den gestalter ohne erneute Vorlage, `AI-Team/po-entscheidungen.md` Z. 732); der Bau der Funktion beginnt ohne sie.
- **Blockiert:** nichts.

## Offene Fragen

- **Frage an den PO 1 — entschieden** (2026-11-26, `AI-Team/po-entscheidungen.md` Z. 724, Lauf 235-product-owner-2): **Ja.** Die Karte zeigt „wartet auf #n“ auch, wenn die gebrauchte Karte auf einem anderen Board liegt; Chip und Tooltip hängen nur an `braucht` der geladenen Aufgabe (`erledigt` rechnet der Server über alle Boards), das Fenster öffnet sie über `…/aufgabe/<n>` (ADR-0035 N1.8).
- **Frage an den PO 2 — entschieden** (2026-11-26, `AI-Team/po-entscheidungen.md` Z. 725): **Alle offenen Chips, ein Chip je Nummer, ohne Obergrenze; die Zeile bricht um, keine Kürzung „+3“.** Die Umbruch-Variante mit sechs Chips bei 320 px steht in AK 5; der Hinweis-Wortlaut in AK 9 (Z. 726), die Klarstellung zu AK 10 (Z. 728) und die Gestaltfreigabe (Z. 732).

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist #226/#228: Abhängigkeiten stehen als stumme Label-Chips an den Karten, und die API kennt sie seit R00214, die Oberfläche nicht. Liest die Oberfläche das fertige Feld `braucht` der Liste (AK 12) und deutet dasselbe Label wie der Server (AK 11), zeigt jede Bestandskarte ihr „wartet auf“ sofort (AK 1, 3, 4), und das Live-Ereignis hält es aktuell (AK 2). Das Label-Feld ohne gedeutete Labels samt × (AK 8, 9) gibt genau einen Weg, eine Abhängigkeit zu lösen, und die Entwurfsregel (AK 10) macht einen Tippfehler sichtbar statt ihn zu verlieren.

## Missing-Docs

- Glossar: „Abhängigkeit (braucht)“, „erledigt“ (siehe R00214).
- Artboards D0002/D0003: Zustände gezeichnet noch offen (gestalter).

## Notizen

- Abnahme-Probe wörtlich aus ADR-0035 N1 (Punkte 1–10), ergänzt um die zwei Punkte des PO (Z. 706–708: „#n fehlt“ an der Karte, offene „wartet auf“ in der letzten Spalte → AK 3, 4).
- Entschieden ohne Rückfrage (Empfehlung, Lauf 235-planer-1): AK 10 gilt für jede 400 des Label-Felds (ADR N1.7); „erledigt“ ist an der Karte unsichtbar, im Fenster gedämpft; fehlende Datei zählt als offen (R00214 AK 6).
- Verworfen (ADR-0035 N1, Varianten zu 5): Feld zeigt weiter alle Labels; Chips ersetzen das Feld.
- Nachgezogen nach den Entscheidungen des PO vom 2026-11-26 (`AI-Team/po-entscheidungen.md` Z. 724–733, Lauf 235-planer-2): AK 5 „bei Bedarf Umbruch“ mit der Variante sechs Chips bei 320 px (Z. 725, 729); AK 9 Hinweis „Abhängigkeit #n entfernt“ mit „rückgängig“ (Z. 726); AK 10 „#5 aus der Ausgangslage“ (Z. 728); die beiden offenen Fragen sind entschieden (Z. 724, 725).
