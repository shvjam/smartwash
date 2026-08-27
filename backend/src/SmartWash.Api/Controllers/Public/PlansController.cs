using SmartWash.Application.Modules.Plans.List;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Public;

[ApiController]
[Route("api/public/plans")]
public sealed class PlansController : ControllerBase
{
    private readonly ISender _sender;
    public PlansController(ISender sender) => _sender = sender;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var result = await _sender.Send(new ListPlansQuery(OnlyPublic: true), ct);
        return result.IsSuccess ? Ok(result.Value) : Problem(statusCode: 400, title: result.Error.Code, detail: result.Error.Message);
    }
}
