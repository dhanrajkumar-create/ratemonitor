import serverless from 'serverless-http';
import app from '../server.js';

const baseHandler = serverless(app);

export const handler = async (event, context) => {
  // Netlify strips the function name — event.path is the original request path (/api/...).
  // Express mounts routes at /api/*, so no rewriting needed; just pass through.
  // Guard: if path somehow arrives without /api prefix, add it.
  if (event.path && !event.path.startsWith('/api')) {
    event.path = '/api' + (event.path.startsWith('/') ? event.path : '/' + event.path);
  }
  return baseHandler(event, context);
};
