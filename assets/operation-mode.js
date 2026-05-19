(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var STORAGE_KEY = 'ace_active_operation_plan_v1';
  var WORKDAY_STORAGE_KEY = 'ace_operation_workday_settings_v1';
  var DEFAULT_WORKDAY_SETTINGS = {
    VD: { start: '08:00', closeAfter: '15:00', allowEarlyWithJustification: true },
    PE: { start: '08:00', closeAfter: '13:00', allowEarlyWithJustification: true },
    LIRAA: { start: '08:00', closeAfter: '16:00', allowEarlyWithJustification: true }
  };
  var MODULE_VERSION = '20260517-tablet-v55-final';
  var PLAN_REFRESH_INTERVAL_MS = 60 * 1000;
  var PLAN_REFRESH_MIN_GAP_MS = 25 * 1000;
  var PLAN_OFFLINE_DATE_GRACE_MS = 36 * 60 * 60 * 1000;
  var refreshState = {
    inFlight: null,
    lastAttemptAt: 0,
    lastSuccessAt: 0
  };

  function getApp() {
    return root.ACSField || null;
  }

  function $(id) {
    return documentRef.getElementById(id);
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function escapeHtml(value) {
    return normalizeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCurrentAgentMatricula() {
    var app = getApp();
    return normalizeText(app && app.state && app.state.currentAgent && app.state.currentAgent.matricula).toUpperCase();
  }

  function todayISO() {
    var app = getApp();
    if (app && typeof app.todayISO === 'function') {
      return app.todayISO();
    }
    var date = new Date();
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function getPlanDate(plan) {
    plan = plan || {};
    return normalizeText(plan.data_operacao || plan.date || plan.data || plan.reference_date || '').slice(0, 10);
  }

  function isPlanForToday(plan) {
    var planDate = getPlanDate(plan);
    return !!planDate && planDate === todayISO();
  }

  function isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  function allowCachedPlanWithDateMismatch(raw, plan) {
    var savedAt = raw && raw.saved_at ? new Date(raw.saved_at).getTime() : 0;
    var now = Date.now();
    if (!plan || !isOffline() || !savedAt || Number.isNaN(savedAt)) {
      return false;
    }
    return Math.abs(now - savedAt) <= PLAN_OFFLINE_DATE_GRACE_MS;
  }

  function isVisitMarkedAsLiraa(visit) {
    var row = visit || {};
    var obs = normalizeText(row.obs || '');
    var coleta = normalizeText(row.liraaColeta || row.liraa_coleta || '').toLowerCase();
    return coleta === 'sim' || obs.indexOf('[LIRAa]') === 0 || normalizeMode(row.operationMode || row.operation_mode || '') === 'LIRAA';
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
      if (key === STORAGE_KEY) {
        if (!value) {
          root.localStorage.removeItem(key);
          return;
        }
        root.localStorage.setItem(key, JSON.stringify({
          __operationCache: true,
          agent_matricula: getCurrentAgentMatricula(),
          saved_at: new Date().toISOString(),
          plan: value
        }));
        return;
      }
      root.localStorage.setItem(key, JSON.stringify(value || null));
    } catch (error) {}
  }

  function clearStoredPlan() {
    writeJson(STORAGE_KEY, null);
  }

  function getStoredPlanIgnoringDate() {
    var raw = readJson(STORAGE_KEY, null);
    if (!raw) { return null; }
    return raw.__operationCache ? (raw.plan || null) : raw;
  }

  function recordPlanSync(status, message) {
    var app = getApp();
    if (!app || typeof app.saveSystemState !== 'function') { return; }
    var patch = {};
    if (status === 'ok') {
      patch.lastOperationPlanSyncAt = new Date().toISOString();
      patch.lastOperationPlanError = '';
    } else if (status === 'error') {
      patch.lastOperationPlanError = normalizeText(message || 'Falha ao atualizar plano operacional.');
    }
    app.saveSystemState(patch);
  }

  function applyRemotePayload(payload) {
    var data = payload && payload.data ? payload.data : payload;
    var plan = payload && payload.plan
      ? payload.plan
      : (data && data.plan ? data.plan : (data && data.operation_plan ? data.operation_plan : null));
    var responseDate = normalizeText((data && (data.date || data.data_operacao || data.data)) || '').slice(0, 10);
    var workday = (data && (data.workday_settings || data.workdaySettings)) ||
      (data && data.schedule && (data.schedule.workday_settings || data.schedule.workdaySettings)) ||
      (plan && (plan.workday_settings || plan.workdaySettings));

    if (payload && payload.ok === false) {
      throw new Error(payload.error || 'Resposta inválida da programação operacional.');
    }
    if (workday) {
      saveWorkdaySettings(workday);
    }
    if (payload && payload.active && plan) {
      plan.workday_settings = readWorkdaySettings();
      writeJson(STORAGE_KEY, plan);
      applyPlan(plan);
      recordPlanSync('ok');
      return plan;
    }
    if (payload && payload.active === false && (!responseDate || responseDate === todayISO())) {
      var storedPlanDate = getPlanDate(getStoredPlanIgnoringDate());
      if (storedPlanDate && responseDate && storedPlanDate !== responseDate) {
        recordPlanSync('error', 'Resposta sem operacao para outra data; plano local preservado.');
        applyPlan(getActivePlan());
        return getActivePlan();
      }
      clearStoredPlan();
      applyPlan(null);
      recordPlanSync('ok');
      return null;
    }
    applyPlan(getActivePlan());
    recordPlanSync('ok');
    return getActivePlan();
  }

  function normalizeMode(value) {
    var mode = normalizeText(value).toUpperCase();
    if (mode === 'PE' || mode === 'P.E.' || mode === 'PONTO_ESTRATEGICO') { return 'PE'; }
    if (mode === 'LIRAA' || mode === 'LIRA') { return 'LIRAA'; }
    return 'VD';
  }

  function modeLabel(value) {
    var mode = normalizeMode(value);
    if (mode === 'PE') { return 'P.E.'; }
    if (mode === 'LIRAA') { return 'LIRAa'; }
    return 'VD';
  }

  function normalizeTime(value, fallback) {
    var textValue = normalizeText(value || '').replace('.', ':');
    var match = textValue.match(/^(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) { return fallback || ''; }
    var hour = Math.max(0, Math.min(23, Number(match[1] || 0)));
    var minute = Math.max(0, Math.min(59, Number(match[2] || 0)));
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }

  function normalizeBoolean(value, fallback) {
    if (value === true || value === false) { return value; }
    var textValue = normalizeText(value).toLowerCase();
    if (['sim', 's', 'true', '1', 'yes'].indexOf(textValue) > -1) { return true; }
    if (['nao', 'não', 'n', 'false', '0', 'no'].indexOf(textValue) > -1) { return false; }
    return fallback !== false;
  }

  function normalizeWorkdaySettings(input) {
    var source = input && typeof input === 'object' ? input : {};
    var modes = ['VD', 'PE', 'LIRAA'];
    var out = {};
    modes.forEach(function (mode) {
      var def = DEFAULT_WORKDAY_SETTINGS[mode];
      var raw = source[mode] || source[mode.toLowerCase()] || {};
      out[mode] = {
        start: normalizeTime(raw.start || raw.inicio || raw.start_at || raw.inicio_previsto, def.start),
        closeAfter: normalizeTime(raw.closeAfter || raw.close_after || raw.encerrarApos || raw.encerrar_apos || raw.finish_after, def.closeAfter),
        allowEarlyWithJustification: normalizeBoolean(raw.allowEarlyWithJustification || raw.allow_early_with_justification || raw.permitir_antecipado_com_justificativa, def.allowEarlyWithJustification)
      };
    });
    return out;
  }

  function readWorkdaySettings() {
    return normalizeWorkdaySettings(readJson(WORKDAY_STORAGE_KEY, DEFAULT_WORKDAY_SETTINGS));
  }

  function saveWorkdaySettings(settings) {
    try {
      root.localStorage.setItem(WORKDAY_STORAGE_KEY, JSON.stringify(normalizeWorkdaySettings(settings)));
    } catch (error) {}
  }

  function timeToMinutes(value) {
    var clean = normalizeTime(value, '00:00');
    var parts = clean.split(':');
    return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
  }

  function nowMinutes() {
    var date = new Date();
    return date.getHours() * 60 + date.getMinutes();
  }

  function getCloseDayRule(mode) {
    var currentMode = normalizeMode(mode || getCurrentMode());
    var settings = readWorkdaySettings();
    var rule = settings[currentMode] || DEFAULT_WORKDAY_SETTINGS[currentMode] || DEFAULT_WORKDAY_SETTINGS.VD;
    return {
      mode: currentMode,
      label: modeLabel(currentMode),
      start: normalizeTime(rule.start, DEFAULT_WORKDAY_SETTINGS[currentMode].start),
      closeAfter: normalizeTime(rule.closeAfter, DEFAULT_WORKDAY_SETTINGS[currentMode].closeAfter),
      allowEarlyWithJustification: normalizeBoolean(rule.allowEarlyWithJustification, true)
    };
  }

  function evaluateCloseDayPolicy(mode) {
    var rule = getCloseDayRule(mode);
    return {
      allowed: true,
      requiresJustification: false,
      blocked: false,
      mode: rule.mode,
      label: rule.label,
      closeAfter: '',
      start: rule.start,
      message: 'Encerramento liberado para ' + rule.label + '.'
    };
  }

  function operationTitle(plan, mode) {
    plan = plan || {};
    mode = normalizeMode(mode || plan.mode || plan.tipo_operacao);
    if (mode === 'PE') {
      var pe = plan.pe || {};
      return 'P.E. — ' + normalizeText(pe.nome_local || pe.nomeLocal || plan.pe_nome_local || pe.tipo_local || plan.pe_tipo_local || plan.title || plan.titulo || 'Ponto estratégico');
    }
    if (mode === 'LIRAA') {
      return 'LIRAa — ' + normalizeText(plan.cycle || plan.ciclo || plan.title || plan.titulo || 'Levantamento amostral');
    }
    return 'VD — ' + normalizeText(plan.title || plan.titulo || plan.cycle || plan.ciclo || 'Visita domiciliar');
  }

  function splitTerritoryList(value) {
    if (Array.isArray(value)) {
      return value.map(normalizeText).filter(Boolean);
    }
    return String(value || '').split(/[;,|\n]/).map(normalizeText).filter(Boolean);
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

  function normalizeQuarter(value) {
    return normalizeText(value)
      .replace(/^q\s*[-/]?\s*/i, '')
      .replace(/^0+(\d)/, '$1')
      .trim();
  }

  function makeTerritoryUnitKey(microarea, quarteirao) {
    return normalizeTerritoryKey(microarea) + '|' + normalizeQuarter(quarteirao || 'Distrito');
  }

  function normalizeOperationUnit(row) {
    row = row || {};
    var microarea = normalizeText(row.microarea || row.territory || row.area || row.bairro || '');
    var quarteirao = normalizeQuarter(row.quarteirao || row.quarter || row.block || '');
    if (!microarea || !quarteirao) {
      return null;
    }
    return {
      key: row.key || makeTerritoryUnitKey(microarea, quarteirao),
      microarea: microarea,
      quarteirao: quarteirao
    };
  }

  function parseOperationUnits(value) {
    var rows = [];
    if (Array.isArray(value)) {
      rows = value;
    } else {
      var raw = normalizeText(value);
      if (!raw) {
        return [];
      }
      if (raw.charAt(0) === '[') {
        try {
          rows = JSON.parse(raw);
        } catch (error) {
          rows = [];
        }
      } else {
        rows = raw.split('|').map(function (item) {
          var parts = item.split('::');
          return {
            microarea: normalizeText(parts[0]),
            quarteirao: normalizeQuarter(parts.slice(1).join('::'))
          };
        });
      }
    }
    return rows.map(normalizeOperationUnit).filter(Boolean);
  }

  function uniqueList(values) {
    var seen = {};
    return values.map(normalizeText).filter(function (item) {
      var key = normalizeKey(item);
      if (!key || seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
  }

  function operationUnitSummary(units) {
    if (!units || !units.length) {
      return '';
    }
    var byArea = {};
    units.forEach(function (unit) {
      if (!byArea[unit.microarea]) {
        byArea[unit.microarea] = [];
      }
      byArea[unit.microarea].push(unit.quarteirao);
    });
    return Object.keys(byArea).sort(function (a, b) {
      return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
    }).map(function (area) {
      return area + ': Q ' + byArea[area].join(', Q ');
    }).join(' • ');
  }

  function buildSafeLegacyUnits(plan) {
    plan = plan || {};
    var microareas = splitTerritoryList(plan.operation_microareas || plan.microareas || plan.vd_microareas || '');
    var quarteiroes = splitTerritoryList(plan.operation_quarteiroes || plan.quarteiroes || plan.vd_quarteiroes || '').map(normalizeQuarter).filter(Boolean);
    var rows = [];
    if (microareas.length === 1 && quarteiroes.length) {
      rows = quarteiroes.map(function (quarter) {
        return { microarea: microareas[0], quarteirao: quarter };
      });
    } else if (microareas.length && microareas.length === quarteiroes.length) {
      rows = microareas.map(function (microarea, index) {
        return { microarea: microarea, quarteirao: quarteiroes[index] };
      });
    }
    return parseOperationUnits(rows);
  }

  function buildBlockedRestriction(message) {
    return {
      units: [],
      unitKeys: [],
      microareas: [],
      quarteiroes: [],
      blocked: true,
      missingUnits: true,
      label: message || 'Plano operacional sem pares microarea + quarteirao validos. Sincronize com internet ou acione a coordenacao.'
    };
  }

  function getTerritoryRestriction(plan) {
    plan = plan || getActivePlan();
    if (!plan) {
      return buildBlockedRestriction('Nenhuma operacao foi liberada para sua matricula hoje. Conecte com internet para preparar o tablet; se a mensagem continuar, fale com a coordenacao para liberar o plano no painel de Operacoes.');
    }
    var lock = String(plan.territory_lock == null ? 'Sim' : plan.territory_lock).toLowerCase();
    if (lock === 'nao' || lock === 'não' || lock === 'false' || lock === '0') {
      return buildBlockedRestriction('Plano operacional sem trava territorial. A lista de imoveis foi bloqueada para evitar area errada.');
    }

    var units = parseOperationUnits(plan.operation_units || plan.operationUnits || plan.territory_units || plan.territoryUnits || '');
    if (!units.length && Array.isArray(plan.selected)) {
      units = parseOperationUnits(plan.selected);
    }
    if (!units.length && String(plan.allow_legacy_units || '').trim() === '1') {
      units = buildSafeLegacyUnits(plan);
    }
    if (!units.length) {
      return buildBlockedRestriction();
    }

    var microareas = uniqueList(units.map(function (unit) { return unit.microarea; }));
    var quarteiroes = uniqueList(units.map(function (unit) { return unit.quarteirao; }));

    return {
      units: units,
      unitKeys: units.map(function (unit) { return makeTerritoryUnitKey(unit.microarea, unit.quarteirao); }),
      microareas: microareas,
      quarteiroes: quarteiroes,
      label: units.length
        ? operationUnitSummary(units)
        : [microareas.length ? ('MA ' + microareas.join(', ')) : '', quarteiroes.length ? ('Q ' + quarteiroes.join(', ')) : ''].filter(Boolean).join(' • ')
    };
  }
  function getApiUrl() {
    var runtime = root.ACS_RUNTIME_CONFIG || {};
    return normalizeText(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '');
  }

  function isApiConfigured() {
    var url = getApiUrl();
    return !!url && /^https?:\/\//i.test(url) && url.indexOf('COLE_AQUI') === -1;
  }

  function fetchOperationPlan(options) {
    var app = getApp();
    var opts = options || {};
    var localPlan;
    var now = Date.now();

    if (!app || !app.state || !app.state.currentAgent) {
      refreshUi();
      return Promise.resolve(null);
    }

    localPlan = getActivePlan();

    if (refreshState.inFlight) {
      return refreshState.inFlight;
    }

    if (!opts.force && localPlan && refreshState.lastAttemptAt && now - refreshState.lastAttemptAt < PLAN_REFRESH_MIN_GAP_MS) {
      applyPlan(localPlan);
      return Promise.resolve(localPlan);
    }

    refreshState.lastAttemptAt = now;

    if (!isApiConfigured() || isOffline()) {
      applyPlan(localPlan);
      return Promise.resolve(localPlan);
    }

    refreshState.inFlight = Promise.resolve(
      app && typeof app.refreshOperationalSessionIfNeeded === 'function'
        ? app.refreshOperationalSessionIfNeeded('operation-plan')
        : true
    ).then(function (hasAccess) {
      if (!hasAccess && !(app && app.CONFIG && app.CONFIG.API_TOKEN)) {
        applyPlan(localPlan);
        return localPlan;
      }
      if (!app || typeof app.fetchOperationalJson !== 'function') {
        applyPlan(localPlan);
        return localPlan;
      }
      return app.fetchOperationalJson('operation_plan', {
        matricula: app.state.currentAgent.matricula || '',
        date: todayISO()
      }, 12000).then(function (payload) {
        refreshState.lastSuccessAt = Date.now();
        return applyRemotePayload(payload);
      }).catch(function (error) {
        recordPlanSync('error', error && error.message ? error.message : 'Falha ao atualizar plano operacional.');
        applyPlan(getActivePlan());
        return getActivePlan();
      });
    }).then(function (plan) {
      refreshState.inFlight = null;
      return plan;
    }).catch(function (error) {
      refreshState.inFlight = null;
      recordPlanSync('error', error && error.message ? error.message : 'Falha ao atualizar plano operacional.');
      applyPlan(getActivePlan());
      return getActivePlan();
    });

    return refreshState.inFlight;
  }

  function getActivePlan() {
    var raw = readJson(STORAGE_KEY, null);
    var currentMatricula = getCurrentAgentMatricula();
    var plan;
    if (!raw) { return null; }
    if (raw.__operationCache) {
      if (!raw.agent_matricula || !currentMatricula || raw.agent_matricula !== currentMatricula) {
        return null;
      }
      plan = raw.plan || null;
      if (!isPlanForToday(plan)) {
        if (allowCachedPlanWithDateMismatch(raw, plan)) {
          recordPlanSync('error', 'Data do tablet diferente do plano salvo; usando plano local recente enquanto estiver offline.');
          return plan;
        }
        // Preserva o plano local: data/fuso incorreto do tablet não deve apagar a operação já preparada.
        return null;
      }
      return plan;
    }
    // Segurança: caches antigos, sem matrícula/data do agente, não liberam modo especial.
    return null;
  }

  function agentApplies(plan) {
    var app = getApp();
    if (!plan || !Array.isArray(plan.agents) || !plan.agents.length) { return false; }
    var matricula = normalizeText(app && app.state && app.state.currentAgent && app.state.currentAgent.matricula).toUpperCase();
    if (!matricula) { return false; }
    return plan.agents.map(function (agentMatricula) {
      return normalizeText(agentMatricula).toUpperCase();
    }).indexOf(matricula) > -1;
  }

  function getCurrentMode() {
    var plan = getActivePlan();
    if (!plan || !agentApplies(plan)) { return 'VD'; }
    return normalizeMode(plan.mode);
  }

  function ensureStyles() {
    if ($('operationModeStyles')) { return; }
    var style = documentRef.createElement('style');
    style.id = 'operationModeStyles';
    style.textContent = [
      '.operation-mode-badge{display:inline-flex;align-items:center;gap:6px;border:1px solid #cfe0d6;background:#f8fcf9;color:#183c2c;border-radius:999px;padding:6px 10px;font-weight:900;font-size:.78rem}',
      '.operation-mode-badge strong{font-size:.82rem}',
      '.operation-mode-badge.is-pe{background:#fff7ed;border-color:#fed7aa;color:#9a3412}',
      '.operation-mode-badge.is-liraa{background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a}',
      '.operation-day-banner{margin:10px 14px 0;border:1px solid #cfe0d6;border-left:6px solid #1f7a4d;background:#f8fcf9;border-radius:16px;padding:11px 14px;color:#183c2c;box-shadow:0 8px 22px rgba(15,72,43,.06)}',
      '.operation-day-banner strong{display:block;font-size:.96rem}.operation-day-banner span{display:block;margin-top:3px;color:#52615a;font-size:.84rem;font-weight:800}',
      '.operation-day-banner.is-pe{border-color:#fed7aa;border-left-color:#c56d18;background:#fff7ed;color:#7c2d12}',
      '.operation-day-banner.is-liraa{border-color:#bfdbfe;border-left-color:#2563eb;background:#eff6ff;color:#1e3a8a}',
      '.pe-visit-panel{margin-top:16px;border:1px solid #fed7aa;background:#fff7ed;border-radius:18px;padding:14px}',
      '.pe-visit-panel h3{margin:0 0 8px;color:#9a3412;font-size:1rem}',
      '.pe-visit-panel p{margin:0 0 12px;color:#7c2d12;font-weight:700}',
      '.pe-visit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
      '@media(max-width:760px){.pe-visit-grid{grid-template-columns:1fr}}'
    ].join('');
    documentRef.head.appendChild(style);
  }

  function ensureBadge() {
    if ($('operationModeBadge')) { return; }
    var target = $('syncChip') || documentRef.querySelector('.topbar-actions');
    if (!target || !target.parentNode) { return; }
    var badge = documentRef.createElement('div');
    badge.id = 'operationModeBadge';
    badge.className = 'operation-mode-badge';
    badge.innerHTML = '<span>Modo</span><strong>VD</strong>';
    target.parentNode.insertBefore(badge, target);
  }

  function ensureOperationBanner() {
    var banner = $('operationDayBanner');
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }
  function ensurePePanel() {
    if ($('peVisitPanel')) { return; }
    var anchor = $('visitClosedReasonWrap') || $('situacaoChoices');
    if (!anchor || !anchor.parentNode) { return; }
    var panel = documentRef.createElement('div');
    panel.id = 'peVisitPanel';
    panel.className = 'pe-visit-panel';
    panel.hidden = true;
    panel.innerHTML = [
      '<h3>Ponto Estratégico (P.E.)</h3>',
      '<p>Use para ferro velho, borracharia, fábrica, fundição, depósito, pátio e outros locais com risco estratégico.</p>',
      '<div class="pe-visit-grid">',
      '<div class="field"><label for="peTipoLocal">Tipo do P.E.</label><select id="peTipoLocal"><option value="">Selecione</option><option>Ferro velho</option><option>Borracharia</option><option>Depósito</option><option>Fábrica</option><option>Fundição</option><option>Oficina</option><option>Pátio/garagem</option><option>Outro ponto estratégico</option></select></div>',
      '<div class="field"><label for="peNomeLocal">Nome ou referência do P.E.</label><input id="peNomeLocal" type="text" placeholder="Ex.: Ferro velho do bairro, Fundição X"></div>',
      '</div>',
      '<div class="field" style="margin-top:12px"><label for="peObservacao">Observação do P.E.</label><textarea id="peObservacao" placeholder="Detalhe o local, setor, responsável, área de risco ou necessidade de retorno."></textarea></div>'
    ].join('');
    anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    ['peTipoLocal', 'peNomeLocal', 'peObservacao'].forEach(function (id) {
      var el = $(id);
      if (!el) { return; }
      el.addEventListener('input', syncPeFieldsFromUi);
      el.addEventListener('change', syncPeFieldsFromUi);
    });
  }

  function syncPeFieldsFromUi() {
    var app = getApp();
    if (!app || !app.state || !app.state.visit) { return; }
    app.state.visit.peTipoLocal = $('peTipoLocal') ? $('peTipoLocal').value : '';
    app.state.visit.peNomeLocal = $('peNomeLocal') ? $('peNomeLocal').value : '';
    app.state.visit.peObservacao = $('peObservacao') ? $('peObservacao').value : '';
  }

  function applyModeToVisit() {
    var app = getApp();
    var plan = getActivePlan();
    var mode = getCurrentMode();
    if (!app || !app.state || !app.state.visit) { return; }

    if (isVisitMarkedAsLiraa(app.state.visit)) {
      mode = 'LIRAA';
    }

    mode = normalizeMode(mode || 'VD');
    app.state.visit.operationMode = mode;

    if (mode === 'PE') {
      app.state.visit.peTipoLocal = app.state.visit.peTipoLocal || (plan && plan.pe && plan.pe.tipo_local) || '';
      app.state.visit.peNomeLocal = app.state.visit.peNomeLocal || (plan && plan.pe && plan.pe.nome_local) || '';
      app.state.visit.peObservacao = app.state.visit.peObservacao || (plan && plan.pe && plan.pe.observacao) || '';
    } else {
      app.state.visit.peTipoLocal = '';
      app.state.visit.peNomeLocal = '';
      app.state.visit.peObservacao = '';
    }

    var restriction = getTerritoryRestriction(plan);
    if (restriction) {
      app.state.visit.operationMicroareas = restriction.microareas.join('|');
      app.state.visit.operationQuarteiroes = restriction.quarteiroes.join('|');
      app.state.visit.operationUnits = JSON.stringify(restriction.units || []);
    } else {
      app.state.visit.operationMicroareas = '';
      app.state.visit.operationQuarteiroes = '';
      app.state.visit.operationUnits = '';
    }

    if (mode === 'LIRAA') {
      app.state.visit.liraaCiclo = app.state.visit.liraaCiclo || (plan && plan.cycle) || '';
      app.state.visit.liraaPlanoId = app.state.visit.liraaPlanoId || (plan && plan.liraa_plan_id) || '';
      app.state.visit.liraaColeta = 'Sim';
    } else {
      app.state.visit.liraaCiclo = '';
      app.state.visit.liraaPlanoId = '';
      app.state.visit.liraaQuarteiraoSorteado = '';
      app.state.visit.liraaUnitKey = '';
      app.state.visit.liraaColeta = '';
    }
  }

  function dispatchOperationModeChange(mode, plan) {
    try {
      var event;

      if (typeof root.CustomEvent === 'function') {
        event = new CustomEvent('ace-operation-mode-change', {
          detail: {
            mode: mode,
            plan: plan || null
          }
        });
      } else {
        event = documentRef.createEvent('CustomEvent');
        event.initCustomEvent('ace-operation-mode-change', false, false, {
          mode: mode,
          plan: plan || null
        });
      }

      root.dispatchEvent(event);
    } catch (error) {}
  }

  function refreshUi() {
    ensureStyles();
    ensureBadge();
    ensureOperationBanner();
    ensurePePanel();
    var app = getApp();
    var plan = getActivePlan();
    var mode = getCurrentMode();
    var badge = $('operationModeBadge');
    var label = mode === 'PE' ? 'P.E.' : (mode === 'LIRAA' ? 'LIRAa' : 'VD');
    if (badge) {
      badge.className = 'operation-mode-badge ' + (mode === 'PE' ? 'is-pe' : (mode === 'LIRAA' ? 'is-liraa' : ''));
      badge.innerHTML = '<span>Modo</span><strong>' + escapeHtml(label) + '</strong>';
      var closeRule = getCloseDayRule(mode);
      badge.title = (plan && plan.description ? plan.description + ' • ' : '') + 'Encerramento após ' + closeRule.closeAfter;
    }
    var banner = $('operationDayBanner');
    if (banner) {
      banner.hidden = true;
      banner.innerHTML = '';
    }
    var subtitle = $('headerSubtitle');
    if (subtitle) {
      subtitle.textContent = 'Sistema local pronto para uso em campo';
    }
    var panel = $('peVisitPanel');
    if (panel) {
      panel.hidden = mode !== 'PE';
    }
    applyModeToVisit();
    if ($('peTipoLocal') && app && app.state && app.state.visit) {
      $('peTipoLocal').value = app.state.visit.peTipoLocal || '';
      $('peNomeLocal').value = app.state.visit.peNomeLocal || '';
      $('peObservacao').value = app.state.visit.peObservacao || '';
    }
    dispatchOperationModeChange(mode, plan);
  }

  function applyPlan(plan) {
    if (plan && typeof plan === 'object') {
      if (plan.workday_settings || plan.workdaySettings) {
        saveWorkdaySettings(plan.workday_settings || plan.workdaySettings);
      }
      writeJson(STORAGE_KEY, plan);
    }
    refreshUi();
  }

  function hookApp() {
    var app = getApp();
    if (!app || app.__operationModeHooked) { return !!app; }
    app.__operationModeHooked = true;

    var originalEnterApp = app.enterApp;
    if (typeof originalEnterApp === 'function') {
      app.enterApp = function () {
        var result = originalEnterApp.apply(app, arguments);
        refreshUi();
        fetchOperationPlan();
        return result;
      };
    }

    var originalReset = app.resetVisitForm;
    if (typeof originalReset === 'function') {
      app.resetVisitForm = function () {
        var result = originalReset.apply(app, arguments);
        applyModeToVisit();
        refreshUi();
        return result;
      };
    }

    var originalUpdate = app.updateVisitFormFromState;
    if (typeof originalUpdate === 'function') {
      app.updateVisitFormFromState = function () {
        var result = originalUpdate.apply(app, arguments);
        refreshUi();
        return result;
      };
    }

    var originalShow = app.showScreen;
    if (typeof originalShow === 'function') {
      app.showScreen = function () {
        var result = originalShow.apply(app, arguments);
        refreshUi();
        return result;
      };
    }

    var originalMarkDayClosed = app.markDayClosed;
    if (typeof originalMarkDayClosed === 'function') {
      app.markDayClosed = function () {
        var result = originalMarkDayClosed.apply(app, arguments);
        clearStoredPlan();
        refreshUi();
        return result;
      };
    }

    setInterval(function () {
      if (!isOffline()) {
        fetchOperationPlan({ force: true });
      }
    }, PLAN_REFRESH_INTERVAL_MS);

    root.addEventListener('online', function () {
      fetchOperationPlan({ force: true }).then(function () {
        var appOnline = getApp();
        if (appOnline && typeof appOnline.renderAll === 'function') {
          appOnline.renderAll();
        }
        if (appOnline && typeof appOnline.renderOfflineReadinessCard === 'function') {
          appOnline.renderOfflineReadinessCard();
        }
      });
    });

    documentRef.addEventListener('visibilitychange', function () {
      if (!documentRef.hidden && !isOffline()) {
        fetchOperationPlan({ force: true });
      }
    });

    refreshUi();
    fetchOperationPlan({ force: true });
    return true;
  }

  function boot() {
    ensureStyles();
    ensureBadge();
    ensureOperationBanner();
    ensurePePanel();
    if (!hookApp()) {
      setTimeout(boot, 500);
      return;
    }
    refreshUi();
  }

  function isCurrentAgentAssignedToLiraa() {
    var plan = getActivePlan();
    return !!(plan && agentApplies(plan) && normalizeMode(plan.mode) === 'LIRAA');
  }

  root.ACEOperationMode = {
    version: MODULE_VERSION,
    getCurrentMode: getCurrentMode,
    getActivePlan: getActivePlan,
    getTerritoryRestriction: getTerritoryRestriction,
    makeTerritoryUnitKey: makeTerritoryUnitKey,
    getWorkdaySettings: readWorkdaySettings,
    getCloseDayRule: getCloseDayRule,
    evaluateCloseDayPolicy: evaluateCloseDayPolicy,
    isCurrentAgentAssignedToLiraa: isCurrentAgentAssignedToLiraa,
    applyPlan: applyPlan,
    applyRemotePayload: applyRemotePayload,
    refresh: fetchOperationPlan
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
