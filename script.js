document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const categories = [...document.querySelectorAll(".cat")];
  const shuffleBtn = document.getElementById("shuffleBtn");
  const grid = document.getElementById("gamesGrid");
  const userPanel = document.getElementById("userPanel");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminLink = document.getElementById("adminLink");
  const userName = document.getElementById("userName");
  const userLevel = document.getElementById("userLevel");
  const userAvatar = document.getElementById("userAvatar");
  const userInfoClickable = document.getElementById("userInfoClickable");
  const playerInfoPanel = document.getElementById("playerInfoPanel");
  const closePlayerInfo = document.getElementById("closePlayerInfo");
  const editPlayerInfoBtn = document.getElementById("editPlayerInfo");
  const savePlayerInfoBtn = document.getElementById("savePlayerInfo");
  const cancelEditPlayerInfoBtn = document.getElementById("cancelEditPlayerInfo");
  const playerUsernameDisplay = document.getElementById("playerUsernameDisplay");
  const playerEmailDisplay = document.getElementById("playerEmailDisplay");
  const playerLevelDisplay = document.getElementById("playerLevelDisplay");
  const playerAvatarDisplay = document.getElementById("playerAvatarDisplay");
  const playerXpDisplay = document.getElementById("playerXpDisplay");
  const playerFavoritesDisplay = document.getElementById("playerFavoritesDisplay");
  const playerHoursDisplay = document.getElementById("playerHoursDisplay");
  const editUsername = document.getElementById("editUsername");
  const editEmail = document.getElementById("editEmail");
  const editAvatar = document.getElementById("editAvatar");
  const libraryGrid = document.getElementById("libraryGrid");
  const libraryEmptyMessage = document.getElementById("libraryEmptyMessage");

  let currentUser = null;
  let allGames = [];

  async function loadGames() {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) throw new Error("Falha ao carregar jogos");
      allGames = await response.json();
      renderGames(allGames);
      if (shuffleBtn) setupShuffle();
    } catch (error) {
      console.error("Error loading games:", error);
      if (grid) grid.innerHTML = "<p style='color:red;'>Erro ao carregar jogos.</p>";
    }
  }

  function renderGames(games) {
    if (!grid) return;
    const libraryNames = getLibraryNames();
    const isAdmin = currentUser && currentUser.role === "admin";

    grid.innerHTML = games.map(game => {
      const isFav = libraryNames.includes(game.name);
      return renderGameCard(game, isFav, isAdmin);
    }).join("");

    grid.querySelectorAll(".favorite").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (!currentUser) { alert("Faça login"); return; }
        const card = btn.closest(".game-card");
        const gameName = card?.dataset.name;
        if (!gameName) return;
        const adding = !btn.classList.contains("active");
        await updateLibrary(gameName, adding ? "add" : "remove", btn);
      };
    });

    if (isAdmin) {
      grid.querySelectorAll(".admin-edit").forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); openGameModal(btn.dataset.id); };
      });
      grid.querySelectorAll(".admin-delete").forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          if (!confirm("Excluir jogo?")) return;
          await deleteGame(btn.dataset.id);
        };
      });
    }
    // Clique no card para abrir embed
    grid.querySelectorAll(".game-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".favorite") || e.target.closest(".admin-edit") || e.target.closest(".admin-delete")) return;
        const gameId = card.dataset.id;
        const game = allGames.find(g => g.id == gameId || g.name === card.dataset.name);
        if (game?.embed) {
          openEmbedModal(game.embed, game.name);
        }
      });
    });

  }

  function renderGameCard(game, isFavorite = false, showAdmin = false) {
    const adminControls = showAdmin ? `
      <div class="admin-controls">
        <button class="admin-edit btn btn-ghost" data-id="${game.id}" title="Editar">✏️</button>
        <button class="admin-delete btn btn-ghost" data-id="${game.id}" title="Excluir">🗑️</button>
      </div>
    ` : '';
    const embedHtml = game.embed ? `<div class="game-embed" style="margin-top:0.5rem;">${game.embed}</div>` : '';
    return `
      <article class="game-card" data-id="${game.id}" data-name="${game.name}" data-category="${game.category || ''}">
        <img src="${game.image_url}" alt="${game.alt_text || game.name}">
        <button class="favorite ${isFavorite ? "active" : ""}">${isFavorite ? "♥" : "♡"}</button>
        ${adminControls}
        <div class="game-info">
          <h3 class="game-title">${game.name}</h3>
          <div class="meta">
            <div class="tags">${(game.tags || []).map(t => `<span class="tag">${t}</span>`).join("")}</div>
            <div class="rating"><span>★</span> ${game.rating || 0}</div>
          </div>
          
        </div>
      </article>
    `;
  }

  function setupShuffle() {
    if (!shuffleBtn || !grid) return;
    shuffleBtn.onclick = () => {
      const shuffled = [...allGames].sort(() => Math.random() - 0.5);
      renderGames(shuffled);
    };
  }

  function getLibraryNames() {
    return currentUser && Array.isArray(currentUser.library) ? currentUser.library : [];
  }

  async function updateLibrary(gameName, action, button) {
    if (!currentUser) { alert("Faça login para favoritar jogos"); return; }
    try {
      const response = await fetch("/api/user/library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, game: gameName, action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar biblioteca");
      currentUser = data.user;
      localStorage.setItem("rivardosplay_user", JSON.stringify(currentUser));
      applyLibraryState();
      renderLibraryPage();
    } catch (error) { alert(error.message); }
  }

  function applyLibraryState() {
    const libraryNames = getLibraryNames();
    document.querySelectorAll(".favorite").forEach(btn => {
      const card = btn.closest(".game-card");
      const name = card?.dataset.name;
      const isFav = name && libraryNames.includes(name);
      btn.classList.toggle("active", isFav);
      btn.textContent = isFav ? "♥" : "♡";
    });
    if (playerFavoritesDisplay) playerFavoritesDisplay.textContent = libraryNames.length;
  }

  function renderLibraryPage() {
    if (!libraryGrid) return;
    const libraryNames = getLibraryNames();
    if (!libraryNames.length) {
      libraryGrid.innerHTML = "";
      if (libraryEmptyMessage) libraryEmptyMessage.style.display = "block";
      return;
    }
    if (libraryEmptyMessage) libraryEmptyMessage.style.display = "none";
    libraryGrid.innerHTML = libraryNames.map(name => {
      const game = allGames.find(g => g.name === name) || {
        name, image_url: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=90",
        alt_text: name, tags: ["Favorito"], rating: "—", category: ""
      };
      return renderGameCard(game, true);
    }).join("");

    libraryGrid.querySelectorAll(".favorite").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const card = btn.closest(".game-card");
        const name = card?.dataset.name;
        if (!name) return;
        await updateLibrary(name, "remove", btn);
      };
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase().trim();
      const filtered = allGames.filter(g => g.name.toLowerCase().includes(term));
      renderGames(filtered);
    });
  }

  categories.forEach(cat => {
    cat.addEventListener("click", () => {
      categories.forEach(c => c.classList.remove("active"));
      cat.classList.add("active");
      const filter = cat.dataset.filter;
      const filtered = filter === "all" ? allGames : allGames.filter(g => g.category && g.category.includes(filter));
      renderGames(filtered);
    });
  });

  function checkUserSession() {
    const user = localStorage.getItem("rivardosplay_user");
    if (!user) return;
    const userData = JSON.parse(user);
    currentUser = { ...userData, library: Array.isArray(userData.library) ? userData.library : [] };

    if (userName) userName.textContent = userData.username;
    if (userLevel) userLevel.textContent = userData.level ?? 0;
    if (userAvatar) userAvatar.textContent = userData.avatar || "🛡️";
    if (playerUsernameDisplay) playerUsernameDisplay.textContent = userData.username;
    if (playerEmailDisplay) playerEmailDisplay.textContent = userData.email || "";
    if (playerLevelDisplay) playerLevelDisplay.textContent = userData.level ?? 0;
    if (playerAvatarDisplay) playerAvatarDisplay.textContent = userData.avatar || "🛡️";
    if (playerXpDisplay) playerXpDisplay.textContent = `${userData.xp || 0}/1500`;
    if (playerFavoritesDisplay) playerFavoritesDisplay.textContent = userData.favorites || 0;
    if (playerHoursDisplay) playerHoursDisplay.textContent = `${userData.hours_played || 0}h`;
    if (editUsername) editUsername.value = userData.username;
    if (editEmail) editEmail.value = userData.email || "";
    if (editAvatar) editAvatar.value = userData.avatar || "🛡️";
    if (adminLink) adminLink.style.display = userData.role === "admin" ? "inline-flex" : "none";

    applyLibraryState();
    renderLibraryPage();

    if (userPanel) userPanel.style.display = "flex";
    if (loginBtn) loginBtn.style.display = "none";
  }

  let isEditingProfile = false;
  function toggleEditMode() {
    isEditingProfile = !isEditingProfile;
    document.querySelectorAll(".display-value").forEach(el => el.style.display = isEditingProfile ? "none" : "inline");
    document.querySelectorAll(".edit-input").forEach(el => el.style.display = isEditingProfile ? "inline-block" : "none");
    if (editPlayerInfoBtn) editPlayerInfoBtn.textContent = isEditingProfile ? "Salvar Alterações" : "Editar";
  }

  if (userInfoClickable && playerInfoPanel) {
    userInfoClickable.addEventListener("click", () => {
      playerInfoPanel.classList.toggle("active");
      if (isEditingProfile) toggleEditMode();
    });
  }

  if (closePlayerInfo && playerInfoPanel) {
    closePlayerInfo.addEventListener("click", () => {
      playerInfoPanel.classList.remove("active");
      if (isEditingProfile) toggleEditMode();
    });
  }

  document.addEventListener("click", (e) => {
    if (playerInfoPanel && userInfoClickable && !playerInfoPanel.contains(e.target) && !userInfoClickable.contains(e.target)) {
      playerInfoPanel.classList.remove("active");
      if (isEditingProfile) toggleEditMode();
    }
  });

  if (editPlayerInfoBtn) editPlayerInfoBtn.addEventListener("click", toggleEditMode);

  if (savePlayerInfoBtn) {
    savePlayerInfoBtn.addEventListener("click", async () => {
      if (!isEditingProfile || !editUsername || !editEmail) return;
      const updatedUser = { email: currentUser.email, username: editUsername.value.trim(), avatar: editAvatar ? editAvatar.value : "🛡️" };
      if (!updatedUser.username) { alert("Nome de usuário é obrigatório"); return; }
      if (!updatedUser.email || !updatedUser.email.includes("@")) { alert("Email válido é obrigatório"); return; }

      try {
        const response = await fetch("/api/user/update", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedUser) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao salvar alterações");

        localStorage.setItem("rivardosplay_user", JSON.stringify(data.user));
        currentUser = data.user;
        checkUserSession();
        toggleEditMode();
        savePlayerInfoBtn.textContent = "Salvo!";
        setTimeout(() => savePlayerInfoBtn.textContent = "Salvar", 1000);
      } catch (error) { alert(error.message); }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("rivardosplay_user");
      if (userPanel) userPanel.style.display = "none";
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (playerInfoPanel) playerInfoPanel.classList.remove("active");
      location.reload();
    });
  }

  // ==================== MODAL ====================

  let gameModal = null;

  function createGameModal() {
    if (gameModal) return;
    gameModal = document.createElement("div");
    gameModal.id = "gameModal";
    gameModal.style.cssText = "display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;align-items:center;justify-content:center;";
    gameModal.innerHTML = `
      <div style="background:var(--bg-card);padding:2rem;border-radius:12px;max-width:500px;width:90%;">
        <h2 style="margin-bottom:1rem;">Editar Jogo</h2>
        <form id="gameForm">
          <input type="hidden" id="gameId">
          <div style="margin-bottom:1rem;">
            <label style="display:block;margin-bottom:0.5rem;">Nome</label>
            <input type="text" id="gameName" required style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block;margin-bottom:0.5rem;">URL da Imagem</label>
            <input type="url" id="gameImage" required placeholder="https://exemplo.com/imagem.jpg" style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block;margin-bottom:0.5rem;">Alt Text</label>
            <input type="text" id="gameAlt" style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block;margin-bottom:0.5rem;">Tags (separadas por vírgula)</label>
            <input type="text" id="gameTags" style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block;margin-bottom:0.5rem;">Rating</label>
            <input type="number" id="gameRating" step="0.1" min="0" max="5" style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block;margin-bottom:0.5rem;">Categoria</label>
            <input type="text" id="gameCategory" style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block;margin-bottom:0.5rem;">Embed (iframe/código HTML)</label>
            <textarea id="gameEmbed" rows="3" placeholder="<iframe src=&quot;...&quot;></iframe>" style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;resize:vertical;min-height:80px;"></textarea>
          </div>
          <div style="display:flex;gap:1rem;justify-content:flex-end;">
            <button type="button" id="cancelGame" class="btn btn-ghost">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(gameModal);
    document.getElementById("cancelGame").onclick = closeGameModal;
    document.getElementById("gameForm").onsubmit = async (e) => { e.preventDefault(); await saveGame(); };
    gameModal.addEventListener("click", (e) => { if (e.target === gameModal) closeGameModal(); });
  }


  // Modal para exibir embed em tela cheia
  let embedModal = null;

  function createEmbedModal() {
    if (embedModal) return;
    embedModal = document.createElement('div');
    embedModal.id = 'embedModal';
    embedModal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:2000;align-items:center;justify-content:center;';
    embedModal.innerHTML = `
      <div style="position:relative;width:95vw;height:95vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <button id="closeEmbedModal" style="position:absolute;top:10px;right:20px;background:none;border:none;color:white;font-size:3rem;cursor:pointer;z-index:10;">&times;</button>
        <h2 id="embedGameName" style="color:white;margin-bottom:1rem;text-align:center;"></h2>
        <div id="embedContainer" style="width:100%;height:calc(100% - 60px);display:flex;align-items:center;justify-content:center;overflow:auto;"></div>
      </div>
    `;
    document.body.appendChild(embedModal);
    document.getElementById('closeEmbedModal').onclick = closeEmbedModal;
    embedModal.addEventListener('click', (e) => {
      if (e.target === embedModal) closeEmbedModal();
    });
  }

  function openEmbedModal(embedHtml, gameName) {
    createEmbedModal();
    const container = document.getElementById('embedContainer');
    const title = document.getElementById('embedGameName');
    title.textContent = gameName;
    // Adicionar sandbox ao iframe para segurança
    const sanitized = embedHtml.replace(/<iframe/gi, '<iframe sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"');
    container.innerHTML = sanitized;
    embedModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeEmbedModal() {
    if (embedModal) embedModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function openGameModal(gameId = null) {
    createGameModal();
    gameModal.style.display = "flex";
    if (gameId) {
      const game = allGames.find(g => g.id == gameId);
      if (game) {
        document.getElementById("gameId").value = game.id;
        document.getElementById("gameName").value = game.name;
        document.getElementById("gameImage").value = game.image_url;
        document.getElementById("gameAlt").value = game.alt_text || game.name;
        document.getElementById("gameTags").value = (game.tags || []).join(", ");
        document.getElementById("gameRating").value = game.rating || 0;
        document.getElementById("gameCategory").value = game.category || "";
        document.getElementById("gameEmbed").value = game.embed || "";
      }
    } else {
      document.getElementById("gameForm").reset();
      document.getElementById("gameId").value = "";
    }
  }

  function closeGameModal() { if (gameModal) gameModal.style.display = "none"; }

  async function saveGame() {
    const id = document.getElementById("gameId").value;
    const name = document.getElementById("gameName").value;
    let image_url = document.getElementById("gameImage").value.trim();
    const alt_text = document.getElementById("gameAlt").value || name;
    const tags = document.getElementById("gameTags").value.split(",").map(t => t.trim()).filter(t => t);
    const rating = parseFloat(document.getElementById("gameRating").value) || 0;
    const category = document.getElementById("gameCategory").value;
    const embed = document.getElementById("gameEmbed").value.trim();
    try { image_url = encodeURI(image_url); } catch (e) {}

    const email = currentUser?.email || "";
    const query = email ? `?email=${encodeURIComponent(email)}` : "";

    try {
      const response = await fetch(id ? `/api/games/${id}${query}` : `/api/games${query}`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image_url, alt_text, tags, rating, category, embed })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao salvar jogo");
      closeGameModal();
      await loadGames();
      await loadAdminGames?.();
      alert("Jogo salvo com sucesso!");
    } catch (error) { alert(error.message); }
  }

  async function deleteGame(gameId) {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/games/${gameId}?email=${encodeURIComponent(currentUser.email)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao excluir jogo");
      await loadGames();
      await loadAdminGames?.();
      alert("Jogo excluído!");
    } catch (error) { alert(error.message); }
  }

  // ==================== ADMIN PAGE ====================

  function renderAdminPage() {
    const usersSection = document.getElementById("usersAdminSection");
    const gamesSection = document.getElementById("gamesAdminSection");
    const noAccess = document.getElementById("noAdminAccess");
    if (!usersSection || !gamesSection || !noAccess) return;

    if (!currentUser || currentUser.role !== "admin") {
      usersSection.style.display = "none";
      gamesSection.style.display = "none";
      noAccess.style.display = "block";
      return;
    }

    usersSection.style.display = "block";
    gamesSection.style.display = "block";
    noAccess.style.display = "none";

    loadAdminUsers();
    loadAdminGames();
  }

  async function loadAdminUsers() {
    const tbody = document.getElementById("adminUsersTable");
    if (!tbody) return;
    try {
      const response = await fetch(`/api/admin/users?email=${encodeURIComponent(currentUser.email)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar usuários");

      tbody.innerHTML = data.map(u => `
        <tr>
          <td>${u.id}</td><td>${u.username}</td><td>${u.email}</td><td>${u.level}</td>
          <td>${u.xp}</td><td>${u.favorites || 0}</td><td>${u.hours_played || 0}</td>
          <td>${u.role}</td><td>${u.created_at}</td>
          <td>${u.role === "admin" ? "—" : `<button class="btn btn-ghost admin-delete-user" data-id="${u.id}">Apagar</button>`}</td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".admin-delete-user").forEach(btn => {
        btn.onclick = async () => {
          if (!confirm("Excluir usuário?")) return;
          const res = await fetch(`/api/admin/users/${btn.dataset.id}?email=${encodeURIComponent(currentUser.email)}`, { method: "DELETE" });
          const json = await res.json();
          if (!res.ok) alert(json.error || "Erro");
          else { alert(json.message); loadAdminUsers(); }
        };
      });
    } catch (error) { console.error(error); }
  }

  async function loadAdminGames() {
    const container = document.getElementById("adminGamesList");
    if (!container) return;
    try {
      const response = await fetch("/api/games");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar jogos");

      let html = data.map(g => `
        <div class="admin-game-item" style="display:flex;align-items:center;gap:1rem;padding:0.5rem;background:var(--bg-card);margin-bottom:0.5rem;border-radius:8px;">
          <img src="${g.image_url}" alt="${g.alt_text}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">
          <div style="flex:1;">
            <strong style="font-size:1.1rem;">${g.name}</strong><br>
            <small>${(g.tags || []).join(", ")}</small>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-primary" onclick="window.openGameModal(${g.id})" style="padding:0.5rem 1rem;">✏️ Editar</button>
            <button class="btn btn-ghost" onclick="window.deleteGame(${g.id})" style="color:#ff4444;">🗑️ Excluir</button>
          </div>
        </div>
      `).join("");

      html += `
        <div onclick="window.openGameModal()" class="admin-game-item" style="display:flex;align-items:center;gap:1rem;padding:2rem;background:var(--bg-card);margin-top:1rem;border-radius:12px;border:2px dashed var(--border);cursor:pointer;transition:all 0.2s;"
             onmouseover="this.style.borderColor='var(--purple)';this.style.background='var(--bg-card-hover)'"
             onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg-card)'">
          <div style="width:60px;height:60px;background:var(--bg-input);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem;">+</div>
          <div style="flex:1;">
            <strong style="font-size:1.1rem;">Adicionar Novo Jogo</strong><br>
            <small>Clique para abrir o formulário</small>
          </div>
        </div>
      `;

      container.innerHTML = html;
    } catch (error) {
      container.innerHTML = `<p style="color:var(--muted)">Erro ao carregar jogos</p>`;
    }
  }

  window.openGameModal = openGameModal;
  window.deleteGame = deleteGame;
  window.loadAdminUsers = loadAdminUsers;
  window.loadAdminGames = loadAdminGames;

  const refreshUsersBtn = document.getElementById("refreshUsers");
  if (refreshUsersBtn) refreshUsersBtn.addEventListener("click", loadAdminUsers);
  const refreshGamesBtn = document.getElementById("refreshGames");
  if (refreshGamesBtn) refreshGamesBtn.addEventListener("click", loadAdminGames);

  // ==================== LOGIN ====================

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      if (!email || !password) {
        document.getElementById("loginMessage").textContent = "Preencha todos os campos";
        return;
      }
      try {
        const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem("rivardosplay_user", JSON.stringify(data.user));
          document.getElementById("loginMessage").style.color = "#00ff00";
          document.getElementById("loginMessage").textContent = "Login realizado com sucesso!";
          setTimeout(() => window.location.href = "index.html", 1000);
        } else {
          document.getElementById("loginMessage").style.color = "#ff4444";
          document.getElementById("loginMessage").textContent = data.error || "Erro no login";
        }
      } catch (error) {
        document.getElementById("loginMessage").style.color = "#ff4444";
        document.getElementById("loginMessage").textContent = "Erro de conexão";
      }
    });
  }

  // ==================== REGISTRO ====================

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("regUsername").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;
      const confirmPassword = document.getElementById("regConfirmPassword").value;

      if (!username || !email || !password || !confirmPassword) {
        document.getElementById("registerMessage").textContent = "Preencha todos os campos";
        return;
      }
      if (password !== confirmPassword) {
        document.getElementById("registerMessage").textContent = "As senhas não coincidem";
        return;
      }
      if (password.length < 6) {
        document.getElementById("registerMessage").textContent = "A senha deve ter pelo menos 6 caracteres";
        return;
      }

      try {
        const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, email, password }) });
        const data = await response.json();
        if (response.ok) {
          document.getElementById("registerMessage").style.color = "#00ff00";
          document.getElementById("registerMessage").textContent = "Conta criada com sucesso!";
          setTimeout(() => window.location.href = "login.html", 1000);
        } else {
          document.getElementById("registerMessage").style.color = "#ff4444";
          document.getElementById("registerMessage").textContent = data.error || "Erro no registro";
        }
      } catch (error) {
        document.getElementById("registerMessage").style.color = "#ff4444";
        document.getElementById("registerMessage").textContent = "Erro de conexão";
      }
    });
  }

  // ==================== INICIALIZAÇÃO ====================

  checkUserSession();
  loadGames();

  // Se estiver na página admin, renderizar painel admin
  if (window.location.pathname.endsWith('admin.html') || window.location.pathname === '/admin') {
    renderAdminPage();
  }
});













