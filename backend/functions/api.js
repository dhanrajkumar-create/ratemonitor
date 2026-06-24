import serverless from 'serverless-http';
import app from '../server.js';

const baseHandler = serverless(app);

export const handler = async (event, context) => {
  // Netlify may strip "/api" from the path before invoking the function.
  // Express routes are mounted at /api/*, so we add it back when missing.
  if (event.path && !event.path.startsWith('/api')) {
    event.path = '/api' + (event.path.startsWith('/') ? event.path : '/' + event.path);
  }
  return baseHandler(event, context);
};
