using System.Security.Cryptography;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Identity;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Auth;

internal static class OtpHelper
{
    public static string Generate6Digits()
    {
        var n = RandomNumberGenerator.GetInt32(0, 1_000_000);
        return n.ToString("D6");
    }

    public static string Hash(string code)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(code));
        return Convert.ToHexString(bytes);
    }
}

public sealed record ForgotPasswordCommand(string EmailOrPhone) : IRequest<Result>, ITransactionalRequest;
public sealed class ForgotPasswordValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordValidator() { RuleFor(x => x.EmailOrPhone).NotEmpty().MaximumLength(256); }
}
public sealed class ForgotPasswordHandler : IRequestHandler<ForgotPasswordCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ISmsDispatcher _sms;
    private readonly IEmailSender _email;
    public ForgotPasswordHandler(IAppDbContext db, ISmsDispatcher sms, IEmailSender email)
    { _db = db; _sms = sms; _email = email; }
    public async Task<Result> Handle(ForgotPasswordCommand c, CancellationToken ct)
    {
        var input = c.EmailOrPhone.Trim();
        var isPhone = System.Text.RegularExpressions.Regex.IsMatch(input, "^09[0-9]{9}$");
        User? user;
        if (isPhone)
            user = await _db.Users.FirstOrDefaultAsync(u => u.Phone == input, ct);
        else
        {
            var norm = input.ToUpperInvariant();
            user = await _db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == norm, ct);
        }

        // Always return success — do not leak whether user exists
        if (user is null) return Result.Success();

        var code = OtpHelper.Generate6Digits();
        var hash = OtpHelper.Hash(code);
        var otp = new OtpCode(input, OtpPurpose.PasswordReset, hash, DateTime.UtcNow.AddMinutes(10), user.Id);
        _db.OtpCodes.Add(otp);

        if (isPhone)
        {
            var body = $"کد بازیابی گذرواژه شما: {code}";
            _db.SmsMessages.Add(new SmsMessage(user.TenantId ?? Guid.Empty, input, body, SmsMessageKind.Otp, otp.Id));
            // رمز یک‌بارمصرف، ارسالِ خودِ پلتفرم است: از اتصال مرکزی استفاده می‌کند و به هیچ مستاجری صورتحساب نمی‌شود.
            await _sms.SendPlatformAsync(input, SmsPurpose.PasswordReset,
                new Dictionary<string, string> { ["Code"] = code }, body, ct);
        }
        else
        {
            await _email.SendAsync(input, "بازیابی گذرواژه", $"کد بازیابی شما: {code}\nاین کد تا ۱۰ دقیقه معتبر است.", ct);
        }

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record ResetPasswordCommand(string EmailOrPhone, string Code, string NewPassword) : IRequest<Result>, ITransactionalRequest;
public sealed class ResetPasswordValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.EmailOrPhone).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().Length(6);
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).MaximumLength(128);
    }
}
public sealed class ResetPasswordHandler : IRequestHandler<ResetPasswordCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    public ResetPasswordHandler(IAppDbContext db, IPasswordHasher hasher) { _db = db; _hasher = hasher; }
    public async Task<Result> Handle(ResetPasswordCommand c, CancellationToken ct)
    {
        var dest = c.EmailOrPhone.Trim();
        var codeHash = OtpHelper.Hash(c.Code.Trim());
        var otp = await _db.OtpCodes
            .Where(o => o.Destination == dest && o.Purpose == OtpPurpose.PasswordReset && o.ConsumedAtUtc == null)
            .OrderByDescending(o => o.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
        if (otp is null) return Result.Failure(Error.NotFound("Otp.NotFound", "درخواست بازیابی یافت نشد."));
        if (otp.IsExpired) return Result.Failure(Error.Validation("Otp.Expired", "کد منقضی شده است."));
        otp.RegisterAttempt();
        if (otp.AttemptCount > 5) return Result.Failure(Error.Validation("Otp.TooManyAttempts", "تعداد تلاش‌های مجاز به پایان رسید."));
        if (otp.CodeHash != codeHash)
        {
            await _db.SaveChangesAsync(ct);
            return Result.Failure(Error.Validation("Otp.Invalid", "کد نامعتبر است."));
        }
        if (!otp.UserId.HasValue) return Result.Failure(Error.NotFound("User.NotFound", "کاربر یافت نشد."));
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == otp.UserId.Value, ct);
        if (u is null) return Result.Failure(Error.NotFound("User.NotFound", "کاربر یافت نشد."));
        u.UpdatePassword(_hasher.Hash(c.NewPassword));
        otp.Consume();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
