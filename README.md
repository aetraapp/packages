# Aetra Packages

A monorepo containing packages for building analytics infrastructure on Cloudflare's edge network.

## 📦 Packages

### [@aetraapp/edge-sdk](./packages/edge-sdk)

A Cloudflare Worker middleware that proxies Segment.io analytics to bypass ad blockers and Safari's Intelligent Tracking Prevention (ITP) restrictions. Inspired by Segment's now-deprecated edge-sdk.

**Key Features:**
- 🚫 Bypasses ad blockers by proxying Segment requests through your domain
- 🍪 Sets first-party `ajs_anonymous_id` cookies server-side to circumvent ITP
- ⚡ Runs on Cloudflare's edge network for minimal latency
- 🔧 Easy integration with Hono-based Workers
- 📊 Maintains full Segment.io compatibility

## 🏗️ Monorepo Structure

```
aetra-packages/
├── apps/
│   └── worker-example/        # Example Cloudflare Worker implementation
├── packages/
│   └── edge-sdk/              # @aetraapp/edge-sdk package
├── package.json               # Root package.json with workspace scripts
├── pnpm-workspace.yaml        # PNPM workspace configuration
└── turbo.json                 # Turborepo configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- [pnpm](https://pnpm.io/) 10.23.0 or later
- A Cloudflare account with a site using orange-to-orange proxy

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/aetra-packages.git
cd aetra-packages
```

2. Install dependencies:
```bash
pnpm install
```

3. Build all packages:
```bash
pnpm build
```

## 🛠️ Development

### Available Scripts

- `pnpm dev` - Start development mode for all packages
- `pnpm build` - Build all packages
- `pnpm lint` - Run Biome linter on all files
- `pnpm lint:fix` - Fix linting issues automatically
- `pnpm lint:fix:unsafe` - Fix linting issues including unsafe fixes

### Working on the Edge SDK

```bash
# Watch mode for the edge-sdk package
cd packages/edge-sdk
pnpm dev
```

### Testing with the Example Worker

```bash
# Run the example worker locally
cd apps/worker-example
pnpm dev
```

The example worker will be available at `https://localhost:8787` (note: HTTPS is required for cookie testing).

## 📚 Documentation

- [Edge SDK Documentation](./packages/edge-sdk/README.md) - Complete guide for the edge-sdk package
- [Worker Example](./apps/worker-example/src/index.ts) - Reference implementation

## 🔧 Technology Stack

- **Package Manager:** [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- **Build System:** [Turborepo](https://turbo.build/repo) - High-performance build system
- **Linting:** [Biome](https://biomejs.dev/) - Fast formatter and linter
- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- **Framework:** [Hono](https://hono.dev/) - Ultrafast web framework for the Edge

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Create a new branch for your feature/fix
2. Make your changes
3. Run `pnpm lint:fix` to ensure code quality
4. Test your changes with the example worker
5. Submit a pull request

### Code Quality

This project uses:
- **Biome** for linting and formatting
- **Lefthook** for Git hooks
- **TypeScript** for type safety

## 📝 License

ISC

## 🙏 Acknowledgments

This project is inspired by [Segment's edge-sdk](https://github.com/segmentio/analytics-next/tree/master/packages/edge-sdk), which was deprecated and moved to their GitHub boneyard. Aetra's edge-sdk aims to provide a modern, maintained alternative for Cloudflare Workers.

## 📞 Support

For issues, questions, or contributions, please open an issue on the GitHub repository.
