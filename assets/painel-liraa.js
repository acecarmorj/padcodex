(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var MODULE_VERSION = '20260505-liraa-operation-source-v15';
  var PLAN_STORAGE_KEY = 'ace_liraa_sampling_plan_v1';
  var CYCLE_HISTORY_STORAGE_KEY = 'ace_liraa_cycle_history_v1';
  var DEPOSIT_CODES = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'];
  var DEPOSIT_LABELS = {
    A1: "Caixa d'agua elevada",
    A2: 'Deposito baixo de agua',
    B: 'Pequeno deposito movel',
    C: 'Deposito fixo',
    D1: 'Pneu / material rodante',
    D2: 'Lixo / sucata / entulho',
    E: 'Deposito natural'
  };
  var LIRAA_ALLOWED_TERRITORY_KEYS = {
    'centro': true,
    'boa ideia': true,
    'botafogo': true,
    'caixa dagua': true,
    'jardim centenario': true,
    'ulisses lemgruber': true,
    'progresso': true,
    'val paraiso': true
  };

  var state = {
    map: null,
    mapLayers: [],
    lastPlan: null,
    activeTab: 'current'
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

  function repairText(value) {
    return String(value == null ? '' : value);
  }

  function normalizeText(value) {
    return repairText(value).trim();
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

  function isLiraaEligibleTerritory(value) {
    return !!LIRAA_ALLOWED_TERRITORY_KEYS[normalizeTerritoryKey(value)];
  }

  function normalizeOperationMode(value) {
    var mode = normalizeText(value).toUpperCase().replace(/[.\s-]+/g, '_');
    if (mode === 'PE' || mode === 'P_E' || mode === 'PONTO_ESTRATEGICO' || mode === 'PONTO_ESTRATÉGICO') {
      return 'PE';
    }
    if (mode === 'LIRA' || mode === 'LIRAA' || mode === 'LIRA_A') {
      return 'LIRAA';
    }
    return 'VD';
  }

  function isLiraaVisit(visit) {
    visit = visit || {};
    var mode = normalizeOperationMode(visit.operationMode || visit.operation_mode || visit.operational_mode || visit.origem_visita || visit.origemVisita || '');
    var liraaFlag = normalizeKey(visit.liraaColeta || visit.liraa_coleta || visit.coleta_liraa || '');
    var obs = normalizeText(visit.observacao || visit.obs || '').trim();
    return mode === 'LIRAA' || liraaFlag === 'sim' || obs.indexOf('[LIRAa]') === 0 || obs.indexOf('[LIRAA]') === 0;
  }

  function normalizeQuarter(value) {
    return normalizeText(value)
      .replace(/^q\s*[-/]?\s*/i, '')
      .replace(/^0+(\d)/, '$1')
      .trim();
  }

  function parseNumber(value, fallback) {
    var num = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(num) ? num : (fallback || 0);
  }

  function parseBreakdown(value) {
    var map = {};
    DEPOSIT_CODES.forEach(function (code) {
      map[code] = 0;
    });

    String(value || '').split(/[|,;]+/).forEach(function (part) {
      var text = String(part || '').trim();
      var match = text.match(/^([A-Z0-9]+)\((\d+)\)$/i) ||
        text.match(/^([A-Z0-9]+)\s*[:=-]\s*(\d+)$/i);

      if (!match) {
        return;
      }

      var code = String(match[1] || '').toUpperCase();
      var qty = Number(match[2] || 0) || 0;

      if (Object.prototype.hasOwnProperty.call(map, code)) {
        map[code] += qty;
      }
    });

    return map;
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
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeCycleArchive(item) {
    item = item && typeof item === 'object' ? item : {};
    var summary = item.summary && typeof item.summary === 'object' ? item.summary : {};
    var plan = item.plan && typeof item.plan === 'object' ? item.plan : {};
    return Object.assign({}, item, {
      id: normalizeText(item.id || item.cycle_id || item.cycleId || ''),
      name: normalizeText(item.name || item.nome || plan.cycle || 'LIRAa'),
      archivedAt: normalizeText(item.archivedAt || item.archived_at || item.updatedAt || ''),
      archivedDate: normalizeText(item.archivedDate || item.archived_date || ''),
      archivedBy: normalizeText(item.archivedBy || item.archived_by || ''),
      archivedByMatricula: normalizeText(item.archivedByMatricula || item.archived_by_matricula || ''),
      summary: summary,
      plan: plan
    });
  }

  function getCloudCycleHistory() {
    var bundle = getBundle();
    var cycles = Array.isArray(bundle.liraa_cycles) ? bundle.liraa_cycles :
      (Array.isArray(bundle.liraaCycles) ? bundle.liraaCycles : []);
    return cycles.map(normalizeCycleArchive).filter(function (item) {
      return !!item.id;
    });
  }

  function mergeCycleHistory(localCycles, cloudCycles) {
    var map = {};
    var order = [];

    function add(item) {
      item = normalizeCycleArchive(item);
      if (!item.id) {
        return;
      }
      if (!map[item.id]) {
        order.push(item.id);
      }
      map[item.id] = Object.assign({}, map[item.id] || {}, item);
    }

    (cloudCycles || []).forEach(add);
    (localCycles || []).forEach(add);

    return order.map(function (id) {
      return map[id];
    }).sort(function (a, b) {
      return Date.parse(b.archivedAt || b.archivedDate || '') - Date.parse(a.archivedAt || a.archivedDate || '');
    });
  }

  function readCycleHistory() {
    var cycles = readJson(CYCLE_HISTORY_STORAGE_KEY, []);
    return mergeCycleHistory(Array.isArray(cycles) ? cycles : [], getCloudCycleHistory());
  }

  function saveCycleHistory(cycles) {
    return writeJson(CYCLE_HISTORY_STORAGE_KEY, Array.isArray(cycles) ? cycles : []);
  }

  function getLocalDateString(date) {
    var value = date || new Date();
    var year = value.getFullYear();
    var month = String(value.getMonth() + 1).padStart(2, '0');
    var day = String(value.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function makeCycleArchiveId() {
    return 'liraa-cycle-' + getLocalDateString(new Date()) + '-' + String(Date.now());
  }

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value || null));
    } catch (error) {
      return value || null;
    }
  }

  function getBundle() {
    return root.ACE_PANEL_CLOUD_BUNDLE ||
      (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getBundle === 'function'
        ? root.ACEPanelCloudSync.getBundle()
        : null) ||
      {};
  }

  function readVisits() {
    var bundle = getBundle();
    if (Array.isArray(bundle.visits)) {
      return bundle.visits;
    }
    return readJson('dengue_db_visits_v1', []);
  }

  function readProperties() {
    var bundle = getBundle();
    if (Array.isArray(bundle.properties)) {
      return bundle.properties;
    }
    return readJson('dengue_db_properties_v1', []);
  }

  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return String(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '').trim();
  }

  function isApiConfigured() {
    var url = getApiUrl();
    return !!url && /^https?:\/\//i.test(url) && url.indexOf('COLE_AQUI') === -1;
  }

  function postJsonToApi(payload) {
    var apiUrl = getApiUrl();
    if (!isApiConfigured()) {
      return Promise.reject(new Error('API_URL nao configurada.'));
    }
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('Fetch indisponivel neste navegador.'));
    }

    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {})
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('A API nao confirmou a publicacao.');
      }
      return response.json();
    });
  }

  function getPanelSessionPayload() {
    var session = root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getSessionInfo === 'function'
      ? root.ACEPanelCloudSync.getSessionInfo()
      : null;
    var token = session && String(session.sessionToken || session.session_token || '').trim();

    if (!token) {
      return null;
    }

    return {
      sessionToken: token,
      access_module: 'coordenacao',
      accessModule: 'coordenacao'
    };
  }

  function postProtectedJsonToApi(payload, promptMessage) {
    var sessionPayload = getPanelSessionPayload();

    if (sessionPayload) {
      return postJsonToApi(Object.assign({}, payload || {}, sessionPayload));
    }

    return requestPublishCredentials(promptMessage).then(function (credentials) {
      return postJsonToApi(Object.assign({}, payload || {}, {
        admin_matricula: credentials.matricula,
        admin_hash: credentials.hash
      }));
    });
  }

  function archiveCycleToCloud(archive) {
    if (!isApiConfigured()) {
      return Promise.resolve({ skipped: true });
    }

    return postProtectedJsonToApi({
      action: 'liraa_cycle_archive',
      archive: archive
    }, 'Digite a senha administrativa para salvar o ciclo LIRAa no historico da planilha:').then(function (payload) {
      if (!payload || payload.ok === false) {
        throw new Error((payload && payload.error) || 'A API nao confirmou o arquivamento do ciclo LIRAa.');
      }

      if (Array.isArray(payload.liraa_cycles) || Array.isArray(payload.cycles)) {
        var bundle = getBundle();
        if (bundle) {
          bundle.liraa_cycles = Array.isArray(payload.liraa_cycles) ? payload.liraa_cycles : payload.cycles;
          bundle.liraaCycles = bundle.liraa_cycles;
        }
      }

      return payload;
    });
  }

  function sha256Text(text) {
    var value = String(text || '');
    if (root.crypto && root.crypto.subtle && typeof TextEncoder !== 'undefined') {
      return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(function (buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
          return byte.toString(16).padStart(2, '0');
        }).join('');
      });
    }
    return Promise.reject(new Error('Criptografia SHA-256 indisponivel neste navegador.'));
  }

  function requestPublishCredentials(message) {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    var matricula = String(runtime.PANEL_ADMIN_MATRICULA || runtime.ADMIN_MATRICULA || 'ADM').trim() || 'ADM';
    var password = root.prompt(message || 'Digite a senha administrativa para liberar o plano LIRAa aos agentes:');

    if (password == null) {
      return Promise.reject(new Error('Liberacao cancelada.'));
    }
    if (!password) {
      return Promise.reject(new Error('Senha administrativa nao informada.'));
    }

    return sha256Text(password).then(function (hash) {
      return {
        matricula: matricula,
        hash: hash
      };
    });
  }

  function getTerritoryPolygons() {
    var source = root.ACE_TERRITORY_SOURCE || {};
    return Array.isArray(source.polygons) ? source.polygons : [];
  }

  function getFeatureTerritory(feature) {
    return normalizeText(feature && (feature.folder || feature.originalFolder || feature.territory || ''));
  }

  function getFeatureQuarter(feature) {
    return normalizeQuarter(feature && (feature.name || feature.originalName || ''));
  }

  function isUsefulPolygon(feature) {
    if (!feature || !Array.isArray(feature.coordinates) || feature.coordinates.length < 3) {
      return false;
    }
    var territory = normalizeTerritoryKey(getFeatureTerritory(feature));
    if (!territory || territory === 'carmo' || !LIRAA_ALLOWED_TERRITORY_KEYS[territory]) {
      return false;
    }
    if (normalizeKey(feature.territoryType || '') === 'distrito') {
      return false;
    }
    return true;
  }

  function makeUnitKey(territory, quarter) {
    return normalizeTerritoryKey(territory) + '|' + normalizeQuarter(quarter || 'Distrito');
  }

  function getPropertyUnitKey(property) {
    var territory = normalizeText(property.microarea || property.bairro || property.gps_territory || '');
    var quarter = normalizeQuarter(property.quarteirao || property.gps_quarteirao || '');
    if (!territory) {
      return '';
    }
    return makeUnitKey(territory, quarter || 'Sem quarteirao');
  }

  function getVisitUnitKey(visit) {
    var territory = normalizeText(visit.microarea || visit.bairro || visit.gps_territory || '');
    var quarter = normalizeQuarter(visit.quarteirao || visit.gps_quarteirao || '');
    if (!territory) {
      return '';
    }
    return makeUnitKey(territory, quarter || 'Sem quarteirao');
  }

  function getVisitKey(visit) {
    return normalizeText(visit.property_uid || visit.propertyUid) ||
      [
        normalizeKey(visit.bairro),
        normalizeKey(visit.logradouro),
        normalizeKey(visit.numero)
      ].join('|');
  }

  function isClosedVisit(visit) {
    var status = normalizeKey(visit.situacao);
    return status === 'fechado' || status === 'recusa' || status === 'recusado';
  }

  function visitHasFocus(visit) {
    return normalizeKey(visit.foco || visit.focusFound) === 'sim' ||
      parseNumber(visit.focus_count || visit.focusCount || visit.focusQty, 0) > 0 ||
      parseNumber(visit.deposit_focus_count || visit.depositFocusCount || visit.depositFocusTotal, 0) > 0;
  }

  function getDepositCount(visit) {
    return parseNumber(visit.deposit_count || visit.depositCount || visit.depositTotal, 0);
  }

  function getDepositFocusCount(visit) {
    return parseNumber(visit.deposit_focus_count || visit.depositFocusCount || visit.depositFocusTotal, 0);
  }

  function formatPercent(value) {
    return Number(value || 0).toFixed(1).replace('.', ',') + '%';
  }

  function formatBreteau(value) {
    return Number(value || 0).toFixed(1).replace('.', ',');
  }

  function buildUnits(properties, visits) {
    var units = {};

    getTerritoryPolygons().filter(isUsefulPolygon).forEach(function (feature) {
      var territory = getFeatureTerritory(feature);
      var quarter = getFeatureQuarter(feature) || 'Distrito';
      var key = makeUnitKey(territory, quarter);
      if (!units[key]) {
        units[key] = {
          key: key,
          territory: territory,
          quarter: quarter,
          polygon: feature,
          properties: 0,
          visits: 0,
          positiveVisits: 0,
          positiveDeposits: 0
        };
      } else if (!units[key].polygon) {
        units[key].polygon = feature;
      }
    });

    (properties || []).forEach(function (property) {
      if (!isLiraaEligibleTerritory(property.microarea || property.bairro || property.gps_territory || '')) {
        return;
      }
      var key = getPropertyUnitKey(property);
      if (!key) {
        return;
      }
      if (!units[key]) {
        units[key] = {
          key: key,
          territory: normalizeText(property.microarea || property.bairro || 'Sem area'),
          quarter: normalizeQuarter(property.quarteirao || 'Sem quarteirao'),
          polygon: null,
          properties: 0,
          visits: 0,
          positiveVisits: 0,
          positiveDeposits: 0
        };
      }
      units[key].properties += 1;
    });

    (visits || []).forEach(function (visit) {
      if (!isLiraaEligibleTerritory(visit.microarea || visit.bairro || visit.gps_territory || '')) {
        return;
      }
      var key = getVisitUnitKey(visit);
      if (!key) {
        return;
      }
      if (!units[key]) {
        units[key] = {
          key: key,
          territory: normalizeText(visit.microarea || visit.bairro || 'Sem area'),
          quarter: normalizeQuarter(visit.quarteirao || 'Sem quarteirao'),
          polygon: null,
          properties: 0,
          visits: 0,
          positiveVisits: 0,
          positiveDeposits: 0
        };
      }
      units[key].visits += 1;
      units[key].positiveDeposits += getDepositFocusCount(visit);
      if (visitHasFocus(visit)) {
        units[key].positiveVisits += 1;
      }
    });

    return Object.keys(units).map(function (key) {
      var unit = units[key];
      unit.sortLabel = normalizeKey(unit.territory) + ' ' + normalizeQuarter(unit.quarter);
      return unit;
    }).sort(function (a, b) {
      return a.sortLabel.localeCompare(b.sortLabel, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }

  function buildSnapshot() {
    var allVisits = readVisits();
    var visits = allVisits.filter(isLiraaVisit);
    var properties = readProperties();
    var inspectedKeys = {};
    var positiveKeys = {};
    var closedCount = 0;
    var depositsTotal = 0;
    var depositsPositive = 0;
    var byDeposit = {};
    var byArea = {};

    DEPOSIT_CODES.forEach(function (code) {
      byDeposit[code] = { code: code, inspected: 0, positive: 0 };
    });

    visits.forEach(function (visit) {
      if (!isLiraaEligibleTerritory(visit.microarea || visit.bairro || visit.gps_territory || '')) {
        return;
      }
      var key = getVisitKey(visit);
      var area = normalizeText(visit.microarea) || normalizeText(visit.bairro) || 'Sem area';

      if (isClosedVisit(visit)) {
        closedCount += 1;
        return;
      }

      if (key) {
        inspectedKeys[key] = true;
      }

      depositsTotal += getDepositCount(visit);
      depositsPositive += getDepositFocusCount(visit);

      if (!byArea[area]) {
        byArea[area] = { area: area, inspected: 0, positives: 0, positiveDeposits: 0 };
      }

      byArea[area].inspected += key ? 1 : 0;
      byArea[area].positiveDeposits += getDepositFocusCount(visit);

      if (visitHasFocus(visit) && key) {
        positiveKeys[key] = true;
        byArea[area].positives += 1;
      }

      var deposits = parseBreakdown(visit.deposits || visit.deposit_breakdown);
      var focus = parseBreakdown(visit.deposit_focus_breakdown || visit.depositFocusBreakdown);

      DEPOSIT_CODES.forEach(function (code) {
        byDeposit[code].inspected += Number(deposits[code] || 0) || 0;
        byDeposit[code].positive += Number(focus[code] || 0) || 0;
      });
    });

    var inspected = Object.keys(inspectedKeys).length;
    var positives = Object.keys(positiveKeys).length;
    var iip = inspected ? (positives / inspected) * 100 : 0;
    var breteau = inspected ? (depositsPositive / inspected) * 100 : 0;

    return {
      totalVisits: visits.length,
      totalProperties: properties.length,
      inspected: inspected,
      positives: positives,
      closedCount: closedCount,
      depositsTotal: depositsTotal,
      depositsPositive: depositsPositive,
      iip: iip,
      breteau: breteau,
      units: buildUnits(properties, visits),
      byDeposit: DEPOSIT_CODES.map(function (code) { return byDeposit[code]; }),
      byArea: Object.keys(byArea).map(function (key) {
        var row = byArea[key];
        row.iip = row.inspected ? (row.positives / row.inspected) * 100 : 0;
        return row;
      }).sort(function (a, b) {
        return b.iip - a.iip || b.positiveDeposits - a.positiveDeposits;
      })
    };
  }

  function getRisk(iip) {
    if (iip >= 4) {
      return { label: 'Risco alto', cls: 'danger' };
    }
    if (iip >= 1) {
      return { label: 'Alerta', cls: 'warn' };
    }
    return { label: 'Satisfatorio', cls: 'ok' };
  }

  function groupUnitsByTerritory(units) {
    var groups = {};
    (units || []).forEach(function (unit) {
      var key = normalizeTerritoryKey(unit.territory) || 'sem area';
      if (!groups[key]) {
        groups[key] = { key: key, name: unit.territory || 'Sem area', units: [], properties: 0 };
      }
      groups[key].units.push(unit);
      groups[key].properties += unit.properties || 0;
    });
    return Object.keys(groups).map(function (key) {
      var group = groups[key];
      group.units.sort(function (a, b) {
        return normalizeQuarter(a.quarter).localeCompare(normalizeQuarter(b.quarter), 'pt-BR', {
          numeric: true,
          sensitivity: 'base'
        });
      });
      return group;
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }

  function getPlanInputs() {
    var today = new Date().toISOString().slice(0, 10);
    var cycle = $('liraaCycleName') ? $('liraaCycleName').value : '';
    return {
      cycle: normalizeText(cycle) || ('LIRAa ' + today),
      seed: 'manual',
      percent: 20,
      minBlocks: 1
    };
  }

  function buildSelectedMapFromRows(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      if (row && row.key) {
        map[row.key] = true;
      }
    });
    return map;
  }

  function estimatePropertiesForUnit(unit, group) {
    var groupAverage = group && group.units && group.units.length
      ? Math.round((group.properties || 0) / Math.max(1, group.units.length))
      : 0;
    return Number(unit.properties || 0) || Math.max(5, groupAverage || 10);
  }

  function buildManualPlan(snapshot, inputs, selectedMap) {
    var groups = groupUnitsByTerritory(snapshot.units);
    var cleanSelectedMap = {};
    var selected = [];
    var selectedGroups = {};
    var totalProperties = 0;
    var targetProperties = 0;

    groups.forEach(function (group) {
      (group.units || []).forEach(function (unit) {
        if (!selectedMap || !selectedMap[unit.key] || normalizeKey(unit.quarter) === 'sem quarteirao') {
          return;
        }
        var estimatedProperties = estimatePropertiesForUnit(unit, group);
        var propertiesToInspect = Math.max(1, Math.ceil(estimatedProperties * 0.2));
        var row = {
          order: selected.length + 1,
          territory: unit.territory,
          quarter: unit.quarter || 'Distrito',
          key: unit.key,
          properties: unit.properties,
          estimatedProperties: estimatedProperties,
          propertiesToInspect: propertiesToInspect,
          seedOrder: 0,
          hasPolygon: !!unit.polygon,
          positiveVisits: unit.positiveVisits || 0,
          positiveDeposits: unit.positiveDeposits || 0
        };
        selected.push(row);
        cleanSelectedMap[unit.key] = true;
        selectedGroups[group.key] = true;
        totalProperties += estimatedProperties;
        targetProperties += propertiesToInspect;
      });
    });

    return {
      version: MODULE_VERSION,
      generatedAt: new Date().toISOString(),
      cycle: inputs.cycle,
      seed: 'manual',
      percent: 20,
      minBlocks: 1,
      manualSelection: true,
      method: 'Plano manual do LIRAa: quarteiroes e microareas definidos fora do sistema e marcados pela coordenacao no painel.',
      groups: Object.keys(selectedGroups).length,
      totalBlocks: selected.length,
      totalProperties: totalProperties,
      targetProperties: targetProperties,
      selectedMap: cleanSelectedMap,
      selected: selected
    };
  }

  function getActivePlan(snapshot) {
    if (state.lastPlan) {
      return ensurePlanSelectedMap(state.lastPlan);
    }
    var stored = readJson(PLAN_STORAGE_KEY, null);
    if (stored && Array.isArray(stored.selected) && isEligiblePlan(stored)) {
      stored.version = stored.version || MODULE_VERSION;
      state.lastPlan = ensurePlanSelectedMap(stored);
      return state.lastPlan;
    }
    state.lastPlan = buildManualPlan(snapshot, getPlanInputs(), {});
    return state.lastPlan;
  }

  function isEligiblePlan(plan) {
    return (plan.selected || []).every(function (row) {
      return !!(row && (row.key || row.territory || row.quarter));
    });
  }

  function ensurePlanSelectedMap(plan) {
    plan = plan || buildManualPlan(buildSnapshot(), getPlanInputs(), {});
    if (!plan.selectedMap || typeof plan.selectedMap !== 'object') {
      plan.selectedMap = buildSelectedMapFromRows(plan.selected || []);
    }
    plan.totalBlocks = (plan.selected || []).length;
    plan.groups = plan.groups || countSelectedGroups(plan.selected || []);
    return plan;
  }

  function countSelectedGroups(rows) {
    var groups = {};
    (rows || []).forEach(function (row) {
      var key = normalizeTerritoryKey(row.territory || '');
      if (key) {
        groups[key] = true;
      }
    });
    return Object.keys(groups).length;
  }

  function savePlan(plan) {
    state.lastPlan = ensurePlanSelectedMap(plan);
    writeJson(PLAN_STORAGE_KEY, state.lastPlan);
  }

  function collectSelectedMapFromDom() {
    var boxes = Array.prototype.slice.call(documentRef.querySelectorAll('[data-liraa-unit-checkbox]'));
    if (!boxes.length) {
      return state.lastPlan && state.lastPlan.selectedMap ? Object.assign({}, state.lastPlan.selectedMap) : {};
    }
    var map = {};
    boxes.forEach(function (box) {
      if (box.checked) {
        map[box.getAttribute('data-liraa-unit-checkbox')] = true;
      }
    });
    return map;
  }

  function saveManualSelection(showMessage) {
    var snapshot = buildSnapshot();
    var plan = buildManualPlan(snapshot, getPlanInputs(), collectSelectedMapFromDom());
    savePlan(plan);
    if (showMessage) {
      notify('Plano LIRAa salvo com ' + plan.totalBlocks + ' quarteirao(s) marcado(s).', 'ok');
    }
    return plan;
  }

  function downloadTextFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = documentRef.createElement('a');

    link.href = url;
    link.download = filename;
    documentRef.body.appendChild(link);
    link.click();

    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 1000);
  }

  function notify(message, kind) {
    var node = $('panelStatus');
    if (node) {
      node.textContent = message;
      node.className = 'sync-banner ' + (kind || 'ok');
      return;
    }
    root.alert(message);
  }

  function card(label, value, note, cls) {
    return '<div class="panel-liraa-card ' + escapeHtml(cls || '') + '">' +
      '<span>' + escapeHtml(label) + '</span>' +
      '<strong>' + escapeHtml(value) + '</strong>' +
      '<small>' + escapeHtml(note || '') + '</small>' +
    '</div>';
  }

  function renderDepositTable(snapshot) {
    var rows = snapshot.byDeposit.filter(function (row) {
      return row.inspected > 0 || row.positive > 0;
    });

    if (!rows.length) {
      return '<div class="empty-state">Sem depositos registrados no pacote atual.</div>';
    }

    return '<div class="panel-liraa-table-wrap"><table><thead><tr><th>Codigo</th><th>Tipo</th><th>Inspecionados</th><th>Positivos</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr>' +
          '<td><strong>' + escapeHtml(row.code) + '</strong></td>' +
          '<td>' + escapeHtml(DEPOSIT_LABELS[row.code] || row.code) + '</td>' +
          '<td>' + escapeHtml(String(row.inspected)) + '</td>' +
          '<td>' + escapeHtml(String(row.positive)) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function renderAreaList(snapshot) {
    if (!snapshot.byArea.length) {
      return '<div class="empty-state">Sem areas inspecionadas no pacote atual.</div>';
    }

    return snapshot.byArea.slice(0, 10).map(function (row) {
      return '<div class="panel-liraa-area">' +
        '<strong>' + escapeHtml(row.area) + '</strong>' +
        '<span>' + escapeHtml(row.inspected + ' imovel(is), ' + row.positives + ' positivo(s), IIP ' + formatPercent(row.iip)) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderPlanTable(plan) {
    if (!plan.selected.length) {
      return '<div class="empty-state">Nenhum quarteirao marcado para o LIRAa. Marque os quarteiroes na lista de selecao manual.</div>';
    }

    return '<div class="panel-liraa-table-wrap"><table><thead><tr><th>#</th><th>Estrato / microarea</th><th>Quarteirao</th><th>Imoveis</th><th>A vistoriar</th></tr></thead><tbody>' +
      plan.selected.map(function (row) {
        return '<tr>' +
          '<td>' + escapeHtml(row.order) + '</td>' +
          '<td>' + escapeHtml(row.territory) + '</td>' +
          '<td><strong>' + escapeHtml(row.quarter) + '</strong></td>' +
          '<td>' + escapeHtml(row.properties ? row.properties : ('~' + row.estimatedProperties)) + '</td>' +
          '<td><strong>' + escapeHtml(row.propertiesToInspect) + '</strong></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function renderUnitSelector(snapshot, plan) {
    var groups = groupUnitsByTerritory(snapshot.units).map(function (group) {
      group.units = (group.units || []).filter(function (unit) {
        return normalizeKey(unit.quarter) !== 'sem quarteirao';
      });
      return group;
    }).filter(function (group) { return group.units.length > 0; });
    var selectedMap = plan.selectedMap || {};
    if (!groups.length) {
      return '<section class="card panel-liraa-picker"><h2 class="section-title">Selecao manual dos quarteiroes</h2><div class="empty-state">Nenhuma microarea/quarteirao elegivel encontrado na base territorial.</div></section>';
    }

    return '<section class="card panel-liraa-picker">' +
      '<div class="panel-liraa-section-head">' +
        '<div><h2 class="section-title">Selecao manual dos quarteiroes do LIRAa</h2><p class="card-note">Escolha a microarea e marque os quarteiroes definidos externamente. O painel nao sorteia: ele apenas registra e libera o plano informado pela coordenacao.</p></div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-soft btn-mini btn-liraa-picker-action" id="liraaMarkAllBtn" type="button">Marcar todos</button>' +
          '<button class="btn btn-soft btn-mini btn-liraa-picker-action" id="liraaClearAllBtn" type="button">Limpar</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel-liraa-picker-groups">' +
        groups.map(function (group) {
          var marked = (group.units || []).filter(function (unit) { return !!selectedMap[unit.key]; }).length;
          return '<details class="panel-liraa-picker-group" open>' +
            '<summary>' +
              '<strong>' + escapeHtml(group.name) + '</strong>' +
              '<span>' + escapeHtml(marked + '/' + group.units.length + ' marcado(s)') + '</span>' +
              '<div class="panel-liraa-group-actions">' +
                '<button class="btn btn-mini" type="button" data-liraa-group-action="mark" data-liraa-group="' + escapeHtml(group.key) + '">Marcar grupo</button>' +
                '<button class="btn btn-mini" type="button" data-liraa-group-action="clear" data-liraa-group="' + escapeHtml(group.key) + '">Limpar</button>' +
              '</div>' +
            '</summary>' +
            '<div class="panel-liraa-quarter-grid">' +
              group.units.map(function (unit) {
                var checked = selectedMap[unit.key] ? ' checked' : '';
                var focusText = (unit.positiveVisits || unit.positiveDeposits)
                  ? ' • foco recente: ' + (unit.positiveVisits || unit.positiveDeposits)
                  : '';
                return '<label class="panel-liraa-quarter-option ' + (checked ? 'is-selected' : '') + '">' +
                  '<input type="checkbox" data-liraa-unit-checkbox="' + escapeHtml(unit.key) + '" data-liraa-group-key="' + escapeHtml(group.key) + '"' + checked + '>' +
                  '<span><strong>Q ' + escapeHtml(unit.quarter || 'Distrito') + '</strong><small>' + escapeHtml((unit.properties || 0) + ' imovel(is)' + focusText) + '</small></span>' +
                '</label>';
              }).join('') +
            '</div>' +
          '</details>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  function renderSummary(snapshot, plan) {
    var risk = getRisk(snapshot.iip);
    var dominant = snapshot.byDeposit.slice().sort(function (a, b) {
      return b.positive - a.positive || b.inspected - a.inspected;
    })[0];
    var dominantText = dominant && dominant.positive
      ? dominant.code + ' - ' + (DEPOSIT_LABELS[dominant.code] || '') + ' (' + dominant.positive + ')'
      : 'Sem positivos';

    return '' +
      '<div class="panel-liraa-hero ' + escapeHtml(risk.cls) + '">' +
        '<div><span>Modulo LIRAa da coordenacao</span><strong>' + escapeHtml(risk.label) + '</strong><small>IIP, Breteau, deposito predominante e plano manual de quarteiroes.</small></div>' +
        '<div>' + escapeHtml(formatPercent(snapshot.iip)) + '</div>' +
      '</div>' +
      '<div class="panel-liraa-grid">' +
        card('Imoveis pesquisados', String(snapshot.inspected), 'Base para IIP e Breteau.', 'accent') +
        card('Imoveis positivos', String(snapshot.positives), 'Com foco ou deposito positivo.', 'danger') +
        card('IIP', formatPercent(snapshot.iip), 'Positivos / pesquisados.', risk.cls) +
        card('Breteau', formatBreteau(snapshot.breteau), 'Depositos positivos por 100 imoveis.', 'warn') +
        card('Depositos positivos', String(snapshot.depositsPositive), 'Total de recipientes positivos.', 'danger') +
        card('Deposito predominante', dominantText, 'Prioridade de intervencao.', 'accent') +
        card('Quarteiroes marcados', String(plan.totalBlocks), 'Plano atual: ' + plan.cycle + '.', 'accent') +
        card('Imoveis a vistoriar', String(plan.targetProperties), '20% estimado dos quarteiroes marcados.', 'ok') +
        card('Microareas marcadas', String(plan.groups), 'Definidas manualmente pela coordenacao.', 'accent') +
      '</div>';
  }

  function renderControls(plan) {
    return '' +
      '<section class="card panel-liraa-controls">' +
        '<div class="panel-liraa-controls-head">' +
          '<div><h2 class="section-title">Plano manual do LIRAa</h2><p class="card-note">A lista oficial de microareas e quarteiroes e definida fora do sistema. Aqui a coordenacao apenas marca o que entra no ciclo e libera para os agentes.</p></div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-primary" id="liraaSavePlanBtn" type="button">Salvar marcacao</button>' +
            '<button class="btn btn-primary" id="liraaPublishPlanBtn" type="button">Liberar para agentes</button>' +
            '<button class="btn btn-soft" id="liraaCopyPlanBtn" type="button">Copiar plano</button>' +
            '<button class="btn btn-soft" id="liraaDownloadPlanBtn" type="button">Baixar plano</button>' +
          '</div>' +
        '</div>' +
        '<div class="panel-liraa-form panel-liraa-form-compact">' +
          '<label>Ciclo / identificacao<input id="liraaCycleName" type="text" value="' + escapeHtml(plan.cycle) + '" placeholder="Ex.: LIRAa Maio/2026"></label>' +
        '</div>' +
      '</section>';
  }

  function buildCycleArchive(snapshot, plan, cycleName) {
    snapshot = snapshot || buildSnapshot();
    plan = ensurePlanSelectedMap(plan || getActivePlan(snapshot));
    return {
      id: makeCycleArchiveId(),
      name: normalizeText(cycleName) || plan.cycle || ('LIRAa ' + getLocalDateString(new Date())),
      archivedAt: new Date().toISOString(),
      archivedDate: getLocalDateString(new Date()),
      version: MODULE_VERSION,
      summary: {
        inspected: snapshot.inspected || 0,
        positives: snapshot.positives || 0,
        iip: snapshot.iip || 0,
        breteau: snapshot.breteau || 0,
        depositsPositive: snapshot.depositsPositive || 0,
        totalBlocks: plan.totalBlocks || 0,
        groups: plan.groups || 0,
        targetProperties: plan.targetProperties || 0
      },
      plan: cloneJson(plan)
    };
  }

  function hasCycleData(snapshot, plan) {
    plan = plan || {};
    snapshot = snapshot || {};
    return !!(
      (plan.totalBlocks || 0) ||
      (snapshot.inspected || 0) ||
      (snapshot.positives || 0) ||
      (snapshot.depositsPositive || 0)
    );
  }

  function archiveCurrentCycle() {
    var snapshot = buildSnapshot();
    var plan = getActivePlan(snapshot);

    if (!hasCycleData(snapshot, plan)) {
      notify('Nao ha plano nem resultado LIRAa para arquivar.', 'warn');
      return;
    }

    var defaultName = plan.cycle || ('LIRAa ' + getLocalDateString(new Date()));
    var cycleName = root.prompt('Nome do ciclo que sera arquivado:', defaultName);
    if (cycleName == null) {
      return;
    }

    cycleName = normalizeText(cycleName) || defaultName;

    if (!root.confirm('Encerrar e arquivar o ciclo "' + cycleName + '"?\\n\\nO historico sera mantido e voce podera limpar o plano atual para iniciar o proximo ciclo.')) {
      return;
    }

    var archive = buildCycleArchive(snapshot, plan, cycleName);
    var history = readCycleHistory().filter(function (item) {
      return item && item.id !== archive.id;
    });

    history.unshift(archive);
    saveCycleHistory(history.slice(0, 60));

    state.activeTab = 'history';
    notify('Ciclo LIRAa arquivado localmente. Salvando tambem na planilha...', 'accent');
    render();

    archiveCycleToCloud(archive).then(function () {
      notify('Ciclo LIRAa arquivado no historico local e na planilha/API.', 'ok');
      if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.reloadFromCloud === 'function') {
        return root.ACEPanelCloudSync.reloadFromCloud().then(function () {
          render();
          return null;
        });
      }
      render();
      return null;
    }).catch(function (error) {
      notify('Ciclo arquivado localmente, mas nao foi salvo na planilha: ' + (error && error.message ? error.message : error), 'warn');
    });
  }

  function clearCurrentPlan() {
    var snapshot = buildSnapshot();
    var plan = getActivePlan(snapshot);
    var message = 'Limpar o plano local atual do LIRAa?\n\nEssa acao nao apaga visitas, resultados sincronizados, operacoes ou historico arquivado. Ela apenas limpa o plano atual da tela do LIRAa e, se a API estiver configurada, tambem remove o plano LIRAa ativo na nuvem.';

    function finishClear(successMessage) {
      removeJson(PLAN_STORAGE_KEY);
      state.lastPlan = buildManualPlan(buildSnapshot(), { cycle: 'LIRAa ' + getLocalDateString(new Date()) }, {});
      notify(successMessage || 'Plano local do LIRAa limpo. A tela esta pronta para o proximo ciclo.', 'ok');
      render();
    }

    if (!plan.totalBlocks && !snapshot.inspected && !isApiConfigured()) {
      notify('O plano local do LIRAa ja esta limpo.', 'warn');
      return;
    }

    if (!root.confirm(message)) {
      return;
    }

    if (!isApiConfigured()) {
      finishClear('Plano local do LIRAa limpo. A tela esta pronta para o proximo ciclo.');
      return;
    }

    clearPublishedLiraaPlan().then(function () {
      finishClear('Plano LIRAa limpo na nuvem e no painel local.');
    }).catch(function (error) {
      notify('Nao foi possivel limpar o plano LIRAa na nuvem: ' + (error && error.message ? error.message : error), 'warn');
    });
  }

  function downloadArchivedCycle(cycleId) {
    var archive = readCycleHistory().filter(function (item) {
      return item && item.id === cycleId;
    })[0];

    if (!archive) {
      notify('Ciclo arquivado nao encontrado.', 'warn');
      return;
    }

    var safeName = normalizeKey(archive.name || archive.id).replace(/\s+/g, '-').slice(0, 80) || archive.id;
    downloadTextFile(
      safeName + '.json',
      JSON.stringify(archive, null, 2),
      'application/json;charset=utf-8'
    );
    notify('Arquivo do ciclo LIRAa arquivado gerado.', 'ok');
  }

  function clearPublishedLiraaPlan() {
    if (!isApiConfigured()) {
      return Promise.resolve({ skipped: true });
    }

    notify('Limpando plano LIRAa ativo na nuvem...', 'accent');
    return postProtectedJsonToApi({
      action: 'liraa_plan_clear'
    }, 'Digite a senha administrativa para limpar o plano LIRAa ativo:').then(function (payload) {
      if (!payload || payload.ok === false) {
        throw new Error((payload && payload.error) || 'A API nao confirmou a limpeza do plano LIRAa.');
      }
      return payload;
    });
  }

  function renderCycleTabs() {
    var currentActive = state.activeTab !== 'history';
    var historyActive = state.activeTab === 'history';
    return '' +
      '<section class="card panel-liraa-tabs" role="tablist" aria-label="Abas do LIRAa">' +
        '<button class="btn ' + (currentActive ? 'btn-primary' : 'btn-soft') + '" type="button" role="tab" aria-selected="' + (currentActive ? 'true' : 'false') + '" data-liraa-panel-tab="current">Ciclo atual</button>' +
        '<button class="btn ' + (historyActive ? 'btn-primary' : 'btn-soft') + '" type="button" role="tab" aria-selected="' + (historyActive ? 'true' : 'false') + '" data-liraa-panel-tab="history">Historico de ciclos LIRAa</button>' +
      '</section>';
  }

  function renderCycleHistory() {
    var history = readCycleHistory();

    if (!history.length) {
      return '' +
        '<section class="card panel-liraa-history">' +
          '<div class="panel-liraa-section-head"><div><h2 class="section-title">Historico de ciclos LIRAa</h2><p class="card-note">Quando um ciclo for encerrado e arquivado, ele aparecera aqui para conferencia posterior.</p></div></div>' +
          '<div class="empty-state">Nenhum ciclo LIRAa arquivado ainda.</div>' +
        '</section>';
    }

    return '' +
      '<section class="card panel-liraa-history">' +
        '<div class="panel-liraa-section-head"><div><h2 class="section-title">Historico de ciclos LIRAa</h2><p class="card-note">Ciclos encerrados ficam arquivados no painel e, quando a API estiver configurada, tambem na planilha para consulta e download.</p></div></div>' +
        '<div class="panel-liraa-table-wrap"><table><thead><tr><th>Ciclo</th><th>Arquivado em</th><th>Quarteiroes</th><th>Imoveis pesquisados</th><th>IIP</th><th>Breteau</th><th>Acao</th></tr></thead><tbody>' +
          history.map(function (item) {
            var summary = item.summary || {};
            return '<tr>' +
              '<td><strong>' + escapeHtml(item.name || 'LIRAa') + '</strong></td>' +
              '<td>' + escapeHtml(item.archivedDate || '') + '</td>' +
              '<td>' + escapeHtml(summary.totalBlocks || 0) + '</td>' +
              '<td>' + escapeHtml(summary.inspected || 0) + '</td>' +
              '<td>' + escapeHtml(formatPercent(summary.iip || 0)) + '</td>' +
              '<td>' + escapeHtml(formatBreteau(summary.breteau || 0)) + '</td>' +
              '<td><button class="btn btn-soft btn-mini" type="button" data-liraa-cycle-download="' + escapeHtml(item.id || '') + '">Baixar</button></td>' +
            '</tr>';
          }).join('') +
        '</tbody></table></div>' +
      '</section>';
  }

  function renderOperationTerritoryNotice(plan) {
    var total = plan && plan.totalBlocks ? plan.totalBlocks : 0;
    return '' +
      '<section class="card panel-liraa-controls">' +
        '<div class="panel-liraa-controls-head">' +
          '<div><h2 class="section-title">Territorio do LIRAa</h2><p class="card-note">A selecao de microareas e quarteiroes agora fica em Operacao, junto com VD e P.E. Este painel permanece para conferencia, indicadores, mapa, resultado e historico dos ciclos LIRAa.</p></div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-soft" id="liraaCopyPlanBtn" type="button">Copiar plano atual</button>' +
            '<button class="btn btn-soft" id="liraaDownloadPlanBtn" type="button">Baixar plano atual</button>' +
            '<button class="btn btn-primary" id="liraaArchiveCycleBtn" type="button">Encerrar e arquivar ciclo</button>' +
            '<button class="btn btn-soft btn-danger-soft" id="liraaClearPlanBtn" type="button">Limpar plano atual</button>' +
          '</div>' +
        '</div>' +
        '<div class="empty-state">Para liberar quarteiroes aos agentes, abra Operacao, escolha o modo LIRAa, selecione os pares microarea/quarteirao e adicione a operacao. Quarteiroes no plano local atual: ' + escapeHtml(total) + '.</div>' +
      '</section>';
  }


  function render() {
    var node = $('panelLiraaContent');
    if (!node) {
      return;
    }

    var snapshot = buildSnapshot();
    var plan = getActivePlan(snapshot);
    var hasTerritoryBase = getTerritoryPolygons().filter(isUsefulPolygon).length > 0;
    var showHistory = state.activeTab === 'history';

    destroyMap();
    node.innerHTML = '' +
      renderSummary(snapshot, plan) +
      renderCycleTabs() +
      '<div id="liraaCurrentCyclePanel" ' + (showHistory ? 'hidden' : '') + '>' +
        renderOperationTerritoryNotice(plan) +
        '<div class="panel-liraa-main">' +
          '<section class="card panel-liraa-map-card">' +
            '<div class="panel-liraa-section-head"><h2 class="section-title">Mapa territorial do LIRAa</h2><span>Azul = marcado no plano, vermelho = foco recente</span></div>' +
            '<div id="panelLiraaMap" class="panel-liraa-map"></div>' +
            '<div class="panel-liraa-map-legend"><span><i class="sampled"></i>Marcado no LIRAa</span><span><i class="focus"></i>Foco/positivo</span><span><i class="base"></i>Territorio</span></div>' +
            (!hasTerritoryBase ? '<div class="empty-state" style="margin-top:10px">Base territorial nao carregada ou sem quarteiroes elegiveis para o LIRAa.</div>' : '') +
          '</section>' +
          '<section class="card">' +
            '<h2 class="section-title">Quarteiroes marcados</h2>' + renderPlanTable(plan) +
          '</section>' +
        '</div>' +
        '<div class="panel-liraa-columns">' +
          '<section class="card"><h2 class="section-title">Depositos predominantes</h2>' + renderDepositTable(snapshot) + '</section>' +
          '<section class="card"><h2 class="section-title">Estratos / microareas prioritarias</h2>' + renderAreaList(snapshot) + '</section>' +
        '</div>' +
        '<section class="card panel-liraa-note"><strong>Metodo aplicado</strong><p>O LIRAa continua sendo um levantamento por amostragem. A lista operacional de quarteiroes para os agentes e publicada em Operacao; aqui ficam a conferencia do ciclo, indicadores, resultado e historico.</p></section>' +
      '</div>' +
      '<div id="liraaCycleHistoryPanel" ' + (!showHistory ? 'hidden' : '') + '>' +
        renderCycleHistory() +
      '</div>';

    bindControls();
    if (!showHistory) {
      setTimeout(function () {
        renderMap(snapshot, plan);
      }, 80);
    }
  }

  function bindControls() {
    var saveButton = $('liraaSavePlanBtn');
    var publishButton = $('liraaPublishPlanBtn');
    var copyButton = $('liraaCopyPlanBtn');
    var downloadButton = $('liraaDownloadPlanBtn');
    var markAllButton = $('liraaMarkAllBtn');
    var clearAllButton = $('liraaClearAllBtn');
    var archiveButton = $('liraaArchiveCycleBtn');
    var clearPlanButton = $('liraaClearPlanBtn');

    function renderPreservingLiraaScroll() {
      var scrollY = root.pageYOffset || (documentRef.documentElement && documentRef.documentElement.scrollTop) || 0;
      var picker = documentRef.querySelector('.panel-liraa-picker-groups');
      var pickerScroll = picker ? picker.scrollTop : 0;
      render();
      setTimeout(function () {
        try {
          root.scrollTo(0, scrollY);
        } catch (error) {}
        var nextPicker = documentRef.querySelector('.panel-liraa-picker-groups');
        if (nextPicker) {
          nextPicker.scrollTop = pickerScroll;
        }
      }, 0);
    }

    function refreshPickerVisualState() {
      Array.prototype.slice.call(documentRef.querySelectorAll('[data-liraa-unit-checkbox]')).forEach(function (box) {
        var option = box.closest ? box.closest('.panel-liraa-quarter-option') : null;
        if (option) {
          option.classList.toggle('is-selected', !!box.checked);
        }
      });

      Array.prototype.slice.call(documentRef.querySelectorAll('.panel-liraa-picker-group')).forEach(function (groupNode) {
        var boxes = Array.prototype.slice.call(groupNode.querySelectorAll('[data-liraa-unit-checkbox]'));
        var counter = groupNode.querySelector('summary > span');
        var checkedCount = boxes.filter(function (box) { return !!box.checked; }).length;
        if (counter) {
          counter.textContent = checkedCount + '/' + boxes.length + ' marcado(s)';
        }
      });
    }

    function refreshLiraaMapOnly() {
      var snapshot = buildSnapshot();
      var plan = saveManualSelection(false);
      refreshPickerVisualState();
      try {
        renderMap(snapshot, plan);
      } catch (error) {}
    }

    function setBoxes(selector, checked) {
      Array.prototype.slice.call(documentRef.querySelectorAll(selector)).forEach(function (box) {
        box.checked = checked;
      });
      refreshLiraaMapOnly();
    }

    if (saveButton && saveButton.getAttribute('data-bound') !== '1') {
      saveButton.setAttribute('data-bound', '1');
      saveButton.addEventListener('click', function () {
        saveManualSelection(true);
        renderPreservingLiraaScroll();
      });
    }
    if (copyButton && copyButton.getAttribute('data-bound') !== '1') {
      copyButton.setAttribute('data-bound', '1');
      copyButton.addEventListener('click', copyCurrentPlan);
    }
    if (publishButton && publishButton.getAttribute('data-bound') !== '1') {
      publishButton.setAttribute('data-bound', '1');
      publishButton.addEventListener('click', publishCurrentPlan);
    }
    if (downloadButton && downloadButton.getAttribute('data-bound') !== '1') {
      downloadButton.setAttribute('data-bound', '1');
      downloadButton.addEventListener('click', downloadCurrentPlan);
    }
    if (archiveButton && archiveButton.getAttribute('data-bound') !== '1') {
      archiveButton.setAttribute('data-bound', '1');
      archiveButton.addEventListener('click', archiveCurrentCycle);
    }
    if (clearPlanButton && clearPlanButton.getAttribute('data-bound') !== '1') {
      clearPlanButton.setAttribute('data-bound', '1');
      clearPlanButton.addEventListener('click', clearCurrentPlan);
    }
    if (markAllButton && markAllButton.getAttribute('data-bound') !== '1') {
      markAllButton.setAttribute('data-bound', '1');
      markAllButton.addEventListener('click', function () {
        setBoxes('[data-liraa-unit-checkbox]', true);
      });
    }
    if (clearAllButton && clearAllButton.getAttribute('data-bound') !== '1') {
      clearAllButton.setAttribute('data-bound', '1');
      clearAllButton.addEventListener('click', function () {
        setBoxes('[data-liraa-unit-checkbox]', false);
      });
    }

    Array.prototype.slice.call(documentRef.querySelectorAll('[data-liraa-unit-checkbox]')).forEach(function (box) {
      if (box.getAttribute('data-bound') === '1') {
        return;
      }
      box.setAttribute('data-bound', '1');
      box.addEventListener('change', function () {
        refreshLiraaMapOnly();
      });
    });

    Array.prototype.slice.call(documentRef.querySelectorAll('[data-liraa-group-action]')).forEach(function (button) {
      if (button.getAttribute('data-bound') === '1') {
        return;
      }
      button.setAttribute('data-bound', '1');
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var group = button.getAttribute('data-liraa-group');
        var action = button.getAttribute('data-liraa-group-action');
        var selector = '[data-liraa-unit-checkbox][data-liraa-group-key="' + String(group || '').replace(/"/g, '\"') + '"]';
        setBoxes(selector, action === 'mark');
      });
    });

    Array.prototype.slice.call(documentRef.querySelectorAll('[data-liraa-panel-tab]')).forEach(function (button) {
      if (button.getAttribute('data-bound') === '1') {
        return;
      }
      button.setAttribute('data-bound', '1');
      button.addEventListener('click', function () {
        state.activeTab = button.getAttribute('data-liraa-panel-tab') === 'history' ? 'history' : 'current';
        render();
      });
    });

    Array.prototype.slice.call(documentRef.querySelectorAll('[data-liraa-cycle-download]')).forEach(function (button) {
      if (button.getAttribute('data-bound') === '1') {
        return;
      }
      button.setAttribute('data-bound', '1');
      button.addEventListener('click', function () {
        downloadArchivedCycle(button.getAttribute('data-liraa-cycle-download') || '');
      });
    });
  }

  function getCurrentPlanForSharing() {
    var plan = saveManualSelection(false);
    if (!plan.selected.length) {
      notify('Marque pelo menos um quarteirao antes de copiar, baixar ou liberar o plano LIRAa.', 'warn');
    }
    return plan;
  }

  function copyCurrentPlan() {
    var plan = getCurrentPlanForSharing();
    if (!plan.selected.length) {
      return;
    }

    var content = JSON.stringify(plan, null, 2);

    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      root.navigator.clipboard.writeText(content).then(function () {
        notify('Plano LIRAa copiado. Cole no tablet do agente na aba LIRAa.', 'ok');
      }).catch(function () {
        root.prompt('Copie o plano LIRAa abaixo:', content);
      });
      return;
    }

    root.prompt('Copie o plano LIRAa abaixo:', content);
  }

  function publishCurrentPlan() {
    notify('A liberacao de quarteiroes para agentes agora e feita em Operacao. Use este painel apenas para conferencia, indicadores e historico do LIRAa.', 'warn');
    return;
    var plan = getCurrentPlanForSharing();

    if (!plan.selected.length) {
      return;
    }

    if (!isApiConfigured()) {
      notify('API_URL nao configurada. Nao foi possivel liberar o plano automaticamente.', 'warn');
      return;
    }

    requestPublishCredentials().then(function (credentials) {
      notify('Liberando plano LIRAa para os agentes...', 'accent');
      return postJsonToApi({
        action: 'liraa_plan_publish',
        plan: plan,
        admin_matricula: credentials.matricula,
        admin_hash: credentials.hash
      });
    }).then(function (payload) {
      if (!payload || payload.ok === false) {
        throw new Error((payload && payload.error) || 'A API recusou a liberacao do plano.');
      }
      if (payload.plan) {
        savePlan(payload.plan);
      }
      notify('Plano LIRAa liberado. Os tablets vao baixar ao abrir a aba LIRAa.', 'ok');
      renderPreservingLiraaScroll();
    }).catch(function (error) {
      notify('Nao foi possivel liberar o plano: ' + (error && error.message ? error.message : error), 'warn');
    });
  }

  function downloadCurrentPlan() {
    var plan = getCurrentPlanForSharing();
    if (!plan.selected.length) {
      return;
    }

    var date = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      'plano-liraa-' + date + '.json',
      JSON.stringify(plan, null, 2),
      'application/json;charset=utf-8'
    );
    notify('Arquivo do plano LIRAa gerado.', 'ok');
  }

  function ensureMap() {
    var mapNode = $('panelLiraaMap');
    if (!mapNode || !root.L) {
      if (mapNode) {
        mapNode.innerHTML = '<div class="empty-state">Leaflet nao esta disponivel para renderizar o mapa.</div>';
      }
      return null;
    }

    if (state.map && state.map._container !== mapNode) {
      destroyMap();
    }

    if (!state.map) {
      if (mapNode._leaflet_id) {
        mapNode._leaflet_id = null;
      }
      state.map = root.L.map(mapNode, {
        scrollWheelZoom: false,
        zoomControl: true
      });
      root.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(state.map);
    }

    [80, 180, 420].forEach(function (delay) {
      setTimeout(function () {
        if (state.map) {
          try {
            state.map.invalidateSize();
          } catch (error) {}
        }
      }, delay);
    });

    return state.map;
  }

  function destroyMap() {
    clearMapLayers();

    if (state.map) {
      try {
        state.map.remove();
      } catch (error) {}
    }

    state.map = null;
    state.mapLayers = [];
  }

  function clearMapLayers() {
    if (!state.map) {
      state.mapLayers = [];
      return;
    }
    state.mapLayers.forEach(function (layer) {
      try {
        state.map.removeLayer(layer);
      } catch (error) {}
    });
    state.mapLayers = [];
  }

  function getUnitMetricMap(snapshot) {
    var map = {};
    (snapshot.units || []).forEach(function (unit) {
      map[unit.key] = unit;
    });
    return map;
  }

  function renderMap(snapshot, plan) {
    var map = ensureMap();
    if (!map) {
      return;
    }

    clearMapLayers();

    var bounds = [];
    var unitMetrics = getUnitMetricMap(snapshot);
    var selectedMap = plan.selectedMap || {};
    var polygons = getTerritoryPolygons().filter(isUsefulPolygon);

    if (!polygons.length) {
      var mapNode = $('panelLiraaMap');
      if (mapNode) {
        mapNode.innerHTML = '<div class="empty-state">Base territorial nao carregada ou sem quarteiroes elegiveis para o LIRAa.</div>';
      }
      map.setView([-21.93, -42.61], 13);
      return;
    }

    polygons.forEach(function (feature) {
      var territory = getFeatureTerritory(feature);
      var quarter = getFeatureQuarter(feature) || 'Distrito';
      var key = makeUnitKey(territory, quarter);
      var metric = unitMetrics[key] || {};
      var sampled = !!selectedMap[key];
      var hasFocus = (metric.positiveVisits || 0) > 0 || (metric.positiveDeposits || 0) > 0;
      var color = sampled ? '#2563eb' : (hasFocus ? '#dc2626' : '#64748b');
      var fillColor = sampled ? '#3b82f6' : (hasFocus ? '#ef4444' : '#94a3b8');
      var opacity = sampled || hasFocus ? 0.88 : 0.35;

      var layer = root.L.polygon(feature.coordinates, {
        color: color,
        weight: sampled ? 3 : 1.4,
        opacity: opacity,
        fillColor: fillColor,
        fillOpacity: sampled ? 0.28 : (hasFocus ? 0.22 : 0.08)
      }).bindPopup(
        '<strong>' + escapeHtml(territory) + '</strong><br>' +
        'Quarteirao: ' + escapeHtml(quarter) + '<br>' +
        'Marcado no plano: ' + (sampled ? 'Sim' : 'Nao') + '<br>' +
        'Imoveis cadastrados: ' + escapeHtml(metric.properties || 0) + '<br>' +
        'Focos/positivos: ' + escapeHtml(metric.positiveVisits || 0)
      );

      layer.addTo(map);
      state.mapLayers.push(layer);
      feature.coordinates.forEach(function (point) {
        bounds.push(point);
      });
    });

    if (bounds.length) {
      try {
        map.fitBounds(root.L.latLngBounds(bounds), { padding: [18, 18], maxZoom: 14 });
      } catch (error) {
        map.setView([-21.93, -42.61], 13);
      }
    } else {
      map.setView([-21.93, -42.61], 13);
    }

    [0, 180, 420].forEach(function (delay) {
      setTimeout(function () {
        try {
          map.invalidateSize();
        } catch (error) {}
      }, delay);
    });
  }

  function injectStyles() {
    if ($('panelLiraaStyles')) {
      return;
    }

    var style = documentRef.createElement('style');
    style.id = 'panelLiraaStyles';
    style.textContent = [
      '.panel-liraa-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px;border-radius:24px;background:#ecfdf5;border:1px solid #bbf7d0;color:#14532d;margin-bottom:16px}',
      '.panel-liraa-hero.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}.panel-liraa-hero.danger{background:#fef2f2;border-color:#fecaca;color:#991b1b}',
      '.panel-liraa-hero span,.panel-liraa-card span{display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;font-weight:900;opacity:.75}',
      '.panel-liraa-hero strong{display:block;font-size:1.6rem}.panel-liraa-hero>div:last-child{font-size:2.4rem;font-weight:950}',
      '.panel-liraa-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}',
      '.panel-liraa-card{padding:14px;border-radius:18px;background:#fff;border:1px solid #dbe7df}.panel-liraa-card strong{display:block;margin-top:4px;font-size:1.35rem}.panel-liraa-card small{display:block;margin-top:4px;color:#64748b}',
      '.panel-liraa-card.danger{background:#fff7f7;border-color:#fecaca;color:#991b1b}.panel-liraa-card.warn{background:#fffdf1;border-color:#fde68a;color:#92400e}.panel-liraa-card.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}.panel-liraa-card.accent{background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a}',
      '.panel-liraa-tabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}.panel-liraa-tabs .btn[aria-selected="true"]{box-shadow:0 8px 18px rgba(37,99,235,.18)}.panel-liraa-controls{margin-bottom:16px}.panel-liraa-controls-head,.panel-liraa-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.panel-liraa-form{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin-top:12px}.panel-liraa-form-compact{grid-template-columns:minmax(220px,420px)}.panel-liraa-form label{display:flex;flex-direction:column;gap:6px;font-weight:800;color:#284238}.panel-liraa-form input{border:1px solid #d9e6df;border-radius:12px;padding:10px;background:#fff}.btn-danger-soft{background:#fee2e2!important;color:#991b1b!important;border-color:#fecaca!important}',
      '.panel-liraa-picker{margin-bottom:14px}.panel-liraa-picker-groups{display:flex;flex-direction:column;gap:7px;margin-top:10px;max-height:460px;overflow:auto;padding-right:4px;scrollbar-width:thin}.panel-liraa-picker-group{border:1px solid #dbe7df;border-radius:12px;background:#f8fcfa}.panel-liraa-picker-group summary{display:grid;grid-template-columns:minmax(150px,1fr) auto auto;align-items:center;gap:8px;padding:7px 9px;cursor:pointer}.panel-liraa-picker-group summary span{font-size:.78rem;color:#64748b;font-weight:800}.panel-liraa-group-actions{display:inline-flex;gap:4px;flex-wrap:wrap}.btn-mini{padding:4px 7px!important;font-size:.69rem!important;border-radius:8px!important;line-height:1.1!important;min-height:0!important}.btn-liraa-picker-action{padding:5px 8px!important}.panel-liraa-quarter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:5px;padding:0 9px 9px}.panel-liraa-quarter-option{display:flex;align-items:flex-start;gap:6px;padding:5px 6px;border:1px solid #dbe7df;border-radius:9px;background:#fff;cursor:pointer;min-height:0}.panel-liraa-quarter-option.is-selected{border-color:#2563eb;background:#eff6ff;color:#1e3a8a}.panel-liraa-quarter-option input{margin-top:1px;width:14px;height:14px;flex:0 0 auto}.panel-liraa-quarter-option span{display:flex;flex-direction:column;gap:1px;min-width:0}.panel-liraa-quarter-option strong{font-size:.78rem;line-height:1.15}.panel-liraa-quarter-option small{font-size:.68rem;line-height:1.15;color:#64748b}.panel-liraa-main{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(360px,.75fr);gap:16px;margin-bottom:16px}.panel-liraa-map{min-height:520px;border-radius:22px;overflow:hidden;border:1px solid #dbe7df;background:#eef6f0}.panel-liraa-map-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;color:#475569;font-size:.86rem;font-weight:800}.panel-liraa-map-legend span{display:inline-flex;align-items:center;gap:6px}.panel-liraa-map-legend i{width:14px;height:14px;border-radius:999px;display:inline-block}.panel-liraa-map-legend .sampled{background:#2563eb}.panel-liraa-map-legend .focus{background:#dc2626}.panel-liraa-map-legend .base{background:#94a3b8}',
      '.panel-liraa-columns{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr);gap:16px}.panel-liraa-table-wrap{overflow:auto}.panel-liraa-table-wrap table{width:100%;border-collapse:collapse}.panel-liraa-table-wrap th,.panel-liraa-table-wrap td{padding:10px;border-bottom:1px solid #e5eee8;text-align:left}',
      '.panel-liraa-area{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid #e5eee8;border-radius:14px;background:#fff;margin-bottom:8px}.panel-liraa-area span,.panel-liraa-note p{color:#5f7169}.panel-liraa-note{margin-top:16px}',
      '@media(max-width:1100px){.panel-liraa-main,.panel-liraa-columns{grid-template-columns:1fr}.panel-liraa-map{min-height:420px}}',
      '@media(max-width:760px){.panel-liraa-grid,.panel-liraa-form,.panel-liraa-picker-group summary{grid-template-columns:1fr}.panel-liraa-hero{align-items:flex-start;flex-direction:column}.panel-liraa-hero>div:last-child{font-size:1.9rem}.panel-liraa-picker-groups{max-height:none}.panel-liraa-map{min-height:360px}}'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function showLiraaPanel() {
    documentRef.querySelectorAll('[data-panel-view-content]').forEach(function (panel) {
      var active = panel.getAttribute('data-panel-view-content') === 'liraa';
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });

    documentRef.querySelectorAll('[data-panel-view]').forEach(function (button) {
      var active = button.getAttribute('data-panel-view') === 'liraa';
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    render();
  }

  function installPanel() {
    injectStyles();

    var nav = documentRef.querySelector('.app-sidebar__nav');
    var visitsButton = documentRef.querySelector('[data-panel-view="visits"]');
    if (nav && !$('sidebarLiraaBtn')) {
      var button = documentRef.createElement('button');
      button.id = 'sidebarLiraaBtn';
      button.className = 'sidebar-tab';
      button.type = 'button';
      button.setAttribute('data-panel-view', 'liraa');
      button.setAttribute('aria-selected', 'false');
      button.innerHTML = '<span class="sidebar-tab__icon">L</span><span>LIRAa</span>';
      if (visitsButton && visitsButton.nextSibling) {
        nav.insertBefore(button, visitsButton.nextSibling);
      } else {
        nav.appendChild(button);
      }
      button.addEventListener('click', showLiraaPanel);
    }

    var workspace = documentRef.querySelector('.panel-workspace');
    if (workspace && !$('panelLiraaView')) {
      var view = documentRef.createElement('div');
      view.id = 'panelLiraaView';
      view.className = 'panel-view panel-view-split';
      view.setAttribute('data-panel-view-content', 'liraa');
      view.hidden = true;
      view.innerHTML = [
        '<div class="panel-view-fixed">',
        '<section class="card">',
        '<div class="panel-screen-head">',
        '<div class="screen-head-copy"><strong>LIRAa</strong><span>Indicadores do LIRAa, mapa da amostra, Indice Predial, Breteau e depositos predominantes. A selecao de quarteiroes fica em Operacao.</span></div>',
        '<div class="screen-badge">L</div>',
        '</div>',
        '<div id="panelLiraaContent"></div>',
        '</section>',
        '</div>'
      ].join('');
      workspace.appendChild(view);
    }

    render();
  }

  root.ACEPainelLiraa = {
    version: MODULE_VERSION,
    render: render,
    snapshot: buildSnapshot,
    buildSamplingPlan: function () {
      var snapshot = buildSnapshot();
      var plan = getActivePlan(snapshot);
      return buildManualPlan(snapshot, getPlanInputs(), plan.selectedMap || {});
    },
    buildManualPlan: function () {
      var snapshot = buildSnapshot();
      var plan = getActivePlan(snapshot);
      return buildManualPlan(snapshot, getPlanInputs(), plan.selectedMap || {});
    },
    getPlan: function () {
      return state.lastPlan || readJson(PLAN_STORAGE_KEY, null);
    },
    getCycleHistory: readCycleHistory,
    archiveCurrentCycle: archiveCurrentCycle,
    clearCurrentPlan: clearCurrentPlan
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', installPanel);
  } else {
    installPanel();
  }

  root.addEventListener('load', function () {
    setTimeout(installPanel, 800);
    setTimeout(render, 2500);
  });
}());
