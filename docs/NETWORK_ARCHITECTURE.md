# 🌐 Network Architecture Guide

This document explains the network configuration for GeekyGoose Compliance, designed to expose the web frontend to your LAN while keeping backend services secure in an internal Docker network.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        LAN Network                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Any Device on LAN                        │ │
│  │        📱💻🖥️ → http://YOUR-IP:3000                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                    Docker Host                              │
│                                                             │
│  ┌─────────────────────┐       ┌─────────────────────────┐  │
│  │   Frontend Network  │       │   Backend Network       │  │
│  │                     │       │  (Internal Only)        │  │
│  │  ┌───────────────┐  │       │  ┌─────────────────────┐ │  │
│  │  │  Next.js Web  │  │       │  │    PostgreSQL       │ │  │
│  │  │ Port: 3000    │◄─┼───────┼─►│    Port: 5432       │ │  │
│  │  │ (LAN Access)  │  │       │  └─────────────────────┘ │  │
│  │  └───────────────┘  │       │                         │  │
│  │         ▲            │       │  ┌─────────────────────┐ │  │
│  │         │            │       │  │      Redis          │ │  │
│  │  ┌───────────────┐  │       │  │    Port: 6379       │ │  │
│  │  │  FastAPI      │  │       │  └─────────────────────┘ │  │
│  │  │ Port: 8000    │◄─┼───────┼─►┌─────────────────────┐ │  │
│  │  │ (Internal)    │  │       │  │      MinIO          │ │  │
│  │  └───────────────┘  │       │  │   Ports: 9000/9001  │ │  │
│  │                     │       │  └─────────────────────┘ │  │
│  └─────────────────────┘       │                         │  │
│                                 │  ┌─────────────────────┐ │  │
│                                 │  │  Celery Worker      │ │  │
│                                 │  │                     │ │  │
│                                 │  └─────────────────────┘ │  │
│                                 └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration Details

### **Frontend Network**
- **Purpose**: Allows Next.js to communicate with FastAPI
- **Access**: Bridge network (allows external connections)
- **Services**: 
  - `web` (Next.js) - Exposed to LAN on port 3000
  - `api` (FastAPI) - Internal only, accessible via container name

### **Backend Network**
- **Purpose**: Internal communication between backend services
- **Access**: Internal only (`internal: true`)
- **Services**:
  - `postgres` - Database storage
  - `redis` - Task queue and caching
  - `minio` - Object storage for documents
  - `api` - Also connected to communicate with backend services
  - `worker` - Background job processing

## 🌐 Access Points

### **LAN Access (External)**
- **Web Interface**: `http://YOUR-LAN-IP:3000`
- **Accessible from**: Any device on your local network
- **Security**: Only the web frontend is exposed

### **Internal Services (No External Access)**
- **Database**: `postgres:5432` (container-to-container only)
- **Cache**: `redis:6379` (container-to-container only)  
- **Storage**: `minio:9000/9001` (container-to-container only)
- **API**: `api:8000` (accessible from web container only)

## 🔒 Security Benefits

1. **Principle of Least Privilege**: Only the web frontend is exposed
2. **Network Isolation**: Backend services can't be accessed from outside
3. **Data Protection**: Database and storage are completely internal
4. **API Security**: FastAPI only accessible through Next.js proxy

## 🚀 Getting Started

### **1. Start Services**
```bash
# Navigate to project root
cd /path/to/GeekyGoose-Compliance

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

### **2. Find Your LAN IP**
```bash
# Run the helper script
./scripts/get-lan-access.sh

# Or find manually:
# Linux: hostname -I
# macOS: ifconfig | grep "inet "
# Windows: ipconfig
```

### **3. Access from LAN**
- Open browser on any device connected to your network
- Navigate to: `http://YOUR-IP:3000`
- Example: `http://192.168.1.100:3000`

## 🔧 Configuration Files

### **Docker Compose Networks**
```yaml
networks:
  # Backend network - internal services only
  backend:
    driver: bridge
    internal: true  # No external access
  
  # Frontend network - for web app to communicate with API
  frontend:
    driver: bridge
```

### **Port Bindings**
```yaml
# Next.js - Exposed to LAN
web:
  ports:
    - "0.0.0.0:3000:3000"  # Bind to all interfaces

# Backend services - Internal only
api:
  expose:
    - "8000"  # No external port mapping

postgres:
  expose:
    - "5432"  # No external port mapping
```

### **Next.js Configuration**
```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://api:8000/api/:path*',
    },
  ]
}
```

## 🛠️ Troubleshooting

### **Web App Not Accessible from LAN**
1. Check Docker containers are running: `docker-compose ps`
2. Verify port binding: `docker port geekygoose-web`
3. Check firewall settings on host machine
4. Ensure devices are on same network/subnet

### **API Calls Failing**
1. Check if API container is running: `docker logs geekygoose-api`
2. Verify network connectivity: `docker exec geekygoose-web ping api`
3. Check Next.js rewrites in browser dev tools

### **Backend Services Not Connecting**
1. Check backend network: `docker network inspect geekygoose_backend`
2. Verify container connectivity: `docker exec geekygoose-api ping postgres`
3. Check environment variables: `docker exec geekygoose-api env`

## 🔄 Development vs Production

### **Development (Current Setup)**
- All services in Docker with hot reload
- Frontend exposed to LAN for testing
- Development credentials (change in production)

### **Production Recommendations**
- Add reverse proxy (Nginx) with SSL
- Use proper secrets management
- Add authentication/authorization
- Configure proper backup strategies
- Monitor logs and performance

## 📱 Mobile Access

Since the web frontend is accessible on your LAN, you can:
- Access from smartphones/tablets on your network
- Use the responsive interface designed for mobile
- Test templates and submissions from multiple devices
- Share with team members on same network

## 🔐 Security Considerations

- **Change default passwords** in production
- **Add HTTPS** for sensitive data
- **Configure firewall rules** as needed
- **Monitor access logs** for security
- **Regular updates** of Docker images

---

For more information, see the main [README.md](../README.md) or contact support.