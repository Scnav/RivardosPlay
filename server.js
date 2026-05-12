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
  
  const createTable = `
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
      hours_played INTEGER DEFAULT 0,      library TEXT DEFAULT '[]',      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.run(createTable, err => {
    if (err) {
      console.error('Error creating table:', err);
      return;
    }
    db.all('PRAGMA table_info(users)', (err, columns) => {
      if (err) {
        console.error('Error checking table schema:', err);
        return;
      }
      const columnNames = columns.map(col => col.name);

      function addColumn(columnName, sql, next) {
        if (!columnNames.includes(columnName)) {
          db.run(sql, err => {
            if (err) console.error(`Error adding ${columnName} column:`, err);
            next();
          });
        } else {
          next();
        }
      }

      addColumn('xp', 'ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0', () => {
        addColumn('role', "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", () => {
          addColumn('favorites', 'ALTER TABLE users ADD COLUMN favorites INTEGER DEFAULT 0', () => {
            addColumn('hours_played', 'ALTER TABLE users ADD COLUMN hours_played INTEGER DEFAULT 0', () => {
              addColumn('library', "ALTER TABLE users ADD COLUMN library TEXT DEFAULT '[]'", () => {
                db.run("UPDATE users SET role = 'admin' WHERE email = 'admin@teste.com'", err => {
                  if (err) console.error('Error setting admin role:', err);
                });
              });
            });
          });
        });
      });
    });
  });
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = 'INSERT INTO users (username, email, password, level, avatar, xp, role, favorites, hours_played, library) VALUES (?, ?, ?, 0, "🛡️", 0, "user", 0, 0, ? )';
    db.run(query, [username, email, hashedPassword, JSON.stringify([])], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ error: 'Email ou username já cadastrado' });
        }
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
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }
  
  const query = 'SELECT id, username, email, password, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?';
  db.get(query, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }
    
    let library = [];
    try {
      library = user.library ? JSON.parse(user.library) : [];
    } catch (error) {
      library = [];
    }
    res.json({ 
      message: 'Login realizado com sucesso', 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        avatar: user.avatar,
        xp: user.xp,
        role: user.role || 'user',
        favorites: user.favorites || 0,
        hours_played: user.hours_played || 0,
        library
      } 
    });
  });
});

// Serve HTML routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/games', (req, res) => {
  res.sendFile(path.join(__dirname, 'games.html'));
});

app.get('/library', (req, res) => {
  res.sendFile(path.join(__dirname, 'library.html'));
});

app.get('/news', (req, res) => {
  res.sendFile(path.join(__dirname, 'news.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/admin/users', (req, res) => {
  const adminEmail = req.query.email;
  if (!adminEmail) {
    return res.status(400).json({ error: 'Email de administrador é necessário' });
  }

  db.get('SELECT role FROM users WHERE email = ?', [adminEmail], (err, admin) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    db.all('SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Erro ao buscar usuários' });
      res.json(rows);
    });
  });
});

app.delete('/api/admin/users/:id', (req, res) => {
  const adminEmail = req.query.email;
  const id = req.params.id;

  if (!adminEmail) {
    return res.status(400).json({ error: 'Email de administrador é necessário' });
  }

  db.get('SELECT role FROM users WHERE email = ?', [adminEmail], (err, admin) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    db.run('DELETE FROM users WHERE id = ? AND role != "admin"', [id], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao excluir usuário' });
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado ou não pode ser excluído' });
      }
      res.json({ message: 'Usuário excluído com sucesso' });
    });
  });
});

// Update user profile
app.put('/api/user/update', async (req, res) => {
  const { email, username, avatar } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updateQuery = 'UPDATE users SET username = ?, avatar = ? WHERE email = ?';
    db.run(updateQuery, [username, avatar, email], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar usuário' });
      
      db.get('SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?', [email], (err, updatedUser) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar dados atualizados' });
        let library = [];
        try {
          library = updatedUser.library ? JSON.parse(updatedUser.library) : [];
        } catch (error) {
          library = [];
        }
        res.json({ 
          message: 'Perfil atualizado com sucesso',
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            level: updatedUser.level,
            avatar: updatedUser.avatar,
            xp: updatedUser.xp,
            role: updatedUser.role || 'user',
            favorites: updatedUser.favorites || 0,
            hours_played: updatedUser.hours_played || 0,
            library
          }
        });
      });
    });
  });
});

app.put('/api/user/library', (req, res) => {
  const { email, game, action } = req.body;

  if (!email || !game || !action) {
    return res.status(400).json({ error: 'Email, jogo e ação são obrigatórios' });
  }

  db.get('SELECT library FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!row) return res.status(404).json({ error: 'Usuário não encontrado' });

    let library = [];
    try {
      library = row.library ? JSON.parse(row.library) : [];
    } catch (error) {
      library = [];
    }

    if (action === 'add') {
      if (!library.includes(game)) {
        library.push(game);
      }
    } else if (action === 'remove') {
      library = library.filter(item => item !== game);
    } else {
      return res.status(400).json({ error: 'Ação inválida' });
    }

    const favorites = library.length;
    const updateQuery = 'UPDATE users SET library = ?, favorites = ? WHERE email = ?';
    db.run(updateQuery, [JSON.stringify(library), favorites, email], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar biblioteca' });

      const selectQuery = 'SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?';
      db.get(selectQuery, [email], (err, updatedUser) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar usuário atualizado' });
        let libraryArray = [];
        try {
          libraryArray = updatedUser.library ? JSON.parse(updatedUser.library) : [];
        } catch (error) {
          libraryArray = [];
        }
        res.json({
          message: 'Biblioteca atualizada com sucesso',
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            level: updatedUser.level,
            avatar: updatedUser.avatar,
            xp: updatedUser.xp,
            role: updatedUser.role || 'user',
            favorites: updatedUser.favorites || 0,
            hours_played: updatedUser.hours_played || 0,
            library: libraryArray
          }
        });
      });
    });
  });
});

// Serve all other static files
app.use((req, res) => {
  res.status(404).json({ error: 'Página não encontrada' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.on('error', (err) => {
  console.error('Server error:', err);
});