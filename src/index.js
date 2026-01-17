export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test') {
      try {
        console.log('Testing outbound HTTP call...');
        
        // Test basic HTTP call to external service
        const response = await fetch('https://httpbin.org/get', {
          headers: {
            'User-Agent': 'ralph-minimal-test'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Outbound HTTP works!',
          test: 'external-api-call',
          response: {
            status: response.status,
            url: data.url,
            userAgent: data.headers['User-Agent']
          },
          env: {
            hasContainerBinding: !!env.CONTAINER,
            containerType: typeof env.CONTAINER
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Test failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          test: 'external-api-call',
          env: {
            hasContainerBinding: !!env.CONTAINER,
            containerType: typeof env.CONTAINER
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        worker: true,
        env: {
          hasContainerBinding: !!env.CONTAINER,
          containerType: typeof env.CONTAINER
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
