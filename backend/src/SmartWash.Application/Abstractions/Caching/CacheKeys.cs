namespace SmartWash.Application.Abstractions.Caching;

/// <summary>
/// Cache keys that more than one layer needs to name.
///
/// A key that is written in one place and cleared in another has to be spelled the same in
/// both, and a typo in either is silent: the entry simply never clears, and whatever it stood
/// for keeps being true long after it stopped being true.
/// </summary>
public static class CacheKeys
{
    /// <summary>Whether a user account is still switched on. Written by the API's request
    /// filter, cleared the moment an administrator switches the account off.</summary>
    public static string UserActive(Guid userId) => $"user-active:{userId:N}";
}
