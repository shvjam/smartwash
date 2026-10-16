using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Reports;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/reports")]
public sealed class ReportsController : ControllerBase
{
    private readonly ISender _sender;
    public ReportsController(ISender sender) => _sender = sender;

    [HttpGet("dashboard")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> Dashboard([FromQuery] Guid? branchId = null,
        [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null,
        CancellationToken ct = default)
        => (await _sender.Send(new GetDashboardQuery(branchId, fromDate, toDate), ct)).ToActionResult();

    [HttpGet("revenue-series")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> RevenueSeries([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate,
        [FromQuery] Guid? branchId = null, CancellationToken ct = default)
        => (await _sender.Send(new GetRevenueSeriesQuery(branchId, fromDate, toDate), ct)).ToActionResult();

    /// <summary>
    /// Estimated versus actual time, so the per-service duration finally answers a question
    /// instead of only firing an overdue notification.
    /// </summary>
    /// <summary>
    /// One row per worker with volume, money, speed and service mix, plus the team average,
    /// so a manager can compare people rather than read isolated numbers.
    /// </summary>
    [HttpGet("worker-scorecards")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> WorkerScorecards([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, CancellationToken ct = default)
        => (await _sender.Send(new GetWorkerScorecardsQuery(fromDate, toDate), ct)).ToActionResult();

    /// <summary>آرشیو دقیق سفارش‌ها: کدام جایگاه، چه کسی، چه زمانی، چه خودرویی</summary>
    [HttpGet("order-archive")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> OrderArchive(
        [FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate,
        [FromQuery] Guid? bayId, [FromQuery] Guid? workerId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
        => (await _sender.Send(new GetOrderArchiveQuery(fromDate, toDate, bayId, workerId, page, pageSize), ct)).ToActionResult();

    /// <summary>عملکرد جایگاه‌ها: کار انجام‌شده، زمان غیرفعالی و علتش</summary>
    [HttpGet("bay-performance")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> BayPerformance([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, CancellationToken ct = default)
        => (await _sender.Send(new GetBayPerformanceQuery(fromDate, toDate), ct)).ToActionResult();

    /// <summary>زمان انتظار در هر مرحله و شناسایی گلوگاه عملیاتی</summary>
    [HttpGet("waiting")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> Waiting([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, CancellationToken ct = default)
        => (await _sender.Send(new GetWaitingReportQuery(fromDate, toDate), ct)).ToActionResult();

    /// <summary>تعداد نیروی انسانی در بازه، کنار تعداد خودروی سرویس‌شده</summary>
    [HttpGet("staffing")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> Staffing([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, CancellationToken ct = default)
        => (await _sender.Send(new GetStaffingReportQuery(fromDate, toDate), ct)).ToActionResult();

    /// <summary>گزارش درآمد لایه‌ای با مقایسه‌ی دوره‌ی قبل</summary>
    [HttpGet("revenue")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> Revenue([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate,
        [FromQuery] string bucket = "day", CancellationToken ct = default)
        => (await _sender.Send(new GetRevenueReportQuery(fromDate, toDate, bucket), ct)).ToActionResult();

    /// <summary>گزارش عملکرد کاربران — چه کسی چه کاری و چه ساعتی انجام داده</summary>
    [HttpGet("activity-log")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> ActivityLog([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate,
        [FromQuery] Guid? userId, [FromQuery] string? entityName,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
        => (await _sender.Send(new GetActivityLogQuery(fromDate, toDate, userId, entityName, page, pageSize), ct)).ToActionResult();

    [HttpGet("punctuality")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> Punctuality([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, CancellationToken ct = default)
        => (await _sender.Send(new GetPunctualityQuery(fromDate, toDate), ct)).ToActionResult();

    [HttpGet("worker-performance")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> WorkerPerformance([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, CancellationToken ct = default)
        => (await _sender.Send(new GetWorkerPerformanceQuery(fromDate, toDate), ct)).ToActionResult();
}
