---
id: R00127
status: Neu
datum: 2026-11-11
---

# R00127: Kartendetails mit mehreren Reitern statt allem auf einer Seite

## Beschreibung

Das Aufgabenfenster zeigt heute fast alles auf einer Fläche: den Bearbeitungsbereich (Titel, Beschreibung, Teilaufgaben, Kommentare, Durchläufe, Anhänge) **und** daneben eine Seitenleiste mit den Feldern (Spalte, Klasse, Zuständige, Labels, Fälligkeit, Herkunft …), den laufenden Timern und den Zeiten. Mit dem Preisetikett (R00105) hat sich gezeigt, wie sich Platz sparen lässt: ein eigener Reiter „Kosten“ neben „Inhalt“ und „Datei“. Dieses Muster wird ausgebaut — weitere Abschnitte ziehen aus der einen Seite in eigene Reiter um, sodass jeder Reiter eine Sache zeigt und das Fenster aufgeräumt wird.

Die Reiter-Hülle aus R00105 (F0043/B0375, `role=tablist` nach der WAI-ARIA APG mit automatischer Aktivierung) wird dafür erweitert, nicht ersetzt: dieselbe Leiste trägt künftig mehr Reiter, Rolle, Tastatur (`← →`, `Pos1`/`Ende`, `Enter`/`Leertaste`, `d`) und die Kürzelhilfe bleiben. Die **ux-Vorprüfung #104 hat den Vorschlag des planers zur Aufteilung und Reihenfolge bestätigt** (Befunde in den Abschnitten darunter eingearbeitet); der product-owner gibt das Artboard frei (Vision-Leitplanke „Der Mensch sieht jede Gestaltung, bevor sie gebaut wird“).

Dies ist die Detailplanung zur Karte **#104**. **Nicht** Teil dieser Anforderung: der Reiter **„Verlauf“** (gehört zu R00123/I0113, Karte #119) und der Reiter **„Kosten“** (gehört zu R00105/I0093) — beide bleiben, wie sie dort beschrieben sind; diese Anforderung ordnet sie nur in die gemeinsame Leiste ein.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgeräumt und folgt gewohnten Konventionen“; das Aufgabenfenster zeigt je Reiter eine Sache.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Seitenleiste](../Dokumentation/Domaenenwissen/D00003-seitenleiste.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wer eine Aufgabe ansieht, sieht heute auf einer Seite Titel, Beschreibung, Teilaufgaben, Kommentare, Durchläufe, Anhänge, alle Felder und noch die Timer — ein langer, doppelt gegliederter Schirm, auf dem die Arbeit (was ist zu tun, was wurde besprochen) gegen die Einstellungen (Spalte, Klasse, Wer, Termin) konkurriert. Mit je einem Reiter für die Arbeit, für Zeiten, für Anhänge und für die Einstellungen findet der Betreiber jede Sache an einem festen Ort und sieht beim Öffnen zuerst das Wesentliche. Der Gewinn ist derselbe, den der Reiter „Kosten“ schon gebracht hat: weniger auf einmal, klarer zuzuordnen — ohne neue Daten und ohne Umbau des Speichers.

## Funktionale Anforderungen

### Reiter und Reihenfolge
- Die Reiterleiste des Aufgabenfensters trägt die Reiter in dieser Reihenfolge (durch die ux-Vorprüfung #104 bestätigt): **„Inhalt“ · „Zeiten“ · „Anhänge“ · „Details“ · „Datei“ · „Verlauf“**; der Reiter **„Kosten“** steht — wie in R00105 — nur bei einer Aufgabe mit Preisetikett und direkt hinter „Datei“.
- Beim Öffnen ist **„Inhalt“** gewählt. Beim Blättern zu einer anderen Aufgabe (↑ ↓) bleibt der gewählte Reiter, außer er existiert dort nicht („Kosten“ ohne Etikett → „Inhalt“, wie R00105/B0376). **Generische Rückfallregel (S3):** ist der gemerkte Reiter `S.ui.tab` **kein** Schlüssel aus `reiterSchluessel(a)` (der für diese Aufgabe gültigen Reiter-Liste), gilt `inhalt` — gleich, ob „Kosten“ fehlt oder ein später gebauter Reiter („Verlauf“, R00123) fehlt. Die Regel greift beim Blättern **und** bei jedem Live-Ereignis; die Fokusregel aus R00105/B0376 bleibt. Heute ist sie nur für „kosten“ umgesetzt (`web/kosten.js` `reiterRueckfall`, aufgerufen in `web/app.js` `kostenReiterRueckfall`); sie wird auf die reine Bedingung `tab ∉ reiterSchluessel(a)` verallgemeinert (Code-Orte `web/ansicht.js` `reiterDerAufgabe`/`reiterSchluessel`, `web/app.js` in `render`).
- Die Hülle bleibt die `tablist` aus R00105 (unverändert; UX-Vorprüfung #104, M1): Element `role=tablist` mit dem Namen „Ansicht der Aufgabe“, je Reiter `role=tab` mit `aria-selected` und `aria-controls` auf `reiterpanel-<k>`; **gezeichnet wird genau ein `role=tabpanel`** — das des gewählten Reiters. Die übrigen Reiter tragen ihren `aria-controls`-Verweis, dessen id ohne gezeichneten Inhalt bleibt (genau wie R00105/B0375; `e2e/tests/r00105-preisetikett.spec.js:44` erwartet „genau ein `tabpanel`“ und bleibt grün). Nur der gewählte Reiter hat `tabindex=0`; `← →` mit Umlauf, `Pos1`/`Ende`, `Enter`/`Leertaste`, `d` (Inhalt ↔ Datei) und der Kürzelhinweis „← → Reiter wechseln (Fokus auf einem Reiter)“ gelten unverändert. Kein neues Bedienmuster: **kein Menü** statt der Reiterleiste (der Betreiberwunsch „eher ein Menü“ ist eine spätere Neugestaltung, siehe Offene Fragen).

### Was in welchem Reiter steht
- **„Inhalt“** zeigt die Arbeit an der Aufgabe: Titel, Beschreibung, Teilaufgaben, Kommentare und Durchläufe. **Nicht** mehr hier: Zeiten/Timer, Anhänge und die Felder der bisherigen Seitenleiste.
- **„Zeiten“** zeigt „Läuft gerade“ (alle laufenden Timer samt Start/Stopp) und die Zeiten-Tabelle (nachtragen, korrigieren, löschen) — die bisherigen Abschnitte aus der Seitenleiste, unverändert im Verhalten.
- **„Anhänge“** zeigt die Anhänge der Aufgabe samt Hochladen und Entfernen.
- **„Details“** zeigt die Felder der bisherigen Seitenleiste: **Schlüssel** (Fremdschlüssel `key`, R00098 — nur lesend, nur wenn gesetzt), Spalte, Klasse, Herkunft, Zuständige, Labels, Fälligkeit, „wartet auf“, Wirkungen, Phasen, Signale, Zählung, Reservierung. Das Feld „Spalte“ bewegt die Karte weiter wie heute (R00006). Die Felder sehen aus wie in **R00109** freigegeben (die nackte `.k`-Beschriftung in Plex Sans 500 `--kd-text`, `web/kd-app.css:353`); sie stehen nur an einem anderen Ort.
- **„Datei“**, **„Kosten“** (nur mit Etikett, R00105) und **„Verlauf“** (immer, R00123) bleiben in Inhalt und Verhalten unverändert; in „Kosten“ und „Verlauf“ ändert diese Anforderung nichts.
- Jeder Abschnitt steht **genau einmal**: was in einen Reiter gezogen ist, fehlt in „Inhalt“ und in jedem anderen Reiter.
- Das Fenster wird damit **einspaltig**; die Seitenleiste (`aside.mod-side`) entfällt als eigene Spalte. Im [schmalen Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) entfällt das bisherige Untereinander-Stapeln von Hauptbereich und Seitenleiste.

### Verhalten
- Öffnen, Blättern und Schließen ändern sich nicht; jede Änderung geht weiter sofort in die Aufgabendatei und wird committet.
- Ein [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) zeichnet das Fenster neu, ohne dem Menschen Fokus oder Leseposition zu nehmen (R00103, R00110); der gewählte Reiter bleibt.
- Ändert sich der Umfang der Reiter live (Preisetikett gesetzt oder entfernt, künftig ein Reiter aus R00123), gilt die Rückfallregel aus R00105/B0376 **generisch für jeden nicht (mehr) vorhandenen Reiter** (S3): ist `S.ui.tab` kein Schlüssel aus `reiterSchluessel(a)`, wird „Inhalt“ gewählt.

### „Neue Aufgabe“
- Der Dialog „Neue Aufgabe“ (R00036) gehört **nicht** zu dieser Anforderung: er zeigt keine bestehende Aufgabe und bekommt in dieser Ausbaustufe keine Reiter. (Offene Frage 2.)

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Die Reiterleiste folgt dem Muster „Tabs“ der WAI-ARIA APG mit automatischer Aktivierung (wie R00105); jeder Reiter ist per Tastatur erreichbar und hat einen zugänglichen Namen (seinen sichtbaren Text); die Zielgrößen folgen ADR-0012 (≥ 24 px, bei Touch ≥ 44 px).
- **Schmale Breiten**: Bei 320, 375 und 414 px Breite bleiben alle Reiter sichtbar und bedienbar, und der Kopf des Aufgabenfensters scrollt nicht waagrecht (`scrollWidth ≤ clientWidth`); die Seite scrollt nicht waagrecht (`document.documentElement.scrollWidth ≤ clientWidth`). Die **ux-Vorprüfung #104 hat entschieden (E1): die Reiterleiste bricht bei Bedarf in weitere Zeilen um** (`flex-wrap` im Kopf, Muster des bereits umbrechenden `.mod-kopf`, `web/kd-app.css:874`); sie **scrollt nicht quer** und **schrumpft nicht** unter die Zielgröße (ADR-0012: ≥ 24 px, bei Touch ≥ 44 px).
- **Verträglichkeit**: Die Reiter „Kosten“ (R00105) und „Verlauf“ (R00123) bleiben in Name, Reihenfolge und Verhalten erhalten, auch wenn sie zu verschiedenen Zeiten gebaut werden; wer zuerst baut, legt die erweiterte `REITER`-Liste an, der andere ergänzt seinen Reiter (siehe Abhängigkeiten).

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte); Aufgabe #1 in „Eingang“ mit Beschreibung, einer Teilaufgabe, einem Kommentar und einem Durchlauf; Aufgabe #2 ohne Preisetikett.

### Reiter und Reihenfolge
- [ ] Gegeben #1 ohne Preisetikett, wenn das Aufgabenfenster geöffnet wird, dann hat die `role=tablist` „Ansicht der Aufgabe“ genau die Reiter „Inhalt“, „Zeiten“, „Anhänge“, „Details“, „Datei“ in dieser Reihenfolge (und dazu „Verlauf“, sobald R00123 gebaut ist), „Inhalt“ ist `aria-selected`, und ein Reiter „Kosten“ fehlt
- [ ] Gegeben #1 mit Preisetikett, wenn das Fenster geöffnet wird, dann steht „Kosten“ direkt hinter „Datei“; `aria-controls` des **gewählten** Reiters zeigt auf genau ein `role=tabpanel` (das gezeichnete Panel), und die übrigen Reiter tragen ihren `aria-controls`-Verweis (auf `reiterpanel-<k>`) ohne gezeichneten Inhalt (wie R00105/B0375) — es gibt genau **ein** `role=tabpanel` im Dokument (M1)
- [ ] Gegeben das Fenster mit gewähltem Reiter „Inhalt“ und Fokus auf dem Reiter, wenn zweimal `→` gedrückt wird, dann stehen Fokus und Auswahl auf „Anhänge“, nur dieser Reiter hat `tabindex=0`, und ein weiteres `→` führt auf „Details“ (kein Umlaufproblem über die neuen Reiter)
- [ ] Gegenbeispiel: Gegeben das Fenster, wenn `d` gedrückt wird, dann zeigt es „Datei“; ein zweites `d` zeigt „Inhalt“; die Reiter „Zeiten“, „Anhänge“ und „Details“ sind an `d` nicht beteiligt

### Was in welchem Reiter steht
- [ ] Gegeben #1, wenn der Reiter „Inhalt“ geöffnet wird, dann zeigt er Titel, Beschreibung, die Abschnitte TEILAUFGABEN, KOMMENTARE und DURCHLÄUFE, aber weder die Zeiten-Tabelle noch „Läuft gerade“ noch die Anhänge noch ein Feld „Spalte“/„Klasse“/„Zuständig“ (S2)
- [ ] Gegeben #1 mit einem laufenden Timer und einem Zeiteintrag, wenn der Reiter „Zeiten“ geöffnet wird, dann zeigt er „Läuft gerade“ mit dem Timer und die Zeiten-Tabelle; ein Klick auf „Stopp“ stoppt den Timer (Datei und Commit wie heute), und im Reiter „Inhalt“ kommt keine Zeiten-Tabelle vor
- [ ] Gegeben #1 mit einem Anhang, wenn der Reiter „Anhänge“ geöffnet wird, dann zeigt er den Anhang mit Größe und ✕; ein weiterer Anhang lässt sich dort hochladen, und ein Klick auf ✕ entfernt ihn (ein Commit wie heute)
- [ ] Gegeben #1, wenn der Reiter „Details“ geöffnet wird, dann stehen dort die Felder Schlüssel (Fremdschlüssel `key`, nur lesend, nur wenn gesetzt), Spalte, Klasse, Herkunft, Zuständige, Labels, Fälligkeit, „wartet auf“, Wirkungen, Phasen, Signale, Zählung und Reservierung; wird die Spalte auf „Fertig“ gestellt, wandert die Karte nach „Fertig“ (ein Commit wie heute), und im Fenster gibt es keine eigene Seitenleiste mehr daneben (S1)
- [ ] Gegenbeispiel: Gegeben #1, wenn jeder Reiter geöffnet und sein sichtbarer Text gelesen wird, dann kommt kein Abschnitt (Teilaufgaben, Kommentare, Durchläufe, Zeiten, Anhänge, Felder) in zwei Reitern zugleich vor, und die Zeiten-Tabelle und die Felder stehen in keinem Reiter außer „Zeiten“ bzw. „Details“

### Rückfall, Live, Fokus
- [ ] Gegeben #2 ohne Preisetikett im Reiter „Datei“, wenn mit ↑ ↓ zu #1 mit Preisetikett geblättert wird, dann bleibt „Datei“ gewählt und der Reiter „Kosten“ kommt hinzu
- [ ] Gegeben #1 mit Preisetikett im Reiter „Kosten“, wenn über die API `cost: null` gesetzt wird, dann zeigt das Fenster innerhalb von 1 s „Inhalt“, `aria-selected` liegt dort, und es gibt keinen Reiter „Kosten“ mehr (Rückfallregel R00105/B0376 unverändert)
- [ ] Gegeben das Fenster mit gemerktem Reiter „Verlauf“ (oder einem sonst nicht vorhandenen Schlüssel), wenn die offene Aufgabe diesen Reiter nicht führt (`verlauf ∉ reiterSchluessel(a)`) und das Fenster gezeichnet wird, dann ist „Inhalt“ gewählt (`aria-selected="true"`, `tabindex="0"`), kein Reiter bleibt ohne Auswahl, und das gilt beim Blättern wie beim Live-Ereignis (generische Rückfallregel, S3)
- [ ] Gegeben #1 im Reiter „Details“ mit Fokus im Feld „Labels“, wenn über die API der Titel von #1 geändert wird und das Live-Ereignis eintrifft, dann bleibt der Reiter „Details“ gewählt und der Fokus im Feld „Labels“ (R00103, R00110)
- [ ] Gegeben das Aufgabenfenster ist offen, wenn die Kürzelhilfe geöffnet wird, dann nennt sie weiter „← →“ mit „Reiter wechseln (Fokus auf einem Reiter)“ und keine Taste, die es nicht mehr gibt

### Schmale Breiten und Abgrenzung
- [ ] Gegeben #1 mit Preisetikett, wenn das Fenster bei 320, 375 und 414 px Breite jeweils in Hell und in Dunkel geöffnet wird, dann **bricht die Reiterleiste bei Bedarf in weitere Zeilen um** (E1), jeder Reiter und ✕ liegt ganz im sichtbaren Bereich und ist per Klick wie per Tastatur bedienbar, ein Klick auf jeden Reiter zeigt dessen Panel, jeder Reiter misst bei feinem Zeiger ≥ 24 × 24 px und bei `pointer: coarse` ≥ 44 × 44 px (ADR-0012), und für den Kopf des Fensters sowie die Seite gilt `scrollWidth ≤ clientWidth`
- [ ] Gegenbeispiel: Gegeben #1 mit Preisetikett, wenn im Reiter „Kosten“ und im Reiter „Verlauf“ (sobald R00123 gebaut ist) die sichtbaren Texte und die Tabelle gelesen werden, dann sind sie unverändert wie in R00105 bzw. R00123 beschrieben (die Kostentabelle mit `caption` und Summenzeile, die Verlaufstabelle neueste oben) — diese Anforderung hat an beiden nichts geändert
- [ ] Gegeben eine frische Aufgabe, wenn der Dialog „Neue Aufgabe“ geöffnet wird, dann hat er keine Reiterleiste (unverändert gegenüber heute)

## Betroffene Verzeichnisstruktur
- Oberfläche: `web/ansicht.js` (die `REITER`-Liste, `reiterDerAufgabe`/`reiterSchluessel`, `vFenster`/`vReiterleiste`/`reiterPanel`, `vSchluesselFeld`, die Abschnittsfunktionen `vFensterAbschnitte`, `vFensterSeite`, `vZeiten`, `vAnhaenge`, `vTeilaufgaben`, `vKommentare`, `vDurchlaeufe`), `web/app.js` (die Tasten des Fensters, die verallgemeinerte Rückfallregel `tab ∉ reiterSchluessel(a)` in `render`), `web/tastatur.js` (`naechsterReiter`), `web/kosten.js` (`reiterRueckfall`, auf die generische Bedingung verallgemeinert), `web/kd-app.css` (Kopf der Reiterleiste mit `flex-wrap`, einspaltiges Fenster).
- Tests: Unit in `e2e/einheit/` (die reine Reiter-Navigation und der Rückfall), E2E `e2e/tests/r00127-kartendetails-tabs.spec.js`; die bestehenden E2E zu Fenster, Reitern, Kosten (`r00105-preisetikett.spec.js`) und Verlauf bleiben grün.

## Technische Überlegungen

### Ablauf
1. **Reiter und Hülle erweitern** (F0098, Walking Slice)
   - 1.1 `REITER` um „Zeiten“, „Anhänge“, „Details“ ergänzen, Reihenfolge festlegen, „Kosten“ weiter bedingt, „Verlauf“ aus R00123 mitdenken; **generische Rückfallregel** `tab ∉ reiterSchluessel(a)` → `inhalt` (S3) (B0580)
   - 1.2 `vFenster` je Reiter ein Panel geben, **gezeichnet wird genau das Panel des gewählten Reiters** (M1); die Hülle (tablist, roving tabindex, `← →`, `Pos1`/`Ende`, `Enter`/`Leertaste`, `d`) unverändert lassen (B0581)
   - 1.3 Die Reiterleiste bei 320/375/414 px sichtbar und bedienbar halten, Kopf **mit Umbruch (E1)**, ohne Querscrollen (B0582)
2. **Abschnitte umverteilen** (F0099)
   - 2.1 „Zeiten“ (läuft gerade + Zeiten) aus der Seitenleiste in den Reiter (B0583)
   - 2.2 „Anhänge“ in den Reiter (B0584)
   - 2.3 Felder der Seitenleiste in den Reiter „Details“, Seitenleiste entfällt, Fenster einspaltig (B0585)
   - 2.4 „Inhalt“ bleibt schlank (Titel, Beschreibung, Teilaufgaben, Kommentare, Durchläufe) (B0586)

### Grobentwurf

**Wichtige Einstiegsstellen:** `web/ansicht.js` (die Reiterleiste `vReiterleiste` und das Fenster `vFenster`, die Abschnitte `vFensterAbschnitte`/`vFensterSeite`), `web/app.js` (die Tastenzuordnung des Fensters, die Rückfallregel im Neuzeichnen nach Live-Ereignissen), `web/tastatur.js` (`naechsterReiter`).

**Elemente** (Vorplanung):
- `REITER` (Liste) — Reiter-Schlüssel und Beschriftungen in Reihenfolge; „kosten“ weiter an `a.cost` gebunden, „verlauf“ aus R00123.
- `reiterDerAufgabe(a)` (rein) — die für eine Aufgabe sichtbaren Reiter; `reiterSchluessel(a)` — die Schlüssel dazu (Zuhause der generischen Rückfallregel, S3).
- `naechsterReiter(reiter, aktuell, taste)` (rein, **heute in `web/tastatur.js`**, nicht in `web/app.js`) — Ziel-Reiter je Taste, für 2 … n Reiter.
- `reiterRueckfall` (rein, heute in `web/kosten.js` für „kosten“) — auf `tab ∉ reiterSchluessel(a)` verallgemeinern (S3).
- `vFenster(a)` — Kopf mit `vReiterleiste`, **genau ein gezeichnetes** `reiterPanel(k)` mit dem Abschnitt des gewählten Reiters (M1).
- `vSchluesselFeld(a)` (heute `web/ansicht.js:652`) — die Zeile „Schlüssel“ zieht mit in den Reiter „Details“ (S1).
- Die Abschnittsfunktionen (`vZeiten`, `vAnhaenge`, `vFensterSeite`, `vTeilaufgaben`, `vKommentare`, `vDurchlaeufe`) bleiben im Inhalt, sie werden nur von der richtigen Stelle aufgerufen.

### Änderungen an bestehenden Klassen
- `web/ansicht.js`: `REITER` erweitert; `vFenster` verzweigt nicht mehr nur nach `datei`/`kosten`, sondern je Reiter (genau ein gezeichnetes Panel, M1); `vFensterAbschnitte` verliert Anhänge (→ eigener Reiter), `vFensterSeite` trägt nur noch den Reiter „Details“/„Zeiten“; `vSchluesselFeld` zieht in „Details“ (S1).
- `web/app.js`: die Tasten des Fensters gelten für n Reiter; die Rückfallregel in `render` wird von „kosten“ auf `tab ∉ reiterSchluessel(a)` verallgemeinert (S3); `d` unverändert. `naechsterReiter` liegt in `web/tastatur.js`, nicht in `web/app.js`.
- `web/kosten.js`: `reiterRueckfall` wird auf die generische Bedingung verallgemeinert (S3).
- `web/kd-app.css`: `.mod-body` wird einspaltig je Reiter; die Reiterleiste **bricht bei Bedarf um (E1, `flex-wrap`)** — kein Querscrollen, kein Schrumpfen unter 24 px.

### Verhältnis zu R00105 und R00123
- Die `REITER`-Liste und der Kopf der Reiterleiste sind der gemeinsame Ort: R00105 legt „Kosten“ an (I0093), R00123 „Verlauf“ (I0113), diese Anforderung „Zeiten“, „Anhänge“, „Details“. Wer zuerst baut, legt die erweiterte Liste an, der andere ergänzt seinen Reiter. Es entsteht **kein** zweiter Reiter-Machanismus.

### Umfang
- I0115: 2 Features, 7 Bubbles, Richtwert 6,5–11 h; ungemessen (Hypothese). Keine Bubble liegt unter der Untergrenze von 0,4 h.

### Gestaltung
- **ux-Vorprüfung #104 liegt vor (2026-11-11; Ergebnis: befund, ein Muss `M1` und die Sollte `S1`–`S3`, eingearbeitet oben und in den AK):** Aufteilung und Reihenfolge sind bestätigt; die Reiterleiste bei 320/375/414 px **bricht bei Bedarf um (Entscheidung E1)**; Zielgrößen nach ADR-0012.
- **Artboard D0003** wird um den Zustand „Aufgabenfenster mit mehreren Reitern“ ergänzt (Anker `#reiter-mehrere`, hell und dunkel, 1280 · 414 · 320 px, mit den Reitern „Inhalt · Zeiten · Anhänge · Details · Datei“ samt Sonderfall „Kosten“ und dem als „aus R00123, sobald gebaut“ gekennzeichneten „Verlauf“), der **product-owner gibt frei**, bevor die Oberflächen-Bubbles bauen. Die Bubbles B0581–B0586 warten darauf; B0580 (reine Funktion) ist frei baubar.

## Tests
Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** `naechsterReiter` für 2 und n Reiter je Taste und Umlauf; `reiterDerAufgabe(a)` mit und ohne `cost` (und mit „verlauf“, sobald R00123 steht); die generische Rückfallregel `tab ∉ reiterSchluessel(a)` → `inhalt` (mit `S.ui.tab='verlauf'` bei einer `REITER`-Liste ohne „verlauf“, M1/S3).

**E2E:** US-1 bis US-7 gegen das laufende Programm auf freiem Port; je Reiter der sichtbare Text und die Bedienung (Timer stoppen, Anhang entfernen, Spalte ändern); `← →`/`Pos1`/`Ende`/`d` über die neuen Reiter; Rückfall bei `cost: null` und bei einem unbekannten Reiter-Schlüssel mit Warten auf das Ereignis; Live-Änderung im Reiter „Details“ ohne Fokusverlust; 320/375/414 px hell und dunkel ohne Querscrollen (Reiterleiste bricht um, E1); `aria-controls` des gewählten Reiters löst auf genau ein `role=tabpanel` auf (M1). Gegenprobe: nach dem Ansehen und Bedienen sind Aufgabendatei und `git log` unverändert, wo nur angesehen wurde.

## Abhängigkeiten
- Abhängig von: R00105 Preisetikett und Kostenbericht (I0093, gruen — die Reiterhülle `tablist`/B0375, die erweitert wird), R00011 Aufgabe ansehen und bearbeiten (I0011, gruen), R00103/R00110 (Live ohne Fokusverlust, gruen), R00036 Neue Aufgabe im Dialog (I0036, gruen — nur zur Abgrenzung).
- Berührt: R00123 Karten-Verlauf (I0113, rot) — derselbe Reiter-Kopf; wer zuerst baut, legt die erweiterte `REITER`-Liste an, der andere ergänzt seinen Reiter. R00105 (I0093, gruen) — Reiter „Kosten“ bleibt unverändert. **Koordination (A1):** R00123 AK „Reiterleiste … genau die Reiter ‚Inhalt‘, ‚Datei‘, ‚Verlauf‘“ (R00123 Z. 74) wird nach dem Bau dieser Anforderung auf „Inhalt, Zeiten, Anhänge, Details, Datei, Verlauf“ erweitert; R00127 definiert den Reiter „Verlauf“ nicht neu und ordnet ihn als letzten ein. Ebenso wird der neue E2E-Name gegen **R00127** gebildet (`e2e/tests/r00127-kartendetails-tabs.spec.js`), nicht gegen „r00125“.
- Blockiert: —

## Offene Fragen
- **1. Form der Reiter-Auswahl (Segment vs. Menü).** Der Betreiber wünscht „ggf. eher ein Menü als die Buttonliste“ (Karte #104). Der architekt hat bindend entschieden: keine Technikfrage, kein ADR — die `tablist`-Hülle aus R00105 wird **erweitert**. Empfehlung: es bleibt bei der `tablist` (Segment) mit mehr Reitern; der Wechsel auf ein Menü verlässt das gerade eingeführte APG-Tab-Muster und wird, wenn gewünscht, eine eigene Neugestaltung (Folgekarte). Entscheidet der Auftraggeber anders, ist das richtungsweisend und gehört vor den Bau.
- **2. Gilt das Muster auch für „Neue Aufgabe“ (R00036)?** Empfehlung: nein — „Neue Aufgabe“ zeigt keine bestehende Aufgabe und hat heute keine Reiter; ein Reiter-Umbau dort wäre neuer Umfang ohne Auftrag. Offene Frage an den Auftraggeber.
- **3. Aufteilung und Reihenfolge.** Der Vorschlag des planers („Inhalt · Zeiten · Anhänge · Details · Datei · Kosten? · Verlauf“) und die Zuordnung der Abschnitte sind durch die **ux-Vorprüfung #104 bestätigt** (siehe oben); am Artboard zeichnet der gestalter den Zustand. Nicht richtungsweisend: Darstellung im Rahmen des Auftrags.
- **4. Einordnung des Reiters „Verlauf“ (R00123).** R00123 legt den Reiter „Verlauf“ als letzten an; diese Anforderung ordnet ihn hinter „Datei/Kosten“ ein. Da R00123 noch nicht gebaut ist, gilt: wer zuerst baut, legt die Liste an, der andere fügt seinen Reiter an der vereinbarten Stelle ein (siehe Berührt). Der Wortlaut von R00123 (AK Z. 74: „genau Inhalt, Datei, Verlauf“) wird nach dem Bau auf „Inhalt, Zeiten, Anhänge, Details, Datei, Verlauf“ nachgezogen (A1).
- **5. Ist der Fremdschlüssel `key` (Feld „Schlüssel“, R00098) wesentlich?** **Entschieden (2026-11-11, Empfehlung übernommen): ja** — das Feld zieht mit in den Reiter „Details“ und bleibt sichtbar (S1); ohne die Zeile wäre der Fremdschlüssel nach dem Entfall der Seitenleiste nirgends mehr sichtbar.

## Manuelle Vorbereitungstätigkeiten
- **ux-Vorprüfung #104 liegt vor**; der gestalter ergänzt das **Artboard D0003** um den Zustand „Aufgabenfenster mit mehreren Reitern“ (Anker `#reiter-mehrere`, hell und dunkel, 1280 · 414 · 320 px; Reiter „Inhalt · Zeiten · Anhänge · Details · Datei“ samt Sonderfall „Kosten“, „Verlauf“ als „aus R00123, sobald gebaut“ gekennzeichnet; einspaltiges Fenster ohne `.mod-side`; schmale Breiten mit Umbruch E1; die Leerzustände „Zeiten“ ohne Timer und „Anhänge“ ohne Anhang; Kontrast gerechnet); **Freigabe durch den product-owner** vor dem Bau der Oberflächen-Bubbles (B0581–B0586). B0580 (reine Funktion) ist frei baubar.

## Manuelle Nachbereitungstätigkeiten
- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Betreiber-Eindruck, dass das Aufgabenfenster „jede Menge Informationen und Edit-Masken“ auf einer Seite stapelt. Weil der Reiter „Kosten“ (R00105) bereits gezeigt hat, dass ein eigener Reiter Platz spart und aufräumt, überträgt diese Anforderung dasselbe Muster auf die übrigen Abschnitte: Zeiten/Timer, Anhänge und die Felder der Seitenleiste bekommen je einen Reiter, und „Inhalt“ zeigt nur noch die Arbeit an der Aufgabe. Dadurch steht jede Sache an genau einem festen Ort, der Betreiber sieht beim Öffnen zuerst das Wesentliche, und das Fenster wird einspaltig statt zweispaltig. Der Hebel ist die vorhandene `tablist`-Hülle aus R00105: sie trägt schon Rolle, Tastatur und Rückfall, es kommt nur Inhalt dazu — deshalb braucht es weder neue Daten noch ein ADR, und die Änderung ist in kleinen, einzeln prüfbaren Schritten umkehrbar.

## Missing-Docs
- Keine.

## Notizen
- **Einarbeitung UX-Vorprüfung #104 (2026-11-11, ein Muss `M1` + `S1`–`S3` + Entscheidung `E1`):** **M1** — der AK „`aria-controls` **jedes** Reiters zeigt auf genau ein `role=tabpanel`“ war auf der ausgelieferten R00105-Hülle rot (nur das gewählte Panel wird gezeichnet, `e2e/tests/r00105-preisetikett.spec.js:44` erwartet genau ein `tabpanel`); er ist umformuliert auf **„`aria-controls` des gewählten Reiters löst auf das eine gezeichnete Panel auf; die übrigen Reiter tragen ihren Verweis ohne gezeichneten Inhalt (wie R00105)“ (Variante A, unten begründet)**. **S1** — das Feld **„Schlüssel“** (`key`, Fremdschlüssel R00098, heute `vSchluesselFeld` `web/ansicht.js:652` in der Seitenleiste) zieht mit in den Reiter „Details“ (nur lesend, nur wenn gesetzt); sonst wäre es nach dem Entfall der Seitenleiste nirgends sichtbar. **S2** — der Reiter „Inhalt“ nennt ausdrücklich den Abschnitt **DURCHLÄUFE** (AK). **S3** — die generische Rückfallregel **`tab ∉ reiterSchluessel(a)` → `inhalt`** ist als Kriterium und Code-Ort festgehalten (heute nur für „kosten“). **E1 (bestätigt)** — bei 320/375/414 px **bricht die Reiterleiste um** (`flex-wrap`), sie scrollt nicht quer und schrumpft nicht unter 24 px. **A1** — der Reiter „Verlauf“ bleibt letzter (R00123); R00123 AK „genau Inhalt, Datei, Verlauf“ wird nach dem Bau auf „Inhalt, Zeiten, Anhänge, Details, Datei, Verlauf“ erweitert, und der neue E2E-Name wird gegen **R00127** gebildet.
- **M1 — Optionen (Skill `optionen-vor-entscheidung`):** (A, **gewählt**) AK umformulieren auf den gewählten Reiter; Hülle und R00105-E2E bleiben unberührt, nur das Panel des gewählten Reiters wird gezeichnet (Laufzeitkosten: nur ein Panel). (B) APG-nah alle Panels zeichnen, inaktive `hidden` — semantisch strenger (keine baumelnde `aria-controls`-IDREF), aber ändert die ausgelieferte, abgenommene R00105-Hülle und ihr E2E (`spec.js:44`) und zeichnet 5–7 Panels samt Verlaufstabelle bei jedem Zustand. (C) das `aria-controls` der nicht gewählten Reiter weglassen — verlässt die in R00105 abgenommene Hülle und die APG-Vorgabe, dass ein Reiter auf sein Panel zeigt. **Gewählt A**, weil R00127 die R00105-Hülle ausdrücklich unverändert lässt und „in ‚Kosten‘ und ‚Verlauf‘ nichts ändert“, ein Wechsel auf B die abgenommene Nachbar-Anforderung samt ihrem Test berührt und die Verlaufstabelle (R00123-Live) im Hintergrund zeichnen würde; die verbleibende Abweichung (nicht gewählte Reiter ohne gezeichnetes Panel) ist die bereits abgenommene R00105-Linie und kann in einem eigenen Barrierefreiheits-Durchgang für alle Reiter gemeinsam geschlossen werden.
- **Verworfene Alternativen:** (a) *Alles in ein Menü* (kanbanflow-Stil mit seitlichen Zusatzmenüs) — verlässt die `tablist`-Hülle, ist ein eigenes Redesign, das der Betreiber selbst als mögliche spätere Beauftragung nennt; nicht in dieser Karte. (b) *Nur den Timer verschieben* — lässt die Seitenleiste und die zweispaltige Enge bestehen und löst das „aufgeräumt“ nur halb. (c) *Reiter nur bei Bedarf einblenden* (z. B. „Anhänge“ nur mit Anhang) — macht den Ort unbeständig und die Hülle unruhig; R00105 kennt einen solchen bedingten Reiter nur für „Kosten“ (weil dort eine Handlung fehlt), hier gibt es überall eine.
- **Abgrenzung:** Reiter „Verlauf“ = R00123/I0113 (Karte #119), Reiter „Kosten“ = R00105/I0093 — beide hier nicht neu definiert. „Zuständig“ und die Felder als Menü (Betreiber-Hinweis, kanbanflow) sind **nicht** Teil dieser Anforderung: hier ziehen die Felder nur als Block in einen Reiter um, ihre Gestalt bleibt; die Umstellung auf Menüs ist eine spätere Neugestaltung (Offene Frage 1, Folgekarte).
