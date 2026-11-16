---
id: R00187
status: Neu
datum: 2026-11-16
---

# R00187: Schmale Breite 320–414 px: kein Querscrollen, nichts abgeschnitten

## Beschreibung

Herkunft: Karte #140 (Sammelkarte aus #110, #71, #121, #100, #72, #63, dazu aus #116 und #122; Plausibilitätsprüfung des Betreibers 2026-11-12). Das [schmale Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) aus [R00077](R00077-responsive-fuer-tablet-und-handy.md) deckt Board, Aufgabenfenster und Einstellungen; an sechs Stellen läuft die Seite bei 320, 375 oder 414 px noch quer, schneidet ab oder wird unlesbar klein. Fehlender Umfang an Stellen, die R00077 nicht nennt — kein Fehler an dessen Kriterien.

Am Code gelesen (2026-11-16, nicht gefahren): „Spalten einrichten“ stellt die Vorschau fest 400 px breit neben die Spalteneditoren (`.setup`, `.einr{flex:0 0 400px}`, ohne Regel für schmal); der erste Start stellt die Vorschau neben das Formular (`.first`, ohne Regel für schmal); die Fußzeile hat für Knöpfe keine Kürzung; die Tabelle der Seite `GET /api` bricht nicht um (`.pt td{white-space:nowrap}`); die Diagramme stauchen ihre 800 px breite Zeichenfläche samt 11-px-Schrift auf die Fensterbreite.

**Gewünscht:** An diesen Stellen scrollt die Seite bei 320, 375 und 414 px nicht quer, nichts ragt über seinen Rahmen, und Beschriftungen bleiben lesbar. Bei 1280 px bleibt alles, wie es ist.

Eine Zeichnung ist nicht nötig: es entsteht keine neue Bedienung; wo sich die Anordnung ändert, nennt das Kriterium die Zielanordnung. Zahlt ein auf: [Vision](R00000-vision.md) — dieselbe Oberfläche ist auf dem Handy bedienbar (R00077; WCAG 1.4.10 Reflow).

## Akzeptanzkriterien

**Ausgangslage:** Ordner mit dem Board „Entwicklung“ (Spalten „Zu erledigen“, „In Arbeit“, „Erledigt“), fünf Aufgaben, davon eine auf keinem Board, und einer defekten Aufgabendatei (unlesbares Frontmatter); für AK 2 ein leerer Ordner. Geprüft je bei 320, 375 und 414 px Breite, hell und dunkel, mit Maus und mit Touch. „Scrollt nicht quer“ heißt: `document.documentElement.scrollWidth` = Breite des Fensters.

- [ ] **AK 1 Spalten einrichten:** Im Modus „Spalten einrichten“ scrollt die Seite nicht quer (heute 400 px bei 320, 401 px bei 375). Zielanordnung: die Vorschau der Board-Datei steht in voller Breite unter den Spalteneditoren statt rechts daneben; die Spalteneditoren scrollen in ihrem eigenen Bereich waagrecht wie die Spalten des Boards. „Verwerfen“ und „Fertig“ bleiben sichtbar.
- [ ] **AK 2 Erster Start:** Der erste Start in einem leeren Ordner scrollt nicht quer (heute 493–497 px bei 320). Zielanordnung: beide Vorschauen (`kanbanD.md`, Board-Datei) stehen in voller Breite untereinander unter dem Formular; alle Felder und der Knopf zum Anlegen sind ohne Querscrollen erreichbar.
- [ ] **AK 3 Fußzeile:** Mit einer defekten Datei und einem Board überschneiden sich bei 320 px die Teile der Fußzeile nicht (heute liegt „1 defekte Datei“ über „1 Board“). „1 defekte Datei“ bleibt ganz lesbar und anklickbar; was daneben nicht passt, kürzt mit „…“ oder entfällt.
- [ ] **AK 4 Aufgabenliste und Board-Name:** Die Aufgabenliste scrollt nicht quer; zwischen Bereichsname und Zahl steht ein sichtbarer Abstand von mindestens 4 px („alle 5“, heute „alle5“); „auf Board legen ▾“ bleibt innerhalb seiner Zelle, sein Menü innerhalb des Fensters. Auf dem Board ist der Board-Name bei Touch und 320 px mindestens 60 px breit, solange keine Zeit läuft (heute laut Karte #63 21 px, „E…“).
- [ ] **AK 5 API-Seite und Diagramme:** Die Seite `GET /api` scrollt bei 320 px nicht quer und ihre Tabelle nicht in sich (`main.scrollWidth ≤ main.clientWidth`, heute 8766); Pfad und Zweck brechen um. In Burndown, kumulativem Fluss, Durchsatz und Durchlaufzeit ist die Achsenbeschriftung bei 320 und 375 px mindestens 10 px groß gerendert (heute rund 4–8 px: 11 px × 296 / 800 ≈ 4 px bei 320); die Seite scrollt dabei nicht quer, das Diagramm darf in seinem Rahmen waagrecht scrollen.
- [ ] **AK 6 Bleibt:** Bei 1280 px stehen Vorschau und Formular bzw. Spalteneditoren nebeneinander wie heute, die Fußzeile zeigt alle Teile; Board, Aufgabenfenster und Einstellungen scrollen bei 320–414 px weiter nicht quer.

## Tests

E2E als Spec, zuerst die Messung über alle Stellen, Breiten und Themen (heute an den genannten Stellen rot). Was die Messung schon grün zeigt, bleibt als Test stehen und wird nicht umgebaut. Gegenprobe: die alte Breite (`.einr` 400 px neben den Editoren, Raster des ersten Starts) macht die Messung wieder rot.

## Implementierungshinweise

- Vorschlag, keine Vorschrift: Schwelle 900 px wie bei den Einstellungen (`@media (max-width:900px){.einrichten{display:block}}`, `web/kd-app.css:1050`) für `.setup` und `.first`; die Spalteneditoren tragen ihre Breite inline (`--bw:236px`, `web/ansicht.js:2191`).
- Fußzeile: `vStatus`, `web/ansicht.js:2225`; `.stat`, `web/kd-app.css:610–614`. Der Defekt-Knopf ist ein `button`, die Kürzungsregel gilt nur für `span`.
- Aufgabenliste: Regeln für schmal stehen schon (`web/kd-app.css:894–902`, R00108) — erst messen. Die Zahl klebt, weil `.seg>span` ein Flex-Behälter ohne Abstand ist (`web/kd-base.css:35`).
- API-Seite: `src/web/endpunkte.rs:136–144` (eigenes `<style>` der Seite).
- Diagramme: `.diagramm{width:100%;height:auto}` (`web/kd-app.css:711`), Rahmen `.bericht-rahmen{overflow-x:auto}` (`:575`).
- **Nicht hinein:** neue Bedienelemente · Umbau der Kopfzeile über den Board-Namen hinaus · die Punkte aus R00188.

## Warum löst diese Anforderung das Problem?

Auslöser: Wer kanbanD auf dem Handy öffnet, muss beim ersten Start und beim Einrichten der Spalten quer schieben, sieht in der Fußzeile zwei Texte übereinander und kann Diagrammachsen nicht lesen. Stehen Vorschau und Formular untereinander und brechen Tabellen um (X), passt jede dieser Stellen in die Fensterbreite (Y); der Mensch richtet ein Board am Handy ein und liest Berichte, ohne zu schieben oder zu zoomen (Z).

## Offene Fragen

Keine.
