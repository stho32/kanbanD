---
id: R00136
status: Neu
datum: 2026-11-11
---

# R00136: Menüköpfe in role=menu ohne Überschrift

## Beschreibung

Nach WAI-ARIA 1.2 sind die erlaubten Kinder eines Elements mit `role="menu"` nur Einträge (`menuitem`, `menuitemcheckbox`, `menuitemradio`), Gruppen (`group`) und Trenner (`separator`) — keine Überschriften. Vier Menüs tragen ihren Kopf heute aber als `<h4>` direkt im Menü: „SEITE" (`vSeitenPop`), „MEHR" (`vMehrPop`), „#<nr> AUF BOARD LEGEN" (`vLegenPop`) und „STATUS <Knoten>" (`vWbsStatusPop`, `web/ansicht.js`). Diese Anforderung ersetzt den `<h4>` an diesen vier Stellen durch ein **klassen-gestaltetes Nicht-Überschrift-Element**; die Gestaltung des Kopfes hängt an einer Klasse, nicht am Tag (ADR-0018 Regel 2). Der zugängliche Name des Menüs steht schon an ihm (`aria-label` bzw. `aria-labelledby`) und bleibt unverändert.

Nicht betroffen: Das Menü „ICH BIN …" trägt seinen `h4` außerhalb des inneren `role="menu"` (`web/ansicht.js`), dort ist eine Überschrift erlaubt. Die Menüs „Berichte" (`div.k`, Muster `.menue .k`) und das Kartenmenü (`div.km-titel`, Muster `.km-titel`) sind schon ohne Überschrift. Ebenso bleiben die `h4` der Fenster mit `role="dialog"` (Boards, Läuft gerade, Defekte Dateien, Zuständige, Neuer Knoten, Verwerfen) — in einem Dialog sind Überschriften erlaubt.

Herkunft: Karte #109 „Menüköpfe in role=menu ohne Überschrift"; Befund aus [ADR-0018](Dokumentation/ADRs/0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md) „Offene Fragen" und [X00005](Dokumentation/Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md) „Offene Fragen", Folgepunkt aus dem Bau von [R00113](R00113-struktur-fuer-hilfstechnik.md) (Karte #13). Architektur bestanden 2026-11-11: keine Technikfrage.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … es ist per Tastatur bedienbar und folgt gewohnten Konventionen". Ein Menü, das sich wie das Standardmenü der Hilfstechnik verhält, gehört dazu; die Struktur für Hilfstechnik (X00005, R00113) wird damit an der letzten offenen Stelle vollständig.

## Geschäftlicher Nutzen

Wer mit einem Screenreader ein Menü öffnet, erwartet eine Liste von Einträgen. Ein `<h4>` mitten im `role="menu"` ist dagegen eine Überschrift — sie wird in der Überschriftennavigation gefunden und als Struktur angesagt, die in einem Menü nicht existiert. Der Fehler ist klein, aber er sitzt an vier Stellen und ist ein Bruch der ARIA-Regel, zu der sich das Projekt mit X00005 bekannt hat. Die Korrektur räumt ihn an der Quelle aus und schließt die letzte offene Stelle des Aspekts; danach ist kein `h1`–`h6` mehr in einem Menü, und eine Probe hält es so.

## Funktionale Anforderungen

1. In keinem Element mit `role="menu"` steht ein `h1`–`h6` (und kein `[role="heading"]`). Die vier Köpfe „SEITE" (`vSeitenPop`), „MEHR" (`vMehrPop`), „#<nr> AUF BOARD LEGEN" (`vLegenPop`) und „STATUS <Knoten>" (`vWbsStatusPop`) werden aus einem Nicht-Überschrift-Element gebildet.
2. Die Gestaltung des Menükopfes hängt an einer Klasse, nicht am Tag (ADR-0018 Regel 2). Das Element trägt den Kopftext und wird über die Klasse gestaltet.
3. Der zugängliche Name jedes Menüs bleibt unverändert — `aria-label` bzw. `aria-labelledby` und dessen Text. Die vier Menüs heißen weiter „Seite", „Mehr", „#<nr> auf Board legen" und „Status von <id>".
4. Der Kopftext bleibt wörtlich („SEITE", „MEHR", „#<nr> AUF BOARD LEGEN", „STATUS <Knoten>"), samt einem etwaigen `span.mono` (STATUS trägt die Knoten-ID als `mono`).
5. Die vier Menüs bleiben `role="menu"`, ihre Einträge `menuitem`/`menuitemcheckbox`/`menuitemradio`; Öffnen, Schließen, Fokus und Tastatur (Escape, Pfeile) bleiben unverändert.
6. Nach dem Bau trägt der Entwickler die **Systemantwort von X00005** nach: die Zeile „`h4` als Kopf in `role=menu`" unter „Offene Fragen" entfällt bzw. nennt den gebauten Stand (wie es der Aspekt für die übrigen Punkte tut).

## Nicht-funktionale Anforderungen

1. **Unsichtbar**: Die vier Köpfe sehen nach dem Bau aus wie vorher. Gemessen werden Schriftgröße, Schriftstärke, Laufweite, Farbe, Höhe, Innenabstand, Hintergrund und untere Linie; die Werte werden vor dem Bau an `main` gemessen und im Test festgeschrieben (Muster R00113 NFA 1).
2. **Rückwärtsverträglich**: Bestehende E2E-Tests bleiben grün. Kein Test greift heute einen Menü-`h4` (geprüft: `getByRole('heading')` in `e2e/tests` nur an `kultur.spec.js:408` für den Einrichten-Dialog, nicht in einem Menü); die Kontrast-Probe über `[role=menu]` (`kontrast.spec.js`) und die Menü-Proben (`r00101`, `r00106`, `r00117`) bleiben grün.
3. **Keine Breite**: Die Köpfe erzeugen keine Breite; bei 320 px scrollt kein Menü quer.

## Akzeptanzkriterien

Grundbestand: die laufende Anwendung auf einer Wegwerf-Instanz; jedes Menü lässt sich über die Oberfläche öffnen (Kopfzeile „Seite ▾" und „Mehr ▾", Berichte-Untermenü, Kontextmenü einer Karte per Rechtsklick/Menütaste, „#<nr> auf Board legen" an einem Kartenmenü, „Status" an einem WBS-Knoten).

- [ ] **1. Kein h1–h6 in role=menu**: Gegeben die Anwendung, wenn ich jedes Menü öffne, dann enthält kein Element mit `role="menu"` ein `h1`–`h6` oder `[role="heading"]`. Probe: `document.querySelectorAll('[role="menu"] :is(h1,h2,h3,h4,h5,h6,[role=heading])')` ist auf jeder geöffneten Ansicht leer.
  - Fällt durch: ein Menü mit einem `h4` (heute an vier Stellen).
  - Prüfebene: E2E `r00136-menuekoepfe.spec.js`.
- [ ] **2. Name und Text bleiben**: Gegeben ein geöffnetes Menü, wenn ich es ansehe, dann ist sein zugänglicher Name unverändert („Seite", „Mehr", „#<nr> auf Board legen", „Status von <id>", Berichte, Kartenmenü „#<nr> <Titel>"), und die vier Köpfe tragen denselben Text wie vor dem Bau.
  - Fällt durch: geänderter `aria-label`; Kopftext geändert; `span.mono` im STATUS-Kopf verloren.
  - Prüfebene: E2E US-2; `ariaSnapshot`.
- [ ] **3. Gestaltung gleich**: Gegeben die vier Köpfe, wenn ich ihre berechneten Werte lese, dann sind Schriftgröße, Schriftstärke, Laufweite, Farbe, Höhe, Innenabstand, Hintergrund und untere Linie gleich den vor dem Bau an `main` gemessenen Werten.
  - Fällt durch: `h2.dtitel`-artiger Sprung; Kopf ohne graue Fläche; Ausrichtung des `mono` rechts verloren.
  - Prüfebene: E2E US-3 (berechnete Werte); Bildschirmfotos vorher/nachher auf dem Abnahmezettel.
- [ ] **4. Mutante**: Gegeben ein Menü, in das der Kopf wieder als `h4` gesetzt wird, wenn die Probe läuft, dann ist sie rot und nennt das Menü.
  - Fällt durch: die Probe bleibt gegen die Mutante grün.
  - Prüfebene: E2E US-1 (Mutation über `page.route` auf `**/ansicht.js`).
- [ ] **5. Nichts sonst geändert**: Öffnen, Schließen, Fokus und Tastatur der Menüs verhalten sich wie vorher. `node --test e2e/einheit/` und die betroffenen Playwright-Specs (`r00101`, `r00106`, `r00117`, `kontrast`, `ziele`, `kultur`, `r00113`) sind grün.
  - Prüfebene: gesamte Suite.
- [ ] **6. Kein Artboard**: Nichts wird neu sichtbar; kein Artboard vor dem Bau. Bildschirmfotos der geöffneten Menüs (Seite, Mehr, „#<nr> auf Board legen", Status) vor und nach dem Bau liegen auf dem Abnahmezettel (PO Z. 153).
  - Prüfebene: Abnahmezettel.

## Betroffene Verzeichnisstruktur

```
web/
├── ansicht.js   # vier Menüköpfe: <h4> → Nicht-Überschrift-Element mit Klasse
│                # (vSeitenPop, vMehrPop, vLegenPop, vWbsStatusPop)
└── kd-app.css   # Gestaltung des Pop-Kopfes an der Klasse statt am Tag (.pop h4 → Klasse)
e2e/
└── tests/       # r00136-menuekoepfe.spec.js (neu): kein h1–h6 in [role=menu], Name, Mutante
```

Kein Server (`src/`), kein Dateiformat, keine Migration, kein Commit.

## Technische Überlegungen

Nach ADR-0018 (Akzeptiert) und Aspekt X00005; keine neue Architekturentscheidung. Der Befehl ist die Umsetzung des dort notierten Folgepunkts. Baustein A00009 (Oberfläche) trägt das Soll.

### Ablauf

1. **Beim Zeichnen** (`render()`) schreibt der Renderer die vier Menüs:
   - 1.1 `vSeitenPop` gibt statt `<h4>SEITE</h4>` ein Nicht-Überschrift-Element mit der Kopfklasse aus.
   - 1.2 `vMehrPop` ebenso für „MEHR".
   - 1.3 `vLegenPop` ebenso für „#<nr> AUF BOARD LEGEN".
   - 1.4 `vWbsStatusPop` ebenso für „STATUS <Knoten>" (der `span.mono` mit der ID bleibt Kind).
2. **Gestaltung**: Die Gestaltung des Pop-Kopfes liegt auf der Klasse; der `h4` in einem Fenster (`role="dialog"`) trägt dieselbe Klasse, damit die Fläche, Linie und Ausrichtung an genau einem Ort stehen (siehe Offene Fragen 2).
3. **Aspekt**: Nach dem Bau nennt die Systemantwort von X00005 den gebauten Stand, die Zeile unter „Offene Fragen" entfällt.

### Grobentwurf

- `web/ansicht.js`: die vier Renderer emittieren ein Element ohne Überschriftenrolle (z. B. `<div class="…kopf">` mit derselben inneren Struktur wie heute, inklusive `span.mono`), sonst unverändert.
- `web/kd-app.css`: eine Regel für den Pop-Kopf, die die heutigen Werte von `.pop h4` trägt (Höhe 28 px, `display:flex`, `align-items:center`, Innenabstand `0 var(--kd-s4)`, Schrift 11 px/600, Laufweite `.05em`, Farbe `--kd-muted`, Grund `--kd-sunken`, untere Linie `1px --kd-line`) und die Ausrichtung von `.pop h4 .mono`.
- Kein Server-Code.

### Änderungen an bestehenden Klassen

- `vSeitenPop`, `vMehrPop`, `vLegenPop`, `vWbsStatusPop` (`web/ansicht.js`): Kopf-Tag wechselt, Name und Einträge unverändert.
- `web/kd-app.css`: `.pop h4`/`.pop h4 .mono` werden auf die Kopfklasse gezogen.

### Gestaltung

Nichts wird neu sichtbar: Der Kopf wechselt nur sein Tag, die Gestaltung bleibt. Kein Artboard (Vision PO Z. 153, wie bei R00113). Bildschirmfotos der geöffneten Menüs vor und nach dem Bau stehen auf dem Abnahmezettel.

### Umfang

I0125: 4 Bubbles, 1,5–3 h, ungemessen (Hypothese).
- Herleitung (Summe der Bubble-Spannen): B0617 0,5-1, B0618 0,5-1, B0619 0,25-0,5, B0620 0,25-0,5.
- Gezählte Stellen (Stand `main`, `web/ansicht.js`): 4 × `<h4>` in einem `role="menu"` (SEITE, MEHR, AUF BOARD LEGEN, STATUS); 2 CSS-Regelgruppen am Tag (`.pop h4`, `.pop h4 .mono`, `web/kd-app.css`); 1 Aspekt-Zeile (X00005 Systemantwort).

### Vorplanung (Bubbles in `Dokumentation/Planung/kanbanD.md`)

| Bubble | Inhalt | Aufwand | Braucht |
|---|---|---|---|
| B0617 | Akzeptanztest „kein h1–h6 in role=menu" über alle Menüs, mit Mutante | 0,5-1 | — |
| B0618 | Vier Menüköpfe auf ein Nicht-Überschrift-Element mit Klasse | 0,5-1 | B0617 |
| B0619 | Gestaltung des Pop-Kopfes an der Klasse (CSS) | 0,25-0,5 | B0618 |
| B0620 | X00005-Systemantwort nachführen | 0,25-0,5 | B0618 |

Der Akzeptanztest (B0617) wird zuerst gebaut und ist gegen heute rot (vier Treffer). B0618 und B0619 sind ein Paar: das Markup ohne die Klasse ließe den Kopf ungestaltet, die Klasse ohne das Markup greift nicht.

## Tests

Nach Skill `test-pyramide`. Die Probe beobachtet die gezeichnete Seite (Skill `test-ehrlichkeit`).

- **E2E (Playwright)**: neu `e2e/tests/r00136-menuekoepfe.spec.js`. Jedes Menü öffnen und über `page.locator('[role=menu] :is(h1,h2,h3,h4,h5,h6,[role=heading])')` auf null prüfen (US-1); Name und Kopftext je Menü (`ariaSnapshot`, US-2); die berechneten Werte der vier Köpfe gegen die festgeschriebenen Werte aus NFA 1 (US-3). Ein Test läuft über `page.route('**/ansicht.js', …)` gegen die Mutante „h4 zurück im Menü" und erwartet rot (AK 4).
- **Kein neuer Unit-Test nötig**: die Prüfung ist Markup/CSS am gezeichneten DOM. `e2e/einheit/fokus.test.js` (jedes `role=menu` hat einen Namen) bleibt als Schutz grün.
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #109.
- **Mitlaufend grün**: `r00101-kopfzeile.spec.js`, `r00106-menue-eintraege.spec.js`, `r00106-fokus.spec.js`, `r00117-kopfzeile.spec.js`, `kontrast.spec.js` (Probe über `[role=menu]`), `ziele.spec.js`, `kultur.spec.js`, `r00113-struktur.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- ADR-0018 (Akzeptiert, Regeln 2 und „Durchsetzung"); Aspekt X00005 (Offene Fragen); ADR-0011 (Kontrast, unberührt).
- Abhängig von (grün): I0102 Struktur für Hilfstechnik (R00113) — der Aspekt und die Aussage über `#main` stehen; die Menüs liegen in `#over` außerhalb von `#main` und werden deshalb von der Routenprobe der R00113 nicht erfasst.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockieren. Empfehlungen des planers (Entscheidungen im Bericht):

1. **Artboard?** Kein Artboard: es wird nichts neu sichtbar, der Kopf wechselt nur sein Tag (Vision PO Z. 153, wie bei R00113). Auflage: Bildschirmfotos der geöffneten Menüs vor/nach auf dem Abnahmezettel. Entschieden mit dem Befund (Karte #109).
2. **Eine Klasse für alle Pop-Köpfe?** Empfehlung: **eine** Klasse trägt die Gestaltung des Pop-Kopfes; die Fenster (`role="dialog"`) behalten ihr `h4`, tragen aber dieselbe Klasse. So steht die Gestaltung an genau einem Ort (ADR-0018 Regel 2), und es entstehen nicht zwei gleichlautende Regeln. Der Menü-Kopf ist ein `<div>`/`<span>` ohne Überschriftenrolle. Reine Bauentscheidung, kein neuer Umfang für den Menschen.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

- Bildschirmfotos der vier geöffneten Menüs (Seite, Mehr, „#<nr> auf Board legen", Status) vor und nach dem Bau für den Abnahmezettel.
- X00005-Systemantwort nachführen (FA 6) und die zugehörige „Offene Fragen"-Zeile streichen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist ein Regelbruch: In einem `role="menu"` sind nur Einträge, Gruppen und Trenner erlaubt, und vier Menüs tragen dort eine Überschrift. Für Sehende ist das unsichtbar; für Hilfstechnik ist es eine falsche Struktur — der Kopf erscheint in der Überschriftennavigation und wird als Struktur angesagt, die in einem Menü nicht existiert. Weil der Menüname schon am Menü steht (`aria-label`), braucht der Kopf keine Überschrift: er ist nur eine visuelle Gruppenbeschriftung. Die Änderung ist an der richtigen Stelle — sie ersetzt den Tag an den vier Renderern und zieht die ohnehin vorhandene Gestaltung auf eine Klasse, statt das Menü oder den Namen umzubauen. Die Wirkungskette: falsch ausgezeichneter Menükopf → aus dem Accessibility-Baum als Überschrift entfernt → das Menü verhält sich wie das Standardmenü, das Hilfstechnik erwartet. Der Hebel ist das Markup an diesen vier Stellen und nicht der Name oder die Struktur `#main`: die Struktur aus R00113 ist gebaut, der Menüname ist bereits korrekt; es fehlt allein der richtige Tag. Mit einer Probe, die gegen die Mutante „h4 zurück" rot wird, bleibt die Konvention erhalten und die letzte offene Stelle von X00005 ist zu.

## Missing-Docs
- **X00005 Systemantwort**: die Zeile „`h4` als Kopf in `role=menu`" unter „Offene Fragen" nennt den gebauten Stand nach dem Bau (FA 6).
- **ADR-0018 Offene Fragen**: der Vorschlag „Die Bereinigung ist ein Vorschlag, nicht Teil von #13" ist mit dieser Anforderung eingeplant; nach dem Bau als erledigt vermerken.
- **Glossar**: kein Eintrag für „Menü" (`role=menu`) und „Kopf". Die Begriffe stehen nur in ADRs und Anforderungen.

## Notizen

**Eigene Interaction unter D0002.** Die Menüs gehören zum Board (Kopfzeile, Kartenmenü, Spalten-Menüs). Muster: I0096/R00107 und I0106/R00117 (kleine eigene Interaction mit eigener Anforderung unter D0002); die h4-Frage steht in der WBS schon als offener Folgepunkt zu I0102.

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — Nicht-Überschrift-Element mit Klasse (gewählt, ADR-Vorgabe)**: der Tag wechselt, die Gestaltung zieht auf die Klasse; Name, Einträge und Tastatur bleiben. Deckt sich mit ADR-0018 Regel 2 und dem Muster `.menue .k`/`.km-titel`.
- **B — `aria-hidden="true"` am `h4`**: nimmt den Kopf aus dem Accessibility-Baum, lässt aber einen `h4` im Markup stehen und ist gegen den sichtbaren Text gerichtet; verworfen (der Kopf bleibt nützlich und soll sichtbar bleiben).
- **C — den Kopf aus dem Menü heraus verschieben**: baut eine zweite sichtbare Beschriftung außerhalb des Menüs, obwohl der Menüname schon steht; ändert Gestaltung und Lage; verworfen.

**Verwiesenes**
- Karte #109 „Menüköpfe in role=menu ohne Überschrift" (Herkunft: Detailplanung #13/I0102, R00113, ADR-0018 „Offene Fragen", PO-Entscheidung 2026-11-08).
- ADR-0018 „Offene Fragen"; X00005 „Offene Fragen"; R00113 „Nicht Teil".
