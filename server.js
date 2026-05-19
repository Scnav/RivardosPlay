const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const sessions = new Map();
const authRateLimit = new Map();

function auditSessionEvent(payload) {
  try {
    const line = `${new Date().toISOString()} ${JSON.stringify(payload)}\n`;
    fs.appendFileSync(path.join(__dirname, 'session-audit.log'), line, 'utf8');
  } catch {}
}

app.disable('x-powered-by');
app.use(cors({ origin: false }));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.use(express.static(path.join(__dirname), {
  etag: true,
  lastModified: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=120');
  }
}));

const apiCache = new Map();
const getCached = (key) => {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    apiCache.delete(key);
    return null;
  }
  return entry.payload;
};
const setCached = (key, payload, ttlMs) => {
  apiCache.set(key, { payload, expiresAt: Date.now() + ttlMs });
};
const invalidateCache = (prefixes = []) => {
  for (const key of apiCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      apiCache.delete(key);
    }
  }
};

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeEmbed(embed) {
  const raw = String(embed || '').trim();
  if (!raw) return '';
  const match = raw.match(/<iframe\b[^>]*\bsrc=(["'])(https?:\/\/[^"']+)\1[^>]*>\s*<\/iframe>/i);
  if (!match) return '';
  const src = match[2];
  if (!isValidHttpUrl(src)) return '';
  return `<iframe src="${src}" allow="fullscreen; gamepad; pointer-lock" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" referrerpolicy="no-referrer" loading="lazy" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
}

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
  const createGameSessionsTable = `
    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      total_seconds INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, game_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(game_id) REFERENCES games(id)
    )
  `;
  const createGuestGameSessionsTable = `
    CREATE TABLE IF NOT EXISTS guest_game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      game_id INTEGER NOT NULL,
      total_seconds INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(visitor_id, game_id),
      FOREIGN KEY(game_id) REFERENCES games(id)
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
      db.run(createGameSessionsTable, err => {
        if (err) {
          console.error('Error creating game_sessions table:', err);
          return;
        }
        db.run(createGuestGameSessionsTable, guestErr => {
          if (guestErr) {
            console.error('Error creating guest_game_sessions table:', guestErr);
            return;
          }
        });
      });
      console.log('Tables created/verified');

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

function isAdmin(req, res, next) {
  if (!req.authUser || req.authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    id: user.id,
    email: user.email,
    role: user.role || 'user',
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSessionToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const custom = req.headers['x-auth-token'];
  return typeof custom === 'string' ? custom : '';
}

function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  req.authUser = session;
  req.authToken = token;
  next();
}

function optionalAuth(req, _res, next) {
  const token = getSessionToken(req);
  if (!token) {
    req.authUser = null;
    return next();
  }
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    sessions.delete(token);
    req.authUser = null;
    return next();
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  req.authUser = session;
  req.authToken = token;
  next();
}

function limiterKey(req) {
  return `${req.ip}:${req.path}`;
}

function checkRateLimit(req, res, maxAttempts, windowMs) {
  const key = limiterKey(req);
  const now = Date.now();
  const item = authRateLimit.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > item.resetAt) {
    item.count = 0;
    item.resetAt = now + windowMs;
  }
  item.count += 1;
  authRateLimit.set(key, item);
  if (item.count > maxAttempts) {
    const retryAfter = Math.ceil((item.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Muitas tentativas. Tente novamente em instantes.' });
    return false;
  }
  return true;
}

// ==================== AUTH ====================

app.post('/api/register', (req, res) => {
  res.status(403).json({ error: 'Registro desabilitado. Contate um administrador.' });
});

app.post('/api/login', (req, res) => {
  if (!checkRateLimit(req, res, 25, 10 * 60 * 1000)) return;
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  db.get('SELECT id, username, email, password, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Email ou senha inválidos' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Email ou senha inválidos' });

    let library = [];
    try { library = user.library ? JSON.parse(user.library) : []; } catch (e) { library = []; }

    const token = createSession(user);
    res.json({
      message: 'Login realizado com sucesso',
      token,
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

app.get('/api/admin/users', requireAuth, isAdmin, (req, res) => {
  db.all('SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuários' });
    res.json(rows);
  });
});

app.delete('/api/admin/users/:id', requireAuth, isAdmin, (req, res) => {
  db.run('DELETE FROM users WHERE id = ? AND role != "admin"', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir usuário' });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado ou não pode ser excluído' });
    res.json({ message: 'Usuário excluído com sucesso' });
  });
});

// ==================== ADMIN - JOGOS ====================

app.get('/api/games', (req, res) => {
  const cacheKey = 'games:list';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogos' });
    const payload = rows.map(g => ({ ...g, tags: g.tags ? JSON.parse(g.tags) : [] }));
    setCached(cacheKey, payload, 30 * 1000);
    res.json(payload);
  });
});

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.authToken);
  res.json({ message: 'Logout efetuado' });
});

app.get('/api/session', requireAuth, (req, res) => {
  const email = req.authUser.email;
  db.get(
    'SELECT id, username, email, level, avatar, xp, role, favorites, hours_played, library FROM users WHERE email = ?',
    [email],
    (err, user) => {
      if (err || !user) return res.status(err ? 500 : 404).json({ error: err ? 'Erro no servidor' : 'Usuário não encontrado' });
      let library = [];
      try { library = user.library ? JSON.parse(user.library) : []; } catch (e) { library = []; }
      return res.json({
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
    }
  );
});

app.get('/api/games/:id', (req, res) => {
  db.get('SELECT * FROM games WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return err ? res.status(500).json({ error: 'Erro ao buscar jogo' }) : res.status(404).json({ error: 'Jogo não encontrado' });
    res.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
  });
});

app.post('/api/games', requireAuth, isAdmin, (req, res) => {
  const { name, image_url, alt_text, tags, rating, category, embed } = req.body;
  if (!name || !image_url) return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });
  if (!isValidHttpUrl(image_url)) return res.status(400).json({ error: 'URL de imagem inválida' });
  const safeEmbed = sanitizeEmbed(embed);

  db.run('INSERT INTO games (name, image_url, alt_text, tags, rating, category, embed) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, image_url, alt_text || name, JSON.stringify(tags || []), rating || 0, category || "", safeEmbed], function(err) {
       if (err) {
         console.error("Insert error:", err.message, "SQL:", this.sql);
         return res.status(500).json({ error: "Erro ao criar jogo: " + err.message });
       }
       db.get('SELECT * FROM games WHERE id = ?', [this.lastID], (selectErr, row) => {
         if (selectErr || !row) return res.status(201).json({ message: 'Jogo criado com sucesso', gameId: this.lastID });
         invalidateCache(['games:list', 'admin:game-stats']);
         return res.status(201).json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
       });
    });
});

app.put('/api/games/:id', requireAuth, isAdmin, (req, res) => {
  const { name, image_url, alt_text, tags, rating, category, embed } = req.body;
  if (!name || !image_url) return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });
  if (!isValidHttpUrl(image_url)) return res.status(400).json({ error: 'URL de imagem inválida' });
  const safeEmbed = sanitizeEmbed(embed);

  db.run('UPDATE games SET name = ?, image_url = ?, alt_text = ?, tags = ?, rating = ?, category = ?, embed = ? WHERE id = ?',
    [name, image_url, alt_text || name, JSON.stringify(tags || []), rating || 0, category || "", safeEmbed, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar jogo' });
      if (this.changes === 0) return res.status(404).json({ error: 'Jogo não encontrado' });
      invalidateCache(['games:list', 'admin:game-stats']);
      db.get('SELECT * FROM games WHERE id = ?', [req.params.id], (err, row) => {
        res.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
      });
    });
});

app.delete('/api/games/:id', requireAuth, isAdmin, (req, res) => {
  db.run('DELETE FROM games WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir jogo' });
    if (this.changes === 0) return res.status(404).json({ error: 'Jogo não encontrado' });
    invalidateCache(['games:list', 'admin:game-stats']);
    res.json({ message: 'Jogo excluído com sucesso' });
  });
});

// ==================== PERFIL ====================

app.put('/api/user/update', requireAuth, (req, res) => {
  const { username, avatar } = req.body;
  const email = req.authUser.email;
  if (!email) return res.status(400).json({ error: 'Email é obrigatório' });
  if (!username || String(username).trim().length < 3 || String(username).trim().length > 32) return res.status(400).json({ error: 'Username inválido' });

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

app.put('/api/user/library', requireAuth, (req, res) => {
  const { game, action } = req.body;
  const email = req.authUser.email;
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

app.post('/api/admin/import-rss', requireAuth, isAdmin, async (req, res) => {
  const { feed_url } = req.body;
  if (!feed_url || typeof feed_url !== 'string') {
    return res.status(400).json({ error: 'feed_url é obrigatório' });
  }

  try {
    let parsed;
    try {
      parsed = new URL(feed_url);
    } catch {
      return res.status(400).json({ error: 'URL de feed inválida' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Protocolo de feed não permitido' });
    }
    const host = parsed.hostname.toLowerCase();
    const blockedHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    if (
      blockedHosts.has(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return res.status(400).json({ error: 'Host de feed não permitido' });
    }

    const response = await fetch(parsed.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      return res.status(400).json({ error: `Falha ao carregar feed: HTTP ${response.status}` });
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) {
      return res.status(400).json({ error: 'Feed sem jogos em items' });
    }

    const parseTokens = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[|/]/g, ',')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

    const categorySynonyms = {
      acao: ['acao', 'action', 'ação'],
      aventura: ['aventura', 'adventure'],
      rpg: ['rpg', 'role playing', 'role-playing'],
      tiro: ['tiro', 'shooter', 'fps', 'gun'],
      estrategia: ['estrategia', 'strategy', 'tactics', 'tower defense', 'td'],
      corrida: ['corrida', 'racing', 'race', 'car'],
      esportes: ['esporte', 'esportes', 'sports', 'football', 'soccer', 'basketball'],
      puzzle: ['puzzle', 'quebra-cabeca', 'quebra cabeça'],
      casual: ['casual', 'hypercasual', 'hyper-casual'],
      simulacao: ['simulacao', 'simulation', 'simulator']
    };

    const canonicalCategories = Object.keys(categorySynonyms);

    const inferCategories = (item) => {
      const rawTokens = [
        ...parseTokens(item.category),
        ...parseTokens(item.description),
        ...parseTokens(item.title)
      ];
      const normalized = new Set();
      for (const token of rawTokens) {
        for (const cat of canonicalCategories) {
          if (categorySynonyms[cat].some((syn) => token.includes(syn))) {
            normalized.add(cat);
          }
        }
      }
      if (!normalized.size) normalized.add('casual');
      return [...normalized];
    };

    const inferTags = (item, categories) => {
      const tags = new Set();
      categories.forEach((c) => tags.add(c));
      if (item.orientation) tags.add(String(item.orientation).toLowerCase().trim());
      if (item.namespace) tags.add(String(item.namespace).toLowerCase().trim());
      if (item.width && item.height) tags.add(`${item.width}x${item.height}`);
      if (item.quality_score !== undefined && item.quality_score !== null) {
        const quality = Number(item.quality_score);
        if (Number.isFinite(quality)) {
          if (quality >= 0.85) tags.add('alta qualidade');
          else if (quality >= 0.6) tags.add('qualidade media');
          else tags.add('qualidade baixa');
        }
      }
      return [...tags].filter(Boolean);
    };

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    const tasks = items.map((item) => new Promise((resolve) => {
      const name = String(item.title || '').trim();
      const image_url = String(item.banner_image || item.image || '').trim();
      const alt_text = name || 'Game';
      const categories = inferCategories(item);
      const tags = inferTags(item, categories);
      const quality = Number(item.quality_score);
      const rating = Number.isFinite(quality) ? Math.max(0, Math.min(5, +(quality * 5).toFixed(1))) : 0;
      const category = categories.join(' ');
      const embedUrl = String(item.url || '').trim();
      const embed = embedUrl ? sanitizeEmbed(`<iframe src="${embedUrl}"></iframe>`) : '';

      if (!name || !image_url) {
        skipped += 1;
        return resolve();
      }

      db.get('SELECT id FROM games WHERE name = ?', [name], (existsErr, exists) => {
        if (existsErr) {
          failed += 1;
          return resolve();
        }
        if (exists) {
          skipped += 1;
          return resolve();
        }

        db.run(
          'INSERT INTO games (name, image_url, alt_text, tags, rating, category, embed) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [name, image_url, alt_text, JSON.stringify(tags), rating, category, embed],
          function (insertErr) {
            if (insertErr) failed += 1;
            else imported += 1;
            resolve();
          }
        );
      });
    }));

    await Promise.all(tasks);
    invalidateCache(['games:list', 'admin:game-stats']);
    return res.json({ imported, skipped, failed, total: items.length });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao importar feed RSS' });
  }
});

app.post('/api/user/game-session', optionalAuth, (req, res) => {
  const email = req.authUser?.email || '';
  const { gameId, seconds, visitorId } = req.body;
  const playedSeconds = Math.max(0, parseInt(seconds, 10) || 0);
  const parsedGameId = parseInt(gameId, 10);
  const normalizedVisitorId = String(visitorId || '').trim();

  if (!parsedGameId || playedSeconds <= 0) {
    auditSessionEvent({ stage: 'reject_invalid_input', email, gameId, seconds, visitorId });
    return res.status(400).json({ error: 'gameId e seconds válidos são obrigatórios' });
  }

  db.get('SELECT id FROM games WHERE id = ?', [parsedGameId], (gameErr, gameRow) => {
    if (gameErr || !gameRow) {
      auditSessionEvent({ stage: 'reject_game_not_found', gameId: parsedGameId, gameErr: gameErr?.message || null });
      return res.status(gameErr ? 500 : 404).json({ error: gameErr ? 'Erro no servidor' : 'Jogo não encontrado' });
    }
    if (email) {
      db.get('SELECT id FROM users WHERE email = ?', [email], (userErr, userRow) => {
        if (userErr || !userRow) {
          auditSessionEvent({ stage: 'reject_user_not_found', email, userErr: userErr?.message || null });
          return res.status(userErr ? 500 : 404).json({ error: userErr ? 'Erro no servidor' : 'Usuário não encontrado' });
        }
        db.run(
          `INSERT INTO game_sessions (user_id, game_id, total_seconds, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, game_id)
           DO UPDATE SET total_seconds = total_seconds + excluded.total_seconds, updated_at = CURRENT_TIMESTAMP`,
          [userRow.id, parsedGameId, playedSeconds],
          function (saveErr) {
            if (saveErr) {
              auditSessionEvent({ stage: 'save_user_error', email, userId: userRow.id, gameId: parsedGameId, playedSeconds, saveErr: saveErr.message });
              return res.status(500).json({ error: 'Erro ao registrar sessão do jogo' });
            }
            auditSessionEvent({ stage: 'save_user_ok', email, userId: userRow.id, gameId: parsedGameId, playedSeconds });
            invalidateCache(['admin:game-stats']);
            return res.json({ message: 'Sessão registrada com sucesso' });
          }
        );
      });
      return;
    }

    let safeVisitorId = normalizedVisitorId;
    if (!safeVisitorId || safeVisitorId.length < 8 || safeVisitorId.length > 128) {
      const fingerprint = `${req.ip || 'ip'}|${req.headers['user-agent'] || 'ua'}`;
      safeVisitorId = `auto_${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
    }
    db.run(
      `INSERT INTO guest_game_sessions (visitor_id, game_id, total_seconds, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(visitor_id, game_id)
       DO UPDATE SET total_seconds = total_seconds + excluded.total_seconds, updated_at = CURRENT_TIMESTAMP`,
      [safeVisitorId, parsedGameId, playedSeconds],
      function (saveErr) {
        if (saveErr) {
          auditSessionEvent({ stage: 'save_guest_error', visitorId: safeVisitorId, gameId: parsedGameId, playedSeconds, saveErr: saveErr.message });
          return res.status(500).json({ error: 'Erro ao registrar sessão anônima do jogo' });
        }
        auditSessionEvent({ stage: 'save_guest_ok', visitorId: safeVisitorId, gameId: parsedGameId, playedSeconds });
        invalidateCache(['admin:game-stats']);
        return res.json({ message: 'Sessão registrada com sucesso' });
      }
    );
  });
});

app.get('/api/admin/game-stats', requireAuth, isAdmin, (req, res) => {
  const cacheKey = 'admin:game-stats';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const sql = `
    SELECT
      g.id AS game_id,
      g.name AS game_name,
      COALESCE(SUM(s.total_seconds), 0) AS total_seconds,
      COUNT(DISTINCT s.player_key) AS unique_players,
      CASE
        WHEN COUNT(DISTINCT s.player_key) = 0 THEN 0
        ELSE ROUND((SUM(s.total_seconds) * 1.0) / COUNT(DISTINCT s.player_key), 2)
      END AS avg_seconds_per_user
    FROM games g
    LEFT JOIN (
      SELECT game_id, total_seconds, 'u:' || CAST(user_id AS TEXT) AS player_key
      FROM game_sessions
      UNION ALL
      SELECT game_id, total_seconds, 'v:' || visitor_id AS player_key
      FROM guest_game_sessions
    ) s ON s.game_id = g.id
    GROUP BY g.id, g.name
    ORDER BY total_seconds DESC, g.name ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar estatísticas de jogo' });
    setCached(cacheKey, rows, 60 * 1000);
    res.json(rows);
  });
});

// ==================== HTML ROUTES ====================

app.get('/*.html', (req, res, next) => {
  const cleanPath = req.path.replace(/\.html$/i, '') || '/';
  if (cleanPath === '/index') return res.redirect(301, '/');
  return res.redirect(301, cleanPath);
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/index.html', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'rp.html')); });
app.get('/login.html', (req, res) => { res.sendFile(path.join(__dirname, 'rp.html')); });
app.get('/rp', (req, res) => { res.sendFile(path.join(__dirname, 'rp.html')); });
app.get('/rp.html', (req, res) => { res.sendFile(path.join(__dirname, 'rp.html')); });
app.get('/register', (req, res) => { res.redirect('/login'); });
app.get('/register.html', (req, res) => { res.sendFile(path.join(__dirname, 'rpr.html')); });
app.get('/rpr', (req, res) => { res.sendFile(path.join(__dirname, 'rpr.html')); });
app.get('/rpr.html', (req, res) => { res.sendFile(path.join(__dirname, 'rpr.html')); });
app.get('/games', (req, res) => { res.sendFile(path.join(__dirname, 'games.html')); });
app.get('/news', (req, res) => { res.sendFile(path.join(__dirname, 'news.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'rpa.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'rpa.html')); });
app.get('/rpa', (req, res) => { res.sendFile(path.join(__dirname, 'rpa.html')); });
app.get('/rpa.html', (req, res) => { res.sendFile(path.join(__dirname, 'rpa.html')); });

app.use((req, res) => { res.status(404).json({ error: 'Página não encontrada' }); });

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
app.on('error', (err) => console.error('Server error:', err));








