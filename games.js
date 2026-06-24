// ================================================================
// 1. Three.js - المشهد ثلاثي الأبعاد
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
// 2. خوارزميات الألعاب
// ================================================================
function play3DGame(gameType) {
  if (!currentUser) { alert('⚠️ يرجى تسجيل الدخول'); return; }
  if (casinoBalance < 0.3) {
    document.getElementById('gameResult').textContent = '⚠️ رصيد الكازينو غير كافٍ';
    document.getElementById('gameResult').style.color = '#e74c3c';
    return;
  }
  const bet = 0.3;
  const risk = 'medium';
  let multiplier = 1.5;
  if (risk === 'low') multiplier = 1.5;
  else if (risk === 'medium') multiplier = 1.8;
  else if (risk === 'high') multiplier = 2.0;

  let win = false;
  let profit = 0;
  const winChance = 0.5 - (houseEdge / 100);
  if (Math.random() < winChance) {
    win = true;
    profit = bet * multiplier;
    casinoBalance += profit;
  } else {
    profit = -bet;
    casinoBalance = Math.max(0, casinoBalance - bet);
    adminRevenue += bet;
  }

  document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
  if (currentUser) {
    currentUser.casinoBalance = casinoBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }

  const resultEl = document.getElementById('gameResult');
  if (win) {
    resultEl.innerHTML = `🎉 فوز! ربحت ${profit.toFixed(4)} USDT (مضاعف ${multiplier}x)`;
    resultEl.style.color = '#2ecc71';
  } else {
    resultEl.innerHTML = `💔 خسارة! خسرت ${bet.toFixed(4)} USDT`;
    resultEl.style.color = '#e74c3c';
  }
  if (typeof refreshAdminData === 'function') refreshAdminData();
}
