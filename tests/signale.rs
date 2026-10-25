//! R00076: Signale — in `kanbanD.md` eingerichtet, je Aufgabe `signals: [...]`, gesetzt und zurückgenommen über die API.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

const MIT_SIGNALEN: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses:\n  bug: {label: Fehler, color: red}\nsignals:\n  mail: {label: Neue E-Mail, color: blue}\n  fragen: {label: Coding-Agent hat Fragen, color: violet}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n";

fn starten(tmp: &tempfile::TempDir) -> gemeinsam::Laufendes {
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("kanbanD.md"), MIT_SIGNALEN).unwrap();
    git(tmp.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "Signale"]);
    gemeinsam::starten(tmp.path(), &["--port", "0"])
}

fn commits(tmp: &tempfile::TempDir) -> u32 {
    git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

#[tokio::test]
async fn zustand_nennt_die_eingerichteten_signale() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let z: serde_json::Value = reqwest::get(format!("{}api/zustand", lauf.adresse)).await.unwrap().json().await.unwrap();
    assert_eq!(
        z["einstellungen"]["signale"],
        json!([{"schluessel": "mail", "bezeichnung": "Neue E-Mail", "farbe": "blue"}, {"schluessel": "fragen", "bezeichnung": "Coding-Agent hat Fragen", "farbe": "violet"}])
    );
}

#[tokio::test]
async fn setzen_und_zuruecknehmen_je_ein_commit_doppelt_ohne_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let vorher = commits(&tmp);
    let (s, a) = senden(Method::PUT, &lauf.adresse, "api/aufgaben/2/signale/fragen", "cl", json!(null)).await;
    assert_eq!((s, a["signale"].clone()), (200, json!(["fragen"])));
    assert_eq!(lies(tmp.path(), "aufgaben/0002-zwei.md"), "---\nid: 2\ntitle: zwei\nsignals: [fragen]\n---\n");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#2 Signal „Coding-Agent hat Fragen“ gesetzt");
    senden(Method::PUT, &lauf.adresse, "api/aufgaben/2/signale/mail", "cl", json!(null)).await;
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").contains("signals: [fragen, mail]\n"));
    assert_eq!(commits(&tmp), vorher + 2);
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/aufgaben/2/signale/mail", "cl", json!(null)).await;
    assert_eq!((s, commits(&tmp)), (200, vorher + 2), "schon gesetzt: kein Commit");
    let (s, a) = senden(Method::DELETE, &lauf.adresse, "api/aufgaben/2/signale/fragen", "st", json!(null)).await;
    assert_eq!((s, a["signale"].clone()), (200, json!(["mail"])));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#2 Signal „Coding-Agent hat Fragen“ zurückgenommen");
    let (s, _) = senden(Method::DELETE, &lauf.adresse, "api/aufgaben/2/signale/fragen", "st", json!(null)).await;
    assert_eq!((s, commits(&tmp)), (200, vorher + 3), "nicht gesetzt: kein Commit");
    senden(Method::DELETE, &lauf.adresse, "api/aufgaben/2/signale/mail", "st", json!(null)).await;
    assert_eq!(lies(tmp.path(), "aufgaben/0002-zwei.md"), "---\nid: 2\ntitle: zwei\n---\n", "ohne Signal kein Schlüssel");
}

#[tokio::test]
async fn unbekanntes_signal_wird_abgelehnt_die_datei_bleibt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let vorher = lies(tmp.path(), "aufgaben/0002-zwei.md");
    let (s, f) = senden(Method::PUT, &lauf.adresse, "api/aufgaben/2/signale/xyz", "cl", json!(null)).await;
    assert_eq!(s, 400);
    assert!(f.to_string().contains("Signal „xyz“ steht nicht in kanbanD.md"), "{f}");
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/2", "cl", json!({"signale": ["mail", "xyz"]})).await;
    assert_eq!(s, 400);
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/aufgaben/2/signale/due", "cl", json!(null)).await;
    assert_eq!(s, 400, "due ist gerechnet, nicht setzbar");
    assert_eq!(lies(tmp.path(), "aufgaben/0002-zwei.md"), vorher);
}

#[tokio::test]
async fn patch_ersetzt_die_liste_unbekannte_aus_der_datei_bleiben_lesbar() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let (s, a) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"signale": ["mail", "fragen", "mail"]})).await;
    assert_eq!((s, a["signale"].clone()), (200, json!(["mail", "fragen"])));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 geändert: Signale");
    std::fs::write(tmp.path().join("aufgaben/0003-drei.md"), "---\nid: 3\ntitle: drei\nsignals: [alt]\n---\n").unwrap();
    let a: serde_json::Value = reqwest::get(format!("{}api/aufgaben/3", lauf.adresse)).await.unwrap().json().await.unwrap();
    assert_eq!(a["signale"], json!(["alt"]), "ein nicht mehr eingerichtetes Signal bleibt an der Aufgabe");
    let (s, a) = senden(Method::DELETE, &lauf.adresse, "api/aufgaben/3/signale/alt", "st", json!(null)).await;
    assert_eq!((s, a["signale"].clone()), (200, json!([])), "auch ein unbekanntes lässt sich zurücknehmen");
}

#[tokio::test]
async fn einstellungen_schreiben_signale_due_und_leere_bedeutung_abgelehnt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let mut e: serde_json::Value = reqwest::get(format!("{}api/zustand", lauf.adresse)).await.unwrap().json::<serde_json::Value>().await.unwrap()["einstellungen"].clone();
    e["signale"] = json!([{"schluessel": "mail", "bezeichnung": "Neue E-Mail", "farbe": "#1188cc"}]);
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e.clone()).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "kanbanD.md").contains("\nsignals:\n  mail: {label: Neue E-Mail, color: \"#1188cc\"}\n"), "{}", lies(tmp.path(), "kanbanD.md"));
    for (signal, grund) in [(json!({"schluessel": "due", "bezeichnung": "x", "farbe": "red"}), "due"), (json!({"schluessel": "neu", "bezeichnung": " ", "farbe": "red"}), "Bedeutung"), (json!({"schluessel": "Neu X", "bezeichnung": "x", "farbe": "red"}), "Schlüssel")] {
        let mut f = e.clone();
        f["signale"] = json!([signal]);
        let (s, antwort) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", f).await;
        assert_eq!(s, 400, "{grund}: {antwort}");
    }
}
