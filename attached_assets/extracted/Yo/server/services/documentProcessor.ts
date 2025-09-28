import { ExtractionJob, ExtractionResult } from "@shared/schema";
import { createAIProvider, ExtractionOptions } from "./aiProvider";
import { storage } from "../storage";
import fs from "fs";

export class DocumentProcessor {
  private static instance: DocumentProcessor;

  static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  async processDocument(jobId: string, apiKeys?: { openaiApiKey?: string; geminiApiKey?: string }): Promise<void> {
    const job = await storage.getExtractionJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const document = await storage.getDocument(job.documentId);
    if (!document) {
      throw new Error(`Document ${job.documentId} not found`);
    }

    try {
      // Update job status to processing
      await storage.updateExtractionJob(jobId, { 
        status: 'processing',
        progress: 10 
      });

      // Verify file exists with improved error handling
      const absoluteFilePath = document.filePath.startsWith('/') 
        ? document.filePath 
        : require('path').join(process.cwd(), document.filePath);
        
      if (!fs.existsSync(absoluteFilePath)) {
        console.error(`File not found at: ${absoluteFilePath}`);
        console.error(`Original filePath: ${document.filePath}`);
        console.error(`Current working directory: ${process.cwd()}`);
        
        // Try alternative path construction
        const alternativePath = require('path').join(process.cwd(), 'uploads', require('path').basename(document.filePath));
        if (fs.existsSync(alternativePath)) {
          console.log(`Found file at alternative path: ${alternativePath}`);
          // Update the document with correct path
          await storage.updateDocumentPath(document.id, alternativePath);
          document.filePath = alternativePath;
        } else {
          throw new Error(`File not found: ${document.filePath}. Checked paths: ${absoluteFilePath}, ${alternativePath}`);
        }
      } else {
        // Ensure we use the absolute path for processing
        document.filePath = absoluteFilePath;
      }

      // Update progress
      await storage.updateExtractionJob(jobId, { progress: 30 });

      // Create AI provider
      const aiProvider = createAIProvider(job.aiProvider as 'openai' | 'gemini');

      // Prepare extraction options
      const options: ExtractionOptions = {
        extractionMode: job.extractionMode as any,
        preserveFormatting: job.preserveFormatting ?? true,
        includeConfidence: job.includeConfidence ?? false,
        openaiApiKey: apiKeys?.openaiApiKey,
        geminiApiKey: apiKeys?.geminiApiKey,
      };

      // Update progress
      await storage.updateExtractionJob(jobId, { progress: 50 });

      // Perform extraction
      let result: ExtractionResult;
      let confidence: number;

      try {
        result = await aiProvider.extractData(document.filePath, options);
        // Calculate overall confidence
        confidence = this.calculateOverallConfidence(result);
        
        // Update progress after successful AI extraction
        await storage.updateExtractionJob(jobId, { progress: 90 });
      } catch (aiError) {
        console.error(`AI extraction error: ${aiError}`);
        // If AI extraction fails, re-throw to be caught by outer catch block
        throw aiError;
      }

      // Save result - only reached if extraction was successful
      await storage.updateExtractionJob(jobId, {
        status: 'completed',
        progress: 100,
        result: result as any,
        confidence,
        completedAt: new Date(),
      });

    } catch (error) {
      console.error(`Processing failed for job ${jobId}:`, error);
      await storage.updateExtractionJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private calculateOverallConfidence(result: ExtractionResult): number {
    if (!result.tables || result.tables.length === 0) {
      return 75; // Default confidence for non-table extractions
    }

    const confidenceScores = result.tables
      .map(table => table.confidence)
      .filter(score => typeof score === 'number');

    if (confidenceScores.length === 0) {
      return 75;
    }

    const avgConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    return Math.round(avgConfidence * 100);
  }

  // Start background processing (in a real app, this would use a job queue)
  async startProcessing(jobId: string, apiKeys?: { openaiApiKey?: string; geminiApiKey?: string }): Promise<void> {
    // In a real application, you would use a job queue like Bull or Bee-Queue
    // For this implementation, we'll process immediately in the background
    setImmediate(() => {
      this.processDocument(jobId, apiKeys).catch(console.error);
    });
  }
}

export const documentProcessor = DocumentProcessor.getInstance();
