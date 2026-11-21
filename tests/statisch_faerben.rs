//! R00217 AK 8 (B1106): Prism, sein Lizenztext und der Färbe-Worker sind eingebettet und kommen mit ihrem MIME-Typ.

mod gemeinsam;

use gemeinsam::{mit_drei_aufgaben, senden_roh};
use reqwest::Method;

async fn holen(adresse: &str, pfad: &str) -> (u16, String, String) {
    let a = senden_roh(Method::GET, adresse, pfad, "st", None, "").await;
    (a.status, a.art, a.text)
}

#[tokio::test]
async fn prism_lizenz_und_faerbe_worker_sind_eingebettet() {
    let tmp = tempfile::tempdir().unwrap();
    mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (status, art, text) = holen(&lauf.adresse, "web/vendor/prism.js").await;
    assert_eq!((status, art.as_str()), (200, "text/javascript; charset=utf-8"));
    let kopf = &text[..text.find("*/").expect("Kopfkommentar")];
    assert!(kopf.contains("prismjs 1.30.0"), "Version im Kopf: {kopf}");
    assert!(kopf.contains("prism-core, clike, markup, css, javascript, rust, markup-templating, php, python, bash, yaml, markdown, json, sql, csharp, toml, diff"), "Liste im Kopf: {kopf}");
    assert!(kopf.contains("MIT"), "MIT-Hinweis im Kopf: {kopf}");
    assert!(text.contains("e.languages.rust="), "Grammatik Rust enthalten");

    let (status, art, text) = holen(&lauf.adresse, "web/vendor/LICENSE-prism.txt").await;
    assert_eq!((status, art.as_str()), (200, "text/plain; charset=utf-8"));
    assert!(text.starts_with("MIT LICENSE") && text.contains("Lea Verou"), "Lizenztext von Prism");

    let (status, art, text) = holen(&lauf.adresse, "web/faerben.js").await;
    assert_eq!((status, art.as_str()), (200, "text/javascript; charset=utf-8"));
    let schalter = text.find("disableWorkerMessageHandler: true").expect("Schalter gesetzt");
    let laden = text.find("importScripts('/web/vendor/prism.js')").expect("Prism im Worker geladen");
    assert!(schalter < laden, "der Schalter steht vor importScripts");

    let seite = holen(&lauf.adresse, "").await.2;
    assert!(!seite.contains("prism"), "index.html lädt Prism nicht");
}
