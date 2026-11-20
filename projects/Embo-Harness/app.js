(() => {
  'use strict';
  const data = window.EMBO_DEMOS;
  const isGallery = document.body.classList.contains('gallery-page');
  const root = new URL(isGallery ? '../' : './', document.baseURI);
  const asset = path => new URL(path, root).href;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const names = { real: 'Real World', robolab: 'RoboLab Bench' };
  const play = video => { const promise = video.play(); if (promise) promise.catch(() => {}); };
  const autoVideos = new Set();
  const visibleVideos = new Set();
  let modalOpen = false;
  let presentationPlaying = false;
  function syncVideos() {
    autoVideos.forEach(video => {
      const allowed = visibleVideos.has(video) && !document.hidden && !modalOpen && !presentationPlaying && !reduced.matches && !saveData;
      if (allowed && !video.dataset.userPaused) {
        if (!video.hasAttribute('src')) video.src = asset(video.dataset.src);
        play(video);
      } else video.pause();
    });
  }
  const videoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.35) visibleVideos.add(entry.target);
      else visibleVideos.delete(entry.target);
    });
    syncVideos();
  }, {threshold: [0, 0.35, 0.8]});
  function observeVideo(video) {
    autoVideos.add(video); videoObserver.observe(video);
    video.addEventListener('playing', () => video.classList.add('is-playing'));
  }
  const hero = document.querySelector('#hero-video');
  const heroButton = document.querySelector('.hero-toggle');
  if (hero) {
    const stage = document.querySelector('.hero-stage');
    const screen = stage.querySelector('.hero');
    const header = stage.querySelector('.opening-header');
    const cue = stage.querySelector('.scroll-cue');
    const clamp = value => Math.max(0, Math.min(1, value));
    const ease = value => { const t=clamp(value); return t*t*(3-2*t); };
    let progress=0, scheduled=false, openingComplete=false;
    stage.classList.add('scroll-hero');
    function updateOpening() {
      scheduled=false;
      if (openingComplete) return;
      const bounds=stage.getBoundingClientRect();
      const distance=stage.offsetHeight-screen.offsetHeight;
      // The opening only advances; scrolling back never expands the video again.
      progress=Math.max(progress,clamp(-bounds.top/Math.max(1,distance)));
      const finish=distance>0 && -bounds.top>=distance-1;
      if (finish) progress=1;
      // Leave a short resting point with the paper details fully revealed.
      const morph=reduced.matches ? Number(progress>0.15) : ease(progress/0.82);
      const paper=reduced.matches ? Number(progress>0.15) : ease((progress-0.28)/0.5);
      const opening=reduced.matches ? 1-paper : 1-ease(progress/0.42);
      stage.style.setProperty('--hero-morph',morph.toFixed(4));
      stage.style.setProperty('--paper-reveal',paper.toFixed(4));
      stage.style.setProperty('--opening-reveal',opening.toFixed(4));
      header.inert=paper<0.95;
      cue.href=progress<0.9 ? '#paper' : '#overview';
      cue.setAttribute('aria-label',progress<0.9 ? 'Explore Embo-Harness' : 'Watch the presentation');
      if (finish) {
        openingComplete=true;
        const scrollTop=window.scrollY;
        // Remove the consumed scroll space without moving the visible content.
        stage.classList.add('opening-complete');
        window.scrollTo({top:Math.max(0,scrollTop-distance),behavior:'instant'});
      }
    }
    function scheduleOpening() {
      if (!scheduled) { scheduled=true; requestAnimationFrame(updateOpening); }
    }
    window.addEventListener('scroll',scheduleOpening,{passive:true});
    window.addEventListener('resize',scheduleOpening,{passive:true});
    window.addEventListener('pageshow',scheduleOpening);
    reduced.addEventListener('change',scheduleOpening);
    cue.addEventListener('click',event=> {
      if (progress>=0.9) return;
      event.preventDefault();
      const top=window.scrollY+stage.getBoundingClientRect().top;
      window.scrollTo({top:top+stage.offsetHeight-screen.offsetHeight,behavior:reduced.matches?'instant':'smooth'});
    });
    updateOpening();
    observeVideo(hero);
    const updateHero = () => {
      const paused = hero.paused;
      heroButton.classList.toggle('is-paused', paused);
      heroButton.setAttribute('aria-pressed', String(paused));
      heroButton.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} background video`);
    };
    hero.addEventListener('play', updateHero); hero.addEventListener('pause', updateHero);
    heroButton.addEventListener('click', () => {
      if (hero.paused) { delete hero.dataset.userPaused; if (!hero.hasAttribute('src')) hero.src=asset(hero.dataset.src); play(hero); }
      else { hero.dataset.userPaused='true'; hero.pause(); }
    });
    updateHero();
  }
  const presentation = document.querySelector('#presentation-video');
  if (presentation) {
    presentation.addEventListener('play', () => { presentationPlaying=true; syncVideos(); });
    ['pause','ended'].forEach(event => presentation.addEventListener(event, () => { presentationPlaying=false; syncVideos(); }));
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting && !presentation.paused) presentation.pause();
    }, {threshold:0}).observe(presentation);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { presentation?.pause(); dialogVideo?.pause(); }
    syncVideos();
  });
  reduced.addEventListener('change', syncVideos);
  const tabs = [...document.querySelectorAll('.ablation [role="tab"]')];
  function selectTab(tab, focus=false) {
    tabs.forEach(other => {
      const selected=other===tab;
      other.setAttribute('aria-selected', String(selected)); other.tabIndex=selected ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')).hidden=!selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key==='ArrowRight') next=(index+1)%tabs.length;
      if (event.key==='ArrowLeft') next=(index-1+tabs.length)%tabs.length;
      if (event.key==='Home') next=0;
      if (event.key==='End') next=tabs.length-1;
      if (next!==undefined) {event.preventDefault(); selectTab(tabs[next],true);}
    });
  });
  if (tabs.length) selectTab(tabs[0]);
  if (!data) return;
  const dialog=document.getElementById('demo-dialog');
  const dialogVideo=document.getElementById('dialog-video');
  const dialogTitle=document.getElementById('dialog-title');
  const dialogGroup=document.getElementById('dialog-group');
  const dialogCounter=document.getElementById('dialog-counter');
  let activeItems=[], activeIndex=0, lastTrigger=null;
  function showDemo(items,index,trigger) {
    activeItems=items; activeIndex=(index+items.length)%items.length;
    const item=activeItems[activeIndex];
    if (trigger) lastTrigger=trigger;
    dialogTitle.textContent=item.title;
    dialogGroup.textContent=names[item.group]+(item.group==='real' ? ' · 10×' : '');
    dialogCounter.textContent=`${activeIndex+1} / ${items.length}`;
    dialogVideo.pause(); dialogVideo.src=asset(item.video); dialogVideo.poster=asset(item.poster);
    dialogVideo.muted=true;
    modalOpen=true; syncVideos(); presentation?.pause();
    if (!dialog.open) { dialog.showModal(); document.body.classList.add('modal-open'); }
    play(dialogVideo);
  }
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=> {if(event.target===dialog){const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close();}});
  dialog.addEventListener('close',()=> {
    dialogVideo.pause(); dialogVideo.removeAttribute('src'); dialogVideo.load();
    modalOpen=false; document.body.classList.remove('modal-open'); syncVideos(); lastTrigger?.focus({preventScroll:true});
  });
  document.getElementById('dialog-prev').addEventListener('click',()=>showDemo(activeItems,activeIndex-1));
  document.getElementById('dialog-next').addEventListener('click',()=>showDemo(activeItems,activeIndex+1));
  dialog.addEventListener('keydown',event=>{
    if(event.target===dialogVideo) return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight') {event.preventDefault();showDemo(activeItems,activeIndex+(event.key==='ArrowRight'?1:-1));}
  });
  function card(item,index,items,autoplay) {
    const button=document.createElement('button'); button.type='button'; button.className='demo-card'; button.dataset.id=item.id;
    button.setAttribute('aria-label',`Play: ${item.title}`);
    const visual=document.createElement('span'); visual.className='demo-visual';
    const poster=document.createElement('img'); poster.src=asset(item.poster); poster.alt=''; poster.loading='lazy'; poster.decoding='async'; poster.width=960;poster.height=270;
    visual.append(poster);
    if(autoplay) {
      const video=document.createElement('video'); video.dataset.src=item.video; video.muted=true; video.loop=true; video.playsInline=true; video.preload='none'; video.setAttribute('aria-hidden','true');
      visual.append(video); observeVideo(video);
    }
    const icon=document.createElement('span');icon.className='demo-play';icon.innerHTML='<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.5v9L10 6z"/></svg>';visual.append(icon);
    const title=document.createElement('span');title.className='demo-title';title.textContent=item.title;
    button.append(visual,title);button.addEventListener('click',()=>showDemo(items,index,button));
    return button;
  }
  document.querySelectorAll('.carousel-section').forEach(section=>{
    const items=data[section.dataset.group],track=section.querySelector('.demo-track');
    items.forEach((item,index)=>track.append(card(item,index,items,true)));
    let visible=false,hovered=false,interacting=false,userPaused=reduced.matches||saveData,delay;
    const motion=section.querySelector('.carousel-motion');
    const updateMotion=()=>{motion.classList.toggle('is-paused',userPaused);motion.setAttribute('aria-pressed',String(userPaused));motion.setAttribute('aria-label',`${userPaused?'Resume':'Pause'} automatic scrolling`);};
    function step(direction) {
      const stride=track.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(track).gap);
      let target=track.scrollLeft+stride*direction;
      if(target>track.scrollWidth-track.clientWidth+1)target=0;
      if(target<0)target=track.scrollWidth-track.clientWidth;
      track.scrollTo({left:target,behavior:reduced.matches?'instant':'smooth'});
    }
    section.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>{step(Number(button.dataset.direction));interacting=true;clearTimeout(delay);delay=setTimeout(()=>{interacting=false;},10000);}));
    motion.addEventListener('click',()=>{userPaused=!userPaused;updateMotion();}); updateMotion();
    section.addEventListener('pointerenter',()=>{hovered=true;});section.addEventListener('pointerleave',()=>{hovered=false;});
    section.addEventListener('pointerdown',()=>{interacting=true;clearTimeout(delay);});
    section.addEventListener('pointerup',()=>{delay=setTimeout(()=>{interacting=false;},10000);});
    track.addEventListener('keydown',event=>{if(event.target===track&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}});
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{threshold:0.15}).observe(section);
    setInterval(()=>{if(visible&&!hovered&&!interacting&&!userPaused&&!reduced.matches&&!saveData&&!document.hidden&&!modalOpen&&!section.contains(document.activeElement))step(1);},7000);
  });
  if(isGallery) {
    const controls=[...document.querySelectorAll('.gallery-tabs [role=tab]')];
    const grid=document.querySelector('.gallery-grid');
    const input=document.getElementById('demo-search');
    const count=document.getElementById('gallery-count');
    const empty=document.getElementById('empty-state');
    let current=new URL(location.href).searchParams.get('set')==='robolab'?'robolab':'real';
    function render() {
      const query=input.value.trim().toLowerCase();
      const items=data[current].filter(item=>item.title.toLowerCase().includes(query));
      grid.replaceChildren(...items.map((item,index)=>card(item,index,items,false)));
      controls.forEach(button=>{const selected=button.dataset.set===current;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
      grid.setAttribute('aria-labelledby',`gallery-tab-${current}`);
      count.textContent=query?`${items.length} / ${data[current].length} demos`:`${data[current].length} demos${current==='real'?' · 10×':''}`;
      empty.hidden=items.length!==0;
      document.title=`${names[current]} · Embo-Harness`;
    }
    function setGroup(group) {
      current=group;input.value='';const url=new URL(location.href);url.searchParams.set('set',group);history.replaceState({},'',url);render();
    }
    controls.forEach((button,index)=>{
      button.addEventListener('click',()=>setGroup(button.dataset.set));
      button.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-index;setGroup(controls[next].dataset.set);controls[next].focus();}});
    });
    input.addEventListener('input',render);
    window.addEventListener('popstate',()=>{current=new URL(location.href).searchParams.get('set')==='robolab'?'robolab':'real';render();});
    render();
  }
})();
