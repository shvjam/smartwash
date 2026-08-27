using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Expenses;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/expenses")]
public sealed class ExpensesController : ControllerBase
{
    private readonly ISender _sender;
    public ExpensesController(ISender sender) => _sender = sender;

    public sealed record CreateExpenseRequest(Guid BranchId, ExpenseCategory Category, string Title, long AmountRials,
        PaymentMethod PaymentMethod, DateOnly Date, string? Description, Guid? RelatedWorkerId);
    public sealed record UpdateExpenseRequest(ExpenseCategory Category, string Title, long AmountRials,
        PaymentMethod PaymentMethod, DateOnly Date, string? Description);

    [HttpGet]
    [HasPermission(Permissions.ExpensesManage)]
    public async Task<IActionResult> Search([FromQuery] Guid? branchId, [FromQuery] ExpenseCategory? category,
        [FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate,
        [FromQuery] int page = 1, [FromQuery] int pageSize = AppConstants.DefaultPageSize, CancellationToken ct = default)
        => (await _sender.Send(new SearchExpensesQuery(branchId, category, fromDate, toDate, page, pageSize), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.ExpensesManage)]
    public async Task<IActionResult> Create([FromBody] CreateExpenseRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateExpenseCommand(req.BranchId, req.Category, req.Title, req.AmountRials,
            req.PaymentMethod, req.Date, req.Description, req.RelatedWorkerId), ct)).ToCreatedResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.ExpensesManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExpenseRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateExpenseCommand(id, req.Category, req.Title, req.AmountRials,
            req.PaymentMethod, req.Date, req.Description), ct)).ToActionResult();
}
