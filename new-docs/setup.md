# Configuration & Setup Documentation

## 🚀 Overview

This guide provides comprehensive setup instructions for deploying the Medical Question Platform with admin validation and import features. It covers environment configuration, database setup, deployment options, and production considerations.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher (or yarn/pnpm equivalent)
- **PostgreSQL**: 14.0 or higher
- **Memory**: Minimum 4GB RAM (8GB recommended for production)
- **Storage**: Minimum 10GB free space

### Required Services
- **Database**: PostgreSQL with connection pooling
- **File Storage**: Local filesystem or cloud storage (AWS S3, Google Cloud)
- **Email Service**: SMTP server for notifications (optional)
- **AI Service**: Azure OpenAI API access (optional for AI features)

## 🔧 Environment Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/medq_database"
DIRECT_URL="postgresql://username:password@localhost:5432/medq_database"

# NextAuth.js Configuration
NEXTAUTH_SECRET="your-secret-key-here-minimum-32-characters"
NEXTAUTH_URL="http://localhost:3000"

# Azure OpenAI Configuration (Optional)
AZURE_OPENAI_API_KEY="your-azure-openai-api-key"
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
AZURE_OPENAI_API_VERSION="2024-02-15-preview"
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4"

# File Upload Configuration
MAX_FILE_SIZE=52428800  # 50MB in bytes
UPLOAD_DIR="./uploads"
ALLOWED_FILE_TYPES=".xlsx,.xls,.csv"

# Email Configuration (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@medq.com"

# Application Configuration
NODE_ENV="development"
APP_URL="http://localhost:3000"
APP_NAME="Medical Question Platform"

# Security Configuration
SESSION_MAX_AGE=86400  # 24 hours in seconds
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000  # 15 minutes in milliseconds

# Logging Configuration
LOG_LEVEL="info"
LOG_FILE="./logs/app.log"

# Background Job Configuration
JOB_CONCURRENCY=3
JOB_BATCH_SIZE=50
JOB_TIMEOUT=300000  # 5 minutes in milliseconds
JOB_RETRY_ATTEMPTS=3

# Monitoring Configuration (Optional)
SENTRY_DSN="your-sentry-dsn"
ANALYTICS_ID="your-analytics-id"
```

### Environment-Specific Configuration

#### Development Environment (`.env.local`)
```env
NODE_ENV="development"
DATABASE_URL="postgresql://dev_user:dev_pass@localhost:5432/medq_dev"
NEXTAUTH_URL="http://localhost:3000"
LOG_LEVEL="debug"
```

#### Production Environment (`.env.production`)
```env
NODE_ENV="production"
DATABASE_URL="postgresql://prod_user:secure_pass@prod-db:5432/medq_prod"
NEXTAUTH_URL="https://medq.your-domain.com"
LOG_LEVEL="warn"
```

#### Testing Environment (`.env.test`)
```env
NODE_ENV="test"
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/medq_test"
NEXTAUTH_URL="http://localhost:3001"
```

## 🗄️ Database Setup

### PostgreSQL Installation

#### Ubuntu/Debian
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database user
sudo -u postgres createuser --createdb --pwprompt medq_user

# Create database
sudo -u postgres createdb medq_database --owner=medq_user
```

#### macOS (with Homebrew)
```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Create database and user
createdb medq_database
psql medq_database -c "CREATE USER medq_user WITH PASSWORD 'your_password';"
psql medq_database -c "GRANT ALL PRIVILEGES ON DATABASE medq_database TO medq_user;"
```

#### Windows
```powershell
# Download and install PostgreSQL from postgresql.org
# Use pgAdmin or command line to create database:

# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE medq_database;
CREATE USER medq_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE medq_database TO medq_user;
```

### Database Configuration

#### postgresql.conf (Production Settings)
```ini
# Connection settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Write-ahead logging
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9

# Performance
random_page_cost = 1.1  # For SSD storage
effective_io_concurrency = 200
default_statistics_target = 100

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_duration = on
log_min_duration_statement = 1000  # Log slow queries (1 second)

# Monitoring
shared_preload_libraries = 'pg_stat_statements'
track_activities = on
track_counts = on
track_io_timing = on
```

#### Connection Pooling with PgBouncer
```ini
# pgbouncer.ini
[databases]
medq_database = host=localhost port=5432 dbname=medq_database

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
admin_users = postgres
pool_mode = transaction
default_pool_size = 25
max_client_conn = 100
```

### Prisma Setup

#### Install Dependencies
```bash
npm install prisma @prisma/client
npm install -D prisma
```

#### Initialize Prisma
```bash
# Initialize Prisma
npx prisma init

# Generate Prisma client
npx prisma generate

# Run initial migration
npx prisma migrate dev --name init

# Seed the database (optional)
npx prisma db seed
```

#### Database Migration Script
```bash
#!/bin/bash
# migrate.sh - Database migration script

set -e

echo "🔄 Starting database migration..."

# Backup database (production only)
if [ "$NODE_ENV" = "production" ]; then
    echo "📦 Creating database backup..."
    pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
fi

# Run migrations
echo "🏃‍♂️ Running Prisma migrations..."
npx prisma migrate deploy

# Generate client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Update database statistics
echo "📊 Updating database statistics..."
psql $DATABASE_URL -c "ANALYZE;"

echo "✅ Database migration completed successfully!"
```

## 📦 Application Installation

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/medq-platform.git
cd medq-platform

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Setup database
npx prisma migrate dev
npx prisma generate

# Seed initial data (optional)
npx prisma db seed

# Start development server
npm run dev
```

### Production Installation

```bash
# Production deployment script
#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup application
git clone https://github.com/your-org/medq-platform.git /var/www/medq
cd /var/www/medq

# Install dependencies
npm ci --only=production

# Setup environment
cp .env.production .env.local
# Configure production environment variables

# Build application
npm run build

# Setup database
npx prisma migrate deploy
npx prisma generate

# Setup systemd service
sudo cp deploy/medq.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable medq
sudo systemctl start medq

# Setup Nginx reverse proxy
sudo cp deploy/nginx.conf /etc/nginx/sites-available/medq
sudo ln -s /etc/nginx/sites-available/medq /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Production deployment completed!"
```

### Systemd Service Configuration

Create `/etc/systemd/system/medq.service`:

```ini
[Unit]
Description=Medical Question Platform
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/medq
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=medq

# Resource limits
LimitNOFILE=65536
MemoryMax=2G

[Install]
WantedBy=multi-user.target
```

### Nginx Configuration

Create `/etc/nginx/sites-available/medq`:

```nginx
server {
    listen 80;
    server_name medq.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name medq.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/medq.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/medq.your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # File upload limits
    client_max_body_size 50M;
    client_body_timeout 60s;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Static files
    location /_next/static/ {
        alias /var/www/medq/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /favicon.ico {
        alias /var/www/medq/public/favicon.ico;
        expires 1y;
    }

    # Proxy to Next.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://localhost:3000;
        # ... same proxy settings as above
    }
}

# Rate limiting configuration
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
}
```

## 🐳 Docker Setup

### Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set permissions
USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://medq_user:password@db:5432/medq_database
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=medq_database
      - POSTGRES_USER=medq_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## 🔒 Security Configuration

### Authentication Setup

#### NextAuth.js Configuration

```typescript
// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import bcrypt from 'bcrypt';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400'),
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  }
};
```

### CORS Configuration

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // CORS headers
  const response = NextResponse.next();
  
  response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { LRUCache } from 'lru-cache';

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  });

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount);
        }
        tokenCount[0] += 1;

        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage >= limit;

        if (isRateLimited) {
          reject(new Error('Rate limit exceeded'));
        } else {
          resolve();
        }
      }),
  };
}

// Usage in API routes
const limiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 500, // Limit to 500 unique tokens per interval
});

export async function POST(request: Request) {
  try {
    await limiter.check(10, getIP(request)); // 10 requests per 15 minutes
    // Process request
  } catch {
    return new Response('Rate limit exceeded', { status: 429 });
  }
}
```

## 📊 Monitoring & Logging

### Application Monitoring

```typescript
// lib/monitoring.ts
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'medq-platform' },
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.simple()
  }));
}

export default logger;
```

### Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check disk space
    const stats = await import('fs').then(fs => fs.promises.stat('./'));
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: memoryUsage,
      database: 'connected',
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
```

## 🚀 Deployment Strategies

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel --prod

# Configure environment variables in Vercel dashboard
# Set up PostgreSQL database (recommend Neon or PlanetScale)
```

### Railway Deployment

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "medq-app"
build.nixpacksConfigPath = "nixpacks.toml"

[[services]]
name = "postgres"
image = "postgres:14"
variables = { POSTGRES_DB = "medq", POSTGRES_USER = "postgres" }
```

### AWS Deployment with CDK

```typescript
// infrastructure/app-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';

export class MedQStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'MedQVpc', {
      maxAzs: 2,
    });

    // RDS PostgreSQL
    const database = new rds.DatabaseInstance(this, 'MedQDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      databaseName: 'medq',
      multiAz: false,
      allocatedStorage: 20,
      deleteAutomatedBackups: false,
      backupRetention: cdk.Duration.days(7),
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'MedQCluster', {
      vpc,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'MedQTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
    });

    // Add container
    taskDefinition.addContainer('medq-app', {
      image: ecs.ContainerImage.fromRegistry('your-registry/medq:latest'),
      environment: {
        NODE_ENV: 'production',
        DATABASE_URL: database.instanceEndpoint.socketAddress,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'medq',
      }),
    });
  }
}
```

## 🔧 Maintenance & Updates

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Automated backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="medq_database"

# Database backup
echo "Creating database backup..."
pg_dump $DATABASE_URL > "$BACKUP_DIR/db_backup_$DATE.sql"

# File uploads backup
echo "Creating uploads backup..."
tar -czf "$BACKUP_DIR/uploads_backup_$DATE.tar.gz" ./uploads

# Application backup
echo "Creating application backup..."
tar --exclude-vcs --exclude node_modules -czf "$BACKUP_DIR/app_backup_$DATE.tar.gz" .

# Upload to cloud storage (optional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    aws s3 sync $BACKUP_DIR s3://$AWS_S3_BUCKET/backups/
fi

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*backup_*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed successfully!"
```

### Update Procedure

```bash
#!/bin/bash
# update.sh - Application update script

set -e

echo "🔄 Starting application update..."

# Create backup before update
./scripts/backup.sh

# Pull latest changes
git fetch origin
git checkout main
git pull origin main

# Install dependencies
npm ci --only=production

# Run database migrations
npx prisma migrate deploy
npx prisma generate

# Build application
npm run build

# Restart application
sudo systemctl restart medq

# Run health check
sleep 10
curl -f http://localhost:3000/api/health || exit 1

echo "✅ Application updated successfully!"
```

This comprehensive setup documentation provides all the necessary information for deploying and maintaining the Medical Question Platform with proper security, monitoring, and production considerations.