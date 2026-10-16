/* =====================================================================
   Navigation de la nouvelle interface : barre d'onglets du bas
   (Vol · Timing · Load · Retard · Notes). Aucune logique métier ici :
   Load ouvre le LOAD existant (openLDM / closeLDM), les autres onglets
   affichent une section de la page.
   ===================================================================== */
(function(){
  const PANELS = ['vol', 'timing', 'retard', 'notes'];

  function ldmIsOpen(){
    const m = document.getElementById('ldmModal');
    return !!m && m.style.display !== 'none' && m.style.display !== '';
  }

  function syncTabbar(){
    const current = ldmIsOpen() ? 'load' : (document.body.dataset.panel || 'vol');
    document.querySelectorAll('#tabbar [data-tab]').forEach(b => {
      const on = b.dataset.tab === current;
      b.classList.toggle('is-on', on);
      if(on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  function showPanel(name){
    if(!PANELS.includes(name)) name = 'vol';
    document.body.dataset.panel = name;
    try{ localStorage.setItem('uiPanel', name); }catch(e){}

    if(name === 'timing'){
      // La timeline se dessine à la largeur visible
      const tl = document.getElementById('timelineCard');
      if(tl && tl.style.display !== 'none') requestAnimationFrame(()=>{ try{ renderTimeline(); }catch(e){} });
    }
    if(name === 'notes'){
      // Mode Stylet / Clavier : rétablit le dernier mode si aucun n'est actif
      if(!document.querySelector('#bnPenLi.is-active, #bnTextLi.is-active') && typeof bnSwitchMode === 'function'){
        let mode = 'text';
        try{ mode = localStorage.getItem('bnMode_' + ((typeof currentTabId !== 'undefined' && currentTabId) || 'default')) || 'text'; }catch(e){}
        bnSwitchMode(mode);
      }
      // Le canvas du bloc note se redimensionne une fois visible
      const draw = document.getElementById('bnDrawMode');
      if(draw && draw.style.display !== 'none' && typeof bnSwitchMode === 'function'){
        requestAnimationFrame(()=> bnSwitchMode('draw'));
      }
    }
  }

  window.uiTab = function(name){
    if(name === 'load'){
      if(!ldmIsOpen() && typeof toggleLDM === 'function') toggleLDM();
      syncTabbar();
      return;
    }
    if(ldmIsOpen() && typeof closeLDM === 'function') closeLDM();
    const same = document.body.dataset.panel === name;
    showPanel(name);
    const wrap = document.getElementById('appWrap');
    if(wrap && !same) wrap.scrollTop = 0;
    syncTabbar();
  };

  // Bandeau marine : numéro du vol, route et avancement de la rotation
  const txt = id => ((document.getElementById(id)||{}).textContent || '').trim();
  const val = id => ((document.getElementById(id)||{}).value || '').trim();
  const isSet = v => !!v && !/^[-–—\s]*$/.test(v);
  const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t||''); return m ? (+m[1])*60 + (+m[2]) : null; };
  function syncHero(){
    const fno = document.getElementById('fhFno'); if(!fno) return;
    const dep = txt('kvDepVol'), arr = txt('kvArrVol');
    fno.textContent = isSet(dep) ? dep : (isSet(arr) ? arr : '----');
    const parts = [];
    const from = txt('kvFrom'), to = txt('kvTo');
    if(isSet(from) || isSet(to)) parts.push((isSet(from)?from:'---') + ' → ' + (isSet(to)?to:'---'));
    [txt('kvImmat'), txt('kvType')].forEach(v => { if(isSet(v)) parts.push(v); });
    const pk = txt('kvPark'); if(isSet(pk)) parts.push('P' + pk.replace(/^P/i,''));
    document.getElementById('fhSub').textContent = parts.join(' · ');
    // Avancement : de l'arrivée (AIBT, sinon SIBT) au départ (EOBT, sinon SOBT)
    const wrap = document.getElementById('fhProgWrap'), bar = document.getElementById('fhProg');
    let a = toMin(val('AIBT')) ?? toMin(val('SIBT'));
    let d = toMin(txt('timer-eobt')) ?? toMin(val('SOBT'));
    if(a == null || d == null){ wrap.classList.add('is-empty'); return; }
    if(d <= a) d += 1440;
    const n = new Date(); let now = n.getHours()*60 + n.getMinutes() + n.getSeconds()/60;
    if(now < a - 720) now += 1440;
    const r = (now - a) / (d - a);
    wrap.classList.remove('is-empty');
    wrap.classList.toggle('over', r > 1);
    bar.style.width = Math.max(0, Math.min(1, r)) * 100 + '%';
  }

  function init(){
    syncHero(); setInterval(syncHero, 1000);
    let start = 'vol';
    try{ start = localStorage.getItem('uiPanel') || 'vol'; }catch(e){}
    showPanel(start);
    syncTabbar();

    // Le LOAD peut s'ouvrir / se fermer depuis app.js (changement de vol, etc.)
    const m = document.getElementById('ldmModal');
    if(m) new MutationObserver(syncTabbar).observe(m, { attributes:true, attributeFilter:['style'] });

    // Cases Load vides : un tiret montre où saisir
    document.querySelectorAll('#ldmModal .ld-stat input:not([readonly]), #ldmModal .ld-tob input').forEach(i=>{ if(!i.placeholder) i.placeholder = '–'; });

    // Codes retard : l'erreur de validation se met à jour pendant la saisie
    const dl = document.querySelector('.dl-wrap');
    if(dl) dl.addEventListener('input', ()=>{ try{ updateRetardPanelState(); }catch(e){} });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
