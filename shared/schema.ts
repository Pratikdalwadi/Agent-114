import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  filePath: text("file_path").notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractionJobs = pgTable("extraction_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  aiProvider: text("ai_provider").notNull(), // openai, gemini
  extractionMode: text("extraction_mode").notNull(), // smart_table, full_text, form_fields, custom, smart_image, vlm_layout_aware
  outputFormat: text("output_format").notNull(), // json, csv, markdown
  preserveFormatting: boolean("preserve_formatting").default(true),
  includeConfidence: boolean("include_confidence").default(false),
  progress: integer("progress").default(0),
  result: jsonb("result"),
  error: text("error"),
  confidence: integer("confidence"), // 0-100
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const schemaTemplates = pgTable("schema_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  schema: jsonb("schema").notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertExtractionJobSchema = createInsertSchema(extractionJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertSchemaTemplateSchema = createInsertSchema(schemaTemplates).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type ExtractionJob = typeof extractionJobs.$inferSelect;
export type InsertExtractionJob = z.infer<typeof insertExtractionJobSchema>;

export type SchemaTemplate = typeof schemaTemplates.$inferSelect;
export type InsertSchemaTemplate = z.infer<typeof insertSchemaTemplateSchema>;

// Intermediate Representation (IR) schemas for exact layout preservation
// Enhanced bounding box with normalized coordinates [0,1] and top-left origin
export const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1), // Normalized x coordinate (0 = left edge, 1 = right edge)
  y: z.number().min(0).max(1), // Normalized y coordinate (0 = top edge, 1 = bottom edge)
  width: z.number().min(0).max(1), // Normalized width
  height: z.number().min(0).max(1), // Normalized height
});

// Spatial relationship schema for VLM understanding
export const spatialRelationshipSchema = z.object({
  elementId: z.string(),
  relationshipType: z.enum(['left-of', 'right-of', 'above', 'below', 'contains', 'contained-by', 'overlaps']),
  confidence: z.number().min(0).max(1),
  distance: z.number().optional(), // Normalized distance between elements
});

// Key-value pair schema for form fields and structured data
export const keyValuePairSchema = z.object({
  key: z.object({
    text: z.string(),
    bbox: boundingBoxSchema,
    confidence: z.number().min(0).max(1),
  }),
  value: z.object({
    text: z.string(),
    bbox: boundingBoxSchema,
    confidence: z.number().min(0).max(1),
  }),
  relationship: z.enum(['adjacent', 'aligned', 'grouped']),
  semanticType: z.string().optional(), // e.g., 'invoice_number', 'total_amount', 'date'
});

export const wordSchema = z.object({
  text: z.string(),
  bbox: boundingBoxSchema,
  confidence: z.number().min(0).max(1),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  color: z.string().optional(),
});

export const lineSchema = z.object({
  id: z.string(),
  words: z.array(wordSchema),
  bbox: boundingBoxSchema,
  readingOrder: z.number(),
  lineHeight: z.number().optional(),
  alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const shapeSchema = z.object({
  type: z.enum(['line', 'rectangle', 'oval', 'table_border']),
  bbox: boundingBoxSchema,
  strokeWidth: z.number().optional(),
  strokeColor: z.string().optional(),
  fillColor: z.string().optional(),
  coordinates: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
});

export const tableCellSchema = z.object({
  text: z.string(),
  bbox: boundingBoxSchema,
  row: z.number(),
  col: z.number(),
  rowSpan: z.number().default(1),
  colSpan: z.number().default(1),
  confidence: z.number().min(0).max(1),
  isHeader: z.boolean().default(false),
});

export const tableSchema = z.object({
  id: z.string(),
  bbox: boundingBoxSchema,
  cells: z.array(tableCellSchema),
  rows: z.number(),
  cols: z.number(),
  confidence: z.number().min(0).max(1),
  title: z.string().optional(),
  caption: z.string().optional(),
});

export const blockSchema = z.object({
  id: z.string(),
  type: z.enum(['paragraph', 'heading', 'list', 'table', 'image', 'line', 'footer', 'header', 'form_field', 'signature', 'logo', 'caption']),
  bbox: boundingBoxSchema,
  lines: z.array(lineSchema),
  level: z.number().optional(), // for headings (h1=1, h2=2, etc.)
  listType: z.enum(['ordered', 'unordered']).optional(),
  confidence: z.number().min(0).max(1),
  semanticLabel: z.string().optional(),
  // Enhanced VLM features
  readingOrder: z.number().optional(), // Sequential order in document flow
  visualHierarchy: z.number().optional(), // Visual importance level (1=most important)
  semanticRole: z.string().optional(), // 'title', 'address', 'amount', 'date', etc.
  spatialRelationships: z.array(spatialRelationshipSchema).optional(),
  textDirection: z.enum(['ltr', 'rtl', 'ttb']).default('ltr'),
  alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
  styleProperties: z.object({
    fontWeight: z.enum(['normal', 'bold', 'light']).optional(),
    fontStyle: z.enum(['normal', 'italic']).optional(),
    textDecoration: z.enum(['none', 'underline', 'strikethrough']).optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
  }).optional(),
});

export const pageSchema = z.object({
  pageNumber: z.number(),
  width: z.number(),
  height: z.number(),
  words: z.array(wordSchema),
  lines: z.array(lineSchema),
  blocks: z.array(blockSchema),
  tables: z.array(tableSchema),
  shapes: z.array(shapeSchema),
  coverage: z.object({
    pdfNativeWords: z.number(),
    ocrWords: z.number(),
    reconciledWords: z.number(),
    coveragePercent: z.number().min(0).max(100),
    missedWords: z.array(z.string()).optional(),
  }),
  // Enhanced VLM features for document understanding
  keyValuePairs: z.array(keyValuePairSchema).optional(),
  documentStructure: z.object({
    layoutType: z.enum(['single_column', 'multi_column', 'table_heavy', 'form_based', 'mixed']),
    readingFlow: z.array(z.string()), // Array of block IDs in reading order
    visualHierarchy: z.array(z.object({
      blockId: z.string(),
      level: z.number(),
      importance: z.number().min(0).max(1),
    })),
  }).optional(),
  spatialGraph: z.object({
    relationships: z.array(spatialRelationshipSchema),
    containers: z.array(z.object({
      containerId: z.string(),
      containedIds: z.array(z.string()),
      containerType: z.enum(['column', 'section', 'table', 'form', 'group']),
    })),
  }).optional(),
  semanticRegions: z.array(z.object({
    id: z.string(),
    type: z.enum(['header', 'footer', 'main_content', 'sidebar', 'navigation', 'form', 'table', 'figure']),
    bbox: boundingBoxSchema,
    confidence: z.number().min(0).max(1),
    blockIds: z.array(z.string()),
  })).optional(),
});

export const intermediateRepresentationSchema = z.object({
  pages: z.array(pageSchema),
  documentMetrics: z.object({
    totalWords: z.number(),
    totalLines: z.number(),
    totalBlocks: z.number(),
    totalTables: z.number(),
    overallCoverage: z.number().min(0).max(100),
    processingTime: z.number(),
    extractionMethods: z.array(z.string()), // ['pdf_native', 'ocr_tesseract', 'ocr_paddle', 'vision_api']
  }),
});

// Enhanced extraction result schema with IR
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

// Landing AI-style text chunk schema
export const textChunkSchema = z.object({
  text: z.string(), // Extracted text content
  chunk_id: z.string(), // Unique identifier for the chunk
  chunk_type: z.enum(['text', 'table', 'figure', 'title', 'header', 'footer', 'list', 'caption', 'form_field']), // Type of content
  grounding: z.array(groundingSchema), // Array of grounding information (can span multiple areas/pages)
  confidence: z.number().min(0).max(1).optional(), // Extraction confidence
  semantic_role: z.string().optional(), // Semantic meaning like 'invoice_number', 'total_amount'
});

export const extractionResultSchema = z.object({
  // Legacy fields for backwards compatibility
  tables: z.array(z.object({
    title: z.string().optional(),
    confidence: z.number().min(0).max(1),
    data: z.array(z.record(z.any())),
    headers: z.array(z.string()).optional(),
    summary: z.record(z.any()).optional(),
  })),
  text: z.string().optional(),
  objects: z.array(z.object({
    label: z.string(),
    confidence: z.number().min(0).max(1),
    description: z.string().optional(),
    category: z.string().optional(),
    bbox: boundingBoxSchema.optional(),
  })).optional(),
  structured_content: z.string().optional(),
  
  // Landing AI-style text chunks with grounding
  markdown: z.string().optional(), // User-friendly text representation
  chunks: z.array(textChunkSchema).optional(), // Text chunks with precise grounding
  
  // New IR field for exact layout preservation
  ir: intermediateRepresentationSchema.optional(),
  // Alias for intermediate representation to maintain component compatibility
  intermediate_representation: intermediateRepresentationSchema.optional(),
  
  metadata: z.object({
    processed_at: z.string(),
    ai_provider: z.string(),
    extraction_mode: z.string(),
    page_count: z.number().optional(),
    word_count: z.number().optional(),
    has_text: z.boolean().optional(),
    object_count: z.number().optional(),
    // Enhanced metadata
    coverage_metrics: z.object({
      overall_coverage: z.number().min(0).max(100),
      method_coverage: z.record(z.number()),
      quality_score: z.number().min(0).max(100),
    }).optional(),
    processing_pipeline: z.array(z.string()).optional(),
  }),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

// IR type exports
export type BoundingBox = z.infer<typeof boundingBoxSchema>;
export type SpatialRelationship = z.infer<typeof spatialRelationshipSchema>;
export type KeyValuePair = z.infer<typeof keyValuePairSchema>;
export type Word = z.infer<typeof wordSchema>;
export type Line = z.infer<typeof lineSchema>;
export type Shape = z.infer<typeof shapeSchema>;
export type TableCell = z.infer<typeof tableCellSchema>;
export type Table = z.infer<typeof tableSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Page = z.infer<typeof pageSchema>;
export type IntermediateRepresentation = z.infer<typeof intermediateRepresentationSchema>;

// Landing AI-style type exports
export type GroundingBox = z.infer<typeof groundingBoxSchema>;
export type Grounding = z.infer<typeof groundingSchema>;
export type TextChunk = z.infer<typeof textChunkSchema>;

// Database relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  schemaTemplates: many(schemaTemplates),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  extractionJobs: many(extractionJobs),
}));

export const extractionJobsRelations = relations(extractionJobs, ({ one }) => ({
  document: one(documents, {
    fields: [extractionJobs.documentId],
    references: [documents.id],
  }),
}));

export const schemaTemplatesRelations = relations(schemaTemplates, ({ one }) => ({
  user: one(users, {
    fields: [schemaTemplates.userId],
    references: [users.id],
  }),
}));
