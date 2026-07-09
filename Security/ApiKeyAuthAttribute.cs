using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

namespace OneSpanESignatureService.Security
{
    public class ApiKeyAuthAttribute : IAsyncActionFilter
    {
        private const string ApiKeyHeaderName = "x-api-key";
        private readonly IConfiguration _configuration;

        public ApiKeyAuthAttribute(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (!context.HttpContext.Request.Headers.TryGetValue(ApiKeyHeaderName, out var extractedApiKey))
            {
                context.Result = new UnauthorizedObjectResult(new { error = "API Key is missing" });
                return;
            }

            var configuredApiKey = _configuration["App:ApiKey"];

            if (string.IsNullOrEmpty(configuredApiKey) || !configuredApiKey.Equals(extractedApiKey))
            {
                context.Result = new UnauthorizedObjectResult(new { error = "Unauthorized client" });
                return;
            }

            await next();
        }
    }
}
