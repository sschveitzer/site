// === Bootstrap globals (S, supabaseClient) ===
(function(){
  try {
    if (typeof window !== 'undefined') {
      window.S = window.S || {};
      // If a Supabase client exists on window, alias it to a global var name used by the app
      if (!('supabaseClient' in window) && window.supabase && typeof window.supabase.from === 'function') {
        window.supabaseClient = window.supabase;
      }
      // Also expose a global identifier (var) to avoid ReferenceError when the code uses bare supabaseClient
      try { window.supabaseClient = window.supabaseClient || null; } catch(_){}
    }
  } catch(_) {}
})();

// === Global DOM helpers (fallbacks) ===
(function(){
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.qs !== 'function')  window.qs  = s => document.querySelector(s);
      if (typeof window.qsa !== 'function') window.qsa = s => Array.from(document.querySelectorAll(s));
    }
  } catch(_) {}
})();

window.onload = function () {
  // Usa o supabase já criado no dashboard.html
  const supabaseClient = window.supabaseClient || supabase;

  // ========= ESTADO GLOBAL =========
  let S = {
    tx: [],
    cats: [],
    recs: [], // recorrências
    metas: { total: 0, porCat: {},
    month: null,
    hide: false,
    dark: false,
    useCycleForReports: true,
    // Preferências de fatura
    ccDueDay: null,
    ccClosingDay: null,
    editingId: null
  };

  // Carteiras
  S.walletList = ["Casa","Pessoa 1","Pessoa 2"];

// Expor S e um setter global para alternar o modo de ciclo nos relatórios/metas
try {
  window.S = S;
  if (typeof window.setUseCycleForReports !== 'function') {
    window.setUseCycleForReports = function(v){
      S.useCycleForReports = !!v;
      try { savePrefs(); } catch(e) {}
      try { render();
    ensureMonthSelectLabels();
    try { renderPessoas(); } catch(_) {} catch(e) {};
  } catch (e) {}



  // ========= HELPERS GERAIS =========
  function gid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }
  function nowYMD() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }
  function toYMD(d) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }
  function isIsoDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }
  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n)
      ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$\u00a00,00";
  }
  function parseMoneyMasked(str) {
    if (!str) return 0;
    return Number(str.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
  

  }

function money(v){
  return (typeof v === 'number') ? v : parseMoneyMasked(String(v||'');
}

  function addDays(ymd, days) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return toYMD(dt);
  }
  function lastDayOfMonth(y, m) {
    return new Date(y, m, 0).getDate(); // m = 1..12
  }

  // Retorna "YYYY-MM" do mês anterior ao fornecido (também "YYYY-MM")
  function prevYM(ym) {
    try {
      const [y, m] = ym.split("-").map(Number);
      const d = new Date(y, (m - 1) - 1, 1);
      return d.toISOString().slice(0, 7);
    } catch (e) {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().slice(0, 7);
    }
  function incMonthly(ymd, diaMes, ajusteFimMes = true) {
    const [y, m] = ymd.split("-").map(Number);
    let yy = y, mm = m + 1;
    if (mm > 12) { mm = 1; yy += 1; }
    const ld = lastDayOfMonth(yy, mm);
    const day = ajusteFimMes ? Math.min(diaMes, ld) : diaMes;
    return toYMD(new Date(yy, mm - 1, day);
  }
  function incWeekly(ymd) { return addDays(ymd, 7); }
  function incYearly(ymd, diaMes, mes, ajusteFimMes = true) {
    const [y] = ymd.split("-").map(Number);
    const yy = y + 1;
    const ld = lastDayOfMonth(yy, mes);
    const day = ajusteFimMes ? Math.min(diaMes, ld) : diaMes;
    return toYMD(new Date(yy, mes - 1, day);
  }

  const qs  = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s);

// === Helpers de abreviação de mês/ano ===
function abbrevLabelFromYM(ym){
  try {
    if (!/^\d{4}-\d{2}$/.test(String(ym))) return String(ym);
    var parts = ym.split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var abrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    var mes = (m>=1 && m<=12) ? abrev[m-1] : ym;
    return mes + '/' + String(y).slice(2);
  } catch(_) { return String(ym); }

function ensureMonthSelectLabels(){
  try {
    var sel = document.getElementById('monthSelect');
    if (!sel) return;
    Array.from(sel.options || []).forEach(function(opt){
      if (!opt) return;
      var v = opt.value || '';
      if (/^\d{4}-\d{2}$/.test(v)) {
        opt.textContent = abbrevLabelFromYM(v);
      });
  } catch(_) {}


  // ========= LOAD DATA =========
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await supabaseClient.from("transactions").select("*");
    
    
    if (txError) { console.error("Erro ao carregar transações:", txError); S.tx = []; }
    else { S.tx = tx || []; }

    // Categorias
    const { data: cats, error: catsError } = await supabaseClient.from("categories").select("*");
    if (catsError) { console.error("Erro ao carregar categorias:", catsError); S.cats = []; }
    else { S.cats = cats || []; }

    // Preferências (month, hide, dark)
    const { data: prefs, error: prefsError } = await supabaseClient
      .from("preferences").select("*").eq("id", 1).maybeSingle();
    if (prefsError) { console.error("Erro ao carregar preferências:", prefsError); }
    if (prefs) {
      S.month = prefs.month ?? S.month;
      S.hide  = !!prefs.hide;
      S.dark  = !!prefs.dark;
      // Lê valores em snake_case do banco
      S.ccDueDay     = Number(prefs.cc_due_day)     || null;
      S.ccClosingDay = Number(prefs.cc_closing_day) || null;
      if (prefs.use_cycle_for_reports !== undefined && prefs.use_cycle_for_reports !== null) {
        S.useCycleForReports = !!prefs.use_cycle_for_reports;
      } else {
        S.useCycleForReports = true;
      }

    // Garante mês atual se não houver salvo
    if (!S.month) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      S.month = `${y}-${m}`;
    }

    // Recorrências
    const { data: recs, error: recErr } = await supabaseClient.from("recurrences").select("*");
    if (recErr) { console.error("Erro ao carregar recorrências:", recErr); S.recs = []; }
    else { S.recs = recs || []; }

    // Materializa recorrências vencidas
    await applyRecurrences();
    // Carrega metas do Supabase
    await fetchMetas();

    render();

  // === Re-render de Lançamentos ao trocar o mês no topo ===
  const monthSel = document.getElementById('monthSelect');
  if (monthSel && !monthSel._wiredLanc) {
    monthSel.addEventListener('change', (e) => {
      S.month = e.target.value;
      try { savePrefs(); } catch (e) {}
      try { render(); } catch (e) {}
      try { renderPessoas(); } catch (e) {}
      try { renderLancamentos(); } catch (e) {});
    ensureMonthSelectLabels();
    monthSel._wiredLanc = true;
  }

  // ========= SAVE =========
  async function saveTx(t)    { return await supabaseClient.from("transactions").upsert([t]); }
  async function deleteTx(id) { return await supabaseClient.from("transactions").delete().eq("id", id); }
  async function saveCat(c)   { return await supabaseClient.from("categories").upsert([c]); }
  async function deleteCat(nome){ return await supabaseClient.from("categories").delete().eq("nome", nome); }
  async function savePrefs(){
// Envia em snake_case para bater com o schema
  const payload = {
    id: 1,
    month: S.month,
    hide: !!S.hide,
    dark: !!S.dark,
    cc_due_day: (Number(S.ccDueDay) || null),
    cc_closing_day: (Number(S.ccClosingDay) || null),
    // ✅ novo: persiste o uso do ciclo da fatura
    use_cycle_for_reports: !!S.useCycleForReports
  };
  const { error } = await supabaseClient.from("preferences").upsert([payload]);
  if (error) {
    console.error("Erro ao salvar preferências:", error);
    alert("Não foi possível salvar as preferências: " + (error.message || "Erro desconhecido");
  }

  // Atualiza categoria nas transações (rename)
  async function updateTxCategory(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    await supabaseClient.from("transactions").update({ categoria: newName }).eq("categoria", oldName);
  }

  // ========= RECORRÊNCIAS =========
  async function saveRec(r) {
    return await supabaseClient.from("recurrences").upsert([r]).select().single();
  }
  async function deleteRec(id) {
    return await supabaseClient.from("recurrences").delete().eq("id", id);
  }
  async function toggleRecAtivo(id, ativo) {
    return await supabaseClient.from("recurrences").update({ ativo }).eq("id", id);
  }

  async function materializeOne(rec, occDate) {
    const t = {
      id: gid(),
      tipo: rec.tipo,
      categoria: rec.categoria,
      data: occDate,
      descricao: rec.descricao,
      valor: Number(rec.valor) || 0,
      obs: rec.obs ? (rec.obs + " (recorrente)") : "Recorrente",
      recurrence_id: rec.id,
      occurrence_date: occDate
    };
    // Carteira/Transferência
    if (modalTipo === "Transferência") {
      t.carteira = null;
      t.carteira_origem  = (qs("#mOrigem")?.value || "Casa");
      t.carteira_destino = (qs("#mDestino")?.value || "Pessoa 1");
    } else {
      t.carteira = (qs("#mCarteira")?.value || "Casa");
      t.carteira_origem = null;
      t.carteira_destino = null;
    }
    await saveTx(t);
  }

  async function applyRecurrences() {
    if (!Array.isArray(S.recs) || !S.recs.length) return;
    const today = nowYMD();

    for (const r of S.recs) {
      if (!r.ativo) continue;
      if (r.fim_em && r.fim_em < today) continue;

      let next = r.proxima_data || today;
      let changed = false;

      while (next <= today) {
        if (r.fim_em && next > r.fim_em) break;
        await materializeOne(r, next);
        changed = true;

        if (r.periodicidade === "Mensal") {
          next = incMonthly(next, r.dia_mes || 1, r.ajuste_fim_mes ?? true);
        } else if (r.periodicidade === "Semanal") {
          next = incWeekly(next);
        } else if (r.periodicidade === "Anual") {
          next = incYearly(next, r.dia_mes || 1, r.mes || 1, r.ajuste_fim_mes ?? true);
        } else {
          break;
        }

      if (changed) {
        await supabaseClient.from("recurrences").update({ proxima_data: next }).eq("id", r.id);
      }

    // Recarrega transações após gerar
    const { data: tx } = await supabaseClient.from("transactions").select("*");
    S.tx = tx || [];
  }

  // ========= UI BÁSICA =========
  function setTab(name) {
    qsa(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name);
    qsa("section").forEach(s => s.classList.toggle("active", s.id === name);
  }

  function clearModalFields(){
  try{ if (window.resetValorInput) window.resetValorInput(); }catch(e){}
  const v=document.getElementById('mValorBig'); if(v) v.value='';
  const d=document.getElementById('mDesc'); if(d) d.value='';
  const o=document.getElementById('mObs'); if(o) o.value='';
  const c=document.getElementById('mCategoria'); if(c) c.selectedIndex=0;
}
function toggleModal(show, titleOverride) {
    const m = qs("#modalLanc");
    if (!m) return;
    m.style.display = show ? "flex" : "none";
    document.body.classList.toggle("modal-open", !!show);
    if (show) {
      
    
    try{ window.resetValorInput && window.resetValorInput(); }catch(_){ }
if (window.resetValorInput) window.resetValorInput();
const vData = qs("#mData"); if (vData) vData.value = nowYMD();
      rebuildCatSelect();
      const vDesc = qs("#mDesc"); if (vDesc) vDesc.value = "";
      const vObs  = qs("#mObs");  if (vObs)  vObs.value  = "";
      const vVal  = qs("#mValorBig"); if (vVal) vVal.value = "";
      modalTipo = "Despesa";
      syncTipoTabs();
      const ttl = qs("#modalTitle"); if (ttl) ttl.textContent = titleOverride || "Nova Despesa";

      // Reset de recorrência
      const chk = qs("#mRepetir");
      const box = qs("#recurrenceFields");
      if (chk && box) {
        chk.checked = false;
        box.style.display = "none";
      }
      const inpIni = qs("#mInicio");
      const inpFim = qs("#mFim");
      const inpDM  = qs("#mDiaMes");
      const selDW  = qs("#mDiaSemana");
      const selM   = qs("#mMes");
      const selPer = qs("#mPeriodicidade");
      const chkAdj = qs("#mAjusteFimMes");
      if (inpIni) inpIni.value = nowYMD();
      if (inpFim) inpFim.value = "";
      if (inpDM)  inpDM.value  = new Date().getDate();
      if (selDW)  selDW.value  = String(new Date().getDay() || 1);
      if (selM)   selM.value   = String(new Date().getMonth() + 1);
      if (selPer) selPer.value = "Mensal";
      if (chkAdj) chkAdj.checked = true;

      setTimeout(() => qs("#mValorBig")?.focus(), 0);
    } else {
      S.editingId = null;
    }

  let modalTipo = "Despesa";
  function syncTipoTabs() {
    const fCarteira = qs("#wrapCarteira");
    const fTransf = qs("#wrapTransf");
    if (modalTipo === "Transferência") {
      if (fCarteira) fCarteira.style.display = "none";
      if (fTransf) fTransf.style.display = "";
    } else {
      if (fCarteira) fCarteira.style.display = "";
      if (fTransf) fTransf.style.display = "none";
    }
    qsa("#tipoTabs button").forEach(b => b.classList.toggle("active", b.dataset.type === modalTipo);
    if (!S.editingId) {
      const ttl = qs("#modalTitle"); if (ttl) ttl.textContent = "Nova " + modalTipo;
    }

  function rebuildCatSelect(selected) {
    const sel = qs("#mCategoria");
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>';
    (S.cats || []).forEach(c => {
      const o = document.createElement("option");
      o.value = c.nome;
      o.textContent = c.nome;
      if (c.nome === selected) o.selected = true;
      sel.append(o);
    });
  }

  // ========= TRANSAÇÕES =========
  async function addOrUpdate(keepOpen=false) {
    const valor = parseMoneyMasked(qs("#mValorBig")?.value);
    const t = {
      id: S.editingId || gid(),
      tipo: modalTipo,
      categoria: qs("#mCategoria")?.value || "",
      data: isIsoDate(qs("#mData")?.value) ? qs("#mData").value : nowYMD(),
      descricao: (qs("#mDesc")?.value || "").trim(),
      valor: isFinite(valor) ? valor : 0,
      obs: (qs("#mObs")?.value || "").trim()
    };
    if (!t.categoria) return alert("Selecione categoria");
    if (!t.descricao) return alert("Descrição obrigatória");
    if (!(t.valor > 0)) return alert("Informe o valor");

    
    // ===== Carteira / Transferência (aplicado SEMPRE, antes de salvar) =====
    if (modalTipo === "Transferência") {
      t.carteira = null;
      t.carteira_origem  = (qs("#mOrigem")?.value || "Casa");
      t.carteira_destino = (qs("#mDestino")?.value || "Pessoa 1");
    } else {
      t.carteira = (qs("#mCarteira")?.value || "Casa");
      t.carteira_origem = null;
      t.carteira_destino = null;
    }
const chkRepetir = qs("#mRepetir");
    if (S.editingId || !chkRepetir?.checked) {
      await saveTx(t);
      await loadAll();
    if (window.resetValorInput) window.resetValorInput();
    toggleModal(false); return;
    return;
    }

    // Criar recorrência
    const perEl = qs("#mPeriodicidade");
    const per = perEl ? perEl.value : "Mensal";
    const diaMes = Number(qs("#mDiaMes")?.value) || new Date().getDate();
    const dow    = Number(qs("#mDiaSemana")?.value || 1);
    const mes    = Number(qs("#mMes")?.value || (new Date().getMonth() + 1);
    const inicio = isIsoDate(qs("#mInicio")?.value) ? qs("#mInicio").value : nowYMD();
    const fim    = isIsoDate(qs("#mFim")?.value) ? qs("#mFim").value : null;
    const ajuste = !!qs("#mAjusteFimMes")?.checked;

    // define próxima data inicial baseada no "início"
    let proxima = inicio;
    if (per === "Mensal") {
      const ld = lastDayOfMonth(Number(inicio.slice(0, 8)), Number(inicio.slice(5,7));
      const day = (ajuste ? Math.min(diaMes, ld) : diaMes);
      const candidate = toYMD(new Date(Number(inicio.slice(0, 8)), Number(inicio.slice(5,7)) - 1, day);
      proxima = (candidate < inicio) ? incMonthly(candidate, diaMes, ajuste) : candidate;
    } else if (per === "Semanal") {
      proxima = incWeekly(inicio);
    } else if (per === "Anual") {
      const ld = lastDayOfMonth(Number(inicio.slice(0, 8)), mes);
      const day = (ajuste ? Math.min(diaMes, ld) : diaMes);
      const candidate = toYMD(new Date(Number(inicio.slice(0, 8)), mes - 1, day);
      proxima = (candidate < inicio) ? incYearly(candidate, diaMes, mes, ajuste) : candidate;
    }

    const rec = {
      id: undefined,
      tipo: t.tipo,
      categoria: t.categoria,
      descricao: t.descricao,
      valor: t.valor,
      obs: t.obs,
      periodicidade: per,
      proxima_data: proxima,
      fim_em: fim,
      ativo: true,
      ajuste_fim_mes: ajuste,
      dia_mes: diaMes,
      dia_semana: dow,
      mes: mes
    };

    const { data: saved, error } = await saveRec(rec);
    if (error) {
      console.error(error);
      return alert("Erro ao salvar recorrência.");
    }

    // Se o lançamento original é para a mesma data da próxima ocorrência, já materializa a primeira
    if (t.data === saved.proxima_data) {
      await materializeOne(saved, saved.proxima_data);
      if (per === "Mensal") saved.proxima_data = incMonthly(saved.proxima_data, diaMes, ajuste);
      else if (per === "Semanal") saved.proxima_data = incWeekly(saved.proxima_data);
      else if (per === "Anual") saved.proxima_data = incYearly(saved.proxima_data, diaMes, mes, ajuste);
      await supabaseClient.from("recurrences").update({ proxima_data: saved.proxima_data }).eq("id", saved.id);
    }

    await loadAll();
    toggleModal(false); return;
  }
try { window.addOrUpdate = addOrUpdate; } catch(e){}


  
  // ========= EXCLUIR LANÇAMENTO =========
  async function delTx(id) {
    try {
      if (!id) return;
      const ok = typeof confirm === 'function' ? confirm("Excluir lançamento?") : true;
      if (!ok) return;
      await deleteTx(id);
      await loadAll();
    } catch (err) {
      console.error("Falha ao excluir lançamento:", err);
      alert("Não foi possível excluir o lançamento.");
    }
  try { window.delTx = delTx; } catch (e) {}


  
  // ========= TRANSAÇÕES =========
  function itemTx(x, readOnly = false) {
    const li = document.createElement("li");
    li.className = "item";
    const v = isFinite(Number(x.valor)) ? Number(x.valor) : 0;
    const actions = readOnly
      ? ""
      : `
        <button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>`;
    li.innerHTML = `
      <div class="left">
        <div class="tag">${x.tipo}</div>
        <div>
          <div><strong>${x.descricao || "-"}</strong></div>
          <div class="muted" style="font-size:12px">${x.categoria || "-"} • ${x.data || "-"}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="${S.hide ? "blurred" : ""}" style="font-weight:700">${fmtMoney(v)}</div>${actions}
      </div>`;
    if (!readOnly) {
      const btnEdit = li.querySelector(".edit");
      const btnDel  = li.querySelector(".del");
      if (btnEdit) btnEdit.onclick = () => window.openEdit && window.openEdit(x.id);
      if (btnDel)  btnDel.onclick = () => window.delTx && window.delTx(x.id);
    }
    return li;
  }

  function renderRecentes() {
    const ul = qs("#listaRecentes");
    if (!ul) return;
    const list = (S.tx || [])
      .filter(x => x.tipo === "Despesa")
      .sort((a, b) => String(b.data||"").localeCompare(String(a.data||"")))
      .slice(0, 8);
    ul.innerHTML = "";
    if (!ul.classList.contains("lanc-grid")) ul.classList.add("lanc-grid");
    list.forEach(x => ul.append(itemTx(x, true));
  }

  function renderLancamentos() {

    // Atualiza o título com o mês selecionado (ex.: "Lançamentos — Setembro/2025")
    (function(){
      if (!S || !S.month) return;
      const h3 = document.querySelector('.lanc-header h3');
      if (!h3) return;
      const [y, m] = S.month.split('-').map(Number);
      if (!y || !m) return;
      const abrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const mes = (m && m>=1 && m<=12) ? abrev[m-1] : '';
const ano = String(y).slice(2);
const label = `${mes}/${ano}`;
h3.textContent = 'Lançamentos — ' + label;
    })();
    const _qs = s => document.querySelector(s);
    const Sref = S;

    const selTipo    = _qs('#lancTipo');
    const selCat     = _qs('#lancCat');
    const inpBusca   = _qs('#lancSearch');
    const selSort    = _qs('#lancSort');
    const chkCompact = _qs('#lancCompact');
    const ul         = _qs('#listaLanc');
    const sumEl      = _qs('#lancSummary');

    if (chkCompact) {
      const compactPref = localStorage.getItem('lancCompact') === '1';
      if (chkCompact.checked !== compactPref) chkCompact.checked = compactPref;
      document.body.classList.toggle('compact', chkCompact.checked);
    }

    const tipo  = (selTipo && selTipo.value) || 'todos';
    const cat   = (selCat && selCat.value) || 'todas';
    const q     = ((inpBusca && inpBusca.value) || '').trim().toLowerCase();
    const sort  = (selSort && selSort.value) || 'data_desc';

    let list = Array.isArray(Sref.tx) ? Sref.tx.slice() : [];

    // === Filtro por mês selecionado no topbar ===
    // Exibe apenas lançamentos cujo campo data (YYYY-MM-DD) começa com Sref.month (YYYY-MM).
    if (Sref && Sref.month && Sref.month !== 'all') {
      list = list.filter(x => x && x.data && String(x.data).startsWith(Sref.month);
    }


    list = list.filter(x => {
      if (tipo !== 'todos' && x.tipo !== tipo) return false;
      if (cat  !== 'todas' && x.categoria !== cat) return false;
      if (q) {
        const hay = `${x.descricao||''} ${x.categoria||''} ${x.obs||''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const by = {
      data_desc: (a,b)=> String(b.data||'').localeCompare(String(a.data||'')),
      data_asc:  (a,b)=> String(a.data||'').localeCompare(String(b.data||'')),
      valor_desc:(a,b)=> (Number(b.valor)||0) - (Number(a.valor)||0),
      valor_asc: (a,b)=> (Number(a.valor)||0) - (Number(b.valor)||0),
    };
    list.sort(by[sort] || by.data_desc);

    const fmt = v=> (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const totDesp = list.filter(x=>x.tipo==='Despesa').reduce((a,b)=>a+(Number(b.valor)||0),0);
    const totRec  = list.filter(x=>x.tipo==='Receita').reduce((a,b)=>a+(Number(b.valor)||0),0);
    const saldo   = totRec - totDesp;

    if (sumEl){
      // Reescrito para compatibilidade ES5 (sem template string)
      sumEl.innerHTML = '';
      function makePill(txt, cls){
        var s = document.createElement('span');
        s.className = 'pill' + (cls ? (' ' + cls) : '');
        s.textContent = txt;
        return s;
      }
      var frag = document.createDocumentFragment();
      frag.appendChild(makePill('Itens: ' + list.length);
      frag.appendChild(makePill('Receitas: ' + fmt(totRec), 'ok');
      frag.appendChild(makePill('Despesas: ' + fmt(totDesp), 'warn');
      frag.appendChild(makePill('Saldo: ' + fmt(saldo));
      sumEl.appendChild(frag);
    }

    if (!ul) return;
    ul.innerHTML = '';

    if (!list.length){
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = '<div class="empty"><div class="title">Nenhum lançamento encontrado</div><div class="hint">Ajuste os filtros ou crie um novo lançamento.</div></div>';
      ul.append(li);
      return;
    }

    list.forEach(x => {
      const li = document.createElement('li');
      li.className = 'item';
      li.dataset.tipo = x.tipo;
      const v = Number(x.valor)||0;
      const valor = fmt(v);
      li.innerHTML = `
        <div class="header-line">
          <div class="chip">${x.tipo||'-'}</div>
          <div class="actions">
            <button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>
            <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>
          </div>
        </div>
        <div class="titulo"><strong>${x.descricao||'-'}</strong></div>
        <div class="subinfo muted">${x.categoria||'-'} • ${x.data||'-'}</div>
        <div class="valor">${valor}</div>
      `;
      const btnEdit = li.querySelector('.edit');
      const btnDel  = li.querySelector('.del');
      if (btnEdit) btnEdit.onclick = ()=> window.openEdit && window.openEdit(x.id);
      if (btnDel)  btnDel.onclick  = ()=> window.delTx && window.delTx(x.id);
      ul.append(li);
    });

    if (!renderLancamentos._wired){
      if (selTipo) selTipo.onchange = renderLancamentos;
      if (selCat) selCat.onchange = renderLancamentos;
      if (inpBusca) inpBusca.oninput = renderLancamentos;
      if (selSort) selSort.onchange = renderLancamentos;
      if (chkCompact){
        chkCompact.onchange = ()=>{
          localStorage.setItem('lancCompact', chkCompact.checked ? '1':'0');
          document.body.classList.toggle('compact', chkCompact.checked);
        };
      }
      renderLancamentos._wired = true;
    }

  function openEdit(id) {
    const x = (S.tx || []).find(t => t.id === id);
    if (!x) return;
    S.editingId = id;
    modalTipo = x.tipo;
    syncTipoTabs();
    rebuildCatSelect(x.categoria);
    const mData = qs("#mData"); if (mData) mData.value = isIsoDate(x.data) ? x.data : nowYMD();
    const mDesc = qs("#mDesc"); if (mDesc) mDesc.value = x.descricao || "";
    const mVal  = qs("#mValorBig"); if (mVal) mVal.value = fmtMoney(Number(x.valor) || 0);
    const mObs  = qs("#mObs"); if (mObs) mObs.value = x.obs || "";
    const ttl   = qs("#modalTitle"); if (ttl) ttl.textContent = "Editar lançamento";
    const fCarteira = qs("#wrapCarteira"); const fTransf = qs("#wrapTransf");
    if (x.tipo === "Transferência") {
      if (fCarteira) fCarteira.style.display = "none";
      if (fTransf) fTransf.style.display = "";
      const o = qs("#mOrigem"); if (o) o.value = x.carteira_origem || "Casa";
      const d = qs("#mDestino"); if (d) d.value = x.carteira_destino || "Pessoa 1";
    } else {
      if (fCarteira) fCarteira.style.display = "";
      if (fTransf) fTransf.style.display = "none";
      const c = qs("#mCarteira"); if (c) c.value = x.carteira || "Casa";
    }

    // Edição: esconde blocos de recorrência (edita só esta instância)
    const chk = qs("#mRepetir");
    const box = qs("#recurrenceFields");
    if (chk && box) { chk.checked = false; box.style.display = "none"; }

    const modal = qs("#modalLanc"); if (modal) modal.style.display = "flex";
    setTimeout(() => qs("#mValorBig")?.focus(), 0);
  }
  try { window.openEdit = openEdit; } catch(e) {}
// ========= CATEGORIAS =========
  function renderCategorias() {
    const ul = qs("#listaCats");
    if (!ul) return;
    ul.classList.add("cats-grid");
    ul.innerHTML = "";

    const list = Array.isArray(S.cats) ? S.cats.slice().sort((a,b)=> (a.nome||"").localeCompare(b.nome||"")) : [];
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "item";
      const left = document.createElement("div");
      left.className = "left";
      const strong = document.createElement("strong");
      strong.textContent = "Nenhuma categoria";
      const muted = document.createElement("div");
      muted.className = "muted";
      muted.style.fontSize = "12px";
      muted.textContent = "Use o campo acima para criar.";
      left.appendChild(strong);
      left.appendChild(muted);
      li.appendChild(left);
      ul.appendChild(li);
      return;
    }

    list.forEach(c => {
      const li = document.createElement("li");
      li.className = "item";

      const left = document.createElement("div");
      left.className = "left";
      const titleWrap = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = c.nome;
      titleWrap.appendChild(strong);
      const subtitle = document.createElement("div");
      subtitle.className = "muted";
      subtitle.style.fontSize = "12px";
      subtitle.textContent = "Categoria";
      left.appendChild(titleWrap);
      left.appendChild(subtitle);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "6px";
      right.style.alignItems = "center";

      const btnEdit = document.createElement("button");
      btnEdit.className = "icon edit";
      btnEdit.title = "Renomear";
      const iEdit = document.createElement("i");
      iEdit.className = "ph ph-pencil-simple";
      btnEdit.appendChild(iEdit);

      const btnDel = document.createElement("button");
      btnDel.className = "icon del";
      btnDel.title = "Excluir";
      const iDel = document.createElement("i");
      iDel.className = "ph ph-trash";
      btnDel.appendChild(iDel);

      btnEdit.onclick = async () => {
        const novo = (prompt("Novo nome da categoria:", c.nome) || "").trim();
        if (!novo || novo === c.nome) return;
        await saveCat({ nome: novo });
        await updateTxCategory(c.nome, novo);
        await deleteCat(c.nome);
        await loadAll();
      };

      btnDel.onclick = async () => {
        if (confirm("Excluir categoria? Transações existentes manterão o nome antigo.")) {
          await deleteCat(c.nome);
          await loadAll();
        };

      right.appendChild(btnEdit);
      right.appendChild(btnDel);

      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });
  }

  // ========= RELATÓRIOS / KPIs / GRÁFICOS EXISTENTES =========
  function updateKpis() {
    // Transações do mês selecionado
    let txMonth = (S.tx || []).filter(x => x.data && inSelectedMonth(x);
    if (!txMonth.length) {
      const ym = (S && S.month) || '';
      txMonth = (S.tx || []).filter(x => x.data && String(x.data).slice(0,7) === ym);
    }
    // Receitas = P1 + P2 ; Despesas = Casa + P1 + P2 ; Saldo = entradas - saídas
    const receitas = txMonth
      .filter(x => x.tipo === "Receita" && (x.carteira === "Pessoa 1" || x.carteira === "Pessoa 2"))
      .reduce((a,b)=>a+Number(b.valor||0),0);
    const despesas = txMonth
      .filter(x => x.tipo === "Despesa" && (x.carteira === "Casa" || x.carteira === "Pessoa 1" || x.carteira === "Pessoa 2"))
      .reduce((a,b)=>a+Number(b.valor||0),0);
    const saldo = receitas - despesas;

    // Elementos de KPI
    
    // ==== mês anterior para comparação ====
    function _ymPrev(ym){
      if (!ym || ym.length < 7) { const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); }
      try {
        const parts = ym.split('-'); const y = parseInt(parts[0],10); const m = parseInt(parts[1],10);
        const d = new Date(y, m-2, 1); return d.toISOString().slice(0,7);
      } catch(_) { const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); }
    const _ymSel = (S && S.month) ? S.month : (new Date()).toISOString().slice(0,7);
    const _ymPrevSel = _ymPrev(_ymSel);
    const prevTx = (S.tx||[]).filter(x => x.data && String(x.data).slice(0,7) === _ymPrevSel);
    const kpiReceitas = qs("#kpiReceitas");
    const kpiDespesas = qs("#kpiDespesas");
    const kpiSaldo = qs("#kpiSaldo");
    const kpiSplit = qs("#kpiSplit");
    const kpiSplitHint = qs("#kpiSplitHint");

    // Atualiza números
    if (kpiReceitas) kpiReceitas.textContent = fmtMoney(receitas);
    if (kpiDespesas) kpiDespesas.textContent = fmtMoney(despesas);
    if (kpiSaldo) kpiSaldo.textContent = fmtMoney(saldo);
    if (kpiSplit) kpiSplit.textContent = fmtMoney(despesas / 2);
    if (kpiSplitHint) kpiSplitHint.textContent = "½ de despesas";

    // --- Variação vs mês anterior (em %) ---
    const ymPrev = prevYM(S.month);
    const txPrev = (S.tx || []).filter(x => x.data && String(x.data).startsWith(ymPrev);
    const receitasPrev = prevTx
        .filter(x => x.tipo === "Receita" && (x.carteira === "Pessoa 1" || x.carteira === "Pessoa 2"))
        .reduce((a,b)=>a+Number(b.valor||0),0);
      const despesasPrev = prevTx
        .filter(x => x.tipo === "Despesa" && (x.carteira === "Casa" || x.carteira === "Pessoa 1" || x.carteira === "Pessoa 2"))
        .reduce((a,b)=>a+Number(b.valor||0),0);
    const saldoPrev = receitasPrev - despesasPrev;

    function formatDeltaPct(cur, prev) {
      if (prev > 0) {
        const pct = ((cur - prev) / prev) * 100;
        return pct.toFixed(1).replace(".", ",") + "%";
      }
      return "—";
    }
    function setChip(id, val) {
      const el = qs(id);
      if (el) {
        el.textContent = val;
        el.classList.toggle("blurred", S.hide);
      }
    setChip("#kpiReceitasDelta", formatDeltaPct(receitas, receitasPrev);
    setChip("#kpiDespesasDelta", formatDeltaPct(despesas, despesasPrev);
    setChip("#kpiSaldoDelta", formatDeltaPct(saldo, saldoPrev);

    // Aplica "blurred" só nos valores principais
    [kpiReceitas, kpiDespesas, kpiSaldo, kpiSplit].forEach(el => {
      if (el) el.classList.toggle("blurred", S.hide);
    });

    // Percentual de Despesas sobre Receitas
    const kpiDespesasPct = qs("#kpiDespesasPct");
    let pctDespesas = "—";
    if (receitas > 0) {
      const d = (despesas / receitas) * 100;
      pctDespesas = d.toFixed(1).replace(".", ",") + "%";
    }
    if (kpiDespesasPct) {
      kpiDespesasPct.textContent = pctDespesas;
      kpiDespesasPct.classList.toggle("blurred", S.hide);
    }

  let chartSaldo, chartPie, chartFluxo;
  function renderCharts() {
    // Saldo acumulado (12 meses)
    if (chartSaldo) chartSaldo.destroy();
    const ctxSaldo = qs("#chartSaldo");
    if (ctxSaldo && window.Chart) {
      const months = [];
      const saldoData = [];
      const d = new Date();
      for (let i = 11; i >= 0; i--) {
        const cur = new Date(d.getFullYear(), d.getMonth() - i, 1);
        const ym = cur.toISOString().slice(0, 7);
        const txs = (S.tx || []).filter(x => x.data && String(x.data).startsWith(ym);
        const receitas = txs.filter(x => x.tipo === "Receita").reduce((a, b) => a + Number(b.valor), 0);
        const despesas = txs.filter(x => x.tipo === "Despesa").reduce((a, b) => a + Number(b.valor), 0);
        months.push(cur.toLocaleDateString("pt-BR", { month: "short" });
        saldoData.push(receitas - despesas);
      }
      chartSaldo = new Chart(ctxSaldo, {
        type: "line",
        data: { labels: months, datasets: [{ label: "Saldo", data: saldoData }] });
    }

    // Pizza por categoria (mês atual)
    if (chartPie) chartPie.destroy();
    const ctxPie = qs("#chartPie");
    if (ctxPie && window.Chart) {
      let txMonth = (S.tx || []).filter(x => x.data && inSelectedMonth(x);
    if (!txMonth.length) {
      const ym = (S && S.month) || '';
      txMonth = (S.tx || []).filter(x => x.data && String(x.data).slice(0,7) === ym);
    }
      const porCat = {};
      txMonth.filter(x => x.tipo === "Despesa" && x.carteira === "Casa").forEach(x => {
        porCat[x.categoria] = (porCat[x.categoria] || 0) + Number(x.valor);
      });
      chartPie = new Chart(ctxPie, {
        type: "pie",
        data: { labels: Object.keys(porCat), datasets: [{ data: Object.values(porCat) }] });
    }

    // Fluxo por mês
    if (chartFluxo) chartFluxo.destroy();
    const ctxFluxo = qs("#chartFluxo");
    if (ctxFluxo && window.Chart) {
      const porMes = {};
      (S.tx || []).forEach(x => {
        if (!x.data) return;
        const ym = String(x.data).slice(0, 7);
        porMes[ym] = (porMes[ym] || 0) + Number(x.valor) * (x.tipo === "Despesa" ? -1 : 1);
      });
      const labels = Object.keys(porMes).sort();
      chartFluxo = new Chart(ctxFluxo, {
        type: "bar",
        data: { labels, datasets: [{ label: "Fluxo", data: labels.map(l => porMes[l]) }] });
    }

  // ========= SELECTOR DE MESES =========
  function buildMonthSelect() {
    const sel = qs("#monthSelect");
    if (!sel) return;
    sel.innerHTML = "";
    const mesesDisponiveis = Array.from(new Set((S.tx || []).filter(x => x.data).map(x => String(x.data).slice(0, 7)))).sort((a,b)=> b.localeCompare(a);

    // Garante mês atual no seletor
    (function(){
      const dNow = new Date();
      const cur = new Date(dNow.getTime() - dNow.getTimezoneOffset() * 60000).toISOString().slice(0,7);
      if (!mesesDisponiveis.includes(cur)) mesesDisponiveis.unshift(cur);
      // Remove duplicatas mantendo ordem
      const seen = new Set();
      for (let i = 0; i < mesesDisponiveis.length; i++) {
        if (seen.has(mesesDisponiveis[i])) { mesesDisponiveis.splice(i,1); i--; } else { seen.add(mesesDisponiveis[i]); }
    })();

    mesesDisponiveis.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      const [ano, mes] = m.split("-");
      opt.textContent = abbrevLabelFromYM(m);
      if (m === S.month) opt.selected = true;
      sel.append(opt);
    });
    sel.onchange = () => {
      S.month = sel.value;
      savePrefs();
      render();
    };
  }

  // ========= NOVOS INSIGHTS / ANÁLISES =========
  // Helpers de série temporal
  function monthsBack(n) {
    const out = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(dt.toISOString().slice(0,7);
    }
    return out;
  }
  function monthDays(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function netByMonth(ym) {
    const txs = (S.tx || []).filter(x => x.data && String(x.data).startsWith(ym);
    const rec = txs.filter(x=>x.tipo==="Receita").reduce((a,b)=>a+Number(b.valor),0);
    const des = txs.filter(x=>x.tipo==="Despesa").reduce((a,b)=>a+Number(b.valor),0);
    return rec - des;
  }

  // Top 5 categorias (12 meses) — preenche #tblTop
  function renderTopCategorias12m(limit=5){
    const cutoff = new Date();
    const from = new Date(cutoff.getFullYear(), cutoff.getMonth()-11, 1);
    const sum = {};
    (S.tx || []).forEach(x=>{
      if (!x.data || x.tipo!=="Despesa") return;
      const dt = new Date(x.data);
      if (dt >= from && dt <= cutoff) {
        sum[x.categoria] = (sum[x.categoria]||0) + (Number(x.valor)||0);
      });
    const rows = Object.entries(sum).sort((a,b)=>b[1]-a[1]).slice(0,limit);

    const tbody = document.querySelector('#tblTop tbody');
    if (tbody){
      tbody.innerHTML = '';
      rows.forEach(([cat, total])=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cat||'-'}</td><td>${fmtMoney(total)}</td>`;
        tbody.appendChild(tr);
      });
    }

  // Média de gastos por categoria (6 meses) — preenche #tblMediaCats
  function renderMediaPorCategoria(windowMonths=6){
    const months = monthsBack(windowMonths);
    const byCatMonth = {};
    months.forEach(m=>{
      (S.tx || []).filter(x=>x.data && String(x.data).startsWith(m) && x.tipo==="Despesa")
        .forEach(x=>{
          const k = x.categoria || '(sem categoria)';
          byCatMonth[k] = byCatMonth[k] || {};
          byCatMonth[k][m] = (byCatMonth[k][m]||0) + (Number(x.valor)||0);
        });
    });
    const medias = Object.entries(byCatMonth).map(([cat, map])=>{
      const tot = months.reduce((a,m)=>a+(map[m]||0),0);
      return [cat, tot/windowMonths];
    }).sort((a,b)=>b[1]-a[1]);

    const tbody = document.querySelector('#tblMediaCats tbody');
    if (tbody){
      tbody.innerHTML = '';
      medias.forEach(([cat, avg])=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cat}</td><td>${fmtMoney(avg)}</td>`;
        tbody.appendChild(tr);
      });
    }

  // Tendência do saldo (projeção até o fim do mês) — mostra em #kpiForecastFinal
  function renderTendenciaSaldo(){
    const ym = S.month;
    const [y,m] = ym.split('-').map(Number);
    const today = new Date();
    const isCurrentMonth = (today.getFullYear()===y && (today.getMonth()+1)===m);

    const txs = (S.tx || []).filter(x=>x.data && String(x.data).startsWith(ym);
    const receitas = txs.filter(x=>x.tipo==="Receita").reduce((a,b)=>a+Number(b.valor),0);
    const despesas = txs.filter(x=>x.tipo==="Despesa").reduce((a,b)=>a+Number(b.valor),0);
    const saldoAtual = receitas - despesas;

    let proj = saldoAtual;
    if (isCurrentMonth){
      const dia = today.getDate();
      const diasMes = monthDays(ym);
      const mediaDiaria = saldoAtual / Math.max(1, dia);
      proj = mediaDiaria * diasMes;
    }
    const el = document.getElementById('kpiForecastFinal');
    if (el){
      el.textContent = fmtMoney(proj);
      el.style.color = proj >= 0 ? "var(--ok)" : "var(--warn)";
    }

  // Previsão simples com média móvel de 3 meses (gráfico)
  let chartForecast;
  function renderForecastChart(){
    if (chartForecast) chartForecast.destroy();
    const ctx = document.getElementById('chartForecast');
    if (!ctx || !window.Chart) return;

    const months = monthsBack(12);
    const serie = months.map(netByMonth);
    const ma = serie.map((_,i)=>{
      const a = Math.max(0,i-2);
      const slice = serie.slice(a,i+1);
      return slice.reduce((x,y)=>x+y,0)/slice.length;
    });

    chartForecast = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months.map(m=>{
          const [Y,M]=m.split('-');
          return new Date(Y, M-1, 1).toLocaleDateString('pt-BR',{month:'short'});
        }),
        datasets: [
          { label:'Saldo mensal', data: serie },
          { label:'Média móvel (3m)', data: ma }
        ]
      });
  }

  // Heatmap de gastos por dia do mês
  function renderHeatmap(){
    const wrap = document.getElementById('heatmap');
    if (!wrap) return;
    const ym = S.month;
    const days = monthDays(ym);
    const gastosPorDia = Array.from({length: days}, ()=>0);

    (S.tx || []).forEach(x=>{
      if (!x.data || x.tipo!=="Despesa") return;
      if (!String(x.data).startsWith(ym)) return;
      const d = Number(String(x.data).slice(8,10);
      gastosPorDia[d-1] += Number(x.valor)||0;
    });

    const max = Math.max(...gastosPorDia, 0);
    wrap.innerHTML = '';

    // Cabeçalho com iniciais (S T Q Q S S D)
    ['S','T','Q','Q','S','S','D'].forEach(lbl=>{
      const h = document.createElement('div');
      h.className = 'cell';
      h.textContent = lbl;
      h.style.fontWeight = '700';
      wrap.appendChild(h);
    });

    // Células
    for (let d=1; d<=days; d++){
      const v = gastosPorDia[d-1];
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = d;
      if (v>0){
        const intensity = max ? v/max : 0;
        const bg = `hsl(0, 85%, ${90 - 50*intensity}%)`; // tons de vermelho
        cell.style.background = bg;
        cell.setAttribute('data-val', String(v);
        cell.title = `Despesas em ${String(d).padStart(2,'0')}/${ym.slice(5,7)}: ${fmtMoney(v)}`;
      }
      wrap.appendChild(cell);
    }

    // Legenda
    const legend = document.createElement('div');
    legend.className = 'legend';
    const sw1 = document.createElement('span'); sw1.className='swatch'; sw1.style.background='hsl(0,85%,90%)';
    const sw2 = document.createElement('span'); sw2.className='swatch'; sw2.style.background='hsl(0,85%,65%)';
    const sw3 = document.createElement('span'); sw3.className='swatch'; sw3.style.background='hsl(0,85%,40%)';
    legend.append('Menor', sw1, sw2, sw3, 'Maior');
    wrap.appendChild(legend);
  }

  // ========= RENDER PRINCIPAL =========
  function buildLancCatFilter(){
    const sel = document.querySelector('#lancCat');
    if (!sel) return;
    const current = sel.value || 'todas';
    sel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'todas';
    optAll.textContent = 'Todas as categorias';
    sel.append(optAll);
    (S.cats||[]).slice().sort((a,b)=> (a.nome||'').localeCompare(b.nome||'')).forEach(c=>{
      const o = document.createElement('option');
      o.value = c.nome; o.textContent = c.nome;
      sel.append(o);
    });
    sel.value = current;
  }

  
  // ===== Carteiras helpers =====
  function computeSaldosPorCarteira(){
    const map = Object.fromEntries((S.walletList||["Casa"]).map(w=>[w,0]);
    txSelected().forEach(x=>{
      const v = money(x.valor);
      if (x.tipo === "Receita" && x.carteira) map[x.carteira]+=v;
      if (x.tipo === "Despesa" && x.carteira) map[x.carteira]-=v;
      if (x.tipo === "Transferência"){
        if (x.carteira_origem)  map[x.carteira_origem]-=v;
        if (x.carteira_destino) map[x.carteira_destino]+=v;
      });
    return map;
  }
  
  // ===== Carteiras — cálculos auxiliares =====
  // Usa o mês selecionado (ou ciclo de fatura se ativado)
  function txSelected(){
    const all = Array.isArray(S.tx) ? S.tx : [];
    return all.filter(x => x && x.data && inSelectedMonth(x);
  }

  function sumInOutByWallet(wallet){
    const tx = txSelected().filter(x => (x.carteira === wallet && (x.tipo==="Receita" || x.tipo==="Despesa"));
    const entradas = tx.filter(x => x.tipo==="Receita").reduce((a,b)=>a+money(b.valor),0);
    const saidas   = tx.filter(x => x.tipo==="Despesa").reduce((a,b)=>a+money(b.valor),0);
    // Transferências não entram em entradas/saídas (apenas mudam saldo entre carteiras)
    return { entradas, saidas, items: tx.slice().sort((a,b)=> (b.data||'').localeCompare(a.data||'')).slice(0,10) };
  }
  function sumFamily(){
    const p1 = sumInOutByWallet("Pessoa 1");
    const p2 = sumInOutByWallet("Pessoa 2");
    // Entradas totais = receitas P1+P2 (não contamos transferências entre carteiras)
    const entradas = (p1.entradas||0) + (p2.entradas||0);
    // Saídas totais = despesas Casa (da aba Carteiras) + Pessoais (P1+P2)
    const casa = sumInOutByWallet("Casa");
    const casaOut = (casa && typeof casa.saidas==='number') ? casa.saidas : 0;
    const saidas = casaOut + (p1.saidas||0) + (p2.saidas||0);
    const diff = entradas - saidas;
    return { entradas, saidas, diff };
  }
  function renderMiniList(elId, items){
  const ul = document.getElementById(elId);
  if (!ul) return;
  ul.innerHTML = "";
  if (!items || !items.length){
    const li = document.createElement('li');
    li.innerHTML = '<div class="left"><strong>Nenhum lançamento</strong><div class="muted">Cadastre no +</div></div>';
    ul.appendChild(li);
    return;
  }
  items.forEach(x=>{
    const li = document.createElement('li');
    li.dataset.tipo = x && x.tipo ? x.tipo : "";
    const sinal = (x && x.tipo === "Despesa") ? "-" : "+";
    const icon  = x && x.tipo === "Despesa" ? "ph-trend-down" :
                  x && x.tipo === "Receita" ? "ph-trend-up" : "ph-arrows-left-right";
    const titulo = (x && (x.descricao || x.descr)) ? (x.descricao || x.descr) : "-";
    const dataTxt = (x && x.data) ? x.data : "";
    const catTxt  = (x && x.categoria) ? x.categoria : "-";
    const valorNum= (x && (typeof x.valor!=='undefined')) ? x.valor : 0;
    li.innerHTML =
      '<span class="chip"><i class="ph '+ icon +'"></i>'+ (x && x.tipo ? x.tipo : '-') +'</span>' +
      '<div class="left">' +
        '<strong>'+ titulo +'</strong>' +
        '<div class="sub">'+ dataTxt +' • '+ catTxt +'</div>' +
      '</div>' +
      '<div class="valor">'+ sinal +' '+ fmtMoney(money(valorNum)) +'</div>';
    ul.appendChild(li);
  });
}
const br = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
    const setAmount = () => { if (valorInput) valorInput.value = rawCents ? br.format(rawCents/100) : ''; };

    if (valorInput) {
      valorInput.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'deleteContentBackward') {
          rawCents = Math.floor(rawCents/10);
          setAmount();
          e.preventDefault();
        });
      valorInput.addEventListener('input', (e) => {
        const d = (e.data ?? '').replace(/\D/g,''); 
        if (d) {
          rawCents = Math.min(9999999999, rawCents*10 + Number(d));
          setAmount();
        } else if (!e.data && !valorInput.value) {
          rawCents = 0;
        }
        requestAnimationFrame(() => {
          const len = valorInput.value.length;
          valorInput.setSelectionRange(len,len);
        });
      });
      valorInput.addEventListener('focus', () => {
        if (!valorInput.value) setAmount();
        requestAnimationFrame(() => {
          const len = valorInput.value.length;
          valorInput.setSelectionRange(len,len);
        });
      });
    }

    function validateModal(){
      if (!formError) return true;
      formError.hidden = true; formError.textContent = '';
      const problems = [];
      if (rawCents <= 0 && parseMoneyMasked(valorInput?.value) <= 0) problems.push('Informe um valor maior que zero.');
      if (!document.getElementById('mCategoria')?.value) problems.push('Selecione uma categoria.');
      if (!document.getElementById('mData')?.value) problems.push('Informe a data.');
      if (problems.length){
        formError.textContent = problems.join(' ');
        formError.hidden = false;
        return false;
      }
      return true;
    }

    if (dialog){
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (validateModal()) btnSalvar?.click();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          btnCancelar?.click();
        });

      // Trap de foco + Tab
      dialog.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusables = Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); });
    })();

  // ========= METAS (Supabase) =========
  async function fetchMetas(){
    try{
      const { data, error } = await supabaseClient
        .from('goals')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) { console.error('Erro ao carregar metas:', error); }
      S.metas = data ? { total: Number(data.total)||0, porCat: (data.por_cat||{}) } : { total: 0, porCat: {};
    } catch(e){
      console.error(e);
      S.metas = { total: 0, porCat: {};
    }
  async function persistMetas(m){
    try{
      const payload = { id: 1, total: Number(m.total)||0, por_cat: m.porCat||{}, updated_at: new Date().toISOString() };
      const { error } = await supabaseClient.from('goals').upsert([payload]);
      if (error) { console.error('Erro ao salvar metas:', error); return false; }
      S.metas = { total: payload.total, porCat: payload.por_cat };
      return true;
    } catch(e){
      console.error(e);
      return false;
    }
  function parseBRL(str){
    if (!str) return 0;
    return Number(str.replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''))||0;
  }
  function fmtBRL(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function renderMetaCard(){
    const metas = S.metas || { total: 0, porCat: {};
    const totalMeta = Number(metas.total)||0;
    const kTotal = document.getElementById('metaTotalLabel');
    const kGasto = document.getElementById('metaGastoMes');
    const chip = document.getElementById('metaStatusChip');
    const bar = document.getElementById('metaProgBar');
    const obs = document.getElementById('metaObs');

    const gastosMes = Array.isArray(S.tx) ? S.tx.filter(x => x.data && x.tipo==='Despesa' && inSelectedMonth(x)).reduce((a,b)=> a + (Number(b.valor)||0), 0) : 0;

    if (kTotal) kTotal.textContent = totalMeta ? fmtBRL(totalMeta) : '—';
    if (kGasto) kGasto.textContent = fmtBRL(gastosMes);

    if (!bar || !chip) return;

    if (totalMeta > 0){
      const pct = Math.min(100, Math.round((gastosMes/totalMeta)*100);
      bar.style.width = pct + '%';
      chip.textContent = gastosMes <= totalMeta ? pct + '% (dentro da meta)' : Math.round((gastosMes/totalMeta)*100) + '% (estourou)';
      chip.classList.toggle('ok', gastosMes <= totalMeta);
      chip.classList.toggle('warn', gastosMes > totalMeta);
      if (obs) {
        const restante = Math.max(0, totalMeta - gastosMes);
        obs.textContent = gastosMes <= totalMeta ? `Faltam ${fmtBRL(restante)} para atingir a meta.` : `Ultrapassou a meta em ${fmtBRL(gastosMes - totalMeta)}.`;
      } else {
      bar.style.width = '0%';
      chip.textContent = '—';
      chip.classList.remove('ok','warn');
      if (obs) obs.textContent = 'Defina uma meta para acompanhar o progresso.';
    }

    const btnGo = document.getElementById('btnGoMetas');
    if (btnGo){
      btnGo.onclick = ()=>{
        const btnCfg = document.getElementById('btnConfig');
        if (btnCfg){ btnCfg.click(); }
        const metasCard = document.getElementById('tblMetasCat');
        if (metasCard){ metasCard.scrollIntoView({behavior:'smooth', block:'start'}); };
    }
  function renderMetasConfig(){
    const metas = S.metas || { total:0, porCat:{};
    const inpTotal = document.getElementById('metaTotalInput');
    if (inpTotal){ inpTotal.value = metas.total ? fmtBRL(metas.total) : ''; }

    const tb = document.querySelector('#tblMetasCat tbody');
    if (!tb) return;
    const cats = Array.isArray(S.cats) ? S.cats.map(c=>c.nome) : [];
    tb.innerHTML = cats.map(cn=>{
      const val = metas.porCat && metas.porCat[cn] ? fmtBRL(metas.porCat[cn]) : '';
      return `<tr><td>${cn}</td><td><input data-metacat="${cn}" placeholder="0,00" value="${val}"></td></tr>`;
    }).join('');

    const btnSalvar = document.getElementById('salvarMetas');
    if (btnSalvar){
      btnSalvar.onclick = async ()=>{
        const m = { total: parseBRL(inpTotal && inpTotal.value), porCat: {};
        tb.querySelectorAll('input[data-metacat]').forEach(inp=>{
          const cat = inp.getAttribute('data-metacat');
          const v = parseBRL(inp.value);
          if (v>0) m.porCat[cat] = v;
        });
        const ok = await persistMetas(m);
        renderMetaCard();
        alert(ok ? 'Metas salvas!' : 'Não foi possível salvar as metas.');
      };
    }

  // ========= RELATÓRIOS: estado, filtros e subtabs =========
  let R = { tab: 'fluxo', charts: {};

  function initReportsUI(){
    const navBtns = document.querySelectorAll('.reports-nav .rtab');
    const panels = document.querySelectorAll('.rpanel');
    navBtns.forEach(btn=>{
      btn.onclick = ()=>{
        R.tab = btn.dataset.rtab;
        navBtns.forEach(b=>b.classList.toggle('active', b===btn);
        panels.forEach(p=>p.classList.toggle('active', p.dataset.rtab===R.tab);
        renderReports();
      };
    });

    const selPeriodo = document.getElementById('rPeriodo');
    const selTipo = document.getElementById('rTipo');
    const selCat = document.getElementById('rCategoria');
    if (selPeriodo) selPeriodo.onchange = renderReports;
    if (selTipo) selTipo.onchange = renderReports;
    if (selCat) selCat.onchange = renderReports;

    // popular categorias
    if (selCat){
      selCat.innerHTML = '<option value="todas" selected>Todas</option>' +
        (Array.isArray(S.cats)? S.cats.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('') : '');
    }

    // ações de export e fullscreen
    document.querySelectorAll('[data-fs]').forEach(b=> b.onclick = ()=> openChartFullscreen(b.dataset.fs);
    document.querySelectorAll('[data-export]').forEach(b=> b.onclick = ()=> exportChartPNG(b.dataset.export);
    const fsClose = document.getElementById('fsClose');
    if (fsClose) fsClose.onclick = ()=> closeChartFullscreen();
  }

  function getReportFilters(){
    const period = (document.getElementById('rPeriodo')||{}).value || '6m';
    const tipo = (document.getElementById('rTipo')||{}).value || 'todos';
    const cat = (document.getElementById('rCategoria')||{}).value || 'todas';

    const today = new Date();
    let startISO = '0000-01-01';
    if (period==='3m' || period==='6m' || period==='12m'){
      const back = period==='3m'?3: period==='6m'?6:12;
      const d = new Date(today.getFullYear(), today.getMonth()-back+1, 1);
      startISO = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    } else if (period==='ytd') {
      const d = new Date(today.getFullYear(),0,1);
      startISO = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    }

    // filtra transações
    let list = Array.isArray(S.tx)? S.tx.slice(): [];
    list = list.filter(x=> x.data && x.data >= startISO);
    if (tipo!=='todos') list = list.filter(x=> x.tipo===tipo);
    if (cat!=='todas') list = list.filter(x=> x.categoria===cat);

    return { period, tipo, cat, list };
  }

  function chartTheme(){
    const dark = !!document.body.classList.contains('dark');
    return { color: dark? '#e5e7eb':'#0f172a', grid: dark? 'rgba(255,255,255,.08)':'rgba(2,6,23,.08)' };
  }

  function ensureChart(id, cfg){
    if (R.charts[id]){ R.charts[id].destroy(); }
    const ctx = document.getElementById(id);
    if (!ctx || !window.Chart) return;
    R.charts[id] = new Chart(ctx, cfg);
  }

  function renderReports(){
    const { list } = getReportFilters();
    const theme = chartTheme();
    if (window.Chart){
      Chart.defaults.color = theme.color;
      Chart.defaults.font.family = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    }

    // ==== Fluxo por mês (bar)
    {
      const byYM = {};
      list.forEach(x=>{ const ym = String(x.data).slice(0,7); byYM[ym] = (byYM[ym]||0) + (x.tipo==='Despesa'?-1:1)*Number(x.valor||0); });
      const labels = Object.keys(byYM).sort();
      ensureChart('chartFluxo2', {
        type:'bar',
        data:{ labels, datasets:[{ label:'Fluxo', data: labels.map(l=>byYM[l]) }] },
        options:{ scales:{ x:{ grid:{ color: theme.grid }, y:{ grid:{ color: theme.grid } }
      });
    }

    // ==== Pie categorias (despesas)
    {
      const byCat = {};
      list.filter(x=>x.tipo==='Despesa').forEach(x=>{ byCat[x.categoria] = (byCat[x.categoria]||0)+Number(x.valor||0); });
      const labels = Object.keys(byCat);
      const data = labels.map(l=>byCat[l]);
      ensureChart('chartPie2', { type:'pie', data:{ labels, datasets:[{ data }] });
      // tabela top
      const tb = document.querySelector('#tblTop2 tbody'); if (tb){
        tb.innerHTML = labels.map((l,i)=>`<tr><td>${l||'-'}</td><td>${(Number(data[i])||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>`).join('');
      }

    // ==== Previsão simples (média móvel) & média por categoria
    {
      const byYM = {};
      list.forEach(x=>{ const ym=String(x.data).slice(0,7); byYM[ym] = (byYM[ym]||0) + (x.tipo==='Despesa'?-1:1)*Number(x.valor||0); });
      const labels = Object.keys(byYM).sort();
      const vals = labels.map(l=>byYM[l]);
      const ma = vals.map((_,i)=>{ const a=vals[Math.max(0,i-2)]||0, b=vals[Math.max(0,i-1)]||0, c=vals[i]||0; const n = i<2? (i+1):3; return (a+b+c)/n; });
      ensureChart('chartForecast2', { type:'line', data:{ labels, datasets:[
        { label:'Fluxo', data: vals }, { label:'Tendência (MM3)', data: ma }
      ] }, options:{ scales:{ x:{ grid:{ color: theme.grid }, y:{ grid:{ color: theme.grid } } });
      const kpi = document.getElementById('kpiForecastFinal2'); if (kpi){
        const last = vals.at(-1)||0; kpi.textContent = last.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      }

      // média por categoria (despesa)
      const byCat = {};
      list.filter(x=>x.tipo==='Despesa').forEach(x=>{ const ym=String(x.data).slice(0,7); byCat[x.categoria] = byCat[x.categoria]||{}; byCat[x.categoria][ym]=(byCat[x.categoria][ym]||0)+Number(x.valor||0); });
      const tb = document.querySelector('#tblMediaCats2 tbody'); if (tb){
        const cats = Object.keys(byCat);
        const lines = cats.map(c=>{
          const vals = Object.values(byCat[c]);
          const m = vals.length? (vals.reduce((a,b)=>a+b,0)/vals.length):0;
          return `<tr><td>${c}</td><td>${m.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>`;
        }).join('');
        tb.innerHTML = lines;
      }

    // ==== YoY (barras lado a lado)
    {
      const byYearMonth = {};
      list.forEach(x=>{ const y = String(x.data).slice(0, 8); const m = String(x.data).slice(5,7); const key = `${y}-${m}`; byYearMonth[key]=(byYearMonth[key]||0) + (x.tipo==='Despesa'?-1:1)*Number(x.valor||0); });
      const years = Array.from(new Set(list.map(x=> String(x.data).slice(0, 8)))).sort().slice(-2);
      const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
      const labels = months.map(m=>m);
      const ds = years.map(y=>({ label:y, data: months.map(m=> byYearMonth[`${y}-${m}`]||0) });
      ensureChart('chartYoY', { type:'bar', data:{ labels, datasets: ds }, options:{ scales:{ x:{ stacked:false, grid:{ color: theme.grid }, y:{ grid:{ color: theme.grid } } });
    }

    // ==== Receitas x Despesas (stacked)
    {
      const byYM = {};
      list.forEach(x=>{ const ym = String(x.data).slice(0,7); byYM[ym] = byYM[ym] || { R:0, D:0 }; if (x.tipo==='Receita') byYM[ym].R += Number(x.valor||0); if (x.tipo==='Despesa') byYM[ym].D += Number(x.valor||0); });
      const labels = Object.keys(byYM).sort();
      const rec = labels.map(l=> byYM[l].R);
      const des = labels.map(l=> -byYM[l].D);
      ensureChart('chartRxV', { type:'bar', data:{ labels, datasets:[ {label:'Receitas', data:rec}, {label:'Despesas', data:des} ] }, options:{ scales:{ x:{ stacked:true, grid:{ color: theme.grid }, y:{ stacked:true, grid:{ color: theme.grid } } });
    }

    // ==== Heatmap reaproveitado
    const hm = document.getElementById('heatmap2');
    const hmOld = document.getElementById('heatmap');
    if (hm){ hm.innerHTML = hmOld ? hmOld.innerHTML : '<div class="muted">Sem dados</div>'; }

  // ===== Exportar gráfico para PNG =====
  function exportChartPNG(id){
    const map = { 'fluxo':'chartFluxo2','pie':'chartPie2','forecast':'chartForecast2','yoy':'chartYoY','rxv':'chartRxV' };
    const c = document.getElementById(map[id]);
    if (!c) return;
    const link = document.createElement('a');
    link.download = `${id}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  }

  // ===== Tela cheia =====
  function openChartFullscreen(id){
    const map = { 'fluxo':'chartFluxo2','pie':'chartPie2','forecast':'chartForecast2','yoy':'chartYoY','rxv':'chartRxV' };
    const srcCanvas = document.getElementById(map[id]);
    if (!srcCanvas) return;
    const fs = document.getElementById('chartFs');
    const dest = document.getElementById('chartFsCanvas');
    fs.hidden = false;
    if (R.charts._fs) { R.charts._fs.destroy(); }
    const cfg = R.charts[map[id]]?.config? JSON.parse(JSON.stringify(R.charts[map[id]].config)) : null;
    if (cfg){ R.charts._fs = new Chart(dest, cfg); }
  function closeChartFullscreen(){
    const fs = document.getElementById('chartFs');
    fs.hidden = true;
    if (R.charts._fs){ R.charts._fs.destroy(); R.charts._fs = null; }

  // ===== Hook no render existente =====
  const _origRender = typeof render === 'function' ? render : null;
  render = function(){
    if (_origRender) _origRender();
    if (!initReportsUI._done){ initReportsUI(); initReportsUI._done = true; }
    renderReports();
  };

  // ========= Billing config =========
  function wireBillingConfig() {
    const inpDue = qs("#ccDueDay");
    const inpClose = qs("#ccClosingDay");
    if (inpDue)  inpDue.value  = S.ccDueDay ?? "";
    if (inpClose) inpClose.value = S.ccClosingDay ?? "";

    const btn = qs("#saveCardPrefs");
    if (btn && !btn._wired) {
      btn._wired = true;
      btn.addEventListener("click", async () => {
        const rawDue = (qs("#ccDueDay")?.value || "").trim();
        const rawClose = (qs("#ccClosingDay")?.value || "").trim();
        const d = Number(rawDue);
        const c = Number(rawClose);
        S.ccDueDay = (Number.isFinite(d) && d >= 1 && d <= 31) ? d : null;
        S.ccClosingDay = (Number.isFinite(c) && c >= 1 && c <= 31) ? c : null;
        await savePrefs();
        alert("Fatura salva com sucesso!");
      });
    }
  wireBillingConfig();
// Start!
  loadAll();

  // Expose some functions for out-of-onload modules
  try {
    window.saveCat = saveCat;
    window.deleteCat = deleteCat;
    window.loadAll = loadAll;
  } catch (e) {}

  // === Helpers de ciclo da fatura ===
  // txBucketYM: com S.ccClosingDay (1..31), d <= closing => fica no mês da data; d > closing => vai para mês seguinte.
  // Se não houver fechamento, usa mês-calendário (YYYY-MM).
  function txBucketYM(x) {
    try {
      const SS = (typeof S !== 'undefined' ? S : (typeof window !== 'undefined' ? window.S : null)) || {};
      const ymd = String((x && x.data) || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        return ymd.slice(0, 7) || '';
      }
      let closing = Number(SS.ccClosingDay);
      closing = (Number.isFinite(closing) && closing >= 1 && closing <= 31) ? closing : null;
      if (!closing) return ymd.slice(0, 7);
      const [y, m, d] = ymd.split('-').map(Number);
      if (d <= closing) {
        return String(y) + '-' + String(m).padStart(2, '0');
      } else {
        let yy = y, mm = m + 1;
        if (mm > 12) { mm = 1; yy += 1; }
        return String(yy) + '-' + String(mm).padStart(2, '0');
      } catch (e) {
      return (String((x && x.data) || '').slice(0, 7) || '');
    }

  // inSelectedMonth: calendário por padrão; se S.useCycleForReports=true, usa ciclo (txBucketYM)
  function inSelectedMonth(x) {
    const SS = (typeof S !== 'undefined' ? S : (typeof window !== 'undefined' ? window.S : null)) || {};
    const ymCal = String((x && x.data) || '').slice(0,7);
    if (SS.useCycleForReports && typeof txBucketYM === 'function') {
      return txBucketYM(x) === SS.month;
    }
    return ymCal === SS.month;
  }

  // Expor helpers no console
  try { window.txBucketYM = txBucketYM; window.inSelectedMonth = inSelectedMonth; } catch (e) {}


// === UX: Nova Categoria (enter para enviar, valida duplicado, botão desabilita) ===
(function enhanceNewCategory(){
  try {
    const inp = document.querySelector('#newCatName');
    const btn = document.querySelector('#addCat');
    if (!inp || !btn) return;

    const norm = s => (s||'').trim().toLowerCase();
    const isDup = (name) => Array.isArray(window.S?.cats) && window.S.cats.some(c => norm(c?.nome) === norm(name);

    function updateState(){
      const v = inp.value.trim();
      const dup = isDup(v);
      btn.disabled = !v || dup;
      inp.classList.toggle('invalid', !!dup);
      btn.title = dup ? 'Categoria já existe' : 'Adicionar';
    }

    btn.addEventListener('click', async () => {
      const v = inp.value.trim();
      if (!v || isDup(v)) { updateState(); return; }
      await window.saveCat({ nome: v });
      inp.value = '';
      updateState();
      await window.loadAll();
      // foco de volta para acelerar cadastro em sequência
      setTimeout(() => inp.focus(), 0);
    }, { once: false });

    inp.addEventListener('input', updateState);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!btn.disabled) btn.click();
      });

    updateState();
  } catch(e){ console.warn('enhanceNewCategory error:', e); })();

// Bind 'Salvar e novo' after DOM is ready
(function(){
  const btnSalvarENovo = document.getElementById('salvarENovo');
  if (btnSalvarENovo && !btnSalvarENovo._bound) {
    btnSalvarENovo.addEventListener('click', async () => {
      await addOrUpdate(false);
      if (typeof clearModalFields === 'function') clearModalFields();
      const v = document.getElementById('mValorBig'); if (v) v.focus();
    });
    btnSalvarENovo._bound = true;
  })();


// Prevent form submission inside modal (avoid page reload)
(function(){
  var modalForm = document.querySelector('#modalLanc form') || document.querySelector('#modalLanc');
  if (modalForm && !modalForm._prevented) {
    modalForm.addEventListener('submit', function(e){ e.preventDefault(); return false; });
    modalForm._prevented = true;
  })();



// ===== Compat Shims (não invasivos) =====
// Garante helpers globais se algum código externo esperar por eles
if (!window.qs)  window.qs  = (sel, ctx = document) => (ctx || document).querySelector(sel);
if (!window.qsa) window.qsa = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel);

// Garante resetValorInput global (usado ao abrir/fechar modal)
if (!window.resetValorInput) {
  window.resetValorInput = function(){
    try {
      const el = document.getElementById('mValorBig');
      if (el) el.value = '';
    } catch(_) {};
}

// Garante setUseCycleForReports (se a versão do script não exportar)
if (typeof window.setUseCycleForReports !== 'function' && window.S) {
  window.setUseCycleForReports = function(v){
    try { window.S.useCycleForReports = !!v; } catch(_) {}
    try { if (typeof savePrefs === 'function') savePrefs(); } catch(_) {}
    try { if (typeof render === 'function') render(); } catch(_) {};
}
// === Exports for console/debug ===
(function(){ try {
  if (typeof window !== 'undefined'){
    window.fmtMoney = window.fmtMoney || fmtMoney;
    window.parseMoneyMasked = window.parseMoneyMasked || parseMoneyMasked;
    window.money = window.money || money;
  } catch(_){})();


// ===== Pessoas (Marido/Esposa): mini-list, filtros e totais =====
(function(){
  if (!window.S) window.S = {};
  function fmtBR(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function getTxByCarteira(owner){
    let list = Array.isArray(S.tx) ? S.tx.slice() : [];
    list = list.filter(x => (x.carteira === owner || x.carteira_origem === owner || x.carteira_destino === owner);
    if (S.month && S.month !== 'all'){
      list = list.filter(x => x.data && String(x.data).startsWith(S.month);
    }
    list.sort((a,b)=> String(b.data||'').localeCompare(String(a.data||''));
    return list;
  }
  function renderPessoa(owner, ids){
    const listAll = getTxByCarteira(owner);
    const totalIn  = listAll.filter(x=>x.tipo==='Receita').reduce((a,b)=>a+(Number(b.valor)||0),0);
    const totalOut = listAll.filter(x=>x.tipo==='Despesa').reduce((a,b)=>a+(Number(b.valor)||0),0);
    const elIn  = document.getElementById(ids.in);
    const elOut = document.getElementById(ids.out);
    if (elIn)  elIn.textContent  = fmtBR(totalIn);
    if (elOut) elOut.textContent = fmtBR(totalOut);

    const toolbar = document.querySelector(`.mini-toolbar[data-owner="${owner}"]`);
    const tipoSel = toolbar?.querySelector('.pill-btn.active')?.dataset?.tipo || 'todos';

    let list = listAll;
    if (tipoSel !== 'todos') list = list.filter(x => x.tipo === tipoSel);
    list = list.slice(0, 6);

    const ul = document.getElementById(ids.list);
    if (!ul) return;
    ul.innerHTML = '';
    if (!list.length){
      const li = document.createElement('li');
      li.innerHTML = '<div class="sub">Nenhum lançamento</div>';
      ul.append(li);
      return;
    }
    list.forEach(x=>{
      const li = document.createElement('li');
      li.dataset.tipo = x.tipo;
      li.innerHTML = `
        <span class="chip">
          ${x.tipo === 'Receita' ? '<i class="ph ph-trend-up"></i>' :
            x.tipo === 'Despesa' ? '<i class="ph ph-trend-down"></i>' :
            '<i class="ph ph-arrows-left-right"></i>'}
          ${x.tipo}
        </span>
        <div>
          <div class="title">${x.descricao || '-'}</div>
          <div class="sub">${x.categoria || '-'} • ${x.data || '-'}</div>
        </div>
        <div class="valor">${fmtBR(x.valor)}</div>
      `;
      ul.append(li);
    });

    const seeAll = document.getElementById(ids.seeAll);
    if (seeAll){
      seeAll.onclick = (e)=>{
        e.preventDefault();
        if (typeof setTab === 'function') setTab('lancamentos');
        const q = document.getElementById('lancSearch');
        if (q){ q.value = owner; q.dispatchEvent(new Event('input'); };
    }
  function wirePessoaToolbar(owner, ids){
    const toolbar = document.querySelector(`.mini-toolbar[data-owner="${owner}"]`);
    if (!toolbar || toolbar._wired) return;
    toolbar.addEventListener('click', (e)=>{
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      toolbar.querySelectorAll('.pill-btn').forEach(b=>b.classList.toggle('active', b===btn);
      renderPessoa(owner, ids);
    });
    toolbar._wired = true;
  }
  function renderPessoas(){
    wirePessoaToolbar('Marido', {in:'p1In', out:'p1Out', list:'p1List', seeAll:'p1SeeAll'});
    wirePessoaToolbar('Esposa', {in:'p2In', out:'p2Out', list:'p2List', seeAll:'p2SeeAll'});
    renderPessoa('Marido', {in:'p1In', out:'p1Out', list:'p1List', seeAll:'p1SeeAll'});
    renderPessoa('Esposa', {in:'p2In', out:'p2Out', list:'p2List', seeAll:'p2SeeAll'});
  }
  try { window.renderPessoas = renderPessoas; } catch(_){})();
