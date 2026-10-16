using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace SmartWash.Infrastructure.Persistence;

/// <summary>
/// Marks every DateTime read from the database as UTC.
///
/// SQL Server's datetime2 has no notion of a time zone, so values came back with an unspecified
/// kind and were written to JSON without a trailing Z. A browser reads such a string as local
/// time, which in Iran put every displayed time three and a half hours early and made every
/// "minutes in the bay" counter three and a half hours too long. The application only ever
/// stores UtcNow, so stating that on the way out is a correction, not a conversion.
/// </summary>
public sealed class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter()
        : base(
            v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    { }
}

public sealed class NullableUtcDateTimeConverter : ValueConverter<DateTime?, DateTime?>
{
    public NullableUtcDateTimeConverter()
        : base(
            v => v.HasValue && v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
    { }
}
