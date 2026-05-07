let startTime;
let timerInterval;
let elapsedTime = 0;
let isRunning = false;
let currentUserName = '';
let currentJob = '';
let currentConfirmVal = '';

const display = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const nameInput = document.getElementById('name-input');
const jobInput = document.getElementById('job-input');
const confirmBtn = document.getElementById('confirm-btn');
const confirmNameSpan = document.getElementById('confirm-name-span');
const confirmJobSpan = document.getElementById('confirm-job-span');
const statusLabel = document.getElementById('status-label');
const unpaidBody = document.getElementById('unpaid-body');
const paidBody = document.getElementById('paid-body');
const loginSection = document.getElementById('login-section');
const mainApp = document.getElementById('main-app');
const changeUserBtn = document.getElementById('change-user-btn');
const currentEmployeeTitle = document.getElementById('current-employee-title');
const currentJobTitle = document.getElementById('current-job-title');
const nameStatus = document.getElementById('name-status');
const addUserBtn = document.getElementById('add-user-btn');
const nameInputContainer = document.getElementById('name-input-container');
const quickSelectContainer = document.getElementById('quick-select');
const userButtons = document.querySelectorAll('.btn-select-user');

// Payment elements
const totalUnpaidDisplay = document.getElementById('total-unpaid-display');
const payBtn = document.getElementById('pay-btn');
const payTotalSpan = document.getElementById('pay-total-span');
const unpaidSummaryBadge = document.getElementById('unpaid-summary-badge');
const paidCountBadge = document.getElementById('paid-count-badge');

// Accordion elements
const unpaidHeader = document.getElementById('unpaid-header');
const unpaidContent = document.getElementById('unpaid-content');
const paidHeader = document.getElementById('paid-header');
const paidContent = document.getElementById('paid-content');

function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateDisplay() {
    const now = Date.now();
    elapsedTime = now - startTime;
    display.textContent = formatTime(elapsedTime);
}

// Selection logic
userButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        userButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentUserName = btn.dataset.name;
        nameInputContainer.style.display = 'none';
        nameInput.value = currentUserName;
        updateConfirmButton();
    });
});

addUserBtn.addEventListener('click', () => {
    userButtons.forEach(b => b.classList.remove('active'));
    nameInputContainer.style.display = 'flex';
    nameInput.value = '';
    nameInput.focus();
    currentUserName = '';
    updateConfirmButton();
});

// Login logic
let checkTimeout;
async function updateConfirmButton() {
    const name = nameInput.value.trim();
    const job = jobInput.value.trim();
    
    if (name.length > 0) {
        confirmNameSpan.textContent = name;
        confirmJobSpan.textContent = job ? `(${job})` : '';
        confirmBtn.style.display = 'flex';
        
        // Real-time check
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/check_user?name=${encodeURIComponent(name)}`);
                const data = await res.json();
                if (data.exists) {
                    nameStatus.textContent = '✅ Đã có trong hệ thống';
                    nameStatus.style.color = '#10b981';
                } else {
                    nameStatus.textContent = '🆕 Chưa được đăng ký (Tên mới)';
                    nameStatus.style.color = '#94a3b8';
                }
            } catch (e) {}
        }, 300);

    } else {
        confirmBtn.style.display = 'none';
        nameStatus.textContent = '';
    }
}

nameInput.addEventListener('input', updateConfirmButton);
jobInput.addEventListener('input', updateConfirmButton);

confirmBtn.addEventListener('click', async () => {
    currentUserName = nameInput.value.trim();
    currentJob = jobInput.value.trim();
    if (currentUserName) {
        loginSection.style.display = 'none';
        mainApp.style.display = 'block';
        
        currentEmployeeTitle.textContent = currentUserName.toUpperCase();
        currentEmployeeTitle.style.display = 'block';
        currentJobTitle.textContent = currentJob || 'Chưa chọn công việc';
        currentJobTitle.style.display = 'block';
        
        await checkSessionStatus();
        loadLogs(currentUserName);
    }
});

// Accordion logic
unpaidHeader.addEventListener('click', () => {
    const isVisible = unpaidContent.style.display === 'block';
    unpaidContent.style.display = isVisible ? 'none' : 'block';
    unpaidHeader.style.background = isVisible ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.2)';
});

paidHeader.addEventListener('click', () => {
    const isVisible = paidContent.style.display === 'block';
    paidContent.style.display = isVisible ? 'none' : 'block';
    paidHeader.style.background = isVisible ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)';
});

async function checkSessionStatus() {
    try {
        const response = await fetch(`/api/status?name=${encodeURIComponent(currentUserName)}`);
        const data = await response.json();
        
        if (data.is_running) {
            startTime = new Date(data.start_time).getTime();
            currentJob = data.job || currentJob;
            currentJobTitle.textContent = currentJob;
            
            timerInterval = setInterval(updateDisplay, 1000);
            isRunning = true;
            
            startBtn.disabled = true;
            stopBtn.disabled = false;
            changeUserBtn.disabled = true;
            payBtn.disabled = true;
            
            statusLabel.textContent = `Đang làm việc: ${currentJob}`;
            statusLabel.className = 'status-active';
        } else {
            statusLabel.textContent = `Sẵn sàng`;
            statusLabel.className = 'status-idle';
        }
    } catch (error) {
        console.error('Status Error:', error);
    }
}

changeUserBtn.addEventListener('click', () => {
    if (isRunning) {
        if (!confirm('Hệ thống đang chạy. Đổi người/công việc sẽ không dừng phiên hiện tại. Tiếp tục?')) return;
        clearInterval(timerInterval);
        isRunning = false;
    }
    mainApp.style.display = 'none';
    currentEmployeeTitle.style.display = 'none';
    currentJobTitle.style.display = 'none';
    loginSection.style.display = 'flex';
    nameInput.value = '';
    jobInput.value = '';
    confirmBtn.style.display = 'none';
    nameStatus.textContent = '';
    nameInputContainer.style.display = 'none';
    userButtons.forEach(b => b.classList.remove('active'));
});

async function startTimer() {
    try {
        const response = await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentUserName, job: currentJob })
        });
        const data = await response.json();
        if (data.success) {
            startTime = Date.now();
            timerInterval = setInterval(updateDisplay, 1000);
            isRunning = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            changeUserBtn.disabled = true;
            payBtn.disabled = true;
            statusLabel.textContent = `Đang làm việc: ${currentJob}`;
            statusLabel.className = 'status-active';
        }
    } catch (e) { console.error(e); }
}

async function stopTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    try {
        const response = await fetch('/api/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentUserName })
        });
        const data = await response.json();
        if (data.success) {
            display.textContent = '00:00:00';
            startBtn.disabled = false;
            stopBtn.disabled = true;
            changeUserBtn.disabled = false;
            payBtn.disabled = false;
            statusLabel.textContent = 'Sẵn sàng';
            statusLabel.className = 'status-idle';
            loadLogs(currentUserName);
        }
    } catch (e) { console.error(e); }
}

async function loadLogs(name) {
    try {
        const response = await fetch(`/api/logs?name=${encodeURIComponent(name)}`);
        const data = await response.json();
        
        // Render Unpaid
        unpaidBody.innerHTML = '';
        data.unpaid_logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${log.date}</td><td>${log.job || '-'}</td><td>${log.start}</td><td>${log.stop}</td><td>${log.duration_str}</td>`;
            unpaidBody.appendChild(row);
        });

        // Render Paid Batches
        paidBody.innerHTML = '';
        data.paid_batches.forEach(b => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${b.date_range}</td><td>${b.total_hours} giờ (${b.total_str})</td><td style="color: var(--success);">Đã thanh toán</td>`;
            paidBody.appendChild(row);
        });

        // Update UI Badges
        unpaidSummaryBadge.textContent = data.total_str;
        totalUnpaidDisplay.textContent = data.total_str;
        payTotalSpan.textContent = data.confirm_val;
        paidCountBadge.textContent = `${data.paid_batches.length} đợt`;
        currentConfirmVal = data.confirm_val;
        
        if (data.total_seconds <= 0 || isRunning) {
            payBtn.disabled = true;
            payBtn.style.opacity = '0.3';
        } else {
            payBtn.disabled = false;
            payBtn.style.opacity = '1';
        }
    } catch (e) { console.error(e); }
}

payBtn.addEventListener('click', async () => {
    const userInput = prompt(`Xác nhận thanh toán cho ${currentUserName}.\nNhập chính xác: "${currentConfirmVal}" để xác nhận:`);
    if (userInput && userInput.trim() === currentConfirmVal) {
        const response = await fetch('/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentUserName })
        });
        if ((await response.json()).success) {
            alert('Đã thanh toán thành công!');
            loadLogs(currentUserName);
        }
    } else if (userInput) {
        alert('Sai thông tin xác nhận!');
    }
});

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);
updateConfirmButton();
