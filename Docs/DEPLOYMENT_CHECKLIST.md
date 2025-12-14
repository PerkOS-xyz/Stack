# PerkOS Stack Production Deployment Checklist

Quick reference guide to deploy your x402 payment facilitator to production with Supabase and Thirdweb.

## Pre-Deployment Checklist

### 1. Supabase Setup
- [ ] Create Supabase project at [app.supabase.com](https://app.supabase.com)
- [ ] Run all migration files from `StackApp/supabase/migrations/` in SQL Editor
- [ ] Copy Project URL and API keys
- [ ] Enable Row Level Security policies

**Required Tables** (15 tables total):
```
Core Tables:
- perkos_x402_transactions
- perkos_vouchers
- perkos_agents
- perkos_reviews
- perkos_network_stats

Sponsor Tables:
- perkos_sponsor_wallets
- perkos_sponsor_rules
- perkos_sponsor_spending

User Tables:
- perkos_user_profiles

Additional Tables:
- perkos_pending_payments
- perkos_service_providers
- perkos_service_categories
- perkos_service_tiers
- perkos_service_usage_logs
- perkos_provider_analytics
```

### 2. Thirdweb Setup
- [ ] Create Thirdweb account at [thirdweb.com](https://thirdweb.com)
- [ ] Create a project and get API credentials
- [ ] Set up Server Wallets for x402 payment processing
- [ ] Configure gas sponsorship rules (optional)
- [ ] Copy Client ID and Secret Key

### 3. Environment Variables
- [ ] Copy `.env.example` to `.env.local`
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` (Keep secret!)
- [ ] Set `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
- [ ] Set `THIRDWEB_SECRET_KEY` (Keep secret!)
- [ ] Configure network RPC URLs for all 16 networks
- [ ] Set `NEXT_PUBLIC_X402_PAYMENT_RECEIVER` address
- [ ] Set `ENABLE_EVENT_INDEXING=true`

### 4. Local Testing
- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Visit http://localhost:3402
- [ ] Check http://localhost:3402/api/dashboard/stats
- [ ] Verify event indexer logs in console
- [ ] Test /.well-known/agent-card.json
- [ ] Test /.well-known/erc-8004.json

### 5. Build Verification
```bash
npm run build
npm start
```
- [ ] Build completes without errors
- [ ] Production server starts successfully
- [ ] All pages load correctly
- [ ] API endpoints respond correctly

## Deployment Options

### Option A: Vercel (Recommended)

**Step 1**: Install Vercel CLI
```bash
npm install -g vercel
```

**Step 2**: Deploy
```bash
cd StackApp
vercel --prod
```

**Step 3**: Configure Environment Variables in Vercel Dashboard
- Go to your project Settings Environment Variables
- Add all variables from `.env.local`
- Redeploy after adding variables

**Step 4**: Configure Custom Domain (Optional)
- Go to Settings Domains
- Add `x402.yourdomain.com` or your domain
- Update DNS records as instructed

### Option B: Docker

**Step 1**: Create Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3402
CMD ["npm", "start"]
```

**Step 2**: Build and Run
```bash
docker build -t perkos-stack .
docker run -p 3402:3402 --env-file .env.local perkos-stack
```

### Option C: VPS (DigitalOcean, AWS EC2, etc.)

**Step 1**: Set up server
```bash
ssh user@your-server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
```

**Step 2**: Deploy code
```bash
git clone https://github.com/your-repo/PerkOS-Stack.git
cd PerkOS-Stack/StackApp
npm install
npm run build
```

**Step 3**: Set up PM2 for process management
```bash
npm install -g pm2
pm2 start npm --name "perkos-stack" -- start
pm2 startup
pm2 save
```

**Step 4**: Configure Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name x402.yourdomain.com;

    location / {
        proxy_pass http://localhost:3402;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Checklist

### Environment Variables
- [ ] Never commit `.env.local` to git
- [ ] Use different keys for production vs development
- [ ] Rotate API keys every 90 days
- [ ] Store secrets in secure vault (AWS Secrets Manager, Vercel Environment Variables)

### Supabase
- [ ] Enable Row Level Security on all tables
- [ ] Use `anon` key for client-side, `service_role` key server-side only
- [ ] Set up database backups
- [ ] Enable 2FA on Supabase account

### Thirdweb
- [ ] Keep Secret Key server-side only
- [ ] Configure sponsorship spending limits
- [ ] Set up domain whitelist for gas sponsorship
- [ ] Monitor wallet balances for sponsorship

### Application
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Configure CORS headers
- [ ] Add rate limiting to API endpoints
- [ ] Implement error monitoring (Sentry)
- [ ] Set up uptime monitoring

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Verify all pages load correctly
- [ ] Test x402 payment verify endpoint
- [ ] Test x402 payment settle endpoint
- [ ] Check event indexer is running
- [ ] Monitor for errors in logs
- [ ] Verify Thirdweb wallet connectivity

### First Week
- [ ] Set up monitoring alerts (Vercel, Supabase)
- [ ] Test with real transactions on testnet
- [ ] Verify transaction data appears in dashboard
- [ ] Check chart data populates correctly
- [ ] Set up daily statistics aggregation
- [ ] Configure gas sponsorship rules

### Ongoing
- [ ] Monitor database performance
- [ ] Review error logs weekly
- [ ] Update dependencies monthly
- [ ] Backup database regularly
- [ ] Scale resources as needed
- [ ] Monitor Thirdweb wallet balances

## Event Indexing Configuration

### Start Indexing from Latest Block (Recommended)
```env
EVENT_INDEXING_START_BLOCK=latest
EVENT_INDEXING_INTERVAL=12000
```

### Start Indexing from Specific Block
```env
EVENT_INDEXING_START_BLOCK=12345678
EVENT_INDEXING_INTERVAL=12000
```

### Disable Event Indexing (Testing Only)
```env
ENABLE_EVENT_INDEXING=false
```

## Supported Networks (16 Total)

### Mainnets
| Network | Chain ID | USDC Status |
|---------|----------|-------------|
| Avalanche C-Chain | 43114 | Active |
| Base | 8453 | Active |
| Celo | 42220 | Active |
| Arbitrum One | 42161 | Active |
| Optimism | 10 | Active |
| Polygon | 137 | Active |
| Ethereum | 1 | Active |
| BNB Smart Chain | 56 | Active |

### Testnets
| Network | Chain ID | USDC Status |
|---------|----------|-------------|
| Avalanche Fuji | 43113 | Active |
| Base Sepolia | 84532 | Active |
| Celo Alfajores | 44787 | Active |
| Arbitrum Sepolia | 421614 | Active |
| Optimism Sepolia | 11155420 | Active |
| Polygon Amoy | 80002 | Active |
| Sepolia | 11155111 | Active |
| BNB Testnet | 97 | Active |

## Scaling Considerations

### When to Upgrade Supabase

**Free Tier Limits**:
- 500 MB database storage
- 2 GB bandwidth per month
- 50,000 monthly active users

**Upgrade to Pro when**:
- Database size > 400 MB
- Traffic > 40,000 requests/day
- Need automatic backups
- Require read replicas

### Application Scaling

**Vercel**:
- Automatic scaling
- No configuration needed
- Upgrade plan if hitting function limits

**Docker/VPS**:
- Add load balancer (nginx)
- Deploy multiple instances
- Use Redis for caching
- Consider database connection pooling

## Troubleshooting Production Issues

### Issue: Dashboard shows no data

**Check**:
1. Supabase connection: `SELECT * FROM perkos_x402_transactions LIMIT 1;`
2. Event indexer logs: Should see "Starting indexer for..."
3. Network RPC URLs are correct

### Issue: Event indexer not capturing transactions

**Check**:
1. `ENABLE_EVENT_INDEXING=true` in environment
2. Token addresses are correct for each network
3. RPC endpoints are responding
4. Check server logs for indexer errors

### Issue: Thirdweb wallet not responding

**Check**:
1. `THIRDWEB_SECRET_KEY` is set correctly
2. Server wallet has sufficient balance for gas
3. Sponsorship rules allow the transaction
4. Check Thirdweb dashboard for errors

### Issue: High database CPU usage

**Solutions**:
1. Add indexes on frequently queried columns
2. Implement caching layer (Redis)
3. Optimize queries with EXPLAIN ANALYZE
4. Upgrade to Supabase Pro with more compute

### Issue: API endpoints timing out

**Solutions**:
1. Increase timeout limits in hosting config
2. Optimize database queries
3. Add caching for expensive operations
4. Consider background job processing

## Support Resources

### Official Documentation
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase Production Guide](https://supabase.com/docs/guides/platform/going-into-prod)
- [Thirdweb Documentation](https://portal.thirdweb.com/)
- [Vercel Deployment](https://vercel.com/docs/deployments/overview)

### Community
- Discord: [PerkOS Community](#)
- GitHub Issues: [Report bugs](https://github.com/perkos/PerkOS-Stack/issues)
- Email: support@perkos.io

---

**Quick Deploy Command** (Vercel):
```bash
cd StackApp && vercel --prod
```

**Health Check URL**:
```
https://your-domain.com/api/dashboard/stats
```

**Status**: Production-ready with Supabase and Thirdweb integration
