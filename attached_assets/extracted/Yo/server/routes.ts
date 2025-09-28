import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { upload } from "./middleware/upload";
import { documentProcessor } from "./services/documentProcessor";
import { ExportService } from "./services/exportService";
import { insertDocumentSchema, insertExtractionJobSchema } from "@shared/schema";
import { z } from "zod";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Document upload endpoint
  app.post("/api/documents/upload", upload.array('files', 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const documents = [];
      for (const file of files) {
        const documentData = {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          filePath: file.path,
          userId: null, // In a real app, get from session
        };

        const validatedData = insertDocumentSchema.parse(documentData);
        const document = await storage.createDocument(validatedData);
        documents.push(document);
      }

      res.json({ documents });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get documents
  app.get("/api/documents", async (req, res) => {
    try {
      // In a real app, filter by user
      const documents = await storage.getDocumentsByUser(null);
      res.json({ documents });
    } catch (error) {
      console.error("Documents fetch error:", error);
      res.status(500).json({ message: "Failed to fetch documents", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get specific document
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ document });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch document", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Serve document file
  app.get("/api/documents/:id/file", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if file exists
      const fs = await import('fs');
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(document.filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: "Failed to serve file", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // First, delete all related extraction jobs to avoid foreign key constraint violation
      await storage.deleteExtractionJobsByDocument(req.params.id);
      
      // Delete the file from filesystem
      try {
        const fs = await import('fs');
        if (fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
        }
      } catch (fileError) {
        console.warn(`Failed to delete file ${document.filePath}:`, fileError);
      }
      
      // Now delete the document
      await storage.deleteDocument(req.params.id);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Start extraction job
  app.post("/api/extraction/start", async (req, res) => {
    try {
      const schema = z.object({
        documentId: z.string(),
        aiProvider: z.enum(['openai', 'gemini']),
        extractionMode: z.enum(['smart_table', 'full_text', 'form_fields', 'custom', 'smart_image', 'automatic_schema', 'comprehensive', 'vlm_layout_aware', 'automated_box_detection', 'hierarchical_structure_analysis', 'visual_grounding']),
        outputFormat: z.enum(['json', 'csv', 'markdown']),
        preserveFormatting: z.boolean().default(true),
        includeConfidence: z.boolean().default(false),
        openaiApiKey: z.string().optional(),
        geminiApiKey: z.string().optional(),
      });

      const validatedData = schema.parse(req.body);
      
      // Check if document exists
      const document = await storage.getDocument(validatedData.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Extract API keys before creating job data to prevent persistence
      const { openaiApiKey, geminiApiKey, ...jobDataWithoutKeys } = validatedData;
      
      // Create extraction job without API keys
      const jobData = {
        ...jobDataWithoutKeys,
        status: "pending" as const,
      };

      const job = await storage.createExtractionJob(jobData);

      // Start processing in background with API keys
      const apiKeys = {
        openaiApiKey: validatedData.openaiApiKey,
        geminiApiKey: validatedData.geminiApiKey,
      };
      documentProcessor.startProcessing(job.id, apiKeys);

      res.json({ job });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to start extraction", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get extraction job status
  app.get("/api/extraction/:jobId", async (req, res) => {
    try {
      const job = await storage.getExtractionJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({ job });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get extraction jobs for user
  app.get("/api/extraction", async (req, res) => {
    try {
      // In a real app, get user ID from session
      const jobs = await storage.getExtractionJobsByUser(null);
      
      // Sort by creation date, newest first
      jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json({ jobs });
    } catch (error) {
      console.error("Extraction jobs fetch error:", error);
      res.status(500).json({ message: "Failed to fetch jobs", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get extraction jobs for a specific document
  app.get("/api/extraction/document/:documentId", async (req, res) => {
    try {
      const jobs = await storage.getExtractionJobsByDocument(req.params.documentId);
      
      // Sort by creation date, newest first
      jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json({ jobs });
    } catch (error) {
      console.error("Document extraction jobs fetch error:", error);
      res.status(500).json({ message: "Failed to fetch document jobs", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Download extraction result
  app.get("/api/extraction/:jobId/download", async (req, res) => {
    try {
      const job = await storage.getExtractionJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status !== 'completed' || !job.result) {
        return res.status(400).json({ message: "Job not completed or no result available" });
      }

      const format = req.query.format as string || job.outputFormat;
      let content: string;
      
      switch (format) {
        case 'json':
          content = ExportService.exportToJSON(job.result as any);
          break;
        case 'csv':
          content = ExportService.exportToCSV(job.result as any);
          break;
        case 'markdown':
          content = ExportService.exportToMarkdown(job.result as any);
          break;
        default:
          return res.status(400).json({ message: "Invalid format" });
      }

      const document = await storage.getDocument(job.documentId);
      const filename = document ? 
        `${path.parse(document.originalName).name}_extracted.${ExportService.getFileExtension(format)}` :
        `extraction_${job.id}.${ExportService.getFileExtension(format)}`;

      res.setHeader('Content-Type', ExportService.getContentType(format));
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      res.status(500).json({ message: "Download failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}
