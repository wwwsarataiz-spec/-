// ================================================================
// 1. عجلة الحظ (Canvas)
// ================================================================
const wheelSegments = [
  { label: '10x', value: 10, color: '#ffd700' },
  { label: '5x', value: 5, color: '#9b59b6' },
  { label: '2x', value: 2, color: '#2ecc71' },
  { label: '1x', value: 1, color: '#3498db' },
  { label: '0.5x', value: 0.5, color: '#f39c12' },
  { label: '0x', value: 0, color: '#e74c3c' },
  { label: '3x', value: 3, color: '#1abc9c' },
  { label: '0x', value: 0, color: '#e67e22' }
];
let wheelRotation = 0;
let wheelSpinning = false;

function drawWheel(rotation = 0) {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2, r = Math.min(w,h)/2 * 0.9;
  ctx.clearRect(0, 0, w, h);
  const segCount = wheelSegments.length;
  const angleStep = (2 * Math.PI) / segCount;
  for (let i = 0; i < segCount; i++) {
    const startAngle = i * angleStep + rotation;
    const endAngle = startAngle + angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = wheelSegments[i].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const midAngle = startAngle + angleStep/2;
    const textX = cx + (r * 0.65) * Math.cos(midAngle);
    const textY = cy + (r * 0.65) * Math.sin(midAngle);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wheelSegments[i].label, textX, textY);
  }
  // المؤشر
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx-12, 25);
  ctx.lineTo(cx+12, 25);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function spinWheel() {
  if (wheelSpinning) return;
  const bet = parseFloat(document.getElementById('wheelBet').value);
  const resultEl = document.getElementById('wheelResult');
  if (!bet || bet < 0.3) {
    resultEl.textContent = '⚠️ الحد الأدنى 0.3 USDT';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (casinoBalance < bet) {
    resultEl.textContent = '⚠️ رصيد الكازينو غير كافٍ';
    resultEl.style.color = '#f39c12';
    return;
  }
  
  wheelSpinning = true;
  // تحديد النتيجة (خوارزمية لصالح المنصة)
  let winIndex = Math.floor(Math.random() * wheelSegments.length);
  // تعديل الاحتمالات لصالح المنصة (زيادة فرص الخسارة)
  if (Math.random() < 0.3) { // 30% فرصة للفوز الحقيقي
    // فوز عشوائي
  } else {
    // خسارة: نختار قطاع بقيمة 0 أو منخفضة
    const lossIndices = [5, 7]; // قطاعات الخسارة
    winIndex = lossIndices[Math.floor(Math.random() * lossIndices.length)];
  }
  
  const multiplier = wheelSegments[winIndex].value;
  const isWin = multiplier > 0;
  let profit = isWin ? bet * multiplier : -bet;
  
  // دوران العجلة
  const segAngle = (2 * Math.PI) / wheelSegments.length;
  const targetAngle = (2 * Math.PI) - (winIndex * segAngle) - segAngle/2;
  const extraSpins = 3 + Math.floor(Math.random() * 3);
  const totalRotation = extraSpins * 2 * Math.PI + targetAngle;
  wheelRotation += totalRotation;
  const canvas = document.getElementById('wheelCanvas');
  canvas.style.transition = 'transform 4s cubic-bezier(0.2,0.8,0.2,1)';
  canvas.style.transform = `rotate(${wheelRotation}rad)`;
  
  setTimeout(() => {
    canvas.style.transition = 'none';
    if (isWin) {
      casinoBalance += profit;
      resultEl.textContent = `🎉 فوز! مضاعف ×${multiplier} | ربحت ${profit.toFixed(4)} USDT`;
      resultEl.style.color = '#2ecc71';
    } else {
      casinoBalance = Math.max(0, casinoBalance - bet);
      resultEl.textContent = `😢 خسارة! حظاً أوفر`;
      resultEl.style.color = '#e74c3c';
      adminRevenue += bet;
      sendLossToAdmin(bet, 'wheel');
    }
    document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
    if (currentUser) {
      currentUser.casinoBalance = casinoBalance;
      localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
    wheelSpinning = false;
    if (typeof refreshAdminData === 'function') refreshAdminData();
  }, 4200);
}

// ================================================================
// 2. النرد 3D
// ================================================================
let diceRolling = false;

function rollDice() {
  if (diceRolling) return;
  const bet = parseFloat(document.getElementById('diceBet').value);
  const guess = document.getElementById('diceGuess').value;
  const resultEl = document.getElementById('diceResult');
  if (!bet || bet < 0.3) {
    resultEl.textContent = '⚠️ الحد الأدنى 0.3 USDT';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (casinoBalance < bet) {
    resultEl.textContent = '⚠️ رصيد الكازينو غير كافٍ';
    resultEl.style.color = '#f39c12';
    return;
  }
  
  diceRolling = true;
  const roll = Math.floor(Math.random() * 6) + 1;
  let isWin = false;
  let baseMultiplier = 0;
  if (guess === 'even' && roll%2===0) { isWin = true; baseMultiplier = 2; }
  else if (guess === 'odd' && roll%2!==0) { isWin = true; baseMultiplier = 2; }
  else if (parseInt(guess) === roll) { isWin = true; baseMultiplier = 6; }
  
  // خوارزمية لصالح المنصة
  let riskMult = { low:0.7, medium:0.95, high:1.3 }[diceRisk] || 1;
  let finalMult = Math.round((baseMultiplier * 0.95 * riskMult) * 10) / 10;
  let winChance = getWinProbability(diceRisk, 0.5);
  let actualWin = (Math.random() < winChance && isWin);
  let profit = actualWin ? bet * finalMult : -bet;
  
  // تحريك النرد 3D
  const dice = document.getElementById('dice3d');
  const rotX = 720 + Math.floor(Math.random() * 360);
  const rotY = 720 + Math.floor(Math.random() * 360);
  dice.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  
  setTimeout(() => {
    const faceMap = {
      1: 'rotateX(0deg) rotateY(0deg)',
      2: 'rotateX(-90deg) rotateY(0deg)',
      3: 'rotateX(0deg) rotateY(-90deg)',
      4: 'rotateX(0deg) rotateY(90deg)',
      5: 'rotateX(90deg) rotateY(0deg)',
      6: 'rotateX(0deg) rotateY(180deg)'
    };
    dice.style.transform = faceMap[roll] || 'rotateX(0deg) rotateY(0deg)';
    
    if (actualWin) {
      casinoBalance += profit;
      resultEl.textContent = `🎉 فوز! الرقم: ${roll} | مضاعف: ${finalMult}x | ربحت ${profit.toFixed(4)} USDT`;
      resultEl.style.color = '#2ecc71';
    } else {
      casinoBalance = Math.max(0, casinoBalance - bet);
      resultEl.textContent = `😢 خسارة! الرقم: ${roll}`;
      resultEl.style.color = '#e74c3c';
      adminRevenue += bet;
      sendLossToAdmin(bet, 'dice');
    }
    document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
    if (currentUser) {
      currentUser.casinoBalance = casinoBalance;
      localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
    diceRolling = false;
    if (typeof refreshAdminData === 'function') refreshAdminData();
  }, 1500);
}

// ================================================================
// 3. لعبة الكراش
// ================================================================
let crashActive = false;
let crashMultiplier = 1.00;
let crashIntervalId = null;
let crashBetAmount = 0;
let crashCashedOut = false;

function startCrash() {
  if (crashActive) return;
  const bet = parseFloat(document.getElementById('crashBet').value);
  const resultEl = document.getElementById('crashResult');
  if (!bet || bet < 0.3) {
    resultEl.textContent = '⚠️ الحد الأدنى 0.3 USDT';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (casinoBalance < bet) {
    resultEl.textContent = '⚠️ رصيد الكازينو غير كافٍ';
    resultEl.style.color = '#f39c12';
    return;
  }
  
  crashBetAmount = bet;
  crashMultiplier = 1.00;
  crashActive = true;
  crashCashedOut = false;
  document.getElementById('crashMultiplier').textContent = '1.00x';
  document.getElementById('crashProgress').style.width = '0%';
  document.getElementById('crashResult').textContent = '';
  document.getElementById('crashExplosion').style.display = 'none';
  document.getElementById('crashCashoutBtn').disabled = false;
  
  // تحديد نقطة الانهيار (لصالح المنصة)
  let crashPoint = 1.2 + Math.random() * 1.5;
  const maxCrash = 3.5;
  crashPoint = Math.min(crashPoint, maxCrash);
  
  if (crashIntervalId) clearInterval(crashIntervalId);
  crashIntervalId = setInterval(() => {
    crashMultiplier += 0.02 + Math.random() * 0.04;
    crashMultiplier = Math.round(crashMultiplier * 100) / 100;
    document.getElementById('crashMultiplier').textContent = crashMultiplier.toFixed(2) + 'x';
    const progress = Math.min((crashMultiplier / maxCrash) * 100, 100);
    document.getElementById('crashProgress').style.width = progress + '%';
    
    // تغيير اللون حسب المخاطرة
    if (crashMultiplier > 1.8) document.getElementById('crashMultiplier').style.color = '#f1c40f';
    if (crashMultiplier > 2.8) document.getElementById('crashMultiplier').style.color = '#e74c3c';
    
    if (crashMultiplier >= crashPoint && !crashCashedOut) {
      clearInterval(crashIntervalId);
      crashActive = false;
      document.getElementById('crashCashoutBtn').disabled = true;
      document.getElementById('crashExplosion').style.display = 'block';
      document.getElementById('crashExplosion').textContent = '💥';
      setTimeout(() => {
        document.getElementById('crashExplosion').style.display = 'none';
      }, 1000);
      casinoBalance = Math.max(0, casinoBalance - crashBetAmount);
      document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
      document.getElementById('crashResult').textContent = `💥 انهارت عند ${crashMultiplier.toFixed(2)}x | خسرت ${crashBetAmount.toFixed(4)} USDT`;
      document.getElementById('crashResult').style.color = '#e74c3c';
      adminRevenue += crashBetAmount;
      sendLossToAdmin(crashBetAmount, 'crash');
      if (currentUser) {
        currentUser.casinoBalance = casinoBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
      }
      if (typeof refreshAdminData === 'function') refreshAdminData();
    }
  }, 100);
}

function cashoutCrash() {
  if (!crashActive || crashCashedOut) return;
  crashCashedOut = true;
  clearInterval(crashIntervalId);
  crashActive = false;
  document.getElementById('crashCashoutBtn').disabled = true;
  const win = crashBetAmount * crashMultiplier;
  casinoBalance += win;
  document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
  document.getElementById('crashResult').textContent = `🎉 سحبت عند ${crashMultiplier.toFixed(2)}x | ربحت ${win.toFixed(4)} USDT`;
  document.getElementById('crashResult').style.color = '#2ecc71';
  if (currentUser) {
    currentUser.casinoBalance = casinoBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
}

// ================================================================
// 4. لعبة عبور الشارع
// ================================================================
let streetGameActive = false;
let streetSteps = 0;
let streetMultiplier = 1.00;
let streetBetAmount = 0;
let streetCashedOut = false;
let streetIntervalId = null;
const streetMultipliers = { low: 1.2, medium: 1.5, high: 2.0 };
const maxStreetSteps = 10;

function initStreetGame() {
  const canvas = document.getElementById('streetCanvas');
  if (!canvas) return;
  const container = document.getElementById('streetGame');
  canvas.width = container.clientWidth || 400;
  canvas.height = container.clientHeight || 250;
  drawStreetScene(0);
}

function drawStreetScene(step) {
  const canvas = document.getElementById('streetCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  // الخلفية
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(0.5, '#1a1a3e');
  grad.addColorStop(1, '#0c0914');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // خطوط الشارع
  ctx.strokeStyle = 'rgba(255,215,0,0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  for (let i=0; i<w; i+=25) { ctx.moveTo(i, h*0.5); ctx.lineTo(i+15, h*0.5); }
  ctx.stroke();
  ctx.setLineDash([]);
  // أرصفة
  ctx.fillStyle = 'rgba(30,20,40,0.4)';
  ctx.fillRect(0, 0, 12, h);
  ctx.fillRect(w-12, 0, 12, h);
  // عقبات (سيارات)
  const obs = [
    {x: 50, y: 70, w: 35, h: 18, color: '#e74c3c'},
    {x: 140, y: 140, w: 40, h: 18, color: '#f1c40f'},
    {x: 230, y: 95, w: 30, h: 18, color: '#3498db'},
    {x: 320, y: 180, w: 38, h: 18, color: '#2ecc71'}
  ];
  obs.forEach(o => {
    ctx.shadowColor = o.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(o.x+4, o.y+3, 8, 4);
    ctx.fillRect(o.x+o.w-12, o.y+3, 8, 4);
  });
  ctx.shadowBlur = 0;
  // الدجاجة
  const progress = Math.min(step / maxStreetSteps, 1);
  const x = 15 + progress * (w - 45);
  const y = h*0.5 - 8 + Math.sin(step*0.3)*6;
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 14, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.arc(x+3, y-12, 7, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x+7, y-13, 2.5, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x+8.5, y-13, 1.2, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(x+10, y-9);
  ctx.lineTo(x+15, y-7);
  ctx.lineTo(x+10, y-5);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function startStreetGame() {
  if (streetGameActive) return;
  const bet = parseFloat(document.getElementById('streetBet').value);
  const resultEl = document.getElementById('streetResult');
  if (!bet || bet < 0.3) {
    resultEl.textContent = '⚠️ الحد الأدنى 0.3 USDT';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (casinoBalance < bet) {
    resultEl.textContent = '⚠️ رصيد الكازينو غير كافٍ';
    resultEl.style.color = '#f39c12';
    return;
  }
  
  streetBetAmount = bet;
  streetSteps = 0;
  streetMultiplier = 1.00;
  streetGameActive = true;
  streetCashedOut = false;
  document.getElementById('streetMultiplier').textContent = '1.00x';
  document.getElementById('streetSteps').textContent = '0';
  document.getElementById('streetResult').textContent = '';
  document.getElementById('streetCashoutBtn').disabled = false;
  document.getElementById('streetProgressFill').style.width = '0%';
  
  const maxSteps = 3 + Math.floor(Math.random() * 4);
  let stepCount = 0;
  
  if (streetIntervalId) clearInterval(streetIntervalId);
  streetIntervalId = setInterval(() => {
    stepCount++;
    streetSteps = stepCount;
    document.getElementById('streetSteps').textContent = streetSteps;
    const mult = streetMultipliers[streetRisk] || 1.5;
    streetMultiplier = 1 + (stepCount / maxStreetSteps) * (mult - 1);
    streetMultiplier = Math.round(streetMultiplier*100)/100;
    document.getElementById('streetMultiplier').textContent = streetMultiplier.toFixed(2) + 'x';
    const progress = Math.min((stepCount / maxStreetSteps) * 100, 100);
    document.getElementById('streetProgressFill').style.width = progress + '%';
    drawStreetScene(stepCount);
    
    if (stepCount >= maxSteps && !streetCashedOut) {
      clearInterval(streetIntervalId);
      streetGameActive = false;
      document.getElementById('streetCashoutBtn').disabled = true;
      casinoBalance = Math.max(0, casinoBalance - streetBetAmount);
      document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
      document.getElementById('streetResult').textContent = `💥 تعثرت! خسرت ${streetBetAmount.toFixed(4)} USDT`;
      document.getElementById('streetResult').style.color = '#e74c3c';
      adminRevenue += streetBetAmount;
      sendLossToAdmin(streetBetAmount, 'street');
      if (currentUser) {
        currentUser.casinoBalance = casinoBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
      }
      if (typeof refreshAdminData === 'function') refreshAdminData();
    }
  }, 700);
}

function cashoutStreet() {
  if (!streetGameActive || streetCashedOut) return;
  streetCashedOut = true;
  clearInterval(streetIntervalId);
  streetGameActive = false;
  document.getElementById('streetCashoutBtn').disabled = true;
  const win = streetBetAmount * streetMultiplier;
  casinoBalance += win;
  document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
  document.getElementById('streetResult').textContent = `🎉 سحبت عند ${streetMultiplier.toFixed(2)}x | ربحت ${win.toFixed(4)} USDT`;
  document.getElementById('streetResult').style.color = '#2ecc71';
  if (currentUser) {
    currentUser.casinoBalance = casinoBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
}

// ================================================================
// 5. Three.js (تطوير البيئة ثلاثية الأبعاد)
// ================================================================
let scene, camera, renderer, gameObject;
let threeInitialized = false;

function initThreeJS() {
  const container = document.getElementById('three-container');
  if (!container) return;
  if (threeInitialized) {
    if (renderer) {
      renderer.dispose();
      container.innerHTML = '';
    }
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0815, 0);
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404060);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffd700, 1.5);
  dirLight.position.set(1, 2, 3);
  scene.add(dirLight);
  const backLight = new THREE.PointLight(0x9b59b6, 0.5);
  backLight.position.set(-2, 1, -2);
  scene.add(backLight);

  const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x4a3a10,
    emissiveIntensity: 0.3
  });
  gameObject = new THREE.Mesh(geometry, material);
  scene.add(gameObject);

  const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 16, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x4a3a10,
    emissiveIntensity: 0.2
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.rotation.z = Math.PI / 4;
  scene.add(ring);
  gameObject.userData.ring = ring;

  const particleGeo = new THREE.BufferGeometry();
  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 6;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x9b59b6,
    size: 0.03,
    transparent: true,
    opacity: 0.6
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);
  gameObject.userData.particles = particles;

  threeInitialized = true;
  animateThree();
}

function animateThree() {
  if (!threeInitialized) return;
  requestAnimationFrame(animateThree);
  if (gameObject) {
    gameObject.rotation.x += 0.005;
    gameObject.rotation.y += 0.01;
    if (gameObject.userData.ring) {
      gameObject.userData.ring.rotation.z += 0.005;
    }
    if (gameObject.userData.particles) {
      gameObject.userData.particles.rotation.y += 0.001;
    }
  }
  renderer.render(scene, camera);
}

// ================================================================
// 6. دوال مساعدة
// ================================================================
function getWinProbability(riskLevel, baseChance) {
  const maxProb = { low: 0.80, medium: 0.70, high: 0.40 };
  const max = maxProb[riskLevel] || 0.70;
  return Math.min(baseChance, max);
}

function sendLossToAdmin(amount, gameType) {
  adminRevenue += amount;
  fetch('/api/admin/loss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, game: gameType, userId: currentUser ? currentUser._id : 'guest' })
  }).catch(e => console.error(e));
}

// ================================================================
// 7. تهيئة الألعاب عند تحميل الصفحة
// ================================================================
window.addEventListener('load', function() {
  setTimeout(() => {
    drawWheel();
    initStreetGame();
  }, 500);
});

window.addEventListener('resize', function() {
  if (threeInitialized && document.getElementById('section-casino').classList.contains('active')) {
    const container = document.getElementById('three-container');
    if (container && renderer) {
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
  }
  initStreetGame();
});
