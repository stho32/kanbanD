---
id: R00108
status: Neu
datum: 2026-11-06
---

# R00108: Bedienziele mindestens 24 px groß, bei Touch mindestens 44 px

## Beschreibung

Viele Bedienziele auf dem Board sind kleiner, als Maus und Finger sie sicher treffen. Das Kästchen der nächsten Teilaufgabe misst 13 × 13 px, das ✕ „von Board nehmen“ 8 × 14 px, das „+“ im Spaltenkopf 20 × 20 px, der Signal-Chip im Spaltenkopf 33 × 15 px, das Zeichen „Signal zurücknehmen“ 22 × 22 px und der Timer-Stopp 24 × 22 px (Karte #10). Gemessen über sechs Ansichten liegen bei feinem Zeiger 18 von 114 Zielen unter 24 × 24 px, alle auf dem Board und in der Aufgabenliste. Bei Touch liegen alle 93 gemessenen Ziele unter 44 × 44 px: Knöpfe der Kopfzeile 32 px, Felder 24–26 px, Knöpfe 28 px, Filterchips 24 px (ADR-0012, Stand 49d99ef). Wer die Teilaufgabe abhaken will, trifft heute nur das 13-px-Kästchen; ein Tipp auf ihren Text tut nichts.

Diese Anforderung setzt ADR-0012 (Option B) um:
- Das Zielmaß steht an genau einem Ort: 24 px bei feinem Zeiger, 48 px bei Touch.
- Eine Grundregel gibt jedem Bedienelement dieses Mindestmaß.
- Kleine Zeichen bleiben klein gezeichnet und bekommen eine unsichtbare Trefferfläche um sich herum (Trefferhof).
- Die Teilaufgabe auf der Karte wird ein Ziel aus Kästchen und Text.
- Bei 320, 375 und 414 px scrollt keine Ansicht waagrecht.
- Eine Messprobe im Browser geht jede Ansicht ab; eine Probe ohne Browser hält das Zielmaß und verbietet verstreute Mindestgrößen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design, früh vom Menschen gesehen. Es ist per Tastatur bedienbar und folgt gewohnten Konventionen.“ Ausreichend große Ziele gehören zu den gewohnten Konventionen (WCAG 2.2 SC 2.5.8 bei feinem Zeiger, die 44 px aus SC 2.5.5 bei Touch). Die Gestaltungsrichtung „Blaugrau, eckig, dicht“ (`Dokumentation/Wireframes/_wireframes.md`) bleibt: bei feinem Zeiger wachsen nur die Ziele unter 24 px, und kleine Zeichen behalten ihre gezeichnete Größe.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Seitenleiste](../Dokumentation/Domaenenwissen/D00003-seitenleiste.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Der Betreiber hakt Teilaufgaben, nimmt Signale zurück und stoppt Timer direkt auf dem Board, am Schreibtisch mit der Maus und unterwegs am Telefon. Heute verfehlt er dabei Ziele oder trifft das Nachbarziel und öffnet ungewollt die Karte. Mit einem Zielmaß an einem Ort und einer Probe über alle Ansichten bringt ein neues Element kein zu kleines Ziel mehr unbemerkt mit. Die verstreute Touch-Liste mit 32 px (heute zwei Stellen in `web/kd-app.css`) entfällt.

## Funktionale Anforderungen

### Zielmaß (ADR-0012 Regel 1)
1. Bei feinem Zeiger ist jedes Bedienziel mindestens 24 × 24 px groß oder erfüllt die Kreis-Ausnahme (FA 3).
2. Bei Touch ist jedes Bedienziel mindestens 44 × 44 px groß, ohne Ausnahme. Gebaut wird mit 48 px; 44 px ist die Untergrenze der Prüfung (ADR-0012 Regel 1, PO Z. 129).
3. **Kreis-Ausnahme** (nur feiner Zeiger): Ein Ziel unter 24 px besteht, wenn ein Kreis mit 24 px Durchmesser um seine Mitte kein anderes Ziel und keinen solchen Kreis eines anderen kleinen Ziels schneidet. Berühren ist erlaubt. Gerechnet: Zwei 20 × 20 px große Ziele brauchen dafür mindestens 24 px Abstand ihrer Mitten.

### Was ein Bedienziel ist (ADR-0012 Regel 2 und 5)
4. Bedienziel ist jedes Element, das ein Mensch anklickt oder antippt, um etwas auszulösen: Knöpfe, Auswahllisten, Eingabefelder, Kästchen, Menüeinträge, Reiter, Schalter und Links, die allein in einer Zelle oder Zeile stehen (z. B. die Nummer in der Aufgabenliste).
5. Ein Link mitten im Fließtext ist kein Bedienziel im Sinne dieser Anforderung.
6. Liegt ein Fenster oder Menü offen über der Seite, zählen nur seine Ziele; die verdeckten Ziele darunter nicht.
7. Die Trefferfläche ist die Fläche, auf der ein Klick tatsächlich dieses Ziel trifft — die gezeichnete Fläche samt einer unsichtbaren Erweiterung um sie herum. Wird die Erweiterung abgeschnitten oder von einem Nachbarn überdeckt, zählt sie nicht.

### Kleine Zeichen (ADR-0012 Regel 3)
8. Das ✕ „von Board nehmen“, das „+“ im Spaltenkopf, „Signal zurücknehmen“ auf der Karte, der Signal-Chip im Spaltenkopf und der Timer-Stopp auf der Karte behalten bei feinem Zeiger ihre gezeichnete Größe und bekommen eine unsichtbare Trefferfläche bis zum Zielmaß. Sie ändern weder Farbe noch Grund.
9. Wo die unsichtbare Fläche keinen Platz hat, wächst das Ziel selbst.

### Teilaufgabe auf der Karte (ADR-0012 Regel 4)
10. Kästchen und Text der nächsten offenen Teilaufgabe auf der Karte sind ein einziges Ziel. Ein Klick oder Tipp irgendwo darauf hakt die Teilaufgabe ab, wie heute ein Klick auf das Kästchen.
11. Das Ziel heißt für Screenreader weiter „<Text> abhaken“ und ist als Kästchen angekündigt. Die Tabulatortaste hält auf der Karte nicht öfter als heute.
12. Ein Klick auf den Titel der Karte öffnet weiter das Aufgabenfenster. Im Aufgabenfenster ändert sich an den Teilaufgaben nichts: dort bearbeitet ein Klick auf den Text die Teilaufgabe.

### Schmale Breiten (PO Z. 98, 105, 130)
13. Bei 320, 375 und 414 px Breite und Touch scrollt keine Ansicht waagrecht: Seite und Inhaltsbereich sind höchstens so breit wie das Fenster.
14. Bereiche, die schon heute in sich quer scrollen, bleiben erlaubt: die Spaltenleiste des Boards, breite Tabellen (WBS, Bestand, Kosten, Ressourcen, „Wie lange noch“) und die Legende.
15. Passt ein Ziel bei 320 px nicht, bricht die Zeile um oder das Ziel schrumpft bis 44 px. Waagrechtes Scrollen ist nie die Ausweichlösung. Ob ein Ziel stattdessen ins Menü „<Seite> ▾“ wandert, ist offen (Offene Fragen 1).

### Kopfzeile
16. Die Kopfzeile erbt das Zielmaß (PO Z. 17). Die Probe aus R00101 „mindestens 32 × 32“ bleibt als Untergrenze bestehen und wird nicht gelockert.

## Nicht-funktionale Anforderungen

- **Dichte bei feinem Zeiger**: Ein Ziel, das heute schon 24 × 24 px oder mehr misst, wird bei feinem Zeiger nicht größer. Das Zielmaß bei feinem Zeiger ist genau 24 px, nicht 44 px.
- **Ein Ort für das Maß**: Ändert sich das Zielmaß, ändert sich eine Zeile je Zeigerart; keine Mindestgröße für Touch steht außerhalb dieses Ortes.
- **Kein Bruch bestehender Proben**: Alle E2E-Proben bleiben grün; geändert wird nur r00077-Test „Touch: Symbolknöpfe haben mindestens 32 px Tippfläche …“ (siehe Tests).
- **Zugänglichkeit unverändert**: Rollen, Namen und Tastaturwege aller Ziele bleiben, wie R00106 sie festlegt.

## Akzeptanzkriterien

Gemessen in den Ansichten des Grundbestands aus `user-stories/R00108.md` (Board, Archiv, Aufgabenliste, Personen, Einrichten, jeder Bericht, WBS-Sicht, Seite „API für Agenten“, Aufgabenfenster, offene Menüs).

- [ ] **1. Feiner Zeiger, 1280 px**: Jedes Bedienziel in jeder Ansicht hat eine Trefferfläche von mindestens 24 × 24 px oder erfüllt die Kreis-Ausnahme.
  - Besteht: ein Ziel von 24 × 24 px; zwei Ziele von je 20 × 20 px, deren Mitten 30 px auseinanderliegen.
  - Fällt durch: dieselben zwei Ziele mit 20 px Abstand der Mitten; ein Ziel von 23 × 24 px, dessen Nachbar 20 px entfernt liegt (Mitte zu Mitte).
  - Heute fällt z. B. das Kästchen der Teilaufgabe (13 × 13 px) durch; danach misst seine Trefferfläche mindestens 24 × 24 px, gezeichnet bleibt es 13 px.
- [ ] **2. Touch, 390 px**: Jedes Bedienziel in jeder Ansicht hat eine Trefferfläche von mindestens 44 × 44 px, ohne Ausnahme.
  - Besteht: ein Knopf der Kopfzeile mit 44 × 44 px.
  - Fällt durch: derselbe Knopf mit 32 × 32 px (heute) oder 43 × 44 px.
- [ ] **3. Schmale Breiten**: Bei 320, 375 und 414 px mit Touch scrollt keine Ansicht waagrecht.
  - Besteht: bei 320 px eine Seite von 320 px Breite, deren Spaltenleiste in sich quer scrollt.
  - Fällt durch: bei 320 px eine Seite von 321 px Breite.
- [ ] **4. Teilaufgabe**: Ein Tipp auf den Text der ersten offenen Teilaufgabe einer Karte hakt sie ab und öffnet die Karte nicht.
  - Besteht: #1 mit „a“ erledigt, „b“ und „c“ offen — nach dem Tipp auf „b“ ist „b“ erledigt, die Karte zeigt „c“, kein Aufgabenfenster ist offen.
  - Gegenbeispiel, das gleich bleibt: ein Tipp auf den Titel von #1 öffnet das Aufgabenfenster.

## Betroffene Verzeichnisstruktur

```
web/
  kd-tokens.css          Zielmaß, einmal je Zeigerart
  kd-base.css            Grundregel für Bedienelemente
  kd-app.css             Trefferhof kleiner Zeichen; Touch-Liste :277 und :791–795 entfällt
  ansicht.js             vNaechsteTeilaufgabe (:585) als ein Ziel
e2e/
  einheit/ziele.test.js  neu: reine Probe ohne Browser
  tests/ziele-hilfen.js  neu: Messhelfer Trefferfläche
  tests/ziele.spec.js    neu: Messprobe über alle Ansichten
  tests/r00077-responsive.spec.js   Test :61–68 umgestellt
```

## Technische Überlegungen

Entschieden in ADR-0012 (Option B, Architektur bestanden 97d73f7); Aspekt X00003, Baustein A00009.

### Ablauf

Zuerst das Zielmaß samt reiner Probe (B0399), parallel der Messhelfer mit Selbstproben (B0400) und die Teilaufgabe (B0408). Danach Grundregel (B0402) und Trefferhof (B0403), dann die Ansichtenliste (B0401). Touch (B0404, B0405) und schmale Breiten (B0406, B0407) folgen.

### Grobentwurf

- **Token** `--kd-ziel` in `web/kd-tokens.css`: `24px`, in `@media (pointer:coarse)` `48px`.
- **Grundregel** in `web/kd-base.css`: `:where(button, select, input:not([type=hidden]), a.btn, [role=checkbox], [role=radio], [role=menuitem], [role=tab], [role=switch]){min-block-size:var(--kd-ziel);min-inline-size:var(--kd-ziel)}`; `:where` hält die Spezifität bei null, damit Bestandsregeln nicht brechen.
- **Trefferhof**: `position:relative` am Ziel und ein durchsichtiges `::after` mit `inset:min(0px, (100% - var(--kd-ziel)) / 2)`.
  - `.farbe` trägt im `::after` schon das „▾“ (`web/kd-app.css:381`) und wächst deshalb selbst.
  - Unter `overflow:hidden` wird der Hof abgeschnitten: `.leg` (`:180`), `.mod-fuss` (`:347`), `.ka .r3` (`:126`). Dort wächst das Ziel; `.bk-name` und die Knöpfe der Legende (22 hoch, `:182`) gehören dazu.
- **Teilaufgabe**: `vNaechsteTeilaufgabe` (`web/ansicht.js:585`) rendert ein `button role=checkbox` mit `aria-checked`, Kästchen-Zeichnung und Text als Inhalt; `aria-label="<Text> abhaken"` und `data-act="teil-karte"` bleiben (r00038 nutzt den Namen).
- **Touch-Liste** `web/kd-app.css:791–795` und `:277` entfallen; die 48 px kommen aus Token, Grundregel und Hof.
- **Erkennung im Review**: `grep -nE "pointer: ?coarse" web/*.css` findet danach nur Regeln ohne Mindestgröße.

### Gestaltung

Kein neuer Gestaltungszustand: Die Maße ändern sich, Zeichnung, Farben und Anordnung nicht (wie Karte #9, PO Z. 130). Artboard D0002 zeigt keine Teilaufgabe und muss nicht nachgezogen werden. Artboard D0003 („Reiter Kosten“) zeichnet bei 320/375/414 px Knöpfe mit 32 px; das ist ein Entwurfsmaß, Vorgabe für den Bau ist diese Anforderung. Eine Ausweichlösung über das Menü „<Seite> ▾“ wäre ein neuer Zustand (Offene Fragen 1).

### Umfang

I0097: 4 Features, 10 Bubbles, 11,5–24,5 h.
- Herleitung: Summe der Bubble-Spannen — F0048 7–14 h (B0399 1-2, B0400 2-3, B0401 1,5-3, B0402 1-3, B0403 1,5-3), F0049 2–4,5 h (B0404 1,5-3, B0405 0,5-1,5), F0050 1,5–4 h (B0406 0,5-1, B0407 1-3), F0051 1–2 h (B0408 1-2).
- Die Spannen sind ungemessen (Hypothese), nach dem Muster von I0095 und I0096.
- B0407 ist bedingt: Ist die Breitenprobe nach dem Touch-Umbau grün, entfällt sie, und der Umfang sinkt auf 10,5–21,5 h.
- Gezählte Eingänge: 18 Ziele fein und 93 Ziele Touch unter Maß (ADR-0012, sechs Ansichten); Fenster, Menüs, WBS-Sicht und API-Seite sind ungemessen, ihre Zahl ist unbekannt.

### Vorplanung (Bubbles in `Dokumentation/Planung/kanbanD.md`)

| Bubble | Feature | Inhalt | Aufwand | Braucht |
|---|---|---|---|---|
| B0399 | F0048 | Zielmaß an einem Ort mit reiner Probe | 1-2 | — |
| B0400 | F0048 | Trefferfläche messen mit Selbstproben | 2-3 | — |
| B0401 | F0048 | Ansichten mit Fixtures abgehen | 1,5-3 | B0400, B0402, B0403 |
| B0402 | F0048 | Grundregel für alle Bedienelemente | 1-3 | B0399 |
| B0403 | F0048 | Trefferhof für kleine Zeichen | 1,5-3 | B0399 |
| B0404 | F0049 | Touch-Liste in das Token auflösen | 1,5-3 | B0399, B0402 |
| B0405 | F0049 | Touch-Lauf der Messprobe | 0,5-1,5 | B0401, B0404 |
| B0406 | F0050 | Breitenprobe 320, 375, 414 px | 0,5-1 | B0401 |
| B0407 | F0050 | Ausweichen bei 320 px (bedingt) | 1-3 | B0404, B0406 |
| B0408 | F0051 | Teilaufgabe als ein Ziel mit Text | 1-2 | — |

Die Bubbles sind Vorgabe für den Bau, keine Vereinbarung; geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

- **Reine Probe** `e2e/einheit/ziele.test.js` (node:test, ohne Browser):
  - `--kd-ziel` steht genau einmal ohne Medienbedingung mit `24px` und genau einmal in `@media (pointer:coarse)` mit `48px`.
  - Mutanten fallen durch: fein 23 und 44, Touch 47 und 43.
  - Wächter: keine `min-width`, `min-height`, `min-block-size` oder `min-inline-size` mit Zahlenwert innerhalb von `@media (pointer:coarse)` außerhalb von `web/kd-tokens.css`. Bis B0404 als `todo` geführt (heute rot an `web/kd-app.css:277` und `:791–795`), mit Alarm, falls er vorher grün wird.
- **Messhelfer** `e2e/tests/ziele-hilfen.js` mit Selbstproben auf einer Testseite (`page.setContent`):
  - 20 × 20 fällt, 24 × 24 besteht.
  - Zwei 20 × 20 mit Mitten 30 px besteht, 20 px fällt, 24 px besteht (Grenzwert).
  - Ein 13-px-Zeichen mit Hof besteht; derselbe Hof unter `overflow:hidden` fällt.
  - Trefferfläche = Rechteck des Elements vereinigt mit dem seines `::after`; die Ecken werden mit `document.elementFromPoint` geprüft.
  - Eigene Datei statt `hilfen.js`, weil Karte #9 (Zweig karte/9) dort den Kontrast-Helfer ergänzt.
- **Messprobe** `e2e/tests/ziele.spec.js`:
  - Feiner Zeiger, 1280 px: jede Ansicht der Liste, Verstöße mit Ansicht, Selektor, Name und Maß.
  - Touch (`hasTouch`), 390 px: dieselbe Liste ohne Kontextmenü, Maß 44.
  - 320, 375, 414 px mit Touch: `document.documentElement.scrollWidth <= clientWidth` und dasselbe für `#main`.
  - Liste `NICHT_GEMESSEN` startet leer; ein Eintrag braucht Selektor, Ansicht, Karte, heutiges Maß und Grund und schlägt Alarm, wenn das Ziel verschwindet, das Maß erreicht oder kleiner wird.
  - Eigene Ansichtenliste; der Zusammenschluss mit der Liste aus `kontrast.spec.js` (ADR-0012 Regel 6) folgt erst nach dem Merge von Karte #9.
- **r00077-responsive.spec.js:61–68**: Die Schleife „mindestens 32“ über `.kopf-plus`, `.bk-name`, `#t-mehr`, `#t-thema` entfällt (die Messprobe prüft 44); die Prüfung „der Personenknopf zeigt nur das Kürzel“ bleibt.
- **Teilaufgabe**: E2E „Tipp auf den Text ‚b‘ von #1 → Datei enthält `- [x] b`, Karte zeigt ‚c‘, kein Fenster offen“; Zahl der Tab-Halte auf der Karte vor und nach gleich; `r00038-naechste-teilaufgabe.spec.js` bleibt grün.
- Abnahme-Befehle: `node --test e2e/einheit/ziele.test.js` und `npx playwright test ziele`.

## Abhängigkeiten

- ADR-0012 (Akzeptiert); Aspekt X00003 Zielgrößen; Baustein A00009 Oberfläche.
- R00038 Nächste Teilaufgabe (I0038, grün); R00077 Responsive (I0065, grün); R00101 Kopfzeile (I0083, grün); R00106 Fokus in Fenstern und Menüs (I0095, rot, alle Bubbles grün — legt Rollen der Menüeinträge fest, die hier gemessen werden).
- Nicht vorausgesetzt: R00107 Kontrast (I0096, Zweig karte/9). Keine Bubble braucht sie; nach ihrem Merge werden die Ansichtenlisten zusammengeführt.

## Offene Fragen

1. **Ziel ins Menü „<Seite> ▾“ bei 320 px?** Passt ein Ziel bei 320 px auch nach Umbruch nicht, könnte es ins Menü wandern (PO Z. 15). Das wäre ein neuer Menüzustand ohne Artboard. Empfehlung: zuerst Umbruch oder Schrumpfen auf 44 px; muss doch ein Ziel ins Menü, zeichnet der gestalter den Zustand an D0002, bevor B0407 baut. Relevant nur, wenn die Breitenprobe nach dem Touch-Umbau rot ist.
2. **Schrumpfen auf 44 px ohne zweiten Zahlenwert?** ADR-0012 Regel 1 und der Wächter erlauben in `@media (pointer:coarse)` keinen Zahlenwert außer dem Token. Empfehlung: erst entscheiden, wenn die Breitenprobe rot ist; dann ein zweites Token in `web/kd-tokens.css`, die reine Probe erweitert und ein Nachtrag zu ADR-0012 durch den architekt.

## Manuelle Vorbereitungstätigkeiten
Keine.

## Manuelle Nachbereitungstätigkeiten
Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die zu kleinen Ziele haben eine gemeinsame Ursache: Es gibt kein Zielmaß, nur eine Liste einzelner Stellen mit 32 px für Touch. Ein Maß an einem Ort und eine Grundregel für alle Bedienelemente heben jedes Ziel, auch künftige. Der Trefferhof vergrößert die kleinen Zeichen, ohne das dichte Board aufzublähen. Die Messprobe geht jede Ansicht ab und misst, was ein Klick wirklich trifft; die reine Probe verhindert, dass wieder verstreute Mindestgrößen entstehen. Dass die Teilaufgabe ein Ziel mit ihrem Text wird, beseitigt den häufigsten Fehlgriff auf der Karte.

## Missing-Docs
- `A00009-oberflaeche.md` und `X00003-zielgroessen.md` beschreiben das Zielmaß als Soll. Nach dem Bau nennt der Entwickler dort Token, Grundregel und Messprobe.
- Kein Glossareintrag für „Bedienziel“ und „Trefferhof“ in `Dokumentation/Domaenenwissen/`; die Begriffe sind hier in FA 4 und 7–8 bestimmt.

## Notizen
- **Abnahme der Karte #10**: Zielgrößen bei feinem Zeiger mindestens 24 × 24 px, bei Touch 44–48 px; die Ziele der Karte (Kästchen, ✕, Spalten-„+“, Signal-Chip, Signal zurücknehmen, Timer-Stopp) sind in AK 1 und 2 enthalten; der Tipp auf den Text der Teilaufgabe setzt sie erledigt (AK 4, technisch `aria-checked=true`).
- **PO-Entscheidungen**: Z. 129–132 (Zielmaß, Touch, schmale Breiten, vier Akzeptanzkriterien), Z. 15 (Menü „<Seite> ▾“), Z. 17 (Kopfzeile erbt), Z. 98 und 105 (schmale Breiten).
- **Entscheidungen des planers**:
  - Vier Features nach den vier Akzeptanzkriterien; jedes ist von außen prüfbar und nach dem Zielmaß parallel baubar.
  - `NICHT_GEMESSEN` startet leer; ein nötiger Eintrag ist ein Befund an den Director, kein stiller Ausweg.
  - Der Grenzwert der Kreis-Ausnahme (Mitten genau 24 px) ist Selbstprobe des Helfers, kein Akzeptanzkriterium.
  - r00077 nur teilweise umstellen: die 32-px-Schleife geht, die Kürzel-Prüfung bleibt.
- **Bewusst außerhalb**: Ränder und Kontrast der Bedienelemente (Karten #9, #55); Zielgrößen in Werkzeugen außerhalb der Weboberfläche.
- **Verworfene Alternativen (Schnitt)**: je Ansicht eine Anforderung (Token und Proben sind gemeinsam, die Karte hat eine Abnahme); Schnitt nach Schichten (erst CSS, dann Tests) — nicht von außen prüfbar.
