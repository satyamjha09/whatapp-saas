# TallyKonnect WhatsApp SaaS

![CI](https://github.com/satyamjha09/whatapp-saas/actions/workflows/ci.yml/badge.svg)


## Local Development

Start Docker services:

```bash
docker compose up -d
```

Run Next.js:

```bash
npm run dev
```

Run message worker:

```bash
npm run worker:messages
```

Run webhook worker:

```bash
npm run worker:webhooks
```

Open:

```text
http://localhost:3000/dashboard
```

## Database

Run migrations:

```bash
npx prisma migrate dev
```

Open Prisma Studio:

```bash
npx prisma studio --port 5555
```

## Required Env Vars

Copy `.env.example` to `.env` and fill values.
