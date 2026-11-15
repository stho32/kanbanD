# Angriffsmatrix #45 / R00158 — Wiederöffnen mit `board` nimmt eine archivierte Karte ohne 403 von Boards, die die Anfrage nicht nennt

> **Vermerk des Directors (2026-11-15): Die Karte #45 wird nicht gebaut.** Der Betreiber hat entschieden, dass „archiviert“ für die Karte auf allen Boards gilt und das Wiederöffnen mit `board` die Karte zusätzlich auf das genannte Board legt (heutiges Verhalten). R00158 und ADR-0005 Nachtrag N3 sind zurückgezogen; die Spalten „erwartet“ dieser Matrix sind damit kein Soll mehr. Die Datei bleibt als Beleg: die Einträge „heute“ mit Kennzeichen P sind am Programm `ec3ab76` geprobt und beschreiben das geltende Verhalten.

Stand: 2026-11-15, vor dem Bau (I0145, B0746–B0752). Geschrieben vom security-reviewer als Abnahme, gegen die Test zuerst gebaut wird.
Vorgaben: R00158 (AK 1–16), ADR-0005 N3, ADR-0003 N2, X00001, R00097, R00098, R00120, `AI-Team/po-entscheidungen.md` #45 A1–A6.

**Schutzziel:** Die Entnahmesperre (R00097/R00120: ein Agent holt keine Karte aus einer Menschen-Spalte, 403) bleibt auf allen Wegen bestehen. Die eine entschiedene Ausnahme — Wiederöffnen einer **archivierten** Karte über `key` mit `board` — reicht genau so weit: nur diese Karte, nur ihre Zeilen, nur zusammen mit ihrer Ankunft am Ziel in **einem** Commit, sonst nichts geschrieben.
Kein Schutzziel ist Vertraulichkeit zwischen Boards und die Echtheit von `X-KanbanD-Wer` (Full-Trust, Vision; die Regeln schützen vor Versehen).

**Akteure:** A0 ohne `X-KanbanD-Wer` · A0u unbekanntes/stillgelegtes Kürzel · A1 Agent `cl` · A3 Mensch `st` (Kontrolle, nie gesperrt).
**Linien:** L2 = Integrationstest gegen das echte Programm (`tests/`, `--port 0`; das ist die Linie des Projekts, ein eigenes L1 daneben gibt es nur für Zeile 5.10) · L3 entfällt (kein vorgelagerter Server im Projekt).
**Kürzel:** GB = Grundbestand aus R00158 (`fabrik`: Eingang [#3], In Arbeit [], Fertig [#7 archiviert, `key: k4`]; `zweit`: Eingang [#5]) · UA = Umzugsanfrage `POST /api/aufgaben {"titel":"x","key":"k4","board":"zweit","spalte":"Eingang"}` mit `X-KanbanD-Wer: cl` · NG = „nichts geschrieben“ nach R00158 (HEAD, `boards/`, `aufgaben/` gleich, Status leer, #7 weiter archiviert) · „Umzug“ = Ergebnis von AK 1 (#7 oben in Eingang von `zweit`, in keiner Spalte eines anderen Boards, ein Commit mit Aufgabendatei, `zweit` und jedem verlassenen Board).
**heute:** P = geprobt am 2026-11-15 an einer eigenen Instanz des Programms `ec3ab76` (ohne #45), Protokoll `proben-heute.txt` neben dieser Datei · G = am Code gelesen (`karte/45`, `0de02c7`).
**R00158:** deckendes Kriterium · „fehlt (Muss)“ = braucht ein Kriterium · „fehlt (Sollte)“ = Variante/Regression, hält nichts auf.

## Kontrollpaar

| # | Gegeben | Anfrage | Erwartet | Zustand danach | heute | R00158 |
|---|---|---|---|---|---|---|
| K1 | GB | UA | 200, `nummer: 7`, `neu: false` | Umzug; Commit = {`aufgaben/0007-fund.md`, `boards/fabrik.md`, `boards/zweit.md`} | P: 200, Commit ohne `boards/fabrik.md`, #7 steht weiter in Fertig von `fabrik` | AK 1 |
| K2 | GB, `fabrik` mit `column-owner: Fertig: human` | `cl`: `DELETE /api/boards/fabrik/aufgaben/7` | 403 `{"fehler":"Spalte „Fertig“ gehört dem Menschen","spalte":"Fertig","nummer":7}` | NG | P: gleich | AK 16 (R00097) — die Sperre der übrigen Wege steht |
| K3 | GB, `fabrik` mit verwaistem `column-owner: fertig: human` | `cl`: `DELETE /api/boards/fabrik/aufgaben/3` | 403, `fehler` beginnt „Ein Eintrag unter `column-owner` gehört dem Menschen“, `spalte: ""`, `nummer: 3` | NG | P: gleich | AK 16 (R00120) |

Ohne K2/K3 misst AK 8 nichts: die Sperre muss im selben Bestand an den anderen Wegen weiter greifen.

## Kernfrage 1 — Kann ein Agent eine NICHT archivierte Karte aus einer Menschen-Spalte ziehen? (erwartet: nein)

| # | Gegeben | Anfrage | Erwartet | Zustand danach | heute | R00158 |
|---|---|---|---|---|---|---|
| 1.1 | GB, aber #7 **offen** (kein `archived`), `Fertig: human` | UA | 200, `nummer: 7`, `neu: false`, kein neuer Kommentar | NG (ohne den Halbsatz „archiviert“): kein Commit, #7 weiter in Fertig von `fabrik`, nicht auf `zweit` | P: gleich | fehlt (Muss M1) |
| 1.2 | wie 1.1, statt Menschen-Spalte board-weite Sperre `fertig: human` | UA | wie 1.1 | wie 1.1 | G: gleich (`Vorhanden::Offen` → kein `schreiben`) | fehlt (Muss M1) |
| 1.3 | wie 1.1 | Kette `cl`: erst `POST /api/aufgaben/7/archivieren`, dann UA | 403 (Wortlaut K2), dann 200 `neu: false` | kein Commit in beiden Schritten, #7 offen in Fertig von `fabrik` | P: 403, dann 200 ohne Commit | fehlt (Muss M1) |
| 1.4 | GB mit `Eingang: human` und `Fertig: human`; #3 offen mit `key: k3` | `cl`: `POST /api/aufgaben/mehrere {"titel":[{"titel":"x","key":"k4"},{"titel":"y","key":"k3"},"Neu",{"titel":"z","key":"k4"}],"board":"zweit","spalte":"Eingang"}` | 201; Liste (7,false), (3,false), (8,true), (7,false) | Eingang von `zweit` = [7, 5, 8]; **#3 weiter in Eingang von `fabrik`, nicht auf `zweit`**; Fertig von `fabrik` leer; ein Commit = {0007, `0008-neu.md`, `fabrik`, `zweit`}, jede Datei einmal | P: 201, #3 bleibt, Commit ohne `fabrik`, #7 bleibt zusätzlich in Fertig | fehlt (Muss M1) |
| 1.5 | nach K1 legt `st` #7 wieder zusätzlich auf `fabrik` (bewusste Doppellage) | UA erneut | 200, `neu: false` | kein Commit, #7 bleibt auf beiden Boards | P (zweite UA nach K1: 200 ohne Commit), Doppellage G | fehlt (Muss M1, Variante) |
| 1.6 | GB, `Fertig: human` | `cl`: `POST /api/aufgaben/7/duplizieren {"board":"zweit","spalte":"Eingang"}` | 201, Kopie #8 ohne `key` | #7 weiter archiviert in Fertig von `fabrik`; Commit = {Kopie, `zweit`} | P: gleich | AK 16 — kein Umzug über die Kopie |
| 1.7 | GB, `Fertig: human` | UA mit `key: "K4"` | 201, neue Karte #8 | #7 unberührt; Commit = {neue Datei, `zweit`} | P: gleich | AK 16 (R00098, Groß/Klein) |
| 1.8 | GB, `Fertig: human`; dazu einmal mit `boards/kaputt.md` | UA von A0 (kein Kopf, leerer Kopf) und A0u (`xx`, `CL`, stillgelegt `ab`) | 400 „Wer handelt? Header X-KanbanD-Wer fehlt“ bzw. „Person „xx“ steht nicht in kanbanD.md“ bzw. „Person „ab“ ist stillgelegt“ — auch vor 423 | NG | P (ohne `kaputt.md`): gleich; mit `kaputt.md` G | fehlt (Sollte) |
| 1.9 | GB, `Fertig: human` | UA von `st` | 200 | Umzug | G (Mensch nie gesperrt; P für `st` in 2.3) | AK 8 (Kontrolle) |

## Kernfrage 2 — Kann ein Agent die Karte am Ziel dorthin legen, wohin er sonst nicht dürfte? (erwartet: am Ziel gilt genau das, was für eine neu angelegte Karte gilt)

Vorbemerkung: eine 403 beim **Hineinlegen** gibt es im Programm nicht (R00097 „Erlaubt bleibt“, R00098 AK „Eigentümer“, X00001-Tabelle). Die einzige Regel am Ziel ist die Grenze (409, nur Agent). Die Matrix hält fest, dass der Umzug daran nichts ändert — in beide Richtungen.

| # | Gegeben | Anfrage | Erwartet | Zustand danach | heute | R00158 |
|---|---|---|---|---|---|---|
| 2.1 | GB, `zweit` mit `Eingang: human` | UA | 200 | Umzug | P: 200 (ohne Entfernen auf `fabrik`) | fehlt (Sollte) |
| 2.2 | GB, `zweit` mit verwaistem `eingang: human` (board-weit) | Kontrolle `cl`: `{"titel":"Neu","key":"k9","board":"zweit"}`; dann UA | 201; dann 200 — dieselbe Durchlässigkeit für Neu und Wiederöffnen | Umzug | P: 201, 200 | fehlt (Sollte) |
| 2.3 | GB, `zweit` mit `limits: Eingang: 1` | UA von `cl`; dann von `st` | `cl`: 409 `{"fehler":"Grenze erreicht","spalte":"Eingang","grenze":1,"anzahl":1}`; `st`: 200 ohne `warnungen` | `cl`: NG — auch `boards/fabrik.md`; `st`: Umzug | P: 409 NG; 200 | AK 7 |
| 2.4 | GB, `zweit` mit `limits: Eingang: 2` | `cl`: `…/mehrere {"titel":[{"titel":"x","key":"k4"},"Neu"],"board":"zweit"}` | 409, `anzahl: 1` (gezählt nach allen Einträgen) | NG — keine Datei `0008`, `fabrik` unverändert | G (`grenze_in_mehrere_nach_allen_eintraegen`) | fehlt (Sollte, Variante AK 7) |
| 2.5 | GB mit `Eingang: human`, `Fertig: human`; #7 zusätzlich auf `privat`/Heute | `cl`: `{"titel":"x","key":"k4","board":"fabrik","spalte":"Eingang"}` | 200 | Eingang von `fabrik` = [7, 3], Fertig leer, `privat` ohne #7; Commit = {0007, `fabrik`, `privat`} | G (`agent_oeffnet_aus_menschenspalte` für ein Board) | AK 3 + AK 8 |
| 2.6 | wie 2.5, dazu `limits: Eingang: 1` auf `fabrik` | wie 2.5 | 409 `spalte: "Eingang"` | NG — `privat` führt #7 weiter | G | fehlt (Sollte, Variante AK 7) |
| 2.7 | GB, `zweit` mit `archived: 2026-11-01` (archiviertes **Ziel**) | Kontrolle `cl`: neu `k9` auf `zweit`; dann UA | wie heute: 201; 200 | Umzug auf das archivierte Board | P: 201; 200 | fehlt — Frage F2 |
| 2.8 | GB, `zweit` selbst defekt (Spalte „Eingang“ doppelt) | UA von `cl` und von `st` | 423, `fehler` beginnt mit „boards/zweit.md: Spalte „Eingang“ steht doppelt in der Board-Datei“ (Nachsatz offen, R00158 Offene Frage 2) | NG | P: 423 ohne Nachsatz, NG | kein AK (Offene Frage 2) — Status und NG gelten |
| 2.9 | GB, `zweit` mit Spalten Eingang (`human`) und „Freigegeben“ | UA mit `spalte: "Freigegeben"` | 200 | #7 oben in „Freigegeben“ — hinter der Menschen-Spalte des Ziels, in `fabrik` aus der Menschen-Spalte fort | G (Zielspalte frei, keine Prüfung) | fehlt — Frage F1 |

## Kernfrage 3 — Kann er Zeilen entfernen, ohne dass die Karte am Ziel ankommt? (erwartet: ein Commit oder keiner)

| # | Gegeben | Anfrage | Erwartet | Zustand danach | heute | R00158 |
|---|---|---|---|---|---|---|
| 3.1 | 409 am Ziel: Zeile 2.3 | | | NG | | AK 7 |
| 3.2 | GB, `fabrik` mit `limits: Fertig: 1`, Fertig = [#9, #7] | UA | 200 | Umzug, Fertig von `fabrik` = [9] | P: 409 `spalte: "Fertig"` | AK 11 |
| 3.3 | wie 3.2 | UA mit `board: "gibtsnicht"` | 404 „Board „gibtsnicht“ gibt es nicht“ | NG | **P: 409 `spalte: "Fertig"` — heute steht die 409 vor der 404** | fehlt (Sollte, Variante AK 13) |
| 3.4 | wie 3.2 | UA mit `spalte: "Nirgends"` | 400 „Spalte „Nirgends“ gibt es auf „zweit“ nicht“ | NG | **P: 409 vor 400** | fehlt (Sollte, Variante AK 13) |
| 3.5 | wie 3.2 | UA mit `board: "../boards/zweit"` | 400 „Board-Name „../boards/zweit“ ungültig: 1–40 Zeichen aus a–z, 0–9, -“ | NG | **P: 409 vor 400** | fehlt (Sollte, Variante AK 13) |
| 3.6 | wie 3.2 | `{"titel":"x","key":"k4"}` ohne `board` | `cl`: 409 `spalte: "Fertig"` | NG | P: gleich | AK 11 |
| 3.7 | GB | UA mit `board` = `"../boards/zweit"`, `"Zweit"`, `" zweit "`, `""`, `"zweit.md"`, `"zweit/"`, 41 × `z` | je 400 „Board-Name „…“ ungültig: 1–40 Zeichen aus a–z, 0–9, -“ | NG — keine Board-Datei geändert | P: gleich | fehlt (Sollte; `""` und `"Zweit"` als Varianten in AK 13) |
| 3.8 | GB | UA mit `board: 5`, `board: ["zweit"]`, `board` zweimal im Rumpf (`fabrik`, `zweit`) | 400 „board: Text erwartet, nicht Zahl“ / „… nicht Liste“ / „board: Feld mehrfach genannt“ | NG | P: gleich | AK 16 (ADR-0003 N1) |
| 3.9 | GB, #7 zusätzlich auf `privat` | `{"titel":"x","key":"k4","board":null,"spalte":null}` | 200 — wie ohne `board` | Commit = {0007}; alle Board-Dateien bytegleich | P: gleich (ohne `privat`) | fehlt (Sollte, Variante AK 4) |
| 3.10 | GB | `{"titel":"x","key":"k4","spalte":"Eingang"}` | 400 „Eine Spalte braucht ein Board“ | NG | P: gleich | AK 16 |
| 3.11 | GB, im Ordner ein `pre-commit`-Hook mit `exit 1` (Fehlerinjektion) | UA | 500, Meldung nennt „zurückgenommen“ | NG — **auch `boards/fabrik.md` steht auf HEAD**, Status leer | P: 500 „git commit: ; zurückgenommen: aufgaben/0007-fund.md, boards/zweit.md“, NG | fehlt (Sollte; ADR-0005 N3 Punkt 3 sagt es zu) |
| 3.12 | Schreibfehler mitten in `aktion()` (Board-Datei nicht schreibbar; Fehlerinjektion) | UA | 500 | Soll: NG. Risiko: `aktion()` bricht nach dem ersten geschriebenen Schritt ohne Rücknahme ab (`src/dienst/mod.rs:197–209`); mit dem Umzug kann der Arbeitsbaum „von `fabrik` genommen, nicht auf `zweit`“ zeigen | G, nicht geprobt | fehlt (Sollte, Vorbestand; Härtung: Zielboard vor den verlassenen Boards schreiben oder Rücknahme auch hier) |
| 3.13 | GB | `…/mehrere` mit `k4` und einem zweiten Eintrag mit leerem Titel / `key: ""` / ungültiger Angabe | 400 für die ganze Anfrage | NG | G (`ungueltiger_schluessel_legt_nichts_an`) | AK 16 |
| 3.14 | 423: Zeilen 5.4–5.6 | | | NG | | AK 6 |

## Kernfrage 4 — Kann er fremde Karten treffen?

| # | Gegeben | Anfrage | Erwartet | Zustand danach | heute | R00158 |
|---|---|---|---|---|---|---|
| 4.1 | GB; dazu #8 archiviert mit `key: k8`; `fabrik`: In Arbeit [#7], Fertig [#8, #7, #70]; `privat`: Heute [#7, #8, #17] | UA | 200 | `fabrik`: In Arbeit [], Fertig [8, 70]; `privat`: [8, 17]; `zweit`: [7, 5]; #8 bleibt archiviert; Commit = {0007, `fabrik`, `privat`, `zweit`}, die Datei von #8 steht nicht darin; jedes verlassene Board ist bis auf die Zeilen von #7 inhaltsgleich (Spalten, Nummernfolge, Frontmatter) | P: 200, Commit = {0007, `zweit`}, alle Zeilen stehen (Board mit doppelter Nummer ist lesbar) | fehlt (Muss M2) |
| 4.2 | GB, dazu #9 offen mit `key: k4`; einmal zusätzlich mit `boards/kaputt.md` | UA; und `…/mehrere {"titel":[{"titel":"n","key":"k8"},{"titel":"x","key":"k4"}],"board":"zweit"}` | 409 „Schlüssel „k4“ mehrfach vergeben: #7, #9“ (mit `kaputt.md`: Entscheidung E1) | NG — keine Karte `k8` | P (mit `kaputt.md`): 409, NG | AK 16 (R00098); E1 |
| 4.3 | GB | UA mit `key: " k4 "` | 200 (getrimmt, trifft #7) | Umzug | P: 200 (ohne Entfernen) | AK 1 (Variante) |
| 4.4 | GB | `…/mehrere` mit `k4` zweimal, `board: "zweit"` | 200, beide Einträge (7,false) — nicht 500 | Umzug, jede Datei einmal im Commit | P (in 1.4): kein 500 | AK 9 (Variante) |
| 4.5 | AK 9: #7 und #8 von verschiedenen Boards | wie AK 9 | 200 | ein Commit, jede Board-Datei einmal | G | AK 9 |
| 4.6 | AK 2: unbeteiligtes Board `drittes`; zusätzlich ein Board mit Menschen-Spalte/board-weiter Sperre, auf dem #7 **nicht** liegt | UA | 200 | unbeteiligte Boards bytegleich und nicht im Commit | G | AK 2 |
| 4.7 | GB; #3 archiviert **ohne** `key` in `Eingang: human` | UA mit `key: "3"` bzw. `"#3"` | 201 (neue Karte) | #3 unberührt — eine Karte ohne Schlüssel erreicht dieser Weg nie | G | AK 16 |

## Kernfrage 5 — Reihenfolge der Abweisungen und kein Teilzustand

Ordnung: 400 (Wer, Form, Schlüssel, Slug, Spalte) → 404 (Board) → 423 (defekte Board-Datei) → 409 (Grenze am Ziel). Keine Zeile dieses Wegs antwortet 403.

| # | Gegeben | Anfrage | Erwartet | Zustand danach | heute | R00158 |
|---|---|---|---|---|---|---|
| 5.1 | GB + `boards/kaputt.md` (Spalte „A“ doppelt) + `zweit` voll (`Eingang: 1`) | UA mit `key: ""` | 400 „Schlüssel: 1–200 Zeichen ohne Zeilenumbruch“ | NG | P: gleich | AK 13 |
| 5.2 | wie 5.1 | UA mit `spalte: "Nirgends"` | 400 „Spalte „Nirgends“ gibt es auf „zweit“ nicht“ | NG | P: gleich | AK 13 |
| 5.3 | wie 5.1 | UA mit `board: "gibtsnicht"` | 404 | NG | P: gleich | AK 13 |
| 5.4 | wie 5.1 | UA | 423 `{"fehler":"boards/kaputt.md: Spalte „A“ steht doppelt in der Board-Datei — nur lesbar, bis die Datei repariert ist"}`, nicht 409 | NG | P: 409 (Grenze) — heute gibt es die 423 nicht | AK 13 |
| 5.5 | GB + `boards/kaputt.md` | UA von `cl` und von `st`; `…/mehrere` mit `k8` neu und `k4` | 423 wie 5.4, für beide Arten und für die ganze Anfrage | NG, keine Karte `k8` | G: 200, Umzug ohne Entfernen (P in 5.6) | AK 6 |
| 5.6 | GB + `boards/Kaputt Name.md` (ungültiger Name); einmal zusätzlich `boards/kaputt.md` | UA | 423 „boards/Kaputt Name.md: Dateiname ist kein gültiger Board-Name — umbenennen — nur lesbar, bis die Datei repariert ist“; bei beiden die erste nach Dateiname (`Kaputt Name.md` vor `kaputt.md`, Reihenfolge wie `defekte` in `GET /api/zustand`) | NG | P: 200 (Datei wird übergangen); Reihenfolge der `defekte` P | AK 6 (R00158 Offene Frage 1) |
| 5.7 | GB + `boards/kaputt.md` | „nur dieser Weg“: neu `k8` mit `board`; derselbe ein zweites Mal; `k4` ohne `board` | 201; 200 ohne Commit; 200 | wie heute | G | AK 6 |
| 5.8 | GB mit `Fertig: human` + `zweit` voll | UA | 409 `spalte: "Eingang"` — nicht 403 | NG | G (P einzeln: 2.3, K1 mit Menschen-Spalte 200) | AK 7 + AK 8 (Kombination fehlt, Sollte) |
| 5.9 | GB mit `Fertig: human` bzw. `fertig: human` (board-weit) | UA | 200, nicht 403; `column-owner` steht weiter in `boards/fabrik.md` | Umzug | P: 200, aber #7 bleibt in Fertig | AK 8 |
| 5.10 | GB + Board `privat`; L1, deterministisch über den vorhandenen Haken `zwischen_suche_und_schreiben` (`src/dienst/aufgabe_anlegen.rs:178`) | erster Aufruf UA (`zweit`) hält zwischen Suche und Schreiben; zweiter Aufruf mit `board: "privat"` läuft an | der zweite kommt nicht durch, solange der erste hält; danach erster 200 mit Commit, zweiter 200 `neu: false` ohne Commit | #7 liegt nur auf `zweit`, ein Commit | G (eine Sperre, Muster `gleichzeitig_genau_eine_karte`) | fehlt (Sollte) |
| 5.11 | Rücknahme bei gescheitertem Commit: Zeile 3.11 | | | NG | | fehlt (Sollte) |

## Kernfrage 6 — Verrät eine Antwort etwas über Boards, die die Anfrage nicht nennt?

Befund vorab (P): `GET /api/boards` liefert ohne Kopf alle Boards mit Spalten und Nummern, `GET /api/aufgaben?key=k4&archivierte=ja` jeden Schlüssel, `GET /api/zustand` die defekten Dateien mit Pfad und Grund. Zwischen Boards gibt es keine Vertraulichkeit; geprüft wird deshalb nur, dass der Umzug **keine neue** Auskunft und keinen neuen Wortlaut einführt.

| # | Gegeben | Anfrage | Erwartet | heute | R00158 |
|---|---|---|---|---|---|
| 6.1 | K1 | UA | Rumpf der 200 hat genau die Felder der heutigen Antwort (Karte + `neu`); kein Feld nennt ein Board | P: Felder `nummer, datei, titel, key, …, neu`, kein Board | fehlt (Sollte; Implementierungshinweis „Kein neues Feld“) |
| 6.2 | K1 | `git log -1 --format=%s` | „#7 erneut gefunden: wieder geöffnet“, nennt kein Board | P: gleich | AK 14 |
| 6.3 | 3.2 | UA | keine 409 mehr mit der Spalte eines nicht genannten Boards (`spalte: "Fertig"` ohne Boardname) | P: heute 409 `spalte: "Fertig"` | AK 11 |
| 6.4 | 5.5 | UA | die 423 nennt Pfad und Grund einer Datei, die die Anfrage nicht nennt — wortgleich mit `defekte` aus `GET /api/zustand`, nichts darüber hinaus (keine Karte, keine Spalte der Karte) | P: `defekte` trägt genau diesen Pfad und Grund | AK 6 |
| 6.5 | 3.11 | UA | die 500 nennt die Pfade der Schritte, künftig auch die verlassenen Boards — nur bei Fehlerinjektion, keine neue Auskunft (siehe Befund vorab) | P: nennt 0007 und `zweit` | — (zur Kenntnis) |
| 6.6 | K1 | Karte #7 lesen | Kommentar „Erneut gefunden (Schlüssel „k4“)“ von `cl` unverändert; an der Karte steht kein Hinweis auf verlassene Boards (sichtbar nur in Commit und Verlauf — akzeptierte Schwäche ADR-0005 N3) | P: Kommentar gleich | AK 16 |

## Methode, Pfad, Kopf (L2, Regression des Einstiegs)

| # | Anfrage (Rumpf der UA) | Erwartet | Zustand | heute |
|---|---|---|---|---|
| E.1 | `PUT` / `PATCH /api/aufgaben` | 405 | NG | P |
| E.2 | `GET /api/aufgaben` mit `X-HTTP-Method-Override: POST` | 200 (Liste), kein Schreiben | NG | P |
| E.3 | `POST /api/aufgaben/`, `//api/aufgaben`, `/API/aufgaben`, `/api/aufgaben%2Fmehrere` | 404 | NG | P |
| E.4 | `POST /api/aufgaben` mit `Content-Type: text/plain` | 415 `{"fehler": …}` | NG | P |
| E.5 | Kopf klein geschrieben (`x-kanband-wer: cl`), Wert mit Leerzeichen (`" cl "`) | wie `cl` | Umzug | P: wie `cl` |

Diese Zeilen ändern sich durch #45 nicht; sie brauchen kein Kriterium in R00158 (AK 16 deckt sie über die bestehende Suite).

## Entscheidungen offen

- **F1 (product-owner) — Zielspalte frei wählbar (Zeile 2.9).** A2 begründet die Öffnung mit „kommt nicht ungesichtet in Arbeit oder Auslieferung“. Das gilt nur, wenn die Anfrage eine Eingangsspalte nennt: `spalte` wählt der Agent frei, auch eine Spalte hinter der Menschen-Spalte des Ziels, und über `GET /api/aufgaben?key=…&archivierte=ja` kennt jeder Agent jeden Schlüssel. Neu durch #45: die Karte verschwindet dabei aus der Menschen-Spalte des nicht genannten Boards (bisher blieb sie dort stehen, und der Agent bekam sie dort nicht heraus). Empfehlung: **so lassen und als gewollt festhalten** — Full-Trust, auf demselben Board ist es seit R00098 so (`agent_oeffnet_aus_menschenspalte`), und jede Einschränkung der Zielspalte wäre eine neue 403, die A2 ausschließt; Zeile 2.9 hält das Verhalten fest, der Begründungssatz in A2 sollte „wenn der Sensor die Eingangsspalte nennt“ tragen.
- **F2 (product-owner) — archiviertes Zielboard (Zeile 2.7).** Anlegen auf ein archiviertes Board geht heute (201, P). Mit dem Umzug kann eine Karte damit von einem aktiven Board auf ein archiviertes wandern und aus den offenen Sichten verschwinden. Empfehlung: **so lassen** (Vorbestand des Anlegewegs, „Nicht hinein: Änderungen an Auflegen“); eine Sperre für archivierte Ziele wäre eine eigene Karte für alle Anlegewege, nicht für diesen einen.
- **E1 (architekt/planer) — Schlüssel mehrfach vergeben und zugleich defekte Board-Datei (Zeile 4.2).** Heute 409 (P). Empfehlung: **409 bleibt** — die Schlüsselsuche liegt vor dem Board-Schritt, und ADR-0003 N2 nimmt einen 409, der keine Sperre ist, ausdrücklich aus der Ordnung; in beiden Fällen NG.

## Nicht abgedeckt

- L3: das Projekt hat keinen vorgelagerten Server; die Bindung an `--host` ändert #45 nicht.
- Doppelt gesetzter `X-KanbanD-Wer`-Kopf: nicht geprobt; der Kopf ist keine Sicherheitsgrenze.
- Übertragung (chunked, Tröpfeln, große Rümpfe): Rahmen unverändert (ADR-0003 N3, Karte #39); Last- und Flutproben sind vom Auftrag ausgeschlossen.
- Kosten: der Weg liest künftig die ganze Boardliste. Hinweis für den Bau: einmal je Anfrage, nicht je Karte (`…/mehrere`); kein Kriterium (product-owner: keine Lastprobe).
- Defekte **Aufgabendatei** mit dem Schlüssel der Anfrage: Karte #44 / R00157.
- Zweiter kanbanD-Prozess auf demselben Ordner: die Sperre ist prozessweit (X00001, Notizen), Vorbestand.
- Live-Ereignis und Sichten (AK 10), Oberfläche: nicht Teil der Zugriffsgrenze.
- Unicode-Normalisierung des Schlüssels: R00098 vergleicht genau; unverändert.
