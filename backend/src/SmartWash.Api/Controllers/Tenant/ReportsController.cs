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

    [HttpGet("worker-performance")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> WorkerPerformance([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, CancellationToken ct = default)
        => (await _sender.Send(new GetWorkerPerformanceQuery(fromDate, toDate), ct)).ToActionResult();
}
