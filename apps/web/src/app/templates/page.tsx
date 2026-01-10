'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { essentialEightTemplates, EssentialEightTemplate as EssentialEightTemplateData } from '../../data/essential-eight-templates';

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
  created_at: string;
  framework_name?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  control: {
    id: string;
    code: string;
    title: string;
    framework_name: string;
  };
  company_fields: Array<{
    field_name: string;
    field_type: 'text' | 'textarea' | 'select' | 'file';
    required: boolean;
    placeholder?: string;
    description?: string;
    options?: string[];
  }>;
  evidence_requirements: Array<{
    requirement_id?: string;
    requirement_code: string;
    evidence_type: string;
    description: string;
    required: boolean;
    ai_validation_prompt?: string;
  }>;
  created_at: string;
  updated_at: string;
  isSatisfied?: boolean;
  isGap?: boolean;
}

// Essential Eight Templates are now imported from shared data file

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allRequiredTemplates, setAllRequiredTemplates] = useState<Template[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEssentialEightDropdown, setShowEssentialEightDropdown] = useState(false);
  const [controlsWithEvidence, setControlsWithEvidence] = useState<{ [key: string]: boolean }>({});
  const [controlsAIData, setControlsAIData] = useState<{ [key: string]: any }>({});
  
  // Create template form state
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    control_id: '',
    company_fields: [
      { field_name: 'company_name', field_type: 'text' as const, required: true, placeholder: 'Enter your company name' },
      { field_name: 'company_address', field_type: 'textarea' as const, required: false, placeholder: 'Enter company address' },
      { field_name: 'contact_person', field_type: 'text' as const, required: true, placeholder: 'Primary contact person' },
      { field_name: 'contact_email', field_type: 'text' as const, required: true, placeholder: 'contact@company.com' }
    ],
    evidence_requirements: [] as any[]
  });

  useEffect(() => {
    Promise.all([
      fetchTemplates(),
      fetchFrameworks()
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showEssentialEightDropdown && !target.closest('.dropdown-container')) {
        setShowEssentialEightDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEssentialEightDropdown]);

  const fetchTemplates = async () => {
    try {
      // Fetch templates from localStorage (where Essential Eight templates will be stored)
      const storedTemplates = localStorage.getItem('compliance_templates');
      const existingTemplates: Template[] = storedTemplates ? JSON.parse(storedTemplates) : [];
      setTemplates(existingTemplates);

      // Fetch controls from API to check if they have linked documents/evidence and AI scan data
      const controlsEvidenceMap: { [key: string]: boolean } = {};
      const controlsAI: { [key: string]: any } = {};
      try {
        // Try to fetch Essential Eight framework controls
        const frameworksResponse = await fetch('/api/frameworks');
        if (frameworksResponse.ok) {
          const frameworksData = await frameworksResponse.json();
          const essentialEightFramework = frameworksData.frameworks?.find(
            (f: any) => f.name?.toLowerCase().includes('essential eight')
          );

          if (essentialEightFramework) {
            const controlsResponse = await fetch(`/api/frameworks/${essentialEightFramework.id}/controls`);
            if (controlsResponse.ok) {
              const controlsData = await controlsResponse.json();

              // Fetch scans for each control to get AI analysis data
              for (const control of controlsData.controls || []) {
                // Mark as satisfied if control has linked documents
                controlsEvidenceMap[control.code] = (control.linked_documents_count || 0) > 0;

                // Fetch scan data for this control
                try {
                  const scansResponse = await fetch(`/api/controls/${control.id}/scans`);
                  if (scansResponse.ok) {
                    const scansData = await scansResponse.json();
                    const latestScan = scansData.scans?.[0]; // Get most recent scan

                    if (latestScan && latestScan.status === 'completed') {
                      controlsAI[control.code] = {
                        scanId: latestScan.id,
                        status: latestScan.status,
                        completedAt: latestScan.completed_at,
                        passRate: latestScan.pass_count && latestScan.total_requirements
                          ? Math.round((latestScan.pass_count / latestScan.total_requirements) * 100)
                          : null,
                        gapsCount: latestScan.gap_count || 0,
                        hasGaps: (latestScan.gap_count || 0) > 0
                      };
                    }
                  }
                } catch (error) {
                  console.error(`Failed to fetch scans for control ${control.code}:`, error);
                }
              }
            }
          }
        }
        setControlsWithEvidence(controlsEvidenceMap);
        setControlsAIData(controlsAI);
      } catch (error) {
        console.error('Failed to fetch controls evidence status:', error);
      }

      // Convert Essential Eight templates to Template format and check if they're satisfied
      const essentialEightAsTemplates: Template[] = essentialEightTemplates.map(eeTemplate => {
        // Check if a template already exists for this control
        const existingTemplate = existingTemplates.find(
          (t: Template) => t.control?.code === eeTemplate.code
        );

        // Control is satisfied ONLY if it has linked documents (actual evidence)
        // NOT just because a template was generated
        const hasEvidence = controlsEvidenceMap[eeTemplate.code] || false;
        const hasTemplate = !!existingTemplate;
        const isSatisfied = hasEvidence; // Only satisfied if evidence exists, not just template
        const isGap = !hasTemplate; // Gap only if template not generated yet

        return {
          id: eeTemplate.id,
          name: `${eeTemplate.code} - ${eeTemplate.title}`,
          description: eeTemplate.description,
          control: {
            id: eeTemplate.id,
            code: eeTemplate.code,
            title: eeTemplate.title,
            framework_name: 'Essential Eight'
          },
          company_fields: eeTemplate.company_fields,
          evidence_requirements: eeTemplate.evidence_requirements,
          created_at: '',
          updated_at: '',
          isSatisfied,
          isGap
        };
      });

      // Add satisfaction status to existing generated templates
      const existingTemplatesWithStatus = existingTemplates.map((template: Template) => ({
        ...template,
        isSatisfied: controlsEvidenceMap[template.control?.code] || false,
        isGap: false // Already generated, so not a gap
      }));

      // Combine custom templates with Essential Eight templates
      // Only add Essential Eight templates that haven't been generated yet (gaps)
      const allTemplates = [
        ...existingTemplatesWithStatus,
        ...essentialEightAsTemplates.filter(eeTemplate => {
          // Don't show if a generated template already exists for this control
          const alreadyGenerated = existingTemplates.some(
            (t: Template) => t.control?.code === eeTemplate.control.code
          );
          return !alreadyGenerated;
        })
      ];
      setAllRequiredTemplates(allTemplates);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setTemplates([]);
      setAllRequiredTemplates([]);
    }
  };

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
    try {
      const response = await fetch(`/api/frameworks/${frameworkId}/controls`);
      if (response.ok) {
        const data = await response.json();
        setControls(data.controls);
      }
    } catch (error) {
      console.error('Failed to fetch controls:', error);
    }
  };

  const handleFrameworkChange = (frameworkId: string) => {
    setSelectedFramework(frameworkId);
    fetchControls(frameworkId);
  };

  const addCompanyField = () => {
    setNewTemplate(prev => ({
      ...prev,
      company_fields: [
        ...prev.company_fields,
        { field_name: '', field_type: 'text', required: false, placeholder: '' }
      ]
    }));
  };

  const updateCompanyField = (index: number, field: any) => {
    setNewTemplate(prev => ({
      ...prev,
      company_fields: prev.company_fields.map((f, i) => i === index ? { ...f, ...field } : f)
    }));
  };

  const removeCompanyField = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      company_fields: prev.company_fields.filter((_, i) => i !== index)
    }));
  };

  const addEvidenceRequirement = () => {
    setNewTemplate(prev => ({
      ...prev,
      evidence_requirements: [
        ...prev.evidence_requirements,
        {
          requirement_id: '',
          requirement_code: '',
          evidence_type: 'document',
          description: '',
          required: true
        }
      ]
    }));
  };

  const updateEvidenceRequirement = (index: number, field: any) => {
    setNewTemplate(prev => ({
      ...prev,
      evidence_requirements: prev.evidence_requirements.map((r, i) => i === index ? { ...r, ...field } : r)
    }));
  };

  const removeEvidenceRequirement = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      evidence_requirements: prev.evidence_requirements.filter((_, i) => i !== index)
    }));
  };

  const generateEssentialEightTemplate = async (eeTemplateId: string) => {
    const eeTemplate = essentialEightTemplates.find(t => t.id === eeTemplateId);
    if (!eeTemplate) return;

    try {
      const newTemplate: Template = {
        id: `ee-template-${eeTemplateId}-${Date.now()}`,
        name: `${eeTemplate.code} - ${eeTemplate.title} Policy Template`,
        description: `Policy template for ${eeTemplate.title}: ${eeTemplate.description}`,
        control: {
          id: eeTemplate.id,
          code: eeTemplate.code,
          title: eeTemplate.title,
          framework_name: 'Essential Eight'
        },
        company_fields: eeTemplate.company_fields,
        evidence_requirements: eeTemplate.evidence_requirements,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Store in localStorage
      const existingTemplates = localStorage.getItem('compliance_templates');
      const templates = existingTemplates ? JSON.parse(existingTemplates) : [];

      // Check if template already exists for this control
      const existingTemplate = templates.find((t: any) => t.control?.code === eeTemplate.code);
      if (existingTemplate) {
        alert(`Template for ${eeTemplate.code} already exists!`);
        return;
      }

      templates.push(newTemplate);
      localStorage.setItem('compliance_templates', JSON.stringify(templates));

      // Refresh templates
      fetchTemplates();
      setShowEssentialEightDropdown(false);

      alert(`Template created for ${eeTemplate.code}!`);
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('Failed to create template. Please try again.');
    }
  };

  const createTemplate = async () => {
    try {
      const foundControl = controls.find(c => c.id === newTemplate.control_id);
      const template: Template = {
        id: Date.now().toString(),
        ...newTemplate,
        control: foundControl ? {
          id: foundControl.id,
          code: foundControl.code,
          title: foundControl.title,
          framework_name: foundControl.framework_name || 'Custom'
        } : {
          id: newTemplate.control_id,
          code: 'Custom',
          title: 'Custom Control',
          framework_name: 'Custom'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Store in localStorage
      const existingTemplates = localStorage.getItem('compliance_templates');
      const templates = existingTemplates ? JSON.parse(existingTemplates) : [];
      templates.unshift(template);
      localStorage.setItem('compliance_templates', JSON.stringify(templates));

      // Update state and refresh
      fetchTemplates();
      setShowCreateModal(false);
      setNewTemplate({
        name: '',
        description: '',
        control_id: '',
        company_fields: [
          { field_name: 'company_name', field_type: 'text', required: true, placeholder: 'Enter your company name' },
          { field_name: 'company_address', field_type: 'textarea', required: false, placeholder: 'Enter company address' },
          { field_name: 'contact_person', field_type: 'text', required: true, placeholder: 'Primary contact person' },
          { field_name: 'contact_email', field_type: 'text', required: true, placeholder: 'contact@company.com' }
        ],
        evidence_requirements: []
      });
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('Failed to create template. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Control Templates</h1>
              <p className="text-gray-600">
                Create and manage templates for compliance controls with company-specific fields and evidence requirements.
              </p>
            </div>
            <div className="flex space-x-3">
              <div className="relative dropdown-container">
                <button
                  onClick={() => setShowEssentialEightDropdown(!showEssentialEightDropdown)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Essential Eight Templates
                  <svg className="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {showEssentialEightDropdown && (
                  <div className="absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 max-h-96 overflow-y-auto">
                    <div className="py-1" role="menu">
                      {essentialEightTemplates.map((eeTemplate) => {
                        const existingTemplate = templates.find(t => t.control?.code === eeTemplate.code);
                        const hasEvidence = controlsWithEvidence[eeTemplate.code] || false;
                        const isSatisfied = hasEvidence || !!existingTemplate;

                        return (
                          <button
                            key={eeTemplate.id}
                            onClick={() => generateEssentialEightTemplate(eeTemplate.id)}
                            disabled={isSatisfied}
                            className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 ${
                              isSatisfied
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                            role="menuitem"
                          >
                            <div className="font-medium">{eeTemplate.code}: {eeTemplate.title}</div>
                            <div className="text-xs mt-1">
                              {existingTemplate ? (
                                <span className="text-green-600">✓ Template Created</span>
                              ) : hasEvidence ? (
                                <span className="text-green-600">✓ Evidence Linked</span>
                              ) : (
                                <span className="text-gray-500">Click to generate template</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allRequiredTemplates.map((template) => {
            const isGap = template.isGap;
            const isSatisfied = template.isSatisfied;
            const aiData = controlsAIData[template.control.code];

            return (
              <div
                key={template.id}
                className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
                  isSatisfied ? 'border-green-300' : isGap ? 'border-yellow-300' : 'border-gray-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {template.name}
                        </h3>
                      </div>
                      <p className="text-sm text-blue-600 mt-1">
                        {template.control.code}: {template.control.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                          {template.control.framework_name}
                        </span>
                        {isSatisfied && (
                          <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                            ✓ Requirement Satisfied
                          </span>
                        )}
                        {isGap && (
                          <span className="inline-block bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full">
                            ⚠ Gap - Template Needed
                          </span>
                        )}
                        {aiData && aiData.passRate !== null && (
                          <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                            aiData.passRate >= 80 ? 'bg-green-100 text-green-700' :
                            aiData.passRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            AI: {aiData.passRate}% Pass
                          </span>
                        )}
                        {aiData && aiData.hasGaps && (
                          <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                            {aiData.gapsCount} Gap{aiData.gapsCount !== 1 ? 's' : ''} Found
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {isGap
                      ? `This is a required template for ${template.control.framework_name}. Click "Generate Template" to create it from the Essential Eight Templates dropdown above.`
                      : template.description
                    }
                  </p>

                  {aiData && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs font-semibold text-blue-900 mb-2">AI Scan Results</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <span className="ml-1 font-medium text-gray-900 capitalize">{aiData.status}</span>
                        </div>
                        {aiData.passRate !== null && (
                          <div>
                            <span className="text-gray-600">Pass Rate:</span>
                            <span className="ml-1 font-medium text-gray-900">{aiData.passRate}%</span>
                          </div>
                        )}
                        {aiData.gapsCount > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Identified Gaps:</span>
                            <span className="ml-1 font-medium text-orange-700">{aiData.gapsCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>{template.company_fields.length} company fields</span>
                      <span>{template.evidence_requirements.length} evidence requirements</span>
                    </div>
                  </div>

                  {!isGap && (
                    <div className="flex justify-between items-center">
                      <Link
                        href={`/templates/${template.id}/fill`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                      >
                        Fill Template
                      </Link>
                      <div className="flex space-x-2">
                        <Link
                          href={`/templates/${template.id}`}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          View
                        </Link>
                        <Link
                          href={`/templates/${template.id}/edit`}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  )}
                  {isGap && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => {
                          setShowEssentialEightDropdown(true);
                        }}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700"
                      >
                        Generate Template
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {allRequiredTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates available</h3>
              <p className="text-gray-600 mb-4">
                Create your first control template to get started.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Template
              </button>
            </div>
          </div>
        )}

        {/* Create Template Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Create New Template</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter template name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Control</label>
                    <select
                      value={newTemplate.control_id}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, control_id: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a control</option>
                      {controls.map((control) => (
                        <option key={control.id} value={control.id}>
                          {control.code}: {control.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe what this template is for"
                  />
                </div>

                {/* Company Fields */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Company Information Fields</h4>
                    <button
                      onClick={addCompanyField}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-600 hover:bg-blue-50"
                    >
                      + Add Field
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {newTemplate.company_fields.map((field, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={field.field_name}
                            onChange={(e) => updateCompanyField(index, { field_name: e.target.value })}
                            placeholder="Field name"
                            className="block w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div className="flex-1">
                          <select
                            value={field.field_type}
                            onChange={(e) => updateCompanyField(index, { field_type: e.target.value })}
                            className="block w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Text Area</option>
                            <option value="select">Select</option>
                            <option value="file">File</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateCompanyField(index, { placeholder: e.target.value })}
                            placeholder="Placeholder text"
                            className="block w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateCompanyField(index, { required: e.target.checked })}
                            className="mr-1"
                          />
                          <span className="text-xs">Required</span>
                        </label>
                        <button
                          onClick={() => removeCompanyField(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence Requirements */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Evidence Requirements</h4>
                    <button
                      onClick={addEvidenceRequirement}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-600 hover:bg-blue-50"
                    >
                      + Add Requirement
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {newTemplate.evidence_requirements.map((req, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={req.requirement_code}
                            onChange={(e) => updateEvidenceRequirement(index, { requirement_code: e.target.value })}
                            placeholder="Requirement code"
                            className="block w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div className="flex-1">
                          <select
                            value={req.evidence_type}
                            onChange={(e) => updateEvidenceRequirement(index, { evidence_type: e.target.value })}
                            className="block w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value="document">Document</option>
                            <option value="screenshot">Screenshot</option>
                            <option value="policy">Policy</option>
                            <option value="procedure">Procedure</option>
                          </select>
                        </div>
                        <div className="flex-2">
                          <input
                            type="text"
                            value={req.description}
                            onChange={(e) => updateEvidenceRequirement(index, { description: e.target.value })}
                            placeholder="Description of required evidence"
                            className="block w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={req.required}
                            onChange={(e) => updateEvidenceRequirement(index, { required: e.target.checked })}
                            className="mr-1"
                          />
                          <span className="text-xs">Required</span>
                        </label>
                        <button
                          onClick={() => removeEvidenceRequirement(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createTemplate}
                  disabled={!newTemplate.name || !newTemplate.control_id}
                  className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
                    !newTemplate.name || !newTemplate.control_id
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Create Template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}