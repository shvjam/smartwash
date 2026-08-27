using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace SmartWash.Shared.Identifiers;

public static class SlugGenerator
{
    private static readonly Regex InvalidChars = new("[^a-z0-9؀-ۿ]+", RegexOptions.Compiled);
    private static readonly Regex MultiDash = new("-{2,}", RegexOptions.Compiled);

    public static string Generate(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        var normalized = input.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormKD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        var s = sb.ToString();
        s = InvalidChars.Replace(s, "-");
        s = MultiDash.Replace(s, "-").Trim('-');
        return s.Length > 60 ? s[..60].TrimEnd('-') : s;
    }
}
// resync-marker
