// R00231 Selbstprobe der Hilfe `masse` (ADR-0026 N3 Regel 8, AK 1): eine künstliche Seite ohne kanbanD.
const { test, expect } = require('@playwright/test');
const { masse } = require('./hilfen');

test.describe('Selbstprobe der Hilfe masse', () => {
  test('ein vorhandener Knoten liefert Lage und Größe', async ({ page }) => {
    await page.setContent('<div id="m" style="width:50px;height:30px"></div>');
    const m = await masse(page, '#m');
    expect(m.width).toBe(50);
    expect(m.height).toBe(30);
    expect(m).toHaveProperty('x');
    expect(m).toHaveProperty('y');
  });

  test('ein anderer Knoten liefert seine eigenen Maße', async ({ page }) => {
    await page.setContent('<div id="a" style="width:50px;height:30px"></div><div id="b" style="width:70px;height:12px"></div>');
    const m = await masse(page, '#b');
    expect([m.width, m.height]).toEqual([70, 12]);
  });

  test('ein fehlender Selektor liefert null, nie 0', async ({ page }) => {
    await page.setContent('<div id="m" style="width:50px;height:30px"></div>');
    expect(await masse(page, '#fehlt')).toBeNull();
  });

  test('liefert auch scrollWidth, clientWidth und clientHeight (Kopfprobe)', async ({ page }) => {
    await page.setContent('<div id="k" style="width:100px;height:20px;overflow:auto"><div style="width:300px;height:5px"></div></div>');
    const m = await masse(page, '#k');
    expect(m.scrollWidth).toBe(300);
    expect(m.clientWidth).toBe(100);
    expect(m.clientHeight).toBe(20);
  });

  test('ruft genau ein page.evaluate auf und löst den Knoten nicht über Locator oder Handle auf', async () => {
    const quelle = masse.toString();
    expect(quelle.match(/\.evaluate\(/g)).toHaveLength(1);
    expect(quelle).not.toMatch(/locator|elementHandle|boundingBox/);
  });
});
