(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var MODULE_VERSION = '20260517-tablet-v55-final';
  var state = {
    agents: [],
    operations: [],
    assignments: [],
    summary: null,
    date: todayLocal(),
    agentFilter: '',
    selected: {},
    selectedUnits: {},
    map: null,
    mapLayers: [],
    workdaySettings: {
      VD: { start: '08:00', closeAfter: '15:00', allowEarlyWithJustification: true },
      PE: { start: '08:00', closeAfter: '13:00', allowEarlyWithJustification: true },
      LIRAA: { start: '08:00', closeAfter: '16:00', allowEarlyWithJustification: true }
    }
  };

  function $(id) { return documentRef.getElementById(id); }
  function text(v) { return String(v == null ? '' : v).trim(); }
  function escapeHtml(v) {
    return text(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function todayLocal() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function initials(name, fallback) {
    var base = text(name || fallback || 'AG');
    var parts = base.split(/\s+/).filter(Boolean);
    if (!parts.length) { return 'AG'; }
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[1].charAt(0) : parts[0].charAt(1) || '')).toUpperCase();
  }
  function normalizeMode(value) {
    var mode = text(value).toUpperCase();
    if (mode === 'PE' || mode === 'P.E.' || mode === 'PONTO_ESTRATEGICO') { return 'PE'; }
    if (mode === 'LIRAA' || mode === 'LIRA') { return 'LIRAA'; }
    return 'VD';
  }
  function modeLabel(value) {
    var mode = normalizeMode(value);
    if (mode === 'PE') { return 'P.E. - Ponto estratégico'; }
    if (mode === 'LIRAA') { return 'LIRAa'; }
    return 'VD - Visita domiciliar';
  }

  function normalizeTime(value, fallback) {
    var raw = text(value || '').replace('.', ':');
    var match = raw.match(/^(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) { return fallback || ''; }
    var hour = Math.max(0, Math.min(23, Number(match[1] || 0)));
    var minute = Math.max(0, Math.min(59, Number(match[2] || 0)));
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }
  function normalizeBool(value, fallback) {
    if (value === true || value === false) { return value; }
    var raw = text(value).toLowerCase();
    if (['sim', 's', 'true', '1', 'yes'].indexOf(raw) > -1) { return true; }
    if (['nao', 'não', 'n', 'false', '0', 'no'].indexOf(raw) > -1) { return false; }
    return fallback !== false;
  }
  function normalizeWorkdaySettings(input) {
    var src = input && typeof input === 'object' ? input : {};
    var defaults = state.workdaySettings || {};
    var out = {};
    ['VD', 'PE', 'LIRAA'].forEach(function (mode) {
      var def = defaults[mode] || { start: '08:00', closeAfter: mode === 'LIRAA' ? '16:00' : (mode === 'PE' ? '13:00' : '15:00'), allowEarlyWithJustification: true };
      var raw = src[mode] || src[mode.toLowerCase()] || {};
      out[mode] = {
        start: normalizeTime(raw.start || raw.inicio || raw.start_at || raw.inicio_previsto, def.start),
        closeAfter: normalizeTime(raw.closeAfter || raw.close_after || raw.encerrarApos || raw.encerrar_apos || raw.finish_after, def.closeAfter),
        allowEarlyWithJustification: normalizeBool(raw.allowEarlyWithJustification || raw.allow_early_with_justification || raw.permitir_antecipado_com_justificativa, def.allowEarlyWithJustification)
      };
    });
    return out;
  }
  function fillWorkdayFields() {
    var settings = normalizeWorkdaySettings(state.workdaySettings);
    [['VD','Vd'], ['PE','Pe'], ['LIRAA','Liraa']].forEach(function (pair) {
      var mode = pair[0];
      var suffix = pair[1];
      var start = $('workday' + suffix + 'Start');
      var close = $('workday' + suffix + 'Close');
      var early = $('workday' + suffix + 'Early');
      if (start) { start.value = settings[mode].start; }
      if (close) { close.value = settings[mode].closeAfter; }
      if (early) { early.checked = settings[mode].allowEarlyWithJustification !== false; }
    });
  }
  function collectWorkdayFields() {
    var out = {};
    [['VD','Vd'], ['PE','Pe'], ['LIRAA','Liraa']].forEach(function (pair) {
      var mode = pair[0];
      var suffix = pair[1];
      out[mode] = {
        start: normalizeTime($('workday' + suffix + 'Start') ? $('workday' + suffix + 'Start').value : '', state.workdaySettings[mode].start),
        closeAfter: normalizeTime($('workday' + suffix + 'Close') ? $('workday' + suffix + 'Close').value : '', state.workdaySettings[mode].closeAfter),
        allowEarlyWithJustification: !!($('workday' + suffix + 'Early') && $('workday' + suffix + 'Early').checked)
      };
    });
    return out;
  }

  function readJson(key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getBundle() {
    return root.ACE_PANEL_CLOUD_BUNDLE ||
      (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getBundle === 'function'
        ? root.ACEPanelCloudSync.getBundle()
        : null) ||
      {};
  }

  function readProperties() {
    var bundle = getBundle();
    if (Array.isArray(bundle.properties)) {
      return bundle.properties;
    }
    return readJson('dengue_db_properties_v1', []);
  }

  function readVisits() {
    var bundle = getBundle();
    if (Array.isArray(bundle.visits)) {
      return bundle.visits;
    }
    return readJson('dengue_db_visits_v1', []);
  }

  function visitHasFocus(row) {
    var fields = [
      row && row.foco,
      row && row.deposit_with_focus,
      row && row.deposito_com_foco,
      row && row.deposit_focus_count,
      row && row.focus_count,
      row && row.deposito_positivo,
      row && row.positivo
    ];
    return fields.some(function (value) {
      var clean = text(value).toLowerCase();
      if (!clean) { return false; }
      if (clean === '0' || clean === 'nao' || clean === 'não' || clean === 'false' || clean === 'sem foco') { return false; }
      return clean === 'sim' || clean === 'true' || clean === 'positivo' || clean === 'com foco' || Number(clean) > 0;
    });
  }

  function normalizeKey(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['`´]/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripAreaPrefix(value) {
    return text(value).replace(/^[A-Z0-9]{1,8}\s*-\s*/i, '').trim();
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

  function normalizeQuarter(value) {
    return text(value)
      .replace(/^q\s*[-/]?\s*/i, '')
      .replace(/^0+(\d)/, '$1')
      .trim();
  }

  function makeTerritoryUnitKey(microarea, quarteirao) {
    return normalizeTerritoryKey(microarea) + '|' + normalizeQuarter(quarteirao || 'Distrito');
  }

  function addTerritoryUnit(groups, microarea, quarteirao, count, focusCount) {
    microarea = text(microarea);
    quarteirao = normalizeQuarter(quarteirao);
    if (!microarea || !quarteirao || normalizeKey(quarteirao) === 'sem quarteirao') {
      return;
    }
    var groupKey = normalizeTerritoryKey(microarea);
    var unitKey = makeTerritoryUnitKey(microarea, quarteirao);
    if (!groupKey) {
      return;
    }
    if (!groups[groupKey]) {
      groups[groupKey] = { key: groupKey, name: microarea, units: [], map: {}, properties: 0, positiveVisits: 0 };
    }
    if (!groups[groupKey].map[unitKey]) {
      groups[groupKey].map[unitKey] = {
        key: unitKey,
        territory: microarea,
        quarter: quarteirao,
        properties: 0,
        positiveVisits: 0
      };
      groups[groupKey].units.push(groups[groupKey].map[unitKey]);
    }
    groups[groupKey].map[unitKey].properties += Number(count || 0) || 0;
    groups[groupKey].map[unitKey].positiveVisits += Number(focusCount || 0) || 0;
    groups[groupKey].properties += Number(count || 0) || 0;
    groups[groupKey].positiveVisits += Number(focusCount || 0) || 0;
  }

  function getOperationTerritoryGroups() {
    var groups = {};
    var source = root.ACE_TERRITORY_SOURCE || {};
    var catalog = source.meta && source.meta.catalog && source.meta.catalog.byTerritory ? source.meta.catalog.byTerritory : {};
    Object.keys(catalog).forEach(function (microarea) {
      (catalog[microarea] || []).forEach(function (quarteirao) {
        addTerritoryUnit(groups, microarea, quarteirao, 0);
      });
    });

    (Array.isArray(source.polygons) ? source.polygons : []).forEach(function (feature) {
      var microarea = text(feature && (feature.folder || feature.originalFolder || feature.territory || ''));
      var quarteirao = normalizeQuarter(feature && (feature.name || feature.originalName || ''));
      var type = normalizeKey(feature && feature.territoryType || '');
      if (type === 'distrito') {
        return;
      }
      addTerritoryUnit(groups, microarea, quarteirao, 0);
    });

    readProperties().forEach(function (property) {
      addTerritoryUnit(groups, property.microarea || property.bairro || property.gps_territory || '', property.quarteirao || property.gps_quarteirao || '', 1);
    });

    readVisits().forEach(function (visit) {
      addTerritoryUnit(
        groups,
        visit.microarea || visit.bairro || visit.gps_territory || '',
        visit.quarteirao || visit.gps_quarteirao || '',
        0,
        visitHasFocus(visit) ? 1 : 0
      );
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
    }).filter(function (group) {
      return group.units.length > 0;
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }

  function getOperationTerritoryPolygons() {
    var source = root.ACE_TERRITORY_SOURCE || {};
    return Array.isArray(source.polygons) ? source.polygons : [];
  }

  function getOperationFeatureTerritory(feature) {
    return text(feature && (feature.folder || feature.originalFolder || feature.territory || ''));
  }

  function getOperationFeatureQuarter(feature) {
    return normalizeQuarter(feature && (feature.name || feature.originalName || feature.quarteirao || feature.quarter || ''));
  }

  function isUsefulOperationPolygon(feature) {
    if (!feature || !Array.isArray(feature.coordinates) || !feature.coordinates.length) {
      return false;
    }
    if (normalizeKey(feature.territoryType || '') === 'distrito') {
      return false;
    }
    return !!(getOperationFeatureTerritory(feature) && getOperationFeatureQuarter(feature));
  }

  function clearOperationMapLayers() {
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

  function ensureOperationMap() {
    var node = $('operationTerritoryMap');
    if (!node || !root.L) {
      return null;
    }
    if (state.map) {
      return state.map;
    }
    try {
      state.map = root.L.map(node, {
        preferCanvas: true,
        zoomControl: true,
        attributionControl: true
      });
      root.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(state.map);
      state.map.setView([-21.93, -42.61], 13);
    } catch (error) {
      state.map = null;
      node.innerHTML = '<div class="operation-map-empty">Mapa indisponivel neste navegador.</div>';
      return null;
    }
    [80, 220, 520].forEach(function (delay) {
      setTimeout(function () {
        try {
          if (state.map) {
            state.map.invalidateSize();
          }
        } catch (error) {}
      }, delay);
    });
    return state.map;
  }

  function getOperationUnitMetrics() {
    var metrics = {};
    getOperationTerritoryGroups().forEach(function (group) {
      group.units.forEach(function (unit) {
        metrics[unit.key] = unit;
      });
    });
    return metrics;
  }

  function estimateOperationProperties(unit, group) {
    var average = group && group.units && group.units.length
      ? Math.round((group.properties || 0) / Math.max(1, group.units.length))
      : 0;
    return Number(unit.properties || 0) || Math.max(5, average || 10);
  }

  function getSelectedOperationRows() {
    var selectedMap = getSelectedOperationUnitMap();
    var rows = [];
    getOperationTerritoryGroups().forEach(function (group) {
      group.units.forEach(function (unit) {
        if (!selectedMap[unit.key]) {
          return;
        }
        var estimated = estimateOperationProperties(unit, group);
        rows.push({
          order: rows.length + 1,
          microarea: unit.territory,
          quarteirao: unit.quarter,
          properties: unit.properties || 0,
          estimatedProperties: estimated,
          propertiesToInspect: estimated ? Math.max(1, Math.ceil(estimated * 0.2)) : 0,
          positiveVisits: unit.positiveVisits || 0
        });
      });
    });
    return rows;
  }

  function renderOperationSelectedUnitsTable() {
    var host = $('operationSelectedBlocksHost');
    if (!host) {
      return;
    }
    var rows = getSelectedOperationRows();
    if (!rows.length) {
      host.innerHTML = '<div class="operation-empty-state">Nenhum quarteirao marcado. Marque o territorio da operacao acima para preencher esta tabela.</div>';
      return;
    }
    host.innerHTML = '<div class="operation-table-wrap"><table class="operation-report-table"><thead><tr><th>#</th><th>Estrato / microarea</th><th>Quarteirao</th><th>Imoveis</th><th>A vistoriar</th><th>Foco recente</th></tr></thead><tbody>' +
      rows.map(function (row) {
        var propertiesText = row.properties ? String(row.properties) : ('~' + row.estimatedProperties);
        return '<tr>' +
          '<td>' + escapeHtml(row.order) + '</td>' +
          '<td>' + escapeHtml(row.microarea) + '</td>' +
          '<td><strong>Q ' + escapeHtml(row.quarteirao) + '</strong></td>' +
          '<td>' + escapeHtml(propertiesText) + '</td>' +
          '<td><strong>' + escapeHtml(row.propertiesToInspect) + '</strong></td>' +
          '<td>' + escapeHtml(row.positiveVisits || 0) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div><div class="operation-publish-callout"><strong>Conferencia pronta?</strong><span>Use o botao abaixo para liberar este recorte para o tablet do agente. O agente recebe o plano ao logar/sincronizar com internet.</span><button class="btn btn-primary" id="operationPublishInlineBtn" type="button">Liberar para tablet do agente</button></div>';
  }

  function getOperationTitle(op, mode) {
    return text(op && (op.titulo || op.title || op.ciclo || op.cycle || '')) || modeLabel(mode || (op && (op.mode || op.tipo_operacao)));
  }

  function getAssignedAgentNamesForOperation(operationId) {
    var id = text(operationId);
    return state.assignments.filter(function (assignment) {
      return text(assignment.operation_id) === id;
    }).map(function (assignment) {
      return text(assignment.agente_nome || assignment.nome || assignment.agente_matricula || assignment.matricula);
    }).filter(Boolean);
  }

  function splitTerritoryList(value) {
    return text(value).split('|').map(text).filter(Boolean);
  }

  function fallbackOperationUnits(op) {
    var areas = splitTerritoryList(op && op.operation_microareas);
    var quarters = splitTerritoryList(op && op.operation_quarteiroes).map(normalizeQuarter).filter(Boolean);
    if (!areas.length || !quarters.length) {
      return [];
    }
    if (areas.length === 1) {
      return quarters.map(function (quarter) {
        return { microarea: areas[0], quarteirao: quarter };
      });
    }
    if (areas.length === quarters.length) {
      return areas.map(function (area, index) {
        return { microarea: area, quarteirao: quarters[index] };
      });
    }
    return [];
  }

  function getDayOperationUnitMap() {
    var map = {};
    state.operations.forEach(function (op) {
      var mode = normalizeMode(op && (op.mode || op.tipo_operacao));
      var opId = text(op && op.operation_id);
      var units = parseOperationUnits(op && (op.operation_units || op.operationUnits || ''));
      if (!units.length) {
        units = fallbackOperationUnits(op);
      }
      var agents = getAssignedAgentNamesForOperation(opId);
      units.forEach(function (unit) {
        var microarea = text(unit.microarea || unit.territory);
        var quarter = normalizeQuarter(unit.quarteirao || unit.quarter);
        var key = makeTerritoryUnitKey(microarea, quarter);
        if (!key) {
          return;
        }
        if (!map[key]) {
          map[key] = {
            key: key,
            microarea: microarea,
            quarteirao: quarter,
            operations: [],
            agents: {},
            modes: {}
          };
        }
        map[key].operations.push({
          id: opId,
          mode: mode,
          title: getOperationTitle(op, mode),
          agents: agents
        });
        map[key].modes[mode] = true;
        agents.forEach(function (agent) {
          map[key].agents[agent] = true;
        });
      });
    });
    return map;
  }

  function operationMapDayLabel(entry) {
    if (!entry || !entry.operations || !entry.operations.length) {
      return '';
    }
    return entry.operations.slice(0, 6).map(function (op) {
      var agents = op.agents && op.agents.length ? op.agents.join(', ') : 'sem agente';
      return escapeHtml(op.mode + ' - ' + agents);
    }).join('<br>');
  }

  function renderOperationMap() {
    var node = $('operationTerritoryMap');
    if (!node) {
      return;
    }
    if (!root.L) {
      node.innerHTML = '<div class="operation-map-empty">Leaflet nao carregou. Confira a conexao e recarregue o painel.</div>';
      return;
    }
    var map = ensureOperationMap();
    if (!map) {
      return;
    }
    clearOperationMapLayers();
    var polygons = getOperationTerritoryPolygons().filter(isUsefulOperationPolygon);
    var draftSelectedMap = getSelectedOperationUnitMap();
    var dayOperationMap = getDayOperationUnitMap();
    var metrics = getOperationUnitMetrics();
    var bounds = [];
    if (!polygons.length) {
      node.innerHTML = '<div class="operation-map-empty">Base territorial nao carregada ou sem quarteiroes.</div>';
      return;
    }
    polygons.forEach(function (feature) {
      var microarea = getOperationFeatureTerritory(feature);
      var quarter = getOperationFeatureQuarter(feature);
      var key = makeTerritoryUnitKey(microarea, quarter);
      var metric = metrics[key] || {};
      var dayEntry = dayOperationMap[key];
      var selected = !!(dayEntry || draftSelectedMap[key]);
      var draftOnly = !dayEntry && !!draftSelectedMap[key];
      var hasFocus = Number(metric.positiveVisits || 0) > 0;
      var color = selected ? '#2563eb' : (hasFocus ? '#dc2626' : '#64748b');
      var fillColor = selected ? '#3b82f6' : (hasFocus ? '#ef4444' : '#94a3b8');
      var opacity = selected || hasFocus ? 0.88 : 0.36;
      try {
        var layer = root.L.polygon(feature.coordinates, {
          color: color,
          weight: selected ? (draftOnly ? 2.4 : 3.4) : 1.4,
          opacity: opacity,
          fillColor: fillColor,
          fillOpacity: selected ? 0.28 : (hasFocus ? 0.22 : 0.08)
        }).bindPopup(
          '<strong>' + escapeHtml(microarea) + '</strong><br>' +
          'Quarteirao: Q ' + escapeHtml(quarter) + '<br>' +
          'Marcado no dia: ' + (dayEntry ? 'Sim' : 'Nao') + '<br>' +
          (draftOnly ? 'Selecao atual: ainda nao publicada<br>' : '') +
          (dayEntry ? 'Operacoes neste quarteirao:<br>' + operationMapDayLabel(dayEntry) + '<br>' : '') +
          'Imoveis cadastrados: ' + escapeHtml(metric.properties || 0) + '<br>' +
          'Focos recentes: ' + escapeHtml(metric.positiveVisits || 0)
        );
        layer.addTo(map);
        state.mapLayers.push(layer);
        feature.coordinates.forEach(function (point) {
          bounds.push(point);
        });
      } catch (error) {}
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

  function getSelectedOperationUnitMap() {
    var boxes = Array.prototype.slice.call(documentRef.querySelectorAll('[data-operation-unit-checkbox]'));
    if (!boxes.length) {
      return Object.assign({}, state.selectedUnits || {});
    }
    var map = {};
    boxes.forEach(function (box) {
      if (box.checked) {
        map[box.getAttribute('data-operation-unit-checkbox')] = true;
      }
    });
    state.selectedUnits = map;
    return map;
  }

  function getSelectedOperationUnits() {
    var selectedMap = getSelectedOperationUnitMap();
    var selected = [];
    getOperationTerritoryGroups().forEach(function (group) {
      group.units.forEach(function (unit) {
        if (selectedMap[unit.key]) {
          selected.push({
            key: unit.key,
            microarea: unit.territory,
            quarteirao: unit.quarter
          });
        }
      });
    });
    return selected;
  }

  function uniqueList(values) {
    var seen = {};
    return values.map(text).filter(function (item) {
      var key = normalizeKey(item);
      if (!key || seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
  }

  function buildOperationTerritoryPayload() {
    var units = getSelectedOperationUnits();
    return {
      units: units,
      operation_units: units.length ? JSON.stringify(units) : '',
      operation_microareas: uniqueList(units.map(function (unit) { return unit.microarea; })).join('|'),
      operation_quarteiroes: uniqueList(units.map(function (unit) { return unit.quarteirao; })).join('|')
    };
  }

  function validateOperationTerritoryForPublish(territoryPayload) {
    var units = territoryPayload && Array.isArray(territoryPayload.units) ? territoryPayload.units : [];
    if (!units.length) {
      setStatus('Selecione ao menos um par microarea + quarteirao antes de publicar. A operacao precisa travar o territorio do agente.', 'warn');
      return false;
    }
    var invalid = units.some(function (unit) {
      return !text(unit && unit.microarea) || !text(unit && unit.quarteirao);
    });
    if (invalid) {
      setStatus('Ha quarteiroes selecionados sem microarea ou sem numero. Revise a selecao territorial antes de publicar.', 'warn');
      return false;
    }
    return true;
  }

  function operationUnitSummary(units) {
    if (!units || !units.length) {
      return 'Sem recorte territorial';
    }
    var byArea = {};
    units.forEach(function (unit) {
      var area = text(unit.microarea || unit.territory);
      if (!byArea[area]) {
        byArea[area] = [];
      }
      byArea[area].push(normalizeQuarter(unit.quarteirao || unit.quarter));
    });
    return Object.keys(byArea).sort(function (a, b) {
      return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
    }).map(function (area) {
      return area + ': Q ' + byArea[area].join(', Q ');
    }).join(' • ');
  }

  function renderOperationTerritorySelector() {
    var host = $('operationTerritorySelectorHost');
    if (!host) {
      return;
    }
    var groups = getOperationTerritoryGroups();
    var selectedMap = state.selectedUnits || {};
    if (!groups.length) {
      host.innerHTML = '<section class="operation-territory-picker"><h2 class="operation-territory-title">Selecao manual dos quarteiroes da operacao</h2><div class="operation-territory-empty">Nenhuma microarea/quarteirao encontrado na base territorial.</div></section>';
      return;
    }
    host.innerHTML = [
      '<section class="operation-territory-picker">',
      '<div class="operation-territory-head">',
      '<div><h2 class="operation-territory-title">Selecao manual dos quarteiroes da operacao</h2><p class="operation-territory-note">Escolha a microarea e marque os quarteiroes definidos pela coordenacao. Este recorte vale para VD, P.E. e LIRAa.</p></div>',
      '<div class="operation-territory-actions"><button class="btn btn-soft btn-mini" id="operationTerritoryMarkAllBtn" type="button">Marcar todos</button><button class="btn btn-soft btn-mini" id="operationTerritoryClearAllBtn" type="button">Limpar</button></div>',
      '</div>',
      '<input id="operationVdMicroareas" type="hidden"><input id="operationVdQuarteiroes" type="hidden"><input id="operationUnits" type="hidden">',
      '<div class="operation-territory-groups">',
      groups.map(function (group) {
        var marked = group.units.filter(function (unit) { return !!selectedMap[unit.key]; }).length;
        return '<details class="operation-territory-group" open>' +
          '<summary>' +
            '<strong>' + escapeHtml(group.name) + '</strong>' +
            '<span>' + escapeHtml(marked + '/' + group.units.length + ' marcado(s)') + '</span>' +
            '<div class="operation-territory-group-actions">' +
              '<button class="btn btn-mini" type="button" data-operation-group-action="mark" data-operation-group="' + escapeHtml(group.key) + '">Marcar grupo</button>' +
              '<button class="btn btn-mini" type="button" data-operation-group-action="clear" data-operation-group="' + escapeHtml(group.key) + '">Limpar</button>' +
            '</div>' +
          '</summary>' +
          '<div class="operation-quarter-grid">' +
          group.units.map(function (unit) {
            var checked = selectedMap[unit.key] ? ' checked' : '';
            var focusText = Number(unit.positiveVisits || 0) > 0 ? ' • foco recente: ' + Number(unit.positiveVisits || 0) : '';
            return '<label class="operation-quarter-option' + (checked ? ' is-selected' : '') + '">' +
              '<input type="checkbox" data-operation-unit-checkbox="' + escapeHtml(unit.key) + '" data-operation-group-key="' + escapeHtml(group.key) + '" data-operation-microarea="' + escapeHtml(unit.territory) + '" data-operation-quarteirao="' + escapeHtml(unit.quarter) + '"' + checked + '>' +
              '<span><strong>Q ' + escapeHtml(unit.quarter) + '</strong><small>' + escapeHtml((unit.properties || 0) + ' imovel(is)' + focusText) + '</small></span>' +
            '</label>';
          }).join('') +
          '</div>' +
        '</details>';
      }).join(''),
      '</div>',
      '<div class="operation-territory-selected" id="operationTerritorySelectedSummary"></div>',
      '</section>'
    ].join('');
    bindOperationTerritorySelector();
    syncOperationTerritoryFields();
  }

  function syncOperationTerritoryFields() {
    var payload = buildOperationTerritoryPayload();
    if ($('operationVdMicroareas')) { $('operationVdMicroareas').value = payload.operation_microareas; }
    if ($('operationVdQuarteiroes')) { $('operationVdQuarteiroes').value = payload.operation_quarteiroes; }
    if ($('operationUnits')) { $('operationUnits').value = payload.operation_units; }
    var summary = $('operationTerritorySelectedSummary');
    if (summary) {
      summary.textContent = payload.units.length
        ? ('Selecionado: ' + operationUnitSummary(payload.units))
        : 'Nenhum quarteirao selecionado. Selecione ao menos um par microarea + quarteirao para publicar.';
    }
    Array.prototype.slice.call(documentRef.querySelectorAll('.operation-territory-group')).forEach(function (groupNode) {
      var boxes = Array.prototype.slice.call(groupNode.querySelectorAll('[data-operation-unit-checkbox]'));
      var counter = groupNode.querySelector('summary > span');
      var checkedCount = boxes.filter(function (box) { return !!box.checked; }).length;
      if (counter) {
        counter.textContent = checkedCount + '/' + boxes.length + ' marcado(s)';
      }
    });
    renderOperationSelectedUnitsTable();
    renderOperationMap();
  }

  function bindOperationTerritorySelector() {
    var markAll = $('operationTerritoryMarkAllBtn');
    var clearAll = $('operationTerritoryClearAllBtn');
    function setBoxes(selector, checked) {
      Array.prototype.slice.call(documentRef.querySelectorAll(selector)).forEach(function (box) {
        box.checked = !!checked;
        var option = box.closest ? box.closest('.operation-quarter-option') : null;
        if (option) {
          option.classList.toggle('is-selected', !!box.checked);
        }
      });
      syncOperationTerritoryFields();
    }
    if (markAll && markAll.getAttribute('data-bound') !== '1') {
      markAll.setAttribute('data-bound', '1');
      markAll.addEventListener('click', function () { setBoxes('[data-operation-unit-checkbox]', true); });
    }
    if (clearAll && clearAll.getAttribute('data-bound') !== '1') {
      clearAll.setAttribute('data-bound', '1');
      clearAll.addEventListener('click', function () { setBoxes('[data-operation-unit-checkbox]', false); });
    }
    Array.prototype.slice.call(documentRef.querySelectorAll('[data-operation-unit-checkbox]')).forEach(function (box) {
      if (box.getAttribute('data-bound') === '1') {
        return;
      }
      box.setAttribute('data-bound', '1');
      box.addEventListener('change', function () {
        var option = box.closest ? box.closest('.operation-quarter-option') : null;
        if (option) {
          option.classList.toggle('is-selected', !!box.checked);
        }
        syncOperationTerritoryFields();
      });
    });
    Array.prototype.slice.call(documentRef.querySelectorAll('[data-operation-group-action]')).forEach(function (button) {
      if (button.getAttribute('data-bound') === '1') {
        return;
      }
      button.setAttribute('data-bound', '1');
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var group = String(button.getAttribute('data-operation-group') || '').replace(/"/g, '\\"');
        setBoxes('[data-operation-unit-checkbox][data-operation-group-key="' + group + '"]', button.getAttribute('data-operation-group-action') === 'mark');
      });
    });
  }

  function normalizeAdminMatricula(value) {
    var login = text(value || 'ADM').toUpperCase();
    if (!login || login === 'ADMIN' || login === 'ADMINISTRADOR') { return 'ADM'; }
    return login;
  }
  function getStoredAdminMatricula() {
    try { return normalizeAdminMatricula(localStorage.getItem('ace_panel_admin_matricula') || 'ADM'); } catch (err) { return 'ADM'; }
  }
  function setStoredAdminMatricula(value) {
    try { localStorage.setItem('ace_panel_admin_matricula', normalizeAdminMatricula(value)); } catch (err) {}
  }
  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return text(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '');
  }
  function apiReady() {
    var url = getApiUrl();
    return !!url && /^https?:\/\//i.test(url) && url.indexOf('COLE_AQUI') === -1;
  }
  function setStatus(msg, kind) {
    var node = $('operationStatus');
    if (node) {
      node.textContent = msg || '';
      node.className = 'operation-status ' + (kind || 'info');
    }
  }

  function getOperationalAuthParams() {
    try {
      var sync = root.ACEPanelCloudSync;
      var session = sync && typeof sync.getSessionInfo === 'function' ? sync.getSessionInfo() : null;
      if ((!session || !session.sessionToken) && root.sessionStorage) {
        try {
          var raw = root.sessionStorage.getItem('ace_panel_private_session_v1') || '';
          if (raw) { session = JSON.parse(raw); }
        } catch (storageError) {}
      }
      var token = session && session.sessionToken ? String(session.sessionToken || '').trim() : '';
      return token ? { sessionToken: token, session_token: token } : {};
    } catch (error) {
      return {};
    }
  }

  function isOperationalAuthError(error) {
    var message = text(error && error.message || error || '').toLowerCase();
    return message.indexOf('não autorizado') > -1 ||
      message.indexOf('nao autorizado') > -1 ||
      message.indexOf('sessão do painel') > -1 ||
      message.indexOf('sessao do painel') > -1 ||
      message.indexOf('auth_required') > -1;
  }

  function tryRefreshOperationalSession() {
    try {
      var sync = root.ACEPanelCloudSync;
      if (sync && typeof sync.refreshSession === 'function') {
        return sync.refreshSession(true).catch(function () { return null; });
      }
    } catch (error) {}
    return Promise.resolve(null);
  }

  function sha256(textValue) {
    if (!root.crypto || !root.crypto.subtle || !root.TextEncoder) {
      return Promise.reject(new Error('Navegador sem crypto.subtle para validar senha.'));
    }
    return root.crypto.subtle.digest('SHA-256', new root.TextEncoder().encode(textValue)).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function postJsonOnce(payload) {
    if (!apiReady()) { return Promise.reject(new Error('API_URL nao configurada.')); }
    var body = Object.assign({}, getOperationalAuthParams(), payload || {});
    return fetch(getApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) { throw new Error('API nao confirmou a operacao.'); }
      return res.json();
    }).then(function (payload) {
      if (!payload || payload.ok === false) { throw new Error(payload && payload.error ? payload.error : 'Resposta invalida da API.'); }
      return payload;
    });
  }

  function postJson(payload) {
    return postJsonOnce(payload).catch(function (error) {
      if (!isOperationalAuthError(error)) {
        throw error;
      }
      return tryRefreshOperationalSession().then(function () {
        return postJsonOnce(payload);
      });
    });
  }

  function ensureStyles() {
    if ($('operationPanelStyles')) { return; }
    var style = documentRef.createElement('style');
    style.id = 'operationPanelStyles';
    style.textContent = [
      '.operation-panel-grid{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}',
      '.operation-panel-layout{display:grid;grid-template-columns:minmax(380px,.95fr) minmax(430px,1.05fr);gap:18px;align-items:start}',
      '.operation-panel-column{display:flex;flex-direction:column;gap:16px;min-width:0}',
      '.operation-card{border:1px solid #dbe7df;border-radius:20px;background:linear-gradient(180deg,#fff 0%,#fbfdfb 100%);padding:16px;box-shadow:0 8px 24px rgba(15,72,43,.05)}',
      '.operation-card h2{margin:0 0 6px;color:#183c2c;font-size:1.05rem}.operation-card p{margin:0 0 10px;color:#5f7169;font-weight:700;line-height:1.38;font-size:.9rem}',
      '.operation-block-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.operation-block-title h2{margin:0;color:#183c2c;font-size:1.08rem}.operation-block-title p{margin:3px 0 0;color:#64746d;font-size:.86rem;font-weight:800}.operation-block-number{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#e8f4ec;color:#0f5132;font-weight:950}',
      '.operation-status{margin-top:10px;border-radius:12px;padding:9px 11px;font-weight:900}.operation-status.info{background:#eff6ff;color:#1e3a8a}.operation-status.ok{background:#f0fdf4;color:#166534}.operation-status.error{background:#fef2f2;color:#991b1b}.operation-status.warn{background:#fffbeb;color:#92400e}',
      '.operation-current{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.operation-current div{border:1px solid #dbe7df;border-radius:14px;padding:10px;background:#f8fcf9}.operation-current span{display:block;color:#64748b;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.03em}.operation-current strong{display:block;margin-top:3px;color:#183c2c;font-size:.98rem}',
      '.operation-program-shell{display:grid;grid-template-columns:1fr;gap:14px;align-items:start}.operation-program-main,.operation-program-side{border:1px solid #e0ebe3;border-radius:16px;background:#f9fcfa;padding:12px}',
      '.operation-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px}.operation-section-title h3{margin:0;color:#183c2c;font-size:.94rem}.operation-section-title p{margin:2px 0 0;color:#64746d;font-size:.8rem;font-weight:700}',
      '.operation-pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:5px 9px;background:#e8f4ec;color:#0f5132;font-size:.78rem;font-weight:900;white-space:nowrap}.operation-pill.mode-vd{background:#e8f4ec;color:#0f5132}.operation-pill.mode-pe{background:#fff7eb;color:#92400e}.operation-pill.mode-liraa{background:#eff6ff;color:#1e3a8a}',
      '.operation-form-grid{display:grid;grid-template-columns:1fr;gap:10px}.operation-admin-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px}.operation-stack{display:grid;gap:10px}.operation-form-grid .field,.operation-stack .field{margin:0}',
      '.operation-mode-legend{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.operation-mode-pill{border:1px solid #d8e6dd;border-radius:12px;padding:8px 9px;background:#fff;color:#476257;font-size:.78rem;font-weight:900;line-height:1.2}.operation-mode-pill strong{display:block;color:#183c2c;font-size:.8rem;margin-bottom:2px}.operation-mode-pill.is-active{border-color:#6ea889;background:#eef7f1;box-shadow:0 0 0 1px rgba(29,107,66,.08) inset}.operation-mode-pill.mode-pe.is-active{border-color:#b78132;background:#fff7eb}.operation-mode-pill.mode-liraa.is-active{border-color:#3c7db7;background:#eff6ff}',
      '.operation-mode-summary{margin-top:10px;padding:9px 11px;border-radius:12px;border:1px solid #dbe7df;background:#fff;color:#385448;font-weight:800;font-size:.84rem}',
      '.operation-vd-territory{border:1px solid #cfe0d6;border-radius:18px;background:#fff;padding:12px;box-shadow:0 8px 22px rgba(15,72,43,.05)}.operation-vd-territory>small{display:block;color:#64746d;font-weight:800;margin-top:8px}.operation-territory-picker{border:1px solid #dbe7df;border-radius:16px;background:#f8fcf9;padding:12px}.operation-territory-title{margin:0 0 4px;color:#183c2c;font-size:1rem}.operation-territory-note{margin:0;color:#5f7169;font-size:.86rem;font-weight:800;line-height:1.35}',
      '.operation-territory-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.operation-territory-actions,.operation-territory-group-actions{display:flex;gap:6px;flex-wrap:wrap}.operation-territory-groups{display:grid;gap:8px;max-height:520px;overflow:auto;border:1px solid #dbe7df;border-radius:14px;background:#fff;padding:8px}.operation-territory-group{border:1px solid #e0ebe3;border-radius:13px;background:#fbfdfb;overflow:hidden}.operation-territory-group summary{display:grid;grid-template-columns:minmax(160px,1fr) auto auto;align-items:center;gap:8px;cursor:pointer;padding:9px 10px;color:#183c2c;font-weight:900}.operation-territory-group summary span{color:#587063;font-size:.78rem}.operation-quarter-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:7px;padding:0 9px 9px}.operation-quarter-option{display:flex;align-items:center;gap:7px;border:1px solid #dbe7df;border-radius:12px;background:#fff;padding:7px;cursor:pointer}.operation-quarter-option.is-selected{border-color:#2563eb;background:#eff6ff;color:#1e3a8a}.operation-quarter-option input{width:16px;height:16px;accent-color:#2563eb}.operation-quarter-option span{display:flex;flex-direction:column;gap:2px}.operation-quarter-option strong{font-size:.82rem;margin:0}.operation-quarter-option small{font-size:.7rem;margin:0;color:#64746d}.operation-territory-selected,.operation-territory-empty,.operation-empty-state{margin-top:8px;border-radius:12px;background:#fff;padding:10px;color:#385448;font-size:.84rem;font-weight:800;border:1px solid #e0ebe3}',
      '.operation-map-card{display:grid;gap:10px}.operation-map{min-height:520px;border-radius:22px;overflow:hidden;border:1px solid #dbe7df;background:#eef6f0}.operation-map-empty{min-height:220px;display:flex;align-items:center;justify-content:center;padding:20px;color:#64746d;font-weight:900;text-align:center}.operation-map-legend{display:flex;gap:12px;flex-wrap:wrap;color:#475569;font-size:.86rem;font-weight:800}.operation-map-legend span{display:inline-flex;align-items:center;gap:6px}.operation-map-legend i{width:14px;height:14px;border-radius:999px;display:inline-block}.operation-map-legend .sampled{background:#2563eb}.operation-map-legend .focus{background:#dc2626}.operation-map-legend .base{background:#94a3b8}',
      '.operation-agent-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:8px;margin-bottom:8px}.operation-agent-toolbar .field{flex:1 1 210px;min-width:170px}.operation-agent-tools{display:flex;gap:8px;flex-wrap:wrap}.operation-agent-tools .btn{min-width:auto;padding-inline:12px}',
      '.operation-agent-list{display:grid;grid-template-columns:1fr;gap:8px;max-height:370px;overflow:auto;border:1px solid #dbe7df;border-radius:14px;padding:8px;background:#fff}.operation-agent-empty{padding:16px;border:1px dashed #cfe0d4;border-radius:12px;background:#f7fbf8;color:#587063;font-weight:800}',
      '.operation-agent-option{position:relative;display:flex;align-items:center;gap:9px;border:1px solid #dbe7df;border-radius:14px;padding:8px 10px;background:#fbfdfb;cursor:pointer;transition:.16s ease box-shadow,.16s ease border-color,.16s ease transform}.operation-agent-option:hover{border-color:#b8d2c2;box-shadow:0 6px 18px rgba(15,72,43,.08);transform:translateY(-1px)}.operation-agent-option input{width:18px;height:18px;accent-color:#0f6a43;flex:0 0 auto}.operation-agent-option.is-selected{border-color:#7fb393;background:#f0f8f3}.operation-agent-option.is-locked{background:#f8faf9;opacity:.82}.operation-agent-option.is-locked input{cursor:not-allowed}.operation-agent-avatar{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:#dfeee5;color:#0f5132;font-size:.78rem;font-weight:900;flex:0 0 30px}.operation-agent-copy{display:flex;flex-direction:column;min-width:0;flex:1}.operation-agent-copy strong{color:#183c2c;font-size:.88rem;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.operation-agent-copy small{margin-top:2px;color:#64746d;font-size:.78rem;font-weight:800;letter-spacing:.02em}',
      '.operation-list{display:grid;gap:9px;margin-top:10px}.operation-item{border:1px solid #dbe7df;background:#fff;border-radius:14px;padding:10px}.operation-item-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.operation-item-title{font-weight:900;color:#183c2c}.operation-item-meta{margin-top:6px;color:#5f7169;font-weight:800;font-size:.82rem}.operation-item-agents{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}.operation-agent-token{border:1px solid #dbe7df;background:#f8fcf9;border-radius:999px;padding:4px 8px;color:#183c2c;font-weight:900;font-size:.76rem}.operation-item-actions{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap}.operation-item-actions .btn{min-width:auto;padding:7px 10px}',
      '.operation-publish-callout{margin-top:10px;border:1px solid #b9d8c5;border-radius:14px;background:#f0f8f3;padding:11px;display:grid;gap:7px;color:#183c2c}.operation-publish-callout strong{font-size:.9rem}.operation-publish-callout span{color:#496458;font-size:.82rem;font-weight:800;line-height:1.35}.operation-publish-callout .btn{justify-self:start}',
      '.operation-btn-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.operation-btn-row .btn{flex:1 1 170px}.workday-rules{margin-top:12px;border:1px solid #dbe7df;border-radius:14px;background:#fff;padding:10px}.workday-rules-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.workday-rules-title strong{color:#183c2c}.workday-rules-title small{color:#64746d;font-weight:800}.workday-grid{display:grid;grid-template-columns:1fr;gap:8px}.workday-rule{border:1px solid #e0ebe3;border-radius:12px;background:#f8fcf9;padding:8px}.workday-rule h4{margin:0 0 6px;color:#183c2c;font-size:.82rem}.workday-rule label{display:block;margin-top:6px;font-size:.74rem;color:#587063;font-weight:900}.workday-rule input[type=time]{width:100%;margin-top:3px}.workday-rule .check{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:.74rem;color:#385448;font-weight:900}.workday-rule .check input{width:auto}.operation-table-wrap{overflow:auto;border:1px solid #e0ebe3;border-radius:14px;background:#fff}.operation-report-table{width:100%;border-collapse:collapse}.operation-report-table th,.operation-report-table td{border-bottom:1px solid #d8e6dd;padding:9px;text-align:left}.operation-report-table th{background:#e8f4ec;color:#183c2c}',
      '@media(max-width:980px){.operation-panel-layout{grid-template-columns:1fr}.operation-current,.operation-territory-group summary{grid-template-columns:1fr}.operation-agent-toolbar{flex-direction:column;align-items:stretch}.operation-btn-row .btn{flex:1 1 auto}.operation-map{min-height:360px}.operation-territory-groups{max-height:none}}'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function ensurePanel() {
    ensureStyles();
    var nav = documentRef.querySelector('.app-sidebar__nav');
    if (nav && !$('sidebarOperationBtn')) {
      var btn = documentRef.createElement('button');
      btn.id = 'sidebarOperationBtn';
      btn.className = 'sidebar-tab';
      btn.type = 'button';
      btn.setAttribute('data-panel-view', 'operation');
      btn.setAttribute('aria-selected', 'false');
      btn.innerHTML = '<span class="sidebar-tab__icon">▧</span><span>Operação</span>';
      var agents = $('sidebarAgentsBtn');
      if (agents && agents.parentNode) { agents.parentNode.insertBefore(btn, agents); }
      else { nav.appendChild(btn); }
      btn.addEventListener('click', activate);
    }
    var workspace = documentRef.querySelector('.panel-workspace');
    if (workspace && !$('panelOperationView')) {
      var view = documentRef.createElement('div');
      view.id = 'panelOperationView';
      view.className = 'panel-view';
      view.setAttribute('data-panel-view-content', 'operation');
      view.hidden = true;
      view.innerHTML = [
        '<div class="panel-screen-head"><div class="screen-head-copy"><strong>Programação operacional diária</strong><span>Crie operações em VD, P.E. ou LIRAa com o território definido por microárea + quarteirão.</span></div><div class="screen-badge">▧</div></div>',
        '<div class="operation-panel-layout">',
        '<div class="operation-panel-column operation-panel-column-left">',

        '<section class="operation-card" id="operationFormBlock">',
        '<div class="operation-block-title"><div><h2>1. Dados da operação</h2><p>Informe data, tipo de trabalho e agente. Para territórios diferentes, publique uma operação por agente.</p></div><span class="operation-block-number">1</span></div>',
        '<div class="operation-current" id="operationCurrent"></div>',
        '<div class="operation-status info" id="operationStatus">Carregando programação...</div>',
        '<div class="operation-form-grid" style="margin-top:12px">',
        '<div class="field"><label for="operationDate">Data da operação</label><input id="operationDate" type="date" value="' + escapeHtml(state.date) + '"></div>',
        '<div class="field"><label for="operationModeSelect">Tipo da operação</label><select id="operationModeSelect"><option value="VD">VD - Visita domiciliar</option><option value="PE">P.E. - Ponto estratégico</option><option value="LIRAA">LIRAa</option></select></div>',
        '<div class="field"><label for="operationCycle">Ciclo / identificação</label><input id="operationCycle" type="text" placeholder="Ex.: VD Centro, PE Abril, LIRAa 2º ciclo"></div>',
        '<div class="field"><label for="operationPeTipo">Tipo do P.E.</label><input id="operationPeTipo" type="text" placeholder="Ferro velho, borracharia, fundição..."></div>',
        '<div class="field"><label for="operationPeNome">Nome/referência do P.E.</label><input id="operationPeNome" type="text" placeholder="Nome do local ou referência"></div>',
        '</div>',
        '<div class="operation-program-side" style="margin-top:12px"><div class="operation-section-title"><div><h3>Agente / equipe</h3><p>Cada agente recebe seu próprio recorte territorial. Dois agentes podem receber o mesmo quarteirão quando necessário.</p></div><span class="operation-pill" id="operationSelectedCount">0 selecionados</span></div>',
        '<div class="operation-agent-toolbar"><div class="field"><label for="operationAgentSearch">Buscar agente</label><input id="operationAgentSearch" type="search" placeholder="Nome ou matrícula"></div><div class="operation-agent-tools"><button class="btn btn-soft" id="operationAgentSelectAllBtn" type="button">Marcar livres</button><button class="btn btn-soft" id="operationAgentClearSelectionBtn" type="button">Limpar</button></div></div>',
        '<div class="operation-agent-list" id="operationAgentList"></div></div>',
        '</section>',

        '<section class="operation-card" id="operationTerritoryBlock">',
        '<div class="operation-block-title"><div><h2>2. Território da operação</h2><p>Escolha a microárea e marque somente os quarteirões que o agente vai trabalhar.</p></div><span class="operation-block-number">2</span></div>',
        '<div class="operation-vd-territory" id="operationVdTerritoryBox"><div id="operationTerritorySelectorHost"><section class="operation-territory-picker"><h2 class="operation-territory-title">Selecao manual dos quarteiroes da operacao</h2><div class="operation-territory-empty">Carregando microareas e quarteiroes...</div></section></div><small>Uso comum para VD, P.E. e LIRAa. A seleção fica gravada só na operação publicada para o(s) agente(s) escolhido(s).</small></div>',
        '</section>',

        '</div>',
        '<div class="operation-panel-column operation-panel-column-right">',

        '<section class="operation-card operation-map-card" id="operationMapBlock">',
        '<div class="operation-block-title"><div><h2>3. Mapa territorial do dia</h2><p>Azul = operação já marcada para o dia ou seleção atual; vermelho = foco recente.</p></div><span class="operation-block-number">3</span></div>',
        '<div id="operationTerritoryMap" class="operation-map"></div>',
        '<div class="operation-map-legend"><span><i class="sampled"></i>Marcado no dia / seleção atual</span><span><i class="focus"></i>Foco/positivo</span><span><i class="base"></i>Território</span></div>',
        '</section>',

        '<section class="operation-card" id="operationSelectedBlocksTable">',
        '<div class="operation-block-title"><div><h2>4. Quarteirões marcados</h2><p>Conferência dos pares microárea/quarteirão que serão enviados para os agentes.</p></div><span class="operation-block-number">4</span></div>',
        '<div id="operationSelectedBlocksHost"><div class="operation-empty-state">Nenhum quarteirão marcado.</div></div>',
        '</section>',

        '<section class="operation-card" id="operationPublishBlock">',
        '<div class="operation-block-title"><div><h2>5. Liberar para o tablet</h2><p>Revise o modo, o território, as orientações e envie o plano para o agente. Ele aparece no index quando o agente logar/sincronizar com internet.</p></div><span class="operation-block-number">5</span></div>',
        '<div class="operation-mode-legend" id="operationModeLegend"><div class="operation-mode-pill mode-vd" data-mode-pill="VD"><strong>VD</strong>Rotina domiciliar</div><div class="operation-mode-pill mode-pe" data-mode-pill="PE"><strong>P.E.</strong>Ponto estratégico</div><div class="operation-mode-pill mode-liraa" data-mode-pill="LIRAA"><strong>LIRAa</strong>Levantamento</div></div>',
        '<div class="operation-mode-summary" id="operationModeSummary">Modo selecionado: VD - Visita domiciliar.</div>',        '<div class="operation-stack" style="margin-top:10px"><div class="field"><label for="operationDescription">Observação da operação</label><textarea id="operationDescription" placeholder="Orientações para a equipe"></textarea></div></div>',
        '<div class="operation-admin-grid"><div class="field"><label for="operationAdminMatricula">Matrícula admin</label><input id="operationAdminMatricula" type="text" value="' + escapeHtml(getStoredAdminMatricula()) + '"></div><div class="field"><label for="operationAdminSenha">Senha admin</label><input id="operationAdminSenha" type="password" placeholder="Senha do administrador"></div></div>',
        '<div class="operation-btn-row"><button class="btn btn-primary" id="operationPublishBtn" type="button">Liberar para tablet do agente</button><button class="btn btn-soft" id="operationRefreshBtn" type="button">Atualizar</button><button class="btn btn-soft" id="operationReportBtn" type="button">Relatório PDF</button><button class="btn btn-warn" id="operationClearBtn" type="button">Cancelar programação do dia</button></div>',
        '<div class="operation-list" id="operationDayList"></div>',
        '</section>',

        '</div>',
        '</div>'
      ].join('');
      workspace.appendChild(view);
    }
    bind();
    renderOperationTerritorySelector();
  }

  function activate() {
    documentRef.querySelectorAll('[data-panel-view-content]').forEach(function (panel) {
      var active = panel.getAttribute('data-panel-view-content') === 'operation';
      panel.hidden = !active; panel.classList.toggle('is-active', active);
    });
    documentRef.querySelectorAll('[data-panel-view]').forEach(function (button) {
      var active = button.getAttribute('data-panel-view') === 'operation';
      button.classList.toggle('active', active); button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    render();
    refresh();
  }

  function extractAgents(payload) {
    var rows = [];
    if (payload && Array.isArray(payload.agents)) { rows = payload.agents; }
    else if (payload && payload.data && Array.isArray(payload.data.agents)) { rows = payload.data.agents; }
    else if (payload && payload.payload && Array.isArray(payload.payload.agents)) { rows = payload.payload.agents; }
    return rows.filter(function (row) { return text(row && (row.matricula || row.code)); });
  }
  function assignmentByAgent() {
    var map = {};
    state.assignments.forEach(function (a) {
      var mat = text(a.agente_matricula || a.matricula || '').toUpperCase();
      if (mat) { map[mat] = a; }
    });
    return map;
  }
  function getOpById(id) {
    id = text(id);
    return state.operations.filter(function (op) { return text(op.operation_id) === id; })[0] || null;
  }
  function filteredAgents() {
    var filter = text(state.agentFilter || '').toLowerCase();
    return state.agents.filter(function (agent) {
      if (!filter) { return true; }
      var nome = text(agent.nome || agent.name || '').toLowerCase();
      var mat = text(agent.matricula || agent.code || '').toLowerCase();
      return nome.indexOf(filter) > -1 || mat.indexOf(filter) > -1;
    });
  }
  function selectedAgents() {
    return Array.from(documentRef.querySelectorAll('#operationAgentList input[type="checkbox"]:checked')).map(function (input) {
      return text(input.value).toUpperCase();
    }).filter(Boolean);
  }
  function selectedAgentLabels(matriculas) {
    var selected = matriculas || selectedAgents();
    return selected.map(function (matricula) {
      var agent = state.agents.filter(function (row) {
        return text(row && (row.matricula || row.uid)).toUpperCase() === matricula;
      })[0] || {};
      return text(agent.nome || agent.name || '') ? (text(agent.nome || agent.name) + ' (' + matricula + ')') : matricula;
    });
  }
  function updateSelectedCount() {
    var node = $('operationSelectedCount');
    if (!node) { return; }
    var count = selectedAgents().length;
    node.textContent = count ? (count + ' selecionado' + (count > 1 ? 's' : '')) : '0 selecionados';
  }
  function updateModeLegend(modeValue) {
    var mode = normalizeMode(modeValue || ($('operationModeSelect') ? $('operationModeSelect').value : 'VD'));
    documentRef.querySelectorAll('[data-mode-pill]').forEach(function (node) {
      node.classList.toggle('is-active', node.getAttribute('data-mode-pill') === mode);
    });
    var summary = $('operationModeSummary');
    if (summary) {
      var msg = 'Modo selecionado: ' + modeLabel(mode) + '.';
      if (mode === 'PE') { msg += ' Use para ferro-velho, depositos, fabricas, fundicoes e pontos de maior risco.'; }
      else if (mode === 'LIRAA') { msg += ' Use para agentes alocados no levantamento amostral.'; }
      else { msg += ' Use para a rotina normal de visita domiciliar.'; }
      msg += ' O territorio informado abaixo limita a lista de imoveis no tablet.';
      summary.textContent = msg;
    }
    var peTipo = $('operationPeTipo');
    var peNome = $('operationPeNome');
    [peTipo, peNome].forEach(function (el) {
      if (el) { el.closest('.field').style.display = mode === 'PE' ? '' : 'none'; }
    });
    var vdBox = $('operationVdTerritoryBox');
    if (vdBox) {
      vdBox.style.display = '';
      vdBox.setAttribute('data-operation-mode', mode);
    }
  }

  function parseOperationUnits(value) {
    if (Array.isArray(value)) {
      return value;
    }
    var raw = text(value);
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
        microarea: text(parts[0]),
        quarteirao: normalizeQuarter(parts.slice(1).join('::'))
      };
    }).filter(function (unit) {
      return unit.microarea && unit.quarteirao;
    });
  }

  function operationTerritoryText(op) {
    var units = parseOperationUnits(op && (op.operation_units || op.operationUnits || ''));
    if (units.length) {
      return operationUnitSummary(units);
    }
    return [
      op && op.operation_microareas ? ('MA: ' + op.operation_microareas) : '',
      op && op.operation_quarteiroes ? ('Q: ' + op.operation_quarteiroes) : ''
    ].filter(Boolean).join(' • ');
  }

  function renderCurrent() {
    var box = $('operationCurrent');
    if (!box) { return; }
    var summary = state.summary || { modes: { VD: {}, PE: {}, LIRAA: {} }, total_operations: 0, total_assignments: 0 };
    var modes = summary.modes || {};
    function num(mode, key) { return Number((modes[mode] && modes[mode][key]) || 0); }
    box.innerHTML = [
      '<div><span>Data</span><strong>' + escapeHtml(state.date) + '</strong></div>',
      '<div><span>Operações</span><strong>' + escapeHtml(summary.total_operations || state.operations.length || 0) + '</strong></div>',
      '<div><span>Agentes</span><strong>' + escapeHtml(summary.total_assignments || state.assignments.length || 0) + '</strong></div>',
      '<div><span>VD</span><strong>' + num('VD', 'agents') + ' ag. / ' + num('VD', 'visits') + ' vis.</strong></div>',
      '<div><span>P.E.</span><strong>' + num('PE', 'agents') + ' ag. / ' + num('PE', 'visits') + ' vis.</strong></div>',
      '<div><span>LIRAa</span><strong>' + num('LIRAA', 'agents') + ' ag. / ' + num('LIRAA', 'visits') + ' vis.</strong></div>'
    ].join('');
  }

  function renderOperations() {
    var box = $('operationDayList');
    if (!box) { return; }
    if (!state.operations.length) {
      box.innerHTML = '<div class="operation-agent-empty">Nenhuma operação programada para esta data.</div>';
      return;
    }
    box.innerHTML = state.operations.map(function (op) {
      var mode = normalizeMode(op.mode || op.tipo_operacao);
      var opId = text(op.operation_id);
      var assigned = state.assignments.filter(function (a) { return text(a.operation_id) === opId; });
      var title = text(op.titulo || op.title || op.ciclo || op.cycle || modeLabel(mode));
      var agentsHtml = assigned.length ? assigned.map(function (a) { return '<span class="operation-agent-token">' + escapeHtml(a.agente_nome || a.agente_matricula) + '</span>'; }).join('') : '<span class="operation-agent-token">Sem agente</span>';
      var territory = operationTerritoryText(op);
      var meta = [op.descricao || op.description || op.pe_nome_local || '', territory].filter(Boolean).join(' — ');
      return '<article class="operation-item"><div class="operation-item-head"><div class="operation-item-title">' + escapeHtml(title) + '</div><span class="operation-pill mode-' + (mode === 'LIRAA' ? 'liraa' : mode.toLowerCase()) + '">' + escapeHtml(mode) + '</span></div><div class="operation-item-meta">' + escapeHtml(meta) + '</div><div class="operation-item-agents">' + agentsHtml + '</div><div class="operation-item-actions"><button class="btn btn-warn" type="button" data-op-remove="' + escapeHtml(opId) + '">Remover operação</button></div></article>';
    }).join('');
  }

  function renderAgents() {
    var box = $('operationAgentList');
    if (!box) { return; }
    if (!state.agents.length) {
      box.innerHTML = '<div class="operation-agent-empty">Nenhum agente carregado. Clique em atualizar ou confira a API.</div>';
      updateSelectedCount();
      return;
    }
    var assigned = assignmentByAgent();
    var rows = filteredAgents();
    if (!rows.length) {
      box.innerHTML = '<div class="operation-agent-empty">Nenhum agente encontrado para o filtro informado.</div>';
      updateSelectedCount();
      return;
    }
    box.innerHTML = rows.map(function (agent) {
      var nome = text(agent.nome || agent.name || '').trim() || 'Agente';
      var mat = text(agent.matricula || agent.code || '').toUpperCase();
      if (!mat) { return ''; }
      var a = assigned[mat];
      var locked = !!a;
      var mode = a ? normalizeMode(a.tipo_operacao) : '';
      var op = a ? getOpById(a.operation_id) : null;
      var badge = locked ? '<span class="operation-pill mode-' + (mode === 'LIRAA' ? 'liraa' : mode.toLowerCase()) + '">' + escapeHtml(mode) + '</span>' : '<span class="operation-pill">Livre</span>';
      var title = locked ? 'Já alocado em ' + modeLabel(mode) + (op && (op.titulo || op.ciclo) ? ' — ' + (op.titulo || op.ciclo) : '') : 'Livre para nova operação';
      return '<label class="operation-agent-option' + (locked ? ' is-locked' : '') + '" title="' + escapeHtml(title) + '"><input class="operation-agent-check" type="checkbox" value="' + escapeHtml(mat) + '" ' + (locked ? 'disabled' : '') + '> <span class="operation-agent-avatar">' + escapeHtml(initials(nome, mat)) + '</span><span class="operation-agent-copy"><strong>' + escapeHtml(nome) + '</strong><small>' + escapeHtml(mat) + '</small></span>' + badge + '</label>';
    }).join('');
    updateSelectedCount();
  }

  function renderIndicatorsCard() {
    var host = $('panelOperationalExtras');
    if (!host) { return; }
    var id = 'operationIndicatorsCard';
    var card = $(id);
    if (!card) {
      card = documentRef.createElement('div');
      card.id = id;
      card.className = 'operation-mode-summary';
      host.appendChild(card);
    }
    var summary = state.summary || { modes: {} };
    var modes = summary.modes || {};
    function agents(mode) { return Number((modes[mode] && modes[mode].agents) || 0); }
    function visits(mode) { return Number((modes[mode] && modes[mode].visits) || 0); }
    card.innerHTML = '<strong>Distribuição operacional do dia:</strong> VD ' + agents('VD') + ' agente(s) / ' + visits('VD') + ' visita(s) • P.E. ' + agents('PE') + ' agente(s) / ' + visits('PE') + ' visita(s) • LIRAa ' + agents('LIRAA') + ' agente(s) / ' + visits('LIRAA') + ' visita(s).';
  }

  function render() {
    renderCurrent();
    renderOperations();
    renderAgents();
    renderIndicatorsCard();
    renderOperationTerritorySelector();
    updateModeLegend();
  }

  function loadAgents() {
    return postJson({ action: 'roster' }).then(function (payload) {
      state.agents = extractAgents(payload);
      renderAgents();
      if (!state.agents.length) { setStatus('Nenhum agente retornado pela API. Confira a aba Agentes.', 'warn'); }
      return state.agents;
    }).catch(function (err) {
      setStatus('Não consegui carregar agentes: ' + err.message, 'warn');
      return [];
    });
  }

  function normalizeSchedulePayload(payload) {
    var data = payload && payload.data ? payload.data : payload;
    state.date = text(data && data.date) || state.date;
    state.operations = Array.isArray(data && data.operations) ? data.operations : [];
    state.assignments = Array.isArray(data && data.assignments) ? data.assignments : [];
    state.summary = data && data.summary ? data.summary : null;
    state.workdaySettings = normalizeWorkdaySettings((data && (data.workday_settings || data.workdaySettings)) || state.workdaySettings);
    fillWorkdayFields();
  }

  function refresh() {
    var fieldDate = $('operationDate');
    if (fieldDate && fieldDate.value) { state.date = fieldDate.value; }
    if (!apiReady()) {
      setStatus('API_URL não configurada.', 'warn');
      render();
      return;
    }
    postJson({ action: 'operation_schedule', date: state.date }).then(function (payload) {
      normalizeSchedulePayload(payload);
      if ($('operationDate')) { $('operationDate').value = state.date; }
      setStatus('Programação operacional carregada.', 'ok');
      render();
    }).catch(function (err) {
      setStatus('Não consegui carregar programação: ' + err.message, 'warn');
      render();
    });
    loadAgents();
  }

  function adminMatriculaField() {
    return $('operationAdminMatricula') ? normalizeAdminMatricula($('operationAdminMatricula').value) : 'ADM';
  }
  function commonAdminPayload(action) {
    var senha = $('operationAdminSenha') ? $('operationAdminSenha').value : '';
    var adminMatricula = adminMatriculaField();
    var authParams = getOperationalAuthParams();
    setStoredAdminMatricula(adminMatricula);
    if (authParams.sessionToken) {
      return Promise.resolve(Object.assign({ action: action, admin_matricula: adminMatricula }, authParams));
    }
    if (!senha) { setStatus('Informe a senha do administrador.', 'warn'); return Promise.reject(new Error('__handled__')); }
    return sha256(senha).then(function (hash) {
      return Object.assign({ action: action, admin_matricula: adminMatricula, admin_hash: hash }, authParams);
    });
  }
  function resetOperationDraftAfterPublish() {
    state.selectedUnits = {};
    Array.prototype.slice.call(documentRef.querySelectorAll('#operationAgentList input[type="checkbox"]:checked')).forEach(function (input) {
      input.checked = false;
    });
    Array.prototype.slice.call(documentRef.querySelectorAll('[data-operation-unit-checkbox]')).forEach(function (box) {
      box.checked = false;
      var option = box.closest ? box.closest('.operation-quarter-option') : null;
      if (option) {
        option.classList.remove('is-selected');
      }
    });
    updateSelectedCount();
  }

  function buildOperationPlanPayload(territoryPayload, agents) {
    return {
      data_operacao: $('operationDate') ? $('operationDate').value : state.date,
      mode: $('operationModeSelect') ? $('operationModeSelect').value : 'VD',
      title: $('operationCycle') ? $('operationCycle').value : '',
      cycle: $('operationCycle') ? $('operationCycle').value : '',
      description: $('operationDescription') ? $('operationDescription').value : '',
      operation_units: territoryPayload.operation_units,
      operation_microareas: territoryPayload.operation_microareas,
      operation_quarteiroes: territoryPayload.operation_quarteiroes,
      territory_lock: territoryPayload.units.length ? 'Sim' : 'Nao',
      agents: agents,
      pe: {
        tipo_local: $('operationPeTipo') ? $('operationPeTipo').value : '',
        nome_local: $('operationPeNome') ? $('operationPeNome').value : '',
        observacao: $('operationDescription') ? $('operationDescription').value : ''
      }
    };
  }

  function publish() {
    var agents = selectedAgents();
    var territoryPayload = buildOperationTerritoryPayload();
    var mode = normalizeMode($('operationModeSelect') ? $('operationModeSelect').value : 'VD');
    var date = $('operationDate') ? $('operationDate').value : state.date;
    if (!agents.length) { setStatus('Selecione ao menos um agente livre.', 'warn'); return; }
    if (!validateOperationTerritoryForPublish(territoryPayload)) { return; }
    if (root.confirm && !root.confirm(
      'Liberar plano para o tablet do agente?\n\n' +
      'Data: ' + date + '\n' +
      'Tipo: ' + modeLabel(mode) + '\n' +
      'Agente(s): ' + selectedAgentLabels(agents).join(', ') + '\n' +
      'Territorio: ' + operationUnitSummary(territoryPayload.units) + '\n\n' +
      'O index do agente recebera somente os enderecos dos pares microarea + quarteirao selecionados quando logar/sincronizar com internet.'
    )) {
      return;
    }
    setStatus(agents.length > 1 ? 'Liberando operacoes separadas para os tablets...' : 'Liberando operacao para o tablet do agente...', 'info');
    commonAdminPayload('operation_plan_publish').then(function (basePayload) {
      var lastPayload = null;
      return agents.reduce(function (chain, matricula) {
        return chain.then(function () {
          var payload = Object.assign({}, basePayload);
          payload.plan = buildOperationPlanPayload(territoryPayload, [matricula]);
          return postJson(payload).then(function (response) {
            lastPayload = response;
            return response;
          });
        });
      }, Promise.resolve()).then(function () {
        return lastPayload;
      });
    }).then(function (payload) {
      normalizeSchedulePayload(payload && (payload.schedule ? payload.schedule : payload));
      resetOperationDraftAfterPublish();
      setStatus(agents.length > 1
        ? 'Operacoes liberadas separadamente por agente. Cada tablet recebera apenas seus pares microarea + quarteirao.'
        : 'Operacao liberada para o tablet do agente. O index recebera apenas os pares microarea + quarteirao selecionados.', 'ok');
      render();
    }).catch(function (err) {
      if (err && err.message === '__handled__') { return; }
      setStatus('Erro ao adicionar: ' + err.message, 'error');
    });
  }

  function clear(operationId) {
    var operation = operationId ? state.operations.filter(function (item) {
      return text(item && item.operation_id) === text(operationId);
    })[0] : null;
    var date = $('operationDate') ? $('operationDate').value : state.date;
    var label = operationId
      ? ('esta operacao' + (operation ? ' (' + modeLabel(operation.mode || operation.tipo_operacao) + ' - ' + operationTerritoryText(operation) + ')' : ''))
      : ('toda a programacao de ' + date);
    if (root.confirm && !root.confirm('Confirmar cancelamento de ' + label + '? As visitas e historicos ja registrados nao serao apagados.')) {
      return;
    }
    setStatus(operationId ? 'Removendo operação...' : 'Limpando programação do dia...', 'info');
    commonAdminPayload('operation_plan_clear').then(function (payload) {
      payload.date = date;
      if (operationId) { payload.operation_id = operationId; }
      return postJson(payload);
    }).then(function (payload) {
      normalizeSchedulePayload(payload && (payload.schedule ? payload.schedule : payload));
      setStatus(operationId ? 'Operacao cancelada.' : 'Programacao do dia cancelada.', 'ok');
      render();
    }).catch(function (err) {
      if (err && err.message === '__handled__') { return; }
      setStatus('Erro ao limpar: ' + err.message, 'error');
    });
  }

  function saveWorkdaySettings() {
    return false;
  }
  function toggleAllFree(checked) {
    documentRef.querySelectorAll('#operationAgentList input[type="checkbox"]:not(:disabled)').forEach(function (input) {
      input.checked = !!checked;
      var label = input.closest('.operation-agent-option');
      if (label) { label.classList.toggle('is-selected', input.checked); }
    });
    updateSelectedCount();
  }
  function syncAgentOptionVisuals() {
    documentRef.querySelectorAll('#operationAgentList .operation-agent-option').forEach(function (label) {
      var input = label.querySelector('input[type="checkbox"]');
      label.classList.toggle('is-selected', !!(input && input.checked));
    });
    updateSelectedCount();
  }
  function handleAgentSearch() {
    var field = $('operationAgentSearch');
    state.agentFilter = field ? field.value : '';
    renderAgents();
  }
  function reportHtml() {
    var summary = state.summary || { modes: {} };
    var modes = summary.modes || {};
    function modeItem(mode) { return modes[mode] || {}; }
    function row(mode) {
      var item = modeItem(mode);
      return '<tr><td>' + modeLabel(mode) + '</td><td>' + (item.agents || 0) + '</td><td>' + (item.visits || 0) + '</td><td>' + (item.focos || 0) + '</td><td>' + (item.tubitos || 0) + '</td><td>' + (item.pendencias || 0) + '</td></tr>';
    }
    var operations = state.operations.map(function (op) {
      var opId = text(op.operation_id);
      var assigned = state.assignments.filter(function (a) { return text(a.operation_id) === opId; }).map(function (a) { return escapeHtml(a.agente_nome || a.agente_matricula); }).join(', ');
      var mode = normalizeMode(op.mode || op.tipo_operacao);
      var territory = operationTerritoryText(op);
      return '<tr><td>' + escapeHtml(modeLabel(mode)) + '</td><td>' + escapeHtml(op.titulo || op.title || op.ciclo || '-') + '</td><td>' + escapeHtml(op.pe_nome_local || op.descricao || op.description || territory || '-') + '</td><td>' + (assigned || '-') + '</td></tr>';
    }).join('');
    var agentRows = state.assignments.map(function (a) {
      var op = getOpById(a.operation_id) || {};
      return '<tr><td>' + escapeHtml(a.agente_nome || a.agente_matricula || '-') + '</td><td>' + escapeHtml(a.agente_matricula || '-') + '</td><td>' + escapeHtml(modeLabel(a.tipo_operacao || (op.mode || op.tipo_operacao))) + '</td><td>' + escapeHtml(op.titulo || op.ciclo || op.pe_nome_local || '-') + '</td></tr>';
    }).join('');
    function box(mode) {
      var item = modeItem(mode);
      return '<div class="kpi"><small>' + escapeHtml(modeLabel(mode)) + '</small><strong>' + (item.agents || 0) + '</strong><span>agentes • ' + (item.visits || 0) + ' visitas • ' + (item.focos || 0) + ' focos • ' + (item.tubitos || 0) + ' tubitos</span></div>';
    }
    return '<!doctype html><html><head><meta charset="utf-8"><title>Relatório Operacional Diário</title><style>' +
      'body{font-family:Arial,sans-serif;color:#183c2c;margin:26px;background:#fff}header{border-bottom:3px solid #1f6b46;padding-bottom:12px;margin-bottom:18px}.sup{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#587063;font-weight:800}h1{font-size:22px;margin:4px 0 2px}h2{font-size:15px;margin:22px 0 8px;color:#183c2c}.meta{font-weight:700;color:#587063}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.kpi{border:1px solid #cfded4;border-radius:12px;padding:10px;background:#f8fbf9}.kpi small{display:block;font-size:11px;text-transform:uppercase;color:#587063;font-weight:900}.kpi strong{display:block;font-size:24px;margin-top:2px}.kpi span{display:block;font-size:11px;color:#52615a;font-weight:700}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #cfded4;padding:8px;text-align:left;font-size:12px;vertical-align:top}th{background:#e8f4ec}.signature{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:42px}.line{border-top:1px solid #183c2c;text-align:center;padding-top:8px;font-size:12px;color:#385448}.obs{min-height:54px;border:1px solid #cfded4;border-radius:10px;padding:10px;color:#52615a}.foot{margin-top:18px;font-size:11px;color:#64746d}@media print{button{display:none}body{margin:18px}.kpis{break-inside:avoid}}' +
      '</style></head><body><header><div class="sup">ACE Campo</div><h1>Relatório Operacional Diário</h1><div class="meta">Coordenação Municipal de Combate às Endemias • Data: ' + escapeHtml(state.date) + '</div></header>' +
      '<div class="kpis">' + box('VD') + box('PE') + box('LIRAA') + '</div>' +
      '<h2>Resumo VD / P.E. / LIRAa</h2><table><thead><tr><th>Tipo</th><th>Agentes programados</th><th>Visitas</th><th>Focos</th><th>Tubitos</th><th>Pendências</th></tr></thead><tbody>' + row('VD') + row('PE') + row('LIRAA') + '</tbody></table>' +
      '<h2>Operações programadas</h2><table><thead><tr><th>Tipo</th><th>Identificação</th><th>Referência / observação</th><th>Agentes</th></tr></thead><tbody>' + (operations || '<tr><td colspan="4">Nenhuma operação programada.</td></tr>') + '</tbody></table>' +
      '<h2>Agentes por operação</h2><table><thead><tr><th>Agente</th><th>Matrícula</th><th>Operação</th><th>Identificação</th></tr></thead><tbody>' + (agentRows || '<tr><td colspan="4">Nenhum agente programado.</td></tr>') + '</tbody></table>' +
      '<h2>Observações finais</h2><div class="obs">&nbsp;</div><div class="signature"><div class="line">Coordenação / Supervisão</div><div class="line">Responsável pela conferência</div></div><div class="foot">Gerado pelo Painel ACE. Use Imprimir / Salvar em PDF para arquivar o relatório.</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>';
  }
  function printReport() {
    var win = window.open('', '_blank');
    if (!win) { setStatus('O navegador bloqueou a janela do relatório.', 'warn'); return; }
    win.document.open();
    win.document.write(reportHtml());
    win.document.close();
  }

  function bind() {
    var pub = $('operationPublishBtn');
    var clr = $('operationClearBtn');
    var ref = $('operationRefreshBtn');
    var report = $('operationReportBtn');
    var search = $('operationAgentSearch');
    var allBtn = $('operationAgentSelectAllBtn');
    var clearBtn = $('operationAgentClearSelectionBtn');
    var list = $('operationAgentList');
    var opList = $('operationDayList');
    var selectedHost = $('operationSelectedBlocksHost');
    var modeSelect = $('operationModeSelect');
    var dateField = $('operationDate');
    if (pub && pub.getAttribute('data-bound') !== '1') { pub.setAttribute('data-bound', '1'); pub.addEventListener('click', publish); }
    if (clr && clr.getAttribute('data-bound') !== '1') { clr.setAttribute('data-bound', '1'); clr.addEventListener('click', function () { clear(''); }); }
    if (ref && ref.getAttribute('data-bound') !== '1') { ref.setAttribute('data-bound', '1'); ref.addEventListener('click', refresh); }
    if (report && report.getAttribute('data-bound') !== '1') { report.setAttribute('data-bound', '1'); report.addEventListener('click', printReport); }
    if (modeSelect && modeSelect.getAttribute('data-bound') !== '1') { modeSelect.setAttribute('data-bound', '1'); modeSelect.addEventListener('change', function () { updateModeLegend(modeSelect.value); }); }
    if (dateField && dateField.getAttribute('data-bound') !== '1') { dateField.setAttribute('data-bound', '1'); dateField.addEventListener('change', refresh); }
    if (search && search.getAttribute('data-bound') !== '1') { search.setAttribute('data-bound', '1'); search.addEventListener('input', handleAgentSearch); }
    if (allBtn && allBtn.getAttribute('data-bound') !== '1') { allBtn.setAttribute('data-bound', '1'); allBtn.addEventListener('click', function () { toggleAllFree(true); }); }
    if (clearBtn && clearBtn.getAttribute('data-bound') !== '1') { clearBtn.setAttribute('data-bound', '1'); clearBtn.addEventListener('click', function () { toggleAllFree(false); }); }
    if (list && list.getAttribute('data-bound') !== '1') { list.setAttribute('data-bound', '1'); list.addEventListener('change', syncAgentOptionVisuals); }
    if (opList && opList.getAttribute('data-bound') !== '1') {
      opList.setAttribute('data-bound', '1');
      opList.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest('[data-op-remove]');
        if (btn) { clear(btn.getAttribute('data-op-remove')); }
      });
    }
    if (selectedHost && selectedHost.getAttribute('data-bound') !== '1') {
      selectedHost.setAttribute('data-bound', '1');
      selectedHost.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest('#operationPublishInlineBtn');
        if (btn) { publish(); }
      });
    }
  }
  function boot() {
    ensurePanel();
    refresh();
  }
  root.ACEPanelOperation = { version: MODULE_VERSION, refresh: refresh, activate: activate, printReport: printReport };
  if (documentRef.readyState === 'loading') { documentRef.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
}());
