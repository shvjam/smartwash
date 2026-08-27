using SmartWash.Shared.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Api.Middlewares;

public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IWebHostEnvironment _env;
    private readonly bool _exposeErrorDetails;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IWebHostEnvironment env, IConfiguration config)
    {
        _next = next;
        _logger = logger;
        _env = env;
        // در محیط عملیاتی جزئیات استثنا پنهان است. برای عیب‌یابیِ موقت می‌توان
        // Diagnostics:ExposeErrorDetails را true کرد تا نوع و پیام استثنا در پاسخ ۵۰۰ برگردد.
        _exposeErrorDetails = config.GetValue("Diagnostics:ExposeErrorDetails", false);
    }

    public async Task Invoke(HttpContext context)
    {
        try { await _next(context); }
        catch (ValidationException ex) { await WriteValidation(context, ex); }
        catch (NotFoundException ex) { await WriteProblem(context, StatusCodes.Status404NotFound, ex.Code, ex.Message); }
        catch (ConflictException ex) { await WriteProblem(context, StatusCodes.Status409Conflict, ex.Code, ex.Message); }
        catch (TenantResolutionException ex) { await WriteProblem(context, StatusCodes.Status404NotFound, ex.Code, ex.Message); }
        catch (TenantInactiveException ex) { await WriteProblem(context, StatusCodes.Status403Forbidden, ex.Code, ex.Message); }
        catch (DomainException ex) { await WriteProblem(context, StatusCodes.Status400BadRequest, ex.Code, ex.Message); }
        catch (DbUpdateConcurrencyException ex)
        {
            // تعارضِ همزمانی خطای داخلی سرور نیست؛ یعنی رکورد بین خواندن و نوشتن تغییر کرده.
            // پاسخ ۴۰۹ به کلاینت اجازه می‌دهد پیام درست نشان دهد و کاربر دوباره تلاش کند.
            _logger.LogWarning(ex, "Concurrency conflict on {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteProblem(context, StatusCodes.Status409Conflict, "Concurrency.Conflict",
                "این رکورد هم‌زمان توسط کاربر یا درخواست دیگری تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.");
        }
        catch (Exception ex)
        {
            // مسیر و متد را هم ثبت می‌کنیم تا در لاگ عملیاتی بتوان استثنا را به درخواست وصل کرد.
            _logger.LogError(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);

            var detail = _env.IsDevelopment() || _exposeErrorDetails
                ? BuildDiagnosticDetail(ex)
                : "خطای داخلی سرور رخ داده است.";
            await WriteProblem(context, StatusCodes.Status500InternalServerError, "Server.Unexpected", detail);
        }
    }

    /// <summary>
    /// زنجیره‌ی استثناها را باز می‌کند. علت واقعی معمولاً در درونی‌ترین لایه است
    /// (مثلاً DbUpdateException ← SqlException) و پیام لایه‌ی بیرونی گمراه‌کننده است.
    /// </summary>
    private static string BuildDiagnosticDetail(Exception ex)
    {
        var parts = new List<string>();
        for (var current = ex; current is not null; current = current.InnerException)
            parts.Add($"{current.GetType().FullName}: {current.Message}");

        var firstFrame = ex.StackTrace?
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?.Trim();
        if (!string.IsNullOrEmpty(firstFrame)) parts.Add(firstFrame);

        return string.Join(" --> ", parts);
    }

    private static Task WriteProblem(HttpContext ctx, int status, string code, string message)
    {
        if (ctx.Response.HasStarted) return Task.CompletedTask;
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/problem+json";
        var problem = new ProblemDetails
        {
            Status = status,
            Title = code,
            Detail = message,
            Type = $"https://smartwash.app/errors/{code}"
        };
        return ctx.Response.WriteAsJsonAsync(problem);
    }

    private static Task WriteValidation(HttpContext ctx, ValidationException ex)
    {
        ctx.Response.StatusCode = StatusCodes.Status422UnprocessableEntity;
        ctx.Response.ContentType = "application/problem+json";
        return ctx.Response.WriteAsJsonAsync(new ValidationProblemDetails(ex.Errors.ToDictionary(k => k.Key, v => v.Value))
        {
            Status = StatusCodes.Status422UnprocessableEntity,
            Title = ex.Code,
            Detail = ex.Message
        });
    }
}
