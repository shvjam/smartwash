namespace SmartWash.Shared.Time;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
    DateOnly TodayUtc { get; }
    DateTimeOffset OffsetNow { get; }
    DateTime ToTehran(DateTime utc);
    DateTime ToUtc(DateTime tehran);
}
// resync-marker
