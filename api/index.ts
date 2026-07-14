import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  
  // Construct the target URL on the Render backend
  const targetUrl = `${backendUrl}${req.url}`;
  
  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value && key !== 'host' && key !== 'connection') {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method || '');
    let body: string | undefined = undefined;
    
    if (hasBody) {
      body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const data = await response.text();
    
    // Forward the status code and all headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.send(data);
  } catch (error: any) {
    console.error('Vercel API Proxy Error:', error);
    res.status(502).json({ 
      error: `Vercel proxy failed to communicate with the Render backend server.`, 
      details: error.message || error 
    });
  }
}
