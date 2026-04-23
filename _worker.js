export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理 /proxy 路径的请求
    if (url.pathname === '/proxy' && request.method === 'POST') {
      try {
        const { targetUrl, data } = await request.json();
        
        // 解析目标 URL
        const targetUrlObj = new URL(targetUrl);
        
        // 关键：模拟 curl 的请求头，避免被识别为代理
        const headers = {
          'Content-Type': 'application/json',
          'Host': targetUrlObj.host,
          'Accept': '*/*',
          'User-Agent': 'curl/8.5.0',  // 伪装成 curl
          'Connection': 'keep-alive'
        };
        
        // 发送请求（直接请求，不走任何代理）
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(data)
        });
        
        const responseText = await response.text();
        
        // 返回响应，添加 CORS 头让浏览器能读取
        return new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': '*'
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error.message 
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // 处理 OPTIONS 预检请求
    if (url.pathname === '/proxy' && request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // 默认返回静态页面
    return env.ASSETS.fetch(request);
  }
};
