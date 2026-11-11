---
id: R00140
status: Neu
datum: 2026-11-11
---

# R00140: Aufgaben, Personen, WBS und Einrichten in das Menü „Mehr“ aus der Hauptnavigation

## Beschreibung

Die Hauptnavigation führt heute sechs Ziele gleichberechtigt (Board, Aufgaben, Personen, Berichte, WBS, Einrichten). Vier davon — **Aufgaben, Personen, WBS und Einrichten** — werden am Board nur selten gebraucht, belegen aber bei jeder Breite Platz, der dem Filtern fehlt. Nach dieser Anforderung trägt die Leiste nur noch die zwei häufigen Ziele **Board** und **Berichte ▾**; die vier seltenen wandern in das Menü „…“ (Mehr), das schon „Darstellung“ trägt und bei jeder Breite vorhanden ist. Das Menü „…“ bleibt damit der eine Ort für alles, was nicht zum täglichen Filtern und Kartenziehen gehört (Karte #105, Betreiber; Architektur bestanden 2026-11-11: keine Technikfrage, Navigation umordnen).

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Ein eigenes Design, früh vom Menschen gesehen. Es ist per Tastatur bedienbar und folgt gewohnten Konventionen.“

**Nicht Teil:** ein neues Tastenkürzel für die vier Ziele, eine Suchfunktion im Menü, das Ändern der Filterlogik oder des Filterfelds, das Zusammenfassen der acht Berichte, das Verschieben von „Neue Aufgabe“ oder des Bereichsfilters ins Menü (beide bleiben ohne Menü bedienbar, R00101), eine Navigation Bar unten (compact-Ziel, R00101 Notizen), der Ausbau der Menüköpfe in `role=menu` (eigene Karte #109/R00136).

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — unter 640 px ersetzt der Seitenknopf die Leiste

## Geschäftlicher Nutzen

Der Auslöser ist eine Beobachtung des Betreibers: Aufgaben, Personen, WBS und Einrichten stehen auf jeder Breite gleichberechtigt neben Board und Berichten, obwohl sie am Board selten gebraucht werden. Jedes Ziel in der Leiste nimmt Breite weg, die dem Filterfeld und „Neue Aufgabe“ fehlen — den beiden Dingen, die ständig gebraucht werden. Werden die vier seltenen Ziele in das ohnehin vorhandene Menü „…“ gelegt, ist die Leiste kürzer, der Filter hat mehr Platz, und die zwei häufigen Ziele bleiben einen Klick entfernt. Kein Ziel verschwindet: alle sechs bleiben auf jeder Breite erreichbar, die vier über das Menü.

## Funktionale Anforderungen

### Die Leiste trägt zwei Ziele

1. Die Navigationsleiste `nav.kz-nav` (ab 600 px) trägt genau zwei Ziele: **Board** und **Berichte ▾**. Aufgaben, Personen, WBS und Einrichten stehen dort nicht mehr.
2. Unter 600 px trägt das Seitenmenü (Seitenknopf „Seite: …“ → Menü „Seite“) dieselben zwei Ziele. Die vier stehen dort nicht.
3. Der Auslöser „Berichte ▾“ und sein Untermenü bleiben unverändert (R00100, acht Berichte).

### Die vier Ziele liegen im Menü „…“

4. Das Menü „…“ (`#t-mehr`, `role=menu`) ist bei **jeder** Breite vorhanden (heute schon, R00101) und trägt zusätzlich die vier Ziele in dieser Reihenfolge: **Aufgaben, Personen, WBS, Einrichten**. Die heutigen Einträge („Signale oben“, „Spalten einrichten“, „Darstellung“, „Läuft gerade“, „Ich bin …“) bleiben erhalten.
5. Der WBS-Eintrag erscheint je gebundener Anwendung (wie heute in der Leiste, `vWbsMenue`): ohne gebundene Anwendung kein Eintrag, bei mehreren je Anwendung mit Kürzel („WBS · kc“, „WBS · kd“).
6. Jeder Eintrag führt zur selben Ansicht wie heute der Leistenlink (`#/aufgaben`, `#/personen`, `#/wbs/<kürzel>`, `#/einrichten`); er schließt das Menü und zeigt die Zielansicht.
7. Die Reihenfolge und Gruppierung innerhalb des Menü „…“ (die vier Ziele zuerst, dann die Werkzeuge; mit oder ohne Abschnittskopf) legt die UX-Vorprüfung fest.

### Die aktuelle Seite bleibt erkennbar

8. Die aktuelle Ansicht ist in der Kopfzeile weiterhin als aktuell markiert: Wo der Eintrag heute in der Leiste lag und jetzt im Menü „…“ liegt, trägt sein Eintrag die Klasse `an` **und** `aria-current="page"` — gesetzt unter derselben Bedingung wie bisher (derselbe Helfer `aktuelleSeite`, ADR-0018 Regel 5, geweitet: „der Eintrag mit `an` trägt `aria-current`, in der Leiste oder im Menü“).
9. Die Regel gilt für die drei Stellen, die heute `an`/`aria-current` setzen: `vNavigation` (Leiste: Board, Berichte), `vSeitenPop` (compact: Board, Berichte) und der neue Eintrag im Menü „…“ (die vier Ziele).
10. Der Seitenknopf unter 600 px nennt weiterhin die aktuelle Seite („Seite: Aufgaben“), unverändert.
11. Ob der Auslöser „…“ selbst die aktuelle Sekundärseite sichtbar kennzeichnet (Punkt, Unterstrich oder nichts), entscheidet die UX-Vorprüfung; mindestens aber trägt der Menüeintrag `aria-current`.

### Das Menü bleibt bedienbar

12. Das Menü „…“ folgt weiter dem Muster von R00106: `role=menu`, `aria-haspopup="menu"` und `aria-expanded` am Auslöser, Öffnen per Klick/Enter/Leertaste, Pfeile durch die Einträge, Esc schließt und gibt den Fokus an `#t-mehr` zurück, die Einträge sind `menuitem`.

## Nicht-funktionale Anforderungen

- **Barrierefreiheit:** In der Kopfzeile trägt höchstens **ein** Bedienelement `aria-current="page"` — der Eintrag mit `an`, welcher der sechs Ansichten auch gewählt ist. Auf Berichtsrouten bleibt es der Auslöser `#t-ber`.
- **Breite:** Nach der Kürzung überlappt bei 375, 414, 600, 768, 900, 1024, 1100, 1280, 1366 und 1440 px kein Kopfzeilen-Bedienelement ein anderes und nichts ist abgeschnitten (Probe R00101 bleibt grün). Bei 320/375/414 px scrollt nichts quer (ADR-0015). Das geöffnete Menü „…“ liegt bei 375 px ganz im Fenster.
- **Platz:** Der in der Leiste frei werdende Platz kommt dem Filtern zugute: Bei 1280 px ist das Filterfeld bzw. die ganze Werkzeugzeile nicht schmaler als vor der Änderung und bricht nicht um.
- **Rückwärtsverträglich:** Kein Server-Code, kein Dateiformat, kein Endpunkt, keine Migration. Es ändern sich nur die Kopfzeile und ihre Proben.

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar, Muster `e2e/tests/r00101-kopfzeile.spec.js`): laufende Instanz mit dem Board „entwicklung“, an die Anwendung `kd` gebunden (WBS-Eintrag vorhanden), Ich „EM“ gewählt, drei Spalten, eine Aufgabe #1. Heute ist der 11.11.2026.

- [ ] **1. Leiste trägt zwei Ziele (Abnahme, wörtlich):** Gegeben bei 1280 px, wenn ich die Kopfzeile ansehe, dann enthält `nav.kz-nav` genau die Ziele „Board“ und „Berichte“; die Namen „Aufgaben“, „Personen“, „WBS“ und „Einrichten“ kommen in der Leiste nicht vor; das Menü „…“ enthält sie; ein Klick auf „Aufgaben“ im Menü zeigt die Aufgabenliste.
  - Fällt durch: „Aufgaben“ noch in der Leiste; ein Ziel fehlt im Menü; der Klick öffnet nichts.
  - Prüfebene: E2E US-1, US-4.
- [ ] **2. Schmale Breite:** Gegeben bei 375 (und 560) px, wenn ich die Kopfzeile ansehe, dann gibt es keine `navigation`, der Seitenknopf heißt „Seite: Board“, sein Menü trägt genau „Board“ und „Berichte“, und ein Klick auf „Personen“ im Menü „…“ zeigt die Personenübersicht.
  - Fällt durch: die vier Ziele im Seitenmenü; „Personen“ nicht auffindbar.
  - Prüfebene: E2E US-2.
- [ ] **3. Das Menü „…“ gibt es bei jeder Breite:** Gegeben bei 375, 560, 900, 1280 und 1440 px, wenn ich die Kopfzeile ansehe, dann ist `#t-mehr` sichtbar und öffnet ein Menü `role=menu`, das die vier Ziele trägt.
  - Prüfebene: E2E US-3.
- [ ] **4. Aktuelle Seite breit:** Gegeben bei 1280 px auf je einer Route der sechs Ansichten (Board, Aufgaben, Personen, Berichte, WBS, Einrichten), wenn ich die Kopfzeile ansehe, dann trägt genau **ein** Bedienelement `aria-current="page"`: auf dem Board der Leistenlink „Board“, auf Berichtsrouten `#t-ber`, auf den vier übrigen der Eintrag im Menü „…“.
  - Gegenprobe M1: Kennzeichnet eine Mutante zusätzlich „Aufgaben“, wird die Probe auf dem Board rot.
  - Prüfebene: E2E US-3, US-5; geweitete R00113-Probe.
- [ ] **5. Aktuelle Seite schmal:** Gegeben bei 560 px in der Aufgabenliste, wenn ich den Seitenknopf ansehe, dann heißt er „Seite: Aufgaben“, es gibt keine `navigation`, und im Menü „…“ trägt genau der Eintrag „Aufgaben“ `an` und `aria-current="page"`.
  - Prüfebene: E2E US-5; US-10 der R00113 in geweiteter Form.
- [ ] **6. Werkzeuge bleiben:** Gegeben bei 1280 px, wenn ich das Menü „…“ öffne, dann stehen darin die vier Ziele **und** „Signale oben“, „Spalten einrichten“, „Darstellung“, „Läuft gerade“ (bei laufendem Timer) und „Ich bin …“; „Neue Aufgabe“ und der Bereichsfilter stehen weiterhin ohne Menü in der Kopfzeile.
  - Prüfebene: E2E US-4.
- [ ] **7. Kein Ziel geht verloren:** Gegeben jede Breite aus AK 3, wenn ich vom Board aus jedes der sechs Ziele erreiche, dann gelingt das über die Leiste bzw. das Menü „…“ in höchstens zwei Klicks, und es ist in der Kopfzeile mindestens einmal vorhanden.
  - Prüfebene: E2E US-6.
- [ ] **8. Breite und Platz:** Gegeben die zehn Breiten aus NFA, wenn ich die Kopfzeile vermesse, dann schneiden sich keine zwei Kopfzeilen-Bedienelemente, nichts ist abgeschnitten und die Kopfzeile scrollt nicht waagerecht; bei 1280 px ist die Werkzeugzeile (Filter, Bereich, „Neue Aufgabe“) nicht schmaler als vor der Änderung.
  - Prüfebene: E2E US-6; Probe R00101 (kopfzeile-hilfen) bleibt grün.
- [ ] **9. Geweitete Probe und Mutanten:** Die R00113-Probe prüft nicht mehr „genau ein `nav a[aria-current]`, sondern „genau ein Bedienelement mit `an` in der Kopfzeile trägt `aria-current=page`“ (Menü „…“ geöffnet, wenn die aktive Seite dort liegt), auf allen 13 Routen und in den drei Zuständen; gegen die Mutanten M1 (aria-current am Menüeintrag entfernt) und M2 (zweiter Eintrag zusätzlich markiert) wird sie rot.
  - Prüfebene: E2E US-5; `e2e/tests/r00113-struktur.spec.js` (geweitet).
- [ ] **10. Nichts sonst geändert:** Server, Dateiformat und API unverändert; `cargo test`, `node --test e2e/einheit/` und `npx playwright test` sind grün, mit den nachgezogenen Kopfzeilen-Proben (NFA „Rückwärtsverträglich“) als einziger Teständerung.
  - Prüfebene: gesamte Suite.

## Betroffene Verzeichnisstruktur

```
web/
├── ansicht.js        # vKopf (kopfElemente: mehr), vNavigation, vSeitenKnopf, vSeitenPop,
│                     # vMehrPop, vWbsMenue — die Leiste auf zwei Ziele kürzen, die vier ins „…“-Menü
├── seitenname.js     # unverändert (Seitenknopf-Namen)
└── kd-app.css        # Kopfzeilen-Regeln (Breite/Platz) — nur nachziehen, was die Kürzung freigibt
e2e/
├── tests/
│   ├── r00140-navigation.spec.js     # neu: AK 1–8 (Leiste, Seitenmenü, Menü „…“, jede Breite)
│   ├── r00113-struktur.spec.js       # geweitet: „Eintrag mit an trägt aria-current“ (AK 9)
│   ├── r00101-kopfzeile.spec.js      # compact-Menü-Aufzählung (AK 2), Menü „Mehr“-Einträge
│   ├── r00054-wbs-sicht.spec.js      # WBS-Link jetzt im Menü „…“
│   ├── r00062-bindung.spec.js        # WBS-/Board-Link im Menü „…“
│   └── r00077-responsive.spec.js     # Seitenknopf (compact)
└── (kein Server, kein Format, keine Migration)
```

## Technische Überlegungen

Nach dem Architektur-Durchgang vom 2026-11-11 (bestanden): keine Technikfrage, kein ADR. Baustein A00009 (Oberfläche), Aspekt [X00005 Struktur für Hilfstechnik](../Dokumentation/Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md). Betroffen ist ADR-0018 Regel 5, die geweitet wird (der Eintrag mit `an`, nicht nur `nav a`).

### Ablauf (Vorplanung, den Zuschnitt entscheidet der Entwickler)

1. **Leiste kürzen** (`vNavigation`, `web/ansicht.js:81`): nur noch `aktuelleSeite(u.view === 'board')` (Board) und `aktuelleSeite(u.view.startsWith('berichte'))` (`#t-ber`); Aufgaben, Personen `vWbsMenue` und Einrichten entfallen.
2. **Seitenmenü kürzen** (`vSeitenPop`, `:96–110`): dieselben zwei Ziele; die vier `ziel(…)`-Aufrufe und der WBS-Block entfallen.
3. **Menü „…“ erweitern** (`vMehrPop`, `:127–138`): die vier Ziele als `menuitem`-Links mit den heutigen Hash-Zielen, vor den heutigen Einträgen (Reihenfolge nach UX-Vorprüfung). Jeder Eintrag trägt `an` + `aria-current` über `aktuelleSeite(…)`, wenn seine Ansicht die aktuelle ist.
4. **Proben** (Schritt 5): neue Probe `r00140`, geweitete `r00113`, nachgezogene Kopfzeilen-Proben.

### Grobentwurf (JS, reine Module und Renderer wie heute)

- `web/ansicht.js`:
  - `vNavigation()` — Leiste auf Board + `#t-ber`.
  - `vSeitenPop()` — Seitenmenü auf Board + Berichte.
  - `vMehrPop()` — ein Eintragsblock `ziel` (Aufgaben, Personen, WBS, Einrichten) über den vorhandenen Helfer `aktuelleSeite`; WBS je gebundener Anwendung über `vWbsMenue` oder einen gleichartigen Block.
  - kein neuer Zustand: es gibt keine „Navigation eingeklappt“-Flagge; die Zusammensetzung ist statisch.

### Änderungen an bestehenden Klassen

- `web/ansicht.js`: `vNavigation`, `vSeitenPop`, `vMehrPop`; `vWbsMenue` liefert nicht mehr die Leiste, sondern den Menüblock (oder eine Schwesterfunktion für das Menü).
- `web/kd-app.css`: nur, falls die kürzere Leiste eine Breitenregel freigibt (Filterfeld/Werkzeugzeile); keine neue Form.
- Kein Server-Code (`src/`), kein Dateiformat, keine Migration.

### Optionen (Skill `optionen-vor-entscheidung`)

| | A: Leiste Board + Berichte, die vier ins „…“-Menü (gewählt) | B: alle sechs Ziele ins „…“-Menü, keine Leiste | C: Leiste bleibt, Schalter „weniger anzeigen“ |
|---|---|---|---|
| Platz gewonnen | ja (vier Ziele weg) | am meisten | nur wenn benutzt |
| Häufige Ziele | Board/Berichte ein Klick | Board/Berichte zwei Klicks | ein Klick |
| Neuer Zustand | keiner | keiner | Merken des Schalters (neuer Zustand) |
| Prüfbarkeit | je Breite, deterministisch | je Breite | je Breite + Schalterzustand |
| Deckt den Wunsch | ja | übers Ziel hinaus | nur halb (Default müsste „weniger“ sein = A) |

**Entscheidung: A** (deckt sich mit der Architektur-Vorgabe „primär Board + Berichte ▾, sekundär die vier ins „…“-Menü“). Verworfenes unter Notizen.

### Gestaltung

Die kürzere Leiste und das Menü „…“ mit den vier Zielen sind ein **neuer Kopfzeilen-Zustand**: Nach der Vision-Leitplanke „Keine Gestaltung geht in den Bau, die niemand angesehen hat“ entscheidet die **UX-Vorprüfung** über Reihenfolge, Gruppierung und eine etwaige Kennzeichnung des Auslösers, und der **product-owner gibt den Zustand an Artboard [D0002](../Dokumentation/Wireframes/D0002.dc.html)** (Board) frei (hell/dunkel, 375/560/1280/1440 px) — wie bei I0119/R00128 und I0114/R00124. Das Artboard D0002 legt die Anordnung nach Breite heute nicht fest; die Änderung ist eine Umordnung des Vorhandenen (Material 3 „Menu“, `gemeinsam/regeln.md` „Gestaltung“).

## Tests

Nach Skill `test-pyramide`. Jede Szene der User Story wird ein Test, der eine beobachtbare Eigenschaft der Kopfzeile prüft (Skill `test-ehrlichkeit`).

- **E2E (Playwright)**: neu `e2e/tests/r00140-navigation.spec.js` mit AK 1–8: Leiste (1280 px), Seitenmenü (375/560 px), Menü „…“ (alle Breiten), die vier Ziele in beiden Zuständen, der frei gebliebene Platz. Muster `e2e/tests/r00101-kopfzeile.spec.js` (Start, Ansichtenliste, `kopfzeile-hilfen.js`).
- **Geweitete Probe**: `e2e/tests/r00113-struktur.spec.js` — statt `nav a[aria-current="page"]` prüft `aktuelleSeitePruefen` „der Eintrag mit `an` in der Kopfzeile“; die Menu-Öffnung ersetzt die reine `nav`-Abfrage; `OHNE_AKTUELL` (Mutanten) wächst um den Menüeintrag.
- **Rot vor dem Bau**: Jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #105.
- **Gegenproben (Mutanten)**: aria-current am Menüeintrag entfernt (AK 9 M1), zweiter Eintrag zusätzlich markiert (AK 9 M2), ein Ziel aus dem Menü entfernt (AK 6), „Neue Aufgabe“ ins Menü geschoben (AK 6).
- **Mitlaufend grün**: `r00101-kopfzeile.spec.js` (nachgezogen), `r00106-fokus.spec.js`, `r00054-wbs-sicht.spec.js`, `r00062-bindung.spec.js`, `r00077-responsive.spec.js`, `ziele.spec.js`, `kontrast.spec.js`, `kultur.spec.js`, `r00111-meldungen-schmal.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0018 (Akzeptiert, Regel 5 wird geweitet); R00101 (Kopfzeilen-Breite, Leiste, Seitenmenü), R00106 (Fokus im Menü), R00113 (Struktur/`aria-current`, Probe weiten), R00108 (Zielgrößen), R00100 (Berichte-Untermenü).
- Abhängig von (grün): I0083 Kopfzeile auf jeder Breite (R00101), I0095 Fokus in Fenstern und Menüs (R00106), I0102 Struktur für Hilfstechnik (R00113), I0097 Bedienziele (R00108).
- Gestaltung: **UX-Vorprüfung** und **Artboard-Entscheidung** des product-owner (D0002, Kopfzeilen-Zustand) vor dem Bau der Oberfläche.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockieren; die Empfehlungen des planers stehen im Bericht, richtungsweisend bleibt allein die Artboard-Freigabe (product-owner).

1. **Dopplung unter 600 px:** Bleibt der Seitenknopf/-Pop (Board + Berichte) **neben** dem Menü „…“? Empfehlung: **ja** — in compact ist der Seitenknopf die Navigation und trägt dieselben zwei Ziele; die vier liegen ausschließlich im Menü „…“, also keine Dopplung. Die UX-Vorprüfung bestätigt oder verwirft.
2. **Kennzeichnung des Auslösers „…“:** Punkt/Unterstrich am Zeichen, wenn die aktuelle Seite eine der vier ist, oder nichts? Empfehlung: **nichts am Auslöser** — der Menüeintrag trägt `aria-current`, der Seitenknopf nennt die Seite (compact); die UX-Vorprüfung entscheidet.
3. **Menüform:** die vier Ziele als erste Gruppe, dann die Werkzeuge, mit oder ohne Abschnittskopf (heute steht `h4>MEHR`)? Die UX-Vorprüfung entscheidet (Artboard D0002), `h4` in `role=menu` ist als Karte #109/R00136 unterwegs.
4. **ADR-0018 Regel 5:** Der Text „genau ein `nav a[aria-current="page"]`“ stimmt nach der Umordnung nicht mehr. Er wird geweitet auf „der Eintrag mit `an` trägt `aria-current` (Leiste oder Menü)“. Fortschreibung durch den Architekten (Nachtrag) oder Nachzug im Aspekt `X00005`; die Anforderung trägt die geweitete Regel, die Probe `r00113` wird mitgebaut.
5. **Platzgewinn:** Nennt die Abnahme eine Zahl für den frei gewordenen Filter-Platz, oder genügt „nicht schmaler als vorher“ (NFA „Platz“)? Empfehlung: die Messung vor dem Bau (Stand e93ad66) festhalten und als Untergrenze in die Probe schreiben, statt eine absolute Zahl zu versprechen.

## Manuelle Vorbereitungstätigkeiten

Bildschirmfotos für den Abnahmezettel (nach der UX-Vorprüfung): Kopfzeile mit der Zwei-Ziel-Leiste und dem geöffneten Menü „…“ bei 1280, 560 und 375 px, je hell und dunkel.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist die Beobachtung des Betreibers, dass vier selten gebrauchte Ziele am Board dauerhaft Platz belegen — auf jeder Breite, auch dort, wo der Filter ohnehin eng ist. Der Schmerzpunkt ist nicht ein fehlendes Ziel (alle sechs sind erreichbar), sondern die falsche Gewichtung: täglich gebrauchte Dinge (Filter, „Neue Aufgabe“, Board, Berichte) teilen sich die Leiste mit selten gebrauchten (Personen, Einrichten, WBS). Wird die Leiste auf die zwei häufigen Ziele gekürzt und wandern die vier in das schon vorhandene Menü „…“, dann stehen Filter und „Neue Aufgabe“ im gewonnenen Platz, ohne dass ein Ziel verschwindet: die vier bleiben auf jeder Breite einen Klick entfernt, ihre Markierung als aktuelle Seite wandert mit (`aria-current`). Der Hebel ist genau diese Umordnung — die Kopfzeile existiert schon, das Menü „…“ gibt es seit R00101 auf jeder Breite, es entsteht kein zweiter Weg und kein neuer Zustand. Die Wirkungskette: vier Ziele verlassen die Leiste → die Leiste trägt zwei Ziele → der Filter und „Neue Aufgabe“ erhalten den Platz → der Mensch filtert schneller und sieht mehr Karten, während Personen, WBS und Einrichten weiter über das Menü erreichbar bleiben.

## Missing-Docs

- Das Glossar kennt weder „Hauptnavigation“/„Leiste“ noch „Menü Mehr“/„Seitenmenü“. Vorschlag: nach dem Bau ein Eintrag „Hauptnavigation“ mit Leiste, Seitenknopf und Menü „…“.
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) nennt unter „Bestandteile“ „Kopfzeile in drei Zeilen, Navigation als wischbare Leiste“ — seit R00101 ist es ein Seitenknopf mit Menü. Nachzug nach dem Bau.
- `A00009` (Oberfläche) beschreibt die Kopfzeilen-Zusammensetzung; nach dem Bau nennt der Entwickler dort die zwei Leistenziele und den Menüinhalt.

## Notizen

**Eigene Interaction unter D0002.** Die Kopfzeile wird umgeordnet; das ist dasselbe Board-Thema wie I0083 (Kopfzeile auf jeder Breite). Muster: I0106/R00117 (Härtung der Kopfzeile) und I0119/R00128 (eigene Interaction für ein eigenes Kopfzeilen-Thema). I0083 ist abgenommen und bleibt zu; deshalb eine Geschwister-Interaction statt Bubbles an I0083 (Härtungs-/Änderungsregel, `AI-Team/gelerntes.md` 2026-11-11).

**Verworfene Alternativen (Optionen-Tableau):**
- **B — alle sechs Ziele ins Menü „…“:** Board und Berichte sind täglich gebraucht; sie zwei Klicks entfernt zu legen widerspricht dem Zweck (mehr Platz, ohne Wege zu verlängern).
- **C — Schalter „weniger anzeigen“:** brächte einen neuen Zustand (Merken des Schalters) und ließe die Gewichtung dem Menschen; die Karte will es per Default weniger, das ist A.
- **D — nur Board in der Leiste (Berichte ins Menü):** Berichte ist selbst ein Menü-Auslöser (acht Berichte) und ein täglicher Zugang; es wäre eine zweite Verschachtelung ohne Gewinn.

**Bewusst außerhalb:** eine Navigation Bar unten für compact (R00101 Notizen: M3 erlaubt 3–5 Ziele, kanbanD hat sechs); ein Suchfeld im Menü; das Ändern von „Neue Aufgabe“ oder des Bereichsfilters (R00101: bleiben ohne Menü).

**ADR-0018 Bezug:** Regel 5 der ADR nennt „genau ein `nav a[aria-current=page]`“. Nach dieser Anforderung liegt die aktuelle Seite für Aufgaben, Personen, WBS und Einrichten in einem Menü, nicht in der Leiste. Die Regel wird geweitet; die Probe `r00113-struktur.spec.js` (AK 11/12 der R00113) wird mitgebaut, damit sie den Eintrag mit `an` prüft, nicht nur `nav a`.
