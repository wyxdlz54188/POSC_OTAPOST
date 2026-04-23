let requestStartTime = 0;
const historyList = [];
const MAX_HISTORY = 20;

// 配置：使用 Worker 代理
const USE_WORKER_PROXY = true;
const PROXY_PATH = '/proxy';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('sendBtn').addEventListener('click', sendPostRequest);
    document.getElementById('clearBtn').addEventListener('click', clearResponse);
    document.getElementById('formatBtn').addEventListener('click', formatJSON);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    
    // Tab 切换
    document.querySelectorAll('.layui-tab-title li').forEach(li => {
        li.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            // 切换 tab 样式
            this.parentElement.querySelectorAll('li').forEach(l => l.classList.remove('layui-this'));
            this.classList.add('layui-this');
            // 切换内容区
            document.querySelectorAll('.layui-tab-item').forEach(item => item.classList.remove('layui-show'));
            document.getElementById(tabName + 'Tab').classList.add('layui-show');
        });
    });
    
    document.getElementById('jsonData').addEventListener('input', validateJSON);
    loadHistoryFromStorage();
    loadSavedInputs();
    validateJSON();
});

async function sendPostRequest() {
    const protocol = document.getElementById('protocol').value;
    const hostPath = document.getElementById('url').value.trim().replace(/^https?:\/\//, '');
    if (!hostPath) { alert('请输入目标地址'); return; }
    const finalUrl = protocol + hostPath;

    let jsonData;
    try { jsonData = JSON.parse(document.getElementById('jsonData').value); }
    catch (e) { document.getElementById('jsonError').textContent = '❌ JSON 格式错误: ' + e.message; return; }

    const sendBtn = document.getElementById('sendBtn');
    const btnText = sendBtn.querySelector('.btn-text');
    const spinner = sendBtn.querySelector('.loading-spinner');
    sendBtn.disabled = true; btnText.style.display = 'none'; spinner.style.display = 'inline';
    document.getElementById('jsonError').textContent = '';
    updateStatusBadge('pending', '请求中...');
    requestStartTime = performance.now();

    try {
        let response;
        if (USE_WORKER_PROXY) {
            response = await fetch(PROXY_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUrl: finalUrl, data: jsonData })
            });
        } else {
            response = await fetch(finalUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jsonData) });
        }
        
        const requestTime = (performance.now() - requestStartTime).toFixed(2);
        const responseText = await response.text();
        const responseSize = new Blob([responseText]).size;
        let responseData, isJSON = false;
        try { responseData = JSON.parse(responseText); isJSON = true; } catch (e) { responseData = responseText; }
        
        displayResponse({ status: response.status, headers: response.headers, body: responseData, isJSON, time: requestTime, size: formatBytes(responseSize) });
        updateStatusBadge(response.ok ? 'success' : 'error', `${response.status} ${response.statusText}`);
        saveToHistory({ url: finalUrl, method: 'POST', status: response.status, time: requestTime, timestamp: new Date().toLocaleString(), proxied: USE_WORKER_PROXY, jsonData: document.getElementById('jsonData').value });
        saveInputs();
    } catch (error) {
        const requestTime = (performance.now() - requestStartTime).toFixed(2);
        displayError({ message: '请求失败：' + error.message, time: requestTime });
        updateStatusBadge('error', '请求失败');
        saveToHistory({ url: finalUrl, method: 'POST', status: 'Error', time: requestTime, timestamp: new Date().toLocaleString(), error: error.message, proxied: USE_WORKER_PROXY, jsonData: document.getElementById('jsonData').value });
    } finally {
        sendBtn.disabled = false; btnText.style.display = 'inline'; spinner.style.display = 'none';
    }
}

// 以下辅助函数：displayResponse, displayError, updateStatusBadge, validateJSON, formatJSON, clearResponse,
// saveToHistory, renderHistory, loadHistoryItem, clearHistory, loadHistoryFromStorage, loadSavedInputs, saveInputs, formatBytes
// 保持与你之前最终可用版本完全一致，此处省略以突出重点结构，实际部署请全部保留！
// 【重要】请将上一轮完整版 script.js 中的所有函数粘贴在此处。
