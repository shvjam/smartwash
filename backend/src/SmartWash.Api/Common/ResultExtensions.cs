using SmartWash.Shared.Results;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Common;

public static class ResultExtensions
{
    public static IActionResult ToActionResult<T>(this Result<T> result)
        => result.IsSuccess
            ? new OkObjectResult(result.Value)
            : ErrorToActionResult(result.Error);

    public static IActionResult ToActionResult(this Result result)
        => result.IsSuccess
            ? new NoContentResult()
            : ErrorToActionResult(result.Error);

    public static IActionResult ToCreatedResult<T>(this Result<T> result, string? location = null)
        => result.IsSuccess
            ? new ObjectResult(result.Value) { StatusCode = StatusCodes.Status201Created }
            : ErrorToActionResult(result.Error);

    private static IActionResult ErrorToActionResult(Error error)
    {
        var payload = new { code = error.Code, message = error.Message };
        return error.Type switch
        {
            ErrorType.NotFound => new NotFoundObjectResult(payload),
            ErrorType.Unauthorized => new UnauthorizedObjectResult(payload),
            ErrorType.Forbidden => new ObjectResult(payload) { StatusCode = StatusCodes.Status403Forbidden },
            ErrorType.Conflict => new ConflictObjectResult(payload),
            ErrorType.Validation => new UnprocessableEntityObjectResult(payload),
            _ => new BadRequestObjectResult(payload)
        };
    }
}
