const oneSpanService = require('../services/onespanService');

exports.createSignatureTransaction = async (req, res) => {
  try {
    const { workflowName, signers } = req.body;
    const file = req.file; // Populated by multer middleware

    if (!file || !signers || !workflowName) {
      return res.status(400).json({ error: 'Missing required fields or document file.' });
    }

    // Parse signers string back into an object if passed as form-data
    const parsedSigners = typeof signers === 'string' ? JSON.parse(signers) : signers;

    // Orchestrate the OneSpan sequence
    const packageId = await oneSpanService.createDraftPackage(workflowName, parsedSigners);
    await oneSpanService.uploadDocument(packageId, file.buffer, file.originalname);
    await oneSpanService.sendPackage(packageId);

    return res.status(201).json({
      success: true,
      message: 'Signature transaction successfully initialized and sent.',
      packageId: packageId
    });
  } catch (error) {
    console.error('Error initiating OneSpan transaction:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to create signature transaction.',
      details: error.response?.data || error.message
    });
  }
};