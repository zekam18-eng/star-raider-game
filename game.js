// game.js — ядро игры: canvas, состояние, игрок, пули, HUD, главный цикл
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, DPR;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const vv = window.visualViewport;
    W = vv ? vv.width : window.innerWidth;
    H = vv ? vv.height : window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', resize);
  }
  resize();
  // iOS sometimes reports a stale viewport size right after load
  setTimeout(resize, 300);

  // ---------- state ----------
  let state = 'menu'; // menu | playing | dead
  let score = 0;
  let best = parseInt(localStorage.getItem('sr_best') || '0', 10);


  const MAX_HP = 5;
  const BASE_MAX_HP = 3;
  let maxHP = BASE_MAX_HP + hpLevel;
  let hp = maxHP;
  let shield = 0;
  const MAX_SHIELD = 3;
  let nextUpgradeScore = 500;
  const UPGRADE_INTERVAL = 500;
  let doubleShot = false;
  let bulletDamage = 1;
  let bossActive = false;
  let boss2000Spawned = false;
  let boss5000Spawned = false;
  let nightMode = false;
  const LOOP_SCORE = 10000;
  const AD_INTERVAL = 1000;
  let nextAdScore = AD_INTERVAL;
  let t = 0;
  let shakeTime = 0, shakeMag = 0;
  let spawnTimer = 0;
  let spawnInterval = 70;
  let difficulty = 1;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const hud = document.getElementById('hud');
  const hint = document.getElementById('hint');
  const overlay = document.getElementById('overlay');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const resumeBtn = document.getElementById('resumeBtn');
  const exitBtn = document.getElementById('exitBtn');
  const hpWrap = document.getElementById('hpWrap');
  const shieldWrap = document.getElementById('shieldWrap');
  const upgradeOverlay = document.getElementById('upgradeOverlay');
  const upgradeScoreVal = document.getElementById('upgradeScoreVal');
  const upgradeLifeBtn = document.getElementById('upgradeLifeBtn');
  const upgradeShieldBtn = document.getElementById('upgradeShieldBtn');
  const upgradeDoubleBtn = document.getElementById('upgradeDoubleBtn');
  const upgradeDamageBtn = document.getElementById('upgradeDamageBtn');
  bestEl.textContent = 'РЕКОРД: ' + best;

  function renderHP(){
    hpWrap.innerHTML = '';
    for(let i=0;i<maxHP;i++){
      const d = document.createElement('div');
      d.className = 'hp-pip' + (i < hp ? '' : ' off');
      hpWrap.appendChild(d);
    }
  }

  function renderShield(){
    shieldWrap.innerHTML = '';
    for(let i=0;i<shield;i++){
      const d = document.createElement('div');
      d.className = 'shield-pip';
      shieldWrap.appendChild(d);
    }
  }


  // ---------- player ----------
  const player = {
    x: 0, y: 0, r: 20,
    tx: 0, ty: 0,
    vx: 0, vy: 0,
    tilt: 0,
    invuln: 0,
    thrusterPulse: 0
  };
  function resetPlayer(){
    player.x = W*0.16; player.y = H*0.5;
    player.tx = player.x; player.ty = player.y;
    player.vx = 0; player.vy = 0;
    player.tilt = 0;
    player.invuln = 90;
  }

  // ---------- entities ----------
  let bullets = [];
  let enemies = [];
  let enemyBullets = [];
  let particles = [];
  let stars2 = []; // pickup sparkles unused placeholder

  function shoot(){
    if(doubleShot){
      bullets.push({ x: player.x + player.r, y: player.y - 10, vx: 11, r: 4, dmg: bulletDamage });
      bullets.push({ x: player.x + player.r, y: player.y + 10, vx: 11, r: 4, dmg: bulletDamage });
      spawnParticles(player.x + player.r, player.y - 10, 2, '#8fe7ff', 1.5, 0.6);
      spawnParticles(player.x + player.r, player.y + 10, 2, '#8fe7ff', 1.5, 0.6);
    } else {
      bullets.push({ x: player.x + player.r, y: player.y, vx: 11, r: 4, dmg: bulletDamage });
      spawnParticles(player.x + player.r, player.y, 2, '#8fe7ff', 1.5, 0.6);
    }
  }
  let shootTimer = 0;

  function spawnParticles(x,y,count,color,speed,life){
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const sp = (0.4+Math.random()*0.6)*speed;
      particles.push({
        x, y,
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        life: life + Math.random()*life,
        maxLife: life,
        color,
        r: 1.5 + Math.random()*2.5
      });
    }
  }

  function explode(x,y,big){
    const n = big ? 40 : 16;
    const colors = big ? ['#ff5f5f','#ffb84d','#fff2b0'] : ['#7fe8ff','#ffffff','#4dd0ff'];
    for(let i=0;i<n;i++){
      spawnParticles(x,y,1, colors[Math.floor(Math.random()*colors.length)], big? 6:3.2, big? 1.1:0.7);
    }
    shakeTime = big? 22 : 8;
    shakeMag = big? 14 : 5;
  }

  // ---------- input ----------

  // ---------- input ----------
  let pointerActive = false;
  function setPointer(clientX, clientY){
    player.tx = clientX;
    player.ty = clientY;
  }
  canvas.addEventListener('mousemove', e=>{ if(state==='playing') setPointer(e.clientX, e.clientY); });
  canvas.addEventListener('touchmove', e=>{
    if(state==='playing'){
      e.preventDefault();
      const touch = e.touches[0];
      setPointer(touch.clientX, touch.clientY - 40);
    }
  }, {passive:false});
  canvas.addEventListener('touchstart', e=>{
    if(state==='playing'){
      const touch = e.touches[0];
      setPointer(touch.clientX, touch.clientY - 40);
    }
  }, {passive:false});


  function drawShip(){
    const p = player;
    const colScheme = SHIP_COLORS[shipColor] || SHIP_COLORS.blue;
    const blinking = p.invuln > 0 && Math.floor(p.invuln/4)%2===0;
    if(blinking) ctx.globalAlpha = 0.4;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI/2 + p.tilt);

    // thruster flame
    const flameLen = 14 + Math.sin(t*0.6)*4 + player.thrusterPulse;
    const fg = ctx.createLinearGradient(0, p.r*0.6, 0, p.r*0.6+flameLen);
    fg.addColorStop(0, 'rgba(120,220,255,0.95)');
    fg.addColorStop(0.5, 'rgba(80,160,255,0.6)');
    fg.addColorStop(1, 'rgba(80,160,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-6, p.r*0.55);
    ctx.lineTo(0, p.r*0.55+flameLen);
    ctx.lineTo(6, p.r*0.55);
    ctx.closePath();
    ctx.fill();

    // glow
    ctx.shadowColor = colScheme.glow;
    ctx.shadowBlur = 22;

    // body
    ctx.beginPath();
    ctx.moveTo(0, -p.r*1.15);
    ctx.quadraticCurveTo(p.r*0.9, p.r*0.2, p.r*0.75, p.r*0.75);
    ctx.lineTo(p.r*0.25, p.r*0.5);
    ctx.lineTo(-p.r*0.25, p.r*0.5);
    ctx.lineTo(-p.r*0.75, p.r*0.75);
    ctx.quadraticCurveTo(-p.r*0.9, p.r*0.2, 0, -p.r*1.15);
    ctx.closePath();

    if(colScheme.flag){
      // outer glow silhouette first (shadow gets clipped away once we clip below)
      ctx.fillStyle = colScheme.mid;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.clip();
      const topY = -p.r*1.15, botY = p.r*0.9;
      const bandH = (botY - topY) / 3;
      ctx.fillStyle = colScheme.light;
      ctx.fillRect(-p.r, topY, p.r*2, bandH);
      ctx.fillStyle = colScheme.mid;
      ctx.fillRect(-p.r, topY+bandH, p.r*2, bandH);
      ctx.fillStyle = colScheme.dark;
      ctx.fillRect(-p.r, topY+bandH*2, p.r*2, bandH+2);
      ctx.restore();
    } else {
      const bodyGrad = ctx.createLinearGradient(0,-p.r,0,p.r);
      bodyGrad.addColorStop(0, colScheme.light);
      bodyGrad.addColorStop(0.5, colScheme.mid);
      bodyGrad.addColorStop(1, colScheme.dark);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    // cockpit
    ctx.fillStyle = '#062a3f';
    ctx.beginPath();
    ctx.ellipse(0, -p.r*0.15, p.r*0.28, p.r*0.4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,240,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-p.r*0.08, -p.r*0.28, p.r*0.1, p.r*0.16, -0.4, 0, Math.PI*2);
    ctx.fill();

    // wing accents
    ctx.fillStyle = colScheme.wing;
    ctx.beginPath();
    ctx.moveTo(p.r*0.75, p.r*0.75);
    ctx.lineTo(p.r*0.95, p.r*0.55);
    ctx.lineTo(p.r*0.55, p.r*0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-p.r*0.75, p.r*0.75);
    ctx.lineTo(-p.r*0.95, p.r*0.55);
    ctx.lineTo(-p.r*0.55, p.r*0.55);
    ctx.closePath();
    ctx.fill();

    if(colScheme.symbol === 'heart'){
      const hs = p.r*0.34;
      ctx.save();
      ctx.translate(0, p.r*0.18);
      ctx.scale(hs, hs);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0.32);
      ctx.bezierCurveTo(0, 0.1, -0.28, -0.12, -0.55, 0.1);
      ctx.bezierCurveTo(-0.85, 0.38, -0.5, 0.72, 0, 1.02);
      ctx.bezierCurveTo(0.5, 0.72, 0.85, 0.38, 0.55, 0.1);
      ctx.bezierCurveTo(0.28, -0.12, 0, 0.1, 0, 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }


  function drawBossHealthBar(){
    const boss = enemies.find(e=>e.isBoss);
    if(!boss) return;
    const barW = Math.min(320, W*0.7);
    const barH = 14;
    const x = W/2 - barW/2;
    const y = 14;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x-3,y-3,barW+6,barH+6);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x,y,barW,barH);
    const pct = Math.max(0, boss.hp/boss.maxHp);
    ctx.fillStyle = boss.bossKind==='ship' ? '#dfe6f2' : '#ff5f5f';
    ctx.fillRect(x,y,barW*pct,barH);
    ctx.fillStyle = '#fff';
    ctx.font = '11px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(boss.bossKind==='ship' ? 'БЕЛЫЙ КОРАБЛЬ-ПРИЗРАК' : 'БОЕВОЙ РОБОТ', W/2, y+barH+14);
    ctx.restore();
  }


  // ---------- game loop pieces ----------
  function updatePlayer(dt){
    // ease toward target
    player.vx += (player.tx - player.x) * 0.16 * dt;
    player.vy += (player.ty - player.y) * 0.16 * dt;
    player.vx *= Math.pow(0.72, dt);
    player.vy *= Math.pow(0.72, dt);
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    player.x = Math.max(player.r, Math.min(W*0.62, player.x));
    player.y = Math.max(player.r, Math.min(H-player.r, player.y));

    player.tilt = Math.max(-0.5, Math.min(0.5, player.vy*0.05));
    player.thrusterPulse = Math.min(10, Math.abs(player.vx)+Math.abs(player.vy));

    if(player.invuln>0) player.invuln -= dt;
  }


  function updateBullets(dt){
    for(let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      b.x += b.vx * dt;
      if(b.x > W+20) bullets.splice(i,1);
    }
  }


  function onPlayerHit(ex,ey){
    if(shield > 0){
      shield--;
      renderShield();
      explode((player.x+ex)/2, (player.y+ey)/2, false);
      player.invuln = 60;
      return;
    }
    hp--;
    renderHP();
    explode((player.x+ex)/2, (player.y+ey)/2, true);
    player.invuln = 100;
    if(hp<=0){
      endGame();
    }
  }


  function updateParticles(dt){
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.96, dt); p.vy *= Math.pow(0.96, dt);
      p.life -= dt/60;
      if(p.life<=0) particles.splice(i,1);
    }
  }


  function drawBullets(){
    for(const b of bullets){
      ctx.save();
      ctx.shadowColor = '#8fe7ff';
      ctx.shadowBlur = 12;
      const g = ctx.createLinearGradient(b.x-10,b.y,b.x+6,b.y);
      g.addColorStop(0,'rgba(255,255,255,0)');
      g.addColorStop(1,'#bff3ff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(b.x,b.y,10,b.r*0.6,0,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }


  function drawParticles(){
    for(const p of particles){
      const a = Math.max(0, p.life/p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateDifficulty(){
    difficulty = 1 + score/400;
    spawnInterval = Math.max(24, 70 - score/12);
  }

  // ---------- lifecycle: pause everything while the app is hidden ----------
  // Required by VK Mini Apps review (life-cycle events, e.g. must stop
  // any activity/sound on VKWebAppViewHide). Also covers a plain browser
  // tab switch via the Page Visibility API as a fallback.
  let appHidden = false;
  document.addEventListener('visibilitychange', () => {
    appHidden = document.hidden;
  });
  try {
    if (window.vkBridge) {
      window.vkBridge.subscribe((e) => {
        const type = e && e.detail && e.detail.type;
        if (type === 'VKWebAppViewHide') {
          appHidden = true;
        } else if (type === 'VKWebAppViewRestore' || type === 'VKWebAppUpdateConfig') {
          appHidden = false;
        }
      });
    }
  } catch (e) {
    // not running inside VK — ignore
  }

  // ---------- main loop ----------
  let lastTime = performance.now();
  function loop(now){
    requestAnimationFrame(loop);
    if(appHidden || state==='paused'){
      lastTime = now;
      return;
    }
    const rawDt = (now - lastTime) / 16.6667; // 1 = one frame at 60fps
    lastTime = now;
    const dt = Math.max(0, Math.min(3, rawDt)); // clamp to avoid huge jumps (tab switch, lag spikes)
    t += dt;

    ctx.save();
    if(shakeTime>0){
      shakeTime -= dt;
      const dx = (Math.random()-0.5)*shakeMag;
      const dy = (Math.random()-0.5)*shakeMag;
      ctx.translate(dx,dy);
    }

    drawCityBg((state==='playing' || state==='upgrade' ? 1 : 0.3) * dt);

    if(state==='playing'){
      updateDifficulty();
      updatePlayer(dt);

      shootTimer -= dt;
      if(shootTimer<=0){ shoot(); shootTimer = 8; }

      if(!bossActive){
        if(!boss2000Spawned && score >= 2000){
          spawnBossRobot();
          boss2000Spawned = true;
          bossActive = true;
        } else if(!boss5000Spawned && score >= 5000){
          spawnBossShip();
          boss5000Spawned = true;
          bossActive = true;
        }
      }

      if(!bossActive){
        spawnTimer -= dt;
        if(spawnTimer<=0){ spawnEnemy(); spawnTimer = spawnInterval + Math.random()*20; }
      }

      updateBullets(dt);
      updateEnemies(dt);
      updateEnemyBullets(dt);
      updateParticles(dt);

      score += 0.12 * dt;
      scoreEl.textContent = Math.floor(score);

      if(score >= LOOP_SCORE){
        triggerLoopRestart();
      } else if(score >= nextAdScore){
        nextAdScore += AD_INTERVAL;
        triggerAutoAd();
      } else {
        maybeShowUpgrade();
      }
    } else {
      updateParticles(dt);
    }

    drawParticles();
    for(const e of enemies){
      if(e.bossKind === 'ship') drawEnemyShip(e);
      else drawEnemy(e);
    }
    drawBullets();
    drawEnemyBullets();
    if(state==='playing' || state==='dead' || state==='upgrade') drawShip();
    if(state==='playing' || state==='upgrade') drawBossHealthBar();

    ctx.restore();
  }

  // ---------- game flow ----------
  function triggerLoopRestart(){
    const finalScore = Math.floor(score);
    if(finalScore > best){
      best = finalScore;
      localStorage.setItem('sr_best', best);
      bestEl.textContent = 'РЕКОРД: ' + best;
    }
    nightMode = true;
    score = 0;
    scoreEl.textContent = '0';
    maxHP = BASE_MAX_HP + hpLevel;
    hp = maxHP;
    shield = 0;
    doubleShot = false;
    bulletDamage = 1;
    nextUpgradeScore = UPGRADE_INTERVAL;
    nextAdScore = AD_INTERVAL;
    boss2000Spawned = false;
    boss5000Spawned = false;
    bossActive = false;
    bullets = []; enemies = []; enemyBullets = []; particles = [];
    spawnTimer = 40;
    resetPlayer();
    renderHP();
    renderShield();
    upgradeOverlay.style.display = 'none';
    if(state==='upgrade') state = 'playing';
    shakeTime = 30; shakeMag = 18;
  }

  function startGame(){
    score = 0;
    maxHP = BASE_MAX_HP + hpLevel;
    hp = maxHP;
    shield = 0;
    doubleShot = false;
    bulletDamage = 1;
    bossActive = false;
    boss2000Spawned = false;
    boss5000Spawned = false;
    nightMode = false;
    nextUpgradeScore = UPGRADE_INTERVAL;
    nextAdScore = AD_INTERVAL;
    bullets = []; enemies = []; enemyBullets = []; particles = [];
    spawnTimer = 40;
    resetPlayer();
    renderHP();
    renderShield();
    upgradeOverlay.style.display = 'none';
    state = 'playing';
    overlay.style.display = 'none';
    hud.style.display = 'flex';
    pauseBtn.style.display = 'flex';
    hint.style.display = 'block';
    setTimeout(()=>{ hint.style.display='none'; }, 2600);
  }

  function endGame(){
    state = 'dead';
    hud.style.display = 'none';
    pauseBtn.style.display = 'none';
    hint.style.display = 'none';
    const finalScore = Math.floor(score);
    if(finalScore > best){
      best = finalScore;
      localStorage.setItem('sr_best', best);
    }
    bestEl.textContent = 'РЕКОРД: ' + best;

    overlay.innerHTML = `
      <div class="finalLabel">Миссия окончена</div>
      <div class="finalScore">${finalScore}</div>
      <div class="bestLine">★ Рекорд: ${best}</div>
      <div id="currencyLine">Очки за роботов: <span id="currencyVal">0</span></div>
      <div id="colorPicker"></div>
      <div id="metaShop"></div>
      <button id="playBtn">ЕЩЁ РАЗ</button>
    `;
    overlay.style.display = 'flex';
    renderColorPicker();
    renderMetaShop();
    document.getElementById('playBtn').addEventListener('click', startGame);
  }

  function triggerAutoAd(){
    if(state !== 'playing') return;
    state = 'paused'; // переиспользуем заморозку цикла — своё окно паузы не показываем
    if(typeof showAutoAd === 'function'){
      showAutoAd(()=>{
        if(state === 'paused') state = 'playing';
      });
    } else {
      state = 'playing';
    }
  }

  function pauseGame(){
    if(state !== 'playing') return;
    state = 'paused';
    pauseOverlay.style.display = 'flex';
  }

  function resumeGame(){
    if(state !== 'paused') return;
    state = 'playing';
    pauseOverlay.style.display = 'none';
  }

  function exitToMenu(){
    const finalScore = Math.floor(score);
    if(finalScore > best){
      best = finalScore;
      localStorage.setItem('sr_best', best);
    }
    bestEl.textContent = 'РЕКОРД: ' + best;

    state = 'menu';
    pauseOverlay.style.display = 'none';
    hud.style.display = 'none';
    pauseBtn.style.display = 'none';
    hint.style.display = 'none';
    bullets = []; enemies = []; enemyBullets = []; particles = [];

    overlay.innerHTML = `
      <h1>STAR RAIDER</h1>
      <div class="sub">Уклоняйся, стреляй по роботам-дронам и набирай очки.<br>Одно столкновение — и миссия окончена.</div>
      <div id="currencyLine">Очки за роботов: <span id="currencyVal">0</span></div>
      <div id="colorPicker"></div>
      <div id="metaShop"></div>
      <button id="playBtn">ИГРАТЬ</button>
    `;
    overlay.style.display = 'flex';
    renderColorPicker();
    renderMetaShop();
    document.getElementById('playBtn').addEventListener('click', startGame);
  }

  pauseBtn.addEventListener('click', pauseGame);
  resumeBtn.addEventListener('click', resumeGame);
  exitBtn.addEventListener('click', exitToMenu);

  renderColorPicker();
  renderMetaShop();
  playBtn.addEventListener('click', startGame);

  requestAnimationFrame(loop);
