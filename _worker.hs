// Cloudflare Worker - 用于处理跨域请求
export default {
  async fetch(request, env, ctx) {
    // 如果是静态资源，直接返回（Pages 会自动处理）
    // 如果需要代理功能，可以在这里添加路由逻辑
    
    const url = new URL(request.url);
    
    // 示例：处理 /proxy 路径的请求
    if (url.pathname === '/proxy' && request.method === 'POST') {
      try {
        const { targetUrl, data, headers } = await request.json();
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify(data)
        });
        
        const responseData = await response.text();
        
        return new Response(responseData, {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 默认返回静态页面（Pages 会自动处理）
    return env.ASSETS.fetch(request);
  }
};
