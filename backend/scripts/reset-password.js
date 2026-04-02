const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: 'postgresql://crmuser:crmpassword@localhost:5432/wacrm' });

async function main() {
  const email = process.argv[2] || 'whatapi00@gmail.com';
  const password = process.argv[3] || 'Billy777!';
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email',
    [hash, email]
  );
  if (result.rows.length === 0) {
    console.log('User not found:', email);
  } else {
    console.log('Password reset for:', result.rows[0].email);
  }
  await pool.end();
}

main().catch(err => { console.error(err.message); process.exit(1); });
