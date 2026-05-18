(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var MODULE_VERSION = '20260517-tablet-v55-final';
  var LAB_API_TIMEOUT_MS = 25000;
  var TUBITOS_KEY = 'dengue_db_tubitos_v1';
  var LAB_SESSION_KEY = 'ace_lab_admin_session_v1';
  var LAB_DISMISSED_KEY = 'ace_lab_dismissed_done_tubitos_v1';

  var state = {
    selectedUid: '',
    query: '',
    cloudRows: null,
    labSession: null,
    activityBound: false,
    idleTimer: null,
    idleWarnTimer: null,
    sessionTicker: null,
    sessionRefreshPromise: null
  };

  function $(id) {
    return documentRef.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeOperationMode(value) {
    var mode = normalizeText(value).toUpperCase();
    if (mode === 'PE' || mode === 'P.E.' || mode === 'PONTO_ESTRATEGICO' || mode === 'PONTO ESTRATEGICO') {
      return 'PE';
    }
    if (mode === 'LIRA' || mode === 'LIRAA') {
      return 'LIRAA';
    }
    return 'VD';
  }

  function operationLabel(value) {
    var mode = normalizeOperationMode(value);
    if (mode === 'PE') {
      return 'P.E.';
    }
    if (mode === 'LIRAA') {
      return 'LIRAa';
    }
    return 'VD';
  }

  function operationClass(value) {
    return 'lab-op-' + normalizeOperationMode(value).toLowerCase();
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

  function readJson(key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeJson(key) {
    try {
      root.localStorage.removeItem(key);
    } catch (error) {}
  }

  function hashText(value) {
    if (!root.crypto || !root.crypto.subtle) {
      return Promise.reject(new Error('Este navegador nao oferece criptografia local para validar a senha.'));
    }

    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || ''))).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function getBundle() {
    return root.ACE_PANEL_CLOUD_BUNDLE ||
      (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getBundle === 'function'
        ? root.ACEPanelCloudSync.getBundle()
        : null) ||
      {};
  }

  function normalizeTubito(row) {
    row = row || {};
    return {
      uid: normalizeText(row.uid),
      numeroTubito: normalizeText(row.numero_tubito || row.numeroTubito),
      visitUid: normalizeText(row.visit_uid || row.visitUid),
      propertyUid: normalizeText(row.property_uid || row.propertyUid),
      dataColeta: normalizeText(row.data_coleta || row.dataColeta),
      horaColeta: normalizeText(row.hora_coleta || row.horaColeta),
      agente: normalizeText(row.agente),
      microarea: normalizeText(row.microarea),
      quarteirao: normalizeText(row.quarteirao),
      bairro: normalizeText(row.bairro),
      logradouro: normalizeText(row.logradouro),
      numero: normalizeText(row.numero),
      depositoCodigo: normalizeText(row.deposito_codigo || row.depositoCodigo).toUpperCase(),
      origemVisita: normalizeOperationMode(row.origem_visita || row.origemVisita || row.operation_mode || row.operationMode || 'VD'),
      operationMode: normalizeOperationMode(row.operation_mode || row.operationMode || row.origem_visita || row.origemVisita || 'VD'),
      peTipoLocal: normalizeText(row.pe_tipo_local || row.peTipoLocal),
      peNomeLocal: normalizeText(row.pe_nome_local || row.peNomeLocal),
      liraaCiclo: normalizeText(row.liraa_ciclo || row.liraaCiclo),
      statusLaboratorio: normalizeText(row.status_laboratorio || row.statusLaboratorio || 'Pendente'),
      resultadoLaboratorio: normalizeText(row.resultado_laboratorio || row.resultadoLaboratorio),
      especie: normalizeText(row.especie),
      positivoAedes: normalizeText(row.positivo_aedes || row.positivoAedes),
      analisadoPor: normalizeText(row.analisado_por || row.analisadoPor),
      analisadoEm: normalizeText(row.analisado_em || row.analisadoEm),
      observacaoLaboratorio: normalizeText(row.observacao_laboratorio || row.observacaoLaboratorio),
      updatedAt: normalizeText(row.updatedAt || row.updated_at)
    };
  }

  function readTubitos() {
    var bundle = getBundle();
    if ($('labStandaloneRoot') && !getLabSession()) {
      return [];
    }
    if (Array.isArray(state.cloudRows)) {
      return state.cloudRows.map(normalizeTubito);
    }
    if (Array.isArray(bundle.tubitos)) {
      return bundle.tubitos.map(normalizeTubito);
    }
    return (readJson(TUBITOS_KEY, []) || []).map(normalizeTubito);
  }

  function isPositiveAedes(row) {
    var explicit = normalizeKey(row && row.positivoAedes);
    var result = normalizeKey(row && row.resultadoLaboratorio);
    var species = normalizeKey(row && row.especie);
    return explicit === 'sim' || (result.indexOf('positivo') > -1 && species.indexOf('aedes') > -1);
  }

  function getTubitoQueueKey(row) {
    return normalizeText(row && (row.uid || row.numeroTubito || ''));
  }

  function isAnalyzedTubito(row) {
    var status = normalizeKey(row && row.statusLaboratorio);
    return !!(row && row.resultadoLaboratorio) ||
      status === 'concluido' ||
      status === 'descartado' ||
      status === 'negativo' ||
      status === 'positivo' ||
      status.indexOf('inconclus') > -1;
  }

  function readDismissedTubitos() {
    var rows = readJson(LAB_DISMISSED_KEY, {});
    return rows && typeof rows === 'object' && !Array.isArray(rows) ? rows : {};
  }

  function writeDismissedTubitos(map) {
    writeJson(LAB_DISMISSED_KEY, map || {});
  }

  function isDismissedFromLabQueue(row) {
    var key = getTubitoQueueKey(row);
    return !!(key && readDismissedTubitos()[key] && isAnalyzedTubito(row));
  }

  function getStats(rows) {
    var stats = { total: 0, pending: 0, positive: 0, done: 0, operation: { VD: 0, PE: 0, LIRAA: 0 } };
    rows.forEach(function (row) {
      var mode = normalizeOperationMode(row.operationMode || row.origemVisita);
      stats.total += 1;
      stats.operation[mode] = (stats.operation[mode] || 0) + 1;
      if (isPositiveAedes(row)) {
        stats.positive += 1;
      }
      if (!isAnalyzedTubito(row)) {
        stats.pending += 1;
      } else {
        stats.done += 1;
      }
    });
    return stats;
  }

  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return normalizeText(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '');
  }

  function getPrivateAction(action) {
    var map = {
      login: 'panel_login',
      bundle: 'panel_bundle_private',
      logout: 'panel_logout',
      status: 'panel_session_status',
      refresh: 'panel_session_refresh'
    };
    return map[action] || '';
  }
  function getLabSessionStorage() {
    try {
      return root.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function getIdleTimeoutMs() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    var minutes = Number(runtime.LAB_IDLE_TIMEOUT_MINUTES || 20);
    if (!minutes || Number.isNaN(minutes) || minutes < 1) {
      return 20 * 60 * 1000;
    }
    return minutes * 60 * 1000;
  }

  function enrichLabSession(session) {
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

  function getLabSessionRemainingMs(session) {
    var active = enrichLabSession(session || getLabSession());
    if (!active || !active.expiresAt) {
      return Infinity;
    }
    var expiresAtMs = Date.parse(active.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return Infinity;
    }
    return expiresAtMs - Date.now();
  }

  function shouldRefreshLabSession(session) {
    var remainingMs = getLabSessionRemainingMs(session);
    return Number.isFinite(remainingMs) && remainingMs <= (12 * 60 * 1000);
  }

  function formatLabSessionRemaining(ms) {
    if (!Number.isFinite(ms)) {
      return 'sessão privada ativa';
    }
    if (ms <= 0) {
      return 'expirando agora';
    }
    return Math.ceil(ms / 60000) + ' min restantes';
  }

  function updateLabSessionMeta() {
    var node = $('labSessionMeta');
    var session = getLabSession();
    if (!node) {
      return;
    }
    if (!session) {
      node.textContent = 'sem sessão privada';
      node.className = 'lab-session-meta is-idle';
      return;
    }
    var remainingMs = getLabSessionRemainingMs(session);
    node.textContent = formatLabSessionRemaining(remainingMs);
    node.className = 'lab-session-meta' + (remainingMs <= (5 * 60 * 1000) ? ' is-warn' : '');
  }

  function clearLabActivityTimers() {
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

  function expireLabForInactivity() {
    var session = getLabSession();
    var rootNode = $('labStandaloneRoot');
    clearLabActivityTimers();
    setLabSession(null);
    state.cloudRows = null;
    state.selectedUid = '';
    if (rootNode) {
      rootNode.innerHTML = getStandaloneLoginHtml();
      bindEvents();
    }
    setStatus('Sessão do laboratório encerrada por inatividade.', 'warn');
    if (session && session.sessionToken) {
      postJsonToApi({
        action: getPrivateAction('logout'),
        access_module: 'laboratorio',
        sessionToken: session.sessionToken
      }, {
        skipSessionValidation: true,
        skipSessionPayload: true
      }).catch(function () {});
    }
  }

  function resetLabActivityMonitor() {
    var timeout = getIdleTimeoutMs();
    clearLabActivityTimers();
    updateLabSessionMeta();
    if (!getLabSession()) {
      return;
    }
    if (timeout > 90000) {
      state.idleWarnTimer = root.setTimeout(function () {
        setStatus('Sessão do laboratório perto de expirar por inatividade.', 'warn');
      }, timeout - 60000);
    }
    state.idleTimer = root.setTimeout(expireLabForInactivity, timeout);
    state.sessionTicker = root.setInterval(updateLabSessionMeta, 30000);
  }

  function bindLabActivityMonitor() {
    if (state.activityBound) {
      return;
    }
    ['pointerdown', 'keydown', 'mousedown', 'touchstart', 'scroll', 'focus'].forEach(function (eventName) {
      root.addEventListener(eventName, function () {
        resetLabActivityMonitor();
      }, { passive: true });
    });
    state.activityBound = true;
    resetLabActivityMonitor();
  }

  function refreshLabSession(force) {
    var session = getLabSession();
    if (!session || !session.sessionToken) {
      return Promise.reject(new Error('Login autorizado obrigatorio.'));
    }
    if (!force && !shouldRefreshLabSession(session)) {
      return Promise.resolve(session);
    }
    if (state.sessionRefreshPromise) {
      return state.sessionRefreshPromise;
    }
    state.sessionRefreshPromise = postJsonToApi({
      action: getPrivateAction('refresh'),
      access_module: 'laboratorio',
      sessionToken: session.sessionToken
    }, {
      skipSessionValidation: true,
      skipSessionPayload: true
    }).then(function (payload) {
      var agent = payload && payload.agent ? payload.agent : {};
      var refreshed = enrichLabSession({
        cpf: normalizeCpf(agent.cpf || session.cpf || ''),
        sessionToken: normalizeText(payload.sessionToken || payload.session_token || session.sessionToken),
        nome: normalizeText(agent.nome || session.nome || 'Usuário autorizado'),
        matricula: normalizeText(agent.matricula || session.matricula || ''),
        role: normalizeText(agent.role || session.role || 'Autorizado'),
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || session.expiresInSeconds || 0) || 0,
        authenticatedAt: new Date().toISOString()
      });
      setLabSession(refreshed);
      return refreshed;
    }).finally(function () {
      state.sessionRefreshPromise = null;
    });
    return state.sessionRefreshPromise;
  }

  function ensureLabSessionActive(forceRefresh) {
    var session = getLabSession();
    if (!session || !session.sessionToken) {
      return Promise.reject(new Error('Login autorizado obrigatorio.'));
    }
    if (forceRefresh || shouldRefreshLabSession(session)) {
      return refreshLabSession(!!forceRefresh);
    }
    return postJsonToApi({
      action: getPrivateAction('status'),
      access_module: 'laboratorio',
      sessionToken: session.sessionToken
    }, {
      skipSessionValidation: true,
      skipSessionPayload: true
    }).then(function (payload) {
      var agent = payload && payload.agent ? payload.agent : {};
      var validated = enrichLabSession({
        cpf: normalizeCpf(agent.cpf || session.cpf || ''),
        sessionToken: normalizeText(session.sessionToken),
        nome: normalizeText(agent.nome || session.nome || 'Usuário autorizado'),
        matricula: normalizeText(agent.matricula || session.matricula || ''),
        role: normalizeText(agent.role || session.role || 'Autorizado'),
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || session.expiresInSeconds || 0) || 0,
        authenticatedAt: new Date().toISOString()
      });
      setLabSession(validated);
      return validated;
    }).catch(function (error) {
      setLabSession(null);
      throw error;
    });
  }


  function getLabSession() {
    if (state.labSession && state.labSession.sessionToken && state.labSession.cpf) {
      return state.labSession;
    }

    var sessionStore = getLabSessionStorage();
    var localLegacy = readJson(LAB_SESSION_KEY, null);
    if (sessionStore) {
      try {
        var raw = sessionStore.getItem(LAB_SESSION_KEY);
        state.labSession = raw ? enrichLabSession(JSON.parse(raw)) : null;
      } catch (error) {
        state.labSession = null;
      }
      if (!state.labSession && localLegacy && localLegacy.sessionToken) {
        state.labSession = enrichLabSession(localLegacy);
        try {
          sessionStore.setItem(LAB_SESSION_KEY, JSON.stringify(state.labSession));
        } catch (error) {}
        removeJson(LAB_SESSION_KEY);
      }
    } else {
      state.labSession = localLegacy ? enrichLabSession(localLegacy) : null;
    }

    return state.labSession && state.labSession.sessionToken && state.labSession.cpf
      ? state.labSession
      : null;
  }

  function setLabSession(session) {
    state.labSession = enrichLabSession(session || null);
    var sessionStore = getLabSessionStorage();

    if (sessionStore) {
      try {
        if (state.labSession) {
          sessionStore.setItem(LAB_SESSION_KEY, JSON.stringify(state.labSession));
        } else {
          sessionStore.removeItem(LAB_SESSION_KEY);
        }
      } catch (error) {}
      removeJson(LAB_SESSION_KEY);
    } else if (state.labSession) {
      writeJson(LAB_SESSION_KEY, state.labSession);
    } else {
      removeJson(LAB_SESSION_KEY);
    }

    if (!state.labSession) {
      state.cloudRows = null;
      state.selectedUid = '';
      root.ACE_LAB_TUBITOS = [];
    }

    resetLabActivityMonitor();
    updateLabSessionMeta();
  }

  function getLabAuthPayload() {
    var session = getLabSession();

    if (!session) {
      return {};
    }

    return {
      access_module: 'laboratorio',
      sessionToken: session.sessionToken
    };
  }

  function requireLabSession() {
    if (getLabSession()) {
      return true;
    }

    setStatus('Entre com CPF e senha de Supervisor ou Administrador para acessar o laboratório.', 'warn');
    return false;
  }

  function isApiConfigured() {
    var apiUrl = getApiUrl();
    return !!apiUrl && /^https?:\/\//i.test(apiUrl) && apiUrl.indexOf('COLE_AQUI') === -1;
  }

  function isLabAuthError(error) {
    var message = String(error && error.message ? error.message : error || '');
    return message.indexOf('Sessão do painel') > -1 || message.indexOf('Acesso restrito') > -1;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    var timeout = Number(timeoutMs || LAB_API_TIMEOUT_MS || 25000);
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

  function postJsonToApi(payload, options) {
    var apiUrl = getApiUrl();
    options = options || {};
    if ($('labStandaloneRoot') && !requireLabSession() && !options.skipSessionValidation) {
      return Promise.reject(new Error('Login autorizado obrigatorio.'));
    }
    if (!isApiConfigured()) {
      return Promise.reject(new Error('API_URL nao configurada.'));
    }
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('Fetch indisponivel neste navegador.'));
    }

    var body = Object.assign({}, payload || {});
    if (!options.skipSessionPayload) {
      body = Object.assign({}, getLabAuthPayload(), body);
    }

    return fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }, LAB_API_TIMEOUT_MS).then(function (response) {
      if (!response.ok) {
        throw new Error('A API nao confirmou o lancamento.');
      }
      return response.json();
    }).then(function (payloadResponse) {
      if (!payloadResponse || payloadResponse.ok === false) {
        throw new Error(payloadResponse && payloadResponse.error ? payloadResponse.error : 'Lancamento nao confirmado.');
      }
      return payloadResponse;
    });
  }

  function loadCloudTubitos() {
    if ($('labStandaloneRoot') && !requireLabSession()) {
      return Promise.reject(new Error('Login autorizado obrigatorio.'));
    }

    return ensureLabSessionActive(false).then(function (session) {
      return postJsonToApi({
        action: getPrivateAction('bundle'),
        access_module: 'laboratorio',
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        limit: 30000
      }, {
        skipSessionValidation: true
      });
    }).then(function (payload) {
      var tubitos = Array.isArray(payload.tubitos)
        ? payload.tubitos
        : (payload.data && Array.isArray(payload.data.tubitos) ? payload.data.tubitos : []);
      state.cloudRows = tubitos.map(normalizeTubito);
      root.ACE_LAB_TUBITOS = state.cloudRows;
      return state.cloudRows;
    }).catch(function (error) {
      if (isLabAuthError(error)) {
        state.cloudRows = null;
        root.ACE_LAB_TUBITOS = [];
        setLabSession(null);
      }
      throw error;
    });
  }

  function loginLaboratoryAdmin(cpf, password) {
    cpf = normalizeCpf(cpf);
    password = normalizeText(password);

    if (!isApiConfigured()) {
      return Promise.reject(new Error('API_URL nao configurada.'));
    }
    if (!cpf || cpf.length !== 11 || !password) {
      return Promise.reject(new Error('Informe CPF com 11 numeros e senha.'));
    }

    return postJsonToApi({
      action: getPrivateAction('login'),
      access_module: 'laboratorio',
      cpf: cpf,
      senha: password
    }, {
      skipSessionValidation: true,
      skipSessionPayload: true
    }).then(function (payload) {
      var agent = payload && payload.agent ? payload.agent : null;
      if (!agent) {
        throw new Error('CPF ou senha invalidos.');
      }
      var session = {
        cpf: normalizeCpf(agent.cpf || cpf),
        sessionToken: normalizeText(payload.sessionToken || payload.session_token),
        nome: normalizeText(agent.nome || agent.name || 'Usuário autorizado'),
        matricula: normalizeText(agent.matricula || ''),
        role: normalizeText(agent.role || 'Autorizado'),
        expiresInSeconds: Number(payload.expiresInSeconds || payload.expires_in_seconds || 0) || 0,
        authenticatedAt: new Date().toISOString()
      };
      if (!session.sessionToken) {
        throw new Error('Sessao privada nao retornada pela API.');
      }
      setLabSession(session);
      return session;
    });
  }

  function setStatus(message, kind) {
    var node = $('labStatus');
    if (!node) {
      return;
    }
    node.textContent = message || '';
    node.className = 'ace-status lab-status ' + (kind || 'info');
  }

  function ensureStyles() {
    if ($('aceLaboratorioStyles')) {
      return;
    }
    var style = documentRef.createElement('style');
    style.id = 'aceLaboratorioStyles';
    style.textContent = [
      ":root{--lab-ink:#183c2c;--lab-text:#1b252e;--lab-muted:#66727c;--lab-bg:#eef2ef;--lab-card:#fff;--lab-brand:#21563c;--lab-brand-soft:#2f7a52;--lab-accent:#4c7cc5;--lab-warn:#c78615;--lab-border:rgba(24,60,44,.12);--lab-shadow:0 18px 42px rgba(24,60,44,.08)}",
      ".lab-shell{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:16px}",
      ".lab-card{position:relative;overflow:hidden;border:1px solid var(--lab-border);border-radius:24px;background:linear-gradient(180deg,#fff,#f7faf8);padding:16px;box-shadow:var(--lab-shadow)}",
      ".lab-card::before{content:\"\";display:block;height:4px;margin:-16px -16px 16px;background:linear-gradient(90deg,#2f7a52,#4c7cc5 62%,#c78615)}",
      ".lab-login-shell{max-width:540px;margin:34px auto 0}",
      ".lab-login-card{position:relative;overflow:hidden;border:1px solid rgba(24,60,44,.12);border-radius:30px;background:linear-gradient(180deg,#ffffff,#f6faf8);padding:24px;box-shadow:0 22px 54px rgba(24,60,44,.14)}",
      ".lab-login-card::before{content:\"\";display:block;height:5px;margin:-24px -24px 20px;background:linear-gradient(90deg,#2f7a52,#4c7cc5 62%,#c78615)}",
      ".lab-login-card h2{margin:0;color:var(--lab-ink);font-size:1.45rem;letter-spacing:-.02em}",
      ".lab-login-card p{margin:8px 0 18px;color:var(--lab-muted);font-weight:750;line-height:1.45}",
      ".lab-login-form{display:grid;gap:13px}",
      ".lab-login-form label{font-weight:900;color:var(--lab-ink)}",
      ".lab-login-form input{width:100%;border:1px solid #ccd8d0;border-radius:16px;background:#fff;padding:12px 13px;font:inherit;margin-top:6px;box-shadow:0 8px 18px rgba(24,60,44,.035);outline:none;transition:border-color .16s ease,box-shadow .16s ease}",
      ".lab-login-form input:focus,.lab-toolbar input:focus,.lab-form input:focus,.lab-form select:focus,.lab-form textarea:focus{border-color:rgba(76,124,197,.72);box-shadow:0 0 0 4px rgba(76,124,197,.14)}",
      ".lab-session-bar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;padding:11px 13px;border:1px solid rgba(24,60,44,.10);border-radius:18px;background:linear-gradient(180deg,#ecfdf5,#e5f7ec);color:#166534;font-weight:850;box-shadow:0 10px 24px rgba(24,60,44,.06)}",
      ".lab-session-stack{display:flex;flex-direction:column;gap:4px}",
      ".lab-session-meta{display:inline-flex;align-items:center;width:max-content;padding:4px 9px;border-radius:999px;background:rgba(22,101,52,.12);color:#166534;font-size:12px;font-weight:900}",
      ".lab-session-meta.is-warn{background:rgba(202,138,4,.18);color:#854d0e}",
      ".lab-session-meta.is-idle{background:rgba(71,85,105,.18);color:#334155}",
      ".lab-session-bar button{border:0;border-radius:999px;padding:8px 11px;background:#dff7e8;color:#166534;font-weight:950;cursor:pointer}",
      ".lab-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}",
      ".lab-head-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}",
      ".lab-head strong{display:block;font-size:1.06rem;color:var(--lab-ink);letter-spacing:-.01em}",
      ".lab-head span{display:block;color:var(--lab-muted);font-size:.9rem;margin-top:3px}",
      ".lab-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:10px 0 14px}",
      ".lab-stat{position:relative;overflow:hidden;border:1px solid rgba(24,60,44,.10);border-radius:18px;padding:12px 11px;background:linear-gradient(180deg,#fff,#f4f8f6);box-shadow:0 12px 24px rgba(24,60,44,.06)}",
      ".lab-stat::before{content:\"\";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#2f7a52,#4c7cc5)}",
      ".lab-stat small{display:block;color:var(--lab-muted);font-weight:800}",
      ".lab-stat strong{display:block;font-size:1.38rem;color:var(--lab-ink);margin-top:2px}",
      ".lab-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}",
      ".lab-toolbar input{flex:1;min-width:220px;border:1px solid #ccd8d0;border-radius:15px;background:#fff;padding:11px 12px;font:inherit;outline:none;box-shadow:0 8px 18px rgba(24,60,44,.035);transition:border-color .16s ease,box-shadow .16s ease}",
      ".lab-table{display:grid;gap:8px;max-height:58vh;overflow:auto;padding-right:4px}",
      ".lab-row{border:1px solid rgba(24,60,44,.10);border-left:5px solid #86a394;border-radius:17px;padding:11px;background:linear-gradient(180deg,#fff,#f8fbf9);text-align:left;cursor:pointer;box-shadow:0 8px 18px rgba(24,60,44,.045);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}",
      ".lab-row:hover{transform:translateY(-1px);box-shadow:0 14px 26px rgba(24,60,44,.09)}",
      ".lab-row.is-selected{border-left-color:#4c7cc5;background:linear-gradient(180deg,#f3f7ff,#eaf0ff)}",
      ".lab-row.is-positive{border-left-color:#c34747;background:linear-gradient(180deg,#fff7f7,#fff1f1)}",
      ".lab-row.is-pending{border-left-color:#c78615;background:linear-gradient(180deg,#fffaf0,#fff5dd)}",
      ".lab-row strong{display:block;color:var(--lab-ink)}",
      ".lab-row span{display:block;color:#52616a;font-size:.88rem;margin-top:3px}",
      ".lab-row small{display:inline-block;margin:7px 6px 0 0;padding:4px 8px;border-radius:999px;background:#f1f5f9;color:#334155;font-weight:800}",
      ".lab-op{border:1px solid transparent}",
      ".lab-op-vd{background:#ecfdf5!important;color:#166534!important;border-color:#bbf7d0!important}",
      ".lab-op-pe{background:#fff7ed!important;color:#9a3412!important;border-color:#fed7aa!important}",
      ".lab-op-liraa{background:#eff6ff!important;color:#1e3a8a!important;border-color:#bfdbfe!important}",
      ".lab-form{display:grid;gap:10px}",
      ".lab-form label{font-weight:850;color:var(--lab-ink);font-size:.88rem}",
      ".lab-form input,.lab-form select,.lab-form textarea{width:100%;border:1px solid #ccd8d0;border-radius:15px;background:#fff;padding:11px 12px;font:inherit;outline:none;box-shadow:0 8px 18px rgba(24,60,44,.035);transition:border-color .16s ease,box-shadow .16s ease}",
      ".lab-form textarea{min-height:82px;resize:vertical}",
      ".lab-readonly{display:grid;gap:10px}",
      ".lab-readonly-empty{border:1px dashed #cbd5d0;border-radius:16px;padding:14px;background:#f8fbf9;color:#52616a;font-weight:800}",
      ".lab-detail-card{border:1px solid rgba(24,60,44,.10);border-radius:16px;padding:12px;background:linear-gradient(180deg,#fff,#f8fbf9);box-shadow:0 8px 18px rgba(24,60,44,.04)}",
      ".lab-detail-card small{display:block;color:var(--lab-muted);font-weight:900;text-transform:uppercase;letter-spacing:.04em}",
      ".lab-detail-card strong,.lab-detail-card span{display:block;color:var(--lab-ink);margin-top:3px}",
      ".lab-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
      ".lab-result-pill{display:inline-block;margin:4px 6px 0 0;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#1e3a8a;font-weight:900}",
      ".lab-result-pill.positive{background:#fef2f2;color:#991b1b}",
      ".lab-result-pill.pending{background:#fffbeb;color:#92400e}",
      ".lab-action-button{min-height:48px;border:0;border-radius:999px;padding:12px 18px;background:#21563c;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 12px 28px rgba(24,60,44,.22);transition:transform .16s ease,box-shadow .16s ease,background .16s ease}",
      ".lab-action-button:hover{transform:translateY(-1px);box-shadow:0 16px 30px rgba(24,60,44,.26);background:#2f7a52}",
      ".lab-action-button-soft{background:#eef6f1;color:#21563c;border:1px solid rgba(24,60,44,.14);box-shadow:none}",
      ".lab-action-button-soft:hover{background:#e2f0e8;color:#183c2c;box-shadow:none}",
      ".lab-card .btn.btn-soft{border-radius:999px;background:#eef6f1;color:#21563c;border:1px solid rgba(24,60,44,.14);font-weight:900}",
      ".lab-status{margin-top:10px;border-radius:15px;padding:10px 12px;font-weight:800;border:1px solid transparent}",
      ".lab-status.info{background:#eff6ff;color:#1e3a8a;border-color:#bfdbfe}",
      ".lab-status.ok{background:#ecfdf5;color:#166534;border-color:#bbf7d0}",
      ".lab-status.warn{background:#fffbeb;color:#92400e;border-color:#fde68a}",
      ".lab-status.error{background:#fef2f2;color:#991b1b;border-color:#fecaca}",
      "@media(max-width:920px){.lab-shell{grid-template-columns:1fr}.lab-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.lab-table{max-height:none}}",
      "@media(max-width:720px){.lab-detail-grid{grid-template-columns:1fr}.lab-login-shell{margin-top:18px}.lab-login-card{border-radius:24px;padding:20px}.lab-login-card::before{margin:-20px -20px 18px}.lab-session-bar{align-items:flex-start;flex-direction:column}.lab-session-bar button{width:100%;min-height:48px}.lab-action-button{width:100%;min-height:50px}}"
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function activateLabView() {
    documentRef.querySelectorAll('[data-panel-view]').forEach(function (button) {
      var active = button.getAttribute('data-panel-view') === 'laboratorio';
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    documentRef.querySelectorAll('[data-panel-view-content]').forEach(function (panel) {
      var active = panel.getAttribute('data-panel-view-content') === 'laboratorio';
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    render();
  }

  function getCoordinationViewHtml() {
    return [
      '<div class="panel-screen-head">',
      '<div class="screen-head-copy"><strong>Laboratório de tubitos</strong><span>Resultados consolidados das análises laboratoriais vinculadas às visitas e aos imóveis.</span></div>',
      '<div class="screen-badge">⌬</div>',
      '</div>',
      '<div class="ace-shell lab-shell">',
      '<section class="ace-card lab-card">',
      '<div class="ace-section-title lab-head"><div><strong>Fila e resultados</strong><span>Consulta por número, endereço, bairro, depósito, agente ou resultado.</span></div><button class="ace-btn ace-btn--soft btn btn-soft" id="labRefreshBtn" type="button">Atualizar nuvem</button></div>',
      '<div class="ace-stats lab-stats" id="labStats"></div>',
      '<div class="ace-toolbar lab-toolbar"><input id="labSearchInput" type="search" placeholder="Buscar tubito, visita, endereço, bairro, resultado..."></div>',
      '<div class="ace-list lab-table" id="labTubitoList"></div>',
      '</section>',
      '<section class="ace-card lab-card">',
      '<div class="ace-section-title lab-head"><div><strong>Resultado consolidado</strong><span>Área apenas para consulta da coordenação. O lançamento fica no painel próprio do laboratório.</span></div></div>',
      '<div class="ace-detail-list lab-readonly" id="labReadonlyDetails"></div>',
      '<div id="labStatus" class="ace-status lab-status info">Selecione um tubito para consultar os dados laboratoriais consolidados.</div>',
      '</section>',
      '</div>'
    ].join('');
  }

  function isCoordinationViewStale(view) {
    if (!view) {
      return false;
    }
    var content = normalizeKey(view.textContent || '');
    return !!view.querySelector('#labResultForm') ||
      !!view.querySelector('#labStatusSelect') ||
      content.indexOf('lancar') > -1 ||
      content.indexOf('analisar tubito') > -1 ||
      content.indexOf('atualize o resultado da analise') > -1;
  }

  function getStandaloneLoginHtml() {
    return [
      '<div class="ace-shell lab-login-shell">',
      '<section class="ace-card ace-login-card lab-login-card">',
      '<h2>Entrar no laboratorio</h2>',
      '<p>Use CPF e senha de Supervisor ou Administrador. ACE e Coordenador não acessam este laboratório.</p>',
      '<form class="ace-form lab-login-form" id="labLoginForm">',
      '<label>CPF do supervisor ou administrador<input id="labLoginCpf" type="text" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="000.000.000-00"></label>',
      '<label>Senha<input id="labLoginPassword" type="password" autocomplete="current-password" placeholder="Senha"></label>',
      '<button class="ace-btn ace-btn--primary lab-action-button" type="submit">Entrar no laboratorio</button>',
      '</form>',
      '<div id="labStatus" class="ace-status lab-status info">Acesso restrito a Supervisor ou Administrador.</div>',
      '</section>',
      '</div>'
    ].join('');
  }

  function getStandaloneLabHtml() {
    var session = getLabSession();
    return [
      '<div class="lab-session-bar">',
      '<div class="lab-session-stack"><span>Laboratorio autenticado: ' + escapeHtml(session && session.nome ? session.nome : 'Usuário autorizado') + ' • ' + escapeHtml(session && session.cpf ? formatCpf(session.cpf) : '') + '</span><span id="labSessionMeta" class="lab-session-meta">sessão privada ativa</span></div>',
      '<button type="button" id="labLogoutBtn">Sair</button>',
      '</div>',
      '<div class="ace-shell lab-shell">',
      '<section class="ace-card lab-card">',
      '<div class="ace-section-title lab-head"><div><strong>Fila laboratorial</strong><span>Busque por numero do tubito, visita, endereco, bairro, deposito ou agente.</span></div><div class="lab-head-actions"><button class="ace-btn ace-btn--primary lab-action-button" id="labRefreshBtn" type="button">Atualizar nuvem</button><button class="ace-btn ace-btn--soft lab-action-button lab-action-button-soft" id="labClearDoneBtn" type="button">Limpar analisados da fila</button></div></div>',
      '<div class="ace-stats lab-stats" id="labStats"></div>',
      '<div class="ace-toolbar lab-toolbar"><input id="labSearchInput" type="search" placeholder="Buscar tubito, visita, endereco, bairro..."></div>',
      '<div class="ace-list lab-table" id="labTubitoList"></div>',
      '</section>',
      '<section class="ace-card lab-card">',
      '<div class="ace-section-title lab-head"><div><strong>Lancar ou consultar resultado</strong><span>Selecione um tubito e atualize o resultado da analise.</span></div></div>',
      '<form class="ace-form lab-form" id="labResultForm">',
      '<label>Numero do tubito<input id="labNumeroTubito" type="text" readonly></label>',
      '<label>Status<select id="labStatusSelect"><option>Pendente</option><option>Em analise</option><option>Concluido</option><option>Inconclusivo</option><option>Descartado</option></select></label>',
      '<label>Resultado<select id="labResultadoSelect"><option value="">Selecione</option><option>Negativo</option><option>Positivo</option><option>Inconclusivo</option><option>Material inadequado</option></select></label>',
      '<label>Especie<select id="labEspecieSelect"><option value="">Nao identificado</option><option>Aedes aegypti</option><option>Aedes albopictus</option><option>Culex</option><option>Outro</option></select></label>',
      '<label>Analista<input id="labAnalistaInput" type="text" placeholder="Nome ou matricula"></label>',
      '<label>Observacao<textarea id="labObsInput" placeholder="Observacao tecnica opcional"></textarea></label>',
      '<button class="ace-btn ace-btn--primary lab-action-button" id="labSaveBtn" type="submit">Salvar resultado laboratorial</button>',
      '</form>',
      '<div id="labStatus" class="ace-status lab-status info">Carregando fila laboratorial...</div>',
      '</section>',
      '</div>'
    ].join('');
  }

  function ensureView() {
    var nav = documentRef.querySelector('.app-sidebar__nav');
    var workspace = documentRef.querySelector('.panel-workspace');
    var anchor = documentRef.querySelector('[data-panel-view="reports"]') || documentRef.querySelector('[data-panel-view="map"]');
    var button;
    var view;

    ensureStyles();

    if (nav && !$('sidebarLaboratorioBtn')) {
      button = documentRef.createElement('button');
      button.className = 'sidebar-tab';
      button.id = 'sidebarLaboratorioBtn';
      button.type = 'button';
      button.setAttribute('data-panel-view', 'laboratorio');
      button.setAttribute('aria-selected', 'false');
      button.innerHTML = '<span class="sidebar-tab__icon">⌬</span><span>Laboratório</span>';
      button.addEventListener('click', activateLabView);
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(button, anchor.nextSibling);
      } else {
        nav.appendChild(button);
      }
    }

    view = $('panelLaboratorioView');

    if (workspace && !view) {
      view = documentRef.createElement('div');
      view.className = 'panel-view';
      view.id = 'panelLaboratorioView';
      view.hidden = true;
      view.setAttribute('data-panel-view-content', 'laboratorio');
      view.innerHTML = getCoordinationViewHtml();
      workspace.appendChild(view);
    } else if (workspace && isCoordinationViewStale(view)) {
      view.innerHTML = getCoordinationViewHtml();
    }

    bindEvents();
  }

  function ensureStandaloneView() {
    var rootNode = $('labStandaloneRoot');

    if (!rootNode) {
      return false;
    }

    ensureStyles();

    if (!getLabSession()) {
      if (!$('labLoginForm')) {
        rootNode.innerHTML = getStandaloneLoginHtml();
      }
    } else if (!$('labTubitoList')) {
      rootNode.innerHTML = getStandaloneLabHtml();
    }

    bindEvents();
    return true;
  }

  function bindEvents() {
    var search = $('labSearchInput');
    var form = $('labResultForm');
    var refresh = $('labRefreshBtn');
    var loginForm = $('labLoginForm');
    var logout = $('labLogoutBtn');
    var clearDone = $('labClearDoneBtn');

    if (loginForm && loginForm.getAttribute('data-bound') !== '1') {
      loginForm.setAttribute('data-bound', '1');
      var cpfInput = $('labLoginCpf');
      if (cpfInput) {
        cpfInput.addEventListener('input', function () {
          var masked = formatCpf(cpfInput.value);
          if (cpfInput.value !== masked) {
            cpfInput.value = masked;
          }
        });
        cpfInput.value = formatCpf(cpfInput.value);
      }
      loginForm.addEventListener('submit', function (event) {
        event.preventDefault();
        setStatus('Validando usuário autorizado...', 'info');
        loginLaboratoryAdmin($('labLoginCpf').value || '', $('labLoginPassword').value || '').then(function () {
          var rootNode = $('labStandaloneRoot');
          if (rootNode) {
            rootNode.innerHTML = getStandaloneLabHtml();
          }
          bindEvents();
          render();
          updateLabSessionMeta();
          return refreshCloudData();
        }).catch(function (error) {
          setStatus(error.message || 'Nao foi possivel entrar no laboratorio.', 'error');
        });
      });
    }

    if (logout && logout.getAttribute('data-bound') !== '1') {
      logout.setAttribute('data-bound', '1');
      logout.addEventListener('click', function () {
        var rootNode = $('labStandaloneRoot');
        var session = getLabSession();
        setLabSession(null);
        state.cloudRows = null;
        state.selectedUid = '';
        if (rootNode) {
          rootNode.innerHTML = getStandaloneLoginHtml();
        }
        bindEvents();
        if (session && session.sessionToken) {
          postJsonToApi({
            action: getPrivateAction('logout'),
            access_module: 'laboratorio',
            sessionToken: session.sessionToken
          }, {
            skipSessionValidation: true,
            skipSessionPayload: true
          }).catch(function () {});
        }
      });
    }

    if (search && search.getAttribute('data-bound') !== '1') {
      search.setAttribute('data-bound', '1');
      search.addEventListener('input', function () {
        state.query = search.value || '';
        render();
      });
    }

    if (refresh && refresh.getAttribute('data-bound') !== '1') {
      refresh.setAttribute('data-bound', '1');
      refresh.addEventListener('click', function () {
        refreshCloudData();
      });
    }

    if (clearDone && clearDone.getAttribute('data-bound') !== '1') {
      clearDone.setAttribute('data-bound', '1');
      clearDone.addEventListener('click', clearAnalyzedQueue);
    }

    if (form && form.getAttribute('data-bound') !== '1') {
      form.setAttribute('data-bound', '1');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        saveSelectedResult();
      });
    }

    updateLabSessionMeta();
    resetLabActivityMonitor();
  }

  function getFilteredRows() {
    var query = normalizeKey(state.query);
    var rows = readTubitos();
    if (!query) {
      return rows.filter(function (row) { return !isDismissedFromLabQueue(row); });
    }
    return rows.filter(function (row) {
      if (isDismissedFromLabQueue(row)) {
        return false;
      }
      return normalizeKey([
        row.numeroTubito,
        row.visitUid,
        row.bairro,
        row.microarea,
        row.quarteirao,
        row.logradouro,
        row.numero,
        row.depositoCodigo,
        row.agente,
        operationLabel(row.operationMode),
        row.operationMode,
        row.peTipoLocal,
        row.peNomeLocal,
        row.liraaCiclo,
        row.statusLaboratorio,
        row.resultadoLaboratorio,
        row.especie
      ].join(' ')).indexOf(query) > -1;
    });
  }

  function renderStats(rows) {
    var stats = getStats(rows);
    var node = $('labStats');
    if (!node) {
      return;
    }
    node.innerHTML = [
      ['Tubitos', stats.total],
      ['Pendentes', stats.pending],
      ['Concluídos', stats.done],
      ['Aedes +', stats.positive],
      ['VD', stats.operation.VD || 0],
      ['P.E.', stats.operation.PE || 0],
      ['LIRAa', stats.operation.LIRAA || 0]
    ].map(function (item) {
      return '<div class="ace-stat-card lab-stat"><small>' + escapeHtml(item[0]) + '</small><strong>' + escapeHtml(item[1]) + '</strong></div>';
    }).join('');
  }

  function clearAnalyzedQueue() {
    var rows = readTubitos();
    var dismissed = readDismissedTubitos();
    var cleared = 0;

    rows.forEach(function (row) {
      var key = getTubitoQueueKey(row);
      if (key && isAnalyzedTubito(row) && !dismissed[key]) {
        dismissed[key] = new Date().toISOString();
        cleared += 1;
      }
    });

    writeDismissedTubitos(dismissed);
    state.selectedUid = '';
    renderReadonlyDetails(null);
    render();
    setStatus(cleared ? (cleared + ' tubito(s) analisado(s) removido(s) apenas da fila local.') : 'Nenhum tubito analisado para limpar da fila.', cleared ? 'ok' : 'warn');
  }

  function renderRows(rows) {
    var node = $('labTubitoList');
    if (!node) {
      return;
    }
    if (!rows.length) {
      node.innerHTML = '<div class="visit-list-empty">Nenhum tubito encontrado. Quando as visitas com tubitos forem sincronizadas, eles aparecerão aqui.</div>';
      return;
    }
    node.innerHTML = rows.map(function (row) {
      var tone = isPositiveAedes(row) ? ' is-positive' : (!isAnalyzedTubito(row) ? ' is-pending' : '');
      var operationInfo = [
        operationLabel(row.operationMode),
        row.peNomeLocal ? 'Local P.E.: ' + row.peNomeLocal : '',
        row.liraaCiclo ? 'Ciclo LIRAa: ' + row.liraaCiclo : ''
      ].filter(Boolean).join(' - ');
      return '<button type="button" class="ace-list-row lab-row' + tone + (state.selectedUid === row.uid ? ' is-selected' : '') + '" data-lab-uid="' + escapeHtml(row.uid) + '">' +
        '<strong>' + escapeHtml(row.numeroTubito || row.uid || '-') + '</strong>' +
        '<span>' + escapeHtml([row.logradouro + ', ' + row.numero, row.bairro, row.microarea ? 'MA ' + row.microarea : '', row.quarteirao ? 'Q ' + row.quarteirao : ''].filter(Boolean).join(' • ')) + '</span>' +
        '<span>' + escapeHtml('Visita: ' + (row.visitUid || '-') + ' • Agente: ' + (row.agente || '-') + ' • Depósito: ' + (row.depositoCodigo || '-')) + '</span>' +
        '<small class="ace-pill lab-op ' + escapeHtml(operationClass(row.operationMode)) + '">' + escapeHtml(operationInfo) + '</small>' +
        '<small>' + escapeHtml(row.statusLaboratorio || 'Pendente') + '</small>' +
        (row.resultadoLaboratorio ? '<small>' + escapeHtml(row.resultadoLaboratorio) + '</small>' : '') +
        (row.especie ? '<small>' + escapeHtml(row.especie) + '</small>' : '') +
      '</button>';
    }).join('');

    Array.prototype.forEach.call(node.querySelectorAll('[data-lab-uid]'), function (button) {
      button.addEventListener('click', function () {
        selectTubito(button.getAttribute('data-lab-uid'));
      });
    });
  }

  function renderReadonlyDetails(row) {
    var node = $('labReadonlyDetails');
    if (!node) {
      return;
    }
    if (!row) {
      node.innerHTML = '<div class="lab-readonly-empty">Selecione um tubito na lista para visualizar endereço, origem da coleta e resultado laboratorial consolidado.</div>';
      return;
    }

    var positive = isPositiveAedes(row);
    var pending = !row.resultadoLaboratorio || normalizeKey(row.statusLaboratorio).indexOf('pendente') > -1;
    var resultClass = positive ? ' positive' : (pending ? ' pending' : '');

    node.innerHTML = [
      '<div class="ace-card lab-detail-card">',
      '<small>Tubito</small>',
      '<strong>' + escapeHtml(row.numeroTubito || row.uid || '-') + '</strong>',
      '<span class="ace-pill lab-result-pill' + resultClass + '">' + escapeHtml(row.statusLaboratorio || 'Pendente') + '</span>',
      row.resultadoLaboratorio ? '<span class="ace-pill lab-result-pill' + resultClass + '">' + escapeHtml(row.resultadoLaboratorio) + '</span>' : '<span class="ace-pill lab-result-pill pending">Sem resultado lançado</span>',
      row.especie ? '<span class="ace-pill lab-result-pill' + resultClass + '">' + escapeHtml(row.especie) + '</span>' : '',
      '</div>',
      '<div class="lab-detail-grid">',
      '<div class="ace-card lab-detail-card"><small>Origem da coleta</small><strong>' + escapeHtml(operationLabel(row.operationMode)) + '</strong><span>' + escapeHtml([row.peTipoLocal, row.peNomeLocal, row.liraaCiclo ? 'Ciclo ' + row.liraaCiclo : ''].filter(Boolean).join(' - ') || 'Visita domiciliar de rotina') + '</span></div>',
      '<div class="ace-card lab-detail-card"><small>Endereço</small><strong>' + escapeHtml([row.logradouro, row.numero].filter(Boolean).join(', ') || '-') + '</strong><span>' + escapeHtml([row.bairro, row.microarea ? 'MA ' + row.microarea : '', row.quarteirao ? 'Q ' + row.quarteirao : ''].filter(Boolean).join(' • ')) + '</span></div>',
      '<div class="ace-card lab-detail-card"><small>Coleta</small><strong>' + escapeHtml(row.dataColeta || '-') + '</strong><span>' + escapeHtml('Agente: ' + (row.agente || '-') + ' • Depósito: ' + (row.depositoCodigo || '-')) + '</span></div>',
      '<div class="ace-card lab-detail-card"><small>Análise</small><strong>' + escapeHtml(row.analisadoPor || '-') + '</strong><span>' + escapeHtml(row.analisadoEm || row.updatedAt || 'Sem data de análise') + '</span></div>',
      '<div class="ace-card lab-detail-card"><small>Vínculo</small><strong>' + escapeHtml('Visita: ' + (row.visitUid || '-')) + '</strong><span>' + escapeHtml('Imóvel: ' + (row.propertyUid || '-')) + '</span></div>',
      '</div>',
      '<div class="ace-card lab-detail-card"><small>Observação laboratorial</small><span>' + escapeHtml(row.observacaoLaboratorio || 'Sem observação registrada.') + '</span></div>'
    ].join('');
  }

  function selectTubito(uid) {
    var row = readTubitos().find(function (item) {
      return item.uid === uid;
    });
    if (!row) {
      return;
    }
    state.selectedUid = uid;

    renderReadonlyDetails(row);

    if ($('labNumeroTubito')) { $('labNumeroTubito').value = row.numeroTubito || row.uid || ''; }
    if ($('labStatusSelect')) { $('labStatusSelect').value = row.statusLaboratorio || 'Pendente'; }
    if ($('labResultadoSelect')) { $('labResultadoSelect').value = row.resultadoLaboratorio || ''; }
    if ($('labEspecieSelect')) { $('labEspecieSelect').value = row.especie || ''; }
    if ($('labAnalistaInput')) { $('labAnalistaInput').value = row.analisadoPor || ''; }
    if ($('labObsInput')) { $('labObsInput').value = row.observacaoLaboratorio || ''; }

    setStatus('Tubito selecionado: ' + (row.numeroTubito || row.uid) + '.', 'info');
    render();
  }

  function saveSelectedResult() {
    if ($('labStandaloneRoot') && !requireLabSession()) {
      return;
    }

    var row = readTubitos().find(function (item) {
      return item.uid === state.selectedUid || item.numeroTubito === $('labNumeroTubito').value;
    });
    var resultado = $('labResultadoSelect').value || '';
    var especie = $('labEspecieSelect').value || '';

    if (!row) {
      setStatus('Selecione um tubito antes de salvar.', 'warn');
      return;
    }

    setStatus('Salvando resultado laboratorial...', 'info');

    var savePromise = $('labStandaloneRoot')
      ? ensureLabSessionActive(false)
      : (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.refreshSession === 'function'
          ? root.ACEPanelCloudSync.refreshSession(false).catch(function () { return null; })
          : Promise.resolve(null));

    savePromise.then(function () {
      return postJsonToApi({
        action: 'laboratorio_resultado',
        uid: row.uid,
        numero_tubito: row.numeroTubito,
        status_laboratorio: $('labStatusSelect').value || 'Concluído',
        resultado_laboratorio: resultado,
        especie: especie,
        positivo_aedes: normalizeKey(resultado).indexOf('positivo') > -1 && normalizeKey(especie).indexOf('aedes') > -1 ? 'Sim' : '',
        analisado_por: $('labAnalistaInput').value || '',
        observacao_laboratorio: $('labObsInput').value || ''
      });
    }).then(function () {
      setStatus('Resultado salvo. Atualizando painel...', 'ok');
      if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.reloadFromCloud === 'function') {
        return root.ACEPanelCloudSync.reloadFromCloud().then(render);
      }
      return loadCloudTubitos().then(render).catch(function () {
        render();
        return true;
      });
    }).catch(function (error) {
      if (isLabAuthError(error)) {
        setLabSession(null);
        state.cloudRows = null;
        state.selectedUid = '';
        ensureStandaloneView();
      }
      setStatus('Erro ao salvar: ' + error.message + '. Verifique se a API atualizada ja foi colada no Apps Script.', 'error');
    });
  }

  function refreshCloudData() {
    if ($('labStandaloneRoot') && !requireLabSession()) {
      return Promise.resolve(false);
    }

    setStatus('Atualizando dados da nuvem...', 'info');

    if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.reloadFromCloud === 'function') {
      var refreshPromise = root.ACEPanelCloudSync.refreshSession
        ? root.ACEPanelCloudSync.refreshSession(false).catch(function () { return null; }).then(function () {
            return root.ACEPanelCloudSync.reloadFromCloud();
          })
        : root.ACEPanelCloudSync.reloadFromCloud();

      return refreshPromise.then(function () {
        state.cloudRows = null;
        setStatus('Dados laboratoriais atualizados.', 'ok');
        render();
      }).catch(function (error) {
        setStatus('Nao foi possivel atualizar: ' + error.message, 'error');
      });
    }

    return loadCloudTubitos().then(function (rows) {
      setStatus('Dados laboratoriais atualizados: ' + rows.length + ' tubito(s).', 'ok');
      render();
    }).catch(function (error) {
      if (isLabAuthError(error)) {
        setLabSession(null);
        state.cloudRows = null;
        state.selectedUid = '';
        ensureStandaloneView();
      }
      render();
      setStatus('Nao foi possivel atualizar: ' + error.message, 'warn');
    });
  }

  function render() {
    var rows = getFilteredRows();
    renderStats(rows);
    renderRows(rows);
    if ($('labReadonlyDetails')) {
      var selected = readTubitos().find(function (item) { return item.uid === state.selectedUid; });
      renderReadonlyDetails(selected || null);
    }
  }

  function boot() {
    bindLabActivityMonitor();
    documentRef.addEventListener('visibilitychange', function () {
      if (documentRef.visibilityState === 'visible' && $('labStandaloneRoot') && getLabSession()) {
        ensureLabSessionActive(false).catch(function () { return null; });
      }
    });

    if (ensureStandaloneView()) {
      render();
      if (getLabSession()) {
        ensureLabSessionActive(false).catch(function () { return null; }).then(function () {
          updateLabSessionMeta();
          return refreshCloudData();
        });
      }
      return;
    }

    ensureView();
    render();
  }

  root.ACEPanelLaboratorio = {
    version: MODULE_VERSION,
    refreshCloudData: refreshCloudData,
    render: render,
    readTubitos: readTubitos
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  root.addEventListener('load', function () {
    setTimeout(boot, 600);
  });
}());
