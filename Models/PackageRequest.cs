using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace OneSpanESignatureService.Models
{
    public class PackageRequest
    {
        [FromForm(Name = "workflowName")]
        public string WorkflowName { get; set; } = string.Empty;

        [FromForm(Name = "signers")]
        public string SignersJson { get; set; } = string.Empty;

        [FromForm(Name = "documents")]
        public System.Collections.Generic.List<IFormFile>? Documents { get; set; }

        [FromForm(Name = "callbackUrl")]
        public string? CallbackUrl { get; set; }
    }
}
