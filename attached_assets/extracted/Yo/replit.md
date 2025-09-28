# Document Extraction Web Application

## Overview

This is a comprehensive document extraction web application that processes PDFs, images (JPG, PNG) and extracts structured data using AI-powered OCR and vision-language models. The application features a React frontend with a modern UI built using shadcn/ui components, an Express.js backend, and integrates with multiple AI providers (OpenAI, Google Gemini) for intelligent document analysis. The system supports various extraction modes including smart table detection, full text extraction, form field identification, and advanced vision-language model processing that preserves document layout and spatial relationships.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client uses a modern React setup with TypeScript and Vite for fast development. The UI is built with shadcn/ui components providing a consistent design system with Tailwind CSS for styling. The frontend uses Wouter for lightweight routing and TanStack Query for efficient data fetching and state management. The architecture includes document upload functionality, real-time processing status updates, and document preview capabilities with PDF viewing support.

### Backend Architecture
The server is built on Express.js with TypeScript, providing RESTful APIs for document upload, processing, and export. The backend implements a modular service architecture with separate concerns for document processing, AI provider integration, and data storage. It includes middleware for file upload handling with Multer, supports multiple file formats (PDF, JPG, PNG), and provides comprehensive error handling and validation using Zod schemas.

### Data Storage Solutions
The application uses Drizzle ORM with PostgreSQL for structured data persistence. The database schema includes tables for users, documents, extraction jobs, and schema templates. The storage layer is abstracted through an interface pattern, allowing for both database and in-memory storage implementations. File uploads are stored on the filesystem with metadata tracked in the database.

### Authentication and Authorization
The system includes a basic user management structure with username/password authentication, though the current implementation allows for guest usage. The database schema supports user-specific document access and job management, with provisions for user-based filtering and access control.

### AI Processing Pipeline
The application implements a sophisticated multi-provider AI extraction system. It supports OpenAI GPT models and Google Gemini for vision-language processing. The system includes multiple extraction modes: smart table detection for structured data, full text extraction with formatting preservation, form field identification, and advanced VLM (Vision-Language Model) processing that maintains spatial relationships and document layout. The architecture includes a Python OCR service for enhanced text extraction using PaddleOCR and Tesseract, providing fallback options and improving extraction accuracy.

## External Dependencies

### AI Service Providers
- **OpenAI API**: Primary AI provider for document analysis using GPT models with vision capabilities
- **Google Gemini API**: Alternative AI provider for vision-language model processing
- **Python OCR Service**: Local service running PaddleOCR and Tesseract for enhanced text extraction

### Database and Storage
- **PostgreSQL**: Primary database using Neon serverless or standard PostgreSQL
- **Drizzle ORM**: Type-safe database access layer with PostgreSQL dialect
- **File System Storage**: Local file storage for uploaded documents with organized directory structure

### UI and Frontend Libraries
- **shadcn/ui**: Comprehensive component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **React PDF Viewer**: Document preview functionality for PDF files
- **TanStack Query**: Data fetching and caching for efficient API communication

### Development and Build Tools
- **Vite**: Fast build tool and development server with React plugin
- **TypeScript**: Type safety across frontend and backend
- **Replit Plugins**: Development environment integration for runtime error handling and debugging