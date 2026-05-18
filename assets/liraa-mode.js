(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var MODULE_VERSION = '20260517-tablet-v55-final';
  var PLAN_STORAGE_KEY = 'ace_liraa_sampling_plan_v1';
  var state = {
    loadingRemotePlan: false,
    lastRemotePlanAt: 0,
    pendingNewPropertyUnit: ''
  };

  function getApp() {
    return root.ACSField || null;
  }

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
    return String(value || '').trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['`´]/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripAreaPrefix(value) {
    return normalizeText(value).replace(/^[A-Z0-9]{1,8}\s*-\s*/i, '').trim();
  }

  function normalizeTerritoryKey(value) {
    var key = normalizeKey(stripAreaPrefix(value));
    var aliases = {
      'caixa d agua': 'caixa dagua',
      'caixa dagua': 'caixa dagua',
      'morro do estado': 'ulisses lemgruber',
      'light': 'ilha dos pombos',
      'ilha dos pombos light': 'ilha dos pombos',
      'porto velho': 'porto velho do cunha',
      'porto velho do cunha pvc': 'porto velho do cunha'
    };
    return aliases[key] || key;
  }

  function getCurrentOperationMode() {
    try {
      if (root.ACEOperationMode && typeof root.ACEOperationMode.getCurrentMode === 'function') {
        return normalizeText(root.ACEOperationMode.getCurrentMode()).toUpperCase();
      }
    } catch (error) {}

    return '';
  }

  function shouldShowLiraaTab() {
    try {
      var app = getApp();
      var operationApi = root.ACEOperationMode || null;

      if (!app || !app.state || !app.state.currentAgent || !operationApi) {
        return false;
      }

      if (typeof operationApi.isCurrentAgentAssignedToLiraa === 'function') {
        return !!operationApi.isCurrentAgentAssignedToLiraa();
      }

      if (typeof operationApi.getCurrentMode === 'function') {
        return normalizeText(operationApi.getCurrentMode()).toUpperCase() === 'LIRAA';
      }
    } catch (error) {}

    return false;
  }

  function setLiraaNodeVisible(node, visible) {
    if (!node) {
      return;
    }

    node.hidden = !visible;
    node.setAttribute('aria-hidden', visible ? 'false' : 'true');
    node.classList.toggle('ace-liraa-hidden', !visible);
    node.style.display = visible ? '' : 'none';

    if (node.id === 'tabLiraaBtn') {
      node.disabled = !visible;
      node.tabIndex = visible ? 0 : -1;
    }
  }

  function updateLiraaVisibility() {
    var visible = shouldShowLiraaTab();
    var button = $('tabLiraaBtn');
    var section = $('screen-liraa');
    var app = getApp();

    setLiraaNodeVisible(button, visible);

    if (section && !visible) {
      section.classList.remove('active');
    }
    setLiraaNodeVisible(section, visible);

    if (!visible && app && app.state && app.state.selectedScreen === 'liraa' && typeof app.showScreen === 'function') {
      app.showScreen('painel');
    }

    return visible;
  }

  function normalizeQuarter(value) {
    return normalizeText(value)
      .replace(/^q\s*[-/]?\s*/i, '')
      .replace(/^0+(\d)/, '$1')
      .trim();
  }

  function makeUnitKey(territory, quarter) {
    return normalizeTerritoryKey(territory) + '|' + normalizeQuarter(quarter || 'Distrito');
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
      if (value === null || value === undefined) {
        root.localStorage.removeItem(key);
        return true;
      }
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearStoredPlan() {
    return writeJson(PLAN_STORAGE_KEY, null);
  }

  function todayISO() {
    var app = getApp();
    if (app && typeof app.todayISO === 'function') {
      return app.todayISO();
    }
    var date = new Date();
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function getCurrentOperationPlan() {
    try {
      if (root.ACEOperationMode && typeof root.ACEOperationMode.getActivePlan === 'function') {
        return root.ACEOperationMode.getActivePlan();
      }
    } catch (error) {}
    return null;
  }

  function getPlanDate(plan) {
    plan = plan || {};
    return normalizeText(
      plan.operation_date ||
      plan.data_operacao ||
      plan.date ||
      plan.data ||
      plan.reference_date ||
      plan.fieldCacheDate ||
      ''
    ).slice(0, 10);
  }

  function getCurrentPlanDate() {
    return getPlanDate(getCurrentOperationPlan()) || todayISO();
  }

  function parseOperationUnits(value) {
    if (Array.isArray(value)) {
      return value;
    }
    var raw = normalizeText(value);
    if (!raw) {
      return [];
    }
    if (raw.charAt(0) === '[') {
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    return raw.split('|').map(function (item) {
      var parts = item.split('::');
      return {
        territory: normalizeText(parts[0]),
        quarter: normalizeQuarter(parts.slice(1).join('::'))
      };
    }).filter(function (row) {
      return row.territory && row.quarter;
    });
  }

  function getSelectedRowsSource(plan) {
    plan = plan || {};
    if (Array.isArray(plan.selected)) { return plan.selected; }
    if (Array.isArray(plan.quarteiroes)) { return plan.quarteiroes; }
    if (Array.isArray(plan.units)) { return plan.units; }
    if (Array.isArray(plan.operation_units)) { return plan.operation_units; }
    if (Array.isArray(plan.selected_units)) { return plan.selected_units; }
    if (Array.isArray(plan.selectedUnits)) { return plan.selectedUnits; }
    return parseOperationUnits(plan.operation_units || plan.operationUnits || plan.territory_units || plan.territoryUnits || '');
  }

  function normalizePlanRow(row, index) {
    row = row || {};
    var key = normalizeText(row.key || row.unitKey || row.liraa_unit_key || '');
    var territory = normalizeText(
      row.territory ||
      row.microarea ||
      row.bairro ||
      row.area ||
      row.territorio ||
      ''
    );
    var quarter = normalizeQuarter(
      row.quarter ||
      row.quarteirao ||
      row.block ||
      row.q ||
      row.liraa_quarteirao_sorteado ||
      ''
    );
    var keyParts;

    if (key && key.indexOf('|') > -1 && (!territory || !quarter)) {
      keyParts = key.split('|');
      territory = territory || normalizeText(keyParts[0] || '');
      quarter = quarter || normalizeQuarter(keyParts.slice(1).join('|') || '');
    }

    if (!key && territory) {
      key = makeUnitKey(territory, quarter || 'Distrito');
    }

    if (!key && !territory && !quarter) {
      return null;
    }

    return {
      order: Math.max(1, Number(row.order || index + 1) || index + 1),
      key: key,
      territory: territory || 'Sem area',
      quarter: quarter || 'Distrito',
      properties: Math.max(0, Number(row.properties || 0) || 0),
      estimatedProperties: Math.max(0, Number(row.estimatedProperties || row.properties || 0) || 0),
      propertiesToInspect: Math.max(0, Number(row.propertiesToInspect || row.properties_to_inspect || row.meta || 0) || 0),
      seedOrder: Math.max(0, Number(row.seedOrder || 0) || 0),
      hasPolygon: !!row.hasPolygon,
      positiveVisits: Math.max(0, Number(row.positiveVisits || 0) || 0),
      positiveDeposits: Math.max(0, Number(row.positiveDeposits || 0) || 0)
    };
  }

  function countPlanGroups(rows) {
    var groups = {};
    (rows || []).forEach(function (row) {
      var key = normalizeTerritoryKey(row.territory || '');
      if (key) {
        groups[key] = true;
      }
    });
    return Object.keys(groups).length;
  }

  function buildSelectedMap(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      if (row && row.key) {
        map[row.key] = true;
      }
    });
    return map;
  }

  function normalizePlan(plan) {
    var selected;
    var normalized;

    if (plan && plan.__liraaFieldCache && plan.plan) {
      plan = plan.plan;
    }
    if (plan && plan.plan && Array.isArray(plan.plan.selected)) {
      plan = plan.plan;
    }
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      return null;
    }

    selected = getSelectedRowsSource(plan).map(normalizePlanRow).filter(Boolean);
    if (!selected.length) {
      return null;
    }

    normalized = Object.assign({}, plan);
    normalized.selected = selected;
    normalized.selectedMap = buildSelectedMap(selected);
    normalized.totalBlocks = selected.length;
    normalized.groups = countPlanGroups(selected);
    normalized.totalProperties = Math.max(0, Number(plan.totalProperties || 0) || 0);
    normalized.targetProperties = Math.max(0, Number(plan.targetProperties || 0) || selected.reduce(function (total, row) {
      return total + (Number(row.propertiesToInspect || 0) || 0);
    }, 0));
    return normalized;
  }

  function isPlanUsableToday(plan) {
    var planDate = getPlanDate(plan);
    var currentDate = getCurrentPlanDate();
    return !planDate || !currentDate || planDate === currentDate;
  }

  function getPlan() {
    var rawOperationPlan = getCurrentOperationPlan();
    var operationMode = rawOperationPlan ? normalizeOperationMode(rawOperationPlan.mode || rawOperationPlan.tipo_operacao || '') : '';
    var operationPlan = operationMode === 'LIRAA' ? normalizePlan(rawOperationPlan) : null;
    var plan = operationPlan;

    if (!plan || !isPlanUsableToday(plan)) {
      return null;
    }

    return plan;
  }

  function savePlan(plan) {
    var normalized = normalizePlan(plan);
    var operationPlan = getCurrentOperationPlan();
    if (!normalized) {
      return false;
    }
    normalized.fieldCacheVersion = MODULE_VERSION;
    normalized.fieldCacheSavedAt = new Date().toISOString();
    normalized.fieldCacheDate = getCurrentPlanDate();
    if (operationPlan) {
      normalized.operation_id = normalized.operation_id || operationPlan.operation_id || '';
      normalized.operation_date = normalized.operation_date || getPlanDate(operationPlan) || todayISO();
      normalized.liraa_plan_id = normalized.liraa_plan_id || operationPlan.liraa_plan_id || '';
    }
    return writeJson(PLAN_STORAGE_KEY, normalized);
  }

  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return String(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '').trim();
  }

  function isApiConfigured() {
    var url = getApiUrl();
    return !!url && /^https?:\/\//i.test(url) && url.indexOf('COLE_AQUI') === -1;
  }

  function appendOperationalAuth(url) {
    var app = getApp();
    if (app && typeof app.appendOperationalAuthToUrl === 'function') {
      return app.appendOperationalAuthToUrl(url);
    }
    return url;
  }

  function isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  function requestJsonp(url, timeoutMs) {
    if (isOffline()) {
      return Promise.reject(new Error('Offline: usando plano LIRAa local.'));
    }
    return new Promise(function (resolve, reject) {
      var callbackName = '__ACE_LIRAA_PLAN_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      var script = documentRef.createElement('script');
      var completed = false;

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

      var timer = setTimeout(function () {
        if (completed) {
          return;
        }
        completed = true;
        cleanup();
        reject(new Error('Tempo esgotado ao buscar plano LIRAa.'));
      }, timeoutMs || 12000);

      root[callbackName] = function (payload) {
        if (completed) {
          return;
        }
        completed = true;
        clearTimeout(timer);
        cleanup();
        resolve(payload);
      };

      script.async = true;
      script.onerror = function () {
        if (completed) {
          return;
        }
        completed = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error('Falha de rede ao buscar plano LIRAa.'));
      };
      script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + encodeURIComponent(callbackName);
      documentRef.head.appendChild(script);
    });
  }

  function fetchReleasedPlan(force) {
    // O plano LIRAa do tablet agora vem exclusivamente do painel de Operacoes.
    // Mantemos esta funcao como compatibilidade para botoes antigos, sem buscar endpoint paralelo.
    return Promise.resolve(false);
  }

  function getProperties() {
    var app = getApp();
    if (app && typeof app.readProperties === 'function') {
      return app.readProperties() || [];
    }
    return [];
  }

  function getVisits() {
    var app = getApp();
    if (app && typeof app.readVisits === 'function') {
      return app.readVisits() || [];
    }
    return [];
  }

  function propertyUnitKey(property) {
    return makeUnitKey(
      property.microarea || property.bairro || property.gpsTerritory || property.gps_territory || '',
      property.quarteirao || property.gpsQuarteirao || property.gps_quarteirao || ''
    );
  }

  function visitUnitKey(visit) {
    return makeUnitKey(
      visit.microarea || visit.bairro || visit.gpsTerritory || visit.gps_territory || '',
      visit.quarteirao || visit.gpsQuarteirao || visit.gps_quarteirao || ''
    );
  }

  function getPropertyAddress(property) {
    return [property.logradouro, property.numero, property.bairro].filter(Boolean).join(', ');
  }

  function getPropertyVisitCount(property, visits) {
    var uid = normalizeText(property.uid);
    var unit = propertyUnitKey(property);
    return (visits || []).filter(function (visit) {
      if (!isLiraaVisit(visit)) {
        return false;
      }
      return (uid && normalizeText(visit.property_uid || visit.propertyUid) === uid) ||
        (!uid && visitUnitKey(visit) === unit && normalizeText(visit.numero) === normalizeText(property.numero));
    }).length;
  }

  function isLiraaVisit(visit) {
    var row = visit || {};
    var mode = normalizeText(row.operationMode || row.operation_mode || row.origem_visita || '').toUpperCase();
    var obs = normalizeText(row.obs || '');
    return mode === 'LIRAA' || normalizeText(row.liraaColeta || row.liraa_coleta).toLowerCase() === 'sim' || obs.indexOf('[LIRAa]') === 0;
  }

  function getLiraaVisitsForUnit(visits, unitKey) {
    return (visits || []).filter(function (visit) {
      return isLiraaVisit(visit) && visitUnitKey(visit) === unitKey;
    });
  }

  function getSelectedUnitKey(plan) {
    var select = $('liraaUnitSelect');
    if (select && select.value) {
      return select.value;
    }
    return plan && plan.selected && plan.selected[0] ? plan.selected[0].key : '';
  }

  function getPlanRows(plan) {
    return (plan && Array.isArray(plan.selected) ? plan.selected : []).map(function (row, index) {
      return {
        order: row.order || index + 1,
        key: row.key || makeUnitKey(row.territory, row.quarter),
        territory: normalizeText(row.territory || 'Sem area'),
        quarter: normalizeQuarter(row.quarter || 'Distrito'),
        propertiesToInspect: Number(row.propertiesToInspect || 0) || 0,
        estimatedProperties: Number(row.estimatedProperties || row.properties || 0) || 0
      };
    });
  }

  function getPropertiesForUnit(properties, unitKey) {
    return (properties || []).filter(function (property) {
      return propertyUnitKey(property) === unitKey;
    }).sort(function (a, b) {
      return getPropertyAddress(a).localeCompare(getPropertyAddress(b), 'pt-BR', {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  function renderImportBox() {
    return '' +
      '<div class="card liraa-field-import">' +
        '<strong>Receber plano da coordenacao</strong>' +
        '<p>Cole aqui o plano gerado no painel da coordenacao. Depois disso a aba LIRAa passa a mostrar os quarteiroes definidos e os imoveis para coleta.</p>' +
        '<textarea id="liraaPlanImportText" rows="5" placeholder="Cole aqui o JSON do plano LIRAa"></textarea>' +
        '<div class="btn-row">' +
          '<button class="btn btn-primary" id="liraaFetchPlanBtn" type="button">Buscar plano liberado</button>' +
          '<button class="btn btn-primary" id="liraaImportPlanBtn" type="button">Importar plano</button>' +
          '<button class="btn btn-soft" id="liraaOpenPropertiesBtn" type="button">Abrir cadastro de imoveis</button>' +
        '</div>' +
      '</div>';
  }

  function renderNoPlan() {
    return '' +
      '<div class="liraa-field-empty">' +
        '<div class="liraa-field-empty-icon">L</div>' +
        '<strong>Nenhum plano LIRAa da Operacao</strong>' +
        '<span>' + (isOffline() ? 'Plano LIRAa nao carregado neste tablet. Conecte no ponto de apoio e faca login novamente para receber a Operacao do dia.' : 'O agente coleta o LIRAa somente depois que a coordenacao adiciona uma Operacao LIRAa com pares microarea + quarteirao.') + '</span>' +
      '</div>';
  }

  function renderPlanHeader(plan, rows, visits) {
    var visitedUnits = {};
    visits.forEach(function (visit) {
      var key = visitUnitKey(visit);
      if (key) {
        visitedUnits[key] = (visitedUnits[key] || 0) + 1;
      }
    });

    var visitedCount = rows.reduce(function (total, row) {
      return total + (visitedUnits[row.key] || 0);
    }, 0);

    return '' +
      '<div class="liraa-field-hero">' +
        '<div>' +
          '<span>Coleta LIRAa</span>' +
          '<strong>' + escapeHtml(plan.cycle || 'Plano da coordenacao') + '</strong>' +
          '<small>Quarteiroes definidos pela coordenacao: ' + escapeHtml(rows.length) + '</small>' +
        '</div>' +
        '<div class="liraa-field-count"><strong>' + escapeHtml(visitedCount) + '</strong><span>visita(s) lancadas</span></div>' +
      '</div>';
  }

  function renderUnitSelect(rows, selectedKey) {
    return '' +
      '<div class="card liraa-field-selector">' +
        '<div class="field">' +
          '<label for="liraaUnitSelect">Quarteirao definido</label>' +
          '<select id="liraaUnitSelect">' +
            rows.map(function (row) {
              var label = row.order + '. ' + row.territory + ' • Q ' + row.quarter;
              return '<option value="' + escapeHtml(row.key) + '"' + (row.key === selectedKey ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<button class="btn btn-soft" id="liraaRefreshFieldBtn" type="button">Atualizar lista</button>' +
      '</div>';
  }

  function renderPropertyCard(property, visits, planRow) {
    var visitCount = getPropertyVisitCount(property, visits);
    var done = visitCount > 0;
    var address = getPropertyAddress(property) || 'Endereco nao informado';

    return '<article class="liraa-field-property ' + (done ? 'is-done' : '') + '">' +
      '<div>' +
        '<span>' + escapeHtml(done ? 'Ja visitado neste aparelho' : 'Pendente') + '</span>' +
        '<strong>' + escapeHtml(address) + '</strong>' +
        '<small>' + escapeHtml((property.tipo || 'Imovel') + ' • ' + (property.complemento || 'Normal')) + '</small>' +
        '<small>' + escapeHtml('LIRAa: ' + planRow.territory + ' • Q ' + planRow.quarter) + '</small>' +
      '</div>' +
      '<button class="btn btn-primary" type="button" data-liraa-start-property="' + escapeHtml(property.uid) + '" data-liraa-unit="' + escapeHtml(planRow.key) + '">' +
        (done ? 'Nova visita LIRAa' : 'Iniciar coleta') +
      '</button>' +
    '</article>';
  }

  function renderMobileCollectCard(row, target, done) {
    var remaining = Math.max(0, Number(target || 0) - Number(done || 0));

    return '' +
      '<section class="card liraa-field-mobile-card">' +
        '<span class="liraa-field-kicker">Coleta em campo</span>' +
        '<strong>Cadastrar imovel encontrado no quarteirao</strong>' +
        '<p>Use este botao quando o endereco ainda nao existir na base. O app ja leva microarea/quarteirao para o cadastro e, depois de salvar, inicia a visita LIRAa.</p>' +
        '<div class="liraa-mobile-tasks">' +
          '<div><span>1</span><strong>Cadastre</strong><small>Rua, numero e GPS</small></div>' +
          '<div><span>2</span><strong>Salve</strong><small>O imovel fica vinculado ao Q ' + escapeHtml(row.quarter) + '</small></div>' +
          '<div><span>3</span><strong>Coleta</strong><small>Preencha a visita LIRAa</small></div>' +
        '</div>' +
        '<button class="btn btn-primary liraa-main-action" type="button" data-liraa-new-property="' + escapeHtml(row.key) + '">' +
          'Cadastrar imovel e iniciar coleta' +
        '</button>' +
        '<small class="liraa-field-hint">Faltam aproximadamente ' + escapeHtml(remaining || 0) + ' coleta(s) para a meta deste quarteirao.</small>' +
      '</section>';
  }

  function renderUnitWork(plan, rows, selectedKey) {
    var properties = getProperties();
    var visits = getVisits();
    var row = rows.find(function (item) { return item.key === selectedKey; }) || rows[0];
    var unitProperties = row ? getPropertiesForUnit(properties, row.key) : [];
    var target = row ? row.propertiesToInspect : 0;
    var visitsForUnit = row ? getLiraaVisitsForUnit(visits, row.key) : [];
    var done = visitsForUnit.length;

    if (!row) {
      return '<div class="empty-state">Plano sem quarteiroes definidos.</div>';
    }

    return '' +
      '<div class="liraa-field-progress">' +
        '<div><span>Estrato / microarea</span><strong>' + escapeHtml(row.territory) + '</strong></div>' +
        '<div><span>Quarteirao</span><strong>Q ' + escapeHtml(row.quarter) + '</strong></div>' +
        '<div><span>Meta</span><strong>' + escapeHtml(target || '-') + '</strong></div>' +
        '<div><span>Coletados</span><strong>' + escapeHtml(done) + '</strong></div>' +
      '</div>' +
      renderMobileCollectCard(row, target, done) +
      '<section class="card">' +
        '<h2 class="section-title">Imoveis ja cadastrados neste quarteirao</h2>' +
        (unitProperties.length
          ? '<div class="liraa-field-list">' + unitProperties.map(function (property) {
              return renderPropertyCard(property, visits, row);
            }).join('') + '</div>'
          : '<div class="empty-state">Nenhum imovel cadastrado ainda neste quarteirao. Cadastre pelo botao acima conforme os imoveis forem encontrados em campo.</div>') +
      '</section>' +
      '<section class="card liraa-field-note">' +
        '<strong>Orientacao de campo</strong>' +
        '<p>Neste primeiro LIRAa, os enderecos podem ser cadastrados durante a coleta. Confira o quarteirao definido antes de salvar cada imovel.</p>' +
      '</section>' +
      renderImportBox();
  }

  function renderLiraaScreen() {
    var node = $('liraaDashboard');
    if (!node) {
      return;
    }

    if (!isOffline()) {
      fetchReleasedPlan(false).catch(function () {});
    }

    var plan = getPlan();
    if (!plan) {
      node.innerHTML = renderNoPlan();
      bindLiraaControls();
      return;
    }

    var rows = getPlanRows(plan);
    var selectedKey = getSelectedUnitKey({ selected: rows });
    node.innerHTML = '' +
      renderPlanHeader(plan, rows, getVisits()) +
      renderUnitSelect(rows, selectedKey) +
      renderUnitWork(plan, rows, selectedKey);
    bindLiraaControls();
  }

  function importPlanFromText() {
    var field = $('liraaPlanImportText');
    var app = getApp();
    var text = field ? field.value : '';
    var payload;

    try {
      payload = JSON.parse(text);
      payload = normalizePlan(payload);
      if (!payload) {
        throw new Error('Plano sem lista selected.');
      }
      savePlan(payload);
      if (app && typeof app.showMessage === 'function') {
        app.showMessage('Plano LIRAa importado para este aparelho.', 'ok');
      }
      renderLiraaScreen();
    } catch (error) {
      if (app && typeof app.showMessage === 'function') {
        app.showMessage('Nao consegui importar o plano. Confira o JSON copiado do painel.', 'warn');
      } else {
        root.alert('Nao consegui importar o plano. Confira o JSON copiado do painel.');
      }
    }
  }

  function setSelectByBestMatch(node, value) {
    var wanted = normalizeKey(value);
    var best = '';

    if (!node || !wanted) {
      return false;
    }

    Array.from(node.options || []).some(function (option) {
      var optionValue = normalizeKey(option.value);
      var optionText = normalizeKey(option.textContent || option.innerText || '');

      if (optionValue === wanted || optionText === wanted || optionText.indexOf(wanted) > -1 || wanted.indexOf(optionText) > -1) {
        best = option.value;
        return true;
      }

      return false;
    });

    if (!best && node.tagName !== 'SELECT') {
      node.value = value;
      return true;
    }

    if (best) {
      node.value = best;
      return true;
    }

    return false;
  }

  function prefillPropertyFormForLiraa(row, plan) {
    var app = getApp();
    var bairroNode = $('propBairro');
    var microareaNode = $('propMicroarea');
    var quarteiraoNode = $('propQuarteirao');
    var referenciaNode = $('propReferencia');
    var obsNode = $('propObs');
    var territory = row ? row.territory : '';
    var quarter = row ? row.quarter : '';
    var note = 'Cadastro realizado durante LIRAa - ' +
      (plan && plan.cycle ? plan.cycle + ' - ' : '') +
      territory + (quarter ? ' Q ' + quarter : '');

    if (typeof app.clearPropertyForm === 'function') {
      app.clearPropertyForm();
    }

    if (bairroNode) {
      setSelectByBestMatch(bairroNode, stripAreaPrefix(territory) || territory);
      try { bairroNode.dispatchEvent(new Event('change', { bubbles: true })); } catch (error) {}
    }

    if (microareaNode) {
      setSelectByBestMatch(microareaNode, territory);
      try { microareaNode.dispatchEvent(new Event('change', { bubbles: true })); } catch (error) {}
    }

    if (typeof app.syncAreaSelects === 'function' && microareaNode && quarteiraoNode) {
      app.syncAreaSelects(microareaNode, quarteiraoNode, quarter);
    }

    if (quarteiraoNode) {
      setSelectByBestMatch(quarteiraoNode, quarter);
    }

    if (referenciaNode && !referenciaNode.value) {
      referenciaNode.value = note;
    }

    if (obsNode && !obsNode.value) {
      obsNode.value = note;
    }

    if (app.state && app.state.visit) {
      app.state.visit.operationMode = 'LIRAA';
      app.state.visit.liraaCiclo = (plan && plan.cycle) || app.state.visit.liraaCiclo || '';
      app.state.visit.liraaPlanoId = (plan && (plan.id || plan.plan_id || plan.version)) || app.state.visit.liraaPlanoId || '';
      app.state.visit.liraaQuarteiraoSorteado = row ? (row.territory + ' | Q ' + row.quarter) : (app.state.visit.liraaQuarteiraoSorteado || '');
      app.state.visit.liraaUnitKey = row ? row.key : (app.state.visit.liraaUnitKey || '');
      app.state.visit.liraaColeta = 'Sim';
      app.state.visit.microarea = app.state.visit.microarea || territory;
      app.state.visit.quarteirao = app.state.visit.quarteirao || quarter;
    }
  }

  function startLiraaNewProperty(unitKey) {
    var app = getApp();
    var plan = getPlan();
    var rows = getPlanRows(plan);
    var row = rows.find(function (item) { return item.key === unitKey; }) || rows[0];

    if (!app || !row) {
      return;
    }

    state.pendingNewPropertyUnit = row.key;

    if (typeof app.showScreen === 'function') {
      app.showScreen('imoveis');
    }

    setTimeout(function () {
      prefillPropertyFormForLiraa(row, plan);
      var firstField = $('propLogradouro') || $('propNumero') || $('propBairro');
      if (firstField && typeof firstField.focus === 'function') {
        firstField.focus();
      }
      if (typeof app.showMessage === 'function') {
        app.showMessage('Preencha rua e numero, capture o GPS e salve. A coleta LIRAa inicia em seguida.', 'accent');
      }
    }, 120);
  }

  function startLiraaVisit(propertyId, unitKey) {
    var app = getApp();
    var plan = getPlan();
    var rows = getPlanRows(plan);
    var row = rows.find(function (item) { return item.key === unitKey; }) || rows[0];
    var prefix = '[LIRAa] ' + (plan && plan.cycle ? plan.cycle : 'Plano LIRAa') +
      ' | ' + (row ? row.territory + ' | Q ' + row.quarter : 'Quarteirao definido');

    if (!app || typeof app.selectProperty !== 'function') {
      return;
    }

    app.selectProperty(propertyId);

    setTimeout(function () {
      if (app.state && app.state.visit) {
        var currentObs = normalizeText(app.state.visit.obs || '');
        app.state.visit.operationMode = 'LIRAA';
        app.state.visit.liraaCiclo = (plan && plan.cycle) || app.state.visit.liraaCiclo || '';
        app.state.visit.liraaPlanoId = (plan && (plan.id || plan.plan_id || plan.version)) || app.state.visit.liraaPlanoId || '';
        app.state.visit.liraaQuarteiraoSorteado = row ? (row.territory + ' | Q ' + row.quarter) : (app.state.visit.liraaQuarteiraoSorteado || '');
        app.state.visit.liraaUnitKey = row ? row.key : (app.state.visit.liraaUnitKey || '');
        app.state.visit.liraaColeta = 'Sim';
        if (currentObs.indexOf('[LIRAa]') !== 0) {
          app.state.visit.obs = currentObs ? prefix + '\n' + currentObs : prefix;
        }
      }
      if (typeof app.updateVisitFormFromState === 'function') {
        app.updateVisitFormFromState();
      }
      var obs = $('visitObs');
      if (obs && app.state && app.state.visit) {
        obs.value = app.state.visit.obs || '';
      }
      if (typeof app.startSelectedPropertyVisit === 'function') {
        app.startSelectedPropertyVisit();
      }
      if (typeof app.showMessage === 'function') {
        app.showMessage('Coleta LIRAa iniciada para o imovel definido.', 'accent');
      }
    }, 120);
  }

  function bindLiraaControls() {
    var importBtn = $('liraaImportPlanBtn');
    var fetchBtn = $('liraaFetchPlanBtn');
    var refreshBtn = $('liraaRefreshFieldBtn');
    var unitSelect = $('liraaUnitSelect');
    var openPropertiesBtn = $('liraaOpenPropertiesBtn');

    if (importBtn && importBtn.getAttribute('data-liraa-bound') !== '1') {
      importBtn.setAttribute('data-liraa-bound', '1');
      importBtn.addEventListener('click', importPlanFromText);
    }

    if (fetchBtn && fetchBtn.getAttribute('data-liraa-bound') !== '1') {
      fetchBtn.setAttribute('data-liraa-bound', '1');
      fetchBtn.addEventListener('click', function () {
        var app = getApp();
        if (isOffline()) {
          if (app && typeof app.showMessage === 'function') {
            app.showMessage('Sem internet. Use o plano LIRAa salvo neste tablet ou importe o JSON antes de sair para campo.', 'warn');
          }
          return;
        }
        if (app && typeof app.showMessage === 'function') {
          app.showMessage('Buscando plano LIRAa liberado pela coordenacao...', 'accent');
        }
        fetchReleasedPlan(true).then(function (loaded) {
          if (!loaded && app && typeof app.showMessage === 'function') {
            app.showMessage(getPlan()
              ? 'API nao trouxe plano novo. Mantendo o plano LIRAa salvo neste tablet.'
              : 'Ainda nao ha plano LIRAa liberado na API.', 'warn');
          }
        }).catch(function (error) {
          if (app && typeof app.showMessage === 'function') {
            app.showMessage('Nao foi possivel buscar o plano LIRAa: ' + error.message, 'warn');
          }
        });
      });
    }

    if (refreshBtn && refreshBtn.getAttribute('data-liraa-bound') !== '1') {
      refreshBtn.setAttribute('data-liraa-bound', '1');
      refreshBtn.addEventListener('click', renderLiraaScreen);
    }

    if (unitSelect && unitSelect.getAttribute('data-liraa-bound') !== '1') {
      unitSelect.setAttribute('data-liraa-bound', '1');
      unitSelect.addEventListener('change', renderLiraaScreen);
    }

    if (openPropertiesBtn && openPropertiesBtn.getAttribute('data-liraa-bound') !== '1') {
      openPropertiesBtn.setAttribute('data-liraa-bound', '1');
      openPropertiesBtn.addEventListener('click', function () {
        var app = getApp();
        if (app && typeof app.showScreen === 'function') {
          app.showScreen('imoveis');
        }
      });
    }
  }

  function injectStyles() {
    if ($('aceLiraaModeStyles')) {
      return;
    }

    var style = documentRef.createElement('style');
    style.id = 'aceLiraaModeStyles';
    style.textContent = [
      '#tabLiraaBtn[hidden],#screen-liraa[hidden],.ace-liraa-hidden{display:none!important}',
      '.liraa-field-hero{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:18px;border-radius:22px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;margin-bottom:14px}',
      '.liraa-field-hero span,.liraa-field-count span,.liraa-field-progress span,.liraa-field-property span{display:block;font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;font-weight:900;opacity:.72}',
      '.liraa-field-hero strong{display:block;font-size:1.35rem}.liraa-field-count{text-align:right}.liraa-field-count strong{display:block;font-size:2rem}',
      '.liraa-field-empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:28px;border-radius:24px;background:#f8fafc;border:1px dashed #cbd5e1;color:#334155;margin-bottom:14px}.liraa-field-empty-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:18px;background:#145f3f;color:#fff;font-weight:950}',
      '.liraa-field-import{margin-top:14px}.liraa-field-import p,.liraa-field-note p{color:#5f7169}.liraa-field-import textarea{width:100%;box-sizing:border-box;border:1px solid #d9e6df;border-radius:14px;padding:12px;margin:12px 0;font:600 .92rem/1.35 monospace;background:#fbfdfb}',
      '.liraa-field-selector{display:flex;gap:12px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}.liraa-field-selector .field{min-width:220px;flex:1}',
      '.liraa-field-progress{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.liraa-field-progress>div{padding:12px;border-radius:16px;background:#fff;border:1px solid #dbe7df}.liraa-field-progress strong{display:block;margin-top:4px;color:#213b31}',
      '.liraa-field-mobile-card{margin-bottom:14px;border:1px solid #bfdbfe;background:linear-gradient(135deg,#eff6ff,#f8fafc)}.liraa-field-mobile-card>strong{display:block;font-size:1.12rem;color:#173b73;margin-top:4px}.liraa-field-mobile-card p{color:#475569;line-height:1.42}.liraa-field-kicker{display:inline-flex;padding:5px 9px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-weight:950;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}.liraa-mobile-tasks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.liraa-mobile-tasks>div{border:1px solid #dbe7df;background:#fff;border-radius:16px;padding:10px}.liraa-mobile-tasks span{display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:#1d4ed8;color:#fff;font-weight:950;margin-bottom:6px}.liraa-mobile-tasks strong{display:block;color:#0f172a}.liraa-mobile-tasks small,.liraa-field-hint{display:block;color:#64748b}.liraa-main-action{width:100%;min-height:54px;font-size:1rem;border-radius:18px;margin-top:8px}',
      '.liraa-field-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.liraa-field-property{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #dbe7df;border-radius:18px;background:#fff}.liraa-field-property.is-done{background:#f0fdf4;border-color:#bbf7d0}.liraa-field-property strong{display:block;margin:3px 0;color:#213b31}.liraa-field-property small{display:block;color:#64748b}',
      '.liraa-field-note{margin-top:14px}',
      '@media(max-width:820px){.liraa-field-hero{align-items:flex-start;flex-direction:column;padding:14px}.liraa-field-count{text-align:left}.liraa-field-progress{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.liraa-mobile-tasks,.liraa-field-list{grid-template-columns:1fr}.liraa-field-property{align-items:stretch;flex-direction:column}.liraa-field-property .btn{width:100%;min-height:50px}.liraa-field-selector{display:block}.liraa-field-selector .btn,.liraa-field-selector select{width:100%;min-height:50px}.liraa-field-selector .btn{margin-top:10px}.liraa-screen .card{border-radius:20px}.liraa-field-note{font-size:.94rem}}'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function installScreen() {
    var nav = documentRef.querySelector('.nav-tabs');
    var visitButton = documentRef.querySelector('[data-screen="visita"]');
    var visitScreen = $('screen-visita');

    if (nav && !$('tabLiraaBtn')) {
      var button = documentRef.createElement('button');
      button.id = 'tabLiraaBtn';
      button.className = 'tab-btn';
      button.setAttribute('data-screen', 'liraa');
      button.type = 'button';
      button.hidden = true;
      button.disabled = true;
      button.classList.add('ace-liraa-hidden');
      button.style.display = 'none';
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
      button.innerHTML = '<span class="tab-btn__label">LIRAa</span>';

      if (visitButton && visitButton.nextSibling) {
        nav.insertBefore(button, visitButton.nextSibling);
      } else {
        nav.appendChild(button);
      }

      button.addEventListener('click', function () {
        var app = getApp();
        if (!updateLiraaVisibility()) {
          return;
        }
        if (app && typeof app.showScreen === 'function') {
          app.showScreen('liraa');
        }
      });
    }

    if (visitScreen && !$('screen-liraa')) {
      var section = documentRef.createElement('section');
      section.id = 'screen-liraa';
      section.className = 'screen liraa-screen';
      section.setAttribute('aria-hidden', 'true');
      section.hidden = true;
      section.classList.add('ace-liraa-hidden');
      section.style.display = 'none';
      section.innerHTML = [
        '<div class="screen-head">',
        '<div class="screen-head-copy">',
        '<strong>LIRAa</strong>',
        '<span>Escolha o quarteirao definido, cadastre o imovel encontrado e inicie a coleta.</span>',
        '</div>',
        '<div class="screen-badge">L</div>',
        '</div>',
        '<div id="liraaDashboard" style="margin-top:16px"></div>'
      ].join('');
      visitScreen.parentNode.insertBefore(section, visitScreen.nextSibling);
    }

    updateLiraaVisibility();
  }

  function hookApp() {
    var app = getApp();
    if (!app || app.__liraaModeHooked) {
      return !!app;
    }

    app.__liraaModeHooked = true;
    var originalShowScreen = app.showScreen;
    var originalSaveProperty = app.savePropertyFromForm;
    var originalMarkDayClosed = app.markDayClosed;

    if (typeof originalSaveProperty === 'function') {
      app.savePropertyFromForm = function () {
        var pendingUnit = state.pendingNewPropertyUnit;
        var beforeId = app.state ? app.state.selectedPropertyId : '';
        var beforeProperty = typeof app.getSelectedProperty === 'function' ? app.getSelectedProperty() : null;
        var beforeUpdatedAt = beforeProperty ? normalizeText(beforeProperty.updatedAt || beforeProperty.updated_at || '') : '';
        var result = originalSaveProperty.apply(app, arguments);

        if (pendingUnit) {
          setTimeout(function () {
            var selectedId = app.state ? app.state.selectedPropertyId : '';
            var property = typeof app.getSelectedProperty === 'function' ? app.getSelectedProperty() : null;
            var afterUpdatedAt = property ? normalizeText(property.updatedAt || property.updated_at || '') : '';

            if (property && selectedId && (selectedId !== beforeId || afterUpdatedAt !== beforeUpdatedAt)) {
              state.pendingNewPropertyUnit = '';
              startLiraaVisit(selectedId, pendingUnit);
            }
          }, 220);
        }

        return result;
      };
    }

    if (typeof originalMarkDayClosed === 'function') {
      app.markDayClosed = function () {
        var result = originalMarkDayClosed.apply(app, arguments);
        clearStoredPlan();
        return result;
      };
    }

    app.showScreen = function (screenName) {
      if (screenName === 'liraa' && !updateLiraaVisibility()) {
        if (typeof originalShowScreen === 'function') {
          originalShowScreen.call(app, 'painel');
        }
        return;
      }

      originalShowScreen.call(app, screenName);
      updateLiraaVisibility();
      if (screenName === 'liraa') {
        renderLiraaScreen();
      }
    };

    return true;
  }

  function bindOperationVisibilityEvents() {
    if (root.__aceLiraaVisibilityEventsBound) {
      return;
    }

    root.__aceLiraaVisibilityEventsBound = true;

    root.addEventListener('ace-operation-mode-change', function () {
      if (updateLiraaVisibility()) {
        renderLiraaScreen();
      }
    });

    documentRef.addEventListener('visibilitychange', function () {
      updateLiraaVisibility();
    });
  }

  function boot() {
    injectStyles();
    installScreen();
    hookApp();
    bindOperationVisibilityEvents();
    updateLiraaVisibility();
    if (shouldShowLiraaTab()) {
      renderLiraaScreen();
    }

    if (!getApp()) {
      setTimeout(boot, 500);
    }
  }

  documentRef.addEventListener('click', function (event) {
    var startButton = event.target.closest('[data-liraa-start-property]');
    var newPropertyButton = event.target.closest('[data-liraa-new-property]');

    if (newPropertyButton) {
      startLiraaNewProperty(newPropertyButton.getAttribute('data-liraa-new-property'));
    }

    if (startButton) {
      startLiraaVisit(
        startButton.getAttribute('data-liraa-start-property'),
        startButton.getAttribute('data-liraa-unit')
      );
    }
  });

  root.ACELiraaMode = {
    version: MODULE_VERSION,
    render: renderLiraaScreen,
    getPlan: getPlan,
    savePlan: savePlan,
    clearPlan: clearStoredPlan,
    updateVisibility: updateLiraaVisibility
  };


  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
