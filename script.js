// 全局变量
let requestStartTime = 0;
let currentResponse = null;
const historyList = [];
const MAX_HISTORY = 10;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadHistoryFromStorage();
});

// 初始化事件监听
function initEventListeners() {
    // 发送按钮
    document.getElementById('sendBtn').addEventListener('click', sendPostRequest);
    
    // 清空按钮
    document.getElementById('clearBtn').addEventListener('click', clearResponse);
    
    // 格式化 JSON 按钮
    document.getElementById('formatBtn').addEventListener('click', formatJSON);
    
    // Tab 切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    // JSON 输入框实时验证
    document.getElementById('jsonData').addEventListener('input', validateJSON);
}

// 发送 POST 请求
async function sendPostRequest() {
    const urlInput = document.getElementById('url');
    const jsonInput = document.getElementById('jsonData');
    const sendBtn = document.getElementById('sendBtn');
    const btnText = sendBtn.querySelector('.btn-text');
    const spinner = sendBtn.querySelector('.loading-spinner');
    
    // 验证 URL
    let url = urlInput.value.trim();
    if (!url) {
        alert('请输入目标 URL');
        return;
    }
    
    // 自动添加协议
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        urlInput.value = url;
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
    const headers = {
        'Content-Type': 'application/json'
    };
    
    document.querySelectorAll('.header-row:not(:first-child)').forEach(row => {
        const key = row.querySelector('.header-key')?.value.trim();
        const value = row.querySelector('.header-value')?.value.trim();
        if (key && value) {
            headers[key] = value;
        }
    });
    
    // UI 更新
    sendBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline';
    document.getElementById('jsonError').textContent = '';
    
    // 更新状态标签
    updateStatusBadge('pending', '请求中...');
    
    // 记录开始时间
    requestStartTime = performance.now();
    
    try {
        // 发送请求
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(jsonData)
        });
        
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
            url: url,
            method: 'POST',
            status: response.status,
            time: requestTime,
            timestamp: new Date().toLocaleString()
        });
        
        // 更新状态
        updateStatusBadge(response.ok ? 'success' : 'error', 
                         `${response.status} ${response.statusText}`);
        
    } catch (error) {
        // 错误处理
        const endTime = performance.now();
        const requestTime = (endTime - requestStartTime).toFixed(2);
        
        displayError({
            message: error.message,
            time: requestTime
        });
        
        updateStatusBadge('error', '请求失败');
        
        // 保存错误历史
        saveToHistory({
            url: url,
            method: 'POST',
            status: 'Error',
            time: requestTime,
            timestamp: new Date().toLocaleString(),
            error: error.message
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
    
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // 更新内容显示
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
    
    // 更新 UI
    renderHistory();
    
    // 保存到 localStorage
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
        
        html += `
            <div class="history-item" onclick="loadHistoryItem(${index})">
                <div class="history-url">${item.method} ${item.url}</div>
                <div class="history-meta">
                    <span class="history-status ${statusClass}">
                        ${item.status === 'Error' ? '❌ 错误' : '状态: ' + item.status}
                    </span>
                    <span>⏱️ ${item.time}ms</span>
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
    
    // 滚动到顶部
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

// 导出函数到全局作用域（供 HTML 调用）
window.addHeaderRow = addHeaderRow;
window.loadHistoryItem = loadHistoryItem;
