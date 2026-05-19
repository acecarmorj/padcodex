(function () {
    'use strict';
  
    var root = window;
    var documentRef = document;
    var app = root.ACSField || null;
  
    var LGPD = root.ACSLGPD = root.ACSLGPD || {};
  
    
    if (LGPD.__moduleLoaded) {
      return;
    }

    LGPD.__moduleLoaded = true;
    var CONFIG = {
      version: 'pacote-2-lgpd-protecao-local',
      consentKey: 'ace_lgpd_consent_v1',
      privacyModeKey: 'ace_privacy_mode_v1',
      lastActivityKey: 'ace_last_activity_v1',
      idleLimitMs: 20 * 60 * 1000,
      warningBeforeIdleMs: 2 * 60 * 1000,
      operationalLocalStoragePrefixes: [
        'dengue_db_',
        'ace_campo_'
      ],
      preservedLocalStorageKeys: [
        'ace_lgpd_consent_v1',
        'ace_privacy_mode_v1'
      ],
      sensitiveFieldIds: [
        'propMorador',
        'propTelefone',
        'propReferencia',
        'propObs',
        'visitAttendedBy',
        'visitObs',
        'propertySearch',
        'agentPassword'
      ]
    };
  
    function getApp() {
      app = root.ACSField || app || null;
      return app;
    }
  
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
  
    function nowIso() {
      return new Date().toISOString();
    }
  
    function readJson(key, fallback) {
      try {
        var raw = root.localStorage.getItem(key);
        if (raw === null || raw === undefined || raw === '') {
          return fallback;
        }
        return JSON.parse(raw);
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
  
    function removeLocalStorageKey(key) {
      try {
        root.localStorage.removeItem(key);
      } catch (error) {}
    }
  
    function notify(message, kind) {
      var currentApp = getApp();
  
      if (currentApp && typeof currentApp.showMessage === 'function') {
        currentApp.showMessage(message, kind || 'warn');
        return;
      }
  
      var banner = $('syncStatus');
  
      if (banner) {
        banner.textContent = message;
        banner.className = 'sync-banner ' + (kind || 'warn');
        return;
      }
  
      root.alert(message);
    }
  
    function getConsent() {
      return readJson(CONFIG.consentKey, null);
    }
  
    function hasConsent() {
      var consent = getConsent();
      return !!(consent && consent.accepted === true && consent.acceptedAt);
    }
  
    function saveConsent() {
      var currentApp = getApp();
      var currentAgent = currentApp && currentApp.state ? currentApp.state.currentAgent : null;
  
      writeJson(CONFIG.consentKey, {
        accepted: true,
        acceptedAt: nowIso(),
        version: CONFIG.version,
        agente: currentAgent ? String(currentAgent.nome || currentAgent.matricula || '') : '',
        matricula: currentAgent ? String(currentAgent.matricula || '') : '',
        notice: 'Uso restrito para atividade de vigilância territorial. Dados pessoais devem ser usados apenas para finalidade pública autorizada.'
      });
    }
  
    function isPrivacyModeOn() {
      try {
        return root.localStorage.getItem(CONFIG.privacyModeKey) === '1';
      } catch (error) {
        return false;
      }
    }
  
    function setPrivacyMode(enabled) {
      try {
        root.localStorage.setItem(CONFIG.privacyModeKey, enabled ? '1' : '0');
      } catch (error) {}
  
      documentRef.body.classList.toggle('ace-privacy-mode', !!enabled);
      refreshPrivacyButtons();
  
      notify(
        enabled
          ? 'Modo privacidade ativado. Campos sensíveis ficam ocultos visualmente.'
          : 'Modo privacidade desativado.',
        enabled ? 'ok' : 'warn'
      );
    }
  
    function markActivity() {
      try {
        root.localStorage.setItem(CONFIG.lastActivityKey, String(Date.now()));
      } catch (error) {}
    }
  
    function getLastActivity() {
      var value = 0;
  
      try {
        value = Number(root.localStorage.getItem(CONFIG.lastActivityKey) || '0');
      } catch (error) {
        value = 0;
      }
  
      if (!value || Number.isNaN(value)) {
        value = Date.now();
        markActivity();
      }
  
      return value;
    }
  
    function getStorageFallback(logicalKey) {
      var currentApp = getApp();
  
      if (currentApp && typeof currentApp.getStorageFallback === 'function') {
        return currentApp.getStorageFallback(logicalKey);
      }
  
      if (logicalKey === 'session' || logicalKey === 'lastArea') {
        return null;
      }
  
      if (logicalKey === 'systemState') {
        return {};
      }
  
      return [];
    }
  
    function readLogicalStorage(logicalKey) {
      var currentApp = getApp();
  
      try {
        if (
          currentApp &&
          currentApp.STORAGE_KEYS &&
          currentApp.STORAGE_KEYS[logicalKey] &&
          typeof currentApp.readStorageSnapshot === 'function'
        ) {
          return currentApp.readStorageSnapshot(
            currentApp.STORAGE_KEYS[logicalKey],
            getStorageFallback(logicalKey)
          );
        }
      } catch (error) {}
  
      var storageKey = currentApp &&
        currentApp.STORAGE_KEYS &&
        currentApp.STORAGE_KEYS[logicalKey] &&
        currentApp.STORAGE_KEYS[logicalKey][0]
        ? currentApp.STORAGE_KEYS[logicalKey][0]
        : logicalKey;
  
      return readJson(storageKey, getStorageFallback(logicalKey));
    }
  
    function writeLogicalStorage(logicalKey, value) {
      var currentApp = getApp();
  
      try {
        if (currentApp && typeof currentApp.writeStorageSnapshot === 'function') {
          currentApp.writeStorageSnapshot(logicalKey, value);
          return true;
        }
      } catch (error) {}
  
      var storageKey = currentApp &&
        currentApp.STORAGE_KEYS &&
        currentApp.STORAGE_KEYS[logicalKey] &&
        currentApp.STORAGE_KEYS[logicalKey][0]
        ? currentApp.STORAGE_KEYS[logicalKey][0]
        : logicalKey;
  
      return writeJson(storageKey, value);
    }
  
    function asArray(value) {
      return Array.isArray(value) ? value : [];
    }
  
    function getCounts() {
      var currentApp = getApp();
      var visits = asArray(
        currentApp && typeof currentApp.readVisits === 'function'
          ? currentApp.readVisits()
          : readLogicalStorage('visits')
      );

      var properties = asArray(
        currentApp && typeof currentApp.readProperties === 'function'
          ? currentApp.readProperties()
          : readLogicalStorage('properties')
      );

      var agents = asArray(
        currentApp && typeof currentApp.readAgents === 'function'
          ? currentApp.readAgents()
          : readLogicalStorage('agents')
      );

      var tubitos = asArray(
        currentApp && typeof currentApp.readTubitos === 'function'
          ? currentApp.readTubitos()
          : readLogicalStorage('tubitos')
      );

      var supervisionRequests = asArray(
        currentApp && typeof currentApp.readSupervisionRequests === 'function'
          ? currentApp.readSupervisionRequests()
          : readLogicalStorage('supervisionRequests')
      );

      var locationTrail = asArray(
        currentApp && typeof currentApp.readLocationTrail === 'function'
          ? currentApp.readLocationTrail()
          : readLogicalStorage('locationTrail')
      );

      var logs = asArray(readLogicalStorage('logs'));
      var dirtyProperties = asArray(readLogicalStorage('dirtyProperties'));
      var summary = currentApp && typeof currentApp.getOfflineQueueSummary === 'function'
        ? currentApp.getOfflineQueueSummary()
        : null;

      var unsynced = summary ? summary.visits : [];

      if (!summary) {
        try {
          if (currentApp && typeof currentApp.getUnsyncedVisits === 'function') {
            unsynced = asArray(currentApp.getUnsyncedVisits()).length;
          } else {
            unsynced = visits.filter(function (visit) {
              return !visit.syncedAt && !visit.sincronizado && visit.synced !== true;
            }).length;
          }
        } catch (error) {
          unsynced = 0;
        }
      }

      return {
        visits: visits.length,
        properties: properties.length,
        agents: agents.length,
        tubitos: tubitos.length,
        supervisionRequests: supervisionRequests.length,
        locationTrail: locationTrail.length,
        logs: logs.length,
        dirtyProperties: dirtyProperties.length,
        unsynced: summary ? summary.visits : Number(unsynced || 0),
        unsyncedTubitos: summary ? summary.tubitos : tubitos.filter(function (row) { return row && row.synced === false; }).length,
        unsyncedSupervision: summary ? summary.supervision : supervisionRequests.filter(function (row) { return row && row.synced === false; }).length,
        unsyncedLocationTrail: summary ? summary.locationTrail : locationTrail.filter(function (row) { return row && row.synced !== true; }).length,
        unsyncedLogs: summary ? summary.logs : logs.filter(function (row) { return row && row.synced !== true; }).length,
        pendingAdmin: summary ? summary.admin : 0,
        totalPending: summary ? summary.total : 0
      };
    }

    function hasPendingLocalData() {
      var counts = getCounts();
      var systemState = readLogicalStorage('systemState') || {};
      return Number(counts.totalPending || 0) > 0 || counts.unsynced > 0 || counts.unsyncedTubitos > 0 || counts.unsyncedSupervision > 0 || counts.unsyncedLocationTrail > 0 || counts.unsyncedLogs > 0 || counts.dirtyProperties > 0 || !!systemState.pendingSync;
    }

    function injectStyles() {
      if ($('aceLgpdStyles')) {
        return;
      }
  
      var style = documentRef.createElement('style');
      style.id = 'aceLgpdStyles';
      style.textContent = [
        '.lgpd-consent-panel{margin-top:14px;padding:14px;border:1px solid rgba(37,99,235,.25);border-radius:16px;background:rgba(239,246,255,.92);text-align:left;color:#0f172a}',
        '.lgpd-consent-panel strong{display:block;margin-bottom:6px;color:#1e3a8a}',
        '.lgpd-consent-panel p{margin:6px 0;font-size:.92rem;line-height:1.42}',
        '.lgpd-consent-panel label{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:.9rem}',
        '.lgpd-consent-panel input[type="checkbox"]{margin-top:3px}',
        '.lgpd-consent-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
        '.lgpd-pill{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:.78rem;font-weight:700}',
        '.lgpd-pill.warn{background:#fef3c7;color:#92400e}',
        '.lgpd-modal-backdrop{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.62);padding:18px}',
        '.lgpd-modal-backdrop.show{display:flex}',
        '.lgpd-modal-card{width:min(760px,100%);max-height:92vh;overflow:auto;border-radius:24px;background:#fff;box-shadow:0 24px 60px rgba(15,23,42,.28);padding:22px;color:#0f172a}',
        '.lgpd-modal-card h2{margin:0 0 10px;font-size:1.35rem}',
        '.lgpd-modal-card p{line-height:1.48}',
        '.lgpd-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}',
        '.lgpd-metric{padding:12px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0}',
        '.lgpd-metric strong{display:block;font-size:1.3rem;color:#0f172a}',
        '.lgpd-metric span{font-size:.82rem;color:#475569}',
        '.lgpd-warning{padding:12px;border-radius:16px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;margin:12px 0}',
        '.lgpd-ok{padding:12px;border-radius:16px;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;margin:12px 0}',
        '.lgpd-danger-zone{padding:14px;border-radius:18px;background:#fef2f2;border:1px solid #fecaca;margin-top:14px}',
        '.lgpd-danger-zone h3{margin:0 0 8px;color:#991b1b}',
        '.lgpd-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}',
        '.lgpd-note-warning{margin-top:6px;font-size:.8rem;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:7px 9px}',
        'body.ace-privacy-mode #propMorador,',
        'body.ace-privacy-mode #propTelefone,',
        'body.ace-privacy-mode #propReferencia,',
        'body.ace-privacy-mode #propObs,',
        'body.ace-privacy-mode #visitAttendedBy,',
        'body.ace-privacy-mode #visitObs,',
        'body.ace-privacy-mode #propertySearch,',
        'body.ace-privacy-mode #agentPassword{filter:blur(5px);transition:filter .18s ease}',
        'body.ace-privacy-mode #propMorador:focus,',
        'body.ace-privacy-mode #propTelefone:focus,',
        'body.ace-privacy-mode #propReferencia:focus,',
        'body.ace-privacy-mode #propObs:focus,',
        'body.ace-privacy-mode #visitAttendedBy:focus,',
        'body.ace-privacy-mode #visitObs:focus,',
        'body.ace-privacy-mode #propertySearch:focus,',
        'body.ace-privacy-mode #agentPassword:focus{filter:none}',
        '@media(max-width:720px){.lgpd-grid{grid-template-columns:1fr}.lgpd-modal-card{padding:18px;border-radius:20px}}'
      ].join('\n');
  
      documentRef.head.appendChild(style);
    }
  
    function installConsentPanel() {
      var loginCard = documentRef.querySelector('.login-card');
  
      if (!loginCard || $('lgpdConsentPanel')) {
        refreshConsentUi();
        return;
      }
  
      var panel = documentRef.createElement('section');
      panel.id = 'lgpdConsentPanel';
      panel.className = 'lgpd-consent-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Aviso de privacidade e uso de dados');
      panel.innerHTML = [
        '<strong>🔒 Aviso de privacidade</strong>',
        '<p>Este sistema é de uso restrito da vigilância territorial. Ele pode registrar dados de identificação do imóvel, morador/responsável, telefone, observações operacionais, localização aproximada por GPS e trilha de rota do agente durante o uso do app.</p>',
        '<p>Use as informações apenas para a finalidade pública autorizada. Não compartilhe prints, CSVs ou dados fora dos canais oficiais.</p>',
        '<label for="lgpdConsentCheck">',
        '<input id="lgpdConsentCheck" type="checkbox">',
        '<span>Li e compreendi as orientações de privacidade e responsabilidade pelo uso dos dados.</span>',
        '</label>',
        '<div class="lgpd-consent-actions">',
        '<button class="btn btn-primary" id="lgpdAcceptBtn" type="button" disabled>Aceitar e continuar</button>',
        '<button class="btn btn-soft" id="lgpdDetailsBtn" type="button">Ver detalhes</button>',
        '</div>',
        '<div id="lgpdDetailsText" hidden>',
        '<p><strong>Boas práticas:</strong> confira se o aparelho tem bloqueio de tela, evite salvar CSV fora do ambiente institucional, sincronize a trilha de rota em canal autorizado e limpe os dados locais após sincronizar.</p>',
        '</div>'
      ].join('');
  
      var loginMessage = $('loginMessage');
      if (loginMessage && loginMessage.parentNode) {
        loginMessage.parentNode.insertBefore(panel, loginMessage);
      } else {
        loginCard.appendChild(panel);
      }
  
      var check = $('lgpdConsentCheck');
      var accept = $('lgpdAcceptBtn');
      var details = $('lgpdDetailsBtn');
      var detailsText = $('lgpdDetailsText');
  
      if (check && accept) {
        check.addEventListener('change', function () {
          accept.disabled = !check.checked;
        });
      }
  
      if (accept) {
        accept.addEventListener('click', function () {
          saveConsent();
          refreshConsentUi();
          notify('Aviso de privacidade aceito neste aparelho.', 'ok');
        });
      }
  
      if (details && detailsText) {
        details.addEventListener('click', function () {
          detailsText.hidden = !detailsText.hidden;
        });
      }
  
      refreshConsentUi();
    }
  
    function refreshConsentUi() {
      var loginBtn = $('loginBtn');
      var panel = $('lgpdConsentPanel');
      var accepted = hasConsent();
  
      if (panel) {
        panel.hidden = accepted;
      }
  
      if (loginBtn) {
        loginBtn.disabled = !accepted;
        loginBtn.title = accepted
          ? ''
          : 'Aceite o aviso de privacidade antes de entrar.';
      }
    }
  
    function installLoginGuard() {
      var loginBtn = $('loginBtn');
  
      if (!loginBtn || loginBtn.getAttribute('data-lgpd-guard') === '1') {
        return;
      }
  
      loginBtn.setAttribute('data-lgpd-guard', '1');
  
      loginBtn.addEventListener('click', function (event) {
        if (!hasConsent()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          refreshConsentUi();
          notify('Aceite o aviso de privacidade antes de entrar.', 'warn');
        }
      }, true);
    }
  
    function enhanceInputs() {
      var loginPassword = $('loginPassword');
      var propTelefone = $('propTelefone');
      var propNumero = $('propNumero');
      var agentPassword = $('agentPassword');
  
      if (loginPassword) {
        loginPassword.setAttribute('autocomplete', 'current-password');
      }
  
      if (agentPassword) {
        agentPassword.setAttribute('autocomplete', 'new-password');
      }
  
      if (propTelefone) {
        propTelefone.setAttribute('inputmode', 'tel');
        propTelefone.setAttribute('autocomplete', 'tel');
      }
  
      if (propNumero) {
        propNumero.setAttribute('inputmode', 'text');
        propNumero.setAttribute('autocomplete', 'off');
      }
  
      ['visitTubitosQty', 'visitLarvicidaQty', 'visitAdulticidaQty'].forEach(function (id) {
        var input = $(id);
        if (input) {
          input.setAttribute('inputmode', 'numeric');
        }
      });
  
      CONFIG.sensitiveFieldIds.forEach(function (id) {
        var field = $(id);
        if (field) {
          field.setAttribute('data-lgpd-sensitive', 'true');
        }
      });
  
      installSensitiveNoteGuard('visitObs', 'Evite registrar CPF, documentos, diagnóstico médico, informações familiares sensíveis ou dados que não sejam necessários à visita.');
      installSensitiveNoteGuard('propObs', 'Evite colocar dados pessoais excessivos nas observações cadastrais.');
    }
  
    function installSensitiveNoteGuard(fieldId, message) {
      var field = $(fieldId);
  
      if (!field || field.getAttribute('data-lgpd-note-guard') === '1') {
        return;
      }
  
      field.setAttribute('data-lgpd-note-guard', '1');
  
      var warning = documentRef.createElement('div');
      warning.className = 'lgpd-note-warning';
      warning.hidden = true;
      warning.textContent = message;
  
      if (field.parentNode) {
        field.parentNode.appendChild(warning);
      }
  
      field.addEventListener('input', function () {
        var value = String(field.value || '');
        var looksSensitive = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})|(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})|(\b\d{8,}\b)|(\bdoen[cç]a\b|\bdiagn[oó]stico\b|\brem[eé]dio\b|\bmedicamento\b)/i.test(value);
        warning.hidden = !looksSensitive;
      });
    }
  
    function createModalIfNeeded() {
      if ($('lgpdPrivacyModal')) {
        return;
      }
  
      var backdrop = documentRef.createElement('div');
      backdrop.id = 'lgpdPrivacyModal';
      backdrop.className = 'lgpd-modal-backdrop';
      backdrop.innerHTML = [
        '<div class="lgpd-modal-card" role="dialog" aria-modal="true" aria-labelledby="lgpdModalTitle">',
        '<h2 id="lgpdModalTitle">Privacidade e dados locais</h2>',
        '<p>Use este painel para conferir dados guardados neste aparelho, ativar o modo privacidade, bloquear a sessão ou limpar dados locais após sincronizar.</p>',
        '<div id="lgpdStatusBox"></div>',
        '<div id="lgpdMetricsGrid" class="lgpd-grid"></div>',
        '<div class="lgpd-actions">',
        '<button class="btn btn-primary" id="lgpdTogglePrivacyBtn" type="button">Modo privacidade</button>',
        '<button class="btn btn-soft" id="lgpdExportJsonBtn" type="button">Baixar diagnóstico local</button>',
        '<button class="btn btn-soft" id="lgpdLockBtn" type="button">Bloquear sessão</button>',
        '</div>',
        '<div class="lgpd-danger-zone">',
        '<h3>Zona de cuidado</h3>',
        '<p>Limpe os dados locais somente depois que a fila estiver enviada para a Nuvem. Essa ação remove cache, sessão, imóveis, visitas locais, tubitos, supervisão, logs e fila deste aparelho. Não é permitida enquanto houver qualquer pendência de envio.</p>',
        '<button class="btn btn-danger" id="lgpdClearLocalBtn" type="button">Limpar dados locais deste aparelho</button>',
        '</div>',
        '<div class="lgpd-actions">',
        '<button class="btn btn-soft" id="lgpdCloseModalBtn" type="button">Fechar</button>',
        '</div>',
        '</div>'
      ].join('');
  
      documentRef.body.appendChild(backdrop);
  
      $('lgpdCloseModalBtn').addEventListener('click', closePrivacyModal);
      $('lgpdTogglePrivacyBtn').addEventListener('click', function () {
        setPrivacyMode(!isPrivacyModeOn());
        refreshPrivacyModal();
      });
      $('lgpdExportJsonBtn').addEventListener('click', exportLocalDiagnostic);
      $('lgpdLockBtn').addEventListener('click', function () {
        lockSession('Sessão bloqueada manualmente.');
      });
      $('lgpdClearLocalBtn').addEventListener('click', clearLocalDataWithConfirmation);
  
      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop) {
          closePrivacyModal();
        }
      });
    }
  
    function openPrivacyModal() {
      createModalIfNeeded();
      refreshPrivacyModal();
  
      var modal = $('lgpdPrivacyModal');
      if (modal) {
        modal.classList.add('show');
      }
    }
  
    function closePrivacyModal() {
      var modal = $('lgpdPrivacyModal');
      if (modal) {
        modal.classList.remove('show');
      }
    }
  
    function refreshPrivacyModal() {
      var statusBox = $('lgpdStatusBox');
      var grid = $('lgpdMetricsGrid');
      var counts = getCounts();
      var consent = getConsent();
      var pending = hasPendingLocalData();
  
      if (statusBox) {
        statusBox.innerHTML = pending
          ? '<div class="lgpd-warning"><strong>Atenção:</strong> há dados pendentes ou alterações locais. Envie a fila antes de limpar o aparelho.</div>'
          : '<div class="lgpd-ok"><strong>Fila limpa:</strong> não identifiquei visitas pendentes neste aparelho.</div>';
      }
  
      if (grid) {
        grid.innerHTML = [
          makeMetric('Visitas locais', counts.visits),
          makeMetric('Pendentes totais', counts.totalPending || counts.unsynced),
          makeMetric('Tubitos locais', counts.tubitos),
          makeMetric('Supervisão local', counts.supervisionRequests),
          makeMetric('Pontos de rota', counts.locationTrail),
          makeMetric('Imóveis em cache', counts.properties),
          makeMetric('Alterações locais', counts.dirtyProperties)
        ].join('');
      }
  
      var toggle = $('lgpdTogglePrivacyBtn');
      if (toggle) {
        toggle.textContent = isPrivacyModeOn()
          ? 'Desativar modo privacidade'
          : 'Ativar modo privacidade';
      }
  
      var consentInfo = consent && consent.acceptedAt
        ? 'Aviso aceito em: ' + formatDateTime(consent.acceptedAt)
        : 'Aviso de privacidade ainda não aceito.';
  
      var title = $('lgpdModalTitle');
      if (title) {
        title.textContent = 'Privacidade e dados locais';
        title.setAttribute('title', consentInfo);
      }
    }
  
    function makeMetric(label, value) {
      return [
        '<div class="lgpd-metric">',
        '<strong>', escapeHtml(value), '</strong>',
        '<span>', escapeHtml(label), '</span>',
        '</div>'
      ].join('');
    }
  
    function refreshPrivacyButtons() {
      var buttons = documentRef.querySelectorAll('[data-lgpd-privacy-toggle="1"]');
  
      Array.prototype.forEach.call(buttons, function (button) {
        button.textContent = isPrivacyModeOn() ? '👁️ Privacidade ativa' : '🔒 Privacidade';
        button.classList.toggle('btn-primary', isPrivacyModeOn());
        button.classList.toggle('btn-soft', !isPrivacyModeOn());
      });
  
      var body = documentRef.body;
      if (body) {
        body.classList.toggle('ace-privacy-mode', isPrivacyModeOn());
      }
    }
  
    function installToolbar() {
      // Recursos rápidos de privacidade removidos do app de campo.
      // Os botões "Privacidade", "Dados locais" e "Bloquear" agora ficam apenas
      // no painel da coordenação, em assets/painel-privacy-tools.js.
      refreshPrivacyButtons();
    }
  
    function refreshStatusPill() {
      var pill = $('lgpdStatusPill');
  
      if (!pill) {
        return;
      }
  
      var pending = hasPendingLocalData();
      var counts = getCounts();
  
      pill.textContent = pending
        ? 'LGPD • ' + counts.unsynced + ' pendente(s)'
        : 'LGPD • protegido';
  
      pill.classList.toggle('warn', pending);
    }
  
    function installAdminPanelButton() {
      // Não injeta botões de privacidade no app de campo/login.
      // A área administrativa do painel usa assets/painel-privacy-tools.js.
    }
  
    function installSyncCenterButton() {
      // Não injeta botão "Privacidade" no centro de sincronização do app de campo.
    }
  
    function wrapExports() {
      var currentApp = getApp();
  
      if (!currentApp || typeof currentApp.exportVisitsCsv !== 'function' || currentApp.exportVisitsCsv.__lgpdWrapped) {
        return;
      }
  
      var original = currentApp.exportVisitsCsv;
  
      currentApp.exportVisitsCsv = function (onlyQueue) {
        var counts = getCounts();
        var message = onlyQueue
          ? 'O CSV da fila pendente pode conter nome de morador, telefone, endereço, observações e GPS. Baixe somente em aparelho autorizado.'
          : 'O backup local CSV contém dados pessoais e localização. Compartilhe apenas por canal institucional autorizado.';
  
        if (!root.confirm(message + '\n\nDeseja continuar?')) {
          notify('Exportação cancelada para proteção de dados.', 'warn');
          return;
        }
  
        try {
          var systemState = readLogicalStorage('systemState') || {};
          systemState.lastPrivacyExportWarningAt = nowIso();
          systemState.lastPrivacyExportCount = onlyQueue ? counts.unsynced : counts.visits;
          writeLogicalStorage('systemState', systemState);
        } catch (error) {}
  
        return original.call(currentApp, onlyQueue);
      };
  
      currentApp.exportVisitsCsv.__lgpdWrapped = true;
    }
  
    function exportLocalDiagnostic() {
      var currentApp = getApp();
      var counts = getCounts();
      var systemState = readLogicalStorage('systemState') || {};
      var currentAgent = currentApp && currentApp.state ? currentApp.state.currentAgent : null;
  
      var payload = {
        tipo: 'diagnostico-local-lgpd',
        version: CONFIG.version,
        geradoEm: nowIso(),
        aparelho: {
          userAgent: root.navigator ? root.navigator.userAgent : '',
          online: root.navigator ? root.navigator.onLine : null
        },
        usuarioAtual: currentAgent ? {
          nome: currentAgent.nome || '',
          matricula: currentAgent.matricula || '',
          role: currentAgent.role || ''
        } : null,
        consentimento: getConsent(),
        contagens: counts,
        estadoSistema: {
          lastSyncAt: systemState.lastSyncAt || '',
          lastSyncError: systemState.lastSyncError || '',
          pendingSync: !!systemState.pendingSync,
          pendingReason: systemState.pendingReason || '',
          lastBackupAt: systemState.lastBackupAt || ''
        },
        observacao: 'Este diagnóstico não exporta lista completa de moradores, telefones, endereços ou visitas. Use apenas para suporte técnico.'
      };
  
      downloadTextFile(
        'ace-diagnostico-lgpd-' + new Date().toISOString().slice(0, 10) + '.json',
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8'
      );
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
      }, 1200);
    }
  
    function lockSession(reason) {
      var currentApp = getApp();
  
      try {
        if (currentApp && currentApp.state) {
          currentApp.state.currentAgent = null;
        }
  
        if (currentApp && typeof currentApp.saveSession === 'function') {
          currentApp.saveSession(null);
        } else {
          writeLogicalStorage('session', null);
        }
      } catch (error) {
        writeLogicalStorage('session', null);
      }
  
      var appShell = $('appShell');
      var loginScreen = $('loginScreen');
  
      if (appShell) {
        appShell.classList.add('hidden');
      }
  
      if (loginScreen) {
        loginScreen.classList.remove('hidden');
      }
  
      closePrivacyModal();
      refreshConsentUi();
      notify(reason || 'Sessão bloqueada por segurança.', 'warn');
    }
  
    function clearLocalDataWithConfirmation() {
      var counts = getCounts();
      var pending = hasPendingLocalData();

      if (pending) {
        notify('Limpeza bloqueada: existem dados pendentes no aparelho. Sincronize ou exporte backup antes de qualquer limpeza.', 'danger');
        return;
      }

      var message = [
        'Essa ação vai limpar os dados locais deste aparelho.',
        '',
        'Visitas locais: ' + counts.visits,
        'Tubitos locais: ' + counts.tubitos,
        'Solicitações de supervisão locais: ' + counts.supervisionRequests,
        'Pontos de rota locais: ' + counts.locationTrail,
        'Pendentes totais: ' + (counts.totalPending || counts.unsynced),
        'Imóveis em cache: ' + counts.properties,
        'Agentes locais: ' + counts.agents,
        '',
        'A fila parece limpa neste aparelho.',
        '',
        'Para confirmar, digite LIMPAR.'
      ].join('\n');

      var typed = root.prompt(message);

      if (typed !== 'LIMPAR') {
        notify('Limpeza local cancelada.', 'warn');
        return;
      }

      clearLocalOperationalData().then(function () {
        notify('Dados locais limpos. A página será recarregada.', 'ok');
        setTimeout(function () {
          root.location.reload();
        }, 900);
      }).catch(function () {
        notify('Não foi possível limpar todos os dados locais. Tente fechar outras abas e repetir.', 'danger');
      });
    }

    function clearLocalOperationalData() {
      var currentApp = getApp();
      var keys = collectOperationalStorageKeys();
  
      keys.forEach(function (key) {
        removeLocalStorageKey(key);
      });
  
      if (currentApp && currentApp.storageCache) {
        Object.keys(currentApp.storageCache).forEach(function (logicalKey) {
          currentApp.storageCache[logicalKey] = getStorageFallback(logicalKey);
        });
      }
  
      if (currentApp && currentApp.state) {
        currentApp.state.currentAgent = null;
        currentApp.state.currentProperty = null;
      }
  
      var indexedTasks = [];
  
      try {
        if (
          root.ACEIndexedStore &&
          typeof root.ACEIndexedStore.remove === 'function' &&
          currentApp &&
          currentApp.STORAGE_KEYS
        ) {
          Object.keys(currentApp.STORAGE_KEYS).forEach(function (logicalKey) {
            var list = currentApp.STORAGE_KEYS[logicalKey] || [];
            list.forEach(function (key) {
              indexedTasks.push(root.ACEIndexedStore.remove(key).catch(function () {
                return false;
              }));
            });
          });
        }
      } catch (error) {}
  
      return Promise.all(indexedTasks).then(function () {
        writeJson(CONFIG.consentKey, getConsent() || {
          accepted: true,
          acceptedAt: nowIso(),
          version: CONFIG.version,
          notice: 'Consentimento preservado após limpeza operacional local.'
        });
  
        try {
          root.localStorage.setItem(CONFIG.privacyModeKey, isPrivacyModeOn() ? '1' : '0');
        } catch (error) {}
  
        return true;
      });
    }
  
    function collectOperationalStorageKeys() {
      var currentApp = getApp();
      var keys = [];
  
      if (currentApp && currentApp.STORAGE_KEYS) {
        Object.keys(currentApp.STORAGE_KEYS).forEach(function (logicalKey) {
          var list = currentApp.STORAGE_KEYS[logicalKey] || [];
          list.forEach(function (key) {
            if (keys.indexOf(key) === -1) {
              keys.push(key);
            }
          });
        });
      }
  
      try {
        for (var i = 0; i < root.localStorage.length; i += 1) {
          var key = root.localStorage.key(i);
  
          if (!key) {
            continue;
          }
  
          var shouldInclude = CONFIG.operationalLocalStoragePrefixes.some(function (prefix) {
            return key.indexOf(prefix) === 0;
          });
  
          if (shouldInclude && keys.indexOf(key) === -1) {
            keys.push(key);
          }
        }
      } catch (error) {}
  
      return keys.filter(function (key) {
        return CONFIG.preservedLocalStorageKeys.indexOf(key) === -1;
      });
    }
  
    function installBeforeUnloadGuard() {
      if (root.__aceLgpdBeforeUnloadInstalled) {
        return;
      }
  
      root.__aceLgpdBeforeUnloadInstalled = true;
  
      root.addEventListener('beforeunload', function (event) {
        if (!hasPendingLocalData()) {
          return undefined;
        }
  
        var message = 'Há dados locais pendentes. Envie a fila antes de sair ou fechar a página.';
        event.preventDefault();
        event.returnValue = message;
        return message;
      });
    }
  
    function installIdleLock() {
      if (root.__aceLgpdIdleLockInstalled) {
        return;
      }
  
      root.__aceLgpdIdleLockInstalled = true;
  
      ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach(function (eventName) {
        root.addEventListener(eventName, markActivity, { passive: true });
      });
  
      markActivity();
  
      setInterval(function () {
        var currentApp = getApp();
        var appShell = $('appShell');
        var isLogged = !!(currentApp && currentApp.state && currentApp.state.currentAgent);
        var shellVisible = appShell && !appShell.classList.contains('hidden');
  
        if (!isLogged && !shellVisible) {
          return;
        }
  
        var elapsed = Date.now() - getLastActivity();
  
        if (elapsed >= CONFIG.idleLimitMs) {
          lockSession('Sessão bloqueada automaticamente por inatividade.');
        }
      }, 30000);
    }
  
    function formatDateTime(value) {
      var date = new Date(value);
  
      if (!value || Number.isNaN(date.getTime())) {
        return '-';
      }
  
      return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  
    function installPeriodicRefresh() {
      if (root.__aceLgpdPeriodicRefreshInstalled) {
        return;
      }
  
      root.__aceLgpdPeriodicRefreshInstalled = true;
  
      setInterval(function () {
        refreshStatusPill();
        installSyncCenterButton();
        installAdminPanelButton();
  
        if ($('lgpdPrivacyModal') && $('lgpdPrivacyModal').classList.contains('show')) {
          refreshPrivacyModal();
        }
      }, 5000);
    }
  
    function boot() {
      
      if (LGPD.__booted) {
        refreshConsentUi();
        refreshPrivacyButtons();
        refreshStatusPill();
        return;
      }

      LGPD.__booted = true;
      injectStyles();
      installConsentPanel();
      installLoginGuard();
      enhanceInputs();
      installToolbar();
      installSyncCenterButton();
      installAdminPanelButton();
      installBeforeUnloadGuard();
      installIdleLock();
      installPeriodicRefresh();
      wrapExports();
      refreshConsentUi();
      refreshPrivacyButtons();
      refreshStatusPill();
    }
  
    LGPD.openPrivacyModal = openPrivacyModal;
    LGPD.clearLocalOperationalData = clearLocalOperationalData;
    LGPD.lockSession = lockSession;
    LGPD.setPrivacyMode = setPrivacyMode;
    LGPD.hasConsent = hasConsent;
    LGPD.getCounts = getCounts;
    LGPD.version = CONFIG.version;
  
    if (documentRef.readyState === 'loading') {
      documentRef.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  
    root.addEventListener('load', function () {
      setTimeout(boot, 500);
      setTimeout(boot, 1500);
    });
  }());
