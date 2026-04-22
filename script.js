// 全局变量
let requestStartTime = 0;
let currentResponse = null;
const historyList = [];
const MAX_HISTORY = 10;

// 是否使用 Worker 代理（如果你保留了 _worker.js 就设为 true）
const USE_WORKER_PROXY = true;
const PROXY_PATH = '/proxy';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadHistoryFromStorage();
});

// 初始化事件监听
function initEventListeners() {
    document.getElementById('sendBtn').addEventListener('click', sendPostRequest);
    document.getElementById('clearBtn').addEventListener('click', clearResponse);
    document.getElementById('formatBtn').addEventListener('click', formatJSON);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    document.getElementById('jsonData').addEventListener('input', validateJSON);
}

// 发送 POST 请求
async function sendPostRequest() {
    const urlInput = document.getElementById('url');
    const jsonInput = document.getElementById('jsonData');
    const sendBtn = document.getElementById('sendBtn');
    const btnText = sendBtn.querySelector('.btn-text');
    const spinner = sendBtn.querySelector('.loading-spinner');
    
    // 验证并处理 URL
    let originalUrl = urlInput.value.trim();
    if (!originalUrl) {
        alert('请输入目标 URL');
        return;
    }
    
    // 自动添加协议
    if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
        originalUrl = 'https://' + originalUrl;
    }
    
    // 强制升级为 HTTPS（避免 Mixed Content）
    let finalUrl = originalUrl;
    if (originalUrl.startsWith('http://')) {
        finalUrl = originalUrl.replace('http://', 'https://');
        urlInput.value = finalUrl;
        console.warn('⚠️ 已将 HTTP 自动升级为 HTTPS，避免混合内容错误');
    }
    
    // 验证 JSON
    let jsonData;
    try {
        jsonData = JSON.parse(jsonInput.value);
    } catch (e) {
        document.getElementById('jsonError').textContent = '❌ JSON 格式错误: ' + e.message;
        return;
    }
    
    // 获取自定义请求头
    const customHeaders = {
        'Content-Type': 'application/json'
    };
    
    document.querySelectorAll('.header-row:not(:first-child)').forEach(row => {
        const key = row.querySelector('.header-key')?.value.trim();
        const value = row.querySelector('.header-value')?.value.trim();
        if (key && value) {
            customHeaders[key] = value;
        }
    });
    
    // UI 更新
    sendBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline';
    document.getElementById('jsonError').textContent = '';
    updateStatusBadge('pending', '请求中...');
    
    // 记录开始时间
    requestStartTime = performance.now();
    
    try {
        let response, requestUrl;
        
        if (USE_WORKER_PROXY) {
            // ========== 通过 Worker 代理发送请求 ==========
            requestUrl = PROXY_PATH;
            
            const proxyBody = {
                targetUrl: finalUrl,
                data: jsonData,
                headers: customHeaders
            };
            
            response = await fetch(PROXY_PATH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(proxyBody)
            });
            
        } else {
            // ========== 直接发送请求 ==========
            requestUrl = finalUrl;
            
            response = await fetch(finalUrl, {
                method: 'POST',
                headers: customHeaders,
                body: JSON.stringify(jsonData)
            });
        }
        
        const endTime = performance.now();
        const requestTime = (endTime - requestStartTime).toFixed(2);
        
        // 获取响应数据
        const responseText = await response.text();
        let responseData;
        let isJSON = false;
        
        try {
            responseData = JSON.parse(responseText);
            isJSON = true;
        } catch (e) {
            responseData = responseText;
        }
        
        // 计算响应大小
        const responseSize = new Blob([responseText]).size;
        
        // 显示响应
        displayResponse({
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: responseData,
            isJSON: isJSON,
            time: requestTime,
            size: formatBytes(responseSize)
        });
        
        // 保存到历史
        saveToHistory({
            url: finalUrl,
            method: 'POST',
            status: response.status,
            time: requestTime,
            timestamp: new Date().toLocaleString(),
            proxied: USE_WORKER_PROXY
        });
        
        // 更新状态
        updateStatusBadge(response.ok ? 'success' : 'error', 
                         `${response.status} ${response.statusText}`);
        
    } catch (error) {
        // 错误处理
        const endTime = performance.now();
        const requestTime = (endTime - requestStartTime).toFixed(2);
        
        let errorMessage = error.message;
        
        // 提供更友好的错误提示
        if (errorMessage.includes('Failed to fetch')) {
            if (!USE_WORKER_PROXY) {
                errorMessage = '请求失败：可能是 CORS 跨域问题。建议启用 Worker 代理（将 USE_WORKER_PROXY 设为 true）';
            } else {
                errorMessage = '代理请求失败：请检查 _worker.js 是否正确部署';
            }
        } else if (errorMessage.includes('NetworkError')) {
            errorMessage = '网络错误：无法连接到目标服务器';
        }
        
        displayError({
            message: errorMessage,
            time: requestTime
        });
        
        updateStatusBadge('error', '请求失败');
        
        // 保存错误历史
        saveToHistory({
            url: finalUrl,
            method: 'POST',
            status: 'Error',
            time: requestTime,
            timestamp: new Date().toLocaleString(),
            error: errorMessage,
            proxied: USE_WORKER_PROXY
        });
        
    } finally {
        // 恢复 UI
        sendBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// 显示响应数据
function displayResponse(data) {
    // 响应体
    const bodyTab = document.getElementById('responseBody');
    if (data.isJSON) {
        bodyTab.textContent = JSON.stringify(data.body, null, 2);
    } else {
        bodyTab.textContent = data.body;
    }
    
    // 响应头
    const headersTab = document.getElementById('responseHeaders');
    let headersText = '';
    data.headers.forEach((value, key) => {
        headersText += `${key}: ${value}\n`;
    });
    headersTab.textContent = headersText || '无响应头信息';
    
    // 耗时信息
    document.getElementById('requestTime').textContent = data.time + ' ms';
    document.getElementById('responseSize').textContent = data.size;
    document.getElementById('statusCode').textContent = data.status;
}

// 显示错误
function displayError(error) {
    document.getElementById('responseBody').textContent = `请求错误: ${error.message}`;
    document.getElementById('responseHeaders').textContent = '无响应头信息';
    document.getElementById('requestTime').textContent = error.time + ' ms';
    document.getElementById('responseSize').textContent = '-';
    document.getElementById('statusCode').textContent = 'Error';
}

// 更新状态标签
function updateStatusBadge(type, text) {
    const badge = document.getElementById('statusBadge');
    badge.textContent = text;
    badge.className = 'status-badge';
    
    switch(type) {
        case 'success':
            badge.classList.add('status-success');
            break;
        case 'error':
            badge.classList.add('status-error');
            break;
        case 'pending':
            badge.classList.add('status-pending');
            break;
    }
}

// 验证 JSON 格式
function validateJSON() {
    const jsonInput = document.getElementById('jsonData');
    const errorEl = document.getElementById('jsonError');
    
    try {
        JSON.parse(jsonInput.value);
        errorEl.textContent = '✅ JSON 格式正确';
        errorEl.style.color = '#27ae60';
    } catch (e) {
        errorEl.textContent = '❌ JSON 格式错误: ' + e.message;
        errorEl.style.color = '#e74c3c';
    }
}

// 格式化 JSON
function formatJSON() {
    const jsonInput = document.getElementById('jsonData');
    try {
        const parsed = JSON.parse(jsonInput.value);
        jsonInput.value = JSON.stringify(parsed, null, 2);
        validateJSON();
    } catch (e) {
        alert('JSON 格式错误，无法格式化');
    }
}

// 清空响应
function clearResponse() {
    document.getElementById('responseBody').textContent = '等待发送请求...';
    document.getElementById('responseHeaders').textContent = '';
    document.getElementById('requestTime').textContent = '-';
    document.getElementById('responseSize').textContent = '-';
    document.getElementById('statusCode').textContent = '-';
    updateStatusBadge('pending', '等待请求');
}

// 切换 Tab
function switchTab(e) {
    const tabName = e.target.dataset.tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// 添加自定义请求头行
function addHeaderRow() {
    const container = document.getElementById('customHeaders');
    const newRow = document.createElement('div');
    newRow.className = 'header-row';
    newRow.innerHTML = `
        <input type="text" placeholder="Header 名称" class="header-key">
        <input type="text" placeholder="Header 值" class="header-value">
        <button type="button" class="btn-icon" onclick="this.parentElement.remove()">➖</button>
    `;
    container.appendChild(newRow);
}

// 保存到历史记录
function saveToHistory(item) {
    historyList.unshift(item);
    if (historyList.length > MAX_HISTORY) {
        historyList.pop();
    }
    
    renderHistory();
    localStorage.setItem('postTestHistory', JSON.stringify(historyList));
}

// 渲染历史记录
function renderHistory() {
    const historyContainer = document.getElementById('historyList');
    
    if (historyList.length === 0) {
        historyContainer.innerHTML = '<p class="empty-history">暂无历史记录</p>';
        return;
    }
    
    let html = '';
    historyList.forEach((item, index) => {
        const statusClass = item.status >= 200 && item.status < 300 ? 'success' : 
                           (item.status === 'Error' ? 'error' : 'pending');
        
        const proxyBadge = item.proxied ? '🔀 代理' : '🌐 直连';
        
        html += `
            <div class="history-item" onclick="loadHistoryItem(${index})">
                <div class="history-url">${item.method} ${item.url}</div>
                <div class="history-meta">
                    <span class="history-status ${statusClass}">
                        ${item.status === 'Error' ? '❌ 错误' : '状态: ' + item.status}
                    </span>
                    <span>⏱️ ${item.time}ms</span>
                    <span>${proxyBadge}</span>
                    <span>🕐 ${item.timestamp}</span>
                </div>
            </div>
        `;
    });
    
    historyContainer.innerHTML = html;
}

// 加载历史记录项
function loadHistoryItem(index) {
    const item = historyList[index];
    if (!item) return;
    
    document.getElementById('url').value = item.url;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 从 localStorage 加载历史
function loadHistoryFromStorage() {
    const stored = localStorage.getItem('postTestHistory');
    if (stored) {
        try {
            const items = JSON.parse(stored);
            historyList.push(...items);
            renderHistory();
        } catch (e) {
            console.error('加载历史记录失败:', e);
        }
    }
}

// 格式化字节大小
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 导出函数到全局作用域
window.addHeaderRow = addHeaderRow;
window.loadHistoryItem = loadHistoryItem;
