---
id: R00093
status: Erledigt
datum: 2026-10-25
---

# R00093: OpenAPI-Beschreibung der API

## Beschreibung

Die API beschreibt sich heute als HTML (`/api`) und als knappe JSON-Liste (`/api/endpunkte`: Methode, Pfad, Zweck). Felder, erlaubte Werte (`art: agent|human`) und Formate (`dauer`) muss ein Agent im Quelltext suchen. Künftig liefert kanbanD unter **`/api/openapi.json`** eine vollständige OpenAPI-3.1-Beschreibung, erzeugt aus den Rust-Typen mit `utoipa`; `GET /api` mit `Accept: application/json` leitet dorthin.

Zahlt ein auf: [Vision](R00000-vision.md) — KI-Agenten über die API als gleichwertige Nutzer.

## Geschäftlicher Nutzen

Agenten (und Werkzeuge wie Generatoren oder Swagger UI) lesen Felder, Typen und Fehlerformen direkt aus der API — kein Suchen im Quelltext, keine gescheiterten ersten Skripte.

## Funktionale Anforderungen

- `GET /api/openapi.json` → OpenAPI 3.1, `info.version` = Paketversion.
- Jede Route des Routers steht darin mit Methode, Pfad, Parametern, Anfragekörper (Schema), Antworten (Schema je Status, auch `{fehler}`), Header `X-KanbanD-Wer` und `X-KanbanD-Instanz`, wo gebraucht.
- Aufzählungen als `enum` (z. B. `art`, Ergebnis eines Durchlaufs); Formate als `pattern`/`description` (Zeitpunkt mit Versatz, `dauer`).
- Die Antwortregel aus R00092 steht in `info.description`.
- `GET /api` mit `Accept: application/json` → `303` auf `/api/openapi.json`; die HTML-Seite verlinkt sie oben deutlich.
- `/api/endpunkte` bleibt (Abwärtskompatibilität) und wird aus derselben Quelle gespeist oder bleibt unverändert; die HTML-Seite bleibt.
- Ein Test bricht, wenn eine Route im Router fehlt, die nicht in der OpenAPI-Beschreibung steht (und umgekehrt).

## Akzeptanzkriterien

- [x] `GET /api/openapi.json` ist gültiges OpenAPI 3.1 (`openapi: 3.1.x`, alle `$ref` auflösbar)
- [x] Der Pfad `/api/boards/{slug}/ziehen` enthält `requestBody` mit `von`, `nach` und Antworten `200`, `400`, `404`
- [x] Das Schema `Person` hat `art` mit `enum: [human, agent]`
- [x] `curl -H 'Accept: application/json' /api` → `303` mit `Location: /api/openapi.json`
- [x] Test „jede Router-Route ist beschrieben“ ist grün und schlägt fehl, wenn eine Route ohne Beschreibung hinzukommt

## Betroffene Verzeichnisstruktur

`Cargo.toml` (`utoipa`, ggf. `utoipa-axum`), `src/web/mod.rs` (Routen mit `#[utoipa::path]`), `src/web/openapi.rs` (neu, `ApiDoc`), DTOs in `src/modell/` und `src/dienst/` mit `ToSchema`; Tests `tests/openapi.rs`.

## Technische Überlegungen

- `utoipa` 5 mit `utoipa-axum` (`OpenApiRouter`) erzeugt Router und Beschreibung aus einer Quelle; das erfüllt die Vollständigkeitsprüfung konstruktiv. Alternativ `#[utoipa::path]` je Handler plus Test, der Router-Pfade mit `paths` vergleicht.
- Vor dem Einsatz Probe nach Skill `dependency-probe`: Router-Erzeugung, Schema eines Enums mit `serde(rename)`, Pfadparameter `{nr}`.
- Diese Anforderung kommt bewusst nach R00087, R00090, R00091, R00092, damit nur einmal beschrieben wird.

## Tests
**Integration:** Abruf und Struktur, `Accept`-Weiterleitung, Vollständigkeit. **Unit:** keine.

## Abhängigkeiten
- Abhängig von: R00087, R00090, R00091, R00092, R00094 (alle neuen Endpunkte)

## Offene Fragen
- keine — „volles OpenAPI 3 über `utoipa`“ entschieden am 2026-10-25 (Feedback-Runde Punkt 11)

## Notizen
### Verworfene Alternativen
- Vorhandene Liste ausbauen: eigenes Format, kein Werkzeug versteht es.
- Nur Auffindbarkeit: die Felder blieben im Fließtext.

## Warum löst diese Anforderung das Problem? (Pflicht)

Beschreibung ohne Felder → Agent sucht im Quelltext → Fehlversuche. OpenAPI aus den Typen → Felder, Werte und Formate sind maschinenlesbar und können nicht vom Code abweichen, weil sie aus ihm erzeugt werden.
