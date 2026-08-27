using Microsoft.OpenApi.Models;

namespace SmartWash.Api.Configuration;

public static class SwaggerConfig
{
    public static IServiceCollection AddSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "SmartWash API",
                Version = "v1",
                Description = "SmartWash SaaS Platform — Multi-tenant Carwash Management API",
                Contact = new OpenApiContact { Name = "SmartWash", Url = new Uri("https://smartwash.app") }
            });

            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "JWT Authorization header. Example: Bearer {token}"
            });

            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                    },
                    Array.Empty<string>()
                }
            });

            c.CustomSchemaIds(t => t.FullName?.Replace("+", "."));
        });
        return services;
    }
}
