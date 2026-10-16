namespace SmartWash.Api.Configuration;

public static class CorsConfig
{
    public const string PolicyName = "SmartWashCors";

    public static IServiceCollection AddAppCors(this IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?.Where(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                             && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray()
            ?? Array.Empty<string>();

        services.AddCors(options => options.AddPolicy(PolicyName, policy =>
        {
            // Credentials must only ever be sent to explicitly trusted origins.
            // An empty allow-list intentionally permits no cross-origin browser access.
            if (origins.Length > 0)
                // Every request from the panel carries an Authorization header, which makes the
                // browser ask permission first with an OPTIONS round trip. Without a max age it
                // asks before every single call, doubling the wait behind each click on a slow
                // connection; an hour lets it remember the answer.
                policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
                      .SetPreflightMaxAge(TimeSpan.FromHours(1));
        }));

        return services;
    }
}
