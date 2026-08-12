// enemies.js — враги: спавн, апдейт, отрисовка, вражеские пули
  function spawnEnemy(){
    const size = 22 + Math.random()*14;
    const y = size + Math.random()*(H - size*2);
    const speed = (1.6 + Math.random()*1.6) * difficulty;
    const type = Math.random() < 0.25 ? 'zig' : (Math.random() < 0.5 ? 'heavy' : 'basic');
    enemies.push({
      x: W + size*2, y, r: type==='heavy'? size*1.25 : size,
      speed, type,
      hp: type==='heavy' ? 3 : 1,
      maxHp: type==='heavy' ? 3 : 1,
      phase: Math.random()*Math.PI*2,
      rot: 0,
      rotSpeed: (Math.random()-0.5)*0.06,
      shootTimer: 60 + Math.random()*120
    });
  }

  function shootEnemyBullet(e){
    enemyBullets.push({ x: e.x - e.r, y: e.y, vx: -(7 + difficulty), r: 4 });
  }

  // ---------- enemy drawing (mechanical robots) ----------
  function roundRectPath(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function drawEnemy(e){
    const dmg = 1 - e.hp/e.maxHp;
    const isHeavy = e.type === 'heavy';
    const isZig = e.type === 'zig';

    let primary, primaryLight, primaryDark;
    if(isHeavy){ primary='#c23b3b'; primaryLight='#ff9d9d'; primaryDark='#5c1414'; }
    else if(isZig){ primary='#7a5cff'; primaryLight='#c3b3ff'; primaryDark='#2b1966'; }
    else { primary='#ff8a3d'; primaryLight='#ffd19b'; primaryDark='#7a3a0f'; }

    const metal = '#9aa7b6';
    const metalDark = '#3d444d';

    ctx.save();
    ctx.translate(e.x, e.y);
    const bank = Math.sin(t*0.05 + e.phase) * (isZig ? 0.28 : 0.12);
    ctx.rotate(bank);
    const scale = e.r / 26;
    ctx.scale(scale, scale);

    const armSwing = Math.sin(t*0.09 + e.phase) * 0.3;
    const legPulse = Math.sin(t*0.16 + e.phase) * 3;

    // legs / thruster struts (drawn first, behind torso)
    [-1,1].forEach(side=>{
      ctx.save();
      ctx.translate(side*9, 14 + legPulse*0.25);
      ctx.rotate(side*0.18);
      ctx.fillStyle = metalDark;
      ctx.fillRect(-3,0,6,13);
      ctx.restore();

      const flameLen = 8 + Math.abs(legPulse);
      const fg = ctx.createLinearGradient(0,27,0,27+flameLen);
      fg.addColorStop(0,'rgba(150,220,255,0.9)');
      fg.addColorStop(1,'rgba(150,220,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(side*9-3,27);
      ctx.lineTo(side*9,27+flameLen);
      ctx.lineTo(side*9+3,27);
      ctx.closePath();
      ctx.fill();
    });

    // arms with elbow joint + claw
    [-1,1].forEach(side=>{
      ctx.save();
      ctx.translate(side*13,-3);
      ctx.rotate(side*(0.55+armSwing));
      ctx.fillStyle = metal;
      ctx.fillRect(-3,0,6,15);
      ctx.translate(0,15);
      ctx.rotate(side*-0.7);
      ctx.fillStyle = metalDark;
      ctx.fillRect(-3.5,0,7,11);
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(-4.5,11); ctx.lineTo(0,19); ctx.lineTo(4.5,11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // torso
    ctx.shadowColor = primary;
    ctx.shadowBlur = 15;
    const torsoH = isHeavy ? 32 : 26;
    const torsoGrad = ctx.createLinearGradient(0,-14,0,torsoH-14);
    torsoGrad.addColorStop(0, primaryLight);
    torsoGrad.addColorStop(0.55, primary);
    torsoGrad.addColorStop(1, primaryDark);
    ctx.fillStyle = torsoGrad;
    roundRectPath(-14,-14,28,torsoH,6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // shoulder armor (heavy only)
    if(isHeavy){
      ctx.fillStyle = metalDark;
      ctx.beginPath(); ctx.arc(-15,-7,6.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(15,-7,6.5,0,Math.PI*2); ctx.fill();
    }

    // panel seam + rivets
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-13,-1); ctx.lineTo(13,-1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    [[-10,-10],[10,-10],[-10,torsoH-16],[10,torsoH-16]].forEach(([rx,ry])=>{
      ctx.beginPath(); ctx.arc(rx,ry,1.3,0,Math.PI*2); ctx.fill();
    });

    // reactor core
    const corePulse = 0.6 + Math.sin(t*0.2+e.phase)*0.4;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6 + corePulse*6;
    ctx.fillStyle = `rgba(255,255,255,${0.5+corePulse*0.3})`;
    ctx.beginPath(); ctx.arc(0,3,3.6,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // head
    ctx.fillStyle = metal;
    roundRectPath(-9,-26,18,13,4);
    ctx.fill();
    ctx.fillStyle = metalDark;
    ctx.fillRect(-9,-16,18,2.5);

    // eye
    const eyePulse = 0.5 + Math.sin(t*0.3+e.phase)*0.5;
    ctx.shadowColor = 'red';
    ctx.shadowBlur = 8 + eyePulse*8;
    ctx.fillStyle = `rgba(255,${50+eyePulse*40},${50+eyePulse*40},1)`;
    ctx.beginPath(); ctx.ellipse(0,-19.5,6,3,0,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // antenna
    ctx.strokeStyle = metal;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,-26); ctx.lineTo(0,-33); ctx.stroke();
    ctx.fillStyle = isHeavy ? '#ff5f5f' : '#ffd76a';
    ctx.beginPath(); ctx.arc(0,-33,2.4,0,Math.PI*2); ctx.fill();

    ctx.restore();

    // damage flash overlay
    if(dmg > 0){
      ctx.save();
      ctx.globalAlpha = dmg*0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r*0.9, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateEnemyBullets(dt){
    for(let i=enemyBullets.length-1;i>=0;i--){
      const eb = enemyBullets[i];
      eb.x += eb.vx * dt;
      if(eb.x < -20){ enemyBullets.splice(i,1); continue; }
      if(state==='playing' && player.invuln<=0){
        const dx = player.x-eb.x, dy = player.y-eb.y;
        const rad = player.r*0.7 + eb.r;
        if(dx*dx+dy*dy < rad*rad){
          enemyBullets.splice(i,1);
          onPlayerHit(eb.x, eb.y);
        }
      }
    }
  }


  function updateEnemies(dt){
    for(let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      e.x -= e.speed * dt;
      e.rot += e.rotSpeed * dt;
      if(e.type==='zig'){
        e.y += Math.sin(t*0.05 + e.phase) * 2.4 * dt;
        e.y = Math.max(e.r, Math.min(H-e.r, e.y));
      }
      if(e.x + e.r < 0){
        enemies.splice(i,1);
        continue;
      }
      if(state==='playing' && score >= ROBOT_SHOOT_SCORE && e.x < W-10){
        e.shootTimer -= dt;
        if(e.shootTimer<=0){
          shootEnemyBullet(e);
          e.shootTimer = 70 + Math.random()*100;
        }
      }
      // bullet collision
      for(let j=bullets.length-1;j>=0;j--){
        const b = bullets[j];
        const dx = b.x-e.x, dy = b.y-e.y;
        if(dx*dx+dy*dy < (e.r+b.r)*(e.r+b.r)){
          bullets.splice(j,1);
          e.hp--;
          spawnParticles(b.x,b.y,6,'#ffd76a',3,0.4);
          if(e.hp<=0){
            explode(e.x, e.y, e.type==='heavy');
            enemies.splice(i,1);
            score += e.type==='heavy' ? 30 : (e.type==='zig' ? 20 : 10);
            currency += e.type==='heavy' ? 3 : (e.type==='zig' ? 2 : 1);
            saveCurrency();
          }
          break;
        }
      }
      // player collision
      if(state==='playing' && enemies[i]){
        const ee = enemies[i];
        const dx = player.x-ee.x, dy = player.y-ee.y;
        const rad = player.r*0.75+ee.r*0.85;
        if(dx*dx+dy*dy < rad*rad && player.invuln<=0){
          onPlayerHit(ee.x, ee.y);
          enemies.splice(i,1);
        }
      }
    }
  }


  function drawEnemyBullets(){
    for(const b of enemyBullets){
      ctx.save();
      ctx.shadowColor = '#ff7a4d';
      ctx.shadowBlur = 12;
      const g = ctx.createLinearGradient(b.x+10,b.y,b.x-6,b.y);
      g.addColorStop(0,'rgba(255,255,255,0)');
      g.addColorStop(1,'#ffb27a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(b.x,b.y,10,b.r*0.6,0,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

