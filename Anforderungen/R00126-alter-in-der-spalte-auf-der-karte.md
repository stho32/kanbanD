---
id: R00126
status: Neu
datum: 2026-11-11
---

# R00126: Alter einer Karte in ihrer Spalte zeigen

## Beschreibung

Am Kartenrand sieht man heute nicht, wie lange eine Karte schon in ihrer Spalte liegt: eine Karte, die seit sechs Tagen in „In Arbeit“ steht, sieht aus wie eine, die gerade ankam. Nach dieser Anforderung zeigt jede Karte, die eine Spalte betreten hat, ihr **Alter in der heutigen Spalte** — sichtbar kurz „seit 6 Tagen“, im zugänglichen Namen der Karte voll „seit 6 Tagen in In Arbeit“ (Karte #30, Beratung des product-owner 2026-11-03; Vorbilder Jira „Tage in Spalte“, Kanbanize, GitHub Projects). Das Alter ist eine Aussage der **Anzeige**: der Spalteneintritt wird im Browser aus den vorhandenen Bewegungen des Boards gerechnet (R00042, `spalteAm`), es kommt kein Feld, kein Endpunkt und kein Schreibweg hinzu (ADR-0019 Nachtrag N5).

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“ (der Spalteneintritt steht in der Git-Geschichte der Board-Datei) und „folgt gewohnten Konventionen“ (Tage in Spalte ist eine übliche Kanban-Anzeige).

Nicht Teil: eine Warnfarbe oder Schwelle („zu alt“), eine spaltenweise Ein-/Aus-Schaltung, eine Auswertung über mehrere Karten oder Spalten (Flusskennzahl), eine Sicht für Agenten, eine Anzeige an anderen Stellen als der Karte. Alle sind eigene Anforderungen (ADR-0019 N5 „Keine Schwelle“).

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Ein Board zeigt den Stand, aber nicht die Verweildauer. Wer das Board überblickt, sieht erst mit dem Alter, wo Arbeit liegen bleibt — der Auslöser der Kanban-Flussmessung. Die Information liegt bereits in der Git-Geschichte (R00042, ADR-0021 „ableiten statt speichern“); sie muss nur sichtbar gemacht werden. Es entsteht keine neue Datenhaltung, kein Commit und kein Bericht, der sich ändert.

## Funktionale Anforderungen

### Rechnung (ADR-0019 N5)

1. Grundlage ist die vorhandene Bewegungssicht `GET /api/berichte/bewegungen?board=<slug>` (R00042). Der Eintritt in die heutige Spalte ist der **letzte** Wechsel dieser Sicht, dessen Spalte die heute gezeigte ist — dieselbe Regel wie `spalteAm` (`web/berichte.js`), nur liefert sie statt des Spaltennamens den `zeitpunkt` dieses Wechsels; das Alter ist jetzt − Eintritt. Kein neuer Endpunkt, keine zweite Quelle, kein Cache.
2. Eine Aufgabe **ohne** Wechsel oder vom Board genommen (`spalteAm` → `null`) zeigt kein Alter.
3. Der Eintritt ist minutengenau aus dem Commit-Zeitpunkt (Versatz R00084). Eine Umsortierung **innerhalb** einer Spalte ist kein Spaltenwechsel und ändert das Alter nicht (ADR-0021 „Reorder ist unsichtbar“). Eine mehrfach bewegte Karte (A→B→A) zeigt den **letzten** Eintritt, nicht den ersten.
4. Das Alter wird **je Board** gezeigt, dessen Bewegungen geladen sind: dieselbe Karte kann auf zwei Boards in verschiedenen Spalten liegen und dort verschiedene Alter tragen.

### Dauertext (ADR-0013, ADR-0019 N1)

5. Die Dauer bildet `web/kultur.js` `seitText` — es entsteht keine zweite „seit …“-Regel: unter 48 Stunden abgerundete Stunden („seit 6 Stunden“), ab 48 Stunden kaufmännisch gerundete Tage („seit 6 Tagen“). Rechenbeispiele: 5 h → „seit 5 Stunden“, 0 h → „seit 0 Stunden“, 6 Tage → „seit 6 Tagen“, 41 Tage → „seit 41 Tagen“.
6. Die sichtbare Kurzform nennt nur die Dauer; die Vollform im Namen nennt zusätzlich die Spalte: „seit 6 Tagen in In Arbeit“.

### Zeigen (ADR-0019 N5 Punkte 2, 3)

7. Das Alter steht **sichtbar** an der Karte als Kurzform (FA 5) — neutral, ohne Warnfarbe, ohne Symbol, das „alt“ bedeutet, ohne Schwelle. Ort und Form der Kurzform auf der Karte (eigene kleine Zeile, Chip oder Text) legt die UX-Vorprüfung fest; die Anforderung fixiert nur: sichtbar, kurz nach FA 6 und die Breitenregeln nach FA 9.
8. Der zugängliche Name des Listeneintrags trägt die Vollform, gestellt vor „ausgewählt“ und **nach** einem etwaigen Timer-Zusatz (R00114): „#<nr> <Titel>[, <Klasse>][, Timer läuft seit …][, seit <Dauer> in <Spalte>][, ausgewählt]“; fehlende Teile fallen samt Komma weg. Beide Zusätze können nebeneinander stehen.
9. Auf schmalen Breiten (320, 375, 414 px) scrollt die Seite nicht quer, die Karte bleibt im Rechteck ihrer Spalte, und der Titel bleibt lesbar (mindestens 90 px, Rückfall-Vorgabe aus R00114/R00115). Reicht der Platz in der Kopfzeile nicht, gilt der vorhandene Kopfzeilen-Umbruch (ADR-0019 N4) — es entsteht keine neue Form.

### Grenzen (ADR-0019 N5)

10. Eine Karte ohne Eintritt (FA 2) trägt weder Kurzform noch Namenszusatz; ihr Markup ist wie heute.
11. **Kein zweiter Zeitgeber**: das Alter wird beim Zeichnen entschieden und altert zwischen zwei Zeichnungen nicht fort (Tagesgenauigkeit genügt). Ein Live-Ereignis (D00005) zeichnet wie heute neu; ein Sekundentakt entsteht für das Alter nicht.
12. **Nur gelesen**: nichts wird in `boards/*.md`, `aufgaben/*.md`, `localStorage` oder `sessionStorage` geschrieben; Zusehen erzeugt keinen Commit (ADR-0019 N5 Punkt 1). Belegung im Spaltenkopf, Berichte und Summen bleiben unberührt.

## Nicht-funktionale Anforderungen

- **Performance**: die Board-Ansicht lädt beim Zeichnen zusätzlich `GET /api/berichte/bewegungen?board=<slug>` (ein `git log` der Board-Datei je Ladevorgang und je Live-Ereignis, ADR-0019 N5 Konsequenzen). Die Bewegungen werden einmal je Ladevorgang geholt, nicht je Karte; kein zusätzlicher Endpunkt, kein Cache.
- **Barrierefreiheit**: der Zustand hängt nicht an der Farbe allein — der zugängliche Name nennt Alter und Spalte (FA 8). Die Kurzform ist Text.
- **Breite**: bei 320 px scrollt die Seite nicht quer (ADR-0015); die Kurzform bricht um oder nutzt den vorhandenen Kopfzeilen-Umbruch (FA 9).
- **Rückwärtskompatibel**: keine Änderung an API, Dateiformat, Commit-Texten, Berichten, Summen oder der Belegung im Spaltenkopf; das Alter erscheint in keinem Bericht.

## Akzeptanzkriterien

**Grundbestand** (über die API und Git herstellbar, Muster R00123: Board-Commits mit gesetztem Datum, `GIT_AUTHOR_DATE`): Board „fabrik“ mit „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte). Heute ist der 11.11.2026.

- #1: 01.10.2026 in „Eingang“ angelegt, 05.11.2026 nach „In Arbeit“ bewegt, seither unverändert → 6 Tage.
- #2: 01.10.2026 in „Eingang“ angelegt, 11.11.2026 nach „Fertig“ bewegt → 0 Stunden.
- #3: 01.10.2026 in „Eingang“ angelegt, seither unverändert → 41 Tage.
- #4: 01.10.2026 in „Eingang“ angelegt, 08.11.2026 vom Board genommen → kein Alter.

- [ ] **1. Sichtbar kurz, im Namen voll**: Gegeben der Grundbestand, wenn ich das Board ansehe, dann zeigt #1 sichtbar „seit 6 Tagen“ und heißt als Listeneintrag „#1 … , seit 6 Tagen in In Arbeit“; #3 zeigt „seit 41 Tagen“ und heißt „… seit 41 Tagen in Eingang“.
- [ ] **2. Der letzte Eintritt zählt**: Gegeben eine Aufgabe, die am 02.10. nach „In Arbeit“, am 03.10. nach „Fertig“ und am 04.10. zurück nach „In Arbeit“ kam (heute 11.11.), wenn ich sie ansehe, dann zeigt sie „seit 38 Tagen in In Arbeit“ — das Alter des **letzten** Eintritts (der erste, 02.10., wäre 40 Tage).
- [ ] **3. Dauertext, Grenzfälle**: Gegeben der Grundbestand, wenn ich das Board ansehe, dann zeigt #2 „seit 0 Stunden“ und der Name nennt „seit 0 Stunden in Fertig“; bei einem Eintritt von 5 Stunden steht „seit 5 Stunden“, bei 47:59:59 „seit 47 Stunden“, ab 48:00:00 „seit 2 Tagen“, bei 41 Tagen „seit 41 Tagen“.
- [ ] **4. Abschlussspalte zählt**: Gegeben der Grundbestand, wenn ich die Abschlussspalte „Fertig“ ansehe, dann trägt #2 dort ein Alter („seit 0 Stunden“) — die Abschlussspalte ist eine Spalte wie jede andere; „Fertig“ bedeutet nicht „kein Alter“.
- [ ] **5. Kein Alter ohne Eintritt (Gegenprobe)**: Gegeben #4 (vom Board genommen) und eine Aufgabe ohne jeden Spaltenwechsel, wenn ich sie ansehe, dann tragen sie weder Kurzform noch Namenszusatz, und ihr Markup ist byte-gleich wie heute; im Unit-Test liefert die Ableitung ohne Eintritt `null`.
- [ ] **6. Keine Warnung, keine Schwelle**: Gegeben #3 mit 41 Tagen, wenn ich das Board ansehe, dann hat die Anzeige von #3 dieselbe Form wie die von #2 (keine Warnfarbe, kein „alt“, kein Ausrufezeichen, kein Umbruch in eine Warnrolle), und es gibt keinen Zahlenwert, ab dem die Anzeige umschlägt.
- [ ] **7. Nur gelesen, kein zweiter Takt**: Gegeben der Grundbestand, wenn ich 60 s zusehe, dann ist `boards/fabrik.md` byte-gleich, `git log` unverändert und `kdTest.renders()` steigt nicht ohne Ereignis; eine Board-Bewegung (Live-Ereignis) zeichnet ohne Neuladen neu, und das Alter der bewegten Karte stimmt danach.
- [ ] **8. Schmales Layout**: Gegeben der Grundbestand, wenn die Fensterbreite auf 375 (und 320 bzw. 414) px gesetzt wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth`, jede Karte bleibt im Rechteck ihrer Spalte (`ka.right ≤ flaeche.right`), und der Titel bleibt mindestens 90 px breit.
- [ ] **9. Belegung und Berichte unberührt**: Gegeben der Grundbestand, wenn ich das Alter ansehe, dann ist die Belegungszahl im Spaltenkopf unverändert (Eingang 3, In Arbeit 1, Fertig 0 vor #2), und Burndown, Durchlaufzeit und Durchsatz liefern dieselben Zahlen wie ohne die Anzeige.

## Betroffene Verzeichnisstruktur

```
web/
├── berichte.js      # Eintrittszeitpunkt als Schwesterregel von spalteAm (reine Funktion)
├── kultur.js        # seitText (bestehend, ADR-0013/N1) — keine neue Dauerregel
├── kartenname.js    # Namenszusatz, jetzt als Liste (Timer + Alter)
├── ansicht.js       # Kurzform an der Karte, Aufruf von kartenName
├── app.js           # Bewegungen auch für die Ansicht board laden (heute nur berichte/*)
└── kd-app.css       # Kurzform an der Karte (Ort/Form nach UX-Vorprüfung)
e2e/
├── einheit/         # berichte.test.js (Eintritt), kultur.test.js, kartenname.test.js
└── tests/           # r00125-alter-in-der-spalte.spec.js (neu); r00089, r00114, r00115, ziele, kontrast, kultur laufen mit
```

Kein Server, kein Format, keine Migration, kein Commit.

## Technische Überlegungen

Nach ADR-0019 Nachtrag N5 (Acceptiert, Commit `ccdfe60`); keine neue Architekturentscheidung (der Transport ist kein neues Serverfeld, keine neue API-Zusage). Baustein A00009 (Oberfläche) trägt die Soll-Notiz.

### Ablauf

1. **Beim Zeichnen der Board-Ansicht** (`render()` → `vKarte`):
   - 1.1 Bewegungen des Boards liegen als `S.bew` vor (Schritt 4).
   - 1.2 Je Aufgabe den Eintrittszeitpunkt ableiten (letzter Wechsel mit der heutigen Spalte); ohne Eintritt nichts anzeigen.
   - 1.3 Alter = jetzt − Eintritt; sichtbare Kurzform aus `seitText`, Vollform „… in <Spalte>“ für `kartenName`.
2. **Name** (`kartenName`): Zusätze (Timer aus R00114, Alter aus 1.3) in fester Reihenfolge vor „ausgewählt“ einsetzen.
3. **Live** (D00005): ein Ereignis zeichnet neu wie heute; die Bewegungen werden dabei erneut geholt (Schritt 4), damit ein Zug das Alter aktualisiert.
4. **Laden** (`web/app.js`, heute `:247`): `GET /api/berichte/bewegungen?board=<slug>` künftig auch für die Ansicht `board`, nicht nur für `berichte/(verlauf|durchlauf|prognose|fieber)`.

### Grobentwurf (JS, reine Module wie heute)

- `web/berichte.js`:
  - `eintrittAm(wechsel, t)` — `zeitpunkt` („JJJJ-MM-TT HH:MM“) des letzten Wechsels mit `zeitpunkt ≤ t`, sonst `null`; Schwester von `spalteAm`. Wird am Ende ebenfalls per `Object.assign` exportiert.
- `web/kultur.js`:
  - `seitText(ms)` — bestehend (R00114); unverändert verwendet.
- `web/kartenname.js`:
  - `kartenName({ nummer, titel, klasse }, klassen, gewaehlt, zusaetze)` — vierter Parameter wird eine **Liste** von Zusätzen (Rückwärtsverträglichkeit: eine Zeichenkette gilt als deren einziges Element); Reihenfolge bleibt, leere Teile fallen samt Komma weg.
- `web/ansicht.js`:
  - `vKarte`: Kurzform zeichnen (Ort/Form nach UX-Vorprüfung); Zusatzliste aus Timer (R00114) und Alter („seit <Dauer> in <Spalte>“) an `kartenName` geben.
  - `alterText(aufgabe, spalte, jetzt)` — Kurzform + Vollform aus demselben abgeleiteten Wert (eine Rechnung, zwei Formen).

### Änderungen an bestehenden Klassen

- `web/berichte.js`: neue reine Funktion `eintrittAm` neben `spalteAm` (keine zweite Ableitung des Spalteneintritts).
- `web/kartenname.js`: vierter Parameter als Liste; die Aufrufstelle der Karte (R00114) wird angepasst; defekte/fehlende Karten bleiben ohne Zusatz.
- `web/app.js`: die Bedingung des Bewegungen-Ladens um die Ansicht `board` erweitern.
- `vKarte` (`web/ansicht.js`): ein Element mehr je Karte; sonst unverändert.
- Kein Server-Code (`src/`), kein Dateiformat, keine Migration.

### Gestaltung

Der **Ort und die Form der Kurzform** an der Karte sind offen (die Karte ist eng — sie trägt bereits Nummer, Signale, Timer-Chip, Σ, erste Teilaufgabe, Fälligkeit und Labels). Die **UX-Vorprüfung** (Karte eng, Breiten/Umbruch) entscheidet und misst: (a) wo die Kurzform steht (eigene kleine Zeile, Text neben Σ in `.r3`, oder Chip in der Kopfzeile), (b) ob die Kopfzeile bei Platznot umbricht (vorhandener Rückfall, ADR-0019 N4) und (c) ob Titel und Breiten (320/375/414, mit Timer, Σ und Labels) halten. Neutral, ohne neue Farbrolle (ADR-0011) und ohne neue Form gegen Material 3. Empfehlung nach dem Muster von R00114: **kein Artboard, Bildschirmfotos** auf den Abnahmezettel (1280/414/320 px, hell und dunkel, mit und ohne laufenden Timer); die Entscheidung trifft der product-owner.

## Tests

Nach Skill `test-pyramide`. Jede Szene der User Story wird ein Test, der eine Zustandsänderung auf dem Schirm oder in der Git-Geschichte beobachtet (Skill `test-ehrlichkeit`).

- **Unit (node --test)**: `eintrittAm` (letzter Wechsel, nicht der erste; ohne Wechsel `null`; Wechsel in der Zukunft zählt nicht) in `e2e/einheit/berichte.test.js` nach dem Muster von `spalteAm`; `seitText`-Beispiele (0 h, 5 h, 47 h, 48 h) in `e2e/einheit/kultur.test.js`; `kartenName` mit zwei Zusätzen (Timer + Alter) in `e2e/einheit/kartenname.test.js`.
- **E2E (Playwright)**: neu `e2e/tests/r00125-alter-in-der-spalte.spec.js` mit dem Grundbestand (Board mit `GIT_AUTHOR_DATE`-Commits, Muster `r00123-karten-verlauf.spec.js` und `r00114`); Breitenproben nach `ziele.spec.js`.
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #30.
- **Gegenproben (Mutanten)**: Eintritt aus dem **ersten** statt letzten Wechsel (`#2` rot), Warnfarbe ab einer Zahl (AK 6 rot), zweiter Sekundentakt für das Alter (AK 7 rot), Alter an einer Karte ohne Eintritt (AK 5 rot), Querscrollen bei 320 px (AK 8 rot).
- **Mitlaufend grün**: `r00089-gesamtzeit-auf-der-karte.spec.js`, `r00114-vergessene-timer.spec.js`, `r00115-kartentext.spec.js`, `ziele.spec.js`, `kontrast.spec.js`, `kultur.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0019 Nachtrag N5 (Acceptiert, `ccdfe60`); ADR-0021 (ableiten statt speichern), ADR-0013 (Anzeigekultur), ADR-0015/ADR-0012 (Breite und Ziele), ADR-0018/X00005 (Kartenname, R00113).
- Abhängig von (grün): I0042 Bewegungen (R00042, `GET /api/berichte/bewegungen`), I0102 Kartenname (R00113), I0103 Vergessene Timer (R00114, `seitText` und der Namenszusatz), I0104 Kartentext (R00115, `overflow-wrap`/Umbruch).
- Gestaltung: **ux-Vorprüfung** (Karte eng; Ort/Form und Breiten) und **Artboard-Entscheidung** des product-owner vor dem Bau der Oberfläche; Empfehlung nach R00114: kein Artboard, Bildschirmfotos.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockieren. Empfehlungen des planers (Entscheidungen im Bericht); richtungsweisend bleibt allein die Artboard-Frage (product-owner):

1. **Welche Spalte zählt?** Jede sichtbare Spalte, **einschließlich der Abschlussspalte**: das Alter ist die Verweildauer in der aktuellen Spalte; in „Fertig“ ist es die Zeit seit dem Abschluss (Vorbild Jira „Tage in Spalte“). Keine Spalte wird ausgenommen.
2. **Seit wann?** Seit dem **letzten** Eintritt in die heutige Spalte (`spalteAm`-Zeitpunkt), nicht seit Erstellung, Fälligkeit oder Board-Aufnahme; mehrfach bewegte Karten zeigen den letzten Eintritt (ADR-0019 N5 „Mutante“, R00124).
3. **Anzeigeform — Schwelle oder Warnfarbe?** **Keine Schwelle, keine Warnfarbe** (ADR-0019 N5 „Keine Schwelle“): gleiche Form für 0 Stunden und 41 Tage. Ein „zu alt“ ist eine PO-Frage und eine eigene Anforderung.
4. **Sekundentakt oder Neuzeichnen?** **Kein zweiter Zeitgeber**: das Alter wird beim Zeichnen entschieden und altert zwischen zwei Zeichnungen nicht fort (Tagesgenauigkeit). Ein Live-Ereignis aktualisiert es; ein Sekundentakt für das Alter entsteht nicht.
5. **Artboard?** Empfehlung wie R00114: **kein Artboard, Bildschirmfotos** auf den Abnahmezettel. Entscheidung beim product-owner, sobald die UX-Vorprüfung Ort und Form festlegt.

## Manuelle Vorbereitungstätigkeiten

Bildschirmfotos für den Abnahmezettel (nach der UX-Vorprüfung): Board mit Karten verschiedenen Alters und einer Karte ohne Alter bei 1280, 414 und 320 px; zusätzlich mit laufendem Timer auf derselben Karte; je hell und dunkel.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist eine Lücke, die die Oberfläche verschweigt: Das Board zeigt den Stand, aber nicht, wie lange eine Karte darin liegt — ein seit Tagen hängender Vorgang sieht aus wie eine frische Karte. Weil „Alter in der Spalte“ keine Eigenschaft der Karte ist, sondern eine Aussage über Zeit und Blick, gehört die Entscheidung in die Anzeige: eine reine Ableitung rechnet den Eintritt beim Zeichnen aus vorhandenen Bewegungen, der Kultur-Baustein formt die Dauer, der Kartenname trägt die volle Aussage. Dadurch entsteht kein Bestandsfeld und kein Schreibweg (das wäre ADR-0019 Option B, ein Betrachter erzeugte Commits), und kein neues Serverfeld (Option C, eine zweite Uhr mit eigener Schwelle). Der Hebel ist genau diese Stelle und nicht eine vorgelagerte: die Daten liegen schon in der Git-Geschichte (R00042, ADR-0021), der Ort ist die Karte, an der der Mensch ohnehin liest; ein Bericht wäre weiter weg und würde die tägliche Arbeit nicht entlasten. Die Wirkungskette: vorhandene Bewegungen → abgeleiteter Spalteneintritt → kurzer Satz an der Karte und volle Aussage im Namen → der Mensch erkennt auf einen Blick, wo Arbeit liegen bleibt, und handelt dort, statt Zahlen zu suchen.

## Missing-Docs
- Das Glossar hat keinen Eintrag für „Alter in der Spalte“ (Spalteneintritt, Dauertext, Neutralität). Vorschlag: nach dem Bau ein Eintrag mit `eintrittAm`/`spalteAm` und der Beziehung zu R00124 (Datums-Trenner) und R00114 (vergessene Timer).
- `A00009` (Oberfläche) beschreibt die Karteninhalte (Timer-Chip, Σ, Labels) heute nur grob; nach dem Bau nennt der Entwickler dort die neue Zeile/Chip und ihre Reihenfolge im Kartenname.

## Notizen

**Eigene Interaction unter D0002.** Das Board trägt die Karte; die Anzeige hängt am Karteninhalt. Muster: I0077/R00089 (Gesamtzeit auf der Karte, unter D0002) und I0103/R00114 (vergessene Timer, unter D0002). Verwandt, aber eigenes Thema: I0114/R00124 (Datums-Trenner, ebenfalls aus ADR-0019 N5) — dort liegt die Aussage zwischen den Karten einer Spalte, hier am einzelnen Kartenkopf.

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — Eintritt aus dem letzten Wechsel in die heutige Spalte, Kurzform sichtbar, Vollform im Namen** (gewählt): zeigt die Verweildauer direkt aus den vorhandenen Bewegungen; deckt sich mit `spalteAm` und `seitText`.
- **B — Erstellungs- oder Fälligkeitstag der Karte**: zeigt nicht, wann sie in **diese** Spalte kam, und braucht ein anderes Datum; verworfen.
- **C — Bestandsfeld am Board-Zeilen-Eintrag (Spalteneintritt speichern)**: öffnet für eine Anzeigefrage einen Schreibweg (ein Betrachter erzeugte Commits), widerspricht ADR-0019 Option A/N5; verworfen.

**Verwiesenes**
- Karte #30 „Alter einer Karte in ihrer Spalte auf der Karte zeigen“ (Herkunft: Beratung product-owner 2026-11-03; Referenz Jira „Tage in Spalte“, Kanbanize, GitHub Projects; Priorität mittel).
- ADR-0019 Nachtrag N5 (Commit `ccdfe60`): Alter = Aussage der Anzeige; Browser leitet aus `GET /api/berichte/bewegungen` ab (`spalteAm`, `seitText`); kein Bestand, kein neuer Endpunkt, keine Schwelle.
