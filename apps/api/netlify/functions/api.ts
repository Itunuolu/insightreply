import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/env.js';
import { createNetlifyHandler } from '../../src/netlify-handler.js';

// Netlify Functions do not guarantee NODE_ENV, while the shared logger treats
// an unset value as local development and attempts to start pino-pretty.
process.env.NODE_ENV = 'production';

const appPromise = buildApp({ env: loadEnv() });

export default createNetlifyHandler(appPromise);

export const config = {
  path: ['/health', '/v1/comments/generate'],
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['ip'],
    windowSize: 60,
    windowLimit: 30,
  },
};
