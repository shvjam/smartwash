using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Tips;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

/// <summary>انعام پرسنل — مانده‌ی پرداخت‌نشده و تسویه‌ها</summary>
[ApiController]
[Route("api/tips")]
[Authorize]
public sealed class TipsController : ControllerBase
{
    private readonly ISender _sender;
    public TipsController(ISender sender) => _sender = sender;

    public sealed record SettleRequest(Guid WorkerId, Guid BranchId, DateTime ThroughUtc, long PaidRials, string? Note);

    /// <summary>چه کسی چقدر انعام پرداخت‌نشده دارد و آخرین تسویه‌اش کی بوده</summary>
    [HttpGet("ledger")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<IActionResult> Ledger([FromQuery] Guid? branchId, CancellationToken ct = default)
        => (await _sender.Send(new GetTipLedgerQuery(branchId), ct)).ToActionResult();

    /// <summary>ثبت تسویه‌ی انعام با یک پرسنل تا یک تاریخ مشخص</summary>
    [HttpPost("settle")]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Settle([FromBody] SettleRequest req, CancellationToken ct)
        => (await _sender.Send(new SettleTipsCommand(req.WorkerId, req.BranchId, req.ThroughUtc, req.PaidRials, req.Note), ct)).ToActionResult();
}
