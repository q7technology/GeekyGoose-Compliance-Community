# 🦆 GeekyGoose Compliance

> **Get Compliant Fast** - AI-Powered Compliance Automation Platform for SMB + Internal IT Teams

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## ✨ Features

### 🤖 **AI-Powered Compliance Scanning**
- **Automated Evidence Analysis**: Upload policies, screenshots, and documents
- **Smart Gap Detection**: AI identifies what's missing and why
- **Compliance Scoring**: Pass/Partial/Fail ratings with confidence levels
- **Citation Tracking**: Direct references to evidence supporting each finding

### 📊 **Comprehensive Reporting**
- **Executive Dashboards**: High-level compliance overview with visual metrics
- **Detailed Gap Analysis**: Specific remediation actions prioritized by risk
- **Export Capabilities**: CSV reports for audits and stakeholder reviews
- **Progress Tracking**: Monitor compliance improvements over time

### 🔧 **Framework Support**
- **Essential Eight**: Complete implementation with all 8 controls
- **Extensible Architecture**: Ready for ISO 27001, NIST CSF, CIS Controls
- **Maturity Levels**: Support for progressive compliance requirements
- **Multi-Tenant**: Organization-scoped data and controls

### 📁 **Document Management**
- **Evidence Linking**: Connect documents to specific controls and requirements
- **Secure Storage**: Encrypted at rest with signed download URLs
- **Multi-Format Support**: PDF, DOCX, TXT, PNG, JPG with OCR capabilities
- **Audit Trail**: Complete history of document uploads and changes

## 🏗️ Architecture

### **Frontend** (Next.js 14)
- **App Router**: Modern Next.js routing with TypeScript
- **Tailwind CSS + shadcn/ui**: Beautiful, accessible components
- **Server Actions**: Optimized data mutations
- **TanStack Query**: Efficient client-side data fetching

### **Backend** (FastAPI)
- **Python 3.11**: Modern async/await patterns
- **PostgreSQL**: Relational data with full ACID compliance
- **MinIO**: S3-compatible object storage for documents
- **Redis**: Background job queue for AI processing

### **AI Processing**
- **Ollama Integration**: Local LLM support for data privacy
- **OpenAI Compatible**: Support for GPT-4 and other models
- **Structured Output**: JSON schema validation for reliable results
- **Document Extraction**: PDF, DOCX parsing with OCR fallback

### **Infrastructure**
- **Docker Compose**: Complete development environment
- **Background Workers**: Celery for async document processing
- **Multi-tenant**: Organization-scoped data isolation
- **Audit Logging**: Immutable compliance trail

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- 8GB+ RAM (for AI models)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/geekygoose-compliance.git
cd geekygoose-compliance
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
# - OPENAI_API_KEY (optional, for GPT-4 support)
# - OLLAMA_ENDPOINT (for local AI models)
```

### 3. Start Services
```bash
# Start all services
docker-compose up -d

# Check services are running
docker-compose ps
```

### 4. Initialize Database
```bash
# Run database migrations
docker-compose exec api python create_tables.py

# Seed with Essential Eight framework
docker-compose exec api python seed_database.py
```

### 5. Access Application
- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001

## 📖 User Guide

### 🎯 **Getting Started**
1. **Upload Evidence**: Go to Documents → Upload your policies, screenshots, configs
2. **Link to Controls**: Navigate to Controls → Select a control → Link your evidence
3. **Run AI Scan**: Click "Start AI Scan" to analyze evidence against requirements
4. **Review Results**: See compliance status, gaps, and recommended actions
5. **Generate Reports**: Export compliance reports for audits and reviews

### 🔍 **Example Workflow: MFA Compliance**
1. Upload your MFA policy document (PDF)
2. Upload screenshots of MFA configuration
3. Go to Controls → "EE-7: Multi-Factor Authentication"
4. Link your documents to the control
5. Run AI scan
6. Review gaps: "Missing hardware tokens" → Priority: HIGH
7. Export report for remediation planning

### 🏢 **Multi-Organization Support**
- Each organization has isolated data
- Role-based access control
- Shared frameworks, private evidence
- Cross-organization reporting (admin only)

## 🛠️ Development

### **Project Structure**
```
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # FastAPI backend
│   └── shared/       # Shared types and schemas
├── database/         # SQL migrations
├── docker-compose.yml
└── README.md
```

### **Local Development**
```bash
# Frontend (Next.js)
cd apps/web
npm install
npm run dev

# Backend (FastAPI)
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload

# Worker (Celery)
cd apps/api
celery -A celery_app worker --loglevel=info
```

### **Testing**
```bash
# Run all tests
docker-compose exec api python -m pytest

# Frontend tests
cd apps/web
npm test

# API tests
cd apps/api
python test_scanner.py
```

### **Database Migrations**
```bash
# Create new migration
docker-compose exec api alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec api alembic upgrade head
```

## 🤖 AI Configuration

### **Ollama (Recommended for Privacy)**
```bash
# Install Ollama locally
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended models
ollama pull qwen3:8b
ollama pull gemma3:4b

# Configure in .env
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
AI_PROVIDER=ollama
```

### **OpenAI API**
```bash
# Configure in .env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
AI_PROVIDER=openai
```

## 📋 Supported Compliance Frameworks

### ✅ **Essential Eight** (Complete)
- **EE-1**: Application Control
- **EE-2**: Patch Applications  
- **EE-3**: Configure Microsoft Office Macro Settings
- **EE-4**: User Application Hardening
- **EE-5**: Restrict Administrative Privileges
- **EE-6**: Patch Operating Systems
- **EE-7**: Multi-Factor Authentication
- **EE-8**: Regular Backups

### 🔜 **Coming Soon**
- **ISO 27001**: Information Security Management
- **NIST CSF**: Cybersecurity Framework
- **CIS Controls**: Center for Internet Security
- **SOC 2**: Service Organization Control 2
- **PCI DSS**: Payment Card Industry Data Security

## 🔒 Security & Privacy

### **Data Protection**
- **Encryption at Rest**: All documents encrypted in MinIO
- **Secure Communications**: HTTPS/TLS for all API calls
- **Access Controls**: Role-based permissions with audit trails
- **Data Isolation**: Multi-tenant architecture with organization scoping

### **AI Privacy**
- **Local Processing**: Use Ollama for on-premises AI
- **No Training**: Customer data never used for model training
- **Minimal Storage**: Only compliance results stored, not full document content
- **Audit Trail**: Complete log of all AI interactions and decisions

### **Compliance**
- **SOC 2 Ready**: Audit logging and access controls
- **GDPR Compatible**: Data minimization and deletion capabilities
- **HIPAA Considerations**: PHI handling with proper safeguards
- **Audit Trail**: Immutable compliance history for regulators

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Process**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests and ensure they pass
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### **Code Standards**
- **TypeScript**: Strict mode enabled
- **ESLint + Prettier**: Automated code formatting
- **Semantic Commits**: Conventional commit format
- **Test Coverage**: Maintain >80% coverage
- **Documentation**: Update README for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **FastAPI**: High-performance Python web framework
- **Next.js**: React framework for production applications  
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Beautifully designed components
- **Ollama**: Local LLM inference server
- **Essential Eight**: Australian Cyber Security Centre framework

## 📞 Support

### **Documentation**
- **API Docs**: http://localhost:8000/docs
- **User Guide**: [docs/user-guide.md](docs/user-guide.md)
- **Admin Guide**: [docs/admin-guide.md](docs/admin-guide.md)
- **Developer Guide**: [docs/developer-guide.md](docs/developer-guide.md)


### **Commercial Support**
- **Enterprise Licenses**: Coming soon
- **Custom Frameworks**: Add your industry-specific requirements
- **Professional Services**: Implementation and training available
- **SLA Support**: As-IS

---

<p align="center">
  Made with ❤️ for the compliance community<br>
  <strong>Get Compliant Fast with GeekyGoose! 🦆</strong>
</p>