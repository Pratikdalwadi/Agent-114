# PDF Text Extractor - Replit Project Setup

## Overview
This is a React/TypeScript application that provides PDF text extraction capabilities with interactive highlighting and OCR support. The app uses Vite as the build tool and is configured for the Replit environment. This project has been successfully imported from GitHub and configured for Replit.

## Recent Changes (2025-09-29)
- ✅ Successfully imported GitHub project into Replit environment
- ✅ Installed all frontend dependencies (React, Vite, shadcn/ui, etc.)
- ✅ Integrated backend server components from extracted project
- ✅ Set up PostgreSQL database with Drizzle ORM schema
- ✅ Configured development workflow for frontend development
- ✅ Frontend application running successfully on port 5000
- ✅ Added dual script support (frontend-only and full-stack)
- ✅ Configured deployment settings for autoscale deployment
- ✅ Verified frontend interface works with PDF upload functionality

## Project Architecture
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Routing**: React Router DOM
- **State Management**: TanStack Query for server state
- **PDF Processing**: react-pdf + tesseract.js for OCR
- **Build Tool**: Vite 5.x

## Key Features
- PDF document upload and processing
- Text extraction with bounding box visualization
- OCR support for scanned documents
- Interactive text highlighting
- Search functionality across extracted text
- Multi-page document support
- Responsive design with dark mode support

## Configuration Files
- `vite.config.ts`: Development server configured for Replit (port 5000, host 0.0.0.0)
- `tailwind.config.ts`: Custom PDF viewer design system colors
- `package.json`: Added production start script for deployment
- `index.html`: SEO optimized with meta tags

## Development Workflow
1. Run `npm run dev` to start development server on port 5000
2. Frontend automatically reloads on file changes
3. Build for production with `npm run build`
4. Preview production build with `npm start`

## Deployment Configuration
- Target: Autoscale (stateless web application)
- Build: `npm run build`
- Start: `npm start` (serves built files on port 5000)

## Dependencies Highlights
- Core: React, TypeScript, Vite
- UI: shadcn/ui components, Tailwind CSS, Lucide React icons
- PDF: react-pdf, tesseract.js for OCR
- Routing: React Router DOM
- State: TanStack Query
- Forms: React Hook Form + Zod validation

## User Preferences
- Clean, modern UI with interactive PDF processing capabilities
- Responsive design optimized for both desktop and mobile
- Professional color scheme with proper contrast