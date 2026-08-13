process.env.NODE_ENV = 'production';

const handlerPromise = Promise.all([
  import('../apps/api/src/app.js'),
  import('../apps/api/src/env.js'),
  import('../apps/api/src/serverless-handler.js'),
]).then(([{ buildApp }, { loadEnv }, { createServerlessHandler }]) =>
  createServerlessHandler(buildApp({ env: loadEnv() })),
);

export default {
  async fetch(request: Request): Promise<Response> {
    const [{ forwardedClientIp }, handler] = await Promise.all([
      import('../apps/api/src/serverless-handler.js'),
      handlerPromise,
    ]);
    return handler(request, { ip: forwardedClientIp(request) });
  },
};
