document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const cards = [...document.querySelectorAll('.game-card')];
  const categories = [...document.querySelectorAll('.cat')];
  const favorites = [...document.querySelectorAll('.favorite')];
  const shuffleBtn = document.getElementById('shuffleBtn');
  const grid = document.getElementById('gamesGrid');
  const authTabs = [...document.querySelectorAll('.auth-tab')];
  const authForms = [...document.querySelectorAll('.auth-form')];
  const userPanel = document.getElementById('userPanel');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminLink = document.getElementById('adminLink');
  const userName = document.getElementById('userName');
  const userLevel = document.getElementById('userLevel');
  const userAvatar = document.getElementById('userAvatar');
  const userInfoClickable = document.getElementById('userInfoClickable');
  const playerInfoPanel = document.getElementById('playerInfoPanel');
  const closePlayerInfo = document.getElementById('closePlayerInfo');
  const editPlayerInfoBtn = document.getElementById('editPlayerInfo');
  const savePlayerInfoBtn = document.getElementById('savePlayerInfo');
  const cancelEditPlayerInfoBtn = document.getElementById('cancelEditPlayerInfo');
  const playerUsernameDisplay = document.getElementById('playerUsernameDisplay');
  const playerEmailDisplay = document.getElementById('playerEmailDisplay');
  const playerLevelDisplay = document.getElementById('playerLevelDisplay');
  const playerAvatarDisplay = document.getElementById('playerAvatarDisplay');
  const playerXpDisplay = document.getElementById('playerXpDisplay');
  const playerFavoritesDisplay = document.getElementById('playerFavoritesDisplay');
  const playerHoursDisplay = document.getElementById('playerHoursDisplay');
  const editUsername = document.getElementById('editUsername');
  const editEmail = document.getElementById('editEmail');
  const editLevel = document.getElementById('editLevel');
  const editAvatar = document.getElementById('editAvatar');
  const levelLabel = document.querySelector('.info-item:nth-child(3) .info-label');
  const libraryGrid = document.getElementById('libraryGrid');
  const libraryEmptyMessage = document.getElementById('libraryEmptyMessage');

  const availableGames = [
    {
      name: 'Legends of Valor',
      img: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=900&q=90',
      alt: 'Legends of Valor',
      tags: ['RPG', 'Aventura'],
      rating: '4.9',
      category: 'rpg aventura'
    },
    {
      name: 'Battle Arena',
      img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=90',
      alt: 'Battle Arena',
      tags: ['Ação', 'Multijogador'],
      rating: '4.7',
      category: 'acao multiplayer'
    },
    {
      name: 'Speed Rush',
      img: 'https://images.unsplash.com/photo-1505682634904-d7c8d6309400?auto=format&fit=crop&w=900&q=90',
      alt: 'Speed Rush',
      tags: ['Corrida', 'Esportes'],
      rating: '4.8',
      category: 'corrida esportes'
    },
    {
      name: 'Shadow Quest',
      img: 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=900&q=90',
      alt: 'Shadow Quest',
      tags: ['Aventura', 'Quebra-Cabeça'],
      rating: '4.6',
      category: 'aventura quebra-cabeca'
    }
  ];

  function getLibraryNames() {
    return currentUser && Array.isArray(currentUser.library) ? currentUser.library : [];
  }

  function renderGameCard(game, isFavorite = false) {
    return `
      <article class="game-card" data-name="${game.name}" data-category="${game.category}">
        <img src="${game.img}" alt="${game.alt}">
        <button class="favorite ${isFavorite ? 'active' : ''}">${isFavorite ? '♥' : '♡'}</button>
        <div class="game-info">
          <h3 class="game-title">${game.name}</h3>
          <div class="meta">
            <div class="tags">${game.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
            <div class="rating"><span>★</span> ${game.rating}</div>
          </div>
        </div>
      </article>
    `;
  }

  async function updateLibrary(gameName, action, button) {
    if (!currentUser || !currentUser.email) {
      alert('Faça login para favoritar jogos');
      return;
    }

    try {
      const response = await fetch('/api/user/library', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: currentUser.email,
          game: gameName,
          action
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Erro ao atualizar biblioteca');
        return;
      }

      currentUser = data.user;
      localStorage.setItem('rivardosplay_user', JSON.stringify(currentUser));
      applyLibraryState();
      renderLibraryPage();
    } catch (error) {
      alert('Erro de conexão');
    }
  }

  function applyLibraryState() {
    const libraryNames = getLibraryNames();
    favorites.forEach(button => {
      const card = button.closest('.game-card');
      const gameName = card ? card.dataset.name : null;
      const isFav = gameName && libraryNames.includes(gameName);
      button.classList.toggle('active', Boolean(isFav));
      button.textContent = isFav ? '♥' : '♡';
    });

    if (playerFavoritesDisplay) {
      playerFavoritesDisplay.textContent = libraryNames.length;
    }
  }

  function renderLibraryPage() {
    if (!libraryGrid) return;
    const libraryNames = getLibraryNames();
    if (!libraryNames.length) {
      libraryGrid.innerHTML = '';
      if (libraryEmptyMessage) libraryEmptyMessage.style.display = 'block';
      return;
    }

    if (libraryEmptyMessage) libraryEmptyMessage.style.display = 'none';
    libraryGrid.innerHTML = libraryNames
      .map(name => {
        const game = availableGames.find(game => game.name === name);
        if (game) return game;
        return {
          name,
          img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=90',
          alt: name,
          tags: ['Favorito'],
          rating: '—',
          category: ''
        };
      })
      .map(game => renderGameCard(game, true))
      .join('');

    libraryGrid.querySelectorAll('.favorite').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const card = button.closest('.game-card');
        const gameName = card ? card.dataset.name : null;
        if (!gameName) return;
        updateLibrary(gameName, 'remove', button);
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.toLowerCase().trim();
      cards.forEach(card => {
        const name = card.dataset.name.toLowerCase();
        card.style.display = name.includes(term) ? 'block' : 'none';
      });
    });
  }

  categories.forEach(cat => {
    cat.addEventListener('click', () => {
      categories.forEach(item => item.classList.remove('active'));
      cat.classList.add('active');
      const filter = cat.dataset.filter;
      cards.forEach(card => {
        const category = card.dataset.category;
        const show = filter === 'all' || category.includes(filter);
        card.style.display = show ? 'block' : 'none';
      });
    });
  });

  favorites.forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const card = button.closest('.game-card');
      const gameName = card ? card.dataset.name : null;
      if (!gameName) return;
      const isFavorite = button.classList.contains('active');
      updateLibrary(gameName, isFavorite ? 'remove' : 'add', button);
    });
  });

  if (shuffleBtn && grid) {
    shuffleBtn.addEventListener('click', () => {
      const gameCards = cards.sort(() => Math.random() - 0.5);
      gameCards.forEach(card => grid.insertBefore(card, shuffleBtn));
    });
  }

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      authForms.forEach(form => {
        form.classList.toggle('active', form.id === target + 'Form');
      });
    });
  });

  let isEditing = false;
  let currentUser = null;

  function getRandomAvatar() {
    const avatars = ['🛡️', '⚔️', '🎯', '🏁', '🚩', '🎮', '💎', '👑', '🎪', '🚀', '👾', '👻'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  }

  function checkUserSession() {
    const user = localStorage.getItem('rivardosplay_user');
    if (!user) return;
    const userData = JSON.parse(user);

    if (userName) userName.textContent = userData.username;
    if (userLevel) userLevel.textContent = userData.level !== undefined ? userData.level : 0;
    if (userAvatar) userAvatar.textContent = userData.avatar || '🛡️';

    if (playerUsernameDisplay) playerUsernameDisplay.textContent = userData.username;
    if (playerEmailDisplay) playerEmailDisplay.textContent = userData.email || 'user@example.com';
    if (playerLevelDisplay) playerLevelDisplay.textContent = userData.level !== undefined ? userData.level : 0;
    if (playerAvatarDisplay) playerAvatarDisplay.textContent = userData.avatar || '🛡️';
    if (playerXpDisplay) playerXpDisplay.textContent = `${userData.xp || 0}/1500`;
    if (playerFavoritesDisplay) playerFavoritesDisplay.textContent = userData.favorites || 0;
    if (playerHoursDisplay) playerHoursDisplay.textContent = `${userData.hours_played || 0}h`;

    if (editUsername) editUsername.value = userData.username;

    currentUser = {
      ...userData,
      library: Array.isArray(userData.library) ? userData.library : []
    };
    if (adminLink) {
      adminLink.style.display = userData.role === 'admin' ? 'inline-flex' : 'none';
    }
    if (editEmail) editEmail.value = userData.email || '';
    if (editAvatar) editAvatar.value = userData.avatar || '🛡️';
    if (editFavorites) editFavorites.value = userData.favorites || 0;

    applyLibraryState();
    renderLibraryPage();

    if (userPanel) userPanel.style.display = 'flex';
    if (loginBtn) loginBtn.style.display = 'none';
  }

  function toggleEditMode() {
    isEditing = !isEditing;

    document.querySelectorAll('.display-value').forEach(el => {
      el.style.display = isEditing ? 'none' : 'inline';
    });
    document.querySelectorAll('.edit-input').forEach(el => {
      el.style.display = isEditing ? 'inline-block' : 'none';
    });

    if (editPlayerInfoBtn) editPlayerInfoBtn.textContent = isEditing ? 'Salvar Alterações' : 'Editar';
    if (editLevel) {
      editLevel.disabled = isEditing;
      editLevel.style.display = 'none';
    }
    if (levelLabel) levelLabel.style.display = isEditing ? 'none' : 'inline';
  }

  if (userInfoClickable && playerInfoPanel) {
    userInfoClickable.addEventListener('click', () => {
      playerInfoPanel.classList.toggle('active');
      if (isEditing) toggleEditMode();
    });
  }

  if (closePlayerInfo && playerInfoPanel) {
    closePlayerInfo.addEventListener('click', () => {
      playerInfoPanel.classList.remove('active');
      if (isEditing) toggleEditMode();
    });
  }

  document.addEventListener('click', (e) => {
    if (playerInfoPanel && userInfoClickable && !playerInfoPanel.contains(e.target) && !userInfoClickable.contains(e.target)) {
      playerInfoPanel.classList.remove('active');
      if (isEditing) toggleEditMode();
    }
  });

  if (editPlayerInfoBtn) {
    editPlayerInfoBtn.addEventListener('click', toggleEditMode);
  }

  if (savePlayerInfoBtn) {
    savePlayerInfoBtn.addEventListener('click', async () => {
      if (!isEditing || !editUsername || !editEmail || !playerLevelDisplay) return;

      const updatedUser = {
        email: currentUser.email,
        username: editUsername.value.trim(),
        avatar: editAvatar ? editAvatar.value : '🛡️'
      };

      if (!updatedUser.username) {
        alert('Nome de usuário é obrigatório');
        return;
      }

      if (!updatedUser.email || !updatedUser.email.includes('@')) {
        alert('Email válido é obrigatório');
        return;
      }

      try {
        const response = await fetch('/api/user/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedUser)
        });

        const data = await response.json();
        
        if (!response.ok) {
          alert(data.error || 'Erro ao salvar alterações');
          return;
        }

        // Update localStorage with server response
        localStorage.setItem('rivardosplay_user', JSON.stringify(data.user));
        currentUser = data.user;
        checkUserSession();
        toggleEditMode();

        savePlayerInfoBtn.textContent = 'Salvo!';
        setTimeout(() => {
          savePlayerInfoBtn.textContent = 'Salvar';
        }, 1000);
      } catch (error) {
        alert('Erro de conexão');
      }
    });
  }

  if (cancelEditPlayerInfoBtn && playerInfoPanel) {
    cancelEditPlayerInfoBtn.addEventListener('click', () => {
      if (isEditing) toggleEditMode();
      playerInfoPanel.classList.remove('active');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('rivardosplay_user');
      if (userPanel) userPanel.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (playerInfoPanel) playerInfoPanel.classList.remove('active');
      location.reload();
    });
  }

  function renderAdminPage() {
    const adminMessage = document.getElementById('adminMessage');
    const adminUsersTable = document.getElementById('adminUsersTable');
    const refreshUsersBtn = document.getElementById('refreshUsers');

    if (!adminMessage || !adminUsersTable) return;
    if (!currentUser || currentUser.role !== 'admin') {
      adminMessage.textContent = 'Apenas administradores podem acessar esta página.';
      return;
    }

    async function loadAdminUsers() {
      adminMessage.textContent = 'Carregando usuários...';
      try {
        const response = await fetch(`/api/admin/users?email=${encodeURIComponent(currentUser.email)}`);
        const data = await response.json();
        if (!response.ok) {
          adminMessage.textContent = data.error || 'Não foi possível carregar os usuários';
          return;
        }

        adminMessage.textContent = '';
        adminUsersTable.innerHTML = '';
        data.forEach(user => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.level}</td>
            <td>${user.xp}</td>
            <td>${user.favorites || 0}</td>
            <td>${user.hours_played || 0}</td>
            <td>${user.role}</td>
            <td>${user.created_at}</td>
            <td>${user.role === 'admin' ? '—' : `<button class="btn btn-ghost admin-delete" data-id="${user.id}">Apagar</button>`}</td>
          `;
          adminUsersTable.appendChild(row);
        });

        adminUsersTable.querySelectorAll('.admin-delete').forEach(button => {
          button.addEventListener('click', async () => {
            const userId = button.dataset.id;
            if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
            const deleteResponse = await fetch(`/api/admin/users/${userId}?email=${encodeURIComponent(currentUser.email)}`, {
              method: 'DELETE'
            });
            const deleteData = await deleteResponse.json();
            if (!deleteResponse.ok) {
              alert(deleteData.error || 'Erro ao excluir usuário');
              return;
            }
            alert(deleteData.message);
            loadAdminUsers();
          });
        });
      } catch (error) {
        adminMessage.textContent = 'Erro de conexão';
      }
    }

    if (refreshUsersBtn) {
      refreshUsersBtn.addEventListener('click', loadAdminUsers);
    }

    loadAdminUsers();
  }

  checkUserSession();

  if (window.location.pathname.endsWith('admin.html')) {
    renderAdminPage();
  }

  // Login form handler
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginMessage = document.getElementById('loginMessage');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      
      if (!email || !password) {
        if (loginMessage) loginMessage.textContent = 'Preencha todos os campos';
        return;
      }
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Save user data to localStorage
          localStorage.setItem('rivardosplay_user', JSON.stringify(data.user));
          
          if (loginMessage) loginMessage.textContent = 'Login realizado com sucesso!';
          
          // Redirect to home page after successful login
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 1000);
        } else {
          if (loginMessage) loginMessage.textContent = data.error || 'Erro no login';
        }
      } catch (error) {
        if (loginMessage) loginMessage.textContent = 'Erro de conexão';
      }
    });
  }

  // Register form handler
  const registerForm = document.getElementById('registerForm');
  const registerUsername = document.getElementById('regUsername');
  const registerEmail = document.getElementById('regEmail');
  const registerPassword = document.getElementById('regPassword');
  const registerConfirmPassword = document.getElementById('regConfirmPassword');
  const registerMessage = document.getElementById('registerMessage');

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = registerUsername.value.trim();
      const email = registerEmail.value.trim();
      const password = registerPassword.value;
      const confirmPassword = registerConfirmPassword.value;
      
      if (!username || !email || !password || !confirmPassword) {
        if (registerMessage) registerMessage.textContent = 'Preencha todos os campos';
        return;
      }
      
      if (password !== confirmPassword) {
        if (registerMessage) registerMessage.textContent = 'As senhas não coincidem';
        return;
      }
      
      if (password.length < 6) {
        if (registerMessage) registerMessage.textContent = 'A senha deve ter pelo menos 6 caracteres';
        return;
      }
      
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          if (registerMessage) registerMessage.textContent = 'Conta criada com sucesso!';
          
          // Redirect to login page after successful registration
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1000);
        } else {
          if (registerMessage) registerMessage.textContent = data.error || 'Erro no registro';
        }
      } catch (error) {
        if (registerMessage) registerMessage.textContent = 'Erro de conexão';
      }
    });
  }
});
