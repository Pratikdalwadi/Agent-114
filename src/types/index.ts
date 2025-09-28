// Enhanced PDF processing types with advanced grounding capabilities
// Preserves existing functionality while adding Yo's advanced features

import { z } from "zod";

// Enhanced bounding box with normalized coordinates [0,1] and top-left origin
export const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1), // Normalized x coordinate (0 = left edge, 1 = right edge)
  y: z.number().min(0).max(1), // Normalized y coordinate (0 = top edge, 1 = bottom edge)
  width: z.number().min(0).max(1), // Normalized width
  height: z.number().min(0).max(1), // Normalized height
});

// Landing AI-style grounding box schema (l, t, r, b format)
export const groundingBoxSchema = z.object({
  l: z.number().min(0).max(1), // Left x coordinate (normalized 0-1)
  t: z.number().min(0).max(1), // Top y coordinate (normalized 0-1) 
  r: z.number().min(0).max(1), // Right x coordinate (normalized 0-1)
  b: z.number().min(0).max(1), // Bottom y coordinate (normalized 0-1)
});

// Landing AI-style grounding information
export const groundingSchema = z.object({
  page: z.number().min(0), // Page index (0-based)
  box: groundingBoxSchema, // Bounding box coordinates
});

// Enhanced word schema with style information
export const wordSchema = z.object({
  text: z.string(),
  bbox: boundingBoxSchema,
  confidence: z.number().min(0).max(1),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  color: z.string().optional(),
});

// Enhanced line schema
export const lineSchema = z.object({
  id: z.string(),
  words: z.array(wordSchema),
  bbox: boundingBoxSchema,
  readingOrder: z.number(),
  lineHeight: z.number().optional(),
  alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

// Enhanced block schema with semantic understanding
export const blockSchema = z.object({
  id: z.string(),
  type: z.enum(['paragraph', 'heading', 'list', 'table', 'image', 'line', 'footer', 'header', 'form_field', 'signature', 'logo', 'caption']),
  bbox: boundingBoxSchema,
  lines: z.array(lineSchema),
  level: z.number().optional(), // for headings (h1=1, h2=2, etc.)
  confidence: z.number().min(0).max(1),
  semanticLabel: z.string().optional(),
  readingOrder: z.number().optional(),
  semanticRole: z.string().optional(),
});

// Landing AI-style text chunk schema with grounding
export const textChunkSchema = z.object({
  text: z.string(), // Extracted text content
  chunk_id: z.string(), // Unique identifier for the chunk
  chunk_type: z.enum(['text', 'table', 'figure', 'title', 'header', 'footer', 'list', 'caption', 'form_field']), // Type of content
  grounding: z.array(groundingSchema), // Array of grounding information (can span multiple areas/pages)
  confidence: z.number().min(0).max(1).optional(), // Extraction confidence
  semantic_role: z.string().optional(), // Semantic meaning like 'invoice_number', 'total_amount'
});

// Enhanced page schema with all processing layers
export const pageSchema = z.object({
  pageNumber: z.number(),
  width: z.number(),
  height: z.number(),
  words: z.array(wordSchema),
  lines: z.array(lineSchema),
  blocks: z.array(blockSchema),
  coverage: z.object({
    pdfNativeWords: z.number(),
    ocrWords: z.number(),
    reconciledWords: z.number(),
    coveragePercent: z.number().min(0).max(100),
    missedWords: z.array(z.string()).optional(),
  }),
  semanticRegions: z.array(z.object({
    id: z.string(),
    type: z.enum(['header', 'footer', 'main_content', 'sidebar', 'navigation', 'form', 'table', 'figure']),
    bbox: boundingBoxSchema,
    confidence: z.number().min(0).max(1),
    blockIds: z.array(z.string()),
  })).optional(),
});

// Intermediate representation schema for exact layout preservation
export const intermediateRepresentationSchema = z.object({
  pages: z.array(pageSchema),
  documentMetrics: z.object({
    totalWords: z.number(),
    totalLines: z.number(),
    totalBlocks: z.number(),
    overallCoverage: z.number().min(0).max(100),
    processingTime: z.number(),
    extractionMethods: z.array(z.string()), // ['pdf_native', 'ocr_tesseract', 'vision_api']
  }),
});

// Enhanced extraction result schema supporting both old and new formats
export const extractionResultSchema = z.object({
  // Legacy format support (existing PDF extractor)
  text: z.string().optional(),
  
  // Landing AI-style text chunks with grounding
  markdown: z.string().optional(), // User-friendly text representation
  chunks: z.array(textChunkSchema).optional(), // Text chunks with precise grounding
  
  // Intermediate representation for exact layout preservation
  intermediate_representation: intermediateRepresentationSchema.optional(),
  ir: intermediateRepresentationSchema.optional(), // Alias for compatibility
  
  metadata: z.object({
    processed_at: z.string(),
    extraction_mode: z.string().default('enhanced_ocr'),
    page_count: z.number().optional(),
    word_count: z.number().optional(),
    has_text: z.boolean().optional(),
    coverage_metrics: z.object({
      overall_coverage: z.number().min(0).max(100),
      method_coverage: z.record(z.number()),
      quality_score: z.number().min(0).max(100),
    }).optional(),
    processing_pipeline: z.array(z.string()).optional(),
  }),
});

// Type exports
export type BoundingBox = z.infer<typeof boundingBoxSchema>;
export type GroundingBox = z.infer<typeof groundingBoxSchema>;
export type Grounding = z.infer<typeof groundingSchema>;
export type Word = z.infer<typeof wordSchema>;
export type Line = z.infer<typeof lineSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Page = z.infer<typeof pageSchema>;
export type TextChunk = z.infer<typeof textChunkSchema>;
export type IntermediateRepresentation = z.infer<typeof intermediateRepresentationSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

// Legacy interface compatibility (for existing code)
export interface LegacyTextChunk {
  id: string;
  text: string;
  pageNumber: number;
  geometry: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface LegacyPageData {
  pageNumber: number;
  imageUrl: string;
  textChunks: LegacyTextChunk[];
}

// Utility functions for coordinate transformations
export function transformLegacyToGrounding(
  legacyChunk: LegacyTextChunk,
  pageWidth: number,
  pageHeight: number
): TextChunk {
  const normalizedBox: GroundingBox = {
    l: legacyChunk.geometry.x / pageWidth,
    t: legacyChunk.geometry.y / pageHeight,
    r: (legacyChunk.geometry.x + legacyChunk.geometry.w) / pageWidth,
    b: (legacyChunk.geometry.y + legacyChunk.geometry.h) / pageHeight,
  };

  return {
    chunk_id: legacyChunk.id,
    text: legacyChunk.text,
    chunk_type: 'text',
    grounding: [{
      page: legacyChunk.pageNumber - 1, // Convert to 0-based
      box: normalizedBox,
    }],
    confidence: 0.8, // Default confidence
  };
}

export function transformGroundingToLegacy(
  textChunk: TextChunk,
  pageWidth: number,
  pageHeight: number
): LegacyTextChunk {
  const grounding = textChunk.grounding[0]; // Use first grounding
  const box = grounding.box;

  return {
    id: textChunk.chunk_id,
    text: textChunk.text,
    pageNumber: grounding.page + 1, // Convert to 1-based
    geometry: {
      x: box.l * pageWidth,
      y: box.t * pageHeight,
      w: (box.r - box.l) * pageWidth,
      h: (box.b - box.t) * pageHeight,
    },
  };
}

export function transformGroundingToPixels(
  grounding: GroundingBox,
  documentWidth: number,
  documentHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(grounding.l * documentWidth),
    y: Math.round(grounding.t * documentHeight),
    width: Math.round((grounding.r - grounding.l) * documentWidth),
    height: Math.round((grounding.b - grounding.t) * documentHeight),
  };
}