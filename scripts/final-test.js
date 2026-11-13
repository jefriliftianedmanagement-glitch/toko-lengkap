/* Final local validation. These checks do not require .env or a Supabase connection. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function collectJs(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJs(relative);
    return entry.isFile() && entry.name.endsWith('.js') ? [relative] : [];
  });
}

check('struktur halaman utama user dan admin tersedia', () => {
  const required = [
    'frontend/index.html', 'frontend/login.html', 'frontend/register.html',
    'frontend/dashboard.html', 'frontend/topup.html', 'frontend/mailbox.html',
    'frontend/history.html', 'admin/login.html', 'admin/index.html',
    'admin/users.html', 'admin/products.html', 'admin/inbox.html',
    'admin/send-balance.html', 'admin/transactions.html',
  ];
  for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `${file} tidak ditemukan`);
});

check('seluruh route utama terhubung ke router API', () => {
  const routes = read('backend/routes/index.js');
  for (const route of ['/auth', '/admin/auth', '/products', '/topups', '/inbox', '/transactions', '/admin']) {
    assert.ok(routes.includes(`'${route}'`), `route ${route} belum terdaftar`);
  }
});

check('server menyajikan folder frontend dan admin secara terpisah', () => {
  const server = read('backend/app.js');
  assert.match(server, /app\.use\('\/admin',\s*express\.static\(path\.join\(root,\s*'admin'\)\)\)/);
  assert.match(server, /app\.use\('\/',\s*express\.static\(path\.join\(root,\s*'frontend'\)\)\)/);
});

check('batas Node.js package dan lockfile konsisten (>=22)', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.engines.node, '>=22');
  assert.equal(lock.packages[''].engines.node, pkg.engines.node);
});

check('semua file JavaScript lolos pemeriksaan sintaks Node.js', () => {
  const files = ['backend', 'frontend/js', 'admin/js', 'scripts'].flatMap(collectJs);
  assert.ok(files.length > 0, 'tidak ada file JavaScript yang diperiksa');
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout || 'syntax check gagal'}`);
  }
  console.log(`     (${files.length} file JavaScript diperiksa)`);
});

function runSuite(label, file) {
  const result = spawnSync(process.execPath, [path.join(root, file)], { cwd: root, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0) {
    passed += 1;
    console.log(`PASS suite ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL suite ${label} (exit ${result.status})`);
  }
}

console.log('\n=== Pemeriksaan integrasi statis ===');
// Static checks are completed before running the existing focused test suites.
console.log('\n=== PART 8 security tests ===');
runSuite('PART 8', 'scripts/transaction-controller-test.js');
console.log('\n=== PART 9 PWA tests ===');
runSuite('PART 9', 'scripts/pwa-test.js');
console.log('\n=== PART 11 account and history tests ===');
runSuite('PART 11', 'scripts/part11-test.js');

console.log(`\nHasil final test: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
