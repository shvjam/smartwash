# SmartWash Backend — Phase 0

پلتفرم SaaS چندمستاجره برای مدیریت کارواش — ASP.NET Core 8 / EF Core / SQL Server.

## ساختار سولوشن
```
SmartWash.sln
├── src/
│   ├── SmartWash.Api              ASP.NET Core 8 Web API (Entry point)
│   ├── SmartWash.Application      MediatR Handlers, DTOs, Validators, Abstractions
│   ├── SmartWash.Domain           Aggregates, Entities, Domain Events
│   ├── SmartWash.Infrastructure   EF Core, JWT, Cache, Storage, Identity
│   └── SmartWash.Shared           Result, Pagination, Constants, Exceptions
├── deploy/plesk                   web.config, Cron docs, deployment guide
└── tests                          (آینده)
```

## ویژگی‌های فاز ۰
- ✅ Clean Architecture با مرز سخت بین Layerها
- ✅ Multi-tenancy با EF Global Query Filter (Path-based: `/api/t/{slug}/...`)
- ✅ Identity (JWT + Refresh Token + Role/Permission)
- ✅ Pipeline Behaviors: Logging / Validation / UnitOfWork
- ✅ Audit Log + Correlation Id
- ✅ Cron Endpoints محافظت‌شده با Secret
- ✅ Serilog → Rolling File
- ✅ Swagger + Health Checks
- ✅ Plesk-Ready (`web.config`)
- ✅ Seed دیتای پایه (Plans + PlatformOwner) — بدون داده‌ی فیک

## اجرای محلی
```bash
cd backend
dotnet restore
dotnet ef database update --project src/SmartWash.Infrastructure --startup-project src/SmartWash.Api
dotnet run --project src/SmartWash.Api
```

سپس به `https://localhost:7022/swagger` بروید.

## ساخت اولین Migration
```bash
cd backend
dotnet ef migrations add Initial \
  --project src/SmartWash.Infrastructure \
  --startup-project src/SmartWash.Api \
  --output-dir Persistence/Migrations
```

## Endpointهای موجود
### Public
- `POST /api/public/auth/login` — ورود
- `POST /api/public/auth/refresh` — نوسازی توکن
- `POST /api/public/auth/logout` — خروج (نیاز به Auth)
- `POST /api/public/auth/register-tenant` — ثبت‌نام مستاجر جدید (شامل دوره‌ی آزمایشی ۱۴ روزه)
- `GET  /api/public/plans` — لیست پلن‌های قابل خرید

### Authenticated
- `GET /api/me` — اطلاعات کاربر جاری
- `GET /api/me/tenant` — اطلاعات مستاجر جاری (نیاز به TenantContext)

### Platform Admin
- `GET /api/platform/tenants` — لیست همه‌ی مستاجرها (نیاز به Permission `platform.tenants.read`)

### Cron (با Header `X-Cron-Secret`)
- `GET /api/cron/expire-trials`
- `GET /api/cron/expire-grace`
- `GET /api/cron/ping`

### System
- `GET /` — Info
- `GET /health` — Health Check

## نقشه‌ی فازهای بعدی
- **فاز ۱**: Super Admin پنل (CRUD Plans/Tenants/Subscriptions)
- **فاز ۲**: Subscription Billing + Zarinpal Integration + Webhook
- **فاز ۳**: مهاجرت اپ فعلی به Backend (Bay, Order, Customer, Service, Worker, Reservation)
- **فاز ۴**: Add-ons (Wallet, Loyalty, Campaign, SMS)
- **فاز ۵**: Per-car billing (Partnership plan) + Audit/Backup خودکار

برای Deployment روی Plesk Windows: `deploy/plesk/README.md`

## استقرار امن (اجباری)

فایل‌های `appsettings*.json` داخل مخزن فقط قالب هستند و هیچ secret عملیاتی نباید در آن‌ها commit شود. پیش از انتشار، در تنظیمات Environment Variables سایت IIS/Plesk (یا secret store میزبان) مقادیر زیر را تزریق کنید؛ جداکنندهٔ سلسله‌مراتب .NET در نام متغیر `__` است:

```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_DETAILEDERRORS=false
ConnectionStrings__Default=<production SQL connection string>
Jwt__SigningKey=<new random key, at least 64 characters>
Cron__Secret=<new random secret, at least 32 characters>
Cors__AllowedOrigins__0=https://smartwash.zishot.com
```

در صورت استفاده از سرویس‌های فعال، کلیدهای `Sms__ApiKey` و کلیدهای payment نیز فقط از secret store تزریق شوند. کلیدهای JWT و Cron که پیش‌تر در repository یا سرور بوده‌اند **فوراً rotate** شوند؛ تعویض فایل بدون rotate کردن مقدارِ قبلی کافی نیست. پس از deploy بررسی کنید که `/swagger` پاسخ 404 می‌دهد و پاسخ خطای ۵۰۰ هیچ stack trace یا جزئیات داخلی ندارد.

برای توسعهٔ محلی، مقادیر را در User Secrets نگه دارید (و هرگز در `appsettings.Development.json` ننویسید):

```bash
cd backend/src/SmartWash.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Default" "<local connection string>"
dotnet user-secrets set "Jwt:SigningKey" "<local dev key, at least 64 characters>"
dotnet user-secrets set "Cron:Secret" "<local random secret, at least 32 characters>"
```

## EF Core migrations — workflow required

The database schema is migration-first. The API never calls `EnsureCreated`, never changes columns on startup, and the seed process inserts data only after the schema has been applied.

```bash
cd backend
dotnet tool restore
dotnet ef database update \
  --project src/SmartWash.Infrastructure \
  --startup-project src/SmartWash.Api \
  --context AppDbContext
```

Create every schema change through a reviewed migration:

```bash
cd backend
dotnet tool restore
dotnet ef migrations add MeaningfulChangeName \
  --project src/SmartWash.Infrastructure \
  --startup-project src/SmartWash.Api \
  --context AppDbContext \
  --output-dir Persistence/Migrations

dotnet ef migrations has-pending-model-changes \
  --project src/SmartWash.Infrastructure \
  --startup-project src/SmartWash.Api \
  --context AppDbContext
```

For a shared host that cannot run `dotnet`, generate and run the checked migration script from the same release:

```bash
cd backend
dotnet tool restore
dotnet ef migrations script --idempotent \
  --project src/SmartWash.Infrastructure \
  --startup-project src/SmartWash.Api \
  --context AppDbContext \
  --output sql/migration.sql
```

No migration or generated SQL script is committed by this cleanup. Create and review the migration locally, then generate the release-specific SQL script from that exact commit. For a clean reset, run `sql/reset-database.sql`, then apply the locally generated migration script with the same SQL login/schema used by the API. Set `Seed__RunOnStartup=true` only after the migration is successful, restart the API once, then return it to `false`.
