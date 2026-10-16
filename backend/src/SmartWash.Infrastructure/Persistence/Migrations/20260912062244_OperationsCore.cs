using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWash.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OperationsCore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOptional",
                table: "Services",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "RequiredBayType",
                table: "Services",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QueuePosition",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PaidDirectlyToWorker",
                table: "OrderLines",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "QueueCapacity",
                table: "Bays",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ServiceCapacity",
                table: "Bays",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "Bays",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "BayDowntimes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BayId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reason = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    FromUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ToUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BayDowntimes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrderBayVisits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BayId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Stage = table.Column<int>(type: "int", nullable: false),
                    EnteredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LeftAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderBayVisits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderBayVisits_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ShiftRosters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    StartsAt = table.Column<TimeOnly>(type: "time", nullable: false),
                    EndsAt = table.Column<TimeOnly>(type: "time", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "varbinary(16)", maxLength: 16, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftRosters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TipSettlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkerName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    PeriodFromUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PeriodToUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EarnedRials = table.Column<long>(type: "bigint", nullable: false),
                    PaidRials = table.Column<long>(type: "bigint", nullable: false),
                    SettledAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SettledByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "varbinary(16)", maxLength: 16, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TipSettlements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ShiftAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShiftRosterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    WorkerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BayId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShiftAssignments_ShiftRosters_ShiftRosterId",
                        column: x => x.ShiftRosterId,
                        principalTable: "ShiftRosters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BayDowntimes_BayId_FromUtc",
                table: "BayDowntimes",
                columns: new[] { "BayId", "FromUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_BayDowntimes_TenantId_ToUtc",
                table: "BayDowntimes",
                columns: new[] { "TenantId", "ToUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderBayVisits_OrderId_EnteredAtUtc",
                table: "OrderBayVisits",
                columns: new[] { "OrderId", "EnteredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderBayVisits_TenantId_BayId_EnteredAtUtc",
                table: "OrderBayVisits",
                columns: new[] { "TenantId", "BayId", "EnteredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftAssignments_ShiftRosterId",
                table: "ShiftAssignments",
                column: "ShiftRosterId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftAssignments_TenantId_BayId",
                table: "ShiftAssignments",
                columns: new[] { "TenantId", "BayId" });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftAssignments_TenantId_WorkerId",
                table: "ShiftAssignments",
                columns: new[] { "TenantId", "WorkerId" });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftRosters_TenantId_BranchId_Date",
                table: "ShiftRosters",
                columns: new[] { "TenantId", "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_TipSettlements_TenantId_WorkerId_PeriodToUtc",
                table: "TipSettlements",
                columns: new[] { "TenantId", "WorkerId", "PeriodToUtc" });

            // Stage numbers shift because four states grew into eight, and the values already
            // in the table mean different things under the new numbering. Remapped from the
            // highest down so that no row is ever moved onto a number another row still holds:
            //   Delivered 4 -> 7, ReadyForPickup 3 -> 6, Drying 2 -> 4, Washing 1 -> 2.
            // Received stays at 0. Doing this in any other order would silently merge states.
            migrationBuilder.Sql(@"
                UPDATE [Orders] SET [Stage] = 7 WHERE [Stage] = 4;
                UPDATE [Orders] SET [Stage] = 6 WHERE [Stage] = 3;
                UPDATE [Orders] SET [Stage] = 4 WHERE [Stage] = 2;
                UPDATE [Orders] SET [Stage] = 2 WHERE [Stage] = 1;

                UPDATE [OrderStageEvents] SET [Stage] = 7 WHERE [Stage] = 4;
                UPDATE [OrderStageEvents] SET [Stage] = 6 WHERE [Stage] = 3;
                UPDATE [OrderStageEvents] SET [Stage] = 4 WHERE [Stage] = 2;
                UPDATE [OrderStageEvents] SET [Stage] = 2 WHERE [Stage] = 1;");

            // Every bay so far has been a wash bay, and every past order occupied the one it
            // was booked into. Writing those visits now means the bay reports have a history
            // to show on the first day rather than starting empty.
            migrationBuilder.Sql(@"
                INSERT INTO [OrderBayVisits] ([Id], [TenantId], [OrderId], [BayId], [Stage], [EnteredAtUtc], [LeftAtUtc])
                SELECT NEWID(), o.[TenantId], o.[Id], o.[BayId], 2,
                       COALESCE(o.[WashStartedAtUtc], o.[StartedAtUtc]),
                       COALESCE(o.[WashCompletedAtUtc], o.[CompletedAtUtc])
                FROM [Orders] o
                WHERE o.[Status] = 1 AND o.[BayId] IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BayDowntimes");

            migrationBuilder.DropTable(
                name: "OrderBayVisits");

            migrationBuilder.DropTable(
                name: "ShiftAssignments");

            migrationBuilder.DropTable(
                name: "TipSettlements");

            migrationBuilder.DropTable(
                name: "ShiftRosters");

            migrationBuilder.DropColumn(
                name: "IsOptional",
                table: "Services");

            migrationBuilder.DropColumn(
                name: "RequiredBayType",
                table: "Services");

            migrationBuilder.DropColumn(
                name: "QueuePosition",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaidDirectlyToWorker",
                table: "OrderLines");

            migrationBuilder.DropColumn(
                name: "QueueCapacity",
                table: "Bays");

            migrationBuilder.DropColumn(
                name: "ServiceCapacity",
                table: "Bays");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Bays");
        }
    }
}
