---
id: R00186
status: Erledigt
datum: 2026-11-16
---

# R00186: Warteschlange — Frist je Anfrage und ehrliche Meldung bei gescheiterter Anfrage

## Beschreibung

Herkunft: Paket der Karten **#149** (führt), **#148** und **#150**, alle angelegt aus #80 ([R00147](R00147-behebung-gescheitertes-nachladen-verschluckt-eigene-aenderung.md)); gebündelt vom product-owner am 2026-11-15. Drei Reste desselben Wegs „eigene Änderung → Warteschlange → Nachladen“:

- **#149 — falsch gebaut (Rest):** Der Kartenknopf der nächsten Teilaufgabe setzt den Haken sofort (`web/app.js:1889–1899`). Ist der Server weg, scheitern Anfrage und Nachladen; die Meldung „nichts geändert“ steht inzwischen im [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md) auf dem Board (R00147 AK 7/8, gebaut), **der Haken bleibt aber stehen** — die Karte widerspricht der Meldung und der Datei.
- **#148 — fehlender Umfang (ADR-0025 Nachtrag N1, Restlücke):** `api()` hat keine Frist (`web/app.js:98–113`). Bleibt eine Anfrage unbeantwortet, endet das Glied der Warteschlange nie, der Zähler bleibt über 0, keine weitere eigene Änderung wird gesendet und jedes [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) wird übersprungen (`ereignis`, `web/app.js:3447`) — Stillstand ohne Meldung.
- **#150 — Härtung:** Scheitert das Nachladen bei einer Änderung aus dem [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md), steht die Meldung an dessen Hinweis-Anker; gebaut, nie geprobt. Ein **Programmfehler** beim Nachladen (Antwort 200 mit ungültigem JSON) wird wie ein Netzfehler gefangen und hinterlässt keine Spur in der Konsole (`web/warteschlange.js:35`).

**Gewünscht:** Jede Anfrage über `api()` endet spätestens nach der **Frist von 15 s** ab dem Absenden — mit Antwort oder mit dem Fehler „Keine Antwort vom Server“ (ADR-0025 Nachtrag N4). Die Warteschlange läuft danach weiter. Scheitert eine eigene Änderung vom Board, verschwindet der vorschnelle Haken. Der Fensterfall und der Programmfehler sind als Proben festgehalten.

Eine Zeichnung ist nicht nötig: alle Meldungen stehen im vorhandenen Hinweis bzw. im Fuß des Aufgabenfensters. Zahlt ein auf: [Vision](R00000-vision.md) — die Dateien sind der einzige Speicher; was die Oberfläche zeigt, widerspricht ihnen nicht.

## Akzeptanzkriterien

**Ausgangslage:** Board `entwicklung`, Karte #1 „Abnahme prüfen“ mit den offenen Teilaufgaben „eins“, „zwei“, „drei“, Karte #2 „Board aufräumen“ (über die API herstellbar); Person `st` (Mensch) im Browser, Live-Verbindung steht. Fehler entstehen an der Grenze des Browsers (`page.route`): „scheitert hart“ = `fetch` wirft, „hängt“ = die Anfrage wird nie beantwortet. Die Proben fahren mit verkürzter Frist (Vorschlag 300 ms) und warten auf das Ereignis, nicht auf die Uhr.

- [x] **149-1 Haken verschwindet (Abnahme-Probe der Karte #149, heute rot: Haken bleibt):** Gegeben das Board zeigt an #1 „eins“ als nächste Teilaufgabe; wenn `st` sie über den Kartenknopf abhakt und sowohl die eigene Anfrage als auch das folgende Nachladen hart scheitern (Server weg); dann steht im Hinweis auf dem Board genau eine Meldung „Keine Verbindung zum Server — nichts geändert.“, und die Karte zeigt wieder „eins“ als nächste offene Teilaufgabe, nicht abgehakt; die Datei von #1 ist unverändert, kein neuer Commit.
- [x] **148-1 Hängende eigene Anfrage (heute rot: Stillstand ohne Meldung):** Gegeben wie oben; wenn `st` „eins“ abhakt und die eigene Anfrage hängt; dann erscheint nach Ablauf der Frist genau eine Meldung im Hinweis, sie enthält „Keine Antwort vom Server“ und nicht „nichts geändert“ (ob die Änderung ankam, ist offen); die Ansicht lädt neu und zeigt den Stand der Datei; hakt `st` danach erneut ab, wird die Anfrage gesendet, der Haken steht in der Datei, genau ein Commit.
- [x] **148-2 Hängendes Nachladen (Abnahme-Probe der Karte #148, heute rot):** Gegeben wie oben; wenn `st` „eins“ abhakt, die Änderung gespeichert wird und das folgende Nachladen (`GET /api/zustand`) hängt; dann erscheint nach Ablauf der Frist genau eine Meldung „Änderung gespeichert — Ansicht nicht neu geladen.“; hakt `st` danach „zwei“ ab, wird die Anfrage gesendet (zwei Haken in der Datei, zwei Commits); ändert danach ein Agent über die API den Titel von #2, zeigt das Board den neuen Titel ohne Zutun. Rechenbeispiel zur Frist (Unit, Frist als Eingabe): Frist 15 000 ms, Antwort nach 14 000 ms → Ergebnis wie heute; keine Antwort nach 15 000 ms → Fehler „Keine Antwort vom Server …“ mit `status: 0`.
- [x] **150-1 Fensterfall des gescheiterten Nachladens (Abnahme-Probe der Karte #150):** Gegeben das Aufgabenfenster von #1 ist offen; wenn `st` dort „eins“ abhakt und der nächste `GET /api/zustand` hart scheitert; dann steht genau eine Meldung am Hinweis-Anker des Fensters (`#fenster .hinweis-anker`, `role="status"`) mit dem Text „Änderung gespeichert — Ansicht nicht neu geladen.“, nicht im Fuß; nirgends auf dem Schirm (Fuß, Statusleiste) steht „nichts geändert“. Gegenprobe bleibt grün: scheitert auch die eigene Anfrage, steht im Fuß „Keine Verbindung zum Server — nichts geändert.“ (`r00147-warteschlange.spec.js`, AK 7 / US-4).
- [x] **150-2 Programmfehler beim Nachladen hinterlässt eine Spur (heute rot: Konsole leer):** Gegeben wie 149-1; wenn `st` „eins“ abhakt, die Änderung gespeichert wird und der Server auf das Nachladen mit 200 und ungültigem JSON antwortet; dann erscheint am Auslöser weiterhin genau eine Meldung, und der Fehler steht als `console.error` in der Konsole. Ein Netzfehler oder eine abgelaufene Frist schreibt keinen `console.error`.
- [x] **Bleibt:** Im Normalbetrieb erscheint keine der Meldungen; `e2e/tests/r00147-warteschlange.spec.js`, `r00148-*.spec.js`, `r00112-rueckgaengig.spec.js` und `e2e/einheit/warteschlange.test.js` laufen unverändert grün.

## Tests

E2E als eine Spec (`r00186-…`), die roten Proben zuerst: 149-1, 148-1, 148-2, 150-2; 150-1 wird festgehalten (am Code gelesen vermutlich schon grün). Hängende Anfrage: Route, die nie antwortet; Fehler erst nach dem ersten gezeichneten Stand scharf schalten (`boardBereit`, Vorbild `r00147-warteschlange.spec.js`). Unit: Frist als Eingabe einer reinen Funktion, keine Wanduhr-Grenze im Test. Mutanten: „Frist greift nie“ → 148-1/148-2 rot; „Haken bleibt“ → 149-1 rot.

## Implementierungshinweise

- **Entschieden (ADR-0025 Nachtrag N4):** Frist 15 s je Anfrage in `api()` über `AbortController`; der Fehler hat die Form des Netzfehlers (`status: 0`, `daten: null`) mit eigenem Text und läuft durch die vorhandenen Fehlerpfade. Die Frist umfasst auch das Lesen des Antworttexts. 15 s ist eine **Hypothese, nicht gemessen** (lokaler Server; Schreibwege mit Git-Commit unter Last von zehn Agenten sollen weit darunter bleiben).
- Vorschlag, keine Vorschrift: die Frist für die Proben verkürzbar machen (Konstante, die `mutanteEinsetzen` aus `e2e/tests/hilfen.js` ersetzt, oder Parameter der reinen Funktion).
- **149:** Rücknahme am einfachsten am Aufrufer (`teil-karte`): scheitert die eigene Anfrage, den Haken im gezeigten Stand zurücksetzen; gezeichnet wird ohnehin in `schlangeMelden`. Gelingt das Nachladen, zeigt es den Stand der Datei wie heute.
- **150-2:** Netzfehler und Frist tragen `status: 0`, Serverablehnungen ihren Status; ein Fehler ohne `status` ist ein Programmfehler.
- **Schadensstelle:** Nach einer abgelaufenen Frist kann der Server die Änderung trotzdem gespeichert haben — die Meldung darf dann nicht „nichts geändert“ sagen, und die Oberfläche sendet die Anfrage nicht von selbst erneut.
- **Nicht hinein:** Anhänge hoch- und herunterladen (eigene `fetch`, `web/app.js:568`, `:589`) bleiben ohne Frist — eine große Datei darf länger dauern; ein hängendes Hochladen hält die Warteschlange weiter an (benannte Restlücke). Die Live-Verbindung (`EventSource`) hat ihren eigenen Wächter. Die übrigen vorschnellen Schreibwege im Aufgabenfenster (`teil-text`, `teil-ordnen`, `teil-neu`) gehören zur selben Klasse wie 149-1, die Karte nennt nur den Kartenknopf.
- `web/`-Dateien sind eingebettet — sichtbar erst nach `cargo build` und Neustart.

## Warum löst diese Anforderung das Problem?

Auslöser: Der Server antwortet nicht oder ist weg, während `st` auf dem Board abhakt. Endet jede Anfrage spätestens nach der Frist (X), endet auch das Glied der Warteschlange und ihr Zähler geht auf 0 (Y); die nächste eigene Änderung wird gesendet, Live-Ereignisse wirken wieder, und die Meldung nennt, was geschah (Z). Nimmt die Oberfläche den vorschnellen Haken zurück, wenn die Änderung nicht ankam (X), zeigt die Karte denselben Stand wie die Datei (Y), und `st` hakt nicht im Glauben weiter, es sei gespeichert (Z).

## Offene Fragen

- **Frist 15 s** — Empfehlung, als Hypothese gebaut; zu bestätigen vom architekt oder Betreiber, falls gemessene Antwortzeiten unter Last näher als 30 % an 15 s liegen.
- **Wortlaut der Fristmeldung** — Empfehlung: „Keine Antwort vom Server — bitte prüfen, ob die Änderung ankam.“; den Text bestätigt der rechtschreib-reviewer, das Kriterium bindet nur „Keine Antwort vom Server“ und das Fehlen von „nichts geändert“.
