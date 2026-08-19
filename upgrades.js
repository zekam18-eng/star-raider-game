// upgrades.js — валюта, цвета корабля, апгрейды (HP/щит)
  // ---------- currency & ship colors ----------
  let currency = parseInt(localStorage.getItem('sr_currency') || '0', 10);
  let unlockedColors = JSON.parse(localStorage.getItem('sr_unlocked') || '["blue"]');
  let shipColor = localStorage.getItem('sr_shipcolor') || 'blue';

  // ---------- persistent meta-upgrades (menu shop, survive across runs/loops/app restarts) ----------
  let hpLevel = parseInt(localStorage.getItem('sr_hplevel') || '0', 10);
  const HP_UPGRADE_MAX = 6;
  const HP_UPGRADE_BASE_PRICE = 150;
  function hpUpgradePrice(level){ return Math.round(HP_UPGRADE_BASE_PRICE * Math.pow(1.5, level)); }
  function saveHpLevel(){ localStorage.setItem('sr_hplevel', hpLevel); }

  const SHIP_COLORS = {
    blue:  { name: 'Синий',   price: 0,   light:'#eafcff', mid:'#7fd9ff', dark:'#1a6fbf', wing:'#ff5fae', glow:'#4dd8ff' },
    red:   { name: 'Красный', price: 60,  light:'#ffe3e3', mid:'#ff5f5f', dark:'#7a1414', wing:'#ffd76a', glow:'#ff6a4d' },
    black: { name: 'Чёрный',  price: 120, light:'#c7ccd1', mid:'#4a4f57', dark:'#08090b', wing:'#4dd8ff', glow:'#8fa0b3' },
    green: { name: 'Зелёный', price: 180, light:'#e6ffe0', mid:'#4fd85c', dark:'#0f5c1a', wing:'#ffd76a', glow:'#7dffb0' },
    orange:{ name: 'Оранжевый', price: 240, light:'#ffe8cc', mid:'#ff9c33', dark:'#7a3d0a', wing:'#4dd8ff', glow:'#ffb15e' },
    purple:{ name: 'Фиолетовый', price: 300, light:'#f0e0ff', mid:'#a35bff', dark:'#3d1470', wing:'#ffd76a', glow:'#c58aff' },
    pink:  { name: 'Розовый', price: 360, light:'#ffe3f2', mid:'#ff6fc0', dark:'#8a1257', wing:'#fff2a8', glow:'#ff9bd6', symbol:'heart' },
    russia:{ name: 'Триколор', price: 420, light:'#ffffff', mid:'#2b5fd9', dark:'#d61f2c', wing:'#ffd76a', glow:'#8fb3ff', flag:true },
    imperial:{ name: 'Имперский флаг', price: 480, light:'#111111', mid:'#f4c430', dark:'#f2f2f2', wing:'#f4c430', glow:'#f4c430', flag:true }
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
      btn.style.background = c.flag
        ? `linear-gradient(180deg, ${c.light} 0%, ${c.light} 33%, ${c.mid} 33%, ${c.mid} 66%, ${c.dark} 66%)`
        : `radial-gradient(circle at 35% 30%, ${c.light}, ${c.mid} 55%, ${c.dark})`;
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

  // ---------- rewarded ad (AdsGram SDK, Telegram Mini App) ----------
  const AD_REWARD_COINS = 50;
  const ADSGRAM_BLOCK_ID = "42733";
  // Модерация пройдена — показываем реальную рекламу (реальные показы = реальные деньги).
  // Если площадку когда-нибудь снова отправят на модерацию или нужно быстро проверить
  // саму интеграцию без ожидания реального заполнения — верни true и debugBannerType обратно.
  const ADSGRAM_DEBUG = false;
  let adController = null;
  try {
    if (window.Adsgram) {
      adController = window.Adsgram.init(
        ADSGRAM_DEBUG
          ? { blockId: ADSGRAM_BLOCK_ID, debug: true, debugBannerType: 'RewardedVideo' }
          : { blockId: ADSGRAM_BLOCK_ID }
      );
    }
  } catch (e) {
    // SDK недоступен (например, тестируем не внутри Telegram) — просто игнорируем
  }

  // ---------- interstitial ad every 1000 score points (not rewarded, just shown) ----------
  const SCORE_AD_INTERVAL = 1000;
  let nextScoreAd = SCORE_AD_INTERVAL;

  function resetScoreAdMilestone(){
    nextScoreAd = SCORE_AD_INTERVAL;
  }

  function maybeShowMilestoneAd(currentScore){
    if(currentScore < nextScoreAd) return;
    nextScoreAd += SCORE_AD_INTERVAL;
    if(!adController) return;
    try {
      adController.show().catch(()=>{
        // нет рекламы для показа / не досмотрена — просто идём дальше, без штрафов игроку
      });
    } catch(e) {
      // SDK недоступен — тихо игнорируем
    }
  }

  // ---------- interstitial ad on game load/(re)start ----------
  function showStartAd(){
    if(!adController) return;
    try {
      adController.show().catch(()=>{
        // рекламы нет (например, модерация ещё не пройдена) — просто пропускаем, без блокировки игры
      });
    } catch(e) {
      // SDK недоступен — тихо игнорируем
    }
  }

  function watchAdForCoins(){
    if(!adController){
      alert('Реклама пока недоступна: SDK не загрузился. Попробуй позже или перезайди в игру.');
      return;
    }
    adController.show().then(()=>{
      currency += AD_REWARD_COINS;
      saveCurrency();
      renderColorPicker();
      renderMetaShop();
    }).catch((result)=>{
      // реклама не досмотрена/нет рекламы для показа/ошибка — ничего не начисляем
      alert('Реклама сейчас недоступна (возможно, площадка ещё на модерации в AdsGram). Попробуй позже.');
    });
  }

  // ---------- stories (persistent, bought with the same currency) ----------
  let unlockedStories = JSON.parse(localStorage.getItem('sr_stories') || '[]');
  function saveStories(){ localStorage.setItem('sr_stories', JSON.stringify(unlockedStories)); }

  const STORY_PRICE = 500;
  const STORIES = [
    { id: 'story1', title: 'Капитан Алекс Рейн', text: 'Алекс Рейн был капитаном корабля и командиром небольшой команды из трёх человек. После разрушения Земли он решил покинуть планету и отправиться к одной из оставшихся космических баз. Он редко говорил о прошлом и никогда не показывал своих эмоций. Для экипажа он был человеком, который всегда знал, что делать, даже когда выхода уже не оставалось.' },
    { id: 'story2', title: 'Пилот Марк Вейл', text: 'Марк Вейл был пилотом корабля. До катастрофы он участвовал в испытательных полётах и считался одним из лучших пилотов. Он был спокойным, любил шутить и часто скрывал страх за улыбкой. Марк всегда говорил, что сможет посадить корабль где угодно — даже если от корабля останется половина.' },
    { id: 'story3', title: 'Инженер Лина Ортис', text: 'Лина Ортис была инженером корабля и отвечала за его двигатели, оружие и системы защиты. Она могла починить почти всё, что ещё подавало признаки жизни. После разрушения Земли именно Лина восстановила корабль и подготовила его к полёту. Она редко доверяла людям, но за этот корабль и свою команду была готова пойти до конца.' }
  ];

  const storiesOverlay = document.getElementById('storiesOverlay');
  const storiesCloseBtn = document.getElementById('storiesCloseBtn');

  function renderMetaShop(){
    const wrap = document.getElementById('metaShop');
    if(!wrap) return;

    wrap.innerHTML = '';

    const hpMaxed = hpLevel >= HP_UPGRADE_MAX;
    const hpPrice = hpUpgradePrice(hpLevel);

    const hpRow = document.createElement('div');
    hpRow.className = 'metaRow';
    hpRow.innerHTML = `
      <div class="metaInfo">
        <div class="metaTitle">Живучесть корабля</div>
        <div class="metaDesc">Макс. HP: ${BASE_MAX_HP + hpLevel}${hpMaxed ? ' (макс.)' : ''}</div>
      </div>
    `;
    const hpBtn = document.createElement('button');
    hpBtn.className = 'metaBtn';
    hpBtn.textContent = hpMaxed ? 'МАКС' : ('+1 HP · ' + hpPrice);
    hpBtn.disabled = hpMaxed || currency < hpPrice;
    hpBtn.addEventListener('click', ()=>{
      if(!hpMaxed && currency >= hpPrice){
        currency -= hpPrice;
        hpLevel++;
        saveCurrency(); saveHpLevel();
        renderColorPicker();
        renderMetaShop();
      }
    });
    hpRow.appendChild(hpBtn);
    wrap.appendChild(hpRow);

    const adRow = document.createElement('div');
    adRow.className = 'metaRow';
    adRow.innerHTML = `
      <div class="metaInfo">
        <div class="metaTitle">Реклама за монеты</div>
        <div class="metaDesc">+${AD_REWARD_COINS} монет за просмотр</div>
      </div>
    `;
    const adBtn = document.createElement('button');
    adBtn.className = 'metaBtn';
    adBtn.textContent = 'Смотреть';
    adBtn.addEventListener('click', watchAdForCoins);
    adRow.appendChild(adBtn);
    wrap.appendChild(adRow);

    const storyRow = document.createElement('div');
    storyRow.className = 'metaRow';
    storyRow.innerHTML = `
      <div class="metaInfo">
        <div class="metaTitle">Истории</div>
        <div class="metaDesc">Куплено: ${unlockedStories.length}/${STORIES.length}</div>
      </div>
    `;
    const storyBtn = document.createElement('button');
    storyBtn.className = 'metaBtn';
    storyBtn.textContent = 'Открыть';
    storyBtn.addEventListener('click', openStories);
    storyRow.appendChild(storyBtn);
    wrap.appendChild(storyRow);
  }

  function openStories(){
    renderStoriesList();
    if(storiesOverlay) storiesOverlay.style.display = 'flex';
  }

  function renderStoriesList(){
    const listEl = document.getElementById('storiesList');
    if(!listEl) return;
    listEl.innerHTML = '';
    STORIES.forEach(s=>{
      const owned = unlockedStories.includes(s.id);
      const row = document.createElement('div');
      row.className = 'storyRow';
      const title = document.createElement('div');
      title.className = 'storyTitle';
      title.textContent = s.title;
      row.appendChild(title);
      const btn = document.createElement('button');
      btn.className = 'metaBtn';
      if(owned){
        btn.textContent = 'Читать';
        btn.addEventListener('click', ()=> showStoryText(s));
      } else {
        btn.textContent = 'Купить · ' + STORY_PRICE;
        btn.disabled = currency < STORY_PRICE;
        btn.addEventListener('click', ()=>{
          if(currency >= STORY_PRICE){
            currency -= STORY_PRICE;
            unlockedStories.push(s.id);
            saveCurrency(); saveStories();
            renderColorPicker();
            renderMetaShop();
            renderStoriesList();
          }
        });
      }
      row.appendChild(btn);
      listEl.appendChild(row);
    });
  }

  function showStoryText(s){
    const listEl = document.getElementById('storiesList');
    if(!listEl) return;
    listEl.innerHTML = '';
    const textEl = document.createElement('div');
    textEl.className = 'storyText';
    textEl.textContent = s.text;
    listEl.appendChild(textEl);
    const backBtn = document.createElement('button');
    backBtn.className = 'metaBtn';
    backBtn.style.marginTop = '14px';
    backBtn.textContent = 'Назад к списку';
    backBtn.addEventListener('click', renderStoriesList);
    listEl.appendChild(backBtn);
  }

  if(storiesCloseBtn){
    storiesCloseBtn.addEventListener('click', ()=>{
      storiesOverlay.style.display = 'none';
    });
  }

  // ---------- ship upgrades (every 500 points of score, not kill currency) ----------
  function maybeShowUpgrade(){
    if(state==='playing' && score >= nextUpgradeScore){
      state = 'upgrade';
      upgradeScoreVal.textContent = Math.floor(score);

      if(hp >= maxHP){
        upgradeLifeBtn.style.display = 'none';
      } else {
        upgradeLifeBtn.style.display = 'inline-block';
        upgradeLifeBtn.textContent = 'Восполнить жизнь';
      }

      if(shield >= MAX_SHIELD){
        upgradeShieldBtn.style.display = 'none';
      } else {
        upgradeShieldBtn.style.display = 'inline-block';
      }

      if(doubleShot){
        upgradeDoubleBtn.style.display = 'none';
      } else {
        upgradeDoubleBtn.style.display = 'inline-block';
      }

      upgradeDamageBtn.style.display = 'inline-block';
      upgradeDamageBtn.textContent = 'Урон +25% (x' + bulletDamage.toFixed(2) + ')';

      upgradeOverlay.style.display = 'flex';
    }
  }

  function closeUpgrade(){
    upgradeOverlay.style.display = 'none';
    nextUpgradeScore += UPGRADE_INTERVAL;
    if(state==='upgrade') state = 'playing';
  }

  upgradeLifeBtn.addEventListener('click', ()=>{
    hp = maxHP;
    renderHP();
    closeUpgrade();
  });

  upgradeShieldBtn.addEventListener('click', ()=>{
    if(shield < MAX_SHIELD){
      shield++;
      renderShield();
    }
    closeUpgrade();
  });

  upgradeDoubleBtn.addEventListener('click', ()=>{
    doubleShot = true;
    closeUpgrade();
  });

  upgradeDamageBtn.addEventListener('click', ()=>{
    bulletDamage *= 1.25;
    closeUpgrade();
  });

