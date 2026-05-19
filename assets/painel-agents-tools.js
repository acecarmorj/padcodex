(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var version = '20260425-agents-ladder-print1';
  var LADDER_ATTENDED_KEY = 'ace_panel_ladder_attended_v1';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseJson(raw, fallback) {
    if (!raw) { return fallback; }
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }

  function normalizeLabel(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[’'`´]/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }



  function readAttendedRequests() {
    var raw;
    try {
      raw = root.localStorage && root.localStorage.getItem(LADDER_ATTENDED_KEY);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (error) {
      return {};
    }
  }

  function writeAttendedRequests(map) {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(LADDER_ATTENDED_KEY, JSON.stringify(map || {}));
      }
    } catch (error) {}
  }

  function getLadderRequestKey(visit) {
    visit = visit || {};
    return String(visit.uid || '').trim() || [
      visit.data || '',
      visit.hora || '',
      visit.agente || '',
      visit.matricula || '',
      visit.logradouro || '',
      visit.numero || '',
      visit.bairro || ''
    ].join('|');
  }

  function isLadderAttended(visit) {
    var key = getLadderRequestKey(visit);
    var attended = readAttendedRequests();
    return !!(key && attended[key]);
  }

  function markLadderAttended(key) {
    var attended = readAttendedRequests();
    if (!key) { return; }
    attended[key] = new Date().toISOString();
    writeAttendedRequests(attended);
  }

  function getOpenLadderRequests(visits) {
    return (visits || []).map(normalizeVisit).filter(requestedLadder).filter(function (visit) {
      return !isLadderAttended(visit);
    }).sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '') + ' ' + (b.updatedAt || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '') + ' ' + (a.updatedAt || '')));
    });
  }

  function getOpenLadderRequestCount() {
    return getOpenLadderRequests(getVisits()).length;
  }

  function updateLadderTopbarBadge() {
    var widget = documentRef.getElementById('panelLadderAlertWidget');
    var countNode = documentRef.getElementById('panelLadderAlertCount');
    var textNode = documentRef.getElementById('panelLadderAlertText');
    var count = getOpenLadderRequestCount();
    var label = count === 1 ? '1 solicitação' : count + ' solicitações';

    if (!widget || !countNode || !textNode) {
      return count;
    }

    countNode.textContent = label;
    textNode.textContent = count > 0 ? 'Escada em aberto' : 'Sem pedido ativo';
    widget.classList.toggle('has-ladder-alert', count > 0);
    widget.setAttribute('aria-label', label + ' de escada em aberto');
    return count;
  }

  function getBundle() {
    return root.ACE_PANEL_CLOUD_BUNDLE && root.ACE_PANEL_CLOUD_BUNDLE.ok
      ? root.ACE_PANEL_CLOUD_BUNDLE
      : null;
  }

  function getVisits() {
    var bundle = getBundle();
    var local;
    if (bundle && Array.isArray(bundle.visits)) {
      return bundle.visits.slice();
    }
    local = parseJson(root.localStorage && root.localStorage.getItem('dengue_db_visits_v1'), []);
    return Array.isArray(local) ? local.slice() : [];
  }

  function textFrom(row, names) {
    row = row || {};
    for (var i = 0; i < names.length; i += 1) {
      var value = row[names[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  function numberFrom(row, names) {
    var text = textFrom(row, names);
    var value = Number(text);
    return Number.isFinite(value) ? value : '';
  }

  function hasAnyField(row, names) {
    row = row || {};
    return names.some(function (name) {
      return Object.prototype.hasOwnProperty.call(row, name);
    });
  }

  function normalizeVisit(row) {
    row = row || {};
    return {
      uid: textFrom(row, ['uid', 'id']),
      data: textFrom(row, ['data', 'date']),
      hora: textFrom(row, ['hora', 'time']),
      agente: textFrom(row, ['agente', 'agent', 'nome_agente']),
      matricula: textFrom(row, ['matricula', 'matrícula', 'agent_code']),
      bairro: textFrom(row, ['bairro']),
      microarea: textFrom(row, ['microarea', 'microárea']),
      quarteirao: textFrom(row, ['quarteirao', 'quarteirão']),
      logradouro: textFrom(row, ['logradouro', 'rua']),
      numero: textFrom(row, ['numero', 'número']),
      waterAccess: textFrom(row, ['acessou_caixa_agua', 'water_access', 'waterAccess']),
      waterAccessReason: textFrom(row, ['motivo_caixa_agua', 'water_access_reason', 'waterAccessReason']),
      ladderSupportRequested: textFrom(row, ['solicita_escada', 'ladder_support_requested', 'ladderSupportRequested']),
      ladderSupportNoReason: textFrom(row, ['motivo_nao_solicitou_escada', 'ladder_support_no_reason', 'ladderSupportNoReason']),
      ladderSupportStatus: textFrom(row, ['ladder_support_status', 'ladderSupportStatus']),
      hasLadderSupportRequestedField: hasAnyField(row, ['solicita_escada', 'ladder_support_requested', 'ladderSupportRequested']),
      hasLadderSupportStatusField: hasAnyField(row, ['ladder_support_status', 'ladderSupportStatus']),
      gps_lat: numberFrom(row, ['gps_lat', 'gpsLat', 'latitude', 'lat']),
      gps_lng: numberFrom(row, ['gps_lng', 'gpsLng', 'longitude', 'lng']),
      gps_acc: numberFrom(row, ['gps_acc', 'gpsAccuracy', 'accuracy']),
      updatedAt: textFrom(row, ['updatedAt', 'updated_at'])
    };
  }

  function hasGps(visit) {
    return visit && visit.gps_lat !== '' && visit.gps_lng !== '' &&
      Number.isFinite(Number(visit.gps_lat)) && Number.isFinite(Number(visit.gps_lng));
  }

  function needsLadder(visit) {
    var water = normalizeLabel(visit.waterAccess);
    var reason = normalizeLabel(visit.waterAccessReason);
    return water === 'nao' && reason.indexOf('escada') > -1;
  }


  function isRecentLadderFallback(visit) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var limit = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));
    var candidates = [
      String(visit && visit.data || '').slice(0, 10),
      String(visit && visit.updatedAt || '').slice(0, 10)
    ];

    return candidates.some(function (value) {
      var parts;
      var date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      parts = value.split('-').map(Number);
      date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date >= limit;
    });
  }

  function requestedLadder(visit) {
    var requested = normalizeLabel(visit && visit.ladderSupportRequested);
    var status = normalizeLabel(visit && visit.ladderSupportStatus);
    var noReason = normalizeLabel(visit && visit.ladderSupportNoReason);
    var hasExplicitRequestField = !!(visit && visit.hasLadderSupportRequestedField);

    if (!needsLadder(visit)) {
      return false;
    }

    if (requested === 'nao' || requested === 'não' || noReason) {
      return false;
    }

    if (requested === 'sim' ||
        requested.indexOf('solicit') > -1 ||
        status.indexOf('solicit') > -1) {
      return true;
    }

    return !hasExplicitRequestField && isRecentLadderFallback(visit);
  }

  function getLadderStatusText(visit) {
    if (visit && visit.ladderSupportStatus) {
      return visit.ladderSupportStatus;
    }
    if (visit && !visit.hasLadderSupportRequestedField && needsLadder(visit) && isRecentLadderFallback(visit)) {
      return 'Pendente de confirmação';
    }
    return 'Solicitada';
  }

  function formatDateBR(value) {
    var text = String(value || '').trim();
    var parts = text.split('-');
    if (parts.length === 3) {
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    return text || '-';
  }

  function mapsUrl(visit) {
    if (!hasGps(visit)) { return ''; }
    return 'https://www.google.com/maps?q=' + encodeURIComponent(String(visit.gps_lat) + ',' + String(visit.gps_lng));
  }

  function mapEmbedUrl(visit) {
    var lat;
    var lng;
    var delta = 0.003;
    if (!hasGps(visit)) { return ''; }
    lat = Number(visit.gps_lat);
    lng = Number(visit.gps_lng);
    return 'https://www.openstreetmap.org/export/embed.html?bbox=' +
      encodeURIComponent(String(lng - delta) + ',' + String(lat - delta) + ',' + String(lng + delta) + ',' + String(lat + delta)) +
      '&layer=mapnik&marker=' + encodeURIComponent(String(lat) + ',' + String(lng));
  }

  function buildPrintableLadderReportHtml(rows) {
    var generatedAt = new Date().toLocaleString('pt-BR');
    var cards = rows.map(function (visit, index) {
      var address = [visit.logradouro || '-', visit.numero || ''].filter(Boolean).join(', ');
      var fullAddress = address + ' • ' + (visit.bairro || '-');
      var url = mapsUrl(visit);
      var embed = mapEmbedUrl(visit);

      return '' +
        '<article class="request-card">' +
          '<div class="request-head">' +
            '<div><span class="request-index">Solicitação ' + (index + 1) + '</span><h2>' + escapeHtml(visit.agente || 'Agente não informado') + '</h2></div>' +
            '<strong class="request-status">' + escapeHtml(getLadderStatusText(visit)) + '</strong>' +
          '</div>' +
          '<table class="data-table">' +
            '<tr><th>Data/Hora</th><td>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + '</td></tr>' +
            '<tr><th>Local</th><td>' + escapeHtml(fullAddress) + '</td></tr>' +
            '<tr><th>Microárea / Quarteirão</th><td>' + escapeHtml((visit.microarea || '-') + ' / Q ' + (visit.quarteirao || '-')) + '</td></tr>' +
            '<tr><th>Motivo</th><td>' + escapeHtml(visit.waterAccessReason || 'Necessita escada') + '</td></tr>' +
            '<tr><th>GPS</th><td>' + (hasGps(visit) ? escapeHtml(String(visit.gps_lat) + ', ' + String(visit.gps_lng)) : 'Sem GPS registrado') + '</td></tr>' +
            '<tr><th>Link do mapa</th><td>' + (url ? '<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>' : 'Sem localização disponível') + '</td></tr>' +
          '</table>' +
          (embed ? '<div class="map-box"><iframe src="' + escapeHtml(embed) + '" title="Mapa da solicitação ' + (index + 1) + '"></iframe></div>' : '<div class="map-empty">Sem mapa: GPS não veio na sincronização desta solicitação.</div>') +
          '<div class="signature-row">' +
            '<div><span>Recebido por</span></div>' +
            '<div><span>Data/Hora do atendimento</span></div>' +
            '<div><span>Observação</span></div>' +
          '</div>' +
        '</article>';
    }).join('');

    return '<!doctype html>' +
      '<html lang="pt-BR">' +
      '<head>' +
        '<meta charset="utf-8">' +
        '<title>Solicitações de escada</title>' +
        '<style>' +
          'body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#f3f6f4;color:#14251b}' +
          '.page{max-width:980px;margin:0 auto;padding:24px}' +
          '.report-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:18px 20px;border:1px solid #cfd9d2;background:#fff;border-radius:18px;margin-bottom:16px}' +
          '.report-header h1{margin:0 0 6px;font-size:24px;color:#0f3b29}.report-header p{margin:0;color:#5a6a61;line-height:1.35}.count-pill{display:inline-flex;align-items:center;justify-content:center;min-width:120px;padding:10px 14px;border-radius:999px;background:#0f6b45;color:#fff;font-weight:800}' +
          '.request-card{page-break-inside:avoid;break-inside:avoid;background:#fff;border:1px solid #cfd9d2;border-radius:18px;padding:18px 20px;margin:0 0 18px;box-shadow:0 10px 24px rgba(16,45,31,.08)}' +
          '.request-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e2e8e4;padding-bottom:10px;margin-bottom:12px}.request-head h2{margin:4px 0 0;font-size:20px;color:#123c2a}.request-index{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#0f6b45;font-weight:800}.request-status{background:#fff3d6;color:#7a4c00;border:1px solid #f2d38a;border-radius:999px;padding:7px 10px;font-size:13px}' +
          '.data-table{width:100%;border-collapse:collapse;margin-bottom:12px}.data-table th{width:190px;text-align:left;background:#f5f8f6;color:#263b30}.data-table th,.data-table td{border:1px solid #dfe7e2;padding:9px 10px;font-size:14px;vertical-align:top}.data-table a{color:#0645ad;word-break:break-all}' +
          '.map-box{border:1px solid #cfd9d2;border-radius:14px;overflow:hidden;margin:12px 0}.map-box iframe{display:block;width:100%;height:260px;border:0}.map-empty{padding:14px;border:1px dashed #c7d1ca;border-radius:14px;color:#64746b;background:#f8faf9;margin:12px 0}' +
          '.signature-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:16px}.signature-row div{height:62px;border:1px solid #cfd9d2;border-radius:12px;background:#fbfdfc;display:flex;align-items:flex-end;padding:8px}.signature-row span{font-size:12px;color:#66756c}' +
          '@media print{body{background:#fff}.page{max-width:none;padding:0}.report-header,.request-card{box-shadow:none;border-radius:0}.request-card{page-break-inside:avoid;break-inside:avoid}.no-print{display:none!important}.map-box iframe{height:220px}}' +
        '</style>' +
      '</head>' +
      '<body>' +
        '<main class="page">' +
          '<header class="report-header">' +
            '<div><h1>Solicitações de escada</h1><p>Relatório para equipe responsável pelo apoio em campo.<br>Gerado em ' + escapeHtml(generatedAt) + '.</p></div>' +
            '<div class="count-pill">' + rows.length + (rows.length === 1 ? ' pedido' : ' pedidos') + '</div>' +
          '</header>' +
          cards +
        '</main>' +
        '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},500);});<\/script>' +
      '</body>' +
      '</html>';
  }

  function printLadderRequestsReport() {
    var rows = getOpenLadderRequests(getVisits());
    var popup;
    var html;

    if (!rows.length) {
      root.alert('Não há solicitações de escada em aberto para imprimir.');
      return;
    }

    html = buildPrintableLadderReportHtml(rows);
    popup = root.open('', '_blank', 'width=1100,height=800,scrollbars=yes,resizable=yes');

    if (!popup) {
      root.alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.');
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    try { popup.focus(); } catch (error) {}
  }

  function buildLadderRequestsHtml(visits) {
    var rows = getOpenLadderRequests(visits);

    if (!rows.length) {
      return '<div class="empty-state"><strong>Nenhuma solicitação de escada em aberto.</strong><span>Só aparecem aqui pedidos confirmados como “Sim, solicitar escada”. Solicitações atendidas ficam ocultas neste painel.</span></div>';
    }

    return '' +
      '<div class="panel-ladder-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<button class="visit-inline-action" type="button" data-ladder-print-report="true">Imprimir PDF para equipe da escada</button>' +
        '<button class="visit-inline-action" type="button" data-ladder-attend-all="true">Limpar lista / marcar todas atendidas</button>' +
      '</div>' +
      rows.map(function (visit) {
        var address = [visit.logradouro || '-', visit.numero || ''].filter(Boolean).join(', ') + ' • ' + (visit.bairro || '-');
        var url = mapsUrl(visit);
        var key = getLadderRequestKey(visit);
        return '' +
          '<div class="insight-item panel-ladder-request-item">' +
            '<strong>' + escapeHtml(visit.agente || 'Agente não informado') + '</strong>' +
            '<span>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + ' • ' + escapeHtml(address) + '</span>' +
            '<small>Microárea: ' + escapeHtml(visit.microarea || '-') + ' • Q: ' + escapeHtml(visit.quarteirao || '-') + ' • Status: ' + escapeHtml(getLadderStatusText(visit)) + '</small>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
              (url ? '<a class="visit-inline-action" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Abrir localização</a>' : '<small>GPS ainda não veio na sincronização desta solicitação.</small>') +
              '<button class="visit-inline-action" type="button" data-ladder-attend="' + escapeHtml(key) + '">Marcar atendida</button>' +
            '</div>' +
          '</div>';
      }).join('');
  }

  function buildAgentLocationsHtml(visits) {
    var latest = {};
    (visits || []).map(normalizeVisit).filter(hasGps).forEach(function (visit) {
      var key = visit.agente || visit.matricula || '';
      var stamp = String((visit.data || '') + 'T' + (visit.hora || '00:00') + ' ' + (visit.updatedAt || ''));
      if (!key) { return; }
      if (!latest[key] || stamp > latest[key].stamp) {
        latest[key] = { visit: visit, stamp: stamp };
      }
    });

    var rows = Object.keys(latest).map(function (key) { return latest[key].visit; }).sort(function (a, b) {
      return String((b.data || '') + ' ' + (b.hora || '')).localeCompare(String((a.data || '') + ' ' + (a.hora || '')));
    });

    if (!rows.length) {
      return '<div class="empty-state"><strong>Nenhuma localização encontrada.</strong><span>A localização aparece após visitas com GPS sincronizado.</span></div>';
    }

    return rows.map(function (visit, index) {
      var url = mapsUrl(visit);
      return '' +
        '<div class="ranking-item">' +
          '<strong>' + (index + 1) + '. ' + escapeHtml(visit.agente || 'Agente') + '</strong>' +
          '<span>' + escapeHtml(formatDateBR(visit.data) + ' ' + (visit.hora || '')) + ' • ' + escapeHtml([visit.logradouro, visit.numero].filter(Boolean).join(', ') || '-') + '</span>' +
          '<small>' + escapeHtml(visit.gps_lat + ', ' + visit.gps_lng) + ' • ' + escapeHtml(visit.bairro || '-') + '</small>' +
          (url ? '<a class="visit-inline-action" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Mapa</a>' : '') +
        '</div>';
    }).join('');
  }

  function injectStyles() {
    if (documentRef.getElementById('acePanelAgentsToolsStyle')) { return; }
    var style = documentRef.createElement('style');
    style.id = 'acePanelAgentsToolsStyle';
    style.textContent = [
      '.ace-panel-agents-modal[hidden]{display:none!important}',
      '.ace-panel-agents-modal{position:fixed;inset:0;z-index:450;display:grid;place-items:center;padding:18px}',
      '.ace-panel-agents-backdrop{position:absolute;inset:0;background:rgba(6,25,17,.58);backdrop-filter:blur(4px)}',
      '.ace-panel-agents-dialog{position:relative;z-index:1;width:min(980px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:22px;border:1px solid #dbe5dd;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:18px}',
      '.ace-panel-agents-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #e4ece7;padding-bottom:12px;margin-bottom:14px}',
      '.ace-panel-agents-header h2{margin:2px 0 4px;color:#103a28;font-size:1.35rem}',
      '.ace-panel-agents-header p{margin:0;color:#5d6d64;font-size:.9rem}',
      '.ace-panel-agents-eyebrow{display:block;color:#0f6b45;font-weight:900;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em}',
      '.ace-panel-agents-close{border:0;border-radius:12px;background:#edf5f0;color:#173826;font-size:1.5rem;font-weight:900;width:42px;height:42px;cursor:pointer}',
      '.ace-panel-agents-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '.ace-panel-agents-box{border:1px solid #e0e8e3;background:#f8fbf9;border-radius:18px;padding:14px}',
      '.ace-panel-agents-box h3{margin:0 0 6px;color:#173826}',
      '.ace-panel-agents-box p{margin:0 0 12px;color:#5d6d64;font-size:.88rem;line-height:1.4}',
      '@media(max-width:760px){.ace-panel-agents-grid{grid-template-columns:1fr}.ace-panel-agents-dialog{padding:14px;border-radius:18px}}'
    ].join('\\n');
    documentRef.head.appendChild(style);
  }

  function closeAgentsModal() {
    var overlay = documentRef.getElementById('acePanelAgentsModal');
    if (overlay) { overlay.hidden = true; }
    documentRef.body.classList.remove('is-agents-modal-open');
  }

  function openAgentsModal() {
    var overlay = documentRef.getElementById('acePanelAgentsModal');
    var visits = getVisits();
    var bundle = getBundle();
    var generated = bundle && bundle.generatedAt ? ('Nuvem atualizada em ' + bundle.generatedAt) : 'Usando dados disponíveis no navegador';

    injectStyles();

    if (!overlay) {
      overlay = documentRef.createElement('div');
      overlay.id = 'acePanelAgentsModal';
      overlay.className = 'ace-panel-agents-modal';
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'acePanelAgentsModalTitle');
      documentRef.body.appendChild(overlay);
    }

    overlay.innerHTML = '' +
      '<div class="ace-panel-agents-backdrop" data-agents-modal-close="true"></div>' +
      '<section class="ace-panel-agents-dialog">' +
        '<header class="ace-panel-agents-header">' +
          '<div><span class="ace-panel-agents-eyebrow">Coordenação operacional</span><h2 id="acePanelAgentsModalTitle">Agentes, escada e localização</h2><p>' + escapeHtml(generated) + '</p></div>' +
          '<button type="button" class="ace-panel-agents-close" data-agents-modal-close="true" aria-label="Fechar">×</button>' +
        '</header>' +
        '<div class="ace-panel-agents-grid">' +
          '<section class="ace-panel-agents-box"><h3>Solicitações de escada</h3><p>Pedidos confirmados como “Sim, solicitar escada”. Se a API ainda não devolver esse campo, entram apenas pedidos recentes com motivo “Necessita escada”.</p><div class="insight-list">' + buildLadderRequestsHtml(visits) + '</div></section>' +
          '<section class="ace-panel-agents-box"><h3>Localização dos agentes</h3><p>Última localização registrada por GPS nas visitas sincronizadas.</p><div class="ranking-list">' + buildAgentLocationsHtml(visits) + '</div></section>' +
        '</div>' +
      '</section>';

    overlay.hidden = false;
    documentRef.body.classList.add('is-agents-modal-open');
    updateLadderTopbarBadge();

    setTimeout(function () {
      var close = overlay.querySelector('.ace-panel-agents-close');
      if (close) { close.focus(); }
    }, 30);
  }

  function bindAgentsButton() {
    var button = documentRef.getElementById('sidebarAgentsBtn');
    if (!button || button.getAttribute('data-ace-agents-tools-bound') === '1') {
      return;
    }

    button.setAttribute('data-ace-agents-tools-bound', '1');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      openAgentsModal();
    }, true);
  }

  function handleClick(event) {
    var attendButton = event.target && event.target.closest ? event.target.closest('[data-ladder-attend]') : null;
    var attendAllButton = event.target && event.target.closest ? event.target.closest('[data-ladder-attend-all]') : null;
    var printButton = event.target && event.target.closest ? event.target.closest('[data-ladder-print-report]') : null;

    if (printButton) {
      event.preventDefault();
      printLadderRequestsReport();
      return;
    }

    if (attendButton) {
      event.preventDefault();
      markLadderAttended(attendButton.getAttribute('data-ladder-attend'));
      updateLadderTopbarBadge();
      openAgentsModal();
      return;
    }

    if (attendAllButton) {
      event.preventDefault();
      if (!root.confirm || root.confirm('Marcar todas as solicitações de escada exibidas como atendidas? Elas sairão desta lista neste navegador.')) {
        getOpenLadderRequests(getVisits()).forEach(function (visit) {
          markLadderAttended(getLadderRequestKey(visit));
        });
        updateLadderTopbarBadge();
        openAgentsModal();
      }
      return;
    }

    if (event.target && event.target.getAttribute('data-agents-modal-close') === 'true') {
      closeAgentsModal();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeAgentsModal();
    }
  }

  function boot() {
    injectStyles();
    bindAgentsButton();
    documentRef.addEventListener('click', handleClick);
    documentRef.addEventListener('keydown', handleKeydown);
    updateLadderTopbarBadge();
    setTimeout(function () {
      bindAgentsButton();
      updateLadderTopbarBadge();
    }, 300);
    setTimeout(function () {
      bindAgentsButton();
      updateLadderTopbarBadge();
    }, 1200);
    setInterval(updateLadderTopbarBadge, 5000);
  }

  root.ACEPanelAgentsTools = {
    version: version,
    open: openAgentsModal,
    close: closeAgentsModal,
    getVisits: getVisits,
    getOpenLadderRequestCount: getOpenLadderRequestCount,
    updateLadderTopbarBadge: updateLadderTopbarBadge,
    printLadderRequestsReport: printLadderRequestsReport
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
