async page => {
  const results = [];
  async function audit(label, url, width, height) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await page.waitForTimeout(1200);
    const data = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('button,a,input,select,textarea')].map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { tag: el.tagName, text: (el.textContent || el.placeholder || '').trim().slice(0, 40), width: Math.round(rect.width), height: Math.round(rect.height), font: style.fontSize, display: style.display };
      }).filter((x) => x.width > 0 && x.height > 0);
      const small = controls.filter((x) => ['BUTTON','A'].includes(x.tag) && x.height < 44);
      return { title: document.title, url: location.href, width: innerWidth, height: innerHeight, controls: controls.length, small };
    });
    results.push({ label, ...data });
    await page.screenshot({ path: `output/playwright/phase2-${label}.png`, fullPage: true });
  }
  await audit('web-desktop', 'http://127.0.0.1:18888/', 1440, 900);
  await audit('web-phone390', 'http://127.0.0.1:18888/', 390, 844);
  await audit('h5-phone390', 'http://127.0.0.1:18890/', 390, 844);
  return results;
}
