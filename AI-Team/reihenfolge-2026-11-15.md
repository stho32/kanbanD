# Reihung der Karten in „Architektur“ nach Bündelung — product-owner (2026-11-15)

Auftrag des Betreibers 2026-11-15: **kleine Karten bündeln** (neue Regel der Fabrik,
`AI-Team/factory.md`, „Kleine Karten bündeln“). Kleine Karten, die dieselben Dateien
oder dieselbe Ansicht berühren, werden zu Paketen von höchstens fünf zusammengelegt;
geplant, gebaut, geprüft und zusammengeführt wird einmal am Worktree der führenden
Karte. **Nicht** gebündelt wird, was Datenformat, Zugriffsgrenzen oder eine eigene
Technik-/Gestaltungsfrage berührt.

Maßstab der Priorität bleibt meine Reihenfolge vom 2026-11-15
(`AI-Team/reihenfolge-2026-11-15.md`). Ein Paket steht an der Stelle seines
dringendsten Mitglieds. Seither: #164 und #89 erledigt; #155 in den Auto-Reviews;
#39 (422 statt 400) läuft bereits allein — nicht gebündelt; #143, #69, #152 gelöscht,
#160 im Backlog; die Kostenkette #166 → #165 → #167 direkt nach #158 (Protokoll
`po-entscheidungen.md`, Z. 236/246).

Worterklärung: „Mitglieder“ sind die Karten, die mit der führenden Karte an deren
Worktree gebaut werden. Die führende Karte trägt den Kommentar mit den Mitgliedern;
jedes Mitglied trägt „wird mit #<nr> gebaut“.

| Nr | führende Karte | Mitglieder | Titel (Arbeitstitel) | Kurzgrund (verbindet Dateien/Ansicht) |
|---|---|---|---|---|
| 1 | #39 | — | Typfehler im Rumpf ergeben 422 statt 400 | Einzelkarte: läuft bereits allein in der Architektur (architekt), Auftrag: nicht bündeln |
| 1a | #168 | — | Typfehler in Pfad- und Abfrageparametern ergeben Klartext statt 400 {fehler} | Einzelkarte, unmittelbar nach #39 (product-owner 2026-11-15): derselbe Kontraktbruch, andere Mechanik; braucht #39 |
| 2 | **#54** | #96, #93, #87, #97 | **Aufgabenfenster: Felder und Fenstermeldung** | Alle im Aufgabenfenster D0003: Titelfeld (Esc #54, `aria-invalid` #96), Feld „Zeit nachtragen“ (#93), Dateischlüssel als Hilfstext (#87), Fenstermeldung/Bildschirmtastatur (#97). Dateien: `web/app.js`, `web/ansicht.js`, `web/zeiten.js` |
| 3 | #44 | — | Ungültiger Schlüssel fällt aus der Suche | Einzelkarte: eigene Technikfrage (`Fremdschluessel::pruefen`, Suchindex, Rust) ohne Partner in der Spalte |
| 4 | #45 | — | Wiederöffnen auf anderem Board lässt Karte im alten „Fertig“ | Einzelkarte, wird gebaut: Der Betreiber hat am 2026-11-13 entschieden, dass beim Wiederöffnen die alte Board-Zeile entfernt wird (berichtigt 2026-11-15, product-owner) |
| 5 | #121 | — | Besprechen: 403 oder 423 bei defektem Board | Einzelkarte: Zugriffsgrenze (Protokoll Z. 228: 423 einheitlich); Zugriffsgrenzen werden nicht gebündelt |
| 6 | **#140** | #57, #68, #55 | **Oberfläche: schmale Breite, Kontrast, kleine sichtbare Mängel** | Alles sichtbare Optik derselben Dateien: kein Querscrollen 320–414 px (#140), gedämpfte Elemente ≥ 4,5:1 (#57), gekürzte Fehlerzeile im Einrichtungsmodus (#68), gesammelte kleine Funde aus #6/#8/#18 (#55). Dateien: `web/kd-app.css`, `web/ansicht.js`, `web/app.js` |
| 7 | #163 | — | tests/live.rs:57 Frist des Datei-Watchers härten | Einzelkarte: eigene Technikfrage (Rust-Test, anderer Ort und andere Abhilfe) |
| 8 | #161 | — | Beschreibung: Bearbeiten über Stift-Symbol, Text kopierbar | Einzelkarte: Betreiber-Auftrag, eigene Gestaltungsfrage (`web/ansicht.js`) |
| 9 | #162 | — | E2E-Wackler Teil 2 nach ADR-0026 | Einzelkarte: eigene Technikfrage (Testharness über viele Specs) |
| 10 | #154 | — | Burndown: Zugang/Abgang je Tag, Zielspalte wählbar | Einzelkarte der Berichtskette (Kern des Betreiber-Auftrags) |
| 11 | #156 | — | Zielspalte „Erledigt heißt“ je Board | Einzelkarte der Berichtskette (Board-Einstellung, `web/berichte.js`) |
| 12 | #157 | — | Durchsatz: Von-Spalte wählbar, Zugangsbalken | Einzelkarte der Berichtskette, Label `datenformat` (neuer Board-Schlüssel) |
| 13 | #159 | — | Durchlaufzeit und Kumulativer Fluss folgen der Zielspalte | Einzelkarte der Berichtskette (`web/berichte.js`) |
| 14 | #158 | — | „Wie lange noch“: Hinweis Zugang ≥ Abgang | Einzelkarte der Berichtskette (`web/berichte.js`) |
| 15 | #166 | — | Kosteneinträge mit Zeitstempel, Rolle, Spalte | Einzelkarte: Label `datenformat` (Datengrundlage) — wird nie gebündelt |
| 16 | #165 | — | Kosten-Bericht: Zeitraum von–bis, Aufgabenliste | Einzelkarte: eigener Bericht (`web/berichte.js`); baut auf #166 |
| 17 | #167 | — | Kosten-Bericht: Kosten je Rolle aufklappen | Einzelkarte: eigener Bericht (`web/berichte.js`); baut auf #166/#165 |
| 18 | #147 | — | Instanz verrät ihren Ordner: GET /api/instanz | Einzelkarte: eigene Technikfrage (neuer Endpunkt/API-Vertrag); Betreiber-Auftrag |
| 19 | #153 | — | Direktlinks auf Aufgaben | Einzelkarte: neues Feature (Routing/Ansicht), eigener Umfang |
| 20 | **#149** | #148, #150 | **Warteschlange: Frist und Meldung bei gescheiterter Anfrage** | Alle am Schreibweg `web/app.js`/`web/warteschlange.js` (aus #80): Frist für `api()` (#148), Meldung der gescheiterten eigenen Anfrage vom Board (#149), Fensterfall als Probe (#150) |
| 21 | **#141** | #59, #151, #111 | **Barrierefreiheit: Tastatur, Fokus und Struktur** | Alle a11y derselben Ansichten: Fokus beim Öffnen/Erreichbarkeit (#141), Fokusring im Kopf (#59), Sperrform der Auslöser mit Fokus (#151), `aria-current`/Überschriften (#111). Dateien: `web/fokus.js`, `web/tastatur.js`, `web/sperre.js`, `web/ansicht.js`, `web/kd-app.css` |
| 22 | **#102** | #108, #114 | **Rückgängig, Fußmeldung und Timer-Hinweise** | Alle Meldungs-/Hinweiswege in `web/app.js`: Herkunft entfernen mit Rückgängig (#102), stille Fehler aus #12 (#108), vergessene Timer/`aria-label` (#114) |
| 23 | #86 | — | Wiederansage der Fenstermeldung prüfen | Einzelkarte: eigene Technikfrage (stabiler Meldungsknoten, ADR-Nachtrag ADR-0007/0015) |

## Allein stehende Karten (Kurzgrund)

- **#39** — läuft bereits allein (Auftrag: nicht bündeln).
- **#44** — eigene Rust-Technikfrage (Suchindex/Fremdschlüssel), kein passender Partner.
- **#45** — wird gebaut (Entscheidung des Betreibers vom 2026-11-13), nur nicht gebündelt.
- **#121** — Zugriffsgrenze (bereits entschieden Z. 228); Zugriffsgrenzen werden nie gebündelt.
- **#147** — neuer Endpunkt (eigene Technikfrage).
- **#153** — neues Feature (eigener Umfang).
- **#161** — eigene Gestaltungsfrage (Betreiber-Auftrag).
- **#162** — eigene Technikfrage (Testharness).
- **#163** — eigene Technikfrage (Rust-Test).
- **#86** — eigene Technikfrage (stabiler Meldungsknoten, ADR-Nachtrag).
- **#154, #156, #157, #159, #158** — Berichtskette, je eigene Technik-/Gestaltungsfrage.
- **#166, #165, #167** — Kostenkette: Datenformat bzw. eigener Bericht.

## Nicht in dieser Liste

- **#33** und **#77** stehen in `boards/entwicklung.md` unter „Architektur“, tragen aber
  ein Archivdatum (`archived: 2026-11-11` bzw. `2026-11-13`) und waren schon in meiner
  Reihenfolge vom 2026-11-15 nicht enthalten. Der Director klärt, ob die Board-Zeilen
  veraltet sind.
- **#160** liegt im Backlog (geparkt).
