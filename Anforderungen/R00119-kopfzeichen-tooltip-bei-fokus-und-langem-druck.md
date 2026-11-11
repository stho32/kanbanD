---
id: R00119
status: Neu
datum: 2026-11-11
---

# R00119: Kopfzeichen ohne Hover erklären: Tooltip bei Tastaturfokus und langem Druck

## Beschreibung

Die Zeichen im Spaltenkopf — ⓘ (Kommentar), ✓ (Abschlussspalte), die Phase, die Grenze und das Eigentümer-Zeichen (Mensch/Agent) — erklären sich heute nur über den Mauszeiger (`title`). Ein Erklärtext, den nur ein Zeiger erreicht, erfüllt das Zielbild „per Tastatur bedienbar" nicht. Diese Anforderung gibt **allen** Kopfzeichen **einen** Erklärtext (Tooltip), der bei Tastaturfokus und bei langem Druck auf Touch erscheint und mit Esc schließt — auf Touch schließt außerdem ein Tippen außerhalb: bei Fokus und langem Druck verhalten sich alle Zeichen gleich, und der zugängliche Name am Auslöser bleibt derselbe Wortlaut. Der Tooltip ist nicht-modal: er nimmt keinen Fokus und ist keine eigene Fokus-Ebene.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … es ist per Tastatur bedienbar und folgt gewohnten Konventionen."

### Domänenbezug
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Spaltenkopf ist der Ort, an dem sich eine Spalte erklärt. Heute erklärt er sich nur dem Zeiger: Wer nur eine Tastatur hat oder am Touchgerät arbeitet, sieht keinen der Erklärtexte. Das trifft genau die Zeichen, die eine Regel tragen — das Eigentümer-Zeichen (R00097) und die Grenze (R00096) —, also die Stellen, an denen ein Missverständnis Arbeit oder Freigabe kostet. Diese Anforderung bringt den Erklärtext an einen Ort und an eine Anforderung des Menschen (Fokus, langer Druck) statt an den Zeiger; danach erbt jedes künftige Kopfzeichen denselben Mechanismus. Die Regel steht an genau einem Ort (PO-Entscheidung zu #3, Z. 53), statt als Teilstück in R00097.

## Funktionale Anforderungen

### Erklärtext und zugänglicher Name

1. Jedes Kopfzeichen trägt einen Erklärtext. **Auslösermenge** ist genau diese fünf Zeichen: ⓘ (Kommentar), ✓ (Abschlussspalte), Phase (`span.v.ph`), Grenze (`span.v`) und das Eigentümer-Zeichen (Mensch/Agent). **Nicht** Auslöser sind der Spaltenkopf selbst (`.bahn-kopf`, eigener `title`/Kontextmenü), der Knopf „Neue Aufgabe" (`.kopf-plus`, eigener Name) und der Signalzähler; die Ausweitung auf weitere `title`-Stellen im Projekt ist eine eigene Karte (ADR-0020 „Geltung", Folgekarte). Die `title`-Attribute der fünf Zeichen entfallen — der Erklärtext steht am Auslöser als zugänglicher Name und als Tooltiptext.

**Wortlaut je Zeichen** (Tooltiptext = zugänglicher Name, wörtlich gleich; `<n>` ist die Grenze, `<Name>` der sichtbare Phasenname, `<notiz>` der Kommentar der Spalte):

| Zeichen | Wortlaut (Tooltiptext = zugänglicher Name) |
|---|---|
| ⓘ (Kommentar) | `Kommentar: <notiz>` — eine Formulierung, als `aria-label` und als Tooltiptext |
| ✓ (Abschlussspalte) | `Abschlussspalte` |
| Phase (`span.v.ph`) | `Phase: <Name>` — enthält den sichtbaren Phasennamen (WCAG 2.5.3) |
| Grenze normal (`span.v`) | `Grenze <n> — höchstens <n> Karten in dieser Spalte` |
| Grenze überschritten | sichtbarer Text `Grenze <n> · überschritten` davor: `Grenze <n> · überschritten — höchstens <n> Karten in dieser Spalte` |
| Eigentümer Mensch | `Spalte gehört dem Menschen — Agenten können Karten hineinlegen, aber nicht herausnehmen` (R00097) |
| Eigentümer Agent | `Spalte gehört den Agenten — kennzeichnet nur, sperrt nichts` (R00097/PO Z. 50) |
| Eigentümer keiner | kein Zeichen, kein Auslöser, kein Tooltip (R00097) |

2. Der **zugängliche Name am Auslöser** ist **wörtlich** derselbe Text wie der sichtbare Tooltiptext — keine abweichende zweite Formulierung (ADR-0018). Der Tooltip ist über `aria-describedby` am Auslöser verbunden; er ersetzt den Namen nicht und wird keine zweite Namensquelle. Trägt der Name den vollen Erklärtext, ist zu entscheiden, ob `aria-describedby` entfällt, weil Hilfstechnik den Satz sonst zweimal liest (siehe Offene Fragen).
3. Die fünf Zeichen sind über die Tastatur erreichbar: ⓘ, ✓, Phase und Grenze sind Fokusziel; das Eigentümer-Zeichen kommt in die Tab-Folge (ADR-0012, ADR-0020 „Akzeptierte Schwäche"). Jeder Auslöser erfüllt `--kd-ziel` (≥ 24 px fein, ≥ 44 px Touch) über Zielgröße oder Trefferhof (ADR-0012 Regel 3); die Zeichen werden in die Selektoren/Rollen der Basisregel aufgenommen (`.info`, `.ok`, `.v`, `.v.ph`, `.eig-z`).
4. In der zugeklappten Spalte bleiben die Zeichen Schmuck (`aria-hidden`); Auslöser ist der Streifen-Knopf, dessen zugänglicher Name die Erklärung trägt (`<Name> aufklappen, gehört dem Menschen` bzw. `…, gehört den Agenten`). Der Streifen trägt nur das Eigentümer-Zeichen; er erklärt daher allein den Eigentümer (ⓘ, ✓, Phase und Grenze erscheinen in der zugeklappten Spalte nicht).

### Der Tooltip erscheint auf Anforderung

5. Der Tooltip ist ein eigenes nicht-modales Primitiv: `role="tooltip"`, **kein Fokus** (kein `tabindex`, er fängt und nimmt keinen), **keine eigene Fokus-Ebene** in `ebenen(ui)` (ADR-0010 bleibt unberührt).
6. **Tastaturfokus** auf einem Auslöser zeigt seinen Erklärtext sichtbar.
7. **Langer Druck** auf Touch zeigt ihn ebenso. Überfahren mit der Maus darf ihn zeigen, ist aber nicht die Bedingung.
8. **Schließen**: **Esc** schließt den Tooltip **zuerst** — an der Spitze der Kaskade, vor Pop und Fenstern; der Fokus bleibt am Auslöser. Auf **Touch** schließt außerdem ein **Tippen außerhalb** des Auslösers (`pointerdown` außerhalb) — nicht nur Esc.
9. Es ist **höchstens eine Blase zugleich** sichtbar; ein Wechsel des Auslösers ersetzt den Text oder blendet die Blase aus.
10. Der Zustand liegt in `S.ui` und ist **redraw-sicher**: Übersteht der Text ein `innerHTML`-Neuzeichnen wie die übrigen Zustände in `S.ui`, und ein Live-Ereignis hinterlässt keinen verwaisten Tooltip (ADR-0007).
11. Positionierung über die vorhandene `popPlatzieren`-Logik (Unter-/Über-dem-Auslöser, Umklappen an der Fensterkante). Der Tooltip liegt **außerhalb** des Scrollcontainers `.bahnen{overflow-x:auto}` (fest positioniert, wie `#pop` in `#over`); sonst wird er an der Board-Kante abgeschnitten.

### Anzeige, Kontrast und Breiten

12. Die Anzeige ist eine **Plain-Fläche nach M3**; sie darf für den Eigentümer-Satz umbrechen (max. Breite 236 px), hat **keinen Titel und keine Aktionen**; Fläche `--kd-head`, Text `--kd-head-text` (ADR-0013). Die Abweichung von „einzeilig/24 dp" ist bewusst: der zentrale Stil des Projekts und der R00097-Wortlaut gehen dem M3-Gedächtnis vor.
13. Der Erklärtext erreicht **Kontrast ≥ 4,5:1** gegen die Blasenfläche, in Hell und in Dunkel (ADR-0011). Das Paar ist Fläche `--kd-head` / Text `--kd-head-text` (hell 12,78:1, dunkel 12,33:1); `--kd-head-muted` ist als Textfarbe unzulässig (nur 4,39:1 in Hell).
14. Bei 320, 375 und 414 px liegt die Blase ganz im Fenster; **nichts scrollt waagrecht** (ADR-0015).

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Der Erklärtext ist ohne Zeiger erreichbar (Fokus und langer Druck); der zugängliche Name ist wörtlich der Tooltiptext; der Tooltip nimmt keinen Fokus und ist keine zweite Erklärquelle neben sich (WCAG 2.1 SC 1.4.13, SC 4.1.2).
- **Kulturtreue**: Alle Erklärtexte sind deutsch und stimmen mit dem Ort überein, den sie erklären (ADR-0013).
- **Kein Querscrollen**: Bei 320, 375 und 414 px scrollt das Board waagrecht nicht wegen des Tooltips (`scrollWidth = clientWidth`).
- **Rückwärtskompatibel**: Das Aussehen der Kopfzeichen und die übrigen Wächter (`r00101`, `r00106`, `ziele`, `kontrast`, `kultur`) bleiben grün; kein Token außerhalb `web/kd-tokens.css` kommt hinzu. Angepasst werden muss die Erwartung in `e2e/tests/r00097-eigentuemer.spec.js` (die `title`-Erwartung entfällt, `.eig-z` ist per Tab erreichbar, sein Maß ist ≥ Zielgröße), und die `ziele`-Messung nimmt die neuen Tab-Halte der fünf Zeichen auf.

## Akzeptanzkriterien

Gegeben für jede Probe: die laufende Instanz mit dem Board „entwicklung", über die API bzw. den Grundbestand herstellbar; mindestens eine Spalte mit Eigentümer, einer Grenze und einer Phase.

### F: Erklärung bei Tastaturfokus

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „Tab auf ⓘ und auf das Eigentümer-Zeichen zeigt die Erklärung sichtbar."
  - Besteht: Bei 1280 px und Fokus auf `BODY` setzt Tab (bzw. Umschalt+Tab) den Fokus auf das ⓘ-Zeichen und auf das Eigentümer-Zeichen, und daneben steht der jeweilige Erklärtext als sichtbare Blase (`[role="tooltip"]` mit Rechtecken); der Fokus bleibt auf dem Auslöser.
  - Fällt durch: heute — kein Erklärtext bei Fokus (nur `title`).
  - Prüfebene: E2E `r00119` (neu).
- [ ] Bei 375 px in Hell und Dunkel erscheint dieselbe Blase auch an ✓ (Abschlussspalte), Phase und Grenze, wenn sie den Fokus bekommen.
- [ ] **Zielgröße**: Jeder Auslöser (`.info`, `.ok`, `.v`, `.v.ph`, `.eig-z`) erfüllt `--kd-ziel` — über die Zielgröße selbst oder einen Trefferhof —, bei feinem Zeiger ≥ 24×24, bei Touch ≥ 44×44.
- [ ] **Grenzfall leere Erklärung**: Ein Kopfzeichen ohne Erklärtext (z. B. keine Grenze gesetzt, keine Phase) ist kein Auslöser und zeigt keine leere Blase.

### F: Erklärung bei langem Druck (Touch)

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „langer Druck auf Touch ebenso."
  - Besteht: Bei 375 px mit `hasTouch`/`isMobile` erscheint nach langem Druck (≥ 500 ms, ohne Loslassen) auf einem Kopfzeichen dieselbe sichtbare Blase wie bei Tastaturfokus.
  - Fällt durch: heute — `title` löst auf Touch nicht aus.
  - Prüfebene: E2E `r00119` (neu), Muster `hasTouch`/`isMobile` (`ziele.spec.js`).

### F: Schließen

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „Esc schließt den Tooltip; er bleibt nicht stehen."
  - Besteht: Bei offener Blase entfernt Esc die Blase (`[role="tooltip"]` verschwindet), der Fokus bleibt am Auslöser.
  - Fällt durch: heute — kein Tooltip.
  - Prüfebene: E2E `r00119` (neu).
- [ ] **Grenzfall Kaskade**: Ist zugleich ein Pop oder ein Fenster offen, schließt ein Esc nur den Tooltip; das Pop bzw. Fenster bleibt offen.
- [ ] **Tippen außerhalb (Touch)**: Bei 375 px mit `hasTouch`/`isMobile` schließt ein Tippen (`pointerdown`) außerhalb des Auslösers die Blase; der Fokus bleibt am Auslöser.
- [ ] **Gegenbeispiel Fokus-Ebene**: Bei offener Blase bewegt Tab den Fokus geordnet zum nächsten Bedienziel weiter (der Tooltip fängt keinen Fokus, kein `tabindex` am Tooltip).

### F: Zugänglicher Name

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „der zugängliche Name ist wörtlich der Tooltiptext."
  - Besteht: Am fokussierten Auslöser ist `aria-label` Zeichen für Zeichen gleich dem sichtbaren Tooltiptext (Wortlaut je Zeichen: Tabelle in FA 1); der Tooltip ist per `aria-describedby` verbunden und trägt keinen eigenen Fokus.
  - Fällt durch: heute — ✓/Phase/Grenze haben keinen zugänglichen Namen, Eigentümer hat `role="img"` ohne Tab-Halt.
  - Prüfebene: E2E `r00119` (neu), `ariaSnapshot`.

### F: Live-Ereignis

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „ein Live-Ereignis hinterlässt keinen verwaisten Tooltip."
  - Besteht: Bei offener Blase hinterlässt ein fremder Schreibaufruf (Live-Ereignis, `extern`) nach dem Neuzeichnen entweder keine Blase oder eine Blase zum noch vorhandenen Auslöser — nie eine Blase ohne zugehörigen Auslöser.
  - Fällt durch: ohne redraw-sicheren Zustand (heute nicht vorhanden).
  - Prüfebene: E2E `r00119` (neu); Muster „verzögert antwortender Fake" (`AI-Team/gelerntes.md`).

### F: Kontrast und Anzeige

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „Kontrast des Erklärtextes hell und dunkel ≥ 4,5:1."
  - Besteht: Die Textfarbe der Blase gegen ihre Fläche ist ≥ 4,5:1 in Hell und in Dunkel (ADR-0011); das Paar ist `--kd-head`/`--kd-head-text` (hell 12,78:1, dunkel 12,33:1).
  - Prüfebene: E2E/Kontrast-Probe (`kontrast`).
- [ ] Die Anzeige ist eine Plain-Fläche nach M3; sie darf für den Eigentümer-Satz umbrechen (max. Breite 236 px), hat keinen Titel und keine Aktionen; Fläche `--kd-head`, Text `--kd-head-text`. Die Abweichung von „einzeilig/24 dp" ist bewusst (zentraler Stil und R00097-Wortlaut gehen M3 vor); der Wortlaut ist deutsch (nicht „tooltip", nicht englisch).

### F: Breiten und Mehrfachauslöser

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „kein Querscrollen bei 320/414."
  - Besteht: Bei 320 und 414 px liegt die Blase am äußersten rechten Auslöser ganz im Fenster, und das Dokument scrollt waagrecht nicht (`scrollWidth = clientWidth`).
  - Prüfebene: E2E `r00119` (neu).
- [ ] **Gegenbeispiel nur eine Blase**: Bei zwei Auslösern im selben Spaltenkopf (ⓘ und Eigentümer) ist nach dem Wechsel des Fokus nur **eine** Blase sichtbar.
- [ ] **Tooltip nicht abgeschnitten**: Am äußersten rechten (und linken) Auslöser liegt die Blase außerhalb des Scrollcontainers `.bahnen{overflow-x:auto}` (fest positioniert, wie `#pop` in `#over`) und wird an der Board-Kante nicht abgeschnitten.
- [ ] **Zugeklappte Spalte**: In der zugeklappten Spalte ist das Zeichen `aria-hidden`; der Streifen-Knopf ist der Auslöser und zeigt die Erklärung über den Knopf.

## Betroffene Verzeichnisstruktur

```
web/
├── ansicht.js     # vLane (:734–747) und vEigentuemerZeichen (:720–726): Auslöser samt Zielgröße,
│                  #   aria-describedby, title der fünf Zeichen entfallen, Zeichen fokussierbar/Tab-Folge,
│                  #   zugeklappter Streifen; das Tooltip-Primitiv außerhalb .bahnen zeichnen
├── app.js         # popPlatzieren (:978) für die Position, Esc-Kaskade (:1950) um den Tooltip erweitern,
│                  #   Zustand in S.ui (:2), langer Druck und pointerdown-Außerhalb schließen
└── kd-app.css     # Plain-Fläche (--kd-head/--kd-head-text, max. 236 px, umbruchfähig, ohne Titel/Aktionen);
                   #   Zielgröße/Trefferhof der Zeichen in den Selektoren der Basisregel (.info,.ok,.v,.v.ph,.eig-z)
e2e/
└── tests/         # r00119 (neu): US-1..US-7; Anpassung r00097-eigentuemer (title entfällt, .eig-z per Tab, Maß)
                   #   und ziele (neue Tab-Halte); Wächter r00101, r00106, ziele, kontrast, kultur laufen mit
```

## Technische Überlegungen

### Optionen (entschieden durch ADR-0020, Commit `89e19f6`)

| | A: native `title` + `aria-label` | **B: eigenes nicht-modales Primitiv (gewählt)** | C: `#pop` erweitern | D: native Popover-API | E: CSS-only |
|---|---|---|---|---|---|
| Fokus sichtbar | nein | **ja** | ja | teils | ja |
| langer Druck | nein | **ja** | nein | nein | nein |
| Esc | nein | **ja (zuerst)** | ja | ja | nein |
| Fokus-Ebenen | — | **unberührt** | verwischt (ADR-0010 N4) | Redraw-Problem | — |
| Testbarkeit | gering | **hoch** | mittel | mittel | gering |

**Entscheidung: B** (ADR-0020). A erfüllt „bei Fokus sichtbar" nicht; C verwischt die Ebenen-Einordnung von `#pop`; D trägt das Redraw-Problem, das ADR-0010 verworfen hat, und kann den langen Druck nicht; E ist unzuverlässig und ohne Esc.

### Plain↔Rich (durch die UX-Vorprüfung entschieden: A)

Die Eigentümer-Erklärung ist ein ganzer Satz, M3 **Plain** ist einzeilig/24 dp.

| | **A: Plain mit Umbruch (gewählt)** | B: Rich Tooltip (M3) | C: kurze Plain-Beschriftung statt Satz |
|---|---|---|---|
| Deckt die AK (Wortlaut = Name) | **ja** | ja | nein (kürzt den Satz) |
| M3-Treue | weicht von „einzeilig" ab (bewusst) | deckt „mehr Kontext" | treu |
| R00097-Wortlaut | bleibt | bleibt | wird gekürzt |
| Aufwand | gering | mittel | gering |

**Entschieden: A** (Plain, der Satz darf umbrechen; max. Breite 236 px, kein Titel, keine Aktionen). Der Wortlaut aus R00097/PO Z. 50 steht fest und der zugängliche Name muss wörtlich derselbe sein; B brächte Titel/Link, die diese Anforderung nicht braucht. Die Abweichung von „einzeilig/24 dp" ist damit bewusst: zentraler Stil und R00097-Wortlaut gehen dem M3-Gedächtnis vor. Das Artboard D0002 zeichnet die entschiedene Fassung.

### Ablauf (den Zuschnitt entscheidet der Entwickler)

1. **Erklärtext und Name**: je Kopfzeichen den Erklärtext festlegen (Tabelle „Wortlaut je Zeichen" in FA 1); die `title` der fünf Zeichen entfernen; ⓘ, ✓, Phase, Grenze fokussierbar machen, das Eigentümer-Zeichen in die Tab-Folge; `aria-label` = Tooltiptext, `aria-describedby` auf die Blase; jeden Auslöser auf `--kd-ziel` bringen (Zielgröße oder Trefferhof).
2. **Primitiv**: `role="tooltip"` mit Zustand in `S.ui`; kein `tabindex`; redraw-sicher; Positionierung über `popPlatzieren`; außerhalb des Scrollcontainers `.bahnen` (wie `#pop` in `#over`).
3. **Auslöser**: Fokus zeigt, langer Druck zeigt, nur eine Blase; Esc in der Kaskade zuerst, auf Touch schließt ein Tippen außerhalb (`pointerdown`).
4. **Anzeige**: Plain-Fläche `--kd-head`/`--kd-head-text` (max. 236 px, umbruchfähig, ohne Titel/Aktionen); keine Querscrollen bei 320/375/414.

### Wächter

`r00101` (Kopfzeile), `r00106` (Fokus in Fenstern und Menüs), `ziele` (Zielgrößen/Breiten), `kontrast` (ADR-0011), `kultur` (Begriffe) laufen mit; dazu die neue Probe `r00119`.

## Tests

Nach Skill `test-pyramide`; jede Szene der User Story ein Test, jeder prüft eine sichtbare Zustandsänderung (Skill `test-ehrlichkeit`).

- **E2E (Playwright)**: neu `r00119` mit US-1 bis US-7; Tastatur (Tab/Umschalt+Tab), Touch (`hasTouch`/`isMobile`, langer Druck), Tippen außerhalb schließt (Touch), Esc (auch mit offenem Pop), Fokus bleibt am Auslöser, Live-Ereignis mit verzögertem Fake, Kontrast hell/dunkel, 320/375/414 px ohne Querscrollen, Tooltip außerhalb `.bahnen` an der Board-Kante nicht abgeschnitten, Zielgröße der fünf Auslöser, zugeklappte Spalte über den Streifen-Knopf.
- **Angepasst**: `e2e/tests/r00097-eigentuemer.spec.js` (die `title`-Erwartung entfällt; `.eig-z` ist per Tab erreichbar; sein Maß ist ≥ `--kd-ziel`) und die `ziele`-Messung nimmt die neuen Tab-Halte (die fünf Zeichen) auf.
- **Rot vor dem Bau**: Fokus zeigt nichts (nur `title`), langer Druck löst nicht aus und Tippen außerhalb schließt nicht, ✓/Phase/Grenze sind nicht fokussierbar und ohne zugänglichen Namen, die Auslöser sind kleiner als `--kd-ziel`, der Tooltip wird an der `.bahnen`-Kante abgeschnitten, es gibt kein `role="tooltip"`.
- **Gegenproben (Mutanten)**: Tooltip nimmt Fokus → AK „Fokus bleibt am Auslöser" rot; zweite Blase zugleich → AK „nur eine Blase" rot; `role`/`aria-describedby` entfernt → AK „zugänglicher Name" rot; Zustand nicht in `S.ui` → AK „Live-Ereignis" rot; Kontrast unter 4,5:1 → Kontrast-Probe rot.
- **Mitlaufend grün**: `r00101`, `r00106`, `ziele`, `kontrast`, `kultur`, `node --test e2e/einheit/`.

## Abhängigkeiten

- **Bindend**: ADR-0020 (die Komponente); ADR-0007 (Sichtzustand übersteht das Neuzeichnen), ADR-0010 (Fokusführung, keine eigene Ebene), ADR-0011 (Kontrast), ADR-0012 (Zielgrößen), ADR-0013 (deutsche Anzeige), ADR-0015 (Breiten), ADR-0018 (zugänglicher Name am Auslöser).
- **Aufbauend auf**: R00097/I0086/F0015 (Kopfzeichen samt Wortlaut und Streifen), R00074/I0062 (zugeklappte Spalte), R00096 (Grenze), R00101/I0083 und R00117/I0106 (Kopfzeile).
- **Gestaltung**: der Zustand „Erklärtext auf Anforderung" am Artboard D0002 (Board) muss vor dem Bau durch den product-owner freigegeben werden (prozess.md 2026-11-07). **8 Bubbles warten** darauf: B0546–B0548 und B0552 (F0081) sowie B0549–B0551 und B0553 (F0082) — die sichtbare Blase ist Gestaltung. **Frei baubar** sind B0544 (Tooltiptext) und B0545 (zugänglicher Name/Tab-Folge/Zielgröße): Text und Name sind nicht gezeichnet, die Zielgröße folgt ADR-0012.
- **Abgegrenzt, nicht Teil dieser Anforderung**: die Ausweitung auf weitere `title`-Stellen im Projekt (eigene Karte, ADR-0020 „Geltung"); die Kontrast-Paare selbst (I0096/R00107), die Zielgrößen-Probe (I0097/R00108).

## Offene Fragen

- **Plain↔Rich** (durch die UX-Vorprüfung entschieden): Plain mit Umbruch (max. Breite 236 px, kein Titel, keine Aktionen), der R00097-Wortlaut bleibt wörtlich. FA 12 und das AK „Kontrast und Anzeige" tragen die Fassung; das Artboard D0002 zeichnet sie.
- **Eigentümer-Zeichen in der Tab-Folge**: Es trägt heute keinen Tab-Halt (`role="img"`). ADR-0020 nimmt es als „ggf." auf; diese Anforderung setzt es (FA 3). Kehrt der ux-Fall das um, ist FA 3/AK nachzuziehen.
- **Tab-Folge-Verlängerung** (Sollte der UX-Vorprüfung): Das Eigentümer-Zeichen verlängert die Tab-Folge der Spaltenköpfe. Empfehlung: an ADR-0012 Regel 5 prüfen, ob eine Grenze oder eine roving-Gruppe nötig ist, damit die Folge nicht zu lang wird; bis dahin bleibt es ein einzelner Tab-Halt. Der ux-Fall entscheidet mit der Freigabe.
- **Name = Beschreibung doppelt vorgelesen** (Sollte der UX-Vorprüfung): Der zugängliche Name und der per `aria-describedby` verbundene Tooltiptext sind wörtlich gleich (ADR-0018/ADR-0020); Hilfstechnik liest denselben Satz damit zweimal. Empfehlung: `aria-describedby` entfällt, wo der Name den vollen Erklärtext trägt (der Name ist dann die eine Quelle); andernfalls weicht die Beschreibung ab. Der ux-Fall entscheidet mit der Freigabe; ADR-0020 Z. 77 ist dann nachzuziehen.
- **Ausweitung auf weitere `title`-Stellen**: eigene Karte (ADR-0020 „Geltung"); die Auslösermenge dieser Anforderung ist in FA 1 festgelegt.

## Manuelle Vorbereitungstätigkeiten

- Keine. (Der Zustand am Artboard D0002 wird gezeichnet und freigegeben; das ist kein Handgriff im Betrieb.)

## Manuelle Nachbereitungstätigkeiten

- Keine — kein neuer Token, kein neues Dateiformat; `web/` ist per `include_bytes!` eingebettet, Änderungen werden erst nach `cargo build` und Neustart sichtbar.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass sich die Kopfzeichen heute **nur dem Zeiger** erklären: `title` erscheint nicht bei Tastaturfokus und lässt sich auf Touch nicht auslösen (belegt in ADR-0020 an `web/ansicht.js:734–747` und `:720–726`). Damit fehlt genau den Zeichen mit Regelbezug — Eigentümer (R00097) und Grenze (R00096) — die Erklärung für die Tastatur und das Touchgerät, und die Vision „per Tastatur bedienbar" ist dort nicht erfüllt. Die Lösung bringt **einen** Erklärmechanismus an **einen** Ort (PO Z. 53): ein nicht-modales Primitiv, das auf Fokus und langen Druck erscheint und mit Esc schließt. Weil es keinen Fokus nimmt und keine eigene Ebene ist, bleiben die Ebenen-Invarianten (ADR-0010) und der zugängliche Name am Auslöser (ADR-0018) unverändert; weil der Zustand in `S.ui` liegt, übersteht die Blase das Neuzeichnen (ADR-0007) und hinterlässt bei einem Live-Ereignis keinen Waisen. Der Hebel liegt beim Erklärtext auf Anforderung und nicht bei einem zweiten `title`: ein zweiter Erklärweg wäre genau der Fehler, den die Komponente vermeiden soll, und er bliebe für Tastatur und Touch unerreichbar. Danach erbt jedes künftige Kopfzeichen denselben Mechanismus, statt einen eigenen zu brauchen.

## Missing-Docs

- Keine neue Architektur-Regel; ADR-0020 ist die Regel. `A00009-oberflaeche.md` nennt den Spaltenkopf — das Primitiv ist ein Zusatz, keine Abweichung.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene Interaction I0109 mit eigener Anforderung R00119, **Elterndialog D0007** nach dem architekt-Vorschlag (ADR-0020, Commit `89e19f6`) und der Karte #24 — **nicht** Feature unter I0086: F0015 schließt den Tooltip ausdrücklich aus, I0086 ist grün, und der Umfang (fünf Zeichen, Fokus, langer Druck, Esc) ist breiter. Muster: I0106/I0107/I0108 (eigene Interaction statt Bubbles an eine abgenommene Interaction, `AI-Team/gelerntes.md` 2026-11-11). Drei Features = Erklärtext/Name, Auslöser/Primitiv, Anzeige; zehn Bubbles (F0080 B0544/B0545, F0081 B0546–B0548 und B0552, F0082 B0549–B0551 und B0553).
- **Hinweis zur Elternwahl**: Die Karte und ADR-0020 nennen D0007 (Agenten-Schnittstelle), der Tooltip liegt aber sichtbar auf dem **Board** (Artboard D0002). Die Wahl folgt der bindenden Vorgabe D0007; der Artboard-Zustand gehört zur Board-Ansicht D0002. Sollte der Director D0002 vorziehen (wie I0106/I0107/I0108, die ebenfalls unter D0002 liegen), ist der Knoten umzuhängen.
- **Artboard-Abhängigkeit**: Zustand „Erklärtext auf Anforderung" am Artboard D0002 (Board), freizugeben durch den product-owner vor dem Bau. Er zeigt: Hell und Dunkel; je Kopfzeichen offen (ⓘ, ✓, Phase, Grenze normal/überschritten, Eigentümer Mensch/Agent); Fokuszustand (Fokusring + Blase); langer Druck/Touch; Tippen außerhalb (Touch) schließt; Esc/geschlossen; mehrere Auslöser in einem Spaltenkopf (nur eine Blase); zugeklappte Spalte (Zeichen `aria-hidden`, Auslöser ist der Streifen-Knopf); Position außerhalb `.bahnen` und 320/375/414 px ohne Querscrollen; und die entschiedene Plain-Fläche (Umbruch, max. 236 px, kein Titel/Aktionen).
- **Einarbeitung UX-Vorprüfung 2026-11-11 (Karte #24, Muss)**: sechs Muss-Befunde eingearbeitet.
  - Muss 1 (Plain↔Rich/AK): FA 12 und das AK „Kontrast und Anzeige" neu gefasst (Plain-Fläche, Umbruch max. 236 px, kein Titel/Aktionen, Fläche `--kd-head`, Text `--kd-head-text`; Abweichung von „einzeilig/24 dp" bewusst); die technische Offene Frage ist geschlossen (Abschnitt „Plain↔Rich").
  - Muss 2 (Wortlaut je Zeichen): Tabelle „Wortlaut je Zeichen" in FA 1; der zugängliche Name ist wörtlich der Tooltiptext; ⓘ hat **eine** Formulierung `Kommentar: <notiz>`.
  - Muss 3 (Zielgröße): FA 3 und ein AK verlangen `--kd-ziel` je Auslöser über Zielgröße oder Trefferhof (ADR-0012 Regel 3), die Zeichen in den Basisregel-Selektoren `.info`, `.ok`, `.v`, `.v.ph`, `.eig-z`.
  - Muss 4 (Touch-Schließen): FA 8 und ein AK („Tippen außerhalb") ergänzt; neue Bubble B0552.
  - Muss 5 (Tooltip außerhalb `.bahnen`): FA 11 und ein AK ergänzt (fest positioniert wie `#pop` in `#over`); neue Bubble B0553.
  - Muss 6 (Testanpassung): NFR „Rückwärtskompatibel" und „Tests" nennen `r00097-eigentuemer.spec.js` (title entfällt, `.eig-z` per Tab, Maß) und die `ziele`-Messung der neuen Tab-Halte.
  - Sollte: Kontrast-Paar in FA 13/AK genannt (12,78/12,33:1; `--kd-head-muted` unzulässig), Tab-Folge-Verlängerung und das doppelte Vorlesen (Name = Beschreibung) als Offene Fragen mit Empfehlung notiert, das Entfernen der fünf `title` in FA 1/FA 2 ausdrücklich, die Auslösermenge in FA 1 fixiert (`.bahn-kopf`, `.kopf-plus`, Signalzähler ausgenommen, Folgekarte ADR-0020).
- **Verworfene Alternativen**: native `title` (A), `#pop`-Erweiterung (C), native Popover-API (D), CSS-only (E) — je ein Satz in ADR-0020 (Optionen).
