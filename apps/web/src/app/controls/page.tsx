'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Framework {
  id: string;
  name: string;
  version: string;
  description: string;
  created_at: string;
}

interface Control {
  id: string;
  code: string;
  title: string;
  description: string;
  requirements_count: number;
  linked_documents_count: number;
  created_at: string;
}

interface LinkedDocument {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  download_url: string;
  confidence: number;
  reasoning: string;
  link_created_at: string;
  link_id?: string;
  is_ai_linked?: boolean;
}

function LinkedDocuments({ controlId }: { controlId: string }) {
  const [documents, setDocuments] = useState<LinkedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/controls/${controlId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch linked documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeLink = async (linkId: string, filename: string) => {
    if (!confirm(`Remove AI link for "${filename}"?\n\nThis will unlink the document from this control.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/document-control-links/${linkId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh documents list
        await fetchDocuments();
        alert('Link removed successfully');
      } else {
        throw new Error('Failed to remove link');
      }
    } catch (error) {
      console.error('Failed to remove link:', error);
      alert('Failed to remove link. Please try again.');
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [controlId]);

  if (loading) {
    return <div className="text-xs text-gray-500">Loading...</div>;
  }

  if (documents.length === 0) {
    return <div className="text-xs text-gray-500">No documents linked</div>;
  }

  // Separate AI-linked and manual documents
  const aiLinked = documents.filter(doc => doc.is_ai_linked !== false);
  const manualLinked = documents.filter(doc => doc.is_ai_linked === false);

  return (
    <div className="space-y-2">
      {/* AI-Linked Documents */}
      {aiLinked.length > 0 && (
        <div>
          <div className="text-xs font-medium text-blue-700 mb-1">🤖 AI-Linked:</div>
          <div className="space-y-1">
            {aiLinked.slice(0, 3).map((doc) => {
              const confidencePercent = Math.round(doc.confidence * 100);
              const isLowConfidence = doc.confidence < 0.90;

              return (
                <div key={doc.id} className="flex items-center justify-between text-xs gap-1">
                  <div className="flex items-center space-x-1 flex-1 min-w-0">
                    <span className="text-blue-700 truncate" title={doc.filename}>
                      📄 {doc.filename.split('/').pop()}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      doc.confidence >= 0.90 ? 'bg-green-500' :
                      doc.confidence >= 0.70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} title={`Confidence: ${confidencePercent}%`}></div>
                    {isLowConfidence && (
                      <span className="text-xs bg-red-100 text-red-700 px-1 rounded" title="Low confidence - may be incorrect">
                        ⚠️ {confidencePercent}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={doc.download_url}
                      className="text-blue-600 hover:text-blue-800"
                      title="Download"
                    >
                      ⬇
                    </a>
                    {doc.link_id && (
                      <button
                        onClick={() => removeLink(doc.link_id!, doc.filename)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove AI link (false positive)"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {aiLinked.length > 3 && (
              <div className="text-xs text-blue-600">
                +{aiLinked.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manually-Linked Documents */}
      {manualLinked.length > 0 && (
        <div>
          <div className="text-xs font-medium text-purple-700 mb-1">👤 Manual:</div>
          <div className="space-y-1">
            {manualLinked.slice(0, 3).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 flex-1 min-w-0">
                  <span className="text-purple-700 truncate" title={doc.filename}>
                    📄 {doc.filename.split('/').pop()}
                  </span>
                </div>
                <a
                  href={doc.download_url}
                  className="text-purple-600 hover:text-purple-800 ml-1"
                  title="Download"
                >
                  ⬇
                </a>
              </div>
            ))}
            {manualLinked.length > 3 && (
              <div className="text-xs text-purple-600">
                +{manualLinked.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ControlsPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scanningControl, setScanningControl] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<{ [key: string]: any }>({});
  const [scanProgress, setScanProgress] = useState<{
    percentage: number;
    step: string;
    controlCode: string;
  } | null>(null);

  useEffect(() => {
    fetchFrameworks();
  }, []);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch('/api/frameworks');
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data.frameworks);
        if (data.frameworks.length > 0) {
          setSelectedFramework(data.frameworks[0].id);
          fetchControls(data.frameworks[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch frameworks:', error);
    }
  };

  const fetchControls = async (frameworkId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/frameworks/${frameworkId}/controls`);
      if (response.ok) {
        const data = await response.json();
        setControls(data.controls);
      }
    } catch (error) {
      console.error('Failed to fetch controls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFrameworkChange = (frameworkId: string) => {
    setSelectedFramework(frameworkId);
    fetchControls(frameworkId);
  };

  const runAIScan = async (controlId: string) => {
    setScanningControl(controlId);

    // Find the control to get its code for display
    const control = controls.find(c => c.id === controlId);
    const controlCode = control?.code || 'Unknown';

    // Initialize progress
    setScanProgress({
      percentage: 0,
      step: 'Starting scan...',
      controlCode
    });

    try {
      // Start the scan
      const response = await fetch(`/api/controls/${controlId}/scan`, {
        method: 'POST',
      });

      if (!response.ok) {
        let errorMessage = 'Scan failed';
        try {
          const error = await response.json();
          errorMessage = error.detail || errorMessage;
        } catch (e) {
          errorMessage = `Scan failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const scanId = data.scan_id;

      if (!scanId) {
        throw new Error('No scan ID returned from server');
      }

      // Poll for scan results
      let attempts = 0;
      const maxAttempts = 600; // 600 attempts = 10 minutes max (AI scans can take a while)

      const pollResults = async (): Promise<any> => {
        if (attempts >= maxAttempts) {
          throw new Error('Scan timeout - AI scan took longer than 10 minutes. Check worker logs for errors.');
        }

        attempts++;

        try {
          const statusResponse = await fetch(`/api/scans/${scanId}`);

          if (!statusResponse.ok) {
            throw new Error(`Failed to fetch scan status (${statusResponse.status})`);
          }

          const scanData = await statusResponse.json();

          // Update progress bar with current scan status
          if (scanData.progress_percentage !== undefined && scanData.current_step) {
            setScanProgress({
              percentage: scanData.progress_percentage,
              step: scanData.current_step,
              controlCode
            });
          }

          if (scanData.status === 'completed') {
            return scanData;
          } else if (scanData.status === 'failed') {
            throw new Error(`Scan failed: ${scanData.current_step || 'Unknown error'}`);
          } else {
            // Still processing, wait and try again
            await new Promise(resolve => setTimeout(resolve, 1000));
            return pollResults();
          }
        } catch (error) {
          if (attempts < maxAttempts) {
            // Retry on network errors
            await new Promise(resolve => setTimeout(resolve, 1000));
            return pollResults();
          }
          throw error;
        }
      };

      const scanResults = await pollResults();

      if (!scanResults) {
        throw new Error('No scan results returned');
      }

      // Calculate compliance level
      const results = scanResults.results || [];
      const passCount = results.filter((r: any) => r.outcome === 'PASS').length;
      const totalCount = results.length || 1;
      const overallScore = totalCount > 0 ? passCount / totalCount : 0;

      let complianceLevel = 'NON_COMPLIANT';
      if (overallScore >= 0.9) complianceLevel = 'COMPLIANT';
      else if (overallScore >= 0.5) complianceLevel = 'PARTIAL';

      const result = {
        ...scanResults,
        compliance_level: complianceLevel,
        overall_score: overallScore,
        model: scanResults.model || 'Unknown'
      };

      setScanResults(prev => ({
        ...prev,
        [controlId]: result
      }));

      alert(`AI Scan completed!\n\nModel: ${result.model}\nCompliance Level: ${complianceLevel}\nOverall Score: ${Math.round(overallScore * 100)}%\n\nPassed: ${passCount}/${totalCount} requirements`);
    } catch (error: unknown) {
      console.error('Failed to run AI scan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to run AI scan. Please try again.';
      alert(errorMessage);
    } finally {
      setScanningControl(null);
      setScanProgress(null);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Compliance Controls</h1>
          <p className="text-gray-600">
            Browse and manage compliance controls across different frameworks.
          </p>
        </div>

        {/* AI Scan Progress Bar */}
        {scanProgress && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="animate-pulse text-blue-600">
                  🤖
                </div>
                <span className="font-semibold text-gray-900">
                  AI Scanning: {scanProgress.controlCode}
                </span>
              </div>
              <span className="text-sm font-medium text-blue-700">
                {scanProgress.percentage}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${scanProgress.percentage}%` }}
              />
            </div>

            {/* Current step */}
            <div className="text-sm text-gray-700">
              {scanProgress.step}
            </div>
          </div>
        )}

        {/* Framework Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Framework
          </label>
          <select
            value={selectedFramework}
            onChange={(e) => handleFrameworkChange(e.target.value)}
            className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {frameworks.map((framework) => (
              <option key={framework.id} value={framework.id}>
                {framework.name} {framework.version}
              </option>
            ))}
          </select>
        </div>

        {/* Controls Grid */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading controls...</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {controls.map((control) => (
              <div
                key={control.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {control.code}
                      </h3>
                      <h4 className="text-md font-medium text-blue-600 mt-1">
                        {control.title}
                      </h4>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full text-center">
                        {control.requirements_count} reqs
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full text-center ${
                        control.linked_documents_count > 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {control.linked_documents_count > 0 
                          ? `🧠 ${control.linked_documents_count} doc${control.linked_documents_count !== 1 ? 's' : ''}`
                          : '📄 No docs'
                        }
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {control.description}
                  </p>
                  
                  {/* Show linked documents if any */}
                  {control.linked_documents_count > 0 && (
                    <div className="mb-4 p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="text-xs font-medium text-gray-800 mb-2">
                        📎 Linked Evidence:
                      </div>
                      <LinkedDocuments controlId={control.id} />
                    </div>
                  )}

                  {/* Show scan results if available */}
                  {scanResults[control.id] && (
                    <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-xs font-medium text-blue-900">
                          🎯 AI Scan Result
                        </div>
                        {scanResults[control.id].model && (
                          <div className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            {scanResults[control.id].model}
                          </div>
                        )}
                      </div>
                      <div className="text-sm">
                        <span className={`font-semibold ${
                          scanResults[control.id].compliance_level === 'COMPLIANT' ? 'text-green-700' :
                          scanResults[control.id].compliance_level === 'PARTIAL' ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {scanResults[control.id].compliance_level || 'UNKNOWN'}
                        </span>
                        <span className="text-gray-600 ml-2">
                          ({Math.round((scanResults[control.id].overall_score || 0) * 100)}% confidence)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center">
                      <Link
                        href={`/controls/${control.id}`}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        View Details
                      </Link>
                      <span className="text-xs text-gray-500">
                        {new Date(control.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {control.linked_documents_count > 0 && (
                      <button
                        onClick={() => runAIScan(control.id)}
                        disabled={scanningControl === control.id}
                        className={`w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md ${
                          scanningControl === control.id
                            ? 'bg-gray-400 cursor-not-allowed text-white'
                            : 'text-green-700 bg-green-100 hover:bg-green-200'
                        }`}
                      >
                        {scanningControl === control.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Running AI Scan...
                          </>
                        ) : (
                          <>
                            🤖 Run AI Compliance Scan
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && controls.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No controls available</h3>
              <p className="text-gray-600">
                No compliance controls found for the selected framework.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}