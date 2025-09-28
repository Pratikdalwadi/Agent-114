# PDF Text Extractor - Replit Project Setup

## Overview
This is a React/TypeScript application that provides PDF text extraction capabilities with interactive highlighting and OCR support. The app uses Vite as the build tool and is configured for the Replit environment.

## Recent Changes (2025-09-28)
- ✅ Configured Vite server to use host 0.0.0.0 and port 5000 for Replit compatibility
- ✅ Added production start script for deployment
- ✅ Set up workflow for development server
- ✅ Fixed TypeScript compilation errors in PerfectExtractionDashboard component
- ✅ Added allowedHosts: true to Vite config for Replit host access
- ✅ Configured deployment settings for autoscale deployment (npm build -> npm start)
- ✅ Verified build process works correctly
- ✅ Successfully imported and configured GitHub project for Replit environment

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