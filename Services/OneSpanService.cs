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
        Task<string> CreateAndSendSignatureTransactionAsync(string workflowName, List<SignerInfo> signers, IFormFile document);
    }

    public class OneSpanService : IOneSpanService
    {
        private readonly OssClient _ossClient;

        public OneSpanService(IConfiguration configuration)
        {
            string apiKey = configuration["OneSpan:ApiKey"] ?? throw new System.ArgumentNullException("OneSpan:ApiKey is missing");
            string apiUrl = configuration["OneSpan:ApiUrl"] ?? throw new System.ArgumentNullException("OneSpan:ApiUrl is missing");
            _ossClient = new OssClient(apiKey, apiUrl);
        }

        public async Task<string> CreateAndSendSignatureTransactionAsync(string workflowName, List<SignerInfo> signers, IFormFile document)
        {
            // Build the package
            PackageBuilder packageBuilder = PackageBuilder.NewPackageNamed(workflowName)
                .WithStatus(DocumentPackageStatus.DRAFT);

            // Add signers
            for (int i = 0; i < signers.Count; i++)
            {
                var signer = signers[i];
                string roleId = $"Signer{i + 1}";

                packageBuilder.WithSigner(SignerBuilder.NewSignerWithEmail(signer.Email)
                    .WithFirstName(signer.FirstName)
                    .WithLastName(signer.LastName)
                    .WithCustomId(roleId)
                    .Replacing(new Placeholder(roleId)));
            }

            // Build the document
            using var stream = new MemoryStream();
            await document.CopyToAsync(stream);
            stream.Position = 0;

            byte[] documentBytes = stream.ToArray();

            DocumentBuilder documentBuilder = DocumentBuilder.NewDocumentNamed(document.FileName)
                .FromStream(new MemoryStream(documentBytes), DocumentType.PDF)
                .EnableExtraction(); // The old node code set extract: true

            packageBuilder.WithDocument(documentBuilder);

            // Create package
            DocumentPackage documentPackage = packageBuilder.Build();
            PackageId packageId = _ossClient.CreatePackageOneStep(documentPackage);

            // Send package
            _ossClient.SendPackage(packageId);

            return packageId.Id;
        }
    }
}
