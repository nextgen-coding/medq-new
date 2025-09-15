# Medical Question Platform - Complete Documentation

This documentation provides **comprehensive guidance** for recreating the medical question platform's admin features, specifically the **Admin Validation System** and **Import Functionality**.

> � **Note**: This `/new-docs` folder contains the **complete, organized documentation** for all admin validation and import systems. This supersedes any scattered documentation files in the root directory.

## 📚 Complete Documentation Index

### 🎯 Core System Documentation
1. [**Admin Validation System**](./admin-validation.md) - Complete validation system with AI integration
2. [**Admin Import System**](./admin-import.md) - File import and processing system
3. [**AI Assistant Documentation**](./ai-assistant-documentation.md) - Detailed AI explanation system workflow
4. [**Complete Admin System Architecture**](./complete-admin-system-architecture.md) - Comprehensive overview of all interconnected systems

### 🔧 Technical References
5. [**API Reference**](./api-reference.md) - All API endpoints and schemas
6. [**Database Schema**](./database-schema.md) - Database structure and relationships
7. [**Components Documentation**](./components.md) - Reusable UI components
8. [**Configuration & Setup**](./setup.md) - Environment configuration and deployment

## 🏗️ What's Documented Here

This documentation covers **every aspect** of the admin system:

### ✅ **Admin Validation System** (`/admin/validation`)
- **Dual Validation**: Classic validation + AI-powered validation with Azure OpenAI
- **Real-time Management**: Live job tracking with auto-refresh and pagination
- **Background Processing**: Persistent AI jobs with progress tracking
- **Components**: `PersistentAiJob`, `FilePreviewDialog`, job management interface

### ✅ **Admin Import System** (`/admin/import`)
- **Dual Import Modes**: Session import + Multi-sheet question import
- **Advanced Processing**: Excel/CSV parsing, Google Drive integration
- **Background Sessions**: Import session management with persistence
- **Components**: `SessionImportPanel`, `QuestionImportPanel` with progress tracking

### ✅ **AI Assistant System**
- **Azure OpenAI Integration**: GPT-4 model for medical explanations
- **Medical Expert Prompts**: Specialized prompts for medical accuracy
- **Batch Processing**: Efficient API usage with controlled concurrency
- **Quality Validation**: Response validation and error handling

### ✅ **Complete API Architecture**
- **15+ API Endpoints**: All validation, import, and job management endpoints
- **Real-time Progress**: Live updates with WebSocket-like polling
- **Security Layers**: Multi-layer authentication and permission validation
- **Background Services**: Job managers and processors with auto-recovery

### ✅ **Database & Components**
- **Complete Schema**: `AiValidationJob` model with all fields and relationships
- **UI Components**: All validation and import components with real-time features
- **Performance Optimizations**: Pagination, conditional refresh, batch processing

## 🏗️ System Architecture

```
Frontend (Next.js 15)
├── Admin Validation Page (/admin/validation)
│   ├── Statistics Dashboard (4 counters)
│   ├── Job Management Table (pagination)
│   ├── PersistentAiJob Component
│   └── FilePreviewDialog (real-time)
├── Admin Import Page (/admin/import)
│   ├── SessionImportPanel (Excel/CSV)
│   └── QuestionImportPanel (multi-sheet)
└── Real-time Auto-refresh System

Backend APIs (15+ endpoints)
├── AI Jobs Management (/api/ai-jobs/*)
│   ├── Job listing with admin filter
│   ├── Job details and deletion
│   ├── Real-time preview
│   └── Enhanced file download
├── Validation Processing (/api/validation/*)
│   ├── Classic validation
│   └── AI validation (job creation)
├── Question Import (/api/questions/*)
│   ├── Bulk import with sessions
│   └── Progress tracking
└── Background Services
    ├── Job Manager (singleton)
    ├── AI Job Processor
    └── Import Session Manager

Database (PostgreSQL + Prisma)
├── AiValidationJob (complete model)
├── Import Sessions (persistent)
├── Progress Tracking
└── User & Permission Management
```
├── AiValidationJob (job tracking)
├── Question (medical questions)
├── Session (exam sessions)
└── User (authentication)

Background Services
├── Job Manager (queue processing)
├── AI Processor (Azure OpenAI)
└── File Processing Pipeline
```

## 🚀 Quick Start

1. **Setup Environment**
   ```bash
   npm install
   cp .env.example .env.local
   # Configure database and Azure OpenAI
   ```

2. **Database Migration**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Access Admin Features**
   - Navigate to `/admin/validation` for AI validation
   - Navigate to `/admin/import` for file imports

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Azure OpenAI API access (optional for AI features)
- Admin user account

## 📖 Detailed Documentation

Each section provides complete implementation details:

- **[Admin Validation](./admin-validation.md)**: Complete validation system implementation
- **[Admin Import](./admin-import.md)**: File import and processing system  
- **[API Reference](./api-reference.md)**: All API endpoints and schemas
- **[Database Schema](./database-schema.md)**: Database structure and relationships
- **[Components](./components.md)**: Reusable UI components
- **[Setup Guide](./setup.md)**: Environment configuration and deployment
- **[Complete Admin System Architecture](./complete-admin-system-architecture.md)**: Comprehensive overview of all admin validation and import systems with their interconnected components

---

**Note**: This documentation covers the core admin functionality for managing medical questions and validation workflows. All features are designed for administrator users with appropriate permissions.