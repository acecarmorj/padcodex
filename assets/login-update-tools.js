(function () {
  'use strict';

  var root = window;
  var documentRef = document;

  var CONFIG = {
    version: '20260428-login-update-settings1',
    panelId: 'aceLoginUpdatePanel',
    statusId: 'aceLoginUpdateStatus',
    stylesId: 'aceLoginUpdateStyles',
    timeoutMs: 15000
  };

  function $(id) {
    return documentRef.getElementById(id);
  }

  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return String(runtime.API_URL || '').trim();
  }

  function injectStyles() {
    if ($(CONFIG.stylesId)) {
      return;
    }

    var style = documentRef.createElement('style');
    style.id = CONFIG.stylesId;
    style.textContent = [
      '.ace-login-update-panel{margin-top:14px;padding:14px;border:1px solid #dbe7df;border-radius:16px;background:#f8fbf9;color:#1f3d2d;text-align:left}',
      '.ace-login-update-title{font-weight:900;font-size:.95rem;margin-bottom:4px;color:#173826}',
      '.ace-login-update-hint{font-size:.82rem;line-height:1.38;color:#5f6e67;margin-bottom:10px}',
      '.ace-login-update-actions{display:grid;grid-template-columns:1fr;gap:8px}',
      '.ace-login-update-actions button{min-height:40px;border-radius:12px;border:1px solid #cfdcd5;background:#fff;color:#1f3d2d;font-weight:800;cursor:pointer}',
      '.ace-login-update-actions button:hover{background:#edf4ef}',
      '.ace-login-update-status{min-height:18px;margin-top:9px;font-size:.8rem;font-weight:800;color:#475569;text-align:center}',
      '@media(min-width:560px){.ace-login-update-actions{grid-template-columns:repeat(3,minmax(0,1fr))}}'
    ].join('\n');

    documentRef.head.appendChild(style);
  }

  function setStatus(message, kind) {
    var node = $(CONFIG.statusId);

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
      return Promise.resolve([]);
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
    if (
      !root.navigator ||
      !root.navigator.serviceWorker ||
      typeof root.navigator.serviceWorker.getRegistrations !== 'function'
    ) {
      return Promise.resolve([]);
    }

    return root.navigator.serviceWorker.getRegistrations().then(function (registrations) {
      return Promise.all((registrations || []).map(function (registration) {
        return registration.unregister();
      }));
    }).catch(function () {
      return [];
    });
  }

  function forceAppUpdate() {
    setStatus('Atualizando arquivos do sistema...', 'info');

    return Promise.all([
      clearCachesIfPossible(),
      unregisterServiceWorkersIfPossible()
    ]).finally(function () {
      root.location.href = buildReloadUrl('v');
    });
  }

  function hardReloadWithoutCache() {
    setStatus('Recarregando p\u00e1gina sem cache...', 'info');
    root.location.href = buildReloadUrl('hardReload');
  }

  function requestJsonp(url) {
    return new Promise(function (resolve, reject) {
      var callbackName = '__ACE_LOGIN_API_CHECK_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
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
      }, CONFIG.timeoutMs);

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
    var apiUrl = getApiUrl();

    if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) {
      setStatus('API n\u00e3o configurada em runtime-config.js.', 'warn');
      return Promise.resolve(false);
    }

    setStatus('Verificando comunica\u00e7\u00e3o com a API...', 'info');

    var url = apiUrl +
      (apiUrl.indexOf('?') === -1 ? '?' : '&') +
      'action=status&format=jsonp&t=' + encodeURIComponent(String(Date.now()));

    return requestJsonp(url).then(function (payload) {
      if (payload && payload.ok) {
        setStatus('API respondeu com sucesso.', 'ok');
        return true;
      }

      setStatus('API respondeu, mas retornou alerta.', 'warn');
      return false;
    }).catch(function (error) {
      setStatus('Erro ao verificar API: ' + error.message, 'error');
      return false;
    });
  }

  function createSettingsPanel() {
    var adminPanel = $('adminSystemPanel');
    var summary = $('adminSystemSummary');

    if (!adminPanel || !summary || $(CONFIG.panelId)) {
      return;
    }

    injectStyles();

    var panel = documentRef.createElement('section');
    panel.id = CONFIG.panelId;
    panel.className = 'ace-login-update-panel';
    panel.setAttribute('aria-label', 'Atualizacao do sistema');
    panel.innerHTML = [
      '<div class="ace-login-update-title">\u21bb Atualiza\u00e7\u00e3o do sistema</div>',
      '<div class="ace-login-update-hint">Ferramenta de manuten\u00e7\u00e3o para uso futuro nas configura\u00e7\u00f5es. N\u00e3o apaga visitas, im\u00f3veis, fila, sess\u00e3o ou dados locais.</div>',
      '<div class="ace-login-update-actions">',
      '<button id="aceForceUpdateBtn" type="button">Atualizar sistema</button>',
      '<button id="aceCheckApiBtn" type="button">Verificar API</button>',
      '<button id="aceHardReloadBtn" type="button">Recarregar sem cache</button>',
      '</div>',
      '<div id="' + CONFIG.statusId + '" class="ace-login-update-status"></div>'
    ].join('');

    summary.insertAdjacentElement('afterend', panel);

    var forceBtn = $('aceForceUpdateBtn');
    var checkBtn = $('aceCheckApiBtn');
    var reloadBtn = $('aceHardReloadBtn');

    if (forceBtn) {
      forceBtn.addEventListener('click', forceAppUpdate);
    }

    if (checkBtn) {
      checkBtn.addEventListener('click', checkApiStatus);
    }

    if (reloadBtn) {
      reloadBtn.addEventListener('click', hardReloadWithoutCache);
    }
  }

  function wrapAdminRenderer() {
    root.ACSField = root.ACSField || {};
    var app = root.ACSField;

    if (!app || typeof app.renderAdminSystemPanel !== 'function' || app.renderAdminSystemPanel.__loginUpdateWrapped) {
      return;
    }

    var original = app.renderAdminSystemPanel;

    app.renderAdminSystemPanel = function () {
      var result = original.apply(app, arguments);
      createSettingsPanel();
      return result;
    };

    app.renderAdminSystemPanel.__loginUpdateWrapped = true;
  }

  function boot() {
    wrapAdminRenderer();
    createSettingsPanel();
  }

  root.ACELoginUpdateTools = {
    forceAppUpdate: forceAppUpdate,
    checkApiStatus: checkApiStatus,
    hardReloadWithoutCache: hardReloadWithoutCache,
    createSettingsPanel: createSettingsPanel,
    version: CONFIG.version
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  root.setTimeout(boot, 500);
  root.setTimeout(boot, 1500);
}());
