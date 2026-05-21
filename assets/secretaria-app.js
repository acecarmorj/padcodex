(function () {
  'use strict';

  var CFG = window.ACS_RUNTIME_CONFIG || {};
  var API_URL = String(CFG.API_URL || CFG.SHEETS_WEBAPP_URL || '').trim();
  var STORAGE_KEY = 'ace.secretaria.session.v3';
  var REPORT_PRINT_KEY = 'ace.secretaria.report';
  var DOC_PRINT_KEY = 'ace.secretaria.doc';
  var state = {
    session: null,
    bundle: null,
    selectedPropertyUid: '',
    filters: {},
    currentDoc: null,
    currentReport: null,
    docStatusSaving: false,
    idleTimer: null,
    idleWarnTimer: null,
    sessionNote: ''
  };

  var DOCUMENT_TITLES = {
    solicitacao_vistoria: 'Solicitação de vistoria',
    denuncia_atendimento: 'Denúncia / registro de atendimento',
    notificacao_caixa: 'Notificação de caixa d’água destampada',
    notificacao_proprietario: 'Notificação para proprietário',
    notificacao_imobiliaria: 'Notificação para imobiliária / responsável',
    notificacao_foco: 'Notificação de foco / criadouro encontrado',
    notificacao_quintal: 'Notificação para limpeza de quintal / depósitos',
    notificacao_imovel_fechado: 'Notificação de imóvel fechado / acesso não permitido',
    notificacao_escada: 'Notificação para providência de acesso / escada',
    notificacao_laboratorio: 'Notificação com resultado laboratorial',
    comprovante_atendimento: 'Comprovante de atendimento',
    declaracao_comparecimento: 'Declaração de comparecimento',
    segunda_via_orientacao: 'Segunda via de orientação',
    segunda_via_notificacao: 'Segunda via de notificação',
    comunicado_orientacao: 'Comunicado de orientação ao morador',
    termo_ciencia: 'Termo de ciência e recebimento',
    oficio_encaminhamento: 'Ofício de encaminhamento',
    oficio_imobiliaria: 'Ofício para imobiliária / proprietário',
    oficio_supervisao: 'Ofício para apoio da supervisão',
    oficio_caixa: 'Ofício sobre caixa d’água / reservatório',
    oficio_laboratorio: 'Ofício com resultado de tubito / laboratório',
    memorando_supervisao: 'Memorando / despacho para supervisão',
    requisicao_visita: 'Requisição de visita / diligência',
    requisicao_retorno: 'Requisição de retorno ao imóvel',
    requisicao_escada: 'Requisição de apoio com escada',
    solicitacao_imobiliaria: 'Solicitação formal à imobiliária / responsável'
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(value) {
    return String(value === null || value === undefined ? '' : value);
  }

  function normalizeText(value) {
    return safeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateBR(value) {
    var text = safeText(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) { return safeText(value); }
    return text.slice(8, 10) + '/' + text.slice(5, 7) + '/' + text.slice(0, 4);
  }

  function formatDateTimeBR(value) {
    var text = safeText(value);
    if (!text) { return ''; }
    var parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return text;
    }
    return parsed.toLocaleString('pt-BR');
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthIso() {
    return todayIso().slice(0, 7);
  }

  function defaultFromIso() {
    var now = new Date();
    now.setDate(now.getDate() - 120);
    return now.toISOString().slice(0, 10);
  }


  function getIdleTimeoutMs() {
    var runtime = window.ACS_RUNTIME_CONFIG || {};
    var minutes = Number(runtime.SECRETARIA_IDLE_TIMEOUT_MINUTES || runtime.PANEL_IDLE_TIMEOUT_MINUTES || 20);
    if (!Number.isFinite(minutes) || minutes < 5) { minutes = 20; }
    return minutes * 60 * 1000;
  }

  function showMessage(targetId, message, isError) {
    var target = byId(targetId);
    if (!target) { return; }
    target.textContent = message || '';
    target.style.color = isError ? '#9b2c2c' : '';
  }

  function fieldValue(id) {
    var node = byId(id);
    return node ? safeText(node.value).trim() : '';
  }

  function firstFilled() {
    for (var i = 0; i < arguments.length; i += 1) {
      var value = safeText(arguments[i]).trim();
      if (value) { return value; }
    }
    return '';
  }


  function nowIsoString() {
    return new Date().toISOString();
  }

  function normalizeDocStatus(value) {
    var status = normalizeText(value);
    if (status.indexOf('cancel') > -1) { return 'Cancelado'; }
    if (status.indexOf('entreg') > -1 || status.indexOf('recebid') > -1) { return 'Entregue'; }
    if (status.indexOf('impres') > -1 || status.indexOf('emitid') > -1) { return 'Impresso'; }
    if (status.indexOf('gerad') > -1) { return 'Gerado'; }
    return safeText(value).trim() || 'Gerado';
  }

  function isFinalDocumentStatus(value) {
    var status = normalizeDocStatus(value);
    return status === 'Entregue' || status === 'Cancelado';
  }

  function isHistoryDocument(row) {
    return normalizeDocStatus(row && row.status) !== 'Gerado';
  }

  function historyDocuments(items) {
    return (items || []).filter(isHistoryDocument).sort(function (a, b) {
      return safeText(b.emitted_at || b.updatedAt || '').localeCompare(safeText(a.emitted_at || a.updatedAt || ''));
    });
  }

  function appendLifecycleNote(notes, status) {
    var marker = status + ' em ' + formatDateTimeBR(nowIsoString());
    var current = safeText(notes).trim();
    if (!current) { return marker; }
    if (current.indexOf(marker) > -1) { return current; }
    return current + ' | ' + marker;
  }

  function countPositiveTubitos(items) {
    return (items || []).filter(function (item) {
      var text = normalizeText(item.resultado_laboratorio || item.status_laboratorio || item.positivo_aedes || '');
      return text.indexOf('positivo') > -1 || text.indexOf('aedes') > -1 || text === 'sim';
    }).length;
  }

  function uniqueList(values) {
    var seen = {};
    return (values || []).filter(function (value) {
      value = safeText(value).trim();
      if (!value || seen[value]) { return false; }
      seen[value] = true;
      return true;
    });
  }

  function percentage(value, total) {
    if (!total) { return '0%'; }
    return (Math.round((Number(value || 0) / Number(total || 1)) * 1000) / 10).toFixed(1).replace('.0', '') + '%';
  }

  function upperMatricula(value) {
    return safeText(value).trim().toUpperCase();
  }

  function normalizeSituacao(value) {
    return normalizeText(value).replace(/\s+/g, ' ').trim();
  }

  function normalizeOperationMode(value) {
    var text = normalizeText(value).replace(/\s+/g, ' ').trim();
    if (!text) { return 'VD'; }
    if (text.indexOf('liraa') > -1) { return 'LIRAA'; }
    if (text === 'pe' || text.indexOf('p e') > -1 || text.indexOf('ponto estrategico') > -1 || text.indexOf('estrategico') > -1) { return 'P.E.'; }
    if (text === 'vd' || text.indexOf('visita domiciliar') > -1 || text.indexOf('domiciliar') > -1) { return 'VD'; }
    return safeText(value).trim().toUpperCase() || 'VD';
  }

  function operationModeFromVisit(visit) {
    return normalizeOperationMode(firstFilled(visit && visit.operation_mode, visit && visit.operational_mode, visit && visit.tipo_operacao, visit && visit.operationType, 'VD'));
  }

  function operationModeClass(value) {
    var mode = normalizeOperationMode(value);
    if (mode === 'LIRAA') { return 'purple'; }
    if (mode === 'P.E.') { return 'warn'; }
    return 'success';
  }

  function operationModeSummary(items) {
    var summary = { VD: 0, PE: 0, LIRAA: 0 };
    (items || []).forEach(function (visit) {
      var mode = operationModeFromVisit(visit);
      if (mode === 'LIRAA') { summary.LIRAA += 1; }
      else if (mode === 'P.E.') { summary.PE += 1; }
      else { summary.VD += 1; }
    });
    return summary;
  }


  function isClosedVisit(visit) {
    return normalizeSituacao(visit && visit.situacao).indexOf('fechado') > -1;
  }

  function isRecoveredVisit(visit) {
    return normalizeSituacao(visit && visit.situacao).indexOf('recuperado') > -1;
  }

  function hasTankIssue(visit) {
    var status = normalizeText(firstFilled(
      visit && visit.situacao_caixa_agua,
      visit && visit.water_tank_condition,
      visit && visit.acessou_caixa_agua,
      ''
    ));
    return !!status && (
      status.indexOf('destamp') > -1 ||
      status.indexOf('inadequ') > -1 ||
      status.indexOf('risco') > -1 ||
      status.indexOf('sem tampa') > -1 ||
      status.indexOf('nao vedada') > -1
    );
  }

  function isFinalizedStatus(value) {
    var status = normalizeText(value);
    return !!status && (
      status.indexOf('concl') > -1 ||
      status.indexOf('resol') > -1 ||
      status.indexOf('fechad') > -1 ||
      status.indexOf('cancel') > -1 ||
      status.indexOf('indefer') > -1 ||
      status.indexOf('finaliz') > -1 ||
      status.indexOf('encerr') > -1
    );
  }

  function isNegativeStatus(value) {
    var status = normalizeText(value);
    return !!status && (
      status === 'nao' ||
      status.indexOf('nao solicit') > -1 ||
      status.indexOf('sem necessidade') > -1 ||
      status.indexOf('dispens') > -1
    );
  }

  function hasLadderRecord(visit) {
    return safeText(firstFilled(
      visit && visit.ladder_support_status,
      visit && visit.solicita_escada,
      visit && visit.ladder_support_requested,
      ''
    )).trim() !== '';
  }

  function hasLadderNeed(visit) {
    var status = firstFilled(
      visit && visit.ladder_support_status,
      visit && visit.solicita_escada,
      visit && visit.ladder_support_requested,
      ''
    );
    var normalized = normalizeText(status);

    if (!normalized || isFinalizedStatus(normalized) || isNegativeStatus(normalized)) {
      return false;
    }

    return normalized === 'sim' ||
      normalized === 's' ||
      normalized.indexOf('solicit') > -1 ||
      normalized.indexOf('pend') > -1 ||
      normalized.indexOf('abert') > -1 ||
      normalized.indexOf('aguard') > -1 ||
      normalized.indexOf('necess') > -1 ||
      normalized.indexOf('precisa') > -1;
  }

  function isPositiveTubito(item) {
    return normalizeText(firstFilled(
      item && item.resultado_laboratorio,
      item && item.positivo_aedes,
      item && item.laboratorio_positivo_aedes,
      ''
    )).indexOf('positivo') > -1 || normalizeText(firstFilled(item && item.positivo_aedes, '')).indexOf('sim') > -1;
  }

  function usesNotificationDoc(doc) {
    var type = normalizeText(doc && doc.doc_type);
    return type.indexOf('notificacao') > -1 || type.indexOf('oficio') > -1 || type.indexOf('requisicao') > -1;
  }

  function groupCount(items, getter) {
    var acc = {};
    (items || []).forEach(function (item) {
      var key = safeText(getter(item)).trim() || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }

  function mapToSortedRows(mapObj, valueLabel) {
    return Object.keys(mapObj || {}).sort(function (a, b) {
      if (mapObj[b] !== mapObj[a]) { return mapObj[b] - mapObj[a]; }
      return safeText(a).localeCompare(safeText(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
    }).map(function (key) {
      return [key, String(mapObj[key] || 0), valueLabel || ''];
    });
  }

  function getAgentMetrics() {
    if (state.indexes && state.indexes.agentMetrics) {
      return state.indexes.agentMetrics;
    }

    var attendance = state.bundle && state.bundle.attendance || { rows: [], totals: {} };
    var visits = state.bundle && state.bundle.visits || [];
    var tubitos = state.bundle && state.bundle.tubitos || [];
    var documents = historyDocuments(state.bundle && state.bundle.documents || []);
    var earlyClosures = state.bundle && state.bundle.early_closures || [];
    var agents = state.bundle && state.bundle.agents || [];
    var rowsByMatricula = {};
    var results = [];

    agents.forEach(function (agent) {
      var key = upperMatricula(agent.matricula);
      if (!key) { return; }
      rowsByMatricula[key] = {
        matricula: safeText(agent.matricula),
        nome: safeText(agent.nome),
        role: safeText(agent.role),
        baseMicroarea: safeText(agent.base_microarea || agent.baseMicroarea),
        businessDays: 0,
        loggedDays: 0,
        missingDays: 0,
        lastLoginAt: '',
        visits: 0,
        workedProperties: 0,
        workedDays: 0,
        closed: 0,
        recovered: 0,
        openVisits: 0,
        deposits: 0,
        focos: 0,
        tubitos: 0,
        tubitosPositivos: 0,
        ladder: 0,
        caixasCriticas: 0,
        documents: 0,
        notificationDocs: 0,
        earlyClosures: 0,
        presenceRate: '0%',
        productivityRate: '0%',
        closedRate: '0%'
      };
    });

    (attendance.rows || []).forEach(function (item) {
      var key = upperMatricula(item.matricula);
      if (!rowsByMatricula[key]) {
        rowsByMatricula[key] = {
          matricula: safeText(item.matricula),
          nome: safeText(item.nome),
          role: safeText(item.role),
          baseMicroarea: '',
          visits: 0,
          workedProperties: 0,
          workedDays: 0,
          closed: 0,
          recovered: 0,
          openVisits: 0,
          deposits: 0,
          focos: 0,
          tubitos: 0,
          tubitosPositivos: 0,
          ladder: 0,
          caixasCriticas: 0,
          documents: 0,
          notificationDocs: 0,
          earlyClosures: 0
        };
      }
      rowsByMatricula[key].businessDays = Number(item.businessDays || 0);
      rowsByMatricula[key].loggedDays = Number(item.loggedDays || 0);
      rowsByMatricula[key].missingDays = Number(item.missingDays || 0);
      rowsByMatricula[key].lastLoginAt = safeText(item.lastLoginAt);
      rowsByMatricula[key].presenceRate = percentage(item.loggedDays || 0, item.businessDays || 0);
    });

    var propertySeen = {};
    var workedDaySeen = {};

    visits.forEach(function (visit) {
      var key = upperMatricula(firstFilled(visit.matricula, visit.agent_matricula));
      if (!key) { return; }
      if (!rowsByMatricula[key]) {
        rowsByMatricula[key] = {
          matricula: key,
          nome: safeText(firstFilled(visit.agente, visit.agent_name)),
          role: '',
          baseMicroarea: '',
          businessDays: 0,
          loggedDays: 0,
          missingDays: 0,
          lastLoginAt: '',
          presenceRate: '0%',
          visits: 0,
          workedProperties: 0,
          workedDays: 0,
          closed: 0,
          recovered: 0,
          openVisits: 0,
          deposits: 0,
          focos: 0,
          tubitos: 0,
          tubitosPositivos: 0,
          ladder: 0,
          caixasCriticas: 0,
          documents: 0,
          notificationDocs: 0,
          earlyClosures: 0
        };
      }
      var row = rowsByMatricula[key];
      row.visits += 1;
      row.deposits += Number(visit.deposit_count || 0);
      row.focos += Number(visit.focus_count || 0);
      row.tubitos += Number(visit.tubitos_qtd || 0);
      if (isClosedVisit(visit)) { row.closed += 1; }
      else if (isRecoveredVisit(visit)) { row.recovered += 1; }
      else { row.openVisits += 1; }
      if (hasLadderNeed(visit)) { row.ladder += 1; }
      if (hasTankIssue(visit)) { row.caixasCriticas += 1; }

      var propertyKey = key + '|' + safeText(visit.property_uid);
      if (safeText(visit.property_uid) && !propertySeen[propertyKey]) {
        propertySeen[propertyKey] = true;
        row.workedProperties += 1;
      }

      var dayKey = key + '|' + safeText(visit.data);
      if (safeText(visit.data) && !workedDaySeen[dayKey]) {
        workedDaySeen[dayKey] = true;
        row.workedDays += 1;
      }
    });

    tubitos.forEach(function (item) {
      var key = upperMatricula(firstFilled(item.matricula, item.agent_matricula));
      if (!key || !rowsByMatricula[key]) { return; }
      if (isPositiveTubito(item)) {
        rowsByMatricula[key].tubitosPositivos += 1;
      }
    });

    documents.forEach(function (doc) {
      var key = upperMatricula(firstFilled(doc.emitted_by_matricula, doc.agent_matricula));
      if (!key || !rowsByMatricula[key]) { return; }
      rowsByMatricula[key].documents += 1;
      if (usesNotificationDoc(doc)) {
        rowsByMatricula[key].notificationDocs += 1;
      }
    });

    earlyClosures.forEach(function (item) {
      var key = upperMatricula(firstFilled(item.actor_matricula, item.matricula));
      if (!key || !rowsByMatricula[key]) { return; }
      rowsByMatricula[key].earlyClosures += 1;
    });

    results = Object.keys(rowsByMatricula).map(function (key) {
      var row = rowsByMatricula[key];
      row.productivityRate = percentage(row.workedProperties || 0, row.visits || 0);
      row.closedRate = percentage(row.closed || 0, row.visits || 0);
      if (!row.presenceRate) {
        row.presenceRate = percentage(row.loggedDays || 0, row.businessDays || 0);
      }
      return row;
    }).sort(function (a, b) {
      if (b.visits !== a.visits) { return b.visits - a.visits; }
      return safeText(a.nome || a.matricula).localeCompare(safeText(b.nome || b.matricula), 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

    state.indexes = state.indexes || {};
    state.indexes.agentMetrics = results;
    return results;
  }

  function getAgentTerritoryRows() {
    if (state.indexes && state.indexes.agentTerritoryRows) {
      return state.indexes.agentTerritoryRows;
    }

    var grouped = {};
    var propertySeen = {};
    (state.bundle && state.bundle.visits || []).forEach(function (visit) {
      var matricula = upperMatricula(firstFilled(visit.matricula, visit.agent_matricula));
      if (!matricula) { return; }
      var bairro = firstFilled(visit.bairro, '—');
      var microarea = firstFilled(visit.microarea, '—');
      var quarteirao = firstFilled(visit.quarteirao, '—');
      var key = [matricula, bairro, microarea, quarteirao].join('|');
      if (!grouped[key]) {
        grouped[key] = {
          matricula: matricula,
          nome: safeText(firstFilled(visit.agente, visit.agent_name, matricula)),
          bairro: bairro,
          microarea: microarea,
          quarteirao: quarteirao,
          visitas: 0,
          imoveis: 0,
          vd: 0,
          pe: 0,
          liraa: 0,
          fechados: 0,
          recuperados: 0,
          depositos: 0,
          focos: 0,
          tubitos: 0,
          primeiraData: safeText(visit.data || ''),
          ultimaData: safeText(visit.data || '')
        };
      }

      var row = grouped[key];
      var mode = operationModeFromVisit(visit);
      row.visitas += 1;
      if (mode === 'LIRAA') { row.liraa += 1; }
      else if (mode === 'P.E.') { row.pe += 1; }
      else { row.vd += 1; }
      if (isClosedVisit(visit)) { row.fechados += 1; }
      if (isRecoveredVisit(visit)) { row.recuperados += 1; }
      row.depositos += Number(visit.deposit_count || 0);
      row.focos += Number(firstFilled(visit.deposit_focus_count, visit.focus_count, 0) || 0);
      row.tubitos += Number(visit.tubitos_qtd || 0);
      var date = safeText(visit.data || '');
      if (date && (!row.primeiraData || date < row.primeiraData)) { row.primeiraData = date; }
      if (date && (!row.ultimaData || date > row.ultimaData)) { row.ultimaData = date; }

      var propertyKey = key + '|' + safeText(visit.property_uid || '');
      if (safeText(visit.property_uid || '') && !propertySeen[propertyKey]) {
        propertySeen[propertyKey] = true;
        row.imoveis += 1;
      }
    });

    var rows = Object.keys(grouped).map(function (key) {
      return grouped[key];
    }).sort(function (a, b) {
      if (safeText(a.nome).localeCompare(safeText(b.nome), 'pt-BR', { numeric: true, sensitivity: 'base' }) !== 0) {
        return safeText(a.nome).localeCompare(safeText(b.nome), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      if (safeText(a.microarea).localeCompare(safeText(b.microarea), 'pt-BR', { numeric: true, sensitivity: 'base' }) !== 0) {
        return safeText(a.microarea).localeCompare(safeText(b.microarea), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      return safeText(a.quarteirao).localeCompare(safeText(b.quarteirao), 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

    state.indexes = state.indexes || {};
    state.indexes.agentTerritoryRows = rows;
    return rows;
  }

  function getDailyPresenceSummary() {
    if (state.indexes && state.indexes.dailyPresenceSummary) {
      return state.indexes.dailyPresenceSummary;
    }
    var rows = state.bundle && state.bundle.attendance_rows || [];
    var grouped = {};
    rows.forEach(function (item) {
      var date = safeText(item.date);
      if (!date) { return; }
      if (!grouped[date]) {
        grouped[date] = { date: date, agents: 0, logins: 0, first: '', last: '' };
      }
      grouped[date].agents += 1;
      grouped[date].logins += Number(item.login_count || 0);
      var first = safeText(item.first_login_at);
      var last = safeText(item.last_login_at);
      if (first && (!grouped[date].first || first < grouped[date].first)) { grouped[date].first = first; }
      if (last && (!grouped[date].last || last > grouped[date].last)) { grouped[date].last = last; }
    });
    var summary = Object.keys(grouped).sort(function (a, b) { return b.localeCompare(a); }).map(function (date) {
      return grouped[date];
    });
    state.indexes = state.indexes || {};
    state.indexes.dailyPresenceSummary = summary;
    return summary;
  }

  function getTankRows() {
    return (state.bundle && state.bundle.visits || []).filter(function (visit) {
      return safeText(firstFilled(visit.situacao_caixa_agua, visit.water_tank_condition, visit.acessou_caixa_agua, '')).trim() !== '';
    });
  }

  function getLadderRows() {
    return (state.bundle && state.bundle.visits || []).filter(function (visit) {
      return hasLadderRecord(visit);
    });
  }

  function getPositiveTubitosRows() {
    return (state.bundle && state.bundle.tubitos || []).filter(function (item) {
      return isPositiveTubito(item);
    });
  }


  function markActionSelection(selector, activeValue, attrName) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (button) {
      var value = safeText(button.getAttribute(attrName)).trim();
      button.classList.toggle('is-selected', value === activeValue);
    });
  }

  function postApi(payload) {
    if (!API_URL) {
      return Promise.reject(new Error('URL da API não configurada.'));
    }
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {})
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha HTTP ' + response.status + '.');
      }
      return response.json();
    }).then(function (data) {
      if (!data || data.ok !== true) {
        throw new Error(safeText(data && data.error || 'Resposta inválida da API.'));
      }
      return data;
    });
  }

  function saveSession(session) {
    state.session = session || null;
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) { return null; }
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function clearIdleTimers() {
    if (state.idleWarnTimer) {
      clearTimeout(state.idleWarnTimer);
      state.idleWarnTimer = null;
    }
    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
  }

  function resetIdleTimer() {
    var timeout = getIdleTimeoutMs();
    clearIdleTimers();
    if (!state.session) { return; }
    state.sessionNote = '';
    setSessionInfo();
    if (timeout > 90000) {
      state.idleWarnTimer = setTimeout(function () {
        if (!state.session) { return; }
        state.sessionNote = 'Sessão perto de expirar por inatividade';
        setSessionInfo();
      }, timeout - 60000);
    }
    state.idleTimer = setTimeout(function () {
      expireForInactivity();
    }, timeout);
  }

  function registerActivity() {
    if (!state.session) { return; }
    resetIdleTimer();
  }

  function expireForInactivity() {
    var token = state.session && state.session.sessionToken;
    clearIdleTimers();
    state.sessionNote = '';
    state.currentDoc = null;
    state.currentReport = null;
    saveSession(null);
    state.bundle = null;
    state.selectedPropertyUid = '';
    document.body.classList.remove('secretaria-app-ready');
    if (byId('appSection')) { byId('appSection').classList.add('hidden'); }
    if (byId('loginSection')) { byId('loginSection').classList.remove('hidden'); }
    if (byId('loginSenha')) { byId('loginSenha').value = ''; }
    if (byId('docPreview')) { byId('docPreview').innerHTML = 'Escolha um modelo para gerar a pré-visualização.'; }
    if (byId('reportPreview')) { byId('reportPreview').innerHTML = 'Escolha um relatório para gerar a visualização pronta para impressão.'; }
    if (byId('printDocBtn')) { byId('printDocBtn').disabled = true; }
    updateCurrentDocumentActions();
    if (byId('printReportBtn')) { byId('printReportBtn').disabled = true; }
    showMessage('loginMsg', 'Sessão da secretaria encerrada por inatividade. Entre novamente para continuar.', true);
    if (!token) { return; }
    postApi({
      action: 'panel_private_logout',
      access_module: 'secretaria',
      sessionToken: token
    }).catch(function () {});
  }

  function buildIndexes() {
    var bundle = state.bundle || {};
    var properties = bundle.properties || [];
    var visits = bundle.visits || [];
    var tubitos = bundle.tubitos || [];
    var docs = bundle.documents || [];
    var supervision = bundle.supervision_requests || [];
    var earlyClosures = bundle.early_closures || [];
    var attendanceRows = (bundle.attendance && bundle.attendance.rows) || [];

    var propertyByUid = {};
    var visitsByProperty = {};
    var tubitosByProperty = {};
    var docsByProperty = {};
    var latestVisitByProperty = {};
    var agentsByMatricula = {};

    (bundle.agents || []).forEach(function (agent) {
      agentsByMatricula[safeText(agent.matricula).trim().toUpperCase()] = agent;
    });

    properties.forEach(function (property) {
      propertyByUid[safeText(property.uid)] = property;
      visitsByProperty[safeText(property.uid)] = [];
      tubitosByProperty[safeText(property.uid)] = [];
      docsByProperty[safeText(property.uid)] = [];
    });

    visits.forEach(function (visit) {
      var key = safeText(visit.property_uid).trim();
      if (!key) { return; }
      if (!visitsByProperty[key]) { visitsByProperty[key] = []; }
      visitsByProperty[key].push(visit);
      var current = latestVisitByProperty[key];
      var stamp = safeText(visit.updatedAt || visit.data) + ' ' + safeText(visit.hora);
      var currentStamp = current ? safeText(current.updatedAt || current.data) + ' ' + safeText(current.hora) : '';
      if (!current || stamp > currentStamp) {
        latestVisitByProperty[key] = visit;
      }
    });

    tubitos.forEach(function (item) {
      var key = safeText(item.property_uid).trim();
      if (!key) {
        var visitKey = safeText(item.visit_uid).trim();
        if (visitKey) {
          var visit = visits.find(function (row) { return safeText(row.uid).trim() === visitKey; });
          key = safeText(visit && visit.property_uid);
        }
      }
      if (!key) { return; }
      if (!tubitosByProperty[key]) { tubitosByProperty[key] = []; }
      tubitosByProperty[key].push(item);
    });

    docs.forEach(function (item) {
      var key = safeText(item.property_uid).trim();
      if (!key) { return; }
      if (!docsByProperty[key]) { docsByProperty[key] = []; }
      docsByProperty[key].push(item);
    });

    state.indexes = {
      propertyByUid: propertyByUid,
      visitsByProperty: visitsByProperty,
      tubitosByProperty: tubitosByProperty,
      docsByProperty: docsByProperty,
      latestVisitByProperty: latestVisitByProperty,
      supervision: supervision,
      earlyClosures: earlyClosures,
      attendanceRows: attendanceRows,
      agentsByMatricula: agentsByMatricula
    };
  }

  function collectOptions(values) {
    var seen = {};
    return values.filter(function (value) {
      value = safeText(value).trim();
      if (!value || seen[value]) { return false; }
      seen[value] = true;
      return true;
    }).sort(function (a, b) {
      return safeText(a).localeCompare(safeText(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }

  function fillSelect(id, items) {
    var select = byId(id);
    if (!select) { return; }
    var first = select.options[0] ? select.options[0].outerHTML : '<option value="">Todos</option>';
    select.innerHTML = first + items.map(function (item) {
      return '<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + '</option>';
    }).join('');
  }


  function renderStats() {
    var counts = state.bundle && state.bundle.counts || {};
    var attendance = state.bundle && state.bundle.attendance || { totals: {} };
    var pending = computePendingItems();
    var tubitos = state.bundle && state.bundle.tubitos || [];
    var positives = countPositiveTubitos(tubitos);
    var agents = getAgentMetrics();
    var visits = state.bundle && state.bundle.visits || [];
    var modeSummary = operationModeSummary(visits);
    var totalVisits = agents.reduce(function (sum, row) { return sum + Number(row.visits || 0); }, 0);
    var totalClosed = agents.reduce(function (sum, row) { return sum + Number(row.closed || 0); }, 0);
    var stats = [
      { label: 'Imóveis consultáveis', value: counts.properties || 0, note: 'base disponível para atendimento' },
      { label: 'Visitas no período', value: counts.visits || 0, note: 'histórico filtrado para consulta' },
      { label: 'VD no período', value: modeSummary.VD || 0, note: 'visitas domiciliares identificadas' },
      { label: 'P.E. no período', value: modeSummary.PE || 0, note: 'pontos estratégicos identificados' },
      { label: 'LIRAA no período', value: modeSummary.LIRAA || 0, note: 'registros do levantamento LIRAA' },
      { label: 'Pendências ativas', value: pending.length, note: 'supervisão, escadas, fechados, foco e caixas' },
      { label: 'Tubitos / positivos', value: (counts.tubitos || 0) + ' / ' + positives, note: 'coletas com destaque laboratorial' },
      { label: 'Documentos emitidos', value: historyDocuments(state.bundle && state.bundle.documents || []).length, note: 'histórico registrado pela secretaria' },
      { label: 'Agentes sem login', value: attendance.totals && attendance.totals.missingDays || 0, note: 'ausências no mês selecionado' },
      { label: 'Produção total dos agentes', value: totalVisits, note: 'somatório das visitas filtradas' },
      { label: 'Fechados no período', value: totalClosed, note: 'visitas marcadas como fechadas' }
    ];
    byId('stats').innerHTML = stats.map(function (item) {
      return '<div class="stat"><div class="kicker">' + escapeHtml(item.label) + '</div><strong>' + escapeHtml(item.value) + '</strong><div class="small muted">' + escapeHtml(item.note) + '</div></div>';
    }).join('');
  }

  function setSessionInfo() {
    if (!state.session) { return; }
    var nome = safeText(state.session.nome) || '—';
    var matricula = safeText(state.session.matricula) || '—';
    var role = safeText(state.session.role) || '—';
    byId('sessionInfo').textContent =
      'Usuário: ' + nome +
      ' • Matrícula: ' + matricula +
      ' • Perfil: ' + role;
    if (byId('sessionName')) { byId('sessionName').textContent = nome; }
    if (byId('sessionMatricula')) { byId('sessionMatricula').textContent = matricula; }
    if (byId('sessionRole')) { byId('sessionRole').textContent = role; }
  }

  function activeTextFilter() {
    return normalizeText(byId('searchText').value);
  }

  function agentMatchForProperty(propertyUid, matriculaFilter, textFilter) {
    if (!matriculaFilter && !textFilter) { return true; }
    var visits = state.indexes.visitsByProperty[propertyUid] || [];
    return visits.some(function (visit) {
      var matricula = safeText(visit.matricula).trim();
      if (matriculaFilter && matricula !== matriculaFilter) { return false; }
      if (!textFilter) { return true; }
      return normalizeText(visit.agente + ' ' + visit.matricula).indexOf(textFilter) > -1;
    });
  }

  function propertyMatchesFilters(property) {
    var textFilter = activeTextFilter();
    var bairro = safeText(byId('searchBairro').value).trim();
    var microarea = safeText(byId('searchMicroarea').value).trim();
    var matricula = safeText(byId('searchMatricula').value).trim();
    if (bairro && safeText(property.bairro).trim() !== bairro) { return false; }
    if (microarea && safeText(property.microarea).trim() !== microarea) { return false; }
    if (matricula && !agentMatchForProperty(safeText(property.uid), matricula, '')) { return false; }

    if (!textFilter) { return true; }

    var haystack = normalizeText([
      property.morador, property.telefone, property.bairro, property.microarea, property.quarteirao,
      property.logradouro, property.numero, property.complemento, property.referencia, property.obs
    ].join(' '));

    if (haystack.indexOf(textFilter) > -1) { return true; }

    return agentMatchForProperty(safeText(property.uid), '', textFilter);
  }

  function filteredProperties() {
    var properties = state.bundle && state.bundle.properties || [];
    return properties.filter(propertyMatchesFilters).sort(function (a, b) {
      var nameA = safeText(a.morador || a.logradouro || a.uid);
      var nameB = safeText(b.morador || b.logradouro || b.uid);
      return nameA.localeCompare(nameB, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }

  function propertyAddress(property) {
    var parts = [property.logradouro, property.numero];
    if (safeText(property.complemento).trim()) {
      parts.push(property.complemento);
    }
    parts.push(property.bairro);
    return parts.filter(Boolean).join(', ');
  }

  function propertyNotifications(property) {
    var propertyUid = safeText(property.uid).trim();
    var docs = state.indexes.docsByProperty[propertyUid] || [];
    var visits = state.indexes.visitsByProperty[propertyUid] || [];
    var latest = state.indexes.latestVisitByProperty[propertyUid];
    var notifications = [];

    docs.forEach(function (doc) {
      notifications.push({
        kind: 'documento',
        title: safeText(doc.doc_title || DOCUMENT_TITLES[doc.doc_type] || doc.doc_type || 'Documento'),
        status: safeText(doc.status || 'Emitido'),
        date: safeText(doc.emitted_at || doc.updatedAt),
        notes: safeText(doc.notes)
      });
    });

    if (latest) {
      var ladder = safeText(latest.ladder_support_status || latest.solicita_escada || latest.ladder_support_requested).trim();
      if (ladder) {
        notifications.push({
          kind: 'escada',
          title: 'Solicitação de apoio com escada',
          status: ladder,
          date: safeText(latest.updatedAt || latest.data),
          notes: safeText(latest.motivo_nao_solicitou_escada || latest.ladder_support_no_reason || latest.motivo_caixa_agua || latest.water_access_reason)
        });
      }

      var tankCondition = safeText(latest.situacao_caixa_agua || latest.water_tank_condition).trim();
      if (tankCondition) {
        notifications.push({
          kind: 'caixa',
          title: 'Situação da caixa d’água',
          status: tankCondition,
          date: safeText(latest.updatedAt || latest.data),
          notes: safeText(latest.tratamento_caixa_agua || latest.water_tank_treatment || latest.motivo_caixa_agua || latest.water_access_reason)
        });
      }
    }

    visits.forEach(function (visit) {
      if (safeText(visit.situacao).toLowerCase() === 'fechado' || safeText(visit.closed_reason).trim()) {
        notifications.push({
          kind: 'visita',
          title: 'Visita com imóvel fechado',
          status: safeText(visit.situacao || 'Fechado'),
          date: safeText(visit.data),
          notes: safeText(visit.closed_reason || visit.motivo_fechado)
        });
      }
    });

    return notifications.sort(function (a, b) {
      return safeText(b.date).localeCompare(safeText(a.date));
    });
  }

  function renderResults() {
    var items = filteredProperties();
    var resultsNode = byId('searchResults');
    byId('resultCount').textContent = items.length + ' resultado(s)';
    if (!items.length) {
      resultsNode.innerHTML = '<div class="empty">Nenhum imóvel encontrado com os filtros atuais.</div>';
      byId('propertyDetail').innerHTML = '<div class="empty">Selecione um imóvel para ver histórico, tubitos, pendências e documentos.</div>';
      state.selectedPropertyUid = '';
      renderDocumentContext();
      return;
    }

    if (!state.selectedPropertyUid || !items.some(function (item) { return safeText(item.uid) === safeText(state.selectedPropertyUid); })) {
      state.selectedPropertyUid = safeText(items[0].uid);
    }

    resultsNode.innerHTML = items.map(function (property) {
      var uid = safeText(property.uid);
      var latest = state.indexes.latestVisitByProperty[uid];
      var tubitos = state.indexes.tubitosByProperty[uid] || [];
      var docs = historyDocuments(state.indexes.docsByProperty[uid] || []);
      var notifications = propertyNotifications(property);
      return [
        '<div class="result-item ' + (uid === state.selectedPropertyUid ? 'active' : '') + '" data-property="' + escapeHtml(uid) + '">',
        '<h3>' + escapeHtml(safeText(property.morador) || 'Sem morador informado') + '</h3>',
        '<div>' + escapeHtml(propertyAddress(property)) + '</div>',
        '<div class="small muted">Microárea ' + escapeHtml(property.microarea) + ' • Quarteirão ' + escapeHtml(property.quarteirao) + ' • Tel.: ' + escapeHtml(property.telefone || '—') + '</div>',
        '<div class="badge-row">',
        latest ? '<span class="badge">Última visita: ' + escapeHtml(formatDateBR(latest.data)) + '</span>' : '<span class="badge warn">Sem visita no período</span>',
        latest ? '<span class="badge ' + operationModeClass(operationModeFromVisit(latest)) + '">Modo: ' + escapeHtml(operationModeFromVisit(latest)) + '</span>' : '',
        tubitos.length ? '<span class="badge success">Tubitos: ' + tubitos.length + '</span>' : '<span class="badge">Sem tubitos</span>',
        docs.length ? '<span class="badge">Documentos: ' + docs.length + '</span>' : '',
        notifications.length ? '<span class="badge warn">Pendências / notificações: ' + notifications.length + '</span>' : '',
        '</div>',
        '</div>'
      ].join('');
    }).join('');

    Array.prototype.forEach.call(resultsNode.querySelectorAll('[data-property]'), function (button) {
      button.addEventListener('click', function () {
        state.selectedPropertyUid = safeText(button.getAttribute('data-property'));
        renderResults();
      });
    });

    renderPropertyDetail(state.selectedPropertyUid);
    renderDocumentContext();
  }


  function renderPropertyDetail(propertyUid) {
    var property = state.indexes.propertyByUid[propertyUid];
    var container = byId('propertyDetail');
    if (!property) {
      container.innerHTML = '<div class="empty">Selecione um imóvel para ver o atendimento.</div>';
      return;
    }

    var visits = (state.indexes.visitsByProperty[propertyUid] || []).slice().sort(function (a, b) {
      return safeText(b.data + ' ' + b.hora).localeCompare(safeText(a.data + ' ' + a.hora));
    });
    var tubitos = (state.indexes.tubitosByProperty[propertyUid] || []).slice().sort(function (a, b) {
      return safeText(b.data_coleta + ' ' + b.hora_coleta).localeCompare(safeText(a.data_coleta + ' ' + a.hora_coleta));
    });
    var notifications = propertyNotifications(property);
    var latest = state.indexes.latestVisitByProperty[propertyUid];
    var positiveTubitos = countPositiveTubitos(tubitos);
    var modeSummary = operationModeSummary(visits);

    container.innerHTML = [
      '<div class="detail-panels">',
      '<div class="detail-card">',
      '<div class="section-title"><h3>' + escapeHtml(safeText(property.morador) || 'Sem morador informado') + '</h3><span class="small muted">UID ' + escapeHtml(property.uid) + '</span></div>',
      '<div><strong>Endereço:</strong> ' + escapeHtml(propertyAddress(property)) + '</div>',
      '<div><strong>Telefone:</strong> ' + escapeHtml(property.telefone || '—') + '</div>',
      '<div><strong>Microárea / quarteirão:</strong> ' + escapeHtml(property.microarea || '—') + ' • ' + escapeHtml(property.quarteirao || '—') + '</div>',
      '<div><strong>Referência:</strong> ' + escapeHtml(property.referencia || '—') + '</div>',
      '<div><strong>Observações cadastrais:</strong> ' + escapeHtml(property.obs || '—') + '</div>',
      '<div class="badge-row" style="margin-top:10px">',
      latest ? '<span class="badge">Última visita: ' + escapeHtml(formatDateBR(latest.data)) + ' às ' + escapeHtml(latest.hora || '—') + '</span>' : '<span class="badge warn">Sem visita no período</span>',
      latest ? '<span class="badge ' + operationModeClass(operationModeFromVisit(latest)) + '">Modo atual: ' + escapeHtml(operationModeFromVisit(latest)) + '</span>' : '',
      visits.length ? '<span class="badge">Histórico no período: ' + visits.length + '</span>' : '',
      visits.length ? '<span class="badge success">VD: ' + modeSummary.VD + '</span>' : '',
      visits.length ? '<span class="badge warn">P.E.: ' + modeSummary.PE + '</span>' : '',
      visits.length ? '<span class="badge purple">LIRAA: ' + modeSummary.LIRAA + '</span>' : '',
      tubitos.length ? '<span class="badge success">Tubitos: ' + tubitos.length + '</span>' : '<span class="badge">Sem tubitos</span>',
      positiveTubitos ? '<span class="badge warn">Tubitos positivos: ' + positiveTubitos + '</span>' : '',
      notifications.length ? '<span class="badge warn">Pendências / notificações: ' + notifications.length + '</span>' : '',
      '</div>',
      '</div>',

      '<div class="detail-card">',
      '<h3>Último atendimento registrado</h3>',
      latest ? [
        '<div><strong>Situação:</strong> ' + escapeHtml(latest.situacao || '—') + '</div>',
        '<div><strong>Agente:</strong> ' + escapeHtml(firstFilled(latest.agente, latest.matricula, '—')) + '</div>',
        '<div><strong>Modo operacional:</strong> ' + escapeHtml(operationModeFromVisit(latest)) + '</div>',
        '<div><strong>Depósitos / focos:</strong> ' + escapeHtml(String(latest.deposit_count || 0)) + ' / ' + escapeHtml(String(latest.focus_count || 0)) + '</div>',
        '<div><strong>Caixa d’água:</strong> ' + escapeHtml(firstFilled(latest.situacao_caixa_agua, latest.water_tank_condition, '—')) + '</div>',
        '<div><strong>Escada / apoio:</strong> ' + escapeHtml(firstFilled(latest.ladder_support_status, latest.solicita_escada, latest.ladder_support_requested, '—')) + '</div>',
        '<div><strong>Observação:</strong> ' + escapeHtml(firstFilled(latest.obs, latest.closed_reason, latest.motivo_fechado, '—')) + '</div>'
      ].join('') : '<div class="empty">Nenhum atendimento localizado no período filtrado.</div>',
      '</div>',

      '<div class="detail-card">',
      '<h3>Pendências e notificações</h3>',
      notifications.length ? '<div class="subtle-list">' + notifications.slice(0, 12).map(function (item) {
        return '<div class="subtle-item"><strong>' + escapeHtml(item.title) + '</strong><div class="small muted">' + escapeHtml(formatDateBR(item.date)) + ' • ' + escapeHtml(item.status || '—') + '</div><div>' + escapeHtml(item.notes || '—') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty">Sem pendências ativas para este imóvel no contexto atual.</div>',
      '</div>',

      '<div class="detail-card">',
      '<h3>Histórico básico de visitas</h3>',
      makeTable(['Data', 'Modo', 'Situação', 'Agente', 'Depósitos', 'Focos', 'Escada'], visits.slice(0, 15).map(function (visit) {
        return [
          escapeHtml(formatDateBR(visit.data) + ' ' + safeText(visit.hora)),
          escapeHtml(operationModeFromVisit(visit)),
          escapeHtml(visit.situacao || '—'),
          escapeHtml(firstFilled(visit.agente, visit.matricula, '—')),
          escapeHtml(String(visit.deposit_count || 0)),
          escapeHtml(String(visit.focus_count || 0)),
          escapeHtml(firstFilled(visit.ladder_support_status, visit.solicita_escada, visit.ladder_support_requested, '—'))
        ];
      })),
      '</div>',

      '<div class="detail-card">',
      '<h3>Tubitos e laboratório</h3>',
      makeTable(['Tubito', 'Coleta', 'Status', 'Resultado', 'Espécie'], tubitos.slice(0, 20).map(function (item) {
        return [
          escapeHtml(item.numero_tubito || item.uid || '—'),
          escapeHtml(formatDateBR(item.data_coleta) + ' ' + safeText(item.hora_coleta)),
          escapeHtml(item.status_laboratorio || '—'),
          escapeHtml(item.resultado_laboratorio || '—'),
          escapeHtml(item.especie || '—')
        ];
      })),
      '</div>',
      '</div>'
    ].join('');
  }

  function activeContext() {
    var property = state.indexes.propertyByUid[state.selectedPropertyUid] || null;
    var latest = property ? state.indexes.latestVisitByProperty[safeText(property.uid)] : null;
    return {
      property: property,
      latestVisit: latest
    };
  }

  function fillManualContext(context) {
    var property = context.property ? Object.assign({}, context.property) : {};
    var latestVisit = context.latestVisit ? Object.assign({}, context.latestVisit) : {};

    if (byId('manualRecipient').value.trim()) {
      property.morador = byId('manualRecipient').value.trim();
    }
    if (byId('manualAddress').value.trim()) {
      var parts = byId('manualAddress').value.split(',');
      property.logradouro = parts.shift() || '';
      property.numero = parts.join(',').trim();
      property.bairro = property.bairro || '';
    }
    if (byId('manualObs').value.trim()) {
      property.obs = byId('manualObs').value.trim();
      latestVisit.obs = latestVisit.obs || property.obs;
    }
    return { property: property, latestVisit: latestVisit };
  }


  function renderDocumentContext() {
    var context = activeContext();
    var lines = [];
    if (context.property) {
      lines.push('Imóvel selecionado: ' + safeText(context.property.morador || 'Sem morador'));
      lines.push(propertyAddress(context.property));
      lines.push('Documentos já emitidos: ' + safeText(historyDocuments(state.indexes.docsByProperty[safeText(context.property.uid)] || []).length));
    } else {
      lines.push('Nenhum imóvel selecionado. Você pode usar os campos manuais para emitir documento livre.');
    }
    byId('docContext').textContent = lines.join(' • ');

    var rawDocs = context.property ? (state.indexes.docsByProperty[safeText(context.property.uid)] || []) : (state.bundle.documents || []);
    var docs = historyDocuments(rawDocs);
    byId('documentLog').innerHTML = docs.length ? [
      '<div class="small muted" style="margin-bottom:8px">Mostrando os 10 últimos documentos impressos, entregues ou cancelados.</div>',
      docs.slice(0, 10).map(function (item) {
        var status = normalizeDocStatus(item.status);
        var canDeliver = status === 'Impresso';
        var canCancel = status === 'Impresso';
        var actions = (!canDeliver && !canCancel) ? '' : [
          '<div class="quick-row" style="margin-top:8px">',
          canDeliver ? '<button class="secondary" data-doc-log-action="Entregue" data-doc-id="' + escapeHtml(item.doc_id) + '">Marcar entregue</button>' : '',
          canCancel ? '<button class="danger" data-doc-log-action="Cancelado" data-doc-id="' + escapeHtml(item.doc_id) + '">Cancelar</button>' : '',
          '</div>'
        ].join('');
        return '<div class="subtle-item"><strong>' + escapeHtml(item.doc_title || DOCUMENT_TITLES[item.doc_type] || item.doc_type) + '</strong><div class="small muted">' + escapeHtml(formatDateTimeBR(item.emitted_at || item.updatedAt)) + ' • ' + escapeHtml(status) + '</div><div>' + escapeHtml(item.address_label || propertyAddress(context.property || {})) + '</div>' + actions + '</div>';
      }).join('')
    ].join('') : '<div class="empty">Nenhum documento impresso, entregue ou cancelado para o contexto atual.</div>';
  }

  function fillManualContext(context) {
    var property = context.property ? Object.assign({}, context.property) : {};
    var latestVisit = context.latestVisit ? Object.assign({}, context.latestVisit) : {};

    if (fieldValue('manualRecipient')) {
      property.morador = fieldValue('manualRecipient');
    }
    if (fieldValue('manualAddress')) {
      var parts = fieldValue('manualAddress').split(',');
      property.logradouro = safeText(parts.shift()).trim();
      property.numero = safeText(parts.join(',')).trim();
      property.bairro = property.bairro || '';
    }
    if (fieldValue('manualObs')) {
      property.obs = fieldValue('manualObs');
      latestVisit.obs = latestVisit.obs || property.obs;
    }
    latestVisit.__protocol = fieldValue('manualProtocol');
    latestVisit.__deadline = fieldValue('manualPrazo');
    latestVisit.__sector = fieldValue('manualSetor');
    latestVisit.__reference = fieldValue('manualReference');
    return { property: property, latestVisit: latestVisit };
  }

  function buildDocumentPayload(docType) {
    var context = fillManualContext(activeContext());
    var property = context.property || {};
    var visit = context.latestVisit || {};
    var recipientType = fieldValue('manualRecipientType') || inferRecipientType(docType);
    var title = DOCUMENT_TITLES[docType] || 'Documento';
    var today = formatDateBR(todayIso());
    var address = propertyAddress(property) || fieldValue('manualAddress') || '_____________________________________';
    var recipient = safeText(property.morador || fieldValue('manualRecipient')).trim() || '_____________________________________';
    var agentName = safeText(visit.agente || state.session && state.session.nome).trim();
    var agentMatricula = safeText(visit.matricula || state.session && state.session.matricula).trim();
    var notes = safeText(fieldValue('manualObs') || visit.obs || property.obs).trim();
    var protocol = safeText(visit.__protocol).trim();
    var deadline = safeText(visit.__deadline).trim();
    var sector = safeText(visit.__sector).trim();
    var reference = safeText(visit.__reference).trim();

    return {
      docId: ['DOC', Date.now(), Math.random().toString(16).slice(2)].join('-'),
      docType: docType,
      title: title,
      status: 'Gerado',
      emittedAt: nowIsoString(),
      registered: false,
      context: {
        property: property,
        visit: visit,
        address: address,
        recipient: recipient,
        recipientType: recipientType,
        notes: notes,
        agentName: agentName,
        agentMatricula: agentMatricula,
        protocol: protocol,
        deadline: deadline,
        sector: sector,
        reference: reference
      },
      html: wrapPrintableHtml(title, buildDocumentBody(docType, {
        title: title,
        today: today,
        recipient: recipient,
        recipientType: recipientType,
        property: property,
        visit: visit,
        address: address,
        agentName: agentName,
        agentMatricula: agentMatricula,
        notes: notes,
        protocol: protocol,
        deadline: deadline,
        sector: sector,
        reference: reference
      }))
    };
  }

  function inferRecipientType(docType) {
    if (docType === 'notificacao_proprietario' || docType === 'oficio_imobiliaria' || docType === 'solicitacao_imobiliaria') { return 'Proprietário'; }
    if (docType === 'notificacao_imobiliaria') { return 'Imobiliária'; }
    if (docType === 'denuncia_atendimento' || docType === 'declaracao_comparecimento' || docType === 'comprovante_atendimento') { return 'Cidadão'; }
    if (docType === 'oficio_supervisao' || docType === 'memorando_supervisao' || docType === 'oficio_encaminhamento') { return 'Setor interno'; }
    return 'Morador';
  }

  function buildDocumentBody(docType, ctx) {
    var latestStatus = firstFilled(ctx.visit.situacao_caixa_agua, ctx.visit.water_tank_condition, ctx.visit.acessou_caixa_agua, 'Não informado');
    var ladderText = firstFilled(ctx.visit.ladder_support_status, ctx.visit.solicita_escada, ctx.visit.ladder_support_requested, 'Não informado');
    var focusText = firstFilled(ctx.visit.deposit_focus_count, ctx.visit.focus_count, '0');
    var tubitoText = firstFilled(ctx.visit.tubitos_qtd, '0');
    var meta = [
      '<div class="doc-meta">',
      '<div><strong>Data:</strong> ' + escapeHtml(ctx.today) + '</div>',
      '<div><strong>Destinatário:</strong> ' + escapeHtml(ctx.recipient) + '</div>',
      '<div><strong>Tipo:</strong> ' + escapeHtml(ctx.recipientType || '—') + '</div>',
      '<div><strong>Endereço:</strong> ' + escapeHtml(ctx.address) + '</div>',
      '<div><strong>Bairro / microárea:</strong> ' + escapeHtml(firstFilled(ctx.property.bairro, '—')) + ' • ' + escapeHtml(firstFilled(ctx.property.microarea, '—')) + '</div>',
      '<div><strong>Quarteirão:</strong> ' + escapeHtml(firstFilled(ctx.property.quarteirao, '—')) + '</div>',
      '<div><strong>Última situação registrada:</strong> ' + escapeHtml(firstFilled(ctx.visit.situacao, latestStatus, '—')) + '</div>',
      ctx.protocol ? '<div><strong>Protocolo:</strong> ' + escapeHtml(ctx.protocol) + '</div>' : '',
      ctx.deadline ? '<div><strong>Prazo:</strong> ' + escapeHtml(ctx.deadline) + '</div>' : '',
      ctx.sector ? '<div><strong>Setor / origem:</strong> ' + escapeHtml(ctx.sector) + '</div>' : '',
      ctx.reference ? '<div><strong>Referência:</strong> ' + escapeHtml(ctx.reference) + '</div>' : '',
      '</div>'
    ].join('');

    var observations = [
      '<div class="doc-box">',
      '<strong>Observações / fundamento básico</strong>',
      '<div style="margin-top:6px">' + escapeHtml(firstFilled(
        ctx.notes,
        ctx.visit.closed_reason,
        ctx.visit.motivo_fechado,
        ctx.visit.tratamento_caixa_agua,
        ctx.visit.water_tank_treatment,
        ctx.visit.motivo_caixa_agua,
        ctx.visit.water_access_reason,
        'Sem observação adicional registrada no sistema.'
      )) + '</div>',
      '</div>'
    ].join('');

    var footer = [
      '<div class="signature-grid">',
      '<div class="signature-box"><div class="signature-line"></div><div>Assinatura do destinatário / recebedor</div></div>',
      '<div class="signature-box"><div class="signature-line"></div><div>ACE / Secretaria responsável</div><div class="small muted">' + escapeHtml(firstFilled(ctx.agentName, state.session && state.session.nome, 'Secretaria')) + (ctx.agentMatricula ? ' • ' + escapeHtml(ctx.agentMatricula) : '') + '</div></div>',
      '</div>'
    ].join('');

    var bodyMap = {
      solicitacao_vistoria:
        '<p>Solicitamos vistoria no imóvel situado em <strong>' + escapeHtml(ctx.address) + '</strong>, a fim de permitir avaliação sanitária, conferência de depósitos, condições da caixa d’água e demais fatores relacionados ao controle vetorial.</p>' +
        '<p>Favor comparecer à unidade, entrar em contato com a secretaria ou facilitar o acesso da equipe no próximo atendimento programado.</p>',

      denuncia_atendimento:
        '<p>Fica registrado o atendimento / denúncia vinculado ao endereço <strong>' + escapeHtml(ctx.address) + '</strong>, em nome de <strong>' + escapeHtml(ctx.recipient) + '</strong>, para fins de triagem, acompanhamento e eventual diligência da equipe.</p>' +
        '<p>Este registro serve como ficha padronizada de atendimento na secretaria.</p>',

      requisicao_visita:
        '<p>Encaminha-se requisição de visita ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, com base na demanda protocolada na secretaria, para verificação em campo e retorno da equipe.</p>' +
        '<p>Motivo básico: ' + escapeHtml(firstFilled(ctx.notes, ctx.reference, 'Atendimento administrativo / diligência solicitada.')) + '</p>',

      requisicao_retorno:
        '<p>Solicita-se retorno da equipe ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, em razão de situação pendente registrada anteriormente.</p>' +
        '<p>Última situação conhecida: <strong>' + escapeHtml(firstFilled(ctx.visit.situacao, latestStatus, 'Não informada')) + '</strong>.</p>',

      oficio_encaminhamento:
        '<p>Encaminhamos a presente demanda relacionada ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong> para análise, providência e acompanhamento pela equipe competente.</p>' +
        '<p>O presente ofício objetiva formalizar o trâmite administrativo, garantindo rastreabilidade do atendimento.</p>',

      memorando_supervisao:
        '<p>Encaminha-se memorando à supervisão para acompanhamento, conferência em campo e eventual notificação do imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>Utilizar este documento como despacho interno para organização do atendimento e devolutiva à secretaria.</p>',

      notificacao_caixa:
        '<p>Fica o destinatário notificado acerca da necessidade de regularização da <strong>caixa d’água / reservatório</strong> no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>Situação observada: <strong>' + escapeHtml(latestStatus) + '</strong>. Solicita-se providência no prazo indicado e manutenção do reservatório tampado e protegido.</p>',

      notificacao_foco:
        '<p>Fica o destinatário notificado quanto à constatação de <strong>foco / criadouro</strong> em depósito(s) existente(s) no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>Quantidade registrada no sistema: <strong>' + escapeHtml(focusText) + '</strong>. Devem ser eliminadas ou tratadas as condições favoráveis à proliferação do vetor.</p>',

      notificacao_quintal:
        '<p>Fica o destinatário notificado para promover limpeza de quintal, retirada de recipientes e organização dos depósitos no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>A notificação visa reduzir o risco sanitário e prevenir formação de criadouros.</p>',

      notificacao_proprietario:
        '<p>O proprietário / responsável pelo imóvel situado em <strong>' + escapeHtml(ctx.address) + '</strong> é notificado para providenciar regularização sanitária e facilitar o acesso da equipe quando solicitado.</p>' +
        '<p>Em caso de locação, o documento também serve para comunicação entre administração e responsável pelo bem.</p>',

      notificacao_imobiliaria:
        '<p>A imobiliária / responsável é notificada acerca de pendência relacionada ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, solicitando regularização, contato com o responsável e retorno à secretaria.</p>' +
        '<p>Utilizar para imóveis sob administração de terceiros.</p>',

      notificacao_imovel_fechado:
        '<p>Fica registrada notificação por <strong>imóvel fechado / acesso não permitido</strong> no endereço <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>Motivo registrado: <strong>' + escapeHtml(firstFilled(ctx.visit.closed_reason, ctx.visit.motivo_fechado, 'Sem acesso no atendimento anterior')) + '</strong>. Solicita-se contato para agendamento ou liberação de acesso.</p>',

      notificacao_escada:
        '<p>Fica o destinatário notificado quanto à necessidade de providência para acesso seguro ao reservatório / área elevada no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>Status registrado: <strong>' + escapeHtml(ladderText) + '</strong>. Solicita-se adequação ou disponibilidade de acesso no retorno da equipe.</p>',

      notificacao_laboratorio:
        '<p>Fica o destinatário cientificado acerca de resultado laboratorial vinculado a coleta realizada no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>Quantidade de tubitos vinculada à visita: <strong>' + escapeHtml(tubitoText) + '</strong>. Havendo positividade, reforçam-se as medidas imediatas de controle.</p>',

      oficio_imobiliaria:
        '<p>Encaminha-se ofício à imobiliária / proprietário responsável pelo imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, com solicitação de providências, regularização e devolutiva à secretaria.</p>' +
        '<p>Documento indicado para comunicação formal em imóveis fechados, desocupados ou sob administração imobiliária.</p>',

      oficio_supervisao:
        '<p>Encaminha-se ofício à supervisão para apoio operacional no atendimento ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, incluindo eventual entrega de notificação e acompanhamento em campo.</p>' +
        '<p>Utilizar quando a secretaria precisar formalizar suporte externo.</p>',

      oficio_caixa:
        '<p>Encaminha-se ofício formal tratando da situação da <strong>caixa d’água / reservatório</strong> localizada no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>Situação registrada: <strong>' + escapeHtml(latestStatus) + '</strong>. Solicita-se regularização e informação sobre a providência adotada.</p>',

      oficio_laboratorio:
        '<p>Encaminha-se ofício comunicando resultado laboratorial associado ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>O documento serve para formalizar ciência, anexar ao atendimento administrativo e orientar providências decorrentes da coleta.</p>',

      requisicao_escada:
        '<p>Solicita-se apoio com escada / acesso para atendimento no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, em razão de necessidade operacional registrada no sistema.</p>' +
        '<p>Registro anterior: <strong>' + escapeHtml(ladderText) + '</strong>.</p>',

      solicitacao_imobiliaria:
        '<p>Solicita-se formalmente à imobiliária / responsável as providências relacionadas ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, com retorno à secretaria no prazo estabelecido.</p>' +
        '<p>Utilize para reforço administrativo sem caráter de auto ou penalidade.</p>',

      comprovante_atendimento:
        '<p>Certificamos que houve atendimento / comparecimento relacionado ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong> na presente data, para fins de protocolo e comprovação administrativa.</p>',

      declaracao_comparecimento:
        '<p>Declaramos, para os devidos fins, que o(a) Sr.(a) <strong>' + escapeHtml(ctx.recipient) + '</strong> compareceu à unidade para tratar de demanda referente ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>',

      segunda_via_orientacao:
        '<p>Entregamos a presente <strong>segunda via de orientação</strong> referente aos cuidados sanitários, prevenção de criadouros e manutenção do imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>' +
        '<p>O documento substitui orientação anterior e reforça a adoção contínua de medidas preventivas.</p>',

      segunda_via_notificacao:
        '<p>Entregamos a presente <strong>segunda via de notificação</strong> relativa ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, para ciência e cumprimento das providências indicadas.</p>',

      comunicado_orientacao:
        '<p>Comunicamos e orientamos o morador / responsável pelo imóvel <strong>' + escapeHtml(ctx.address) + '</strong> quanto às medidas preventivas, rotina de vistoria, eliminação de recipientes e manutenção do reservatório.</p>',

      termo_ciencia:
        '<p>O destinatário declara ter recebido ciência sobre a situação sanitária observada no imóvel <strong>' + escapeHtml(ctx.address) + '</strong>, bem como as orientações e providências recomendadas pela equipe.</p>'
    };

    var body = bodyMap[docType] || '<p>Documento padronizado da secretaria referente ao imóvel <strong>' + escapeHtml(ctx.address) + '</strong>.</p>';

    return [
      '<div class="doc-page">',
      '<div class="doc-header">',
      '<div class="doc-brand">ACE Campo • Módulo Secretaria</div>',
      '<h1>' + escapeHtml(ctx.title || 'Documento') + '</h1>',
      '<div class="small muted">Documento padronizado para secretaria, atendimento ao cidadão e apoio à supervisão.</div>',
      '</div>',
      meta,
      '<div class="doc-box">' + body + '</div>',
      observations,
      footer,
      '</div>'
    ].join('');
  }

  function wrapPrintableHtml(title, body, options) {
    options = options || {};
    var isReport = options.mode === 'report';
    var pageSize = options.pageSize || (isReport ? 'A4 landscape' : 'A4 portrait');
    var bodyClass = isReport ? 'report-mode' : 'document-mode';
    return [
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title>',
      '<style>',
      '@page{size:' + pageSize + ';margin:10mm}',
      'html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}',
      'body{padding:10mm}',
      '.doc-page{max-width:980px;margin:0 auto}',
      '.doc-page.report-mode{max-width:none}',
      '.doc-header{text-align:center;margin-bottom:14px}',
      '.report-mode .doc-header{text-align:left;margin-bottom:10px}',
      '.doc-brand{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#4a5568;font-weight:700}',
      'h1{font-size:22px;margin:8px 0 4px;line-height:1.15}',
      'h2{font-size:16px;margin:16px 0 8px;line-height:1.2;page-break-after:avoid}',
      'p,li,div,td,th{font-size:13px;line-height:1.45}',
      '.doc-meta,.doc-box{border:1px solid #d9e2ec;border-radius:10px;padding:10px 12px;margin:10px 0;background:#fafcfe}',
      '.doc-meta div{margin:3px 0}',
      '.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}',
      '.signature-box{min-height:78px;text-align:center}',
      '.signature-line{border-top:1px solid #111;margin-top:42px;padding-top:6px}',
      '.grid-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}',
      'table{width:100%;border-collapse:collapse;margin-top:10px;table-layout:fixed}',
      'thead{display:table-header-group}',
      'tfoot{display:table-footer-group}',
      'tr,td,th{page-break-inside:avoid;break-inside:avoid}',
      'th,td{border:1px solid #cbd5e0;padding:7px 8px;vertical-align:top;word-break:break-word}',
      'th{background:#edf2f7;text-align:left}',
      '.small{font-size:11px}',
      '.muted{color:#4a5568}',
      '.report-mode h1{font-size:18px}',
      '.report-mode h2{font-size:13px;margin:12px 0 6px}',
      '.report-mode p,.report-mode li,.report-mode div,.report-mode td,.report-mode th{font-size:10.5px;line-height:1.3}',
      '.report-mode .doc-box,.report-mode .doc-meta{padding:8px 9px;margin:8px 0;border-radius:8px}',
      '.report-mode .grid-summary{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0 10px}',
      '.report-mode table{margin-top:8px}',
      '.report-mode th,.report-mode td{padding:5px 6px}',
      '.report-mode .doc-brand{font-size:10px}',
      '.report-mode .signature-grid{gap:10px;margin-top:14px}',
      '@media screen{body{background:#f3f5f6;padding:18px}.doc-page{background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.08);padding:16px}}',
      '@media print{body{padding:0;background:#fff}.doc-page{max-width:none;box-shadow:none;padding:0}}',
      '@media (max-width:900px){.grid-summary,.report-mode .grid-summary,.signature-grid{grid-template-columns:1fr}}',
      '</style>',
      '</head><body>' + body.replace('class="doc-page"', 'class="doc-page ' + bodyClass + '"') + '</body></html>'
    ].join('');
  }

  function updateCurrentDocumentActions() {
    var doc = state.currentDoc;
    var status = doc ? normalizeDocStatus(doc.status) : '';
    var hasDoc = !!doc;
    var canDeliver = hasDoc && status === 'Impresso';
    var canCancel = hasDoc && !isFinalDocumentStatus(status);
    if (byId('printDocBtn')) {
      byId('printDocBtn').disabled = state.docStatusSaving || !hasDoc || status === 'Cancelado';
    }
    if (byId('deliverDocBtn')) {
      byId('deliverDocBtn').disabled = state.docStatusSaving || !canDeliver;
    }
    if (byId('cancelDocBtn')) {
      byId('cancelDocBtn').disabled = state.docStatusSaving || !canCancel;
    }
    if (byId('docLifecycleStatus')) {
      byId('docLifecycleStatus').textContent = hasDoc
        ? (status + (status === 'Gerado' ? ' • prévia não registrada' : ''))
        : 'Nenhum documento em edição.';
      byId('docLifecycleStatus').setAttribute('data-status', status || 'vazio');
    }
  }

  function mergeSavedDocument(saved) {
    if (!saved || !state.bundle) { return; }
    var docs = historyDocuments(state.bundle.documents || []);
    var docId = safeText(saved.doc_id).trim();
    var replaced = false;
    state.bundle.documents = docs.map(function (item) {
      if (safeText(item.doc_id).trim() === docId) {
        replaced = true;
        return saved;
      }
      return item;
    });
    if (!replaced) {
      state.bundle.documents = [saved].concat(docs);
    }
    buildIndexes();
    renderDocumentContext();
    renderStats();
  }

  function baseDocumentSavePayload(doc, status, options) {
    options = options || {};
    var ctx = doc.context || {};
    var notes = [ctx.protocol ? 'Protocolo: ' + ctx.protocol : '', safeText(ctx.notes || '')].filter(Boolean).join(' | ');
    notes = appendLifecycleNote(options.notes || notes, status);
    return {
      action: 'secretaria_document_save',
      access_module: 'secretaria',
      sessionToken: state.session.sessionToken,
      doc_id: doc.docId,
      doc_type: doc.docType,
      doc_title: doc.title,
      property_uid: safeText(ctx.property && ctx.property.uid),
      visit_uid: safeText(ctx.visit && ctx.visit.uid),
      recipient_name: safeText(ctx.recipient),
      recipient_type: safeText(ctx.recipientType),
      bairro: safeText(ctx.property && ctx.property.bairro),
      microarea: safeText(ctx.property && ctx.property.microarea),
      quarteirao: safeText(ctx.property && ctx.property.quarteirao),
      logradouro: safeText(ctx.property && ctx.property.logradouro),
      numero: safeText(ctx.property && ctx.property.numero),
      complemento: safeText(ctx.property && ctx.property.complemento),
      address_label: safeText(ctx.address),
      agent_name: safeText(ctx.agentName),
      agent_matricula: safeText(ctx.agentMatricula),
      status: status,
      notes: notes,
      emitted_at: doc.emittedAt || nowIsoString(),
      printed_count: status === 'Gerado' ? 0 : 1,
      update_existing: !!options.updateExisting,
      increment_printed_count: !!options.incrementPrintedCount
    };
  }

  function saveDocumentStatus(doc, status, options) {
    if (!doc || !state.session) { return Promise.resolve(null); }
    options = options || {};
    state.docStatusSaving = true;
    updateCurrentDocumentActions();
    return postApi(baseDocumentSavePayload(doc, status, options)).then(function (response) {
      var saved = response.document || null;
      doc.status = normalizeDocStatus(status);
      doc.registered = true;
      if (saved) {
        doc.docId = safeText(saved.doc_id || doc.docId);
        doc.emittedAt = safeText(saved.emitted_at || doc.emittedAt);
        mergeSavedDocument(saved);
      }
      updateCurrentDocumentActions();
      return saved;
    }).catch(function (err) {
      showMessage('loginMsg', 'Falha ao atualizar status do documento: ' + safeText(err && err.message || err), true);
      throw err;
    }).finally(function () {
      state.docStatusSaving = false;
      updateCurrentDocumentActions();
    });
  }

  function saveExistingDocumentStatus(row, status) {
    if (!row || !state.session) { return Promise.resolve(null); }
    var nextNotes = appendLifecycleNote(row.notes || '', status);
    return postApi({
      action: 'secretaria_document_save',
      access_module: 'secretaria',
      sessionToken: state.session.sessionToken,
      doc_id: safeText(row.doc_id),
      doc_type: safeText(row.doc_type || 'documento'),
      doc_title: safeText(row.doc_title || DOCUMENT_TITLES[row.doc_type] || row.doc_type || 'Documento'),
      property_uid: safeText(row.property_uid),
      visit_uid: safeText(row.visit_uid),
      recipient_name: safeText(row.recipient_name),
      recipient_type: safeText(row.recipient_type),
      bairro: safeText(row.bairro),
      microarea: safeText(row.microarea),
      quarteirao: safeText(row.quarteirao),
      logradouro: safeText(row.logradouro),
      numero: safeText(row.numero),
      complemento: safeText(row.complemento),
      address_label: safeText(row.address_label),
      agent_name: safeText(row.agent_name),
      agent_matricula: safeText(row.agent_matricula),
      status: status,
      notes: nextNotes,
      emitted_at: safeText(row.emitted_at || row.updatedAt || nowIsoString()),
      printed_count: Number(row.printed_count || 0) || 0,
      update_existing: true
    }).then(function (response) {
      if (response.document) {
        mergeSavedDocument(response.document);
        if (state.currentDoc && safeText(state.currentDoc.docId) === safeText(response.document.doc_id)) {
          state.currentDoc.status = normalizeDocStatus(response.document.status);
          state.currentDoc.emittedAt = safeText(response.document.emitted_at || state.currentDoc.emittedAt);
          state.currentDoc.registered = true;
        }
      }
      updateCurrentDocumentActions();
      return response.document || null;
    }).catch(function (err) {
      showMessage('loginMsg', 'Falha ao atualizar documento: ' + safeText(err && err.message || err), true);
      throw err;
    });
  }

  function previewDocument(docType) {
    state.currentDoc = buildDocumentPayload(docType);
    byId('docPreview').innerHTML = state.currentDoc.html.replace(/<!DOCTYPE[\s\S]*?<body>/i, '').replace(/<\/body><\/html>$/i, '');
    markActionSelection('[data-doc]', docType, 'data-doc');
    updateCurrentDocumentActions();
    showMessage('loginMsg', 'Prévia gerada. O documento só entra no histórico depois de imprimir.', false);
  }

  function openPrintableWindow(html, title, afterOpen) {
    var win = window.open('', '_blank');
    if (!win) {
      window.alert('Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.');
      return false;
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      try { win.close(); } catch (ignore) {}
      window.alert('Falha ao preparar a impressão de ' + safeText(title || 'documento') + '.');
      return false;
    }

    var printed = false;
    function triggerPrint() {
      if (printed) { return; }
      printed = true;
      try { win.focus(); } catch (ignore) {}
      setTimeout(function () {
        try { win.print(); } catch (ignore) {}
        if (typeof afterOpen === 'function') {
          try { afterOpen(win); } catch (ignore) {}
        }
      }, 280);
    }

    try { win.onload = triggerPrint; } catch (ignore) {}
    setTimeout(triggerPrint, 420);
    return true;
  }

  function printCurrentDocument() {
    if (!state.currentDoc) { return; }
    var doc = state.currentDoc;
    if (normalizeDocStatus(doc.status) === 'Cancelado') {
      window.alert('Documento cancelado não deve ser impresso.');
      return;
    }
    sessionStorage.setItem(DOC_PRINT_KEY, doc.html);
    if (openPrintableWindow(doc.html, doc.title, function () {})) {
      recordDocumentEmission(doc);
    }
  }

  function recordDocumentEmission(doc) {
    saveDocumentStatus(doc, 'Impresso', {
      updateExisting: true,
      incrementPrintedCount: true
    }).catch(function (err) {
      showMessage('loginMsg', 'Documento impresso, mas o registro na base falhou: ' + safeText(err && err.message || err), true);
    });
  }

  function deliverCurrentDocument() {
    if (!state.currentDoc || isFinalDocumentStatus(state.currentDoc.status)) { return; }
    if (normalizeDocStatus(state.currentDoc.status) !== 'Impresso') {
      window.alert('Imprima o documento antes de marcar como entregue.');
      updateCurrentDocumentActions();
      return;
    }
    saveDocumentStatus(state.currentDoc, 'Entregue', { updateExisting: true }).then(function () {
      showMessage('loginMsg', 'Documento marcado como entregue.', false);
    }).catch(function () {});
  }

  function cancelCurrentDocument() {
    if (!state.currentDoc || isFinalDocumentStatus(state.currentDoc.status)) { return; }
    if (!window.confirm('Cancelar o documento atual?')) { return; }
    if (!state.currentDoc.registered) {
      state.currentDoc = null;
      byId('docPreview').innerHTML = 'Escolha um modelo para gerar a pré-visualização.';
      markActionSelection('[data-doc]', '__none__', 'data-doc');
      updateCurrentDocumentActions();
      showMessage('loginMsg', 'Prévia descartada. Nada foi registrado no histórico.', false);
      return;
    }
    saveDocumentStatus(state.currentDoc, 'Cancelado', { updateExisting: true }).then(function () {
      showMessage('loginMsg', 'Documento marcado como cancelado.', false);
    }).catch(function () {});
  }

  function findDocumentById(docId) {
    docId = safeText(docId).trim();
    return (state.bundle.documents || []).find(function (item) {
      return safeText(item.doc_id).trim() === docId;
    }) || null;
  }

  function handleDocumentLogAction(event) {
    var target = event.target;
    if (!target || !target.getAttribute) { return; }
    var status = target.getAttribute('data-doc-log-action');
    var docId = target.getAttribute('data-doc-id');
    if (!status || !docId) { return; }
    var row = findDocumentById(docId);
    if (!row) { return; }
    if (status === 'Entregue' && normalizeDocStatus(row.status) !== 'Impresso') {
      window.alert('Imprima o documento antes de marcar como entregue.');
      return;
    }
    if (status === 'Cancelado' && !window.confirm('Cancelar este documento?')) { return; }
    saveExistingDocumentStatus(row, status).then(function () {
      showMessage('loginMsg', 'Documento atualizado para ' + normalizeDocStatus(status) + '.', false);
    }).catch(function () {});
  }

  function computePendingItems() {
    var pending = [];
    (state.bundle.supervision_requests || []).forEach(function (item) {
      var status = normalizeText(item.status || 'pendente');
      if (!isFinalizedStatus(status)) {
        pending.push({
          kind: 'supervisão',
          date: safeText(item.data || item.createdAt),
          bairro: safeText(item.bairro || item.gps_territory),
          microarea: safeText(item.microarea || item.gps_quarteirao),
          detail: safeText(item.mensagem || item.status || 'Solicitação de supervisão'),
          agent: safeText(item.agente || item.matricula)
        });
      }
    });

    (state.bundle.properties || []).forEach(function (property) {
      var latest = state.indexes.latestVisitByProperty[safeText(property.uid)];
      if (!latest) { return; }

      if (hasLadderNeed(latest)) {
        pending.push({
          kind: 'escada',
          date: safeText(latest.data || latest.updatedAt),
          bairro: safeText(property.bairro),
          microarea: safeText(property.microarea),
          detail: 'Apoio com escada: ' + safeText(firstFilled(latest.ladder_support_status, latest.solicita_escada, latest.ladder_support_requested, 'Solicitado')),
          agent: safeText(firstFilled(latest.agente, latest.matricula))
        });
      }

      if (hasTankIssue(latest)) {
        pending.push({
          kind: 'caixa d’água',
          date: safeText(latest.data || latest.updatedAt),
          bairro: safeText(property.bairro),
          microarea: safeText(property.microarea),
          detail: 'Situação: ' + safeText(firstFilled(latest.situacao_caixa_agua, latest.water_tank_condition, latest.acessou_caixa_agua, 'Atenção')),
          agent: safeText(firstFilled(latest.agente, latest.matricula))
        });
      }

      if (isClosedVisit(latest)) {
        pending.push({
          kind: 'imóvel fechado',
          date: safeText(latest.data || latest.updatedAt),
          bairro: safeText(property.bairro),
          microarea: safeText(property.microarea),
          detail: safeText(firstFilled(latest.closed_reason, latest.motivo_fechado, 'Sem acesso ao imóvel')),
          agent: safeText(firstFilled(latest.agente, latest.matricula))
        });
      }

      if (normalizeText(firstFilled(latest.deposit_with_focus, latest.foco, '')).indexOf('sim') > -1) {
        pending.push({
          kind: 'foco encontrado',
          date: safeText(latest.data || latest.updatedAt),
          bairro: safeText(property.bairro),
          microarea: safeText(property.microarea),
          detail: 'Depósitos com foco: ' + safeText(firstFilled(latest.deposit_focus_count, latest.focus_count, '1')),
          agent: safeText(firstFilled(latest.agente, latest.matricula))
        });
      }
    });

    getPositiveTubitosRows().forEach(function (item) {
      pending.push({
        kind: 'tubito positivo',
        date: safeText(item.data_coleta || item.updatedAt),
        bairro: safeText(item.bairro),
        microarea: safeText(item.microarea),
        detail: safeText(firstFilled(item.resultado_laboratorio, item.especie, 'Positivo')),
        agent: safeText(firstFilled(item.agente, item.matricula))
      });
    });

    return pending.sort(function (a, b) {
      return safeText(b.date).localeCompare(safeText(a.date));
    });
  }


  function reportHtml(title, body) {
    return wrapPrintableHtml(title, [
      '<div class="doc-page">',
      '<div class="doc-header">',
      '<div class="doc-brand">ACE Campo • Módulo Secretaria</div>',
      '<h1>' + escapeHtml(title) + '</h1>',
      '<div class="small muted">Emitido em ' + escapeHtml(formatDateTimeBR(new Date().toISOString())) + '</div>',
      '</div>',
      body,
      '</div>'
    ].join(''), { mode: 'report', pageSize: 'A4 landscape' });
  }

  function makeTable(headers, rows) {
    return [
      '<table><thead><tr>',
      headers.map(function (item) { return '<th>' + escapeHtml(item) + '</th>'; }).join(''),
      '</tr></thead><tbody>',
      rows.length ? rows.map(function (row) {
        return '<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + headers.length + '">Sem dados.</td></tr>',
      '</tbody></table>'
    ].join('');
  }


  function visitsByOperationMode(mode) {
    return (state.bundle && state.bundle.visits || []).filter(function (visit) {
      return operationModeFromVisit(visit) === mode;
    });
  }

  function heatColor(value, maxValue) {
    var val = Number(value || 0);
    var max = Number(maxValue || 0);
    if (!max || val <= 0) { return 'rgba(47,122,82,0.08)'; }
    var ratio = Math.max(0, Math.min(1, val / max));
    if (ratio < 0.34) { return 'rgba(47,122,82,' + (0.16 + ratio * 0.35).toFixed(2) + ')'; }
    if (ratio < 0.67) { return 'rgba(199,134,21,' + (0.18 + ratio * 0.45).toFixed(2) + ')'; }
    return 'rgba(195,71,71,' + (0.20 + ratio * 0.55).toFixed(2) + ')';
  }

  function buildHeatBox(label, value, maxValue, note) {
    return '<div style="border:1px solid #d8e2dc;border-radius:14px;padding:12px 14px;background:' + heatColor(value, maxValue) + ';margin-bottom:10px">'
      + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#4a5568;font-weight:700">' + escapeHtml(label) + '</div>'
      + '<div style="font-size:26px;font-weight:700;line-height:1.1;margin-top:6px">' + escapeHtml(String(value || 0)) + '</div>'
      + (note ? '<div style="font-size:12px;color:#334155;margin-top:4px">' + escapeHtml(note) + '</div>' : '')
      + '</div>';
  }

  function buildLiraaHeatmapReport() {
    var liraaVisits = visitsByOperationMode('LIRAA');
    var tubitos = state.bundle && state.bundle.tubitos || [];
    var positiveByVisit = {};
    tubitos.forEach(function (item) {
      if (!isPositiveTubito(item)) { return; }
      var visitUid = safeText(item.visit_uid).trim();
      if (!visitUid) { return; }
      positiveByVisit[visitUid] = (positiveByVisit[visitUid] || 0) + 1;
    });

    if (!liraaVisits.length) {
      return reportHtml('Relatório LIRAA com mapa de calor', '<p>Não há registros LIRAA no período selecionado.</p>');
    }

    var grouped = {};
    var maxVisits = 0;
    var maxFocos = 0;
    var maxPositivos = 0;
    var maxInfestacao = 0;

    liraaVisits.forEach(function (visit) {
      var key = [firstFilled(visit.bairro, '—'), firstFilled(visit.microarea, '—'), firstFilled(visit.quarteirao, '—')].join(' • ');
      if (!grouped[key]) {
        grouped[key] = {
          bairro: firstFilled(visit.bairro, '—'),
          microarea: firstFilled(visit.microarea, '—'),
          quarteirao: firstFilled(visit.quarteirao, '—'),
          visitas: 0,
          imoveisMap: {},
          depositos: 0,
          focos: 0,
          tubitos: 0,
          positivos: 0
        };
      }
      var row = grouped[key];
      row.visitas += 1;
      row.depositos += Number(visit.deposit_count || 0);
      row.focos += Number(firstFilled(visit.deposit_focus_count, visit.focus_count, 0) || 0);
      row.tubitos += Number(visit.tubitos_qtd || 0);
      row.positivos += Number(positiveByVisit[safeText(visit.uid).trim()] || 0);
      if (safeText(visit.property_uid).trim()) {
        row.imoveisMap[safeText(visit.property_uid).trim()] = true;
      }
    });

    var rows = Object.keys(grouped).map(function (key) {
      var row = grouped[key];
      row.imoveis = Object.keys(row.imoveisMap).length;
      row.infestacao = row.visitas ? (Math.round((row.focos / row.visitas) * 1000) / 10) : 0;
      maxVisits = Math.max(maxVisits, row.visitas);
      maxFocos = Math.max(maxFocos, row.focos);
      maxPositivos = Math.max(maxPositivos, row.positivos);
      maxInfestacao = Math.max(maxInfestacao, row.infestacao);
      return row;
    }).sort(function (a, b) {
      if (b.focos !== a.focos) { return b.focos - a.focos; }
      if (b.positivos !== a.positivos) { return b.positivos - a.positivos; }
      return safeText(a.bairro + ' ' + a.microarea + ' ' + a.quarteirao).localeCompare(safeText(b.bairro + ' ' + b.microarea + ' ' + b.quarteirao), 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

    var summary = [
      '<div class="grid-summary">',
      '<div>' + buildHeatBox('Registros LIRAA', liraaVisits.length, maxVisits, 'levantamentos no recorte') + '</div>',
      '<div>' + buildHeatBox('Focos no LIRAA', rows.reduce(function (sum, row) { return sum + row.focos; }, 0), maxFocos, 'somatório territorial') + '</div>',
      '<div>' + buildHeatBox('Tubitos positivos', rows.reduce(function (sum, row) { return sum + row.positivos; }, 0), maxPositivos, 'positividade vinculada ao LIRAA') + '</div>',
      '</div>'
    ].join('');

    var heatRows = rows.map(function (row) {
      return '<tr>'
        + '<td>' + escapeHtml(row.bairro) + '</td>'
        + '<td>' + escapeHtml(row.microarea) + '</td>'
        + '<td>' + escapeHtml(row.quarteirao) + '</td>'
        + '<td style="background:' + heatColor(row.visitas, maxVisits) + ';font-weight:700">' + escapeHtml(String(row.visitas)) + '</td>'
        + '<td>' + escapeHtml(String(row.imoveis)) + '</td>'
        + '<td>' + escapeHtml(String(row.depositos)) + '</td>'
        + '<td style="background:' + heatColor(row.focos, maxFocos) + ';font-weight:700">' + escapeHtml(String(row.focos)) + '</td>'
        + '<td>' + escapeHtml(String(row.tubitos)) + '</td>'
        + '<td style="background:' + heatColor(row.positivos, maxPositivos) + ';font-weight:700">' + escapeHtml(String(row.positivos)) + '</td>'
        + '<td style="background:' + heatColor(row.infestacao, maxInfestacao) + ';font-weight:700">' + escapeHtml(String(row.infestacao).replace('.', ',')) + '%</td>'
        + '</tr>';
    }).join('');

    var legend = '<div class="doc-meta"><div><strong>Leitura do mapa de calor:</strong> células mais escuras indicam maior concentração relativa no recorte atual.</div>'
      + '<div>Os destaques foram aplicados para <strong>registros LIRAA</strong>, <strong>focos</strong>, <strong>positivos</strong> e <strong>taxa de focos por registro</strong>.</div></div>';

    return reportHtml('Relatório LIRAA com mapa de calor', summary + legend + makeTable(
      ['Bairro', 'Microárea', 'Quarteirão', 'Registros LIRAA', 'Imóveis', 'Depósitos', 'Focos', 'Tubitos', 'Positivos', 'Focos / registro'],
      rows.map(function (row) {
        return [
          escapeHtml(row.bairro),
          escapeHtml(row.microarea),
          escapeHtml(row.quarteirao),
          '<div style="background:' + heatColor(row.visitas, maxVisits) + ';margin:-8px;padding:8px;font-weight:700">' + escapeHtml(String(row.visitas)) + '</div>',
          escapeHtml(String(row.imoveis)),
          escapeHtml(String(row.depositos)),
          '<div style="background:' + heatColor(row.focos, maxFocos) + ';margin:-8px;padding:8px;font-weight:700">' + escapeHtml(String(row.focos)) + '</div>',
          escapeHtml(String(row.tubitos)),
          '<div style="background:' + heatColor(row.positivos, maxPositivos) + ';margin:-8px;padding:8px;font-weight:700">' + escapeHtml(String(row.positivos)) + '</div>',
          '<div style="background:' + heatColor(row.infestacao, maxInfestacao) + ';margin:-8px;padding:8px;font-weight:700">' + escapeHtml(String(row.infestacao).replace('.', ',')) + '%</div>'
        ];
      })
    ));
  }

  function buildOperationModeReport(mode, title) {
    var rows = visitsByOperationMode(mode).slice().sort(function (a, b) {
      return safeText(b.data + ' ' + b.hora).localeCompare(safeText(a.data + ' ' + a.hora));
    });
    var grouped = {};
    rows.forEach(function (visit) {
      var key = [firstFilled(visit.bairro, '—'), firstFilled(visit.microarea, '—')].join(' • ');
      if (!grouped[key]) {
        grouped[key] = { territorio: key, visitas: 0, focos: 0, depositos: 0, tubitos: 0 };
      }
      grouped[key].visitas += 1;
      grouped[key].focos += Number(firstFilled(visit.deposit_focus_count, visit.focus_count, 0) || 0);
      grouped[key].depositos += Number(visit.deposit_count || 0);
      grouped[key].tubitos += Number(visit.tubitos_qtd || 0);
    });
    var territoryRows = Object.keys(grouped).sort().map(function (key) {
      return [
        escapeHtml(key),
        escapeHtml(String(grouped[key].visitas)),
        escapeHtml(String(grouped[key].depositos)),
        escapeHtml(String(grouped[key].focos)),
        escapeHtml(String(grouped[key].tubitos))
      ];
    });

    return reportHtml(title, [
      '<div class="grid-summary">',
      '<div>' + buildHeatBox('Registros', rows.length, rows.length, 'registros do modo ' + mode) + '</div>',
      '<div>' + buildHeatBox('Focos', rows.reduce(function (sum, item) { return sum + Number(firstFilled(item.deposit_focus_count, item.focus_count, 0) || 0); }, 0), rows.length || 1, 'somatório no recorte') + '</div>',
      '<div>' + buildHeatBox('Tubitos', rows.reduce(function (sum, item) { return sum + Number(item.tubitos_qtd || 0); }, 0), rows.length || 1, 'coletas vinculadas') + '</div>',
      '</div>',
      '<h2>Distribuição territorial</h2>',
      makeTable(['Bairro • Microárea', 'Registros', 'Depósitos', 'Focos', 'Tubitos'], territoryRows),
      '<h2>Detalhamento</h2>',
      makeTable(['Data', 'Hora', 'Bairro', 'Microárea', 'Quarteirão', 'Agente', 'Situação', 'Depósitos', 'Focos', 'Tubitos'], rows.map(function (visit) {
        return [
          escapeHtml(formatDateBR(visit.data)),
          escapeHtml(visit.hora || '—'),
          escapeHtml(firstFilled(visit.bairro, '—')),
          escapeHtml(firstFilled(visit.microarea, '—')),
          escapeHtml(firstFilled(visit.quarteirao, '—')),
          escapeHtml(firstFilled(visit.agente, visit.matricula, '—')),
          escapeHtml(firstFilled(visit.situacao, '—')),
          escapeHtml(String(visit.deposit_count || 0)),
          escapeHtml(String(firstFilled(visit.deposit_focus_count, visit.focus_count, 0) || 0)),
          escapeHtml(String(visit.tubitos_qtd || 0))
        ];
      }))
    ].join(''));
  }

  function buildReport(type) {
    var property = state.indexes.propertyByUid[state.selectedPropertyUid];
    var properties = filteredProperties();
    var docs = historyDocuments(state.bundle.documents || []);
    var pending = computePendingItems();
    var visits = state.bundle.visits || [];
    var tubitos = state.bundle.tubitos || [];
    var attendance = state.bundle.attendance || { rows: [], totals: {} };
    var attendanceRows = state.bundle.attendance_rows || [];
    var earlyClosures = state.bundle.early_closures || [];
    var agentMetrics = getAgentMetrics();
    var tankRows = getTankRows();
    var ladderRows = getLadderRows();
    var positiveTubitos = getPositiveTubitosRows();

    function metricBox(label, value, note) {
      return '<div class="doc-box"><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value) + (note ? '<div class="small muted" style="margin-top:4px">' + escapeHtml(note) + '</div>' : '') + '</div>';
    }

    if (type === 'resumo_atendimento') {
      return reportHtml('Resumo geral da secretaria', [
        '<div class="grid-summary">',
        metricBox('Imóveis filtrados', String(properties.length), 'base retornada na consulta atual'),
        metricBox('Visitas no período', String(visits.length), 'histórico usado na secretaria'),
        metricBox('Pendências ativas', String(pending.length), 'supervisão, caixa, escada, fechados e focos'),
        metricBox('Tubitos positivos', String(positiveTubitos.length), 'entre ' + tubitos.length + ' registros laboratoriais'),
        metricBox('Documentos emitidos', String(docs.length), 'histórico registrado na secretaria'),
        metricBox('Agentes sem login', String(attendance.totals && attendance.totals.missingDays || 0), 'mês de referência: ' + ((state.bundle.filter && state.bundle.filter.month) || monthIso())),
        '</div>',
        '<h2>Pendências principais</h2>',
        makeTable(['Tipo', 'Data', 'Bairro', 'Microárea', 'Agente', 'Detalhe'], pending.slice(0, 40).map(function (item) {
          return [
            escapeHtml(item.kind),
            escapeHtml(formatDateBR(item.date)),
            escapeHtml(item.bairro || '—'),
            escapeHtml(item.microarea || '—'),
            escapeHtml(item.agent || '—'),
            escapeHtml(item.detail || '—')
          ];
        })),
        '<h2>Caixas d’água com registro</h2>',
        makeTable(['Data', 'Morador', 'Endereço', 'Situação', 'Tratamento / motivo'], tankRows.slice(0, 40).map(function (visit) {
          return [
            escapeHtml(formatDateBR(visit.data)),
            escapeHtml(visit.morador || '—'),
            escapeHtml([visit.logradouro, visit.numero, visit.bairro].filter(Boolean).join(', ')),
            escapeHtml(firstFilled(visit.situacao_caixa_agua, visit.water_tank_condition, '—')),
            escapeHtml(firstFilled(visit.tratamento_caixa_agua, visit.water_tank_treatment, visit.motivo_caixa_agua, visit.water_access_reason, '—'))
          ];
        }))
      ].join(''));
    }

    if (type === 'imovel') {
      if (!property) {
        return reportHtml('Relatório por imóvel', '<p>Selecione um imóvel na aba Consulta para gerar este relatório.</p>');
      }
      var visitsByProperty = (state.indexes.visitsByProperty[safeText(property.uid)] || []).slice().sort(function (a, b) {
        return safeText(b.data + ' ' + b.hora).localeCompare(safeText(a.data + ' ' + a.hora));
      });
      var tubitosByProperty = (state.indexes.tubitosByProperty[safeText(property.uid)] || []).slice();
      var docsByProperty = (state.indexes.docsByProperty[safeText(property.uid)] || []).slice();
      return reportHtml('Relatório por imóvel', [
        metricBox('Morador', firstFilled(property.morador, 'Não informado'), ''),
        metricBox('Endereço', propertyAddress(property), ''),
        metricBox('Telefone', firstFilled(property.telefone, '—'), ''),
        metricBox('Histórico de visitas', String(visitsByProperty.length), ''),
        metricBox('Tubitos', String(tubitosByProperty.length), ''),
        metricBox('Documentos emitidos', String(docsByProperty.length), ''),
        '<h2>Histórico de visitas</h2>',
        makeTable(['Data', 'Hora', 'Agente', 'Situação', 'Depósitos', 'Focos', 'Obs'], visitsByProperty.map(function (visit) {
          return [
            escapeHtml(formatDateBR(visit.data)),
            escapeHtml(visit.hora || '—'),
            escapeHtml(firstFilled(visit.agente, visit.matricula, '—')),
            escapeHtml(firstFilled(visit.situacao, '—')),
            escapeHtml(String(visit.deposit_count || 0)),
            escapeHtml(String(visit.focus_count || 0)),
            escapeHtml(firstFilled(visit.obs, visit.closed_reason, visit.motivo_fechado, '—'))
          ];
        })),
        '<h2>Tubitos / laboratório</h2>',
        makeTable(['Tubito', 'Coleta', 'Resultado', 'Espécie', 'Status'], tubitosByProperty.map(function (item) {
          return [
            escapeHtml(item.numero_tubito || item.uid || '—'),
            escapeHtml(formatDateBR(item.data_coleta) + ' ' + safeText(item.hora_coleta)),
            escapeHtml(firstFilled(item.resultado_laboratorio, '—')),
            escapeHtml(firstFilled(item.especie, '—')),
            escapeHtml(firstFilled(item.status_laboratorio, '—'))
          ];
        })),
        '<h2>Documentos emitidos</h2>',
        makeTable(['Data', 'Tipo', 'Destinatário', 'Situação', 'Emissor'], docsByProperty.map(function (item) {
          return [
            escapeHtml(formatDateTimeBR(item.emitted_at || item.updatedAt)),
            escapeHtml(firstFilled(DOCUMENT_TITLES[item.doc_type], item.doc_title, item.doc_type, 'Documento')),
            escapeHtml(firstFilled(item.recipient_name, '—')),
            escapeHtml(firstFilled(item.status, 'Emitido')),
            escapeHtml(firstFilled(item.emitted_by, item.emitted_by_matricula, '—'))
          ];
        }))
      ].join(''));
    }

    if (type === 'morador') {
      if (!property) {
        return reportHtml('Relatório por morador', '<p>Selecione um imóvel na aba Consulta para gerar este relatório.</p>');
      }
      var rowsMorador = properties.filter(function (item) {
        return normalizeText(item.morador) === normalizeText(property.morador);
      });
      return reportHtml('Relatório por morador', [
        metricBox('Morador', firstFilled(property.morador, 'Não informado'), ''),
        metricBox('Imóveis encontrados', String(rowsMorador.length), ''),
        makeTable(['UID', 'Endereço', 'Bairro', 'Microárea', 'Telefone', 'Última visita'], rowsMorador.map(function (item) {
          var latest = state.indexes.latestVisitByProperty[safeText(item.uid)];
          return [
            escapeHtml(item.uid || '—'),
            escapeHtml(propertyAddress(item)),
            escapeHtml(item.bairro || '—'),
            escapeHtml(item.microarea || '—'),
            escapeHtml(item.telefone || '—'),
            escapeHtml(latest ? formatDateBR(latest.data) : '—')
          ];
        }))
      ].join(''));
    }

    if (type === 'territorio') {
      var grouped = {};
      properties.forEach(function (item) {
        var key = [item.bairro || '—', item.microarea || '—', item.quarteirao || '—'].join(' • ');
        if (!grouped[key]) {
          grouped[key] = { properties: 0, visits: 0, tubitos: 0, notifications: 0 };
        }
        grouped[key].properties += 1;
        grouped[key].visits += (state.indexes.visitsByProperty[safeText(item.uid)] || []).length;
        grouped[key].tubitos += (state.indexes.tubitosByProperty[safeText(item.uid)] || []).length;
        grouped[key].notifications += propertyNotifications(item).length;
      });
      return reportHtml('Relatório por quarteirão / microárea', makeTable(
        ['Bairro • Microárea • Quarteirão', 'Imóveis', 'Visitas', 'Tubitos', 'Pendências / notificações'],
        Object.keys(grouped).sort().map(function (key) {
          return [
            escapeHtml(key),
            escapeHtml(String(grouped[key].properties || 0)),
            escapeHtml(String(grouped[key].visits || 0)),
            escapeHtml(String(grouped[key].tubitos || 0)),
            escapeHtml(String(grouped[key].notifications || 0))
          ];
        })
      ));
    }

    if (type === 'vd_resumo') {
      return buildOperationModeReport('VD', 'Relatório de VD');
    }

    if (type === 'pe_resumo') {
      return buildOperationModeReport('P.E.', 'Relatório de P.E.');
    }

    if (type === 'liraa_resumo') {
      return buildOperationModeReport('LIRAA', 'Relatório do LIRAA');
    }

    if (type === 'liraa_mapa_calor') {
      return buildLiraaHeatmapReport();
    }

    if (type === 'cidadao_atendimento') {
      var rowsCitizen = properties.map(function (item) {
        var latest = state.indexes.latestVisitByProperty[safeText(item.uid)] || {};
        var docsByProperty = state.indexes.docsByProperty[safeText(item.uid)] || [];
        return {
          morador: item.morador || '—',
          telefone: item.telefone || '—',
          endereco: propertyAddress(item),
          bairro: item.bairro || '—',
          ultimaVisita: latest.data || '',
          situacao: firstFilled(latest.situacao, '—'),
          documentos: docsByProperty.length
        };
      }).sort(function (a, b) {
        return safeText(a.morador).localeCompare(safeText(b.morador), 'pt-BR', { sensitivity: 'base' });
      });
      return reportHtml('Lista de atendimentos / protocolos', makeTable(
        ['Morador', 'Telefone', 'Endereço', 'Bairro', 'Última visita', 'Situação', 'Documentos emitidos'],
        rowsCitizen.map(function (item) {
          return [
            escapeHtml(item.morador),
            escapeHtml(item.telefone),
            escapeHtml(item.endereco),
            escapeHtml(item.bairro),
            escapeHtml(item.ultimaVisita ? formatDateBR(item.ultimaVisita) : '—'),
            escapeHtml(item.situacao),
            escapeHtml(String(item.documentos || 0))
          ];
        })
      ));
    }

    if (type === 'pendencias') {
      return reportHtml('Lista de pendências para supervisão', makeTable(['Tipo', 'Data', 'Bairro', 'Microárea', 'Agente', 'Detalhe'], pending.map(function (item) {
        return [
          escapeHtml(item.kind),
          escapeHtml(formatDateBR(item.date)),
          escapeHtml(item.bairro || '—'),
          escapeHtml(item.microarea || '—'),
          escapeHtml(item.agent || '—'),
          escapeHtml(item.detail || '—')
        ];
      })));
    }

    if (type === 'notificacoes') {
      var notificationDocs = docs.filter(function (doc) { return usesNotificationDoc(doc); });
      return reportHtml('Lista de imóveis com notificação emitida', makeTable(['Data', 'Tipo', 'Destinatário', 'Endereço', 'Bairro', 'Emissor'], notificationDocs.map(function (item) {
        return [
          escapeHtml(formatDateTimeBR(item.emitted_at || item.updatedAt)),
          escapeHtml(firstFilled(DOCUMENT_TITLES[item.doc_type], item.doc_title, item.doc_type, 'Documento')),
          escapeHtml(firstFilled(item.recipient_name, '—')),
          escapeHtml(firstFilled(item.address_label, [item.logradouro, item.numero].filter(Boolean).join(', '), '—')),
          escapeHtml(firstFilled(item.bairro, '—')),
          escapeHtml(firstFilled(item.emitted_by, item.emitted_by_matricula, '—'))
        ];
      })));
    }

    if (type === 'documentos_emitidos') {
      return reportHtml('Relatório de documentos emitidos', [
        metricBox('Total de documentos', String(docs.length), ''),
        metricBox('Documentos de notificação / ofício', String(docs.filter(usesNotificationDoc).length), ''),
        makeTable(['Data', 'Tipo', 'Destinatário', 'Endereço', 'Status', 'Emissor'], docs.map(function (item) {
          return [
            escapeHtml(formatDateTimeBR(item.emitted_at || item.updatedAt)),
            escapeHtml(firstFilled(DOCUMENT_TITLES[item.doc_type], item.doc_title, item.doc_type, 'Documento')),
            escapeHtml(firstFilled(item.recipient_name, '—')),
            escapeHtml(firstFilled(item.address_label, [item.logradouro, item.numero].filter(Boolean).join(', '), '—')),
            escapeHtml(firstFilled(item.status, 'Emitido')),
            escapeHtml(firstFilled(item.emitted_by, item.emitted_by_matricula, '—'))
          ];
        }))
      ].join(''));
    }

    if (type === 'tubitos') {
      return reportHtml('Relatório de tubitos e laboratório', [
        '<div class="grid-summary">',
        metricBox('Tubitos no período', String(tubitos.length), ''),
        metricBox('Tubitos positivos', String(positiveTubitos.length), ''),
        metricBox('Imóveis com coleta', String(uniqueList(tubitos.map(function (item) { return item.property_uid; })).length), ''),
        '</div>',
        makeTable(['Tubito', 'Coleta', 'Agente', 'Endereço', 'Status', 'Resultado', 'Espécie'], tubitos.slice(0, 1200).map(function (item) {
          return [
            escapeHtml(item.numero_tubito || item.uid || '—'),
            escapeHtml(formatDateBR(item.data_coleta) + ' ' + safeText(item.hora_coleta)),
            escapeHtml(firstFilled(item.agente, item.matricula, '—')),
            escapeHtml([item.logradouro, item.numero, item.bairro].filter(Boolean).join(', ')),
            escapeHtml(item.status_laboratorio || '—'),
            escapeHtml(item.resultado_laboratorio || '—'),
            escapeHtml(item.especie || '—')
          ];
        }))
      ].join(''));
    }

    if (type === 'tubitos_positivos') {
      return reportHtml('Tubitos positivos / Aedes', makeTable(
        ['Tubito', 'Coleta', 'Agente', 'Morador', 'Endereço', 'Resultado', 'Espécie'],
        positiveTubitos.map(function (item) {
          return [
            escapeHtml(item.numero_tubito || item.uid || '—'),
            escapeHtml(formatDateBR(item.data_coleta) + ' ' + safeText(item.hora_coleta)),
            escapeHtml(firstFilled(item.agente, item.matricula, '—')),
            escapeHtml(firstFilled(item.morador, '—')),
            escapeHtml([item.logradouro, item.numero, item.bairro].filter(Boolean).join(', ')),
            escapeHtml(firstFilled(item.resultado_laboratorio, item.positivo_aedes, 'Positivo')),
            escapeHtml(firstFilled(item.especie, '—'))
          ];
        })
      ));
    }

    if (type === 'escadas') {
      return reportHtml('Relatório de escadas / apoio', makeTable(['Data', 'Agente', 'Morador', 'Endereço', 'Status', 'Motivo'], ladderRows.map(function (visit) {
        return [
          escapeHtml(formatDateBR(visit.data)),
          escapeHtml(firstFilled(visit.agente, visit.matricula, '—')),
          escapeHtml(visit.morador || '—'),
          escapeHtml([visit.logradouro, visit.numero, visit.bairro].filter(Boolean).join(', ')),
          escapeHtml(firstFilled(visit.ladder_support_status, visit.solicita_escada, visit.ladder_support_requested, '—')),
          escapeHtml(firstFilled(visit.ladder_support_no_reason, visit.motivo_nao_solicitou_escada, visit.motivo_caixa_agua, visit.water_access_reason, '—'))
        ];
      })));
    }

    if (type === 'escadas_resumo') {
      var ladderByStatus = groupCount(ladderRows, function (item) {
        return firstFilled(item.ladder_support_status, item.solicita_escada, item.ladder_support_requested, 'Não informado');
      });
      return reportHtml('Resumo de escadas / apoio', [
        metricBox('Registros com escada / apoio', String(ladderRows.length), ''),
        makeTable(['Status', 'Quantidade'], Object.keys(ladderByStatus).sort().map(function (status) {
          return [escapeHtml(status), escapeHtml(String(ladderByStatus[status] || 0))];
        }))
      ].join(''));
    }

    if (type === 'caixas') {
      return reportHtml('Relatório de caixas d’água', makeTable(['Data', 'Morador', 'Endereço', 'Situação', 'Acesso', 'Tratamento / motivo'], tankRows.map(function (visit) {
        return [
          escapeHtml(formatDateBR(visit.data)),
          escapeHtml(visit.morador || '—'),
          escapeHtml([visit.logradouro, visit.numero, visit.bairro].filter(Boolean).join(', ')),
          escapeHtml(firstFilled(visit.situacao_caixa_agua, visit.water_tank_condition, '—')),
          escapeHtml(firstFilled(visit.acessou_caixa_agua, '—')),
          escapeHtml(firstFilled(visit.tratamento_caixa_agua, visit.water_tank_treatment, visit.motivo_caixa_agua, visit.water_access_reason, '—'))
        ];
      })));
    }

    if (type === 'caixas_resumo') {
      var groupCaixa = {};
      tankRows.forEach(function (visit) {
        var status = firstFilled(visit.situacao_caixa_agua, visit.water_tank_condition, visit.acessou_caixa_agua, 'Não informado');
        groupCaixa[status] = (groupCaixa[status] || 0) + 1;
      });
      return reportHtml('Resumo de situações de caixas d’água', makeTable(['Situação', 'Quantidade'], Object.keys(groupCaixa).sort().map(function (status) {
        return [escapeHtml(status), escapeHtml(String(groupCaixa[status] || 0))];
      })));
    }

    if (type === 'caixas_por_bairro') {
      var groupedTanks = {};
      tankRows.forEach(function (visit) {
        var key = [visit.bairro || '—', visit.microarea || '—'].join(' • ');
        if (!groupedTanks[key]) {
          groupedTanks[key] = { total: 0, criticas: 0 };
        }
        groupedTanks[key].total += 1;
        if (hasTankIssue(visit)) { groupedTanks[key].criticas += 1; }
      });
      return reportHtml('Caixas d’água por bairro / microárea', makeTable(
        ['Bairro • Microárea', 'Registros de caixa', 'Caixas críticas'],
        Object.keys(groupedTanks).sort().map(function (key) {
          return [
            escapeHtml(key),
            escapeHtml(String(groupedTanks[key].total || 0)),
            escapeHtml(String(groupedTanks[key].criticas || 0))
          ];
        })
      ));
    }

    if (type === 'caixas_criticas') {
      var criticalTankRows = tankRows.filter(hasTankIssue);
      return reportHtml('Caixas críticas / destampadas', makeTable(
        ['Data', 'Morador', 'Endereço', 'Bairro', 'Microárea', 'Situação', 'Agente'],
        criticalTankRows.map(function (visit) {
          return [
            escapeHtml(formatDateBR(visit.data)),
            escapeHtml(firstFilled(visit.morador, '—')),
            escapeHtml([visit.logradouro, visit.numero].filter(Boolean).join(', ')),
            escapeHtml(firstFilled(visit.bairro, '—')),
            escapeHtml(firstFilled(visit.microarea, '—')),
            escapeHtml(firstFilled(visit.situacao_caixa_agua, visit.water_tank_condition, visit.acessou_caixa_agua, '—')),
            escapeHtml(firstFilled(visit.agente, visit.matricula, '—'))
          ];
        })
      ));
    }

    if (type === 'agentes' || type === 'agentes_completo') {
      return reportHtml('Relatório completo dos agentes', [
        '<div class="grid-summary">',
        metricBox('Agentes analisados', String(agentMetrics.length), ''),
        metricBox('Produção total', String(agentMetrics.reduce(function (sum, row) { return sum + Number(row.visits || 0); }, 0)), ''),
        metricBox('Faltas de login', String(agentMetrics.reduce(function (sum, row) { return sum + Number(row.missingDays || 0); }, 0)), ''),
        metricBox('Encerraram cedo', String(agentMetrics.reduce(function (sum, row) { return sum + Number(row.earlyClosures || 0); }, 0)), ''),
        '</div>',
        makeTable(
          ['Matrícula', 'Nome', 'Perfil', 'Produção', 'Trabalhados', 'Fechados', 'Recuperados', 'Depósitos', 'Focos', 'Tubitos', 'Tubitos positivos', 'Escadas', 'Caixas críticas', 'Logins', 'Faltas', 'Último login'],
          agentMetrics.map(function (item) {
            return [
              escapeHtml(item.matricula || '—'),
              escapeHtml(item.nome || '—'),
              escapeHtml(item.role || '—'),
              escapeHtml(String(item.visits || 0)),
              escapeHtml(String(item.workedProperties || 0)),
              escapeHtml(String(item.closed || 0)),
              escapeHtml(String(item.recovered || 0)),
              escapeHtml(String(item.deposits || 0)),
              escapeHtml(String(item.focos || 0)),
              escapeHtml(String(item.tubitos || 0)),
              escapeHtml(String(item.tubitosPositivos || 0)),
              escapeHtml(String(item.ladder || 0)),
              escapeHtml(String(item.caixasCriticas || 0)),
              escapeHtml(String(item.loggedDays || 0)),
              escapeHtml(String(item.missingDays || 0)),
              escapeHtml(formatDateTimeBR(item.lastLoginAt || ''))
            ];
          })
        )
      ].join(''));
    }

    if (type === 'agentes_producao') {
      var byProduction = agentMetrics.slice().sort(function (a, b) { return b.visits - a.visits; });
      return reportHtml('Produção por agente', makeTable(
        ['Matrícula', 'Nome', 'Produção', 'Imóveis trabalhados', 'Dias trabalhados', 'Depósitos', 'Focos', 'Tubitos', 'Documentos'],
        byProduction.map(function (item) {
          return [
            escapeHtml(item.matricula || '—'),
            escapeHtml(item.nome || '—'),
            escapeHtml(String(item.visits || 0)),
            escapeHtml(String(item.workedProperties || 0)),
            escapeHtml(String(item.workedDays || 0)),
            escapeHtml(String(item.deposits || 0)),
            escapeHtml(String(item.focos || 0)),
            escapeHtml(String(item.tubitos || 0)),
            escapeHtml(String(item.documents || 0))
          ];
        })
      ));
    }

    if (type === 'agentes_territorios') {
      var territoryRows = getAgentTerritoryRows();
      return reportHtml('Microáreas e quarteirões trabalhados por agente', [
        '<div class="grid-summary">',
        metricBox('Agentes com visita', String(uniqueList(territoryRows.map(function (item) { return item.matricula; })).length), ''),
        metricBox('Territórios trabalhados', String(territoryRows.length), 'combinações de microárea e quarteirão'),
        metricBox('Visitas registradas', String(territoryRows.reduce(function (sum, item) { return sum + Number(item.visitas || 0); }, 0)), ''),
        '</div>',
        makeTable(
          ['Matrícula', 'Agente', 'Bairro', 'Microárea', 'Quarteirão', 'Visitas', 'Imóveis', 'VD', 'P.E.', 'LIRAA', 'Fechados', 'Depósitos', 'Focos', 'Tubitos', 'Período'],
          territoryRows.map(function (item) {
            return [
              escapeHtml(item.matricula || '—'),
              escapeHtml(item.nome || '—'),
              escapeHtml(item.bairro || '—'),
              escapeHtml(item.microarea || '—'),
              escapeHtml(item.quarteirao || '—'),
              escapeHtml(String(item.visitas || 0)),
              escapeHtml(String(item.imoveis || 0)),
              escapeHtml(String(item.vd || 0)),
              escapeHtml(String(item.pe || 0)),
              escapeHtml(String(item.liraa || 0)),
              escapeHtml(String(item.fechados || 0)),
              escapeHtml(String(item.depositos || 0)),
              escapeHtml(String(item.focos || 0)),
              escapeHtml(String(item.tubitos || 0)),
              escapeHtml((item.primeiraData ? formatDateBR(item.primeiraData) : '—') + ' a ' + (item.ultimaData ? formatDateBR(item.ultimaData) : '—'))
            ];
          })
        )
      ].join(''));
    }

    if (type === 'agentes_fechados') {
      var byClosed = agentMetrics.slice().sort(function (a, b) { return b.closed - a.closed; });
      return reportHtml('Fechados por agente', makeTable(
        ['Matrícula', 'Nome', 'Fechados', 'Produção', 'Taxa de fechados', 'Recuperados', 'Último login'],
        byClosed.map(function (item) {
          return [
            escapeHtml(item.matricula || '—'),
            escapeHtml(item.nome || '—'),
            escapeHtml(String(item.closed || 0)),
            escapeHtml(String(item.visits || 0)),
            escapeHtml(item.closedRate || '0%'),
            escapeHtml(String(item.recovered || 0)),
            escapeHtml(formatDateTimeBR(item.lastLoginAt || ''))
          ];
        })
      ));
    }

    if (type === 'agentes_presencas') {
      var byPresence = agentMetrics.slice().sort(function (a, b) { return b.loggedDays - a.loggedDays; });
      return reportHtml('Presenças / logins por agente', makeTable(
        ['Matrícula', 'Nome', 'Dias úteis', 'Dias com login', 'Taxa de presença', 'Último login', 'Produção'],
        byPresence.map(function (item) {
          return [
            escapeHtml(item.matricula || '—'),
            escapeHtml(item.nome || '—'),
            escapeHtml(String(item.businessDays || 0)),
            escapeHtml(String(item.loggedDays || 0)),
            escapeHtml(item.presenceRate || '0%'),
            escapeHtml(formatDateTimeBR(item.lastLoginAt || '')),
            escapeHtml(String(item.visits || 0))
          ];
        })
      ));
    }

    if (type === 'agentes_faltas') {
      var byMissing = agentMetrics.slice().sort(function (a, b) { return b.missingDays - a.missingDays; });
      return reportHtml('Faltas / ausências de login', makeTable(
        ['Matrícula', 'Nome', 'Sem login', 'Dias com login', 'Taxa de presença', 'Produção', 'Fechados'],
        byMissing.map(function (item) {
          return [
            escapeHtml(item.matricula || '—'),
            escapeHtml(item.nome || '—'),
            escapeHtml(String(item.missingDays || 0)),
            escapeHtml(String(item.loggedDays || 0)),
            escapeHtml(item.presenceRate || '0%'),
            escapeHtml(String(item.visits || 0)),
            escapeHtml(String(item.closed || 0))
          ];
        })
      ));
    }

    if (type === 'agentes_encerraram_cedo') {
      var rowsEarly = agentMetrics.filter(function (item) { return (item.earlyClosures || 0) > 0; }).sort(function (a, b) { return b.earlyClosures - a.earlyClosures; });
      return reportHtml('Agentes que encerraram cedo', makeTable(
        ['Matrícula', 'Nome', 'Encerramentos cedo', 'Produção', 'Dias com login', 'Último login'],
        rowsEarly.map(function (item) {
          return [
            escapeHtml(item.matricula || '—'),
            escapeHtml(item.nome || '—'),
            escapeHtml(String(item.earlyClosures || 0)),
            escapeHtml(String(item.visits || 0)),
            escapeHtml(String(item.loggedDays || 0)),
            escapeHtml(formatDateTimeBR(item.lastLoginAt || ''))
          ];
        })
      ));
    }

    if (type === 'presenca_diaria') {
      return reportHtml('Relatório diário de presença / login', makeTable(['Data', 'Matrícula', 'Nome', 'Perfil', 'Primeiro login', 'Último login', 'Logins'], attendanceRows.map(function (item) {
        return [
          escapeHtml(formatDateBR(item.date)),
          escapeHtml(item.matricula || '—'),
          escapeHtml(item.nome || '—'),
          escapeHtml(item.role || '—'),
          escapeHtml(formatDateTimeBR(item.first_login_at || '')),
          escapeHtml(formatDateTimeBR(item.last_login_at || '')),
          escapeHtml(String(item.login_count || 0))
        ];
      })));
    }

    if (type === 'encerramentos') {
      return reportHtml('Relatório de encerramentos antecipados', [
        '<div class="grid-summary">',
        metricBox('Registros', String(earlyClosures.length), ''),
        metricBox('Agentes envolvidos', String(uniqueList(earlyClosures.map(function (item) { return item.matricula || item.agente; })).length), ''),
        metricBox('Modos diferentes', String(uniqueList(earlyClosures.map(function (item) { return item.operation_mode; })).length), ''),
        '</div>',
        makeTable(['Data', 'Hora', 'Agente', 'Matrícula', 'Modo', 'Justificativa', 'Status'], earlyClosures.map(function (item) {
          return [
            escapeHtml(formatDateBR(item.data)),
            escapeHtml(item.hora || '—'),
            escapeHtml(item.agente || '—'),
            escapeHtml(item.matricula || item.actor_matricula || '—'),
            escapeHtml(item.operation_mode || '—'),
            escapeHtml(item.justificativa || item.descricao || '—'),
            escapeHtml(item.status || 'Registrado')
          ];
        }))
      ].join(''));
    }

    return reportHtml('Relatório', '<p>Relatório não implementado.</p>');
  }

  function previewReport(type) {
    var html = buildReport(type);
    state.currentReport = html;
    byId('reportPreview').innerHTML = html.replace(/<!DOCTYPE[\s\S]*?<body>/i, '').replace(/<\/body><\/html>$/i, '');
    byId('printReportBtn').disabled = false;
    markActionSelection('[data-report]', type, 'data-report');
  }

  function printCurrentReport() {
    if (!state.currentReport) { return; }
    sessionStorage.setItem(REPORT_PRINT_KEY, state.currentReport);
    openPrintableWindow(state.currentReport, 'relatório');
  }

  function printAgentReport(type) {
    var html = buildReport(type);
    state.currentReport = html;
    sessionStorage.setItem(REPORT_PRINT_KEY, html);
    openPrintableWindow(html, 'relatório de agentes');
  }

  function renderAttendance() {
    var attendance = state.bundle && state.bundle.attendance || { rows: [], totals: {} };
    var attendanceRows = state.bundle && state.bundle.attendance_rows || [];
    var earlyClosures = state.bundle && state.bundle.early_closures || [];
    var agents = getAgentMetrics();
    var topProd = agents.slice().sort(function (a, b) { return b.visits - a.visits; });
    var moreClosed = agents.slice().sort(function (a, b) { return b.closed - a.closed; });
    var moreAbsent = agents.slice().sort(function (a, b) { return b.missingDays - a.missingDays; });
    var dailyPresence = getDailyPresenceSummary();

    byId('attendanceSummary').textContent =
      'Agentes cadastrados: ' + safeText(attendance.totals && attendance.totals.agents || 0) +
      ' • Dias úteis no mês: ' + safeText(attendance.totals && attendance.totals.businessDays || 0) +
      ' • Logins registrados: ' + safeText(attendance.totals && attendance.totals.loggedDays || 0) +
      ' • Ausências de login: ' + safeText(attendance.totals && attendance.totals.missingDays || 0);

    byId('agentKpis').innerHTML = [
      { label: 'Maior produção', value: topProd[0] ? topProd[0].nome : '—', note: topProd[0] ? (topProd[0].visits + ' visitas') : 'sem produção' },
      { label: 'Mais fechados', value: moreClosed[0] ? moreClosed[0].nome : '—', note: moreClosed[0] ? (moreClosed[0].closed + ' fechados') : 'sem fechados' },
      { label: 'Mais faltas', value: moreAbsent[0] ? moreAbsent[0].nome : '—', note: moreAbsent[0] ? (moreAbsent[0].missingDays + ' ausências de login') : 'sem faltas' },
      { label: 'Encerraram cedo', value: String(agents.filter(function (row) { return row.earlyClosures > 0; }).length), note: 'agentes com ao menos 1 registro' },
      { label: 'Tubitos positivos', value: String(agents.reduce(function (sum, row) { return sum + Number(row.tubitosPositivos || 0); }, 0)), note: 'somatório por agente' }
    ].map(function (item) {
      return '<div class="summary-card"><div class="kicker">' + escapeHtml(item.label) + '</div><strong>' + escapeHtml(item.value) + '</strong><div class="small muted">' + escapeHtml(item.note) + '</div></div>';
    }).join('');

    byId('agentProductionTable').innerHTML = makeTable(
      ['Matrícula', 'Nome', 'Perfil', 'Produção', 'Trabalhados', 'Fechados', 'Recuperados', 'Depósitos', 'Focos', 'Tubitos', 'Caixas críticas', 'Escadas'],
      topProd.map(function (item) {
        return [
          escapeHtml(item.matricula || '—'),
          escapeHtml(item.nome || '—'),
          escapeHtml(item.role || '—'),
          escapeHtml(String(item.visits || 0)),
          escapeHtml(String(item.workedProperties || 0)),
          escapeHtml(String(item.closed || 0)),
          escapeHtml(String(item.recovered || 0)),
          escapeHtml(String(item.deposits || 0)),
          escapeHtml(String(item.focos || 0)),
          escapeHtml(String(item.tubitos || 0)),
          escapeHtml(String(item.caixasCriticas || 0)),
          escapeHtml(String(item.ladder || 0))
        ];
      })
    );

    byId('attendanceTable').innerHTML = makeTable(
      ['Matrícula', 'Nome', 'Perfil', 'Dias úteis', 'Dias com login', 'Dias sem login', 'Taxa de presença', 'Último login'],
      agents.map(function (item) {
        return [
          escapeHtml(item.matricula || '—'),
          escapeHtml(item.nome || '—'),
          escapeHtml(item.role || '—'),
          escapeHtml(String(item.businessDays || 0)),
          escapeHtml(String(item.loggedDays || 0)),
          escapeHtml(String(item.missingDays || 0)),
          escapeHtml(item.presenceRate || '0%'),
          escapeHtml(formatDateTimeBR(item.lastLoginAt || ''))
        ];
      })
    );

    byId('agentAbsenceTable').innerHTML = makeTable(
      ['Matrícula', 'Nome', 'Sem login', 'Dias com login', 'Produção no período', 'Fechados', 'Último login'],
      moreAbsent.filter(function (item) { return (item.missingDays || 0) > 0 || (item.loggedDays || 0) === 0; }).map(function (item) {
        return [
          escapeHtml(item.matricula || '—'),
          escapeHtml(item.nome || '—'),
          escapeHtml(String(item.missingDays || 0)),
          escapeHtml(String(item.loggedDays || 0)),
          escapeHtml(String(item.visits || 0)),
          escapeHtml(String(item.closed || 0)),
          escapeHtml(formatDateTimeBR(item.lastLoginAt || ''))
        ];
      })
    );

    byId('earlyClosureTable').innerHTML = makeTable(
      ['Data', 'Hora', 'Agente', 'Matrícula', 'Modo', 'Justificativa'],
      earlyClosures.map(function (item) {
        return [
          escapeHtml(formatDateBR(item.data)),
          escapeHtml(item.hora || '—'),
          escapeHtml(item.agente || '—'),
          escapeHtml(item.matricula || item.actor_matricula || '—'),
          escapeHtml(item.operation_mode || '—'),
          escapeHtml(item.justificativa || item.descricao || '—')
        ];
      })
    );

    byId('agentDailyPresenceTable').innerHTML = makeTable(
      ['Data', 'Agentes com login', 'Total de logins', 'Primeiro login', 'Último login'],
      dailyPresence.map(function (item) {
        return [
          escapeHtml(formatDateBR(item.date)),
          escapeHtml(String(item.agents || 0)),
          escapeHtml(String(item.logins || 0)),
          escapeHtml(formatDateTimeBR(item.first || '')),
          escapeHtml(formatDateTimeBR(item.last || ''))
        ];
      })
    );

    if (byId('agentTerritoryTable')) {
      byId('agentTerritoryTable').innerHTML = makeTable(
        ['Matrícula', 'Agente', 'Bairro', 'Microárea', 'Quarteirão', 'Visitas', 'Imóveis', 'VD', 'P.E.', 'LIRAA', 'Fechados', 'Focos'],
        getAgentTerritoryRows().map(function (item) {
          return [
            escapeHtml(item.matricula || '—'),
            escapeHtml(item.nome || '—'),
            escapeHtml(item.bairro || '—'),
            escapeHtml(item.microarea || '—'),
            escapeHtml(item.quarteirao || '—'),
            escapeHtml(String(item.visitas || 0)),
            escapeHtml(String(item.imoveis || 0)),
            escapeHtml(String(item.vd || 0)),
            escapeHtml(String(item.pe || 0)),
            escapeHtml(String(item.liraa || 0)),
            escapeHtml(String(item.fechados || 0)),
            escapeHtml(String(item.focos || 0))
          ];
        })
      );
    }
  }

  function populateFilters() {
    var properties = state.bundle.properties || [];
    var visits = state.bundle.visits || [];
    fillSelect('searchBairro', collectOptions(properties.map(function (item) { return item.bairro; })));
    fillSelect('searchMicroarea', collectOptions(properties.map(function (item) { return item.microarea; })));
    fillSelect('searchMatricula', collectOptions(visits.map(function (item) { return item.matricula; })));
  }

  function afterBundleLoaded() {
    buildIndexes();
    populateFilters();
    renderStats();
    renderResults();
    renderAttendance();
    setSessionInfo();
  }

  function bundleFilters() {
    return {
      from: byId('filterFrom').value || defaultFromIso(),
      to: byId('filterTo').value || todayIso(),
      month: byId('filterMonth').value || monthIso(),
      limit: 15000,
      documents_limit: 1000
    };
  }

  function loadBundle() {
    if (!state.session) { return Promise.resolve(); }
    showMessage('loginMsg', 'Atualizando base da secretaria...', false);
    return postApi(Object.assign({
      action: 'secretaria_private_bundle',
      access_module: 'secretaria',
      sessionToken: state.session.sessionToken
    }, bundleFilters())).then(function (bundle) {
      state.bundle = bundle;
      afterBundleLoaded();
      byId('loginSection').classList.add('hidden');
      byId('appSection').classList.remove('hidden');
      document.body.classList.add('secretaria-app-ready');
      showMessage('loginMsg', '', false);
      resetIdleTimer();
    }).catch(function (err) {
      showMessage('loginMsg', safeText(err && err.message || err), true);
      throw err;
    });
  }

  function login() {
    showMessage('loginMsg', 'Entrando...', false);
    postApi({
      action: 'panel_private_login',
      access_module: 'secretaria',
      cpf: byId('loginCpf').value,
      senha: byId('loginSenha').value
    }).then(function (response) {
      saveSession({
        sessionToken: response.sessionToken,
        nome: safeText(response.agent && response.agent.nome),
        matricula: safeText(response.agent && response.agent.matricula),
        role: safeText(response.agent && response.agent.role)
      });
      return loadBundle();
    }).catch(function (err) {
      showMessage('loginMsg', safeText(err && err.message || err), true);
    });
  }

  function logout() {
    var token = state.session && state.session.sessionToken;
    clearIdleTimers();
    state.sessionNote = '';
    saveSession(null);
    state.bundle = null;
    state.selectedPropertyUid = '';
    state.currentDoc = null;
    state.currentReport = null;
    document.body.classList.remove('secretaria-app-ready');
    byId('appSection').classList.add('hidden');
    byId('loginSection').classList.remove('hidden');
    byId('loginSenha').value = '';
    byId('loginMsg').textContent = '';
    if (!token) { return; }
    postApi({
      action: 'panel_private_logout',
      access_module: 'secretaria',
      sessionToken: token
    }).catch(function () {});
  }

  function updateActiveModuleHeader(tabName) {
    void tabName;
  }

  function installTabHandlers() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (button) {
      button.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
          tab.classList.toggle('is-active', tab === button);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.tab-panel'), function (panel) {
          panel.classList.add('hidden');
        });
        byId('tab-' + button.getAttribute('data-tab')).classList.remove('hidden');
        updateActiveModuleHeader(button.getAttribute('data-tab'));
      });
    });
  }

  function installEvents() {
    installTabHandlers();
    var loginHandler = function (event) {
      if (event && typeof event.preventDefault === 'function') { event.preventDefault(); }
      login();
    };
    byId('loginBtn').addEventListener('click', loginHandler);
    if (byId('loginForm')) {
      byId('loginForm').addEventListener('submit', loginHandler);
    }
    ['loginCpf', 'loginSenha'].forEach(function (id) {
      var node = byId(id);
      if (!node) { return; }
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          login();
        }
      });
    });
    byId('logoutBtn').addEventListener('click', logout);
    byId('reloadBtn').addEventListener('click', function () {
      loadBundle();
    });
    if (byId('sidebarLogoutBtn')) {
      byId('sidebarLogoutBtn').addEventListener('click', logout);
    }
    if (byId('sidebarReloadBtn')) {
      byId('sidebarReloadBtn').addEventListener('click', function () {
        loadBundle();
      });
    }

    ['searchText', 'searchBairro', 'searchMicroarea', 'searchMatricula'].forEach(function (id) {
      byId(id).addEventListener('input', renderResults);
      byId(id).addEventListener('change', renderResults);
    });

    byId('clearSearchBtn').addEventListener('click', function () {
      byId('searchText').value = '';
      byId('searchBairro').value = '';
      byId('searchMicroarea').value = '';
      byId('searchMatricula').value = '';
      renderResults();
    });

    if (byId('clearManualBtn')) {
      byId('clearManualBtn').addEventListener('click', function () {
        ['manualRecipient', 'manualRecipientType', 'manualAddress', 'manualObs', 'manualProtocol', 'manualPrazo', 'manualSetor', 'manualReference'].forEach(function (id) {
          var node = byId(id);
          if (!node) { return; }
          node.value = '';
        });
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-doc]'), function (button) {
      button.addEventListener('click', function () {
        previewDocument(button.getAttribute('data-doc'));
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-report]'), function (button) {
      button.addEventListener('click', function () {
        previewReport(button.getAttribute('data-report'));
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-agent-report]'), function (button) {
      button.addEventListener('click', function () {
        printAgentReport(button.getAttribute('data-agent-report'));
      });
    });

    byId('printDocBtn').addEventListener('click', printCurrentDocument);
    if (byId('deliverDocBtn')) { byId('deliverDocBtn').addEventListener('click', deliverCurrentDocument); }
    if (byId('cancelDocBtn')) { byId('cancelDocBtn').addEventListener('click', cancelCurrentDocument); }
    if (byId('documentLog')) { byId('documentLog').addEventListener('click', handleDocumentLogAction); }
    byId('printReportBtn').addEventListener('click', printCurrentReport);
    byId('clearDocBtn').addEventListener('click', function () {
      state.currentDoc = null;
      byId('docPreview').innerHTML = 'Escolha um modelo para gerar a pré-visualização.';
      byId('printDocBtn').disabled = true;
      updateCurrentDocumentActions();
      markActionSelection('[data-doc]', '__none__', 'data-doc');
    });
    byId('clearReportBtn').addEventListener('click', function () {
      state.currentReport = null;
      byId('reportPreview').innerHTML = 'Escolha um relatório para gerar a visualização pronta para impressão.';
      byId('printReportBtn').disabled = true;
      markActionSelection('[data-report]', '__none__', 'data-report');
    });

    ['pointerdown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(function (eventName) {
      document.addEventListener(eventName, registerActivity, { passive: true });
    });
    window.addEventListener('focus', registerActivity);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        registerActivity();
      }
    });
  }

  function setDefaultFilters() {
    byId('filterFrom').value = defaultFromIso();
    byId('filterTo').value = todayIso();
    byId('filterMonth').value = monthIso();
  }

  function init() {
    if (!API_URL) {
      showMessage('loginMsg', 'Runtime config sem API_URL.', true);
      return;
    }
    setDefaultFilters();
    installEvents();
    var remembered = loadSession();
    if (remembered && remembered.sessionToken) {
      saveSession(remembered);
      loadBundle().catch(function () {
        saveSession(null);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
