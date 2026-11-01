# ADR-0006: Einstellung verboten — dritte strukturierte Abweisung nach ADR-0003, eigene Variante und eigenes Schema, je Endpunkt eine 403-Form

**Status**: Akzeptiert
**Datum**: 2026-11-01
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #27)
**Kontext-Anforderung**: R00102 (ergänzt ADR-0003 aus R00096, R00097)
**Erprobt durch**: —

## Kontext

- ADR-0003 legt fest: je strukturierter Abweisung eine fachlich benannte Variante von `Fehler` mit Feldern, `fehler` als erstes Feld im Rumpf. Gebaut sind `GrenzeErreicht` (409) und `Verboten { meldung, spalte, nummer }` (403) — `src/fehler.rs`, Abbildung `src/web/mod.rs` (`impl IntoResponse for Fehler`), Schemata `src/web/openapi.rs` (`GrenzeErreicht`, `Verboten`, Beschreibungs-Enum `Konflikt`).
- R00102 verlangt für einen Agenten, der über `PUT /api/boards/{slug}/spalten` Grenze oder Eigentümer ändert, `403 {fehler, spalte, einstellung}` mit `einstellung` ∈ `"grenze" | "eigentuemer"`, ohne Commit; die Meldung hat zwei Wortlaute („Grenze der Spalte „<Name>“ ändern nur Menschen“ bzw. „Eigentümer …“).
- Der Rumpf von R00097 verlangt `nummer` als Pflichtfeld; `nummer: null` ist durch die PO-Entscheidung `AI-Team/po-entscheidungen.md` Z. 48 ausgeschlossen.
- Belegt (Code): `Fehler::Verboten` entsteht nur in `src/dienst/zugregeln.rs:25` und wird nur an den Zug-Endpunkten als 403 beschrieben (`src/web/mod.rs:342`). `PUT …/spalten` (`src/web/mod.rs:405–412`) beschreibt heute keine 403. Kein Client wertet 403 generisch aus (Suche in `web/*.js` und den Werkzeugen der Factory ohne Treffer).
- Belegt (Code): `src/modell/board.rs` verwendet `Fehler`; das Modell hängt also schon vom Fehlertyp ab.

## Optionen

### Option A: eigene Variante `Fehler::EinstellungVerboten { meldung, spalte, einstellung }` und eigenes Schema `openapi::EinstellungVerboten` (Plan aus R00102)
- Vorteile: folgt der Linie von ADR-0003 ohne Ausnahme; `Verboten` und sein Rumpf bleiben unberührt; der Compiler zwingt jede erschöpfende `match`-Stelle zur Entscheidung; Tests vergleichen Varianten.
- Nachteile: zwei 403-Rümpfe im System; ein Client unterscheidet sie am Endpunkt bzw. am Feld (`einstellung` oder `nummer`), nicht an einem Diskriminator; eine Variante mehr an jeder `match`-Stelle.

### Option B: `Verboten` mit optionaler `nummer` (und optionaler `einstellung`)
- Vorteile: eine 403-Variante, keine neue Abbildung.
- Nachteile: bricht den Rumpf aus R00097 (Pflichtfeld wird optional, PO Z. 48); das Schema verliert seine Aussage; jeder Konstrukteur müsste ungültige Kombinationen (beides, keins) vermeiden — der Typ verhindert sie nicht.

### Option C: eine 403-Variante mit Grund: `Fehler::Verboten { meldung, spalte, grund: Sperre }`, `Sperre::Entnahme { nummer } | Einstellung { einstellung }`, per `serde(flatten)` auf dieselben Rümpfe wie A
- Vorteile: „403 = einem Agenten verboten“ steht an einer Stelle im Typ; Abbildung auf den Status und künftiges Logging (ADR-0001) einmal statt zweimal; auf dem Draht gleich wie A.
- Nachteile: baut gebauten Code um (`zugregeln.rs:25`, Tests `zugregeln.rs:143,157`, `web/mod.rs:1498`) ohne fachlichen Gewinn; `flatten` über ein Enum macht die OpenAPI-Beschreibung undeutlich (utoipa erzeugt ein `oneOf`, je Endpunkt gilt aber nur eine Form); zwei Ebenen `match` statt einer.

### Option D: gemeinsamer Diskriminator für alle 403 (`{fehler, spalte, verbot: "entnahme" | "einstellung", …}`)
- Vorteile: Clients unterscheiden an einem Feld statt an der Anwesenheit von Feldern.
- Nachteile: ändert den Rumpf aus R00097 (additiv, aber eine Änderung gebauten Verhaltens) und weicht vom Rumpf aus R00102 ab; ADR-0003 kennt auch für 409 keinen Diskriminator — es entstünde eine zweite Linie.

## Entscheidung

**Gewählt: Option A**, mit drei Festlegungen:

1. **Typisierte Einstellung**: `einstellung` ist das Enum `Einstellung { Grenze, Eigentuemer }` aus dem Modell (`src/modell/board.rs`, wie im Grobentwurf von R00102), serialisiert als `"grenze"` bzw. `"eigentuemer"` und als `ToSchema` mit diesen beiden Werten beschrieben — kein `String`. Die Rückbeziehung `fehler` → `modell` nehmen wir in Kauf: beides liegt in einer Crate, `Einstellung` ist ein reines Daten-Enum ohne eigenes Verhalten.
2. **Ein Ort für den Wortlaut**: die Variante entsteht nur über einen Konstruktor `Fehler::einstellung_verboten(spalte, einstellung)`, der die Meldung aus der Einstellung bildet. So können `meldung` und `einstellung` nicht auseinanderlaufen; `meldung()` liefert wie bei `Verboten` das gespeicherte Feld.
3. **Je Endpunkt höchstens eine 403-Form**: `PUT /api/boards/{slug}/spalten` antwortet nur mit `EinstellungVerboten`, die Zug-Endpunkte nur mit `Verboten`. Deshalb braucht es kein Beschreibungs-Enum wie `Konflikt`; der Handler `spalten_setzen` nennt `(status = 403, body = EinstellungVerboten)`. Ein Client unterscheidet die Formen am Endpunkt, ein generischer Client am Feld `einstellung` bzw. `nummer`.

Begründung: Option A ist die bestehende Systemantwort (zweimal gebaut) und berührt nichts Gebautes. C wäre auf dem Draht gleichwertig und hätte eine Stelle weniger für Status und Logging, kostet aber einen Umbau an R00097 ohne Nutzen für Agenten. B und D ändern einen zugesagten Rumpf.

**Akzeptierte Schwäche**: Es gibt zwei 403-Rümpfe ohne gemeinsamen Diskriminator; ein Client, der nur den Status prüft und `nummer` erwartet, liest an `PUT …/spalten` ins Leere. Wir nehmen das hin, weil die Formen nach Endpunkt getrennt sind und `fehler` als erstes Feld in beiden steht.

## Konsequenzen

**Positiv:**
- Rümpfe aus R00096 und R00097 unverändert; die neue Abweisung ist additiv.
- `fehler` bleibt erstes Feld; Oberfläche und Clients, die nur `fehler` lesen, zeigen die Meldung ohne Änderung.

**Negativ / Inkauf zu nehmen:**
- Jede erschöpfende `match`-Stelle über `Fehler` (`meldung()`, `IntoResponse`) bekommt eine dritte strukturierte Variante.
- `fehler.rs` verweist auf `modell::Einstellung`.

**Durchsetzung:**
- Unit auf `IntoResponse` (B0300): Status 403, Feldreihenfolge `fehler, spalte, einstellung`, kein Feld `nummer`.
- Test der Beschreibung (B0307): `/api/openapi.json` führt an `PUT …/spalten` die 403 mit Schema `EinstellungVerboten`, an keinem Zug-Endpunkt.
- Review-Punkt `architektur-reviewer`: ein Endpunkt, der beide 403-Formen liefern kann, braucht vorher eine neue ADR (Beschreibungs-Enum nach dem Muster `Konflikt` oder Diskriminator).

**Folgeentscheidungen / Aufgaben:**
- [ ] Wird ADR-0001 (Logging) angenommen: auch `EinstellungVerboten` als Warning protokollieren (wie die Folgeaufgabe in ADR-0003).
- [ ] Liefert künftig ein Endpunkt beide 403-Formen: Beschreibungs-Enum `Verbot` (untagged) oder Diskriminator — neue ADR.

## Quellen / Bezuege

- ADR-0003 (Linie: eine Variante je strukturierter Abweisung), ADR-0002 (Regel unter der Sperre vor `aktion()`)
- R00102 „Abweisung“, „Grobentwurf“; WBS I0087, B0300, B0301, B0307
- R00097 „Antwortform 403“; `AI-Team/po-entscheidungen.md` Z. 48 und Z. 55
- `src/fehler.rs`, `src/web/mod.rs:147–170, 342, 405–412`, `src/web/openapi.rs:44–61`, `src/dienst/zugregeln.rs:25`
