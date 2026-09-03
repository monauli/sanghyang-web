// Bootstrap akun admin pertama. Tidak ada halaman signup publik — jalankan
// sekali secara lokal, lalu tempel SQL yang dicetak ke Supabase SQL Editor
// (setelah tabel admin_users dibuat lewat db/005_admin_users.sql).
//
// Pemakaian: node scripts/create-admin.ts <email> <password>
import { hashPassword } from '../lib/admin/password.ts';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Pemakaian: node scripts/create-admin.ts <email> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password minimal 8 karakter.');
  process.exit(1);
}

const hash = hashPassword(password);
const escapedEmail = email.replace(/'/g, "''");

console.log('Password hash:');
console.log(hash);
console.log('');
console.log('SQL siap-tempel (Supabase SQL Editor, setelah admin_users dibuat):');
console.log('');
console.log('insert into public.admin_users (email, password_hash) values');
console.log(`  ('${escapedEmail}', '${hash}');`);
