(function () {
  'use strict';

  var app = window.ACSField = window.ACSField || {};

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

  var CANONICAL_TERRITORY = {
    bairroKey: 'caixa dagua',
    bairroLabel: "Caixa d'Água",
    microareaLabel: "M04 - Caixa d'Água",
    microareaCode: 'M04'
  };

  app.CONFIG = {
    SHEETS_WEBAPP_URL: (window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.API_URL) || '',
    API_TOKEN: (window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.API_TOKEN) || '',
    AUTO_SYNC: true,
    BOOTSTRAP_TIMEOUT_MS: 45000,
    SYNC_TIMEOUT_MS: 45000,
    AUTO_SYNC_COOLDOWN_MS: 5 * 60 * 1000,
    APP_VERSION: 'ACE Campo 20260521-v69-sem-icones - Galaxy Tab A11',
    BAIRROS: BAIRRO_CATALOG.slice(),
    PROPERTY_TYPES: [
      'Residencial', 'Comercial', 'Terreno Baldio', 'Obra/Construção', 'Ponto Estratégico', 'Órgão Público', 'Outro'
    ],
    PROPERTY_COMPLEMENTS: ['Normal', 'Sequência', 'Complemento'],
    LARVICIDAS: ['Nenhum', 'BPI'],
    ADULTICIDAS: ['Nenhum', 'Malathion', 'Deltametrina', 'Ciflutrina'],
    CLOSED_REASONS: [
      'Recusa',
      'Ninguém em casa no momento',
      'Só havia menor em casa',
      'Morador mora em outra cidade',
      'Só está em casa à noite',
      'Só está em casa pela manhã',
      'Só está em casa à tarde',
      'Imóvel abandonado',
      'Imóvel na imobiliária',
      'Só está em casa no fim de semana',
      'Outro'
    ],
    WATER_ACCESS_REASONS: [
      'Sem acesso ao imóvel',
      'Morador não autorizou',
      'Local de difícil acesso',
      'Caixa dentro do forro/teto',
      'Necessita escada',
      'Não existe caixa d\'água no local'
    ],
    LADDER_SUPPORT_NO_REASONS: [
      'Morador pediu retorno em outro dia',
      'Agente vai retornar com escada própria',
      'Equipe sem disponibilidade no momento',
      'Imóvel será reagendado'
    ],
    WATER_TANK_CONDITIONS: [
      'Tampada',
      'Telada',
      'Aberta'
    ],
    QUICK_NOTES: [
      'Sem foco',
      'Morador orientado',
      'Necessita retorno',
      'Imóvel fechado',
      'Retorno realizado',
      'Caixa d\'água sem tampa',
      'Tem cachorro bravo',
      'Quintal com muito mato',
      'Solicitou nova visita pela manhã'
    ],
    AGENT_ROLES: ['ACE', 'Supervisor', 'Coordenador', 'Administrador'],
    ADMIN_ROLES: ['Administrador'],
    WEATHER: {
      city: 'Carmo/RJ',
      latitude: -21.9325,
      longitude: -42.6075,
      timezone: 'America/Sao_Paulo',
      refreshMs: 30 * 60 * 1000
    },
    LOCAL_VISIT_RETENTION_DAYS: 21,
    LOCAL_VISIT_CACHE_LIMIT: 1200,
    LOCAL_LOG_RETENTION: 600,
    LOCATION_TRAIL_INTERVAL_MS: 120000,
    LOCATION_TRAIL_MIN_INTERVAL_MS: 60000,
    LOCATION_TRAIL_MIN_DISTANCE_METERS: 18,
    LOCATION_TRAIL_RETENTION_DAYS: 14,
    LOCATION_TRAIL_CACHE_LIMIT: 2500,
    LOCATION_TRAIL_UNSYNCED_TRACK_LIMIT: 1200
  };

  app.DEPOSITS = {
    A1: 'Caixa d\'água / tambor',
    A2: 'Pneu / entulho',
    B: 'Vaso / garrafa',
    C: 'Piscina / cisterna',
    D1: 'Lixo orgânico',
    D2: 'Obra / construção',
    E: 'Natural / bromélia'
  };
  app.CONFIG.BAIRROS = BAIRRO_CATALOG.slice();

  app.rangeQuarteiroes = function (start, end, extras) {
    var values = [];
    var current;
    for (current = Number(start || 1); current <= Number(end || 0); current += 1) {
      values.push(String(current).padStart(2, '0'));
    }
    return values.concat(extras || []);
  };

  app.CONFIG.MICROAREA_PRESETS = [
    { value: 'M01 - Centro', quarteiroes: app.rangeQuarteiroes(1, 23) },
    { value: 'M02 - Boa Ideia', quarteiroes: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '9/1', '10', '11', '12', '13', '13/1', '14', '15'] },
    { value: 'M03 - Botafogo', quarteiroes: app.rangeQuarteiroes(1, 10) },
    { value: "M04 - Caixa d'Água", quarteiroes: app.rangeQuarteiroes(1, 17) },
    { value: 'M05 - Jardim Centenário', quarteiroes: app.rangeQuarteiroes(1, 19, ['1/1', '6/1', '17/1']) },
    { value: 'M06 - Ulisses Lemgruber', quarteiroes: app.rangeQuarteiroes(1, 12) },
    { value: 'M07 - Progresso', quarteiroes: app.rangeQuarteiroes(1, 12, ['1/1']) },
    { value: 'M08 - Val Paraíso', quarteiroes: app.rangeQuarteiroes(1, 5) },
    { value: 'PVC - Porto Velho do Cunha', quarteiroes: [] },
    { value: 'BSF - Barra de São Francisco', quarteiroes: [] },
    { value: 'CDP - Córrego da Prata', quarteiroes: [] },
    { value: 'IDP - Ilha dos Pombos (Light)', quarteiroes: [] },
    { value: 'INF - Influência', quarteiroes: [] }
  ];

  app.CONFIG.MICROAREAS_WITHOUT_QUARTEIRAO = [
    'PVC - Porto Velho do Cunha',
    'BSF - Barra de São Francisco',
    'CDP - Córrego da Prata',
    'IDP - Ilha dos Pombos',
    'IDP - Ilha dos Pombos (Light)',
    'INF - Influência'
  ];

  app.CONFIG.TERRITORY_LABELS = {
    'Centro': 'M01 - Centro',
    'Boa Ideia': 'M02 - Boa Ideia',
    'Botafogo': 'M03 - Botafogo',
    'Caixa d\'Água': 'M04 - Caixa d\'Água',
    'Jardim Centenário': 'M05 - Jardim Centenário',
    'Ulisses Lemgruber': 'M06 - Ulisses Lemgruber',
    'Progresso': 'M07 - Progresso',
    'Val Paraíso': 'M08 - Val Paraíso',
    'Morro do Estado': 'M06 - Ulisses Lemgruber',
    'Porto Velho do Cunha': 'PVC - Porto Velho do Cunha',
    'Barra de S. Francisco': 'BSF - Barra de São Francisco',
    'Barra de São Francisco': 'BSF - Barra de São Francisco',
    'Córrego da Prata': 'CDP - Córrego da Prata',
    'Ilha dos Pombos': 'IDP - Ilha dos Pombos',
    'Light': 'IDP - Ilha dos Pombos (Light)',
    'Influência': 'INF - Influência'
  };

  app.STORAGE_KEYS = {
    agents: ['dengue_db_agents_v1'],
    session: ['dengue_db_session_v1'],
    properties: ['dengue_db_properties_v1'],
    visits: ['dengue_db_visits_v1'],
    tubitos: ['dengue_db_tubitos_v1'],
    supervisionRequests: ['dengue_db_supervision_requests_v1'],
    locationTrail: ['dengue_db_location_trail_v1'],
    lastArea: ['dengue_db_last_area_v1'],
    logs: ['dengue_db_logs_v1'],
    systemState: ['dengue_db_system_state_v1'],
    dirtyProperties: ['dengue_db_dirty_properties_v2']
  };

  app.state = {
    currentAgent: null,
    selectedScreen: 'visita',
    selectedPropertyId: '',
    editingPropertyId: '',
    editingVisitId: '',
    propertyGpsCaptured: false,
    propertyQuickFilter: 'all',
    syncInFlight: false,
    nextAutoSyncAt: 0,
    closeDayInFlight: false,
    territoryHint: null,
    visit: null,
    weatherLoading: false,
    weatherTimer: null,
    locationTrailActive: false,
    locationTrailTimer: null,
    locationTrailWatchId: null,
    lastBatteryLevel: ''
  };

  app.storageCache = {};
  app.storageReady = false;
  app.storageReadyPromise = Promise.resolve();

  app.cloneStoredValue = function (value) {
    if (value === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  };

  app.daysAgoISO = function (days) {
    var amount = Math.max(0, Number(days || 0));
    var date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - amount);
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  };

  app.getDefaultSystemState = function () {
    return {
      lastSyncAt: '',
      lastSyncError: '',
      lastBackupAt: '',
      lastBootstrapAt: '',
      pendingSync: false,
      pendingReason: '',
      lastDayClosedAt: '',
      lastDayClosedDate: '',
      suppressRemoteVisitsDate: '',
      weatherCache: null,
      lastWeatherError: '',
      gpsPermissionState: '',
      lastKnownGps: null,
      deletedAgentKeys: [],
      deletedAgentRecords: []
    };
  };

  app.getStorageFallback = function (logicalKey) {
    if (logicalKey === 'session' || logicalKey === 'lastArea') {
      return null;
    }
    if (logicalKey === 'systemState') {
      return app.getDefaultSystemState();
    }
    return [];
  };

  app.resolveStorageLogicalKey = function (keys) {
    var list = Array.isArray(keys) ? keys : [keys];
    return Object.keys(app.STORAGE_KEYS).find(function (logicalKey) {
      var candidates = app.STORAGE_KEYS[logicalKey] || [];
      return list.some(function (key) {
        return candidates.indexOf(key) > -1;
      });
    }) || '';
  };

  app.readStorageSnapshot = function (keys, fallback) {
    var logicalKey = app.resolveStorageLogicalKey(keys);
    var list = Array.isArray(keys) ? keys : [keys];
    var index;
    if (logicalKey && Object.prototype.hasOwnProperty.call(app.storageCache, logicalKey)) {
      return app.cloneStoredValue(app.storageCache[logicalKey]);
    }
    for (index = 0; index < list.length; index += 1) {
      try {
        var raw = localStorage.getItem(list[index]);
        if (raw !== null && raw !== undefined && raw !== '') {
          return JSON.parse(raw);
        }
      } catch (error) {}
    }
    return app.cloneStoredValue(fallback);
  };

  app.writeStorageSnapshot = function (keyName, value) {
    var logicalKey = app.STORAGE_KEYS[keyName] ? keyName : app.resolveStorageLogicalKey(keyName);
    var storageKeys = logicalKey ? (app.STORAGE_KEYS[logicalKey] || []) : [];
    var primaryKey = storageKeys[0] || keyName;
    var clonedValue = app.cloneStoredValue(value);
    if (logicalKey) {
      app.storageCache[logicalKey] = clonedValue;
    }

    // Segurança offline: grava uma cópia síncrona no localStorage antes do IndexedDB.
    // Se o agente salvar uma visita e atualizar/fechar o navegador logo depois, a fila
    // continua recuperável mesmo que a transação assíncrona do IndexedDB ainda não tenha concluído.
    try {
      localStorage.setItem(primaryKey, JSON.stringify(clonedValue));
    } catch (localError) {}

    if (window.ACEIndexedStore && typeof window.ACEIndexedStore.put === 'function') {
      window.ACEIndexedStore.put(primaryKey, clonedValue).catch(function () {
        try {
          localStorage.setItem(primaryKey, JSON.stringify(clonedValue));
        } catch (error) {}
      });
    }
  };

  app.initializeLocalPersistence = function () {
    if (app.storageReady) {
      return Promise.resolve(true);
    }
    var definitions = {};
    Object.keys(app.STORAGE_KEYS).forEach(function (logicalKey) {
      definitions[logicalKey] = {
        storageKey: app.STORAGE_KEYS[logicalKey][0],
        legacyKeys: app.STORAGE_KEYS[logicalKey],
        fallback: app.getStorageFallback(logicalKey),
        dropLegacy: false
      };
    });
    if (!window.ACEIndexedStore || typeof window.ACEIndexedStore.hydrate !== 'function') {
      Object.keys(app.STORAGE_KEYS).forEach(function (logicalKey) {
        app.storageCache[logicalKey] = app.cloneStoredValue(app.readStorageSnapshot(app.STORAGE_KEYS[logicalKey], app.getStorageFallback(logicalKey)));
      });
      app.storageCache.visits = app.pruneLocalVisitCache(app.storageCache.visits || []);
      app.storageCache.logs = (app.storageCache.logs || []).map(app.normalizeLogEntry).filter(Boolean);
      app.storageCache.locationTrail = (app.storageCache.locationTrail || []).map(app.normalizeLocationTrailPoint).filter(Boolean);
      app.storageCache.dirtyProperties = Array.from(new Set((app.storageCache.dirtyProperties || []).map(function (item) {
        return String(item || '').trim();
      }).filter(Boolean)));
      app.writeStorageSnapshot('visits', app.storageCache.visits);
      app.writeStorageSnapshot('logs', app.storageCache.logs);
      app.writeStorageSnapshot('locationTrail', app.storageCache.locationTrail);
      app.writeStorageSnapshot('dirtyProperties', app.storageCache.dirtyProperties);
      app.storageReady = true;
      return Promise.resolve(false);
    }
    app.storageReadyPromise = window.ACEIndexedStore.hydrate(definitions).then(function (cache) {
      Object.keys(app.STORAGE_KEYS).forEach(function (logicalKey) {
        app.storageCache[logicalKey] = app.cloneStoredValue(
          cache && Object.prototype.hasOwnProperty.call(cache, logicalKey)
            ? cache[logicalKey]
            : app.getStorageFallback(logicalKey)
        );
      });
      app.storageCache.systemState = Object.assign(app.getDefaultSystemState(), app.storageCache.systemState || {});
      if (!Array.isArray(app.storageCache.logs)) {
        app.storageCache.logs = [];
      }
      if (!Array.isArray(app.storageCache.locationTrail)) {
        app.storageCache.locationTrail = [];
      }
      app.storageCache.locationTrail = app.storageCache.locationTrail.map(app.normalizeLocationTrailPoint).filter(Boolean);
      if (!Array.isArray(app.storageCache.dirtyProperties)) {
        app.storageCache.dirtyProperties = [];
      }
      app.storageCache.visits = app.pruneLocalVisitCache(app.storageCache.visits || []);
      app.storageCache.logs = (app.storageCache.logs || []).map(app.normalizeLogEntry).filter(Boolean);
      app.storageCache.locationTrail = (app.storageCache.locationTrail || []).map(app.normalizeLocationTrailPoint).filter(Boolean);
      app.storageCache.dirtyProperties = Array.from(new Set(app.storageCache.dirtyProperties.map(function (item) {
        return String(item || '').trim();
      }).filter(Boolean)));
      app.writeStorageSnapshot('visits', app.storageCache.visits);
      app.writeStorageSnapshot('logs', app.storageCache.logs);
      app.writeStorageSnapshot('locationTrail', app.storageCache.locationTrail);
      app.writeStorageSnapshot('dirtyProperties', app.storageCache.dirtyProperties);
      app.storageReady = true;
      return true;
    }).catch(function () {
      Object.keys(app.STORAGE_KEYS).forEach(function (logicalKey) {
        app.storageCache[logicalKey] = app.cloneStoredValue(app.readStorageSnapshot(app.STORAGE_KEYS[logicalKey], app.getStorageFallback(logicalKey)));
      });
      app.storageCache.visits = app.pruneLocalVisitCache(app.storageCache.visits || []);
      app.storageCache.logs = (app.storageCache.logs || []).map(app.normalizeLogEntry).filter(Boolean);
      app.storageCache.locationTrail = (app.storageCache.locationTrail || []).map(app.normalizeLocationTrailPoint).filter(Boolean);
      app.storageCache.dirtyProperties = Array.from(new Set((app.storageCache.dirtyProperties || []).map(function (item) {
        return String(item || '').trim();
      }).filter(Boolean)));
      app.writeStorageSnapshot('visits', app.storageCache.visits);
      app.writeStorageSnapshot('logs', app.storageCache.logs);
      app.writeStorageSnapshot('locationTrail', app.storageCache.locationTrail);
      app.writeStorageSnapshot('dirtyProperties', app.storageCache.dirtyProperties);
      app.storageReady = true;
      return false;
    });
    return app.storageReadyPromise;
  };

  app.emptyDepositMap = function () {
    var map = {};
    Object.keys(app.DEPOSITS).forEach(function (code) {
      map[code] = 0;
    });
    return map;
  };

  app.todayISO = function () {
    var now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  };

  app.nowHHMM = function () {
    var now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  };

  app.normalizeAreaCode = function (value) {
    var text = app.cleanUiText(value)
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*/g, '/');
    var compact = text.replace(/\s+/g, '');
    var slashMatch = compact.match(/^(\d{1,2})\/(\d{1,2})$/);

    if (!text) {
      return '';
    }
    if (slashMatch) {
      return String(Number(slashMatch[1])) + '/' + String(Number(slashMatch[2]));
    }
    return text
      .replace(/^q\s*[-.]?\s*/i, 'Q ')
      .replace(/^q(?=\d)/i, 'Q ')
      .replace(/^0+(\d{1,2})$/,'$1')
      .replace(/^Q\s*0+(\d{1,2})$/i, 'Q $1');
  };

  app.getTerritoryLabel = function (value) {
    var label = app.cleanUiText(value).trim();
    return app.CONFIG.TERRITORY_LABELS[label] || label;
  };

  app.isMicroareaWithoutQuarteirao = function (value) {
    var microarea = app.normalizeAreaCode(value || '');
    return (app.CONFIG.MICROAREAS_WITHOUT_QUARTEIRAO || []).some(function (item) {
      return app.normalizeAreaCode(item) === microarea;
    });
  };

  app.compareAreaCode = function (a, b) {
    return app.normalizeAreaCode(a).localeCompare(app.normalizeAreaCode(b), 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    });
  };

  app.createEmptyVisit = function () {
    return {
      data: app.todayISO(),
      hora: '',
      microarea: '',
      quarteirao: '',
      situacao: '',
      closedReason: '',
      depositFound: '',
      focusFound: '',
      focusQty: 0,
      waterAccess: '',
      waterAccessReason: '',
      ladderSupportRequested: '',
      ladderSupportNoReason: '',
      waterTankCondition: '',
      waterTreatment: '',
      attendedBy: '',
      tubitosQty: 0,
      tubitosDeposit: '',
      tubitosByDeposit: app.emptyDepositMap(),
      operationMode: 'VD',
      peTipoLocal: '',
      peNomeLocal: '',
      peObservacao: '',
      liraaCiclo: '',
      liraaPlanoId: '',
      liraaQuarteiraoSorteado: '',
      liraaUnitKey: '',
      liraaColeta: '',
      larvicida: 'Nenhum',
      larvicidaQty: 0,
      adulticida: 'Nenhum',
      adulticidaQty: 0,
      obs: '',
      gps: null,
      gpsTerritory: '',
      gpsQuarteirao: '',
      focusGpsCaptured: false,
      focusGpsCapturedAt: '',
      routeUrl: '',
      qualityFlags: [],
      depositCounts: app.emptyDepositMap(),
      depositFocusCounts: app.emptyDepositMap(),
      depositTreatmentCounts: app.emptyDepositMap()
    };
  };

  app.state.visit = app.createEmptyVisit();

  app.cleanUiText = function (value) {
    var text = String(value == null ? '' : value);
    var previous = null;
    var attempts = 0;

    function decodeLatinMojibake(input) {
      try {
        return decodeURIComponent(escape(input));
      } catch (error) {
        return input;
      }
    }

    text = text.replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });

    while (text !== previous && attempts < 3) {
      previous = text;
      if (/[ÃƒÂâï]/.test(text)) {
        text = decodeLatinMojibake(text);
      }
      attempts += 1;
    }

    return text
      .replace(/\s*(?:ï¿½\?ï¿½|ï¿½\?ï¿½|ï¿½\?ï¿½|ï¿½?ï¿½)\s*/g, ' • ')
      .replace(/PEND(?:ï¿½|ï¿½)SNCIA/g, 'PENDÊNCIA')
      .replace(/(?:ï¿½|ï¿½)sltima/g, 'Última')
      .replace(/(?:ï¿½|ï¿½)sltimo/g, 'Último')
      .replace(/(?:ï¿½|ï¿½)ndice/g, 'Índice');
  };

  app.escapeHtml = function (value) {
    return app.cleanUiText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  app.normalizeChoice = function (value) {
    if (value === true) {
      return 'Sim';
    }
    if (value === false) {
      return 'Não';
    }
    var label = app.cleanUiText(value).trim().toLowerCase();
    if (!label) {
      return '';
    }
    return (label === 'sim' || label === 's' || label === 'true' || label === 'yes') ? 'Sim' : 'Não';
  };

  app.normalizeStatus = function (value) {
    var label = app.cleanUiText(value).trim().toLowerCase();
    if (label.indexOf('aberto') > -1 || label.indexOf('visitado') > -1) {
      return 'Visitado';
    }
    if (label.indexOf('fechado') > -1) {
      return 'Fechado';
    }
    if (label.indexOf('recuado') > -1 || label.indexOf('recuperado') > -1) {
      return 'Recuperado';
    }
    if (label.indexOf('recusa') > -1) {
      return 'Fechado';
    }
    if (label.indexOf('pend') > -1) {
      return 'Fechado';
    }
    return 'Visitado';
  };

  app.normalizeClosedReason = function (value) {
    return app.cleanUiText(value).trim().replace(/\s+/g, ' ');
  };

  app.normalizeWaterAccessReason = function (value) {
    var label = app.cleanUiText(value).trim().replace(/\s+/g, ' ');
    var normalized = app.normalizeComparable(label);
    if (!label || normalized === 'outro') {
      return '';
    }
    if (normalized === 'sem acesso') {
      return 'Sem acesso ao imóvel';
    }
    if (normalized.indexOf('forro') > -1 || normalized.indexOf('teto') > -1) {
      return 'Caixa dentro do forro/teto';
    }
    if (normalized.indexOf('escada') > -1) {
      return 'Necessita escada';
    }
    if (normalized.indexOf('morador') > -1 && normalized.indexOf('autoriz') > -1) {
      return 'Morador não autorizou';
    }
    if (normalized.indexOf('dificil') > -1 || normalized.indexOf('difícil') > -1) {
      return 'Local de difícil acesso';
    }
    if (normalized.indexOf('nao existe') > -1 || normalized.indexOf('não existe') > -1 || normalized.indexOf('sem caixa') > -1) {
      return 'Não existe caixa d\'água no local';
    }
    return app.CONFIG.WATER_ACCESS_REASONS.indexOf(label) > -1 ? label : '';
  };

  app.normalizeLadderSupportRequested = function (value) {
    var normalized = app.normalizeChoice(value || '');
    return normalized === 'Sim' || normalized === 'Não' ? normalized : '';
  };

  app.normalizeLadderSupportNoReason = function (value) {
    var label = app.cleanUiText(value).trim().replace(/\s+/g, ' ');
    return app.CONFIG.LADDER_SUPPORT_NO_REASONS.indexOf(label) > -1 ? label : '';
  };

  app.shouldAskLadderSupport = function (visit) {
    return !!(visit && visit.waterAccess === 'Não' && visit.waterAccessReason === 'Necessita escada');
  };

  app.getLadderSupportStatus = function (visit) {
    if (!app.shouldAskLadderSupport(visit)) {
      return '';
    }
    return visit.ladderSupportRequested === 'Sim' ? 'Solicitada' : (visit.ladderSupportRequested === 'Não' ? 'Não solicitada' : 'Pendente');
  };

  app.normalizeWaterTankCondition = function (value) {
    var label = app.cleanUiText(value).trim().replace(/\s+/g, ' ');
    var normalized = app.normalizeComparable(label);
    if (!label) {
      return '';
    }
    if (normalized === 'tampada' || normalized === 'vedada') {
      return 'Tampada';
    }
    if (normalized === 'telada' || normalized === 'com tela' || normalized === 'tela') {
      return 'Telada';
    }
    if (
      normalized === 'aberta' ||
      normalized.indexOf('aberta') > -1 ||
      normalized.indexOf('vulneravel') > -1 ||
      normalized.indexOf('agua de chuva') > -1 ||
      normalized === 'vazia'
    ) {
      return 'Aberta';
    }
    return '';
  };

  app.buildWaterAccessText = function (visit) {
    var currentVisit = visit || {};
    var text = currentVisit.waterAccess || '-';
    if (currentVisit.waterAccess === 'Não' && currentVisit.waterAccessReason) {
      text += ' • ' + currentVisit.waterAccessReason;
      if (currentVisit.waterAccessReason === 'Necessita escada' && currentVisit.ladderSupportRequested) {
        text += ' • escada: ' + (currentVisit.ladderSupportRequested === 'Sim' ? 'solicitada' : 'não solicitada');
      }
    } else if (currentVisit.waterAccess === 'Sim' && currentVisit.waterTankCondition) {
      text += ' • ' + currentVisit.waterTankCondition;
    }
    if (currentVisit.waterAccess === 'Sim' && currentVisit.waterTreatment) {
      text += ' • tratamento: ' + currentVisit.waterTreatment;
    }
    return text;
  };

  app.shouldShowWaterResidentAlert = function (visit) {
    var currentVisit = visit || {};
    return currentVisit.waterAccess === 'Sim' && (
      currentVisit.waterTreatment === 'Sim' ||
      currentVisit.waterTankCondition === 'Aberta'
    );
  };

  app.getWaterResidentAlertText = function () {
    return 'Oriente o morador a manter a caixa d\'água sempre tampada e vedada. O Código de Posturas do Município de Carmo proíbe manter água estagnada em áreas descobertas e prevê penalidades municipais. A Funasa/MS também orienta que o reservatório domiciliar seja devidamente tampado.';
  };

  app.getVisitStatusLabel = function (value) {
    var status = app.normalizeStatus(value || 'Visitado');
    if (status === 'Visitado') {
      return 'Aberto';
    }
    if (status === 'Recuperado') {
      return 'Recuperado';
    }
    return 'Fechado';
  };

  app.normalizeCoord = function (value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    var num = Number(String(value).replace(',', '.'));
    return isFinite(num) ? num : null;
  };

  app.normalizeGps = function (gps, lat, lng, acc) {
    var gpsLat = gps && gps.lat != null ? app.normalizeCoord(gps.lat) : app.normalizeCoord(lat);
    var gpsLng = gps && gps.lng != null ? app.normalizeCoord(gps.lng) : app.normalizeCoord(lng);
    if (!app.isValidLatLng(gpsLat, gpsLng)) {
      return null;
    }
    return {
      lat: gpsLat,
      lng: gpsLng,
      accuracy: Math.max(0, Number((gps && gps.accuracy) || acc || 0))
    };
  };

  app.isValidLatLng = function (lat, lng) {
    return lat !== null && lng !== null &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0);
  };

  app.normalizeVisitGps = function (visit) {
    var gps = visit && visit.gps ? visit.gps : null;
    var directGps = app.normalizeGps(gps, visit && visit.gps_lat, visit && visit.gps_lng, visit && visit.gps_acc);
    var shiftedGps;
    if (directGps) {
      return directGps;
    }
    shiftedGps = app.normalizeGps(null, visit && visit.gps_acc, visit && visit.gps_territory, 0);
    if (shiftedGps && typeof app.resolveTerritoryByGps === 'function' && !app.resolveTerritoryByGps(shiftedGps)) {
      return null;
    }
    return shiftedGps;
  };

  app.normalizeExternalUrl = function (value) {
    var raw = String(value || '').trim();
    if (!raw) {
      return '';
    }
    return /^https?:\/\//i.test(raw) ? raw : '';
  };

  app.totalFromMap = function (map) {
    return Object.keys(map || {}).reduce(function (sum, key) {
      return sum + Math.max(0, Number(map[key] || 0));
    }, 0);
  };

  app.compactMap = function (map) {
    return Object.keys(map || {})
      .filter(function (code) { return Number(map[code] || 0) > 0; })
      .map(function (code) { return code + '(' + Number(map[code] || 0) + ')'; });
  };

  app.getVisitBpiGrams = function (visit) {
    var currentVisit = visit || {};
    var treatmentTotal = Number(currentVisit.depositTreatmentTotal || currentVisit.deposit_treatment_count || 0) || 0;
    if (treatmentTotal > 0) {
      return treatmentTotal;
    }
    treatmentTotal = app.totalFromMap(currentVisit.depositTreatmentCounts || currentVisit.deposit_treatment_counts || app.emptyDepositMap());
    if (treatmentTotal > 0) {
      return treatmentTotal;
    }
    return Number(currentVisit.larvicidaQty || currentVisit.larvicida_qtd || 0) || 0;
  };

  app.getVisitTreatedDepositCount = function (visit) {
    var currentVisit = visit || {};
    var treatmentMap = app.normalizeDepositMap(
      currentVisit.depositTreatmentCounts || currentVisit.deposit_treatment_counts,
      currentVisit.depositTreatmentBreakdown || currentVisit.deposit_treatment_breakdown
    );
    var depositMap = app.normalizeDepositMap(currentVisit.depositCounts, currentVisit.deposits);
    var focusMap = app.normalizeDepositMap(
      currentVisit.depositFocusCounts || currentVisit.deposit_focus_counts,
      currentVisit.depositFocusBreakdown || currentVisit.deposit_focus_breakdown
    );
    var treated = 0;

    Object.keys(app.DEPOSITS).forEach(function (code) {
      if (Number(treatmentMap[code] || 0) > 0) {
        treated += Math.max(1, Number(depositMap[code] || 0), Number(focusMap[code] || 0));
      }
    });

    if (treated > 0) {
      return treated;
    }

    if (app.getVisitBpiGrams(currentVisit) > 0) {
      return app.totalFromMap(focusMap) || app.totalFromMap(depositMap) || 1;
    }

    return 0;
  };

  app.normalizeDepositCode = function (value) {
    var code = String(value || '').trim().toUpperCase();
    var firstToken = code.split(/[\s-]+/)[0];
    if (Object.prototype.hasOwnProperty.call(app.DEPOSITS, code)) {
      return code;
    }
    return Object.prototype.hasOwnProperty.call(app.DEPOSITS, firstToken) ? firstToken : '';
  };

  app.firstPositiveDepositCode = function (map) {
    var codes = Object.keys(app.DEPOSITS);
    var index;
    for (index = 0; index < codes.length; index += 1) {
      if (Number((map || {})[codes[index]] || 0) > 0) {
        return codes[index];
      }
    }
    return '';
  };

  app.getTubitoDepositCode = function (visit) {
    var currentVisit = visit || {};
    return app.normalizeDepositCode(
      currentVisit.tubitosDeposit ||
      currentVisit.tubitos_deposito ||
      currentVisit.tubito_deposito ||
      currentVisit.tubitosDepositCode ||
      ''
    ) || app.firstPositiveDepositCode(currentVisit.depositFocusCounts);
  };

  app.getTubitoDepositText = function (visit) {
    var code = app.getTubitoDepositCode(visit);
    return code ? (code + ' - ' + app.DEPOSITS[code]) : '';
  };


  app.totalTubitosByDeposit = function (map) {
    return Object.keys(app.DEPOSITS).reduce(function (sum, code) {
      return sum + Math.max(0, Number((map || {})[code] || 0));
    }, 0);
  };

  app.firstTubitoDepositCode = function (map) {
    var codes = Object.keys(app.DEPOSITS);
    var index;
    for (index = 0; index < codes.length; index += 1) {
      if (Math.max(0, Number((map || {})[codes[index]] || 0)) > 0) {
        return codes[index];
      }
    }
    return '';
  };

  app.normalizeTubitosByDeposit = function (value, fallbackDeposit, fallbackQty) {
    var result = app.emptyDepositMap();
    var parsedAny = false;
    var rawFallbackQty = Math.max(0, Number(fallbackQty || 0));
    var parseToken = function (token) {
      var text = String(token || '').trim().toUpperCase();
      var match;
      var code;
      var qty;
      if (!text) { return; }
      match = text.match(/^(A1|A2|D1|D2|B|C|E)\b/);
      if (!match) { return; }
      code = app.normalizeDepositCode(match[1]);
      var qtyMatch = text.match(/(?:[:=xX]\s*|\s+)(\d+)\s*$/);
      qty = Math.max(0, Number(qtyMatch && qtyMatch[1] || 0));
      if (code) {
        result[code] += qty || 0;
        parsedAny = true;
      }
    };

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.keys(value).forEach(function (key) {
        var code = app.normalizeDepositCode(key);
        var qty = Math.max(0, Number(value[key] || 0));
        if (code && qty > 0) {
          result[code] += qty;
          parsedAny = true;
        }
      });
    } else if (Array.isArray(value)) {
      value.forEach(function (item) {
        if (item && typeof item === 'object') {
          var code = app.normalizeDepositCode(item.depositoCodigo || item.deposito_codigo || item.code || item.codigo || '');
          var qty = Math.max(0, Number(item.quantidade || item.qty || item.total || 0));
          if (code && qty > 0) {
            result[code] += qty;
            parsedAny = true;
          }
        } else {
          parseToken(item);
        }
      });
    } else if (String(value || '').trim()) {
      String(value || '').split(/[|;,]+/).forEach(parseToken);
    }

    if (!app.totalTubitosByDeposit(result) && rawFallbackQty > 0) {
      var fallbackCode = app.normalizeDepositCode(fallbackDeposit || '') || '';
      if (fallbackCode) {
        result[fallbackCode] = rawFallbackQty;
      }
    }

    return result;
  };

  app.tubitosByDepositFromRows = function (rows) {
    var result = app.emptyDepositMap();
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      var code = app.normalizeDepositCode(row && (row.depositoCodigo || row.deposito_codigo) || '');
      if (code) {
        result[code] += 1;
      }
    });
    return result;
  };

  app.getTubitosByDeposit = function (visit) {
    var row = visit || {};
    var fallbackCode = app.getTubitoDepositCode(row);
    var fallbackQty = Math.max(0, Number(row.tubitosQty || row.tubitos_qtd || 0));
    return app.normalizeTubitosByDeposit(
      row.tubitosByDeposit || row.tubitos_by_deposito || row.tubitosDepositos || row.tubitos_depositos || '',
      fallbackCode,
      fallbackQty
    );
  };

  app.getTubitoDepositQty = function (visit, code) {
    var normalized = app.normalizeDepositCode(code || '');
    return normalized ? Math.max(0, Number(app.getTubitosByDeposit(visit)[normalized] || 0)) : 0;
  };

  app.formatTubitoDepositSummary = function (visit) {
    var map = app.getTubitosByDeposit(visit);
    return Object.keys(app.DEPOSITS).filter(function (code) {
      return Math.max(0, Number(map[code] || 0)) > 0;
    }).map(function (code) {
      return code + ' - ' + app.DEPOSITS[code] + ': ' + Math.max(0, Number(map[code] || 0));
    }).join('; ');
  };

  app.normalizeDepositMap = function (map, compact) {
    var result = app.emptyDepositMap();
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      Object.keys(app.DEPOSITS).forEach(function (code) {
        result[code] = Math.max(0, Number(map[code] || 0));
      });
    }
    if (compact) {
      String(compact)
        .split('|')
        .map(function (part) { return part.trim(); })
        .filter(Boolean)
        .forEach(function (part) {
          var match = part.match(/^([A-Z0-9]+)\((\d+)\)$/i);
          if (!match) {
            return;
          }
          var code = String(match[1] || '').toUpperCase();
          if (Object.prototype.hasOwnProperty.call(result, code)) {
            result[code] = Math.max(result[code], Number(match[2] || 0));
          }
        });
    }
    return result;
  };

  app.createId = function (prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefix + '-' + window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
  };

  app.formatDateBR = function (value) {
    if (!value) {
      return '-';
    }
    var parts = String(value).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  };

  app.formatTimeHM = function (value) {
    if (!value) {
      return '--:--';
    }
    var text = String(value).trim();
    var match = text.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return match[1] + ':' + match[2];
    }
    match = text.match(/(\d{2}):(\d{2})/);
    if (match) {
      return match[1] + ':' + match[2];
    }
    return text;
  };

  app.addressKey = function (row) {
    return [
      String(row.bairro || '').trim().toLowerCase(),
      String(row.logradouro || '').trim().toLowerCase(),
      String(row.numero || '').trim().toLowerCase()
    ].join('|');
  };

  app.sanitizeHour = function (value) {
    var text = String(value || '').trim();
    if (!text) {
      return app.nowHHMM();
    }
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
    return text.length >= 5 ? text.slice(0, 5) : text;
  };

  app.normalizeDateOnly = function (value) {
    if (!value) {
      return app.todayISO();
    }
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return value.getFullYear() + '-' +
        String(value.getMonth() + 1).padStart(2, '0') + '-' +
        String(value.getDate()).padStart(2, '0');
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
  };

  app.calcDistanceMeters = function (lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some(function (item) { return item === null || item === undefined || item === ''; })) {
      return null;
    }
    var pLat1 = Number(lat1);
    var pLng1 = Number(lng1);
    var pLat2 = Number(lat2);
    var pLng2 = Number(lng2);
    if (![pLat1, pLng1, pLat2, pLng2].every(isFinite)) {
      return null;
    }
    var toRad = function (value) { return value * Math.PI / 180; };
    var earth = 6371000;
    var dLat = toRad(pLat2 - pLat1);
    var dLng = toRad(pLng2 - pLng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(pLat1)) * Math.cos(toRad(pLat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  app.formatDistance = function (value) {
    if (value === null || value === undefined) {
      return 'sem GPS';
    }
    return value < 1000 ? value + ' m' : (value / 1000).toFixed(1).replace('.', ',') + ' km';
  };

  app.compareVisitDesc = function (a, b) {
    return (String(b.data || '') + ' ' + String(b.hora || '')).localeCompare(String(a.data || '') + ' ' + String(a.hora || ''));
  };

  app.aggregateByField = function (rows, field, predicate) {
    var map = {};
    rows.forEach(function (row) {
      if (predicate && !predicate(row)) {
        return;
      }
      var key = String(row[field] || '').trim();
      if (!key) {
        return;
      }
      map[key] = (map[key] || 0) + 1;
    });
    return Object.keys(map).map(function (key) {
      return { name: key, total: map[key] };
    }).sort(function (a, b) {
      return b.total - a.total || a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
    });
  };

  app.hashText = function (text) {
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

    function sha256Fallback(input) {
      var hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
      ];
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

        for (j = 0; j < 16; j += 1) {
          schedule[j] = words[i + j] | 0;
        }
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

          h = g;
          g = f;
          f = e;
          e = (d + t1) | 0;
          d = c;
          c = b;
          b = a;
          a = (t1 + t2) | 0;
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

      return hash.map(function (item) {
        return (item >>> 0).toString(16).padStart(8, '0');
      }).join('');
    }

    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) {
      return Promise.resolve(sha256Fallback(value));
    }
    return window.crypto.subtle.digest('SHA-256', new window.TextEncoder().encode(value))
      .then(function (digest) {
        return Array.from(new Uint8Array(digest)).map(function (item) {
          return item.toString(16).padStart(2, '0');
        }).join('');
      });
  };

  app.normalizeTitleText = function (value) {
    return app.cleanUiText(value)
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(function (part) {
        if (!part) {
          return '';
        }
        if (/^(da|de|do|das|dos|e)$/i.test(part)) {
          return part.toLowerCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  };

  app.normalizeFreeText = function (value) {
    return app.cleanUiText(value).trim().replace(/\s+/g, ' ');
  };

  app.normalizeOperationMode = function (value) {
    var mode = app.normalizeFreeText(value || '').toUpperCase();
    if (mode === 'PE' || mode === 'P.E.' || mode === 'PONTO_ESTRATEGICO' || mode === 'PONTO ESTRATEGICO') {
      return 'PE';
    }
    if (mode === 'LIRAA' || mode === 'LIRA') {
      return 'LIRAA';
    }
    return 'VD';
  };

  app.getOperationModeLabel = function (value) {
    var mode = app.normalizeOperationMode(value);
    if (mode === 'PE') {
      return 'P.E.';
    }
    if (mode === 'LIRAA') {
      return 'LIRAa';
    }
    return 'VD';
  };

  app.getOperationContextLabel = function (record) {
    var item = record || {};
    var mode = app.normalizeOperationMode(item.operationMode || item.operation_mode || item.origem_visita || item.origemVisita || 'VD');
    var parts = [app.getOperationModeLabel(mode)];

    if (mode === 'PE') {
      if (item.peTipoLocal || item.pe_tipo_local) {
        parts.push(app.normalizeFreeText(item.peTipoLocal || item.pe_tipo_local));
      }
      if (item.peNomeLocal || item.pe_nome_local) {
        parts.push(app.normalizeFreeText(item.peNomeLocal || item.pe_nome_local));
      }
    }

    if (mode === 'LIRAA') {
      if (item.liraaCiclo || item.liraa_ciclo) {
        parts.push('Ciclo ' + app.normalizeFreeText(item.liraaCiclo || item.liraa_ciclo));
      }
      if (item.liraaQuarteiraoSorteado || item.liraa_quarteirao_sorteado) {
        parts.push('Q ' + app.normalizeFreeText(item.liraaQuarteiraoSorteado || item.liraa_quarteirao_sorteado));
      }
    }

    return parts.filter(Boolean).join(' - ');
  };

  app.normalizeLabel = function (value) {
    return app.cleanUiText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[’´`']/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  app.normalizeComparable = function (value) {
    return app.normalizeLabel(value);
  };

  app.normalizeTerritoryKey = function (value) {
    var key = app.normalizeLabel(String(value || '').replace(/^[A-Z0-9]{1,8}\s*-\s*/i, ''));
    if (key === 'caixa d agua') {
      return CANONICAL_TERRITORY.bairroKey;
    }
    return key;
  };

  app.normalizeBairro = function (value) {
    var raw = app.cleanUiText(value).trim();
    var directKey = app.normalizeTerritoryKey(raw);
    if (directKey === CANONICAL_TERRITORY.bairroKey) {
      return CANONICAL_TERRITORY.bairroLabel;
    }
    return BAIRRO_ALIASES[directKey] || app.normalizeTitleText(raw);
  };

  app.normalizeMicroareaLabel = function (value, bairro) {
    var raw = app.cleanUiText(value).trim();
    var microareaKey = app.normalizeTerritoryKey(raw);

    if (
      /^M04\b/i.test(raw) ||
      microareaKey === CANONICAL_TERRITORY.bairroKey
    ) {
      return CANONICAL_TERRITORY.microareaLabel;
    }

    // Bairro e microárea são campos administrativos independentes.
    // Não inferir microárea a partir do bairro, pois um bairro pode ter mais de uma microárea
    // e uma microárea pode alcançar imóveis de mais de um bairro.
    return app.normalizeAreaCode(raw);
  };

  app.normalizeQuarteiraoKey = function (value) {
    var normalized = app.normalizeAreaCode(value || '');
    return app.normalizeLabel(String(normalized || '').replace(/^q\s*/i, '').replace(/^0+(\d{1,2})$/, '$1'));
  };

  app.normalizeRoleSlug = function (role) {
    var normalized = String(role || '').trim();
    normalized = normalized.normalize ? normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : normalized;
    normalized = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (normalized === 'admin' || normalized === 'administrador' || normalized === 'administracao') { return 'administrador'; }
    if (normalized === 'super' || normalized === 'supervisor' || normalized === 'supervisao' || normalized === 'supervisores') { return 'supervisor'; }
    if (normalized === 'coord' || normalized === 'coordenador' || normalized === 'coordenacao') { return 'coordenador'; }
    if (normalized === 'ace' || normalized === 'agente' || normalized === 'agente_de_campo') { return 'ace'; }
    return normalized;
  };

  app.isManagerRole = function (role) {
    return app.CONFIG.ADMIN_ROLES.indexOf(String(role || '').trim()) > -1 || app.normalizeRoleSlug(role) === 'administrador';
  };

  app.isFieldAllowedRole = function (role) {
    var slug = app.normalizeRoleSlug(role);
    return slug === 'ace' || slug === 'administrador';
  };

  app.getFieldAccessDeniedMessage = function () {
    return 'Este perfil não tem permissão para usar o aplicativo de campo.';
  };

  app.normalizeLogEntry = function (entry) {
    if (!entry) {
      return null;
    }
    return {
      uid: String(entry.uid || app.createId('LOG')).trim(),
      scope: String(entry.scope || entry.tipo || '').trim(),
      action: String(entry.action || entry.acao || '').trim(),
      actor_name: app.normalizeTitleText(entry.actor_name || entry.actorName || ''),
      actor_matricula: app.normalizeFreeText(entry.actor_matricula || entry.actorMatricula || ''),
      target_uid: String(entry.target_uid || entry.targetUid || entry.ref_uid || '').trim(),
      details: String(entry.details || entry.descricao || '').trim(),
      createdAt: String(entry.createdAt || entry.timestamp || new Date().toISOString()).trim(),
      synced: entry.synced === true
    };
  };

  app.readLogs = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.logs, []);
    return Array.isArray(rows) ? rows.map(app.normalizeLogEntry).filter(Boolean) : [];
  };

  app.saveLogs = function (rows) {
    var normalized = Array.isArray(rows) ? rows.map(app.normalizeLogEntry).filter(Boolean) : [];
    normalized.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    var unsynced = normalized.filter(function (row) { return row.synced !== true; });
    var synced = normalized.filter(function (row) { return row.synced === true; });
    app.savePrimary('logs', unsynced.concat(synced).slice(0, Number(app.CONFIG.LOCAL_LOG_RETENTION || 600)));
  };

  app.getUnsyncedLogs = function () {
    return app.readLogs().filter(function (row) {
      return row.synced !== true;
    });
  };

  app.markLogsSynced = function (uids) {
    var lookup = {};
    var logIds = Array.isArray(uids) ? uids : Object.keys(uids || {});
    logIds.forEach(function (uid) {
      var value = String(uid || '').trim();
      if (value) {
        lookup[value] = true;
      }
    });
    if (!Object.keys(lookup).length) {
      return;
    }
    app.saveLogs(app.readLogs().map(function (row) {
      if (row.uid && lookup[row.uid]) {
        row.synced = true;
      }
      return row;
    }));
  };

  app.readDirtyPropertyIds = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.dirtyProperties, []);
    return Array.isArray(rows)
      ? rows.map(function (item) { return String(item || '').trim(); }).filter(Boolean)
      : [];
  };

  app.saveDirtyPropertyIds = function (rows) {
    var clean = Array.isArray(rows)
      ? rows.map(function (item) { return String(item || '').trim(); }).filter(Boolean)
      : [];
    app.savePrimary('dirtyProperties', Array.from(new Set(clean)));
  };

  app.markPropertyDirty = function (propertyIds) {
    var next = app.readDirtyPropertyIds();
    var incoming = Array.isArray(propertyIds) ? propertyIds : [propertyIds];
    incoming.forEach(function (propertyId) {
      var value = String(propertyId || '').trim();
      if (value && next.indexOf(value) === -1) {
        next.push(value);
      }
    });
    app.saveDirtyPropertyIds(next);
  };

  app.clearDirtyPropertyIds = function (propertyIds) {
    if (!propertyIds) {
      app.saveDirtyPropertyIds([]);
      return;
    }
    var clearSet = {};
    (Array.isArray(propertyIds) ? propertyIds : [propertyIds]).forEach(function (propertyId) {
      var value = String(propertyId || '').trim();
      if (value) {
        clearSet[value] = true;
      }
    });
    app.saveDirtyPropertyIds(app.readDirtyPropertyIds().filter(function (propertyId) {
      return !clearSet[propertyId];
    }));
  };

  app.getDirtyPropertiesForSync = function () {
    var dirtyLookup = {};
    app.readDirtyPropertyIds().forEach(function (propertyId) {
      dirtyLookup[propertyId] = true;
    });
    return app.readProperties().filter(function (property) {
      return !!(property && property.uid && dirtyLookup[property.uid]);
    });
  };

  app.readSystemState = function () {
    return Object.assign(app.getDefaultSystemState(), app.loadFirst(app.STORAGE_KEYS.systemState, app.getDefaultSystemState()) || {});
  };

  app.saveSystemState = function (row) {
    var current = app.readSystemState();
    app.savePrimary('systemState', Object.assign({}, current, row || {}));
  };

  app.normalizeSupervisionRequest = function (row) {
    if (!row || typeof row !== 'object') {
      return null;
    }
    var uid = String(row.uid || row.id || '').trim();
    if (!uid) {
      uid = app.createId ? app.createId('SUP') : ('SUP-' + Date.now());
    }
    return {
      uid: uid,
      data: app.normalizeDateInput ? app.normalizeDateInput(row.data || row.date || '') : String(row.data || row.date || ''),
      hora: String(row.hora || row.time || '').trim(),
      agente: app.cleanUiText ? app.cleanUiText(row.agente || row.agent || '') : String(row.agente || row.agent || ''),
      matricula: String(row.matricula || row.registration || '').trim(),
      operationMode: app.normalizeOperationMode ? app.normalizeOperationMode(row.operationMode || row.operation_mode || row.operacao || '') : String(row.operationMode || row.operation_mode || 'VD'),
      mensagem: app.cleanUiText ? app.cleanUiText(row.mensagem || row.message || row.motivo || '') : String(row.mensagem || row.message || row.motivo || ''),
      status: app.cleanUiText ? app.cleanUiText(row.status || 'Aberta') : String(row.status || 'Aberta'),
      gpsLat: row.gpsLat !== undefined ? row.gpsLat : (row.gps_lat !== undefined ? row.gps_lat : ''),
      gpsLng: row.gpsLng !== undefined ? row.gpsLng : (row.gps_lng !== undefined ? row.gps_lng : ''),
      gpsAcc: row.gpsAcc !== undefined ? row.gpsAcc : (row.gps_acc !== undefined ? row.gps_acc : ''),
      gpsTerritory: app.cleanUiText ? app.cleanUiText(row.gpsTerritory || row.gps_territory || '') : String(row.gpsTerritory || row.gps_territory || ''),
      gpsQuarteirao: app.normalizeAreaCode ? app.normalizeAreaCode(row.gpsQuarteirao || row.gps_quarteirao || '') : String(row.gpsQuarteirao || row.gps_quarteirao || ''),
      createdAt: String(row.createdAt || row.created_at || new Date().toISOString()),
      updatedAt: String(row.updatedAt || row.updated_at || new Date().toISOString()),
      synced: row.synced === true || row.sincronizado === true
    };
  };

  app.readSupervisionRequests = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.supervisionRequests, []);
    return Array.isArray(rows) ? rows.map(app.normalizeSupervisionRequest).filter(Boolean) : [];
  };

  app.saveSupervisionRequests = function (rows) {
    var normalized = Array.isArray(rows) ? rows.map(app.normalizeSupervisionRequest).filter(Boolean) : [];
    var map = {};
    normalized.forEach(function (row) {
      if (!row || !row.uid) {
        return;
      }
      if (!map[row.uid] || String(row.updatedAt || row.createdAt || '') > String(map[row.uid].updatedAt || map[row.uid].createdAt || '')) {
        map[row.uid] = row;
      }
    });
    app.savePrimary('supervisionRequests', Object.keys(map).map(function (uid) { return map[uid]; }).sort(function (a, b) {
      return String((b.createdAt || '') + (b.hora || '')).localeCompare(String((a.createdAt || '') + (a.hora || '')));
    }));
  };

  app.upsertSupervisionRequest = function (row) {
    var normalized = app.normalizeSupervisionRequest(row);
    if (!normalized) {
      return null;
    }
    var rows = app.readSupervisionRequests().filter(function (item) {
      return item && item.uid !== normalized.uid;
    });
    rows.unshift(normalized);
    app.saveSupervisionRequests(rows);
    return normalized;
  };

  app.getUnsyncedSupervisionRequests = function () {
    return app.readSupervisionRequests().filter(function (row) {
      return row && row.synced === false;
    });
  };

  app.markSupervisionRequestsSyncedByUid = function (pendingIds) {
    var count = 0;
    if (!pendingIds) {
      return 0;
    }
    app.saveSupervisionRequests(app.readSupervisionRequests().map(function (row) {
      if (row && row.uid && pendingIds[row.uid]) {
        if (row.synced === false) {
          count += 1;
        }
        row.synced = true;
        row.updatedAt = new Date().toISOString();
      }
      return row;
    }));
    return count;
  };


  app.normalizeLocationTrailPoint = function (row) {
    var source = row || {};
    var lat = Number(source.lat !== undefined ? source.lat : (source.gps_lat !== undefined ? source.gps_lat : source.latitude));
    var lng = Number(source.lng !== undefined ? source.lng : (source.gps_lng !== undefined ? source.gps_lng : source.longitude));
    var timestamp = String(source.timestamp || source.capturedAt || source.createdAt || new Date().toISOString()).trim();
    var date = String(source.date || source.data || '').trim() || timestamp.slice(0, 10);
    var agent = app.normalizeAgent ? app.normalizeAgent(app.state.currentAgent || app.readSession() || {}) : (app.state.currentAgent || {});
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return {
      uid: String(source.uid || source.id || app.createId('TRK')).trim(),
      timestamp: timestamp,
      date: date,
      matricula: String(source.matricula || source.agent_matricula || (agent && agent.matricula) || '').trim(),
      nome: app.cleanUiText ? app.cleanUiText(source.nome || source.agente || source.agent_name || (agent && agent.nome) || '') : String(source.nome || source.agente || source.agent_name || (agent && agent.nome) || ''),
      operationMode: app.normalizeOperationMode ? app.normalizeOperationMode(source.operationMode || source.operation_mode || source.operational_mode || (app.getCurrentOperationModeLabel && app.getCurrentOperationModeLabel()) || 'VD') : String(source.operationMode || source.operation_mode || 'VD'),
      lat: Number(lat.toFixed(7)),
      lng: Number(lng.toFixed(7)),
      accuracy: Math.round(Number(source.accuracy !== undefined ? source.accuracy : (source.gps_acc !== undefined ? source.gps_acc : source.acc)) || 0),
      speed: source.speed !== undefined && source.speed !== null ? Number(source.speed) : '',
      heading: source.heading !== undefined && source.heading !== null ? Number(source.heading) : '',
      battery: source.battery !== undefined && source.battery !== null ? source.battery : '',
      eventType: String(source.eventType || source.event_type || source.tipo || 'track').trim() || 'track',
      eventLabel: app.cleanUiText ? app.cleanUiText(source.eventLabel || source.event_label || source.label || '') : String(source.eventLabel || source.event_label || source.label || ''),
      visitUid: String(source.visitUid || source.visit_uid || '').trim(),
      syncedAt: String(source.syncedAt || source.synced_at || '').trim(),
      synced: source.synced === true
    };
  };

  app.readLocationTrail = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.locationTrail, []);
    return Array.isArray(rows) ? rows.map(app.normalizeLocationTrailPoint).filter(Boolean) : [];
  };

  app.saveLocationTrail = function (rows) {
    var normalized = Array.isArray(rows) ? rows.map(app.normalizeLocationTrailPoint).filter(Boolean) : [];
    var map = {};
    normalized.forEach(function (row) {
      if (!row || !row.uid) {
        return;
      }
      if (!map[row.uid] || String(row.timestamp || '') > String(map[row.uid].timestamp || '')) {
        map[row.uid] = row;
      }
    });
    normalized = Object.keys(map).map(function (uid) { return map[uid]; }).sort(function (a, b) {
      return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
    });
    var retentionStart = app.daysAgoISO(Number(app.CONFIG.LOCATION_TRAIL_RETENTION_DAYS || 14));
    var unsynced = normalized.filter(function (row) { return row.synced !== true; });
    var unsyncedImportant = unsynced.filter(function (row) {
      return String(row.eventType || 'track') !== 'track' || !!row.visitUid;
    });
    var unsyncedTrack = unsynced.filter(function (row) {
      return String(row.eventType || 'track') === 'track' && !row.visitUid;
    }).slice(0, Number(app.CONFIG.LOCATION_TRAIL_UNSYNCED_TRACK_LIMIT || 1200));
    var recentSynced = normalized.filter(function (row) {
      return row.synced === true && (!row.date || row.date >= retentionStart);
    }).slice(0, Number(app.CONFIG.LOCATION_TRAIL_CACHE_LIMIT || 2500));
    app.savePrimary('locationTrail', unsyncedImportant.concat(unsyncedTrack).concat(recentSynced));
  };

  app.addLocationTrailPoint = function (row) {
    var normalized = app.normalizeLocationTrailPoint(row);
    if (!normalized) {
      return null;
    }
    var rows = app.readLocationTrail();
    rows.unshift(normalized);
    app.saveLocationTrail(rows);
    return normalized;
  };

  app.getUnsyncedLocationTrail = function () {
    return app.readLocationTrail().filter(function (row) {
      return row && row.synced !== true;
    });
  };

  app.markLocationTrailSyncedByUid = function (pendingIds) {
    var lookup = {};
    var list = Array.isArray(pendingIds) ? pendingIds : Object.keys(pendingIds || {});
    list.forEach(function (uid) {
      uid = String(uid || '').trim();
      if (uid) {
        lookup[uid] = true;
      }
    });
    if (!Object.keys(lookup).length) {
      return 0;
    }
    var syncedAt = new Date().toISOString();
    var count = 0;
    app.saveLocationTrail(app.readLocationTrail().map(function (row) {
      if (row && row.uid && lookup[row.uid]) {
        if (row.synced !== true) {
          count += 1;
        }
        row.synced = true;
        row.syncedAt = syncedAt;
      }
      return row;
    }));
    return count;
  };

  app.getOfflineQueueSummary = function () {
    var system = app.readSystemState();
    var visits = app.getUnsyncedVisits ? app.getUnsyncedVisits() : [];
    var tubitos = typeof app.readTubitos === 'function'
      ? app.readTubitos().filter(function (row) { return row && row.synced === false; })
      : [];
    var properties = typeof app.readDirtyPropertyIds === 'function' ? app.readDirtyPropertyIds() : [];
    var propertyRows = typeof app.readProperties === 'function' ? app.readProperties() : [];
    var logs = typeof app.getUnsyncedLogs === 'function' ? app.getUnsyncedLogs() : [];
    var supervision = typeof app.getUnsyncedSupervisionRequests === 'function' ? app.getUnsyncedSupervisionRequests() : [];
    var locationTrail = typeof app.getUnsyncedLocationTrail === 'function' ? app.getUnsyncedLocationTrail() : [];
    var propertyConflictCount = propertyRows.filter(function (property) {
      return property && property.syncConflict === true;
    }).length;
    var adminPending = system.pendingSync ? 1 : 0;
    // Logs de auditoria são mantidos e enviados em carona nas próximas sincronizações,
    // mas não bloqueiam o agente nem aparecem como produção pendente de campo.
    var total = visits.length + tubitos.length + properties.length + supervision.length + locationTrail.length + adminPending;
    return {
      visits: visits.length,
      tubitos: tubitos.length,
      properties: properties.length,
      propertyConflicts: propertyConflictCount,
      logs: logs.length,
      supervision: supervision.length,
      locationTrail: locationTrail.length,
      admin: adminPending,
      total: total,
      hasPending: total > 0,
      pendingReason: system.pendingReason || ''
    };
  };

  app.hasOfflinePendingData = function () {
    return app.getOfflineQueueSummary().hasPending;
  };

  app.addLog = function (scope, action, targetUid, details) {
    var logs = app.readLogs();
    logs.unshift({
      uid: app.createId('LOG'),
      scope: String(scope || '').trim(),
      action: String(action || '').trim(),
      actor_name: app.state.currentAgent ? app.state.currentAgent.nome : '',
      actor_matricula: app.state.currentAgent ? app.state.currentAgent.matricula : '',
      target_uid: String(targetUid || '').trim(),
      details: String(details || '').trim(),
      createdAt: new Date().toISOString(),
      synced: false
    });
    app.saveLogs(logs);
  };

  app.getUnsyncedVisits = function () {
    return app.readVisits().filter(function (visit) { return !visit.synced; });
  };

  app.getCurrentOperationModeLabel = function () {
    var mode = 'VD';
    if (window.ACEOperationMode && typeof window.ACEOperationMode.getCurrentMode === 'function') {
      mode = window.ACEOperationMode.getCurrentMode();
    } else if (app.state && app.state.visit && app.state.visit.operationMode) {
      mode = app.state.visit.operationMode;
    }
    return app.getOperationModeLabel ? app.getOperationModeLabel(mode) : String(mode || 'VD');
  };

  app.countSentTodayForCurrentAgent = function () {
    var today = app.todayISO();
    var agent = app.state.currentAgent || app.readSession() || {};
    var matricula = String(agent.matricula || '').trim();
    var nome = String(agent.nome || '').trim().toLowerCase();
    return app.readVisits().filter(function (visit) {
      var sameDay = visit && visit.data === today;
      var isSent = visit && visit.synced !== false;
      var sameAgent = !matricula && !nome
        ? true
        : (String(visit.matricula || '').trim() === matricula || String(visit.agente || '').trim().toLowerCase() === nome);
      return sameDay && isSent && sameAgent;
    }).length;
  };

  app.getServiceHealth = function () {
    var system = app.readSystemState();
    var summary = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : {
      visits: app.getUnsyncedVisits().length,
      tubitos: 0,
      properties: 0,
      logs: 0,
      supervision: 0,
      locationTrail: 0,
      admin: system.pendingSync ? 1 : 0,
      total: app.getUnsyncedVisits().length + (system.pendingSync ? 1 : 0),
      hasPending: false
    };
    return {
      offline: typeof navigator !== 'undefined' && navigator.onLine === false,
      syncInFlight: !!app.state.syncInFlight,
      queue: summary.visits,
      queueTubitos: summary.tubitos,
      queueProperties: summary.properties,
      propertyConflicts: summary.propertyConflicts || 0,
      queueLogs: summary.logs,
      queueSupervision: summary.supervision,
      queueLocationTrail: summary.locationTrail || 0,
      queueAdmin: summary.admin,
      queueTotal: summary.total,
      queueSummary: summary,
      sentToday: typeof app.countSentTodayForCurrentAgent === 'function' ? app.countSentTodayForCurrentAgent() : 0,
      lastSyncAt: system.lastSyncAt || '',
      lastSyncError: system.lastSyncError || '',
      lastBackupAt: system.lastBackupAt || '',
      lastBootstrapAt: system.lastBootstrapAt || '',
      pendingSync: !!system.pendingSync,
      pendingReason: system.pendingReason || '',
      lastDayClosedAt: system.lastDayClosedAt || '',
      lastDayClosedDate: system.lastDayClosedDate || '',
      suppressRemoteVisitsDate: system.suppressRemoteVisitsDate || '',
      weatherCache: system.weatherCache || null,
      lastWeatherError: system.lastWeatherError || ''
    };
  };



  app.getOfflineEssentialAssets = function () {
    return [
      './',
      './index.html',
      './manifest.webmanifest',
      './sw-acs.js',
      './assets/ace-theme.css',
      './assets/ace-ui-standard.css',
      './assets/runtime-config.js',
      './assets/carmo-territorios-data.js',
      './assets/ruas-carmo-data.js',
      './assets/ace-storage.js',
      './assets/index-core.js',
      './assets/index-render.js',
      './assets/index-actions.js',
      './assets/lgpd-hardening.js',
      './assets/operation-mode.js',
      './assets/liraa-mode.js',
    ];
  };

  app.getOfflineCacheName = function () {
    return 'ace-campo-offline-20260521-stable-v69-sem-icones';
  };

  app.isLocalFileMode = function () {
    var protocol = window.location && window.location.protocol;
    var origin = window.location && window.location.origin;
    return protocol === 'file:' || origin === 'null' || !origin;
  };

  app.isPwaSecureContext = function () {
    var protocol = window.location && window.location.protocol;
    var hostname = window.location && window.location.hostname;
    if (app.isLocalFileMode()) { return false; }
    return !!(
      protocol === 'https:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  };

  app.getOfflineAssetRequestUrls = function (asset) {
    var urls = [];
    var baseUrl = new URL(asset, window.location.href).toString();
    var scopeUrl = new URL(asset, new URL('./', window.location.href)).toString();
    urls.push(baseUrl);
    if (scopeUrl !== baseUrl) {
      urls.push(scopeUrl);
    }
    if (asset === './') {
      urls.push(new URL('./index.html', window.location.href).toString());
    }
    return urls;
  };

  app.testLocalStorageAvailable = function () {
    var key = 'ace_offline_readiness_probe_' + String(Date.now());
    try {
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  };

  app.testIndexedStorageAvailable = function () {
    if (!window.ACEIndexedStore || typeof window.ACEIndexedStore.put !== 'function') {
      return Promise.resolve({ ok: false, supported: false, message: 'IndexedDB indisponível; usando cópia local simples.' });
    }
    return window.ACEIndexedStore.put('ace_offline_readiness_probe', { ok: true, at: new Date().toISOString() })
      .then(function () {
        return { ok: true, supported: true, message: 'Armazenamento local avançado funcionando.' };
      })
      .catch(function () {
        return { ok: false, supported: true, message: 'Falha ao testar IndexedDB; localStorage segue como reserva.' };
      });
  };

  app.waitForPromiseWithTimeout = function (promise, timeoutMs, fallbackValue) {
    var timer;
    return Promise.race([
      promise,
      new Promise(function (resolve) {
        timer = window.setTimeout(function () { resolve(fallbackValue); }, Number(timeoutMs || 5000));
      })
    ]).then(function (value) {
      if (timer) { window.clearTimeout(timer); }
      return value;
    });
  };

  app.checkServiceWorkerReadiness = function () {
    if (app.isLocalFileMode && app.isLocalFileMode()) {
      return Promise.resolve({
        ok: true,
        supported: false,
        active: false,
        localFile: true,
        message: 'Modo arquivo/local detectado. Service worker não registra com origem null, mas o app está usando os arquivos locais do pacote.'
      });
    }
    if (!app.isPwaSecureContext()) {
      return Promise.resolve({
        ok: false,
        supported: false,
        active: false,
        message: 'PWA/cache offline precisa de HTTPS ou localhost. Publique o app em endereço seguro para ativar o service worker.'
      });
    }
    if (!('serviceWorker' in navigator)) {
      return Promise.resolve({ ok: false, supported: false, active: false, message: 'Este navegador não suporta funcionamento offline por service worker.' });
    }

    var ensureRegistration = navigator.serviceWorker.getRegistration('./').then(function (registration) {
      if (registration) {
        return registration;
      }
      if (typeof app.registerServiceWorker === 'function') {
        return app.registerServiceWorker().then(function () {
          return navigator.serviceWorker.getRegistration('./');
        });
      }
      return navigator.serviceWorker.register('./sw-acs.js', { scope: './' });
    }).then(function (registration) {
      if (registration && registration.update) {
        registration.update().catch(function () { return null; });
      }
      if (registration && (registration.active || registration.waiting || registration.installing)) {
        return registration;
      }
      return app.waitForPromiseWithTimeout(navigator.serviceWorker.ready, 8000, registration || null);
    });

    return ensureRegistration.then(function (registration) {
      var active = !!(registration && (registration.active || registration.waiting || registration.installing));
      return {
        ok: active,
        supported: true,
        active: active,
        message: active ? 'Cache/PWA registrado no aparelho.' : 'Service worker ainda não está ativo. Mantenha internet e toque em Verificar novamente.'
      };
    }).catch(function () {
      return { ok: false, supported: true, active: false, message: 'Não foi possível confirmar o cache/PWA. Recarregue o app com internet uma vez.' };
    });
  };

  app.primeOfflineAssetCache = function () {
    var assets = app.getOfflineEssentialAssets();
    if (app.isLocalFileMode && app.isLocalFileMode()) {
      return Promise.resolve(assets.map(function (asset) {
        return { asset: asset, ok: true, localFile: true };
      }));
    }
    if (!('caches' in window)) {
      return Promise.resolve([]);
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.resolve([]);
    }

    return caches.open(app.getOfflineCacheName()).then(function (cache) {
      return Promise.all(assets.map(function (asset) {
        var urls = app.getOfflineAssetRequestUrls(asset);
        var primary = urls[0];
        return fetch(primary, { cache: 'reload', credentials: 'same-origin' }).then(function (response) {
          if (!response || !response.ok) {
            return { asset: asset, ok: false };
          }
          return Promise.all(urls.map(function (url) {
            return cache.put(url, response.clone()).catch(function () { return null; });
          })).then(function () {
            return { asset: asset, ok: true };
          });
        }).catch(function () {
          return { asset: asset, ok: false };
        });
      }));
    });
  };

  app.checkEssentialCacheReadiness = function () {
    var assets = app.getOfflineEssentialAssets();
    if (app.isLocalFileMode && app.isLocalFileMode()) {
      return Promise.resolve({
        ok: true,
        supported: false,
        cached: assets.length,
        total: assets.length,
        missing: [],
        localFile: true,
        message: 'Modo arquivo/local: arquivos essenciais carregados diretamente da pasta do app; cache PWA não se aplica.'
      });
    }
    if (!('caches' in window)) {
      return Promise.resolve({ ok: false, supported: false, cached: 0, total: 0, missing: assets, message: 'Cache do navegador indisponível.' });
    }

    function checkCachedAssets() {
      var checks = assets.map(function (asset) {
        var urls = app.getOfflineAssetRequestUrls(asset);
        return Promise.all(urls.map(function (url) {
          return caches.match(url, { ignoreSearch: true }).then(function (match) {
            return !!match;
          }).catch(function () {
            return false;
          });
        })).then(function (matches) {
          return { asset: asset, ok: matches.some(Boolean) };
        });
      });

      return Promise.all(checks).then(function (rows) {
        var missing = rows.filter(function (row) { return !row.ok; }).map(function (row) { return row.asset; });
        return {
          ok: missing.length === 0,
          supported: true,
          cached: rows.length - missing.length,
          total: rows.length,
          missing: missing,
          message: missing.length ? 'Ainda faltam arquivos essenciais no cache offline.' : 'Arquivos essenciais já estão no cache offline.'
        };
      });
    }

    return checkCachedAssets().then(function (firstResult) {
      if (firstResult.ok || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        return firstResult;
      }
      return app.primeOfflineAssetCache().then(function () {
        return checkCachedAssets();
      }).then(function (secondResult) {
        if (!secondResult.ok && firstResult.missing && firstResult.missing.length === secondResult.missing.length) {
          secondResult.message = secondResult.message + ' O navegador não conseguiu baixar os arquivos agora; mantenha internet, recarregue a página e verifique novamente.';
        }
        return secondResult;
      });
    });
  };


  app.getOperationReadinessInfo = function () {
    var mode = 'VD';
    var label = 'VD';
    var plan = null;
    var planDate = '';
    var receivedAt = '';
    var validForToday = false;
    var restriction = null;
    var hasTerritory = false;
    try {
      if (window.ACEOperationMode && typeof window.ACEOperationMode.getCurrentMode === 'function') {
        mode = window.ACEOperationMode.getCurrentMode() || 'VD';
      }
      if (window.ACEOperationMode && typeof window.ACEOperationMode.getActivePlan === 'function') {
        plan = window.ACEOperationMode.getActivePlan() || null;
      }
      if (window.ACEOperationMode && typeof window.ACEOperationMode.getTerritoryRestriction === 'function') {
        restriction = window.ACEOperationMode.getTerritoryRestriction(plan);
      }
      label = app.getOperationModeLabel ? app.getOperationModeLabel(mode) : String(mode || 'VD');
    } catch (error) {}
    if (plan) {
      planDate = String(plan.data_operacao || plan.date || plan.data || plan.reference_date || '').slice(0, 10);
      receivedAt = String(plan.updatedAt || plan.updated_at || plan.saved_at || plan.created_at || '').trim();
      validForToday = !!planDate && planDate === app.todayISO();
      hasTerritory = !!(restriction && (
        (Array.isArray(restriction.units) && restriction.units.length) ||
        (Array.isArray(restriction.microareas) && restriction.microareas.length) ||
        (Array.isArray(restriction.quarteiroes) && restriction.quarteiroes.length)
      ));
    } else {
      planDate = app.todayISO();
      validForToday = false;
    }
    return {
      mode: mode || 'VD',
      label: label || 'VD',
      plan: plan,
      hasSpecialPlan: !!plan,
      hasTerritory: hasTerritory,
      territoryLabel: restriction && restriction.label ? restriction.label : '',
      planDate: planDate,
      receivedAt: receivedAt,
      validForToday: validForToday,
      confirmed: validForToday && !!plan && hasTerritory
    };
  };

  app.getOfflineReadinessStatus = function () {
    var agent = app.state.currentAgent || app.readSession() || null;
    var session = app.readSession();
    var localAgents = app.readAgents();
    var properties = app.readProperties();
    var operationInfo = app.getOperationReadinessInfo();
    var queue = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : { total: app.getUnsyncedVisits().length, visits: app.getUnsyncedVisits().length, tubitos: 0 };
    var localStorageOk = app.testLocalStorageAvailable();
    var agentKey = agent ? String(agent.uid || agent.matricula || agent.cpf || '').trim() : '';
    var localAgent = agent ? localAgents.find(function (item) {
      return (agent.uid && item.uid === agent.uid) ||
        (agent.matricula && String(item.matricula || '').trim() === String(agent.matricula || '').trim()) ||
        (agent.cpf && app.normalizeCpf(item.cpf || '') === app.normalizeCpf(agent.cpf || ''));
    }) : null;
    var localCredentialHash = String((localAgent && localAgent.senhaHash) || (agent && agent.senhaHash) || (session && session.senhaHash) || '').trim();
    var sessionSaved = !!(agent && session && ((agent.uid && session.uid === agent.uid) || (agent.matricula && String(session.matricula || '') === String(agent.matricula || '')) || (agent.cpf && app.normalizeCpf(session.cpf || '') === app.normalizeCpf(agent.cpf || ''))));
    var territorySource = window.ACE_TERRITORY_SOURCE || null;
    var territoryCatalog = territorySource && territorySource.meta && territorySource.meta.catalog ? territorySource.meta.catalog : null;
    var territoryReady = !!(
      (territorySource && Array.isArray(territorySource.polygons) && territorySource.polygons.length) ||
      (territoryCatalog && Array.isArray(territoryCatalog.territories) && territoryCatalog.territories.length) ||
      (app.CONFIG && Array.isArray(app.CONFIG.BAIRROS) && app.CONFIG.BAIRROS.length)
    );
    var checks = [];

    function addCheck(id, labelText, ok, critical, detail, warn) {
      checks.push({
        id: id,
        label: labelText,
        status: ok ? 'ok' : (warn ? 'pending' : 'error'),
        critical: critical !== false,
        detail: detail || '',
        ok: !!ok
      });
    }

    addCheck('agent', 'Agente logado', !!agent, true, agent ? ((agent.matricula || '-') + ' • ' + (agent.nome || '')) : 'Nenhum agente em sessão.');
    addCheck('session', 'Sessão salva no tablet', sessionSaved, true, sessionSaved ? 'Sessão local encontrada.' : 'A sessão ainda não foi confirmada no armazenamento local.');
    addCheck('offlineLogin', 'Login offline disponível', !!localCredentialHash, true, localCredentialHash ? 'Credencial local preparada para este aparelho.' : 'Faça login com internet neste aparelho antes de sair para campo.');
    addCheck('operation', 'Plano operacional do dia recebido', operationInfo.confirmed, true, operationInfo.confirmed
      ? ('Operação de hoje: ' + (operationInfo.label || 'VD') + ' • território: ' + (operationInfo.territoryLabel || 'definido') + ' • válido para ' + app.formatDateBR(operationInfo.planDate) + '.')
      : (operationInfo.hasSpecialPlan
        ? 'Plano encontrado, mas falta território de microárea/quarteirão ou a data não é de hoje.'
        : 'Faça login com internet pela manhã para baixar a operação lançada pela coordenação.'));
    addCheck('properties', 'Base de imóveis disponível localmente', Array.isArray(properties), true, 'Imóveis locais: ' + String(properties.length) + '.');
    addCheck('territory', 'Base territorial disponível', territoryReady, true, territoryReady ? 'Catálogo territorial/KMZ carregado no aparelho.' : 'Catálogo territorial não carregado.');
    addCheck('localStorage', 'Armazenamento local funcionando', localStorageOk, true, localStorageOk ? 'localStorage funcionando.' : 'O navegador bloqueou o armazenamento local.');
    addCheck('pendingQueue', 'Fila offline protegida', !!queue && Number(queue.total || 0) >= 0, true, 'Pendentes: ' + Number(queue.total || 0) + ' item(ns), incluindo ' + Number(queue.visits || 0) + ' visita(s), ' + Number(queue.tubitos || 0) + ' tubito(s) e ' + Number(queue.locationTrail || 0) + ' ponto(s) de rota.');

    return Promise.all([
      app.testIndexedStorageAvailable(),
      app.checkServiceWorkerReadiness(),
      app.checkEssentialCacheReadiness()
    ]).then(function (results) {
      var indexed = results[0] || {};
      var sw = results[1] || {};
      var cache = results[2] || {};
      addCheck('indexedDb', 'IndexedDB/ACEStorage funcionando', indexed.ok || indexed.supported === false, false, indexed.message || 'Verificação concluída.', indexed.supported === false);
      addCheck('serviceWorker', 'Cache/PWA preparado', !!sw.ok, true, sw.message || 'Verificação do service worker concluída.');
      addCheck('cacheFiles', 'Arquivos essenciais no cache', !!cache.ok, true, (cache.message || 'Verificação do cache concluída.') + (cache.missing && cache.missing.length ? ' Faltando: ' + cache.missing.join(', ') : ''));

      var criticalFailed = checks.filter(function (check) { return check.critical !== false && check.status !== 'ok'; });
      var pending = checks.filter(function (check) { return check.status === 'pending'; });
      var status = criticalFailed.length ? 'error' : (pending.length ? 'pending' : 'ok');
      var title = status === 'ok' ? 'Tudo ok para começar' : (status === 'pending' ? 'Preparando uso offline' : 'Não saia para campo ainda');
      var text = status === 'ok'
        ? 'Login confirmado, plano do dia recebido e dados salvos para uso offline. O agente pode sair para campo. Mesmo sem internet, será possível registrar visitas, tubitos e operações do dia. Conecte novamente no almoço e no fim do expediente para sincronizar.'
        : (status === 'pending'
          ? 'Aguarde alguns segundos. O sistema está salvando no tablet os dados necessários para trabalhar sem internet.'
          : 'O sistema ainda não confirmou todos os dados necessários para uso offline. Mantenha a internet ligada e toque em Verificar novamente.');

      return {
        ok: status === 'ok',
        status: status,
        title: title,
        text: text,
        checks: checks,
        errors: criticalFailed,
        warnings: pending,
        agent: agent,
        operation: operationInfo,
        propertyCount: properties.length,
        pending: queue,
        serviceWorker: sw,
        cache: cache,
        localStorage: localStorageOk,
        indexedDb: indexed,
        generatedAt: new Date().toISOString()
      };
    });
  };

  app.readWeatherCache = function () {
    var system = app.readSystemState();
    return system && system.weatherCache && typeof system.weatherCache === 'object' ? system.weatherCache : null;
  };

  app.getWeatherCodeLabel = function (code) {
    var weatherCode = Number(code);
    var labels = {
      0: 'Ceu limpo',
      1: 'Quase limpo',
      2: 'Sol entre nuvens',
      3: 'Nublado',
      45: 'Nevoeiro',
      48: 'Nevoeiro gelado',
      51: 'Garoa fraca',
      53: 'Garoa moderada',
      55: 'Garoa intensa',
      56: 'Garoa congelante',
      57: 'Garoa congelante forte',
      61: 'Chuva fraca',
      63: 'Chuva moderada',
      65: 'Chuva forte',
      66: 'Chuva congelante',
      67: 'Chuva congelante forte',
      71: 'Neve fraca',
      73: 'Neve moderada',
      75: 'Neve forte',
      77: 'Graos de neve',
      80: 'Pancadas fracas',
      81: 'Pancadas moderadas',
      82: 'Pancadas fortes',
      85: 'Pancadas de neve',
      86: 'Neve intensa',
      95: 'Trovoadas',
      96: 'Trovoadas com granizo',
      99: 'Trovoadas severas'
    };
    return labels[weatherCode] || 'Condicao variavel';
  };

  app.getWeatherAlert = function (snapshot) {
    if (!snapshot) {
      return { label: 'Sem leitura', kind: 'warn' };
    }
    if (Number(snapshot.rainChance || 0) >= 70) {
      return { label: 'Alerta de chuva', kind: 'danger' };
    }
    if (Number(snapshot.uvMax || 0) >= 8) {
      return { label: 'UV alto', kind: 'warn' };
    }
    if (Number(snapshot.temperature || 0) >= 32) {
      return { label: 'Calor forte', kind: 'warn' };
    }
    return { label: 'Sem alerta', kind: 'ok' };
  };

  app.normalizeWeatherSnapshot = function (payload) {
    if (!payload || !payload.current || !payload.daily) {
      return null;
    }
    var current = payload.current || {};
    var daily = payload.daily || {};
    var temperature = Number(current.temperature_2m || 0);
    var humidity = Math.max(0, Math.round(Number(current.relative_humidity_2m || 0)));
    var weatherCode = Number(current.weather_code || 0);
    var maxTemp = Array.isArray(daily.temperature_2m_max) ? Number(daily.temperature_2m_max[0] || temperature) : temperature;
    var rainChance = Array.isArray(daily.precipitation_probability_max) ? Math.max(0, Math.round(Number(daily.precipitation_probability_max[0] || 0))) : 0;
    var uvMax = Array.isArray(daily.uv_index_max) ? Number(daily.uv_index_max[0] || 0) : 0;
    var weatherLabel = app.getWeatherCodeLabel(weatherCode);
    var snapshot = {
      city: app.CONFIG.WEATHER.city,
      temperature: Number(temperature.toFixed(1)),
      humidity: humidity,
      weatherCode: weatherCode,
      weatherLabel: weatherLabel,
      maxTemp: Number(maxTemp.toFixed(1)),
      rainChance: rainChance,
      uvMax: Number(uvMax.toFixed(1)),
      updatedAt: String(current.time || new Date().toISOString()).trim(),
      headline: Math.round(temperature) + '°C • ' + weatherLabel,
      meta: 'Chuva ' + rainChance + '% • UV ' + Number(uvMax.toFixed(1)) + ' • Max ' + Math.round(maxTemp) + '°C • Umid. ' + humidity + '%'
    };
    var alert = app.getWeatherAlert(snapshot);
    snapshot.alertLabel = alert.label;
    snapshot.alertKind = alert.kind;
    return snapshot;
  };

  app.buildWeatherUrl = function () {
    var cfg = app.CONFIG.WEATHER || {};
    return 'https://api.open-meteo.com/v1/forecast?' +
      'latitude=' + encodeURIComponent(String(cfg.latitude || 0)) +
      '&longitude=' + encodeURIComponent(String(cfg.longitude || 0)) +
      '&current=temperature_2m,relative_humidity_2m,weather_code' +
      '&daily=temperature_2m_max,precipitation_probability_max,uv_index_max' +
      '&timezone=' + encodeURIComponent(String(cfg.timezone || 'America/Sao_Paulo')) +
      '&forecast_days=1';
  };

  app.isWeatherCacheFresh = function (snapshot) {
    var refreshMs = Number((app.CONFIG.WEATHER && app.CONFIG.WEATHER.refreshMs) || 0);
    var updatedAt = snapshot && snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : 0;
    return !!(refreshMs && updatedAt && (Date.now() - updatedAt) < refreshMs);
  };

  app.hydrateTerritorySource = function () {
    var source = window.ACE_TERRITORY_SOURCE || { polygons: [], points: [] };
    if (app._territoryCache && app._territoryCache.source === source) {
      return app._territoryCache;
    }
    var polygons = (source.polygons || []).map(function (feature, index) {
      var folderName = String(feature.folder || '').trim();
      var territoryName = String(folderName || feature.name || '').trim();
      return {
        id: String(feature.id || ('poly-' + index)),
        name: String(feature.name || '').trim(),
        territoryName: territoryName,
        territoryLabel: app.getTerritoryLabel(territoryName),
        territoryKey: app.normalizeTerritoryKey(territoryName),
        quarteiraoKey: app.normalizeQuarteiraoKey(feature.name),
        coordinates: Array.isArray(feature.coordinates) ? feature.coordinates : []
      };
    }).filter(function (feature) {
      return feature.coordinates.length > 2;
    });
    app._territoryCache = {
      source: source,
      polygons: polygons,
      catalog: source.meta && source.meta.catalog ? source.meta.catalog : null
    };
    return app._territoryCache;
  };

  app.pointInsidePolygon = function (lat, lng, polygon) {
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
  };

  app.resolveTerritoryByGps = function (gps) {
    if (!gps || gps.lat == null || gps.lng == null) {
      return null;
    }
    var cache = app.hydrateTerritorySource();
    var polygon = cache.polygons.find(function (feature) {
      return app.pointInsidePolygon(Number(gps.lat), Number(gps.lng), feature.coordinates);
    }) || null;
    if (!polygon) {
      return null;
    }
    return {
      territoryName: polygon.territoryLabel || polygon.territoryName,
      territoryKey: polygon.territoryKey,
      quarteiraoName: polygon.name,
      quarteirao: app.normalizeAreaCode(String(polygon.name || '').replace(/^Q\s*[-/]?\s*/i, '')),
      polygonId: polygon.id
    };
  };

  app.getGpsAccuracyClass = function (gps) {
    var acc = Math.round(Number(gps && gps.accuracy || 0));
    if (!acc) {
      return { level: 'unknown', label: 'sem precisão informada', warning: true };
    }
    if (acc <= 6) {
      return { level: 'otimo', label: acc + ' m', warning: false };
    }
    if (acc <= 12) {
      return { level: 'aceitavel', label: acc + ' m', warning: false };
    }
    if (acc <= 25) {
      return { level: 'fraco', label: acc + ' m', warning: true };
    }
    return { level: 'ruim', label: acc + ' m', warning: true };
  };

  app.evaluateGpsAdministrativeContext = function (record, resolved) {
    var item = record || {};
    var gps = item.gps || null;
    var detected = resolved || (gps ? app.resolveTerritoryByGps(gps) : null);
    var officialMicroareaKey = app.normalizeTerritoryKey(item.microarea || '');
    var officialQuarterKey = app.normalizeQuarteiraoKey(item.quarteirao || '');
    var detectedTerritoryKey = app.normalizeTerritoryKey(detected && detected.territoryName || '');
    var detectedQuarterKey = app.normalizeQuarteiraoKey(detected && detected.quarteirao || '');
    var accuracy = app.getGpsAccuracyClass(gps);
    var territoryMismatch = !!(officialMicroareaKey && detectedTerritoryKey && officialMicroareaKey !== detectedTerritoryKey);
    var quarterMismatch = !!(officialQuarterKey && detectedQuarterKey && officialQuarterKey !== detectedQuarterKey);
    var mismatch = territoryMismatch || quarterMismatch;
    var warnings = [];

    if (gps && accuracy.warning) {
      warnings.push(accuracy.level === 'ruim' ? 'GPS com precisão ruim' : 'GPS com precisão fraca');
    }
    if (gps && detected && mismatch) {
      warnings.push('GPS divergente do território informado');
    }
    if (gps && !detected) {
      warnings.push('GPS fora do KMZ');
    }

    return {
      officialMicroarea: item.microarea || '',
      officialBairro: item.bairro || '',
      officialQuarteirao: item.quarteirao || '',
      detected: detected,
      accuracy: accuracy,
      territoryMismatch: territoryMismatch,
      quarterMismatch: quarterMismatch,
      mismatch: mismatch,
      warnings: warnings
    };
  };

  app.buildGpsAdministrativeMessage = function (record, resolved) {
    var ctx = app.evaluateGpsAdministrativeContext(record || {}, resolved || null);
    var gps = record && record.gps ? record.gps : null;
    var official = [ctx.officialBairro, ctx.officialMicroarea, ctx.officialQuarteirao ? 'Q ' + ctx.officialQuarteirao : ''].filter(Boolean).join(' • ');
    var detected = ctx.detected
      ? [ctx.detected.territoryName, ctx.detected.quarteirao ? 'Q ' + ctx.detected.quarteirao : ''].filter(Boolean).join(' • ')
      : 'fora dos polígonos do KMZ';
    var accuracy = gps ? ('Precisão: ' + ctx.accuracy.label + '.') : '';

    if (!gps) {
      return 'GPS ainda não capturado. Território oficial será o informado no cadastro.';
    }
    if (ctx.mismatch) {
      return 'GPS detectou ' + detected + ', mas o território oficial permanece ' + (official || 'o informado pelo agente') + '. ' + accuracy + ' Confira se está no limite entre quarteirões.';
    }
    if (ctx.accuracy.warning) {
      return 'GPS capturado com precisão ' + ctx.accuracy.label + '. Território oficial permanece ' + (official || 'o informado pelo agente') + '.';
    }
    return 'GPS detectou ' + detected + '. Território oficial permanece ' + (official || 'o informado pelo agente') + '. ' + accuracy;
  };

  app.buildRouteUrl = function (property) {
    if (!property || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      return '';
    }
    var label = [property.logradouro, property.numero, property.bairro, 'Carmo RJ'].filter(Boolean).join(', ');
    if (property.lastLat != null && property.lastLng != null) {
      return 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(String(property.lastLat) + ',' + String(property.lastLng));
    }
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(label);
  };

  app.getDuplicateProperties = function (record, rows) {
    var list = Array.isArray(rows) ? rows : app.readProperties();
    if (!record) {
      return [];
    }
    var targetKey = String(record.address_key || app.addressKey(record)).trim();
    var targetStreet = app.normalizeLabel(record.logradouro || '');
    var targetNumber = app.normalizeLabel(record.numero || '');
    var targetBairro = app.normalizeLabel(record.bairro || '');
    return list.filter(function (property) {
      if (!property || property.uid === record.uid) {
        return false;
      }
      if (property.address_key === targetKey) {
        return true;
      }
      return app.normalizeLabel(property.logradouro || '') === targetStreet &&
        app.normalizeLabel(property.numero || '') === targetNumber &&
        app.normalizeLabel(property.bairro || '') === targetBairro;
    });
  };

  app.computePropertyQuality = function (property, rows) {
    var flags = [];
    var duplicates = app.getDuplicateProperties(property, rows);
    if (!property.microarea) {
      flags.push('Sem microárea');
    }
    if (!property.quarteirao && !app.isMicroareaWithoutQuarteirao(property.microarea)) {
      flags.push('Sem quarteirão');
    }
    if (!property.referencia) {
      flags.push('Sem referência');
    }
    if (!property.lastLat || !property.lastLng) {
      flags.push('Sem GPS');
    }
    if (duplicates.length) {
      flags.push('Possível duplicidade');
    }
    return {
      flags: flags,
      status: flags.length ? (duplicates.length ? 'Atenção alta' : 'Atenção') : 'OK',
      duplicates: duplicates
    };
  };

  app.computeVisitQuality = function (visit) {
    var flags = [];
    if (!visit.microarea) {
      flags.push('Sem microárea');
    }
    if (!visit.quarteirao && !app.isMicroareaWithoutQuarteirao(visit.microarea)) {
      flags.push('Sem quarteirão');
    }
    if (!visit.gps) {
      flags.push('Sem GPS');
    } else if (typeof app.evaluateGpsAdministrativeContext === 'function') {
      app.evaluateGpsAdministrativeContext(visit).warnings.forEach(function (warning) {
        if (flags.indexOf(warning) === -1) {
          flags.push(warning);
        }
      });
    }
    if (visit.situacao === 'Fechado' && !visit.closedReason) {
      flags.push('Sem motivo do fechado');
    }
    if (visit.waterAccess === 'Não' && !visit.waterAccessReason) {
      flags.push('Sem motivo da caixa d\'água');
    }
    if (app.shouldAskLadderSupport(visit) && !visit.ladderSupportRequested) {
      flags.push('Sem decisão sobre escada');
    }
    if (app.shouldAskLadderSupport(visit) && visit.ladderSupportRequested === 'Não' && !visit.ladderSupportNoReason) {
      flags.push('Sem justificativa para não solicitar escada');
    }
    if (visit.waterAccess === 'Sim' && !visit.waterTreatment) {
      flags.push('Sem resposta do tratamento da caixa d\'água');
    }
    return flags;
  };

  app.validateVisitRecord = function (visit, options) {
    var opts = options || {};
    var normalized = app.normalizeVisit(visit || {});
    var errors = [];
    var warnings = [];
    var flags = [];
    var pushUnique = function (list, value) {
      if (value && list.indexOf(value) === -1) {
        list.push(value);
      }
    };
    var addError = function (value) {
      pushUnique(errors, value);
      pushUnique(flags, value);
    };
    var addWarning = function (value) {
      pushUnique(warnings, value);
      pushUnique(flags, value);
    };
    var totalDeposits = app.totalFromMap(normalized.depositCounts || {});
    var totalFocusDeposits = app.totalFromMap(normalized.depositFocusCounts || {});
    var totalTubitos = app.totalTubitosByDeposit(normalized.tubitosByDeposit || {});
    var reportedTubitos = Math.max(totalTubitos, Math.max(0, Number(normalized.tubitosQty || 0)));
    var allowMissingGps = opts.allowMissingGps !== false;
    var gpsTrusted = !!normalized.gps;

    (app.computeVisitQuality(normalized) || []).forEach(function (item) {
      pushUnique(flags, item);
    });

    if (!normalized.property_uid) {
      addError('Imóvel não vinculado');
    }
    if (!normalized.agente) {
      addError('Agente não informado');
    }
    if (!normalized.matricula) {
      addError('Matrícula não informada');
    }
    if (!normalized.situacao) {
      addError('Situação da visita não informada');
    }

    if (normalized.situacao === 'Fechado' && !normalized.closedReason) {
      addError('Motivo do imóvel fechado não informado');
    }

    if (normalized.situacao !== 'Fechado') {
      if (!normalized.depositFound) {
        addError('Situação de depósitos não informada');
      }
      if (normalized.depositFound === 'Sim' && totalDeposits <= 0) {
        addError('Depósito encontrado sem detalhamento');
      }
      if (normalized.focusFound === 'Sim' && totalFocusDeposits <= 0) {
        addError('Foco sem depósito vinculado');
      }
      if (normalized.waterAccess === 'Não' && !normalized.waterAccessReason) {
        addError('Motivo de caixa d\'água não informado');
      }
      if (app.shouldAskLadderSupport(normalized) && !normalized.ladderSupportRequested) {
        addError('Status da escada não informado');
      }
      if (app.shouldAskLadderSupport(normalized) && normalized.ladderSupportRequested === 'Não' && !normalized.ladderSupportNoReason) {
        addError('Motivo de não solicitar escada não informado');
      }
      if (normalized.waterAccess === 'Sim' && !normalized.waterTreatment) {
        addError('Tratamento da caixa d\'água não informado');
      }
    }

    if (reportedTubitos > 0 && !app.firstTubitoDepositCode(normalized.tubitosByDeposit || {}) && !normalized.tubitosDeposit) {
      addError('Tubito sem depósito');
    }

    if (String(normalized.operationMode || '').toUpperCase() === 'PE' && !normalized.peTipoLocal) {
      addError('Tipo do P.E. não informado');
    }
    if (String(normalized.operationMode || '').toUpperCase() === 'PE' && !normalized.peNomeLocal) {
      addError('Nome ou referência do P.E. não informado');
    }

    if (!normalized.gps) {
      if (allowMissingGps) {
        addWarning('Sem GPS');
      } else {
        addError('GPS não capturado');
      }
      gpsTrusted = false;
    } else if (!app.isValidLatLng(normalized.gps.lat, normalized.gps.lng)) {
      addWarning('GPS inválido');
      gpsTrusted = false;
    } else {
      if (!Number.isFinite(Number(normalized.gps.accuracy || 0)) || Number(normalized.gps.accuracy || 0) <= 0) {
        addWarning('GPS sem precisão confiável');
        gpsTrusted = false;
      }
      if (typeof app.evaluateGpsAdministrativeContext === 'function') {
        (app.evaluateGpsAdministrativeContext(normalized).warnings || []).forEach(function (warning) {
          addWarning(warning);
          if (warning.indexOf('divergente') > -1 || warning.indexOf('fora do KMZ') > -1 || warning.indexOf('ruim') > -1) {
            gpsTrusted = false;
          }
        });
      }
    }

    return {
      visit: normalized,
      errors: errors,
      warnings: warnings,
      flags: flags,
      qualityStatus: errors.length ? 'Bloqueada' : (flags.length ? 'Atenção' : 'OK'),
      quality_status: errors.length ? 'Bloqueada' : (flags.length ? 'Atenção' : 'OK'),
      gpsTrusted: gpsTrusted,
      canSave: errors.length === 0
    };
  };

  app.buildVisitReportHtml = function (visit, property) {
    var currentProperty = property || null;
    var qualityFlags = app.computeVisitQuality(visit);
    var address = currentProperty
      ? [currentProperty.logradouro, currentProperty.numero, currentProperty.bairro].filter(Boolean).join(', ')
      : [visit.logradouro, visit.numero, visit.bairro].filter(Boolean).join(', ');
    var routeUrl = visit.routeUrl || (currentProperty ? app.buildRouteUrl(currentProperty) : '');
    var statusLabel = app.getVisitStatusLabel(visit.situacao);
    var waterAccessText = app.buildWaterAccessText(visit);
    var tubitosDepositText = Number(visit.tubitosQty || 0) > 0 ? (app.formatTubitoDepositSummary(visit) || app.getTubitoDepositText(visit)) : '';
    var operationText = app.getOperationContextLabel(visit);
    var depositsEliminated = Number(visit.depositTotal || 0) || 0;
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório da visita</title><style>' +
      'body{font-family:Arial,sans-serif;color:#1b252e;padding:26px;margin:0;background:#f7faf8}' +
      'h1,h2{color:#183c2c;margin:0 0 10px}' +
      '.head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:2px solid #d6e3dc;padding-bottom:14px}' +
      '.badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#e5f0ea;color:#183c2c;font-weight:700}' +
      '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}' +
      '.box{border:1px solid #d6dfe2;border-radius:16px;padding:14px;background:#fff}' +
      '.label{display:block;font-size:11px;text-transform:uppercase;color:#66727c;font-weight:700;margin-bottom:6px}' +
      '.value{font-size:15px;font-weight:700;color:#183c2c;line-height:1.45}' +
      '.section{margin-top:20px}' +
      '.notes{border:1px solid #d6dfe2;border-radius:16px;padding:16px;background:#fff;line-height:1.6}' +
      '.footer{margin-top:24px;color:#66727c;font-size:12px;font-weight:700;text-align:center}' +
      '.pill{display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:999px;background:#f2f6f4;border:1px solid #d6e3dc;color:#355245;font-size:12px;font-weight:700}' +
      'a{color:#1f5e8f;text-decoration:none}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #d6dfe2;padding:8px;vertical-align:top}th{background:#eef5f1}' +
      '</style></head><body>' +
      '<div class="head"><div><h1>Relatório da visita ACE</h1><div>ACE Campo</div></div><span class="badge">' + app.escapeHtml(statusLabel || 'Visita') + '</span></div>' +
      '<div class="grid">' +
        '<div class="box"><span class="label">Data e hora</span><span class="value">' + app.escapeHtml(app.formatDateBR(visit.data) + ' • ' + visit.hora) + '</span></div>' +
        '<div class="box"><span class="label">Agente</span><span class="value">' + app.escapeHtml((visit.agente || '-') + (visit.matricula ? ' • ' + visit.matricula : '')) + '</span></div>' +
        '<div class="box"><span class="label">Operacao</span><span class="value">' + app.escapeHtml(operationText || 'VD') + '</span></div>' +
        '<div class="box"><span class="label">Endereço</span><span class="value">' + app.escapeHtml(address || '-') + '</span></div>' +
        '<div class="box"><span class="label">Morador</span><span class="value">' + app.escapeHtml(visit.morador || '-') + '</span></div>' +
        '<div class="box"><span class="label">Quem atendeu</span><span class="value">' + app.escapeHtml(visit.attendedBy || visit.morador || '-') + '</span></div>' +
        '<div class="box"><span class="label">Microárea / Quarteirão</span><span class="value">' + app.escapeHtml((visit.microarea || '-') + ' • Q ' + (visit.quarteirao || '-')) + '</span></div>' +
        (visit.closedReason ? '<div class="box"><span class="label">Motivo do fechado</span><span class="value">' + app.escapeHtml(visit.closedReason) + '</span></div>' : '') +
        '<div class="box"><span class="label">Foco / Tubitos</span><span class="value">' + app.escapeHtml(visit.focusFound + ' • ' + visit.focusQty + ' foco(s) • ' + visit.tubitosQty + ' tubito(s)' + (tubitosDepositText ? ' • ' + tubitosDepositText : '')) + '</span></div>' +
        '<div class="box"><span class="label">Depósitos</span><span class="value">' + app.escapeHtml(visit.depositTotal + ' encontrados • ' + visit.depositFocusTotal + ' com foco • ' + depositsEliminated + ' eliminados') + '</span></div>' +
        '<div class="box"><span class="label">Caixa d’água</span><span class="value">' + app.escapeHtml(waterAccessText) + '</span></div>' +
      '</div>' +
      '<div class="section"><h2>Controle de qualidade</h2>' +
        (qualityFlags.length ? qualityFlags.map(function (flag) { return '<span class="pill">' + app.escapeHtml(flag) + '</span>'; }).join('') : '<span class="pill">Registro completo</span>') +
      '</div>' +
      '<div class="section"><h2>Observações da visita</h2><div class="notes">' + app.escapeHtml(visit.obs || 'Sem observações adicionais.') + '</div></div>' +
      '<div class="section"><h2>Links operacionais</h2><table><tbody>' +
        '<tr><th>Tipo de trabalho</th><td>' + app.escapeHtml(operationText || 'VD') + '</td></tr>' +
        '<tr><th>Rota sugerida</th><td>' + (routeUrl ? '<a href="' + app.escapeHtml(routeUrl) + '" target="_blank" rel="noopener noreferrer">Abrir rota para o imóvel</a>' : 'Indisponível') + '</td></tr>' +
        '<tr><th>Território por GPS</th><td>' + app.escapeHtml(visit.gpsTerritory || '-') + (visit.gpsQuarteirao ? ' • Q ' + app.escapeHtml(visit.gpsQuarteirao) : '') + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="footer">Documento gerado localmente para conferência imediata da visita.</div>' +
      '</body></html>';
  };

  app.loadFirst = function (keys, fallback) {
    return app.readStorageSnapshot(keys, fallback);
  };

  app.savePrimary = function (keyName, value) {
    app.writeStorageSnapshot(keyName, value);
  };

  app.normalizeCpf = function (value) {
    return String(value == null ? '' : value).replace(/\D+/g, '').slice(0, 11);
  };

  app.formatCpf = function (value) {
    var digits = app.normalizeCpf(value);
    if (digits.length !== 11) { return digits; }
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  app.formatCpfPartial = function (value) {
    var digits = app.normalizeCpf(value);
    if (digits.length <= 3) { return digits; }
    if (digits.length <= 6) { return digits.replace(/(\d{3})(\d{1,3})/, '$1.$2'); }
    if (digits.length <= 9) { return digits.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3'); }
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  };

  app.normalizeAgent = function (agent) {
    if (!agent) {
      return null;
    }
    return {
      uid: String(agent.uid || app.createId('AGT')).trim(),
      nome: app.normalizeTitleText(agent.nome || ''),
      matricula: app.normalizeFreeText(agent.matricula || ''),
      cpf: app.normalizeCpf(agent.cpf || agent.CPF || agent.documento || agent.login || ''),
      role: String(agent.role || agent.perfil || 'ACE').trim() || 'ACE',
      baseMicroarea: app.normalizeAreaCode(agent.baseMicroarea || agent.base_microarea || ''),
      baseRegion: app.normalizeFreeText(agent.baseRegion || agent.base_region || ''),
      senhaHash: String(agent.senhaHash || agent.senha || '').trim(),
      apiSessionToken: String(agent.apiSessionToken || agent.sessionToken || agent.session_token || '').trim(),
      apiSessionExpiresAt: String(agent.apiSessionExpiresAt || agent.sessionExpiresAt || agent.session_expires_at || '').trim(),
      updatedAt: String(agent.updatedAt || new Date().toISOString()).trim()
    };
  };

  app.normalizeProperty = function (property) {
    if (!property) {
      return null;
    }

    var bairro = String(property.bairro || '').trim();
    var bairroCanonico = app.normalizeBairro(bairro);
    var logradouro = String(property.logradouro || '').trim();
    var numero = String(property.numero || '').trim();
    var allowedComplements = app.CONFIG.PROPERTY_COMPLEMENTS || [];
    var rawComplemento = String(property.complemento || property.logradouroModo || '').trim();
    var normalizedComplemento = app.normalizeTitleText(rawComplemento);
    var referenceValue = app.normalizeTitleText(property.referencia || property.ref || '');
    var complementValue = allowedComplements.indexOf(normalizedComplemento) > -1 ? normalizedComplemento : 'Normal';

    if (!referenceValue && rawComplemento && allowedComplements.indexOf(normalizedComplemento) === -1) {
      referenceValue = app.normalizeTitleText(rawComplemento);
    }

    return {
      uid: String(property.uid || app.createId('PROP')).trim(),
      morador: app.normalizeTitleText(property.morador || ''),
      telefone: app.normalizeFreeText(property.telefone || ''),
      microarea: app.normalizeMicroareaLabel(property.microarea || '', bairroCanonico),
      quarteirao: app.normalizeAreaCode(property.quarteirao || ''),
      bairro: bairroCanonico,
      logradouro: app.normalizeTitleText(logradouro),
      numero: app.normalizeFreeText(numero),
      complemento: complementValue,
      tipo: String(property.tipo || 'Residencial').trim(),
      referencia: referenceValue,
      obs: app.normalizeFreeText(property.obs || ''),
      address_key: String(property.address_key || app.addressKey({
        bairro: bairroCanonico,
        logradouro: logradouro,
        numero: numero
      })).trim(),
      lastLat: app.normalizeCoord(property.lastLat || property.last_lat || ''),
      lastLng: app.normalizeCoord(property.lastLng || property.last_lng || ''),
      gpsTerritory: app.normalizeBairro(property.gpsTerritory || property.gps_territory || ''),
      gpsQuarteirao: app.normalizeAreaCode(property.gpsQuarteirao || property.gps_quarteirao || ''),
      qualityFlags: Array.isArray(property.qualityFlags)
        ? property.qualityFlags.filter(Boolean)
        : String(property.qualityFlags || property.quality_flags || '')
            .split('|')
            .map(function (item) { return String(item || '').trim(); })
            .filter(Boolean),
      qualityStatus: String(property.qualityStatus || property.quality_status || '').trim(),
      createdByName: app.normalizeTitleText(property.createdByName || property.created_by_name || property.created_by || ''),
      createdByMatricula: app.normalizeFreeText(property.createdByMatricula || property.created_by_matricula || ''),
      createdAt: String(property.createdAt || property.created_at || '').trim(),
      lastVisitAt: String(property.lastVisitAt || property.last_visit_at || '').trim(),
      updatedAt: String(property.updatedAt || new Date().toISOString()).trim(),
      syncConflict: property.syncConflict === true || property.sync_conflict === true || String(property.syncConflict || property.sync_conflict || '').trim() === '1',
      syncConflictAt: String(property.syncConflictAt || property.sync_conflict_at || '').trim(),
      syncConflictReason: String(property.syncConflictReason || property.sync_conflict_reason || '').trim(),
      syncConflictMessage: String(property.syncConflictMessage || property.sync_conflict_message || '').trim(),
      syncConflictServerUpdatedAt: String(property.syncConflictServerUpdatedAt || property.sync_conflict_server_updated_at || '').trim(),
      syncConflictLocalUpdatedAt: String(property.syncConflictLocalUpdatedAt || property.sync_conflict_local_updated_at || '').trim()
    };
  };

  app.getPropertyReferenceText = function (property) {
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
  };

  app.normalizeVisit = function (visit) {
    if (!visit) {
      return null;
    }

    var depositCounts = app.normalizeDepositMap(visit.depositCounts, visit.deposits);
    var depositFocusCounts = app.normalizeDepositMap(
      visit.depositFocusCounts || visit.deposit_focus_counts,
      visit.deposit_focus_breakdown
    );
    var depositTreatmentCounts = app.normalizeDepositMap(
      visit.depositTreatmentCounts || visit.deposit_treatment_counts,
      visit.deposit_treatment_breakdown
    );
    var focusQty = Math.max(0, Number(visit.focusQty || visit.focus_count || visit.focos_qtd || 0));
    var rawTubitosQty = Math.max(0, Number(visit.tubitosQty || visit.tubitos_qtd || visit.tubitosQtd || 0));
    var tubitosDeposit = app.normalizeDepositCode(
      visit.tubitosDeposit || visit.tubitos_deposito || visit.tubito_deposito || visit.tubitosDepositCode || ''
    ) || app.firstPositiveDepositCode(depositFocusCounts);
    var tubitosByDeposit = app.normalizeTubitosByDeposit(
      visit.tubitosByDeposit || visit.tubitos_by_deposito || visit.tubitosDepositos || visit.tubitos_depositos || visit.tubitos_deposito || '',
      tubitosDeposit,
      rawTubitosQty
    );
    var normalizedTubitosQty = app.totalTubitosByDeposit(tubitosByDeposit) || rawTubitosQty;
    tubitosDeposit = app.firstTubitoDepositCode(tubitosByDeposit) || tubitosDeposit;

    var rawSituation = String(visit.situacao || visit.status || '').trim();
    var normalizedSituation = app.normalizeStatus(rawSituation || 'Visitado');
    var rawClosedReason = visit.closedReason || visit.closed_reason || visit.motivoFechado || visit.motivo_fechado || '';
    if (!rawClosedReason && rawSituation.toLowerCase().indexOf('recusa') > -1) {
      rawClosedReason = 'Recusa';
    }

    var normalizedWaterAccess = app.normalizeChoice(visit.waterAccess || visit.acessou_caixa_agua || '');
    var rawWaterAccessReason = visit.waterAccessReason || visit.water_access_reason || visit.motivoCaixaAgua || visit.motivo_caixa_agua || '';
    var rawWaterTankCondition = visit.waterTankCondition || visit.water_tank_condition || visit.situacaoCaixaAgua || visit.situacao_caixa_agua || '';
    var rawWaterTreatment = visit.waterTreatment || visit.water_tank_treatment || visit.tratamentoCaixaAgua || visit.tratamento_caixa_agua || '';
    var rawLadderSupportRequested = visit.ladderSupportRequested || visit.ladder_support_requested || visit.solicitaEscada || visit.solicita_escada || '';
    var rawLadderSupportNoReason = visit.ladderSupportNoReason || visit.ladder_support_no_reason || visit.motivoNaoSolicitouEscada || visit.motivo_nao_solicitou_escada || '';
    var bairroCanonico = app.normalizeBairro(visit.bairro || '');
    var normalized = {
      uid: String(visit.uid || app.createId('VIS')).trim(),
      data: app.normalizeDateOnly(visit.data || app.todayISO()),
      hora: app.sanitizeHour(visit.hora || app.nowHHMM()),
      agente: app.normalizeTitleText(visit.agente || ''),
      matricula: app.normalizeFreeText(visit.matricula || ''),
      microarea: app.normalizeMicroareaLabel(visit.microarea || '', bairroCanonico),
      quarteirao: app.normalizeAreaCode(visit.quarteirao || ''),
      bairro: bairroCanonico,
      logradouro: app.normalizeTitleText(visit.logradouro || ''),
      numero: app.normalizeFreeText(visit.numero || ''),
      tipo: String(visit.tipo || 'Residencial').trim(),
      situacao: normalizedSituation,
      closedReason: normalizedSituation === 'Fechado' ? app.normalizeClosedReason(rawClosedReason) : '',
      morador: app.normalizeTitleText(visit.morador || ''),
      telefone: app.normalizeFreeText(visit.telefone || ''),
      property_uid: String(visit.property_uid || visit.propertyUid || visit.property_id || visit.propertyId || '').trim(),
      depositCounts: depositCounts,
      depositTotal: app.totalFromMap(depositCounts),
      depositFocusCounts: depositFocusCounts,
      depositFocusTotal: app.totalFromMap(depositFocusCounts),
      depositTreatmentCounts: depositTreatmentCounts,
      depositTreatmentTotal: app.totalFromMap(depositTreatmentCounts),
      deposits: app.compactMap(depositCounts),
      depositFocusBreakdown: app.compactMap(depositFocusCounts),
      depositTreatmentBreakdown: app.compactMap(depositTreatmentCounts),
      depositFound: app.normalizeChoice(
        visit.depositFound || visit.deposit_found ||
        (app.totalFromMap(depositCounts) > 0 ? 'Sim' : '')
      ),
      focusFound: app.normalizeChoice(
        visit.focusFound || visit.foco || visit.focoEncontrado ||
        (focusQty > 0 || app.totalFromMap(depositFocusCounts) > 0 ? 'Sim' : '')
      ),
      focusQty: focusQty,
      waterAccess: normalizedWaterAccess,
      waterAccessReason: normalizedWaterAccess === 'Não' ? app.normalizeWaterAccessReason(rawWaterAccessReason) : '',
      ladderSupportRequested: (normalizedWaterAccess === 'Não' && app.normalizeWaterAccessReason(rawWaterAccessReason) === 'Necessita escada') ? app.normalizeLadderSupportRequested(rawLadderSupportRequested) : '',
      ladderSupportNoReason: (normalizedWaterAccess === 'Não' && app.normalizeWaterAccessReason(rawWaterAccessReason) === 'Necessita escada' && app.normalizeLadderSupportRequested(rawLadderSupportRequested) === 'Não') ? app.normalizeLadderSupportNoReason(rawLadderSupportNoReason) : '',
      waterTankCondition: normalizedWaterAccess === 'Sim' ? app.normalizeWaterTankCondition(rawWaterTankCondition) : '',
      waterTreatment: normalizedWaterAccess === 'Sim' ? app.normalizeChoice(rawWaterTreatment) : '',
      attendedBy: app.normalizeTitleText(visit.attendedBy || visit.attended_by || visit.nomeAtendido || visit.nome_atendido || ''),
      larvicida: String(visit.larvicida || 'Nenhum').trim(),
      larvicidaQty: Math.max(0, Number(visit.larvicidaQty || visit.larvicida_qtd || 0)),
      adulticida: String(visit.adulticida || 'Nenhum').trim(),
      adulticidaQty: Math.max(0, Number(visit.adulticidaQty || visit.adulticida_qtd || 0)),
      tubitosQty: normalizedTubitosQty,
      tubitosDeposit: tubitosDeposit,
      tubitosByDeposit: tubitosByDeposit,
      laboratorioStatus: app.normalizeFreeText(visit.laboratorioStatus || visit.laboratorio_status || ''),
      laboratorioResultado: app.normalizeFreeText(visit.laboratorioResultado || visit.laboratorio_resultado || ''),
      laboratorioPositivoAedes: app.normalizeChoice(visit.laboratorioPositivoAedes || visit.laboratorio_positivo_aedes || ''),
      laboratorioAtualizadoEm: String(visit.laboratorioAtualizadoEm || visit.laboratorio_atualizado_em || '').trim(),
      operationMode: app.normalizeOperationMode(
        visit.operationMode || visit.operation_mode || visit.operational_mode || visit.origem_visita || visit.origemVisita || 'VD'
      ),
      peTipoLocal: app.normalizeFreeText(visit.peTipoLocal || visit.pe_tipo_local || ''),
      peNomeLocal: app.normalizeFreeText(visit.peNomeLocal || visit.pe_nome_local || ''),
      peObservacao: app.normalizeFreeText(visit.peObservacao || visit.pe_observacao || ''),
      liraaCiclo: app.normalizeFreeText(visit.liraaCiclo || visit.liraa_ciclo || ''),
      liraaPlanoId: app.normalizeFreeText(visit.liraaPlanoId || visit.liraa_plano_id || ''),
      liraaQuarteiraoSorteado: app.normalizeFreeText(visit.liraaQuarteiraoSorteado || visit.liraa_quarteirao_sorteado || ''),
      liraaUnitKey: app.normalizeFreeText(visit.liraaUnitKey || visit.liraa_unit_key || ''),
      liraaColeta: app.normalizeChoice(visit.liraaColeta || visit.liraa_coleta || ''),
      operationMicroareas: app.normalizeFreeText(visit.operationMicroareas || visit.operation_microareas || visit.operation_microarea_designada || ''),
      operationQuarteiroes: app.normalizeFreeText(visit.operationQuarteiroes || visit.operation_quarteiroes || visit.operation_quarteirao_designado || ''),
      operationUnits: app.normalizeFreeText(visit.operationUnits || visit.operation_units || visit.operation_units_designadas || ''),
      foraAreaDesignada: app.normalizeChoice(visit.foraAreaDesignada || visit.fora_area_designada || ''),
      obs: app.normalizeFreeText(visit.obs || visit.observacoes || ''),
      gps: app.normalizeVisitGps(visit),
      gpsTerritory: app.normalizeBairro(visit.gpsTerritory || visit.gps_territory || ''),
      gpsQuarteirao: app.normalizeAreaCode(visit.gpsQuarteirao || visit.gps_quarteirao || ''),
      qualityFlags: Array.isArray(visit.qualityFlags)
        ? visit.qualityFlags.filter(Boolean)
        : String(visit.qualityFlags || visit.quality_flags || '')
            .split('|')
            .map(function (item) { return String(item || '').trim(); })
            .filter(Boolean),
      qualityStatus: String(visit.qualityStatus || visit.quality_status || '').trim(),
      routeUrl: app.normalizeExternalUrl(visit.routeUrl || visit.route_url || ''),
      synced: !!visit.synced,
      createdAt: String(visit.createdAt || new Date().toISOString()).trim(),
      updatedAt: String(visit.updatedAt || new Date().toISOString()).trim()
    };

    return normalized;
  };

  app.normalizeLaboratoryStatus = function (value) {
    var text = app.normalizeFreeText(value || '');
    return text || 'Pendente';
  };

  app.isAedesPositiveResult = function (row) {
    var result = String(row && (row.resultado_laboratorio || row.resultadoLaboratorio || row.resultado || '') || '').toLowerCase();
    var species = String(row && (row.especie || row.species || '') || '').toLowerCase();
    var explicit = app.normalizeChoice(row && (row.positivo_aedes || row.positivoAedes || row.aedesPositive || '') || '');

    if (explicit === 'Sim') {
      return true;
    }

    return result.indexOf('positivo') > -1 && species.indexOf('aedes') > -1;
  };

  app.normalizeTubito = function (row) {
    if (!row) {
      return null;
    }

    var visitUid = String(row.visit_uid || row.visitUid || row.visita_uid || row.visitaUid || '').trim();
    var number = String(row.numero_tubito || row.numeroTubito || row.tubito_numero || row.tubitoNumero || row.codigo || '').trim();
    var positive = app.isAedesPositiveResult(row) ? 'Sim' : app.normalizeChoice(row.positivo_aedes || row.positivoAedes || '');

    return {
      uid: String(row.uid || (visitUid && number ? ('TUB-' + visitUid + '-' + number) : app.createId('TUB'))).trim(),
      numeroTubito: number,
      visit_uid: visitUid,
      property_uid: String(row.property_uid || row.propertyUid || '').trim(),
      dataColeta: app.normalizeDateOnly(row.data_coleta || row.dataColeta || row.data || app.todayISO()),
      horaColeta: app.sanitizeHour(row.hora_coleta || row.horaColeta || row.hora || ''),
      agente: app.normalizeTitleText(row.agente || ''),
      matricula: app.normalizeFreeText(row.matricula || ''),
      microarea: app.normalizeMicroareaLabel(row.microarea || '', row.bairro || ''),
      quarteirao: app.normalizeAreaCode(row.quarteirao || ''),
      bairro: app.normalizeBairro(row.bairro || ''),
      logradouro: app.normalizeTitleText(row.logradouro || ''),
      numero: app.normalizeFreeText(row.numero || ''),
      depositoCodigo: app.normalizeDepositCode(row.deposito_codigo || row.depositoCodigo || row.tubitos_deposito || row.tubitosDeposit || ''),
      origemVisita: app.normalizeOperationMode(row.origem_visita || row.origemVisita || row.operation_mode || row.operationMode || 'VD'),
      operationMode: app.normalizeOperationMode(row.operation_mode || row.operationMode || row.origem_visita || row.origemVisita || 'VD'),
      peTipoLocal: app.normalizeFreeText(row.pe_tipo_local || row.peTipoLocal || ''),
      peNomeLocal: app.normalizeFreeText(row.pe_nome_local || row.peNomeLocal || ''),
      liraaCiclo: app.normalizeFreeText(row.liraa_ciclo || row.liraaCiclo || ''),
      statusLaboratorio: app.normalizeLaboratoryStatus(row.status_laboratorio || row.statusLaboratorio || ''),
      resultadoLaboratorio: app.normalizeFreeText(row.resultado_laboratorio || row.resultadoLaboratorio || ''),
      especie: app.normalizeFreeText(row.especie || ''),
      positivoAedes: positive,
      analisadoPor: app.normalizeTitleText(row.analisado_por || row.analisadoPor || ''),
      analisadoEm: String(row.analisado_em || row.analisadoEm || '').trim(),
      observacaoLaboratorio: app.normalizeFreeText(row.observacao_laboratorio || row.observacaoLaboratorio || ''),
      synced: row.synced !== false,
      updatedAt: String(row.updatedAt || row.updated_at || new Date().toISOString()).trim()
    };
  };

  app.formatTubitoCollectionDateCode = function (value) {
    var text = String(value || app.todayISO()).trim();
    var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    var today = app.todayISO().match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (iso) {
      return iso[3] + iso[2];
    }

    if (br) {
      return br[1] + br[2];
    }

    return today ? (today[3] + today[2]) : '0000';
  };

  app.buildVisitShortCode = function (visit) {
    var currentVisit = visit || {};
    var source = [
      currentVisit.uid,
      currentVisit.data,
      currentVisit.hora,
      currentVisit.property_uid || currentVisit.propertyUid,
      currentVisit.logradouro,
      currentVisit.numero,
      currentVisit.matricula
    ].join('|');
    var hash = 0;
    var index;

    if (!source.replace(/\|/g, '').trim()) {
      source = app.todayISO();
    }

    for (index = 0; index < source.length; index += 1) {
      hash = ((hash * 31) + source.charCodeAt(index)) % 1296;
    }

    return hash.toString(36).toUpperCase().padStart(2, '0').slice(-2);
  };

  app.buildTubitoNumber = function (visit, sequence) {
    return app.formatTubitoCollectionDateCode(visit && visit.data) +
      '-' + String(sequence || 0).padStart(3, '0') +
      '-' + app.buildVisitShortCode(visit);
  };

  app.readTubitos = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.tubitos, []);
    return Array.isArray(rows) ? rows.map(app.normalizeTubito).filter(Boolean) : [];
  };

  app.saveTubitos = function (rows) {
    var normalized = Array.isArray(rows) ? rows.map(app.normalizeTubito).filter(Boolean) : [];
    normalized.sort(function (a, b) {
      return String((b.dataColeta || '') + ' ' + (b.numeroTubito || '')).localeCompare(String((a.dataColeta || '') + ' ' + (a.numeroTubito || '')));
    });
    app.savePrimary('tubitos', normalized);
  };

  app.upsertTubitosForVisit = function (visit) {
    var currentVisit = app.normalizeVisit(visit);
    var tubitosByDeposit = app.getTubitosByDeposit(currentVisit);
    var qty = app.totalTubitosByDeposit(tubitosByDeposit);
    var allRows = app.readTubitos();
    var existingForVisit = {};
    var retained = [];
    var range;
    var createdRows = [];
    var depositCodes;
    var sequenceIndex = 0;

    if (!currentVisit || !currentVisit.uid) {
      return [];
    }

    allRows.forEach(function (row) {
      if (row.visit_uid === currentVisit.uid) {
        existingForVisit[row.uid] = row;
        if (row.numeroTubito) {
          existingForVisit[row.numeroTubito] = row;
        }
        return;
      }
      retained.push(row);
    });

    if (!qty) {
      app.saveTubitos(retained);
      return [];
    }

    range = app.getTubitoRangeForVisit(currentVisit, currentVisit.uid);
    depositCodes = Object.keys(app.DEPOSITS).filter(function (code) {
      return Math.max(0, Number(tubitosByDeposit[code] || 0)) > 0;
    });

    depositCodes.forEach(function (depositCode) {
      var depositQty = Math.max(0, Number(tubitosByDeposit[depositCode] || 0));
      for (var index = 0; index < depositQty; index += 1) {
        var sequence = Number(range.start || 1) + sequenceIndex;
        var number = app.buildTubitoNumber(currentVisit, sequence);
        var uid = 'TUB-' + currentVisit.uid + '-' + depositCode + '-' + String(index + 1).padStart(2, '0');
        var legacyUid = 'TUB-' + currentVisit.uid + '-' + String(sequenceIndex + 1).padStart(2, '0');
        var previous = existingForVisit[uid] || existingForVisit[legacyUid] || existingForVisit[number] || {};

        createdRows.push(app.normalizeTubito(Object.assign({}, previous, {
        uid: uid,
        numero_tubito: number,
        visit_uid: currentVisit.uid,
        property_uid: currentVisit.property_uid,
        data_coleta: currentVisit.data,
        hora_coleta: currentVisit.hora,
        agente: currentVisit.agente,
        matricula: currentVisit.matricula,
        microarea: currentVisit.microarea,
        quarteirao: currentVisit.quarteirao,
        bairro: currentVisit.bairro,
        logradouro: currentVisit.logradouro,
        numero: currentVisit.numero,
        deposito_codigo: depositCode,
        origem_visita: currentVisit.operationMode || 'VD',
        operation_mode: currentVisit.operationMode || 'VD',
        pe_tipo_local: currentVisit.peTipoLocal || '',
        pe_nome_local: currentVisit.peNomeLocal || '',
        liraa_ciclo: currentVisit.liraaCiclo || '',
        status_laboratorio: previous.statusLaboratorio || previous.status_laboratorio || 'Pendente',
        resultado_laboratorio: previous.resultadoLaboratorio || previous.resultado_laboratorio || '',
        especie: previous.especie || '',
        positivo_aedes: previous.positivoAedes || previous.positivo_aedes || '',
        analisado_por: previous.analisadoPor || previous.analisado_por || '',
        analisado_em: previous.analisadoEm || previous.analisado_em || '',
        observacao_laboratorio: previous.observacaoLaboratorio || previous.observacao_laboratorio || '',
        synced: false,
        updatedAt: new Date().toISOString()
      })));
        sequenceIndex += 1;
      }
    });

    app.saveTubitos(retained.concat(createdRows));
    return createdRows;
  };

  app.mergeRemoteTubitos = function (rows) {
    var local = app.readTubitos();
    var map = {};

    local.forEach(function (row) {
      var key = row.uid || row.numeroTubito;
      if (key) {
        map[key] = row;
      }
    });

    (Array.isArray(rows) ? rows : []).map(app.normalizeTubito).filter(Boolean).forEach(function (remote) {
      var key = remote.uid || remote.numeroTubito;
      if (!key) {
        return;
      }
      remote.synced = true;
      map[key] = Object.assign({}, map[key] || {}, remote);
    });

    app.saveTubitos(Object.keys(map).map(function (key) {
      return map[key];
    }));
  };

  app.getTubitosForVisit = function (visitOrUid) {
    var uid = typeof visitOrUid === 'string'
      ? visitOrUid
      : String(visitOrUid && visitOrUid.uid || '').trim();
    if (!uid) {
      return [];
    }
    return app.readTubitos().filter(function (row) {
      return row.visit_uid === uid;
    }).sort(function (a, b) {
      return String(a.numeroTubito || '').localeCompare(String(b.numeroTubito || ''), 'pt-BR', { numeric: true });
    });
  };

  app.getTubitosForProperty = function (property) {
    var propertyUid = String(property && property.uid || '').trim();
    var key = app.addressKey(property || {});
    var visits = app.getVisitsForProperty(property || {});
    var visitIds = {};

    visits.forEach(function (visit) {
      if (visit.uid) {
        visitIds[visit.uid] = true;
      }
    });

    return app.readTubitos().filter(function (row) {
      if (propertyUid && row.property_uid === propertyUid) {
        return true;
      }
      if (row.visit_uid && visitIds[row.visit_uid]) {
        return true;
      }
      return key && app.addressKey(row) === key;
    });
  };

  app.getLabSummaryForVisit = function (visitOrUid) {
    var rows = app.getTubitosForVisit(visitOrUid);
    var positive = 0;
    var negative = 0;
    var inconclusive = 0;
    var pending = 0;

    rows.forEach(function (row) {
      var status = String(row.statusLaboratorio || '').toLowerCase();
      var result = String(row.resultadoLaboratorio || '').toLowerCase();
      if (row.positivoAedes === 'Sim' || app.isAedesPositiveResult(row)) {
        positive += 1;
      } else if (result.indexOf('negativo') > -1) {
        negative += 1;
      } else if (result.indexOf('inconclus') > -1 || status.indexOf('inconclus') > -1) {
        inconclusive += 1;
      } else {
        pending += 1;
      }
    });

    return {
      total: rows.length,
      positive: positive,
      negative: negative,
      inconclusive: inconclusive,
      pending: pending,
      rows: rows,
      tone: positive ? 'danger' : pending ? 'warn' : rows.length ? 'ok' : 'neutral',
      text: rows.length
        ? (positive
          ? positive + ' positivo(s) para Aedes'
          : pending
            ? pending + ' pendente(s) de laboratório'
            : 'Sem Aedes positivo')
        : 'Sem tubito vinculado'
    };
  };

  app.formatDetailedLabSummaryText = function (visitOrUid) {
    var summary = app.getLabSummaryForVisit(visitOrUid);
    var pieces = [];
    if (!summary.total) {
      return '';
    }
    if (summary.pending === summary.total && !summary.positive && !summary.negative && !summary.inconclusive) {
      return 'Lab: aguardando análise';
    }
    if (summary.positive) {
      pieces.push(summary.positive + ' positivo Aedes');
    }
    if (summary.negative) {
      pieces.push(summary.negative + ' negativo');
    }
    if (summary.inconclusive) {
      pieces.push(summary.inconclusive + ' inconclusivo');
    }
    pieces.push(summary.pending + ' pendente');
    return 'Lab: ' + (pieces.length ? pieces.join(' • ') : 'sem Aedes positivo');
  };

  app.formatLabSummaryText = function (visitOrUid) {
    var summary = app.getLabSummaryForVisit(visitOrUid);
    if (!summary.total) {
      return '';
    }
    return app.formatDetailedLabSummaryText(visitOrUid) + ' (' + summary.total + ' tubito(s))';
  };

  app.readAgents = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.agents, []);
    return Array.isArray(rows) ? rows.map(app.normalizeAgent).filter(Boolean) : [];
  };

  app.readProperties = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.properties, []);
    return Array.isArray(rows) ? rows.map(app.normalizeProperty).filter(Boolean) : [];
  };

  app.readVisits = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.visits, []);
    return Array.isArray(rows) ? rows.map(app.normalizeVisit).filter(Boolean) : [];
  };

  app.pruneLocalVisitCache = function (rows) {
    var normalized = Array.isArray(rows) ? rows.map(app.normalizeVisit).filter(Boolean) : [];
    var dedup = {};
    var retentionStart = app.daysAgoISO(Number(app.CONFIG.LOCAL_VISIT_RETENTION_DAYS || 21));
    normalized.forEach(function (visit) {
      var key = String(visit.uid || '').trim();
      if (!key) {
        return;
      }
      if (!dedup[key] || String(visit.updatedAt || '') > String(dedup[key].updatedAt || '')) {
        dedup[key] = visit;
      }
    });
    var ordered = Object.keys(dedup).map(function (key) {
      return dedup[key];
    }).sort(app.compareVisitDesc);
    var unsynced = ordered.filter(function (visit) {
      return visit.synced === false;
    });
    var recentSynced = ordered.filter(function (visit) {
      return visit.synced !== false && visit.data && visit.data >= retentionStart;
    }).slice(0, Number(app.CONFIG.LOCAL_VISIT_CACHE_LIMIT || 1200));
    return unsynced.concat(recentSynced).sort(app.compareVisitDesc);
  };

  app.readSession = function () {
    var session = app.loadFirst(app.STORAGE_KEYS.session, null);
    return session ? app.normalizeAgent(session) : null;
  };

  app.saveAgents = function (rows) { app.savePrimary('agents', rows.map(app.normalizeAgent).filter(Boolean)); };
  app.saveProperties = function (rows) { app.savePrimary('properties', rows.map(app.normalizeProperty).filter(Boolean)); };
  app.saveVisits = function (rows) { app.savePrimary('visits', app.pruneLocalVisitCache(rows)); };
  app.saveSession = function (row) { app.savePrimary('session', row || null); };

  app.getOfflineReadinessDismissKey = function (agent, date) {
    var currentAgent = agent || app.state.currentAgent || app.readSession() || {};
    var personKey = app.normalizeCpf(currentAgent.cpf || '') || String(currentAgent.matricula || currentAgent.nome || 'agente').trim().toLowerCase() || 'agente';
    var dayKey = date || app.todayISO();
    return 'ace_offline_readiness_dismissed_' + personKey + '_' + dayKey;
  };

  app.isOfflineReadinessDismissed = function () {
    try {
      return localStorage.getItem(app.getOfflineReadinessDismissKey()) === '1';
    } catch (error) {
      return false;
    }
  };

  app.dismissOfflineReadinessCard = function () {
    try {
      localStorage.setItem(app.getOfflineReadinessDismissKey(), '1');
    } catch (error) {}
  };

  app.clearOfflineReadinessDismissal = function () {
    try {
      localStorage.removeItem(app.getOfflineReadinessDismissKey());
    } catch (error) {}
  };

  app.saveLastArea = function (microarea, quarteirao) {
    app.savePrimary('lastArea', {
      microarea: app.normalizeMicroareaLabel(microarea || '', ''),
      quarteirao: app.normalizeAreaCode(quarteirao || '')
    });
  };

  app.readLastArea = function () {
    var area = app.loadFirst(app.STORAGE_KEYS.lastArea, null);
    if (!area) {
      return { microarea: '', quarteirao: '' };
    }
    return {
      microarea: app.normalizeMicroareaLabel(area.microarea || '', ''),
      quarteirao: app.normalizeAreaCode(area.quarteirao || '')
    };
  };

  app.uniqueSorted = function (values, comparator, normalizer) {
    var map = {};
    var normalize = typeof normalizer === 'function'
      ? normalizer
      : function (value) { return app.normalizeLabel(value); };

    (values || []).forEach(function (value) {
      var text = String(value || '').trim();
      var key = normalize(text);
      if (text && key && !map[key]) {
        map[key] = text;
      }
    });

    return Object.keys(map).map(function (key) {
      return map[key];
    }).sort(comparator || function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  };

  app.getBairroCatalog = function () {
    return app.uniqueSorted(
      app.CONFIG.BAIRROS.map(function (name) {
        return app.normalizeBairro(name);
      }),
      null,
      app.normalizeTerritoryKey
    );
  };

  app.setBairroCatalog = function (rows) {
    var names = (rows || []).map(function (row) {
      return typeof row === 'string' ? row : (row && row.nome);
    }).map(function (name) {
      return app.normalizeBairro(name || '');
    }).filter(Boolean);

    if (!names.length) {
      return false;
    }

    app.CONFIG.BAIRROS = app.uniqueSorted(names, null, app.normalizeTerritoryKey);
    return true;
  };

  app.getCarmoStreetRows = function () {
    var source = window.ACE_RUAS_CARMO || {};
    var rows = Array.isArray(source.rows) ? source.rows : [];
    return rows.filter(function (row) {
      return !!String(row && row.logradouro || '').trim();
    });
  };

  app.getCarmoStreetSuggestion = function (logradouro) {
    var key = app.normalizeLabel(logradouro || '');
    if (!key) {
      return null;
    }
    return app.getCarmoStreetRows().find(function (row) {
      return app.normalizeLabel(row.logradouro || '') === key;
    }) || null;
  };

  app.getCarmoStreetSuggestionText = function (row) {
    if (!row) {
      return '';
    }
    var parts = [];
    if (row.microareas_sugeridas) {
      parts.push('Microárea sugerida: ' + row.microareas_sugeridas);
    }
    if (row.quarteiroes_sugeridos) {
      parts.push('Quarteirão sugerido: ' + row.quarteiroes_sugeridos);
    }
    parts.push('Fonte: OSM, pendente de validação.');
    return parts.join(' • ');
  };

  app.getLogradouroCatalog = function (bairro) {
    var selectedBairro = String(bairro || '').trim();
    var streetRows = app.getCarmoStreetRows().map(function (row) {
      return row.logradouro;
    });
    var values = streetRows.concat(app.readProperties().filter(function (property) {
      return !selectedBairro || property.bairro === selectedBairro;
    }).map(function (property) {
      return property.logradouro;
    }).concat(
      app.readVisits().filter(function (visit) {
        return !selectedBairro || visit.bairro === selectedBairro;
      }).map(function (visit) {
        return visit.logradouro;
      })
    ));
    return app.uniqueSorted(values);
  };

  app.getTerritoryCatalog = function () {
    var lastArea = app.readLastArea();
    var properties = app.readProperties();
    var visits = app.readVisits();
    var territorySource = app.hydrateTerritorySource();
    var sourceCatalog = territorySource && territorySource.catalog && territorySource.catalog.byTerritory
      ? territorySource.catalog.byTerritory
      : null;
    var bucket = {};
    var allQuarteiroes = [];

    function ensureBucket(microarea) {
      var key = app.normalizeAreaCode(microarea || '');
      if (!key) {
        return '';
      }
      if (!bucket[key]) {
        bucket[key] = {
          value: key,
          quarteiroes: []
        };
      }
      return key;
    }

    function addQuarteirao(microarea, quarteirao) {
      var areaKey = ensureBucket(microarea);
      var quarter = app.normalizeAreaCode(quarteirao || '');
      if (quarter) {
        allQuarteiroes.push(quarter);
        if (areaKey) {
          bucket[areaKey].quarteiroes.push(quarter);
        }
      }
    }

    if (sourceCatalog) {
      Object.keys(sourceCatalog).forEach(function (territoryName) {
        var areaKey = ensureBucket(app.getTerritoryLabel(territoryName));
        (sourceCatalog[territoryName] || []).forEach(function (quarteirao) {
          var normalizedQuarter = app.normalizeAreaCode(quarteirao);
          if (!normalizedQuarter) {
            return;
          }
          bucket[areaKey].quarteiroes.push(normalizedQuarter);
          allQuarteiroes.push(normalizedQuarter);
        });
      });
    } else {
      app.CONFIG.MICROAREA_PRESETS.forEach(function (item) {
        var areaKey = ensureBucket(item.value);
        (item.quarteiroes || []).forEach(function (quarteirao) {
          bucket[areaKey].quarteiroes.push(app.normalizeAreaCode(quarteirao));
          allQuarteiroes.push(app.normalizeAreaCode(quarteirao));
        });
      });
    }

    properties.forEach(function (property) {
      addQuarteirao(property.microarea, property.quarteirao);
    });
    visits.forEach(function (visit) {
      addQuarteirao(visit.microarea, visit.quarteirao);
    });
    addQuarteirao(app.state.visit && app.state.visit.microarea, app.state.visit && app.state.visit.quarteirao);
    addQuarteirao(lastArea.microarea, lastArea.quarteirao);

    var microareas = app.uniqueSorted(Object.keys(bucket), app.compareAreaCode);
    var byMicroarea = {};
    microareas.forEach(function (microarea) {
      byMicroarea[microarea] = app.uniqueSorted(bucket[microarea].quarteiroes, app.compareAreaCode);
    });

    return {
      microareas: microareas,
      quarteiroes: app.uniqueSorted(allQuarteiroes, app.compareAreaCode),
      byMicroarea: byMicroarea
    };
  };

  app.getSelectedProperty = function () {
    if (!app.state.selectedPropertyId) {
      return null;
    }
    return app.readProperties().find(function (property) {
      return property.uid === app.state.selectedPropertyId;
    }) || null;
  };

  app.getVisitsForProperty = function (property) {
    var key = app.addressKey(property || {});
    return app.readVisits().filter(function (visit) {
      return app.addressKey(visit) === key;
    }).sort(app.compareVisitDesc);
  };

  app.getTodayVisits = function () {
    var today = app.todayISO();
    return app.readVisits().filter(function (visit) { return visit.data === today; });
  };

  app.visitBelongsToAgent = function (visit, agent) {
    var row = visit || {};
    var person = agent || app.state.currentAgent || null;
    var visitCode = app.normalizeLabel(row.matricula || '');
    var visitName = app.normalizeLabel(row.agente || '');
    var agentCode = app.normalizeLabel(person && person.matricula ? person.matricula : '');
    var agentName = app.normalizeLabel(person && person.nome ? person.nome : '');
    return !!((agentCode && visitCode === agentCode) || (agentName && visitName === agentName));
  };

  app.getTodayVisitsForCurrentAgent = function () {
    var agent = app.state.currentAgent || null;
    var visits = app.getTodayVisits();
    if (!agent) {
      return visits;
    }
    return visits.filter(function (visit) {
      return app.visitBelongsToAgent(visit, agent);
    });
  };

  app.getTubitoRangeForVisit = function (visit, excludeUid) {
    var currentVisit = visit || {};
    var targetDate = String(currentVisit.data || app.todayISO()).trim();
    var currentQty = app.totalTubitosByDeposit(app.getTubitosByDeposit(currentVisit));
    var baseline = app.readVisits().filter(function (row) {
      return row && row.data === targetDate && (!excludeUid || row.uid !== excludeUid);
    }).reduce(function (sum, row) {
      return sum + app.totalTubitosByDeposit(app.getTubitosByDeposit(row));
    }, 0);
    var start = baseline + 1;
    var end = baseline + currentQty;
    var dateCode = app.formatTubitoCollectionDateCode(currentVisit.data || app.todayISO());
    var visitCode = app.buildVisitShortCode(currentVisit);

    if (currentQty <= 0) {
      return {
        start: start,
        end: baseline,
        count: 0,
        text: 'Sem numeração'
      };
    }

    return {
      start: start,
      end: end,
      count: currentQty,
      text: start === end
        ? (dateCode + '-' + String(start).padStart(3, '0') + '-' + visitCode)
        : (dateCode + '-' + String(start).padStart(3, '0') + '-' + visitCode + ' a ' + dateCode + '-' + String(end).padStart(3, '0') + '-' + visitCode)
    };
  };

  app.isApiConfigured = function () {
    var url = String(app.CONFIG.SHEETS_WEBAPP_URL || '').trim();
    return !!url && url !== 'COLE_AQUI_A_URL_DO_WEB_APP';
  };

  app.getCurrentApiSessionToken = function () {
    var current = app.state.currentAgent || app.readSession() || null;
    var token = String(current && (current.apiSessionToken || current.sessionToken || current.session_token) || '').trim();
    var expiresAt = String(current && (current.apiSessionExpiresAt || current.sessionExpiresAt || current.session_expires_at) || '').trim();
    var expiryMs;

    if (!token) {
      return '';
    }
    if (!expiresAt) {
      return token;
    }
    expiryMs = Date.parse(expiresAt);
    if (!isFinite(expiryMs)) {
      return token;
    }
    if (expiryMs <= Date.now() + 30000) {
      return '';
    }
    return token;
  };

  app.getCurrentApiSessionMeta = function () {
    var current = app.state.currentAgent || app.readSession() || null;
    var token = String(current && (current.apiSessionToken || current.sessionToken || current.session_token) || '').trim();
    var expiresAt = String(current && (current.apiSessionExpiresAt || current.sessionExpiresAt || current.session_expires_at) || '').trim();
    var expiryMs = expiresAt ? Date.parse(expiresAt) : NaN;
    var remainingMs = isFinite(expiryMs) ? Math.max(0, expiryMs - Date.now()) : 0;

    return {
      token: token,
      expiresAt: expiresAt,
      expiryMs: isFinite(expiryMs) ? expiryMs : 0,
      remainingMs: remainingMs,
      expired: !!token && !!expiresAt && isFinite(expiryMs) && expiryMs <= Date.now(),
      expiresSoon: !!token && (!!expiresAt && isFinite(expiryMs) && expiryMs <= Date.now() + (10 * 60 * 1000))
    };
  };

  app.applyApiSessionToAgentRecord = function (agent, sessionToken, sessionExpiresAt) {
    var normalizedAgent = app.normalizeAgent(agent || {});
    normalizedAgent.apiSessionToken = String(sessionToken || '').trim();
    normalizedAgent.apiSessionExpiresAt = String(sessionExpiresAt || '').trim();
    return normalizedAgent;
  };

  app.updateStoredAgentApiSession = function (agent, sessionToken, sessionExpiresAt) {
    var currentAgent = app.normalizeAgent(agent || app.state.currentAgent || app.readSession() || {});
    var nextAgent = app.applyApiSessionToAgentRecord(currentAgent, sessionToken, sessionExpiresAt);
    var agents = app.readAgents();
    var matched = false;

    agents = agents.map(function (row) {
      var sameUid = nextAgent.uid && row.uid === nextAgent.uid;
      var sameCpf = app.normalizeCpf(row.cpf || '') && app.normalizeCpf(row.cpf || '') === app.normalizeCpf(nextAgent.cpf || '');
      var sameMatricula = app.normalizeLabel(row.matricula || '') && app.normalizeLabel(row.matricula || '') === app.normalizeLabel(nextAgent.matricula || '');
      if (sameUid || sameCpf || sameMatricula) {
        matched = true;
        return Object.assign({}, row, {
          apiSessionToken: nextAgent.apiSessionToken,
          apiSessionExpiresAt: nextAgent.apiSessionExpiresAt
        });
      }
      return row;
    });

    if (!matched && nextAgent.uid) {
      agents.push(nextAgent);
    }
    app.saveAgents(agents.filter(function (row) { return !app.isRemovedAgent(row); }));
    if (app.state.currentAgent && (nextAgent.uid || nextAgent.cpf || nextAgent.matricula)) {
      app.state.currentAgent = Object.assign({}, app.state.currentAgent, {
        apiSessionToken: nextAgent.apiSessionToken,
        apiSessionExpiresAt: nextAgent.apiSessionExpiresAt
      });
    }
    if (app.readSession()) {
      app.saveSession(Object.assign({}, app.readSession() || {}, {
        apiSessionToken: nextAgent.apiSessionToken,
        apiSessionExpiresAt: nextAgent.apiSessionExpiresAt
      }));
    }
    return nextAgent;
  };

  app.setCurrentApiSession = function (sessionToken, sessionExpiresAt) {
    var currentAgent = app.state.currentAgent || app.readSession() || null;
    if (!currentAgent) {
      return null;
    }
    return app.updateStoredAgentApiSession(currentAgent, sessionToken, sessionExpiresAt);
  };

  app.clearCurrentApiSession = function () {
    var currentAgent = app.state.currentAgent || app.readSession() || null;
    if (!currentAgent) {
      return false;
    }
    app.updateStoredAgentApiSession(currentAgent, '', '');
    return true;
  };

  app.isOperationalAccessErrorMessage = function (message) {
    return /(sess[aã]o|login novamente|n[aã]o autorizado|não autorizado|nao autorizado|acesso operacional n[aã]o autorizado|autentica)/i.test(String(message || '').trim());
  };

  app.buildOperationalAuthQuery = function () {
    return '';
  };

  app.appendOperationalAuthToUrl = function (url) {
    return url;
  };

  app.buildLocalSnapshot = function (options) {
    var opts = options || {};
    var visits = Array.isArray(opts.visits)
      ? opts.visits
      : (opts.allAgents ? app.getTodayVisits() : app.getTodayVisitsForCurrentAgent());
    var properties = app.readProperties();
    var depositRanking = app.emptyDepositMap();
    var depositFocusRanking = app.emptyDepositMap();
    var gpsCount = 0;
    var focusVisits = 0;
    var focusCount = 0;
    var openedRaw = 0;
    var closedRaw = 0;
    var recovered = 0;
    var pending = 0;
    var tubitos = 0;
    var depositsTreated = 0;
    var bpiGrams = 0;

    visits.forEach(function (visit) {
      gpsCount += visit.gps ? 1 : 0;
      if (visit.focusFound === 'Sim') {
        focusVisits += 1;
      }
      focusCount += visit.focusQty;
      tubitos += visit.tubitosQty;
      depositsTreated += app.getVisitTreatedDepositCount(visit);
      bpiGrams += app.getVisitBpiGrams(visit);
      if (visit.situacao === 'Visitado') {
        openedRaw += 1;
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        closedRaw += 1;
      }
      if (visit.situacao === 'Recuperado') {
        recovered += 1;
      }
      Object.keys(app.DEPOSITS).forEach(function (code) {
        depositRanking[code] += Number(visit.depositCounts[code] || 0);
        depositFocusRanking[code] += Number(visit.depositFocusCounts[code] || 0);
      });
    });

    var deposits = app.totalFromMap(depositRanking);
    var depositsWithFocus = app.totalFromMap(depositFocusRanking);
    var opened = openedRaw + recovered;
    var closed = Math.max(0, closedRaw - recovered);
    var workedProperties = opened;
    var totalProperties = opened + closed;
    pending = closed;

    return {
      visits: visits,
      totals: {
        totalVisits: visits.length,
        visitedProperties: workedProperties,
        totalProperties: totalProperties,
        opened: opened,
        closed: closed,
        recovered: recovered,
        pending: pending,
        deposits: deposits,
        depositsWithFocus: depositsWithFocus,
        depositsEliminated: deposits,
        depositsTreated: depositsTreated,
        bpiGrams: bpiGrams,
        infestationRate: deposits ? Number(((depositsWithFocus / deposits) * 100).toFixed(1)) : 0,
        gpsCoverage: visits.length ? Math.round((gpsCount / visits.length) * 100) : 0,
        returns: pending,
        focusVisits: focusVisits,
        focusCount: focusCount,
        tubitos: tubitos
      },
      depositRanking: depositRanking,
      depositFocusRanking: depositFocusRanking
    };
  };

  app.runCaixaDAguaMigration = function () {
    var system = app.readSystemState();

    if (system.territoryStandardizationV1) {
      return { migrated: false, reason: 'already_applied' };
    }

    var agents = app.readAgents();
    var properties = app.readProperties();
    var visits = app.readVisits();
    var session = app.readSession();
    var lastArea = app.readLastArea();

    app.saveAgents(agents.map(function (agent) {
      var row = Object.assign({}, agent);
      row.baseMicroarea = app.normalizeMicroareaLabel(agent.baseMicroarea || '', agent.baseRegion || '');
      return row;
    }));

    app.saveProperties(properties);
    app.saveVisits(visits);

    if (session) {
      session.baseMicroarea = app.normalizeMicroareaLabel(session.baseMicroarea || '', session.baseRegion || '');
      app.saveSession(session);
    }

    app.saveLastArea(lastArea.microarea || '', lastArea.quarteirao || '');
    app.saveSystemState({
      territoryStandardizationV1: new Date().toISOString()
    });

    return {
      migrated: true,
      canonicalBairro: CANONICAL_TERRITORY.bairroLabel,
      canonicalMicroarea: CANONICAL_TERRITORY.microareaLabel,
      properties: properties.length,
      visits: visits.length
    };
  };

  app.runCaixaDAguaMigration();

}());
