using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using OneSpanESignatureService.Models;
using OneSpanESignatureService.Services;

namespace OneSpanESignatureService.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [ServiceFilter(typeof(Security.ApiKeyAuthAttribute))]
    public class PackagesController : ControllerBase
    {
        private readonly IOneSpanService _oneSpanService;

        public PackagesController(IOneSpanService oneSpanService)
        {
            _oneSpanService = oneSpanService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateSignatureTransaction([FromForm] PackageRequest request)
        {
            try
            {
                if (request.Documents == null || request.Documents.Count == 0 || string.IsNullOrWhiteSpace(request.WorkflowName) || string.IsNullOrWhiteSpace(request.SignersJson))
                {
                    return BadRequest(new { error = "Missing required fields or document files." });
                }

                // Parse signers
                List<SignerInfo>? signers = null;
                try
                {
                    signers = JsonSerializer.Deserialize<List<SignerInfo>>(request.SignersJson);
                }
                catch (Exception)
                {
                    return BadRequest(new { error = "Invalid signers JSON format." });
                }

                if (signers == null || signers.Count == 0)
                {
                    return BadRequest(new { error = "Signers list cannot be empty." });
                }

                var result = await _oneSpanService.CreateAndSendSignatureTransactionAsync(
                    request.WorkflowName, 
                    signers, 
                    request.Documents,
                    request.CallbackUrl);

                return Created(string.Empty, new
                {
                    success = true,
                    message = "Signature transaction successfully initialized and sent.",
                    packageId = result.PackageId,
                    signingUrl = result.SigningUrl
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    error = "Failed to create signature transaction.",
                    details = ex.Message
                });
            }
        }
    }
}
