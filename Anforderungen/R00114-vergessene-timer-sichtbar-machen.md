---
id: R00114
status: Neu
datum: 2026-11-10
---

# R00114: Vergessene Timer sichtbar machen

## Beschreibung

Wer einen Timer laufen ließ, sieht heute nur, dass er läuft: drei Timer laufen seit 143 Stunden, und Karte wie Seite Personen zeigen weiter einen harmlosen Chip „143:10:23“ beziehungsweise „Woche 137:25“ (Karte #15, Sollte aus der UX-Durchsicht vom 2026-10-31). Nach dieser Anforderung kennzeichnet die Oberfläche jeden sichtbaren Timer, der länger als zehn Stunden läuft, und nennt die Dauer in Worten: sichtbar kurz „seit 6 Tagen“, im zugänglichen Namen der Karte voll „Timer läuft seit 6 Tagen“. Wer den eigenen Timer vergessen hat, bekommt einmal je Tab und Timer einen Hinweis mit der Aktion „Zeit korrigieren“, die den vorhandenen Zeit-Editor auf genau diesem Eintrag öffnet.

„Vergessen“ ist eine Aussage der Anzeige, nicht des Datenbestands (ADR-0019): nichts wird in die Aufgabe geschrieben, kein Endpunkt kommt hinzu, kein Dateiformat ändert sich.

Nicht Teil: das Kappen von Summen — „Woche 137:25“ bleibt die Folge des vergessenen Timers, keine Rechenfehlerkorrektur (ADR-0019 Konsequenzen, R00021); eine einstellbare Schwelle; eine Sicht für Agenten; eine Eigentümerregel für Zeiteinträge (PO Z. 183, geschlossen).

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiterfassung, die zum Arbeiten passt“ (ein Timer, der sich ohne Umstand starten und stoppen lässt) und „Live überall“: die Markierung erscheint ohne Neuladen, und der Zustand ist nirgends gespeichert, was der Leitplanke „Die Dateien sind der einzige Speicher“ folgt. Leitplanke „Jede Gestaltung wird freigegeben, bevor sie gebaut wird“: der Chip besteht, seine Form bleibt; neu sind eine Farbrolle als Paar und ein Text, der bei Platzmangel in eine eigene Zeile der Kopfzeile umbricht (PO Z. 184, kein Artboard, Fotos auf dem Abnahmezettel).

### Domänenbezug
- [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md)
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)

## Geschäftlicher Nutzen

Ein vergessener Timer verfälscht die Zeiten und die Berichte: die Wochensumme der Person, das Σ an der Karte, der Stundenzettel. Heute fällt das nur auf, wenn jemand die Zahl „143:10:23“ liest und selbst rechnet. Mit der Markierung sieht man es auf einen Blick, an jeder Stelle, an der ein Timer steht; mit der Aktion ist der Eintrag in zwei Klicks korrigiert, statt ihn im Aufgabenfenster zu suchen und den richtigen Eintrag zu treffen. Weil die Aktion den vorhandenen Editor öffnet, bleibt jede Korrektur eine gewöhnliche, committete Aktion.

## Funktionale Anforderungen

### Schwelle und Dauertext (ADR-0019 Regeln 1, 2)

1. Ein laufender Zeiteintrag gilt als vergessen, wenn seine Laufzeit zehn Stunden erreicht. Laufzeit ist der Abstand von `laufBeginn` bis jetzt (Datei-Minute, für in diesem Browser gestartete Timer die gemerkte Startsekunde — dieselbe Basis, die heute den Chip füllt). Ein unbekannter Beginn gilt als nicht vergessen.
2. Schwelle und Prädikat stehen genau einmal in `web/zeiten.js`; kein zweiter Vergleich in `web/ansicht.js`, `web/berichte.js` oder `web/app.js`. Nach dem Muster von R00068: Konstante und reine Funktion nebeneinander, Grenze als Unit-Test.
3. Die Dauer im Wort bildet `web/kultur.js` (ADR-0013) als `seitText(ms)` → „seit 6 Tagen“, monoton und ohne Sonderfall: unter 48 Stunden abgerundete Stunden („seit <n> Stunden“, bei genau einer Stunde „seit 1 Stunde“), ab 48 Stunden kaufmännisch gerundete Tage („seit <n> Tagen“, 48 h → „seit 2 Tagen“). Die Einzahl „1 Tag“ ist nicht erreichbar, weil Tage erst ab 48 Stunden erscheinen, und gehört nicht zum Vertrag. Rechenbeispiele: 90 min → „seit 1 Stunde“, 10:00:00 → „seit 10 Stunden“, 25 h → „seit 25 Stunden“, 47:59:59 → „seit 47 Stunden“, 48:00:00 → „seit 2 Tagen“, 143:10:23 → „seit 6 Tagen“, 30 Tage → „seit 30 Tagen“.
4. Der Zustand wird beim Zeichnen aus Zeit und Stand entschieden — nicht am DOM-Knoten, nicht im Server. Dieselbe Entscheidung gilt an allen fünf Zeichenstellen (FA 5).

### Zeigen (ADR-0019 Regeln 2, 6)

5. An allen fünf Stellen, an denen heute ein laufender Timer gezeichnet wird — Karte, Fensterblock „LÄUFT GERADE“, Zeile der Zeittabelle, Pop „Läuft gerade“, Zeile der Seite Personen —, trägt der Laufchip eines vergessenen Timers eine eigene Klasse (`vergessen`) und den kurzen Text aus FA 3. **Die Zahl weicht dem Satz**: im vergessenen Zustand zeigt der Chip „seit 6 Tagen“ statt „143:10:23“, und auf der Karte entfällt auch das Zähler-Präfix „2×“ (Breite, FA 12). Der Text läuft mit: wechselt der Tag, steht dort „seit 7 Tagen“, ohne dass die Seite neu lädt.
6. Der Zähler in der Kopfzeile (`#t-lauf`) bleibt ein Zähler: er nennt weiter nur die Zahl der laufenden Timer.
7. Jeder sichtbare vergessene Timer wird markiert, auch ein fremder (PO Z. 182). Eigen und fremd unterscheiden sich allein durch die Aktion im Hinweis (FA 15), nicht durch die Markierung.
8. Die Markierung hängt an einer Farbrolle, die als Paar (Fläche und Schrift) in `web/kd-tokens.css` für hell und beide dunklen Blöcke steht und die Kontrastprobe besteht (ADR-0011); kein Farbwert außerhalb der Tokens. Der Punkt vor dem Text (`::before`, heute 6 × 6 px) erreicht mindestens 3:1 gegen die Fehlerfläche. Ob das Paar nach Material 3 `error-container`/`on-error-container` heißt, entscheiden die UX-Rollen; die Tokennamen sind deutsch, die M3-Rolle steht als Kommentar dabei.

### Karte und Name (ADR-0019 Regel 2; ADR-0018/X00005)

9. Der zugängliche Name des Listeneintrags einer Karte trägt bei vergessenem Timer den Zusatz „Timer läuft seit 6 Tagen“, gestellt vor „ausgewählt“. Reihenfolge: „#<nr> <Titel>[, <Klasse>][, Timer läuft seit <Dauer>][, ausgewählt]“; fehlende Teile fallen samt Komma weg. Die Dauer im Namen ist dieselbe wie am Chip (FA 3), also „Timer läuft seit 25 Stunden“ unter 48 Stunden und „Timer läuft seit 2 Tagen“ ab 48 Stunden; „Timer läuft seit 1 Tag“ gibt es nicht, weil Tage erst ab 48 Stunden erscheinen.
10. Der Chip selbst ist kein Bedienelement, nicht per Tab erreichbar und trägt keinen eigenen zugänglichen Namen: der Name des Listeneintrags ist die eine Stelle. (Ein `aria-label` an einem `span` ohne benennbare Rolle ist nach ARIA 1.2 wirkungslos und wäre keine Erfüllung.) Der Tastaturweg zur Korrektur bleibt der vorhandene ✎-Knopf der Zeile in der Zeittabelle und der Knopf im Hinweis; am Chip ändert sich nichts.
11. Unterhalb der Schwelle bleibt das Markup an allen fünf Stellen wie heute (Zahl, `2×`-Präfix, keine Klasse, kein Text, kein Namenszusatz).

### Karte und schmale Breite (UX-Vorprüfung M1, M2)

12. Auf der Karte bleibt der Titel des Listeneintrags vollständig lesbar und mindestens 90 px breit, der Chip liegt ganz im Kartenrechteck, und die Karte bleibt im Rechteck ihrer Spalte (kein Querscrollen, kein Überlauf in die Nachbarspalte) — bei 1280, 414 und 320 px, mit einem und mit zwei laufenden Timern. Reicht der Platz in der Kopfzeile nicht, bricht sie um: der Chip steht dann in einer eigenen Zeile unter dem Titel (M1). Die 90 px hält die Karte selbst (Titel mit Mindestbreite, Umbruch nur an der vergessenen Karte); gemessene Werte in „Gestaltung“.
13. Bei 320 px scrollen der Körper des Aufgabenfensters und der Pop „Läuft gerade“ nicht waagrecht (`scrollWidth ≤ clientWidth`); der Chip ist ganz sichtbar oder sein Text bricht um. Die Personentabelle darf in ihrem benannten Rahmen scrollen (PO Z. 138).

### Erinnern und handeln (ADR-0019 Regeln 3–5)

14. Überschreitet ein Timer die Schwelle bei offenem Tab, oder ist er beim Öffnen des Tabs bereits darüber und dem Takt noch unbekannt, entsteht ein Hinweis (Sichtzustand `S.ui.hinweis`, D00007) mit dem Text „Timer von <Name> zu #<nr> läuft seit <Dauer>“. Überschreiten mehrere Timer im selben Takt, steht zuerst der eigene, danach die fremden.
15. Die Aktion „Zeit korrigieren“ bietet nur der eigene Eintrag an, also der, dessen Person die im Tab gewählte Identität ist (PO Z. 182). Ohne gewählte Identität erscheint der Hinweis ohne Aktion und nennt den nächsten Schritt: „… — wähle „Ich bin …““. Ein fremder Timer wird markiert, sein Hinweis bietet keine Aktion. Der vorhandene ✎-Knopf der Zeittabelle bleibt unberührt.
16. Ein Hinweis zeigt nie zwei Aktionen: solange `undo` gesetzt ist, wird keine `aktion` gezeichnet, und umgekehrt (PO-/UX-Regel; D00007 führt höchstens ein Rückgängig). Die Aktion ist ein Textknopf neben dem vorhandenen „rückgängig“; Strg+Z bleibt ausschließlich „rückgängig“ und löst die Aktion nie aus.
17. Steht beim Übergang ein Hinweis mit „rückgängig“, bleibt dieser samt Knopf bis zum Ablauf unverändert, und Strg+Z macht weiter diese Aktion rückgängig. Die Erinnerung erscheint frühestens nach seinem Ablauf, dann genau einmal.
18. Erinnert wird je Tab und Timer höchstens einmal **mit Aktion**; ein knopfloser Hinweis zählt nicht als endgültig erinnert, solange keine Identität gewählt war. Gemerkt wird der Schlüssel `nr|wer|<Identität>`; wählt jemand danach die Identität des Eintrags, erscheint binnen einer Sekunde genau ein neuer Hinweis mit Aktion (M4). Im Hintergrund-Tab entsteht kein Hinweis: der Übergang wird beim Sichtbarwerden nachgeholt. Der gemerkte Stand wird bereinigt, sobald der Timer verschwindet (gestoppt, gelöscht, korrigiert, archiviert).
19. „Zeit korrigieren“ öffnet die Aufgabe des Eintrags, wechselt auf den Reiter Inhalt und setzt danach den vorhandenen Zeit-Editor auf genau diesen Eintrag; der Fokus liegt im Feld Beginn. Gespeichert wird über den vorhandenen Weg (Korrektur des Eintrags), ein Fehler erscheint wie heute im Fensterfuß. Ist der Eintrag inzwischen fort, öffnet die Aktion nur das Fenster und meldet im Fuß, dass der Zeiteintrag nicht mehr da ist (kein Editor, kein Fehler in der Konsole). Kein zweiter Editor, kein neuer Endpunkt.
20. Bei 320 px und Touch liegt der Hinweis ganz im sichtbaren Bereich, die Seite scrollt nicht waagrecht, der Knopf ist vollständig sichtbar (`scrollWidth ≤ clientWidth` am Knopf), misst mindestens 44 × 44 px und ist der einzige Knopf im Hinweis (M5).
21. Nichts wird dafür in `boards/*.md`, `aufgaben/*.md`, `localStorage` oder `sessionStorage` geschrieben. Nach einem Neuladen erinnert derselbe Timer erneut — das ist gewollt und kein Befund (ADR-0019 Konsequenzen).

### Takt (ADR-0019 Regel 3)

22. Der vorhandene Sekundentakt (`web/app.js:2469–2480`) erkennt je laufendem Timer den Übergang „nicht vergessen → vergessen“ und zeichnet genau einmal neu, im vorhandenen Tor (`zug == null && !S.ui.neu`, `:2477`). Steht ein Zug oder „Neue Aufgabe“ offen, unterbleibt das Zeichnen und der Übergang wird beim nächsten Takt nachgeholt. Kein Neuzeichnen je Sekunde.
23. Der Takt schreibt weiter nur Text fort: die Zahl der nicht vergessenen Timer wie heute (`[data-since]`), den Satz der vergessenen über dieselbe Kulturfunktion (`[data-since]` mit `data-fmt="seit"`). Der Tageswechsel ändert den Satz ohne Neuzeichnen und ohne Zustandswechsel.
24. Der Übergang „vergessen → nicht vergessen“ (Timer gestoppt, gelöscht, korrigiert) entsteht durch die Aktion selbst und ihr eigenes Neuzeichnen; der Takt muss ihn nicht melden. Zusehen schreibt nichts: kein Commit, keine Dateiänderung.

## Nicht-funktionale Anforderungen

1. **Ein Zeitgeber**: höchstens ein Neuzeichnen je Überschreitung und Timer; der Text läuft ohne Neuzeichnen weiter (Wächter über den Render-Zähler der Testschnittstelle).
2. **Barrierefreiheit**: Der Zustand hängt nicht an der Farbe allein — der Name des Listeneintrags nennt ihn (FA 9). Schrift auf der Chip-Fläche mindestens 4,5:1, Punkt mindestens 3:1, in Hell und Dunkel (ADR-0011, Kontrastprobe). Der Hinweis bleibt `role="status"`, nimmt keinen Fokus, die Aktion ist per Tastatur erreichbar und hat die Trefferfläche nach ADR-0012.
3. **Breite**: Bei 320 px scrollt die Seite nicht quer (ADR-0015); Chip und Hinweis brechen um, der Text wird nie abgeschnitten (FA 12, 13, 20).
4. **Rückwärtskompatibel**: keine Änderung an API, Dateiformat, Commit-Texten oder Summen (R00021); Aufrufe und Antworten wie heute.
5. **Eine Schwelle**: `grep -n "3600e3\|VERGESSEN" web/*.js` findet die Konstante nur in `web/zeiten.js`.
6. **Kein Rauschen**: kein Schreibzugriff aus dem Takt; die Git-Geschichte des Ordners bleibt beim Zusehen unverändert.

## Akzeptanzkriterien

Geprüft mit dem Grundbestand aus `user-stories/R00114.md`; „Uhr“ ist `page.clock`, „Hinweis“ der `.toast` mit `role="status"`.

- [ ] **1. Abnahme-Probe der Karte #15 (wörtlich)**: „Ein Timer über der Schwelle trägt eine eigene Klasse bzw. ein `aria-label` mit „läuft seit“; der Hinweis bietet eine Aktion, die den Zeiteintrag zum Bearbeiten öffnet.“
  - Ergänzungen des planers, als beobachtbare Prüfungen: Der sichtbare Chip trägt „seit 6 Tagen“, der Name des Listeneintrags „Timer läuft seit 6 Tagen“; ein `aria-label` am Chip selbst ist keine Erfüllung, weil der Name des Listeneintrags das Innere ersetzt.
  - Besteht: `.ka[data-id="1"] .lauf.vergessen` mit Text „seit 6 Tagen“; `getByRole('listitem', { name: /Timer läuft seit 6 Tagen/ })` trifft #1; der Hinweis zeigt `[data-act="zeit-korrigieren"]`, und ein Klick öffnet die Zeile des Eintrags in Bearbeitung mit dem Fokus in „Beginn“.
  - Fällt durch: nur eine Farbe ohne Text; Klasse ohne Namen am Listeneintrag; Hinweis ohne Aktion; Aktion öffnet nur das Fenster ohne Editor.
  - Prüfebene: E2E `r00114-vergessene-timer.spec.js` US-1, US-6.
- [ ] **2. Die Grenze**: Bei 9:59:59 trägt der Chip weder Klasse noch Text, der Name keinen Zusatz, und das Markup ist an allen fünf Stellen wie heute; bei 10:00:00 trägt er beides. Bei 30 Tagen Laufzeit steht „seit 30 Tagen“, bei 25 h „seit 25 Stunden“. Ein Eintrag ohne lesbaren Beginn gilt im Unit-Test nicht als vergessen.
  - Besteht: Unit-Test der Grenze mit der Konstante aus `web/zeiten.js` (nicht als Zahl im Test) und dieselben drei Fälle im E2E.
  - Fällt durch: 10:00:00 noch ohne Markierung; 9:59:59 schon markiert; zweite Zahl 3600e3 außerhalb `zeiten.js`.
  - Prüfebene: Unit `e2e/einheit/zeiten.test.js`; E2E US-2.
- [ ] **3. Dauertext, monoton ohne Sonderfall**: 90 min (Unit-Grenzfall der Funktion) → „seit 1 Stunde“; 10:00:00 → „seit 10 Stunden“; 25 h → „seit 25 Stunden“; 35 h → „seit 35 Stunden“; 36 h → „seit 36 Stunden“; 47:59:59 → „seit 47 Stunden“; 48:00:00 → „seit 2 Tagen“; 143:10:23 → „seit 6 Tagen“; 30 Tage → „seit 30 Tagen“. Im Namen steht davor „Timer läuft “.
  - Besteht: je Fall die Unit-Erwartung in `web/kultur.js`; im E2E mindestens die beiden Fälle aus der Karte (143:10:23 → „seit 6 Tagen“, 10:00:00 → „seit 10 Stunden“).
  - Fällt durch: „143 Stunden“; „5 Tagen“ bei 143:10; „1 Stunden“; „seit 1 Tag“ bei 25 oder 35 h; ein Sprung von „1 Tag“ (35 h) auf „36 Stunden“ (36 h), also jede nicht monotone Folge.
  - Prüfebene: Unit `e2e/einheit/kultur.test.js`; E2E US-1, US-2.
- [ ] **4. Alle fünf Zeichenstellen, Zähler bleibt Zähler**: Derselbe vergessene Timer trägt auf der Karte, im Fensterblock „LÄUFT GERADE“, in der Zeile der Zeittabelle, im Pop „Läuft gerade“ und auf der Seite Personen dieselbe Klasse und denselben Text „seit 6 Tagen“; statt der Zahl steht überall der Satz; der Zähler `#t-lauf` nennt weiter nur die Zahl. Unterhalb der Schwelle zeigt keine der fünf Stellen etwas Neues.
  - Besteht: an jeder der fünf Stellen ein Treffer für `.lauf.vergessen` mit demselben Text und ohne Ziffernfolge der Dauer; `#t-lauf` unverändert; Gegenprobe mit einem Timer bei 9:59 liefert an keiner Stelle einen Treffer.
  - Fällt durch: eine Stelle ohne Markierung; Markierung am Zähler; unterschiedliche Texte; Zahl und Satz nebeneinander.
  - Prüfebene: E2E US-7.
- [ ] **5. Name und Auswahl**: Bei vergessenem Timer heißt der Eintrag „#1 eins, Fehler, Timer läuft seit 6 Tagen“; ist #1 zusätzlich ausgewählt, endet der Name auf „, ausgewählt“; ohne Klasse fehlt der Klassenteil samt Komma; unterhalb der Schwelle lautet der Name wie heute. Der Chip ist nicht per Tab erreichbar; der Tastaturweg zur Korrektur ist der ✎-Knopf der Zeile.
  - Besteht: Unit-Test der reinen Namensfunktion mit allen vier Fällen; E2E liest den Namen über die Rolle; Tab erreicht den Chip nicht, erreicht aber den ✎-Knopf.
  - Fällt durch: Zusatz hinter „ausgewählt“; doppeltes Komma; ein `aria-label` am Chip als einziger Träger.
  - Prüfebene: Unit `e2e/einheit/kartenname.test.js`; E2E US-1, US-3.
- [ ] **6. Fremder Timer markiert, ohne Aktion**: Claudes Timer über der Schwelle trägt an allen Stellen Klasse und Text; sein Hinweis bietet keinen Knopf. Ohne gewählte Identität erscheint der Hinweis ebenfalls ohne Knopf und nennt „wähle „Ich bin …““.
  - Besteht: Markierung vorhanden; `.toast` ohne `[data-act="zeit-korrigieren"]`; der Text des knopflosen Hinweises enthält den nächsten Schritt; Markierung unabhängig von der Identitätswahl.
  - Fällt durch: fremder Timer ohne Markierung; Aktion an fremder Zeit; knopfloser Hinweis ohne nächsten Schritt.
  - Prüfebene: E2E US-3, US-4.
- [ ] **7. Identitätswahl holt die Erinnerung mit Aktion nach (M4)**: Ohne gewählte Identität steht der Hinweis ohne Knopf. Wähle ich im Kopf „Ich bin …“ Stefan, erscheint binnen einer Sekunde genau ein Hinweis „Timer von Stefan zu #1 läuft seit 6 Tagen“ mit „Zeit korrigieren“; der vorherige wird ersetzt; der Klick öffnet #1 auf dem Reiter Inhalt, die Zeile von Stefans Eintrag steht in Bearbeitung, der Fokus liegt in „Beginn“. Bleibt die Identität ungewählt, bleibt der Hinweis ohne Knopf.
  - Besteht: nach der Wahl genau ein neuer Hinweis mit Knopf; kein zweiter in den folgenden 10 s; mit ungewählter Identität kein Knopf.
  - Fällt durch: kein neuer Hinweis nach der Wahl; Hinweis mit Knopf ohne Identität; zwei Hinweise.
  - Prüfebene: E2E US-5.
- [ ] **8. Die Aktion öffnet genau diesen Eintrag**: #1 trägt zwei laufende Einträge, Stefans vergessenen und Claudes kurzen. Klick auf „Zeit korrigieren“ → Fenster von #1, Reiter Inhalt, die Zeile von Stefans Eintrag steht in Bearbeitung, der Fokus liegt in „Beginn“; Ändern des Beginns und Enter schreibt die Datei und ergibt genau einen Commit mit dem heutigen Text der Korrektur. Ist der Eintrag zwischenzeitlich gestoppt und gelöscht, öffnet die Aktion nur das Fenster und der Fuß sagt, dass der Eintrag nicht mehr da ist.
  - Besteht: `document.activeElement` ist `#z-beginn`; die bearbeitete Zeile trägt die Kennung von Stefans Eintrag; ein neuer Commit; im zweiten Fall keine Editorzeile, Fußmeldung, kein Commit.
  - Fällt durch: Fenster ohne Editor (Reihenfolge `oeffnen` löscht den Editor); falscher Eintrag; kein oder zwei Commits; stiller Nichtstun beim verschwundenen Eintrag.
  - Prüfebene: E2E US-6; der Editor-Weg selbst ist durch `r00015-zeiten.spec.js` gedeckt.
- [ ] **9. Nie zwei Aktionen, Strg+Z bleibt Rückgängig (M3)**: Steht ein Hinweis mit „rückgängig“, wird keine Aktion gezeichnet, auch wenn ein Timer im selben Moment die Schwelle überschreitet; Strg+Z macht weiter genau diese Aktion rückgängig. Die Erinnerung erscheint frühestens nach dem Ablauf des Hinweises und dann genau einmal.
  - Besteht: `.toast` mit `[data-act=rueckgaengig]` und ohne `[data-act=zeit-korrigieren]`; nach 12 s genau ein Erinnerungshinweis; `r00031-rueckgaengig.spec.js` und `r00112-rueckgaengig.spec.js` grün.
  - Fällt durch: zwei Knöpfe in einem Hinweis; Erinnerung ersetzt den Rückgängig-Hinweis; Erinnerung geht verloren; Strg+Z löst die Aktion aus.
  - Prüfebene: E2E US-8; die Rückgängig-Specs laufen mit.
- [ ] **10. Einmal je Tab, kein Schreiben**: Ein Timer überschreitet die Schwelle → genau ein Hinweis. 12 s später (Uhr vorgestellt, ohne neue Aktion) steht kein zweiter Hinweis. Ein frisch geöffneter Tab mit demselben, bereits vergessenen Timer erinnert erneut genau einmal (gewollt, ADR-0019). Im Hintergrund-Tab entsteht kein Hinweis; beim Sichtbarwerden erscheint er genau einmal. Während 60 s Zusehen entsteht kein Commit. Wird der Timer gestoppt und ein neuer bis über die Schwelle gefahren, erinnert der neue Übergang wieder genau einmal.
  - Besteht: ein Hinweis je Übergang; `git log` unverändert beim Zusehen; nach Stopp und neuem Übergang wieder genau ein Hinweis.
  - Fällt durch: Hinweis je Sekunde; zweiter Hinweis für denselben Timer; Hinweis im verborgenen Tab; ein Commit ohne Aktion.
  - Prüfebene: E2E US-8.
- [ ] **11. Ein Neuzeichnen je Überschreitung**: Mit laufendem Timer unter der Schwelle steigt `kdTest.renders()` über mehrere Sekunden nicht; beim Überschreiten steigt er genau einmal; der Text im Chip läuft dabei weiter, auch über einen Tageswechsel („seit 6 Tagen“ → „seit 7 Tagen“), ohne ein weiteres Neuzeichnen.
  - Besteht: Render-Zähler konstant, dann genau +1; Text fortschreitend; Tageswechsel ohne +1.
  - Fällt durch: +1 je Sekunde; +1 je Tag; kein Neuzeichnen (Markierung erscheint nicht).
  - Prüfebene: E2E US-2.
- [ ] **12. Karte: Titel bleibt lesbar (M1)**: Bei 1280, 414 und 320 px, mit einem und mit zwei laufenden Timern, eigenem und fremdem Timer: der Titel des Listeneintrags ist vollständig lesbar und mindestens 90 px breit, der Chip liegt ganz im Kartenrechteck (`chip.right ≤ ka.right`, `chip.bottom ≤ ka.bottom`), die Karte bleibt im Rechteck ihrer Spalte (`ka.right ≤ flaeche.right`) und die Spalte scrollt nicht waagrecht. Reicht der Platz in der Kopfzeile nicht, steht der Chip in einer eigenen Zeile unter dem Titel.
  - Besteht: gemessene Titelbreite ≥ 90 px in allen acht Fällen; Chip im Kartenrechteck; Karte in der Spalte; kein Querscrollen; Chip überlappt den Titel nie.
  - Fällt durch: Titel unter 90 px (heute gemessen: 75 px eigen, 103 px fremd bei 1280, mit dem Satz in der Zeile nur 54/82); Chip ragt heraus; Karte wächst über die Spalte (mit dem vollen Satz gemessen: Karte 336 px in einer 272-px-Spalte).
  - Gegenprobe: der volle Satz „läuft seit 6 Tagen“ mit Zahl (Chip 216 px) macht US-1 bei 1280 rot.
  - Prüfebene: E2E US-1.
- [ ] **13. Aufgabenfenster und Pop ohne Querscrollen (M2)**: Bei 320 px mit offenem Aufgabenfenster von #1 und offenem Pop „Läuft gerade“ scrollen der Körper des Fensters und der Pop nicht waagrecht (`scrollWidth ≤ clientWidth`), der Chip ist ganz sichtbar oder sein Text bricht um, und die Aktion im Hinweis liegt ganz im Bild. Die Personentabelle scrollt nur in ihrem benannten Rahmen (`[role=group][aria-label=Personen]`).
  - Besteht: beide Behälter ohne Querscrollen; Aktion im Bild; Personen-Rahmen darf `scrollWidth > clientWidth` haben, die Seite nicht.
  - Fällt durch: Querscrollen in Fensterkörper oder Pop; abgeschnittene Aktion; Querscrollen der Seite auf der Personen-Seite.
  - Prüfebene: E2E US-7 (`ziele.spec.js`-Muster).
- [ ] **14. Hinweis bei 320 px berührbar (M5)**: Ein Hinweis „Timer von Maximiliane Mustermann zu #1 läuft seit 6 Tagen“ mit „Zeit korrigieren“ erscheint bei 320 px und Touch: sein Rechteck liegt ganz im sichtbaren Bereich, der Knopf ist vollständig sichtbar (`scrollWidth ≤ clientWidth` am Knopf), sein Ziel misst mindestens 44 × 44 px, die Seite scrollt nicht waagrecht, und der Hinweis trägt genau einen Knopf.
  - Besteht: Rechteck im Viewport; Knopfmaß ≥ 44 × 44; genau ein `[data-act]` im Hinweis; `scrollWidth ≤ clientWidth` an Seite und Knopf.
  - Fällt durch: Knopf abgeschnitten; Ziel unter 44 px; zwei Knöpfe; Querscrollen.
  - Prüfebene: E2E US-8 (`ziele.spec.js`-Muster).
- [ ] **15. Farbe als Paar**: Die Schrift des Chips erreicht auf seiner Fläche mindestens 4,5:1, der Punkt mindestens 3:1, in Hell und in beiden dunklen Zuständen; kein Farbwert außerhalb der Tokens.
  - Besteht: Kontrastprobe grün (Schrift und Punkt).
  - Fällt durch: ein Farbwert außerhalb der Tokens; Schrift oder Punkt unter dem Maß.
  - Prüfebene: `e2e/einheit/kontrast.test.js`, `e2e/tests/kontrast.spec.js`.

## Betroffene Verzeichnisstruktur

```
web/
├── zeiten.js        # Schwelle und Prädikat (reines Modul, Browser und Node)
├── kultur.js        # „seit 6 Tagen“ (ADR-0013)
├── kartenname.js    # Zusatz im zugänglichen Namen der Karte
├── ansicht.js       # Chip an fünf Stellen, Name, Aktion im Hinweis
├── app.js           # Kante im Sekundentakt, Aktion zeit-korrigieren, Sichtzustand
├── kd-base.css      # .lauf und .lauf.vergessen (Fläche, Schrift, Punkt)
├── kd-tokens.css    # Token-Paar hell und beide dunklen Blöcke
└── kd-app.css       # Kopfzeile der vergessenen Karte (Umbruch), Hinweis
e2e/
├── einheit/         # zeiten.test.js, kultur.test.js, kartenname.test.js, kontrast.test.js
└── tests/           # r00114-vergessene-timer.spec.js (neu); r00014, r00015, r00021, r00031, r00112, kultur, ziele, kontrast laufen mit
```

Kein Server, kein Format, keine Migration.

## Technische Überlegungen

Nach ADR-0019 (Akzeptiert); Baustein A00009 (Oberfläche) trägt die Soll-Notizen. Stand des Codes, an dem die Zeilen geprüft wurden: `5660210`; PO-Entscheidungen Z. 182–184 (`ad56896`); UX-Vorprüfung 2026-11-10.

### Ablauf

1. **Beim Zeichnen** (`render()` → `vKarte`, `vFensterSeite`, `vZeiten`, `vLaufPop`, `vPersonen`):
   - 1.1 Laufzeit je laufendem Eintrag aus `laufBeginn(a, z)` (`web/ansicht.js:380`) bis jetzt.
   - 1.2 Prädikat aus `web/zeiten.js`; wahr → Chip mit Klasse `vergessen` und `seitText` aus `web/kultur.js` statt der Zahl.
   - 1.3 Auf der Karte zusätzlich der Name über `kartenName(…, zusatz)` mit „Timer läuft “ + `seitText`.
2. **Im Sekundentakt** (`web/app.js:2469–2480`, jede Sekunde):
   - 2.1 Textfortschreibung wie heute (`[data-since]`); bei `data-fmt="seit"` schreibt sie `seitText` statt der Zahl.
   - 2.2 Je laufendem Timer das Prädikat; Schlüssel `nr|wer` in der Menge der gesehenen.
   - 2.3 Übergang falsch → wahr: Schlüssel merken; ist der Tab verborgen, nichts weiter (beim Sichtbarwerden nachgeholt); sonst Erinnerung anfordern.
   - 2.4 Erinnerung anfordern heißt: zeigt der Hinweis gerade „rückgängig“, warten, bis er abgelaufen ist (FA 17); sonst Hinweis setzen, eigener Timer zuerst.
3. **Klick auf „Zeit korrigieren“** (`web/app.js`):
   - 3.1 `u.pop = null`, `u.offen = nr`, `u.tab = 'inhalt'`, `dateiLaden()` abwarten — der Fall `oeffnen` (`:1042`) löscht `u.zeitEdit`, deshalb danach.
   - 3.2 Eintrag vorhanden → `u.zeitEdit = kennung`, `u.fokus = '#z-beginn'`, zeichnen; sonst Fußmeldung „Der Zeiteintrag ist nicht mehr da“, kein Editor.
   - 3.3 Speichern läuft über `zeit-ok` → `PATCH …/zeiten/{kennung}` (`:1430–1432`), ein Commit; Fehler im Fensterfuß wie heute.

### Grobentwurf

- `web/zeiten.js` (reines Modul, `Object.assign` am Ende wie heute):
  - `VERGESSEN_MS` (Konstante, 10 h) und `istVergessen(laufzeitMs)` — `true`, wenn Laufzeit ≥ Konstante; `null`/unbekannt → `false`.
- `web/kultur.js` (reines Modul):
  - `seitText(ms)` — „seit 10 Stunden“ / „seit 6 Tagen“ nach FA 3, monoton und ohne Sonderfall; Einzahl nur bei Stunden („seit 1 Stunde“), „seit 1 Tag“ ist nicht erreichbar. Die Vollform im Namen entsteht als `Timer läuft ${seitText(ms)}` in `ansicht.js` (keine zweite Kulturregel).
- `web/kartenname.js`:
  - `kartenName({ nummer, titel, klasse }, klassen, gewaehlt, zusatz)` — `zusatz` leer lässt den Namen wie heute; gesetzt steht er vor „ausgewählt“.
- `web/ansicht.js`:
  - `vLaufChip(a, z, jetzt)` — eine Stelle für Klasse, `seitText`/Zahl und `[data-since]`, von Karte, Fensterblock, Zeittabelle, Pop und Personen aufgerufen; der Zähler in der Kopfzeile ruft sie nicht.
  - `vKarte`: Zusatz für `kartenName` aus derselben Entscheidung; im vergessenen Zustand ohne `2×`-Präfix; die Karte trägt dann die Klasse `vergessen`, damit der Umbruch der Kopfzeile nur dort greift.
  - `vHinweisInhalt`: `t.aktion` nur, wenn `t.undo` leer ist; Knopfloser Text mit „wähle „Ich bin …““.
- `web/app.js`:
  - `S.ui` bekommt die Menge der erinnerten Schlüssel `nr|wer|<Identität>` und eine wartende Erinnerung; kein Speicher außerhalb der Sitzung.
  - `case 'zeit-korrigieren'`: `arg` als `nr|kennung` zerlegen, Ablauf 3.
  - Sekundentakt: Schritt 2.2–2.4, eigener Timer zuerst.
- `web/kd-base.css`: `.lauf.vergessen` setzt Fläche, Schrift und Punktfarbe aus dem Paar; `.lauf` behält Maße, Polster, Punktgröße.
- `web/kd-tokens.css`: Paar `--kd-fehler-flaeche` / `--kd-fehler-text` in `:root` und in beiden dunklen Blöcken (`@media prefers-color-scheme: dark` und `[data-theme=dark]`); Kommentar nennt die M3-Rolle `error-container`/`on-error-container`.
- `web/kd-app.css`: `.ka.vergessen .r0 { flex-wrap: wrap }` und `.ka.vergessen .r0 .t { min-width: 90px }` (Umbruch nur an der vergessenen Karte); der Hinweis nutzt den vorhandenen Umbruch (ADR-0015).

### Änderungen an bestehenden Klassen

- `vKarte`, `vFensterSeite`, `vZeiten`, `vLaufPop`, `vPersonen`: Chip über den gemeinsamen Helfer; sonst unverändert.
- `kartenName`: vierter Parameter; alle Aufrufstellen (Karte, defekte Karte, fehlende Aufgabe bleiben ohne Zusatz) angepasst.
- Sekundentakt: zwei Zustandsänderungen mehr (`neu`, Menge), eine Textform mehr (`seit`), kein neuer Zeitgeber.
- `act`-Verteiler: ein Fall `zeit-korrigieren`; keine Änderung an `rueckgaengig` oder an der Tastenprüfung für Strg+Z.

### Gestaltung

**Der Chip ist nicht ungestaltet** (Korrektur der ersten Fassung, UX-Vorprüfung): `.lauf` steht in `web/kd-base.css:39–41` — 18 px hoch, Polster 0 5 px, Mono 11 px, Fläche `--kd-agent-weak`, Schrift `--kd-agent-ink`, Punkt 6 × 6 px mit 4 px Lücke, `white-space: nowrap`; `.lauf.eigen` in `--kd-accent`/`--kd-on-accent` (Zeile 41). Die Karte stellt den Chip in `.r0 .ecke` (`margin-left:auto`, `gap:4px`, `web/kd-app.css:624`), der Titel ist `.r0 .t` mit `flex:1; min-width:0` (`:140`).

Gemessen am 2026-11-10 in der laufenden Instanz (Port 7422, Chromium headless, Karte mit Signal und eigenem Timer; Karteninhalt 249 px; zusätzlich zum Titel stehen in `.r0` die Nummer (21 px), das Signal (22 px) und die Ecke mit Chip und Stopp-Knopf (19 px); Modellrechnung mit Mono 0,6 em × 11 px trifft die UX-Zahl 205 px genau):

| Chipinhalt | Zeichen | Chip gemessen | Titel eigen / fremd (1280) | ≥ 90 px? |
|---|---|---|---|---|
| heute „143:10:23“ | 9 | 83 px | 75 / 103 | nein (Bestand) |
| „läuft seit 6 Tagen“ + „143:10:23“ | 30 | 216 px | 11 / 11, Karte wächst auf 336 px in 272 px | **nein**, Überlauf |
| „seit 6 Tagen“ in der Kopfzeile | 12 | 104 px | 54 / 82 | **nein** |
| „2× seit 6 Tagen“ | 15 | 125 px | 33 / 61 | **nein** |
| „seit 6 Tagen“, Kopfzeile bricht um | 12 | 104 px, eigene Zeile | 192 / 192 (414 px: 168 / 196; 320 px: 212 / 102) | ja |

Entscheidung daraus: sichtbar **„seit 6 Tagen“ ohne Zahl und ohne „2×“-Präfix**, im Namen voll „Timer läuft seit 6 Tagen“ — und, wo die Kopfzeile den Titel unter 90 px drückte, **bricht die Kopfzeile um und der Chip steht in einer eigenen Zeile** (M1, zweiter Satz). Der Umbruch ist nötig, nicht kosmetisch: die UX-Rechnung sagt für die Kurzform 98 px Titel, gemessen sind es auf einer Karte mit Signal und Stopp-Knopf 54 px (Bestand heute 75 px); die 90 px sind mit keiner Textlänge in derselben Zeile zu halten. Deshalb hält die Karte die Grenze selbst: `.ka.vergessen .r0 { flex-wrap: wrap }` und `.ka.vergessen .r0 .t { min-width: 90px }` — der Umbruch greift nur an der vergessenen Karte und nur, wenn es nicht anders geht (Karte ohne Signal und ohne Stopp-Knopf bleibt in einer Zeile). Die Zahl weicht dem Satz — bewusste Abweichung von der Formulierung „der Sekundentext bleibt“ in ADR-0019 Regel 2: die Karte kann beides nicht tragen, und der genaue Wert steht in der Zeittabelle, im Fenster und im Pop daneben; der Satz läuft über denselben Takt mit (FA 23). Der Umbruch der Kopfzeile ist die einzige sichtbare Lageänderung. Er ist von M1 gedeckt („reicht der Platz nicht, steht der Chip in einer eigenen Zeile unter dem Titel“) und greift nur an der vergessenen Karte; PO Z. 184 („Form und Lage bleiben unverändert“) ging von der UX-Schätzung 112 px aus, die die Karte in der Zeile nicht bestätigt (gemessen 54 px Titel). Bleibt es bei „keine neue Lage“, muss die 90-px-Grenze fallen und der Titel läuft wieder auf 54 px zu — dann ist M1 nicht erfüllt; die Entscheidung liegt beim Director/PO, gebaut wird nach dieser Fassung.

Bildschirmfotos auf den Abnahmezettel: Board (ein und zwei Timer, eigen und fremd, 1280/414/320, mit und ohne Umbruch), Aufgabenfenster und Pop bei 320, Hinweis mit und ohne Knopf bei 320 und 1280, Personen-Seite, je hell und dunkel.

### Umfang

I0103: 3 Features, 16 Bubbles, 8,5–15 h, ungemessen (Hypothese).
- Herleitung: Summe der Bubble-Spannen — F0073 3,5–6 h (B0501 0,5-1, B0502 0,5, B0503 0,5, B0504 0,5-1, B0505 0,5, B0506 0,5-1, B0507 0,5-1), F0074 3,5–6 h (B0508 1-1,5, B0509 0,5-1, B0510 0,5-1, B0511 0,5, B0515 0,5-1, B0516 0,5-1), F0075 1,5–3 h (B0512 0,5-1, B0513 0,5-1, B0514 0,5-1).
- Gezählte Eingänge (Stand `5660210`): 5 Zeichenstellen (`web/ansicht.js:535, :322, :330, :156, :826`), 1 Zähler (`:153`) bleibt; 1 Sekundentakt (`web/app.js:2469`); 1 Editor (`u.zeitEdit`, `:1425`); 1 Hinweisstelle (`web/ansicht.js:772–776`); 1 Chip-Regel (`web/kd-base.css:39–41`); 2 Farbblöcke dunkel (`web/kd-tokens.css:53`, `:86`) und 1 hell (`:7`); 0 neue Endpunkte, 0 Formatänderungen.

### Vorplanung (Bubbles in `Dokumentation/Planung/kanbanD.md`)

| Bubble | Feature | Inhalt | Aufwand | Braucht |
|---|---|---|---|---|
| B0501 | F0073 | Akzeptanztest Karte, Name und Titelbreite | 0,5-1 | — |
| B0502 | F0073 | Schwelle und Prädikat | 0,5 | — |
| B0503 | F0073 | Dauertext | 0,5 | — |
| B0504 | F0073 | Chip mit Satz statt Zahl | 0,5-1 | B0502, B0503 |
| B0505 | F0073 | Kartenname um den Zusatz | 0,5 | B0503 |
| B0506 | F0073 | Farbrolle als Paar, Punkt | 0,5-1 | — |
| B0507 | F0073 | Kante im Sekundentakt, eigener zuerst | 0,5-1 | B0502 |
| B0508 | F0074 | Akzeptanztest Erinnerung und Aktion | 1-1,5 | — |
| B0509 | F0074 | Aktion und Text im Hinweis | 0,5-1 | B0508 |
| B0510 | F0074 | Erinnerung je Tab und Identität | 0,5-1 | B0507, B0508 |
| B0511 | F0074 | Aktion nur beim eigenen Timer | 0,5 | B0509, B0510 |
| B0515 | F0074 | Erinnerung nach der Identitätswahl | 0,5-1 | B0510 |
| B0516 | F0074 | Nie zwei Aktionen, Nachreichen nach Ablauf | 0,5-1 | B0510 |
| B0512 | F0075 | Akzeptanztest Fenster und Zeittabelle | 0,5-1 | — |
| B0513 | F0075 | Akzeptanztest Pop und Personen-Seite | 0,5-1 | — |
| B0514 | F0075 | Ein Lauftext für alle Stellen | 0,5-1 | B0503, B0512, B0513 |

Die Bubbles sind Vorgabe für den Bau, keine Vereinbarung; geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

Nach Skill `test-pyramide`. Jede Szene der User Story wird ein Test, jeder Test prüft eine Zustandsänderung auf dem Schirm, in der Datei oder in der Git-Geschichte (Skill `test-ehrlichkeit`).

- **Unit (node --test)**: Grenze und Prädikat (`zeiten.test.js`, Muster der R00068-Grenze), Dauertext mit den Rechenbeispielen inkl. „seit 1 Stunde“ und der monotonen Folge 35 h/36 h (`kultur.test.js`), Name mit Zusatz vor „ausgewählt“ (`kartenname.test.js`), Kontrast von Schrift und Punkt (`kontrast.test.js`).
- **E2E (Playwright)**: neu `e2e/tests/r00114-vergessene-timer.spec.js` mit US-1 bis US-10; Muster `r00014-timer.spec.js` (Fixture `kanbanD-time` mit „…“ als laufendem Eintrag, `jetztMinus`), `r00015-zeiten.spec.js` (Editor), `alsPerson(page, 'st')`, `k.git('log', …)`, Uhr über `page.clock`; Breitenproben nach dem Muster von `ziele.spec.js`, Personen im benannten Rahmen (PO Z. 138).
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #15 und wird mit seinem Bubble grün; B0501 ist der erste rote Test.
- **Gegenproben (Mutanten)**: Markierung nur als Farbe ohne Text (AK 1 rot), Zusatz am Chip statt am Listeneintrag (AK 5 rot), voller Satz sichtbar (AK 12 rot), Aktion an fremder Zeit (AK 6 rot), zwei Knöpfe im Hinweis (AK 9 rot), Erinnerung im verborgenen Tab (AK 10 rot), Neuzeichnen je Sekunde (AK 11 rot), zweite Schwelle in `web/app.js` (NFA 5 rot).
- **Mitlaufend grün**: `r00014-timer.spec.js`, `r00015-zeiten.spec.js`, `r00021-personen.spec.js`, `r00031-rueckgaengig.spec.js`, `r00112-rueckgaengig.spec.js`, `kultur.spec.js`, `ziele.spec.js`, `kontrast.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0019 (Akzeptiert, Commit `5660210`); ADR-0007 (Sicherer beim Neuzeichnen), ADR-0011 (Farbrollen als Paare), ADR-0012 (Trefferfläche), ADR-0013 (Anzeigekultur), ADR-0015 (Hinweis in jeder Breite), ADR-0017 (Hinweisort, Undo, Strg+Z), ADR-0018/X00005 (Kartenname); PO-Entscheidungen Z. 182–184 (`ad56896`); UX-Vorprüfung 2026-11-10 (M1–M5).
- Abhängig von (alle grün): I0014 Timer (R00014), I0015 Zeiten (R00015), I0021 Personenübersicht (R00021), I0095 Fokus (R00106), I0102 Kartenname (R00113).
- Blockiert: keine Interaction. Eine Eigentümerregel für Zeiteinträge und eine einstellbare Schwelle wären eigene Anforderungen (PO Z. 183).

## Offene Fragen

1. **Wessen Timer wird erinnert** — **geschlossen** (PO Z. 182, 2026-11-10): alle sichtbaren vergessenen Timer werden markiert, auch fremde; die Aktion bietet nur der eigene Eintrag an; ohne gewählte Identität erscheint der Hinweis ohne Aktion. Text in FA 7, FA 15, AK 6, US-3, US-4.
2. **Darf fremde Zeit überhaupt korrigiert werden** — **geschlossen** (PO Z. 183): bleibt wie heute, keine Eigentümerregel, keine Änderung an `src/dienst/zeiten.rs`; der vorhandene ✎-Weg der Zeittabelle bleibt für jede Zeile. Eine Eigentümerregel wäre eine eigene Anforderung („Nicht Teil“).
3. **Artboard** — **geschlossen** (PO Z. 184): kein Artboard, Bildschirmfotos 1280/414/320 px hell und dunkel auf den Abnahmezettel. Grund: Form des Chips und Farbrolle folgen dem Bestand; neu sind Textlänge und der von M1 vorgesehene Umbruch der Kopfzeile (Chip in eigener Zeile, wenn der Titel sonst unter 90 px fiele). B0506 ist damit keine Freigabefrage; die Fotos zeigen den Umbruch.
4. **Hinweis läuft nicht ab, solange der Fokus darin steht** (Sollte der UX-Vorprüfung) — nicht übernommen: das ändert die Lebensdauer jedes Hinweises (D00007, R00112 FA 3) und damit eine Regel außerhalb dieser Karte. Der Hinweis nimmt keinen Fokus (NFA 2); wer ihn bedienen will, erreicht ihn per Tab. Vorschlag: eigene kleine Karte, wenn gewünscht.

## Manuelle Vorbereitungstätigkeiten
Bildschirmfotos für den Abnahmezettel (PO Z. 184): Board mit einem und mit zwei vergessenen Timern bei 1280, 414 und 320 px; Aufgabenfenster und Pop bei 320 px; Hinweis mit und ohne Knopf bei 320 und 1280 px; Personen-Seite; je hell und dunkel.

## Manuelle Nachbereitungstätigkeiten
Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist ein Zustand, den die Oberfläche zeigt, ohne ihn zu bewerten: ein Timer läuft seit 143 Stunden, und die Anzeige sagt weiter nur „143:10:23“. Weil „vergessen“ keine Eigenschaft des Eintrags ist, sondern eine Aussage über Zeit und Blick, gehört die Entscheidung in die Anzeige: eine reine Regel rechnet sie beim Zeichnen aus, eine Stelle im Takt erkennt nur ihren Übergang. Dadurch steht die Regel einmal statt an fünf Stellen, sie kann nicht veralten, und ein Betrachter erzeugt keinen Commit — das ist der Hebel gegenüber einem Merkmal in der Datei oder einem Feld in der API, die beide einen Schreibweg für eine Anzeigefrage öffnen würden (ADR-0019 Optionen B und C). Der kurze sichtbare Satz ist dabei kein Kompromiss, sondern die Bedingung: der volle Satz mit Zahl verdrängt den Titel aus der Karte (gemessen 216 px Chip, 11 px Titel, Karte wächst über die Spalte), die Kurzform lässt in derselben Zeile 54–82 px und mit dem Umbruch der Kopfzeile wieder 192 px. Die Erinnerung macht aus dem Sehen ein Handeln: sie nennt Eintrag und Aufgabe und öffnet den Eintrag zum Korrigieren, sodass aus „das fällt mir jetzt auf“ ein Klick wird. Die Zahlen stimmen danach wieder, weil die Korrektur der gewöhnliche, committete Weg bleibt.

## Missing-Docs
- Glossar: kein Eintrag für „vergessener Timer“ (Schwelle, Dauertext, Erinnerung). Vorschlag: eigener Eintrag D00009 nach dem Bau, mit `VERGESSEN_MS`, `.lauf.vergessen` und dem Hinweis.
- `A00009` (Oberfläche) beschreibt die Chip-Zustände heute nicht; nach dem Bau nennt der Entwickler dort die fünf Zeichenstellen und die Farbrolle.

## Notizen
- **Optionen**: Die Architekturentscheidung steht in ADR-0019 mit vier Varianten (Anzeige, Datei, Server, Takt schreibt in den DOM); gewählt ist A, die Anzeige rechnet. Auf Anforderungsebene blieben zwei Gestaltungsvarianten, beide verworfen: (a) ein eigenes Warnband über dem Board „3 Timer laufen zu lange“ — verdeckt Arbeit, nennt keinen Eintrag und ist nicht dort, wo der Timer steht; (b) die Zahl rot färben, ohne Worte — hängt allein an der Farbe und ist für Hilfstechnik stumm (AK 1 verlangt den Namen).
- **Abnahme der Karte #15**: die Abnahme-Probe steht wörtlich in AK 1; die Ergänzungen um Kurzform und Namen sind beobachtbare Prüfungen, keine Technikvorgaben.
- **UX-Vorprüfung eingearbeitet** (M1–M5): M1 → FA 12, AK 12; M2 → FA 13, AK 13; M3 → FA 16, 17, AK 9, B0516; M4 → FA 18, AK 7, B0515; M5 → FA 20, AK 14. Sollte übernommen: Aufgabe im Hinweistext (FA 14), Hintergrund-Tab (FA 18), eigener Timer zuerst (FA 14), knopfloser Hinweis nennt den nächsten Schritt (FA 15), verschwundener Eintrag meldet den Grund (FA 19), Punkt ≥ 3:1 (FA 8), Einzahl (FA 3, 9), Markup unter der Schwelle unverändert (FA 11), Kurzform sichtbar (FA 5). Nicht übernommen: Ablaufhemmung bei Fokus im Hinweis (Offene Fragen 4).
- **Entscheidungen des planers**: Elterndialog D0002, weil das Board die Karte trägt und der Hinweis dort erscheint; die übrigen Zeichenstellen hängen an demselben Chip und derselben Regel. Vertikal geschnitten: F0073 ist der Walking Slice (Schwelle, Text, Karte, Name, Kante), F0074 die Erinnerung samt Identitätswechsel und Hinweisdisziplin, F0075 dieselbe Markierung an den übrigen Stellen. Die Kante im Takt liegt in F0073, weil ohne sie die Markierung beim Überschreiten gar nicht erschiene.
- **Bewusste Abweichung von ADR-0019 Regel 2**: Der Chip zeigt im vergessenen Zustand den Satz statt der mitlaufenden Zahl (und auf der Karte ohne „2×“), weil beides zusammen den Titel verdrängt („Gestaltung“). Der Takt schreibt den Satz über dieselbe Kulturfunktion fort, damit der Tageswechsel nicht veraltet; die Regel „ein Zeitgeber, kein Zustand im Takt“ bleibt.
- **Eigene Messung statt Übernahme der UX-Zahlen**: Die UX-Vorprüfung nennt für die Kurzform 112 px Chip und damit ≥ 90 px Titel; in der laufenden Instanz gemessen sind es 104 px Chip und 54 px Titel auf einer Karte mit Signal und Stopp-Knopf (Bestand heute 75 px). Deshalb plant die Anforderung den Umbruch der Kopfzeile als Rückfall (M1, zweiter Satz) und hält die 90 px in der Karte selbst; die Modellrechnung (Mono 0,6 em, Polster, Punkt, Lücke) trifft die UX-Zahl 205 px für den vollen Satz exakt, die Abweichung kommt aus dem Kartenbestand (Signal 22 px, Nummer 21 px, Stopp-Knopf 19 px), nicht aus der Schrift.
- **Nicht Teil**: Summen kappen (eigene Anforderung, ADR-0019 Offene Fragen), einstellbare Schwelle, Sicht für Agenten, Eigentümerregel für Zeiteinträge (PO Z. 183), Ablaufhemmung des Hinweises bei Fokus (Offene Fragen 4), Wiederansage durch Hilfstechnik.
