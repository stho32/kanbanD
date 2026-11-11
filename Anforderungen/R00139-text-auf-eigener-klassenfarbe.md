---
id: R00139
status: Neu
datum: 2026-11-11
---

# R00139: Text auf einer eigenen Klassenfarbe trägt `--kd-text`

## Beschreibung

Die Zeile r3 der Karte (`.ka .r3`, `web/kd-app.css:161`) trägt `--kd-muted`: Σ-Zeit, Datum, Herkunft. Ist der Grund der Karte eine **eigene** Klassenfarbe der Nutzerin, mischt der Browser sie im Dunkelthema zu 30 % über `--kd-surface` (`cv()`, `web/ansicht.js:435`; `--kd-klasse-anteil`, `web/kd-tokens.css:87`). Für `#ffffff` liegt der Grund dann bei etwa (97, 100, 105); `--kd-muted` erreicht darauf 2,571:1, WCAG 2.1 SC 1.4.3 verlangt 4,5:1. Eigene Farben liegen nach ADR-0011 Regel 7 außerhalb der Paartabelle — ihre Schrift hatte damit bisher kein Versprechen. Diese Anforderung setzt ADR-0011 Nachtrag N1 um: Text auf einer eigenen Nutzerfarbe trägt `--kd-text`, nicht `--kd-muted`. Der Anker ist das schon vorhandene Merkmal der Karte für eine eigene Farbe (`data-eigen`, `web/ansicht.js:590`), an dem das Preisetikett genau diesen Fall schon löst (`.ka[data-eigen] .preis{color:var(--kd-text)}`, `web/kd-app.css:166`).

Zahlt ein auf: [Vision](R00000-vision.md) — „folgt gewohnten Konventionen". Ein Text, der auf einer getönten Karte unter 4,5:1 fällt, ist nicht lesbar; lesbarer Text ist eine gewohnte Konvention (WCAG 2.1 SC 1.4.3).

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Der Betreiber arbeitet abends im Dunkelthema. Gibt er einer Karte eine eigene Klassenfarbe (nicht eine der 16 Palettenfarben), kann er die Zeitsumme und das Datum auf der Karte heute nicht mehr lesen: die Schrift `--kd-muted` fällt auf der getönten Fläche auf 2,571:1. Mit einer festgelegten Schriftfarbe trägt der Text auf einer eigenen Farbe denselben geprüften Ton wie das Preisetikett, und die Kontrastprobe misst den Fall am gezeichneten Element — ein neues eigenes Farbfeld, das die Schrift wieder unter das Maß drückt, fällt im Test auf, nicht erst in der nächsten Durchsicht.

## Funktionale Anforderungen

1. Text auf einer Karte mit eigener Klassenfarbe (`data-eigen`) trägt `--kd-text`: die Zeile r3 (`.ka .r3`) mit Σ-Zeit, Datum, Teilaufgaben-Zähler und Herkunft; das Preisetikett trägt ihn schon.
2. Der Anker ist das vorhandene `data-eigen` (`web/ansicht.js:590`, gesetzt, sobald die Klassenfarbe keine der 16 Palettenfarben ist); es entsteht kein neuer Anker und kein neues Attribut.
3. Paletten- und WBS-Gründe bleiben `--kd-muted` (Paar `--kd-c-*` ↔ `--kd-muted`, ADR-0011 Regel 2): eine Karte mit Paletten-Klasse behält ihre geprüfte Schrift.
4. Zustände mit eigener Paarung bleiben unberührt: die Initialen der Zuständigen (`.pk` auf `--kd-mensch`/`--kd-agent` mit ihren On-Farben, Regel 2), der Reservierungs-Schloss (`.schloss`, `--kd-text`), der Warnzustand der mehrdeutigen Herkunft (`.org.mehrdeutig`, `--kd-warn`).
5. Kein Farbwert außerhalb `web/kd-tokens.css` (ADR-0011 Regel 5): die Umstellung fügt nur das Token `--kd-text` hinzu.
6. Grenze (Regel 7): eigene Nutzerfarben werden **kein Paar** der Tabelle; festgelegt ist allein die Schriftfarbe. Ob sie auf einer frei gewählten Farbe tatsächlich trägt, entscheidet die E2E-Probe am gezeichneten Element.

## Nicht-funktionale Anforderungen

- **Maß**: Die Schrift der Zeile r3 und der Herkunft hält auf der eigenen Klassenfarbe in beiden Themen mindestens 4,5:1 (WCAG 2.1 SC 1.4.3). Gerechnet (oklch → sRGB → WCAG, dieselbe Rechnung wie R00107): eigene Farbe `#ffffff` — dunkel `--kd-muted` 2,571 (heute), `--kd-text` 4,677; hell `--kd-text` 16,243.
- **Gestaltung**: Es ändert sich nur der Ton der r3-Schrift auf einer eigenen Klassenfarbe; Form, Maße, Schrift und Anordnung bleiben. Kein neuer Gestaltungszustand, kein Artboard (die Karte ist gezeichnet, nur ein Ton wechselt); die Töne der Artboards weichen nach dem Bau ab (Hinweis an den `gestalter`).
- **Ein Ort**: Die Schriftfarbe hängt an einer Regel in `web/kd-app.css`; es entsteht kein zweiter Ort.

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „entwicklung" mit den Spalten „Zu erledigen", „In Arbeit", „Erledigt"; in `kanbanD.md` die Klasse `bug` (Palettenfarbe rot) und eine Klasse mit eigener Farbe `#ffffff`; Aufgabe #1 der Klasse mit eigener Farbe, 46 Minuten gebucht und eine Fälligkeit, in „Zu erledigen"; Aufgabe #2 der Klasse `bug`, sonst gleich. Breite 1280 px. „Kontrast" heißt das WCAG-Verhältnis der Schrift gegen den ersten deckenden Grund (Messregel wie R00107 Funktionaler Anforderung 17). „Beide Themen" heißt `data-theme=light` und `data-theme=dark`.

### Abnahme-Probe der Karte #50

- [ ] **1. Abnahme-Probe der Karte #50, wörtlich**: „Klasse mit eigener Farbe #ffffff, Dunkelthema, Karte mit Σ und Datum → berechneter Kontrast von Σ und Datum gegen den Kartengrund ≥ 4,5:1; heute 2,57:1 (rot). Gegenprobe Standardklasse unverändert."
  - Besteht (nach dem Fix): im Dunkelthema ist die berechnete Schriftfarbe von Σ-Zeit (`.sum`) und Datum (`.due`) `--kd-text`, ihr Kontrast gegen den berechneten Kartengrund ist mindestens 4,5 (gerechnet 4,677).
  - Fällt durch (heute): die Schriftfarbe ist `--kd-muted`, der Kontrast 2,571.
  - Prüfebene: E2E `e2e/tests/kontrast.spec.js` (die Probe wächst um eine eigene Farbe).
- [ ] **2. Beide Themen**: dieselbe Karte mit eigener Farbe `#ffffff` — hell ist die Schrift `--kd-text` (gerechnet 16,243) und dunkel `--kd-text` (4,677), je mindestens 4,5:1.
- [ ] **3. Herkunft**: dieselbe Karte trägt eine Herkunft (Aufgabe ohne Herkunft zeigt „ohne Herkunft"), auch sie steht auf `--kd-text` und hält mindestens 4,5:1.

### Gegenproben (Regel 2 bleibt, Mutanten)

- [ ] **4. Paletten-Klasse unverändert**: eine Karte der Palettenklasse `bug` (rot) in beiden Themen zeigt Σ-Zeit, Datum und Herkunft weiter in `--kd-muted`; die Paar-Prüfung `--kd-c-red` ↔ `--kd-muted` (R00107, Unit und E2E) bleibt grün.
- [ ] **5. Mutante „Regel entfernt"**: die Regel für `data-eigen` entfällt → die Probe misst Σ-Zeit und Datum wieder unter 4,5 und wird rot.
- [ ] **6. Mutante „auf allen Karten"**: die Schrift wird für **jede** Karte (auch Palettengründe) auf `--kd-text` gezogen → Kriterium 4 wird rot (die Paletten-Karte misst `--kd-text` statt `--kd-muted`).

### Abnahme der Karte

- [ ] **7.** `npx playwright test kontrast` in `e2e/` ist grün; der Eintrag `#50` der Ausnahmeliste (R00107, Akzeptanzkriterium „Ausnahmeliste") ist entfernt (`#55` bleibt); `node --test e2e/einheit/` grün; die Wächter `r00105-preisetikett` und `ziele` bleiben grün.

## Betroffene Verzeichnisstruktur

```
web/
  kd-app.css               .ka[data-eigen] .r3 und .ka[data-eigen] .r3 .org: Schrift auf --kd-text
e2e/
  tests/kontrast.spec.js   die Kontrastprobe wächst um eine Klasse mit eigener Farbe (#ffffff): Σ-Zeit, Datum und Herkunft als gemessene Elemente; der Eintrag #50 der Ausnahmeliste entfällt
```

## Technische Überlegungen

Nach [ADR-0011](../Dokumentation/ADRs/0011-farbrollen-in-paaren-kontrast-als-probe.md) Nachtrag N1 (Akzeptiert, bindend); der Baustein [A00009 Oberfläche](../Dokumentation/Architektur/A00009-oberflaeche.md) trägt die Soll-Notiz. Das ist keine Technikfrage — die Entscheidung ist mit dem Nachtrag gefallen und wird hier umgesetzt, kein neuer ADR.

### Optionen

| | A: eine Regel für die ganze Zeile (`data-eigen`), ADR-0011 N1 | B: je Element eine eigene Regel | C: Schrift aus der Fläche errechnen (`contrast-color()`) |
|---|---|---|---|
| Deckt die Abnahme-Probe | ja | ja, aber mehrere Stellen zu pflegen | nur bedingt; nicht in allen Browsern ausgeliefert |
| Risiko | gering: ein Selektor, der Ton ist in beiden Themen geprüft (`--kd-surface` ↔ `--kd-text`) | mittel: jedes neue r3-Element braucht seine Regel | hoch: eigener Weg ohne Paar, Markenton ginge verloren |
| Sichtbare Änderung | nur der Ton der r3-Schrift auf eigener Farbe | dieselbe | wechselt je eigener Farbe zwischen Schwarz und Weiß |

**Entscheidung: A** (ADR-0011 N1): Der Ton `--kd-text` hängt an dem einen vorhandenen Merkmal `data-eigen`; B zerstreut dieselbe Aussage über mehrere Selektoren, C tauscht den gestalteten Ton gegen einen errechneten und war in der ADR bereits verworfen.

### Ablauf

1. E2E-Probe (Test zuerst): `e2e/tests/kontrast.spec.js` misst eine Karte mit eigener Klassenfarbe `#ffffff`; Σ-Zeit, Datum und Herkunft erscheinen in der Messliste. Bis zum Fix steht der Verstoß als `#50` in der Ausnahmeliste, damit die Probe für I0096 grün bleibt (R00107, Akzeptanzkriterium „Ausnahmeliste").
2. `web/kd-app.css`: die Schrift der Zeile r3 und der Herkunft auf `--kd-text`, wenn die Karte `data-eigen` trägt; für alle anderen Karten bleibt `--kd-muted`.
3. Den Ausnahme-Eintrag `#50` entfernen; die Probe ist grün.
4. `web/`-Dateien sind per `include_bytes!` eingebettet — sichtbar erst nach `cargo build` und Neustart.

### Wächter

`e2e/tests/kontrast.spec.js` (die Probe selbst), `node --test e2e/einheit/kontrast.test.js` (Paar `--kd-c-*` ↔ `--kd-muted` unberührt), `npx playwright test kontrast r00105-preisetikett ziele`.

## Tests

Nach Skill `test-pyramide` und `test-ehrlichkeit`; jede Szene prüft eine gemessene Zustandsänderung (Schriftfarbe und Kontrast am Element), nicht nur den Aufruf.

- **Unit (Node, rein)**: `e2e/einheit/kontrast.test.js` — die Paartabelle ändert sich nicht; die Palettengründe bleiben bei `--kd-muted`, ihr Wert unverändert.
- **E2E (Playwright)**: `e2e/tests/kontrast.spec.js` — US-1 und US-2 (AK 1–4); eine Karte mit eigener Farbe `#ffffff` und ein Gegenstück der Palettenklasse in beiden Themen. Rot vor dem Bau: AK 1 fällt heute durch (`--kd-muted`, 2,571).
- **Mitlaufend grün**: `e2e/tests/r00105-preisetikett.spec.js` (dasselbe Merkmal `data-eigen`), `ziele.spec.js` (gemeinsame Ansichtenliste), `node --test e2e/einheit/`.

## Abhängigkeiten

- ADR-0011 Nachtrag N1 (Akzeptiert, bindend); R00105 (Preisetikett — dasselbe Muster, dasselbe Merkmal `data-eigen`); R00107 (die E2E-Probe und ihre Ausnahmeliste).
- Abgegrenzt, nicht Teil dieser Anforderung: #51 (Farbfeld „ohne Klasse", Größe und Rand), #55 (Ränder von `.btn` und Select); die Ausweitung der E2E-Probe auf alle Sichten (spätere Karte, ADR-0011 Folgeentscheidungen).

## Offene Fragen

- Keine. Die Schriftfarbe auf eigenen Farben ist mit ADR-0011 N1 entschieden; der Auftrag nennt eine feste eigene R-Nummer (R00139).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine — kein neuer Gestaltungszustand (nur ein Ton der r3-Schrift wechselt), `web/` ist eingebettet und erst nach `cargo build` und Neustart sichtbar.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist der Nebenfund des `gestalter` beim Zeichnen von D0002 für #18 (kanbanD `89b9d89`): auf einer hellen eigenen Klassenfarbe fällt der r3-Text im Dunkelthema unter 4,5:1. Die Ursache ist dieselbe Klasse Fehler wie in ADR-0011 — eine Schriftfarbe steht auf einer Fläche, für die niemand ihren Kontrast versprochen hat; nur liegt die Fläche hier außerhalb der Paartabelle, weil die Nutzerin die Farbe frei wählt. Weil das Preisetikett den Fall an demselben Merkmal `data-eigen` bereits löst, zahlt diese Anforderung keinen neuen Mechanismus, sondern nur die Schriftfarbe der r3-Zeile nach: X (eigene Farbe als Kartengrund) → Y (der r3-Text trägt `--kd-text`, den in beiden Themen geprüften Ton) → Z (der Betreiber liest Σ-Zeit und Datum auf jeder Karte). Die Probe wächst um die eine eigene Farbe, sodass ein künftiges Farbfeld, das die Schrift wieder unter das Maß drückt, im Test auffällt.

## Missing-Docs

- Keine. ADR-0011 N1 trägt die Regel; R00107 trägt die Probe und die Ausnahmeliste.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene kleine Interaction **I0128** unter D0002 (Board), Bubbles **B0630** (Akzeptanztest) und **B0631** (CSS-Regel) mit eigener Anforderung R00139. Die Härtungsregel (`AI-Team/gelerntes.md` 2026-11-11; Vorbilder I0106/R00117, I0123/R00135, I0127/R00138) verlangt das: I0096 (R00107) ist **grün/abgenommen** — eine rote Folge-Bubble daran öffnete dessen Abnahme („alle AK erfüllt") wieder. R00107 wird deshalb **nicht** fortgeschrieben; die neue Interaction trägt die Probe (`kontrast.spec.js`) und den CSS-Fix. Elterndialog D0002, weil die Karte und ihre Zeile r3 auf dem Board liegen (wie I0096).
- **Weiche (`befunde-einplanen`)**: **nicht** „falsch gebaut". R00107 hat #50 ausdrücklich abgegrenzt („Ausweitung der E2E-Probe … sobald #50 und #55 durch sind"), und ADR-0011 N1 sagt selbst, die Schrift auf eigenen Farben hatte „bisher kein Versprechen". Damit fehlt der Umfang — der Betreiber kann Σ-Zeit und Datum auf einer eigenen Farbe im Dunkelthema nicht lesen —, deshalb neue eigene Interaction, **nicht** `aus-bug` (das verlangte „kein neuer Knoten"). Der Kartenvermerk „Weg: /anforderung aus-bug" ist damit überholt; das Dokument trägt kein `ursprung: Bug-Report`.
- **Architektur (Karte #50, bestanden 2026-11-11, arch)**: keine Technikfrage, Gestaltung/Kontrast → ADR-0011 Nachtrag N1; kein neuer ADR.
- **Rechenbeispiel (Reproduktion, 2026-11-11)**: eigene Farbe `#ffffff`, Klassenanteil 30 % über `--kd-surface` dunkel `oklch(0.25 0.014 255)` → Grund sRGB (97, 100, 105); darauf `--kd-text` dunkel 4,677, `--kd-muted` dunkel 2,571. Im hellen Thema (Klassenanteil 14 %): `--kd-text` 16,243, `--kd-muted` 6,451.
- **Verworfene Alternativen (Schnitt)**: R00107 um ein Kriterium fortschreiben — öffnet die abgenommene Interaction (Härtungsregel); `--kd-faint`/`--kd-muted` nur nachdunkeln — behebt den Einzelfall, nicht die Klasse (die Schrift hätte weiter kein Versprechen auf eigenen Farben).
