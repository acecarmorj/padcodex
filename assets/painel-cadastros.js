(function () {
  'use strict';

  var root = window;
  var documentRef = document;
  var VERSION = '20260502-cadastros-v8';
  var state = {
    agents: [],
    editingUid: '',
    search: '',
    booted: false,
    busy: false
  };

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

  function normalizeCpf(value) {
    return text(value).replace(/\D+/g, '').slice(0, 11);
  }

  function formatCpf(value) {
    var digits = normalizeCpf(value);
    if (digits.length <= 3) { return digits; }
    if (digits.length <= 6) { return digits.replace(/(\d{3})(\d+)/, '$1.$2'); }
    if (digits.length <= 9) { return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3'); }
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }

  function normalizeRole(value) {
    var raw = text(value).normalize ? text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '') : text(value);
    raw = raw.toLowerCase();
    if (raw === 'administrador' || raw === 'admin') { return 'Administrador'; }
    if (raw === 'supervisor' || raw === 'supervisao') { return 'Supervisor'; }
    if (raw === 'coordenador' || raw === 'coord' || raw === 'coordenacao') { return 'Coordenador'; }
    return 'ACE';
  }

  function roleClass(role) {
    return normalizeRole(role).toLowerCase();
  }

  function getRuntimeConfig() {
    return root.ACS_RUNTIME_CONFIG || {};
  }

  function getApiUrl() {
    var runtime = getRuntimeConfig();
    return text(runtime.API_URL || runtime.SHEETS_WEBAPP_URL || '');
  }

  function getSession() {
    if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getSessionInfo === 'function') {
      return root.ACEPanelCloudSync.getSessionInfo() || null;
    }
    return null;
  }

  function getSessionToken() {
    var session = getSession();
    return text(session && (session.sessionToken || session.session_token || session.token));
  }

  function getSessionRole() {
    var session = getSession();
    var role = session && session.agent && session.agent.role ? session.agent.role : (session && session.role ? session.role : '');
    return normalizeRole(role);
  }

  function isAdminSession() {
    return getSessionRole() === 'Administrador';
  }

  function setStatus(message, kind) {
    var node = $('aceCadastrosStatus');
    if (!node) { return; }
    node.textContent = message || '';
    node.className = 'ace-cadastros-status' + (kind ? ' is-' + kind : '');
  }

  function postJson(payload) {
    var url = getApiUrl();
    if (!url || !/^https?:\/\//i.test(url)) {
      return Promise.reject(new Error('API_URL não configurada.'));
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {})
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('A API não confirmou a operação.');
      }
      return response.json();
    }).then(function (payload) {
      if (!payload || payload.ok !== true) {
        throw new Error(payload && payload.error ? payload.error : 'A API retornou erro.');
      }
      return payload;
    });
  }

  function injectStyles() {
    if ($('aceCadastrosStyles')) { return; }
    var style = documentRef.createElement('style');
    style.id = 'aceCadastrosStyles';
    style.textContent = [
      '.ace-cadastros-modal{position:fixed;inset:0;z-index:100200;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(9,24,18,.62);backdrop-filter:blur(8px)}',
      '.ace-cadastros-modal[hidden]{display:none!important}',
      '.ace-cadastros-dialog{width:min(1180px,100%);max-height:92vh;overflow:auto;background:#f7fbf8;border-radius:28px;box-shadow:0 28px 80px rgba(9,24,18,.35);border:1px solid rgba(255,255,255,.75)}',
      '.ace-cadastros-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:24px 26px 18px;background:linear-gradient(135deg,#173826,#226042);color:#fff;border-radius:28px 28px 0 0}',
      '.ace-cadastros-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;opacity:.82}',
      '.ace-cadastros-header h2{margin:8px 0 6px;font-size:clamp(1.45rem,2.5vw,2.25rem);line-height:1.05}',
      '.ace-cadastros-header p{margin:0;color:rgba(255,255,255,.82);max-width:760px;line-height:1.45}',
      '.ace-cadastros-close{border:0;border-radius:999px;width:44px;height:44px;font-size:1.7rem;font-weight:900;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}',
      '.ace-cadastros-body{padding:22px 26px 26px}',
      '.ace-cadastros-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}',
      '.ace-cadastros-stat{background:#fff;border:1px solid #dfeae3;border-radius:20px;padding:14px;box-shadow:0 10px 24px rgba(23,56,38,.06)}',
      '.ace-cadastros-stat span{display:block;color:#66756c;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}',
      '.ace-cadastros-stat strong{display:block;color:#173826;font-size:1.8rem;margin-top:4px}',
      '.ace-cadastros-layout{display:grid;grid-template-columns:minmax(320px,440px) 1fr;gap:18px;align-items:start}',
      '.ace-cadastros-card{background:#fff;border:1px solid #dfeae3;border-radius:24px;padding:18px;box-shadow:0 14px 34px rgba(23,56,38,.08)}',
      '.ace-cadastros-card h3{margin:0 0 6px;color:#173826;font-size:1.15rem}',
      '.ace-cadastros-card p{margin:0 0 14px;color:#66756c;line-height:1.45;font-size:.92rem}',
      '.ace-cadastros-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.ace-cadastros-field{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}',
      '.ace-cadastros-field.is-full{grid-column:1/-1}',
      '.ace-cadastros-field label{font-weight:900;color:#173826;font-size:.88rem}',
      '.ace-cadastros-field input,.ace-cadastros-field select{width:100%;border:1px solid #cfdcd5;border-radius:14px;padding:12px 13px;font:600 .95rem/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fbfdfc;color:#173826;outline:none}',
      '.ace-cadastros-field input:focus,.ace-cadastros-field select:focus{border-color:#2e7d52;box-shadow:0 0 0 4px rgba(46,125,82,.12);background:#fff}',
      '.ace-cadastros-help{font-size:.78rem;color:#718077;line-height:1.35}',
      '.ace-cadastros-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}',
      '.ace-cadastros-btn{border:0;border-radius:14px;padding:11px 14px;font-weight:900;cursor:pointer;background:#edf5f0;color:#173826}',
      '.ace-cadastros-btn.primary{background:#1f7a4a;color:#fff}',
      '.ace-cadastros-btn.danger{background:#fee2e2;color:#991b1b}',
      '.ace-cadastros-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.ace-cadastros-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.ace-cadastros-search{flex:1;border:1px solid #cfdcd5;border-radius:16px;padding:12px 14px;font-weight:700;background:#fff;outline:none}',
      '.ace-cadastros-list{display:grid;gap:10px;max-height:520px;overflow:auto;padding-right:4px}',
      '.ace-cadastros-user{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;border:1px solid #dfeae3;background:#fbfdfc;border-radius:18px;padding:13px}',
      '.ace-cadastros-user strong{display:block;color:#173826;font-size:1rem}',
      '.ace-cadastros-user small{display:block;color:#66756c;margin-top:4px;line-height:1.35}',
      '.ace-cadastros-role{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:.74rem;font-weight:900;margin-top:8px;background:#edf5f0;color:#173826}',
      '.ace-cadastros-role.administrador{background:#efe7ff;color:#5b21b6}',
      '.ace-cadastros-role.coordenador{background:#dbeafe;color:#1d4ed8}',
      '.ace-cadastros-role.supervisor{background:#ffedd5;color:#9a3412}',
      '.ace-cadastros-role.ace{background:#dcfce7;color:#166534}',
      '.ace-cadastros-user-actions{display:flex;flex-direction:column;gap:7px}',
      '.ace-cadastros-user-actions button{border:0;border-radius:12px;padding:9px 10px;font-weight:900;cursor:pointer;background:#eef7f1;color:#173826;white-space:nowrap}',
      '.ace-cadastros-user-actions button[data-action="delete"]{background:#fee2e2;color:#991b1b}',
      '.ace-cadastros-status{margin-top:12px;padding:11px 12px;border-radius:14px;background:#eff6ff;color:#1e3a8a;font-weight:800;font-size:.88rem}',
      '.ace-cadastros-status.is-ok{background:#ecfdf5;color:#166534}',
      '.ace-cadastros-status.is-warn{background:#fffbeb;color:#92400e}',
      '.ace-cadastros-status.is-error{background:#fef2f2;color:#991b1b}',
      '.ace-cadastros-empty{padding:20px;border-radius:18px;background:#f8fafc;color:#64748b;text-align:center;font-weight:800}',
      '@media(max-width:900px){.ace-cadastros-layout{grid-template-columns:1fr}.ace-cadastros-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media(max-width:620px){.ace-cadastros-modal{padding:10px}.ace-cadastros-header{padding:20px}.ace-cadastros-body{padding:16px}.ace-cadastros-grid{grid-template-columns:1fr}.ace-cadastros-summary{grid-template-columns:1fr}.ace-cadastros-user{grid-template-columns:1fr}.ace-cadastros-user-actions{flex-direction:row;flex-wrap:wrap}}'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function ensureModal() {
    var overlay = $('aceCadastrosModal');
    if (overlay) { return overlay; }
    overlay = documentRef.createElement('div');
    overlay.id = 'aceCadastrosModal';
    overlay.className = 'ace-cadastros-modal';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'aceCadastrosTitle');
    overlay.innerHTML = [
      '<section class="ace-cadastros-dialog">',
      '  <header class="ace-cadastros-header">',
      '    <div>',
      '      <span class="ace-cadastros-eyebrow">▣ Gestão de acesso</span>',
      '      <h2 id="aceCadastrosTitle">Cadastro de usuários</h2>',
      '      <p>Crie e edite ACE, Supervisores, Coordenadores e Administradores. O painel de campo permanece separado do cadastro administrativo.</p>',
      '    </div>',
      '    <button type="button" class="ace-cadastros-close" data-cadastros-close="true" aria-label="Fechar">×</button>',
      '  </header>',
      '  <div class="ace-cadastros-body">',
      '    <div class="ace-cadastros-summary" id="aceCadastrosSummary"></div>',
      '    <div class="ace-cadastros-layout">',
      '      <section class="ace-cadastros-card">',
      '        <h3 id="aceCadastrosFormTitle">Novo usuário</h3>',
      '        <p>Use CPF com máscara. Para usuário novo, informe uma senha temporária. Para edição, deixe a senha em branco para manter a atual.</p>',
      '        <form id="aceCadastrosForm" novalidate>',
      '          <div class="ace-cadastros-grid">',
      '            <div class="ace-cadastros-field is-full"><label for="aceCadNome">Nome completo</label><input id="aceCadNome" name="nome" autocomplete="name" required placeholder="Ex.: Maria da Silva"></div>',
      '            <div class="ace-cadastros-field"><label for="aceCadCpf">CPF</label><input id="aceCadCpf" name="cpf" inputmode="numeric" autocomplete="username" maxlength="14" required placeholder="000.000.000-00"></div>',
      '            <div class="ace-cadastros-field"><label for="aceCadMatricula">Matrícula/código</label><input id="aceCadMatricula" name="matricula" required placeholder="Ex.: ACE012"></div>',
      '            <div class="ace-cadastros-field"><label for="aceCadRole">Perfil</label><select id="aceCadRole" name="role"><option>ACE</option><option>Supervisor</option><option>Coordenador</option><option>Administrador</option></select></div>',
      '            <div class="ace-cadastros-field"><label for="aceCadMicroarea">Microárea-base</label><input id="aceCadMicroarea" name="base_microarea" placeholder="Ex.: M02"></div>',
      '            <div class="ace-cadastros-field is-full"><label for="aceCadRegiao">Região / referência</label><input id="aceCadRegiao" name="base_region" placeholder="Bairro, distrito, setor ou ponto de apoio"></div>',
      '            <div class="ace-cadastros-field"><label for="aceCadSenha">Senha temporária</label><input id="aceCadSenha" name="senha" type="password" autocomplete="new-password" placeholder="Obrigatória para novo usuário"></div>',
      '            <div class="ace-cadastros-field"><label for="aceCadSenha2">Confirmar senha</label><input id="aceCadSenha2" name="senha2" type="password" autocomplete="new-password" placeholder="Repita a senha"></div>',
      '          </div>',
      '          <div class="ace-cadastros-help">Permissões: ACE usa somente o app de campo; Supervisor usa laboratório/supervisão; Coordenador usa painel da coordenação; Administrador gerencia tudo.</div>',
      '          <div class="ace-cadastros-actions">',
      '            <button type="submit" class="ace-cadastros-btn primary" id="aceCadSalvarBtn">Salvar usuário</button>',
      '            <button type="button" class="ace-cadastros-btn" id="aceCadNovoBtn">Limpar / novo</button>',
      '          </div>',
      '          <div id="aceCadastrosStatus" class="ace-cadastros-status">Pronto para cadastrar.</div>',
      '        </form>',
      '      </section>',
      '      <section class="ace-cadastros-card">',
      '        <div class="ace-cadastros-toolbar">',
      '          <input id="aceCadSearch" class="ace-cadastros-search" placeholder="Buscar por nome, CPF, matrícula ou perfil">',
      '          <button type="button" class="ace-cadastros-btn" id="aceCadReloadBtn">Atualizar</button>',
      '        </div>',
      '        <div id="aceCadastrosList" class="ace-cadastros-list"></div>',
      '      </section>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('');
    documentRef.body.appendChild(overlay);
    bindModalEvents(overlay);
    return overlay;
  }

  function getBundleAgents() {
    var bundle = root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.getBundle === 'function'
      ? root.ACEPanelCloudSync.getBundle()
      : null;
    return bundle && Array.isArray(bundle.agents) ? bundle.agents.slice() : [];
  }

  function normalizeAgent(row) {
    row = row || {};
    return {
      uid: text(row.uid),
      nome: text(row.nome || row.name),
      matricula: text(row.matricula),
      cpf: normalizeCpf(row.cpf),
      role: normalizeRole(row.role || 'ACE'),
      base_microarea: text(row.base_microarea || row.baseMicroarea),
      base_region: text(row.base_region || row.baseRegion),
      updatedAt: text(row.updatedAt || row.updated_at)
    };
  }

  function sortAgents(rows) {
    return rows.slice().sort(function (a, b) {
      return (a.role + ' ' + a.nome).localeCompare(b.role + ' ' + b.nome, 'pt-BR');
    });
  }

  function loadAgentsFromBundle() {
    state.agents = sortAgents(getBundleAgents().map(normalizeAgent));
    render();
  }

  function refreshAgentsFromApi() {
    if (!isAdminSession()) {
      setStatus('Apenas Administrador pode atualizar cadastros.', 'error');
      return Promise.resolve();
    }
    state.busy = true;
    setStatus('Atualizando lista de usuários...', 'warn');
    return postJson({
      action: 'admin_agents_list',
      access_module: 'administrador',
      sessionToken: getSessionToken()
    }).then(function (payload) {
      state.agents = sortAgents((payload.agents || []).map(normalizeAgent));
      setStatus('Lista atualizada.', 'ok');
      render();
      return payload;
    }).catch(function (error) {
      loadAgentsFromBundle();
      setStatus('Usei a lista já carregada no painel. API respondeu: ' + error.message, 'warn');
    }).finally(function () {
      state.busy = false;
      render();
    });
  }

  function getRoleCounts() {
    var counts = { ACE: 0, Supervisor: 0, Coordenador: 0, Administrador: 0 };
    state.agents.forEach(function (agent) {
      counts[normalizeRole(agent.role)] = (counts[normalizeRole(agent.role)] || 0) + 1;
    });
    return counts;
  }

  function renderSummary() {
    var node = $('aceCadastrosSummary');
    if (!node) { return; }
    var counts = getRoleCounts();
    node.innerHTML = [
      ['ACE', counts.ACE || 0],
      ['Supervisor', counts.Supervisor || 0],
      ['Coordenador', counts.Coordenador || 0],
      ['Administrador', counts.Administrador || 0]
    ].map(function (item) {
      return '<div class="ace-cadastros-stat"><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong></div>';
    }).join('');
  }

  function getFilteredAgents() {
    var q = text(state.search).toLowerCase();
    if (!q) { return state.agents; }
    return state.agents.filter(function (agent) {
      return [
        agent.nome,
        agent.matricula,
        formatCpf(agent.cpf),
        agent.cpf,
        agent.role,
        agent.base_microarea,
        agent.base_region
      ].join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function renderList() {
    var node = $('aceCadastrosList');
    if (!node) { return; }
    var rows = getFilteredAgents();
    if (!rows.length) {
      node.innerHTML = '<div class="ace-cadastros-empty">Nenhum usuário encontrado.</div>';
      return;
    }
    node.innerHTML = rows.map(function (agent) {
      return [
        '<article class="ace-cadastros-user" data-agent-uid="' + escapeHtml(agent.uid) + '">',
        '  <div>',
        '    <strong>' + escapeHtml(agent.nome || 'Sem nome') + '</strong>',
        '    <small>' + escapeHtml(formatCpf(agent.cpf) || 'CPF não informado') + ' • ' + escapeHtml(agent.matricula || 'sem matrícula') + '</small>',
        '    <small>' + escapeHtml([agent.base_microarea, agent.base_region].filter(Boolean).join(' • ') || 'Sem território-base') + '</small>',
        '    <span class="ace-cadastros-role ' + escapeHtml(roleClass(agent.role)) + '">' + escapeHtml(agent.role) + '</span>',
        '  </div>',
        '  <div class="ace-cadastros-user-actions">',
        '    <button type="button" data-action="edit" data-uid="' + escapeHtml(agent.uid) + '">Editar</button>',
        '    <button type="button" data-action="delete" data-uid="' + escapeHtml(agent.uid) + '">Remover</button>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function render() {
    renderSummary();
    renderList();
    var save = $('aceCadSalvarBtn');
    if (save) {
      save.disabled = state.busy || !isAdminSession();
      save.textContent = state.busy ? 'Salvando...' : 'Salvar usuário';
    }
  }

  function resetForm() {
    state.editingUid = '';
    var form = $('aceCadastrosForm');
    if (form) { form.reset(); }
    var title = $('aceCadastrosFormTitle');
    if (title) { title.textContent = 'Novo usuário'; }
    var role = $('aceCadRole');
    if (role) { role.value = 'ACE'; }
    setStatus(isAdminSession() ? 'Pronto para cadastrar.' : 'Apenas Administrador pode alterar cadastros.', isAdminSession() ? 'ok' : 'error');
  }

  function findAgent(uid) {
    uid = text(uid);
    return state.agents.filter(function (agent) { return agent.uid === uid; })[0] || null;
  }

  function editAgent(uid) {
    var agent = findAgent(uid);
    if (!agent) { return; }
    state.editingUid = agent.uid;
    $('aceCadNome').value = agent.nome;
    $('aceCadCpf').value = formatCpf(agent.cpf);
    $('aceCadMatricula').value = agent.matricula;
    $('aceCadRole').value = normalizeRole(agent.role);
    $('aceCadMicroarea').value = agent.base_microarea;
    $('aceCadRegiao').value = agent.base_region;
    $('aceCadSenha').value = '';
    $('aceCadSenha2').value = '';
    var title = $('aceCadastrosFormTitle');
    if (title) { title.textContent = 'Editando ' + agent.nome; }
    setStatus('Editando usuário. Deixe a senha em branco para manter a atual.', 'warn');
  }

  function collectForm() {
    var password = text($('aceCadSenha').value);
    var password2 = text($('aceCadSenha2').value);
    var isNew = !state.editingUid;
    var cpf = normalizeCpf($('aceCadCpf').value);
    var payload;

    if (!text($('aceCadNome').value)) { throw new Error('Informe o nome completo.'); }
    if (cpf.length !== 11) { throw new Error('Informe um CPF válido.'); }
    if (!text($('aceCadMatricula').value)) { throw new Error('Informe a matrícula/código.'); }
    if (isNew && !password) { throw new Error('Informe uma senha temporária para novo usuário.'); }
    if (password || password2) {
      if (password !== password2) { throw new Error('As senhas não conferem.'); }
      if (password.length < 6) { throw new Error('Use uma senha temporária com pelo menos 6 caracteres.'); }
    }

    payload = {
      uid: state.editingUid,
      nome: text($('aceCadNome').value),
      cpf: cpf,
      matricula: text($('aceCadMatricula').value).toUpperCase(),
      role: normalizeRole($('aceCadRole').value),
      base_microarea: text($('aceCadMicroarea').value),
      base_region: text($('aceCadRegiao').value)
    };
    if (password) { payload.senha = password; }
    return payload;
  }

  function saveAgent(event) {
    event.preventDefault();
    if (!isAdminSession()) {
      setStatus('Apenas Administrador pode salvar cadastros.', 'error');
      return;
    }

    var agent;
    try {
      agent = collectForm();
    } catch (error) {
      setStatus(error.message, 'error');
      return;
    }

    state.busy = true;
    render();
    setStatus('Salvando usuário na planilha...', 'warn');

    postJson({
      action: 'admin_agent_save',
      access_module: 'administrador',
      sessionToken: getSessionToken(),
      agent: agent
    }).then(function (payload) {
      state.agents = sortAgents((payload.agents || []).map(normalizeAgent));
      resetForm();
      setStatus('Usuário salvo com sucesso.', 'ok');
      if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.reloadFromCloud === 'function') {
        root.ACEPanelCloudSync.reloadFromCloud().catch(function () { return null; });
      }
    }).catch(function (error) {
      setStatus(error.message, 'error');
    }).finally(function () {
      state.busy = false;
      render();
    });
  }

  function deleteAgent(uid) {
    var agent = findAgent(uid);
    if (!agent || !isAdminSession()) { return; }
    if (!root.confirm('Remover o usuário "' + agent.nome + '"? Esta ação remove o acesso dele ao sistema.')) {
      return;
    }
    state.busy = true;
    render();
    setStatus('Removendo usuário...', 'warn');
    postJson({
      action: 'admin_agent_delete',
      access_module: 'administrador',
      sessionToken: getSessionToken(),
      agent: {
        uid: agent.uid,
        cpf: agent.cpf,
        matricula: agent.matricula
      }
    }).then(function (payload) {
      state.agents = sortAgents((payload.agents || []).map(normalizeAgent));
      resetForm();
      setStatus('Usuário removido.', 'ok');
      if (root.ACEPanelCloudSync && typeof root.ACEPanelCloudSync.reloadFromCloud === 'function') {
        root.ACEPanelCloudSync.reloadFromCloud().catch(function () { return null; });
      }
    }).catch(function (error) {
      setStatus(error.message, 'error');
    }).finally(function () {
      state.busy = false;
      render();
    });
  }

  function bindModalEvents(overlay) {
    var form = overlay.querySelector('#aceCadastrosForm');
    var cpf = overlay.querySelector('#aceCadCpf');
    var search = overlay.querySelector('#aceCadSearch');
    var novo = overlay.querySelector('#aceCadNovoBtn');
    var reload = overlay.querySelector('#aceCadReloadBtn');

    if (form) { form.addEventListener('submit', saveAgent); }
    if (cpf) {
      cpf.addEventListener('input', function () {
        cpf.value = formatCpf(cpf.value);
      });
    }
    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value;
        renderList();
      });
    }
    if (novo) { novo.addEventListener('click', resetForm); }
    if (reload) { reload.addEventListener('click', refreshAgentsFromApi); }

    overlay.addEventListener('click', function (event) {
      var close = event.target && event.target.getAttribute('data-cadastros-close') === 'true';
      var actionButton = event.target && event.target.closest ? event.target.closest('[data-action][data-uid]') : null;
      if (close) {
        closeModal();
        return;
      }
      if (!actionButton) { return; }
      event.preventDefault();
      if (actionButton.getAttribute('data-action') === 'edit') {
        editAgent(actionButton.getAttribute('data-uid'));
      }
      if (actionButton.getAttribute('data-action') === 'delete') {
        deleteAgent(actionButton.getAttribute('data-uid'));
      }
    });
  }

  function openModal() {
    injectStyles();
    var overlay = ensureModal();
    loadAgentsFromBundle();
    overlay.hidden = false;
    documentRef.body.classList.add('is-cadastros-modal-open');
    if (!isAdminSession()) {
      setStatus('Apenas Administrador pode criar, editar ou remover usuários. Seu perfil atual: ' + getSessionRole() + '.', 'error');
    } else {
      refreshAgentsFromApi();
    }
    setTimeout(function () {
      var first = $('aceCadNome');
      if (first) { first.focus(); }
    }, 30);
  }

  function closeModal() {
    var overlay = $('aceCadastrosModal');
    if (overlay) { overlay.hidden = true; }
    documentRef.body.classList.remove('is-cadastros-modal-open');
  }

  function bindSidebar() {
    var cadastro = $('sidebarCadastroBtn');
    var config = $('sidebarConfigBtn');
    [cadastro, config].forEach(function (button) {
      if (!button || button.dataset.cadastrosBound === '1') { return; }
      button.dataset.cadastrosBound = '1';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        openModal();
      }, true);
    });
  }

  function boot() {
    if (state.booted) { return; }
    state.booted = true;
    injectStyles();
    bindSidebar();
    setTimeout(bindSidebar, 400);
    setTimeout(bindSidebar, 1400);
    documentRef.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeModal(); }
    });
  }

  root.ACEPanelCadastros = {
    version: VERSION,
    open: openModal,
    close: closeModal,
    refresh: refreshAgentsFromApi
  };

  if (documentRef.readyState === 'loading') {
    documentRef.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
