'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Requirement {
  id: string;
  req_code: string;
  text: string;
  maturity_level: number;
}

interface ScanResult {
  requirement: Requirement;
  outcome: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_FOUND';
  confidence: string;
  rationale: string;
  citations: any[];
}

interface Gap {
  requirement: Requirement;
  summary: string;
  recommended_actions: {
    title: string;
    detail: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

interface Scan {
  id: string;
  status: string;
  created_at: string;
  results: ScanResult[];
  gaps: Gap[];
}

interface Control {
  id: string;
  code: string;
  title: string;
  description: string;
  requirements_count: number;
  latest_scan?: Scan;
}

interface Framework {
  id: string;
  name: string;
  version: string;
}

export default function ReportsPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFramework, setSelectedFramework] = useState<string>('');

  useEffect(() => {
    fetchFrameworks();
  }, []);

  useEffect(() => {
    if (selectedFramework) {
      fetchControlsWithScans(selectedFramework);
    }
  }, [selectedFramework]);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch('/api/frameworks');
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data.frameworks);
        if (data.frameworks.length > 0) {
          setSelectedFramework(data.frameworks[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch frameworks:', error);
    }
  };

  const fetchControlsWithScans = async (frameworkId: string) => {
    try {
      setLoading(true);
      const controlsResponse = await fetch(`/api/frameworks/${frameworkId}/controls`);
      
      if (controlsResponse.ok) {
        const controlsData = await controlsResponse.json();
        
        // Fetch latest scan for each control
        const controlsWithScans = await Promise.all(
          controlsData.controls.map(async (control: Control) => {
            try {
              const scansResponse = await fetch(`/api/controls/${control.id}/scans`);
              if (scansResponse.ok) {
                const scansData = await scansResponse.json();
                if (scansData.scans.length > 0) {
                  // Get the latest completed scan
                  const latestScan = scansData.scans.find((scan: any) => scan.status === 'completed');
                  if (latestScan) {
                    const scanDetailResponse = await fetch(`/api/scans/${latestScan.id}`);
                    if (scanDetailResponse.ok) {
                      const scanDetail = await scanDetailResponse.json();
                      control.latest_scan = scanDetail;
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`Failed to fetch scans for control ${control.id}:`, error);
            }
            return control;
          })
        );
        
        setControls(controlsWithScans);
      }
    } catch (error) {
      console.error('Failed to fetch controls:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComplianceStats = () => {
    const stats = {
      total: controls.length,
      scanned: 0,
      passed: 0,
      partial: 0,
      failed: 0,
      notFound: 0,
      totalGaps: 0
    };

    controls.forEach(control => {
      if (control.latest_scan) {
        stats.scanned++;
        stats.totalGaps += control.latest_scan.gaps.length;
        
        const outcomes = control.latest_scan.results.map(r => r.outcome);
        if (outcomes.every(o => o === 'PASS')) {
          stats.passed++;
        } else if (outcomes.some(o => o === 'PASS' || o === 'PARTIAL')) {
          stats.partial++;
        } else if (outcomes.some(o => o === 'FAIL')) {
          stats.failed++;
        } else {
          stats.notFound++;
        }
      }
    });

    return stats;
  };

  const exportReport = async () => {
    const framework = frameworks.find(f => f.id === selectedFramework);
    const stats = getComplianceStats();
    
    // Create CSV content
    let csvContent = `GeekyGoose Compliance Report - ${framework?.name}\n`;
    csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    csvContent += `Summary:\n`;
    csvContent += `Total Controls: ${stats.total}\n`;
    csvContent += `Scanned: ${stats.scanned}\n`;
    csvContent += `Passed: ${stats.passed}\n`;
    csvContent += `Partial: ${stats.partial}\n`;
    csvContent += `Failed: ${stats.failed}\n`;
    csvContent += `Not Found: ${stats.notFound}\n`;
    csvContent += `Total Gaps: ${stats.totalGaps}\n\n`;
    
    csvContent += `Control,Status,Requirements Scanned,Gaps Found,Last Scan\n`;
    
    controls.forEach(control => {
      const scan = control.latest_scan;
      const status = scan ? getControlStatus(scan) : 'Not Scanned';
      const reqCount = scan ? scan.results.length : 0;
      const gapsCount = scan ? scan.gaps.length : 0;
      const lastScan = scan ? new Date(scan.created_at).toLocaleDateString() : 'Never';
      
      csvContent += `"${control.code}: ${control.title}","${status}",${reqCount},${gapsCount},${lastScan}\n`;
    });
    
    // Add gaps section
    csvContent += `\n\nDetailed Gaps:\n`;
    csvContent += `Control,Requirement,Gap Summary,Priority,Recommended Action\n`;
    
    controls.forEach(control => {
      if (control.latest_scan?.gaps) {
        control.latest_scan.gaps.forEach(gap => {
          gap.recommended_actions.forEach(action => {
            csvContent += `"${control.code}","${gap.requirement.req_code}","${gap.summary}","${action.priority}","${action.title}: ${action.detail}"\n`;
          });
        });
      }
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${framework?.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getControlStatus = (scan: Scan): string => {
    if (!scan.results.length) return 'No Results';
    
    const outcomes = scan.results.map(r => r.outcome);
    if (outcomes.every(o => o === 'PASS')) return 'Compliant';
    if (outcomes.some(o => o === 'PASS' || o === 'PARTIAL')) return 'Partial';
    if (outcomes.some(o => o === 'FAIL')) return 'Non-Compliant';
    return 'No Evidence';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Compliant': return 'text-green-700 bg-green-50 border-green-200';
      case 'Partial': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'Non-Compliant': return 'text-red-700 bg-red-50 border-red-200';
      case 'No Evidence': return 'text-gray-700 bg-gray-50 border-gray-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'HIGH': return 'text-red-700 bg-red-50 border-red-200';
      case 'MEDIUM': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'LOW': return 'text-blue-700 bg-blue-50 border-blue-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const stats = getComplianceStats();

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading reports...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Compliance Reports</h1>
          <p className="text-gray-600">
            Review control compliance status, identify gaps, and track remediation progress.
          </p>
        </div>

        {/* Framework Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Framework
          </label>
          <select
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {frameworks.map((framework) => (
              <option key={framework.id} value={framework.id}>
                {framework.name} ({framework.version})
              </option>
            ))}
          </select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Controls</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{stats.scanned}</div>
            <div className="text-sm text-gray-600">Scanned</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            <div className="text-sm text-gray-600">Compliant</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.partial}</div>
            <div className="text-sm text-gray-600">Partial</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-600">Non-Compliant</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-600">{stats.notFound}</div>
            <div className="text-sm text-gray-600">No Evidence</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">{stats.totalGaps}</div>
            <div className="text-sm text-gray-600">Total Gaps</div>
          </div>
        </div>

        {/* Export Button */}
        <div className="mb-6">
          <button
            onClick={exportReport}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Report (CSV)
          </button>
        </div>

        {/* Controls Table */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Control Compliance Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Control</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requirements</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gaps</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Scan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {controls.map((control) => {
                  const scan = control.latest_scan;
                  const status = scan ? getControlStatus(scan) : 'Not Scanned';
                  
                  return (
                    <tr key={control.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{control.code}: {control.title}</div>
                          <div className="text-sm text-gray-500">{control.description.substring(0, 100)}...</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {scan ? `${scan.results.length} scanned` : `${control.requirements_count} total`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {scan ? scan.gaps.length : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {scan ? new Date(scan.created_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link 
                          href={`/controls/${control.id}`}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View Details
                        </Link>
                        {scan && (
                          <Link 
                            href={`/controls/${control.id}?scan=${scan.id}`}
                            className="text-green-600 hover:text-green-900"
                          >
                            View Scan
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gaps Analysis */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Gaps Analysis & Recommendations</h2>
          </div>
          <div className="p-6">
            {controls.filter(c => c.latest_scan?.gaps.length > 0).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No gaps identified in scanned controls.</p>
            ) : (
              <div className="space-y-6">
                {controls
                  .filter(c => c.latest_scan?.gaps.length > 0)
                  .map((control) => (
                    <div key={control.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">
                        {control.code}: {control.title}
                      </h3>
                      <div className="space-y-4">
                        {control.latest_scan!.gaps.map((gap, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-4">
                            <div className="mb-2">
                              <span className="text-sm font-medium text-gray-700">
                                {gap.requirement.req_code}: 
                              </span>
                              <span className="text-sm text-gray-600 ml-1">
                                {gap.requirement.text}
                              </span>
                            </div>
                            <div className="mb-3">
                              <p className="text-sm text-red-700">{gap.summary}</p>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-700">Recommended Actions:</h4>
                              {gap.recommended_actions.map((action, actionIdx) => (
                                <div key={actionIdx} className="flex items-start space-x-3">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded border ${getPriorityColor(action.priority)}`}>
                                    {action.priority}
                                  </span>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{action.title}</div>
                                    <div className="text-sm text-gray-600">{action.detail}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}