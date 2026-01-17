'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AISettings {
  provider: 'openai' | 'ollama';
  openai_api_key?: string;
  openai_model?: string;
  openai_vision_model?: string;
  openai_endpoint?: string;
  ollama_endpoint?: string;
  ollama_model?: string;
  ollama_vision_model?: string;
  ollama_context_size?: number;
  min_confidence_threshold?: number;
  use_dual_vision_validation?: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AISettings>({
    provider: 'openai',
    openai_model: 'gpt-4o-mini',
    ollama_endpoint: 'http://172.16.0.11:11434',
    ollama_model: 'llama2',
    ollama_context_size: 32768
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<any[]>([]);
  const [openaiModels, setOpenaiModels] = useState<any[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchingOpenaiModels, setFetchingOpenaiModels] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Auto-fetch Ollama models when provider changes to Ollama
  useEffect(() => {
    if (settings.provider === 'ollama' && settings.ollama_endpoint) {
      fetchOllamaModels();
    }
  }, [settings.provider]);

  // Auto-fetch OpenAI models when provider changes to OpenAI and has custom endpoint
  useEffect(() => {
    if (settings.provider === 'openai' && settings.openai_endpoint) {
      fetchOpenaiModels();
    }
  }, [settings.provider]);

  // Auto-fetch OpenAI models when endpoint or API key changes (with debounce)
  useEffect(() => {
    if (settings.provider === 'openai' && settings.openai_endpoint) {
      const timer = setTimeout(() => {
        fetchOpenaiModels();
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(timer);
    }
  }, [settings.openai_endpoint, settings.openai_api_key]);

  // Auto-fetch models when endpoint changes (with debounce)
  useEffect(() => {
    if (settings.provider === 'ollama' && settings.ollama_endpoint) {
      const timer = setTimeout(() => {
        fetchOllamaModels();
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(timer);
    }
  }, [settings.ollama_endpoint]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/ai');
      if (response.ok) {
        const data = await response.json();
        setSettings({ ...settings, ...data });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenaiModels = async (endpoint?: string, apiKey?: string) => {
    setFetchingOpenaiModels(true);
    try {
      const targetEndpoint = endpoint || settings.openai_endpoint || '';
      const targetApiKey = apiKey || settings.openai_api_key || '';
      
      // Only require API key if using default OpenAI endpoint
      if (!targetEndpoint && (!targetApiKey || targetApiKey === '***')) {
        setTestResult('❌ API key required for default OpenAI endpoint');
        setOpenaiModels([]);
        return;
      }

      const queryParams = new URLSearchParams();
      if (targetEndpoint) {
        queryParams.append('endpoint', targetEndpoint);
      }
      if (targetApiKey && targetApiKey !== '***') {
        queryParams.append('api_key', targetApiKey);
      }

      const response = await fetch(`/api/settings/openai/models?${queryParams}`);
      
      if (response.ok) {
        const data = await response.json();
        setOpenaiModels(data.models || []);
        setTestResult(`✅ Found ${data.total_models} models from ${data.endpoint}`);
      } else {
        const error = await response.json();
        setOpenaiModels([]);
        setTestResult(`❌ Failed to fetch models: ${error.detail}`);
      }
    } catch (error) {
      setOpenaiModels([]);
      setTestResult(`❌ Error fetching models: ${error}`);
    } finally {
      setFetchingOpenaiModels(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const fetchOllamaModels = async (endpoint?: string) => {
    setFetchingModels(true);
    try {
      const targetEndpoint = endpoint || settings.ollama_endpoint || 'http://172.16.0.11:11434';
      const response = await fetch(`/api/settings/ollama/models?endpoint=${encodeURIComponent(targetEndpoint)}`);
      
      if (response.ok) {
        const data = await response.json();
        setOllamaModels(data.models || []);
        setTestResult(`✅ Found ${data.total_models} models on Ollama`);
      } else {
        const error = await response.json();
        setOllamaModels([]);
        setTestResult(`❌ Failed to fetch models: ${error.detail}`);
      }
    } catch (error) {
      setOllamaModels([]);
      setTestResult(`❌ Error fetching models: ${error}`);
    } finally {
      setFetchingModels(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setTestResult('✅ Settings saved successfully!');
        setTimeout(() => setTestResult(null), 3000);
      } else {
        const error = await response.json();
        setTestResult(`❌ Failed to save: ${error.detail}`);
      }
    } catch (error) {
      setTestResult(`❌ Error: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const result = await response.json();
      if (response.ok) {
        setTestResult(`✅ Connection successful! Response: "${result.test_response}"`);
      } else {
        setTestResult(`❌ Test failed: ${result.detail}`);
      }
    } catch (error) {
      setTestResult(`❌ Connection error: ${error}`);
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Settings</h1>
          <p className="text-gray-600">
            Configure your AI provider for compliance scanning and analysis.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">AI Provider Configuration</h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                AI Provider
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    settings.provider === 'openai'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSettings({ ...settings, provider: 'openai' })}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">🤖</div>
                    <div>
                      <h3 className="font-medium text-gray-900">OpenAI</h3>
                      <p className="text-sm text-gray-600">GPT-4, GPT-3.5 Turbo</p>
                      <p className="text-xs text-gray-500 mt-1">Requires API key and credits</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    settings.provider === 'ollama'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSettings({ ...settings, provider: 'ollama' })}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">🦙</div>
                    <div>
                      <h3 className="font-medium text-gray-900">Ollama</h3>
                      <p className="text-sm text-gray-600">Local AI models</p>
                      <p className="text-xs text-gray-500 mt-1">Free, runs on your hardware</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* OpenAI Settings */}
            {settings.provider === 'openai' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900">OpenAI Configuration</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key {settings.openai_endpoint && <span className="text-gray-500 text-xs font-normal">(optional for custom endpoints)</span>}
                  </label>
                  <input
                    type="password"
                    value={settings.openai_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                    placeholder={settings.openai_endpoint ? "Optional for custom endpoints" : "sk-..."}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {settings.openai_endpoint ? (
                      "API key is optional when using custom endpoints that don't require authentication"
                    ) : (
                      <>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">platform.openai.com</a></>
                    )}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Model
                    </label>
                    {settings.openai_endpoint && (
                      <button
                        type="button"
                        onClick={() => fetchOpenaiModels()}
                        disabled={fetchingOpenaiModels}
                        className={`text-xs px-2 py-1 rounded border ${
                          fetchingOpenaiModels
                            ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        {fetchingOpenaiModels ? 'Fetching...' : 'Refresh Models'}
                      </button>
                    )}
                  </div>
                  
                  {settings.openai_endpoint && openaiModels.length > 0 ? (
                    <select
                      value={settings.openai_model || ''}
                      onChange={(e) => setSettings({ ...settings, openai_model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a model...</option>
                      {openaiModels.map((model, index) => (
                        <option key={index} value={model.id}>
                          {model.display_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={settings.openai_model || 'gpt-4o-mini'}
                      onChange={(e) => setSettings({ ...settings, openai_model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini (Recommended)</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  )}
                  
                  <div className="mt-2 space-y-1">
                    {!settings.openai_endpoint ? (
                      <p className="text-xs text-gray-500">
                        GPT-4o Mini offers the best balance of cost and quality for compliance analysis
                      </p>
                    ) : openaiModels.length > 0 ? (
                      <p className="text-xs text-green-600">
                        ✅ {openaiModels.length} models found from custom endpoint
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Enter custom endpoint above{settings.openai_endpoint ? '' : ' and API key'}, then click "Refresh Models" to load available models
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Endpoint (Optional)
                  </label>
                  <input
                    type="text"
                    value={settings.openai_endpoint || ''}
                    onChange={(e) => setSettings({ ...settings, openai_endpoint: e.target.value })}
                    placeholder="https://api.openai.com/v1 (default) or http://127.0.0.1:1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Custom OpenAI API endpoint. Leave empty to use the default OpenAI endpoint. Useful for proxies or OpenAI-compatible services.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vision Model (for images & PDFs)
                  </label>
                  <select
                    value={settings.openai_vision_model || 'gpt-4o'}
                    onChange={(e) => setSettings({ ...settings, openai_vision_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="gpt-4o">GPT-4o (Recommended)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    GPT-4o offers the best vision capabilities for analyzing images and PDF documents
                  </p>
                </div>
              </div>
            )}

            {/* Ollama Settings */}
            {settings.provider === 'ollama' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900">Ollama Configuration</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={settings.ollama_endpoint || 'http://172.16.0.11:11434'}
                    onChange={(e) => setSettings({ ...settings, ollama_endpoint: e.target.value })}
                    placeholder="http://your-ollama-server:11434"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ollama endpoint URL. Can be localhost, remote server, or Docker container (e.g. http://192.168.1.100:11434)
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Model
                    </label>
                    <button
                      type="button"
                      onClick={() => fetchOllamaModels()}
                      disabled={fetchingModels}
                      className={`text-xs px-2 py-1 rounded border ${
                        fetchingModels
                          ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {fetchingModels ? 'Fetching...' : 'Refresh Models'}
                    </button>
                  </div>
                  
                  {ollamaModels.length > 0 ? (
                    <select
                      value={settings.ollama_model || ''}
                      onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a model...</option>
                      {ollamaModels.map((model, index) => (
                        <option key={index} value={model.name}>
                          {model.display_name} ({model.family}) - {model.size_gb}GB
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={settings.ollama_model || 'llama2'}
                      onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="llama2">Llama 2 (7B)</option>
                      <option value="llama2:13b">Llama 2 (13B)</option>
                      <option value="llama3">Llama 3 (8B)</option>
                      <option value="mistral">Mistral (7B)</option>
                      <option value="mixtral">Mixtral (8x7B)</option>
                      <option value="codellama">Code Llama</option>
                    </select>
                  )}
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">
                      Install models with: <code>ollama pull &lt;model-name&gt;</code>
                    </p>
                    {ollamaModels.length > 0 && (
                      <p className="text-xs text-green-600">
                        ✅ {ollamaModels.length} models found on your Ollama instance
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vision Model (for images & PDFs)
                  </label>
                  {ollamaModels.length > 0 ? (
                    <select
                      value={settings.ollama_vision_model || 'qwen2-vl'}
                      onChange={(e) => setSettings({ ...settings, ollama_vision_model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="qwen2-vl">Qwen2-VL (Recommended)</option>
                      {ollamaModels.map((model, index) => (
                        <option key={index} value={model.name}>
                          {model.display_name} ({model.family}) - {model.size_gb}GB
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={settings.ollama_vision_model || 'qwen2-vl'}
                      onChange={(e) => setSettings({ ...settings, ollama_vision_model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="qwen2-vl">Qwen2-VL (Recommended)</option>
                      <option value="llava">LLaVA</option>
                      <option value="llava:13b">LLaVA 13B</option>
                      <option value="llava:34b">LLaVA 34B</option>
                      <option value="bakllava">BakLLaVA</option>
                      <option value="granite3.2-vision:2b">Granite 3.2 Vision 2B</option>
                    </select>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {ollamaModels.length > 0 ? (
                      <>Vision-capable model for analyzing images and PDF documents. Used for dual validation when enabled.</>
                    ) : (
                      <>Install with: <code className="bg-gray-100 px-1 rounded">ollama pull qwen2-vl</code> or <code className="bg-gray-100 px-1 rounded">ollama pull llava</code></>
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Context Size: {(settings.ollama_context_size || 32768).toLocaleString()} tokens
                  </label>
                  <input
                    type="range"
                    min="4096"
                    max="131072"
                    step="4096"
                    value={settings.ollama_context_size || 32768}
                    onChange={(e) => setSettings({ ...settings, ollama_context_size: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>4K</span>
                    <span>32K</span>
                    <span>64K</span>
                    <span>128K</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Context window size for the model. Larger values allow processing longer documents but require more memory.
                    GPT-oss models support up to 128K tokens.
                  </p>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">📖 Setup Instructions</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li><strong>Local:</strong> Install Ollama: <code>curl -fsSL https://ollama.com/install.sh | sh</code></li>
                    <li><strong>Local:</strong> Start Ollama: <code>ollama serve</code> (binds to localhost:11434)</li>
                    <li><strong>Remote:</strong> For remote access, start with: <code>OLLAMA_HOST=0.0.0.0:11434 ollama serve</code></li>
                    <li>Pull a model: <code>ollama pull llama3</code> (recommended) or <code>ollama pull llama2</code></li>
                    <li>Update the endpoint URL above if using a remote server</li>
                    <li>Click "Refresh Models" to load your available models</li>
                    <li>Test connection below</li>
                  </ol>
                  
                  {ollamaModels.length === 0 && settings.provider === 'ollama' && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded border border-yellow-300">
                      <p className="text-xs text-yellow-800">
                        💡 <strong>No models found.</strong> Make sure Ollama is running and you have pulled at least one model.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
              <h3 className="font-medium text-purple-900 flex items-center gap-2">
                <span>⚙️</span>
                Advanced AI Settings
              </h3>

              {/* Confidence Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Confidence Threshold: {Math.round((settings.min_confidence_threshold || 0.90) * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(settings.min_confidence_threshold || 0.90) * 100}
                  onChange={(e) => setSettings({ ...settings, min_confidence_threshold: parseInt(e.target.value) / 100 })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>50%</span>
                  <span>70%</span>
                  <span>90%</span>
                  <span>100%</span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Only create AI document links when confidence is ≥ this threshold. Higher values = fewer false positives. Recommended: 90%
                </p>
              </div>

              {/* Dual Vision Validation Toggle */}
              <div className="p-3 bg-white rounded-lg border border-purple-200">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="dual-vision"
                    checked={settings.use_dual_vision_validation || false}
                    onChange={(e) => setSettings({ ...settings, use_dual_vision_validation: e.target.checked })}
                    className="mt-1 h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="dual-vision" className="cursor-pointer">
                      <span className="font-medium text-gray-900">🔬 Dual Vision Validation (Ultra Accuracy)</span>
                      <p className="text-sm text-gray-600 mt-1">
                        Use <strong>both</strong> OpenAI vision model ({settings.openai_vision_model || 'gpt-4o'}) AND Ollama vision model ({settings.ollama_vision_model || 'qwen2-vl'}) together. Only creates links if <strong>both models agree</strong> on the same control. Uses minimum confidence from both models.
                      </p>
                      <div className="mt-2 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">✓</span>
                          <span className="text-gray-700">Virtually eliminates false positives</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">✓</span>
                          <span className="text-gray-700">Maximum accuracy for critical documents</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-orange-500">⚠</span>
                          <span className="text-gray-700">Slower (2x processing time) and higher cost</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-orange-500">⚠</span>
                          <span className="text-gray-700">Requires both OpenAI API key AND Ollama with vision model</span>
                        </div>
                      </div>
                      <p className="text-xs text-purple-700 mt-2 bg-purple-50 p-2 rounded">
                        💡 Configure vision models above in the OpenAI and Ollama sections
                      </p>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`p-3 rounded-lg ${
                testResult.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {testResult}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <button
                onClick={testConnection}
                disabled={testingConnection}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                  testingConnection
                    ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                }`}
              >
                {testingConnection ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>

              <button
                onClick={saveSettings}
                disabled={saving}
                className={`inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-md text-white ${
                  saving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-yellow-400 text-lg mr-3">💡</div>
            <div>
              <h3 className="font-medium text-yellow-800">Pro Tip</h3>
              <p className="text-sm text-yellow-700 mt-1">
                For better compliance analysis, we recommend using larger models like GPT-4o or Llama 3. 
                Smaller models may provide less accurate results for complex compliance requirements.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}