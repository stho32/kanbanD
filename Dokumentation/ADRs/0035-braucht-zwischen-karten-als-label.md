# ADR-0035: `Braucht` zwischen Karten — das Label `braucht:<nr>` ist der eine Träger

**Status**: Akzeptiert (2026-11-20); Darstellung an Karte und Fenster bis zur Freigabe der Artboards D0002/D0003 durch den product-owner Vorgeschlagen
**Datum**: 2026-11-20
**Entscheider**: Claude (autonom, architekt, Lauf 228-architekt-1, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #228 „Braucht zwischen Karten“; folgt aus ADR-0034 (N1 Punkt 2, N3 Regel 4) und der Vision („`Braucht`-Beziehungen bleiben echte Abhängigkeiten zwischen Karten“). Vorgabe des PO (po-entscheidungen Z. 431, 445–446): **ein Träger, nicht zwei**; zuerst das Label prüfen.
**Erprobt durch**: — (keine Probe gebaut; Ist am Code belegt, Stand `eed7f09c`; Bestand gezählt in `~/Projekte/Kanban-Boards/*` am 2026-11-20)

## Kontext

- Mit #226 (`bfb3cc32`) ist „wartet auf“ entfallen; es entstand nur aus der Spalte `Braucht` der WBS.
- Heute trägt die Abhängigkeit schon ein Label: `labels: [feature, "braucht:226"]`. kanbanD kennt es nur als Text: Chip `.lbl` (`web/ansicht.js:201`), Filter `label=braucht:226` und `label=braucht:*` (`src/dienst/aufgabenfilter.rs`). Die Factory setzt und liest es als Text (Director-Regel „Braucht = Code auf main“, R00011 „Wartende überspringen“); `werkzeuge/board.py` wertet es nicht aus, gibt es aber in `naechste` und `stand` aus.
- **Bestand**: 46 Aufgabendateien tragen im Frontmatter ein Label `braucht:…`, alle in der Form `braucht:<Zahl>`; keine andere Form.
- **Nummern** vergibt die Ablage je Ordner (`src/ablage.rs:173`), über alle Boards des Ordners hinweg. Eine Nummer ist also im Ordner eindeutig, auch zwischen Boards.
- **Erledigt** gibt es schon als Begriff: `POST /api/aufgaben/erledigen` versteht darunter „in der letzten Spalte oder archiviert“.

## Qualitätsziele

- **Ein Träger** (PO): Eine Abhängigkeit steht an genau einer Stelle der Datei. Szenario: Die Factory setzt `braucht:230` per `PATCH labels`; ohne weiteren Schritt zeigen Karte und Fenster „wartet auf #230“.
- **Kein Bruch** für Factory und Bestand: Die 46 Dateien und die Werkzeuge der Factory laufen unverändert (0 Änderungen an `werkzeuge/`).
- **Prüfbar an der Tür**: Ein Agent kann keine kaputte Abhängigkeit schreiben (Form, Selbstbezug, unbekannte Nummer, Zyklus → 400).

## Optionen

| Variante | Stärke | Schwäche |
|---|---|---|
| **L — Label `braucht:<nr>` als Träger** (kanbanD deutet es) | kein neues Feld, kein Formatwechsel, 46 Dateien und Factory sofort richtig; Filter gibt es schon | ein Label mit Bedeutung ist freier Text: Tippfehler wären stumm, ohne Prüfung an der Tür; Label-Chip und „wartet auf“ würden doppelt erscheinen |
| F — Feld `needs: [<nr>]` | getypt, im Schema sichtbar, eigene API | Formatwechsel (`BEKANNT`, OpenAPI, Schreiber), Übernahme der 46 Labels, Factory muss umstellen; bis dahin **zwei Träger** — gegen die Vorgabe des PO |
| H — Feld, Label gespiegelt | beide Leser zufrieden | zwei Träger, die auseinanderlaufen können; verworfen ohne Weiteres |

Vorbild für ein Label mit Bedeutung gibt es: `im-pair` steuert die Rechnung des Verlaufs (`src/verlauf.rs:48`).

## Entscheidung

**L.** Das Label `braucht:<nr>` ist der einzige Träger. kanbanD deutet es; ein Feld `needs` entsteht nicht.

1. **Form**: `braucht:<n>` ohne Groß/Klein, `<n>` eine Kartennummer ≥ 1 ohne führende Null und ohne Leerzeichen. Mehrere Labels = mehrere Abhängigkeiten. Lesen ist tolerant: Ein Label mit dem Präfix, aber anderer Form (`braucht:kd#12`, `braucht:I0004`) bleibt ein gewöhnliches Label ohne Bedeutung.
2. **Schreiben** (`POST /api/aufgaben` `labels`, `PATCH /api/aufgaben/{nr}` `labels`, Oberfläche): **neu hinzukommende** `braucht:`-Labels werden geprüft, unverändert mitgeschickte nicht (wie `klasse`, R00195). Jeder Fehler → 400, nichts wird geschrieben:
   - andere Form mit dem Präfix: „braucht: erwartet eine Kartennummer (braucht:12)“;
   - Selbstbezug: „#n kann nicht auf sich selbst warten“;
   - Nummer ohne Aufgabendatei im Ordner (archivierte zählen als vorhanden);
   - Zyklus über die gedeuteten Labels aller Aufgaben des Ordners: die Meldung nennt den Kreis (`#228 → #230 → #228`).
   Zyklen, die durch Bearbeiten der Dateien entstehen, sind lesend harmlos: Beide Karten warten.
3. **Erledigt**: Die gebrauchte Karte ist archiviert oder liegt in der letzten Spalte ihres Boards. Auf keinem Board heißt offen. So zählt auch `erledigen`.
4. **Lesen (API)**: Jede Aufgabe trägt das abgeleitete, nur lesbare Feld `braucht: [{nummer, titel, erledigt}]` in der Reihenfolge der Labels. Fehlt die Datei, steht dort `titel: null, erledigt: false`. Geschrieben wird nur über `labels`; `braucht` in `POST` oder `PATCH` → 400 „braucht über labels setzen (braucht:<nr>)“. Das Feld ist eine Rechnung, kein zweiter Träger.
5. **Filter**: `wartet=ja|nein` auf `GET /api/aufgaben` (mindestens ein offenes `braucht`). `label=braucht:226` („wer wartet auf #226“) bleibt.
6. **Board-übergreifend**: Innerhalb eines Ordners gilt es von selbst, weil die Nummern dort eindeutig sind. Über Ordner und Instanzen hinweg (`braucht:kd#12`) **nicht**: Es gibt keinen Leser dafür, und die Factory hat je Projekt einen Board-Ordner.
7. **Oberfläche** (Vorschlag, Freigabe durch den PO über die Artboards):
   - **Karte (D0002)**: je **offener** Abhängigkeit ein Chip „wartet auf #n“ an der Stelle der Labels; statt des Label-Chips, nicht zusätzlich. Erledigte erscheinen an der Karte nicht. Titel der gebrauchten Karte im Tooltip.
   - **Fenster (D0003)**: in der Zeile der Labels jede Abhängigkeit als Chip: offen „wartet auf #n <Titel>“, erledigt gedämpft „#n erledigt“, unbekannt als Warnung „#n fehlt“. Klick öffnet die gebrauchte Karte; × entfernt das Label. Hinzufügen über das Label-Feld (`braucht:12`); eine 400 erscheint wie andere Fehler des Felds.
8. **Factory**: unverändert. `board.py` liest Labels als Text weiter. Ihre Zugregel („Code auf main“) ist strenger als „erledigt“ und bleibt ihre Sache. Später kann `naechste` `wartet=nein` nutzen (Vorschlag an den Director, kein Muss).

## Konsequenzen

- Positiv: ein Träger, kein Formatwechsel, keine Übernahme, kein Legacy-Weg; die 46 Bestandsdateien zeigen sofort „wartet auf“; die Factory bricht nicht.
- Inkauf: Die Bedeutung steckt in einer Namenskonvention. Wer die Datei von Hand bearbeitet, kann `braucht:abc` schreiben; das bleibt dann ein stummes Label. Abhilfe ist nur die Tür (API, Oberfläche), nicht der Leser. Das Präfix `braucht:` ist für freie Labels künftig belegt.
- Inkauf: Die Zyklusprüfung liest beim Schreiben die Labels aller Aufgaben des Ordners. Der Ordner ist ohnehin geladen, die Kosten sind linear; bei 230 Karten unerheblich.

## Pre-Mortem

- (a) Jemand baut doch ein Feld `needs`, „weil es sauberer ist“. Dann gibt es zwei Träger; die Abnahme „PATCH labels → wartet auf“ hält das fest.
- (b) Die Oberfläche zeigt Label-Chip und „wartet auf“ nebeneinander. Die e2e-Probe verlangt genau einen Chip je Abhängigkeit.
- (c) „Erledigt“ wird neu erfunden (etwa die Spalte „Abnahme“). Es gilt der Begriff von `erledigen`; ein Modultest teilt die Funktion.
- (d) Die Prüfung beim Schreiben greift auch auf unverändert mitgeschickte Labels. Dann bricht die Factory, sobald eine gebrauchte Karte gelöscht wurde. Die Abnahme schickt ein unverändertes `braucht:<gelöscht>` mit und erwartet 200.

## Schnitt

| Scheibe | Inhalt | Abnahme-Probe (vorher rot) |
|---|---|---|
| **S1 API** (zuerst, ohne Oberfläche) | Deutung im Modell (reine Funktion: Labels → Nummern; Erledigt-Funktion geteilt mit `erledigen`), Prüfung an der Tür (Form, Selbstbezug, Nummer, Zyklus; nur neue Labels), abgeleitetes `braucht` in Einzel- und Listenantwort, `wartet=ja|nein`, `braucht` beim Schreiben → 400, OpenAPI und `/api/endpunkte`; Modell A00005/A00006 nachziehen | Rust-Integration: #2 mit `braucht:1` → `braucht: [{nummer:1, erledigt:false}]`; #1 in die letzte Spalte → `erledigt:true`; `wartet=ja` liefert #2 nur vorher. `PATCH labels` je mit `braucht:2` an #2, `braucht:999`, `braucht:x`, Kreis #1↔#2 → 400 und Datei unverändert. Unverändert mitgeschicktes `braucht:<gelöscht>` → 200. Bestandsdatei mit `"braucht:226"` liest richtig. Factory: `proben/alle.sh` grün gegen die neue Instanz. |
| **S2 Oberfläche** (braucht S1 und die freigegebenen Artboards) | Chip an der Karte (nur offen), Chips im Fenster (offen, erledigt, fehlt), Klick öffnet die Karte, × entfernt das Label, 400 am Label-Feld | e2e: Karte mit `braucht:` offen → genau ein `.wartet` „wartet auf #n“, kein `.lbl` für dieses Label; nach Erledigen der gebrauchten Karte kein Chip an der Karte, im Fenster „#n erledigt“; × entfernt das Label (Datei ohne Label); `braucht:999` im Feld → Fehlermeldung, Datei unverändert. Kontrast der drei Zustände in Hell und Dunkel (ux-reviewer). |

**Für den gestalter** (D0002 Board, D0003 Aufgabe; Freigabe durch den PO):
- D0002: Chip „wartet auf #n“ an der Karte (Lage wie die Labels, eigene Gestalt, Sanduhr wie `zw-wartet` der Review-Seite), Tooltip mit dem Titel; zwei offene Abhängigkeiten auf schmaler Karte.
- D0003: Zeile der Labels mit den drei Zuständen offen, erledigt (gedämpft) und fehlt (Warnung), × zum Entfernen, Fehlertext unter dem Feld bei 400.
- Dazu, schon im Kommentar des Directors: Herkunfts-Chip als `span` ohne Link (Stand nach #226).

## Quellen / Bezüge

ADR-0034 (N1 Punkt 2, N3 Regel 4), Vision R00000 („Die Aufgaben sind der Stand“), R00195 (Prüfung nur geänderter Werte), `src/ablage.rs:173`, `src/dienst/aufgabenfilter.rs`, `web/ansicht.js:201`, `src/web/endpunkte.rs:88` (`erledigen`), `src/verlauf.rs:48` (`im-pair`); Factory `werkzeuge/board.py:161` (nur gelesen).
