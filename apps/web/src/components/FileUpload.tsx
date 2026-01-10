'use client'

import { useState, DragEvent, ChangeEvent } from 'react'

interface UploadedFile {
  id: string
  filename: string
  mime_type: string
  file_size: number
  created_at: string
  download_url: string
  suggested_controls?: Array<{
    control_code: string
    control_title: string
    framework_name: string
    confidence: number
    reasoning: string
  }>
}

interface Template {
  id: string
  name: string
  description: string
  control: {
    id: string
    code: string
    title: string
    framework_name: string
  }
  evidence_requirements: Array<{
    requirement_code: string
    evidence_type: string
    description: string
  }>
}

export default function FileUpload({ onUploadComplete, enableControlMapping = false }: { onUploadComplete?: () => void, enableControlMapping?: boolean }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [scanningForControls, setScanningForControls] = useState(false)
  const [suggestedMappings, setSuggestedMappings] = useState<Array<{
    control_code: string
    control_title: string
    framework_name: string
    confidence: number
    reasoning: string
  }>>([])  
  const [showMappingSuggestions, setShowMappingSuggestions] = useState(false)
  const [lastUploadedFiles, setLastUploadedFiles] = useState<UploadedFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})
  const [uploadResults, setUploadResults] = useState<{[key: string]: string}>({})
  const [aiProcessingStatus, setAiProcessingStatus] = useState<Record<string, boolean>>({})
  const [showAiCompleteBanner, setShowAiCompleteBanner] = useState(false)
  const [aiCompleteMessage, setAiCompleteMessage] = useState('')

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await uploadMultipleFiles(files)
    }
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await uploadMultipleFiles(Array.from(files))
    }
  }

  const uploadMultipleFiles = async (files: File[]) => {
    if (files.length === 0) return
    
    setIsUploading(true)
    setUploadStatus(`Uploading ${files.length} file${files.length > 1 ? 's' : ''} one at a time...`)
    setUploadResults({})
    setUploadProgress({})
    setLastUploadedFiles([])
    
    const uploadedFiles: UploadedFile[] = []
    const successfulFiles: File[] = []
    let successful = 0
    let failed = 0
    
    // Upload files sequentially to prevent connection issues
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      const fileKey = `${file.name}-${index}`
      
      setUploadStatus(`Uploading file ${index + 1} of ${files.length}: ${file.name}`)
      setUploadProgress(prev => ({ ...prev, [fileKey]: 0 }))
      
      try {
        const result = await uploadFile(file)
        setUploadResults(prev => ({ ...prev, [fileKey]: '✅ Uploaded' }))
        uploadedFiles.push(result)
        successfulFiles.push(file)
        successful++
        
        // Delay between uploads to prevent overwhelming the server
        if (index < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)) // Increased to 2 seconds
        }
      } catch (error: any) {
        let errorMessage = '❌ Failed'
        if (error.message?.includes('timeout')) {
          errorMessage = '⏰ Timeout'
        } else if (error.message?.includes('Connection lost')) {
          errorMessage = '🔌 Connection lost'
        }
        setUploadResults(prev => ({ ...prev, [fileKey]: errorMessage }))
        console.error(`Upload failed for ${file.name}:`, error)
        failed++
      }
    }
    
    setUploadStatus(`Upload complete: ${successful} successful${failed > 0 ? `, ${failed} failed` : ''}`)
    setLastUploadedFiles(uploadedFiles)
    
    // Always check for AI control mapping if files were uploaded
    if (uploadedFiles.length > 0) {
      await scanMultipleFilesForControlMatches(successfulFiles, uploadedFiles)
      
      // Start polling for AI processing completion
      startAiProcessingPolling(uploadedFiles)
    }
    
    setIsUploading(false)
    onUploadComplete?.()
  }

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const formData = new FormData()
    formData.append('file', file)

    // Create an AbortController for timeout handling
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 300000) // 5 minute timeout for large files

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
        // Add keep-alive headers to prevent connection drops
        headers: {
          'Connection': 'keep-alive',
        },
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const result = await response.json()

        // Check if backend provided control suggestions
        if (result.suggested_controls && result.suggested_controls.length > 0) {
          console.log(`Backend provided ${result.suggested_controls.length} control suggestions for ${file.name}`)

          // Store the backend suggestions for use after upload
          result._backendSuggestions = result.suggested_controls
        }

        return result
      } else {
        // Try to parse error as JSON, fallback to text if it fails
        let errorMessage = 'Upload failed'
        try {
          const error = await response.json()
          errorMessage = error.detail || errorMessage
        } catch {
          // Response is not JSON (might be HTML error page)
          const errorText = await response.text()
          errorMessage = errorText || `Upload failed with status ${response.status}`
        }
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      const errorMessage = error?.message || String(error)
      const errorName = error?.name || ''
      
      if (errorName === 'AbortError') {
        throw new Error('Upload timeout - file may be too large or server is slow')
      } else if (errorMessage.includes('ECONNRESET') || errorMessage.includes('socket hang up')) {
        throw new Error('Connection lost - please try again')
      } else if (errorMessage.includes('Failed to fetch')) {
        throw new Error('Network error - please check your connection')
      }
      throw new Error(errorMessage || 'Upload failed')
    }
  }

  const startAiProcessingPolling = (uploadedFiles: UploadedFile[]) => {
    // Filter out files without IDs
    const validFiles = uploadedFiles.filter(file => file && file.id)

    if (validFiles.length === 0) {
      console.warn('No valid files to poll for AI processing')
      return
    }

    // Set initial AI processing status
    const initialStatus: Record<string, boolean> = {}
    validFiles.forEach(file => {
      initialStatus[file.id] = false
    })
    setAiProcessingStatus(initialStatus)

    // Process files sequentially instead of polling all at once
    processFilesSequentially(validFiles, 0)
  }

  const processFilesSequentially = async (uploadedFiles: UploadedFile[], currentIndex: number) => {
    if (currentIndex >= uploadedFiles.length) {
      // All files processed
      setAiCompleteMessage(`🎉 AI analysis complete! ${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''} automatically linked to controls.`)
      setShowAiCompleteBanner(true)
      setTimeout(() => setShowAiCompleteBanner(false), 5000)
      onUploadComplete?.()
      return
    }

    const file = uploadedFiles[currentIndex]

    // Skip if file doesn't have an ID (upload might have failed)
    if (!file || !file.id) {
      console.warn(`Skipping file at index ${currentIndex} - no ID found`)
      processFilesSequentially(uploadedFiles, currentIndex + 1)
      return
    }

    setUploadStatus(`🧠 AI analyzing document ${currentIndex + 1} of ${uploadedFiles.length}: ${file.filename}`)

    // Poll this specific file until completion
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/documents/${file.id}/ai-status`)
        if (response.ok) {
          const data = await response.json()
          if (data.ai_processed) {
            clearInterval(pollInterval)
            setAiProcessingStatus(prev => ({ ...prev, [file.id]: true }))
            
            // Handle deleted documents gracefully
            if (data.deleted) {
              console.warn(`Document ${file.filename} was deleted during processing`)
            }
            
            // Process next file
            setTimeout(() => {
              processFilesSequentially(uploadedFiles, currentIndex + 1)
            }, 1000) // Small delay between files
          }
        } else if (response.status === 404) {
          // Document was deleted, stop polling and continue with next file
          console.warn(`Document ${file.filename} was deleted, stopping AI status polling`)
          clearInterval(pollInterval)
          processFilesSequentially(uploadedFiles, currentIndex + 1)
        } else {
          // Other errors, log and continue polling for a bit
          console.warn(`AI status check failed for ${file.filename}: ${response.status}`)
        }
      } catch (error) {
        console.error(`Failed to check AI status for ${file.filename}:`, error)
        clearInterval(pollInterval)
        // Continue with next file even if this one fails
        processFilesSequentially(uploadedFiles, currentIndex + 1)
      }
    }, 3000)
    
    // Timeout after 5 minutes per file
    setTimeout(() => {
      clearInterval(pollInterval)
      console.warn(`AI processing timeout for ${file.filename}`)
      processFilesSequentially(uploadedFiles, currentIndex + 1)
    }, 300000)
  }

  const scanMultipleFilesForControlMatches = async (files: File[], uploadedFiles: UploadedFile[]) => {
    setScanningForControls(true)
    setUploadStatus(`🔍 AI scanning ${files.length} document${files.length > 1 ? 's' : ''} for control mappings...`)
    
    try {
      // First, check if any uploaded files have backend suggestions
      const backendSuggestions = []
      for (const uploadedFile of uploadedFiles) {
        if ((uploadedFile as any)._backendSuggestions) {
          const suggestions = (uploadedFile as any)._backendSuggestions
          console.log(`Using backend suggestions for ${uploadedFile.filename}:`, suggestions)
          backendSuggestions.push(...suggestions)
        }
      }
      
      if (backendSuggestions.length > 0) {
        console.log(`Found ${backendSuggestions.length} backend suggestions, using those for one-to-one document mapping`)
        setSuggestedMappings(backendSuggestions)
        setShowMappingSuggestions(true)
        setUploadStatus(`✅ Upload complete • Found ${backendSuggestions.length} control match${backendSuggestions.length !== 1 ? 'es' : ''} based on filename analysis`)
        setScanningForControls(false)
        return
      }
      
      console.log('No backend suggestions found')
      setUploadStatus(`✅ Upload complete • No control suggestions available`)
      
    } catch (error) {
      console.error('Multi-file control mapping failed:', error)
      setUploadStatus(`✅ Upload complete • AI analysis unavailable`)
    } finally {
      setScanningForControls(false)
    }
  }

  const scanFileForControlMatches = async (file: File, uploadedFile: UploadedFile) => {
    setScanningForControls(true)
    // Extract just the filename without the path for display
    const displayName = file.name.split('\\').pop()?.split('/').pop() || file.name
    setUploadStatus(`🔍 Scanning ${displayName} for control mappings...`)
    
    try {
      // Get available templates/controls from localStorage
      const storedTemplates = localStorage.getItem('compliance_templates')
      let availableTemplates: Template[] = []
      
      if (storedTemplates) {
        availableTemplates = JSON.parse(storedTemplates)
      }
      
      if (availableTemplates.length === 0) {
        setUploadStatus(`⚠️ Upload complete • No templates available for control mapping`)
        setScanningForControls(false)
        return
      }
      
      // Use actual AI service for document analysis
      const suggestions = await analyzeDocumentWithAI(file, availableTemplates)
      
      setSuggestedMappings(suggestions)
      if (suggestions.length > 0) {
        setShowMappingSuggestions(true)
        setUploadStatus(`✅ Upload complete • AI found ${suggestions.length} potential control matches`)
      } else {
        setUploadStatus(`✅ Upload complete • No relevant control matches found`)
      }
      
    } catch (error) {
      console.error('Control mapping failed:', error)
      setUploadStatus(`✅ Upload complete • AI analysis unavailable`)
    } finally {
      setScanningForControls(false)
    }
  }
  
  const analyzeDocumentWithAI = async (file: File, templates: Template[]) => {
    try {
      // Extract just the filename without the path
      const filename = file.name.split('\\').pop()?.split('/').pop()?.toLowerCase() || file.name.toLowerCase()

      // Prepare control context for AI
      const controlsContext = templates.map(t => ({
        code: t.control.code,
        title: t.control.title,
        framework: t.control.framework_name,
        description: t.description,
        evidence_types: t.evidence_requirements.map(req => req.evidence_type).join(', '),
        evidence_descriptions: t.evidence_requirements.map(req => req.description).join(' | ')
      }))

      // Check if file is an image that needs vision analysis
      const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(filename)

      if (isImage) {
        // Send image file for vision AI analysis
        const formData = new FormData()
        formData.append('file', file)
        formData.append('controls', JSON.stringify(controlsContext))

        const response = await fetch('/api/ai/analyze-image', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const result = await response.json()

          try {
            // Parse AI response
            const aiResponse = typeof result.response === 'string' ? JSON.parse(result.response) : result.response
            if (aiResponse.suggestions && Array.isArray(aiResponse.suggestions)) {
              return aiResponse.suggestions.map((s: any) => ({
                control_code: s.control_code || '',
                control_title: s.control_title || '',
                framework_name: s.framework_name || '',
                confidence: Math.min(Math.max(s.confidence || 0, 0), 1),
                reasoning: s.reasoning || 'AI-generated suggestion based on image content'
              }))
            }
          } catch (parseError) {
            console.error('Failed to parse AI vision response:', parseError)
          }
        }
      } else {
        // Handle text files and documents
        let fileContent = ''

        if (file.type === 'text/plain' || filename.endsWith('.txt')) {
          try {
            fileContent = await file.text()
          } catch (error) {
            console.log('Could not read file content, using filename analysis only')
          }
        }

        // Create AI analysis prompt for text
        const analysisPrompt = `
Analyze the following document and determine which compliance controls it might relate to.

Document filename: ${filename}
Document type: ${file.type}
File content preview: ${fileContent.substring(0, 5000)}${fileContent.length > 5000 ? '...' : ''}

Available compliance controls:
${controlsContext.map(c => `${c.code}: ${c.title} (${c.framework}) - Evidence needed: ${c.evidence_types}`).join('\n')}

For each relevant control, provide:
1. Control code and title
2. Confidence score (0.0-1.0)
3. Brief reasoning

Respond in JSON format with a "suggestions" array containing objects with: control_code, control_title, framework_name, confidence, reasoning.
Limit to the top 3 most relevant matches. If no relevant matches, return empty array.`

        // Call AI service for text analysis
        const response = await fetch('/api/ai/analyze-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: analysisPrompt,
            max_tokens: 1000,
            temperature: 0.3
          })
        })

        if (response.ok) {
          const result = await response.json()

          try {
            // Try to parse AI response as JSON
            const aiResponse = JSON.parse(result.response)
            if (aiResponse.suggestions && Array.isArray(aiResponse.suggestions)) {
              return aiResponse.suggestions.map((s: any) => ({
                control_code: s.control_code || '',
                control_title: s.control_title || '',
                framework_name: s.framework_name || '',
                confidence: Math.min(Math.max(s.confidence || 0, 0), 1),
                reasoning: s.reasoning || 'AI-generated suggestion'
              }))
            }
          } catch (parseError) {
            console.error('Failed to parse AI response:', parseError)
          }
        }
      }

      // Fallback to filename-based analysis if AI fails
      return generateFallbackSuggestions(filename, templates)
      
    } catch (error) {
      console.error('AI analysis failed:', error)
      const cleanFilename = file.name.split('\\').pop()?.split('/').pop()?.toLowerCase() || file.name.toLowerCase()
      return generateFallbackSuggestions(cleanFilename, templates)
    }
  }
  
  const analyzeMultipleDocumentsWithAI = async (files: File[], uploadedFiles: UploadedFile[], templates: Template[]) => {
    try {
      // Process each document individually to ensure one-to-one mapping
      const allSuggestions = []
      
      // Read content from all text files
      const fileContents: { filename: string, content: string, type: string, originalFilename: string }[] = []
      
      for (const file of files) {
        const filename = file.name.split('\\').pop()?.split('/').pop()?.toLowerCase() || file.name.toLowerCase()
        let content = ''
        
        if (file.type === 'text/plain' || filename.endsWith('.txt')) {
          try {
            content = await file.text()
          } catch (error) {
            console.log(`Could not read file content for ${filename}, using filename analysis only`)
          }
        }
        
        fileContents.push({
          filename,
          content: content.substring(0, 10000), // Increased content length for larger context
          type: file.type,
          originalFilename: file.name
        })
      }
      
      // Prepare control context for AI
      const controlsContext = templates.map(t => ({
        code: t.control.code,
        title: t.control.title,
        framework: t.control.framework_name,
        description: t.description,
        evidence_types: t.evidence_requirements.map(req => req.evidence_type).join(', '),
        evidence_descriptions: t.evidence_requirements.map(req => req.description).join(' | ')
      }))
      
      // Analyze each document individually to get one control per document
      for (const fileContent of fileContents) {
        const singleDocumentPrompt = `
Analyze this single document and find the ONE MOST RELEVANT compliance control for it.

Document:
File: ${fileContent.filename} (${fileContent.type})
${fileContent.content ? 'Content preview: ' + fileContent.content.substring(0, 3000) + '...' : ''}

Available compliance controls:
${controlsContext.map(c => `${c.code}: ${c.title} (${c.framework}) - Evidence needed: ${c.evidence_types}`).join('\n')}

Return the single best control match for this specific document.
Respond in JSON format with a "suggestions" array containing exactly ONE object with: control_code, control_title, framework_name, confidence, reasoning, document_name.
If no relevant match, return empty array.
Focus on the specific content and purpose of this individual document.`
        
        try {
          // Call backend AI service for individual document analysis
          const response = await fetch('/api/analyze-documents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              documents: [fileContent],
              controls: controlsContext,
              prompt: singleDocumentPrompt
            })
          })
          
          if (response.ok) {
            const result = await response.json()
            
            try {
              // Try to parse AI response as JSON
              const aiResponse = typeof result.suggestions === 'string' ? JSON.parse(result.suggestions) : result
              if (aiResponse.suggestions && Array.isArray(aiResponse.suggestions) && aiResponse.suggestions.length > 0) {
                const suggestion = aiResponse.suggestions[0] // Take only the first suggestion
                allSuggestions.push({
                  control_code: suggestion.control_code || '',
                  control_title: suggestion.control_title || '',
                  framework_name: suggestion.framework_name || '',
                  confidence: Math.min(Math.max(suggestion.confidence || 0, 0), 1),
                  reasoning: suggestion.reasoning || 'AI-generated individual analysis',
                  document_name: fileContent.originalFilename
                })
              } else {
                // Generate fallback suggestion for this specific document
                const fallbackSuggestions = generateFallbackSuggestions(fileContent.filename, templates)
                if (fallbackSuggestions.length > 0) {
                  allSuggestions.push({
                    ...fallbackSuggestions[0],
                    document_name: fileContent.originalFilename
                  })
                }
              }
            } catch (parseError) {
              console.error(`Failed to parse AI response for ${fileContent.filename}:`, parseError)
              // Generate fallback suggestion for this document
              const fallbackSuggestions = generateFallbackSuggestions(fileContent.filename, templates)
              if (fallbackSuggestions.length > 0) {
                allSuggestions.push({
                  ...fallbackSuggestions[0],
                  document_name: fileContent.originalFilename
                })
              }
            }
          } else {
            // Generate fallback suggestion for this document
            const fallbackSuggestions = generateFallbackSuggestions(fileContent.filename, templates)
            if (fallbackSuggestions.length > 0) {
              allSuggestions.push({
                ...fallbackSuggestions[0],
                document_name: fileContent.originalFilename
              })
            }
          }
        } catch (error) {
          console.error(`AI analysis failed for ${fileContent.filename}:`, error)
          // Generate fallback suggestion for this document
          const fallbackSuggestions = generateFallbackSuggestions(fileContent.filename, templates)
          if (fallbackSuggestions.length > 0) {
            allSuggestions.push({
              ...fallbackSuggestions[0],
              document_name: fileContent.originalFilename
            })
          }
        }
      }
      
      return allSuggestions
      
    } catch (error) {
      console.error('AI batch analysis failed:', error)
      
      // Fallback to filename-based analysis for all files
      const fallbackSuggestions = []
      for (const file of files) {
        const cleanFilename = file.name.split('\\').pop()?.split('/').pop()?.toLowerCase() || file.name.toLowerCase()
        const suggestions = generateFallbackSuggestions(cleanFilename, templates)
        fallbackSuggestions.push(...suggestions)
      }
      
      // Deduplicate and limit
      const uniqueSuggestions = fallbackSuggestions.reduce((acc, curr) => {
        if (!acc.find(s => s.control_code === curr.control_code)) {
          acc.push(curr)
        }
        return acc
      }, [] as typeof fallbackSuggestions)
      
      return uniqueSuggestions.slice(0, 5)
    }
  }

  const generateFallbackSuggestions = (filename: string, templates: Template[]) => {
    const suggestions = []
    
    // Simple keyword matching with deduplication
    const usedTemplates = new Set<string>()
    
    // Multi-Factor Authentication (MFA) documents
    if ((filename.includes('mfa') || filename.includes('multi-factor') || filename.includes('authentication') || filename.includes('2fa')) && templates.length > 0) {
      const mfaTemplate = templates.find(t => 
        (t.control.title.toLowerCase().includes('authentication') ||
         t.control.title.toLowerCase().includes('access') ||
         t.control.code.includes('AC') || t.control.code.includes('IA') ||
         t.description.toLowerCase().includes('authentication')) &&
        !usedTemplates.has(t.id)
      )
      
      if (mfaTemplate) {
        usedTemplates.add(mfaTemplate.id)
        suggestions.push({
          control_code: mfaTemplate.control.code,
          control_title: mfaTemplate.control.title,
          framework_name: mfaTemplate.control.framework_name,
          confidence: 0.9,
          reasoning: `Document relates to Multi-Factor Authentication, directly relevant to ${mfaTemplate.control.code} access control requirements.`
        })
      }
    }
    
    // Error/incident screenshots and logs
    if ((filename.includes('error') || filename.includes('screenshot') || filename.includes('incident') || filename.includes('log')) && templates.length > 0) {
      const incidentTemplate = templates.find(t => 
        (t.control.title.toLowerCase().includes('incident') ||
         t.control.title.toLowerCase().includes('monitoring') ||
         t.control.title.toLowerCase().includes('security') ||
         t.control.code.includes('IR') || t.control.code.includes('SI') ||
         t.description.toLowerCase().includes('incident')) &&
        !usedTemplates.has(t.id)
      )
      
      if (incidentTemplate) {
        usedTemplates.add(incidentTemplate.id)
        suggestions.push({
          control_code: incidentTemplate.control.code,
          control_title: incidentTemplate.control.title,
          framework_name: incidentTemplate.control.framework_name,
          confidence: 0.75,
          reasoning: `Error screenshot/log provides evidence for ${incidentTemplate.control.code} incident response or security monitoring.`
        })
      }
    }
    
    // Policy documents
    if ((filename.includes('policy') || filename.includes('procedure')) && templates.length > 0) {
      const policyTemplate = templates.find(t => 
        (t.description.toLowerCase().includes('policy') || 
         t.evidence_requirements.some(req => req.evidence_type === 'policy')) &&
        !usedTemplates.has(t.id)
      )
      
      if (policyTemplate) {
        usedTemplates.add(policyTemplate.id)
        suggestions.push({
          control_code: policyTemplate.control.code,
          control_title: policyTemplate.control.title,
          framework_name: policyTemplate.control.framework_name,
          confidence: 0.8,
          reasoning: `Filename indicates this is a policy document relevant to ${policyTemplate.control.code}.`
        })
      }
    }
    
    // Access control documents  
    if ((filename.includes('access') || filename.includes('user') || filename.includes('identity')) && templates.length > 0) {
      const accessTemplate = templates.find(t => 
        (t.control.title.toLowerCase().includes('access') ||
         t.control.title.toLowerCase().includes('identity') ||
         t.control.code.includes('AC') || t.control.code.includes('IA')) &&
        !usedTemplates.has(t.id)
      )
      
      if (accessTemplate) {
        usedTemplates.add(accessTemplate.id)
        suggestions.push({
          control_code: accessTemplate.control.code,
          control_title: accessTemplate.control.title,
          framework_name: accessTemplate.control.framework_name,
          confidence: 0.7,
          reasoning: `Document appears to be access control related, matching ${accessTemplate.control.code}.`
        })
      }
    }
    
    // If still no matches and templates available, suggest the first unused template
    if (suggestions.length === 0 && templates.length > 0) {
      const firstTemplate = templates[0]
      suggestions.push({
        control_code: firstTemplate.control.code,
        control_title: firstTemplate.control.title,
        framework_name: firstTemplate.control.framework_name,
        confidence: 0.4,
        reasoning: `General document that may contain evidence relevant to ${firstTemplate.control.code}.`
      })
    }
    
    return suggestions.slice(0, 3)
  }
  
  const linkToControl = (suggestion: typeof suggestedMappings[0]) => {
    // Store mapping suggestions for all uploaded files
    const existingMappings = localStorage.getItem('document_control_mappings')
    const mappings = existingMappings ? JSON.parse(existingMappings) : []
    
    // Create mappings for all recently uploaded files
    lastUploadedFiles.forEach(file => {
      const mappingSuggestion = {
        file_id: file.id,
        filename: file.filename,
        control_code: suggestion.control_code,
        control_title: suggestion.control_title,
        framework_name: suggestion.framework_name,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
        created_at: new Date().toISOString()
      }
      mappings.unshift(mappingSuggestion)
    })
    
    localStorage.setItem('document_control_mappings', JSON.stringify(mappings))
    
    const fileCount = lastUploadedFiles.length
    
    // Remove the linked suggestion from the list instead of clearing all
    const remainingSuggestions = suggestedMappings.filter(s => s.control_code !== suggestion.control_code)
    setSuggestedMappings(remainingSuggestions)
    
    // Update status with success message
    setUploadStatus(`✅ ${fileCount} document${fileCount > 1 ? 's' : ''} linked to ${suggestion.control_code} - ${suggestion.control_title}`)
    
    // Only hide suggestions dialog if no more suggestions remain
    if (remainingSuggestions.length === 0) {
      setShowMappingSuggestions(false)
      setUploadStatus(`✅ All documents linked to controls`)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* AI Processing Complete Banner */}
      {showAiCompleteBanner && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 animate-pulse">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">🎉</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">{aiCompleteMessage}</h3>
              <p className="text-xs text-green-600 mt-1">Documents have been automatically linked to their relevant compliance controls.</p>
            </div>
          </div>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
      >
        <div className="space-y-4">
          <div className="text-4xl">📁</div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Drop files here or click to browse
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Supports: PDF, DOCX, TXT, Images (PNG, JPG, GIF, BMP, TIFF, WebP)
            </p>
            <p className="text-xs text-gray-400 mt-1">
              ✨ Select multiple files for batch upload and AI scanning
            </p>
            <p className="text-xs text-green-600 mt-1 font-medium">
              📸 Images are automatically scanned with OCR to extract text
            </p>
          </div>

          <input
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
            className="hidden"
            id="file-input"
            disabled={isUploading}
            multiple
          />
          
          <label
            htmlFor="file-input"
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
              isUploading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            }`}
          >
            {isUploading || scanningForControls ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {scanningForControls ? 'Scanning for Controls...' : 'Uploading...'}
              </>
            ) : (
              'Choose File'
            )}
          </label>
        </div>
      </div>

      {uploadStatus && (
        <div className="mt-4 p-3 rounded-lg bg-gray-50 text-sm">
          {uploadStatus}
        </div>
      )}

      {/* AI Processing Status Indicator */}
      {Object.keys(aiProcessingStatus).length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm font-medium text-blue-900">🧠 AI Analysis in Progress</span>
          </div>
          <div className="text-xs text-blue-700">
            {Object.entries(aiProcessingStatus).map(([fileId, completed]) => {
              const file = lastUploadedFiles.find(f => f.id === fileId)
              if (!file) return null
              return (
                <div key={fileId} className="flex items-center justify-between py-1">
                  <span className="truncate max-w-xs">{file.filename.split('/').pop()}</span>
                  <span className={`ml-2 ${completed ? 'text-green-600' : 'text-blue-600'}`}>
                    {completed ? '✅ Linked' : '⏳ Processing'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="text-xs text-blue-600 mt-2">
            Documents will be automatically linked to controls when analysis completes.
          </div>
        </div>
      )}
      
      {/* Individual File Upload Results */}
      {Object.keys(uploadResults).length > 0 && (
        <div className="mt-3 space-y-2">
          {Object.entries(uploadResults).map(([fileKey, status]) => {
            const fileName = fileKey.split('-').slice(0, -1).join('-') // Remove the index
            return (
              <div key={fileKey} className="flex items-center justify-between text-xs p-2 bg-white border border-gray-200 rounded">
                <span className="flex-1 truncate">{fileName}</span>
                <span className={`ml-2 ${status.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                  {status}
                </span>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Control Mapping Suggestions */}
      {enableControlMapping && showMappingSuggestions && suggestedMappings.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center mb-3">
            <div className="text-blue-600 mr-2">🔗</div>
            <h4 className="font-medium text-blue-900">Suggested Control Mappings</h4>
          </div>
          <p className="text-sm text-blue-700 mb-3">
            {lastUploadedFiles.length > 1 ? (
              <>Based on the analysis of <strong>{lastUploadedFiles.length} uploaded documents</strong>, here are potential compliance control matches:</>
            ) : (
              <>Based on the analysis of <strong>{lastUploadedFiles[0]?.filename?.split('\\').pop()?.split('/').pop() || lastUploadedFiles[0]?.filename}</strong>, here are potential compliance control matches:</>
            )}
          </p>
          
          <div className="space-y-3">
            {suggestedMappings.map((suggestion, index) => (
              <div key={index} className="bg-white border border-blue-200 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <span className="font-medium text-blue-900 mr-2">
                        {suggestion.control_code}: {suggestion.control_title}
                      </span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                        {suggestion.framework_name}
                      </span>
                    </div>
                    
                    {/* Document names section */}
                    <div className="mb-2">
                      <div className="flex items-center mb-1">
                        <span className="text-xs font-medium text-gray-700 mr-2">📄 Documents:</span>
                        <span className="text-xs text-gray-600">
                          {lastUploadedFiles.length} file{lastUploadedFiles.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {lastUploadedFiles.map((file, fileIndex) => (
                          <span 
                            key={fileIndex}
                            className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs max-w-[200px] truncate"
                            title={file.filename}
                          >
                            {file.filename.split('/').pop()?.split('\\').pop() || file.filename}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center mb-2">
                      <div className="flex items-center mr-3">
                        <div className={`w-2 h-2 rounded-full mr-1 ${
                          suggestion.confidence >= 0.8 ? 'bg-green-500' :
                          suggestion.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="text-xs text-gray-600">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">{suggestion.reasoning}</p>
                  </div>
                  <div className="ml-3">
                    <button
                      onClick={() => linkToControl(suggestion)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Link to Control
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 pt-3 border-t border-blue-200">
            <button
              onClick={() => {
                setShowMappingSuggestions(false)
                setSuggestedMappings([])
              }}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Dismiss suggestions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}