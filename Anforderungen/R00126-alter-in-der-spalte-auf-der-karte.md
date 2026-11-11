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

7. Das Alter steht **sichtbar** an der Karte als Kurzform (FA 5) — neutral, ohne Warnfarbe, ohne Symbol, das „alt“ bedeutet, ohne Schwelle. **Ort und Form sind mit der UX-Vorprüfung #30 (2026-11-11) festgelegt:** Die Kurzform ist ein eigener **nackter Text** in der untersten Kartenzeile `.r3`, innerhalb von `.r3 .rechts`, **direkt nach der Zeitsumme Σ und vor dem Teilaufgaben-Zähler ☑**. Ihre Form gleicht `.sum`/`.preis` (Muster D0002 „Preisetikett“): 11 px IBM Plex Mono, Farbe `--kd-muted`, ohne Rahmen, ohne Grund, ohne Symbol, `white-space:nowrap`, kein `tabindex`, keine Rolle (kein Bedienelement, ADR-0012 gilt nicht). Ein **Chip** oder ein Platz in der **Kopfzeile** (`.r0`) ist ausgeschlossen — er kollidierte mit Laufchip und Signalen. Sichtbarer Text ist `seitText(Dauer)` wörtlich (FA 5, „seit 6 Tagen“); auf einer Karte mit eigener Klassenfarbe (`data-eigen`) trägt der Text `--kd-text` wie das Preisetikett (NFA Barrierefreiheit).
8. Der zugängliche Name des Listeneintrags trägt die Vollform, gestellt vor „ausgewählt“ und **nach** einem etwaigen Timer-Zusatz (R00114): „#<nr> <Titel>[, <Klasse>][, Timer läuft seit …][, seit <Dauer> in <Spalte>][, ausgewählt]“; fehlende Teile fallen samt Komma weg. Beide Zusätze können nebeneinander stehen. Die **sichtbare** Kurzform trägt `aria-hidden="true"` und **keinen** `.vh`-Doppeltext (Muster `.due`/`.preis`); die Dauer wird so genau einmal vorgelesen — die Vollform steht allein im Namen des `listitem`.
9. Auf schmalen Breiten (320, 375, 414 px) scrollt die Seite nicht quer, die Karte bleibt im Rechteck ihrer Spalte, und der Titel bleibt lesbar (mindestens 90 px, Rückfall-Vorgabe aus R00114/R00115) — geprüft an einer Karte, die **zugleich Laufchip, Σ, Fälligkeit, Preisetikett und Labels** trägt (AK 8). Reicht der Platz in der untersten Zeile nicht, bricht sie um wie die Preisetikett-Anordnung (D0002 „Preisetikett“, `_wireframes.md` 2026-11-06: `.r3 .rechts` mit `flex-wrap` bei 375 und 320 px) — es entsteht keine neue Form. Der Kopfzeilen-Umbruch (ADR-0019 N4) ist mit dem Ort `.r3` für das Alter nicht der tragende Rückfall.

### Grenzen (ADR-0019 N5)

10. Eine Karte ohne Eintritt (FA 2) trägt weder Kurzform noch Namenszusatz; ihr Markup ist wie heute.
11. **Kein zweiter Zeitgeber**: das Alter wird beim Zeichnen entschieden und altert zwischen zwei Zeichnungen nicht fort (Tagesgenauigkeit genügt). Ein Live-Ereignis (D00005) zeichnet wie heute neu; ein Sekundentakt entsteht für das Alter nicht.
12. **Nur gelesen**: nichts wird in `boards/*.md`, `aufgaben/*.md`, `localStorage` oder `sessionStorage` geschrieben; Zusehen erzeugt keinen Commit (ADR-0019 N5 Punkt 1). Belegung im Spaltenkopf, Berichte und Summen bleiben unberührt.

## Nicht-funktionale Anforderungen

- **Performance**: die Board-Ansicht lädt beim Zeichnen zusätzlich `GET /api/berichte/bewegungen?board=<slug>` (ein `git log` der Board-Datei je Ladevorgang und je Live-Ereignis, ADR-0019 N5 Konsequenzen). Die Bewegungen werden einmal je Ladevorgang geholt, nicht je Karte; kein zusätzlicher Endpunkt, kein Cache.
- **Barrierefreiheit**: der Zustand hängt nicht an der Farbe allein — der zugängliche Name nennt Alter und Spalte (FA 8), die sichtbare Kurzform ist Text und `aria-hidden`. Der Text hält in beiden Themen **mindestens 4,5:1** auf jedem Kartengrund (WCAG 1.4.3, ADR-0011); auf einer Karte mit eigener Klassenfarbe trägt die Kurzform `--kd-text` wie das Preisetikett (`.ka[data-eigen] .seit{color:var(--kd-text)}`), weil `--kd-muted` auf hellen eigenen Farben unter 4,5:1 fällt; die `kontrast.spec` misst hell und dunkel.
- **Breite**: bei 320 px scrollt die Seite nicht quer (ADR-0015); reicht der Platz nicht, bricht die unterste Zeile um wie die Preisetikett-Anordnung (FA 9).
- **Rückwärtskompatibel**: keine Änderung an API, Dateiformat, Commit-Texten, Berichten, Summen oder der Belegung im Spaltenkopf; das Alter erscheint in keinem Bericht.

## Akzeptanzkriterien

**Grundbestand** (über die API und Git herstellbar, Muster R00123: Board-Commits mit gesetztem Datum, `GIT_AUTHOR_DATE`): Board „fabrik“ mit „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte). Heute ist der 11.11.2026.

- #1: 01.10.2026 in „Eingang“ angelegt, 05.11.2026 nach „In Arbeit“ bewegt, seither unverändert → 6 Tage.
- #2: 01.10.2026 in „Eingang“ angelegt, 11.11.2026 nach „Fertig“ bewegt → 0 Stunden.
- #3: 01.10.2026 in „Eingang“ angelegt, seither unverändert → 41 Tage.
- #4: 01.10.2026 in „Eingang“ angelegt, 08.11.2026 vom Board genommen → kein Alter.

- [ ] **1. Sichtbar kurz, im Namen voll, an festem Ort**: Gegeben der Grundbestand, wenn ich das Board ansehe, dann zeigt #1 sichtbar „seit 6 Tagen“ und heißt als Listeneintrag „#1 … , seit 6 Tagen in In Arbeit“; #3 zeigt „seit 41 Tagen“ und heißt „… seit 41 Tagen in Eingang“. Die sichtbare Kurzform ist ein Element in `.r3 .rechts` **hinter** `.sum` und vor `☑`, in der Form von `.sum`/`.preis` (11 px, Plex Mono, `--kd-muted`, kein Rahmen, kein Grund, kein `tabindex`, keine Rolle), ihr Text ist `seitText(Dauer)` wörtlich, sie trägt `aria-hidden="true"` ohne `.vh`-Doppeltext, und der Listeneintrag nennt „seit … in <Spalte>“ genau einmal.
- [ ] **2. Der letzte Eintritt zählt**: Gegeben eine Aufgabe, die am 02.10. nach „In Arbeit“, am 03.10. nach „Fertig“ und am 04.10. zurück nach „In Arbeit“ kam (heute 11.11.), wenn ich sie ansehe, dann zeigt sie „seit 38 Tagen in In Arbeit“ — das Alter des **letzten** Eintritts (der erste, 02.10., wäre 40 Tage).
- [ ] **3. Dauertext, Grenzfälle**: Gegeben der Grundbestand, wenn ich das Board ansehe, dann zeigt #2 „seit 0 Stunden“ und der Name nennt „seit 0 Stunden in Fertig“; bei einem Eintritt von 5 Stunden steht „seit 5 Stunden“, bei 47:59:59 „seit 47 Stunden“, ab 48:00:00 „seit 2 Tagen“, bei 41 Tagen „seit 41 Tagen“.
- [ ] **4. Abschlussspalte zählt**: Gegeben der Grundbestand, wenn ich die Abschlussspalte „Fertig“ ansehe, dann trägt #2 dort ein Alter („seit 0 Stunden“) — die Abschlussspalte ist eine Spalte wie jede andere; „Fertig“ bedeutet nicht „kein Alter“.
- [ ] **5. Kein Alter ohne Eintritt (Gegenprobe)**: Gegeben #4 (vom Board genommen) und eine Aufgabe ohne jeden Spaltenwechsel, wenn ich sie ansehe, dann tragen sie weder Kurzform noch Namenszusatz, und ihr Markup ist byte-gleich wie heute; im Unit-Test liefert die Ableitung ohne Eintritt `null`.
- [ ] **6. Keine Warnung, keine Schwelle**: Gegeben #3 mit 41 Tagen, wenn ich das Board ansehe, dann hat die Anzeige von #3 dieselbe Form wie die von #2 (keine Warnfarbe, kein „alt“, kein Ausrufezeichen, kein Umbruch in eine Warnrolle), und es gibt keinen Zahlenwert, ab dem die Anzeige umschlägt.
- [ ] **7. Nur gelesen, kein zweiter Takt**: Gegeben der Grundbestand, wenn ich 60 s zusehe, dann ist `boards/fabrik.md` byte-gleich, `git log` unverändert und `kdTest.renders()` steigt nicht ohne Ereignis; eine Board-Bewegung (Live-Ereignis) zeichnet ohne Neuladen neu, und das Alter der bewegten Karte stimmt danach.
- [ ] **8. Schmales Layout (volle unterste Zeile)**: Gegeben der Grundbestand und eine Karte, die **zugleich Laufchip, Σ, Fälligkeit, Preisetikett und Labels** trägt, wenn die Fensterbreite auf 375 (und 320 bzw. 414) px gesetzt wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth`, jede Karte bleibt im Rechteck ihrer Spalte (`ka.right ≤ flaeche.right`), die Kurzform liegt in `.r3 .rechts` hinter `.sum`, und der Titel bleibt mindestens 90 px breit — hell und dunkel.
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
└── tests/           # r00126-alter-in-der-spalte.spec.js (neu); r00089, r00114, r00115, ziele, kontrast, kultur laufen mit
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

**Ort und Form sind mit der UX-Vorprüfung #30 (2026-11-11) festgelegt** (FA 7): Die Kurzform steht als nackter Text in `.r3 .rechts` direkt nach Σ, in der Form von `.sum`/`.preis` (Plex Mono 11 px, `--kd-muted`, ohne Rahmen/Grund/Symbol) — damit wendet sie die gezeichnete Preisetikett-Anordnung an, es entsteht nichts Neues. Die Prüfung misst die **volle unterste Zeile** (Laufchip, Σ, Fälligkeit, Preisetikett und Labels zugleich) bei 320/375/414 px, hell und dunkel; die Kurzform bleibt neutral, ohne neue Farbrolle (ADR-0011) und ohne neue Form gegen Material 3.

**Zweimal „seit 6 Tagen“ ist geduldet**: Trägt eine Karte einen vergessenen Timer (Chip „seit 6 Tagen“ oben rechts) und zugleich ein Alter, stehen beide Dauer-Aussagen auf dem Schirm; die Form unterscheidet sie (Chip mit Punkt und Farbfläche in der Kopfzeile, nackter Text in `.r3`). Eine schärfere Unterscheidung (eigenes Wort oder Zeichen) ist eine Richtungsfrage und keine Vorgabe dieser Anforderung.

**Artboard: keins — Bildschirmfotos** auf den Abnahmezettel (Muster R00114, PO `po-entscheidungen.md` Z. 153 Fall (b), Z. 184): Die Kurzform wendet die freigegebene Preisetikett-Anordnung an (kein neues Element, keine neue Lage), deshalb genügen Fotos bei 1280/414/320 px, hell und dunkel, mit Karten verschiedenen Alters, mit laufendem und mit vergessenem Timer, mit voller unterster Zeile und mit eigener Klassenfarbe. Ein Artboard-Zustand an D0002 wäre nur nötig, wünschte der PO statt Text einen **Chip** oder eine eigene Stelle in der **Kopfzeile**; beides schließt FA 7 aus.

## Tests

Nach Skill `test-pyramide`. Jede Szene der User Story wird ein Test, der eine Zustandsänderung auf dem Schirm oder in der Git-Geschichte beobachtet (Skill `test-ehrlichkeit`).

- **Unit (node --test)**: `eintrittAm` (letzter Wechsel, nicht der erste; ohne Wechsel `null`; Wechsel in der Zukunft zählt nicht) in `e2e/einheit/berichte.test.js` nach dem Muster von `spalteAm`; `seitText`-Beispiele (0 h, 5 h, 47 h, 48 h) in `e2e/einheit/kultur.test.js`; `kartenName` mit zwei Zusätzen (Timer + Alter) in `e2e/einheit/kartenname.test.js`.
- **E2E (Playwright)**: neu `e2e/tests/r00126-alter-in-der-spalte.spec.js` mit dem Grundbestand (Board mit `GIT_AUTHOR_DATE`-Commits, Muster `r00123-karten-verlauf.spec.js` und `r00114`); Breitenproben nach `ziele.spec.js` an einer Karte mit **voller unterster Zeile** (Laufchip, Σ, Fälligkeit, Preisetikett und Labels zugleich), 320/375/414 px, hell und dunkel (UX-Vorprüfung #30, M2).
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #30.
- **Gegenproben (Mutanten)**: Eintritt aus dem **ersten** statt letzten Wechsel (`#2` rot), Warnfarbe ab einer Zahl (AK 6 rot), zweiter Sekundentakt für das Alter (AK 7 rot), Alter an einer Karte ohne Eintritt (AK 5 rot), Querscrollen bei 320 px (AK 8 rot).
- **Mitlaufend grün**: `r00089-gesamtzeit-auf-der-karte.spec.js`, `r00114-vergessene-timer.spec.js`, `r00115-kartentext.spec.js`, `ziele.spec.js`, `kontrast.spec.js`, `kultur.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0019 Nachtrag N5 (Acceptiert, `ccdfe60`); ADR-0021 (ableiten statt speichern), ADR-0013 (Anzeigekultur), ADR-0015/ADR-0012 (Breite und Ziele), ADR-0018/X00005 (Kartenname, R00113).
- Abhängig von (grün): I0042 Bewegungen (R00042, `GET /api/berichte/bewegungen`), I0102 Kartenname (R00113), I0103 Vergessene Timer (R00114, `seitText` und der Namenszusatz), I0104 Kartentext (R00115, `overflow-wrap`/Umbruch).
- Gestaltung: **ux-Vorprüfung #30** (2026-11-11) eingearbeitet — Ort/Form festgelegt (FA 7); **kein Artboard**, Bildschirmfotos auf den Abnahmezettel (Muster R00114, PO `po-entscheidungen.md` Z. 153 Fall (b)); eine PO-Freigabe wäre nur bei Chip oder eigener Kopfzeilen-Stelle nötig und entfällt mit FA 7.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockieren. Empfehlungen des planers (Entscheidungen im Bericht); richtungsweisend bleibt die Artboard-Bestätigung des product-owner (Punkt 5; Empfehlung: kein Artboard):

1. **Welche Spalte zählt?** Jede sichtbare Spalte, **einschließlich der Abschlussspalte**: das Alter ist die Verweildauer in der aktuellen Spalte; in „Fertig“ ist es die Zeit seit dem Abschluss (Vorbild Jira „Tage in Spalte“). Keine Spalte wird ausgenommen.
2. **Seit wann?** Seit dem **letzten** Eintritt in die heutige Spalte (`spalteAm`-Zeitpunkt), nicht seit Erstellung, Fälligkeit oder Board-Aufnahme; mehrfach bewegte Karten zeigen den letzten Eintritt (ADR-0019 N5 „Mutante“, R00124).
3. **Anzeigeform — Schwelle oder Warnfarbe?** **Keine Schwelle, keine Warnfarbe** (ADR-0019 N5 „Keine Schwelle“): gleiche Form für 0 Stunden und 41 Tage. Ein „zu alt“ ist eine PO-Frage und eine eigene Anforderung.
4. **Sekundentakt oder Neuzeichnen?** **Kein zweiter Zeitgeber**: das Alter wird beim Zeichnen entschieden und altert zwischen zwei Zeichnungen nicht fort (Tagesgenauigkeit). Ein Live-Ereignis aktualisiert es; ein Sekundentakt für das Alter entsteht nicht.
5. **Artboard?** Mit der UX-Vorprüfung #30 entschieden: **kein Artboard, Bildschirmfotos** auf den Abnahmezettel (Muster R00114) — die Kurzform wendet die freigegebene Preisetikett-Anordnung an (PO `po-entscheidungen.md` Z. 153 Fall (b)). Eine Artboard-Freigabe wäre nur nötig, wünschte der PO einen **Chip** oder eine eigene Kopfzeilen-Stelle statt des Textes in `.r3`; beides schließt FA 7 aus. Der PO bestätigt die Form mit den Fotos (oder verlangt das Artboard).

## Manuelle Vorbereitungstätigkeiten

Bildschirmfotos für den Abnahmezettel (nach der UX-Vorprüfung #30): Board mit Karten verschiedenen Alters und einer Karte ohne Alter bei 1280, 414 und 320 px; zusätzlich eine Karte mit **laufendem** und eine mit **vergessenem** Timer, eine Karte mit **voller unterster Zeile** (Laufchip, Σ, Fälligkeit, Preisetikett, Labels zugleich) und eine mit **eigener Klassenfarbe**; je hell und dunkel.

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
