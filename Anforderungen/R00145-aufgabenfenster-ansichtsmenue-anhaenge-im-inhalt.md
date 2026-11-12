---
id: R00145
status: Neu
datum: 2026-11-12
---

# R00145: Aufgabenfenster — Ansichtswechsel als Menü, Anhänge im Inhalt

## Beschreibung

Die Reiterleiste im Aufgabenfenster (Inhalt · Zeiten · Anhänge · Details · Datei · [Kosten] · Verlauf) nimmt im Kopf zu viel Platz ein. Diese Anforderung ersetzt sie durch **ein Menü**, das die aktuelle Ansicht nennt und die übrigen zur Wahl stellt; die Rolle `tablist` entfällt im Fenster. Die **Anhänge** verlieren ihren eigenen Eintrag und stehen als Abschnitt im **Inhalt** nach den Teilaufgaben. Es bleiben die Ansichten **Inhalt · Zeiten · Details · Datei · (Kosten) · Verlauf**.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgeräumt und folgt gewohnten Konventionen"; der Kopf trägt ein Ziel statt einer Leiste, und jede Sache steht an genau einem Ort.

**Zwei frühere Festlegungen sind damit ausdrücklich aufgehoben:**

- **„Die Reiterleiste bleibt `tablist`; ein Menü wäre eine eigene Neugestaltung"** — R00127 Offene Frage 1 (Architekt-Entscheidung 2026-11-11) und die darauf gebaute Hülle aus R00105. Aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#145); die Neugestaltung ist damit beauftragt. Die Architektur hat sie in **ADR-0018 Nachtrag N2** aufgenommen (Commit `40413ef`), A00009 und X00005 sind nachgezogen.
- **„Anhänge sind eine eigene Ansicht"** — R00127 FA/„Was in welchem Reiter steht" und R00116/R00103-Proben, die den Reiter öffnen. Aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#145): die Anhänge stehen im Inhalt.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md)

## Geschäftlicher Nutzen

Sieben Reiter nebeneinander brauchen im Kopf die Breite, die Pfad, Nummer und Aktionen brauchen; bei 320 und 375 px bricht die Leiste um (R00127 E1) und schiebt den Kopf in die Höhe. Ein Menü-Auslöser, der die aktuelle Ansicht nennt, kostet eine Zeile statt einer Leiste, bleibt auf jeder Breite einzeilig und wächst mit jeder künftigen Ansicht ohne Umbau. Die Anhänge gehören ohnehin zur Arbeit an der Aufgabe: Wer den Verlauf einer Aufgabe liest, will sehen, was an ihr hängt, ohne die Ansicht zu wechseln — deshalb stehen sie im Inhalt, und ein Eintrag „Anhänge" entfällt.

## Funktionale Anforderungen

### Ansichtswechsel als Menü

1. Der Ansichtswechsel des Aufgabenfensters ist **ein Menü am Fensterkopf**, keine `tablist`. `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"` und der roving `tabindex` kommen im Fenster **nicht** mehr vor.
2. **Eine Liste, ein Zustand.** Die Ansichten kommen aus der bestehenden Liste `REITER`/`reiterDerAufgabe` (`web/reiter.js`); gewählt wird aus `S.ui.tab`. Der Rückfall `tab ∉ reiterSchluessel(a)` → `inhalt` bleibt unverändert und deckt jede entfallende oder bedingte Ansicht.
3. **Die Ansichten** sind: **Inhalt · Zeiten · Details · Datei · (Kosten) · Verlauf**. „Kosten" erscheint nur bei einer Aufgabe mit Preisetikett und direkt hinter „Datei" (R00105); „Verlauf" ist immer da und der letzte Eintrag (R00123). „Anhänge" ist **keine** Ansicht mehr.
4. **Der Auslöser** nennt die **aktuelle Ansicht als Text**, trägt `aria-haspopup` und `aria-expanded` und steht im Kopf rechts vor „In VS Code öffnen" (↗) und dem Aktionsmenü (⋮, R00144). Er hat einen zugänglichen Namen, der die Ansicht nennt.
5. **Die Form des Menüs legt die UX-Vorprüfung fest** — `role="menu"` mit `menuitemradio`, ein natives `<select>` oder eine gleichwertige Auswahl. Diese Anforderung schreibt die Form **nicht** fest, weil ADR-0018 N2 (Grenze) sie ausdrücklich offenlässt. Bindend sind die Invarianten aus Punkt 2–4 und 6–8: eine Liste, ein Zustand, genau eine gezeichnete Ansicht, ein Auslöser mit `aria-haspopup`/`aria-expanded`, der die Ansicht nennt, und **kein `aria-current` im Fenster** — die Markierung trägt `aria-checked` am `menuitemradio` bzw. der Wert des Auslösers beim `<select>`.
6. **Genau eine Ansicht wird gezeichnet.** Der Inhaltsbereich ist kein `tabpanel` mehr; braucht er einen Namen, trägt er `role="group"` mit `aria-label` (kein `role="region"` ohne Anlass).
7. **Das Menü ist eine eigene Ebene der Fokusführung** (`fenstermenue` in `web/fokus.js` zwischen `fenster` und `pop`): im Fenster gezeichnet, Startziel der gewählte Eintrag, Pfeile/`Pos1`/`Ende`/`Enter` (bei `role="menu"`), `Esc` und `Tab` schließen mit Rückgabe an den Auslöser; die Lösch-Rückfrage (`alertdialog`) liegt darüber.
8. **Tastatur.** `d` wechselt weiter **Inhalt ↔ Datei** (unverändert); `←`/`→` und der Eintrag „← → Reiter wechseln" entfallen. Die Kürzelhilfe des Fensters nennt danach keinen Reiter-Wechsel mehr. Ob ein eigenes Kürzel das Ansichtsmenü öffnet, legt die UX-Vorprüfung fest (Empfehlung: nein — das Menü ist über den Auslöser und die Tabulatortaste erreichbar, und jedes neue Einzelbuchstaben-Kürzel kollidiert mit den Fenster-Kürzeln).
9. **Verhalten.** Beim Öffnen ist „Inhalt" gewählt; beim **Öffnen einer anderen Aufgabe** bleibt die gewählte Ansicht, außer die Aufgabe führt sie nicht (dann „Inhalt"). Ein Live-Ereignis behält Ansicht und Fokus (R00103/R00110); ist das Menü dabei offen, bleibt es offen.
10. **Der Fenstertitel bleibt unberührt** (R00116), ebenso `#t-mehr` der Kopfzeile.

### Anhänge im Inhalt

11. Die Anhänge stehen als Abschnitt **im Inhalt nach den Teilaufgaben** und vor den Kommentaren: Liste mit Name und Größe, Hochladen (Dateiwahl und Ziehen), ✕ zum Entfernen. Verhalten, Commits, Rückgängig (R00112) und Zielgrößen bleiben unverändert.
12. Der Eintrag **„Anhänge" entfällt** aus `REITER`; ein gemerkter Stand `S.ui.tab = 'anhaenge'` fällt über den Rückfall aus Punkt 2 auf „Inhalt" — ohne Datenformat-, Endpunkt- oder Aktionsänderung.
13. **Kein Abschnitt doppelt**: Was im Inhalt steht, fehlt in jeder anderen Ansicht; die Anhänge stehen genau einmal.

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Auslöser und Menü folgen dem APG-Muster „Menu Button" (role=menu) bzw. einem nativen Auswahlfeld; jeder Eintrag hat einen zugänglichen Namen, die gewählte Ansicht ist für Hilfstechnik erkennbar (`aria-checked` bzw. Wert), **kein `aria-current` im Fenster** (das bleibt der Kopfzeile, ADR-0018 Regel 5); Fokus immer sichtbar (WCAG 2.1 SC 2.4.7, 4.1.2). Zielgrößen nach ADR-0012 (≥ 24 px fein, ≥ 44 px Touch).
- **Schmale Breiten**: Bei 320, 375 und 414 px bleibt der **Kopf einzeilig** (Auslöser ersetzt Leiste und Blätterknöpfe); der Fokus liegt nie unter dem Rückgängig-Hinweis (`r00112`, dreimal aufgetreten). Kopf und Seite: `scrollWidth ≤ clientWidth`; das Menü liegt ganz im sichtbaren Bereich (ADR-0015).
- **Verträglichkeit**: Die Ansichten „Kosten" (R00105) und „Verlauf" (R00123) bleiben in Name, Reihenfolge und Verhalten; es entsteht **keine** zweite Ansichtsliste und kein zweiter Zustand.

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „fabrik" mit den Spalten „Eingang", „In Arbeit", „Fertig"; Aufgabe #1 mit Beschreibung, einer Teilaufgabe, einem Kommentar, einem Durchlauf, einem Anhang und einem Zeiteintrag; Aufgabe #2 ohne Preisetikett; Aufgabe #3 mit Preisetikett; Person `st` (Mensch).

### Ansichtsmenü

- [ ] Gegeben #1, wenn das Aufgabenfenster geöffnet wird, dann gibt es im Fenster **kein** `[role="tablist"]`, keinen `[role="tab"]` und kein `[role="tabpanel"]`; der Ansichts-Auslöser nennt „Inhalt", trägt `aria-haspopup` und `aria-expanded="false"`; `aria-current` kommt im Fenster nicht vor
- [ ] Gegeben das offene Fenster von #1, wenn der Ansichts-Auslöser betätigt wird, dann stehen als Einträge genau „Inhalt", „Zeiten", „Details", „Datei", „Verlauf" (in dieser Reihenfolge) und — bei #1 ohne Etikett — **kein** „Kosten" und **kein** „Anhänge"; die gewählte Ansicht ist markiert (`aria-checked="true"` bzw. der Wert des Auslösers), und genau ein Eintrag ist markiert
- [ ] Gegeben #3 mit Preisetikett, wenn das Menü geöffnet wird, dann steht „Kosten" direkt hinter „Datei" und „Verlauf" ist der letzte Eintrag
- [ ] Gegeben das Menü mit „Details" gewählt, wenn „Details" gewählt wird, dann ist das Menü zu, der Auslöser nennt „Details", und im Fenster stehen die Felder Schlüssel, Spalte, Klasse, Herkunft, Zuständig, Labels, Fällig, Geschätzt, Wirkungen, Phasen, Signale, Zählung, Reservierung und „wartet auf" — in keiner anderen Ansicht
- [ ] Gegenbeispiel: Gegeben #1, wenn jede Ansicht geöffnet und ihr sichtbarer Text gelesen wird, dann kommt kein Abschnitt (Teilaufgaben, Anhänge, Kommentare, Durchläufe, Zeiten, Felder) in zwei Ansichten zugleich vor

### Anhänge im Inhalt

- [ ] Gegeben #1 mit einem Anhang, wenn der Inhalt gezeigt wird, dann steht der Abschnitt ANHÄNGE **nach** TEILAUFGABEN und **vor** KOMMENTAREN, mit Name und Größe des Anhangs und seinem ✕; ein weiterer Anhang lässt sich dort hochladen, und ein Klick auf ✕ entfernt ihn (ein Commit, wie heute)
- [ ] Gegenbeispiel: Gegeben #1 mit einem Anhang, wenn das Ansichtsmenü geöffnet wird, dann gibt es keinen Eintrag „Anhänge"
- [ ] Leerfall: Gegeben eine Aufgabe ohne Anhänge, wenn der Inhalt gezeigt wird, dann steht der Abschnitt ANHÄNGE mit „0" und dem Weg zum Hochladen (kein leerer Kasten, keine Fehlermeldung)

### Rückfall, Live, Fokus

- [ ] Gegeben eine Aufgabe mit gemerktem Stand „Anhänge", wenn das Fenster geöffnet wird, dann ist „Inhalt" gewählt, der Auslöser nennt „Inhalt", und im Inhalt stehen die Anhänge
- [ ] Gegeben #3 mit Preisetikett in der Ansicht „Kosten", wenn über die API `cost: null` gesetzt wird, dann nennt der Auslöser innerhalb von 1 s „Inhalt", „Kosten" fehlt im Menü, und der Fokus steht (wenn er im Menü stand) auf dem Auslöser
- [ ] Gegeben #1 in der Ansicht „Details" mit Fokus im Feld „Labels", wenn über die API der Titel von #2 geändert wird und das Live-Ereignis eintrifft, dann bleibt „Details" gewählt und der Fokus im Feld „Labels"
- [ ] Gegeben das offene Menü von #1, wenn ein Live-Ereignis eintrifft, dann bleibt das Menü offen und der Fokus auf demselben Eintrag
- [ ] Gegeben das offene Menü, wenn `Esc` gedrückt wird, dann ist nur das Menü zu (das Fenster bleibt offen) und der Fokus steht auf dem Ansichts-Auslöser
- [ ] Gegeben #1 in der Ansicht „Inhalt", wenn `d` gedrückt wird, dann nennt der Auslöser „Datei"; ein zweites `d` nennt „Inhalt"; `←` und `→` wechseln die Ansicht nicht
- [ ] Gegeben das Aufgabenfenster ist offen, wenn die Kürzelhilfe geöffnet wird, dann nennt sie `d` mit „Inhalt / Datei" und **keinen** Eintrag „← → Reiter wechseln" und keine Taste, die es nicht mehr gibt

### Schmale Breiten und Abgrenzung

- [ ] Gegeben #3 mit Preisetikett, wenn das Fenster bei 320, 375 und 414 px Breite jeweils in Hell und in Dunkel geöffnet wird, dann steht der Kopf **einzeilig**, der Ansichts-Auslöser, ↗, ⋮ und ✕ liegen ganz im sichtbaren Bereich und sind per Klick wie per Tastatur bedienbar, das Menü liegt ganz im sichtbaren Bereich, und für Kopf und Seite gilt `scrollWidth ≤ clientWidth`
- [ ] Gegeben #1 in „Inhalt" mit fokussiertem Feld im Inhalt, wenn der Rückgängig-Hinweis (R00112) erscheint, dann bleibt der Kopf einzeilig und der Fokus nicht unter dem Hinweis
- [ ] Gegenbeispiel: Gegeben #3 in „Kosten" und „Verlauf", wenn die sichtbaren Texte und Tabellen gelesen werden, dann sind sie unverändert wie in R00105 bzw. R00123 (Kostentabelle mit `caption` und Summenzeile; Verlaufstabelle neueste oben)
- [ ] Gegeben der Dialog „Neue Aufgabe", wenn er geöffnet wird, dann hat er keine Ansichtsauswahl (unverändert)

## Betroffene Verzeichnisstruktur

- Oberfläche: `web/reiter.js` (`REITER` ohne `anhaenge`), `web/ansicht.js` (`vFenster` mit Ansichts-Auslöser und Menü statt `vReiterleiste`, `vFensterAbschnitte` mit `vAnhaenge` nach `vTeilaufgaben`, `vAnhaenge` unverändert), `web/app.js` (Zweig „Ansicht wählen" statt `case 'tab'` aus Reitern, `fensterTaste` ohne `naechsterReiter`, `dateiReiterUmschalten` auf den Auslöser gezogen), `web/fokus.js` (Ebene `fenstermenue`), `web/kd-app.css` (Kopf, Menü), `web/tastatur.js` (`naechsterReiter` entfällt oder wird Menü-Schritt).
- Tests: `e2e/tests/hilfen.js` (`reiter()` — die eine Stelle für alle Suiten), `e2e/tests/ansichten.js` (`aufgabenfenster(..., reiter)`), `e2e/einheit/tastatur.test.js` (`naechsterReiter`-Fälle), neu `e2e/tests/r00145-ansichtsmenue.spec.js`; `r00105-preisetikett.spec.js`, `r00127-kartendetails-tabs.spec.js` (wird zum Menü-E2E), `r00123-kartenverlauf.spec.js`, `r00112-*` ziehen nach.

## Technische Überlegungen

### Ablauf

1. **Liste und Rückfall** (F0118, Walking Slice)
   - 1.1 `REITER` ohne `anhaenge`, Rückfall generisch (B0666 — frei baubar)
   - 1.2 Ansichts-Auslöser und Menü am Kopf, genau eine gezeichnete Ansicht (B0667)
   - 1.3 Tastatur, Fokus-Ebene, `d`, Live (B0668)
   - 1.4 E2E und Sammelhelfer (B0669)
2. **Anhänge in den Inhalt** (F0119)
   - 2.1 `vFensterAbschnitte` ruft `vAnhaenge` nach `vTeilaufgaben` (B0670)
   - 2.2 E2E: kein Eintrag „Anhänge", Abschnitt im Inhalt (B0671)
3. **Nachzug der Festlegungen** (F0120)
   - 3.1 R00127/R00123/R00105/R00103/R00110-Assertions (B0672)
   - 3.2 D00001/D00006, Kürzelhilfe, Handbuch, A00009/X00005 (B0673)

### Grobentwurf

**Wichtige Einstiegsstellen:** `vFenster` (`web/ansicht.js:274–294`) zeichnet Kopf und Panel; `REITER` (`web/reiter.js:7`); `fensterTaste` (`web/app.js:2424–2450`); `web/fokus.js` ordnet die Ebenen.

**Elemente** (Vorplanung):
- `vAnsichtWahl(a, gewaehlt)` — zeichnet Auslöser (Text = aktuelle Ansicht, `aria-haspopup`, `aria-expanded`) und, wenn offen, die Einträge aus `reiterDerAufgabe(a)`; Markierung je Form (`aria-checked` am `menuitemradio` bzw. Wert).
- `S.ui.fensterMenue` — Sichtzustand `'ansicht' | 'aktionen' | null`; beide Kopf-Menüs nutzen **eine** Ebene `fenstermenue` (R00144 legt sie an).
- `reiterSchluessel(a)` bleibt die eine Quelle; `naechsterReiter` entfällt mit den Pfeiltasten bzw. wird ein reiner Menü-Schritt (Planung: entfällt, `menueSchritt` genügt).
- Kein neuer Endpunkt, keine neue Ablage, kein Datenformat.

### Änderungen an bestehenden Klassen

- `web/reiter.js`: `REITER` ohne `['anhaenge', 'Anhänge']`.
- `web/ansicht.js`: `vReiterleiste` entfällt; `vFenster` zeichnet Auslöser + Menü und den einen Abschnitt; `vFensterAbschnitte` = Teilaufgaben + Anhänge + Kommentare + Durchläufe.
- `web/app.js`: `case 'tab'` wird „Ansicht wählen" (Verlauf weiterhin beim Öffnen leeren und laden); `naechsterReiter`-Zweig in `fensterTaste` entfällt; `dateiReiterUmschalten` setzt die Ansicht und den Fokus auf den Auslöser.
- `web/fokus.js`: Art `fenstermenue` (aus R00144).
- `web/kd-app.css`: `.seg`-Reiterleiste im Kopf entfällt; Menü und Abstände.

### Umfang

- I0132: 3 Features, 8 Bubbles (B0666–B0673), Richtwert 8–17 h ungemessen (Summe der Spannen, Hypothese). Keine Bubble unter der Untergrenze von 0,4 h.

### Gestaltung

- **ux-Vorprüfung** entscheidet **Form und Ort** des Ansichtsmenüs (Auslöser links neben dem Pfad oder rechts in der Symbolgruppe; `role="menu"` mit `menuitemradio` oder `<select>`), die Beschriftung (aktuelle Ansicht) und die Tastatur; neue Zustände an **Artboard D0003**: „Ansichtsmenü geschlossen", „offen", je hell und dunkel bei 1280 · 414 · 320 px, dazu der Inhalt mit Anhängen. Der **product-owner gibt frei**, bevor die Oberflächen-Bubbles (B0667, B0668, B0670, B0671) bauen. B0666 (reine Liste und Rückfall) ist frei baubar.

## Tests

Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** `reiterSchluessel(a)` ohne `anhaenge`; Rückfall für `tab: 'anhaenge'` und für einen unbekannten Schlüssel; `reiterDerAufgabe(a)` mit und ohne `cost`; `ebenen(ui)` mit offenem Ansichtsmenü über offenem Fenster in der Reihenfolge `fenster` < `fenstermenue` < `pop`; `nachbar`/Menü-Schritt für die Einträge.

**E2E:** `e2e/tests/r00145-ansichtsmenue.spec.js` — US-1 bis US-8: kein `[role="tablist"]` im Fenster, Auslöser nennt die Ansicht, Einträge und Reihenfolge, genau eine Markierung, kein `aria-current`; Tastatur (Pfeile/`Pos1`/`Ende`/`Enter`/`Esc`, `d`, `←`/`→` ohne Wirkung); Live-Ereignis bei offenem Menü; Rückfall für `anhaenge` und für `cost: null`; Anhänge im Inhalt nach den Teilaufgaben (Hochladen, ✕, Commit); 320/375/414 px hell und dunkel einzeilig ohne Querscrollen; Kürzelhilfe ohne „← →". Die Sammelhelfer `reiter()`/`aufgabenfenster()` werden **zuerst** umgestellt. Gegenprobe: nach dem Ansehen ohne Änderung sind Aufgabendatei und `git log` unverändert.

## Abhängigkeiten

- Abhängig von: R00105 Preisetikett (I0093, grün — „Kosten"), R00127 Kartenabschnitte auf Reitern (I0115, grün — die Ansichten), R00123 Karten-Verlauf (I0113, grün — „Verlauf"), R00103/R00110 (Live ohne Fokusverlust, grün), R00141 (I0129, grün — der `alertdialog` liegt über dem Menü).
- **Braucht** aus R00144: die Fokus-Ebene `fenstermenue` (B0659) und die Kopf-Regel „höchstens zwei Menü-Auslöser" (ADR-0018 N2).
- Berührt: R00127 (Reiter-AK, „genau ein Panel", E1-Umbruch), R00123 („Verlauf ist der letzte Reiter", Wechsel der Aufgabe), R00105 (Reiter-Asserts, Rückfall), R00103/R00110 (Proben ohne Blättern), R00106 (Menüliste), D00001.
- Blockiert: **R00146** („Inhalt: schmale rechte Spalte je Spalte") — sie baut auf dem Inhalt als einziger gezeichneter Ansicht auf und kommt **nach** dieser Anforderung.

## Offene Fragen

- **1. Form des Ansichtsmenüs: `role="menu"` mit `menuitemradio` oder natives `<select>`?** **Legt die UX-Vorprüfung fest** (ADR-0018 N2, Grenze; Karte #145 lässt die Form ausdrücklich offen). Empfehlung des planers: `role="menu"` mit `menuitemradio` — es ist die Form der übrigen Kopf-Menüs (R00128, R00140), trägt Trenner und `--kd-warn` und hält den Kopf in einem Bedienmuster; das `<select>` ist die robustere Hilfstechnik-Basis, brächte aber ein zweites Bedienmuster in denselben Kopf. Beide erfüllen die Invarianten aus FA 2–8; der Bau darf die Wahl nicht selbst treffen.
- **2. Ort und Beschriftung des Auslösers?** **Entschieden (Planung, 2026-11-12), soweit ADR-0018 N2 es bindet:** rechts im Kopf, vor ↗ und ⋮, Text = aktuelle Ansicht (N2 Punkt 3). Die genaue Lage und die Zielgröße legt die UX-Vorprüfung fest.
- **3. Bleibt `d` (Inhalt ↔ Datei)?** **Entschieden (Planung, 2026-11-12): ja.** Es ist ein gebautes, dokumentiertes und getestetes Kürzel, das ohne Reiterleiste unverändert funktioniert; ein neues Kürzel für das Menü gibt es nicht (Empfehlung an die UX).
- **4. Gilt das Muster auch für „Neue Aufgabe"?** **Nein** (R00127 Offene Frage 2, unverändert): Der Dialog zeigt keine bestehende Aufgabe.

## Manuelle Vorbereitungstätigkeiten

- **ux-Vorprüfung** mit Form, Ort, Beschriftung, Tastatur und den Zuständen „Ansichtsmenü geschlossen/offen" und „Inhalt mit Anhängen" an **D0003**, hell/dunkel, 1280 · 414 · 320 px; **Freigabe durch den product-owner** vor dem Bau der Oberflächen-Bubbles (B0667, B0668, B0670, B0671). B0666 ist frei baubar.

## Manuelle Nachbereitungstätigkeiten

- Bildschirmfotos des Kopfes mit Auslöser, des offenen Menüs und des Inhalts mit Anhängen bei 1280, 414 und 320 px, je hell und dunkel, auf den Abnahmezettel.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Betreiber-Eindruck, die Reiterleiste nehme im Kopf zu viel Platz ein. Weil die Ansichten in ein Menü wandern, das die aktuelle Ansicht nennt, kostet der Kopf eine Zeile statt einer umbrechenden Leiste, bleibt bei 320 und 375 px einzeilig, und jede künftige Ansicht ist ein Listeneintrag statt eines breiteren Kopfes. Weil die Anhänge in den Inhalt ziehen, fällt ein Eintrag weg und die Arbeit an der Aufgabe steht wieder beisammen: Was zu ihr gehört (Teilaufgaben, Anhänge, Kommentare, Durchläufe), steht auf einer Fläche. Der Hebel ist die eine vorhandene Liste `REITER` samt Rückfall: Die Ansichten wechseln ihre Darstellung, nicht ihre Quelle — deshalb braucht die Änderung weder ein neues Datenformat noch einen zweiten Zustand, und die Technik ist mit ADR-0018 N2 (Menü als Ebene, eine gezeichnete Ansicht, `aria-checked` statt `aria-selected`) bereits entschieden.

## Missing-Docs

- Keine.

## Notizen

- **Optionen (Skill `optionen-vor-entscheidung`), Auswahl der Form bleibt der UX:** (A) `role="menu"` mit `menuitemradio` — ein Bedienmuster mit dem Aktionsmenü, Trenner und Warnfarbe möglich, Fokus-Ebene schon vorhanden (Empfehlung). (B) natives `<select>` — robusteste Hilfstechnik, freie Tastatur, keine Eigenmechanik; trägt aber weder Trenner noch `--kd-warn` und bringt ein zweites Muster in denselben Kopf. (C) Segmentleiste behalten — Status quo, vom Betreiber ausdrücklich aufgehoben. Die Entscheidung fällt in der UX-Vorprüfung; **keine** Form ist hier festgeschrieben.
- **Verworfene Alternativen:** (a) Menü als `#pop` neben dem Dialog — technisch lauffähig, aber ein zweiter Pop-Zustand und ein zweiter Positionierungsweg; die Einträge stünden außerhalb des Dialogs (ADR-0018 N2, verworfen). (b) eine zweite Ansichtsliste oder ein Zustand `S.ui.ansicht` — zwei Quellen laufen auseinander (Regel 4). (c) „Anhänge" als bedingter Eintrag behalten — der Betreiber will die Liste im Inhalt; ein bedingter Eintrag machte den Ort unbeständig.
- **Abgrenzung:** Der Reiter „Kosten" (R00105) und „Verlauf" (R00123) werden hier **nicht** neu definiert, nur eingeordnet. R00146 (schmale rechte Spalte im Inhalt) folgt **nach** dieser Anforderung.
