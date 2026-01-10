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

interface RunningScan {
  controlId: string;
  controlCode: string;
  scanId: string;
  percentage: number;
  step: string;
  status: 'running' | 'completed' | 'failed';
}

export default function ControlsPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [runningScans, setRunningScans] = useState<{ [key: string]: RunningScan }>({});
  const [scanResults, setScanResults] = useState<{ [key: string]: any }>({});
  const [showScansPopup, setShowScansPopup] = useState(false);

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
    // Find the control to get its code for display
    const control = controls.find(c => c.id === controlId);
    const controlCode = control?.code || 'Unknown';

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

      // Add scan to running scans and show popup
      setRunningScans(prev => ({
        ...prev,
        [controlId]: {
          controlId,
          controlCode,
          scanId,
          percentage: 0,
          step: 'Starting scan...',
          status: 'running'
        }
      }));
      setShowScansPopup(true);

      // Poll for scan results in background
      pollScanStatus(controlId, scanId, controlCode);
    } catch (error: unknown) {
      console.error('Failed to start AI scan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start AI scan. Please try again.';
      alert(errorMessage);
    }
  };

  const pollScanStatus = async (controlId: string, scanId: string, controlCode: string) => {
    let attempts = 0;
    const maxAttempts = 600; // 600 attempts = 10 minutes max

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setRunningScans(prev => ({
          ...prev,
          [controlId]: {
            ...prev[controlId],
            status: 'failed',
            step: 'Scan timeout - took longer than 10 minutes'
          }
        }));
        return;
      }

      attempts++;

      try {
        const statusResponse = await fetch(`/api/scans/${scanId}`);

        if (!statusResponse.ok) {
          throw new Error(`Failed to fetch scan status (${statusResponse.status})`);
        }

        const scanData = await statusResponse.json();

        // Update progress
        if (scanData.progress_percentage !== undefined && scanData.current_step) {
          setRunningScans(prev => ({
            ...prev,
            [controlId]: {
              ...prev[controlId],
              percentage: scanData.progress_percentage,
              step: scanData.current_step
            }
          }));
        }

        if (scanData.status === 'completed') {
          // Calculate compliance level
          const results = scanData.results || [];
          const passCount = results.filter((r: any) => r.outcome === 'PASS').length;
          const totalCount = results.length || 1;
          const overallScore = totalCount > 0 ? passCount / totalCount : 0;

          let complianceLevel = 'NON_COMPLIANT';
          if (overallScore >= 0.9) complianceLevel = 'COMPLIANT';
          else if (overallScore >= 0.5) complianceLevel = 'PARTIAL';

          const result = {
            ...scanData,
            compliance_level: complianceLevel,
            overall_score: overallScore,
            model: scanData.model || 'Unknown'
          };

          setScanResults(prev => ({
            ...prev,
            [controlId]: result
          }));

          setRunningScans(prev => ({
            ...prev,
            [controlId]: {
              ...prev[controlId],
              status: 'completed',
              percentage: 100,
              step: `Completed! ${complianceLevel} - ${Math.round(overallScore * 100)}%`
            }
          }));

          // Remove from running scans after 3 seconds
          setTimeout(() => {
            setRunningScans(prev => {
              const updated = { ...prev };
              delete updated[controlId];
              return updated;
            });
          }, 3000);

          return;
        } else if (scanData.status === 'failed') {
          setRunningScans(prev => ({
            ...prev,
            [controlId]: {
              ...prev[controlId],
              status: 'failed',
              step: scanData.current_step || 'Scan failed'
            }
          }));
          return;
        } else {
          // Still processing, wait and try again
          await new Promise(resolve => setTimeout(resolve, 1000));
          return poll();
        }
      } catch (error) {
        if (attempts < maxAttempts) {
          // Retry on network errors
          await new Promise(resolve => setTimeout(resolve, 1000));
          return poll();
        }
        setRunningScans(prev => ({
          ...prev,
          [controlId]: {
            ...prev[controlId],
            status: 'failed',
            step: 'Network error - please check your connection'
          }
        }));
      }
    };

    await poll();
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

        {/* AI Scans Popup */}
        {Object.keys(runningScans).length > 0 && showScansPopup && (
          <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <div className="animate-pulse">🤖</div>
                <h3 className="font-bold">AI Compliance Scans</h3>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {Object.keys(runningScans).length}
                </span>
              </div>
              <button
                onClick={() => setShowScansPopup(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {Object.values(runningScans).map((scan) => (
                <div
                  key={scan.controlId}
                  className="p-4 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{scan.controlCode}</span>
                    <div className="flex items-center gap-2">
                      {scan.status === 'running' && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      )}
                      {scan.status === 'completed' && (
                        <div className="text-green-600">✓</div>
                      )}
                      {scan.status === 'failed' && (
                        <div className="text-red-600">✗</div>
                      )}
                      <span className={`text-sm font-medium ${
                        scan.status === 'completed' ? 'text-green-600' :
                        scan.status === 'failed' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>
                        {scan.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        scan.status === 'completed' ? 'bg-gradient-to-r from-green-500 to-green-600' :
                        scan.status === 'failed' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                        'bg-gradient-to-r from-blue-500 to-purple-600'
                      }`}
                      style={{ width: `${scan.percentage}%` }}
                    />
                  </div>

                  {/* Status text */}
                  <div className="text-xs text-gray-600">{scan.step}</div>
                </div>
              ))}
            </div>
            {Object.keys(runningScans).length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No running scans
              </div>
            )}
          </div>
        )}

        {/* Floating button to toggle popup when hidden */}
        {Object.keys(runningScans).length > 0 && !showScansPopup && (
          <button
            onClick={() => setShowScansPopup(true)}
            className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            <div className="animate-pulse">🤖</div>
            <span className="font-semibold">{Object.keys(runningScans).length} AI Scan{Object.keys(runningScans).length !== 1 ? 's' : ''} Running</span>
          </button>
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
                        disabled={!!runningScans[control.id]}
                        className={`w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md ${
                          runningScans[control.id]
                            ? 'bg-gray-400 cursor-not-allowed text-white'
                            : 'text-green-700 bg-green-100 hover:bg-green-200'
                        }`}
                      >
                        {runningScans[control.id] ? (
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