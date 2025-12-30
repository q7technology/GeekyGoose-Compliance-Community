'use client'

import { useState, useEffect } from 'react'

interface Document {
  id: string
  filename: string
  mime_type: string
  file_size: number
  created_at: string
  download_url: string
}

interface ControlMapping {
  file_id: string
  filename: string
  control_code: string
  control_title: string
  framework_name: string
  confidence: number
  reasoning: string
  created_at: string
}

export default function DocumentList({ refreshTrigger }: { refreshTrigger?: number }) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [controlMappings, setControlMappings] = useState<ControlMapping[]>([])

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/documents')
      
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents)
        setError(null)
      } else {
        throw new Error('Failed to fetch documents')
      }
    } catch (err) {
      setError('Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setDocuments(docs => docs.filter(doc => doc.id !== documentId))
      } else {
        throw new Error('Failed to delete document')
      }
    } catch (err) {
      alert('Failed to delete document')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('text')) return '📃'
    if (mimeType.includes('image')) return '🖼️'
    return '📁'
  }

  useEffect(() => {
    fetchDocuments()
    loadControlMappings()
  }, [refreshTrigger])
  
  const loadControlMappings = () => {
    try {
      const mappings = localStorage.getItem('document_control_mappings')
      if (mappings) {
        setControlMappings(JSON.parse(mappings))
      }
    } catch (error) {
      console.error('Failed to load control mappings:', error)
    }
  }
  
  const getDocumentMappings = (documentId: string) => {
    return controlMappings.filter(mapping => mapping.file_id === documentId)
  }
  
  const removeMapping = (documentId: string, controlCode: string) => {
    const updatedMappings = controlMappings.filter(
      mapping => !(mapping.file_id === documentId && mapping.control_code === controlCode)
    )
    setControlMappings(updatedMappings)
    localStorage.setItem('document_control_mappings', JSON.stringify(updatedMappings))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading documents...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded-lg">
        {error}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <div className="text-4xl mb-4">📄</div>
        <p>No documents uploaded yet</p>
        <p className="text-sm mt-2">Upload your first document to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Uploaded Documents</h2>
      
      <div className="grid gap-4">
        {documents.map((doc) => (
          <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="text-2xl">{getFileIcon(doc.mime_type)}</div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {doc.filename}
                  </h3>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Size: {formatFileSize(doc.file_size)}</p>
                    <p>Uploaded: {formatDate(doc.created_at)}</p>
                    <p>Type: {doc.mime_type}</p>
                    
                    {/* Control Mappings */}
                    {getDocumentMappings(doc.id).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-1">🔗 Mapped to Controls:</p>
                        <div className="space-y-1">
                          {getDocumentMappings(doc.id).map((mapping, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-blue-50 rounded px-2 py-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium text-blue-800">
                                  {mapping.control_code}
                                </span>
                                <span className="text-xs text-blue-600">
                                  {mapping.framework_name}
                                </span>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  mapping.confidence >= 0.8 ? 'bg-green-500' :
                                  mapping.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-orange-500'
                                }`}></div>
                              </div>
                              <button
                                onClick={() => removeMapping(doc.id, mapping.control_code)}
                                className="text-xs text-red-600 hover:text-red-700"
                                title="Remove mapping"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2 ml-4">
                <div className="flex space-x-2">
                  <a
                    href={doc.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Download
                  </a>
                  
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
                
                {/* Control Mapping Summary */}
                {getDocumentMappings(doc.id).length > 0 && (
                  <div className="text-xs text-gray-500">
                    🔗 {getDocumentMappings(doc.id).length} control{getDocumentMappings(doc.id).length > 1 ? 's' : ''} mapped
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}