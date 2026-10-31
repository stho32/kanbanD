# Entscheidungen des Product Owners

Der Product Owner entscheidet Rückfragen der Rollen im Sinne der Vision und legt dem Auftraggeber nur richtungsweisende Fragen vor (Regeln: `rollen/product-owner/entscheiden.md` der Factory). Jede Zeile bleibt stehen; kippt der Auftraggeber eine Entscheidung, kommt eine neue Zeile mit Verweis.

## Vorbehalte des Auftraggebers

Themen, die der Auftraggeber immer selbst entscheiden will:

- (keine)

## Entscheidungen

| Datum | Karte | Frage (Kurz) | Entscheidung | Begründung | Quelle | Status |
|---|---|---|---|---|---|---|
| 2026-10-31 | #7 (+#14) I0083 | Navigation unter 600 px: Menü hinter Knopf „<Seite> ▾“ oder M3 Navigation bar unten? | Menü hinter Knopf „<Seite> ▾“ mit allen sechs Zielen (wie R00101) | M3 Navigation bar trägt 3–5 Ziele, kanbanD hat sechs; eine untere Leiste nimmt dem dichten Board Höhe. Deckt den Wunsch des Auftraggebers „nach M3-Breakpoints in ein Overflow-Menü bzw. in die Navigation“. Geltung: alle Ansichten mit Kopfzeile, compact. Das Wireframe D0002 legt die Anordnung nach Breite nicht fest, also gilt der Standard (Lücke aus M3) | Vision Leitplanke „Der Mensch sieht jede Gestaltung“; R00101 Optionen A; M3 Navigation bar https://m3.material.io/components/navigation-bar/overview; Empfehlung planer | entschieden |
| 2026-10-31 | #7 (+#14) I0083 | Bereichsfilter über 840 px jetzt als M3 connected Button group neu zeichnen? | Nein, nicht in R00101 und keine eigene Karte jetzt | Gestaltung ohne Befund; die bisherige Gruppe ist bedienbar. Das Einfachere zuerst; eine Karte erst, wenn eine Durchsicht einen Befund dazu liefert | Wie ich entscheide, Punkt 4; R00101 Notizen „Bewusst außerhalb“; Empfehlung planer | entschieden |
| 2026-10-31 | #7 (+#14) I0083 | Tippflächen der Kopfzeile bei Touch: 32 px (R00077) oder 48 dp (M3)? Verhältnis zu Karte #10 | Kein eigener Wert in R00101: die Kopfzeile nutzt das zentrale Touch-Maß des Projekts (heute 32 px aus R00077) als Untergrenze; den Zielwert legt Karte #10 fest und hebt ihn zentral, R00101 erbt ihn ohne Änderung. Die Probe „mindestens 32 × 32 px“ bleibt als Untergrenze stehen; der Satz „nicht die 48 dp von M3, weil der zentrale Stil vorgeht“ entfällt | Eine Zielgröße an genau einem Ort; ≥ 32 px widerspricht ≥ 44 px aus #10 nicht, ein festgeschriebenes „nicht 48, Stil geht vor“ täte es. So muss #10 nur das zentrale Maß ändern, nicht R00101 | R00077 (Touch ≥ 32 px); Karte #10 (WCAG 2.5.8, Touch 44–48 px); gemeinsam/regeln.md „Gestaltung“ (zentraler Stil vor M3); teils abweichend von Empfehlung planer | entschieden |
