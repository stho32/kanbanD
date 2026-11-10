---
id: R00117
status: Neu
datum: 2026-11-11
---

# R00117: Härtung der Kopfzeile: API-Kopf, Auswahlzeichen, Touch-Maß, Begriffe

## Beschreibung

Die Reviews der abgenommenen Karte R00101 (Kopfzeile auf jeder Breite bedienbar) ließen vier Sollte- und Optional-Befunde übrig, die nach der Regel „Nacharbeit nur für Muss“ nicht mehr in R00101 selbst, sondern in die Härtungskarte #17 gesammelt wurden (Stand `ddeb2a5`). Diese Anforderung ist ihre Heimat:

1. **API-Seite (Regression, code-review).** `/api` zeigt Titel und „zur Oberfläche“ untereinander, der Link sitzt links. Ursache: der Server zeichnet die Seite noch im alten Zwei-Zonen-Markup `.kz-z1`/`.kz-z3` (`src/web/endpunkte.rs:123`), seit `bc22b8c` ist `.kz` ein Spalten-Container, und die SPA baut Kopfzeilen aus `.kz-reihe` (`web/ansicht.js:44`). Die fehlende Kopfzeilen-Layout-Probe ließ den Regress durch: `/api` liegt in `ziele.spec.js:340` und der Kultur-Probe, aber in keiner Kopfzeilen-Layout-Probe.
2. **Gewählter Zustand nur über die Fläche (ux S2).** Die Bereichs-Chips unter 840 px erreichen im Dunkelthema ≈ 1,55:1 gegen die Kopfzeile und tragen kein Häkchen; „Signale oben“ im Menü „Mehr“ (`role="menuitemcheckbox"`) hat kein Kästchen und sieht aus wie „aktuelle Seite“. Die vom Betreiber freigegebene Skizze (`R00101-kopfzeile.html`, `ad0c39b`) zeichnet „✓ alle“ und „☑ Signale oben“. Es gilt ADR-0011 Regel 3 (zustandstragende Fläche oder Linie ≥ 3:1) plus das Material-3-Detail (Häkchen am gewählten Zustand).
3. **Bereichs-Umschalter unter Touch (ux O1, Optional).** Am Stand `ddeb2a5` war `.seg span` bei 840–1199 px mit `pointer:coarse` 24 px hoch. Seit #10/ADR-0012 gilt zentral `--kd-ziel` (48 px bei `pointer:coarse`, `web/kd-tokens.css:48`/`:124`) und die Basisregel deckt `[role=radio]` (`web/kd-base.css:9`); `.seg span` ist über `role="radio"` erfasst (`web/ansicht.js:115`). Rechte Messlatte ist der Token (≥ 44 px), nicht 32. Bleibt die Probe grün, ist Punkt 3 erledigt und nur festzuhalten.
4. **Begriffe (rechtschreib Sollte, ux).** Der Menüeintrag „Laufende Timer“ (`web/ansicht.js:131`) öffnet den Überblick „Läuft gerade“ — einheitlich „Läuft gerade“; in compact steht der Eintrag auch bei 0 Timern und öffnet nichts → bei 0 ausblenden. „Spalten“ in R00101/US-3 gegen „Spalten einrichten“ in der Oberfläche angleichen. `Dokumentation/Gelerntes.md:46` nach dem Doppelpunkt groß („… zu schwach: Ein Knopf …“).

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … es ist per Tastatur bedienbar und folgt gewohnten Konventionen.“ Ein sichtbarer gewählter Zustand, ein einheitlicher Begriff und ein Kopf, der nicht auseinanderfällt, gehören dazu; die Gestaltungsrichtung „Blaugrau, eckig, dicht“ bleibt.

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Die Kopfzeile ist der Ort, an dem am Board alles beginnt. Drei Sollte-Befunde aus der Abnahme von R00101 sind dort stehen geblieben: ein gewählter Bereich, den man im Dunkelthema nicht erkennt; ein Menüeintrag, der zweimal anders heißt als das, was er öffnet; und ein Serverkopf auf `/api`, der nach einem Umbau links und untereinander steht. Alle vier sind klein und umkehrbar — aber jede weitere Durchsicht, die sie findet, kostet einen Lauf. Eine Karte, die die vier Befunde je mit einer Probe schließt, macht die drei Wächter (Kopfzeilen-Layout, Kontrast, Kultur) schärfer und den Begriffsvorrat einheitlich; danach fällt derselbe Fehler nicht wieder durch.

## Funktionale Anforderungen

### API-Seite (Punkt 1, Regression)

1. `api_seite` (`src/web/endpunkte.rs`) zeichnet den Kopf einer Seite aus `header.kz` mit einem `div.kz-reihe`; `kz-z1`/`kz-z3` entfallen. Der Titel steht links im `.kz-z1`, der Link „zur Oberfläche“ (`a.kz-btn`) rechts in derselben Zeile.
2. Die Kopfzeilen-Layout-Probe deckt `/api` mit ab (y-Gleichheit Titel/Link, Link rechtsbündig), bei 1280 × 720 und bei den zehn Breiten der Kopfzeilen-Familie; `/api` bleibt in der gemeinsamen Ansichtenliste (`ziele.spec.js`/Kultur).
3. Grenzfall 320 px: Die Kopfzeile von `/api` scrollt nicht waagrecht und der Link liegt ganz im Fenster.

### Auswahlzeichen (Punkt 2, ADR-0011 Regel 3 + M3)

4. Die Bereichs-Chips (`vBereichChips`) tragen am gewählten Zustand (`aria-checked="true"`) ein sichtbares Häkchen („✓“), das der nicht gewählte Chip nicht trägt.
5. Der Menüeintrag „Signale oben“ (`role="menuitemcheckbox"`, `#signale-oben`) trägt bei `aria-checked="true"` ein sichtbares Kästchen („☑“), das bei `aria-checked="false"` fehlt.
6. Alternativ zum Zeichen gilt eine Fläche gegen die Kopfzeile von mindestens 3:1. Beides zugleich ist erlaubt; entschieden wird das Zeichen, weil die Skizze es zeigt (siehe Optionen).
7. Farben und Flächen folgen den Paaren aus ADR-0011; kein neuer Farbwert außerhalb `web/kd-tokens.css`.

### Touch-Maß (Punkt 3, Optional)

8. Bei grobem Zeiger (`pointer:coarse`) ist jede Zelle des Bereichs-Umschalters (`alle`, `meine`, `Agenten`) mindestens `--kd-ziel` hoch — der Token, nicht ein Kopfzeilen-eigener Wert. Kein neuer Zahlenwert.

### Begriffe (Punkt 4)

9. Der Menüeintrag für die laufenden Timer heißt „Läuft gerade“ (wie der Überblick, den er öffnet) und zeigt die Zahl der laufenden Timer.
10. Bei 0 laufenden Timern erscheint der Eintrag nicht.
11. US-3 der Anforderung R00101 nennt im Wortlaut „Spalten einrichten“ (nicht „Spalten“).
12. `Dokumentation/Gelerntes.md:46` beginnt nach dem Doppelpunkt mit Großbuchstaben („… zu schwach: Ein Knopf …“).

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Der gewählte Zustand ist ohne Farbe erkennbar (Zeichen oder Fläche ≥ 3:1, ADR-0011 Regel 3, WCAG 2.1 SC 1.4.11). `aria-checked` bleibt die Wahrheit; das Zeichen ist rein darstellend.
- **Kulturtreue**: alle sichtbaren Begriffe der Kopfzeile stimmen mit dem Ort überein, den sie öffnen (Kultur-Probe `e2e/einheit/kultur.test.js`, `kultur.spec.js`).
- **Kein Querscrollen**: bei 320 px scrollt keine Kopfzeile waagrecht (`scrollWidth = clientWidth`), auch auf `/api`.
- **Rückwärtskompatibel**: `/api` bleibt eine vollständige HTML-Seite mit dem Titel „kanbanD · API“; die vorhandenen Proben (`tests/api.rs`, `r00024-api.spec.js`, `ziele.spec.js`) bleiben grün.

## Akzeptanzkriterien

Gegeben für jede Probe: das Board „entwicklung“ des Grundbestands, über die API herstellbar; für Punkt 2 zusätzlich ein Zustand mit 0 und mit laufenden Timern.

### F: API-Kopf (Punkt 1)

- [ ] **1. Abnahme-Probe der Karte #17, wörtlich**: „Playwright 1280 × 720 auf `/api` — `boundingBox().y` des Links „zur Oberfläche“ = y des Titels „kanbanD · API“, und `x + width ≥ 1280 − 24`.“
  - Besteht: Link und Titel liegen auf derselben Kopfzeile (y gleich, Toleranz 1 px), der Link endet höchstens 24 px vom rechten Fensterrand.
  - Fällt durch: heute — Link unter dem Titel, links.
  - Prüfebene: E2E `r00024-api.spec.js` (erweitert) bzw. die Kopfzeilen-Layout-Familie.
- [ ] **2. In der Kopfzeilen-Layout-Familie**: `/api` wird in die Probe der Kopfzeilen-Bedienelemente aufgenommen (`B0263`-Muster, `kopfzeile-hilfen.js`); bei 320, 375, 768, 1280 px liegt der Link ganz im Fenster und die Kopfzeile scrollt nicht waagrecht.
  - Prüfebene: E2E, Ansichtenliste.
- [ ] **3. Rückwärts**: `tests/api.rs` (Seite enthält jeden Pfad, Maskierung) und `r00024-api.spec.js` bleiben grün; `ziele.spec.js` misst `/api` weiter.

### F: Auswahlzeichen (Punkt 2)

- [ ] **4. Abnahme-Probe der Karte #17, wörtlich**: „bei 375 px in hell und dunkel trägt jedes Element mit `aria-checked=\"true\"` in `header.kz` und `#pop` ein sichtbares Zeichen (✓/☑, Text oder `::before`), das bei `aria-checked=\"false\"` fehlt — alternativ Fläche gegen Kopfzeile ≥ 3:1.“
  - Besteht: `.kz-chip[aria-checked=\"true\"]` hat ein sichtbares Häkchen (Text oder `::before`), `.kz-chip[aria-checked=\"false\"]` keines; `#signale-oben[aria-checked=\"true\"]` hat ein Kästchen; in beiden Themen.
  - Fällt durch: heute — Chip dunkel ≈ 1,55:1, kein Zeichen; Kästchen fehlt.
  - Prüfebene: E2E `r00117` (neu), `getComputedStyle(el,'::before')`/Rechteck; `kontrast`-Paar für die Fläche, falls der ux-Fall Fläche wählt.
- [ ] **5. Gegenbeispiel**: Wechsel „alle“ → „meine“ verschiebt das Zeichen (das alte Element verliert es, das neue bekommt es); ein nicht gewählter Chip trägt nie ein Zeichen. „Signale oben“ ein-/ausschalten lässt nur das Kästchen erscheinen/verschwinden.
- [ ] **6. Zustand**: bei `aria-checked=\"false\"` ist weder Zeichen noch `::before`-Inhalt vorhanden (leerer `content` bzw. abwesender Textknoten).

### F: Touch-Maß (Punkt 3)

- [ ] **7. Abnahme-Probe der Karte #17, verschärft auf den Token**: „960 px, `hasTouch`/`isMobile` → alle, meine, Agenten je Höhe ≥ 44 px“ (Token `--kd-ziel` = 48, Untergrenze 44 nach ADR-0012/PO Z. 130).
  - Besteht: jede `.seg span` (bzw. der Chip, falls die Stufe Chips zeigt) ist ≥ 44 px hoch.
  - Fällt durch: nur, wenn die Basisregel/Kette nicht greift; nach ADR-0012 voraussichtlich grün.
  - Prüfebene: E2E; Muster `ziele.spec.js` (`breiteMessen`, `hasTouch`). Bleibt grün → kein Fix, nur Festhalten (Beleg im Bericht).

### F: Begriffe (Punkt 4)

- [ ] **8. Menüeintrag**: `grep -n \"Laufende Timer\" web/ansicht.js` liefert 0 Treffer; der Eintrag heißt „Läuft gerade“.
- [ ] **9. 0 Timer**: bei 0 laufenden Timern enthält das Menü „Mehr“ kein `#mehr-lauf`; mit einem laufenden Timer erscheint `#mehr-lauf` mit der Zahl.
- [ ] **10. Anforderung**: US-3 in `Anforderungen/user-stories/R00101.md` nennt „Spalten einrichten“; `grep -n 'dort „Spalten“ wähle'` liefert 0 Treffer.
- [ ] **11. Lehre**: in `Dokumentation/Gelerntes.md:46` steht nach dem Doppelpunkt „schwach: Ein Knopf“ (Großbuchstabe); `grep -n 'schwach: ein Knopf'` liefert 0 Treffer.

## Betroffene Verzeichnisstruktur

```
src/
└── web/endpunkte.rs     # api_seite: Kopf auf .kz-reihe (kz-z1/kz-z3 entfallen)
web/
├── ansicht.js           # vBereichChips (:114) Häkchen, vBereich (:115), vMehrPop (:127 Signale oben, :131 Läuft gerade/0-Ausblenden)
└── kd-app.css           # .kz-chip.an (:47), .iz.an (:243), Häkchen-Regeln
e2e/
├── tests/               # r00117 (neu), r00024-api.spec.js (Kopf erweitert), ziele.spec.js/kultur.spec.js (Ansichtenliste, /api)
└── einheit/             # kultur.test.js läuft mit
Anforderungen/
└── user-stories/R00101.md   # US-3 Wortlaut „Spalten einrichten“
Dokumentation/
└── Gelerntes.md         # :46 Großschreibung nach dem Doppelpunkt
```

## Technische Überlegungen

### Optionen (Punkt 1 — API-Kopf)

| | A: `/api` auf die aktuelle Zeilenstruktur nachziehen | B: `kz-z3` per CSS wieder nach rechts (`margin-left:auto`) | C: eigene Kopfklasse nur für `/api` |
|---|---|---|---|
| Komplexität | gering: Markup des Servers an das der SPA angleichen | gering: eine CSS-Regel | mittel: neuer Kopfweg neben der SPA |
| Robustheit | hoch: ein Kopfweg für SPA und `/api` | niedrig: hält nur die heutige Sicht, bricht beim nächsten Umbau erneut | niedrig: zweite Wahrheit für dieselbe Kopfzeile |
| Testbarkeit | hoch: dieselbe Kopfzeilen-Layout-Probe für beide | niedrig: die Probe bliebe eine Sonderprobe | mittel |
| Regel „ein Ort“ | erfüllt: `.kz-reihe` als eine Struktur | verletzt: zwei Layoutwege | verletzt |

**Entscheidung: A.** Der Architekt hat bestanden: Punkt 1 ist ein Fehler, kein neuer Aspekt — der Server zeichnet `/api` noch im alten Markup. B behebt nur den sichtbaren Fall und lässt den Regress beim nächsten Umbau wieder zu; C führt eine zweite Kopfzeilen-Wahrheit ein.

### Optionen (Punkt 2 — gewählter Zustand)

| | A: Häkchen (Zeichen) | B: Fläche ≥ 3:1 | C: Häkchen und Fläche |
|---|---|---|---|
| Deckt die Probe | ja (Zeichen) | ja (Fläche) | ja |
| Skizze `R00101-kopfzeile.html` | deckt sie („✓ alle“, „☑ Signale oben“) | widerspricht ihr → neue Freigabe | deckt sie, geht darüber hinaus |
| Aufwand | gering: ein `::before`/Glyph | gering: ein Token-Paar | mittel: beides |
| Sichtbare Änderung | ein Zeichen am gewählten Eintrag | eine Fläche mehr | zwei Merkmale |

**Entscheidung: A.** Die freigegebene Skizze zeichnet das Zeichen; B wäre eine Gestaltung gegen die gezeichnete Anordnung und bräuchte eine neue Freigabe. C übererfüllt ohne Anlass. Der ux-Fall darf B wählen, falls er die Fläche vorzieht — dann ist die Skizze nachzuziehen.

### Ablauf (den Zuschnitt entscheidet der Entwickler)

1. **API-Kopf**: `api_seite` auf `header.kz` + `div.kz-reihe` umstellen; `/api` in die Kopfzeilen-Layout-Probe aufnehmen; bei 320 px kein Querscrollen.
2. **Auswahlzeichen**: Chips ein Häkchen (nur bei `aria-checked="true"`), „Signale oben“ ein Kästchen; Fläche/Kontrast unverändert (ADR-0011).
3. **Touch-Maß**: Probe über `--kd-ziel`; nur bei rot nachziehen.
4. **Begriffe**: Menüeintrag „Läuft gerade“ und 0-Ausblenden; `R00101/US-3`-Wortlaut; `Gelerntes.md:46`.

### Wächter

`r00024` (API-Seite), `r00101` (Kopfzeile), `ziele` (Zielgrößen/Breiten), `kontrast` (ADR-0011), `kultur` (Begriffe/Texte) laufen mit; dazu die vier neuen Proben (API-Kopf, Auswahlzeichen, Touch-Maß, Begriffe).

## Tests

Nach Skill `test-pyramide`; jede Szene der User Story ein Test, jeder prüft eine sichtbare Zustandsänderung (Skill `test-ehrlichkeit`).

- **E2E (Playwright)**: neu `r00117` mit US-1 bis US-4; `/api` zusätzlich in der Kopfzeilen-Layout-Probe; Muster `ziele.spec.js` (`breiteMessen`, `hasTouch`), `kultur.spec.js`, `r00024-api.spec.js`.
- **Rot vor dem Bau**: Punkt 1 und Punkt 2 sind heute rot (Link untereinander/links; Chip dunkel ohne Häkchen, Kästchen fehlt); Punkt 4 rot (`Laufende Timer` vorhanden). Punkt 3 wird zuerst geprüft — ist er grün, wird er nicht rot erzeugt, sondern festgehalten.
- **Gegenproben (Mutanten)**: `.kz-reihe` entfernt → Punkt 1 rot; Häkchen-Regel zurückgenommen → Punkt 2 rot; `mehr-lauf` immer gezeichnet → Punkt 9 rot; `Laufende Timer` wieder gesetzt → Punkt 8 rot.
- **Mitlaufend grün**: `r00024`, `r00101`, `ziele`, `kontrast`, `kultur`, `node --test e2e/einheit/`.

## Abhängigkeiten

- ADR-0011 (Farbrollen und Kontrast als Probe), ADR-0012 (Zielgrößen, `--kd-ziel`); R00101 (Kopfzeile — die Skizze und die Probe), R00024 (`/api`-Seite), R00077 (Responsive), R00108 (Zielgrößen), R00109 (Kultur).
- Abgegrenzt, nicht Teil dieser Anforderung: die Kontrast-Paare selbst (I0096/R00107), die Zielgrößen-Probe über alle Ansichten (I0097/R00108), die Kopfzeilen-Anordnung nach M3 (I0083/R00101). Diese Karte härten nur nach.

## Offene Fragen

- Keine blockierende. Der ux-Fall entscheidet Punkt 2 (Häkchen wie die Skizze oder Fläche ≥ 3:1); Empfehlung: Häkchen, weil die Skizze es zeigt. Sollte die Fläche gewählt werden, ist die Skizze `R00101-kopfzeile.html` vor dem Bau nachzuziehen.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine — kein neuer Token, kein neues Dateiformat; `web/` ist per `include_bytes!` eingebettet, Änderungen werden erst nach `cargo build` und Neustart sichtbar.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser sind vier stehen gebliebene Sollte-/Optional-Befunde aus den Reviews von R00101. Drei davon sind unsichtbar geblieben, weil keine Probe sie hielt: die Kopfzeilen-Layout-Probe kannte `/api` nicht (Punkt 1), die Kontrast-Probe prüfte Flächen, aber nicht das Vorhandensein eines Zustandszeichens (Punkt 2), und die Begriffe stehen an mehreren Orten, ohne dass eine Probe sie gegeneinander hält (Punkt 4). Punkt 3 war beim Schreiben der Karte schon durch das zentrale `--kd-ziel` aus #10/ADR-0012 abgedeckt. Indem jeder Punkt eine eigene, wörtlich gefasste Probe bekommt (y-Gleichheit und Rechtsbündigkeit auf `/api`; sichtbares Zeichen oder Fläche ≥ 3:1 am gewählten Zustand; Höhe ≥ Token bei Touch; `grep` = 0 für „Laufende Timer“), fällt derselbe Fehler künftig durch einen Lauf, nicht erst durch die nächste Durchsicht. Das ist dieselbe Wirkungskette wie bei der Vorbildkarte #9 (I0096/R00107): ein Befund wird zur Probe, die Probe zum Wächter.

## Missing-Docs

- Keine neue Architektur-Regel; `A00009-oberflaeche.md` nennt `.kz-reihe` als die eine Kopfzeilenstruktur — der Serverkopf zieht nach, keine Abweichung.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene Interaction I0106 mit eigener Anforderung R00117, Elterndialog D0002. Muster: Karte #9 (I0096/R00107), ebenfalls eine review-abgeleitete Härtungskarte, die eine eigene Interaction bekam. Verworfen: Bubbles an die abgenommenen Interactions I0083 (R00101) und I0024 (R00024) hängen — beide sind geliefert (I0083 gruen, R00024 `status: Erledigt`); Sollte-Befunde wieder an sie zu hängen, öffnete ihre Abnahme und verteilte eine Karte über zwei Heimatorte. Der Grund, dass diese Karte überhaupt existiert („Nacharbeit nur für Muss“), ist genau diese Hausform.
- **Elterndialog D0002**: drei der vier Punkte liegen in der Kopfzeile (D0002), Punkt 1 auf der `/api`-Seite, die dieselbe `.kz`-Struktur trägt; die fehlende Probe gehört in die Kopfzeilen-Layout-Familie. `/api` steht ohne eigenen Bildschirm nur als API-Beschreibung (D0007).
- **Kein neuer Gestaltungszustand**: Die Skizze `Dokumentation/Wireframes/skizzen/R00101-kopfzeile.html` ist vom Betreiber freigegeben (`ad0c39b`) und zeichnet „✓ alle“ (Zustände 3–5) und „☑ Signale oben“ (Zustände 1/5); Punkt 2 bringt den Bau auf die gezeichnete Anordnung. Punkt 1 und 4 sind Fehlerbehebung bzw. Wortlaut, Punkt 3 ein Maß der gesehenen Gestaltung (Regeln b/a/d aus PO-Entscheidungen Z. 79). Daher **keine UX-Vorprüfung nötig**; die ux-Rolle entscheidet nur Häkchen vs. Fläche, und die Skizze gibt das Häkchen vor.
- **Einarbeitung Architektur (2026-11-11, bestanden, kein ADR)**: Punkt 1 Fehler/Regression (Server-Markup auf `.kz-reihe`, fehlende Probe ergänzen), Punkt 2 ADR-0011 Regel 3 + M3, Punkt 3 durch #10/ADR-0012 überholt (rechte Messlatte `--kd-ziel` ≥ 44), Punkt 4 rechtschreibung/ux.
