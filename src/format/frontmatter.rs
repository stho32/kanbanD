use super::Formatfehler;

/// Trennt `---`-Frontmatter vom Körper. Ohne Frontmatter ist der YAML-Teil leer.
pub fn trennen(text: &str) -> Result<(&str, &str), Formatfehler> {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    if konfliktmarker(text) {
        return Err(Formatfehler("Merge-Konfliktmarker in der Datei".into()));
    }
    let Some(rest) = text.strip_prefix("---\n").or_else(|| text.strip_prefix("---\r\n")) else {
        return Ok(("", text));
    };
    let mut pos = 0;
    for zeile in rest.split_inclusive('\n') {
        if zeile.trim_end() == "---" {
            let yaml = &rest[..pos];
            let koerper = &rest[pos + zeile.len()..];
            return Ok((yaml, koerper.strip_prefix('\n').unwrap_or(koerper)));
        }
        pos += zeile.len();
    }
    Err(Formatfehler("Frontmatter ohne schließendes ---".into()))
}

/// Zeilen, die Git bei einem Merge-Konflikt hinterlässt.
pub fn konfliktmarker(text: &str) -> bool {
    text.lines().any(|z| z.starts_with("<<<<<<< ") || z == "=======" || z.starts_with(">>>>>>> "))
}

/// Ein Abschnitt des Frontmatters (ADR-0043 Regel 1): die Zeile `<schluessel>:` in Spalte 0 samt den folgenden Zeilen, die
/// mit Leerzeichen oder Tab beginnen. Eine Zeile in Spalte 0 (Kommentar, Leerzeile, nächster Schlüssel) beendet ihn.
struct Lage<'a> {
    bom: &'static str,
    ende: &'static str,
    zeilen: Vec<&'a str>,
    /// Index der schließenden `---`-Zeile, `None` ohne Frontmatter
    schluss: Option<usize>,
}

impl<'a> Lage<'a> {
    fn von(text: &'a str) -> Self {
        let (bom, ohne_bom) = text.strip_prefix('\u{feff}').map_or(("", text), |rest| ("\u{feff}", rest));
        let zeilen: Vec<&str> = ohne_bom.split_inclusive('\n').collect();
        let mit_kopf = zeilen.first().is_some_and(|z| z.trim_end() == "---");
        // mit Frontmatter das Zeilenende seiner ersten `---`-Zeile, nicht das der ganzen Datei: ein Körper in CRLF stellt
        // die Zeilen eines LF-Frontmatters nicht um (R00250 Nacharbeit, PO Z. 684)
        let crlf = if mit_kopf { zeilen[0].ends_with("\r\n") } else { text.contains("\r\n") };
        let ende = if crlf { "\r\n" } else { "\n" };
        let schluss = mit_kopf.then(|| zeilen.iter().skip(1).position(|z| z.trim_end() == "---").map(|i| i + 1)).flatten();
        Lage { bom, ende, zeilen, schluss }
    }

    /// Zeilenbereich `[von, bis)` des Abschnitts im Frontmatter.
    fn abschnitt(&self, schluessel: &str) -> Option<(usize, usize)> {
        let schluss = self.schluss?;
        let ist_schluessel = |z: &str| z.strip_prefix(schluessel).is_some_and(|rest| rest.trim_start().starts_with(':'));
        let von = (1..schluss).find(|&i| ist_schluessel(self.zeilen[i]))?;
        let folgezeile = |z: &str| z.starts_with(' ') || z.starts_with('\t');
        let bis = (von + 1..schluss).find(|&i| !folgezeile(self.zeilen[i])).unwrap_or(schluss);
        Some((von, bis))
    }

    /// Der Block mit dem Zeilenende der Datei, jede Zeile abgeschlossen.
    fn block(&self, block: &str) -> String {
        block.split('\n').map(|z| format!("{z}{}", self.ende)).collect()
    }
}

/// Ersetzt im Frontmatter den Abschnitt `schluessel` durch `block` (Zeilen mit `\n` getrennt, ohne Zeilenende am Schluss)
/// und lässt alles andere zeichengleich (ADR-0043 Regel 1): an Ort und Stelle; fehlt er, vor dem schließenden `---`; bei
/// `None` wird er entfernt. Ohne Frontmatter entsteht einer. BOM folgt der Datei, das Zeilenende der ersten `---`-Zeile. Ob sich der Text danach
/// richtig liest, prüft der Aufrufer (Regel 5).
pub fn abschnitt_im_text(text: &str, schluessel: &str, block: Option<&str>) -> String {
    let lage = Lage::von(text);
    let neu = block.map(|b| lage.block(b)).unwrap_or_default();
    let Some(schluss) = lage.schluss else {
        if neu.is_empty() {
            return text.to_string();
        }
        let ohne_bom = &text[lage.bom.len()..];
        return format!("{}---{e}{neu}---{e}{e}{ohne_bom}", lage.bom, e = lage.ende);
    };
    let (von, bis) = lage.abschnitt(schluessel).unwrap_or((schluss, schluss));
    let mut s = String::from(lage.bom);
    s.extend(lage.zeilen[..von].iter().copied());
    s.push_str(&neu);
    s.extend(lage.zeilen[bis..].iter().copied());
    s
}

/// Der Text des Abschnitts `schluessel` im Frontmatter ohne Zeilenenden, Zeilen mit `\n` getrennt; `None`, wenn er fehlt.
pub fn abschnitt_lesen(text: &str, schluessel: &str) -> Option<String> {
    let lage = Lage::von(text);
    let (von, bis) = lage.abschnitt(schluessel)?;
    let zeilen: Vec<&str> = lage.zeilen[von..bis].iter().map(|z| z.strip_suffix('\n').map_or(*z, |z| z.strip_suffix('\r').unwrap_or(z))).collect();
    Some(zeilen.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// R00250 B1316 (ADR-0043 Regel 1): ein Abschnitt ist die Zeile `<schluessel>:` in Spalte 0 samt eingerückter
    /// Folgezeilen; er wird an Ort und Stelle ersetzt, bei Fehlen vor dem schließenden `---` eingefügt, bei `None` entfernt.
    #[test]
    fn abschnitt_ersetzen_einfuegen_entfernen() {
        let h = "---\n# von Hand\nx: 1\npeople:\n  a: {name: A}\n  b: {name: B}\n# Klassen folgen\nclasses: {}\n---\n\nText\n";
        assert_eq!(abschnitt_im_text(h, "people", Some("people:\n  a: {name: A2}\n  b: {name: B}")), "---\n# von Hand\nx: 1\npeople:\n  a: {name: A2}\n  b: {name: B}\n# Klassen folgen\nclasses: {}\n---\n\nText\n");
        assert_eq!(abschnitt_im_text(h, "signals", Some("signals:\n  w: {}")), "---\n# von Hand\nx: 1\npeople:\n  a: {name: A}\n  b: {name: B}\n# Klassen folgen\nclasses: {}\nsignals:\n  w: {}\n---\n\nText\n", "fehlt → vor das schließende ---");
        assert_eq!(abschnitt_im_text(h, "people", None), "---\n# von Hand\nx: 1\n# Klassen folgen\nclasses: {}\n---\n\nText\n", "None entfernt samt Folgezeilen");
        assert_eq!(abschnitt_im_text(h, "classes", Some("classes: {}")), h, "gleicher Block → zeichengleich");
        assert_eq!(abschnitt_im_text(h, "signals", None), h, "fehlt und None → zeichengleich");
    }

    #[test]
    fn abschnitt_aehnliche_schluessel_leerzeile_und_koerper() {
        let t = "---\npeople-alt: 1\npeople:\n  a: 1\n\n  b: 2\nzzz: 1\n---\npeople: im Text\n";
        assert_eq!(abschnitt_im_text(t, "people", Some("people: {}")), "---\npeople-alt: 1\npeople: {}\n\n  b: 2\nzzz: 1\n---\npeople: im Text\n", "eine Leerzeile in Spalte 0 beendet den Abschnitt");
        assert_eq!(abschnitt_lesen(t, "people").as_deref(), Some("people:\n  a: 1"));
        assert_eq!(abschnitt_lesen(t, "zzz").as_deref(), Some("zzz: 1"));
        assert_eq!(abschnitt_lesen(t, "signals"), None);
        assert_eq!(abschnitt_lesen("---\n\"people\": {}\n---\n", "people"), None, "zitierter Schlüssel ist kein Abschnitt");
        assert_eq!(abschnitt_lesen("# nur Text\npeople: x\n", "people"), None, "ohne Frontmatter kein Abschnitt");
        assert_eq!(abschnitt_lesen("---\npeople:\n\t# Tab\n---\n", "people").as_deref(), Some("people:\n\t# Tab"), "Tab rückt ein");
    }

    #[test]
    fn abschnitt_folgt_bom_und_zeilenende_der_datei() {
        let crlf = "\u{feff}---\r\npeople:\r\n  a: 1\r\nsources: {}\r\n---\r\nText\r\n";
        assert_eq!(abschnitt_im_text(crlf, "people", Some("people:\n  a: 2\n  b: 3")), "\u{feff}---\r\npeople:\r\n  a: 2\r\n  b: 3\r\nsources: {}\r\n---\r\nText\r\n");
        assert_eq!(abschnitt_im_text(crlf, "signals", Some("signals:\n  w: 1")), "\u{feff}---\r\npeople:\r\n  a: 1\r\nsources: {}\r\nsignals:\r\n  w: 1\r\n---\r\nText\r\n");
        assert_eq!(abschnitt_lesen(crlf, "people").as_deref(), Some("people:\n  a: 1"), "ohne Zeilenende gelesen");
        assert_eq!(abschnitt_im_text("# zweit\n", "a", Some("a: 1")), "---\na: 1\n---\n\n# zweit\n", "ohne Frontmatter entsteht einer");
        assert_eq!(abschnitt_im_text("# zweit\n", "a", None), "# zweit\n");
    }

    /// R00250 Nacharbeit (PO Z. 684): das Zeilenende kommt aus der ersten `---`-Zeile, nicht aus der ganzen Datei.
    #[test]
    fn abschnitt_zeilenende_aus_dem_frontmatter() {
        let gemischt = "---\npeople:\n  a: 1\n---\r\nText\r\n";
        assert_eq!(abschnitt_im_text(gemischt, "people", Some("people:\n  a: 2\n  b: 3")), "---\npeople:\n  a: 2\n  b: 3\n---\r\nText\r\n");
        let umgekehrt = "---\r\npeople:\r\n  a: 1\r\n---\r\nText\n";
        assert_eq!(abschnitt_im_text(umgekehrt, "signals", Some("signals:\n  w: 1")), "---\r\npeople:\r\n  a: 1\r\nsignals:\r\n  w: 1\r\n---\r\nText\n");
        assert_eq!(abschnitt_im_text("\u{feff}---\n---\r\nT\r\n", "a", Some("a: 1")), "\u{feff}---\na: 1\n---\r\nT\r\n", "BOM vor dem Kopf");
    }

    #[test]
    fn trennt_frontmatter_und_koerper() {
        assert_eq!(trennen("---\na: 1\n---\n\n# T\n").unwrap(), ("a: 1\n", "# T\n"));
        assert_eq!(trennen("---\r\na: 1\r\n---\r\nx").unwrap(), ("a: 1\r\n", "x"));
    }

    #[test]
    fn ohne_frontmatter_ist_alles_koerper() {
        assert_eq!(trennen("# T\n").unwrap(), ("", "# T\n"));
        assert_eq!(trennen("\u{feff}# T").unwrap(), ("", "# T"));
    }

    #[test]
    fn offenes_frontmatter_und_konfliktmarker_sind_fehler() {
        assert!(trennen("---\na: 1\n").is_err());
        let fehler = trennen("---\n<<<<<<< HEAD\na: 1\n=======\na: 2\n>>>>>>> x\n---\n").unwrap_err();
        assert!(fehler.0.contains("Konflikt"));
    }
}
