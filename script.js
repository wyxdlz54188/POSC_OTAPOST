// ========== 全局变量 ==========
let requestStartTime = 0;
const historyList = [];
const MAX_HISTORY = 20;

// ========== 配置区（可自行修改） ==========
const USE_WORKER_PROXY = true;   // true = 走 Worker 代理，false = 浏览器直连
const PROXY_PATH = '/proxy';
// ==========================================

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    // 绑定按钮事件
    document.getElementById('sendBtn').addEventListener('click', sendPostRequest);
    document.getElementById('clearBtn').addEventListener('click', clearResponse);
    document.getElementById('formatBtn').addEventListener('click', formatJSON);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    
    // Tab 切换功能
    document.querySelectorAll('.layui-tab-title li').forEach(li => {
        li.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            // 切换tab按钮样式
            this.parentElement.querySelectorAll('li').forEach(l => l.classList.remove('layui-this'));
            this.classList.add('layui-this');
            // 切换内容显示
            document.querySelectorAll('.layui-tab-item').forEach(item => item.classList.remove('layui-show'));
            document.getElementById(tabName + 'Tab').classList.add('layui-show');
        });
    });
    
    document.getElementById('jsonData').addEventListener('input', validateJSON);
    
    loadHistoryFromStorage();
    loadSavedInputs();
    validateJSON();
});

// ========== 发送 POST 请求（核心功能） ==========
async function sendPostRequest() {
    const protocol = document.getElementById('protocol').value;
    const hostPath = document.getElementById('url').value.trim().replace(/^https?:\/\//, '');
    if (!hostPath) { alert('请输入目标地址'); return; }
    const finalUrl = protocol + hostPath;

    // JSON 验证
    let jsonData;
    try {
        jsonData = JSON.parse(document.getElementById('jsonData').value);
    } catch (e) {
        document.getElementById('jsonError').textContent = '❌ JSON 格式错误: ' + e.message;
        return;
    }

    // UI 状态更新
    const sendBtn = document.getElementById('sendBtn');
    const btnText = sendBtn.querySelector('.btn-text');
    const spinner = sendBtn.querySelector('.loading-spinner');
    sendBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline';
    document.getElementById('jsonError').textContent = '';
    updateStatusBadge('pending', '请求中...');
    requestStartTime = performance.now();

    try {
        let response;
        
        if (USE_WORKER_PROXY) {
            // 通过 Cloudflare Worker 代理发送
            response = await fetch(PROXY_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUrl: finalUrl, data: jsonData })
            });
        } else {
            // 浏览器直连模式
            response = await fetch(finalUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jsonData)
            });
        }
        
        const requestTime = (performance.now() - requestStartTime).toFixed(2);
        const responseText = await response.text();
        const responseSize = new Blob([responseText]).size;
        
        let responseData, isJSON = false;
        try {
            responseData = JSON.parse(responseText);
            isJSON = true;
        } catch (e) {
            responseData = responseText;
        }
        
        displayResponse({
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: responseData,
            isJSON: isJSON,
            time: requestTime,
            size: formatBytes(responseSize)
        });
        
        updateStatusBadge(response.ok ? 'success' : 'error', `${response.status} ${response.statusText}`);
        
        saveToHistory({
            url: finalUrl,
            method: 'POST',
            status: response.status,
            time: requestTime,
            timestamp: new Date().toLocaleString(),
            proxied: USE_WORKER_PROXY,
            jsonData: document.getElementById('jsonData').value
        });
        
        saveInputs();
        
    } catch (error) {
        const requestTime = (performance.now() - requestStartTime).toFixed(2);
        
        let errorMessage = error.message;
        if (errorMessage.includes('Failed to fetch')) {
            errorMessage = '请求失败：网络错误或 CORS 跨域限制。';
        }
        
        displayError({ message: errorMessage, time: requestTime });
        updateStatusBadge('error', '请求失败');
        
        saveToHistory({
            url: finalUrl,
            method: 'POST',
            status: 'Error',
            time: requestTime,
            timestamp: new Date().toLocaleString(),
            error: errorMessage,
            proxied: USE_WORKER_PROXY,
            jsonData: document.getElementById('jsonData').value
        });
    } finally {
        sendBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// ========== 以下全是必要的辅助函数（之前漏掉的） ==========

// 显示成功响应
function displayResponse(data) {
    document.getElementById('responseBody').textContent = data.isJSON ? JSON.stringify(data.body, null, 2) : data.body;
    
    let headersText = '';
    data.headers.forEach((value, key) => {
        headersText += `${key}: ${value}\n`;
    });
    document.getElementById('responseHeaders').textContent = headersText || '无响应头信息';
    
    document.getElementById('requestTime').textContent = data.time + ' ms';
    document.getElementById('responseSize').textContent = data.size;
    document.getElementById('statusCode').textContent = data.status;
}

// 显示错误信息
function displayError(e) {
    document.getElementById('responseBody').textContent = '请求错误: ' + e.message;
    document.getElementById('responseHeaders').textContent = '无响应头信息';
    document.getElementById('requestTime').textContent = e.time + ' ms';
    document.getElementById('responseSize').textContent = '-';
    document.getElementById('statusCode').textContent = 'Error';
}

// 更新右上角状态标签
function updateStatusBadge(type, text) {
    const badge = document.getElementById('statusBadge');
    badge.textContent = text;
    badge.className = 'status-badge';
    if (type === 'success') badge.classList.add('status-success');
    else if (type === 'error') badge.classList.add('status-error');
    else if (type === 'pending') badge.classList.add('status-pending');
}

// 实时验证 JSON 格式
function validateJSON() {
    const errorEl = document.getElementById('jsonError');
    try {
        JSON.parse(document.getElementById('jsonData').value);
        errorEl.textContent = '✅ JSON 格式正确';
        errorEl.style.color = '#27ae60';
    } catch (e) {
        errorEl.textContent = '❌ JSON 格式错误: ' + e.message;
        errorEl.style.color = '#e74c3c';
    }
}

// 格式化 JSON 输入框内容
function formatJSON() {
    const el = document.getElementById('jsonData');
    try {
        el.value = JSON.stringify(JSON.parse(el.value), null, 2);
        validateJSON();
        saveInputs();
    } catch (e) {
        alert('JSON 格式错误，无法格式化');
    }
}

// 清空响应区域
function clearResponse() {
    document.getElementById('responseBody').textContent = '等待发送请求...';
    document.getElementById('responseHeaders').textContent = '';
    document.getElementById('requestTime').textContent = '-';
    document.getElementById('responseSize').textContent = '-';
    document.getElementById('statusCode').textContent = '-';
    updateStatusBadge('pending', '等待请求');
}

// ========== 历史记录相关函数 ==========

function saveToHistory(item) {
    historyList.unshift(item);
    if (historyList.length > MAX_HISTORY) historyList.pop();
    renderHistory();
    localStorage.setItem('postTestHistory', JSON.stringify(historyList));
}

function renderHistory() {
    const container = document.getElementById('historyList');
    if (historyList.length === 0) {
        container.innerHTML = '<p class="empty-history">暂无历史记录</p>';
        return;
    }
    
    container.innerHTML = historyList.map((item, index) => `
        <div class="history-item" onclick="loadHistoryItem(${index})">
            <div class="history-url">${item.method} ${item.url}</div>
            <div class="history-meta">
                <span>状态: ${item.status}</span>
                <span>⏱️ ${item.time}ms</span>
                <span>🕐 ${item.timestamp}</span>
            </div>
        </div>
    `).join('');
}

function loadHistoryItem(index) {
    const item = historyList[index];
    if (!item) return;
    
    try {
        const urlObj = new URL(item.url);
        document.getElementById('protocol').value = urlObj.protocol;
        document.getElementById('url').value = urlObj.host + urlObj.pathname;
    } catch (e) {
        document.getElementById('url').value = item.url.replace(/^https?:\/\//, '');
    }
    
    if (item.jsonData) document.getElementById('jsonData').value = item.jsonData;
    validateJSON();
    saveInputs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
        historyList.length = 0;
        localStorage.removeItem('postTestHistory');
        renderHistory();
    }
}

function loadHistoryFromStorage() {
    try {
        const stored = localStorage.getItem('postTestHistory');
        if (stored) {
            historyList.push(...JSON.parse(stored));
            renderHistory();
        }
    } catch (e) {
        console.error('加载历史记录失败', e);
    }
}

// ========== localStorage 保存/读取输入内容 ==========

function saveInputs() {
    const data = {
        protocol: document.getElementById('protocol').value,
        url: document.getElementById('url').value,
        jsonData: document.getElementById('jsonData').value
    };
    localStorage.setItem('postTestInputs', JSON.stringify(data));
}

function loadSavedInputs() {
    try {
        const saved = JSON.parse(localStorage.getItem('postTestInputs'));
        if (saved) {
            if (saved.protocol) document.getElementById('protocol').value = saved.protocol;
            if (saved.url) document.getElementById('url').value = saved.url;
            if (saved.jsonData) document.getElementById('jsonData').value = saved.jsonData;
        }
    } catch (e) {}
}

// ========== 工具函数 ==========

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
