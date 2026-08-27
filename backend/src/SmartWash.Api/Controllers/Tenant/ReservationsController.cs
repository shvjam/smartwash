using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Reservations;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/reservations")]
public sealed class ReservationsController : ControllerBase
{
    private readonly ISender _sender;
    public ReservationsController(ISender sender) => _sender = sender;

    public sealed record CreateReservationRequest(Guid BranchId, Guid? CustomerId, string CustomerName, string CustomerPhone,
        string VehiclePlate, string? VehicleBrand, string? VehicleModel, DateTime ScheduledAtUtc, Guid? PreferredBayId, string? Notes,
        IReadOnlyList<CreateReservationServiceInput> Services);
    public sealed record CancelRequest(string? Reason);

    [HttpGet]
    [HasPermission(Permissions.ReservationsManage)]
    public async Task<IActionResult> Search([FromQuery] Guid? branchId, [FromQuery] ReservationStatus? status,
        [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc,
        [FromQuery] int page = 1, [FromQuery] int pageSize = AppConstants.DefaultPageSize, CancellationToken ct = default)
        => (await _sender.Send(new SearchReservationsQuery(branchId, status, fromUtc, toUtc, page, pageSize), ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.ReservationsManage)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetReservationQuery(id), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.ReservationsManage)]
    public async Task<IActionResult> Create([FromBody] CreateReservationRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateReservationCommand(req.BranchId, req.CustomerId, req.CustomerName, req.CustomerPhone,
            req.VehiclePlate, req.VehicleBrand, req.VehicleModel, req.ScheduledAtUtc, req.PreferredBayId, req.Notes, req.Services), ct)).ToCreatedResult();

    [HttpPost("{id:guid}/confirm")]
    [HasPermission(Permissions.ReservationsManage)]
    public async Task<IActionResult> Confirm(Guid id, CancellationToken ct)
        => (await _sender.Send(new ConfirmReservationCommand(id), ct)).ToActionResult();

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.ReservationsManage)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelRequest req, CancellationToken ct)
        => (await _sender.Send(new CancelReservationCommand(id, req.Reason), ct)).ToActionResult();

    [HttpPost("{id:guid}/no-show")]
    [HasPermission(Permissions.ReservationsManage)]
    public async Task<IActionResult> NoShow(Guid id, CancellationToken ct)
        => (await _sender.Send(new MarkNoShowCommand(id), ct)).ToActionResult();
}
