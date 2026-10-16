using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWash.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OrderStages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Stage",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "WashCompletedAtUtc",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WashStartedAtUtc",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OrderStageEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Stage = table.Column<int>(type: "int", nullable: false),
                    AtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderStageEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderStageEvents_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_TenantId_BranchId_Stage",
                table: "Orders",
                columns: new[] { "TenantId", "BranchId", "Stage" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderStageEvents_OrderId_AtUtc",
                table: "OrderStageEvents",
                columns: new[] { "OrderId", "AtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderStageEvents_TenantId_AtUtc",
                table: "OrderStageEvents",
                columns: new[] { "TenantId", "AtUtc" });

            // Orders that already exist predate stages and would otherwise all read as
            // "just arrived", including ones finished months ago. A closed order ends its
            // journey by definition, so it is placed at the end of it; anything still open
            // keeps the default and is treated as a car in the bay, which it is.
            migrationBuilder.Sql(@"
                UPDATE [Orders] SET [Stage] = 4 WHERE [Status] = 1;
                UPDATE [Orders] SET [WashStartedAtUtc] = [StartedAtUtc],
                                    [WashCompletedAtUtc] = [CompletedAtUtc]
                WHERE [Status] = 1 AND [CompletedAtUtc] IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderStageEvents");

            migrationBuilder.DropIndex(
                name: "IX_Orders_TenantId_BranchId_Stage",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Stage",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "WashCompletedAtUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "WashStartedAtUtc",
                table: "Orders");
        }
    }
}
