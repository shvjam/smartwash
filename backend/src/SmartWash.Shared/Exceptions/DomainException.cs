namespace SmartWash.Shared.Exceptions;

public class DomainException : Exception
{
    public string Code { get; }

    public DomainException(string code, string message) : base(message)
    {
        Code = code;
    }
}

public sealed class TenantResolutionException : DomainException
{
    public TenantResolutionException(string message)
        : base("Tenant.NotResolved", message) { }
}

public sealed class TenantInactiveException : DomainException
{
    public TenantInactiveException(string message)
        : base("Tenant.Inactive", message) { }
}

public sealed class NotFoundException : DomainException
{
    public NotFoundException(string entityName, object key)
        : base($"{entityName}.NotFound", $"موجودیت {entityName} با کلید {key} یافت نشد.") { }
}

public sealed class ConflictException : DomainException
{
    public ConflictException(string code, string message) : base(code, message) { }
}

public sealed class ValidationException : DomainException
{
    public IReadOnlyDictionary<string, string[]> Errors { get; }

    public ValidationException(IReadOnlyDictionary<string, string[]> errors)
        : base("Validation.Failed", "خطای اعتبارسنجی رخ داد.")
    {
        Errors = errors;
    }
}
// resync-marker
