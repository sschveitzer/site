// Normaliza forma_pagamento para os valores aceitos pelo banco
function normalizeFormaPagamento(v){
  v = String(v || '').trim().toLowerCase();
  // normaliza acentos comuns
  if (v === 'cartão') v = 'cartao';
  if (v === 'crédito') v = 'credito';
  if (v === 'débito') v = 'debito';
  if (v === 'credito' || v === 'debito') return 'cartao';
  if (v === 'boleto' || v === 'transferência' || v === 'transferencia') return 'outros';
  if (v === 'dinheiro' || v === 'pix' || v === 'cartao' || v === 'outros') return v;
  return 'outros';
}
// Rótulos amigáveis para forma_pagamento
function humanFormaPagamento(v){
  switch(String(v||'').toLowerCase()){
    case 'dinheiro': return 'Dinheiro';
    case 'pix': return 'Pix';
    case 'cartao': return 'Cartão';
    case 'outros': return 'Outros';
    default: return v || '-';
  }
}

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

window.onload = function () {
  // Usa o supabase já criado no dashboard.html
  const supabaseClient = window.supabaseClient || supabase;

  // ========= ESTADO GLOBAL =========
  let S = {
    tx: [],
    cats: [],
    recs: [], // recorrências
    metas: { total: 0, porCat: {} },
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
  S.walletList = ["Casa","Marido","Esposa"];

// Expor S e um setter global para alternar o modo de ciclo nos relatórios/metas
try {
  window.S = S;
  if (typeof window.setUseCycleForReports !== 'function') {
    window.setUseCycleForReports = function(v){
      S.useCycleForReports = !!v;
      try { savePrefs(); } catch(e) {}
      try { render();
    ensureMonthSelectLabels();
    try { renderPessoas(); } catch(_) {} } catch(e) {}
    };
  }
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
  function toYMD(input) {
  function fmt(d) { return d.toISOString().slice(0,10); }
  if (input === undefined || input === null || input === '') return fmt(new Date());
  if (input instanceof Date) return isNaN(input.getTime()) ? fmt(new Date()) : fmt(input);
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return fmt(new Date());
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const t = Date.parse(s); return isNaN(t) ? fmt(new Date()) : fmt(new Date(t)); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y,m,d]=s.split('-').map(Number); const dt=new Date(y,m-1,d); return isNaN(dt.getTime())?fmt(new Date()):fmt(dt); }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/').map(Number); const dt=new Date(y,m-1,d); return isNaN(dt.getTime())?fmt(new Date()):fmt(dt); }
    const t = Date.parse(s); return isNaN(t) ? fmt(new Date()) : fmt(new Date(t));
  }
  try { const dt = new Date(input); return isNaN(dt.getTime()) ? fmt(new Date()) : fmt(dt); } catch(_) { return fmt(new Date()); }
}
  function isIsoDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }
  function fmtMoneyLocal(v) {
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
  return (typeof v === 'number') ? v : parseMoneyMasked(String(v||''));
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
  }
  function incMonthly(ymd, diaMes, ajusteFimMes = true) {
    const [y, m] = ymd.split("-").map(Number);
    let yy = y, mm = m + 1;
    if (mm > 12) { mm = 1; yy += 1; }
    const ld = lastDayOfMonth(yy, mm);
    const day = ajusteFimMes ? Math.min(diaMes, ld) : diaMes;
    return toYMD(new Date(yy, mm - 1, day));
  }
  function incWeekly(ymd) { return addDays(ymd, 7); }
  function incYearly(ymd, diaMes, mes, ajusteFimMes = true) {
    const [y] = ymd.split("-").map(Number);
    const yy = y + 1;
    const ld = lastDayOfMonth(yy, mes);
    const day = ajusteFimMes ? Math.min(diaMes, ld) : diaMes;
    return toYMD(new Date(yy, mes - 1, day));
  }

  const qs  = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

// === Auto categoria por descrição (baseado nas suas categorias) ===
const autoCategorias = [
  { match: /supermercado|mercado|atacadao|atacadão|assai|carrefour|extra/i, cat: "Mercado" },
  { match: /ifood|delivery|lanchonete|pizza|burger|hamburguer/i, cat: "Lanches" },
  { match: /almoco|almoço|self service|buffet/i, cat: "Almoços" },
  { match: /netflix|spotify|prime video|disney|hbo/i, cat: "Assinaturas" },
  { match: /aluguel|condominio|condomínio|casa/i, cat: "Moradia" },
  { match: /energia|luz|cpfl|enel/i, cat: "Energia" },
  { match: /internet|fibra|oi|vivo|claro|tim/i, cat: "Internet" },
  { match: /telefone|celular|chip|recarga/i, cat: "Telefone" },
  { match: /posto|gasolina|etanol|diesel/i, cat: "Gasolina" },
  { match: /farmacia|drogaria|droga|raia|pacheco/i, cat: "Farmácia" },
  { match: /medico|dentista|consulta|exame/i, cat: "Saúde" },
  { match: /cinema|show|bar|viagem/i, cat: "Lazer" },
  { match: /salario|salário|pagamento|holerite/i, cat: "Salário" },
  { match: /previdencia|previdência|inss/i, cat: "Previdência" },
  { match: /cartao|cartão|fatura/i, cat: "Cartão de Crédito" },
  { match: /crediario|crediário|parcelado/i, cat: "Crediário" }
];

function guessCategoriaByDesc(desc){
  if (!desc) return null;
  const d = desc.toLowerCase();
  for (const r of autoCategorias){
    if (r.match.test(d)) return r.cat;
  }
  return null;
}

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
}

function ensureMonthSelectLabels(){
  try {
    var sel = document.getElementById('monthSelect');
    if (!sel) return;
    Array.from(sel.options || []).forEach(function(opt){
      if (!opt) return;
      var v = opt.value || '';
      if (/^\d{4}-\d{2}$/.test(v)) {
        opt.textContent = abbrevLabelFromYM(v);
      }
    });
  } catch(_) {}
}


  // ========= LOAD DATA =========
  async function loadAll() {
  const selPag = qs('#mPagamento');
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
      if (selPag) selPag.disabled = false;
        S.useCycleForReports = true;
      }
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
    await (window.applyRecurrences ? window.applyRecurrences() : applyRecurrences());
    // Carrega metas do Supabase
    await fetchMetas();

    render();
    try { renderGastoTotalTiles && renderGastoTotalTiles(); } catch (e) {}
    try { renderGastosCarteiras && renderGastosCarteiras(); } catch (e) {}

  // === Re-render de Lançamentos ao trocar o mês no topo ===
  const monthSel = document.getElementById('monthSelect');
  if (monthSel && !monthSel._wiredLanc) {
    monthSel.addEventListener('change', (e) => {
      S.month = e.target.value;
      try { savePrefs(); } catch (e) {}
      try { render(); } catch (e) {}
      try { renderPessoas(); } catch (e) {}
      try { renderLancamentos(); } catch (e) {}
      try { renderGastosCarteiras && renderGastosCarteiras(); } catch (e) {}
      try { renderGastoTotalTiles && renderGastoTotalTiles(); } catch (e) {}
    });
    ensureMonthSelectLabels();
    monthSel._wiredLanc = true;
  }
    try { window.fillCcFixedFields && window.fillCcFixedFields(); } catch(_) {}
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
    alert("Não foi possível salvar as preferências: " + (error.message || "Erro desconhecido"));
  }
try { window.savePrefs = savePrefs; } catch(e) {}
}

  // Atualiza categoria nas transações (rename)
  async function updateTxCategory(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    await supabaseClient.from("transactions").update({ categoria: newName }).eq("categoria", oldName);
    // 🔧 Atualiza também metas vinculadas à categoria
    await supabaseClient.from("metas").update({ categoria: newName }).eq("categoria", oldName);
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
  const selPag = qs('#mPagamento');
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
      if (selPag) selPag.disabled = true;
      t.carteira = null;
      t.carteira_origem  = (qs("#mOrigem")?.value || "Casa");
      t.carteira_destino = (qs("#mDestino")?.value || "Marido");
    } else {
      if (selPag) selPag.disabled = false;
      t.carteira = (qs("#mCarteira")?.value || "Casa");
      t.carteira_origem = null;
      t.carteira_destino = null;
    }
      // ===== SALVAR (parcelado ou normal) =====
      if (totalParcelas > 1 && modalTipo === "Despesa") {
        const pid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        let dataBase = t.data;
        const valorParcela = t.valor / totalParcelas;
        for (let i = 1; i <= totalParcelas; i++) {
          const txp = { ...t };
          txp.id = gid();
          txp.valor = Number(valorParcela.toFixed(2));
          txp.parcela_atual = i;
          txp.total_parcelas = totalParcelas;
          txp.parcelamento_id = pid;
          txp.data = (i === 1) ? dataBase : incMonthly(dataBase, new Date(dataBase).getDate(), true);
          dataBase = txp.data;
          await saveTx(txp);
        }
      } else {
        await saveTx(t);
      }

}


  async function applyRecurrences() {
  const selPag = qs('#mPagamento');
    try { window.applyRecurrences = applyRecurrences; } catch(_) {}
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
      if (selPag) selPag.disabled = false;
          break;
        }
      }

      if (changed) {
        await supabaseClient.from("recurrences").update({ proxima_data: next }).eq("id", r.id);
      }
    }

    // Recarrega transações após gerar
    const { data: tx } = await supabaseClient.from("transactions").select("*");
    S.tx = tx || [];
  }

  // ========= UI BÁSICA =========
  function setTab(name) {
    qsa(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    qsa("section").forEach(s => s.classList.toggle("active", s.id === name));
  }

  function clearModalFields(){
  try{ if (window.resetValorInput) window.resetValorInput(); }catch(e){}
  const v=document.getElementById('mValorBig'); if(v) v.value='';
  const d=document.getElementById('mDesc'); if(d) d.value='';
  const o=document.getElementById('mObs'); if(o) o.value='';
  const c=document.getElementById('mCategoria'); if(c) c.selectedIndex=0;
}
function toggleModal(show, titleOverride) {
  const selPag = qs('#mPagamento');

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
      // Auto selecionar categoria ao digitar descrição
const descInput = qs("#mDesc");
const catSelect = qs("#mCategoria");

if (descInput && catSelect && !descInput._autoCat) {
  descInput.addEventListener("input", () => {
    const sugestao = guessCategoriaByDesc(descInput.value);
    if (!sugestao) return;

    // só define se o usuário ainda não escolheu manualmente
    if (!catSelect.value) {
      const opt = Array.from(catSelect.options).find(o => o.value === sugestao);
      if (opt) catSelect.value = sugestao;
    }
  });
  descInput._autoCat = true;
}
      const vObs  = qs("#mObs");  if (vObs)  vObs.value  = "";
      const vVal  = qs("#mValorBig"); if (vVal) vVal.value = "";
      if (selPag) selPag.value = "";
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
      if (selPag) selPag.disabled = false;
      S.editingId = null;
    }
  }
// === Modal bindings (stable) ===
(function setupModalBindings(){
  // Open
  var openBtn = document.getElementById('btnNovo');
  if (openBtn && !openBtn._wired) {
    openBtn.addEventListener('click', function(){ try { toggleModal(true); } catch(e) { console.error(e); } });
    openBtn._wired = true;
  }
  // Close / Cancel (delegated inside modal)
  var modal = document.getElementById('modalLanc');
  if (modal && !modal._wiredClose) {
    modal.addEventListener('click', function(ev){
      var t = ev.target;
      // Any element marked to close or common close buttons
      if (t.closest('[data-close-modal], #btnFecharModal, #btnCancelar, #cancelar, .icon.close')) {
        ev.preventDefault();
        try { toggleModal(false); } catch(e) { console.error(e); }
      }
    });
    modal._wiredClose = true;
  }
  // Save handler (delegated inside modal)
  if (modal && !modal._wiredSave) {
    modal.addEventListener('click', function(ev){
      var t = ev.target;
      if (t.closest('[data-action="save"], .btn-save, #btnSalvar, #salvar, #salvarENovo')) {
        ev.preventDefault();
        try {
          if (t.closest('#salvarENovo, [data-action="save-novo"], [data-action="save-new"], .salvar-novo, .save-new, .btn-save-new, [name="salvarENovo"]')) {
            window.addOrUpdate && setTimeout(() => window.addOrUpdate(true), 0);
          } else {
            window.addOrUpdate && setTimeout(() => window.addOrUpdate(false), 0);
          }
        } catch(e) { console.error(e); }
      } else if (t.closest('#cancelar')) {
        ev.preventDefault();
        try { toggleModal(false); } catch(e) {}
      }
    });
    modal._wiredSave = true;
  }
// Esc key closes modal
  if (!document._wiredEscClose) {
    document.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape') {
        try { toggleModal(false); } catch(_) {}
      }
    });
    document._wiredEscClose = true;
  }
})();

  let modalTipo = "Despesa";
  function syncTipoTabs() {
    const selPag = qs('#mPagamento');
    const fCarteira = qs("#wrapCarteira");
    const fTransf = qs("#wrapTransf");
    if (modalTipo === "Transferência") {
      if (selPag) selPag.disabled = true;
      if (fCarteira) fCarteira.style.display = "none";
      if (fTransf) fTransf.style.display = "";
    } else {
      if (selPag) selPag.disabled = false;
      if (fCarteira) fCarteira.style.display = "";
      if (fTransf) fTransf.style.display = "none";
    }
    qsa("#tipoTabs button").forEach(b => b.classList.toggle("active", b.dataset.type === modalTipo));
    if (!S.editingId) {
      const ttl = qs("#modalTitle"); if (ttl) ttl.textContent = "Nova " + modalTipo;
    }
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
  let __savingAddOrUpdate = false;
async function addOrUpdate(keepOpen=false) {
  
    if (__savingAddOrUpdate) { return; }
    __savingAddOrUpdate = true;
    try {
const selPag = qs('#mPagamento');

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
      if (selPag) selPag.disabled = true;
      t.carteira = null;
      t.carteira_origem  = (qs("#mOrigem")?.value || "Casa");
      t.carteira_destino = (qs("#mDestino")?.value || "Marido");
    } else {
      if (selPag) selPag.disabled = false;
      t.carteira = (qs("#mCarteira")?.value || "Casa");
      t.carteira_origem = null;
      t.carteira_destino = null;
    // forma de pagamento
    t.forma_pagamento = (modalTipo === 'Transferência') ? null : normalizeFormaPagamento(qs('#mPagamento') ? qs('#mPagamento').value : '');

    }

    const chkParcelado = qs("#mParcelado");
    const totalParcelas = (modalTipo === "Despesa" && chkParcelado && chkParcelado.checked)
      ? (Number(qs("#mTotalParcelas")?.value) || 1)
      : 1;

    const chkRepetir = qs("#mRepetir");
    if (!chkRepetir?.checked) {
      // ===== SALVAR (parcelado ou normal) =====
      if (totalParcelas > 1 && modalTipo === "Despesa") {
        const pid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        let dataBase = t.data;
        const valorParcela = t.valor / totalParcelas;
        for (let i = 1; i <= totalParcelas; i++) {
          const txp = { ...t };
          txp.id = gid();
          txp.valor = Number(valorParcela.toFixed(2));
          txp.parcela_atual = i;
          txp.total_parcelas = totalParcelas;
          txp.parcelamento_id = pid;
          txp.data = (i === 1) ? dataBase : incMonthly(dataBase, new Date(dataBase).getDate(), true);
          dataBase = txp.data;
          await saveTx(txp);
        }
      } else {
        await saveTx(t);
      }

      await loadAll();
    if (window.resetValorInput) window.resetValorInput();
    if (!keepOpen) { toggleModal(false); }
    return;
    }

    // Criar recorrência
    const perEl = qs("#mPeriodicidade");
    const per = perEl ? perEl.value : "Mensal";
    const diaMes = Number(qs("#mDiaMes")?.value) || new Date().getDate();
    const dow    = Number(qs("#mDiaSemana")?.value || 1);
    const mes    = Number(qs("#mMes")?.value || (new Date().getMonth() + 1));
    const inicio = isIsoDate(qs("#mInicio")?.value) ? qs("#mInicio").value : nowYMD();
    const fim    = isIsoDate(qs("#mFim")?.value) ? qs("#mFim").value : null;
    const ajuste = !!qs("#mAjusteFimMes")?.checked;

    // define próxima data inicial baseada no "início"
    let proxima = inicio;
    const y0 = Number(inicio.slice(0,4));
const m0 = Number(inicio.slice(5,7));
if (per === "Mensal") {
      const ld = lastDayOfMonth(Number(inicio.slice(0,4)), Number(inicio.slice(5,7)));
      const day = (ajuste ? Math.min(diaMes, ld) : diaMes);
      const candidate = toYMD(new Date(Number(inicio.slice(0,4)), Number(inicio.slice(5,7)) - 1, day));
      proxima = (candidate < inicio) ? incMonthly(candidate, diaMes, ajuste) : candidate;
    } else if (per === "Semanal") {
      proxima = incWeekly(inicio);
    } else if (per === "Anual") {
      const ld = lastDayOfMonth(Number(inicio.slice(0,4)), mes);
      const day = (ajuste ? Math.min(diaMes, ld) : diaMes);
      const candidate = toYMD(new Date(Number(inicio.slice(0,4)), mes - 1, day));
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
    if (!keepOpen) { toggleModal(false); }
    return;
    } finally { __savingAddOrUpdate = false; }
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
  }
  try { window.delTx = delTx; } catch (e) {}


  
  // ========= TRANSAÇÕES =========
  function itemTx(x, readOnly = false) {
    const li = document.createElement("li");
    li.className = "item";
    try { li.dataset.tipo = (x && x.tipo) ? x.tipo : ""; } catch(_) {}
    const v = isFinite(Number(x.valor)) ? Number(x.valor) : 0;
    const actions = readOnly
      ? ""
      : `
        <button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>`;
    li.innerHTML = `
      <div class="left">
        <div class="tag chip">${x.tipo}</div>
        <div>
          <div><strong>${x.descricao || "-"}</strong>${(x.parcela_atual && x.total_parcelas) ? ` <span class="parcel-badge">${x.parcela_atual}/${x.total_parcelas}</span>` : ""}</div>
          <div class="muted" style="font-size:12px">${x.categoria || "-"} • ${x.data || "-"}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="${S.hide ? "blurred" : ""} valor" style="font-weight:700">${fmtMoneyLocal(v)}</div>${actions}
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

    // Mostra apenas lançamentos do mês selecionado (evita parcelas futuras)
    let list = (S.tx || []).filter(x => x && x.data && String(x.data).startsWith(S.month));

    list = list
      .sort((a, b) => String(b.data||"").localeCompare(String(a.data||"")))
      .slice(0, 8);

    ul.innerHTML = "";
    if (!ul.classList.contains("lanc-grid")) ul.classList.add("lanc-grid");
    list.forEach(x => ul.append(itemTx(x, true)));
  }


// === Carteiras: gastos por carteira (mês/ciclo) ===
function computeGastosPorCarteira(ym){
  const range = getActiveRangeForYM(ym);
  const list = (S.tx || []).filter(x =>
    x && x.tipo === "Despesa" && x.data && ymdInRange(String(x.data), range.start, range.end)
  );
  // Ignora transferências por segurança (se vierem marcadas como Despesa indevidamente)
  const sum = { Casa: 0, Marido: 0, Esposa: 0 };
  list.forEach(x => {
    const car = x.carteira || '';
    if (car in sum) sum[car] += Number(x.valor) || 0;
  });
  return sum;
}

function renderGastosCarteiras(){
  
  if (!S || !S.month) return;
  try {
    const g = computeGastosPorCarteira(S.month); // bruto (somente Despesas)
    // Deltas do split (Dinheiro/Pix) para Marido/Esposa
    const deltas = (typeof computeSplitDeltas === 'function') ? computeSplitDeltas(txSelected()) : { Marido:0, Esposa:0 };
    // líquido = bruto - delta (refund diminui gasto, cobrança aumenta)
    const fmt = (n) => (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const sign = (n) => (n>=0?'+':'');

    const brutoCasa = Number(g.Casa||0);
    const brutoMar  = Number(g.Marido||0);
    const brutoEsp  = Number(g.Esposa||0);

    const adjMar = Number(deltas.Marido||0);
    const adjEsp = Number(deltas.Esposa||0);
    const adjCasa = 0;

    const liqCasa = brutoCasa - adjCasa;
    const liqMar  = brutoMar  - adjMar;
    const liqEsp  = brutoEsp  - adjEsp;

    const elC = document.getElementById('gastoCasa');
    const elM = document.getElementById('gastoMarido');
    const elE = document.getElementById('gastoEsposa');

    if (elC) {
      elC.innerHTML = ''
        + '<div><strong>'+fmt(brutoCasa)+'</strong> <span class="muted">(bruto)</span></div>'
        + '<div class="muted" style="font-size:12px">ajuste split: '+sign(adjCasa)+fmt(adjCasa)+'</div>'
        + '<div class="muted" style="font-size:12px"><strong>líquido: '+fmt(liqCasa)+'</strong></div>';
    }
    if (elM) {
      elM.innerHTML = ''
        + '<div><strong>'+fmt(brutoMar)+'</strong> <span class="muted">(bruto)</span></div>'
        + '<div class="muted" style="font-size:12px">ajuste split: '+sign(adjMar)+fmt(adjMar)+'</div>'
        + '<div class="muted" style="font-size:12px"><strong>líquido: '+fmt(liqMar)+'</strong></div>';
    }
    if (elE) {
      elE.innerHTML = ''
        + '<div><strong>'+fmt(brutoEsp)+'</strong> <span class="muted">(bruto)</span></div>'
        + '<div class="muted" style="font-size:12px">ajuste split: '+sign(adjEsp)+fmt(adjEsp)+'</div>'
        + '<div class="muted" style="font-size:12px"><strong>líquido: '+fmt(liqEsp)+'</strong></div>';
    }
  } catch(e){ console.error('renderGastosCarteiras:', e); }
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
      list = list.filter(x => x && x.data && String(x.data).startsWith(Sref.month));
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
      frag.appendChild(makePill('Itens: ' + list.length));
      frag.appendChild(makePill('Receitas: ' + fmt(totRec), 'ok'));
      frag.appendChild(makePill('Despesas: ' + fmt(totDesp), 'warn'));
      frag.appendChild(makePill('Saldo: ' + fmt(saldo)));
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
	  console.log(x.descricao, x.carteira);
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
        <div class="muted">Pgto: ${humanFormaPagamento(x.forma_pagamento)} • Carteira: ${x.carteira || '-'}</div>
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
  }

  function openEdit(id) {
  const selPag = qs('#mPagamento');
  // abre o modal em modo edição
  try { toggleModal(true, 'Editar lançamento'); } catch(_) {}
  const x = (S.tx || []).find(t => t.id === id);
    if (!x) return;
    S.editingId = id;
    modalTipo = x.tipo;
    syncTipoTabs();
    rebuildCatSelect(x.categoria);
    const mData = qs("#mData"); if (mData) mData.value = isIsoDate(x.data) ? x.data : nowYMD();
    const mDesc = qs("#mDesc"); if (mDesc) mDesc.value = x.descricao || "";
    const mVal  = qs("#mValorBig"); if (mVal) mVal.value = fmtMoneyLocal(Number(x.valor) || 0);
    const mObs  = qs("#mObs"); if (mObs) mObs.value = x.obs || "";
    const ttl   = qs("#modalTitle"); if (ttl) ttl.textContent = "Editar lançamento";
    const fCarteira = qs("#wrapCarteira"); const fTransf = qs("#wrapTransf");
    if (x.tipo === "Transferência") {
      if (fCarteira) fCarteira.style.display = "none";
      if (fTransf) fTransf.style.display = "";
      const o = qs("#mOrigem"); if (o) o.value = x.carteira_origem || "Casa";
      const d = qs("#mDestino"); if (d) d.value = x.carteira_destino || "Marido";
    } else {
      if (selPag) selPag.disabled = false;
      if (fCarteira) fCarteira.style.display = "";
      if (fTransf) fTransf.style.display = "none";
      const c = qs("#mCarteira"); if (c) c.value = x.carteira || "Casa";
    const pag = qs("#mPagamento"); if (pag) { const mapLbl = {dinheiro:"Dinheiro", pix:"Pix", cartao:"Cartão", outros:"Outros"}; pag.value = mapLbl[String(x.forma_pagamento||"").toLowerCase()] || ""; }
    }

    // Edição: esconde blocos de recorrência (edita só esta instância)
    const chk = qs("#mRepetir");
    const box = qs("#recurrenceFields");
    if (chk && box) { chk.checked = false; box.style.display = "none"; }

    const modal = qs("#modalLanc"); if (modal) modal.style.display = "flex";
    
    // Garantir exibição da forma de pagamento ao editar
    try {
      const __selPag = qs('#mPagamento');
      if (x && __selPag) {
        if (x.tipo !== "Transferência") {
          __selPag.disabled = false;
          __selPag.value = normalizeFormaPagamento(x.forma_pagamento || "");
        } else {
          __selPag.disabled = true;
        }
      }
    } catch(__e){}

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
    try { li.dataset.tipo = (x && x.tipo) ? x.tipo : ""; } catch(_) {}
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
    try { li.dataset.tipo = (x && x.tipo) ? x.tipo : ""; } catch(_) {}

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
        }
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
    let pctDespesas = '—';

    // Transações do mês selecionado
    let txMonth = (S.tx || []).filter(x => x.data && inSelectedMonth(x));
    if (!txMonth.length) {
      const ym = (S && S.month) || '';
      txMonth = (S.tx || []).filter(x => x.data && String(x.data).slice(0,7) === ym);
    }
    // Receitas = P1 + P2 ; Despesas = Casa + P1 + P2 ; Saldo = entradas - saídas
    const receitas = txMonth
      .filter(x => x.tipo === "Receita" && (x.carteira === "Marido" || x.carteira === "Esposa"))
      .reduce((a,b)=>a+Number(b.valor||0),0);
    const despesas = txMonth
      .filter(x => x.tipo === "Despesa" && (x.carteira === "Casa" || x.carteira === "Marido" || x.carteira === "Esposa"))
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
    }
    const _ymSel = (S && S.month) ? S.month : (new Date()).toISOString().slice(0,7);
    const _ymPrevSel = _ymPrev(_ymSel);
    const prevTx = (S.tx||[]).filter(x => x.data && String(x.data).slice(0,7) === _ymPrevSel);
    const kpiReceitas = qs("#kpiReceitas");
    const kpiDespesas = qs("#kpiDespesas");
    const kpiSaldo = qs("#kpiSaldo");

    // Atualiza números
    if (kpiReceitas) kpiReceitas.textContent = fmtMoneyLocal(receitas);
    if (kpiDespesas) kpiDespesas.textContent = fmtMoneyLocal(despesas);
    if (kpiSaldo) kpiSaldo.textContent = fmtMoneyLocal(saldo);
    const casaAgg = sumInOutByWallet("Casa");
    const saidasCasa = (casaAgg && typeof casaAgg.saidas === "number") ? casaAgg.saidas : 0;

    // --- Variação vs mês anterior (em %) ---
    const ymPrev = prevYM(S.month);
    const txPrev = (S.tx || []).filter(x => x.data && String(x.data).startsWith(ymPrev));

    const receitasPrev = txPrev
      .filter(x => x.tipo === "Receita" && (x.carteira === "Marido" || x.carteira === "Esposa"))
      .reduce((a, b) => a + Number(b.valor || 0), 0);

    const despesasPrev = txPrev
      .filter(x => x.tipo === "Despesa" && (x.carteira === "Casa" || x.carteira === "Marido" || x.carteira === "Esposa"))
      .reduce((a, b) => a + Number(b.valor || 0), 0);

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
    }
    setChip("#kpiReceitasDelta", formatDeltaPct(receitas, receitasPrev));
    setChip("#kpiDespesasDelta", formatDeltaPct(despesas, despesasPrev));
    setChip("#kpiSaldoDelta", formatDeltaPct(saldo, saldoPrev));

    // Aplica "blurred" só nos valores principais
['#kpiReceitas','#kpiDespesas','#kpiSaldo'].forEach(id=>{ const el = (typeof qs==='function'?qs(id):document.querySelector(id)); if (el) el.classList.toggle('blurred', S && S.hide); });
    if (receitas > 0) {
      const d = (despesas / receitas) * 100;
      pctDespesas = d.toFixed(1).replace(".", ",") + "%";
    }
    if (kpiDespesasPct) {
      kpiDespesasPct.textContent = pctDespesas;
      kpiDespesasPct.classList.toggle("blurred", S.hide);
    }
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
        const txs = (S.tx || []).filter(x => x.data && String(x.data).startsWith(ym));
        const receitas = txs.filter(x => x.tipo === "Receita").reduce((a, b) => a + Number(b.valor), 0);
        const despesas = txs.filter(x => x.tipo === "Despesa").reduce((a, b) => a + Number(b.valor), 0);
        months.push(cur.toLocaleDateString("pt-BR", { month: "short" }));
        saldoData.push(receitas - despesas);
      }
      chartSaldo = new Chart(ctxSaldo, {
        type: "line",
        data: { labels: months, datasets: [{ label: "Saldo", data: saldoData }] }
      });
    }

    // Pizza por categoria (mês atual)
    if (chartPie) chartPie.destroy();
    const ctxPie = qs("#chartPie");
    if (ctxPie && window.Chart) {
      let txMonth = (S.tx || []).filter(x => x.data && inSelectedMonth(x));
    if (!txMonth.length) {
      const ym = (S && S.month) || '';
      txMonth = (S.tx || []).filter(x => x.data && String(x.data).slice(0,7) === ym);
    }
      const porCat = {};
      txMonth.filter(x => x.tipo === "Despesa").forEach(x => {
        porCat[x.categoria] = (porCat[x.categoria] || 0) + Number(x.valor);
      });
      chartPie = new Chart(ctxPie, {
        type: "pie",
        data: { labels: Object.keys(porCat), datasets: [{ data: Object.values(porCat) }] }
      });
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
        data: { labels, datasets: [{ label: "Fluxo", data: labels.map(l => porMes[l]) }] }
      });
    }
  }

  // ========= SELECTOR DE MESES =========
  function buildMonthSelect() {
    const sel = qs("#monthSelect");
    if (!sel) return;
    sel.innerHTML = "";
    const mesesDisponiveis = Array.from(new Set((S.tx || []).filter(x => x.data).map(x => String(x.data).slice(0, 7)))).sort((a,b)=> b.localeCompare(a));

    // Garante mês atual no seletor
    (function(){
      const dNow = new Date();
      const cur = new Date(dNow.getTime() - dNow.getTimezoneOffset() * 60000).toISOString().slice(0,7);
      if (!mesesDisponiveis.includes(cur)) mesesDisponiveis.unshift(cur);
      // Remove duplicatas mantendo ordem
      const seen = new Set();
      for (let i = 0; i < mesesDisponiveis.length; i++) {
        if (seen.has(mesesDisponiveis[i])) { mesesDisponiveis.splice(i,1); i--; } else { seen.add(mesesDisponiveis[i]); }
      }
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
      out.push(dt.toISOString().slice(0,7));
    }
    return out;
  }
  function monthDays(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function netByMonth(ym) {
    const txs = (S.tx || []).filter(x => x.data && String(x.data).startsWith(ym));
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
      }
    });
    const rows = Object.entries(sum).sort((a,b)=>b[1]-a[1]).slice(0,limit);

    const tbody = document.querySelector('#tblTop tbody');
    if (tbody){
      tbody.innerHTML = '';
      rows.forEach(([cat, total])=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cat||'-'}</td><td>${fmtMoneyLocal(total)}</td>`;
        tbody.appendChild(tr);
      });
    }
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
        tr.innerHTML = `<td>${cat}</td><td>${fmtMoneyLocal(avg)}</td>`;
        tbody.appendChild(tr);
      });
    }
  }

  // Tendência do saldo (projeção até o fim do mês) — mostra em #kpiForecastFinal
  function renderTendenciaSaldo(){
    const ym = S.month;
    const [y,m] = ym.split('-').map(Number);
    const today = new Date();
    const isCurrentMonth = (today.getFullYear()===y && (today.getMonth()+1)===m);

    const txs = (S.tx || []).filter(x=>x.data && String(x.data).startsWith(ym));
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
      el.textContent = fmtMoneyLocal(proj);
      el.style.color = proj >= 0 ? "var(--ok)" : "var(--warn)";
    }
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
      }
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
      const d = Number(String(x.data).slice(8,10));
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
        cell.setAttribute('data-val', String(v));
        cell.title = `Despesas em ${String(d).padStart(2,'0')}/${ym.slice(5,7)}: ${fmtMoneyLocal(v)}`;
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
    const map = Object.fromEntries((S.walletList||["Casa"]).map(w=>[w,0]));
    txSelected().forEach(x=>{
      const v = money(x.valor);
      if (x.tipo === "Receita" && x.carteira) map[x.carteira]+=v;
      if (x.tipo === "Despesa" && x.carteira) map[x.carteira]-=v;
      if (x.tipo === "Transferência"){
        if (x.carteira_origem)  map[x.carteira_origem]-=v;
        if (x.carteira_destino) map[x.carteira_destino]+=v;
      }
    });
    return map;
  }
  
  // ===== Carteiras — cálculos auxiliares =====
  // Usa o mês selecionado (ou ciclo de fatura se ativado)
  function txSelected(){
    const all = Array.isArray(S.tx) ? S.tx : [];
    return all.filter(x => x && x.data && inSelectedMonth(x));
  }

  function sumInOutByWallet(wallet){
    const tx = txSelected().filter(x => (x.carteira === wallet && (x.tipo==="Receita" || x.tipo==="Despesa")));
    const entradas = tx.filter(x => x.tipo==="Receita").reduce((a,b)=>a+money(b.valor),0);
    const saidas   = tx.filter(x => x.tipo==="Despesa").reduce((a,b)=>a+money(b.valor),0);
    // Transferências não entram em entradas/saídas (apenas mudam saldo entre carteiras)
    return { entradas, saidas, items: tx.slice().sort((a,b)=> (b.data||'').localeCompare(a.data||'')).slice(0,10) };
  }
  function sumFamily(){
    const p1 = sumInOutByWallet("Marido");
    const p2 = sumInOutByWallet("Esposa");
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
    if (!items.length){
      const li = document.createElement('li');
      li.innerHTML = '<div class="left"><strong>Nenhum lançamento</strong><div class="muted">Cadastre no +</div></div>';
      ul.appendChild(li);
      return;
    }
    items.forEach(x=>{
      const li = document.createElement('li');
      li.dataset.tipo = x && x.tipo ? x.tipo : ''; 
      const sinal = x.tipo==="Despesa" ? "-" : "+";
      li.innerHTML = '<div class="left"><strong>'+ (x.descricao || x.descr || '-') +'</strong><div class="sub">'+ (x.data||"") +' • '+ (x.categoria||"-") +'</div></div>' +
                     '<div class="right">'+ (sinal) +' '+ fmtMoneyLocal(money(x.valor)) +'</div>';
                     '<div class="right">'+ (sinal) +' '+ fmtMoneyLocal(money(x.valor)) +'</div>';
      ul.appendChild(li);
    });
  }


// === Deltas do split (Dinheiro/Pix) por carteira pessoal ===
// === Deltas do split (Dinheiro/Pix) por carteira pessoal ===
// Regra: só quem NÃO pagou recebe ajuste (cobrança de 50%).
function computeSplitDeltas(items){
  var delta = { Marido: 0, Esposa: 0 };
  if (!Array.isArray(items)) { items = (typeof txSelected==='function' ? txSelected() : []); }
  try {
    items.forEach(function(x){
      if (!x || x.tipo !== "Despesa") return;
      var car = x.carteira || "";
      if (car !== "Marido" && car !== "Esposa") return;

      // Considera somente despesas pessoais pagas em "Outros"
      var fp = String(x.forma_pagamento || "").toLowerCase();
      if (fp !== "outros") return;

      var v = Number(x.valor) || 0;
      if (!(v > 0)) return;

      var metade = v * 0.5;
      var other = (car === "Marido") ? "Esposa" : "Marido";

      // ✅ Novo: não dá reembolso ao pagador; só lança a cobrança no outro
      delta[other] -= metade;
    });
  } catch(e) {
    console.error("computeSplitDeltas:", e);
  }
  return delta;
}
function renderCarteiras(){
    // Grid de saldos
    const el = document.getElementById('walletsGrid');
    if (el){
      const saldos = computeSaldosPorCarteira();
      el.innerHTML = '';
      (S.walletList||["Casa"]).forEach(w=>{
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.innerHTML = '<div class="w-head"><i class="ph ph-wallet"></i> <strong>'+w+'</strong></div>' +
                         '<div class="w-balance">'+ fmtMoneyLocal(saldos[w]||0) +'</div>';
        el.appendChild(card);
      
  // --- Card de ajustes do split (Dinheiro/Pix) — render seguro dentro da seção #carteiras ---
  try {
    var section = document.getElementById('carteiras');
if (section) {
  var grid = section.querySelector('.grid-carteiras');
  var host = document.getElementById('splitInfoCard');
  if (!host) {
    host = document.createElement('div');
    host.id = 'splitInfoCard';
    host.className = 'card span-2';
    if (grid) {
      // Inserir AO FINAL do grid para ficar abaixo dos cards Marido/Esposa
      grid.appendChild(host);
    } else {
      section.appendChild(host);
    }
  }
var deltas = (typeof computeSplitDeltas==='function') ? computeSplitDeltas(txSelected()) : { Marido:0, Esposa:0 };
      var mDelta = Number(deltas.Marido)||0;
      var eDelta = Number(deltas.Esposa)||0;
      var sign = function(x){ return x>=0?'+':''; };
      var fmt = function(n){ return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); };
      var ym = (window.S && S.month) ? S.month : new Date().toISOString().slice(0,7);
      var labelMes = (function(){ try { return abbrevLabelFromYM(ym); } catch(_){ return ym; } })();

      host.innerHTML = ''
        + '<h3><i class="ph ph-arrows-left-right"></i> Ajustes de split (Outros) <span class="muted" style="font-weight:400">— período: '+labelMes+'</span></h3>'
        + '<div class="resumo-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">'
        +   '<div class="sum-box"><div class="muted">Marido</div><div class="sum-value">'+ sign(mDelta) + fmt(mDelta) +'</div></div>'
        +   '<div class="sum-box"><div class="muted">Esposa</div><div class="sum-value">'+ sign(eDelta) + fmt(eDelta) +'</div></div>'
        + '</div>'
        + '<div class="helper">Mostra o impacto do split 50/50 em despesas pessoais pagas em Outros (sem alterar lançamentos).</div>';
    }
  } catch(err) { console.error('split card render', err); }
});
    }
    // Somas P1/P2 e listas
    const p1 = sumInOutByWallet("Marido");
    const p2 = sumInOutByWallet("Esposa");
    const p1In = document.getElementById('p1In'); if (p1In) p1In.textContent = fmtMoneyLocal(p1.entradas);
    const p1Out= document.getElementById('p1Out'); if (p1Out) p1Out.textContent = fmtMoneyLocal(p1.saidas);
    const p2In = document.getElementById('p2In'); if (p2In) p2In.textContent = fmtMoneyLocal(p2.entradas);
    const p2Out= document.getElementById('p2Out'); if (p2Out) p2Out.textContent = fmtMoneyLocal(p2.saidas);
    renderMiniList('p1List', p1.items);
    renderMiniList('p2List', p2.items);

  }
function render() {
    document.body.classList.toggle("dark", S.dark);

    // sincroniza estado dos toggles (suporta ids antigos e novos)
    const hideToggle = qs("#toggleHide") || qs("#cfgHide");
    if (hideToggle) hideToggle.checked = S.hide;
    const darkToggle = qs("#toggleDark") || qs("#cfgDark");
    if (darkToggle) darkToggle.checked = S.dark;

    
    const cycleToggle = qs("#toggleCycle") || qs("#useCycleForReports");
    if (cycleToggle) cycleToggle.checked = !!S.useCycleForReports;
    renderRecentes();
    renderLancamentos();
    renderCategorias();
    renderCarteiras();
    buildLancCatFilter();
    buildMonthSelect();
    updateKpis();
    renderCharts();

    // Novos insights
    renderTopCategorias12m(5);
    renderMediaPorCategoria(6);
    renderTendenciaSaldo();
    renderForecastChart();
    renderHeatmap();
    // Metas
    renderMetaCard();
    renderMetasConfig();
  }

  // ========= EVENTOS =========

  // ======= NAV MOBILE =======
  (function(){
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (menuBtn && mobileMenu){
      menuBtn.addEventListener('click', function(e){
        e.stopPropagation();
        mobileMenu.classList.toggle('open');
      });
      // Fechar ao clicar fora
      document.addEventListener('click', function(e){
        if (!mobileMenu.contains(e.target) && e.target !== menuBtn){
          mobileMenu.classList.remove('open');
        }
      });
      // Fechar ao escolher uma aba
      mobileMenu.querySelectorAll('.tab').forEach(function(btn){
        btn.addEventListener('click', function(){
          mobileMenu.classList.remove('open');
        });
      });
    }
  })();

  qsa(".tab").forEach(btn =>
    btn.addEventListener("click", () => setTab(btn.dataset.tab))
  );

  const fab = qs("#fab"); if (fab) fab.onclick = () => toggleModal(true);
  const btnNovo = qs("#btnNovo"); if (btnNovo) btnNovo.onclick = () => toggleModal(true);
  const btnClose = qs("#closeModal");
  if (btnClose) btnClose.onclick = () => {
    if (window.resetValorInput) window.resetValorInput();
    toggleModal(false); return;
  };
  const btnCancelar = qs("#cancelar");
  const btnSalvar = qs("#salvar");
  if (btnSalvar) btnSalvar.onclick = (e) => {
    try { e && e.preventDefault && e.preventDefault(); } catch(_) {}
    if (typeof window.addOrUpdate === "function") window.addOrUpdate(false);
  };
  if (btnCancelar) btnCancelar.onclick = () => {
    if (window.resetValorInput) window.resetValorInput();
    toggleModal(false); return;
  };

  qsa("#tipoTabs button").forEach(b =>
    b.addEventListener("click", () => { modalTipo = b.dataset.type; syncTipoTabs(); })
  );

  const btnAddCat = qs("#addCat");
  if (btnAddCat) btnAddCat.onclick = async () => {
    const nome = (qs("#newCatName")?.value || "").trim();
    if (!nome) return;
    if ((S.cats||[]).some(c => (c.nome||"").toLowerCase() === nome.toLowerCase())) {
      alert("Essa categoria já existe.");
      return;
    }
    await saveCat({ nome });
    const inp = qs("#newCatName"); if (inp) inp.value = "";
    loadAll();
  };

  // Suporta #toggleDark (novo) e #cfgDark (antigo)
  const btnDark = qs("#toggleDark") || qs("#cfgDark");
  if (btnDark) {
    btnDark.addEventListener('change', async () => {
      S.dark = !!btnDark.checked;
      document.body.classList.toggle("dark", S.dark);
      await savePrefs();
    });
    // clique também alterna (para botões sem checkbox)
    btnDark.addEventListener('click', async (e) => {
      if (btnDark.tagName === 'BUTTON') {
        S.dark = !S.dark;
        document.body.classList.toggle("dark", S.dark);
        await savePrefs();
      }
    });
  }

  // Suporta #toggleHide (novo) e #cfgHide (antigo)
  const toggleHide = qs("#toggleHide") || qs("#cfgHide");
  if (toggleHide) toggleHide.onchange = async e => {
    S.hide = !!e.target.checked;
    render();
    await savePrefs();
  };

  // Toggle do ciclo na topbar (ao lado de Esconder valores)
  const toggleCycle = qs('#toggleCycle') || qs('#useCycleForReports');
  if (toggleCycle) toggleCycle.onchange = async e => {
    try {
      setUseCycleForReports(!!e.target.checked); // já salva e re-renderiza
    } catch (err) {
      console.error('Falha ao alternar ciclo:', err);
    }
  };


  // Ícone de Config na topbar (abre a aba Config)
  function wireBtnConfig(){
    const btn = document.getElementById('btnConfig');
    if (btn && !btn.__wired){
      btn.__wired = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setTab('config');
      });
    }
  }
  wireBtnConfig();
  document.addEventListener('click', (e) => {
    const target = e.target && e.target.closest ? e.target.closest('#btnConfig') : null;
    if (target){
      e.preventDefault();
      setTab('config');
    }
  });

  // Recorrência: mostrar/ocultar campos conforme checkbox/periodicidade
  
    const chkParcelado = qs("#mParcelado");
    const totalParcelas = (modalTipo === "Despesa" && chkParcelado && chkParcelado.checked)
      ? (Number(qs("#mTotalParcelas")?.value) || 1)
      : 1;

    const chkRepetir = qs("#mRepetir");
  const recurrenceBox = qs("#recurrenceFields");
  const selPer = qs("#mPeriodicidade");
  const fldDM = qs("#fieldDiaMes");
  const fldDW = qs("#fieldDiaSemana");
  const fldM = qs("#fieldMes");
  function syncRecurrenceFields() {
    if (!chkRepetir || !recurrenceBox) return;
    const on = chkRepetir.checked;
    recurrenceBox.style.display = on ? "block" : "none";
    if (!on) return;
    const per = selPer?.value || "Mensal";
    if (fldDM) fldDM.style.display = (per === "Mensal" || per === "Anual") ? "block" : "none";
    if (fldDW) fldDW.style.display = (per === "Semanal") ? "block" : "none";
    if (fldM)  fldM.style.display  = (per === "Anual") ? "block" : "none";
  }
  if (chkRepetir) chkRepetir.addEventListener("change", syncRecurrenceFields);
  if (selPer) selPer.addEventListener("change", syncRecurrenceFields);

  // ====== UX additions: currency mask, keyboard and focus handling ======
  (function enhanceModalUX(){
    const modal = document.getElementById('modalLanc');
    const dialog = modal ? modal.querySelector('.content') : null;
    const valorInput = document.getElementById('mValorBig');
    const formError = document.getElementById('formError');
    const btnSalvar = document.getElementById('salvar');
    const btnCancelar = document.getElementById('cancelar');

    // currency mask with raw cents
    let rawCents = 0;
    
window.resetValorInput = function(){
  try { rawCents = 0; } catch(_) {}
  const el = document.getElementById('mValorBig');
  if (el) el.value = '';
};
const br = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
    const setAmount = () => { if (valorInput) valorInput.value = rawCents ? br.format(rawCents/100) : ''; };

    if (valorInput) {
      valorInput.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'deleteContentBackward') {
          rawCents = Math.floor(rawCents/10);
          setAmount();
          e.preventDefault();
        }
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
        }
      });

      // Trap de foco + Tab
      dialog.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusables = Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      });
    }
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
      S.metas = data ? { total: Number(data.total)||0, porCat: (data.por_cat||{}) } : { total: 0, porCat: {} };
    } catch(e){
      console.error(e);
      S.metas = { total: 0, porCat: {} };
    }
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
  }
  function parseBRL(str){
    if (!str) return 0;
    return Number(str.replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''))||0;
  }
  function fmtBRL(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function renderMetaCard(){
  const selPag = qs('#mPagamento');
    const metas = S.metas || { total: 0, porCat: {} };
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
      const pct = Math.min(100, Math.round((gastosMes/totalMeta)*100));
      bar.style.width = pct + '%';
      chip.textContent = gastosMes <= totalMeta ? pct + '% (dentro da meta)' : Math.round((gastosMes/totalMeta)*100) + '% (estourou)';
      chip.classList.toggle('ok', gastosMes <= totalMeta);
      chip.classList.toggle('warn', gastosMes > totalMeta);
      if (obs) {
        const restante = Math.max(0, totalMeta - gastosMes);
        obs.textContent = gastosMes <= totalMeta ? `Faltam ${fmtBRL(restante)} para atingir a meta.` : `Ultrapassou a meta em ${fmtBRL(gastosMes - totalMeta)}.`;
      }
    } else {
      if (selPag) selPag.disabled = false;
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
        if (metasCard){ metasCard.scrollIntoView({behavior:'smooth', block:'start'}); }
      };
    }
  }
  function renderMetasConfig(){
    const metas = S.metas || { total:0, porCat:{} };
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
        const m = { total: parseBRL(inpTotal && inpTotal.value), porCat: {} };
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
  }

  // ========= RELATÓRIOS: estado, filtros e subtabs =========
  ;let R = { tab: 'fluxo', charts: {} };

  function initReportsUI(){
    const navBtns = document.querySelectorAll('.reports-nav .rtab');
    const panels = document.querySelectorAll('.rpanel');
    navBtns.forEach(btn=>{
      btn.onclick = ()=>{
        R.tab = btn.dataset.rtab;
        navBtns.forEach(b=>b.classList.toggle('active', b===btn));
        panels.forEach(p=>p.classList.toggle('active', p.dataset.rtab===R.tab));
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
    document.querySelectorAll('[data-fs]').forEach(b=> b.onclick = ()=> openChartFullscreen(b.dataset.fs));
    document.querySelectorAll('[data-export]').forEach(b=> b.onclick = ()=> exportChartPNG(b.dataset.export));
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
        options:{ scales:{ x:{ grid:{ color: theme.grid } }, y:{ grid:{ color: theme.grid } } } }
      });
    }

    // ==== Pie categorias (despesas)
    {
      const byCat = {};
      list.filter(x=>x.tipo==='Despesa').forEach(x=>{ byCat[x.categoria] = (byCat[x.categoria]||0)+Number(x.valor||0); });
      const labels = Object.keys(byCat);
      const data = labels.map(l=>byCat[l]);
      ensureChart('chartPie2', { type:'pie', data:{ labels, datasets:[{ data }] } });
      // tabela top
      const tb = document.querySelector('#tblTop2 tbody'); if (tb){
        tb.innerHTML = labels.map((l,i)=>`<tr><td>${l||'-'}</td><td>${(Number(data[i])||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>`).join('');
      }
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
      ] }, options:{ scales:{ x:{ grid:{ color: theme.grid } }, y:{ grid:{ color: theme.grid } } } } });
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
    }

    // ==== YoY (barras lado a lado)
    {
      const byYearMonth = {};
      list.forEach(x=>{ const y = String(x.data).slice(0, 8); const m = String(x.data).slice(5,7); const key = `${y}-${m}`; byYearMonth[key]=(byYearMonth[key]||0) + (x.tipo==='Despesa'?-1:1)*Number(x.valor||0); });
      const years = Array.from(new Set(list.map(x=> String(x.data).slice(0, 8)))).sort().slice(-2);
      const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
      const labels = months.map(m=>m);
      const ds = years.map(y=>({ label:y, data: months.map(m=> byYearMonth[`${y}-${m}`]||0) }));
      ensureChart('chartYoY', { type:'bar', data:{ labels, datasets: ds }, options:{ scales:{ x:{ stacked:false, grid:{ color: theme.grid } }, y:{ grid:{ color: theme.grid } } } } });
    }

    // ==== Receitas x Despesas (stacked)
    {
      const byYM = {};
      list.forEach(x=>{ const ym = String(x.data).slice(0,7); byYM[ym] = byYM[ym] || { R:0, D:0 }; if (x.tipo==='Receita') byYM[ym].R += Number(x.valor||0); if (x.tipo==='Despesa') byYM[ym].D += Number(x.valor||0); });
      const labels = Object.keys(byYM).sort();
      const rec = labels.map(l=> byYM[l].R);
      const des = labels.map(l=> -byYM[l].D);
      ensureChart('chartRxV', { type:'bar', data:{ labels, datasets:[ {label:'Receitas', data:rec}, {label:'Despesas', data:des} ] }, options:{ scales:{ x:{ stacked:true, grid:{ color: theme.grid } }, y:{ stacked:true, grid:{ color: theme.grid } } } } });
    }

    // ==== Heatmap reaproveitado
    const hm = document.getElementById('heatmap2');
    const hmOld = document.getElementById('heatmap');
    if (hm){ hm.innerHTML = hmOld ? hmOld.innerHTML : '<div class="muted">Sem dados</div>'; }
  }

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
  }
  function closeChartFullscreen(){
    const fs = document.getElementById('chartFs');
    fs.hidden = true;
    if (R.charts._fs){ R.charts._fs.destroy(); R.charts._fs = null; }
  }

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
}

  // === Helpers de ciclo da fatura ===
  // txBucketYM: com S.ccClosingDay (1..31), d <= closing => fica no mês da data; d > closing => vai para mês seguinte.
  // Se não houver fechamento, usa mês-calendário (YYYY-MM).
  function txBucketYM(x) {
  const selPag = qs('#mPagamento');
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
      if (selPag) selPag.disabled = false;
        let yy = y, mm = m + 1;
        if (mm > 12) { mm = 1; yy += 1; }
        return String(yy) + '-' + String(mm).padStart(2, '0');
      }
    } catch (e) {
      return (String((x && x.data) || '').slice(0, 7) || '');
    }
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
    const isDup = (name) => Array.isArray(window.S?.cats) && window.S.cats.some(c => norm(c?.nome) === norm(name));

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
      }
    });

    updateState();
  } catch(e){ console.warn('enhanceNewCategory error:', e); }
})();




// Prevent form submission inside modal (avoid page reload)
(function(){
  var modalForm = document.querySelector('#modalLanc form') || document.querySelector('#modalLanc');
  if (modalForm && !modalForm._prevented) {
    modalForm.addEventListener('submit', function(e){ e.preventDefault(); return false; });
    modalForm._prevented = true;
  }
})();



// ===== Compat Shims (não invasivos) =====
// Garante helpers globais se algum código externo esperar por eles
if (!window.qs)  window.qs  = (sel, ctx = document) => (ctx || document).querySelector(sel);
if (!window.qsa) window.qsa = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));

// Garante resetValorInput global (usado ao abrir/fechar modal)
if (!window.resetValorInput) {
  window.resetValorInput = function(){
    try {
      const el = document.getElementById('mValorBig');
      if (el) el.value = '';
    } catch(_) {}
  };
}

// Garante setUseCycleForReports (se a versão do script não exportar)
if (typeof window.setUseCycleForReports !== 'function' && window.S) {
  window.setUseCycleForReports = function(v){
    try { window.S.useCycleForReports = !!v; } catch(_) {}
    try { if (typeof savePrefs === 'function') savePrefs(); } catch(_) {}
    try { if (typeof render === 'function') render(); } catch(_) {}
  };
}
// === Exports for console/debug ===
(function(){ try {
  if (typeof window !== 'undefined'){
    window.fmtMoney = window.fmtMoney || fmtMoney;
    window.parseMoneyMasked = window.parseMoneyMasked || parseMoneyMasked;
    window.money = window.money || money;
  }
} catch(_){} })();


// ===== Pessoas (Marido/Esposa): mini-list, filtros e totais =====
(function(){
  if (!window.S) window.S = {};
  function fmtBR(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function getTxByCarteira(owner){
    let list = Array.isArray(S.tx) ? S.tx.slice() : [];
    list = list.filter(x => (x.carteira === owner || x.carteira_origem === owner || x.carteira_destino === owner));
    if (S.month && S.month !== 'all'){
      list = list.filter(x => x.data && String(x.data).startsWith(S.month));
    }
    list.sort((a,b)=> String(b.data||'').localeCompare(String(a.data||'')));
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
        if (q){ q.value = owner; q.dispatchEvent(new Event('input')); }
      };
    }
  }
  function wirePessoaToolbar(owner, ids){
    const toolbar = document.querySelector(`.mini-toolbar[data-owner="${owner}"]`);
    if (!toolbar || toolbar._wired) return;
    toolbar.addEventListener('click', (e)=>{
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      toolbar.querySelectorAll('.pill-btn').forEach(b=>b.classList.toggle('active', b===btn));
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
  try { window.renderPessoas = renderPessoas; } catch(_){}
})();



// === RENDERIZAÇÃO DAS LISTAS DE PESSOAS (Carteiras) ===
function renderPessoas() {
  function renderPessoa(owner, ulId, toolbarSel, inSel, outSel) {
    var ul = document.getElementById(ulId);
    var toolbar = document.querySelector(toolbarSel);
    if (!ul || !toolbar) return;

    // tipo selecionado (todos/Receita/Despesa)
    var activeBtn = toolbar.querySelector(".pill-btn.active");
    var tipo = activeBtn ? activeBtn.getAttribute("data-tipo") : "todos";

    // lista base: apenas lançamentos desta carteira e do mês selecionado
    var listAll = Array.isArray(S.tx) ? S.tx.filter(function(x){
      if (!x) return false;
      if (x.carteira !== owner) return false;
      if (!x.data || typeof x.data !== "string") return false;
      if (S.month && S.month !== "all") {
        return x.data.slice(0,7) === S.month;
      }
      return true;
    }) : [];

    // totais independentes do filtro visível
    var totInAll  = listAll.filter(function(x){ return x.tipo === "Receita"; })
                           .reduce(function(a,b){ return a + (Number(b.valor)||0); }, 0);
    var totOutAll = listAll.filter(function(x){ return x.tipo === "Despesa"; })
                           .reduce(function(a,b){ return a + (Number(b.valor)||0); }, 0);

    // Aplica "blurred" só nos valores principais
['#kpiReceitas','#kpiDespesas','#kpiSaldo'].forEach(id=>{ const el = (typeof qs==='function'?qs(id):document.querySelector(id)); if (el) el.classList.toggle('blurred', S && S.hide); });
    list.sort(function(a,b){ return String(b.data||"").localeCompare(String(a.data||"")); });

    // renderiza
    ul.innerHTML = "";
    list.forEach(function(x){ ul.append(itemTx(x, true)); });

    // atualiza mini-somas
    var fmt = function(v){ return (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); };
    var inEl  = document.getElementById(inSel);
    var outEl = document.getElementById(outSel);
    if (inEl)  inEl.textContent  = fmt(totInAll);
    if (outEl) outEl.textContent = fmt(totOutAll);
  }

  renderPessoa("Marido", "p1List", ".mini-toolbar[data-owner='Marido']", "p1In", "p1Out");
  renderPessoa("Esposa", "p2List", ".mini-toolbar[data-owner='Esposa']", "p2In", "p2Out");
}

// === LIGAÇÃO DOS BOTÕES DE FILTRO (Carteiras) ===
document.addEventListener("click", function(e) {
  var target = e.target;
  if (!target) return;
  // suporta clique no <button> ou no <span> interno
  if (target.classList && target.classList.contains("pill-btn") ||
      target.parentElement && target.parentElement.classList && target.parentElement.classList.contains("pill-btn")) {
    var btn = target.classList && target.classList.contains("pill-btn") ? target : target.parentElement;
    var toolbar = btn.closest(".mini-toolbar");
    if (toolbar) {
      Array.prototype.forEach.call(toolbar.querySelectorAll(".pill-btn"), function(b){ b.classList.remove("active"); });
      btn.classList.add("active");
      try { renderPessoas(); } catch(_) {}
    }
  }
});

try { window.toggleModal = toggleModal; } catch(e) {}

// ==== INÍCIO: bloco de otimizações/ajustes adicionados automaticamente ====/
(function(){
  // Helpers básicos
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function withPagamentoDisabled(run){
    const el = $('#mPagamento');
    const prev = !!(el && el.disabled);
    if (el) el.disabled = true;
    try { return run(); } finally { if (el && !prev) el.disabled = false; }
  }

  // Render debounced — preserva window.render original se existir
  const renderNow = (typeof render === 'function') ? render : () => {};
  let _raf;
  window.render = function debouncedRender(){
    if (_raf) cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(() => { _raf = null; try { renderNow(); } catch(e) { console.error(e); } });
  };

  // Normalização de forma de pagamento
  (function(){
    const ACCENTS = { 'cartão':'cartao', 'crédito':'credito', 'débito':'debito' };
    const DIRECT  = new Set(['dinheiro','pix','cartao','outros']);
    const ALIASES = new Map([
      ['credito','cartao'],
      ['debito','cartao'],
      ['boleto','outros'],
      ['transferência','outros'],
      ['transferencia','outros'],
    ]);
    const LABELS = new Map([
      ['dinheiro','Dinheiro'],
      ['pix','Pix'],
      ['cartao','Cartão'],
      ['outros','Outros']
    ]);
    window.normalizeFormaPagamento = function(v){
      let s = String(v||'').trim().toLowerCase();
      if (s in ACCENTS) s = ACCENTS[s];
      if (ALIASES.has(s)) return ALIASES.get(s);
      if (DIRECT.has(s))  return s;
      return 'outros';
    };
    window.humanFormaPagamento = function(v){
      const key = String(v||'').toLowerCase();
      return LABELS.get(key) || (v || '-');
    };
  })();

  // materializeOne — override mantendo assinatura
  window.materializeOne = async function materializeOne(rec, occDate){
    const t = {
      id: (typeof gid==='function'? gid(): String(Date.now())),
      tipo: rec.tipo,
      categoria: rec.categoria,
      data: occDate,
      descricao: rec.descricao,
      valor: Number(rec.valor)||0,
      obs: rec.obs ? (rec.obs + ' (recorrente)') : 'Recorrente',
      recurrence_id: rec.id,
      occurrence_date: occDate
    };
    if (window.modalTipo === 'Transferência') {
      return (function(){
        return withPagamentoDisabled(() => {
          t.carteira = null;
          t.carteira_origem  = ($('#mOrigem')?.value || 'Casa');
          t.carteira_destino = ($('#mDestino')?.value || 'Marido');
          return t;
        });
      })();
    } else {
      t.carteira = ($('#mCarteira')?.value || 'Casa');
      t.carteira_origem = null;
      t.carteira_destino = null;
      return t;
    }
  };

  // addOrUpdate — override mantendo assinatura
  window.addOrUpdate = /* módulo removido: cartões duplicados 'Gasto total — Marido/Esposa' */
(function(){
  // intencionalmente vazio para não injetar cartões duplicados
})();
})();



/* =========================================================================
   GASTO TOTAL — TILES (2 colunas): Esposa e Marido
   - Estilo compacto como o print: título pequeno + valor grande
   - Cálculo: 50% Casa + Ajuste split (Outros, só cônjuge recebe +50%)
   - Respeita mês/ciclo da fatura
   - Remove renderizações antigas (cards detalhados ou linha de 3)
   ========================================================================= */
(function(){
  // --- CSS dos tiles ---
  function ensureTilesCSS(){
    if (document.getElementById('gastosTotalTilesCSS')) return;
    var css = document.createElement('style');
    css.id = 'gastosTotalTilesCSS';
    css.textContent = [
      '#gastosTotalTiles{display:grid;gap:16px;grid-template-columns:1fr;margin:8px 0 16px 0;}',
      '@media(min-width: 920px){#gastosTotalTiles{grid-template-columns:1fr 1fr;}}',
      '#gastosTotalTiles .sum-box{background:rgba(0,0,0,0.03);border:1px dashed rgba(0,0,0,0.08);padding:14px 16px;border-radius:12px;}',
      '#gastosTotalTiles .sum-box .muted{opacity:.7;margin-bottom:6px;}',
      '#gastosTotalTiles .sum-box .sum-value{font-weight:800;font-size:26px;letter-spacing:.2px;}',
      '#resumoFamiliarHeader{display:flex;align-items:center;gap:8px;margin:8px 0 12px 0;}',
      '#resumoFamiliarHeader .title{font-weight:700;font-size:18px;}'
    ].join('\n');
    document.head.appendChild(css);
  }

  // --- helpers locais (redeclara, mas isolado neste IIFE) ---
  function toISO10(d){ var dd = new Date(d.getTime() - d.getTimezoneOffset()*60000); return dd.toISOString().slice(0,10); }
  function lastDayOfMonth(y, m){ return new Date(y, m, 0).getDate(); }
  function ymdInRange(ymd, start, end){ var s = String(ymd||''); return s >= String(start||'') && s <= String(end||''); }
  function getRange(ym){
    ym = String(ym||'').slice(0,7); if (!/^\d{4}-\d{2}$/.test(ym)){ var d0=new Date(); ym = d0.toISOString().slice(0,7); }
    var Y = +ym.slice(0,4), M = +ym.slice(5,7);
    if (window.S && S.useCycleForReports && Number(S.ccClosingDay)){
      var closing = Number(S.ccClosingDay);
      var clamp = function(y,m,d){ var ld = lastDayOfMonth(y,m); return Math.max(1, Math.min(d, ld)); };
      var prevY = Y, prevM = M-1; if (prevM<1){ prevM=12; prevY=Y-1; }
      var prevClose = new Date(prevY, prevM-1, clamp(prevY, prevM, closing));
      var thisClose = new Date(Y, M-1, clamp(Y, M, closing));
      var start = new Date(prevClose); start.setDate(start.getDate()+1);
      return { start: toISO10(start), end: toISO10(thisClose) };
    }
    var startMonth = new Date(Y, M-1, 1), endMonth = new Date(Y, M, 0);
    return { start: toISO10(startMonth), end: toISO10(endMonth) };
  }
  function computeCasaTotal(ym){
    var r = getRange(ym), total = 0, list = (window.S && Array.isArray(S.tx)) ? S.tx : [];
    for (var i=0;i<list.length;i++){
      var x = list[i]; if (!x || x.tipo!=='Despesa' || x.carteira!=='Casa') continue;
      var d = String(x.data||''); if (!ymdInRange(d, r.start, r.end)) continue;
      total += Number(x.valor)||0;
    }
    return total;
  }
  function computeSplitPessoas(ym){
    var r = getRange(ym), res = { Marido:0, Esposa:0 }, list = (window.S && Array.isArray(S.tx)) ? S.tx : [];
    for (var i=0;i<list.length;i++){
      var x = list[i]; if (!x || x.tipo!=='Despesa') continue;
      var car = x.carteira||''; if (car!=='Marido' && car!=='Esposa') continue;
      var fp = String(x.forma_pagamento||'').toLowerCase(); if (fp!=='outros') continue;
      var d = String(x.data||''); if (!ymdInRange(d, r.start, r.end)) continue;
      var v = Number(x.valor)||0; if (!(v>0)) continue;
      var metade = v*0.5;
      if (car === 'Marido') res.Esposa += metade; else res.Marido += metade;
    }
    return res;
  }
  function fmt(n){ return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

  // --- Render dos tiles ---
  function renderGastoTotalTiles(){
    try{
      if (!(window.S && S.month)) return;
      var sec = document.getElementById('carteiras'); if (!sec) return;
      ensureTilesCSS();

      // Remover versões antigas
      Array.prototype.forEach.call(sec.querySelectorAll('.card'), function(cd){
        var h = cd.querySelector('h3');
        if (h && (/Gastos?\s+por\s+carteira/i.test(h.textContent||'')
               || /Gasto\s+total\s+—\s+(Marido|Esposa)/i.test(h.textContent||''))) {
          cd.parentNode && cd.parentNode.removeChild(cd);
        }
      });
      var top = document.getElementById('resumoFamiliarTop');
      if (top && top.parentNode) top.parentNode.removeChild(top);
      var wrapOld = document.getElementById('resumoFamiliarWrap');
      if (wrapOld && wrapOld.parentNode) wrapOld.parentNode.removeChild(wrapOld);

      // Header "Resumo familiar"
      var header = document.getElementById('resumoFamiliarHeader');
      if (!header){
        header = document.createElement('div');
        header.id = 'resumoFamiliarHeader';
        header.innerHTML = '<div class="title"></div>';
        sec.insertBefore(header, sec.firstChild);
      }

      // Container dos tiles
      var tiles = document.getElementById('gastosTotalTiles');
      if (!tiles){
        tiles = document.createElement('div');
        tiles.id = 'gastosTotalTiles';
        header.insertAdjacentElement('afterend', tiles);
      } else {
        tiles.innerHTML = '';
      }

      // Cálculo
      var ym = S.month;
      var casaTot = computeCasaTotal(ym);
      var meiaCasa = casaTot/2;
      var split = computeSplitPessoas(ym);
      var totMar = meiaCasa + (Number(split.Marido)||0);
      var totEsp = meiaCasa + (Number(split.Esposa)||0);

      function makeTile(titulo, valor){
        var b = document.createElement('div'); b.className = 'sum-box';
        b.innerHTML = '<div class="muted">'+titulo+'</div><div class="sum-value">'+fmt(valor)+'</div>';
        return b;
      }
      tiles.appendChild(makeTile('Total Divisão de Despesas — Marido', totMar));
      tiles.appendChild(makeTile('Total Divisão de Despesas — Esposa', totEsp));
    } catch(e){ console.error('renderGastoTotalTiles:', e); }
  }
  window.renderGastoTotalTiles = renderGastoTotalTiles;

  // --- Integrar no pipeline existente ---
  var _renderGasto = window.renderGastoTotalPessoas;
  window.renderGastoTotalPessoas = function(){
    try { if (_renderGasto) _renderGasto(); } finally { try { renderGastoTotalTiles(); } catch(_) {} }
  };

  // Render inicial + eventos
  function boot(){
    try { renderGastoTotalTiles(); } catch(_) {}
    var monthSel = document.getElementById('monthSelect');
    if (monthSel && !monthSel._wiredGastoTotalTiles){
      monthSel.addEventListener('change', function(){ try { renderGastoTotalTiles(); } catch(_) {} });
      monthSel._wiredGastoTotalTiles = true;
    }
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab="carteiras"]')||[]);
    tabs.forEach(function(tab){
      if (tab._wiredGastoTotalTiles) return;
      tab.addEventListener('click', function(){ try { renderGastoTotalTiles(); } catch(_) {} });
      tab._wiredGastoTotalTiles = true;
    });
  }
  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();

/* === Compat alias to avoid ReferenceError === */
if (typeof getActiveRangeForYM !== 'function') {
  function getActiveRangeForYM(ym) {
    return (typeof getRange === 'function') ? getRange(ym) : { start: '', end: '' };
  }
}

/* === Compat global for ymdInRange used by top-level functions === */
if (typeof ymdInRange !== 'function') {
  function ymdInRange(ymd, start, end){
    var s = String(ymd||''); 
    return s >= String(start||'') && s <= String(end||'');
  }
}


function openNovoLanc() {
  document.getElementById("modalLanc").style.display = "flex";
  document.getElementById("mValorBig").value = "";
  document.getElementById("mDesc").value = "";
  document.getElementById("mObs").value = "";
  if (document.getElementById("mCategoria")) document.getElementById("mCategoria").selectedIndex = 0;
  if (document.getElementById("mPagamento")) document.getElementById("mPagamento").selectedIndex = 0;
  if (document.getElementById("mCarteira")) document.getElementById("mCarteira").selectedIndex = 0;
  document.getElementById("mRepetir").checked = false;
  if (document.getElementById("recurrenceFields")) document.getElementById("recurrenceFields").style.display = "none";
  document.getElementById("mData").valueAsDate = new Date();
  document.getElementById("modalTitle").textContent = "Nova Despesa";
  document.querySelectorAll("#tipoTabs button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === "Despesa");
  });
  window.modalTipo = "Despesa";
  if (typeof window.syncTipoTabs === "function") window.syncTipoTabs();
}
document.addEventListener("DOMContentLoaded", function(){
  var btnNovo = document.getElementById("btnNovo");
  if(btnNovo){ btnNovo.addEventListener("click", openNovoLanc); }
  var btnCancelar = document.getElementById("btnCancelar");
  if(btnCancelar){ btnCancelar.addEventListener("click", () => { document.getElementById("modalLanc").style.display = "none"; }); }
  var btnFecharModal = document.getElementById("btnFecharModal");
  if(btnFecharModal){ btnFecharModal.addEventListener("click", () => { document.getElementById("modalLanc").style.display = "none"; }); }
});



// === Force "+ Lançamentos → Novo" to open as 'Nova Despesa' exactly like the screenshot ===
(function ensureOpenNovoLanc(){
  function openNovoLanc(){
    try {
      if (typeof toggleModal === 'function') {
        // Use the internal opener which already resets fields, sets date, title, tabs, etc.
        toggleModal(true, "Nova Despesa");
      } else if (window.toggleModal) {
        window.toggleModal(true, "Nova Despesa");
      } else {
        // Fallback: minimal open if toggleModal isn't available
        var m = document.getElementById('modalLanc');
        if (m) m.style.display = 'flex';
        var ttl = document.getElementById('modalTitle');
        if (ttl) ttl.textContent = 'Nova Despesa';
        window.modalTipo = 'Despesa';
        if (typeof window.syncTipoTabs === 'function') window.syncTipoTabs();
        var vData = document.getElementById('mData'); if (vData) vData.valueAsDate = new Date();
        var v = document.getElementById('mValorBig'); if (v) v.value='';
        var d = document.getElementById('mDesc'); if (d) d.value='';
        var o = document.getElementById('mObs'); if (o) o.value='';
        var chk = document.getElementById('mRepetir'); if (chk) chk.checked = false;
        var box = document.getElementById('recurrenceFields'); if (box) box.style.display = 'none';
      }
    } catch(e){ console.error('openNovoLanc failed:', e); }
  }

  function wire(){
    var btn = document.getElementById('btnNovo');
    if (!btn || btn._wiredOpenNovoLanc) return;
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      openNovoLanc();
    });
    btn._wiredOpenNovoLanc = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();


// FAB wiring (robusto e idempotente)
(function(){
  if (window.__wiredFab) return;
  window.__wiredFab = true;
  function wireFab(){
    var fab = document.getElementById('btnNovoFab');
    if (!fab) return;
    fab.addEventListener('click', function(){
      if (typeof window.toggleModal === 'function') {
        window.toggleModal(true);
      } else {
        var btn = document.getElementById('btnNovo');
        if (btn) btn.click();
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireFab);
  } else {
    wireFab();
  }
})();




// === Campos fixos de vencimento/fechamento (sem modal) ===
(function setupCcFields(){
  function clampDay(v){
    v = Number(v);
    if (!isFinite(v)) return null;
    if (v < 1) v = 1;
    if (v > 31) v = 31;
    return v;
  }

  function fill(){
    try {
      const due = document.getElementById('ccDueDay');
      const clo = document.getElementById('ccClosingDay');
      if (!window.S) return;
      if (due) due.value = (S.ccDueDay ?? '') || '';
      if (clo) clo.value = (S.ccClosingDay ?? '') || '';
    } catch(_) {}
  }

  function onChange(){
    try {
      const due = document.getElementById('ccDueDay');
      const clo = document.getElementById('ccClosingDay');
      if (!window.S) return;
      S.ccDueDay = clampDay(due?.value);
      const cv = clampDay(clo?.value);
      S.ccClosingDay = (cv === null || cv === undefined) ? null : cv;
      if (typeof savePrefs === 'function') savePrefs();
    } catch(_) {}
  }

  // Fill early and wire events
  document.addEventListener('DOMContentLoaded', function(){
    fill();
    ['ccDueDay','ccClosingDay'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._wiredSave) {
        el.addEventListener('change', onChange);
        el._wiredSave = true;
      }
    });
  });

  // Refill after data finishes loading
  (function hookLoadAll(){
    try {
      if (typeof window.loadAll === 'function' && !window.loadAll._ccHooked) {
        const old = window.loadAll;
        window.loadAll = async function(){
          const r = await old.apply(this, arguments);
          try { fill(); } catch(_) {}
          return r;
        };
        window.loadAll._ccHooked = true;
      }
    } catch(_) {}
  })();

  // Expose fill if needed elsewhere
  try { window.fillCcFixedFields = fill; } catch(_) {}
})();


/* === [REC] Lista no Config → Transações recorrentes (fetch direto do Supabase) === */
(function(){
  function fmtBRL(v){ try { return (Number(v)||0).toLocaleString(undefined,{style:'currency',currency:'BRL'}); } catch(_) { return v; } }
  function iso(d){ try { return d ? new Date(d).toLocaleDateString() : '-'; } catch(_) { return d||'-'; } }

  async function fetchRecs(){
    if (!window.supabaseClient?.from) { console.warn('[rec] supabaseClient indisponível'); return []; }
    const { data, error } = await supabaseClient
      .from('recurrences')
      .select('*')
      .order('id', { ascending: false });
    if (error) { console.error('[rec] fetch error', error); return []; }
    return Array.isArray(data) ? data : [];
  }

  function ensureToolbar(ul){
    if (!ul) return;
    if (document.getElementById('btn-reclist-refresh')) return;
    const parent = ul.parentElement || ul;
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:6px 0 8px;';
    bar.innerHTML = '<button id="btn-reclist-refresh" class="btn btn-light" type="button">Recarregar</button>';
    parent.insertBefore(bar, ul);
    document.getElementById('btn-reclist-refresh').addEventListener('click', async ()=>{
      await renderRecListDirect(true);
    });
  }

  async function renderRecListDirect(force=false){
    const ul = document.getElementById('listaRecorrentes');
    if (!ul) return;
    ensureToolbar(ul);
    ul.innerHTML = '<li style="opacity:.7">Carregando recorrências...</li>';
    const recs = await fetchRecs();
    if (!recs.length) { ul.innerHTML = '<li style="opacity:.7">Nenhuma recorrência cadastrada ainda.</li>'; return; }
    ul.innerHTML = recs.map(r => {
      const tagAtivo = r.ativo ? '<span class="tag success">Ativa</span>' : '<span class="tag">Pausada</span>';
      return `<li class="rec-item" data-id="${r.id}">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div style="min-width:240px">
            <div><strong>${r.descricao || '(sem descrição)'}</strong></div>
            <div style="font-size:12px;opacity:.8">${r.categoria || '-'} • ${r.periodicidade || '-'} • Próx: ${iso(r.proxima_data)} • Valor: ${fmtBRL(r.valor)}</div>
          </div>
          <div class="rec-actions">
            ${tagAtivo}
            <button class="btn btn-light" data-action="rec-apply">Aplicar agora</button>
            <button class="btn btn-light" data-action="rec-toggle">${r.ativo ? 'Pausar' : 'Retomar'}</button>
            <button class="btn btn-danger" data-action="rec-del">Excluir</button>
          </div>
        </div>
      </li>`;
    }).join('');
  }

  function bindRecListDirect(){
    const ul = document.getElementById('listaRecorrentes');
    if (!ul || ul.__recBoundDirect) return;
    ul.__recBoundDirect = true;
    ul.addEventListener('click', async (ev) => {
      const li = ev.target.closest('.rec-item'); if (!li) return;
      const id = li.dataset.id;
      const action = ev.target.getAttribute('data-action');
      try {
        if (action === 'rec-apply' && window.applyRecurrences) {
          await applyRecurrences(); await renderRecListDirect(true);
        }
        if (action === 'rec-toggle') {
          const willActivate = ev.target.textContent.includes('Retomar');
          const { error } = await supabaseClient.from('recurrences').update({ ativo: willActivate }).eq('id', id);
          if (error) { alert('Erro ao atualizar'); console.error(error); }
          await renderRecListDirect(true);
        }
        if (action === 'rec-del') {
          if (!confirm('Excluir esta recorrência?')) return;
          const { error } = await supabaseClient.from('recurrences').delete().eq('id', id);
          if (error) { alert('Erro ao excluir'); console.error(error); }
          await renderRecListDirect(true);
        }
      } catch(e){ console.error('[rec] ação falhou', e); alert('Algo deu errado.'); }
    });
  }

  // Render inicial e quando a aba Config for ativada
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ renderRecListDirect(); bindRecListDirect(); });
  } else {
    renderRecListDirect(); bindRecListDirect();
  }
  document.addEventListener('click', (e)=>{
    const tab = e.target.closest('[href="#config"], [data-target="#config"], [data-tab="#config"], [data-tab="config"]');
    if (tab) setTimeout(()=> renderRecListDirect(true), 50);
  });

  window.renderRecListDirect = renderRecListDirect;
})();


/* === Patch: aplicar blur nas metas quando "Esconder valores" estiver ativo === */
(function(){
  // Classe usada pelo app para esconder números
  var BLUR_CLASS = 'blurred';

  function isCurrencyLike(text){
    if (!text) return false;
    // Detecta formatos como "R$ 1.234,56" ou números com vírgula
    return /R\$\s*\d|\d{1,3}(\.\d{3})*,\d{2}/.test(String(text));
  }

  function markInside(container){
    if (!container) return;
    // Candidatos comuns nas metas
    var candidates = container.querySelectorAll([
      '.meta-valor',
      '.metaValor',
      '.meta-progress',
      '.valorMeta',
      '.total-meta',
      '.kpi-meta',
      '[data-meta-valor]',
      '[data-valor]',
      '.valor'
    ].join(','));
    // Se nenhum seletor conhecido for encontrado, faz uma varredura leve por textos com formato de moeda
    if (!candidates.length) {
      candidates = container.querySelectorAll('*');
    }
    candidates.forEach(function(el){
      try {
        var text = (el.textContent || '').trim();
        if (!text) return;
        if (el.matches('.valor, .meta-valor, .metaValor, .valorMeta, [data-meta-valor], [data-valor]') || isCurrencyLike(text)){
          el.classList.toggle(BLUR_CLASS, !!(window.S && window.S.hide));
        }
      } catch(_){}
    });
  }

  function applyHideMode(){
    try {
      var hide = !!(window.S && window.S.hide);
      // Containers prováveis da área de metas
      var containers = [
        document.getElementById('metas'),
        document.getElementById('metasGrid'),
        document.getElementById('metasResumo'),
        document.getElementById('metasBox'),
        document.querySelector('section#metas'),
        document.querySelector('[data-section="metas"]')
      ].filter(Boolean);

      // Se não achar, tenta a página toda (limitado para evitar custo alto)
      if (!containers.length) containers = [document.body];

      containers.forEach(function(c){
        markInside(c);
      });

      // Também mantém o comportamento para KPIs existentes (não interfere no que já funciona)
      ['#kpiReceitas','#kpiDespesas','#kpiSaldo','#kpiReceitasDelta','#kpiDespesasDelta','#kpiSaldoDelta']
        .forEach(function(sel){
          var el = document.querySelector(sel);
          if (el) el.classList.toggle(BLUR_CLASS, hide);
        });
    } catch(e){
      try { console.error('applyHideMode:', e); } catch(_){}
    }
  }

  // Expõe globalmente para uso manual se necessário
  try { window.applyHideMode = applyHideMode; } catch(_){}

  // Envelopa render() para aplicar blur após cada renderização, sem alterar outras lógicas
  try {
    if (typeof window.render === 'function' && !window.render.__wrapHideApplied){
      var __origRender = window.render;
      window.render = function(){
        var ret = __origRender.apply(this, arguments);
        try { applyHideMode(); } catch(_){}
        return ret;
      };
      window.render.__wrapHideApplied = true;
    }
  } catch(_){}

  // Envelopa fetchMetas() (se existir) para garantir blur após popular metas
  try {
    if (typeof window.fetchMetas === 'function' && !window.fetchMetas.__wrapHideApplied){
      var __origFetchMetas = window.fetchMetas;
      window.fetchMetas = async function(){
        var ret = await __origFetchMetas.apply(this, arguments);
        try { applyHideMode(); } catch(_){}
        return ret;
      };
      window.fetchMetas.__wrapHideApplied = true;
    }
  } catch(_){}

  // Chamada inicial (caso a página inicialize com S.hide=true)
  try { applyHideMode(); } catch(_){}
})();
/* === Fim do patch === */


/* === Patch v2: foco direto nos elementos de metas === */
(function(){
  function blurMetaIds(){
    var hide = !!(window.S && window.S.hide);
    ['#metaTotalLabel','#metaGastoMes'].forEach(function(sel){
      var el = document.querySelector(sel);
      if (el) el.classList.toggle('blurred', hide);
    });
    // Também tenta valores por categoria na tabela de metas, se existirem
    var tbl = document.querySelector('#tblMetasCat');
    if (tbl){
      tbl.querySelectorAll('td, input').forEach(function(el){
        // Se for input de valor, aplica blur no container pai
        var node = el;
        if (el.tagName === 'INPUT') node = el.parentElement || el;
        if (node) node.classList.toggle('blurred', hide);
      });
    }
  }
  // Observa mudanças de texto nesses nós para reaplicar blur
  try {
    var targets = ['metaTotalLabel','metaGastoMes'].map(function(id){ return document.getElementById(id); }).filter(Boolean);
    var mo = new MutationObserver(function(){ blurMetaIds(); });
    targets.forEach(function(t){ mo.observe(t, { childList: true, characterData: true, subtree: true }); });
  } catch(_){}
  // Chamada inicial e ligação ao applyHideMode se existir
  blurMetaIds();
  if (typeof window.applyHideMode === 'function'){
    var old = window.applyHideMode;
    window.applyHideMode = function(){ old(); blurMetaIds(); };
  }
})();
/* === Fim do Patch v2 === */


// [ADD] Delegated handler as fallback in case #btnGoMetas wiring didn't attach
(function(){
  if (!window.__wiredDelegatedMetas) {
    document.addEventListener('click', function(ev){
      var t = ev.target;
      if (t && (t.id === 'btnGoMetas' || (t.closest && t.closest('#btnGoMetas')))) {
        var modal = document.getElementById('modalMetas');
        if (modal) {
          try { if (typeof renderMetasAcompanhamento === 'function') renderMetasAcompanhamento(); } catch(_) {}
          modal.style.display = 'flex';
          document.body.classList.add('modal-open');
          ev.preventDefault();
        }
      }
      if (t && (t.id === 'btnFecharMetas' || (t.closest && t.closest('#btnFecharMetas')))) {
        var modal2 = document.getElementById('modalMetas');
        if (modal2) {
          modal2.style.display = 'none';
          document.body.classList.remove('modal-open');
          ev.preventDefault();
        }
      }
    });
    window.__wiredDelegatedMetas = true;
  }
})();

// === [ADD] Modal de Metas: acompanhamento dentro de Metas ===
// Bloco independente: calcula e exibe o uso das metas (total e por categoria) no modal.
(function(){
  function gastoDaCategoriaNoMes(cat) {
    try {
      const ym = (window.S && S.month) ? String(S.month) : new Date().toISOString().slice(0,7);
      return (S.tx || [])
        .filter(x => x && x.tipo === 'Despesa' && x.categoria === cat && String(x.data||'').startsWith(ym))
        .reduce((acc, x) => acc + (Number(x.valor)||0), 0);
    } catch(_) { return 0; }
  }
  function fmtPct(n){ return isFinite(n) ? Math.round(n) + '%' : '0%'; }

async function renderMetasAcompanhamento(){
  try {
    if (typeof fetchMetas === 'function') {
      const hasAny = S && S.metas && (Number(S.metas.total)||0) > 0 || (S.metas && S.metas.porCat && Object.keys(S.metas.porCat).length > 0);
      if (!hasAny) { try { await fetchMetas(); } catch(_) {} }
    }

    const metaTotal = Number((S && S.metas && S.metas.total) || 0);
    const ym = (S && S.month) ? String(S.month) : new Date().toISOString().slice(0,7);
    const gastoMes = (S && S.tx ? S.tx : [])
      .filter(x => x && x.tipo === 'Despesa' && String(x.data||'').startsWith(ym))
      .reduce((acc, x) => acc + (Number(x.valor)||0), 0);

    var elMetaTotal = document.getElementById('mMetaTotal');
    var elGastoMes  = document.getElementById('mGastoMes');
    var elStatus    = document.getElementById('mStatusChip');
    var elBar       = document.getElementById('mProgBar');

    if (typeof fmtMoney !== 'function') {
      window.fmtMoney = function(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); };
    }

    if (elMetaTotal) elMetaTotal.textContent = fmtMoneyLocal(metaTotal);
    if (elGastoMes)  elGastoMes.textContent  = fmtMoneyLocal(gastoMes);

    var pctTotal = 0;
    var statusTotal = 'Sem meta definida';
    var statusClass = 'chip';

    if (metaTotal > 0) {
      pctTotal = Math.min((gastoMes / metaTotal) * 100, 100);
      statusTotal = gastoMes <= metaTotal ? 'Dentro da meta' : 'Estouro';
      statusClass = 'chip ' + (gastoMes <= metaTotal ? '' : 'warn');
    }

    if (elBar) elBar.style.width = pctTotal + '%';

    if (elStatus) {
      elStatus.textContent = statusTotal;
      elStatus.className = statusClass;
    }

    var ul = document.getElementById('mListaMetasCat');
    if (!ul) return;
    ul.innerHTML = '';

    var metas = (S && S.metas && S.metas.porCat) ? S.metas.porCat : {};
    var entries = Object.entries(metas);

    if (!entries.length) {
      var li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = '<div class="muted">Nenhuma meta por categoria definida.</div>';
      ul.append(li);
      return;
    }

    entries.forEach(function(pair){
      var cat = pair[0];
      var meta = pair[1];
      var metaNum = Number(meta || 0);
      var gasto   = gastoDaCategoriaNoMes(cat);

      var pct = 0;
      var statusText = 'Sem meta definida';
      var barColor = 'var(--border)';

      if (metaNum > 0) {
        pct = Math.min((gasto / metaNum) * 100, 100);
        statusText = gasto <= metaNum ? 'Dentro da meta' : 'Estouro';
        barColor = gasto <= metaNum ? 'var(--brand)' : 'var(--warn)';
      }

      var li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = ''
        + '<div class="chip">'+cat+'</div>'
        + '<div class="subinfo">Meta: <strong>'+fmtMoneyLocal(metaNum)+'</strong></div>'
        + '<div class="valor">Gasto: '+fmtMoneyLocal(gasto)+'</div>'
        + '<div class="progress" style="height:8px;border:1px solid var(--border);border-radius:999px;overflow:hidden;margin-top:6px">'
        +   '<div style="width:'+pct+'%;height:100%;background:'+barColor+'"></div>'
        + '</div>'
        + '<div class="muted" style="margin-top:6px">Uso: <strong>'+(metaNum > 0 ? Math.round(pct)+'%' : '—')+'</strong> • Status: <strong>'+statusText+'</strong></div>';
      ul.append(li);
    });
  } catch(e){ console.error(e); }
}

  function setupMetasModal(){
    var openBtn = document.getElementById('btnGoMetas');
    var modal   = document.getElementById('modalMetas');
    var closeBtn= document.getElementById('btnFecharMetas');
    if (!modal) return;

    if (openBtn && !openBtn._wiredMetas) {
      openBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        try { renderMetasAcompanhamento(); } catch(_) {}
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
      });
      openBtn._wiredMetas = true;
    }
    if (closeBtn && !closeBtn._wiredMetasClose) {
      closeBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
      });
      closeBtn._wiredMetasClose = true;
    }
    if (!document._wiredEscCloseMetas) {
      document.addEventListener('keydown', function(ev){
        if (ev.key === 'Escape' && modal && modal.style.display === 'flex') {
          modal.style.display = 'none';
          document.body.classList.remove('modal-open');
        }
      });
      document._wiredEscCloseMetas = true;
    }
  }

  window.addEventListener('load', function(){ try { setupMetasModal(); } catch(_) {} });
  try { window.renderMetasAcompanhamento = renderMetasAcompanhamento; } catch(_){}
})();


// === Heatmap de despesas (mês atual) ===
(function(){
  function renderHeatmap(){
    try {
      var el = document.getElementById('heatmap2');
      if (!el) return;

      // limpa
      el.innerHTML = '';

      // precisa de S.month e S.tx
      if (!window.S || !S.month || !Array.isArray(S.tx)) {
        el.textContent = 'Sem dados';
        return;
      }

      // filtra despesas do mês ativo (YYYY-MM)
      var ym = String(S.month);
      var txs = (S.tx || []).filter(function(x){
        return x && x.tipo === 'Despesa' && x.data && String(x.data).startsWith(ym);
      });

      if (!txs.length) { el.textContent = 'Sem dados'; return; }

      // soma por dia
      var daily = Object.create(null);
      var max = 0;
      txs.forEach(function(t){
        var k = String(t.data).slice(0,10);
        var v = Number(t.valor)||0;
        daily[k] = (daily[k]||0) + v;
        if (daily[k] > max) max = daily[k];
      });

      // total de dias no mês
      var y = Number(ym.slice(0,4));
      var m = Number(ym.slice(5,7));
      var daysInMonth = new Date(y, m, 0).getDate();

      for (var i=1; i<=daysInMonth; i++){
        var day = String(i).padStart(2,'0');
        var key = ym + '-' + day;
        var val = daily[key] || 0;

        // nível 0..4 baseado no valor relativo ao máximo
        var lvl = 0;
        if (max > 0){
          var pct = val / max;
          if (pct > 0    && pct <= 0.25) lvl = 1;
          else if (pct <= 0.50) lvl = 2;
          else if (pct <= 0.75) lvl = 3;
          else if (pct  > 0.75) lvl = 4;
        }

        var div = document.createElement('div');
        div.className = 'heat-cell';
        div.dataset.level = String(lvl);
        div.textContent = i;
        div.title = day + '/' + String(m).padStart(2,'0') + '/' + y + ' — ' + (Number(val)||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
        el.appendChild(div);
      }
    } catch (e) {
      try { console.error('Falha ao renderizar heatmap:', e); } catch(_){}
      var el2 = document.getElementById('heatmap2');
      if (el2) el2.textContent = 'Sem dados';
    }
  }

  // expõe de forma segura
  try { window.renderHeatmap = renderHeatmap; } catch(_){}

  // tenta desenhar quando os dados estiverem prontos (pós-loadAll)
  function tryRenderHeatmapWhenReady(){
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      if (window.S && Array.isArray(S.tx)) {
        try { renderHeatmap(); } catch(_){}
        clearInterval(timer);
      }
      if (tries > 30) clearInterval(timer);
    }, 200);
  }

  // 1) primeira carga
  tryRenderHeatmapWhenReady();

  // 2) ao trocar o mês
  try {
    var monthSel = document.getElementById('monthSelect');
    if (monthSel && !monthSel._wiredHeatmap){
      monthSel.addEventListener('change', function(){ try { renderHeatmap(); } catch(_){ } });
      monthSel._wiredHeatmap = true;
    }
  } catch(_){}

  // 3) quando navegar para a aba Relatórios (se já houver uma navegação por tabs)
  try {
    document.addEventListener('click', function(ev){
      var t = ev.target.closest('.tab, .rtab');
      if (!t) return;
      var tab = t.dataset.tab || t.dataset.rtab || '';
      if (tab === 'relatorios' || tab === 'heatmap') {
        setTimeout(function(){ try { renderHeatmap(); } catch(_){ } }, 50);
      }
    });
  } catch(_){}
})();

// Sugestões de descrição

function fillDescricaoSugestoes(){
  const dl = document.getElementById("descSugestoes");
  if(!dl) return;
  const freq = {};
  (S.tx||[]).forEach(x=>{
    if(!x.descricao) return;
    freq[x.descricao] = (freq[x.descricao]||0)+1;
  });
  const uniques = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,50);
  dl.innerHTML = "";
  uniques.forEach(desc=>{
    const opt=document.createElement("option");
    opt.value=desc;
    dl.appendChild(opt);
  });
}

// =======================
// PATCHES CRÍTICOS APLICADOS
// =======================

// --- Normalização unificada ---
function normalizeFormaPagamento(fp) {
  if (!fp) return "outros";
  fp = fp.toString().trim().toLowerCase();
  const map = {
    "crédito": "credito",
    "crédito parcelado": "credito",
    "cartão": "cartao",
    "cartao": "cartao",
    "débito": "debito",
    "debito": "debito",
    "pix": "pix",
    "dinheiro": "dinheiro",
    "boleto": "outros",
    "transferência": "outros",
    "transferencia": "outros"
  };
  fp = map[fp] || fp;
  if (fp === "credito" || fp === "debito") return "cartao";
  if (["pix","dinheiro","cartao","outros"].includes(fp)) return fp;
  return "outros";
}

// --- addOrUpdate protegido contra sobrescrita ---
let __savingAddOrUpdate = false;
async function addOrUpdate(keepOpen=false) {
  if (__savingAddOrUpdate) return;
  __savingAddOrUpdate = true;
  try {
    const selPag = qs('#mPagamento');
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

    if (modalTipo === "Transferência") {
      if (selPag) selPag.disabled = true;
      t.carteira = null;
      t.carteira_origem  = (qs("#mOrigem")?.value || "Casa");
      t.carteira_destino = (qs("#mDestino")?.value || "Marido");
      t.forma_pagamento = null;
    } else {
      if (selPag) selPag.disabled = false;
      t.carteira = (qs("#mCarteira")?.value || "Casa");
      t.carteira_origem = null;
      t.carteira_destino = null;
      t.forma_pagamento = normalizeFormaPagamento(qs("#mPagamento")?.value);
    }
    
    const chkParcelado = qs("#mParcelado");
    const totalParcelas = (modalTipo === "Despesa" && chkParcelado && chkParcelado.checked)
      ? (Number(qs("#mTotalParcelas")?.value) || 1)
      : 1;

    const chkRepetir = qs("#mRepetir");
    if (!chkRepetir?.checked) {
      // ===== SALVAR (parcelado ou normal) =====
      if (totalParcelas > 1 && modalTipo === "Despesa") {
        const pid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        let dataBase = t.data;
        const valorParcela = t.valor / totalParcelas;
        for (let i = 1; i <= totalParcelas; i++) {
          const txp = { ...t };
          txp.id = gid();
          txp.valor = Number(valorParcela.toFixed(2));
          txp.parcela_atual = i;
          txp.total_parcelas = totalParcelas;
          txp.parcelamento_id = pid;
          txp.data = (i === 1) ? dataBase : incMonthly(dataBase, new Date(dataBase).getDate(), true);
          dataBase = txp.data;
          await saveTx(txp);
        }
      } else {
        await saveTx(t);
      }

      await loadAll();
      if (!keepOpen) toggleModal(false);
      return;
    }
  } finally {
    __savingAddOrUpdate = false;
  }
}
window.addOrUpdate = addOrUpdate;

// --- Heatmap único ---
function renderHeatmap(){
  const wrap = document.getElementById('heatmap');
  if (!wrap) return;
  const ym = S.month;
  const days = monthDays(ym);
  const gastosPorDia = Array.from({length: days}, ()=>0);
  (S.tx || []).forEach(x=>{
    if (!x.data || x.tipo!=="Despesa") return;
    if (!String(x.data).startsWith(ym)) return;
    const d = Number(String(x.data).slice(8,10));
    gastosPorDia[d-1] += Number(x.valor)||0;
  });
  const max = Math.max(...gastosPorDia, 0);
  wrap.innerHTML = '';
  for (let d=1; d<=days; d++){
    const v = gastosPorDia[d-1];
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = d;
    if (v>0){
      const intensity = max ? v/max : 0;
      cell.style.background = `hsl(0,85%,${90 - 50*intensity}%)`;
      cell.title = `${String(d).padStart(2,'0')}/${ym.slice(5,7)}: ${fmtMoneyLocal(v)}`;
    }
    wrap.appendChild(cell);
  }
}

// === Parcelado vs Recorrência (exclusão mútua) ===
document.addEventListener('change', function(e){
  if(e.target && e.target.id === 'mParcelado'){
    const rep = document.getElementById('mRepetir');
    if (rep && e.target.checked) rep.checked = false;
    const box = document.getElementById('recurrenceFields');
    if (box) box.style.display = 'none';
    const f = document.getElementById('fieldParcelas');
    if (f) f.style.display = e.target.checked ? '' : 'none';
  }
  if(e.target && e.target.id === 'mRepetir'){
    const parc = document.getElementById('mParcelado');
    if (parc && e.target.checked) parc.checked = false;
    const f = document.getElementById('fieldParcelas');
    if (f) f.style.display = 'none';
  }
});



// === GUARD: Parcelado vs Repetir (não permitir ambos ativos) ===
function syncParceladoVsRepetirLocks() {
  const chkParcelado = document.querySelector("#mParcelado");
  const chkRepetir   = document.querySelector("#mRepetir");
  if (!chkParcelado || !chkRepetir) return;
  chkRepetir.disabled   = chkParcelado.checked;
  chkParcelado.disabled = chkRepetir.checked;
}

function setupParceladoVsRepetirGuard() {
  const chkParcelado = document.querySelector("#mParcelado");
  const chkRepetir   = document.querySelector("#mRepetir");
  if (!chkParcelado || !chkRepetir) return;
  chkParcelado.addEventListener("change", syncParceladoVsRepetirLocks);
  chkRepetir.addEventListener("change", syncParceladoVsRepetirLocks);
  syncParceladoVsRepetirLocks();
}

// Hook no toggleModal para aplicar sempre que abrir
if (typeof toggleModal === "function") {
  const __origToggleModal = toggleModal;
  toggleModal = function(show, titleOverride) {
    __origToggleModal(show, titleOverride);
    if (show) {
      setupParceladoVsRepetirGuard();
      syncParceladoVsRepetirLocks();
    }
  }
}


// === PATCH: salvar metas por categoria corretamente ===
(function(){
  if (window.__patchSaveMetasCat) return;
  window.__patchSaveMetasCat = true;

  function collectMetasPorCategoria(){
    const obj = {};
    document.querySelectorAll('[data-meta-categoria]').forEach(inp=>{
      const cat = inp.getAttribute('data-meta-categoria');
      const v = Number(inp.value);
      if (cat && isFinite(v) && v > 0) obj[cat] = v;
    });
    return obj;
  }

  if (typeof window.saveMetas === 'function'){
    const oldSave = window.saveMetas;
    window.saveMetas = async function(payload){
      payload = payload || {};
      payload.porCat = collectMetasPorCategoria();
      return oldSave(payload);
    };
  }
})();
// ================================
// ASSISTENTE FINANCEIRO - VERSÃO 2
// ================================

function fmtMoneyLocal(v){
  const n = Number(v);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
}

function totalPorCategoriaMes(categoria, mes) {
  return S.tx.filter(t =>
    t.tipo === "Despesa" &&
    t.categoria.toLowerCase() === categoria.toLowerCase() &&
    t.data.startsWith(mes)
  ).reduce((s, t) => s + t.valor, 0);
}

function totalDespesasMes(mes) {
  return S.tx.filter(t => t.tipo === "Despesa" && t.data.startsWith(mes))
    .reduce((s, t) => s + t.valor, 0);
}

function totalReceitasMes(mes) {
  return S.tx.filter(t => t.tipo === "Receita" && t.data.startsWith(mes))
    .reduce((s, t) => s + t.valor, 0);
}

function saldoMes(mes) {
  return totalReceitasMes(mes) - totalDespesasMes(mes);
}

function getMesFromTexto(q){
  const meses = {
    janeiro: "01", fevereiro: "02", marco: "03", março:"03", abril:"04",
    maio:"05", junho:"06", julho:"07", agosto:"08", setembro:"09",
    outubro:"10", novembro:"11", dezembro:"12"
  };

  for (const m in meses){
    if(q.includes(m)){
      return S.month.slice(0,4)+"-"+meses[m];
    }
  }

  if(q.includes("mes passado") || q.includes("mês passado")){
    const [y,m]=S.month.split("-").map(Number);
    const d=new Date(y,m-2,1);
    return d.toISOString().slice(0,7);
  }

  return S.month;
}

function topCategorias(mes){
  const map={};
  S.tx.filter(t=>t.tipo==="Despesa" && t.data.startsWith(mes)).forEach(t=>{
    map[t.categoria]=(map[t.categoria]||0)+t.valor;
  });

  return Object.entries(map)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)
    .map(a=>`${a[0]} (${fmtMoneyLocal(a[1])})`)
    .join(", ");
}

function preverCategoria(cat,mes){
  const hoje=new Date();
  const diasPassados=hoje.getDate();
  const totalDias=new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate();
  const total=totalPorCategoriaMes(cat,mes);
  return (total/diasPassados)*totalDias;
}

function responderPergunta(texto) {
  if (!texto) return "Faça uma pergunta 🙂";
  const q = texto.toLowerCase();
  const mes = getMesFromTexto(q);

  if (q.includes("top")) {
    return "Top categorias: " + topCategorias(mes);
  }

  if (q.includes("previsao") || q.includes("previsão")) {
    for (const c of S.cats) {
      if (q.includes(c.nome.toLowerCase())) {
        return `No ritmo atual, você vai gastar ${fmtMoneyLocal(preverCategoria(c.nome,mes))} em ${c.nome}.`;
      }
    }
    return "Diga a categoria para prever (ex: previsão mercado).";
  }

  if (q.includes("saldo"))
    return `Seu saldo é ${fmtMoneyLocal(saldoMes(mes))}.`;

  if (q.includes("despesa"))
    return `Você gastou ${fmtMoneyLocal(totalDespesasMes(mes))} em despesas.`;

  if (q.includes("receita"))
    return `Você recebeu ${fmtMoneyLocal(totalReceitasMes(mes))}.`;

  for (const c of S.cats) {
    if (q.includes(c.nome.toLowerCase())) {
      return `Você gastou ${fmtMoneyLocal(totalPorCategoriaMes(c.nome, mes))} em ${c.nome}.`;
    }
  }

  return "Exemplos: 'top categorias', 'previsão mercado', 'quanto gastei em mercado mês passado'.";
}

// Botão do assistente
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("assistBtn");
  const input = document.getElementById("assistInput");
  const resp = document.getElementById("assistResposta");

  if (!btn || !input || !resp) return;

  btn.addEventListener("click", () => {
    resp.textContent = responderPergunta(input.value);
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") btn.click();
  });
});


// ================================
// ASSISTENTE FINANCEIRO - EXPANDIDO
// ================================

function responderPergunta(texto) {
  if (!texto) return "Faça uma pergunta 🙂";
  const q = texto.toLowerCase();
  const mes = getMesFromTexto(q);

  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());

  function totalPeriodo(fn){
    return S.tx.filter(fn).reduce((a,b)=>a+Number(b.valor||0),0);
  }

  // ===== RESUMOS =====
  if (q.includes("resumo da semana")) {
    return `Você gastou ${fmtMoneyLocal(
      totalPeriodo(t=>t.tipo==="Despesa" && new Date(t.data)>=inicioSemana)
    )} nesta semana.`;
  }

  if (q.includes("resumo do ano")) {
    const ano = mes.slice(0,4);
    return `Você gastou ${fmtMoneyLocal(
      totalPeriodo(t=>t.tipo==="Despesa" && t.data.startsWith(ano))
    )} neste ano.`;
  }

  if (q.includes("resumo")) return resumoMes(mes);

  // ===== HOJE / ONTEM =====
  if (q.includes("hoje")) {
    const d = hoje.toISOString().slice(0,10);
    return `Hoje você gastou ${fmtMoneyLocal(
      totalPeriodo(t=>t.tipo==="Despesa" && t.data===d)
    )}.`;
  }

  if (q.includes("ontem")) {
    const d = ontem.toISOString().slice(0,10);
    return `Ontem você gastou ${fmtMoneyLocal(
      totalPeriodo(t=>t.tipo==="Despesa" && t.data===d)
    )}.`;
  }

  // ===== FORMAS DE PAGAMENTO =====
  if (q.includes("pix")) {
    return `Você gastou ${fmtMoneyLocal(
      totalPeriodo(t=>t.pagamento==="Pix")
    )} usando Pix.`;
  }

  if (q.includes("cartão") || q.includes("credito") || q.includes("crédito")) {
    return `Você gastou ${fmtMoneyLocal(
      totalPeriodo(t=>t.pagamento && t.pagamento.toLowerCase().includes("cart"))
    )} no cartão.`;
  }

  // ===== TOP N =====
  if (q.includes("top")) {
    const n = parseInt(q.match(/\d+/)) || 3;
    const map = {};
    S.tx.filter(t=>t.tipo==="Despesa" && t.data.startsWith(mes)).forEach(t=>{
      map[t.categoria]=(map[t.categoria]||0)+t.valor;
    });
    return Object.entries(map)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,n)
      .map((a,i)=>`${i+1}. ${a[0]} (${fmtMoneyLocal(a[1])})`)
      .join("<br>");
  }

  // ===== COMPARAÇÃO ENTRE CATEGORIAS =====
  if (q.includes("compare")) {
    const cats = S.cats.filter(c=>q.includes(c.nome.toLowerCase()));
    if (cats.length===2){
      const v1 = totalPorCategoriaMes(cats[0].nome, mes);
      const v2 = totalPorCategoriaMes(cats[1].nome, mes);
      return `${cats[0].nome}: ${fmtMoneyLocal(v1)}<br>${cats[1].nome}: ${fmtMoneyLocal(v2)}`;
    }
  }

  // ===== TENDÊNCIA =====
  if (q.includes("estou gastando") || q.includes("aumentou")) {
    const [y,m] = mes.split("-").map(Number);
    const mesPassado = new Date(y,m-2,1).toISOString().slice(0,7);
    const atual = totalDespesasMes(mes);
    const anterior = totalDespesasMes(mesPassado);
    if (atual > anterior) return "Sim, você está gastando mais que mês passado.";
    if (atual < anterior) return "Você está gastando menos que mês passado.";
    return "Seu gasto está igual ao mês passado.";
  }

  // ===== CATEGORIA DIRETA =====
  for (const c of S.cats) {
    if (q.includes(c.nome.toLowerCase())) {
      return `Você gastou ${fmtMoneyLocal(totalPorCategoriaMes(c.nome, mes))} em ${c.nome}.`;
    }
  }

  if (q.includes("saldo")) return `Seu saldo é ${fmtMoneyLocal(saldoMes(mes))}.`;
  if (q.includes("despesa")) return `Você gastou ${fmtMoneyLocal(totalDespesasMes(mes))} em despesas.`;
  if (q.includes("receita")) return `Você recebeu ${fmtMoneyLocal(totalReceitasMes(mes))}.`;

  return "Não entendi 😅 Tente: 'resumo do mês', 'top 5 categorias', 'quanto gastei hoje'.";
}


// ================================
// MODAL DO ASSISTENTE (ABRIR/FECHAR + CHAT)
// ================================
document.addEventListener("DOMContentLoaded", () => {
  const fab = document.getElementById("assistFab");
  const modal = document.getElementById("assistModal");
  const close = document.getElementById("assistClose");

  const btn = document.getElementById("assistBtn");
  const input = document.getElementById("assistInput");
  const chat = document.getElementById("assistChat");

  if (fab && modal && close) {
    fab.addEventListener("click", () => {
      modal.style.display = "flex";
    });
    close.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  if (!btn || !input || !chat) return;

  function addMsg(txt, tipo){
    const div = document.createElement("div");
    div.style.marginBottom = "6px";
    div.innerHTML = tipo==="user"
      ? `<strong>Você:</strong> ${txt}`
      : `<strong>Assistente:</strong> ${txt}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  btn.addEventListener("click", () => {
    const texto = input.value;
    if (!texto) return;
    addMsg(texto, "user");
    const resposta = responderPergunta(texto);
    addMsg(resposta, "bot");
    input.value = "";
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") btn.click();
  });
});


// ================================
// ASSISTENTE FINANCEIRO - INTELIGENTE
// ================================

function mediaUltimosMeses(cat, n=3){
  const meses = [...new Set(S.tx.map(t=>t.data.slice(0,7)))].sort().slice(-n);
  let total = 0;
  meses.forEach(m=>{
    total += totalPorCategoriaMes(cat,m);
  });
  return total / meses.length;
}

function categoriaPior(mes){
  const [y,m] = mes.split("-").map(Number);
  const mesPassado = new Date(y,m-2,1).toISOString().slice(0,7);
  let pior = null;
  let diffMax = 0;

  S.cats.forEach(c=>{
    const atual = totalPorCategoriaMes(c.nome, mes);
    const ant = totalPorCategoriaMes(c.nome, mesPassado);
    const diff = atual - ant;
    if (diff > diffMax){
      diffMax = diff;
      pior = {nome:c.nome, diff};
    }
  });

  return pior;
}

function responderPergunta(texto) {
  if (!texto) return "Faça uma pergunta 🙂";
  const q = texto.toLowerCase();
  const mes = getMesFromTexto(q);

  // desperdício
  if (q.includes("desperdi") || q.includes("onde to gastando demais") || q.includes("onde estou gastando demais")) {
    let alerta = null;
    S.cats.forEach(c=>{
      const atual = totalPorCategoriaMes(c.nome, mes);
      const media = mediaUltimosMeses(c.nome,3);
      if (atual > media * 1.25){
        alerta = `Você gastou muito em ${c.nome}: ${fmtMoneyLocal(atual)}, acima da média (${fmtMoneyLocal(media)}).`;
      }
    });
    return alerta || "Não identifiquei desperdícios claros este mês.";
  }

  // economia
  if (q.includes("econom") || q.includes("como posso economizar")) {
    const pior = categoriaPior(mes);
    if (!pior) return "Seus gastos estão equilibrados.";
    return `Sugestão: reduza ${pior.nome}. Só este mês aumentou ${fmtMoneyLocal(pior.diff)}.`;
  }

  // diagnóstico
  if (q.includes("diagnost") || q.includes("situação financeira")) {
    const saldo = saldoMes(mes);
    if (saldo < 0) return "⚠️ Você está gastando mais do que ganha.";
    return "Sua situação está equilibrada neste mês.";
  }

  return responderPerguntaAntiga(texto);
}

// fallback para função anterior
const responderPerguntaAntiga = window.responderPergunta;
