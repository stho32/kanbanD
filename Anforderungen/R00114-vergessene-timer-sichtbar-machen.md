---
id: R00114
status: Neu
datum: 2026-11-10
---

# R00114: Vergessene Timer sichtbar machen

## Beschreibung

Wer einen Timer laufen ließ, sieht heute nur, dass er läuft: drei Timer laufen seit 143 Stunden, und Karte wie Seite Personen zeigen weiter einen harmlosen Chip „143:10:23“ beziehungsweise „Woche 137:25“ (Karte #15, Sollte aus der UX-Durchsicht vom 2026-10-31). Nach dieser Anforderung kennzeichnet die Oberfläche jeden sichtbaren Timer, der länger als zehn Stunden läuft, und nennt die Dauer in Worten („läuft seit 6 Tagen“). Wer den eigenen Timer vergessen hat, bekommt einmal je Sitzung einen Hinweis mit der Aktion „Zeit korrigieren“, die den vorhandenen Zeit-Editor auf genau diesem Eintrag öffnet.

„Vergessen“ ist eine Aussage der Anzeige, nicht des Datenbestands (ADR-0019): nichts wird in die Aufgabe geschrieben, kein Endpunkt kommt hinzu, kein Dateiformat ändert sich.

Nicht Teil: das Kappen von Summen — „Woche 137:25“ bleibt die Folge des vergessenen Timers, keine Rechenfehlerkorrektur (ADR-0019 Konsequenzen, R00021); eine einstellbare Schwelle; eine Sicht für Agenten; eine Eigentümerregel für Zeiteinträge (Offene Fragen 2).

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiterfassung, die zum Arbeiten passt“ (ein Timer, der sich ohne Umstand starten und stoppen lässt) und „Live überall“: die Markierung erscheint ohne Neuladen, und der Zustand ist nirgends gespeichert, was der Leitplanke „Die Dateien sind der einzige Speicher“ folgt. Leitplanke „Jede Gestaltung wird freigegeben, bevor sie gebaut wird“: hier wird nichts Neues sichtbar, nur ein vorhandener Chip bekommt eine Farbrolle und einen Satz (Offene Fragen 3, Bildschirmfotos auf dem Abnahmezettel).

### Domänenbezug
- [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md)
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)

## Geschäftlicher Nutzen

Ein vergessener Timer verfälscht die Zeiten und die Berichte: die Wochensumme der Person, das Σ an der Karte, der Stundenzettel. Heute fällt das nur auf, wenn jemand die Zahl „143:10:23“ liest und selbst rechnet. Mit der Markierung sieht man es auf einen Blick, an jeder Stelle, an der ein Timer steht; mit der Aktion ist der Eintrag in zwei Klicks korrigiert, statt ihn im Aufgabenfenster zu suchen und den richtigen Eintrag zu treffen. Weil die Aktion den vorhandenen Editor öffnet, bleibt jede Korrektur eine gewöhnliche, committete Aktion.

## Funktionale Anforderungen

### Schwelle und Dauertext (ADR-0019 Regeln 1, 2)

1. Ein laufender Zeiteintrag gilt als vergessen, wenn seine Laufzeit zehn Stunden erreicht. Laufzeit ist der Abstand von `laufBeginn` bis jetzt (Datei-Minute, für in diesem Browser gestartete Timer die gemerkte Startsekunde — dieselbe Basis, die heute den Chip füllt). Ein unbekannter Beginn gilt als nicht vergessen.
2. Schwelle und Prädikat stehen genau einmal in `web/zeiten.js`; kein zweiter Vergleich in `web/ansicht.js`, `web/berichte.js` oder `web/app.js`. Nach dem Muster von R00068: Konstante und reine Funktion nebeneinander, Grenze als Unit-Test.
3. Die Dauer im Wort bildet `web/kultur.js` (ADR-0013): unter 48 Stunden „läuft seit <n> Stunden“ (abgerundet), ab 48 Stunden „läuft seit <n> Tagen“ (kaufmännisch gerundet); Einzahl „1 Stunde“/„1 Tag“ wird nie falsch gebildet. Rechenbeispiele: 10:00:00 → „10 Stunden“, 47:59:59 → „47 Stunden“, 48:00:00 → „2 Tagen“, 143:10:23 → „6 Tagen“, 30 Tage → „30 Tagen“.
4. Der Zustand wird beim Zeichnen aus Zeit und Stand entschieden — nicht im Takt, nicht am DOM-Knoten, nicht im Server. Dieselbe Entscheidung gilt an allen fünf Zeichenstellen (FA 5).

### Zeigen (ADR-0019 Regeln 2, 6)

5. An allen fünf Stellen, an denen heute ein laufender Timer gezeichnet wird — Karte, Fensterblock „LÄUFT GERADE“, Zeile der Zeittabelle, Pop „Läuft gerade“, Zeile der Seite Personen —, trägt der Laufchip eines vergessenen Timers eine eigene Klasse (`vergessen`) und den Dauertext; die mitlaufende Zahl bleibt daneben und zählt weiter.
6. Der Zähler in der Kopfzeile (`#t-lauf`) bleibt ein Zähler: er nennt weiter nur die Zahl der laufenden Timer.
7. Jeder sichtbare vergessene Timer wird markiert, auch ein fremder. Eigen und fremd unterscheiden sich allein durch die Aktion im Hinweis (FA 5, 12–16), nicht durch die Markierung.
8. Die Markierung hängt an einer Farbrolle, die als Paar (Fläche und Schrift) in `web/kd-tokens.css` für hell und beide dunklen Blöcke steht und die Kontrastprobe besteht (ADR-0011); kein Farbwert außerhalb der Tokens. Ob das Paar nach Material 3 `error-container`/`on-error-container` heißt, entscheiden die UX-Rollen; die Tokennamen sind deutsch, die M3-Rolle steht als Kommentar dabei.

### Karte und Name (ADR-0019 Regel 2; ADR-0018/X00005)

9. Der zugängliche Name des Listeneintrags einer Karte trägt bei vergessenem Timer den Zusatz „Timer läuft seit 6 Tagen“, gestellt vor „ausgewählt“. Reihenfolge: „#<nr> <Titel>[, <Klasse>][, Timer läuft seit <Dauer>][, ausgewählt]“; fehlende Teile fallen samt Komma weg.
10. Der Chip selbst ist kein Bedienelement, nicht per Tab erreichbar und trägt keinen eigenen zugänglichen Namen: der Name des Listeneintrags ist die eine Stelle. (Ein `aria-label` an einem `span` ohne benennbare Rolle ist nach ARIA 1.2 wirkungslos und wäre keine Erfüllung.)
11. Unterhalb der Schwelle ändern sich weder Name noch Markup der Karte gegenüber heute.

### Erinnern und handeln (ADR-0019 Regeln 3–5)

12. Überschreitet ein Timer die Schwelle bei offenem Tab, oder ist er beim Öffnen des Tabs bereits darüber und dem Takt noch unbekannt, entsteht genau ein Hinweis (Sichtzustand `S.ui.hinweis`, D00007) mit dem Text „Timer von <Name> läuft seit <Dauer>“. Beim eigenen Timer trägt er zusätzlich die Aktion „Zeit korrigieren“.
13. Die Aktion ist ein Textknopf neben dem vorhandenen „rückgängig“; ein Hinweis trägt höchstens eine Aktion. Strg+Z bleibt ausschließlich „rückgängig“ und löst die Aktion nie aus; die Aktion ist kein Rückgängig und heißt nicht so.
14. „Zeit korrigieren“ öffnet die Aufgabe des Eintrags, wechselt auf den Reiter Inhalt und setzt danach den vorhandenen Zeit-Editor auf genau diesen Eintrag; der Fokus liegt im Feld Beginn. Gespeichert wird über den vorhandenen Weg (Korrektur des Eintrags), ein Fehler erscheint wie heute im Fensterfuß. Kein zweiter Editor, kein neuer Endpunkt.
15. Eigen ist der Eintrag, dessen Person die gewählte Identität ist. Ohne gewählte Identität gibt es keinen eigenen Timer und damit keine Aktion; der Hinweis erscheint trotzdem. Ein fremder Timer wird markiert, sein Hinweis bietet keine Aktion.
16. Je Tab und Timer wird höchstens einmal erinnert; der gemerkte Stand wird bereinigt, sobald der Timer verschwindet (gestoppt, gelöscht, korrigiert, archiviert). Es gibt höchstens einen Hinweis zur Zeit: überschreiten mehrere Timer gleichzeitig die Schwelle, sind alle markiert, und der zuletzt gemeldete Hinweis steht.
17. Nichts wird dafür in `boards/*.md`, `aufgaben/*.md`, `localStorage` oder `sessionStorage` geschrieben. Nach einem Neuladen erinnert derselbe Timer erneut — das ist gewollt und kein Befund (ADR-0019 Konsequenzen).

### Takt (ADR-0019 Regel 3)

18. Der vorhandene Sekundentakt (`web/app.js:2469–2480`) erkennt je laufendem Timer den Übergang „nicht vergessen → vergessen“ und zeichnet genau einmal neu, im vorhandenen Tor (`zug == null && !S.ui.neu`, `:2477`). Steht ein Zug oder „Neue Aufgabe“ offen, unterbleibt das Zeichnen und der Übergang wird beim nächsten Takt nachgeholt. Kein Neuzeichnen je Sekunde; die Zahl im Chip läuft weiter über `[data-since]`.
19. Der Übergang „vergessen → nicht vergessen“ (Timer gestoppt, gelöscht, korrigiert) entsteht durch die Aktion selbst und ihr eigenes Neuzeichnen; der Takt muss ihn nicht melden.
20. Zusehen schreibt nichts: kein Commit, keine Dateiänderung. Jede Aktion (Korrektur über den Editor, Stoppen) bleibt genau ein Commit wie heute.

## Nicht-funktionale Anforderungen

1. **Ein Zeitgeber**: höchstens ein Neuzeichnen je Überschreitung und Timer; der Sekundentext läuft ohne Neuzeichnen weiter (Wächter über den Render-Zähler der Testschnittstelle).
2. **Barrierefreiheit**: Der Zustand hängt nicht an der Farbe allein — der Name des Listeneintrags nennt ihn (FA 9). Schrift auf der Chip-Fläche mindestens 4,5:1 in Hell und Dunkel (ADR-0011, geprüft von der Kontrastprobe). Der Hinweis bleibt `role="status"`, die Aktion ist per Tastatur erreichbar und hat die Trefferfläche nach ADR-0012.
3. **Breite**: Bei 320 px scrollt nichts quer (ADR-0015); Chip und Hinweis brechen um, der Text wird nie abgeschnitten.
4. **Rückwärtskompatibel**: keine Änderung an API, Dateiformat, Commit-Texten oder Summen (R00021); Aufrufe und Antworten wie heute.
5. **Eine Schwelle**: `grep -n "3600e3\|VERGESSEN" web/*.js` findet die Konstante nur in `web/zeiten.js`.
6. **Kein Rauschen**: kein Schreibzugriff aus dem Takt; die Git-Geschichte des Ordners bleibt beim Zusehen unverändert.

## Akzeptanzkriterien

Geprüft mit dem Grundbestand aus `user-stories/R00114.md`; „Uhr“ ist `page.clock`, „Hinweis“ der `.toast` mit `role="status"`.

- [ ] **1. Abnahme-Probe der Karte #15 (wörtlich)**: „Ein Timer über der Schwelle trägt eine eigene Klasse bzw. ein `aria-label` mit „läuft seit“; der Hinweis bietet eine Aktion, die den Zeiteintrag zum Bearbeiten öffnet.“
  - Ergänzung des planers, als beobachtbare Prüfung: Der Name des Listeneintrags der Karte trägt den Zusatz „Timer läuft seit 6 Tagen“; ein `aria-label` am Chip selbst ist keine Erfüllung, weil der Name des Listeneintrags das Innere ersetzt.
  - Besteht: `.ka[data-id="1"] .lauf.vergessen` mit Text „läuft seit 6 Tagen“; `getByRole('listitem', { name: /Timer läuft seit 6 Tagen/ })` trifft #1; der Hinweis zeigt `[data-act="zeit-korrigieren"]`, und ein Klick öffnet die Zeile des Eintrags in Bearbeitung mit dem Fokus in „Beginn“.
  - Fällt durch: nur eine Farbe ohne Text; Klasse ohne Namen am Listeneintrag; Hinweis ohne Aktion; Aktion öffnet nur das Fenster ohne Editor.
  - Prüfebene: E2E `r00114-vergessene-timer.spec.js` US-1, US-5; AK 2–4, 7.
- [ ] **2. Die Grenze**: Bei 9:59:59 trägt der Chip weder Klasse noch Text, der Name keinen Zusatz; bei 10:00:00 trägt er beides. Bei 30 Tagen Laufzeit steht „läuft seit 30 Tagen“. Ein Eintrag ohne lesbaren Beginn gilt im Unit-Test nicht als vergessen.
  - Besteht: Unit-Test der Grenze mit der Konstante aus `web/zeiten.js` (nicht als Zahl im Test) und dieselben drei Fälle im E2E.
  - Fällt durch: 10:00:00 noch ohne Markierung; 9:59:59 schon markiert; zweite Zahl 3600e3 außerhalb `zeiten.js`.
  - Prüfebene: Unit `e2e/einheit/zeiten.test.js`; E2E US-2.
- [ ] **3. Dauertext**: 10:00:00 → „läuft seit 10 Stunden“; 47:59:59 → „läuft seit 47 Stunden“; 48:00:00 → „läuft seit 2 Tagen“; 143:10:23 → „läuft seit 6 Tagen“; 30 Tage → „läuft seit 30 Tagen“; 1 Stunde → „läuft seit 1 Stunde“.
  - Besteht: je Fall die Unit-Erwartung in `web/kultur.js`; im E2E mindestens die beiden Fälle aus der Karte (143:10:23 → „6 Tagen“, 10:00:00 → „10 Stunden“).
  - Fällt durch: „143 Stunden“; „5 Tagen“ bei 143:10; „1 Stunden“.
  - Prüfebene: Unit `e2e/einheit/kultur.test.js`; E2E US-1, US-2.
- [ ] **4. Alle fünf Zeichenstellen, Zähler bleibt Zähler**: Derselbe vergessene Timer trägt auf der Karte, im Fensterblock „LÄUFT GERADE“, in der Zeile der Zeittabelle, im Pop „Läuft gerade“ und auf der Seite Personen dieselbe Klasse und denselben Text; der Zähler `#t-lauf` nennt weiter nur die Zahl. Unterhalb der Schwelle zeigt keine der fünf Stellen etwas Neues.
  - Besteht: an jeder der fünf Stellen ein Treffer für `.lauf.vergessen` mit demselben Text; `#t-lauf` unverändert; Gegenprobe mit einem Timer bei 9:59 liefert an keiner Stelle einen Treffer.
  - Fällt durch: eine Stelle ohne Markierung; Markierung am Zähler; unterschiedliche Texte.
  - Prüfebene: E2E US-6.
- [ ] **5. Name und Auswahl**: Bei vergessenem Timer heißt der Eintrag „#1 eins, Fehler, Timer läuft seit 6 Tagen“; ist #1 zusätzlich ausgewählt, endet der Name auf „, ausgewählt“; ohne Klasse fehlt der Klassenteil samt Komma; unterhalb der Schwelle lautet der Name wie heute. Der Chip ist nicht per Tab erreichbar.
  - Besteht: Unit-Test der reinen Namensfunktion mit allen vier Fällen; E2E liest den Namen über die Rolle; Tab erreicht den Chip nicht.
  - Fällt durch: Zusatz hinter „ausgewählt“; doppeltes Komma; ein `aria-label` am Chip als einziger Träger.
  - Prüfebene: Unit `e2e/einheit/kartenname.test.js`; E2E US-1, US-3.
- [ ] **6. Fremder Timer markiert, ohne Aktion**: Claudes Timer über der Schwelle trägt an allen Stellen Klasse und Text; sein Hinweis bietet keinen Knopf. Ohne gewählte Identität erscheint der Hinweis ebenfalls ohne Knopf.
  - Besteht: Markierung vorhanden; `.toast` ohne `[data-act="zeit-korrigieren"]`; Markierung unabhängig von der Identitätswahl.
  - Fällt durch: fremder Timer ohne Markierung; Aktion an fremder Zeit; Aktion ohne Identität.
  - Prüfebene: E2E US-3, US-4.
- [ ] **7. Die Aktion öffnet genau diesen Eintrag**: #1 trägt zwei laufende Einträge, Stefans vergessenen und Claudes kurzen. Klick auf „Zeit korrigieren“ → Fenster von #1, Reiter Inhalt, die Zeile von Stefans Eintrag steht in Bearbeitung, der Fokus liegt in „Beginn“; Ändern des Beginns und Enter schreibt die Datei und ergibt genau einen Commit mit dem heutigen Text der Korrektur.
  - Besteht: `document.activeElement` ist `#z-beginn`; die bearbeitete Zeile trägt die Kennung von Stefans Eintrag; ein neuer Commit; die Datei zeigt den neuen Beginn.
  - Fällt durch: Fenster ohne Editor (Reihenfolge `oeffnen` löscht den Editor); falscher Eintrag; kein oder zwei Commits.
  - Prüfebene: E2E US-5; der Editor-Weg selbst ist durch `r00015-zeiten.spec.js` gedeckt.
- [ ] **8. Strg+Z bleibt Rückgängig**: Steht ein Hinweis mit Aktion, ändert Strg+Z nichts (kein Fenster, kein Editor). Steht ein Hinweis mit „rückgängig“, macht Strg+Z weiter genau das.
  - Besteht: nach Strg+Z kein Fenster und kein Commit; `r00031-rueckgaengig.spec.js` und `r00112-rueckgaengig.spec.js` grün.
  - Fällt durch: Strg+Z löst die Aktion aus; Rückgängig wirkt nicht mehr.
  - Prüfebene: E2E US-5; die Rückgängig-Specs laufen mit.
- [ ] **9. Einmal je Tab, kein Schreiben**: Ein Timer überschreitet die Schwelle → genau ein Hinweis. 12 s später (Uhr vorgestellt, ohne neue Aktion) steht kein zweiter Hinweis. Ein frisch geöffneter Tab mit demselben, bereits vergessenen Timer erinnert erneut genau einmal (gewollt, ADR-0019). Während 60 s Zusehen mit laufendem Timer unter der Schwelle und über der Schwelle entsteht kein Commit. Wird der Timer gestoppt und ein neuer bis über die Schwelle gefahren, erinnert der neue Übergang wieder genau einmal.
  - Besteht: ein Hinweis je Übergang; `git log` unverändert beim Zusehen; nach Stopp und neuem Übergang wieder genau ein Hinweis.
  - Fällt durch: Hinweis je Sekunde; zweiter Hinweis für denselben Timer; ein Commit ohne Aktion.
  - Prüfebene: E2E US-7; Wächter über `git log` des Testordners.
- [ ] **10. Ein Neuzeichnen je Überschreitung**: Mit laufendem Timer unter der Schwelle steigt `kdTest.renders()` über mehrere Sekunden nicht; beim Überschreiten steigt er genau einmal; die Zahl im Chip ändert sich dabei weiter.
  - Besteht: Render-Zähler konstant, dann genau +1; `[data-since]`-Text fortschreitend.
  - Fällt durch: +1 je Sekunde; kein Neuzeichnen (Markierung erscheint nicht); Neuzeichnen je Timer mehrfach.
  - Prüfebene: E2E US-2.
- [ ] **11. Farbe als Paar und schmale Breite**: Die Schrift des Chips erreicht auf seiner Fläche mindestens 4,5:1 in Hell und in beiden dunklen Zuständen; bei 320 px bricht der Chip um, nichts scrollt quer, der Hinweis mit Aktion bleibt ganz im Bild und die Aktion ist mit Touchziel bedienbar.
  - Besteht: Kontrastprobe grün; `ziele.spec.js` und die Breitenprobe finden keinen Verstoß; das Rechteck der Aktion liegt im Bild.
  - Fällt durch: ein Farbwert außerhalb der Tokens; Kontrast unter dem Maß; abgeschnittene Aktion.
  - Prüfebene: `e2e/einheit/kontrast.test.js`, `e2e/tests/kontrast.spec.js`, `ziele.spec.js`.

## Betroffene Verzeichnisstruktur

```
web/
├── zeiten.js        # Schwelle und Prädikat (reines Modul, Browser und Node)
├── kultur.js        # Dauertext „läuft seit …“ (ADR-0013)
├── kartenname.js    # Zusatz im zugänglichen Namen der Karte
├── ansicht.js       # Chip an fünf Stellen, Name, Aktion im Hinweis
├── app.js           # Kante im Sekundentakt, Aktion zeit-korrigieren, Sichtzustand
├── kd-tokens.css    # Token-Paar hell und beide dunklen Blöcke
└── kd-app.css       # .lauf.vergessen
e2e/
├── einheit/         # zeiten.test.js, kultur.test.js, kartenname.test.js, kontrast.test.js
└── tests/           # r00114-vergessene-timer.spec.js (neu); r00014, r00015, r00021, kultur, ziele, kontrast laufen mit
```

Kein Server, kein Format, keine Migration.

## Technische Überlegungen

Nach ADR-0019 (Akzeptiert); Baustein A00009 (Oberfläche) trägt die Soll-Notizen. Stand des Codes, an dem die Zeilen geprüft wurden: `5660210`.

### Ablauf

1. **Beim Zeichnen** (`render()` → `vKarte`, `vFensterSeite`, `vZeiten`, `vLaufPop`, `vPersonen`):
   - 1.1 Laufzeit je laufendem Eintrag aus `laufBeginn(a, z)` (`web/ansicht.js:380`) bis jetzt.
   - 1.2 Prädikat aus `web/zeiten.js`; wahr → Chip mit Klasse `vergessen` und Text aus `web/kultur.js`.
   - 1.3 Auf der Karte zusätzlich der Name über `kartenName(…, zusatz)`; der Zusatz ist der Kulturtext mit vorangestelltem „Timer “.
2. **Im Sekundentakt** (`web/app.js:2469–2480`, jede Sekunde):
   - 2.1 Textfortschreibung wie heute (`[data-since]`).
   - 2.2 Je laufendem Timer das Prädikat; Schlüssel `nr|wer` in der Menge der gesehenen.
   - 2.3 Übergang falsch → wahr: Schlüssel merken, `neu = true`; gezeichnet wird im Tor `neu && zug == null && !S.ui.neu` (`:2477`), also höchstens einmal.
   - 2.4 Übergang im selben Schritt: Hinweis setzen (FA 12), Aktion nur bei eigenem Eintrag (FA 15).
3. **Klick auf „Zeit korrigieren“** (`web/app.js`):
   - 3.1 `u.pop = null`, `u.offen = nr`, `u.tab = 'inhalt'`, `dateiLaden()` abwarten — der Fall `oeffnen` (`:1042`) löscht `u.zeitEdit`, deshalb danach.
   - 3.2 `u.zeitEdit = kennung`, `u.fokus = '#z-beginn'`, zeichnen.
   - 3.3 Speichern läuft über `zeit-ok` → `PATCH …/zeiten/{kennung}` (`:1430–1432`), ein Commit; Fehler im Fensterfuß wie heute.

### Grobentwurf

- `web/zeiten.js` (reines Modul, `Object.assign` am Ende wie heute):
  - `VERGESSEN_MS` (Konstante, 10 h) und `istVergessen(laufzeitMs)` — `true`, wenn Laufzeit ≥ Konstante; `null`/unbekannt → `false`.
- `web/kultur.js` (reines Modul):
  - `laeuftSeit(ms)` — „läuft seit 10 Stunden“ / „läuft seit 6 Tagen“ nach FA 3, mit Einzahlformen.
- `web/kartenname.js`:
  - `kartenName({ nummer, titel, klasse }, klassen, gewaehlt, zusatz)` — `zusatz` leer lässt den Namen wie heute; gesetzt steht er vor „ausgewählt“.
- `web/ansicht.js`:
  - `vLaufChip(a, z, jetzt)` — eine Stelle für Klasse, Kulturtext und `[data-since]`, von Karte, Fensterblock, Zeittabelle, Pop und Personen aufgerufen; der Zähler in der Kopfzeile ruft sie nicht.
  - `vKarte`: Zusatz für `kartenName` aus `vLaufChip`-Entscheidung.
  - `vHinweisInhalt`: `t.aktion` als zweiter `.lnk` neben `t.undo`.
- `web/app.js`:
  - `S.ui` bekommt die Menge der gesehenen Timer (Schlüssel `nr|wer`); kein Speicher außerhalb der Sitzung.
  - `case 'zeit-korrigieren'`: `arg` als `nr|kennung` zerlegen, Ablauf 3.
  - Sekundentakt: Schritt 2.2–2.4.
- `web/kd-tokens.css`: Paar `--kd-fehler-flaeche` / `--kd-fehler-text` in `:root` und in beiden dunklen Blöcken (`@media prefers-color-scheme: dark` und `[data-theme=dark]`); Kommentar nennt die M3-Rolle `error-container`/`on-error-container`.
- `web/kd-app.css`: `.lauf.vergessen` setzt Fläche und Schrift aus dem Paar; keine Maße ändern.

### Änderungen an bestehenden Klassen

- `vKarte`, `vFensterSeite`, `vZeiten`, `vLaufPop`, `vPersonen`: Chip über den gemeinsamen Helfer; sonst unverändert.
- `kartenName`: vierter Parameter; alle Aufrufstellen (Karte, defekte Karte, fehlende Aufgabe bleiben ohne Zusatz) angepasst.
- Sekundentakt: zwei Zustandsänderungen mehr (`neu`, Menge), kein neuer Zeitgeber.
- `act`-Verteiler: ein Fall `zeit-korrigieren`; keine Änderung an `rueckgaengig` oder an der Tastenprüfung für Strg+Z.

### Gestaltung

- Der Chip besteht heute und ist ungestaltet (`grep lauf web/kd-app.css` findet nur `#t-lauf .lang` und `#durchlauf`); neu ist eine Farbrolle als Paar und ein Satz. Deshalb kein Artboard (PO Z. 153: neu zu sehen ist ein neues Element oder ein neuer Zustand, dessen Form oder Lage erst entschieden werden muss — hier bleibt Form und Lage, es ändert sich das Maß der Farbe; vergleichbar dem Hinweisrand aus PO Z. 164). Auflage: Bildschirmfotos von Board, Aufgabenfenster und Personen-Seite mit vergessenem Timer bei 1280, 414 und 320 px, hell und dunkel, auf dem Abnahmezettel.
- Der Hinweis mit zwei Textknöpfen folgt dem freigegebenen Muster aus ADR-0015 (bricht um) und ADR-0017 (Ort im obersten Fenster), kein neuer Zustand.
- Fordert die UX-Vorprüfung für die Fehlerfläche ein Artboard, wartet allein B0506 (Token und Klasse); alle übrigen Bubbles sind ohne es baubar.

### Umfang

I0103: 3 Features, 14 Bubbles, 7,5–13 h, ungemessen (Hypothese).
- Herleitung: Summe der Bubble-Spannen — F0073 3,5–6 h (B0501 0,5-1, B0502 0,5, B0503 0,5, B0504 0,5-1, B0505 0,5, B0506 0,5-1, B0507 0,5-1), F0074 2,5–4 h (B0508 1-1,5, B0509 0,5-1, B0510 0,5-1, B0511 0,5), F0075 1,5–3 h (B0512 0,5-1, B0513 0,5-1, B0514 0,5-1).
- Gezählte Eingänge (Stand `5660210`): 5 Zeichenstellen (`web/ansicht.js:535, :322, :330, :156, :826`), 1 Zähler (`:153`) bleibt; 1 Sekundentakt (`web/app.js:2469`); 1 Editor (`u.zeitEdit`, `:1425`); 1 Hinweisstelle (`web/ansicht.js:772–776`); 2 Farbblöcke dunkel (`web/kd-tokens.css:53`, `:86`) und 1 hell (`:7`); 0 neue Endpunkte, 0 Formatänderungen.

### Vorplanung (Bubbles in `Dokumentation/Planung/kanbanD.md`)

| Bubble | Feature | Inhalt | Aufwand | Braucht |
|---|---|---|---|---|
| B0501 | F0073 | Akzeptanztest Karte und Name | 0,5-1 | — |
| B0502 | F0073 | Schwelle und Prädikat | 0,5 | — |
| B0503 | F0073 | Dauertext | 0,5 | — |
| B0504 | F0073 | Chip an der Karte | 0,5-1 | B0502, B0503 |
| B0505 | F0073 | Kartenname um den Zusatz | 0,5 | B0503 |
| B0506 | F0073 | Token-Paar und Klasse | 0,5-1 | — |
| B0507 | F0073 | Kante im Sekundentakt | 0,5-1 | B0502 |
| B0508 | F0074 | Akzeptanztest Erinnerung und Aktion | 1-1,5 | — |
| B0509 | F0074 | Aktion im Hinweis zeichnen und binden | 0,5-1 | B0508 |
| B0510 | F0074 | Erinnerung je Tab | 0,5-1 | B0507, B0508 |
| B0511 | F0074 | Aktion nur beim eigenen Timer | 0,5 | B0509, B0510 |
| B0512 | F0075 | Akzeptanztest Fenster und Zeittabelle | 0,5-1 | — |
| B0513 | F0075 | Akzeptanztest Pop und Personen-Seite | 0,5-1 | — |
| B0514 | F0075 | Ein Lauftext für alle Stellen | 0,5-1 | B0503, B0512, B0513 |

Die Bubbles sind Vorgabe für den Bau, keine Vereinbarung; geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

Nach Skill `test-pyramide`. Jede Szene der User Story wird ein Test, jeder Test prüft eine Zustandsänderung auf dem Schirm, in der Datei oder in der Git-Geschichte (Skill `test-ehrlichkeit`).

- **Unit (node --test)**: Grenze und Prädikat (`zeiten.test.js`, Muster der R00068-Grenze), Dauertext mit den Rechenbeispielen (`kultur.test.js`), Name mit Zusatz vor „ausgewählt“ (`kartenname.test.js`), Kontrast des Paars (`kontrast.test.js`).
- **E2E (Playwright)**: neu `e2e/tests/r00114-vergessene-timer.spec.js` mit US-1 bis US-7; Muster `r00014-timer.spec.js` (Fixture `kanbanD-time` mit „…“ als laufendem Eintrag, `jetztMinus`), `r00015-zeiten.spec.js` (Editor), `alsPerson(page, 'st')`, `k.git('log', …)`, Uhr über `page.clock`.
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #15 und wird mit seinem Bubble grün; B0501 ist der erste rote Test.
- **Gegenproben (Mutanten)**: Markierung nur als Farbe ohne Text (AK 1 rot), Zusatz am Chip statt am Listeneintrag (AK 5 rot), Aktion an fremder Zeit (AK 6 rot), Neuzeichnen je Sekunde (AK 10 rot), zweite Schwelle in `web/app.js` (NFA 5 rot).
- **Mitlaufend grün**: `r00014-timer.spec.js`, `r00015-zeiten.spec.js`, `r00021-personen.spec.js`, `r00031-rueckgaengig.spec.js`, `r00112-rueckgaengig.spec.js`, `kultur.spec.js`, `ziele.spec.js`, `kontrast.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0019 (Akzeptiert, Commit `5660210`); ADR-0007 (Sicherer beim Neuzeichnen), ADR-0011 (Farbrollen als Paare), ADR-0012 (Trefferfläche), ADR-0013 (Anzeigekultur), ADR-0015 (Hinweis in jeder Breite), ADR-0017 (Hinweisort, Undo, Strg+Z), ADR-0018/X00005 (Kartenname).
- Abhängig von (alle grün): I0014 Timer (R00014), I0015 Zeiten (R00015), I0021 Personenübersicht (R00021), I0095 Fokus (R00106), I0102 Kartenname (R00113).
- Blockiert: keine Interaction. Eine Eigentümerregel für Zeiteinträge und eine einstellbare Schwelle wären eigene Anforderungen.

## Offene Fragen

1. **Wessen Timer wird erinnert** — offen, an den Betreiber (Empfehlung: alle sichtbaren markieren, die Aktion nur beim eigenen). Die Kartenabsicht ist, dass vergessene Timer auffallen; das gelingt nur, wenn auch fremde markiert sind. Die Aktion schreibt in fremde Buchung und wird deshalb nicht angeboten. Die Anforderung ist mit dieser Empfehlung baubar (AK 6, US-3, US-4); entscheidet der Betreiber „nur eigene erinnern“, fallen Markierung und Hinweis für fremde Timer weg, und AK 6, US-3 und B0511 ändern sich.
2. **Darf fremde Zeit überhaupt korrigiert werden** — offen, an den Betreiber; Empfehlung: bleibt wie heute, keine Regel in dieser Anforderung. Befund beim Nachprüfen: `src/dienst/zeiten.rs:66` prüft keinen Eigentümer, jede Person darf jede Zeit korrigieren; R00097 regelt Spalteneigentümer, nicht Zeiteinträge. Eine Eigentümerregel für Zeiten wäre eine eigene Anforderung mit Folge für den Stundenzettel. Die Anforderung trifft dazu keine Aussage und bietet die Aktion nur für eigene Timer an, damit die Erinnerung niemanden zum Umschreiben fremder Zeit einlädt.
3. **Artboard** — Empfehlung: keines (Gestaltung oben, PO Z. 153, vergleichbar PO Z. 164), Bildschirmfotos auf dem Abnahmezettel; die UX-Vorprüfung entscheidet. Fordert sie eines, wartet nur B0506.

## Manuelle Vorbereitungstätigkeiten
Bildschirmfotos für den Abnahmezettel (1280, 414, 320 px, hell und dunkel) mit einem vergessenen Timer auf Board, im Aufgabenfenster und auf der Seite Personen.

## Manuelle Nachbereitungstätigkeiten
Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist ein Zustand, den die Oberfläche zeigt, ohne ihn zu bewerten: ein Timer läuft seit 143 Stunden, und die Anzeige sagt weiter nur „143:10:23“. Weil „vergessen“ keine Eigenschaft des Eintrags ist, sondern eine Aussage über Zeit und Blick, gehört die Entscheidung in die Anzeige: eine reine Regel rechnet sie beim Zeichnen aus, eine Stelle im Takt erkennt nur ihren Übergang. Dadurch steht die Regel einmal statt an fünf Stellen, sie kann nicht veralten, und ein Betrachter erzeugt keinen Commit — das ist der Hebel gegenüber einem Merkmal in der Datei oder einem Feld in der API, die beide einen Schreibweg für eine Anzeigefrage öffnen würden (ADR-0019 Optionen B und C). Die Erinnerung macht aus dem Sehen ein Handeln: sie nennt den Eintrag und öffnet ihn zum Korrigieren, sodass aus „das fällt mir jetzt auf“ ein Klick wird. Die Zahlen stimmen danach wieder, weil die Korrektur der gewöhnliche, committete Weg bleibt.

## Missing-Docs
- Glossar: kein Eintrag für „vergessener Timer“ (Schwelle, Dauertext, Erinnerung). Vorschlag: eigener Eintrag D00009 nach dem Bau, mit `VERGESSEN_MS`, `.lauf.vergessen` und dem Hinweis.
- `A00009` (Oberfläche) beschreibt die Chip-Zustände heute nicht; nach dem Bau nennt der Entwickler dort die fünf Zeichenstellen und die Farbrolle.

## Notizen
- **Optionen**: Die Architekturentscheidung steht in ADR-0019 mit vier Varianten (Anzeige, Datei, Server, Takt schreibt in den DOM); gewählt ist A, die Anzeige rechnet. Auf Anforderungsebene blieben nur zwei Gestaltungsvarianten, beide verworfen: (a) ein eigenes Warnband über dem Board „3 Timer laufen zu lange“ — verdeckt Arbeit, nennt keinen Eintrag und ist nicht dort, wo der Timer steht; (b) die Zahl rot färben, ohne Worte — hängt allein an der Farbe und ist für Hilfstechnik stumm (AK 1 verlangt den Namen).
- **Abnahme der Karte #15**: die Abnahme-Probe steht wörtlich in AK 1; die Ergänzung um den Namen des Listeneintrags ist als beobachtbare Prüfung formuliert, nicht als Technikvorgabe.
- **Entscheidungen des planers**: Elterndialog D0002, weil das Board die Karte trägt und der Hinweis dort erscheint; die übrigen Zeichenstellen (Fenster, Personen) hängen an demselben Chip und an derselben Regel. Vertikal geschnitten: F0073 ist der Walking Slice (Schwelle, Text, Karte, Name, Kante), F0074 bringt die Erinnerung, F0075 dieselbe Markierung an die übrigen Stellen. Die Kante im Takt liegt in F0073, weil ohne sie die Markierung beim Überschreiten gar nicht erschiene.
- **Nicht Teil**: Summen kappen (eigene Anforderung, ADR-0019 Offene Fragen), einstellbare Schwelle, Sicht für Agenten, Eigentümerregel für Zeiteinträge, Wiederansage durch Hilfstechnik.
