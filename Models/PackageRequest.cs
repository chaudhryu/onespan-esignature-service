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

        [FromForm(Name = "document")]
        public IFormFile? Document { get; set; }
    }
}
