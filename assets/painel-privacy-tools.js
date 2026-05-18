(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var version = '20260425-panel-privacy-auth1';
  var PRIVACY_KEY = 'ace_panel_privacy_mode_v1';
  var PANEL_CACHE_KEYS = [
    'dengue_db_visits_v1',
    'dengue_db_properties_v1',
    'dengue_db_system_state_v1'
  ];
  var OPTIONAL_AGENT_KEYS = [
    'dengue_db_agents_v1',
    'ace_agents_v1',
    'dengue_db_agentes_v1'
  ];

  var state = {
    settingsModal: null,
    noticeModal: null,
    localDataVisible: true,
    initialized: false
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

  function parseJson(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') {
      return fallback;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function readStorage(key, fallback) {
    try {
      return parseJson(root.localStorage.getItem(key), fallback);
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      root.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      root.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function formatDateTime(value) {
    if (!value) {
      return '-';
    }

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }




  function getBundle() {
    return root.ACE_PANEL_CLOUD_BUNDLE && root.ACE_PANEL_CLOUD_BUNDLE.ok
      ? root.ACE_PANEL_CLOUD_BUNDLE
      : null;
  }

  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return String(runtime.API_URL || '').trim();
  }

  function getPanelSessionInfo() {
    if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getSessionInfo === 'function') {
      return root.ACEPanelCloudSync.getSessionInfo() || null;
    }

    try {
      var raw = root.sessionStorage.getItem('ace_panel_private_session_v1');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function postJson(payload) {
    var apiUrl = getApiUrl();

    if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) {
      return Promise.reject(new Error('API não configurada em runtime-config.js.'));
    }

    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {})
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('A API não confirmou a operação.');
      }

      return response.json();
    }).then(function (result) {
      if (!result || result.ok === false) {
        throw new Error((result && result.error) || 'A operação foi recusada.');
      }

      return result;
    });
  }

  function countAgentsFromStorage() {
    var index;
    var data;

    for (index = 0; index < OPTIONAL_AGENT_KEYS.length; index += 1) {
      data = readStorage(OPTIONAL_AGENT_KEYS[index], []);

      if (Array.isArray(data) && data.length) {
        return data.length;
      }
    }

    return 0;
  }

  function countPending(visits, systemState) {
    var pending = 0;

    asArray(visits).forEach(function (visit) {
      if (!visit) {
        return;
      }

      if (
        visit.pendingSync ||
        visit.syncPending ||
        visit.dirty ||
        (!visit.syncedAt && !visit.sincronizado && !visit.cloudSynced)
      ) {
        pending += 1;
      }
    });

    if (systemState && (systemState.pendingSync || systemState.pendingReason)) {
      pending = Math.max(pending, 1);
    }

    return pending;
  }

  function getStatusText() {
    var statusNode = $('panelStatus') || $('acePanelCloudStatus') || $('panelModeChip') || $('panelStatusChip');
    var bundle = getBundle();

    if (statusNode && String(statusNode.textContent || '').trim()) {
      return String(statusNode.textContent || '').trim();
    }

    if (bundle) {
      return 'API carregada';
    }

    return 'Não informado';
  }

  function getLocalCounts() {
    var bundle = getBundle();
    var visits = readStorage('dengue_db_visits_v1', []);
    var properties = readStorage('dengue_db_properties_v1', []);
    var systemState = readStorage('dengue_db_system_state_v1', {});
    var agents = countAgentsFromStorage();

    if (bundle) {
      visits = Array.isArray(bundle.visits) ? bundle.visits : visits;
      properties = Array.isArray(bundle.properties) ? bundle.properties : properties;
      agents = Array.isArray(bundle.agents) ? bundle.agents.length : agents;

      if (bundle.generatedAt && (!systemState || !systemState.lastSyncAt)) {
        systemState = Object.assign({}, systemState || {}, { lastSyncAt: bundle.generatedAt });
      }
    }

    return {
      visits: asArray(visits).length,
      properties: asArray(properties).length,
      agents: Number(agents || 0),
      pending: countPending(visits, systemState),
      apiStatus: getStatusText(),
      lastLoad: bundle && bundle.generatedAt
        ? bundle.generatedAt
        : (systemState && (systemState.lastSyncAt || systemState.lastBootstrapAt)) || '',
      source: bundle ? 'nuvem/painel' : 'cache local'
    };
  }

  function injectStyles() {
    if ($('acePanelPrivacyToolsStyles')) {
      return;
    }

    var style = documentRef.createElement('style');
    style.id = 'acePanelPrivacyToolsStyles';
    style.textContent = [
      '.ace-panel-privacy-backdrop{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.58);padding:18px}',
      '.ace-panel-privacy-backdrop.is-open{display:flex}',
      '.ace-panel-privacy-dialog{width:min(820px,100%);max-height:92vh;overflow:auto;border-radius:24px;background:#fff;color:#0f172a;box-shadow:0 28px 70px rgba(15,23,42,.28);border:1px solid rgba(148,163,184,.32)}',
      '.ace-panel-privacy-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:20px 22px 14px;border-bottom:1px solid #e2e8f0}',
      '.ace-panel-privacy-header h2{margin:0;font-size:1.25rem;line-height:1.25;color:#0f172a}',
      '.ace-panel-privacy-header p{margin:6px 0 0;color:#475569;font-size:.94rem;line-height:1.45}',
      '.ace-panel-privacy-close{border:0;background:#f1f5f9;color:#0f172a;border-radius:999px;width:38px;height:38px;font-size:1.05rem;cursor:pointer}',
      '.ace-panel-privacy-body{padding:18px 22px 22px}',
      '.ace-panel-privacy-notice{padding:14px 16px;border-radius:18px;background:#f8fafc;border:1px solid #dbeafe;color:#1e3a8a}',
      '.ace-panel-privacy-notice strong{display:block;margin-bottom:6px;color:#1e3a8a;font-size:1rem}',
      '.ace-panel-privacy-notice p{margin:0;color:#334155;line-height:1.5}',
      '.ace-panel-update-box{margin-top:16px;padding:14px 16px;border-radius:18px;background:#f8fbff;border:1px solid rgba(37,99,235,.22);color:#0f172a}',
      '.ace-panel-update-box strong{display:block;margin-bottom:7px;color:#1d4ed8;font-size:1rem}',
      '.ace-panel-update-box p{margin:0 0 10px;color:#475569;font-size:.92rem;line-height:1.45}',
      '.ace-panel-update-status{margin-top:10px;font-size:.88rem;color:#475569;font-weight:700}',
      '.ace-panel-privacy-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}',
      '.ace-panel-privacy-btn{appearance:none;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;border-radius:14px;padding:10px 13px;font-weight:800;cursor:pointer;font:inherit;font-size:.92rem}',
      '.ace-panel-privacy-btn:hover{filter:brightness(.98)}',
      '.ace-panel-privacy-btn--primary{background:#145f3f;border-color:#145f3f;color:#fff}',
      '.ace-panel-privacy-btn--danger{background:#991b1b;border-color:#991b1b;color:#fff}',
      '.ace-panel-privacy-btn--warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}',
      '.ace-panel-privacy-local{margin-top:16px;padding:14px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0}',
      '.ace-panel-privacy-local[hidden]{display:none!important}',
      '.ace-panel-privacy-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}',
      '.ace-panel-privacy-metric{padding:12px;border-radius:14px;background:#fff;border:1px solid #e2e8f0;min-height:72px}',
      '.ace-panel-privacy-metric strong{display:block;font-size:1.22rem;color:#0f172a}',
      '.ace-panel-privacy-metric span{display:block;margin-top:3px;font-size:.82rem;color:#475569}',
      '.ace-panel-privacy-message{margin-top:12px;padding:10px 12px;border-radius:14px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;font-weight:700}',
      '.ace-panel-privacy-message[hidden]{display:none!important}',
      '.ace-panel-privacy-mode #dashboardTable,.ace-panel-privacy-mode #visitInspectionPanel,.ace-panel-privacy-mode #drilldownPanel,.ace-panel-privacy-mode #criticalStreetList,.ace-panel-privacy-mode #decisionList,.ace-panel-privacy-mode .consolidated-visits-list,.ace-panel-privacy-mode .visit-list-item,.ace-panel-privacy-mode .insight-list,.ace-panel-privacy-mode [data-lgpd-sensitive],.ace-panel-privacy-mode [data-sensitive],.ace-panel-privacy-mode [data-field*="nome"],.ace-panel-privacy-mode [data-field*="telefone"],.ace-panel-privacy-mode [data-field*="observacao"],.ace-panel-privacy-mode [data-field*="obs"]{filter:blur(4px);user-select:none}',
      '.ace-panel-privacy-mode #dashboardTable:hover,.ace-panel-privacy-mode #visitInspectionPanel:hover,.ace-panel-privacy-mode #drilldownPanel:hover,.ace-panel-privacy-mode #criticalStreetList:hover,.ace-panel-privacy-mode #decisionList:hover,.ace-panel-privacy-mode .consolidated-visits-list:hover,.ace-panel-privacy-mode .visit-list-item:hover,.ace-panel-privacy-mode .insight-list:hover{filter:blur(2px)}',
      '.ace-panel-privacy-floating{position:fixed;right:16px;bottom:16px;z-index:99990;border:0;border-radius:999px;background:#145f3f;color:#fff;padding:11px 14px;font-weight:800;box-shadow:0 16px 34px rgba(15,23,42,.24);cursor:pointer}',
      '.ace-panel-lock-screen{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.86);padding:20px;color:#fff}',
      '.ace-panel-lock-card{width:min(440px,100%);border-radius:24px;background:#fff;color:#0f172a;padding:26px;text-align:center;box-shadow:0 26px 80px rgba(0,0,0,.35)}',
      '.ace-panel-lock-card h2{margin:0 0 8px;font-size:1.35rem}',
      '.ace-panel-lock-card p{margin:0 0 18px;color:#475569}',
      '.ace-panel-admin-auth-backdrop{position:fixed;inset:0;z-index:100002;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.62);padding:18px}',
      '.ace-panel-admin-auth-backdrop.is-open{display:flex}',
      '.ace-panel-admin-auth-dialog{width:min(440px,100%);border-radius:22px;background:#fff;color:#0f172a;box-shadow:0 26px 80px rgba(15,23,42,.35);border:1px solid rgba(148,163,184,.36);padding:22px}',
      '.ace-panel-admin-auth-dialog h2{margin:0 0 6px;font-size:1.2rem;color:#0f172a}',
      '.ace-panel-admin-auth-dialog p{margin:0 0 16px;color:#475569;line-height:1.45;font-size:.92rem}',
      '.ace-panel-admin-auth-field{display:grid;gap:7px;margin-bottom:12px}',
      '.ace-panel-admin-auth-field label{font-size:.84rem;font-weight:800;color:#334155}',
      '.ace-panel-admin-auth-field input{min-height:44px;border-radius:12px;border:1px solid #cbd5e1;padding:0 12px;font-size:1rem}',
      '.ace-panel-admin-auth-status{min-height:20px;margin-top:8px;font-size:.86rem;font-weight:700;color:#475569}',
      '@media(max-width:720px){.ace-panel-privacy-dialog{border-radius:20px}.ace-panel-privacy-header,.ace-panel-privacy-body{padding-left:16px;padding-right:16px}.ace-panel-privacy-grid{grid-template-columns:1fr}.ace-panel-privacy-actions .ace-panel-privacy-btn{flex:1 1 100%}}'
    ].join('\n');

    documentRef.head.appendChild(style);
  }

  function setMessage(message, kind) {
    var box = $('acePanelPrivacyMessage');

    if (!box) {
      return;
    }

    box.hidden = false;
    box.textContent = message;
    box.style.background = kind === 'warn' ? '#fffbeb' : kind === 'danger' ? '#fef2f2' : '#ecfdf5';
    box.style.color = kind === 'warn' ? '#92400e' : kind === 'danger' ? '#991b1b' : '#166534';
    box.style.borderColor = kind === 'warn' ? '#fde68a' : kind === 'danger' ? '#fecaca' : '#bbf7d0';
  }

  function setUpdateStatus(message, kind) {
    var node = $('acePanelUpdateStatus');

    if (!node) {
      return;
    }

    node.textContent = message;
    node.style.color =
      kind === 'ok' ? '#166534' :
      kind === 'warn' ? '#92400e' :
      kind === 'error' ? '#991b1b' :
      '#475569';
  }

  function buildReloadUrl(paramName) {
    var url = new URL(root.location.href);
    url.searchParams.set(paramName, String(Date.now()));
    return url.toString();
  }

  function clearCachesIfPossible() {
    if (!root.caches || typeof root.caches.keys !== 'function') {
      return Promise.resolve();
    }

    return root.caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return root.caches.delete(key);
      }));
    }).catch(function () {
      return [];
    });
  }

  function unregisterServiceWorkersIfPossible() {
    if (!root.navigator || !root.navigator.serviceWorker || typeof root.navigator.serviceWorker.getRegistrations !== 'function') {
      return Promise.resolve();
    }

    return root.navigator.serviceWorker.getRegistrations().then(function (registrations) {
      return Promise.all((registrations || []).map(function (registration) {
        return registration.unregister();
      }));
    }).catch(function () {
      return [];
    });
  }

  function forcePanelUpdate() {
    setUpdateStatus('Atualizando arquivos do painel...', 'info');

    return Promise.all([
      clearCachesIfPossible(),
      unregisterServiceWorkersIfPossible()
    ]).finally(function () {
      root.location.href = buildReloadUrl('panelUpdate');
    });
  }

  function hardReloadWithoutCache() {
    setUpdateStatus('Recarregando painel sem cache...', 'info');
    root.location.href = buildReloadUrl('hardReload');
  }

  function requestJsonp(url) {
    return new Promise(function (resolve, reject) {
      var callbackName = '__ACE_PANEL_API_CHECK_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      var script = documentRef.createElement('script');
      var finished = false;

      function cleanup() {
        try {
          delete root[callbackName];
        } catch (error) {
          root[callbackName] = undefined;
        }

        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      var timer = root.setTimeout(function () {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();
        reject(new Error('Tempo esgotado ao verificar a API.'));
      }, 15000);

      root[callbackName] = function (payload) {
        if (finished) {
          return;
        }

        finished = true;
        root.clearTimeout(timer);
        cleanup();
        resolve(payload);
      };

      script.async = true;
      script.onerror = function () {
        if (finished) {
          return;
        }

        finished = true;
        root.clearTimeout(timer);
        cleanup();
        reject(new Error('Falha ao consultar a API.'));
      };

      script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + encodeURIComponent(callbackName);
      documentRef.head.appendChild(script);
    });
  }

  function checkApiStatus() {
    var session = getPanelSessionInfo();

    if (!session || !session.sessionToken) {
      setUpdateStatus('Entre no painel privado antes de verificar a API.', 'warn');
      return Promise.resolve(false);
    }

    setUpdateStatus('Verificando sessão privada do painel...', 'info');

    return postJson({
      action: 'panel_session_status',
      sessionToken: session.sessionToken
    }).then(function () {
      setUpdateStatus('API respondeu com sucesso usando a sessão privada.', 'ok');
      return true;
    }).catch(function (error) {
      setUpdateStatus('Erro ao verificar API: ' + error.message, 'error');
      return false;
    });
  }

  function sha256Text(text) {
    var value = String(text || '');
    var constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    function rightRotate(number, bits) {
      return (number >>> bits) | (number << (32 - bits));
    }

    function utf8Bytes(input) {
      var encoded = unescape(encodeURIComponent(input));
      var out = [];
      var i;
      for (i = 0; i < encoded.length; i += 1) {
        out.push(encoded.charCodeAt(i));
      }
      return out;
    }

    function fallback(input) {
      var hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
      var message = utf8Bytes(input);
      var words = [];
      var bitLength = message.length * 8;
      var blockEnd;
      var i;
      var j;

      for (i = 0; i < message.length; i += 1) {
        words[i >> 2] = (words[i >> 2] || 0) | (message[i] << ((3 - (i % 4)) * 8));
      }
      words[message.length >> 2] = (words[message.length >> 2] || 0) | (0x80 << ((3 - (message.length % 4)) * 8));
      blockEnd = (((message.length + 8) >> 6) + 1) * 16 - 1;
      words[blockEnd] = bitLength;

      for (i = 0; i < words.length; i += 16) {
        var schedule = [];
        var a = hash[0];
        var b = hash[1];
        var c = hash[2];
        var d = hash[3];
        var e = hash[4];
        var f = hash[5];
        var g = hash[6];
        var h = hash[7];

        for (j = 0; j < 16; j += 1) { schedule[j] = words[i + j] | 0; }
        for (j = 16; j < 64; j += 1) {
          var s0 = rightRotate(schedule[j - 15], 7) ^ rightRotate(schedule[j - 15], 18) ^ (schedule[j - 15] >>> 3);
          var s1 = rightRotate(schedule[j - 2], 17) ^ rightRotate(schedule[j - 2], 19) ^ (schedule[j - 2] >>> 10);
          schedule[j] = (schedule[j - 16] + s0 + schedule[j - 7] + s1) | 0;
        }
        for (j = 0; j < 64; j += 1) {
          var ch = (e & f) ^ (~e & g);
          var maj = (a & b) ^ (a & c) ^ (b & c);
          var sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
          var sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
          var t1 = (h + sum1 + ch + constants[j] + schedule[j]) | 0;
          var t2 = (sum0 + maj) | 0;
          h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        hash[0] = (hash[0] + a) | 0;
        hash[1] = (hash[1] + b) | 0;
        hash[2] = (hash[2] + c) | 0;
        hash[3] = (hash[3] + d) | 0;
        hash[4] = (hash[4] + e) | 0;
        hash[5] = (hash[5] + f) | 0;
        hash[6] = (hash[6] + g) | 0;
        hash[7] = (hash[7] + h) | 0;
      }
      return hash.map(function (item) { return (item >>> 0).toString(16).padStart(8, '0'); }).join('');
    }

    if (!(root.crypto && root.crypto.subtle && root.TextEncoder)) {
      return Promise.resolve(fallback(value));
    }

    return root.crypto.subtle.digest('SHA-256', new root.TextEncoder().encode(value)).then(function (digest) {
      return Array.from(new Uint8Array(digest)).map(function (item) { return item.toString(16).padStart(2, '0'); }).join('');
    }).catch(function () {
      return fallback(value);
    });
  }

  function validateAdminPassword(password) {
    var session = getPanelSessionInfo();
    var cpf = String(session && session.cpf || '').replace(/\D+/g, '').slice(0, 11);
    var secret = String(password || '').trim();

    if (!cpf || !secret) {
      return Promise.reject(new Error('Sessão do painel ausente ou senha não informada.'));
    }

    return postJson({
      action: 'panel_login',
      cpf: cpf,
      senha: secret
    }).then(function (payload) {
      if (!payload || payload.ok !== true || !payload.sessionToken) {
        throw new Error((payload && payload.error) || 'Senha administrativa inválida.');
      }
      return payload;
    });
  }

  function requestAdminAccess() {
    injectStyles();

    return new Promise(function (resolve, reject) {
      var overlay = $('acePanelAdminAuthModal');
      var status;
      var input;
      var form;
      var finished = false;

      function close() {
        if (overlay) {
          overlay.classList.remove('is-open');
        }
      }

      function done(ok, value) {
        if (finished) {
          return;
        }
        finished = true;
        close();
        if (ok) {
          resolve(value);
        } else {
          reject(value || new Error('Acesso cancelado.'));
        }
      }

      if (!overlay) {
        overlay = documentRef.createElement('div');
        overlay.id = 'acePanelAdminAuthModal';
        overlay.className = 'ace-panel-admin-auth-backdrop';
        overlay.innerHTML = [
          '<form class="ace-panel-admin-auth-dialog" id="acePanelAdminAuthForm">',
          '<h2>Acesso restrito</h2>',
          '<p>Digite a senha do administrador para abrir as Configurações do painel.</p>',
          '<div class="ace-panel-admin-auth-field">',
          '<label for="acePanelAdminPassword">Senha do administrador</label>',
          '<input id="acePanelAdminPassword" type="password" autocomplete="current-password" required>',
          '</div>',
          '<div class="ace-panel-privacy-actions">',
          '<button class="ace-panel-privacy-btn ace-panel-privacy-btn--primary" type="submit">Entrar</button>',
          '<button class="ace-panel-privacy-btn" type="button" id="acePanelAdminAuthCancel">Cancelar</button>',
          '</div>',
          '<div class="ace-panel-admin-auth-status" id="acePanelAdminAuthStatus" role="status"></div>',
          '</form>'
        ].join('');
        documentRef.body.appendChild(overlay);
      }

      status = $('acePanelAdminAuthStatus');
      input = $('acePanelAdminPassword');
      form = $('acePanelAdminAuthForm');

      if (status) {
        status.textContent = '';
        status.style.color = '#475569';
      }
      if (input) {
        input.value = '';
      }

      form.onsubmit = function (event) {
        var password;
        event.preventDefault();
        password = String(input && input.value || '').trim();
        if (!password) {
          if (status) {
            status.textContent = 'Informe a senha do administrador.';
            status.style.color = '#92400e';
          }
          return;
        }
        if (status) {
          status.textContent = 'Validando senha...';
          status.style.color = '#475569';
        }
        validateAdminPassword(password).then(function (payload) {
          done(true, payload);
        }).catch(function (error) {
          if (status) {
            status.textContent = error && error.message ? error.message : 'Senha administrativa inválida.';
            status.style.color = '#991b1b';
          }
        });
      };

      $('acePanelAdminAuthCancel').onclick = function () {
        done(false, new Error('Acesso cancelado.'));
      };

      overlay.classList.add('is-open');
      setTimeout(function () {
        if (input) {
          input.focus();
        }
      }, 30);
    });
  }

  function metricHtml(label, value) {
    return [
      '<div class="ace-panel-privacy-metric">',
      '<strong>', escapeHtml(value), '</strong>',
      '<span>', escapeHtml(label), '</span>',
      '</div>'
    ].join('');
  }

  function renderLocalCounts() {
    var box = $('acePanelPrivacyLocalGrid');
    var counts = getLocalCounts();
    var source;

    if (!box) {
      return counts;
    }

    box.innerHTML = [
      metricHtml('Visitas locais', counts.visits),
      metricHtml('Imóveis locais', counts.properties),
      metricHtml('Agentes locais', counts.agents || '-'),
      metricHtml('Pendências locais', counts.pending),
      metricHtml('Status da API', counts.apiStatus || '-'),
      metricHtml('Última carga', counts.lastLoad ? formatDateTime(counts.lastLoad) : '-')
    ].join('');

    source = $('acePanelPrivacyLocalSource');

    if (source) {
      source.textContent = 'Fonte atual das contagens: ' + counts.source + '.';
    }

    return counts;
  }

  function isPrivacyModeOn() {
    try {
      return root.localStorage.getItem(PRIVACY_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function setPrivacyMode(enabled) {
    writeStorage(PRIVACY_KEY, enabled ? '1' : '0');

    if (documentRef.body) {
      documentRef.body.classList.toggle('ace-panel-privacy-mode', !!enabled);
    }

    var btn = $('acePanelPrivacyToggleBtn');

    if (btn) {
      btn.textContent = enabled ? '👁️ Desativar privacidade' : '🔒 Ativar privacidade';
    }

    setMessage(
      enabled
        ? 'Modo privacidade ativado. Informações sensíveis foram desfocadas visualmente.'
        : 'Modo privacidade desativado.',
      enabled ? 'ok' : 'warn'
    );
  }

  function createSettingsModal() {
    if (state.settingsModal) {
      return state.settingsModal;
    }

    var backdrop = documentRef.createElement('div');
    backdrop.id = 'acePanelPrivacySettingsModal';
    backdrop.className = 'ace-panel-privacy-backdrop';
    backdrop.innerHTML = [
      '<section class="ace-panel-privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="acePanelPrivacySettingsTitle">',
      '<header class="ace-panel-privacy-header">',
      '<div>',
      '<h2 id="acePanelPrivacySettingsTitle">Configurações, privacidade e dados locais</h2>',
      '<p>Central de privacidade visual, atualização do sistema, bloqueio temporário e verificação de cache local do painel.</p>',
      '</div>',
      '<button class="ace-panel-privacy-close" id="acePanelPrivacyCloseX" type="button" aria-label="Fechar configurações">✕</button>',
      '</header>',
      '<div class="ace-panel-privacy-body">',
      '<div class="ace-panel-privacy-notice">',
      '<strong>🔒 Aviso de privacidade</strong>',
      '<p>Este painel é de uso restrito da coordenação. Ele pode exibir dados operacionais de visitas, imóveis, agentes, indicadores e localização aproximada por GPS. Use essas informações apenas para finalidade pública autorizada. Não compartilhe prints, relatórios, CSVs ou dados fora dos canais oficiais.</p>',
      '</div>',
      '<section class="ace-panel-update-box" id="acePanelUpdateBox">',
      '<strong>🔄 Atualização do sistema</strong>',
      '<p>Ferramentas rápidas para atualizar a interface do painel e verificar a comunicação com a API.</p>',
      '<div class="ace-panel-privacy-actions">',
      '<button class="ace-panel-privacy-btn" type="button" id="acePanelForceUpdateBtn">Atualizar sistema</button>',
      '<button class="ace-panel-privacy-btn" type="button" id="acePanelCheckApiBtn">Verificar API</button>',
      '<button class="ace-panel-privacy-btn" type="button" id="acePanelHardReloadBtn">Recarregar sem cache</button>',
      '</div>',
      '<div id="acePanelUpdateStatus" class="ace-panel-update-status">Pronto para verificar atualização.</div>',
      '</section>',
      '<div class="ace-panel-privacy-actions">',
      '<button class="ace-panel-privacy-btn ace-panel-privacy-btn--primary" id="acePanelPrivacyToggleBtn" type="button">🔒 Ativar privacidade</button>',
      '<button class="ace-panel-privacy-btn" id="acePanelPrivacyLocalBtn" type="button">Dados locais</button>',
      '<button class="ace-panel-privacy-btn ace-panel-privacy-btn--warn" id="acePanelPrivacyLockBtn" type="button">Bloquear painel</button>',
      '<button class="ace-panel-privacy-btn ace-panel-privacy-btn--danger" id="acePanelPrivacyClearBtn" type="button">Limpar dados locais</button>',
      '<button class="ace-panel-privacy-btn" id="acePanelPrivacyCloseBtn" type="button">Fechar</button>',
      '</div>',
      '<div id="acePanelPrivacyMessage" class="ace-panel-privacy-message" hidden></div>',
      '<section class="ace-panel-privacy-local" id="acePanelPrivacyLocalBox">',
      '<strong>Dados locais</strong>',
      '<p id="acePanelPrivacyLocalSource">Fonte atual das contagens: -.</p>',
      '<div class="ace-panel-privacy-grid" id="acePanelPrivacyLocalGrid"></div>',
      '</section>',
      '</div>',
      '</section>'
    ].join('');

    documentRef.body.appendChild(backdrop);
    state.settingsModal = backdrop;

    $('acePanelPrivacyCloseX').addEventListener('click', closeSettingsModal);
    $('acePanelPrivacyCloseBtn').addEventListener('click', closeSettingsModal);
    $('acePanelForceUpdateBtn').addEventListener('click', forcePanelUpdate);
    $('acePanelCheckApiBtn').addEventListener('click', checkApiStatus);
    $('acePanelHardReloadBtn').addEventListener('click', hardReloadWithoutCache);
    $('acePanelPrivacyToggleBtn').addEventListener('click', function () {
      setPrivacyMode(!isPrivacyModeOn());
    });
    $('acePanelPrivacyLocalBtn').addEventListener('click', function () {
      var box = $('acePanelPrivacyLocalBox');

      state.localDataVisible = !state.localDataVisible;

      if (box) {
        box.hidden = !state.localDataVisible;
      }

      renderLocalCounts();
      setMessage('Contagens locais atualizadas. Nenhum dado foi apagado.', 'ok');
    });
    $('acePanelPrivacyLockBtn').addEventListener('click', lockPanel);
    $('acePanelPrivacyClearBtn').addEventListener('click', clearPanelLocalData);

    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) {
        closeSettingsModal();
      }
    });

    return backdrop;
  }

  function openSettingsModal() {
    injectStyles();

    var modal = createSettingsModal();
    var btn;
    var message;

    renderLocalCounts();

    btn = $('acePanelPrivacyToggleBtn');

    if (btn) {
      btn.textContent = isPrivacyModeOn() ? '👁️ Desativar privacidade' : '🔒 Ativar privacidade';
    }

    message = $('acePanelPrivacyMessage');

    if (message) {
      message.hidden = true;
    }

    setUpdateStatus('Pronto para verificar atualização.', 'info');
    modal.classList.add('is-open');
  }

  function closeSettingsModal() {
    if (state.settingsModal) {
      state.settingsModal.classList.remove('is-open');
    }
  }

  function createNoticeModal() {
    if (state.noticeModal) {
      return state.noticeModal;
    }

    var backdrop = documentRef.createElement('div');
    backdrop.id = 'acePanelPrivacyNoticeModal';
    backdrop.className = 'ace-panel-privacy-backdrop';
    backdrop.innerHTML = [
      '<section class="ace-panel-privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="acePanelPrivacyNoticeTitle">',
      '<header class="ace-panel-privacy-header">',
      '<div>',
      '<h2 id="acePanelPrivacyNoticeTitle">🔒 Aviso de privacidade</h2>',
      '<p>Uso restrito da coordenação municipal.</p>',
      '</div>',
      '<button class="ace-panel-privacy-close" id="acePanelPrivacyNoticeCloseX" type="button" aria-label="Fechar aviso">✕</button>',
      '</header>',
      '<div class="ace-panel-privacy-body">',
      '<div class="ace-panel-privacy-notice">',
      '<strong>🔒 Aviso de privacidade</strong>',
      '<p>Este painel é de uso restrito da coordenação. Ele pode exibir dados operacionais de visitas, imóveis, agentes, indicadores e localização aproximada por GPS. Use essas informações apenas para finalidade pública autorizada. Não compartilhe prints, relatórios, CSVs ou dados fora dos canais oficiais.</p>',
      '</div>',
      '<div class="ace-panel-privacy-actions">',
      '<button class="ace-panel-privacy-btn ace-panel-privacy-btn--primary" id="acePanelPrivacyNoticeOk" type="button">Entendi</button>',
      '</div>',
      '</div>',
      '</section>'
    ].join('');

    documentRef.body.appendChild(backdrop);
    state.noticeModal = backdrop;

    $('acePanelPrivacyNoticeOk').addEventListener('click', closeNoticeModal);
    $('acePanelPrivacyNoticeCloseX').addEventListener('click', closeNoticeModal);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) {
        closeNoticeModal();
      }
    });

    return backdrop;
  }

  function openNoticeModal() {
    injectStyles();
    createNoticeModal().classList.add('is-open');
  }

  function closeNoticeModal() {
    if (state.noticeModal) {
      state.noticeModal.classList.remove('is-open');
    }
  }

  function lockPanel() {
    closeSettingsModal();

    var existing = $('acePanelLockScreen');

    if (existing) {
      existing.hidden = false;
      return;
    }

    var overlay = documentRef.createElement('div');
    overlay.id = 'acePanelLockScreen';
    overlay.className = 'ace-panel-lock-screen';
    overlay.innerHTML = [
      '<div class="ace-panel-lock-card" role="dialog" aria-modal="true" aria-labelledby="acePanelLockTitle">',
      '<h2 id="acePanelLockTitle">Painel bloqueado</h2>',
      '<p>Painel bloqueado por segurança.</p>',
      '<button class="ace-panel-privacy-btn ace-panel-privacy-btn--primary" id="acePanelUnlockBtn" type="button">Desbloquear painel</button>',
      '</div>'
    ].join('');

    documentRef.body.appendChild(overlay);
    $('acePanelUnlockBtn').addEventListener('click', function () {
      overlay.hidden = true;
    });
  }

  function clearPanelLocalData() {
    var confirmation = root.prompt('Para limpar apenas os caches locais do painel, digite exatamente LIMPAR.');
    var indexedRemovals = [];

    if (confirmation !== 'LIMPAR') {
      setMessage('Limpeza cancelada. Nenhum dado foi apagado.', 'warn');
      return;
    }

    PANEL_CACHE_KEYS.forEach(removeStorage);

    if (root.ACEIndexedStore && typeof root.ACEIndexedStore.remove === 'function') {
      PANEL_CACHE_KEYS.forEach(function (key) {
        try {
          indexedRemovals.push(Promise.resolve(root.ACEIndexedStore.remove(key)).catch(function () {
            return false;
          }));
        } catch (error) {}
      });
    }

    Promise.all(indexedRemovals).then(function () {
      setMessage('Caches locais do painel removidos. O painel será recarregado.', 'ok');
      setTimeout(function () {
        root.location.reload();
      }, 900);
    });
  }

  function connectSettingsButton() {
    var button = $('sidebarConfigBtn');
    var floating;

    if (button) {
      if (button.getAttribute('data-panel-privacy-bound') !== '1') {
        button.setAttribute('data-panel-privacy-bound', '1');
        button.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
          }
          requestAdminAccess().then(function () {
            openSettingsModal();
          }).catch(function () {
            return false;
          });
        }, true);
      }

      return;
    }

    if ($('acePanelPrivacyFloatingBtn')) {
      return;
    }

    floating = documentRef.createElement('button');
    floating.id = 'acePanelPrivacyFloatingBtn';
    floating.className = 'ace-panel-privacy-floating';
    floating.type = 'button';
    floating.textContent = 'Configurações';
    floating.addEventListener('click', function () { requestAdminAccess().then(openSettingsModal).catch(function () {}); });
    documentRef.body.appendChild(floating);
  }

  function handleEsc(event) {
    if (event.key !== 'Escape') {
      return;
    }

    closeSettingsModal();
    closeNoticeModal();
  }

  function boot() {
    if (state.initialized) {
      connectSettingsButton();
      return;
    }

    state.initialized = true;
    injectStyles();

    if (documentRef.body) {
      documentRef.body.classList.toggle('ace-panel-privacy-mode', isPrivacyModeOn());
    }

    connectSettingsButton();
    documentRef.addEventListener('keydown', handleEsc);

    setTimeout(function () {
      connectSettingsButton();
      openNoticeModal();
    }, 80);

    setTimeout(connectSettingsButton, 1000);
  }

  root.ACEPanelPrivacyTools = {
    version: version,
    openSettingsModal: openSettingsModal,
    closeSettingsModal: closeSettingsModal,
    setPrivacyMode: setPrivacyMode,
    clearPanelLocalData: clearPanelLocalData,
    lockPanel: lockPanel,
    getLocalCounts: getLocalCounts,
    forcePanelUpdate: forcePanelUpdate,
    checkApiStatus: checkApiStatus,
    hardReloadWithoutCache: hardReloadWithoutCache,
    requestAdminAccess: requestAdminAccess
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());



/* Fallback robusto: modal Agentes/Escada no mesmo arquivo que já protege Configurações.
   Motivo: se o painel-app ou o script separado atrasar/cachear, o botão Agentes continua abrindo. */
(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var version = '20260425-agents-fallback-inside-privacy2';
  var LADDER_ATTENDED_KEY = 'ace_panel_ladder_attended_v1';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseJson(raw, fallbackValue) {
    if (!raw) { return fallbackValue; }
    try { return JSON.parse(raw); } catch (error) { return fallbackValue; }
  }

  function normalizeLabel(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[’'`´]/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }



  function readAttendedRequests() {
    var raw;
    try {
      raw = root.localStorage && root.localStorage.getItem(LADDER_ATTENDED_KEY);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (error) {
      return {};
    }
  }

  function writeAttendedRequests(map) {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(LADDER_ATTENDED_KEY, JSON.stringify(map || {}));
      }
    } catch (error) {}
  }

  function getLadderRequestKey(visit) {
    visit = visit || {};
    return String(visit.uid || '').trim() || [
      visit.data || '',
      visit.hora || '',
      visit.agente || '',
      visit.matricula || '',
      visit.logradouro || '',
      visit.numero || '',
      visit.bairro || ''
    ].join('|');
  }

  function isLadderAttended(visit) {
    var key = getLadderRequestKey(visit);
    var attended = readAttendedRequests();
    return !!(key && attended[key]);
  }

  function markLadderAttended(key) {
    var attended = readAttendedRequests();
    if (!key) { return; }
    attended[key] = new Date().toISOString();
    writeAttendedRequests(attended);
  }

  function getOpenLadderRequests(visits) {
    return (visits || []).map(normalizeVisit).filter(requestedLadder).filter(function (visit) {
      return !isLadderAttended(visit);
    }).sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '') + ' ' + (b.updatedAt || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '') + ' ' + (a.updatedAt || '')));
    });
  }

  function getBundle() {
    return root.ACE_PANEL_CLOUD_BUNDLE && root.ACE_PANEL_CLOUD_BUNDLE.ok ? root.ACE_PANEL_CLOUD_BUNDLE : null;
  }

  function getVisits() {
    var bundle = getBundle();
    var local;

    if (bundle && Array.isArray(bundle.visits)) {
      return bundle.visits.slice();
    }

    local = parseJson(root.localStorage && root.localStorage.getItem('dengue_db_visits_v1'), []);
    return Array.isArray(local) ? local.slice() : [];
  }

  function textFrom(row, names) {
    row = row || {};
    for (var i = 0; i < names.length; i += 1) {
      var value = row[names[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  function numberFrom(row, names) {
    var text = textFrom(row, names);
    var value = Number(text);
    return Number.isFinite(value) ? value : '';
  }

  function normalizeVisit(row) {
    row = row || {};
    return {
      uid: textFrom(row, ['uid', 'id']),
      data: textFrom(row, ['data', 'date']),
      hora: textFrom(row, ['hora', 'time']),
      agente: textFrom(row, ['agente', 'agent', 'nome_agente']),
      matricula: textFrom(row, ['matricula', 'matrícula', 'agent_code']),
      bairro: textFrom(row, ['bairro']),
      microarea: textFrom(row, ['microarea', 'microárea']),
      quarteirao: textFrom(row, ['quarteirao', 'quarteirão']),
      logradouro: textFrom(row, ['logradouro', 'rua']),
      numero: textFrom(row, ['numero', 'número']),
      waterAccess: textFrom(row, ['acessou_caixa_agua', 'water_access', 'waterAccess']),
      waterAccessReason: textFrom(row, ['motivo_caixa_agua', 'water_access_reason', 'waterAccessReason']),
      ladderSupportRequested: textFrom(row, ['solicita_escada', 'ladder_support_requested', 'ladderSupportRequested']),
      hasLadderSupportRequestedField: row && (
        Object.prototype.hasOwnProperty.call(row, 'solicita_escada') ||
        Object.prototype.hasOwnProperty.call(row, 'ladder_support_requested') ||
        Object.prototype.hasOwnProperty.call(row, 'ladderSupportRequested')
      ),
      ladderSupportNoReason: textFrom(row, ['motivo_nao_solicitou_escada', 'ladder_support_no_reason', 'ladderSupportNoReason']),
      ladderSupportStatus: textFrom(row, ['ladder_support_status', 'ladderSupportStatus']),
      gps_lat: numberFrom(row, ['gps_lat', 'gpsLat', 'latitude', 'lat']),
      gps_lng: numberFrom(row, ['gps_lng', 'gpsLng', 'longitude', 'lng']),
      gps_acc: numberFrom(row, ['gps_acc', 'gpsAccuracy', 'accuracy']),
      updatedAt: textFrom(row, ['updatedAt', 'updated_at'])
    };
  }

  function hasGps(visit) {
    return !!(visit && visit.gps_lat !== '' && visit.gps_lng !== '' &&
      Number.isFinite(Number(visit.gps_lat)) && Number.isFinite(Number(visit.gps_lng)));
  }

  function needsLadder(visit) {
    var water = normalizeLabel(visit && visit.waterAccess);
    var reason = normalizeLabel(visit && visit.waterAccessReason);
    return water === 'nao' && reason.indexOf('escada') > -1;
  }


  function isRecentLadderFallback(visit) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var limit = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));
    var candidates = [
      String(visit && visit.data || '').slice(0, 10),
      String(visit && visit.updatedAt || '').slice(0, 10)
    ];

    return candidates.some(function (value) {
      var parts;
      var date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      parts = value.split('-').map(Number);
      date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date >= limit;
    });
  }

  function requestedLadder(visit) {
    var requested = normalizeLabel(visit && visit.ladderSupportRequested);
    var status = normalizeLabel(visit && visit.ladderSupportStatus);
    var noReason = normalizeLabel(visit && visit.ladderSupportNoReason);
    var hasExplicitRequestField = !!(visit && visit.hasLadderSupportRequestedField);

    if (!needsLadder(visit)) {
      return false;
    }

    if (requested === 'nao' || requested === 'não' || noReason) {
      return false;
    }

    if (requested === 'sim' ||
        requested.indexOf('solicit') > -1 ||
        status.indexOf('solicit') > -1) {
      return true;
    }

    return !hasExplicitRequestField && isRecentLadderFallback(visit);
  }

  function getLadderStatusText(visit) {
    if (visit && visit.ladderSupportStatus) {
      return visit.ladderSupportStatus;
    }
    if (visit && !visit.hasLadderSupportRequestedField && needsLadder(visit) && isRecentLadderFallback(visit)) {
      return 'Pendente de confirmação';
    }
    return 'Solicitada';
  }

  function formatDateBR(value) {
    var text = String(value || '').trim();
    var parts = text.split('-');
    if (parts.length === 3) {
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    return text || '-';
  }

  function mapsUrl(visit) {
    if (!hasGps(visit)) {
      return '';
    }
    return 'https://www.google.com/maps?q=' + encodeURIComponent(String(visit.gps_lat) + ',' + String(visit.gps_lng));
  }

  function buildFallbackPrintableLadderReportHtml(rows) {
    var generatedAt = new Date().toLocaleString('pt-BR');
    var cards = rows.map(function (visit, index) {
      var address = [visit.logradouro || '-', visit.numero || ''].filter(Boolean).join(', ') + ' • ' + (visit.bairro || '-');
      var url = mapsUrl(visit);
      return '' +
        '<article class="request-card">' +
          '<h2>Solicitação ' + (index + 1) + ' — ' + escapeHtml(visit.agente || 'Agente não informado') + '</h2>' +
          '<table>' +
            '<tr><th>Data/Hora</th><td>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + '</td></tr>' +
            '<tr><th>Local</th><td>' + escapeHtml(address) + '</td></tr>' +
            '<tr><th>Microárea / Quarteirão</th><td>' + escapeHtml((visit.microarea || '-') + ' / Q ' + (visit.quarteirao || '-')) + '</td></tr>' +
            '<tr><th>Status</th><td>' + escapeHtml(typeof getLadderStatusText === 'function' ? getLadderStatusText(visit) : (visit.ladderSupportStatus || 'Solicitada')) + '</td></tr>' +
            '<tr><th>GPS</th><td>' + (hasGps(visit) ? escapeHtml(String(visit.gps_lat) + ', ' + String(visit.gps_lng)) : 'Sem GPS registrado') + '</td></tr>' +
            '<tr><th>Mapa</th><td>' + (url ? '<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>' : 'Sem localização') + '</td></tr>' +
          '</table>' +
          '<div class="signature"><span>Recebido por</span><span>Data/Hora</span><span>Observação</span></div>' +
        '</article>';
    }).join('');

    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Solicitações de escada</title>' +
      '<style>' +
      'body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#f3f6f4;color:#14251b}.page{max-width:980px;margin:0 auto;padding:24px}' +
      'header{padding:18px 20px;border:1px solid #cfd9d2;background:#fff;border-radius:18px;margin-bottom:16px}h1{margin:0 0 6px;color:#0f3b29}p{margin:0;color:#5a6a61}' +
      '.request-card{page-break-inside:avoid;background:#fff;border:1px solid #cfd9d2;border-radius:18px;padding:18px 20px;margin:0 0 18px}h2{font-size:19px;color:#123c2a}' +
      'table{width:100%;border-collapse:collapse}th{width:190px;text-align:left;background:#f5f8f6;color:#263b30}th,td{border:1px solid #dfe7e2;padding:9px 10px;font-size:14px;vertical-align:top}a{color:#0645ad;word-break:break-all}' +
      '.signature{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:16px}.signature span{height:58px;border:1px solid #cfd9d2;border-radius:12px;display:flex;align-items:flex-end;padding:8px;color:#66756c;font-size:12px}' +
      '@media print{body{background:#fff}.page{padding:0}.request-card,header{box-shadow:none;border-radius:0}}' +
      '</style></head><body><main class="page"><header><h1>Solicitações de escada</h1><p>Relatório para equipe responsável pelo apoio em campo. Gerado em ' + escapeHtml(generatedAt) + '.</p></header>' +
      cards +
      '</main><script>window.addEventListener("load",function(){setTimeout(function(){window.print();},500);});<\/script></body></html>';
  }

  function printFallbackLadderRequestsReport() {
    var rows = getOpenLadderRequests(getVisits());
    var popup;
    var html;

    if (root.ACEPanelAgentsTools && typeof root.ACEPanelAgentsTools.printLadderRequestsReport === 'function') {
      root.ACEPanelAgentsTools.printLadderRequestsReport();
      return;
    }

    if (!rows.length) {
      root.alert('Não há solicitações de escada em aberto para imprimir.');
      return;
    }

    html = buildFallbackPrintableLadderReportHtml(rows);
    popup = root.open('', '_blank', 'width=1100,height=800,scrollbars=yes,resizable=yes');

    if (!popup) {
      root.alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.');
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    try { popup.focus(); } catch (error) {}
  }

  function buildLadderRequestsHtml(visits) {
    var rows = getOpenLadderRequests(visits);

    if (!rows.length) {
      return '<div class="empty-state"><strong>Nenhuma solicitação de escada em aberto.</strong><span>Só aparecem aqui pedidos confirmados como “Sim, solicitar escada”. Solicitações atendidas ficam ocultas neste painel.</span></div>';
    }

    return '' +
      '<div class="panel-ladder-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<button class="visit-inline-action" type="button" data-ladder-print-report="true">Imprimir PDF para equipe da escada</button>' +
        '<button class="visit-inline-action" type="button" data-ladder-attend-all="true">Limpar lista / marcar todas atendidas</button>' +
      '</div>' +
      rows.map(function (visit) {
        var address = [visit.logradouro || '-', visit.numero || ''].filter(Boolean).join(', ') + ' • ' + (visit.bairro || '-');
        var url = mapsUrl(visit);
        var key = getLadderRequestKey(visit);
        return '' +
          '<div class="insight-item panel-ladder-request-item">' +
            '<strong>' + escapeHtml(visit.agente || 'Agente não informado') + '</strong>' +
            '<span>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + ' • ' + escapeHtml(address) + '</span>' +
            '<small>Microárea: ' + escapeHtml(visit.microarea || '-') + ' • Q: ' + escapeHtml(visit.quarteirao || '-') + ' • Status: ' + escapeHtml(typeof getLadderStatusText === 'function' ? getLadderStatusText(visit) : (visit.ladderSupportStatus || 'Solicitada')) + '</small>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
              (url ? '<a class="visit-inline-action" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Abrir localização</a>' : '<small>GPS ainda não veio na sincronização desta solicitação.</small>') +
              '<button class="visit-inline-action" type="button" data-ladder-attend="' + escapeHtml(key) + '">Marcar atendida</button>' +
            '</div>' +
          '</div>';
      }).join('');
  }

  function buildAgentLocationsHtml(visits) {
    var latest = {};
    (visits || []).map(normalizeVisit).filter(hasGps).forEach(function (visit) {
      var key = visit.agente || visit.matricula || '';
      var stamp = String((visit.data || '') + 'T' + (visit.hora || '00:00') + ' ' + (visit.updatedAt || ''));
      if (!key) { return; }
      if (!latest[key] || stamp > latest[key].stamp) {
        latest[key] = { visit: visit, stamp: stamp };
      }
    });

    var rows = Object.keys(latest).map(function (key) { return latest[key].visit; }).sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '')));
    });

    if (!rows.length) {
      return '<div class="empty-state"><strong>Nenhuma localização encontrada.</strong><span>A localização aparece após visitas com GPS sincronizado.</span></div>';
    }

    return rows.map(function (visit, index) {
      var url = mapsUrl(visit);
      return '' +
        '<div class="ranking-item">' +
          '<strong>' + (index + 1) + '. ' + escapeHtml(visit.agente || 'Agente') + '</strong>' +
          '<span>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + ' • ' + escapeHtml([visit.logradouro, visit.numero].filter(Boolean).join(', ') || '-') + '</span>' +
          '<small>' + escapeHtml(String(visit.gps_lat) + ', ' + String(visit.gps_lng)) + ' • ' + escapeHtml(visit.bairro || '-') + '</small>' +
          (url ? '<a class="visit-inline-action" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Mapa</a>' : '') +
        '</div>';
    }).join('');
  }

  function injectAgentStyles() {
    if (documentRef.getElementById('acePanelAgentsFallbackStyle')) { return; }
    var style = documentRef.createElement('style');
    style.id = 'acePanelAgentsFallbackStyle';
    style.textContent = [
      '.ace-panel-agents-modal[hidden]{display:none!important}',
      '.ace-panel-agents-modal{position:fixed;inset:0;z-index:650;display:grid;place-items:center;padding:18px}',
      '.ace-panel-agents-backdrop{position:absolute;inset:0;background:rgba(6,25,17,.58);backdrop-filter:blur(4px)}',
      '.ace-panel-agents-dialog{position:relative;z-index:1;width:min(980px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:22px;border:1px solid #dbe5dd;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:18px}',
      '.ace-panel-agents-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #e4ece7;padding-bottom:12px;margin-bottom:14px}',
      '.ace-panel-agents-header h2{margin:2px 0 4px;color:#103a28;font-size:1.35rem}',
      '.ace-panel-agents-header p{margin:0;color:#5d6d64;font-size:.9rem}',
      '.ace-panel-agents-eyebrow{display:block;color:#0f6b45;font-weight:900;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em}',
      '.ace-panel-agents-close{border:0;border-radius:12px;background:#edf5f0;color:#173826;font-size:1.5rem;font-weight:900;width:42px;height:42px;cursor:pointer}',
      '.ace-panel-agents-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '.ace-panel-agents-box{border:1px solid #e0e8e3;background:#f8fbf9;border-radius:18px;padding:14px}',
      '.ace-panel-agents-box h3{margin:0 0 6px;color:#173826}',
      '.ace-panel-agents-box p{margin:0 0 12px;color:#5d6d64;font-size:.88rem;line-height:1.4}',
      '@media(max-width:760px){.ace-panel-agents-grid{grid-template-columns:1fr}.ace-panel-agents-dialog{padding:14px;border-radius:18px}}'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function closeAgentsModal() {
    var overlay = documentRef.getElementById('acePanelAgentsModal');
    if (overlay) { overlay.hidden = true; }
    documentRef.body.classList.remove('is-agents-modal-open');
  }

  function openAgentsModal() {
    var overlay = documentRef.getElementById('acePanelAgentsModal');
    var visits = getVisits();
    var bundle = getBundle();
    var generated = bundle && bundle.generatedAt ? ('Nuvem atualizada em ' + bundle.generatedAt) : 'Usando dados disponíveis no navegador';

    injectAgentStyles();

    if (!overlay) {
      overlay = documentRef.createElement('div');
      overlay.id = 'acePanelAgentsModal';
      overlay.className = 'ace-panel-agents-modal';
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'acePanelAgentsModalTitle');
      documentRef.body.appendChild(overlay);
    }

    overlay.innerHTML = '' +
      '<div class="ace-panel-agents-backdrop" data-agents-modal-close="true"></div>' +
      '<section class="ace-panel-agents-dialog">' +
        '<header class="ace-panel-agents-header">' +
          '<div><span class="ace-panel-agents-eyebrow">Coordenação operacional</span><h2 id="acePanelAgentsModalTitle">Agentes, escada e localização</h2><p>' + escapeHtml(generated) + '</p></div>' +
          '<button type="button" class="ace-panel-agents-close" data-agents-modal-close="true" aria-label="Fechar">×</button>' +
        '</header>' +
        '<div class="ace-panel-agents-grid">' +
          '<section class="ace-panel-agents-box"><h3>Solicitações de escada</h3><p>Pedidos confirmados como “Sim, solicitar escada”. Se a API ainda não devolver esse campo, entram apenas pedidos recentes com motivo “Necessita escada”.</p><div class="insight-list">' + buildLadderRequestsHtml(visits) + '</div></section>' +
          '<section class="ace-panel-agents-box"><h3>Localização dos agentes</h3><p>Última localização registrada por GPS nas visitas sincronizadas.</p><div class="ranking-list">' + buildAgentLocationsHtml(visits) + '</div></section>' +
        '</div>' +
      '</section>';

    overlay.hidden = false;
    documentRef.body.classList.add('is-agents-modal-open');

    setTimeout(function () {
      var close = overlay.querySelector('.ace-panel-agents-close');
      if (close) { close.focus(); }
    }, 30);
  }

  function bindAgentsButton() {
    var button = documentRef.getElementById('sidebarAgentsBtn');
    if (!button || button.getAttribute('data-ace-agents-fallback-bound') === '1') {
      return;
    }

    button.setAttribute('data-ace-agents-fallback-bound', '1');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      if (root.ACEPanelAgentsTools && typeof root.ACEPanelAgentsTools.open === 'function') {
        root.ACEPanelAgentsTools.open();
      } else {
        openAgentsModal();
      }
    }, true);
  }

  function handleClick(event) {
    var attendButton = event.target && event.target.closest ? event.target.closest('[data-ladder-attend]') : null;
    var attendAllButton = event.target && event.target.closest ? event.target.closest('[data-ladder-attend-all]') : null;
    var printButton = event.target && event.target.closest ? event.target.closest('[data-ladder-print-report]') : null;

    if (printButton) {
      event.preventDefault();
      printFallbackLadderRequestsReport();
      return;
    }

    if (attendButton) {
      event.preventDefault();
      markLadderAttended(attendButton.getAttribute('data-ladder-attend'));
      openAgentsModal();
      return;
    }

    if (attendAllButton) {
      event.preventDefault();
      if (!root.confirm || root.confirm('Marcar todas as solicitações de escada exibidas como atendidas? Elas sairão desta lista neste navegador.')) {
        getOpenLadderRequests(getVisits()).forEach(function (visit) {
          markLadderAttended(getLadderRequestKey(visit));
        });
        openAgentsModal();
      }
      return;
    }

    if (event.target && event.target.getAttribute('data-agents-modal-close') === 'true') {
      closeAgentsModal();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeAgentsModal();
    }
  }

  function bootAgentsFallback() {
    injectAgentStyles();
    bindAgentsButton();
    documentRef.addEventListener('click', handleClick);
    documentRef.addEventListener('keydown', handleKeydown);
    setTimeout(bindAgentsButton, 300);
    setTimeout(bindAgentsButton, 1200);
    setTimeout(bindAgentsButton, 2500);
  }

  root.ACEPanelAgentsFallback = {
    version: version,
    open: openAgentsModal,
    close: closeAgentsModal,
    getVisits: getVisits
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', bootAgentsFallback);
  } else {
    bootAgentsFallback();
  }
}());

