export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理 /proxy 路径的请求
    if (url.pathname === '/proxy' && request.method === 'POST') {
      try {
        const { targetUrl, data } = await request.json();
        
        // 构建请求头，伪装成普通 Chrome 浏览器
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        
        const modifiedRequest = new Request(targetUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(data)
        });
        
        const response = await fetch(modifiedRequest);
        const responseText = await response.text();
        
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
        return new Response(JSON.stringify({ error: error.message }), {
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
    
    // 返回静态页面
    return env.ASSETS.fetch(request);
  }
};
