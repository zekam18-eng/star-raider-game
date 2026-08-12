// upgrades.js — валюта, цвета корабля, апгрейды (HP/щит)
  // ---------- currency & ship colors ----------
  let currency = parseInt(localStorage.getItem('sr_currency') || '0', 10);
  let unlockedColors = JSON.parse(localStorage.getItem('sr_unlocked') || '["blue"]');
  let shipColor = localStorage.getItem('sr_shipcolor') || 'blue';

  const SHIP_COLORS = {
    blue:  { name: 'Синий',   price: 0,   light:'#eafcff', mid:'#7fd9ff', dark:'#1a6fbf', wing:'#ff5fae', glow:'#4dd8ff' },
    red:   { name: 'Красный', price: 60,  light:'#ffe3e3', mid:'#ff5f5f', dark:'#7a1414', wing:'#ffd76a', glow:'#ff6a4d' },
    black: { name: 'Чёрный',  price: 120, light:'#c7ccd1', mid:'#4a4f57', dark:'#08090b', wing:'#4dd8ff', glow:'#8fa0b3' },
    green: { name: 'Зелёный', price: 180, light:'#e6ffe0', mid:'#4fd85c', dark:'#0f5c1a', wing:'#ffd76a', glow:'#7dffb0' }
  };

  function saveCurrency(){ localStorage.setItem('sr_currency', currency); }
  function saveUnlocked(){ localStorage.setItem('sr_unlocked', JSON.stringify(unlockedColors)); }
  function saveShipColor(){ localStorage.setItem('sr_shipcolor', shipColor); }

  function renderColorPicker(){
    const wrap = document.getElementById('colorPicker');
    const valEl = document.getElementById('currencyVal');
    if(!wrap) return;
    if(valEl) valEl.textContent = currency;
    wrap.innerHTML = '';
    Object.keys(SHIP_COLORS).forEach(key=>{
      const c = SHIP_COLORS[key];
      const owned = unlockedColors.includes(key);
      const btn = document.createElement('div');
      btn.className = 'colorSwatch' + (key===shipColor ? ' selected' : '') + (!owned ? ' locked' : '');
      btn.style.background = `radial-gradient(circle at 35% 30%, ${c.light}, ${c.mid} 55%, ${c.dark})`;
      btn.title = c.name;
      if(!owned){
        const price = document.createElement('div');
        price.className = 'price';
        price.textContent = c.price;
        btn.appendChild(price);
      }
      btn.addEventListener('click', ()=>{
        if(unlockedColors.includes(key)){
          shipColor = key;
          saveShipColor();
          renderColorPicker();
        } else if(currency >= c.price){
          currency -= c.price;
          unlockedColors.push(key);
          shipColor = key;
          saveCurrency(); saveUnlocked(); saveShipColor();
          renderColorPicker();
        }
      });
      wrap.appendChild(btn);
    });
  }

  // ---------- ship upgrades (every 1000 points) ----------
  function maybeShowUpgrade(){
    if(state==='playing' && score >= nextUpgradeScore){
      state = 'upgrade';
      upgradeScoreVal.textContent = Math.floor(score);
      if(maxHP >= MAX_HP){
        upgradeLifeBtn.style.display = 'none';
      } else {
        upgradeLifeBtn.style.display = 'inline-block';
        upgradeLifeBtn.textContent = '+1 Жизнь';
      }
      if(shield >= MAX_SHIELD){
        upgradeShieldBtn.style.display = 'none';
      } else {
        upgradeShieldBtn.style.display = 'inline-block';
      }
      upgradeOverlay.style.display = 'flex';
    }
  }

  function closeUpgrade(){
    upgradeOverlay.style.display = 'none';
    nextUpgradeScore += 1000;
    if(state==='upgrade') state = 'playing';
  }

  upgradeLifeBtn.addEventListener('click', ()=>{
    if(maxHP < MAX_HP){
      maxHP++;
      hp = Math.min(maxHP, hp+1);
      renderHP();
    }
    closeUpgrade();
  });

  upgradeShieldBtn.addEventListener('click', ()=>{
    if(shield < MAX_SHIELD){
      shield++;
      renderShield();
    }
    closeUpgrade();
  });

