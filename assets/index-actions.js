(function () {
  'use strict';

  window.ACSField = window.ACSField || {};
  var app = window.ACSField;

    app.ensureInitialAdminAgent = function () {
    app.ensureConfigurationAdminAgent();
  };

  app.isConfigurationAdmin = function (agent) {
    var person = agent || {};
    return String(person.uid || '').trim().toUpperCase() === 'AGT-ADM-CONFIG' ||
      String(person.nome || '').trim().toUpperCase() === 'ADM' ||
      String(person.matricula || '').trim().toUpperCase() === 'ADM';
  };

  app.isRemovedAgent = function (agent) {
    var person = agent || {};
    if (!person || app.isConfigurationAdmin(person)) {
      return false;
    }
    if (['removido', 'excluido', 'excluído', 'deleted'].indexOf(app.normalizeLabel(person.role || person.status || '')) > -1) {
      return true;
    }
    return false;
  };

  app.getAgentDeletionKeys = function (agent) {
    var person = agent || {};
    return [
      'uid:' + app.normalizeLabel(person.uid || ''),
      'matricula:' + app.normalizeLabel(person.matricula || '')
    ].filter(function (key) {
      return key.indexOf(':') < key.length - 1;
    });
  };

  app.getDeletedAgentKeys = function () {
    var system = app.readSystemState();
    return Array.isArray(system.deletedAgentKeys) ? system.deletedAgentKeys : [];
  };

  app.getDeletedAgentRecords = function () {
    var system = app.readSystemState();
    return Array.isArray(system.deletedAgentRecords) ? system.deletedAgentRecords : [];
  };

  app.isAgentDeletedLocally = function (agent) {
    var deletedKeys;
    if (!agent || app.isConfigurationAdmin(agent)) {
      return false;
    }
    deletedKeys = app.getDeletedAgentKeys();
    return app.getAgentDeletionKeys(agent).some(function (key) {
      return deletedKeys.indexOf(key) > -1;
    });
  };

  app.shouldHideAgent = function (agent) {
    return app.isRemovedAgent(agent) || app.isAgentDeletedLocally(agent);
  };

  app.markAgentDeleted = function (agent) {
    var deletedKeys;
    var deletedRecords;
    var normalized;
    if (!agent) {
      return;
    }
    normalized = app.normalizeAgent(agent);
    deletedKeys = app.getDeletedAgentKeys();
    app.getAgentDeletionKeys(agent).forEach(function (key) {
      if (deletedKeys.indexOf(key) === -1) {
        deletedKeys.push(key);
      }
    });
    deletedRecords = app.getDeletedAgentRecords().filter(function (row) {
      return String(row.uid || '').trim() !== normalized.uid &&
        app.normalizeLabel(row.matricula || '') !== app.normalizeLabel(normalized.matricula || '');
    });
    deletedRecords.push({
      uid: normalized.uid,
      nome: normalized.nome,
      matricula: normalized.matricula,
      deletedAt: new Date().toISOString()
    });
    app.saveSystemState({ deletedAgentKeys: deletedKeys, deletedAgentRecords: deletedRecords });
  };

  app.clearAgentDeletedMark = function (agent) {
    var keys = app.getAgentDeletionKeys(agent);
    var deletedKeys = app.getDeletedAgentKeys().filter(function (key) {
      return keys.indexOf(key) === -1;
    });
    var deletedRecords = app.getDeletedAgentRecords().filter(function (row) {
      return String(row.uid || '').trim() !== String(agent.uid || '').trim() &&
        app.normalizeLabel(row.matricula || '') !== app.normalizeLabel(agent.matricula || '');
    });
    app.saveSystemState({ deletedAgentKeys: deletedKeys, deletedAgentRecords: deletedRecords });
  };

  app.ensureConfigurationAdminAgent = function () {
    var agents = app.readAgents().filter(function (agent) {
      return !app.shouldHideAgent(agent);
    });
    var legacyDefaultAdminHash = '86f65e28a754e1a71b2df9403615a6c436c32c42a75a10d02813961b86f1e428';
    var index = agents.findIndex(function (agent) {
      return app.isConfigurationAdmin(agent);
    });
    if (index > -1) {
      var current = agents[index];
      var record = Object.assign({}, current);
      var changed = false;
      if (!app.normalizeCpf(record.cpf || '')) {
        record.cpf = '11111111111';
        changed = true;
      }
      if (!String(record.senhaHash || '').trim() || String(record.senhaHash || '').trim() === legacyDefaultAdminHash) {
        record.senhaHash = '04c1debae1dd4edeba575193ac6979cdbe9dc99acf878e2dc7ac0de4777bcccb';
        changed = true;
      }
      if (!app.isManagerRole(record.role)) {
        record.role = 'Administrador';
        changed = true;
      }
      if (!record.updatedAt) {
        record.updatedAt = new Date().toISOString();
        changed = true;
      }
      if (changed) {
        agents[index] = record;
        app.saveAgents(agents);
      }
      return;
    }
    if (agents.some(function (agent) {
      return app.isManagerRole(agent.role) && agent.senhaHash;
    })) {
      return;
    }
    if (app.isApiConfigured()) {
      return;
    }
    agents.push({
      uid: 'AGT-ADM-CONFIG',
      nome: 'Administrador',
      matricula: 'ADM',
      cpf: '11111111111',
      role: 'Administrador',
      baseMicroarea: '',
      baseRegion: 'Configuração do sistema',
      senhaHash: '04c1debae1dd4edeba575193ac6979cdbe9dc99acf878e2dc7ac0de4777bcccb',
      updatedAt: new Date().toISOString()
    });
    app.saveAgents(agents);
  };

  app.cleanupRemovedAgents = function () {
    var agents = app.readAgents();
    var filtered = agents.filter(function (agent) {
      return !app.shouldHideAgent(agent);
    });
    if (filtered.length !== agents.length) {
      app.saveAgents(filtered);
      if (app.state.currentAgent && app.isRemovedAgent(app.state.currentAgent)) {
        app.state.currentAgent = null;
        app.saveSession(null);
      }
    }
    app.ensureConfigurationAdminAgent();
  };

  app.ensureDynamicLayout = function () {
    var loginTitle = document.querySelector('.login-card h1');
    var loginText = document.querySelector('.login-card p');
    var headerTitle = document.querySelector('.brand-copy h1');
    var footer = document.querySelector('.app-credit');
    var propertySearch = document.getElementById('propertySearch');
    var propertySort = document.getElementById('propertySort');
    var syncNowBtn = document.getElementById('syncNowBtn');

    if (loginTitle) { loginTitle.textContent = 'ACE Campo'; }
    if (loginText) { loginText.textContent = ''; }
    if (headerTitle) { headerTitle.textContent = 'ACE Campo | Campo'; }

    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'app-credit';
      if (syncNowBtn && syncNowBtn.closest('.card')) {
        syncNowBtn.closest('.card').insertAdjacentElement('afterend', footer);
      } else {
        document.body.appendChild(footer);
      }
    }
    if (footer) {
      footer.textContent = 'Desenvolvido por Almir Lemgruber';
    }

    if (propertySearch) {
      propertySearch.placeholder = 'Nome, rua, nº, bairro, MA/Q ou referência';
    }

    if (document.getElementById('propLogradouro')) {
      var propLogradouroInput = document.getElementById('propLogradouro');
      propLogradouroInput.setAttribute('list', 'propLogradouroOptions');
      if (!document.getElementById('propLogradouroOptions')) {
        document.body.insertAdjacentHTML('beforeend', '<datalist id="propLogradouroOptions"></datalist>');
      }
      if (!document.getElementById('propStreetSuggestion')) {
        propLogradouroInput.insertAdjacentHTML('afterend', '<div id="propStreetSuggestion" class="field-help street-suggestion" hidden></div>');
      }
    }

    if (propertySort && !propertySort.querySelector('option[value="territory"]')) {
      var distanceOption = propertySort.querySelector('option[value="distance"]');
      if (distanceOption) {
        distanceOption.insertAdjacentHTML('afterend', '<option value="territory">Por microárea / quarteirão</option>');
      } else {
        propertySort.insertAdjacentHTML('beforeend', '<option value="territory">Por microárea / quarteirão</option>');
      }
      if (!propertySort.value) {
        propertySort.value = 'distance';
      }
    }

    if (!document.getElementById('syncCenterGrid')) {
      var actionsCard = document.getElementById('syncNowBtn');
      if (actionsCard) {
        var actionsWrap = actionsCard.closest('.card');
        if (actionsWrap) {
          actionsWrap.insertAdjacentHTML('afterend', '' +
            '<section class="card">' +
              '<h2 class="section-title">Backup e fila offline</h2>' +
              '<div id="syncCenterGrid" class="grid four"></div>' +
              '<div class="btn-row sync-export-actions" style="margin-top:16px">' +
                '<button class="btn sync-export-btn sync-export-all" id="exportBackupBtn" type="button">' +
                  '<span class="sync-export-icon" aria-hidden="true">💾</span>' +
                  '<span class="sync-export-copy"><span class="sync-export-title">Exportar backup local</span><span class="sync-export-hint">JSON completo com fila, cache e planos salvos no aparelho</span></span>' +
                '</button>' +
                '<button class="btn sync-export-btn sync-export-queue" id="downloadQueueBtn" type="button">' +
                  '<span class="sync-export-icon" aria-hidden="true">⏳</span>' +
                  '<span class="sync-export-copy"><span class="sync-export-title">Baixar fila pendente</span><span class="sync-export-hint">CSV das visitas aguardando envio para a Nuvem</span></span>' +
                '</button>' +
              '</div>' +
              '<div id="syncQueueList" class="history-list" style="margin-top:16px"></div>' +
            '</section>');
        }
      }
    }
  };

  app.canManageAdmin = function () {
    var agents = app.readAgents();
    var currentAgent = app.state.currentAgent;
    if (!agents.length) {
      return true;
    }
    if (!currentAgent) {
      return false;
    }
    return app.isConfigurationAdmin(currentAgent) || app.isManagerRole(currentAgent.role);
  };

  app.updateAdminAccessUi = function () {};

  app.renderAdminSystemPanel = function () {
    var node = document.getElementById('adminSystemSummary');
    if (!node) {
      return;
    }
    var health = app.getServiceHealth();
    var currentAgent = app.state.currentAgent;
    var items = [
      'Versão: ' + app.CONFIG.APP_VERSION + '.',
      'Nuvem: ' + (app.isApiConfigured() ? 'conectada.' : 'não configurada.'),
      'Fila local: ' + (health.queueTotal || health.queue || 0) + ' item(ns) aguardando envio.',
      health.lastSyncAt ? 'Última sincronização: ' + app.formatSyncMoment(health.lastSyncAt) + '.' : 'Ainda não houve sincronização concluída nesta versão.',
      health.lastBackupAt ? 'Última exportação CSV: ' + health.lastBackupAt + '.' : 'CSV local ainda não exportado.',
      currentAgent ? 'Sessão atual: ' + currentAgent.nome + ' • ' + currentAgent.role + '.' : 'Sem sessão ativa no momento.'
    ];
    if (health.lastSyncError) {
      items.push('Último alerta de sincronização: ' + health.lastSyncError + '.');
    }
    node.innerHTML = items.map(function (text) {
      return '<div class="insight-card"><strong>Gestão</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(text) + '</div></div>';
    }).join('');
  };

  app.renderGpsTerritoryStatus = function () {
    var node = document.getElementById('gpsTerritoryStatus');
    if (!node) {
      return;
    }
    if (!app.state.visit.gps) {
      node.textContent = 'Classificação territorial por GPS ainda indisponível.';
      return;
    }
    if (typeof app.buildGpsAdministrativeMessage === 'function') {
      node.textContent = app.buildGpsAdministrativeMessage(app.state.visit, app.state.territoryHint || null);
      return;
    }
    if (app.state.territoryHint) {
      node.textContent = 'GPS detectou ' + app.state.territoryHint.territoryName +
        (app.state.territoryHint.quarteirao ? ' • Q ' + app.state.territoryHint.quarteirao : ' • sem quarteirão') + '. O território oficial permanece o informado pelo agente.';
      return;
    }
    node.textContent = 'GPS capturado, mas sem polígono territorial correspondente no KMZ. O território oficial permanece o informado pelo agente.';
  };

  app.formatSyncMoment = function (value) {
    var date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  app.renderSyncCenter = function () {
    var grid = document.getElementById('syncCenterGrid');
    var list = document.getElementById('syncQueueList');
    if (!grid || !list) {
      return;
    }
    var health = app.getServiceHealth();
    var pendingVisits = app.getUnsyncedVisits().sort(app.compareVisitDesc);
    if (typeof app.renderPanelFieldGuide === 'function') {
      app.renderPanelFieldGuide();
    }
    grid.innerHTML = [
      app.makeMetricCard('Pendentes no aparelho', health.queueTotal || health.queue || 0, (health.queueTotal || health.queue) ? 'warn' : 'ok'),
      app.makeMetricCard('Rede', health.offline ? 'Offline' : 'Online', health.offline ? 'danger' : 'accent'),
      app.makeMetricCard('Último envio', health.lastSyncAt ? app.formatSyncMoment(health.lastSyncAt) : 'Ainda não', health.lastSyncAt ? 'accent' : 'warn'),
      app.makeMetricCard('Supervisão pendente', health.queueSupervision || 0, (health.queueSupervision || 0) ? 'warn' : 'ok'),
      app.makeMetricCard('Conflitos cadastro', health.propertyConflicts || 0, (health.propertyConflicts || 0) ? 'danger' : 'ok'),
      app.makeMetricCard('Enviados hoje', health.sentToday || 0, (health.sentToday || 0) ? 'accent' : 'warn')
    ].join('');

    if (!pendingVisits.length) {
      list.innerHTML = '<div class="empty-state">' + app.escapeHtml(
        (health.queueTotal || 0) > 0
          ? 'Não há visita pendente, mas há outros itens aguardando envio: ' + [
              health.queueTubitos ? health.queueTubitos + ' tubito(s)' : '',
              health.queueProperties ? health.queueProperties + ' cadastro(s)' : '',
              health.queueSupervision ? health.queueSupervision + ' supervisão' : '',
              health.pendingSync ? 'alteração administrativa' : ''
            ].filter(Boolean).join(', ') + '.'
          : 'Nenhuma visita pendente. A fila local está limpa.'
      ) + '</div>';
      app.updateSyncUi();
      return;
    }
    list.innerHTML = pendingVisits.slice(0, 8).map(function (visit) {
      var quality = app.computeVisitQuality(visit);
      return '<div class="history-card">' +
        '<strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong>' +
        '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora + ' • ' + (visit.bairro || '-')) + '</div>' +
        '<div class="meta-pills">' +
          '<span class="status-pill is-warn">Aguardando Nuvem</span>' +
          (quality.length ? '<span class="meta-pill">' + app.escapeHtml(quality.join(' • ')) + '</span>' : '<span class="meta-pill">Registro completo</span>') +
        '</div>' +
      '</div>';
    }).join('');
    app.updateSyncUi();
  };

  app.getSyncUiText = function () {
    var health = app.getServiceHealth();
    var pendingTotal = Number(health.queueTotal || health.queue || 0);
    var hasPending = pendingTotal > 0 || health.pendingSync;
    if (!app.isApiConfigured()) {
      return {
        chip: 'Modo local',
        kind: 'warn',
        button: 'Sem API',
        headerButton: 'Sem API',
        title: 'A Nuvem ainda não está configurada.',
        disabled: true
      };
    }
    if (health.offline) {
      return {
        chip: hasPending ? ('Offline • ' + pendingTotal + ' pendente(s)') : 'Offline',
        kind: 'danger',
        button: 'Offline',
        headerButton: 'Offline',
        title: hasPending ? 'Sem internet. Os dados seguem salvos no aparelho.' : 'Sem internet no momento.',
        disabled: true
      };
    }
    if (health.syncInFlight) {
      return {
        chip: 'Enviando',
        kind: 'accent',
        button: 'Enviando',
        headerButton: 'Enviando',
        title: 'Enviando dados para a Nuvem.',
        disabled: true
      };
    }
    if (hasPending) {
      return {
        chip: 'Pend. ' + pendingTotal,
        kind: 'warn',
        button: 'Sincronizar',
        headerButton: 'Enviar',
        title: 'Enviar agora os dados salvos no aparelho.',
        disabled: false
      };
    }
    return {
      chip: 'Enviado',
      kind: 'ok',
      button: 'Sincronizar',
      headerButton: 'Checar',
      title: 'Verificar a Nuvem e confirmar que não há pendências.',
      disabled: false
    };
  };

  app.updateSyncUi = function () {
    var state = app.getSyncUiText();
    var ids = ['headerSyncBtn', 'syncNowBtn'];
    app.setSyncChip(state.chip, state.kind);
    ids.forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) {
        return;
      }
      button.disabled = !!state.disabled;
      button.textContent = id === 'headerSyncBtn' ? (state.headerButton || state.button) : state.button;
      button.title = state.title;
    });
    if (typeof app.renderSyncDayStatus === 'function') {
      app.renderSyncDayStatus();
    }
    if (app.state && app.state.selectedScreen === 'painel') {
      if (typeof app.renderPanelOfflineCommand === 'function') {
        app.renderPanelOfflineCommand();
      }
      if (typeof app.renderPanelNextAction === 'function') {
        app.renderPanelNextAction();
      }
    }
  };

  app.renderSyncDayStatus = function () {
    var node = document.getElementById('syncDayStatus');
    if (!node) {
      return;
    }
    var health = app.getServiceHealth();
    var pendingTotal = Number(health.queueTotal || health.queue || 0);
    var lastSync = health.lastSyncAt ? app.formatSyncMoment(health.lastSyncAt) : 'ainda não realizada';
    var detail = [];
    if (health.queue) {
      detail.push(health.queue + ' visita(s)');
    }
    if (health.queueTubitos) {
      detail.push(health.queueTubitos + ' tubito(s)');
    }
    if (health.queueProperties) {
      detail.push(health.queueProperties + ' cadastro(s)');
    }
    if (health.queueSupervision) {
      detail.push(health.queueSupervision + ' supervisão');
    }
    if (health.pendingSync) {
      detail.push('alteração administrativa');
    }
    node.className = 'panel-card-note sync-day-status' + (health.offline ? ' is-danger' : (pendingTotal ? ' is-warn' : ''));
    node.textContent = 'Última sincronização: ' + lastSync + '. Pendentes no aparelho: ' + pendingTotal +
      (detail.length ? ' (' + detail.join(', ') + ')' : '') + '. Enviados hoje: ' + (health.sentToday || 0) + '.';
  };

  app.touchPendingSync = function (reason) {
    app.saveSystemState({
      pendingSync: true,
      pendingReason: String(reason || '').trim()
    });
    app.updateSyncUi();
  };

  app.escapeCsvCell = function (value) {
    var text = app.cleanUiText(value == null ? '' : String(value));
    if (/[;"\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  };

  app.exportVisitsCsv = function (onlyQueue) {
    var now = new Date().toISOString();
    var visits = (onlyQueue ? app.getUnsyncedVisits() : app.readVisits()).sort(app.compareVisitDesc);
    var rows;
    var csv;
    var blob;
    var url;
    var link = document.createElement('a');
    if (!visits.length) {
      app.showMessage(onlyQueue ? 'Não há fila local para baixar.' : 'Não há visitas locais para baixar.', 'warn');
      return;
    }
    rows = [
      [
        'Data',
        'Hora',
        'Agente',
        'Matrícula',
        'Operação',
        'Tipo/local P.E.',
        'Ciclo LIRAa',
        'Bairro',
        'Microárea',
        'Quarteirão',
        'Logradouro',
        'Número',
        'Morador',
        'Telefone/WhatsApp',
        'Situação',
        'Motivo do fechado',
        'Quem atendeu',
        'Caixa d\'água',
        'Motivo caixa d\'água',
        'Apoio de escada',
        'Motivo sem escada',
        'Situação da caixa d\'água',
        'Tratamento da caixa d\'água',
        'Tubitos',
        'Depósito do tubito',
        'Total de depósitos',
        'Depósitos com foco',
        'Depósitos tratados',
        'BPI aplicado (g)',
        'Depósitos eliminados',
        'Depósitos encontrados',
        'Locais com foco',
        'Latitude',
        'Longitude',
        'Precisão GPS (m)',
        'Território GPS',
        'Quarteirão GPS',
        'Observações',
        'Sincronizado'
      ]
    ].concat(visits.map(function (visit) {
      return [
        app.formatDateBR(visit.data),
        visit.hora || '',
        visit.agente || '',
        visit.matricula || '',
        app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD'),
        [visit.peTipoLocal || '', visit.peNomeLocal || ''].filter(Boolean).join(' - '),
        visit.liraaCiclo || '',
        visit.bairro || '',
        visit.microarea || '',
        visit.quarteirao || '',
        visit.logradouro || '',
        visit.numero || '',
        visit.morador || '',
        visit.telefone || '',
        app.getVisitStatusLabel(visit.situacao),
        visit.closedReason || '',
        visit.attendedBy || '',
        visit.waterAccess || '',
        visit.waterAccessReason || '',
        visit.ladderSupportRequested || '',
        visit.ladderSupportNoReason || '',
        visit.waterTankCondition || '',
        visit.waterTreatment || '',
        String(Number(visit.tubitosQty || 0)),
        app.getTubitoDepositText(visit),
        String(Number(visit.depositTotal || 0)),
        String(Number(visit.depositFocusTotal || 0)),
        String(app.getVisitTreatedDepositCount ? app.getVisitTreatedDepositCount(visit) : 0),
        String(app.getVisitBpiGrams ? app.getVisitBpiGrams(visit) : 0),
        String(Number(visit.depositTotal || 0) || 0),
        (visit.deposits || []).join(' | '),
        (visit.depositFocusBreakdown || []).join(' | '),
        visit.gps ? String(visit.gps.lat) : '',
        visit.gps ? String(visit.gps.lng) : '',
        visit.gps ? String(Number(visit.gps.accuracy || 0)) : '',
        visit.gpsTerritory || '',
        visit.gpsQuarteirao || '',
        visit.obs || '',
        visit.synced === false ? 'Não' : 'Sim'
      ];
    }));
    csv = '\uFEFF' + rows.map(function (row) {
      return row.map(app.escapeCsvCell).join(';');
    }).join('\r\n');
    blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    url = URL.createObjectURL(blob);
    link.href = url;
    link.download = onlyQueue ? 'ace-fila-local.csv' : 'ace-visitas-local.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (!onlyQueue) {
      app.saveSystemState({ lastBackupAt: now });
      app.addLog('backup', 'export', '', 'Visitas locais exportadas em CSV.');
    }
    app.showMessage(onlyQueue ? 'Fila local baixada em CSV.' : 'Visitas locais baixadas em CSV.', 'ok');
    app.renderSyncCenter();
    app.renderAdminSystemPanel();
  };

  app.collectKnownLocalJson = function (key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  app.buildLocalBackupPayload = function () {
    var summary = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : {};
    return {
      tipo: 'backup-local-ace-campo',
      versao: app.CONFIG && app.CONFIG.APP_VERSION ? app.CONFIG.APP_VERSION : '',
      geradoEm: new Date().toISOString(),
      observacao: 'Backup emergencial gerado no aparelho. Contém dados operacionais sensíveis; compartilhar apenas por canal institucional.',
      aparelho: {
        online: typeof navigator !== 'undefined' ? navigator.onLine : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      },
      usuarioAtual: app.state.currentAgent ? {
        nome: app.state.currentAgent.nome || '',
        matricula: app.state.currentAgent.matricula || '',
        role: app.state.currentAgent.role || ''
      } : null,
      fila: summary,
      dados: {
        visitas: app.readVisits(),
        imoveis: app.readProperties(),
        tubitos: typeof app.readTubitos === 'function' ? app.readTubitos() : [],
        solicitacoesSupervisao: typeof app.readSupervisionRequests === 'function' ? app.readSupervisionRequests() : [],
        rastreioAgentes: typeof app.readLocationTrail === 'function' ? app.readLocationTrail() : [],
        agentes: app.readAgents(),
        logs: app.readLogs(),
        dirtyProperties: typeof app.readDirtyPropertyIds === 'function' ? app.readDirtyPropertyIds() : [],
        systemState: app.readSystemState(),
        planoOperacao: app.collectKnownLocalJson('ace_active_operation_plan_v1'),
        planoLiraa: app.collectKnownLocalJson('ace_liraa_sampling_plan_v1')
      }
    };
  };

  app.exportLocalBackupJson = function () {
    var payload = app.buildLocalBackupPayload();
    var summary = payload.fila || {};
    var message = 'O backup local contém visitas, imóveis, tubitos, GPS, rastreio de rota, supervisão e dados de fila deste aparelho.' +
      '\n\nPendentes totais: ' + (summary.total || 0) +
      '\n\nUse apenas para contingência ou suporte autorizado. Deseja gerar o arquivo agora?';
    if (!window.confirm(message)) {
      app.showMessage('Backup local cancelado.', 'warn');
      return;
    }
    var content = JSON.stringify(payload, null, 2);
    var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download = 'ace-backup-local-' + stamp + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    app.saveSystemState({ lastBackupAt: new Date().toISOString() });
    app.addLog('backup', 'export_json', '', 'Backup local JSON exportado.');
    app.showMessage('Backup local JSON gerado. Guarde em local seguro.', 'ok');
    app.renderSyncCenter();
    app.renderAdminSystemPanel();
  };

  app.applyGpsTerritoryContext = function () {
    var resolved = app.resolveTerritoryByGps(app.state.visit.gps);
    app.state.territoryHint = resolved;
    app.state.visit.gpsTerritory = resolved ? resolved.territoryName : '';
    app.state.visit.gpsQuarteirao = resolved ? resolved.quarteirao : '';

    // Regra territorial: GPS é auditoria, não cadastro.
    // Microárea, bairro e quarteirão oficiais permanecem os informados pelo agente/imóvel,
    // porque bairro e microárea podem se cruzar administrativamente.
    app.renderGpsTerritoryStatus();
    return resolved;
  };

  app.refreshGpsDrivenViews = function () {
    app.renderProperties();
    app.renderVisitFieldGuide();
    app.createVisitSummary();
    app.renderHero();
    app.renderPanelFieldGuide();
  };

  app.restoreLastKnownGps = function () {
    var systemState = app.readSystemState();
    var cachedGps = app.normalizeGps(systemState.lastKnownGps);
    if (!cachedGps) {
      return false;
    }
    app.state.visit.gps = cachedGps;
    app.applyGpsTerritoryContext();
    return true;
  };


  app.toLocationTrailGps = function (gps) {
    if (!gps) { return null; }
    var lat = Number(gps.lat !== undefined ? gps.lat : gps.latitude);
    var lng = Number(gps.lng !== undefined ? gps.lng : gps.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return {
      lat: lat,
      lng: lng,
      accuracy: Math.round(Number(gps.accuracy || gps.acc || 0) || 0),
      speed: gps.speed !== undefined && gps.speed !== null ? gps.speed : '',
      heading: gps.heading !== undefined && gps.heading !== null ? gps.heading : ''
    };
  };

  app.locationTrailDistanceMeters = function (a, b) {
    var pointA = app.toLocationTrailGps(a);
    var pointB = app.toLocationTrailGps(b);
    var earthRadius = 6371000;
    var dLat;
    var dLng;
    var lat1;
    var lat2;
    var h;
    if (!pointA || !pointB) { return Infinity; }
    dLat = (pointB.lat - pointA.lat) * Math.PI / 180;
    dLng = (pointB.lng - pointA.lng) * Math.PI / 180;
    lat1 = pointA.lat * Math.PI / 180;
    lat2 = pointB.lat * Math.PI / 180;
    h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  app.buildLocationTrailPoint = function (gps, eventType, extra) {
    var normalizedGps = app.toLocationTrailGps(gps);
    var agent = app.state.currentAgent || app.readSession() || {};
    var now = new Date();
    var payload = extra || {};
    if (!normalizedGps || !agent || !String(agent.matricula || agent.nome || '').trim()) {
      return null;
    }
    return {
      uid: app.createId('TRK'),
      timestamp: now.toISOString(),
      date: app.todayISO ? app.todayISO() : now.toISOString().slice(0, 10),
      matricula: agent.matricula || '',
      nome: agent.nome || '',
      operationMode: app.getCurrentOperationModeLabel ? app.getCurrentOperationModeLabel() : (app.state.visit && app.state.visit.operationMode || 'VD'),
      lat: normalizedGps.lat,
      lng: normalizedGps.lng,
      accuracy: normalizedGps.accuracy,
      speed: normalizedGps.speed,
      heading: normalizedGps.heading,
      battery: app.state.lastBatteryLevel !== undefined ? app.state.lastBatteryLevel : '',
      eventType: eventType || 'track',
      eventLabel: payload.eventLabel || payload.label || '',
      visitUid: payload.visitUid || payload.visit_uid || '',
      synced: false
    };
  };

  app.shouldStoreLocationTrailPoint = function (point) {
    var rows = typeof app.readLocationTrail === 'function' ? app.readLocationTrail() : [];
    var last = rows.find(function (row) {
      return row && row.matricula === point.matricula && row.date === point.date;
    });
    var eventType = String(point.eventType || 'track');
    var minMs = Number(app.CONFIG.LOCATION_TRAIL_MIN_INTERVAL_MS || 60000);
    var minMeters = Number(app.CONFIG.LOCATION_TRAIL_MIN_DISTANCE_METERS || 18);
    var lastTime;
    if (!last) { return true; }
    if (eventType !== 'track') { return true; }
    lastTime = Date.parse(last.timestamp || '') || 0;
    if (Date.now() - lastTime >= minMs * 2) { return true; }
    return app.locationTrailDistanceMeters(last, point) >= minMeters;
  };

  app.saveLocationTrailFromGps = function (gps, eventType, extra) {
    var point = app.buildLocationTrailPoint(gps, eventType, extra);
    if (!point || typeof app.addLocationTrailPoint !== 'function') {
      return null;
    }
    if (!app.shouldStoreLocationTrailPoint(point)) {
      return null;
    }
    app.addLocationTrailPoint(point);
    app.touchPendingSync('location-trail');
    return point;
  };

  app.recordLocationTrailPoint = function (eventType, gps, extra) {
    var knownGps = gps || (app.readSystemState && app.readSystemState().lastKnownGps) || null;
    if (knownGps && app.saveLocationTrailFromGps(knownGps, eventType, extra)) {
      return Promise.resolve(true);
    }
    if (!navigator.geolocation) {
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      navigator.geolocation.getCurrentPosition(function (position) {
        var point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading
        };
        app.saveSystemState({
          gpsPermissionState: 'granted',
          lastKnownGps: Object.assign({}, app.toLocationTrailGps(point), {
            capturedAt: new Date().toISOString(),
            source: eventType || 'track'
          })
        });
        app.saveLocationTrailFromGps(point, eventType || 'track', extra || {});
        resolve(true);
      }, function (error) {
        if (error && error.code === 1) {
          app.saveSystemState({ gpsPermissionState: 'denied' });
        }
        resolve(false);
      }, {
        enableHighAccuracy: true,
        timeout: Number(app.CONFIG.LOCATION_TRAIL_GPS_TIMEOUT_MS || 12000),
        maximumAge: Number(app.CONFIG.LOCATION_TRAIL_MAXIMUM_AGE_MS || 45000)
      });
    });
  };

  app.refreshBatteryForTrail = function () {
    if (!navigator.getBattery) {
      return;
    }
    navigator.getBattery().then(function (battery) {
      app.state.lastBatteryLevel = Math.round(Number(battery.level || 0) * 100);
    }).catch(function () {});
  };

  app.startAgentLocationTrail = function () {
    if (app.state.locationTrailActive || !navigator.geolocation || !app.state.currentAgent) {
      return false;
    }
    app.state.locationTrailActive = true;
    app.refreshBatteryForTrail();
    app.recordLocationTrailPoint('login', null, { eventLabel: 'Entrada no app' });
    app.state.locationTrailTimer = window.setInterval(function () {
      if (!app.state.currentAgent) {
        app.stopAgentLocationTrail();
        return;
      }
      app.refreshBatteryForTrail();
      app.recordLocationTrailPoint('track', null, {});
    }, Number(app.CONFIG.LOCATION_TRAIL_INTERVAL_MS || 120000));
    try {
      app.state.locationTrailWatchId = navigator.geolocation.watchPosition(function (position) {
        app.saveLocationTrailFromGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading
        }, 'track', {});
      }, function () {}, {
        enableHighAccuracy: true,
        maximumAge: Number(app.CONFIG.LOCATION_TRAIL_MAXIMUM_AGE_MS || 45000),
        timeout: Number(app.CONFIG.LOCATION_TRAIL_GPS_TIMEOUT_MS || 12000)
      });
    } catch (error) {
      app.state.locationTrailWatchId = null;
    }
    return true;
  };

  app.stopAgentLocationTrail = function (eventType) {
    if (app.state.locationTrailTimer) {
      window.clearInterval(app.state.locationTrailTimer);
      app.state.locationTrailTimer = null;
    }
    if (app.state.locationTrailWatchId !== null && app.state.locationTrailWatchId !== undefined && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(app.state.locationTrailWatchId); } catch (error) {}
    }
    app.state.locationTrailWatchId = null;
    app.state.locationTrailActive = false;
    if (eventType) {
      app.recordLocationTrailPoint(eventType, null, { eventLabel: eventType === 'logout' ? 'Saída do app' : '' });
    }
  };

  app.maybeCaptureGpsOnEnter = function () {
    if (!navigator.geolocation || !navigator.permissions || !navigator.permissions.query) {
      return;
    }
    navigator.permissions.query({ name: 'geolocation' }).then(function (status) {
      app.saveSystemState({ gpsPermissionState: status.state || '' });
      if (status.state === 'granted') {
        app.captureGps(false, true);
      }
    }).catch(function () {
      return null;
    });
  };

  app.getPrioritizedProperties = function () {
    var currentGps = app.state.visit.gps;
    var today = app.todayISO();
    var operationRestriction = (window.ACEOperationMode && typeof window.ACEOperationMode.getTerritoryRestriction === 'function')
      ? window.ACEOperationMode.getTerritoryRestriction()
      : null;
    function normalizeTerritoryCompare(value) {
      var raw = String(value || '').trim().replace(/^[A-Z0-9]{1,8}\s*-\s*/i, '');
      var key = app.normalizeLabel(raw);
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
    function normalizeQuarterCompare(value) {
      return app.normalizeLabel(String(value || '').trim().replace(/^q\s*[-/]?\s*/i, '').replace(/^0+(\d)/, '$1'));
    }
    function propertyMatchesOperationTerritory(property) {
      if (!operationRestriction) {
        return true;
      }
      if (operationRestriction.blocked) {
        return false;
      }
      var units = Array.isArray(operationRestriction.units) ? operationRestriction.units : [];
      var propMicro = normalizeTerritoryCompare(property.microarea || property.bairro || '');
      var propQuarter = normalizeQuarterCompare(property.quarteirao || '');
      if (units.length) {
        var propUnitKey = propMicro + '|' + propQuarter;
        return units.some(function (unit) {
          return normalizeTerritoryCompare(unit.microarea || unit.territory || '') + '|' + normalizeQuarterCompare(unit.quarteirao || unit.quarter || '') === propUnitKey;
        });
      }
      return false;
    }
    var historiesByAddress = {};
    app.readVisits().slice().sort(app.compareVisitDesc).forEach(function (visit) {
      var key = app.addressKey(visit);
      if (!historiesByAddress[key]) {
        historiesByAddress[key] = [];
      }
      historiesByAddress[key].push(visit);
    });
    return app.readProperties().filter(propertyMatchesOperationTerritory).map(function (property) {
      var history = historiesByAddress[app.addressKey(property)] || [];
      var last = history[0] || null;
      var pending = !!(last && (last.situacao === 'Fechado' || last.situacao === 'Recusa'));
      var distance = currentGps ? app.calcDistanceMeters(currentGps.lat, currentGps.lng, property.lastLat, property.lastLng) : null;
      return {
        property: property,
        last: last,
        pending: pending,
        visitedToday: !!(last && last.data === today),
        distance: distance
      };
    }).sort(function (a, b) {
      if (a.pending !== b.pending) {
        return a.pending ? -1 : 1;
      }
      if (a.visitedToday !== b.visitedToday) {
        return a.visitedToday ? 1 : -1;
      }
      var aDistance = a.distance === null ? Number.MAX_SAFE_INTEGER : a.distance;
      var bDistance = b.distance === null ? Number.MAX_SAFE_INTEGER : b.distance;
      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      return app.compareAreaCode(a.property.microarea, b.property.microarea) ||
        app.compareAreaCode(a.property.quarteirao, b.property.quarteirao);
    });
  };

  app.selectNextProperty = function (pendingOnly) {
    var rows = app.getPrioritizedProperties().filter(function (row) {
      if (pendingOnly) {
        return row.pending;
      }
      return row.property.uid !== app.state.selectedPropertyId;
    });
    if (!rows.length) {
      app.showMessage(pendingOnly ? 'Nenhuma pendência encontrada na fila local.' : 'Nenhum próximo imóvel sugerido agora.', 'warn');
      return;
    }
    app.selectProperty(rows[0].property.uid);
    app.showMessage(pendingOnly ? 'Pendência mais próxima carregada para nova abordagem.' : 'Próximo imóvel sugerido carregado.', 'ok');
  };

  app.openRouteToSelectedProperty = function () {
    var property = app.getSelectedProperty();
    if (!property) {
      app.showMessage('Selecione um imóvel para abrir a rota.', 'danger');
      return;
    }
    window.open(app.buildRouteUrl(property), '_blank');
  };

  app.applySelectedPropertyToVisitContext = function () {
    var property = app.getSelectedProperty();
    if (!property) {
      return false;
    }
    app.state.visit.microarea = app.normalizeAreaCode(property.microarea || '');
    app.state.visit.quarteirao = app.normalizeAreaCode(property.quarteirao || '');
    app.state.visit.routeUrl = app.buildRouteUrl(property);
    if (!app.state.visit.gpsTerritory && property.gpsTerritory) {
      app.state.visit.gpsTerritory = property.gpsTerritory;
    }
    if (!app.state.visit.gpsQuarteirao && property.gpsQuarteirao) {
      app.state.visit.gpsQuarteirao = property.gpsQuarteirao;
    }
    return true;
  };

  app.syncDerivedVisitFields = function () {
    var focusTotal = app.totalFromMap(app.state.visit.depositFocusCounts);
    if (app.totalFromMap(app.state.visit.depositCounts) > 0) {
      app.state.visit.depositFound = 'Sim';
    }
    app.state.visit.focusQty = focusTotal;
    if (focusTotal > 0) {
      app.state.visit.focusFound = 'Sim';
    } else if (app.state.visit.depositFound) {
      app.state.visit.focusFound = 'Não';
      app.state.visit.tubitosQty = 0;
      app.state.visit.tubitosDeposit = '';
      app.state.visit.tubitosByDeposit = app.emptyDepositMap();
    }
    if (app.state.visit.tubitosByDeposit) {
      Object.keys(app.state.visit.tubitosByDeposit).forEach(function (code) {
        if (Number((app.state.visit.depositFocusCounts || {})[code] || 0) <= 0) {
          app.state.visit.tubitosByDeposit[code] = 0;
        }
      });
      app.state.visit.tubitosQty = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
      app.state.visit.tubitosDeposit = app.firstTubitoDepositCode(app.state.visit.tubitosByDeposit);
    }
  };

  app.syncVisitWithInputs = function () {
    app.state.visit.data = document.getElementById('visitDate').value || app.todayISO();
    var visitTimeValue = document.getElementById('visitTime').value || app.state.visit.hora || '';
    app.state.visit.hora = visitTimeValue ? app.sanitizeHour(visitTimeValue) : '';
    app.applySelectedPropertyToVisitContext();
    if (typeof app.syncDerivedVisitFields === 'function') {
      app.syncDerivedVisitFields();
    }
    if (!app.state.visit.tubitosByDeposit) {
      app.state.visit.tubitosByDeposit = app.emptyDepositMap();
    }
    var mappedTubitosTotal = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
    app.state.visit.tubitosQty = mappedTubitosTotal || Math.max(0, Number(document.getElementById('visitTubitosQty').value || 0));
    app.state.visit.tubitosDeposit = app.firstTubitoDepositCode(app.state.visit.tubitosByDeposit) || app.state.visit.tubitosDeposit || '';
    app.state.visit.larvicida = document.getElementById('visitLarvicida').value || 'Nenhum';
    app.state.visit.larvicidaQty = Math.max(0, Number(document.getElementById('visitLarvicidaQty').value || 0));
    app.state.visit.adulticida = document.getElementById('visitAdulticida').value || 'Nenhum';
    app.state.visit.adulticidaQty = Math.max(0, Number(document.getElementById('visitAdulticidaQty').value || 0));
    app.state.visit.attendedBy = app.normalizeTitleText((document.getElementById('visitAttendedBy') || {}).value || '');
    app.state.visit.obs = String(document.getElementById('visitObs').value || '').trim();
    app.state.visit.closedReason = app.state.visit.situacao === 'Fechado'
      ? app.normalizeClosedReason((document.getElementById('visitClosedReason') || {}).value || '')
      : '';
    app.state.visit.waterAccessReason = app.state.visit.waterAccess === 'Não'
      ? app.normalizeWaterAccessReason((document.getElementById('visitWaterAccessReason') || {}).value || '')
      : '';
    app.state.visit.ladderSupportRequested = app.shouldAskLadderSupport(app.state.visit)
      ? app.normalizeLadderSupportRequested(app.state.visit.ladderSupportRequested || '')
      : '';
    app.state.visit.ladderSupportNoReason = app.shouldAskLadderSupport(app.state.visit) && app.state.visit.ladderSupportRequested === 'Não'
      ? app.normalizeLadderSupportNoReason((document.getElementById('visitLadderSupportNoReason') || {}).value || '')
      : '';
    app.state.visit.waterTankCondition = app.state.visit.waterAccess === 'Sim'
      ? app.normalizeWaterTankCondition((document.getElementById('visitWaterTankCondition') || {}).value || '')
      : '';
    app.state.visit.waterTreatment = app.state.visit.waterAccess === 'Sim'
      ? app.normalizeChoice(app.state.visit.waterTreatment || '')
      : '';
    app.syncDerivedVisitFields();
    if (typeof app.renderTubitoRange === 'function') {
      app.renderTubitoRange();
    }
  };

  app.resetVisitForm = function () {
    var area = app.readLastArea();
    app.state.visit = app.createEmptyVisit();
    app.state.territoryHint = null;
    app.state.visit.microarea = area.microarea;
    app.state.visit.quarteirao = area.quarteirao;
    app.updateVisitFormFromState();
    app.setVisitCurrentStep(1);
    app.renderVisitWizard();
  };

  app.ensureVisitStartTime = function () {
    if (app.state.editingVisitId) {
      return;
    }
    app.state.visit.data = app.state.visit.data || app.todayISO();
    if (!app.state.visit.hora) {
      app.state.visit.hora = app.nowHHMM();
    }
  };

  app.showScreen = function (screenName) {
    app.state.selectedScreen = screenName;
    Array.from(document.querySelectorAll('.screen')).forEach(function (node) {
      var isActive = node.id === 'screen-' + screenName;
      node.classList.toggle('active', isActive);
      node.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
    Array.from(document.querySelectorAll('.tab-btn')).forEach(function (node) {
      node.classList.toggle('active', node.getAttribute('data-screen') === screenName);
    });
    if (screenName === 'imoveis') {
      app.renderProperties();
    }
    if (screenName === 'painel') {
      app.renderLocalPanel();
      app.renderPanelFieldGuide();
      if (typeof app.renderSyncCenter === 'function') {
        app.renderSyncCenter();
      }
    }
    if (screenName === 'visita') {
      app.renderVisitFieldGuide();
      app.renderVisitWizard();
    }
    window.scrollTo(0, 0);
  };

  app.visitHasFocus = function () {
    return app.totalFromMap(app.state.visit.depositFocusCounts || app.emptyDepositMap()) > 0;
  };

  app.captureFocusGps = function () {
    if (!app.visitHasFocus()) {
      return;
    }
    app.state.visit.focusGpsCaptured = false;
    app.state.visit.focusGpsCapturedAt = '';
    app.showMessage('Foco marcado. Capturando GPS do local...', 'accent');
    app.captureGps(true, true, 'focus');
  };

  app.captureBestGpsPosition = function () {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error('GPS não disponível neste aparelho.'));
        return;
      }
      var best = null;
      var done = false;
      var watchId = null;
      var startedAt = Date.now();
      var targetAccuracy = 6;
      var maxAcceptedAccuracy = 25;
      var maxWaitMs = 42000;
      var minSamples = 4;
      var samples = 0;

      function normalizePosition(position) {
        return {
          lat: Number(position.coords.latitude.toFixed(7)),
          lng: Number(position.coords.longitude.toFixed(7)),
          accuracy: Math.round(position.coords.accuracy || 0)
        };
      }

      function finish(value) {
        if (done) { return; }
        done = true;
        if (watchId !== null) {
          try { navigator.geolocation.clearWatch(watchId); } catch (ignore) {}
        }
        resolve(value);
      }

      function fail(error) {
        if (done) { return; }
        done = true;
        if (watchId !== null) {
          try { navigator.geolocation.clearWatch(watchId); } catch (ignore) {}
        }
        reject(error || new Error('Não foi possível capturar a localização.'));
      }

      function accept(position) {
        var gps = normalizePosition(position);
        if (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng) || !gps.accuracy) {
          return;
        }
        samples += 1;
        if (!best || !best.accuracy || (gps.accuracy && gps.accuracy < best.accuracy)) {
          best = gps;
        }
        if (samples >= minSamples && best && best.accuracy && best.accuracy <= targetAccuracy) {
          finish(best);
        }
      }

      watchId = navigator.geolocation.watchPosition(accept, function (error) {
        if (best && best.accuracy <= maxAcceptedAccuracy) {
          finish(best);
          return;
        }
        fail(error);
      }, {
        enableHighAccuracy: true,
        timeout: maxWaitMs,
        maximumAge: 0
      });

      setTimeout(function () {
        if (best && best.accuracy <= maxAcceptedAccuracy) {
          finish(best);
        } else if (best && best.accuracy > maxAcceptedAccuracy) {
          fail(new Error('GPS ainda impreciso (' + best.accuracy + ' m). Fique em área aberta, mantenha o aparelho parado e tente novamente.'));
        } else if (Date.now() - startedAt >= maxWaitMs) {
          fail(new Error('Não foi possível capturar a localização dentro do tempo esperado.'));
        }
      }, maxWaitMs + 500);
    });
  };

  app.captureGps = function (withFeedback, isAutoCapture, purpose) {
    if (!navigator.geolocation) {
      app.showMessage('GPS não disponível neste aparelho.', 'danger');
      return;
    }
    if (withFeedback !== false) {
      app.showMessage('Capturando GPS com alta precisão. Mantenha o celular parado por alguns segundos...', 'accent');
    }
    app.captureBestGpsPosition().then(function (gps) {
      app.state.visit.gps = gps;
      if (purpose === 'focus' || app.visitHasFocus()) {
        app.state.visit.focusGpsCaptured = true;
        app.state.visit.focusGpsCapturedAt = new Date().toISOString();
      }
      if (purpose === 'property') {
        app.state.propertyGpsCaptured = true;
      }
      var territory = app.applyGpsTerritoryContext();
      app.saveSystemState({
        gpsPermissionState: 'granted',
        lastKnownGps: Object.assign({}, app.state.visit.gps, {
          capturedAt: new Date().toISOString()
        })
      });
      app.saveLocationTrailFromGps(app.state.visit.gps, purpose === 'focus' ? 'focus' : 'gps_capture', {
        eventLabel: purpose === 'focus' ? 'Foco marcado' : 'GPS capturado'
      });
      app.refreshGpsDrivenViews();
      if (withFeedback !== false) {
        var msg = typeof app.buildGpsAdministrativeMessage === 'function'
          ? app.buildGpsAdministrativeMessage(app.state.visit, territory)
          : 'GPS capturado com sucesso.';
        var accuracy = typeof app.getGpsAccuracyClass === 'function' ? app.getGpsAccuracyClass(app.state.visit.gps) : { warning: false };
        app.showMessage(msg, accuracy.warning ? 'warn' : 'ok');
      }
    }).catch(function (error) {
      if (error && error.code === 1) {
        app.saveSystemState({ gpsPermissionState: 'denied' });
      }
      if (withFeedback !== false || !isAutoCapture) {
        app.showMessage(error && error.message ? error.message : 'Não foi possível capturar a localização.', 'danger');
      }
    });
  };


  app.changeTubitoDeposit = function (code, delta) {
    var depositCode = app.normalizeDepositCode(code || '');
    var current;
    if (!depositCode) { return; }
    if (!app.state.visit.tubitosByDeposit) {
      app.state.visit.tubitosByDeposit = app.emptyDepositMap();
    }
    if (Number((app.state.visit.depositFocusCounts || {})[depositCode] || 0) <= 0) {
      app.showMessage('Marque foco neste depósito antes de identificar tubitos.', 'danger');
      return;
    }
    current = Math.max(0, Number(app.state.visit.tubitosByDeposit[depositCode] || 0));
    app.state.visit.tubitosByDeposit[depositCode] = Math.max(0, current + Number(delta || 0));
    app.state.visit.tubitosQty = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
    app.state.visit.tubitosDeposit = app.firstTubitoDepositCode(app.state.visit.tubitosByDeposit);
    app.updateVisitFormFromState();
    app.renderVisitWizard();
    app.clearVisitStepWarning();
    app.renderHero();
  };

  app.changeStepper = function (targetId, delta) {
    var input = document.getElementById(targetId);
    if (!input) {
      return;
    }
    if ((input.getAttribute('type') || '').toLowerCase() !== 'number') {
      return;
    }
    var current = Math.max(0, Number(input.value || 0));
    input.value = Math.max(0, current + Number(delta || 0));
    app.syncVisitWithInputs();
    if (targetId === 'visitTubitosQty') {
      if (Number(input.value || 0) <= 0) {
        app.state.visit.tubitosDeposit = '';
      }
      app.updateVisitFormFromState();
    } else {
      app.createVisitSummary();
    }
    app.renderHero();
  };

  app.changeDeposit = function (code, mode, delta) {
    var total = Math.max(0, Number(app.state.visit.depositCounts[code] || 0));
    var focusTotal = Math.max(0, Number(app.state.visit.depositFocusCounts[code] || 0));
    var treatmentTotal = Math.max(0, Number((app.state.visit.depositTreatmentCounts && app.state.visit.depositTreatmentCounts[code]) || 0));
    var previousFocusSum = app.totalFromMap(app.state.visit.depositFocusCounts || app.emptyDepositMap());
    if (!app.state.visit.depositTreatmentCounts) {
      app.state.visit.depositTreatmentCounts = app.emptyDepositMap();
    }

    if (mode === 'count') {
      total = Math.max(0, total + Number(delta || 0));
      if (focusTotal > total) {
        focusTotal = total;
      }
    } else if (mode === 'focus') {
      focusTotal = Math.max(0, focusTotal + Number(delta || 0));
      if (focusTotal > total) {
        total = focusTotal;
      }
    } else if (mode === 'treatment') {
      treatmentTotal = Math.max(0, treatmentTotal + Number(delta || 0));
      if (treatmentTotal > 0 && total <= 0) {
        total = 1;
      }
    }

    app.state.visit.depositCounts[code] = total;
    app.state.visit.depositFocusCounts[code] = focusTotal;
    app.state.visit.depositTreatmentCounts[code] = treatmentTotal;
    if (total <= 0) {
      app.state.visit.depositTreatmentCounts[code] = 0;
      if (app.state.visit.tubitosByDeposit) {
        app.state.visit.tubitosByDeposit[code] = 0;
        app.state.visit.tubitosQty = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
        app.state.visit.tubitosDeposit = app.firstTubitoDepositCode(app.state.visit.tubitosByDeposit);
      }
    }
    if (focusTotal <= 0 && app.state.visit.tubitosByDeposit) {
      app.state.visit.tubitosByDeposit[code] = 0;
      app.state.visit.tubitosQty = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
      app.state.visit.tubitosDeposit = app.firstTubitoDepositCode(app.state.visit.tubitosByDeposit);
    }
    if (app.totalFromMap(app.state.visit.depositCounts) > 0) {
      app.state.visit.depositFound = 'Sim';
    }
    if (app.totalFromMap(app.state.visit.depositFocusCounts) > 0) {
      app.state.visit.focusFound = 'Sim';
    }
    var currentFocusSum = app.totalFromMap(app.state.visit.depositFocusCounts || app.emptyDepositMap());
    if (currentFocusSum <= 0) {
      app.state.visit.focusGpsCaptured = false;
      app.state.visit.focusGpsCapturedAt = '';
    } else if (mode === 'focus' && previousFocusSum <= 0 && currentFocusSum > 0) {
      app.captureFocusGps();
    }
    var treatmentSum = app.totalFromMap(app.state.visit.depositTreatmentCounts || app.emptyDepositMap());
    app.state.visit.larvicida = treatmentSum > 0 ? 'BPI' : 'Nenhum';
    app.state.visit.larvicidaQty = treatmentSum;
    app.syncDerivedVisitFields();
    app.updateVisitFormFromState();
    app.renderVisitWizard();
    app.clearVisitStepWarning();
    app.renderHero();
  };

  app.toggleDepositFocus = function (code, checked) {
    var previousFocusSum = app.totalFromMap(app.state.visit.depositFocusCounts || app.emptyDepositMap());
    if (checked) {
      app.state.visit.depositCounts[code] = Math.max(1, Number(app.state.visit.depositCounts[code] || 0));
      app.state.visit.depositFocusCounts[code] = Math.max(1, Number(app.state.visit.depositFocusCounts[code] || 0));
      app.state.visit.focusFound = 'Sim';
    } else {
      app.state.visit.depositFocusCounts[code] = 0;
      if (app.state.visit.tubitosByDeposit) {
        app.state.visit.tubitosByDeposit[code] = 0;
        app.state.visit.tubitosQty = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
        app.state.visit.tubitosDeposit = app.firstTubitoDepositCode(app.state.visit.tubitosByDeposit);
      }
      if (app.totalFromMap(app.state.visit.depositFocusCounts) === 0 && app.state.visit.focusQty === 0) {
        app.state.visit.focusFound = 'Não';
      }
    }
    var currentFocusSum = app.totalFromMap(app.state.visit.depositFocusCounts || app.emptyDepositMap());
    if (currentFocusSum <= 0) {
      app.state.visit.focusGpsCaptured = false;
      app.state.visit.focusGpsCapturedAt = '';
    } else if (previousFocusSum <= 0 && currentFocusSum > 0) {
      app.captureFocusGps();
    }
    app.syncDerivedVisitFields();
    app.updateVisitFormFromState();
    app.renderVisitWizard();
    app.clearVisitStepWarning();
    app.renderHero();
  };

  app.toggleDepositTreatment = function (code, checked) {
    if (!app.state.visit.depositTreatmentCounts) {
      app.state.visit.depositTreatmentCounts = app.emptyDepositMap();
    }
    if (checked) {
      app.state.visit.depositFound = 'Sim';
      app.state.visit.depositCounts[code] = Math.max(1, Number(app.state.visit.depositCounts[code] || 0));
      app.state.visit.depositTreatmentCounts[code] = Math.max(1, Number(app.state.visit.depositTreatmentCounts[code] || 0));
      app.state.visit.larvicida = 'BPI';
      app.state.visit.larvicidaQty = app.totalFromMap(app.state.visit.depositTreatmentCounts);
    } else {
      app.state.visit.depositTreatmentCounts[code] = 0;
      if (app.totalFromMap(app.state.visit.depositTreatmentCounts) === 0) {
        app.state.visit.larvicida = 'Nenhum';
        app.state.visit.larvicidaQty = 0;
        app.state.visit.adulticida = 'Nenhum';
        app.state.visit.adulticidaQty = 0;
      } else {
        app.state.visit.larvicida = 'BPI';
        app.state.visit.larvicidaQty = app.totalFromMap(app.state.visit.depositTreatmentCounts);
      }
    }
    app.syncDerivedVisitFields();
    app.updateVisitFormFromState();
    app.renderVisitWizard();
    app.clearVisitStepWarning();
    app.renderHero();
  };

  app.applyPreset = function (name) {
    if (name === 'padrao') {
      app.ensureVisitStartTime();
      app.state.visit.situacao = 'Visitado';
      app.state.visit.closedReason = '';
      app.state.visit.focusFound = 'Não';
      app.state.visit.focusQty = 0;
      app.state.visit.tubitosQty = 0;
      app.state.visit.tubitosDeposit = '';
      app.state.visit.tubitosByDeposit = app.emptyDepositMap();
      app.state.visit.depositFocusCounts = app.emptyDepositMap();
    } else if (name === 'fechado') {
      app.ensureVisitStartTime();
      app.state.visit.situacao = 'Fechado';
      app.state.visit.closedReason = '';
      app.state.visit.focusFound = 'Não';
      app.state.visit.focusQty = 0;
      app.state.visit.tubitosQty = 0;
      app.state.visit.tubitosDeposit = '';
      app.state.visit.tubitosByDeposit = app.emptyDepositMap();
      app.state.visit.depositFocusCounts = app.emptyDepositMap();
    } else if (name === 'recuperado') {
      app.ensureVisitStartTime();
      app.state.visit.situacao = 'Recuperado';
      app.state.visit.closedReason = '';
      if (!app.state.visit.obs) {
        app.state.visit.obs = 'Registro marcado como recuperado.';
      }
    } else if (name === 'foco') {
      app.ensureVisitStartTime();
      var firstCode = Object.keys(app.DEPOSITS)[0];
      app.state.visit.situacao = 'Visitado';
      app.state.visit.closedReason = '';
      app.state.visit.focusFound = 'Sim';
      app.state.visit.focusQty = Math.max(1, app.state.visit.focusQty);
      app.state.visit.depositCounts[firstCode] = Math.max(1, Number(app.state.visit.depositCounts[firstCode] || 0));
      app.state.visit.depositFocusCounts[firstCode] = Math.max(1, Number(app.state.visit.depositFocusCounts[firstCode] || 0));
      app.state.visit.tubitosByDeposit = app.emptyDepositMap();
      app.state.visit.tubitosByDeposit[firstCode] = Math.max(1, app.state.visit.tubitosQty || 1);
      app.state.visit.tubitosQty = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
      app.state.visit.tubitosDeposit = firstCode;
    }
    app.updateVisitFormFromState();
    app.renderHero();
  };


  app.clearPropertyForm = function () {
    app.state.editingPropertyId = '';
    app.state.propertyGpsCaptured = false;
    document.getElementById('propMorador').value = '';
    document.getElementById('propTelefone').value = '';
    document.getElementById('propBairro').value = app.CONFIG.BAIRROS[0] || '';
    document.getElementById('propLogradouro').value = '';
    document.getElementById('propNumero').value = '';
    if (document.getElementById('propMicroarea')) {
      document.getElementById('propMicroarea').value = '';
    }
    if (document.getElementById('propQuarteirao')) {
      document.getElementById('propQuarteirao').value = '';
    }
    document.getElementById('propComplemento').value = app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal';
    document.getElementById('propTipo').value = app.CONFIG.PROPERTY_TYPES[0] || 'Residencial';
    document.getElementById('propReferencia').value = '';
    document.getElementById('propObs').value = '';
    if (typeof app.syncAreaSelects === 'function' && document.getElementById('propMicroarea') && document.getElementById('propQuarteirao')) {
      app.syncAreaSelects(document.getElementById('propMicroarea'), document.getElementById('propQuarteirao'), '');
    }
  };

  app.handlePropertyBairroChange = function () {
    var input = document.getElementById('propLogradouro');
    var currentValue = input ? String(input.value || '').trim() : '';
    app.fillPropertyFormOptions();
    if (input) {
      input.value = currentValue;
    }
    app.renderPropertyStreetSuggestion();
  };

  app.renderPropertyStreetSuggestion = function () {
    var input = document.getElementById('propLogradouro');
    var node = document.getElementById('propStreetSuggestion');
    var row;
    var text;
    if (!input || !node) {
      return;
    }
    row = app.getCarmoStreetSuggestion(input.value);
    if (!String(input.value || '').trim()) {
      node.innerHTML = 'Digite o logradouro ou escolha uma rua da base inicial de Carmo.';
      node.className = 'field-help street-suggestion';
      return;
    }
    if (!row) {
      node.innerHTML = 'Rua ainda não encontrada na base inicial. O cadastro continua livre.';
      node.className = 'field-help street-suggestion is-warn';
      return;
    }
    text = app.getCarmoStreetSuggestionText(row);
    node.className = 'field-help street-suggestion is-ok';
    node.innerHTML = app.escapeHtml(text) +
      (row.microareas_sugeridas || row.quarteiroes_sugeridos
        ? ' <button class="link-button" type="button" data-apply-street-suggestion>Aplicar território sugerido</button>'
        : '');
  };

  app.applyPropertyStreetSuggestion = function () {
    var input = document.getElementById('propLogradouro');
    var row = input ? app.getCarmoStreetSuggestion(input.value) : null;
    var microareaSelect = document.getElementById('propMicroarea');
    var quarteiraoSelect = document.getElementById('propQuarteirao');
    var rawMicroarea;
    var microarea;
    var rawQuarter;
    var quarterMatch;
    if (!row || !microareaSelect) {
      return;
    }
    rawMicroarea = String(row.microareas_sugeridas || '').split('|').map(function (item) {
      return String(item || '').trim();
    }).filter(Boolean)[0] || '';
    if (!rawMicroarea) {
      app.showMessage('Essa rua não tem microárea sugerida na base inicial.', 'warn');
      return;
    }
    microarea = app.getTerritoryLabel(rawMicroarea);
    microareaSelect.value = microarea;
    app.handlePropertyMicroareaChange();
    rawQuarter = String(row.quarteiroes_sugeridos || '').split('|').map(function (item) {
      return String(item || '').trim();
    }).filter(function (item) {
      return item.indexOf(rawMicroarea + ' Q ') === 0 || item.indexOf(microarea + ' Q ') === 0 || item.indexOf(' Q ') > -1;
    })[0] || '';
    quarterMatch = rawQuarter.match(/\sQ\s(.+)$/);
    if (quarterMatch && quarteiraoSelect && !app.isMicroareaWithoutQuarteirao(microarea)) {
      quarteiraoSelect.value = app.normalizeAreaCode(quarterMatch[1]);
    }
    app.renderPropertyStreetSuggestion();
    app.showMessage('Território sugerido aplicado. Confira antes de salvar.', 'ok');
  };

  app.handlePropertyMicroareaChange = function () {
    var microareaNode = document.getElementById('propMicroarea');
    var quarteiraoNode = document.getElementById('propQuarteirao');
    var microarea = microareaNode ? app.normalizeAreaCode(microareaNode.value || '') : '';
    var selectedQuarteirao = quarteiraoNode ? app.normalizeAreaCode(quarteiraoNode.value || '') : '';

    app.fillPropertyFormOptions();
    if (microareaNode) {
      microareaNode.value = microarea;
    }
    if (typeof app.syncAreaSelects === 'function' && microareaNode && quarteiraoNode) {
      app.syncAreaSelects(microareaNode, quarteiraoNode, selectedQuarteirao);
    }
  };

  app.savePropertyFromForm = function (options) {
    var opts = options && options.startVisitAfterSave === true ? options : {};
    var bairro = app.normalizeTitleText(document.getElementById('propBairro').value || '');
    var logradouro = app.normalizeTitleText(document.getElementById('propLogradouro').value || '');
    var numero = app.normalizeFreeText(document.getElementById('propNumero').value || '');
    var microarea = app.normalizeAreaCode((document.getElementById('propMicroarea') && document.getElementById('propMicroarea').value) || '');
    var quarteirao = app.normalizeAreaCode((document.getElementById('propQuarteirao') && document.getElementById('propQuarteirao').value) || '');
    var properties = app.readProperties();
    var addressKey = app.addressKey({ bairro: bairro, logradouro: logradouro, numero: numero });
    var existingProperty = app.state.editingPropertyId
      ? properties.find(function (property) { return property.uid === app.state.editingPropertyId; })
      : null;
    var existingByAddress = properties.find(function (property) {
      return property.address_key === addressKey || app.addressKey(property) === addressKey;
    });
    var gpsSourceProperty = existingProperty || existingByAddress || null;
    var capturedPropertyGps = app.state.propertyGpsCaptured && app.state.visit.gps ? app.state.visit.gps : null;
    var hasExistingGps = !!(gpsSourceProperty && gpsSourceProperty.lastLat != null && gpsSourceProperty.lastLng != null);
    var territory = capturedPropertyGps ? app.resolveTerritoryByGps(capturedPropertyGps) : null;
    var currentAgent = app.state.currentAgent || {};
    var isExistingRegistration = !!gpsSourceProperty;
    var createdAt = isExistingRegistration ? (gpsSourceProperty.createdAt || '') : new Date().toISOString();
    var createdByName = isExistingRegistration ? (gpsSourceProperty.createdByName || '') : (currentAgent.nome || '');
    var createdByMatricula = isExistingRegistration ? (gpsSourceProperty.createdByMatricula || '') : (currentAgent.matricula || '');
    if (!bairro || !logradouro || !numero) {
      app.showMessage('Preencha bairro, logradouro e número do imóvel.', 'danger');
      return null;
    }
    if (!microarea) {
      app.showMessage('Defina a microárea para manter a base territorial consistente.', 'danger');
      return null;
    }
    if (!quarteirao && !app.isMicroareaWithoutQuarteirao(microarea)) {
      app.showMessage('Defina o quarteirão para manter a base territorial consistente.', 'danger');
      return null;
    }
    if (!capturedPropertyGps && !hasExistingGps) {
      app.showMessage('Capture o GPS do local antes de salvar o imóvel.', 'danger');
      return null;
    }

    var record = {
      uid: app.state.editingPropertyId || app.createId('PROP'),
      morador: app.normalizeTitleText(document.getElementById('propMorador').value || ''),
      telefone: app.normalizeFreeText(document.getElementById('propTelefone').value || ''),
      microarea: microarea,
      quarteirao: quarteirao,
      bairro: bairro,
      logradouro: logradouro,
      numero: numero,
      complemento: String(document.getElementById('propComplemento').value || app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal').trim(),
      tipo: String(document.getElementById('propTipo').value || 'Residencial').trim(),
      referencia: app.normalizeTitleText(document.getElementById('propReferencia').value || ''),
      obs: app.normalizeFreeText(document.getElementById('propObs').value || ''),
      address_key: addressKey,
      lastLat: capturedPropertyGps ? capturedPropertyGps.lat : (gpsSourceProperty ? gpsSourceProperty.lastLat : null),
      lastLng: capturedPropertyGps ? capturedPropertyGps.lng : (gpsSourceProperty ? gpsSourceProperty.lastLng : null),
      gpsTerritory: territory ? territory.territoryName : (gpsSourceProperty ? gpsSourceProperty.gpsTerritory : ''),
      gpsQuarteirao: territory ? territory.quarteirao : (gpsSourceProperty ? gpsSourceProperty.gpsQuarteirao : ''),
      createdByName: createdByName,
      createdByMatricula: createdByMatricula,
      createdAt: createdAt,
      lastVisitAt: '',
      updatedAt: new Date().toISOString()
    };

    var quality = app.computePropertyQuality(record, properties);
    if (typeof app.evaluateGpsAdministrativeContext === 'function' && capturedPropertyGps) {
      app.evaluateGpsAdministrativeContext({
        gps: capturedPropertyGps,
        bairro: bairro,
        microarea: microarea,
        quarteirao: quarteirao
      }, territory).warnings.forEach(function (warning) {
        if (quality.flags.indexOf(warning) === -1) {
          quality.flags.push(warning);
        }
      });
      quality.status = quality.flags.length ? (quality.duplicates.length ? 'Atenção alta' : 'Atenção') : 'OK';
    }
    record.qualityFlags = quality.flags;
    record.qualityStatus = quality.status;

    var duplicate = quality.duplicates[0] || properties.find(function (property) {
      return property.address_key === record.address_key && property.uid !== record.uid;
    });
    if (duplicate) {
      record.uid = duplicate.uid;
      record.createdByName = duplicate.createdByName || '';
      record.createdByMatricula = duplicate.createdByMatricula || '';
      record.createdAt = duplicate.createdAt || '';
    }

    var index = properties.findIndex(function (property) {
      return property.uid === record.uid || property.address_key === record.address_key;
    });
    if (index > -1) {
      properties[index] = Object.assign({}, properties[index], record);
    } else {
      properties.push(record);
    }
    app.saveProperties(properties);
    app.markPropertyDirty(record.uid);
    app.state.selectedPropertyId = record.uid;
    app.state.propertyQuickFilter = 'all';
    var searchNode = document.getElementById('propertySearch');
    if (searchNode) {
      searchNode.value = '';
    }
    if (!app.state.visit.microarea && record.microarea) {
      app.state.visit.microarea = record.microarea;
    }
    if (!app.state.visit.quarteirao && record.quarteirao) {
      app.state.visit.quarteirao = record.quarteirao;
    }
    app.clearPropertyForm();
    app.renderAll();
    app.selectProperty(record.uid);
    app.addLog('property', index > -1 ? 'update' : 'create', record.uid, record.logradouro + ', ' + record.numero + (quality.flags.length ? ' • ' + quality.flags.join(', ') : ''));
    app.touchPendingSync('property');
    app.tryAutoSync('property');
    if (opts.startVisitAfterSave) {
      app.startSelectedPropertyVisit();
      app.showMessage(index > -1 ? 'Imóvel atualizado. Visita iniciada na etapa Situação.' : 'Imóvel cadastrado. Visita iniciada na etapa Situação.', duplicate ? 'warn' : 'ok');
    } else {
      app.showMessage(index > -1 ? 'Imóvel atualizado e selecionado para visita.' : 'Imóvel cadastrado no aparelho e selecionado para visita.', duplicate ? 'warn' : 'ok');
    }
    return record;
  };

  app.savePropertyAndStartVisit = function () {
    return app.savePropertyFromForm({ startVisitAfterSave: true });
  };

  app.loadPropertyIntoForm = function (propertyId) {
    var property = app.readProperties().find(function (item) { return item.uid === propertyId; });
    if (!property) {
      return;
    }
    app.state.editingPropertyId = property.uid;
    app.state.propertyGpsCaptured = false;
    document.getElementById('propMorador').value = property.morador;
    document.getElementById('propTelefone').value = property.telefone;
    document.getElementById('propBairro').value = property.bairro;
    document.getElementById('propLogradouro').value = property.logradouro;
    document.getElementById('propNumero').value = property.numero;
    if (document.getElementById('propMicroarea')) {
      document.getElementById('propMicroarea').value = property.microarea || '';
    }
    if (document.getElementById('propQuarteirao')) {
      document.getElementById('propQuarteirao').value = property.quarteirao || '';
    }
    if (typeof app.syncAreaSelects === 'function' && document.getElementById('propMicroarea') && document.getElementById('propQuarteirao')) {
      app.syncAreaSelects(document.getElementById('propMicroarea'), document.getElementById('propQuarteirao'), property.quarteirao || '');
    }
    document.getElementById('propComplemento').value = property.complemento || app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal';
    document.getElementById('propTipo').value = property.tipo;
    document.getElementById('propReferencia').value = property.referencia;
    document.getElementById('propObs').value = property.obs;
    app.showScreen('imoveis');
    setTimeout(function () {
      var form = document.querySelector('.property-form-card');
      if (form && form.scrollIntoView) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    app.showMessage('Imóvel carregado para atualização cadastral.', 'accent');
  };

  app.selectProperty = function (propertyId) {
    app.state.selectedPropertyId = propertyId;
    var property = app.getSelectedProperty();
    if (property) {
      app.applySelectedPropertyToVisitContext();
      app.saveLastArea(app.state.visit.microarea, app.state.visit.quarteirao);
      app.updateVisitFormFromState();
    }
    app.renderSelectedPropertyCard();
    app.renderSelectedHistory();
    app.createVisitSummary();
    app.setVisitCurrentStep(1);
    app.showScreen('visita');
    setTimeout(function () {
      var card = document.getElementById('selectedPropertyCard');
      if (card && card.scrollIntoView) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
    app.showMessage('Imóvel selecionado. Confira o cartão e toque em Iniciar visita.', 'accent');
  };

  app.startSelectedPropertyVisit = function () {
    var property = app.getSelectedProperty();
    if (!property) {
      app.setVisitCurrentStep(1);
      app.showScreen('visita');
      app.showMessage('Selecione um imóvel antes de iniciar a visita.', 'warn');
      return;
    }
    app.applySelectedPropertyToVisitContext();
    app.saveLastArea(app.state.visit.microarea, app.state.visit.quarteirao);
    app.updateVisitFormFromState();
    app.renderSelectedPropertyCard();
    app.renderSelectedHistory();
    app.createVisitSummary();
    app.goToVisitStep(2, { force: true });
    app.showScreen('visita');
    setTimeout(function () {
      var panel = document.querySelector('[data-visit-step="2"]');
      if (panel && panel.scrollIntoView) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  app.loadVisitForEdit = function (visitId) {
    var visit = app.readVisits().find(function (item) { return item.uid === visitId; });
    if (!visit) {
      return;
    }
    app.state.editingVisitId = visit.uid;
    app.state.selectedPropertyId = visit.property_uid || (app.readProperties().find(function (property) {
      return app.addressKey(property) === app.addressKey(visit);
    }) || {}).uid || '';
    app.state.visit = app.createEmptyVisit();
    app.state.visit.data = visit.data;
    app.state.visit.hora = visit.hora;
    app.state.visit.microarea = visit.microarea;
    app.state.visit.quarteirao = visit.quarteirao;
    app.state.visit.situacao = visit.situacao;
    app.state.visit.closedReason = visit.closedReason;
    app.state.visit.depositFound = visit.depositFound || (visit.depositTotal > 0 ? 'Sim' : 'Não');
    app.state.visit.focusFound = visit.focusFound;
    app.state.visit.focusQty = visit.focusQty;
    app.state.visit.waterAccess = visit.waterAccess;
    app.state.visit.waterAccessReason = visit.waterAccessReason;
    app.state.visit.waterTankCondition = visit.waterTankCondition;
    app.state.visit.waterTreatment = visit.waterTreatment;
    app.state.visit.attendedBy = visit.attendedBy;
    app.state.visit.tubitosByDeposit = app.getTubitosByDeposit(visit);
    var savedTubitosByDeposit = app.tubitosByDepositFromRows(app.getTubitosForVisit(visit));
    if (app.totalTubitosByDeposit(savedTubitosByDeposit) > 0) {
      app.state.visit.tubitosByDeposit = savedTubitosByDeposit;
    }
    app.state.visit.tubitosQty = app.totalTubitosByDeposit(app.state.visit.tubitosByDeposit);
    app.state.visit.tubitosDeposit = app.firstTubitoDepositCode(app.state.visit.tubitosByDeposit) || visit.tubitosDeposit || '';
    app.state.visit.operationMode = visit.operationMode || 'VD';
    app.state.visit.peTipoLocal = visit.peTipoLocal || '';
    app.state.visit.peNomeLocal = visit.peNomeLocal || '';
    app.state.visit.peObservacao = visit.peObservacao || '';
    app.state.visit.liraaCiclo = visit.liraaCiclo || '';
    app.state.visit.liraaPlanoId = visit.liraaPlanoId || '';
    app.state.visit.liraaQuarteiraoSorteado = visit.liraaQuarteiraoSorteado || '';
    app.state.visit.liraaUnitKey = visit.liraaUnitKey || '';
    app.state.visit.liraaColeta = visit.liraaColeta || '';
    app.state.visit.larvicida = visit.larvicida;
    app.state.visit.larvicidaQty = visit.larvicidaQty;
    app.state.visit.adulticida = visit.adulticida;
    app.state.visit.adulticidaQty = visit.adulticidaQty;
    app.state.visit.obs = visit.obs;
    app.state.visit.gps = visit.gps;
    app.state.visit.gpsTerritory = visit.gpsTerritory;
    app.state.visit.gpsQuarteirao = visit.gpsQuarteirao;
    app.state.visit.focusGpsCaptured = !!(visit.gps && app.totalFromMap(app.state.visit.depositFocusCounts) > 0);
    app.state.visit.focusGpsCapturedAt = app.state.visit.focusGpsCaptured ? (visit.updatedAt || visit.createdAt || '') : '';
    app.state.visit.photoDataUrl = '';
    app.state.visit.photoUrl = '';
    app.state.visit.signatureDataUrl = '';
    app.state.visit.signatureSignedAt = '';
    app.state.visit.pdfUrl = '';
    app.state.visit.pdfDriveId = '';
    app.state.visit.routeUrl = visit.routeUrl;
    app.state.visit.qualityFlags = visit.qualityFlags;
    app.state.visit.depositCounts = app.normalizeDepositMap(visit.depositCounts);
    app.state.visit.depositFocusCounts = app.normalizeDepositMap(visit.depositFocusCounts);
    app.state.visit.depositTreatmentCounts = app.normalizeDepositMap(visit.depositTreatmentCounts);
    app.state.territoryHint = visit.gps ? app.resolveTerritoryByGps(visit.gps) : null;
    app.updateVisitFormFromState();
    app.setVisitCurrentStep(2);
    app.renderAll();
    app.showScreen('visita');
    app.showMessage('Visita carregada para edição.', 'accent');
  };

  app.VISIT_STEPS = [
    { id: 1, title: 'Imóvel', hint: 'Selecione o endereço e confira o GPS.' },
    { id: 2, title: 'Situação', hint: 'Informe a situação do atendimento.' },
    { id: 3, title: 'Depósitos', hint: 'Registre depósitos, focos, tubitos e BPI.' },
    { id: 4, title: "Caixa", hint: "Informe acesso, condição e tratamento." },
    { id: 5, title: 'Salvar', hint: 'Revise e salve a visita.' }
  ];

  app.getVisitCurrentStep = function () {
    return Math.max(1, Math.min(app.VISIT_STEPS.length, Number(app.state.visitFlowStep || 1)));
  };

  app.setVisitCurrentStep = function (step) {
    app.state.visitFlowStep = Math.max(1, Math.min(app.VISIT_STEPS.length, Number(step || 1)));
  };

  app.isClosedVisitFlow = function () {
    var visit = app.state.visit || {};
    return app.normalizeStatus ? app.normalizeStatus(visit.situacao) === 'Fechado' : visit.situacao === 'Fechado';
  };

  app.shouldSkipVisitStep = function (step) {
    return (Number(step) === 3 || Number(step) === 4) && app.isClosedVisitFlow();
  };

  app.getNextVisitStep = function (currentStep) {
    var next = Math.max(1, Number(currentStep || 1)) + 1;
    while (next <= app.VISIT_STEPS.length && app.shouldSkipVisitStep(next)) {
      next += 1;
    }
    return next <= app.VISIT_STEPS.length ? next : null;
  };

  app.getPreviousVisitStep = function (currentStep) {
    var previous = Math.min(app.VISIT_STEPS.length, Number(currentStep || 1)) - 1;
    while (previous >= 1 && app.shouldSkipVisitStep(previous)) {
      previous -= 1;
    }
    return previous >= 1 ? previous : null;
  };

  app.validateVisitStep = function (step) {
    app.syncVisitWithInputs();
    var property = app.getSelectedProperty();
    var visit = app.state.visit || {};
    var missing = [];
    if (step >= 1 && !property) {
      missing.push('selecionar o imóvel');
    }
    if (step === 2) {
      if (!visit.data) { missing.push('informar a data'); }
      if (!visit.hora) { missing.push('informar a hora'); }
      if (!visit.situacao) { missing.push('informar se o imóvel está aberto, fechado ou recuperado'); }
      if (visit.situacao === 'Fechado' && !visit.closedReason) { missing.push('informar o motivo do fechado'); }
      if (visit.situacao === 'Recuperado' && property && !app.canMarkVisitRecovered(property)) {
        missing.push('a última visita anterior precisa estar como Fechado');
      }
    }
    if (step === 3) {
      if (visit.situacao !== 'Fechado' && !visit.depositFound) {
        missing.push('informar se encontrou depósito');
      }
      if (visit.situacao !== 'Fechado' && visit.depositFound === 'Sim' && app.totalFromMap(visit.depositCounts) <= 0) {
        missing.push('informar ao menos um depósito encontrado');
      }
      if (visit.situacao !== 'Fechado' && Number(visit.focusQty || 0) > 0 && app.totalFromMap(visit.depositFocusCounts) <= 0) {
        missing.push('marcar ao menos um depósito com foco');
      }
      if (visit.situacao !== 'Fechado' && visit.focusFound === 'Sim' && app.totalFromMap(visit.depositFocusCounts) <= 0) {
        missing.push('marcar qual depósito teve foco');
      }
      if (visit.situacao !== 'Fechado' && app.totalFromMap(visit.depositTreatmentCounts || app.emptyDepositMap()) > 0 &&
          visit.larvicida === 'Nenhum' && visit.adulticida === 'Nenhum') {
        missing.push('informar o tratamento aplicado');
      }
    }
    if (app.shouldSkipVisitStep(step)) {
      return {
        ok: !missing.length,
        missing: missing,
        message: missing.length ? ('Antes de avançar, falta: ' + missing.join('; ') + '.') : ''
      };
    }
    if (step === 4) {
      if (!visit.waterAccess) { missing.push("informar se acessou a caixa d'água"); }
      if (visit.waterAccess === 'Não' && !visit.waterAccessReason) { missing.push("informar o motivo de não acessar a caixa d'água"); }
      if (visit.waterAccess === 'Sim' && !visit.waterTankCondition) { missing.push("informar a situação da caixa d'água"); }
      if (visit.waterAccess === 'Sim' && !visit.waterTreatment) { missing.push("informar se houve tratamento na caixa d'água"); }
    }
    return {
      ok: !missing.length,
      missing: missing,
      message: missing.length ? ('Antes de avançar, falta: ' + missing.join('; ') + '.') : ''
    };
  };

  app.canOpenVisitStep = function (targetStep) {
    for (var step = 1; step < targetStep; step += 1) {
      if (app.shouldSkipVisitStep(step)) {
        continue;
      }
      if (!app.validateVisitStep(step).ok) {
        return false;
      }
    }
    return true;
  };

  app.goToVisitStep = function (targetStep, options) {
    var opts = options || {};
    var step = Math.max(1, Math.min(app.VISIT_STEPS.length, Number(targetStep || 1)));
    var current = app.getVisitCurrentStep();
    if (app.shouldSkipVisitStep(step)) {
      step = step > current ? app.getNextVisitStep(step) : app.getPreviousVisitStep(step);
      if (!step) {
        return false;
      }
    }
    if (!opts.force && step > app.getVisitCurrentStep() && !app.canOpenVisitStep(step)) {
      for (var checkStep = 1; checkStep < step; checkStep += 1) {
        if (app.shouldSkipVisitStep(checkStep)) {
          continue;
        }
        var blocking = app.validateVisitStep(checkStep);
        if (!blocking.ok) {
          app.showMessage(blocking.message, 'warn');
          break;
        }
      }
      return false;
    }
    app.setVisitCurrentStep(step);
    if (typeof app.renderVisitWizard === 'function') {
      app.renderVisitWizard();
    }
    return true;
  };

  app.advanceVisitStep = function () {
    var current = app.getVisitCurrentStep();
    var nextStep = app.getNextVisitStep(current);
    var validation = app.validateVisitStep(current);
    if (!validation.ok) {
      app.showMessage(validation.message, 'warn');
      app.renderVisitWizard();
      return;
    }
    if (nextStep) {
      app.goToVisitStep(nextStep, { force: true });
    }
  };

  app.clearVisitStepWarning = function () {
    var node = document.getElementById('syncStatus');
    if (node && /^Antes de avançar, falta:/.test(node.textContent || '') && app.validateVisitStep(app.getVisitCurrentStep()).ok) {
      if (typeof app.hideMessage === 'function') { app.hideMessage(); }
    }
  };

  app.renderVisitWizard = function () {
    var stepsNode = document.getElementById('visitWizardSteps');
    var hintNode = document.getElementById('visitStepHint');
    var current = app.getVisitCurrentStep();
    if (!stepsNode) {
      return;
    }
    if (app.shouldSkipVisitStep(current)) {
      app.setVisitCurrentStep(app.getNextVisitStep(current) || app.getPreviousVisitStep(current) || 1);
      current = app.getVisitCurrentStep();
    }
    stepsNode.innerHTML = app.VISIT_STEPS.map(function (step) {
      var done = step.id < current && app.validateVisitStep(step.id).ok;
      var skipped = app.shouldSkipVisitStep(step.id);
      var locked = step.id > current && !app.canOpenVisitStep(step.id);
      var stepLabel = 'Etapa ' + step.id + ' · ' + step.title;
      return '' +
        '<button type="button" class="visit-step-chip' +
          (step.id === current ? ' is-active' : '') +
          (done ? ' is-done' : '') +
          (skipped ? ' is-skipped' : '') +
          (locked ? ' is-locked' : '') +
          '" data-visit-step-nav="' + step.id + '" aria-label="' + app.escapeHtml(stepLabel) + '">' +
          '<span class="visit-step-chip__number">' + (done ? '✓' : step.id) + '</span>' +
          '<span class="visit-step-chip__mobile-label">' + app.escapeHtml(stepLabel) + '</span>' +
          '<span class="visit-step-chip__body">' +
            '<small>' + (skipped ? 'Pulada' : 'Etapa ' + step.id) + '</small>' +
            '<strong>' + app.escapeHtml(step.title) + '</strong>' +
            '<span>' + app.escapeHtml(skipped ? 'Imóvel fechado: etapa não obrigatória.' : step.hint) + '</span>' +
          '</span>' +
        '</button>';
    }).join('');

    var scrollActiveVisitStep = function () {
      var activeStepButton = stepsNode.querySelector('.visit-step-chip.is-active');
      if (activeStepButton && typeof activeStepButton.scrollIntoView === 'function') {
        activeStepButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    };
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(scrollActiveVisitStep);
    } else {
      setTimeout(scrollActiveVisitStep, 0);
    }

    Array.from(document.querySelectorAll('[data-visit-step]')).forEach(function (node) {
      node.hidden = Number(node.getAttribute('data-visit-step')) !== current;
    });
    Array.from(document.querySelectorAll('.visit-step-panel[data-visit-step]')).forEach(function (node) {
      node.hidden = Number(node.getAttribute('data-visit-step')) !== current;
    });
    Array.from(document.querySelectorAll('[data-visit-steps]')).forEach(function (node) {
      var allowed = String(node.getAttribute('data-visit-steps') || '').split(',').map(function (item) { return Number(String(item).trim()); });
      node.hidden = allowed.indexOf(current) === -1;
    });

    if (hintNode) {
      var currentMeta = app.VISIT_STEPS.find(function (item) { return item.id === current; }) || app.VISIT_STEPS[0];
      var currentValidation = app.validateVisitStep(current);
      var gpsNote = (!app.state.visit.gps && current >= 1) ? ' GPS ainda não capturado.' : '';
      hintNode.textContent = currentValidation.ok
        ? (currentMeta.hint + gpsNote)
        : currentValidation.message;
    }
    if (typeof app.renderEducationalGuidance === 'function' && current === 5) {
      app.renderEducationalGuidance();
    }
  };

  app.setVisitSaveBusy = function (isBusy) {
    var button = document.getElementById('saveVisitBtn');
    app.state.visitSaveInFlight = !!isBusy;
    if (!button) {
      return;
    }
    button.disabled = !!isBusy;
    button.textContent = isBusy ? 'Salvando...' : 'Salvar visita';
  };

  app.stopVisitSaveWithMessage = function (message) {
    app.setVisitSaveBusy(false);
    app.showMessage(message, 'danger');
  };

  app.getLastVisitBeforeCurrent = function (property) {
    if (!property) {
      return null;
    }
    return app.getVisitsForProperty(property).filter(function (visit) {
      return visit.uid !== app.state.editingVisitId;
    })[0] || null;
  };

  app.canMarkVisitRecovered = function (property) {
    var lastVisit = app.getLastVisitBeforeCurrent(property);
    return !!(lastVisit && app.normalizeStatus(lastVisit.situacao) === 'Fechado');
  };

  app.getRecoveredVisitBlockMessage = function () {
    return 'Só é possível marcar como Recuperado quando a última visita anterior do imóvel foi Fechado.';
  };

  app.clearRecoveredVisitBlockMessage = function () {
    var node = document.getElementById('syncStatus');
    if (node && node.textContent === app.getRecoveredVisitBlockMessage()) {
      if (typeof app.hideMessage === 'function') {
        app.hideMessage();
      } else {
        node.textContent = '';
        node.classList.add('is-hidden');
        node.setAttribute('aria-hidden', 'true');
      }
    }
  };

  app.saveVisit = function () {
    if (app.state.visitSaveInFlight) {
      return;
    }
    app.setVisitSaveBusy(true);
    app.syncVisitWithInputs();
    if (!app.state.currentAgent) {
      app.stopVisitSaveWithMessage('Entre no sistema antes de salvar.');
      return;
    }
    if (!app.state.selectedPropertyId) {
      app.stopVisitSaveWithMessage('Selecione um imóvel antes de registrar a visita.');
      return;
    }
    var visitSaveWarnings = [];
    if (!app.state.visit.data || !app.state.visit.hora) {
      app.stopVisitSaveWithMessage('Informe se o imóvel está aberto, fechado ou recuperado para registrar a hora da visita.');
      return;
    }
    if (!app.state.visit.situacao) {
      app.stopVisitSaveWithMessage('Informe se o imóvel está aberto, fechado ou recuperado antes de salvar.');
      return;
    }
    if (!app.state.visit.microarea) {
      app.stopVisitSaveWithMessage('O imóvel selecionado está sem microárea no cadastro. Atualize o imóvel antes de salvar a visita.');
      return;
    }
    if (!app.state.visit.quarteirao && !app.isMicroareaWithoutQuarteirao(app.state.visit.microarea)) {
      app.stopVisitSaveWithMessage('O imóvel selecionado está sem quarteirão no cadastro. Atualize o imóvel antes de salvar a visita.');
      return;
    }
    if (app.state.visit.situacao === 'Fechado' && !app.state.visit.closedReason) {
      app.stopVisitSaveWithMessage('Informe o motivo do imóvel fechado antes de salvar a visita.');
      return;
    }
    if (app.isClosedVisitFlow()) {
      app.state.visit.depositFound = '';
      app.state.visit.depositCounts = app.emptyDepositMap();
      app.state.visit.depositFocusCounts = app.emptyDepositMap();
      app.state.visit.depositTreatmentCounts = app.emptyDepositMap();
      app.state.visit.focusFound = 'Não';
      app.state.visit.focusQty = 0;
      app.state.visit.tubitosQty = 0;
      app.state.visit.tubitosDeposit = '';
      app.state.visit.tubitosByDeposit = app.emptyDepositMap();
      app.state.visit.waterAccess = '';
      app.state.visit.waterAccessReason = '';
      app.state.visit.ladderSupportRequested = '';
      app.state.visit.ladderSupportNoReason = '';
      app.state.visit.waterTankCondition = '';
      app.state.visit.waterTreatment = '';
    }
    if (!app.isClosedVisitFlow() && !app.state.visit.depositFound) {
      app.stopVisitSaveWithMessage('Informe se encontrou depósito antes de salvar a visita.');
      return;
    }
    if (!app.isClosedVisitFlow() && app.state.visit.depositFound === 'Sim' && app.totalFromMap(app.state.visit.depositCounts) <= 0) {
      app.stopVisitSaveWithMessage('Informe ao menos um depósito encontrado antes de salvar a visita.');
      return;
    }
    if (!app.isClosedVisitFlow() && app.state.visit.focusFound === 'Sim' && app.totalFromMap(app.state.visit.depositFocusCounts) <= 0) {
      app.stopVisitSaveWithMessage('Marque qual depósito teve foco antes de salvar a visita.');
      return;
    }
    if (!app.isClosedVisitFlow() && app.totalFromMap(app.state.visit.depositTreatmentCounts || app.emptyDepositMap()) > 0 &&
        app.state.visit.larvicida === 'Nenhum' && app.state.visit.adulticida === 'Nenhum') {
      app.stopVisitSaveWithMessage('Informe o tratamento aplicado no depósito antes de salvar a visita.');
      return;
    }
    if (!app.isClosedVisitFlow() && app.state.visit.waterAccess === 'Não' && !app.state.visit.waterAccessReason) {
      app.stopVisitSaveWithMessage('Informe o motivo de não acessar a caixa d\'água antes de salvar a visita.');
      return;
    }
    if (!app.isClosedVisitFlow() && app.shouldAskLadderSupport(app.state.visit) && !app.state.visit.ladderSupportRequested) {
      app.stopVisitSaveWithMessage('Informe se deseja solicitar apoio com escada antes de salvar a visita.');
      return;
    }
    if (!app.isClosedVisitFlow() && app.shouldAskLadderSupport(app.state.visit) && app.state.visit.ladderSupportRequested === 'Não' && !app.state.visit.ladderSupportNoReason) {
      app.stopVisitSaveWithMessage('Informe o motivo de não solicitar escada agora antes de salvar a visita.');
      return;
    }
    if (!app.isClosedVisitFlow() && app.state.visit.waterAccess === 'Sim' && !app.state.visit.waterTreatment) {
      app.stopVisitSaveWithMessage('Informe se foi feito tratamento na caixa d\'água antes de salvar a visita.');
      return;
    }
    if (String(app.state.visit.operationMode || '').toUpperCase() === 'PE' && !app.state.visit.peTipoLocal) {
      app.stopVisitSaveWithMessage('Informe o tipo do P.E. antes de salvar a visita.');
      return;
    }
    if (String(app.state.visit.operationMode || '').toUpperCase() === 'PE' && !app.state.visit.peNomeLocal) {
      app.stopVisitSaveWithMessage('Informe o nome ou referência do P.E. antes de salvar a visita.');
      return;
    }
    var property = app.getSelectedProperty();
    if (!property) {
      app.stopVisitSaveWithMessage('Imóvel selecionado não encontrado.');
      return;
    }
    if (app.state.visit.situacao === 'Recuperado' && !app.canMarkVisitRecovered(property)) {
      app.stopVisitSaveWithMessage(app.getRecoveredVisitBlockMessage());
      return;
    }

    var incomingVisitStatus = app.normalizeStatus(app.state.visit.situacao || '');
    var duplicateVisit = app.readVisits().find(function (visit) {
      var sameUid = app.state.editingVisitId && visit.uid === app.state.editingVisitId;
      var sameDate = visit && visit.data === app.state.visit.data;
      var sameProperty = visit && ((property.uid && visit.property_uid === property.uid) || app.addressKey(visit) === app.addressKey(property));
      var sameOperation = app.normalizeOperationMode(visit.operationMode || visit.operation_mode || visit.origem_visita || 'VD') ===
        app.normalizeOperationMode(app.state.visit.operationMode || 'VD');
      var existingVisitStatus = app.normalizeStatus(visit && visit.situacao || '');
      var isRecoveryAfterClosed = incomingVisitStatus === 'Recuperado' && existingVisitStatus === 'Fechado';
      return !sameUid && sameDate && sameProperty && sameOperation && !isRecoveryAfterClosed;
    });
    if (duplicateVisit) {
      app.stopVisitSaveWithMessage('Já existe uma visita deste mesmo tipo para este imóvel nesta data. Edite a visita existente ou registre em outra data.');
      return;
    }

    var territory = app.applyGpsTerritoryContext();
    app.saveLastArea(app.state.visit.microarea, app.state.visit.quarteirao);

    var operationRestriction = (window.ACEOperationMode && typeof window.ACEOperationMode.getTerritoryRestriction === 'function')
      ? window.ACEOperationMode.getTerritoryRestriction()
      : null;
    var operationUnits = operationRestriction && Array.isArray(operationRestriction.units)
      ? operationRestriction.units
      : [];
    var operationUnitsText = operationRestriction
      ? JSON.stringify(operationUnits)
      : (app.state.visit.operationUnits || '');

    if (operationRestriction && (operationRestriction.blocked || !operationUnits.length)) {
      app.stopVisitSaveWithMessage(operationRestriction.label || 'Plano operacional sem pares microarea + quarteirao validos. Sincronize com internet ou acione a coordenacao antes de salvar.');
      return;
    }

    var operationMicroareas = operationRestriction ? (operationRestriction.microareas || []).join('|') : (app.state.visit.operationMicroareas || '');
    var operationQuarteiroes = operationRestriction ? (operationRestriction.quarteiroes || []).join('|') : (app.state.visit.operationQuarteiroes || '');
    var foraAreaDesignada = '';
    if (operationRestriction) {
      var normalizeOpMicroarea = function (value) {
        var raw = String(value || '').trim().replace(/^[A-Z0-9]{1,8}\s*-\s*/i, '');
        var key = app.normalizeLabel(raw);
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
      };
      var normalizeOpQuarter = function (value) {
        return app.normalizeLabel(String(value || '').trim().replace(/^q\s*[-/]?\s*/i, '').replace(/^0+(\d)/, '$1'));
      };
      var propertyMicroarea = normalizeOpMicroarea(property.microarea || property.bairro || '');
      var propertyQuarteirao = normalizeOpQuarter(property.quarteirao || '');
      var insideTerritory;
      if (operationUnits.length) {
        var propertyUnitKey = propertyMicroarea + '|' + propertyQuarteirao;
        insideTerritory = operationUnits.some(function (unit) {
          return normalizeOpMicroarea(unit.microarea || unit.territory || '') + '|' + normalizeOpQuarter(unit.quarteirao || unit.quarter || '') === propertyUnitKey;
        });
      } else {
        var allowedMicroareas = (operationRestriction.microareas || []).map(normalizeOpMicroarea).filter(Boolean);
        var allowedQuarteiroes = (operationRestriction.quarteiroes || []).map(normalizeOpQuarter).filter(Boolean);
        var microareaOk = !allowedMicroareas.length || allowedMicroareas.indexOf(propertyMicroarea) > -1;
        var quarteiraoOk = !allowedQuarteiroes.length || allowedQuarteiroes.indexOf(propertyQuarteirao) > -1;
        insideTerritory = microareaOk && quarteiraoOk;
      }
      if (!insideTerritory) {
        app.stopVisitSaveWithMessage('Este imovel nao pertence aos pares microarea + quarteirao do plano ativo. Sincronize com internet ou selecione um imovel da lista designada.');
        return;
      }
      foraAreaDesignada = insideTerritory ? 'Não' : 'Sim';
    }

    var existingRecord = app.state.editingVisitId ? app.readVisits().find(function (visit) { return visit.uid === app.state.editingVisitId; }) : null;
    var visitStartTime = existingRecord && existingRecord.hora ? existingRecord.hora : app.state.visit.hora;
    app.state.visit.hora = visitStartTime;
    var record = app.normalizeVisit({
      uid: app.state.editingVisitId || app.createId('VIS'),
      data: app.state.visit.data,
      hora: visitStartTime,
      agente: app.state.currentAgent.nome,
      matricula: app.state.currentAgent.matricula,
      microarea: app.state.visit.microarea,
      quarteirao: app.state.visit.quarteirao,
      bairro: property.bairro,
      logradouro: property.logradouro,
      numero: property.numero,
      tipo: property.tipo,
      situacao: app.state.visit.situacao,
      closedReason: app.state.visit.closedReason,
      morador: property.morador,
      telefone: property.telefone,
      property_uid: property.uid,
      depositCounts: app.state.visit.depositCounts,
      depositFocusCounts: app.state.visit.depositFocusCounts,
      depositTreatmentCounts: app.state.visit.depositTreatmentCounts,
      depositFound: app.state.visit.depositFound,
      focusFound: app.state.visit.focusFound,
      focusQty: app.state.visit.focusQty,
      waterAccess: app.state.visit.waterAccess,
      waterAccessReason: app.state.visit.waterAccessReason,
      ladderSupportRequested: app.state.visit.ladderSupportRequested,
      ladderSupportNoReason: app.state.visit.ladderSupportNoReason,
      waterTankCondition: app.state.visit.waterTankCondition,
      waterTreatment: app.state.visit.waterTreatment,
      attendedBy: app.state.visit.attendedBy,
      larvicida: app.state.visit.larvicida,
      larvicidaQty: app.state.visit.larvicidaQty,
      adulticida: app.state.visit.adulticida,
      adulticidaQty: app.state.visit.adulticidaQty,
      tubitosQty: app.state.visit.tubitosQty,
      tubitosDeposit: app.state.visit.tubitosDeposit,
      tubitosByDeposit: app.state.visit.tubitosByDeposit,
      operationMode: app.state.visit.operationMode || 'VD',
      peTipoLocal: app.state.visit.peTipoLocal || '',
      peNomeLocal: app.state.visit.peNomeLocal || '',
      peObservacao: app.state.visit.peObservacao || '',
      liraaCiclo: app.state.visit.liraaCiclo || '',
      liraaPlanoId: app.state.visit.liraaPlanoId || '',
      liraaQuarteiraoSorteado: app.state.visit.liraaQuarteiraoSorteado || '',
      liraaUnitKey: app.state.visit.liraaUnitKey || '',
      liraaColeta: app.state.visit.liraaColeta || '',
      operationMicroareas: operationMicroareas,
      operationQuarteiroes: operationQuarteiroes,
      operationUnits: operationUnitsText,
      foraAreaDesignada: foraAreaDesignada,
      obs: app.state.visit.obs,
      gps: app.state.visit.gps,
      gpsTerritory: territory ? territory.territoryName : app.state.visit.gpsTerritory,
      gpsQuarteirao: territory ? territory.quarteirao : app.state.visit.gpsQuarteirao,
      routeUrl: app.buildRouteUrl(property),
      synced: false,
      createdAt: existingRecord ? existingRecord.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    var visitValidation = typeof app.validateVisitRecord === 'function'
      ? app.validateVisitRecord(record, { allowMissingGps: true })
      : { errors: [], warnings: [], flags: [], qualityStatus: 'OK', gpsTrusted: !!record.gps };
    if (visitValidation.errors.length) {
      app.stopVisitSaveWithMessage(visitValidation.errors[0] + '.');
      return;
    }
    record = visitValidation.visit || record;
    record.qualityFlags = visitValidation.flags || [];
    record.qualityStatus = visitValidation.qualityStatus || (record.qualityFlags.length ? 'Atenção' : 'OK');
    visitSaveWarnings = visitValidation.warnings || [];

    var visits = app.readVisits();
    var index = visits.findIndex(function (visit) { return visit.uid === record.uid; });
    if (index > -1) {
      visits[index] = record;
    } else {
      visits.push(record);
    }
    app.saveVisits(visits);
    var generatedTubitos = [];
    if (typeof app.upsertTubitosForVisit === 'function') {
      generatedTubitos = app.upsertTubitosForVisit(record);
    }

    var properties = app.readProperties();
    var propertyIndex = properties.findIndex(function (item) { return item.uid === property.uid; });
    if (propertyIndex > -1) {
      var shouldUpdatePropertyGps = !!(record.gps && visitValidation && visitValidation.gpsTrusted && (
        record.focusFound === 'Sim' ||
        Number(record.focusQty || 0) > 0 ||
        app.totalFromMap(record.depositFocusCounts || app.emptyDepositMap()) > 0
      ));
      if (shouldUpdatePropertyGps) {
        properties[propertyIndex].lastLat = record.gps.lat;
        properties[propertyIndex].lastLng = record.gps.lng;
        properties[propertyIndex].gpsTerritory = record.gpsTerritory || properties[propertyIndex].gpsTerritory;
        properties[propertyIndex].gpsQuarteirao = record.gpsQuarteirao || properties[propertyIndex].gpsQuarteirao;
      }
      properties[propertyIndex].lastVisitAt = record.data + ' ' + record.hora;
      properties[propertyIndex].updatedAt = new Date().toISOString();
      var propertyQuality = app.computePropertyQuality(properties[propertyIndex], properties);
      properties[propertyIndex].qualityFlags = propertyQuality.flags;
      properties[propertyIndex].qualityStatus = propertyQuality.status;
      app.saveProperties(properties);
      app.markPropertyDirty(properties[propertyIndex].uid || property.uid);
    }

    app.addLog('visit', index > -1 ? 'update' : 'create', record.uid, record.logradouro + ', ' + record.numero + ' • ' + record.situacao);
    app.saveLocationTrailFromGps(record.gps || (app.readSystemState && app.readSystemState().lastKnownGps), 'visit', {
      visitUid: record.uid,
      eventLabel: (record.logradouro || '') + ', ' + (record.numero || '') + ' • ' + (record.situacao || '')
    });
    app.touchPendingSync('visit');
    var pendingAfterSave = app.getUnsyncedVisits().length;
    var tubitoCodes = generatedTubitos.map(function (row) {
      return row.numeroTubito;
    }).filter(Boolean);
    app.showMessage(
      (index > -1 ? 'Visita atualizada.' : 'Visita salva.') +
      ' Salva no aparelho. Formulário limpo. ' +
      pendingAfterSave + ' visita(s) aguardando Nuvem.' +
      (tubitoCodes.length ? ' Tubitos listados no painel.' : '') +
      (visitSaveWarnings.length ? ' Atenção: ' + visitSaveWarnings.join('; ') + '.' : ''),
      visitSaveWarnings.length ? 'warn' : 'accent'
    );
    app.state.editingVisitId = '';
    app.state.selectedPropertyId = '';
    app.resetVisitForm();
    app.setVisitCurrentStep(1);
    app.renderAll();
    app.showScreen('painel');
    app.setVisitSaveBusy(false);
    app.updateSyncUi();
    app.tryAutoSync('visit');
  };

  app.buildMetricsForSync = function () {
    var snapshot = app.buildLocalSnapshot();
    return {
      reference_date: app.todayISO(),
      total_visitas: snapshot.totals.totalVisits,
      imoveis_visitados: snapshot.totals.visitedProperties,
      abertos: snapshot.totals.opened,
      fechados: snapshot.totals.closed,
      total: snapshot.totals.totalProperties,
      recuperados: snapshot.totals.recovered,
      pendencias: snapshot.totals.pending,
      depositos_encontrados: snapshot.totals.deposits,
      depositos_com_foco: snapshot.totals.depositsWithFocus,
      tubitos_qtd: snapshot.totals.tubitos,
      taxa_infestacao: snapshot.totals.infestationRate,
      cobertura_gps: snapshot.totals.gpsCoverage,
      retornos: snapshot.totals.returns,
      focos: snapshot.totals.focusCount
    };
  };

  app.buildSyncPayload = function () {
    var syncToken = String(app.CONFIG.API_TOKEN || '').trim();
    var sessionToken = app.getCurrentApiSessionToken ? app.getCurrentApiSessionToken() : '';
    var canSyncAdministrativeData = !!(syncToken && typeof app.canManageAdmin === 'function' && app.canManageAdmin());
    var pendingVisits = app.readVisits().filter(function (visit) {
      return !visit.synced;
    });
    var validVisits = [];
    var visitValidationErrors = [];
    var validVisitIds = {};
    var pendingTubitos = app.readTubitos().filter(function (row) {
      return row.synced === false;
    });
    var pendingLocationTrail = typeof app.getUnsyncedLocationTrail === 'function' ? app.getUnsyncedLocationTrail() : [];
    var validTubitos = [];
    var tubitoValidationErrors = [];

    pendingVisits.forEach(function (visit) {
      var result = typeof app.validateVisitRecord === 'function'
        ? app.validateVisitRecord(visit, { allowMissingGps: true, silent: true })
        : { errors: [], visit: visit };
      if (result.errors && result.errors.length) {
        visitValidationErrors.push({
          uid: String(visit && visit.uid || '').trim(),
          errors: result.errors.slice()
        });
        return;
      }
      validVisits.push(result.visit || visit);
      if ((result.visit || visit).uid) {
        validVisitIds[(result.visit || visit).uid] = true;
      }
    });

    pendingTubitos.forEach(function (row) {
      var normalizedRow = typeof app.normalizeTubito === 'function' ? app.normalizeTubito(row) : row;
      var errors = [];
      if (!normalizedRow.uid) {
        errors.push('Tubito sem uid');
      }
      if (!normalizedRow.numeroTubito) {
        errors.push('Tubito sem número');
      }
      if (!normalizedRow.visit_uid) {
        errors.push('Tubito sem vínculo de visita');
      }
      if (!normalizedRow.property_uid) {
        errors.push('Tubito sem vínculo de imóvel');
      }
      if (!normalizedRow.depositoCodigo) {
        errors.push('Tubito sem depósito');
      }
      if (!normalizedRow.agente || !normalizedRow.matricula) {
        errors.push('Tubito sem agente ou matrícula');
      }
      if (normalizedRow.visit_uid && !validVisitIds[normalizedRow.visit_uid] && pendingVisits.some(function (visit) { return visit.uid === normalizedRow.visit_uid; })) {
        errors.push('Visita do tubito ainda inválida para sincronização');
      }
      if (errors.length) {
        tubitoValidationErrors.push({
          uid: String(normalizedRow.uid || '').trim(),
          numero_tubito: String(normalizedRow.numeroTubito || '').trim(),
          errors: errors
        });
        return;
      }
      validTubitos.push(normalizedRow);
    });

    return {
      action: 'sync',
      token: syncToken,
      api_token: syncToken,
      auth_token: syncToken || sessionToken,
      session_token: sessionToken,
      generated_at: new Date().toISOString(),
      sync_validation: {
        visits_blocked: visitValidationErrors,
        tubitos_blocked: tubitoValidationErrors
      },
      agents: [],
      deleted_agents: [],
      properties: app.getDirtyPropertiesForSync().map(function (property) {
        return {
          uid: property.uid,
          morador: property.morador,
          telefone: property.telefone,
          microarea: property.microarea,
          quarteirao: property.quarteirao,
          bairro: property.bairro,
          logradouro: property.logradouro,
          numero: property.numero,
          complemento: property.complemento,
          tipo: property.tipo,
          referencia: property.referencia,
          obs: property.obs,
          address_key: property.address_key,
          last_lat: property.lastLat,
          last_lng: property.lastLng,
          gps_territory: property.gpsTerritory,
          gps_quarteirao: property.gpsQuarteirao,
          quality_flags: (property.qualityFlags || []).join('|'),
          quality_status: property.qualityStatus,
          created_by_name: property.createdByName,
          created_by_matricula: property.createdByMatricula,
          created_at: property.createdAt,
          last_visit_at: property.lastVisitAt,
          updatedAt: property.updatedAt
        };
      }),
      visits: validVisits.map(function (visit) {
        return {
          uid: visit.uid,
          sheet_name: 'visitas',
          data: visit.data,
          hora: visit.hora,
          agente: visit.agente,
          matricula: visit.matricula,
          microarea: visit.microarea,
          quarteirao: visit.quarteirao,
          bairro: visit.bairro,
          logradouro: visit.logradouro,
          numero: visit.numero,
          tipo: visit.tipo,
          situacao: visit.situacao,
          motivo_fechado: visit.closedReason,
          closed_reason: visit.closedReason,
          morador: visit.morador,
          telefone: visit.telefone,
          property_uid: visit.property_uid,
          deposits: visit.deposits.join('|'),
          deposit_count: visit.depositTotal,
          deposit_focus_breakdown: visit.depositFocusBreakdown.join('|'),
          deposit_focus_count: visit.depositFocusTotal,
          deposit_treatment_breakdown: (visit.depositTreatmentBreakdown || []).join('|'),
          deposit_treatment_count: visit.depositTreatmentTotal || 0,
          deposit_found: visit.depositFound,
          deposit_with_focus: visit.depositFocusTotal > 0 ? 'Sim' : 'Não',
          foco: visit.focusFound,
          focus_count: visit.focusQty,
          acessou_caixa_agua: visit.waterAccess,
          motivo_caixa_agua: visit.waterAccessReason,
          water_access_reason: visit.waterAccessReason,
          solicita_escada: visit.ladderSupportRequested,
          ladder_support_requested: visit.ladderSupportRequested,
          motivo_nao_solicitou_escada: visit.ladderSupportNoReason,
          ladder_support_no_reason: visit.ladderSupportNoReason,
          ladder_support_status: app.getLadderSupportStatus(visit),
          situacao_caixa_agua: visit.waterTankCondition,
          water_tank_condition: visit.waterTankCondition,
          tratamento_caixa_agua: visit.waterTreatment,
          water_tank_treatment: visit.waterTreatment,
          attended_by: visit.attendedBy,
          nome_atendido: visit.attendedBy,
          larvicida: visit.larvicida,
          larvicida_qtd: visit.larvicidaQty,
          adulticida: visit.adulticida,
          adulticida_qtd: visit.adulticidaQty,
          tubitos_qtd: visit.tubitosQty,
          tubitos_deposito: app.formatTubitoDepositSummary(visit) || app.getTubitoDepositText(visit),
          laboratorio_status: visit.laboratorioStatus,
          laboratorio_resultado: visit.laboratorioResultado,
          laboratorio_positivo_aedes: visit.laboratorioPositivoAedes,
          laboratorio_atualizado_em: visit.laboratorioAtualizadoEm,
          operation_mode: visit.operationMode || 'VD',
          operational_mode: visit.operationMode || 'VD',
          pe_tipo_local: visit.peTipoLocal || '',
          pe_nome_local: visit.peNomeLocal || '',
          pe_observacao: visit.peObservacao || '',
          liraa_ciclo: visit.liraaCiclo || '',
          liraa_plano_id: visit.liraaPlanoId || '',
          liraa_quarteirao_sorteado: visit.liraaQuarteiraoSorteado || '',
          liraa_unit_key: visit.liraaUnitKey || '',
          liraa_coleta: visit.liraaColeta || '',
          operation_microarea_designada: visit.operationMicroareas || '',
          operation_quarteirao_designado: visit.operationQuarteiroes || '',
          operation_units_designadas: visit.operationUnits || '',
          fora_area_designada: visit.foraAreaDesignada || '',
          obs: visit.obs,
          gps_lat: visit.gps ? visit.gps.lat : '',
          gps_lng: visit.gps ? visit.gps.lng : '',
          gps_acc: visit.gps ? visit.gps.accuracy : '',
          gps_territory: visit.gpsTerritory,
          gps_quarteirao: visit.gpsQuarteirao,
          quality_flags: (visit.qualityFlags || []).join('|'),
          quality_status: visit.qualityStatus || '',
          route_url: visit.routeUrl,
          updatedAt: visit.updatedAt
        };
      }),
      tubitos: validTubitos.map(function (row) {
        return {
          uid: row.uid,
          numero_tubito: row.numeroTubito,
          visit_uid: row.visit_uid,
          property_uid: row.property_uid,
          data_coleta: row.dataColeta,
          hora_coleta: row.horaColeta,
          agente: row.agente,
          matricula: row.matricula,
          microarea: row.microarea,
          quarteirao: row.quarteirao,
          bairro: row.bairro,
          logradouro: row.logradouro,
          numero: row.numero,
          deposito_codigo: row.depositoCodigo,
          origem_visita: row.operationMode || row.origemVisita || 'VD',
          operation_mode: row.operationMode || row.origemVisita || 'VD',
          pe_tipo_local: row.peTipoLocal || '',
          pe_nome_local: row.peNomeLocal || '',
          liraa_ciclo: row.liraaCiclo || '',
          status_laboratorio: row.statusLaboratorio,
          resultado_laboratorio: row.resultadoLaboratorio,
          especie: row.especie,
          positivo_aedes: row.positivoAedes,
          analisado_por: row.analisadoPor,
          analisado_em: row.analisadoEm,
          observacao_laboratorio: row.observacaoLaboratorio,
          updatedAt: row.updatedAt
        };
      }),
      supervision_requests: (typeof app.getUnsyncedSupervisionRequests === 'function' ? app.getUnsyncedSupervisionRequests() : []).map(function (row) {
        return {
          uid: row.uid,
          data: row.data,
          hora: row.hora,
          agente: row.agente,
          matricula: row.matricula,
          operation_mode: row.operationMode || 'VD',
          mensagem: row.mensagem,
          status: row.status || 'Aberta',
          gps_lat: row.gpsLat,
          gps_lng: row.gpsLng,
          gps_acc: row.gpsAcc,
          gps_territory: row.gpsTerritory,
          gps_quarteirao: row.gpsQuarteirao,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      }),
      location_trail: pendingLocationTrail.map(function (row) {
        return {
          uid: row.uid,
          timestamp: row.timestamp,
          date: row.date,
          matricula: row.matricula,
          nome: row.nome,
          operation_mode: row.operationMode || 'VD',
          lat: row.lat,
          lng: row.lng,
          accuracy: row.accuracy,
          speed: row.speed,
          heading: row.heading,
          battery: row.battery,
          event_type: row.eventType || 'track',
          event_label: row.eventLabel || '',
          visit_uid: row.visitUid || '',
          synced_at: row.syncedAt || ''
        };
      }),
      metrics_daily: canSyncAdministrativeData ? app.buildMetricsForSync() : null,
      logs: app.getUnsyncedLogs().map(function (logEntry) {
        return {
          uid: logEntry.uid,
          timestamp: logEntry.timestamp || logEntry.createdAt || new Date().toISOString(),
          tipo: String(logEntry.tipo || logEntry.scope || '').trim(),
          acao: String(logEntry.acao || logEntry.action || '').trim(),
          ref_uid: String(logEntry.ref_uid || logEntry.target_uid || logEntry.targetUid || '').trim(),
          descricao: String(logEntry.descricao || logEntry.details || '').trim(),
          actor_name: String(logEntry.actor_name || logEntry.actorName || '').trim(),
          actor_matricula: String(logEntry.actor_matricula || logEntry.actorMatricula || '').trim()
        };
      }),
      system_state: canSyncAdministrativeData ? app.readSystemState() : null
    };
  };

  app.createNetworkTimeoutError = function () {
    var error = new Error('Tempo de conexão esgotado');
    error.isNetworkTimeout = true;
    return error;
  };

  app.fetchWithTimeout = function (url, options, timeoutMs) {
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('Fetch indisponível'));
    }
    var requestOptions = Object.assign({}, options || {});
    var limit = Number(timeoutMs || app.CONFIG.BOOTSTRAP_TIMEOUT_MS || 8000);

    return new Promise(function (resolve, reject) {
      var settled = false;
      var controller = null;
      var timer = null;

      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        requestOptions.signal = controller.signal;
      }

      function finish(callback, value) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        callback(value);
      }

      timer = setTimeout(function () {
        if (controller) {
          controller.abort();
        }
        finish(reject, app.createNetworkTimeoutError());
      }, limit);

      fetch(url, requestOptions).then(function (response) {
        finish(resolve, response);
      }).catch(function (error) {
        if (error && error.name === 'AbortError') {
          finish(reject, app.createNetworkTimeoutError());
          return;
        }
        finish(reject, error);
      });
    });
  };


  app.refreshOperationalSessionIfNeeded = function (reason) {
    var apiToken = String(app.CONFIG.API_TOKEN || '').trim();
    var sessionMeta = typeof app.getCurrentApiSessionMeta === 'function'
      ? app.getCurrentApiSessionMeta()
      : { token: app.getCurrentApiSessionToken ? app.getCurrentApiSessionToken() : '', expiresSoon: false, expired: false };

    if (apiToken) {
      return Promise.resolve(true);
    }
    if (!navigator.onLine) {
      return Promise.resolve(!!sessionMeta.token);
    }
    if (!sessionMeta.token) {
      return Promise.resolve(false);
    }
    if (!sessionMeta.expiresSoon && !sessionMeta.expired) {
      return Promise.resolve(true);
    }

    return app.fetchWithTimeout(app.CONFIG.SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        action: 'field_session_refresh',
        session_token: sessionMeta.token
      })
    }, Math.min(Number(app.CONFIG.BOOTSTRAP_TIMEOUT_MS || 45000), 15000)).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao renovar a sessão operacional.');
      }
      return response.json();
    }).then(function (payload) {
      var expiresInSeconds;
      var expiresAt;
      if (!payload || payload.ok === false || payload.authenticated === false) {
        throw new Error((payload && payload.error) || 'Sessão operacional expirada.');
      }
      expiresInSeconds = Math.max(0, Number(payload.expiresInSeconds || payload.expires_in_seconds || 0));
      expiresAt = expiresInSeconds ? new Date(Date.now() + (expiresInSeconds * 1000)).toISOString() : '';
      if (typeof app.setCurrentApiSession === 'function') {
        app.setCurrentApiSession(String(payload.sessionToken || payload.session_token || sessionMeta.token || '').trim(), expiresAt);
      }
      return true;
    }).catch(function () {
      if (typeof app.clearCurrentApiSession === 'function') {
        app.clearCurrentApiSession();
      }
      if (reason === 'manual-sync' || reason === 'close-day') {
        app.showMessage('A sessão online expirou. O que já está salvo no aparelho continua intacto, mas você precisa fazer login com internet antes de sincronizar.', 'warn');
      }
      return false;
    });
  };

  app.applyPropertySyncStatuses = function (rows) {
    var statuses = Array.isArray(rows) ? rows : [];
    var statusByUid = {};
    var dirtyToClear = [];
    var conflictCount = 0;
    var properties;

    if (!statuses.length) {
      return { cleared: [], conflicts: 0 };
    }

    statuses.forEach(function (row) {
      var uid = String(row && row.uid || '').trim();
      if (!uid) {
        return;
      }
      statusByUid[uid] = row;
      if (row.ok !== false && row.synced !== false) {
        dirtyToClear.push(uid);
      }
    });

    properties = app.readProperties().map(function (property) {
      var status = statusByUid[String(property && property.uid || '').trim()];
      if (!status) {
        return property;
      }
      if (status.ok === false || status.conflict === true) {
        conflictCount += 1;
        return Object.assign({}, property, {
          syncConflict: true,
          syncConflictAt: new Date().toISOString(),
          syncConflictReason: String(status.reason || 'server_newer').trim(),
          syncConflictMessage: String(status.error || status.message || 'Cadastro precisa ser revisado antes de reenviar.').trim(),
          syncConflictServerUpdatedAt: String(status.serverUpdatedAt || status.server_updated_at || '').trim(),
          syncConflictLocalUpdatedAt: String(status.clientUpdatedAt || status.client_updated_at || property.updatedAt || '').trim()
        });
      }
      return Object.assign({}, property, {
        syncConflict: false,
        syncConflictAt: '',
        syncConflictReason: '',
        syncConflictMessage: '',
        syncConflictServerUpdatedAt: '',
        syncConflictLocalUpdatedAt: ''
      });
    });

    app.saveProperties(properties);
    if (dirtyToClear.length && typeof app.clearDirtyPropertyIds === 'function') {
      app.clearDirtyPropertyIds(dirtyToClear);
    }

    return {
      cleared: dirtyToClear,
      conflicts: conflictCount
    };
  };

  app.handleOperationalAuthFailure = function (message, reason) {
    var detail = String(message || 'Sessão operacional expirada.').trim();
    if (typeof app.clearCurrentApiSession === 'function') {
      app.clearCurrentApiSession();
    }
    app.saveSystemState({ lastSyncError: detail });
    app.setSyncChip('Login online necessário', 'warn');
    app.updateSyncUi();
    if (reason === 'close-day') {
      app.showMessage('A sessão online expirou. Faça login com internet para sincronizar e encerrar o dia sem perder nada do aparelho.', 'warn');
    } else {
      app.showMessage('A sessão online expirou. Seus registros continuam salvos no aparelho. Faça login com internet para voltar a sincronizar.', 'warn');
    }
  };

  app.fetchJson = function (url, timeoutMs, options) {
    var requestOptions = Object.assign({
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }, options || {});
    requestOptions.headers = Object.assign({ Accept: 'application/json' }, requestOptions.headers || {});

    return app.fetchWithTimeout(url, requestOptions, timeoutMs).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao carregar dados da Nuvem');
      }
      return response.json();
    });
  };

  app.fetchOperationalJson = function (action, payload, timeoutMs) {
    var apiSessionToken = app.getCurrentApiSessionToken ? app.getCurrentApiSessionToken() : '';
    var apiToken = String(app.CONFIG.API_TOKEN || '').trim();
    var body = Object.assign({}, payload || {}, {
      action: action,
      session_token: apiSessionToken,
      auth_token: apiSessionToken || apiToken,
      token: apiToken,
      api_token: apiToken,
      t: Date.now()
    });

    return app.fetchWithTimeout(app.CONFIG.SHEETS_WEBAPP_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    }, timeoutMs).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao carregar dados da Nuvem');
      }
      return response.json();
    }).then(function (payload) {
      if (payload && payload.ok === false) {
        throw new Error(payload.error || 'A API recusou a solicitação.');
      }
      return payload;
    });
  };

  app.shouldSkipAutoSync = function (reason) {
    if (reason === 'manual' || reason === 'close-day' || reason === 'agent' || reason === 'agent-delete') {
      return false;
    }
    return app.state.nextAutoSyncAt && Date.now() < app.state.nextAutoSyncAt;
  };

  app.pauseAutoSyncAfterFailure = function (reason) {
    if (reason === 'manual' || reason === 'close-day' || reason === 'agent' || reason === 'agent-delete') {
      return;
    }
    app.state.nextAutoSyncAt = Date.now() + Number(app.CONFIG.AUTO_SYNC_COOLDOWN_MS || 300000);
  };

  app.extractRemoteVisits = function (payload) {
    if (!payload) {
      return [];
    }
    if (payload.data && Array.isArray(payload.data.visits)) {
      return payload.data.visits;
    }
    if (Array.isArray(payload.visits)) {
      return payload.visits;
    }
    return [];
  };

  app.extractRemoteProperties = function (payload) {
    if (!payload) {
      return [];
    }
    if (payload.data && Array.isArray(payload.data.properties)) {
      return payload.data.properties;
    }
    if (Array.isArray(payload.properties)) {
      return payload.properties;
    }
    return [];
  };

  app.getOperationScopeRowValue = function (row, keys) {
    var source = row || {};
    var index;
    var value;
    for (index = 0; index < keys.length; index += 1) {
      value = source[keys[index]];
      if (value !== null && value !== undefined && String(value).trim()) {
        return value;
      }
    }
    return '';
  };

  app.matchesCurrentOperationScope = function (row) {
    var operationMode = window.ACEOperationMode;
    var restriction;
    var unitKeys = {};
    var microarea;
    var quarteirao;
    var rowKey;

    if (!row || !operationMode || typeof operationMode.getTerritoryRestriction !== 'function' || typeof operationMode.makeTerritoryUnitKey !== 'function') {
      return false;
    }

    try {
      restriction = operationMode.getTerritoryRestriction();
    } catch (error) {
      return false;
    }

    if (!restriction || restriction.blocked || !Array.isArray(restriction.units) || !restriction.units.length) {
      return false;
    }

    if (Array.isArray(restriction.unitKeys) && restriction.unitKeys.length) {
      restriction.unitKeys.forEach(function (key) {
        if (key) {
          unitKeys[String(key)] = true;
        }
      });
    } else {
      restriction.units.forEach(function (unit) {
        var key = operationMode.makeTerritoryUnitKey(unit && unit.microarea, unit && unit.quarteirao);
        if (key) {
          unitKeys[key] = true;
        }
      });
    }

    microarea = app.getOperationScopeRowValue(row, [
      'microarea',
      'operation_microarea_designada',
      'operationMicroareaDesignada',
      'base_microarea',
      'bairro',
      'gps_territory',
      'gpsTerritory'
    ]);
    quarteirao = app.getOperationScopeRowValue(row, [
      'quarteirao',
      'operation_quarteirao_designado',
      'operationQuarteiraoDesignado',
      'gps_quarteirao',
      'gpsQuarteirao'
    ]);

    if (!String(microarea || '').trim() || !String(quarteirao || '').trim()) {
      return false;
    }

    rowKey = operationMode.makeTerritoryUnitKey(microarea, quarteirao);
    return !!unitKeys[rowKey];
  };

  app.filterRowsForCurrentOperationScope = function (rows) {
    if (!Array.isArray(rows) || !rows.length) {
      return [];
    }
    return rows.filter(function (row) {
      return app.matchesCurrentOperationScope(row);
    });
  };

  app.buildDashboardRangeUrl = function (visits) {
    var dates = (visits || []).map(function (visit) {
      return app.normalizeDateOnly(visit && visit.data);
    }).filter(Boolean).sort();
    var pageSize = Math.max(200, Math.min(2000, Math.max(0, (visits || []).length) * 6));
    var url = app.CONFIG.SHEETS_WEBAPP_URL +
      '?action=dashboard_range&include_properties=0&page=1&page_size=' + pageSize + '&sort=desc&t=' + Date.now();
    if (dates.length) {
      url += '&start=' + encodeURIComponent(dates[0]);
      url += '&end=' + encodeURIComponent(dates[dates.length - 1]);
    }
    return url;
  };

  app.buildDashboardRangePayload = function (visits) {
    var dates = (visits || []).map(function (visit) {
      return app.normalizeDateOnly(visit && visit.data);
    }).filter(Boolean).sort();
    var payload = {
      include_properties: 0,
      page: 1,
      page_size: Math.max(200, Math.min(2000, Math.max(0, (visits || []).length) * 6)),
      sort: 'desc'
    };
    if (dates.length) {
      payload.start = dates[0];
      payload.end = dates[dates.length - 1];
    }
    return payload;
  };

  app.markVisitsSyncedByUid = function (pendingVisitIds) {
    var count = 0;
    var visits = app.readVisits().map(function (visit) {
      if (visit && visit.uid && pendingVisitIds[visit.uid]) {
        if (visit.synced === false) {
          count += 1;
        }
        visit.synced = true;
      }
      return visit;
    });
    app.saveVisits(visits);
    return count;
  };
  app.markTubitosSyncedByUid = function (pendingTubitoIds) {
    var count = 0;
    if (typeof app.saveTubitos !== 'function') {
      return count;
    }
    app.saveTubitos(app.readTubitos().map(function (row) {
      if (row && row.uid && pendingTubitoIds[row.uid]) {
        if (row.synced === false) {
          count += 1;
        }
        row.synced = true;
      }
      return row;
    }));
    return count;
  };


  app.confirmRemoteSyncAfterUncertainFailure = function (pendingVisits, pendingVisitIds, attempt) {
    var tries = Number(attempt || 0);
    var requiredIds = Object.keys(pendingVisitIds || {});
    if (!requiredIds.length || !app.isApiConfigured() || navigator.onLine === false) {
      return Promise.resolve(false);
    }

    app.setSyncChip('Conferindo Nuvem', 'accent');
    app.updateSyncUi();

    return app.fetchOperationalJson('dashboard_range', app.buildDashboardRangePayload(pendingVisits), app.CONFIG.BOOTSTRAP_TIMEOUT_MS).then(function (payload) {
      var remoteIds = {};
      app.extractRemoteVisits(payload).forEach(function (visit) {
        var uid = String(visit && visit.uid || '').trim();
        if (uid) {
          remoteIds[uid] = true;
        }
      });
      return requiredIds.every(function (uid) {
        return !!remoteIds[uid];
      });
    }).catch(function () {
      return false;
    }).then(function (confirmed) {
      if (confirmed || tries >= 2) {
        return confirmed;
      }
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(app.confirmRemoteSyncAfterUncertainFailure(pendingVisits, pendingVisitIds, tries + 1));
        }, 1200);
      });
    });
  };

  app.mergeRemoteAgents = function (rows) {
    var local = app.readAgents();
    rows.map(app.normalizeAgent).forEach(function (remote) {
      if (!remote || app.isRemovedAgent(remote)) {
        return;
      }
      app.clearAgentDeletedMark(remote);
      var index = local.findIndex(function (agent) {
        return agent.uid === remote.uid || agent.matricula.toLowerCase() === remote.matricula.toLowerCase();
      });
      if (index > -1) {
        if (!remote.senhaHash) {
          remote.senhaHash = String(local[index].senhaHash || '').trim();
        }
        if (!remote.apiSessionToken) {
          remote.apiSessionToken = String(local[index].apiSessionToken || '').trim();
        }
        if (!remote.apiSessionExpiresAt) {
          remote.apiSessionExpiresAt = String(local[index].apiSessionExpiresAt || '').trim();
        }
        local[index] = Object.assign({}, local[index], remote);
      } else {
        local.push(remote);
      }
    });
    app.saveAgents(local.filter(function (agent) { return !app.isRemovedAgent(agent); }));
    app.ensureConfigurationAdminAgent();
    app.fillAgentSelect();
  };

  app.replaceRemoteAgents = function (rows) {
    var localRows = app.readAgents().filter(function (agent) {
      return agent && !app.isRemovedAgent(agent);
    });
    var localHashByKey = {};
    var localSessionByKey = {};
    var localRealAgents = localRows.filter(function (agent) {
      return !app.isConfigurationAdmin(agent);
    });
    var remoteRows = (rows || []).map(app.normalizeAgent).filter(function (agent) {
      return agent && !app.isRemovedAgent(agent);
    });
    var remoteRealAgents = remoteRows.filter(function (agent) {
      return !app.isConfigurationAdmin(agent);
    });

    if (!remoteRows.length && localRealAgents.length) {
      app.mergeRemoteAgents(remoteRows);
      if (typeof app.showMessage === 'function') {
        app.showMessage('A nuvem não devolveu a lista completa de agentes. Mantive os agentes já salvos neste aparelho para não bloquear o login.', 'warn');
      }
      return;
    }

    localRows.forEach(function (agent) {
      var hash = String(agent.senhaHash || '').trim();
      var sessionPayload = {
        token: String(agent.apiSessionToken || '').trim(),
        expiresAt: String(agent.apiSessionExpiresAt || '').trim()
      };
      if (agent.uid) {
        if (hash) {
          localHashByKey['uid:' + String(agent.uid).trim()] = hash;
        }
        if (sessionPayload.token || sessionPayload.expiresAt) {
          localSessionByKey['uid:' + String(agent.uid).trim()] = sessionPayload;
        }
      }
      if (agent.matricula) {
        if (hash) {
          localHashByKey['matricula:' + app.normalizeLabel(agent.matricula)] = hash;
        }
        if (sessionPayload.token || sessionPayload.expiresAt) {
          localSessionByKey['matricula:' + app.normalizeLabel(agent.matricula)] = sessionPayload;
        }
      }
      if (agent.cpf) {
        if (hash) {
          localHashByKey['cpf:' + app.normalizeCpf(agent.cpf)] = hash;
        }
        if (sessionPayload.token || sessionPayload.expiresAt) {
          localSessionByKey['cpf:' + app.normalizeCpf(agent.cpf)] = sessionPayload;
        }
      }
    });

    remoteRows.forEach(function (agent) {
      var sessionPayload = localSessionByKey['uid:' + String(agent.uid || '').trim()] ||
        localSessionByKey['matricula:' + app.normalizeLabel(agent.matricula || '')] ||
        localSessionByKey['cpf:' + app.normalizeCpf(agent.cpf || '')] ||
        null;
      if (!agent.senhaHash) {
        agent.senhaHash =
          localHashByKey['uid:' + String(agent.uid || '').trim()] ||
          localHashByKey['matricula:' + app.normalizeLabel(agent.matricula || '')] ||
          localHashByKey['cpf:' + app.normalizeCpf(agent.cpf || '')] ||
          '';
      }
      if (sessionPayload) {
        if (!agent.apiSessionToken) {
          agent.apiSessionToken = sessionPayload.token || '';
        }
        if (!agent.apiSessionExpiresAt) {
          agent.apiSessionExpiresAt = sessionPayload.expiresAt || '';
        }
      }
      app.clearAgentDeletedMark(agent);
    });
    app.saveAgents(remoteRows);
    app.ensureConfigurationAdminAgent();
    app.fillAgentSelect();
  };

  app.mergeRemoteProperties = function (rows) {
    var local = app.readProperties();
    var dirtyIds = {};
    app.readDirtyPropertyIds().forEach(function (propertyId) {
      dirtyIds[String(propertyId || '').trim()] = true;
    });
    rows.map(app.normalizeProperty).forEach(function (remote) {
      var index;
      if (!remote) {
        return;
      }
      index = local.findIndex(function (property) {
        return property.uid === remote.uid || property.address_key === remote.address_key;
      });
      if (index > -1) {
        if (dirtyIds[String(local[index].uid || '').trim()]) {
          local[index] = Object.assign({}, remote, local[index], {
            updatedAt: String(local[index].updatedAt || remote.updatedAt || new Date().toISOString()).trim()
          });
        } else {
          local[index] = Object.assign({}, local[index], remote);
        }
      } else {
        local.push(remote);
      }
    });
    app.saveProperties(local);
  };

  app.replaceRemoteProperties = function (rows) {
    var remoteRows = (rows || []).map(app.normalizeProperty).filter(Boolean);
    var localRows = app.readProperties();
    var dirtyIds = {};
    var localByUid = {};
    var localByAddressKey = {};
    var remoteSeen = {};
    var mergedRows;

    app.readDirtyPropertyIds().forEach(function (propertyId) {
      dirtyIds[String(propertyId || '').trim()] = true;
    });

    localRows.forEach(function (property) {
      if (!property) {
        return;
      }
      if (property.uid) {
        localByUid[property.uid] = property;
      }
      if (property.address_key) {
        localByAddressKey[property.address_key] = property;
      }
    });

    mergedRows = remoteRows.map(function (remoteProperty) {
      var localMatch;
      var remoteKey;
      if (!remoteProperty) {
        return null;
      }
      remoteKey = remoteProperty.uid || remoteProperty.address_key || '';
      if (remoteKey) {
        remoteSeen[remoteKey] = true;
      }
      localMatch = (remoteProperty.uid && localByUid[remoteProperty.uid]) ||
        (remoteProperty.address_key && localByAddressKey[remoteProperty.address_key]) ||
        null;

      if (!localMatch) {
        return remoteProperty;
      }

      if (dirtyIds[String(localMatch.uid || '').trim()]) {
        return Object.assign({}, remoteProperty, localMatch, {
          updatedAt: String(localMatch.updatedAt || remoteProperty.updatedAt || new Date().toISOString()).trim()
        });
      }

      return Object.assign({}, localMatch, remoteProperty);
    }).filter(Boolean);

    localRows.forEach(function (localProperty) {
      var localKey;
      if (!localProperty) {
        return;
      }
      localKey = localProperty.uid || localProperty.address_key || '';
      if (!localKey || remoteSeen[localKey]) {
        return;
      }
      if (dirtyIds[String(localProperty.uid || '').trim()]) {
        mergedRows.push(localProperty);
      }
    });

    app.saveProperties(mergedRows);
    if (app.state.selectedPropertyId && !mergedRows.some(function (property) {
      return property.uid === app.state.selectedPropertyId;
    })) {
      app.state.selectedPropertyId = '';
    }
  };

  app.mergeRemoteVisits = function (rows) {
    var local = app.readVisits();
    rows.map(app.normalizeVisit).forEach(function (remote) {
      var index;
      if (!remote) {
        return;
      }
      remote.synced = true;
      index = local.findIndex(function (visit) {
        return visit.uid === remote.uid;
      });
      if (index > -1) {
        local[index] = Object.assign({}, local[index], remote, { synced: local[index].synced !== false ? true : local[index].synced });
      } else {
        local.push(remote);
      }
    });
    app.saveVisits(local);
  };

  app.replaceRemoteVisits = function (rows) {
    var remoteRows = (rows || []).map(app.normalizeVisit).filter(function (visit) {
      return !!visit;
    }).map(function (visit) {
      visit.synced = true;
      return visit;
    });
    var keepTodayLocal = !(typeof app.isDayClosedToday === 'function' && app.isDayClosedToday());
    var today = app.todayISO();
    var localVisits = app.readVisits();
    var localTodayByUid = {};
    if (keepTodayLocal) {
      localVisits.forEach(function (visit) {
        if (visit && visit.uid && visit.data === today) {
          localTodayByUid[visit.uid] = visit;
        }
      });
      remoteRows = remoteRows.map(function (remoteVisit) {
        var localVisit = remoteVisit.uid ? localTodayByUid[remoteVisit.uid] : null;
        if (!localVisit) {
          return remoteVisit;
        }
        var mergedVisit = Object.assign({}, remoteVisit, localVisit);
        mergedVisit.synced = localVisit.synced === false ? false : true;
        return mergedVisit;
      });
    }
    var remoteByUid = {};
    remoteRows.forEach(function (visit) {
      if (visit.uid) {
        remoteByUid[visit.uid] = true;
      }
    });
    var localToKeep = localVisits.filter(function (visit) {
      if (!visit || (visit.uid && remoteByUid[visit.uid])) {
        return false;
      }
      if (visit.synced === false) {
        return true;
      }
      return keepTodayLocal && visit.data === today;
    });
    app.saveVisits(remoteRows.concat(localToKeep));
    if (app.readSystemState().suppressRemoteVisitsDate) {
      app.saveSystemState({ suppressRemoteVisitsDate: '' });
    }
  };

  app.refreshLoginRosterFromServer = function () {
    if (!app.isApiConfigured() || !navigator.onLine) {
      return Promise.resolve(false);
    }
    return app.fetchOperationalJson('login_bootstrap', {}, Math.min(Number(app.CONFIG.BOOTSTRAP_TIMEOUT_MS || 45000), 20000)).then(function (payload) {
      if (payload && Array.isArray(payload.agents)) {
        app.replaceRemoteAgents(payload.agents);
        app.renderAll();
        return true;
      }
      return false;
    }).catch(function () {
      return false;
    });
  };

  app.bootstrapFromServer = function () {
    if (!app.isApiConfigured() || !navigator.onLine) {
      return Promise.resolve(false);
    }
    if (!app.state.currentAgent || !String(app.state.currentAgent.uid || '').trim()) {
      return Promise.resolve(false);
    }

    return app.refreshOperationalSessionIfNeeded('bootstrap').then(function (hasAccess) {
      if (!hasAccess && !String(app.CONFIG.API_TOKEN || '').trim()) {
        return false;
      }

      app.setSyncChip('Atualizando Nuvem', 'accent');
      var retentionStart = app.daysAgoISO(Number(app.CONFIG.LOCAL_VISIT_RETENTION_DAYS || 21));
      var visitsPayload = {
        include_properties: 0,
        page: 1,
        page_size: Number(app.CONFIG.LOCAL_VISIT_CACHE_LIMIT || 1200),
        sort: 'desc',
        start: retentionStart,
        end: app.todayISO()
      };
      var loadedAny = false;
      var errors = [];
      var applyBootstrap = function (bootstrap) {
        if (window.ACEOperationMode && typeof window.ACEOperationMode.applyRemotePayload === 'function') {
          try {
            window.ACEOperationMode.applyRemotePayload(bootstrap.operation_plan || (bootstrap.data && bootstrap.data.operation_plan) || bootstrap);
            loadedAny = true;
          } catch (error) {}
        }
        if (Array.isArray(bootstrap.agents)) {
          app.replaceRemoteAgents(bootstrap.agents);
          loadedAny = true;
        }
        if (Array.isArray(bootstrap.properties)) {
          app.replaceRemoteProperties(app.filterRowsForCurrentOperationScope(bootstrap.properties));
          loadedAny = true;
        }
        if (Array.isArray(bootstrap.tubitos) && typeof app.mergeRemoteTubitos === 'function') {
          app.mergeRemoteTubitos(bootstrap.tubitos);
          loadedAny = true;
        } else if (bootstrap.data && Array.isArray(bootstrap.data.tubitos) && typeof app.mergeRemoteTubitos === 'function') {
          app.mergeRemoteTubitos(bootstrap.data.tubitos);
          loadedAny = true;
        }
        if (loadedAny) {
          app.renderAll();
        }
        return bootstrap;
      };
      var applyDashboardRange = function (visitsPayload) {
        var remoteVisits = app.filterRowsForCurrentOperationScope(app.extractRemoteVisits(visitsPayload));
        var remoteProperties = app.filterRowsForCurrentOperationScope(app.extractRemoteProperties(visitsPayload));
        if (remoteProperties.length) {
          app.replaceRemoteProperties(remoteProperties);
          loadedAny = true;
        }
        if (Array.isArray(remoteVisits)) {
          app.replaceRemoteVisits(remoteVisits);
          loadedAny = true;
        }
        if (visitsPayload && visitsPayload.tubitos && typeof app.mergeRemoteTubitos === 'function') {
          app.mergeRemoteTubitos(visitsPayload.tubitos);
          loadedAny = true;
        } else if (visitsPayload && visitsPayload.data && Array.isArray(visitsPayload.data.tubitos) && typeof app.mergeRemoteTubitos === 'function') {
          app.mergeRemoteTubitos(visitsPayload.data.tubitos);
          loadedAny = true;
        }
        if (loadedAny) {
          app.renderAll();
        }
        return visitsPayload;
      };
      var bootstrapPromise = app.fetchOperationalJson('bootstrap', {}, app.CONFIG.BOOTSTRAP_TIMEOUT_MS)
        .then(applyBootstrap)
        .catch(function (error) {
          errors.push(error);
          return null;
        });
      var visitsPromise = app.fetchOperationalJson('dashboard_range', visitsPayload, app.CONFIG.BOOTSTRAP_TIMEOUT_MS)
        .then(applyDashboardRange)
        .catch(function (error) {
          errors.push(error);
          return null;
        });

      return Promise.all([bootstrapPromise, visitsPromise]).then(function () {
        var firstError = errors[0] || null;
        if (!loadedAny) {
          throw firstError || new Error('Falha ao atualizar a Nuvem.');
        }
        if (firstError && typeof app.isOperationalAccessErrorMessage === 'function' && app.isOperationalAccessErrorMessage(firstError.message || firstError)) {
          app.handleOperationalAuthFailure(firstError.message || firstError, 'bootstrap');
          return false;
        }
        app.saveSystemState({ lastBootstrapAt: new Date().toISOString(), lastSyncError: '' });
        app.setSyncChip('Nuvem atualizada', 'ok');
        app.renderAll();
        return true;
      }).catch(function (error) {
        if (typeof app.isOperationalAccessErrorMessage === 'function' && app.isOperationalAccessErrorMessage(error && error.message ? error.message : error)) {
          app.handleOperationalAuthFailure(error && error.message ? error.message : error, 'bootstrap');
          return false;
        }
        app.setSyncChip('Modo local', 'warn');
        app.saveSystemState({ lastSyncError: 'Falha ao atualizar a Nuvem.' });
        return false;
      });
    });
  };


  app.tryAutoSync = function (reason) {
    if (!app.CONFIG.AUTO_SYNC || !app.isApiConfigured()) {
      app.setSyncChip('Modo local', 'warn');
      app.updateSyncUi();
      if (reason === 'manual') {
        app.showMessage('A sincronização ainda não está configurada. Os dados seguem salvos no aparelho.', 'warn');
      }
      return Promise.resolve(false);
    }
    if (!navigator.onLine) {
      app.setSyncChip('Offline', 'danger');
      app.updateSyncUi();
      if (reason === 'manual') {
        app.showMessage('Sem internet agora. A fila continua salva no aparelho.', 'danger');
      }
      return Promise.resolve(false);
    }
    if (app.shouldSkipAutoSync(reason)) {
      app.setSyncChip('Fila salva', 'warn');
      app.updateSyncUi();
      return Promise.resolve(false);
    }
    return app.refreshOperationalSessionIfNeeded(reason === 'manual' ? 'manual-sync' : reason).then(function (hasAccess) {
      if (!hasAccess && !String(app.CONFIG.API_TOKEN || '').trim()) {
        app.setSyncChip('Login online necessário', 'warn');
        app.updateSyncUi();
        return false;
      }
      var systemState = app.readSystemState();
      var pending = app.readVisits().filter(function (visit) { return !visit.synced; });
    var pendingTubitos = typeof app.readTubitos === 'function'
      ? app.readTubitos().filter(function (row) { return row.synced === false; })
      : [];
    var pendingVisitIds = {};
    var pendingLogIds = {};
    var pendingTubitoIds = {};
    var pendingSupervisionRequests = typeof app.getUnsyncedSupervisionRequests === 'function' ? app.getUnsyncedSupervisionRequests() : [];
    var pendingLocationTrail = typeof app.getUnsyncedLocationTrail === 'function' ? app.getUnsyncedLocationTrail() : [];
    var pendingSupervisionIds = {};
    var pendingLocationTrailIds = {};
    var dirtyPropertyIds = app.readDirtyPropertyIds ? app.readDirtyPropertyIds().slice() : [];
    pending.forEach(function (visit) {
      if (visit.uid) {
        pendingVisitIds[visit.uid] = true;
      }
    });
    pendingTubitos.forEach(function (row) {
      if (row.uid) {
        pendingTubitoIds[row.uid] = true;
      }
    });
    pendingSupervisionRequests.forEach(function (row) {
      if (row && row.uid) {
        pendingSupervisionIds[row.uid] = true;
      }
    });
    pendingLocationTrail.forEach(function (row) {
      if (row && row.uid) {
        pendingLocationTrailIds[row.uid] = true;
      }
    });
    app.getUnsyncedLogs().forEach(function (logEntry) {
      if (logEntry && logEntry.uid) {
        pendingLogIds[logEntry.uid] = true;
      }
    });
    var syncPayload = app.buildSyncPayload();
    var sentVisitIds = {};
    var sentTubitoIds = {};
    (syncPayload.visits || []).forEach(function (row) {
      if (row && row.uid) {
        sentVisitIds[row.uid] = true;
      }
    });
    (syncPayload.tubitos || []).forEach(function (row) {
      if (row && row.uid) {
        sentTubitoIds[row.uid] = true;
      }
    });
    var blockedVisits = Array.isArray(syncPayload.sync_validation && syncPayload.sync_validation.visits_blocked)
      ? syncPayload.sync_validation.visits_blocked
      : [];
    var blockedTubitos = Array.isArray(syncPayload.sync_validation && syncPayload.sync_validation.tubitos_blocked)
      ? syncPayload.sync_validation.tubitos_blocked
      : [];
    var hasPendingState = !!systemState.pendingSync;
    var pendingTotal = syncPayload.visits.length + syncPayload.tubitos.length + pendingSupervisionRequests.length + (syncPayload.location_trail || []).length + dirtyPropertyIds.length;
    var blockedTotal = blockedVisits.length + blockedTubitos.length;
    var visiblePendingTotal = pendingTotal + blockedTotal;
    app.setSyncChip((visiblePendingTotal || hasPendingState) ? ('Sincronizando ' + visiblePendingTotal) : 'Sem pendência', (visiblePendingTotal || hasPendingState) ? 'accent' : 'ok');
    if (!pendingTotal && blockedTotal) {
      app.state.syncInFlight = false;
      app.setSyncChip('Pendência local', 'warn');
      app.updateSyncUi();
      if (reason === 'manual') {
        app.showMessage(blockedVisits.length + ' visita(s) e ' + blockedTubitos.length + ' tubito(s) ficaram na fila por validação local. Corrija os campos obrigatórios e tente novamente.', 'warn');
      }
      return Promise.resolve(false);
    }
    if (!pendingTotal && !hasPendingState) {
      app.updateSyncUi();
      if (reason === 'manual') {
        app.showMessage('Sem pendências. Está tudo em dia com a Nuvem.', 'ok');
      }
      return Promise.resolve(true);
    }
    app.state.syncInFlight = true;
    app.updateSyncUi();
    return app.fetchWithTimeout(app.CONFIG.SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(syncPayload)
    }, app.CONFIG.SYNC_TIMEOUT_MS).then(function (response) {
      if (!response.ok) {
        var httpError = new Error('Falha ao sincronizar');
        throw httpError;
      }
      return response.json().catch(function () {
        throw new Error('Resposta inválida da Nuvem.');
      });
    }).then(function (payload) {
      if (payload && payload.ok === false) {
        throw new Error(payload.error || 'Falha ao sincronizar');
      }
      if (!payload || payload.ok !== true) {
        throw new Error('A Nuvem não confirmou a sincronização.');
      }
      var visitStatuses = Array.isArray(payload.visit_statuses) ? payload.visit_statuses : null;
      var tubitoStatuses = Array.isArray(payload.tubito_statuses) ? payload.tubito_statuses : null;
      var supervisionStatuses = Array.isArray(payload.supervision_statuses) ? payload.supervision_statuses : null;
      var locationTrailStatuses = Array.isArray(payload.location_trail_statuses) ? payload.location_trail_statuses : null;
      var statusByUid = {};
      var tubitoStatusByUid = {};
      var supervisionStatusByUid = {};
      if (visitStatuses) {
        visitStatuses.forEach(function (item) {
          if (item && item.uid) {
            statusByUid[item.uid] = item;
          }
        });
      }
      if (tubitoStatuses) {
        tubitoStatuses.forEach(function (item) {
          if (item && item.uid) {
            tubitoStatusByUid[item.uid] = item;
          }
        });
      }
      if (supervisionStatuses) {
        supervisionStatuses.forEach(function (item) {
          if (item && item.uid) {
            supervisionStatusByUid[item.uid] = item;
          }
        });
      }
      var visits = app.readVisits().map(function (visit) {
        var statusRow;
        if (!visit.uid || !sentVisitIds[visit.uid]) {
          return visit;
        }
        statusRow = visitStatuses ? statusByUid[visit.uid] : null;
        if (!visitStatuses || (statusRow && statusRow.ok !== false)) {
          visit.synced = true;
        }
        return visit;
      });
      app.saveVisits(visits);
      if (pendingTubitos.length && typeof app.markTubitosSyncedByUid === 'function') {
        if (tubitoStatuses) {
          var syncedTubitoIds = {};
          tubitoStatuses.forEach(function (item) {
            if (item && item.uid && item.ok !== false) {
              syncedTubitoIds[item.uid] = true;
            }
          });
          app.markTubitosSyncedByUid(syncedTubitoIds);
        } else {
          app.markTubitosSyncedByUid(sentTubitoIds);
        }
      }
      if (pendingSupervisionRequests.length && typeof app.markSupervisionRequestsSyncedByUid === 'function') {
        if (supervisionStatuses) {
          var syncedSupervisionIds = {};
          supervisionStatuses.forEach(function (item) {
            if (item && item.uid && item.ok !== false) {
              syncedSupervisionIds[item.uid] = true;
            }
          });
          app.markSupervisionRequestsSyncedByUid(syncedSupervisionIds);
        } else {
          app.markSupervisionRequestsSyncedByUid(pendingSupervisionIds);
        }
      }
      if (pendingLocationTrail.length && typeof app.markLocationTrailSyncedByUid === 'function') {
        if (locationTrailStatuses) {
          var syncedTrailIds = {};
          locationTrailStatuses.forEach(function (item) {
            if (item && item.uid && item.ok !== false) {
              syncedTrailIds[item.uid] = true;
            }
          });
          app.markLocationTrailSyncedByUid(syncedTrailIds);
        } else {
          app.markLocationTrailSyncedByUid(pendingLocationTrailIds);
        }
      }
      var propertyStatusResult = typeof app.applyPropertySyncStatuses === 'function'
        ? app.applyPropertySyncStatuses(Array.isArray(payload.property_statuses) ? payload.property_statuses : [])
        : { cleared: dirtyPropertyIds.slice(), conflicts: 0 };
      if (!Array.isArray(payload.property_statuses) && dirtyPropertyIds.length) {
        app.clearDirtyPropertyIds(dirtyPropertyIds);
      }
      if (Object.keys(pendingLogIds).length) {
        app.markLogsSynced(pendingLogIds);
      }
      app.state.nextAutoSyncAt = 0;
      app.saveSystemState({ lastSyncAt: new Date().toISOString(), lastSyncError: '', pendingSync: false, pendingReason: '', deletedAgentRecords: [] });
      app.addLog('sync', 'success', '', pending.length + ' visita(s), ' + pendingTubitos.length + ' tubito(s), ' + pendingSupervisionRequests.length + ' supervisão(ões) e ' + pendingLocationTrail.length + ' ponto(s) de rota enviados.');
      app.setSyncChip('Sincronizado', 'ok');
      app.state.syncInFlight = false;
      app.renderAll();
      app.updateSyncUi();
      var successMessage = reason === 'visit'
        ? 'Visita salva e enviada para a Nuvem.'
        : (reason === 'agent' || reason === 'agent-delete'
          ? 'Cadastro de agentes atualizado na base.'
          : 'Dados enviados para a Nuvem.');
      if (blockedVisits.length || blockedTubitos.length) {
        successMessage += ' ' + blockedVisits.length + ' visita(s) e ' + blockedTubitos.length + ' tubito(s) permaneceram na fila por validação local.';
      }
      if (propertyStatusResult.conflicts > 0) {
        successMessage += ' ' + propertyStatusResult.conflicts + ' cadastro(s) de imóvel ficaram em conflito e continuam salvos no aparelho para revisão.';
      }
      app.showMessage(successMessage, propertyStatusResult.conflicts > 0 ? 'warn' : 'ok');
      if (reason === 'close-day') {
        return true;
      }
      app.bootstrapFromServer();
      return true;
    }).catch(function (error) {
      app.state.syncInFlight = false;
      if (typeof app.isOperationalAccessErrorMessage === 'function' && app.isOperationalAccessErrorMessage(error && error.message ? error.message : error)) {
        app.handleOperationalAuthFailure(error && error.message ? error.message : error, reason);
        return false;
      }
      return app.confirmRemoteSyncAfterUncertainFailure(syncPayload.visits, sentVisitIds).then(function (confirmed) {
        if (confirmed) {
          app.markVisitsSyncedByUid(sentVisitIds);
          app.state.nextAutoSyncAt = 0;
          app.saveSystemState({ lastSyncAt: new Date().toISOString(), lastSyncError: '', pendingSync: false, pendingReason: '', deletedAgentRecords: [] });
          app.addLog('sync', 'confirmed_remote', '', (syncPayload.visits || []).length + ' visita(s) confirmadas na Nuvem após falha de resposta. Tubitos sem confirmação direta permanecem na fila.');
          app.setSyncChip('Sincronizado', 'ok');
          app.renderAll();
          app.updateSyncUi();
          app.showMessage(
            reason === 'visit'
              ? 'Visita salva e confirmada na Nuvem.'
              : (reason === 'agent' || reason === 'agent-delete'
                ? 'Cadastro de agentes confirmado na base.'
                : 'Visitas confirmadas na Nuvem. Tubitos sem confirmação direta permanecem na fila se necessário.'),
            'ok'
          );
          if (reason === 'close-day') {
            return true;
          }
          app.bootstrapFromServer();
          return true;
        }

        app.pauseAutoSyncAfterFailure(reason);
        var syncErrorMessage = error && error.message ? String(error.message) : 'Falha na sincronização';
        var syncWarningText = reason === 'agent' || reason === 'agent-delete'
          ? 'Agente salvo no aparelho, mas não foi possível atualizar a base agora. Tente novamente com internet.'
          : 'Sem conexão confiável agora. ' + app.getUnsyncedVisits().length + ' registro(s) seguem salvos no aparelho para enviar depois.';
        if (syncErrorMessage && !/^(Tempo de conexão|Failed to fetch|Falha ao sincronizar)$/i.test(syncErrorMessage)) {
          syncWarningText += ' Detalhe: ' + syncErrorMessage;
        }
        app.saveSystemState({ lastSyncError: syncErrorMessage });
        app.setSyncChip('Fila salva', 'warn');
        app.updateSyncUi();
        app.showMessage(syncWarningText, 'warn');
        app.renderSyncCenter();
        return false;
      });
    });
  });
  };

  app.refreshOperationPlanBeforeSync = function () {
    if (!(window.ACEOperationMode && typeof window.ACEOperationMode.refresh === 'function')) {
      return Promise.resolve(false);
    }

    return window.ACEOperationMode.refresh({ force: true }).then(function () {
      if (typeof app.renderAll === 'function') { app.renderAll(); }
      if (typeof app.renderOfflineReadinessCard === 'function') { app.renderOfflineReadinessCard(); }
      return true;
    }).catch(function () {
      if (typeof app.renderOfflineReadinessCard === 'function') { app.renderOfflineReadinessCard(); }
      return false;
    });
  };

  app.syncNow = function () {
    app.updateSyncUi();
    app.showMessage('Verificando Nuvem e conferindo o plano operacional...', 'accent');
    return app.refreshOperationPlanBeforeSync().then(function () {
      return app.tryAutoSync('manual');
    });
  };


  app.captureSupervisionGps = function () {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error('GPS não disponível neste aparelho.'));
        return;
      }
      app.captureBestGpsPosition().then(function (gps) {
        var territory = app.resolveTerritoryByGps ? app.resolveTerritoryByGps(gps) : null;
        app.saveSystemState({
          gpsPermissionState: 'granted',
          lastKnownGps: Object.assign({}, gps, {
            capturedAt: new Date().toISOString(),
            source: 'supervision_request'
          })
        });
        app.saveLocationTrailFromGps(gps, 'supervision', { eventLabel: 'Solicitação de supervisão' });
        resolve({ gps: gps, territory: territory });
      }).catch(function (error) {
        if (error && error.code === 1) {
          app.saveSystemState({ gpsPermissionState: 'denied' });
          reject(new Error('Permissão de localização negada. Ative o GPS para solicitar supervisão.'));
          return;
        }
        reject(error && error.message ? error : new Error('Não foi possível capturar a localização para solicitar supervisão.'));
      });
    });
  };


  app.askSupervisionReason = function () {
    var options = [
      'Apoio em campo',
      'Imóvel fechado recorrente',
      'Recusa do morador',
      'Depósito de difícil acesso',
      'Apoio técnico',
      'Conflito ou risco',
      'Outro'
    ];
    var message = 'Motivo da solicitação de supervisão:\n\n' + options.map(function (option, index) {
      return (index + 1) + ' - ' + option;
    }).join('\n') + '\n\nDigite o número ou escreva o motivo:';
    var answer = window.prompt ? window.prompt(message, '1') : '1';
    if (answer === null) return '';
    answer = String(answer || '').trim();
    var numeric = Number(answer);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= options.length) {
      return options[numeric - 1];
    }
    return answer || options[0];
  };

  app.requestSupervision = function () {
    var button = document.getElementById('requestSupervisionBtn');
    var currentAgent = app.state.currentAgent || (app.readSession && app.readSession()) || {};
    if (!currentAgent || !currentAgent.nome) {
      app.showMessage('Faça login antes de solicitar supervisão.', 'warn');
      return Promise.resolve(false);
    }
    var supervisionReason = app.askSupervisionReason ? app.askSupervisionReason() : 'Apoio em campo';
    if (!supervisionReason) {
      app.showMessage('Solicitação de supervisão cancelada.', 'warn');
      return Promise.resolve(false);
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'Capturando GPS...';
    }
    app.showMessage('Capturando localização para solicitar supervisão...', 'accent');

    function saveLocalSupervisionRequest(payload, sent) {
      var localRow = Object.assign({}, payload, {
        operationMode: payload.operation_mode || payload.operationMode || 'VD',
        gpsLat: payload.gps_lat,
        gpsLng: payload.gps_lng,
        gpsAcc: payload.gps_acc,
        gpsTerritory: payload.gps_territory || '',
        gpsQuarteirao: payload.gps_quarteirao || '',
        synced: sent === true,
        updatedAt: new Date().toISOString()
      });
      if (typeof app.upsertSupervisionRequest === 'function') {
        app.upsertSupervisionRequest(localRow);
      }
      if (typeof app.updateSyncUi === 'function') {
        app.updateSyncUi();
      }
      if (typeof app.renderSyncCenter === 'function') {
        app.renderSyncCenter();
      }
    }

    return app.captureSupervisionGps().then(function (result) {
      var now = new Date();
      var hora = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      var modeLabel = app.getCurrentOperationModeLabel ? app.getCurrentOperationModeLabel() : 'VD';
      var payload = {
        action: 'supervision_request',
        token: String(app.CONFIG.API_TOKEN || '').trim(),
        api_token: String(app.CONFIG.API_TOKEN || '').trim(),
        auth_token: (app.getCurrentApiSessionToken ? app.getCurrentApiSessionToken() : '') || String(app.CONFIG.API_TOKEN || '').trim(),
        session_token: app.getCurrentApiSessionToken ? app.getCurrentApiSessionToken() : '',
        uid: app.createId('SUP'),
        data: app.todayISO(),
        hora: hora,
        agente: currentAgent.nome || '',
        matricula: currentAgent.matricula || '',
        operation_mode: modeLabel,
        mensagem: supervisionReason,
        status: 'Aberta',
        gps_lat: result.gps.lat,
        gps_lng: result.gps.lng,
        gps_acc: result.gps.accuracy,
        gps_territory: result.territory ? result.territory.territoryName : '',
        gps_quarteirao: result.territory ? result.territory.quarteirao : '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      if (!app.CONFIG.SHEETS_WEBAPP_URL || navigator.onLine === false) {
        saveLocalSupervisionRequest(payload, false);
        app.showMessage('Solicitação de supervisão salva no aparelho. Será enviada quando houver internet.', 'warn');
        return false;
      }

      if (button) {
        button.textContent = 'Enviando...';
      }
      return app.fetchWithTimeout(app.CONFIG.SHEETS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }, Math.min(Number(app.CONFIG.SYNC_TIMEOUT_MS || 30000), 20000)).then(function (response) {
        if (!response.ok) {
          throw new Error('Falha ao enviar solicitação.');
        }
        return response.json().catch(function () {
          throw new Error('Resposta inválida da Nuvem.');
        });
      }).then(function (responsePayload) {
        if (!responsePayload || responsePayload.ok === false) {
          throw new Error((responsePayload && responsePayload.error) || 'A Nuvem não confirmou a solicitação.');
        }
        saveLocalSupervisionRequest(payload, true);
        app.showMessage('Solicitação de supervisão enviada. O supervisor verá sua localização no painel.', 'ok');
        return true;
      }).catch(function (error) {
        saveLocalSupervisionRequest(payload, false);
        app.showMessage((error && error.message ? error.message + ' ' : '') + 'Solicitação salva no aparelho para enviar depois.', 'warn');
        return false;
      });
    }).catch(function (error) {
      app.showMessage(error && error.message ? error.message : 'Não foi possível capturar GPS para solicitar supervisão.', 'danger');
      return false;
    }).finally(function () {
      if (button) {
        button.disabled = false;
        button.textContent = 'Solicitar supervisão';
      }
    });
  };

  app.reportTile = function (label, value) {
    return '<div class="tile"><small>' + app.escapeHtml(label) + '</small><strong>' + app.escapeHtml(String(value)) + '</strong></div>';
  };

  app.buildTubitoRegistry = function (visits) {
    var list = [];
    (Array.isArray(visits) ? visits.slice() : []).sort(function (a, b) {
      return (String(a.data || '') + ' ' + String(a.hora || '')).localeCompare(String(b.data || '') + ' ' + String(b.hora || ''));
    }).forEach(function (visit) {
      var tubitoRows = typeof app.getTubitosForVisit === 'function' ? app.getTubitosForVisit(visit) : [];
      var fallbackMap = app.getTubitosByDeposit(visit);
      var pushRow = function (codeValue, depositCode) {
        var depositText = depositCode && app.DEPOSITS[depositCode] ? (depositCode + ' - ' + app.DEPOSITS[depositCode]) : (depositCode || '-');
        list.push({
          code: codeValue || String(list.length + 1).padStart(3, '0'),
          operation: app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD'),
          agent: visit.agente || '-',
          address: [visit.logradouro, visit.numero, visit.bairro].filter(Boolean).join(', ') || '-',
          deposit: depositText,
          microarea: visit.microarea || '-',
          quarteirao: visit.quarteirao || '-',
          date: app.formatDateBR(visit.data),
          time: visit.hora || '-'
        });
      };

      if (tubitoRows.length) {
        tubitoRows.forEach(function (row) {
          pushRow(row.numeroTubito, row.depositoCodigo || '');
        });
        return;
      }

      Object.keys(app.DEPOSITS).forEach(function (depositCode) {
        var qty = Math.max(0, Number(fallbackMap[depositCode] || 0));
        var idx;
        for (idx = 0; idx < qty; idx += 1) {
          pushRow(String(list.length + 1).padStart(3, '0'), depositCode);
        }
      });
    });
    return list;
  };

  app.writeReportWindow = function (opened, html, autoPrint) {
    if (!opened) {
      return false;
    }
    opened.document.open();
    opened.document.write(html);
    opened.document.close();
    opened.focus();
    if (autoPrint !== false) {
      setTimeout(function () { opened.print(); }, 600);
    }
    return true;
  };

  app.buildDailyReportHtml = function (snapshot, options) {
    var reportOptions = options || {};
    var visits = snapshot && Array.isArray(snapshot.visits) ? snapshot.visits.slice().sort(app.compareVisitDesc) : [];
    var tubitos = app.buildTubitoRegistry(visits);
    var deposits = Object.keys(app.DEPOSITS).map(function (code) {
      return {
        code: code,
        label: app.DEPOSITS[code],
        total: Number((snapshot && snapshot.depositRanking && snapshot.depositRanking[code]) || 0),
        focus: Number((snapshot && snapshot.depositFocusRanking && snapshot.depositFocusRanking[code]) || 0)
      };
    }).filter(function (row) {
      return row.focus > 0;
    });
    var totals = snapshot ? snapshot.totals : {
      opened: 0,
      closed: 0,
      totalProperties: 0,
      recovered: 0,
      visitedProperties: 0,
      pending: 0,
      tubitos: 0,
      depositsWithFocus: 0,
      deposits: 0,
      depositsEliminated: 0,
      infestationRate: 0
    };
    var generatedAt = reportOptions.generatedAt instanceof Date ? reportOptions.generatedAt : new Date();
    var currentAgent = reportOptions.currentAgent || app.state.currentAgent || null;
    var title = reportOptions.title || 'Relatório diário ACE Campo';
    var uniqueAgents = visits.reduce(function (acc, visit) {
      var key = String(visit.agente || '').trim();
      if (key && acc.indexOf(key) === -1) {
        acc.push(key);
      }
      return acc;
    }, []);
    var operationSummary = ['VD', 'PE', 'LIRAA'].map(function (mode) {
      return {
        mode: mode,
        label: app.getOperationModeLabel ? app.getOperationModeLabel(mode) : mode,
        visits: 0,
        focos: 0,
        tubitos: 0,
        depositsTreated: 0,
        bpiGrams: 0,
        depositsEliminated: 0
      };
    });
    var operationIndex = operationSummary.reduce(function (acc, row) {
      acc[row.mode] = row;
      return acc;
    }, {});

    visits.forEach(function (visit) {
      var mode = app.normalizeOperationMode ? app.normalizeOperationMode(visit.operationMode || 'VD') : String(visit.operationMode || 'VD');
      var row = operationIndex[mode] || operationIndex.VD;
      row.visits += 1;
      row.focos += Number(visit.focusQty || visit.depositFocusTotal || 0);
      row.tubitos += Number(visit.tubitosQty || 0);
      row.depositsTreated += app.getVisitTreatedDepositCount ? app.getVisitTreatedDepositCount(visit) : 0;
      row.bpiGrams += app.getVisitBpiGrams ? app.getVisitBpiGrams(visit) : 0;
      row.depositsEliminated += Number(visit.depositTotal || 0) || 0;
    });
    var indicators = [
      ['Abertos', totals.opened],
      ['Fechados', totals.closed],
      ['VD', operationIndex.VD.visits],
      ['P.E.', operationIndex.PE.visits],
      ['LIRAa', operationIndex.LIRAA.visits],
      ['Total', totals.totalProperties],
      ['Recuperados', totals.recovered],
      ['Trabalhados', totals.visitedProperties],
      ['Pendências', totals.pending],
      ['Tubitos', totals.tubitos],
      ['Depósitos com foco', totals.depositsWithFocus],
      ['Depósitos tratados', totals.depositsTreated || 0],
      ['BPI aplicado (g)', totals.bpiGrams || 0],
      ['Depósitos eliminados', totals.depositsEliminated || Number(totals.deposits || 0) || 0],
      ['Total de depósitos', totals.deposits],
      ['Índice de infestação', totals.infestationRate + '%']
    ];

    function buildWaterText(visit) {
      return app.buildWaterAccessText(visit);
    }

    function buildVisitNote(visit) {
      var notes = [];
      var waterText = buildWaterText(visit);
      if (visit.closedReason) {
        notes.push('Fechado: ' + visit.closedReason);
      }
      if (visit.waterAccess) {
        notes.push('Cx d’água: ' + waterText);
      }
      if (visit.attendedBy) {
        notes.push('Atendeu: ' + visit.attendedBy);
      }
      if (visit.obs) {
        notes.push(visit.obs);
      }
      return notes.join(' • ') || '-';
    }

    return '' +
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>' + app.escapeHtml(title) + '</title>' +
      '<style>' +
        '@page{size:A4 portrait;margin:7mm;}' +
        'body{font-family:Arial,sans-serif;margin:0;color:#182127;font-size:10px;line-height:1.25;background:#fff;}' +
        '.page{padding:6px 8px 10px;}' +
        '.head{display:grid;grid-template-columns:1.4fr 1fr;gap:10px;align-items:end;border-bottom:2px solid #1b4b36;padding-bottom:6px;}' +
        '.head h1{margin:0;font-size:18px;color:#163b2c;}' +
        '.head .sub{margin-top:3px;color:#5d6a73;font-size:10px;}' +
        '.meta-box{border:1px solid #d6dfe2;border-radius:10px;padding:6px 8px;background:#f8fbf9;}' +
        '.meta-line{margin:2px 0;}' +
        '.section{margin-top:8px;page-break-inside:avoid;}' +
        '.section h2{margin:0 0 4px;font-size:11px;color:#163b2c;text-transform:uppercase;letter-spacing:.04em;}' +
        '.tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;}' +
        '.tile-mini{border:1px solid #d6dfe2;border-radius:8px;padding:5px 6px;background:#fbfcfc;}' +
        '.tile-mini small{display:block;color:#60707a;font-size:8px;text-transform:uppercase;letter-spacing:.04em;}' +
        '.tile-mini strong{display:block;margin-top:2px;font-size:14px;color:#163b2c;}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed;}' +
        'th,td{border:1px solid #d6dfe2;padding:3px 4px;vertical-align:top;word-break:break-word;}' +
        'th{background:#edf5f0;color:#1c3f30;font-size:8px;text-transform:uppercase;letter-spacing:.04em;}' +
        'td{font-size:9px;}' +
        '.empty{color:#66727c;text-align:center;}' +
        '.muted{color:#66727c;}' +
        '.report-actions{position:sticky;top:0;z-index:10;display:flex;justify-content:flex-end;gap:8px;padding:8px;background:#f4faf6;border-bottom:1px solid #d6dfe2;}' +
        '.report-actions button{border:1px solid #b9c9c1;border-radius:8px;background:#fff;color:#163b2c;font-weight:700;padding:8px 12px;cursor:pointer;}' +
        '.report-actions button.primary{background:#1b4b36;color:#fff;border-color:#1b4b36;}' +
        '@media print{.report-actions{display:none}.page{padding:0}}' +
      '</style></head><body>' +
      '<div class="report-actions">' +
        '<button class="primary" type="button" onclick="window.print()">Imprimir / salvar PDF</button>' +
        '<button type="button" onclick="window.close()">Fechar</button>' +
      '</div>' +
      '<div class="page">' +
        '<div class="head">' +
          '<div>' +
            '<h1>' + app.escapeHtml(title) + '</h1>' +
            '<div class="sub">Data de referência: ' + app.escapeHtml(app.formatDateBR(app.todayISO())) + ' • Gerado em ' + app.escapeHtml(generatedAt.toLocaleString('pt-BR')) + '</div>' +
          '</div>' +
          '<div class="meta-box">' +
            '<div class="meta-line"><strong>Encerrado por:</strong> ' + app.escapeHtml(currentAgent ? currentAgent.nome : '-') + '</div>' +
            '<div class="meta-line"><strong>Agentes no relatório:</strong> ' + app.escapeHtml(uniqueAgents.length ? uniqueAgents.join(' • ') : '-') + '</div>' +
            '<div class="meta-line"><strong>Visitas lançadas:</strong> ' + app.escapeHtml(String(visits.length)) + '</div>' +
            '<div class="meta-line"><strong>Tubitos identificados:</strong> ' + app.escapeHtml(String(tubitos.length)) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="section">' +
          '<h2>Indicadores do dia</h2>' +
          '<div class="tiles">' +
            indicators.map(function (item) {
              return '<div class="tile-mini"><small>' + app.escapeHtml(item[0]) + '</small><strong>' + app.escapeHtml(String(item[1])) + '</strong></div>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="section">' +
          '<h2>Tipo de trabalho</h2>' +
          '<table><thead><tr><th>Operação</th><th>Visitas</th><th>Focos</th><th>Tubitos</th><th>Dep. tratados</th><th>BPI (g)</th><th>Dep. eliminados</th></tr></thead><tbody>' +
            operationSummary.map(function (row) {
              return '<tr>' +
                '<td><strong>' + app.escapeHtml(row.label) + '</strong></td>' +
                '<td>' + app.escapeHtml(String(row.visits)) + '</td>' +
                '<td>' + app.escapeHtml(String(row.focos)) + '</td>' +
                '<td>' + app.escapeHtml(String(row.tubitos)) + '</td>' +
                '<td>' + app.escapeHtml(String(row.depositsTreated || 0)) + '</td>' +
                '<td>' + app.escapeHtml(String(row.bpiGrams || 0)) + '</td>' +
                '<td>' + app.escapeHtml(String(row.depositsEliminated)) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody></table>' +
        '</div>' +

        '<div class="section">' +
          '<h2>Depósitos do dia</h2>' +
          '<table><thead><tr><th style="width:10%">Código</th><th style="width:54%">Descrição</th><th style="width:18%">Encontrados</th><th style="width:18%">Positivos</th></tr></thead><tbody>' +
            deposits.map(function (row) {
              return '<tr>' +
                '<td><strong>' + app.escapeHtml(row.code) + '</strong></td>' +
                '<td>' + app.escapeHtml(row.label) + '</td>' +
                '<td>' + app.escapeHtml(String(row.total)) + '</td>' +
                '<td>' + app.escapeHtml(String(row.focus)) + '</td>' +
              '</tr>';
            }).join('') +
            '<tr>' +
              '<td colspan="2"><strong>Total do dia</strong></td>' +
              '<td><strong>' + app.escapeHtml(String(totals.deposits)) + '</strong></td>' +
              '<td><strong>' + app.escapeHtml(String(totals.depositsWithFocus)) + '</strong></td>' +
            '</tr>' +
          '</tbody></table>' +
        '</div>' +

        '<div class="section">' +
          '<h2>Resumo das visitas</h2>' +
          '<table><thead><tr><th style="width:10%">Data/Hora</th><th style="width:8%">Operação</th><th style="width:12%">Agente</th><th style="width:22%">Endereço</th><th style="width:9%">MA/Q</th><th style="width:9%">Situação</th><th style="width:11%">Depósitos</th><th style="width:7%">Tubitos</th><th style="width:12%">Resumo operacional</th></tr></thead><tbody>' +
            (visits.length ? visits.map(function (visit) {
              return '<tr>' +
                '<td>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</td>' +
                '<td>' + app.escapeHtml(app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD')) + '</td>' +
                '<td>' + app.escapeHtml(visit.agente || '-') + '</td>' +
                '<td>' + app.escapeHtml([visit.logradouro, visit.numero, visit.bairro].filter(Boolean).join(', ') || '-') + '</td>' +
                '<td>' + app.escapeHtml((visit.microarea || '-') + ' / ' + (visit.quarteirao || '-')) + '</td>' +
                '<td>' + app.escapeHtml(app.getVisitStatusLabel(visit.situacao)) + '</td>' +
                '<td>' + app.escapeHtml(visit.depositTotal + ' dep. • ' + visit.depositFocusTotal + ' pos. • ' + visit.focusQty + ' foco(s)') + '</td>' +
                '<td>' + app.escapeHtml(String(Number(visit.tubitosQty || 0))) + '</td>' +
                '<td>' + app.escapeHtml(buildVisitNote(visit)) + '</td>' +
              '</tr>';
            }).join('') : '<tr><td colspan="9" class="empty">Nenhuma visita registrada no dia.</td></tr>') +
          '</tbody></table>' +
        '</div>' +

        '<div class="section">' +
          '<h2>Tubitos identificados</h2>' +
          '<table><thead><tr><th style="width:8%">Nº</th><th style="width:12%">Data/Hora</th><th style="width:9%">Operacao</th><th style="width:13%">Agente</th><th style="width:26%">Endereço</th><th style="width:16%">Depósito</th><th style="width:9%">Microárea</th><th style="width:7%">Quarteirão</th></tr></thead><tbody>' +
            (tubitos.length ? tubitos.map(function (row) {
              return '<tr>' +
                '<td><strong>' + app.escapeHtml(row.code) + '</strong></td>' +
                '<td>' + app.escapeHtml(row.date + ' ' + row.time) + '</td>' +
                '<td>' + app.escapeHtml(row.operation || 'VD') + '</td>' +
                '<td>' + app.escapeHtml(row.agent) + '</td>' +
                '<td>' + app.escapeHtml(row.address) + '</td>' +
                '<td>' + app.escapeHtml(row.deposit) + '</td>' +
                '<td>' + app.escapeHtml(row.microarea) + '</td>' +
                '<td>' + app.escapeHtml(row.quarteirao) + '</td>' +
              '</tr>';
            }).join('') : '<tr><td colspan="8" class="empty">Nenhum tubito registrado no dia.</td></tr>') +
          '</tbody></table>' +
        '</div>' +

      '</div></body></html>';
  };

  app.getLocalDateFromValue = function (value) {
    var text = String(value || '').trim();
    var date;
    if (!text) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }
    date = new Date(text);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  };

  app.getLastDayClosedDate = function (systemState) {
    var state = systemState || app.readSystemState();
    return app.getLocalDateFromValue(state.lastDayClosedDate) ||
      app.getLocalDateFromValue(state.lastDayClosedAt);
  };

  app.clearLocalDayData = function (options) {
    var opts = options || {};
    var systemState = app.readSystemState();
    var keepClosedMark = opts.keepClosedMark !== false;
    var summary = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : { hasPending: !!app.getUnsyncedVisits().length, total: app.getUnsyncedVisits().length };

    if (summary.hasPending && opts.allowPendingClear !== true) {
      if (typeof app.showMessage === 'function') {
        app.showMessage('Dados pendentes preservados no aparelho. Sincronize antes de qualquer limpeza local.', 'warn');
      }
      return false;
    }

    // Proteção offline: encerrar dia ou voltar ao login nunca apaga produção de campo.
    // As visitas/tubitos permanecem no cache local e são apenas deduplicados/prunados pela regra de retenção.
    app.saveVisits(app.readVisits());
    if (typeof app.saveTubitos === 'function') {
      app.saveTubitos(app.readTubitos());
    }
    app.saveLogs(app.readLogs());
    app.saveSystemState({
      lastSyncError: '',
      pendingSync: false,
      pendingReason: '',
      lastDayClosedAt: keepClosedMark ? (systemState.lastDayClosedAt || '') : '',
      lastDayClosedDate: keepClosedMark ? app.getLastDayClosedDate(systemState) : '',
      suppressRemoteVisitsDate: '',
      gpsPermissionState: systemState.gpsPermissionState || '',
      lastKnownGps: systemState.lastKnownGps || null,
      weatherCache: systemState.weatherCache || null,
      lastWeatherError: systemState.lastWeatherError || ''
    });
    app.state.selectedPropertyId = '';
    app.state.editingVisitId = '';
    app.state.visit = app.createEmptyVisit();
    return true;
  };

  app.isDayClosedToday = function () {
    var systemState = app.readSystemState();
    var today = app.todayISO();
    return app.getLastDayClosedDate(systemState) === today;
  };

  app.ensureFreshWorkDay = function () {
    var today = app.todayISO();
    var systemState = app.readSystemState();
    var closedDate = app.getLastDayClosedDate(systemState);
    var visits = app.readVisits();
    var hasOnlyPastVisits = visits.length > 0 && visits.every(function (visit) {
      return visit.data !== today;
    });
    var hasUnsynced = visits.some(function (visit) {
      return !visit.synced;
    });

    if ((closedDate && closedDate < today) || (hasOnlyPastVisits && !hasUnsynced)) {
      app.clearLocalDayData({ keepClosedMark: false });
      return true;
    }
    if (closedDate && closedDate > today) {
      app.saveSystemState({ lastDayClosedAt: '', lastDayClosedDate: '' });
    }
    return false;
  };

  app.resetRoutineState = function () {
    app.state.selectedPropertyId = '';
    app.state.editingVisitId = '';
    app.state.editingPropertyId = '';
    app.state.territoryHint = null;
    app.state.visit = app.createEmptyVisit();
    app.state.visitFlowStep = 1;
    if (typeof app.updateVisitFormFromState === 'function') {
      app.updateVisitFormFromState();
    }
    if (typeof app.renderVisitWizard === 'function') {
      app.renderVisitWizard();
    }
  };

  app.startNewRoutineSession = function () {
    app.state.closeDayInFlight = false;
    app.ensureFreshWorkDay();
    if (app.isDayClosedToday() && !app.getUnsyncedVisits().length) {
      app.clearLocalDayData({ keepClosedMark: false });
      app.saveSystemState({ lastDayClosedAt: '', lastDayClosedDate: '', suppressRemoteVisitsDate: '' });
    }
    app.resetRoutineState();
  };

  app.markDayClosed = function () {
    app.saveSystemState({
      lastDayClosedAt: new Date().toISOString(),
      lastDayClosedDate: app.todayISO(),
      suppressRemoteVisitsDate: '',
      pendingSync: false,
      pendingReason: '',
      lastSyncError: ''
    });
  };

  app.finishClosedDaySession = function () {
    app.state.closeDayInFlight = false;
    app.clearLocalDayData({ keepClosedMark: true });
    app.returnToLogin(app.getLogoutFarewell(true), false);
  };


  app.getCloseDayPolicy = function () {
    var opApi = window.ACEOperationMode || null;
    if (opApi && typeof opApi.evaluateCloseDayPolicy === 'function') {
      return opApi.evaluateCloseDayPolicy();
    }
    return { allowed: true, requiresJustification: false, blocked: false, mode: 'VD', label: 'VD', closeAfter: '' };
  };

  app.requestEarlyCloseJustification = function () {
    return true;
  };

  app.closeDay = function () {
    var health = app.getServiceHealth ? app.getServiceHealth() : { queue: app.getUnsyncedVisits().length, queueTotal: app.getUnsyncedVisits().length };
    var pendingTotal = Number(health.queueTotal || health.queue || 0);
    var button = document.getElementById('closeDayBtn');
    if (app.state.closeDayInFlight) {
      return;
    }
    if (!app.isApiConfigured() || navigator.onLine === false) {
      app.showMessage('Para encerrar o dia, conecte o tablet à internet e sincronize todas as pendências. O trabalho continua salvo no aparelho.', 'danger');
      return;
    }
    if (!app.requestEarlyCloseJustification(app.getCloseDayPolicy())) {
      return;
    }
    if (pendingTotal) {
      var confirmed = window.confirm('Você possui ' + pendingTotal + ' item(ns) ainda não enviados. Deseja tentar sincronizar agora antes de encerrar o dia?');
      if (!confirmed) {
        app.showMessage('Encerramento cancelado. Sincronize os dados antes de finalizar o expediente.', 'warn');
        return;
      }
    }
    app.state.closeDayInFlight = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Encerrando...';
      button.title = 'Enviando e limpando a rotina do dia.';
    }
    app.tryAutoSync('close-day').then(function (ok) {
      if (!ok) {
        app.state.closeDayInFlight = false;
        if (typeof app.renderLocalPanel === 'function') {
          app.renderLocalPanel();
        }
        app.showMessage('Encerramento cancelado porque a sincronização falhou.', 'danger');
        return;
      }
      var remaining = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : { total: app.getUnsyncedVisits().length };
      if (Number(remaining.total || 0) > 0) {
        app.state.closeDayInFlight = false;
        if (typeof app.renderLocalPanel === 'function') {
          app.renderLocalPanel();
        }
        app.showMessage('Encerramento cancelado: ainda existem ' + remaining.total + ' item(ns) salvos no aparelho aguardando envio.', 'danger');
        return;
      }
      app.markDayClosed();
      app.finishClosedDaySession();
    }).catch(function () {
      app.state.closeDayInFlight = false;
      if (typeof app.renderLocalPanel === 'function') {
        app.renderLocalPanel();
      }
      app.showMessage('Encerramento cancelado porque houve falha inesperada ao sincronizar.', 'danger');
    });
  };

  app.generateDailyReport = function (options) {
    var reportOptions = options || {};
    var snapshot = reportOptions.snapshot || app.buildLocalSnapshot();
    var opened = reportOptions.reportWindow || window.open('', '_blank');
    var html = app.buildDailyReportHtml(snapshot, {
      title: reportOptions.title || 'Relatório diário individual ACE Campo',
      generatedAt: reportOptions.generatedAt || new Date(),
      currentAgent: reportOptions.currentAgent || app.state.currentAgent
    });
    if (!opened) {
      app.showMessage('Não foi possível abrir a janela do relatório.', 'danger');
      return false;
    }
    app.writeReportWindow(opened, html, reportOptions.autoPrint !== false);
    return true;
  };

  app.tryLogin = function () {
    var cpf = app.normalizeCpf(document.getElementById('loginCpf') ? document.getElementById('loginCpf').value : '');
    var password = String(document.getElementById('loginPassword').value || '').trim();
    var message = document.getElementById('loginMessage');
    var token;
    var payload;

    message.textContent = '';
    if (!cpf || !password) {
      message.textContent = 'Informe CPF e senha.';
      return;
    }
    if (cpf.length !== 11) {
      message.textContent = 'Informe um CPF com 11 números.';
      return;
    }

    function findLocalAgent() {
      return app.readAgents().find(function (item) {
        return app.normalizeCpf(item.cpf || '') === cpf && !app.shouldHideAgent(item);
      }) || null;
    }

    function finalizeLogin(person, mode) {
      var authenticatedAgent = app.normalizeAgent(Object.assign({}, person || {}, { cpf: cpf }));
      if (typeof app.isFieldAllowedRole === 'function' && !app.isFieldAllowedRole(authenticatedAgent.role || '')) {
        message.textContent = app.getFieldAccessDeniedMessage ? app.getFieldAccessDeniedMessage() : 'Este perfil não tem permissão para usar o aplicativo de campo.';
        app.state.currentAgent = null;
        app.saveSession(null);
        return false;
      }
      app.state.currentAgent = authenticatedAgent;
      app.saveSession(authenticatedAgent);
      app.saveSystemState({
        lastLoginAt: new Date().toISOString(),
        lastLoginMode: mode === 'offline' ? 'offline' : 'online',
        lastOfflinePreparedAt: mode === 'online' ? new Date().toISOString() : (app.readSystemState().lastOfflinePreparedAt || '')
      });
      if (typeof app.clearOfflineReadinessDismissal === 'function') {
        app.clearOfflineReadinessDismissal();
      }
      app.enterApp();
      if (mode === 'offline') {
        app.showMessage('Login offline realizado com sucesso. Os registros serão salvos no tablet e enviados quando houver internet.', 'accent');
      } else {
        app.showMessage('Login confirmado. Aguarde a checagem “Tudo ok para começar” antes de sair para campo.', 'accent');
      }
      if (typeof app.renderOfflineReadinessCard === 'function') {
        window.setTimeout(app.renderOfflineReadinessCard, 700);
      }
      if (mode !== 'offline' && typeof app.bootstrapFromServer === 'function') {
        window.setTimeout(function () {
          app.bootstrapFromServer().then(function () {
            if (typeof app.renderOfflineReadinessCard === 'function') {
              app.renderOfflineReadinessCard();
            }
          }).catch(function () {});
        }, 250);
      }
    }

    function tryLocalHash(reason) {
      var agent = findLocalAgent();
      var offlineAttempt = reason === 'offline' || reason === 'fallback';
      if (!agent) {
        message.textContent = offlineAttempt
          ? 'Este tablet ainda não está preparado para login offline. Faça um login com internet primeiro.'
          : 'Usuário ou senha inválidos.';
        return Promise.resolve(false);
      }
      if (typeof app.isFieldAllowedRole === 'function' && !app.isFieldAllowedRole(agent.role || '')) {
        message.textContent = app.getFieldAccessDeniedMessage ? app.getFieldAccessDeniedMessage() : 'Este perfil não tem permissão para usar o aplicativo de campo.';
        return Promise.resolve(false);
      }
      if (!agent.senhaHash) {
        message.textContent = 'Credencial local não encontrada. Conecte à internet para preparar este aparelho.';
        return Promise.resolve(false);
      }
      return app.hashText(password).then(function (passwordHash) {
        if (passwordHash !== agent.senhaHash) {
          message.textContent = 'Usuário ou senha inválidos. Se estiver sem internet, confira se este agente já fez login online neste aparelho.';
          return false;
        }
        finalizeLogin(agent, 'offline');
        return true;
      });
    }

    if (!app.isApiConfigured() || !navigator.onLine) {
      tryLocalHash('offline');
      return;
    }

    token = String(app.CONFIG.API_TOKEN || '').trim();
    payload = {
      action: 'login',
      cpf: cpf,
      senha: password,
      source: 'field-app'
    };
    if (token) {
      payload.token = token;
    }

    app.fetchWithTimeout(app.CONFIG.SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    }, Math.min(Number(app.CONFIG.BOOTSTRAP_TIMEOUT_MS || 45000), 20000)).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao autenticar');
      }
      return response.json();
    }).then(function (responsePayload) {
      if (!responsePayload || responsePayload.ok === false || responsePayload.authenticated === false) {
        message.textContent = (responsePayload && (responsePayload.error || responsePayload.message)) || 'Usuário ou senha inválidos.';
        return false;
      }
      return app.hashText(password).then(function (passwordHash) {
        var expiresInSeconds = Math.max(0, Number(responsePayload.expiresInSeconds || responsePayload.expires_in_seconds || 0));
        var serverAgent = app.normalizeAgent(Object.assign({}, responsePayload.agent || {}, {
          cpf: cpf,
          senhaHash: passwordHash,
          apiSessionToken: String(responsePayload.sessionToken || responsePayload.session_token || '').trim(),
          apiSessionExpiresAt: expiresInSeconds ? new Date(Date.now() + (expiresInSeconds * 1000)).toISOString() : ''
        }));
        if (serverAgent) {
          var agents = app.readAgents();
          var index = agents.findIndex(function (item) {
            return item.uid === serverAgent.uid ||
              app.normalizeLabel(item.matricula || '') === app.normalizeLabel(serverAgent.matricula || '') ||
              app.normalizeCpf(item.cpf || '') === cpf;
          });
          if (index > -1) {
            agents[index] = Object.assign({}, agents[index], serverAgent);
          } else {
            agents.push(serverAgent);
          }
          app.saveAgents(agents.filter(function (item) { return !app.isRemovedAgent(item); }));
          app.fillAgentSelect();
        }
        finalizeLogin(serverAgent, 'online');
        return true;
      });
    }).catch(function () {
      message.textContent = 'Sem resposta da Nuvem. Tentando login offline neste aparelho...';
      return tryLocalHash('fallback');
    });
  };

  app.openAdminFromLogin = function () {
    var message = document.getElementById('loginMessage');
    if (message) {
      message.textContent = 'Administração e cadastro ficam somente no painel de cadastro online.';
    }
  };


  app.tryQuickOpenAdminFromPanel = function (attempt) {
    var params = new URLSearchParams(window.location.search || '');
    var shouldOpenAdmin = params.get('openAdmin') === '1';
    var shouldOpenProperties = params.get('openProperties') === '1';
    var password;
    var agents;
    var adminAgent;
    var retries = Number(attempt || 0);

    if (!shouldOpenAdmin && !shouldOpenProperties) {
      return;
    }

    try {
      password = String(sessionStorage.getItem('ace_admin_quick_password') || '').trim();
    } catch (error) {
      password = '';
    }

    if (!password) {
      return;
    }

    agents = app.readAgents().filter(function (agent) {
      return app.isConfigurationAdmin(agent) || app.isManagerRole(agent.role);
    });
    adminAgent = agents.find(function (agent) { return app.isConfigurationAdmin(agent); }) || agents[0] || null;

    if (!adminAgent) {
      if (retries < 12) {
        window.setTimeout(function () { app.tryQuickOpenAdminFromPanel(retries + 1); }, 600);
      }
      return;
    }

    if (shouldOpenAdmin) {
      return;
    }

    if (shouldOpenProperties) {
      if (document.getElementById('loginScreen').classList.contains('hidden') && app.state.currentAgent) {
        app.showScreen('imoveis');
        return;
      }

      if (document.getElementById('loginCpf')) {
        document.getElementById('loginCpf').value = app.formatCpf(adminAgent.cpf || '11111111111');
      }
      if (document.getElementById('loginPassword')) {
        document.getElementById('loginPassword').value = password;
      }
      app.tryLogin();
    }
  };


  app.getDayPeriodGreeting = function () {
    var hour = new Date().getHours();
    if (hour < 12) {
      return 'Bom dia';
    }
    if (hour < 18) {
      return 'Boa tarde';
    }
    return 'Boa noite';
  };

  app.getDailyLoginGreeting = function (agent) {
    var person = agent || {};
    var firstName = String(person.nome || 'agente').trim().split(/\s+/)[0] || 'agente';
    var seedText = app.todayISO() + '|' + String(person.matricula || person.uid || firstName);
    var seed = 0;
    var messages = [
      'sua atenção hoje ajuda a proteger muitas famílias.',
      'um passo de cada vez, com cuidado e presença no território.',
      'que seu trabalho renda boas abordagens e visitas seguras.',
      'sua rotina em campo faz diferença real para a cidade.',
      'vamos fazer um dia produtivo, organizado e tranquilo.',
      'cada registro bem feito fortalece o combate à dengue.',
      'que o dia seja leve, seguro e cheio de bons resultados.',
      'seu olhar atento transforma informação em prevenção.',
      'obrigado por cuidar do território com responsabilidade.',
      'vamos seguir com foco, calma e bom trabalho em equipe.'
    ];
    var index;
    for (index = 0; index < seedText.length; index += 1) {
      seed = (seed + seedText.charCodeAt(index) * (index + 1)) % 9973;
    }
    return app.getDayPeriodGreeting() + ', ' + firstName + '. ' + messages[seed % messages.length];
  };

  app.enterApp = function () {
    var greeting;
    var quickOpenProperties = false;
    try {
      quickOpenProperties = sessionStorage.getItem('ace_admin_quick_open_properties') === '1';
    } catch (error) {}
    app.startNewRoutineSession();
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    document.getElementById('headerSubtitle').textContent = app.state.currentAgent.nome + ' • ' + app.state.currentAgent.matricula + ' • ' + (app.state.currentAgent.role || 'ACE');
    app.updateAdminAccessUi();
    app.restoreLastKnownGps();
    app.renderAll();
    app.showScreen(quickOpenProperties ? 'imoveis' : (app.state.selectedScreen || 'painel'));
    if (quickOpenProperties) {
      try {
        sessionStorage.removeItem('ace_admin_quick_open_properties');
      } catch (error) {}
    }
    app.maybeCaptureGpsOnEnter();
    app.startAgentLocationTrail();
    greeting = app.getDailyLoginGreeting(app.state.currentAgent);
    app.showMessage(greeting, 'accent');
  };

  app.getLogoutFarewell = function (isCloseDay) {
    var day = new Date().getDay();
    var opening = isCloseDay
      ? 'Dia encerrado com sucesso. Obrigado pelo seu trabalho hoje.'
      : 'Obrigado pelo seu trabalho hoje.';
    if (day === 5) {
      return opening + ' Descanse bem e volte com tranquilidade. Até segunda-feira.';
    }
    if (day === 6 || day === 0) {
      return opening + ' Tenha um ótimo descanso.';
    }
    return opening + ' Amanhã seguimos juntos. Até amanhã.';
  };

  app.returnToLogin = function (message, clearClosedDay) {
    var statusNode = document.getElementById('syncStatus');
    var loginMessageNode = document.getElementById('loginMessage');
    app.state.closeDayInFlight = false;
    if (statusNode) {
      if (typeof app.hideMessage === 'function') {
        app.hideMessage();
      } else {
        statusNode.textContent = '';
        statusNode.classList.add('is-hidden');
        statusNode.setAttribute('aria-hidden', 'true');
        statusNode.style.background = '#203028';
      }
    }
    if (app.loginMessageClearTimer) {
      clearTimeout(app.loginMessageClearTimer);
      app.loginMessageClearTimer = null;
    }
    if (clearClosedDay) {
      app.clearLocalDayData({ keepClosedMark: true });
    }
    if (typeof app.clearPropertyForm === 'function') {
      app.clearPropertyForm();
    }
    app.stopAgentLocationTrail('logout');
    app.state.currentAgent = null;
    app.state.selectedScreen = 'painel';
    app.resetRoutineState();
    app.saveSession(null);
    if (document.getElementById('loginCpf')) { document.getElementById('loginCpf').value = ''; }
    document.getElementById('loginPassword').value = '';
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    app.updateAdminAccessUi();
    app.fillAgentSelect();
    if (loginMessageNode) {
      loginMessageNode.textContent = message || '';
      if (message) {
        app.loginMessageClearTimer = window.setTimeout(function () {
          if (loginMessageNode.textContent === message) {
            loginMessageNode.textContent = '';
          }
          app.loginMessageClearTimer = null;
        }, 6000);
      }
    }
  };

  app.confirmExitWithPendingData = function () {
    var summary = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : { total: app.getUnsyncedVisits().length };
    var total = Number(summary && summary.total || 0);
    if (total <= 0) { return true; }
    return window.confirm(
      'Existem ' + total + ' item(ns) salvos no tablet e ainda não enviados. ' +
      'Você pode sair, mas não limpe os dados do navegador antes de sincronizar. Deseja sair mesmo assim?'
    );
  };

  app.logout = function () {
    if (!app.confirmExitWithPendingData()) {
      app.showMessage('Saída cancelada. Sincronize as pendências quando tiver internet.', 'warn');
      return;
    }
    app.returnToLogin(app.getLogoutFarewell(false), app.isDayClosedToday && app.isDayClosedToday());
  };

  app.registerServiceWorker = function () {
    if (typeof app.isPwaSecureContext === 'function' && !app.isPwaSecureContext()) {
      return Promise.resolve(false);
    }
    if (!('serviceWorker' in navigator)) {
      return Promise.resolve(false);
    }

    if (!app.state.serviceWorkerEventsBound && navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === 'function') {
      app.state.serviceWorkerEventsBound = true;
      navigator.serviceWorker.addEventListener('message', function (event) {
        var payload = event && event.data ? event.data : {};
        if (payload && payload.type === 'ACE_SW_UPDATED') {
          app.showMessage('Atualização do aplicativo disponível. Feche e abra novamente para usar a versão mais recente.', 'warn');
        }
      });
    }

    return navigator.serviceWorker.register('./sw-acs.js', { scope: './' }).then(function (registration) {
      if (registration && registration.update) {
        registration.update().catch(function () { return null; });
      }
      if (registration && typeof registration.addEventListener === 'function') {
        registration.addEventListener('updatefound', function () {
          app.showMessage('Baixando atualização do aplicativo. Seus dados pendentes no aparelho serão preservados.', 'accent');
        });
      }
      return registration || true;
    }).catch(function () {
      return false;
    });
  };

  app.enforceFixedViewport = function () {
    var meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
  };

  app.preventGestureZoom = function () {
    var lastTouchEnd = 0;

    document.addEventListener('dblclick', function (event) {
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('wheel', function (event) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('gesturestart', function (event) {
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturechange', function (event) {
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('gestureend', function (event) {
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (event) {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('touchstart', function (event) {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch' && event.isPrimary === false) {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('touchend', function (event) {
      var now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    document.documentElement.style.touchAction = 'pan-x pan-y';
    document.body.style.touchAction = 'pan-x pan-y';
    document.documentElement.style.msTouchAction = 'pan-x pan-y';
    document.body.style.msTouchAction = 'pan-x pan-y';
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', app.enforceFixedViewport);
    }
  };

  app.bindCpfInputMask = function (fieldId) {
    var field = document.getElementById(fieldId);
    if (!field || typeof app.formatCpfPartial !== 'function') {
      return;
    }
    field.setAttribute('maxlength', '14');
    field.setAttribute('inputmode', 'numeric');
    field.addEventListener('input', function () {
      var previousLength = field.value.length;
      field.value = app.formatCpfPartial(field.value);
      if (field.selectionStart === previousLength) {
        field.setSelectionRange(field.value.length, field.value.length);
      }
    });
    field.addEventListener('blur', function () {
      field.value = app.formatCpfPartial(field.value);
    });
  };

  app.runPanelAction = function (action) {
    var command = String(action || '').trim();
    if (command === 'start-visit') {
      if (typeof app.startSelectedPropertyVisit === 'function') {
        app.startSelectedPropertyVisit();
      } else {
        app.showScreen('visita');
      }
      return;
    }
    if (command === 'visit') {
      if (app.getSelectedProperty && app.getSelectedProperty()) {
        app.startSelectedPropertyVisit();
      } else {
        app.selectNextProperty(false);
      }
      return;
    }
    if (command === 'next') {
      app.selectNextProperty(false);
      return;
    }
    if (command === 'pending') {
      app.selectNextProperty(true);
      return;
    }
    if (command === 'properties') {
      app.showScreen('imoveis');
      return;
    }
    if (command === 'sync') {
      app.syncNow();
      return;
    }
    if (command === 'check-offline') {
      if (typeof app.renderOfflineReadinessCard === 'function') { app.renderOfflineReadinessCard(); }
      if (typeof app.renderPanelOfflineCommand === 'function') { app.renderPanelOfflineCommand(); }
      app.showMessage('Verificação offline atualizada.', 'accent');
      return;
    }
    app.showScreen('painel');
  };

  app.bindEvents = function () {
    app.bindCpfInputMask('loginCpf');
    document.getElementById('loginBtn').addEventListener('click', app.tryLogin);
    document.getElementById('logoutBtn').addEventListener('click', app.logout);
    document.getElementById('savePropertyBtn').addEventListener('click', app.savePropertyFromForm);
    if (document.getElementById('visitSavedPropertyBtn')) {
      document.getElementById('visitSavedPropertyBtn').addEventListener('click', app.savePropertyAndStartVisit);
    }
    document.getElementById('clearPropertyBtn').addEventListener('click', app.clearPropertyForm);
    document.getElementById('captureGpsBtn').addEventListener('click', function () { app.captureGps(true); });
    document.getElementById('captureGpsPropertyBtn').addEventListener('click', function () { app.captureGps(true, false, 'property'); });
    document.getElementById('refreshPropertiesBtn').addEventListener('click', function () { app.bootstrapFromServer(); });
    if (document.getElementById('goToPropertiesBtn')) {
      document.getElementById('goToPropertiesBtn').addEventListener('click', function () { app.showScreen('imoveis'); });
    }
    document.getElementById('saveVisitBtn').addEventListener('click', app.saveVisit);
    document.getElementById('cancelEditBtn').addEventListener('click', function () {
      app.state.editingVisitId = '';
      app.resetVisitForm();
      app.renderAll();
    });
    document.getElementById('syncNowBtn').addEventListener('click', app.syncNow);
    if (document.getElementById('requestSupervisionBtn')) {
      document.getElementById('requestSupervisionBtn').addEventListener('click', app.requestSupervision);
    }
    if (document.getElementById('headerSyncBtn')) {
      document.getElementById('headerSyncBtn').addEventListener('click', app.syncNow);
    }
    document.getElementById('dailyReportBtn').addEventListener('click', app.generateDailyReport);
    document.getElementById('closeDayBtn').addEventListener('click', app.closeDay);
    if (document.getElementById('offlineReadyRecheckBtn')) {
      document.getElementById('offlineReadyRecheckBtn').addEventListener('click', function () {
        if (typeof app.renderOfflineReadinessCard === 'function') { app.renderOfflineReadinessCard(); }
      });
    }
    if (document.getElementById('offlineReadyStartBtn')) {
      document.getElementById('offlineReadyStartBtn').addEventListener('click', function () {
        var card = document.getElementById('offlineReadinessCard');
        if (typeof app.dismissOfflineReadinessCard === 'function') {
          app.dismissOfflineReadinessCard();
        }
        if (card) {
          card.className = 'offline-ready-card is-dismissed';
          card.setAttribute('aria-hidden', 'true');
        }
        app.showScreen('visita');
      });
    }
    ['panelNextPrimaryBtn', 'panelNextSecondaryBtn'].forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) { return; }
      button.addEventListener('click', function () {
        app.runPanelAction(button.getAttribute('data-panel-action'));
      });
    });
    if (document.getElementById('nextPropertyBtn')) {
      document.getElementById('nextPropertyBtn').addEventListener('click', function () { app.selectNextProperty(false); });
    }
    if (document.getElementById('pendingPropertiesBtn')) {
      document.getElementById('pendingPropertiesBtn').addEventListener('click', function () { app.selectNextProperty(true); });
    }
    if (document.getElementById('routePropertyBtn')) {
      document.getElementById('routePropertyBtn').addEventListener('click', app.openRouteToSelectedProperty);
    }
    if (document.getElementById('exportBackupBtn')) {
      document.getElementById('exportBackupBtn').addEventListener('click', function () { app.exportLocalBackupJson(); });
    }
    if (document.getElementById('downloadQueueBtn')) {
      document.getElementById('downloadQueueBtn').addEventListener('click', function () { app.exportVisitsCsv(true); });
    }
    Array.from(document.querySelectorAll('.tab-btn')).forEach(function (button) {
      button.addEventListener('click', function () { app.showScreen(button.getAttribute('data-screen')); });
    });
    Array.from(document.querySelectorAll('[data-preset]')).forEach(function (button) {
      button.addEventListener('click', function () { app.applyPreset(button.getAttribute('data-preset')); });
    });
    ['visitDate', 'visitTime', 'visitTubitosQty', 'visitLarvicida', 'visitLarvicidaQty', 'visitAdulticida', 'visitAdulticidaQty', 'visitAttendedBy', 'visitClosedReason', 'visitWaterAccessReason', 'visitLadderSupportNoReason', 'visitWaterTankCondition', 'visitObs'].forEach(function (id) {
      var field = document.getElementById(id);
      var refreshDependentVisitFields = function () {
        app.syncVisitWithInputs();
        if (id === 'visitWaterAccessReason') {
          if (typeof app.renderLadderSupportField === 'function') {
            app.renderLadderSupportField();
          }
          if (typeof app.renderLadderSupportNoReasonField === 'function') {
            app.renderLadderSupportNoReasonField();
          }
        }
        app.createVisitSummary();
        app.renderVisitFieldGuide();
        app.renderVisitWizard();
        app.clearVisitStepWarning();
        app.renderHero();
      };
      if (!field) { return; }
      field.addEventListener('input', refreshDependentVisitFields);
      field.addEventListener('change', refreshDependentVisitFields);
    });
    if (document.getElementById('propMicroarea')) {
      document.getElementById('propMicroarea').addEventListener('change', app.handlePropertyMicroareaChange);
    }
    if (document.getElementById('propBairro')) {
      document.getElementById('propBairro').addEventListener('change', app.handlePropertyBairroChange);
    }
    if (document.getElementById('propLogradouro')) {
      document.getElementById('propLogradouro').addEventListener('input', app.renderPropertyStreetSuggestion);
      document.getElementById('propLogradouro').addEventListener('change', app.renderPropertyStreetSuggestion);
    }
    document.getElementById('propertySearch').addEventListener('input', app.renderProperties);
    document.getElementById('propertySort').addEventListener('change', app.renderProperties);

    document.addEventListener('click', function (event) {
      var choiceButton = event.target.closest('[data-choice-type]');
      var stepButton = event.target.closest('[data-step-target]');
      var depositButton = event.target.closest('[data-deposit]');
      var propertyEdit = event.target.closest('[data-property-edit]');
      var propertySelect = event.target.closest('[data-property-select]');
      var propertyStart = event.target.closest('[data-property-start]');
      var propertyQuickFilter = event.target.closest('[data-property-quick-filter]');
      var visitEdit = event.target.closest('[data-visit-edit]');
      var applyStreetSuggestion = event.target.closest('[data-apply-street-suggestion]');
      var visitStepNav = event.target.closest('[data-visit-step-nav]');
      if (visitStepNav) {
        app.goToVisitStep(Number(visitStepNav.getAttribute('data-visit-step-nav')), { force: false });
        return;
      }
      if (choiceButton) {
        var type = choiceButton.getAttribute('data-choice-type');
        var value = choiceButton.getAttribute('data-choice-value');
        if (type === 'situacao') {
          if (value === 'Recuperado' && !app.canMarkVisitRecovered(app.getSelectedProperty())) {
            app.showMessage(app.getRecoveredVisitBlockMessage(), 'danger');
            app.updateVisitFormFromState();
            return;
          }
          if (value === 'Visitado' || value === 'Fechado') {
            app.clearRecoveredVisitBlockMessage();
          }
          app.ensureVisitStartTime();
          app.state.visit.situacao = value;
          if (value === 'Fechado') {
          app.state.visit.focusFound = 'Não';
          app.state.visit.focusQty = 0;
          app.state.visit.depositFound = '';
          app.state.visit.tubitosQty = 0;
          app.state.visit.tubitosDeposit = '';
          app.state.visit.depositFocusCounts = app.emptyDepositMap();
          app.state.visit.depositTreatmentCounts = app.emptyDepositMap();
          app.state.visit.waterAccess = '';
            app.state.visit.waterAccessReason = '';
            app.state.visit.ladderSupportRequested = '';
            app.state.visit.ladderSupportNoReason = '';
            app.state.visit.waterTankCondition = '';
            app.state.visit.waterTreatment = '';
          } else {
            app.state.visit.closedReason = '';
          }
        } else if (type === 'deposit-found') {
          app.state.visit.depositFound = value;
          if (value === 'Não') {
            app.state.visit.depositCounts = app.emptyDepositMap();
            app.state.visit.depositFocusCounts = app.emptyDepositMap();
            app.state.visit.depositTreatmentCounts = app.emptyDepositMap();
            app.state.visit.focusFound = 'Não';
            app.state.visit.focusQty = 0;
            app.state.visit.tubitosQty = 0;
            app.state.visit.tubitosDeposit = '';
            app.state.visit.larvicida = 'Nenhum';
            app.state.visit.larvicidaQty = 0;
            app.state.visit.adulticida = 'Nenhum';
            app.state.visit.adulticidaQty = 0;
          }
        } else if (type === 'focus') {
          app.state.visit.focusFound = value;
          if (value === 'Sim') {
            app.state.visit.depositFound = 'Sim';
          }
          if (value === 'Não') {
            app.state.visit.focusQty = 0;
            app.state.visit.depositFocusCounts = app.emptyDepositMap();
          }
        } else if (type === 'water') {
          app.state.visit.waterAccess = value;
          if (value !== 'Não') {
            app.state.visit.waterAccessReason = '';
            app.state.visit.ladderSupportRequested = '';
            app.state.visit.ladderSupportNoReason = '';
          }
          if (value !== 'Sim') {
            app.state.visit.waterTankCondition = '';
            app.state.visit.waterTreatment = '';
          }
        } else if (type === 'ladder-support') {
          app.state.visit.ladderSupportRequested = value;
          if (value !== 'Não') {
            app.state.visit.ladderSupportNoReason = '';
          }
          if (value === 'Sim') {
            app.showMessage('Solicitação de escada marcada. Capturando GPS do imóvel para enviar ao painel...', 'accent');
            app.captureGps(true, true, 'ladder-support');
          }
        } else if (type === 'water-treatment') {
          app.state.visit.waterTreatment = value;
        }
        app.syncDerivedVisitFields();
        app.updateVisitFormFromState();
        app.renderVisitWizard();
        app.clearVisitStepWarning();
        app.renderHero();
      }
      if (stepButton) {
        if (stepButton.getAttribute('data-step-target') === 'visitTubitosQty' && stepButton.getAttribute('data-tubitos-deposit')) {
          app.changeTubitoDeposit(stepButton.getAttribute('data-tubitos-deposit'), Number(stepButton.getAttribute('data-step') || 0));
        } else {
          app.changeStepper(stepButton.getAttribute('data-step-target'), Number(stepButton.getAttribute('data-step') || 0));
        }
      }
      if (depositButton) {
        app.changeDeposit(depositButton.getAttribute('data-deposit'), depositButton.getAttribute('data-mode'), Number(depositButton.getAttribute('data-step') || 0));
      }
      if (propertyEdit) { app.loadPropertyIntoForm(propertyEdit.getAttribute('data-property-edit')); }
      if (propertySelect) { app.selectProperty(propertySelect.getAttribute('data-property-select')); }
      if (propertyStart) { app.startSelectedPropertyVisit(); }
      if (propertyQuickFilter) {
        app.state.propertyQuickFilter = propertyQuickFilter.getAttribute('data-property-quick-filter') || 'all';
        app.renderProperties();
      }
      if (applyStreetSuggestion) { app.applyPropertyStreetSuggestion(); }
      if (visitEdit) { app.loadVisitForEdit(visitEdit.getAttribute('data-visit-edit')); }
    });

    document.addEventListener('change', function (event) {
      var checkbox = event.target.closest('[data-deposit-check]');
      var treatmentCheckbox = event.target.closest('[data-deposit-treatment-check]');
      if (checkbox) {
        app.toggleDepositFocus(checkbox.getAttribute('data-deposit-check'), checkbox.checked);
      }
      if (treatmentCheckbox) {
        app.toggleDepositTreatment(treatmentCheckbox.getAttribute('data-deposit-treatment-check'), treatmentCheckbox.checked);
      }
    });

    window.addEventListener('online', function () {
      app.updateSyncUi();
      if (typeof app.clearOfflineReadinessDismissal === 'function') { app.clearOfflineReadinessDismissal(); }
      if (typeof app.renderOfflineReadinessCard === 'function') { app.renderOfflineReadinessCard(); }
      app.showMessage('Conectado. Vou conferir o plano operacional antes de enviar pendências.', 'accent');
      app.refreshOperationPlanBeforeSync().then(function () {
        return app.tryAutoSync('online');
      });
    });
    window.addEventListener('offline', function () {
      app.updateSyncUi();
      if (typeof app.renderOfflineReadinessCard === 'function') { app.renderOfflineReadinessCard(); }
      app.showMessage('Sem internet. Os registros serão salvos no tablet e enviados depois. Não limpe os dados do app antes de sincronizar.', 'danger');
    });
    window.addEventListener('beforeunload', function (event) {
      if (app.state.currentAgent && typeof app.recordLocationTrailPoint === 'function') {
        app.recordLocationTrailPoint('app_close', null, { eventLabel: 'App fechado' });
      }
      var summary = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : { total: app.getUnsyncedVisits().length };
      if (Number(summary.total || 0) > 0) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  };

  app.applySession = function () {
    var session = app.readSession();
    var restoredAgent = null;
    var loginCpfNode = document.getElementById('loginCpf');
    var loginPasswordNode = document.getElementById('loginPassword');
    var loginMessageNode = document.getElementById('loginMessage');
    if (session && session.uid) {
      restoredAgent = app.readAgents().find(function (agent) {
        return agent.uid === session.uid && !app.shouldHideAgent(agent);
      }) || null;
    }
    if (restoredAgent) {
      if (typeof app.isFieldAllowedRole === 'function' && !app.isFieldAllowedRole(restoredAgent.role || '')) {
        app.state.currentAgent = null;
        app.saveSession(null);
        restoredAgent = null;
      }
    }

    app.state.currentAgent = null;
    app.saveSession(null);
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    if (loginCpfNode) {
      loginCpfNode.value = restoredAgent && restoredAgent.cpf
        ? app.formatCpf(restoredAgent.cpf)
        : '';
    }
    if (loginPasswordNode) { loginPasswordNode.value = ''; }
    app.fillAgentSelect();
    if (loginMessageNode) {
      loginMessageNode.textContent = restoredAgent
        ? 'Sessão local encontrada. Informe a senha para continuar neste tablet.'
        : (app.readAgents().length ?
          'Informe CPF e senha para entrar.' :
          'Carregando estrutura de acesso...');
    }
  };

  app.startApp = function () {
    app.enforceFixedViewport();
    app.preventGestureZoom();
    app.registerServiceWorker();
    app.ensureDynamicLayout();
    app.ensureInitialAdminAgent();
    app.ensureConfigurationAdminAgent();
    app.cleanupRemovedAgents();
    app.ensureFreshWorkDay();
    app.fillPropertyFormOptions();
    app.fillAgentSelect();
    app.bindEvents();
    app.resetVisitForm();
    app.setSyncChip(app.isApiConfigured() ? 'Nuvem pronta' : 'Modo local', app.isApiConfigured() ? 'accent' : 'warn');
    app.renderAll();
    app.updateSyncUi();
    app.applySession();
    app.refreshLoginRosterFromServer();
    app.bootstrapFromServer();
    app.tryQuickOpenAdminFromPanel(0);
  };

  app.init = function () {
    app.initializeLocalPersistence().then(function () {
      app.startApp();
    }).catch(function () {
      app.startApp();
    });
  };

  app.init();
}());
