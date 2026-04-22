// Cloudflare Worker - 完整模拟版
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理 /proxy 路径的请求
    if (url.pathname === '/proxy' && request.method === 'POST') {
      try {
        const { targetUrl, data, headers } = await request.json();
        
        // 解析目标 URL
        const targetUrlObj = new URL(targetUrl);
        
        // 构建转发请求的头部，尽可能模拟原始请求
        const forwardHeaders = {
          'Content-Type': 'application/json',
          'Host': targetUrlObj.host,  // 关键：设置正确的 Host 头
          'Accept': '*/*',
          'User-Agent': 'PostTester/1.0',
          ...headers
        };
        
        // 删除可能干扰的头部
        delete forwardHeaders['origin'];
        delete forwardHeaders['referer'];
        
        console.log('转发到:', targetUrl);
        console.log('请求头:', JSON.stringify(forwardHeaders));
        
        // 发送请求
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: forwardHeaders,
          body: JSON.stringify(data),
          redirect: 'manual'
        });
        
        const responseText = await response.text();
        
        // 获取响应头
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        // 返回响应
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
