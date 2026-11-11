---
id: R00127
status: Neu
datum: 2026-11-11
---

# R00127: Kartendetails mit mehreren Reitern statt allem auf einer Seite

## Beschreibung

Das Aufgabenfenster zeigt heute fast alles auf einer Fläche: den Bearbeitungsbereich (Titel, Beschreibung, Teilaufgaben, Kommentare, Durchläufe, Anhänge) **und** daneben eine Seitenleiste mit den Feldern (Spalte, Klasse, Zuständige, Labels, Fälligkeit, Herkunft …), den laufenden Timern und den Zeiten. Mit dem Preisetikett (R00105) hat sich gezeigt, wie sich Platz sparen lässt: ein eigener Reiter „Kosten“ neben „Inhalt“ und „Datei“. Dieses Muster wird ausgebaut — weitere Abschnitte ziehen aus der einen Seite in eigene Reiter um, sodass jeder Reiter eine Sache zeigt und das Fenster aufgeräumt wird.

Die Reiter-Hülle aus R00105 (F0043/B0375, `role=tablist` nach der WAI-ARIA APG mit automatischer Aktivierung) wird dafür erweitert, nicht ersetzt: dieselbe Leiste trägt künftig mehr Reiter, Rolle, Tastatur (`← →`, `Pos1`/`Ende`, `Enter`/`Leertaste`, `d`) und die Kürzelhilfe bleiben. Der Vorschlag des planers zur Aufteilung steht unter „Mit der ux-Vorprüfung und dem Artboard festzulegen“; die ux-Vorprüfung schärft ihn, der product-owner gibt das Artboard frei (Vision-Leitplanke „Der Mensch sieht jede Gestaltung, bevor sie gebaut wird“).

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
- Die Reiterleiste des Aufgabenfensters trägt die Reiter in dieser Reihenfolge (Vorschlag, ux/PO bestätigen): **„Inhalt“ · „Zeiten“ · „Anhänge“ · „Details“ · „Datei“ · „Verlauf“**; der Reiter **„Kosten“** steht — wie in R00105 — nur bei einer Aufgabe mit Preisetikett und direkt hinter „Datei“.
- Beim Öffnen ist **„Inhalt“** gewählt. Beim Blättern zu einer anderen Aufgabe (↑ ↓) bleibt der gewählte Reiter, außer er existiert dort nicht („Kosten“ ohne Etikett → „Inhalt“, wie R00105/B0376). Ein unbekannter Reiter fällt immer auf „Inhalt“ zurück.
- Die Hülle bleibt die `tablist` aus R00105: Element `role=tablist` mit dem Namen „Ansicht der Aufgabe“, je Reiter `role=tab` mit `aria-selected` und `aria-controls` auf ein `role=tabpanel`, nur der gewählte Reiter mit `tabindex=0`; `← →` mit Umlauf, `Pos1`/`Ende`, `Enter`/`Leertaste`, `d` (Inhalt ↔ Datei) und der Kürzelhinweis „← → Reiter wechseln (Fokus auf einem Reiter)“ gelten unverändert. Kein neues Bedienmuster: **kein Menü** statt der Reiterleiste (der Betreiberwunsch „eher ein Menü“ ist eine spätere Neugestaltung, siehe Offene Fragen).

### Was in welchem Reiter steht
- **„Inhalt“** zeigt die Arbeit an der Aufgabe: Titel, Beschreibung, Teilaufgaben, Kommentare und Durchläufe. **Nicht** mehr hier: Zeiten/Timer, Anhänge und die Felder der bisherigen Seitenleiste.
- **„Zeiten“** zeigt „Läuft gerade“ (alle laufenden Timer samt Start/Stopp) und die Zeiten-Tabelle (nachtragen, korrigieren, löschen) — die bisherigen Abschnitte aus der Seitenleiste, unverändert im Verhalten.
- **„Anhänge“** zeigt die Anhänge der Aufgabe samt Hochladen und Entfernen.
- **„Details“** zeigt die Felder der bisherigen Seitenleiste: Spalte, Klasse, Herkunft, Zuständige, Labels, Fälligkeit, „wartet auf“, Wirkungen, Phasen, Signale, Zählung, Reservierung. Das Feld „Spalte“ bewegt die Karte weiter wie heute (R00006). Die Felder sehen aus wie heute; sie stehen nur an einem anderen Ort.
- **„Datei“**, **„Kosten“** (nur mit Etikett, R00105) und **„Verlauf“** (immer, R00123) bleiben in Inhalt und Verhalten unverändert; in „Kosten“ und „Verlauf“ ändert diese Anforderung nichts.
- Jeder Abschnitt steht **genau einmal**: was in einen Reiter gezogen ist, fehlt in „Inhalt“ und in jedem anderen Reiter.
- Das Fenster wird damit **einspaltig**; die Seitenleiste (`aside.mod-side`) entfällt als eigene Spalte. Im [schmalen Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) entfällt das bisherige Untereinander-Stapeln von Hauptbereich und Seitenleiste.

### Verhalten
- Öffnen, Blättern und Schließen ändern sich nicht; jede Änderung geht weiter sofort in die Aufgabendatei und wird committet.
- Ein [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) zeichnet das Fenster neu, ohne dem Menschen Fokus oder Leseposition zu nehmen (R00103, R00110); der gewählte Reiter bleibt.
- Ändert sich der Umfang der Reiter live (Preisetikett gesetzt oder entfernt), gilt die Rückfallregel aus R00105/B0376 unverändert.

### „Neue Aufgabe“
- Der Dialog „Neue Aufgabe“ (R00036) gehört **nicht** zu dieser Anforderung: er zeigt keine bestehende Aufgabe und bekommt in dieser Ausbaustufe keine Reiter. (Offene Frage 2.)

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Die Reiterleiste folgt dem Muster „Tabs“ der WAI-ARIA APG mit automatischer Aktivierung (wie R00105); jeder Reiter ist per Tastatur erreichbar und hat einen zugänglichen Namen (seinen sichtbaren Text); die Zielgrößen folgen ADR-0012 (≥ 24 px, bei Touch ≥ 44 px).
- **Schmale Breiten**: Bei 320, 375 und 414 px Breite bleiben alle Reiter sichtbar und bedienbar, und der Kopf des Aufgabenfensters scrollt nicht waagrecht (`scrollWidth ≤ clientWidth`); die Seite scrollt nicht waagrecht (`document.documentElement.scrollWidth ≤ clientWidth`). Ob die Reiterleiste bei vielen Reitern umbricht oder in sich schrumpft, entscheidet die ux-Vorprüfung (Artboard D0003).
- **Verträglichkeit**: Die Reiter „Kosten“ (R00105) und „Verlauf“ (R00123) bleiben in Name, Reihenfolge und Verhalten erhalten, auch wenn sie zu verschiedenen Zeiten gebaut werden; wer zuerst baut, legt die erweiterte `REITER`-Liste an, der andere ergänzt seinen Reiter (siehe Abhängigkeiten).

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte); Aufgabe #1 in „Eingang“ mit Beschreibung, einer Teilaufgabe und einem Kommentar; Aufgabe #2 ohne Preisetikett.

### Reiter und Reihenfolge
- [ ] Gegeben #1 ohne Preisetikett, wenn das Aufgabenfenster geöffnet wird, dann hat die `role=tablist` „Ansicht der Aufgabe“ genau die Reiter „Inhalt“, „Zeiten“, „Anhänge“, „Details“, „Datei“ in dieser Reihenfolge (und dazu „Verlauf“, sobald R00123 gebaut ist), „Inhalt“ ist `aria-selected`, und ein Reiter „Kosten“ fehlt
- [ ] Gegeben #1 mit Preisetikett, wenn das Fenster geöffnet wird, dann steht „Kosten“ direkt hinter „Datei“; `aria-controls` jedes Reiters zeigt auf genau ein `role=tabpanel`
- [ ] Gegeben das Fenster mit gewähltem Reiter „Inhalt“ und Fokus auf dem Reiter, wenn zweimal `→` gedrückt wird, dann stehen Fokus und Auswahl auf „Anhänge“, nur dieser Reiter hat `tabindex=0`, und ein weiteres `→` führt auf „Details“ (kein Umlaufproblem über die neuen Reiter)
- [ ] Gegenbeispiel: Gegeben das Fenster, wenn `d` gedrückt wird, dann zeigt es „Datei“; ein zweites `d` zeigt „Inhalt“; die Reiter „Zeiten“, „Anhänge“ und „Details“ sind an `d` nicht beteiligt

### Was in welchem Reiter steht
- [ ] Gegeben #1, wenn der Reiter „Inhalt“ geöffnet wird, dann zeigt er Titel, Beschreibung, Abschnitt TEILAUFGABEN und Abschnitt KOMMENTARE, aber weder die Zeiten-Tabelle noch „Läuft gerade“ noch die Anhänge noch ein Feld „Spalte“/„Klasse“/„Zuständig“
- [ ] Gegeben #1 mit einem laufenden Timer und einem Zeiteintrag, wenn der Reiter „Zeiten“ geöffnet wird, dann zeigt er „Läuft gerade“ mit dem Timer und die Zeiten-Tabelle; ein Klick auf „Stopp“ stoppt den Timer (Datei und Commit wie heute), und im Reiter „Inhalt“ kommt keine Zeiten-Tabelle vor
- [ ] Gegeben #1 mit einem Anhang, wenn der Reiter „Anhänge“ geöffnet wird, dann zeigt er den Anhang mit Größe und ✕; ein weiterer Anhang lässt sich dort hochladen, und ein Klick auf ✕ entfernt ihn (ein Commit wie heute)
- [ ] Gegeben #1, wenn der Reiter „Details“ geöffnet wird, dann stehen dort die Felder Spalte, Klasse, Herkunft, Zuständige, Labels, Fälligkeit, „wartet auf“, Wirkungen, Phasen, Signale, Zählung und Reservierung; wird die Spalte auf „Fertig“ gestellt, wandert die Karte nach „Fertig“ (ein Commit wie heute), und im Fenster gibt es keine eigene Seitenleiste mehr daneben
- [ ] Gegenbeispiel: Gegeben #1, wenn jeder Reiter geöffnet und sein sichtbarer Text gelesen wird, dann kommt kein Abschnitt (Teilaufgaben, Kommentare, Durchläufe, Zeiten, Anhänge, Felder) in zwei Reitern zugleich vor, und die Zeiten-Tabelle und die Felder stehen in keinem Reiter außer „Zeiten“ bzw. „Details“

### Rückfall, Live, Fokus
- [ ] Gegeben #2 ohne Preisetikett im Reiter „Datei“, wenn mit ↑ ↓ zu #1 mit Preisetikett geblättert wird, dann bleibt „Datei“ gewählt und der Reiter „Kosten“ kommt hinzu
- [ ] Gegeben #1 mit Preisetikett im Reiter „Kosten“, wenn über die API `cost: null` gesetzt wird, dann zeigt das Fenster innerhalb von 1 s „Inhalt“, `aria-selected` liegt dort, und es gibt keinen Reiter „Kosten“ mehr (Rückfallregel R00105/B0376 unverändert)
- [ ] Gegeben #1 im Reiter „Details“ mit Fokus im Feld „Labels“, wenn über die API der Titel von #1 geändert wird und das Live-Ereignis eintrifft, dann bleibt der Reiter „Details“ gewählt und der Fokus im Feld „Labels“ (R00103, R00110)
- [ ] Gegeben das Aufgabenfenster ist offen, wenn die Kürzelhilfe geöffnet wird, dann nennt sie weiter „← →“ mit „Reiter wechseln (Fokus auf einem Reiter)“ und keine Taste, die es nicht mehr gibt

### Schmale Breiten und Abgrenzung
- [ ] Gegeben #1 mit Preisetikett, wenn das Fenster bei 320, 375 und 414 px Breite jeweils in Hell und in Dunkel geöffnet wird, dann liegen alle Reiter und ✕ ganz im sichtbaren Bereich, ein Klick auf jeden Reiter zeigt dessen Panel, und für den Kopf des Fensters sowie die Seite gilt `scrollWidth ≤ clientWidth`
- [ ] Gegenbeispiel: Gegeben #1 mit Preisetikett, wenn im Reiter „Kosten“ und im Reiter „Verlauf“ (sobald R00123 gebaut ist) die sichtbaren Texte und die Tabelle gelesen werden, dann sind sie unverändert wie in R00105 bzw. R00123 beschrieben (die Kostentabelle mit `caption` und Summenzeile, die Verlaufstabelle neueste oben) — diese Anforderung hat an beiden nichts geändert
- [ ] Gegeben eine frische Aufgabe, wenn der Dialog „Neue Aufgabe“ geöffnet wird, dann hat er keine Reiterleiste (unverändert gegenüber heute)

## Betroffene Verzeichnisstruktur
- Oberfläche: `web/ansicht.js` (die `REITER`-Liste, `vFenster`/`vReiterleiste`/`reiterPanel`, die Abschnittsfunktionen `vFensterAbschnitte`, `vFensterSeite`, `vZeiten`, `vAnhaenge`, `vTeilaufgaben`, `vKommentare`, `vDurchlaeufe`), `web/app.js` (die Tasten des Fensters und `naechsterReiter`), `web/kd-app.css` (Kopf der Reiterleiste, einspaltiges Fenster).
- Tests: Unit in `e2e/einheit/` (die reine Reiter-Navigation), E2E `e2e/tests/r00125-kartendetails-tabs.spec.js`; die bestehenden E2E zu Fenster, Reitern, Kosten und Verlauf bleiben grün.

## Technische Überlegungen

### Ablauf
1. **Reiter und Hülle erweitern** (F0098, Walking Slice)
   - 1.1 `REITER` um „Zeiten“, „Anhänge“, „Details“ ergänzen, Reihenfolge festlegen, „Kosten“ weiter bedingt, „Verlauf“ aus R00123 mitdenken (B0580)
   - 1.2 `vFenster` je Reiter ein Panel geben; die Hülle (tablist, roving tabindex, `← →`, `Pos1`/`Ende`, `Enter`/`Leertaste`, `d`) unverändert lassen (B0581)
   - 1.3 Die Reiterleiste bei 320/375/414 px sichtbar und bedienbar halten, Kopf ohne Querscrollen (B0582)
2. **Abschnitte umverteilen** (F0099)
   - 2.1 „Zeiten“ (läuft gerade + Zeiten) aus der Seitenleiste in den Reiter (B0583)
   - 2.2 „Anhänge“ in den Reiter (B0584)
   - 2.3 Felder der Seitenleiste in den Reiter „Details“, Seitenleiste entfällt, Fenster einspaltig (B0585)
   - 2.4 „Inhalt“ bleibt schlank (Titel, Beschreibung, Teilaufgaben, Kommentare, Durchläufe) (B0586)

### Grobentwurf

**Wichtige Einstiegsstellen:** `web/ansicht.js` (die Reiterleiste `vReiterleiste` und das Fenster `vFenster`, die Abschnitte `vFensterAbschnitte`/`vFensterSeite`), `web/app.js` (die Tastenzuordnung des Fensters, `naechsterReiter`, sowie das Neuzeichnen nach Live-Ereignissen).

**Elemente** (Vorplanung):
- `REITER` (Liste) — Reiter-Schlüssel und Beschriftungen in Reihenfolge; „kosten“ weiter an `a.cost` gebunden, „verlauf“ aus R00123.
- `reiterDerAufgabe(a)` (rein) — die für eine Aufgabe sichtbaren Reiter.
- `naechsterReiter(reiter, aktuell, taste)` (rein, heute in `web/app.js`) — Ziel-Reiter je Taste, für 2 … n Reiter.
- `vFenster(a)` — Kopf mit `vReiterleiste`, je Reiter ein `reiterPanel(k)` mit dem Abschnitt.
- Die Abschnittsfunktionen (`vZeiten`, `vAnhaenge`, `vFensterSeite`, `vTeilaufgaben`, `vKommentare`, `vDurchlaeufe`) bleiben im Inhalt, sie werden nur von der richtigen Stelle aufgerufen.

### Änderungen an bestehenden Klassen
- `web/ansicht.js`: `REITER` erweitert; `vFenster` verzweigt nicht mehr nur nach `datei`/`kosten`, sondern je Reiter; `vFensterAbschnitte` verliert Anhänge (→ eigener Reiter), `vFensterSeite` trägt nur noch den Reiter „Details“/„Zeiten“.
- `web/app.js`: `naechsterReiter` und die Tasten des Fensters gelten für n Reiter; `d` unverändert.
- `web/kd-app.css`: `.mod-body` wird einspaltig je Reiter; die Reiterleiste bricht/scrollt nach der Artboard-Freigabe.

### Verhältnis zu R00105 und R00123
- Die `REITER`-Liste und der Kopf der Reiterleiste sind der gemeinsame Ort: R00105 legt „Kosten“ an (I0093), R00123 „Verlauf“ (I0113), diese Anforderung „Zeiten“, „Anhänge“, „Details“. Wer zuerst baut, legt die erweiterte Liste an, der andere ergänzt seinen Reiter. Es entsteht **kein** zweiter Reiter-Machanismus.

### Umfang
- I0115: 2 Features, 7 Bubbles, Richtwert 6,5–11 h; ungemessen (Hypothese). Keine Bubble liegt unter der Untergrenze von 0,4 h.

### Gestaltung
- **ux-Vorprüfung nötig**: die Verteilung auf mehr Reiter und vor allem der Kopf der Reiterleiste bei vielen Reitern sind ein neuer Zustand. Die ux-Vorprüfung prüft: Aufteilung und Reihenfolge (Vorschlag oben), Verhalten der Reiterleiste bei 320/375/414 px (umbruch oder Schrumpfen in sich, ohne Querscrollen des Kopfs), Zielgrößen (ADR-0012).
- **Artboard D0003** wird um den Zustand „Aufgabenfenster mit mehreren Reitern“ ergänzt (hell und dunkel, 1280 · 414 · 320 px, mit den Reitern „Inhalt · Zeiten · Anhänge · Details · Datei“ und dem Sonderfall „Kosten“), der **product-owner gibt frei**, bevor die Oberflächen-Bubbles bauen. Die Bubbles B0581–B0586 warten darauf; B0580 (reine Funktion) ist frei baubar.

## Tests
Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** `naechsterReiter` für 2 und n Reiter je Taste und Umlauf; `reiterDerAufgabe(a)` mit und ohne `cost` (und mit „verlauf“, sobald R00123 steht).

**E2E:** US-1 bis US-6 gegen das laufende Programm auf freiem Port; je Reiter der sichtbare Text und die Bedienung (Timer stoppen, Anhang entfernen, Spalte ändern); `← →`/`Pos1`/`Ende`/`d` über die neuen Reiter; Rückfall bei `cost: null` mit Warten auf das Ereignis; Live-Änderung im Reiter „Details“ ohne Fokusverlust; 320/375/414 px hell und dunkel ohne Querscrollen. Gegenprobe: nach dem Ansehen und Bedienen sind Aufgabendatei und `git log` unverändert, wo nur angesehen wurde.

## Abhängigkeiten
- Abhängig von: R00105 Preisetikett und Kostenbericht (I0093, gruen — die Reiterhülle `tablist`/B0375, die erweitert wird), R00011 Aufgabe ansehen und bearbeiten (I0011, gruen), R00103/R00110 (Live ohne Fokusverlust, gruen), R00036 Neue Aufgabe im Dialog (I0036, gruen — nur zur Abgrenzung).
- Berührt: R00123 Karten-Verlauf (I0113, rot) — derselbe Reiter-Kopf; wer zuerst baut, legt die erweiterte `REITER`-Liste an, der andere ergänzt seinen Reiter. R00105 (I0093, gruen) — Reiter „Kosten“ bleibt unverändert.
- Blockiert: —

## Offene Fragen
- **1. Form der Reiter-Auswahl (Segment vs. Menü).** Der Betreiber wünscht „ggf. eher ein Menü als die Buttonliste“ (Karte #104). Der architekt hat bindend entschieden: keine Technikfrage, kein ADR — die `tablist`-Hülle aus R00105 wird **erweitert**. Empfehlung: es bleibt bei der `tablist` (Segment) mit mehr Reitern; der Wechsel auf ein Menü verlässt das gerade eingeführte APG-Tab-Muster und wird, wenn gewünscht, eine eigene Neugestaltung (Folgekarte). Entscheidet der Auftraggeber anders, ist das richtungsweisend und gehört vor den Bau.
- **2. Gilt das Muster auch für „Neue Aufgabe“ (R00036)?** Empfehlung: nein — „Neue Aufgabe“ zeigt keine bestehende Aufgabe und hat heute keine Reiter; ein Reiter-Umbau dort wäre neuer Umfang ohne Auftrag. Offene Frage an den Auftraggeber.
- **3. Aufteilung und Reihenfolge.** Der Vorschlag des planers („Inhalt · Zeiten · Anhänge · Details · Datei · Kosten? · Verlauf“) und die Zuordnung der Abschnitte sind am Artboard der ux-Vorprüfung zu bestätigen; Änderungen zieht der planer in diese Anforderung nach. Nicht richtungsweisend: Darstellung im Rahmen des Auftrags.
- **4. Einordnung des Reiters „Verlauf“ (R00123).** R00123 legt den Reiter „Verlauf“ als letzten an; diese Anforderung ordnet ihn hinter „Datei/Kosten“ ein. Da R00123 noch nicht gebaut ist, gilt: wer zuerst baut, legt die Liste an, der andere fügt seinen Reiter an der vereinbarten Stelle ein (siehe Berührt).

## Manuelle Vorbereitungstätigkeiten
- ux-Vorprüfung des neuen Zustands und Ergänzung des Artboards D0003 durch den gestalter; Freigabe durch den product-owner vor dem Bau der Oberflächen-Bubbles (B0581–B0586).

## Manuelle Nachbereitungstätigkeiten
- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Betreiber-Eindruck, dass das Aufgabenfenster „jede Menge Informationen und Edit-Masken“ auf einer Seite stapelt. Weil der Reiter „Kosten“ (R00105) bereits gezeigt hat, dass ein eigener Reiter Platz spart und aufräumt, überträgt diese Anforderung dasselbe Muster auf die übrigen Abschnitte: Zeiten/Timer, Anhänge und die Felder der Seitenleiste bekommen je einen Reiter, und „Inhalt“ zeigt nur noch die Arbeit an der Aufgabe. Dadurch steht jede Sache an genau einem festen Ort, der Betreiber sieht beim Öffnen zuerst das Wesentliche, und das Fenster wird einspaltig statt zweispaltig. Der Hebel ist die vorhandene `tablist`-Hülle aus R00105: sie trägt schon Rolle, Tastatur und Rückfall, es kommt nur Inhalt dazu — deshalb braucht es weder neue Daten noch ein ADR, und die Änderung ist in kleinen, einzeln prüfbaren Schritten umkehrbar.

## Missing-Docs
- Keine.

## Notizen
- **Verworfene Alternativen:** (a) *Alles in ein Menü* (kanbanflow-Stil mit seitlichen Zusatzmenüs) — verlässt die `tablist`-Hülle, ist ein eigenes Redesign, das der Betreiber selbst als mögliche spätere Beauftragung nennt; nicht in dieser Karte. (b) *Nur den Timer verschieben* — lässt die Seitenleiste und die zweispaltige Enge bestehen und löst das „aufgeräumt“ nur halb. (c) *Reiter nur bei Bedarf einblenden* (z. B. „Anhänge“ nur mit Anhang) — macht den Ort unbeständig und die Hülle unruhig; R00105 kennt einen solchen bedingten Reiter nur für „Kosten“ (weil dort eine Handlung fehlt), hier gibt es überall eine.
- **Abgrenzung:** Reiter „Verlauf“ = R00123/I0113 (Karte #119), Reiter „Kosten“ = R00105/I0093 — beide hier nicht neu definiert. „Zuständig“ und die Felder als Menü (Betreiber-Hinweis, kanbanflow) sind **nicht** Teil dieser Anforderung: hier ziehen die Felder nur als Block in einen Reiter um, ihre Gestalt bleibt; die Umstellung auf Menüs ist eine spätere Neugestaltung (Offene Frage 1, Folgekarte).
