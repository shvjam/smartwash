using SmartWash.Application.Modules.Onboarding;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/onboarding")]
public sealed class OnboardingController : ControllerBase
{
    private readonly ISender _sender;
    public OnboardingController(ISender sender) => _sender = sender;

    public sealed record CompleteStepRequest(int Step);

    [HttpGet("state")]
    public async Task<IActionResult> State(CancellationToken ct)
    {
        var result = await _sender.Send(new GetOnboardingStateQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { result.Error.Code, result.Error.Message });
    }

    [HttpPost("complete-step")]
    public async Task<IActionResult> CompleteStep([FromBody] CompleteStepRequest req, CancellationToken ct)
    {
        var result = await _sender.Send(new CompleteOnboardingStepCommand(req.Step), ct);
        if (result.IsSuccess) return Ok(new { ok = true });
        return result.Error.Type switch
        {
            ErrorType.NotFound => NotFound(new { result.Error.Code, result.Error.Message }),
            ErrorType.Validation => UnprocessableEntity(new { result.Error.Code, result.Error.Message }),
            _ => BadRequest(new { result.Error.Code, result.Error.Message })
        };
    }
}
