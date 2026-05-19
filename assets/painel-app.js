(function () {
  'use strict';

  var root = window;

  var CONFIG = {
    API_URL: (window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.API_URL) || '',
    API_TOKEN: (window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.API_TOKEN) || '',
    MAP_CENTER: [-21.9325, -42.6075],
    MAP_ZOOM: 13
  };

  var STORAGE_KEYS = ['dengue_db_visits_v1'];
  var PROPERTY_KEYS = ['dengue_db_properties_v1'];
  var TUBITO_KEYS = ['dengue_db_tubitos_v1'];
  var AUTO_INTERVAL = 60000;
  var PROPERTY_COMPLEMENTS = ['Normal', 'Sequencia', 'Complemento'];
  var DEPOSITS = {
    A1: 'Caixa d\'água / tambor',
    A2: 'Pneu / entulho',
    B: 'Vaso / garrafa',
    C: 'Piscina / cisterna',
    D1: 'Lixo orgânico',
    D2: 'Obra / construção',
    E: 'Natural / bromélia'
  };

  var BAIRRO_CATALOG = [
    'Ave Maria',
    'Amizade',
    'Boa Ideia',
    'Botafogo',
    'Centro',
    'Todos os Santos',
    'Jardim Centenário',
    'Paraisópolis',
    'Progresso',
    'Santo Antônio',
    'Val Paraíso',
    'Vale do Sol',
    'Bacelar',
    'Almas do Mato',
    'Aurora',
    'Bom Pastor',
    'Estrada Nova',
    'Paquequer',
    'Porto Velho do Cunha (PVC)',
    'Barra de São Francisco',
    'Córrego da Prata',
    'Ilha dos Pombos (Light)',
    'Influência',
    'Emboque',
    'São Dimas',
    'Sol Maior',
    'Ulisses Lemgruber',
    "Caixa d'Água"
  ];
  var BAIRRO_ALIASES = {
    'ave maria': 'Ave Maria',
    'amizade': 'Amizade',
    'boa ideia': 'Boa Ideia',
    'botafogo': 'Botafogo',
    'centro': 'Centro',
    'todos os santos': 'Todos os Santos',
    'jardim centenario': 'Jardim Centenário',
    'jd centenario': 'Jardim Centenário',
    'paraisopolis': 'Paraisópolis',
    'progresso': 'Progresso',
    'santo antonio': 'Santo Antônio',
    'sto antonio': 'Santo Antônio',
    'val paraiso': 'Val Paraíso',
    'vale do sol': 'Vale do Sol',
    'bacelar': 'Bacelar',
    'almas do mato': 'Almas do Mato',
    'aurora': 'Aurora',
    'bom pastor': 'Bom Pastor',
    'estrada nova': 'Estrada Nova',
    'paquequer': 'Paquequer',
    'porto velho': 'Porto Velho do Cunha (PVC)',
    'porto velho do cunha': 'Porto Velho do Cunha (PVC)',
    'porto velho do cunha pvc': 'Porto Velho do Cunha (PVC)',
    'pvc': 'Porto Velho do Cunha (PVC)',
    'barra de sao francisco': 'Barra de São Francisco',
    'barra de s francisco': 'Barra de São Francisco',
    'corrego da prata': 'Córrego da Prata',
    'ilha dos pombos': 'Ilha dos Pombos (Light)',
    'ilha dos pombos light': 'Ilha dos Pombos (Light)',
    'light': 'Ilha dos Pombos (Light)',
    'influencia': 'Influência',
    'emboque': 'Emboque',
    'sao dimas': 'São Dimas',
    'sol maior': 'Sol Maior',
    'ulisses lemgruber': 'Ulisses Lemgruber',
    'caixa dagua': "Caixa d'Água",
    'caixa d agua': "Caixa d'Água"
  };

  var TERRITORY_SOURCE = window.ACE_TERRITORY_SOURCE || { polygons: [], points: [] };
  var TERRITORY_ALIASES = {
    'caixa dagua': 'caixa dagua',
    'caixa d agua': 'caixa dagua',
    'caixa d\'agua': 'caixa dagua',
    'jd centenario': 'jardim centenario',
    'jardim centenario': 'jardim centenario',
    'val paraiso': 'val paraiso',
    'vp': 'val paraiso',
    'sto antonio': 'santo antonio',
    'santo antonio': 'santo antonio',
    'porto velho': 'porto velho do cunha',
    'pvc': 'porto velho do cunha',
    'barra de s francisco': 'barra de sao francisco',
    'light': 'ilha dos pombos',
    'ilha dos pombos': 'ilha dos pombos',
    'ilha dos pombos light': 'ilha dos pombos',
    'morro do estado': 'ulisses lemgruber'
  };
  var TERRITORY_MICROAREA_LABELS = {
    'centro': 'M01 - Centro',
    'boa ideia': 'M02 - Boa Ideia',
    'botafogo': 'M03 - Botafogo',
    'caixa dagua': "M04 - Caixa d'Água",
    'jardim centenario': 'M05 - Jardim Centenário',
    'ulisses lemgruber': 'M06 - Ulisses Lemgruber',
    'progresso': 'M07 - Progresso',
    'val paraiso': 'M08 - Val Paraíso',
    'porto velho do cunha': 'PVC - Porto Velho do Cunha',
    'barra de sao francisco': 'BSF - Barra de São Francisco',
    'corrego da prata': 'CDP - Córrego da Prata',
    'ilha dos pombos': 'IDP - Ilha dos Pombos (Light)',
    'influencia': 'INF - Influência'
  };
  var MICROAREA_LABEL_BY_CODE = Object.keys(TERRITORY_MICROAREA_LABELS).reduce(function (map, key) {
    var label = TERRITORY_MICROAREA_LABELS[key];
    var match = String(label || '').match(/^(M\d{1,2}|PVC|BSF|CDP|IDP|INF)\b/i);
    if (match) {
      map[match[1].toUpperCase()] = label;
    }
    return map;
  }, {});

  var CANONICAL_TERRITORY = {
    bairroKey: 'caixa dagua',
    bairroLabel: "Caixa d'Água",
    microareaLabel: "M04 - Caixa d'Água"
  };

  var state = {
    source: 'local',
    allVisits: [],
    allProperties: [],
    allTubitos: [],
    allSupervisionRequests: [],
    allAgents: [],
    dashboardSummary: null,
    dashboardMeta: null,
    filteredVisits: [],
    filteredProperties: [],
    selectedVisitUid: '',
    map: null,
    mapLayers: [],
    mapBaseLayers: null,
    mapBaseMode: 'street',
    mapBaseControl: null,
    mapLegendControl: null,
    territoryPolygonLayers: [],
    territoryPointLayers: [],
    territoryPolygons: [],
    territoryPoints: [],
    territoryBounds: null,
    publicMap: null,
    publicMapLayers: [],
    mapToggles: {
      heat: true,
      visits: true,
      visitOpen: true,
      visitClosed: true,
      visitRecovered: true,
      agents: true,
      supervision: true,
      labPositive: true,
      ladderRequests: false,
      polygons: true,
      points: false
    },
    territoryMetricMode: 'combined',
    activePanelView: 'indicators',
    pendingMapRender: false,
    autoTimer: null,
    preserveMapView: false,
    selectedTerritory: null,
    hasAutoExpandedRange: false
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setBanner(text, kind) {
    var node = document.getElementById('panelStatus');
    if (!node) {
      return;
    }
    node.textContent = text;
    node.style.background = kind === 'danger' ? '#8e3131' :
      kind === 'warn' ? '#8d6915' :
      kind === 'accent' ? '#21563c' : '#183c2c';
  }

  function setChip(id, text, kind) {
    var chip = document.getElementById(id);
    if (!chip) {
      return false;
    }
    chip.textContent = text;
    chip.className = 'chip';
    if (kind === 'ok') {
      chip.classList.add('is-ok');
    } else if (kind === 'warn') {
      chip.classList.add('is-warn');
    } else if (kind === 'danger') {
      chip.classList.add('is-danger');
    } else if (kind === 'accent') {
      chip.classList.add('is-live');
    }
    return true;
  }

  function normalizeCode(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function repairTextEncoding(value) {
    return String(value || '')
      .replace(/ÃƒÂ/g, 'Ã')
      .replace(/Â/g, '')
      .replace(/Á/g, 'Á')
      .replace(/À/g, 'À')
      .replace(/Â/g, 'Â')
      .replace(/Ã/g, 'Ã')
      .replace(/É/g, 'É')
      .replace(/Ê/g, 'Ê')
      .replace(/Í/g, 'Í')
      .replace(/Ó/g, 'Ó')
      .replace(/Ô/g, 'Ô')
      .replace(/Õ/g, 'Õ')
      .replace(/Ú/g, 'Ú')
      .replace(/Ç/g, 'Ç')
      .replace(/á/g, 'á')
      .replace(/à/g, 'à')
      .replace(/â/g, 'â')
      .replace(/ã/g, 'ã')
      .replace(/é/g, 'é')
      .replace(/ê/g, 'ê')
      .replace(/í/g, 'í')
      .replace(/ó/g, 'ó')
      .replace(/ô/g, 'ô')
      .replace(/õ/g, 'õ')
      .replace(/ú/g, 'ú')
      .replace(/ç/g, 'ç');
  }

  function normalizeAreaCode(value) {
    return repairTextEncoding(value)
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*/g, '/');
  }

  function normalizeOperationMode(value) {
    var mode = String(value || '').trim().toUpperCase();
    if (mode === 'PE' || mode === 'P.E.' || mode === 'PONTO_ESTRATEGICO' || mode === 'PONTO ESTRATEGICO') {
      return 'PE';
    }
    if (mode === 'LIRA' || mode === 'LIRAA') {
      return 'LIRAA';
    }
    return 'VD';
  }

  function operationModeLabel(value) {
    var mode = normalizeOperationMode(value);
    if (mode === 'PE') {
      return 'P.E.';
    }
    if (mode === 'LIRAA') {
      return 'LIRAa';
    }
    return 'VD';
  }

  function getVisitOperationMode(visit) {
    visit = visit || {};
    return normalizeOperationMode(visit.operationMode || visit.operation_mode || visit.operational_mode || visit.origem_visita || 'VD');
  }

  function normalizeMicroareaLabel(value, bairro) {
    var raw = normalizeAreaCode(value || '');
    var territoryMapped;

    if (!raw) {
      return '';
    }

    raw = raw.replace(/^ma\s+/i, '');
    territoryMapped = getMicroareaLabelForTerritory(raw);

    if (territoryMapped) {
      return territoryMapped;
    }

    if (
      /^M04\b/i.test(raw) ||
      normalizeTerritoryCandidate(raw) === CANONICAL_TERRITORY.bairroKey
    ) {
      return CANONICAL_TERRITORY.microareaLabel;
    }

    var codeMatch = raw.toUpperCase().match(/^(M\d{1,2}|PVC|BSF|CDP|IDP|INF)\b/i);
    if (codeMatch) {
      return MICROAREA_LABEL_BY_CODE[codeMatch[1].toUpperCase()] || raw;
    }

    return '';
  }

  function normalizeQuarterDateValue(value) {
    var text = String(value || '').trim();
    var match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return '';
    }
    return String(Number(match[3])) + '/' + String(Number(match[2]));
  }

  function normalizePropertyComplement(value) {
    var label = String(value || '').trim().toLowerCase();
    if (!label) {
      return 'Normal';
    }
    if (label === 'normal') {
      return 'Normal';
    }
    if (label === 'sequencia' || label === 'sequência' || label === 'sequãªncia') {
      return 'Sequencia';
    }
    if (label === 'complemento') {
      return 'Complemento';
    }
    return '';
  }

  function normalizeLabel(value) {
    var label = repairTextEncoding(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['`´]/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return TERRITORY_ALIASES[label] || label;
  }

  function normalizeBairro(value) {
    var normalized = normalizeLabel(value || '');
    var stripped = normalizeTerritoryCandidate(value || '');

    if (normalized === CANONICAL_TERRITORY.bairroKey || stripped === CANONICAL_TERRITORY.bairroKey) {
      return CANONICAL_TERRITORY.bairroLabel;
    }

    return BAIRRO_ALIASES[normalized] || BAIRRO_ALIASES[stripped] || repairTextEncoding(value).trim();
  }

  function normalizeQuarteirao(value) {
    var raw = repairTextEncoding(value).trim();
    var dateValue = normalizeQuarterDateValue(raw);
    if (dateValue) {
      raw = dateValue;
    }
    return normalizeLabel(raw.replace(/^q\s*[-/]?\s*/i, ''));
  }

  function normalizeTerritoryCandidate(value) {
    return normalizeLabel(repairTextEncoding(value).replace(/^[A-Z0-9]{1,8}\s*-\s*/i, ''));
  }

  function getMicroareaLabelForTerritory(value) {
    var normalized = normalizeTerritoryCandidate(value);
    return TERRITORY_MICROAREA_LABELS[normalized] || '';
  }

  function getFeatureTerritoryName(feature) {
    if (!feature) {
      return '';
    }
    return repairTextEncoding(feature.folder || feature.name || '').trim();
  }

  function getCoordinatesBounds(coords) {
    if (!Array.isArray(coords) || !coords.length) {
      return null;
    }
    var bounds = {
      minLat: Infinity,
      maxLat: -Infinity,
      minLng: Infinity,
      maxLng: -Infinity
    };
    coords.forEach(function (coord) {
      var lat = Number(coord[0]);
      var lng = Number(coord[1]);
      if (!isFinite(lat) || !isFinite(lng)) {
        return;
      }
      bounds.minLat = Math.min(bounds.minLat, lat);
      bounds.maxLat = Math.max(bounds.maxLat, lat);
      bounds.minLng = Math.min(bounds.minLng, lng);
      bounds.maxLng = Math.max(bounds.maxLng, lng);
    });
    if (!isFinite(bounds.minLat) || !isFinite(bounds.minLng)) {
      return null;
    }
    bounds.latSpan = bounds.maxLat - bounds.minLat;
    bounds.lngSpan = bounds.maxLng - bounds.minLng;
    return bounds;
  }

  function isUsefulTerritoryPolygon(feature) {
    var bounds = getCoordinatesBounds(feature.coordinates);
    var path = Array.isArray(feature.path) ? feature.path : [];
    var folderKey = normalizeLabel(feature.folder);
    var nameKey = normalizeLabel(feature.name);
    var isMacroCarmo = feature.territoryKey === 'carmo' ||
      folderKey === 'carmo' ||
      nameKey === 'carmo' ||
      (path.length <= 1 && (folderKey === 'carmo' || nameKey === 'carmo'));
    if (!bounds || feature.coordinates.length <= 2 || isMacroCarmo) {
      return false;
    }
    return bounds.latSpan <= 0.08 && bounds.lngSpan <= 0.08;
  }

  function getPolygonCentroid(coords) {
    if (!Array.isArray(coords) || !coords.length) {
      return null;
    }
    var latSum = 0;
    var lngSum = 0;
    var count = 0;
    coords.forEach(function (coord) {
      var lat = Number(coord[0]);
      var lng = Number(coord[1]);
      if (!isFinite(lat) || !isFinite(lng)) {
        return;
      }
      latSum += lat;
      lngSum += lng;
      count += 1;
    });
    if (!count) {
      return null;
    }
    return [latSum / count, lngSum / count];
  }

  function getTerritoryBounds() {
    if (state.territoryBounds) {
      return state.territoryBounds;
    }
    var allCoords = [];
    state.territoryPolygons.forEach(function (feature) {
      feature.coordinates.forEach(function (coord) {
        allCoords.push(coord);
      });
    });
    state.territoryPoints.forEach(function (feature) {
      if (Array.isArray(feature.coordinates) && feature.coordinates.length === 2) {
        allCoords.push(feature.coordinates);
      }
    });
    state.territoryBounds = getCoordinatesBounds(allCoords);
    return state.territoryBounds;
  }

  function isCoordinateInsideTerritory(lat, lng) {
    var bounds = getTerritoryBounds();
    var margin = 0.02;
    if (!bounds || !isFinite(lat) || !isFinite(lng)) {
      return false;
    }
    return lat >= (bounds.minLat - margin) &&
      lat <= (bounds.maxLat + margin) &&
      lng >= (bounds.minLng - margin) &&
      lng <= (bounds.maxLng + margin);
  }

  function normalizeCoord(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    var num = Number(String(value).replace(',', '.'));
    return isFinite(num) ? num : null;
  }

  function isValidLatLng(lat, lng) {
    return lat !== null && lng !== null &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0);
  }

  function resolveVisitGpsFields(visit) {
    var directLat = normalizeCoord(visit.gps_lat || (visit.gps && visit.gps.lat));
    var directLng = normalizeCoord(visit.gps_lng || (visit.gps && visit.gps.lng));
    var shiftedLat = normalizeCoord(visit.gps_acc);
    var shiftedLng = normalizeCoord(visit.gps_territory);

    if (isValidLatLng(directLat, directLng)) {
      return {
        lat: directLat,
        lng: directLng,
        acc: Number(visit.gps_acc || (visit.gps && visit.gps.accuracy) || 0) || 0
      };
    }

    if (isValidLatLng(shiftedLat, shiftedLng) && isCoordinateInsideTerritory(shiftedLat, shiftedLng)) {
      return { lat: shiftedLat, lng: shiftedLng, acc: 0 };
    }

    return { lat: null, lng: null, acc: 0 };
  }

  function sanitizeExternalUrl(value) {
    var raw = String(value || '').trim();
    if (!raw) {
      return '';
    }
    return /^https?:\/\//i.test(raw) ? raw : '';
  }

  function getHeatVisual(weight) {
    if (weight >= 6) {
      return { stroke: '#991b1b', fill: '#dc2626', opacity: Math.min(0.58, 0.24 + (weight * 0.04)) };
    }
    if (weight >= 3) {
      return { stroke: '#b91c1c', fill: '#ef4444', opacity: Math.min(0.44, 0.17 + (weight * 0.035)) };
    }
    return { stroke: '#dc2626', fill: '#fecaca', opacity: Math.min(0.30, 0.12 + (weight * 0.03)) };
  }

  function getVisitHeatTone(visit) {
    var hasFocus = visit.foco === 'Sim' || (visit.focusCount || 0) > 0 || (visit.depositFocusCount || 0) > 0;
    if (hasFocus) {
      return {
        key: 'high',
        markerFill: '#c34747',
        markerStroke: '#8e1424'
      };
    }
    if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
      return {
        key: 'medium',
        markerFill: '#c78615',
        markerStroke: '#8d5b08'
      };
    }
    return {
      key: 'low',
      markerFill: '#2f7a52',
      markerStroke: '#1d5e3f'
    };
  }

  function getVisitStatusTone(visit) {
    var hasFocus = visitHasFocus(visit);
    var operationMode = getVisitOperationMode(visit);
    var focusFill = '#dc2626';
    var focusStroke = '#991b1b';

    if (hasFocus) {
      return {
        key: visit.situacao === 'Fechado' || visit.situacao === 'Recusa' ? 'visitClosed' : (visit.situacao === 'Recuperado' ? 'visitRecovered' : 'visitOpen'),
        label: (operationMode === 'PE' ? 'P.E. com foco' : (operationMode === 'LIRAA' ? 'LIRAa com foco' : 'Visita com foco')),
        markerFill: focusFill,
        markerStroke: focusStroke
      };
    }

    if (operationMode === 'PE') {
      return {
        key: visit.situacao === 'Fechado' || visit.situacao === 'Recusa' ? 'visitClosed' : 'visitOpen',
        label: 'P.E. - ponto estrategico',
        markerFill: '#f97316',
        markerStroke: '#9a3412'
      };
    }

    if (operationMode === 'LIRAA') {
      return {
        key: visit.situacao === 'Fechado' || visit.situacao === 'Recusa' ? 'visitClosed' : 'visitOpen',
        label: 'LIRAa',
        markerFill: '#8b5cf6',
        markerStroke: '#5b21b6'
      };
    }

    if (visit.situacao === 'Recuperado') {
      return {
        key: 'visitRecovered',
        label: 'Recuperado',
        markerFill: '#16a34a',
        markerStroke: '#166534'
      };
    }
    if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
      return {
        key: 'visitClosed',
        label: 'Fechado/recusado',
        markerFill: '#f59e0b',
        markerStroke: '#92400e'
      };
    }
    return {
      key: 'visitOpen',
      label: 'Aberto/visitado',
      markerFill: '#2563eb',
      markerStroke: '#1e40af'
    };
  }

  function getTerritoryMetricMode() {
    return state.territoryMetricMode || 'combined';
  }

  function getTerritoryMetricMeta(mode) {
    if (mode === 'focus') {
      return { label: 'focos', shortLabel: 'Focos', unit: ' foco(s)', attention: 1, critical: 3 };
    }
    if (mode === 'depositFocus') {
      return { label: 'depósitos com foco', shortLabel: 'Depósitos com foco', unit: ' depósito(s)', attention: 1, critical: 3 };
    }
    if (mode === 'infestation') {
      return { label: 'taxa de infestação', shortLabel: 'Taxa de infestação', unit: '%', attention: 10, critical: 30 };
    }
    return { label: 'criticidade combinada', shortLabel: 'Combinação territorial', unit: ' ponto(s)', attention: 2, critical: 5 };
  }

  function getTerritoryMetricValue(metrics, mode) {
    if (!metrics) {
      return 0;
    }
    if (mode === 'focus') {
      return Number(metrics.focos || 0) || 0;
    }
    if (mode === 'depositFocus') {
      return Number(metrics.depositosComFoco || 0) || 0;
    }
    if (mode === 'infestation') {
      return Number(metrics.taxaInfestacao || 0) || 0;
    }
    return Number(metrics.focos || 0) + Number(metrics.depositosComFoco || 0) + Number(metrics.pendencias || 0);
  }

  function getTerritoryMetricIntensity(value, mode) {
    if (mode === 'focus') {
      return Math.max(0, Math.min(1, value / 4));
    }
    if (mode === 'depositFocus') {
      return Math.max(0, Math.min(1, value / 4));
    }
    if (mode === 'infestation') {
      return Math.max(0, Math.min(1, value / 40));
    }
    return Math.max(0, Math.min(1, value / 8));
  }

  function getTerritoryRiskLevelForValue(value, mode) {
    var meta = getTerritoryMetricMeta(mode);
    if (value >= meta.critical) {
      return 'critico';
    }
    if (value >= meta.attention) {
      return 'atencao';
    }
    return 'baixo';
  }

  function formatTerritoryMetricValue(value, mode) {
    if (mode === 'infestation') {
      return Number(value || 0).toFixed(1).replace('.', ',') + '%';
    }
    return String(Math.round(Number(value || 0)));
  }

  function getHeatToneKeyForMetrics(metrics, mode) {
    var level = getTerritoryRiskLevelForValue(getTerritoryMetricValue(metrics, mode), mode);
    if (level === 'critico') {
      return 'high';
    }
    if (level === 'atencao') {
      return 'medium';
    }
    return 'low';
  }

  function getHeatTonePalette(toneKey) {
    if (toneKey === 'high') {
      return {
        gradient: {
          0.18: 'rgba(254,202,202,0.18)',
          0.45: 'rgba(248,113,113,0.42)',
          0.72: 'rgba(220,38,38,0.68)',
          1: 'rgba(127,29,29,0.92)'
        },
        circleStroke: '#991b1b',
        circleFill: '#dc2626',
        circleOpacity: 0.34
      };
    }
    if (toneKey === 'medium') {
      return {
        gradient: {
          0.2: 'rgba(254,226,226,0.16)',
          0.58: 'rgba(248,113,113,0.34)',
          1: 'rgba(185,28,28,0.72)'
        },
        circleStroke: '#b91c1c',
        circleFill: '#ef4444',
        circleOpacity: 0.26
      };
    }
    return {
      gradient: {
        0.2: 'rgba(255,241,242,0.14)',
        0.58: 'rgba(254,202,202,0.30)',
        1: 'rgba(239,68,68,0.58)'
      },
      circleStroke: '#dc2626',
      circleFill: '#fecaca',
      circleOpacity: 0.20
    };
  }

  function createHeatBuckets() {
    return { low: [], medium: [], high: [] };
  }

  function addToneHeatPoint(heatBuckets, toneKey, lat, lng, intensity) {
    if (!heatBuckets[toneKey]) {
      heatBuckets[toneKey] = [];
    }
    heatBuckets[toneKey].push([lat, lng, intensity]);
  }

  function renderToneHeatLayers(map, layerStore, heatBuckets) {
    var toneOrder = ['low', 'medium', 'high'];
    var added = false;
    if (window.L && typeof L.heatLayer === 'function') {
      toneOrder.forEach(function (toneKey) {
        var points = heatBuckets[toneKey] || [];
        if (!points.length) {
          return;
        }
        var palette = getHeatTonePalette(toneKey);
        var heatLayer = L.heatLayer(points, {
          radius: toneKey === 'low' ? 30 : 34,
          blur: 26,
          maxZoom: 16,
          minOpacity: toneKey === 'low' ? 0.18 : 0.24,
          gradient: palette.gradient
        }).addTo(map);
        layerStore.push(heatLayer);
        added = true;
      });
      return added;
    }
    return false;
  }

  function renderToneHeatFallback(map, layerStore, heatBuckets) {
    ['low', 'medium', 'high'].forEach(function (toneKey) {
      var grouped = {};
      var palette = getHeatTonePalette(toneKey);
      (heatBuckets[toneKey] || []).forEach(function (point) {
        var key = point[0].toFixed(3) + '|' + point[1].toFixed(3);
        if (!grouped[key]) {
          grouped[key] = { lat: point[0], lng: point[1], weight: 0 };
        }
        grouped[key].weight += Number(point[2] || 0);
      });
      Object.keys(grouped).forEach(function (key) {
        var item = grouped[key];
        var circle = L.circle([item.lat, item.lng], {
          radius: 90 + (item.weight * 20),
          color: palette.circleStroke,
          weight: 1,
          fillColor: palette.circleFill,
          fillOpacity: Math.min(0.62, palette.circleOpacity + (item.weight * 0.02))
        }).addTo(map);
        circle.bindPopup('Mapa de calor: ' + item.weight.toFixed(1).replace('.', ',') + ' ocorrencia(s) ponderadas.');
        layerStore.push(circle);
      });
    });
  }

  function toLocalIsoDate(date) {
    if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime())) {
      return '';
    }
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function normalizeDateOnly(value) {
    if (!value) {
      return '';
    }
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return toLocalIsoDate(value);
    }
    var text = String(value).trim();
    var isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      return isoMatch[1];
    }
    var brMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      return brMatch[3] + '-' + brMatch[2] + '-' + brMatch[1];
    }
    return text;
  }

  function normalizeTimeOnly(value) {
    if (!value) {
      return '';
    }
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return String(value.getHours()).padStart(2, '0') + ':' + String(value.getMinutes()).padStart(2, '0');
    }
    var text = String(value).trim();
    var fullIsoMatch = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/);
    if (fullIsoMatch) {
      var date = new Date(text);
      if (!isNaN(date.getTime())) {
        return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
      }
      return fullIsoMatch[2];
    }
    var timeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return String(timeMatch[1]).padStart(2, '0') + ':' + timeMatch[2];
    }
    return text.slice(0, 5);
  }

  function getDateDaysAgo(daysAgo) {
    var date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - Number(daysAgo || 0));
    return toLocalIsoDate(date);
  }

  function buildDashboardEndParam(value) {
    return value ? value + 'T23:59:59.999Z' : '';
  }

  function normalizeStatus(value) {
    var label = String(value || '').trim().toLowerCase();
    if (label.indexOf('fechado') > -1) {
      return 'Fechado';
    }
    if (label.indexOf('recuperado') > -1) {
      return 'Recuperado';
    }
    if (label.indexOf('recusa') > -1) {
      return 'Recusa';
    }
    return 'Visitado';
  }

  function normalizeVisit(visit) {
    var deposits = String(visit.deposits || '').trim();
    var focusBreakdown = String(visit.deposit_focus_breakdown || visit.depositFocusBreakdown || '').trim();
    var gpsFields = resolveVisitGpsFields(visit);
    var rawGpsTerritory = String(visit.gps_territory || visit.gpsTerritory || '').trim();
    var gpsTerritory = normalizeCoord(rawGpsTerritory) !== null
      ? String(visit.quality_flags || visit.qualityFlags || '').trim()
      : rawGpsTerritory;
    return {
      uid: String(visit.uid || '').trim(),
      data: normalizeDateOnly(visit.data || ''),
      hora: normalizeTimeOnly(visit.hora || ''),
      agente: String(visit.agente || '').trim(),
      matricula: String(visit.matricula || '').trim(),
      bairro: normalizeBairro(visit.bairro || ''),
      microarea: normalizeMicroareaLabel(visit.microarea || '', visit.bairro || ''),
      quarteirao: normalizeAreaCode(visit.quarteirao || ''),
      logradouro: String(visit.logradouro || '').trim(),
      numero: String(visit.numero || '').trim(),
      morador: String(visit.morador || '').trim(),
      telefone: String(visit.telefone || '').trim(),
      property_uid: String(visit.property_uid || visit.propertyUid || '').trim(),
      tipo: String(visit.tipo || '').trim(),
      situacao: normalizeStatus(visit.situacao || 'Visitado'),
      closedReason: String(visit.closed_reason || visit.motivo_fechado || visit.closedReason || '').trim(),
      foco: String(visit.foco || visit.focusFound || '').trim() || 'Não',
      focusCount: Number(visit.focus_count || visit.focusQty || 0) || 0,
      depositCount: Number(visit.deposit_count || visit.depositTotal || 0) || 0,
      deposits: deposits,
      depositFocusCount: Number(visit.deposit_focus_count || visit.depositFocusTotal || 0) || 0,
      depositFocusBreakdown: focusBreakdown,
      depositTreatmentBreakdown: String(visit.deposit_treatment_breakdown || visit.depositTreatmentBreakdown || '').trim(),
      depositTreatmentCount: Number(visit.deposit_treatment_count || visit.depositTreatmentTotal || 0) || 0,
      larvicida: String(visit.larvicida || '').trim(),
      larvicidaQty: Number(visit.larvicida_qtd || visit.larvicidaQty || 0) || 0,
      waterAccess: String(visit.acessou_caixa_agua || visit.waterAccess || '').trim(),
      waterAccessReason: String(visit.motivo_caixa_agua || visit.water_access_reason || visit.waterAccessReason || '').trim(),
      ladderSupportRequested: String(visit.solicita_escada || visit.ladder_support_requested || visit.ladderSupportRequested || '').trim(),
      ladderSupportNoReason: String(visit.motivo_nao_solicitou_escada || visit.ladder_support_no_reason || visit.ladderSupportNoReason || '').trim(),
      ladderSupportStatus: String(visit.ladder_support_status || visit.ladderSupportStatus || '').trim(),
      waterTankCondition: String(visit.situacao_caixa_agua || visit.water_tank_condition || visit.waterTankCondition || '').trim(),
      waterTreatment: String(visit.tratamento_caixa_agua || visit.water_tank_treatment || visit.waterTreatment || '').trim(),
      tubitosQty: Number(visit.tubitos_qtd || visit.tubitosQty || 0) || 0,
      laboratorioStatus: String(visit.laboratorio_status || visit.laboratorioStatus || '').trim(),
      laboratorioResultado: String(visit.laboratorio_resultado || visit.laboratorioResultado || '').trim(),
      laboratorioPositivoAedes: String(visit.laboratorio_positivo_aedes || visit.laboratorioPositivoAedes || '').trim(),
      laboratorioAtualizadoEm: String(visit.laboratorio_atualizado_em || visit.laboratorioAtualizadoEm || '').trim(),
      operationMode: normalizeOperationMode(visit.operation_mode || visit.operational_mode || visit.origem_visita || visit.operationMode || 'VD'),
      peTipoLocal: String(visit.pe_tipo_local || visit.peTipoLocal || '').trim(),
      peNomeLocal: String(visit.pe_nome_local || visit.peNomeLocal || '').trim(),
      peObservacao: String(visit.pe_observacao || visit.peObservacao || '').trim(),
      liraaCiclo: String(visit.liraa_ciclo || visit.liraaCiclo || '').trim(),
      liraaPlanoId: String(visit.liraa_plano_id || visit.liraaPlanoId || '').trim(),
      liraaQuarteiraoSorteado: String(visit.liraa_quarteirao_sorteado || visit.liraaQuarteiraoSorteado || '').trim(),
      liraaUnitKey: String(visit.liraa_unit_key || visit.liraaUnitKey || '').trim(),
      liraaColeta: String(visit.liraa_coleta || visit.liraaColeta || '').trim(),
      photoUrl: String(visit.photo_url || visit.photoUrl || visit.photo_data_url || visit.photoDataUrl || '').trim(),
      gps_lat: gpsFields.lat,
      gps_lng: gpsFields.lng,
      gps_acc: gpsFields.acc,
      routeUrl: sanitizeExternalUrl(visit.route_url || visit.routeUrl || ''),
      pdfUrl: sanitizeExternalUrl(visit.relatorio_pdf_url || visit.pdfUrl || ''),
      gpsTerritory: gpsTerritory,
      gpsQuarteirao: String(visit.gps_quarteirao || visit.gpsQuarteirao || '').trim(),
      qualityFlags: String(visit.quality_flags || visit.qualityFlags || '').trim(),
      obs: String(visit.obs || '').trim()
    };
  }

  function normalizeTubito(row) {
    row = row || {};
    return {
      uid: String(row.uid || '').trim(),
      numeroTubito: String(row.numero_tubito || row.numeroTubito || '').trim(),
      visit_uid: String(row.visit_uid || row.visitUid || '').trim(),
      property_uid: String(row.property_uid || row.propertyUid || '').trim(),
      dataColeta: normalizeDateOnly(row.data_coleta || row.dataColeta || ''),
      horaColeta: normalizeTimeOnly(row.hora_coleta || row.horaColeta || ''),
      agente: String(row.agente || '').trim(),
      matricula: String(row.matricula || '').trim(),
      microarea: normalizeMicroareaLabel(row.microarea || '', row.bairro || ''),
      quarteirao: normalizeAreaCode(row.quarteirao || ''),
      bairro: normalizeBairro(row.bairro || ''),
      logradouro: String(row.logradouro || '').trim(),
      numero: String(row.numero || '').trim(),
      depositoCodigo: String(row.deposito_codigo || row.depositoCodigo || '').trim().toUpperCase(),
      origemVisita: normalizeOperationMode(row.origem_visita || row.origemVisita || row.operation_mode || row.operationMode || 'VD'),
      operationMode: normalizeOperationMode(row.operation_mode || row.operationMode || row.origem_visita || row.origemVisita || 'VD'),
      peTipoLocal: String(row.pe_tipo_local || row.peTipoLocal || '').trim(),
      peNomeLocal: String(row.pe_nome_local || row.peNomeLocal || '').trim(),
      liraaCiclo: String(row.liraa_ciclo || row.liraaCiclo || '').trim(),
      statusLaboratorio: String(row.status_laboratorio || row.statusLaboratorio || 'Pendente').trim(),
      resultadoLaboratorio: String(row.resultado_laboratorio || row.resultadoLaboratorio || '').trim(),
      especie: String(row.especie || '').trim(),
      positivoAedes: String(row.positivo_aedes || row.positivoAedes || '').trim(),
      analisadoPor: String(row.analisado_por || row.analisadoPor || '').trim(),
      analisadoEm: String(row.analisado_em || row.analisadoEm || '').trim(),
      observacaoLaboratorio: String(row.observacao_laboratorio || row.observacaoLaboratorio || '').trim(),
      updatedAt: String(row.updatedAt || row.updated_at || '').trim()
    };
  }

  function isAedesPositiveTubito(row) {
    var result = normalizeLabel(row && row.resultadoLaboratorio || '');
    var species = normalizeLabel(row && row.especie || '');
    var explicit = normalizeLabel(row && row.positivoAedes || '');
    return explicit === 'sim' || (result.indexOf('positivo') > -1 && species.indexOf('aedes') > -1);
  }

  function normalizeProperty(property) {
    var rawComplemento = String(property.complemento || property.logradouroModo || '').trim();
    var normalizedComplemento = normalizePropertyComplement(rawComplemento);
    var referenceValue = String(property.referencia || property.ref || '').trim();
    if (!referenceValue && rawComplemento && !normalizedComplemento) {
      referenceValue = rawComplemento;
    }
    return {
      uid: String(property.uid || '').trim(),
      morador: String(property.morador || '').trim(),
      telefone: String(property.telefone || '').trim(),
      microarea: normalizeMicroareaLabel(property.microarea || '', property.bairro || ''),
      quarteirao: normalizeAreaCode(property.quarteirao || ''),
      bairro: normalizeBairro(property.bairro || ''),
      logradouro: String(property.logradouro || '').trim(),
      numero: String(property.numero || '').trim(),
      complemento: normalizedComplemento || 'Normal',
      referencia: referenceValue,
      tipo: String(property.tipo || '').trim(),
      createdByName: String(property.createdByName || property.created_by_name || property.created_by || '').trim(),
      createdByMatricula: String(property.createdByMatricula || property.created_by_matricula || '').trim(),
      createdAt: String(property.createdAt || property.created_at || '').trim()
    };
  }

  function normalizeAgentRow(agent) {
    var row = agent || {};
    return {
      uid: String(row.uid || '').trim(),
      nome: repairTextEncoding(String(row.nome || row.name || '').trim()),
      matricula: String(row.matricula || row.code || '').trim(),
      role: repairTextEncoding(String(row.role || '').trim()),
      baseMicroarea: repairTextEncoding(String(row.base_microarea || row.baseMicroarea || '').trim()),
      baseRegion: repairTextEncoding(String(row.base_region || row.baseRegion || '').trim()),
      updatedAt: String(row.updatedAt || row.updated_at || '').trim()
    };
  }

  function getCloudPanelAgents() {
    var bundle = window.ACE_PANEL_CLOUD_BUNDLE || null;
    return bundle && Array.isArray(bundle.agents) ? bundle.agents.map(normalizeAgentRow) : [];
  }

  function getRegisteredAgentNames() {
    return (state.allAgents || []).map(function (agent) {
      return String(agent && agent.nome || '').trim();
    }).filter(function (name) {
      return !!name;
    });
  }

  function hasRegisteredAgentRoster() {
    return getRegisteredAgentNames().length > 0;
  }

  function isRegisteredAgentName(name) {
    var normalized = normalizeLabel(name || '');
    if (!normalized || !hasRegisteredAgentRoster()) {
      return !hasRegisteredAgentRoster();
    }
    return getRegisteredAgentNames().some(function (agentName) {
      return normalizeLabel(agentName) === normalized;
    });
  }

  function getAgentFilterNames() {
    var registered = getRegisteredAgentNames();
    if (registered.length) {
      return registered;
    }
    return state.allVisits.map(function (visit) {
      return visit.agente;
    });
  }

  function getPropertyReferenceText(property) {
    if (!property) {
      return 'Sem referência complementar';
    }
    if (property.referencia) {
      return property.referencia;
    }
    if (property.complemento && property.complemento !== 'Normal') {
      return 'Cadastro ' + property.complemento;
    }
    return 'Sem referência complementar';
  }

  function hydrateTerritoryData() {
    if (state.territoryPolygons.length || state.territoryPoints.length) {
      return;
    }

    state.territoryPolygons = (TERRITORY_SOURCE.polygons || []).map(function (feature) {
      var territoryName = getFeatureTerritoryName(feature);
      return {
        id: String(feature.id || '').trim(),
        folder: String(feature.folder || '').trim(),
        path: Array.isArray(feature.path) ? feature.path.slice() : [],
        name: String(feature.name || '').trim(),
        originalName: String(feature.originalName || '').trim(),
        description: String(feature.description || '').trim(),
        territoryType: String(feature.territoryType || '').trim(),
        coordinates: Array.isArray(feature.coordinates) ? feature.coordinates : [],
        territoryName: territoryName,
        territoryKey: normalizeLabel(territoryName),
        quarteiraoKey: normalizeQuarteirao(feature.name),
        featureType: 'polygon'
      };
    }).filter(isUsefulTerritoryPolygon);

    state.territoryPoints = (TERRITORY_SOURCE.points || []).map(function (feature) {
      var territoryName = getFeatureTerritoryName(feature);
      return {
        id: String(feature.id || '').trim(),
        folder: String(feature.folder || '').trim(),
        path: Array.isArray(feature.path) ? feature.path.slice() : [],
        name: String(feature.name || '').trim(),
        originalName: String(feature.originalName || '').trim(),
        description: String(feature.description || '').trim(),
        territoryType: String(feature.territoryType || '').trim(),
        coordinates: Array.isArray(feature.coordinates) ? feature.coordinates : [],
        territoryName: territoryName,
        territoryKey: normalizeLabel(territoryName),
        quarteiraoKey: normalizeQuarteirao(feature.name),
        featureType: 'point'
      };
    }).filter(function (feature) {
      return feature.coordinates.length === 2;
    });
    state.territoryBounds = null;
  }

  function loadLocalVisits() {
    var rows = [];
    STORAGE_KEYS.some(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          rows = JSON.parse(raw);
          return true;
        }
      } catch (err) {
        rows = [];
      }
      return false;
    });
    return Array.isArray(rows) ? rows.map(normalizeVisit) : [];
  }

  function loadLocalProperties() {
    var rows = [];
    PROPERTY_KEYS.some(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          rows = JSON.parse(raw);
          return true;
        }
      } catch (err) {
        rows = [];
      }
      return false;
    });
    return Array.isArray(rows) ? rows.map(normalizeProperty) : [];
  }

  function loadLocalTubitos() {
    var rows = [];
    TUBITO_KEYS.some(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          rows = JSON.parse(raw);
          return true;
        }
      } catch (error) {}
      return false;
    });
    return Array.isArray(rows) ? rows.map(normalizeTubito) : [];
  }


  function loadLocalSupervisionRequests() {
    try {
      var raw = localStorage.getItem('dengue_db_supervision_requests_v1') || localStorage.getItem('ace_supervision_requests_v1');
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows.map(normalizeSupervisionRequest) : [];
    } catch (error) {
      return [];
    }
  }

  function loadLocalBundle() {
    if (window.ACEIndexedStore && typeof window.ACEIndexedStore.hydrate === 'function') {
      return window.ACEIndexedStore.hydrate({
        visits: {
          storageKey: STORAGE_KEYS[0],
          legacyKeys: STORAGE_KEYS,
          fallback: []
        },
        properties: {
          storageKey: PROPERTY_KEYS[0],
          legacyKeys: PROPERTY_KEYS,
          fallback: []
        },
        tubitos: {
          storageKey: TUBITO_KEYS[0],
          legacyKeys: TUBITO_KEYS,
          fallback: []
        }
      }).then(function (cache) {
        return {
          visits: Array.isArray(cache.visits) ? cache.visits.map(normalizeVisit) : [],
          properties: Array.isArray(cache.properties) ? cache.properties.map(normalizeProperty) : [],
          tubitos: Array.isArray(cache.tubitos) ? cache.tubitos.map(normalizeTubito) : [],
          supervisionRequests: loadLocalSupervisionRequests(),
          agents: Array.isArray(cache.agents) ? cache.agents.map(normalizeAgentRow) : getCloudPanelAgents(),
          summary: null,
          meta: null
        };
      }).catch(function () {
        return {
          visits: loadLocalVisits(),
          properties: loadLocalProperties(),
          tubitos: loadLocalTubitos(),
          supervisionRequests: loadLocalSupervisionRequests(),
          agents: getCloudPanelAgents(),
          summary: null,
          meta: null
        };
      });
    }
    return Promise.resolve({
      visits: loadLocalVisits(),
      properties: loadLocalProperties(),
      tubitos: loadLocalTubitos(),
      agents: getCloudPanelAgents(),
      summary: null,
      meta: null
    });
  }

  function isApiConfigured() {
    return CONFIG.API_URL && CONFIG.API_URL !== 'COLE_AQUI_A_URL_DO_WEB_APP';
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) { return; }
        done = true;
        reject(new Error('timeout'));
      }, timeoutMs || 12000);
      fetch(url, options).then(function (response) {
        if (done) { return; }
        done = true;
        clearTimeout(timer);
        resolve(response);
      }).catch(function (error) {
        if (done) { return; }
        done = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function fetchApiVisits(start, end) {
    if (!isApiConfigured()) {
      return Promise.resolve(null);
    }
    var apiEnd = buildDashboardEndParam(end);
    var token = String(CONFIG.API_TOKEN || '').trim();
    var panelSession = root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getSessionInfo === 'function'
      ? root.ACEPanelCloudSync.getSessionInfo()
      : null;
    var sessionToken = String(panelSession && panelSession.sessionToken || '').trim();
    var bairro = document.getElementById('bairroFilter') ? document.getElementById('bairroFilter').value : '';
    var microarea = document.getElementById('microareaFilter') ? document.getElementById('microareaFilter').value : '';
    var quarteirao = document.getElementById('quarteiraoFilter') ? document.getElementById('quarteiraoFilter').value : '';
    var logradouro = document.getElementById('logradouroFilter') ? document.getElementById('logradouroFilter').value : '';
    var agent = document.getElementById('agentFilter') ? document.getElementById('agentFilter').value : '';
    var situacao = document.getElementById('situacaoFilter') ? document.getElementById('situacaoFilter').value : '';
    var foco = document.getElementById('focoFilter') ? document.getElementById('focoFilter').value : '';
    var gps = document.getElementById('gpsFilter') ? document.getElementById('gpsFilter').value : '';
    var operation = document.getElementById('operationFilter') ? document.getElementById('operationFilter').value : '';
    var search = document.getElementById('searchFilter') ? String(document.getElementById('searchFilter').value || '').trim() : '';
    var payload = {
      action: 'dashboard_range',
      start: start,
      end: apiEnd,
      page: 1,
      page_size: 5000,
      sort: 'desc',
      include_properties: 1,
      token: token,
      api_token: token,
      auth_token: sessionToken || token,
      session_token: sessionToken,
      bairro: bairro,
      microarea: microarea,
      quarteirao: quarteirao,
      logradouro: logradouro,
      agent: agent,
      situacao: situacao,
      foco: foco,
      gps: gps,
      operation_mode: operation,
      search: search,
      t: Date.now()
    };

    function normalizeDashboardPayload(apiPayload) {
      if (apiPayload && apiPayload.ok === false) {
        throw new Error(apiPayload.error || 'A API do painel retornou erro.');
      }
      var data = apiPayload && apiPayload.data ? apiPayload.data : apiPayload || {};
      if (data && data.ok === false) {
        throw new Error(data.error || 'A API do painel retornou erro.');
      }
      var rows = Array.isArray(data.visits) ? data.visits : (Array.isArray(apiPayload && apiPayload.visits) ? apiPayload.visits : []);
      var properties = Array.isArray(data.properties) ? data.properties : (Array.isArray(apiPayload && apiPayload.properties) ? apiPayload.properties : []);
      var agents = Array.isArray(data.agents) ? data.agents : (Array.isArray(apiPayload && apiPayload.agents) ? apiPayload.agents : getCloudPanelAgents());
      var tubitos = Array.isArray(data.tubitos) ? data.tubitos : (Array.isArray(apiPayload && apiPayload.tubitos) ? apiPayload.tubitos : []);
      var supervisionRequests = Array.isArray(data.supervision_requests) ? data.supervision_requests : (Array.isArray(apiPayload && apiPayload.supervision_requests) ? apiPayload.supervision_requests : []);
      var summary = data.summary || (apiPayload && apiPayload.summary) || null;
      var meta = data.meta || (apiPayload && apiPayload.meta) || null;
      return {
        visits: (rows || []).map(normalizeVisit),
        properties: (properties || []).map(normalizeProperty),
        tubitos: (tubitos || []).map(normalizeTubito),
        supervisionRequests: (supervisionRequests || []).map(normalizeSupervisionRequest),
        agents: (agents || []).map(normalizeAgentRow),
        summary: summary,
        meta: meta
      };
    }

    return fetchWithTimeout(CONFIG.API_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    }, 12000).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao carregar painel');
      }
      return response.json();
    }).then(normalizeDashboardPayload);
  }


  function normalizeSupervisionRequest(row) {
    row = row || {};
    return {
      uid: String(row.uid || row.id || '').trim(),
      data: normalizeDateOnly(row.data || row.date || ''),
      hora: normalizeTimeOnly(row.hora || row.time || ''),
      agente: String(row.agente || row.agent || row.nome_agente || '').trim(),
      matricula: String(row.matricula || row.agent_code || '').trim(),
      operationMode: normalizeOperationMode(row.operation_mode || row.operational_mode || row.origem_visita || row.operationMode || 'VD'),
      mensagem: String(row.mensagem || row.message || 'Agente solicitou supervisão em campo.').trim(),
      status: String(row.status || 'Aberta').trim(),
      microarea: normalizeMicroareaLabel(row.gps_territory || row.gpsTerritory || row.microarea || '', row.bairro || ''),
      quarteirao: normalizeAreaCode(row.gps_quarteirao || row.gpsQuarteirao || row.quarteirao || ''),
      gps_lat: normalizeCoord(row.gps_lat || row.gpsLat || row.latitude || row.lat),
      gps_lng: normalizeCoord(row.gps_lng || row.gpsLng || row.longitude || row.lng),
      gps_acc: Number(row.gps_acc || row.gpsAccuracy || row.accuracy || 0) || 0,
      createdAt: String(row.createdAt || row.created_at || '').trim(),
      updatedAt: String(row.updatedAt || row.updated_at || '').trim()
    };
  }

  function normalizeWaterAccess(value) {
    var label = String(value || '').trim().toLowerCase();
    if (!label) {
      return '';
    }
    if (label === 'sim' || label === 's' || label === 'yes' || label === 'true') {
      return 'Sim';
    }
    if (label === 'nao' || label === 'não' || label === 'n' || label === 'no' || label === 'false') {
      return 'Não';
    }
    return repairTextEncoding(String(value || '').trim());
  }

  function normalizeWaterTankCondition(value) {
    var label = String(value || '').trim().toLowerCase();
    if (!label) {
      return '';
    }
    if (label.indexOf('tamp') > -1) {
      return 'Tampada';
    }
    if (label.indexOf('tela') > -1) {
      return 'Telada';
    }
    if (label.indexOf('chuva') > -1 || label.indexOf('abert') > -1 || label.indexOf('vulner') > -1) {
      return 'Aberta';
    }
    if (label.indexOf('vazi') > -1) {
      return 'Vazia';
    }
    return repairTextEncoding(String(value || '').trim());
  }

  function isWaterTankTreated(visit) {
    var treatment = normalizeLabel(visit && visit.waterTreatment || '');
    if (!treatment) {
      return false;
    }
    if (treatment === 'nao' || treatment === 'nao aplicado' || treatment === 'nao se aplica' || treatment === 'sem tratamento') {
      return false;
    }
    return true;
  }

  function summarizeWaterAccess(visits) {
    return (visits || []).reduce(function (summary, visit) {
      var access = normalizeWaterAccess(visit && visit.waterAccess);
      if (access === 'Sim') {
        summary.yes += 1;
      } else if (access === 'Não') {
        summary.no += 1;
      } else {
        summary.unknown += 1;
      }
      if (isWaterTankTreated(visit)) {
        summary.treated += 1;
      }
      if (visitHasFocus(visit)) {
        summary.withFocus += 1;
      } else {
        summary.withoutFocus += 1;
      }
      return summary;
    }, { yes: 0, no: 0, unknown: 0, withFocus: 0, withoutFocus: 0, treated: 0 });
  }

  function summarizeWaterTankConditions(visits) {
    return (visits || []).reduce(function (summary, visit) {
      var condition = normalizeWaterTankCondition(visit && visit.waterTankCondition);
      if (condition === 'Tampada') {
        summary.tampada += 1;
      } else if (condition === 'Telada') {
        summary.telada += 1;
      } else if (condition === 'Aberta') {
        summary.aberta += 1;
      } else if (condition === 'Vazia') {
        summary.vazia += 1;
      } else {
        summary.unknown += 1;
      }
      return summary;
    }, { tampada: 0, telada: 0, aberta: 0, vazia: 0, unknown: 0 });
  }

  function formatDateBR(value) {
    if (!value) {
      return '-';
    }
    var parts = String(value).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  }

  function addressKey(visit) {
    return [visit.bairro, visit.logradouro, visit.numero].join('|').toLowerCase();
  }

  function propertyVisitKey(visit) {
    return String(visit.property_uid || visit.propertyUid || '').trim() || addressKey(visit);
  }

  function visitHasFocus(visit) {
    return visit.foco === 'Sim' || Number(visit.focusCount || 0) > 0 || Number(visit.depositFocusCount || 0) > 0;
  }

  function visitHasGps(visit) {
    return !!(visit && visitCoordinateValid(visit.gps_lat) && visitCoordinateValid(visit.gps_lng));
  }

  function visitNeedsLadder(visit) {
    var waterAccess = normalizeLabel(visit && visit.waterAccess || '');
    var reason = normalizeLabel(visit && visit.waterAccessReason || '');
    return !!(visit && waterAccess === 'nao' && reason.indexOf('escada') > -1);
  }

  var PANEL_LADDER_ATTENDED_KEY = 'ace_panel_ladder_attended_v1';

  function visitRequestedLadder(visit) {
    var requested = normalizeLabel(visit && visit.ladderSupportRequested || '');
    var status = normalizeLabel(visit && visit.ladderSupportStatus || '');
    var noReason = normalizeLabel(visit && visit.ladderSupportNoReason || '');
    if (!visitNeedsLadder(visit)) {
      return false;
    }
    if (requested === 'nao' || requested === 'não' || noReason) {
      return false;
    }
    return requested === 'sim' ||
      requested.indexOf('solicit') > -1 ||
      status.indexOf('solicit') > -1;
  }

  function readPanelLadderAttended() {
    try {
      var raw = localStorage.getItem(PANEL_LADDER_ATTENDED_KEY);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (error) {
      return {};
    }
  }

  function writePanelLadderAttended(map) {
    try { localStorage.setItem(PANEL_LADDER_ATTENDED_KEY, JSON.stringify(map || {})); } catch (error) {}
  }

  function getPanelLadderRequestKey(visit) {
    visit = visit || {};
    return String(visit.uid || '').trim() || [visit.data || '', visit.hora || '', visit.agente || '', visit.matricula || '', visit.logradouro || '', visit.numero || '', visit.bairro || ''].join('|');
  }

  function isPanelLadderAttended(visit) {
    var attended = readPanelLadderAttended();
    var key = getPanelLadderRequestKey(visit);
    return !!(key && attended[key]);
  }

  function markPanelLadderAttended(key) {
    var attended = readPanelLadderAttended();
    if (!key) { return; }
    attended[key] = new Date().toISOString();
    writePanelLadderAttended(attended);
  }

  function getOpenPanelLadderRequests(visits) {
    return (visits || []).filter(visitRequestedLadder).filter(function (visit) { return getPanelLadderStatus(visit) !== 'Concluída'; }).sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '')));
    });
  }


  var PANEL_LADDER_STATUS_KEY = 'ace_panel_ladder_status_v1';
  var PANEL_SUPERVISION_STATUS_KEY = 'ace_panel_supervision_status_v1';

  function readPanelStatusMap(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (error) {
      return {};
    }
  }

  function writePanelStatusMap(key, map) {
    try { localStorage.setItem(key, JSON.stringify(map || {})); } catch (error) {}
  }

  function setPanelLocalStatus(storageKey, itemKey, status) {
    var map = readPanelStatusMap(storageKey);
    if (!itemKey) { return; }
    map[itemKey] = { status: status, updatedAt: new Date().toISOString() };
    writePanelStatusMap(storageKey, map);
  }

  function getStatusLabel(status) {
    status = normalizeLabel(status || '');
    if (status.indexOf('conclu') > -1 || status === 'done' || status === 'atendida' || status === 'atendido') {
      return 'Concluída';
    }
    if (status.indexOf('atend') > -1 || status === 'attending') {
      return 'Em atendimento';
    }
    return 'Aberta';
  }

  function getPanelLadderStatus(visit) {
    var key = getPanelLadderRequestKey(visit);
    var map = readPanelStatusMap(PANEL_LADDER_STATUS_KEY);
    if (key && map[key] && map[key].status) {
      return getStatusLabel(map[key].status);
    }
    if (isPanelLadderAttended(visit)) {
      return 'Concluída';
    }
    return getStatusLabel((visit && visit.ladderSupportStatus) || 'Aberta');
  }

  function setPanelLadderStatus(key, status) {
    if (status === 'Concluída') {
      markPanelLadderAttended(key);
    }
    setPanelLocalStatus(PANEL_LADDER_STATUS_KEY, key, status);
  }

  function getPanelSupervisionRequestKey(request) {
    request = request || {};
    return String(request.uid || '').trim() || [request.data || '', request.hora || '', request.agente || '', request.matricula || '', request.gps_lat || '', request.gps_lng || ''].join('|');
  }

  function getPanelSupervisionStatus(request) {
    var key = getPanelSupervisionRequestKey(request);
    var map = readPanelStatusMap(PANEL_SUPERVISION_STATUS_KEY);
    if (key && map[key] && map[key].status) {
      return getStatusLabel(map[key].status);
    }
    return getStatusLabel((request && request.status) || 'Aberta');
  }

  function setPanelSupervisionStatus(key, status) {
    setPanelLocalStatus(PANEL_SUPERVISION_STATUS_KEY, key, status);
  }

  function getOpenPanelSupervisionRequests(requests) {
    return (requests || []).filter(function (request) {
      return getPanelSupervisionStatus(request) !== 'Concluída';
    }).sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '') + ' ' + (b.updatedAt || b.createdAt || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '') + ' ' + (a.updatedAt || a.createdAt || '')));
    });
  }

  function getSupervisionRequestsForCurrentRange() {
    var range = getDateRange();
    var rows = state.allSupervisionRequests || [];
    return rows.filter(function (request) {
      if (request.data && range.start && request.data < range.start) { return false; }
      if (request.data && range.end && request.data > range.end) { return false; }
      return true;
    });
  }

  function visitCoordinateValid(value) {
    return value !== '' && value != null && !Number.isNaN(Number(value));
  }

  function buildMapsUrl(lat, lng) {
    if (!visitCoordinateValid(lat) || !visitCoordinateValid(lng)) {
      return '';
    }
    return 'https://www.google.com/maps?q=' + encodeURIComponent(String(lat) + ',' + String(lng));
  }

  function normalizeSituacaoFilterValue(value) {
    if (value === 'Fechado') {
      return ['Fechado', 'Recusa'];
    }
    return value ? [value] : [];
  }

  function computePropertyFocusSummary(visits) {
    var perProperty = {};
    visits.forEach(function (visit) {
      var key = propertyVisitKey(visit);
      if (!key) {
        return;
      }
      if (!perProperty[key]) {
        perProperty[key] = { hasFocus: false, touched: false };
      }
      perProperty[key].touched = true;
      if (visitHasFocus(visit)) {
        perProperty[key].hasFocus = true;
      }
    });
    return Object.keys(perProperty).reduce(function (acc, key) {
      if (perProperty[key].hasFocus) { acc.withFocus += 1; }
      else if (perProperty[key].touched) { acc.withoutFocus += 1; }
      return acc;
    }, { withFocus: 0, withoutFocus: 0 });
  }

  function getDateRange() {
    var today = toLocalIsoDate(new Date());
    var defaultStart = getDateDaysAgo(29);
    return {
      start: document.getElementById('dateStart').value || defaultStart,
      end: document.getElementById('dateEnd').value || today
    };
  }

  function getPeriodLabel() {
    var range = getDateRange();
    return formatDateBR(range.start) + ' a ' + formatDateBR(range.end);
  }

  function reportStrong(value) {
    return '<strong class="report-kpi">' + escapeHtml(String(value)) + '</strong>';
  }

  function getReportFilterSignature() {
    var bairro = document.getElementById('bairroFilter');
    var microarea = document.getElementById('microareaFilter');
    var quarteirao = document.getElementById('quarteiraoFilter');
    var logradouro = document.getElementById('logradouroFilter');
    var agent = document.getElementById('agentFilter');
    var operation = document.getElementById('operationFilter');
    return [
      'Período: ' + getPeriodLabel(),
      'Bairro: ' + (bairro && bairro.value ? bairro.value : 'Todos'),
      'Microárea: ' + (microarea && microarea.value ? microarea.value : 'Todas'),
      'Quarteirão: ' + (quarteirao && quarteirao.value ? quarteirao.value : 'Todos'),
      'Rua: ' + (logradouro && logradouro.value ? logradouro.value : 'Todas'),
      'Agente: ' + (agent && agent.value ? agent.value : 'Todos'),
      'Operacao: ' + (operation && operation.value ? operationModeLabel(operation.value) : 'Todas')
    ].join(' • ');
  }

  function getOperationalAlert(metrics) {
    var score = 0;
    if (metrics.depositsWithFocus > 0 || metrics.propertiesWithFocus > 0) {
      score += 1;
    }
    if (metrics.infestationRate >= 20 || metrics.depositsWithFocus >= 5) {
      score += 2;
    } else if (metrics.infestationRate >= 10 || metrics.depositsWithFocus >= 2) {
      score += 1;
    }
    if (metrics.pending >= 10) {
      score += 2;
    } else if (metrics.pending > 0) {
      score += 1;
    }
    if (metrics.gpsCoverage > 0 && metrics.gpsCoverage < 60) {
      score += 1;
    }
    if (score >= 4) {
      return { label: 'Crítico', className: 'is-critical', text: 'Exige priorização imediata da coordenação, com bloqueio focal, retorno e conferência territorial.' };
    }
    if (score >= 3) {
      return { label: 'Prioridade de bloqueio', className: 'is-priority', text: 'Há concentração suficiente para direcionar equipe, revisitas e controle de depósitos positivos.' };
    }
    if (score >= 1) {
      return { label: 'Atenção operacional', className: 'is-warning', text: 'O recorte pede acompanhamento próximo, sem indicar descontrole territorial no momento.' };
    }
    return { label: 'Situação controlada', className: 'is-stable', text: 'Sem sinal crítico consolidado no recorte filtrado.' };
  }

  function buildExecutiveSection(title, body) {
    var content = /<(p|div|table|ul|ol)\b/i.test(String(body || '')) ? body : '<p>' + body + '</p>';
    return '<section class="executive-section"><div class="executive-section__head"><h4>' + escapeHtml(title) + '</h4></div><div class="executive-section__body">' + content + '</div></section>';
  }

  function buildAgentPerformanceHtml(agents, selectedAgent) {
    var rows = agents.slice();
    var selected = selectedAgent
      ? rows.find(function (agent) { return agent.nome === selectedAgent; })
      : null;
    var bestGps;
    var mostReturns;
    var mostFocus;
    var mostRegistrations;
    var attention;
    if (!rows.length) {
      return '<p><strong>Desempenho operacional:</strong> ainda não há produção de agente para comparar no recorte selecionado.</p>';
    }
    if (selected) {
      attention = [];
      if (selected.gpsRate < 85) {
        attention.push('cobertura GPS em ' + reportStrong(selected.gpsRate + '%') + ', abaixo da meta operacional de 85%');
      }
      if (selected.retornos > 0) {
        attention.push(reportStrong(selected.retornos) + ' retorno(s) pendente(s) para reorganizar na rota');
      }
      if (selected.depositosComFoco > 0 || selected.focos > 0) {
        attention.push(reportStrong(selected.focos) + ' foco(s) e ' + reportStrong(selected.depositosComFoco) + ' depósito(s) com foco exigindo bloqueio e conferência');
      }
      if (!attention.length) {
        attention.push('sem ponto crítico individual no período filtrado');
      }
      return '<p><strong>Desempenho individual de ' + escapeHtml(selected.nome) + ':</strong> foram ' +
        reportStrong(selected.visitas) + ' visita(s), ' + reportStrong(selected.cadastros || 0) +
        ' cadastro(s), ' + reportStrong(selected.gpsRate + '%') +
        ' de cobertura GPS, ' + reportStrong(selected.recuperados) + ' recuperado(s), ' +
        reportStrong(selected.fechados) + ' fechado(s)/recusado(s) e ' +
        reportStrong(selected.depositosComFoco) + ' depósito(s) com foco.</p>' +
        '<p><strong>Pontos positivos:</strong> produção registrada, cadastro da base, rastreabilidade por GPS e recuperação de pendências devem ser acompanhadas diariamente. <strong>Pontos de atenção:</strong> ' +
        attention.join('; ') + '.</p>';
    }
    bestGps = rows.slice().sort(function (a, b) { return b.gpsRate - a.gpsRate || b.visitas - a.visitas; })[0];
    mostFocus = rows.slice().sort(function (a, b) { return b.focos - a.focos || b.depositosComFoco - a.depositosComFoco; })[0];
    mostRegistrations = rows.slice().sort(function (a, b) { return (b.cadastros || 0) - (a.cadastros || 0) || b.visitas - a.visitas; })[0];
    mostReturns = rows.slice().sort(function (a, b) { return b.retornos - a.retornos || b.fechados - a.fechados; })[0];
    attention = rows.filter(function (agent) {
      return agent.gpsRate < 85 || agent.retornos > 0;
    }).slice(0, 3);
    return '<p><strong>Desempenho da equipe:</strong> ' + escapeHtml(rows[0].nome) +
      ' lidera em volume com ' + reportStrong(rows[0].visitas) + ' visita(s); ' +
      (mostRegistrations && mostRegistrations.cadastros > 0
        ? escapeHtml(mostRegistrations.nome) + ' lidera os cadastros, com ' + reportStrong(mostRegistrations.cadastros) + ' imóvel(is) cadastrado(s); '
        : 'a base ainda não possui cadastro atribuído a agente no recorte; ') +
      escapeHtml(bestGps.nome) + ' apresenta a melhor cobertura GPS, com ' +
      reportStrong(bestGps.gpsRate + '%') +
      (mostFocus && mostFocus.focos > 0
        ? '; e ' + escapeHtml(mostFocus.nome) + ' concentra ' + reportStrong(mostFocus.focos) + ' foco(s) encontrado(s)'
        : '; e não há foco encontrado no recorte') + '.</p>' +
      '<p><strong>Pontos positivos:</strong> a comparação ajuda a replicar produtividade, cadastro de base, cobertura GPS e recuperação de pendências entre os agentes. <strong>Pontos de atenção:</strong> ' +
      (attention.length
        ? attention.map(function (agent) {
          return escapeHtml(agent.nome) + ' com ' + reportStrong(agent.gpsRate + '%') + ' de GPS e ' + reportStrong(agent.retornos) + ' retorno(s)';
        }).join('; ')
        : 'não há agente com alerta crítico de GPS ou retorno no período') +
      (mostReturns && mostReturns.retornos > 0 ? '; maior carga de retorno em ' + escapeHtml(mostReturns.nome) + ' (' + reportStrong(mostReturns.retornos) + ')' : '') +
      '.</p>';
  }

  function ensurePanelLayout() {
    var title = document.querySelector('.topbar-v3__copy h1') || document.querySelector('.brand-copy h1');
    var note = document.querySelector('.topbar-v3__copy p') || document.querySelector('.brand-copy p');
    if (title) { title.textContent = 'Coordenação Municipal de Combate às Endemias'; }
    if (note) { note.textContent = 'Monitoramento operacional, indicadores territoriais e apoio à decisão.'; }
    if (!document.querySelector('.app-credit')) {
      var footer = document.createElement('footer');
      footer.className = 'app-credit';
      footer.textContent = 'ACE Campo';
      var panelStatus = document.getElementById('panelStatus');
      if (panelStatus && panelStatus.parentNode) {
        panelStatus.parentNode.insertBefore(footer, panelStatus);
      }
    }
  }

  function updateShellHeaderInfo() {
    var now = new Date();
    var months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    var days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    var dateLabel = document.getElementById('headerDateLabel');
    var dayLabel = document.getElementById('headerDayLabel');
    var sidebarUpdatedAt = document.getElementById('sidebarUpdatedAt');
    if (dateLabel) {
      dateLabel.textContent = now.getDate() + ' de ' + months[now.getMonth()] + ' de ' + now.getFullYear();
    }
    if (dayLabel) {
      dayLabel.textContent = days[now.getDay()];
    }
    if (sidebarUpdatedAt) {
      sidebarUpdatedAt.textContent = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear() + ' • ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  function setActiveReportAction(buttonId) {
    ['reportExecutiveBtn', 'reportIndividualBtn', 'reportWaterTankBtn', 'reportTubitosBtn'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.classList.toggle('is-active', id === buttonId);
      }
    });
  }


  function isPanelViewVisible(viewName) {
    return state.activePanelView === viewName;
  }

  function syncPanelViewUI() {
    var isMapView = state.activePanelView === 'map';
    if (document.body) {
      document.body.classList.toggle('ace-panel-view-map', isMapView);
    }
    if (document.documentElement) {
      document.documentElement.classList.toggle('ace-panel-view-map', isMapView);
    }
    document.querySelectorAll('[data-panel-view]').forEach(function (button) {
      var isActive = button.getAttribute('data-panel-view') === state.activePanelView;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('[data-panel-view-content]').forEach(function (panel) {
      var isActive = panel.getAttribute('data-panel-view-content') === state.activePanelView;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
    if (isMapView && window.innerWidth <= 820) {
      var drawer = document.querySelector('.panel-filter-drawer');
      if (drawer) {
        drawer.removeAttribute('open');
      }
    }
    updateShellHeaderInfo();
  }

  function switchPanelView(viewName) {
    var nextView = viewName || 'indicators';
    if (state.activePanelView === nextView) {
      if (nextView === 'map' && state.pendingMapRender) {
        setTimeout(function () {
          renderHeatMap(state.filteredVisits || []);
        }, 60);
      }
      return;
    }
    state.activePanelView = nextView;
    syncPanelViewUI();
    if (nextView === 'map') {
      setTimeout(function () {
        renderHeatMap(state.filteredVisits || []);
      }, 60);
    }
  }


  function applyInitialRangeFromVisits() {
    var startNode = document.getElementById('dateStart');
    var endNode = document.getElementById('dateEnd');
    var dates = (state.allVisits || []).map(function (visit) { return normalizeDateOnly(visit && visit.data); }).filter(Boolean).sort();
    if (!startNode || !endNode || !dates.length || state.hasAutoExpandedRange) {
      return;
    }
    startNode.value = dates[0];
    endNode.value = dates[dates.length - 1];
    state.hasAutoExpandedRange = true;
  }

  function loadDashboard() {
    var range = getDateRange();
    var statsPreviousRange = getPreviousStatsRange(range);
    var apiStart = statsPreviousRange && statsPreviousRange.start ? statsPreviousRange.start : range.start;
    setBanner('Atualizando...', 'accent');
    var promise = isApiConfigured() ? fetchApiVisits(apiStart, range.end) : loadLocalBundle();
    return promise.then(function (bundle) {
      state.source = isApiConfigured() ? 'api' : 'local';
      state.allVisits = bundle && bundle.visits ? bundle.visits : [];
      state.allProperties = bundle && bundle.properties ? bundle.properties : [];
      state.allTubitos = bundle && bundle.tubitos ? bundle.tubitos : [];
      state.allSupervisionRequests = bundle && bundle.supervisionRequests ? bundle.supervisionRequests : [];
      state.allAgents = bundle && bundle.agents ? bundle.agents : getCloudPanelAgents();
      state.dashboardSummary = bundle && bundle.summary ? bundle.summary : null;
      state.dashboardMeta = bundle && bundle.meta ? bundle.meta : null;
      if (!isApiConfigured()) {
        applyInitialRangeFromVisits();
      }
      applyFilters();
      setChip('panelModeChip', state.source === 'api' ? 'Sincronizado' : 'Modo local', state.source === 'api' ? 'ok' : 'warn');
      var totalVisits = state.filteredVisits.length;
      var isTruncated = !!(state.dashboardMeta && state.dashboardMeta.pagination && state.dashboardMeta.pagination.visits && state.dashboardMeta.pagination.visits.truncated);
      setChip('panelStatusChip', totalVisits + ' visita(s)' + (isTruncated ? ' • parcial' : ''), isTruncated ? 'warn' : 'accent');
      updateShellHeaderInfo();
      setBanner(isTruncated ? 'Atualizado com paginação no servidor. Refine o recorte para detalhar mais.' : 'Atualizado.', isTruncated ? 'warn' : 'ok');
    }).catch(function () {
      if (isApiConfigured()) {
        state.source = 'api';
        state.dashboardSummary = null;
        state.dashboardMeta = null;
        if (!(state.allVisits && state.allVisits.length)) {
          state.allVisits = [];
        }
        if (!(state.allProperties && state.allProperties.length)) {
          state.allProperties = [];
        }
        if (!(state.allAgents && state.allAgents.length)) {
          state.allAgents = getCloudPanelAgents();
        }
        if (!(state.allSupervisionRequests && state.allSupervisionRequests.length)) {
          state.allSupervisionRequests = [];
        }
        applyFilters();
        setChip('panelModeChip', 'Nuvem indisponível', 'warn');
        setChip('panelStatusChip', state.filteredVisits.length ? (state.filteredVisits.length + ' visita(s)') : 'API indisponível', state.filteredVisits.length ? 'accent' : 'warn');
        updateShellHeaderInfo();
        setBanner(state.filteredVisits.length ? 'API indisponível. Mantendo o último recorte carregado.' : 'API indisponível. Painel sem dados válidos para o recorte.', 'warn');
        return;
      }
      state.source = 'local';
      loadLocalBundle().then(function (localBundle) {
        state.allVisits = localBundle.visits || [];
        state.allProperties = localBundle.properties || [];
        state.allTubitos = localBundle.tubitos || [];
        state.allSupervisionRequests = localBundle.supervisionRequests || [];
        state.allAgents = localBundle.agents || getCloudPanelAgents();
        state.dashboardSummary = null;
        state.dashboardMeta = null;
        applyInitialRangeFromVisits();
        applyFilters();
        setChip('panelModeChip', 'Modo local', 'warn');
        setChip('panelStatusChip', 'Fallback local', 'warn');
        updateShellHeaderInfo();
        setBanner('API indisponível. Painel carregado no modo local.', 'warn');
      });
    });
  }

  function buildOptions(values, label) {
    var uniques = [''].concat(Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
    }));
    return uniques.map(function (value) {
      return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value || label) + '</option>';
    }).join('');
  }

  function getCurrentFilterValues() {
    return {
      bairro: document.getElementById('bairroFilter') ? document.getElementById('bairroFilter').value : '',
      microarea: document.getElementById('microareaFilter') ? document.getElementById('microareaFilter').value : '',
      quarteirao: document.getElementById('quarteiraoFilter') ? document.getElementById('quarteiraoFilter').value : '',
      logradouro: document.getElementById('logradouroFilter') ? document.getElementById('logradouroFilter').value : '',
      agent: document.getElementById('agentFilter') ? document.getElementById('agentFilter').value : ''
    };
  }

  function buildMicroareaQuarteiraoMap(rows) {
    var map = {};
    (TERRITORY_SOURCE.polygons || []).forEach(function (feature) {
      var territoryType = String(feature.territoryType || '').trim().toLowerCase();
      var microarea = getMicroareaLabelForTerritory(getFeatureTerritoryName(feature));
      var quarteirao = repairTextEncoding(feature.name || '').trim();
      if (!microarea) {
        return;
      }
      if (!map[microarea]) {
        map[microarea] = [];
      }
      if (territoryType === 'distrito') {
        return;
      }
      if (quarteirao) {
        map[microarea].push(quarteirao);
      }
    });
    rows.forEach(function (row) {
      var microarea = String(row.microarea || '').trim();
      var quarteirao = String(row.quarteirao || '').trim();
      if (!microarea) {
        return;
      }
      if (!map[microarea]) {
        map[microarea] = [];
      }
      if (quarteirao) {
        map[microarea].push(quarteirao);
      }
    });
    Object.keys(map).forEach(function (key) {
      map[key] = Array.from(new Set(map[key])).sort(function (a, b) {
        return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
      });
    });
    return map;
  }

  function setSelectOptions(node, values, emptyLabel, selectedValue) {
    if (!node) {
      return '';
    }
    var cleanValues = Array.from(new Set((values || []).filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
    });
    node.innerHTML = buildOptions(cleanValues, emptyLabel);
    node.value = cleanValues.indexOf(selectedValue) > -1 ? selectedValue : '';
    return node.value;
  }

  function populateFilters() {
    var current = getCurrentFilterValues();
    var rows = state.allVisits.concat(state.allProperties);
    var bairros = BAIRRO_CATALOG.slice();
    var areaMap = buildMicroareaQuarteiraoMap(rows);
    var microáreas = Object.keys(areaMap);
    var bairro = setSelectOptions(document.getElementById('bairroFilter'), bairros, 'Todos', current.bairro);
    var microarea = setSelectOptions(document.getElementById('microareaFilter'), microáreas, 'Todas', current.microarea);

    setSelectOptions(document.getElementById('agentFilter'), getAgentFilterNames(), 'Todos', current.agent);

    if (document.getElementById('quarteiraoFilter')) {
      var quarteirões = microarea && areaMap[microarea] ? areaMap[microarea] : [];
      var quarteirao = setSelectOptions(
        document.getElementById('quarteiraoFilter'),
        quarteirões,
        microarea ? 'Todos' : 'Selecione a microárea',
        current.quarteirao
      );
      document.getElementById('quarteiraoFilter').disabled = !microarea;

      if (document.getElementById('logradouroFilter')) {
        var logradouros = rows.filter(function (row) {
          if (bairro && row.bairro !== bairro) { return false; }
          if (microarea && String(row.microarea || '') !== microarea) { return false; }
          if (quarteirao && String(row.quarteirao || '') !== quarteirao) { return false; }
          return true;
        }).map(function (row) { return row.logradouro; });
        setSelectOptions(document.getElementById('logradouroFilter'), logradouros, 'Todas', current.logradouro);
      }
    }
  }

  function applyFilters() {
    populateFilters();
    var bairro = document.getElementById('bairroFilter').value;
    var microarea = document.getElementById('microareaFilter').value;
    var quarteirao = document.getElementById('quarteiraoFilter') ? document.getElementById('quarteiraoFilter').value : '';
    var logradouro = document.getElementById('logradouroFilter') ? document.getElementById('logradouroFilter').value : '';
    var agent = document.getElementById('agentFilter').value;
    var situacao = document.getElementById('situacaoFilter') ? document.getElementById('situacaoFilter').value : '';
    var foco = document.getElementById('focoFilter') ? document.getElementById('focoFilter').value : '';
    var gps = document.getElementById('gpsFilter') ? document.getElementById('gpsFilter').value : '';
    var operation = document.getElementById('operationFilter') ? document.getElementById('operationFilter').value : '';
    var search = document.getElementById('searchFilter') ? String(document.getElementById('searchFilter').value || '').trim().toLowerCase() : '';
    var acceptedSituacoes = normalizeSituacaoFilterValue(situacao);
    var range = getDateRange();

    state.filteredVisits = state.allVisits.filter(function (visit) {
      if (range.start && visit.data < range.start) { return false; }
      if (range.end && visit.data > range.end) { return false; }
      if (bairro && visit.bairro !== bairro) { return false; }
      if (microarea && String(visit.microarea) !== microarea) { return false; }
      if (quarteirao && String(visit.quarteirao) !== quarteirao) { return false; }
      if (logradouro && visit.logradouro !== logradouro) { return false; }
      if (agent && visit.agente !== agent) { return false; }
      if (acceptedSituacoes.length && acceptedSituacoes.indexOf(visit.situacao) === -1) { return false; }
      if (foco === 'com_foco' && !visitHasFocus(visit)) { return false; }
      if (foco === 'sem_foco' && visitHasFocus(visit)) { return false; }
      if (gps === 'com_gps' && !visitHasGps(visit)) { return false; }
      if (gps === 'sem_gps' && visitHasGps(visit)) { return false; }
      if (operation && getVisitOperationMode(visit) !== normalizeOperationMode(operation)) { return false; }
      if (search) {
        var text = [visit.bairro, visit.microarea, visit.quarteirao, visit.logradouro, visit.numero, visit.morador, visit.agente, visit.situacao].join(' ').toLowerCase();
        if (text.indexOf(search) === -1) { return false; }
      }
      return true;
    }).sort(function (a, b) {
      return (b.data + ' ' + b.hora).localeCompare(a.data + ' ' + a.hora);
    });

    state.filteredProperties = state.allProperties.filter(function (property) {
      if (bairro && property.bairro !== bairro) { return false; }
      if (microarea && String(property.microarea) !== microarea) { return false; }
      if (quarteirao && String(property.quarteirao) !== quarteirao) { return false; }
      if (logradouro && property.logradouro !== logradouro) { return false; }
      if (search) {
        var text = [property.bairro, property.microarea, property.quarteirao, property.logradouro, property.numero, property.morador, property.tipo, property.complemento, property.referencia].join(' ').toLowerCase();
        if (text.indexOf(search) === -1) { return false; }
      }
      return true;
    });

    setChip('panelStatusChip', state.filteredVisits.length + ' visita(s)', 'accent');
    renderDashboard();
  }

  function setFilterValue(id, value) {
    var node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.value = value || '';
  }

  function applyDrilldown(field, value) {
    if (!value) {
      return;
    }
    if (field === 'bairro') {
      setFilterValue('bairroFilter', value);
      setFilterValue('microareaFilter', '');
      populateFilters();
      setFilterValue('quarteiraoFilter', '');
      setFilterValue('logradouroFilter', '');
    } else if (field === 'microarea') {
      setFilterValue('microareaFilter', value);
      populateFilters();
      setFilterValue('quarteiraoFilter', '');
      setFilterValue('logradouroFilter', '');
    } else if (field === 'quarteirao') {
      if (!document.getElementById('microareaFilter').value) {
        var row = state.filteredVisits.find(function (visit) { return String(visit.quarteirao || '') === value; }) ||
          state.allVisits.find(function (visit) { return String(visit.quarteirao || '') === value; });
        if (row && row.microarea) {
          setFilterValue('microareaFilter', row.microarea);
          populateFilters();
        }
      }
      setFilterValue('quarteiraoFilter', value);
      populateFilters();
      setFilterValue('logradouroFilter', '');
    } else if (field === 'logradouro') {
      setFilterValue('logradouroFilter', value);
    } else if (field === 'agente') {
      setFilterValue('agentFilter', value);
    }
    applyFilters();
  }

  function clearDrilldown() {
    ['bairroFilter', 'microareaFilter', 'quarteiraoFilter', 'logradouroFilter', 'agentFilter', 'searchFilter'].forEach(function (id) {
      if (document.getElementById(id)) {
        document.getElementById(id).value = '';
      }
    });
    state.selectedVisitUid = '';
    state.selectedTerritory = null;
    applyFilters();
  }

  function getSelectedVisit() {
    return state.filteredVisits.find(function (visit) { return visit.uid === state.selectedVisitUid; }) || null;
  }

  function findPropertyForVisit(visit) {
    if (!visit) {
      return null;
    }
    var propertyUid = String(visit.property_uid || '').trim();
    if (propertyUid) {
      var byUid = state.filteredProperties.find(function (property) {
        return String(property.uid || '').trim() === propertyUid;
      }) || state.allProperties.find(function (property) {
        return String(property.uid || '').trim() === propertyUid;
      }) || null;
      if (byUid) {
        return byUid;
      }
    }
    var key = addressKey(visit);
    return state.filteredProperties.find(function (property) {
      return addressKey(property) === key;
    }) || state.allProperties.find(function (property) {
      return addressKey(property) === key;
    }) || null;
  }

  function getTubitosForVisit(visit) {
    var uid = String(visit && visit.uid || '').trim();
    if (!uid) {
      return [];
    }
    return (state.allTubitos || []).filter(function (row) {
      return String(row.visit_uid || '').trim() === uid;
    }).sort(function (a, b) {
      return String(a.numeroTubito || '').localeCompare(String(b.numeroTubito || ''), 'pt-BR', { numeric: true });
    });
  }

  function getCurrentFilterValue(id) {
    var node = document.getElementById(id);
    return node ? String(node.value || '').trim() : '';
  }

  function getTubitoReportKey(row) {
    row = row || {};
    return String(row.uid || row.numeroTubito || [
      row.visit_uid,
      row.dataColeta,
      row.horaColeta,
      row.depositoCodigo,
      row.logradouro,
      row.numero
    ].join('|')).trim();
  }

  function getTubitoCollectionDate(row) {
    return normalizeDateOnly(row && (row.dataColeta || row.data_coleta || row.data || ''));
  }

  function tubitoMatchesCurrentFilters(row) {
    var range = getDateRange();
    var date = getTubitoCollectionDate(row);
    var bairro = getCurrentFilterValue('bairroFilter');
    var microarea = getCurrentFilterValue('microareaFilter');
    var quarteirao = getCurrentFilterValue('quarteiraoFilter');
    var logradouro = getCurrentFilterValue('logradouroFilter');
    var agent = getCurrentFilterValue('agentFilter');
    var operation = getCurrentFilterValue('operationFilter');
    var search = getCurrentFilterValue('searchFilter').toLowerCase();

    if (range.start && (!date || date < range.start)) { return false; }
    if (range.end && (!date || date > range.end)) { return false; }
    if (bairro && row.bairro !== bairro) { return false; }
    if (microarea && String(row.microarea || '') !== microarea) { return false; }
    if (quarteirao && String(row.quarteirao || '') !== quarteirao) { return false; }
    if (logradouro && row.logradouro !== logradouro) { return false; }
    if (agent && row.agente !== agent) { return false; }
    if (operation && normalizeOperationMode(row.operationMode || row.origemVisita) !== normalizeOperationMode(operation)) { return false; }
    if (search) {
      var text = [
        row.numeroTubito,
        row.bairro,
        row.microarea,
        row.quarteirao,
        row.logradouro,
        row.numero,
        row.depositoCodigo,
        row.agente,
        row.statusLaboratorio,
        row.resultadoLaboratorio,
        row.especie,
        operationModeLabel(row.operationMode || row.origemVisita),
        row.peNomeLocal,
        row.liraaCiclo
      ].join(' ').toLowerCase();
      if (text.indexOf(search) === -1) { return false; }
    }
    return true;
  }

  function getTubitosForVisits(visits) {
    var uidMap = {};
    var included = {};
    (visits || []).forEach(function (visit) {
      if (visit && visit.uid) {
        uidMap[String(visit.uid)] = true;
      }
    });
    return (state.allTubitos || []).filter(function (row) {
      var visitUid = String(row && row.visit_uid || '').trim();
      var key = getTubitoReportKey(row);
      var matches = visitUid ? !!uidMap[visitUid] : tubitoMatchesCurrentFilters(row || {});
      if (!matches) {
        return false;
      }
      if (key && included[key]) {
        return false;
      }
      if (key) {
        included[key] = true;
      }
      return true;
    });
  }

  function summarizeLabTubitos(rows) {
    var summary = {
      total: 0,
      positiveAedes: 0,
      negative: 0,
      pending: 0,
      inconclusive: 0
    };
    (rows || []).forEach(function (row) {
      var result = normalizeLabel(row && row.resultadoLaboratorio || '');
      var status = normalizeLabel(row && row.statusLaboratorio || '');
      summary.total += 1;
      if (isAedesPositiveTubito(row)) {
        summary.positiveAedes += 1;
      } else if (result.indexOf('negativo') > -1) {
        summary.negative += 1;
      } else if (result.indexOf('inconclus') > -1 || status.indexOf('inconclus') > -1 || status === 'descartado' || isAnalyzedTubito(row)) {
        summary.inconclusive += 1;
      } else {
        summary.pending += 1;
      }
    });
    return summary;
  }

  function getLabSummaryForVisit(visit) {
    var rows = getTubitosForVisit(visit);
    var summary = summarizeLabTubitos(rows);
    summary.rows = rows;
    summary.tone = summary.positiveAedes ? 'danger' : summary.pending ? 'warn' : summary.total ? 'ok' : 'neutral';
    summary.text = summary.total
      ? (summary.positiveAedes
        ? summary.positiveAedes + ' positivo(s) Aedes'
        : summary.pending
          ? summary.pending + ' pendente(s)'
          : 'sem Aedes positivo')
      : 'sem tubito';
    return summary;
  }

  function formatLabSummaryForVisit(visit) {
    var summary = getLabSummaryForVisit(visit);
    if (!summary.total && visit && visit.laboratorioResultado) {
      return visit.laboratorioResultado;
    }
    return summary.total ? summary.text + ' / ' + summary.total + ' tubito(s)' : '';
  }

  function getAedesPositiveTubitoCountForVisit(visit) {
    var summary = getLabSummaryForVisit(visit);
    var explicit = normalizeLabel(visit && visit.laboratorioPositivoAedes || '');
    if (summary.positiveAedes > 0) {
      return summary.positiveAedes;
    }
    return (explicit === 'sim' || explicit === 's' || explicit === 'true' || explicit.indexOf('positivo') > -1) ? 1 : 0;
  }

  function visitHasAedesPositiveTubito(visit) {
    return getAedesPositiveTubitoCountForVisit(visit) > 0;
  }

  function summarizePropertyComplements(properties) {
    var summary = { Normal: 0, Sequencia: 0, Complemento: 0 };
    (properties || []).forEach(function (property) {
      var complement = normalizePropertyComplement(property && property.complemento);
      if (Object.prototype.hasOwnProperty.call(summary, complement)) {
        summary[complement] += 1;
      }
    });
    return summary;
  }

  function propertyCreatedInCurrentRange(property) {
    var range = getDateRange();
    var createdDate = normalizeDateOnly(property && property.createdAt);
    if (!createdDate) {
      return false;
    }
    if (range.start && createdDate < range.start) {
      return false;
    }
    if (range.end && createdDate > range.end) {
      return false;
    }
    return true;
  }

  function aggregateAgents(visits, properties) {
    var map = {};
    var propertyRows = Array.isArray(properties) ? properties : [];
    function ensureAgent(key) {
      var name = String(key || 'Sem nome').trim() || 'Sem nome';
      if (!map[name]) {
        map[name] = {
          nome: name,
          visitas: 0,
          focos: 0,
          depositos: 0,
          depositosComFoco: 0,
          gps: 0,
          retornos: 0,
          score: 0,
          abertos: 0,
          fechados: 0,
          recuperados: 0,
          cadastros: 0
        };
      }
      return map[name];
    }
    visits.forEach(function (visit) {
      var key = visit.agente || 'Sem nome';
      if (!isRegisteredAgentName(key)) {
        return;
      }
      var row = ensureAgent(key);
      row.visitas += 1;
      row.focos += visit.focusCount;
      row.depositos += visit.depositCount;
      row.depositosComFoco += visit.depositFocusCount;
      row.gps += (visit.gps_lat !== null && visit.gps_lng !== null) ? 1 : 0;
      if (visit.situacao === 'Visitado') {
        row.abertos += 1;
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        row.fechados += 1;
      }
      if (visit.situacao === 'Recuperado') {
        row.recuperados += 1;
      }
    });
    propertyRows.forEach(function (property) {
      var agentName = String(property.createdByName || property.created_by_name || '').trim();
      var agentCode = String(property.createdByMatricula || property.created_by_matricula || '').trim();
      var key = agentName || agentCode;
      if (!key || !propertyCreatedInCurrentRange(property)) {
        return;
      }
      if (!isRegisteredAgentName(key)) {
        return;
      }
      ensureAgent(key).cadastros += 1;
    });
    return Object.keys(map).map(function (key) {
      var item = map[key];
      item.retornos = Math.max(0, item.fechados - item.recuperados);
      item.gpsRate = item.visitas ? Math.round((item.gps / item.visitas) * 100) : 0;
      item.efficiency = (item.visitas * 4) + (item.cadastros * 2) + (item.depositosComFoco * 3) + (item.gps * 2) - (item.retornos * 3);
      return item;
    }).sort(function (a, b) {
      return b.visitas - a.visitas || b.cadastros - a.cadastros || b.focos - a.focos || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
  }

  function aggregateByField(visits, field, predicate) {
    var map = {};
    visits.forEach(function (visit) {
      if (predicate && !predicate(visit)) {
        return;
      }
      var key = String(visit[field] || '').trim();
      if (!key) {
        return;
      }
      if (!map[key]) {
        map[key] = { nome: key, visitas: 0, focos: 0, gps: 0 };
      }
      map[key].visitas += 1;
      map[key].focos += visit.focusCount || 0;
      map[key].gps += (visit.gps_lat !== null && visit.gps_lng !== null) ? 1 : 0;
    });
    return Object.keys(map).map(function (key) {
      var row = map[key];
      row.taxa = row.visitas ? Math.round((row.focos / row.visitas) * 100) : 0;
      return row;
    }).sort(function (a, b) {
      return b.focos - a.focos || b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
  }

  function aggregateByDate(visits) {
    var map = {};
    visits.forEach(function (visit) {
      if (!map[visit.data]) {
        map[visit.data] = { data: visit.data, visitas: 0, focos: 0 };
      }
      map[visit.data].visitas += 1;
      map[visit.data].focos += visit.focusCount || 0;
    });
    return Object.keys(map).sort().map(function (key) { return map[key]; });
  }

  function parseIsoDateSafe(value) {
    var text = String(value || '').trim();
    if (!text) {
      return null;
    }
    var parts = text.split('-');
    if (parts.length !== 3) {
      return null;
    }
    var year = Number(parts[0]);
    var month = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    if (!isFinite(year) || !isFinite(month) || !isFinite(day)) {
      return null;
    }
    return new Date(year, month, day);
  }

  function formatDateShortBR(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function aggregateByWeek(visits) {
    var map = {};
    visits.forEach(function (visit) {
      var baseDate = parseIsoDateSafe(visit.data);
      if (!baseDate) {
        return;
      }
      var weekStart = new Date(baseDate.getTime());
      var day = weekStart.getDay();
      var diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      var weekEnd = new Date(weekStart.getTime());
      weekEnd.setDate(weekStart.getDate() + 6);
      var key = weekStart.getFullYear() + '-' + String(weekStart.getMonth() + 1).padStart(2, '0') + '-' + String(weekStart.getDate()).padStart(2, '0');
      if (!map[key]) {
        map[key] = {
          data: formatDateShortBR(weekStart) + ' a ' + formatDateShortBR(weekEnd),
          visitas: 0,
          focos: 0,
          startKey: key
        };
      }
      map[key].visitas += 1;
      map[key].focos += visit.focusCount || 0;
    });
    return Object.keys(map).sort().map(function (key) { return map[key]; });
  }


  function normalizeTreatmentLabel(value) {
    var text = String(value || '').trim();
    if (!text) {
      return '';
    }
    return text.replace(/\s+/g, ' ').replace(/(^|\s)([a-zà-ÿ])/g, function (_, sep, char) {
      return sep + char.toUpperCase();
    });
  }

  function parseBreakdownMap(value) {
    var map = {};
    String(value || '').split(/[|,;]+/).map(function (part) {
      return String(part || '').trim();
    }).filter(Boolean).forEach(function (part) {
      var match = part.match(/^([A-Z0-9]+)\((\d+)\)$/i) || part.match(/^([A-Z0-9]+)\s*[:=-]\s*(\d+)$/i);
      if (!match) {
        return;
      }
      var code = String(match[1] || '').trim().toUpperCase();
      var qty = Number(match[2] || 0) || 0;
      if (!code || !qty) {
        return;
      }
      map[code] = (map[code] || 0) + qty;
    });
    return map;
  }

  function getVisitBpiGrams(visit) {
    var currentVisit = visit || {};
    var treatmentTotal = Number(currentVisit.depositTreatmentCount || currentVisit.deposit_treatment_count || currentVisit.depositTreatmentTotal || 0) || 0;
    if (treatmentTotal > 0) {
      return treatmentTotal;
    }
    return Number(currentVisit.larvicidaQty || currentVisit.larvicida_qtd || 0) || 0;
  }

  function getVisitTreatedDepositCount(visit) {
    var currentVisit = visit || {};
    var treatmentMap = parseBreakdownMap(currentVisit.depositTreatmentBreakdown || currentVisit.deposit_treatment_breakdown || '');
    var depositMap = parseBreakdownMap(currentVisit.deposits || '');
    var focusMap = parseBreakdownMap(currentVisit.depositFocusBreakdown || currentVisit.deposit_focus_breakdown || '');
    var treated = 0;

    Object.keys(treatmentMap).forEach(function (code) {
      if (Number(treatmentMap[code] || 0) > 0) {
        treated += Math.max(1, Number(depositMap[code] || 0), Number(focusMap[code] || 0));
      }
    });

    if (treated > 0) {
      return treated;
    }

    if (getVisitBpiGrams(currentVisit) > 0) {
      var focusTotal = Object.keys(focusMap).reduce(function (sum, code) { return sum + (Number(focusMap[code] || 0) || 0); }, 0);
      var depositTotal = Number(currentVisit.depositCount || currentVisit.deposit_count || 0) || Object.keys(depositMap).reduce(function (sum, code) { return sum + (Number(depositMap[code] || 0) || 0); }, 0);
      return focusTotal || depositTotal || 1;
    }

    return 0;
  }

  function formatFocusDepositCodes(visit) {
    var map = parseBreakdownMap(visit && visit.depositFocusBreakdown);
    var codes = Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

    if (codes.length) {
      return codes.map(function (code) {
        return code + '(' + String(map[code]) + ')';
      }).join(' • ');
    }

    return String((visit && visit.focusCount) || 0);
  }

  function aggregateTreatmentByFocusType(visits) {
    var map = {};

    function ensure(code) {
      var key = String(code || '').trim().toUpperCase();
      if (!key || !DEPOSITS[key]) {
        return null;
      }
      if (!map[key]) {
        map[key] = {
          code: key,
          label: DEPOSITS[key],
          deposits: 0,
          grams: 0
        };
      }
      return map[key];
    }

    visits.forEach(function (visit) {
      var focusMap = parseBreakdownMap(visit.depositFocusBreakdown);
      var treatmentMap = parseBreakdownMap(visit.depositTreatmentBreakdown);
      var focusCodes = Object.keys(focusMap);
      var treatmentCodes = Object.keys(treatmentMap);
      var larvicidaQty = Number(visit.larvicidaQty || 0) || 0;

      if (!focusCodes.length && !treatmentCodes.length) {
        return;
      }

      focusCodes.forEach(function (code) {
        var row = ensure(code);
        if (row) {
          row.deposits += Number(focusMap[code] || 0) || 0;
        }
      });

      if (treatmentCodes.length) {
        treatmentCodes.forEach(function (code) {
          var row = ensure(code);
          if (row) {
            row.grams += Number(treatmentMap[code] || 0) || 0;
            if (!focusMap[code] && !focusCodes.length) {
              row.deposits += 1;
            }
          }
        });
      } else if (larvicidaQty > 0 && focusCodes.length) {
        var totalFocusDeposits = focusCodes.reduce(function (sum, code) {
          return sum + (Number(focusMap[code] || 0) || 0);
        }, 0) || focusCodes.length;
        var used = 0;
        focusCodes.forEach(function (code, index) {
          var row = ensure(code);
          if (!row) {
            return;
          }
          var qty = Number(focusMap[code] || 0) || 0;
          var share = index === focusCodes.length - 1
            ? Math.max(0, larvicidaQty - used)
            : Math.round((qty / totalFocusDeposits) * larvicidaQty);
          used += share;
          row.grams += share;
        });
      }
    });

    return Object.keys(map).map(function (key) {
      return map[key];
    }).filter(function (row) {
      return row.deposits > 0 || row.grams > 0;
    }).sort(function (a, b) {
      return b.grams - a.grams || b.deposits - a.deposits || a.code.localeCompare(b.code, 'pt-BR', { numeric: true });
    });
  }

  function aggregateFocusByDeposit(visits, includeZero) {
    var map = { A1: 0, A2: 0, B: 0, C: 0, D1: 0, D2: 0, E: 0 };
    visits.forEach(function (visit) {
      String(visit.depositFocusBreakdown || '')
        .split('|')
        .map(function (part) { return part.trim(); })
        .filter(Boolean)
        .forEach(function (part) {
          var match = part.match(/^([A-Z0-9]+)\((\d+)\)$/i);
          if (!match) {
            return;
          }
          var code = normalizeCode(match[1]);
          if (Object.prototype.hasOwnProperty.call(map, code)) {
            map[code] += Number(match[2] || 0);
          }
        });
    });
    return Object.keys(map).map(function (code) {
      return { code: code, total: map[code], label: DEPOSITS[code] };
    }).filter(function (row) { return includeZero || row.total > 0; }).sort(function (a, b) {
      return b.total - a.total || a.code.localeCompare(b.code);
    });
  }

  function computeMetrics(visits) {
    var gpsCount = 0;
    var deposits = 0;
    var depositsWithFocus = 0;
    var depositsTreated = 0;
    var bpiGrams = 0;
    var focusVisits = 0;
    var tubitos = 0;
    var labSummary = summarizeLabTubitos(getTubitosForVisits(visits));
    var opened = 0;
    var closed = 0;
    var recovered = 0;
    var pending = 0;
    var propertyVisitCounts = {};
    var workedPropertyCounts = {};
    var activeAgents = {};

    visits.forEach(function (visit) {
      var visitKey = propertyVisitKey(visit);
      var agentKey = String(visit.matricula || visit.agente || '').trim();
      if (agentKey && isRegisteredAgentName(visit.agente || agentKey)) {
        activeAgents[agentKey.toLowerCase()] = true;
      }
      if (visitKey) {
        propertyVisitCounts[visitKey] = (propertyVisitCounts[visitKey] || 0) + 1;
      }
      gpsCount += (visit.gps_lat !== null && visit.gps_lng !== null) ? 1 : 0;
      deposits += visit.depositCount;
      depositsWithFocus += visit.depositFocusCount;
      depositsTreated += getVisitTreatedDepositCount(visit);
      bpiGrams += getVisitBpiGrams(visit);
      focusVisits += visit.foco === 'Sim' ? 1 : 0;
      tubitos += Number(visit.tubitos_qtd || visit.tubitosQty || 0) || 0;
      if (visit.situacao === 'Visitado') {
        opened += 1;
        if (visitKey) {
          workedPropertyCounts[visitKey] = (workedPropertyCounts[visitKey] || 0) + 1;
        }
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        closed += 1;
      }
      if (visit.situacao === 'Recuperado') {
        recovered += 1;
        if (visitKey) {
          workedPropertyCounts[visitKey] = (workedPropertyCounts[visitKey] || 0) + 1;
        }
      }
    });
    var workedProperties = opened + recovered;
    var totalProperties = Object.keys(workedPropertyCounts).length;
    var repeatedProperties = Math.max(0, workedProperties - totalProperties);
    pending = Math.max(0, closed - recovered);

    return {
      totalVisits: visits.length,
      activeAgents: Object.keys(activeAgents).length,
      visitedProperties: workedProperties,
      totalProperties: totalProperties,
      repeatedProperties: repeatedProperties,
      opened: opened,
      closed: closed,
      recovered: recovered,
      pending: pending,
      deposits: deposits,
      depositsWithFocus: depositsWithFocus,
      depositsEliminated: deposits,
      depositsTreated: depositsTreated,
      bpiGrams: bpiGrams,
      tubitos: tubitos,
      labTotal: labSummary.total,
      labPositiveAedes: labSummary.positiveAedes,
      labPending: labSummary.pending,
      labNegative: labSummary.negative,
      labInconclusive: labSummary.inconclusive,
      infestationRate: deposits ? Number(((depositsWithFocus / deposits) * 100).toFixed(1)) : 0,
      gpsCoverage: visits.length ? Math.round((gpsCount / visits.length) * 100) : 0,
      returns: pending,
      focusVisits: focusVisits
    };
  }

  function summarizeOperationsForVisits(visits) {
    var order = ['VD', 'PE', 'LIRAA'];
    var map = {};
    var visitModeByUid = {};

    function ensure(mode) {
      mode = normalizeOperationMode(mode);
      if (!map[mode]) {
        map[mode] = {
          mode: mode,
          label: operationModeLabel(mode),
          visits: 0,
          properties: 0,
          focus: 0,
          deposits: 0,
          depositsWithFocus: 0,
          depositsTreated: 0,
          bpiGrams: 0,
          depositsEliminated: 0,
          tubitos: 0,
          labTotal: 0,
          labPositiveAedes: 0,
          labPending: 0,
          propertyMap: {}
        };
      }
      return map[mode];
    }

    order.forEach(ensure);

    (visits || []).forEach(function (visit) {
      var mode = getVisitOperationMode(visit);
      var row = ensure(mode);
      var propertyKey = propertyVisitKey(visit);
      if (visit && visit.uid) {
        visitModeByUid[String(visit.uid)] = mode;
      }
      row.visits += 1;
      row.focus += Number(visit.focusCount || 0) || 0;
      row.deposits += Number(visit.depositCount || 0) || 0;
      row.depositsWithFocus += Number(visit.depositFocusCount || 0) || 0;
      row.depositsTreated += getVisitTreatedDepositCount(visit);
      row.bpiGrams += getVisitBpiGrams(visit);
      row.depositsEliminated += Number(visit.depositCount || 0) || 0;
      if (propertyKey) {
        row.propertyMap[propertyKey] = true;
      }
    });

    var tubitosByVisitUid = {};
    getTubitosForVisits(visits || []).forEach(function (tubito) {
      var visitUid = String(tubito && tubito.visit_uid || '').trim();
      var mode = normalizeOperationMode(visitModeByUid[visitUid] || tubito.operationMode || tubito.operation_mode || tubito.origemVisita || tubito.origem_visita || 'VD');
      var row = ensure(mode);
      row.tubitos += 1;
      row.labTotal += 1;
      if (visitUid) {
        tubitosByVisitUid[visitUid] = (tubitosByVisitUid[visitUid] || 0) + 1;
      }
      if (isAedesPositiveTubito(tubito)) {
        row.labPositiveAedes += 1;
      }
      if (isPendingTubito(tubito)) {
        row.labPending += 1;
      }
    });

    (visits || []).forEach(function (visit) {
      var visitUid = String(visit && visit.uid || '').trim();
      var qty = Number(visit && (visit.tubitos_qtd || visit.tubitosQty) || 0) || 0;
      if (qty > 0 && (!visitUid || !tubitosByVisitUid[visitUid])) {
        ensure(getVisitOperationMode(visit)).tubitos += qty;
      }
    });

    return order.map(function (mode) {
      var row = ensure(mode);
      row.properties = Object.keys(row.propertyMap).length;
      delete row.propertyMap;
      return row;
    });
  }

  function buildOperationSummaryHtml(rows) {
    rows = Array.isArray(rows) ? rows : [];
    return '<table><thead><tr><th>Operação</th><th>Visitas</th><th>Imoveis</th><th>Focos</th><th>Dep. encontrados</th><th>Dep. com foco</th><th>Dep. tratados</th><th>BPI (g)</th><th>Dep. eliminados</th><th>Tubitos</th><th>Aedes +</th><th>Lab pendente</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr><td>' + escapeHtml(row.label) + '</td><td>' + escapeHtml(row.visits) + '</td><td>' + escapeHtml(row.properties) + '</td><td>' + escapeHtml(row.focus) + '</td><td>' + escapeHtml(row.deposits) + '</td><td>' + escapeHtml(row.depositsWithFocus) + '</td><td>' + escapeHtml(row.depositsTreated || 0) + '</td><td>' + escapeHtml(row.bpiGrams || 0) + '</td><td>' + escapeHtml(row.depositsEliminated) + '</td><td>' + escapeHtml(row.tubitos) + '</td><td>' + escapeHtml(row.labPositiveAedes) + '</td><td>' + escapeHtml(row.labPending) + '</td></tr>';
      }).join('') +
      '</tbody></table>';
  }

  function aggregateComparative(visits, field) {
    var map = {};
    visits.forEach(function (visit) {
      var value = String(visit[field] || '').trim();
      var microarea = String(visit.microarea || '').trim();
      var key = value;
      if (!value) {
        return;
      }
      if (field === 'quarteirao') {
        key = [microarea || 'Sem microárea', value].join('||');
      }
      if (!map[key]) {
        map[key] = {
          nome: value,
          microarea: microarea,
          visitas: 0,
          focos: 0,
          fechados: 0,
          abertos: 0,
          recuperados: 0,
          pendencias: 0,
          tubitos: 0
        };
      }
      map[key].visitas += 1;
      map[key].focos += visit.focusCount || 0;
      map[key].tubitos += Number(visit.tubitos_qtd || visit.tubitosQty || 0) || 0;
      if (visit.situacao === 'Visitado') {
        map[key].abertos += 1;
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        map[key].fechados += 1;
      }
      if (visit.situacao === 'Recuperado') {
        map[key].recuperados += 1;
      }
    });
    return Object.keys(map).map(function (key) {
      var row = map[key];
      row.pendencias = Math.max(0, row.fechados - row.recuperados);
      return row;
    }).sort(function (a, b) {
      var aLabel = field === 'quarteirao' ? [a.microarea || '', a.nome].join(' ') : a.nome;
      var bLabel = field === 'quarteirao' ? [b.microarea || '', b.nome].join(' ') : b.nome;
      return b.focos - a.focos || b.pendencias - a.pendencias || b.visitas - a.visitas || aLabel.localeCompare(bLabel, 'pt-BR', { numeric: true });
    });
  }

  function aggregateCriticalStreets(visits) {
    var map = {};
    visits.forEach(function (visit) {
      var logradouro = String(visit.logradouro || '').trim();
      var bairro = String(visit.bairro || '').trim();
      if (!logradouro) {
        return;
      }
      var key = [bairro, logradouro].join('|').toLowerCase();
      if (!map[key]) {
        map[key] = {
          nome: logradouro,
          bairro: bairro || 'Sem bairro',
          visitas: 0,
          focos: 0,
          depositosComFoco: 0,
          pendencias: 0
        };
      }
      map[key].visitas += 1;
      map[key].focos += Number(visit.focusCount || 0) || 0;
      map[key].depositosComFoco += Number(visit.depositFocusCount || 0) || 0;
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        map[key].pendencias += 1;
      }
    });
    return Object.keys(map).map(function (key) {
      var row = map[key];
      row.criticidade = row.focos + row.depositosComFoco;
      return row;
    }).filter(function (row) {
      return row.criticidade > 0;
    }).sort(function (a, b) {
      return b.criticidade - a.criticidade || b.pendencias - a.pendencias || b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
  }

  function renderBarCards(containerId, rows, cfg) {
    var node = document.getElementById(containerId);
    if (!node) {
      return;
    }
    if (!rows.length) {
      node.innerHTML = '<div class="empty-state">Sem dados para este recorte.</div>';
      return;
    }
    var max = rows.reduce(function (acc, row) {
      return Math.max(acc, Number(cfg.value(row) || 0));
    }, 1);
    node.innerHTML = rows.slice(0, cfg.limit || rows.length).map(function (row, index) {
      var width = Math.max(8, Math.round((Number(cfg.value(row) || 0) / max) * 100));
      var drillField = cfg.drillField || '';
      var drillValue = drillField && typeof cfg.drillValue === 'function' ? cfg.drillValue(row) : (drillField ? row.nome : '');
      return '<div class="chart-card' + (drillField ? ' is-clickable' : '') + '"' +
        (drillField ? ' data-drill-field="' + escapeHtml(drillField) + '" data-drill-value="' + escapeHtml(String(drillValue || '')) + '"' : '') +
        '><strong>' + escapeHtml((index + 1) + '. ' + cfg.label(row)) + '</strong><div style="margin:8px 0;color:#66727c">' + escapeHtml(cfg.meta(row)) + '</div><div class="rank-row"><span>' + escapeHtml(String(cfg.value(row))) + '</span><div class="bar-track"><div class="bar-fill ' + (cfg.kind || '') + '" style="width:' + width + '%"></div></div><span>' + escapeHtml(cfg.suffix || '') + '</span></div></div>';
    }).join('');
  }

  function formatDateShortBR(value) {
    if (!value) {
      return '-';
    }
    var parts = String(value).split('-');
    if (parts.length === 3) {
      return parts[2] + '/' + parts[1];
    }
    var label = formatDateBR(value);
    return label.length >= 5 ? label.slice(0, 5) : label;
  }

  function buildTrendColumnsHtml(rows) {
    var maxFocus = rows.reduce(function (acc, row) {
      return Math.max(acc, Number(row.focos || 0));
    }, 0);
    if (!rows.length) {
      return '<div class="empty-state">Sem dados para este recorte.</div>';
    }
    return '<div class="trend-mini-chart">' + rows.slice(0, 5).map(function (row) {
      var focus = Number(row.focos || 0);
      var visits = Number(row.visitas || 0);
      var height = maxFocus > 0 ? Math.max(10, Math.round((focus / maxFocus) * 100)) : 10;
      var barClass = focus > 0 ? ' is-danger' : ' is-muted';
      return '<div class="trend-col">' +
        '<div class="trend-col-head">' + escapeHtml(formatDateShortBR(row.data)) + '</div>' +
        '<div class="trend-col-plot"><div class="trend-col-bar' + barClass + '" style="height:' + height + '%"></div></div>' +
        '<div class="trend-col-meta">' +
          '<span class="trend-chip is-danger">' + escapeHtml(String(focus)) + ' foco(s)</span>' +
          '<span class="trend-chip">' + escapeHtml(String(visits)) + ' visita(s)</span>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderTrendColumns(containerId, rows) {
    var node = document.getElementById(containerId);
    if (!node) {
      return;
    }
    node.innerHTML = buildTrendColumnsHtml(rows);
  }

  function renderCompactMetricList(containerId, rows, cfg) {
    var node = document.getElementById(containerId);
    if (!node) {
      return;
    }
    if (!rows.length) {
      node.innerHTML = '<div class="empty-state">Sem dados para este recorte.</div>';
      return;
    }
    node.innerHTML = '<div class="compact-metric-list">' + rows.slice(0, cfg.limit || rows.length).map(function (row, index) {
      return '<div class="compact-metric-row">' +
        '<div class="compact-metric-main">' +
          '<strong>' + escapeHtml((index + 1) + '. ' + cfg.label(row)) + '</strong>' +
          '<span>' + escapeHtml(cfg.meta(row)) + '</span>' +
        '</div>' +
        '<div class="compact-metric-value">' + escapeHtml(String(cfg.value(row))) + ' ' + escapeHtml(cfg.unit || '') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderCompactComparative(containerId, rows, cfg) {
    var node = document.getElementById(containerId);
    if (!node) {
      return;
    }
    if (!rows.length) {
      node.innerHTML = '<div class="empty-state">Sem dados para este recorte.</div>';
      return;
    }
    var headers = cfg.columns.map(function (column) {
      return '<span>' + escapeHtml(column.label) + '</span>';
    }).join('');
    node.innerHTML = '<div class="compact-compare-table">' +
      '<div class="compact-compare-head">' + headers + '<span>Atenção</span></div>' +
      rows.slice(0, cfg.limit || rows.length).map(function (row, index) {
        var drillField = cfg.drillField || '';
        var drillValue = drillField ? (typeof cfg.drillValue === 'function' ? cfg.drillValue(row) : row.nome) : '';
        var cells = cfg.columns.map(function (column) {
          return '<span>' + escapeHtml(String(column.value(row, index) || '')) + '</span>';
        }).join('');
        return '<div class="compact-compare-row' + (drillField ? ' is-clickable' : '') + '"' +
          (drillField ? ' data-drill-field="' + escapeHtml(drillField) + '" data-drill-value="' + escapeHtml(String(drillValue || '')) + '"' : '') + '>' +
          cells +
          '<strong>' + escapeHtml(String(cfg.attention(row))) + '</strong>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderComparatives(visits) {
    if (!document.getElementById('compareBairros')) {
      return;
    }
    renderCompactComparative('compareBairros', aggregateComparative(visits, 'bairro'), {
      limit: 6,
      drillField: 'bairro',
      attention: function (row) { return row.focos + row.pendencias; },
      columns: [
        { label: 'Bairro', value: function (row, index) { return (index + 1) + '. ' + row.nome; } },
        { label: 'Vis.', value: function (row) { return row.visitas; } },
        { label: 'Ab.', value: function (row) { return row.abertos; } },
        { label: 'Fech.', value: function (row) { return row.fechados; } }
      ]
    });
    renderCompactComparative('compareMicroareas', aggregateComparative(visits, 'microarea'), {
      limit: 6,
      drillField: 'microarea',
      attention: function (row) { return row.focos + row.pendencias; },
      columns: [
        { label: 'Microárea', value: function (row, index) { return (index + 1) + '. MA ' + row.nome; } },
        { label: 'Vis.', value: function (row) { return row.visitas; } },
        { label: 'Tub.', value: function (row) { return row.tubitos; } },
        { label: 'Pend.', value: function (row) { return row.pendencias; } }
      ]
    });
    renderCompactComparative('compareQuarteiroes', aggregateComparative(visits, 'quarteirao'), {
      limit: 6,
      drillField: 'quarteirao',
      attention: function (row) { return row.focos + row.pendencias; },
      columns: [
        { label: 'Qrt.', value: function (row, index) {
          var prefix = row.microarea ? (row.microarea + ' • ') : '';
          return (index + 1) + '. ' + prefix + 'Q ' + row.nome;
        } },
        { label: 'Vis.', value: function (row) { return row.visitas; } },
        { label: 'Ab.', value: function (row) { return row.abertos; } },
        { label: 'Pend.', value: function (row) { return row.pendencias; } }
      ]
    });
    renderCompactComparative('compareLogradouros', aggregateComparative(visits, 'logradouro'), {
      limit: 6,
      drillField: 'logradouro',
      attention: function (row) { return row.focos + row.pendencias; },
      columns: [
        { label: 'Logradouro', value: function (row, index) { return (index + 1) + '. ' + row.nome; } },
        { label: 'Vis.', value: function (row) { return row.visitas; } },
        { label: 'Pend.', value: function (row) { return row.pendencias; } },
        { label: 'Focos', value: function (row) { return row.focos; } }
      ]
    });
  }


  function addDaysToIso(value, amount) {
    var date = parseIsoDateSafe(value);
    if (!date) {
      return '';
    }
    date.setDate(date.getDate() + Number(amount || 0));
    return toLocalIsoDate(date);
  }

  function getInclusiveDays(start, end) {
    var startDate = parseIsoDateSafe(start);
    var endDate = parseIsoDateSafe(end);
    if (!startDate || !endDate) {
      return 1;
    }
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  }

  function getPreviousStatsRange(range) {
    var days = getInclusiveDays(range.start, range.end);
    var previousEnd = addDaysToIso(range.start, -1);
    var previousStart = addDaysToIso(previousEnd, -(days - 1));
    return { start: previousStart, end: previousEnd, days: days };
  }

  function getStatsFilterValues() {
    var situacao = document.getElementById('situacaoFilter') ? document.getElementById('situacaoFilter').value : '';
    return {
      bairro: document.getElementById('bairroFilter') ? document.getElementById('bairroFilter').value : '',
      microarea: document.getElementById('microareaFilter') ? document.getElementById('microareaFilter').value : '',
      quarteirao: document.getElementById('quarteiraoFilter') ? document.getElementById('quarteiraoFilter').value : '',
      logradouro: document.getElementById('logradouroFilter') ? document.getElementById('logradouroFilter').value : '',
      agent: document.getElementById('agentFilter') ? document.getElementById('agentFilter').value : '',
      situacoes: normalizeSituacaoFilterValue(situacao),
      foco: document.getElementById('focoFilter') ? document.getElementById('focoFilter').value : '',
      gps: document.getElementById('gpsFilter') ? document.getElementById('gpsFilter').value : '',
      operation: document.getElementById('operationFilter') ? document.getElementById('operationFilter').value : '',
      search: document.getElementById('searchFilter') ? String(document.getElementById('searchFilter').value || '').trim().toLowerCase() : ''
    };
  }

  function visitMatchesStatsFilters(visit, range, filters) {
    if (!visit) {
      return false;
    }
    if (range && range.start && visit.data < range.start) { return false; }
    if (range && range.end && visit.data > range.end) { return false; }
    if (filters.bairro && visit.bairro !== filters.bairro) { return false; }
    if (filters.microarea && String(visit.microarea) !== filters.microarea) { return false; }
    if (filters.quarteirao && String(visit.quarteirao) !== filters.quarteirao) { return false; }
    if (filters.logradouro && visit.logradouro !== filters.logradouro) { return false; }
    if (filters.agent && visit.agente !== filters.agent) { return false; }
    if (filters.situacoes && filters.situacoes.length && filters.situacoes.indexOf(visit.situacao) === -1) { return false; }
    if (filters.foco === 'com_foco' && !visitHasFocus(visit)) { return false; }
    if (filters.foco === 'sem_foco' && visitHasFocus(visit)) { return false; }
    if (filters.gps === 'com_gps' && !visitHasGps(visit)) { return false; }
    if (filters.gps === 'sem_gps' && visitHasGps(visit)) { return false; }
    if (filters.operation && getVisitOperationMode(visit) !== normalizeOperationMode(filters.operation)) { return false; }
    if (filters.search) {
      var text = [visit.bairro, visit.microarea, visit.quarteirao, visit.logradouro, visit.numero, visit.morador, visit.agente, visit.situacao].join(' ').toLowerCase();
      if (text.indexOf(filters.search) === -1) { return false; }
    }
    return true;
  }

  function getStatsVisitsForRange(range, filters) {
    return (state.allVisits || []).filter(function (visit) {
      return visitMatchesStatsFilters(visit, range, filters || getStatsFilterValues());
    }).sort(function (a, b) {
      return String(a.data || '').localeCompare(String(b.data || '')) || String(a.hora || '').localeCompare(String(b.hora || ''));
    });
  }

  function computeStatsBundle(visits) {
    var metrics = computeMetrics(visits || []);
    var focusTotal = getVisitFocusTotal(visits || []);
    var positives = focusTotal + Number(metrics.depositsWithFocus || 0) + Number(metrics.labPositiveAedes || 0);
    return {
      visits: visits || [],
      metrics: metrics,
      focusTotal: focusTotal,
      positives: positives,
      labRate: metrics.labTotal ? Number(((metrics.labPositiveAedes / metrics.labTotal) * 100).toFixed(1)) : 0
    };
  }

  function statsDelta(current, previous) {
    var diff = Number(current || 0) - Number(previous || 0);
    var pct = previous ? Math.round((diff / Number(previous || 1)) * 100) : (current ? 100 : 0);
    return { diff: diff, pct: pct };
  }

  function formatSignedNumber(value, suffix) {
    var number = Number(value || 0);
    var signal = number > 0 ? '+' : '';
    return signal + String(number).replace('.', ',') + (suffix || '');
  }

  function formatPercentDelta(delta) {
    return formatSignedNumber(delta.pct, '%');
  }

  function statsTone(delta, inverse) {
    var diff = Number(delta && delta.diff || 0);
    if (!diff) {
      return 'stable';
    }
    return inverse ? (diff > 0 ? 'bad' : 'good') : (diff > 0 ? 'good' : 'bad');
  }

  function buildStatsKpi(label, current, previous, options) {
    options = options || {};
    var delta = statsDelta(Number(current || 0), Number(previous || 0));
    var tone = options.tone || statsTone(delta, !!options.inverse);
    var value = options.format ? options.format(current) : String(current);
    var previousText = options.format ? options.format(previous) : String(previous);
    var deltaText = options.points ? formatSignedNumber(Number(current || 0) - Number(previous || 0), ' p.p.') : formatPercentDelta(delta);
    return '<div class="statistics-kpi is-' + escapeHtml(tone) + '">' +
      '<small>' + escapeHtml(label) + '</small>' +
      '<strong>' + escapeHtml(value) + '</strong>' +
      '<span>Anterior: ' + escapeHtml(previousText) + ' • ' + escapeHtml(deltaText) + '</span>' +
    '</div>';
  }

  function buildStatsComparisonRows(current, previous) {
    var currentMetrics = current.metrics;
    var previousMetrics = previous.metrics;
    return [
      { label: 'Visitas', current: currentMetrics.totalVisits, previous: previousMetrics.totalVisits, inverse: false },
      { label: 'Imóveis trabalhados', current: currentMetrics.visitedProperties, previous: previousMetrics.visitedProperties, inverse: false },
      { label: 'Focos identificados', current: current.focusTotal, previous: previous.focusTotal, inverse: true },
      { label: 'Depósitos com foco', current: currentMetrics.depositsWithFocus, previous: previousMetrics.depositsWithFocus, inverse: true },
      { label: 'Tubitos Aedes +', current: currentMetrics.labPositiveAedes, previous: previousMetrics.labPositiveAedes, inverse: true },
      { label: 'Pendências', current: currentMetrics.pending, previous: previousMetrics.pending, inverse: true },
      { label: 'Caixas abertas/tratadas', current: currentMetrics.depositsTreated || 0, previous: previousMetrics.depositsTreated || 0, inverse: false },
      { label: 'GPS capturado', current: currentMetrics.gpsCoverage, previous: previousMetrics.gpsCoverage, inverse: false, points: true, suffix: '%' }
    ];
  }

  function buildStatsComparisonTable(rows) {
    if (!rows.length) {
      return '<div class="empty-state">Sem dados para comparar.</div>';
    }
    return '<div class="statistics-table">' +
      '<div class="statistics-table-head"><span>Indicador</span><span>Atual</span><span>Anterior</span><span>Variação</span></div>' +
      rows.map(function (row) {
        var delta = statsDelta(row.current, row.previous);
        var tone = statsTone(delta, !!row.inverse);
        var current = (row.suffix && !row.points) ? (row.current + row.suffix) : row.current;
        var previous = (row.suffix && !row.points) ? (row.previous + row.suffix) : row.previous;
        var variation = row.points ? formatSignedNumber(Number(row.current || 0) - Number(row.previous || 0), ' p.p.') : formatPercentDelta(delta);
        if (row.points) {
          current = row.current + '%';
          previous = row.previous + '%';
        }
        return '<div class="statistics-table-row is-' + escapeHtml(tone) + '">' +
          '<strong>' + escapeHtml(row.label) + '</strong>' +
          '<span>' + escapeHtml(String(current)) + '</span>' +
          '<span>' + escapeHtml(String(previous)) + '</span>' +
          '<em>' + escapeHtml(variation) + '</em>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function aggregateStatisticsTimeline(visits, mode) {
    var map = {};
    (visits || []).forEach(function (visit) {
      var baseDate = parseIsoDateSafe(visit.data);
      if (!baseDate) {
        return;
      }
      var key;
      var label;
      if (mode === 'week') {
        var weekStart = new Date(baseDate.getTime());
        var day = weekStart.getDay();
        var diff = day === 0 ? -6 : 1 - day;
        weekStart.setDate(weekStart.getDate() + diff);
        weekStart.setHours(0, 0, 0, 0);
        var weekEnd = new Date(weekStart.getTime());
        weekEnd.setDate(weekStart.getDate() + 6);
        key = toLocalIsoDate(weekStart);
        label = formatDateShortBR(toLocalIsoDate(weekStart)) + ' a ' + formatDateShortBR(toLocalIsoDate(weekEnd));
      } else {
        key = visit.data;
        label = formatDateShortBR(visit.data);
      }
      if (!map[key]) {
        map[key] = { key: key, label: label, visitas: 0, focos: 0, depositosComFoco: 0, labPositive: 0, positivos: 0 };
      }
      map[key].visitas += 1;
      map[key].focos += getVisitFocusTotal([visit]);
      map[key].depositosComFoco += Number(visit.depositFocusCount || 0) || 0;
      map[key].labPositive += getAedesPositiveTubitoCountForVisit(visit);
      map[key].positivos = map[key].focos + map[key].depositosComFoco + map[key].labPositive;
    });
    return Object.keys(map).sort().map(function (key) { return map[key]; });
  }

  function buildStatisticsTrendHtml(rows) {
    if (!rows.length) {
      return '<div class="empty-state">Sem evolução no recorte selecionado.</div>';
    }
    var visible = rows.slice(-8);
    var max = visible.reduce(function (acc, row) {
      return Math.max(acc, row.focos, row.depositosComFoco, row.labPositive, 1);
    }, 1);
    return '<div class="statistics-trend-chart">' + visible.map(function (row) {
      var focusWidth = Math.max(4, Math.round((row.focos / max) * 100));
      var depWidth = Math.max(4, Math.round((row.depositosComFoco / max) * 100));
      var labWidth = Math.max(4, Math.round((row.labPositive / max) * 100));
      return '<div class="statistics-trend-row">' +
        '<div class="statistics-trend-label"><strong>' + escapeHtml(row.label) + '</strong><span>' + escapeHtml(String(row.visitas)) + ' visita(s)</span></div>' +
        '<div class="statistics-trend-bars">' +
          '<span><i>Focos</i><b style="width:' + focusWidth + '%"></b><em>' + escapeHtml(String(row.focos)) + '</em></span>' +
          '<span><i>Dep. foco</i><b style="width:' + depWidth + '%"></b><em>' + escapeHtml(String(row.depositosComFoco)) + '</em></span>' +
          '<span><i>Lab +</i><b style="width:' + labWidth + '%"></b><em>' + escapeHtml(String(row.labPositive)) + '</em></span>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function aggregateStatsByField(visits, field) {
    var map = {};
    (visits || []).forEach(function (visit) {
      var key = String(visit[field] || '').trim() || 'Sem informação';
      if (!map[key]) {
        map[key] = { nome: key, visitas: 0, focos: 0, depositosComFoco: 0, labPositive: 0, pendencias: 0, score: 0 };
      }
      map[key].visitas += 1;
      map[key].focos += getVisitFocusTotal([visit]);
      map[key].depositosComFoco += Number(visit.depositFocusCount || 0) || 0;
      map[key].labPositive += getAedesPositiveTubitoCountForVisit(visit);
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        map[key].pendencias += 1;
      }
      map[key].score = map[key].focos + map[key].depositosComFoco + map[key].labPositive + map[key].pendencias;
    });
    return map;
  }

  function compareStatsMaps(currentMap, previousMap) {
    var keys = {};
    Object.keys(currentMap || {}).forEach(function (key) { keys[key] = true; });
    Object.keys(previousMap || {}).forEach(function (key) { keys[key] = true; });
    return Object.keys(keys).map(function (key) {
      var current = currentMap[key] || { nome: key, visitas: 0, focos: 0, depositosComFoco: 0, labPositive: 0, pendencias: 0, score: 0 };
      var previous = previousMap[key] || { score: 0, visitas: 0, focos: 0, depositosComFoco: 0, labPositive: 0, pendencias: 0 };
      var delta = Number(current.score || 0) - Number(previous.score || 0);
      return {
        nome: current.nome || key,
        visitas: current.visitas || 0,
        currentScore: current.score || 0,
        previousScore: previous.score || 0,
        delta: delta,
        focos: current.focos || 0,
        depositosComFoco: current.depositosComFoco || 0,
        labPositive: current.labPositive || 0,
        pendencias: current.pendencias || 0,
        status: delta > 0 ? 'Piorou' : delta < 0 ? 'Melhorou' : 'Estável'
      };
    }).filter(function (row) {
      return row.currentScore > 0 || row.previousScore > 0 || row.visitas > 0;
    }).sort(function (a, b) {
      return Math.abs(b.delta) - Math.abs(a.delta) || b.currentScore - a.currentScore || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
  }

  function buildTerritoryEvolutionHtml(rows, label) {
    if (!rows.length) {
      return '<div class="empty-state">Sem território com alteração no recorte.</div>';
    }
    return '<div class="statistics-table statistics-table--territory">' +
      '<div class="statistics-table-head"><span>' + escapeHtml(label) + '</span><span>Atual</span><span>Anterior</span><span>Status</span></div>' +
      rows.slice(0, 8).map(function (row) {
        var tone = row.delta > 0 ? 'bad' : row.delta < 0 ? 'good' : 'stable';
        return '<div class="statistics-table-row is-' + tone + '" data-drill-field="' + escapeHtml(label === 'Bairro' ? 'bairro' : label === 'Microárea' ? 'microarea' : 'quarteirao') + '" data-drill-value="' + escapeHtml(row.nome) + '">' +
          '<strong>' + escapeHtml(row.nome) + '</strong>' +
          '<span>' + escapeHtml(String(row.currentScore)) + '</span>' +
          '<span>' + escapeHtml(String(row.previousScore)) + '</span>' +
          '<em>' + escapeHtml(row.status + ' ' + formatSignedNumber(row.delta, '')) + '</em>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function compareDepositEvolution(currentVisits, previousVisits) {
    var currentRows = aggregateFocusByDeposit(currentVisits || [], true);
    var previousRows = aggregateFocusByDeposit(previousVisits || [], true);
    var currentMap = {};
    var previousMap = {};
    currentRows.forEach(function (row) { currentMap[row.code] = row; });
    previousRows.forEach(function (row) { previousMap[row.code] = row; });
    return Object.keys(DEPOSITS).map(function (code) {
      var current = currentMap[code] ? Number(currentMap[code].total || 0) : 0;
      var previous = previousMap[code] ? Number(previousMap[code].total || 0) : 0;
      return {
        code: code,
        label: DEPOSITS[code],
        current: current,
        previous: previous,
        delta: current - previous
      };
    }).filter(function (row) {
      return row.current > 0 || row.previous > 0;
    }).sort(function (a, b) {
      return Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current || a.code.localeCompare(b.code);
    });
  }

  function buildDepositEvolutionHtml(rows) {
    if (!rows.length) {
      return '<div class="empty-state">Sem depósitos com foco para comparar.</div>';
    }
    return '<div class="statistics-table statistics-table--deposits">' +
      '<div class="statistics-table-head"><span>Depósito</span><span>Atual</span><span>Anterior</span><span>Variação</span></div>' +
      rows.map(function (row) {
        var tone = row.delta > 0 ? 'bad' : row.delta < 0 ? 'good' : 'stable';
        return '<div class="statistics-table-row is-' + tone + '">' +
          '<strong>' + escapeHtml(row.code + ' • ' + row.label) + '</strong>' +
          '<span>' + escapeHtml(String(row.current)) + '</span>' +
          '<span>' + escapeHtml(String(row.previous)) + '</span>' +
          '<em>' + escapeHtml(formatSignedNumber(row.delta, '')) + '</em>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function buildStatsLabHtml(current, previous) {
    var currentMetrics = current.metrics;
    var previousMetrics = previous.metrics;
    var deltaPositive = statsDelta(currentMetrics.labPositiveAedes, previousMetrics.labPositiveAedes);
    return '<div class="statistics-insight is-' + statsTone(deltaPositive, true) + '">' +
      '<strong>Tubitos Aedes +</strong>' +
      '<span>Atual: ' + escapeHtml(String(currentMetrics.labPositiveAedes)) + ' • Anterior: ' + escapeHtml(String(previousMetrics.labPositiveAedes)) + ' • Variação: ' + escapeHtml(formatPercentDelta(deltaPositive)) + '</span>' +
    '</div>' +
    '<div class="statistics-insight">' +
      '<strong>Fila laboratorial</strong>' +
      '<span>' + escapeHtml(String(currentMetrics.labPending)) + ' pendente(s), ' + escapeHtml(String(currentMetrics.labNegative)) + ' negativo(s), ' + escapeHtml(String(currentMetrics.labInconclusive)) + ' inconclusivo(s).</span>' +
    '</div>' +
    '<div class="statistics-insight">' +
      '<strong>Taxa de positividade laboratorial</strong>' +
      '<span>Atual: ' + escapeHtml(String(current.labRate).replace('.', ',')) + '% • Anterior: ' + escapeHtml(String(previous.labRate).replace('.', ',')) + '%.</span>' +
    '</div>';
  }

  function buildStatsInsights(current, previous, territoryRows, depositRows) {
    var rows = [];
    var visitDelta = statsDelta(current.metrics.totalVisits, previous.metrics.totalVisits);
    var focusDelta = statsDelta(current.focusTotal, previous.focusTotal);
    var labDelta = statsDelta(current.metrics.labPositiveAedes, previous.metrics.labPositiveAedes);
    rows.push('<div class="statistics-insight is-' + statsTone(visitDelta, false) + '"><strong>Produção de campo</strong><span>' +
      (visitDelta.diff === 0 ? 'A produção ficou estável em relação ao período anterior.' : 'A produção variou ' + escapeHtml(formatPercentDelta(visitDelta)) + ' em relação ao período anterior.') +
      '</span></div>');
    rows.push('<div class="statistics-insight is-' + statsTone(focusDelta, true) + '"><strong>Focos</strong><span>' +
      (focusDelta.diff === 0 ? 'Focos estáveis no comparativo.' : 'Focos tiveram variação de ' + escapeHtml(formatPercentDelta(focusDelta)) + '.') +
      '</span></div>');
    rows.push('<div class="statistics-insight is-' + statsTone(labDelta, true) + '"><strong>Positividade Aedes</strong><span>' +
      (labDelta.diff === 0 ? 'Tubitos Aedes + estáveis no comparativo.' : 'Tubitos Aedes + variaram ' + escapeHtml(formatPercentDelta(labDelta)) + '.') +
      '</span></div>');
    if (territoryRows && territoryRows.length) {
      rows.push('<div class="statistics-insight is-' + (territoryRows[0].delta > 0 ? 'bad' : territoryRows[0].delta < 0 ? 'good' : 'stable') + '"><strong>Território em destaque</strong><span>' + escapeHtml(territoryRows[0].nome + ': ' + territoryRows[0].status + ' ' + formatSignedNumber(territoryRows[0].delta, '') + ' ponto(s) de atenção.') + '</span></div>');
    }
    if (depositRows && depositRows.length) {
      rows.push('<div class="statistics-insight is-' + (depositRows[0].delta > 0 ? 'bad' : depositRows[0].delta < 0 ? 'good' : 'stable') + '"><strong>Depósito em destaque</strong><span>' + escapeHtml(depositRows[0].code + ' • ' + depositRows[0].label + ': ' + formatSignedNumber(depositRows[0].delta, '') + ' no comparativo.') + '</span></div>');
    }
    rows.push('<div class="statistics-insight is-neutral"><strong>Casos humanos</strong><span>Esta fase não inclui suspeitos/confirmados humanos porque a versão atual ainda não recebeu uma base de notificações. A aba já fica preparada para comparar positividade operacional e laboratorial.</span></div>');
    return rows.join('');
  }

  function renderStatisticsPanel(currentVisits) {
    if (!document.getElementById('statsKpiGrid')) {
      return;
    }
    var range = getDateRange();
    var previousRange = getPreviousStatsRange(range);
    var filters = getStatsFilterValues();
    var current = computeStatsBundle(currentVisits || []);
    var previousVisits = getStatsVisitsForRange(previousRange, filters);
    var previous = computeStatsBundle(previousVisits);
    var comparisonRows = buildStatsComparisonRows(current, previous);
    var timelineMode = getInclusiveDays(range.start, range.end) > 45 ? 'week' : 'day';
    var timeline = aggregateStatisticsTimeline(current.visits, timelineMode);
    var territoryField = filters.microarea ? 'quarteirao' : (filters.bairro ? 'microarea' : 'bairro');
    var territoryLabel = territoryField === 'bairro' ? 'Bairro' : territoryField === 'microarea' ? 'Microárea' : 'Quarteirão';
    var territoryRows = compareStatsMaps(aggregateStatsByField(current.visits, territoryField), aggregateStatsByField(previous.visits, territoryField));
    var depositRows = compareDepositEvolution(current.visits, previous.visits);

    document.getElementById('statsKpiGrid').innerHTML = [
      buildStatsKpi('Visitas', current.metrics.totalVisits, previous.metrics.totalVisits),
      buildStatsKpi('Focos', current.focusTotal, previous.focusTotal, { inverse: true }),
      buildStatsKpi('Dep. c/ foco', current.metrics.depositsWithFocus, previous.metrics.depositsWithFocus, { inverse: true }),
      buildStatsKpi('Lab Aedes +', current.metrics.labPositiveAedes, previous.metrics.labPositiveAedes, { inverse: true }),
      buildStatsKpi('Pendências', current.metrics.pending, previous.metrics.pending, { inverse: true }),
      buildStatsKpi('GPS', current.metrics.gpsCoverage, previous.metrics.gpsCoverage, { points: true, format: function (value) { return String(value) + '%'; } })
    ].join('');

    document.getElementById('statsNarrative').innerHTML = '<strong>Período atual:</strong> ' + escapeHtml(formatDateBR(range.start) + ' a ' + formatDateBR(range.end)) +
      ' • <strong>Comparado com:</strong> ' + escapeHtml(formatDateBR(previousRange.start) + ' a ' + formatDateBR(previousRange.end)) +
      ' • <strong>Base:</strong> visitas, depósitos, GPS, pendências e tubitos já carregados no painel.';
    document.getElementById('statsPeriodComparison').innerHTML = buildStatsComparisonTable(comparisonRows);
    document.getElementById('statsPositiveTrend').innerHTML = buildStatisticsTrendHtml(timeline);
    document.getElementById('statsTerritoryEvolution').innerHTML = buildTerritoryEvolutionHtml(territoryRows, territoryLabel);
    document.getElementById('statsDepositEvolution').innerHTML = buildDepositEvolutionHtml(depositRows);
    document.getElementById('statsLabEvolution').innerHTML = buildStatsLabHtml(current, previous);
    document.getElementById('statsInsights').innerHTML = buildStatsInsights(current, previous, territoryRows, depositRows);
  }



  function getTopQuarteiroesProblematicos(visits, limit) {
    var map = {};
    visits.forEach(function (visit) {
      var foco = (visit.depositFocusCount || 0) + ((visit.foco === 'Sim' || visit.focusCount > 0) ? Number(visit.focusCount || 0) : 0);
      var key = [visit.bairro || 'Sem bairro', visit.microarea || '-', visit.quarteirao || '-', visit.logradouro || '-'].join('||');
      if (!map[key]) {
        map[key] = { bairro: visit.bairro || 'Sem bairro', microarea: visit.microarea || '-', quarteirao: visit.quarteirao || '-', visitas: 0, focos: 0, pendencias: 0, ruas: {} };
      }
      map[key].visitas += 1;
      map[key].focos += foco;
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa' || visit.pending) { map[key].pendencias += 1; }
      if (visit.logradouro) { map[key].ruas[visit.logradouro] = true; }
    });
    return Object.keys(map).map(function (key) {
      var item = map[key];
      item.ruasCount = Object.keys(item.ruas).length;
      return item;
    }).sort(function (a, b) {
      return b.focos - a.focos || b.pendencias - a.pendencias || b.visitas - a.visitas;
    }).slice(0, limit || 5);
  }

  function getMicroareasComMaisQuarteiroesComFoco(visits, limit) {
    var map = {};
    visits.forEach(function (visit) {
      var temFoco = (visit.depositFocusCount || 0) > 0 || visit.foco === 'Sim' || Number(visit.focusCount || 0) > 0;
      if (!temFoco) { return; }
      var key = [visit.bairro || 'Sem bairro', visit.microarea || '-'].join('||');
      if (!map[key]) {
        map[key] = { bairro: visit.bairro || 'Sem bairro', microarea: visit.microarea || '-', focos: 0, quarteirões: {}, visitas: 0 };
      }
      map[key].visitas += 1;
      map[key].focos += Number(visit.focusCount || 0) + Number(visit.depositFocusCount || 0);
      if (visit.quarteirao) { map[key].quarteirões[visit.quarteirao] = true; }
    });
    return Object.keys(map).map(function (key) {
      var item = map[key];
      item.quarteirõesCount = Object.keys(item.quarteirões).length;
      return item;
    }).sort(function (a, b) {
      return b.quarteirõesCount - a.quarteirõesCount || b.focos - a.focos || b.visitas - a.visitas;
    }).slice(0, limit || 3);
  }

  function renderCriticalStreetList(visits) {
    var node = document.getElementById('criticalStreetList');
    var streets;
    var quarteirões;
    var microáreas;
    if (!node) {
      return;
    }
    streets = aggregateCriticalStreets(visits).slice(0, 5);
    quarteirões = getTopQuarteiroesProblematicos(visits, 3);
    microáreas = getMicroareasComMaisQuarteiroesComFoco(visits, 3);
    if (!streets.length && !quarteirões.length && !microáreas.length) {
      node.innerHTML = '<div class="insight-card insight-text"><p><strong>Sem leitura territorial complementar no recorte.</strong> Quando houver focos confirmados, o painel destacará automaticamente <strong>ruas</strong>, <strong>quarteirões</strong> e <strong>microáreas</strong> prioritárias para orientar a coordenação.</p></div>';
      return;
    }
    node.innerHTML = '<div class="insight-card insight-text territory-readout">' + buildTerritoryReadoutHtml({
      streets: streets,
      quarteirões: quarteirões,
      microáreas: microáreas
    }) + '</div>';
  }

  function buildTerritoryReadoutHtml(options) {
    var streets = options.streets || [];
    var quarteirões = options.quarteirões || [];
    var microáreas = options.microáreas || [];
    var bairro = options.bairro || null;
    var micro = options.micro || null;
    var complementSummary = options.complementSummary || null;
    var propertyCount = Number(options.propertyCount || 0);
    var rows = [];
    var lead = '';

    if (bairro) {
      lead = '<div class="territory-lead"><strong>Prioridade territorial</strong><span>' +
        reportStrong(bairro.nome) + ' concentra ' + reportStrong(bairro.focos) + ' foco(s)' +
        (micro ? '; microárea mais sensível: ' + reportStrong(micro.nome) + ', com ' + reportStrong(micro.focos) + ' foco(s)' : '') +
        '.</span></div>';
    }

    if (complementSummary) {
      rows.push('<div class="territory-row"><strong>Base no recorte</strong><span>' + reportStrong(propertyCount) + ' cadastro(s): ' +
        reportStrong(complementSummary.Normal) + ' normal(is), ' + reportStrong(complementSummary.Sequencia) + ' sequência(s), ' +
        reportStrong(complementSummary.Complemento) + ' complemento(s).</span></div>');
    }
    if (streets.length) {
      rows.push('<div class="territory-row"><strong>Ruas prioritárias</strong><span>' + streets.slice(0, 3).map(function (street, index) {
        return reportStrong((index + 1) + '. ' + street.nome) + ' (' + reportStrong(street.bairro) + '): ' +
          reportStrong(street.focos) + ' foco(s), ' + reportStrong(street.depositosComFoco) + ' depósito(s) positivo(s)' +
          (street.pendencias ? ', ' + reportStrong(street.pendencias) + ' pendência(s)' : '');
      }).join(' • ') + '.</span></div>');
    }
    if (quarteirões.length) {
      rows.push('<div class="territory-row"><strong>Quarteirões prioritários</strong><span>' + quarteirões.map(function (item) {
        return 'MA ' + reportStrong(item.microarea) + ' / Q ' + reportStrong(item.quarteirao) + ': ' +
          reportStrong(item.focos) + ' foco(s), ' + reportStrong(item.visitas) + ' visita(s), ' +
          reportStrong(item.pendencias) + ' pendência(s)';
      }).join(' • ') + '.</span></div>');
    }
    if (microáreas.length) {
      rows.push('<div class="territory-row"><strong>Espalhamento por microárea</strong><span>' + microáreas.map(function (item) {
        return reportStrong(item.bairro + ' / ' + item.microarea) + ': ' +
          reportStrong(item.quarteirõesCount) + ' quarteirão(ões) com foco, ' +
          reportStrong(item.focos) + ' registro(s)';
      }).join(' • ') + '.</span></div>');
    }
    if (!rows.length) {
      rows.push('<div class="territory-row"><strong>Leitura territorial</strong><span>Sem massa crítica territorial suficiente no recorte.</span></div>');
    }
    return lead + '<div class="territory-readout-grid">' + rows.join('') + '</div>';
  }

  function buildExecutiveDecisionHtml(metrics, agents, selectedAgent, bairros, criticalQuarteiroes, strategicAction) {
    var rows = agents.slice();
    var selected = selectedAgent ? rows.find(function (agent) { return agent.nome === selectedAgent; }) : null;
    var leaderByVisits = rows.slice().sort(function (a, b) { return b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR'); })[0] || null;
    var leaderByFocus = rows.slice().sort(function (a, b) { return b.focos - a.focos || b.visitas - a.visitas; })[0] || null;
    var leaderByRegistrations = rows.slice().sort(function (a, b) { return (b.cadastros || 0) - (a.cadastros || 0) || b.visitas - a.visitas; })[0] || null;
    var bestGps = rows.slice().sort(function (a, b) { return b.gpsRate - a.gpsRate || b.visitas - a.visitas; })[0] || null;
    var mostReturns = rows.slice().sort(function (a, b) { return b.retornos - a.retornos || b.fechados - a.fechados; })[0] || null;
    var target = selected || leaderByVisits;
    var cards = [];

    if (!rows.length) {
      return '<div class="decision-grid"><div class="decision-row"><strong>Equipe</strong><span>Sem produção de agente para comparar no recorte.</span></div></div>';
    }

    cards.push('<div class="decision-row"><strong>Produtividade</strong><span>' + reportStrong(leaderByVisits ? leaderByVisits.nome : '-') + ' lidera com ' + reportStrong(leaderByVisits ? leaderByVisits.visitas : 0) + ' visita(s). ' + (target ? 'Recorte de referência: ' + reportStrong(target.nome) + '.' : '') + '</span></div>');
    cards.push('<div class="decision-row"><strong>Cadastro da base</strong><span>' + (leaderByRegistrations && leaderByRegistrations.cadastros > 0 ? reportStrong(leaderByRegistrations.nome) + ' lidera com ' + reportStrong(leaderByRegistrations.cadastros) + ' imóvel(is) cadastrado(s).' : 'Sem cadastro novo atribuído a agente no recorte.') + '</span></div>');
    cards.push('<div class="decision-row"><strong>Focos</strong><span>' + reportStrong(leaderByFocus ? leaderByFocus.nome : '-') + ' concentra ' + reportStrong(leaderByFocus ? leaderByFocus.focos : 0) + ' foco(s) e ' + reportStrong(leaderByFocus ? leaderByFocus.depositosComFoco : 0) + ' depósito(s) positivo(s).</span></div>');
    cards.push('<div class="decision-row"><strong>Rastreabilidade</strong><span>Melhor GPS: ' + reportStrong(bestGps ? bestGps.nome : '-') + ' com ' + reportStrong(bestGps ? bestGps.gpsRate + '%' : '0%') + '. Meta operacional: ' + reportStrong('85%') + '.</span></div>');
    cards.push('<div class="decision-row"><strong>Ponto de atenção</strong><span>' + (mostReturns && mostReturns.retornos > 0 ? reportStrong(mostReturns.nome) + ' acumula ' + reportStrong(mostReturns.retornos) + ' retorno(s).' : 'Sem concentração relevante de retornos por agente.') + '</span></div>');
    cards.push('<div class="decision-row decision-row-main"><strong>Decisão recomendada</strong><span>' + buildRecommendedActionText(metrics, bairros, criticalQuarteiroes) + '</span></div>');
    cards.push('<div class="decision-row"><strong>Encaminhamento estratégico</strong><span>' + escapeHtml(strategicAction) + '</span></div>');
    return '<div class="decision-grid">' + cards.join('') + '</div>';
  }

  function buildRecommendedActionText(metrics, bairros, criticalQuarteiroes) {
    var territory = bairros[0] ? reportStrong(bairros[0].nome) : reportStrong('território filtrado');
    var quarter = criticalQuarteiroes.length ? ' com prioridade para o quarteirão ' + reportStrong(criticalQuarteiroes[0].quarteirao) : '';
    return 'Direcionar a próxima ação para ' + territory + quarter + '. Programar retorno de ' +
      reportStrong(metrics.pending) + ' pendência(s), manter bloqueio focal onde houver depósito positivo e reforçar GPS nas equipes abaixo da meta de ' +
      reportStrong('85%') + '.';
  }

  function buildExecutiveMailMergeReport(data) {
    var metrics = data.metrics;
    var agents = data.agents;
    var bairros = data.bairros;
    var microáreas = data.microáreas;
    var criticalStreets = data.criticalStreets;
    var criticalQuarteiroes = data.criticalQuarteiroes;
    var criticalMicroareas = data.criticalMicroareas;
    var focusSummary = data.focusSummary;
    var complementSummary = data.complementSummary;
    var strategicAction = data.strategicAction;
    var range = data.range;
    var filterSummary = data.filterSummary;
    var alert = data.alert;
    var selectedAgent = data.selectedAgent;
    var leaderByVisits = agents.slice().sort(function (a, b) { return b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR'); })[0] || null;
    var leaderByFocus = agents.slice().sort(function (a, b) { return b.focos - a.focos || b.depositosComFoco - a.depositosComFoco || b.visitas - a.visitas; })[0] || null;
    var leaderByRegistrations = agents.slice().sort(function (a, b) { return (b.cadastros || 0) - (a.cadastros || 0) || b.visitas - a.visitas; })[0] || null;
    var bestGps = agents.slice().sort(function (a, b) { return b.gpsRate - a.gpsRate || b.visitas - a.visitas; })[0] || null;
    var mostReturns = agents.slice().sort(function (a, b) { return b.retornos - a.retornos || b.fechados - a.fechados; })[0] || null;
    var selected = selectedAgent ? agents.find(function (agent) { return agent.nome === selectedAgent; }) : null;
    var gpsGap = Math.max(0, 85 - Number(metrics.gpsCoverage || 0));
    var closedConversion = metrics.closed + metrics.recovered
      ? Math.round((metrics.recovered / (metrics.closed + metrics.recovered)) * 100)
      : 0;
    var depositRisk = metrics.deposits
      ? Number(((metrics.depositsWithFocus / metrics.deposits) * 100).toFixed(1))
      : 0;
    var focusBlock = bairros[0]
      ? 'A maior concentração territorial de foco aparece em ' + reportStrong(bairros[0].nome) + ', com ' + reportStrong(bairros[0].focos) + ' foco(s)' + (microáreas[0] ? ', tendo como microárea de maior sensibilidade ' + reportStrong(microáreas[0].nome) : '') + '.'
      : 'Não houve concentração territorial de foco suficiente para destacar bairro prioritário no recorte.';
    var streetBlock = criticalStreets.length
      ? criticalStreets.slice(0, 3).map(function (street, index) {
        return reportStrong((index + 1) + '. ' + street.nome) + ', em ' + reportStrong(street.bairro) + ', com ' + reportStrong(street.focos) + ' foco(s), ' + reportStrong(street.depositosComFoco) + ' depósito(s) positivo(s)' + (street.pendencias ? ' e ' + reportStrong(street.pendencias) + ' pendência(s)' : '');
      }).join('; ')
      : 'não houve rua crítica consolidada por foco no recorte filtrado';
    var quarterBlock = criticalQuarteiroes.length
      ? criticalQuarteiroes.map(function (item) {
        return 'MA ' + reportStrong(item.microarea) + ' / Q ' + reportStrong(item.quarteirao) + ', com ' + reportStrong(item.focos) + ' foco(s), ' + reportStrong(item.visitas) + ' visita(s) e ' + reportStrong(item.pendencias) + ' pendência(s)';
      }).join('; ')
      : 'sem quarteirão crítico consolidado no recorte atual';
    var microBlock = criticalMicroareas.length
      ? criticalMicroareas.map(function (item) {
        return reportStrong(item.bairro + ' / ' + item.microarea) + ', com ' + reportStrong(item.quarteirõesCount) + ' quarteirão(ões) com foco e ' + reportStrong(item.focos) + ' registro(s)';
      }).join('; ')
      : 'sem espalhamento de foco suficiente para ranquear microáreas';
    var teamBlock = agents.length
      ? 'A produção envolveu ' + reportStrong(agents.length) + ' agente(s) no período. ' + (leaderByVisits ? reportStrong(leaderByVisits.nome) + ' liderou em volume, com ' + reportStrong(leaderByVisits.visitas) + ' visita(s). ' : '') + (leaderByRegistrations && leaderByRegistrations.cadastros > 0 ? reportStrong(leaderByRegistrations.nome) + ' liderou em cadastro de base, com ' + reportStrong(leaderByRegistrations.cadastros) + ' imóvel(is) cadastrado(s). ' : 'Não há cadastro novo atribuído a agente no recorte. ') + (leaderByFocus ? reportStrong(leaderByFocus.nome) + ' concentrou o maior número de foco(s), com ' + reportStrong(leaderByFocus.focos) + ' ocorrência(s) e ' + reportStrong(leaderByFocus.depositosComFoco) + ' depósito(s) positivo(s). ' : '') + (bestGps ? 'A melhor rastreabilidade GPS foi de ' + reportStrong(bestGps.nome) + ', com ' + reportStrong(bestGps.gpsRate + '%') + '. ' : '') + (mostReturns && mostReturns.retornos > 0 ? 'A maior carga de retorno está com ' + reportStrong(mostReturns.nome) + ', somando ' + reportStrong(mostReturns.retornos) + ' pendência(s).' : 'Não há concentração individual relevante de retorno.')
      : 'Não há agente com visita registrada no recorte filtrado.';
    var individualBlock = selected
      ? 'No recorte individual, ' + reportStrong(selected.nome) + ' realizou ' + reportStrong(selected.visitas) + ' visita(s), ' + reportStrong(selected.cadastros || 0) + ' cadastro(s), com ' + reportStrong(selected.gpsRate + '%') + ' de GPS, ' + reportStrong(selected.abertos) + ' aberto(s), ' + reportStrong(selected.fechados) + ' fechado(s)/recusado(s), ' + reportStrong(selected.recuperados) + ' recuperado(s), ' + reportStrong(selected.focos) + ' foco(s) e ' + reportStrong(selected.depositosComFoco) + ' depósito(s) com foco.'
      : 'Sem agente individual selecionado; a leitura considera a equipe completa filtrada no painel.';
    var baseBlock = complementSummary
      ? 'A base cadastral filtrada possui ' + reportStrong(data.propertyCount) + ' cadastro(s), sendo ' + reportStrong(complementSummary.Normal) + ' normal(is), ' + reportStrong(complementSummary.Sequencia) + ' sequência(s) e ' + reportStrong(complementSummary.Complemento) + ' complemento(s).'
      : 'A base cadastral filtrada não possui detalhamento de complementos disponível.';
    var operationBlock = buildOperationSummaryHtml(data.operationBreakdown || []);
    var decisionText = buildRecommendedActionText(metrics, bairros, criticalQuarteiroes);

    return '' +
      '<h2>Relatório executivo descritivo</h2>' +
      '<div class="alert-box ' + escapeHtml(alert.className) + '"><strong>' + escapeHtml(alert.label) + '</strong><span>' + escapeHtml(alert.text) + '</span></div>' +
      '<div class="section-box narrative-report">' +
        '<h3>1. Síntese profissional do recorte</h3>' +
        '<p>Este relatório consolida a situação operacional do controle de arboviroses no período de ' + reportStrong(formatDateBR(range.start)) + ' a ' + reportStrong(formatDateBR(range.end)) + ', considerando o filtro: ' + reportStrong(filterSummary) + '. A base disponível registra ' + reportStrong(state.allProperties.length) + ' imóvel(is) cadastrado(s) na nuvem e, dentro do recorte analisado, foram processadas ' + reportStrong(metrics.totalVisits) + ' visita(s), com ' + reportStrong(metrics.visitedProperties) + ' imóvel(is) trabalhado(s), ' + reportStrong(metrics.repeatedProperties) + ' imóvel(is) visitado(s) mais de uma vez e participação de ' + reportStrong(metrics.activeAgents) + ' agente(s) em campo.</p>' +
        '<p>Do ponto de vista operacional, o período apresentou ' + reportStrong(metrics.opened) + ' imóvel(is) aberto(s)/visitado(s), ' + reportStrong(metrics.closed) + ' fechado(s)/recusado(s), ' + reportStrong(metrics.recovered) + ' recuperado(s) e ' + reportStrong(metrics.pending) + ' retorno(s) necessário(s). A conversão de fechados em recuperados está em ' + reportStrong(closedConversion + '%') + ', indicador importante para programação de revisita e redução de perda de oportunidade no território.</p>' +
      '</div>' +
      '<div class="section-box narrative-report">' +
        '<h3>2. Análise entomológica e sanitária</h3>' +
        '<p>A leitura entomológica identificou ' + reportStrong(metrics.deposits) + ' depósito(s) encontrado(s), dos quais ' + reportStrong(metrics.depositsWithFocus) + ' apresentaram foco positivo, ' + reportStrong(metrics.depositsTreated || 0) + ' receberam tratamento com BPI e ' + reportStrong(metrics.depositsEliminated) + ' foram classificados como depósito(s) eliminado(s) durante a visita. A taxa de positividade de depósito ficou em ' + reportStrong(depositRisk + '%') + ' e a taxa de infestação consolidada em ' + reportStrong(metrics.infestationRate + '%') + '. Foram registrados ' + reportStrong(data.focusTotal) + ' foco(s), ' + reportStrong(focusSummary.withFocus) + ' imóvel(is) com foco e ' + reportStrong(focusSummary.withoutFocus) + ' imóvel(is) trabalhado(s) sem foco.</p>' +
        '<p>Também foram registrados ' + reportStrong(metrics.tubitos) + ' tubito(s) coletado(s), com ' + reportStrong(metrics.labPositiveAedes) + ' positivo(s) para Aedes e ' + reportStrong(metrics.labPending) + ' pendente(s) no laboratório. A cobertura GPS alcançou ' + reportStrong(metrics.gpsCoverage + '%') + '; em relação à referência operacional de ' + reportStrong('85%') + ', o déficit atual é de ' + reportStrong(gpsGap + ' ponto(s) percentual(is)') + '.</p>' +
      '</div>' +
      '<div class="section-box narrative-report">' +
        '<h3>2.1 Separação por tipo de trabalho</h3>' +
        '<p>Os totais abaixo mantem VD, P.E. e LIRAa separados, incluindo tubitos e resultado laboratorial vinculado ao tipo de coleta.</p>' +
        operationBlock +
      '</div>' +
      '<div class="section-box narrative-report">' +
        '<h3>3. Leitura territorial</h3>' +
        '<p>' + focusBlock + ' As ruas de maior atenção no recorte são: ' + streetBlock + '.</p>' +
        '<p>Quanto aos quarteirões, a prioridade operacional indicada é: ' + quarterBlock + '. A leitura de espalhamento por microárea aponta: ' + microBlock + '.</p>' +
        '<p>' + baseBlock + ' Esta composição ajuda a diferenciar cadastro regular, sequência e complemento, reduzindo duplicidade e melhorando a distribuição das equipes por imóvel real.</p>' +
      '</div>' +
      '<div class="section-box narrative-report">' +
        '<h3>4. Desempenho da equipe e rastreabilidade</h3>' +
        '<p>' + teamBlock + '</p>' +
        '<p>' + individualBlock + '</p>' +
      '</div>' +
      '<div class="section-box narrative-report">' +
        '<h3>5. Encaminhamento executivo</h3>' +
        '<p><strong>Decisão recomendada:</strong> ' + decisionText + '</p>' +
        '<p><strong>Encaminhamento estratégico:</strong> ' + escapeHtml(strategicAction) + '</p>' +
        '<p><strong>Conclusão:</strong> o recorte deve ser utilizado para orientar a próxima distribuição de agentes, priorizando retorno dos fechados/recusados, bloqueio focal nos pontos positivos, conferência de GPS quando abaixo da meta e acompanhamento diário dos territórios com maior concentração de foco.</p>' +
      '</div>';
  }

  function renderOnScreenReport(metrics, agents, bairros, microáreas, visits) {
    var node = document.getElementById('reportOnScreen');
    var directNode = document.getElementById('directNote');
    if (!node) {
      return;
    }
    var leaderByVisits = agents.slice().sort(function (a, b) { return b.visitas - a.visitas || a.nome.localeCompare(b.nome); })[0] || null;
    var leaderByFocus = agents.slice().sort(function (a, b) { return b.focos - a.focos || b.visitas - a.visitas; })[0] || null;
    var leaderByRegistrations = agents.slice().sort(function (a, b) { return (b.cadastros || 0) - (a.cadastros || 0) || b.visitas - a.visitas; })[0] || null;
    var bairro = bairros[0] || null;
    var micro = microáreas[0] || null;
    var periodLabel = getPeriodLabel();
    var selectedAgent = document.getElementById('agentFilter') ? document.getElementById('agentFilter').value : '';
    var criticalStreets = aggregateCriticalStreets(visits).slice(0, 5);
    var criticalQuarteiroes = getTopQuarteiroesProblematicos(visits, 3);
    var criticalMicroareas = getMicroareasComMaisQuarteiroesComFoco(visits, 3);
    if (!visits.length) {
      node.innerHTML = '<div class="report-story executive-report"><h3>Leitura executiva operacional</h3><div class="report-context">' + escapeHtml(getReportFilterSignature()) + '</div><div class="report-alert is-stable"><strong>Situação controlada</strong><span>Sem visita encontrada no recorte filtrado.</span></div>' +
        buildExecutiveSection('Síntese do período', 'No período ' + reportStrong(periodLabel) + ', nenhuma visita foi encontrada com os filtros atuais. Ajuste bairro, microárea, quarteirão ou agente para gerar a leitura territorial.') +
      '</div>';
      if (directNode) {
        directNode.innerHTML = '<strong>Encaminhamento recomendado</strong><p>Validar os filtros do painel e manter o mapa territorial como referência principal antes de distribuir a equipe.</p>';
      }
      return;
    }
    var alert = getOperationalAlert(metrics);
    var section1 = 'No período ' + reportStrong(periodLabel) + ', foram registradas ' + reportStrong(metrics.totalVisits) + ' visita(s), com ' + reportStrong(metrics.visitedProperties) + ' imóvel(is) trabalhado(s), ' + reportStrong(metrics.pending) + ' pendência(s) e ' + reportStrong(metrics.gpsCoverage + '%') + ' de cobertura GPS.';
    var section2 = 'A leitura entomológica indica ' + reportStrong(metrics.depositsWithFocus) + ' depósito(s) com foco em ' + reportStrong(metrics.deposits) + ' depósito(s) encontrado(s), com ' + reportStrong(metrics.depositsEliminated) + ' depósito(s) eliminado(s), taxa de infestação de ' + reportStrong(metrics.infestationRate + '%') + ', ' + reportStrong(metrics.propertiesWithFocus) + ' imóvel(is) com foco e laboratório com ' + reportStrong(metrics.labPositiveAedes) + ' Aedes positivo(s) no recorte.';
    var section3 = bairro ? ('Maior sensibilidade em ' + reportStrong(bairro.nome) + ', com ' + reportStrong(bairro.focos) + ' foco(s). ' + (micro ? 'A microárea prioritária é ' + reportStrong(micro.nome) + '. ' : '') + (criticalQuarteiroes.length ? 'Quarteirão de atenção: ' + reportStrong(criticalQuarteiroes[0].quarteirao) + ', com ' + reportStrong(criticalQuarteiroes[0].focos) + ' foco(s).' : 'Ainda sem quarteirão crítico consolidado.')) : 'Ainda não há território crítico consolidado no recorte atual.';
    var section4 = leaderByVisits ? ('<p>' + reportStrong(leaderByVisits.nome) + ' lidera em volume com ' + reportStrong(leaderByVisits.visitas) + ' visita(s). ' + (leaderByRegistrations && leaderByRegistrations.cadastros > 0 ? reportStrong(leaderByRegistrations.nome) + ' lidera em cadastro de base, com ' + reportStrong(leaderByRegistrations.cadastros) + ' imóvel(is) cadastrado(s). ' : 'Ainda não há cadastro atribuído a agente no recorte. ') + (leaderByFocus && leaderByFocus.focos > 0 ? reportStrong(leaderByFocus.nome) + ' concentra o maior número de focos, com ' + reportStrong(leaderByFocus.focos) + ' registro(s).' : 'Não há foco encontrado no recorte.') + '</p>') : '<p>A equipe ainda não apresenta liderança operacional definida no recorte.</p>';
    var section5 = buildRecommendedActionText(metrics, bairros, criticalQuarteiroes);
    node.innerHTML = '<div class="report-story executive-report"><h3>Leitura executiva operacional</h3><div class="report-context">' + escapeHtml(getReportFilterSignature()) + '</div>' +
      '<div class="report-alert ' + escapeHtml(alert.className) + '"><strong>' + escapeHtml(alert.label) + '</strong><span>' + escapeHtml(alert.text) + '</span></div>' +
      buildExecutiveSection('Síntese do período', section1) +
      buildExecutiveSection('Leitura entomológica', section2) +
      buildExecutiveSection('Leitura territorial', section3) +
      buildExecutiveSection('Desempenho da equipe', section4 + buildAgentPerformanceHtml(agents, selectedAgent)) +
      buildExecutiveSection('Encaminhamento recomendado', section5) +
      '</div>';
    if (directNode) {
      directNode.innerHTML = '<strong>Encaminhamento recomendado</strong><p>' + section5 + '</p>';
    }
  }


  function buildLadderRequestsHtml(visits) {
    var requests = getOpenPanelLadderRequests(visits);

    if (!requests.length) {
      return '<div class="empty-state"><strong>Nenhuma solicitação de escada em aberto.</strong><span>Só aparecem aqui pedidos marcados pelo agente como “Sim, solicitar escada”. Solicitações atendidas ficam ocultas neste painel.</span></div>';
    }

    return '<div class="panel-ladder-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="visit-inline-action" type="button" data-ladder-attend-all="true">Limpar lista / marcar todas atendidas</button></div>' + requests.map(function (visit) {
      var lat = visit.gps_lat;
      var lng = visit.gps_lng;
      var mapUrl = buildMapsUrl(lat, lng);
      var address = [(visit.logradouro || '-'), (visit.numero || '')].filter(Boolean).join(', ') + ' • ' + (visit.bairro || '-');
      var key = getPanelLadderRequestKey(visit);
      return '' +
        '<div class="insight-item panel-ladder-request-item">' +
          '<strong>' + escapeHtml(visit.agente || 'Agente não informado') + '</strong>' +
          '<span>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + ' • ' + escapeHtml(address) + '</span>' +
          '<small>Microárea: ' + escapeHtml(visit.microarea || '-') + ' • Q: ' + escapeHtml(visit.quarteirao || '-') + ' • Status: ' + escapeHtml(getPanelLadderStatus(visit)) + '</small>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
            (mapUrl ? '<a class="visit-inline-action" href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noopener">Abrir localização</a>' : '<small>Sem GPS registrado para este pedido.</small>') +
            '<button class="visit-inline-action" type="button" data-ladder-status="Em atendimento" data-ladder-key="' + escapeHtml(key) + '">Em atendimento</button>' +
            '<button class="visit-inline-action" type="button" data-ladder-status="Concluída" data-ladder-key="' + escapeHtml(key) + '">Concluir</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }


  function buildSupervisionRequestsHtml(requests) {
    var open = getOpenPanelSupervisionRequests(requests || []);
    if (!open.length) {
      return '<div class="empty-state"><strong>Nenhuma solicitação de supervisão em aberto.</strong><span>Chamados concluídos ficam ocultos neste painel.</span></div>';
    }
    return open.map(function (request) {
      var lat = request.gps_lat;
      var lng = request.gps_lng;
      var mapUrl = buildMapsUrl(lat, lng);
      var key = getPanelSupervisionRequestKey(request);
      var status = getPanelSupervisionStatus(request);
      return '' +
        '<div class="insight-item panel-supervision-request-item">' +
          '<strong>' + escapeHtml(request.agente || 'Agente não informado') + '</strong>' +
          '<span>' + escapeHtml(formatDateBR(request.data) + ' ' + (request.hora || '') + ' • ' + (request.mensagem || 'Solicitou supervisão em campo.')) + '</span>' +
          '<small>Modo: ' + escapeHtml(request.operationMode === 'PE' ? 'P.E.' : (request.operationMode === 'LIRAA' ? 'LIRAa' : 'VD')) + ' • Microárea: ' + escapeHtml(request.microarea || '-') + ' • Q: ' + escapeHtml(request.quarteirao || '-') + ' • Status: ' + escapeHtml(status) + '</small>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
            (mapUrl ? '<a class="visit-inline-action" href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noopener">Abrir localização</a>' : '<small>Sem GPS registrado.</small>') +
            '<button class="visit-inline-action" type="button" data-supervision-status="Em atendimento" data-supervision-key="' + escapeHtml(key) + '">Em atendimento</button>' +
            '<button class="visit-inline-action" type="button" data-supervision-status="Concluída" data-supervision-key="' + escapeHtml(key) + '">Concluir</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function buildAgentLocationsHtml(visits) {
    var latestByAgent = {};
    (visits || []).filter(visitHasGps).filter(function (visit) {
      return isRegisteredAgentName(visit && visit.agente);
    }).forEach(function (visit) {
      var key = String(visit.agente || visit.matricula || '').trim();
      var stamp = String((visit.data || '') + 'T' + (visit.hora || '00:00'));
      if (!key) {
        return;
      }
      if (!latestByAgent[key] || stamp > latestByAgent[key].stamp) {
        latestByAgent[key] = { visit: visit, stamp: stamp };
      }
    });

    var rows = Object.keys(latestByAgent).map(function (key) { return latestByAgent[key].visit; }).sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '')));
    });

    if (!rows.length) {
      return '<div class="empty-state"><strong>Nenhuma localização de agente no recorte.</strong><span>A localização aparece a partir das visitas com GPS sincronizadas no painel.</span></div>';
    }

    return rows.map(function (visit, index) {
      var lat = visit.gps_lat;
      var lng = visit.gps_lng;
      var mapUrl = buildMapsUrl(lat, lng);
      var address = [(visit.logradouro || '-'), (visit.numero || '')].filter(Boolean).join(', ') + ' • ' + (visit.bairro || '-');
      return '' +
        '<div class="ranking-item panel-agent-location-item">' +
          '<div><strong>' + escapeHtml(String(index + 1) + '. ' + (visit.agente || 'Agente')) + '</strong>' +
            '<span>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '') + ' • ' + address) + '</span>' +
            '<small>GPS: ' + escapeHtml(String(lat || '-') + ', ' + String(lng || '-')) + ' • Território: ' + escapeHtml(visit.gpsTerritory || visit.bairro || '-') + (visit.gpsQuarteirao ? ' • Q ' + escapeHtml(visit.gpsQuarteirao) : '') + '</small>' +
          '</div>' +
          (mapUrl ? '<a class="visit-inline-action" href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noopener">Mapa</a>' : '<span class="chip">Sem GPS</span>') +
        '</div>';
    }).join('');
  }

  function renderAgentsPanel() {
    var requestsNode = document.getElementById('panelLadderRequests');
    var locationsNode = document.getElementById('panelAgentLocations');
    var supervisionNode = document.getElementById('panelSupervisionRequests');
    var visits = (state.filteredVisits || []).slice();

    if (requestsNode) {
      requestsNode.innerHTML = buildLadderRequestsHtml(visits);
    }

    if (locationsNode) {
      locationsNode.innerHTML = buildAgentLocationsHtml(visits);
    }

    if (supervisionNode) {
      supervisionNode.innerHTML = buildSupervisionRequestsHtml(getSupervisionRequestsForCurrentRange());
    }
  }

  function closeAgentsModal() {
    var overlay = document.getElementById('acePanelAgentsModal');
    if (overlay) {
      overlay.hidden = true;
    }
    document.body.classList.remove('is-agents-modal-open');
  }

  function openAgentsModal() {
    var overlay = document.getElementById('acePanelAgentsModal');
    var visits = (state.filteredVisits && state.filteredVisits.length ? state.filteredVisits : state.allVisits || []).slice();
    var subtitle = getReportFilterSignature ? getReportFilterSignature() : 'Recorte atual do painel';

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'acePanelAgentsModal';
      overlay.className = 'ace-panel-agents-modal';
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'acePanelAgentsModalTitle');
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (event) {
        if (event.target && event.target.getAttribute('data-agents-modal-close') === 'true') {
          closeAgentsModal();
        }
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && overlay && !overlay.hidden) {
          closeAgentsModal();
        }
      });
    }

    overlay.innerHTML = '' +
      '<div class="ace-panel-agents-backdrop" data-agents-modal-close="true"></div>' +
      '<section class="ace-panel-agents-dialog">' +
        '<header class="ace-panel-agents-header">' +
          '<div><span class="ace-panel-agents-eyebrow">Coordenação operacional</span><h2 id="acePanelAgentsModalTitle">Agentes, escada, supervisão e localização</h2><p>' + escapeHtml(subtitle) + '</p></div>' +
          '<button type="button" class="ace-panel-agents-close" data-agents-modal-close="true" aria-label="Fechar">×</button>' +
        '</header>' +
        '<div class="ace-panel-agents-grid">' +
          '<section class="ace-panel-agents-box"><h3>Solicitações de escada</h3><p>Pedidos gerados quando o agente informa que a caixa d\'água necessita escada e escolhe solicitar apoio.</p><div class="insight-list">' + buildLadderRequestsHtml(visits) + '</div></section>' +
          '<section class="ace-panel-agents-box"><h3>Solicitações de supervisão</h3><p>Chamados enviados pelo botão Solicitar supervisão no app do agente.</p><div class="insight-list" id="panelSupervisionRequests">' + buildSupervisionRequestsHtml(getSupervisionRequestsForCurrentRange()) + '</div></section>' +
          '<section class="ace-panel-agents-box"><h3>Localização dos agentes</h3><p>Última localização registrada por GPS nas visitas sincronizadas no recorte atual.</p><div class="ranking-list">' + buildAgentLocationsHtml(visits) + '</div></section>' +
        '</div>' +
      '</section>';

    overlay.hidden = false;
    document.body.classList.add('is-agents-modal-open');
    setTimeout(function () {
      var closeButton = overlay.querySelector('.ace-panel-agents-close');
      if (closeButton) {
        closeButton.focus();
      }
    }, 30);
  }

  function renderDashboard() {
    var visits = state.filteredVisits;
    var properties = state.filteredProperties || [];
    var metrics = computeMetrics(visits);
    var agents = aggregateAgents(visits, properties);
    var bairros = aggregateByField(visits, 'bairro', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var microáreas = aggregateByField(visits, 'microarea', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var visitsByDay = aggregateByDate(visits);
    var recentVisitsByDay = visitsByDay.slice(-5);
    var treatmentByFocusType = aggregateTreatmentByFocusType(visits);
    var focusByDeposit = aggregateFocusByDeposit(visits);

    var focusSummary = computePropertyFocusSummary(visits);
    metrics.propertiesWithFocus = focusSummary.withFocus;
    metrics.propertiesWithoutFocus = focusSummary.withoutFocus;
    var focusTotal = getVisitFocusTotal(visits);
    var operationBreakdown = summarizeOperationsForVisits(visits);
    var focusDepositCards = aggregateFocusByDeposit(visits, true).map(function (row) {
      return metricCard('Foco ' + row.code, row.total, row.total > 0 ? 'risk' : 'risk-low');
    });
    var operationalOverview = computeOperationalOverview(visits, metrics, agents, bairros, microáreas, focusSummary);
    document.getElementById('panelMetricGrid').innerHTML = [
      metricCard('Cadastrados na Nuvem', state.allProperties.length, 'base'),
      metricCard('Visitas no período', metrics.totalVisits, 'production'),
      metricCard('VD', operationBreakdown[0].visits, 'status-open'),
      metricCard('P.E.', operationBreakdown[1].visits, 'production-warn'),
      metricCard('LIRAa', operationBreakdown[2].visits, 'team'),
      metricCard('Trabalhados', metrics.visitedProperties, 'production'),
      metricCard('+ de 1 vez', metrics.repeatedProperties, 'production-warn'),
      metricCard('Agentes em campo', metrics.activeAgents, 'team'),
      metricCard('Aberto/visitado', metrics.opened, 'status-open'),
      metricCard('Fechado/recusado', metrics.closed, 'status-closed'),
      metricCard('Recuperados', metrics.recovered, 'status-recovered'),
      metricCard('Retornos necessários', metrics.pending, metrics.pending > 0 ? 'return' : 'status-recovered'),
      metricCard('Escada pendente', getOpenPanelLadderRequests(visits).length, getOpenPanelLadderRequests(visits).length > 0 ? 'production-warn' : 'risk-low'),
      metricCard('Supervisão aberta', getOpenPanelSupervisionRequests(getSupervisionRequestsForCurrentRange()).length, getOpenPanelSupervisionRequests(getSupervisionRequestsForCurrentRange()).length > 0 ? 'production-warn' : 'risk-low'),
      metricCard('GPS capturado', metrics.gpsCoverage + '%', getGpsMetricKind(metrics.gpsCoverage)),
      metricCard('Focos identificados', focusSummary.withFocus, focusSummary.withFocus > 0 ? 'risk' : 'risk-low'),
      metricCard('Sem foco', focusSummary.withoutFocus, 'risk-low'),
      metricCard('Depósitos encontrados', metrics.deposits, 'risk-neutral'),
      metricCard('Depósitos com foco', metrics.depositsWithFocus, metrics.depositsWithFocus > 0 ? 'risk' : 'risk-low'),
      metricCard('Depósitos tratados', metrics.depositsTreated || 0, 'risk-low'),
      metricCard('BPI aplicado (g)', metrics.bpiGrams || 0, 'sample'),
      metricCard('Depósitos eliminados', metrics.depositsEliminated, 'risk-low'),
      metricCard('Taxa de infestação', metrics.infestationRate + '%', metrics.infestationRate >= 20 ? 'risk' : metrics.infestationRate > 0 ? 'risk-warn' : 'risk-low'),
      metricCard('Tubitos coletados', metrics.tubitos, 'sample'),
      metricCard('Lab Aedes +', metrics.labPositiveAedes, metrics.labPositiveAedes > 0 ? 'risk' : 'risk-low'),
      metricCard('Lab pendente', metrics.labPending, metrics.labPending > 0 ? 'risk-warn' : 'risk-low')
    ].concat(focusDepositCards).join('');

    renderPriorityBand(metrics, bairros, microáreas);
    renderOperationalExtras(operationalOverview, recentVisitsByDay, metrics, bairros, microáreas);
    renderCompactMetricList('chartVisitsByDay', treatmentByFocusType, {
      limit: 5,
      label: function (row) { return row.code + ' • ' + row.label; },
      meta: function (row) { return row.deposits + ' depósito(s) no período'; },
      value: function (row) { return row.grams; },
      unit: 'gramas'
    });
    renderCompactMetricList('chartFocusByDeposit', focusByDeposit, {
      limit: 6,
      value: function (row) { return row.total; },
      label: function (row) { return row.code + ' • ' + row.label; },
      meta: function (row) { return 'depósito(s) com foco no período'; },
      unit: 'com foco'
    });

    renderDecisionList(metrics, agents, bairros);
    renderTable(visits);
    renderOnScreenReport(metrics, agents, bairros, microáreas, visits);
    renderCriticalStreetList(visits);
    renderDrilldownPanel(metrics);
    renderVisitInspectionPanel();
    renderHeatMap(visits);
    renderComparatives(visits);
    renderStatisticsPanel(visits);
    renderAgentsPanel();
  }

  function metricCard(label, value, kind) {
    var classes = ['metric-card'];
    if (kind) {
      classes.push('is-' + String(kind).replace(/[^a-z0-9-]/gi, '').toLowerCase());
    }
    if (kind === 'danger') {
      classes.push('is-risk');
    } else if (kind === 'accent') {
      classes.push('is-production');
    } else if (kind === 'warn') {
      classes.push('is-production-warn');
    }
    return '<div class="' + classes.join(' ') + '"><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(String(value)) + '</strong></div>';
  }

  function getGpsMetricKind(value) {
    var rate = Number(value || 0);
    if (rate >= 85) {
      return 'gps-ok';
    }
    if (rate >= 60) {
      return 'gps-warn';
    }
    return 'gps-danger';
  }

  function formatAverage(value) {
    var number = Number(value || 0);
    if (!isFinite(number)) {
      return '0';
    }
    if (Math.abs(number - Math.round(number)) < 0.05) {
      return String(Math.round(number));
    }
    return number.toFixed(1).replace('.', ',');
  }

  function normalizeWaterConditionLabel(value) {
    var label = String(value || '').trim().toLowerCase();
    if (!label) {
      return '';
    }
    if (label.indexOf('tamp') > -1) {
      return 'Tampada';
    }
    if (label.indexOf('tela') > -1) {
      return 'Com tela';
    }
    if (label.indexOf('abert') > -1 || label.indexOf('vulner') > -1 || label.indexOf('chuva') > -1) {
      return 'Aberta';
    }
    if (label.indexOf('vazi') > -1) {
      return 'Vazia';
    }
    return repairTextEncoding(String(value || '').trim());
  }

  function getLatestVisitDate(visits) {
    return visits.reduce(function (maxDate, visit) {
      var current = String(visit.data || '').trim();
      return current && current > maxDate ? current : maxDate;
    }, '');
  }

  function computeOperationalOverview(visits, metrics, agents, bairros, microareas, focusSummary) {
    var perProperty = {};
    var uniqueQuarters = {};
    var uniqueMicroareas = {};
    var gpsWith = 0;
    var withPhoto = 0;
    var incomplete = 0;
    var waterOpened = 0;
    var waterNotInspected = 0;
    var waterWithFocus = 0;
    var waterInspected = 0;
    var recusaCount = 0;
    var focusTotal = getVisitFocusTotal(visits);
    var latestDate = getLatestVisitDate(visits);

    visits.forEach(function (visit) {
      var key = propertyVisitKey(visit);
      var stamp = (visit.data || '') + 'T' + (visit.hora || '00:00');
      if (visit.quarteirao) {
        uniqueQuarters[String(visit.quarteirao)] = true;
      }
      if (visit.microarea) {
        uniqueMicroareas[String(visit.microarea)] = true;
      }
      if (visitHasGps(visit)) {
        gpsWith += 1;
      }
      if (visit.photoUrl) {
        withPhoto += 1;
      }
      if (visit.qualityFlags) {
        incomplete += 1;
      }
      if (visit.situacao === 'Recusa') {
        recusaCount += 1;
      }
      if (visit.waterAccess === 'Sim') {
        waterInspected += 1;
        if (normalizeWaterConditionLabel(visit.waterTankCondition) === 'Aberta') {
          waterOpened += 1;
        }
        if (visitHasFocus(visit)) {
          waterWithFocus += 1;
        }
      } else {
        waterNotInspected += 1;
      }
      if (!key) {
        return;
      }
      if (!perProperty[key]) {
        perProperty[key] = { latest: visit, stamp: stamp, total: 0, closedCount: 0, hasRecovered: false };
      }
      perProperty[key].total += 1;
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        perProperty[key].closedCount += 1;
      }
      if (visit.situacao === 'Recuperado') {
        perProperty[key].hasRecovered = true;
      }
      if (stamp > perProperty[key].stamp) {
        perProperty[key].latest = visit;
        perProperty[key].stamp = stamp;
      }
    });

    var returnsPlanned = 0;
    var returnsOverdue = 0;
    var repeatedProperties = 0;
    var recurringClosed = 0;

    Object.keys(perProperty).forEach(function (key) {
      var item = perProperty[key];
      var latest = item.latest || {};
      if (item.total > 1) {
        repeatedProperties += 1;
      }
      if (item.closedCount >= 2 && !item.hasRecovered) {
        recurringClosed += 1;
      }
      if (latest.situacao === 'Fechado' || latest.situacao === 'Recusa') {
        returnsPlanned += 1;
        if (latestDate && latest.data && latest.data < latestDate) {
          returnsOverdue += 1;
        }
      }
    });

    var issueCandidates = [
      { label: 'imóveis fechados', value: metrics.closed },
      { label: 'retornos pendentes', value: returnsPlanned },
      { label: 'caixas não inspecionadas', value: waterNotInspected },
      { label: 'recusas', value: recusaCount },
      { label: 'depósitos com foco', value: metrics.depositsWithFocus }
    ].sort(function (a, b) {
      return b.value - a.value || a.label.localeCompare(b.label, 'pt-BR');
    })[0];

    var executiveSummary = metrics.totalVisits
      ? ('No recorte atual, foram registradas ' + metrics.totalVisits + ' visita(s), com ' + metrics.visitedProperties + ' imóvel(is) trabalhado(s), ' +
        metrics.deposits + ' depósito(s) encontrado(s), ' + metrics.depositsWithFocus + ' depósito(s) com foco, ' +
        (metrics.depositsTreated || 0) + ' depósito(s) tratado(s) com BPI e ' + (metrics.bpiGrams || 0) + ' g de BPI aplicado. ' +
        'A infestação está em ' + metrics.infestationRate + '%, com ' + (focusSummary && focusSummary.withFocus ? focusSummary.withFocus : 0) + ' imóvel(is) com foco. ' +
        'Prioridade sugerida: ' + buildStrategicAction(metrics, agents, bairros, microareas) + '.')
      : 'Sem visitas encontradas no recorte atual. Ajuste período, bairro, microárea, quarteirão ou agente para iniciar a leitura operacional.';

    return {
      executiveSummary: executiveSummary,
      returnsPlanned: returnsPlanned,
      returnsOverdue: returnsOverdue,
      workedQuarters: Object.keys(uniqueQuarters).length,
      activeMicroareas: Object.keys(uniqueMicroareas).length,
      waterOpened: waterOpened,
      waterNotInspected: waterNotInspected,
      waterWithFocus: waterWithFocus,
      waterInspected: waterInspected,
      gpsWith: gpsWith,
      gpsWithout: Math.max(0, visits.length - gpsWith),
      withPhoto: withPhoto,
      incomplete: incomplete,
      avgVisitsPerAgent: metrics.activeAgents ? formatAverage(metrics.totalVisits / metrics.activeAgents) : '0',
      avgWorkedPerAgent: metrics.activeAgents ? formatAverage(metrics.visitedProperties / metrics.activeAgents) : '0',
      avgFocusPerAgent: metrics.activeAgents ? formatAverage(focusTotal / metrics.activeAgents) : '0',
      avgRegistrationsPerAgent: agents.length ? formatAverage(agents.reduce(function (sum, agent) { return sum + Number(agent.cadastros || 0); }, 0) / agents.length) : '0',
      repeatedProperties: repeatedProperties,
      recurringClosed: recurringClosed,
      recusaCount: recusaCount,
      recoveredCount: metrics.recovered,
      priorityBairro: bairros[0] ? bairros[0].nome : 'Sem destaque',
      priorityMicroarea: microareas[0] ? microareas[0].nome : 'Sem destaque',
      mainIssue: issueCandidates && issueCandidates.value > 0 ? issueCandidates.label : 'sem pendência dominante',
      suggestedAction: buildStrategicAction(metrics, agents, bairros, microareas),
      propertiesWithFocus: focusSummary && focusSummary.withFocus ? focusSummary.withFocus : 0
    };
  }


  function buildOperationalAlerts(metrics, overview) {
    var supervisionOpen = getOpenPanelSupervisionRequests(getSupervisionRequestsForCurrentRange()).length;
    var ladderOpen = getOpenPanelLadderRequests(state.filteredVisits || []).length;
    var alerts = [];
    if (supervisionOpen > 0) { alerts.push({ label: 'Solicitações de supervisão abertas', value: supervisionOpen, tone: 'warn' }); }
    if (ladderOpen > 0) { alerts.push({ label: 'Pedidos de escada pendentes', value: ladderOpen, tone: 'warn' }); }
    if (overview && overview.gpsWithout > 0) { alerts.push({ label: 'Visitas sem GPS', value: overview.gpsWithout, tone: 'danger' }); }
    if (metrics && metrics.labPositiveAedes > 0) { alerts.push({ label: 'Tubito Aedes + aguardando ação', value: metrics.labPositiveAedes, tone: 'danger' }); }
    if (metrics && metrics.pending > 0) { alerts.push({ label: 'Imóveis fechados para retorno', value: metrics.pending, tone: 'warn' }); }
    if (metrics && Number(metrics.infestationRate || 0) >= 20) { alerts.push({ label: 'Infestação em atenção', value: metrics.infestationRate + '%', tone: 'danger' }); }
    if (!alerts.length) { alerts.push({ label: 'Sem alerta crítico no recorte', value: 'OK', tone: 'ok' }); }
    return alerts;
  }

  function buildPendingQueueItems(metrics, overview) {
    var supervisionOpen = getOpenPanelSupervisionRequests(getSupervisionRequestsForCurrentRange()).length;
    var ladderOpen = getOpenPanelLadderRequests(state.filteredVisits || []).length;
    var items = [];
    if (overview && overview.gpsWithout > 0) { items.push('Corrigir/conferir ' + overview.gpsWithout + ' visita(s) sem GPS.'); }
    if (metrics && metrics.pending > 0) { items.push('Programar retorno para ' + metrics.pending + ' imóvel(is) fechado(s)/recusado(s).'); }
    if (ladderOpen > 0) { items.push('Despachar ou concluir ' + ladderOpen + ' pedido(s) de escada.'); }
    if (supervisionOpen > 0) { items.push('Atender ' + supervisionOpen + ' solicitação(ões) de supervisão.'); }
    if (metrics && metrics.labPositiveAedes > 0) { items.push('Priorizar ação de bloqueio para ' + metrics.labPositiveAedes + ' tubito(s) Aedes positivo(s).'); }
    if (metrics && metrics.labPending > 0) { items.push('Analisar ' + metrics.labPending + ' tubito(s) pendente(s) no laboratório.'); }
    return items;
  }

  function buildBlockPriorityRanking(bairros, microareas) {
    var rows = [];
    (microareas || []).slice(0, 3).forEach(function (row, index) {
      rows.push({ pos: index + 1, label: row.nome, meta: 'Microárea', focos: row.focos || 0, visitas: row.visitas || 0 });
    });
    if (!rows.length) {
      (bairros || []).slice(0, 3).forEach(function (row, index) {
        rows.push({ pos: index + 1, label: row.nome, meta: 'Bairro', focos: row.focos || 0, visitas: row.visitas || 0 });
      });
    }
    if (!rows.length) {
      return '<div class="panel-brief-line"><span>Sem território crítico consolidado no recorte.</span></div>';
    }
    return rows.map(function (row) {
      return '<div class="panel-brief-line"><strong>' + escapeHtml(row.pos + 'º ' + row.label) + '</strong><span>' + escapeHtml(row.meta + ' • Focos: ' + row.focos + ' • Visitas: ' + row.visitas) + '</span></div>';
    }).join('');
  }

  function renderOperationalExtras(data, recentVisitsByDay, metrics, bairros, microareas) {
    var node = document.getElementById('panelOperationalExtras');
    if (!node) {
      return;
    }
    if (!data) {
      node.innerHTML = '';
      return;
    }
    recentVisitsByDay = Array.isArray(recentVisitsByDay) ? recentVisitsByDay : [];

    function stat(label, value, kind) {
      return '<div class="panel-brief-stat' + (kind ? ' is-' + escapeHtml(kind) : '') + '"><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(String(value)) + '</strong></div>';
    }

    function section(title, body) {
      return '<section class="panel-brief-box"><h3>' + escapeHtml(title) + '</h3>' + body + '</section>';
    }

    function textRow(label, value) {
      return '<div class="panel-brief-line"><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(String(value)) + '</span></div>';
    }

    var alertsHtml = buildOperationalAlerts(metrics || {}, data).map(function (item) {
      return stat(item.label, item.value, item.tone);
    }).join('');
    var pendingItems = buildPendingQueueItems(metrics || {}, data);
    var pendingHtml = pendingItems.length ? pendingItems.map(function (item) {
      return '<div class="panel-brief-line"><span>' + escapeHtml(item) + '</span></div>';
    }).join('') : '<div class="panel-brief-line"><span>Sem pendência operacional crítica no recorte.</span></div>';

    node.innerHTML = [
      section('Alertas operacionais',
        '<div class="panel-brief-stats">' + alertsHtml + '</div>' +
        '<div class="panel-brief-actions"><button class="visit-inline-action" type="button" data-panel-action="open-supervision">Abrir painel da supervisão</button></div>'
      ),
      section('Fila de pendências',
        '<div class="panel-brief-lines">' + pendingHtml + '</div>'
      ),
      section('Prioridade de bloqueio',
        '<div class="panel-brief-lines">' + buildBlockPriorityRanking(bairros || [], microareas || []) + '</div>'
      ),
      section('Resumo executivo do recorte',
        '<div class="panel-brief-lines">' +
          '<div class="panel-brief-line panel-brief-line--narrative"><span>' + escapeHtml(data.executiveSummary || '') + '</span></div>' +
        '</div>'
      ),
      section('Retornos e cobertura',
        '<div class="panel-brief-stats">' +
          stat('Retornos programados', data.returnsPlanned, data.returnsPlanned > 0 ? 'warn' : 'ok') +
          stat('Retornos atrasados', data.returnsOverdue, data.returnsOverdue > 0 ? 'danger' : 'ok') +
          stat('Quarteirões trabalhados', data.workedQuarters, 'accent') +
          stat('Microáreas com visita', data.activeMicroareas, 'accent') +
        '</div>'
      ),
      section("Caixas d'água em risco",
        '<div class="panel-brief-stats">' +
          stat('Caixas abertas', data.waterOpened, data.waterOpened > 0 ? 'danger' : 'ok') +
          stat('Não inspecionadas', data.waterNotInspected, data.waterNotInspected > 0 ? 'warn' : 'ok') +
          stat('Caixas com foco', data.waterWithFocus, data.waterWithFocus > 0 ? 'danger' : 'ok') +
          stat('Caixas inspecionadas', data.waterInspected, 'accent') +
        '</div>'
      ),
      section('Últimos 5 dias',
        buildTrendColumnsHtml(recentVisitsByDay)
      ),
      section('Situação do dia',
        '<div class="panel-brief-lines">' +
          textRow('Maior atenção', data.priorityBairro) +
          textRow('Microárea crítica', data.priorityMicroarea) +
          textRow('Principal pendência', data.mainIssue) +
          textRow('Ação sugerida', data.suggestedAction) +
        '</div>'
      ),
      section('Produtividade média',
        '<div class="panel-brief-stats">' +
          stat('Visitas / agente', data.avgVisitsPerAgent, 'accent') +
          stat('Trabalhados / agente', data.avgWorkedPerAgent, 'production') +
          stat('Cadastros / agente', data.avgRegistrationsPerAgent, 'base') +
          stat('Focos / agente', data.avgFocusPerAgent, data.propertiesWithFocus > 0 ? 'risk-warn' : 'ok') +
        '</div>'
      ),
      section('Imóveis problemáticos',
        '<div class="panel-brief-stats">' +
          stat('Mais de 1 visita', data.repeatedProperties, data.repeatedProperties > 0 ? 'warn' : 'ok') +
          stat('Fechados recorrentes', data.recurringClosed, data.recurringClosed > 0 ? 'danger' : 'ok') +
          stat('Recusas', data.recusaCount, data.recusaCount > 0 ? 'warn' : 'ok') +
          stat('Recuperados', data.recoveredCount, data.recoveredCount > 0 ? 'ok' : 'base') +
        '</div>'
      )
    ].join('');
  }


  function renderPriorityBand(metrics, bairros, microareas) {
    var node = document.getElementById('panelPriorityBand');
    var alert = getOperationalAlert(metrics);
    var bairro = bairros[0] || null;
    var micro = microareas[0] || null;
    var secondary = [];
    if (bairro) {
      secondary.push('Bairro prioritário: ' + bairro.nome);
    }
    if (micro) {
      secondary.push('Microárea prioritária: ' + micro.nome);
    }
    secondary.push('GPS ' + metrics.gpsCoverage + '%');
    secondary.push('Pendências ' + metrics.pending);
    secondary.push('Infestação ' + metrics.infestationRate + '%');
    if (!node) {
      return;
    }
    node.innerHTML = '<div class="priority-band-shell ' + escapeHtml(alert.className) + '">' +
      '<div class="priority-band-main">' +
        '<span class="priority-band-pill">' + escapeHtml(alert.label) + '</span>' +
        '<div class="priority-band-copy"><strong>Painel do recorte</strong><span>' + escapeHtml(alert.text) + '</span></div>' +
      '</div>' +
      '<div class="priority-band-tags">' + secondary.map(function(item){
        return '<span class="priority-band-tag">' + escapeHtml(item) + '</span>';
      }).join('') + '</div>' +
    '</div>';
  }


  function openDailySummaryReport() {
    var metrics = computeMetrics(state.filteredVisits || []);
    var supervisionOpen = getOpenPanelSupervisionRequests(getSupervisionRequestsForCurrentRange()).length;
    var ladderOpen = getOpenPanelLadderRequests(state.filteredVisits || []).length;
    var bairros = aggregateByField(state.filteredVisits || [], 'bairro', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var mainTerritory = bairros[0] ? bairros[0].nome : 'sem território crítico consolidado';
    var text = 'Resumo do dia: foram registradas ' + metrics.totalVisits + ' visita(s), com ' + metrics.depositsWithFocus + ' depósito(s) com foco, ' + metrics.depositsTreated + ' depósito(s) tratado(s), ' + metrics.bpiGrams + ' g de BPI aplicado, ' + ladderOpen + ' pedido(s) de escada em aberto e ' + supervisionOpen + ' solicitação(ões) de supervisão em aberto. Território de maior atenção: ' + mainTerritory + '.';
    switchPanelView('reports');
    var node = document.getElementById('reportOnScreen');
    if (node) {
      node.innerHTML = '<div class="report-story executive-report"><h3>Resumo do dia</h3><p>' + escapeHtml(text) + '</p><p><strong>Uso recomendado:</strong> copie este texto para reunião rápida, grupo de trabalho ou fechamento operacional.</p></div>';
    }
    var directNode = document.getElementById('directNote');
    if (directNode) {
      directNode.innerHTML = '<strong>Resumo rápido</strong><p>' + escapeHtml(text) + '</p>';
    }
    openPrintableWindow(
      'Resumo do dia',
      buildPrintableShell('Resumo do dia', 'Leitura rápida do recorte atual para reunião ou fechamento operacional.', '<div class="box"><strong>Resumo operacional</strong><p>' + escapeHtml(text) + '</p></div>'),
      'Resumo do dia aberto para impressão.'
    );
  }

  function renderDecisionList(metrics, agents, bairros) {
    var node = document.getElementById('decisionList');
    if (!node) {
      return;
    }
    var items = [];
    if (metrics.infestationRate >= 20) {
      items.push('reforçar <strong>bloqueio focal</strong> e visita focal no território com maior concentração de focos, pois a taxa de infestação chegou a ' + reportStrong(metrics.infestationRate + '%'));
    }
    if (metrics.gpsCoverage < 85) {
      items.push('corrigir a rotina de georreferenciamento, já que a cobertura GPS está em ' + reportStrong(metrics.gpsCoverage + '%') + ', abaixo da referência operacional de <strong>85%</strong>');
    }
    if (metrics.returns > 0) {
      items.push('organizar revisita para ' + reportStrong(metrics.returns) + ' retorno(s), priorizando fechados, recusas e quarteirões com menor conversão em recuperado');
    }
    if (agents[0]) {
      items.push('usar o desempenho de ' + reportStrong(agents[0].nome) + ' como referência de produtividade, mantendo comparação de volume, cadastro de base, foco, GPS e pendências entre os agentes');
    }
    if (bairros[0]) {
      items.push('direcionar ação intensiva para ' + reportStrong(bairros[0].nome) + ', com busca ativa de pendências e depósitos críticos');
    }
    if (!items.length) {
      items.push('manter a rotina estável, com monitoramento territorial contínuo, conferência diária do mapa e validação da base cadastral antes da distribuição da equipe');
    }
    node.innerHTML = '<div class="insight-card insight-text"><p><strong>Encaminhamento operacional:</strong> ' + items.join('; ') + '.</p></div>';
  }

  function buildStrategicAction(metrics, agents, bairros, microáreas) {
    if (metrics.infestationRate >= 20 && bairros[0]) {
      return 'Abrir frente imediata em ' + bairros[0].nome + ' e na ' + (microáreas[0] ? 'MA ' + microáreas[0].nome : 'microarea mais critica') + ', com checagem de depositos positivos e varredura de pendencias.';
    }
    if (metrics.pending >= 10 && bairros[0]) {
      return 'Montar mutirao de revisita em ' + bairros[0].nome + ', priorizando fechados, recusas e quarteirões com menor conversao em recuperado.';
    }
    if (metrics.gpsCoverage < 85) {
      return 'Reforcar captura de GPS antes de salvar a visita para melhorar comparativo territorial, calor e rastreabilidade.';
    }
    if (agents[0]) {
      return 'Usar o ritmo de ' + agents[0].nome + ' como referencia operacional e manter cobertura equilibrada entre os quarteirões com maior carga.';
    }
    return 'Manter cobertura territorial, validar a base cadastral e acompanhar diariamente o recorte para antecipar focos e pendencias.';
  }

  function renderTable(visits) {
    var node = document.getElementById('dashboardTable');
    if (!node) {
      return;
    }
    if (!visits.length) {
      node.innerHTML = '<div class="visit-list-empty">Nenhuma visita encontrada no recorte.</div>';
      return;
    }
    if (state.selectedVisitUid && !visits.some(function (visit) { return visit.uid === state.selectedVisitUid; })) {
      state.selectedVisitUid = '';
    }
    node.innerHTML = visits.map(function (visit) {
      var sequenceText = visit.tipo && visit.tipo !== 'Normal' ? ' seq ' + visit.tipo : '';
      var actionLinks = [];
      var labText = formatLabSummaryForVisit(visit);
      actionLinks.push('<button type="button" class="visit-inline-action" data-visit-pdf="' + escapeHtml(visit.uid) + '">🖨️ Gerar PDF da visita</button>');
      if (visit.pdfUrl && !/^about:blank/i.test(visit.pdfUrl)) {
        actionLinks.push('<a href="' + escapeHtml(visit.pdfUrl) + '" target="_blank" rel="noopener noreferrer">PDF remoto</a>');
      }
      if (visit.routeUrl) {
        actionLinks.push('<a href="' + escapeHtml(visit.routeUrl) + '" target="_blank" rel="noopener noreferrer">Rota</a>');
      }
      return '<article class="visit-list-item' + (state.selectedVisitUid === visit.uid ? ' is-active-row' : '') + '" data-visit-row="' + escapeHtml(visit.uid) + '">' +
        '<div class="visit-list-item__head">' +
          '<strong>' + escapeHtml(formatDateBR(visit.data) + ' ' + visit.hora) + '</strong>' +
          '<span>' + escapeHtml(visit.agente || '-') + '</span>' +
        '</div>' +
        '<div class="visit-list-item__address">' + escapeHtml(visit.logradouro + ', ' + visit.numero + sequenceText) + '</div>' +
        '<div class="visit-list-item__meta">' + escapeHtml(visit.bairro + ' • MA ' + (visit.microarea || '-') + ' • Q ' + (visit.quarteirao || '-')) + '</div>' +
        '<div class="visit-list-item__status">' +
          '<span>Situação: ' + escapeHtml(visit.situacao) + '</span>' +
          '<span>Foco: ' + escapeHtml(visit.foco + ' • ' + visit.focusCount) + '</span>' +
          '<span>Depósitos: ' + escapeHtml(String(visit.depositCount)) + '</span>' +
          '<span>Dep. com foco: ' + escapeHtml(String(visit.depositFocusCount)) + '</span>' +
          '<span>Dep. eliminados: ' + escapeHtml(String(Number(visit.depositCount || 0) || 0)) + '</span>' +
          (labText ? '<span>Lab: ' + escapeHtml(labText) + '</span>' : '') +
          '<span>Caixa d\'água: ' + escapeHtml(visit.waterAccess || '-') + '</span>' +
          '<span>GPS: ' + escapeHtml(visit.gps_lat !== null && visit.gps_lng !== null ? 'Sim' : 'Não') + '</span>' +
        '</div>' +
        (actionLinks.length ? '<div class="visit-list-item__actions">' + actionLinks.join(' • ') + '</div>' : '') +
      '</article>';
    }).join('');
  }

  function renderDrilldownPanel(metrics) {
    var node = document.getElementById('drilldownPanel');
    if (!node) {
      return;
    }
    var filters = [
      document.getElementById('bairroFilter').value || 'Todos os bairros',
      document.getElementById('microareaFilter').value ? 'MA ' + document.getElementById('microareaFilter').value : 'Todas as microáreas',
      document.getElementById('quarteiraoFilter') && document.getElementById('quarteiraoFilter').value ? 'Q ' + document.getElementById('quarteiraoFilter').value : 'Todos os quarteirões',
      document.getElementById('logradouroFilter') && document.getElementById('logradouroFilter').value ? document.getElementById('logradouroFilter').value : 'Todas as ruas',
      document.getElementById('agentFilter').value || 'Todos os agentes',
      document.getElementById('operationFilter') && document.getElementById('operationFilter').value ? operationModeLabel(document.getElementById('operationFilter').value) : 'Todas as operacoes'
    ].join(' • ');
    var cards = [
      '<p><strong>Síntese do recorte:</strong> foram ' + reportStrong(metrics.totalVisits) + ' visita(s), com ' + reportStrong(metrics.pending) + ' pendência(s), ' + reportStrong(metrics.depositsWithFocus) + ' depósito(s) com foco e cobertura GPS de ' + reportStrong(metrics.gpsCoverage + '%') + '.</p>',
      '<p><strong>Aprofundamento operacional:</strong> use os cards comparativos para refinar bairro, microárea, quarteirão, rua ou agente sem sair desta tela. A inspeção detalhada de registros individuais fica na tela <strong>Visitas consolidadas</strong>.</p>'
    ];
    if (state.filteredProperties.length) {
      var complementSummary = summarizePropertyComplements(state.filteredProperties);
      cards.push('<p><strong>Base cadastral filtrada:</strong> há ' + reportStrong(state.filteredProperties.length) + ' cadastro(s), sendo ' + reportStrong(complementSummary.Normal) + ' normal(is), ' + reportStrong(complementSummary.Sequencia) + ' sequência(s) e ' + reportStrong(complementSummary.Complemento) + ' complemento(s).</p>');
    }
    node.innerHTML = '<div class="insight-card insight-text">' + cards.join('') + '</div>';
  }

  function renderVisitInspectionPanel() {
    var node = document.getElementById('visitInspectionPanel');
    if (!node) {
      return;
    }
    var section = node.closest('.panel-visit-inspection-card');
    var grid = node.closest('.panel-visits-grid');
    var selected = getSelectedVisit();
    var selectedProperty = selected ? findPropertyForVisit(selected) : null;
    var cards = [];
    if (selected) {
      var selectedLab = getLabSummaryForVisit(selected);
      var selectedLabRows = selectedLab.rows || [];
      if (section) {
        section.hidden = false;
      }
      if (grid) {
        grid.classList.remove('is-inspection-hidden');
      }
      cards.push(
        '<p><strong>Visita selecionada:</strong> o imóvel ' + reportStrong(selected.logradouro + ', ' + selected.numero) + ', em ' + reportStrong(selected.bairro) + ', foi registrado por ' + reportStrong(selected.agente || '-') + ' como ' + reportStrong(selected.situacao) + '. A marcação de foco consta como ' + reportStrong(selected.foco + ' • ' + selected.focusCount + ' foco(s)') + ', com referência territorial ' + reportStrong((selected.gpsTerritory || 'sem território por GPS') + (selected.gpsQuarteirao ? ' • Q ' + selected.gpsQuarteirao : '')) + (selected.qualityFlags ? ' e alerta de qualidade ' + reportStrong(selected.qualityFlags) : '') + '.</p>' +
        '<p><strong>Caixa d\'água:</strong> ' + reportStrong(normalizeWaterAccess(selected.waterAccess) || 'sem informação') + (normalizeWaterTankCondition(selected.waterTankCondition) ? ' • ' + reportStrong(normalizeWaterTankCondition(selected.waterTankCondition)) : '') + (selected.waterAccessReason ? ' • motivo: ' + reportStrong(selected.waterAccessReason) : '') + (selected.waterTreatment ? ' • tratamento: ' + reportStrong(selected.waterTreatment) : '') + '.</p>' +
        '<p><strong>Laboratório:</strong> ' + (selectedLab.total ? reportStrong(selectedLab.text + ' / ' + selectedLab.total + ' tubito(s)') + (selectedLabRows.length ? ' (' + selectedLabRows.map(function (row) { return reportStrong((row.numeroTubito || '-') + (row.depositoCodigo ? ' • ' + row.depositoCodigo : '') + (row.especie ? ' • ' + row.especie : '')); }).join(', ') + ')' : '') : reportStrong('sem tubito laboratorial vinculado')) + '.</p>' +
        '<div style="margin-top:10px" class="visit-inspection-actions">' +
          '<button type="button" class="visit-inline-action" data-visit-pdf="' + escapeHtml(selected.uid) + '">🖨️ Gerar PDF da visita</button>' +
          (selected.pdfUrl && !/^about:blank/i.test(selected.pdfUrl) ? ' • <a href="' + escapeHtml(selected.pdfUrl) + '" target="_blank" rel="noopener noreferrer">PDF remoto</a>' : '') +
          (selected.routeUrl ? ' • <a href="' + escapeHtml(selected.routeUrl) + '" target="_blank" rel="noopener noreferrer">Abrir rota</a>' : '') +
        '</div>'
      );
      cards.push('<p><strong>Cadastro vinculado:</strong> ' + (selectedProperty ?
        ('o imóvel está classificado como ' + reportStrong(selectedProperty.tipo || 'sem tipo') + ', complemento ' + reportStrong(selectedProperty.complemento || 'Normal') + ', referência ' + reportStrong(getPropertyReferenceText(selectedProperty)) + (selectedProperty.morador || selectedProperty.telefone ? ', com contato ' + reportStrong((selectedProperty.morador || 'sem morador informado') + (selectedProperty.telefone ? ' • ' + selectedProperty.telefone : '')) : '')) :
        'nenhum cadastro foi encontrado para esse endereço no recorte atual') + '.</p>');
      node.innerHTML = '<div class="insight-card insight-text">' + cards.join('') + '</div>';
      return;
    }
    node.innerHTML = '';
    if (section) {
      section.hidden = true;
    }
    if (grid) {
      grid.classList.add('is-inspection-hidden');
    }
  }

  function pointInsidePolygon(lat, lng, polygon) {
    var inside = false;
    var i;
    var j;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return false;
    }
    for (i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      var yi = Number(polygon[i][0]);
      var xi = Number(polygon[i][1]);
      var yj = Number(polygon[j][0]);
      var xj = Number(polygon[j][1]);
      var intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi) / ((yj - yi) || 1e-9)) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  function territoryMatchesCurrentFilter(feature) {
    var bairroFilter = document.getElementById('bairroFilter');
    var quarteiraoFilter = document.getElementById('quarteiraoFilter');
    var bairro = bairroFilter ? normalizeLabel(bairroFilter.value) : '';
    var quarteirao = quarteiraoFilter ? normalizeQuarteirao(quarteiraoFilter.value) : '';

    if (bairro && feature.territoryKey !== bairro) {
      return false;
    }
    if (quarteirao && feature.quarteiraoKey !== quarteirao) {
      return false;
    }
    return !!(bairro || quarteirao);
  }

  function resolvePolygonForVisit(visit) {
    var visitQuarteirao = normalizeQuarteirao(visit.gpsQuarteirao || visit.quarteirao);
    var visitTerritory = normalizeTerritoryCandidate(visit.gpsTerritory || visit.bairro || visit.microarea);
    var directMatch;

    if (visitQuarteirao) {
      directMatch = state.territoryPolygons.filter(function (feature) {
        return feature.quarteiraoKey === visitQuarteirao && (!visitTerritory || feature.territoryKey === visitTerritory);
      });
      if (directMatch[0]) {
        return directMatch[0];
      }

      directMatch = state.territoryPolygons.filter(function (feature) {
        return feature.quarteiraoKey === visitQuarteirao;
      });
      if (directMatch.length === 1) {
        return directMatch[0];
      }
    }

    if (visit.gps_lat === null || visit.gps_lng === null) {
      return null;
    }

    return state.territoryPolygons.find(function (feature) {
      return pointInsidePolygon(visit.gps_lat, visit.gps_lng, feature.coordinates);
    }) || null;
  }

  function resolveTerritoryPointForVisit(visit) {
    var visitQuarteirao = normalizeQuarteirao(visit.gpsQuarteirao || visit.quarteirao);
    var visitTerritory = normalizeTerritoryCandidate(visit.gpsTerritory || visit.bairro || visit.microarea);
    var directMatch;

    if (visitQuarteirao) {
      directMatch = state.territoryPoints.filter(function (feature) {
        return feature.quarteiraoKey === visitQuarteirao && (!visitTerritory || feature.territoryKey === visitTerritory);
      });
      if (directMatch[0]) {
        return directMatch[0];
      }

      directMatch = state.territoryPoints.filter(function (feature) {
        return feature.quarteiraoKey === visitQuarteirao;
      });
      if (directMatch.length === 1) {
        return directMatch[0];
      }
    }

    if (visitTerritory) {
      directMatch = state.territoryPoints.filter(function (feature) {
        return feature.territoryKey === visitTerritory;
      });
      if (directMatch[0]) {
        return directMatch[0];
      }
    }

    return null;
  }

  function getMapCoordinateForVisit(visit) {
    var rawLat = visit.gps_lat;
    var rawLng = visit.gps_lng;
    var polygon = resolvePolygonForVisit(visit);
    if (rawLat !== null && rawLng !== null && polygon && pointInsidePolygon(rawLat, rawLng, polygon.coordinates)) {
      return { lat: rawLat, lng: rawLng, source: 'gps' };
    }
    var centroid = polygon ? getPolygonCentroid(polygon.coordinates) : null;
    if (centroid) {
      return { lat: centroid[0], lng: centroid[1], source: 'territory' };
    }
    var territoryPoint = resolveTerritoryPointForVisit(visit);
    if (territoryPoint && territoryPoint.coordinates.length === 2) {
      return { lat: territoryPoint.coordinates[0], lng: territoryPoint.coordinates[1], source: 'kmz-point' };
    }
    if (rawLat !== null && rawLng !== null && isCoordinateInsideTerritory(rawLat, rawLng)) {
      return { lat: rawLat, lng: rawLng, source: 'gps' };
    }
    return null;
  }

  function aggregateTerritoryMetrics(visits) {
    var map = {};
    var matchedVisits = 0;

    visits.forEach(function (visit) {
      var polygon = resolvePolygonForVisit(visit);
      if (!polygon) {
        return;
      }
      matchedVisits += 1;
      if (!map[polygon.id]) {
        map[polygon.id] = {
          visitas: 0,
          focos: 0,
          depositos: 0,
          depositosComFoco: 0,
          fechados: 0,
          recuperados: 0,
          pendencias: 0,
          tubitos: 0,
          territoryName: polygon.territoryName,
          quarteiraoName: polygon.name
        };
      }
      map[polygon.id].visitas += 1;
      map[polygon.id].focos += Number(visit.focusCount || 0) || 0;
      map[polygon.id].depositos += Number(visit.depositCount || 0) || 0;
      map[polygon.id].depositosComFoco += Number(visit.depositFocusCount || 0) || 0;
      map[polygon.id].tubitos += Number(visit.tubitosQty || 0) || 0;
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        map[polygon.id].fechados += 1;
      }
      if (visit.situacao === 'Recuperado') {
        map[polygon.id].recuperados += 1;
      }
    });

    Object.keys(map).forEach(function (key) {
      var bucket = map[key];
      bucket.pendencias = Math.max(0, bucket.fechados - bucket.recuperados);
      bucket.taxaInfestacao = bucket.depositos ? Number(((bucket.depositosComFoco / bucket.depositos) * 100).toFixed(1)) : 0;
      bucket.combinedScore = bucket.focos + bucket.depositosComFoco + bucket.pendencias;
    });

    return {
      rows: map,
      matchedVisits: matchedVisits
    };
  }

  function getTerritoryRiskPalette(metrics, mode) {
    var level = getTerritoryRiskLevelForValue(getTerritoryMetricValue(metrics, mode), mode);
    if (level === 'critico') {
      return { level: level, label: 'Crítico', stroke: '#b91c1c', fill: '#ef4444', opacity: 0.28 };
    }
    if (level === 'atencao') {
      return { level: level, label: 'Atenção', stroke: '#b7791f', fill: '#facc15', opacity: 0.22 };
    }
    return { level: level, label: 'Baixo risco', stroke: '#15803d', fill: '#86efac', opacity: 0.16 };
  }

  function buildTerritoryPopup(feature, metrics, mode) {
    var selectionTitle = getTerritoryFeatureScope(feature) + ': ' + getTerritoryFeatureTitle(feature);
    var lines = [];
    var palette = metrics ? getTerritoryRiskPalette(metrics, mode) : null;
    var metricMeta = getTerritoryMetricMeta(mode);
    var metricValue = metrics ? getTerritoryMetricValue(metrics, mode) : 0;
    lines.push('<div class="territory-popup">');
    lines.push('<strong>' + escapeHtml(feature.territoryName || feature.folder || 'Território') + '</strong>');
    lines.push('<span>Quarteirão: ' + escapeHtml(feature.name || '-') + '</span>');
    if (metrics) {
      lines.push('<span>Classificação: ' + escapeHtml(palette.label) + '</span>');
      lines.push('<span>Critério do semáforo: ' + escapeHtml(metricMeta.shortLabel) + '</span>');
      lines.push('<span>Valor do critério: ' + escapeHtml(formatTerritoryMetricValue(metricValue, mode)) + (mode === 'infestation' ? '' : ' ' + escapeHtml(metricMeta.unit.trim())) + '</span>');
      lines.push('<span>Visitas: ' + escapeHtml(String(metrics.visitas)) + '</span>');
      lines.push('<span>Focos: ' + escapeHtml(String(metrics.focos)) + '</span>');
      lines.push('<span>Depósitos encontrados: ' + escapeHtml(String(metrics.depositos)) + '</span>');
      lines.push('<span>Depósitos com foco: ' + escapeHtml(String(metrics.depositosComFoco)) + '</span>');
      lines.push('<span>Taxa de infestação: ' + escapeHtml(formatTerritoryMetricValue(metrics.taxaInfestacao, 'infestation')) + '</span>');
      lines.push('<span>Pendências: ' + escapeHtml(String(metrics.pendencias)) + '</span>');
      lines.push('<span>Tubitos: ' + escapeHtml(String(metrics.tubitos)) + '</span>');
    } else {
      lines.push('<span>Classificação: Baixo risco</span>');
      lines.push('<span>Sem visita filtrada vinculada a este polígono.</span>');
    }
    lines.push('</div>');
    return lines.join('');
  }

  function isQuarteiraoFeature(feature) {
    var rawName = repairTextEncoding(feature && feature.name).trim();
    var rawOriginal = repairTextEncoding(feature && feature.originalName).trim();
    var rawType = String((feature && feature.territoryType) || '').toLowerCase();
    if (!rawName || rawType === 'distrito') {
      return false;
    }
    return /^q\s*[-/]?\s*/i.test(rawOriginal) || /^\d+(?:\s*\/\s*\d+)?$/.test(rawName);
  }

  function getTerritoryFeatureScope(feature) {
    return isQuarteiraoFeature(feature) ? 'Quarteirão' : 'Microárea';
  }

  function getTerritoryFeatureTitle(feature) {
    var territory = repairTextEncoding(feature && (feature.territoryName || feature.folder || feature.originalName || feature.name)).trim();
    var quarter = isQuarteiraoFeature(feature) ? repairTextEncoding(feature.name).trim() : '';
    if (quarter) {
      return 'Q ' + quarter + (territory ? ' • ' + territory : '');
    }
    return territory || 'Território';
  }

  function getTerritoryFeatureKey(feature) {
    return normalizeTerritoryCandidate(feature && (feature.territoryName || feature.folder || feature.originalName || feature.name));
  }

  function hasTerritoryKeyMatch(keys, expected) {
    return !!expected && keys.indexOf(expected) !== -1;
  }

  function getVisitTerritoryKeys(visit) {
    return [
      normalizeTerritoryCandidate(visit && visit.gpsTerritory),
      normalizeTerritoryCandidate(visit && visit.microarea),
      normalizeTerritoryCandidate(visit && visit.bairro)
    ].filter(function (key, index, list) {
      return !!key && list.indexOf(key) === index;
    });
  }

  function getPropertyTerritoryKeys(property) {
    return [
      normalizeTerritoryCandidate(property && property.microarea),
      normalizeTerritoryCandidate(property && property.bairro)
    ].filter(function (key, index, list) {
      return !!key && list.indexOf(key) === index;
    });
  }

  function visitMatchesTerritoryFeature(visit, feature) {
    var featureTerritory = getTerritoryFeatureKey(feature);
    var visitTerritories = getVisitTerritoryKeys(visit);
    var featureQuarter = isQuarteiraoFeature(feature) ? normalizeQuarteirao(feature.name) : '';
    var visitQuarter = normalizeQuarteirao(visit && (visit.gpsQuarteirao || visit.quarteirao));
    var polygon;

    if (featureQuarter) {
      if (visitQuarter === featureQuarter && (!featureTerritory || hasTerritoryKeyMatch(visitTerritories, featureTerritory))) {
        return true;
      }
    } else if (featureTerritory && hasTerritoryKeyMatch(visitTerritories, featureTerritory)) {
      return true;
    }
    polygon = resolvePolygonForVisit(visit);
    if (polygon && polygon.id === feature.id) {
      return true;
    }
    return !!(visit && visit.gps_lat !== null && visit.gps_lng !== null && pointInsidePolygon(visit.gps_lat, visit.gps_lng, feature.coordinates));
  }

  function propertyMatchesTerritoryFeature(property, feature) {
    var featureTerritory = getTerritoryFeatureKey(feature);
    var propertyTerritories = getPropertyTerritoryKeys(property);
    var featureQuarter = isQuarteiraoFeature(feature) ? normalizeQuarteirao(feature.name) : '';
    var propertyQuarter = normalizeQuarteirao(property && property.quarteirao);

    if (featureQuarter && propertyQuarter !== featureQuarter) {
      return false;
    }
    return !featureTerritory || hasTerritoryKeyMatch(propertyTerritories, featureTerritory);
  }

  function getTerritoryFeatureVisits(feature, visits) {
    return (visits || []).filter(function (visit) {
      return visitMatchesTerritoryFeature(visit, feature);
    });
  }

  function getTerritoryFeatureProperties(feature) {
    var source = state.filteredProperties.length ? state.filteredProperties : state.allProperties;
    return source.filter(function (property) {
      return propertyMatchesTerritoryFeature(property, feature);
    });
  }

  function getVisitFocusTotal(visits) {
    return (visits || []).reduce(function (total, visit) {
      return total + (Number(visit.focusCount || 0) || 0);
    }, 0);
  }

  function getSelectedTerritoryFeatureForPrint() {
    var selected = state.selectedTerritory;
    var feature = null;
    if (!selected) {
      return null;
    }
    state.territoryPolygons.some(function (item) {
      var territoryKey = getTerritoryFeatureKey(item);
      if (selected.scope === 'quarter') {
        if ((selected.featureId && String(item.id || '') === selected.featureId) || (selected.quarteiraoKey && isQuarteiraoFeature(item) && normalizeQuarteirao(item.name) === selected.quarteiraoKey && (!selected.territoryKey || territoryKey === selected.territoryKey))) {
          feature = item;
          return true;
        }
        return false;
      }
      if (selected.scope === 'microarea' && selected.territoryKey && territoryKey === selected.territoryKey) {
        feature = getMicroareaFeatureFromTerritory(item);
        return true;
      }
      return false;
    });
    return feature;
  }

  function buildTerritoryPdfHtml(feature, visits, mode) {
    var metrics = computeMetrics(visits);
    var properties = getTerritoryFeatureProperties(feature);
    var agents = aggregateAgents(visits, properties);
    var focusTotal = getVisitFocusTotal(visits);
    var operationSummary = summarizeOperationsForVisits(visits);
    var palette = getTerritoryRiskPalette({ focos: focusTotal, depositosComFoco: metrics.depositsWithFocus, pendencias: metrics.pending, taxaInfestacao: metrics.infestationRate, combinedScore: focusTotal + metrics.depositsWithFocus + metrics.pending }, mode);
    var water = summarizeWaterAccess(visits);
    var waterCondition = summarizeWaterTankConditions(visits);
    var title = getTerritoryFeatureScope(feature) + ' ' + getTerritoryFeatureTitle(feature);
    var subtitle = 'Recorte territorial consolidado para impressão e apresentação.';
    var body = '<div class="inline"><span class="chip">Classificação: ' + escapeHtml(palette.label) + '</span><span class="chip">Visitas: ' + escapeHtml(String(metrics.totalVisits)) + '</span><span class="chip">GPS: ' + escapeHtml(String(metrics.gpsCoverage)) + '%</span><span class="chip">Infestação: ' + escapeHtml(String(metrics.infestationRate)) + '%</span></div><h2>Separação por tipo de trabalho</h2>' + buildOperationSummaryHtml(operationSummary) + '<div class="grid">' + '<div class="box"><strong>Resumo territorial</strong><p><strong>Imóveis trabalhados:</strong> ' + escapeHtml(String(metrics.visitedProperties)) + '</p><p><strong>Revisitas:</strong> ' + escapeHtml(String(metrics.repeatedProperties)) + '</p><p><strong>Abertos:</strong> ' + escapeHtml(String(metrics.opened)) + '</p><p><strong>Fechados/recusas:</strong> ' + escapeHtml(String(metrics.closed)) + '</p><p><strong>Recuperados:</strong> ' + escapeHtml(String(metrics.recovered)) + '</p><p><strong>Pendências:</strong> ' + escapeHtml(String(metrics.pending)) + '</p></div>' + '<div class="box"><strong>Entomologia</strong><p><strong>Focos:</strong> ' + escapeHtml(String(focusTotal)) + '</p><p><strong>Depósitos encontrados:</strong> ' + escapeHtml(String(metrics.deposits || 0)) + '</p><p><strong>Depósitos com foco:</strong> ' + escapeHtml(String(metrics.depositsWithFocus)) + '</p><p><strong>Depósitos tratados:</strong> ' + escapeHtml(String(metrics.depositsTreated || 0)) + '</p><p><strong>BPI (g):</strong> ' + escapeHtml(String(metrics.bpiGrams || 0)) + '</p><p><strong>Depósitos eliminados:</strong> ' + escapeHtml(String(metrics.depositsEliminated || 0)) + '</p><p><strong>Tubitos:</strong> ' + escapeHtml(String(metrics.tubitos)) + '</p></div>' + '<div class="box"><strong>Caixa d\'água</strong><p><strong>Inspecionadas:</strong> ' + escapeHtml(String(water.yes)) + '</p><p><strong>Não inspecionadas:</strong> ' + escapeHtml(String(water.no)) + '</p><p><strong>Tampadas:</strong> ' + escapeHtml(String(waterCondition.tampada)) + '</p><p><strong>Teladas:</strong> ' + escapeHtml(String(waterCondition.telada)) + '</p><p><strong>Abertas:</strong> ' + escapeHtml(String(waterCondition.aberta)) + '</p><p><strong>Tratadas:</strong> ' + escapeHtml(String(water.treated || 0)) + '</p><p><strong>Com foco:</strong> ' + escapeHtml(String(water.withFocus)) + '</p><p><strong>Sem foco:</strong> ' + escapeHtml(String(water.withoutFocus)) + '</p><p><strong>Sem informação:</strong> ' + escapeHtml(String(water.unknown)) + '</p></div>' + '<div class="box"><strong>Base vinculada</strong><p><strong>Cadastros:</strong> ' + escapeHtml(String(properties.length)) + '</p><p><strong>Agentes no recorte:</strong> ' + escapeHtml(String(agents.length)) + '</p><p><strong>Título:</strong> ' + escapeHtml(title) + '</p></div>' + '</div>';
    return buildPrintableShell('Território ACE • ' + title, subtitle, body);
  }

  function openSelectedTerritoryPdf(mode) {
    var feature = getSelectedTerritoryFeatureForPrint();
    var visits;
    if (!feature) {
      setBanner('Selecione um quarteirão ou microárea no mapa antes de gerar o PDF.', 'danger');
      return;
    }
    visits = getTerritoryFeatureVisits(feature, state.filteredVisits);
    openPrintableWindow('Território ACE', buildTerritoryPdfHtml(feature, visits, mode || getTerritoryMetricMode()), 'PDF territorial aberto para impressão.');
  }

  function buildTerritoryDetailPopup(feature, visits, mode) {
    var metrics = computeMetrics(visits);
    var properties = getTerritoryFeatureProperties(feature);
    var agents = aggregateAgents(visits, properties);
    var focusTotal = getVisitFocusTotal(visits);
    var lab = summarizeLabTubitos(getTubitosForVisits(visits));
    var operationSummary = summarizeOperationsForVisits(visits);
    var water = summarizeWaterAccess(visits);
    var waterCondition = summarizeWaterTankConditions(visits);
    var palette = getTerritoryRiskPalette({ focos: focusTotal, depositosComFoco: metrics.depositsWithFocus, pendencias: metrics.pending, taxaInfestacao: metrics.infestationRate, combinedScore: focusTotal + metrics.depositsWithFocus + metrics.pending }, mode);
    var lines = [];
    lines.push('<div class="territory-popup territory-popup-detail">');
    lines.push('<div class="territory-popup__selection"><span>Selecionado no mapa</span><strong>' + escapeHtml(selectionTitle) + '</strong></div>');
    lines.push('<span>Classificação: ' + escapeHtml(palette.label) + '</span>');
    lines.push('<span>Visitas no período: ' + escapeHtml(String(metrics.totalVisits)) + '</span>');
    lines.push('<span>Operacoes: VD ' + escapeHtml(String(operationSummary[0].visits)) + ' • P.E. ' + escapeHtml(String(operationSummary[1].visits)) + ' • LIRAa ' + escapeHtml(String(operationSummary[2].visits)) + '</span>');
    lines.push('<span>Imóveis trabalhados: ' + escapeHtml(String(metrics.visitedProperties)) + ' • Revisitas: ' + escapeHtml(String(metrics.repeatedProperties)) + '</span>');
    lines.push('<span>Focos: ' + escapeHtml(String(focusTotal)) + ' • Dep. c/ foco: ' + escapeHtml(String(metrics.depositsWithFocus)) + '</span>');
    lines.push('<span>Dep. tratados: ' + escapeHtml(String(metrics.depositsTreated || 0)) + ' • BPI: ' + escapeHtml(String(metrics.bpiGrams || 0)) + ' g • Dep. eliminados: ' + escapeHtml(String(metrics.depositsEliminated)) + ' • Lab Aedes +: ' + escapeHtml(String(lab.positiveAedes)) + ' • Lab pendente: ' + escapeHtml(String(lab.pending)) + '</span>');
    lines.push('<span>Abertos: ' + escapeHtml(String(metrics.opened)) + ' • Fechados/recusas: ' + escapeHtml(String(metrics.closed)) + ' • Recuperados: ' + escapeHtml(String(metrics.recovered)) + '</span>');
    lines.push('<span>Pendências: ' + escapeHtml(String(metrics.pending)) + ' • GPS: ' + escapeHtml(String(metrics.gpsCoverage)) + '% • Tubitos: ' + escapeHtml(String(metrics.tubitos)) + '</span>');
    lines.push('<span>Caixas inspecionadas: ' + escapeHtml(String(water.yes)) + ' • Não inspecionadas: ' + escapeHtml(String(water.no)) + '</span>');
    lines.push('<span>Caixas tampadas: ' + escapeHtml(String(waterCondition.tampada)) + ' • Teladas: ' + escapeHtml(String(waterCondition.telada)) + ' • Abertas: ' + escapeHtml(String(waterCondition.aberta)) + ' • Tratadas: ' + escapeHtml(String(water.treated || 0)) + '</span>');
    lines.push('<span>Caixas com foco: ' + escapeHtml(String(water.withFocus)) + ' • Caixas sem foco: ' + escapeHtml(String(water.withoutFocus)) + ' • Sem informação: ' + escapeHtml(String(water.unknown)) + '</span>');
    lines.push('<span>Agentes no recorte: ' + escapeHtml(String(agents.length)) + ' • Base cadastral vinculada: ' + escapeHtml(String(properties.length)) + '</span>');
    lines.push('<div class="territory-popup__actions"><button type="button" class="territory-popup__button" data-territory-pdf="1">🖨️ Gerar PDF</button></div>');
    if (!metrics.totalVisits) {
      lines.push('<span>Sem visita filtrada vinculada a este território.</span>');
    }
    lines.push('</div>');
    return lines.join('');
  }

  function renderTerritoryDrilldownPanel(feature, visits, mode) {
    var node = document.getElementById('drilldownPanel');
    if (!node) {
      return;
    }
    var metrics = computeMetrics(visits);
    var properties = getTerritoryFeatureProperties(feature);
    var focusTotal = getVisitFocusTotal(visits);
    var lab = summarizeLabTubitos(getTubitosForVisits(visits));
    var agents = aggregateAgents(visits, state.filteredProperties);
    var water = summarizeWaterAccess(visits);
    var waterCondition = summarizeWaterTankConditions(visits);
    var title = getTerritoryFeatureScope(feature) + ' ' + getTerritoryFeatureTitle(feature);
    var cards = [
      '<p><strong>Território selecionado:</strong> ' + reportStrong(title) + ' no período filtrado do painel.</p>',
      '<p><strong>Síntese territorial:</strong> foram ' + reportStrong(metrics.totalVisits) + ' visita(s), com ' + reportStrong(metrics.visitedProperties) + ' imóvel(is) trabalhado(s), ' + reportStrong(focusTotal) + ' foco(s), ' + reportStrong(metrics.depositsWithFocus) + ' depósito(s) com foco e cobertura GPS de ' + reportStrong(metrics.gpsCoverage + '%') + '.</p>',
      '<p><strong>Laboratório e tratamento:</strong> ' + reportStrong(lab.positiveAedes) + ' tubito(s) positivo(s) para Aedes, ' + reportStrong(lab.pending) + ' pendente(s), ' + reportStrong(metrics.depositsTreated || 0) + ' depósito(s) tratado(s) com BPI, ' + reportStrong(metrics.bpiGrams || 0) + ' g de BPI e ' + reportStrong(metrics.depositsEliminated) + ' depósito(s) eliminado(s) em campo.</p>',
      '<p><strong>Situação operacional:</strong> ' + reportStrong(metrics.opened) + ' aberto(s)/visitado(s), ' + reportStrong(metrics.closed) + ' fechado(s)/recusa(s), ' + reportStrong(metrics.recovered) + ' recuperado(s) e ' + reportStrong(metrics.pending) + ' pendência(s) para retorno.</p>',
      '<p><strong>Base vinculada:</strong> este recorte territorial possui ' + reportStrong(properties.length) + ' cadastro(s) e ' + reportStrong(agents.length) + ' agente(s) com registro no período.</p>',
      '<p><strong>Caixa d\'água:</strong> inspecionada em ' + reportStrong(water.yes) + ' visita(s), não inspecionada em ' + reportStrong(water.no) + ' e sem informação em ' + reportStrong(water.unknown) + '.</p>',
      '<p><strong>Situação das caixas:</strong> ' + reportStrong(waterCondition.tampada) + ' tampada(s), ' + reportStrong(waterCondition.telada) + ' telada(s), ' + reportStrong(waterCondition.aberta) + ' aberta(s), ' + reportStrong(water.treated || 0) + ' tratada(s), ' + reportStrong(water.withFocus) + ' com foco e ' + reportStrong(water.withoutFocus) + ' sem foco.</p>',
      '<div style="margin-top:10px"><button type="button" class="visit-inline-action" data-territory-pdf="1">🖨️ Gerar PDF do território</button></div>'
    ];
    if (!metrics.totalVisits) {
      cards.push('<p><strong>Leitura:</strong> não há visita vinculada a este território dentro dos filtros atuais.</p>');
    }
    node.innerHTML = '<div class="insight-card insight-text">' + cards.join('') + '</div>';
  }

  function getMicroareaFeatureFromTerritory(feature) {
    var copy = {};
    Object.keys(feature || {}).forEach(function (key) {
      copy[key] = feature[key];
    });
    copy.name = '';
    copy.originalName = '';
    copy.quarteiraoKey = '';
    copy.territoryType = copy.territoryType === 'distrito' ? copy.territoryType : 'microarea';
    return copy;
  }

  function getTerritoryPopupLatLng(feature, event) {
    var centroid;
    if (event && event.latlng) {
      return event.latlng;
    }
    if (feature && feature.featureType === 'point' && Array.isArray(feature.coordinates) && feature.coordinates.length === 2 && window.L) {
      return L.latLng(feature.coordinates[0], feature.coordinates[1]);
    }
    centroid = getPolygonCentroid(feature && feature.coordinates);
    if (centroid && window.L) {
      return L.latLng(centroid[0], centroid[1]);
    }
    return null;
  }

  function stopTerritoryMapEvent(event) {
    if (event && event.originalEvent && window.L) {
      L.DomEvent.stopPropagation(event.originalEvent);
      L.DomEvent.preventDefault(event.originalEvent);
    }
  }

  function openTerritoryFeatureDetail(feature, visits, mode, event) {
    var territoryVisits = getTerritoryFeatureVisits(feature, visits);
    state.selectedVisitUid = '';
    var territoryStats = aggregateTerritoryMetrics(state.filteredVisits);
    renderTerritoryDrilldownPanel(feature, territoryVisits, mode);
    updateTerritorySummary(territoryStats, countHighlightedTerritoryPolygons(territoryStats), mode);
    if (state.map && state.map.closePopup) {
      state.map.closePopup();
    }
  }

  function showFullTerritoryMapContext(mode) {
    var territoryStats = aggregateTerritoryMetrics(state.filteredVisits);
    state.selectedTerritory = null;
    state.selectedVisitUid = '';
    refreshTerritorySelectionHighlight(mode || getTerritoryMetricMode());
    updateTerritorySummary(territoryStats, countHighlightedTerritoryPolygons(territoryStats), mode || getTerritoryMetricMode());
    if (state.map && state.map.closePopup) {
      state.map.closePopup();
    }
  }

  function setTerritorySelection(feature, scope) {
    var quarter = scope === 'quarter' && isQuarteiraoFeature(feature) ? normalizeQuarteirao(feature.name) : '';
    state.selectedTerritory = {
      scope: scope,
      featureId: scope === 'quarter' ? String(feature.id || '') : '',
      territoryKey: getTerritoryFeatureKey(feature),
      quarteiraoKey: quarter
    };
  }

  function getTerritorySelectionMatch(feature) {
    var selected = state.selectedTerritory;
    var featureTerritory = getTerritoryFeatureKey(feature);
    if (!selected || !feature) {
      return '';
    }
    if (selected.scope === 'quarter') {
      if (selected.featureId && String(feature.id || '') === selected.featureId) {
        return 'quarter';
      }
      if (selected.quarteiraoKey && isQuarteiraoFeature(feature) && normalizeQuarteirao(feature.name) === selected.quarteiraoKey &&
        (!selected.territoryKey || featureTerritory === selected.territoryKey)) {
        return 'quarter';
      }
      return '';
    }
    if (selected.scope === 'microarea' && selected.territoryKey && featureTerritory === selected.territoryKey) {
      return 'microarea';
    }
    return '';
  }

  function getTerritoryPolygonStyle(feature, metrics, mode) {
    var shouldHighlight = !!metrics || territoryMatchesCurrentFilter(feature);
    var palette = getTerritoryRiskPalette(metrics, mode);
    var intensity = getTerritoryMetricIntensity(getTerritoryMetricValue(metrics, mode), mode);
    var selectedMatch = getTerritorySelectionMatch(feature);
    if (selectedMatch === 'quarter') {
      return {
        color: '#123f2c',
        weight: 4.5,
        fillColor: '#48a868',
        fillOpacity: 0.6
      };
    }
    if (selectedMatch === 'microarea') {
      return {
        color: '#145d75',
        weight: 3.2,
        fillColor: '#70c1b3',
        fillOpacity: 0.36
      };
    }
    return {
      color: shouldHighlight ? palette.stroke : '#8da0ad',
      weight: shouldHighlight ? 2 : 1,
      fillColor: shouldHighlight ? palette.fill : '#dbe4e7',
      fillOpacity: shouldHighlight ? Math.min(0.36, Math.max(palette.opacity, 0.10 + (intensity * 0.20))) : 0.05
    };
  }

  function refreshTerritorySelectionHighlight(mode) {
    state.territoryPolygonLayers.forEach(function (layer) {
      var feature = layer._aceTerritoryFeature;
      if (!feature || !layer.setStyle) {
        return;
      }
      layer.setStyle(getTerritoryPolygonStyle(feature, layer._aceTerritoryMetrics || null, mode || getTerritoryMetricMode()));
      if (getTerritorySelectionMatch(feature) && layer.bringToFront) {
        layer.bringToFront();
      }
    });
  }

  function getSelectedTerritoryContext() {
    var feature = getSelectedTerritoryFeatureForPrint();
    if (!feature) {
      return { label: 'Recorte atual', value: 'Todos os territórios filtrados' };
    }
    return {
      label: getTerritoryFeatureScope(feature),
      value: getTerritoryFeatureTitle(feature),
      feature: feature
    };
  }

  function buildMapActiveLayerText() {
    var labels = [];
    if (state.mapToggles.polygons) { labels.push('Quarteirões'); }
    if (state.mapToggles.visits && state.mapToggles.visitOpen) { labels.push('Aberto/visitado'); }
    if (state.mapToggles.visits && state.mapToggles.visitClosed) { labels.push('Fechado/recusado'); }
    if (state.mapToggles.visits && state.mapToggles.visitRecovered) { labels.push('Recuperado'); }
    if (state.mapToggles.agents) { labels.push('Agentes'); }
    if (state.mapToggles.ladderRequests) { labels.push('Escada'); }
    if (state.mapToggles.supervision) { labels.push('Supervisão'); }
    if (state.mapToggles.labPositive) { labels.push('Tubito Aedes +'); }
    if (state.mapToggles.heat) { labels.push('Calor de focos'); }
    return labels.length ? labels.join(' • ') : 'nenhuma camada ativa';
  }

  function buildMapContextChip(label, value, tone) {
    return '<span class="map-context-chip' + (tone ? ' is-' + escapeHtml(tone) : '') + '"><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(String(value)) + '</strong></span>';
  }

  function countHighlightedTerritoryPolygons(territoryStats) {
    var rows = territoryStats && territoryStats.rows ? territoryStats.rows : {};
    return (state.territoryPolygons || []).reduce(function (count, feature) {
      return count + ((rows[feature.id] || territoryMatchesCurrentFilter(feature)) ? 1 : 0);
    }, 0);
  }

  function buildTerritoryTextContextHtml(feature, visits, mode, territoryStats, highlightedCount) {
    var metrics = computeMetrics(visits);
    var properties = feature ? getTerritoryFeatureProperties(feature) : (state.filteredProperties.length ? state.filteredProperties : state.allProperties);
    var agents = aggregateAgents(visits, properties);
    var focusTotal = getVisitFocusTotal(visits);
    var lab = summarizeLabTubitos(getTubitosForVisits(visits));
    var operationSummary = summarizeOperationsForVisits(visits);
    var water = summarizeWaterAccess(visits);
    var waterCondition = summarizeWaterTankConditions(visits);
    var palette = getTerritoryRiskPalette({ focos: focusTotal, depositosComFoco: metrics.depositsWithFocus, pendencias: metrics.pending, taxaInfestacao: metrics.infestationRate, combinedScore: focusTotal + metrics.depositsWithFocus + metrics.pending }, mode);
    var selectionLabel = feature ? getTerritoryFeatureScope(feature) : 'Mapa';
    var selectionValue = feature ? getTerritoryFeatureTitle(feature) : 'Todos os territórios filtrados';
    var title = selectionLabel + ': ' + selectionValue;
    var rows = [];
    rows.push('<div class="map-context-text-panel">');
    rows.push('<div class="map-selection-header"><span>Selecionado no mapa</span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(feature ? 'Resumo abaixo calculado somente para este recorte.' : 'Resumo abaixo calculado pelos filtros ativos do painel.') + '</small></div>');
    rows.push('<div class="map-context-columns">');
    rows.push('<p><strong>Classificação:</strong> ' + escapeHtml(palette.label) + '</p>');
    rows.push('<p><strong>Visitas no período:</strong> ' + escapeHtml(String(metrics.totalVisits)) + '</p>');
    rows.push('<p><strong>Operações:</strong> VD ' + escapeHtml(String(operationSummary[0].visits)) + ' • P.E. ' + escapeHtml(String(operationSummary[1].visits)) + ' • LIRAa ' + escapeHtml(String(operationSummary[2].visits)) + '</p>');
    rows.push('<p><strong>Imóveis trabalhados:</strong> ' + escapeHtml(String(metrics.visitedProperties)) + ' • <strong>Revisitas:</strong> ' + escapeHtml(String(metrics.repeatedProperties)) + '</p>');
    rows.push('<p><strong>Focos:</strong> ' + escapeHtml(String(focusTotal)) + ' • <strong>Dep. c/ foco:</strong> ' + escapeHtml(String(metrics.depositsWithFocus)) + '</p>');
    rows.push('<p><strong>Dep. tratados:</strong> ' + escapeHtml(String(metrics.depositsTreated || 0)) + ' • <strong>BPI:</strong> ' + escapeHtml(String(metrics.bpiGrams || 0)) + ' g • <strong>Dep. eliminados:</strong> ' + escapeHtml(String(metrics.depositsEliminated)) + ' • <strong>Lab Aedes +:</strong> ' + escapeHtml(String(lab.positiveAedes)) + ' • <strong>Lab pendente:</strong> ' + escapeHtml(String(lab.pending)) + '</p>');
    rows.push('<p><strong>Abertos:</strong> ' + escapeHtml(String(metrics.opened)) + ' • <strong>Fechados/recusas:</strong> ' + escapeHtml(String(metrics.closed)) + ' • <strong>Recuperados:</strong> ' + escapeHtml(String(metrics.recovered)) + '</p>');
    rows.push('<p><strong>Pendências:</strong> ' + escapeHtml(String(metrics.pending)) + ' • <strong>GPS:</strong> ' + escapeHtml(String(metrics.gpsCoverage)) + '% • <strong>Tubitos:</strong> ' + escapeHtml(String(metrics.tubitos)) + '</p>');
    rows.push('<p><strong>Caixas inspecionadas:</strong> ' + escapeHtml(String(water.yes)) + ' • <strong>Não inspecionadas:</strong> ' + escapeHtml(String(water.no)) + '</p>');
    rows.push('<p><strong>Caixas tampadas:</strong> ' + escapeHtml(String(waterCondition.tampada)) + ' • <strong>Teladas:</strong> ' + escapeHtml(String(waterCondition.telada)) + ' • <strong>Abertas:</strong> ' + escapeHtml(String(waterCondition.aberta)) + ' • <strong>Tratadas:</strong> ' + escapeHtml(String(water.treated || 0)) + '</p>');
    rows.push('<p><strong>Caixas com foco:</strong> ' + escapeHtml(String(water.withFocus)) + ' • <strong>Caixas sem foco:</strong> ' + escapeHtml(String(water.withoutFocus)) + ' • <strong>Sem informação:</strong> ' + escapeHtml(String(water.unknown)) + '</p>');
    rows.push('<p><strong>Agentes no recorte:</strong> ' + escapeHtml(String(agents.length)) + ' • <strong>Base cadastral vinculada:</strong> ' + escapeHtml(String(properties.length)) + '</p>');
    rows.push('</div>');
    rows.push('<p class="map-context-muted"><strong>Camadas ativas:</strong> ' + escapeHtml(buildMapActiveLayerText()) + ' • <strong>Polígonos destacados:</strong> ' + escapeHtml(String(highlightedCount || 0)) + ' • <strong>Visitas vinculadas ao KMZ:</strong> ' + escapeHtml(String((territoryStats && territoryStats.matchedVisits) || 0)) + '</p>');
    if (feature) {
      rows.push('<p class="map-context-actions"><button type="button" class="territory-popup__button map-context-print" data-territory-pdf="1">🖨️ Gerar PDF</button></p>');
    }
    if (!metrics.totalVisits) {
      rows.push('<p class="map-context-empty"><strong>' + (feature ? 'Sem visita filtrada vinculada a este território.' : 'Sem visita filtrada vinculada ao recorte atual.') + '</strong></p>');
    }
    if (!feature) {
      rows.push('<p class="map-context-muted">Clique uma vez em um quarteirão para ver o detalhe dele. Clique duas vezes para resumir a microárea. Clique três vezes para voltar ao mapa completo.</p>');
    }
    rows.push('</div>');
    return rows.join('');
  }

  function updateTerritorySummary(territoryStats, highlightedCount, mode) {
    var node = document.getElementById('territoryMapSummary');
    var selection;
    var contextVisits;
    if (!node) {
      return;
    }
    if (!state.territoryPolygons.length) {
      node.textContent = 'A camada territorial ainda não está disponível neste painel.';
      return;
    }
    selection = getSelectedTerritoryContext();
    contextVisits = selection.feature ? getTerritoryFeatureVisits(selection.feature, state.filteredVisits) : (state.filteredVisits || []);
    node.innerHTML = buildTerritoryTextContextHtml(selection.feature || null, contextVisits, mode, territoryStats || { matchedVisits: 0 }, highlightedCount || 0);
  }


  function renderTerritoryLayers(visits, bounds) {
    var territoryStats;
    var mode = getTerritoryMetricMode();
    hydrateTerritoryData();

    state.territoryPolygonLayers.forEach(function (layer) {
      state.map.removeLayer(layer);
    });
    state.territoryPointLayers.forEach(function (layer) {
      state.map.removeLayer(layer);
    });
    state.territoryPolygonLayers = [];
    state.territoryPointLayers = [];

    territoryStats = aggregateTerritoryMetrics(visits);
    var highlightedCount = 0;

    state.territoryPolygons.forEach(function (feature) {
      var metrics = territoryStats.rows[feature.id] || null;
      var shouldHighlight = !!metrics || territoryMatchesCurrentFilter(feature);
      var polygon = L.polygon(feature.coordinates, getTerritoryPolygonStyle(feature, metrics, mode));
      var clickTimer = null;
      var clickCount = 0;
      polygon._aceTerritoryFeature = feature;
      polygon._aceTerritoryMetrics = metrics;
      polygon.on('click', function (event) {
        stopTerritoryMapEvent(event);
        clickCount += 1;
        if (clickTimer) {
          clearTimeout(clickTimer);
        }
        clickTimer = setTimeout(function () {
          var microareaFeature;
          if (clickCount >= 3) {
            showFullTerritoryMapContext(mode);
          } else if (clickCount === 2) {
            microareaFeature = getMicroareaFeatureFromTerritory(feature);
            setTerritorySelection(microareaFeature, 'microarea');
            refreshTerritorySelectionHighlight(mode);
            openTerritoryFeatureDetail(microareaFeature, state.filteredVisits, mode, event);
          } else {
            setTerritorySelection(feature, 'quarter');
            refreshTerritorySelectionHighlight(mode);
            openTerritoryFeatureDetail(feature, state.filteredVisits, mode, event);
          }
          clickCount = 0;
          clickTimer = null;
        }, 330);
      });
      if (state.mapToggles.polygons) {
        polygon.addTo(state.map);
      }
      state.territoryPolygonLayers.push(polygon);
      if (shouldHighlight) {
        highlightedCount += 1;
        feature.coordinates.forEach(function (coord) {
          bounds.push(coord);
        });
      }
    });

    if (state.mapToggles.points) {
      state.territoryPoints.forEach(function (feature) {
        var marker = L.circleMarker(feature.coordinates, {
          radius: 4.5,
          color: '#ffffff',
          weight: 1.5,
          fillColor: '#183c2c',
          fillOpacity: 0.92
        }).addTo(state.map);
      var pointClickTimer = null;
      var pointClickCount = 0;
      marker.on('click', function (event) {
        stopTerritoryMapEvent(event);
        pointClickCount += 1;
        if (pointClickTimer) {
          clearTimeout(pointClickTimer);
        }
        pointClickTimer = setTimeout(function () {
          var microareaFeature;
          if (pointClickCount >= 3) {
            showFullTerritoryMapContext(mode);
          } else if (pointClickCount === 2) {
            microareaFeature = getMicroareaFeatureFromTerritory(feature);
            setTerritorySelection(microareaFeature, 'microarea');
            refreshTerritorySelectionHighlight(mode);
            openTerritoryFeatureDetail(microareaFeature, state.filteredVisits, mode, event);
          } else {
            setTerritorySelection(feature, isQuarteiraoFeature(feature) ? 'quarter' : 'microarea');
            refreshTerritorySelectionHighlight(mode);
            openTerritoryFeatureDetail(feature, state.filteredVisits, mode, event);
          }
          pointClickCount = 0;
          pointClickTimer = null;
        }, 330);
      });
      state.territoryPointLayers.push(marker);
    });
    }

    updateTerritorySummary(territoryStats, highlightedCount, mode);
    return territoryStats;
  }

  function updateMapBaseButtons() {
    var control = state.mapBaseControl;
    if (!control) {
      return;
    }

    Array.prototype.forEach.call(control.querySelectorAll('[data-map-base]'), function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-map-base') === state.mapBaseMode);
    });
  }

  function switchMapBaseLayer(mode) {
    if (!state.map || !window.L) {
      return;
    }

    if (!state.mapBaseLayers) {
      state.mapBaseLayers = {
        street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Tiles © Esri'
        })
      };
    }

    mode = mode === 'satellite' ? 'satellite' : 'street';

    Object.keys(state.mapBaseLayers).forEach(function (key) {
      if (state.map.hasLayer(state.mapBaseLayers[key])) {
        state.map.removeLayer(state.mapBaseLayers[key]);
      }
    });

    state.mapBaseMode = mode;
    state.mapBaseLayers[mode].addTo(state.map);
    updateMapBaseButtons();
  }

  function installMapBaseControl() {
    var control;

    if (!state.map || !window.L || state.mapBaseControl) {
      return;
    }

    control = L.control({ position: 'topright' });

    control.onAdd = function () {
      var node = L.DomUtil.create('div', 'ace-map-base-control');
      node.innerHTML = '' +
        '<button type="button" data-map-base="street" class="is-active">Mapa</button>' +
        '<button type="button" data-map-base="satellite">Satélite</button>';

      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);

      Array.prototype.forEach.call(node.querySelectorAll('[data-map-base]'), function (button) {
        L.DomEvent.on(button, 'click', function (event) {
          L.DomEvent.stop(event);
          switchMapBaseLayer(button.getAttribute('data-map-base'));
        });
      });

      state.mapBaseControl = node;
      updateMapBaseButtons();
      return node;
    };

    control.addTo(state.map);
  }

  function buildMapLegendHtml() {
    var groups = [];
    var pointItems = [];
    var showVisits = !!(state.mapToggles.visits && (state.mapToggles.visitOpen || state.mapToggles.visitClosed || state.mapToggles.visitRecovered));

    if (showVisits) {
      if (state.mapToggles.visitOpen) {
        pointItems.push('<span><i class="ace-map-dot ace-map-dot-open"></i>Aberto/visitado</span>');
      }
      if (state.mapToggles.visitClosed) {
        pointItems.push('<span><i class="ace-map-dot ace-map-dot-closed"></i>Fechado/recusado</span>');
      }
      if (state.mapToggles.visitRecovered) {
        pointItems.push('<span><i class="ace-map-dot ace-map-dot-recovered"></i>Recuperado</span>');
      }
      pointItems.push('<span><i class="ace-map-dot ace-map-dot-focus"></i>Foco confirmado</span>');
      if (state.mapToggles.labPositive) {
        pointItems.push('<span><i class="ace-map-dot ace-map-dot-lab-positive"></i>Tubito Aedes +</span>');
      }
      pointItems.push('<span><i class="ace-map-dot ace-map-dot-pe"></i>P.E.</span>');
      pointItems.push('<span><i class="ace-map-dot ace-map-dot-liraa"></i>LIRAa</span>');
    }
    if (state.mapToggles.agents) {
      pointItems.push('<span><i class="ace-map-dot ace-map-dot-agent"></i>Agentes</span>');
    }
    if (pointItems.length) {
      groups.push('<div class="ace-map-legend-group"><em>Pontos</em>' + pointItems.join('') + '</div>');
    }

    if (state.mapToggles.polygons) {
      groups.push('<div class="ace-map-legend-group"><em>Quarteirões</em>' +
        '<span><i class="ace-map-swatch ace-map-risk-low"></i>Baixo / sem foco</span>' +
        '<span><i class="ace-map-swatch ace-map-risk-medium"></i>Atenção</span>' +
        '<span><i class="ace-map-swatch ace-map-risk-high"></i>Crítico</span>' +
      '</div>');
    }

    if (state.mapToggles.ladderRequests) {
      groups.push('<div class="ace-map-legend-group"><em>Apoio</em><span><i class="ace-map-dot ace-map-dot-ladder"></i>Pedido de escada</span></div>');
    }

    if (state.mapToggles.supervision) {
      groups.push('<div class="ace-map-legend-group"><em>Supervisão</em><span><i class="ace-map-dot ace-map-dot-supervision"></i>Chamado aberto</span></div>');
    }

    if (state.mapToggles.heat) {
      groups.push('<div class="ace-map-legend-group"><em>Calor de focos</em>' +
        '<span><i class="ace-map-scale ace-map-scale-heat"></i>Vermelho claro → forte</span>' +
      '</div>');
    }

    if (!groups.length) {
      groups.push('<span class="ace-map-legend-empty">Nenhuma camada selecionada</span>');
    }
    return '<strong>Legenda do mapa</strong>' + groups.join('');
  }

  function updateMapLegendControl() {
    if (state.mapLegendControl) {
      state.mapLegendControl.innerHTML = buildMapLegendHtml();
    }
  }

  function installMapLegendControl() {
    if (!state.map || !window.L || state.mapLegendControl) {
      updateMapLegendControl();
      return;
    }

    var control = L.control({ position: 'bottomright' });
    control.onAdd = function () {
      var node = L.DomUtil.create('div', 'ace-map-legend');
      node.innerHTML = buildMapLegendHtml();
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
      state.mapLegendControl = node;
      return node;
    };

    control.addTo(state.map);
  }

  function getAgentLatestPositions(visits) {
    var map = {};

    (visits || []).forEach(function (visit) {
      if (!visit || visit.gps_lat === null || visit.gps_lng === null || !visit.agente) {
        return;
      }

      if (!isRegisteredAgentName(visit.agente)) {
        return;
      }

      var key = normalizeLabel(visit.agente);
      var moment = String(visit.data || '') + 'T' + String(visit.hora || '00:00') + ':00';
      var current = map[key];

      if (!current || moment > current.moment) {
        map[key] = {
          nome: visit.agente,
          lat: visit.gps_lat,
          lng: visit.gps_lng,
          data: visit.data,
          hora: visit.hora,
          bairro: visit.bairro,
          microarea: visit.microarea,
          moment: moment
        };
      }
    });

    return Object.keys(map).map(function (key) {
      return map[key];
    });
  }


  function renderLadderMapMarkers(visits, points) {
    if (!state.mapToggles.ladderRequests) {
      return;
    }
    getOpenPanelLadderRequests(visits).filter(visitHasGps).forEach(function (visit) {
      var marker = L.circleMarker([visit.gps_lat, visit.gps_lng], {
        radius: 9,
        color: '#fff',
        weight: 2.6,
        fillColor: '#f97316',
        fillOpacity: 0.96
      }).addTo(state.map);
      marker.bindPopup('<strong>Pedido de escada</strong><br>' +
        'Agente: ' + escapeHtml(visit.agente || '-') +
        '<br>Data: ' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) +
        '<br>Endereço: ' + escapeHtml([(visit.logradouro || '-'), (visit.numero || '')].filter(Boolean).join(', ')) +
        '<br>Status: ' + escapeHtml(getPanelLadderStatus(visit)), { autoPan: false, maxWidth: 300 });
      state.mapLayers.push(marker);
      points.push([visit.gps_lat, visit.gps_lng]);
    });
  }

  function renderSupervisionMapMarkers(requests, points) {
    if (!state.mapToggles.supervision) {
      return;
    }
    getOpenPanelSupervisionRequests(requests).filter(function (request) {
      return visitCoordinateValid(request.gps_lat) && visitCoordinateValid(request.gps_lng);
    }).forEach(function (request) {
      var marker = L.circleMarker([request.gps_lat, request.gps_lng], {
        radius: 9.5,
        color: '#fff',
        weight: 2.6,
        fillColor: '#7c3aed',
        fillOpacity: 0.97
      }).addTo(state.map);
      marker.bindPopup('<strong>Solicitação de supervisão</strong><br>' +
        'Agente: ' + escapeHtml(request.agente || '-') +
        '<br>Data: ' + escapeHtml(formatDateBR(request.data) + ' ' + (request.hora || '')) +
        '<br>Mensagem: ' + escapeHtml(request.mensagem || 'Agente solicitou supervisão em campo.') +
        '<br>Status: ' + escapeHtml(getPanelSupervisionStatus(request)), { autoPan: false, maxWidth: 300 });
      state.mapLayers.push(marker);
      points.push([request.gps_lat, request.gps_lng]);
    });
  }

  function renderAgentMapMarkers(visits, points) {
    if (!state.mapToggles.agents) {
      return;
    }

    getAgentLatestPositions(visits).forEach(function (agent) {
      var marker = L.circleMarker([agent.lat, agent.lng], {
        radius: 8.5,
        color: '#fff',
        weight: 2.5,
        fillColor: '#0f766e',
        fillOpacity: 0.96
      }).addTo(state.map);

      marker.bindPopup('<strong>Agente: ' + escapeHtml(agent.nome) + '</strong><br>' +
        'Último GPS: ' + escapeHtml(formatDateBR(agent.data) + ' ' + (agent.hora || '')) +
        '<br>Área: ' + escapeHtml([agent.bairro, agent.microarea].filter(Boolean).join(' • ') || '-'), {
        autoPan: false,
        maxWidth: 280
      });

      state.mapLayers.push(marker);
      points.push([agent.lat, agent.lng]);
    });
  }

  function renderHeatMap(visits) {
    var mapNode = document.getElementById('heatMap');
    if (!mapNode || !isPanelViewVisible('map') || mapNode.offsetParent === null) {
      state.pendingMapRender = true;
      return;
    }
    state.pendingMapRender = false;
    if (!window.L) {
      mapNode.innerHTML = '<div class="empty-state">Mapa indisponível sem a biblioteca Leaflet.</div>';
      return;
    }
    var previousView = state.map ? { center: state.map.getCenter(), zoom: state.map.getZoom() } : null;
    if (!state.map) {
      state.map = L.map('heatMap', {
        boxZoom: false,
        doubleClickZoom: false,
        touchZoom: false
      }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
      switchMapBaseLayer(state.mapBaseMode);
      installMapBaseControl();
      installMapLegendControl();
    } else {
      installMapBaseControl();
      installMapLegendControl();
      if (!state.mapBaseLayers || !state.map.hasLayer(state.mapBaseLayers[state.mapBaseMode])) {
        switchMapBaseLayer(state.mapBaseMode);
      }
    }
    state.mapLayers.forEach(function (layer) {
      state.map.removeLayer(layer);
    });
    state.mapLayers = [];

    var points = [];
    var heatBuckets = createHeatBuckets();
    var territoryStats = renderTerritoryLayers(visits, points) || { rows: {} };
    var mode = getTerritoryMetricMode();

    visits.forEach(function (visit) {
      var mapCoordinate = getMapCoordinateForVisit(visit);
      if (!mapCoordinate) {
        return;
      }
      var positiveDeposits = Math.max(0, Number(visit.depositFocusCount || 0));
      if (positiveDeposits > 0) {
        addToneHeatPoint(
          heatBuckets,
          'high',
          mapCoordinate.lat,
          mapCoordinate.lng,
          Math.max(0.35, Math.min(5.5, 0.7 + (positiveDeposits * 0.9)))
        );
      }
      var statusTone = getVisitStatusTone(visit);
      var labText = formatLabSummaryForVisit(visit);
      var labPositiveCount = getAedesPositiveTubitoCountForVisit(visit);
      var showVisitMarker = !!(state.mapToggles.visits && state.mapToggles[statusTone.key]);
      var showLabPositiveMarker = !!(state.mapToggles.labPositive && labPositiveCount > 0);
      if (showVisitMarker || showLabPositiveMarker) {
        var marker = L.circleMarker([mapCoordinate.lat, mapCoordinate.lng], {
          radius: showLabPositiveMarker ? 8.6 : (statusTone.key === 'visitOpen' ? 6.25 : 6.85),
          color: showLabPositiveMarker ? '#7c3aed' : (mapCoordinate.source === 'gps' ? '#fff' : statusTone.markerStroke),
          weight: showLabPositiveMarker ? 3.4 : 2,
          fillColor: showLabPositiveMarker ? '#dc2626' : statusTone.markerFill,
          fillOpacity: showLabPositiveMarker ? 0.96 : 0.9
        }).addTo(state.map);
        marker.bindPopup('<strong>' + escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><br>' +
          escapeHtml(visit.bairro) + '<br>Agente: ' + escapeHtml(visit.agente || '-') +
          '<br>Operação: ' + escapeHtml(visit.operationMode === 'PE' ? 'P.E.' : (visit.operationMode === 'LIRAA' ? 'LIRAa' : 'VD')) +
          '<br>Situação: ' + escapeHtml(statusTone.label) +
          '<br>Foco: ' + escapeHtml(visit.foco) + ' • ' + escapeHtml(String(visit.focusCount)) +
          '<br>Depósitos com foco: ' + escapeHtml(String(visit.depositFocusCount)) +
          '<br>Depósitos eliminados: ' + escapeHtml(String(Number(visit.depositCount || 0) || 0)) +
          (labPositiveCount > 0 ? '<br><strong>Tubito Aedes +: ' + escapeHtml(String(labPositiveCount)) + '</strong>' : '') +
          (labText ? '<br>Laboratório: ' + escapeHtml(labText) : '') +
          '<br>Caixa d\'água: ' + escapeHtml(normalizeWaterAccess(visit.waterAccess) || '-') + (normalizeWaterTankCondition(visit.waterTankCondition) ? ' • ' + escapeHtml(normalizeWaterTankCondition(visit.waterTankCondition)) : '') + (visit.waterAccessReason ? ' • ' + escapeHtml(visit.waterAccessReason) : '') +
          (mapCoordinate.source === 'gps' ? '' : '<br><em>Posicao ajustada pelo KMZ territorial.</em>'), {
          autoPan: false,
          maxWidth: 320
        });
        marker.on('click', function () {
          state.selectedVisitUid = visit.uid;
          renderDrilldownPanel(computeMetrics(state.filteredVisits));
          renderVisitInspectionPanel();
        });
        state.mapLayers.push(marker);
      }
      points.push([mapCoordinate.lat, mapCoordinate.lng]);
    });

    renderLadderMapMarkers(visits, points);
    renderSupervisionMapMarkers(getSupervisionRequestsForCurrentRange(), points);
    renderAgentMapMarkers(visits, points);

    if (state.mapToggles.heat) {
      if (!renderToneHeatLayers(state.map, state.mapLayers, heatBuckets)) {
        renderToneHeatFallback(state.map, state.mapLayers, heatBuckets);
        ['low', 'medium', 'high'].forEach(function (toneKey) {
          (heatBuckets[toneKey] || []).forEach(function (item) {
            points.push([item[0], item[1]]);
          });
        });
      }
    }

    if (state.preserveMapView && previousView) {
      state.map.setView(previousView.center, previousView.zoom, { animate: false });
    } else if (points.length) {
      state.map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
    } else {
      state.map.setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    }
    state.preserveMapView = false;
    setTimeout(function () {
      state.map.invalidateSize();
    }, 120);
  }


  function openPrintableWindow(title, html, successMessage) {
    var win = window.open('', '_blank');
    if (!win) {
      setBanner('Não foi possível abrir a janela de impressão.', 'danger');
      return false;
    }
    win.document.open();
    win.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>' + escapeHtml(title || 'Impressão ACE') + '</title></head><body>' + html + '</body></html>');
    win.document.close();
    win.focus();
    window.setTimeout(function () {
      try { win.focus(); win.print(); } catch (error) {}
    }, 450);
    if (successMessage) {
      setBanner(successMessage, 'ok');
    }
    return true;
  }

  function buildPrintableShell(title, subtitle, bodyHtml) {
    var css = '<style>@page{size:A4;margin:10mm}body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:14px 18px;color:#1b252e;line-height:1.42;font-size:11px}h1{margin:0 0 4px;font-size:18px;color:#183c2c}h2{margin:14px 0 6px;font-size:13px;color:#183c2c;border-bottom:1px solid #dfe8e2;padding-bottom:4px}p{margin:0 0 7px}.toolbar{position:sticky;top:0;z-index:4;display:flex;justify-content:flex-end;gap:8px;padding:8px 0 10px;margin:-4px 0 12px;background:#fff;border-bottom:1px solid #dfe8e2}.toolbar button{border:1px solid #bfcbd1;background:#fff;border-radius:6px;padding:7px 10px;font:700 11px Helvetica,Arial,sans-serif;cursor:pointer}.lead{margin:0 0 10px;color:#5c6972}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.box{border:1px solid #d6dfe2;border-left:3px solid #6f8a7c;border-radius:6px;padding:8px 9px;background:#fff}.box strong{display:block;margin-bottom:3px;color:#183c2c}.inline{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.chip{display:inline-block;padding:4px 8px;border:1px solid #d6dfe2;border-radius:999px;background:#f7faf8;font-weight:700;color:#183c2c}.muted{color:#66727c}.list{margin:8px 0 0;padding-left:18px}.list li{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:9px}th,td{border:1px solid #d6dfe2;padding:4px 5px;text-align:left;vertical-align:top}th{background:#f4f8f6}@media print{body{padding:0}.toolbar{display:none}}</style>';
    css = css.replace('</style>', '.chip.is-danger{border-color:#efc7c7;background:#fff5f5;color:#8f2f2f}.chip.is-warn{border-color:#f0d7a6;background:#fff8e8;color:#80531a}.chip.is-ok{border-color:#bddcc9;background:#f1faf4;color:#23623e}.visit-card-pdf{border:1px solid #cfdcd4;border-radius:10px;padding:10px 11px;background:#fbfdfb;margin:10px 0 12px;break-inside:avoid}.visit-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #dfe8e2;padding-bottom:8px;margin-bottom:8px}.visit-card-head small{display:block;color:#66727c;font-weight:900;text-transform:uppercase;letter-spacing:.04em;font-size:8.5px}.visit-card-head strong{display:block;margin-top:2px;color:#183c2c;font-size:16px;line-height:1.16}.visit-card-head span{display:block;margin-top:3px;color:#5c6972}.visit-card-badge{min-width:72px;text-align:center;border-radius:999px;background:#183c2c;color:#fff;padding:6px 9px;font-weight:900;font-size:10px}.visit-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.visit-card-field{border:1px solid #d6dfe2;border-radius:7px;background:#fff;padding:6px 7px}.visit-card-field small{display:block;color:#66727c;font-weight:800;font-size:8.5px}.visit-card-field strong{display:block;margin-top:2px;color:#1b252e;font-size:10.5px;line-height:1.22}.history-mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}.history-mini{border:1px solid #d6dfe2;border-left:4px solid #6f8a7c;border-radius:8px;background:#fff;padding:7px 8px;break-inside:avoid}.history-mini.is-danger{border-left-color:#a84e4e}.history-mini.is-warn{border-left-color:#b88318}.history-mini.is-ok{border-left-color:#3f7f5b}.history-mini strong{display:block;color:#183c2c;font-size:10.5px}.history-mini span{display:block;margin-top:2px;color:#3e4d56;font-weight:700}.history-mini p{margin:5px 0 0;color:#5c6972;font-size:9.5px;text-align:left}@media print{.visit-card-pdf,.history-mini,.box,tr{break-inside:avoid}}</style>');
    return css + '<div class="toolbar"><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div><h1>' + escapeHtml(title || 'Relatório ACE') + '</h1>' + (subtitle ? '<p class="lead">' + escapeHtml(subtitle) + '</p>' : '') + bodyHtml;
  }

  function compareVisitDescForPdf(a, b) {
    return String((b.data || '') + ' ' + (b.hora || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '')));
  }

  function getVisitHistoryForPdf(visit) {
    var selectedUid = String(visit && visit.property_uid || '').trim();
    var selectedKey = addressKey(visit || {});
    return (state.allVisits || []).filter(function (item) {
      var itemUid = String(item && item.property_uid || '').trim();
      if (selectedUid && itemUid && itemUid === selectedUid) {
        return true;
      }
      return addressKey(item || {}) === selectedKey;
    }).sort(compareVisitDescForPdf);
  }

  function buildVisitCardPdfSection(visit, property) {
    var sequenceText = visit.tipo && visit.tipo !== 'Normal' ? ' seq ' + visit.tipo : '';
    var history = getVisitHistoryForPdf(visit);
    var recent = history.slice(0, 3);
    var focusRecent = recent.some(visitHasFocus);
    var closedRecent = recent.filter(function (item) {
      return item && (item.situacao === 'Fechado' || item.situacao === 'Recusa');
    }).length;
    var waterRecent = recent.some(function (item) {
      return normalizeWaterAccess(item && item.waterAccess) && normalizeWaterAccess(item && item.waterAccess) !== 'Sim';
    });
    var address = (visit.logradouro || '-') + ', ' + (visit.numero || '-') + sequenceText;
    var territory = (visit.bairro || '-') + ' • MA ' + (visit.microarea || '-') + ' • Q ' + (visit.quarteirao || '-');
    var last = recent[0] || visit;
    var chips = [];
    chips.push('<span class="chip">Operacao: ' + escapeHtml(operationModeLabel(getVisitOperationMode(visit))) + '</span>');
    if (!recent.length) {
      chips.push('<span class="chip">Primeira visita no histórico</span>');
    }
    if (focusRecent) {
      chips.push('<span class="chip is-danger">Foco recente</span>');
    }
    if (closedRecent >= 2) {
      chips.push('<span class="chip is-warn">Fechado recorrente</span>');
    }
    if (waterRecent) {
      chips.push('<span class="chip is-warn">Rever caixa d\'água</span>');
    }
    if (visitHasGps(last)) {
      chips.push('<span class="chip is-ok">GPS registrado</span>');
    } else {
      chips.push('<span class="chip is-warn">Sem GPS na última visita</span>');
    }

    var historyHtml = recent.length ? recent.map(function (item, index) {
      var tone = visitHasFocus(item) ? 'is-danger' : ((item.situacao === 'Fechado' || item.situacao === 'Recusa') ? 'is-warn' : 'is-ok');
      var details = [
        'Operacao: ' + operationModeLabel(getVisitOperationMode(item)),
        'Foco: ' + (item.foco || '-') + ' • ' + formatFocusDepositCodes(item),
        'Depósitos: ' + String(item.depositCount || 0),
        'Dep. com foco: ' + String(item.depositFocusCount || 0),
        'Dep. eliminados: ' + String(Number(item.depositCount || 0) || 0),
        'Tubitos: ' + String(item.tubitosQty || 0),
        (formatLabSummaryForVisit(item) ? 'Lab: ' + formatLabSummaryForVisit(item) : ''),
        'Caixa: ' + (normalizeWaterAccess(item.waterAccess) || '-'),
        'GPS: ' + (visitHasGps(item) ? 'Sim' : 'Não')
      ].filter(Boolean).join(' • ');
      return '<div class="history-mini ' + tone + '">' +
        '<strong>' + escapeHtml((index === 0 ? 'Última visita' : 'Visita ' + (index + 1)) + ' • ' + formatDateBR(item.data) + ' ' + (item.hora || '')) + '</strong>' +
        '<span>' + escapeHtml((item.situacao || '-') + (item.agente ? ' • ' + item.agente : '')) + '</span>' +
        '<p>' + escapeHtml(details + (item.closedReason ? ' • Motivo: ' + item.closedReason : '')) + '</p>' +
      '</div>';
    }).join('') : '<div class="history-mini"><strong>Sem histórico anterior</strong><span>Primeiro registro encontrado para este endereço.</span><p>Use este PDF como ponto inicial de acompanhamento.</p></div>';

    return '<section class="visit-card-pdf">' +
      '<div class="visit-card-head">' +
        '<div><small>Cartão de visitas do imóvel</small><strong>' + escapeHtml(address) + '</strong><span>' + escapeHtml(territory) + '</span></div>' +
        '<div class="visit-card-badge">' + escapeHtml(String(history.length || 1)) + ' visita(s)</div>' +
      '</div>' +
      '<div class="visit-card-grid">' +
        '<div class="visit-card-field"><small>Operacao</small><strong>' + escapeHtml(operationModeLabel(getVisitOperationMode(visit))) + '</strong></div>' +
        '<div class="visit-card-field"><small>Morador / responsável</small><strong>' + escapeHtml((property && property.morador) || visit.morador || '-') + '</strong></div>' +
        '<div class="visit-card-field"><small>Contato</small><strong>' + escapeHtml((property && property.telefone) || visit.telefone || '-') + '</strong></div>' +
        '<div class="visit-card-field"><small>Cadastro</small><strong>' + escapeHtml(((property && property.tipo) || visit.tipo || '-') + ' • ' + ((property && property.complemento) || 'Normal')) + '</strong></div>' +
        '<div class="visit-card-field"><small>Referência</small><strong>' + escapeHtml(property ? getPropertyReferenceText(property) : '-') + '</strong></div>' +
        '<div class="visit-card-field"><small>Última situação</small><strong>' + escapeHtml((last && last.situacao) || '-') + '</strong></div>' +
        '<div class="visit-card-field"><small>Caixa d\'água</small><strong>' + escapeHtml(normalizeWaterAccess(last && last.waterAccess) || '-') + '</strong></div>' +
      '</div>' +
      '<div class="inline">' + chips.join('') + '</div>' +
      '<h2>Últimas 3 visitas do imóvel</h2>' +
      '<div class="history-mini-grid">' + historyHtml + '</div>' +
    '</section>';
  }

  function buildVisitPdfHtml(visit, property) {
    var focusBreakdown = visit.depositFocusBreakdown ? '<p><strong>Focos por tipo:</strong> ' + escapeHtml(visit.depositFocusBreakdown) + '</p>' : '';
    var obsText = visit.obs ? '<p><strong>Observações:</strong> ' + escapeHtml(visit.obs) + '</p>' : '';
    var labText = formatLabSummaryForVisit(visit);
    var waterCondition = normalizeWaterTankCondition(visit.waterTankCondition);
    var body = buildVisitCardPdfSection(visit, property) + '<div class="grid">' +
      '<div class="box"><strong>Visita selecionada</strong><p><strong>Operacao:</strong> ' + escapeHtml(operationModeLabel(getVisitOperationMode(visit))) + '</p><p><strong>Data/Hora:</strong> ' + escapeHtml(formatDateBR(visit.data) + ' ' + visit.hora) + '</p><p><strong>Agente:</strong> ' + escapeHtml(visit.agente || '-') + '</p><p><strong>Situação:</strong> ' + escapeHtml(visit.situacao) + '</p><p><strong>Motivo do fechado:</strong> ' + escapeHtml(visit.closedReason || '-') + '</p></div>' +
      '<div class="box"><strong>Produção entomológica</strong><p><strong>Depósitos encontrados:</strong> ' + escapeHtml(String(visit.depositCount)) + '</p><p><strong>Depósitos com foco:</strong> ' + escapeHtml(String(visit.depositFocusCount)) + '</p><p><strong>Depósitos eliminados:</strong> ' + escapeHtml(String(Number(visit.depositCount || 0) || 0)) + '</p><p><strong>Tubitos:</strong> ' + escapeHtml(String(visit.tubitosQty)) + '</p>' + (labText ? '<p><strong>Laboratório:</strong> ' + escapeHtml(labText) + '</p>' : '') + focusBreakdown + '</div>' +
      '<div class="box"><strong>Caixa d\'água, GPS e observações</strong><p><strong>Inspecionada:</strong> ' + escapeHtml(normalizeWaterAccess(visit.waterAccess) || '-') + '</p><p><strong>Situação da caixa:</strong> ' + escapeHtml(waterCondition || '-') + '</p><p><strong>Motivo não acesso:</strong> ' + escapeHtml(visit.waterAccessReason || '-') + '</p><p><strong>Tratamento:</strong> ' + escapeHtml(visit.waterTreatment || '-') + '</p><p><strong>GPS:</strong> ' + escapeHtml(visitHasGps(visit) ? 'Sim' : 'Não') + '</p>' + obsText + '</div>' +
    '</div>';
    return buildPrintableShell('Visita individual ACE', 'Registro consolidado para impressão e apresentação.', body);
  }

  function openVisitPdfByUid(uid) {
    var visit = (state.filteredVisits || []).find(function (item) { return item.uid === uid; }) || (state.allVisits || []).find(function (item) { return item.uid === uid; });
    var property;
    if (!visit) {
      setBanner('Não foi possível localizar a visita para impressão.', 'danger');
      return;
    }
    property = findPropertyForVisit(visit);
    openPrintableWindow('Visita individual ACE', buildVisitPdfHtml(visit, property), 'PDF da visita aberto para impressão.');
  }

  function summarizeWaterTankByOperation(visits) {
    var order = ['VD', 'PE', 'LIRAA'];
    var map = {};

    function ensure(mode) {
      mode = normalizeOperationMode(mode);
      if (!map[mode]) {
        map[mode] = {
          mode: mode,
          label: operationModeLabel(mode),
          total: 0,
          inspected: 0,
          notAccessed: 0,
          openTank: 0,
          closedOrRefused: 0
        };
      }
      return map[mode];
    }

    order.forEach(ensure);
    (visits || []).forEach(function (visit) {
      var row = ensure(getVisitOperationMode(visit));
      var waterAccess = normalizeWaterAccess(visit && visit.waterAccess);
      var condition = normalizeWaterTankCondition(visit && visit.waterTankCondition);
      var situation = String(visit && visit.situacao || '').trim();
      row.total += 1;
      if (waterAccess === 'Sim') {
        row.inspected += 1;
      } else if (waterAccess || (visit && (visit.waterAccessReason || visit.closedReason))) {
        row.notAccessed += 1;
      }
      if (condition === 'Aberta') {
        row.openTank += 1;
      }
      if (situation === 'Fechado' || situation === 'Recusa') {
        row.closedOrRefused += 1;
      }
    });
    return order.map(function (mode) {
      return ensure(mode);
    });
  }

  function buildWaterTankOperationSummaryHtml(visits) {
    var rows = summarizeWaterTankByOperation(visits);
    return '<h2>Resumo por tipo de trabalho</h2><table><thead><tr><th>Tipo</th><th>Registros</th><th>Caixa inspec.</th><th>Nao acesso</th><th>Aberta/vulneravel</th><th>Fechado/recusa</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr><td>' + escapeHtml(row.label) + '</td><td>' + escapeHtml(row.total) + '</td><td>' + escapeHtml(row.inspected) + '</td><td>' + escapeHtml(row.notAccessed) + '</td><td>' + escapeHtml(row.openTank) + '</td><td>' + escapeHtml(row.closedOrRefused) + '</td></tr>';
      }).join('') +
      '</tbody></table>';
  }

  function buildWaterTankReportHtml() {
    var visits = (state.filteredVisits || []).slice().filter(function (visit) {
      return !!(visit.waterAccess || visit.waterTankCondition || visit.waterAccessReason || visit.closedReason);
    }).sort(function (a, b) {
      var rank = { 'Aberta': 0, 'Tampada': 1, 'Telada': 2, 'Vazia': 3, '': 4 };
      var condA = normalizeWaterTankCondition(a.waterTankCondition);
      var condB = normalizeWaterTankCondition(b.waterTankCondition);
      if ((rank[condA] || 4) !== (rank[condB] || 4)) {
        return (rank[condA] || 4) - (rank[condB] || 4);
      }
      var aa = (a.data || '') + 'T' + (a.hora || '00:00');
      var bb = (b.data || '') + 'T' + (b.hora || '00:00');
      return aa < bb ? 1 : aa > bb ? -1 : 0;
    });
    var range = getDateRange();
    var filterSummary = [document.getElementById('bairroFilter').value || 'Todos os bairros', document.getElementById('microareaFilter').value ? 'MA ' + document.getElementById('microareaFilter').value : 'Todas as microáreas', document.getElementById('quarteiraoFilter') && document.getElementById('quarteiraoFilter').value ? 'Q ' + document.getElementById('quarteiraoFilter').value : 'Todos os quarteirões', document.getElementById('logradouroFilter') && document.getElementById('logradouroFilter').value ? document.getElementById('logradouroFilter').value : 'Todas as ruas', document.getElementById('agentFilter').value || 'Todos os agentes'].join(' • ');
    var rowsHtml = visits.map(function (visit) {
      var sequenceText = visit.tipo && visit.tipo !== 'Normal' ? ' seq ' + visit.tipo : '';
      return '<tr><td>' + escapeHtml(formatDateBR(visit.data) + ' ' + visit.hora) + '</td><td>' + escapeHtml(operationModeLabel(getVisitOperationMode(visit))) + '</td><td>' + escapeHtml(visit.agente || '-') + '</td><td>' + escapeHtml((visit.logradouro || '-') + ', ' + (visit.numero || '-') + sequenceText + ' • ' + (visit.bairro || '-')) + '</td><td>' + escapeHtml(visit.situacao || '-') + '</td><td>' + escapeHtml(visit.closedReason || '-') + '</td><td>' + escapeHtml(normalizeWaterAccess(visit.waterAccess) || '-') + '</td><td>' + escapeHtml(normalizeWaterTankCondition(visit.waterTankCondition) || '-') + '</td><td>' + escapeHtml(visit.waterAccessReason || '-') + '</td></tr>';
    }).join('');
    var body = '<div class="inline"><span class="chip">Registros: ' + escapeHtml(String(visits.length)) + '</span><span class="chip">Período: ' + escapeHtml(formatDateBR(range.start) + ' a ' + formatDateBR(range.end)) + '</span></div><p class="muted">Filtros aplicados: ' + escapeHtml(filterSummary) + '.</p>' + buildWaterTankOperationSummaryHtml(visits) + '<h2>Lista de registros</h2><table><thead><tr><th>Data/Hora</th><th>Operação</th><th>Agente</th><th>Endereço</th><th>Situação</th><th>Motivo do fechado</th><th>Caixa inspec.</th><th>Situação da caixa</th><th>Motivo não acesso</th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="9">Nenhum registro de caixa d\'água encontrado no recorte atual.</td></tr>') + '</tbody></table>';
    return buildPrintableShell('Relatório de caixas d\'água', 'Endereços com situação da caixa d\'água, visitas fechadas/abertas e motivos registrados no período.', body);
  }

  function openWaterTankReport() {
    if (!state.filteredVisits.length) {
      setBanner('Não há visitas filtradas para gerar o relatório de caixas d\'água.', 'danger');
      return;
    }
    openPrintableWindow('Relatório de caixas d\'água', buildWaterTankReportHtml(), 'Relatório de caixas d\'água aberto para impressão.');
  }

  function isPendingTubito(row) {
    var status = normalizeLabel(row && row.statusLaboratorio || '');
    if (!row) {
      return true;
    }
    if (isAnalyzedTubito(row)) {
      return false;
    }
    return status.indexOf('pendente') > -1 || status.indexOf('analise') > -1 || !row.resultadoLaboratorio;
  }

  function isAnalyzedTubito(row) {
    var status = normalizeLabel(row && row.statusLaboratorio || '');
    return !!(row && row.resultadoLaboratorio) ||
      status === 'concluido' ||
      status === 'descartado' ||
      status === 'negativo' ||
      status === 'positivo' ||
      status.indexOf('inconclus') > -1;
  }

  function buildTubitosReportHtml() {
    var visits = (state.filteredVisits || []).slice();
    var tubitos = getTubitosForVisits(visits).slice().sort(function (a, b) {
      var order = ['VD', 'PE', 'LIRAA'];
      var modeDiff = order.indexOf(normalizeOperationMode(a.operationMode || a.origemVisita)) -
        order.indexOf(normalizeOperationMode(b.operationMode || b.origemVisita));
      var aa;
      var bb;
      if (modeDiff) {
        return modeDiff;
      }
      aa = (a.dataColeta || '') + 'T' + (a.horaColeta || '00:00') + ' ' + (a.numeroTubito || '');
      bb = (b.dataColeta || '') + 'T' + (b.horaColeta || '00:00') + ' ' + (b.numeroTubito || '');
      return aa.localeCompare(bb, 'pt-BR', { numeric: true });
    });
    var byVisit = {};
    var byMode = {
      VD: { label: operationModeLabel('VD'), total: 0, pending: 0, done: 0, positive: 0 },
      PE: { label: operationModeLabel('PE'), total: 0, pending: 0, done: 0, positive: 0 },
      LIRAA: { label: operationModeLabel('LIRAA'), total: 0, pending: 0, done: 0, positive: 0 }
    };
    var range = getDateRange();
    var filterSummary = [
      document.getElementById('bairroFilter').value || 'Todos os bairros',
      document.getElementById('microareaFilter').value ? 'MA ' + document.getElementById('microareaFilter').value : 'Todas as microáreas',
      document.getElementById('quarteiraoFilter') && document.getElementById('quarteiraoFilter').value ? 'Q ' + document.getElementById('quarteiraoFilter').value : 'Todos os quarteirões',
      document.getElementById('agentFilter').value || 'Todos os agentes',
      document.getElementById('operationFilter').value ? operationModeLabel(document.getElementById('operationFilter').value) : 'VD, P.E. e LIRAa'
    ].join(' • ');

    visits.forEach(function (visit) {
      if (visit && visit.uid) {
        byVisit[String(visit.uid)] = visit;
      }
    });

    tubitos.forEach(function (row) {
      var visit = byVisit[String(row.visit_uid || '')] || {};
      var mode = normalizeOperationMode(row.operationMode || row.origemVisita || visit.operationMode || 'VD');
      var bucket = byMode[mode] || byMode.VD;
      bucket.total += 1;
      if (isPendingTubito(row)) {
        bucket.pending += 1;
      } else {
        bucket.done += 1;
      }
      if (isAedesPositiveTubito(row)) {
        bucket.positive += 1;
      }
    });

    var summaryRows = ['VD', 'PE', 'LIRAA'].map(function (mode) {
      var row = byMode[mode];
      return '<tr><td>' + escapeHtml(row.label) + '</td><td>' + escapeHtml(row.total) + '</td><td>' + escapeHtml(row.done) + '</td><td>' + escapeHtml(row.pending) + '</td><td>' + escapeHtml(row.positive) + '</td></tr>';
    }).join('');
    var tubitosReportCss = '<style>@page{size:A4 landscape}.tubitos-report-table{table-layout:fixed;font-size:8px}.tubitos-report-table th,.tubitos-report-table td{padding:3px 4px}.tubitos-report-table .col-code{width:11%}.tubitos-report-table .col-type{width:7%}.tubitos-report-table .col-date{width:11%}.tubitos-report-table .col-agent{width:12%}.tubitos-report-table .col-address{width:28%}.tubitos-report-table .col-deposit{width:7%}.tubitos-report-table .col-lab{width:14%}.tubitos-report-table .col-origin{width:10%}.tubitos-report-table .cell-detail{display:block;color:#66727c;font-size:7.6px;line-height:1.2;margin-top:2px}.nowrap{white-space:nowrap}</style>';
    var rowsHtml = tubitos.map(function (row) {
      var visit = byVisit[String(row.visit_uid || '')] || {};
      var mode = normalizeOperationMode(row.operationMode || row.origemVisita || visit.operationMode || 'VD');
      var areaText = [row.microarea || visit.microarea || '', (row.quarteirao || visit.quarteirao) ? 'Q ' + (row.quarteirao || visit.quarteirao) : ''].filter(Boolean).join(' • ');
      var addressText = (row.logradouro || visit.logradouro || '-') + ', ' + (row.numero || visit.numero || '-') + ' • ' + (row.bairro || visit.bairro || '-');
      var labText = [
        row.statusLaboratorio || 'Pendente',
        row.resultadoLaboratorio || '',
        row.especie || ''
      ].filter(Boolean).join(' • ');
      var origin = [
        mode === 'PE' && row.peNomeLocal ? row.peNomeLocal : '',
        mode === 'LIRAA' && row.liraaCiclo ? 'Ciclo ' + row.liraaCiclo : '',
        !row.visit_uid ? 'Sem visita vinculada' : ''
      ].filter(Boolean).join(' • ');
      return '<tr><td class="nowrap">' + escapeHtml(row.numeroTubito || row.uid || '-') + '</td><td>' + escapeHtml(operationModeLabel(mode)) + '</td><td class="nowrap">' + escapeHtml(formatDateBR(row.dataColeta || visit.data) + ' ' + (row.horaColeta || visit.hora || '')) + '</td><td>' + escapeHtml(row.agente || visit.agente || '-') + '</td><td>' + escapeHtml(addressText) + '<span class="cell-detail">' + escapeHtml(areaText || '-') + '</span></td><td>' + escapeHtml(row.depositoCodigo || '-') + '</td><td>' + escapeHtml(labText || '-') + '</td><td>' + escapeHtml(origin || '-') + '</td></tr>';
    }).join('');
    var body = tubitosReportCss + '<div class="inline"><span class="chip">Tubitos: ' + escapeHtml(String(tubitos.length)) + '</span><span class="chip">Período: ' + escapeHtml(formatDateBR(range.start) + ' a ' + formatDateBR(range.end)) + '</span></div><p class="muted">Filtros aplicados: ' + escapeHtml(filterSummary) + '.</p><h2>Resumo por tipo de trabalho</h2><table><thead><tr><th>Tipo</th><th>Total</th><th>Analisados</th><th>Pendentes</th><th>Aedes +</th></tr></thead><tbody>' + summaryRows + '</tbody></table><h2>Lista de tubitos</h2><table class="tubitos-report-table"><thead><tr><th class="col-code">Tubito</th><th class="col-type">Tipo</th><th class="col-date">Coleta</th><th class="col-agent">Agente</th><th class="col-address">Endereco / area</th><th class="col-deposit">Deposito</th><th class="col-lab">Laboratorio</th><th class="col-origin">Origem</th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="8">Nenhum tubito encontrado no recorte atual.</td></tr>') + '</tbody></table>';
    return buildPrintableShell('Relatório de tubitos', 'Tubitos coletados no período, sempre separados por VD, P.E. e LIRAa.', body);
  }

  function openTubitosReport() {
    var tubitos = getTubitosForVisits(state.filteredVisits || []);
    if (!tubitos.length) {
      setBanner('Não há tubitos filtrados para gerar relatório.', 'danger');
      return;
    }
    openPrintableWindow('Relatório de tubitos', buildTubitosReportHtml(), 'Relatório de tubitos aberto para impressão.');
  }

  function buildReportHtml(mode) {
    var visits = state.filteredVisits;
    var metrics = computeMetrics(visits);
    var agents = aggregateAgents(visits, state.filteredProperties);
    var bairros = aggregateByField(visits, 'bairro', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var microáreas = aggregateByField(visits, 'microarea', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var focusSummary = computePropertyFocusSummary(visits);
    metrics.propertiesWithFocus = focusSummary.withFocus;
    metrics.propertiesWithoutFocus = focusSummary.withoutFocus;
    var focusTotal = getVisitFocusTotal(visits);
    var criticalStreets = aggregateCriticalStreets(visits).slice(0, 5);
    var criticalQuarteiroes = getTopQuarteiroesProblematicos(visits, 3);
    var criticalMicroareas = getMicroareasComMaisQuarteiroesComFoco(visits, 3);
    var strategicAction = buildStrategicAction(metrics, agents, bairros, microáreas);
    var complementSummary = summarizePropertyComplements(state.filteredProperties);
    var operationBreakdown = summarizeOperationsForVisits(visits);
    var range = getDateRange();
    var selectedAgent = document.getElementById('agentFilter').value || '';
    var alert = getOperationalAlert(metrics);
    var filterSummary = [
      document.getElementById('bairroFilter').value || 'Todos os bairros',
      document.getElementById('microareaFilter').value ? 'MA ' + document.getElementById('microareaFilter').value : 'Todas as microáreas',
      document.getElementById('quarteiraoFilter') && document.getElementById('quarteiraoFilter').value ? 'Q ' + document.getElementById('quarteiraoFilter').value : 'Todos os quarteirões',
      document.getElementById('logradouroFilter') && document.getElementById('logradouroFilter').value ? document.getElementById('logradouroFilter').value : 'Todas as ruas',
      document.getElementById('agentFilter').value || 'Todos os agentes'
    ].join(' • ');
    var css = '<style>@page{size:A4;margin:9mm}body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:14px 18px;color:#1b252e;line-height:1.38;font-size:10.5px}h1,h2,h3{color:#183c2c}h1{margin:0 0 4px;font-size:17px}h2{margin:12px 0 6px;border-bottom:1px solid #dfe8e2;padding-bottom:3px;font-size:12.5px}h3{margin:0 0 5px;font-size:11px}p{font-size:10.5px;margin:0 0 7px;text-align:justify}.note{margin-top:4px;color:#66727c;font-size:9.5px}.report-toolbar{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:flex-end;margin:-4px 0 10px;padding:8px;background:#fff;border-bottom:1px solid #dfe8e2}.report-toolbar button{border:1px solid #bfcbd1;background:#fff;border-radius:6px;padding:7px 10px;font:700 11px Helvetica,Arial,sans-serif;cursor:pointer}.alert-box{border:1px solid #d6dfe2;border-left:4px solid #6f8a7c;border-radius:6px;padding:7px 9px;margin:8px 0;background:#fff}.alert-box.is-critical{border-left-color:#a84e4e}.alert-box.is-priority{border-left-color:#8f6544}.alert-box.is-warning{border-left-color:#b88318}.alert-box.is-stable{border-left-color:#3f7f5b}.alert-box strong{display:block;font-size:11px}.alert-box span{display:block;margin-top:2px;color:#5c6972}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:9px 0}.metric-card{border:1px solid #d6dfe2;border-left:3px solid #6f8a7c;border-radius:6px;padding:5px 6px;background:#fff}.metric-card small{display:block;color:#66727c;font-weight:700;font-size:8.5px;line-height:1.1}.metric-card strong{display:block;margin-top:2px;font-size:14px;line-height:1;color:#183c2c}.report-kpi{font-weight:900;color:#183c2c}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:8.5px}th,td{border:1px solid #d6dfe2;padding:3px 4px;text-align:left;vertical-align:top}th{background:#f4f8f6}.section-box{border:1px solid #d6dfe2;border-radius:6px;padding:8px 9px;background:#fff;margin-top:7px}.narrative-report{border-left:4px solid #6f8a7c}.section-box .agent-performance{margin:0 0 6px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:7px}.compact-list p{margin-bottom:4px}.territory-lead,.territory-row,.decision-row{border:1px solid #dfe6e9;border-left:3px solid #6f8a7c;border-radius:6px;padding:6px 7px;margin-bottom:5px;background:#fff}.territory-lead strong,.territory-row strong,.decision-row strong{display:block;margin-bottom:2px;color:#1f2f38;font-size:9.5px}.territory-lead span,.territory-row span,.decision-row span{display:block;color:#3e4d56}.decision-row-main{border-left-color:#8f6544}@media print{body{padding:0}.report-toolbar{display:none}.grid{grid-template-columns:repeat(5,1fr)}h2{break-after:avoid}.section-box,.metric-card,tr,.territory-row,.decision-row{break-inside:avoid}}</style>';
    var metricGrid = '<div class="grid">' +
      metricCard('Cadastrados na Nuvem', state.allProperties.length, 'accent') +
      metricCard('Visitas no período', metrics.totalVisits, 'accent') +
      metricCard('VD', operationBreakdown[0].visits, 'ok') +
      metricCard('P.E.', operationBreakdown[1].visits, 'warn') +
      metricCard('LIRAa', operationBreakdown[2].visits, 'accent') +
      metricCard('Trabalhados', metrics.visitedProperties, 'accent') +
      metricCard('+ de 1 vez', metrics.repeatedProperties, 'warn') +
      metricCard('Pendências', metrics.pending, 'danger') +
      metricCard('Abertos', metrics.opened, 'ok') +
      metricCard('Fechados', metrics.closed, 'warn') +
      metricCard('Recuperados', metrics.recovered, 'accent') +
      metricCard('GPS', metrics.gpsCoverage + '%', 'accent') +
      metricCard('Imóveis com foco', focusSummary.withFocus, 'danger') +
      metricCard('Depósitos encontrados', metrics.deposits, 'warn') +
      metricCard('Depósitos com foco', metrics.depositsWithFocus, 'danger') +
      metricCard('Depósitos tratados', metrics.depositsTreated || 0, 'ok') +
      metricCard('BPI aplicado (g)', metrics.bpiGrams || 0, 'warn') +
      metricCard('Depósitos eliminados', metrics.depositsEliminated, 'ok') +
      metricCard('Taxa de infestação', metrics.infestationRate + '%', 'danger') +
      metricCard('Tubitos', metrics.tubitos, 'warn') +
    '</div>';
    var executiveBody = buildExecutiveMailMergeReport({
      metrics: metrics,
      agents: agents,
      bairros: bairros,
      microáreas: microáreas,
      criticalStreets: criticalStreets,
      criticalQuarteiroes: criticalQuarteiroes,
      criticalMicroareas: criticalMicroareas,
      focusSummary: focusSummary,
      focusTotal: focusTotal,
      complementSummary: complementSummary,
      strategicAction: strategicAction,
      range: range,
      filterSummary: filterSummary,
      alert: alert,
      selectedAgent: selectedAgent,
      propertyCount: state.filteredProperties.length,
      operationBreakdown: operationBreakdown
    });
    var individualBody = '<h2>Leitura individual</h2><div class="section-box">' + buildAgentPerformanceHtml(agents, selectedAgent) +
      '<p><strong>Recorte aplicado:</strong> ' + escapeHtml(filterSummary) + '. O período analisado vai de ' + reportStrong(formatDateBR(range.start)) + ' até ' + reportStrong(formatDateBR(range.end)) + '.</p></div>' +
      '<h2>Resumo por tipo de trabalho</h2>' +
      '<div class="section-box">' + buildOperationSummaryHtml(operationBreakdown) + '</div>' +
      '<h2>Visitas do recorte</h2>' +
      '<table><thead><tr><th>Data/Hora</th><th>Operação</th><th>Agente</th><th>Endereço</th><th>Situação</th><th>Foco</th><th>Depósitos com foco</th><th>Tubitos/Lab</th><th>Caixa d\'agua</th></tr></thead><tbody>' +
        visits.map(function (visit) {
          return '<tr><td>' + escapeHtml(formatDateBR(visit.data) + ' ' + visit.hora) + '</td><td>' + escapeHtml(operationModeLabel(getVisitOperationMode(visit))) + '</td><td>' + escapeHtml(visit.agente || '-') + '</td><td>' + escapeHtml(visit.logradouro + ', ' + visit.numero + ' • ' + visit.bairro) + '</td><td>' + escapeHtml(visit.situacao) + '</td><td>' + escapeHtml(visit.foco + ' • ' + visit.focusCount) + '</td><td>' + escapeHtml(String(visit.depositFocusCount)) + '</td><td>' + escapeHtml(String(visit.tubitosQty || 0) + (formatLabSummaryForVisit(visit) ? ' / ' + formatLabSummaryForVisit(visit) : '')) + '</td><td>' + escapeHtml(visit.waterAccess || '-') + '</td></tr>';
        }).join('') +
      '</tbody></table>';
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório ACE</title>' + css + '</head><body>' +
      '<div class="report-toolbar"><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div>' +
      '<h1>' + escapeHtml(mode === 'individual' ? 'Relatório individual do recorte' : 'Relatório executivo ACE') + '</h1>' +
      '<div class="note">Período: ' + escapeHtml(formatDateBR(range.start) + ' a ' + formatDateBR(range.end)) + ' • Filtros: ' + escapeHtml(filterSummary) + '</div>' +
      metricGrid +
      (mode === 'individual' ? individualBody : executiveBody) +
      '</body></html>';
  }

  function openReport(mode) {
    var html;
    if (!state.filteredVisits.length) {
      setBanner('Não há dados filtrados para gerar relatório.', 'danger');
      return;
    }
    var win = window.open('', '_blank');
    if (!win) {
      setBanner('Não foi possível abrir a janela de relatório.', 'danger');
      return;
    }
    try {
      html = buildReportHtml(mode);
    } catch (error) {
      win.close();
      setBanner('Não foi possível gerar o relatório: ' + (error && error.message ? error.message : 'erro inesperado'), 'danger');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(function () {
      try { win.focus(); win.print(); } catch (error) {}
    }, 650);
    setBanner('Relatório aberto para impressão.', 'ok');
  }

  function toggleAutoRefresh() {
    var button = document.getElementById('toggleAutoRefreshBtn');
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
      button.textContent = 'Auto';
      setBanner('Autoatualização desligada.', 'warn');
      return;
    }
    state.autoTimer = setInterval(loadDashboard, AUTO_INTERVAL);
    button.textContent = 'Auto ativo';
    setBanner('Autoatualização ligada.', 'ok');
  }

  function updatePanelStickyOffset() {
    var topbar = document.querySelector('.topbar-v3') || document.querySelector('.topbar');
    var offset = topbar ? (topbar.offsetHeight + 12) : 98;
    document.documentElement.style.setProperty('--panel-topbar-offset', offset + 'px');
  }



  function applyMapObjective(objective) {
    var presets = {
      rotina: { polygons: true, visits: true, visitOpen: true, visitClosed: true, visitRecovered: true, agents: true, heat: false, ladderRequests: false, supervision: false, labPositive: true },
      focos: { polygons: true, visits: true, visitOpen: true, visitClosed: false, visitRecovered: false, agents: false, heat: true, ladderRequests: false, supervision: false, labPositive: true },
      'lab-positive': { polygons: true, visits: false, visitOpen: false, visitClosed: false, visitRecovered: false, agents: false, heat: false, ladderRequests: false, supervision: false, labPositive: true },
      escada: { polygons: true, visits: false, visitOpen: false, visitClosed: false, visitRecovered: false, agents: true, heat: false, ladderRequests: true, supervision: false, labPositive: false },
      supervisao: { polygons: true, visits: false, visitOpen: false, visitClosed: false, visitRecovered: false, agents: true, heat: false, ladderRequests: false, supervision: true, labPositive: false },
      liraa: { polygons: true, visits: true, visitOpen: true, visitClosed: true, visitRecovered: true, agents: false, heat: false, ladderRequests: false, supervision: false, labPositive: false }
    };
    var selected = presets[objective] || presets.rotina;
    Object.keys(selected).forEach(function (key) {
      state.mapToggles[key] = selected[key];
    });
    document.querySelectorAll('[data-map-toggle]').forEach(function (button) {
      var toggleKey = button.getAttribute('data-map-toggle');
      button.classList.toggle('is-on', !!state.mapToggles[toggleKey]);
      button.setAttribute('aria-pressed', state.mapToggles[toggleKey] ? 'true' : 'false');
    });
    document.querySelectorAll('[data-map-objective]').forEach(function (button) {
      button.classList.toggle('is-on', button.getAttribute('data-map-objective') === objective);
    });
    updateMapLegendControl();
    state.preserveMapView = true;
    renderHeatMap(state.filteredVisits);
  }

  function setupSidebarUtilityActions() {
    var cadastroBtn = document.getElementById('sidebarCadastroBtn');
    var agentsBtn = document.getElementById('sidebarAgentsBtn');
    var configBtn = document.getElementById('sidebarConfigBtn');
    var supportBtn = document.getElementById('sidebarSupportBtn');
    var supportModal = document.getElementById('supportModal');
    var supportCloseBtn = document.getElementById('supportModalCloseBtn');

    function openSupportModal() {
      if (!supportModal) {
        return;
      }
      supportModal.hidden = false;
      document.body.classList.add('is-support-modal-open');
    }

    function closeSupportModal() {
      if (!supportModal) {
        return;
      }
      supportModal.hidden = true;
      document.body.classList.remove('is-support-modal-open');
    }

    if (agentsBtn) {
      agentsBtn.addEventListener('click', function (event) {
        event.preventDefault();
        openAgentsModal();
      });
    }

    function openCadastrosModalFromPanel(event) {
      if (event) {
        event.preventDefault();
        if (typeof event.stopPropagation === 'function') {
          event.stopPropagation();
        }
      }

      if (root.ACEPanelCadastros && typeof root.ACEPanelCadastros.open === 'function') {
        root.ACEPanelCadastros.open();
        return;
      }

      setBanner('Módulo de cadastros ainda não carregou. Atualize a página e tente novamente.', 'warn');
    }

    if (cadastroBtn) {
      cadastroBtn.addEventListener('click', openCadastrosModalFromPanel);
    }

    if (configBtn) {
      configBtn.addEventListener('click', openCadastrosModalFromPanel);
    }

    if (supportBtn) {
      supportBtn.addEventListener('click', openSupportModal);
    }

    if (supportCloseBtn) {
      supportCloseBtn.addEventListener('click', closeSupportModal);
    }

    if (supportModal) {
      supportModal.addEventListener('click', function (event) {
        if (event.target && event.target.getAttribute('data-support-close') === 'true') {
          closeSupportModal();
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSupportModal();
      }
    });

    document.addEventListener('click', function (event) {
      var attendButton = event.target && event.target.closest ? event.target.closest('[data-ladder-attend]') : null;
      var ladderStatusButton = event.target && event.target.closest ? event.target.closest('[data-ladder-status]') : null;
      var supervisionStatusButton = event.target && event.target.closest ? event.target.closest('[data-supervision-status]') : null;
      var attendAllButton = event.target && event.target.closest ? event.target.closest('[data-ladder-attend-all]') : null;
      if (attendButton) {
        event.preventDefault();
        markPanelLadderAttended(attendButton.getAttribute('data-ladder-attend'));
        openAgentsModal();
        renderDashboard();
        return;
      }
      if (ladderStatusButton) {
        event.preventDefault();
        setPanelLadderStatus(ladderStatusButton.getAttribute('data-ladder-key') || '', ladderStatusButton.getAttribute('data-ladder-status') || 'Aberta');
        openAgentsModal();
        renderDashboard();
        return;
      }
      if (supervisionStatusButton) {
        event.preventDefault();
        setPanelSupervisionStatus(supervisionStatusButton.getAttribute('data-supervision-key') || '', supervisionStatusButton.getAttribute('data-supervision-status') || 'Aberta');
        openAgentsModal();
        renderDashboard();
        return;
      }
      if (attendAllButton) {
        event.preventDefault();
        if (!window.confirm || window.confirm('Marcar todas as solicitações de escada exibidas como atendidas? Elas sairão desta lista neste navegador.')) {
          getOpenPanelLadderRequests(state.filteredVisits && state.filteredVisits.length ? state.filteredVisits : state.allVisits || []).forEach(function (visit) {
            markPanelLadderAttended(getPanelLadderRequestKey(visit));
          });
          openAgentsModal();
          renderDashboard();
        }
      }
    });

  }


  function bindEvents() {
    document.getElementById('loadDashboardBtn').addEventListener('click', loadDashboard);
    if (document.getElementById('toggleAutoRefreshBtn')) {
      document.getElementById('toggleAutoRefreshBtn').addEventListener('click', toggleAutoRefresh);
    }
    document.getElementById('reportExecutiveBtn').addEventListener('click', function () {
      setActiveReportAction('reportExecutiveBtn');
      openReport('executive');
    });
    document.getElementById('reportIndividualBtn').addEventListener('click', function () {
      setActiveReportAction('reportIndividualBtn');
      openReport('individual');
    });
    if (document.getElementById('reportWaterTankBtn')) {
      document.getElementById('reportWaterTankBtn').addEventListener('click', function () {
        setActiveReportAction('reportWaterTankBtn');
        openWaterTankReport();
      });
    }
    if (document.getElementById('reportTubitosBtn')) {
      document.getElementById('reportTubitosBtn').addEventListener('click', function () {
        setActiveReportAction('reportTubitosBtn');
        openTubitosReport();
      });
    }
    if (document.getElementById('reportDailyBtn')) {
      document.getElementById('reportDailyBtn').addEventListener('click', function () {
        setActiveReportAction('reportDailyBtn');
        openDailySummaryReport();
      });
    }
    if (document.getElementById('clearDrilldownBtn')) {
      document.getElementById('clearDrilldownBtn').addEventListener('click', clearDrilldown);
    }
    ['bairroFilter', 'microareaFilter', 'quarteiraoFilter', 'logradouroFilter', 'agentFilter', 'situacaoFilter', 'operationFilter', 'focoFilter', 'gpsFilter', 'dateStart', 'dateEnd'].forEach(function (id) {
      if (document.getElementById(id)) {
        document.getElementById(id).addEventListener('change', applyFilters);
      }
    });
    if (document.getElementById('searchFilter')) {
      document.getElementById('searchFilter').addEventListener('input', applyFilters);
    }
    document.querySelectorAll('[data-panel-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        switchPanelView(button.getAttribute('data-panel-view'));
      });
    });
    document.querySelectorAll('[data-map-toggle]').forEach(function (button) {
      var toggleKey = button.getAttribute('data-map-toggle');
      button.setAttribute('aria-pressed', state.mapToggles[toggleKey] ? 'true' : 'false');
      button.classList.toggle('is-on', !!state.mapToggles[toggleKey]);
    });
    updateMapLegendControl();
    document.addEventListener('click', function (event) {
      var drillCard = event.target.closest('[data-drill-field]');
      var visitRow = event.target.closest('[data-visit-row]');
      var mapToggle = event.target.closest('[data-map-toggle]');
      var mapObjective = event.target.closest('[data-map-objective]');
      var panelAction = event.target.closest('[data-panel-action]');
      var visitPdfButton = event.target.closest('[data-visit-pdf]');
      var territoryPdfButton = event.target.closest('[data-territory-pdf]');
      if (panelAction) {
        var action = panelAction.getAttribute('data-panel-action');
        if (action === 'open-supervision') {
          window.open('super.html', '_blank', 'noopener');
        } else if (action === 'daily-summary') {
          openDailySummaryReport();
        }
        return;
      }
      if (mapObjective) {
        applyMapObjective(mapObjective.getAttribute('data-map-objective') || 'rotina');
        return;
      }
      if (mapToggle) {
        var toggleKey = mapToggle.getAttribute('data-map-toggle');
        state.mapToggles[toggleKey] = !state.mapToggles[toggleKey];
        mapToggle.classList.toggle('is-on', !!state.mapToggles[toggleKey]);
        mapToggle.setAttribute('aria-pressed', state.mapToggles[toggleKey] ? 'true' : 'false');
        updateMapLegendControl();
        state.preserveMapView = true;
        renderHeatMap(state.filteredVisits);
        return;
      }
      if (visitPdfButton) {
        event.preventDefault();
        event.stopPropagation();
        openVisitPdfByUid(visitPdfButton.getAttribute('data-visit-pdf') || '');
        return;
      }
      if (territoryPdfButton) {
        event.preventDefault();
        event.stopPropagation();
        openSelectedTerritoryPdf();
        return;
      }
      if (drillCard) {
        applyDrilldown(drillCard.getAttribute('data-drill-field'), drillCard.getAttribute('data-drill-value'));
      }
      if (visitRow && !event.target.closest('a, button')) {
        state.selectedVisitUid = visitRow.getAttribute('data-visit-row') || '';
        renderDrilldownPanel(computeMetrics(state.filteredVisits));
        renderVisitInspectionPanel();
      }
    });
  }

  function initDates() {
    var today = toLocalIsoDate(new Date());
    document.getElementById('dateStart').value = getDateDaysAgo(29);
    document.getElementById('dateEnd').value = today;
  }

  function syncFilterDrawerMode() {
    var drawer = document.querySelector('.panel-filter-drawer');
    if (!drawer) {
      return;
    }
    if (window.innerWidth > 820) {
      drawer.setAttribute('open', 'open');
      return;
    }
    drawer.removeAttribute('open');
  }

  function init() {
    ensurePanelLayout();
    syncFilterDrawerMode();
    syncPanelViewUI();
    hydrateTerritoryData();
    initDates();
    bindEvents();
    window.addEventListener('resize', syncFilterDrawerMode);
    setChip('panelModeChip', isApiConfigured() ? 'Sincronizado' : 'Modo local', isApiConfigured() ? 'ok' : 'warn');
    setChip('panelStatusChip', 'Aguardando leitura', 'accent');
    updateShellHeaderInfo();
    setupSidebarUtilityActions();
    return loadDashboard();
  }

  window.ACEPanelApp = Object.assign({}, window.ACEPanelApp || {}, {
    reloadDashboard: loadDashboard
  });

  init();
}());
