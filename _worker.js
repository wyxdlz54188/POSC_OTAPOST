export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/proxy' && request.method === 'POST') {
      try {
        const { targetUrl, data } = await request.json();
        const targetUrlObj = new URL(targetUrl);
        
        const headers = {
          'Content-Type': 'application/json',
          'Host': targetUrlObj.host,
          'Accept': '*/*',
          'User-Agent': 'curl/8.5.0',
          'Connection': 'keep-alive'
        };
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(data)
        });
        
        const responseText = await response.text();
        
        return new Response(responseText, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }
    
    if (url.pathname === '/proxy' && request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    return env.ASSETS.fetch(request);
  }
};
