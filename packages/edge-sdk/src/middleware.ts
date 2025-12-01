import type { IntegrationsOptions } from '@segment/analytics-core';
import * as snippet from '@segment/snippet';
import { createMiddleware } from 'hono/factory';
import type { EdgeSDKOptions } from '.';

interface LoadOptions {
  integrations?: IntegrationsOptions;
  obfuscate?: boolean;
  storage?: {
    stores?: ('localStorage' | 'memory' | 'cookie')[];
  };
}

export const scriptInjectionMiddleware = (options: EdgeSDKOptions) =>
  createMiddleware(async (context, next) => {
    await next();

    const contentType = context.res.headers.get('content-type');

    if (!contentType?.includes('text/html')) {
      return;
    }

    let host = options.trackingHost;
    if (!host) {
      ({ host } = new URL(context.req.url));
    }

    const segmentSnippet = snippet.min({
      ajsPath: `/${options.routePrefix}/ajs`,
      apiKey: options.apiKey,
      host,
      load: {
        integrations: {
          'Segment.io': {
            apiHost: `${host}/${options.routePrefix}/v1`,
            metricsHost: `${host}/${options.routePrefix}/v1`,
          },
        },
        storage: {
          stores: ['localStorage', 'memory'],
        },
        ...options.loadOptions,
      } satisfies LoadOptions as unknown as snippet.LoadOptions,
      useHostForBundles: true,
      ...options.snippetOptions,
    });

    const scriptTag = `<script>${segmentSnippet}</script>`;

    let html = await context.res.text();

    const injectionPatterns = [
      { pattern: /<\/head>/i, replacement: `${scriptTag}</head>` },
      { pattern: /<body([^>]*)>/i, replacement: `${scriptTag}<body$1>` },
    ];

    for (const { pattern, replacement } of injectionPatterns) {
      if (pattern.test(html)) {
        html = html.replace(pattern, replacement);
        break;
      }
    }

    const headers = new Headers(context.res.headers);
    headers.delete('content-length');

    context.res = new Response(html, {
      headers,
      status: context.res.status,
      statusText: context.res.statusText,
    });
  });
