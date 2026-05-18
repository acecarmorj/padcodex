(function () {
  'use strict';

  var root = window;
  var documentRef = document;

  var DEFAULT_SUPER_API_URL = 'https://script.google.com/macros/s/AKfycbyevPoSgnnlyJXhaphkPCjEvFBMq1gdqTbrZ521JdXukkq2_PUPjOGuG0gmEAoZjYeX6w/exec';

  var PRIVATE_CONFIG = {
    sessionStorageKey: 'ace_super_private_session_v1',
    loginAction: 'panel_login',
    bundleAction: 'panel_bundle_private',
    logoutAction: 'panel_logout',
    statusAction: 'panel_session_status',
    refreshAction: 'panel_session_refresh',
    timeoutMs: 25000
  };

  var SUPER_STORAGE_KEYS = {
    visits: 'ace_super_visits_v1',
    supervisionRequests: 'ace_super_supervision_requests_v1',
    earlyClosures: 'ace_super_early_closures_v1'
  };

  var state = {
    visits: [],
    supervisionRequests: [],
    earlyClosures: [],
    activeTab: 'chamados',
    mapFilter: 'chamados',
    map: null,
    markersLayer: null,
    selfMarker: null,
    statusBusy: false,
    auth: null,
    loginNode: null,
    logoutButton: null,
    sessionMetaNode: null,
    activityBound: false,
    idleTimer: null,
    idleWarnTimer: null,
    sessionTicker: null,
    sessionRefreshPromise: null
  };

  var CENTER = [-21.9325, -42.6075];
  var GPS_STALE_MINUTES = 60;

  function $(id){ return documentRef.getElementById(id); }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function parseJson(raw, fallback){
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }

  function normalizeLabel(value){
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[’'`´]/g,' ')
      .replace(/[^a-z0-9/]+/g,' ')
      .replace(/\s+/g,' ').trim();
  }

  function textFrom(row, names){
    row = row || {};
    for (var i = 0; i < names.length; i += 1) {
      var value = row[names[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  function numberFrom(row, names){
    var value = textFrom(row, names);
    var number = Number(value);
    return Number.isFinite(number) ? number : '';
  }

  function normalizeVisit(row){
    row = row || {};
    return {
      uid: textFrom(row, ['uid','id']),
      data: textFrom(row, ['data','date']),
      hora: textFrom(row, ['hora','time']),
      agente: textFrom(row, ['agente','agent','nome_agente']),
      matricula: textFrom(row, ['matricula','matrícula','agent_code']),
      bairro: textFrom(row, ['bairro']),
      microarea: textFrom(row, ['microarea','microárea']),
      quarteirao: textFrom(row, ['quarteirao','quarteirão']),
      logradouro: textFrom(row, ['logradouro','rua']),
      numero: textFrom(row, ['numero','número']),
      situacao: textFrom(row, ['situacao','situação','status']),
      foco: textFrom(row, ['foco','focusFound']),
      focusCount: Number(textFrom(row, ['focus_count','focusQty']) || 0) || 0,
      depositCount: Number(textFrom(row, ['deposit_count','depositTotal','depositos_total','depositos']) || 0) || 0,
      deposits: textFrom(row, ['deposits','depositos_breakdown','deposit_breakdown']),
      depositFocusCount: Number(textFrom(row, ['deposit_focus_count','depositFocusTotal']) || 0) || 0,
      depositFocusBreakdown: textFrom(row, ['deposit_focus_breakdown','depositFocusBreakdown']),
      depositTreatmentBreakdown: textFrom(row, ['deposit_treatment_breakdown','depositTreatmentBreakdown']),
      depositTreatmentCount: Number(textFrom(row, ['deposit_treatment_count','depositTreatmentTotal']) || 0) || 0,
      larvicida: textFrom(row, ['larvicida']),
      larvicidaQty: Number(textFrom(row, ['larvicida_qtd','larvicidaQty']) || 0) || 0,
      tubitosQty: Number(textFrom(row, ['tubitos_qtd','tubitosQty']) || 0) || 0,
      operationMode: textFrom(row, ['operation_mode','operational_mode','origem_visita','operationMode']) || 'VD',
      waterAccess: textFrom(row, ['acessou_caixa_agua','water_access','waterAccess']),
      waterAccessReason: textFrom(row, ['motivo_caixa_agua','water_access_reason','waterAccessReason']),
      ladderSupportRequested: textFrom(row, ['solicita_escada','ladder_support_requested','ladderSupportRequested']),
      ladderSupportNoReason: textFrom(row, ['motivo_nao_solicitou_escada','ladder_support_no_reason','ladderSupportNoReason']),
      ladderSupportStatus: textFrom(row, ['ladder_support_status','ladderSupportStatus']) || 'Aberta',
      gps_lat: numberFrom(row, ['gps_lat','gpsLat','latitude','lat']),
      gps_lng: numberFrom(row, ['gps_lng','gpsLng','longitude','lng']),
      gps_acc: numberFrom(row, ['gps_acc','gpsAccuracy','accuracy']),
      updatedAt: textFrom(row, ['updatedAt','updated_at']),
      createdAt: textFrom(row, ['createdAt','created_at'])
    };
  }

  function normalizeSupervisionRequest(row){
    row = row || {};
    return {
      uid: textFrom(row, ['uid','id']),
      data: textFrom(row, ['data','date']),
      hora: textFrom(row, ['hora','time']),
      agente: textFrom(row, ['agente','agent','nome_agente']),
      matricula: textFrom(row, ['matricula','matrícula','agent_code']),
      operationMode: textFrom(row, ['operation_mode','operational_mode','origem_visita','operationMode']) || 'VD',
      mensagem: textFrom(row, ['mensagem','message']) || 'Agente solicitou supervisão em campo.',
      status: textFrom(row, ['status']) || 'Aberta',
      microarea: textFrom(row, ['gps_territory','gpsTerritory','microarea','microárea']),
      quarteirao: textFrom(row, ['gps_quarteirao','gpsQuarteirao','quarteirao','quarteirão']),
      gps_lat: numberFrom(row, ['gps_lat','gpsLat','latitude','lat']),
      gps_lng: numberFrom(row, ['gps_lng','gpsLng','longitude','lng']),
      gps_acc: numberFrom(row, ['gps_acc','gpsAccuracy','accuracy']),
      createdAt: textFrom(row, ['createdAt','created_at']),
      updatedAt: textFrom(row, ['updatedAt','updated_at'])
    };
  }


  function normalizeEarlyClosure(row){
    row = row || {};
    var timestamp = textFrom(row, ['timestamp','createdAt','created_at','updatedAt','updated_at']);
    var fallbackTime = '';
    if (timestamp) {
      var parsed = new Date(timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        fallbackTime = String(parsed.getHours()).padStart(2,'0') + ':' + String(parsed.getMinutes()).padStart(2,'0');
      }
    }
    var refDate = textFrom(row, ['ref_uid','refUid']);
    return {
      uid: textFrom(row, ['uid','id','ref_uid','refUid']) || ('EARLY-' + timestamp),
      data: textFrom(row, ['data','date']) || (refDate && /^\d{4}-\d{2}-\d{2}/.test(refDate) ? refDate.slice(0,10) : ''),
      hora: textFrom(row, ['hora','time']) || fallbackTime,
      agente: textFrom(row, ['agente','agent','actor_name','actorName']) || 'Agente',
      matricula: textFrom(row, ['matricula','matrícula','actor_matricula','actorMatricula']),
      operationMode: textFrom(row, ['operation_mode','operational_mode','operationMode','modo']) || 'VD',
      justificativa: textFrom(row, ['justificativa','reason','motivo']) || textFrom(row, ['descricao','description','details']) || 'Encerramento antecipado registrado.',
      status: textFrom(row, ['status']) || 'Registrado',
      createdAt: timestamp,
      updatedAt: textFrom(row, ['updatedAt','updated_at']) || timestamp,
      gps_lat: '',
      gps_lng: '',
      gps_acc: ''
    };
  }

  function getRuntimeConfig(){
    var runtime = root.ACS_RUNTIME_CONFIG || root.ACE_RUNTIME_CONFIG || {};
    if (!runtime || typeof runtime !== 'object') {
      runtime = {};
    }
    return runtime;
  }

  function isPlaceholderApiUrl(value){
    var text = String(value || '').trim();
    return !text ||
      text === 'COLE_AQUI_A_URL_DO_WEB_APP' ||
      text.indexOf('COLE_AQUI') !== -1 ||
      text.indexOf('SUA_URL') !== -1;
  }

  function getApiUrlFromStorage(){
    try {
      var keys = ['ACE_API_URL', 'ACS_API_URL', 'ace_api_url', 'acs_api_url', 'SHEETS_WEBAPP_URL'];
      for (var i = 0; i < keys.length; i += 1) {
        var value = root.localStorage && root.localStorage.getItem(keys[i]);
        if (!isPlaceholderApiUrl(value)) {
          return String(value).trim();
        }
      }
    } catch (error) {}
    return '';
  }

  function getApiUrlFromDom(){
    var nodes = [
      documentRef.querySelector('meta[name="ace-api-url"]'),
      documentRef.querySelector('meta[name="acs-api-url"]'),
      documentRef.querySelector('script[data-api-url]')
    ];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node) continue;
      var value = node.getAttribute('content') || node.getAttribute('data-api-url') || '';
      if (!isPlaceholderApiUrl(value)) {
        return String(value).trim();
      }
    }
    return '';
  }

  function getApiUrl(){
    var runtime = getRuntimeConfig();
    var candidates = [
      runtime.API_URL,
      runtime.SHEETS_WEBAPP_URL,
      root.ACS_API_URL,
      root.ACE_API_URL,
      root.SHEETS_WEBAPP_URL,
      getApiUrlFromStorage(),
      getApiUrlFromDom(),
      DEFAULT_SUPER_API_URL
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = candidates[i];
      if (!isPlaceholderApiUrl(value)) {
        return String(value).trim();
      }
    }
    return '';
  }
  function getIdleTimeoutMs() {
    var runtime = getRuntimeConfig();
    var minutes = Number(runtime.SUPER_IDLE_TIMEOUT_MINUTES || 20);
    if (!minutes || Number.isNaN(minutes) || minutes < 1) {
      return 20 * 60 * 1000;
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
    var expiresAtMs = expiresInSeconds > 0 ? (Date.parse(authenticatedAt) + (expiresInSeconds * 1000)) : NaN;
    enriched.expiresInSeconds = expiresInSeconds;
    enriched.authenticatedAt = authenticatedAt;
    enriched.expiresAt = Number.isFinite(expiresAtMs) ? new Date(expiresAtMs).toISOString() : '';
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

  function shouldRefreshSession(session) {
    var remainingMs = getSessionRemainingMs(session);
    return Number.isFinite(remainingMs) && remainingMs <= (12 * 60 * 1000);
  }

  function formatRemainingLabel(ms) {
    if (!Number.isFinite(ms)) {
      return 'sessão privada ativa';
    }
    if (ms <= 0) {
      return 'expirando agora';
    }
    return Math.ceil(ms / 60000) + ' min restantes';
  }

  function clearActivityTimers() {
    if (state.idleTimer) {
      root.clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
    if (state.idleWarnTimer) {
      root.clearTimeout(state.idleWarnTimer);
      state.idleWarnTimer = null;
    }
    if (state.sessionTicker) {
      root.clearInterval(state.sessionTicker);
      state.sessionTicker = null;
    }
  }

  function updateSessionMeta() {
    if (!state.sessionMetaNode || !state.sessionMetaNode.parentNode) {
      return;
    }
    var session = readSession();
    if (!session) {
      state.sessionMetaNode.textContent = 'sem sessão';
      state.sessionMetaNode.className = 'ace-super-session-meta is-idle';
      return;
    }
    var remainingMs = getSessionRemainingMs(session);
    state.sessionMetaNode.textContent = (session.nome || 'Usuário autorizado') + ' • ' + formatRemainingLabel(remainingMs);
    state.sessionMetaNode.className = 'ace-super-session-meta' + (remainingMs <= (5 * 60 * 1000) ? ' is-warn' : '');
  }

  function expireForInactivity() {
    var token = getSessionToken();
    clearActivityTimers();
    clearSession();
    setStatus('Sessão encerrada por inatividade.');
    showLogin('Sessão encerrada por inatividade. Entre novamente para continuar a supervisão.', 'warn');
    if (token) {
      postJson({ action: PRIVATE_CONFIG.logoutAction, access_module: 'supervisao', sessionToken: token }, { skipSession: true }).catch(function(){});
    }
  }

  function resetActivityMonitor() {
    var timeout = getIdleTimeoutMs();
    clearActivityTimers();
    updateSessionMeta();
    if (!getSessionToken()) {
      return;
    }
    if (timeout > 90000) {
      state.idleWarnTimer = root.setTimeout(function () {
        setStatus('Sessão da supervisão perto de expirar por inatividade.');
      }, timeout - 60000);
    }
    state.idleTimer = root.setTimeout(expireForInactivity, timeout);
    state.sessionTicker = root.setInterval(updateSessionMeta, 30000);
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

  function refreshPrivateSession(force) {
    var session = readSession();
    if (!session || !session.sessionToken) {
      return Promise.reject(new Error('AUTH_REQUIRED'));
    }
    if (!force && !shouldRefreshSession(session)) {
      return Promise.resolve(session);
    }
    if (state.sessionRefreshPromise) {
      return state.sessionRefreshPromise;
    }
    state.sessionRefreshPromise = postJson({
      action: PRIVATE_CONFIG.refreshAction,
      access_module: 'supervisao',
      accessModule: 'supervisao',
      sessionToken: session.sessionToken
    }, { skipSession: true }).then(function(payload){
      var agent = payload && payload.agent ? payload.agent : {};
      var refreshed = enrichSession({
        sessionToken: String(payload.sessionToken || payload.session_token || session.sessionToken || '').trim(),
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || session.expiresInSeconds || 0) || 0,
        cpf: normalizeCpf(agent.cpf || session.cpf || ''),
        nome: String(agent.nome || session.nome || 'Usuário autorizado').trim(),
        role: String(agent.role || session.role || 'autorizado').trim(),
        authenticatedAt: new Date().toISOString()
      });
      writeSession(refreshed);
      return refreshed;
    }).finally(function(){
      state.sessionRefreshPromise = null;
    });
    return state.sessionRefreshPromise;
  }

  function ensureActiveSession(forceRefresh) {
    var session = readSession();
    if (!session || !session.sessionToken) {
      return Promise.reject(new Error('AUTH_REQUIRED'));
    }
    if (forceRefresh || shouldRefreshSession(session)) {
      return refreshPrivateSession(!!forceRefresh);
    }
    return postJson({
      action: PRIVATE_CONFIG.statusAction,
      access_module: 'supervisao',
      accessModule: 'supervisao',
      sessionToken: session.sessionToken
    }, { skipSession: true }).then(function(payload){
      var agent = payload && payload.agent ? payload.agent : {};
      var validated = enrichSession({
        sessionToken: session.sessionToken,
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || session.expiresInSeconds || 0) || 0,
        cpf: normalizeCpf(agent.cpf || session.cpf || ''),
        nome: String(agent.nome || session.nome || 'Usuário autorizado').trim(),
        role: String(agent.role || session.role || 'autorizado').trim(),
        authenticatedAt: new Date().toISOString()
      });
      writeSession(validated);
      return validated;
    }).catch(function(error){
      clearSession();
      throw error;
    });
  }


  function normalizeCpf(value){
    return String(value == null ? '' : value).replace(/\D+/g, '').slice(0, 11);
  }

  function formatCpf(value){
    var digits = normalizeCpf(value);
    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 6) {
      return digits.slice(0, 3) + '.' + digits.slice(3);
    }
    if (digits.length <= 9) {
      return digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6);
    }
    return digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6, 9) + '-' + digits.slice(9, 11);
  }

  function readSession(){
    if (state.auth && state.auth.sessionToken) {
      return state.auth;
    }
    try {
      var raw = root.sessionStorage.getItem(PRIVATE_CONFIG.sessionStorageKey);
      state.auth = raw ? enrichSession(JSON.parse(raw)) : null;
    } catch (error) {
      state.auth = null;
    }
    return state.auth && state.auth.sessionToken ? state.auth : null;
  }

  function writeSession(session){
    state.auth = enrichSession(session || null);
    try {
      if (!state.auth) {
        root.sessionStorage.removeItem(PRIVATE_CONFIG.sessionStorageKey);
      } else {
        root.sessionStorage.setItem(PRIVATE_CONFIG.sessionStorageKey, JSON.stringify(state.auth));
      }
    } catch (error) {}
    resetActivityMonitor();
    updateSessionMeta();
  }

  function clearPrivateCaches(){
    try { root.localStorage.removeItem(SUPER_STORAGE_KEYS.visits); } catch (error) {}
    try { root.localStorage.removeItem(SUPER_STORAGE_KEYS.supervisionRequests); } catch (error) {}
    try { root.localStorage.removeItem(SUPER_STORAGE_KEYS.earlyClosures); } catch (error) {}
    try { root.localStorage.removeItem('dengue_db_supervision_requests_v1'); } catch (error) {}
    try { root.localStorage.removeItem('dengue_db_super_early_closures_v1'); } catch (error) {}
    try { root.localStorage.removeItem('dengue_db_early_closures_v1'); } catch (error) {}
  }

  function clearPrivateView(){
    state.visits = [];
    state.supervisionRequests = [];
    state.earlyClosures = [];
    var badge = $('superSyncBadge');
    if (badge) badge.textContent = 'Bloqueado';
    renderAll();
  }

  function clearSession(){
    state.auth = null;
    try {
      root.sessionStorage.removeItem(PRIVATE_CONFIG.sessionStorageKey);
    } catch (error) {}
    clearActivityTimers();
    clearPrivateCaches();
    clearPrivateView();
    updateSessionMeta();
  }

  function getSessionToken(){
    var session = readSession();
    return session && session.sessionToken ? String(session.sessionToken || '').trim() : '';
  }

  function setShellReady(ready){
    var shell = documentRef.querySelector('.super-shell');
    if (!shell) {
      return;
    }
    shell.style.pointerEvents = ready ? '' : 'none';
    shell.style.opacity = ready ? '' : '0.28';
    shell.style.filter = ready ? '' : 'blur(1px)';
  }

  function ensureLoginStyles(){
    if ($('aceSuperLoginStyles')) {
      return;
    }
    var style = documentRef.createElement('style');
    style.id = 'aceSuperLoginStyles';
    style.textContent = [
      '.ace-super-login-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,rgba(2,6,23,.78),rgba(6,95,70,.72));backdrop-filter:blur(10px)}',
      '.ace-super-login-overlay[hidden],.ace-super-login-overlay.is-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}',
      '.ace-super-login-card{width:min(480px,calc(100vw - 32px));background:#fff;border-radius:28px;padding:24px;box-shadow:0 28px 70px rgba(15,23,42,.32);border:1px solid rgba(15,23,42,.08);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.ace-super-login-badge{display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;border-radius:999px;background:#dcfce7;color:#065f46;font-weight:900;font-size:12px;letter-spacing:.02em;text-transform:uppercase}',
      '.ace-super-login-card h1{margin:0 0 8px;font-size:1.75rem;color:#052e16}',
      '.ace-super-login-card p{margin:0 0 18px;color:#475569;font-weight:650;line-height:1.45}',
      '.ace-super-login-form{display:grid;gap:12px}',
      '.ace-super-login-field{display:grid;gap:6px;font-weight:800;color:#0f172a}',
      '.ace-super-login-field input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:16px;border:1px solid #cbd5e1;font:inherit;background:#f8fafc;outline:none}',
      '.ace-super-login-field input:focus{border-color:#047857;box-shadow:0 0 0 4px rgba(4,120,87,.12);background:#fff}',
      '.ace-super-login-submit{border:0;border-radius:999px;padding:13px 16px;background:#065f46;color:#fff;font:900 15px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 12px 24px rgba(6,95,70,.18)}',
      '.ace-super-login-submit:disabled{opacity:.68;cursor:wait}',
      '.ace-super-login-message{min-height:20px;font-weight:800;color:#475569}',
      '.ace-super-logout-btn{border:0;border-radius:999px;padding:10px 14px;background:#052e16;color:#fff;font-weight:800;cursor:pointer}',
      '.ace-super-topbar-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}',
      '.ace-super-session-meta{display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:rgba(5,94,70,.12);color:#064e3b;font-weight:800;font-size:12px}',
      '.ace-super-session-meta.is-warn{background:rgba(202,138,4,.18);color:#854d0e}',
      '.ace-super-session-meta.is-idle{background:rgba(71,85,105,.18);color:#334155}'
    ].join('');
    documentRef.head.appendChild(style);
  }

  function ensureLoginOverlay(){
    if (state.loginNode && state.loginNode.parentNode) {
      return state.loginNode;
    }
    ensureLoginStyles();
    var node = documentRef.createElement('div');
    node.id = 'aceSuperLoginOverlay';
    node.className = 'ace-super-login-overlay';
    node.innerHTML = [
      '<section class="ace-super-login-card" role="dialog" aria-modal="true" aria-labelledby="aceSuperLoginTitle">',
      '<div class="ace-super-login-badge">🛡️ Área online protegida</div>',
      '<h1 id="aceSuperLoginTitle">Acesso da supervisão</h1>',
      '<p>Use CPF e senha de Supervisor ou Administrador. ACE e Coordenador não acessam este painel.</p>',
      '<form id="aceSuperLoginForm" class="ace-super-login-form" novalidate>',
      '<label class="ace-super-login-field"><span>CPF do supervisor ou administrador</span><input id="aceSuperLoginCpf" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="000.000.000-00" required></label>',
      '<label class="ace-super-login-field"><span>Senha</span><input id="aceSuperLoginPassword" type="password" autocomplete="current-password" placeholder="Digite a senha" required></label>',
      '<button id="aceSuperLoginSubmit" class="ace-super-login-submit" type="submit">Entrar na supervisão</button>',
      '<div id="aceSuperLoginMessage" class="ace-super-login-message" role="status" aria-live="polite"></div>',
      '</form>',
      '</section>'
    ].join('');
    documentRef.body.appendChild(node);
    state.loginNode = node;
    bindLoginForm();
    return node;
  }

  function setLoginMessage(message, kind){
    var node = $('aceSuperLoginMessage');
    if (!node) {
      return;
    }
    node.textContent = message || '';
    node.style.color = kind === 'error' ? '#991b1b' : (kind === 'warn' ? '#92400e' : '#475569');
  }

  function showLogin(message, kind){
    var node = ensureLoginOverlay();
    node.classList.remove('is-hidden');
    node.hidden = false;
    node.style.display = 'flex';
    node.setAttribute('aria-hidden', 'false');
    setShellReady(false);
    setLoginBusy(false);
    setLoginMessage(message || 'Entre com CPF e senha de Supervisor ou Administrador.', kind || 'info');
    setTimeout(function(){
      var cpfInput = $('aceSuperLoginCpf');
      if (cpfInput) {
        cpfInput.focus();
      }
    }, 0);
  }

  function hideLogin(){
    var node = state.loginNode || $('aceSuperLoginOverlay');
    if (node) {
      node.classList.add('is-hidden');
      node.hidden = true;
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    }
    setLoginBusy(false);
    setShellReady(true);
  }

  function setLoginBusy(busy){
    var submit = $('aceSuperLoginSubmit');
    var cpf = $('aceSuperLoginCpf');
    var pass = $('aceSuperLoginPassword');
    if (submit) {
      submit.disabled = !!busy;
      submit.textContent = busy ? 'Entrando...' : 'Entrar na supervisão';
    }
    if (cpf) { cpf.disabled = !!busy; }
    if (pass) { pass.disabled = !!busy; }
  }

  function bindLoginForm(){
    var form = $('aceSuperLoginForm');
    if (!form || form.getAttribute('data-bound') === '1') {
      return;
    }
    form.setAttribute('data-bound', '1');

    var cpfInput = $('aceSuperLoginCpf');
    if (cpfInput && cpfInput.getAttribute('data-mask-bound') !== '1') {
      cpfInput.setAttribute('data-mask-bound', '1');
      cpfInput.value = formatCpf(cpfInput.value);
      cpfInput.addEventListener('input', function(){
        cpfInput.value = formatCpf(cpfInput.value);
      });
      cpfInput.addEventListener('blur', function(){
        cpfInput.value = formatCpf(cpfInput.value);
      });
    }

    form.addEventListener('submit', function(event){
      event.preventDefault();
      var cpf = $('aceSuperLoginCpf') ? $('aceSuperLoginCpf').value : '';
      var senha = $('aceSuperLoginPassword') ? $('aceSuperLoginPassword').value : '';
      setLoginMessage('Validando acesso privado...', 'info');
      setLoginBusy(true);
      loginPrivateAccess(cpf, senha).then(function(){
        if ($('aceSuperLoginPassword')) {
          $('aceSuperLoginPassword').value = '';
        }
        hideLogin();
        return loadData(true);
      }).catch(function(error){
        showLogin(error && error.message ? error.message : 'Não foi possível entrar.', 'error');
      }).finally(function(){
        setLoginBusy(false);
      });
    });
  }

  function installLogoutButton(){
    if (state.logoutButton && state.logoutButton.parentNode) {
      updateSessionMeta();
      return state.logoutButton;
    }
    var topbar = documentRef.querySelector('.super-topbar');
    if (!topbar) {
      return null;
    }
    var actions = documentRef.createElement('div');
    actions.className = 'ace-super-topbar-actions';

    var meta = documentRef.createElement('span');
    meta.className = 'ace-super-session-meta';
    meta.id = 'aceSuperSessionMeta';
    meta.textContent = 'sessão privada ativa';
    actions.appendChild(meta);
    state.sessionMetaNode = meta;

    var button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'ace-super-logout-btn';
    button.id = 'aceSuperLogoutBtn';
    button.textContent = 'Sair';
    button.addEventListener('click', function(){
      var token = getSessionToken();
      clearSession();
      setStatus('Sessão encerrada.');
      showLogin('Sessão encerrada. Entre novamente para acessar a supervisão.', 'warn');
      if (token) {
        postJson({ action: PRIVATE_CONFIG.logoutAction, sessionToken: token }, { skipSession: true }).catch(function(){});
      }
    });
    actions.appendChild(button);
    topbar.appendChild(actions);
    state.logoutButton = button;
    updateSessionMeta();
    return button;
  }

  function isApiConfigured(){
    var apiUrl = getApiUrl();
    return !isPlaceholderApiUrl(apiUrl) && /^https?:\/\//i.test(apiUrl);
  }

  function isAuthErrorMessage(message){
    var text = String(message || '').toLowerCase();
    return text.indexOf('sessão do painel') !== -1 ||
      text.indexOf('sessao do painel') !== -1 ||
      text.indexOf('acesso restrito') !== -1 ||
      text.indexOf('não autorizado') !== -1 ||
      text.indexOf('nao autorizado') !== -1 ||
      text.indexOf('expirada') !== -1;
  }

  function unpackApiPayload(result){
    if (!result || typeof result !== 'object') {
      return result;
    }
    if (result.data && typeof result.data === 'object') {
      return Object.assign({}, result.data, result);
    }
    return result;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    var timeout = Number(timeoutMs || PRIVATE_CONFIG.timeoutMs || 25000);
    if (typeof AbortController !== 'function') {
      return fetch(url, options);
    }

    var controller = new AbortController();
    var timer = root.setTimeout(function(){
      controller.abort();
    }, timeout);

    return fetch(url, Object.assign({}, options || {}, { signal: controller.signal }))
      .catch(function(error){
        if (error && error.name === 'AbortError') {
          throw new Error('Tempo de conexão esgotado.');
        }
        throw error;
      })
      .finally(function(){
        root.clearTimeout(timer);
      });
  }

  function postJson(payload, options){
    var apiUrl = getApiUrl();
    if (!isApiConfigured()) {
      return Promise.reject(new Error('API não configurada. Verifique se assets/runtime-config.js foi publicado junto com super.html.'));
    }
    options = options || {};
    var body = Object.assign({}, payload || {});
    if (!body.access_module && !body.accessModule) {
      body.access_module = 'supervisao';
      body.accessModule = 'supervisao';
    }
    if (!options.skipSession) {
      var token = getSessionToken();
      if (token && !body.sessionToken && !body.session_token && !body.token && !body.auth_token) {
        body.sessionToken = token;
      }
    }
    return fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }, PRIVATE_CONFIG.timeoutMs).then(function(response){
      if (!response.ok) {
        throw new Error('Falha de comunicação com a Nuvem.');
      }
      return response.json();
    }).then(function(result){
      result = unpackApiPayload(result);
      if (!result || result.ok === false) {
        throw new Error((result && result.error) || 'A Nuvem recusou a atualização.');
      }
      return result;
    });
  }

  function loginPrivateAccess(cpf, senha){
    cpf = normalizeCpf(cpf);
    senha = String(senha || '').trim();
    if (!cpf || cpf.length !== 11 || !senha) {
      return Promise.reject(new Error('Informe CPF com 11 números e a senha do supervisor ou administrador.'));
    }
    return postJson({
      action: PRIVATE_CONFIG.loginAction,
      access_module: 'supervisao',
      accessModule: 'supervisao',
      cpf: cpf,
      senha: senha,
      password: senha
    }, { skipSession: true }).then(function(payload){
      payload = unpackApiPayload(payload);
      var agent = payload && payload.agent ? payload.agent : {};
      var session = {
        sessionToken: String(payload.sessionToken || payload.session_token || '').trim(),
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || 0) || 0,
        cpf: normalizeCpf(agent.cpf || cpf),
        nome: String(agent.nome || agent.name || 'Usuário autorizado').trim(),
        role: String(agent.role || 'autorizado').trim(),
        authenticatedAt: new Date().toISOString()
      };
      if (!session.sessionToken) {
        throw new Error('Sessão privada não retornada pela API.');
      }
      writeSession(session);
      hideLogin();
      installLogoutButton();
      return session;
    });
  }

  function requireAuthentication(){
    return ensureActiveSession(false).then(function(session){
      installLogoutButton();
      hideLogin();
      return session;
    });
  }

  function loadPrivateBundle(){
    return ensureActiveSession(false).then(function(session){
      return postJson({
        action: PRIVATE_CONFIG.bundleAction,
        access_module: 'supervisao',
        sessionToken: session && session.sessionToken ? session.sessionToken : getSessionToken(),
        limit: 30000
      }, { skipSession: true });
    });
  }

  function todayISO(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function formatDate(value){
    var parts = String(value || '').split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : (value || '-');
  }

  function formatTime(value){ return String(value || '').slice(0,5) || '--:--'; }

  function currentTimeLabel(){
    var d = new Date();
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function hasGps(visit){
    return visit && visit.gps_lat !== '' && visit.gps_lng !== '' &&
      Number.isFinite(Number(visit.gps_lat)) && Number.isFinite(Number(visit.gps_lng));
  }

  function mapsUrl(visit){
    if (!hasGps(visit)) return '';
    return 'https://www.google.com/maps?q=' + encodeURIComponent(String(visit.gps_lat) + ',' + String(visit.gps_lng));
  }

  function parseStamp(row){
    row = row || {};
    var candidates = [row.createdAt, row.updatedAt];
    for (var i = 0; i < candidates.length; i += 1) {
      if (!candidates[i]) continue;
      var parsed = new Date(candidates[i]);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    var data = String(row.data || '').trim();
    var hora = String(row.hora || '00:00').trim().slice(0,5) || '00:00';
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      var d = new Date(data + 'T' + hora + ':00');
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  function minutesSince(row){
    var stamp = parseStamp(row);
    if (!stamp) return null;
    return Math.max(0, Math.floor((Date.now() - stamp.getTime()) / 60000));
  }

  function ageLabel(row){
    var minutes = minutesSince(row);
    if (minutes === null) return 'sem horário';
    if (minutes < 1) return 'agora';
    if (minutes < 60) return 'há ' + minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    if (hours < 24) return 'há ' + hours + 'h' + (rest ? String(rest).padStart(2,'0') : '');
    return 'há ' + Math.floor(hours / 24) + ' dia(s)';
  }

  function isGpsStale(visit){
    var minutes = minutesSince(visit);
    return minutes !== null && minutes > GPS_STALE_MINUTES;
  }

  function isOpenVisit(visit){
    var s = normalizeLabel(visit.situacao);
    return s === 'visitado' || s === 'aberto';
  }

  function isClosedVisit(visit){
    var s = normalizeLabel(visit.situacao);
    return s === 'fechado' || s === 'recusa' || s === 'recusado';
  }

  function isRecoveredVisit(visit){ return normalizeLabel(visit.situacao) === 'recuperado'; }

  function isFocusVisit(visit){
    return normalizeLabel(visit.foco) === 'sim' || Number(visit.focusCount || 0) > 0 || Number(visit.depositFocusCount || 0) > 0;
  }

  function parseBreakdownMap(value){
    var map = {};
    String(value || '').split('|').map(function(part){ return part.trim(); }).filter(Boolean).forEach(function(part){
      var match = part.match(/^([A-Z0-9]+)\((\d+)\)$/i) || part.match(/^([A-Z0-9]+)\s*[:=-]\s*(\d+)$/i);
      if (!match) return;
      var code = String(match[1] || '').trim().toUpperCase();
      var qty = Number(match[2] || 0) || 0;
      if (code && qty) map[code] = (map[code] || 0) + qty;
    });
    return map;
  }

  function getVisitBpiGrams(visit){
    var currentVisit = visit || {};
    var treatmentTotal = Number(currentVisit.depositTreatmentCount || currentVisit.deposit_treatment_count || currentVisit.depositTreatmentTotal || 0) || 0;
    if (treatmentTotal > 0) return treatmentTotal;
    return Number(currentVisit.larvicidaQty || currentVisit.larvicida_qtd || 0) || 0;
  }

  function getVisitTreatedDepositCount(visit){
    var currentVisit = visit || {};
    var treatmentMap = parseBreakdownMap(currentVisit.depositTreatmentBreakdown || currentVisit.deposit_treatment_breakdown || '');
    var depositMap = parseBreakdownMap(currentVisit.deposits || '');
    var focusMap = parseBreakdownMap(currentVisit.depositFocusBreakdown || currentVisit.deposit_focus_breakdown || '');
    var treated = 0;
    Object.keys(treatmentMap).forEach(function(code){
      if (Number(treatmentMap[code] || 0) > 0) {
        treated += Math.max(1, Number(depositMap[code] || 0), Number(focusMap[code] || 0));
      }
    });
    if (treated > 0) return treated;
    if (getVisitBpiGrams(currentVisit) > 0) {
      var focusTotal = Object.keys(focusMap).reduce(function(total, code){ return total + (Number(focusMap[code] || 0) || 0); }, 0);
      var depositTotal = Number(currentVisit.depositCount || currentVisit.deposit_count || 0) || Object.keys(depositMap).reduce(function(total, code){ return total + (Number(depositMap[code] || 0) || 0); }, 0);
      return focusTotal || depositTotal || 1;
    }
    return 0;
  }

  function operationModeCode(visit){
    var value = normalizeLabel((visit && visit.operationMode) || 'VD');
    if (value === 'pe' || value.indexOf('ponto estrategico') > -1 || value.indexOf('p e') > -1) return 'PE';
    if (value.indexOf('liraa') > -1 || value.indexOf('lira') > -1) return 'LIRAA';
    return 'VD';
  }

  function operationModeLabel(code){ return code === 'PE' ? 'P.E.' : code === 'LIRAA' ? 'LIRAa' : 'VD'; }

  function statusText(row){
    var status = String(row && (row.status || row.ladderSupportStatus) || 'Aberta').trim();
    return status || 'Aberta';
  }

  function statusClass(row){
    var value = normalizeLabel(statusText(row));
    if (value.indexOf('conclu') > -1 || value.indexOf('resolvid') > -1) return 'ok';
    if (value.indexOf('atendimento') > -1 || value.indexOf('andamento') > -1) return 'blue';
    return 'warn';
  }

  function isStatusClosed(row){
    var status = normalizeLabel(statusText(row));
    return status.indexOf('conclu') > -1 || status.indexOf('resolvid') > -1 || status.indexOf('cancelad') > -1 || status === 'fechada' || status === 'fechado';
  }

  function requestedLadder(visit){
    if (isStatusClosed({ status: visit.ladderSupportStatus })) return false;
    var reason = normalizeLabel(visit.waterAccessReason);
    var requested = normalizeLabel(visit.ladderSupportRequested);
    var status = normalizeLabel(visit.ladderSupportStatus);
    var noReason = normalizeLabel(visit.ladderSupportNoReason);
    if (normalizeLabel(visit.waterAccess) !== 'nao') return false;
    if (reason.indexOf('escada') === -1) return false;
    if (requested === 'nao' || noReason) return false;
    return requested === 'sim' || requested.indexOf('solicit') > -1 || status.indexOf('solicit') > -1 || status.indexOf('abert') > -1 || status.indexOf('atendimento') > -1;
  }

  function address(visit){
    var street = [visit.logradouro || '', visit.numero || ''].filter(Boolean).join(', ').trim();
    var territory = [visit.bairro || '', visit.microarea || '', visit.quarteirao ? 'Q ' + visit.quarteirao : ''].filter(Boolean).join(' • ');
    if (street && territory) return street + ' • ' + territory;
    if (street) return street;
    if (territory) return territory;
    return hasGps(visit) ? 'Localização GPS registrada' : 'Local não informado';
  }

  function sortDesc(a,b){
    return String((b.data || '') + ' ' + (b.hora || '') + ' ' + (b.updatedAt || ''))
      .localeCompare(String((a.data || '') + ' ' + (a.hora || '') + ' ' + (a.updatedAt || '')));
  }

  function sortUrgency(a,b){
    if (a.priority !== b.priority) return a.priority - b.priority;
    var at = parseStamp(a.visit);
    var bt = parseStamp(b.visit);
    return (at ? at.getTime() : Date.now()) - (bt ? bt.getTime() : Date.now());
  }

  function todayVisits(){
    var today = todayISO();
    var rows = state.visits.filter(function(v){ return v.data === today; });
    return rows.length ? rows : state.visits.slice().sort(sortDesc).slice(0, 300);
  }

  function todaySupervisionRequests(){
    var today = todayISO();
    var rows = state.supervisionRequests.filter(function(row){ return row.data === today; });
    return rows.length ? rows : state.supervisionRequests.slice().sort(sortDesc).slice(0, 100);
  }

  function activeSupervisionRequests(){
    return todaySupervisionRequests().filter(function(row){ return !isStatusClosed(row); }).sort(function(a,b){
      var at = parseStamp(a);
      var bt = parseStamp(b);
      return (at ? at.getTime() : Date.now()) - (bt ? bt.getTime() : Date.now());
    });
  }

  function activeEarlyClosures(){
    var today = todayISO();
    var openRows = state.earlyClosures.filter(function(row){ return !isStatusClosed(row); });
    var rows = openRows.filter(function(row){ return row.data === today; });
    return (rows.length ? rows : openRows.slice()).sort(sortDesc).slice(0, 100);
  }

  function latestAgents(){
    var map = {};
    todayVisits().filter(hasGps).forEach(function(visit){
      var key = visit.matricula || visit.agente;
      var stamp = String((visit.data || '') + 'T' + (visit.hora || '00:00') + ' ' + (visit.updatedAt || ''));
      if (!key) return;
      if (!map[key] || stamp > map[key].stamp) map[key] = { key:key, stamp:stamp, visit:visit };
    });
    return Object.keys(map).map(function(k){ return map[k].visit; }).sort(sortDesc);
  }

  function staleGpsAgents(){
    return latestAgents().filter(function(visit){
      return isGpsStale(visit);
    });
  }

  function ladderRequests(){ return todayVisits().filter(requestedLadder).sort(sortDesc); }

  function sum(rows, getter){ return rows.reduce(function(total,row){ return total + Number(getter(row) || 0); }, 0); }

  function kpi(label, value, hint, tone){
    return '<article class="super-kpi ' + escapeHtml(tone || '') + '">' +
      '<small>' + escapeHtml(label) + '</small>' +
      '<strong>' + escapeHtml(value) + '</strong>' +
      '<span>' + escapeHtml(hint || '') + '</span>' +
      '</article>';
  }

  function renderOperationSummary(rows){
    var order = ['VD','PE','LIRAA'];
    var summary = { VD:0, PE:0, LIRAA:0 };
    rows.forEach(function(visit){ summary[operationModeCode(visit)] += 1; });
    var html = order.map(function(code){
      return '<div class="super-operation-chip"><strong>' + escapeHtml(operationModeLabel(code)) + '</strong><span>' + escapeHtml(summary[code]) + ' visita(s)</span></div>';
    }).join('');
    var target = $('superOperationList');
    if (target) target.innerHTML = html;
  }

  function queueItems(){
    var items = [];
    ladderRequests().forEach(function(visit){
      var priority = isFocusVisit(visit) ? 1 : 2;
      items.push({ kind:'ladder', priority:priority, title:'Pedido de escada', text:address(visit), visit:visit, tone:isFocusVisit(visit) ? 'danger' : 'warn' });
    });
    activeSupervisionRequests().forEach(function(request){
      items.push({ kind:'supervision', priority:3, title:'Solicitação de supervisão', text:request.mensagem || 'Agente solicitou apoio em campo.', visit:request, tone:'warn' });
    });
    activeEarlyClosures().forEach(function(row){
      items.push({ kind:'early_close', priority:4, title:'Encerramento antecipado', text:row.justificativa || 'Agente encerrou antes do horário previsto.', visit:row, tone:'warn' });
    });
    staleGpsAgents().forEach(function(visit){
      items.push({ kind:'stale_gps', priority:5, title:'Agente sem GPS recente', text:(visit.agente || 'Agente') + ' • ' + address(visit), visit:visit, tone:'warn' });
    });
    return items.sort(sortUrgency);
  }

  function statusButtons(kind, row){
    var uid = row && row.uid ? String(row.uid) : '';
    if (!uid || isStatusClosed(row) || kind === 'stale_gps') return '';
    var status = normalizeLabel(statusText(row));
    var buttons = [];
    if (kind === 'early_close') {
      buttons.push('<button class="super-mini-btn super-status-btn super-status-done" type="button" data-status-kind="early_close" data-status-uid="' + escapeHtml(uid) + '" data-status-value="Concluída">Limpar aviso</button>');
      buttons.push('<button class="super-mini-btn super-status-btn" type="button" data-status-kind="early_close" data-status-uid="' + escapeHtml(uid) + '" data-status-value="Cancelada">Cancelar</button>');
      return buttons.join('');
    }
    if (status.indexOf('atendimento') === -1) {
      buttons.push('<button class="super-mini-btn super-status-btn" type="button" data-status-kind="' + escapeHtml(kind) + '" data-status-uid="' + escapeHtml(uid) + '" data-status-value="Em atendimento">Iniciar atendimento</button>');
    }
    buttons.push('<button class="super-mini-btn super-status-btn super-status-done" type="button" data-status-kind="' + escapeHtml(kind) + '" data-status-uid="' + escapeHtml(uid) + '" data-status-value="Concluída">Concluir</button>');
    buttons.push('<button class="super-mini-btn super-status-btn" type="button" data-status-kind="' + escapeHtml(kind) + '" data-status-uid="' + escapeHtml(uid) + '" data-status-value="Cancelada">Cancelar</button>');
    return buttons.join('');
  }

  function renderActions(visit, kind){
    var url = mapsUrl(visit);
    return '<div class="super-actions">' +
      (url ? '<a class="super-mini-btn" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Abrir localização</a>' : '<span class="super-mini-btn super-mini-muted">Sem GPS</span>') +
      '<span class="super-mini-btn super-mini-muted">' + escapeHtml(visit.agente || 'Agente não informado') + '</span>' +
      ((kind === 'supervision' || kind === 'ladder' || kind === 'early_close') ? statusButtons(kind, visit) : '') +
      '</div>';
  }

  function renderQueueItem(item){
    var visit = item.visit || {};
    var status = statusText(visit);
    return '<article class="super-item super-queue-item ' + escapeHtml(item.kind || '') + '">' +
      '<div class="super-item-head"><h3>' + escapeHtml(item.title) + '</h3><div class="super-item-badges"><span class="super-pill ' + escapeHtml(statusClass(visit)) + '">' + escapeHtml(status) + '</span><span class="super-pill ' + escapeHtml(item.tone || '') + '">' + escapeHtml(ageLabel(visit)) + '</span></div></div>' +
      '<p>' + escapeHtml(item.text || address(visit)) + '</p>' +
      '<small>' + escapeHtml(operationModeLabel(operationModeCode(visit)) + ' • ' + (visit.microarea || '-') + ' • Q ' + (visit.quarteirao || '-') + ' • ' + formatDate(visit.data) + ' ' + formatTime(visit.hora)) + '</small>' +
      renderActions(visit, item.kind) +
      '</article>';
  }

  function renderSimpleItem(item){
    var visit = item.visit || {};
    var kind = item.kind || '';
    var status = statusText(visit);
    return '<article class="super-item">' +
      '<div class="super-item-head"><h3>' + escapeHtml(item.title) + '</h3><div class="super-item-badges"><span class="super-pill ' + escapeHtml(statusClass(visit)) + '">' + escapeHtml(status) + '</span><span class="super-pill ' + escapeHtml(item.tone || '') + '">' + escapeHtml(ageLabel(visit)) + '</span></div></div>' +
      '<p>' + escapeHtml(item.text || address(visit)) + '</p>' +
      '<small>' + escapeHtml(operationModeLabel(operationModeCode(visit)) + ' • ' + (visit.microarea || '-') + ' • Q ' + (visit.quarteirao || '-') + ' • ' + formatDate(visit.data)) + '</small>' +
      renderActions(visit, kind) +
      '</article>';
  }

  function renderQueue(){
    var items = queueItems();
    var activeSupervision = activeSupervisionRequests();
    var activeLadder = ladderRequests();
    var earlyClosures = activeEarlyClosures();
    var inService = items.filter(function(item){ return normalizeLabel(statusText(item.visit)).indexOf('atendimento') > -1; }).length;
    var stats = $('superQueueStats');
    var list = $('superQueueList');
    if (stats) {
      stats.innerHTML = [
        '<div class="super-operation-chip"><strong>' + escapeHtml(items.length) + '</strong><span>chamado(s) ativo(s)</span></div>',
        '<div class="super-operation-chip"><strong>' + escapeHtml(activeSupervision.length) + '</strong><span>supervisão</span></div>',
        '<div class="super-operation-chip"><strong>' + escapeHtml(activeLadder.length) + '</strong><span>escada</span></div>',
        '<div class="super-operation-chip"><strong>' + escapeHtml(earlyClosures.length) + '</strong><span>encerramento antecipado</span></div>',
        '<div class="super-operation-chip"><strong>' + escapeHtml(inService) + '</strong><span>em atendimento</span></div>'
      ].join('');
    }
    if (list) {
      list.innerHTML = items.length ? items.map(renderQueueItem).join('') : '<div class="super-empty"><strong>Nenhum chamado ativo.</strong><br>Solicitações de supervisão e pedidos de escada aparecerão aqui por prioridade.</div>';
    }
  }

  function renderResumo(){
    var rows = todayVisits();
    var ladder = ladderRequests();
    var supervision = activeSupervisionRequests();
    var earlyClosures = activeEarlyClosures();
    var agents = latestAgents();
    var dateLabel = $('superDateLabel');
    if (dateLabel) dateLabel.textContent = rows.length && rows[0].data === todayISO() ? formatDate(todayISO()) : 'Dados recentes';
    var kpis = $('superKpis');
    if (kpis) {
      kpis.innerHTML = [
        kpi('Visitas do dia', rows.length, 'registros', ''),
        kpi('Abertos', rows.filter(isOpenVisit).length, 'visitados', ''),
        kpi('Fechados', rows.filter(isClosedVisit).length, 'fechados/recusas', 'warn'),
        kpi('Recuperados', rows.filter(isRecoveredVisit).length, 'resolvidos', 'blue'),
        kpi('Total de depósitos', sum(rows, function(v){ return v.depositCount; }), 'encontrados', ''),
        kpi('Depósitos com foco', sum(rows, function(v){ return v.depositFocusCount || (isFocusVisit(v) ? 1 : 0); }), 'atenção', 'danger'),
        kpi('Depósitos tratados', sum(rows, getVisitTreatedDepositCount), 'com BPI', 'warn'),
        kpi('BPI aplicado (g)', sum(rows, getVisitBpiGrams), 'gramas', 'warn'),
        kpi('Tubitos', sum(rows, function(v){ return v.tubitosQty; }), 'coletados', 'blue'),
        kpi('Escada', ladder.length, 'ativas', ladder.length ? 'warn' : ''),
        kpi('Supervisão', supervision.length, 'ativas', supervision.length ? 'warn' : ''),
        kpi('Encerramentos', earlyClosures.length, 'antecipados', earlyClosures.length ? 'warn' : ''),
        kpi('Agentes', agents.length, 'com GPS', 'blue')
      ].join('');
    }
    renderOperationSummary(rows);
    renderEarlyClosures(earlyClosures);

    var priorities = [];
    earlyClosures.slice(0, 3).forEach(function(row){
      priorities.push({kind:'early_close', title:'Encerramento antecipado', text:row.justificativa || 'Agente encerrou antes do horário previsto.', visit:row, tone:'warn'});
    });
    activeSupervisionRequests().slice(0, 3).forEach(function(request){
      priorities.push({kind:'supervision', title:'Supervisão solicitada', text:request.mensagem || 'Agente solicitou supervisão em campo.', visit:request, tone:'warn'});
    });
    ladder.slice(0, 3).forEach(function(visit){
      priorities.push({kind:'ladder', title:'Escada solicitada', text:address(visit), visit:visit, tone:'warn'});
    });
    rows.filter(isFocusVisit).slice(0, 3).forEach(function(visit){
      priorities.push({title:'Foco encontrado', text:address(visit), visit:visit, tone:'danger'});
    });
    var count = $('superPriorityCount');
    var list = $('superPriorityList');
    if (count) count.textContent = String(priorities.length);
    if (list) list.innerHTML = priorities.length ? priorities.map(renderSimpleItem).join('') : '<div class="super-empty">Sem prioridade crítica no recorte.</div>';
  }

  function renderEarlyClosures(rows){
    var badge = $('superEarlyCloseBadge');
    var list = $('superEarlyCloseList');
    rows = Array.isArray(rows) ? rows : activeEarlyClosures();
    if (badge) badge.textContent = String(rows.length);
    if (!list) return;
    list.innerHTML = rows.length ? rows.map(function(row){
      return renderSimpleItem({ kind:'early_close', title:'Encerramento antecipado', text:row.justificativa || 'Agente encerrou antes do horário previsto.', visit:row, tone:'warn' });
    }).join('') : '<div class="super-empty">Nenhum encerramento antecipado registrado no recorte.</div>';
  }

  function renderSupervision(){
    var rows = activeSupervisionRequests();
    var badge = $('superRequestBadge');
    var list = $('superRequestList');
    if (badge) badge.textContent = String(rows.length);
    if (!list) return;
    list.innerHTML = rows.length ? rows.map(function(request){
      return renderSimpleItem({ kind:'supervision', title:'Solicitação de supervisão', text:request.mensagem || 'Agente solicitou supervisão em campo.', visit:request, tone:'warn' });
    }).join('') : '<div class="super-empty">Nenhuma solicitação de supervisão em aberto.</div>';
  }

  function renderLadder(){
    var rows = ladderRequests();
    var badge = $('superLadderBadge');
    var list = $('superLadderList');
    if (badge) badge.textContent = String(rows.length);
    if (!list) return;
    list.innerHTML = rows.length ? rows.map(function(visit){
      return renderSimpleItem({ kind:'ladder', title:'Solicitação de escada', text:address(visit), visit:visit, tone:isFocusVisit(visit) ? 'danger' : 'warn' });
    }).join('') : '<div class="super-empty">Nenhuma solicitação de escada em aberto.</div>';
  }

  function buildAgentSummaries(){
    var map = {};
    todayVisits().forEach(function(visit){
      var key = visit.matricula || visit.agente || 'agente';
      if (!map[key]) {
        map[key] = { key:key, agente:visit.agente || 'Agente', matricula:visit.matricula || '', total:0, focus:0, ladder:0, noGps:0, last:null, stamp:0 };
      }
      var item = map[key];
      item.total += 1;
      if (isFocusVisit(visit)) item.focus += 1;
      if (requestedLadder(visit)) item.ladder += 1;
      if (!hasGps(visit)) item.noGps += 1;
      var stamp = parseStamp(visit);
      var stampValue = stamp ? stamp.getTime() : 0;
      if (!item.last || stampValue >= item.stamp) {
        item.last = visit;
        item.stamp = stampValue;
      }
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){ return b.stamp - a.stamp; });
  }

  function renderAgents(){
    var rows = buildAgentSummaries();
    var badge = $('superAgentsBadge');
    var list = $('superAgentsList');
    if (badge) badge.textContent = String(rows.length);
    if (!list) return;
    list.innerHTML = rows.length ? rows.map(function(agent){
      var last = agent.last || {};
      var stale = last && hasGps(last) && isGpsStale(last);
      var pillTone = stale ? 'warn' : 'blue';
      var gpsText = !last || !hasGps(last) ? 'sem GPS recente' : (stale ? 'GPS desatualizado • ' : 'GPS recente • ') + ageLabel(last);
      return '<article class="super-item super-agent-item">' +
        '<div class="super-item-head"><h3>' + escapeHtml(agent.agente || 'Agente') + '</h3><span class="super-pill ' + escapeHtml(pillTone) + '">' + escapeHtml(gpsText) + '</span></div>' +
        '<p>' + escapeHtml(agent.total + ' visita(s) • ' + agent.focus + ' foco(s) • ' + agent.ladder + ' escada(s) • ' + agent.noGps + ' sem GPS') + '</p>' +
        '<small>' + escapeHtml('Último registro: ' + address(last) + ' • ' + formatDate(last.data) + ' ' + formatTime(last.hora)) + '</small>' +
        renderActions(last, '') +
        '</article>';
    }).join('') : '<div class="super-empty">Nenhum agente com produção no recorte.</div>';
  }

  function ensureMap(){
    if (!root.L) {
      var fallback = $('superMapFallback');
      if (fallback) fallback.hidden = false;
      return false;
    }
    if (state.map) return true;
    state.map = root.L.map('superMap', { zoomControl:true }).setView(CENTER, 15);
    root.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom:19,
      attribution:'Tiles &copy; Esri'
    }).addTo(state.map);
    state.markersLayer = root.L.layerGroup().addTo(state.map);
    return true;
  }

  function mapPoints(){
    var rows = todayVisits().filter(hasGps);
    var points = [];
    if (state.mapFilter === 'chamados') {
      activeSupervisionRequests().filter(hasGps).forEach(function(request){ points.push({kind:'Supervisão solicitada', tone:'warn', visit:request}); });
      ladderRequests().filter(hasGps).forEach(function(visit){ points.push({kind:'Pedido de escada', tone:isFocusVisit(visit) ? 'danger' : 'warn', visit:visit}); });
      return points;
    }
    if (state.mapFilter === 'visitas') {
      rows.forEach(function(visit){ points.push({kind:'Visita ' + operationModeLabel(operationModeCode(visit)), tone:'neutral', visit:visit}); });
      return points;
    }
    if (state.mapFilter === 'supervisao') {
      activeSupervisionRequests().filter(hasGps).forEach(function(request){ points.push({kind:'Supervisão solicitada', tone:'warn', visit:request}); });
      return points;
    }
    if (state.mapFilter === 'todos' || state.mapFilter === 'agentes') {
      latestAgents().forEach(function(visit){ points.push({kind:'Agente', tone:isGpsStale(visit) ? 'warn' : 'blue', visit:visit}); });
    }
    if (state.mapFilter === 'todos') {
      activeSupervisionRequests().filter(hasGps).forEach(function(request){ points.push({kind:'Supervisão solicitada', tone:'warn', visit:request}); });
    }
    if (state.mapFilter === 'todos' || state.mapFilter === 'escada') {
      rows.filter(requestedLadder).forEach(function(visit){ points.push({kind:'Escada', tone:isFocusVisit(visit) ? 'danger' : 'warn', visit:visit}); });
    }
    if (state.mapFilter === 'todos' || state.mapFilter === 'focos') {
      rows.filter(isFocusVisit).forEach(function(visit){ points.push({kind:'Foco', tone:'danger', visit:visit}); });
    }
    return points;
  }

  function markerIcon(tone){
    var color = tone === 'danger' ? '#ba3a34' : tone === 'warn' ? '#b76704' : tone === 'neutral' ? '#075f3f' : '#1f5f99';
    return root.L.divIcon({
      className:'super-div-marker',
      html:'<span style="display:block;width:22px;height:22px;border-radius:50%;background:' + color + ';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.34)"></span>',
      iconSize:[22,22],
      iconAnchor:[11,11]
    });
  }

  function renderMap(){
    if (!ensureMap()) return;
    var points = mapPoints();
    state.markersLayer.clearLayers();
    points.forEach(function(point){
      var v = point.visit;
      root.L.marker([Number(v.gps_lat), Number(v.gps_lng)], { icon:markerIcon(point.tone) })
        .bindPopup('<strong>' + escapeHtml(point.kind) + '</strong><br>' + escapeHtml(v.agente || '-') + '<br>' + escapeHtml(v.mensagem || address(v)) + '<br>' + escapeHtml(statusText(v)) + ' • ' + escapeHtml(ageLabel(v)))
        .addTo(state.markersLayer);
    });
    if (points.length) {
      var bounds = root.L.latLngBounds(points.map(function(p){ return [Number(p.visit.gps_lat), Number(p.visit.gps_lng)]; }));
      state.map.fitBounds(bounds.pad(0.25), { maxZoom:17 });
    } else {
      state.map.setView(CENTER, 15);
    }
    setTimeout(function(){ state.map.invalidateSize(); }, 90);
  }

  function showMyLocation(){
    if (!ensureMap()) return;
    if (!navigator.geolocation) {
      setStatus('GPS indisponível neste aparelho.');
      return;
    }
    setStatus('Capturando posição do supervisor...');
    navigator.geolocation.getCurrentPosition(function(position){
      var lat = Number(position.coords.latitude);
      var lng = Number(position.coords.longitude);
      if (state.selfMarker) state.map.removeLayer(state.selfMarker);
      state.selfMarker = root.L.marker([lat, lng], { icon: markerIcon('blue') }).addTo(state.map).bindPopup('<strong>Minha posição</strong>').openPopup();
      state.map.setView([lat, lng], 17);
      updateTopbarSummary();
    }, function(){
      setStatus('Não foi possível capturar a posição do supervisor.');
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
  }

  function updateTopbarSummary(){
    var queue = queueItems();
    var agents = latestAgents();
    setStatus('Chamados abertos: ' + queue.length + ' • Agentes ativos: ' + agents.length + ' • Atualizado ' + currentTimeLabel());
  }

  function renderAll(){
    renderQueue();
    renderResumo();
    renderSupervision();
    renderLadder();
    renderAgents();
    if (state.activeTab === 'mapa') renderMap();
    updateTopbarSummary();
  }

  function setStatus(text){
    var node = $('superStatusText');
    if (node) node.textContent = text;
  }

  function installBundle(payload){
    state.visits = Array.isArray(payload && payload.visits) ? payload.visits.map(normalizeVisit) : [];
    state.supervisionRequests = Array.isArray(payload && payload.supervision_requests) ? payload.supervision_requests.map(normalizeSupervisionRequest) : [];
    state.earlyClosures = Array.isArray(payload && payload.early_closures) ? payload.early_closures.map(normalizeEarlyClosure) : [];
    try {
      root.localStorage.setItem(SUPER_STORAGE_KEYS.visits, JSON.stringify(state.visits));
      root.localStorage.setItem(SUPER_STORAGE_KEYS.supervisionRequests, JSON.stringify(state.supervisionRequests));
      root.localStorage.setItem(SUPER_STORAGE_KEYS.earlyClosures, JSON.stringify(state.earlyClosures));
    } catch (error) {}
    var badge = $('superSyncBadge');
    if (badge) badge.textContent = (state.visits.length || state.supervisionRequests.length) ? 'Online' : 'Vazio';
    renderAll();
  }

  function loadFallback(){
    if (!getSessionToken()) {
      clearPrivateView();
      return;
    }
    var local = parseJson(root.localStorage && root.localStorage.getItem(SUPER_STORAGE_KEYS.visits), []);
    var localRequests = parseJson(root.localStorage && root.localStorage.getItem(SUPER_STORAGE_KEYS.supervisionRequests), []);
    var localEarlyClosures = parseJson(root.localStorage && root.localStorage.getItem(SUPER_STORAGE_KEYS.earlyClosures), []);
    state.visits = Array.isArray(local) ? local.map(normalizeVisit) : [];
    state.supervisionRequests = Array.isArray(localRequests) ? localRequests.map(normalizeSupervisionRequest) : [];
    state.earlyClosures = Array.isArray(localEarlyClosures) ? localEarlyClosures.map(normalizeEarlyClosure) : [];
    var badge = $('superSyncBadge');
    if (badge) badge.textContent = (state.visits.length || state.supervisionRequests.length) ? 'Local' : 'Vazio';
    renderAll();
  }

  function loadData(silentAuthRecovery){
    setStatus('Atualizando...');
    if (!isApiConfigured()) {
      loadFallback();
      showLogin('API não configurada para a supervisão privada.', 'error');
      return Promise.resolve(false);
    }
    return requireAuthentication().then(function(){
      return loadPrivateBundle().then(function(payload){
        if (!payload || payload.ok !== true) {
          throw new Error('API sem dados válidos.');
        }
        installBundle(payload);
        hideLogin();
        return true;
      });
    }).catch(function(error){
      if (isAuthErrorMessage(error && error.message) || String(error && error.message || '') === 'AUTH_REQUIRED') {
        clearSession();
        loadFallback();
        showLogin('Sua sessão expirou. Entre novamente para atualizar a supervisão.', silentAuthRecovery ? 'warn' : 'info');
        return false;
      }
      loadFallback();
      setStatus((error && error.message) || 'Não foi possível atualizar a supervisão.');
      return false;
    });
  }

  function switchTab(tab){
    state.activeTab = tab;
    Array.from(documentRef.querySelectorAll('[data-view]')).forEach(function(view){
      var active = view.getAttribute('data-view') === tab;
      view.hidden = !active;
      view.classList.toggle('is-active', active);
    });
    Array.from(documentRef.querySelectorAll('[data-tab]')).forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    if (tab === 'mapa') setTimeout(renderMap, 130);
    window.scrollTo(0, 0);
  }

  function applyLocalStatus(kind, uid, status){
    if (kind === 'supervision') {
      state.supervisionRequests.forEach(function(row){
        if (String(row.uid || '') === String(uid || '')) {
          row.status = status;
          row.updatedAt = new Date().toISOString();
        }
      });
      try { root.localStorage.setItem(SUPER_STORAGE_KEYS.supervisionRequests, JSON.stringify(state.supervisionRequests)); } catch (error) {}
      return;
    }
    if (kind === 'ladder') {
      state.visits.forEach(function(row){
        if (String(row.uid || '') === String(uid || '')) {
          row.ladderSupportStatus = status;
          row.updatedAt = new Date().toISOString();
        }
      });
      try { root.localStorage.setItem(SUPER_STORAGE_KEYS.visits, JSON.stringify(state.visits)); } catch (error) {}
      return;
    }
    if (kind === 'early_close') {
      state.earlyClosures.forEach(function(row){
        if (String(row.uid || '') === String(uid || '')) {
          row.status = status;
          row.updatedAt = new Date().toISOString();
        }
      });
      try { root.localStorage.setItem(SUPER_STORAGE_KEYS.earlyClosures, JSON.stringify(state.earlyClosures)); } catch (error) {}
    }
  }

  function updateStatus(kind, uid, status, button){
    if (!kind || !uid || !status || state.statusBusy) return;
    state.statusBusy = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando...';
    }
    setStatus('Atualizando status...');
    var action = kind === 'ladder'
      ? 'ladder_request_status'
      : (kind === 'early_close' ? 'early_closure_status' : 'supervision_request_status');
    ensureActiveSession(false).then(function(){
      return postJson({
        action: action,
        access_module: 'supervisao',
        accessModule: 'supervisao',
        uid: uid,
        status: status,
        updatedAt: new Date().toISOString()
      });
    }).then(function(){
      applyLocalStatus(kind, uid, status);
      renderAll();
      setStatus('Status atualizado: ' + status + '.');
      setTimeout(updateTopbarSummary, 1200);
    }).catch(function(error){
      if (isAuthErrorMessage(error && error.message)) {
        clearSession();
        showLogin('Sua sessão expirou. Entre novamente para continuar a supervisão.', 'warn');
      }
      setStatus((error && error.message) || 'Não foi possível atualizar o status.');
    }).finally(function(){
      state.statusBusy = false;
      if (button) button.disabled = false;
    });
  }

  function bindEvents(){
    var refresh = $('superRefreshBtn');
    if (refresh) refresh.addEventListener('click', loadData);
    var myLocation = $('superMyLocationBtn');
    if (myLocation) myLocation.addEventListener('click', showMyLocation);

    Array.from(documentRef.querySelectorAll('[data-tab]')).forEach(function(btn){
      btn.addEventListener('click', function(){ switchTab(btn.getAttribute('data-tab')); });
    });
    Array.from(documentRef.querySelectorAll('[data-map-filter]')).forEach(function(btn){
      btn.addEventListener('click', function(){
        state.mapFilter = btn.getAttribute('data-map-filter');
        Array.from(documentRef.querySelectorAll('[data-map-filter]')).forEach(function(item){ item.classList.toggle('active', item === btn); });
        renderMap();
      });
    });
    documentRef.addEventListener('click', function(event){
      var button = event.target && event.target.closest ? event.target.closest('[data-status-kind]') : null;
      if (!button) return;
      updateStatus(button.getAttribute('data-status-kind'), button.getAttribute('data-status-uid'), button.getAttribute('data-status-value'), button);
    });
  }

  function boot(){
    ensureLoginOverlay();
    bindEvents();
    bindActivityMonitor();
    documentRef.addEventListener('visibilitychange', function(){
      if (documentRef.visibilityState === 'visible' && getSessionToken()) {
        ensureActiveSession(false).catch(function(){ return null; });
      }
    });
    requireAuthentication().then(function(){
      return loadData(true);
    }).catch(function(error){
      loadFallback();
      showLogin(
        error && error.message && error.message !== 'AUTH_REQUIRED'
          ? error.message
          : 'Entre com CPF e senha de Supervisor ou Administrador para abrir a supervisão.',
        'info'
      );
    });
  }

  if (documentRef.readyState === 'loading') documentRef.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
