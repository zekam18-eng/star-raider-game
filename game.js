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
  let nightModeTriggered = false;
  let revivesUsedThisRun = 0;
  const LOOP_SCORE = 10000;
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
  // ---------- звук (синтез через Web Audio API, без внешних файлов) ----------
  let audioCtx = null;
  let masterGain = null;
  let soundOn = localStorage.getItem('sr_sound') !== 'off';

  function ensureAudio(){
    if(audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(audioCtx.destination);
    } catch(e) {
      // Web Audio недоступен — тихо игнорируем
    }
  }

  function playTone(freq, duration, type, vol, freqEnd){
    if(!soundOn) return;
    ensureAudio();
    if(!audioCtx) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if(freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol || 0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function playNoise(duration, vol){
    if(!soundOn) return;
    ensureAudio();
    if(!audioCtx) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){
      data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
  }

  function playSfx(name){
    switch(name){
      case 'shoot': playTone(880, 0.06, 'square', 0.05, 500); break;
      case 'hit': playTone(220, 0.25, 'sawtooth', 0.22, 60); break;
      case 'explosion': playNoise(0.28, 0.22); playTone(120, 0.2, 'sawtooth', 0.14, 40); break;
      case 'bossExplosion': playNoise(0.6, 0.32); playTone(90, 0.5, 'sawtooth', 0.22, 30); break;
      case 'powerup': playTone(400, 0.15, 'sine', 0.18, 900); break;
      case 'heal': playTone(600, 0.2, 'sine', 0.18, 1000); break;
      case 'upgrade':
        playTone(500, 0.12, 'triangle', 0.18, 800);
        setTimeout(()=>playTone(800, 0.15, 'triangle', 0.18, 1200), 90);
        break;
      case 'click': playTone(700, 0.05, 'square', 0.08); break;
      case 'revive': playTone(300, 0.3, 'sine', 0.22, 900); break;
      case 'gameover': playTone(200, 0.6, 'sawtooth', 0.22, 60); break;
    }
  }

  function toggleSound(){
    soundOn = !soundOn;
    localStorage.setItem('sr_sound', soundOn ? 'on' : 'off');
    updateSoundBtn();
    if(soundOn) playSfx('click');
  }

  function updateSoundBtn(){
    const btn = document.getElementById('soundToggleBtn');
    if(btn) btn.textContent = soundOn ? '🔊' : '🔇';
  }

  let currentMode = 'earth'; // 'earth' | 'space' — фиксируется при старте игры из gameMode
  let bullets = [];
  let enemies = [];
  let enemyBullets = [];
  let particles = [];
  let powerups = [];
  let stars2 = []; // pickup sparkles unused placeholder

  // ---------- временные бусты (дроп с врагов) ----------
  const POWERUP_TYPES = {
    rapid: { name: 'Ускорение стрельбы', color: '#4be9ff' },
    heal:  { name: '+1 HP', color: '#4dffa0' }
  };
  const POWERUP_DROP_CHANCE = 0.1;
  const POWERUP_DURATION = 480; // ~8 сек при 60fps (dt-юниты), актуально только для rapid
  let activeBuff = null; // { type, time }
  const buffIndicatorEl = document.getElementById('buffIndicator');

  function buffMultiplier(kind){
    return (activeBuff && activeBuff.type === kind) ? 2 : 1;
  }

  function maybeDropPowerup(x, y){
    if(Math.random() < POWERUP_DROP_CHANCE){
      const keys = Object.keys(POWERUP_TYPES);
      const kind = keys[Math.floor(Math.random()*keys.length)];
      powerups.push({ x, y, r: 15, kind, phase: Math.random()*Math.PI*2 });
    }
  }

  function applyPowerup(kind){
    const c = POWERUP_TYPES[kind].color;
    spawnParticles(player.x, player.y, 18, c, 4, 0.8);
    if(kind === 'heal'){
      if(hp < maxHP){
        hp++;
        renderHP();
      }
      playSfx('heal');
    } else {
      activeBuff = { type: kind, time: POWERUP_DURATION };
      renderBuffIndicator();
      playSfx('powerup');
    }
  }

  function updatePowerups(dt){
    for(let i=powerups.length-1;i>=0;i--){
      const p = powerups[i];
      p.x -= 2.2 * dt;
      p.y += Math.sin(t*0.05 + p.phase) * 0.6 * dt;
      if(p.x + p.r < 0){
        powerups.splice(i,1);
        continue;
      }
      const dx = player.x - p.x, dy = player.y - p.y;
      const rad = player.r*0.75 + p.r;
      if(dx*dx+dy*dy < rad*rad){
        applyPowerup(p.kind);
        powerups.splice(i,1);
      }
    }
  }

  function drawPowerups(){
    for(const p of powerups){
      const c = POWERUP_TYPES[p.kind].color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t*0.02);
      ctx.beginPath();
      for(let k=0;k<6;k++){
        const ang = (Math.PI/3)*k;
        const px = Math.cos(ang)*p.r, py = Math.sin(ang)*p.r;
        if(k===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = c;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.restore();
    }
  }

  function renderBuffIndicator(){
    if(!buffIndicatorEl) return;
    if(activeBuff){
      const info = POWERUP_TYPES[activeBuff.type];
      const secs = Math.max(0, Math.ceil(activeBuff.time/60));
      buffIndicatorEl.style.display = 'flex';
      buffIndicatorEl.innerHTML = `<span class="buffDot" style="background:${info.color};box-shadow:0 0 8px ${info.color}"></span>${info.name} · ${secs}с`;
    } else {
      buffIndicatorEl.style.display = 'none';
      buffIndicatorEl.innerHTML = '';
    }
  }

  function shoot(){
    const dmg = bulletDamage;
    playSfx('shoot');
    if(doubleShot){
      bullets.push({ x: player.x + player.r, y: player.y - 10, vx: 11, r: 4, dmg });
      bullets.push({ x: player.x + player.r, y: player.y + 10, vx: 11, r: 4, dmg });
      spawnParticles(player.x + player.r, player.y - 10, 2, '#8fe7ff', 1.5, 0.6);
      spawnParticles(player.x + player.r, player.y + 10, 2, '#8fe7ff', 1.5, 0.6);
    } else {
      bullets.push({ x: player.x + player.r, y: player.y, vx: 11, r: 4, dmg });
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
    const blinking = p.invuln > 0 && Math.floor(p.invuln/4)%2===0;
    drawShipOn(ctx, p.x, p.y, p.r, p.tilt, shipColor, blinking, true);
  }

  function drawShipOn(targetCtx, cx, cy, r, tilt, colorKey, blinking, withFlame){
    const colScheme = SHIP_COLORS[colorKey] || SHIP_COLORS.blue;
    if(blinking) targetCtx.globalAlpha = 0.4;

    targetCtx.save();
    targetCtx.translate(cx, cy);
    targetCtx.rotate(Math.PI/2 + tilt);

    if(withFlame){
      // thruster flame
      const flameLen = 14 + Math.sin(t*0.6)*4 + player.thrusterPulse;
      const fg = targetCtx.createLinearGradient(0, r*0.82, 0, r*0.82+flameLen);
      fg.addColorStop(0, 'rgba(120,220,255,0.95)');
      fg.addColorStop(0.5, 'rgba(80,160,255,0.6)');
      fg.addColorStop(1, 'rgba(80,160,255,0)');
      targetCtx.fillStyle = fg;
      targetCtx.beginPath();
      targetCtx.moveTo(-6, r*0.78);
      targetCtx.lineTo(0, r*0.78+flameLen);
      targetCtx.lineTo(6, r*0.78);
      targetCtx.closePath();
      targetCtx.fill();
    }

    // glow
    targetCtx.shadowColor = colScheme.glow;
    targetCtx.shadowBlur = 22;

    // body — округлый вытянутый корпус (капсула), как у референсного корабля
    const noseY = -r*1.2, rearY = r*0.82;
    targetCtx.beginPath();
    targetCtx.moveTo(0, noseY);
    targetCtx.bezierCurveTo(r*0.58, -r*1.02, r*0.92, -r*0.38, r*0.8, r*0.12);
    targetCtx.bezierCurveTo(r*0.75, r*0.42, r*0.6, r*0.62, r*0.48, rearY);
    targetCtx.lineTo(-r*0.48, rearY);
    targetCtx.bezierCurveTo(-r*0.6, r*0.62, -r*0.75, r*0.42, -r*0.8, r*0.12);
    targetCtx.bezierCurveTo(-r*0.92, -r*0.38, -r*0.58, -r*1.02, 0, noseY);
    targetCtx.closePath();

    if(colScheme.flag){
      // outer glow silhouette first (shadow gets clipped away once we clip below)
      targetCtx.fillStyle = colScheme.mid;
      targetCtx.fill();
      targetCtx.shadowBlur = 0;
      targetCtx.save();
      targetCtx.clip();
      const topY = noseY, botY = rearY;
      const bandH = (botY - topY) / 3;
      targetCtx.fillStyle = colScheme.light;
      targetCtx.fillRect(-r, topY, r*2, bandH);
      targetCtx.fillStyle = colScheme.mid;
      targetCtx.fillRect(-r, topY+bandH, r*2, bandH);
      targetCtx.fillStyle = colScheme.dark;
      targetCtx.fillRect(-r, topY+bandH*2, r*2, bandH+2);
      targetCtx.restore();
    } else {
      const bodyGrad = targetCtx.createLinearGradient(0,noseY,0,rearY);
      bodyGrad.addColorStop(0, colScheme.light);
      bodyGrad.addColorStop(0.5, colScheme.mid);
      bodyGrad.addColorStop(1, colScheme.dark);
      targetCtx.fillStyle = bodyGrad;
      targetCtx.fill();
    }

    // тонкая обводка корпуса для чёткости силуэта
    targetCtx.shadowBlur = 0;
    targetCtx.lineWidth = Math.max(1, r*0.03);
    targetCtx.strokeStyle = 'rgba(0,0,0,0.35)';
    targetCtx.stroke();

    // купол кабины — крупный округлый "фонарь", как на референсе
    targetCtx.fillStyle = '#062a3f';
    targetCtx.beginPath();
    targetCtx.ellipse(0, -r*0.28, r*0.34, r*0.42, 0, 0, Math.PI*2);
    targetCtx.fill();
    targetCtx.strokeStyle = 'rgba(255,255,255,0.25)';
    targetCtx.lineWidth = Math.max(1, r*0.025);
    targetCtx.stroke();
    targetCtx.fillStyle = 'rgba(180,240,255,0.85)';
    targetCtx.beginPath();
    targetCtx.ellipse(-r*0.1, -r*0.42, r*0.11, r*0.17, -0.4, 0, Math.PI*2);
    targetCtx.fill();

    // боковые двигательные капсулы (вместо треугольных крыльев)
    targetCtx.fillStyle = colScheme.wing;
    targetCtx.beginPath();
    targetCtx.ellipse(r*0.78, r*0.42, r*0.16, r*0.28, -0.25, 0, Math.PI*2);
    targetCtx.fill();
    targetCtx.beginPath();
    targetCtx.ellipse(-r*0.78, r*0.42, r*0.16, r*0.28, 0.25, 0, Math.PI*2);
    targetCtx.fill();
    // тёмные ободки капсул для объёма
    targetCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    targetCtx.lineWidth = Math.max(1, r*0.02);
    targetCtx.beginPath();
    targetCtx.ellipse(r*0.78, r*0.42, r*0.16, r*0.28, -0.25, 0, Math.PI*2);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.ellipse(-r*0.78, r*0.42, r*0.16, r*0.28, 0.25, 0, Math.PI*2);
    targetCtx.stroke();

    if(colScheme.symbol === 'heart'){
      const hs = r*0.34;
      targetCtx.save();
      targetCtx.translate(0, r*0.18);
      targetCtx.scale(hs, hs);
      targetCtx.fillStyle = '#ffffff';
      targetCtx.shadowColor = 'rgba(255,255,255,0.8)';
      targetCtx.shadowBlur = 6;
      targetCtx.beginPath();
      targetCtx.moveTo(0, 0.32);
      targetCtx.bezierCurveTo(0, 0.1, -0.28, -0.12, -0.55, 0.1);
      targetCtx.bezierCurveTo(-0.85, 0.38, -0.5, 0.72, 0, 1.02);
      targetCtx.bezierCurveTo(0.5, 0.72, 0.85, 0.38, 0.55, 0.1);
      targetCtx.bezierCurveTo(0.28, -0.12, 0, 0.1, 0, 0.32);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.restore();
    }

    targetCtx.restore();
    targetCtx.globalAlpha = 1;
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
    playSfx('hit');
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
      if(revivesUsedThisRun < 1){
        showReviveOffer();
      } else {
        endGame();
      }
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
      if(shootTimer<=0){ shoot(); shootTimer = 8 * (buffMultiplier('rapid')>1 ? 0.5 : 1); }

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
      updatePowerups(dt);

      if(activeBuff){
        activeBuff.time -= dt;
        if(activeBuff.time <= 0){
          activeBuff = null;
        }
        renderBuffIndicator();
      }

      score += 0.12 * dt;
      scoreEl.textContent = Math.floor(score);

      if(score >= LOOP_SCORE && !nightModeTriggered){
        nightModeTriggered = true;
        nightMode = true;
        shakeTime = 30; shakeMag = 18;
      }
      maybeShowUpgrade();
      maybeShowMilestoneAd(score);
    } else {
      updateParticles(dt);
    }

    drawParticles();
    drawPowerups();
    for(const e of enemies){
      if(e.bossKind === 'ship') drawEnemyShip(e);
      else drawEnemy(e);
    }
    drawBullets();
    drawEnemyBullets();
    if(state==='playing' || state==='dead' || state==='upgrade' || state==='revive') drawShip();
    if(state==='playing' || state==='upgrade') drawBossHealthBar();

    ctx.restore();
  }

  // ---------- game flow ----------

  function startGame(){
    playSfx('click');
    currentMode = gameMode;
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
    nightModeTriggered = false;
    revivesUsedThisRun = 0;
    nextUpgradeScore = UPGRADE_INTERVAL;
    resetScoreAdMilestone();
    bullets = []; enemies = []; enemyBullets = []; particles = []; powerups = []; activeBuff = null; renderBuffIndicator();
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

  // ---------- возрождение после смерти (за монеты или рекламу, 1 раз за забег) ----------
  const reviveOverlay = document.getElementById('reviveOverlay');
  const reviveCoinsBtn = document.getElementById('reviveCoinsBtn');
  const reviveAdBtn = document.getElementById('reviveAdBtn');
  const reviveDeclineBtn = document.getElementById('reviveDeclineBtn');
  const REVIVE_COST = 100;

  function showReviveOffer(){
    state = 'revive';
    reviveCoinsBtn.textContent = `Возродиться · ${REVIVE_COST} монет`;
    reviveCoinsBtn.disabled = currency < REVIVE_COST;
    reviveCoinsBtn.style.opacity = currency < REVIVE_COST ? '0.5' : '1';
    reviveOverlay.style.display = 'flex';
  }

  function doRevive(){
    playSfx('revive');
    revivesUsedThisRun++;
    reviveOverlay.style.display = 'none';
    hp = Math.max(1, Math.min(maxHP, 1));
    renderHP();
    player.invuln = 120;
    // очищаем ближайших врагов и вражеские пули вокруг корабля — честный рестарт
    enemies = enemies.filter(e => {
      const dx = e.x-player.x, dy = e.y-player.y;
      return Math.sqrt(dx*dx+dy*dy) > 180;
    });
    enemyBullets = [];
    shakeTime = 0;
    state = 'playing';
  }

  reviveCoinsBtn.addEventListener('click', ()=>{
    if(currency < REVIVE_COST) return;
    currency -= REVIVE_COST;
    saveCurrency();
    doRevive();
  });
  reviveAdBtn.addEventListener('click', ()=>{
    watchAdForRevive(
      ()=>{ doRevive(); },
      ()=>{ alert('Реклама сейчас недоступна. Попробуй монеты или заверши миссию.'); }
    );
  });
  reviveDeclineBtn.addEventListener('click', ()=>{
    reviveOverlay.style.display = 'none';
    endGame();
  });

  function endGame(){
    playSfx('gameover');
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
      <div class="dustLayer" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="cockpitLayer" aria-hidden="true">
        <div class="cockpitTop">
          <span><span class="statusDot"></span>СЕКТОР 7-G <span class="sep">·</span> КВАДРАНТ VII</span>
          <span>СТАТУС: МИССИЯ ЗАВЕРШЕНА</span>
        </div>
        <div class="cockpitLeft">
          <div class="cockpitLabel">ЦЕЛЬ МИССИИ</div>
          <div class="objRow"><span class="ring"></span>Уничтожай роботов-дронов</div>
          <div class="objRow"><span class="ring"></span>Собирай очки и монеты</div>
          <div class="objRow"><span class="ring"></span>Избегай столкновений</div>
        </div>
        <div class="cockpitRight">
          <div class="cockpitLabel">РЕАКТОР</div>
          <div class="reactorBars"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          <div class="reactorVal">ОЖИДАНИЕ</div>
        </div>
      </div>
      <div class="finalLabel">Миссия окончена</div>
      <div class="finalScore">${finalScore}</div>
      <div class="bestLine">★ Рекорд: ${best}</div>
      <div id="currencyLine">Очки за роботов: <span id="currencyVal">0</span></div>
      <div id="colorPicker"></div>
      <div class="modeSwitch">
        <button id="modeEarthBtn" class="modeBtn active">ЗЕМЛЯ</button>
        <button id="modeSpaceBtn" class="modeBtn">КОСМОС</button>
      </div>
      <div id="metaShop"></div>
      <div class="menuBtnRow">
        <button id="hangarOpenBtn" class="hangarOpenBtn">🛰 АНГАР</button>
        <button id="leaderboardOpenBtn" class="leaderboardBtn">🏆 ЛИДЕРЫ</button>
      </div>
      <button id="playBtn">ЕЩЁ РАЗ</button>
      <br>
      <a href="https://vk.ru/futerstory" target="_blank" rel="noopener" class="vkCommunityLink">Наше сообщество ВКонтакте →</a>
    `;
    overlay.style.display = 'flex';
    renderColorPicker();
    renderMetaShop();
    document.getElementById('playBtn').addEventListener('click', startGame);
    document.getElementById('hangarOpenBtn').addEventListener('click', openHangar);
    document.getElementById('leaderboardOpenBtn').addEventListener('click', showFriendsLeaderboard);
    bindModeSwitch();
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
    bullets = []; enemies = []; enemyBullets = []; particles = []; powerups = []; activeBuff = null; renderBuffIndicator();

    overlay.innerHTML = `
      <div class="dustLayer" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="cockpitLayer" aria-hidden="true">
        <div class="cockpitTop">
          <span><span class="statusDot"></span>СЕКТОР 7-G <span class="sep">·</span> КВАДРАНТ VII</span>
          <span>СТАТУС: ГОТОВ К ВЫЛЕТУ</span>
        </div>
        <div class="cockpitLeft">
          <div class="cockpitLabel">ЦЕЛЬ МИССИИ</div>
          <div class="objRow"><span class="ring"></span>Уничтожай роботов-дронов</div>
          <div class="objRow"><span class="ring"></span>Собирай очки и монеты</div>
          <div class="objRow"><span class="ring"></span>Избегай столкновений</div>
        </div>
        <div class="cockpitRight">
          <div class="cockpitLabel">РЕАКТОР</div>
          <div class="reactorBars"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          <div class="reactorVal">100% СТАБИЛЕН</div>
        </div>
      </div>
      <h1>STAR RAIDER</h1>
      <div class="sub">Уклоняйся, стреляй по роботам-дронам и набирай очки.<br>Одно столкновение — и миссия окончена.</div>
      <div id="currencyLine">Очки за роботов: <span id="currencyVal">0</span></div>
      <div id="colorPicker"></div>
      <div class="modeSwitch">
        <button id="modeEarthBtn" class="modeBtn active">ЗЕМЛЯ</button>
        <button id="modeSpaceBtn" class="modeBtn">КОСМОС</button>
      </div>
      <div id="metaShop"></div>
      <div class="menuBtnRow">
        <button id="hangarOpenBtn" class="hangarOpenBtn">🛰 АНГАР</button>
        <button id="leaderboardOpenBtn" class="leaderboardBtn">🏆 ЛИДЕРЫ</button>
      </div>
      <button id="playBtn">ИГРАТЬ</button>
      <br>
      <a href="https://vk.ru/futerstory" target="_blank" rel="noopener" class="vkCommunityLink">Наше сообщество ВКонтакте →</a>
    `;
    overlay.style.display = 'flex';
    renderColorPicker();
    renderMetaShop();
    document.getElementById('playBtn').addEventListener('click', startGame);
    document.getElementById('hangarOpenBtn').addEventListener('click', openHangar);
    document.getElementById('leaderboardOpenBtn').addEventListener('click', showFriendsLeaderboard);
    bindModeSwitch();
  }

  pauseBtn.addEventListener('click', pauseGame);
  document.getElementById('soundToggleBtn').addEventListener('click', toggleSound);
  updateSoundBtn();
  resumeBtn.addEventListener('click', resumeGame);
  exitBtn.addEventListener('click', exitToMenu);

  // ---------- Ангар (просмотр/экипировка кораблей) ----------
  const hangarOverlay = document.getElementById('hangarOverlay');
  const hangarCanvas = document.getElementById('hangarCanvas');
  const hangarCtx = hangarCanvas.getContext('2d');
  const hangarShipNameEl = document.getElementById('hangarShipName');
  const hangarEquipBtn = document.getElementById('hangarEquipBtn');
  const hangarPrevBtn = document.getElementById('hangarPrevBtn');
  const hangarNextBtn = document.getElementById('hangarNextBtn');
  const hangarCloseBtn = document.getElementById('hangarCloseBtn');
  let hangarPreviewColor = shipColor;

  function renderHangarPreview(){
    hangarCtx.clearRect(0,0,hangarCanvas.width, hangarCanvas.height);
    drawShipOn(hangarCtx, hangarCanvas.width/2, hangarCanvas.height/2, 62, -0.08, hangarPreviewColor, false, false);
    const info = SHIP_COLORS[hangarPreviewColor] || SHIP_COLORS.blue;
    hangarShipNameEl.textContent = info.name;
    const owned = unlockedColors.includes(hangarPreviewColor);
    if(hangarPreviewColor === shipColor){
      hangarEquipBtn.textContent = 'Экипировано';
      hangarEquipBtn.disabled = true;
    } else if(owned){
      hangarEquipBtn.textContent = 'Экипировать';
      hangarEquipBtn.disabled = false;
    } else {
      hangarEquipBtn.textContent = `Нужно ${info.price} монет`;
      hangarEquipBtn.disabled = true;
    }
  }

  function openHangar(){
    hangarPreviewColor = shipColor;
    hangarOverlay.style.display = 'flex';
    renderHangarPreview();
  }

  function closeHangar(){
    hangarOverlay.style.display = 'none';
  }

  function cycleHangar(dir){
    const keys = Object.keys(SHIP_COLORS);
    let idx = keys.indexOf(hangarPreviewColor);
    idx = (idx + dir + keys.length) % keys.length;
    hangarPreviewColor = keys[idx];
    renderHangarPreview();
  }

  hangarPrevBtn.addEventListener('click', ()=>cycleHangar(-1));
  hangarNextBtn.addEventListener('click', ()=>cycleHangar(1));
  hangarCloseBtn.addEventListener('click', closeHangar);
  hangarEquipBtn.addEventListener('click', ()=>{
    if(unlockedColors.includes(hangarPreviewColor) && hangarPreviewColor !== shipColor){
      shipColor = hangarPreviewColor;
      saveShipColor();
      renderColorPicker();
      renderHangarPreview();
    }
  });

  // ---------- переключатель режима: Земля / Космос ----------
  const modeAlertEl = document.getElementById('modeAlert');
  let gameMode = 'earth';

  function bindModeSwitch(){
    const earthBtn = document.getElementById('modeEarthBtn');
    const spaceBtn = document.getElementById('modeSpaceBtn');
    if(!earthBtn || !spaceBtn) return;
    earthBtn.classList.toggle('active', gameMode === 'earth');
    spaceBtn.classList.toggle('active', gameMode === 'space');
    earthBtn.addEventListener('click', ()=>{
      gameMode = 'earth';
      earthBtn.classList.add('active');
      spaceBtn.classList.remove('active');
    });
    spaceBtn.addEventListener('click', ()=>{
      if(gameMode === 'space') return;
      gameMode = 'space';
      earthBtn.classList.remove('active');
      spaceBtn.classList.add('active');
      showModeAlert();
    });
  }

  function showModeAlert(){
    modeAlertEl.classList.add('show');
    setTimeout(()=>{
      modeAlertEl.classList.remove('show');
    }, 2400);
  }

  renderColorPicker();
  renderMetaShop();
  bindModeSwitch();
  playBtn.addEventListener('click', startGame);
  document.getElementById('hangarOpenBtn').addEventListener('click', openHangar);
    document.getElementById('leaderboardOpenBtn').addEventListener('click', showFriendsLeaderboard);

  requestAnimationFrame(loop);
