import { Document, ExtractionJob, ExtractionResult } from "@shared/schema";

export interface UploadResponse {
  documents: Document[];
}

export interface JobResponse {
  job: ExtractionJob;
}

export interface JobsResponse {
  jobs: ExtractionJob[];
}

export interface DocumentsResponse {
  documents: Document[];
}

export interface StartExtractionRequest {
  documentId: string;
  aiProvider: 'openai' | 'gemini';
  extractionMode: 'smart_table' | 'full_text' | 'form_fields' | 'custom' | 'smart_image' | 'automatic_schema' | 'comprehensive' | 'vlm_layout_aware' | 'automated_box_detection' | 'hierarchical_structure_analysis' | 'visual_grounding';
  outputFormat: 'json' | 'csv' | 'markdown';
  preserveFormatting: boolean;
  includeConfidence: boolean;
  openaiApiKey?: string;
  geminiApiKey?: string;
}

export interface ExtractionSettings {
  aiProvider: 'openai' | 'gemini';
  extractionMode: 'smart_table' | 'full_text' | 'form_fields' | 'custom' | 'smart_image' | 'automatic_schema' | 'comprehensive' | 'vlm_layout_aware' | 'automated_box_detection' | 'hierarchical_structure_analysis' | 'visual_grounding';
  outputFormat: 'json' | 'csv' | 'markdown';
  preserveFormatting: boolean;
  includeConfidence: boolean;
  openaiApiKey?: string;
  geminiApiKey?: string;
}
