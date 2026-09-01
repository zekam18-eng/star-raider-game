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
      shootTimer: 30 + Math.random()*55
    });
  }

  function spawnBossRobot(){
    const r = 95;
    enemies.push({
      x: W + r*2, y: H/2, baseY: H/2,
      r, speed: 2.2,
      type: 'heavy',
      isBoss: true, bossKind: 'robot',
      hp: 45, maxHp: 45,
      phase: Math.random()*Math.PI*2,
      rot: 0, rotSpeed: 0,
      entering: true,
      hoverX: W*0.72,
      shootTimer: 60
    });
  }

  function spawnBossShip(){
    const r = 60;
    enemies.push({
      x: W + r*2, y: H/2, baseY: H/2,
      r, speed: 2.6,
      type: 'bossShip',
      isBoss: true, bossKind: 'ship',
      hp: 70, maxHp: 70,
      phase: Math.random()*Math.PI*2,
      rot: 0, rotSpeed: 0,
      entering: true,
      hoverX: W*0.68,
      shootTimer: 45
    });
  }

  function shootEnemyBullet(e){
    enemyBullets.push({ x: e.x - e.r, y: e.y, vx: -(7 + difficulty), r: 4 });
  }

  function shootBossShipBullet(e){
    const vx = -(7 + difficulty);
    enemyBullets.push({ x: e.x - e.r, y: e.y - 12, vx, r: 4 });
    enemyBullets.push({ x: e.x - e.r, y: e.y + 12, vx, r: 4 });
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
    if(typeof currentMode !== 'undefined' && currentMode === 'space'){
      drawEnemyPirate(e);
    } else {
      drawEnemyRobot(e);
    }
  }

  function drawEnemyRobot(e){
    const dmg = 1 - e.hp/e.maxHp;
    const isHeavy = e.type === 'heavy';
    const isZig = e.type === 'zig';

    let primary, primaryLight, primaryDark;
    if(isHeavy){ primary='#c23b3b'; primaryLight='#ff9d9d'; primaryDark='#5c1414'; }
    else if(isZig){ primary='#7a5cff'; primaryLight='#c3b3ff'; primaryDark='#2b1966'; }
    else { primary='#ff8a3d'; primaryLight='#ffd19b'; primaryDark='#7a3a0f'; }

    const metal = '#aab4c0';
    const metalLight = '#e2e8ee';
    const metalDark = '#33383f';

    ctx.save();
    ctx.translate(e.x, e.y);
    const bank = Math.sin(t*0.05 + e.phase) * (isZig ? 0.2 : 0.09);
    ctx.rotate(bank);
    const scale = e.r / 26;
    ctx.scale(scale, scale);

    const bodyW = isHeavy ? 1.2 : (isZig ? 0.95 : 1);
    const noseX = -22*bodyW, rearX = 22*bodyW;

    // ---- парные двигатели сзади (двойной выхлоп, как в референсе) ----
    const flamePulse = Math.sin(t*0.16 + e.phase) * 1.6;
    const flameLen = 11 + Math.abs(flamePulse);
    [-6, 6].forEach(oy=>{
      const fg = ctx.createLinearGradient(rearX-2,0,rearX-2+flameLen,0);
      fg.addColorStop(0,'rgba(150,220,255,0.95)');
      fg.addColorStop(0.5,'rgba(100,180,255,0.6)');
      fg.addColorStop(1,'rgba(100,180,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(rearX-2, oy-3);
      ctx.lineTo(rearX-2+flameLen, oy);
      ctx.lineTo(rearX-2, oy+3);
      ctx.closePath();
      ctx.fill();
    });
    // сопла двигателей
    ctx.fillStyle = metalDark;
    ctx.fillRect(rearX-8, -9, 8, 6);
    ctx.fillRect(rearX-8, 3, 8, 6);
    ctx.fillStyle = 'rgba(140,210,255,0.9)';
    ctx.beginPath(); ctx.arc(rearX-4, -6, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(rearX-4, 6, 2, 0, Math.PI*2); ctx.fill();

    // ---- крупные стреловидные крылья-лезвия, зачёсанные назад ----
    ctx.fillStyle = metalDark;
    ctx.beginPath();
    ctx.moveTo(-4*bodyW,-9);
    ctx.lineTo(24*bodyW,-27);
    ctx.lineTo(28*bodyW,-19);
    ctx.lineTo(13*bodyW,-6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4*bodyW,9);
    ctx.lineTo(24*bodyW,27);
    ctx.lineTo(28*bodyW,19);
    ctx.lineTo(13*bodyW,6);
    ctx.closePath();
    ctx.fill();
    // цветной кант на кромке крыла
    ctx.strokeStyle = primary;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-4*bodyW,-9); ctx.lineTo(24*bodyW,-27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4*bodyW,9); ctx.lineTo(24*bodyW,27); ctx.stroke();

    // ---- тяжёлый тип: согнутые бронированные "лапы" снизу (агрессивная посадка, как в референсе) ----
    if(isHeavy){
      [-1,1].forEach(dir=>{
        ctx.save();
        ctx.fillStyle = primaryDark;
        ctx.beginPath();
        ctx.moveTo(-2, 12*dir);
        ctx.lineTo(-14, 20*dir);
        ctx.lineTo(-10, 26*dir);
        ctx.lineTo(2, 17*dir);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = metalDark;
        ctx.beginPath(); ctx.arc(-11,23*dir,3.2,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });
    }

    // ---- зигзаг-тип: острый нижний шип-лезвие для скоростного вида ----
    if(isZig){
      ctx.fillStyle = metalDark;
      ctx.beginPath();
      ctx.moveTo(noseX+2, 4);
      ctx.lineTo(noseX-10, 3);
      ctx.lineTo(-2, 12);
      ctx.closePath();
      ctx.fill();
    }

    // ---- основной угловатый корпус ----
    ctx.shadowColor = primary;
    ctx.shadowBlur = 15;
    const hullGrad = ctx.createLinearGradient(noseX,0,rearX,0);
    hullGrad.addColorStop(0, primaryLight);
    hullGrad.addColorStop(0.5, primary);
    hullGrad.addColorStop(1, primaryDark);
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(noseX+9, 0);
    ctx.lineTo(-6*bodyW, -12);
    ctx.lineTo(13*bodyW, -13);
    ctx.lineTo(rearX-3, -7);
    ctx.lineTo(rearX-3, 7);
    ctx.lineTo(13*bodyW, 13);
    ctx.lineTo(-6*bodyW, 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // панельные швы + заклёпки
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2*bodyW,-8); ctx.lineTo(15*bodyW,-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2*bodyW,8); ctx.lineTo(15*bodyW,8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    [[7*bodyW,-4],[7*bodyW,4],[17*bodyW,0]].forEach(([rx,ry])=>{
      ctx.beginPath(); ctx.arc(rx,ry,1.2,0,Math.PI*2); ctx.fill();
    });

    // реакторное ядро в центре корпуса
    const corePulse = 0.6 + Math.sin(t*0.2+e.phase)*0.4;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6 + corePulse*6;
    ctx.fillStyle = `rgba(255,255,255,${0.5+corePulse*0.3})`;
    ctx.beginPath(); ctx.arc(9*bodyW,0,3,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // ---- металлическая "голова"-сенсор на носу (отдельный блок, как в референсе) ----
    const headGrad = ctx.createLinearGradient(noseX,-8,noseX,8);
    headGrad.addColorStop(0, metalLight);
    headGrad.addColorStop(0.5, metal);
    headGrad.addColorStop(1, metalDark);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(noseX, 0);
    ctx.lineTo(noseX+7, -7);
    ctx.lineTo(noseX+16, -6);
    ctx.lineTo(noseX+16, 6);
    ctx.lineTo(noseX+7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // тёмная смотровая щель
    ctx.fillStyle = metalDark;
    ctx.fillRect(noseX+9, -3.5, 6, 7);

    // сенсор-"глаз" на носу — светится в сторону игрока
    const eyePulse = 0.5 + Math.sin(t*0.3+e.phase)*0.5;
    ctx.shadowColor = 'red';
    ctx.shadowBlur = 8 + eyePulse*8;
    ctx.fillStyle = `rgba(255,${50+eyePulse*40},${50+eyePulse*40},1)`;
    ctx.beginPath(); ctx.ellipse(noseX+3, 0, 4, 2.6, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

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

  // ---------- космические пираты (режим "Космос") ----------
  function drawEnemyPirate(e){
    const dmg = 1 - e.hp/e.maxHp;
    const isHeavy = e.type === 'heavy';
    const isZig = e.type === 'zig';

    let hullMid, hullDark, hullLight, trim;
    if(isHeavy){ hullMid='#6b3320'; hullDark='#2b120a'; hullLight='#a05838'; trim='#c23b2a'; }
    else if(isZig){ hullMid='#3d4a2e'; hullDark='#181f11'; hullLight='#6b7d4f'; trim='#5a7a3a'; }
    else { hullMid='#4a4038'; hullDark='#1c1712'; hullLight='#78685a'; trim='#8a2f1a'; }

    const metalDark = '#15120f';
    const rust = '#7a4a28';

    ctx.save();
    ctx.translate(e.x, e.y);
    const bank = Math.sin(t*0.05 + e.phase) * (isZig ? 0.2 : 0.09);
    ctx.rotate(bank);
    const scale = e.r / 26;
    ctx.scale(scale, scale);

    const bodyW = isHeavy ? 1.25 : (isZig ? 0.95 : 1);
    const noseX = -25*bodyW, rearX = 20*bodyW;

    const flamePulse = Math.sin(t*0.16 + e.phase) * 2;
    const flameLen = 12 + Math.abs(flamePulse);
    const fg = ctx.createLinearGradient(rearX-2,0,rearX-2+flameLen,0);
    fg.addColorStop(0,'rgba(255,170,60,0.95)');
    fg.addColorStop(0.5,'rgba(255,90,30,0.6)');
    fg.addColorStop(1,'rgba(255,60,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(rearX-2, -5);
    ctx.lineTo(rearX-2+flameLen, 0);
    ctx.lineTo(rearX-2, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = metalDark;
    [[-22,-6,-30,-13],[-14,-8,-20,-16],[-4,-10,-8,-19],[8,-11,4,-20]].forEach(([bx,by,tx2,ty2])=>{
      ctx.beginPath();
      ctx.moveTo(bx*bodyW, by);
      ctx.lineTo(tx2*bodyW, ty2);
      ctx.lineTo((bx+5)*bodyW, by+1);
      ctx.closePath();
      ctx.fill();
    });
    [[-22,6,-30,13],[-14,8,-20,16],[-4,10,-8,19],[8,11,4,20]].forEach(([bx,by,tx2,ty2])=>{
      ctx.beginPath();
      ctx.moveTo(bx*bodyW, by);
      ctx.lineTo(tx2*bodyW, ty2);
      ctx.lineTo((bx+5)*bodyW, by-1);
      ctx.closePath();
      ctx.fill();
    });

    if(isHeavy){
      ctx.fillStyle = metalDark;
      ctx.fillRect(noseX+2, -14, 16, 4);
      ctx.fillRect(noseX+2, 10, 16, 4);
    }

    ctx.shadowColor = trim;
    ctx.shadowBlur = 14;
    const hullGrad = ctx.createLinearGradient(noseX,0,rearX,0);
    hullGrad.addColorStop(0, hullLight);
    hullGrad.addColorStop(0.55, hullMid);
    hullGrad.addColorStop(1, hullDark);
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(noseX, 0);
    ctx.lineTo(-14*bodyW, -6);
    ctx.lineTo(-6*bodyW, -13);
    ctx.lineTo(10*bodyW, -14);
    ctx.lineTo(rearX, -7);
    ctx.lineTo(rearX, 7);
    ctx.lineTo(10*bodyW, 14);
    ctx.lineTo(-6*bodyW, 13);
    ctx.lineTo(-14*bodyW, 6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4*bodyW,-9); ctx.lineTo(12*bodyW,-9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4*bodyW,9); ctx.lineTo(12*bodyW,9); ctx.stroke();
    ctx.fillStyle = rust;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(2*bodyW,-4,2.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-6*bodyW,5,2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(2*bodyW, 0);
    ctx.scale(0.55,0.55);
    ctx.fillStyle = 'rgba(230,225,215,0.85)';
    ctx.beginPath(); ctx.arc(0,-2,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = metalDark;
    ctx.beginPath(); ctx.arc(-2,-3,1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(2,-3,1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(230,225,215,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-6,5); ctx.lineTo(6,-5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6,-5); ctx.lineTo(6,5); ctx.stroke();
    ctx.restore();

    const eyePulse = 0.5 + Math.sin(t*0.3+e.phase)*0.5;
    ctx.shadowColor = '#ff8a3d';
    ctx.shadowBlur = 8 + eyePulse*8;
    ctx.fillStyle = `rgba(255,${140+eyePulse*40},60,1)`;
    ctx.beginPath(); ctx.ellipse(noseX+7, 0, 4.5, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

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

  function drawEnemyShip(e){
    const dmg = 1 - e.hp/e.maxHp;
    const r = e.r;
    ctx.save();
    ctx.translate(e.x, e.y);
    const bank = Math.sin(t*0.04 + e.phase) * 0.15;
    ctx.rotate(-Math.PI/2 + bank); // nose points left, toward the player

    // thruster flame trailing behind
    const flameLen = 18 + Math.sin(t*0.5 + e.phase)*5;
    const fg = ctx.createLinearGradient(0, r*0.6, 0, r*0.6+flameLen);
    fg.addColorStop(0, 'rgba(210,220,255,0.95)');
    fg.addColorStop(1, 'rgba(210,220,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-6, r*0.55);
    ctx.lineTo(0, r*0.55+flameLen);
    ctx.lineTo(6, r*0.55);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = '#eaf1ff';
    ctx.shadowBlur = 28;
    const bodyGrad = ctx.createLinearGradient(0,-r,0,r);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.5, '#dfe6f2');
    bodyGrad.addColorStop(1, '#8a94a8');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r*1.15);
    ctx.quadraticCurveTo(r*0.9, r*0.2, r*0.75, r*0.75);
    ctx.lineTo(r*0.25, r*0.5);
    ctx.lineTo(-r*0.25, r*0.5);
    ctx.lineTo(-r*0.75, r*0.75);
    ctx.quadraticCurveTo(-r*0.9, r*0.2, 0, -r*1.15);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // cockpit, hostile red glow
    ctx.fillStyle = '#1a2436';
    ctx.beginPath();
    ctx.ellipse(0, -r*0.15, r*0.28, r*0.4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,110,110,0.9)';
    ctx.beginPath();
    ctx.ellipse(-r*0.08, -r*0.28, r*0.1, r*0.16, -0.4, 0, Math.PI*2);
    ctx.fill();

    // wing accents
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(r*0.75, r*0.75); ctx.lineTo(r*0.95, r*0.55); ctx.lineTo(r*0.55, r*0.55);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r*0.75, r*0.75); ctx.lineTo(-r*0.95, r*0.55); ctx.lineTo(-r*0.55, r*0.55);
    ctx.closePath(); ctx.fill();

    ctx.restore();

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

      if(e.isBoss){
        if(e.entering){
          e.x -= e.speed * dt;
          if(e.x <= e.hoverX){
            e.x = e.hoverX;
            e.entering = false;
          }
        } else {
          e.y = e.baseY + Math.sin(t*0.03 + e.phase) * 70;
          e.y = Math.max(e.r, Math.min(H-e.r, e.y));
        }
      } else {
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
      }

      if(state==='playing' && e.x < W-10){
        e.shootTimer -= dt;
        if(e.shootTimer<=0){
          if(e.bossKind === 'ship'){
            shootBossShipBullet(e);
            e.shootTimer = 20 + Math.random()*16;
          } else if(e.isBoss){
            shootEnemyBullet(e);
            e.shootTimer = 26 + Math.random()*22;
          } else {
            shootEnemyBullet(e);
            e.shootTimer = 32 + Math.random()*45;
          }
        }
      }
      // bullet collision
      for(let j=bullets.length-1;j>=0;j--){
        const b = bullets[j];
        const dx = b.x-e.x, dy = b.y-e.y;
        if(dx*dx+dy*dy < (e.r+b.r)*(e.r+b.r)){
          bullets.splice(j,1);
          e.hp -= (b.dmg || 1) * (e.isBoss ? 0.1 : 1);
          spawnParticles(b.x,b.y,6,'#ffd76a',3,0.4);
          if(e.hp<=0){
            explode(e.x, e.y, e.type==='heavy' || e.isBoss);
            enemies.splice(i,1);
            if(e.isBoss){
              playSfx('bossExplosion');
              score += e.bossKind==='ship' ? 2000 : 800;
              currency += e.bossKind==='ship' ? 40 : 15;
              bossActive = false;
            } else {
              playSfx('explosion');
              score += e.type==='heavy' ? 30 : (e.type==='zig' ? 20 : 10);
              currency += e.type==='heavy' ? 3 : (e.type==='zig' ? 2 : 1);
              maybeDropPowerup(e.x, e.y);
            }
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
          if(!ee.isBoss){
            enemies.splice(i,1);
          }
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

