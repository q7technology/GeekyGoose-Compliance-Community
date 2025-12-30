'use client'

import { useState } from 'react'
import Link from 'next/link'
import FileUpload from '../../components/FileUpload'
import DocumentList from '../../components/DocumentList'

export default function DocumentsPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Document Management
          </h1>
          <p className="text-gray-600">
            Upload and manage your compliance documents
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Documents
              </h2>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <FileUpload onUploadComplete={handleUploadComplete} enableControlMapping={true} />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Supported File Types</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• PDF Documents (.pdf)</li>
                <li>• Word Documents (.docx)</li>
                <li>• Text Files (.txt)</li>
                <li>• Images (.png, .jpg, .jpeg)</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">Maximum file size: 50MB</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">🤖 Smart Control Mapping</h3>
              <p className="text-sm text-green-800 mb-3">
                Our AI automatically scans uploaded documents and suggests relevant compliance controls based on content analysis.
              </p>
              <div className="flex space-x-2">
                <Link
                  href="/templates"
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Browse Templates →
                </Link>
                <button
                  onClick={() => {
                    const mappings = localStorage.getItem('document_control_mappings')
                    if (mappings) {
                      const parsedMappings = JSON.parse(mappings)
                      alert(`Found ${parsedMappings.length} document-control mappings in storage.`)
                    } else {
                      alert('No control mappings found yet. Upload documents to get AI suggestions!')
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-green-600 text-xs font-medium rounded text-green-700 bg-transparent hover:bg-green-100"
                >
                  View Mappings
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <DocumentList refreshTrigger={refreshTrigger} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}