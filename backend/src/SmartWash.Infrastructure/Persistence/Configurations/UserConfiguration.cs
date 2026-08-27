using SmartWash.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("Users");
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).IsRequired().HasMaxLength(256);
        b.Property(x => x.NormalizedEmail).IsRequired().HasMaxLength(256);
        b.HasIndex(x => x.NormalizedEmail).IsUnique();
        b.Property(x => x.Phone).HasMaxLength(20);
        b.Property(x => x.DisplayName).IsRequired().HasMaxLength(100);
        b.Property(x => x.PasswordHash).IsRequired().HasMaxLength(256);
        b.Property(x => x.AvatarUrl).HasMaxLength(500);
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasMany(x => x.Roles).WithOne().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.RefreshTokens).WithOne().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.TenantId);
    }
}

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> b)
    {
        b.ToTable("UserRoles");
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).IsRequired().HasMaxLength(60);
        b.HasIndex(x => new { x.UserId, x.TenantId, x.Role }).IsUnique();
    }
}

public sealed class OtpCodeConfiguration : IEntityTypeConfiguration<OtpCode>
{
    public void Configure(EntityTypeBuilder<OtpCode> b)
    {
        b.ToTable("OtpCodes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Destination).IsRequired().HasMaxLength(256);
        b.Property(x => x.CodeHash).IsRequired().HasMaxLength(256);
        b.HasIndex(x => new { x.Destination, x.Purpose });
        b.HasIndex(x => x.ExpiresAtUtc);
    }
}

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("RefreshTokens");
        b.HasKey(x => x.Id);
        b.Property(x => x.Token).IsRequired().HasMaxLength(256);
        b.HasIndex(x => x.Token).IsUnique();
        b.Property(x => x.CreatedByIp).HasMaxLength(60);
        b.Property(x => x.RevokedByIp).HasMaxLength(60);
        b.Property(x => x.ReplacedByToken).HasMaxLength(256);
    }
}
// resync-marker
