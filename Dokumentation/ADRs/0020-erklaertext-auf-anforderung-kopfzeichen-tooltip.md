# ADR-0020: Erklärtext auf Anforderung — eine nicht-modale Kopfzeichen-Komponente an Fokus und langem Druck, ohne eigene Ebene

**Status**: Akzeptiert
**Datum**: 2026-11-11
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #24)
**Kontext-Anforderung**: Karte #24 „Kopfzeichen-Tooltip bei Fokus und langem Druck“; Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: — (getragen von der Systemantwort: der Renderer zeichnet alles neu, [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md); die Fokusführung über Ebenen, [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md); der zugängliche Name am Auslöser, [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md); `popPlatzieren` als vorhandene Positionierungslogik, `web/app.js:978`)

## Kontext

- **Karte #24** verlangt, dass die **Kopfzeichen des Spaltenkopfs** ihren Erklärtext auf Anforderung zeigen — bei Tastaturfokus und bei langem Druck auf Touch —, nicht erst beim Überfahren mit der Maus.
- **Vision** `Anforderungen/R00000-vision.md:104`: Die Oberfläche ist per Tastatur bedienbar und folgt gewohnten Konventionen. Ein Erklärtext, den nur ein Zeiger erreicht, erfüllt das nicht.
- **PO-Entscheidung** `AI-Team/po-entscheidungen.md:53`: In `R00097` steht **nur der zugängliche Name am Zeichen** (`aria-label` = Tooltiptext, `role="img"`) und ein **sichtbarer Hinweissatz im Spalten-Dialog**; das **Tooltip bei Fokus und langem Druck für alle Kopfzeichen** (ⓘ, ✓, Phase, Grenze, Eigentümer) ist eine **eigene Karte**. Dieselbe Linie hält `R00106` Z. 407 fest („ein Tooltip bei Fokus (PO Z. 53, eigene Karte)“, bewusst außerhalb). `R00097`/Featur `F0015` schließen den Tooltip damit ausdrücklich aus; das AK „mit Tooltip“ erfüllt dem PO der `title`.
- **Belegt (Code), die heutige Erklärung der Kopfzeichen hängt allein an `title`** (`web/ansicht.js`):
  - `vLane` (`web/ansicht.js:734–747`) zeichnet den Spaltenkopf. Der Kommentar ⓘ ist ein **Tab-Stopp** mit `title` und `aria-label` (`tabindex="0"`), **✓** (Abschlussspalte), **Phase** (`span.v.ph`) und **Grenze** (`span.v`) sind **nicht fokussierbar** und tragen **keinen zugänglichen Namen** — nur `title`.
  - `vEigentuemerZeichen` (`web/ansicht.js:720–726`) zeichnet das Eigentümer-Zeichen mit `role="img"` und `aria-label`/`title`; im zugeklappten Streifen ist es nur Schmuck (`aria-hidden`).
  - `title` ist ein reiner Zeiger-Mechanismus: Er erscheint nicht bei Tastaturfokus und lässt sich auf Touch nicht auslösen. Er erfüllt „bei Fokus sichtbar“ nicht.
- **Belegt (Code), zwei vorhandene, aber unpassende Mechanismen**:
  - `#pop` (Positionierung `popPlatzieren`, `web/app.js:978`) ist **klick-getrieben**, **fokusführend** und als **Menü oder nicht-modaler Dialog** eingeordnet ([ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) N4). Ein Tooltip ist keines von beidem: Er nimmt keinen Fokus und fängt keinen.
  - `#tooltip` (`web/ansicht.js:950`, gelesen in `web/app.js:2307`) ist der **Fieber-Daten-Tooltip der Diagramme**, kein allgemeiner Erklärtext-Mechanismus; er hängt an der Zeigerposition über der Zeichenfläche.
- **Kein Hausmuster.** Es gibt bisher keine Komponente, die auf eine Anforderung des Menschen (Fokus, langer Druck) einen nicht-modalen Erklärtext zu einem Auslöser zeigt.
- **Zwang (Referenz-Designsystem, Factory-Gedächtnis `rollen/ux-reviewer/spezialisierungen/material3/notizen.md:175`)**: M3 **Plain tooltip** — kurze Beschriftung, Höhe 24 dp, einzeilig, für Elemente ohne Text (Icon Buttons). Das ist die Rolle; der zentrale Stil des Projekts und die Vision gehen vor (Factory `gemeinsam/regeln.md`, „Gestaltung“).

Die Klasse der Aufgabe ist damit nicht „ⓘ braucht einen Tooltip“, sondern „die Kopfzeichen haben **einen** Ort, an dem ihr Erklärtext auf Anforderung sichtbar wird — für Tastatur und Touch gleich, ohne die Ebenen der Fokusführung zu verwischen“.

## Optionen

### Option A: native `title` + `aria-label` (Status quo)

Der `title` bleibt der Erklärtext, `aria-label` der zugängliche Name.

- Stärke: kleinste denkbare Änderung, kein neuer Code, kein Zustand; heute steht es fast überall schon so.
- Nachteil: `title` erscheint **nicht bei Tastaturfokus** und **nicht bei langem Druck**. Die Aufgabe der Karte — „sichtbar bei Fokus“ — ist damit nicht erfüllt. Ein neuer Mechanismus daneben wäre ein zweiter Erklärweg, den diese Option gerade vermeiden will.

### Option B: eigenes nicht-modales Primitiv (gewählt)

Eine Komponente `role="tooltip"`, die den Erklärtext zu einem Auslöser zeigt:

- **kein Fokus**: Das Primitiv nimmt keinen Fokus und fängt keinen; der Fokus bleibt auf dem Auslöser.
- **`aria-describedby` am Auslöser** verbindet den sichtbaren Text mit dem Auslöser, sodass Hilfstechnik ihn als Beschreibung liest.
- **Auslöser**: Fokus auf dem Auslöser (Tastatur) und **langer Druck** (Touch). Überfahren mit der Maus ist möglich, aber nicht die Bedingung.
- **Esc in der Kaskade** schließt ihn **zuerst** (höchste Priorität, vor Pop und Fenstern; die Kaskade `web/app.js:1950`).
- **Positionierung** über die vorhandene `popPlatzieren`-Logik (`web/app.js:978`), die schon Unter-dem-Auslöser/Über-dem-Auslöser und die Fensterkante kennt.
- **Zustand in `S.ui`** (`web/app.js:2`), **redraw-sicher**: Der Text übersteht das `innerHTML`-Neuzeichnen wie die übrigen Zustände in `S.ui` ([ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md)).
- Stärke: eine Komponente an einem Ort; sie trifft die Aufgabe (Fokus und langer Druck) für **alle** Kopfzeichen gleich, ohne die Ebenen-Invarianten von [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) anzutasten.
- Nachteil: ein kleines neues Primitiv samt Zustand und eigener Code für den langen Druck; ein zweiter Ort, den eine Probe abdecken muss.

### Option C: `#pop` erweitern

Der Spaltenkopf bekommt einen Tooltip-„Modus“ im vorhandenen `#pop`.

- Stärke: kein neues Markup — die Positionierung und der gezeichnete Ort sind schon da.
- Nachteil: `#pop` ist **fokusführend** und als **Menü oder Dialog** eingeordnet ([ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) N4). Ein Tooltip, der Fokus setzt oder in der Fokusführung als Ebene zählt, verwischt genau die Ebenen-Invarianten dieser ADRs. Der `#pop` ist für eine Anforderung des Menschen gebaut, der Tooltip ist keine.

### Option D: native Popover-API

Das Popover-Attribut des Browsers öffnet den Erklärtext.

- Stärke: Top-Layer, Esc und Positionierung vom Browser — wenig eigener Code.
- Nachteil: **dasselbe Redraw-Problem wie `<dialog>.showModal()`**, das [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) (Option C) verworfen hat: Nach jedem `render()` müsste das Öffnen erneut laufen, und der Zustand gehört dann in einen zweiten Ort neben dem Neuzeichnen. Ein **langer Druck** ist über das Attribut allein nicht auslösbar. Für den Nutzen bleibt nur ein Teil.

### Option E: CSS-only (`:focus-visible` / `:active`)

Der Erklärtext ist im Markup und wird per CSS an `:focus-visible` bzw. `:active` eingeblendet.

- Stärke: kein JavaScript, kein Zustand, deklarativ.
- Nachteil: **langer Druck ist per CSS unzuverlässig** (`:active` endet beim Loslassen, nicht nach einer Dauer), **Esc gibt es nicht**, und die **Positionierung ist auf den Fluss des Elternelements beschränkt** (kein Umklappen an der Fensterkante wie `popPlatzieren`). Der Erklärtext wäre nicht zuverlässig lesbar, und das Ausblenden wäre nicht sicher.

## Entscheidung

**Gewählt: Option B** — ein eigenes, nicht-modales Primitiv `role="tooltip"`, gezeichnet aus dem Renderer, ohne eigene Ebene.

Begründung: B trifft die Aufgabe der Karte („Erklärtext auf Anforderung bei Fokus und langem Druck“) für alle Kopfzeichen gleich und hält sich an die vorhandenen Invarianten:

1. **Der Tooltip ist keine Ebene der Fokusführung** ([ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) bleibt unberührt). Er nimmt keinen Fokus, fängt keinen und zählt nicht in `ebenen(ui)`. Der Fokus bleibt auf dem Auslöser.
2. **Gezeichnet wird aus dem Renderer** ([ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md)): Der Zustand liegt in `S.ui` und übersteht das Neuzeichnen; es gibt keinen zweiten Schreibweg neben `render()`.
3. **Der zugängliche Name bleibt am Auslöser** ([ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md)). Der Tooltip selbst ist mit `aria-describedby` am Auslöser verbunden; er ersetzt den Namen nicht und wird nicht zu einer zweiten Namensquelle.
4. **Esc schließt ihn zuerst** — an der Spitze der Kaskade (`web/app.js:1950`), vor Pop und Fenstern.
5. **Maße, Kontrast und Anzeige** folgen [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md) (Zielgröße des Auslösers), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md) (Kontrast des Textes in beiden Themen) und [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md) (deutscher Wortlaut, zugänglicher Name zählt als sichtbarer Text).

**Akzeptierte Schwäche.** Es entsteht ein **kleines neues Primitiv samt Zustand in `S.ui`** und eigener Code für den **langen Druck**. Die Komponente muss durch eine Probe abgesichert werden wie die übrigen zentralen Regeln. Ggf. muss das **Eigentümer-Zeichen in die Tab-Folge** aufgenommen werden: Es trägt heute keinen Tab-Halt (`role="img"`, `web/ansicht.js:720–726`), damit es den Tooltip bei Fokus überhaupt zeigen kann — das ist das Ziel von [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md) (jedes Bedienziel erreichbar) und ein Detail von [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md).

C, D und E scheiden aus: C verwischt die Ebenen-Einordnung von `#pop`, D trägt das Redraw-Problem, das [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) verworfen hat, und kann den langen Druck nicht, E ist unzuverlässig und ohne Esc.

## Konsequenzen

**Positiv:**

- Ein **Ort** für den Erklärtext der Kopfzeichen; Fokus und langer Druck verhalten sich bei allen Zeichen gleich.
- Die Fokusführung, die Ebenen-Logik und die zugänglichen Namen der bestehenden ADRs bleiben unverändert.
- Ein künftiges Kopfzeichen erbt den in `S.ui` gehaltenen Mechanismus, statt einen eigenen zu brauchen.

**Negativ / In Kauf zu nehmen:**

- Ein kleines neues Primitiv samt Zustand und eigener Code für den langen Druck.
- Ggf. wächst die Tab-Folge um das Eigentümer-Zeichen (`web/ansicht.js:720–726`).

**Durchsetzung** (E2E-Probe, Abnahme der Karte #24):

- **Tab auf ⓘ und auf das Eigentümer-Zeichen** zeigt die Erklärung sichtbar; **langer Druck auf Touch** ebenso.
- **Esc** schließt den Tooltip; er bleibt nicht stehen.
- Der **zugängliche Name ist wörtlich der Tooltiptext** (keine abweichende zweite Formulierung).
- Ein **Live-Ereignis** (fremder Schreibaufruf, [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md)) hinterlässt **keinen verwaisten Tooltip**.
- **Kontrast** des Erklärtextes hell und dunkel ≥ 4,5:1 ([ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md)).
- **Review-Punkt** für architektur-reviewer und code-reviewer: **ein Tooltip, der Fokus nimmt oder fängt**, und **ein zweiter Erklärmechanismus neben dem Primitiv** sind je ein Befund.

**Geltung:** Die Regel gilt für die **Kopfzeichen im Spaltenkopf**. Ob sie auf **weitere `title`-Stellen** im Projekt ausgeweitet wird, entscheidet eine **spätere Karte**.

**Folgeentscheidungen / Aufgaben:**

- [ ] Anforderung aus Karte #24 nach dieser ADR (Vorschlag im Bericht an den Director).
- [ ] Ob das Eigentümer-Zeichen in die Tab-Folge aufgenommen wird (Detail aus [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md)/[ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md)).
- [ ] Ausweitung auf weitere `title`-Stellen: eigene Karte.

## Quellen / Bezüge

- Karte #24 „Kopfzeichen-Tooltip bei Fokus und langem Druck“; Vision `Anforderungen/R00000-vision.md:104`
- `AI-Team/po-entscheidungen.md:53` (zugänglicher Name = Tooltiptext, Hinweissatz im Spalten-Dialog, Tooltip als eigene Karte)
- `R00097`/`F0015` (schließt den Tooltip ausdrücklich aus), `R00106` Z. 407 (bewusst außerhalb)
- `web/ansicht.js:734–747` (`vLane`), `:720–726` (`vEigentuemerZeichen`), `:950` (`#tooltip` der Diagramme); `web/app.js:978` (`popPlatzieren`), `:1950` (Esc-Kaskade), `:2` (`S.ui`), `:2307` (Fieber-Daten-Tooltip)
- Factory-Gedächtnis Material 3 (`rollen/ux-reviewer/spezialisierungen/material3/notizen.md:175`, Plain tooltip)
- [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) (N4), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md), [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md)
- Baustein [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
