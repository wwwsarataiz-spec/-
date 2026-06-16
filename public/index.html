<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Nexora Elite | Premium</title>
    <style>
        body { background: #0b0e14; color: #e2e8f0; font-family: 'Segoe UI', Roboto, sans-serif; margin: 0; padding-bottom: 90px; }
        .hero { background: linear-gradient(180deg, #1a202c 0%, #0b0e14 100%); padding: 40px 20px; text-align: center; border-bottom: 2px solid #c5a059; }
        .balance-box { background: #161b22; border: 1px solid #30363d; border-radius: 20px; padding: 25px; margin: -20px 20px 20px 20px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
        .balance-val { color: #c5a059; font-size: 2.5em; font-weight: bold; margin: 10px 0; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 0 20px; }
        .btn { padding: 15px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer; transition: 0.3s; }
        .btn-dep { background: #c5a059; color: #000; }
        .btn-wit { background: #21262d; color: #fff; border: 1px solid #c5a059; }
        /* Modal Style */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; }
        .modal-content { background: #161b22; padding: 20px; border-radius: 20px; width: 80%; border: 1px solid #c5a059; text-align: center; }
    </style>
</head>
<body>
    <div class="hero"><h1>Nexora Elite</h1></div>
    <div class="balance-box">
        <div class="balance-text">الرصيد الإجمالي (USDT)</div>
        <div class="balance-val" id="balance">0.00</div>
        <div class="actions">
            <button class="btn btn-dep" onclick="showModal('deposit')">إيداع</button>
            <button class="btn btn-wit" onclick="showModal('withdraw')">سحب</button>
        </div>
    </div>
    
    <!-- النافذة المنبثقة -->
    <div id="modal" class="modal">
        <div class="modal-content">
            <h3 id="modalTitle"></h3>
            <p id="modalBody"></p>
            <button class="btn btn-dep" onclick="closeModal()">إغلاق</button>
        </div>
    </div>

    <div id="content" style="padding: 20px;"></div>
    <div class="nav" style="position: fixed; bottom: 0; width: 100%; background: #161b22; display: flex; justify-content: space-around; padding: 15px 0; border-top: 1px solid #30363d;">
        <a onclick="loadTab('home')" style="cursor:pointer">🏠</a><a onclick="loadTab('tasks')" style="cursor:pointer">📋</a>
        <a onclick="loadTab('ads')" style="cursor:pointer">📺</a><a onclick="loadTab('team')" style="cursor:pointer">👥</a>
    </div>

    <script>
        async function updateBalance() {
            const res = await fetch('/api/user-data', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ telegramId: "7018561132" }) });
            const data = await res.json();
            document.getElementById('balance').innerText = (data.points || 0).toFixed(2);
        }
        
        function showModal(type) {
            document.getElementById('modal').style.display = 'flex';
            document.getElementById('modalTitle').innerText = type === 'deposit' ? 'تعبئة رصيد' : 'طلب سحب';
            document.getElementById('modalBody').innerText = type === 'deposit' ? 'العنوان: USDT-TRC20' : 'يتم المعالجة يدوياً';
        }
        function closeModal() { document.getElementById('modal').style.display = 'none'; }
        
        updateBalance();
        function loadTab(t) { document.getElementById('content').innerHTML = `<h3>قسم ${t}</h3>`; }
    </script>
</body>
</html>
