# @aetraapp/edge-sdk

A Cloudflare Worker middleware for proxying Segment.io analytics to bypass ad blockers and Safari's Intelligent Tracking Prevention (ITP) restrictions.

## 🎯 Overview

The Aetra Edge SDK is a drop-in solution for websites using Segment.io that want to:

- **Bypass ad blockers** by serving Segment's analytics.js and API endpoints from your own domain
- **Circumvent Safari's ITP** by setting the `ajs_anonymous_id` cookie server-side as a first-party cookie
- **Maintain full Segment compatibility** while improving tracking reliability
- **Run at the edge** with minimal latency using Cloudflare Workers

This package is inspired by [Segment's now-deprecated edge-sdk](https://github.com/segmentio/analytics-next/tree/master/packages/edge-sdk), reimagined for modern Cloudflare Workers infrastructure.

## 📋 Requirements

- **Cloudflare Account:** Your site must be proxied through Cloudflare (orange cloud enabled)
- **Segment Account:** You'll need a Segment write key
- **Hono Framework:** This package is built as middleware for Hono v4+

## 📦 Installation

```bash
npm install @aetraapp/edge-sdk hono
# or
yarn add @aetraapp/edge-sdk hono
# or
pnpm add @aetraapp/edge-sdk hono
```

## 🚀 Quick Start

### Basic Setup

Create a Cloudflare Worker with the Edge SDK:

```typescript
import { EdgeSDK } from '@aetraapp/edge-sdk';

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const sdk = new EdgeSDK({
      apiKey: env.SEGMENT_WRITE_KEY, // Your Segment write key
    });

    return await sdk.middleware()(request, env, context);
  },
};
```

### Configure Wrangler

Update your `wrangler.jsonc` to route traffic through your worker:

```jsonc
{
  "name": "my-segment-proxy",
  "main": "src/index.ts",
  "compatibility_date": "2025-11-25",
  "routes": [
    {
      "pattern": "www.example.com/*",
      "zone_name": "example.com"
    }
  ]
}
```

### Set Environment Variables

Add your Segment write key as a secret:

```bash
wrangler secret put SEGMENT_WRITE_KEY
```

Or use a `.dev.vars` file for local development:

```
SEGMENT_WRITE_KEY=your_segment_write_key_here
```

## ⚙️ Configuration

### EdgeSDKOptions

```typescript
type EdgeSDKOptions = {
  /**
   * Your Segment write key (required)
   */
  apiKey: string;

  /**
   * Route prefix for Edge SDK endpoints
   * @default "segment"
   * @example "analytics" → www.example.com/analytics/ajs
   */
  routePrefix?: string;

  /**
   * Host to use for tracking API requests
   * @default The current request hostname
   */
  trackingHost?: string | null;

  /**
   * Options for the first-party ajs_anonymous_id cookie
   */
  cookieOptions?: {
    domain?: string;        // Default: extracted from request hostname
    httpOnly?: boolean;     // Default: true
    maxAge?: number;        // Default: 365 days (in seconds)
    path?: string;          // Default: '/'
    sameSite?: 'Lax' | 'Strict' | 'None';  // Default: 'Lax'
    secure?: boolean;       // Default: true
  };

  /**
   * Options for the Segment snippet injection
   */
  snippetOptions?: {
    obfuscate?: boolean;    // Default: false
    page?: boolean | PageOptions;  // Default: true
  };

  /**
   * Options for Segment load configuration
   */
  loadOptions?: {
    obfuscate?: boolean;    // Default: false
  };
};
```

### Advanced Configuration Example

```typescript
import { EdgeSDK } from '@aetraapp/edge-sdk';

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const sdk = new EdgeSDK({
      apiKey: env.SEGMENT_WRITE_KEY,
      routePrefix: 'analytics',  // Use /analytics/* instead of /segment/*
      trackingHost: 'analytics.example.com',  // Custom tracking subdomain
      cookieOptions: {
        domain: 'example.com',  // Cookie valid for all subdomains
        maxAge: 180 * 24 * 60 * 60,  // 180 days
        sameSite: 'Strict',  // Stricter cookie policy
      },
      snippetOptions: {
        page: true,  // Automatically track page views
      },
    });

    return await sdk.middleware()(request, env, context);
  },
};
```

## 🔌 How It Works

The Edge SDK creates several proxy endpoints and middleware:

### 1. Cookie Middleware

Automatically sets a first-party `ajs_anonymous_id` cookie on all HTML responses. This bypasses Safari's ITP restrictions by making it a server-side, first-party cookie.

### 2. Script Injection Middleware

Injects the Segment analytics snippet into HTML responses, configured to use your proxied endpoints. The script is injected before the `</head>` tag or at the beginning of `<body>` if no `</head>` is found.

### 3. Proxied Endpoints

The Edge SDK creates the following routes (assuming default `routePrefix: 'segment'`):

| Route | Purpose |
|-------|---------|
| `/segment/ajs` | Proxies `analytics.min.js` from Segment CDN |
| `/segment/v1/:method` | Proxies Segment tracking API (track, page, identify, etc.) |
| `/segment/v1/projects/*` | Proxies Segment project bundles |
| `/segment/analytics-next/*` | Proxies Analytics.js Next bundles |
| `/segment/next-integrations/*` | Proxies integration bundles |
| `/segment/reset` | Deletes the `ajs_anonymous_id` cookie |

### 4. Analytics.js Modifications

The proxied `analytics.min.js` is modified to:
- Set the CDN path to use your route prefix
- Sync the anonymous ID from the server-side cookie
- Configure API endpoints to use your domain
- Handle reset events to clear the cookie

## 🌐 URL Structure

With the default configuration, your Segment implementation will use:

```
https://www.example.com/segment/ajs          → Analytics.js script
https://www.example.com/segment/v1/track     → Track events
https://www.example.com/segment/v1/page      → Page events
https://www.example.com/segment/v1/identify  → Identify users
https://www.example.com/segment/reset        → Reset anonymous ID
```

All requests appear to come from your own domain, bypassing ad blockers that target `cdn.segment.com` and `api.segment.io`.

## 🍪 Cookie Management

The Edge SDK sets the `ajs_anonymous_id` cookie with these default properties:

```javascript
{
  domain: 'example.com',  // Automatically extracted from hostname
  httpOnly: true,         // Not accessible via JavaScript
  maxAge: 31536000,       // 365 days in seconds
  path: '/',              // Available on all paths
  sameSite: 'Lax',        // Balanced security/functionality
  secure: true            // HTTPS only
}
```

### Cookie Domain Resolution

The SDK automatically extracts the root domain from the request hostname using the `tldts` library:

```
www.example.com → example.com
app.staging.example.com → example.com
localhost → localhost
```

This ensures the cookie is accessible across all subdomains of your site.

## 🔍 IP Forwarding

The Edge SDK preserves the visitor's IP address when proxying to Segment's API by forwarding the `CF-Connecting-IP` or `X-Forwarded-For` header. This ensures accurate geolocation data in your Segment events.

## 🧪 Local Development

### Using Wrangler

```bash
# Install dependencies
pnpm install

# Start local development server with HTTPS
pnpm dev

# The worker will be available at https://localhost:8787
```

### Testing with Real Traffic

To test with a real website:

1. Set up a test domain in Cloudflare
2. Deploy your worker with `wrangler deploy`
3. Configure your route pattern in `wrangler.jsonc`
4. Visit your site and check the Network tab for proxied Segment requests

### Debugging

Enable verbose logging in your worker:

```typescript
const sdk = new EdgeSDK({
  apiKey: env.SEGMENT_WRITE_KEY,
});

// Log all requests
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
  console.log(`Response: ${c.res.status}`);
});
```

## 📊 Performance

The Edge SDK is designed for minimal overhead:

- **Sub-millisecond** request proxying at Cloudflare's edge
- **Zero bundle size** for your application (runs as a Worker)
- **CDN caching** for static assets like analytics.js
- **Automatic revalidation** to keep scripts up-to-date

## 🔒 Security Considerations

### HTTPS Required

The Edge SDK sets cookies with the `secure` flag by default, requiring HTTPS. This is enforced in production but may require configuration for local development.

### Cookie Security

- **HttpOnly:** Prevents JavaScript access to the anonymous ID cookie
- **SameSite:** Provides CSRF protection
- **Secure:** Ensures cookies are only sent over HTTPS

### Rate Limiting

Consider adding rate limiting to your worker to prevent abuse:

```typescript
import { Hono } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';

const app = new Hono();
app.use('*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
}));
```

## 🐛 Troubleshooting

### Cookie Not Being Set

**Problem:** The `ajs_anonymous_id` cookie is not appearing in the browser.

**Solutions:**
- Ensure your response is HTML (`Content-Type: text/html`)
- Verify your worker is configured to proxy your domain
- Check that cookies are enabled in the browser
- Confirm the `secure` flag matches your environment (HTTPS required in production)

### Segment Events Not Tracking

**Problem:** Events are not appearing in Segment.

**Solutions:**
- Verify your Segment write key is correct
- Check the Network tab for failed requests to `/segment/v1/*`
- Ensure the `routePrefix` matches in your configuration
- Verify IP forwarding headers are present

### Script Not Injecting

**Problem:** The Segment snippet is not being injected into HTML.

**Solutions:**
- Confirm your response has `Content-Type: text/html`
- Check that your HTML has a `</head>` or `<body>` tag
- Verify the middleware order (script injection should run after your app logic)
- Look for errors in the worker logs

### Analytics.js 404 Errors

**Problem:** Browser shows 404 for `/segment/ajs`.

**Solutions:**
- Confirm your worker is deployed and routing correctly
- Check that `routePrefix` matches in your worker and Segment snippet
- Verify Cloudflare's proxy is enabled (orange cloud)

## 🔄 Migration from Segment's Edge SDK

If you're migrating from Segment's deprecated edge-sdk:

1. **Install Aetra Edge SDK:**
   ```bash
   npm install @aetraapp/edge-sdk
   ```

2. **Update imports:**
   ```typescript
   // Old
   import { EdgeSDK } from '@segment/analytics-edge-sdk';
   
   // New
   import { EdgeSDK } from '@aetraapp/edge-sdk';
   ```

3. **Update configuration:**
   The API is largely compatible, but review the `EdgeSDKOptions` type for any differences.

4. **Update Cloudflare Worker:**
   Ensure you're using modern Cloudflare Workers syntax with Hono.

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Documentation](https://hono.dev/)
- [Segment Documentation](https://segment.com/docs/)
- [Safari ITP Guide](https://webkit.org/tracking-prevention/)

## 🤝 Contributing

Contributions are welcome! Please see the main [repository README](../../README.md) for contribution guidelines.

## 📄 License

ISC

## 🙏 Acknowledgments

This project is inspired by [Segment's edge-sdk](https://github.com/segmentio/analytics-next/tree/master/packages/edge-sdk), which pioneered edge-based analytics proxying but has since been deprecated. Aetra's Edge SDK continues this vision with modern tooling and maintained support.

## ⚠️ Disclaimer

This is an independent project and is not officially affiliated with or endorsed by Segment.io or Cloudflare. Segment is a registered trademark of Segment.io, Inc.
