const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database('./rivardosplay.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
    return;
  }
  console.log('Connected to SQLite database');

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      avatar TEXT DEFAULT '🛡️',
      xp INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      favorites INTEGER DEFAULT 0,
      hours_played INTEGER DEFAULT 0,
      library TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createGamesTable = `
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      alt_text TEXT,
      tags TEXT DEFAULT '[]',
      rating REAL DEFAULT 0,
       category TEXT,
       embed TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createUsersTable, err => {
    if (err) {
      console.error('Error creating users table:', err);
      return;
    }

    db.run(createGamesTable, err => {
      if (err) {
        console.error('Error creating games table:', err);
        return;
      }
      console.log('Tables created/verified');

      // Criar admin
      const adminEmail = 'admin@teste.com';
      db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, admin) => {
        if (!admin) {
          bcrypt.hash('admin123', 10, (err, hash) => {
            db.run('INSERT INTO users (username, email, password, level, avatar, xp, role, favorites, hours_played, library) VALUES (?, ?, ?, 100, "👑", 0, "admin", 0, 0, ? )',
              ['Admin', adminEmail, hash, JSON.stringify([])], function(err) {
                if (!err) console.log('✅ Admin created! Email: admin@teste.com  Senha: admin123');
              });
          });
        } else {
          db.run("UPDATE users SET role = 'admin' WHERE email = ?", [adminEmail]);
          console.log('✅ Admin exists');
        }

        // Inserir jogos iniciais
        db.get('SELECT COUNT(*) as count FROM games', (err, row) => {
          if (row.count === 0) {
            const games = [
              { name: 'Shadows of War', image_url: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=900&q=90', alt_text: 'Shadows of War', tags: JSON.stringify(['Ação', 'Aventura']), rating: 4.8, category: 'acao aventura' },
              { name: 'Eldryn Legacy', image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=900&q=90', alt_text: 'Eldryn Legacy', tags: JSON.stringify(['RPG', 'Mundo Aberto']), rating: 4.9, category: 'rpg aventura' },
              { name: 'Frontline Zero Hour', image_url: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=900&q=90', alt_text: 'Frontline Zero Hour', tags: JSON.stringify(['Tiro', 'Multijogador']), rating: 4.6, category: 'tiro acao' },
              { name: 'Speed Ultimate', image_url: 'https://images.unsplash.com/photo-1505682634904-d7c8d6309400?auto=format&fit=crop&w=900&q=90', alt_text: 'Speed Ultimate', tags: JSON.stringify(['Corrida', 'Esportes']), rating: 4.7, category: 'corrida' }
            ];

            games.forEach(g => {
              db.run('INSERT INTO games (name, image_url, alt_text, tags, rating, category, embed) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [g.name, g.image_url, g.alt_text, g.tags, g.rating, g.category]);
            });
            console.log('✅ Initial games inserted');
          } else {
            console.log('✅ Games exist');
          }
        });
      });
    });
  });
});

function isAdmin(req, res, next) {
  const adminEmail = req.query.email || (req.body && req.body.email);
  if (!adminEmail) return res.status(400).json({ error: 'Email de administrador é necessário' });

  db.get('SELECT role FROM users WHERE email = ?', [adminEmail], (err, admin) => {
    if (err || !admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  });
}

// ==================== AUTH ====================

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Todos os campos são obrigatórios' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, email, password, level, avatar, xp, role, favorites, hours_played, library) VALUES (?, ?, ?, 0, "🛡️", 0, "user", 0, 0, ? )',
      [username, email, hashedPassword, JSON.stringify([])], function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Email ou username já cadastrado' });
          return res.status(500).json({ error: 'Erro ao registrar usuário' });
        }
        res.status(201).json({ message: 'Usuário registrado com sucesso', userId: this.lastID });
      });
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  db.get('SELECT id, username, email, password, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Email ou senha inválidos' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Email ou senha inválidos' });

    let library = [];
    try { library = user.library ? JSON.parse(user.library) : []; } catch (e) { library = []; }

    res.json({
      message: 'Login realizado com sucesso',
      user: {
        id: user.id, username: user.username, email: user.email,
        level: user.level, avatar: user.avatar, xp: user.xp,
        role: user.role || 'user',
        favorites: user.favorites || 0,
        hours_played: user.hours_played || 0,
        library
      }
    });
  });
});

// ==================== ADMIN - USUÁRIOS ====================

app.get('/api/admin/users', isAdmin, (req, res) => {
  db.all('SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuários' });
    res.json(rows);
  });
});

app.delete('/api/admin/users/:id', isAdmin, (req, res) => {
  db.run('DELETE FROM users WHERE id = ? AND role != "admin"', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir usuário' });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado ou não pode ser excluído' });
    res.json({ message: 'Usuário excluído com sucesso' });
  });
});

// ==================== ADMIN - JOGOS ====================

app.get('/api/games', (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogos' });
    res.json(rows.map(g => ({ ...g, tags: g.tags ? JSON.parse(g.tags) : [] })));
  });
});

app.get('/api/games/:id', (req, res) => {
  db.get('SELECT * FROM games WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return err ? res.status(500).json({ error: 'Erro ao buscar jogo' }) : res.status(404).json({ error: 'Jogo não encontrado' });
    res.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
  });
});

app.post('/api/games', isAdmin, (req, res) => {
  const { name, image_url, alt_text, tags, rating, category, embed } = req.body;
  if (!name || !image_url) return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });

  db.run('INSERT INTO games (name, image_url, alt_text, tags, rating, category, embed) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, image_url, alt_text || name, JSON.stringify(tags || []), rating || 0, category || "", embed || ""], function(err) {
       if (err) {
         console.error("Insert error:", err.message, "SQL:", this.sql);
         return res.status(500).json({ error: "Erro ao criar jogo: " + err.message });
       }
    });
});

app.put('/api/games/:id', isAdmin, (req, res) => {
  const { name, image_url, alt_text, tags, rating, category, embed } = req.body;
  if (!name || !image_url) return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });

  db.run('UPDATE games SET name = ?, image_url = ?, alt_text = ?, tags = ?, rating = ?, category = ?, embed = ? WHERE id = ?',
    [name, image_url, alt_text || name, JSON.stringify(tags || []), rating || 0, category || "", embed || "", req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar jogo' });
      if (this.changes === 0) return res.status(404).json({ error: 'Jogo não encontrado' });
      db.get('SELECT * FROM games WHERE id = ?', [req.params.id], (err, row) => {
        res.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
      });
    });
});

app.delete('/api/games/:id', isAdmin, (req, res) => {
  db.run('DELETE FROM games WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir jogo' });
    if (this.changes === 0) return res.status(404).json({ error: 'Jogo não encontrado' });
    res.json({ message: 'Jogo excluído com sucesso' });
  });
});

// ==================== PERFIL ====================

app.put('/api/user/update', (req, res) => {
  const { email, username, avatar } = req.body;
  if (!email) return res.status(400).json({ error: 'Email é obrigatório' });

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) return res.status(err ? 500 : 404).json({ error: err ? 'Erro no servidor' : 'Usuário não encontrado' });

    db.run('UPDATE users SET username = ?, avatar = ? WHERE email = ?', [username, avatar, email], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar usuário' });

      db.get('SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?', [email], (err, updatedUser) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar dados atualizados' });
        let library = []; try { library = updatedUser.library ? JSON.parse(updatedUser.library) : []; } catch (e) { library = []; }

        res.json({
          message: 'Perfil atualizado com sucesso',
          user: {
            id: updatedUser.id, username: updatedUser.username, email: updatedUser.email,
            level: updatedUser.level, avatar: updatedUser.avatar, xp: updatedUser.xp,
            role: updatedUser.role || 'user', favorites: updatedUser.favorites || 0,
            hours_played: updatedUser.hours_played || 0, library
          }
        });
      });
    });
  });
});

app.put('/api/user/library', (req, res) => {
  const { email, game, action } = req.body;
  if (!email || !game || !action) return res.status(400).json({ error: 'Email, jogo e ação são obrigatórios' });

  db.get('SELECT library FROM users WHERE email = ?', [email], (err, row) => {
    if (err || !row) return res.status(err ? 500 : 404).json({ error: err ? 'Erro no servidor' : 'Usuário não encontrado' });

    let library = [];
    try { library = row.library ? JSON.parse(row.library) : []; } catch (e) { library = []; }

    if (action === 'add') { if (!library.includes(game)) library.push(game); }
    else if (action === 'remove') { library = library.filter(item => item !== game); }
    else return res.status(400).json({ error: 'Ação inválida' });

    db.run('UPDATE users SET library = ?, favorites = ? WHERE email = ?', [JSON.stringify(library), library.length, email], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar biblioteca' });

      db.get('SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?', [email], (err, updatedUser) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar usuário atualizado' });
        let libraryArray = []; try { libraryArray = updatedUser.library ? JSON.parse(updatedUser.library) : []; } catch (e) { libraryArray = []; }

        res.json({
          message: 'Biblioteca atualizada com sucesso',
          user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, level: updatedUser.level, avatar: updatedUser.avatar, xp: updatedUser.xp, role: updatedUser.role || 'user', favorites: updatedUser.favorites || 0, hours_played: updatedUser.hours_played || 0, library: libraryArray }
        });
      });
    });
  });
});

// ==================== HTML ROUTES ====================

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/index.html', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/login.html', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/register', (req, res) => { res.sendFile(path.join(__dirname, 'register.html')); });
app.get('/register.html', (req, res) => { res.sendFile(path.join(__dirname, 'register.html')); });
app.get('/games', (req, res) => { res.sendFile(path.join(__dirname, 'games.html')); });
app.get('/library', (req, res) => { res.sendFile(path.join(__dirname, 'library.html')); });
app.get('/news', (req, res) => { res.sendFile(path.join(__dirname, 'news.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });

app.use((req, res) => { res.status(404).json({ error: 'Página não encontrada' }); });

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
app.on('error', (err) => console.error('Server error:', err));








