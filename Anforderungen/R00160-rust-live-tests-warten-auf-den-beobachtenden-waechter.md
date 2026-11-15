---
id: R00160
status: Neu
datum: 2026-11-15
---

# R00160: Rust-Live-Tests warten auf den beobachtenden Wächter

## Beschreibung

Die Live-Tests in `tests/live.rs` wackeln unter Last (Folgekarte #163 aus #139, Stelle `tests/live.rs:57`). **Am Verhalten des Programms ändert sich nichts.**

**Ursache** (Architektur 2026-11-15, am Code belegt, nicht gefahren): Nicht die 3-s-Frist ist zu kurz, sondern die inotify-Instanzen der Umgebung sind erschöpft. Jede Programminstanz öffnet zwei (`src/web/mod.rs:48` Ordner, `:135` fremde WBS), die Grenze 128 gilt je Benutzer über alle Prozesse. Ohne Instanz läuft das Programm ohne Wächter weiter und meldet das nur auf stderr (`src/web/mod.rs:56`, `:140`); dann kommt nie ein Ereignis, und die Frist in `gemeinsam::ereignis_abwarten` (`tests/gemeinsam/mod.rs:112`) läuft unabhängig von ihrer Länge ab.

**Abhilfe** (ADR-0026, Nachtrag 2026-11-15, Regel 7), nur in `tests/gemeinsam/mod.rs` und `tests/live.rs`: Eine Hilfe startet die Instanz für Live-Tests mit mitgeschnittenem stderr und wartet die erste HTTP-Antwort ab (Router und Wächter sind dann gebaut). Steht auf stderr „… nicht beobachtet“, beendet sie die Instanz und startet neu, begrenzt auf eine Obergrenze in der Größenordnung von 30 s ab dem ersten Startversuch; danach scheitert sie mit der benannten Ursache „inotify-Grenze der Umgebung“. Direkt gestartete Wächter (`waechter::starten`, `fremde_starten`, heute `.unwrap()`) wiederholen genauso bei `Err`. Die 3-s-Frist bleibt und misst danach nur noch das Programm.

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Getestet wird mit `cargo test` (Unit und Integration) und Playwright (E2E gegen das echte Programm)“.

## Akzeptanzkriterien

Wortlaut der Architektur.

- [ ] **AK 1:** Ein Live-Test löst erst aus, wenn das Bereitzeichen vorliegt: keine Zeile „nicht beobachtet“ nach der ersten Antwort bzw. `Ok` vom Wächterstart.
- [ ] **AK 2:** Fehlt das Bereitzeichen bis zur Obergrenze, scheitert der Test mit einer Meldung, die die inotify-Grenze nennt — nicht mit „kein passendes Ereignis“.
- [ ] **AK 3:** Abnahme-Probe: vier gleichzeitige Läufe der gebauten Testdatei `live`, fünf Runden, 20 von 20 grün (rund 30–60 s). Nur fahren, wenn kein anderes Gate läuft — die Grenze ist rechnerweit.
- [ ] **AK 4:** `git diff --stat` zeigt nur `tests/`; die 3-s-Frist ist nicht erhöht.
- [ ] **AK 5:** Der Commit nennt die Ursache.

Lesart zu AK 4: gemeint ist der Bau gegen den Stand der Planung; Dokumente der Karte (`Anforderungen/`, `Dokumentation/`) zählen nicht.

## Nicht hinein

- Produktivcode (`src/`, `web/`).
- „Ausfall des Ordner-Wächters sichtbar machen“ (Feld in der API, Hinweis in der Oberfläche) — Sollte, keine Karte.
- Die festen 100-ms-Pausen in `tests/live.rs:14` und `tests/gemeinsam/mod.rs:109`.
- Tests serialisieren, Frist verlängern, Wächter in anderen Tests abschalten (im ADR-Nachtrag verworfen).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: unter Last oder neben einem zweiten Gate sind die inotify-Instanzen des Benutzers belegt, die Instanz des Tests startet ohne Wächter, und der Test wartet 3 s auf ein Ereignis, das nie kommen kann. Löst der Test erst aus, wenn der Wächter nachweislich beobachtet (X), gibt es den Lauf „ausgelöst ohne Wächter“ nicht mehr (Y); ein Rot heißt dann entweder „das Programm hat nicht gemeldet“ oder nennt die Grenze der Umgebung beim Namen (Z). Der Hebel ist das Bereitzeichen und nicht die Frist, weil ohne Wächter keine Frist reicht.

## Notizen

- **Herkunft:** Karte #163; Technik: ADR-0026, Nachtrag 2026-11-15 (`dab3185`). WBS: I0147 unter D0002 neben I0137, Bubbles B0763–B0765.
- **Keine User Story:** Testcode ohne Nutzerverhalten (wie R00150, R00156); abgenommen wird über AK 1–5. Keine Oberfläche; Labels: keine.
- **Probe zuerst** (`AI-Team/factory.md`, „Schlank arbeiten“ A): Die Ursache ist gelesen, nicht gefahren. B0763 stellt sie am heutigen Stand unter belegter Grenze nach; zeigt die Probe eine andere Ursache, meldet der entwickler das, bevor er weiterbaut.
- **Umfang:** I0147: 3 Bubbles, alle klar; Summe der Spannen 2–4 h (Hypothese, ungemessen).
