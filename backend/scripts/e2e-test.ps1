<#
.SYNOPSIS
    آزمون سرتاسری (end-to-end) پلتفرم SmartWash — با دسترسی «مالک پلتفرم» و «کارواش دمو».

.DESCRIPTION
    این اسکریپت مثل یک تستر واقعی رفتار می‌کند: وارد می‌شود، فلوها را به ترتیب اجرا
    می‌کند، پاسخ هر مرحله را بررسی می‌کند و در پایان جدول PASS/FAIL می‌دهد.

    مهم: بخش «سفارش» عمداً کل چرخه‌ی عمر را پشت‌سرهم اجرا می‌کند
    (ایجاد → افزودن خط → انعام → تخفیف → پرداخت → تکمیل) چون خطای
    ۴۰۹ Concurrency.Conflict فقط در همین توالی بروز می‌کند. اگر مرحله‌ای ۴۰۹ داد،
    اسکریپت بدنه‌ی خطا را کامل چاپ می‌کند تا با لاگ سرور تطبیق داده شود.

.EXAMPLE
    .\e2e-test.ps1
    .\e2e-test.ps1 -BaseUrl "https://smartwashapi.zishot.com" -Verbose
#>
[CmdletBinding()]
param(
    [string]$BaseUrl        = "https://smartwashapi.zishot.com",
    [string]$TenantSlug     = "demo-carwash",
    [string]$OwnerEmail     = "owner@smartwash.com",
    [string]$OwnerPassword  = "Test@1234",
    [string]$TenantEmail    = "demo@smartwash.com",
    [string]$TenantPassword = "Demo@1234",
    # پاک‌سازی: سفارش‌های ساخته‌شده‌ی آزمون در پایان لغو می‌شوند.
    [switch]$KeepTestData
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

$script:Results   = [System.Collections.Generic.List[object]]::new()
$script:CreatedOrderIds = [System.Collections.Generic.List[string]]::new()

# ─────────────────────────── زیرساخت آزمون ───────────────────────────

function Invoke-Api {
    param(
        [Parameter(Mandatory)][ValidateSet('GET','POST','PUT','PATCH','DELETE')][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        $Body,
        [string]$Token,
        [switch]$Raw   # خطاها را دوباره throw کن (برای مواردی که خودمان مدیریت می‌کنیم)
    )
    $headers = @{ 'Accept' = 'application/json' }
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }

    $params = @{
        Uri     = "$BaseUrl$Path"
        Method  = $Method
        Headers = $headers
    }
    if ($null -ne $Body) {
        $params['Body']        = ($Body | ConvertTo-Json -Depth 10 -Compress)
        $params['ContentType'] = 'application/json; charset=utf-8'
    }

    try {
        return [pscustomobject]@{ Ok = $true; Status = 200; Data = (Invoke-RestMethod @params) }
    }
    catch {
        $resp   = $_.Exception.Response
        $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
        $raw    = ''
        try { $raw = $_.ErrorDetails.Message } catch { }
        if ($Raw) { throw }
        return [pscustomobject]@{ Ok = $false; Status = $status; Data = $null; Error = $raw }
    }
}

function Test-Step {
    <# یک مرحله را اجرا و نتیجه‌اش را ثبت می‌کند. $Check یک scriptblock است که
       باید $true برگرداند. اگر ExpectStatus بدهید، انتظار «خطای مشخص» داریم. #>
    param(
        [Parameter(Mandatory)][string]$Area,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Action,
        [int]$ExpectStatus = 0
    )
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $r = & $Action
        $sw.Stop()

        if ($ExpectStatus -gt 0) {
            # انتظار رد شدن داشتیم (مثلاً ۴۰۳ برای دسترسی غیرمجاز).
            $pass   = (-not $r.Ok) -and ($r.Status -eq $ExpectStatus)
            $detail = if ($pass) { "انتظار $ExpectStatus → دریافت $($r.Status)" }
                      else { "انتظار $ExpectStatus بود اما $($r.Status) آمد. $($r.Error)" }
        }
        else {
            $pass   = [bool]$r.Ok
            $detail = if ($pass) { '' } else { "HTTP $($r.Status) — $($r.Error)" }
        }

        $script:Results.Add([pscustomobject]@{
            Area = $Area; Name = $Name
            Status = $(if ($pass) { 'PASS' } else { 'FAIL' })
            Ms = $sw.ElapsedMilliseconds; Detail = $detail
        })

        if ($pass) { Write-Host "  ✔ $Name" -ForegroundColor Green }
        else {
            Write-Host "  ✘ $Name" -ForegroundColor Red
            Write-Host "      $detail" -ForegroundColor DarkYellow
        }
        return $r
    }
    catch {
        $sw.Stop()
        $script:Results.Add([pscustomobject]@{
            Area = $Area; Name = $Name; Status = 'ERROR'
            Ms = $sw.ElapsedMilliseconds; Detail = $_.Exception.Message
        })
        Write-Host "  ! $Name — $($_.Exception.Message)" -ForegroundColor Magenta
        return $null
    }
}

function Write-Section($title) {
    Write-Host ''
    Write-Host "── $title " -NoNewline -ForegroundColor Cyan
    Write-Host ('─' * [Math]::Max(0, 60 - $title.Length)) -ForegroundColor DarkCyan
}

# ─────────────────────────── ۰) سلامت سرویس ───────────────────────────

Write-Section 'سلامت سرویس و اندپوینت‌های عمومی'

Test-Step 'Health' 'GET / (root)'            { Invoke-Api GET '/' }
Test-Step 'Health' 'GET /health'             { Invoke-Api GET '/health' }
Test-Step 'Health' 'GET /api/public/plans'   { Invoke-Api GET '/api/public/plans' }

# ─────────────────────────── ۱) ورود ───────────────────────────

Write-Section 'احراز هویت'

$ownerLogin = Test-Step 'Auth' 'ورود مالک پلتفرم' {
    Invoke-Api POST '/api/public/auth/login' -Body @{ email = $OwnerEmail; password = $OwnerPassword }
}
$tenantLogin = Test-Step 'Auth' 'ورود کارواش دمو' {
    Invoke-Api POST '/api/public/auth/login' -Body @{ email = $TenantEmail; password = $TenantPassword; tenantSlug = $TenantSlug }
}

Test-Step 'Auth' 'رمز غلط باید رد شود' -ExpectStatus 401 {
    Invoke-Api POST '/api/public/auth/login' -Body @{ email = $TenantEmail; password = 'WrongPass!123'; tenantSlug = $TenantSlug }
}

if (-not ($ownerLogin.Ok -and $tenantLogin.Ok)) {
    Write-Host ''
    Write-Host 'ورود ناموفق بود؛ ادامه‌ی آزمون بی‌معنی است. آدرس سرور و رمزهای seed را بررسی کنید.' -ForegroundColor Red
    exit 1
}

$ownerToken  = $ownerLogin.Data.accessToken
$tenantToken = $tenantLogin.Data.accessToken
$T = "/api/t/$TenantSlug"   # پیشوند مسیرهای مستاجر

# ─────────────────────────── ۲) جداسازی دسترسی ───────────────────────────

Write-Section 'جداسازی نقش‌ها و مستاجرها (منفی)'

Test-Step 'Authz' 'مستاجر نباید به پنل پلتفرم دسترسی داشته باشد' -ExpectStatus 403 {
    Invoke-Api GET '/api/platform/tenants' -Token $tenantToken
}
Test-Step 'Authz' 'بدون توکن باید ۴۰۱ بدهد' -ExpectStatus 401 {
    Invoke-Api GET "$T/orders"
}
Test-Step 'Authz' 'اسلاگ ناموجود باید ۴۰۴ بدهد' -ExpectStatus 404 {
    Invoke-Api GET '/api/t/no-such-tenant/orders' -Token $tenantToken
}
Test-Step 'Authz' 'اندپوینت cron بدون سکرت باید رد شود' -ExpectStatus 401 {
    Invoke-Api GET '/api/cron/subscriptions/renew'
}

# ─────────────────────────── ۳) خواندن پنل پلتفرم ───────────────────────────

Write-Section 'پنل پلتفرم (مالک)'

$platformReads = @(
    @{ n = 'فهرست مستاجرها';        p = '/api/platform/tenants' },
    @{ n = 'فهرست پلن‌ها';          p = '/api/platform/plans' },
    @{ n = 'اشتراک‌ها';             p = '/api/platform/subscriptions' },
    @{ n = 'تیکت‌ها';               p = '/api/platform/tickets' },
    @{ n = 'گزارش رخدادها';         p = '/api/platform/audit-logs?page=1&pageSize=5' },
    @{ n = 'الگوهای پیامک';          p = '/api/platform/sms/templates' },
    @{ n = 'مصرف پیامک';            p = '/api/platform/sms/usage?page=1&pageSize=5' },
    @{ n = 'سهمیه پیامک مستاجرها';   p = '/api/platform/sms/quotas' },
    @{ n = 'تنظیمات سامانه پیامک';   p = '/api/platform/sms/settings' },
    @{ n = 'آمار میز پیامک';         p = '/api/platform/sms/stats' }
)
foreach ($e in $platformReads) {
    Test-Step 'Platform' $e.n ([scriptblock]::Create("Invoke-Api GET '$($e.p)' -Token `$ownerToken"))
}

# ─────────────────────────── ۴) خواندن پنل مستاجر ───────────────────────────

Write-Section 'پنل کارواش (خواندن)'

$tenantReads = @(
    @{ n = 'من کی هستم';        p = '/auth/me' },
    @{ n = 'تنظیمات کارواش';    p = '/settings' },
    @{ n = 'شعبه‌ها';           p = '/branches' },
    @{ n = 'جایگاه‌ها';          p = '/bays' },
    @{ n = 'خدمات';             p = '/services' },
    @{ n = 'مشتریان';           p = '/customers?page=1&pageSize=5' },
    @{ n = 'خودروها';           p = '/vehicles?page=1&pageSize=5' },
    @{ n = 'پرسنل';             p = '/workers' },
    @{ n = 'سفارش‌ها';           p = '/orders?page=1&pageSize=5' },
    @{ n = 'رزروها';            p = '/reservations?page=1&pageSize=5' },
    @{ n = 'شیفت‌ها';            p = '/shifts?page=1&pageSize=5' },
    @{ n = 'کیف پول';           p = '/wallets?page=1&pageSize=5' },
    @{ n = 'اشتراک من';         p = '/subscription' },
    @{ n = 'الگوهای پیامک من';   p = '/sms/templates' },
    @{ n = 'داشبورد';           p = '/dashboard' }
)
foreach ($e in $tenantReads) {
    Test-Step 'Tenant' $e.n ([scriptblock]::Create("Invoke-Api GET '$T$($e.p)' -Token `$tenantToken"))
}

# ─────────────────────────── ۵) چرخه‌ی کامل سفارش (بازتولید ۴۰۹) ───────────────────────────

Write-Section 'چرخه‌ی کامل سفارش — نقطه‌ی بروز خطای ۴۰۹'

$branches = (Invoke-Api GET "$T/branches" -Token $tenantToken).Data
$bays     = (Invoke-Api GET "$T/bays"     -Token $tenantToken).Data
$services = (Invoke-Api GET "$T/services" -Token $tenantToken).Data
$workers  = (Invoke-Api GET "$T/workers"  -Token $tenantToken).Data

$branchId = @($branches)[0].id
$freeBay  = @($bays  | Where-Object { -not $_.currentOrderId }) | Select-Object -First 1
$bayId    = if ($freeBay) { $freeBay.id } else { @($bays)[0].id }
$svc      = @($services) | Select-Object -First 2
$workerId = @($workers)[0].id

if (-not ($branchId -and $bayId -and $svc)) {
    Write-Host 'داده‌ی پایه (شعبه/جایگاه/خدمت) موجود نیست؛ آزمون سفارش رد شد.' -ForegroundColor Yellow
}
else {
    $order = Test-Step 'Order' '۱) ایجاد سفارش با یک خط' {
        Invoke-Api POST "$T/orders" -Token $tenantToken -Body @{
            branchId      = $branchId
            bayId         = $bayId
            customerName  = 'تستر خودکار'
            customerPhone = '09120000000'
            vehiclePlate  = '12ب34567'
            source        = 0
            lines         = @(@{ serviceId = $svc[0].id; quantity = 1; workerId = $workerId })
        }
    }

    if ($order -and $order.Ok) {
        $oid = $order.Data.id
        $script:CreatedOrderIds.Add($oid)
        Write-Host "      شناسه سفارش: $oid" -ForegroundColor DarkGray

        # این توالی همان چیزی است که در UI اتفاق می‌افتد و ۴۰۹ می‌دهد.
        $afterLine = Test-Step 'Order' '۲) افزودن خط دوم (محل بروز ۴۰۹)' {
            Invoke-Api POST "$T/orders/$oid/lines" -Token $tenantToken -Body @{
                serviceId = (@($svc)[-1]).id; quantity = 1; workerId = $workerId
            }
        }

        # افزودن پیاپی: اگر توکن همزمانی خراب باشد، دومی قطعاً می‌شکند.
        Test-Step 'Order' '۳) افزودن خط سوم بلافاصله (آزمون همزمانی)' {
            Invoke-Api POST "$T/orders/$oid/lines" -Token $tenantToken -Body @{
                serviceId = (@($svc)[0]).id; quantity = 1; workerId = $workerId
            }
        }

        $cur = (Invoke-Api GET "$T/orders/$oid" -Token $tenantToken).Data
        $lineId = @($cur.lines)[0].id

        Test-Step 'Order' '۴) ثبت انعام روی خط' {
            Invoke-Api PATCH "$T/orders/$oid/lines/$lineId/tip" -Token $tenantToken -Body @{ tipRials = 50000 }
        }
        Test-Step 'Order' '۵) تخصیص پرسنل به خط' {
            Invoke-Api PATCH "$T/orders/$oid/lines/$lineId/worker" -Token $tenantToken -Body @{ workerId = $workerId }
        }
        Test-Step 'Order' '۶) اعمال تخفیف' {
            Invoke-Api POST "$T/orders/$oid/discount" -Token $tenantToken -Body @{ discountRials = 10000 }
        }
        Test-Step 'Order' '۷) تخفیف بیشتر از مبلغ کل باید رد شود' -ExpectStatus 400 {
            Invoke-Api POST "$T/orders/$oid/discount" -Token $tenantToken -Body @{ discountRials = 999999999 }
        }
        Test-Step 'Order' '۸) حذف خط' {
            Invoke-Api DELETE "$T/orders/$oid/lines/$lineId" -Token $tenantToken
        }

        $cur = (Invoke-Api GET "$T/orders/$oid" -Token $tenantToken).Data
        Write-Host "      مانده (ریال): $($cur.dueRials)" -ForegroundColor DarkGray

        Test-Step 'Order' '۹) پرداخت بخشی (نقدی)' {
            Invoke-Api POST "$T/orders/$oid/payments" -Token $tenantToken -Body @{
                method = 0; amountRials = 10000
            }
        }
        Test-Step 'Order' '۱۰) تکمیل سفارش' {
            Invoke-Api POST "$T/orders/$oid/complete" -Token $tenantToken -Body @{ finalMethod = 0 }
        }
        Test-Step 'Order' '۱۱) افزودن خط به سفارش تکمیل‌شده باید رد شود' -ExpectStatus 400 {
            Invoke-Api POST "$T/orders/$oid/lines" -Token $tenantToken -Body @{
                serviceId = (@($svc)[0]).id; quantity = 1
            }
        }

        $bayAfter = (Invoke-Api GET "$T/bays" -Token $tenantToken).Data |
                    Where-Object { $_.id -eq $bayId }
        Test-Step 'Order' '۱۲) جایگاه بعد از تکمیل آزاد شده' {
            [pscustomobject]@{ Ok = (-not $bayAfter.currentOrderId); Status = 200
                               Error = "جایگاه هنوز اشغال است: $($bayAfter.currentOrderId)" }
        }

        # سفارش دوم: مسیر لغو
        $order2 = Test-Step 'Order' '۱۳) ایجاد سفارش دوم برای آزمون لغو' {
            Invoke-Api POST "$T/orders" -Token $tenantToken -Body @{
                branchId = $branchId; bayId = $bayId
                customerName = 'تستر لغو'; customerPhone = '09120000001'
                vehiclePlate = '12ب34568'; source = 0
                lines = @(@{ serviceId = $svc[0].id; quantity = 1 })
            }
        }
        if ($order2 -and $order2.Ok) {
            $oid2 = $order2.Data.id
            $script:CreatedOrderIds.Add($oid2)
            Test-Step 'Order' '۱۴) لغو سفارش' {
                Invoke-Api POST "$T/orders/$oid2/cancel" -Token $tenantToken -Body @{ reason = 'آزمون خودکار' }
            }
            $bayAfter2 = (Invoke-Api GET "$T/bays" -Token $tenantToken).Data |
                         Where-Object { $_.id -eq $bayId }
            Test-Step 'Order' '۱۵) جایگاه بعد از لغو آزاد شده' {
                [pscustomobject]@{ Ok = (-not $bayAfter2.currentOrderId); Status = 200
                                   Error = "جایگاه هنوز اشغال است: $($bayAfter2.currentOrderId)" }
            }
        }
    }
}

# ─────────────────────────── ۶) قاعده‌ی پیامک متمرکز ───────────────────────────

Write-Section 'قاعده‌ی پیامک متمرکز'

Test-Step 'Sms' 'مستاجر می‌تواند فقط Enabled را تغییر دهد' {
    Invoke-Api PUT "$T/settings/sms" -Token $tenantToken -Body @{ enabled = $true }
}
Test-Step 'Sms' 'مستاجر نباید بتواند خط/سامانه‌ی ارسال را عوض کند' {
    # فیلدهای اضافی باید نادیده گرفته شوند، نه اعمال.
    $before = (Invoke-Api GET "$T/settings" -Token $tenantToken).Data
    Invoke-Api PUT "$T/settings/sms" -Token $tenantToken -Body @{
        enabled = $true; sender = '90000000'; provider = 'evil-provider'
    } | Out-Null
    $after = (Invoke-Api GET "$T/settings" -Token $tenantToken).Data
    [pscustomobject]@{
        Ok = ($after.smsProvider -eq $before.smsProvider -and $after.smsSenderNumber -eq $before.smsSenderNumber)
        Status = 200
        Error  = "اتصال پیامک توسط مستاجر تغییر کرد! provider=$($after.smsProvider) sender=$($after.smsSenderNumber)"
    }
}
Test-Step 'Sms' 'مستاجر نباید به تنظیمات سامانه‌ی ارسال دسترسی داشته باشد' -ExpectStatus 403 {
    Invoke-Api GET '/api/platform/sms/settings' -Token $tenantToken
}

# ─────────────────────────── ۷) امنیت فایل ───────────────────────────

Write-Section 'امنیت مسیر فایل (path traversal)'

Test-Step 'Files' 'حذف با ../ باید رد شود' -ExpectStatus 403 {
    Invoke-Api DELETE "$T/files?path=tenants/x/../../../appsettings.Production.json" -Token $tenantToken
}
Test-Step 'Files' 'حذف مسیر مستاجر دیگر باید رد شود' -ExpectStatus 403 {
    Invoke-Api DELETE "$T/files?path=tenants/00000000000000000000000000000000/a.png" -Token $tenantToken
}

# ─────────────────────────── ۸) پاک‌سازی ───────────────────────────

if (-not $KeepTestData) {
    Write-Section 'پاک‌سازی داده‌ی آزمون'
    foreach ($id in $script:CreatedOrderIds) {
        $r = Invoke-Api POST "$T/orders/$id/cancel" -Token $tenantToken -Body @{ reason = 'پاک‌سازی آزمون' }
        Write-Host "  سفارش $id → $(if ($r.Ok) { 'لغو شد' } else { "قبلاً نهایی شده (HTTP $($r.Status))" })" -ForegroundColor DarkGray
    }
}

# ─────────────────────────── گزارش ───────────────────────────

Write-Host ''
Write-Host ('═' * 64) -ForegroundColor Cyan
$script:Results | Format-Table Area, Status, Name, Ms -AutoSize

$pass = @($script:Results | Where-Object Status -eq 'PASS').Count
$fail = @($script:Results | Where-Object Status -ne 'PASS').Count
Write-Host "PASS: $pass   FAIL/ERROR: $fail   جمع: $($script:Results.Count)" `
    -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })

if ($fail -gt 0) {
    Write-Host ''
    Write-Host 'موارد ناموفق:' -ForegroundColor Red
    $script:Results | Where-Object Status -ne 'PASS' |
        ForEach-Object { Write-Host "  [$($_.Area)] $($_.Name)`n      $($_.Detail)" -ForegroundColor DarkYellow }

    Write-Host ''
    Write-Host 'برای ریشه‌یابی ۴۰۹، لاگ سرور را ببینید:' -ForegroundColor Cyan
    Write-Host '  Get-ChildItem -Path C:\ -Recurse -Filter "smartwash-*.log" -ErrorAction SilentlyContinue' -ForegroundColor Gray
    Write-Host '  Get-Content <path> -Tail 300 | Select-String "concurrency"' -ForegroundColor Gray
}

exit $(if ($fail -eq 0) { 0 } else { 1 })
