'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Requirement {
  id: string;
  req_code: string;
  text: string;
  maturity_level: number;
  guidance: string;
}

interface Control {
  id: string;
  framework_id: string;
  framework_name: string;
  code: string;
  title: string;
  description: string;
  requirements: Requirement[];
  created_at: string;
}

interface Evidence {
  id: string;
  document: {
    id: string;
    filename: string;
    mime_type: string;
    file_size: number;
    created_at: string;
    download_url: string;
  };
  requirement: {
    id: string;
    req_code: string;
    text: string;
  } | null;
  note: string;
  created_at: string;
  confidence?: number;
  reasoning?: string;
  is_ai_linked?: boolean;
}

interface ScanResult {
  requirement: {
    id: string;
    req_code: string;
    text: string;
    maturity_level: number;
  };
  outcome: string;
  confidence: string;
  rationale: string;
  citations: Array<{
    document_id: string;
    document_name: string;
    page_num: number;
    quote: string;
  }>;
}

interface Gap {
  requirement: {
    id: string;
    req_code: string;
    text: string;
  };
  summary: string;
  recommended_actions: Array<{
    title: string;
    detail: string;
    priority: string;
  }>;
}

interface Scan {
  id: string;
  control: {
    id: string;
    code: string;
    title: string;
  };
  status: string;
  model: string;
  prompt_version: string;
  created_at: string;
  updated_at: string;
  results: ScanResult[];
  gaps: Gap[];
}

export default function ControlDetailPage() {
  const params = useParams();
  const controlId = params.controlId as string;
  
  const [control, setControl] = useState<Control | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [latestScan, setLatestScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [linkingEvidence, setLinkingEvidence] = useState<string | null>(null);
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingInProgress, setLinkingInProgress] = useState<string | null>(null);

  useEffect(() => {
    if (controlId) {
      Promise.all([
        fetchControlDetails(),
        fetchEvidence(),
        fetchScans(),
        fetchAvailableDocuments()
      ]).finally(() => setLoading(false));
    }
  }, [controlId]);

  const fetchControlDetails = async () => {
    try {
      const response = await fetch(`/api/controls/${controlId}`);
      if (response.ok) {
        const data = await response.json();
        setControl(data);
      }
    } catch (error) {
      console.error('Failed to fetch control details:', error);
    }
  };

  const fetchEvidence = async () => {
    try {
      const response = await fetch(`/api/controls/${controlId}/evidence`);
      if (response.ok) {
        const data = await response.json();
        setEvidence(data.evidence);
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error);
    }
  };

  const fetchScans = async () => {
    try {
      const response = await fetch(`/api/controls/${controlId}/scans`);
      if (response.ok) {
        const data = await response.json();
        setScans(data.scans);
        if (data.scans.length > 0) {
          // Fetch latest scan details
          const latestScanResponse = await fetch(`/api/scans/${data.scans[0].id}`);
          if (latestScanResponse.ok) {
            const latestScanData = await latestScanResponse.json();
            setLatestScan(latestScanData);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch scans:', error);
    }
  };

  const fetchAvailableDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setAvailableDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const startScan = async () => {
    setScanLoading(true);
    try {
      const response = await fetch(`/api/controls/${controlId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Add scan to global running scans tracker
        const runningScan = {
          id: data.scan_id,
          control: {
            id: control?.id || controlId,
            code: control?.code || 'Unknown',
            title: control?.title || 'Unknown Control',
          },
          status: 'running',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Get existing running scans from localStorage
        const storedScans = localStorage.getItem('running_scans');
        const runningScans = storedScans ? JSON.parse(storedScans) : [];

        // Add new scan if not already in the list
        if (!runningScans.find((s: any) => s.id === data.scan_id)) {
          runningScans.push(runningScan);
          localStorage.setItem('running_scans', JSON.stringify(runningScans));
        }

        alert(`Scan started successfully! Scan ID: ${data.scan_id}`);
        // Refresh scans list
        fetchScans();
      } else {
        const error = await response.json();
        alert(`Failed to start scan: ${error.detail}`);
      }
    } catch (error) {
      console.error('Failed to start scan:', error);
      alert('Failed to start scan. Please try again.');
    } finally {
      setScanLoading(false);
    }
  };

  const linkExistingEvidence = async (documentId: string, requirementId?: string) => {
    setLinkingEvidence(documentId);
    setLinkingInProgress(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}/link-evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          control_id: controlId,
          requirement_id: requirementId,
          note: 'Linked from control page'
        }),
      });
      
      if (response.ok) {
        fetchEvidence();
        fetchAvailableDocuments(); // Refresh available documents
      } else {
        const error = await response.json();
        alert(`Failed to link evidence: ${error.detail}`);
      }
    } catch (error) {
      console.error('Failed to link evidence:', error);
      alert('Failed to link evidence. Please try again.');
    } finally {
      setLinkingEvidence(null);
      setLinkingInProgress(null);
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'PASS':
        return 'bg-green-100 text-green-800';
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAIL':
        return 'bg-red-100 text-red-800';
      case 'NOT_FOUND':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading control details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!control) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-xl font-medium text-gray-900 mb-2">Control not found</h2>
            <Link href="/controls" className="text-blue-600 hover:text-blue-700">
              ← Back to Controls
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/controls" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Controls
          </Link>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {control.code}: {control.title}
              </h1>
              <p className="text-gray-600 mt-2">{control.framework_name}</p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/documents"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Upload Evidence
              </Link>
              <button
                onClick={startScan}
                disabled={scanLoading || evidence.length === 0}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  scanLoading || evidence.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {scanLoading ? 'Starting Scan...' : 'Start AI Scan'}
              </button>
            </div>
          </div>
          <p className="text-gray-700">{control.description}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Requirements and Evidence */}
          <div className="space-y-6">
            {/* Requirements */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Requirements</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {control.requirements.map((req) => (
                    <div key={req.id} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{req.req_code}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${'bg-blue-100 text-blue-800'}`}>
                          Level {req.maturity_level}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2">{req.text}</p>
                      {req.guidance && (
                        <p className="text-sm text-gray-600">
                          <strong>Guidance:</strong> {req.guidance}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Evidence */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Linked Evidence</h2>
                  <div className="space-x-2">
                    <button
                      onClick={() => setShowLinkModal(true)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                    >
                      Link Document
                    </button>
                    <Link
                      href="/documents"
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Upload New
                    </Link>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {evidence.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-4">No evidence linked to this control yet.</p>
                    <p className="text-sm text-gray-400">Upload documents and return here to link them as evidence.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* AI-Linked Evidence */}
                    {evidence.filter(item => item.is_ai_linked !== false).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center">
                          🤖 AI-Linked Evidence
                          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                            {evidence.filter(item => item.is_ai_linked !== false).length}
                          </span>
                        </h3>
                        <div className="space-y-2">
                          {evidence.filter(item => item.is_ai_linked !== false).map((item) => (
                            <div key={item.id} className="flex items-start justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-gray-900 truncate">{item.document.filename}</h4>
                                  {item.confidence !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <div className={`w-2 h-2 rounded-full ${
                                        item.confidence >= 0.7 ? 'bg-green-500' :
                                        item.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-orange-500'
                                      }`} title={`Confidence: ${Math.round(item.confidence * 100)}%`}></div>
                                      <span className="text-xs text-gray-600">
                                        {Math.round(item.confidence * 100)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {item.requirement ? `Linked to: ${item.requirement.req_code}` : 'General evidence'}
                                </p>
                                {item.reasoning && (
                                  <p className="text-xs text-gray-500 mt-1 italic">
                                    "{item.reasoning.substring(0, 100)}{item.reasoning.length > 100 ? '...' : ''}"
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {(item.document.file_size / 1024).toFixed(1)} KB • {item.document.mime_type}
                                </p>
                              </div>
                              <a
                                href={item.document.download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-3 flex-shrink-0 text-blue-600 hover:text-blue-700 font-medium"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manually-Linked Evidence */}
                    {evidence.filter(item => item.is_ai_linked === false).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-purple-700 mb-3 flex items-center">
                          👤 Manually-Linked Evidence
                          <span className="ml-2 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                            {evidence.filter(item => item.is_ai_linked === false).length}
                          </span>
                        </h3>
                        <div className="space-y-2">
                          {evidence.filter(item => item.is_ai_linked === false).map((item) => (
                            <div key={item.id} className="flex items-start justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate mb-1">{item.document.filename}</h4>
                                <p className="text-sm text-gray-600">
                                  {item.requirement ? `Linked to: ${item.requirement.req_code}` : 'General evidence'}
                                </p>
                                {item.note && item.note !== 'Linked from control page' && (
                                  <p className="text-xs text-gray-500 mt-1 italic">
                                    Note: {item.note}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {(item.document.file_size / 1024).toFixed(1)} KB • {item.document.mime_type}
                                </p>
                              </div>
                              <a
                                href={item.document.download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-3 flex-shrink-0 text-purple-600 hover:text-purple-700 font-medium"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Scan Results */}
          <div className="space-y-6">
            {/* Latest Scan Results */}
            {latestScan ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Latest Scan Results</h2>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      latestScan.status === 'completed' ? 'bg-green-100 text-green-800' :
                      latestScan.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      latestScan.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {latestScan.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>{new Date(latestScan.created_at).toLocaleString()}</span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      <span>🤖</span>
                      <span className="font-medium">{latestScan.model}</span>
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  {latestScan.status === 'completed' && latestScan.results.length > 0 ? (
                    <div className="space-y-4">
                      {latestScan.results.map((result, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900">{result.requirement.req_code}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${getOutcomeColor(result.outcome)}`}>
                              {result.outcome}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Confidence: {Math.round(parseFloat(result.confidence) * 100)}%
                          </p>
                          <p className="text-sm text-gray-700 mb-3">{result.rationale}</p>
                          {result.citations.length > 0 && (
                            <div>
                              <h5 className="text-xs font-medium text-gray-700 mb-1">Citations:</h5>
                              <div className="space-y-1">
                                {result.citations.map((citation, citIndex) => (
                                  <p key={citIndex} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                    "{citation.quote}" - {citation.document_name} (Page {citation.page_num})
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : latestScan.status === 'processing' ? (
                    <div className="text-center py-6">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-600">Scanning in progress...</p>
                    </div>
                  ) : latestScan.status === 'failed' ? (
                    <div className="text-center py-6">
                      <p className="text-red-600">Scan failed. Please try again.</p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-gray-500">No scan results available yet.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">AI Scanning</h2>
                </div>
                <div className="p-6 text-center">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Scan</h3>
                  <p className="text-gray-600 mb-4">
                    Upload evidence documents and run an AI scan to analyze compliance against requirements.
                  </p>
                  {evidence.length === 0 ? (
                    <p className="text-sm text-red-600 mb-4">
                      Please upload and link evidence before running a scan.
                    </p>
                  ) : null}
                  <button
                    onClick={startScan}
                    disabled={evidence.length === 0}
                    className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white ${
                      evidence.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Start AI Scan
                  </button>
                </div>
              </div>
            )}

            {/* Gaps and Recommendations */}
            {latestScan?.gaps && latestScan.gaps.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Compliance Gaps</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {latestScan.gaps.map((gap, index) => (
                      <div key={index} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                        <h4 className="font-medium text-gray-900 mb-2">{gap.requirement.req_code}</h4>
                        <p className="text-gray-700 mb-3">{gap.summary}</p>
                        {gap.recommended_actions.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Recommended Actions:</h5>
                            <div className="space-y-2">
                              {gap.recommended_actions.map((action, actionIndex) => (
                                <div key={actionIndex} className="bg-white p-3 rounded border">
                                  <div className="flex justify-between items-start mb-1">
                                    <h6 className="font-medium text-gray-900">{action.title}</h6>
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      action.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                                      action.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {action.priority}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600">{action.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Document Linking Modal */}
        {showLinkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Link Document as Evidence</h3>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {availableDocuments.filter(doc => 
                !evidence.some(ev => ev.document.id === doc.id)
              ).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-4">
                    {availableDocuments.length === 0 
                      ? 'No documents available to link.' 
                      : 'All available documents are already linked to this control.'
                    }
                  </p>
                  <Link
                    href="/documents"
                    onClick={() => setShowLinkModal(false)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Upload Documents
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Select a document to link as evidence for this control:</p>
                  
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {availableDocuments.filter(doc => 
                      !evidence.some(ev => ev.document.id === doc.id)
                    ).map((doc) => (
                      <div
                        key={doc.id}
                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                        onClick={async () => {
                          await linkExistingEvidence(doc.id);
                          setShowLinkModal(false);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{doc.filename}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {(doc.file_size / 1024).toFixed(1)} KB • {doc.mime_type}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button 
                            className={`text-sm font-medium ${
                              linkingInProgress === doc.id 
                                ? 'text-gray-400' 
                                : 'text-blue-600 hover:text-blue-700'
                            }`}
                          >
                            {linkingInProgress === doc.id ? 'Linking...' : 'Link'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setShowLinkModal(false)}
                      className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}