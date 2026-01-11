'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface RunningScan {
  id: string;
  control: {
    id: string;
    code: string;
    title: string;
  };
  status: string;
  created_at: string;
  updated_at: string;
  total_requirements?: number;
  completed_requirements?: number;
}

export default function GlobalScanStatus() {
  const [runningScans, setRunningScans] = useState<RunningScan[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Check for running scans every 5 seconds
  useEffect(() => {
    const checkRunningScans = async () => {
      try {
        // Get all running scans from localStorage or API
        const storedScans = localStorage.getItem('running_scans');
        if (storedScans) {
          const scans = JSON.parse(storedScans);

          // Verify each scan is still running by checking the API
          const updatedScans: RunningScan[] = [];
          for (const scan of scans) {
            try {
              const response = await fetch(`/api/scans/${scan.id}`);
              if (response.ok) {
                const data = await response.json();
                if (data.status === 'running' || data.status === 'pending' || data.status === 'processing') {
                  updatedScans.push({
                    id: data.id,
                    control: data.control,
                    status: data.status,
                    created_at: data.created_at,
                    updated_at: data.updated_at,
                    total_requirements: data.total_requirements,
                    completed_requirements: data.completed_requirements,
                  });
                }
              }
            } catch (error) {
              console.error(`Failed to check scan ${scan.id}:`, error);
            }
          }

          setRunningScans(updatedScans);

          // Update localStorage with only running scans
          if (updatedScans.length > 0) {
            localStorage.setItem('running_scans', JSON.stringify(updatedScans));
          } else {
            localStorage.removeItem('running_scans');
          }
        }
      } catch (error) {
        console.error('Failed to check running scans:', error);
      }
    };

    // Check immediately on mount
    checkRunningScans();

    // Then check every 5 seconds
    const interval = setInterval(checkRunningScans, 5000);

    return () => clearInterval(interval);
  }, []);

  // Don't render anything if there are no running scans or user dismissed
  if (!isVisible || runningScans.length === 0) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"
        >
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{runningScans.length} scan{runningScans.length > 1 ? 's' : ''} running</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-full">
      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-sm font-semibold text-blue-900">
                Compliance Scan{runningScans.length > 1 ? 's' : ''} in Progress
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(true)}
                className="text-blue-600 hover:text-blue-800 p-1"
                title="Minimize"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="text-blue-600 hover:text-blue-800 p-1"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {runningScans.map((scan) => (
              <div key={scan.id} className="bg-white rounded-md p-3 border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Link
                      href={`/controls/${scan.control.id}`}
                      className="text-sm font-medium text-blue-900 hover:text-blue-700 hover:underline"
                    >
                      {scan.control.code}: {scan.control.title}
                    </Link>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {scan.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(scan.updated_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {scan.total_requirements && scan.completed_requirements !== undefined && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{scan.completed_requirements}/{scan.total_requirements}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${(scan.completed_requirements / scan.total_requirements) * 100}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-700">
              Scans are analyzing your evidence against compliance requirements. This may take a few minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
