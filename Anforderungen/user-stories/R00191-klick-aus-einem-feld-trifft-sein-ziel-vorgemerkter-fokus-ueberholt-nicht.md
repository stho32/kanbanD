# User Story R00191 — Klick aus einem Feld heraus trifft sein Ziel

Als Mensch, der in den Berichten ein Datum tippt und danach weiterklickt, und der Aufgaben bearbeitet, während der Server noch antwortet,
möchte ich, dass mein Klick sein Ziel trifft und mir kein Fokus weggenommen wird,
damit ich nicht zweimal klicken muss und meine nächsten Tasten dort landen, wo ich bin.

Herstellbar über die API: eingerichteter Ordner, Board mit `report-filter: {period: eigen, from: 2026-11-12}`, Aufgabe #1 mit Beschreibung ([R00191](../R00191-klick-aus-einem-feld-trifft-sein-ziel-vorgemerkter-fokus-ueberholt-nicht.md)).

## US-1: Aus dem Datumsfeld in ein anderes Feld oder aufs Menü

- **Gegeben** der geöffnete Durchsatz, in „Zeitraum von“ ist `3112` und `2026` getippt, das Feld nicht verlassen
- **Wenn** ich mit der Maus in „Zeitraum bis“ klicke
- **Dann** ist `from: 2026-12-31` gespeichert und der Fokus steht in „Zeitraum bis“; klicke ich stattdessen auf „Berichte“, ist das Menü nach diesem einen Klick offen und das Datum gespeichert (heute: Fokus verloren, Menü erst beim zweiten Klick)

## US-2: Gehaltenes oder unfertiges Datum, dann Klick

- **Gegeben** der geöffnete Durchsatz, in „Zeitraum von“ ist nur `3112` getippt (Tag und Monat über dem gespeicherten Jahr), allein gedrückte Strg-Taste dazwischen
- **Wenn** ich in „Zeitraum bis“ klicke
- **Dann** ist `from: 2026-12-31` gespeichert und der Fokus steht in „Zeitraum bis“; war das Jahr unfertig (`31122`), zeigt „Zeitraum von“ wieder 12.11.2026 und nichts ist gespeichert; wurde nach der Strg-Taste `2026` getippt, steht 31.12.2026 im Feld

*(US-2 geändert 2026-11-17 mit AK 3 der Anforderung — Widerspruch zu R00173 „Schaden a“.)*

## US-3: Nach dem Speichern der Beschreibung ins Kommentarfeld

- **Gegeben** das Aufgabenfenster von #1, die Beschreibung in Bearbeitung, die Antwort auf das Speichern kommt erst nach 500 ms
- **Wenn** ich Strg+Enter drücke und sofort ins Kommentarfeld klicke
- **Dann** bleibt der Fokus nach der Antwort im Kommentarfeld; ohne Klick steht er auf dem Stift
