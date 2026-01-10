import Link from 'next/link'
import { FileText, Shield, CheckCircle2, TrendingUp, Lock, FileCheck, Sparkles } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16 pt-8">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Compliance Platform
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              GeekyGoose Compliance
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-4 max-w-3xl mx-auto">
              Compliance automation platform built for SMB + internal IT teams
            </p>
            <p className="text-md text-gray-500 max-w-2xl mx-auto">
              Simplify your compliance journey with intelligent document management, automated gap analysis, and real-time reporting
            </p>
          </div>

          {/* Main Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Link href="/documents" className="group">
              <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  Document Management
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Upload, organize, and intelligently manage your compliance documents with AI-powered categorization
                </p>
              </div>
            </Link>

            <Link href="/controls" className="group">
              <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">
                  Controls Library
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Browse compliance frameworks and requirements with comprehensive mapping and guidance
                </p>
              </div>
            </Link>
          </div>

          {/* Essential Eight Framework Section */}
          <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl border border-blue-100 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                Essential Eight Framework
              </h3>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Available Controls</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    'Multi-Factor Authentication (MFA)',
                    'Application Control',
                    'Patch Applications',
                    'Patch Operating Systems',
                    'Restrict Administrative Privileges'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-gray-700">
                      <div className="mt-1 p-1 bg-blue-100 rounded-full">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-gray-900">Platform Features</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    { icon: Sparkles, text: 'Automated evidence scanning' },
                    { icon: FileCheck, text: 'Gap analysis and recommendations' },
                    { icon: TrendingUp, text: 'Real-time compliance reporting' },
                    { icon: Shield, text: 'Complete audit trail tracking' }
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <div className="p-1.5 bg-purple-100 rounded-lg">
                        <item.icon className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-gray-700">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}