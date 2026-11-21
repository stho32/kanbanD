//! R00220 (ADR-0036 Nachtrag „Umschalten“): „Transkripte erfassen“ umschalten — Dienst und Routen (AK 1–4, US-1..US-3).
mod gemeinsam;

use gemeinsam::{git, lies};
use kanband::dienst::{Kanban, Schalterantwort};
use kanband::fehler::Fehler;
use kanband::modell::{Art, Person};
use std::path::{Path, PathBuf};

/// Das Board mit dem Namen aus 60 Zeichen (R00220 Ausgangslage): ein Slug hat höchstens 40 Zeichen, der Name ist der Titel.
const LANG: &str = "lang";
const LANGER_NAME: &str = "zweites-board-mit-einem-sehr-langen-namen-aus-sechzig-zeiche";
const EINSTELLUNGEN: &str = "---\npeople:\n  sh: {name: Stefan, kind: human}\n  entw1: {name: Entwickler, kind: agent}\nclasses: {}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n";

/// Die Ausgangslage von R00220: Vorgabe ohne Schlüssel (also „aus“), `fabrik` mit `record-transcripts: true`, `zweit`
/// und das Board mit 60 Zeichen ohne Schlüssel. Die Dateien stehen in der Form, die kanbanD selbst schreibt — so zeigt
/// der Diff eines Umschaltens, ob wirklich nur der Schlüssel dazukommt.
fn ausgangslage(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    let e = kanband::format::einstellungen::lesen(EINSTELLUNGEN).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), kanband::format::einstellungen::schreiben(&e)).unwrap();
    for (slug, titel, kopf) in [("fabrik", "fabrik", "---\nrecord-transcripts: true\n---\n\n"), ("zweit", "zweit", ""), (LANG, LANGER_NAME, "")] {
        let roh = format!("{kopf}# {titel}\n\n## Eingang\n\n## Fertig\n");
        let b = kanband::format::board::lesen(slug, &roh).unwrap();
        std::fs::write(pfad.join(format!("boards/{slug}.md")), kanband::format::board::schreiben(&b, |_| None)).unwrap();
    }
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
}

fn mensch() -> Person {
    Person { kuerzel: "sh".into(), name: "Stefan".into(), art: Art::Mensch, aktiv: true }
}

fn agent() -> Person {
    Person { kuerzel: "entw1".into(), name: "Entwickler".into(), art: Art::Agent, aktiv: true }
}

fn commits(pfad: &Path) -> u32 {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

/// Ein Commit mehr, und er nennt genau diese eine Datei.
fn ein_commit_an(pfad: &Path, vorher: u32, datei: &str) {
    assert_eq!(commits(pfad), vorher + 1, "genau ein Commit");
    assert_eq!(git(pfad, &["show", "--name-only", "--format=", "HEAD"]), datei, "genau eine Datei");
}

/// Die geänderten Zeilen des letzten Commits ohne Kopf: nur der Schlüssel und, wo der Frontmatter neu entsteht oder
/// verschwindet, sein Rahmen.
fn nur_der_schluessel_geaendert(pfad: &Path) {
    let diff = git(pfad, &["show", "-U0", "--format=", "HEAD"]);
    let geaendert: Vec<&str> = diff.lines().filter(|z| (z.starts_with('+') || z.starts_with('-')) && !z.starts_with("+++") && !z.starts_with("---")).collect();
    assert!(!geaendert.is_empty(), "{diff}");
    for z in &geaendert {
        let inhalt = &z[1..];
        assert!(inhalt.starts_with("record-transcripts: ") || inhalt == "---" || inhalt.is_empty(), "fremde Zeile im Diff: {z:?}\n{diff}");
    }
}

struct Lage {
    _tmp: tempfile::TempDir,
    pfad: PathBuf,
    kanban: Kanban,
}

fn lage() -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let pfad = tmp.path().join("ordner");
    ausgangslage(&pfad);
    let kanban = Kanban::neu(pfad.clone());
    Lage { _tmp: tmp, pfad, kanban }
}

fn antwort(erfassen: Option<bool>, wirksam: bool) -> Schalterantwort {
    Schalterantwort { erfassen, wirksam }
}

// ---- B1133 Dienst ----

/// AK 1 / US-1 (Dienst): `true` schreibt den Schlüssel, gleicher Wert committet nicht, `None` entfernt ihn wieder.
#[test]
fn dienst_board_an_und_wie_vorgabe() {
    let l = lage();
    let vorher = commits(&l.pfad);
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", Some(true)).unwrap(), (true, antwort(Some(true), true)));
    ein_commit_an(&l.pfad, vorher, "boards/zweit.md");
    nur_der_schluessel_geaendert(&l.pfad);
    assert!(lies(&l.pfad, "boards/zweit.md").contains("\nrecord-transcripts: true\n"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%an|%s"]), "Stefan|Transkripte auf „zweit“: an");

    let datei = lies(&l.pfad, "boards/zweit.md");
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", Some(true)).unwrap(), (false, antwort(Some(true), true)));
    assert_eq!((commits(&l.pfad), lies(&l.pfad, "boards/zweit.md")), (vorher + 1, datei), "gleicher Wert: kein Commit, zeichengleich");

    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", None).unwrap(), (true, antwort(None, false)));
    ein_commit_an(&l.pfad, vorher + 1, "boards/zweit.md");
    nur_der_schluessel_geaendert(&l.pfad);
    assert!(!lies(&l.pfad, "boards/zweit.md").contains("record-transcripts"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%s"]), "Transkripte auf „zweit“: wie Vorgabe");
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", None).unwrap(), (false, antwort(None, false)));
    assert_eq!(commits(&l.pfad), vorher + 2);
}

/// `false` am Board wird ausdrücklich geschrieben, auch wenn die Vorgabe schon „aus“ ist; `wirksam` folgt der Vorgabe bei `None`.
#[test]
fn dienst_board_aus_ausdruecklich_und_wirksam_nach_vorgabe() {
    let l = lage();
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "fabrik", Some(false)).unwrap(), (true, antwort(Some(false), false)));
    assert!(lies(&l.pfad, "boards/fabrik.md").contains("\nrecord-transcripts: false\n"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%s"]), "Transkripte auf „fabrik“: aus");
    l.kanban.vorgabe_transkripte_setzen(&mensch(), true).unwrap();
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), LANG, None).unwrap(), (false, antwort(None, true)), "wie Vorgabe, die jetzt an ist");
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "fabrik", None).unwrap(), (true, antwort(None, true)));
}

/// AK 2 / US-1 (Dienst): verglichen wird der wirksame Wert — „aus“ ohne Schlüssel ändert nichts; danach ausdrücklich.
#[test]
fn dienst_vorgabe_vergleicht_den_wirksamen_wert() {
    let l = lage();
    let (vorher, datei) = (commits(&l.pfad), lies(&l.pfad, "kanbanD.md"));
    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), false).unwrap(), (false, antwort(Some(false), false)));
    assert_eq!((commits(&l.pfad), lies(&l.pfad, "kanbanD.md")), (vorher, datei), "fehlt der Schlüssel, ist „aus“ schon wirksam");

    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), true).unwrap(), (true, antwort(Some(true), true)));
    ein_commit_an(&l.pfad, vorher, "kanbanD.md");
    nur_der_schluessel_geaendert(&l.pfad);
    assert!(lies(&l.pfad, "kanbanD.md").contains("\nrecord-transcripts: true\n"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%an|%s"]), "Stefan|Transkripte, Vorgabe des Ordners: an");

    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), false).unwrap(), (true, antwort(Some(false), false)));
    ein_commit_an(&l.pfad, vorher + 1, "kanbanD.md");
    assert!(lies(&l.pfad, "kanbanD.md").contains("\nrecord-transcripts: false\n"), "ausdrücklich geschrieben");
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%s"]), "Transkripte, Vorgabe des Ordners: aus");
    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), false).unwrap(), (false, antwort(Some(false), false)));
    assert_eq!(commits(&l.pfad), vorher + 2);
}

/// AK 3 / US-2 (Dienst): ein Agent bekommt immer 403 mit `einstellung`, auch bei gleichem Wert und unbekanntem Board.
#[test]
fn dienst_agent_schaltet_nie() {
    let l = lage();
    let (vorher, fabrik, vorgabe) = (commits(&l.pfad), lies(&l.pfad, "boards/fabrik.md"), lies(&l.pfad, "kanbanD.md"));
    let erwartet = "Den Schalter „Transkripte erfassen“ stellen nur Menschen um";
    for f in [
        l.kanban.board_transkripte_setzen(&agent(), "fabrik", Some(true)).unwrap_err(),
        l.kanban.board_transkripte_setzen(&agent(), "fabrik", Some(false)).unwrap_err(),
        l.kanban.board_transkripte_setzen(&agent(), "gibtsnicht", Some(true)).unwrap_err(),
        l.kanban.vorgabe_transkripte_setzen(&agent(), true).unwrap_err(),
        l.kanban.vorgabe_transkripte_setzen(&agent(), false).unwrap_err(),
    ] {
        assert!(matches!(&f, Fehler::SchalterVerboten { .. }), "{f:?}");
        assert_eq!(f.meldung(), erwartet);
    }
    assert_eq!((commits(&l.pfad), lies(&l.pfad, "boards/fabrik.md"), lies(&l.pfad, "kanbanD.md")), (vorher, fabrik, vorgabe));
}

/// Ein unbekanntes Board ergibt für einen Menschen 404, ohne Commit.
#[test]
fn dienst_unbekanntes_board() {
    let l = lage();
    let vorher = commits(&l.pfad);
    assert!(matches!(l.kanban.board_transkripte_setzen(&mensch(), "gibtsnicht", Some(true)), Err(Fehler::NichtGefunden(_))));
    assert_eq!(commits(&l.pfad), vorher);
}

// ---- B1134 Routen ----

use gemeinsam::{Laufendes, senden, senden_roh};
use reqwest::Method;
use serde_json::{Value, json};

struct Instanz {
    _tmp: tempfile::TempDir,
    pfad: PathBuf,
    lauf: Laufendes,
}

fn instanz() -> Instanz {
    let tmp = tempfile::tempdir().unwrap();
    let pfad = tmp.path().join("ordner");
    ausgangslage(&pfad);
    let lauf = gemeinsam::starten_in_berlin(&pfad, &["--port", "0"]);
    Instanz { _tmp: tmp, pfad, lauf }
}

impl Instanz {
    async fn board(&self, wer: &str, slug: &str, rumpf: Value) -> (u16, Value) {
        senden(Method::PUT, &self.lauf.adresse, &format!("api/boards/{slug}/transkripte"), wer, rumpf).await
    }

    async fn vorgabe(&self, wer: &str, rumpf: Value) -> (u16, Value) {
        senden(Method::PUT, &self.lauf.adresse, "api/einstellungen/transkripte", wer, rumpf).await
    }

    async fn lesen(&self, pfad: &str) -> Value {
        let (s, v) = senden(Method::GET, &self.lauf.adresse, pfad, "sh", json!(null)).await;
        assert_eq!(s, 200, "{pfad}: {v}");
        v
    }

    /// Alle versionierten Dateien als ein Text — „zeichengleich“ heißt: dieser Text bleibt.
    fn dateien(&self) -> String {
        git(&self.pfad, &["ls-files"]).lines().map(|n| format!("== {n}\n{}", lies(&self.pfad, n))).collect()
    }
}

/// AK 1 / US-1: Board an, gleicher Wert, `null`, ungültige Rümpfe und unbekanntes Board über die Route.
#[tokio::test]
async fn ak1_board_umschalten_ueber_die_route() {
    let i = instanz();
    let vorher = commits(&i.pfad);
    assert_eq!(i.board("sh", "zweit", json!({"erfassen": true})).await, (200, json!({"erfassen": true, "wirksam": true})));
    ein_commit_an(&i.pfad, vorher, "boards/zweit.md");
    assert!(lies(&i.pfad, "boards/zweit.md").contains("\nrecord-transcripts: true\n"));
    assert_eq!(i.board("sh", "zweit", json!({"erfassen": true})).await, (200, json!({"erfassen": true, "wirksam": true})));
    assert_eq!(commits(&i.pfad), vorher + 1, "gleicher Wert: kein Commit");
    assert_eq!(i.board("sh", "zweit", json!({"erfassen": null})).await, (200, json!({"erfassen": null, "wirksam": false})));
    ein_commit_an(&i.pfad, vorher + 1, "boards/zweit.md");
    assert!(!lies(&i.pfad, "boards/zweit.md").contains("record-transcripts"));
    assert_eq!(i.board("sh", "zweit", json!({"erfassen": null})).await.0, 200);
    assert_eq!(commits(&i.pfad), vorher + 2, "null ohne Schlüssel: kein Commit");
    assert_eq!(i.lesen("api/boards/zweit").await["transkripte_erfassen"], json!(null));

    let (stand, dateien) = (commits(&i.pfad), i.dateien());
    for rumpf in [json!({}), json!({"erfassen": "an"}), json!({"erfassen": 1})] {
        let (s, v) = i.board("sh", "zweit", rumpf.clone()).await;
        assert_eq!(s, 400, "{rumpf}: {v}");
        assert!(v["fehler"].is_string(), "{v}");
    }
    let (s, v) = i.board("sh", "gibtsnicht", json!({"erfassen": true})).await;
    assert_eq!(s, 404, "{v}");
    assert_eq!((commits(&i.pfad), i.dateien()), (stand, dateien), "kein Commit, Dateien zeichengleich");
}

/// AK 2 / US-1: die Vorgabe vergleicht den wirksamen Wert; das Lesefeld an `GET /api/einstellungen`.
#[tokio::test]
async fn ak2_vorgabe_und_lesefeld() {
    let i = instanz();
    assert_eq!(i.lesen("api/einstellungen").await.get("transkripte_erfassen"), Some(&json!(null)), "Ausgangslage: kein Schlüssel, das Feld steht da");
    let (vorher, datei) = (commits(&i.pfad), lies(&i.pfad, "kanbanD.md"));
    assert_eq!(i.vorgabe("sh", json!({"erfassen": false})).await, (200, json!({"erfassen": false, "wirksam": false})));
    assert_eq!((commits(&i.pfad), lies(&i.pfad, "kanbanD.md")), (vorher, datei), "der Schlüssel fehlt weiter");

    assert_eq!(i.vorgabe("sh", json!({"erfassen": true})).await, (200, json!({"erfassen": true, "wirksam": true})));
    ein_commit_an(&i.pfad, vorher, "kanbanD.md");
    assert_eq!(i.lesen("api/einstellungen").await["transkripte_erfassen"], json!(true));
    assert_eq!(i.vorgabe("sh", json!({"erfassen": false})).await, (200, json!({"erfassen": false, "wirksam": false})));
    ein_commit_an(&i.pfad, vorher + 1, "kanbanD.md");
    assert!(lies(&i.pfad, "kanbanD.md").contains("\nrecord-transcripts: false\n"));
    assert_eq!(i.lesen("api/einstellungen").await["transkripte_erfassen"], json!(false));

    let (stand, dateien) = (commits(&i.pfad), i.dateien());
    for rumpf in [json!({"erfassen": null}), json!({}), json!({"erfassen": "aus"})] {
        let (s, v) = i.vorgabe("sh", rumpf.clone()).await;
        assert_eq!(s, 400, "{rumpf}: {v}");
    }
    assert_eq!((commits(&i.pfad), i.dateien()), (stand, dateien));
}

/// AK 3 / US-2: ein Agent bekommt an beiden Routen dieselbe 403 — vor Rumpf (auch kein JSON, kein `Content-Type`), Board
/// und Sperre, auch bei gleichem Wert. Mutation „Prüfung in der Route entfernt“: der ungültige Rumpf ergibt 400 statt 403.
#[tokio::test]
async fn ak3_nur_menschen_schalten() {
    let i = instanz();
    let erwartet = json!({"fehler": "Den Schalter „Transkripte erfassen“ stellen nur Menschen um", "einstellung": "record-transcripts"});
    let (stand, dateien) = (commits(&i.pfad), i.dateien());
    for (slug, rumpf) in [("fabrik", json!({"erfassen": true})), ("fabrik", json!({"erfassen": false})), ("fabrik", json!({"erfassen": "an"})), ("fabrik", json!({})), ("gibtsnicht", json!({"erfassen": true}))] {
        assert_eq!(i.board("entw1", slug, rumpf.clone()).await, (403, erwartet.clone()), "{slug} {rumpf}");
    }
    for rumpf in [json!({"erfassen": true}), json!({"erfassen": null}), json!({"erfassen": false}), json!("kaputt")] {
        assert_eq!(i.vorgabe("entw1", rumpf.clone()).await, (403, erwartet.clone()), "{rumpf}");
    }
    for (pfad, art) in [("api/boards/fabrik/transkripte", Some("application/json")), ("api/einstellungen/transkripte", None), ("api/boards/fabrik/transkripte", Some("text/plain"))] {
        let a = senden_roh(Method::PUT, &i.lauf.adresse, pfad, "entw1", art, "{kein json").await;
        assert_eq!((a.status, a.json()), (403, erwartet.clone()), "{pfad} {art:?}");
    }
    assert_eq!((commits(&i.pfad), i.dateien()), (stand, dateien), "kein Commit, Dateien zeichengleich");
    let a = senden_roh(Method::PUT, &i.lauf.adresse, "api/boards/fabrik/transkripte", "sh", Some("application/json"), "{kein json").await;
    assert_eq!(a.status, 400, "ein Mensch mit kaputtem Rumpf: 400");
}

/// FA 6: Endpunkt-Liste und OpenAPI nennen die neuen Routen und ersetzen „nur von Hand in der Datei gesetzt“.
#[tokio::test]
async fn beschreibung_nennt_das_umschalten() {
    let i = instanz();
    let d = i.lesen("api/openapi.json").await;
    let neu = "umschalten nur Menschen über `PUT …/transkripte`";
    for (pfad, methode) in [("/api/boards", "get"), ("/api/boards/{slug}", "get"), ("/api/einstellungen", "get")] {
        let text = d["paths"][pfad][methode]["description"].as_str().unwrap();
        assert!(text.contains(neu) && !text.contains("nur von Hand"), "{pfad}: {text}");
    }
    for pfad in ["/api/boards/{slug}/transkripte", "/api/einstellungen/transkripte"] {
        let put = &d["paths"][pfad]["put"];
        assert!(put["description"].as_str().unwrap().contains("403"), "{pfad}: {put}");
        assert!(put["responses"]["403"].is_object(), "{pfad}: {put}");
        let zeile = kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode == "PUT" && e.pfad == pfad).unwrap_or_else(|| panic!("{pfad} fehlt in /api/endpunkte"));
        assert!(zeile.wer && zeile.zweck.contains("nur Menschen"), "{pfad}: {}", zeile.zweck);
    }
    for e in kanband::web::endpunkte::ENDPUNKTE {
        assert!(!e.zweck.contains("nur von Hand in der Datei gesetzt"), "{} {}", e.methode, e.pfad);
    }
}

// ---- B1135 Veralteter Stand ----

/// Ein Rumpf mit eingeschmuggeltem Schalter: an einem Objekt beide Schreibweisen, an einer Liste an jedem Objekt-Element.
fn eingeschmuggelt(rumpf: &Value) -> Value {
    let mut r = rumpf.clone();
    let schmuggeln = |o: &mut serde_json::Map<String, Value>| {
        o.insert("transkripte_erfassen".into(), json!(false));
        o.insert("record-transcripts".into(), json!(false));
    };
    match &mut r {
        Value::Object(o) => schmuggeln(o),
        Value::Array(liste) if liste.iter().all(Value::is_object) => liste.iter_mut().for_each(|e| schmuggeln(e.as_object_mut().unwrap())),
        // eine Liste aus Texten (Bindung) trägt kein Feld: das Objekt daneben ist der Schmuggelweg
        Value::Array(liste) => r = json!({"anwendungen": liste.clone(), "transkripte_erfassen": false, "record-transcripts": false}),
        _ => {}
    }
    r
}

/// AK 4 / US-3: der Stand S0 von vor dem Umschalten überschreibt den Schalter über keinen der vier Schreibwege.
/// Gegenprobe: der Mutant `*e = neu` ohne Übernahme in `einstellungen_setzen` macht diese Probe rot.
#[tokio::test]
async fn ak4_veralteter_stand_laesst_den_schalter_stehen() {
    let i = instanz();
    let einstellungen_s0 = i.lesen("api/einstellungen").await;
    let board_s0 = i.lesen("api/boards/zweit").await;
    assert_eq!((einstellungen_s0["transkripte_erfassen"].clone(), board_s0["transkripte_erfassen"].clone()), (json!(null), json!(null)), "S0: Schalter aus");
    assert_eq!(i.board("sh", "zweit", json!({"erfassen": true})).await.0, 200);
    assert_eq!(i.vorgabe("sh", json!({"erfassen": true})).await.0, 200);

    let spalten: Value = board_s0["spalten"].as_array().unwrap().iter().map(|s| json!({"name": s["name"], "alt": s["name"]})).collect();
    let wege = [
        ("api/einstellungen", einstellungen_s0.clone()),
        ("api/boards/zweit/spalten", spalten),
        ("api/boards/zweit/klassen", json!({"klassen": board_s0["klassen"]})),
        ("api/boards/zweit/anwendungen", board_s0["anwendungen"].clone()),
    ];
    let mut aufrufe = 0;
    for (pfad, rumpf) in wege {
        for gesendet in [rumpf.clone(), eingeschmuggelt(&rumpf)] {
            let (s, v) = senden(Method::PUT, &i.lauf.adresse, pfad, "sh", gesendet.clone()).await;
            aufrufe += 1;
            for datei in ["boards/zweit.md", "kanbanD.md"] {
                assert!(lies(&i.pfad, datei).contains("\nrecord-transcripts: true\n"), "{datei} nach {pfad} ({s} {v}) mit {gesendet}");
            }
        }
    }
    assert_eq!(aufrufe, 8);
    assert_eq!(i.lesen("api/einstellungen").await["transkripte_erfassen"], json!(true));
    assert_eq!(i.lesen("api/boards/zweit").await["transkripte_erfassen"], json!(true));
}
