'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

test('manifest valid JSON and standalone configuration', () => {
  const m = JSON.parse(read('frontend/manifest.webmanifest'));
  assert.equal(m.name, 'FakeShop - Toko Virtual');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some(x => x.sizes === '192x192'));
  assert.ok(m.icons.some(x => x.sizes === '512x512'));
  assert.ok(m.icons.some(x => x.purpose === 'maskable'));
});

test('PWA icon files exist with declared dimensions', () => {
  const m = JSON.parse(read('frontend/manifest.webmanifest'));
  for (const item of m.icons) {
    const file = path.join(root, 'frontend', item.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(file), `${item.src} missing`);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'invalid PNG signature');
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    const [expectedW,expectedH] = item.sizes.split('x').map(Number);
    assert.equal(w, expectedW); assert.equal(h, expectedH);
  }
});

test('all application pages link manifest and PWA bootstrap', () => {
  for (const folder of ['frontend','admin']) {
    for (const name of fs.readdirSync(path.join(root,folder)).filter(x => x.endsWith('.html') && x !== 'offline.html')) {
      const html = read(`${folder}/${name}`);
      assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/i, `${folder}/${name}`);
      assert.match(html, /src="\/js\/pwa\.js" defer/i, `${folder}/${name}`);
    }
  }
});

test('service worker avoids API and authenticated navigation caching', () => {
  const sw = read('frontend/sw.js');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.match(sw, /OFFLINE_URL/);
  assert.doesNotMatch(sw, /cache\.put\(request, response\.clone\(\)\)[\s\S]{0,100}navigate/);
});

test('offline page exists and warns against offline account data', () => {
  const html = read('frontend/offline.html');
  assert.match(html, /Anda sedang offline/);
  assert.match(html, /tidak disimpan untuk akses offline/i);
});

test('PWA scripts pass Node syntax checks', () => {
  for (const file of ['frontend/sw.js','frontend/js/pwa.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(root,file)], { encoding:'utf8' });
    assert.equal(result.status, 0, result.stderr || file);
  }
});

console.log(`\nHasil PART 9 PWA test: ${passed} PASS, ${process.exitCode ? 'FAIL' : '0 FAIL'}`);
