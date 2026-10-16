/* =====================================================================
   Navigation de la nouvelle interface : barre d'onglets du bas
   (Vol · Timing · Load · Retard · Notes). Aucune logique métier ici :
   Load ouvre le LOAD existant (openLDM / closeLDM), les autres onglets
   affichent une section de la page.
   ===================================================================== */
(function(){
  const PANELS = ['vols', 'vol', 'timing', 'retard', 'notes'];

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
    if(name === 'vols') renderRecap();
    // Le bandeau du vol courant est masqué sur le Récap : recalcule la hauteur d'en-tête
    try{ updateHeaderOffset(); }catch(e){}
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
    { k:'comptage',      t:'Comptage bagages',  d:'Début et fin du comptage',        c:'#15803d' },
    { k:'chargement',    t:'Chargement bagages',d:'Début et fin du chargement',      c:'#15803d' },
    { k:'tapis',            side:'arr', t:'Tapis bagages',          d:'Mise en place du tapis',            c:'#0d9488' },
    { k:'dechargement',     side:'arr', t:'Déchargement bagages',   d:'Début et fin du déchargement',      c:'#15803d' },
    { k:'repositionnement', side:'arr', t:'Repositionnement avion', d:'Début et fin du repositionnement',  c:'#3273dc' }
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
    syncEvDurations();
  }

  // Durée affichée dans l'en-tête des événements début / fin
  const EV_PAIRS = {
    dechargement:['DebutDechargementBagages','FinDechargementBagages'], repositionnement:['DebutRepositionnement','FinRepositionnement'],
    chargement:['DebutChargementBagages','FinChargementBagages'], comptage:['DebutComptageBagages','FinComptageBagages'],
    'recherche-bag':['RechercheBagDebut','RechercheBagFin'], gpu:['ArriveeNayak','DepartNayak']
  };
  function syncEvDurations(){
    const n = new Date(), nowM = n.getHours()*60 + n.getMinutes();
    Object.keys(EV_PAIRS).forEach(k => {
      const p = document.getElementById('panel-' + k); if(!p) return;
      const h = p.querySelector('.ev-h'); if(!h) return;
      let el = h.querySelector('.ev-dur');
      const a = toMin(val(EV_PAIRS[k][0])), b = toMin(val(EV_PAIRS[k][1]));
      let t = '', run = false;
      if(a != null && b != null) t = (((b - a) % 1440) + 1440) % 1440 + ' min';
      else if(a != null){ t = (((nowM - a) % 1440) + 1440) % 1440 + ' min'; run = true; }
      if(!t){ if(el) el.remove(); return; }
      if(!el){ el = document.createElement('span'); el.className = 'ev-dur'; h.insertBefore(el, h.querySelector('.ev-x')); }
      el.textContent = run ? 'En cours · ' + t : t;
      el.classList.toggle('run', run);
    });
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
  window.uiEvOpen = function(side){
    side = side === 'arr' ? 'arr' : 'dep';
    const m = evSheet();
    m.querySelector('.ev-list').innerHTML = EVENTS.filter(e => (e.side || 'dep') === side).map(e => {
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

  /* ===== Onglet « Vols » : récap de tous les vols ouverts ===== */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmtHM = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0'); };
  const fmtLeft = l => l < 0 ? '+' + Math.round(-l) + '′' : (l < 60 ? Math.floor(l) + '′' : Math.floor(l/60) + 'h' + String(Math.floor(l%60)).padStart(2,'0'));
  function nowMin(){ const n = new Date(); return n.getHours()*60 + n.getMinutes() + n.getSeconds()/60; }
  function rel(t, ref){ if(t == null) return null; while(t - ref > 720) t -= 1440; while(ref - t > 720) t += 1440; return t; }

  function flightInfo(id){
    const cur = (typeof currentTabId !== 'undefined') && String(currentTabId) === String(id);
    let d = {}; try{ d = JSON.parse(localStorage.getItem('tab-' + id) || '{}'); }catch(e){}
    const g = k => (cur ? val(k) : String(d[k] || '')).trim();
    const cie = g('Cie').toUpperCase();
    const depFF = (d.akMeta?.depFF || '').toUpperCase(), arrFF = (d.akMeta?.arrFF || '').toUpperCase();
    const fno = depFF || arrFF || (cie + g('NVol').toUpperCase()) || 'VOL';
    const place = (depFF || !arrFF ? g('To') : g('From')).toUpperCase();
    const now = nowMin();
    const eobtCur = cur ? toMin(txt('timer-eobt')) : null;
    const sobt = toMin(g('SOBT')), sibt = toMin(g('SIBT')), aibt = toMin(g('AIBT')), aobt = toMin(g('AOBT'));
    let eobt = rel(eobtCur ?? sobt, now);
    const ctot = rel(toMin(g('CTOT') || (cur ? txt('timer-ctot') : String(d.timer_ctot || ''))), now);
    const left = eobt != null ? eobt - now : null;
    let st, cls = '', next;
    const has = k => !!g(k);
    if(aobt != null){ st = 'Parti ' + fmtHM(aobt); cls = 'ok'; next = 'Off-block ' + fmtHM(aobt); }
    else if(aibt == null){ st = sibt != null ? 'Arr. ' + fmtHM(sibt) : 'Pas arrivé'; cls = 'mut'; next = sibt != null ? 'Arrivée prévue ' + fmtHM(sibt) : 'Arrivée à saisir'; }
    else {
      next = !has('DernierDebarque') ? 'Débarquement' + (has('PremierDebarque') ? ' en cours' : ' à lancer')
           : !has('AvionPremierEmbarque') ? 'Embarquement à lancer'
           : !has('AvionDernierEmbarque') ? 'Embarquement en cours'
           : !has('RemiseLID') ? 'Remise LID'
           : !has('FermeturePorteAvion') ? 'Fermeture porte'
           : 'Off-block';
      if(left != null && left < 0){ st = '+' + Math.round(-left) + '′'; cls = 'late'; }
      else if(left != null && left <= 5){ st = 'EOBT −5'; cls = 'soon'; }
      else st = 'En escale';
    }
    let p = 0;
    if(aobt != null) p = 100;
    else if(aibt != null && eobt != null){ const a = rel(aibt, now); p = Math.max(0, Math.min(1, (now - a) / Math.max(1, eobt - a))) * 100; }
    const ringCls = aobt != null ? 'done' : cls === 'late' ? 'over' : cls === 'soon' ? 'soon' : '';
    // Statut sol affiché en bas des cartes
    const blk = aobt != null ? { t:'Departed', c:'blk-dep' } : aibt != null ? { t:'In block', c:'blk-in' } : { t:'Not in block', c:'blk-out' };
    return { blk, id, cur, cie: (cie || (fno !== 'VOL' ? fno.slice(0,2) : '')).slice(0,2), fno, place, park: g('Parking'), immat: g('Immat').toUpperCase(),
             sobt: rel(sobt, now), eobt, ctot, left: aobt != null ? null : left, st, cls, next, p, ringCls, done: aobt != null, late: cls === 'late' };
  }

  function recapView(){ try{ return localStorage.getItem('rcView') === 'cmp' ? 'cmp' : 'det'; }catch(e){ return 'det'; } }
  window.uiRecapView = function(v){ try{ localStorage.setItem('rcView', v); }catch(e){} renderRecap(); };
  window.uiOpenFlight = function(id){ try{ switchTab(id); }catch(e){} uiTab('vol'); };

  function ringHTML(f){ return '<span class="flt-cie rc-ring ' + f.ringCls + '" style="--p:' + f.p.toFixed(1) + '%"><b>' + esc(f.cie || '–') + '</b></span>'; }
  function cdHTML(f){
    if(f.done) return '<small>OFF-BLOCK</small><b class="ok">' + esc(f.st.replace('Parti ','')) + '</b>';
    if(f.left == null) return '<small>CD</small><b class="mut">—</b>';
    return '<small>' + (f.late ? 'RETARD' : 'CD') + '</small><b class="' + f.cls + '">' + fmtLeft(f.left) + '</b>';
  }

  const metaT = (k, v, c) => '<span' + (c ? ' class="' + c + '"' : '') + '>' + k + ' <b>' + (v != null ? fmtHM(v) : '--:--') + '</b></span>';

  function renderRecap(){
    const list = document.getElementById('rcList'); if(!list) return;
    let ids = []; try{ ids = JSON.parse(localStorage.getItem('flightTabs') || '[]'); }catch(e){}
    const F = (Array.isArray(ids) ? ids : []).map(flightInfo);
    const lateN = F.filter(f => f.late).length;
    const badge = document.getElementById('volsBadge');
    if(badge){ badge.hidden = !lateN; badge.textContent = lateN; }
    if(document.body.dataset.panel !== 'vols') return;
    const view = recapView();
    document.querySelectorAll('.rc-seg button').forEach(b => b.classList.toggle('is-on', b.dataset.view === view));
    document.getElementById('rcSub').textContent = F.length ? F.length + ' vol' + (F.length > 1 ? 's' : '') + ' · ' + fmtHM(nowMin()) + (lateN ? ' · ' + lateN + ' en retard' : '') : '';
    if(!F.length){ list.innerHTML = '<div class="rc-empty">Aucun vol ouvert. Touche le « + » en haut pour en ajouter un.</div>'; return; }
    const key = f => f.done ? 1e6 : (f.left == null ? 1e5 : f.left);
    const sorted = F.slice().sort((a,b) => key(a) - key(b));
    if(view === 'cmp'){
      list.innerHTML = '<div class="rc-list">' + sorted.map(f =>
        '<button type="button" class="rc-row' + (f.cur ? ' is-cur' : '') + (f.done ? ' is-done' : '') + '" onclick="uiOpenFlight(\'' + esc(f.id) + '\')">' + ringHTML(f)
        + '<span class="rc-t"><b>' + esc(f.fno) + '</b><small>' + esc([f.place, f.park && 'P' + f.park.replace(/^P/i,'')].filter(Boolean).join(' · ')) + '</small></span>'
        + '<span class="rc-e">EOBT<b>' + (f.eobt != null ? fmtHM(f.eobt) : '--:--') + '</b></span>'
        + '<span class="rc-cd ' + (f.done ? 'ok' : f.left == null ? 'mut' : f.cls) + '">' + (f.done ? '✓' : f.left == null ? '—' : fmtLeft(f.left)) + '</span></button>').join('') + '</div>';
      return;
    }
    const card = f => '<button type="button" class="rc-card' + (f.cur ? ' is-cur' : '') + (f.done ? ' is-done' : '') + '" onclick="uiOpenFlight(\'' + esc(f.id) + '\')">'
      + ringHTML(f)
      + '<span class="rc-t"><b>' + esc(f.fno) + (f.place ? ' · ' + esc(f.place) : '') + '</b><small>' + esc([f.park && 'P' + f.park.replace(/^P/i,''), f.immat].filter(Boolean).join(' · ') || '—') + '</small></span>'
      + '<span class="rc-cdbig">' + cdHTML(f) + '</span>'
      + (f.done ? '' : '<span class="rc-next"><i></i>' + esc(f.next) + '</span>')
      + '<span class="rc-meta">' + metaT('SOBT', f.sobt) + metaT('EOBT', f.eobt) + metaT('CTOT', f.ctot, f.ctot != null ? 'rc-ctot' : '') + '<em class="rc-blk ' + f.blk.c + '">' + f.blk.t + '</em></span>'
      + '</button>';
    const live = sorted.filter(f => !f.done), done = sorted.filter(f => f.done);
    list.innerHTML = (live.length ? '<div class="rc-sec">En cours · ' + live.length + '</div>' + live.map(card).join('') : '')
      + (done.length ? '<div class="rc-sec">Terminés · ' + done.length + '</div>' + done.map(card).join('') : '');
  }

  /* ===== LOAD : swipe ARR ⇄ PREVI ⇄ FINAL ⇄ FUEL ===== */
  const LDM = ['arr','previ','final','fuel'];
  const LDM_EL = { arr:'ldmArr', previ:'ldmPrevi', final:'ldmFinal', fuel:'ldmFuel' };
  function initLdmSwipe(){
    const m = document.getElementById('ldmModal');
    if(!m) return;
    let x0 = null, y0 = 0, t0 = 0;
    m.addEventListener('touchstart', e => {
      x0 = null;
      if(e.touches.length !== 1) return;
      // Les cases du LOAD couvrent presque tout l'écran : on accepte le swipe dessus, sauf sur la case en cours d'édition
      if(e.target.closest('textarea, select, .sheet-modal, [data-noswipe]') || e.target === document.activeElement) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive:true });
    m.addEventListener('touchend', e => {
      if(x0 === null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if(Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t0 > 700) return;
      const cur = (typeof _ldmMode !== 'undefined' && LDM.includes(_ldmMode)) ? _ldmMode : 'arr';
      const i = LDM.indexOf(cur) + (dx < 0 ? 1 : -1);
      if(i < 0 || i >= LDM.length || typeof ldmSwitch !== 'function') return;
      ldmSwitch(LDM[i]);
      const el = document.getElementById(LDM_EL[LDM[i]]);
      if(el){ el.classList.remove('sw-l','sw-r'); void el.offsetWidth; el.classList.add(dx < 0 ? 'sw-l' : 'sw-r'); }
    }, { passive:true });
  }


  /* ===== LOAD v2.23 (option B) : écarts vs PRÉVI, zones, barre des soutes ===== */
  const ldInt = id => { const v = val(id); if(v === '') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n; };
  const isShown = el => !!el && el.offsetParent !== null;
  const fmtKg = n => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  function setDelta(finalId, previVal){
    const inp = document.getElementById(finalId); if(!inp) return;
    const tile = inp.closest('.ld-stat'); if(!tile) return;
    let chip = tile.querySelector('.ld-dl');
    const f = ldInt(finalId);
    if(f == null || previVal == null){ if(chip) chip.remove(); return; }
    if(!chip){ chip = document.createElement('span'); chip.className = 'ld-dl'; tile.appendChild(chip); }
    const d = f - previVal;
    chip.textContent = d === 0 ? '=' : (d > 0 ? '+' + d : '−' + (-d));
    chip.classList.toggle('up', d !== 0);
    chip.title = 'Écart avec le PRÉVI (' + previVal + ')';
  }
  function syncLoadUI(){
    const m = document.getElementById('ldmModal');
    if(!m || m.style.display === 'none') return;
    const cie = val('Cie').toUpperCase(), frrk = cie === 'FR' || cie === 'RK';
    const elid = frrk && (typeof isELID === 'function') && isELID();
    // Écarts par tuile
    if(frrk){
      setDelta('FinalADULT', elid ? ldInt('PreviPAX_MAIN') : null);
      setDelta('FinalCHILD', null);
      setDelta('FinalINFANT', ldInt('PreviPAX_INF'));
      setDelta('FinalBAGS', ldInt('PreviBAGS'));
      setDelta('FinalPOIDS', null);
      ['FinalMALE','FinalFEMALE'].forEach(id => setDelta(id, null));
    } else {
      setDelta('FinalMALE', ldInt('PreviMALE')); setDelta('FinalFEMALE', ldInt('PreviFEMALE'));
      setDelta('FinalCHILD', ldInt('PreviCHILD')); setDelta('FinalINFANT', ldInt('PreviINFANT'));
      setDelta('FinalBAGS', ldInt('PreviBAGS_OTHER')); setDelta('FinalPOIDS', ldInt('PreviPOIDS_OTHER'));
      setDelta('FinalADULT', null);
    }
    // TOB FINAL comparé au TOB PRÉVI
    const cmp = document.getElementById('ldFinalCmp');
    if(cmp){
      const pv = val(frrk ? 'PreviTOB_FRRK' : 'PreviTOB'), fv = val('FinalTOB');
      if(!pv){ cmp.innerHTML = ''; }
      else {
        const a = parseInt(fv, 10), b = parseInt(pv, 10);
        const d = (!isNaN(a) && !isNaN(b)) ? a - b : null;
        cmp.innerHTML = 'Prévi <b>' + esc(pv) + '</b>' + (d == null ? '' : '<span class="ld-dl' + (d ? ' up' : '') + '">' + (d === 0 ? '=' : (d > 0 ? '+' + d : '−' + (-d))) + '</span>');
      }
    }
    // Zones : total vs passagers, barre de répartition
    const zIds = ['FinalOA','FinalOB','FinalOC','FinalOD'].filter(id => isShown(document.getElementById(id)?.closest('.ld-stat')));
    const zSum = zIds.reduce((t, id) => t + (ldInt(id) || 0), 0);
    const main = parseInt(val('FinalTOB'), 10);
    const zs = document.getElementById('ldZonesSum');
    if(zs){
      if(!zSum && isNaN(main)) zs.innerHTML = '';
      else { const ok = !isNaN(main) && zSum === main; zs.innerHTML = '<b class="' + (ok ? 'ok' : 'ko') + '">' + zSum + '</b> / ' + (isNaN(main) ? '–' : main) + ' pax'; }
    }
    // Total des zones ≠ TOB → zones en rouge ; jauge = remplissage vs capacité (placeholder « 27 (1-5) »)
    const zKo = !isNaN(main) && zSum !== main;
    ['FinalOA','FinalOB','FinalOC','FinalOD'].forEach(id => {
      const inp = document.getElementById(id), t = inp?.closest('.ld-stat'); if(!t) return;
      t.classList.toggle('ld-ko', zKo && zIds.includes(id));
      const cap = parseInt((/^(\d+)/.exec(inp.placeholder || '') || [])[1], 10);
      const v = ldInt(id) || 0;
      t.style.setProperty('--zw', (cap > 0 ? Math.min(100, v / cap * 100) : 0).toFixed(1) + '%');
      t.classList.toggle('ld-over', cap > 0 && v > cap);
    });
    // Soutes : barre proportionnelle + total pièces / kg
    const bar = document.getElementById('ldHoldBar');
    if(bar){
      const k = (typeof holdBagKg === 'function') ? holdBagKg() : null;
      const hs = ['FinalH1','FinalH2','FinalH3','FinalH4'].map(id => document.getElementById(id)).filter(i => i && isShown(i.closest('.ld-stat')));
      let pcs = 0;
      const segs = hs.map(i => {
        const n = parseInt(i.value, 10) || 0; pcs += n;
        const lbl = i.closest('.ld-stat').querySelector('.ld-stat-label')?.textContent || '';
        return { n, lbl };
      });
      const sig = segs.map(x => x.lbl + x.n).join('|');
      if(bar.dataset.sig !== sig){
        bar.dataset.sig = sig;
        // Seules les soutes chargées apparaissent ; chacune garde une largeur lisible même avec peu de bagages
        bar.innerHTML = segs.filter(x => x.n).map(x => '<div style="flex:' + x.n + ' 1 0"><span>' + esc(x.lbl) + '</span><i>-</i><b>' + x.n + '</b></div>').join('');
        bar.hidden = !pcs;
      }
      const hsum = document.getElementById('ldHoldSum');
      const bags = ldInt('FinalBAGS');
      if(hsum) hsum.innerHTML = pcs ? ('<b class="' + (bags != null && bags !== pcs ? 'ko' : '') + '">' + pcs + ' pcs</b>' + (k ? ' · ' + (k.approx ? '≈ ' : '') + fmtKg(pcs * k.kg) + ' kg' : '')) : '';
    }
    // Nombre de tuiles passagers visibles (2 à 4 par ligne)
    const pr = document.getElementById('finalPaxRow');
    if(pr){ const n = Math.max(2, [...pr.children].filter(c => c.classList.contains('ld-stat') && c.style.display !== 'none').length); pr.style.setProperty('--n', n); pr.dataset.n = n; }
  }


  /* ===== Nouveautés : popup animé à la première connexion sur la nouvelle version ===== */
  const WN_ID = 'refonte-2026-10';
  const WN_ITEMS = [
    ['i-grid',  '#3D6BE0', 'Nouveau design', 'Plus clair et plus lisible, en mode clair ou sombre.'],
    ['i-list',  '#0B1E4F', 'Onglet Récap', 'Tous tes vols ouverts d\'un coup d\'œil : compte à rebours, prochaine action, statut bloc.'],
    ['i-plane', '#FFAD00', 'Onglets de vol', 'Un anneau se remplit jusqu\'à l\'EOBT : bleu, jaune à EOBT −5, rouge en retard.'],
    ['i-plus',  '#1F9D57', 'Événements', 'Push, soutes, échelles, chargement, déchargement… avec leur durée.'],
    ['i-clock', '#7c3aed', 'Timeline', 'Vue Gantt épurée, ligne NOW qui se suit toute seule, tous les événements.'],
    ['i-bag',   '#D93636', 'LOAD repensé', 'TOB en vedette, écarts avec le PRÉVI, zones et soutes avec le poids.'],
    ['i-arrow', '#0d9488', 'Swipe', 'Glisse pour passer d\'Arrivée à Départ à Timeline, et entre ARR, PRÉVI, FINAL, FUEL.'],
  ];
  window.uiWhatsNew = function(){
    let m = document.getElementById('wnModal');
    if(!m){
      m = document.createElement('div');
      m.id = 'wnModal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Nouveautés');
      m.innerHTML = '<div class="wn-card">'
        + '<div class="wn-hero"><div class="wn-sky"><i></i><i></i><i></i></div>'
        + '<div class="wn-plane"><svg class="ico"><use href="#i-plane"/></svg></div>'
        + '<span class="wn-badge">Nouvelle version</span>'
        + '<h2>Le nouveau Suivi Performance est arrivé&nbsp;!</h2>'
        + '<p>Nouveau design, nouvelles fonctions. Voici l\'essentiel.</p></div>'
        + '<ul class="wn-list">' + WN_ITEMS.map((x, i) => '<li style="--i:' + i + '"><span class="wn-ic" style="--c:' + x[1] + '"><svg class="ico"><use href="#' + x[0] + '"/></svg></span><span><b>' + x[2] + '</b><small>' + x[3] + '</small></span></li>').join('') + '</ul>'
        + '<div class="wn-foot"><button type="button" class="btn btn-primary btn-block" id="wnGo">C\'est parti</button></div></div>';
      document.body.appendChild(m);
      const close = () => { m.classList.remove('is-on'); setTimeout(() => { m.style.display = 'none'; }, 250); try{ localStorage.setItem('whatsNewSeen', WN_ID); }catch(e){} };
      m.querySelector('#wnGo').addEventListener('click', close);
      m.addEventListener('click', e => { if(e.target === m) close(); });
    }
    m.style.display = 'flex';
    m.classList.remove('is-on'); void m.offsetWidth; m.classList.add('is-on');
  };
  window.uiWhatsNewMaybe = function(){
    let seen = null; try{ seen = localStorage.getItem('whatsNewSeen'); }catch(e){}
    if(seen === WN_ID || !document.body.classList.contains('pv-authed')) return;
    setTimeout(window.uiWhatsNew, 450);
  };

  function init(){
    syncHero(); setInterval(()=>{ syncHero(); syncEvents(); syncTabRings(); syncLoadUI(); }, 1000);
    initSwipe(); initLdmSwipe(); syncFollowBtn(); syncTabRings(); renderRecap(); setInterval(renderRecap, 15000);
    const tb = document.getElementById('tab-bar'); if(tb) new MutationObserver(()=>requestAnimationFrame(syncTabRings)).observe(tb, { childList:true }); setInterval(tlTick, 15000);
    document.addEventListener('click', e => { if(e.target.closest('.ev-x, .tw-zone')) setTimeout(syncEvents, 0); });
    let start = 'vol';
    try{ start = localStorage.getItem('uiPanel') || 'vol'; }catch(e){}
    showPanel(start);
    syncTabbar();
    uiWhatsNewMaybe();

    // Le LOAD peut s'ouvrir / se fermer depuis app.js (changement de vol, etc.)
    const m = document.getElementById('ldmModal');
    if(m){ new MutationObserver(()=>{ syncTabbar(); syncLoadUI(); }).observe(m, { attributes:true, attributeFilter:['style'] }); m.addEventListener('input', ()=>requestAnimationFrame(syncLoadUI)); m.addEventListener('click', ()=>setTimeout(syncLoadUI, 0)); }

    // Cases Load vides : un tiret montre où saisir
    document.querySelectorAll('#ldmModal .ld-stat input:not([readonly]), #ldmModal .ld-tob input').forEach(i=>{ if(!i.placeholder) i.placeholder = '–'; });

    // Codes retard : l'erreur de validation se met à jour pendant la saisie
    const dl = document.querySelector('.dl-wrap');
    if(dl) dl.addEventListener('input', ()=>{ try{ updateRetardPanelState(); }catch(e){} });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
