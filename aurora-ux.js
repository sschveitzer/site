// ============ Aurora UX Layer (additive, safe) ============

// Toast helper
function toast(msg, timeout){
  try {
    var host = document.getElementById('toastHost');
    if (!host) return; // silent in prod if no host
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(10px)'; }, (timeout||2500));
    setTimeout(()=>{ try{ host.removeChild(el); }catch(_){}} , (timeout||2500)+300);
  } catch(_){}
}

// Command Palette (Ctrl/Cmd + K)
(function(){
  var root = document.getElementById('cmdk');
  var input = document.getElementById('cmdkInput');
  var list = document.getElementById('cmdkList');
  if (!root || !input || !list) return;
  const items = [
    {label:'Ir para Dashboard', action: ()=>typeof setTab==='function' && setTab('dashboard')},
    {label:'Ir para Lançamentos', action: ()=>typeof setTab==='function' && setTab('lancamentos')},
    {label:'Ir para Relatórios', action: ()=>typeof setTab==='function' && setTab('relatorios')},
    {label:'Ir para Carteiras', action: ()=>typeof setTab==='function' && setTab('carteiras')},
    {label:'Novo lançamento', action: ()=>typeof toggleModal==='function' && toggleModal(true)},
  ];
  function renderItems(filter){
    list.innerHTML = '';
    items.filter(i => !filter || i.label.toLowerCase().includes(filter.toLowerCase()))
      .forEach(i => {
        var el = document.createElement('div');
        el.className = 'cmdk-item';
        el.innerHTML = '<span>'+i.label+'</span><i class="ph ph-arrow-right"></i>';
        el.onclick = () => { i.action && i.action(); close(); };
        list.appendChild(el);
      });
  }
  function open(){ root.hidden = false; input.value=''; renderItems(''); setTimeout(()=>input.focus(), 0); }
  function close(){ root.hidden = true; }
  document.addEventListener('keydown', (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); open(); }
    if (e.key === 'Escape' && !root.hidden) close();
  });
  input.addEventListener('input', ()=>renderItems(input.value));
  root.addEventListener('click', (e)=>{ if (e.target === root) close(); });
})();

// Chart.js defaults: stable layout and brand polish
(function(){
  if (!window.Chart) return;
  Chart.defaults.font.family = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.elements.bar.borderRadius = 8;
  Chart.defaults.animation.duration = 700;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = true;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, .9)';
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
})();

// Fullscreen viewer for charts (data-fs attr)
(function(){
  var fs = document.getElementById('chartFs');
  var fsCanvas = document.getElementById('chartFsCanvas');
  if (!fs || !fsCanvas) return;
  var inst = null;
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-fs]');
    if (!btn) return;
    var which = btn.getAttribute('data-fs');
    var sourceId = ({
      saldo: 'chartSaldo',
      pie: 'chartPie',
      fluxo: 'chartFluxo2',
      pie2: 'chartPie2',
      forecast: 'chartForecast2',
      yoy: 'chartYoY',
      rxv: 'chartRxV'
    })[which];
    if (!sourceId) return;
    fs.hidden = false;
    try {
      var srcCanvas = document.getElementById(sourceId);
      if (srcCanvas && srcCanvas._chart) {
        if (inst) { inst.destroy(); inst = null; }
        inst = new Chart(fsCanvas.getContext('2d'), {
          type: srcCanvas._chart.config.type,
          data: JSON.parse(JSON.stringify(srcCanvas._chart.data)),
          options: Object.assign({}, srcCanvas._chart.options, { responsive: true, maintainAspectRatio: true })
        });
      }
    } catch(_){}
  });
  var closeBtn = document.getElementById('fsClose');
  if (closeBtn) closeBtn.addEventListener('click', ()=>{ fs.hidden = true; if (inst) { inst.destroy(); inst = null; } });
})();

// Confetti when meta >= 100%
function celebrate(){
  const emojis = ['💜','✨','🎉','🏆','🚀'];
  const n = 24;
  for (let i=0;i<n;i++){
    const s = document.createElement('div');
    s.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    s.style.position='fixed';
    s.style.left = (Math.random()*100)+'%';
    s.style.top = '-10px';
    s.style.fontSize = (16+Math.random()*18)+'px';
    s.style.transition = 'transform 1.6s ease, opacity 1.6s ease';
    s.style.zIndex = 1200;
    document.body.appendChild(s);
    setTimeout(()=>{
      s.style.transform = 'translateY('+(window.innerHeight+40)+'px) rotate('+(Math.random()*180)+'deg)';
      s.style.opacity = '0';
    },10);
    setTimeout(()=>{ try{ s.remove(); }catch(_){}} , 1800);
  }
}

// Observe progress bar width
(function(){
  const bar = document.getElementById('metaProgBar');
  if (!bar) return;
  const obs = new MutationObserver(()=>{
    try {
      const width = parseFloat(bar.style.width||'0');
      if (width >= 100 && !bar._celebrated){
        bar._celebrated = true;
        celebrate();
        toast && toast('Meta atingida! Excelente 👏');
      }
    } catch(_){}
  });
  obs.observe(bar, { attributes: true, attributeFilter: ['style'] });
})();

// Stabilize charts height (if author didn't set)
(function(){
  const ensureH = (id, h)=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.style.height = (h||300)+'px';
  };
  ['chartSaldo','chartPie','chartFluxo2','chartPie2','chartForecast2','chartYoY','chartRxV'].forEach(id=>ensureH(id, 300));
})();

// Attach marker to newly created Chart instances (for fullscreen cloning)
(function(){
  if (!window.Chart) return;
  const _Chart = Chart;
  const _proto = _Chart.prototype;
  const _init = _proto.initialize;
  _proto.initialize = function(){
    const res = _init.apply(this, arguments);
    try { this.canvas._chart = this; } catch(_){}
    return res;
  };
})();

// Fallback: remove skeletons if app didn't
document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(()=>{
    document.querySelectorAll('.skeleton').forEach(el=>el.classList.remove('skeleton'));
  }, 1000);
});
