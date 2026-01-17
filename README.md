# 🦆 GeekyGoose Compliance

> **Get Compliant Fast** - Enterprise-Grade AI-Powered Compliance Automation Platform

![License](https://img.shields.io/badge/license-AGPLv3-blue.svg)
![Version](https://img.shields.io/badge/version-0.3.1-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Security](https://img.shields.io/badge/security-enhanced-brightgreen.svg)
![Performance](https://img.shields.io/badge/performance-optimized-orange.svg)

## 📸 Screenshots

### Dashboard Overview
![Dashboard](docs/screenshots/dashboard.png)
*Comprehensive compliance dashboard with real-time metrics and AI-powered insights*

### AI-Powered Document Analysis
![AI Analysis](docs/screenshots/ai-analysis.gif)
*Watch as AI analyzes your compliance documents and maps them to framework controls*

### Compliance Reporting
![Reports](docs/screenshots/reports.png)
*Generate detailed compliance reports with gap analysis and remediation recommendations*

### Template Management
![Templates](docs/screenshots/templates.png)
*Create and manage reusable compliance templates with AI validation*

> **Note**: Screenshots will be added in the `docs/screenshots/` directory. To contribute screenshots, please see our [Contributing Guide](CONTRIBUTING.md).

## ✨ Features

### 🤖 **AI-Powered Compliance Scanning**
- **Two-Step Document Analysis**: First scan and summarize, then map to controls
- **Dual Vision Validation**: Use both OpenAI and Ollama vision models together for ultra-accurate document analysis
- **Structured Output Processing**: Reliable AI responses with fallback handling
- **Automated Evidence Analysis**: Upload policies, screenshots, and documents
- **Smart Gap Detection**: AI identifies what's missing and why
- **Compliance Scoring**: Pass/Partial/Fail ratings with confidence levels
- **Citation Tracking**: Direct references to evidence supporting each finding
- **Model Transparency**: Scan results display which AI model performed the analysis (Ollama/OpenAI)
- **Vision Model Support**: Separate text and vision models for optimal analysis of different content types

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

### 📋 **Control Templates & Policy Generation**
- **Template Creation**: Create reusable templates for compliance controls
- **Company Information**: Customizable fields for company-specific data collection
- **Evidence Requirements**: Define what evidence is needed for each control
- **Template Filling**: Streamlined process for users to complete compliance documentation
- **Policy Generation**: Download completed policies as professional Word documents
- **Submission Management**: View, download, and delete completed template submissions
- **Submission Tracking**: Monitor template submissions and approval status

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Next.js Web App<br/>📱 React + TypeScript]
        API_Utils[Shared API Utilities<br/>🔧 Error Handling & Retry]
        Formatters[Formatting Utilities<br/>🎨 Consistent Display]
    end
    
    subgraph "Security Layer"
        CORS[CORS Middleware<br/>🛡️ Cross-Origin Control]
        Auth[Request Validation<br/>🔐 Size & Content Limits]
        Headers[Security Headers<br/>🛡️ XSS, CSRF Protection]
        Logging[Request Logging<br/>📊 Audit Trail]
    end
    
    subgraph "API Layer"
        FastAPI[FastAPI 0.3.0<br/>⚡ Async Python Backend]
        ErrorMW[Error Middleware<br/>🚨 Centralized Handling]
        Routes[API Endpoints<br/>🛣️ RESTful Services]
    end
    
    subgraph "Business Logic"
        DocProc[Document Processing<br/>📄 PDF, DOCX, Images]
        AIEngine[AI Analysis Engine<br/>🧠 Ollama + OpenAI]
        CompEngine[Compliance Engine<br/>📋 Framework Mapping]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL<br/>🗄️ Indexed & Optimized)]
        Storage[(MinIO Object Storage<br/>📁 S3-Compatible)]
        Cache[(Redis Cache<br/>⚡ Background Jobs)]
    end
    
    subgraph "AI Services"
        Ollama[Ollama Local LLM<br/>🤖 Privacy-First]
        OpenAI[OpenAI GPT-4<br/>☁️ Cloud-Based]
        OCR[OCR Processing<br/>👁️ Image Text Extraction]
    end
    
    UI --> API_Utils
    API_Utils --> CORS
    CORS --> Auth
    Auth --> Headers
    Headers --> Logging
    Logging --> ErrorMW
    ErrorMW --> FastAPI
    FastAPI --> Routes
    Routes --> DocProc
    Routes --> CompEngine
    DocProc --> AIEngine
    AIEngine --> Ollama
    AIEngine --> OpenAI
    DocProc --> OCR
    FastAPI --> DB
    FastAPI --> Storage
    FastAPI --> Cache
    
    classDef client fill:#e1f5fe
    classDef security fill:#fff3e0
    classDef api fill:#f3e5f5
    classDef business fill:#e8f5e8
    classDef data fill:#fff8e1
    classDef ai fill:#fce4ec
    
    class UI,API_Utils,Formatters client
    class CORS,Auth,Headers,Logging security
    class FastAPI,ErrorMW,Routes api
    class DocProc,AIEngine,CompEngine business
    class DB,Storage,Cache data
    class Ollama,OpenAI,OCR ai
```

## 🔧 Technical Architecture

### **Frontend** (Next.js 16.1.1)
- **App Router**: Modern Next.js routing with TypeScript
- **Tailwind CSS + shadcn/ui**: Beautiful, accessible components
- **Server Actions**: Optimized data mutations
- **Shared Utilities**: Centralized formatting and API utilities
- **Error Boundaries**: Robust error handling and user feedback

### **Backend** (FastAPI 0.3.0)
- **Python 3.11**: Modern async/await patterns with enhanced error handling
- **PostgreSQL**: Relational data with performance-optimized indexes
- **MinIO**: S3-compatible object storage for documents
- **Redis**: Background job queue with dedicated AI task queue
- **Celery Workers**: Separate workers for AI tasks (concurrency=1) and general tasks (concurrency=4)
- **Security Middleware**: Comprehensive security headers and validation
- **Request Logging**: Complete audit trail and monitoring

### **AI Processing**
- **Ollama Integration**: Local LLM support with large context windows (32K+ tokens)
- **OpenAI Compatible**: Support for GPT-4 and other models
- **Structured Output**: JSON schema validation for reliable results
- **Document Extraction**: PDF, DOCX parsing with OCR fallback for images
- **High-Memory Optimization**: Configured for 16GB+ systems with comprehensive document analysis
- **Batch Processing**: Sequential upload handling for reliability

### **Security & Performance**
- **Enterprise Security**: OWASP-compliant security headers and validation
- **Database Optimization**: Strategic indexes for 50%+ performance improvement
- **Error Handling**: Centralized middleware with sanitized responses
- **Request Validation**: File size limits and content-type validation
- **Cascade Relationships**: Proper data integrity and cleanup

### **Infrastructure**
- **Docker Compose**: Complete development environment with security controls
- **Background Workers**: Async document and AI processing
- **Multi-tenant**: Organization-scoped data isolation
- **Audit Logging**: Immutable compliance trail with request tracking
- **Health Monitoring**: Request timing and performance metrics

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- 8GB+ RAM (for AI models)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/q7technology/GeekyGoose-Compliance-Community.git
cd GeekyGoose-Compliance-Community
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# CRITICAL: Edit .env with secure production values
# - DATABASE_URL: Use strong database credentials
# - JWT_SECRET: Generate 32+ character random string
# - MINIO credentials: Change default access keys
# - AI Configuration: Set OPENAI_API_KEY or OLLAMA_ENDPOINT
```

#### **🔐 Production Security Checklist**
- [ ] **Change ALL default passwords** in .env file
- [ ] **Generate strong JWT secret** (32+ characters)
- [ ] **Update database credentials** with complex passwords
- [ ] **Change MinIO access keys** from defaults
- [ ] **Enable HTTPS/TLS** in production
- [ ] **Configure firewall rules** to limit access
- [ ] **Set up backup strategy** for database and files
- [ ] **Enable monitoring** and log aggregation

### 3. Start Services
```bash
# Start all services
docker-compose up -d

# Check services are running
docker-compose ps
```

### 4. Initialize Database
```bash
# Run database initialization and create tables
docker-compose exec api python init_db.py

# Seed with Essential Eight framework
docker-compose exec api python run_seed.py
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
4. **Review Results**: See compliance status, gaps, recommended actions, and which AI model performed the scan
5. **Generate Reports**: Export compliance reports for audits and reviews

### 📋 **Using Templates**
1. **Create Templates**: Go to Templates → Create Template → Define company fields and evidence requirements
2. **Fill Templates**: Select a template → Fill Template → Enter company information and upload evidence
3. **Download Policies**: Generate professional Word documents with filled company data
4. **Manage Submissions**: View completed templates on Submissions page with download and delete options
5. **Track Submissions**: Monitor template completion status and approval workflow
6. **Standardize Compliance**: Use templates to ensure consistent documentation across your organization

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

## 🚀 Production Deployment

### **Production Architecture Considerations**

```bash
# Production deployment with security best practices

# 1. Use production-grade database
# - PostgreSQL with connection pooling
# - Regular backups and point-in-time recovery
# - Database indexes already optimized

# 2. Secure file storage
# - MinIO with TLS encryption
# - Access key rotation policy
# - Backup replication strategy

# 3. Application security
# - HTTPS with valid certificates
# - Security headers middleware active
# - Request validation and rate limiting
# - Centralized error handling
```

### **Environment Variables (Production)**
```env
# Production Database (Required)
DATABASE_URL=postgresql://secure_user:STRONG_PASSWORD_HERE@db-host:5432/geekygoose_prod

# Security (Critical)
JWT_SECRET=your-super-secure-32-plus-character-random-string-here
NODE_ENV=production

# Object Storage (Required)
MINIO_ENDPOINT=storage.yourdomain.com:9000
MINIO_ACCESS_KEY=production_access_key
MINIO_SECRET_KEY=production_secret_key_minimum_20_chars
MINIO_USE_SSL=true

# AI Configuration (Choose one)
OPENAI_API_KEY=sk-your-production-openai-key
# OR
OLLAMA_ENDPOINT=https://ollama.yourdomain.com:11434
OLLAMA_MODEL=qwen2.5:14b

# Application URLs
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### **Performance & Monitoring**
```yaml
# docker-compose.prod.yml example with monitoring
services:
  api:
    image: geekygoose/api:0.3.1
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: geekygoose_prod
      POSTGRES_USER: secure_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    deploy:
      resources:
        limits:
          memory: 2G
```

## 🛠️ Development

### **Project Structure**
```
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── src/components/     # React components
│   │   ├── src/utils/          # Shared utilities (NEW)
│   │   └── src/app/            # App router pages
│   ├── api/                    # FastAPI backend
│   │   ├── middleware.py       # Security middleware (NEW)
│   │   ├── models.py           # Database models (indexed)
│   │   ├── main.py             # API routes
│   │   └── storage.py          # File storage
├── database/                   # SQL migrations
├── docker-compose.yml          # Development environment
├── docker-compose.prod.yml     # Production environment (NEW)
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
# API scanner tests
cd apps/api
python test_scanner.py

# Frontend tests (if available)
cd apps/web
npm test
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

# Pull recommended models for text analysis (16GB+ RAM systems)
ollama pull qwen2.5:14b          # Best for comprehensive analysis (16GB+ RAM)
ollama pull llama3.1:8b          # Good balance of speed and quality
ollama pull mistral:7b           # Fast and efficient

# Pull vision models for image/PDF analysis
ollama pull qwen2-vl             # Recommended vision model for dual validation
ollama pull llava                # Alternative vision model
ollama pull granite3.2-vision:2b # Lightweight vision model (2GB RAM)

# Configure in .env
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b         # Text/logic model with 32K context window
OLLAMA_VISION_MODEL=qwen2-vl     # Vision model for images and PDFs
OLLAMA_CONTEXT_SIZE=32768        # Maximize context for comprehensive analysis
AI_PROVIDER=ollama

# For systems with more RAM, you can increase context size:
# OLLAMA_CONTEXT_SIZE=65536       # 64K context (requires 32GB+ RAM)
# OLLAMA_CONTEXT_SIZE=131072      # 128K context (requires 64GB+ RAM)
```

**💡 Context Window Benefits:**
- **Larger Documents**: Analyze complete policy documents without truncation
- **Batch Processing**: Process multiple files together for better context
- **Comprehensive Analysis**: AI can consider full document relationships
- **Better Accuracy**: More context leads to more accurate compliance mapping

### **OpenAI API**
```bash
# Configure in .env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini         # Text/logic model
OPENAI_VISION_MODEL=gpt-4o       # Vision model for images and PDFs
AI_PROVIDER=openai
```

### **🔬 Dual Vision Validation (Ultra Accuracy Mode)**

For maximum accuracy on critical compliance documents, enable **Dual Vision Validation** in the Settings page. This feature uses **both OpenAI and Ollama vision models** to analyze the same document independently.

**How it works:**
1. Both OpenAI vision model (e.g., `gpt-4o`) AND Ollama vision model (e.g., `qwen2-vl`) analyze the document
2. A control link is created **only if both models agree** on the same control
3. The system uses the **minimum confidence** from both models
4. Both models must independently identify the same control for validation

**Benefits:**
- ✅ **Virtually eliminates false positives** - two independent AI models validate each other
- ✅ **Maximum accuracy** for critical compliance documents
- ✅ **Independent verification** - different AI architectures cross-check results
- ✅ **Confidence in results** - dual validation provides higher assurance

**Trade-offs:**
- ⚠️ **2x processing time** - documents are analyzed twice
- ⚠️ **Higher cost** - requires both OpenAI API credits and Ollama resources
- ⚠️ **Requires both services** - must have OpenAI API key AND Ollama running

**Configuration in Settings:**
```
✅ Enable "Dual Vision Validation (Ultra Accuracy)"

OpenAI Section:
- Vision Model: gpt-4o (recommended)

Ollama Section:
- Vision Model: qwen2-vl (recommended)
```

**When to use:**
- Critical compliance documents requiring highest accuracy
- Regulatory submissions and audits
- High-risk controls where errors are costly
- Final validation before official compliance reports

**When not to use:**
- Initial document analysis and exploration
- Large batches of documents (due to 2x time)
- Budget-constrained scenarios
- Development and testing environments

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

## 📊 Data Flow Architecture

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant UI as 🖥️ Web App
    participant MW as 🛡️ Middleware
    participant API as ⚡ FastAPI
    participant AI as 🧠 AI Engine
    participant DB as 🗄️ Database
    participant Storage as 📁 MinIO
    
    Note over User,Storage: Document Upload & AI Analysis Flow
    
    User->>UI: Upload Document
    UI->>MW: POST /api/documents
    MW->>MW: Validate size & type
    MW->>API: Forward request
    API->>Storage: Store file
    Storage-->>API: Storage key
    API->>DB: Create document record
    DB-->>API: Document ID
    API->>AI: Extract text (async)
    AI->>Storage: Read file content
    AI->>AI: OCR/Parse text
    AI->>AI: Analyze content
    AI->>DB: Store control links
    API-->>UI: Upload success
    UI-->>User: Document uploaded
    
    Note over User,Storage: Comprehensive Reporting Flow
    
    User->>UI: Request report
    UI->>MW: POST /api/reports/comprehensive-analysis
    MW->>API: Validate & forward
    API->>DB: Query documents
    API->>DB: Query controls
    API->>DB: Query control links
    API->>AI: Generate recommendations
    AI-->>API: AI insights
    API-->>UI: Comprehensive report
    UI-->>User: Interactive dashboard
```

## 🔒 Security & Privacy

### **Enterprise Security Stack**
- **🛡️ OWASP-Compliant Headers**: XSS, CSRF, clickjacking protection
- **🔐 Request Validation**: 50MB file limits, content-type validation
- **🚨 Centralized Error Handling**: Sanitized responses, no sensitive data leakage
- **📊 Request Logging**: Complete audit trail with timing metrics
- **🔒 Input Sanitization**: SQL injection and XSS prevention

### **Data Protection**
- **🔐 Encryption at Rest**: All documents encrypted in MinIO
- **🌐 Secure Communications**: HTTPS/TLS for all API calls
- **👥 Access Controls**: Role-based permissions with audit trails
- **🏢 Data Isolation**: Multi-tenant architecture with organization scoping
- **🗑️ Cascade Cleanup**: Proper data deletion with foreign key constraints

### **AI Privacy & Ethics**
- **🏠 Local Processing**: Use Ollama for on-premises AI (privacy-first)
- **🚫 No Training**: Customer data never used for model training
- **📦 Minimal Storage**: Only compliance results stored, not full document content
- **📋 Audit Trail**: Complete log of all AI interactions and decisions
- **🎯 Structured Output**: Validated JSON responses prevent prompt injection

### **Production Security**
- **🚀 Secure Defaults**: No hardcoded credentials or weak passwords
- **📈 Performance Monitoring**: Database query optimization and indexing
- **⚡ Rate Limiting**: Request validation middleware prevents abuse
- **🔍 Health Checks**: System monitoring and alerting capabilities

### **Compliance Standards**
- **SOC 2 Ready**: Comprehensive audit logging and access controls
- **GDPR Compatible**: Data minimization and deletion capabilities  
- **HIPAA Considerations**: PHI handling with proper safeguards
- **PCI DSS Aligned**: Secure data handling and encryption standards
- **NIST Framework**: Security controls and risk management aligned

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

### Dual-License Model

GeekyGoose Compliance is available under a **dual-licensing model**:

#### 1. **Community Edition - AGPLv3**

The Community Edition is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

- ✅ **Free and Open Source**: Use, modify, and distribute the code freely
- ✅ **Perfect for**: Self-hosted deployments, internal use, open-source projects
- ⚠️ **Network Copyleft**: If you run this as a web service, you must provide source code to your users
- ⚠️ **Derivative Works**: Must also be licensed under AGPLv3

See the [LICENSE](LICENSE) file for the full AGPLv3 text.

**What this means for you:**
- **Self-Hosted/Internal Use**: You can use GeekyGoose Compliance within your organization for internal compliance management under AGPLv3.
- **Modifications**: If you modify the software and use it over a network (e.g., web service), you must make your modified source code available to users under AGPLv3.
- **Contributing**: All contributions are licensed under AGPLv3 (see [CONTRIBUTING.md](CONTRIBUTING.md) for details).

#### 2. **Enterprise/Hosted - Commercial License**

If you want to use GeekyGoose Compliance **without AGPL obligations**, you can purchase a **commercial license**.

**You need a commercial license if you want to:**
- 🏢 **Run as a hosted/SaaS service** without providing source code to users
- 🔒 **Keep your modifications private** (no source code disclosure)
- 📦 **Embed in proprietary software** without open-sourcing your application
- ⚖️ **Avoid copyleft obligations** for any reason

**Commercial License Benefits:**
- No source code disclosure requirements
- No copyleft obligations
- Priority support and SLA guarantees
- Custom development and integrations
- Legal indemnification and warranty coverage
- White-label and OEM options available

**Pricing & Contact:**
- **Email**: licensing@geekygoose.io
- **Website**: https://geekygoose.io/commercial-license
- See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for details

### Choosing the Right License

| Use Case | Community (AGPLv3) | Commercial License |
|----------|-------------------|-------------------|
| Internal company use | ✅ Yes | Optional |
| Self-hosted deployment | ✅ Yes | Optional |
| Modify for internal use | ✅ Yes (must share if networked) | ✅ Yes (private modifications) |
| Offer as SaaS/hosted service | ⚠️ Must share source code | ✅ Yes (no sharing required) |
| Embed in proprietary product | ❌ No | ✅ Yes |
| Keep modifications private | ❌ No | ✅ Yes |

### Trademark Notice

The **GeekyGoose name and logo** are trademarks and are **NOT** covered by the AGPLv3 license.

- ✅ You **CAN** use the code freely under AGPLv3
- ❌ You **CANNOT** use the GeekyGoose name or logo without permission

See [TRADEMARK.md](TRADEMARK.md) for detailed trademark usage guidelines.

### Additional Legal Documents

- **[LICENSE](LICENSE)** - Full AGPLv3 license text
- **[COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)** - Commercial licensing options and pricing
- **[NOTICE](NOTICE)** - Copyright notices and third-party attributions
- **[TRADEMARK.md](TRADEMARK.md)** - Trademark usage policy
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines and DCO/CLA process

## 🙏 Acknowledgments

- **FastAPI**: High-performance Python web framework
- **Next.js**: React framework for production applications  
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Beautifully designed components
- **Ollama**: Local LLM inference server
- **Essential Eight**: Australian Cyber Security Centre framework

## 🚀 Quick Production Deployment

### **One-Command Production Setup**
```bash
# 1. Clone and configure
git clone https://github.com/ggcompli/GeekyGoose-Compliance.git
cd GeekyGoose-Compliance

# 2. Create production environment (CRITICAL - Change passwords!)
cp .env.example .env.prod
# Edit .env.prod with secure production values

# 3. Create required directories
sudo mkdir -p /var/lib/geekygoose/{postgres,redis,minio}
sudo chown -R $USER:$USER /var/lib/geekygoose

# 4. Deploy with monitoring
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# 5. Initialize database
docker-compose -f docker-compose.prod.yml exec api python init_db.py
docker-compose -f docker-compose.prod.yml exec api python run_seed.py

# 6. Verify deployment
curl https://yourdomain.com/health
```

### **Production Monitoring**
- **Application**: https://yourdomain.com
- **API Documentation**: https://yourdomain.com/docs
- **MinIO Console**: https://yourdomain.com:9001
- **Grafana Dashboard**: https://yourdomain.com:3001 (if monitoring enabled)
- **Prometheus Metrics**: https://yourdomain.com:9090 (if monitoring enabled)

### **Security Hardening Checklist**
- [ ] Changed all default passwords in `.env.prod`
- [ ] Configured SSL certificates in nginx
- [ ] Set up firewall rules (ports 80, 443 only)
- [ ] Configured backup strategy for database and files
- [ ] Set up log aggregation and monitoring
- [ ] Configured fail2ban or similar intrusion prevention
- [ ] Regular security updates scheduled

## 📞 Support

### **Documentation**
- **API Docs**: http://localhost:8000/docs (dev) / https://yourdomain.com/docs (prod)
- **Production Guide**: [docker-compose.prod.yml](docker-compose.prod.yml)
- **Nginx Configuration**: [nginx/nginx.conf](nginx/nginx.conf)
- **Security Middleware**: [apps/api/middleware.py](apps/api/middleware.py)


### **Commercial Support**
- **Enterprise Licenses**: Coming soon
- **Custom Frameworks**: Add your industry-specific requirements
- **Professional Services**: Implementation and training available
- **SLA Support**: As-IS

## 📅 Changelog

### **v0.3.1** - Dual Vision Validation & Enhanced AI Configuration (January 2026)

#### 🔬 **Dual Vision Validation**
- **Ultra Accuracy Mode**: Use both OpenAI and Ollama vision models together
  - **Independent Analysis**: Both models analyze the same document separately
  - **Consensus Required**: Links created only when both models agree on the same control
  - **Minimum Confidence**: Uses the lowest confidence score from both models
  - **Maximum Accuracy**: Virtually eliminates false positives for critical documents

#### 🤖 **Enhanced AI Model Configuration**
- **Separate Vision Models**: Configure distinct vision models for OpenAI and Ollama
  - **OpenAI Vision**: Select from GPT-4o, GPT-4o Mini, or GPT-4 Turbo for image/PDF analysis
  - **Ollama Vision**: Choose from your installed models (qwen2-vl, llava, granite3.2-vision, etc.)
  - **Text vs Vision**: Different models optimized for text analysis vs visual content
  - **Model Detection**: Auto-populate available models from your Ollama instance

- **Improved Settings UI**: Reorganized settings page for better clarity
  - **Provider-Specific Sections**: Vision models now grouped under their respective providers
  - **Real-time Model List**: Refresh button to fetch latest available Ollama models
  - **Model Transparency**: Dual validation section shows which models will be used
  - **Dynamic Configuration**: Vision model settings save for both providers regardless of active provider

#### 🔧 **API & Backend Improvements**
- **Smart Control Lookup**: Support both UUID and control code (case-insensitive)
  - **Flexible Endpoints**: All `/controls/{control_id}` endpoints accept UUIDs or codes
  - **Case-Insensitive**: Works with `ee-7`, `EE-7`, or `7075c1f5-9899-4817-8963-57a8db86e625`
  - **Helper Function**: Centralized `get_control_by_id_or_code()` for consistent lookup
  - **8 Endpoints Fixed**: All control-related endpoints now support flexible identification

- **Database Type Fixes**: Corrected boolean handling for PostgreSQL
  - **Boolean Conversion**: Fixed `use_dual_vision_validation` integer to boolean conversion
  - **Type Safety**: Proper Python `bool()` conversion instead of 1/0 integers
  - **Settings Persistence**: Both provider settings now save regardless of active provider

#### 🐛 **Bug Fixes**
- Fixed database type mismatch error for `use_dual_vision_validation` field
- Resolved 404 errors when accessing controls by code (e.g., `ee-7`)
- Fixed control lookup to handle both lowercase and uppercase codes
- Corrected vision model settings not saving when switching providers
- Fixed UUID vs code routing issues in template filling page

#### 🎨 **UI/UX Enhancements**
- Vision model selectors moved to their respective provider sections
- Dual validation toggle shows currently configured models
- Better visual organization of advanced AI settings
- Helpful tooltips explaining when to use dual validation
- Clear indication of trade-offs (2x time, higher cost)

### **v0.3.0** - Enterprise Security & Performance Overhaul (December 2025)

#### 🔐 **Enterprise Security Features**
- **OWASP-Compliant Security Middleware**: Production-ready security stack
  - **Security Headers**: XSS, CSRF, clickjacking, and MIME-type protection
  - **Request Validation**: 50MB file limits, content-type validation, input sanitization
  - **Error Handling**: Centralized middleware with sanitized responses (no data leakage)
  - **Request Logging**: Complete audit trail with timing metrics and monitoring

- **Production-Ready Architecture**: Enterprise deployment capabilities
  - **Docker Production Config**: Multi-replica, resource-limited, health-checked containers
  - **Nginx Load Balancer**: Rate limiting, SSL termination, static asset caching
  - **Database Optimization**: Strategic indexes for 50%+ performance improvement
  - **Cascade Relationships**: Proper data integrity and foreign key constraints

#### 🆕 **Enhanced Features**
- **Enhanced Image Processing with OCR**: Complete picture scanning capability
  - **Multi-Format Support**: PNG, JPG, GIF, BMP, TIFF, WebP image processing
  - **OCR Text Extraction**: Tesseract integration for automatic text recognition
  - **Visual Evidence Analysis**: AI analyzes screenshots, configurations, policy scans
  - **Batch Processing**: Upload multiple images with sequential processing for reliability

- **Comprehensive Reporting System**: AI-powered compliance analytics
  - **Document AI Integration**: Reports show AI analysis results from uploaded documents
  - **Comprehensive Analysis**: One-click AI analysis across all documents and controls
  - **Coverage Metrics**: Percentage of controls with evidence and confidence scoring
  - **Risk Assessment**: Identifies high-risk gaps and provides actionable recommendations

- **Shared Utilities & Code Quality**: Reduced duplication and better maintainability
  - **API Utilities**: Centralized error handling, retry logic, and request management
  - **Formatting Utilities**: Consistent file size, date, and confidence formatting
  - **TypeScript Improvements**: Better type safety and error handling patterns

#### 🔧 **Technical Improvements**
- **Next.js 16.1.1 Upgrade**: Latest React 19 compatibility and performance improvements
  - **React 19**: Updated to latest React version with new features
  - **ESLint 9**: Modern linting configuration for better code quality
  - **Dependency Optimization**: Moved dev dependencies to production for deployment
  - **Improved Build Performance**: Faster builds and better development experience

- **Enhanced AI Processing**: More reliable AI responses and better JSON handling
  - **Completions-Only API**: Switched from chat to completions format for Ollama integration
  - **Improved JSON Parsing**: Better handling of AI responses with strict JSON validation
  - **Increased Content Length**: Extended AI response limits from 200 to 500 tokens
  - **Better Error Handling**: Graceful fallbacks when AI processing fails
  - **Simplified Prompts**: More effective AI prompts for better compliance analysis

- **Database Improvements**: Enhanced data integrity and relationship handling
  - **Fixed Foreign Key Constraints**: Proper cascade deletion for document relationships
  - **Better Error Handling**: Resolved database constraint violation errors
  - **Improved Data Consistency**: Proper cleanup of related records during deletions
  - **Enhanced Logging**: Better error tracking for database operations

#### 🎨 **UI/UX Enhancements**
- **Responsive Document Display**: Fixed overflow issues in document management
  - **Container Boundaries**: Documents properly contained within UI boundaries
  - **Text Truncation**: Long filenames and titles properly truncated with tooltips
  - **Mobile Responsive**: Better display on mobile and tablet devices
  - **Improved Layout**: Better spacing and visual hierarchy

- **Enhanced File Type Support**: Clear indication of supported formats
  - **Visual File Icons**: Different icons for PDF, Word, text, and image files
  - **Format Guidance**: Clear indication of supported file types and size limits
  - **OCR Indicators**: Visual feedback when OCR text extraction is used
  - **File Size Display**: Better formatting of file size information

- **AI Model Transparency**: Scan results now display which model performed the analysis
  - **Model Badge**: Visual indicator showing AI provider and model name (e.g., "gpt-oss:20b (Ollama)")
  - **Controls List View**: Model name displayed alongside scan results
  - **Control Detail View**: Prominent model display in scan result header
  - **Scan Completion Alert**: Model information included in success notifications

#### ⚡ **Performance & Reliability**
- **Dedicated AI Task Queue**: Separate Celery worker for AI tasks prevents resource contention
  - **Serial Processing**: AI scans run one at a time (concurrency=1) to prevent memory issues
  - **Separate Workers**: Multi-threaded worker (concurrency=4) for text extraction and general tasks
  - **Queue Isolation**: AI tasks (`ai_tasks` queue) separate from extraction tasks (`extraction` queue)
  - **Resource Management**: Prevents Ollama/OpenAI API overload and ensures stable performance

- **Database Improvements**: Enhanced schema and initialization
  - **Complete Table Initialization**: All models now properly defined in SQL initialization script
  - **Document Control Links**: Added missing table for AI-suggested control links
  - **Proper Indexes**: Performance indexes for all foreign keys and frequently queried columns
  - **Update Triggers**: Automatic `updated_at` timestamp maintenance for all tables
  - **JSONB Support**: Proper handling of PostgreSQL JSONB columns for scan results

#### 🐛 **Bug Fixes**
- Fixed document download failures due to incorrect storage method calls
- Resolved socket hang-up errors during multiple file uploads
- Fixed database foreign key constraint violations during document deletion
- Corrected AI JSON parsing warnings and response truncation issues
- Fixed JSONB column handling for PostgreSQL 18+ compatibility
- Fixed linting errors in frontend code (const vs let declarations)
- Resolved missing table initialization for document_control_links
- Resolved Next.js 16.1.1 compatibility issues with dependencies
- Fixed overflow issues in document display containers
- Corrected OCR text extraction for various image formats

#### 🚀 **Performance Improvements**
- Sequential file upload reduces server load and connection timeouts
- Enhanced AI response processing with better content limits
- Improved database query efficiency for document operations
- Better memory management during large file processing
- Optimized image processing pipeline for OCR extraction

### **v0.2.1** - Enhanced Policy Generation & Submission Management (December 2025)

#### 🆕 **New Features**
- **Professional Word Document Export**: Download completed policy templates as formatted Word documents
  - **Filled Company Data**: All company information fields populated automatically in the Word document
  - **Professional Formatting**: Times New Roman font, proper margins, corporate document structure
  - **Microsoft Office Compatible**: Full compatibility with Word 2016+ and Office 365
  - **Signature Sections**: Built-in approval and signature areas for policy documentation

- **Complete Submission Management**: Comprehensive interface for managing completed templates
  - **📄 Download Word**: Download any completed submission as a formatted policy document
  - **🗑️ Delete Submissions**: Remove old or unwanted template submissions with confirmation
  - **Submission History**: View all completed templates with company details and validation status
  - **Persistent Storage**: All submissions saved locally with cross-session persistence

- **Enhanced AI Evidence Validation**: Improved real-time evidence analysis
  - **Backend API Integration**: New `/api/validate-evidence` endpoint for file analysis
  - **File Type Intelligence**: Smart validation based on evidence type (policy, configuration, screenshot)
  - **Enhanced Feedback**: Detailed findings and recommendations based on file content and format
  - **Fallback Processing**: Graceful handling when AI services are unavailable

#### 🔧 **Technical Improvements**
- **Next.js 15**: Updated to latest Next.js version for improved performance
- **Import Path Fixes**: Resolved module resolution issues across the application
- **JSON Serialization**: Fixed backend API JSON handling for reliable data processing
- **Error Handling**: Enhanced error handling for file uploads and API interactions
- **TypeScript Improvements**: Better type safety for template and submission interfaces

#### 🎨 **UI/UX Enhancements**
- **Action Buttons**: Clear download and delete actions on each submission
- **Visual Status Indicators**: Color-coded validation results with tooltips
- **Responsive Design**: Mobile-optimized submission management interface
- **Confirmation Dialogs**: User-friendly confirmation for destructive actions
- **Progress Feedback**: Real-time feedback during document generation and AI validation

#### 🐛 **Bug Fixes**
- Fixed template data not appearing in downloaded Word documents
- Resolved import path errors preventing build compilation
- Fixed AI validation not working with actual file uploads
- Corrected JSON parsing errors in backend API responses
- Resolved submission storage and retrieval issues

### **v0.2.0** - Template System & AI Validation (December 2025)

#### 🆕 **New Features**
- **Control Templates System**: Create reusable templates for compliance controls
  - Customizable company information fields (text, textarea, select, file inputs)
  - Evidence requirements definition with AI validation prompts
  - Template filling interface with real-time validation
  - Submission tracking and approval workflow

- **Essential Eight Templates**: Complete policy template system
  - **All 8 Controls Covered**: EE-1 through EE-8 with comprehensive templates
  - **Pre-built Templates**: Ready-to-use policy templates for each Essential Eight control
  - **Company-Specific Fields**: Tailored data collection for organization details
  - **Evidence Requirements**: Specific evidence types for each control requirement

- **AI-Powered Evidence Validation**: Real-time inspection of uploaded evidence
  - **Smart Analysis**: Custom AI prompts validate evidence against specific requirements
  - **Confidence Scoring**: AI provides confidence levels (60-95%) for validation results
  - **Detailed Findings**: Specific feedback on what was found in evidence documents
  - **Actionable Recommendations**: AI suggests improvements for better compliance
  - **Visual Feedback**: Color-coded status indicators (Passed/Warning/Failed)

#### 🔧 **Technical Improvements**
- **Navigation Enhancement**: Added Templates to sidebar navigation
- **Data Persistence**: Templates stored in localStorage with proper state management
- **Template Generation**: One-click generation from Essential Eight controls
- **Duplicate Prevention**: Prevents creating multiple templates for the same control
- **Form Validation**: Comprehensive validation for template fields and evidence uploads

#### 🎨 **UI/UX Enhancements**
- **Essential Eight Section**: Dedicated page for browsing and generating Essential Eight templates
- **Template Preview**: View template structure before generation
- **Progress Indicators**: Real-time feedback during AI validation
- **Responsive Design**: Mobile-friendly template forms and validation displays
- **Loading States**: Proper loading indicators for AI processing

#### 📋 **Essential Eight Controls Implemented**
1. **EE-1**: Application Control - Prevent unauthorized application execution
2. **EE-2**: Patch Applications - Timely application security patching
3. **EE-3**: Configure Microsoft Office Macro Settings - Macro security controls
4. **EE-4**: User Application Hardening - Browser and application security
5. **EE-5**: Restrict Administrative Privileges - Privilege management
6. **EE-6**: Patch Operating Systems - OS security patching
7. **EE-7**: Multi-Factor Authentication - MFA for all users
8. **EE-8**: Regular Backups - Data backup and recovery procedures

#### 🤖 **AI Validation Examples**
- **Policy Documents**: Verifies presence of required sections, roles, procedures
- **Configuration Files**: Checks for proper security settings and controls
- **Reports**: Validates compliance metrics and evidence completeness
- **Screenshots**: Analyzes visual evidence for configuration verification

#### 💾 **Data Management**
- **Template Storage**: Browser-based persistence using localStorage
- **Cross-Session**: Templates persist between browser sessions
- **Template Sharing**: Foundation for future multi-user template sharing

### **v0.1.0** - Initial Release
- Core compliance management functionality
- Document upload and evidence linking
- AI scanning capabilities for compliance analysis
- Essential Eight framework support
- Basic reporting and gap analysis

---

<p align="center">
  Made with ❤️ for the compliance community<br>
  <strong>Get Compliant Fast with GeekyGoose! 🦆</strong>
</p>