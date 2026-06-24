// ================================================================
// 1. Three.js - المشهد ثلاثي الأبعاد الرئيسي
// ================================================================
let scene, camera, renderer, currentGameObject;
let threeInitialized = false;
let currentGame = 'none';
let gameAnimId = null;

// ===== إعدادات المضاعفات الجديدة (لصالح البوت) =====
const MULTIPLIERS = {
  low: 1.1,
  medium: 1.2,
  high: 1.5
};

// ===== نسب الفوز الفعلية (أقل من العادلة) =====
const WIN_PROBABILITY = {
  low: 0.70,   // 70%
  medium: 0.55, // 55%
  high: 0.30    // 30%
};

// ===== تهيئة المشهد العام =====
function initThreeJS() {
  const container = document.getElementById('three-container');
  if (!container) return;
  
  // تنظيف أي مشهد سابق
  if (threeInitialized) {
    if (renderer) {
      renderer.dispose();
      container.innerHTML = '';
    }
    if (gameAnimId) {
      cancelAnimationFrame(gameAnimId);
      gameAnimId = null;
    }
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0815);

  const width = container.clientWidth || 400;
  const height = container.clientHeight || 280;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // ===== إضاءة ذهبية وبنفسجية =====
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);

  const goldLight = new THREE.PointLight(0xffd700, 1.2, 10);
  goldLight.position.set(2, 3, 2);
  scene.add(goldLight);

  const purpleLight = new THREE.PointLight(0x9b59b6, 0.8, 10);
  purpleLight.position.set(-2, 1, -2);
  scene.add(purpleLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-1, 2, 3);
  scene.add(fillLight);

  // ===== أرضية بشبكة =====
  const gridHelper = new THREE.GridHelper(6, 12, 0x9b59b6, 0x4a2a6a);
  gridHelper.position.y = -1.2;
  scene.add(gridHelper);

  threeInitialized = true;

  // بدء الحلقة
  animateScene();

  // عرض اللعبة الافتراضية
  showGame('wheel');
}

// ===== حلقة الرسم العامة =====
function animateScene() {
  if (!threeInitialized) return;
  gameAnimId = requestAnimationFrame(animateScene);
  if (currentGameObject) {
    // دوران تلقائي خفيف
    currentGameObject.rotation.y += 0.008;
    currentGameObject.rotation.x += 0.002;
  }
  renderer.render(scene, camera);
}

// ================================================================
// 2. إدارة الألعاب (إنشاء وعرض كل لعبة)
// ================================================================
function showGame(gameType) {
  // حذف الكائن السابق
  if (currentGameObject) {
    scene.remove(currentGameObject);
    currentGameObject = null;
  }

  currentGame = gameType;

  switch(gameType) {
    case 'wheel':
      createWheelGame();
      break;
    case 'dice':
      createDiceGame();
      break;
    case 'crash':
      createCrashGame();
      break;
    case 'street':
      createStreetGame();
      break;
    default:
      createDefaultGame();
  }
}

// ===== اللعبة الافتراضية (مكعب ذهبي) =====
function createDefaultGame() {
  const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x4a3a10,
    emissiveIntensity: 0.3
  });
  currentGameObject = new THREE.Mesh(geometry, material);
  currentGameObject.position.y = 0.2;
  scene.add(currentGameObject);

  // حلقة ذهبية
  const ringGeo = new THREE.TorusGeometry(0.9, 0.04, 16, 32);
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
  ring.position.y = 0.2;
  scene.add(ring);
  // نربط الحلقة بالكائن الرئيسي
  currentGameObject.userData.ring = ring;
}

// ===== 1. عجلة الحظ (3D) =====
function createWheelGame() {
  const group = new THREE.Group();
  
  // جسم العجلة (أسطوانة)
  const wheelGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 24);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a3e,
    metalness: 0.6,
    roughness: 0.3,
    emissive: 0x4a2a6a,
    emissiveIntensity: 0.2
  });
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.rotation.x = Math.PI / 2;
  group.add(wheel);

  // أقسام العجلة (ألوان ذهبية وبنفسجية)
  const segmentCount = 8;
  const colors = [0xffd700, 0x9b59b6, 0xd4af37, 0x6c5ce7, 0xffd700, 0x9b59b6, 0xd4af37, 0x6c5ce7];
  for (let i = 0; i < segmentCount; i++) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const segGeo = new THREE.BoxGeometry(0.2, 0.25, 0.4);
    const segMat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], metalness: 0.3, roughness: 0.5 });
    const seg = new THREE.Mesh(segGeo, segMat);
    const radius = 1.0;
    seg.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    seg.rotation.y = -angle;
    group.add(seg);
  }

  // مؤشر (سهم ذهبي)
  const pointerGeo = new THREE.ConeGeometry(0.15, 0.3, 8);
  const pointerMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.2 });
  const pointer = new THREE.Mesh(pointerGeo, pointerMat);
  pointer.position.set(0, 0.35, 1.3);
  pointer.rotation.x = 0.2;
  group.add(pointer);

  group.position.y = 0.2;
  currentGameObject = group;
  scene.add(group);
}

// ===== 2. النرد ثلاثي الأبعاد =====
function createDiceGame() {
  const group = new THREE.Group();
  
  // مكعب النرد
  const diceGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  const diceMat = new THREE.MeshStandardMaterial({
    color: 0x1e1735,
    metalness: 0.2,
    roughness: 0.4,
    emissive: 0x4a2a6a,
    emissiveIntensity: 0.1
  });
  const dice = new THREE.Mesh(diceGeo, diceMat);
  
  // نقاط النرد (دوائر صغيرة)
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.3 });
  const positions = [
    [0.4, 0.4, 0.51], [-0.4, 0.4, 0.51], [0.4, -0.4, 0.51], [-0.4, -0.4, 0.51], [0, 0, 0.51],
    [0.4, 0.4, -0.51], [-0.4, 0.4, -0.51], [0.4, -0.4, -0.51], [-0.4, -0.4, -0.51], [0, 0, -0.51]
  ];
  positions.forEach(pos => {
    const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(pos[0], pos[1], pos[2]);
    dice.add(dot);
  });

  group.add(dice);
  group.position.y = 0.2;
  currentGameObject = group;
  scene.add(group);
}

// ===== 3. لعبة الكراش (صاروخ 3D) =====
function createCrashGame() {
  const group = new THREE.Group();
  
  // صاروخ (مخروط + أسطوانة)
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.8, 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.7,
    roughness: 0.2,
    emissive: 0x4a3a10,
    emissiveIntensity: 0.3
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.3;
  group.add(body);

  const noseGeo = new THREE.ConeGeometry(0.25, 0.3, 12);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.5, roughness: 0.2 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.y = 0.75;
  group.add(nose);

  // أجنحة الصاروخ
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x9b59b6, metalness: 0.3, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const wingGeo = new THREE.BoxGeometry(0.02, 0.15, 0.3);
    const wing = new THREE.Mesh(wingGeo, wingMat);
    const angle = (i / 4) * Math.PI * 2;
    wing.position.set(Math.cos(angle) * 0.3, 0.1, Math.sin(angle) * 0.3);
    wing.rotation.y = -angle;
    group.add(wing);
  }

  group.position.y = 0.2;
  currentGameObject = group;
  scene.add(group);
}

// ===== 4. لعبة عبور الشارع (سيارات 3D) =====
function createStreetGame() {
  const group = new THREE.Group();
  
  // سيارات صغيرة
  const carColors = [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71];
  for (let i = 0; i < 4; i++) {
    const carGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
    const carMat = new THREE.MeshStandardMaterial({ color: carColors[i % carColors.length], metalness: 0.3, roughness: 0.5 });
    const car = new THREE.Mesh(carGeo, carMat);
    const x = -1.5 + i * 1.0;
    const z = (i % 2 === 0) ? 0.7 : -0.7;
    car.position.set(x, 0.1, z);
    car.rotation.y = (i % 2 === 0) ? 0 : Math.PI;
    group.add(car);
  }

  // دجاجة (شخصية)
  const chickMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.2, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), chickMat);
  body.position.set(1.2, 0.2, 0);
  group.add(body);
  
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), chickMat);
  head.position.set(1.35, 0.35, 0);
  group.add(head);

  // منقار
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c });
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), beakMat);
  beak.position.set(1.45, 0.32, 0);
  beak.rotation.z = 0.3;
  group.add(beak);

  group.position.y = 0.2;
  currentGameObject = group;
  scene.add(group);
}

// ================================================================
// 3. خوارزمية اللعب الجديدة (لصالح البوت)
// ================================================================
function play3DGame(gameType) {
  if (!currentUser) {
    document.getElementById('gameResult').textContent = '⚠️ يرجى تسجيل الدخول أولاً';
    document.getElementById('gameResult').style.color = '#f39c12';
    return;
  }

  // نستخدم مستوى "متوسط" افتراضياً، لكن يمكن جعله اختياري
  const risk = 'medium';
  const bet = 0.3; // رهان ثابت للاختبار

  if (casinoBalance < bet) {
    document.getElementById('gameResult').textContent = '⚠️ رصيد الكازينو غير كافٍ';
    document.getElementById('gameResult').style.color = '#e74c3c';
    return;
  }

  // ===== المضاعف حسب المستوى =====
  const multiplier = MULTIPLIERS[risk] || 1.2;

  // ===== نسبة الفوز الفعلية (لصالح البوت) =====
  const winChance = WIN_PROBABILITY[risk] || 0.55;

  let win = false;
  let profit = 0;

  // تنفيذ اللعبة
  if (Math.random() < winChance) {
    // فوز (نادر)
    win = true;
    profit = bet * multiplier;
    casinoBalance += profit;
  } else {
    // خسارة (غالباً)
    profit = -bet;
    casinoBalance = Math.max(0, casinoBalance - bet);
    adminRevenue += bet; // خسارة اللاعب تذهب للإدارة
  }

  // تحديث الرصيد
  document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
  if (currentUser) {
    currentUser.casinoBalance = casinoBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }

  // عرض النتيجة
  const resultEl = document.getElementById('gameResult');
  if (win) {
    resultEl.innerHTML = `🎉 فوز! ربحت ${profit.toFixed(4)} USDT (مضاعف ${multiplier}x)`;
    resultEl.style.color = '#2ecc71';
  } else {
    resultEl.innerHTML = `💔 خسارة! خسرت ${bet.toFixed(4)} USDT`;
    resultEl.style.color = '#e74c3c';
  }

  // إظهار تأثير اللعبة (حركة)
  if (currentGameObject) {
    // اهتزاز بسيط
    const origY = currentGameObject.position.y;
    currentGameObject.position.y = origY + 0.2;
    setTimeout(() => {
      currentGameObject.position.y = origY;
    }, 300);
  }

  // تحديث إحصائيات الإدارة
  if (typeof refreshAdminData === 'function') refreshAdminData();
}

// ================================================================
// 4. دوال التبديل بين الألعاب (من الواجهة)
// ================================================================
function switchGame(gameType) {
  showGame(gameType);
  // تحديث الأزرار (يمكن إضافة تفعيل بصري)
  document.querySelectorAll('.game-btn').forEach(btn => {
    btn.style.border = 'none';
    if (btn.dataset.game === gameType) {
      btn.style.border = '2px solid #d4af37';
    }
  });
}

// ================================================================
// 5. تحديث حجم المشهد
// ================================================================
window.addEventListener('resize', function() {
  if (threeInitialized && document.getElementById('section-casino').classList.contains('active')) {
    const container = document.getElementById('three-container');
    if (container && renderer) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }
});

// ================================================================
// 6. تصدير الدوال للاستخدام من index.html
// ================================================================
window.initThreeJS = initThreeJS;
window.play3DGame = play3DGame;
window.switchGame = switchGame;
