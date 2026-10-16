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


  /* ===== Événements optionnels du Départ (Crew, Recherche bag, INAD, Nayak) ===== */
  const EVENTS = [
    { k:'crew',          t:'Crew',          d:'Arrivée PNT et PNC',             c:'#334155' },
    { k:'recherche-bag', t:'Recherche bag', d:'Nombre de bags, début et fin',   c:'#ec4899' },
    { k:'inad',          t:'INAD',          d:'Annonce et arrivée INAD',        c:'#D7263D' },
    { k:'gpu',           t:'Nayak',         d:'Appel, arrivée et départ Nayak', c:'#FFAD00' },
    { k:'casque',        t:'Connexion casque',  d:'Connexion de l’agent casque',     c:'#7c3aed' },
    { k:'push',          t:'Push',              d:'Connexion et changement de push', c:'#3273dc' },
    { k:'soutes',        t:'Portes de soute',   d:'Fermeture soute AV et AR',        c:'#7f1d1d' },
    { k:'echelles',      t:'Retrait échelles',  d:'Retrait échelle AV et AR',        c:'#636363' },
    { k:'reouverture',   t:'Réouverture porte', d:'Réouverture porte avion',         c:'#D7263D' },
    { k:'comptage',      t:'Comptage bagages',  d:'Début et fin du comptage',        c:'#15803d' }
  ];
  function evShown(k){ const p = document.getElementById('panel-'+k); return !!p && p.style.display !== 'none'; }
  function evFilled(p){ return [...p.querySelectorAll('input')].some(i => i.value && !/^[-–—\s0]*$/.test(i.value)); }

  // Un bloc qui contient une heure reste toujours affiché, sans croix
  function syncEvents(){
    document.querySelectorAll('.ev-panel').forEach(p => {
      const f = evFilled(p);
      p.classList.toggle('has-val', f);
      if(f && p.style.display === 'none'){ try{ toggleDepExtra(p.dataset.ev); }catch(e){ p.style.display = 'block'; } }
    });
    const add = document.getElementById('evAddBtn');
  }

  function evSheet(){
    let m = document.getElementById('evSheet');
    if(m) return m;
    m = document.createElement('div');
    m.id = 'evSheet'; m.className = 'sheet-modal'; m.style.display = 'none';
    m.innerHTML = '<div class="sheet-card"><div class="ev-sh-head"><b>Ajouter un événement</b>'
      + '<button type="button" class="ev-x" aria-label="Fermer">×</button></div><div class="ev-list"></div></div>';
    m.addEventListener('click', e => {
      if(e.target === m || e.target.closest('.ev-sh-head .ev-x')){ m.style.display = 'none'; return; }
      const it = e.target.closest('.ev-item');
      if(!it || it.disabled) return;
      m.style.display = 'none';
      if(evShown(it.dataset.k)){ toggleDepExtra(it.dataset.k); syncEvents(); return; }   // re-toucher = retirer
      toggleDepExtra(it.dataset.k);
      const p = document.getElementById('panel-'+it.dataset.k);
      if(p){ p.scrollIntoView({ behavior:'smooth', block:'center' }); p.classList.add('ev-flash'); setTimeout(()=>p.classList.remove('ev-flash'), 900); }
      syncEvents();
    });
    document.body.appendChild(m);
    return m;
  }
  window.uiEvOpen = function(){
    const m = evSheet();
    m.querySelector('.ev-list').innerHTML = EVENTS.map(e => {
      const on = evShown(e.k);
      const p = document.getElementById('panel-'+e.k);
      const full = on && p && evFilled(p);
      const sub = full ? 'Contient une heure, reste affiché' : on ? 'Affiché · toucher pour retirer' : e.d;
      return '<button type="button" class="ev-item'+(on?' is-on':'')+'" data-k="'+e.k+'"'+(full?' disabled':'')+'>'
        + '<i style="background:'+e.c+'"></i><span><b>'+e.t+'</b><small>'+sub+'</small></span>'
        + '<em>'+(on?'✓':'+')+'</em></button>';
    }).join('');
    m.style.display = 'flex';
  };

  /* ===== Timing : swipe Arrivée ⇄ Départ ⇄ Timeline ===== */
  const SEG = ['arr','dep','tl'];
  function curSeg(){
    const tl = document.getElementById('timelineCard');
    if(tl && tl.style.display !== 'none') return 'tl';
    const dep = document.getElementById('panel-dep');
    return (dep && dep.style.display !== 'none') ? 'dep' : 'arr';
  }
  function initSwipe(){
    const zone = document.getElementById('appWrap');
    if(!zone) return;
    let x0 = null, y0 = 0, t0 = 0;
    zone.addEventListener('touchstart', e => {
      x0 = null;
      if(e.touches.length !== 1 || document.body.dataset.panel !== 'timing') return;
      if(e.target.closest('#timelineScroll, input, textarea, select, .sheet-modal')) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive:true });
    zone.addEventListener('touchend', e => {
      if(x0 === null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if(Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t0 > 700) return;
      const i = SEG.indexOf(curSeg()) + (dx < 0 ? 1 : -1);
      if(i < 0 || i >= SEG.length) return;
      switchTimingPanel(SEG[i]);
      const el = SEG[i] === 'tl' ? document.getElementById('timelineCard') : document.getElementById('panel-'+SEG[i]);
      if(el){ el.classList.remove('sw-l','sw-r'); void el.offsetWidth; el.classList.add(dx < 0 ? 'sw-l' : 'sw-r'); }
      const w = document.getElementById('appWrap'); if(w) w.scrollTop = 0;
    }, { passive:true });
  }

  /* ===== Timeline : option « Suivre Now » ===== */
  function syncFollowBtn(){
    const b = document.getElementById('tlFollowBtn');
    if(!b) return;
    let on = true; try{ on = localStorage.getItem('tlFollowNow') !== '0'; }catch(e){}
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  window.uiTlFollow = function(){
    let on = true; try{ on = localStorage.getItem('tlFollowNow') !== '0'; }catch(e){}
    try{ localStorage.setItem('tlFollowNow', on ? '0' : '1'); }catch(e){}
    window._tlLastTouch = 0;
    syncFollowBtn();
    try{ renderTimeline(); }catch(e){}
  };
  function tlTick(){
    const tl = document.getElementById('timelineCard');
    if(!tl || tl.style.display === 'none' || document.body.dataset.panel !== 'timing') return;
    try{ renderTimeline(); }catch(e){}
  }

  /* ===== Onglets de vol : anneau d'avancement autour du code compagnie ===== */
  function ringRatio(a, d){
    if(a == null || d == null) return null;
    if(d <= a) d += 1440;
    const n = new Date(); let now = n.getHours()*60 + n.getMinutes() + n.getSeconds()/60;
    if(now < a - 720) now += 1440;
    return { r:(now - a) / (d - a), left: d - now };
  }
  function syncTabRings(){
    document.querySelectorAll('#tab-bar .flt[data-tab]').forEach(t => {
      const ring = t.querySelector('.flt-cie'); if(!ring) return;
      let r = null;
      if(t.classList.contains('is-on')){
        r = ringRatio(toMin(val('AIBT')), toMin(txt('timer-eobt')) ?? toMin(val('SOBT')));
      } else {
        let d = {}; try{ d = JSON.parse(localStorage.getItem('tab-' + t.dataset.tab) || '{}'); }catch(e){}
        r = ringRatio(toMin(d.AIBT || ''), toMin(d.SOBT || ''));
      }
      // Vert, puis jaune à EOBT −5 min, rouge une fois l'EOBT dépassée
      const p = r == null ? 0 : Math.max(0, Math.min(1, r.r)) * 100;
      ring.style.setProperty('--p', p.toFixed(1) + '%');
      ring.classList.toggle('over', r != null && r.left < 0);
      ring.classList.toggle('soon', r != null && r.left >= 0 && r.left <= 5);
    });
  }

  function init(){
    syncHero(); setInterval(()=>{ syncHero(); syncEvents(); syncTabRings(); }, 1000);
    initSwipe(); syncFollowBtn(); syncTabRings();
    const tb = document.getElementById('tab-bar'); if(tb) new MutationObserver(()=>requestAnimationFrame(syncTabRings)).observe(tb, { childList:true }); setInterval(tlTick, 15000);
    document.addEventListener('click', e => { if(e.target.closest('.ev-x, .tw-zone')) setTimeout(syncEvents, 0); });
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
