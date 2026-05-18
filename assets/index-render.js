(function () {
  'use strict';

  window.ACSField = window.ACSField || {};
  var app = window.ACSField;

  function getHeatVisual(weight) {
    if (weight >= 6) {
      return { stroke: '#9f1f27', fill: '#d93c47', opacity: Math.min(0.62, 0.26 + (weight * 0.045)) };
    }
    if (weight >= 3) {
      return { stroke: '#c85c2c', fill: '#e37c3d', opacity: Math.min(0.48, 0.18 + (weight * 0.04)) };
    }
    return { stroke: '#c78615', fill: '#d7a642', opacity: Math.min(0.34, 0.14 + (weight * 0.035)) };
  }

  app.hideMessage = function () {
    var node = document.getElementById('syncStatus');
    if (!node) { return; }
    node.textContent = '';
    node.classList.add('is-hidden');
    node.setAttribute('aria-hidden', 'true');
  };

  app.showMessage = function (text, kind) {
    var node = document.getElementById('syncStatus');
    var cleanText = app.cleanUiText(text);
    if (!node) { return; }
    if (app.messageClearTimer) {
      clearTimeout(app.messageClearTimer);
      app.messageClearTimer = null;
    }
    node.textContent = cleanText;
    node.classList.remove('is-hidden');
    node.removeAttribute('aria-hidden');
    node.style.background = kind === 'danger' ? '#8e3131' :
      kind === 'warn' ? '#8d6915' :
      kind === 'accent' ? '#355f9f' : '#203028';
    app.messageClearTimer = setTimeout(function () {
      if (node.textContent === cleanText) {
        app.hideMessage();
      }
      app.messageClearTimer = null;
    }, 8000);
  };

  app.setSyncChip = function (text, kind) {
    var chip = document.getElementById('syncChip');
    chip.textContent = app.cleanUiText(text);
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
  };

  app.makeMetricCard = function (label, value, kind) {
    return '' +
      '<div class="metric-card' +
      (kind === 'danger' ? ' is-danger' : kind === 'accent' ? ' is-accent' : kind === 'warn' ? ' is-warn' : '') +
      '">' +
        '<small>' + app.escapeHtml(label) + '</small>' +
        '<strong>' + app.escapeHtml(String(value)) + '</strong>' +
      '</div>';
  };

  app.makeFieldGuideItem = function (label, value, kind) {
    return '' +
      '<div class="field-guide-item' +
      (kind === 'danger' ? ' is-danger' : kind === 'accent' ? ' is-accent' : kind === 'warn' ? ' is-warn' : ' is-ok') +
      '">' +
        '<span>' + app.escapeHtml(label) + '</span>' +
        '<strong>' + app.escapeHtml(value) + '</strong>' +
      '</div>';
  };

  app.renderFieldGuideBlock = function (nodeId, data) {
    var node = document.getElementById(nodeId);
    var info = data || {};
    if (!node) {
      return;
    }
    node.className = 'field-guide ' + (info.className || '') + (info.kind ? ' is-' + info.kind : '');
    node.innerHTML = '' +
      '<div class="field-guide-main">' +
        '<small>' + app.escapeHtml(info.eyebrow || 'Próxima ação') + '</small>' +
        '<strong>' + app.escapeHtml(info.title || '') + '</strong>' +
        '<span>' + app.escapeHtml(info.text || '') + '</span>' +
      '</div>' +
      '<div class="field-guide-items">' + (info.items || []).map(function (item) {
        return app.makeFieldGuideItem(item.label, item.value, item.kind);
      }).join('') + '</div>';
  };

  app.renderVisitFieldGuide = function () {
    var property = app.getSelectedProperty();
    var visit = app.state.visit || {};
    var missing = [];
    var health = app.getServiceHealth ? app.getServiceHealth() : { queue: 0, offline: false };
    var address = property ? ([property.logradouro, property.numero].filter(Boolean).join(', ') || 'Imóvel selecionado') : '';
    var waterValue = visit.waterAccess || 'Informar';
    var title;
    var text;
    var kind = 'ok';

    if (!property) {
      missing.push('imóvel');
    }
    if (!visit.gps) {
      missing.push('GPS');
    }
    if (visit.situacao === 'Fechado' && !visit.closedReason) {
      missing.push('motivo do fechado');
    }
    if (!visit.waterAccess) {
      missing.push('caixa d\'água');
    }
    if (visit.waterAccess === 'Não' && !visit.waterAccessReason) {
      missing.push('motivo da caixa d\'água');
    }
    if (visit.waterAccess === 'Sim' && !visit.waterTankCondition) {
      missing.push('situação da caixa d\'água');
    }
    if (visit.waterAccess === 'Sim' && !visit.waterTreatment) {
      missing.push('tratamento da caixa d\'água');
    }

    if (!property) {
      title = 'Escolha o imóvel antes de registrar.';
      text = 'Localize o endereço, toque em Selecionar, confira o cartão e então toque em Iniciar visita.';
      kind = 'warn';
    } else if (!visit.gps) {
      title = 'Capture o GPS deste atendimento.';
      text = 'O registro salva sem internet, mas o GPS melhora o mapa e a rastreabilidade.';
      kind = 'warn';
    } else if (missing.length) {
      title = 'Complete: ' + missing.join(', ') + '.';
      text = 'Depois disso, use Salvar visita no fim do formulário.';
      kind = 'warn';
    } else {
      title = 'Pode salvar a visita.';
      text = health.queue ? 'Há ' + health.queue + ' registro(s) aguardando envio para a Nuvem.' : 'Fila local limpa até agora.';
      kind = health.offline || health.queue ? 'accent' : 'ok';
    }

    app.renderFieldGuideBlock('visitFieldGuide', {
      className: 'visit-field-guide',
      kind: kind,
      eyebrow: 'Roteiro de campo',
      title: title,
      text: text,
      items: [
        { label: 'Imóvel', value: property ? address : 'Não selecionado', kind: property ? 'ok' : 'warn' },
        { label: 'GPS', value: visit.gps ? 'Capturado' : 'Falta capturar', kind: visit.gps ? 'ok' : 'warn' },
        { label: 'Caixa d\'água', value: waterValue, kind: visit.waterAccess ? 'ok' : 'warn' },
        { label: 'Fila', value: health.queue ? health.queue + ' pendente(s)' : 'Limpa', kind: health.queue ? 'warn' : 'ok' }
      ]
    });
  };

  app.renderPropertyFieldGuide = function () {
    var properties = app.readProperties();
    var selected = app.state.selectedPropertyId
      ? properties.find(function (property) { return property.uid === app.state.selectedPropertyId; }) || null
      : null;
    var hasGps = !!app.state.visit.gps;
    var lastVisitByAddress = {};
    app.readVisits().slice().sort(app.compareVisitDesc).forEach(function (visit) {
      var key = app.addressKey(visit);
      if (!lastVisitByAddress[key]) {
        lastVisitByAddress[key] = visit;
      }
    });
    var pendingCount = properties.reduce(function (count, property) {
      var last = lastVisitByAddress[app.addressKey(property)];
      return count + (last && (last.situacao === 'Fechado' || last.situacao === 'Recusa') ? 1 : 0);
    }, 0);
    var title = hasGps
      ? 'Escolha o próximo ponto mais perto.'
      : 'Capture GPS para ordenar por proximidade.';
    var text = selected
      ? 'Selecionado: ' + ([selected.logradouro, selected.numero].filter(Boolean).join(', ') || selected.morador || 'imóvel carregado') + '.'
      : 'Use a lista abaixo para selecionar o próximo imóvel.';

    app.renderFieldGuideBlock('propertyFieldGuide', {
      className: 'property-field-guide',
      kind: hasGps ? 'ok' : 'warn',
      eyebrow: 'Próximo ponto',
      title: title,
      text: text,
      items: [
        { label: 'No aparelho', value: properties.length + ' imóvel(is)', kind: properties.length ? 'ok' : 'warn' },
        { label: 'GPS', value: hasGps ? 'Ativo' : 'Não capturado', kind: hasGps ? 'ok' : 'warn' },
        { label: 'Pendências', value: pendingCount ? pendingCount + ' retorno(s)' : 'Sem retorno', kind: pendingCount ? 'warn' : 'ok' },
        { label: 'Selecionado', value: selected ? 'Pronto para visita' : 'Nenhum', kind: selected ? 'accent' : 'warn' }
      ]
    });
  };

  app.renderPanelFieldGuide = function () {
    var snapshot = app.buildLocalSnapshot();
    var health = app.getServiceHealth();
    var totals = snapshot.totals;
    var pendingTotal = Number(health.queueTotal || health.queue || 0);
    var modeLabel = app.getCurrentOperationModeLabel ? app.getCurrentOperationModeLabel() : 'VD';
    var title;
    var text;
    var kind = 'ok';

    if (health.offline) {
      title = 'Offline: continue registrando no aparelho.';
      text = 'A fila será enviada quando a conexão voltar.';
      kind = 'danger';
    } else if (pendingTotal || health.pendingSync) {
      title = 'Pendências no aparelho: sincronize antes de encerrar.';
      text = 'Use Sincronizar dados para enviar visitas, tubitos e alterações locais ao Sheets.';
      kind = 'warn';
    } else {
      title = 'Fila limpa para continuar o dia.';
      text = health.lastSyncAt ? 'Última sincronização: ' + app.formatSyncMoment(health.lastSyncAt) + '.' : 'Ainda não houve sincronização concluída neste aparelho.';
    }

    app.renderFieldGuideBlock('panelFieldGuide', {
      className: 'panel-field-guide',
      kind: kind,
      eyebrow: 'Conferência rápida',
      title: title,
      text: text,
      items: [
        { label: 'Modo atual', value: modeLabel, kind: modeLabel === 'VD' ? 'ok' : 'accent' },
        { label: 'Pendentes', value: pendingTotal ? pendingTotal + ' item(ns)' : '0', kind: pendingTotal ? 'warn' : 'ok' },
        { label: 'Enviados hoje', value: String(health.sentToday || 0), kind: (health.sentToday || 0) ? 'accent' : 'warn' },
        { label: 'Último envio', value: health.lastSyncAt ? app.formatSyncMoment(health.lastSyncAt) : 'Ainda não', kind: health.lastSyncAt ? 'ok' : 'warn' },
        { label: 'GPS', value: totals.gpsCoverage + '%', kind: totals.gpsCoverage >= 80 ? 'ok' : 'warn' }
      ]
    });
  };

  app.renderPanelOfflineCommand = function () {
    var node = document.getElementById('panelOfflineCommand');
    var titleNode = document.getElementById('panelOfflineTitle');
    var textNode = document.getElementById('panelOfflineText');
    var queueNode = document.getElementById('panelOfflineQueue');
    var networkNode = document.getElementById('panelOfflineNetwork');
    var planNode = document.getElementById('panelOfflinePlan');
    var sentNode = document.getElementById('panelOfflineSent');
    if (!node || !titleNode || !textNode) {
      return;
    }
    var health = app.getServiceHealth ? app.getServiceHealth() : { queueTotal: 0, offline: false, sentToday: 0 };
    var pendingTotal = Number(health.queueTotal || health.queue || 0);
    var operationInfo = typeof app.getOperationReadinessInfo === 'function'
      ? app.getOperationReadinessInfo()
      : { confirmed: false, label: 'VD' };
    var hasPlan = !!operationInfo.confirmed;
    var networkText = health.offline ? 'OFF' : 'ON';
    var title = 'Tablet pronto para campo offline';
    var text = 'Registre visitas normalmente. Tudo fica salvo neste tablet até a próxima sincronização.';
    var tone = 'ok';

    if (!hasPlan) {
      title = 'Plano do dia ainda não confirmado';
      text = 'Antes de sair, abra com internet para receber operação, território e base local.';
      tone = 'danger';
    } else if (health.offline) {
      title = pendingTotal ? 'Offline com fila protegida' : 'Offline pronto para registrar';
      text = pendingTotal
        ? 'Há dados somente neste tablet. Não limpe o navegador; sincronize quando a internet voltar.'
        : 'Sem internet agora, mas o app está pronto para registrar novas visitas.';
      tone = pendingTotal ? 'warn' : 'ok';
    } else if (pendingTotal || health.pendingSync) {
      title = 'Há dados locais aguardando envio';
      text = 'Sincronize quando estiver em local com internet estável. O backup local continua disponível.';
      tone = 'warn';
    }

    node.className = 'panel-offline-command is-' + tone;
    titleNode.textContent = title;
    textNode.textContent = text;
    if (queueNode) { queueNode.textContent = String(pendingTotal); }
    if (networkNode) { networkNode.textContent = networkText; }
    if (planNode) { planNode.textContent = hasPlan ? (operationInfo.label || 'OK') : 'Falta'; }
    if (sentNode) { sentNode.textContent = String(health.sentToday || 0); }
  };

  app.buildPanelNextAction = function () {
    var snapshot = app.buildLocalSnapshot();
    var totals = snapshot.totals || {};
    var health = app.getServiceHealth ? app.getServiceHealth() : { queueTotal: 0, offline: false };
    var pendingTotal = Number(health.queueTotal || health.queue || 0);
    var properties = app.readProperties ? app.readProperties() : [];
    var selected = app.getSelectedProperty ? app.getSelectedProperty() : null;
    var operationInfo = typeof app.getOperationReadinessInfo === 'function'
      ? app.getOperationReadinessInfo()
      : { confirmed: false, label: 'VD' };
    var checks = [
      { label: pendingTotal ? (pendingTotal + ' pendente(s) no tablet') : 'Fila local limpa', kind: pendingTotal ? 'warn' : 'ok' },
      { label: health.offline ? 'Sem internet agora' : 'Internet disponível', kind: health.offline ? 'warn' : 'ok' },
      { label: operationInfo.confirmed ? 'Plano do dia carregado' : 'Plano do dia pendente', kind: operationInfo.confirmed ? 'ok' : 'danger' },
      { label: (totals.gpsCoverage || 0) + '% com GPS', kind: Number(totals.gpsCoverage || 0) >= 80 ? 'ok' : 'warn' }
    ];
    var action = {
      title: 'Continuar rotina de campo',
      text: 'Escolha o próximo imóvel, registre a visita e mantenha a fila local protegida.',
      primaryLabel: 'Continuar visita',
      primaryAction: 'visit',
      secondaryLabel: 'Ver imóveis',
      secondaryAction: 'properties',
      checks: checks
    };

    if (!operationInfo.confirmed) {
      action.title = 'Preparar o tablet antes de sair';
      action.text = 'O painel ainda não confirmou plano operacional e território para uso offline.';
      action.primaryLabel = 'Verificar offline';
      action.primaryAction = 'offline-check';
      action.secondaryLabel = 'Ver imóveis';
      action.secondaryAction = 'properties';
      return action;
    }

    if (!properties.length) {
      action.title = 'Base local vazia';
      action.text = 'Cadastre ou carregue imóveis antes de iniciar a rota no Galaxy Tab A11.';
      action.primaryLabel = 'Abrir imóveis';
      action.primaryAction = 'properties';
      action.secondaryLabel = 'Backup local';
      action.secondaryAction = 'backup';
      return action;
    }

    if (health.offline && pendingTotal) {
      action.title = 'Continue offline com segurança';
      action.text = 'Os registros estão no tablet. Exporte backup se for entregar o aparelho antes de sincronizar.';
      action.primaryLabel = 'Exportar backup';
      action.primaryAction = 'backup';
      action.secondaryLabel = 'Nova visita';
      action.secondaryAction = selected ? 'visit' : 'next-property';
      return action;
    }

    if (!health.offline && pendingTotal) {
      action.title = 'Enviar fila local quando possível';
      action.text = 'Há produção salva no tablet. Sincronize em internet estável antes de encerrar o dia.';
      action.primaryLabel = 'Sincronizar agora';
      action.primaryAction = 'sync';
      action.secondaryLabel = 'Backup local';
      action.secondaryAction = 'backup';
      return action;
    }

    if (Number(totals.returns || 0) > 0) {
      action.title = 'Resolver retornos pendentes';
      action.text = 'Existem imóveis fechados ou recusas. Priorize a nova passagem por microárea e quarteirão.';
      action.primaryLabel = 'Carregar pendência';
      action.primaryAction = 'pending-property';
      action.secondaryLabel = 'Nova visita';
      action.secondaryAction = selected ? 'visit' : 'next-property';
      return action;
    }

    action.primaryLabel = selected ? 'Continuar visita' : 'Próximo imóvel';
    action.primaryAction = selected ? 'visit' : 'next-property';
    action.secondaryLabel = 'Relatório do dia';
    action.secondaryAction = 'report';
    return action;
  };

  app.renderPanelNextAction = function () {
    var titleNode = document.getElementById('panelNextTitle');
    var textNode = document.getElementById('panelNextText');
    var checklistNode = document.getElementById('panelNextChecklist');
    var primaryBtn = document.getElementById('panelNextPrimaryBtn');
    var secondaryBtn = document.getElementById('panelNextSecondaryBtn');
    if (!titleNode || !textNode || !primaryBtn || !secondaryBtn) {
      return;
    }
    var action = app.buildPanelNextAction ? app.buildPanelNextAction() : null;
    action = action || {};
    titleNode.textContent = action.title || 'Continuar rotina de campo';
    textNode.textContent = action.text || '';
    if (checklistNode) {
      checklistNode.innerHTML = (action.checks || []).map(function (check) {
        var kind = check.kind === 'danger' ? ' is-danger' : (check.kind === 'warn' ? ' is-warn' : '');
        return '<span class="panel-next-check' + kind + '">' + app.escapeHtml(check.label || '') + '</span>';
      }).join('');
    }
    primaryBtn.textContent = action.primaryLabel || 'Continuar';
    primaryBtn.setAttribute('data-panel-action', action.primaryAction || 'visit');
    secondaryBtn.textContent = action.secondaryLabel || 'Ver imóveis';
    secondaryBtn.setAttribute('data-panel-action', action.secondaryAction || 'properties');
  };

  app.renderHero = function () {
    var snapshot = app.buildLocalSnapshot();
    var visits = snapshot.visits;
    var totals = snapshot.totals;
    var gpsCount = visits.filter(function (visit) { return visit.gps; }).length;

    document.getElementById('heroVisits').textContent = totals.totalVisits;
    document.getElementById('heroVisitsNote').textContent = totals.totalVisits
      ? totals.visitedProperties + ' imóvel(is) trabalhado(s) por você.'
      : 'Comece em Imóveis.';
    document.getElementById('heroFocuses').textContent = totals.focusVisits;
    document.getElementById('heroFocusesNote').textContent = totals.depositsWithFocus
      ? totals.depositsWithFocus + ' depósito(s) com foco.'
      : 'Sem foco lançado.';
    document.getElementById('heroGps').textContent = totals.gpsCoverage + '%';
    document.getElementById('heroGpsNote').textContent = gpsCount
      ? gpsCount + ' visita(s) com GPS.'
      : 'Nenhuma visita com GPS.';
    document.getElementById('heroReturns').textContent = totals.returns;
    document.getElementById('heroReturnsNote').textContent = totals.returns ? 'Programar nova passagem.' : 'Sem retorno pendente.';
  };

  app.renderSelectedPropertyCard = function () {
    var property = app.getSelectedProperty();
    var node = document.getElementById('selectedPropertyCard');
    if (!property) {
      node.innerHTML = '' +
        '<div class="selected-card-top">' +
          '<strong>Nenhum imóvel selecionado</strong>' +
          '<span>Escolha um imóvel na lista para continuar a visita.</span>' +
        '</div>';
      return;
    }

    var history = app.getVisitsForProperty(property);
    var last = history[0];
    var quality = app.computePropertyQuality(property, app.readProperties());
    var referenceText = app.getPropertyReferenceText(property);
    var addressText = [property.logradouro, property.numero].filter(Boolean).join(', ') || 'Endereço não informado';
    var territoryText = [
      property.bairro || 'Bairro não informado',
      property.microarea ? 'MA ' + property.microarea : '',
      property.quarteirao ? 'Q ' + property.quarteirao : ''
    ].filter(Boolean).join(' • ');
    var cadastroText = [property.tipo || 'Não informado', property.complemento || 'Normal'].join(' • ');
    var situationText = last && last.situacao === 'Fechado'
      ? 'Pendência ativa para retorno.'
      : 'Imóvel pronto para nova ação de campo.';
    var recentVisits = history.slice(0, 3);
    var waterText = '';
    var focusLocalText = '';
    var attendedName = '';
    var attentionPills = [];
    var closedInRecent = recentVisits.filter(function (visit) {
      return visit && visit.situacao === 'Fechado';
    }).length;

    function hasVisitFocus(visit) {
      return !!(visit && (
        visit.focusFound === 'Sim' ||
        Number(visit.focusQty || 0) > 0 ||
        Number(visit.depositFocusTotal || 0) > 0
      ));
    }

    function buildVisitFocusDetail(visit) {
      var focusTotal = Math.max(Number(visit.focusQty || 0), Number(visit.depositFocusTotal || 0));
      var breakdown = Array.isArray(visit.depositFocusBreakdown)
        ? visit.depositFocusBreakdown.filter(Boolean)
        : [];

      if (breakdown.length) {
        return 'Foco em: ' + breakdown.join(' • ');
      }

      return focusTotal ? focusTotal + ' foco(s)' : 'Sem foco';
    }

    function getVisitHistoryTone(visit) {
      if (hasVisitFocus(visit)) {
        return ' is-focus';
      }
      if (visit && visit.situacao === 'Fechado') {
        return ' is-closed';
      }
      if (visit && visit.situacao === 'Recuperado') {
        return ' is-recovered';
      }
      return ' is-clear';
    }

    function buildHistoryDetail(visit) {
      var parts = [];
      var deposits = Number(visit.depositTotal || 0);
      parts.push('Operacao: ' + (app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD')));
      parts.push(deposits ? deposits + ' depósito(s)' : 'Sem depósito');
      parts.push(buildVisitFocusDetail(visit));
      if (visit.waterAccess) {
        parts.push("Caixa d'água: " + app.buildWaterAccessText(visit));
      }
      if (visit.closedReason) {
        parts.push('Motivo: ' + visit.closedReason);
      }
      if (visit.tubitosQty) {
        var tubitoCodes = [];
        if (typeof app.getTubitosForVisit === 'function') {
          var groupedTubitoCodes = {};
          app.getTubitosForVisit(visit).forEach(function (row) {
            var depositCode = row.depositoCodigo || 'Sem depósito';
            groupedTubitoCodes[depositCode] = groupedTubitoCodes[depositCode] || [];
            if (row.numeroTubito) { groupedTubitoCodes[depositCode].push(row.numeroTubito); }
          });
          tubitoCodes = Object.keys(groupedTubitoCodes).map(function (depositCode) {
            var label = app.DEPOSITS[depositCode] ? depositCode : depositCode;
            return label + ': ' + groupedTubitoCodes[depositCode].join(', ');
          });
        }
        parts.push('Tubitos: ' + (tubitoCodes.length ? tubitoCodes.join(', ') : visit.tubitosQty + ' coletado(s) sem numeração local'));
        if (typeof app.formatDetailedLabSummaryText === 'function') {
          var detailedLabText = app.formatDetailedLabSummaryText(visit);
          if (detailedLabText) {
            parts.push(detailedLabText);
          }
        } else if (typeof app.formatLabSummaryText === 'function') {
          var labText = app.formatLabSummaryText(visit);
          if (labText) {
            parts.push(labText);
          }
        }
      }
      return parts.join(' • ');
    }

    function buildHistoryCards() {
      if (!recentVisits.length) {
        return '' +
          '<div class="selected-card-history-empty">' +
            '<strong>Sem visitas anteriores neste histórico.</strong>' +
            '<span>Use este cartão como ponto de partida da primeira visita registrada.</span>' +
          '</div>';
      }
      return recentVisits.map(function (visit, index) {
        var title = index === 0 ? 'Última visita' : 'Visita ' + (index + 1);
        var status = visit.situacao || 'Sem situação';
        var operation = app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD');
        var agent = visit.agente ? ' • ' + visit.agente : '';
        return '' +
          '<article class="selected-card-history-item' + getVisitHistoryTone(visit) + '">' +
            '<div class="selected-card-history-kicker">' + app.escapeHtml(title) + '</div>' +
            '<strong>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + (visit.hora || '')) + '</strong>' +
            '<span>' + app.escapeHtml(status + ' • ' + operation + agent) + '</span>' +
            '<p>' + app.escapeHtml(buildHistoryDetail(visit)) + '</p>' +
          '</article>';
      }).join('');
    }
    var summaryItems = [
      { key: 'morador', label: 'Morador', value: property.morador || 'Não informado' },
      { key: 'contato', label: 'Contato', value: property.telefone || 'Não informado' },
      { key: 'territorio', label: 'Território', value: territoryText || 'Não definido' },
      { key: 'cadastro', label: 'Cadastro', value: cadastroText },
      { key: 'referencia', label: 'Referência', value: referenceText || 'Sem referência complementar' }
    ];
    var pills = [];
    if (last) {
      pills.push('<span class="status-pill ' + (last.focusFound === 'Sim' ? 'is-danger' : 'is-ok') + '">Última: ' + app.escapeHtml(app.formatDateBR(last.data)) + ' ' + app.escapeHtml(last.hora) + '</span>');
      attendedName = last.attendedBy || last.morador || property.morador || '';
      if (attendedName) {
        pills.push('<span class="meta-pill">Atendeu: ' + app.escapeHtml(attendedName) + '</span>');
      }
      if (last.waterAccess) {
        waterText = app.buildWaterAccessText(last);
        pills.push('<span class="meta-pill">' + app.escapeHtml('Caixa d\'água: ' + waterText) + '</span>');
      }
      if (last.focusFound === 'Sim' || Number(last.focusQty || 0) > 0 || Number(last.depositFocusTotal || 0) > 0) {
        focusLocalText = last.depositFocusBreakdown && last.depositFocusBreakdown.length
          ? last.depositFocusBreakdown.join(' • ')
          : (Number(last.focusQty || 0) > 0 ? String(Number(last.focusQty || 0)) + ' foco(s)' : 'Com foco');
        pills.push('<span class="status-pill is-danger">Focos locais: ' + app.escapeHtml(focusLocalText) + '</span>');
      } else if (last.focusFound === 'Não') {
        pills.push('<span class="status-pill is-ok">Focos locais: sem foco</span>');
      }
      if (typeof app.getLabSummaryForVisit === 'function') {
        var lastLab = app.getLabSummaryForVisit(last);
        if (lastLab.total) {
          pills.push('<span class="status-pill ' + (lastLab.tone === 'danger' ? 'is-danger' : lastLab.tone === 'warn' ? 'is-warn' : 'is-ok') + '">Laboratório: ' + app.escapeHtml(lastLab.text) + '</span>');
        }
      }
    }
    if (last && last.closedReason) {
      pills.push('<span class="status-pill is-warn">Motivo: ' + app.escapeHtml(last.closedReason) + '</span>');
    }
    if (quality.flags.length) {
      pills.push('<span class="status-pill is-warn">' + app.escapeHtml(quality.flags.join(' • ')) + '</span>');
    }
    if (property.gpsTerritory || property.gpsQuarteirao) {
      pills.push('<span class="meta-pill">GPS: ' + app.escapeHtml(property.gpsTerritory || '-') + (property.gpsQuarteirao ? ' • Q ' + app.escapeHtml(property.gpsQuarteirao) : '') + '</span>');
    }
    if (!recentVisits.length) {
      attentionPills.push('<span class="status-pill is-accent">Primeira passagem no histórico local</span>');
    }
    if (recentVisits.some(hasVisitFocus)) {
      attentionPills.push('<span class="status-pill is-danger">Atenção: foco nas últimas visitas</span>');
    }
    if (closedInRecent >= 2) {
      attentionPills.push('<span class="status-pill is-warn">Retorno recorrente: ' + app.escapeHtml(String(closedInRecent)) + ' fechados recentes</span>');
    }
    if (recentVisits.some(function (visit) { return visit && visit.waterAccess && visit.waterAccess !== 'Sim'; })) {
      attentionPills.push('<span class="status-pill is-warn">Rever acesso à caixa d\'água</span>');
    }

    node.innerHTML = '' +
      '<div class="selected-card-top">' +
        '<strong>' + app.escapeHtml(addressText) + '</strong>' +
        '<span>' + app.escapeHtml(situationText) + '</span>' +
      '</div>' +
      '<div class="selected-card-grid">' +
        summaryItems.map(function (item) {
          return '' +
            '<div class="selected-card-item selected-card-item-' + app.escapeHtml(item.key || 'base') + '">' +
              '<small>' + app.escapeHtml(item.label) + '</small>' +
              '<strong>' + app.escapeHtml(item.value) + '</strong>' +
            '</div>';
        }).join('') +
      '</div>' +
      (pills.length ? '<div class="meta-pills selected-card-pills">' + pills.join('') + '</div>' : '') +
      (attentionPills.length ? '<div class="meta-pills selected-card-alerts">' + attentionPills.join('') + '</div>' : '') +
      '<section class="selected-card-history" aria-label="Histórico recente do imóvel">' +
        '<div class="selected-card-history-head">' +
          '<div>' +
            '<strong>Últimas 3 visitas</strong>' +
            '<span>Resumo rápido para orientar a abordagem antes de iniciar.</span>' +
          '</div>' +
        '</div>' +
        '<div class="selected-card-history-grid">' + buildHistoryCards() + '</div>' +
      '</section>' +
      '<div class="selected-card-footer selected-card-footer--button-only">' +
        '<button class="btn btn-primary selected-card-start-btn" type="button" data-property-start="' + app.escapeHtml(property.uid) + '">Iniciar visita</button>' +
      '</div>';
  };

  app.renderChoiceButtons = function (containerId, choices, currentValue, type) {
    document.getElementById(containerId).innerHTML = choices.map(function (choice) {
      var active = currentValue === choice.value ? ' active' : '';
      var danger = choice.danger ? ' is-danger' : '';
      var tone = '';
      if (type === 'situacao') {
        if (choice.value === 'Visitado') {
          tone = ' choice-btn-open';
        } else if (choice.value === 'Fechado') {
          tone = ' choice-btn-closed';
        } else if (choice.value === 'Recuperado') {
          tone = ' choice-btn-recovered';
        }
      } else if (type === 'water') {
        if (choice.value === 'Sim') {
          tone = ' choice-btn-yes';
        } else if (choice.value === 'Não') {
          tone = ' choice-btn-no';
        }
      } else if (type === 'water-treatment' || type === 'deposit-found' || type === 'ladder-support') {
        if (choice.value === 'Sim') {
          tone = ' choice-btn-yes';
        } else if (choice.value === 'Não') {
          tone = ' choice-btn-no';
        }
      }
      return '' +
        '<button class="choice-btn' + active + danger + tone + '" type="button" data-choice-type="' + app.escapeHtml(type) + '" data-choice-value="' + app.escapeHtml(choice.value) + '">' +
          app.escapeHtml(choice.label) +
          '<span>' + app.escapeHtml(choice.help) + '</span>' +
        '</button>';
    }).join('');
  };

  app.renderClosedReasonField = function () {
    var wrapper = document.getElementById('visitClosedReasonWrap');
    var select = document.getElementById('visitClosedReason');
    var reasons;
    if (!wrapper || !select) {
      return;
    }
    reasons = app.CONFIG.CLOSED_REASONS.slice();
    if (app.state.visit.closedReason && reasons.indexOf(app.state.visit.closedReason) === -1) {
      reasons.push(app.state.visit.closedReason);
    }
    select.innerHTML = '<option value="">Selecione o motivo</option>' + reasons.map(function (reason) {
      return '<option value="' + app.escapeHtml(reason) + '">' + app.escapeHtml(reason) + '</option>';
    }).join('');
    if (app.state.visit.situacao !== 'Fechado') {
      wrapper.hidden = true;
      select.value = '';
      return;
    }
    wrapper.hidden = false;
    select.value = app.state.visit.closedReason || '';
  };

  app.renderWaterAccessReasonField = function () {
    var wrapper = document.getElementById('visitWaterAccessReasonWrap');
    var select = document.getElementById('visitWaterAccessReason');
    var reasons;
    if (!wrapper || !select) {
      return;
    }
    reasons = app.CONFIG.WATER_ACCESS_REASONS.slice();
    app.state.visit.waterAccessReason = app.normalizeWaterAccessReason(app.state.visit.waterAccessReason || '');
    select.innerHTML = '<option value="">Selecione o motivo</option>' + reasons.map(function (reason) {
      return '<option value="' + app.escapeHtml(reason) + '">' + app.escapeHtml(reason) + '</option>';
    }).join('');
    if (app.state.visit.waterAccess !== 'Não') {
      wrapper.hidden = true;
      select.value = '';
      return;
    }
    wrapper.hidden = false;
    select.value = app.state.visit.waterAccessReason || '';
  };

  app.renderLadderSupportField = function () {
    var wrapper = document.getElementById('visitLadderSupportWrap');
    if (!wrapper) {
      return;
    }
    if (!app.shouldAskLadderSupport(app.state.visit)) {
      wrapper.hidden = true;
      app.state.visit.ladderSupportRequested = '';
      app.state.visit.ladderSupportNoReason = '';
      return;
    }
    wrapper.hidden = false;
    app.renderChoiceButtons('visitLadderSupportChoices', [
      { value: 'Sim', label: 'Solicitar', help: 'Enviar para a coordenação.' },
      { value: 'Não', label: 'Não agora', help: 'Registrar motivo.' }
    ], app.state.visit.ladderSupportRequested, 'ladder-support');
  };

  app.renderLadderSupportNoReasonField = function () {
    var wrapper = document.getElementById('visitLadderSupportNoReasonWrap');
    var select = document.getElementById('visitLadderSupportNoReason');
    var reasons;
    if (!wrapper || !select) {
      return;
    }
    reasons = app.CONFIG.LADDER_SUPPORT_NO_REASONS.slice();
    app.state.visit.ladderSupportNoReason = app.normalizeLadderSupportNoReason(app.state.visit.ladderSupportNoReason || '');
    select.innerHTML = '<option value="">Selecione o motivo</option>' + reasons.map(function (reason) {
      return '<option value="' + app.escapeHtml(reason) + '">' + app.escapeHtml(reason) + '</option>';
    }).join('');
    if (!app.shouldAskLadderSupport(app.state.visit) || app.state.visit.ladderSupportRequested !== 'Não') {
      wrapper.hidden = true;
      select.value = '';
      if (app.state.visit.ladderSupportRequested !== 'Não') {
        app.state.visit.ladderSupportNoReason = '';
      }
      return;
    }
    wrapper.hidden = false;
    select.value = app.state.visit.ladderSupportNoReason || '';
  };

  app.renderWaterTankConditionField = function () {
    var wrapper = document.getElementById('visitWaterTankConditionWrap');
    var select = document.getElementById('visitWaterTankCondition');
    var conditions;
    if (!wrapper || !select) {
      return;
    }
    conditions = app.CONFIG.WATER_TANK_CONDITIONS.slice();
    app.state.visit.waterTankCondition = app.normalizeWaterTankCondition(app.state.visit.waterTankCondition || '');
    select.innerHTML = '<option value="">Selecione a situação</option>' + conditions.map(function (condition) {
      return '<option value="' + app.escapeHtml(condition) + '">' + app.escapeHtml(condition) + '</option>';
    }).join('');
    if (app.state.visit.waterAccess !== 'Sim') {
      wrapper.hidden = true;
      select.value = '';
      return;
    }
    wrapper.hidden = false;
    select.value = app.state.visit.waterTankCondition || '';
  };

  app.renderWaterTreatmentField = function () {
    var wrapper = document.getElementById('visitWaterTreatmentWrap');
    if (!wrapper) {
      return;
    }
    if (app.state.visit.waterAccess !== 'Sim') {
      wrapper.hidden = true;
      return;
    }
    wrapper.hidden = false;
    app.renderChoiceButtons('waterTreatmentChoices', [
      { value: 'Sim', label: 'Sim', help: 'Foi feito tratamento na caixa d\'água.' },
      { value: 'Não', label: 'Não', help: 'A caixa foi acessada, mas sem tratamento.' }
    ], app.state.visit.waterTreatment, 'water-treatment');
  };

  app.renderWaterLegalAlert = function () {
    var node = document.getElementById('visitWaterLegalAlert');
    if (!node) {
      return;
    }
    if (!app.shouldShowWaterResidentAlert(app.state.visit)) {
      node.hidden = true;
      node.innerHTML = '';
      return;
    }
    node.hidden = false;
    node.innerHTML = '<strong>Orientação ao morador</strong><span>' + app.escapeHtml(app.getWaterResidentAlertText()) + '</span>';
  };

  app.renderFocusAutoSummary = function () {
    var node = document.getElementById('visitFocusAutoSummary');
    if (!node) {
      return;
    }
    node.hidden = true;
    node.innerHTML = '';
  };

  app.renderDepositGrid = function () {
    var visit = app.state.visit;
    var node = document.getElementById('depositGrid');
    if (!node) {
      return;
    }
    if (visit.depositFound !== 'Sim') {
      node.innerHTML = '';
      return;
    }
    node.innerHTML = Object.keys(app.DEPOSITS).map(function (code) {
      var total = Number(visit.depositCounts[code] || 0);
      var focusTotal = Number(visit.depositFocusCounts[code] || 0);
      var treatmentTotal = Number((visit.depositTreatmentCounts && visit.depositTreatmentCounts[code]) || 0);
      var active = total > 0 || focusTotal > 0 || treatmentTotal > 0;
      return '' +
        '<div class="deposit-card deposit-card-compact' + (active ? ' is-active' : '') + (focusTotal > 0 ? ' has-focus' : '') + (treatmentTotal > 0 ? ' has-treatment' : '') + '">' +
          '<div class="deposit-top">' +
            '<div><strong>' + app.escapeHtml(code) + '</strong><span>' + app.escapeHtml(app.DEPOSITS[code]) + '</span></div>' +
            '<div class="stepper deposit-line-stepper" aria-label="Quantidade encontrada">' +
              '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="count" data-step="-1">-</button>' +
              '<span class="deposit-stepper-value" aria-live="polite">' + app.escapeHtml(String(total)) + '</span>' +
              '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="count" data-step="1">+</button>' +
            '</div>' +
          '</div>' +
          (total > 0 || focusTotal > 0 ? '<div class="deposit-details">' +
            '<div class="deposit-inline-row">' +
              '<span>Com foco</span>' +
              '<div class="stepper deposit-line-stepper" aria-label="Quantidade com foco">' +
                '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="focus" data-step="-1">-</button>' +
                '<span class="deposit-stepper-value" aria-live="polite">' + app.escapeHtml(String(focusTotal)) + '</span>' +
                '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="focus" data-step="1">+</button>' +
              '</div>' +
            '</div>' +
            (focusTotal > 0 ? '<div class="deposit-inline-row deposit-tubitos-inline">' +
              '<span>Tubitos</span>' +
              '<div class="stepper deposit-line-stepper" aria-label="Tubitos coletados">' +
                '<button type="button" data-step-target="visitTubitosQty" data-tubitos-deposit="' + app.escapeHtml(code) + '" data-step="-1">-</button>' +
                '<span class="deposit-stepper-value" aria-live="polite">' + app.escapeHtml(String(app.getTubitoDepositQty(visit, code))) + '</span>' +
                '<button type="button" data-step-target="visitTubitosQty" data-tubitos-deposit="' + app.escapeHtml(code) + '" data-step="1">+</button>' +
              '</div>' +
            '</div>' : '') +
            '<div class="deposit-inline-row deposit-treatment-box">' +
              '<span>Tratado com BPI</span>' +
              '<div class="deposit-measure-stepper">' +
                '<div class="stepper deposit-line-stepper" aria-label="Gramas de BPI aplicadas">' +
                  '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="treatment" data-step="-1">-</button>' +
                  '<span class="deposit-stepper-value" aria-live="polite">' + app.escapeHtml(String(treatmentTotal)) + '</span>' +
                  '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="treatment" data-step="1">+</button>' +
                '</div>' +
                '<span class="deposit-measure-unit">gramas</span>' +
              '</div>' +
            '</div>' +
            '<div class="field-help">Foco limitado ao total encontrado.' + (focusTotal > 0 ? ' Tubitos deste depósito: ' + app.escapeHtml(String(app.getTubitoDepositQty(visit, code))) + ' • sequência da visita: ' + app.escapeHtml(document.getElementById('visitTubitosRange') ? document.getElementById('visitTubitosRange').textContent : 'Sem numeração') + '.' : '') + '</div>' +
          '</div>' : '') +
        '</div>';
    }).join('');
  };

  app.createVisitSummary = function () {
    var summaryNode = document.getElementById('visitSummary');
    var visit = app.state.visit;
    var property = app.getSelectedProperty();
    var qualityFlags = app.computeVisitQuality(visit);
    var statusText = app.getVisitStatusLabel(visit.situacao);
    var isClosedVisit = app.normalizeStatus ? app.normalizeStatus(visit.situacao) === 'Fechado' : visit.situacao === 'Fechado';
    var waterAccessText = isClosedVisit ? "Pulada por imóvel fechado" : (visit.waterAccess ? app.buildWaterAccessText(visit) : 'Não informado');
    var focusBreakdown = app.compactMap(visit.depositFocusCounts);
    var treatmentBreakdown = app.compactMap(visit.depositTreatmentCounts || app.emptyDepositMap());
    var treatmentTotal = app.totalFromMap(visit.depositTreatmentCounts || app.emptyDepositMap());
    var tubitosDepositText = app.formatTubitoDepositSummary(visit) || (visit.tubitosDeposit
      ? (visit.tubitosDeposit + ' - ' + (app.DEPOSITS[visit.tubitosDeposit] || 'Depósito'))
      : '');
    var addressText = property
      ? ([property.logradouro, property.numero].filter(Boolean).join(', ') || property.morador || 'Imóvel selecionado')
      : 'Imóvel não selecionado';
    var territoryText = [
      visit.microarea ? 'MA ' + visit.microarea : '',
      visit.quarteirao ? 'Q ' + visit.quarteirao : '',
      property && property.bairro ? property.bairro : ''
    ].filter(Boolean).join(' • ') || 'Território não informado';
    var hasFocusGpsPending = app.totalFromMap(visit.depositFocusCounts || app.emptyDepositMap()) > 0 && !visit.focusGpsCaptured;
    var gpsText = hasFocusGpsPending
      ? 'GPS do foco obrigatório. Capture no local do foco.'
      : visit.gps
        ? 'Capturado • ' + Number(visit.gps.accuracy || 0) + ' m'
        : 'GPS obrigatório. Capture antes de salvar.';
    if (!summaryNode) {
      return;
    }
    if (visit.situacao === 'Fechado') {
      statusText += visit.closedReason ? ' • ' + visit.closedReason : ' • motivo não informado';
    }
    var items = [
      { title: 'Situação', text: statusText, tone: 'status' },
      { title: 'Focos', text: visit.focusQty + ' foco(s)' + (focusBreakdown.length ? ' • ' + focusBreakdown.join(' • ') : ' • sem foco'), tone: Number(visit.focusQty || 0) > 0 ? 'danger' : 'ok' },
      { title: 'Depósitos', text: app.totalFromMap(visit.depositCounts) + ' total • ' + app.totalFromMap(visit.depositFocusCounts) + ' positivo(s)', tone: app.totalFromMap(visit.depositFocusCounts) > 0 ? 'danger' : 'neutral' },
      { title: 'BPI', text: treatmentBreakdown.length ? (treatmentTotal + ' g • ' + treatmentBreakdown.join(' • ')) : 'Sem BPI', tone: treatmentBreakdown.length ? 'warn' : 'neutral' },
      { title: 'Caixa d\'água', text: waterAccessText, tone: 'water' },
      { title: 'Tubitos', text: visit.tubitosQty + ' coletado(s)' + (tubitosDepositText ? ' • ' + tubitosDepositText : ''), tone: Number(visit.tubitosQty || 0) > 0 ? 'warn' : 'neutral' },
      { title: 'GPS', text: gpsText, tone: visit.gps ? 'ok' : 'warn' },
      { title: 'Qualidade', text: qualityFlags.length ? qualityFlags.join(' • ') : 'OK para salvar', tone: qualityFlags.length ? 'warn' : 'ok' }
    ];
    summaryNode.innerHTML = '' +
      '<div class="visit-summary-receipt">' +
        '<div>' +
          '<span>Resumo</span>' +
          '<strong>' + app.escapeHtml(addressText) + '</strong>' +
          '<small>' + app.escapeHtml(property && property.morador ? ('Morador: ' + property.morador) : 'Morador não informado') + '</small>' +
          '<small>' + app.escapeHtml(territoryText) + '</small>' +
        '</div>' +
        '<div class="visit-summary-status">' + app.escapeHtml(statusText) + '</div>' +
      '</div>' +
      '<div class="visit-summary-card-grid">' +
      items.map(function (item) {
        return '<div class="visit-summary-mini-card visit-summary-mini-card-' + app.escapeHtml(item.tone || 'neutral') + '">' +
        '<span>' + app.escapeHtml(item.title) + '</span>' +
        '<strong>' + app.escapeHtml(item.text) + '</strong>' +
      '</div>';
      }).join('') +
      '</div>';
  };

  app.renderSelectedHistory = function () {
    var property = app.getSelectedProperty();
    var node = document.getElementById('selectedHistory');
    if (!property) {
      node.innerHTML = '<div class="empty-state">Selecione um imóvel para ver o histórico desse endereço.</div>';
      return;
    }
    var history = app.getVisitsForProperty(property).slice(0, 6);
    if (!history.length) {
      node.innerHTML = '<div class="empty-state">Nenhuma visita anterior encontrada para este imóvel.</div>';
      return;
    }
    node.innerHTML = history.map(function (visit) {
      var tags = [];
      tags.push('<span class="tag">' + app.escapeHtml(app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD')) + '</span>');
      tags.push('<span class="tag">' + app.escapeHtml(app.getVisitStatusLabel(visit.situacao)) + '</span>');
      if (visit.focusFound === 'Sim') {
        tags.push('<span class="status-pill is-danger">' + app.escapeHtml(String(visit.focusQty)) + ' foco(s)</span>');
      }
      if (visit.depositFocusTotal > 0) {
        tags.push('<span class="status-pill is-warn">' + app.escapeHtml(String(visit.depositFocusTotal)) + ' depósito(s) com foco</span>');
      }
      if (typeof app.getLabSummaryForVisit === 'function') {
        var lab = app.getLabSummaryForVisit(visit);
        if (lab.total) {
          tags.push('<span class="status-pill ' + (lab.tone === 'danger' ? 'is-danger' : lab.tone === 'warn' ? 'is-warn' : 'is-ok') + '">' + app.escapeHtml(lab.text) + '</span>');
        }
      }
      if (visit.closedReason) {
        tags.push('<span class="status-pill is-warn">' + app.escapeHtml(visit.closedReason) + '</span>');
      }
      var notes = [];
      if (visit.closedReason) {
        notes.push('Motivo do fechado: ' + visit.closedReason);
      }
      if (visit.obs) {
        notes.push(visit.obs);
      }
      if (typeof app.formatLabSummaryText === 'function') {
        var labText = app.formatLabSummaryText(visit);
        if (labText) {
          notes.push(labText);
        }
      }
      return '' +
        '<div class="history-card' + (visit.focusFound === 'Sim' ? ' is-focus' : '') + '">' +
          '<strong>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</strong>' +
          '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml(visit.agente || '-') + ' • MA ' + app.escapeHtml(String(visit.microarea || '-')) + ' • Q ' + app.escapeHtml(String(visit.quarteirao || '-')) + '</div>' +
          '<div class="meta-pills">' + tags.join('') + '</div>' +
          '<div style="margin-top:10px;color:#66727c">' + app.escapeHtml(notes.join(' • ') || 'Sem observação registrada.') + '</div>' +
        '</div>';
    }).join('');
  };

  app.fillAgentSelect = function () {
    var select = document.getElementById('loginAgent');
    var message = document.getElementById('loginMessage');
    if (select) {
      select.innerHTML = '';
      select.hidden = true;
      select.setAttribute('aria-hidden', 'true');
    }
    if (message && !app.state.currentAgent) {
      message.textContent = app.readAgents().length ? 'Informe CPF e senha para entrar.' : 'Carregando estrutura de acesso...';
    }
  };


  app.fillPropertyFormOptions = function () {
    var bairros = app.getBairroCatalog();
    var territory = app.getTerritoryCatalog();
    var propBairro = document.getElementById('propBairro');
    var propMicroarea = document.getElementById('propMicroarea');
    var propQuarteirao = document.getElementById('propQuarteirao');
    var propTipo = document.getElementById('propTipo');
    var propComplemento = document.getElementById('propComplemento');
    var visitLarvicida = document.getElementById('visitLarvicida');
    var visitAdulticida = document.getElementById('visitAdulticida');
    var currentPropertyBairro = propBairro.value;
    var currentPropertyMicroarea = propMicroarea ? app.normalizeAreaCode(propMicroarea.value) : '';
    var currentPropertyQuarteirao = propQuarteirao ? app.normalizeAreaCode(propQuarteirao.value) : '';
    var currentPropertyType = propTipo ? propTipo.value : '';
    var currentPropertyComplement = propComplemento ? String(propComplemento.value || '').trim() : '';
    var currentPropertyLogradouro = document.getElementById('propLogradouro') ? String(document.getElementById('propLogradouro').value || '').trim() : '';
    var currentLarvicida = visitLarvicida ? visitLarvicida.value : '';
    var currentAdulticida = visitAdulticida ? visitAdulticida.value : '';

    propBairro.innerHTML = bairros.map(function (bairro) {
      return '<option value="' + app.escapeHtml(bairro) + '">' + app.escapeHtml(bairro) + '</option>';
    }).join('');
    if (currentPropertyBairro && bairros.indexOf(currentPropertyBairro) > -1) {
      propBairro.value = currentPropertyBairro;
    } else if (bairros.length) {
      propBairro.value = bairros[0];
    }

    if (document.getElementById('propLogradouroOptions')) {
      document.getElementById('propLogradouroOptions').innerHTML = app.getLogradouroCatalog(propBairro.value).map(function (logradouro) {
        return '<option value="' + app.escapeHtml(logradouro) + '"></option>';
      }).join('');
    }
    if (document.getElementById('propLogradouro')) {
      document.getElementById('propLogradouro').value = currentPropertyLogradouro;
    }
    if (typeof app.renderPropertyStreetSuggestion === 'function') {
      app.renderPropertyStreetSuggestion();
    }

    document.getElementById('propTipo').innerHTML = app.CONFIG.PROPERTY_TYPES.map(function (label) {
      return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
    }).join('');
    if (currentPropertyType) {
      document.getElementById('propTipo').value = currentPropertyType;
    }
    if (propComplemento) {
      propComplemento.innerHTML = app.CONFIG.PROPERTY_COMPLEMENTS.map(function (label) {
        return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
      }).join('');
      propComplemento.value = currentPropertyComplement || app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal';
    }
    document.getElementById('visitLarvicida').innerHTML = app.CONFIG.LARVICIDAS.map(function (label) {
      return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
    }).join('');
    if (currentLarvicida) {
      document.getElementById('visitLarvicida').value = currentLarvicida;
    }
    document.getElementById('visitAdulticida').innerHTML = app.CONFIG.ADULTICIDAS.map(function (label) {
      return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
    }).join('');
    if (currentAdulticida) {
      document.getElementById('visitAdulticida').value = currentAdulticida;
    }

    function fillSelect(node, values, emptyLabel, selectedValue) {
      if (!node) {
        return;
      }
      node.innerHTML = '<option value="">' + app.escapeHtml(emptyLabel) + '</option>' + values.map(function (value) {
        return '<option value="' + app.escapeHtml(value) + '">' + app.escapeHtml(value) + '</option>';
      }).join('');
      if (selectedValue) {
        node.value = selectedValue;
      }
    }

    app.syncAreaSelects = function (microareaNode, quarteiraoNode, selectedValue) {
      var microarea = microareaNode ? app.normalizeAreaCode(microareaNode.value) : '';
      var values = microarea && territory.byMicroarea[microarea] && territory.byMicroarea[microarea].length
        ? territory.byMicroarea[microarea]
        : [];
      fillSelect(
        quarteiraoNode,
        values,
        microarea ? (values.length ? 'Selecione o quarteirão' : 'Sem quarteirão neste território') : 'Selecione primeiro a microárea',
        selectedValue
      );
      if (quarteiraoNode) {
        quarteiraoNode.disabled = !microarea || !values.length;
      }
    };

    fillSelect(propMicroarea, territory.microareas, 'Selecione a microárea', currentPropertyMicroarea);
    app.syncAreaSelects(propMicroarea, propQuarteirao, currentPropertyQuarteirao);
  };

  app.renderProperties = function () {
    var list = app.readProperties();
    var search = String(document.getElementById('propertySearch').value || '').trim().toLowerCase();
    var sortNode = document.getElementById('propertySort');
    var sort = sortNode ? sortNode.value : 'distance';
    var sortLabel = sortNode && sortNode.selectedOptions[0]
      ? sortNode.selectedOptions[0].textContent
      : 'Ordem';
    var currentGps = app.state.visit.gps;
    var visits = app.readVisits();
    var currentAgent = app.state.currentAgent || {};
    if (app.state.selectedPropertyId && app.state.visit && app.state.visit.situacao) {
      visits = visits.concat([Object.assign({}, app.state.visit, {
        uid: app.state.editingVisitId || '__visita_em_andamento__',
        property_uid: app.state.selectedPropertyId,
        agente: currentAgent.nome || '',
        matricula: currentAgent.matricula || '',
        depositFocusTotal: app.totalFromMap(app.state.visit.depositFocusCounts || app.emptyDepositMap()),
        gps: app.state.visit.gps
      })]);
    }
    var currentAgentName = app.normalizeLabel(currentAgent.nome || '');
    var currentAgentCode = app.normalizeLabel(currentAgent.matricula || '');
    var quickFilter = ['all', 'opened', 'closed', 'recovered', 'focus', 'nogps', 'mine', 'registered'].indexOf(app.state.propertyQuickFilter) > -1
      ? app.state.propertyQuickFilter
      : 'all';
    var quickFilterLabels = {
      all: 'Todos',
      opened: 'Abertos',
      closed: 'Fechados',
      recovered: 'Recuperados',
      focus: 'Com foco',
      nogps: 'Sem GPS',
      mine: 'Visitei',
      registered: 'Cadastrei'
    };

    var operationModeApi = window.ACEOperationMode || null;
    var activeOperationPlan = operationModeApi && typeof operationModeApi.getActivePlan === 'function'
      ? operationModeApi.getActivePlan()
      : null;
    var activeOperationMode = operationModeApi && typeof operationModeApi.getCurrentMode === 'function'
      ? operationModeApi.getCurrentMode()
      : (activeOperationPlan ? String(activeOperationPlan.mode || activeOperationPlan.tipo_operacao || 'VD').toUpperCase() : 'VD');
    var territoryRestriction = operationModeApi && typeof operationModeApi.getTerritoryRestriction === 'function'
      ? operationModeApi.getTerritoryRestriction(activeOperationPlan)
      : null;
    var isRecoverySearch = app.state.visit && app.state.visit.situacao === 'Recuperado';
    var territoryNotice = '';
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
    function makeRestrictionUnitKey(microarea, quarteirao) {
      return normalizeTerritoryCompare(microarea) + '|' + normalizeQuarterCompare(quarteirao);
    }
    function propertyMatchesTerritoryRestriction(row) {
      if (!territoryRestriction) { return true; }
      if (territoryRestriction.blocked) { return false; }
      var units = Array.isArray(territoryRestriction.units) ? territoryRestriction.units : [];
      var propMicro = normalizeTerritoryCompare(row.property.microarea || row.property.bairro || '');
      var propQuarter = normalizeQuarterCompare(row.property.quarteirao || '');
      if (units.length) {
        var propUnitKey = propMicro + '|' + propQuarter;
        return units.some(function (unit) {
          return makeRestrictionUnitKey(unit.microarea || unit.territory || '', unit.quarteirao || unit.quarter || '') === propUnitKey;
        });
      }
      return false;
    }
    function propertyIsRecoveryCandidateForAgent(row) {
      return !!(row.last && app.normalizeStatus(row.last.situacao) === 'Fechado' && row.visitedByCurrentAgent);
    }
    var visitHistoryByPropertyId = {};
    var visitHistoryByAddress = {};
    var propertyAddressKeyById = {};
    var duplicateCountsByKey = {};
    var getDuplicateKey = function (property) {
      return [
        app.normalizeLabel(property.logradouro || ''),
        app.normalizeLabel(property.numero || ''),
        app.normalizeLabel(property.bairro || '')
      ].join('|');
    };
    visits.slice().sort(app.compareVisitDesc).forEach(function (visit) {
      var key = app.addressKey(visit);
      var propertyId = String(visit.property_uid || '').trim();
      if (propertyId) {
        if (!visitHistoryByPropertyId[propertyId]) {
          visitHistoryByPropertyId[propertyId] = [];
        }
        visitHistoryByPropertyId[propertyId].push(visit);
      }
      if (!visitHistoryByAddress[key]) {
        visitHistoryByAddress[key] = [];
      }
      visitHistoryByAddress[key].push(visit);
    });
    list.forEach(function (property) {
      var addressKey = app.addressKey(property);
      var duplicateKey = getDuplicateKey(property);
      propertyAddressKeyById[property.uid] = addressKey;
      if (duplicateKey !== '||') {
        duplicateCountsByKey[duplicateKey] = (duplicateCountsByKey[duplicateKey] || 0) + 1;
      }
    });
    var getFastPropertyQuality = function (property) {
      var flags = [];
      var duplicateKey = getDuplicateKey(property);
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
      if (duplicateKey !== '||' && duplicateCountsByKey[duplicateKey] > 1) {
        flags.push('Possível duplicidade');
      }
      return { flags: flags };
    };
    var matchesQuickFilter = function (row, filterKey) {
      if (filterKey === 'opened') {
        return !!(row.last && row.last.situacao === 'Visitado');
      }
      if (filterKey === 'closed') {
        return !!(row.last && row.last.situacao === 'Fechado');
      }
      if (filterKey === 'recovered') {
        return !!(row.last && row.last.situacao === 'Recuperado');
      }
      if (filterKey === 'focus') {
        return !!(row.last && (row.last.focusFound === 'Sim' || Number(row.last.focusQty || 0) > 0 || Number(row.last.depositFocusTotal || 0) > 0));
      }
      if (filterKey === 'nogps') {
        return !row.hasGps;
      }
      if (filterKey === 'mine') {
        return !!row.visitedByCurrentAgent;
      }
      if (filterKey === 'registered') {
        return !!row.createdByCurrentAgent;
      }
      return true;
    };

    var rows = list.map(function (property) {
      var historyById = visitHistoryByPropertyId[property.uid] || [];
      var historyByAddress = visitHistoryByAddress[propertyAddressKeyById[property.uid]] || [];
      var seenVisitIds = {};
      var history = historyById.concat(historyByAddress).filter(function (visit) {
        var visitKey = visit.uid || [visit.data, visit.hora, visit.agente, visit.situacao].join('|');
        if (seenVisitIds[visitKey]) {
          return false;
        }
        seenVisitIds[visitKey] = true;
        return true;
      }).sort(app.compareVisitDesc);
      var last = history[0] || null;
      var lat = property.lastLat !== null && property.lastLat !== undefined ? property.lastLat : (last && last.gps ? last.gps.lat : null);
      var lng = property.lastLng !== null && property.lastLng !== undefined ? property.lastLng : (last && last.gps ? last.gps.lng : null);
      var distance = currentGps ? app.calcDistanceMeters(currentGps.lat, currentGps.lng, lat, lng) : null;
      var visitedByCurrentAgent = history.some(function (visit) {
        var visitAgentName = app.normalizeLabel(visit.agente || '');
        var visitAgentCode = app.normalizeLabel(visit.matricula || '');
        return !!((currentAgentCode && visitAgentCode === currentAgentCode) ||
          (currentAgentName && visitAgentName === currentAgentName));
      });
      var createdByCurrentAgent = !!((currentAgentCode && app.normalizeLabel(property.createdByMatricula || '') === currentAgentCode) ||
        (currentAgentName && app.normalizeLabel(property.createdByName || '') === currentAgentName));
      return {
        property: property,
        history: history,
        last: last,
        distance: distance,
        hasGps: lat !== null && lng !== null,
        visitedByCurrentAgent: visitedByCurrentAgent,
        createdByCurrentAgent: createdByCurrentAgent
      };
    });

    if (territoryRestriction) {
      rows = rows.filter(propertyMatchesTerritoryRestriction);
      if (isRecoverySearch) {
        rows = rows.filter(propertyIsRecoveryCandidateForAgent);
      }
      territoryNotice = territoryRestriction.blocked
        ? (territoryRestriction.label || 'Plano operacional sem recorte territorial valido. Sincronize com internet ou acione a coordenacao.')
        : activeOperationMode + ' com território definido pela coordenação: ' + (territoryRestriction.label || 'recorte territorial aplicado') + '.';
    }

    if (search) {
      rows = rows.filter(function (row) {
        var text = [
          row.property.morador,
          row.property.telefone,
          row.property.microarea,
          row.property.quarteirao,
          row.property.bairro,
          row.property.logradouro,
          row.property.numero,
          row.property.complemento,
          row.property.referencia,
          row.property.obs
        ].join(' ').toLowerCase();
        return text.indexOf(search) > -1;
      });
    }

    var filterCounts = Object.keys(quickFilterLabels).reduce(function (acc, key) {
      acc[key] = rows.filter(function (row) { return matchesQuickFilter(row, key); }).length;
      return acc;
    }, {});

    rows = rows.filter(function (row) {
      return matchesQuickFilter(row, quickFilter);
    });

    rows.sort(function (a, b) {
      if (sort === 'recent') {
        var keyA = a.last ? a.last.data + ' ' + a.last.hora : '';
        var keyB = b.last ? b.last.data + ' ' + b.last.hora : '';
        return keyB.localeCompare(keyA);
      }
      if (sort === 'bairro') {
        return (a.property.bairro + ' ' + a.property.logradouro + ' ' + a.property.numero).localeCompare(
          b.property.bairro + ' ' + b.property.logradouro + ' ' + b.property.numero,
          'pt-BR',
          { numeric: true }
        );
      }
      if (sort === 'territory') {
        return app.compareAreaCode(a.property.microarea, b.property.microarea) ||
          app.compareAreaCode(a.property.quarteirao, b.property.quarteirao) ||
          (a.property.bairro + ' ' + a.property.logradouro + ' ' + a.property.numero).localeCompare(
            b.property.bairro + ' ' + b.property.logradouro + ' ' + b.property.numero,
            'pt-BR',
            { numeric: true, sensitivity: 'base' }
          );
      }
      var aDistance = a.distance === null ? Number.MAX_SAFE_INTEGER : a.distance;
      var bDistance = b.distance === null ? Number.MAX_SAFE_INTEGER : b.distance;
      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      return (a.property.bairro + ' ' + a.property.logradouro + ' ' + a.property.numero).localeCompare(
        b.property.bairro + ' ' + b.property.logradouro + ' ' + b.property.numero,
        'pt-BR',
        { numeric: true }
      );
    });

    var node = document.getElementById('propertyList');
    var renderLimit = 160;
    var visibleRows = rows.slice(0, renderLimit);
    var hiddenCount = rows.length - visibleRows.length;
    var cards = visibleRows.map(function (row) {
      var property = row.property;
      var quality = getFastPropertyQuality(property);
      var tags = [];
      var personText = (property.morador || 'Morador não informado') + (property.telefone ? ' • ' + property.telefone : '');
      var referenceText = app.getPropertyReferenceText(property);
      var lastParts = [];
      var territoryParts = [];
      var statusText = row.last && row.last.situacao ? row.last.situacao : 'Sem visita';
      var statusClass = row.last && row.last.focusFound === 'Sim' ? ' is-danger' :
        row.last && row.last.situacao === 'Fechado' ? ' is-warn' :
        row.last && row.last.situacao === 'Recuperado' ? ' is-accent' :
        row.last ? ' is-ok' : ' is-muted';
      tags.push(row.distance !== null ?
        '<span class="status-pill is-accent">Perto: ' + app.escapeHtml(app.formatDistance(row.distance)) + '</span>' :
        '<span class="status-pill is-warn">Sem GPS</span>');
      if (row.last) {
        tags.push('<span class="status-pill ' + (row.last.focusFound === 'Sim' ? 'is-danger' : 'is-ok') + '">Última: ' + app.escapeHtml(app.formatDateBR(row.last.data)) + '</span>');
        lastParts.push('Última ' + app.formatDateBR(row.last.data));
      }
      if (row.last && row.last.agente) {
        lastParts.push(row.last.agente);
      }
      if (row.history.length) {
        lastParts.push(row.history.length + ' visita(s)');
      }
      if (property.microarea || property.quarteirao) {
        territoryParts.push('MA ' + String(property.microarea || '-'));
        territoryParts.push('Q ' + String(property.quarteirao || '-'));
      }
      if (row.last && row.last.situacao) {
        territoryParts.push(row.last.situacao);
      }
      if (quality.flags.length) {
        tags.push('<span class="status-pill is-warn">' + app.escapeHtml(quality.flags.join(' • ')) + '</span>');
      }
      if (row.visitedByCurrentAgent) {
        tags.push('<span class="status-pill is-accent">Você já visitou</span>');
      }
      if (row.createdByCurrentAgent) {
        tags.push('<span class="status-pill is-ok">Você cadastrou</span>');
      }
      var addressParts = [property.logradouro, property.numero];
      if (property.complemento) {
        addressParts.push(property.complemento);
      }
      if (property.bairro) {
        addressParts.push(property.bairro);
      }
      var propertyAddressText = addressParts.filter(Boolean).join(', ');
      var propertyTubitos = typeof app.getTubitosForProperty === 'function' ? app.getTubitosForProperty(property) : [];
      var notificationCount = 0;
      if (row.last) {
        [
          row.last.ladder_support_status,
          row.last.solicita_escada,
          row.last.ladder_support_requested,
          row.last.situacao_caixa_agua,
          row.last.water_tank_condition
        ].some(function (value) {
          if (String(value || '').trim()) {
            notificationCount += 1;
            return true;
          }
          return false;
        });
      }
      row.history.forEach(function (visit) {
        var visitStatus = String(visit.situacao || '').toLowerCase();
        if (visitStatus === 'fechado' || String(visit.closedReason || visit.closed_reason || visit.motivo_fechado || '').trim()) {
          notificationCount += 1;
        }
      });
      var operationMode = row.last
        ? String(row.last.operationMode || row.last.tipo_operacao || row.last.modo_operacao || row.last.modo || 'VD')
        : '';
      var operationModeLabel = operationMode
        ? (app.getOperationModeLabel ? app.getOperationModeLabel(operationMode) : operationMode)
        : '';
      var operationModeBadgeClass = '';
      if (operationModeLabel.toUpperCase().indexOf('LIRAA') > -1) {
        operationModeBadgeClass = ' purple';
      } else if (operationModeLabel.toUpperCase().indexOf('P.E') > -1 || operationModeLabel.toUpperCase().indexOf('PE') > -1) {
        operationModeBadgeClass = ' warn';
      } else if (operationModeLabel) {
        operationModeBadgeClass = ' success';
      }
      var cardBadges = [
        row.last
          ? '<span class="badge">Última: ' + app.escapeHtml(app.formatDateBR(row.last.data)) + '</span>'
          : '<span class="badge warn">Sem visita</span>',
        operationModeLabel
          ? '<span class="badge' + operationModeBadgeClass + '">' + app.escapeHtml(operationModeLabel) + '</span>'
          : '',
        propertyTubitos.length
          ? '<span class="badge success">Tubitos: ' + app.escapeHtml(String(propertyTubitos.length)) + '</span>'
          : '<span class="badge">Sem tubitos</span>',
        notificationCount
          ? '<span class="badge warn">Pend.: ' + app.escapeHtml(String(notificationCount)) + '</span>'
          : ''
      ].join('');
      return '' +
        '<div class="property-card property-result-card secretaria-style-card' + (row.distance !== null ? ' is-near' : '') + (row.last && row.last.focusFound === 'Sim' ? ' is-focus' : '') + (property.uid === app.state.selectedPropertyId ? ' is-selected' : '') + '">' +
          '<div class="property-card-row property-card-row-secretaria">' +
            '<div class="property-card-copy">' +
              '<h3 class="property-card-title">' + app.escapeHtml(property.morador || 'Sem morador informado') + '</h3>' +
              '<div class="property-card-address">' + app.escapeHtml(propertyAddressText || 'Endereço não informado') + '</div>' +
              '<div class="property-card-secretaria-line">Microárea ' + app.escapeHtml(property.microarea || '—') + ' • Quarteirão ' + app.escapeHtml(property.quarteirao || '—') + ' • Tel.: ' + app.escapeHtml(property.telefone || '—') + '</div>' +
              '<div class="badge-row property-card-badges">' + cardBadges + '</div>' +
            '</div>' +
            '<div class="property-card-actions-side property-card-actions-bottom">' +
              '<button class="btn btn-primary" type="button" data-property-select="' + app.escapeHtml(property.uid) + '">Selecionar</button>' +
              '<button class="btn btn-warn" type="button" data-property-edit="' + app.escapeHtml(property.uid) + '">Editar</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
    var resultLabel = rows.length + ' imóvel(is)';
    var filterButtons = Object.keys(quickFilterLabels).map(function (key) {
      return '' +
        '<button class="property-filter-btn property-filter-' + app.escapeHtml(key) + (quickFilter === key ? ' is-active' : '') + '" type="button" data-property-quick-filter="' + app.escapeHtml(key) + '">' +
          app.escapeHtml(quickFilterLabels[key]) +
          '<span>' + app.escapeHtml(String(filterCounts[key] || 0)) + '</span>' +
        '</button>';
    }).join('');

    var summaryNode = document.getElementById('propertyQuerySummary');
    if (summaryNode) {
      summaryNode.innerHTML = '' +
        '<strong>Resultados</strong>' +
        '<span>' + app.escapeHtml(resultLabel) + (quickFilter !== 'all' ? ' em ' + app.escapeHtml(quickFilterLabels[quickFilter].toLowerCase()) : '') + (territoryNotice ? ' • ' + app.escapeHtml(territoryNotice) : '') + '</span>';
    }

    node.innerHTML = '' +
      '<div class="property-list-head">' +
        (territoryNotice ? '<div class="status-pill is-accent" style="margin-bottom:8px">' + app.escapeHtml(territoryNotice) + '</div>' : '') +
        '<div class="property-list-filters">' +
          filterButtons +
        '</div>' +
      '</div>' +
      '<div class="property-list-body">' +
        (rows.length ? cards : '<div class="empty-state empty-state-action"><strong>Nenhum imóvel encontrado</strong><span>Revise a busca, troque o filtro ou cadastre o endereço.</span></div>') +
        (hiddenCount > 0
          ? '<div class="property-list-more">Mostrando ' + app.escapeHtml(String(visibleRows.length)) + '/' + app.escapeHtml(String(rows.length)) + '. Use a busca ou filtros.</div>'
          : '') +
      '</div>';
    app.renderPropertyFieldGuide();
  };

  app.renderRecentTubitosTable = function () {
    var node = document.getElementById('recentTubitosTable');
    var cardsNode = document.getElementById('recentTubitosCards');
    if (!node && !cardsNode) { return; }
    var agent = app.state.currentAgent || null;
    var rows = app.readVisits().filter(function (visit) {
      if (agent && !app.visitBelongsToAgent(visit, agent)) { return false; }
      if (Number(visit.tubitosQty || 0) <= 0) { return false; }
      var tubitos = typeof app.getTubitosForVisit === 'function' ? app.getTubitosForVisit(visit) : [];
      return tubitos.length > 0 || Number(visit.tubitosQty || 0) > 0;
    }).sort(app.compareVisitDesc).slice(0, 8);

    if (!rows.length) {
      if (node) {
        node.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#66727c">Nenhum tubito gerado nas visitas do dia.</td></tr>';
      }
      if (cardsNode) {
        cardsNode.innerHTML = '<div class="empty-state">Nenhum tubito gerado nas visitas do dia.</div>';
      }
      return;
    }

    var prepared = rows.map(function (visit, index) {
      var tubitos = typeof app.getTubitosForVisit === 'function' ? app.getTubitosForVisit(visit) : [];
      var groupedCodes = {};
      tubitos.forEach(function (row) {
        var depositCode = row.depositoCodigo || 'Sem depósito';
        groupedCodes[depositCode] = groupedCodes[depositCode] || [];
        if (row.numeroTubito) { groupedCodes[depositCode].push(row.numeroTubito); }
      });
      var codes = Object.keys(groupedCodes).map(function (depositCode) {
        var label = app.DEPOSITS[depositCode] ? (depositCode + ' - ' + app.DEPOSITS[depositCode]) : depositCode;
        return label + ': ' + groupedCodes[depositCode].join(', ');
      });
      var address = [visit.logradouro, visit.numero].filter(Boolean).join(', ');
      var detail = [visit.bairro, visit.microarea, visit.quarteirao].filter(Boolean).join(' • ');
      var tubitoText = codes.length ? codes.join(', ') : ((app.formatTubitoDepositSummary(visit) || visit.tubitosQty + ' tubito(s)') + ' sem numeração local');
      return {
        index: index,
        visit: visit,
        address: address || 'Imóvel sem endereço',
        detail: detail,
        tubitoText: tubitoText
      };
    });

    if (node) {
      node.innerHTML = prepared.map(function (row) {
        var visit = row.visit;
        return '' +
          '<tr>' +
            '<td><strong>Visita ' + app.escapeHtml(String(row.index + 1)) + '</strong><br><span style="color:#66727c">' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</span></td>' +
            '<td><strong>' + app.escapeHtml(row.address) + '</strong>' + (row.detail ? '<br><span style="color:#66727c">' + app.escapeHtml(row.detail) + '</span>' : '') + '</td>' +
            '<td><span class="tubito-code-list">' + app.escapeHtml(row.tubitoText) + '</span></td>' +
          '</tr>';
      }).join('');
    }

    if (cardsNode) {
      cardsNode.innerHTML = prepared.map(function (row) {
        var visit = row.visit;
        return '' +
          '<article class="panel-list-card panel-tubito-list-card">' +
            '<small>Visita ' + app.escapeHtml(String(row.index + 1)) + ' • ' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</small>' +
            '<strong>' + app.escapeHtml(row.address) + '</strong>' +
            (row.detail ? '<span>' + app.escapeHtml(row.detail) + '</span>' : '') +
            '<span class="tubito-code-list">' + app.escapeHtml(row.tubitoText) + '</span>' +
          '</article>';
      }).join('');
    }
  };

  app.renderTodayVisitsTable = function () {
    var node = document.getElementById('todayVisitsTable');
    var cardsNode = document.getElementById('todayVisitsCards');
    var agent = app.state.currentAgent || null;
    var rows = app.readVisits().filter(function (visit) {
      return !agent || app.visitBelongsToAgent(visit, agent);
    }).sort(app.compareVisitDesc).slice(0, 25);
    if (!rows.length) {
      if (node) {
        node.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#66727c">Nenhuma visita sua registrada ainda. Selecione um imóvel e toque em Iniciar visita.</td></tr>';
      }
      if (cardsNode) {
        cardsNode.innerHTML = '<div class="empty-state">Nenhuma visita sua registrada ainda. Selecione um imóvel e toque em Iniciar visita.</div>';
      }
      return;
    }
    if (node) {
      node.innerHTML = rows.map(function (visit) {
        var waterText = app.buildWaterAccessText(visit);
        return '' +
          '<tr>' +
            '<td>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</td>' +
            '<td>' + app.escapeHtml(app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD')) + '</td>' +
            '<td><strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><br><span style="color:#66727c">' + app.escapeHtml(visit.bairro + ' • ' + visit.agente) + '</span></td>' +
            '<td>' + app.escapeHtml(visit.focusFound + ' • ' + visit.focusQty) + '</td>' +
            '<td>' + app.escapeHtml(String(visit.depositFocusTotal)) + '</td>' +
            '<td>' + app.escapeHtml(waterText) + '</td>' +
            '<td><button class="btn btn-soft" type="button" data-visit-edit="' + app.escapeHtml(visit.uid) + '">Editar</button></td>' +
          '</tr>';
      }).join('');
    }
    if (cardsNode) {
      cardsNode.innerHTML = rows.slice(0, 12).map(function (visit) {
        var waterText = app.buildWaterAccessText(visit);
        var address = [visit.logradouro, visit.numero].filter(Boolean).join(', ') || 'Imóvel sem endereço';
        var tags = [];
        tags.push('<span class="tag">' + app.escapeHtml(app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD')) + '</span>');
        tags.push('<span class="tag">' + app.escapeHtml(app.getVisitStatusLabel ? app.getVisitStatusLabel(visit.situacao) : visit.situacao) + '</span>');
        if (visit.focusFound === 'Sim' || Number(visit.depositFocusTotal || 0) > 0) {
          tags.push('<span class="status-pill is-danger">' + app.escapeHtml(String(visit.depositFocusTotal || visit.focusQty || 0)) + ' foco(s)</span>');
        }
        if (visit.synced === false) {
          tags.push('<span class="status-pill is-warn">No tablet</span>');
        }
        return '' +
          '<article class="panel-list-card panel-visit-list-card">' +
            '<small>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</small>' +
            '<strong>' + app.escapeHtml(address) + '</strong>' +
            '<span>' + app.escapeHtml([visit.bairro, visit.agente].filter(Boolean).join(' • ') || 'Sem bairro informado') + '</span>' +
            '<div class="meta-pills">' + tags.join('') + '</div>' +
            '<span>Caixa: ' + app.escapeHtml(waterText) + '</span>' +
            '<div class="panel-list-card-actions"><button class="btn btn-soft" type="button" data-visit-edit="' + app.escapeHtml(visit.uid) + '">Editar</button></div>' +
          '</article>';
      }).join('');
    }
  };


  app.renderOfflineReadinessCard = function () {
    var card = document.getElementById('offlineReadinessCard');
    var titleNode = document.getElementById('offlineReadyTitle');
    var textNode = document.getElementById('offlineReadyText');
    var badgeNode = document.getElementById('offlineReadyBadge');
    var metaNode = document.getElementById('offlineReadyMeta');
    var checksNode = document.getElementById('offlineReadyChecks');
    var startBtn = document.getElementById('offlineReadyStartBtn');
    var token;
    if (!card || !titleNode || !textNode || !badgeNode || !checksNode || typeof app.getOfflineReadinessStatus !== 'function') {
      return;
    }
    if (typeof app.isOfflineReadinessDismissed === 'function' && app.isOfflineReadinessDismissed()) {
      card.className = 'offline-ready-card is-dismissed';
      card.setAttribute('aria-hidden', 'true');
      return;
    }
    card.removeAttribute('aria-hidden');
    token = String(Date.now()) + '-' + Math.random();
    app._offlineReadinessRenderToken = token;
    card.className = 'offline-ready-card is-pending';
    badgeNode.className = 'offline-ready-badge is-pending';
    badgeNode.textContent = 'Verificando';
    titleNode.textContent = 'Preparando uso offline';
    textNode.textContent = 'Conferindo se este tablet está pronto para trabalhar sem internet.';
    if (startBtn) { startBtn.disabled = true; }
    checksNode.innerHTML = '<div class="offline-ready-loading">Verificando sessão, cache e dados locais...</div>';
    if (metaNode) { metaNode.innerHTML = ''; }

    app.getOfflineReadinessStatus().then(function (status) {
      var statusClass;
      var operation;
      var pending;
      if (app._offlineReadinessRenderToken !== token) {
        return;
      }
      status = status || { status: 'error', title: 'Não saia para campo ainda', text: 'Não foi possível verificar o preparo offline.', checks: [] };
      statusClass = status.status === 'ok' ? 'is-ok' : (status.status === 'pending' ? 'is-pending' : 'is-error');
      card.className = 'offline-ready-card ' + statusClass;
      badgeNode.className = 'offline-ready-badge ' + statusClass;
      badgeNode.textContent = status.status === 'ok' ? 'OK' : (status.status === 'pending' ? 'Pendente' : 'Atenção');
      titleNode.textContent = status.title || 'Preparando uso offline';
      textNode.textContent = status.text || '';
      if (startBtn) { startBtn.disabled = status.status !== 'ok'; }
      operation = status.operation || {};
      pending = status.pending || {};
      if (metaNode) {
        metaNode.innerHTML = [
          '<span><strong>Operação:</strong> ' + app.escapeHtml(operation.label || 'VD') + '</span>',
          '<span><strong>Data:</strong> ' + app.escapeHtml(operation.planDate ? app.formatDateBR(operation.planDate) : app.formatDateBR(app.todayISO())) + '</span>',
          '<span><strong>Agente:</strong> ' + app.escapeHtml(status.agent ? ((status.agent.matricula || '-') + ' • ' + (status.agent.nome || '')) : '-') + '</span>',
          '<span><strong>Pendentes:</strong> ' + app.escapeHtml(String(Number(pending.total || 0))) + ' item(ns)</span>'
        ].join('');
      }
      checksNode.innerHTML = (status.checks || []).map(function (check) {
        var kind = check.status === 'ok' ? 'is-ok' : (check.status === 'pending' ? 'is-pending' : 'is-error');
        var statusText = check.status === 'ok' ? 'OK' : (check.status === 'pending' ? 'Pendente' : 'Erro');
        return '' +
          '<div class="offline-ready-check ' + kind + '">' +
            '<span class="offline-ready-check__status">' + app.escapeHtml(statusText) + '</span>' +
            '<span class="offline-ready-check__label">' + app.escapeHtml(check.label || '') + '</span>' +
            (check.detail ? '<small>' + app.escapeHtml(check.detail) + '</small>' : '') +
          '</div>';
      }).join('');
    }).catch(function () {
      if (app._offlineReadinessRenderToken !== token) {
        return;
      }
      card.className = 'offline-ready-card is-error';
      badgeNode.className = 'offline-ready-badge is-error';
      badgeNode.textContent = 'Erro';
      titleNode.textContent = 'Não saia para campo ainda';
      textNode.textContent = 'Não foi possível confirmar o preparo offline deste aparelho. Mantenha a internet ligada e toque em Verificar novamente.';
      if (startBtn) { startBtn.disabled = true; }
      checksNode.innerHTML = '<div class="offline-ready-loading">Falha ao executar o diagnóstico offline.</div>';
    });
  };

  app.renderLocalPanel = function () {
    var snapshot = app.buildLocalSnapshot();
    var totals = snapshot.totals;

    app.renderPanelOfflineCommand();
    app.renderPanelFieldGuide();
    app.renderPanelNextAction();
    app.renderOfflineReadinessCard();
    if (typeof app.renderSyncDayStatus === 'function') {
      app.renderSyncDayStatus();
    }
    app.renderRecentTubitosTable();

    document.getElementById('localMetricGrid').innerHTML = [
      app.makeMetricCard('Abertos', totals.opened, 'ok'),
      app.makeMetricCard('Fechados', totals.closed, 'warn'),
      app.makeMetricCard('Recuperados', totals.recovered, 'accent'),
      app.makeMetricCard('Tubitos', totals.tubitos, 'warn'),
      app.makeMetricCard('Depósitos com foco', totals.depositsWithFocus, 'danger'),
      app.makeMetricCard('BPI aplicado (g)', totals.bpiGrams || 0, 'warn')
    ].join('');

    var rankingNode = document.getElementById('localDepositSummary');
    var ranking = Object.keys(app.DEPOSITS).map(function (code) {
      return {
        code: code,
        label: app.DEPOSITS[code],
        total: snapshot.depositRanking[code],
        focus: snapshot.depositFocusRanking[code]
      };
    }).filter(function (row) { return Number(row.focus || 0) > 0; });

    if (!ranking.length) {
      rankingNode.innerHTML = '<div class="empty-state empty-state-action"><strong>Nenhum depósito com foco hoje</strong><span>Quando uma visita registrar foco, este bloco mostra somente os depósitos positivos.</span></div>';
    } else {
      var max = ranking.reduce(function (acc, row) { return Math.max(acc, Number(row.focus || 0)); }, 1);
      rankingNode.innerHTML = ranking.map(function (row) {
        var focusCount = Number(row.focus || 0);
        var width = Math.max(8, Math.round((focusCount / max) * 100));
        return '' +
          '<div class="ranking-card deposit-report-card is-focus">' +
            '<div class="rank-row">' +
              '<strong class="deposit-report-code">' + app.escapeHtml(row.code) + '</strong>' +
              '<div class="bar-track"><div class="bar-fill is-danger" style="width:' + width + '%"></div></div>' +
              '<strong>' + app.escapeHtml(String(focusCount)) + '</strong>' +
            '</div>' +
            '<div style="margin-top:8px;color:#66727c">' + app.escapeHtml(row.label) + ' • com foco encontrado</div>' +
          '</div>';
      }).join('');
    }

    var recNode = document.getElementById('localRecommendations');
    var recs = [];
    var queueSummary = app.getOfflineQueueSummary ? app.getOfflineQueueSummary() : { total: app.getUnsyncedVisits().length };
    var todayLabel = app.formatDateBR ? app.formatDateBR(app.todayISO()) : app.todayISO();
    if (Number(queueSummary.total || 0) > 0) {
      recs.push('Há dados salvos somente neste tablet. Sincronize quando tiver internet antes de entregar, trocar de navegador ou limpar o aparelho. Pendentes: ' + Number(queueSummary.total || 0) + ' item(ns).');
    }
    if (totals.infestationRate >= 20) {
      recs.push('Priorize bloqueio e retorno nos pontos com maior carga de depósitos com foco.');
    }
    if (totals.pending > 0) {
      recs.push('Existem pendências no dia; organize nova passagem por quarteirão e microárea.');
    }
    if (totals.gpsCoverage < 80) {
      recs.push('Capture GPS com mais frequência para fortalecer o mapa de calor e a rastreabilidade.');
    }
    if (totals.returns > 0) {
      recs.push('Há imóveis fechados ou recusas; programe nova tentativa de abordagem.');
    }
    if (!recs.length) {
      recs.push('Produção estável. Continue registrando visitas com foco em qualidade de dado.');
    }
    recNode.innerHTML = recs.map(function (text, index) {
      return '' +
        '<div class="mail-report-card mail-report-card--mini">' +
          '<div class="mail-report-meta">' + app.escapeHtml(String(index + 1).padStart(2, '0')) + '</div>' +
          '<p>' + app.escapeHtml(text) + '</p>' +
        '</div>';
    }).join('');

    if (typeof app.renderSyncDayStatus === 'function') {
      app.renderSyncDayStatus();
    }

    var closeDayBtn = document.getElementById('closeDayBtn');
    var closingDay = !!app.state.closeDayInFlight;
    if (closeDayBtn) {
      var closePolicy = app.getCloseDayPolicy ? app.getCloseDayPolicy() : { allowed: true, label: 'VD', closeAfter: '' };
      var closeHealth = app.getServiceHealth ? app.getServiceHealth() : { offline: false };
      closeDayBtn.disabled = closingDay;
      closeDayBtn.textContent = closingDay ? 'Encerrando...' : (closeHealth.offline ? 'Preparar encerramento' : 'Encerrar dia');
      closeDayBtn.title = closingDay
        ? 'Enviando e limpando a rotina do dia.'
        : (closeHealth.offline
          ? 'Sem internet: confira fila local e exporte backup antes de entregar o tablet.'
          : (closePolicy.allowed
          ? 'Envia pendências, limpa a rotina local e volta para o login.'
          : 'Envia pendências, limpa a rotina local e volta para o login.'));
    }
  };

  app.renderMapInsights = function () {
    var visits = app.getTodayVisitsForCurrentAgent();
    var focusBairros = app.aggregateByField(visits, 'bairro', function (visit) {
      return visit.focusFound === 'Sim' || visit.depositFocusTotal > 0;
    }).slice(0, 5);
    var returns = visits.filter(function (visit) {
      return visit.situacao === 'Fechado' || visit.situacao === 'Recusa';
    }).slice(0, 5);
    var gpsVisits = visits.filter(function (visit) { return visit.gps; }).sort(app.compareVisitDesc).slice(0, 6);

    var insights = document.getElementById('mapInsights');
    insights.innerHTML = focusBairros.length ? focusBairros.map(function (item, index) {
      return '<div class="insight-card"><strong>' + app.escapeHtml((index + 1) + '. ' + item.name) + '</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(String(item.total)) + ' ocorrência(s) com foco.</div></div>';
    }).join('') : '<div class="empty-state">Sem focos georreferenciados hoje para leitura territorial.</div>';

    if (returns.length) {
      insights.innerHTML += returns.map(function (visit) {
        return '<div class="insight-card"><strong>Retorno sugerido</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(visit.logradouro + ', ' + visit.numero + ' • ' + visit.situacao) + '</div></div>';
      }).join('');
    }

    var timeline = document.getElementById('gpsTimeline');
    timeline.innerHTML = gpsVisits.length ? gpsVisits.map(function (visit) {
      var tags = [];
      tags.push('<span class="tag">' + app.escapeHtml(app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD')) + '</span>');
      tags.push('<span class="tag">' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</span>');
      if (visit.focusFound === 'Sim') {
        tags.push('<span class="status-pill is-danger">' + app.escapeHtml(String(visit.focusQty)) + ' foco(s)</span>');
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        tags.push('<span class="status-pill is-warn">' + app.escapeHtml(visit.situacao) + '</span>');
      }
      return '<div class="history-card"><strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(visit.bairro + ' • ' + visit.agente) + '</div><div class="meta-pills">' + tags.join('') + '</div></div>';
    }).join('') : '<div class="empty-state">Nenhum ponto com GPS capturado no dia.</div>';
  };

  app.renderMap = function () {
    if (app.state.selectedScreen !== 'mapa') {
      return;
    }
    if (!app.state.map) {
      app.state.map = L.map('fieldMap', {
        tap: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        scrollWheelZoom: false,
        keyboard: false,
        zoomControl: false,
        zoomAnimation: false,
        markerZoomAnimation: false
      }).setView(app.CONFIG.MAP_CENTER, app.CONFIG.MAP_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(app.state.map);
      app.state.map.setMinZoom(app.CONFIG.MAP_ZOOM);
      app.state.map.setMaxZoom(app.CONFIG.MAP_ZOOM);
    }

    app.state.mapLayers.forEach(function (layer) {
      app.state.map.removeLayer(layer);
    });
    app.state.mapLayers = [];

    var visits = app.getTodayVisits();
    var points = [];
    var heat = {};

    visits.forEach(function (visit) {
      if (!visit.gps) {
        return;
      }
      var lat = visit.gps.lat;
      var lng = visit.gps.lng;
      var needsReturn = visit.situacao === 'Fechado' || visit.situacao === 'Recusa';
      var color = visit.focusFound === 'Sim' ? '#c34747' : (needsReturn ? '#c78615' : '#2f7a52');
      var marker = L.circleMarker([lat, lng], {
        radius: visit.focusFound === 'Sim' ? 9 : 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9
      }).addTo(app.state.map);
      marker.bindPopup(
        '<strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><br>' +
        app.escapeHtml(visit.bairro) + '<br>' +
        'Operação: <strong>' + app.escapeHtml(app.getOperationModeLabel ? app.getOperationModeLabel(visit.operationMode || 'VD') : (visit.operationMode || 'VD')) + '</strong><br>' +
        'Situação: <strong>' + app.escapeHtml(visit.situacao) + '</strong><br>' +
        'Foco: <strong>' + app.escapeHtml(visit.focusFound) + '</strong><br>' +
        'Depósitos com foco: <strong>' + app.escapeHtml(String(visit.depositFocusTotal)) + '</strong><br>' +
        'Agente: ' + app.escapeHtml(visit.agente || '-')
      );
      app.state.mapLayers.push(marker);
      points.push([lat, lng]);

      if (visit.focusFound === 'Sim' || visit.depositFocusTotal > 0) {
        var key = lat.toFixed(3) + '|' + lng.toFixed(3);
        if (!heat[key]) {
          heat[key] = { lat: lat, lng: lng, weight: 0 };
        }
        heat[key].weight += Math.max(1, visit.focusQty || visit.depositFocusTotal || 1);
      }
    });

    Object.keys(heat).forEach(function (key) {
      var item = heat[key];
      var heatVisual = getHeatVisual(item.weight);
      var circle = L.circle([item.lat, item.lng], {
        radius: 80 + (item.weight * 18),
        color: heatVisual.stroke,
        weight: 1,
        fillColor: heatVisual.fill,
        fillOpacity: heatVisual.opacity
      }).addTo(app.state.map);
      circle.bindPopup('Mapa de calor: ' + item.weight + ' ocorrência(s) ponderadas.');
      app.state.mapLayers.push(circle);
      points.push([item.lat, item.lng]);
    });

    if (points.length) {
      var center = L.latLngBounds(points).getCenter();
      app.state.map.setView(center, app.CONFIG.MAP_ZOOM, { animate: false });
    } else {
      app.state.map.setView(app.CONFIG.MAP_CENTER, app.CONFIG.MAP_ZOOM, { animate: false });
    }
    setTimeout(function () {
      app.state.map.invalidateSize();
    }, 120);
    app.renderMapInsights();
  };

  app.renderTubitoRange = function () {
    var node = document.getElementById('visitTubitosRange');
    var tubitoRange = app.getTubitoRangeForVisit(app.state.visit, app.state.editingVisitId);
    if (!node) {
      return;
    }
    node.textContent = tubitoRange.text;
    node.classList.toggle('is-empty', tubitoRange.count === 0);
  };

  app.updateVisitFormFromState = function () {
    var visit = app.state.visit;
    var treatmentCard = document.querySelector('.visit-treatment-card');
    var tubitosField = document.querySelector('.visit-tubitos-field');
    var hasDepositTreatment = app.totalFromMap(visit.depositTreatmentCounts || app.emptyDepositMap()) > 0;
    document.getElementById('visitDate').value = visit.data;
    document.getElementById('visitTime').value = visit.hora;
    app.fillPropertyFormOptions();
    if (typeof app.applySelectedPropertyToVisitContext === 'function') {
      app.applySelectedPropertyToVisitContext();
    }
    if (document.getElementById('visitTubitosQty')) {
      document.getElementById('visitTubitosQty').value = visit.tubitosQty;
    }
    app.renderTubitoRange();
    document.getElementById('visitLarvicida').value = visit.larvicida;
    document.getElementById('visitLarvicidaQty').value = visit.larvicidaQty;
    document.getElementById('visitAdulticida').value = visit.adulticida;
    document.getElementById('visitAdulticidaQty').value = visit.adulticidaQty;
    if (treatmentCard) {
      treatmentCard.hidden = !hasDepositTreatment;
    }
    if (tubitosField) {
      tubitosField.hidden = true;
    }
    if (document.getElementById('visitAttendedBy')) {
      document.getElementById('visitAttendedBy').value = visit.attendedBy || '';
    }
    document.getElementById('visitObs').value = visit.obs;
    var depositGate = document.querySelector('.visit-step-gate');
    if (depositGate) {
      depositGate.hidden = visit.depositFound === 'Sim';
    }

    app.renderChoiceButtons('situacaoChoices', [
      { value: 'Visitado', label: 'Aberto', help: 'Imóvel aberto e trabalhado.' },
      { value: 'Fechado', label: 'Fechado', help: 'Imóvel sem acesso; informe o motivo.' },
      { value: 'Recuperado', label: 'Recuperado', help: 'Retorno feito com sucesso após um fechado anterior.' }
    ], visit.situacao, 'situacao');

    app.renderChoiceButtons('waterAccessChoices', [
      { value: 'Sim', label: 'Sim', help: 'A caixa d\'água foi acessada.' },
      { value: 'Não', label: 'Não', help: 'Não foi possível acessar a caixa d\'água.' }
    ], visit.waterAccess, 'water');

    app.renderClosedReasonField();
    app.renderChoiceButtons('depositFoundChoices', [
      { value: 'Sim', label: 'Sim', help: 'Há depósito para registrar.' },
      { value: 'Não', label: 'Não', help: 'Nenhum depósito encontrado nesta visita.' }
    ], visit.depositFound, 'deposit-found');
    app.renderWaterAccessReasonField();
    app.renderLadderSupportField();
    app.renderLadderSupportNoReasonField();
    app.renderWaterTankConditionField();
    app.renderWaterTreatmentField();
    app.renderWaterLegalAlert();
    app.renderDepositGrid();
    app.renderFocusAutoSummary();
    app.renderVisitFieldGuide();
    app.renderSelectedPropertyCard();
    app.renderSelectedHistory();
    app.createVisitSummary();
    if (typeof app.renderVisitWizard === 'function') {
      app.renderVisitWizard();
    }
  };

  app.renderAll = function () {
    app.renderHero();
    app.updateVisitFormFromState();
    app.renderProperties();
    app.renderTodayVisitsTable();
    app.renderLocalPanel();
    if (typeof app.renderSyncCenter === 'function') {
      app.renderSyncCenter();
    }
    if (typeof app.renderAdminSystemPanel === 'function') {
      app.renderAdminSystemPanel();
    }
    if (typeof app.renderGpsTerritoryStatus === 'function') {
      app.renderGpsTerritoryStatus();
    }
  };
}());
