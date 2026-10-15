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

  function init(){
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
