import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState(1);
  const [formData, setFormData] = useState({
    workflowName: 'New Hire Contract',
    mFirstName: 'Jane',
    mLastName: 'Doe',
    mEmail: 'manager@example.com',
    eFirstName: 'John',
    eLastName: 'Smith',
    eEmail: 'employee@example.com',
    jobTitle: 'Senior Software Engineer',
    startDate: '2024-09-01',
    salary: '120,000',
    callbackUrl: 'https://webhook.site/placeholder'
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  
  // Modal State
  const [signingUrl, setSigningUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);



  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateContractPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('Employment Contract', 105, 30, null, null, 'center');
    doc.setFontSize(12);
    doc.text(`Employee Name: ${formData.eFirstName} ${formData.eLastName}`, 20, 50);
    doc.text(`Job Title: ${formData.jobTitle}`, 20, 60);
    doc.text(`Start Date: ${formData.startDate}`, 20, 70);
    doc.text(`Base Salary: $${formData.salary}`, 20, 80);
    doc.text('This document serves as the official employment agreement between the company', 20, 100);
    doc.text('and the employee. By signing below, both parties agree to the terms specified.', 20, 108);
    
    // For Tab 2 (Remote Only), the Manager is NOT embedded.
    const managerTag = activeTab === 2 ? 'RemoteSigner1' : 'SelfSign';
    const employeeTag = activeTab === 2 ? 'RemoteSigner2' : 'RemoteSigner';

    doc.text('Manager Signature:', 20, 140);
    doc.setTextColor(255, 255, 255);
    doc.text(managerTag, 20, 150);
    
    doc.setTextColor(0, 0, 0);
    doc.text('Employee Signature:', 120, 140);
    doc.setTextColor(255, 255, 255);
    doc.text(employeeTag, 120, 150);
    
    return doc.output('blob');
  };

  const generateNDA = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('Non-Disclosure Agreement', 105, 30, null, null, 'center');
    doc.setFontSize(12);
    doc.text(`This NDA is signed by the Manager on behalf of the company.`, 20, 50);
    doc.text(`It prohibits the disclosure of sensitive architecture plans.`, 20, 60);
    
    doc.text('Manager Signature (Authorized Representative):', 20, 100);
    doc.setTextColor(255, 255, 255);
    doc.text('SelfSign', 20, 110); // The manager has to sign this one too!

    return doc.output('blob');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const data = new FormData();
      data.append('workflowName', formData.workflowName);
      if (formData.callbackUrl) {
        data.append('callbackUrl', formData.callbackUrl);
      }

      let signers = [];

      if (activeTab === 1) {
        // SCENARIO 1: Embedded + Remote
        signers = [
          { roleId: "SelfSign", firstName: formData.mFirstName, lastName: formData.mLastName, email: formData.mEmail, signingOrder: 1 },
          { roleId: "RemoteSigner", firstName: formData.eFirstName, lastName: formData.eLastName, email: formData.eEmail, signingOrder: 2 }
        ];
        data.append('documents', generateContractPDF(), 'Contract.pdf');
      } 
      else if (activeTab === 2) {
        // SCENARIO 2: Remote Only
        signers = [
          { roleId: "RemoteSigner1", firstName: formData.mFirstName, lastName: formData.mLastName, email: formData.mEmail, signingOrder: 1 },
          { roleId: "RemoteSigner2", firstName: formData.eFirstName, lastName: formData.eLastName, email: formData.eEmail, signingOrder: 2 }
        ];
        data.append('documents', generateContractPDF(), 'Contract.pdf');
      }
      else if (activeTab === 3) {
        // SCENARIO 3: Multiple Documents
        signers = [
          { roleId: "SelfSign", firstName: formData.mFirstName, lastName: formData.mLastName, email: formData.mEmail, signingOrder: 1 },
          { roleId: "RemoteSigner", firstName: formData.eFirstName, lastName: formData.eLastName, email: formData.eEmail, signingOrder: 2 }
        ];
        // We append BOTH documents to the array!
        data.append('documents', generateContractPDF(), 'Contract.pdf');
        data.append('documents', generateNDA(), 'NDA.pdf');
      }

      data.append('signers', JSON.stringify(signers));

      console.log("==================================================");
      console.log("🚀 STEP 1: FRONTEND REQUEST TO C# SERVER");
      console.log("==================================================");
      console.log("Workflow Name:", formData.workflowName);
      console.log("Callback URL:", formData.callbackUrl || "None");
      console.log("Signers (JSON):", JSON.stringify(signers, null, 2));
      console.log("Attached Documents:", data.getAll('documents').map(file => file.name));
      console.log("--------------------------------------------------");

      // Make POST request to our Universal C# API
      const response = await fetch('http://localhost:5004/api/v1/Packages', {
        method: 'POST',
        headers: {
          'x-api-key': 'super-secret-key' // The new security key!
        },
        body: data
      });

      const result = await response.json();

      console.log("==================================================");
      console.log("📥 STEP 2: RESPONSE FROM C# SERVER");
      console.log("==================================================");
      console.log(JSON.stringify(result, null, 2));
      console.log("--------------------------------------------------");

      if (response.ok && result.success) {
        if (result.signingUrl) {
          console.log("==================================================");
          console.log("🖼️ STEP 3: OPENING ONESPAN MODAL");
          console.log("==================================================");
          console.log("Session URL:", result.signingUrl);
          
          setSigningUrl(result.signingUrl);
          setIsModalOpen(true);
        } else {
          setStatus({ type: 'success', message: 'Document sent successfully! (No embedded signing required).' });
        }
      } else {
        setStatus({ type: 'error', message: result.error || result.details || 'Failed to create transaction.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Network error connecting to API. Is the C# server running?' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event) => {
      let dataStr = '';
      try { dataStr = typeof event.data === 'object' ? JSON.stringify(event.data) : String(event.data); } 
      catch (e) { dataStr = "Unknown Event"; }



      if (dataStr.includes('ESL:MESSAGE:SUCCESS:SIGNER_COMPLETE') || dataStr.includes('PACKAGE_COMPLETE')) {
        setIsModalOpen(false);
        setSigningUrl('');
        setStatus({ type: 'success', message: 'Signed successfully! It has now been routed to the next signer.' });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);



  return (
    <div className="app-container">
      <header>
        <h1>Universal C# Test Suite</h1>
        <p>Select a scenario to test the universal capabilities of the C# Microservice.</p>
      </header>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>1. Classic Embedded</button>
        <button className={`tab-btn ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>2. Remote Only</button>
        <button className={`tab-btn ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>3. Multi-Document</button>
      </div>

      {activeTab === 1 && <div className="scenario-desc"><strong>Scenario 1:</strong> Manager signs right now in a pop-up. Employee signs later via email. Generates 1 PDF.</div>}
      {activeTab === 2 && <div className="scenario-desc"><strong>Scenario 2:</strong> Both Manager and Employee sign later via email. No pop-ups. Generates 1 PDF.</div>}
      {activeTab === 3 && <div className="scenario-desc"><strong>Scenario 3:</strong> Manager signs a Contract AND an NDA right now in a pop-up. Generates 2 distinct PDFs dynamically!</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>📝 Contract Terms</h2>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Transaction Name</label>
              <input type="text" name="workflowName" value={formData.workflowName} onChange={handleInputChange} required />
            </div>
            <div className="form-group full-width">
              <label>Job Title</label>
              <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input type="text" name="startDate" value={formData.startDate} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>Base Salary</label>
              <input type="text" name="salary" value={formData.salary} onChange={handleInputChange} required />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>💼 Manager Details</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name</label>
              <input type="text" name="mFirstName" value={formData.mFirstName} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" name="mLastName" value={formData.mLastName} onChange={handleInputChange} required />
            </div>
            <div className="form-group full-width">
              <label>Email Address</label>
              <input type="email" name="mEmail" value={formData.mEmail} onChange={handleInputChange} required />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>👤 Employee Details</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name</label>
              <input type="text" name="eFirstName" value={formData.eFirstName} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" name="eLastName" value={formData.eLastName} onChange={handleInputChange} required />
            </div>
            <div className="form-group full-width">
              <label>Email Address</label>
              <input type="email" name="eEmail" value={formData.eEmail} onChange={handleInputChange} required />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>⚙️ Advanced Settings</h2>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Callback URL (Where to deliver the final PDF ZIP)</label>
              <input type="text" name="callbackUrl" value={formData.callbackUrl} onChange={handleInputChange} placeholder="https://webhook.site/..." />
            </div>
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Generating PDFs & Processing...' : 'Run Scenario'}
        </button>
      </form>

      {status.message && (
        <div className={`status-message status-${status.type}`}>
          {status.message}
        </div>
      )}



      {/* Embedded Signing Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Sign Document</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <iframe 
              className="signing-iframe" 
              src={signingUrl} 
              title="OneSpan Signing Ceremony"
            />
            <div style={{ padding: '10px', textAlign: 'center', backgroundColor: '#f8d7da', color: '#721c24' }}>
               <p>If the Next button inside the iframe above is stuck, your browser might be blocking third-party cookies.</p>
               <a href={signingUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 'bold', color: '#721c24' }}>
                  Click here to open the document safely in a new tab!
               </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
