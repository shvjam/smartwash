using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Customers;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/customers")]
public sealed class CustomersController : ControllerBase
{
    private readonly ISender _sender;
    public CustomersController(ISender sender) => _sender = sender;

    public sealed record CreateCustomerRequest(string FullName, string Phone, string? Email);
    public sealed record UpdateCustomerRequest(string FullName, string Phone, string? Email, string? NationalId, DateOnly? BirthDate, Gender Gender, string? Address, string? Notes);
    public sealed record AddVehicleRequest(string Plate, string Brand, string Model, string? Color, int? Year);
    public sealed record AdjustWalletRequest(long AmountRials, string? Description);
    public sealed record AdjustLoyaltyRequest(int Points, string? Description);

    [HttpGet]
    [HasPermission(Permissions.CustomersRead)]
    public async Task<IActionResult> Search([FromQuery] string? search = null, [FromQuery] LoyaltyTier? tier = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = AppConstants.DefaultPageSize, CancellationToken ct = default)
        => (await _sender.Send(new SearchCustomersQuery(search, tier, page, pageSize), ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.CustomersRead)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetCustomerQuery(id), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.CustomersManage)]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateCustomerCommand(req.FullName, req.Phone, req.Email), ct)).ToCreatedResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.CustomersManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateCustomerCommand(id, req.FullName, req.Phone, req.Email, req.NationalId, req.BirthDate, req.Gender, req.Address, req.Notes), ct)).ToActionResult();

    [HttpPost("{id:guid}/vehicles")]
    [HasPermission(Permissions.CustomersManage)]
    public async Task<IActionResult> AddVehicle(Guid id, [FromBody] AddVehicleRequest req, CancellationToken ct)
        => (await _sender.Send(new AddCustomerVehicleCommand(id, req.Plate, req.Brand, req.Model, req.Color, req.Year), ct)).ToCreatedResult();

    [HttpDelete("{id:guid}/vehicles/{vehicleId:guid}")]
    [HasPermission(Permissions.CustomersManage)]
    public async Task<IActionResult> RemoveVehicle(Guid id, Guid vehicleId, CancellationToken ct)
        => (await _sender.Send(new RemoveCustomerVehicleCommand(id, vehicleId), ct)).ToActionResult();

    [HttpPost("{id:guid}/wallet/adjust")]
    [HasPermission(Permissions.WalletManage)]
    public async Task<IActionResult> AdjustWallet(Guid id, [FromBody] AdjustWalletRequest req, CancellationToken ct)
        => (await _sender.Send(new AdjustWalletCommand(id, req.AmountRials, req.Description), ct)).ToActionResult();

    [HttpPost("{id:guid}/loyalty/adjust")]
    [HasPermission(Permissions.LoyaltyManage)]
    public async Task<IActionResult> AdjustLoyalty(Guid id, [FromBody] AdjustLoyaltyRequest req, CancellationToken ct)
        => (await _sender.Send(new AdjustLoyaltyCommand(id, req.Points, req.Description), ct)).ToActionResult();

    [HttpGet("{id:guid}/wallet/transactions")]
    [HasPermission(Permissions.CustomersRead)]
    public async Task<IActionResult> WalletTransactions(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken ct = default)
        => (await _sender.Send(new ListWalletTxQuery(id, page, pageSize), ct)).ToActionResult();

    [HttpGet("{id:guid}/loyalty/transactions")]
    [HasPermission(Permissions.CustomersRead)]
    public async Task<IActionResult> LoyaltyTransactions(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken ct = default)
        => (await _sender.Send(new ListLoyaltyTxQuery(id, page, pageSize), ct)).ToActionResult();

    [HttpGet("{id:guid}/orders")]
    [HasPermission(Permissions.CustomersRead)]
    public async Task<IActionResult> Orders(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken ct = default)
        => (await _sender.Send(new ListCustomerOrdersQuery(id, page, pageSize), ct)).ToActionResult();
}
