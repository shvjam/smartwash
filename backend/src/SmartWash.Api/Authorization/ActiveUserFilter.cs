using SmartWash.Application.Abstractions.Caching;
using SmartWash.Application.Abstractions.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace SmartWash.Api.Authorization;

/// <summary>
/// Stops a switched-off account from carrying on with the token it already holds.
///
/// Access tokens are signed for an hour and carry everything the API needs, so nothing in the
/// request pipeline ever looked the user up again. That meant switching someone off — the
/// thing an owner does the moment they let a cashier go — left that cashier able to take
/// payments and move orders for up to an hour afterwards. Refreshing was already refused, so
/// the hole closed by itself eventually; it just did not close when the owner pressed the
/// button, which is the only moment that matters.
///
/// The lookup is cached for a minute per user, so a busy floor costs one small query per
/// member of staff per minute rather than one per request. A minute is also the honest
/// promise to put on the screen: switching someone off takes effect immediately for anything
/// they have not already loaded, and within a minute for everything else.
/// </summary>
public sealed class ActiveUserFilter : IAsyncActionFilter
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(1);

    private readonly IAppDbContext _db;
    private readonly IAppCache _cache;

    public ActiveUserFilter(IAppDbContext db, IAppCache cache)
    {
        _db = db;
        _cache = cache;
    }

    private sealed record ActiveFlag(bool IsActive);

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            await next();
            return;
        }

        var raw = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        if (!Guid.TryParse(raw, out var userId))
        {
            await next();
            return;
        }

        var ct = context.HttpContext.RequestAborted;
        var flag = await _cache.GetOrCreateAsync(CacheKeys.UserActive(userId), async token =>
        {
            // The user may belong to another tenant than the one in the route, so the global
            // tenant filter is deliberately not applied here.
            var active = await _db.Users.AsNoTracking().IgnoreQueryFilters()
                .Where(u => u.Id == userId)
                .Select(u => (bool?)u.IsActive)
                .FirstOrDefaultAsync(token);
            return new ActiveFlag(active ?? false);
        }, Ttl, ct);

        if (!flag.IsActive)
        {
            context.Result = new ObjectResult(new { code = "Auth.UserInactive", message = "حساب کاربری غیرفعال است." })
            { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        await next();
    }
}
