const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./rivardosplay.db');
db.serialize(() => {
  db.run("ALTER TABLE games ADD COLUMN embed TEXT DEFAULT ''", (err) => {
    if (err && !err.message.includes('duplicate')) {
      console.error('Erro:', err.message);
    } else {
      console.log('✅ Coluna embed verificada/adicionada');
    }
    db.close();
  });
});
