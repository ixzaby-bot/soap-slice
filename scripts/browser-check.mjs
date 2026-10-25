// Optional integration check: PLAYWRIGHT_MODULE can point to an existing playwright install.
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__vibrations = [];
    navigator.vibrate = pattern => { window.__vibrations.push(pattern); return true; };
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(options) { super(options); window.__audio = this; }
      createDynamicsCompressor() {
        const node = super.createDynamicsCompressor();
        window.__analyser = this.createAnalyser(); node.connect(window.__analyser);
        return node;
      }
    };
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'mobile-preview.png' });
  const stroke = async () => { await page.mouse.move(190,270); await page.mouse.down(); await page.mouse.move(190,590,{steps:22}); await page.mouse.up(); await page.waitForTimeout(180); };
  await page.mouse.move(190,350); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
  assert.equal(await page.locator('#percent').innerText(), '0%');
  await stroke();
  assert.ok(parseInt(await page.locator('#percent').innerText()) > 0);
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
  const peak = () => page.evaluate(() => { const values = new Float32Array(window.__analyser.fftSize); window.__analyser.getFloatTimeDomainData(values); return Math.max(...values.map(Math.abs)); });
  assert.equal(await page.evaluate(()=>window.__audio.state), 'running');
  await page.mouse.move(190,270); await page.mouse.down();
  let output = 0;
  for (let y=280;y<=500;y+=20) { await page.mouse.move(190,y); await page.waitForTimeout(30); output = Math.max(output, await peak()); }
  assert.ok(output > .005, `Expected audible output, got ${output}`);
  await page.screenshot({ path: 'cutting-preview.png' });
  await page.mouse.up(); await page.waitForTimeout(700); assert.ok(await peak() < .001);
  await page.locator('#sound').click(); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
  await stroke(); await page.waitForTimeout(200); assert.ok(await peak() < .001);
  await page.locator('#sound').click();
  await page.evaluate(()=>window.__audio.suspend()); await stroke();
  assert.equal(await page.evaluate(()=>window.__audio.state),'running');
  await page.locator('#reset').click();
  console.log('PASS: audio output, silence after cutting, mute, and resume after suspension');
  for(let i=0;i<10;i++) await stroke();
  await page.locator('#complete').waitFor({state:'visible'});
  assert.equal(await page.locator('#percent').innerText(), '100%');
  await page.screenshot({ path: 'complete-preview.png' });
  await page.locator('#next').click(); assert.equal(await page.locator('#level').innerText(), 'LEVEL 02');
  await page.locator('#free').click();
  for(let i=0;i<10;i++) await stroke();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('#level').innerText(),'LEVEL 03');
  assert.equal(await page.locator('#complete').isVisible(),false);
  await page.locator('#reset').click(); assert.equal(await page.locator('#percent').innerText(),'0%');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:270}]});
  for(let y=280;y<=570;y+=10) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(250);
  assert.ok(parseInt(await page.locator('#percent').innerText())>0);
  assert.ok(await page.evaluate(()=>window.__vibrations.includes(8)));
  await page.mouse.move(190,270); await page.mouse.down(); await page.mouse.move(190,370,{steps:6});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur'))); await page.mouse.up();
  const cancelled = await page.locator('#percent').innerText(); await page.waitForTimeout(400);
  assert.equal(await page.locator('#percent').innerText(),cancelled); assert.ok(await peak()<.001);
  const start = Date.now(); let strokes = 0;
  while(Date.now()-start<(process.env.QUICK ? 0 : 30000)) { await stroke(); strokes++; }
  console.log(process.env.QUICK ? 'PASS: touch input (endurance check skipped)' : `PASS: touch input and 30-second continuous cutting (${strokes} strokes), page remains responsive`);
  if (process.env.GAME_URL) {
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.context().setOffline(true); await page.reload();
    await page.waitForFunction(()=>document.querySelector('#canvas')?.width > 300).catch(async error=>{console.log('Offline diagnostics',errors,await page.evaluate(async()=>({width:document.querySelector('canvas')?.width,cache:await caches.keys(),controller:!!navigator.serviceWorker.controller,html:document.body.innerText})));throw error;}); await stroke();
    assert.ok(parseInt(await page.locator('#percent').innerText())>0);
    await page.context().setOffline(false);
    console.log('PASS: offline reload and cutting');
  }
  await page.setViewportSize({width:1280,height:800}); await page.waitForTimeout(500); await page.screenshot({path:'desktop-preview.png'});
  assert.deepEqual(errors, []);
  console.log('PASS: rendering, idle, cutting, sound toggle, completion, next level, free mode, reset, responsive resize; no page errors');
} finally { await browser.close(); }
