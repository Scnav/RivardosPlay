document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const categories = [...document.querySelectorAll(".cat")];
  const shuffleBtn = document.getElementById("shuffleBtn");
  const grid = document.getElementById("gamesGrid");
  const libraryGrid = document.getElementById("libraryGrid");
  const libraryEmptyMessage = document.getElementById("libraryEmptyMessage");
  const userPanel = document.getElementById("userPanel");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminLink = document.getElementById("adminLink");
  const userName = document.getElementById("userName");
  const userLevel = document.getElementById("userLevel");
  const userAvatar = document.getElementById("userAvatar");
  const userInfoClickable = document.getElementById("userInfoClickable");
  let playerInfoPanel = document.getElementById("playerInfoPanel");
  let closePlayerInfo = document.getElementById("closePlayerInfo");
  let editPlayerInfoBtn = document.getElementById("editPlayerInfo");
  let savePlayerInfoBtn = document.getElementById("savePlayerInfo");
  let cancelEditPlayerInfoBtn = document.getElementById("cancelEditPlayerInfo");
  let playerUsernameDisplay = document.getElementById("playerUsernameDisplay");
  let playerEmailDisplay = document.getElementById("playerEmailDisplay");
  let playerLevelDisplay = document.getElementById("playerLevelDisplay");
  let playerAvatarDisplay = document.getElementById("playerAvatarDisplay");
  let playerXpDisplay = document.getElementById("playerXpDisplay");
  let playerFavoritesDisplay = document.getElementById("playerFavoritesDisplay");
  let playerHoursDisplay = document.getElementById("playerHoursDisplay");
  let editUsername = document.getElementById("editUsername");
  let editEmail = document.getElementById("editEmail");
  let editAvatar = document.getElementById("editAvatar");

  let currentUser = null;
  let allGames = [];
  let activeGameSession = null;
  let authToken = "";

  function getAuthHeaders(extra = {}) {
    const headers = { ...extra };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    return headers;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensurePlayerInfoPanel() {
    if (!userInfoClickable) return;
    if (playerInfoPanel) return;

    const panel = document.createElement("div");
    panel.className = "player-info-panel";
    panel.id = "playerInfoPanel";
    panel.innerHTML = `
      <div class="player-info-header">
        <h3>Informações do Jogador</h3>
        <div class="header-actions">
          <button id="editPlayerInfo" class="edit-btn">Editar</button>
          <button id="closePlayerInfo" class="close-btn">×</button>
        </div>
      </div>
      <div class="player-info-content">
        <div class="info-item">
          <span class="info-label">Nome de Usuário:</span>
          <span class="info-value display-value" id="playerUsernameDisplay"></span>
          <input type="text" class="edit-input" id="editUsername" placeholder="Nome de usuário" />
        </div>
        <div class="info-item">
          <span class="info-label">Email:</span>
          <span class="info-value display-value" id="playerEmailDisplay"></span>
          <input type="email" class="edit-input" id="editEmail" placeholder="Email" />
        </div>
        <div class="info-item">
          <span class="info-label">Nível:</span>
          <span class="info-value display-value" id="playerLevelDisplay"></span>
        </div>
        <div class="info-item">
          <span class="info-label">Avatar:</span>
          <span class="info-value display-value" id="playerAvatarDisplay"></span>
          <select class="edit-input" id="editAvatar">
            <option value="🛡️">🛡️ Escudo</option>
            <option value="⚔️">⚔️ Espada</option>
            <option value="🎯">🎯 Alvo</option>
            <option value="🏁">🏁 Bandeira</option>
            <option value="🚩">🚩 Sinal</option>
            <option value="🎮">🎮 Controle</option>
            <option value="💎">💎 Diamante</option>
            <option value="👑">👑 Coroa</option>
            <option value="🎪">🎪 Palhaço</option>
            <option value="🚀">🚀 Foguete</option>
            <option value="👾">👾 Alienígena</option>
            <option value="👻">👻 Fantasma</option>
          </select>
        </div>
        <div class="info-item">
          <span class="info-label">XP Atual:</span>
          <span class="info-value display-value" id="playerXpDisplay">0/1500</span>
        </div>
        <div class="info-item">
          <span class="info-label">Jogos Favoritos:</span>
          <span class="info-value display-value" id="playerFavoritesDisplay"></span>
        </div>
        <div class="info-item">
          <span class="info-label">Horas Jogadas:</span>
          <span class="info-value display-value" id="playerHoursDisplay"></span>
        </div>
      </div>
      <div class="player-info-footer">
        <button id="savePlayerInfo" class="btn btn-primary">Salvar</button>
        <button id="cancelEditPlayerInfo" class="btn btn-ghost">Cancelar</button>
      </div>
    `;

    document.body.appendChild(panel);

    playerInfoPanel = document.getElementById("playerInfoPanel");
    closePlayerInfo = document.getElementById("closePlayerInfo");
    editPlayerInfoBtn = document.getElementById("editPlayerInfo");
    savePlayerInfoBtn = document.getElementById("savePlayerInfo");
    cancelEditPlayerInfoBtn = document.getElementById("cancelEditPlayerInfo");
    playerUsernameDisplay = document.getElementById("playerUsernameDisplay");
    playerEmailDisplay = document.getElementById("playerEmailDisplay");
    playerLevelDisplay = document.getElementById("playerLevelDisplay");
    playerAvatarDisplay = document.getElementById("playerAvatarDisplay");
    playerXpDisplay = document.getElementById("playerXpDisplay");
    playerFavoritesDisplay = document.getElementById("playerFavoritesDisplay");
    playerHoursDisplay = document.getElementById("playerHoursDisplay");
    editUsername = document.getElementById("editUsername");
    editEmail = document.getElementById("editEmail");
    editAvatar = document.getElementById("editAvatar");
  }

  async function loadGames() {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) throw new Error("Falha ao carregar jogos");
      allGames = await response.json();
      updateCategoryCounts(allGames);
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

    attachCardEvents(grid);
    if (isAdmin) attachAdminEvents(grid);
  }

  async function loadLibraryGames() {
    if (!currentUser || !libraryGrid) return;
    try {
      const response = await fetch("/api/games");
      if (!response.ok) throw new Error("Falha ao carregar jogos");
      const allGamesData = await response.json();
      const libraryNames = getLibraryNames();
      const libraryGames = allGamesData.filter(g => libraryNames.includes(g.name));
      renderLibraryGames(libraryGames);
    } catch (error) {
      console.error("Error loading library:", error);
      if (libraryGrid) libraryGrid.innerHTML = "<p style='color:red;'>Erro ao carregar biblioteca.</p>";
      if (libraryEmptyMessage) libraryEmptyMessage.style.display = "none";
    }
  }

  function renderLibraryGames(games) {
    if (!libraryGrid) return;

    if (!games.length) {
      libraryGrid.innerHTML = "";
      if (libraryEmptyMessage) libraryEmptyMessage.style.display = "block";
      return;
    }

    if (libraryEmptyMessage) libraryEmptyMessage.style.display = "none";
    libraryGrid.innerHTML = games.map(game => renderGameCard(game, true, false)).join("");
    attachCardEvents(libraryGrid);
  }

  function renderGameCard(game, isFavorite = false, showAdmin = false) {
    const safeName = escapeHtml(game.name);
    const safeImage = escapeHtml(game.image_url);
    const safeAlt = escapeHtml(game.alt_text || game.name);
    const safeCategory = escapeHtml(game.category || "");
    const adminControls = showAdmin ? `
      <div class="admin-controls">
        <button class="admin-edit btn btn-ghost" data-id="${game.id}" title="Editar">✏️</button>
        <button class="admin-delete btn btn-ghost" data-id="${game.id}" title="Excluir">🗑️</button>
      </div>
    ` : '';
    return `
      <article class="game-card" data-id="${game.id}" data-name="${safeName}" data-category="${safeCategory}">
        <img src="${safeImage}" alt="${safeAlt}">
        <button class="favorite ${isFavorite ? "active" : ""}">${isFavorite ? "♥" : "♡"}</button>
        ${adminControls}
        <div class="game-info">
          <h3 class="game-title">${safeName}</h3>
          <div class="meta">
            <div class="tags">${(game.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
            <div class="rating"><span>★</span> ${game.rating || 0}</div>
          </div>
        </div>
      </article>
    `;
  }

  function attachCardEvents(container) {
    container.querySelectorAll(".favorite").forEach(btn => {
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

    container.querySelectorAll(".game-card").forEach(card => {
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

  function attachAdminEvents(container) {
    container.querySelectorAll(".admin-edit").forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); openGameModal(btn.dataset.id); };
    });
    container.querySelectorAll(".admin-delete").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm("Excluir jogo?")) return;
        await deleteGame(btn.dataset.id);
      };
    });
  }

  function setupShuffle() {
    if (!shuffleBtn || !grid) return;
    shuffleBtn.onclick = () => {
      const shuffled = [...allGames].sort(() => Math.random() - 0.5);
      renderGames(shuffled);
    };
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase().trim();
      const filtered = allGames.filter(g => g.name.toLowerCase().includes(term));
      renderGames(filtered);
    });
  }

  if (categories.length) {
    categories.forEach(cat => {
      cat.addEventListener("click", () => {
        categories.forEach(c => c.classList.remove("active"));
        cat.classList.add("active");
        const filter = cat.dataset.filter;
        const filtered = filter === "all" ? allGames : allGames.filter(g => g.category && g.category.includes(filter));
        renderGames(filtered);
      });
    });
  }

  function updateCategoryCounts(games) {
    const counters = document.querySelectorAll("[data-count-for]");
    if (!counters.length) return;

    counters.forEach(counter => {
      const filter = counter.dataset.countFor;
      const amount = filter === "all"
        ? games.length
        : games.filter(g => (g.category || "").includes(filter)).length;
      counter.textContent = `${amount} jogo${amount === 1 ? "" : "s"}`;
    });
  }

  function getLibraryNames() {
    return currentUser && Array.isArray(currentUser.library) ? currentUser.library : [];
  }

  async function updateLibrary(gameName, action, button) {
    if (!currentUser) {
      alert("Faça login para favoritar jogos");
      return;
    }

    try {
      const response = await fetch("/api/user/library", {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ game: gameName, action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar biblioteca");

      currentUser = { ...data.user, token: authToken };
      localStorage.setItem("rivardosplay_user", JSON.stringify(currentUser));
      applyLibraryState();

      if (window.location.pathname.endsWith("library.html") || window.location.pathname === "/library") {
        loadLibraryGames();
      }
    } catch (error) {
      alert(error.message);
    }
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

  function checkUserSession() {
    const user = localStorage.getItem("rivardosplay_user");
    if (!user) return;
    const userData = JSON.parse(user);
    authToken = userData.token || "";
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

  ensurePlayerInfoPanel();

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
      const updatedUser = { username: editUsername.value.trim(), avatar: editAvatar ? editAvatar.value : "🛡️" };
      if (!updatedUser.username) { alert("Nome de usuário é obrigatório"); return; }

      try {
        const response = await fetch("/api/user/update", { method: "PUT", headers: getAuthHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(updatedUser) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao salvar alterações");

        localStorage.setItem("rivardosplay_user", JSON.stringify({ ...data.user, token: authToken }));
        currentUser = { ...data.user, token: authToken };
        checkUserSession();
        toggleEditMode();
        savePlayerInfoBtn.textContent = "Salvo!";
        setTimeout(() => savePlayerInfoBtn.textContent = "Salvar", 1000);
      } catch (error) { alert(error.message); }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try { await fetch("/api/logout", { method: "POST", headers: getAuthHeaders() }); } catch {}
      localStorage.removeItem("rivardosplay_user");
      authToken = "";
      if (userPanel) userPanel.style.display = "none";
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (playerInfoPanel) playerInfoPanel.classList.remove("active");
      location.reload();
    });
  }

  // ==================== MODAL JOGO (ADMIN) ====================

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
          <div style="margin-bottom:1rem;padding:0.75rem;border:1px dashed var(--border);border-radius:8px;">
            <label style="display:block;margin-bottom:0.5rem;">Importar jogos em massa (RSS JSON URL)</label>
            <input type="url" id="rssFeedUrl" placeholder="https://.../rss-feed.json" style="width:100%;padding:0.5rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:6px;">
            <div style="margin-top:0.6rem;display:flex;justify-content:flex-end;">
              <button type="button" id="importRssBtn" class="btn btn-ghost">Importar RSS em massa</button>
            </div>
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
    document.getElementById("importRssBtn").onclick = async () => { await importGamesFromRss(); };
    gameModal.addEventListener("click", (e) => { if (e.target === gameModal) closeGameModal(); });
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
      document.getElementById("gameEmbed").value = "";
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

    try {
      const response = await fetch(id ? `/api/games/${id}` : `/api/games`, {
        method: id ? "PUT" : "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, image_url, alt_text, tags, rating, category, embed })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao salvar jogo");
      closeGameModal();
      alert("Jogo salvo com sucesso!");
      location.reload();
    } catch (error) { alert(error.message); }
  }

  async function importGamesFromRss() {
    if (!currentUser) {
      alert("Faça login como admin");
      return;
    }

    const rssField = document.getElementById("rssFeedUrl");
    const feed_url = rssField?.value?.trim();
    if (!feed_url) {
      alert("Informe a URL do feed RSS JSON");
      return;
    }

    try {
      const response = await fetch("/api/admin/import-rss", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ feed_url })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao importar feed");

      alert(`Importação concluída: ${data.imported} importados, ${data.skipped} ignorados, ${data.failed} falhas.`);
      await loadGames();
      await loadAdminGames?.();
      await loadAdminGameStats?.();
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteGame(gameId) {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/games/${gameId}`, { method: "DELETE", headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao excluir jogo");
      await loadGames();
      await loadAdminGames?.();
      alert("Jogo excluído!");
    } catch (error) { alert(error.message); }
  }

  // ==================== MODAL EMBED ====================

  let embedModal = null;

  function createEmbedModal() {
    if (embedModal) return;
    embedModal = document.createElement("div");
    embedModal.id = "embedModal";
    embedModal.style.cssText = "display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:2000;align-items:center;justify-content:center;";
    embedModal.innerHTML = `
      <div style="position:relative;width:95vw;height:95vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <button id="closeEmbedModal" style="position:absolute;top:10px;right:20px;background:none;border:none;color:white;font-size:3rem;cursor:pointer;z-index:10;">&times;</button>
        <h2 id="embedGameName" style="color:white;margin-bottom:1rem;text-align:center;"></h2>
        <div id="embedContainer" style="width:100%;height:calc(100% - 60px);display:flex;align-items:center;justify-content:center;overflow:auto;"></div>
      </div>
    `;
    document.body.appendChild(embedModal);
    document.getElementById("closeEmbedModal").onclick = closeEmbedModal;
    embedModal.addEventListener("click", (e) => { if (e.target === embedModal) closeEmbedModal(); });
  }

  function openEmbedModal(embedHtml, gameName) {
    createEmbedModal();
    const container = document.getElementById("embedContainer");
    const title = document.getElementById("embedGameName");
    title.textContent = gameName;
    const sanitized = embedHtml.replace(/<iframe/gi, '<iframe sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"');
    container.innerHTML = sanitized;
    embedModal.style.display = "flex";
    document.body.style.overflow = "hidden";
    const game = allGames.find(g => g.name === gameName);
    if (currentUser && game?.id) {
      activeGameSession = {
        gameId: game.id,
        startedAt: Date.now(),
        sent: false
      };
    }
  }

  async function closeEmbedModal() {
    await persistActiveGameSession();
    if (embedModal) embedModal.style.display = "none";
    const container = document.getElementById("embedContainer");
    if (container) container.innerHTML = "";
    document.body.style.overflow = "";
  }

  async function persistActiveGameSession() {
    if (!currentUser || !activeGameSession || activeGameSession.sent) return;
    const elapsedSeconds = Math.floor((Date.now() - activeGameSession.startedAt) / 1000);
    if (elapsedSeconds < 5) {
      activeGameSession = null;
      return;
    }

    activeGameSession.sent = true;
    try {
      await fetch("/api/user/game-session", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          gameId: activeGameSession.gameId,
          seconds: elapsedSeconds
        })
      });
    } catch (error) {
      console.error("Erro ao salvar sessão de jogo", error);
    } finally {
      activeGameSession = null;
    }
  }

  // ==================== ADMIN ====================

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
    const statsSection = document.getElementById("statsAdminSection");
    if (statsSection) statsSection.style.display = "block";
    noAccess.style.display = "none";

    loadAdminUsers();
    loadAdminGames();
    loadAdminGameStats();
  }

  async function loadAdminUsers() {
    const tbody = document.getElementById("adminUsersTable");
    if (!tbody) return;
    try {
      const response = await fetch("/api/admin/users", { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar usuários");

      tbody.innerHTML = data.map(u => `
        <tr>
          <td>${u.id}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.email)}</td><td>${u.level}</td>
          <td>${u.xp}</td><td>${u.favorites || 0}</td><td>${u.hours_played || 0}</td>
          <td>${escapeHtml(u.role)}</td><td>${escapeHtml(u.created_at)}</td>
          <td>${u.role === "admin" ? "—" : `<button class="btn btn-ghost admin-delete-user" data-id="${u.id}">Apagar</button>`}</td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".admin-delete-user").forEach(btn => {
        btn.onclick = async () => {
          if (!confirm("Excluir usuário?")) return;
          const res = await fetch(`/api/admin/users/${btn.dataset.id}`, { method: "DELETE", headers: getAuthHeaders() });
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
          <img src="${escapeHtml(g.image_url)}" alt="${escapeHtml(g.alt_text)}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">
          <div style="flex:1;">
            <strong style="font-size:1.1rem;">${escapeHtml(g.name)}</strong><br>
            <small>${escapeHtml((g.tags || []).join(", "))}</small>
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
      container.innerHTML = "<p style='color:var(--muted);'>Erro ao carregar jogos</p>";
    }
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours}h ${minutes}min`;
  }

  async function loadAdminGameStats() {
    const tbody = document.getElementById("adminGameStatsTable");
    const message = document.getElementById("adminStatsMessage");
    if (!tbody) return;

    try {
      const response = await fetch("/api/admin/game-stats", { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar estatísticas");

      tbody.innerHTML = data.map(row => `
        <tr>
          <td>${escapeHtml(row.game_name)}</td>
          <td>${formatDuration(row.total_seconds)}</td>
          <td>${formatDuration(row.avg_seconds_per_user)}</td>
          <td>${row.unique_players}</td>
        </tr>
      `).join("");
      if (message) message.textContent = "Estatísticas carregadas";
    } catch (error) {
      if (message) message.textContent = error.message;
      tbody.innerHTML = "";
    }
  }

  window.openGameModal = openGameModal;
  window.deleteGame = deleteGame;
  window.loadAdminUsers = loadAdminUsers;
  window.loadAdminGames = loadAdminGames;
  window.loadAdminGameStats = loadAdminGameStats;

  const refreshUsersBtn = document.getElementById("refreshUsers");
  if (refreshUsersBtn) refreshUsersBtn.addEventListener("click", loadAdminUsers);
  const refreshGamesBtn = document.getElementById("refreshGames");
  if (refreshGamesBtn) refreshGamesBtn.addEventListener("click", loadAdminGames);
  const refreshStatsBtn = document.getElementById("refreshStats");
  if (refreshStatsBtn) refreshStatsBtn.addEventListener("click", loadAdminGameStats);

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
          localStorage.setItem("rivardosplay_user", JSON.stringify({ ...data.user, token: data.token }));
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
  window.addEventListener("beforeunload", persistActiveGameSession);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistActiveGameSession();
    }
  });

  if (window.location.pathname.endsWith("admin.html") || window.location.pathname === "/admin") {
    renderAdminPage();
  }

  if (window.location.pathname.endsWith("library.html") || window.location.pathname === "/library") {
    loadLibraryGames();
  }
});
