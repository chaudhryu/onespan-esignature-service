using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using OneSpanSign.Sdk;
using OneSpanSign.Sdk.Builder;
using OneSpanESignatureService.Models;

namespace OneSpanESignatureService.Services
{
    public interface IOneSpanService
    {
        Task<(string PackageId, string SigningUrl)> CreateAndSendSignatureTransactionAsync(string workflowName, List<SignerInfo> signers, List<IFormFile> documents, string? callbackUrl = null);
        Task ProcessCompletedPackageAsync(string packageIdStr);
    }

    public class OneSpanService : IOneSpanService
    {
        private readonly OssClient _ossClient;
        private readonly string _apiUrl;

        public OneSpanService(IConfiguration configuration)
        {
            string apiKey = configuration["OneSpan:ApiKey"] ?? throw new System.ArgumentNullException("OneSpan:ApiKey is missing");
            _apiUrl = configuration["OneSpan:ApiUrl"] ?? throw new System.ArgumentNullException("OneSpan:ApiUrl is missing");
            _ossClient = new OssClient(apiKey, _apiUrl);
        }

        public async Task<(string PackageId, string SigningUrl)> CreateAndSendSignatureTransactionAsync(string workflowName, List<SignerInfo> signers, List<IFormFile> documents, string? callbackUrl = null)
        {
            // Build the package
            PackageBuilder packageBuilder = PackageBuilder.NewPackageNamed(workflowName)
                .WithStatus(DocumentPackageStatus.DRAFT);

            if (!string.IsNullOrWhiteSpace(callbackUrl))
            {
                packageBuilder.WithAttributes(new DocumentPackageAttributesBuilder()
                    .WithAttribute("CallbackUrl", callbackUrl)
                    .Build());
            }

            // Add signers
            for (int i = 0; i < signers.Count; i++)
            {
                var signer = signers[i];
                string roleId = !string.IsNullOrWhiteSpace(signer.RoleId) ? signer.RoleId : $"Signer{i + 1}";

                var signerBuilder = SignerBuilder.NewSignerWithEmail(signer.Email)
                    .WithFirstName(signer.FirstName)
                    .WithLastName(signer.LastName)
                    .WithCustomId(roleId);

                if (signer.SigningOrder > 0)
                {
                    signerBuilder.SigningOrder(signer.SigningOrder);
                }

                packageBuilder.WithSigner(signerBuilder);
            }

            // Build the documents
            foreach (var document in documents)
            {
                using var stream = new MemoryStream();
                await document.CopyToAsync(stream);
                stream.Position = 0;

                byte[] documentBytes = stream.ToArray();

                DocumentBuilder documentBuilder = DocumentBuilder.NewDocumentNamed(document.FileName)
                    .FromStream(new MemoryStream(documentBytes), DocumentType.PDF);

                // Universally extract signatures by looking for invisible anchor text that exactly matches the RoleId.
                for (int i = 0; i < signers.Count; i++)
                {
                    var signer = signers[i];
                    string roleId = !string.IsNullOrWhiteSpace(signer.RoleId) ? signer.RoleId : $"Signer{i + 1}";

                    documentBuilder.WithSignature(SignatureBuilder.SignatureFor(signer.Email)
                        .WithPositionAnchor(TextAnchorBuilder.NewTextAnchor(roleId)
                            .AtPosition(TextAnchorPosition.TOPLEFT)
                            .WithSize(200, 50)
                            .WithOffset(0, -25)));
                }

                packageBuilder.WithDocument(documentBuilder);
            }

            // Create package
            DocumentPackage documentPackage = packageBuilder.Build();
            PackageId packageId = _ossClient.CreatePackageOneStep(documentPackage);

            // Send package
            _ossClient.SendPackage(packageId);

            // Conditionally generate a Signing URL ONLY if the Frontend requested an embedded session via "SelfSign"
            string signingUrl = string.Empty;
            var selfSigner = signers.Find(s => s.RoleId == "SelfSign");
            
            if (selfSigner != null)
            {
                string token = _ossClient.AuthenticationTokenService.CreateSignerAuthenticationToken(packageId, "SelfSign");
                string apiUrlBase = _apiUrl.Replace("/api", "");
                signingUrl = $"{apiUrlBase}/access?sessionToken={token}";
            }

            return (packageId.Id, signingUrl);
        }

        public async Task ProcessCompletedPackageAsync(string packageIdStr)
        {
            try
            {
                PackageId packageId = new PackageId(packageIdStr);
                DocumentPackage package = _ossClient.GetPackage(packageId);

                // Check if this package has a CallbackUrl hidden in its attributes
                if (package.Attributes != null && package.Attributes.Contents.TryGetValue("CallbackUrl", out object? callbackObj) && callbackObj != null)
                {
                    string callbackUrl = callbackObj.ToString()!;
                    
                    // Download the signed PDFs as a ZIP from OneSpan
                    byte[] zippedDocs = _ossClient.DownloadZippedDocuments(packageId);

                    // Forward the PDFs to the Callback URL!
                    using var httpClient = new System.Net.Http.HttpClient();
                    
                    int maxRetries = 3;
                    int[] retryDelays = { 10000, 30000, 60000 }; // 10s, 30s, 60s
                    
                    for (int i = 0; i < maxRetries; i++)
                    {
                        try
                        {
                            using var content = new System.Net.Http.MultipartFormDataContent();
                            var fileContent = new System.Net.Http.ByteArrayContent(zippedDocs);
                            content.Add(fileContent, "document", $"signed_package_{packageIdStr}.zip");

                            var response = await httpClient.PostAsync(callbackUrl, content);
                            if (response.IsSuccessStatusCode)
                            {
                                System.Console.WriteLine($"Successfully forwarded PDF to {callbackUrl} on attempt {i+1}!");
                                break;
                            }
                            else
                            {
                                System.Console.WriteLine($"Webhook POST failed with status: {response.StatusCode}");
                            }
                        }
                        catch (System.Exception ex)
                        {
                            System.Console.WriteLine($"Webhook POST threw exception: {ex.Message}");
                        }
                        
                        if (i < maxRetries - 1)
                        {
                            System.Console.WriteLine($"Retrying in {retryDelays[i]/1000} seconds...");
                            await Task.Delay(retryDelays[i]);
                        }
                    }
                }
            }
            catch (System.Exception ex)
            {
                // In production, log this error
                System.Console.WriteLine($"Error processing webhook delivery: {ex.Message}");
            }
        }
    }
}
