using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Collections.Generic;
using System;

namespace OneSpanESignatureService.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class WebhooksController : ControllerBase
    {
        private readonly Services.IOneSpanService _oneSpanService;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
        // Static list to store the last 20 webhooks in memory for testing
        private static readonly List<object> _webhookEvents = new();

        public WebhooksController(Services.IOneSpanService oneSpanService, Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _oneSpanService = oneSpanService;
            _configuration = configuration;
        }

        [HttpPost("onespan")]
        public IActionResult ReceiveOneSpanWebhook([FromBody] JsonElement payload)
        {
            var configuredWebhookKey = _configuration["OneSpan:WebhookKey"];
            if (!string.IsNullOrEmpty(configuredWebhookKey))
            {
                if (!Request.Headers.TryGetValue("X-OneSpan-Callback-Key", out var extractedKey) || extractedKey != configuredWebhookKey)
                {
                    return Unauthorized(new { error = "Invalid or missing Webhook Key" });
                }
            }

            var eventData = new
            {
                ReceivedAt = DateTime.UtcNow,
                Payload = payload
            };

            // Add to the top of the list (thread-safe lock for static list)
            lock (_webhookEvents)
            {
                _webhookEvents.Insert(0, eventData);
                if (_webhookEvents.Count > 20)
                {
                    _webhookEvents.RemoveAt(20);
                }
            }

            // Trigger Universal PDF Delivery if this is a completion event
            if (payload.TryGetProperty("name", out var nameProp) && nameProp.GetString() == "PACKAGE_COMPLETE" &&
                payload.TryGetProperty("packageId", out var pkgIdProp))
            {
                string packageId = pkgIdProp.GetString()!;
                
                // Fire and forget so we can respond to OneSpan quickly
                _ = _oneSpanService.ProcessCompletedPackageAsync(packageId);
            }

            return Ok(new { success = true });
        }

        [HttpGet("events")]
        public IActionResult GetRecentWebhooks()
        {
            lock (_webhookEvents)
            {
                return Ok(_webhookEvents);
            }
        }
    }
}
