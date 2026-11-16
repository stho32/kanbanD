---
id: R00177
status: Neu
datum: 2026-11-16
---

# R00177: Markdown — Links, fett, kursiv und Code in Teilaufgaben

## Beschreibung

Herkunft: Karte #185, Betreiber am 2026-11-16 wörtlich: „Funktioniert markown auch in den Sub-Tasks korrekt?“ Heute nicht: der Text einer Teilaufgabe erscheint im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) roh, auch Links sind nicht klickbar. Fehlender Umfang, kein Fehler.

**Gewünscht:** Im Text einer Teilaufgabe werden Links, nackte Adressen, fett, kursiv und Code formatiert — nur innerhalb der Zeile, ohne Blockelemente. Weil ein Link nie in einem Knopf stehen darf ([ADR-0030](../Dokumentation/ADRs/0030-markdown-aus-fremdem-text-erst-maskieren-feste-elemente.md) Punkt 8, Lehre aus R00162), ist der Text nicht länger selbst ein Knopf: ein Klick neben den Link bearbeitet wie heute, für die Tastatur bekommt jede Zeile einen Stift-Knopf nach dem Muster der Beschreibung. Bearbeitet wird der Rohtext. Sicherheit nach ADR-0030 (Punkte 1–8); die Adressprüfung baut Karte #187 voraus.

**Wirkung auf den Bestand (gezählt am Board des Projekts): keine der 76 gespeicherten Teilaufgaben sieht danach anders aus.**

Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0003.dc.html#markdown-elemente`. Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“ (Markdown bleibt Markdown, kanbanD zeigt es lesbar).

## Akzeptanzkriterien

- [ ] **AK 1 Abnahme-Probe der Karte:** Gegeben die Teilaufgabe `siehe https://example.org und **wichtig**`. Wenn ich das Fenster öffne, dann ist die Adresse ein Link in neuem Fenster und „wichtig“ fett. Heute rot: Rohtext.
- [ ] **AK 2 Nur innerhalb der Zeile:** `*schräg*`, `` `code` `` und `[Doku](https://example.org)` werden formatiert; die Teilaufgaben `# x`, `- x`, `> x` und `| a | b |` erscheinen unverändert als Text.
- [ ] **AK 3 Klick:** Ein Klick auf den Link öffnet ihn in einem neuen Fenster, die Zeile wechselt dabei nicht ins Bearbeiten. Ein Klick auf den Text daneben öffnet das Textfeld mit dem Rohtext `siehe https://example.org und **wichtig**`.
- [ ] **AK 4 Tastatur:** Jede Zeile trägt einen Stift-Knopf; er ist mit Tab erreichbar und öffnet das Textfeld. Nach Speichern oder Esc steht der Fokus auf dem Stift derselben Zeile. Der Link ist mit Tab erreichbar, der Text selbst nicht mehr.
- [ ] **AK 5 Kein Link in einem Knopf:** Im Aufgabenfenster liegt kein Link in einem `button` oder einem Element mit der Rolle Knopf.
- [ ] **AK 6 Bleibt Rohtext, bleibt bedienbar:** Die Karte auf dem Board und der Dialog „Neue Aufgabe“ zeigen den Text der Teilaufgabe weiter roh. Abhaken, Löschen über ✕ und Umsortieren durch Ziehen wirken wie heute.
- [ ] **AK 7 Fremder Text:** Die feindlichen Texte aus ADR-0030 bleiben Text, auch als Teilaufgabe.
- [ ] **AK 8 Bleibt:** Alles, was heute gerendert wird, wird weiter gleich gerendert (fester Vergleich), außer: eine Adresse mit Sternen behält ihr Ziel unverändert (`https://example.org/a*b*c` — heute steht ein `<em>` im Ziel).

## Tests

Unit zuerst (AK 1 rot, beide Einstiege mit den feindlichen Texten), fester Vergleich um die eine Abweichung erweitert; E2E als Spec für AK 1, 3, 4, 5.

## Implementierungshinweise

- Bauart (architekt, am Code gelesen): `inline()` wird als `markdownInline` exportiert und schützt Adressen per Platzhalter wie heute Code. Die Zeile (`web/ansicht.js` um `:463`): der Text-`span` verliert Rolle und Tab-Halt, bleibt per Maus klickbar; Wächter für Links vor `web/app.js` um `:2611`; Fokus-Rückgabe (`web/app.js` um `:1306`) zeigt auf den Stift.
- **Beim Bau zu proben, nicht zugesagt:** das Ziehen der Zeile, wenn sie am Link angefasst wird (`draggable`); das Ergebnis steht im Bericht des entwicklers.
- **Nicht hinein:** Kommentare (R00178) · Tabellen und andere Blöcke in Teilaufgaben · Bilder · rohes HTML · Checklisten als Kästchen.

## Warum löst diese Anforderung das Problem?

Auslöser: Eine Teilaufgabe verweist auf eine Seite, der Mensch muss die Adresse aus dem Rohtext herauskopieren. Wird die Adresse ein Link (X), öffnet ein Klick die Seite, während das Fenster offen bleibt (Y); der Mensch folgt dem Verweis aus der Teilaufgabe, ohne ins Bearbeiten zu geraten (Z).

## Offene Fragen

Keine.
