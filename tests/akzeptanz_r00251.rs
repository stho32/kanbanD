// R00251 (I0241, Karte #269) AK 3: `GET …/commits` trägt `autordatum` (Epoch-Sekunden) bei `auf_zweig` und `verwaist`,
// gleich vor und nach einem Rebase; bei den übrigen Zuständen fehlt das Feld (nie `null`). Ausgangslage R00204.
mod gemeinsam;

use gemeinsam::{Laufendes, R204, ausgangslage_r00204, git, senden, starten_mit};
use serde_json::{Value, json};
use std::path::Path;
use std::process::Command;

// ---- Treiber ---------------------------------------------------------------------------------------------------------

async fn liste(adresse: &str) -> Vec<Value> {
    let r = reqwest::get(format!("{adresse}api/aufgaben/1/commits")).await.unwrap();
    assert_eq!(r.status().as_u16(), 200);
    r.json::<Value>().await.unwrap()["commits"].as_array().unwrap().clone()
}

async fn hinterlegen(adresse: &str, verweise: &[String]) {
    let (status, rumpf) = senden(reqwest::Method::POST, adresse, "api/aufgaben/1/commits", "entw1", json!({ "commits": verweise })).await;
    assert_eq!(status, 200, "{rumpf}");
}

fn eintrag<'a>(liste: &'a [Value], verweis: &str) -> &'a Value {
    liste.iter().find(|e| e["verweis"] == verweis).unwrap_or_else(|| panic!("kein Eintrag {verweis}: {liste:?}"))
}

/// Git mit getrennt gesetztem Autor- und Commit-Datum (`None` = vom Commit übernehmen bzw. jetzt).
fn git_daten(r: &Path, autor: Option<&str>, commit: &str, args: &[&str]) -> String {
    let mut c = Command::new("git");
    c.arg("-C").arg(r).args(["-c", "user.name=Entwickler", "-c", "user.email=e@example.org"]).args(args).env("GIT_COMMITTER_DATE", commit).env_remove("GIT_AUTHOR_DATE");
    if let Some(a) = autor {
        c.env("GIT_AUTHOR_DATE", a);
    }
    let a = c.output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

async fn gestartet() -> (R204, Laufendes) {
    let a = ausgangslage_r00204();
    let lauf = starten_mit(&a.board, &["--port", "0"], &[]);
    hinterlegen(&lauf.adresse, &a.verweise()).await;
    a.v2_entfernen();
    (a, lauf)
}

// ---- AK 3 ------------------------------------------------------------------------------------------------------------

#[tokio::test]
async fn ak03_autordatum_je_zustand_und_nach_dem_rebase() {
    let (a, lauf) = gestartet().await;
    // C1 auf karte/1 mit Autordatum 2026-11-22T11:00:13+01:00, Commit-Datum anders
    std::fs::write(a.wt.join("c1.txt"), "C1\n").unwrap();
    git_daten(&a.wt, Some("2026-11-22T11:00:13+01:00"), "2026-11-22T11:00:14+01:00", &["add", "-A"]);
    git_daten(&a.wt, Some("2026-11-22T11:00:13+01:00"), "2026-11-22T11:00:14+01:00", &["commit", "-q", "-m", "[R00999] B0001: Zähler zuerst"]);
    let c1 = git(&a.wt, &["rev-parse", "HEAD"]);
    hinterlegen(&lauf.adresse, &[format!("kd:{c1}")]).await;
    let vorher = liste(&lauf.adresse).await;
    let e = eintrag(&vorher, &format!("kd:{c1}"));
    assert_eq!((&e["zustand"], &e["autordatum"]), (&json!("auf_zweig"), &json!(1795341613_i64)), "2026-11-22T11:00:13+01:00 als ganze Zahl");
    assert!(e["autordatum"].is_i64());
    let k3 = eintrag(&vorher, &format!("kd:{}", a.k3));
    assert_eq!(k3["autordatum"], json!(1772355600_i64), "auf_zweig: 2026-03-01T10:00:00+01:00");
    let v1 = eintrag(&vorher, &format!("kd:{}", a.v1));
    assert_eq!((&v1["zustand"], &v1["autordatum"]), (&json!("verwaist"), &json!(1772528400_i64)), "verwaist: 2026-03-03T09:00:00+00:00");
    let v2 = eintrag(&vorher, &format!("kd:{}", a.v2));
    assert_eq!(v2["zustand"], "fehlt");
    assert!(!v2.as_object().unwrap().contains_key("autordatum"), "bei `fehlt` fehlt das Feld (nicht null): {v2}");

    // Rebase der Merge-Wache: neuer Hash, neues Commit-Datum, gleiches Autordatum; die Karte trägt danach nur C1′
    git_daten(&a.wt, None, "2026-11-22T12:30:00+01:00", &["rebase", "-q", "main"]);
    let c1_neu = git(&a.wt, &["rev-parse", "HEAD"]);
    assert_ne!(c1_neu, c1);
    hinterlegen(&lauf.adresse, &[format!("kd:{c1_neu}")]).await;
    let nachher = liste(&lauf.adresse).await;
    let n = eintrag(&nachher, &format!("kd:{c1_neu}"));
    assert_eq!(n["autordatum"], json!(1795341613_i64), "gleich dem Wert vor dem Rebase: {n}");
    assert_ne!(n["datum"], e["datum"], "das Commit-Datum hat sich geändert, das Autordatum nicht");
    let mut ohne = n.as_object().unwrap().clone();
    let mut alt = e.as_object().unwrap().clone();
    for feld in ["verweis", "hash", "datum", "zweige", "autordatum"] {
        ohne.remove(feld);
        alt.remove(feld);
    }
    assert_eq!(ohne, alt, "alle übrigen Felder gleich");
}

// AK 3: auch `unlesbar`, `anwendung_unbekannt` und `repository_fehlt` tragen kein `autordatum`
#[tokio::test]
async fn ak03_kein_autordatum_ohne_commit() {
    let (a, lauf) = gestartet().await;
    let k3 = a.k3.clone();
    a.von_hand(&["kd:../x".into(), format!("xy:{k3}"), format!("kd:{k3}")]);
    let l = liste(&lauf.adresse).await;
    let zustaende: Vec<(&str, bool)> = l.iter().map(|e| (e["zustand"].as_str().unwrap(), e.as_object().unwrap().contains_key("autordatum"))).collect();
    assert!(zustaende.contains(&("unlesbar", false)) && zustaende.contains(&("anwendung_unbekannt", false)) && zustaende.contains(&("auf_zweig", true)), "{zustaende:?}");
    std::fs::rename(&a.r, a.basis.join("R-weg")).unwrap();
    let l = liste(&lauf.adresse).await;
    let e = eintrag(&l, &format!("kd:{k3}"));
    assert_eq!(e["zustand"], "repository_fehlt");
    assert!(!e.as_object().unwrap().contains_key("autordatum"), "{e}");
}
