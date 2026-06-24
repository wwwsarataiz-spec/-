// ================================================================
// 1. مشاهدة الإعلانات
// ================================================================
let adViews = 0;

function watchAd() {
  if (adViews >= 20) {
    document.getElementById('adMessage').textContent = '✅ لديك فرصة مجانية! استخدمها في الكازينو.';
    document.getElementById('adMessage').style.color = '#2ecc71';
    return;
  }
  adViews++;
  document.getElementById('adViews').textContent = adViews;
  const progress = (adViews / 20) * 100;
  document.getElementById('adProgressFill').style.width = progress + '%';
  document.getElementById('adMessage').textContent = `📺 شاهدت إعلاناً (${adViews}/20)`;
  document.getElementById('adMessage').style.color = '#8a7fa0';
  if (adViews >= 20) {
    document.getElementById('adMessage').textContent = '🎉 أكملت 20 مشاهدة! لديك فرصة مجانية في الكازينو.';
    document.getElementById('adMessage').style.color = '#2ecc71';
    casinoBalance += 2.0;
    document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
    if (currentUser) {
      currentUser.casinoBalance = casinoBalance;
      localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
  }
}

// ================================================================
// 2. نشر إعلان ممول
// ================================================================
function submitAd() {
  if (!currentUser) { alert('⚠️ يرجى تسجيل الدخول'); return; }
  const title = document.getElementById('adTitle').value.trim();
  const content = document.getElementById('adContent').value.trim();
  const link = document.getElementById('adLink').value.trim();
  if (!title || !content || !link) { alert('⚠️ املأ جميع الحقول'); return; }
  if (currentBalance < 10) { alert('❌ رصيد غير كافٍ (10 USDT)'); return; }
  if (!confirm(`سيتم خصم 10 USDT لنشر الإعلان. هل تتابع؟`)) return;
  currentBalance = Math.max(0, currentBalance - 10);
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  pendingAds.push({
    userId: currentUser._id,
    title,
    content,
    link,
    status: 'pending'
  });
  document.getElementById('adSubmitStatus').textContent = '✅ تم إرسال الإعلان للمراجعة';
  document.getElementById('adTitle').value = '';
  document.getElementById('adContent').value = '';
  document.getElementById('adLink').value = '';
  if (currentUser) {
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
  if (typeof refreshAdminData === 'function') refreshAdminData();
}
