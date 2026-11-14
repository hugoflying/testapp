// v3.57.6 : la case de saisie manuelle d'une heure (appui long) reste sur son champ quand la page défile
// Usage : node test/ed116.js (serveur statique du repo sur http://localhost:8803)
const { chromium } = require('playwright');
(async () => {
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{ width:360, height:640 } });
await ctx.route('https://timing-demo.pages.dev/**', r => r.fulfill({ status:200, contentType:'application/json', body:'{"at":0,"cfg":null}' }));
await ctx.addInitScript(() => { sessionStorage.setItem('pv_auth', '1'); localStorage.setItem('whatsNewSeen', 'maj-2026-10-30'); });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8803/'); await p.waitForTimeout(4500);
await p.evaluate(async () => { switchTab(JSON.parse(localStorage.flightTabs)[0]); uiTab('timing'); await new Promise(r => setTimeout(r, 600)); });
const id = await p.evaluate(() => { const w = [...document.querySelectorAll('.time-wrap[data-id]')].filter(x => x.offsetParent && x.getBoundingClientRect().top > 250 && x.getBoundingClientRect().top < 560)[0]; return w && w.dataset.id; });
await p.evaluate(i => document.querySelector(`.time-wrap[data-id="${i}"] .tw-zone-center`).dispatchEvent(new MouseEvent('mousedown', { bubbles:true, button:0 })), id); await p.waitForTimeout(900);
const diff = () => p.evaluate(i => { const e = document.querySelector('.tw-editor'), w = document.querySelector(`.time-wrap[data-id="${i}"]`); if (!e) return null; const a = e.getBoundingClientRect(), c = w.getBoundingClientRect(); return { dy:Math.round(a.top - c.top), dx:Math.round(a.left - c.left), y:Math.round(window.scrollY) }; }, id);
const d0 = await diff();
await p.evaluate(() => window.scrollBy(0, 180)); await p.waitForTimeout(200);
const d1 = await diff();
await p.keyboard.type('0703'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
const val = await p.evaluate(i => document.getElementById(i).value, id);
const gone = await p.evaluate(() => !document.querySelector('.tw-editor'));
const ok = d0 && d1 && !d0.dy && !d0.dx && !d1.dy && !d1.dx && d1.y - d0.y > 100 && val === '07:03' && gone && !errs.length;
console.log(JSON.stringify({ id, d0, d1, val, gone }), errs.join(' | ') || 'no errors'); console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1); })();
