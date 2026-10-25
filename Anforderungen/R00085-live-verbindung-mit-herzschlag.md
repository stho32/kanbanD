---
id: R00085
status: Erledigt
datum: 2026-10-25
---

# R00085: Live-Verbindung mit Herzschlag

## Beschreibung

Die Live-Aktualisierung (R00007, R00032) hängt an einem `EventSource` auf `/api/ereignisse`. Der Server sendet alle 15 s ein Keep-alive als SSE-Kommentar, den JavaScript nicht sieht. Eine still abgerissene Verbindung (Ruhezustand, WLAN-Wechsel, gedrosselter Hintergrund-Tab) löst deshalb kein `onerror` aus, und nach einer Fehlerantwort gibt `EventSource` endgültig auf: Änderungen von Agenten kommen erst nach einem Reload an. Künftig sendet der Server einen sichtbaren Herzschlag, und der Client baut die Verbindung selbst neu auf, sobald er still wird.

Zahlt ein auf: [Vision](R00000-vision.md) — jede Änderung erscheint sofort in allen offenen Sichten.

## Geschäftlicher Nutzen

Wer einem reinen KI-Lauf zusieht, sieht ihn tatsächlich — ohne Reload und ohne Misstrauen gegenüber der Anzeige.

## Funktionale Anforderungen

- Der Server sendet auf `/api/ereignisse` alle 15 s ein Ereignis `event: herzschlag` (Daten `{}`); das bestehende Keep-alive darf bleiben.
- Der Client merkt sich den Zeitpunkt des letzten Ereignisses (jedes, auch `herzschlag`).
- Hört der Client 40 s nichts, oder steht die Verbindung auf `CLOSED`, schließt er sie, baut sie neu auf und lädt nach dem `onopen` den Stand nach (wie heute „Wieder verbunden · Stand nachgeladen“).
- Bei `visibilitychange` (sichtbar) und `online` prüft der Client sofort: ist das letzte Ereignis älter als 40 s oder die Verbindung nicht `OPEN`, baut er neu auf.
- Neuaufbau mit Rückzug: 1 s, 2 s, 5 s, dann alle 10 s, solange der Server nicht erreichbar ist; nie zwei Verbindungen gleichzeitig.
- Herzschlag-Ereignisse lösen kein Neuzeichnen aus.

## Akzeptanzkriterien

- [x] Server: der Strom liefert innerhalb von 16 s ein `herzschlag`-Ereignis (Integrationstest mit verkürztem Intervall)
- [x] Unit (Wächter als pure Funktion): letzte Meldung vor 41 s → `neu verbinden`; vor 39 s und `OPEN` → `nichts`; `CLOSED` → `neu verbinden`; Rückzugsfolge 1, 2, 5, 10, 10 s
- [x] E2E: Verbindung über die Testschnittstelle stilllegen (Herzschlag aus, `onerror` unterdrückt) → nach höchstens 40 s + Puffer verbindet der Client neu, und eine zwischenzeitlich per API gemachte Änderung erscheint ohne Reload
- [x] E2E: Server neu gestartet → Karte, die währenddessen per API angelegt wurde, erscheint ohne Reload
- [x] Ein Herzschlag zeichnet nicht neu (Zähler der Render-Aufrufe bleibt)

## Betroffene Verzeichnisstruktur

`src/web/mod.rs` (`ereignisstrom`), `web/app.js` (`liveVerbinden`), Logik des Wächters als pure Funktion in einem eigenen Modul `web/verbindung.js`; Tests `tests/`, `e2e/einheit/verbindung.test.js`, `e2e/tests/r00085-live-verbindung.spec.js`.

## Technische Überlegungen

### Ablauf
1. **Server**: Ereignisstrom mit `tokio::time::interval` mischen, je Takt `Event::default().event("herzschlag").data("{}")`; Intervall für Tests einstellbar (Umgebungsvariable oder Konstruktor-Parameter).
2. **Client**: `liveVerbinden()` registriert `addEventListener('herzschlag', …)`, merkt `S.liveZuletzt`; `setInterval` (vorhanden, 1 s) fragt den Wächter; `entscheide(zuletzt, jetzt, zustand)` liefert `nichts | neu`.

### Grobentwurf
- `web/verbindung.js` (pure) — `entscheide({zuletzt, jetzt, offen})`, `rueckzug(versuch)`.

## Tests
**Unit:** `web/verbindung.js`. **Integration:** Herzschlag im Strom. **E2E:** stillgelegte Verbindung, Server-Neustart.

## Abhängigkeiten
- Abhängig von: R00007, R00032, R00050

## Offene Fragen
- keine — Vorgehen „Herzschlag mit Wächter“ entschieden am 2026-10-25 (Feedback-Runde Punkt 4)

## Notizen
### Verworfene Alternativen
- Erst nachstellen: der Fehler tritt sporadisch auf; der Wächter deckt alle bekannten Auslöser ab.
- Abfrage alle 30 s: Dauerlast und bis zu 30 s Verzögerung.

## Warum löst diese Anforderung das Problem? (Pflicht)

Keep-alive unsichtbar → stille Verbindung bleibt unbemerkt → Agenten-Änderungen kommen nicht an. Sichtbarer Herzschlag → Stille ist messbar → Wächter verbindet neu und lädt nach → die Sicht ist spätestens nach 40 s wieder aktuell, ohne Reload.
