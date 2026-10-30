// Run with: NODE_PATH=$(npm root -g) node tests/offline.test.js  (needs Playwright; builds nothing, run `node build-artifact.js` first)
// Checks the data file: loads real data over sample data, saves each change, asks before taking a newer file, never overwrites a file with older/blank data.
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(() => {
    window.__fake = (name, text) => { let content = text; return { name, kind: 'file', getFile: async () => ({ text: async () => content }), createWritable: async () => { let buf=''; return { write: async t => { buf = t; }, close: async () => { content = buf; } }; }, queryPermission: async () => 'granted', requestPermission: async () => 'granted', _get: () => content, _set: t => { content = t; } }; };
    window.showSaveFilePicker = async () => window.__h; window.showOpenFilePicker = async () => [window.__h];
  });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'offline', 'cross-index.html')); await p.waitForTimeout(700);
  console.log('supported', await p.evaluate(()=>CI.dataFile.supported()), 'sample', await p.evaluate(()=>!!CI.app.data().sampleLoaded));
  // real data file from an earlier session
  await p.evaluate(() => { const nd = CI.sampleData(); nd.sampleLoaded = false; nd.ui.savedAt = '2026-10-28T10:00:00.000Z'; nd.entities.push({ id:'E-9999', name:'Real Person', type:'individual', aliases:[], details:'', notes:'', profile:{} }); window.__h = __fake('cross-index-data.json', JSON.stringify(nd)); });
  // a) fresh app opens the existing data file: it is loaded, not overwritten
  await p.evaluate(() => CI.app.handlers['df-open']()); await p.waitForTimeout(600);
  assert.ok(await p.evaluate(()=>CI.app.data().entities.some(e=>e.id==='E-9999')), 'a) file loaded over sample data');
  console.log('a ok', await p.evaluate(()=>CI.dataFile.state));
  // b) a change reaches the file
  await p.evaluate(() => { CI.app.data().ui.marker = 'typed-offline'; CI.app.persist(); }); await p.waitForTimeout(900);
  assert.ok((await p.evaluate(()=>__h._get())).includes('typed-offline'), 'b) change saved to file'); console.log('b ok');
  // c) file newer than the browser copy: asks, then loads
  await p.evaluate(() => { const nd = JSON.parse(__h._get()); nd.ui.savedAt = '2999-01-01T00:00:00.000Z'; nd.ui.marker = 'from-other-computer'; __h._set(JSON.stringify(nd)); CI.dataFile.sync(); }); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(()=>CI.dataFile.state), 'paused'); assert.ok(await p.evaluate(()=>!!document.querySelector('#modal-root button')||document.body.innerText.includes('Load the data file')), 'c) asks');
  await p.evaluate(() => CI.app.handlers['df-takefile']()); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(()=>CI.app.data().ui.marker), 'from-other-computer'); console.log('c ok');
  // d) browser copy newer than file: file is updated, never the other way round
  await p.evaluate(() => { const nd = JSON.parse(__h._get()); nd.ui.savedAt = '2000-01-01T00:00:00.000Z'; nd.ui.marker='old'; __h._set(JSON.stringify(nd)); CI.dataFile.state='linked'; CI.dataFile.sync(); }); await p.waitForTimeout(600);
  assert.ok((await p.evaluate(()=>__h._get())).includes('from-other-computer'), 'd) file brought up to date'); console.log('d ok');
  // e) blank/sample app must never overwrite a data file that has real data
  await p.evaluate(() => { const nd = CI.emptyData(); CI.app.setData(nd); });
  await p.evaluate(() => CI.dataFile.sync()); await p.waitForTimeout(500);
  assert.ok(await p.evaluate(()=>CI.app.data().entities.some(e=>e.id==='E-9999')), 'e) blank app loads the file'); console.log('e ok');
  // f) permission lost: banner and card show Reconnect; writing is paused
  await p.evaluate(() => { CI.dataFile.state = 'permission'; CI.views.backupBanner(); });
  assert.ok((await p.evaluate(()=>document.getElementById('backup-banner').innerText)).includes('Reconnect')); console.log('f ok');
  console.log(errs.join('\n')||'no page errors');
  await b.close();
})().catch(e=>{ console.error('FAIL', e.message); process.exit(1); });
