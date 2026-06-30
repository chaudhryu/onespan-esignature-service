const axios = require('axios');
const { oneSpanApiKey, oneSpanApiUrl } = require('../config/environment');

class OneSpanService {
  constructor() {
    this.client = axios.create({
      baseURL: oneSpanApiUrl,
      headers: {
        'Authorization': `Basic ${oneSpanApiKey}`,
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Step 1: Create a Draft Package
   */
  async createDraftPackage(name, signers) {
    // Map internal application signer format to OneSpan Roles schema
    const roles = signers.map((signer, index) => ({
      id: `Signer${index + 1}`,
      type: 'SIGNER',
      signers: [{
        firstName: signer.firstName,
        lastName: signer.lastName,
        email: signer.email
      }]
    }));

    const payload = {
      name: name,
      status: 'DRAFT',
      roles: roles
    };

    const response = await this.client.post('/packages', payload);
    return response.data.id; // Returns the unique packageId
  }

  /**
   * Step 2: Upload a Document to the Package
   * (Accepts a file buffer, original filename, and location layout data)
   */
  async uploadDocument(packageId, fileBuffer, fileName, extractionData) {
    const FormData = require('form-data');
    const form = new FormData();

    // Appending binary data requires a specified filename
    form.append('file', fileBuffer, { filename: fileName });

    // Define where signature fields are placed on the document
    const documentPayload = {
      name: fileName,
      extract: true, // Set to true if utilizing OneSpan document extraction tags
      fields: extractionData || []
    };

    form.append('payload', JSON.stringify(documentPayload));

    const response = await this.client.post(
      `/packages/${packageId}/documents`,
      form,
      { headers: form.getHeaders() }
    );
    return response.data;
  }

  /**
   * Step 3: Activate and Send the Package
   */
  async sendPackage(packageId) {
    const response = await this.client.put(`/packages/${packageId}`, {
      status: 'SENT'
    });
    return response.data;
  }
}

module.exports = new OneSpanService();