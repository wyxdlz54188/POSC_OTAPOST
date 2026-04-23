// Cloudflare Worker - 透明转发版（绕过 WAF）
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理 /proxy 路径的请求
    if (url.pathname === '/proxy' && request.method === 'POST') {
      try {
        const { targetUrl, data } = await request.json();
        const targetUrlObj = new URL(targetUrl);

        // 1. 直接修改原始请求的目标 URL
        // 注意：不手动设置 Host 头，让 fetch 底层自动处理，避免触发代理特征检测
        const modifiedRequest = new Request(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            // 伪装成普通浏览器，而非 curl（部分防火墙会拦 curl UA）
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify(data)
        });

        // 2. 发起请求，不做任何重定向干预
        const response = await fetch(modifiedRequest);
        const responseText = await response.text();

        // 3. 返回结果并加上 CORS 头
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

    // 返回静态页面
    return env.ASSETS.fetch(request);
  }
};
