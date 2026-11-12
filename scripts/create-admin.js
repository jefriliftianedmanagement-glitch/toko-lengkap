// Membuat akun admin pertama.  Jalankan:  npm run create-admin
const readline = require('readline');
const bcrypt = require('bcryptjs');
const supabase = require('../backend/config/supabase');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
    if (hidden) rl._writeToOutput = () => rl.output.write('*');
  });
}

async function main() {
  console.log('=== Buat akun ADMIN ===');
  const username = (await ask('Username admin (3-30, huruf/angka/_): ')).trim();
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
    console.error('Username tidak valid.');
    return 1;
  }

  const password = await ask('Password (min 10 karakter): ', true);
  const confirm = await ask('Ulangi password: ', true);
  if (password !== confirm) {
    console.error('Password tidak sama.');
    return 1;
  }
  if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    console.error('Password minimal 10 karakter dan maksimal 72 byte.');
    return 1;
  }

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from('admins')
    .insert({ username, password_hash })
    .select('id, username')
    .single();

  if (error) {
    if (error.code === '23505') console.error('Username admin sudah ada.');
    else console.error('Gagal membuat admin:', error.message);
    return 1;
  }

  console.log(`Admin berhasil dibuat: ${data.username} (id: ${data.id})`);
  return 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('Error:', e.message); process.exitCode = 1; });
