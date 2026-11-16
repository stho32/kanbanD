---
id: R00175
status: Erledigt
datum: 2026-11-16
---

# R00175: Textfeld der Beschreibung öffnet in der Höhe des Inhalts und wächst beim Tippen

## Beschreibung

Herkunft: Karte #183, Betreiber am 2026-11-16 wörtlich: „…das edit Feld Autosized auch nicht sondern wird nur als so ein kleines 5 Zeilen textarea oder so eingeblendet, wenn man in den Bearbeiten modus geht, was einen verwirrt und ärgert, weil man es dann erst groß ziehen muss.“ Heute öffnet das Textfeld der Beschreibung im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) immer 120 px hoch und wächst nicht (`web/kd-app.css:414`). Fehlender Umfang, kein Fehler: [R00030](R00030-beschreibung-als-markdown-lesen.md) und R00162 sagen zur Höhe nichts.

**Gewünscht:** Das Feld öffnet so hoch wie sein Inhalt und wächst beim Tippen bis zur **Grenze von 60 % des sichtbaren Bereichs** (bei 900 px Fensterhöhe 540 px; verkleinert die Bildschirmtastatur den sichtbaren Bereich auf 400 px, sind es 240 px); darüber scrollt das Feld. Ziehen von Hand bleibt. Das Feld im Dialog „Neue Aufgabe“ verhält sich gleich.

Eine Zeichnung ist nicht nötig: es entsteht kein neues Bedienelement. Zahlt ein auf: [Vision](R00000-vision.md) — der Mensch bearbeitet eine Aufgabe ohne Umweg.

## Akzeptanzkriterien

**Ausgangslage:** Aufgabe #1 mit einer Beschreibung aus 30 Zeilen („Zeile 1“ … „Zeile 30“), Aufgabe #2 ohne Beschreibung; Fenster des Browsers 1280 × 900 px.

- [x] **AK 1 Öffnet in Inhaltshöhe (Abnahme-Probe der Karte):** #1 geöffnet, Stift geklickt → alle 30 Zeilen sind ohne Ziehen sichtbar, oder das Feld steht an der Grenze und scrollt; in beiden Fällen ist es höher als 120 px. Fünf weitere getippte Zeilen lassen es wachsen, solange die Grenze nicht erreicht ist (Beispiel: 30 Zeilen zu etwa 21 px sind rund 650 px, das Feld steht also bei 540 px und scrollt; mit 10 Zeilen, rund 220 px, wächst es um fünf Zeilen auf rund 330 px).
- [x] **AK 2 Grenze:** Ab der Grenze wächst das Feld nicht weiter; es scrollt das Feld, nicht das Fenster zusätzlich. Der Fensterfuß mit seiner Meldung bleibt sichtbar und erreichbar.
- [x] **AK 3 Cursor bleibt sichtbar:** Beim Tippen am Ende des Textes bleibt die Zeile mit dem Cursor sichtbar; das Fenster springt beim Wachsen nicht (die Überschrift „BESCHREIBUNG“ behält ihren Platz, solange sie sichtbar war).
- [x] **AK 4 Von Hand gezogen bleibt gezogen:** Das Feld auf 400 px gezogen → es bleibt 400 px hoch beim Weitertippen und wenn ein [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) die Ansicht neu zeichnet (ein zweiter Teilnehmer ändert den Titel einer anderen Aufgabe); Rollstand im Feld und Cursor bleiben.
- [x] **AK 5 Kein Entwurf geht verloren:** Getippter, noch nicht gespeicherter Text steht nach Wachsen, Ziehen und Neuzeichnen unverändert im Feld und wird beim Verlassen wie heute gespeichert.
- [x] **AK 6 Leer, neue Aufgabe, schmal:** #2 öffnet das Feld 120 px hoch wie heute. Im Dialog „Neue Aufgabe“ wächst das Feld der Beschreibung ebenso bis zur Grenze, „Anlegen“ bleibt erreichbar. Bei 375 px Breite mit Bildschirmtastatur richtet sich die Grenze nach dem sichtbaren Bereich (ADR-0016 N1), der Fensterfuß bleibt erreichbar.
- [x] **AK 7 Bleibt:** Die bestehenden Tests zur Beschreibung laufen unverändert grün.

## Tests

E2E als Spec: AK 1 zuerst (heute rot: 120 px), dann Grenze, gezogene Höhe über ein Live-Ereignis, Dialog „Neue Aufgabe“, 375 px mit umgelenktem sichtbarem Bereich (Vorbild F0062). Unit, falls der Sicherer die Höhe trägt.

## Implementierungshinweise

- Vorschlag, keine Vorschrift: CSS `field-sizing: content` mit `min-height: 120px` und `max-height` aus dem sichtbaren Bereich (`--kd-vv-oben`, `--kd-vv-unten`); Rückfall für Browser ohne `field-sizing`: Höhe per Skript beim Öffnen und bei `input`. Am Code gelesen, nicht gefahren — die Probe am laufenden Programm steht in B0861.
- Befund am Code: Das Neuzeichnen ersetzt das Feld per `innerHTML`; der Sicherer (`web/sichtzustand.js`) trägt Rollstand, Fokus, Cursor und getippten Wert, die von Hand gezogene Höhe nicht (B0862).
- **Schadensstelle:** Ein Entwurf darf durch die Höhenanpassung nie verloren gehen — sie schreibt nie in den Wert des Feldes.
- **Nicht hinein:** Vorschau neben dem Feld · Werkzeugleiste · Kommentarfeld.
- **Gebaut (Probe B0861, Chromium 159):** `field-sizing: content` trägt — öffnet in Inhaltshöhe, wächst beim Tippen, hält `min-height` und `max-height`; nach dem Ziehen von Hand schreibt der Browser `style.height`, das Feld wächst dann nicht mehr von selbst. Eine gezogene Höhe ist an die Grenze nicht gebunden (wie heute frei ziehbar) und übersteht das Neuzeichnen über den Sicherer (`gezogeneHoehen`, `web/sichtzustand.js`).
- **In Kauf genommen:** Ein Browser ohne `field-sizing` (Firefox und Safari in älteren Fassungen) öffnet das Feld wie bisher 120 px hoch und lässt es nicht wachsen; die Grenze und das Ziehen von Hand gelten auch dort. Kein Rückfall per Skript — das Programm ist ein lokales Werkzeug und läuft in Chromium-artigen Browsern. Das Kommentarfeld behält eine gezogene Höhe weiterhin nicht über das Neuzeichnen.

## Warum löst diese Anforderung das Problem?

Auslöser: Wer eine lange Beschreibung bearbeitet, sieht fünf Zeilen und muss das Feld erst großziehen. Öffnet das Feld in der Höhe des Inhalts (X), steht der Text beim Klick auf den Stift so da wie in der Lesesicht (Y); der Mensch tippt sofort an der gemeinten Stelle weiter, ohne zu ziehen (Z).

## Offene Fragen

Keine.
