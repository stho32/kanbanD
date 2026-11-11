---
id: R00129
status: Neu
datum: 2026-11-11
---

# R00129: Geschätzte Zeit je Karte (rein informativ)

## Beschreibung

Jede Aufgabe kann optional eine **geschätzte Zeit** tragen: die Dauer, die ein Mensch oder ein KI-Werkzeug für sie veranschlagt. Sie steht als Frontmatter-Schlüssel `estimate` in der Aufgabendatei, als ganze Minuten (`estimate: 150` heißt 2 h 30 min). Die Oberfläche blendet sie **nur ein, wenn sie gesetzt ist** — auf der Karte als `h:mm` und im Aufgabenfenster als Feldzeile „Geschätzt“. Geschrieben wird der Wert in dieser Ausbaustufe **nur über die API**; die Oberfläche liest ihn nur. Der Wert ist **rein informativ**: keine Auswertung, keine Prognose und keine Warnung rechnet damit (Karte #37, Auftraggeber-Entscheidung 2026-11-03, `AI-Team/po-entscheidungen.md:61`).

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen rechnen aus dem, was geschehen ist“ (der Wert wird gespeichert und angezeigt, nie ausgewertet) und „Mensch und Agent arbeiten gleichberechtigt“ (Agenten setzen die Schätzung über dieselbe Tür wie alles andere).

**Bewusst außerhalb** (ADR-0023): Story Points (PO Z. 61); jede Auswertung des Wertes (kein Bericht, keine Prognose, keine Warnung, keine Summe, keine Gegenüberstellung „geschätzt gegen gebucht“); eine Spanne statt eines Wertes; ein Eingabefeld in der Oberfläche (die erste Ausbaustufe setzt über die API, wie `cost`).

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Ein KI-Werkzeug oder ein Mensch veranschlagt für eine Aufgabe eine Dauer — heute steht sie nirgends am Werkstück; die Karte zeigt nur die **gebuchte** Zeit (`Σ`, R00089). Mit einem optionalen Feld „geschätzte Zeit“ sieht der Betreiber auf der Karte und im Aufgabenfenster, was veranschlagt war, ohne eine zweite Liste zu führen, und Agenten können ihre Schätzung über dieselbe Tür vermerken, über die sie sonst schreiben. Der Wert bleibt rein informativ: er wird gespeichert und angezeigt, mehr nicht — damit bleibt die Leitplanke „Auswertungen rechnen aus dem, was geschehen ist“ gewahrt, und es entsteht kein Projektmanagement-Werkzeug (R00000:183, PO Z. 61).

## Funktionale Anforderungen

### Form in der Datei (ADR-0023)
- Ein Schlüssel `estimate` im Frontmatter der Aufgabe trägt die geschätzte Zeit als **ganze Zahl von Minuten** ohne Einheit und ohne Anführungszeichen: `estimate: 150` heißt 2 h 30 min. `estimate` ist die kanonische Repräsentation; es gibt keinen zweiten Schlüssel und keine abgeleitete Angabe daneben.
- Der Wert ist entweder gar nicht gesetzt oder **positiv**: ganze Zahl ≥ 1 und ≤ 100.000. `0` gibt es nicht; „nicht gesetzt“ ist das **Fehlen** des Schlüssels (PO Z. 61: nur eingeblendet, wenn gesetzt).
- `2.5`, `"150"`, `150.0`, `0`, `-1`, `.inf`, `.nan` und `2:30` sind keine gültigen Werte.

### Setzen und lesen (Tür)
- **Kein eigener Endpunkt**: `PATCH /api/aufgaben/{nr}` und `PATCH /api/aufgaben/mehrere` bekommen das Feld `estimate`. Ein Wert ersetzt den Wert, `null` entfernt ihn, ein fehlendes Feld lässt ihn unverändert.
- Jede Änderung ist ein Commit „#n geändert: Geschätzte Zeit“; ohne Änderung entsteht kein Commit.
- `GET` liefert `estimate` als **JSON-Zahl**; die OpenAPI beschreibt das Feld in derselben `Aufgabenaenderung` wie `cost`, samt 400.
- Der Schlüssel `estimate` kommt in `BEKANNT` (`src/format/aufgabe.rs`) und in die Schreibreihenfolge, damit der Wert nicht mehr als unbekannter Schlüssel durch `weitere` läuft.

### Fehlerwege
- **Datei und API rufen dieselbe Prüfung.** Ein ungültiger Wert in der Datei macht die Aufgabe **defekt und nur lesbar** (423); die Meldung nennt den Pfad: `estimate: ganze Zahl von Minuten ≥ 1 erwartet`.
- In der API ist **jeder** Fehler im Rumpf `estimate` — auch ein Typfehler — **400** mit derselben Meldung, nie 422 und nie 500; nichts wird geschrieben. Dafür kommt `estimate` wie `cost` als rohes JSON an (`Option<Option<serde_json::Value>>`, entfernbar).

### Anzeige
- Karte und Aufgabenfenster zeigen die geschätzte Zeit als `h:mm` über den vorhandenen Helfer `hm`, **nur wenn** der Wert gesetzt ist. Eine Aufgabe ohne `estimate` bekommt weder auf der Karte noch im Fenster ein Element; ihr Markup ist wie heute.
- Auf der Karte steht die geschätzte Zeit in der unteren Zeile `.r3` **innerhalb von `.rechts` unmittelbar nach `Σ h:mm`** und ist von ihr unterscheidbar. Sie ist ein **eigenes `<span>`**, kein Bedienelement. **Sichtbar** trägt sie das Zeichen `≈` und den Wert `h:mm` (Form A der UX-Vorprüfung #37: `≈ 2:30`); der sichtbare Inhalt ist `aria-hidden="true"`. **Im** Element steht als visuell versteckter Text `<span class="vh">Geschätzt <h:mm></span>`, der den zugänglichen Namen „Geschätzt 2:30“ trägt. Ein `aria-label` an dem rollenlosen `<span>` ist ausgeschlossen (Muster `.preis`/`.due`, R00105). Alternative B (sichtbar „Geschätzt 2:30“) steht unter „Notizen“. Ort und Form sind mit der UX-Vorprüfung #37 festgelegt; der Gestalter zeichnet den Zustand an D0002 (siehe „Gestaltung“).
- Die Anzeige ist **kein neues Ziel**: das Element trägt keinen `tabindex`, keine Rolle (kein `role`) und kein `data-act`; es ist nicht fokussierbar und nicht bedienbar (ADR-0012 gilt nicht).
- **Umbruch/Platz**: `.ka .r3 .rechts` **bricht um** (`flex-wrap:wrap; justify-content:flex-end; gap:4px 6px`, wie die freigegebene R00105-Anordnung am Artboard D0002); reicht der Platz nicht, rutscht die Gruppe rechtsbündig in eine eigene Zeile. Auf schmalen Breiten scrollt die Seite nicht quer, und die Karte bleibt im Rechteck ihrer Spalte.
- Im Aufgabenfenster steht sie als **Feldzeile** über den vorhandenen Baustein `${vBeschriftung('estimate')}`: die Beschriftung „Geschätzt“ (`FELDER.estimate = 'Geschätzt'`) in `.k`, der Schlüssel `estimate` als Hilfstext in `.sl` **außerhalb von `.k`** ([ADR-0013](../Dokumentation/ADRs/0013-deutsche-anzeige-an-der-zeichengrenze.md) N1), der Wert `h:mm` in `.w.mono`. Die Zeile ist **nur lesend**: kein `input`, `select` oder `textarea`, kein `data-af`/`data-nf`; das Element ist nicht fokussierbar und nicht bedienbar. Die Schrift der Beschriftung folgt der PO-Entscheidung aus Karte #104 (R00109-Zeichnung: Sans 500 `--kd-text`, `.felder .kb .k`) — es entsteht keine eigene Schrift. Lage nach D0003.
- Die Anzeige ist eine Ableitung aus dem gespeicherten Wert und wird **nie gespeichert**.

### Grenzen (rein informativ)
- **Kein Rechnen**: keine Auswertung, kein Bericht, keine Summe, keine Prognose und keine Warnung liest `estimate` (PO Z. 61). Der Wert wird gespeichert und angezeigt, mehr nicht.
- **Bestand**: Eine Aufgabe ohne `estimate` bekommt keine neue Zeile und wird unverändert gelesen und geschrieben. Eine bisher geduldete, formwidrige Angabe (`estimate: 2:30`, `estimate: 0`) gilt nach dieser Anforderung als defekt und wird nicht still verworfen (ADR-0023 Regel 8). Ein von Hand geschriebenes `estimate: 3` gilt als drei Minuten.

## Nicht-funktionale Anforderungen
- **Verträglichkeit**: kein Fehler zu `estimate` antwortet mit 422 oder 500 (wie `cost`, ADR-0009).
- **Barrierefreiheit**: die geschätzte Zeit hängt nicht an der Farbe allein; auf der Karte trägt das Element den zugänglichen Namen „Geschätzt <h:mm>“ — sichtbar `≈ <h:mm>` (`aria-hidden="true"`), versteckter Name `<span class="vh">Geschätzt <h:mm></span>` **im** Element, **kein** `aria-label` an einem rollenlosen `<span>` —, im Fenster die Beschriftung „Geschätzt“ samt Schlüssel `estimate` als Hilfstext außerhalb von `.k`. Das Element ist weder fokussierbar noch bedienbar (kein `tabindex`, keine Rolle, kein `data-act`).
- **Kontrast**: der sichtbare Wert hält in beiden Themen **mindestens 4,5:1** auf jedem Kartengrund (WCAG 1.4.3, ADR-0011); auf einer Karte mit eigener Klassenfarbe (`data-eigen`) trägt er `--kd-text` wie das Preisetikett (`.ka[data-eigen] .preis`, R00105), weil `--kd-muted` auf hellen eigenen Farben unter 4,5:1 fällt; die `kontrast.spec` misst hell und dunkel.
- **Breite**: bei 320, 375 und 414 px scrollt die Seite nicht quer (ADR-0015); `.ka .r3 .rechts` bricht um wie die R00105-Anordnung, und die Karte bleibt im Rechteck ihrer Spalte.
- **Bestand**: keine vorhandene Aufgabe ändert sich durch das Lesen; heute trägt keine Aufgabendatei `estimate` als bekannten Wert (`estimate` war bis ADR-0023 ein unbekannter Schlüssel, siehe R00004).

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte); Aufgabe #1 in „Eingang“ ohne Schätzung, #4 in „Eingang“ ohne Schätzung. Eine von Hand geschriebene Datei wird direkt in den Ordner gelegt.

### Schätzung setzen und lesen
- [ ] Gegeben #1 ohne Schätzung, wenn über die API `estimate: 150` gesetzt wird, dann gibt es genau einen Commit „#1 geändert: Geschätzte Zeit“, die Datei enthält `estimate: 150`, und ein Lesen liefert 150
- [ ] Gegeben #1 mit `estimate: 150`, wenn derselbe Wert noch einmal gesetzt wird, dann bleibt die Zahl der Commits gleich
- [ ] Gegeben #1 mit `estimate: 150`, wenn `estimate: 90` gesetzt wird, dann ersetzt 90 den Wert und die Datei enthält `estimate: 90`
- [ ] Gegeben #1 mit `estimate: 150`, wenn `estimate: null` gesetzt wird, dann fehlt der Schlüssel in der Datei und es gibt genau einen Commit „#1 geändert: Geschätzte Zeit“
- [ ] Gegeben #1 mit `estimate: 150`, wenn nur der Titel geändert wird, dann bleibt `estimate` unverändert
- [ ] Grenzwert: Gegeben #1, wenn `estimate: 1` und danach `estimate: 100000` gesetzt wird, dann je 200, und die Datei enthält beide Male den kürzesten Zahltext
- [ ] Gegeben #1 und #4, wenn `estimate: 30` über das Ändern mehrerer Aufgaben gesetzt wird, dann tragen beide 30 und es gibt je einen Commit
- [ ] Gegeben eine von Hand geschriebene Aufgabe ohne `estimate`, wenn kanbanD den Ordner liest und ihren Titel ändert, dann ist die Datei danach bis auf die Titelzeile byte-gleich (keine neue Zeile für die Schätzung)

### Ungültige Werte und defekte Dateien
- [ ] Fehlfall: Gegeben #1 ohne Schätzung, wenn nacheinander `estimate: 2:30`, `estimate: "150"`, `estimate: 150.0`, `estimate: 2.5`, `estimate: 0`, `estimate: -1`, `estimate: 100001`, `estimate: .inf`, `estimate: .nan` und `estimate: true` gesetzt wird, dann antwortet jeder Aufruf 400 mit „estimate: ganze Zahl von Minuten ≥ 1 erwartet“, die Datei ist byte-gleich und die Zahl der Commits gleich
- [ ] Fehlfall: Gegeben #1 und #4, wenn ein ungültiges `estimate` über das Ändern mehrerer Aufgaben für beide gesetzt wird, dann 400 und keine der beiden Dateien ändert sich
- [ ] Gegeben ein beliebiger Fehlfall dieser Gruppe, wenn er abgewiesen wird, dann ist der Status 400 (nie 422, nie 500), die Datei byte-gleich und die Zahl der Commits gleich
- [ ] Gegeben eine von Hand geschriebene Aufgabe mit `estimate: 2:30`, wenn der Ordner gelesen wird, dann ist die Aufgabe defekt und nur lesbar mit der Meldung „estimate: ganze Zahl von Minuten ≥ 1 erwartet“
- [ ] Gegeben eine von Hand geschriebene Aufgabe mit `estimate: 3`, wenn der Ordner gelesen wird, dann ist sie lesbar und trägt drei Minuten (angezeigt als `0:03`), und beim Schreiben bleibt `estimate: 3` zeichengleich

### Anzeige auf der Karte
- [ ] **Form, Ort und Name (UX-Vorprüfung #37, Form A)**: Gegeben #1 mit `estimate: 150`, wenn das Board angesehen wird, dann steht in `.r3 .rechts` **unmittelbar nach dem Element `.sum`** ein eigenes `<span>` mit sichtbar `≈ 2:30` (`aria-hidden="true"`) und **im** Element der versteckte Text `<span class="vh">Geschätzt 2:30</span>`; der zugängliche Name des Elements lautet „Geschätzt 2:30“; das Element trägt **kein** `aria-label`, **kein** `tabindex`, **keine** Rolle und **kein** `data-act`; die Datei von #1 ist danach byte-gleich
- [ ] Gegeben #1 mit `estimate: 5`, wenn das Board angesehen wird, dann zeigt die Karte „≈ 0:05“ (fünf Minuten, nicht fünf Stunden)
- [ ] Grenzwerte: Gegeben #1 mit `estimate: 100000`, wenn das Board angesehen wird, dann zeigt die Karte „≈ 1666:40“ und der zugängliche Name lautet „Geschätzt 1666:40“; mit `estimate: 1` zeigt sie „≈ 0:01“ und der Name „Geschätzt 0:01“
- [ ] Gegeben #1 mit `estimate: 150` und 46 Minuten gebuchter Zeit, wenn das Board angesehen wird, dann stehen die gebuchte Zeit „Σ 0:46“ und die geschätzte Zeit „≈ 2:30“ beide auf der Karte mit je ihrem Wert, und die Schätzung steht **nach** der Summe
- [ ] **Kein neues Ziel**: Gegeben #1 mit `estimate: 150`, wenn ich mit `Tab` durch das Board gehe, dann ist das Element der geschätzten Zeit kein Fokuspunkt und löst bei Klick und Tastendruck nichts aus
- [ ] Leerfall: Gegeben #4 ohne Schätzung, wenn das Board angesehen wird, dann trägt die Karte kein Element für die geschätzte Zeit, und ihr Markup ist wie heute
- [ ] **Kontrast und Klassenfarbe**: Gegeben #1 mit `estimate: 150`, wenn die Anzeige hell und dunkel auf Normalgrund und auf einer Karte mit eigener Klassenfarbe (`data-eigen`) gemessen wird, dann hält der sichtbare Wert je **mindestens 4,5:1** und trägt auf `data-eigen` `--kd-text` (ADR-0011)
- [ ] **Schmales Layout**: Gegeben eine Karte, die zugleich Preisetikett, `Σ`, Schätzung, Fälligkeit, Herkunft und **zwei Zuständige** trägt (Spaltenbreite 236 und 272 px), wenn die Fensterbreite auf 375 (und 320 bzw. 414) px gesetzt wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth`, die Karte bleibt im Rechteck ihrer Spalte (kein Überlauf), die Zeile `.r3 .rechts` bricht um, und die Schätzung liegt unmittelbar nach `Σ` — hell und dunkel
- [ ] Gegeben #1 mit `estimate: 150`, wenn 60 s zugesehen wird, dann steigt `kdTest.renders()` ohne Ereignis nicht (kein zweiter Takt für die Anzeige)

### Anzeige im Aufgabenfenster, rein informativ
- [ ] **Feldzeile nach ADR-0013 N1**: Gegeben #1 mit `estimate: 150`, wenn das Aufgabenfenster geöffnet wird, dann steht eine `.felder`-Zeile `${vBeschriftung('estimate')}` mit der Beschriftung „Geschätzt“ in `.k` und dem Schlüssel `estimate` in `.sl` **außerhalb von `.k`**, der Wert „2:30“ steht in `.w.mono`; die Zeile enthält **kein** `input`, `select` oder `textarea` und **kein** `data-af`/`data-nf`; Datei und Zahl der Commits bleiben gleich
- [ ] Leerfall: Gegeben #4 ohne Schätzung, wenn das Aufgabenfenster geöffnet wird, dann fehlt die Feldzeile „Geschätzt“ ganz
- [ ] Gegenbeispiel: Gegeben #1 mit `estimate: 150`, wenn nacheinander Burndown, „Wie lange noch“, „Kosten“ und „Zeiten nach Aufgabe und Person“ geöffnet werden, dann nennt keiner dieser Berichte die geschätzte Zeit, und Board- und Aufgabendatei sind danach byte-gleich

## Betroffene Verzeichnisstruktur
- Server: Modell und Prüfung in `src/modell/aufgabe.rs` (neben `cost`), Dateiformat in `src/format/aufgabe.rs`, Tür und OpenAPI über die bestehende Aufgabenänderung und `src/web/endpunkte.rs`; Integrationstests unter `tests/`.
- Oberfläche: Darstellung in `web/ansicht.js` (`vKarte` und `vBeschriftung('estimate')`), Beschriftungstabelle `FELDER` in `web/kultur.js`, Aussehen in `web/kd-app.css`; E2E `e2e/tests/r00129-geschaetzte-zeit.spec.js`.

## Technische Überlegungen

Alle Entscheidungen zur Technik stehen in [ADR-0023](../Dokumentation/ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) und werden hier nicht wiederholt. Die Bubbles der WBS (B0607–B0613) sind **Vorplanung**; welche es beim Bauen werden, entscheidet der Entwickler.

### Ablauf
1. **Schätzung setzen, lesen und abweisen** (F0106, frei baubar)
   - 1.1 Geschätzte Minuten prüfen und ins Modell aufnehmen, eine Prüfung für Datei und API (B0607)
   - 1.2 `estimate` in der Aufgabendatei lesen und schreiben, Rundlauf (B0608)
   - 1.3 `estimate` aus der Anfrage umwandeln, ohne serde-Typisierung (B0609)
   - 1.4 PATCH einzeln und `/mehrere`, GET, OpenAPI (B0610)
2. **Anzeigen** (Oberfläche; Artboards D0002 und D0003 durch den product-owner freizugeben)
   - 2.1 Geschätzte Zeit an der Karte zeigen, `h:mm`, nur wenn gesetzt (B0611)
   - 2.2 Feldzeile „Geschätzt“ im Aufgabenfenster, nur lesend (B0612)
   - 2.3 Gegenprobe: nur wenn gesetzt, kein abgeleiteter Wert, keine Auswertung (B0613)

### Grobentwurf

**Wichtige Einstiegsstellen:** `PATCH /api/aufgaben/{nr}` und `PATCH /api/aufgaben/mehrere` (Feld `estimate`, neben `cost`); Kartendarstellung und Feldzeilen des Aufgabenfensters in `web/ansicht.js`.

**Elemente** (Signaturen nach ADR-0023):
- `Aufgabe.geschaetzte_minuten: Option<u32>` — die geprüfte Zahl; `null`/fehlend heißt „keine Schätzung“; im JSON als `estimate`.
- `estimate` in `Aufgabenaenderung` (roh, `Option<Option<serde_json::Value>>`, entfernbar) — geht durch dieselbe Prüfung wie das Frontmatter.
- `geschätzte_minuten_pruefen(wert) -> Result<Option<u32>, String>` (rein) — Datei und API rufen sie; sie liefert den Pfadfehler.
- `hm` (bestehend; Server `src/uhr.rs`, Browser `web/zeiten.js`) — formt den Wert als `h:mm`; es entsteht keine zweite Zeitform.
- `FELDER` (bestehend, `web/kultur.js`) — neuer Eintrag `estimate: 'Geschätzt'` (ADR-0013).

### Gestaltung

Die Anzeige der geschätzten Zeit ist eine **Aussage der Zeichengrenze** (ADR-0013): gespeichert ist eine Zahl in Minuten, sichtbar wird sie erst beim Zeichnen. Die Gestaltung ist ein neuer Zustand und braucht die **UX-Vorprüfung** und ein **Artboard** (der product-owner gibt frei, bevor gebaut wird; B0607–B0610 sind davon frei).

**UX-Vorprüfung #37 (2026-11-11) eingearbeitet.** Die vier **Muss**-Punkte sind in den funktionalen Anforderungen und Akzeptanzkriterien festgehalten:

- **Karte (D0002) — Form A.** Die geschätzte Zeit steht als eigenes `<span>` in `.r3 .rechts` **unmittelbar nach `Σ h:mm`**; sichtbar `≈ <h:mm>` (`aria-hidden="true"`), zugänglicher Name `<span class="vh">Geschätzt <h:mm></span>` **im** Element, **kein** `aria-label` an einem rollenlosen `<span>`. Form A (sichtbar `≈ 2:30`) ist gewählt, weil sie die freigegebene Preisetikett-Form (`.preis`, R00105) aufnimmt und von `Σ` (Zeichen) und vom Preis (Einheit) unterscheidbar bleibt; **Alternative B** (sichtbar „Geschätzt 2:30“) steht unter „Notizen“. Das Element ist nicht fokussierbar und nicht bedienbar (kein `tabindex`, keine Rolle, kein `data-act`).
- **Umbruch/Platz.** `.ka .r3 .rechts` **bricht um** (`flex-wrap:wrap; justify-content:flex-end; gap:4px 6px`, wie die R00105-Anordnung am Artboard D0002). Die Breitenprobe misst an einer Karte mit **Preis + `Σ` + Schätzung + Fällig + Herkunft + zwei Zuständigen** (Spalten 236 und 272 px) bei 320/375/414 px, hell und dunkel — kein Überlauf.
- **Aufgabenfenster (D0003).** Eine `.felder`-Zeile `${vBeschriftung('estimate')}` mit Beschriftung „Geschätzt“ in `.k`, Schlüssel `estimate` in `.sl` außerhalb von `.k` (ADR-0013 N1) und Wert `h:mm` in `.w.mono`, **nur lesend** (kein `input`/`select`/`textarea`, kein `data-af`/`data-nf`); Lage unter den übrigen Feldern der Seitenleiste. Die Schrift der Beschriftung folgt der PO-Entscheidung aus Karte #104 (R00109-Zeichnung: Sans 500 `--kd-text`).

**Bau-Sperre Oberfläche.** Die UX-Vorprüfung beschreibt **zwei** Zustände, die das Bauen der Oberfläche (F0107, B0611–B0613) sperren, bis der product-owner sie freigegeben hat:

- **D0002** Zustand `#geschaetzte-zeit` (das Etikett an der Karte),
- **D0003** Zustand `#geschaetzt-im-fenster` (die Feldzeile im Aufgabenfenster).

Der Gestalter zeichnet beide Zustände; der product-owner gibt frei. Der Server-Teil (F0106, B0607–B0610) hängt nicht daran und bleibt frei baubar.

Gilt ein Artboard anders als ein Kriterium, gilt das Kriterium (wie R00105). Die Anzeige ist neutral, ohne neue Farbrolle (ADR-0011) und ohne Warnform.

### Änderungen an bestehenden Klassen
- `Aufgabe` (`src/modell/aufgabe.rs`): neues Feld `geschaetzte_minuten` mit `#[serde(rename = "estimate")]`.
- `Aufgabenaenderung`: neues entfernbares Rohfeld `estimate` (wie `cost`).
- `src/format/aufgabe.rs`: `estimate` in `BEKANNT` und in die Schreibreihenfolge; der Test `handgeschriebene_datei_ohne_id_mit_sekunden_und_unbekanntem_schluessel` wählt einen anderen unbekannten Schlüssel, weil `estimate` bekannt wird.
- `web/kultur.js` `FELDER`: Eintrag `estimate: 'Geschätzt'`.
- `web/ansicht.js` `vKarte`: ein Element mehr je Karte (in `.r3 .rechts` unmittelbar nach `vSumme`); `vBeschriftung('estimate')` als neue Feldzeile.
- `web/kd-app.css`: `.ka .r3 .rechts` bricht um (`flex-wrap:wrap; justify-content:flex-end; gap:4px 6px`); der sichtbare Wert hält ≥ 4,5:1, auf `data-eigen` `--kd-text` (Muster `.ka[data-eigen] .preis`, R00105).
- OpenAPI/Beschreibung (`src/web/endpunkte.rs`, `src/web/mod.rs`): Feld `estimate` mit Schema und 400.

### Umfang
- F0106: 4 Bubbles, 2,5–5 h; F0107: 3 Bubbles, 1,5–3 h; zusammen 7 Bubbles, 4–8 h. Richtwerte nach dem Muster von F0038/F0039 (R00105), ungemessen (Hypothese). Klein gehalten: der Wert trägt keine Auswertung, und die Anzeige nutzt den vorhandenen `hm`.

## Tests
Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** die Prüffunktion je Regel mit Grenz- und Gegenwert (1, 100.000, 0, -1, 2.5, `"150"`, 150.0, `.inf`, `.nan`, `2:30`); Rundlauf der Minuten 1–100.000 plus Ränder; die Umwandlung des Rohwerts je Fehlfall; die Anzeige-Rechnung `150 → 2:30`, `5 → 0:05`, `1 → 0:01`, `100000 → 1666:40` und „ohne Wert kein Feld“.

**Integration:** `PATCH` einzeln und `/mehrere` gegen einen echten Ordner mit Git — Commit-Zahl vorher/nachher, Datei neu gelesen, jeder Fehlfall 400 mit Datei byte-gleich; defekte Datei → nur lesbar.

**E2E:** US-4, US-5 und US-6 gegen das laufende Programm auf freiem Port; zugänglicher Name aus sichtbarem (`aria-hidden`) und verstecktem Text (`.vh`); das Element ist kein Fokuspunkt; die Breitenprobe an der vollen `.r3 .rechts`-Zeile (Preis + `Σ` + Schätzung + Fällig + Herkunft + zwei Zuständige) bei 320/375/414 px hell und dunkel nach `ziele.spec.js`; Prüfsumme der Aufgabendatei vor und nach dem Ansehen; ein Bericht öffnen und belegen, dass er die geschätzte Zeit nicht nennt.

## Abhängigkeiten
- ADR-0023 (Akzeptiert, `5a740cb`); ADR-0009 (Zuschnitt: kanonisch in der Datei, eine Prüfung für Datei und API, jeder Fehler 400); ADR-0013 (deutsche Anzeige an der Zeichengrenze).
- Abhängig von (grün): I0004 Board ansehen (R00004), I0011 Aufgabe ansehen und bearbeiten (R00011).
- Berührt: **R00004** — dessen Akzeptanzkriterium „Ein unbekannter Schlüssel `estimate: 3` bleibt beim Schreiben erhalten“ (`R00004-board-ansehen.md:35`) verliert seinen Beispielschlüssel, weil `estimate` jetzt bekannt ist (Beispiel tauschen; Anpassung außerhalb dieser Anforderung). **R00127/I0115** (Kartenabschnitte auf Reitern): wandert die Feldzeile mit den übrigen Feldern in einen Reiter „Details“, ordnet sie dort ein, wer zuerst baut.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockieren. Empfehlungen des planers (Entscheidungen im Bericht); richtungsweisend bleibt die Artboard-Frage (product-owner):

1. **Schlüsselname** `estimate` oder `estimated`? Empfehlung: `estimate` — er läuft heute schon als unbekannter Schlüssel durch die Dateien und die Probe (ADR-0023 Folgeentscheidung). Der product-owner kann den Namen kippen, ohne die Repräsentation zu ändern.
2. **Artboard?** Ja, **zwei** Zustände — mit der UX-Vorprüfung #37 entschieden: D0002 `#geschaetzte-zeit` (Etikett) und D0003 `#geschaetzt-im-fenster` (Feldzeile). Der Gestalter zeichnet beide, der product-owner gibt frei; sie sind **Bau-Sperre Oberfläche** für F0107 (B0611–B0613). Form A (`≈ 2:30`) ist die Empfehlung der UX-Vorprüfung, Alternative B („Geschätzt 2:30“) steht unter „Notizen“. F0106 und die Bubbles B0607–B0610 hängen nicht daran.
3. **Setzweg?** In der ersten Ausbaustufe nur über die API (wie `cost`, PO Z. 31); ein Eingabefeld im Fenster ist eine spätere Ausbaustufe (ADR-0023 Folgeentscheidung).
4. **Darf ein Agent `estimate` setzen?** Ja, uneingeschränkt — der Wert ist rein informativ und gerade für die Schätzungen der KI-Werkzeuge gedacht (Karte #37); kein Schutz wie bei der WIP-Grenze.
5. **Obergrenze 100.000?** Technischer Schutz gegen Tippfehler, keine Produktregel; er darf angehoben werden, solange die Rundlauf-Probe grün bleibt (ADR-0023 Regel 2).

## Manuelle Vorbereitungstätigkeiten

Bildschirmfotos für den Abnahmezettel (nach der UX-Vorprüfung #37 und der Freigabe der Artboards): Board mit einer Karte mit geschätzter Zeit (mit und ohne gebuchte Zeit, mit und ohne Preisetikett; dazu die **volle** untere Zeile mit Preis + `Σ` + Schätzung + Fällig + Herkunft + zwei Zuständigen, Spalten 236 und 272 px) und das Aufgabenfenster mit der Feldzeile „Geschätzt“ samt Schlüssel; bei 320, 375, 414 und 1280 px, je hell und dunkel.

## Manuelle Nachbereitungstätigkeiten
- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Entscheidung des Auftraggebers (Karte #37, 2026-11-03): KI-Werkzeuge liefern Schätzungen für eine Aufgabe, und heute gibt es keinen Ort, sie am Werkstück zu vermerken — die Karte zeigt nur, was **gebucht** wurde (`Σ`, R00089). Wenn der Wert als `estimate` in Minuten in der Aufgabendatei steht und die Oberfläche ihn nur einblendet, dann sieht der Betreiber veranschlagte und gebuchte Zeit nebeneinander, und ein Agent kann seine Schätzung über dieselbe Tür schreiben, über die er sonst arbeitet. Weil derselbe Wert in Datei und API durch **eine** Prüfung geht (ADR-0023), stimmen Handschrift, Datei und API überein, und jeder Fehler ist sichtbar (400 in der API, defekte Datei mit Pfad in der Ablage). Der Hebel ist die Aufgabendatei: sie ist der einzige Speicher, und ohne ein Feld hätte eine Anzeige keine Quelle. Bewusst **nicht** gewählt wurde eine Auswertung: der Wert wird gespeichert und angezeigt, mehr nicht — so bleibt die Vision-Leitplanke „Auswertungen rechnen aus dem, was geschehen ist“ gewahrt und kanbanD kein Projektmanagement-Werkzeug (PO Z. 61).

## Missing-Docs
- Das Domänenwissen zu Hauptbereich und Aufgabenfenster nennt die Zeile `.r3` und die Felder der Seitenleiste; nach dem Bau ergänzt der Entwickler dort „geschätzte Zeit“ (`estimate`, nur wenn gesetzt) und ihre Anzeigeform.
- Das Glossar hat keinen Eintrag für „geschätzte Zeit“ (Abgrenzung zu „gebuchte Zeit“/`Σ`). Vorschlag: nach dem Bau ein Eintrag mit `estimate`, der Einheit (Minuten) und der Beziehung zu R00089 und R00105.

## Notizen

**Detailplanung:** WBS **I0120** (Interaction unter D0003, R00129) mit F0106 (B0607–B0610, Server) und F0107 (B0611–B0613, Anzeige), 2 Features, 7 Bubbles, 4–8 h; alles `rot` (Stand 2026-11-11). Herkunft der Karte #37: `kd:I0120`, `kd:R00129`.

**Eigene Interaction unter D0003.** Datenmodell, Tür und Feldzeile hängen am Aufgabenfenster; das Etikett auf dem Board (D0002) ist ein Aspekt derselben Daten — dieselbe Begründung wie bei I0093/R00105 („Preisetikett je Aufgabe auf Karte und im Detail“). Muster: F0038/F0039 (Kosten setzen/anzeigen, I0093).

**UX-Vorprüfung #37 (2026-11-11).** Vier **Muss** und die **Sollte** der Vorprüfung sind in die Anforderungen, die User Story (US-4, US-5, US-6) und die WBS eingearbeitet: (1) Anzeigemechanik und zugänglicher Name an der Karte (eigenes `<span>` in `.r3 .rechts` unmittelbar nach `Σ`, sichtbar `aria-hidden`, Name als `.vh` **im** Element, kein `aria-label` an einem rollenlosen `<span>`); (2) `.ka .r3 .rechts` bricht um (`flex-wrap:wrap; justify-content:flex-end; gap:4px 6px`) mit Breitenprobe an der vollen Zeile (Preis + `Σ` + Schätzung + Fällig + Herkunft + zwei Zuständige; Spalten 236/272 px; 320/375/414 px; hell und dunkel); (3) kein neues Ziel (kein `tabindex`, keine Rolle, kein `data-act`); (4) Feldzeile `${vBeschriftung('estimate')}` mit Wert `h:mm` in `.w.mono`, nur lesend, Schlüssel in `.sl` außerhalb von `.k` (ADR-0013 N1). Sollte: Schätzung **nach** `Σ` (die Komma-Logik des Preises bleibt unberührt — das Komma hängt an `.preis` und bleibt bei vorhandenem `Σ`); längster/kleinster Wert (`1666:40` / `0:01`) als Akzeptanzkriterium; Kontrast ≥ 4,5:1, auf eigener Klassenfarbe `--kd-text`.

**Form A gegen B.** Die UX-Vorprüfung #37 empfiehlt **Form A**: sichtbar `≈ 2:30` (Zeichen `≈` wie das Preisetikett, Wert `h:mm`), sichtbar `aria-hidden`, Name `.vh` „Geschätzt 2:30“. **Alternative B** — sichtbar „Geschätzt 2:30“ (Wort statt Zeichen) — ist dokumentiert und verworfen: sie macht die Zeile breiter (die Breitenprobe der Vorprüfung fällt bei 320 px enger aus) und wiederholt den Namen, während A die freigegebene Preisetikett-Form aufnimmt. **Alternative C** (nur Wert mit `title`) ist verworfen: der Name hinge an einem Tooltip.

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — ganze Minuten in der Datei (`estimate: 150`), eine Prüfung für Datei und API, Anzeige `h:mm`** (gewählt, ADR-0023): eindeutig für jeden YAML- und JSON-Leser, keine neue Grammatik, nutzt den vorhandenen `hm`; gleiche Linie wie `cost` in ganzen Cent.
- **B — Dauertext in der Datei (`estimate: 2:30`)**: ohne Umrechnen lesbar, doch `2:30` liest serde_yaml als Text, PyYAML als 150, Ruby Psych als 9000 — dieselbe Datei bedeutet je Werkzeug etwas anderes; verworfen (ADR-0023 Probe).
- **C — ganze Sekunden (`estimate: 9000`)**: nutzlos fein und schwerer zu lesen; verworfen.
- **D — ISO-8601-Dauer (`PT2H30M`) oder Objekt `{h, m}`**: neue Grammatik bzw. neuer Namensraum für einen rein informativen Wert; verworfen.

**Verworfene Alternativen (Schnitt):**
- **Den Wert in einem Bericht auswerten** („geschätzt gegen gebucht“): widerspricht PO Z. 61 und der Vision; eigene Anforderung erst auf Betreiberwunsch.
- **Ein Eingabefeld im Aufgabenfenster** in derselben Ausbaustufe: die erste Ausbaustufe setzt über die API (wie `cost`); ein Fenster-Setzweg ist eine spätere Ausbaustufe.

**Verwiesenes**
- Karte #37 „Feld „geschätzte Zeit“ je Karte (rein informativ)“ (Herkunft: Entscheidung des Betreibers 2026-11-03 nach Beratung des product-owners; Priorität „nicht superwichtig“).
- [ADR-0023](../Dokumentation/ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) (Akzeptiert, `5a740cb`): `estimate` als ganze Minuten, eine Prüfung für Datei und API (jeder Fehler 400), Anzeige `h:mm`, kein Rechnen, Setzweg API-only erste Ausbaustufe.
- `AI-Team/po-entscheidungen.md:61` (Auftraggeber, 2026-11-03), `:31`, `:85`; R00089 (gebuchte Zeit auf der Karte), R00105 (Preisetikett je Aufgabe).
- Karte #104 (PO-Entscheidung `b016dea`): die `.k`-Beschriftung im Aufgabenfenster trägt die R00109-Schrift (Sans 500 `--kd-text`, `.felder .kb .k`) — gilt auch für die Feldzeile „Geschätzt“, es entsteht keine eigene Schrift.
