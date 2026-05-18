(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var MODULE_VERSION = '20260505-system-status-private-counts-v12';
  var state = { status: null, schedule: null, lastError: '', loading: false, bundle: null };

  function $(id) { return documentRef.getElementById(id); }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return text(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '');
  }
  function apiReady() {
    var url = getApiUrl();
    return !!url && /^https?:\/\//i.test(url) && url.indexOf('COLE_AQUI') === -1;
  }
  function todayLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function unwrap(payload) {
    return payload && payload.data && typeof payload.data === 'object' ? Object.assign({}, payload, payload.data) : (payload || {});
  }
  function numberValue(value) {
    var number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }
  function getPanelSession() {
    try {
      var sync = root.ACEPanelCloudSync;
      if (sync && typeof sync.getSessionInfo === 'function') {
        return sync.getSessionInfo() || null;
      }
    } catch (error) {}
    try {
      var raw = root.sessionStorage && root.sessionStorage.getItem('ace_panel_private_session_v1');
      return raw ? JSON.parse(raw) : null;
    } catch (error2) {}
    return null;
  }
  function getPanelSessionToken() {
    var session = getPanelSession();
    return text(session && (session.sessionToken || session.session_token || session.token));
  }
  function getPanelBundle() {
    try {
      var sync = root.ACEPanelCloudSync;
      if (sync && typeof sync.getBundle === 'function') {
        return sync.getBundle() || root.ACE_PANEL_CLOUD_BUNDLE || null;
      }
    } catch (error) {}
    return root.ACE_PANEL_CLOUD_BUNDLE || null;
  }
  function readSystemStateValue(bundle, key) {
    var list = bundle && Array.isArray(bundle.systemState) ? bundle.systemState : [];
    var found = list.filter(function (row) {
      return text(row && (row.key || row.chave || row.nome)) === key;
    })[0];
    return found ? text(found.value || found.valor || '') : '';
  }
  function requestJsonp(action, params) {
    return new Promise(function (resolve, reject) {
      if (!apiReady()) { reject(new Error('API_URL nao configurada.')); return; }
      var cb = '__ACE_SYSTEM_STATUS_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      var mergedParams = Object.assign({}, params || {});
      var sessionToken = getPanelSessionToken();
      if (sessionToken && !mergedParams.sessionToken && !mergedParams.session_token) {
        mergedParams.sessionToken = sessionToken;
        mergedParams.access_module = mergedParams.access_module || 'coordenacao';
      }
      var url = getApiUrl() + '?action=' + encodeURIComponent(action || 'status') + '&format=jsonp&t=' + encodeURIComponent(String(Date.now()));
      Object.keys(mergedParams || {}).forEach(function (key) {
        if (mergedParams[key] !== '' && mergedParams[key] != null) {
          url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(mergedParams[key]);
        }
      });
      var script = documentRef.createElement('script');
      var done = false;
      var timer = setTimeout(function () {
        if (done) { return; }
        done = true; cleanup(); reject(new Error('Tempo esgotado.'));
      }, 18000);
      function cleanup() {
        try { delete root[cb]; } catch (err) { root[cb] = undefined; }
        if (script.parentNode) { script.parentNode.removeChild(script); }
      }
      root[cb] = function (payload) {
        if (done) { return; }
        done = true; clearTimeout(timer); cleanup();
        if (payload && payload.ok === false) { reject(new Error(payload.error || 'Resposta invalida.')); return; }
        resolve(unwrap(payload));
      };
      script.onerror = function () {
        if (done) { return; }
        done = true; clearTimeout(timer); cleanup(); reject(new Error('Falha de rede.'));
      };
      script.src = url + '&callback=' + encodeURIComponent(cb);
      documentRef.head.appendChild(script);
    });
  }
  function ensureStyles() {
    if ($('systemStatusStyles')) { return; }
    var style = documentRef.createElement('style');
    style.id = 'systemStatusStyles';
    style.textContent = [
      '.system-status-shell{display:grid;gap:14px}',
      '.system-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '.system-status-card{border:1px solid #dbe7df;border-radius:16px;background:#fff;padding:12px;box-shadow:0 8px 24px rgba(15,72,43,.05)}',
      '.system-status-card small{display:block;color:#64746d;font-weight:900;text-transform:uppercase;letter-spacing:.04em;font-size:.72rem}',
      '.system-status-card strong{display:block;margin-top:4px;color:#183c2c;font-size:1.05rem}',
      '.system-status-card span{display:block;margin-top:4px;color:#52615a;font-size:.82rem;font-weight:750}',
      '.system-status-card.ok{border-left:5px solid #15803d}.system-status-card.warn{border-left:5px solid #b7791f}.system-status-card.error{border-left:5px solid #b91c1c}',
      '.system-status-note{border:1px solid #dbe7df;border-radius:16px;background:#f8fcf9;padding:12px;color:#385448;font-weight:800}',
      '.system-status-table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden}',
      '.system-status-table th,.system-status-table td{border:1px solid #dbe7df;padding:8px;text-align:left;font-size:.88rem}',
      '.system-status-table th{background:#e8f4ec;color:#183c2c}',
      '.system-status-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '@media(max-width:1100px){.system-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media(max-width:680px){.system-status-grid{grid-template-columns:1fr}}'
    ].join('\n');
    documentRef.head.appendChild(style);
  }
  function statusCard(label, value, hint, kind) {
    return '<div class="system-status-card ' + escapeHtml(kind || 'ok') + '"><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(hint || '') + '</span></div>';
  }
  function buildCounts() {
    var statusCounts = (state.status && state.status.counts) || {};
    var bundle = state.bundle || getPanelBundle() || {};
    var bundleCounts = bundle.counts || {};
    var schedule = state.schedule || {};
    var summary = schedule.summary || {};
    return {
      agentes: numberValue(statusCounts.agentes || bundleCounts.agentes || bundleCounts.agentsTotal || (Array.isArray(bundle.agents) ? bundle.agents.length : 0)),
      imoveis: numberValue(statusCounts.imoveis || bundleCounts.imoveis || bundleCounts.propertiesTotal || (Array.isArray(bundle.properties) ? bundle.properties.length : 0)),
      visitas: numberValue(statusCounts.visitas || bundleCounts.visitas || bundleCounts.visitsTotal || bundleCounts.visitsReturned || (Array.isArray(bundle.visits) ? bundle.visits.length : 0)),
      tubitos: numberValue(statusCounts.tubitos || bundleCounts.tubitos || bundleCounts.tubitosTotal || (Array.isArray(bundle.tubitos) ? bundle.tubitos.length : 0)),
      operations: numberValue(statusCounts.operations || summary.total_operations || (Array.isArray(schedule.operations) ? schedule.operations.length : 0)),
      operation_assignments: numberValue(statusCounts.operation_assignments || summary.total_assignments || (Array.isArray(schedule.assignments) ? schedule.assignments.length : 0))
    };
  }
  function countValue(counts, key) {
    return Number((counts && counts[key]) || 0);
  }
  function buildSystemState() {
    var statusSystem = (state.status && state.status.system_state) || {};
    var bundle = state.bundle || getPanelBundle() || {};
    return {
      last_sync_at: text(statusSystem.last_sync_at || readSystemStateValue(bundle, 'last_sync_at') || bundle.generatedAt || ''),
      last_sync_error: text(statusSystem.last_sync_error || readSystemStateValue(bundle, 'last_sync_error') || '')
    };
  }
  function render() {
    var host = $('systemStatusContent');
    if (!host) { return; }
    state.bundle = getPanelBundle();
    var status = state.status || {};
    var counts = buildCounts();
    var system = buildSystemState();
    var spreadsheet = status.spreadsheet || {};
    var schedule = state.schedule || {};
    var summary = schedule.summary || {};
    var modes = summary.modes || {};
    var apiOk = apiReady() && !state.lastError;
    var hasPrivateBundle = !!(state.bundle && state.bundle.ok);
    var rows = [
      ['API conectada', apiReady() ? 'Sim' : 'Não', apiReady() ? 'URL configurada e pronta para consulta.' : 'Confira assets/runtime-config.js.'],
      ['Pacote privado do painel', hasPrivateBundle ? 'Sim' : 'Não', hasPrivateBundle ? 'Dados carregados após login do coordenador.' : 'Faça login/atualize a nuvem para carregar os dados reais.'],
      ['Agentes carregados', countValue(counts, 'agentes'), 'Agentes ativos na base privada do painel.'],
      ['Imóveis carregados', countValue(counts, 'imoveis'), 'Imóveis cadastrados disponíveis para consulta.'],
      ['Visitas carregadas', countValue(counts, 'visitas'), 'Histórico carregado no pacote privado.'],
      ['Tubitos carregados', countValue(counts, 'tubitos'), 'Tubitos disponíveis para laboratório.'],
      ['Operações do dia', countValue(counts, 'operations'), 'Programações registradas para a data selecionada.'],
      ['Agentes alocados hoje', countValue(counts, 'operation_assignments'), 'Distribuição dos agentes nas operações do dia.'],
      ['Última sincronização', system.last_sync_at || '-', system.last_sync_error ? ('Último erro: ' + system.last_sync_error) : 'Sem erro registrado.']
    ];
    host.innerHTML = [
      '<div class="system-status-actions"><button class="btn btn-primary" id="systemStatusRefreshBtn" type="button">Atualizar status</button><span class="system-status-note">' + escapeHtml(state.loading ? 'Consultando API...' : (state.lastError ? ('Atenção: ' + state.lastError) : (hasPrivateBundle ? 'Status carregado com dados privados do painel.' : 'Status carregado, aguardando pacote privado do painel.'))) + '</span></div>',
      '<div class="system-status-grid">',
      statusCard('API conectada', apiOk ? 'OK' : 'Atenção', apiReady() ? 'Runtime configurado.' : 'API_URL ausente.', apiOk ? 'ok' : 'error'),
      statusCard('Pacote privado', hasPrivateBundle ? 'OK' : 'Atenção', hasPrivateBundle ? 'Dados reais carregados.' : 'Clique em Atualizar nuvem ou faça login.', hasPrivateBundle ? 'ok' : 'warn'),
      statusCard('Agentes', countValue(counts, 'agentes'), 'Carregados da base.', countValue(counts, 'agentes') ? 'ok' : 'warn'),
      statusCard('Imóveis', countValue(counts, 'imoveis'), 'Registros disponíveis.', countValue(counts, 'imoveis') ? 'ok' : 'warn'),
      statusCard('Visitas', countValue(counts, 'visitas'), 'Histórico sincronizado.', countValue(counts, 'visitas') ? 'ok' : 'warn'),
      statusCard('Tubitos', countValue(counts, 'tubitos'), 'Fila laboratorial.', countValue(counts, 'tubitos') ? 'ok' : 'warn'),
      statusCard('Operações hoje', countValue(counts, 'operations'), 'Programações para hoje.', countValue(counts, 'operations') ? 'ok' : 'warn'),
      statusCard('Última sync', system.last_sync_at || '-', system.last_sync_error ? 'Há erro registrado.' : 'Sem erro registrado.', system.last_sync_error ? 'warn' : 'ok'),
      '</div>',
      '<table class="system-status-table"><thead><tr><th>Item</th><th>Situação</th><th>Observação</th></tr></thead><tbody>',
      rows.map(function (row) { return '<tr><td>' + escapeHtml(row[0]) + '</td><td><strong>' + escapeHtml(row[1]) + '</strong></td><td>' + escapeHtml(row[2]) + '</td></tr>'; }).join(''),
      '</tbody></table>',
      '<div class="system-status-note"><strong>Distribuição operacional de hoje:</strong> VD ' + Number((modes.VD && modes.VD.agents) || 0) + ' agente(s), P.E. ' + Number((modes.PE && modes.PE.agents) || 0) + ' agente(s), LIRAa ' + Number((modes.LIRAA && modes.LIRAA.agents) || 0) + ' agente(s). Consulta gerada em ' + escapeHtml((schedule && schedule.generatedAt) || status.generatedAt || (state.bundle && state.bundle.generatedAt) || '-') + '.</div>'
    ].join('');
    bindRefresh();
  }
  function refresh() {
    state.loading = true;
    state.lastError = '';
    state.bundle = getPanelBundle();
    render();
    return requestJsonp('status').then(function (payload) {
      state.status = payload;
      return requestJsonp('operation_schedule', { date: todayLocal() }).catch(function (err) {
        state.lastError = err && err.message ? err.message : '';
        return null;
      });
    }).then(function (schedule) {
      if (schedule) { state.schedule = schedule; }
      state.bundle = getPanelBundle();
      state.loading = false;
      render();
    }).catch(function (err) {
      state.loading = false;
      state.lastError = err && err.message ? err.message : 'Falha ao consultar status.';
      state.bundle = getPanelBundle();
      render();
    });
  }
  function activate() {
    documentRef.querySelectorAll('[data-panel-view-content]').forEach(function (panel) {
      var active = panel.getAttribute('data-panel-view-content') === 'system-status';
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    documentRef.querySelectorAll('[data-panel-view]').forEach(function (button) {
      var active = button.getAttribute('data-panel-view') === 'system-status';
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    refresh();
  }
  function bindRefresh() {
    var btn = $('systemStatusRefreshBtn');
    if (btn && btn.getAttribute('data-bound') !== '1') {
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', refresh);
    }
  }
  function ensurePanel() {
    ensureStyles();
    var nav = documentRef.querySelector('.app-sidebar__nav');
    if (nav && !$('sidebarSystemStatusBtn')) {
      var btn = documentRef.createElement('button');
      btn.id = 'sidebarSystemStatusBtn';
      btn.className = 'sidebar-tab';
      btn.type = 'button';
      btn.setAttribute('data-panel-view', 'system-status');
      btn.setAttribute('aria-selected', 'false');
      btn.innerHTML = '<span class="sidebar-tab__icon">◉</span><span>Status do sistema</span>';
      var cfg = $('sidebarSettingsBtn') || documentRef.querySelector('[data-panel-view="settings"]');
      if (cfg && cfg.parentNode) { cfg.parentNode.insertBefore(btn, cfg); }
      else { nav.appendChild(btn); }
      btn.addEventListener('click', activate);
    }
    var workspace = documentRef.querySelector('.panel-workspace');
    if (workspace && !$('panelSystemStatusView')) {
      var view = documentRef.createElement('div');
      view.id = 'panelSystemStatusView';
      view.className = 'panel-view';
      view.hidden = true;
      view.setAttribute('data-panel-view-content', 'system-status');
      view.innerHTML = '<div class="panel-screen-head"><div class="screen-head-copy"><strong>Status do sistema</strong><span>Diagnóstico rápido de API, planilha, dados e sincronização.</span></div><div class="screen-badge">◉</div></div><div class="system-status-shell" id="systemStatusContent"></div>';
      workspace.appendChild(view);
    }
    bindRefresh();
  }
  function boot() {
    ensurePanel();
    setTimeout(function () {
      state.bundle = getPanelBundle();
      render();
    }, 600);
  }
  root.ACEPanelSystemStatus = { version: MODULE_VERSION, refresh: refresh, activate: activate };
  if (documentRef.readyState === 'loading') { documentRef.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
}());
