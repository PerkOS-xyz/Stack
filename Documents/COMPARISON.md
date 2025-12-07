# Server vs ServerApp Comparison

Two complete implementations of the x402 Avalanche Facilitator.

## Server (Hono)

**Stack**: Hono + Viem + Hardhat + TypeScript

### Pros
- ✅ Lightweight (~50KB server framework)
- ✅ Fast startup time
- ✅ Simple deployment (single server)
- ✅ Perfect for pure API services
- ✅ Lower resource usage

### Cons
- ❌ No built-in UI
- ❌ Manual routing setup
- ❌ No server-side rendering

### Best For
- API-only services
- Microservices
- Docker containers
- Lightweight deployments
- Pure backend facilitators

### Quick Start
```bash
cd Server
npm install
cp .env.example .env
npm run dev
```

---

## ServerApp (Next.js 15)

**Stack**: Next.js 15 App Router + Viem + Hardhat + TypeScript + Tailwind CSS

### Pros
- ✅ Built-in UI dashboard
- ✅ App Router (modern Next.js)
- ✅ Server-side rendering
- ✅ Easy Vercel deployment
- ✅ Tailwind CSS styling
- ✅ Better developer experience

### Cons
- ❌ Heavier framework
- ❌ More complex configuration
- ❌ Higher resource usage

### Best For
- Full-stack applications
- Public-facing facilitators
- Dashboard requirements
- Vercel deployments
- Developer-friendly setup

### Quick Start
```bash
cd ServerApp
npm install
cp .env.example .env
npm run dev
```

---

## Feature Parity

Both implementations have **identical functionality**:

| Feature | Server | ServerApp |
|---------|--------|-----------|
| Standard x402 API | ✅ | ✅ |
| Deferred Scheme | ✅ | ✅ |
| Well-Known Endpoints | ✅ | ✅ |
| Smart Contracts | ✅ | ✅ |
| TypeScript | ✅ | ✅ |
| Viem Integration | ✅ | ✅ |
| Hardhat Support | ✅ | ✅ |
| UI Dashboard | ❌ | ✅ |

---

## API Endpoints (Both)

### Standard x402
- POST `/api/v2/x402/verify`
- POST `/api/v2/x402/settle`
- GET `/api/v2/x402/supported`
- GET `/api/v2/x402/health`
- GET `/api/v2/x402/config`

### Deferred Scheme
- GET `/deferred/info` (Server) / `/api/deferred/info` (ServerApp)
- GET `/deferred/vouchers` (Server) / `/api/deferred/vouchers` (ServerApp)
- POST `/deferred/vouchers`
- POST `/deferred/settle-batch`
- GET `/deferred/escrow/balance`

### Well-Known
- GET `/.well-known/agent-card.json`
- GET `/.well-known/x402-payment.json`
- GET `/.well-known/erc-8004.json`

---

## Deployment

### Server (Hono)

**Docker:**
```bash
docker build -t x402-facilitator .
docker run -p 3402:3402 --env-file .env x402-facilitator
```

**PM2:**
```bash
npm run build
pm2 start dist/index.js --name x402-facilitator
```

### ServerApp (Next.js)

**Vercel (Recommended):**
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

**Docker:**
```bash
docker build -t x402-facilitator-next .
docker run -p 3402:3402 --env-file .env x402-facilitator-next
```

---

## Recommendation

- **Use Server** if you need a lightweight, API-only service
- **Use ServerApp** if you want a full-stack app with UI dashboard

Both are production-ready and fully standards-compliant!
