---
id: R00145
status: Neu
datum: 2026-11-12
---

# R00145: Aufgabenfenster — Ansichtswechsel als Menü, Anhänge im Inhalt

## Beschreibung

Die Reiterleiste im Aufgabenfenster (Inhalt · Zeiten · Anhänge · Details · Datei · [Kosten] · Verlauf) nimmt im Kopf zu viel Platz ein. Diese Anforderung ersetzt sie durch **ein Menü**, das die aktuelle Ansicht nennt und die übrigen zur Wahl stellt; die Rolle `tablist` entfällt im Fenster. Die **Anhänge** verlieren ihren eigenen Eintrag und stehen als Abschnitt im **Inhalt** nach den Teilaufgaben. Es bleiben die Ansichten **Inhalt · Zeiten · Details · Datei · (Kosten) · Verlauf**.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgeräumt und folgt gewohnten Konventionen“; der Kopf trägt ein Ziel statt einer Leiste, und jede Sache steht an genau einem Ort.

**Zwei frühere Festlegungen sind damit ausdrücklich aufgehoben:**

- **„Die Reiterleiste bleibt `tablist`; ein Menü wäre eine eigene Neugestaltung“** — R00127 Offene Frage 1 (Architekt-Entscheidung 2026-11-11) und die darauf gebaute Hülle aus R00105. Aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#145); die Neugestaltung ist damit beauftragt. Die Architektur hat sie in **ADR-0018 Nachtrag N2** aufgenommen (Commit `40413ef`), A00009 und X00005 sind nachgezogen.
- **„Anhänge sind eine eigene Ansicht“** — R00127 FA/„Was in welchem Reiter steht“ und R00116/R00103-Proben, die den Reiter öffnen. Aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#145): die Anhänge stehen im Inhalt.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md)

## Geschäftlicher Nutzen

Sieben Reiter nebeneinander brauchen im Kopf die Breite, die Pfad, Nummer und Aktionen brauchen; bei 320 und 375 px bricht die Leiste um (R00127 E1) und schiebt den Kopf in die Höhe. Ein Menü-Auslöser, der die aktuelle Ansicht nennt, kostet eine Zeile statt einer Leiste, bleibt auf jeder Breite einzeilig und wächst mit jeder künftigen Ansicht ohne Umbau. Die Anhänge gehören ohnehin zur Arbeit an der Aufgabe: Wer den Verlauf einer Aufgabe liest, will sehen, was an ihr hängt, ohne die Ansicht zu wechseln — deshalb stehen sie im Inhalt, und ein Eintrag „Anhänge“ entfällt.

## Funktionale Anforderungen

### Ansichtswechsel als Menü

1. Der Ansichtswechsel des Aufgabenfensters ist **ein Menü am Fensterkopf**, keine `tablist`. `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"` und der roving `tabindex` kommen im Fenster **nicht** mehr vor.
2. **Eine Liste, ein Zustand.** Die Ansichten kommen aus der bestehenden Liste `REITER`/`reiterDerAufgabe` (`web/reiter.js`); gewählt wird aus `S.ui.tab`. Der Rückfall `tab ∉ reiterSchluessel(a)` → `inhalt` bleibt unverändert und deckt jede entfallende oder bedingte Ansicht.
3. **Die Ansichten** sind: **Inhalt · Zeiten · Details · Datei · (Kosten) · Verlauf**. „Kosten“ erscheint nur bei einer Aufgabe mit Preisetikett und direkt hinter „Datei“ (R00105); „Verlauf“ ist immer da und der letzte Eintrag (R00123). „Anhänge“ ist **keine** Ansicht mehr.
4. **Der Auslöser** nennt die **aktuelle Ansicht als Text**, trägt `aria-haspopup` und `aria-expanded` und steht im Kopf rechts vor „In VS Code öffnen“ (↗) und dem Aktionsmenü (⋮, R00144). Er hat einen zugänglichen Namen, der die Ansicht nennt.
   **Form** (ux-Vorprüfung 2026-11-12, übernommen): Er ist ein **Textknopf** mit dem sichtbaren Text „<Ansicht>“ und dem Caret `▾` in einem `span[aria-hidden]`; sein Name lautet `aria-label="Ansicht: <Name>"` und enthält damit den sichtbaren Text (WCAG 2.1 SC 2.5.3). Höhe `--kd-ziel`, Innenabstand 0 8 px, Schrift 12 px; Hover und Fokus wie `.btn-sym` (gesenkte Fläche mit `--kd-line`), damit der Kopf gleichartig bleibt.
5. **Die Form des Menüs ist festgelegt: `role="menu"` mit `menuitemradio` und `aria-checked`** — kein natives `<select>`, keine `tablist` (ux-Vorprüfung 2026-11-12, Entscheidung A; ADR-0018 N2 ließ die Form ausdrücklich offen). Bindend bleiben die Invarianten aus Punkt 2–4 und 6–8: eine Liste, ein Zustand, genau eine gezeichnete Ansicht, ein Auslöser mit `aria-haspopup`/`aria-expanded`, der die Ansicht nennt, und **kein `aria-current` im Fenster** — die Markierung trägt `aria-checked` am `menuitemradio`. Die gewählte Ansicht trägt zusätzlich ein sichtbares `✓`; alle Einträge beginnen an derselben Textkante, weil das `✓` in einem festen Gutter (1,1 em) steht, das die übrigen Einträge mit `.km-ohne` füllen. Das Menü trägt **keinen Titel** (erlaubte Kinder eines `role="menu"` sind Einträge, Gruppen und Trenner; ADR-0018 Offene Fragen, R00136) und keine Kürzel an den Einträgen; ein Eintrag ist `max(28px, --kd-ziel)` hoch.
6. **Genau eine Ansicht wird gezeichnet.** Der Inhaltsbereich ist kein `tabpanel` mehr; er trägt `role="group"` mit `aria-label="Ansicht: <Name>"` (kein `role="region"` ohne Anlass, kein `aria-current`).
7. **Das Menü ist eine eigene Ebene der Fokusführung** (`fenstermenue` in `web/fokus.js` zwischen `fenster` und `pop`): im Fenster gezeichnet, Startziel der **gewählte Eintrag**, Pfeile/`Pos1`/`Ende`/`Enter`, `Esc` und `Tab` schließen mit Rückgabe an den Auslöser; die Lösch-Rückfrage (`alertdialog`) liegt darüber. **Nach der Wahl einer Ansicht steht der Fokus am Auslöser**, und der Auslöser nennt die neue Ansicht („Ansicht: <gewählt>“) — nie `BODY`, auch nicht, wenn der gewählte Eintrag mit dem Neuzeichnen verschwindet. **Im Kopf ist höchstens ein Menü offen**: das Öffnen des Aktionsmenüs (R00144) schließt ein offenes Ansichtsmenü und umgekehrt, mit Rückgabe des Fokus an das neue Menü.
8. **Tastatur.** `d` wechselt weiter **Inhalt ↔ Datei** (unverändert) und lässt den Fokus auf dem Auslöser, dessen Name die neue Ansicht ansagt; `←`/`→` und der Eintrag „← → Reiter wechseln“ entfallen. Die Kürzelhilfe des Fensters nennt danach keinen Reiter-Wechsel mehr. Ein eigenes Kürzel für das Menü gibt es **nicht** (Empfehlung der Planung, von der UX übernommen): das Menü ist über den Auslöser und die Tabulatortaste erreichbar, und jedes neue Einzelbuchstaben-Kürzel kollidiert mit den Fenster-Kürzeln.
9. **Verhalten.** Beim Öffnen ist „Inhalt“ gewählt; beim **Öffnen einer anderen Aufgabe** bleibt die gewählte Ansicht, außer die Aufgabe führt sie nicht (dann „Inhalt“). Ein Live-Ereignis behält Ansicht und Fokus (R00103/R00110); ist das Menü dabei offen, bleibt es offen. **Verschwindet die gewählte Ansicht** (etwa `cost: null` in „Kosten“), fällt die Ansicht auf „Inhalt“ (Punkt 2), das Menü **schließt**, und der Fokus steht am Auslöser („Ansicht: Inhalt“) — die beiden Regeln „Menü bleibt offen“ und „Fokus am Auslöser“ gelten dann nicht zugleich.
10. **Der Fenstertitel bleibt unberührt** (R00116), ebenso `#t-mehr` der Kopfzeile.

### Anhänge im Inhalt

11. Die Anhänge stehen als Abschnitt **immer** im Inhalt — auch leer — nach den Teilaufgaben und vor den Kommentaren; die Reihenfolge ist **TEILAUFGABEN → ANHÄNGE → KOMMENTARE → DURCHLÄUFE**. Die Liste trägt Name, Größe und ✕ je Zeile, dazu Hochladen (Dateiwahl und Ziehen). Verhalten, Commits, Rückgängig (R00112) und Zielgrößen bleiben unverändert.
    **Abschnitt** (ux-Vorprüfung 2026-11-12, übernommen): Die Überschrift lautet `ANHÄNGE <n>` mit der Zahl in `span.mono` — **ohne Dateinamen** (der steht im Kopf unter `.pfad` und bricht bei 320 px). Der Leerfall ist „ANHÄNGE 0“ mit der vorhandenen Zeile „+ Datei wählen oder hierher ziehen“, kein leerer Kasten und keine Fehlermeldung.
12. **Ablegen einer Datei.** In der Ansicht „Inhalt“ ist die Fläche des Inhalts Ablageziel; `dragover` und `drop` außerhalb des Anhang-Abschnitts werden abgefangen (`preventDefault`), damit der Browser nicht auf die abgelegte Datei wechselt — abgelegt wird entweder als Anhang oder gar nicht, `location.href` bleibt unverändert. Bisher hing beides allein an `#anhaenge` (`web/app.js:2691–2700`), was als eigene Ansicht genügte, als Zeile in einem langen Inhalt aber nicht mehr.
13. Der Eintrag **„Anhänge“ entfällt** aus `REITER`; ein gemerkter Stand `S.ui.tab = 'anhaenge'` fällt über den Rückfall aus Punkt 2 auf „Inhalt“ — ohne Datenformat-, Endpunkt- oder Aktionsänderung.
14. **Kein Abschnitt doppelt**: Was im Inhalt steht, fehlt in jeder anderen Ansicht; die Anhänge stehen genau einmal.

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Auslöser und Menü folgen dem APG-Muster „Menu Button“ mit `role="menu"` und `menuitemradio` (Festlegung A der ux-Vorprüfung); jeder Eintrag hat einen zugänglichen Namen, die gewählte Ansicht ist für Hilfstechnik über `aria-checked` **und** sichtbar über `✓` erkennbar (SC 1.4.1), **kein `aria-current` im Fenster** (das bleibt der Kopfzeile, ADR-0018 Regel 5); der Name des Auslösers enthält den sichtbaren Text (SC 2.5.3); Fokus immer sichtbar (SC 2.4.7, 4.1.2), nach jeder Wahl am Auslöser. Zielgrößen nach ADR-0012 (≥ 24 px fein, ≥ 44 px Touch); Einträge `max(28px, --kd-ziel)`.
- **Schmale Breiten**: Bei 320, 375 und 414 px bleibt der **Kopf einzeilig** (der Auslöser ersetzt die Leiste und die Blätterknöpfe) und trägt **drei** Ziele — Ansicht, ⋮ und ✕; **↗ ist bis 640 px versteckt** (Budget: vier 48-px-Ziele mit Lücken lassen bei 320 px nur 5–11 px Rest, `web/kd-app.css:919`, Ausnahme in `e2e/tests/r00111-schmal-wie-breit.spec.js:27`) und erscheint ab 641 px. Einzeilig heißt: `#fenster .mod-kopf` höchstens `max(36px, --kd-ziel) + 2` hoch und die Ziele auf derselben Oberkante (±1 px) — nicht `scrollWidth ≤ clientWidth` allein. Der Fokus liegt nie unter dem Rückgängig-Hinweis (`r00112`, dreimal aufgetreten). Kopf und Seite: `scrollWidth ≤ clientWidth`; das Menü liegt ganz im sichtbaren Bereich (ADR-0015), ist `min(280px, 100vw − 16px)` breit und endet an der Endkante seines Auslösers.
- **Verträglichkeit**: Die Ansichten „Kosten“ (R00105) und „Verlauf“ (R00123) bleiben in Name, Reihenfolge und Verhalten; es entsteht **keine** zweite Ansichtsliste und kein zweiter Zustand.

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“; Aufgabe #1 mit Beschreibung, einer Teilaufgabe, einem Kommentar, einem Durchlauf, einem Anhang und einem Zeiteintrag; Aufgabe #2 ohne Preisetikett; Aufgabe #3 mit Preisetikett; Person `st` (Mensch).

### Ansichtsmenü

- [ ] Gegeben #1, wenn das Aufgabenfenster geöffnet wird, dann gibt es im Fenster **kein** `[role="tablist"]`, keinen `[role="tab"]` und kein `[role="tabpanel"]`; der Ansichts-Auslöser nennt sichtbar „Inhalt“ mit Caret `▾` (`aria-hidden`), trägt `aria-haspopup="menu"`, `aria-expanded="false"` und den Namen **„Ansicht: Inhalt“**; `aria-current` kommt im Fenster nicht vor; der gezeichnete Inhaltsbereich ist `role="group"` mit `aria-label="Ansicht: Inhalt"`
- [ ] Gegeben das offene Fenster von #1, wenn der Ansichts-Auslöser betätigt wird, dann stehen als Einträge genau „Inhalt“, „Zeiten“, „Details“, „Datei“, „Verlauf“ (in dieser Reihenfolge) und — bei #1 ohne Etikett — **kein** „Kosten“ und **kein** „Anhänge“; jeder Eintrag ist ein `menuitemradio`, genau einer trägt `aria-checked="true"`, und derselbe trägt ein sichtbares `✓`; alle Einträge beginnen an derselben Textkante (±1 px); das Menü trägt **keinen** Titel und an keinem Eintrag ein Kürzel; der Fokus steht auf dem gewählten Eintrag („Inhalt“)
- [ ] Gegeben #1 ist in der Ansicht „Zeiten“, wenn das Ansichtsmenü geöffnet wird, dann steht der Fokus auf „Zeiten“ (nicht auf „Inhalt“); in der Ansicht „Inhalt“ auf „Inhalt“
- [ ] Gegeben #3 mit Preisetikett, wenn das Menü geöffnet wird, dann steht „Kosten“ direkt hinter „Datei“ und „Verlauf“ ist der letzte Eintrag
- [ ] Gegeben das Menü mit „Details“ gewählt, wenn „Details“ gewählt wird — per Klick und per `Enter` —, dann ist das Menü zu, der Auslöser nennt „Details“, `document.activeElement` **ist der Ansichts-Auslöser** und heißt „Ansicht: Details“ (nicht `BODY`), und im Fenster stehen die Felder Schlüssel, Spalte, Klasse, Herkunft, Zuständig, Labels, Fällig, Geschätzt, Wirkungen, Phasen, Signale, Zählung, Reservierung und „wartet auf“ — in keiner anderen Ansicht
- [ ] Gegeben das offene Ansichtsmenü von #1, wenn der ⋮-Auslöser (R00144) betätigt wird, dann ist genau **ein** `[role="menu"]` im Fenster offen, `aria-expanded` steht am Ansichts-Auslöser auf `false` und am ⋮ auf `true`, und der Fokus steht im neuen Menü; dasselbe umgekehrt vom offenen ⋮-Menü aus
- [ ] Gegenbeispiel: Gegeben #1, wenn jede Ansicht geöffnet und ihr sichtbarer Text gelesen wird, dann kommt kein Abschnitt (Teilaufgaben, Anhänge, Kommentare, Durchläufe, Zeiten, Felder) in zwei Ansichten zugleich vor

### Anhänge im Inhalt

- [ ] Gegeben #1 mit einem Anhang, wenn der Inhalt gezeigt wird, dann steht der Abschnitt ANHÄNGE **nach** TEILAUFGABEN und **vor** KOMMENTAREN (Reihenfolge TEILAUFGABEN → ANHÄNGE → KOMMENTARE → DURCHLÄUFE), mit Name und Größe des Anhangs und seinem ✕; die Überschrift lautet `ANHÄNGE 1` und enthält **keinen** Dateinamen; ein weiterer Anhang lässt sich dort hochladen, und ein Klick auf ✕ entfernt ihn (ein Commit, wie heute)
- [ ] Gegenbeispiel: Gegeben #1 mit einem Anhang, wenn das Ansichtsmenü geöffnet wird, dann gibt es keinen Eintrag „Anhänge“
- [ ] Leerfall: Gegeben eine Aufgabe ohne Anhänge, wenn der Inhalt gezeigt wird, dann steht der Abschnitt mit der Überschrift `ANHÄNGE 0` und der Zeile „+ Datei wählen oder hierher ziehen“ (kein leerer Kasten, keine Fehlermeldung)
- [ ] Gegeben #1 in „Inhalt“, wenn eine Datei auf die Beschreibung (nicht auf den Anhang-Abschnitt) gezogen wird, dann wechselt der Browser **nicht** auf die Datei: `location.href` ist unverändert, und es entsteht entweder ein Anhang oder nichts

### Rückfall, Live, Fokus

- [ ] Gegeben eine Aufgabe mit gemerktem Stand „Anhänge“, wenn das Fenster geöffnet wird, dann ist „Inhalt“ gewählt, der Auslöser nennt „Inhalt“, und im Inhalt stehen die Anhänge
- [ ] Gegeben #3 mit Preisetikett in der Ansicht „Kosten“ bei offenem Menü, wenn über die API `cost: null` gesetzt wird, dann nennt der Auslöser innerhalb von 1 s „Inhalt“, „Kosten“ fehlt im Menü, das Menü ist **zu** (kein `[role="menu"]` mehr im Fenster), und der Fokus steht auf dem Auslöser
- [ ] Gegeben #1 in der Ansicht „Details“ mit Fokus im Feld „Labels“, wenn über die API der Titel von #2 geändert wird und das Live-Ereignis eintrifft, dann bleibt „Details“ gewählt und der Fokus im Feld „Labels“
- [ ] Gegeben das offene Menü von #1, wenn ein Live-Ereignis eintrifft, dann bleibt das Menü offen und der Fokus auf demselben Eintrag
- [ ] Gegeben das offene Menü, wenn `Esc` gedrückt wird, dann ist nur das Menü zu (das Fenster bleibt offen) und der Fokus steht auf dem Ansichts-Auslöser
- [ ] Gegeben #1 in der Ansicht „Inhalt“, wenn `d` gedrückt wird, dann nennt der Auslöser „Datei“ und der Fokus steht weiter auf ihm; ein zweites `d` nennt „Inhalt“; `←` und `→` wechseln die Ansicht nicht
- [ ] Gegeben das Aufgabenfenster ist offen, wenn die Kürzelhilfe geöffnet wird, dann nennt sie `d` mit „Inhalt / Datei“ und **keinen** Eintrag „← → Reiter wechseln“ und keine Taste, die es nicht mehr gibt

### Schmale Breiten und Abgrenzung

- [ ] Gegeben #3 mit Preisetikett, wenn das Fenster bei 320, 375 und 414 px Breite jeweils in Hell und in Dunkel geöffnet wird, dann steht der Kopf **einzeilig**: `#fenster .mod-kopf` ist höchstens `max(36px, --kd-ziel) + 2` hoch, und Ansichts-Auslöser, ⋮ und ✕ stehen auf derselben Oberkante (±1 px); die drei Ziele liegen ganz im sichtbaren Bereich und sind per Klick wie per Tastatur bedienbar; **↗ ist unter 641 px nicht sichtbar** (Ausnahme in `r00111` unverändert) und ab 641 px sichtbar; das Menü liegt ganz im sichtbaren Bereich, endet an der Endkante seines Auslösers, und für Kopf und Seite gilt `scrollWidth ≤ clientWidth`
- [ ] Gegeben #1 in „Inhalt“ mit fokussiertem Feld im Inhalt, wenn der Rückgängig-Hinweis (R00112) erscheint, dann bleibt der Kopf einzeilig und der Fokus nicht unter dem Hinweis
- [ ] Gegenbeispiel: Gegeben #3 in „Kosten“ und „Verlauf“, wenn die sichtbaren Texte und Tabellen gelesen werden, dann sind sie unverändert wie in R00105 bzw. R00123 (Kostentabelle mit `caption` und Summenzeile; Verlaufstabelle neueste oben)
- [ ] Gegeben der Dialog „Neue Aufgabe“, wenn er geöffnet wird, dann hat er keine Ansichtsauswahl (unverändert)

## Betroffene Verzeichnisstruktur

- Oberfläche: `web/reiter.js` (`REITER` ohne `anhaenge`), `web/ansicht.js` (`vFenster` mit Ansichts-Auslöser und Menü statt `vReiterleiste`, `vFensterAbschnitte` mit `vAnhaenge` nach `vTeilaufgaben`, `vAnhaenge` mit Überschrift `ANHÄNGE <n>` ohne Dateinamen), `web/app.js` (Zweig „Ansicht wählen“ statt `case 'tab'` aus Reitern, `fensterTaste` ohne `naechsterReiter`, `dateiReiterUmschalten` auf den Auslöser gezogen, `dragover`/`drop` fangen die Inhaltsfläche ab), `web/fokus.js` (Ebene `fenstermenue`), `web/kd-app.css` (Kopf, Menü), `web/tastatur.js` (`naechsterReiter` entfällt oder wird Menü-Schritt).
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
   - 2.2 E2E: kein Eintrag „Anhänge“, Abschnitt im Inhalt (B0671)
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
- `web/app.js`: `case 'tab'` wird „Ansicht wählen“ (Verlauf weiterhin beim Öffnen leeren und laden); `naechsterReiter`-Zweig in `fensterTaste` entfällt; `dateiReiterUmschalten` setzt die Ansicht und den Fokus auf den Auslöser.
- `web/fokus.js`: Art `fenstermenue` (aus R00144).
- `web/kd-app.css`: `.seg`-Reiterleiste im Kopf entfällt; Menü und Abstände.

### Umfang

- I0132: 3 Features, 8 Bubbles (B0666–B0673), Richtwert 8–17 h ungemessen (Summe der Spannen, Hypothese). Keine Bubble unter der Untergrenze von 0,4 h.

### Gestaltung

- **ux-Vorprüfung: liegt vor** (2026-11-12, Detailblatt der ux-Vorprüfung #144/#145). Festgelegt und hier übernommen: **`role="menu"` mit `menuitemradio` und `aria-checked`** (Entscheidung A; B `<select>` und C `tablist` verworfen), Auslöser rechts vor ↗ und ⋮ als Textknopf mit Caret `▾` und Namen „Ansicht: <Name>“, Startfokus der gewählte Eintrag, sichtbares `✓` im festen Gutter, kein Titel im Menü, nach der Wahl Fokus am Auslöser, bei 320/375/414 px drei Ziele mit verstecktem ↗, Panel als `role="group"` mit `aria-label="Ansicht: <Name>"`.
- **Gezeichnet (D0003 #ansichtsmenue-anhaenge) und freigegeben** (product-owner, Commit `d7f43f7`; Zeichnung `4f04093`) sind die Zustände an **Artboard D0003**, je hell und dunkel: Ansichtsmenü geschlossen und offen (1280 · 414 · 320 px, mit „Kosten“ bei #3), Inhalt mit Anhängen (mit Anhang, Leerfall `ANHÄNGE 0`, langer Dateiname bei 320 px), dazu die Zielgrößen (Auslöser · Menüeintrag · Anhang-✕) und die Kontrast-/Messtabelle. Die Oberflächen-Bubbles B0667, B0668, B0669, B0670 und B0671 sind damit frei baubar.

## Tests

Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** `reiterSchluessel(a)` ohne `anhaenge`; Rückfall für `tab: 'anhaenge'` und für einen unbekannten Schlüssel; `reiterDerAufgabe(a)` mit und ohne `cost`; `ebenen(ui)` mit offenem Ansichtsmenü über offenem Fenster in der Reihenfolge `fenster` < `fenstermenue` < `pop`; `nachbar`/Menü-Schritt für die Einträge.

**E2E:** `e2e/tests/r00145-ansichtsmenue.spec.js` — US-1 bis US-8: kein `[role="tablist"]` im Fenster, Auslöser nennt die Ansicht (Name „Ansicht: <Name>“), Einträge und Reihenfolge, genau eine Markierung (`aria-checked` **und** `✓`), kein `aria-current`; Startfokus auf dem gewählten Eintrag; Fokus nach jeder Wahl am Auslöser; Tastatur (Pfeile/`Pos1`/`Ende`/`Enter`/`Esc`, `d`, `←`/`→` ohne Wirkung); höchstens ein offenes Kopf-Menü; Live-Ereignis bei offenem Menü; Rückfall für `anhaenge` und für `cost: null` (Menü zu, Fokus am Auslöser); Anhänge im Inhalt nach den Teilaufgaben (Überschrift ohne Dateinamen, Leerfall `ANHÄNGE 0`, Hochladen, ✕, Commit, Datei-Drop mit unverändertem `location.href`); 320/375/414 px hell und dunkel einzeilig **mit Höhen- und Oberkantenmessung** statt nur `scrollWidth`; Kürzelhilfe ohne „← →“. Die Sammelhelfer `reiter()`/`aufgabenfenster()` werden **zuerst** umgestellt. Gegenprobe: nach dem Ansehen ohne Änderung sind Aufgabendatei und `git log` unverändert.

## Abhängigkeiten

- Abhängig von: R00105 Preisetikett (I0093, grün — „Kosten“), R00127 Kartenabschnitte auf Reitern (I0115, grün — die Ansichten), R00123 Karten-Verlauf (I0113, grün — „Verlauf“), R00103/R00110 (Live ohne Fokusverlust, grün), R00141 (I0129, grün — der `alertdialog` liegt über dem Menü).
- **Teilt mit R00144:** die Fokus-Ebene `fenstermenue` (B0659) und die Kopf-Regel „höchstens zwei Menü-Auslöser“ (ADR-0018 N2). Die Ebene legt an, wer zuerst baut; deshalb ist #144 keine Vorbedingung (WBS: I0132 `Braucht` ohne I0131).
- Berührt: R00127 (Reiter-AK, „genau ein Panel“, E1-Umbruch), R00123 („Verlauf ist der letzte Reiter“, Wechsel der Aufgabe), R00105 (Reiter-Asserts, Rückfall), R00103/R00110 (Proben ohne Blättern), R00106 (Menüliste), D00001.
- Blockiert: **R00146** („Inhalt: schmale rechte Spalte je Spalte“) — sie baut auf dem Inhalt als einziger gezeichneter Ansicht auf und kommt **nach** dieser Anforderung.

## Offene Fragen

- **1. Form des Ansichtsmenüs: `role="menu"` mit `menuitemradio` oder natives `<select>`?** **Entschieden (ux-Vorprüfung 2026-11-12): `role="menu"` mit `menuitemradio` und `aria-checked`.** Gründe: gleiche Bauart wie das ⋮-Menü daneben (ein Bedienmuster im Kopf), `aria-haspopup`/`aria-expanded` bleiben wie in ADR-0018 N2 gefordert erhalten, und nur diese Form trägt die Markierung als `aria-checked`; das `<select>` wäre die robustere Hilfstechnik-Basis, brächte aber ein zweites Muster in denselben Kopf und ließe `aria-haspopup`/`aria-expanded` aus der Anforderung fallen. `tablist` im Popover scheidet aus (ADR-0018 N2 Punkt 1). Die Empfehlung des planers (A) ist damit übernommen.
- **2. Ort und Beschriftung des Auslösers?** **Entschieden (Planung 2026-11-12, ux-Vorprüfung 2026-11-12):** rechts im Kopf, vor ↗ und ⋮; sichtbarer Text = aktuelle Ansicht mit Caret `▾`, Name `aria-label="Ansicht: <Name>"`; Höhe `--kd-ziel`, Innenabstand 0 8 px, Schrift 12 px.
- **3. Bleibt `d` (Inhalt ↔ Datei)?** **Entschieden (Planung, 2026-11-12): ja.** Es ist ein gebautes, dokumentiertes und getestetes Kürzel, das ohne Reiterleiste unverändert funktioniert; ein neues Kürzel für das Menü gibt es nicht (Empfehlung an die UX).
- **4. Gilt das Muster auch für „Neue Aufgabe“?** **Nein** (R00127 Offene Frage 2, unverändert): Der Dialog zeigt keine bestehende Aufgabe.

## Manuelle Vorbereitungstätigkeiten

- **ux-Vorprüfung: erledigt** (2026-11-12, Detailblatt der ux-Vorprüfung #144/#145): Form A, Ort rechts vor ↗ und ⋮, Beschriftung „<Ansicht> ▾“ mit Namen „Ansicht: <Name>“, Tastatur und Fokus, Anhänge im Inhalt. Die Zustände „Ansichtsmenü geschlossen/offen“ und „Inhalt mit Anhängen“ an **D0003** sind hell/dunkel, 1280 · 414 · 320 px, **gezeichnet (D0003 #ansichtsmenue-anhaenge) und freigegeben** (product-owner, Commits `4f04093`, `d7f43f7`). Die Oberflächen-Bubbles B0667, B0668, B0669, B0670, B0671 sind frei baubar; B0666 (reine Liste und Rückfall) ist es ohnehin.

## Manuelle Nachbereitungstätigkeiten

- Bildschirmfotos des Kopfes mit Auslöser, des offenen Menüs und des Inhalts mit Anhängen bei 1280, 414 und 320 px, je hell und dunkel, auf den Abnahmezettel.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Betreiber-Eindruck, die Reiterleiste nehme im Kopf zu viel Platz ein. Weil die Ansichten in ein Menü wandern, das die aktuelle Ansicht nennt, kostet der Kopf eine Zeile statt einer umbrechenden Leiste, bleibt bei 320 und 375 px einzeilig, und jede künftige Ansicht ist ein Listeneintrag statt eines breiteren Kopfes. Weil die Anhänge in den Inhalt ziehen, fällt ein Eintrag weg und die Arbeit an der Aufgabe steht wieder beisammen: Was zu ihr gehört (Teilaufgaben, Anhänge, Kommentare, Durchläufe), steht auf einer Fläche. Der Hebel ist die eine vorhandene Liste `REITER` samt Rückfall: Die Ansichten wechseln ihre Darstellung, nicht ihre Quelle — deshalb braucht die Änderung weder ein neues Datenformat noch einen zweiten Zustand, und die Technik ist mit ADR-0018 N2 (Menü als Ebene, eine gezeichnete Ansicht, `aria-checked` statt `aria-selected`) bereits entschieden.

## Missing-Docs

- Keine.

## Notizen

- **Optionen (Skill `optionen-vor-entscheidung`), gewählt A:** (A, **gewählt** in der ux-Vorprüfung 2026-11-12) `role="menu"` mit `menuitemradio` — ein Bedienmuster mit dem Aktionsmenü, `aria-haspopup`/`aria-expanded` bleiben, Markierung als `aria-checked`, Fokus-Ebene schon vorhanden. (B) natives `<select>` — robusteste Hilfstechnik, freie Tastatur, keine Eigenmechanik; trägt aber weder Trenner noch `--kd-warn`, bringt ein zweites Muster in denselben Kopf und lässt `aria-haspopup`/`aria-expanded` fallen. (C) Segmentleiste behalten — Status quo, vom Betreiber ausdrücklich aufgehoben.
- **ux-Vorprüfung (2026-11-12) übernommen, nicht neu entschieden:** Form A; Auslöser als Textknopf mit Caret und Namen „Ansicht: <Name>“ (S1); Startfokus der gewählte Eintrag (S2); sichtbares `✓` im festen Gutter (S3); höchstens ein offenes Kopf-Menü (S4); Kosten verschwindet → Menü zu, Fokus am Auslöser (S5); Datei-Drop mit `preventDefault` (S6); `ANHÄNGE <n>` ohne Dateinamen (S7); „Zurückholen“ mit Symbol in R00144 (S8); kein Titel im Menü, Muster `vBoardMenue` statt `vMenue` (S9); Fokus nach der Wahl am Auslöser (M2); Höhen-/Oberkantenmessung statt `scrollWidth` allein (M3); drei Ziele bei 320/375/414 px, ↗ ab 641 px (M1).
- **Verworfene Alternativen:** (a) Menü als `#pop` neben dem Dialog — technisch lauffähig, aber ein zweiter Pop-Zustand und ein zweiter Positionierungsweg; die Einträge stünden außerhalb des Dialogs (ADR-0018 N2, verworfen). (b) eine zweite Ansichtsliste oder ein Zustand `S.ui.ansicht` — zwei Quellen laufen auseinander (Regel 4). (c) „Anhänge“ als bedingter Eintrag behalten — der Betreiber will die Liste im Inhalt; ein bedingter Eintrag machte den Ort unbeständig.
- **Abgrenzung:** Die Ansichten „Kosten“ (R00105, bis #145 „Reiter“ genannt) und „Verlauf“ (R00123) werden hier **nicht** neu definiert, nur eingeordnet. R00146 (schmale rechte Spalte im Inhalt) folgt **nach** dieser Anforderung.
