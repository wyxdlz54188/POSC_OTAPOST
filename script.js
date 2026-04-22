// 全局变量
let requestStartTime = 0;
const historyList = [];
const MAX_HISTORY = 10;

// ========== 配置区 ==========
// 使用公共 CORS 代理（解决 HTTPS 页面请求 HTTP 接口的 Mixed Content 问题）
const USE_PUBLIC_PROXY = true;
const PROXY_URL = 'https://cors-anywhere.herokuapp.com/';
// ===========================

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
    const protocol = document.getElementById('protocol').value;
    const urlInput = document.getElementById('url');
    const jsonInput = document.getElementById('jsonData');
    const sendBtn = document.getElementById('sendBtn');
    const btnText = sendBtn.querySelector('.btn-text');
    const spinner = sendBtn.querySelector('.loading-spinner');
    
    // 构建完整 URL
    let hostPath = urlInput.value.trim();
    if (!hostPath) {
        alert('请输入目标地址');
        return;
    }
    
    // 移除用户可能误输入的协议前缀
    hostPath = hostPath.replace(/^https?:\/\//, '');
    
    const finalUrl = protocol + hostPath;
    urlInput.value = hostPath; // 保持输入框干净
    
    // 验证 JSON
    let jsonData;
    try {
        jsonData = JSON.parse(jsonInput.value);
    } catch (e) {
        document.getElementById('jsonError').textContent = '❌ JSON 格式错误: ' + e.message;
        return;
    }
    
    // 请求头
    const headers = {
        'Content-Type': 'application/json'
    };
    
    // UI 更新
    sendBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline';
    document.getElementById('jsonError').textContent = '';
    updateStatusBadge('pending', '请求中...');
    
    // 记录开始时间
    requestStartTime = performance.now();
    
    try {
        let response;
        let actualRequestUrl;
        
        if (USE_PUBLIC_PROXY) {
            // 通过公共 CORS 代理发送请求
            actualRequestUrl = PROXY_URL + encodeURIComponent(finalUrl);
            console.log('🔀 通过代理请求:', actualRequestUrl);
            
            response = await fetch(actualRequestUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(jsonData)
            });
        } else {
            // 直接发送请求（仅适用于 HTTPS 或同源）
            actualRequestUrl = finalUrl;
            console.log('🌐 直接请求:', actualRequestUrl);
            
            response = await fetch(finalUrl, {
                method: 'POST',
                headers: headers,
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
            proxied: USE_PUBLIC_PROXY
        });
        
        // 更新状态
        updateStatusBadge(response.ok ? 'success' : 'error', 
                         `${response.status} ${response.statusText}`);
        
    } catch (error) {
        // 错误处理
        const endTime = performance.now();
        const requestTime = (endTime - requestStartTime).toFixed(2);
        
        let errorMessage = error.message;
        
        if (errorMessage.includes('Failed to fetch')) {
            errorMessage = '请求失败：网络错误或 CORS 跨域问题';
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
            proxied: USE_PUBLIC_PROXY
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
    const bodyTab = document.getElementById('responseBody');
    if (data.isJSON) {
        bodyTab.textContent = JSON.stringify(data.body, null, 2);
    } else {
        bodyTab.textContent = data.body;
    }
    
    const headersTab = document.getElementById('responseHeaders');
    let headersText = '';
    data.headers.forEach((value, key) => {
        headersText += `${key}: ${value}\n`;
    });
    headersTab.textContent = headersText || '无响应头信息';
    
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
    
    // 解析 URL 恢复协议和主机
    try {
        const urlObj = new URL(item.url);
        document.getElementById('protocol').value = urlObj.protocol;
        document.getElementById('url').value = urlObj.host + urlObj.pathname;
    } catch (e) {
        // 如果解析失败，只填主机部分
        document.getElementById('url').value = item.url.replace(/^https?:\/\//, '');
    }
    
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
window.loadHistoryItem = loadHistoryItem;
