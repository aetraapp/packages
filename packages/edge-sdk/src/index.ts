import type { ExecutionContext } from '@cloudflare/workers-types';
import type { PageOptions } from '@segment/snippet';
import { Hono } from 'hono';
import { deleteCookie, generateCookie, getCookie } from 'hono/cookie';
import { etag } from 'hono/etag';
import { scriptInjectionMiddleware } from './middleware';
import { getDomain } from './utils';

export type EdgeSDKOptions = {
  /**
   * The Segment write key to use for sending events to Segment
   * @required
   * */
  apiKey: string;
  /**
   * The Edge SDK will expose few routes to serve assets, collect data, etc.
   * This prefix will be used to prefix all the routes exposed by the Edge SDK.
   * @example "segment" will result in routes like "www.example.com/segment/ajs", "www.example.com/segment/v1/t" etc.
   * @required
   * */
  routePrefix?: string;
  /**
   * The host to use for tracking API requests
   * @default the host name of the request
   * */
  trackingHost?: string | null;
  /**
   * The options to use for the first-party ajs_anonymous_id cookie
   * @default {
   *   domain: the domain name of the request,
   *   httpOnly: true,
   *   maxAge: 365 * 24 * 60 * 60,
   *   path: '/',
   *   sameSite: 'Lax',
   *   secure: true,
   * }
   * */
  cookieOptions?: {
    domain?: string;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: 'Lax' | 'Strict' | 'None';
    secure?: boolean;
  };
  /**
   * The options to use for the Segment snippet
   * @default {
   *   obfuscate: false,
   *   page: true,
   * }
   * */
  snippetOptions?: {
    obfuscate?: boolean;
    page?: boolean | PageOptions;
  };
  /**
   * The options to use for the Segment load
   * @default {
   *   obfuscate: false,
   * }
   * */
  loadOptions?: {
    obfuscate?: boolean;
  };
};

export class EdgeSDK {
  private readonly options: EdgeSDKOptions;

  constructor(options: EdgeSDKOptions) {
    this.options = {
      routePrefix: 'segment', // Default route prefix
      ...options,
    };
  }

  middleware() {
    const app = new Hono();

    // Handle reset request to delete the ajs_anonymous_id cookie
    app.get(`/${this.options.routePrefix}/reset`, async (context) => {
      deleteCookie(context, 'ajs_anonymous_id');
      context.status(204);
      return context.body(null);
    });

    // Proxy Segment Analytics.js script
    app.get(`/${this.options.routePrefix}/ajs`, etag(), async (context) => {
      const apiKey = this.options.apiKey;
      const routePrefix = this.options.routePrefix;
      const anonymousId =
        getCookie(context, 'ajs_anonymous_id') || crypto.randomUUID();
      const response = await fetch(
        `https://cdn.segment.com/analytics.js/v1/${apiKey}/analytics.min.js`,
      );
      const cookieOptions = this.options.cookieOptions;
      const { hostname } = new URL(context.req.url);
      const domain = getDomain(hostname);

      const cookie = generateCookie('ajs_anonymous_id', anonymousId, {
        domain,
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'Lax',
        secure: true,
        ...cookieOptions,
      });

      let trackingHost = this.options.trackingHost;
      if (!trackingHost) {
        trackingHost = hostname;
      }

      // Modify analytics.js
      let html = await response.text();
      html = [
        // Ensure bundles are loaded with the route prefix
        `analytics._cdn = '${routePrefix}';`,
        // Update the localStorage anonymous ID from the cookie
        `analytics.setAnonymousId('${anonymousId}');`,
        // Handle reset request to delete the ajs_anonymous_id cookie
        `analytics.on('reset', () => fetch('https://${trackingHost}/${this.options.routePrefix}/reset', { credentials: 'include' }));`,
        // Inject the original analytics.js tracking code
        `${html}`,
      ].join('\n');

      const headers = new Headers(response.headers);
      // Remove origin ETag and Last-Modified headers and allow etag() middleware to generate new ones
      headers.delete('etag');
      headers.delete('last-modified');
      // Prevent intermediary caching but allow browser caching with revalidation
      headers.set('cache-control', 'private, no-cache');
      // Set the ajs_anonymous_id cookie
      headers.append('set-cookie', cookie);

      return new Response(html, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    });

    // Proxy Segment resouce bundles
    app.on(
      'GET',
      [
        `/${this.options.routePrefix}/v1/projects/*`,
        `/${this.options.routePrefix}/analytics-next/*`,
        `/${this.options.routePrefix}/next-integrations/*`,
      ],
      async (context) => {
        const { pathname } = new URL(context.req.url);
        return await fetch(
          `https://cdn.segment.com${pathname.replace(`/${this.options.routePrefix}`, '')}`,
        );
      },
    );

    // Proxy Segment tracking API
    app.post(`/${this.options.routePrefix}/v1/:method`, async (context) => {
      const { method } = context.req.param();
      const body = await context.req.json();
      const ip =
        context.req.header('CF-Connecting-IP') ??
        context.req.header('X-Forwarded-For');

      return await fetch(`https://api.segment.io/v1/${method}`, {
        body: JSON.stringify(body),
        headers: {
          ...(ip && { 'X-Forwarded-For': ip }),
        },
        method: 'POST',
      });
    });

    // Proxy all requests to origin
    app.all(
      '*',
      scriptInjectionMiddleware(this.options), // Inject Segment snippet into HTML responses
      async (context) => await fetch(context.req.raw),
    );

    return async (
      request: Request,
      env: unknown,
      context: ExecutionContext,
    ): Promise<Response> => await app.fetch(request, env, context);
  }
}
