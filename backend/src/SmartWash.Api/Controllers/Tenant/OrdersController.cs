using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Orders;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly ISender _sender;
    public OrdersController(ISender sender) => _sender = sender;

    public sealed record CreateOrderRequest(Guid BranchId, Guid BayId, Guid? CustomerId, Guid? VehicleId,
        string CustomerName, string? CustomerPhone, string VehiclePlate, string? VehicleBrand, string? VehicleModel,
        OrderSource Source, Guid? ReservationId, IReadOnlyList<CreateOrderLineInput> Lines);
    public sealed record AddLineRequest(Guid ServiceId, int Quantity, Guid? WorkerId);
    public sealed record DiscountRequest(long DiscountRials);
    public sealed record PaymentRequest(PaymentMethod Method, long AmountRials, string? Reference);
    public sealed record CompleteRequest(PaymentMethod FinalMethod);
    public sealed record CancelRequest(string? Reason);
    public sealed record SetTipRequest(long TipRials);
    public sealed record AssignWorkerRequest(Guid WorkerId);

    [HttpGet]
    [HasPermission(Permissions.OrdersRead)]
    public async Task<IActionResult> Search([FromQuery] Guid? branchId, [FromQuery] OrderStatus? status,
        [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = AppConstants.DefaultPageSize, CancellationToken ct = default)
        => (await _sender.Send(new SearchOrdersQuery(branchId, status, fromUtc, toUtc, search, page, pageSize), ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.OrdersRead)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetOrderQuery(id), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateOrderCommand(req.BranchId, req.BayId, req.CustomerId, req.VehicleId,
            req.CustomerName, req.CustomerPhone, req.VehiclePlate, req.VehicleBrand, req.VehicleModel,
            req.Source, req.ReservationId, req.Lines), ct)).ToCreatedResult();

    [HttpPost("{id:guid}/lines")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> AddLine(Guid id, [FromBody] AddLineRequest req, CancellationToken ct)
        => (await _sender.Send(new AddOrderLineCommand(id, req.ServiceId, req.Quantity, req.WorkerId), ct)).ToActionResult();

    [HttpDelete("{id:guid}/lines/{lineId:guid}")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> RemoveLine(Guid id, Guid lineId, CancellationToken ct)
        => (await _sender.Send(new RemoveOrderLineCommand(id, lineId), ct)).ToActionResult();

    [HttpPost("{id:guid}/discount")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> ApplyDiscount(Guid id, [FromBody] DiscountRequest req, CancellationToken ct)
        => (await _sender.Send(new ApplyDiscountCommand(id, req.DiscountRials), ct)).ToActionResult();

    [HttpPost("{id:guid}/payments")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] PaymentRequest req, CancellationToken ct)
        => (await _sender.Send(new AddOrderPaymentCommand(id, req.Method, req.AmountRials, req.Reference), ct)).ToActionResult();

    [HttpPost("{id:guid}/complete")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteRequest req, CancellationToken ct)
        => (await _sender.Send(new CompleteOrderCommand(id, req.FinalMethod), ct)).ToActionResult();

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelRequest req, CancellationToken ct)
        => (await _sender.Send(new CancelOrderCommand(id, req.Reason), ct)).ToActionResult();

    // انعام — هر لاین به‌صورت مستقل
    [HttpPatch("{id:guid}/lines/{lineId:guid}/tip")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> SetTip(Guid id, Guid lineId, [FromBody] SetTipRequest req, CancellationToken ct)
        => (await _sender.Send(new SetLineTipCommand(id, lineId, req.TipRials), ct)).ToActionResult();

    // تخصیص کارگر بدون حذف و بازاضافه
    [HttpPatch("{id:guid}/lines/{lineId:guid}/worker")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> AssignWorker(Guid id, Guid lineId, [FromBody] AssignWorkerRequest req, CancellationToken ct)
        => (await _sender.Send(new AssignLineWorkerCommand(id, lineId, req.WorkerId), ct)).ToActionResult();

    // خدمت رایگان وفاداری
    [HttpPost("{id:guid}/loyalty-free")]
    [HasPermission(Permissions.OrdersManage)]
    public async Task<IActionResult> ApplyLoyaltyFree(Guid id, CancellationToken ct)
        => (await _sender.Send(new ApplyLoyaltyFreeCommand(id), ct)).ToActionResult();
}
