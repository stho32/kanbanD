# ADR-0015: Meldungen und Aktionen überstehen jede Breite — der Fuß eines Fensters bleibt, schmal fallen nur Hinweise weg

**Status**: Akzeptiert
**Datum**: 2026-11-07
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #74 „Fehlermeldung des Aufgabenfensters auf schmalen Bildschirmen unsichtbar“; Anforderung und WBS-Knoten folgen über den planer
**Nachträge**: 2026-11-07 — Umbruch nach Bedarf statt „ab 641 px unverändert“, Uhrzeit mit Sekunden (Karte #74, R00111), siehe [Nachtrag N1](#nachtrag-2026-11-07-umbruch-nach-bedarf-r00111). 2026-11-15 — abgelehnte Eingabe bleibt stehen und das Feld verweist auf die Meldung, eine Regel für jedes Feld des Aufgabenfensters (Karten #54/#96/#93), siehe [Nachtrag N2](#nachtrag-2026-11-15-abgelehnte-eingabe-bleibt-stehen-das-feld-verweist-auf-die-meldung); gebaut mit [R00155](../../Anforderungen/R00155-behebung-aufgabenfenster-felder-und-fenstermeldung.md) (Zweig `karte/54`, `20cb14e`) und am selben Tag auf den gebauten Stand gesetzt: Ziffer 2 um die Rangfolge beim Tippen ergänzt, Ziffer 5 eingeengt, Ziffer 6 neu (Meldung und abgelehnte Eingabe gehen nur gemeinsam, Ausgänge (a) bis (e)). 2026-11-16 — Ziffer 5 des Nachtrags N2 um die Meldung ohne Feld ergänzt (R00185 108-2): sie übersteht den Erfolg einer anderen Aktion. Der Text oberhalb des Nachtrags ist der Stand der Annahme und bleibt unverändert; Marken *(→ N1)* zeigen, wo der Nachtrag gilt.
**Erprobt durch**: isolierte Probe in Headless-Chromium mit den echten Stilen `web/kd-tokens.css`, `kd-base.css`, `kd-app.css` auf kanbanD `6636db3` und dem Markup der Füße aus `web/ansicht.js:187` und `:256`. Ist: bei 414 und 640 px haben die Meldung des Aufgabenfensters, die Meldung von „Neue Aufgabe“ und der Knopf „Anlegen“ 0 Client-Rects, und der Accessibility-Snapshot enthält keinen der drei Einträge. Bei 641 und 1280 px sind alle drei sichtbar. Mit der gewählten Regel als Zusatz-CSS haben bei 320 und 414 px (Touch und fein) und bei 1280 px alle drei Einträge Client-Rects. Die lange Meldung bricht im Fenster um, nichts scrollt quer, und „Anlegen“ ist bei Touch 48 px hoch. Die Probe lief nicht im laufenden Fenster; das leistet die Abnahme.

## Kontext

Bis 640 px Breite blendet die Responsive-Regel aus R00077 den Fuß jedes Fensters ganz aus: `.mod-fuss{display:none}` (`web/kd-app.css:836`). Gedacht war das für Tastenhinweise (`Esc schließen · ↑↓ Karte wechseln`), die auf einem Handy nichts nützen. Im Fuß stehen aber auch Dinge, die man auf jedem Gerät braucht:

| Fenster | Ort | Was mit dem Fuß verschwindet |
|---|---|---|
| Aufgabenfenster | `web/ansicht.js:256` | Meldung `S.ui.fensterFehler` (`role="alert"`), Anzeige „gespeichert HH:MM“ *(→ N1: HH:MM:SS)*, Tastenhinweise |
| Neue Aufgabe | `web/ansicht.js:187` | Meldung `f.fehler` (`role="alert"`), **die Knöpfe „Abbrechen“, „Anlegen und weitere“, „Anlegen“**, Tastenhinweise |
| Defekte Datei | `web/ansicht.js:520` | nur ein Erklärsatz; die Meldung des Defekts steht oben in `.archbar.warnbar` (`role="alert"`) und bleibt |

Ein Element unter `display:none` ist nicht im Accessibility-Baum. Eine Meldung mit `role="alert"` wird dort also weder gesehen noch vorgelesen (WCAG 3.3.1 „Fehlerkennzeichnung“, 4.1.3 „Statusmeldungen“). Auf einem Handy bekommt man nach einer abgelehnten Eingabe, etwa der Herkunft „X1“ (`web/app.js:1207–1216`), keine Rückmeldung. Das Feld behält zwar den Wert, und der Fokus kehrt dorthin zurück (`u.fokus = '#herkunft-neu'`), aber warum die Eingabe nicht gilt, sagt nichts.

„Neue Aufgabe“ ist auf dem Handy zusätzlich ohne Knöpfe. Anlegen geht nur über Enter in der Bildschirmtastatur. „Anlegen und weitere“ und „Abbrechen“ sind nicht erreichbar; Abbrechen geht nur über einen Tipp auf den Hintergrund. Die Karte nennt das nicht, es hat aber dieselbe Ursache.

`S.ui.fensterFehler` ist die eine Meldung des Fensters. Sie wird an rund 15 Stellen gesetzt (`web/app.js:358`, `:380`, `:427`, `:437`, `:999`, `:1155`, `:1161` und weitere), meist im `catch` eines Schreibwegs. Die Warteschlange (`:380`) kennt das Feld nicht, das den Schreibzugriff ausgelöst hat.

Die technische Frage ist deshalb größer als die Karte: **Welche Inhalte darf eine Breitenregel ausblenden, und wo leben die Meldungen eines Fensters über alle Breiten?** Ohne eine Regel wiederholt sich der Fehler bei jedem neuen Fenster und jeder neuen Breitenregel. Die Probe von R00077 (`e2e/tests/r00077-responsive.spec.js`) prüft Breite und Umbruch, aber keine Meldung und keinen Knopf.

### Qualitätsziele und Szenarien

- **Bedienbarkeit auf jedem Gerät** (Vision, R00077): Auf einem Handy mit 414 px wird eine abgelehnte Eingabe im Aufgabenfenster sichtbar und vorlesbar gemeldet, ohne Scrollen. Was bei 1280 px bedienbar ist, ist bei 414 px bedienbar.
- **Desktop unverändert** (R00077 „der Desktop bleibt, wie er ist“, Abnahme der Karte): Bei 1280 px ändert sich nichts.
- **Änderbarkeit**: Ein neues Fenster oder eine neue Breitenregel kann diesen Fehler nicht still wieder einführen.

## Optionen

| # | Option | Stärke | Schwäche |
|---|---|---|---|
| A | **Der Fuß bleibt in jeder Breite.** Schmal fallen nur Hinweis-Elemente einzeln weg (markiert als Hinweis), die Meldung bricht um. | Ein Ort für die Meldung, wie bisher. Kleinste Änderung: eine Regel in `kd-app.css`, ein Klassenname an zwei Hinweis-Spannen. Der Fuß steht unter dem scrollenden Körper (`.mod-body`, schmal `overflow:auto`) und ist ohne Scrollen sichtbar. Löst „Neue Aufgabe“ mit. Desktop bleibt. | Der Fuß kostet schmal eine Zeile Höhe, mit Meldung zwei oder drei. Die Meldung steht nicht am Feld; wer stark vergrößert, sieht Feld und Fuß nicht zugleich. |
| B | **Eigene Meldungszeile oben** im Fenster, unter dem Kopf, wie die Defektmeldung (`.archbar.warnbar`, `web/ansicht.js:520`), für alle Breiten. | Ein Ort, der schon für den Defekt so gebaut ist. Die Meldung steht oben, wo man nach dem Öffnen hinsieht. | Ändert den Desktop gegen R00077 und die Abnahme der Karte. Löst die Knöpfe von „Neue Aufgabe“ nicht. Oben ist weit weg von einem Feld im unteren Teil des Fensters. |
| C | **Meldung je Feld** unter dem auslösenden Feld, verbunden über `aria-describedby`, `aria-invalid`. | Am besten für WCAG 3.3.1: Die Meldung nennt das Feld und steht daneben. | `fensterFehler` hat kein Feld. Jeder der rund 15 Schreibwege müsste sein Feld mitgeben, die Warteschlange (`web/app.js:380`) kennt es nicht. Entweder großer Umbau aller Schreibwege, oder zwei Mechanismen nebeneinander (Feld, wo bekannt, sonst Fuß). Löst die Knöpfe nicht. |
| D | **Meldung als Toast** über den vorhandenen Bereich `.toast` (`web/ansicht.js:717–718`), der in jeder Breite steht. | Kein neuer Ort. | Der Toast liegt außerhalb des Dialogs; in einem modalen Dialog lesen Screenreader ihn nicht zuverlässig. Er verschwindet nach Zeit, ein Fehler soll stehen bleiben, bis er behoben ist. Löst die Knöpfe nicht. |

Datenhoheit: In allen Optionen bleibt `S.ui.fensterFehler` (bzw. `f.fehler` für „Neue Aufgabe“) die einzige Quelle der Meldung. Keine Option dupliziert den Zustand. Eine zweite gezeichnete Kopie (eine für breit, eine für schmal) ist keine Option: Zwei `role="alert"` an der Grenze würden doppelt vorgelesen.

## Entscheidung

**Option A.** Ausschlaggebend: Sie löst die Karte und den gleichartigen Befund in „Neue Aufgabe“ mit einer Regel, lässt den Desktop unverändert und bleibt bei einem Meldungsort je Fenster. In Kauf genommen wird, dass die Meldung nicht am Feld steht (Stärke von C). Der Fuß ist bei jeder Breite ohne Scrollen sichtbar, und der Fokus steht nach einer abgelehnten Eingabe wieder im Feld.

### Regeln

1. **Breitenregeln blenden nie einen Container aus, der eine Meldung oder eine Aktion trägt.** Meldung heißt `role="alert"`, `role="status"` oder `aria-live`. Aktion heißt ein Knopf oder Link, der sonst nirgends erreichbar ist. Ausgeblendet werden nur Elemente, die ausdrücklich Hinweis sind, einzeln und nicht über ihren Container.
2. **Hinweise tragen eine Markierung im Markup**, zum Beispiel die Klasse `hinweis` an den Tastenhinweisen in `web/ansicht.js:187` und `:256`. Die schmale Regel blendet `.mod-fuss .hinweis` aus, nicht `.mod-fuss`. Den Namen wählt der entwickler; nicht `.leer` (vergeben).
3. **Ein Meldungsort je Fenster bleibt der Fuß.** Schmal bricht er um (`flex-wrap`, `white-space:normal` für die Meldung), statt abzuschneiden; die Meldung nimmt eine eigene Zeile. Die Knöpfe behalten `--kd-ziel` (ADR-0012) und brechen gemeinsam um. Nichts scrollt quer (R00077 US-1).
4. **Die Meldung nimmt keinen Fokus** (ADR-0010). Der Fokus bleibt bzw. kehrt dorthin zurück, wo die Eingabe war (`u.fokus`, ADR-0007), damit man berichtigen kann. Angesagt wird über `role="alert"`.
5. **Ab 641 px ändert sich nichts** am gezeichneten Fuß. *(→ N1: ersetzt durch „Umbruch nach Bedarf, einzeilig nur, wo alles passt“)*

### Durchsetzung (Fitness-Funktion)

Die E2E-Probe gehört neben `e2e/tests/r00077-responsive.spec.js` (oder in sie) und läuft bei 414 px Touch und 1280 px fein.

- **Karte #74:** Fenster öffnen, Herkunft „X1“ eingeben, Enter. Die Meldung hat `getClientRects().length > 0`, erscheint im `ariaSnapshot` als `alert`, und `document.activeElement` ist `#herkunft-neu`. Bei 1280 px ist der Fuß gezeichnet wie vorher (gleiche Höhe, eine Zeile). *(→ N1: mit der Meldung aus „X1“; eine lange Meldung bricht um)*
- **„Neue Aufgabe“:** Titel leer, „Anlegen“ antippen. Der Knopf ist sichtbar, und die Meldung erscheint als `alert`.
- **Allgemein (verhindert die Wiederholung):** Je offenem Fenster bei 414 px hat jeder Knopf, der bei 1280 px im Fenster sichtbar ist, Client-Rects. Ausgenommen ist nur eine benannte Liste mit Grund (heute `#vsc`, der Link „In VS Code öffnen“ mit `vscode://`, der auf dem Handy kein Ziel hat; `.mod-kopf .nav`, `.cls`, `.pfad` sind keine Knöpfe). Jedes `[role=alert]`, `[role=status]` und `[aria-live]` im Fenster, das gezeichnet ist, hat Client-Rects.
- **Mutanten, die rot werden müssen:** `.mod-fuss{display:none}` wieder in die Regel bis 640 px; `.hinweis` vom Tastenhinweis an die Meldung verschoben.

Unit-Ebene entfällt mit Grund: Es gibt keine reine Logik, nur CSS und Markup. Integration entfällt: Server und API ändern sich nicht.

## Konsequenzen

- Positiv: Fehler und Statusmeldungen der Fenster sind auf dem Handy sichtbar und vorlesbar. „Neue Aufgabe“ ist auf dem Handy wieder vollständig bedienbar. Die Regel gilt für jedes künftige Fenster.
- Negativ: Schmal kostet der Fuß Höhe. Bei einem kurzen Fenster mit Bildschirmtastatur bleibt weniger Platz für den Körper.
- Neutral: Desktop unverändert. ADR-0010 und ADR-0012 bleiben unverändert, ihre Regeln gelten für die nun sichtbaren Knöpfe.

### Pre-Mortem

| Wie es scheitert | Gegenmittel |
|---|---|
| Ein neues Fenster setzt seine Meldung wieder in einen schmal ausgeblendeten Container. | Allgemeine Probe oben: Meldung und Knöpfe bei 414 px gegen 1280 px. |
| Die Meldung wird bei jedem Neuzeichnen erneut angesagt: `render()` ersetzt das Markup per `innerHTML`, das `role="alert"`-Element wird bei jedem Live-Ereignis neu eingefügt. | Nicht durch diese Entscheidung entstanden, auf dem Desktop schon heute so. Ungeprüft, braucht einen Screenreader. Offene Frage unten. |
| Eine lange Meldung wird auf dem Desktop abgeschnitten: `.mod-fuss` hat `white-space:nowrap; overflow:hidden` (`web/kd-app.css:367`). | Nicht Teil dieser Karte (1280 px bleibt). Vorschlag für eine eigene Karte. *(→ N1: erledigt durch Umbruch nach Bedarf, #84)* |
| `fensterFehler` wird gesetzt, wenn kein Fenster offen ist (`alle-freigeben`, `web/app.js:997–1001`, aus dem Pop „Boards“). Die Meldung hat dann keinen Ort. | Nicht Teil dieser Karte. Vorschlag für eine eigene Karte. |

## Offene Fragen

- Wird eine bei jedem `render()` neu eingefügte `role="alert"`-Meldung von NVDA, VoiceOver und TalkBack wiederholt angesagt? Wenn ja, braucht das Zeichnen einen stabilen Meldungsknoten (ADR-0007 sichert heute Fokus und Scroll, nicht Knoten). Prüfbar mit einem Screenreader, nicht im Headless-Browser.

## Quellen / Bezüge

- Karte #74; R00077 Responsive für Tablet und Handy; ADR-0007 Sichtzustand; ADR-0010 Fokusführung; ADR-0012 Zielgrößen (Risiko „Hof unter `overflow:hidden` (`.mod-fuss`)“, Z. 90); Aspekt [X00003 Zielgrößen](../Architektur/Aspekte/X00003-zielgroessen.md)
- WCAG 2.2: 3.3.1 Error Identification, 4.1.3 Status Messages
- Code auf kanbanD `6636db3`: `web/kd-app.css:367`, `:829–848`; `web/ansicht.js:187`, `:256`, `:520`, `:717–718`; `web/app.js:380`, `:997–1001`, `:1207–1216`

## Nachtrag 2026-11-07: Umbruch nach Bedarf (R00111)

**Anlass**: Karte #74, [R00111](../../Anforderungen/R00111-behebung-meldungen-und-knoepfe-schmaler-fenster.md) Lösung 4. Die UX-Vorprüfung hat gemessen: Zwischen 641 und etwa 895 px schneidet `.mod-fuss{white-space:nowrap; overflow:hidden}` (`web/kd-app.css:367`) den Knopf „Anlegen“ von „Neue Aufgabe“ ab. Das ist dieselbe Fehlerklasse, die diese ADR verhindern soll (Regel 1: keine Aktion verschwindet), nur über `overflow` statt `display:none`. Regel 5 hat sie festgeschrieben. Die Wahl, Option A, gilt unverändert; der Status bleibt `Akzeptiert`. Geändert werden Regel 5 und eine Angabe der Kontexttabelle.

**Belegt (Code)**:
- Der Fuß von „Neue Aufgabe“ trägt Meldung, Tastenhinweis und eine Knopfgruppe mit `margin-left:auto` (`web/ansicht.js:187`). Einzeilig passt das erst ab etwa 896 px (UX-Vorprüfung, R00111 Z. 45).
- Die Uhrzeit von „gespeichert“ entsteht über `uhr = t => new Date(t).toTimeString().slice(0, 8)` (`web/ansicht.js:192`), also `HH:MM:SS`. Die Kontexttabelle oben nannte `HH:MM`.

**Gemessen** (architekt, Headless-Chromium gegen das echte Programm, Kopie-Board, kanbanD `791509c`, Aufgabenfenster bei 1280 × 800):

| Meldung | heute | Umbruch nach Bedarf |
|---|---|---|
| „„X1“ ist keine Herkunft — …“ (US-1) | Fuß 28 px, eine Zeile | Fuß 28 px, eine Zeile, gleich |
| lange Meldung (#84) | Fuß 28 px, Meldung endet bei 2195 px, Fuß bei 1180 px: abgeschnitten | Fuß 91 px, Meldung endet bei 1164 px: ganz lesbar |

### N1 Regel 5 neu und Uhrzeit

**Entschieden**:

1. **Regel 5 neu: Der Fuß bricht um, sobald sein Inhalt nicht in eine Zeile passt, in jeder Breite; einzeilig bleibt er nur, wo alles hineinpasst.** Heute gilt das bei „Neue Aufgabe“ ab etwa 896 px. Das Aufgabenfenster mit der Meldung aus US-1 bleibt bei 1280 px einzeilig und gleich hoch. Umgesetzt wird das mit `flex-wrap` und `white-space:normal` am Fuß in jeder Breite statt nur schmal (Regel 3); `overflow:hidden` am Fuß entfällt. Die Knopfgruppe bricht als Ganzes um, die Knöpfe behalten `--kd-ziel` (ADR-0012). Begründung: „Ab 641 px ändert sich nichts“ hielt ein Ziel fest, das die Breite meinte, nicht die Bedienbarkeit. Ab 641 px blieb so ein Abschneiden stehen, das Regel 1 verbietet. Das Vorbild im Haus ist die Werkzeugzeile, die bei Platzmangel umbricht statt quer zu scrollen (PO `AI-Team/po-entscheidungen.md` Z. 130, 140; ADR-0012). Das Qualitätsziel „Desktop unverändert“ gilt weiter für den Fall, in dem heute alles passt. Wo heute abgeschnitten wird, ist „unverändert“ kein Ziel.
2. **Kontexttabelle**: „gespeichert HH:MM“ heißt richtig „gespeichert HH:MM:SS“ (`web/ansicht.js:192`). Eine Korrektur der Angabe, keine Änderung am Verhalten.
3. **Pre-Mortem #84** (lange Meldung auf dem Desktop abgeschnitten) ist durch Ziffer 1 sachlich erledigt.

**Durchsetzung**, ergänzt zur Fitness-Funktion oben:
- **Vorbedingung**: Bei 1280 px mit der Meldung aus US-1 hat der Fuß dieselbe Höhe wie vor dem Fix und eine Zeile.
- **Gegenbedingung**: Bei 1280 px mit einer Meldung, die breiter ist als der Fuß, ist die Meldung ganz im Fuß. Ihr Rechteck liegt im Rechteck von `.mod-fuss`, und `scrollWidth ≤ clientWidth` gilt an der Meldung. Bei 641 × 896 und 768 × 1024 Touch liegt „Anlegen“ ganz im Fenster.
- **Mutanten, die rot werden müssen**:
  - `white-space:nowrap` am Fuß ab 641 px;
  - `overflow:hidden` am Fuß ab 641 px.

**Bezug**: Wie das Fenster mit offener Bildschirmtastatur dem sichtbaren Bereich folgt (R00111 Lösung 5), steht in einer eigenen Entscheidung, [ADR-0016](0016-fenster-folgen-dem-sichtbaren-bereich.md). Sie ist eine neue Frage mit eigenen Optionen, nicht die Fortschreibung einer Regel dieser ADR.

## Nachtrag 2026-11-15: abgelehnte Eingabe bleibt stehen, das Feld verweist auf die Meldung

**Anlass**: Karten #96 und #93 im Paket der Karte #54 („Aufgabenfenster: Felder und Fenstermeldung“). R00111 AK 1 hat das Verhalten für „Neue Herkunft“ gebaut; Titel und „Zeit nachtragen“ sind der zweite und dritte Fall derselben Regel.

**Belegt (Code)**:
- Einziger Schreibweg der Meldung ist `fensterMelden(text, feld = null)` (`web/app.js:664–667`); die Feldkennung trägt heute nur die Herkunft (`HERKUNFT_FELD`, `herkunftVerweis`, `web/ansicht.js:598–605`), ihr Entwurf liegt in `S.ui.herkunftEntwurf` (`web/app.js:1899–1901`, `:2354`).
- Titel: der `change`-Hörer setzt `titelBearbeiten = false` und ruft `aufgabeAendern` **ohne** Feldkennung (`web/app.js:2292–2295`). Nach einer Ablehnung zeichnet `render()` das Lesediv mit dem alten Titel (`web/ansicht.js:358–360`) — es gibt kein Eingabefeld mehr, das `aria-invalid` tragen könnte, und die Eingabe ist fort.
- Zeit nachtragen: `zeit-neu` ruft `schreiben(…)` (`web/app.js:1910–1915`), das die Meldung ohne Feldkennung setzt (`:535`); `#zeit-neu` wird leer neu gezeichnet (`web/ansicht.js:445`).

**Gebaut** (R00155, I0142, Zweig `karte/54`, Code-Stand `20cb14e`; am 2026-11-15 am Code gegengelesen, nicht erneut erprobt): Der Absatz „Belegt“ oben nennt den Stand vor dem Bau.
- Der eine Zustand ist `S.ui.entwurf`; `herkunftEntwurf` und `herkunftVerweis` gibt es nicht mehr.
- Die Feldkennungen sind `HERKUNFT_FELD`, `TITEL_FELD`, `ZEIT_FELD` (`web/ansicht.js:593–597`).
- Die eine Funktion des Renderers ist `vEntwurf` (`web/ansicht.js:600–604`). Sie ruft die reinen Funktionen `entwurfswert` und `meldungsverweis` (`web/sichtzustand.js:159–162`, `:205–209`; Unit `e2e/einheit/entwurf.test.js`) für Titel (`web/ansicht.js:359`), „Neue Herkunft“ (`:369`) und „Zeit nachtragen“ (`:445`).
- `fensterMelden(text, feld)` steht in `web/app.js:667–671`, `schreiben(…, feld)` in `:531–539`.
- Die Ziffern 1, 3 und 4 sind gebaut wie entschieden. Ziffer 2 ist um die Rangfolge beim Tippen ergänzt, Ziffer 5 eingeengt, Ziffer 6 neu. Die Wahl ist unverändert, der Status bleibt `Akzeptiert`.

### N2 Eine Regel für jedes Eingabefeld des Aufgabenfensters

**Entschieden**:

1. **Jede Ablehnung aus einem Eingabefeld nennt ihr Feld.** Der Aufruf, der aus einem Feld schreibt, gibt `fensterMelden` die Feldkennung mit; `schreiben` bekommt dafür denselben optionalen Parameter wie `aufgabeAendern`. Meldungen ohne Feld (Anhang, Rückgängig, Nachladen) bleiben ohne Kennung.
2. **Ein Entwurf je Fenster statt je Feld.** Die abgelehnte Eingabe liegt in einem Zustand der Form `{ nummer, feld, wert }`; `herkunftEntwurf` geht darin auf. Gesetzt vor dem Schreiben, wenn ein Entwurfsfeld abgeschickt wird (Titel, „Zeit nachtragen“, „Neue Herkunft“; `entwurfAbschicken`, `web/app.js:702–705`). Geleert, wenn der Schreibweg **desselben** Felds angenommen wird, beim Öffnen einer anderen Aufgabe, beim Schließen und bei Esc bzw. „Eingabe verwerfen“ ([ADR-0010 N9](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md)); alle Ausgänge stehen in Ziffer 6. Er ist reiner Sichtzustand (ADR-0007), nie Datei.
   - **Rangfolge beim Tippen** (R00155 G-2, product-owner 2026-11-15): Eine Ablehnung nimmt den Platz immer ein. In „Neue Herkunft“ folgt der Entwurf wie vor dem Paket dem Tippen, verdrängt aber nie die abgelehnte Eingabe eines anderen Felds (`entwurfNachTippen`, `web/sichtzustand.js:168–172`; `input`-Hörer `web/app.js:2530`). Getipptes in „Neue Herkunft“ geht deshalb ohne Meldung verloren, wenn danach ein anderes Feld abgelehnt wird, und es wird nicht gehalten, solange die abgelehnte Eingabe eines anderen Felds dasteht.
3. **Das Feld bleibt Eingabefeld mit dem abgelehnten Wert.** Solange die Meldung sein Feld nennt und der Entwurf zur offenen Aufgabe gehört, zeichnet der Renderer das Feld mit dem Entwurf, `aria-invalid="true"` und `aria-describedby="fenster-meldung"` — über **eine** Funktion für alle Felder, nicht je Feld eine Kopie von `herkunftVerweis`. Für den Titel heißt das: nach einer Ablehnung bleibt `titelBearbeiten` an. Der Fokus bleibt im Feld (Regel 4).
4. **Die Kennung `fenster-meldung` bleibt stabil.** Felder verweisen auf sie; wer den Meldungsknoten umbaut (offene Frage oben, Karte #86), behält die `id`.
5. **Aufgehoben** wird der Zustand „ungültig“ nur zusammen mit der Meldung (Ziffer 6). Der angenommene Schreibweg **desselben** Felds löscht beide. Der angenommene Schreibweg eines Felds ohne eigenen Entwurf oder einer anderen Aktion des Fensters lässt beide stehen. Eine andere Meldung des Fensters ersetzt sie. Die erste Fassung sagte „der nächste angenommene Schreibweg löscht sie“; R00155 G-3 hat das eingeengt, weil sonst ein ungültiges Feld ohne Meldung stehen blieb (Muss des code-reviewer).
   - **Nachtrag 2026-11-16 (R00185 108-2, Karte #108; Betreiber, vom Director freigegeben):** Dieselbe Regel gilt für die Meldung ohne Feld (Anhang, Rückgängig, Bewegen): Sie bleibt über den angenommenen Schreibweg einer anderen Aktion stehen, der Fuß zeigt dann „gespeichert hh:mm:ss“ und die Meldung. Sie geht mit einer neuen Meldung des Fensters, mit dem Schließen oder dem Öffnen einer anderen Aufgabe und mit dem Erfolg derselben Aktion; dafür kennt die Meldung ihren Auslöser (`fensterMelden(text, feld, ausloeser)`, Regel in `meldungGehtMitErfolg`, `web/sichtzustand.js`). Ob ein Schreibweg angenommen wurde, liest deshalb niemand mehr an der stehenden Meldung ab, sondern an der Rückgabe von `schreiben`.
6. **Meldung und abgelehnte Eingabe stehen und gehen nur gemeinsam** (R00155 G-3; product-owner und Betreiber 2026-11-15). Solange das Fenster eine abgelehnte Eingabe hält, steht ihre Meldung in `#fenster-meldung`, und ihr Feld ist Eingabefeld mit der abgelehnten Eingabe, `aria-invalid="true"` und `aria-describedby="fenster-meldung"`. Das gilt auch nach einem Wechsel der Ansicht und nach einem Neuzeichnen. Ein angenommener Schreibweg eines Felds ohne eigenen Entwurf oder einer anderen Aktion (Kommentar, Labels, Beschreibung, Spalte, Klasse, Fällig, Teilaufgabe, Anhang) lässt beide stehen; der Fuß zeigt dann „gespeichert hh:mm:ss“ **und** die Meldung (`meldungNachErfolgRaeumen`, `web/app.js:688–693`). Beide gehen nur in diesen fünf Ausgängen, benannt wie in R00155:
   - **(a)** Der Schreibweg **desselben** Felds wird angenommen (`schreiben`, `web/app.js:535–536`; `titelSpeichern`, `:765`; Herkunft, `:2049`).
   - **(b)** Esc im Feld oder der Knopf „Eingabe verwerfen“ (`eingabeVerwerfen`, `:805–806`; `eingabeVerwerfenPerKnopf`, `:861`; ADR-0010 N9 Ziffer 3 und 7).
   - **(c)** Eine andere Meldung des Fensters nimmt den Platz, sei es die Ablehnung eines anderen Felds oder eine Meldung ohne Feld (`fensterMelden` ruft `abgelehnteEingabeRaeumen`, `:667–684`).
   - **(d)** Das Fenster wird geschlossen oder eine andere Aufgabe geöffnet (`:736–737`, `:1660`, `:2677`).
   - **(e)** Der Nutzer schickt ein **anderes Entwurfsfeld** ab (Titel, „Zeit nachtragen“, „Neue Herkunft“). Dessen Eingabe nimmt den einen Platz des Fensters. Die frühere abgelehnte Eingabe und ihre Meldung gehen **schon beim Abschicken**, gleich ob die neue Eingabe angenommen oder abgelehnt wird (`entwurfAbschicken`, `:702–705`). Entschieden vom Betreiber am 2026-11-15: kein zweiter Halter, das gebaute Verhalten gilt; „abgeschickt“ ist kein Entwurf ([ADR-0010 N9](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) Ziffer 4).

   In (c), (d) und (e) zeigt das bisherige Feld wieder den Stand der Datei (Titel im Lesezustand, „Zeit nachtragen“ und „Neue Herkunft“ leer) und trägt weder `aria-invalid` noch `aria-describedby`. In jedem Ausgang gilt der Kern: nie eine abgelehnte Eingabe ohne ihre Meldung, nie eine Meldung ohne ihr Feld.

   `S.ui.entwurf` bleibt der einzige Halter eines Werts. `abgeschickteFelder` (`web/app.js:772`) führt nur Feldnamen, `feldVorDemVerwerfen` (`:832`) nur einen Verweis auf ein Element.

**Verworfen**: je Feld ein eigener Entwurf und ein eigener Verweis (heutiges Muster, dreifach) — einfacher zu lesen, aber jeder neue Fall vergisst eine der vier Stellen (Setzen, Leeren, Zeichnen, Esc), wie #96 und #93 zeigen. Verworfen auch: nur `aria-invalid` ohne stehende Eingabe — das Feld zeigte dann den alten Wert als ungültig.

**Akzeptierte Schwäche**: Ein Entwurf je Fenster hält nur die zuletzt abgelehnte Eingabe; zwei gleichzeitig ungültige Felder gibt es nicht, weil es nur eine Fenstermeldung gibt (Datenhoheit oben). Daraus folgt, in R00155 in Kauf genommen: In den Ausgängen (c) und (e) der Ziffer 6 verschwindet eine abgelehnte, nie gespeicherte Eingabe ohne eigenen Hinweis, in (e) auch dann, wenn die neue Eingabe gespeichert wird (Betreiber 2026-11-15). Dasselbe gilt für Getipptes in „Neue Herkunft“ nach Ziffer 2. Verloren gehen wenige Zeichen, nie etwas aus der Datei, und es bleibt kein falscher Stand stehen.

**Durchsetzung**, ergänzt zur Fitness-Funktion: je Feld (Herkunft „X1“, Titel leer, Zeit „abc“) — nach der Ablehnung steht die Eingabe im Feld, das Feld hat den Fokus, `aria-invalid="true"`, `aria-describedby` zeigt auf ein vorhandenes `#fenster-meldung`; nach der Berichtigung sind beide Attribute fort. Mutanten, die rot werden müssen: Aufruf ohne Feldkennung; Entwurf nach Erfolg nicht geleert (alter Wert steht im Feld). Review-Punkt für architektur-reviewer und code-reviewer: ein zweiter Entwurfszustand neben dem einen ist ein Befund.

**Durchsetzung zu Ziffer 2 und 6** (gebaut; Proben `e2e/tests/r00155-abgelehnte-eingabe.spec.js`, `e2e/tests/r00155-titel-nach-fremdem-erfolg.spec.js`, Unit `e2e/einheit/entwurf.test.js`):
- Rangfolge: Nach abgelehnter Dauer in „Neue Herkunft“ tippen und die Ansicht wechseln → die Dauer steht weiter, ungültig, mit Meldung (G-2 b). Mutant, der rot wird: Tippen überschreibt den Entwurf eines anderen Felds (M-G2).
- Gemeinsam stehen: Nach abgelehntem Titel einen Kommentar oder Labels speichern → Titelfeld weiter ungültig, Meldung steht. Varianten Dauer und Herkunft.
- Gemeinsam gehen, Ausgang (c): Nach abgelehnter Dauer eine Meldung ohne Feld → „Zeit nachtragen“ leer und nicht ungültig. Mutant, der rot wird: eine Meldung ohne Feld lässt die abgelehnte Eingabe stehen (M-G3b).
- Ausgang (e): die Proben (e-1) und (e-2) aus R00155 (Bubble B0762). Sie prüfen geltendes Verhalten, ein Mutant ist dafür nicht verlangt.

## Nachtrag 2026-11-16: Die Fenstermeldung behält beim Neuzeichnen ihren Knoten (Karte #86, R00189)

### N3 Knoten beim Zeichnen wiederverwenden

Der Knoten der Fenstermeldung wird beim Zeichnen wiederverwendet: `render()` hält ihn vor dem Ersetzen von `#over` fest und setzt ihn an die Stelle des frisch gezeichneten, solange dasselbe Aufgabenfenster offen ist und die Meldung seit ihrem Setzen nicht neu gesetzt wurde. Ein Knoten außerhalb der ersetzten Bereiche ist verworfen: er nähme die Rolle `alert` aus dem Fensterfuß, an den Regel und Proben dieser Entscheidung sie binden (gezählt: 11 Dateien unter `e2e/tests/` suchen sie dort), und läge außerhalb des modalen Fensters. Ob ein wieder eingehängter Knoten in NVDA, VoiceOver und TalkBack schweigt, ist im Headless-Browser nicht prüfbar und bleibt ein Prüfpunkt der Abnahme; die offene Frage oben ist damit für das Headless-Gate beantwortet (der Knoten wurde ersetzt), für das Vorleseprogramm nicht.
