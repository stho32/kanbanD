---
id: R00144
status: Neu
datum: 2026-11-12
---

# R00144: Aufgabenfenster-Kopf — Aktionen im Menü, Löschen ohne Beschriftung, Blättern entfällt

## Beschreibung

Der Kopf des Aufgabenfensters trägt heute rechts eine lange Reihe von Auslösern, darunter einen beschrifteten Papierkorb („Endgültig löschen“) und einen Archiv-Knopf. Diese Anforderung nimmt beide aus der Knopfreihe und legt sie in **ein Aktionsmenü** (⋮) rechts neben dem ✕; der Kopf führt danach nur noch Symbole, und die zerstörende Aktion wird erst im Menü benannt. Zugleich entfällt das Blättern zur vorigen/nächsten Karte samt Knöpfen, Zähler, Tasten und Kürzelhilfe-Eintrag, weil es niemand braucht.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgeräumt und folgt gewohnten Konventionen“; der Kopf zeigt wenige, gleichartige Ziele statt einer gemischten Knopfreihe.

**Zwei frühere Festlegungen sind damit ausdrücklich aufgehoben** (Betreiber-Auftrag 2026-11-12, Karte #144):

- **„Der Kopf-Auslöser bleibt beschriftet“** — `AI-Team/po-entscheidungen.md:196` (Freigabe zu #36, Commit `59da36e`). Aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144): im Kopf steht kein beschrifteter Lösch-Auslöser mehr.
- **Das Blättern im Aufgabenfenster** (R00011, R00110 F3, R00116 FA 6, R00123 FA „Wechsel der Aufgabe“, R00105/R00127 Rückfalltexte, `KUERZEL_FENSTER`) — Funktionsstreichung durch Betreiber-Entscheidung 2026-11-12 (#144).

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wer eine Aufgabe ansieht, trifft im Kopf auf ↑, ↓, ↗, ▭, „Endgültig löschen“ und ✕ in einer Reihe — fünf Ziele verschiedenen Gewichts, davon eines mit Text und in Warnfarbe. Das ist laut Betreiber „zu voll und falsch gewichtet“: Die alltäglichen Wege (lesen, bearbeiten, schließen) stehen neben einer unumkehrbaren Aktion, die man selten und dann bewusst wählt. Ein ⋮-Menü trennt beides: Der Kopf wird ruhig und gleichartig, die seltenen Aktionen liegen einen Schritt tiefer und tragen dort ihre Namen. Das Blättern fällt weg, weil der Betreiber es nicht nutzt — die Aufgabe wechselt ohnehin über das Board. Der Gewinn ist ein Kopf, der auf jeder Breite einzeilig bleibt und dessen einzige Gefahrenaktion nicht mehr als Knopf in der Reihe steht.

## Funktionale Anforderungen

### Kopf des Aufgabenfensters

1. Der Kopf trägt rechts, von links nach rechts: den **Ansichts-Auslöser** (aus R00145, er nennt die aktuelle Ansicht als Text), **„In VS Code öffnen“** (↗, unverändert), den **Aktions-Auslöser** (⋮) und — mit sichtbarem Abstand zum ⋮ — **✕**. Zähler, Blätterknöpfe, Archiv-Knopf, 1-px-Trenner und der beschriftete Lösch-Auslöser entfallen.
   **Geometrie** (ux-Vorprüfung 2026-11-12, übernommen): links stehen `#nr`, Klasse und Pfad, rechts die Gruppe der Ziele; zwischen allen Zielen liegen 8 px (`--kd-s3`), es gibt **keinen** Trenner. Jedes Ziel ist quadratisch in `max(--kd-row, --kd-ziel)` (28 px fein, 48 px Touch) mit einem Glyph von 14–16 px. Der Ansichts-Auslöser ist ein Textknopf mit Caret `▾` (`aria-hidden`), Höhe `--kd-ziel`, Innenabstand 0 8 px, Schrift 12 px, Name `aria-label="Ansicht: <Name>"` (R00145 FA 4). Mit dem Wegfall des Trenners und der Blätterknöpfe geht der frei werdende Platz an den **Pfad**.
2. Der Aktions-Auslöser ist ein **Symbolknopf** (⋮, Muster `DREI_PUNKTE` aus R00128) mit `aria-haspopup="menu"`, `aria-expanded` und dem zugänglichen Namen **„Weitere Aktionen für Aufgabe #<nr>“**; sein `title` lautet „Weitere Aktionen“. Er trägt keinen sichtbaren Text.
3. Das Menü führt in dieser Ausbaustufe **genau zwei Einträge**: **„Archivieren“** (bei einer archivierten Aufgabe **„Zurückholen“**) und **„Endgültig löschen“**. Jeder Eintrag trägt sein Symbol (Archiv bzw. Papierkorb) **und** seinen Text. „Endgültig löschen“ ist der **letzte** Eintrag, in `--kd-warn` abgesetzt, mit genau einem Trenner davor. „Duplizieren“ und „Verweis kopieren“ sind **nicht** Teil dieser Anforderung (spätere Ergänzung, je ein Menüeintrag).
   **Form** (ux-Vorprüfung 2026-11-12, übernommen): Das Menü trägt **keinen Titel** und **keinen Trenner am Anfang**; der einzige Trenner (`role="separator"`, 1 px `--kd-line`) steht zwischen „Archivieren“ und „Endgültig löschen“. Beide Einträge beginnen an derselben Textkante: eine Ikonspalte von 16 px trägt das Symbol, danach 8 px Lücke. Ein Eintrag ist `max(28px, --kd-ziel)` hoch, einzeilig, ohne Kürzel; das Menü ist `min(280px, 100vw − 16px)` breit (mindestens 200 px), hängt an der Unterkante des Kopfes, seine Endkante an der Endkante seines Auslösers und liegt ganz im sichtbaren Bereich. „Archivieren“ trägt das Archiv-Zeichen, „Zurückholen“ dasselbe Zeichen mit Pfeil nach oben, beide `aria-hidden`; die Archivleiste unter dem Kopf bleibt als zweiter Weg und trägt denselben Wortlaut „Zurückholen“.
4. **Symbol statt Beschriftung im Kopf.** Der Kopf führt keinen beschrifteten Lösch-Auslöser und keinen eigenen Archiv-Knopf mehr; das Papierkorb-Symbol steht am Menüeintrag, wo der Text hingehört. *(Aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144): die Festlegung „Kopf-Auslöser bleibt beschriftet“ aus `AI-Team/po-entscheidungen.md:196` gilt nicht mehr.)*
5. **Wirkung unverändert.** „Archivieren“ setzt `archived` und nimmt die Karte vom Board (R00017); „Zurückholen“ holt sie zurück. „Endgültig löschen“ öffnet **dieselbe** Rückfrage wie heute (`role="alertdialog" aria-modal="true"`, R00141 FA 11/12, B1/B2); Bestätigen löscht in einem Commit und schließt das Fenster (R00141 B4), Abbrechen ändert nichts.
6. **Menü-Verhalten.** Das Menü ist `role="menu"` mit dem Namen „Weitere Aktionen für Aufgabe #<nr>“; die Einträge sind `role="menuitem"` ohne Kürzel, mit `tabindex="-1"`. Beim Öffnen steht der Fokus auf dem ersten Eintrag. `↑`/`↓` (mit Umlauf), `Pos1`/`Ende`, `Enter`/`Leertaste` und ein Klick bedienen es; `Esc` und `Tab` schließen es und geben den Fokus an den ⋮-Auslöser zurück. Das Menü ist eine eigene Ebene der Fokusführung (`fenstermenue` zwischen `fenster` und `pop`), die Rückfrage liegt als `alertdialog` **darüber**. Solange das Menü offen ist, greifen die Fenster-Kürzel nicht. **Im Kopf ist höchstens ein Menü offen**: das Öffnen des Aktionsmenüs schließt ein offenes Ansichtsmenü (R00145) und umgekehrt — mit Rückgabe des Fokus an das neue Menü. **Kein Titel im Menü**: erlaubte Kinder eines `role="menu"` sind Einträge, Gruppen und Trenner (ADR-0018, Offene Fragen; R00136 hat die vier `h4`-Köpfe genau deshalb entfernt) — ein Name steht nur als `aria-label` und `title` am Auslöser. **Fokus auf dem Gefahreintrag** bleibt auf der Akzentfläche mit `--kd-on-accent`-Text (Haus: `.km-e.km-warn.an`); weißer Text auf `--kd-warn` ist verboten (dunkel 2,65:1).
7. **Fokus nach der Rückfrage.** Bricht der Mensch die Rückfrage ab, kehrt der Fokus an den **⋮-Auslöser** (der Menüeintrag ist mit dem Menü fort); nach dem Bestätigen schließt das Fenster mit dem Fokusweg aus R00141 B4. Der Fokus fällt nie auf `BODY`.
8. **Live-Ereignis.** Trifft bei offenem Menü ein Live-Ereignis ein, bleibt das Menü offen und der Fokus in ihm (R00106); die Einträge richten sich nach dem neu gezeichneten Stand („Archivieren“ ↔ „Zurückholen“).

### Blättern entfällt

9. **Die Aktion „Blättern“ entfällt vollständig**: keine Knöpfe ↑/↓ im Kopf, keine Tasten `↑`/`↓`, kein Zähler „i / n“, kein Fußhinweis „↑ ↓ Karte wechseln“, kein Eintrag in der Kürzelhilfe des Fensters. *(Funktionsstreichung durch Betreiber-Entscheidung 2026-11-12 (#144).)*
   Der Fuß des Fensters nennt danach nur noch `Esc schließen`; `KUERZEL_FENSTER` führt weder `↑ ↓` noch — mit R00145 — `← →`.
10. Eine andere Aufgabe erscheint danach **nur noch durch Öffnen** (Karte, Aufgabenliste, Personen-Seite, Link); `S.ui.offen` wechselt ausschließlich dort.
11. `#t-mehr` der Kopfzeile und der Fenstertitel (R00116) bleiben **unberührt**.

### Nachzug der Festlegungen

12. Mitgezogen werden die Stellen, die das Blättern oder den beschrifteten Kopf-Auslöser nennen: R00011, R00103 (AK „zu #2 blättern“), R00105, R00110 (F3), R00116, R00123, R00127, R00128 (⋮-Muster), R00141 (FA 10, AK 9/10), R00106 (Menüliste), die Domänenwissen-Einträge D00001/D00006, die Kürzelhilfe (`KUERZEL_FENSTER`) und die WBS-Knoten B0033/F0022/F0044/B0379/F0057/F0096/B0575. Jede geänderte Festlegung ist dort sichtbar als „aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144)“ markiert; abgenommene Anforderungen behalten ihre Abnahme, nur der betroffene Satz bzw. das betroffene Kriterium ändert sich.

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Der Aktions-Auslöser folgt dem APG-Muster „Menu Button“ (`aria-haspopup="menu"`, `aria-expanded`), das Menü dem Muster „Menu“ (Pfeile, `Pos1`/`Ende`, `Enter`, `Esc`); jeder Auslöser und jeder Eintrag hat einen zugänglichen Namen (WCAG 2.1 SC 4.1.2), der Fokus ist immer sichtbar (SC 2.4.7). Zielgrößen nach ADR-0012 (≥ 24 px fein, ≥ 44 px Touch); der Trefferhof darf den sichtbaren Rand überragen.
- **Schmale Breiten**: Bei 320, 375 und 414 px bleibt der Kopf **einzeilig** und trägt **drei** Ziele — Ansicht, ⋮ und ✕. Vier 48-px-Ziele mit 3 × 8 px Lücken belegen bei 320 px 288 von 299 verfügbaren Pixeln (11 px Rest, mit dem Label „Verlauf“ 5 px); jede Metrik-Abweichung kippt den Kopf in die zweite Zeile. **↗ bleibt deshalb bis 640 px versteckt** — wie heute gebaut (`web/kd-app.css:919`) und als einzige Ausnahme in `e2e/tests/r00111-schmal-wie-breit.spec.js:27` festgeschrieben; es erscheint ab 641 px. Einzeilig heißt: `#fenster .mod-kopf` ist höchstens `max(36px, --kd-ziel) + 2` hoch und die Ziele stehen auf derselben Oberkante (±1 px) — `scrollWidth ≤ clientWidth` allein beweist es nicht, ein umgebrochener Kopf erfüllt es auch (dreimal aufgetreten: `r00112`, `web/kd-app.css:920–927`). Für Kopf und Seite gilt zusätzlich `scrollWidth ≤ clientWidth`; das Menü liegt ganz im sichtbaren Bereich und scrollt nicht quer (ADR-0015).
- **Farbe**: „Endgültig löschen“ nutzt das vorhandene `--kd-warn`; kein neuer Farbwert (ADR-0011). Der Kontrast des Texts zum Hintergrund liegt auch **im Fokuszustand** bei ≥ 4,5:1, hell wie dunkel (`--kd-warn` auf `--kd-surface` 5,88:1 / 6,03:1; weiß auf `--kd-warn` nur 5,96:1 / 2,65:1 und damit verboten).

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“; Aufgabe #1 „<Titel>“ in „Eingang“; Aufgabe #2 in „Eingang“; Person `st` (Mensch) gewählt.

### Kopf und Menü

- [ ] Gegeben #1, wenn das Aufgabenfenster geöffnet wird, dann trägt der Kopf rechts die Auslöser **Ansicht**, **↗**, **⋮**, **✕** in dieser Reihenfolge, ohne Trenner dazwischen und mit 8 px Lücke; der Ansichts-Auslöser steht ganz links in der Gruppe und trägt seinen Caret `▾` (`aria-hidden`); der ⋮ trägt `aria-haspopup="menu"`, `aria-expanded="false"` und den Namen „Weitere Aktionen für Aufgabe #1“; im Kopf steht kein beschrifteter Lösch-Auslöser, kein Archiv-Knopf, kein ↑, kein ↓, kein „i / n“ und kein Trenner
- [ ] Gegeben #1, wenn der ⋮-Auslöser betätigt wird, dann öffnet ein `role="menu"` mit dem Namen „Weitere Aktionen für Aufgabe #1“ und genau zwei Einträgen „Archivieren“ und „Endgültig löschen“ in dieser Reihenfolge; der letzte trägt `--kd-warn` und hat genau einen Trenner davor; das Menü trägt keinen Titel und keinen Trenner am Anfang; beide Einträge tragen ein Symbol in einer 16-px-Ikonspalte (danach 8 px) und beginnen an derselben Textkante; an keinem Eintrag steht ein Tastenkürzel; der Fokus steht auf „Archivieren“; `aria-expanded` ist `true`
- [ ] Gegeben #1, wenn das Aufgabenfenster geöffnet ist, dann trägt der Pfad den frei gewordenen Platz (seine rechte Kante endet an der Zielgruppe, statt vor einem Zähler oder Trenner abzubrechen), und der Fuß des Fensters nennt nur `Esc schließen`
- [ ] Gegeben #1 ist archiviert, wenn das Menü geöffnet wird, dann lautet der erste Eintrag „Zurückholen“, trägt das Archiv-Zeichen mit Pfeil nach oben (`aria-hidden`), und seine Wahl holt #1 zurück (ein Commit); die Archivleiste unter dem Kopf bietet denselben Weg mit genau dem Wortlaut „Zurückholen“
- [ ] Gegeben das offene ⋮-Menü mit Fokus auf „Endgültig löschen“, wenn Text- und Flächenfarbe des fokussierten Eintrags gemessen werden, dann liegt der Kontrast bei mindestens 4,5:1 in Hell und in Dunkel; der Text steht auf der Akzentfläche mit `--kd-on-accent`, nicht auf `--kd-warn`
- [ ] Gegeben das offene Ansichtsmenü von #1 (R00145), wenn der ⋮-Auslöser betätigt wird, dann ist genau **ein** `[role="menu"]` im Fenster offen, `aria-expanded` steht am Ansichts-Auslöser auf `false` und am ⋮ auf `true`, und der Fokus steht im neuen Menü; dasselbe umgekehrt vom offenen ⋮-Menü aus
- [ ] Gegeben das offene Menü von #1, wenn „Archivieren“ gewählt wird, dann ist das Menü zu, #1 ist vom Board genommen, ein Commit „#1 archiviert“ ist entstanden, und der Fokus steht wieder auf dem ⋮-Auslöser
- [ ] Gegenbeispiel: Gegeben #1, wenn der ⋮-Auslöser zweimal betätigt wird, dann ist das Menü beim zweiten Mal zu, `aria-expanded` ist `false`, und nichts ist geschrieben

### Endgültig löschen aus dem Menü

- [ ] Gegeben #1, wenn im Menü „Endgültig löschen“ gewählt wird, dann ist das Menü zu und es erscheint die Rückfrage aus R00141 (`role="alertdialog" aria-modal="true"`, Name „#1 <Titel> endgültig löschen“, höchstens zwei Aktionen, Fokus auf „Abbrechen“); Abbrechen gibt den Fokus an den **⋮-Auslöser** zurück, nichts ist geändert
- [ ] Gegeben dieselbe Rückfrage, wenn „endgültig löschen“ bestätigt wird, dann schließt das Aufgabenfenster, #1 ist überall weg, und der Fokus steht nach R00141 B4 (nicht auf `BODY`)

### Blättern entfällt

- [ ] Gegeben #1 ist offen und #2 steht in derselben Spalte, wenn das Fenster bedient wird, dann gibt es **keinen** Weg, mit dem eine Taste ohne Eingabefeld zur nächsten oder vorigen Aufgabe wechselt: `↓` und `↑` lösen keine Aktion aus, und das Fenster zeigt weiter #1
- [ ] Gegeben das Aufgabenfenster ist offen, wenn die Kürzelhilfe geöffnet wird, dann enthält sie **keinen** Eintrag „↑ ↓“ mit „vorige / nächste Karte“, keinen Eintrag „← →“ und keinen anderen Eintrag, den es nicht mehr gibt; der Fuß des Fensters nennt statt „↑ ↓ Karte wechseln“ nur noch `Esc schließen`
- [ ] Gegeben #1 ist offen, wenn es geschlossen und danach #2 geöffnet wird, dann zeigt das Fenster #2 (der einzige Weg zu einer anderen Aufgabe)

### Tastatur, Fokus, Live

- [ ] Gegeben das offene Menü mit Fokus auf „Archivieren“, wenn `↓` gedrückt wird, dann steht der Fokus auf „Endgültig löschen“; `↑` führt zurück, `Pos1` auf „Archivieren“, `Ende` auf „Endgültig löschen“, und `Enter` wählt den fokussierten Eintrag
- [ ] Gegeben das offene Menü, wenn `Esc` gedrückt wird, dann ist nur das Menü zu (das Aufgabenfenster bleibt offen), und der Fokus steht auf dem ⋮-Auslöser; ein zweites `Esc` schließt das Fenster
- [ ] Gegeben das offene Menü, wenn im Fenster `a`, `t` oder `d` gedrückt wird, dann geschieht nichts (kein Archivieren, kein Timer, kein Ansichtswechsel)
- [ ] Gegeben das offene Menü von #1, wenn über die API der Titel von #2 geändert wird und das Live-Ereignis eintrifft, dann ist das Menü weiter offen und der Fokus steht weiter auf demselben Eintrag

### Schmale Breiten

- [ ] Gegeben #1, wenn das Aufgabenfenster bei 320, 375 und 414 px Breite jeweils in Hell und in Dunkel geöffnet wird, dann steht der Kopf **einzeilig**: `#fenster .mod-kopf` ist höchstens `max(36px, --kd-ziel) + 2` hoch, und Ansicht, ⋮ und ✕ stehen auf derselben Oberkante (±1 px); die drei Ziele liegen ganz im sichtbaren Bereich und sind per Klick wie per Tastatur bedienbar; **↗ ist unter 641 px nicht sichtbar** (die Ausnahme in `r00111` bleibt unverändert) und ab 641 px sichtbar; für Kopf und Seite gilt `scrollWidth ≤ clientWidth`
- [ ] Gegeben dieselben Breiten, wenn das Menü geöffnet wird, dann liegt es ganz im sichtbaren Bereich, „Endgültig löschen“ bricht nicht ab, und die Seite scrollt nicht quer

## Betroffene Verzeichnisstruktur

- Oberfläche: `web/ansicht.js` (`vFenster`: Kopf; neuer Renderer für das Aktionsmenü nach dem Muster `vBoardMenue` — **nicht** `vMenue`, das zeichnet `.km-titel` in ein `role="menu"`), `web/app.js` (`act`-Zweige `archivieren`, `zurueckholen`, `endgueltig-loeschen` aus dem Menü; neuer Zweig für das offene Kopf-Menü; `case 'blaettern'` und der `↑`/`↓`-Hörer entfallen; `sichtbareReihe` verliert den letzten Aufrufer), `web/menue.js`/`web/fokus.js` (Ebene `fenstermenue`), `web/kd-app.css` (Kopf: 8-px-Lücken, Ziele `max(--kd-row, --kd-ziel)`, `flex-wrap:nowrap`, das alte `width:44px` entfällt; Menü: Ikonspalte, Trenner, Warn-/Fokuszustand), `KUERZEL_FENSTER` in `web/ansicht.js`.
- Tests: `e2e/tests/r00144-kopf-aktionen.spec.js` neu; `e2e/tests/r00141-endgueltig-loeschen.spec.js` (Auslöser im Fenster), `r00116-titel-*`, `r00105-preisetikett.spec.js`, `r00111-schmal-wie-breit.spec.js`, `r00112-rueckgaengig.spec.js` und `e2e/tests/ziele.spec.js` ziehen nach.

## Technische Überlegungen

### Ablauf

1. **Menü-Ebene und Auslöser** (F0115, Walking Slice)
   - 1.1 Ebene `fenstermenue` in `web/fokus.js` zwischen `fenster` und `pop`; Selektor aus dem offenen Menü im Zustand, Startziel erster Eintrag, `Esc`/`Tab` schließen mit Rückgabe an den Auslöser (B0659)
   - 1.2 Kopf umbauen: ⋮ statt ▭/Trenner/beschriftetem Papierkorb, Lücken 8 px, Ziele in `max(--kd-row, --kd-ziel)`; Menü ohne Titel, mit Ikonspalte 16 + 8 px und genau einem Trenner vor „Endgültig löschen“ (warn, letzter, je mit Symbol); unter 641 px drei Ziele, ↗ versteckt (B0660)
   - 1.3 Fokus, Kürzel-Sperre und Live-Verhalten des offenen Menüs (B0661)
2. **Blättern streichen** (F0116)
   - 2.1 Aktion, Tasten, Zähler, Fußhinweis, `sichtbareReihe` und Kürzelzeile entfernen; der frei werdende Platz geht an den Pfad, der Fuß nennt nur `Esc schließen` (B0663)
   - 2.2 Proben umstellen: R00105/R00110/R00116/R00123/R00127 prüfen statt „blättern“ das Öffnen einer anderen Aufgabe (B0664)
3. **Nachzug der Festlegungen** (F0117)
   - 3.1 R00141 FA/AK, R00128-Notiz, D00001/D00006, `KUERZEL_FENSTER` und Handbuch (B0665)

### Grobentwurf

**Wichtige Einstiegsstellen:** `vFenster` (`web/ansicht.js:274–294`) ist der einzige Ort, der den Kopf zeichnet; `act` (`web/app.js`) führt die Aktionen; `web/fokus.js` ordnet die Ebenen; `web/kd-app.css` gestaltet Kopf und Menü.

**Elemente** (Vorplanung):
- `vFensterAktionen(a)` — zeichnet den ⋮-Auslöser (`aria-haspopup`, `aria-expanded`, Name mit Nummer) und, wenn offen, das `role="menu"` mit den zwei Einträgen; Symbole aus den vorhandenen Konstanten (`PAPIERKORB`, Archivzeichen), Warnklasse am letzten Eintrag.
- `S.ui.fensterMenue` (Sichtzustand) — `'aktionen' | 'ansicht' | null`; die Ansicht gehört R00145, beide nutzen **eine** Ebene.
- `fensterMenueTaste(e)` (Kleber) — Pfeile/`Pos1`/`Ende`/`Enter`/`Esc`/`Tab` für beide Kopf-Menüs.
- Kein neuer Endpunkt, keine neue Ablage, kein Datenformat.

### Änderungen an bestehenden Klassen

- `web/ansicht.js`: `vFenster` verliert `vReiterleiste`-Nachbar `nav`, ↑/↓, ▭, Trenner und `el-ausloeser`; `sichtbareReihe` und der Zähler fallen weg.
- `web/app.js`: `case 'blaettern'` und der `ArrowUp`/`ArrowDown`-Zweig im `keydown`-Hörer entfallen; der Menüzweig läuft **vor** `fensterTaste`.
- `web/fokus.js`: neue Art `fenstermenue` (Reihenfolge `fenster` < `fenstermenue` < `pop` < `aldialog` < `kmenue`).

### Umfang

- I0131: 3 Features, 7 Bubbles (B0659–B0665), Richtwert 7,5–15,5 h ungemessen (Summe der Spannen, Hypothese). Keine Bubble unter der Untergrenze von 0,4 h.

### Gestaltung

- **ux-Vorprüfung: liegt vor** (2026-11-12, Detailblatt der ux-Vorprüfung #144/#145). Festgelegt und hier übernommen: Menüform `role="menu"` mit `menuitem`; Kopf-Geometrie mit 8-px-Lücken, ohne Trenner, Zielen in `max(--kd-row, --kd-ziel)` und Glyph 14–16 px; bei 320/375/414 px drei Ziele mit verstecktem ↗; Menü ohne Titel, Ikonspalte 16 + 8 px, genau ein Trenner; Fokus auf dem Gefahreintrag auf der Akzentfläche; „Zurückholen“ mit Archiv-Zeichen plus Pfeil.
- **Gezeichnet (D0003 #fensterkopf-aktionen) und freigegeben** (product-owner, Commit `d7f43f7`; Zeichnung `4f04093`) sind die Zustände am **Artboard D0003**, je hell und dunkel: Kopf mit ⋮ (1280 · 414 · 320 px), offenes Aktionsmenü (Einträge, Ikonspalte, ein Trenner, Warnfarbe), Fokus auf „Endgültig löschen“ (Kontrastbeleg), archivierte Aufgabe („Zurückholen“, Archivleiste), dazu die Mess-/Kontrasttabelle und die Zielgrößen (Ansicht · ⋮ · ✕ · Menüeintrag). Die Oberflächen-Bubbles B0660, B0661 und B0662 sind damit frei baubar.

## Tests

Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** `ebenen(ui)` mit offenem Kopf-Menü über offenem Fenster in der Reihenfolge `fenster` < `fenstermenue`; Startziel und Rückgabe; `reiterSchluessel`/`sichtbareReihe`-Wegfall (kein Aufrufer mehr); Menüzustand nach Neuzeichnen.

**E2E:** `e2e/tests/r00144-kopf-aktionen.spec.js` — US-1 bis US-6: Kopf ohne Blätterknöpfe/Zähler/beschrifteten Papierkorb (drei Ziele bei 320/375/414 px, vier ab 641 px); Menü öffnen, Einträge, Ikonspalte, genau ein Trenner, kein Titel, Warnklasse, Tastatur, `Esc`-Kaskade, Kürzel-Sperre im offenen Menü; Archivieren und Zurückholen (Archivleiste mit demselben Wortlaut); Rückfrage aus dem Menü samt Abbruch-Fokus am ⋮; Live-Ereignis bei offenem Menü; höchstens ein offenes Kopf-Menü (mit R00145); Kontrast des fokussierten Warn-Eintrags; 320/375/414 px hell und dunkel **mit Höhen- und Oberkantenmessung** (`clientHeight ≤ max(36px, --kd-ziel) + 2`, gleicher `top` ±1 px) statt nur `scrollWidth`. Bestehende Proben, die `↓`/`↑` oder `getByRole('button', {name: 'Endgültig löschen'})` im Kopf nutzen, werden umgestellt. Gegenprobe: nach dem Ansehen ohne Aktion sind Aufgabendatei und `git log` unverändert.

## Abhängigkeiten

- Abhängig von: R00141 Aufgabe endgültig löschen (I0129, grün — Rückfrage und Löschweg), R00017 Archivieren (I0017, grün), R00128 (⋮-Muster, M1), R00106 (Fokus-Ebenen).
- Berührt: **R00145** — das Ansichtsmenü desselben Kopfes nutzt die hier gelegte Ebene `fenstermenue` und folgt derselben Regel „höchstens zwei Menü-Auslöser im Kopf“ (ADR-0018 N2). R00116 (Fenstertitel, `#t-mehr`) bleibt unberührt.
- Blockiert: —

## Offene Fragen

- **1. Bleibt der Zähler „i / n“?** **Entschieden (Planung, 2026-11-12): nein.** Er nannte die Lage in der Blätterreihe; ohne Blättern benennt er eine Position, zu der es keine Handlung gibt. ADR-0018 N2 stellt die Frage ausdrücklich der Planung (Grenze). Will die UX ihn als reine Orientierung zurückholen, wäre das ein eigener Auftrag.
- **2. Gehören „Duplizieren“ und „Verweis kopieren“ ins Fenstermenü?** **Entschieden (Planung, 2026-11-12): nicht in dieser Ausbaustufe.** Die Karte nennt sie mit „ggf.“; R00142 legt „Duplizieren“ ins **Kartenmenü**, nicht ins Fenster. Ein späterer Eintrag ist eine Zeile in derselben Liste.
- **3. Wie ist „Symbol-only“ zu lesen — Papierkorb im Kopf oder nur im Menü?** **Entschieden (Planung, 2026-11-12): nur im Menü.** Die Karte verlangt in Punkt 2 ausdrücklich „nur über ein Menü“ und beschreibt den Kopf als „[⋮] [✕]“; damit trägt der Menüeintrag das Papierkorb-Symbol und seinen Text, und im Kopf steht kein beschrifteter Auslöser. Eine Rückkehr des Papierkorbs als eigener Kopfknopf würde Punkt 2 wieder aufheben.

## Manuelle Vorbereitungstätigkeiten

- **ux-Vorprüfung: erledigt** (2026-11-12, Detailblatt der ux-Vorprüfung #144/#145). Die Zustände „Kopf mit ⋮“, „Aktionsmenü offen“, „Fokus auf Endgültig löschen“, „archivierte Aufgabe (Zurückholen)“ an **D0003** sind hell/dunkel, 1280 · 414 · 320 px, samt Mess-/Kontrasttabelle **gezeichnet (D0003 #fensterkopf-aktionen) und freigegeben** (product-owner, Commits `4f04093`, `d7f43f7`). Die Oberflächen-Bubbles B0660, B0661, B0662 sind frei baubar; B0659 ist es ohnehin.

## Manuelle Nachbereitungstätigkeiten

- Bildschirmfotos des Kopfes und des offenen Menüs bei 1280, 414 und 320 px, je hell und dunkel, auf den Abnahmezettel.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Betreiber-Eindruck, der Kopf sei „zu voll und falsch gewichtet“: Ein unumkehrbarer Weg steht als beschrifteter Warnknopf in derselben Reihe wie Lesen, Editor öffnen und Schließen, und zwei Pfeile laden zu einem Wechsel ein, den niemand nutzt. Weil die seltenen Aktionen in ein Menü wandern, wird der Kopf gleichartig und kurz; weil der Löschweg dort seinen Namen und seine Warnfarbe behält, wird er nicht versteckt, sondern nur eine Ebene tiefer und bewusster gewählt. Weil das Blättern samt Zähler, Tasten und Kürzelzeile fällt, verschwindet zugleich die zweite Bedeutung der Pfeiltasten im Fenster und eine Quelle von Sonderfällen (Reihenberechnung, Fokus nach dem Wechsel, Verlaufs-Panel beim Wechsel). Der Hebel sitzt im Kopf, weil dort die ganze Reihe entsteht: eine Umgestaltung der Knöpfe allein ließe die unumkehrbare Aktion in der Alltagsreihe stehen, und ein bloßes Kürzen des Textes ließe die Reihe voll. Die Technik ist bereits entschieden (ADR-0018 N2: Menü als eigene Fokus-Ebene im Fenster), sodass die Änderung klein, umkehrbar und ohne Datenänderung bleibt.

## Missing-Docs

- Keine.

## Notizen

- **Optionen (Skill `optionen-vor-entscheidung`, gewählt A):** (A, **gewählt**) ⋮-Menü mit beiden Einträgen, Kopf symbol-only — trennt Alltag und Gefahrenaktion, folgt dem gebauten Muster aus R00128 und der Vorgabe „nur über ein Menü“. (B) Papierkorb bleibt als **Symbolknopf** im Kopf, nur „Archivieren“ wandert ins Menü — bequemer für den häufigen Löschfall, hebt aber die ausdrückliche Vorgabe „nur über ein Menü“ auf und lässt die Gefahrenaktion in der Alltagsreihe. (C) alle Aktionen ins Kartenmenü (Rechtsklick/Menütaste) und den Kopf ganz entlasten — auf Touch unauffindbar und ohne Bezug zum offenen Fenster; verworfen.
- **Blättern — Optionen:** (A, **gewählt**) vollständig streichen (Knöpfe, Tasten, Zähler, Kürzel). (B) nur die Knöpfe streichen, Tasten behalten — unsichtbare Bedienung, die niemand entdeckt, und die Tests blieben an einer Funktion hängen, die keiner braucht. (C) Blättern in die Kopfzeile verlegen — neuer Ort für eine gestrichene Funktion; verworfen.
- **Verworfene Alternativen:** ein „…“-Menü zusätzlich zum ⋮ (zwei Auslöser für eine Aufgabe, ADR-0018 N2 erlaubt höchstens zwei **Menüs** im Kopf, davon eines die Ansicht); ein `<select>` für die Aktionen (Aktionen sind keine Auswahl, sondern Befehle).
- **Abgrenzung:** Die Ansichtsumschaltung ist **nicht** Teil dieser Anforderung (R00145); der Fenstertitel und `#t-mehr` bleiben unberührt (R00116, R00140).
- **ux-Vorprüfung (2026-11-12) übernommen, nicht neu entschieden:** Menüform `role="menu"` mit `menuitem` (nicht `<select>`, nicht `tablist`); Kopf mit 8-px-Lücken ohne Trenner und Zielen in `max(--kd-row, --kd-ziel)`; bei 320/375/414 px **drei** Ziele mit verstecktem ↗; Menü ohne Titel und ohne Trenner am Anfang, Ikonspalte 16 + 8 px, Eintrag `max(28px, --kd-ziel)`, keine Kürzel; Fokus auf dem Gefahreintrag auf der Akzentfläche (M4); Höhen-/Oberkantenmessung statt `scrollWidth` allein (M3); höchstens ein offenes Kopf-Menü (S4); „Zurückholen“ mit Archiv-Zeichen plus Pfeil (S8). Die AK „alle vier Auslöser“ ist damit auf drei gezogen (M1).
