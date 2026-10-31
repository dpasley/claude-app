// Run with: NODE_PATH=$(npm root -g) node tests/social.test.js   (needs Playwright; builds first with node build-artifact.js)
const { chromium } = require('playwright'); const assert = require('assert'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'cross-index-artifact.html')); await p.waitForTimeout(700);
  const rid = await p.evaluate(() => { const d = CI.app.data(); return d.reports.find(r => r.entities.length >= 2).id; });
  await p.evaluate(id => CI.app.go('#/report/' + id), rid); await p.waitForTimeout(300);
  // the full list is shown by default, with Connected to selected
  assert.equal(await p.$eval('#lk-type', s => s.value), 'CONNECTED_TO');
  // ticking off the full list gives the short one: no social section
  await p.click('#lk-all'); await p.waitForTimeout(300);
  assert.equal(await p.$$eval('#lk-type optgroup[label="Social media"]', o => o.length), 0);
  await p.click('#lk-all'); await p.waitForTimeout(300);
  const opts = await p.$$eval('#lk-type optgroup[label="Social media"] option', o => o.map(x => x.value));
  assert.deepEqual(opts, ['ADMINISTERS', 'POSTS_ON', 'FOLLOWS_OR_SUPPORTS', 'MEMBER_OF', 'SHARES_OR_AMPLIFIES', 'MENTIONS_OR_TAGS', 'REPLIES_TO', 'REPUBLISHES_CONTENT_OF']);
  const labels = await p.$$eval('#lk-type optgroup[label="Social media"] option', o => o.map(x => x.textContent.replace(/\s+[→↔]$/, '')));
  assert.deepEqual(labels, ['Administers', 'Posts on', 'Follows or supports', 'Member of', 'Shares or amplifies', 'Mentions or tags', 'Replies to', 'Republishes content of']);
  assert.equal(await p.$$eval('#lk-type option[value=MEMBER_OF]', o => o.length), 2); // Groups and Social media, same stored type
  // hint under the picker; note required; saved with the stored name
  const [from, to] = await p.$$eval('#lk-from option', o => o.map(x => x.value).filter(Boolean));
  await p.selectOption('#lk-from', from); await p.selectOption('#lk-to', to); await p.selectOption('#lk-type', 'ADMINISTERS'); await p.waitForTimeout(100);
  assert.ok((await p.textContent('#lk-hint')).includes('Runs a page'));
  await p.click('[data-action=add-link]'); assert.ok((await p.textContent('#lk-msg')).length > 5);
  await p.fill('#lk-note', 'runs the Facebook page'); await p.click('[data-action=add-link]'); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => CI.app.data().links.filter(l => l.type === 'ADMINISTERS' && l.note === 'runs the Facebook page').length);
  assert.equal(saved, 1);
  assert.ok((await p.content()).includes('Administers'));
  await p.evaluate(() => CI.app.go('#/review')); await p.waitForTimeout(200);
  assert.ok((await p.textContent('#view')).includes('Ordinary supporters of a page'));
  assert.deepEqual(errs, []);
  console.log('social media types ok'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
