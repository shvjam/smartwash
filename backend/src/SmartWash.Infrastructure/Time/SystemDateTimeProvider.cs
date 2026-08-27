using SmartWash.Shared.Time;

namespace SmartWash.Infrastructure.Time;

public sealed class SystemDateTimeProvider : IDateTimeProvider
{
    private static readonly TimeZoneInfo TehranTimeZone = ResolveTehran();

    public DateTime UtcNow => DateTime.UtcNow;
    public DateOnly TodayUtc => DateOnly.FromDateTime(DateTime.UtcNow);
    public DateTimeOffset OffsetNow => DateTimeOffset.UtcNow;

    public DateTime ToTehran(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TehranTimeZone);

    public DateTime ToUtc(DateTime tehran) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(tehran, DateTimeKind.Unspecified), TehranTimeZone);

    private static TimeZoneInfo ResolveTehran()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Iran Standard Time"); } catch { }
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran"); } catch { }
        return TimeZoneInfo.CreateCustomTimeZone("Asia/Tehran", TimeSpan.FromMinutes(210), "Asia/Tehran", "Asia/Tehran");
    }
}
// resync-marker
