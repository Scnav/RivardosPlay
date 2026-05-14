const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./rivardosplay.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
    return;
  }
  console.log('Connected to SQLite database');

  db.get('SELECT id FROM users WHERE email = ?', ['admin@teste.com'], (err, admin) => {
    if (err) {
      console.error('Error checking admin:', err);
      db.close();
      return;
    }

    if (!admin) {
      bcrypt.hash('admin123', 10, (err, hash) => {
        if (err) {
          console.error('Error hashing password:', err);
          db.close();
          return;
        }
        db.run('INSERT INTO users (username, email, password, level, avatar, xp, role, favorites, hours_played, library) VALUES (?, ?, ?, 100, "👑", 0, "admin", 0, 0, ? )',
          ['Admin', 'admin@teste.com', hash, JSON.stringify([])], function(err) {
            if (err) {
              console.error('Error creating admin:', err);
            } else {
              console.log('✅ Admin user created successfully!');
              console.log('📧 Email: admin@teste.com');
              console.log('🔐 Password: admin123');
            }
            db.close();
          });
      });
    } else {
      console.log('✅ Admin user already exists');
      db.close();
    }
  });
});
