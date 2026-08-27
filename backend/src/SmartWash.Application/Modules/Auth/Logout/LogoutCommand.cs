using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Auth.Logout;

public sealed record LogoutCommand(string RefreshToken, string? IpAddress) : IRequest<Result>, ITransactionalRequest;

public sealed class LogoutCommandHandler : IRequestHandler<LogoutCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public LogoutCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result> Handle(LogoutCommand request, CancellationToken ct)
    {
        if (!_currentUser.UserId.HasValue) return Result.Success();

        var user = await _db.Users
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId.Value, ct);

        if (user is null) return Result.Success();

        user.RevokeRefreshToken(request.RefreshToken, request.IpAddress, null);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
