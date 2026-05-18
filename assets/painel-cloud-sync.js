(function () {
  'use strict';

  var root = window;
  var documentRef = document;

  var CONFIG = {
    version: '20260505-liraa-cycle-history-cloud-v14',
    panelAppSrc: './assets/painel-app.js?v=20260505-map-filter-docked-v27',
    loginAction: 'panel_login',
    bundleAction: 'panel_bundle_private',
    logoutAction: 'panel_logout',
    statusAction: 'panel_session_status',
    refreshAction: 'panel_session_refresh',
    timeoutMs: 25000,
    defaultLimit: 10000,
    visitsKey: 'dengue_db_visits_v1',
    propertiesKey: 'dengue_db_properties_v1',
    tubitosKey: 'dengue_db_tubitos_v1',
    statusId: 'acePanelCloudStatus',
    sessionStorageKey: 'ace_panel_private_session_v1'
  };

  var state = {
    bundle: null,
    loadedPanelApp: false,
    storagePatched: false,
    indexedStorePatched: false,
    originalStorageGetItem: null,
    originalIndexedHydrate: null,
    auth: null,
    loginNode: null,
    logoutButton: null,
    activityBound: false,
    idleTimer: null,
    idleWarnTimer: null,
    sessionTicker: null,
    sessionRefreshPromise: null
  };

  function getRuntimeConfig() {
    return root.ACS_RUNTIME_CONFIG || {};
  }

  function getApiUrl() {
    var runtime = getRuntimeConfig();
    return String(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '').trim();
  }

  function getLimit() {
    var runtime = getRuntimeConfig();
    var limit = Number(runtime.PANEL_LIMIT || runtime.PANEL_REFRESH_LIMIT || CONFIG.defaultLimit);

    if (!limit || Number.isNaN(limit) || limit < 1) {
      return CONFIG.defaultLimit;
    }

    return Math.min(limit, 30000);
  }

  function isApiConfigured() {
    var url = getApiUrl();

    return !!url &&
      url !== 'COLE_AQUI_A_URL_DO_WEB_APP' &&
      /^https?:\/\//i.test(url);
  }

  function getIdleTimeoutMs() {
    var runtime = getRuntimeConfig();
    var minutes = Number(runtime.PANEL_IDLE_TIMEOUT_MINUTES || 20);

    if (!minutes || Number.isNaN(minutes) || minutes < 1) {
      return 20 * 60 * 1000;
    }

    return minutes * 60 * 1000;
  }

  function getSessionRefreshThresholdMs() {
    var runtime = getRuntimeConfig();
    var minutes = Number(runtime.PANEL_SESSION_REFRESH_MINUTES || 12);

    if (!minutes || Number.isNaN(minutes) || minutes < 1) {
      return 12 * 60 * 1000;
    }

    return minutes * 60 * 1000;
  }

  function enrichSession(session) {
    if (!session || typeof session !== 'object') {
      return null;
    }
    var enriched = Object.assign({}, session);
    var expiresInSeconds = Number(enriched.expiresInSeconds || enriched.expires_in_seconds || 0) || 0;
    var authenticatedAt = enriched.authenticatedAt || enriched.authenticated_at || new Date().toISOString();
    var expiresAtMs = expiresInSeconds > 0
      ? Date.parse(authenticatedAt) + (expiresInSeconds * 1000)
      : NaN;

    enriched.expiresInSeconds = expiresInSeconds;
    enriched.authenticatedAt = authenticatedAt;
    if (Number.isFinite(expiresAtMs) && expiresAtMs > 0) {
      enriched.expiresAt = new Date(expiresAtMs).toISOString();
    } else if (!enriched.expiresAt) {
      enriched.expiresAt = '';
    }
    return enriched;
  }

  function getSessionRemainingMs(session) {
    var active = enrichSession(session || readSession());
    if (!active || !active.expiresAt) {
      return Infinity;
    }
    var expiresAtMs = Date.parse(active.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return Infinity;
    }
    return expiresAtMs - Date.now();
  }

  function formatRemainingLabel(ms) {
    if (!Number.isFinite(ms)) {
      return 'sessão ativa';
    }
    if (ms <= 0) {
      return 'expirando agora';
    }
    var totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) {
      return totalMinutes + ' min restantes';
    }
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    return hours + 'h' + (minutes ? ' ' + minutes + 'min' : '') + ' restantes';
  }

  function stopSessionTicker() {
    if (state.sessionTicker) {
      root.clearInterval(state.sessionTicker);
      state.sessionTicker = null;
    }
  }

  function updateSessionMetaUi() {
    var note = documentRef.getElementById('panelLogoutNote');
    var badge = documentRef.getElementById('panelLogoutSessionBadge');
    var session = readSession();
    var name = session && session.agent && session.agent.nome
      ? session.agent.nome
      : (session && session.nome ? session.nome : 'Coordenação');
    var role = session && session.role ? session.role : 'usuário autorizado';
    var remainingMs = getSessionRemainingMs(session);

    if (note) {
      note.textContent = name + ' • ' + role;
    }
    if (badge) {
      badge.textContent = session ? formatRemainingLabel(remainingMs) : 'sem sessão';
      badge.className = 'header-widget-v3__logout-badge';
      if (!session) {
        badge.className += ' is-idle';
      } else if (remainingMs <= (5 * 60 * 1000)) {
        badge.className += ' is-warn';
      }
    }
  }

  function startSessionTicker() {
    stopSessionTicker();
    updateSessionMetaUi();
    if (!getSessionToken()) {
      return;
    }
    state.sessionTicker = root.setInterval(function () {
      updateSessionMetaUi();
    }, 30000);
  }

  function shouldRefreshSession(session) {
    var remainingMs = getSessionRemainingMs(session);
    return Number.isFinite(remainingMs) && remainingMs <= getSessionRefreshThresholdMs();
  }

  function refreshPrivateSession(force) {
    var session = readSession();
    if (!session || !session.sessionToken) {
      return Promise.reject(new Error('Sessão do painel ausente. Faça login novamente.'));
    }
    if (!force && !shouldRefreshSession(session)) {
      return Promise.resolve(session);
    }
    if (state.sessionRefreshPromise) {
      return state.sessionRefreshPromise;
    }
    state.sessionRefreshPromise = postJson({
      action: CONFIG.refreshAction,
      access_module: 'coordenacao',
      sessionToken: session.sessionToken
    }).then(function (payload) {
      var agent = payload && payload.agent ? payload.agent : {};
      var refreshed = enrichSession({
        sessionToken: String(payload.sessionToken || payload.session_token || session.sessionToken || '').trim(),
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || session.expiresInSeconds || 0) || 0,
        cpf: normalizeCpf(agent.cpf || session.cpf || ''),
        nome: String(agent.nome || session.nome || 'Usuário autorizado').trim(),
        role: String(agent.role || session.role || 'usuário autorizado').trim(),
        authenticatedAt: new Date().toISOString(),
        lastValidatedAt: Date.now(),
        agent: Object.assign({}, session.agent || {}, agent || {})
      });
      saveSession(refreshed);
      return refreshed;
    }).finally(function () {
      state.sessionRefreshPromise = null;
    });
    return state.sessionRefreshPromise;
  }

  function ensureActiveSession(forceRefresh) {
    var session = readSession();
    if (!session || !session.sessionToken) {
      return Promise.reject(new Error('AUTH_REQUIRED'));
    }

    state.auth = session;
    resetActivityMonitor();

    if (forceRefresh || shouldRefreshSession(session)) {
      return refreshPrivateSession(!!forceRefresh);
    }

    var lastValidatedAt = Number(session.lastValidatedAt || 0) || 0;
    if (lastValidatedAt && (Date.now() - lastValidatedAt) < 30000) {
      return Promise.resolve(session);
    }

    return postJson({
      action: CONFIG.statusAction,
      access_module: 'coordenacao',
      sessionToken: session.sessionToken
    }).then(function (payload) {
      var agent = payload && payload.agent ? payload.agent : {};
      var validated = enrichSession({
        sessionToken: session.sessionToken,
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || session.expiresInSeconds || 0) || 0,
        cpf: normalizeCpf(agent.cpf || session.cpf || ''),
        nome: String(agent.nome || session.nome || 'Usuário autorizado').trim(),
        role: String(agent.role || session.role || 'usuário autorizado').trim(),
        authenticatedAt: new Date().toISOString(),
        lastValidatedAt: Date.now(),
        agent: Object.assign({}, session.agent || {}, agent || {})
      });
      saveSession(validated);
      return validated;
    }).catch(function (error) {
      clearSession();
      throw error;
    });
  }

  function createStatusNode() {
    var existing = documentRef.getElementById(CONFIG.statusId);

    if (existing) {
      return existing;
    }

    var node = documentRef.createElement('div');
    node.id = CONFIG.statusId;
    node.setAttribute('role', 'status');
    node.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:99999',
      'max-width:min(420px, calc(100vw - 32px))',
      'padding:12px 14px',
      'border-radius:16px',
      'box-shadow:0 18px 45px rgba(15,23,42,.22)',
      'font:600 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'background:#eff6ff',
      'color:#1e3a8a',
      'border:1px solid #bfdbfe'
    ].join(';');

    node.textContent = 'Preparando painel...';
    documentRef.body.appendChild(node);

    return node;
  }

  function setStatus(message, kind) {
    var node = createStatusNode();

    node.textContent = message;

    if (kind === 'ok') {
      node.style.background = '#ecfdf5';
      node.style.color = '#166534';
      node.style.borderColor = '#bbf7d0';
    } else if (kind === 'warn') {
      node.style.background = '#fffbeb';
      node.style.color = '#92400e';
      node.style.borderColor = '#fde68a';
    } else if (kind === 'error') {
      node.style.background = '#fef2f2';
      node.style.color = '#991b1b';
      node.style.borderColor = '#fecaca';
    } else {
      node.style.background = '#eff6ff';
      node.style.color = '#1e3a8a';
      node.style.borderColor = '#bfdbfe';
    }
  }

  function hideStatusLater(delay) {
    setTimeout(function () {
      var node = documentRef.getElementById(CONFIG.statusId);

      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }, delay || 5000);
  }

  function parseJsonResponse(response) {
    if (!response.ok) {
      throw new Error('A API do painel não confirmou a operação.');
    }
    return response.json();
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    var timeout = Number(timeoutMs || CONFIG.timeoutMs || 25000);
    if (typeof AbortController !== 'function') {
      return fetch(url, options);
    }

    var controller = new AbortController();
    var timer = root.setTimeout(function () {
      controller.abort();
    }, timeout);

    return fetch(url, Object.assign({}, options || {}, { signal: controller.signal }))
      .catch(function (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('Tempo de conexão esgotado.');
        }
        throw error;
      })
      .finally(function () {
        root.clearTimeout(timer);
      });
  }

  function postJson(payload) {
    if (!isApiConfigured()) {
      return Promise.reject(new Error('API_URL não configurada em runtime-config.js.'));
    }

    return fetchWithTimeout(getApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {})
    }, CONFIG.timeoutMs).then(parseJsonResponse);
  }

  function normalizeBundle(payload) {
    var bundle = payload || {};

    if (!bundle.ok) {
      throw new Error(bundle.error || 'A API do painel retornou erro.');
    }

    return {
      ok: true,
      version: bundle.version || CONFIG.version,
      generatedAt: bundle.generatedAt || new Date().toISOString(),
      source: bundle.source || 'cloud',
      privacy: bundle.privacy || {},
      meta: bundle.meta || {},
      counts: bundle.counts || {},
      visits: Array.isArray(bundle.visits) ? bundle.visits : [],
      tubitos: Array.isArray(bundle.tubitos) ? bundle.tubitos : [],
      properties: Array.isArray(bundle.properties) ? bundle.properties : [],
      metrics: Array.isArray(bundle.metrics) ? bundle.metrics : [],
      agents: Array.isArray(bundle.agents) ? bundle.agents : [],
      counts: bundle.counts && typeof bundle.counts === 'object' ? bundle.counts : {},
      attendance: bundle.attendance || bundle.attendanceSummary || null,
      liraa_cycles: Array.isArray(bundle.liraa_cycles) ? bundle.liraa_cycles :
        (Array.isArray(bundle.liraaCycles) ? bundle.liraaCycles : []),
      liraaCycles: Array.isArray(bundle.liraaCycles) ? bundle.liraaCycles :
        (Array.isArray(bundle.liraa_cycles) ? bundle.liraa_cycles : []),
      systemState: Array.isArray(bundle.systemState) ? bundle.systemState : [],
      session: bundle.session || null
    };
  }

  function hasUsableSession() {
    var session = state.auth || readSession();
    var expiresAtMs = session && session.expiresAt ? Date.parse(session.expiresAt) : NaN;
    if (!session || !session.sessionToken) {
      return false;
    }
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      return false;
    }
    return true;
  }

  function clearPrivateBundle() {
    state.bundle = null;
    root.ACE_PANEL_CLOUD_BUNDLE = null;
  }

  function installCloudBundle(bundle) {
    state.bundle = bundle;
    root.ACE_PANEL_CLOUD_BUNDLE = bundle;

    patchIndexedStore();
    patchLocalStorage();
  }

  function patchIndexedStore() {
    if (state.indexedStorePatched) {
      return;
    }

    if (!root.ACEIndexedStore || typeof root.ACEIndexedStore.hydrate !== 'function') {
      return;
    }

    state.originalIndexedHydrate = root.ACEIndexedStore.hydrate;

    root.ACEIndexedStore.hydrate = function () {
      if (hasUsableSession() && root.ACE_PANEL_CLOUD_BUNDLE && root.ACE_PANEL_CLOUD_BUNDLE.ok) {
        return Promise.resolve({
          visits: root.ACE_PANEL_CLOUD_BUNDLE.visits || [],
          properties: root.ACE_PANEL_CLOUD_BUNDLE.properties || [],
          tubitos: root.ACE_PANEL_CLOUD_BUNDLE.tubitos || [],
          agents: root.ACE_PANEL_CLOUD_BUNDLE.agents || [],
          attendance: root.ACE_PANEL_CLOUD_BUNDLE.attendance || null,
          summary: {
            source: 'cloud',
            generatedAt: root.ACE_PANEL_CLOUD_BUNDLE.generatedAt,
            privacy: root.ACE_PANEL_CLOUD_BUNDLE.privacy || {}
          },
          meta: root.ACE_PANEL_CLOUD_BUNDLE.meta || {}
        });
      }

      return state.originalIndexedHydrate.call(root.ACEIndexedStore);
    };

    state.indexedStorePatched = true;
  }

  function patchLocalStorage() {
    if (state.storagePatched) {
      return;
    }

    if (!root.Storage || !root.localStorage || !Storage.prototype.getItem) {
      return;
    }

    state.originalStorageGetItem = Storage.prototype.getItem;

    Storage.prototype.getItem = function (key) {
      var bundle = root.ACE_PANEL_CLOUD_BUNDLE;

      if (this === root.localStorage && hasUsableSession() && bundle && bundle.ok) {
        if (key === CONFIG.visitsKey) {
          return JSON.stringify(bundle.visits || []);
        }

        if (key === CONFIG.propertiesKey) {
          return JSON.stringify(bundle.properties || []);
        }

        if (key === CONFIG.tubitosKey) {
          return JSON.stringify(bundle.tubitos || []);
        }

        if (key === 'dengue_db_system_state_v1') {
          return JSON.stringify({
            lastSyncAt: bundle.generatedAt || '',
            lastBootstrapAt: bundle.generatedAt || '',
            lastSyncError: '',
            pendingSync: false,
            pendingReason: '',
            cloudPanelSource: bundle.source || 'cloud',
            cloudPanelVersion: bundle.version || CONFIG.version,
            cloudPanelPrivacy: bundle.privacy || {}
          });
        }
      }

      return state.originalStorageGetItem.call(this, key);
    };

    state.storagePatched = true;
  }

  function loadPanelApp() {
    if (state.loadedPanelApp) {
      return Promise.resolve();
    }

    state.loadedPanelApp = true;

    return new Promise(function (resolve, reject) {
      var script = documentRef.createElement('script');
      script.src = CONFIG.panelAppSrc;
      script.async = false;

      script.onload = function () {
        resolve();
      };

      script.onerror = function () {
        reject(new Error('Não foi possível carregar painel-app.js.'));
      };

      documentRef.body.appendChild(script);
    });
  }

  function formatMoment(value) {
    var date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function normalizeCpf(value) {
    return String(value == null ? '' : value).replace(/\D+/g, '').slice(0, 11);
  }

  function formatCpf(value) {
    var digits = normalizeCpf(value);
    if (digits.length !== 11) {
      return digits;
    }
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function readSession() {
    if (state.auth && state.auth.sessionToken) {
      return state.auth;
    }
    try {
      var raw = root.sessionStorage.getItem(CONFIG.sessionStorageKey);
      state.auth = raw ? enrichSession(JSON.parse(raw)) : null;
      return state.auth;
    } catch (error) {
      state.auth = null;
      return null;
    }
  }

  function saveSession(session) {
    state.auth = enrichSession(session || null);
    try {
      if (!state.auth) {
        root.sessionStorage.removeItem(CONFIG.sessionStorageKey);
        clearIdleTimers();
        stopSessionTicker();
        updateSessionMetaUi();
        return;
      }
      root.sessionStorage.setItem(CONFIG.sessionStorageKey, JSON.stringify(state.auth));
      resetActivityMonitor();
      startSessionTicker();
      updateSessionMetaUi();
    } catch (error) {}
  }

  function clearSession() {
    state.auth = null;
    clearPrivateBundle();
    clearIdleTimers();
    stopSessionTicker();
    try {
      root.sessionStorage.removeItem(CONFIG.sessionStorageKey);
    } catch (error) {}
    updateSessionMetaUi();
  }

  function getSessionToken() {
    var session = state.auth || readSession();
    if (session && session.sessionToken) {
      return String(session.sessionToken || '').trim();
    }
    return '';
  }

  function setShellReady(ready) {
    if (ready) {
      documentRef.body.classList.add('ace-panel-ready');
    } else {
      documentRef.body.classList.remove('ace-panel-ready');
    }
  }

  function ensureLoginOverlay() {
    if (state.loginNode && state.loginNode.parentNode) {
      return state.loginNode;
    }

    var node = documentRef.createElement('div');
    node.id = 'acePanelLoginOverlay';
    node.className = 'ace-panel-login-overlay';
    node.innerHTML = [
      '<div class="ace-panel-login-card" role="dialog" aria-modal="true" aria-labelledby="acePanelLoginTitle">',
      '  <div class="ace-panel-login-brand">Painel da Coordenação</div>',
      '  <h1 id="acePanelLoginTitle">Acesso restrito</h1>',
      '  <p>Entre com CPF e senha de Coordenador ou Administrador para abrir o painel.</p>',
      '  <form id="acePanelLoginForm" class="ace-panel-login-form" novalidate>',
      '    <label class="ace-panel-login-field">',
      '      <span>CPF do usuário autorizado</span>',
      '      <input id="acePanelLoginCpf" name="cpf" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="000.000.000-00" required>',
      '    </label>',
      '    <label class="ace-panel-login-field">',
      '      <span>Senha</span>',
      '      <input id="acePanelLoginPassword" name="password" type="password" autocomplete="current-password" placeholder="Digite a senha" required>',
      '    </label>',
      '    <button id="acePanelLoginSubmit" type="submit">Entrar no painel</button>',
      '    <div id="acePanelLoginMessage" class="ace-panel-login-message" role="status" aria-live="polite"></div>',
      '  </form>',
      ' </div>'
    ].join('');

    documentRef.body.appendChild(node);
    state.loginNode = node;
    return node;
  }

  function showLogin(message, kind) {
    var overlay = ensureLoginOverlay();
    var msg = overlay.querySelector('#acePanelLoginMessage');
    setShellReady(false);

    overlay.hidden = false;
    overlay.style.display = 'flex';

    if (msg) {
      msg.textContent = message || 'Informe suas credenciais para abrir o painel.';
      msg.className = 'ace-panel-login-message' + (kind ? ' is-' + kind : '');
    }

    var cpfInput = overlay.querySelector('#acePanelLoginCpf');
    if (cpfInput) {
      setTimeout(function () { cpfInput.focus(); }, 20);
    }
  }

  function hideLogin() {
    if (state.loginNode) {
      state.loginNode.hidden = true;
      state.loginNode.style.display = 'none';
    }
  }

  function setLoginBusy(busy, message, kind) {
    var overlay = ensureLoginOverlay();
    var msg = overlay.querySelector('#acePanelLoginMessage');
    var submit = overlay.querySelector('#acePanelLoginSubmit');
    var fields = overlay.querySelectorAll('input');

    if (submit) {
      submit.disabled = !!busy;
      submit.textContent = busy ? 'Entrando...' : 'Entrar no painel';
    }

    Array.prototype.forEach.call(fields, function (field) {
      field.disabled = !!busy;
    });

    if (msg && message) {
      msg.textContent = message;
      msg.className = 'ace-panel-login-message' + (kind ? ' is-' + kind : '');
    }
  }


  function clearIdleTimers() {
    if (state.idleWarnTimer) {
      root.clearTimeout(state.idleWarnTimer);
      state.idleWarnTimer = null;
    }
    if (state.idleTimer) {
      root.clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
  }

  function expireForInactivity() {
    var token = getSessionToken();

    clearIdleTimers();
    if (!token) {
      return;
    }

    clearSession();
    setShellReady(false);
    showLogin('Sessão encerrada por inatividade. Entre novamente para continuar.', 'warn');
    setStatus('Painel bloqueado por inatividade.', 'warn');

    postJson({
      action: CONFIG.logoutAction,
      access_module: 'coordenacao',
      sessionToken: token
    }).catch(function () {
      return null;
    });
  }

  function resetActivityMonitor() {
    var timeout = getIdleTimeoutMs();

    clearIdleTimers();
    if (!getSessionToken()) {
      return;
    }

    if (timeout > 90000) {
      state.idleWarnTimer = root.setTimeout(function () {
        setStatus('Sessão do painel perto de expirar por inatividade. Interaja para continuar.', 'warn');
      }, timeout - 60000);
    }

    state.idleTimer = root.setTimeout(expireForInactivity, timeout);
  }

  function bindActivityMonitor() {
    if (state.activityBound) {
      return;
    }

    ['pointerdown', 'keydown', 'mousedown', 'touchstart', 'scroll', 'focus'].forEach(function (eventName) {
      root.addEventListener(eventName, function () {
        resetActivityMonitor();
      }, { passive: true });
    });

    state.activityBound = true;
    resetActivityMonitor();
  }

  function updateLogoutButtonLabel() {
    if (!state.logoutButton) {
      return;
    }

    var name = state.auth && state.auth.agent && state.auth.agent.nome ? state.auth.agent.nome : (state.auth && state.auth.nome ? state.auth.nome : 'Usuário autorizado');
    state.logoutButton.textContent = 'Sair';
    state.logoutButton.setAttribute('title', 'Sair do painel (' + name + ')');
    updateSessionMetaUi();
  }

  function installLogoutButton() {
    if (state.logoutButton) {
      updateLogoutButtonLabel();
      return;
    }

    var slot = documentRef.getElementById('panelLogoutButtonSlot');

    if (slot) {
      slot.innerHTML = '';
      var identityNode = documentRef.createElement('div');
      identityNode.className = 'header-widget-v3__logout-stack';

      var noteNode = documentRef.createElement('strong');
      noteNode.id = 'panelLogoutNote';
      noteNode.className = 'header-widget-v3__logout-note';
      noteNode.textContent = 'Usuário autorizado autenticado';

      var badgeNode = documentRef.createElement('span');
      badgeNode.id = 'panelLogoutSessionBadge';
      badgeNode.className = 'header-widget-v3__logout-badge';
      badgeNode.textContent = 'sessão ativa';

      identityNode.appendChild(noteNode);
      identityNode.appendChild(badgeNode);
      slot.appendChild(identityNode);
    }

    var button = documentRef.createElement('button');
    button.type = 'button';
    button.id = 'acePanelPrivateLogoutBtn';
    button.className = 'ace-panel-private-logout-btn';
    button.textContent = 'Sair';
    button.setAttribute('aria-label', 'Sair do painel da coordenação');
    button.addEventListener('click', function () {
      var token = getSessionToken();

      clearSession();
      clearIdleTimers();
      setShellReady(false);

      postJson({
        action: CONFIG.logoutAction,
        sessionToken: token
      }).catch(function () {
        return null;
      }).finally(function () {
        root.location.reload();
      });
    });

    if (slot) {
      slot.appendChild(button);
    } else {
      documentRef.body.appendChild(button);
    }
    state.logoutButton = button;
    updateLogoutButtonLabel();
    startSessionTicker();
  }

  function bindLoginForm() {
    var overlay = ensureLoginOverlay();
    var form = overlay.querySelector('#acePanelLoginForm');
    var cpfInput = overlay.querySelector('#acePanelLoginCpf');

    if (cpfInput && !cpfInput.dataset.maskBound) {
      cpfInput.dataset.maskBound = '1';
      cpfInput.addEventListener('input', function () {
        var digits = normalizeCpf(cpfInput.value);
        cpfInput.value = formatCpf(digits);
      });
    }

    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', function (event) {
        event.preventDefault();

        var cpf = normalizeCpf(form.cpf && form.cpf.value);
        var senha = String(form.password && form.password.value || '').trim();

        if (!cpf) {
          showLogin('Informe o CPF do usuário autorizado.', 'error');
          return;
        }

        if (!senha) {
          showLogin('Informe a senha do usuário autorizado.', 'error');
          return;
        }

        setLoginBusy(true, 'Validando credenciais...', 'info');

        postJson({
          action: CONFIG.loginAction,
          access_module: 'coordenacao',
          cpf: cpf,
          senha: senha
        }).then(function (payload) {
          if (!payload || payload.ok !== true || !payload.sessionToken) {
            throw new Error(payload && payload.error ? payload.error : 'Falha ao autenticar no painel.');
          }

          saveSession({
            sessionToken: String(payload.sessionToken || '').trim(),
            expiresInSeconds: Number(payload.expiresInSeconds || 0) || 0,
            authenticatedAt: new Date().toISOString(),
            lastValidatedAt: Date.now(),
            agent: payload.agent || null
          });

          updateLogoutButtonLabel();
          showLogin('Credenciais confirmadas. Carregando painel...', 'ok');

          return continueBoot();
        }).catch(function (error) {
          clearSession();
          showLogin(error && error.message ? error.message : 'Não foi possível entrar no painel.', 'error');
        }).finally(function () {
          setLoginBusy(false);
          if (form.password) {
            form.password.value = '';
          }
        });
      });
    }
  }

  function requireAuthentication() {
    var session = readSession();
    if (session && session.sessionToken) {
      state.auth = session;
      resetActivityMonitor();
      return ensureActiveSession(false);
    }

    showLogin('Entre com o CPF e a senha do Coordenador ou Administrador para acessar o painel.', 'info');
    bindLoginForm();
    return Promise.reject(new Error('AUTH_REQUIRED'));
  }

  function loadCloudBundle() {
    return ensureActiveSession(false).then(function (session) {
      return postJson({
        action: CONFIG.bundleAction,
        access_module: 'coordenacao',
        sessionToken: session && session.sessionToken ? session.sessionToken : getSessionToken(),
        limit: String(getLimit()),
        from: getRuntimeConfig().PANEL_FROM || '',
        to: getRuntimeConfig().PANEL_TO || ''
      }).then(normalizeBundle).then(function (bundle) {
        if (bundle && bundle.session) {
          saveSession(Object.assign({}, session || {}, bundle.session || {}, {
            sessionToken: session && session.sessionToken ? session.sessionToken : getSessionToken(),
            authenticatedAt: new Date().toISOString(),
            lastValidatedAt: Date.now(),
            expiresInSeconds: Number(bundle.session.expiresInSeconds || bundle.session.expires_in_seconds || (session && session.expiresInSeconds) || 0) || (session && session.expiresInSeconds) || 0,
            agent: Object.assign({}, (session && session.agent) || {}, bundle.session || {})
          }));
        }
        return bundle;
      });
    });
  }

  function installRefreshButton() {
    if (documentRef.getElementById('acePanelRefreshCloudBtn')) {
      return;
    }

    var target = documentRef.getElementById('panelRefreshCloudButtonSlot') || documentRef.body;
    var button = documentRef.createElement('button');
    button.id = 'acePanelRefreshCloudBtn';
    button.type = 'button';
    button.className = 'ace-panel-refresh-cloud-btn';
    button.textContent = 'Atualizar nuvem';
    button.setAttribute('aria-label', 'Atualizar dados do painel na nuvem');

    button.addEventListener('click', function () {
      resetActivityMonitor();
      setStatus('Atualizando dados privados da nuvem...', 'info');

      loadCloudBundle()
        .then(function (bundle) {
          installCloudBundle(bundle);
          if (root.ACEPanelApp && typeof root.ACEPanelApp.reloadDashboard === 'function') {
            return root.ACEPanelApp.reloadDashboard().then(function () {
              setStatus(
                'Painel atualizado: ' +
                bundle.visits.length +
                ' visita(s), ' +
                bundle.properties.length +
                ' imóvel(is).',
                'ok'
              );
            });
          }

          setStatus(
            'Painel atualizado: ' +
            bundle.visits.length +
            ' visita(s), ' +
            bundle.properties.length +
            ' imóvel(is). Recarregando...',
            'ok'
          );

          setTimeout(function () {
            root.location.reload();
          }, 900);
          return null;
        })
        .catch(function (error) {
          if (String(error && error.message || '').indexOf('Sessão') !== -1) {
            clearSession();
            showLogin('Sua sessão expirou. Entre novamente para atualizar o painel.', 'warn');
          }
          setStatus('Não foi possível atualizar: ' + error.message, 'error');
        });
    });

    target.appendChild(button);
  }

  function continueBoot() {
    bindLoginForm();
    installLogoutButton();
    setStatus('Carregando painel privado da coordenação...', 'info');

    return loadCloudBundle()
      .then(function (bundle) {
        installCloudBundle(bundle);
        hideLogin();
        setShellReady(true);

        setStatus(
          'Painel privado carregado: ' +
          bundle.visits.length +
          ' visita(s), ' +
          bundle.properties.length +
          ' imóvel(is). Última carga: ' +
          formatMoment(bundle.generatedAt) +
          '.',
          'ok'
        );

        return loadPanelApp().then(function () {
          installRefreshButton();
          bindActivityMonitor();
          if (root.ACEPanelApp && typeof root.ACEPanelApp.reloadDashboard === 'function') {
            return root.ACEPanelApp.reloadDashboard().then(function () {
              hideStatusLater(5000);
            });
          }
          hideStatusLater(5000);
          return null;
        });
      })
      .catch(function (error) {
        clearSession();
        setShellReady(false);
        showLogin(error && error.message ? error.message : 'Não foi possível carregar o painel.', 'error');
        setStatus('Acesso ao painel bloqueado até novo login.', 'warn');
        throw error;
      });
  }

  function boot() {
    createStatusNode();
    bindLoginForm();
    bindActivityMonitor();
    documentRef.addEventListener('visibilitychange', function () {
      if (documentRef.visibilityState === 'visible' && getSessionToken()) {
        ensureActiveSession(false).catch(function () {
          return null;
        });
      }
    });
    startSessionTicker();

    if (!isApiConfigured()) {
      showLogin('API_URL não configurada. O painel privado não pode ser aberto.', 'error');
      setStatus('API_URL não configurada para o painel privado.', 'error');
      return Promise.resolve();
    }

    return requireAuthentication()
      .then(function () {
        return continueBoot();
      })
      .catch(function (error) {
        if (error && error.message === 'AUTH_REQUIRED') {
          hideStatusLater(1500);
          return null;
        }
        showLogin(error && error.message ? error.message : 'Não foi possível inicializar o painel.', 'error');
        setStatus('Falha ao iniciar o painel privado.', 'error');
        return null;
      });
  }

  root.ACEPanelCloudSync = {
    version: CONFIG.version,
    loadCloudBundle: loadCloudBundle,
    installCloudBundle: installCloudBundle,
    reloadFromCloud: function () {
      return loadCloudBundle().then(function (bundle) {
        installCloudBundle(bundle);
        return bundle;
      });
    },
    getBundle: function () {
      return state.bundle || null;
    },
    getSessionInfo: function () {
      return readSession();
    },
    refreshSession: function (force) {
      return ensureActiveSession(force === true);
    },
    logout: function () {
      var token = getSessionToken();
      clearSession();
      if (!token) {
        return Promise.resolve({ ok: true, loggedOut: true });
      }
      return postJson({
        action: CONFIG.logoutAction,
        sessionToken: token
      });
    }
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
