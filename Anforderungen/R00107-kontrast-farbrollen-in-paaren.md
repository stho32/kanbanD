---
id: R00107
status: Neu
datum: 2026-11-06
---

# R00107: Kontrast-Tokens in beiden Themen auf 4,5:1 heben — Farbrollen in Paaren

## Beschreibung

Im Dunkelthema ist ein Teil der Schrift kaum lesbar. Die Modusleiste „Spalten einrichten“ zeigt ihren Titel mit 1,33:1. Die Initialen der Personen erreichen 2,61:1 bei Menschen und 2,55:1 bei Agenten, „Neue Aufgabe“ in der Kopfzeile 3,81:1. Auch im hellen Thema liegen Texte unter 4,5:1: die Initiale eines Agenten (4,08:1), der Untertitel der Modusleiste (4,08:1), ein überfälliges Datum auf einer Karte der Klasse „bug“ (4,37:1) und jeder Text in `--kd-faint`, etwa die Herkunft auf einer Karte (2,63–3,58:1). Gemessen wurde am 2026-11-06 im headless Chromium auf Stand `d9674e3`; wo Messung und Rechnung in der zweiten Nachkommastelle abweichen, steht hier wie überall in dieser Anforderung der gerechnete Wert. Werkzeug und Grundbestand stehen in den Notizen.

Die Ursache ist kein einzelner zu heller Ton. Eine Schriftfarbe steht auf einer Fläche, für die niemand ihren Kontrast versprochen hat (ADR-0011). Diese Anforderung setzt die Entscheidung der ADR um:
- Jede Farbe in `web/kd-tokens.css` hat genau eine Rolle: Fläche, Schrift oder Linie.
- Schrift steht nur auf einer Fläche, mit der sie ein erklärtes Paar bildet.
- Jedes Paar hält in beiden Themen 4,5:1 bei Schrift und 3:1 bei einer Linie, die einen Zustand trägt.
- Außerhalb der Tokens steht kein Farbwert.
- Zwei Proben halten das fest. Eine Node-Unit rechnet jedes Paar aus der Token-Datei nach und schlägt bei einem neuen Farbliteral an. Eine E2E-Probe misst im Browser jeden Text in den fünf Bereichen der Karte #9 in beiden Themen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design, früh vom Menschen gesehen. Es ist per Tastatur bedienbar und folgt gewohnten Konventionen.“ Lesbarer Text in beiden Themen gehört zu den gewohnten Konventionen (WCAG 2.1 SC 1.4.3). Die Gestaltungsrichtung „Blaugrau, eckig, dicht“ (`Dokumentation/Wireframes/_wireframes.md`) bleibt. Es ändern sich Töne und Paarungen, keine Formen.

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)

## Geschäftlicher Nutzen

Der Betreiber arbeitet abends im Dunkelthema. Heute muss er dort raten, welche Person eine Karte bearbeitet, und die Modusleiste „Spalten einrichten“ ist praktisch leer. Mit Paaren und Probe wird ein Ton an einer Stelle geändert und in Millisekunden an allen Paaren in beiden Themen geprüft. Ein neues Element, das wieder ein festes `#fff` mitbringt, fällt im Test auf, nicht erst in der nächsten UX-Durchsicht. PO-Entscheidung `AI-Team/po-entscheidungen.md:99` verlangt dasselbe Maß schon für das Preisetikett („Kontrast mindestens 4,5:1 in Hell und Dunkel“).

## Funktionale Anforderungen

### Paare (ADR-0011 Regel 2)

1. Die Paartabelle ist Daten im Unit-Test und hat genau diese Zeilen:
   - **neutrale Flächen** `--kd-bg`, `--kd-surface`, `--kd-sunken` ↔ Schrift `--kd-text`, `--kd-muted`, `--kd-warn`, `--kd-accent-ink`, `--kd-mensch`, `--kd-agent-ink`;
   - **Container** `--kd-accent-weak` ↔ `--kd-accent-ink`, `--kd-text`, `--kd-muted`, `--kd-warn`; `--kd-agent-weak` ↔ `--kd-agent-ink`, `--kd-text`, `--kd-muted`; `--kd-mensch-weak` ↔ `--kd-text`, `--kd-muted`;
   - **Füllung** `--kd-accent` ↔ `--kd-on-accent`, `--kd-mensch` ↔ `--kd-on-mensch`, `--kd-agent` ↔ `--kd-on-agent` (neu); Zustand **Hover** `--kd-accent-hover` ↔ `--kd-on-accent` (`.btn-haupt:hover`, `web/kd-base.css:17`) — nachgezogen 2026-11-11 (R00135, Karte #67) auch an den beiden Hauptknöpfen `.kz-modus .kz-btn.haupt:hover` (`web/kd-app.css:81`) und `.kz-btn.neu-btn:hover` (`:691`);
   - **Kopf** `--kd-head` ↔ `--kd-head-text`, `--kd-head-muted`, `--kd-head-link` (neu);
   - **Modusleiste** `--kd-modus` ↔ `--kd-modus-text`, `--kd-muted`, `--kd-warn` (neu, siehe unten);
   - **Klassengründe** `--kd-c-<farbe>` (16 Paletten-Farben) ↔ `--kd-text`, `--kd-muted`, `--kd-warn`;
   - **WBS-Ampel** `--kd-wbs-<status>-bg` ↔ `--kd-wbs-<status>-ink` und `--kd-text` (ok, warn, error, neutral);
   - **Linien** `--kd-wl-1`, `--kd-wl-2`, `--kd-wl-3` ↔ `--kd-surface`; `--kd-modus-linie` ↔ `--kd-modus`, `--kd-sunken`; `--kd-accent` (Fokusring) ↔ `--kd-modus`; `--kd-faint` (Zustandslinie `.bf-chip`) ↔ `--kd-bg`; Maß 3:1 (Modusleiste siehe Funktionale Anforderung 8).
2. Jede Schrift dieser Tabelle hält auf jeder ihrer Flächen in beiden Themen mindestens 4,5:1, jede Linie mindestens 3:1. Gerechnet wird aus `web/kd-tokens.css`, oklch → sRGB → WCAG.

### Neue Tokens

3. Die On-Farben `--kd-on-accent`, `--kd-on-mensch` und `--kd-on-agent` sind die Schrift auf der jeweiligen Füllung. Sie ersetzen jedes feste `#fff`:
   - `web/kd-base.css:16` `.btn-haupt`
   - `:28` `.pk`, je nach Fläche `.pk-m` bzw. `.pk-a`
   - `:32` `.lauf.eigen` und `.lauf.eigen::before`
   - `web/kd-app.css:148` `a.org:hover`
   - `:327` `.ochip button:hover`
   - `:579` `.kl:hover`
   - `:598` `.km-e.an`
   - `:611` `.kz-btn.neu-btn` (heute `--kd-head-text` auf Akzent)
   - `:600` `.km-e.an .km-k` (heute `--kd-accent-weak` auf Akzent, dunkel 2,72:1)
4. Die Werte stellt der Entwickler ein, das Kriterium ist das Maß. Gerechnete Startwerte (Hypothese, aus `kd-tokens.css` am 2026-11-06):
   - `--kd-on-accent` hell und dunkel Weiß (6,04 bzw. 4,67). Auf `--kd-accent-hover` hält Weiß hell 7,84, dunkel heute 3,65 (L 0,62); dunkel braucht `--kd-accent-hover` deshalb L ≤ 0,56 (Startwert L 0,52, dunkler als `--kd-accent` wie im hellen Thema: 5,54).
   - `--kd-on-mensch` hell Weiß (5,36), dunkel der Ton von `--kd-head` (7,54).
   - `--kd-on-agent` hell Weiß und `--kd-agent` hell von L 0,6 auf 0,55 (5,02; heute 4,08). Dunkel der Ton von `--kd-head` (7,71).
5. `--kd-head-link` ist die Linkfarbe auf `--kd-head`. Hell bleibt der Ton von heute (`--kd-accent-weak`, 11,49), dunkel ein heller Akzentton (Startwert oklch(0.85 0.06 255), 12,47; heute 1,55). Er ersetzt `--kd-accent-weak` an `.toast .lnk` (`web/kd-app.css:455`).
6. `--kd-warn` hell wird dunkler (Startwert L 0,52: mindestens 4,86 auf jeder Fläche seiner Paare; heute 4,27 auf `--kd-accent-weak` und 4,34–4,48 auf sechs Klassengründen). Dunkel bleibt er (mindestens 4,64).

### Modusleiste „Spalten einrichten“ (ADR-0011 Folgeentscheidung, hier entschieden)

7. Die Fläche der Modusleiste ist der Container des Akzents. Dafür gibt es drei neue Tokens:
   - `--kd-modus` hat den Wert von `--kd-accent-weak`; im dunklen Thema darf er dunkler sein, damit der Fokusring (Funktionale Anforderung 8) 3:1 hält. Gerechnet aus `kd-tokens.css` am 2026-11-06: `--kd-accent` auf `--kd-accent-weak` dunkel 2,72. Startwert (Hypothese): `--kd-modus` dunkel oklch(0.28 0.06 255) mit `--kd-accent` 3,13, `--kd-modus-text` 8,96, `--kd-muted` 6,34, `--kd-warn` 5,51;
   - `--kd-modus-text` hat den Wert von `--kd-accent-ink`;
   - `--kd-modus-linie` ist ein Akzentton für Ränder, Trenner und den unteren Abschluss der Leiste. Am unteren Abschluss ist sie eine Linie mit Zustand (sie grenzt den Modus vom Board ab) und hält 3:1 (Funktionale Anforderung 8); an Rändern und Trennern innerhalb der Leiste ist sie Verzierung.

   Die Leiste trägt `--kd-modus` (Material 3 primary-container), im hellen Thema hell, im dunklen Thema ein mittleres Blau über der dunklen Kopfzeile; erkennbar ist der Modus am Titel „Spalten einrichten“ und am Knopf „Fertig“ in `--kd-accent`.
8. In der Modusleiste gilt:
   - Titel, Board-Name, Dateipfad (`.mono`) und der Knopf „Verwerfen“ in `--kd-modus-text`; der Untertitel in `--kd-muted`; die Fehlerzeile `.fehl-kopf` in `--kd-warn`;
   - „Fertig“ als Füllung `--kd-accent` mit `--kd-on-accent`;
   - der Ich-Knopf mit Name in `--kd-modus-text` und Initiale in ihrem Füllungspaar;
   - Ränder in `--kd-modus-linie` statt `oklch(1 0 0 / …)` (`web/kd-app.css:57`, `:62`); dort Verzierung;
   - die Modusleiste schließt unten mit 1 px `--kd-modus-linie` ab; `--kd-modus-linie` hat in beiden Themen mindestens 3:1 gegen `--kd-modus` und gegen `--kd-sunken`. Probe: Unit-Paare `modus-linie/modus` und `modus-linie/sunken` ≥ 3,0 in Hell und Dunkel. Grund: die Fläche allein hebt sich nicht vom Board ab (UX-Vorprüfung, gerechnet aus `kd-tokens.css`: hell 1,03 gegen `--kd-sunken` und 1,11 gegen `--kd-bg`, dunkel 1,26–1,51);
   - die Knöpfe der Leiste zeigen den Tastaturfokus als Ring in `--kd-accent` (`.kz-modus .kz-btn:focus-visible`, heute ohne eigene Regel, also Browser-Standard); Probe: Unit-Paar `accent/modus` ≥ 3,0 in Hell und Dunkel (gerechnet heute 4,92 hell, 2,72 dunkel; siehe Funktionale Anforderung 7).
9. Gemessene Werte des Vorschlags (Werte aus `kd-tokens.css`): Titel 8,24 hell und 7,79 dunkel, Untertitel 5,32 und 5,51, Fehlerzeile mit `--kd-warn` nach Punkt 6 4,86 und 4,79. Heute misst der Titel dunkel 1,33 und der Untertitel 4,08 hell und 1,52 dunkel.

### `--kd-faint` ist keine Schrift (ADR-0011 Regel 4, je Stelle hier entschieden)

10. Diese 15 Stellen tragen Information und werden `--kd-muted`. Gezählt mit `grep -n "kd-faint" web/kd-app.css web/kd-base.css` am 2026-11-06; `--kd-muted` hält auf jeder neutralen Fläche, jedem Container und jedem Klassengrund mindestens 5,32 hell und 5,34 dunkel.

    | Stelle | Was | Grund |
    |---|---|---|
    | `web/kd-base.css:29` `.pk-0` | Initiale einer Anwendung ohne Person | Kürzel ist Inhalt |
    | `web/kd-app.css:70` `.bahn-kopf .v` | „Grenze 1“ und „überschritten“ im Spaltenkopf | Zustand |
    | `:95` `.leer` | Leertext („leer“) | Aussage über die Spalte |
    | `:96` `.dgrp` | Gruppenüberschrift | Gliederung |
    | `:168` `.wbs-aufgabe.arch` | archivierte Aufgabe am WBS-Knoten | bleibt bedienbar, nicht inaktiv |
    | `:172` `.org.leer` | Herkunft ohne Eintrag | Aussage |
    | `:174` `.ka .org` | Herkunft auf der Karte | Inhalt |
    | `:188` `.leg .rechts` | „Klick filtert · class:“ | Bedienhinweis |
    | `:220` `.menue .k` | Feldname im Filter-Baukasten („board“, „column“) | Beschriftung |
    | `:311` `.km .mono` | Kürzel im Menü | Bedienhinweis |
    | `:392` `.pal .nm` | „gewählt: …“ in der Palette | Zustand |
    | `:439` `.skala` | Stundenachse der Tagesleiste | Achsenbeschriftung |
    | `:600` `.km-k` | Tastenkürzel im Kontextmenü | Bedienhinweis |
    | `:606` `.km-e.an .kmenue.unter .km-k` | Kürzel im Untermenü | Bedienhinweis |
    | `:612` `.mod.neu .titel::placeholder` | Platzhalter im Titelfeld | WCAG zählt Platzhalter als Text |

11. Diese 5 Stellen bleiben `--kd-faint`. Sie stehen mit Grund in der Erlaubt-Liste des Unit-Tests:

    | Stelle | Was | Grund |
    |---|---|---|
    | `:78` `.bk-name .bk-klapp` | Symbol neben dem Spaltennamen (`aria-hidden`) | Verzierung, der Name trägt die Information |
    | `:210` `.iz.aus` | Agent oder stillgelegte Person im Ich-Menü (`aria-disabled="true"`) | inaktives Bedienelement, WCAG-Ausnahme |
    | `:523` `.diagramm .fadenkreuz` | `stroke` des Fadenkreuzes | Linie, Verzierung |
    | `:634` `.bf-chip` | `text-decoration-color` | Zustandslinie, faint ≥ 3:1 gegen bg (gerechnet 3,29 hell, 4,98 dunkel) |
    | `:743` `.wbs-zeile .trenner` | Trenner „›“ | Verzierung; optional `aria-hidden="true"` am Trenner (`web/ansicht.js:1234`), damit ein Vorleser ihn nicht ansagt |

### Übrige Schrift auf falscher Fläche (neue Befunde, nicht in der ADR)

12. `.ausruf` (`web/kd-app.css:457`): das „!“ im Warnungs-Toast und an WBS-Zeilen steht heute als `#fff` auf `--kd-wbs-error` (dunkel 2,63). Es wird zum Container-Paar: Fläche `--kd-wbs-error-bg`, Schrift `--kd-wbs-error-ink` (7,35 hell, 7,75 dunkel), dazu ein Ring von 1 px in `--kd-wbs-error` als Linie.
13. `.wl-phase`, `.wl-badge` und `.wl-fortschritt i` auf „Wie lange noch“ (`web/kd-app.css:672`, `:675`, `:677`): heute `hsl(var(--h) 55% 95%)` als Grund, gesetzt aus `web/ansicht.js:1102`/`:1111`. Im Dunkelthema liegt der Text dort bei 1,09–1,17:1. Neu:
    - `web/ansicht.js` setzt `--anteil` (0…1) statt `--h`;
    - der Grund ist `color-mix(in oklch, var(--kd-wbs-ok-bg) calc(var(--anteil) * 100%), var(--kd-wbs-error-bg))`, der Text `--kd-text`;
    - Rand und Fortschritt mischen `--kd-wbs-error` mit `--kd-wbs-ok`, das Abzeichen `--kd-wbs-error-ink` mit `--kd-wbs-ok-ink` auf seinem Grund.

    Gerechnet: Text hell 13,73–14,62, dunkel 10,21–10,58 bei Anteil 0, ½ und 1; Abzeichen mindestens 7,35.

### Kein Farbwert außerhalb der Tokens (ADR-0011 Regel 5)

14. In `web/kd-app.css`, `web/kd-base.css` und `web/*.js` steht in Farbeigenschaften (`color`, `background`, `border*`, `outline*`, `box-shadow`, `fill`, `stroke`, `text-decoration-color`, Custom Properties) kein Literal `#…`, `rgb(…)`, `hsl(…)`, `oklch(…)` mehr. Erlaubt sind `var(--…)`, `color-mix(…)` über Tokens und `transparent`/`none`/`inherit`/`currentColor`. Dafür wandern in die Tokens, je in beiden Dunkelblöcken:
    - der Abdunkler `.mod-bg` (`:222`) als `--kd-scrim`;
    - der Schatten `.mod` (`:223`) als `--kd-shadow-mod`;
    - der Streifen `.tagl i.l` (`:437`) als `color-mix` über `--kd-on-accent`;
    - die Diagrammfarben `--wl-1..3` (`:656`) als `--kd-wl-1..3` mit eigenem Dunkelwert. Hell misst `#1baf7a` auf `--kd-surface` 2,78 und `#eb6834` 3,16; das Maß ist 3:1;
    - der Rückfallwert `#2e7d32` an `.live-punkt` (`:683`) entfällt.

    Gezählt am 2026-11-06 mit `grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|hsla?\(" web/kd-app.css web/kd-base.css web/*.js`: 18 Zeilen, 3 in `kd-base.css` und 15 in `kd-app.css`; in `web/*.js` keine.
15. Nutzerfarben bleiben außerhalb (ADR-0011 Regel 7): `style="--sf:…"` und die Mischung `cv()` in `web/ansicht.js:367` setzen den Wert der Nutzerin, kein Literal der Oberfläche.

### Dunkelblöcke (ADR-0011 Regel 6)

16. `:root[data-theme="dark"]` und `@media (prefers-color-scheme: dark)` in `web/kd-tokens.css` setzen dieselben Tokens mit denselben Werten. Jede Änderung dieser Anforderung steht in beiden.

### Ein Kontrast-Helfer

17. `e2e/tests/hilfen.js` exportiert einen Helfer, der im Browser den Kontrast eines Elements misst:
    - Schriftfarbe gegen den ersten deckenden Grund darüber;
    - halbtransparente Gründe werden aufeinander verrechnet;
    - Farben werden über ein 1×1-Canvas nach sRGB aufgelöst.

    Dazu exportiert `hilfen.js` einen zweiten Helfer, der alle Verstöße unter einer Liste von Bereichen liefert. Der erste Helfer ersetzt die drei Kopien `e2e/tests/r00070-dark-mode.spec.js:13–20`, `e2e/tests/r00097-eigentuemer.spec.js:98–103` und `e2e/tests/r00100-bestand.spec.js:66–74`; deren Tests bleiben inhaltlich gleich und grün.

## Nicht-funktionale Anforderungen

- **Maß**: Schrift mindestens 4,5:1 (WCAG 2.1 SC 1.4.3), Linie mit Zustand mindestens 3:1 (SC 1.4.11), in `data-theme=light` und `data-theme=dark`. Ausnahme nur inaktive Bedienelemente mit `aria-disabled="true"` oder `disabled`.
- **Gestaltung**: Formen, Abstände, Schriftgrößen und Gestaltungsrichtung bleiben. Sichtbar ändern sich nur:
  - die Fläche der Modusleiste und ihr unterer Abschluss als Linie von 1 px;
  - die Initialen im Dunkelthema (dunkle Schrift);
  - „Neue Aufgabe“, wo Weiß die heutige Schrift `--kd-head-text` ersetzt;
  - die 15 bisherigen `--kd-faint`-Texte, nun etwas dunkler bzw. heller;
  - `.ausruf` als heller Kreis mit dunklem „!“;
  - der Grund der Blöcke auf „Wie lange noch“;
  - das Orange der Warnfarbe hell, eine Spur dunkler;
  - der Agentenzustand hell, eine Spur dunkler.
- **Geschwindigkeit**: die Unit läuft ohne Browser und ohne Server unter einer Sekunde (`node --test e2e/einheit/kontrast.test.js`).
- **Keine Abhängigkeit**: oklch → sRGB → WCAG im Test selbst gerechnet, keine Bibliothek.
- **Neutralität der Probe**: die E2E-Probe sammelt alle Verstöße und meldet sie mit Bereich, Thema, Element, Text und Wert, statt beim ersten abzubrechen.

## Akzeptanzkriterien

Grundbestand (herstellbar über die Dateien des Testordners mit `einrichten` aus `e2e/tests/hilfen.js` oder über die API):
- Board „entwicklung“ mit den Spalten „Zu erledigen“, „In Arbeit“ (Grenze 1) und „Erledigt“.
- Aufgaben:
  - #1 „eins“, Klasse `bug` (Palette rot), zuständig Stefan, fällig gestern, in „Zu erledigen“;
  - #2 „zwei“, zuständig Claude, Labels `ux` und `a:b`, ein Kommentar von Stefan („passt“);
  - #3 „drei“, Klasse `feature` (grün), zuständig Mia und Claude;
  - #4 „vier“ ohne Klasse und ohne Person;
  - #5 „fünf“, Klasse `bug`, zuständig Stefan, in „In Arbeit“.
- Personen: Stefan (ST) und Mia (MI) als Menschen, Claude (CL) als Agent, Anna (AN) stillgelegt. Stefan ist im Tab als „Ich“ gewählt.
- Klassen `bug` und `feature` in `kanbanD.md`, damit die Legende `.leg` unter dem Board erscheint.
- #2, #3 und #4 liegen in „Zu erledigen“; „Erledigt“ ist leer und zeigt den Leertext „leer“ (`.leer`, nicht der Hilfetext eines ganz leeren Boards).

Breite 1280 px. „Kontrast“ heißt das WCAG-Verhältnis der Schrift gegen den ersten deckenden Grund nach der Messregel in Funktionaler Anforderung 17. „Beide Themen“ heißt `data-theme=light` und `data-theme=dark`.

### Unit-Probe `e2e/einheit/kontrast.test.js`

- [ ] **Rechner**: `kontrast("oklch(1 0 0)", "oklch(0 0 0)")` ist 21,0 (auf eine Nachkommastelle), `kontrast("oklch(0.5 0.13 255)", "oklch(1 0 0)")` ist 6,0 (Rechenbeispiel aus den heutigen Tokens: `--kd-accent` hell gegen Weiß).
- [ ] **Paare**: jedes Paar der Paartabelle (Funktionale Anforderung 1) erreicht in beiden Themen sein Maß. Der Test meldet ein verfehltes Paar mit Name, Thema und Wert, z. B. `Modusleiste: --kd-modus-text auf --kd-modus, dunkel 1,33 < 4,5`.
- [ ] **Linien der Modusleiste**: die Paare `modus-linie/modus`, `modus-linie/sunken` und `accent/modus` erreichen in Hell und Dunkel je mindestens 3,0; `faint/bg` ebenso (Zustandslinie `.bf-chip`). Gegen heute meldet der Test mindestens `accent/modus` dunkel 2,72 (gerechnet).
- [ ] **Dunkelblöcke**: die beiden Dunkelblöcke setzen dieselbe Menge Tokens mit denselben Werten. Gegenbeispiel: ein Token nur im `@media`-Block oder mit anderem Wert → rot mit Name des Tokens.
- [ ] **Literale**: in `web/kd-app.css`, `web/kd-base.css` und `web/*.js` findet der Wächter kein Farbliteral nach Funktionaler Anforderung 14. Die Meldung nennt Datei und Zeile.
- [ ] **faint**: `--kd-faint` steht in `color:` nur an den 5 Selektoren der Erlaubt-Liste (Funktionale Anforderung 11).
- [ ] **Selbstprobe Paar**: ein im Test erzeugtes Paar `oklch(0.62 0.014 255)` auf `oklch(0.965 0.005 250)` (das heutige `--kd-faint` auf `--kd-bg`, 3,29) wird als Verstoß erkannt.
- [ ] **Selbstprobe Literal**: ein im Test an den Text von `web/kd-app.css` angehängtes `.x{color:#fff}` wird mit Zeilennummer erkannt; dasselbe mit `background:hsl(10 50% 50%)`.
- [ ] **Selbstprobe Dunkelblock**: ein im Test nur im `@media`-Block geänderter Wert wird erkannt.
- [ ] **Negativ gegen heute**: dieselben Prüfungen gegen den Stand `d9674e3` melden mindestens die Modusleiste (dunkel 1,33), die Initialen (`#fff` auf `--kd-mensch` dunkel 2,61, auf `--kd-agent` dunkel 2,55, hell 4,08; auf `--kd-accent-hover` dunkel 3,65), „Neue Aufgabe“ (dunkel 3,81), die 18 Literal-Zeilen und die 15 faint-Stellen. Belegt im Bericht des Entwicklers mit der Ausgabe.

### E2E-Probe `e2e/tests/kontrast.spec.js` (Abnahme-Probe der Karte #9)

Je Thema werden alle sichtbaren Elemente mit eigenem Text unter `header`, `.ka`, `.bahn-kopf`, `[role=dialog]` und `.toast` gemessen, außer Elementen in `[aria-disabled="true"]` bzw. `:disabled`. Jedes Ergebnis ist mindestens 4,5:1. Dazu kommen (Einarbeitung UX-Vorprüfung) die Bereiche `.leg`, `.leer` und `[role=menu]` in den Zuständen unten sowie der Platzhalter `::placeholder` im Titelfeld von „Neue Aufgabe“. Damit misst die Probe jede faint→muted-Stelle aus Funktionaler Anforderung 10 im Browser außer `.pal .nm` (`:392`, Einstellungen) und `.skala` (`:439`, Tagesleiste); diese beiden prüft die Unit über den faint-Wächter.

| Zustand | Bereiche | hell heute → Soll | dunkel heute → Soll |
|---|---|---|---|
| Board | `header`, `.ka`, `.bahn-kopf` | 2,63 (`.org.leer`), 4,08 (Initiale CL), 4,37 (Fälligkeit #1 auf Klasse rot) → ≥ 4,5 | 2,55 (Initiale CL), 2,61 (Initiale ST, MI), 2,98 (`.org.leer`), 3,81 („Neue Aufgabe“) → ≥ 4,5 |
| Spaltenkopf „In Arbeit“ mit „Grenze 1“ und Karte #1 dazu gezogen („überschritten“) | `.bahn-kopf` | 3,05 (`.v` auf `--kd-sunken`, gerechnet) → ≥ 4,5 | ≥ 4,5 bleibt |
| Aufgabenfenster #2 per Klick | `[role=dialog]` | 3,58 (`.org.leer`), 4,08 (CL) → ≥ 4,5 | 2,55 (CL), 4,40 (`.org.leer`) → ≥ 4,5 |
| Modusleiste über „Mehr“ → „Spalten einrichten“ | `header` | 4,08 (Pfad und Untertitel) → ≥ 4,5 | 1,33 (Titel, „Verwerfen“, Ich-Knopf), 1,52 (Pfad, Untertitel) → ≥ 4,5 |
| Modusleiste mit Fehler: `PUT /api/boards/entwicklung/spalten` über `page.route` mit 409 und einer Fehlermeldung beantwortet, dann „Fertig“ | `header` | `.fehl-kopf` heute Amber auf `--kd-accent-ink` 8,79; auf der neuen Fläche bliebe Amber bei 1,07 → mit `--kd-warn` ≥ 4,5 (gerechnet 4,86) | heute 8,12; Amber auf der neuen Fläche unter 1,1 → mit `--kd-warn` ≥ 4,5 (gerechnet 4,79) |
| Toast nach Ziehen von #2 nach „Erledigt“ (`#2 nach „Erledigt“`, „rückgängig“) | `.toast` | „rückgängig“ 11,49 (gerechnet) → ≥ 4,5 | „rückgängig“ 1,55 (gerechnet) → ≥ 4,5 |
| Warnungs-Toast nach Ziehen von #1 nach „In Arbeit“ über die Grenze (`#pruef-warnung`, wie `r00096-wip-grenze.spec.js`) | `.toast` | „!“ 4,71 (gerechnet) → ≥ 4,5 | „!“ 2,63 (gerechnet) → ≥ 4,5 |
| Menü „Mehr“ geöffnet (`#t-mehr`) | `[role=menu]` (`#pop.kz-menue`) | nicht gemessen → ≥ 4,5 | nicht gemessen → ≥ 4,5 |
| Menü „Berichte“ geöffnet (`#t-ber`, in der Stufe `compact` über `#t-seite`) | `[role=menu]` (`#pop.menue`, Gruppenköpfe `.k` „ZEITEN“ usw., `:220`) | `.k` faint auf `--kd-bg` 3,29 (gerechnet) → ≥ 4,5 | nicht gemessen → ≥ 4,5 |
| Kontextmenü von #1 per Rechtsklick, dann Eintrag „Klasse …“ (Untermenü offen, wie `r00033-kontextmenue.spec.js`) | `[role=menu]` (`#kmenue`, `.kmenue.unter`; Kürzel `.km-k` `:600`, `:606`) | nicht gemessen → ≥ 4,5 | nicht gemessen → ≥ 4,5 |
| Board, Spalte „Erledigt“ leer (vor dem Toast-Zustand) | `.leer` (`:95`) | faint auf Fläche der Spalte, nicht gemessen → ≥ 4,5 | nicht gemessen → ≥ 4,5 |
| „Neue Aufgabe“ (Taste `n`), Titelfeld leer | `.mod.neu .titel` mit `getComputedStyle(el, '::placeholder').color` gegen den Feldgrund (`:612`) | faint auf `--kd-surface` bzw. Feldgrund, nicht gemessen → ≥ 4,5 | nicht gemessen → ≥ 4,5 |

Werte „heute“ gemessen am 2026-11-06 im headless Chromium gegen `d9674e3`, außer den als gerechnet markierten (aus `kd-tokens.css`, oklch → sRGB → WCAG; Zeile Modusleiste mit Fehler ganz gerechnet). „nicht gemessen“: die fünf Zustände der Einarbeitung UX-Vorprüfung sind heute nicht gemessen; der rote Lauf gegen heute ist Teil von B0398.

- [ ] **Board**, beide Themen: jedes Element mit eigenem Text unter `header`, `.ka`, `.bahn-kopf` und `.leg` misst mindestens 4,5:1, darunter die Initialen ST, MI, CL, „Neue Aufgabe“, die Fälligkeit von #1, die Herkunft und „Klick filtert · class:“ in der Legende.
- [ ] **Grenze**: Spaltenkopf „In Arbeit“ mit „Grenze 1 · überschritten“, beide Themen, mindestens 4,5:1.
- [ ] **Fenster**: Aufgabenfenster #2 per Klick, beide Themen, jedes Element unter `[role=dialog]` mindestens 4,5:1, die Zeile „Stefan · <Zeit>“ des Kommentars (`.km .mono`) eingeschlossen.
- [ ] **Modusleiste**: nach „Mehr“ → „Spalten einrichten“, beide Themen, jedes Element unter `header` mindestens 4,5:1. Dazu sind Titel „Spalten einrichten“, Dateipfad, Untertitel, „Verwerfen“, „Fertig“ und der Ich-Knopf einzeln mit Wert im Testprotokoll genannt.
- [ ] **Modusleiste mit Fehler**: Fehlerzeile `.fehl-kopf` mit der Fehlermeldung sichtbar, beide Themen, mindestens 4,5:1.
- [ ] **Toast**: Toast mit „rückgängig“, beide Themen, jedes Element unter `.toast` mindestens 4,5:1.
- [ ] **Warnungs-Toast**: `#pruef-warnung` mit „!“ und Text „Grenze erreicht: …“, beide Themen, mindestens 4,5:1, das „!“ eingeschlossen.
- [ ] **Menü „Mehr“**: geöffnet über `#t-mehr`, beide Themen, jedes Element mit eigenem Text unter `[role=menu]` mindestens 4,5:1, die Zusätze `.muted` („Stefan“ bei „Ich bin …“) eingeschlossen.
- [ ] **Menü „Berichte“**: geöffnet über `#t-ber`, beide Themen, jedes Element unter `[role=menu]` mindestens 4,5:1, die Gruppenköpfe „ZEITEN“, „VERLAUF“, „BESTAND“, „AUSLEITEN“ eingeschlossen.
- [ ] **Kontextmenü**: Rechtsklick auf #1, dann „Klasse …“, beide Themen, jedes Element unter `#kmenue` mindestens 4,5:1, die Tastenkürzel `.km-k` im Menü und im offenen Untermenü eingeschlossen; Einträge mit `aria-disabled="true"` (`.km-aktuell`) sind ausgenommen.
- [ ] **Leere Spalte**: Board vor jedem Ziehen, Spalte „Erledigt“ leer, beide Themen, der Leertext „leer“ unter `.leer` mindestens 4,5:1.
- [ ] **Platzhalter**: „Neue Aufgabe“ per Taste `n`, Titelfeld leer, beide Themen: die Farbe aus `getComputedStyle(el, '::placeholder').color` gegen den ersten deckenden Grund des Felds mindestens 4,5:1.
- [ ] **Grenzwert**: der Helfer misst schwarzen Text auf `rgba(0,0,0,0)` über einem weißen Grund als 21:1. Ein Element mit `color: oklch(0.62 0.014 255)` auf `--kd-bg` hell misst 3,29 und wird gemeldet. Das ist die Gegenprobe, dass die Probe rot werden kann; sie läuft im Test als eigener Fall mit einem eingefügten Element.
- [ ] **Gegenbeispiel inaktiv**: im Ich-Menü sind „Claude“ und „Anna“ (`aria-disabled="true"`, `--kd-faint`) nicht gemeldet. „Stefan“ und „Mia“ werden gemessen und erreichen mindestens 4,5:1.
- [ ] **Ausnahmeliste**: sie steht im Test, startet leer und nimmt nur Verstöße auf, die zu #50 oder #55 gehören, je mit Kartennummer. Ist sie bei Abschluss nicht leer, nennt der Bericht jeden Eintrag.
- [ ] **Ein Helfer**: `grep -n "getImageData" e2e/tests/*.js` findet nur `e2e/tests/hilfen.js`. `r00070-dark-mode.spec.js`, `r00097-eigentuemer.spec.js` und `r00100-bestand.spec.js` sind grün.

### Paarungen am Element

- [ ] **Modusleiste**: `getComputedStyle(header.kz.modus).backgroundColor` entspricht `--kd-modus`, der Titel `--kd-modus-text`, „Fertig“ der Fläche `--kd-accent` mit Schrift `--kd-on-accent`. Verglichen über das Canvas, beide Themen.
- [ ] **Unterer Abschluss der Modusleiste**: `border-bottom-width` von `header.kz.modus` ist `1px`, `border-bottom-color` entspricht `--kd-modus-linie`, beide Themen. Gegenbeispiel: auf der Kopfzeile ohne Modus fehlt die Linie in `--kd-modus-linie`.
- [ ] **Initialen**: `.pk-m` hat die Schrift `--kd-on-mensch`, `.pk-a` die Schrift `--kd-on-agent`, beide Themen.
- [ ] **„Wie lange noch“**, dunkel: der Block einer Phase mit 0 von 3, 1 von 3 und 3 von 3 durchlaufen misst Text gegen Grund mindestens 4,5:1 (gerechnet mindestens 10,21). `style` der Section enthält `--anteil` und kein `--h`.

### Abnahme der Karte

- [ ] `node --test e2e/einheit/kontrast.test.js` ist grün, ebenso `npx playwright test kontrast` in `e2e/`.
- [ ] Wird in `web/kd-app.css` irgendwo `color:#fff` außerhalb der Tokens eingefügt, ist `node --test e2e/einheit/kontrast.test.js` rot und nennt Datei und Zeile. Nach dem Zurücknehmen ist er wieder grün.
- [ ] Alle bisherigen Unit- und E2E-Tests sind grün.

## Betroffene Verzeichnisstruktur

```
web/
  kd-tokens.css         geändert: on-Farben, head-link, modus (dunkel ggf. eigener Wert), modus-linie, scrim, shadow-mod, wl-1..3; warn und agent hell; beide Dunkelblöcke gleich
  kd-base.css           geändert: #fff → on-Farben (.btn-haupt, .pk, .lauf.eigen), .pk-0 → muted
  kd-app.css            geändert: Modusleiste (Fläche, unterer Abschluss 1 px, Fokusring der Knöpfe), faint → muted (14 Stellen), .toast .lnk, .ausruf, .wl-*, Literale → Tokens
  ansicht.js            geändert: --anteil statt --h an .wl-phase (:1102, :1111); optional aria-hidden am Trenner .trenner (:1234)
e2e/
  einheit/kontrast.test.js   neu: Rechner, Paartabelle, Wächter, Selbstproben
  tests/kontrast.spec.js     neu: Abnahme-Probe beider Themen (inkl. Menüs, Kontextmenü, leere Spalte, Platzhalter)
  tests/hilfen.js            geändert: Kontrast-Helfer
  tests/r00070-dark-mode.spec.js, r00097-eigentuemer.spec.js, r00100-bestand.spec.js   geändert: Helfer aus hilfen.js
Dokumentation/Architektur/A00009-oberflaeche.md   nur falls doch eine Abweichung von Regel 5 bleibt (Ziel: keine)
```

## Technische Überlegungen

Technik nach [ADR-0011](../Dokumentation/ADRs/0011-farbrollen-in-paaren-kontrast-als-probe.md), Option B, Architektur bestanden (Karte #9, Commit `d9674e3`).

### Ablauf

1. B0390 Unit-Probe: Rechner und Selbstproben grün. Paare, Dunkelblöcke, Literale und faint laufen als `todo` gegen den heutigen Stand rot (Negativ-Beleg), damit die Suite grün bleibt.
2. B0391 bis B0397 hängen je ihr Paar um. Jede Bubble streicht das `todo` an ihren Prüfungen. Sie sind nach B0390 parallel baubar, nur B0393 (Modusleiste) braucht B0391 (`--kd-on-accent` für „Fertig“) und B0392 (`--kd-warn` für die Fehlerzeile).
3. B0398 E2E-Probe und Helfer zuletzt. Sie wird grün, wenn B0391 bis B0396 grün sind.

Nach der letzten Bubble darf kein `todo` mehr in `kontrast.test.js` stehen.

### Grobentwurf

- Unit: `kd-tokens.css` als Text, drei Blöcke (hell, `@media`, `[data-theme=dark]`) über ihre Selektoren, `--kd-x:oklch(L C H)` und `var(--kd-y)` aufgelöst, `color-mix` nicht in den Paaren. oklch → OKLab → lineares sRGB → Gamut-Clip → WCAG-Leuchtdichte. Literal-Wächter über Regex je Zeile, Kommentare ausgenommen. faint-Wächter je Regel `selektor{…color:var(--kd-faint)…}`.
- E2E: der Helfer in `hilfen.js` wird per `page.evaluate` ausgeführt und liefert `[{bereich, element, text, wert}]` für alle Werte unter dem Maß. Thema über `page.emulateMedia({ colorScheme })` und `data-theme` (wie `r00070`).

### Gestaltung

Die Gestaltungsrichtung bleibt (`_wireframes.md`). Die Artboards sind DOM-Abzüge mit Token-CSS inline, `kd-tokens.css` liegt daneben. Nach dem Bau weichen D0002 bis D0007 in den Tönen ab; das ist ein Hinweis an den gestalter, kein Teil dieser Anforderung.

Die Modusleiste ändert ihr Aussehen sichtbar (Funktionale Anforderungen 7 und 8). Sie folgt dem M3-Vorschlag der Karte #9 (primary-container). Diese Gestaltung zeigt noch kein Artboard. Deshalb bekommt D0002 vor dem Bau der Modusleiste einen angehängten Zustand „Modusleiste als Akzent-Container“, wie bei Preisetikett und Eigentümer (PO-Entscheidungen Z. 54, 75, 76). Der Zustand zeigt die Leiste in Hell und Dunkel mit Fläche, Titel, Untertitel, Fehlerzeile, „Fertig“, „Verwerfen“, Ich-Knopf, unterem Abschluss und dem Fokusring an einem Knopf. Der Mensch gibt ihn frei, bevor die Modusleiste gebaut wird; die Freigabe wartet in „Ohne Mensch nicht lösbar“. Alles andere in dieser Anforderung darf vorher gebaut werden.

### Umfang

I0096: 9 Bubbles, kein Feature, 8–18 h (vor der Einarbeitung UX-Vorprüfung 7,5–17 h).
- Herleitung: Summe der Bubble-Spannen (B0390 1-3, B0391 1-2, B0392 0,5-1, B0393 1-2, B0394 0,5-1, B0395 0,5-1, B0396 1-2, B0397 1-2, B0398 1,5-4).
- Einarbeitung UX-Vorprüfung: B0398 von 1-3 auf 1,5-4 (fünf Zustände und der Platzhalter mehr, Hypothese: je Zustand ein Aufbau nach vorhandenem Muster); B0390 (vier Paare mehr, nur Daten) und B0393 (eine Linie, ein Fokusring, ggf. ein Dunkelwert) bleiben in ihrer Spanne; B0395 (optional ein Attribut) ebenso. Keine neue Bubble, weil keine über 4 h wächst.
- Die Spannen folgen dem Muster von I0095 (13 Bubbles, 11–25 h) und sind ungemessen (Hypothese).
- Gezählte Eingänge: 18 Literal-Zeilen, 20 faint-Stellen (15 umgehängt, 5 erlaubt), 9 feste `#fff` in 8 Zeilen (davon `.ausruf` nach Funktionaler Anforderung 12), 3 Kontrast-Helfer.

## Tests
Nach Skill `test-pyramide`. Jede US-Szene wird ein Test, jeder Test prüft einen gemessenen Wert (Skill `test-ehrlichkeit`).

**Unit**, `e2e/einheit/kontrast.test.js`:
- Rechner mit Weiß/Schwarz und einem heutigen Token.
- Jedes Paar beider Themen.
- Dunkelblöcke gleich.
- Literal-Wächter mit Datei:Zeile.
- faint-Wächter mit Erlaubt-Liste.
- Selbstproben: schlechtes Paar, `#fff`, `hsl()`, abweichender Dunkelblock.
- Linien-Paare der Modusleiste und `faint/bg` je Thema mit 3,0.
- Erster roter Test: „Paar Modusleiste dunkel ≥ 4,5“. Er läuft heute als `todo` mit 1,33.

**Integration:** entfällt; der Server ändert sich nicht.

**E2E**, `e2e/tests/kontrast.spec.js`, gegen das laufende Programm auf freiem Port (`kanbanStarten`):
- US-1 bis US-5 und US-7 bis US-9, je Zustand beide Themen; US-6 als Selbstprobe der Unit;
- dazu der Grenzwert-Fall mit eingefügtem Element;
- dazu das Gegenbeispiel „inaktiv“.

Bestehende Tests `r00070`, `r00097`, `r00100` mit dem gemeinsamen Helfer.

## Abhängigkeiten

- ADR-0011 (Akzeptiert); R00070 Dunkelthema; R00054 WBS-Ampel (Tokens `--kd-wbs-*`); R00058 „Wie lange noch“ (`.wl-*`); R00009 Spalten einrichten (Modusleiste); R00096 WIP-Grenze (Warnungs-Toast).
- Abgegrenzt, nicht Teil dieser Anforderung:
  - **#50**: Σ und Datum auf heller eigener Klassenfarbe im Dunkelthema. Eigene Nutzerfarben, ADR-0011 Regel 7; die E2E-Probe nutzt nur Paletten-Klassen.
  - **#51**: Farbfeld „ohne Klasse“ (Größe, Rand).
  - **#55**: Ränder von `.btn` und Select. Den Punkt „Amber als Textfarbe“ aus #55 erledigt diese Anforderung voraussichtlich mit. Laut `grep "color:var(--kd-c-amber)" web/*.css` ist `.fehl-kopf` (`web/kd-app.css:478`) die einzige Amber-Schrift. Sie steht nur in der Modusleiste, deren Fläche hier wechselt (Funktionale Anforderung 8). Die Zeilenangabe `:828` in #55 zeigt heute auf `.tm-ziel.an` in `--kd-accent-ink`; ob #55 dieselbe Stelle meint, klärt die Durchsicht von #55.
  - **Ausweitung der E2E-Probe** auf alle Sichten (Liste, WBS, Berichte, Einstellungen, „Wie lange noch“): spätere Karte, sobald #50 und #55 durch sind (ADR-0011 Folgeentscheidungen). Hier deckt die Unit-Probe die Paare dieser Sichten ab.

## Offene Fragen

- Keine blockierende. Fläche der Modusleiste und die faint-Stellen sind entschieden (Funktionale Anforderungen 7–11). Begründung und Alternativen stehen in den Notizen; ein abweichender Wunsch des Betreibers ändert nur Token-Zuordnungen.

## Manuelle Vorbereitungstätigkeiten
Keine.

## Manuelle Nachbereitungstätigkeiten
Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Befunde der Karte #9 haben eine gemeinsame Ursache: Schrift steht auf einer Fläche, für die kein Kontrast versprochen ist. Die Paartabelle macht jedes Versprechen ausdrücklich, und die Unit rechnet es in beiden Themen nach. Ein neuer Ton bricht damit kein Paar unbemerkt. Der Literal-Wächter schließt den Weg, auf dem die Befunde entstanden: ein festes `#fff` neben einem Token, das im Dunkelthema hell wird. Die E2E-Probe misst, was die Unit nicht sieht, also gemischte Flächen, Transparenz und Klassentönung, an den fünf Bereichen der Abnahme-Probe und, seit der Einarbeitung der UX-Vorprüfung, an Legende, leerer Spalte, Menüs und Platzhalter. Die Linie unter der Modusleiste trennt den Modus vom Board, auch wo die Flächen fast gleich hell sind. Alle heute gemessenen Verstöße in diesen Bereichen sind einer Funktionalen Anforderung zugeordnet: Initialen 3–4, „Neue Aufgabe“ 3, Fälligkeit 6, Modusleiste 7–9, faint 10, Toast 5 und 12.

## Missing-Docs
- `A00009-oberflaeche.md` beschreibt Regel 5 noch als Soll. Nach dem Bau nennt der Entwickler die Paartabelle und den Wächter dort; Abweichungen keine.
- Kein Glossareintrag für „Modusleiste“ und „Thema“ in `Dokumentation/Domaenenwissen/`; die Begriffe sind hier über Selektoren eindeutig.

## Notizen
- **Abnahme-Probe der Karte #9**, wörtlich: „Ein Skript misst alle Paare aus Textfarbe und Hintergrund unter `header`, `.ka`, `.bahn-kopf`, `[role=dialog]` und `.toast` in `data-theme=light` und `dark`; jedes Paar ist ≥ 4,5:1.“ Sie steht als E2E-Probe in den Kriterien. Zusätzlich verlangt der Auftrag die Unit-Probe und das rote `#fff`.
- **Messung 2026-11-06**:
  - Werkzeug: headless Chromium aus `e2e/node_modules` gegen `target/release/kanbanD` auf freiem Port, eigener Testordner, Grundbestand wie oben. Messregel wie Funktionale Anforderung 17.
  - Gerechnete Werte aus `kd-tokens.css`: oklch → sRGB → WCAG in Node.
  - Beide Wege bestätigen die Werte der ADR (1,33; 2,61; 2,55; 3,81; 4,08).
  - Der Browser liegt bis 0,01 über der Rechnung: das 1×1-Canvas (Funktionale Anforderung 17) rundet jeden Kanal auf 8 Bit. Nachgerechnet (Review 2026-11-06, oklch → sRGB → WCAG ohne Rundung wie `kontrast()` der Unit): Weiß auf `--kd-agent` hell 4,0799, `--kd-head-muted` auf `--kd-accent-ink` hell 4,0833; mit 8-Bit-Kanälen je 0,01 mehr. Die Anforderung nennt durchgehend den gerechneten Wert. Ebenso vereinheitlicht (Director 2026-11-06): Untertitel dunkel 1,52 (exakt 1,519) und „Neue Aufgabe“ dunkel 3,81 (exakt 3,806); für „Neue Aufgabe“ erklärt die 8-Bit-Rundung die frühere Browserangabe nicht, die Browsermessung liefert der Entwickler nach.
- **Entscheidung Modusleiste**: Akzent-Container statt einer dunklen Fläche.
  - Verworfen: `--kd-accent` als Fläche mit `--kd-on-accent`. Dunkel misst das nur 4,67, und die Leiste hätte zwei Knöpfe auf gleicher Füllung.
  - Verworfen: `--kd-head` mit eigenem Akzentstreifen. Der Modus wäre dann kaum von der normalen Kopfzeile zu unterscheiden.
  - Der Container hält die Schrift dunkel wie hell bei mindestens 7,79, und der Markenton bleibt.
- **Entscheidung faint**: Information ist, was ohne Text verloren geht (Zähler, Herkunft, Kürzel, Achse, Platzhalter); entbehrlich ist, was ein Nachbar schon sagt (Symbol neben Namen, Trenner) oder was inaktiv ist. `.wbs-aufgabe.arch` zählt zu Information: archiviert ist nicht inaktiv, der Link bleibt bedienbar.
- **Bewusst außerhalb**:
  - neue Formen;
  - eine Umstellung auf `light-dark()` (ADR-0011 Regel 6);
  - Nutzerfarben (#50, #51);
  - Ränder von Bedienelementen (#55);
  - alle Sichten in der E2E-Probe (spätere Karte).
- **Verworfene Alternativen (Schnitt)**:
  - je Bereich eine Anforderung: die Paare teilen Tokens und Proben, die Karte hat eine Abnahme;
  - Schnitt nach Schichten (erst Tokens, dann CSS, dann Tests): nicht von außen prüfbar.
- **Detailplanung:** WBS I0096 (B0390–B0398), 2026-11-06.
- **Einarbeitung UX-Vorprüfung 2026-11-06** (Karte #9, bestanden mit 2 Sollte- und 3 Optional-Lücken, alle eingearbeitet):
  - Sollte 1: FA 7 neu gefasst. Statt „hell und blau getönt“ gilt jetzt der Wortlaut der Vorprüfung (dunkel ein mittleres Blau, Modus erkennbar an Titel und „Fertig“); US-4 ebenso.
  - Sollte 2: FA 8 um den unteren Abschluss erweitert (1 px `--kd-modus-linie`, ≥ 3:1 gegen `--kd-modus` und `--kd-sunken`). FA 7 nennt `--kd-modus-linie` dort als Linie mit Zustand statt „reine Verzierung“. Linien-Paare in FA 1, Unit-Kriterium „Linien der Modusleiste“ und Paarung „Unterer Abschluss“ neu.
  - Optional 3: E2E um Menü „Mehr“, Menü „Berichte“, Kontextmenü mit Untermenü und leere Spalte erweitert, dazu `.leg` im Board und der Kommentar an #2 im Grundbestand. Abweichung vom Wortlaut der Vorprüfung: „`.menue`“ ist im Code das Menü „Berichte“ (`web/ansicht.js:779`), das Menü „Mehr“ ist `#pop.kz-menue` (`:128`). „`.km`“ ist der Kommentar im Aufgabenfenster (`:295`), das Kontextmenü einer Karte ist `#kmenue` (`:546`). Gemessen werden deshalb beide Menüs, das Kontextmenü und der Kommentar.
  - Optional 4: Platzhalter-Messung über `::placeholder` als eigenes Kriterium.
  - Optional 5: Fokusring `accent/modus` ≥ 3:1. Gerechnet heute dunkel 2,72, deshalb darf `--kd-modus` dunkel von `--kd-accent-weak` abweichen (FA 7, Startwert gerechnet). Dazu `.bf-chip` neu begründet und das Paar `faint/bg` in FA 1 aufgenommen. `aria-hidden` am Trenner ist optional in FA 11.
  - Zählung: 26 → 33 Akzeptanzkriterien (7 neu; im Wortlaut geändert Board und Fenster, über FA 1 und FA 7/8 inhaltlich erweitert Paare und Modusleiste; keines gestrichen). User Story: US-4 und der Grundbestand angepasst, US-8 und US-9 neu. WBS: B0390, B0393, B0395 und B0398 nachgezogen, B0398 1-3 → 1,5-4, Summe 7,5–17 → 8–18 h.
  - Nachprüfung gegen die PO-Entscheidungen (2026-11-06): Die Modusleiste ist neue Gestaltung, die kein Artboard zeigt. Nach Z. 75 und 76 gilt die Leitplanke „Der Mensch sieht jede Gestaltung, bevor sie gebaut wird“ ohne Ausnahme. Abschnitt „Gestaltung“ verlangt deshalb jetzt den Zustand an D0002 und die Freigabe vor dem Bau der Modusleiste. Vorher stand dort nur ein Hinweis an den gestalter nach dem Bau. Der Fokusring in `--kd-accent` folgt dem Muster aus R00106 (Funktionale Anforderung zum Fokusring, `outline: 2px solid var(--kd-accent)`). Er gilt nur für die Knöpfe der Leiste, die diese Anforderung neu einfärbt, wie Z. 88 eine Korrektur auf die gebaute Komponente beschränkt. Der abweichende Dunkelwert von `--kd-modus` bleibt ein einziger Wert in `kd-tokens.css` (Z. 17, 54). Der Grundbestand gilt nur für diese Anforderung, R00100 hat einen eigenen.
- **Einarbeitung Rechtschreib- und UX-Review 2026-11-06** (Karte #9):
  - Paar `--kd-accent-hover` ↔ `--kd-on-accent` in FA 1 (Füllung, Zustand Hover) und in „Negativ gegen heute“ (dunkel 3,65 gerechnet, im Browser an `.btn-haupt:hover` im Zustand „Anlegen“ 3,64 gemessen); Startwert in FA 4. Weitere Zustands-Tokens (`*-hover`, `*-active`) gibt es in `web/kd-tokens.css` nicht; die übrigen Hover-Gründe mit Schrift (`--kd-sunken`, `--kd-accent-weak`, `--kd-surface`, `--kd-accent`) stehen schon in der Tabelle.
  - „in Hell und Dunkel“ einheitlich (FA 8 zweimal, Unit-Kriterium „Linien der Modusleiste“); Aufzählung in FA 8 klein; FA 17 zweiter Helfer als eigener Satz.
  - Initiale CL und Untertitel hell einheitlich 4,08 (vorher stand in der Beschreibung und der E2E-Tabelle der um 0,01 höhere Browserwert); Herleitung unter „Messung“.
  - Kein Akzeptanzkriterium neu oder gestrichen.
- **Kriterium nachgezogen 2026-11-11** (R00135, Karte #67): Der Zustand **Hover** des Paares `--kd-accent-hover` ↔ `--kd-on-accent` gilt auch an den beiden Hauptknöpfen `.kz-modus .kz-btn.haupt` („Fertig“ in der Modusleiste, `web/kd-app.css:81`) und `.kz-btn.neu-btn` („+ Neue Aufgabe“ in der Kopfzeile, `:691`). Beide waren spezifischer als `.kz-btn:hover` bzw. standen später in der Kaskade und behielten im Hover die Ruhefläche `--kd-accent` (UX-Review der Karte #9). Ausgeführt in R00135 (eigene Interaction unter D0002, Härtungsregel `AI-Team/gelerntes.md` 2026-11-11). Die Paartabelle und die Probe ändern sich nicht — der Ton war korrekt, nur nicht angewandt.
