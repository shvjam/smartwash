/*
    ============================================================================
    SmartWash — ریستِ کاملِ دیتابیس  (SQL Server)   ⚠️ همه‌ی داده‌ها پاک می‌شود
    ============================================================================
    این اسکریپت همه‌ی جدول‌ها و history مهاجرت‌ها را حذف می‌کند تا schema فقط
    توسط EF Core migrationها بازسازی شود.

    ⚠️ فقط وقتی استفاده کن که می‌خواهی از صفر شروع کنی و پاک‌شدنِ همه‌ی
       داده‌ها (سفارش‌ها، مشتری‌ها، ...) اشکالی ندارد.
       برای دیتابیس دارای داده، این اسکریپت را اجرا نکن؛ ابتدا backup بگیر و
       یک migration سازگار با schema موجود تهیه کن.

    گام‌ها:
      ۱) این اسکریپت را روی دیتابیسِ SmartWash اجرا کن (همه‌ی جدول‌ها drop می‌شوند).
      ۲) از همان connection string و همان SQL login که API استفاده می‌کند، migration را اعمال کن:
             dotnet ef database update --project src/SmartWash.Infrastructure --startup-project src/SmartWash.Api
         یا برای هاست اشتراکی، روی سیستم local و از همان commit این SQL را بساز و اجرا کن:
             dotnet ef migrations script --idempotent --project src/SmartWash.Infrastructure --startup-project src/SmartWash.Api --output migration.sql
      ۳) فقط پس از موفقیت migration، در صورت نیاز Seed__RunOnStartup=true را موقتاً
         فعال کن و Application Pool را restart کن تا داده‌های اولیه وارد شوند.

    این اسکریپت عمداً EnsureCreated و schema-mutation در startup را استفاده نمی‌کند.
    ============================================================================

*/

SET NOCOUNT ON;

-- ۱) حذفِ همه‌ی کلیدهای خارجی تا drop کردنِ جدول‌ها به ترتیبِ وابستگی نیاز نداشته باشد
DECLARE @sql nvarchar(max) = N'';

SELECT @sql += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
             + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(10)
FROM sys.foreign_keys fk
JOIN sys.tables t ON t.object_id = fk.parent_object_id;

EXEC sp_executesql @sql;

-- ۲) حذفِ همه‌ی جدول‌های کاربر
SET @sql = N'';
SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';' + CHAR(10)
FROM sys.tables;

EXEC sp_executesql @sql;

PRINT 'All tables dropped. Apply EF migrations with dotnet ef database update (or the generated migration SQL) before starting the API.';
