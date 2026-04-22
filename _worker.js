// Cloudflare Worker - HTTP 强制测试版
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理 /proxy 路径的请求
    if (url.pathname === '/proxy' && request.method === 'POST') {
      try {
        const { targetUrl, data, headers } = await request.json();
        
        // 强制将目标 URL 改为 HTTP（无论前端传的是什么）
        let httpUrl = targetUrl;
        if (httpUrl.startsWith('https://')) {
          httpUrl = httpUrl.replace('https://', 'http://');
        }
        
        console.log('实际请求地址:', httpUrl);
        
        // 发送 HTTP 请求，阻止自动重定向
        const response = await fetch(httpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify(data),
          redirect: 'manual'  // 不跟随重定向
        });
        
        const responseText = await response.text();
        
        // 获取响应头信息
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        // 返回完整信息（包括状态码和响应头）
        return new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Original-Status': response.status.toString(),
            'X-Redirect-Location': responseHeaders['location'] || ''
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error.message,
          stack: error.stack 
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
