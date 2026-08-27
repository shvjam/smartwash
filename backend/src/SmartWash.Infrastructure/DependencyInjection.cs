using SmartWash.Application.Abstractions.Caching;
using SmartWash.Application.Abstractions.CrossCutting;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Abstractions.Storage;
using SmartWash.Infrastructure.Caching;
using SmartWash.Infrastructure.CrossCutting;
using SmartWash.Infrastructure.Identity;
using SmartWash.Infrastructure.Messaging.Email;
using SmartWash.Infrastructure.Messaging.Payments;
using SmartWash.Infrastructure.Messaging.Sms;
using SmartWash.Infrastructure.Multitenancy;
using SmartWash.Infrastructure.Persistence;
using SmartWash.Infrastructure.Persistence.Seed;
using SmartWash.Infrastructure.Storage;
using SmartWash.Infrastructure.Time;
using SmartWash.Shared.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace SmartWash.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(opt =>
        {
            opt.UseSqlServer(
                configuration.GetConnectionString("Default")
                    ?? throw new InvalidOperationException("ConnectionStrings:Default is missing"),
                sql =>
                {
                    sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                    sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null);
                    sql.CommandTimeout(60);
                });
            opt.EnableSensitiveDataLogging(false);
        });

        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<LocalFileStorageOptions>(configuration.GetSection(LocalFileStorageOptions.SectionName));

        services.AddScoped<ITenantContext, TenantContext>();
        services.AddScoped<ITenantResolver, TenantResolver>();
        services.AddScoped<ITenantFeatureService, TenantFeatureService>();
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
        services.AddScoped<ICorrelationContext, CorrelationContext>();
        services.AddScoped<IAuditWriter, AuditWriter>();

        services.AddMemoryCache();
        services.AddSingleton<IAppCache, MemoryAppCache>();
        services.AddSingleton<IFileStorage, LocalFileStorage>();

        services.AddScoped<DatabaseSeeder>();

        services.Configure<PaymentGatewayOptions>(configuration.GetSection(PaymentGatewayOptions.SectionName));
        services.Configure<SmsOptions>(configuration.GetSection(SmsOptions.SectionName));
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));

        services.AddHttpClient<ZarinpalGatewayClient>();
        services.AddHttpClient<IDPayGatewayClient>();
        services.AddHttpClient<NextPayGatewayClient>();
        services.AddSingleton<ManualGatewayClient>();
        services.AddSingleton<IPaymentGatewayFactory, PaymentGatewayFactory>();

        services.AddHttpClient<SmsIrSmsSender>();
        services.AddScoped<ISmsSender>(sp => sp.GetRequiredService<SmsIrSmsSender>());
        services.AddScoped<ISmsDispatcher, SmsDispatcher>();
        services.AddSingleton<IEmailSender, SmtpEmailSender>();

        return services;
    }
}
// resync-marker
