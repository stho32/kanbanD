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

#[cfg(test)]
mod tests {
    use super::*;

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
