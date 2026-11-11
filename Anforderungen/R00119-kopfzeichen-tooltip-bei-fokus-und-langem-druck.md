---
id: R00119
status: Neu
datum: 2026-11-11
---

# R00119: Kopfzeichen ohne Hover erklären: Tooltip bei Tastaturfokus und langem Druck

## Beschreibung

Die Zeichen im Spaltenkopf — ⓘ (Kommentar), ✓ (Abschlussspalte), die Phase, die Grenze und das Eigentümer-Zeichen (Mensch/Agent) — erklären sich heute nur über den Mauszeiger (`title`). Ein Erklärtext, den nur ein Zeiger erreicht, erfüllt das Zielbild „per Tastatur bedienbar" nicht. Diese Anforderung gibt **allen** Kopfzeichen **einen** Erklärtext (Tooltip), der bei Tastaturfokus und bei langem Druck auf Touch erscheint und mit Esc schließt: bei Fokus und langem Druck verhalten sich alle Zeichen gleich, und der zugängliche Name am Auslöser bleibt derselbe Wortlaut. Der Tooltip ist nicht-modal: er nimmt keinen Fokus und ist keine eigene Fokus-Ebene.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … es ist per Tastatur bedienbar und folgt gewohnten Konventionen."

### Domänenbezug
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Spaltenkopf ist der Ort, an dem sich eine Spalte erklärt. Heute erklärt er sich nur dem Zeiger: Wer nur eine Tastatur hat oder am Touchgerät arbeitet, sieht keinen der Erklärtexte. Das trifft genau die Zeichen, die eine Regel tragen — das Eigentümer-Zeichen (R00097) und die Grenze (R00096) —, also die Stellen, an denen ein Missverständnis Arbeit oder Freigabe kostet. Diese Anforderung bringt den Erklärtext an einen Ort und an eine Anforderung des Menschen (Fokus, langer Druck) statt an den Zeiger; danach erbt jedes künftige Kopfzeichen denselben Mechanismus. Die Regel steht an genau einem Ort (PO-Entscheidung zu #3, Z. 53), statt als Teilstück in R00097.

## Funktionale Anforderungen

### Erklärtext und zugänglicher Name

1. Jedes Kopfzeichen trägt einen Erklärtext: ⓘ, ✓ (Abschlussspalte), Phase (`span.v.ph`), Grenze (`span.v`) und das Eigentümer-Zeichen (Mensch: „Spalte gehört dem Menschen — Agenten können Karten hineinlegen, aber nicht herausnehmen"; Agent: „Spalte gehört den Agenten — kennzeichnet nur, sperrt nichts", R00097/PO Z. 50).
2. Der **zugängliche Name am Auslöser** ist **wörtlich** derselbe Text wie der sichtbare Tooltiptext — keine abweichende zweite Formulierung (ADR-0018). Der Tooltip ist über `aria-describedby` am Auslöser verbunden; er ersetzt den Namen nicht und wird keine zweite Namensquelle.
3. Die fünf Zeichen sind über die Tastatur erreichbar: ⓘ, ✓, Phase und Grenze sind Fokusziel; das Eigentümer-Zeichen kommt in die Tab-Folge (ADR-0012, ADR-0020 „Akzeptierte Schwäche").
4. In der zugeklappten Spalte bleiben die Zeichen Schmuck (`aria-hidden`); Auslöser ist der Streifen-Knopf, dessen zugänglicher Name die Erklärung trägt (`<Name> aufklappen, gehört dem Menschen` bzw. `…, gehört den Agenten`).

### Der Tooltip erscheint auf Anforderung

5. Der Tooltip ist ein eigenes nicht-modales Primitiv: `role="tooltip"`, **kein Fokus** (kein `tabindex`, er fängt und nimmt keinen), **keine eigene Fokus-Ebene** in `ebenen(ui)` (ADR-0010 bleibt unberührt).
6. **Tastaturfokus** auf einem Auslöser zeigt seinen Erklärtext sichtbar.
7. **Langer Druck** auf Touch zeigt ihn ebenso. Überfahren mit der Maus darf ihn zeigen, ist aber nicht die Bedingung.
8. **Esc** schließt den Tooltip **zuerst** — an der Spitze der Kaskade, vor Pop und Fenstern; der Fokus bleibt am Auslöser.
9. Es ist **höchstens eine Blase zugleich** sichtbar; ein Wechsel des Auslösers ersetzt den Text oder blendet die Blase aus.
10. Der Zustand liegt in `S.ui` und ist **redraw-sicher**: Übersteht der Text ein `innerHTML`-Neuzeichnen wie die übrigen Zustände in `S.ui`, und ein Live-Ereignis hinterlässt keinen verwaisten Tooltip (ADR-0007).
11. Positionierung über die vorhandene `popPlatzieren`-Logik (Unter-/Über-dem-Auslöser, Umklappen an der Fensterkante).

### Anzeige, Kontrast und Breiten

12. Anzeige als **Plain Tooltip nach Material 3** (kurze Beschriftung, Höhe 24 dp, einzeilig) mit deutschem Wortlaut (ADR-0013); der zentrale Stil des Projekts und die Vision gehen dem M3-Gedächtnis vor.
13. Der Erklärtext erreicht **Kontrast ≥ 4,5:1** gegen die Blasenfläche, in Hell und in Dunkel (ADR-0011).
14. Bei 320, 375 und 414 px liegt die Blase ganz im Fenster; **nichts scrollt waagrecht** (ADR-0015).

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Der Erklärtext ist ohne Zeiger erreichbar (Fokus und langer Druck); der zugängliche Name ist wörtlich der Tooltiptext; der Tooltip nimmt keinen Fokus und ist keine zweite Erklärquelle neben sich (WCAG 2.1 SC 1.4.13, SC 4.1.2).
- **Kulturtreue**: Alle Erklärtexte sind deutsch und stimmen mit dem Ort überein, den sie erklären (ADR-0013).
- **Kein Querscrollen**: Bei 320, 375 und 414 px scrollt das Board waagrecht nicht wegen des Tooltips (`scrollWidth = clientWidth`).
- **Rückwärtskompatibel**: Das Aussehen der Kopfzeichen und die übrigen Wächter (`r00101`, `r00106`, `ziele`, `kontrast`, `kultur`) bleiben grün; kein Token außerhalb `web/kd-tokens.css` kommt hinzu.

## Akzeptanzkriterien

Gegeben für jede Probe: die laufende Instanz mit dem Board „entwicklung", über die API bzw. den Grundbestand herstellbar; mindestens eine Spalte mit Eigentümer, einer Grenze und einer Phase.

### F: Erklärung bei Tastaturfokus

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „Tab auf ⓘ und auf das Eigentümer-Zeichen zeigt die Erklärung sichtbar."
  - Besteht: Bei 1280 px und Fokus auf `BODY` setzt Tab (bzw. Umschalt+Tab) den Fokus auf das ⓘ-Zeichen und auf das Eigentümer-Zeichen, und daneben steht der jeweilige Erklärtext als sichtbare Blase (`[role="tooltip"]` mit Rechtecken); der Fokus bleibt auf dem Auslöser.
  - Fällt durch: heute — kein Erklärtext bei Fokus (nur `title`).
  - Prüfebene: E2E `r00119` (neu).
- [ ] Bei 375 px in Hell und Dunkel erscheint dieselbe Blase auch an ✓ (Abschlussspalte), Phase und Grenze, wenn sie den Fokus bekommen.
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
- [ ] **Gegenbeispiel Fokus-Ebene**: Bei offener Blase bewegt Tab den Fokus geordnet zum nächsten Bedienziel weiter (der Tooltip fängt keinen Fokus, kein `tabindex` am Tooltip).

### F: Zugänglicher Name

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „der zugängliche Name ist wörtlich der Tooltiptext."
  - Besteht: Am fokussierten Auslöser ist `aria-label` Zeichen für Zeichen gleich dem sichtbaren Tooltiptext; der Tooltip ist per `aria-describedby` verbunden und trägt keinen eigenen Fokus.
  - Fällt durch: heute — ✓/Phase/Grenze haben keinen zugänglichen Namen, Eigentümer hat `role="img"` ohne Tab-Halt.
  - Prüfebene: E2E `r00119` (neu), `ariaSnapshot`.

### F: Live-Ereignis

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „ein Live-Ereignis hinterlässt keinen verwaisten Tooltip."
  - Besteht: Bei offener Blase hinterlässt ein fremder Schreibaufruf (Live-Ereignis, `extern`) nach dem Neuzeichnen entweder keine Blase oder eine Blase zum noch vorhandenen Auslöser — nie eine Blase ohne zugehörigen Auslöser.
  - Fällt durch: ohne redraw-sicheren Zustand (heute nicht vorhanden).
  - Prüfebene: E2E `r00119` (neu); Muster „verzögert antwortender Fake" (`AI-Team/gelerntes.md`).

### F: Kontrast und Anzeige

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „Kontrast des Erklärtextes hell und dunkel ≥ 4,5:1."
  - Besteht: Die Textfarbe der Blase gegen ihre Fläche ist ≥ 4,5:1 in Hell und in Dunkel (ADR-0011).
  - Prüfebene: E2E/Kontrast-Probe (`kontrast`).
- [ ] Anzeige ist ein Plain Tooltip nach M3 (Höhe 24 dp, einzeilig); der Wortlaut ist deutsch (nicht „tooltip", nicht englisch).

### F: Breiten und Mehrfachauslöser

- [ ] **Abnahme-Probe der Karte #24, wörtlich**: „kein Querscrollen bei 320/414."
  - Besteht: Bei 320 und 414 px liegt die Blase am äußersten rechten Auslöser ganz im Fenster, und das Dokument scrollt waagrecht nicht (`scrollWidth = clientWidth`).
  - Prüfebene: E2E `r00119` (neu).
- [ ] **Gegenbeispiel nur eine Blase**: Bei zwei Auslösern im selben Spaltenkopf (ⓘ und Eigentümer) ist nach dem Wechsel des Fokus nur **eine** Blase sichtbar.
- [ ] **Zugeklappte Spalte**: In der zugeklappten Spalte ist das Zeichen `aria-hidden`; der Streifen-Knopf ist der Auslöser und zeigt die Erklärung über den Knopf.

## Betroffene Verzeichnisstruktur

```
web/
├── ansicht.js     # vLane (:734–747) und vEigentuemerZeichen (:720–726): Auslöser, aria-describedby,
│                  #   Zeichen fokussierbar/Tab-Folge, zugeklappter Streifen; das Tooltip-Primitiv zeichnen
├── app.js         # popPlatzieren (:978) für die Position, Esc-Kaskade (:1950) um den Tooltip erweitern,
│                  #   Zustand in S.ui (:2), langer Druck
└── kd-app.css     # Plain-Tooltip-Fläche und -Anzeige, Paare aus kd-tokens.css
e2e/
└── tests/         # r00119 (neu): US-1..US-5; Wächter r00101, r00106, ziele, kontrast, kultur laufen mit
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

### Offene Frage Plain↔Rich (im Artboard zu entscheiden)

Die Eigentümer-Erklärung ist ein ganzer Satz, M3 **Plain** ist einzeilig/24 dp.

| | A: Plain mit Umbruch | B: Rich Tooltip (M3) | C: kurze Plain-Beschriftung statt Satz |
|---|---|---|---|
| Deckt die AK (Wortlaut = Name) | ja | ja | nein (kürzt den Satz) |
| M3-Treue | weicht von „einzeilig" ab | deckt „mehr Kontext" | treu |
| R00097-Wortlaut | bleibt | bleibt | wird gekürzt |
| Aufwand | gering | mittel | gering |

**Empfehlung: A** (Plain, der Satz darf umbrechen), weil der Wortlaut aus R00097/PO Z. 50 feststeht und der zugängliche Name wörtlich derselbe sein muss; B brächte Titel/Link, die diese Anforderung nicht braucht. Endgültig entscheidet der ux-Fall mit der Artboard-Freigabe (siehe Offene Fragen).

### Ablauf (den Zuschnitt entscheidet der Entwickler)

1. **Erklärtext und Name**: je Kopfzeichen den Erklärtext festlegen; ⓘ, ✓, Phase, Grenze fokussierbar machen, das Eigentümer-Zeichen in die Tab-Folge; `aria-label` = Tooltiptext, `aria-describedby` auf die Blase.
2. **Primitiv**: `role="tooltip"` mit Zustand in `S.ui`; kein `tabindex`; redraw-sicher; Positionierung über `popPlatzieren`.
3. **Auslöser**: Fokus zeigt, langer Druck zeigt, nur eine Blase; Esc in der Kaskade zuerst.
4. **Anzeige**: Plain-Tooltip-Fläche mit Kontrast-Paar; keine Querscrollen bei 320/375/414.

### Wächter

`r00101` (Kopfzeile), `r00106` (Fokus in Fenstern und Menüs), `ziele` (Zielgrößen/Breiten), `kontrast` (ADR-0011), `kultur` (Begriffe) laufen mit; dazu die neue Probe `r00119`.

## Tests

Nach Skill `test-pyramide`; jede Szene der User Story ein Test, jeder prüft eine sichtbare Zustandsänderung (Skill `test-ehrlichkeit`).

- **E2E (Playwright)**: neu `r00119` mit US-1 bis US-5; Tastatur (Tab/Umschalt+Tab), Touch (`hasTouch`/`isMobile`, langer Druck), Esc (auch mit offenem Pop), Fokus bleibt am Auslöser, Live-Ereignis mit verzögertem Fake, Kontrast hell/dunkel, 320/414 px ohne Querscrollen, zugeklappte Spalte über den Streifen-Knopf.
- **Rot vor dem Bau**: Fokus zeigt nichts (nur `title`), langer Druck löst nicht aus, ✓/Phase/Grenze sind nicht fokussierbar und ohne zugänglichen Namen, es gibt kein `role="tooltip"`.
- **Gegenproben (Mutanten)**: Tooltip nimmt Fokus → AK „Fokus bleibt am Auslöser" rot; zweite Blase zugleich → AK „nur eine Blase" rot; `role`/`aria-describedby` entfernt → AK „zugänglicher Name" rot; Zustand nicht in `S.ui` → AK „Live-Ereignis" rot; Kontrast unter 4,5:1 → Kontrast-Probe rot.
- **Mitlaufend grün**: `r00101`, `r00106`, `ziele`, `kontrast`, `kultur`, `node --test e2e/einheit/`.

## Abhängigkeiten

- **Bindend**: ADR-0020 (die Komponente); ADR-0007 (Sichtzustand übersteht das Neuzeichnen), ADR-0010 (Fokusführung, keine eigene Ebene), ADR-0011 (Kontrast), ADR-0012 (Zielgrößen), ADR-0013 (deutsche Anzeige), ADR-0015 (Breiten), ADR-0018 (zugänglicher Name am Auslöser).
- **Aufbauend auf**: R00097/I0086/F0015 (Kopfzeichen samt Wortlaut und Streifen), R00074/I0062 (zugeklappte Spalte), R00096 (Grenze), R00101/I0083 und R00117/I0106 (Kopfzeile).
- **Gestaltung**: der Zustand „Erklärtext auf Anforderung" am Artboard D0002 (Board) muss vor dem Bau durch den product-owner freigegeben werden (prozess.md 2026-11-07). **6 Bubbles warten** darauf: B0546–B0548 (F0081) und B0549–B0551 (F0082) — die sichtbare Blase ist Gestaltung. **Frei baubar** sind B0544 (Tooltiptext) und B0545 (zugänglicher Name/Tab-Folge): Text und Name sind nicht gezeichnet.
- **Abgegrenzt, nicht Teil dieser Anforderung**: die Ausweitung auf weitere `title`-Stellen im Projekt (eigene Karte, ADR-0020 „Geltung"); die Kontrast-Paare selbst (I0096/R00107), die Zielgrößen-Probe (I0097/R00108).

## Offene Fragen

- **Plain↔Rich** (blockiert den Bau der sichtbaren Bubbles): Die Eigentümer-Erklärung ist ein ganzer Satz, M3 Plain ist einzeilig/24 dp. Empfehlung: Plain mit Umbruch (A), der Satz bleibt wörtlich. Der ux-Fall entscheidet im Artboard.
- **Eigentümer-Zeichen in der Tab-Folge**: Es trägt heute keinen Tab-Halt (`role="img"`). ADR-0020 nimmt es als „ggf." auf; diese Anforderung setzt es (FA 3). Kehrt der ux-Fall das um, ist FA 3/AK nachzuziehen.
- **Ausweitung auf weitere `title`-Stellen**: eigene Karte (ADR-0020).

## Manuelle Vorbereitungstätigkeiten

- Keine. (Der Zustand am Artboard D0002 wird gezeichnet und freigegeben; das ist kein Handgriff im Betrieb.)

## Manuelle Nachbereitungstätigkeiten

- Keine — kein neuer Token, kein neues Dateiformat; `web/` ist per `include_bytes!` eingebettet, Änderungen werden erst nach `cargo build` und Neustart sichtbar.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass sich die Kopfzeichen heute **nur dem Zeiger** erklären: `title` erscheint nicht bei Tastaturfokus und lässt sich auf Touch nicht auslösen (belegt in ADR-0020 an `web/ansicht.js:734–747` und `:720–726`). Damit fehlt genau den Zeichen mit Regelbezug — Eigentümer (R00097) und Grenze (R00096) — die Erklärung für die Tastatur und das Touchgerät, und die Vision „per Tastatur bedienbar" ist dort nicht erfüllt. Die Lösung bringt **einen** Erklärmechanismus an **einen** Ort (PO Z. 53): ein nicht-modales Primitiv, das auf Fokus und langen Druck erscheint und mit Esc schließt. Weil es keinen Fokus nimmt und keine eigene Ebene ist, bleiben die Ebenen-Invarianten (ADR-0010) und der zugängliche Name am Auslöser (ADR-0018) unverändert; weil der Zustand in `S.ui` liegt, übersteht die Blase das Neuzeichnen (ADR-0007) und hinterlässt bei einem Live-Ereignis keinen Waisen. Der Hebel liegt beim Erklärtext auf Anforderung und nicht bei einem zweiten `title`: ein zweiter Erklärweg wäre genau der Fehler, den die Komponente vermeiden soll, und er bliebe für Tastatur und Touch unerreichbar. Danach erbt jedes künftige Kopfzeichen denselben Mechanismus, statt einen eigenen zu brauchen.

## Missing-Docs

- Keine neue Architektur-Regel; ADR-0020 ist die Regel. `A00009-oberflaeche.md` nennt den Spaltenkopf — das Primitiv ist ein Zusatz, keine Abweichung.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene Interaction I0109 mit eigener Anforderung R00119, **Elterndialog D0007** nach dem architekt-Vorschlag (ADR-0020, Commit `89e19f6`) und der Karte #24 — **nicht** Feature unter I0086: F0015 schließt den Tooltip ausdrücklich aus, I0086 ist grün, und der Umfang (fünf Zeichen, Fokus, langer Druck, Esc) ist breiter. Muster: I0106/I0107/I0108 (eigene Interaction statt Bubbles an eine abgenommene Interaction, `AI-Team/gelerntes.md` 2026-11-11). Drei Features = Erklärtext/Name, Auslöser/Primitiv, Anzeige; acht Bubbles.
- **Hinweis zur Elternwahl**: Die Karte und ADR-0020 nennen D0007 (Agenten-Schnittstelle), der Tooltip liegt aber sichtbar auf dem **Board** (Artboard D0002). Die Wahl folgt der bindenden Vorgabe D0007; der Artboard-Zustand gehört zur Board-Ansicht D0002. Sollte der Director D0002 vorziehen (wie I0106/I0107/I0108, die ebenfalls unter D0002 liegen), ist der Knoten umzuhängen.
- **Artboard-Abhängigkeit**: Zustand „Erklärtext auf Anforderung" am Artboard D0002 (Board), freizugeben durch den product-owner vor dem Bau. Er zeigt: Hell und Dunkel; je Kopfzeichen offen (ⓘ, ✓, Phase, Grenze normal/überschritten, Eigentümer Mensch/Agent); Fokuszustand (Fokusring + Blase); langer Druck/Touch; Esc/geschlossen; mehrere Auslöser in einem Spaltenkopf (nur eine Blase); zugeklappte Spalte (Zeichen `aria-hidden`, Auslöser ist der Streifen-Knopf); Position und 320/375/414 px ohne Querscrollen; und die offene Frage Plain↔Rich.
- **Verworfene Alternativen**: native `title` (A), `#pop`-Erweiterung (C), native Popover-API (D), CSS-only (E) — je ein Satz in ADR-0020 (Optionen).
