(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var VERSION = '20260430-painel-executivo-unificado1';
  var VISITS_KEY = 'dengue_db_visits_v1';
  var PROPERTIES_KEY = 'dengue_db_properties_v1';
  var TUBITOS_KEY = 'dengue_db_tubitos_v1';
  var AUDIT_KEY = 'ace_panel_executivo_audit_v1';

  var state = {
    schedule: null,
    scheduleLoadedAt: 0,
    historyQuery: '',
    presentationMode: false
  };
  var historySearchTimer = null;

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

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function number(value) {
    var n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeKey(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

  function getBundle() {
    if (root.ACE_PANEL_CLOUD_BUNDLE && root.ACE_PANEL_CLOUD_BUNDLE.ok) {
      return root.ACE_PANEL_CLOUD_BUNDLE;
    }
    if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getBundle === 'function') {
      return root.ACEPanelCloudSync.getBundle() || {};
    }
    return {};
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
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function normalizeDate(value) {
    var raw = text(value);
    var match;
    if (!raw) {
      return '';
    }
    match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return match[1] + '-' + match[2] + '-' + match[3];
    }
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return match[3] + '-' + match[2] + '-' + match[1];
    }
    return raw.slice(0, 10);
  }

  function formatDateBR(value) {
    var date = normalizeDate(value);
    var p = date.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (date || '-');
  }

  function formatDateTime(value) {
    var d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) {
      return '-';
    }
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function modeOf(value) {
    var mode = text(value).toUpperCase();
    if (mode === 'P.E.' || mode === 'PONTO ESTRATEGICO' || mode === 'PONTO_ESTRATEGICO') {
      return 'PE';
    }
    if (mode === 'LIRA' || mode === 'LIRAA') {
      return 'LIRAA';
    }
    if (mode === 'PE') {
      return 'PE';
    }
    return 'VD';
  }

  function modeLabel(mode) {
    mode = modeOf(mode);
    if (mode === 'PE') {
      return 'P.E.';
    }
    if (mode === 'LIRAA') {
      return 'LIRAa';
    }
    return 'VD';
  }

  function normalizeVisit(row) {
    row = row || {};
    return {
      uid: text(row.uid),
      data: normalizeDate(row.data || row.date),
      hora: text(row.hora || row.time),
      agente: text(row.agente || row.agent || row.agent_name),
      matricula: text(row.matricula || row.agent_matricula),
      bairro: text(row.bairro),
      microarea: text(row.microarea),
      quarteirao: text(row.quarteirao),
      logradouro: text(row.logradouro),
      numero: text(row.numero),
      tipo: text(row.tipo),
      situacao: text(row.situacao || row.status),
      propertyUid: text(row.property_uid || row.propertyUid),
      depositCount: number(row.deposit_count || row.depositCount),
      depositFocusCount: number(row.deposit_focus_count || row.depositFocusCount),
      focusCount: number(row.focus_count || row.focusCount),
      tubitosQty: number(row.tubitos_qtd || row.tubitosQty),
      foco: text(row.foco),
      tubitosDeposito: text(row.tubitos_deposito || row.tubitosDeposito),
      depositFocusBreakdown: text(row.deposit_focus_breakdown || row.depositFocusBreakdown),
      waterAccess: text(row.acessou_caixa_agua || row.waterAccess),
      labStatus: text(row.laboratorio_status || row.laboratorioStatus),
      labResult: text(row.laboratorio_resultado || row.laboratorioResultado),
      labPositiveAedes: text(row.laboratorio_positivo_aedes || row.laboratorioPositivoAedes),
      operationMode: modeOf(row.operation_mode || row.operational_mode || row.operationMode || row.origem_visita),
      peTipoLocal: text(row.pe_tipo_local || row.peTipoLocal),
      peNomeLocal: text(row.pe_nome_local || row.peNomeLocal),
      liraaCiclo: text(row.liraa_ciclo || row.liraaCiclo),
      gpsLat: text(row.gps_lat || row.gpsLat),
      gpsLng: text(row.gps_lng || row.gpsLng),
      updatedAt: text(row.updatedAt || row.updated_at)
    };
  }

  function normalizeProperty(row) {
    row = row || {};
    return {
      uid: text(row.uid),
      bairro: text(row.bairro),
      microarea: text(row.microarea),
      quarteirao: text(row.quarteirao),
      logradouro: text(row.logradouro),
      numero: text(row.numero),
      tipo: text(row.tipo),
      complemento: text(row.complemento),
      lastVisitAt: normalizeDate(row.last_visit_at || row.lastVisitAt),
      updatedAt: text(row.updatedAt || row.updated_at)
    };
  }

  function normalizeTubito(row) {
    row = row || {};
    return {
      uid: text(row.uid),
      numeroTubito: text(row.numero_tubito || row.numeroTubito),
      visitUid: text(row.visit_uid || row.visitUid),
      propertyUid: text(row.property_uid || row.propertyUid),
      dataColeta: normalizeDate(row.data_coleta || row.dataColeta),
      agente: text(row.agente),
      bairro: text(row.bairro),
      microarea: text(row.microarea),
      quarteirao: text(row.quarteirao),
      logradouro: text(row.logradouro),
      numero: text(row.numero),
      depositoCodigo: text(row.deposito_codigo || row.depositoCodigo),
      operationMode: modeOf(row.operation_mode || row.origem_visita || row.operationMode),
      status: text(row.status_laboratorio || row.statusLaboratorio || 'Pendente'),
      resultado: text(row.resultado_laboratorio || row.resultadoLaboratorio),
      especie: text(row.especie),
      positivoAedes: text(row.positivo_aedes || row.positivoAedes),
      analisadoEm: text(row.analisado_em || row.analisadoEm),
      updatedAt: text(row.updatedAt || row.updated_at)
    };
  }

  function normalizeAgent(row) {
    row = row || {};
    return {
      uid: text(row.uid),
      nome: text(row.nome || row.name),
      matricula: text(row.matricula),
      role: text(row.role || 'ACE')
    };
  }

  function normalizeAttendanceSummary(raw) {
    raw = raw || {};
    return {
      month: text(raw.month),
      businessDays: Array.isArray(raw.businessDays) ? raw.businessDays : [],
      totals: raw.totals || {},
      rows: (Array.isArray(raw.rows) ? raw.rows : []).map(function (row) {
        return {
          nome: text(row.nome || row.name),
          matricula: text(row.matricula),
          role: text(row.role || 'ACE'),
          loggedDays: number(row.loggedDays || row.logged_days),
          missingDays: number(row.missingDays || row.missing_days),
          businessDays: number(row.businessDays || row.business_days),
          lastLoginAt: text(row.lastLoginAt || row.last_login_at),
          loggedDates: Array.isArray(row.loggedDates) ? row.loggedDates : [],
          missingDates: Array.isArray(row.missingDates) ? row.missingDates : []
        };
      })
    };
  }

  function getData() {
    var bundle = getBundle();
    return {
      visits: (Array.isArray(bundle.visits) ? bundle.visits : readJson(VISITS_KEY, [])).map(normalizeVisit),
      properties: (Array.isArray(bundle.properties) ? bundle.properties : readJson(PROPERTIES_KEY, [])).map(normalizeProperty),
      tubitos: (Array.isArray(bundle.tubitos) ? bundle.tubitos : readJson(TUBITOS_KEY, [])).map(normalizeTubito),
      agents: (Array.isArray(bundle.agents) ? bundle.agents : []).map(normalizeAgent),
      attendance: normalizeAttendanceSummary(bundle.attendance || bundle.attendanceSummary),
      generatedAt: bundle.generatedAt || ''
    };
  }

  function hasFocus(visit) {
    return normalizeKey(visit.foco) === 'sim' ||
      number(visit.focusCount) > 0 ||
      number(visit.depositFocusCount) > 0;
  }

  function hasGps(visit) {
    return !!(text(visit.gpsLat) && text(visit.gpsLng));
  }

  function propertyKeyFromVisit(visit) {
    return text(visit.propertyUid) || [
      normalizeKey(visit.bairro),
      normalizeKey(visit.logradouro),
      normalizeKey(visit.numero)
    ].join('|');
  }

  function addressFromVisit(visit) {
    return [visit.logradouro, visit.numero].filter(Boolean).join(', ') +
      (visit.bairro ? ' - ' + visit.bairro : '');
  }

  function addressFromProperty(property) {
    return [property.logradouro, property.numero].filter(Boolean).join(', ') +
      (property.bairro ? ' - ' + property.bairro : '');
  }

  function uniqueCount(list, getter) {
    var map = {};
    (list || []).forEach(function (item) {
      var key = getter(item);
      if (key) {
        map[key] = true;
      }
    });
    return Object.keys(map).length;
  }

  function getDateRange() {
    var today = todayLocal();
    return {
      start: $('dateStart') && $('dateStart').value ? $('dateStart').value : today,
      end: $('dateEnd') && $('dateEnd').value ? $('dateEnd').value : today
    };
  }

  function currentFilters() {
    return {
      range: getDateRange(),
      agent: $('agentFilter') ? normalizeKey($('agentFilter').value) : '',
      bairro: $('bairroFilter') ? normalizeKey($('bairroFilter').value) : '',
      microarea: $('microareaFilter') ? normalizeKey($('microareaFilter').value) : '',
      quarteirao: $('quarteiraoFilter') ? normalizeKey($('quarteiraoFilter').value) : '',
      logradouro: $('logradouroFilter') ? normalizeKey($('logradouroFilter').value) : '',
      situacao: $('situacaoFilter') ? text($('situacaoFilter').value) : '',
      operation: $('operationFilter') ? modeOf($('operationFilter').value) : '',
      operationRaw: $('operationFilter') ? text($('operationFilter').value) : '',
      foco: $('focoFilter') ? text($('focoFilter').value) : '',
      gps: $('gpsFilter') ? text($('gpsFilter').value) : '',
      search: $('searchFilter') ? normalizeKey($('searchFilter').value) : ''
    };
  }

  function visitMatchesFilters(visit, filters) {
    var date = visit.data || '';
    var searchText;

    if (filters.range.start && date && date < filters.range.start) {
      return false;
    }
    if (filters.range.end && date && date > filters.range.end) {
      return false;
    }
    if (filters.agent && normalizeKey(visit.agente + ' ' + visit.matricula) !== filters.agent && normalizeKey(visit.agente + ' ' + visit.matricula).indexOf(filters.agent) === -1) {
      return false;
    }
    if (filters.bairro && normalizeKey(visit.bairro) !== filters.bairro) {
      return false;
    }
    if (filters.microarea && normalizeKey(visit.microarea) !== filters.microarea) {
      return false;
    }
    if (filters.quarteirao && normalizeKey(visit.quarteirao) !== filters.quarteirao) {
      return false;
    }
    if (filters.logradouro && normalizeKey(visit.logradouro) !== filters.logradouro) {
      return false;
    }
    if (filters.situacao && visit.situacao !== filters.situacao && !(filters.situacao === 'Fechado' && (visit.situacao === 'Recusa' || visit.situacao === 'Fechado'))) {
      return false;
    }
    if (filters.operationRaw && visit.operationMode !== filters.operation) {
      return false;
    }
    if (filters.foco === 'com_foco' && !hasFocus(visit)) {
      return false;
    }
    if (filters.foco === 'sem_foco' && hasFocus(visit)) {
      return false;
    }
    if (filters.gps === 'com_gps' && !hasGps(visit)) {
      return false;
    }
    if (filters.gps === 'sem_gps' && hasGps(visit)) {
      return false;
    }
    if (filters.search) {
      searchText = normalizeKey([
        visit.agente,
        visit.matricula,
        visit.bairro,
        visit.microarea,
        visit.quarteirao,
        visit.logradouro,
        visit.numero,
        visit.situacao,
        visit.peNomeLocal,
        visit.liraaCiclo
      ].join(' '));
      if (searchText.indexOf(filters.search) === -1) {
        return false;
      }
    }
    return true;
  }

  function tubitoMatchesVisitSet(tubito, visits, filters) {
    var visitMap = {};
    var propertyMap = {};
    var date = tubito.dataColeta || '';

    visits.forEach(function (visit) {
      if (visit.uid) {
        visitMap[visit.uid] = true;
      }
      if (visit.propertyUid) {
        propertyMap[visit.propertyUid] = true;
      }
    });

    if (tubito.visitUid && visitMap[tubito.visitUid]) {
      return true;
    }
    if (tubito.propertyUid && propertyMap[tubito.propertyUid]) {
      return true;
    }
    if (filters.range.start && date && date < filters.range.start) {
      return false;
    }
    if (filters.range.end && date && date > filters.range.end) {
      return false;
    }
    if (filters.operationRaw && tubito.operationMode !== filters.operation) {
      return false;
    }
    if (filters.bairro && normalizeKey(tubito.bairro) !== filters.bairro) {
      return false;
    }
    if (filters.microarea && normalizeKey(tubito.microarea) !== filters.microarea) {
      return false;
    }
    return !!date;
  }

  function isPositiveAedes(row) {
    var explicit = normalizeKey(row && row.positivoAedes);
    var result = normalizeKey(row && row.resultado);
    var species = normalizeKey(row && row.especie);
    return explicit === 'sim' ||
      explicit === 'true' ||
      explicit === '1' ||
      (result.indexOf('positivo') > -1 && species.indexOf('aedes') > -1);
  }

  function labBucket(row) {
    var status = normalizeKey(row && row.status);
    var result = normalizeKey(row && row.resultado);
    if (isPositiveAedes(row)) {
      return 'aedes';
    }
    if (result.indexOf('negativo') > -1) {
      return 'negative';
    }
    if (result && result.indexOf('positivo') > -1) {
      return 'other';
    }
    if (!result || status.indexOf('pendente') > -1 || status.indexOf('analise') > -1) {
      return 'pending';
    }
    return 'other';
  }

  function summarize() {
    var data = getData();
    var filters = currentFilters();
    var visits = data.visits.filter(function (visit) {
      return visitMatchesFilters(visit, filters);
    });
    var tubitos = data.tubitos.filter(function (tubito) {
      return tubitoMatchesVisitSet(tubito, visits, filters);
    });
    var today = todayLocal();
    var todayVisits = data.visits.filter(function (visit) {
      return visit.data === today && visitMatchesFilters(visit, Object.assign({}, filters, {
        range: { start: '', end: '' }
      }));
    });
    var operation = { VD: [], PE: [], LIRAA: [] };
    var operationTubitos = { VD: 0, PE: 0, LIRAA: 0 };
    var lab = { total: 0, pending: 0, negative: 0, aedes: 0, other: 0 };
    var byBairroFocus = {};
    var byHour = {};
    var byAgent = {};

    visits.forEach(function (visit) {
      operation[visit.operationMode] = operation[visit.operationMode] || [];
      operation[visit.operationMode].push(visit);
      if (hasFocus(visit)) {
        byBairroFocus[visit.bairro || 'Sem bairro'] = (byBairroFocus[visit.bairro || 'Sem bairro'] || 0) + 1;
      }
      var hour = text(visit.hora).slice(0, 2) || '--';
      byHour[hour] = (byHour[hour] || 0) + 1;
      var agent = visit.agente || visit.matricula || 'Sem agente';
      byAgent[agent] = byAgent[agent] || { visits: 0, focus: 0, gps: 0 };
      byAgent[agent].visits += 1;
      byAgent[agent].focus += hasFocus(visit) ? 1 : 0;
      byAgent[agent].gps += hasGps(visit) ? 1 : 0;
    });

    var visitModeByUid = {};
    visits.forEach(function (visit) {
      if (visit && visit.uid) {
        visitModeByUid[visit.uid] = modeOf(visit.operationMode);
      }
    });

    tubitos.forEach(function (row) {
      var bucket = labBucket(row);
      var mode = modeOf((row && row.visitUid && visitModeByUid[row.visitUid]) || row.operationMode || 'VD');
      lab.total += 1;
      lab[bucket] += 1;
      operationTubitos[mode] = (operationTubitos[mode] || 0) + 1;
    });

    visits.forEach(function (visit) {
      var qty = number(visit && visit.tubitosQty);
      var uid = text(visit && visit.uid);
      var hasExplicitTubitos = uid && tubitos.some(function (row) { return row && row.visitUid === uid; });
      if (qty > 0 && !hasExplicitTubitos) {
        var mode = modeOf(visit && visit.operationMode);
        operationTubitos[mode] = (operationTubitos[mode] || 0) + qty;
      }
    });

    return {
      data: data,
      filters: filters,
      visits: visits,
      todayVisits: todayVisits,
      tubitos: tubitos,
      properties: data.properties,
      agents: data.agents,
      attendance: data.attendance,
      operation: operation,
      operationTubitos: operationTubitos,
      lab: lab,
      byBairroFocus: byBairroFocus,
      byHour: byHour,
      byAgent: byAgent,
      generatedAt: data.generatedAt
    };
  }

  function operationCount(summary, mode) {
    return (summary.operation[mode] || []).length;
  }

  function operationAgentCount(summary, mode) {
    return uniqueCount(summary.operation[mode] || [], function (visit) {
      return text(visit.matricula || visit.agente);
    });
  }

  function buildAlerts(summary) {
    var alerts = [];
    var visits = summary.visits;
    var gpsCoverage = visits.length ? Math.round((visits.filter(hasGps).length / visits.length) * 100) : 0;
    var topBairro = Object.keys(summary.byBairroFocus).sort(function (a, b) {
      return summary.byBairroFocus[b] - summary.byBairroFocus[a];
    })[0];
    var activeAgents = uniqueCount(visits, function (visit) {
      return visit.matricula || visit.agente;
    });
    var registeredAgents = summary.agents.filter(function (agent) {
      return normalizeKey(agent.role) !== 'administrador';
    }).length;

    if (summary.lab.aedes > 0) {
      alerts.push({ tone: 'danger', title: 'Aedes positivo no laboratorio', text: summary.lab.aedes + ' tubito(s) positivo(s). Priorizar leitura territorial e retorno.' });
    }
    if (summary.lab.pending > 0) {
      alerts.push({ tone: 'warn', title: 'Tubitos aguardando analise', text: summary.lab.pending + ' tubito(s) ainda pendente(s) no recorte.' });
    }
    if (topBairro) {
      alerts.push({ tone: 'danger', title: 'Bairro com foco em destaque', text: topBairro + ' concentra ' + summary.byBairroFocus[topBairro] + ' foco(s) no recorte.' });
    }
    if (gpsCoverage && gpsCoverage < 80) {
      alerts.push({ tone: 'warn', title: 'Cobertura GPS abaixo do ideal', text: 'Cobertura atual: ' + gpsCoverage + '%. Reforcar captura em campo.' });
    }
    if (registeredAgents && activeAgents < registeredAgents) {
      alerts.push({ tone: 'info', title: 'Agentes sem producao no recorte', text: (registeredAgents - activeAgents) + ' agente(s) cadastrados sem visita no periodo filtrado.' });
    }
    if (summary.attendance && summary.attendance.totals && number(summary.attendance.totals.missingDays) > 0) {
      alerts.push({ tone: 'warn', title: 'Frequencia com ausencia util', text: summary.attendance.totals.missingDays + ' dia(s) uteis sem login registrados no mes.' });
    }
    if (!alerts.length) {
      alerts.push({ tone: 'ok', title: 'Situacao estavel no recorte', text: 'Sem alerta critico calculado pelos indicadores atuais.' });
    }
    return alerts.slice(0, 5);
  }

  function metricCard(label, value, note, tone, icon) {
    return '<article class="exec-v2-metric is-' + escapeHtml(tone || 'base') + '">' +
      '<div class="exec-v2-metric-icon">' + escapeHtml(icon || '•') + '</div>' +
      '<div><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(note || '') + '</small></div>' +
      '</article>';
  }

  function operationCard(summary, mode, title, note) {
    var list = summary.operation[mode] || [];
    var focus = list.filter(hasFocus).length;
    var tubitos = list.reduce(function (total, visit) { return total + number(visit.tubitosQty); }, 0);
    return '<article class="exec-v2-operation mode-' + (mode === 'LIRAA' ? 'liraa' : mode.toLowerCase()) + '">' +
      '<div><span>' + escapeHtml(title) + '</span><strong>' + escapeHtml(String(list.length)) + '</strong><small>' + escapeHtml(note) + '</small></div>' +
      '<div class="exec-v2-operation-meta"><b>' + escapeHtml(String(operationAgentCount(summary, mode))) + '</b> ag. <b>' + escapeHtml(String(focus)) + '</b> foco(s) <b>' + escapeHtml(String(tubitos)) + '</b> tubito(s)</div>' +
      '</article>';
  }

  function renderTimeline(summary) {
    var hours = Object.keys(summary.byHour).sort();
    var agents = Object.keys(summary.byAgent).sort(function (a, b) {
      return summary.byAgent[b].visits - summary.byAgent[a].visits;
    }).slice(0, 8);

    return '<div class="exec-v2-two">' +
      '<section class="exec-v2-card"><h3>Resumo por horário</h3>' +
        (hours.length ? hours.map(function (hour) {
          return '<div class="exec-v2-summary-line"><strong>' + escapeHtml(hour + 'h') + '</strong><span>' + escapeHtml(summary.byHour[hour] + ' visita(s) registradas') + '</span></div>';
        }).join('') : '<p class="exec-v2-empty">Sem visitas no recorte.</p>') +
      '</section>' +
      '<section class="exec-v2-card"><h3>Resumo por agente</h3>' +
        (agents.length ? agents.map(function (agent) {
          var item = summary.byAgent[agent];
          var gps = item.visits ? Math.round((item.gps / item.visits) * 100) : 0;
          return '<div class="exec-v2-summary-line"><strong>' + escapeHtml(agent) + '</strong><span>' + escapeHtml(item.visits + ' visita(s), ' + item.focus + ' foco(s), GPS ' + gps + '%') + '</span></div>';
        }).join('') : '<p class="exec-v2-empty">Sem agentes no recorte.</p>') +
      '</section>' +
    '</div>';
  }

  function renderAttendance(summary) {
    var attendance = summary.attendance || {};
    var totals = attendance.totals || {};
    var rows = (attendance.rows || []).slice(0, 8);
    var month = attendance.month ? attendance.month.split('-').reverse().join('/') : 'mes atual';

    return '<section class="exec-v2-card">' +
      '<div class="exec-v2-card-head"><h3>Frequencia dos agentes</h3><span class="exec-v2-pill">' + escapeHtml(month) + '</span></div>' +
      '<div class="exec-v2-attendance-kpis">' +
        '<div><small>Dias uteis</small><strong>' + escapeHtml(totals.businessDays || 0) + '</strong></div>' +
        '<div><small>Presencas</small><strong>' + escapeHtml(totals.loggedDays || 0) + '</strong></div>' +
        '<div><small>Ausencias</small><strong>' + escapeHtml(totals.missingDays || 0) + '</strong></div>' +
      '</div>' +
      (rows.length ? rows.map(function (row) {
        return '<div class="exec-v2-summary-line"><strong>' + escapeHtml(row.nome || row.matricula || 'Agente') + '</strong><span>' +
          escapeHtml(row.loggedDays + ' presenca(s) • ' + row.missingDays + ' ausencia(s) uteis') +
          '</span></div>';
      }).join('') : '<p class="exec-v2-empty">A frequencia aparecera depois que a nova API registrar os primeiros logins.</p>') +
    '</section>';
  }

  function renderLab(summary) {
    return '<section class="exec-v2-card exec-v2-lab-card">' +
      '<div class="exec-v2-card-head"><h3>Laboratorio em destaque</h3><span class="exec-v2-pill mode-lab">Tubitos</span></div>' +
      '<div class="exec-v2-lab-grid">' +
        '<div><small>Aguardando</small><strong>' + escapeHtml(summary.lab.pending) + '</strong></div>' +
        '<div><small>Negativo</small><strong>' + escapeHtml(summary.lab.negative) + '</strong></div>' +
        '<div class="is-danger"><small>Aedes +</small><strong>' + escapeHtml(summary.lab.aedes) + '</strong></div>' +
        '<div><small>Outro</small><strong>' + escapeHtml(summary.lab.other) + '</strong></div>' +
      '</div>' +
      '<p>Resultados laboratoriais entram na leitura territorial, nos alertas e no PDF executivo.</p>' +
    '</section>';
  }

  function renderAlerts(summary) {
    return '<section class="exec-v2-card"><div class="exec-v2-card-head"><h3>Alertas inteligentes</h3><span class="exec-v2-pill">Recorte atual</span></div>' +
      buildAlerts(summary).map(function (alert) {
        return '<article class="exec-v2-alert is-' + escapeHtml(alert.tone) + '"><strong>' + escapeHtml(alert.title) + '</strong><span>' + escapeHtml(alert.text) + '</span></article>';
      }).join('') +
    '</section>';
  }

  function propertyHistoryItems(summary) {
    var map = {};
    summary.visits.forEach(function (visit) {
      var key = propertyKeyFromVisit(visit);
      if (!key) {
        return;
      }
      if (!map[key]) {
        map[key] = {
          key: key,
          title: addressFromVisit(visit) || 'Imovel sem endereco',
          territory: [visit.microarea, visit.quarteirao ? 'Q ' + visit.quarteirao : ''].filter(Boolean).join(' • '),
          visits: []
        };
      }
      map[key].visits.push(visit);
    });
    return Object.keys(map).map(function (key) {
      var item = map[key];
      item.visits.sort(function (a, b) {
        return String((b.data || '') + ' ' + (b.hora || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '')));
      });
      return item;
    }).sort(function (a, b) {
      return String((b.visits[0] && b.visits[0].data || '') + (b.visits[0] && b.visits[0].hora || '')).localeCompare(String((a.visits[0] && a.visits[0].data || '') + (a.visits[0] && a.visits[0].hora || '')));
    });
  }

  function labSummaryForVisit(summary, visit) {
    var rows = summary.tubitos.filter(function (row) {
      return (visit.uid && row.visitUid === visit.uid) || (visit.propertyUid && row.propertyUid === visit.propertyUid);
    });
    if (!rows.length) {
      return 'sem tubito';
    }
    if (rows.some(isPositiveAedes)) {
      return 'Aedes positivo';
    }
    if (rows.some(function (row) { return labBucket(row) === 'pending'; })) {
      return 'lab pendente';
    }
    if (rows.every(function (row) { return labBucket(row) === 'negative'; })) {
      return 'negativo';
    }
    return rows.length + ' tubito(s)';
  }

  function renderPropertyHistory(summary) {
    var query = normalizeKey(state.historyQuery);
    var items = propertyHistoryItems(summary).filter(function (item) {
      return !query || normalizeKey(item.title + ' ' + item.territory).indexOf(query) > -1;
    }).slice(0, 5);

    return '<section class="exec-v2-card exec-v2-history-card">' +
      '<div class="exec-v2-card-head"><h3>Historico forte por imovel</h3><span class="exec-v2-pill">Ultimas 3 visitas</span></div>' +
      '<input id="execV2HistorySearch" class="exec-v2-search" type="search" placeholder="Buscar imovel, rua, bairro ou quarteirao" value="' + escapeHtml(state.historyQuery) + '">' +
      (items.length ? items.map(function (item) {
        return '<article class="exec-v2-history-item"><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.territory || '-') + '</small>' +
          item.visits.slice(0, 3).map(function (visit) {
            return '<div class="exec-v2-history-visit"><span>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + '</span><b>' + escapeHtml(visit.situacao || '-') + '</b><em>' + escapeHtml((hasFocus(visit) ? 'Foco sim' : 'Sem foco') + ' • ' + labSummaryForVisit(summary, visit)) + '</em></div>';
          }).join('') +
        '</article>';
      }).join('') : '<p class="exec-v2-empty">Nenhum historico encontrado no recorte.</p>') +
    '</section>';
  }

  function renderGovernance(summary) {
    var audit = readJson(AUDIT_KEY, []).slice(-4).reverse();
    return '<section class="exec-v2-card">' +
      '<div class="exec-v2-card-head"><h3>Governanca, backup e apresentacao</h3><span class="exec-v2-pill">Local</span></div>' +
      '<div class="exec-v2-permissions">' +
        '<div><strong>Agente</strong><span>Coleta em campo</span></div>' +
        '<div><strong>Coordenacao</strong><span>Painel, operacao e PDF</span></div>' +
        '<div><strong>Laboratorio</strong><span>Resultado em lab.html</span></div>' +
        '<div><strong>Admin</strong><span>Cadastros e configuracao</span></div>' +
      '</div>' +
      '<p class="exec-v2-note">Este bloco documenta os perfis operacionais no painel. Reforco de permissao real depende da API/back-end.</p>' +
      '<div class="exec-v2-actions"><button type="button" class="btn btn-soft" data-exec-v2-action="presentation">Modo apresentacao</button></div>' +
      '<div class="exec-v2-audit">' + (audit.length ? audit.map(function (row) {
        return '<span>' + escapeHtml(formatDateTime(row.at) + ' • ' + row.action) + '</span>';
      }).join('') : '<span>Nenhum evento local registrado ainda.</span>') + '</div>' +
    '</section>';
  }

  function percent(part, total) {
    return total ? Math.round((number(part) / number(total)) * 100) : 0;
  }

  function tableHtml(headers, rows, emptyText) {
    if (!rows || !rows.length) {
      return '<div class="exec-detail-empty">' + escapeHtml(emptyText || 'Sem dados no recorte.') + '</div>';
    }
    return '<div class="exec-detail-table-wrap"><table class="exec-detail-table"><thead><tr>' +
      headers.map(function (header) { return '<th>' + escapeHtml(header) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function agentRows(summary) {
    var map = {};
    summary.visits.forEach(function (visit) {
      var key = visit.matricula || visit.agente || 'Sem agente';
      var item = map[key] || { name: visit.agente || key, modes: {}, visits: 0, closed: 0, recovered: 0, focus: 0, tubitos: 0, gps: 0 };
      item.modes[modeLabel(visit.operationMode)] = true;
      item.visits += 1;
      item.closed += (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') ? 1 : 0;
      item.recovered += visit.situacao === 'Recuperado' ? 1 : 0;
      item.focus += hasFocus(visit) ? 1 : 0;
      item.tubitos += number(visit.tubitosQty);
      item.gps += hasGps(visit) ? 1 : 0;
      map[key] = item;
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) {
      return b.visits - a.visits || a.name.localeCompare(b.name);
    }).slice(0, 40).map(function (item) {
      return ['<strong>' + escapeHtml(item.name) + '</strong>', escapeHtml(Object.keys(item.modes).join(', ') || '-'), escapeHtml(item.visits), escapeHtml(item.closed), escapeHtml(item.recovered), escapeHtml(item.focus), escapeHtml(item.tubitos), escapeHtml(percent(item.gps, item.visits) + '%')];
    });
  }

  function territoryRows(summary) {
    var map = {};
    summary.visits.forEach(function (visit) {
      var key = [visit.bairro || 'Sem bairro', visit.microarea || '-', visit.quarteirao || '-'].join('|');
      var item = map[key] || { bairro: visit.bairro || 'Sem bairro', microarea: visit.microarea || '-', quarteirao: visit.quarteirao || '-', visits: 0, focus: 0, closed: 0, recovered: 0 };
      item.visits += 1;
      item.focus += hasFocus(visit) ? 1 : 0;
      item.closed += (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') ? 1 : 0;
      item.recovered += visit.situacao === 'Recuperado' ? 1 : 0;
      map[key] = item;
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) {
      return b.focus - a.focus || b.visits - a.visits || a.bairro.localeCompare(b.bairro);
    }).slice(0, 40).map(function (item) {
      var risk = item.focus >= 3 ? 'Crítico' : (item.focus > 0 || item.closed >= 5 ? 'Atenção' : 'Baixo');
      return [escapeHtml(item.bairro), escapeHtml(item.microarea), escapeHtml(item.quarteirao), escapeHtml(item.visits), escapeHtml(item.focus), escapeHtml(item.closed), '<span class="exec-risk exec-risk-' + (risk === 'Crítico' ? 'high' : risk === 'Atenção' ? 'mid' : 'low') + '">' + escapeHtml(risk) + '</span>'];
    });
  }

  function operationRows(summary) {
    var rows = ['VD', 'PE', 'LIRAA'].map(function (mode) {
      var list = summary.operation[mode] || [];
      var focus = list.filter(hasFocus).length;
      var tubitos = list.reduce(function (total, visit) { return total + number(visit.tubitosQty); }, 0);
      var agents = operationAgentCount(summary, mode);
      return ['<span class="exec-mode exec-mode-' + (mode === 'LIRAA' ? 'liraa' : mode.toLowerCase()) + '">' + escapeHtml(modeLabel(mode)) + '</span>', escapeHtml(agents), escapeHtml(list.length), escapeHtml(focus), escapeHtml(tubitos), escapeHtml(list.length ? 'Com produção no recorte' : 'Sem produção no recorte')];
    });
    if (state.schedule && Array.isArray(state.schedule.operations) && state.schedule.operations.length) {
      state.schedule.operations.slice(0, 12).forEach(function (op) {
        var mode = modeOf(op.tipo_operacao || op.mode || op.tipo || op.operation_mode);
        var agents = (state.schedule.assignments || []).filter(function (a) { return text(a.operation_id || a.operationId) === text(op.operation_id || op.id || op.uid); }).length;
        rows.push(['<span class="exec-mode exec-mode-' + (mode === 'LIRAA' ? 'liraa' : mode.toLowerCase()) + '">' + escapeHtml(modeLabel(mode)) + '</span>', escapeHtml(agents || '-'), '-', '-', '-', escapeHtml(text(op.titulo || op.title || op.ciclo || op.cycle || 'Operação programada'))]);
      });
    }
    return rows;
  }

  function depositRows(summary) {
    var map = {};
    summary.visits.forEach(function (visit) {
      var code = text(visit.tubitosDeposito || '').split(/[;,|]/)[0] || 'Geral';
      map[code] = map[code] || { code: code, deposits: 0, focus: 0, treated: 0, tubitos: 0 };
      map[code].deposits += number(visit.depositCount);
      map[code].focus += number(visit.depositFocusCount || visit.focusCount);
      map[code].treated += number(visit.depositCount);
      map[code].tubitos += number(visit.tubitosQty);
    });
    summary.tubitos.forEach(function (row) {
      var code = row.depositoCodigo || 'Tubito sem depósito';
      map[code] = map[code] || { code: code, deposits: 0, focus: 0, treated: 0, tubitos: 0 };
      map[code].tubitos += 1;
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) {
      return b.focus - a.focus || b.deposits - a.deposits || a.code.localeCompare(b.code);
    }).slice(0, 30).map(function (item) { return [escapeHtml(item.code), escapeHtml(item.deposits), escapeHtml(item.focus), escapeHtml(item.treated), escapeHtml(item.tubitos)]; });
  }

  function pendingRows(summary) {
    var closed = summary.visits.filter(function (visit) { return visit.situacao === 'Fechado' || visit.situacao === 'Recusa'; }).length;
    var noGps = summary.visits.filter(function (visit) { return !hasGps(visit); }).length;
    var labPending = summary.lab.pending;
    var focus = summary.visits.filter(hasFocus).length;
    var noProductionAgents = Math.max(0, summary.agents.length - uniqueCount(summary.visits, function (visit) { return visit.matricula || visit.agente; }));
    return [
      ['Fechados/recusados para recuperação', closed, closed >= 10 ? 'Alta' : closed ? 'Média' : 'Baixa'],
      ['Visitas sem GPS', noGps, noGps >= 5 ? 'Média' : noGps ? 'Atenção' : 'Baixa'],
      ['Tubitos pendentes no laboratório', labPending, labPending ? 'Alta' : 'Baixa'],
      ['Focos para bloqueio/retorno', focus, focus ? 'Alta' : 'Baixa'],
      ['Agentes cadastrados sem produção no recorte', noProductionAgents, noProductionAgents ? 'Atenção' : 'Baixa']
    ].map(function (row) { return [escapeHtml(row[0]), escapeHtml(row[1]), '<span class="exec-risk exec-risk-' + (row[2] === 'Alta' ? 'high' : row[2] === 'Média' || row[2] === 'Atenção' ? 'mid' : 'low') + '">' + escapeHtml(row[2]) + '</span>']; });
  }

  function renderExecutiveTop(summary) {
    var range = summary.filters.range;
    var activeAgents = uniqueCount(summary.visits, function (visit) { return visit.matricula || visit.agente; });
    var gpsCoverage = summary.visits.length ? percent(summary.visits.filter(hasGps).length, summary.visits.length) : 0;
    var topBairro = Object.keys(summary.byBairroFocus).sort(function (a, b) { return summary.byBairroFocus[b] - summary.byBairroFocus[a]; })[0] || '-';
    var labText = summary.lab.aedes ? (summary.lab.aedes + ' Aedes positivo') : (summary.lab.pending ? (summary.lab.pending + ' pendente(s)') : 'sem pendência crítica');
    return '<section class="exec-unified-card exec-unified-reading">' +
      '<div class="exec-unified-head"><div><span>Painel Executivo</span><h3>Leitura executiva operacional</h3><p>Resumo interpretativo do recorte usando o mesmo padrão visual do painel.</p></div><button type="button" class="btn btn-soft" data-exec-v2-action="refresh">Atualizar</button></div>' +
      '<div class="exec-unified-kpis"><div><small>Período</small><strong>' + escapeHtml(formatDateBR(range.start) + ' a ' + formatDateBR(range.end)) + '</strong></div><div><small>Agentes ativos</small><strong>' + escapeHtml(activeAgents) + '</strong></div><div><small>GPS</small><strong>' + escapeHtml(gpsCoverage + '%') + '</strong></div><div><small>Laboratório</small><strong>' + escapeHtml(labText) + '</strong></div></div>' +
      '<div class="exec-unified-text"><p><strong>Síntese do recorte:</strong> foram <b>' + escapeHtml(summary.visits.length) + '</b> visita(s), com <b>' + escapeHtml(summary.visits.filter(hasFocus).length) + '</b> foco(s), <b>' + escapeHtml(summary.lab.total) + '</b> tubito(s) e bairro em destaque: <b>' + escapeHtml(topBairro) + '</b>.</p><p><strong>Distribuição operacional:</strong> VD ' + escapeHtml(operationCount(summary, 'VD')) + ' visita(s), P.E. ' + escapeHtml(operationCount(summary, 'PE')) + ' visita(s), LIRAa ' + escapeHtml(operationCount(summary, 'LIRAA')) + ' visita(s).</p></div>' +
      '<div class="exec-unified-alerts">' + buildAlerts(summary).slice(0, 3).map(function (alert) { return '<article class="exec-v2-alert is-' + escapeHtml(alert.tone) + '"><strong>' + escapeHtml(alert.title) + '</strong><span>' + escapeHtml(alert.text) + '</span></article>'; }).join('') + '</div>' +
    '</section>';
  }

  function renderExecutiveDetail(summary) {
    return '<section class="exec-unified-card exec-detail-card">' +
      '<div class="exec-unified-head"><div><span>Detalhamento executivo</span><h3>Tabelas analíticas do recorte</h3><p>Escolha uma visão para aprofundar sem empilhar várias tabelas na tela.</p></div><button type="button" class="btn btn-soft" data-exec-v2-action="pdf">Relatório PDF</button></div>' +
      '<div class="exec-detail-tabs" role="tablist"><button type="button" class="is-active" data-exec-detail-tab="agents">Agentes</button><button type="button" data-exec-detail-tab="territories">Territórios</button><button type="button" data-exec-detail-tab="operations">Operações</button><button type="button" data-exec-detail-tab="deposits">Depósitos</button><button type="button" data-exec-detail-tab="pending">Pendências</button></div>' +
      '<div class="exec-detail-panel is-active" data-exec-detail-panel="agents">' + tableHtml(['Agente', 'Operação', 'Visitas', 'Fechados', 'Recuperados', 'Focos', 'Tubitos', 'GPS'], agentRows(summary), 'Sem produção por agente no recorte.') + '</div>' +
      '<div class="exec-detail-panel" data-exec-detail-panel="territories" hidden>' + tableHtml(['Bairro', 'Microárea', 'Quarteirão', 'Visitas', 'Focos', 'Fechados', 'Risco'], territoryRows(summary), 'Sem território com produção no recorte.') + '</div>' +
      '<div class="exec-detail-panel" data-exec-detail-panel="operations" hidden>' + tableHtml(['Operação', 'Agentes', 'Visitas', 'Focos', 'Tubitos', 'Situação'], operationRows(summary), 'Sem operação no recorte.') + '</div>' +
      '<div class="exec-detail-panel" data-exec-detail-panel="deposits" hidden>' + tableHtml(['Tipo/Depósito', 'Depósitos', 'Com foco', 'Tratados/sem foco', 'Tubitos'], depositRows(summary), 'Sem depósitos/tubitos no recorte.') + '</div>' +
      '<div class="exec-detail-panel" data-exec-detail-panel="pending" hidden>' + tableHtml(['Pendência', 'Quantidade', 'Prioridade'], pendingRows(summary), 'Sem pendências no recorte.') + '</div>' +
    '</section>';
  }

  function renderExecutive(summary) {
    return renderExecutiveTop(summary);
  }

  function ensureStyles() {
    if ($('acePanelExecutivoV2Styles')) {
      return;
    }
    var style = documentRef.createElement('style');
    style.id = 'acePanelExecutivoV2Styles';
    style.textContent = [
      ':root{--exec-v2-green:#17633f;--exec-v2-orange:#c46a14;--exec-v2-blue:#2563eb;--exec-v2-purple:#6d28d9;--exec-v2-red:#b91c1c;--exec-v2-ink:#10241a}',
      '.exec-v2{grid-column:1/-1;display:grid;gap:14px;margin-bottom:16px}',
      '.exec-v2-hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;gap:16px;align-items:center;border:1px solid rgba(23,99,63,.22);border-radius:28px;padding:20px;background:radial-gradient(circle at 12% 12%,rgba(255,255,255,.95),rgba(255,255,255,.78) 34%,rgba(232,244,236,.92) 100%),linear-gradient(135deg,#e9f7ee,#eef6ff);box-shadow:0 24px 60px rgba(15,72,43,.12)}',
      '.exec-v2-hero:after{content:"";position:absolute;right:-60px;top:-90px;width:240px;height:240px;border-radius:999px;background:rgba(37,99,235,.12)}.exec-v2-hero-copy{position:relative;z-index:1}.exec-v2-hero span{display:block;color:#17633f;font-weight:950;text-transform:uppercase;letter-spacing:.08em;font-size:.75rem}.exec-v2-hero h2{margin:4px 0;color:#10241a;font-size:1.55rem}.exec-v2-hero p{margin:0;color:#49695b;font-weight:750}.exec-v2-hero-actions{position:relative;z-index:1;display:flex;gap:8px;flex-wrap:wrap}',
      '.exec-v2-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.exec-v2-metric{display:flex;gap:12px;align-items:center;border:1px solid #dfeae3;border-radius:24px;padding:14px;background:#fff;box-shadow:0 14px 34px rgba(15,72,43,.08)}.exec-v2-metric-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:18px;background:#e8f4ec;color:#17633f;font-weight:950}.exec-v2-metric span,.exec-v2-operation span,.exec-v2-lab-grid small{display:block;color:#64746d;font-size:.72rem;font-weight:950;text-transform:uppercase;letter-spacing:.05em}.exec-v2-metric strong{display:block;margin-top:2px;color:#10241a;font-size:1.65rem}.exec-v2-metric small{display:block;color:#60756a;font-weight:750}.exec-v2-metric.is-danger .exec-v2-metric-icon{background:#fef2f2;color:#b91c1c}.exec-v2-metric.is-ok .exec-v2-metric-icon{background:#ecfdf5;color:#166534}.exec-v2-metric.is-team .exec-v2-metric-icon{background:#eef2ff;color:#3730a3}.exec-v2-metric.is-vd .exec-v2-metric-icon{background:#e8f4ec;color:#17633f}',
      '.exec-v2-operations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.exec-v2-operation{border-radius:22px;padding:14px;border:1px solid #dfeae3;background:#fff}.exec-v2-operation strong{display:block;margin-top:4px;font-size:1.65rem;color:#10241a}.exec-v2-operation-meta{margin-top:8px;color:#49695b;font-weight:850}.exec-v2-operation.mode-vd{border-left:6px solid var(--exec-v2-green)}.exec-v2-operation.mode-pe{border-left:6px solid var(--exec-v2-orange)}.exec-v2-operation.mode-liraa{border-left:6px solid var(--exec-v2-blue)}',
      '.exec-v2-grid,.exec-v2-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.exec-v2-card{border:1px solid #dfeae3;border-radius:24px;background:#fff;padding:15px;box-shadow:0 14px 34px rgba(15,72,43,.07)}.exec-v2-card h3{margin:0;color:#10241a;font-size:1rem}.exec-v2-card-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.exec-v2-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:#eef7f1;color:#17633f;font-weight:950;font-size:.75rem}.exec-v2-pill.mode-lab{background:#f3e8ff;color:#6d28d9}',
      '.exec-v2-alert{border:1px solid #e3ece6;border-left:5px solid #94a3b8;border-radius:16px;padding:10px;margin-top:8px;background:#fbfdfb}.exec-v2-alert strong{display:block;color:#10241a}.exec-v2-alert span{display:block;color:#52685d;margin-top:2px;font-weight:750}.exec-v2-alert.is-danger{border-left-color:#b91c1c;background:#fff7f7}.exec-v2-alert.is-warn{border-left-color:#c46a14;background:#fffaf3}.exec-v2-alert.is-ok{border-left-color:#15803d;background:#f0fdf4}.exec-v2-alert.is-info{border-left-color:#2563eb;background:#eff6ff}',
      '.exec-v2-lab-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.exec-v2-lab-grid div{border:1px solid #eadff7;border-radius:16px;padding:10px;background:#fbf7ff}.exec-v2-lab-grid strong{display:block;font-size:1.35rem;color:#31105f}.exec-v2-lab-grid .is-danger{background:#fff1f2;border-color:#fecdd3}.exec-v2-lab-grid .is-danger strong{color:#b91c1c}.exec-v2-lab-card p,.exec-v2-note{color:#5b6f64;font-weight:750;line-height:1.38}',
      '.exec-v2-attendance-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px}.exec-v2-attendance-kpis div{border:1px solid #dbeafe;border-radius:16px;padding:10px;background:#eff6ff}.exec-v2-attendance-kpis small{display:block;color:#1d4ed8;font-size:.72rem;font-weight:950;text-transform:uppercase;letter-spacing:.05em}.exec-v2-attendance-kpis strong{display:block;color:#10241a;font-size:1.35rem}',
      '.exec-v2-summary-line{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #edf4ef;padding:9px 0}.exec-v2-summary-line:last-child{border-bottom:0}.exec-v2-summary-line strong{color:#10241a}.exec-v2-summary-line span{color:#64746d;font-weight:800;text-align:right}',
      '.exec-v2-history-card{min-height:220px}.exec-v2-search{width:100%;box-sizing:border-box;border:1px solid #d7e4dc;border-radius:14px;padding:10px 12px;margin:2px 0 10px;font:inherit}.exec-v2-history-item{border:1px solid #e1ebe5;border-radius:16px;padding:10px;margin-top:8px;background:#fbfdfb}.exec-v2-history-item strong{display:block;color:#10241a}.exec-v2-history-item small{display:block;color:#64746d;margin-top:2px;font-weight:800}.exec-v2-history-visit{display:grid;grid-template-columns:120px 90px minmax(0,1fr);gap:8px;margin-top:7px;color:#40584d;font-size:.86rem}.exec-v2-history-visit b{color:#10241a}.exec-v2-history-visit em{font-style:normal;color:#64746d}',
      '.exec-v2-permissions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.exec-v2-permissions div{border:1px solid #e0ebe4;border-radius:14px;padding:10px;background:#fbfdfb}.exec-v2-permissions strong,.exec-v2-permissions span{display:block}.exec-v2-permissions span{color:#64746d;font-weight:750}.exec-v2-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.exec-v2-audit{display:grid;gap:5px;color:#64746d;font-size:.82rem;font-weight:750}.exec-v2-empty{padding:12px;border:1px dashed #cbd7d0;border-radius:14px;background:#f8fbf9;color:#587063;font-weight:800}',
      '.exec-map-v2{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;border:1px solid #dfeae3;border-radius:18px;padding:12px;margin:10px 0;background:#fbfdfb}.exec-map-legend{display:flex;gap:8px;flex-wrap:wrap}.exec-map-chip{display:inline-flex;gap:6px;align-items:center;border-radius:999px;padding:7px 10px;background:#fff;border:1px solid #dfeae3;font-weight:900;color:#334155}.exec-map-dot{width:10px;height:10px;border-radius:999px;background:#94a3b8}.exec-map-dot.visitado{background:#16a34a}.exec-map-dot.fechado{background:#f59e0b}.exec-map-dot.foco{background:#dc2626}.exec-map-dot.pe{background:#c46a14}.exec-map-dot.liraa{background:#2563eb}',
      '.exec-v2-floating-badge{position:fixed;right:18px;bottom:18px;z-index:99998;border-radius:999px;background:#10241a;color:#fff;padding:10px 14px;font-weight:950;box-shadow:0 16px 36px rgba(0,0,0,.2)}body.ace-presentation-mode #dashboardTable,body.ace-presentation-mode #visitInspectionPanel{display:none!important}body.ace-presentation-mode .panel-filter-drawer:not([open]){opacity:.82}body.ace-presentation-mode .app-sidebar{filter:saturate(.65)}',
      '.exec-v2-inline-top{margin:10px 0 0}.exec-v2-detail-host{margin-bottom:14px}',
      '.exec-unified-card{border:1px solid #cfdcd4;border-radius:14px;background:#f8fbf9;padding:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)}',
      '.exec-unified-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.exec-unified-head span{display:block;color:#17633f;font-weight:950;text-transform:uppercase;letter-spacing:.08em;font-size:.7rem}.exec-unified-head h3{margin:2px 0;color:#10241a;font-size:1rem}.exec-unified-head p{margin:0;color:#5b6f64;font-weight:750;font-size:.86rem}',
      '.exec-unified-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.exec-unified-kpis div{border:1px solid #dfeae3;border-radius:12px;background:#fff;padding:9px 10px}.exec-unified-kpis small{display:block;color:#64746d;font-size:.68rem;font-weight:950;text-transform:uppercase;letter-spacing:.05em}.exec-unified-kpis strong{display:block;color:#10241a;font-size:1rem;margin-top:2px}',
      '.exec-unified-text{display:grid;gap:4px;margin-top:10px;color:#33483d;font-weight:750}.exec-unified-text p{margin:0}.exec-unified-alerts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.exec-unified-alerts .exec-v2-alert{margin-top:0;border-radius:12px;padding:8px}',
      '.exec-detail-card{background:#fbfdfb}.exec-detail-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px}.exec-detail-tabs button{border:1px solid #cfded5;border-radius:999px;background:#fff;color:#315342;padding:7px 11px;font-weight:900;cursor:pointer}.exec-detail-tabs button.is-active{background:#17633f;color:#fff;border-color:#17633f}',
      '.exec-detail-table-wrap{max-height:330px;overflow:auto;border:1px solid #dfeae3;border-radius:12px;background:#fff}.exec-detail-table{width:100%;border-collapse:separate;border-spacing:0;font-size:.86rem}.exec-detail-table th{position:sticky;top:0;z-index:1;background:#eef7f1;color:#183c2c;text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}.exec-detail-table th,.exec-detail-table td{padding:8px 9px;border-bottom:1px solid #edf4ef;vertical-align:top}.exec-detail-table tbody tr:nth-child(even){background:#fafdfb}.exec-detail-table td{color:#30493d;font-weight:750}.exec-detail-empty{padding:14px;border:1px dashed #cbd7d0;border-radius:12px;background:#fff;color:#587063;font-weight:850}',
      '.exec-risk,.exec-mode{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-weight:950;font-size:.74rem}.exec-risk-high{background:#fef2f2;color:#b91c1c}.exec-risk-mid{background:#fff7ed;color:#c46a14}.exec-risk-low{background:#ecfdf5;color:#166534}.exec-mode-vd{background:#e8f4ec;color:#17633f}.exec-mode-pe{background:#fff7ed;color:#c46a14}.exec-mode-liraa{background:#eff6ff;color:#2563eb}',
      '@media(max-width:1180px){.exec-v2-metrics,.exec-unified-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.exec-v2-operations,.exec-v2-grid,.exec-v2-two,.exec-unified-alerts{grid-template-columns:1fr}}@media(max-width:720px){.exec-v2-hero{align-items:flex-start;flex-direction:column}.exec-v2-metrics,.exec-unified-kpis{grid-template-columns:1fr}.exec-v2-lab-grid,.exec-v2-permissions{grid-template-columns:repeat(2,minmax(0,1fr))}.exec-v2-history-visit{grid-template-columns:1fr}.exec-v2-summary-line{display:block}.exec-v2-summary-line span{display:block;text-align:left;margin-top:3px}.exec-unified-head{display:block}.exec-detail-table{font-size:.8rem}}'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function ensureRoot() {
    var panel = documentRef.querySelector('[data-panel-view-content="indicators"]');
    var host = $('panelOperationalExtras') || panel;
    var rootNode = $('panelExecutiveV2');
    if (!host) { return null; }
    if (!rootNode) {
      rootNode = documentRef.createElement('div');
      rootNode.id = 'panelExecutiveV2';
    }
    rootNode.className = 'exec-v2 exec-v2-inline-top';
    if (rootNode.parentNode !== host) {
      host.appendChild(rootNode);
    }
    return rootNode;
  }

  function ensureDetailRoot() {
    var inner = documentRef.querySelector('[data-panel-view-content="indicators"] .panel-scroll-box-inner');
    var detailNode = $('panelExecutiveDetailV2');
    if (!inner) { return null; }
    if (!detailNode) {
      detailNode = documentRef.createElement('div');
      detailNode.id = 'panelExecutiveDetailV2';
      detailNode.className = 'exec-v2 exec-v2-detail-host';
      inner.insertBefore(detailNode, inner.firstChild);
    }
    return detailNode;
  }

  function setSidebarLabel(button, labelText, iconText) {
    var icon;
    var label;
    if (!button) { return; }
    icon = button.querySelector('.sidebar-tab__icon');
    label = button.querySelector('span:last-child');
    if (icon && typeof iconText === 'string') { icon.textContent = iconText; }
    if (label) { label.textContent = labelText; }
  }

  function orderSidebarNavigation() {
    var nav = documentRef.querySelector('.app-sidebar__nav');
    var divider = nav ? nav.querySelector('.sidebar-divider') : null;
    var executiveButton;
    var operationButton;
    var statisticsButton;
    var mapButton;
    var visitsButton;
    var reportsButton;
    var agentsButton;
    var laboratorioButton;
    var liraaButton;
    var systemStatusButton;
    var items;

    if (!nav) {
      return;
    }

    executiveButton = documentRef.querySelector('[data-panel-view="indicators"]');
    operationButton = $('sidebarOperationBtn');
    statisticsButton = documentRef.querySelector('[data-panel-view="statistics"]');
    mapButton = documentRef.querySelector('[data-panel-view="map"]');
    visitsButton = documentRef.querySelector('[data-panel-view="visits"]');
    reportsButton = documentRef.querySelector('[data-panel-view="reports"]');
    agentsButton = $('sidebarAgentsBtn');
    laboratorioButton = $('sidebarLaboratorioBtn');
    liraaButton = $('sidebarLiraaBtn');
    systemStatusButton = $('sidebarSystemStatusBtn');

    setSidebarLabel(executiveButton, 'Painel Executivo', '▦');
    setSidebarLabel(operationButton, 'Operação', '▧');
    setSidebarLabel(statisticsButton, 'Estatísticas e Tendências', '∑');
    setSidebarLabel(mapButton, 'Mapa Territorial', '⌖');
    setSidebarLabel(visitsButton, 'Visitas', '▥');
    setSidebarLabel(reportsButton, 'Relatórios', '▤');
    setSidebarLabel(agentsButton, 'Agentes e Apoio', '◎');
    setSidebarLabel(laboratorioButton, 'Laboratório', '⌬');
    setSidebarLabel(liraaButton, 'LIRAa', 'L');
    setSidebarLabel(systemStatusButton, 'Sistema', '◉');

    items = [
      executiveButton,
      operationButton,
      statisticsButton,
      mapButton,
      visitsButton,
      reportsButton,
      agentsButton,
      laboratorioButton,
      liraaButton,
      systemStatusButton,
      divider,
      $('sidebarCadastroBtn'),
      $('sidebarConfigBtn'),
      $('sidebarSupportBtn')
    ];

    items.forEach(function (item) {
      if (item && item.parentNode === nav) {
        nav.appendChild(item);
      }
    });
  }

  function renderMapEnhancement(summary) {
    var node = $('execMapLegendV2');
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function recordAudit(action) {
    var rows = readJson(AUDIT_KEY, []);
    rows.push({ at: new Date().toISOString(), action: action });
    writeJson(AUDIT_KEY, rows.slice(-50));
  }

  function togglePresentationMode() {
    state.presentationMode = !state.presentationMode;
    documentRef.body.classList.toggle('ace-presentation-mode', state.presentationMode);
    var badge = $('execV2PresentationBadge');
    if (state.presentationMode && !badge) {
      badge = documentRef.createElement('div');
      badge.id = 'execV2PresentationBadge';
      badge.className = 'exec-v2-floating-badge';
      badge.textContent = 'Modo apresentacao ativo';
      documentRef.body.appendChild(badge);
    } else if (!state.presentationMode && badge && badge.parentNode) {
      badge.parentNode.removeChild(badge);
    }
    recordAudit(state.presentationMode ? 'Modo apresentacao ativado' : 'Modo apresentacao desativado');
    render();
  }

  function downloadText(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = documentRef.createElement('a');
    a.href = url;
    a.download = filename;
    documentRef.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }, 800);
  }

  function exportBackup() {
    var summary = summarize();
    var payload = {
      tipo: 'backup-painel-executivo',
      version: VERSION,
      geradoEm: new Date().toISOString(),
      filtro: summary.filters,
      indicadores: {
        visitas: summary.visits.length,
        imoveisTrabalhados: uniqueCount(summary.visits, propertyKeyFromVisit),
        agentesAtivos: uniqueCount(summary.visits, function (visit) { return visit.matricula || visit.agente; }),
        laboratorio: summary.lab,
        operacoes: {
          VD: operationCount(summary, 'VD'),
          PE: operationCount(summary, 'PE'),
          LIRAA: operationCount(summary, 'LIRAA')
        }
      },
      alertas: buildAlerts(summary),
      agendaOperacional: state.schedule || null,
      observacao: 'Backup local de indicadores. Nao inclui moradores, telefones ou observacoes livres.'
    };
    recordAudit('Backup/exportacao local');
    downloadText('ace-painel-executivo-' + todayLocal() + '.json', JSON.stringify(payload, null, 2));
    render();
  }

  function printableCss() {
    return '<style>@page{size:A4;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#10241a;margin:0;padding:18px;font-size:11px;line-height:1.35}h1{font-size:24px;margin:0;color:#10241a}h2{font-size:15px;margin:18px 0 8px;color:#17633f}p{margin:4px 0}.cover{border-radius:18px;padding:20px;background:linear-gradient(135deg,#e8f4ec,#eff6ff);border:1px solid #d6e6dc;margin-bottom:14px}.meta{color:#52685d;font-weight:700}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.card{border:1px solid #dbe7df;border-left:4px solid #17633f;border-radius:10px;padding:9px;background:#fff}.card small{display:block;color:#64746d;font-weight:800;text-transform:uppercase}.card strong{display:block;font-size:18px;margin-top:3px}.card.danger{border-left-color:#b91c1c}.card.orange{border-left-color:#c46a14}.card.blue{border-left-color:#2563eb}.card.purple{border-left-color:#6d28d9}.alert{border:1px solid #e4ece7;border-radius:10px;padding:8px;margin:6px 0}.alert strong{display:block}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d8e4dc;padding:5px;text-align:left;vertical-align:top}th{background:#f1f7f3}.toolbar{position:sticky;top:0;background:#fff;border-bottom:1px solid #d8e4dc;text-align:right;padding:8px}.toolbar button{border:1px solid #cbd8d0;border-radius:8px;background:#fff;padding:8px 10px;font-weight:800}@media print{.toolbar{display:none}.card,.alert,tr{break-inside:avoid}}</style>';
  }

  function openExecutivePdf() {
    var summary = summarize();
    var range = summary.filters.range;
    var alerts = buildAlerts(summary);
    var topVisits = summary.visits.slice().sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '')));
    }).slice(0, 25);
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Painel Executivo ACE</title>' + printableCss() + '</head><body>' +
      '<div class="toolbar"><button onclick="window.print()">Imprimir / salvar PDF</button></div>' +
      '<section class="cover"><h1>Painel Executivo ACE - Sala de Situacao</h1><p class="meta">Periodo: ' + escapeHtml(formatDateBR(range.start) + ' a ' + formatDateBR(range.end)) + ' • Gerado em ' + escapeHtml(formatDateTime(new Date().toISOString())) + '</p><p>Resumo executivo para reuniao, apresentacao e tomada de decisao.</p></section>' +
      '<div class="grid">' +
        '<div class="card"><small>Visitas</small><strong>' + escapeHtml(summary.visits.length) + '</strong></div>' +
        '<div class="card danger"><small>Focos/lab Aedes+</small><strong>' + escapeHtml(summary.lab.aedes) + '</strong></div>' +
        '<div class="card"><small>Imoveis trabalhados</small><strong>' + escapeHtml(uniqueCount(summary.visits, propertyKeyFromVisit)) + '</strong></div>' +
        '<div class="card purple"><small>Agentes ativos</small><strong>' + escapeHtml(uniqueCount(summary.visits, function (visit) { return visit.matricula || visit.agente; })) + '</strong></div>' +
      '</div>' +
      '<h2>Operacoes do recorte</h2><div class="grid">' +
        '<div class="card"><small>VD</small><strong>' + escapeHtml(operationCount(summary, 'VD')) + '</strong></div>' +
        '<div class="card orange"><small>P.E.</small><strong>' + escapeHtml(operationCount(summary, 'PE')) + '</strong></div>' +
        '<div class="card blue"><small>LIRAa</small><strong>' + escapeHtml(operationCount(summary, 'LIRAA')) + '</strong></div>' +
        '<div class="card purple"><small>Tubitos pendentes</small><strong>' + escapeHtml(summary.lab.pending) + '</strong></div>' +
      '</div>' +
      '<h2>Alertas inteligentes</h2>' + alerts.map(function (alert) {
        return '<div class="alert"><strong>' + escapeHtml(alert.title) + '</strong><span>' + escapeHtml(alert.text) + '</span></div>';
      }).join('') +
      '<h2>Resultados laboratoriais</h2><table><thead><tr><th>Total</th><th>Aguardando</th><th>Negativo</th><th>Aedes positivo</th><th>Outro</th></tr></thead><tbody><tr><td>' + escapeHtml(summary.lab.total) + '</td><td>' + escapeHtml(summary.lab.pending) + '</td><td>' + escapeHtml(summary.lab.negative) + '</td><td>' + escapeHtml(summary.lab.aedes) + '</td><td>' + escapeHtml(summary.lab.other) + '</td></tr></tbody></table>' +
      '<h2>Ultimas visitas do recorte</h2><table><thead><tr><th>Data/Hora</th><th>Operacao</th><th>Agente</th><th>Endereco</th><th>Situacao</th><th>Foco</th><th>Lab</th></tr></thead><tbody>' +
      (topVisits.length ? topVisits.map(function (visit) {
        return '<tr><td>' + escapeHtml(formatDateBR(visit.data) + ' ' + visit.hora) + '</td><td>' + escapeHtml(modeLabel(visit.operationMode)) + '</td><td>' + escapeHtml(visit.agente || '-') + '</td><td>' + escapeHtml(addressFromVisit(visit) || '-') + '</td><td>' + escapeHtml(visit.situacao || '-') + '</td><td>' + escapeHtml(hasFocus(visit) ? 'Sim' : 'Nao') + '</td><td>' + escapeHtml(labSummaryForVisit(summary, visit)) + '</td></tr>';
      }).join('') : '<tr><td colspan="7">Sem visitas no recorte.</td></tr>') +
      '</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>';
    var win = root.open('', '_blank');
    if (!win) {
      root.alert('O navegador bloqueou a janela do PDF.');
      return;
    }
    recordAudit('PDF executivo');
    win.document.open();
    win.document.write(html);
    win.document.close();
    render();
  }

  function requestJsonp(action, params) {
    return new Promise(function (resolve, reject) {
      var cb;
      var script;
      var timer;
      var url;
      if (!apiReady()) {
        reject(new Error('API_URL nao configurada.'));
        return;
      }
      cb = '__ACE_EXEC_V2_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      url = getApiUrl() + '?action=' + encodeURIComponent(action) + '&format=jsonp&t=' + encodeURIComponent(String(Date.now()));
      Object.keys(params || {}).forEach(function (key) {
        if (params[key] !== '' && params[key] != null) {
          url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        }
      });
      url += '&callback=' + encodeURIComponent(cb);
      script = documentRef.createElement('script');
      function cleanup() {
        try { delete root[cb]; } catch (error) { root[cb] = undefined; }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }
      timer = setTimeout(function () {
        cleanup();
        reject(new Error('Tempo esgotado.'));
      }, 15000);
      root[cb] = function (payload) {
        clearTimeout(timer);
        cleanup();
        if (payload && payload.ok === false) {
          reject(new Error(payload.error || 'Resposta invalida.'));
          return;
        }
        resolve(payload || {});
      };
      script.onerror = function () {
        clearTimeout(timer);
        cleanup();
        reject(new Error('Falha de rede.'));
      };
      script.src = url;
      documentRef.head.appendChild(script);
    });
  }

  function refreshSchedule() {
    var date = getDateRange().start || todayLocal();
    if (!apiReady() || (Date.now() - state.scheduleLoadedAt < 60000 && state.schedule && state.schedule.date === date)) {
      return Promise.resolve(state.schedule);
    }
    return requestJsonp('operation_schedule', { date: date }).then(function (payload) {
      state.schedule = {
        date: date,
        operations: payload.operations || (payload.data && payload.data.operations) || [],
        assignments: payload.assignments || (payload.data && payload.data.assignments) || [],
        summary: payload.summary || (payload.data && payload.data.summary) || null
      };
      state.scheduleLoadedAt = Date.now();
      render();
      return state.schedule;
    }).catch(function () {
      return state.schedule;
    });
  }

  function render() {
    var rootNode;
    var detailNode;
    var summary;
    ensureStyles();
    rootNode = ensureRoot();
    detailNode = ensureDetailRoot();
    if (!rootNode && !detailNode) { return; }
    summary = summarize();
    if (rootNode) { rootNode.innerHTML = renderExecutive(summary); }
    if (detailNode) { detailNode.innerHTML = renderExecutiveDetail(summary); }
    orderSidebarNavigation();
    renderMapEnhancement(summary);
  }

  function bindEvents() {
    documentRef.addEventListener('click', function (event) {
      var action = event.target && event.target.closest('[data-exec-v2-action]');
      if (action) {
        var name = action.getAttribute('data-exec-v2-action');
        if (name === 'refresh') {
          if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.reloadFromCloud === 'function') {
            root.ACEPanelCloudSync.reloadFromCloud().then(function () {
              refreshSchedule();
              render();
            }).catch(render);
          } else {
            refreshSchedule();
            render();
          }
        } else if (name === 'pdf') {
          openExecutivePdf();
        } else if (name === 'backup') {
          exportBackup();
        } else if (name === 'presentation') {
          togglePresentationMode();
        }
      }
      var detailTab = event.target && event.target.closest('[data-exec-detail-tab]');
      if (detailTab) {
        var targetTab = detailTab.getAttribute('data-exec-detail-tab');
        documentRef.querySelectorAll('[data-exec-detail-tab]').forEach(function (button) {
          button.classList.toggle('is-active', button === detailTab);
        });
        documentRef.querySelectorAll('[data-exec-detail-panel]').forEach(function (panel) {
          var active = panel.getAttribute('data-exec-detail-panel') === targetTab;
          panel.hidden = !active;
          panel.classList.toggle('is-active', active);
        });
      }
    });

    documentRef.addEventListener('input', function (event) {
      if (event.target && event.target.id === 'execV2HistorySearch') {
        state.historyQuery = event.target.value || '';
        clearTimeout(historySearchTimer);
        historySearchTimer = setTimeout(function () {
          render();
          if ($('execV2HistorySearch')) {
            $('execV2HistorySearch').focus();
            $('execV2HistorySearch').setSelectionRange(state.historyQuery.length, state.historyQuery.length);
          }
        }, 180);
      }
    });

    ['dateStart', 'dateEnd', 'agentFilter', 'bairroFilter', 'microareaFilter', 'quarteiraoFilter', 'logradouroFilter', 'situacaoFilter', 'operationFilter', 'focoFilter', 'gpsFilter', 'searchFilter'].forEach(function (id) {
      documentRef.addEventListener('change', function (event) {
        if (event.target && event.target.id === id) {
          setTimeout(render, 300);
        }
      });
    });
  }

  function installReportButton() {
    var actions = documentRef.querySelector('.panel-report-actions');
    if (!actions || $('reportExecutiveBtn')) {
      return;
    }
    var button = documentRef.createElement('button');
    button.className = 'btn btn-gps panel-action-exec';
    button.id = 'reportExecutivePanelBtn';
    button.type = 'button';
    button.setAttribute('data-exec-v2-action', 'pdf');
    button.textContent = 'PDF executivo';
    actions.insertBefore(button, actions.firstChild);
  }

  function boot() {
    bindEvents();
    orderSidebarNavigation();
    installReportButton();
    refreshSchedule();
    render();
    setTimeout(function () {
      orderSidebarNavigation();
      render();
    }, 1200);
    setTimeout(function () {
      orderSidebarNavigation();
      render();
    }, 2800);
    root.setInterval(function () {
      orderSidebarNavigation();
      refreshSchedule();
      render();
    }, 20000);
  }

  root.ACEPanelExecutivo = {
    version: VERSION,
    render: render,
    summarize: summarize,
    openExecutivePdf: openExecutivePdf,
    exportBackup: exportBackup,
    togglePresentationMode: togglePresentationMode,
    orderSidebarNavigation: orderSidebarNavigation
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
