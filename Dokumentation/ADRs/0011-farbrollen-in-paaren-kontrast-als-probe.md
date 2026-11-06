# ADR-0011: Farbrollen in Paaren, Kontrast als Probe

**Status**: Akzeptiert
**Datum**: 2026-11-06
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #9)
**Kontext-Anforderung**: — (Karte #9 „Kontrast-Tokens in beiden Themen auf 4,5:1 heben“; Anforderung legt der planer an)
**Erprobt durch**: Nachrechnung der Token-Paare aus `web/kd-tokens.css` ohne Browser (oklch → sRGB → WCAG-Kontrast, Python-Standardbibliothek, 2026-11-06, Stand kanbanD `cf1dbac`): reproduziert alle Dunkel-Werte der Karte auf zwei Stellen (1,33 · 1,52 · 2,61 · 2,55 · 3,81) und die Initiale CL hell (4,08); die beiden Dunkelblöcke sind heute gleich.

## Kontext

- Belegt (Code): `web/kd-tokens.css` nennt sich „Einziger Ort der Gestaltungswerte“ (Z. 1). Die Tokens haben aber **keine erklärte Paarung** von Fläche und Schrift; welche Schriftfarbe auf welcher Fläche steht, entscheidet jede Regel in `web/kd-app.css`/`kd-base.css` für sich.
- Belegt (Code), die Befunde der Karte sind Rollenfehler, keine Tonfehler:
  - Modusleiste: `.kz.modus{background:var(--kd-accent-ink)}` (`web/kd-app.css:56`) — ein **Schrift**-Token als Fläche, darauf `--kd-head-text` bzw. `--kd-head-muted`. Im Dunkelthema ist `--kd-accent-ink` hell (0.84) → 1,33:1 und 1,52:1. Hell hält der Text (8,23), der Untertitel nur 4,08 (nicht in der Karte, gleiche Ursache).
  - Initialen: `.pk{color:#fff}` fest (`web/kd-base.css:28`) auf `--kd-mensch`/`--kd-agent`, die im Dunkelthema heller werden → 2,61 und 2,55; hell Agent 4,08.
  - „Neue Aufgabe“: `--kd-head-text` auf `--kd-accent` (`web/kd-app.css:611`) → dunkel 3,81.
  - Weiter feste Schriftfarbe `#fff` auf Token-Flächen: `web/kd-base.css:16`, `:32`, `web/kd-app.css:148`, `:327`, `:457`, `:579`, `:598`.
- Belegt (Rechnung): `--kd-warn` und `--kd-faint` halten auf den **reinen** Token-Flächen andere Werte als in der Karte (warn hell 4,74–5,17, faint hell 3,29–3,59). Die Kartenwerte (warn 4,06–4,40, faint ab 2,92) entstehen auf **gemischten** Flächen — getönter Kartengrund `color-mix(… var(--c))`, Signalgrund (`web/kd-app.css:107–108`), `--kd-sunken`. Eine Prüfung nur der Token-Paare übersieht sie.
- Belegt (Code): `--kd-faint` steht an 20 Stellen als Schriftfarbe (u. a. `.bahn-kopf .v`, `.leer`, `.dgrp`, `.ka .org`, `.menue .k`, `.km-k`, Platzhalter `web/kd-app.css:612`).
- Belegt (Code): der Dunkelsatz steht **zweimal** wörtlich in `web/kd-tokens.css` (System-Wahl im `@media` Z. 46–75 und erzwungen `:root[data-theme="dark"]` Z. 76–105). Jede Tonänderung dieser Karte muss in beide.
- Belegt (Code): Kontrast wird heute in drei Specs mit drei eigenen Helfern gemessen (`e2e/tests/r00070-dark-mode.spec.js:14–20`, `r00097-eigentuemer.spec.js:98`, `r00100-bestand.spec.js:66–72`); der Helfer aus #6 löst über ein 1×1-Canvas nach sRGB auf, überspringt aber halbtransparente Gründe nicht korrekt (er sucht nur „ganz transparent“).
- Zwänge: zentraler Stil des Projekts (Blaugrau, eckig, dicht) geht vor M3 (`gemeinsam/regeln.md` „Gestaltung“ der Factory); M3-Farbrollen sind Referenz, nicht Vorlage. PO: eine Regel an genau einem Ort (`AI-Team/po-entscheidungen.md:17`, zentrales Maß statt Einzelwerte); Etikett ≥ 4,5:1 auch auf jedem getönten Klassengrund (`:99`). Kein Build-Schritt (`A00009`).

Die Klasse des Fehlers ist „eine Schriftfarbe steht auf einer Fläche, für die niemand ihren Kontrast versprochen hat“ — nicht „ein Ton ist zu hell“. Neue Elemente erzeugen sie wieder, solange es keine Paarung und keine Probe gibt.

## Optionen

### Option A: Töne nachstellen, Probe der Karte
Die genannten Tokens heller bzw. dunkler stellen, `--kd-faint`-Stellen auf `--kd-muted` umhängen, die Abnahme-Probe der Karte (fünf Bereiche, zwei Themen) dazulegen.
- Vorteile: kleinste Änderung; die Karte ist in wenigen Stunden grün.
- Nachteile: lässt den Rollenfehler stehen — `--kd-accent-ink` bleibt zugleich Schrift und Fläche, ein Nachstellen für die Modusleiste verschlechtert dann den Akzent-Text anderswo. Die Probe misst nur die fünf Bereiche der Karte; das nächste Element außerhalb fällt erst in der nächsten UX-Durchsicht auf.
- Schwäche: behebt Werte, nicht die Klasse.

### Option B: Farbrollen in Paaren in `kd-tokens.css`, zwei Proben
Jede Fläche hat ihre On-Farben als erklärtes Paar in `web/kd-tokens.css`; Schrift steht nur in einer On-Farbe ihrer Fläche. Durchgesetzt durch eine reine Node-Probe der Paartabelle und eine E2E-Messung der wirklich gezeichneten Paare.
- Vorteile: schließt die Klasse; die Paartabelle ist eine Aussage pro Paar statt pro CSS-Regel und rechnet ohne Browser in Millisekunden (Probe oben: gleiche Werte wie der Browser). Hausname bleibt (`-ink`, `-text`, `-muted`), M3-Rollen sind nur die Zuordnung. Kein Build-Schritt.
- Nachteile: einige neue Tokens (On-Farben der Füllungen, Fläche der Modusleiste); alle `#fff` und alle Schrift-`--kd-faint` müssen umgehängt werden — die Karte wird größer als ein Tonwechsel. Gemischte Flächen (`color-mix`) kann die Node-Probe nicht rechnen; dafür braucht es die E2E-Messung.
- Schwäche: zwei Proben statt einer; die E2E-Messung ist so gut wie ihre Abdeckung der Sichten.

### Option C: Schriftfarbe aus der Fläche berechnen
Schrift auf Füllungen wählt sich selbst — CSS `contrast-color()` bzw. relative Farbsyntax, oder eine JS-Funktion, die je Fläche Schwarz oder Weiß setzt. Deckt auch frei gewählte Klassen- und Spaltenfarben der Nutzer.
- Vorteile: kein Paar muss gepflegt werden; eigene Farben der Nutzer sind automatisch lesbar.
- Nachteile: `contrast-color()` wählt nur Schwarz oder Weiß und ist nicht in allen aktuellen Browsern ausgeliefert (nicht geprüft — wäre eine eigene Probe); die Markentöne (`--kd-accent-ink`, `--kd-agent-ink`) gingen auf Schrift verloren. Die JS-Variante legt Gestaltung in `render()` und läuft bei jedem Neuzeichnen (ADR-0007). Löst `--kd-faint` und `--kd-warn` auf neutralen Flächen nicht — das sind keine Füllungen.
- Schwäche: tauscht einen gestalteten Stil gegen einen errechneten und deckt nur einen Teil der Befunde.

### Option D: Farbschema vollständig nach M3 aus einer Quellfarbe erzeugen
Alle Farbtokens aus einem M3-Schema (Material Theme Builder, Tonal Palettes) ersetzen; die Rollen und Kontraste garantiert das Schema.
- Vorteile: Rollen und Paarung sind fertig durchdacht, Kontraste vom Werkzeug garantiert.
- Nachteile: ersetzt den zentralen Stil (Blaugrau, eckig, dicht, 16 Klassenfarben gleicher Helligkeit) durch ein Fremdschema — gegen „zentraler Stil vor M3“; ändert das Aussehen der ganzen Oberfläche statt der Befunde; die Klassenpalette und die WBS-Ampel hätten im Schema keine Rolle.
- Schwäche: eine Richtungsentscheidung über das Aussehen, die die Karte nicht verlangt.

## Entscheidung

**Gewählt: Option B** — Farbrollen in Paaren, der Ort ist `web/kd-tokens.css`, durchgesetzt durch zwei Proben.

B schließt den Rollenfehler, der hinter allen Befunden der Karte steht, ohne den Stil zu wechseln (D) oder Gestaltung zu errechnen (C). Bewusst in Kauf genommen: die Karte wird größer als ein Tonwechsel, und es gibt zwei Proben. A bleibt als Weg für einen einzelnen Ton innerhalb eines Paares.

Regeln:

1. **Rollen.** Jede Farbe in `web/kd-tokens.css` ist entweder **Fläche**, **Schrift (On-Farbe)** oder **Linie/Verzierung**; die Rolle steht im Namen oder im Kommentar des Blocks. Ein Schrift-Token wird nie Fläche und umgekehrt (heute verletzt: `.kz.modus` auf `--kd-accent-ink`).
2. **Paare** (Hausnamen; M3-Rolle in Klammern nur als Zuordnung):
   - neutrale Flächen `--kd-bg`, `--kd-surface`, `--kd-sunken` ↔ `--kd-text`, `--kd-muted`, `--kd-warn`, `--kd-accent-ink`, `--kd-mensch`, `--kd-agent-ink` (surface / on-surface, on-surface-variant, error, primary);
   - Container `--kd-<rolle>-weak` ↔ `--kd-<rolle>-ink` (…-container / on-…-container) — wie heute bei Akzent und Agent;
   - Füllung `--kd-<rolle>` ↔ **`--kd-on-<rolle>`** (neu, für Akzent, Mensch, Agent; ersetzt jedes feste `#fff`) (primary / on-primary);
   - Kopf `--kd-head` ↔ `--kd-head-text`, `--kd-head-muted`;
   - Modusleiste bekommt ein eigenes Flächen-Paar (z. B. Container des Akzents mit seinen On-Farben); welches, entscheidet der planer mit ux — die Regel verlangt nur, dass es ein erklärtes Paar ist;
   - Klassen- und WBS-Gründe (`--kd-c-*`, `--kd-wbs-*-bg`) ↔ `--kd-text`, `--kd-muted`, `--kd-warn` bzw. die `-ink` der Ampel.
3. **Maß**: Schrift ≥ 4,5:1 in beiden Themen (WCAG 1.4.3); Linie und Verzierung, die einen Zustand trägt, ≥ 3:1 (WCAG 1.4.11). Ausnahme nur inaktive Bedienelemente (WCAG-Ausnahme), ausgewiesen über `aria-disabled`/`disabled`.
4. **`--kd-faint` ist Linie/Verzierung, keine Schrift.** Wo es heute Schrift ist (20 Stellen), wird es `--kd-muted` oder ein Paar mit eigener Prüfung; ob ein Text informationstragend oder entbehrlich ist, entscheidet der planer je Stelle, nicht die Farbe.
5. **Kein Farbwert außerhalb von `web/kd-tokens.css`** in `color:` oder `background:` der übrigen Stylesheets und in `style=`-Attributen der Vorlagen — außer `var(--…)`, `color-mix(…)` über Tokens und `transparent`/`none`/`inherit`. Bestehende Literale (`#fff` s. o., `oklch(1 0 0 / …)` an Linien `web/kd-app.css:57`, `:62`, `:437`, Diagrammfarben `--wl-*` `:656`) wandern in Tokens oder stehen als Abweichung in `A00009`.
6. **Ein Dunkelsatz, zwei Selektoren**: die beiden Dunkelblöcke bleiben (keine Umstellung auf `light-dark()` — prozentuale Tokens wie `--kd-klasse-anteil` lassen sich damit nicht umschalten), müssen aber Token für Token gleich sein.
7. **Eigene Farben der Nutzer** (Klassen, Spalten) liegen außerhalb der Paartabelle. Was für ihre Mischungen gilt, entscheidet Karte #50 bzw. #51; bis dahin misst die E2E-Probe die 16 Farben der Palette.

## Konsequenzen

**Positiv:**
- Jeder Befund der Karte ist eine verletzte Regel 1, 2 oder 4 — die Behebung ist ein Umhängen auf ein Paar, kein Raten nach Tönen.
- Ein neuer Ton wird an einer Stelle geändert und an allen Paaren in beiden Themen in Millisekunden geprüft.
- Die drei Kontrast-Helfer in den Specs werden einer.

**Negativ / In Kauf zu nehmen:**
- Neue Tokens (`--kd-on-*`, Modusleiste) und viele kleine CSS-Änderungen; das Aussehen ändert sich sichtbar an Modusleiste, Initialen und allen bisherigen `--kd-faint`-Schriften.
- Die Paartabelle muss gepflegt werden; ein Paar, das niemand einträgt, prüft nur die E2E-Probe.
- Gemischte Flächen und eigene Nutzerfarben sind nur so gut geprüft wie die E2E-Abdeckung.

**Durchsetzung** (Makro-Regel für die ganze Oberfläche):
- **Node-Unit `e2e/einheit/kontrast.test.js`** (erster Test, rein, kein DOM, kein Server): Eingabe `web/kd-tokens.css` als Text plus die Paartabelle als Daten im Test; Ausgabe je Paar und Thema das Verhältnis aus oklch → sRGB; prüft (a) jedes Paar nach Regel 3, (b) beide Dunkelblöcke Token für Token gleich (Regel 6), (c) keine Farbliterale nach Regel 5 in `web/kd-app.css`, `web/kd-base.css`, `web/*.js`, (d) kein `--kd-faint` als `color:` außer an erlaubten Selektoren (Liste im Test, Regel 4). Selbstproben wie in `e2e/einheit/fokus.test.js`: ein absichtlich schlechtes Paar und ein `#fff` werden erkannt. Vorab negativ gegen heute (`cf1dbac`: Modusleiste, Initialen, „Neue Aufgabe“ rot) und positiv gegen das Ziel.
- **E2E `e2e/tests/kontrast.spec.js`** (die Abnahme-Probe der Karte, dauerhaft): in `data-theme=light` und `dark` je sichtbares Element mit eigenem Text unter `header`, `.ka`, `.bahn-kopf`, `[role=dialog]`, `.toast` Schrift gegen den ersten deckenden Grund darüber, halbtransparente Gründe aufeinander verrechnet, alles über das 1×1-Canvas nach sRGB; ≥ 4,5:1. Der Helfer liegt einmal in `e2e/tests/hilfen.js` und ersetzt die drei Kopien. Bekannte Verstöße außerhalb der Karte (#50, #55) stehen als Ausnahme mit Kartennummer im Test und verschwinden mit ihrer Karte.
- **Review-Punkt** für architektur-reviewer und code-reviewer: neuer Farbwert außerhalb von `kd-tokens.css`, Schrift auf einer Fläche ohne Eintrag in der Paartabelle, `--kd-faint` als Schrift — je ein Befund.

**Folgeentscheidungen / Aufgaben:**
- [ ] Anforderung aus Karte #9 nach dieser ADR (planer): Paare nach Regel 2, Umhängen nach 4 und 5, beide Proben.
- [ ] Fläche der Modusleiste und Ersatz je `--kd-faint`-Stelle (planer mit ux).
- [ ] Ausweitung der E2E-Probe auf alle Sichten (Liste, WBS, Berichte, Einstellungen) — sobald #50 und #55 durch sind, eigene Karte.
- [ ] Regel für eigene Nutzerfarben (Karte #50/#51), dann Nachtrag hier.

## Quellen / Bezuege

- Karte #9 (UX-Durchsicht 2026-10-31); abgegrenzt #50 (Σ und Datum auf eigener Klassenfarbe dunkel), #51 (Farbfeld „ohne Klasse“), #55 (Härtung: Amber als Schrift, Ränder von `.btn` und Select).
- WCAG 2.1 SC 1.4.3 und 1.4.11; Material 3 Farbrollen https://m3.material.io/styles/color/roles (Referenz, nicht Vorlage).
- `AI-Team/po-entscheidungen.md:17`, `:54`, `:99`.
- [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md) (Neuzeichnen — Grund gegen eine JS-Farbwahl in `render()`), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) (Muster Wächtertest mit Selbstprobe).
- Baustein [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md).
