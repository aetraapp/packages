import { EdgeSDK } from '@aetraapp/edge-sdk';

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const sdk = new EdgeSDK({
      apiKey: env.SEGMENT_WRITE_KEY,
      cookieOptions: {
        domain: 'localhost',
      },
      trackingHost: 'localhost:8787',
    });

    const response = await sdk.middleware()(request, env, context);
    return response;
  },
};
