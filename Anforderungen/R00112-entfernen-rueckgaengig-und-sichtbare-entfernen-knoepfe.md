---
id: R00112
status: Neu
datum: 2026-11-08
---

# R00112: Entfernen rückgängig und sichtbare Entfernen-Knöpfe

## Beschreibung

Vier Entfernen-Aktionen wirken sofort, ohne Hinweis und ohne Rückweg (Karte #12, Muss aus der UX-Durchsicht vom 2026-10-31, Stand d70ee96):
- „von Board nehmen“: ✕ an „Liegt auf“ in der Aufgabenliste (`web/ansicht.js:758`) und Kontextmenü der Listenzeile (`web/menue.js:63`), Aktion `abnehmen` (`web/app.js:1208`);
- Teilaufgabe entfernen im Aufgabenfenster (`teil-weg`, `web/app.js:963`);
- Anhang entfernen im Aufgabenfenster (`anhang-weg`, `web/app.js:1214`);
- Zeiteintrag löschen im Aufgabenfenster (`zeit-weg`, `web/app.js:1246`).

Rückgängig gibt es heute nur für Bewegen, Zielgrößen, Archivieren und Zurückholen (R00031, `web/app.js:1017–1027`). Dazu sind die ✕ an Zeiten, Teilaufgaben und Anhängen bis zum Zeigen mit der Maus unsichtbar (`opacity:0`, `web/kd-app.css:533–537`). Unter `hover:none` macht sie R00108 schon sichtbar (`web/kd-app.css:539`; aus dem CSS gelesen, nicht gemessen). Wer mit der Maus arbeitet, findet sie also erst durch Suchen.

Diese Anforderung setzt ADR-0017 Option A um: Rückgängig ist eine neue Aktion über die API mit dem Inhalt, der beim Klick gemerkt wurde.
- Vier neue Arten im gemerkten Hinweis: `legen`, `teilaufgabe`, `zeit`, `anhang`.
- Zwei optionale Parameter am Server, damit die Wiederherstellung an derselben Stelle landet: `index?` beim Auflegen, `position?` und `erledigt?` beim Anlegen einer Teilaufgabe. Ohne sie verhält sich die API wie heute.
- Der Hinweis erscheint bei offenem Fenster im obersten Fenster, bricht um und lässt seinen Knopf nie abschneiden.
- Die ✕ sind immer sichtbar, in `--kd-muted`.

Nicht Teil: „Herkunft entfernen“ (Folgekarte #102, PO Z. 160) und die Teilaufgaben in „Neue Aufgabe“ (noch nicht gespeichert; ihr ✕ wird nur mit sichtbar).

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanken „Die Dateien sind der einzige Speicher“ und „Ein Commit je Aktion“: Rückgängig schreibt die Dateien neu über die API, in einem Commit je Wiederherstellung, und erzwingt nichts gegen den Stand eines Agenten. Leitplanke „Jede Gestaltung wird freigegeben, bevor sie gebaut wird“ (2026-11-07): der Hinweis im Fenster ist eine neue Lage und wartet auf die Freigabe durch den product-owner (Offene Fragen 1).

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Ein versehentlicher Klick auf ✕ kostet heute Arbeit, die niemand zurückholt: eine Teilaufgabe mit Haken, einen Zeiteintrag, eine Datei, die vielleicht nur noch hier lag. Mit Rückgängig wird ein Fehlgriff zu einem Tastendruck. Positionstreue ist dabei der eigentliche Nutzen: eine Karte, die nach Strg+Z unten statt an ihrem Platz liegt, ist halb zurück und muss von Hand nachgeschoben werden (PO Z. 161). Sichtbare ✕ ersparen das Suchen mit der Maus und machen die Bedienung auf allen Geräten gleich.

## Funktionale Anforderungen

### Rückgängig als neue Aktion (ADR-0017 Regeln 1, 2)

1. Jede der vier Aktionen merkt beim Klick, vor dem Senden, aus dem gezeigten Stand, was zum Wiederherstellen nötig ist, und zeigt danach einen Hinweis mit dem Knopf „rückgängig“ (`.toast` mit `[data-act=rueckgaengig]`, Tooltip „Strg+Z“):
   - `legen {slug, nummer, spalte, index}` — Hinweis „#2 von „Entwicklung“ genommen“;
   - `teilaufgabe {nummer, text, erledigt, position}` — Hinweis „Teilaufgabe „b“ entfernt“;
   - `zeit {nummer, wer, beginn, ende}` — Hinweis „Zeit 09:00–10:00 von Stefan gelöscht“ (Uhrzeiten in Ortszeit wie die Zeile);
   - `anhang {nummer, name, blob}` — Hinweis „Anhang „plan.pdf“ entfernt“.
2. Der Knopf und Strg+Z lösen dieselbe Wiederherstellung aus. Strg+Z gilt auch bei offenem Fenster, nicht in Eingabefeldern (Verhalten wie R00031). Ausnahme (ADR-0017 N2): Strg+Z wirkt zusätzlich in genau dem Eingabefeld, auf das das Entfernen den Fokus gesetzt hat (`#teil-neu`, `#zeit-neu`), solange es leer ist und der Hinweis mit „rückgängig“ lebt. In jedem anderen Feld und sobald etwas getippt ist, gehört Strg+Z dem Feld.
3. Der Hinweis lebt wie heute 8 s ab dem Klick (`web/app.js:2275`, geprüft im Sekundentakt). Danach ist der Knopf weg und Strg+Z wirkungslos. Ein neuer Hinweis ersetzt den alten.
4. Die Wiederherstellung ist eine neue Aktion über die API. Lehnt der Server ab (409, 404, 400), wird das gemeldet und nichts erzwungen:
   - ohne Fenster als Hinweis „nicht rückgängig: <Text des Servers>“ ohne Knopf;
   - beim Zeiteintrag nennt die Meldung die Zeit wie das Fenster statt der Kennung des Servers: „nicht rückgängig: #1 hat schon eine Zeit 09:00–10:00 von Stefan“ (der Text der API bleibt mit Kennung);
   - bei offenem Fenster als Meldung im Fuß (`fensterMelden`, ADR-0015 Regel 3).
5. Der Hinweis wird vor dem Senden geleert. Ein Doppelklick auf „rückgängig“ stellt also genau einmal her.
6. Das Gemerkte liegt außerhalb der Felder aus ADR-0014 (`S.aufgaben`, `S.board`, `S.zustand`, `S.ui.datei`, `S.ui.defektDatei`). Der Wächter `e2e/einheit/uebernahme.test.js` bleibt ohne neue Ausnahme.

### Erfolg (ADR-0017 Regel 6)

7. Nach Erfolg steht ein Hinweis ohne Knopf:
   - „#2 wieder auf „Entwicklung“ · Spalte Zu erledigen“;
   - „Teilaufgabe „b“ wiederhergestellt“;
   - „Zeit 09:00–10:00 von Stefan wiederhergestellt“;
   - „Anhang „plan.pdf“ wiederhergestellt“, bei vergebenem anderem Namen „Anhang als „plan-2.pdf“ wiederhergestellt“.
8. Der Fokus folgt N7a/N7b (ADR-0010) als Rangliste; es gilt das erste vorhandene Ziel (ADR-0017 N2):
   - nach dem Entfernen: das eigene ✕, solange es noch steht (Entfernen abgelehnt) → das ✕ des Nachbarn (der folgende rückt nach, am Ende der vorige) → der Ort des Abschnitts (`#teil-neu`, `#zeit-neu`, bei „Liegt auf“ die Zeile der Aufgabe); beim Anhang bleibt der Fokus beim Fenster;
   - nach dem Rückgängig und bei der Ablehnung: das ✕ des wiederhergestellten Elements (beim Anhang unter dem vergebenen Namen, bei der Teilaufgabe an der gekappten Stelle) → sonst der Ort des Entfernens (Eingabefeld, Zeile, beim Anhang das ✕ eines beliebigen Anhangs).

### Positionstreue (ADR-0017 Regel 4, PO Z. 161)

9. `POST /api/boards/{slug}/aufgaben` nimmt optional `index` (0-basiert, Stelle in der Spalte). Fehlt er oder ist er ≥ der Länge der Spalte, liegt die Karte unten wie heute. Negativ, gebrochen oder kein Zahlwert ergibt 400 mit Fehlerantwort, nicht 422.
10. `POST /api/aufgaben/{nr}/teilaufgaben` nimmt optional `position` (0-basiert) und `erledigt` (Wahrheitswert). Ohne beides wird offen am Ende angehängt wie heute. `position` ≥ Länge ergibt das Ende. `position` negativ, gebrochen oder kein Zahlwert ergibt 400, `erledigt` kein Wahrheitswert ergibt 400.
11. Jede Wiederherstellung ist genau ein Commit (kein POST plus PATCH).
12. Hat sich der Stand zwischen Entfernen und Rückgängig geändert, gilt der gemerkte Index, gekappt auf die Länge (PO Z. 161; kein Befund).

### Anhang: erst lesen, dann löschen (ADR-0017 Regel 3)

13. Vor dem Löschen eines Anhangs liest die Oberfläche ihn als Blob (`GET …/anhaenge/{name}`). Während des Lesens zeigt das ✕ einen Ladezustand (`disabled`, `aria-busy="true"`).
14. Scheitert das Lesen, wird nicht gelöscht. Der Fuß meldet „Anhang „plan.pdf“ nicht entfernt: <Grund>“.
15. Höchstens ein Blob lebt, der des neuesten Hinweises. Er wird mit dem Ablauf oder einem neuen Hinweis freigegeben.
16. Rückgängig lädt den Blob unter dem gemerkten Namen hoch. Ist der Name belegt, vergibt der Server wie heute `stamm-2.endung` (`freier_name`, `src/dienst/anhaenge.rs:22`). Der Erfolgshinweis nennt den Namen aus der Antwort.

### Ort und Form des Hinweises (ADR-0017 Regel 5)

17. Ohne offenes Fenster steht der Hinweis wie heute unten in der Mitte.
18. Bei offenem modalem Fenster (Aufgabenfenster, „Neue Aufgabe“, Defekte Datei) steht er im obersten Fenster (innerhalb `[aria-modal=true]`) und ist per Tab erreichbar. Die Lage folgt dem freigegebenen Artboard (Offene Fragen 1) und verdeckt keine Meldung und keinen Knopf des Fußes.
19. Der Hinweis bricht um: `max-width: min(720px, 100vw − 32px)`, `flex-wrap`, wie `.toast.warn`. Der Knopf „rückgängig“ wird nie abgeschnitten und hat die Trefferfläche nach ADR-0012.

### Sichtbare ✕ (ADR-0017 Regel 7)

20. Jedes ✕ zum Entfernen — `.zt .btn-sym` (Zeiten, auch ✎), `.chk .x` (Teilaufgaben, auch in „Neue Aufgabe“), `.anh-z .x` (Anhänge), `.lnk-x` (Liegt auf) — ist ohne Zeigen und ohne Fokus sichtbar: berechnete opacity 1, Farbe `--kd-muted`. Die Trefferfläche bleibt nach ADR-0012.

## Nicht-funktionale Anforderungen

1. **Rückwärtskompatibel**: Aufrufe ohne die neuen Parameter verhalten sich wie vor dieser Anforderung (gleiches Ergebnis, gleicher Status, gleicher Commit-Text).
2. **Ein Commit je Aktion**: Entfernen ein Commit, Wiederherstellen ein Commit.
3. **Nebenläufigkeit**: Rückgängig überschreibt nie den Stand eines anderen Schreibers; es legt etwas hinzu oder wird abgelehnt.
4. **Barrierefreiheit**: Der Hinweis bleibt `role="status"`. Im Fenster ist „rückgängig“ per Tab erreichbar. Schrift der ✕ mit Kontrast ≥ 4,5:1 gegen ihre Fläche (ADR-0011).
5. **Breite**: Bei 320 px scrollt nichts quer (ADR-0015 Regel 1). Die Probe `e2e/tests/r00111-schmal-wie-breit.spec.js` findet den Hinweis in jeder geprüften Breite ganz im Bild.
6. **Zeit**: Prüfungen am Ablauf laufen über `page.clock` und halten ≥ 30 % Abstand zur Grenze: 5 s nach dem Klick noch da, 12 s danach weg (Grenze 8–9 s).

## Akzeptanzkriterien

Geprüft mit dem Grundbestand aus `user-stories/R00112.md`.

- [ ] **1. Abnahme-Probe der Karte #12 (wörtlich)**: „Nach ✕ „von Board nehmen“ erscheint `.toast` mit `[data-act=rueckgaengig]`, und Strg+Z stellt „Liegt auf“ wieder her; dasselbe für Teilaufgabe, Anhang, Zeiteintrag; bei emuliertem Touch hat jedes ✕ die berechnete opacity 1.“
  - Besteht: nach ✕ an „Entwicklung · Zu erledigen“ von #2 steht der Hinweis „#2 von „Entwicklung“ genommen“ mit „rückgängig“; nach Strg+Z zeigt „Liegt auf“ von #2 wieder „Entwicklung · Zu erledigen“.
  - Fällt durch: „Liegt auf“ bleibt leer; Hinweis ohne Knopf; der Knopf wirkt, Strg+Z nicht.
  - Prüfebene: E2E `r00112-rueckgaengig.spec.js` US-1, US-5, US-7, US-8, US-10. Teilaufgabe, Anhang und Zeiteintrag nach AK 5–10, Touch nach AK 12.
- [ ] **2. Abnahme-Probe Positionstreue, Teil (1) (PO Z. 161, wörtlich)**: „Spalte mit #1, #2, #3 → #2 „von Board nehmen“ → Strg+Z → Reihenfolge wieder #1, #2, #3, in der Datei und auf dem Schirm (heute 1, 3, 2).“
  - Besteht: `boards/entwicklung.md` listet unter „Zu erledigen“ #1, #2, #3; das Board zeigt die Karten in dieser Reihenfolge; `git log` hat zwei neue Commits, „#2 von „Entwicklung“ genommen“ und „#2 auf „Entwicklung“ gelegt (Zu erledigen)“, beide mit Autor Stefan (PO Z. 165).
  - Fällt durch: #1, #3, #2 (heutiger Stand); nur die Datei stimmt; ein dritter Commit.
  - Prüfebene: E2E US-1; Server über AK 4.
- [ ] **3. Ablauf und Wege**: Derselbe Ablauf über das Kontextmenü „Von Board nehmen“ und über den Knopf „rückgängig“. 5 s nach dem Entfernen ist der Knopf da, 12 s danach weg, und Strg+Z ändert nichts mehr.
  - Besteht: nach 12 s ist „Liegt auf“ von #2 leer, kein neuer Commit.
  - Fällt durch: Strg+Z wirkt nach 12 s noch; Kontextmenü-Weg ohne Hinweis.
  - Prüfebene: E2E US-2, US-3 (`page.clock`).
- [ ] **4. Ablehnung ohne Zwang**: Hat ein Agent #2 zwischendurch wieder aufgelegt, meldet Rückgängig „nicht rückgängig: #2 liegt schon auf „Entwicklung““, und #2 steht genau einmal in der Board-Datei.
  - Besteht: Hinweis ohne Knopf, keine neue Zeile, kein neuer Commit.
  - Fällt durch: #2 doppelt; Fehler nur in der Konsole; Hinweis bleibt mit Knopf.
  - Prüfebene: E2E US-4; Server-Test 409 unverändert.
- [ ] **5. Teilaufgabe — Abnahme-Probe Positionstreue, Teil (2) (PO Z. 161, wörtlich)**: „Teilaufgaben a, b, c, b erledigt → b entfernen → Strg+Z → wieder a, b, c, b an Index 1 und erledigt.“
  - Besteht: Datei von #1 hat `- [ ] a`, `- [x] b`, `- [ ] c` in dieser Reihenfolge; das Fenster zeigt b an zweiter Stelle mit Haken; Hinweis „Teilaufgabe „b“ wiederhergestellt“; zwei neue Commits.
  - Fällt durch: b unten; b offen; zwei Commits für die Wiederherstellung (POST plus PATCH).
  - Prüfebene: E2E US-5.
- [ ] **6. Teilaufgabe neben einem Agenten**: Hängt ein Agent nach dem Entfernen „d“ an, steht nach Strg+Z a, b, c, d. Doppelklick auf „rückgängig“ ergibt genau ein b.
  - Besteht: d bleibt am Ende; b einmal.
  - Fällt durch: d verschwindet; b zweimal.
  - Prüfebene: E2E US-6.
- [ ] **7. Hinweis im Fenster und Zeiteintrag**: Nach ✕ an Zeit 09:00–10:00 von Stefan liegt der Hinweis „Zeit 09:00–10:00 von Stefan gelöscht“ innerhalb `[aria-modal=true]`, und „rückgängig“ ist per Tab erreichbar. Strg+Z bringt den Eintrag mit derselben Kennung zurück. Hat ein Agent ihn zwischendurch wiederhergestellt, steht im Fuß „nicht rückgängig: #1 hat schon eine Zeit 09:00–10:00 von Stefan“, und der Eintrag steht genau einmal in der Datei.
  - Besteht: Zeile 09:00–10:00 wieder unter „Zeiten“, Commit „#1 Zeit nachgetragen: …“.
  - Fällt durch: Hinweis außerhalb des Fensters (heute: unter dem Fenster inert, `web/app.js:570`); Meldung als Hinweis statt im Fuß; Eintrag doppelt.
  - Prüfebene: E2E US-7.
- [ ] **8. Anhang bytegleich**: Nach ✕ an „plan.pdf“ und Strg+Z ist „plan.pdf“ wieder da, mit gleicher Länge (2048 Bytes) und gleichem SHA-256 wie vorher. Hat ein Agent zwischendurch eine andere „plan.pdf“ hochgeladen, heißt der wiederhergestellte Anhang „plan-2.pdf“, der Hinweis lautet „Anhang als „plan-2.pdf“ wiederhergestellt“, und beide Dateien liegen auf der Platte.
  - Fällt durch: andere Länge oder anderer Hash; die Datei des Agenten überschrieben.
  - Prüfebene: E2E US-8.
- [ ] **9. Anhang nicht lesbar**: Scheitert das Lesen vor dem Löschen (GET mit 500), wird kein DELETE gesendet, „plan.pdf“ bleibt, und der Fuß meldet „Anhang „plan.pdf“ nicht entfernt: …“.
  - Fällt durch: DELETE gesendet; Anhang weg ohne Rückweg; stille Nichtwirkung.
  - Prüfebene: E2E US-9 (`page.route`, DELETE-Zähler).
- [ ] **10. Server — Abnahme-Probe Positionstreue, Teil (3) (PO Z. 161, wörtlich)**: „Je Parameter ein API-Test, dass ein fehlender oder zu großer Wert unten anhängt und alte Aufrufe unverändert bleiben.“
  - Besteht: `index` 1 bei [#1, #3] ergibt [#1, #2, #3]; ohne `index` und mit `index` 99 unten; `position` 1 mit `erledigt` true bei [a, c] ergibt [a, b ✓, c]; ohne beides offen am Ende; `position` 99 am Ende; je Aufruf ein Commit mit dem heutigen Text.
  - Fällt durch: `index` −1, 1.5 oder `"eins"` ergibt 201 oder 422 statt 400; `erledigt` `"ja"` ergibt 201 oder 422 statt 400; ein Aufruf ohne Parameter ändert Status, Antwort oder Commit-Text.
  - Prüfebene: Integration `tests/zuordnung.rs`, `tests/teilaufgaben.rs`.
- [ ] **11. Hinweis schmal wie breit**: Bei 320 × 640 Touch mit dem Board-Titel „Entwicklung und Betrieb der Plattform“ bricht der Hinweis um, nichts scrollt quer, „rückgängig“ liegt ganz im Bild und hat ≥ 44 × 44 px. Bei 1280 × 800 steht ein kurzer Hinweis in einer Zeile. Im Fenster findet die Probe schmal wie breit den Knopf bei 1280, 414 und den Zwischenbreiten, und sein Rechteck überlappt keine Fußmeldung.
  - Fällt durch: „rückgängig“ abgeschnitten (`overflow` eines Vorfahren); Querscrollen; Hinweis über der Fußmeldung.
  - Prüfebene: E2E US-11, `r00111-schmal-wie-breit.spec.js`.
- [ ] **12. ✕ immer sichtbar**: Im Aufgabenfenster von #1 und in der Aufgabenliste hat jedes ✕ (`.zt .btn-sym`, `.chk .x`, `.anh-z .x`, `.lnk-x`) ohne Zeigen die berechnete opacity 1, bei emuliertem Touch (414 × 896) und bei feinem Zeiger (1280 × 800). Je Selektor wird mindestens ein Element gefunden.
  - Besteht: `getComputedStyle(x).opacity === '1'` für alle; `ziele.spec.js` und `kontrast.spec.js` grün.
  - Fällt durch: opacity 0 bei feinem Zeiger (heutiger Stand); ein Selektor ohne Treffer gilt als nicht geprüft.
  - Gegenprobe: ein Mutant, der `opacity:0` an `web/kd-app.css:533` ohne die Regel unter `hover:none` einsetzt, macht den Test bei Touch und fein rot.
  - Prüfebene: E2E US-10.

## Betroffene Verzeichnisstruktur

```
src/
├── dienst/zuordnung.rs        # Auflegen an einer Stelle (index)
├── dienst/teilaufgaben.rs     # Teilaufgabe an einer Stelle, mit Haken
└── web/
    ├── mod.rs                 # Handler auf_board_legen, teilaufgabe_anlegen
    └── endpunkte.rs           # Beschreibung der Parameter (auch OpenAPI)
tests/
├── zuordnung.rs
└── teilaufgaben.rs
web/
├── app.js                     # Arten legen, teilaufgabe, zeit, anhang; Hinweis im Fenster
├── ansicht.js                 # vHinweis im obersten Fenster
└── kd-app.css                 # Umbruch des Hinweises, ✕ ohne opacity:0
e2e/tests/
├── r00112-rueckgaengig.spec.js        # neu
└── r00111-schmal-wie-breit.spec.js    # Hinweis im Fenster als Fall
```

## Technische Überlegungen

Nach ADR-0017 (Akzeptiert); Bausteine A00003 (Web-API), A00004 (Dienst), A00009 (Oberfläche) tragen die Soll-Notizen.

### Ablauf

Klick ✕ → merken aus dem gezeigten Stand → (Anhang: erst GET als Blob) → DELETE → Hinweis mit `undo` → Knopf oder Strg+Z → Hinweis leeren → POST mit dem Gemerkten → Erfolgshinweis oder Meldung.

### Grobentwurf

- `S.ui.hinweis.undo` bekommt die vier Arten. `case 'rueckgaengig'` (`web/app.js:1017`) verteilt nach Art.
- `auf_board_legen` bekommt `Option<usize>` für `index`. Damit ein ungültiger Wert 400 statt axum-422 ergibt, wird der Wert wie bei `cost` (ADR-0009) aus rohem JSON gelesen oder eigen deserialisiert (A00003 Soll).
- `teilaufgabe_anlegen` nimmt `{text, position?, erledigt?}` statt `Text`, Wortlaut „außerhalb = ans Ende“ wie beim PATCH (`src/web/endpunkte.rs:64`).
- Zeit und Anhang brauchen keinen neuen Parameter: `POST …/zeiten {wer, beginn, ende}` vergibt dieselbe Kennung, `POST …/anhaenge` vergibt bei Belegung `name-2`.
- `vHinweis()` wird bei offenem Fenster im obersten Dialog gerendert statt am Ende von `#over`, weil alles unter dem obersten Dialog inert ist (`web/app.js:570–576`).

### Gestaltung

- Hinweis im Fenster: neuer Zustand, Lage vor dem Bau freigegeben (Offene Fragen 1). Heute liegt `.toast` `position:fixed` 40 px über dem unteren Rand (`web/kd-app.css:486`); auf dem Handy läge er so über dem Fuß mit Meldung und Knöpfen.
- Umbruch: freigegebenes Muster von `.toast.warn` (`web/kd-app.css:488`), kein Artboard (PO Z. 153 b).
- ✕ sichtbar: D0003 zeigt die ✕ ohne Ausblenden, kein Artboard (PO Z. 153 a, d). Bildschirmfotos auf dem Abnahmezettel.

### Umfang

I0101: 5 Features, 16 Bubbles, 12,5–23 h, ungemessen (Hypothese).
- Herleitung: Summe der Bubble-Spannen — F0063 3,5–6,5 h (B0458 1-1,5, B0459 1-2, B0460 1-2, B0461 0,5-1), F0064 3–5,5 h (B0462 1-1,5, B0463 1-2, B0464 0,5-1, B0465 0,5-1), F0065 2,5–4,5 h (B0466 1-1,5, B0467 1-2, B0468 0,5-1), F0066 2,5–4,5 h (B0469 1-1,5, B0470 1-2, B0471 0,5-1), F0067 1–2 h (B0472 0,5-1, B0473 0,5-1).
- Die Spannen sind ungemessen, nach dem Muster von I0095–I0100.
- Gezählte Eingänge (Stand d70ee96): 4 Entfernen-Aktionen mit Rückgängig (`web/app.js:963, 1208, 1214, 1246`), 1 ausgeschlossen (`herkunft-weg`, `:1226`); 2 Server-Handler mit neuen Parametern; 3 CSS-Regeln mit `opacity:0` oder ihrer Aufhebung (`web/kd-app.css:533, 537, 539`); 4 Selektoren für ✕.

### Vorplanung (Bubbles in `Dokumentation/Planung/kanbanD.md`)

| Bubble | Feature | Inhalt | Aufwand | Braucht |
|---|---|---|---|---|
| B0458 | F0063 | Akzeptanztests „von Board nehmen“ rückgängig | 1-1,5 | — |
| B0459 | F0063 | Auflegen an einer Stelle | 1-2 | — |
| B0460 | F0063 | Rückgängig-Art legen | 1-2 | B0458, B0459 |
| B0461 | F0063 | Hinweis bricht um | 0,5-1 | B0458 |
| B0462 | F0064 | Akzeptanztests Zeiteintrag rückgängig im Fenster | 1-1,5 | — |
| B0463 | F0064 | Hinweis im obersten Fenster (wartet auf Artboard-Freigabe) | 1-2 | B0460, B0462 |
| B0464 | F0064 | Rückgängig-Art zeit | 0,5-1 | B0463 |
| B0465 | F0064 | Hinweis in der Probe schmal wie breit | 0,5-1 | B0461, B0464 |
| B0466 | F0065 | Akzeptanztests Teilaufgabe rückgängig | 1-1,5 | — |
| B0467 | F0065 | Teilaufgabe an einer Stelle anlegen | 1-2 | — |
| B0468 | F0065 | Rückgängig-Art teilaufgabe | 0,5-1 | B0463, B0466, B0467 |
| B0469 | F0066 | Akzeptanztests Anhang rückgängig | 1-1,5 | — |
| B0470 | F0066 | Erst lesen, dann löschen | 1-2 | B0463, B0469 |
| B0471 | F0066 | Rückgängig-Art anhang | 0,5-1 | B0470 |
| B0472 | F0067 | Akzeptanztest Sichtbarkeit der ✕ | 0,5-1 | — |
| B0473 | F0067 | ✕ ohne Hover sichtbar | 0,5-1 | B0472 |

Die Bubbles sind Vorgabe für den Bau, keine Vereinbarung; geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

Nach Skill `test-pyramide`. Jede US-Szene wird ein Test, jeder Test prüft eine Zustandsänderung in Datei, Commit oder Schirm (Skill `test-ehrlichkeit`).

- **Integration (cargo)**: `tests/zuordnung.rs` und `tests/teilaufgaben.rs` je Parameter: Einfügestelle, fehlend, zu groß, ungültig (400), ein Commit, alter Aufruf unverändert (AK 10).
- **Unit (cargo)**: Einfügestelle im Dienst, gekappt auf die Länge (FA 12).
- **E2E (Playwright)**: neu `e2e/tests/r00112-rueckgaengig.spec.js` mit US-1 bis US-11; Muster `r00031-rueckgaengig.spec.js` (`kanbanStarten(einrichten(DATEIEN))`, `alsPerson(page,'st')`, `k.git('log', …)`). Erweitert: `r00111-schmal-wie-breit.spec.js` (Hinweis im Fenster). Mitlaufend grün: `r00031-rueckgaengig.spec.js`, `ziele.spec.js`, `kontrast.spec.js`, `e2e/einheit/uebernahme.test.js`.
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #12 und wird mit seinem Bubble grün. Ausnahme: der Touch-Teil von US-10 ist nach `web/kd-app.css:539` vermutlich schon heute grün; deshalb prüft US-10 auch den feinen Zeiger (heute rot) und hat einen Mutanten als Gegenprobe.
- **Zeit**: `page.clock` statt Warten (NFA 6).

## Abhängigkeiten

- ADR-0017 (Akzeptiert); ADR-0009 (400 statt 422), ADR-0010 (Fokus N7a/N7b), ADR-0011 (Kontrast), ADR-0012 (Trefferfläche), ADR-0014 (Übernahme-Wächter), ADR-0015 (Fuß als Meldungsort, Breitenregeln), ADR-0016 (sichtbarer Bereich).
- Abhängig von (alle grün): I0031 Rückgängig (R00031), I0095 Fokus, I0097 Bedienziele groß genug (R00108). B0465 erweitert die Probe aus I0100 (R00111), deren Spec auf main liegt.
- Blockiert: keine Interaction. Folgekarte #102 (Herkunft entfernen) kann denselben Mechanismus nutzen.

## Offene Fragen

1. **Lage des Hinweises im Aufgabenfenster** — offen, an den product-owner. Der Hinweis mit „rückgängig“ im obersten Fenster ist eine neue Lage (PO Z. 153). Empfehlung: der gestalter zeichnet den Zustand „Hinweis mit rückgängig im Aufgabenfenster“ an D0003, hell und dunkel, bei 320, 414 und 1280 px, mit gleichzeitiger Meldung im Fuß; der product-owner gibt ihn frei, bevor B0463 baut. Bis dahin frei baubar: F0063, F0067, B0462, B0466, B0467, B0469.
2. **Herkunft entfernen** — geschlossen, PO Z. 160: nicht Teil, Folgekarte #102.
3. **Positionstreue** — geschlossen, PO Z. 161: gehört zur Abnahme (AK 2, 5, 10); bei Fremdänderung gilt der gemerkte Index, gekappt auf die Länge (FA 12).

## Manuelle Vorbereitungstätigkeiten
Artboard-Freigabe nach Offene Fragen 1 vor B0463.

## Manuelle Nachbereitungstätigkeiten
Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Das Problem hat zwei Ursachen. Erstens kennt der Rückgängig-Mechanismus aus R00031 nur Bewegungen, deren Gegenaktion schon in der API liegt; für Entfernen fehlt dort die Stelle, an die zurückgelegt wird, und beim Anhang fehlt der Inhalt. Die Anforderung ergänzt genau das: Inhalt und Stelle werden beim Klick gemerkt, die API nimmt die Stelle als optionalen Wunsch, und der Anhang wird gelesen, bevor er gelöscht wird. Weil Rückgängig eine neue Aktion bleibt, trifft es auf denselben Schutz wie jede andere Aktion und überschreibt keinen Agenten. Zweitens liegt der Hinweis heute unter dem Fenster, das alles darunter inert macht; im obersten Fenster wird er bedienbar. Die ✕ werden sichtbar, weil die Regel, die sie versteckt, entfällt, statt dass eine weitere Ausnahme dazukommt.

## Missing-Docs
- Glossar: kein Eintrag für „Hinweis“ (`.toast`) und „Rückgängig“; die Begriffe stehen nur in ADR-0017 und R00031.
- `A00003`, `A00004`, `A00009` beschreiben ADR-0017 als Soll. Nach dem Bau nennt der Entwickler dort die Parameter und den Ort des Hinweises.
- `D0003.dc.html` zeigt keinen Hinweis-Zustand (Offene Fragen 1).

## Notizen
- **Nachzug 2026-11-08 auf den gebauten Stand** (Zweig `karte/12`): Commit-Text des Wiederauflegens in AK 2 und US-1 „… gelegt (Zu erledigen)“ statt „(Stefan)“, Wer steht im Git-Autor (PO Z. 165); Ausnahme zu Strg+Z im leeren Feld in FA 2 und Fokus als Rangliste in FA 8 (ADR-0017 N2, Commit 20ced77); Ablehnungstext des Zeit-Rückgängig in FA 4, AK 7 und US-7 (Commit 8405a03); typografische Anführungszeichen in AK 1, 2, 5, 10. Keine Änderung am Umfang.
- **Abnahme der Karte #12**: die Abnahme-Probe steht wörtlich in AK 1, die drei Proben aus PO Z. 161 wörtlich in AK 2, 5 und 10.
- **Optionen (ADR-0017)**:
  - A, gewählt: Rückgängig als neue Aktion über die API mit gemerktem Inhalt — nutzt den Mechanismus aus R00031, ein Commit je Schritt, keine Sonderwege im Server.
  - B, verworfen: verzögertes Löschen, erst nach Ablauf des Hinweises schreiben — bricht die Zusage, dass jede Änderung sofort in der Datei steht; andere Tabs und Agenten sähen 8 s lang den alten Stand; Schließen des Tabs verlöre die Aktion; widerspräche ADR-0014.
  - C, verworfen: eigener Wiederherstellungs-Endpunkt (Commit zurücknehmen oder Inhalt aus Git lesen) — scheitert oft, weil die Datei inzwischen anders geändert wurde, braucht eine neue Leseschnittstelle in A00007 und deutlich mehr Servercode. Bleibt Rückfall nur für Anhänge, falls der Blob im Tab stört (ADR-0017 Pre-Mortem).
  - D, verworfen: Bestätigungsdialog statt Rückgängig — Reibung bei jeder gewollten Aktion; die Karte verlangt ausdrücklich Rückgängig.
- **Entscheidungen des planers**:
  - Elterndialog D0003: drei der vier Arten und der neue Ort des Hinweises liegen im Aufgabenfenster; „von Board nehmen“ liegt in der Aufgabenliste (D0004).
  - Vertikal geschnitten statt nach Schichten: jeder Slice bringt seinen Server-Parameter, seine Art und seinen Test mit. F0063 ist der Walking Slice ohne Fenster und damit ohne Artboard-Abhängigkeit; F0064 bringt den Hinweis ins Fenster, weil der Zeiteintrag keinen neuen Parameter braucht.
  - Positionstreue ist kein eigener Slice, sondern Teil von F0063 und F0065.
  - Die Teilaufgaben in „Neue Aufgabe“ bekommen kein Rückgängig (nicht gespeichert); ihr ✕ wird über dieselbe CSS-Regel sichtbar.
