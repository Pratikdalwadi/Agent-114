import { type User, type InsertUser, type Document, type InsertDocument, type ExtractionJob, type InsertExtractionJob, type SchemaTemplate, type InsertSchemaTemplate, users, documents, extractionJobs, schemaTemplates } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, sql, isNull, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Document methods
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByUser(userId: string | null): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentPath(id: string, filePath: string): Promise<void>;
  deleteDocument(id: string): Promise<void>;

  // Extraction job methods
  getExtractionJob(id: string): Promise<ExtractionJob | undefined>;
  getExtractionJobsByDocument(documentId: string): Promise<ExtractionJob[]>;
  getExtractionJobsByUser(userId: string | null): Promise<ExtractionJob[]>;
  createExtractionJob(job: InsertExtractionJob): Promise<ExtractionJob>;
  updateExtractionJob(id: string, updates: Partial<ExtractionJob>): Promise<ExtractionJob | undefined>;
  deleteExtractionJob(id: string): Promise<void>;
  deleteExtractionJobsByDocument(documentId: string): Promise<void>;

  // Schema template methods
  getSchemaTemplate(id: string): Promise<SchemaTemplate | undefined>;
  getSchemaTemplatesByUser(userId: string): Promise<SchemaTemplate[]>;
  createSchemaTemplate(template: InsertSchemaTemplate): Promise<SchemaTemplate>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private extractionJobs: Map<string, ExtractionJob>;
  private schemaTemplates: Map<string, SchemaTemplate>;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.extractionJobs = new Map();
    this.schemaTemplates = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Document methods
  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentsByUser(userId: string | null): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.userId === userId);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = {
      ...insertDocument,
      id,
      userId: insertDocument.userId ?? null,
      createdAt: new Date(),
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocumentPath(id: string, filePath: string): Promise<void> {
    const document = this.documents.get(id);
    if (document) {
      document.filePath = filePath;
      this.documents.set(id, document);
    }
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  // Extraction job methods
  async getExtractionJob(id: string): Promise<ExtractionJob | undefined> {
    return this.extractionJobs.get(id);
  }

  async getExtractionJobsByDocument(documentId: string): Promise<ExtractionJob[]> {
    return Array.from(this.extractionJobs.values()).filter(job => job.documentId === documentId);
  }

  async getExtractionJobsByUser(userId: string | null): Promise<ExtractionJob[]> {
    const userDocuments = await this.getDocumentsByUser(userId);
    const documentIds = new Set(userDocuments.map(doc => doc.id));
    return Array.from(this.extractionJobs.values()).filter(job => documentIds.has(job.documentId));
  }

  async createExtractionJob(insertJob: InsertExtractionJob): Promise<ExtractionJob> {
    const id = randomUUID();
    const job: ExtractionJob = {
      ...insertJob,
      id,
      status: insertJob.status ?? 'pending',
      progress: insertJob.progress ?? 0,
      result: null,
      error: null,
      confidence: null,
      preserveFormatting: insertJob.preserveFormatting ?? false,
      includeConfidence: insertJob.includeConfidence ?? false,
      createdAt: new Date(),
      completedAt: null,
    };
    this.extractionJobs.set(id, job);
    return job;
  }

  async updateExtractionJob(id: string, updates: Partial<ExtractionJob>): Promise<ExtractionJob | undefined> {
    const job = this.extractionJobs.get(id);
    if (!job) return undefined;

    const updatedJob: ExtractionJob = { ...job, ...updates };
    this.extractionJobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteExtractionJob(id: string): Promise<void> {
    this.extractionJobs.delete(id);
  }

  async deleteExtractionJobsByDocument(documentId: string): Promise<void> {
    const jobsToDelete = Array.from(this.extractionJobs.values()).filter(job => job.documentId === documentId);
    for (const job of jobsToDelete) {
      this.extractionJobs.delete(job.id);
    }
  }

  // Schema template methods
  async getSchemaTemplate(id: string): Promise<SchemaTemplate | undefined> {
    return this.schemaTemplates.get(id);
  }

  async getSchemaTemplatesByUser(userId: string): Promise<SchemaTemplate[]> {
    return Array.from(this.schemaTemplates.values()).filter(template => template.userId === userId);
  }

  async createSchemaTemplate(insertTemplate: InsertSchemaTemplate): Promise<SchemaTemplate> {
    const id = randomUUID();
    const template: SchemaTemplate = {
      ...insertTemplate,
      id,
      description: insertTemplate.description ?? null,
      userId: insertTemplate.userId ?? null,
      createdAt: new Date(),
    };
    this.schemaTemplates.set(id, template);
    return template;
  }
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Document methods
  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByUser(userId: string | null): Promise<Document[]> {
    if (userId === null) {
      return await db.select().from(documents).where(isNull(documents.userId));
    }
    return await db.select().from(documents).where(eq(documents.userId, userId));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async updateDocumentPath(id: string, filePath: string): Promise<void> {
    await db.update(documents)
      .set({ filePath })
      .where(eq(documents.id, id));
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Extraction job methods
  async getExtractionJob(id: string): Promise<ExtractionJob | undefined> {
    const [job] = await db.select().from(extractionJobs).where(eq(extractionJobs.id, id));
    return job || undefined;
  }

  async getExtractionJobsByDocument(documentId: string): Promise<ExtractionJob[]> {
    return await db.select().from(extractionJobs).where(eq(extractionJobs.documentId, documentId));
  }

  async getExtractionJobsByUser(userId: string | null): Promise<ExtractionJob[]> {
    const userDocuments = await this.getDocumentsByUser(userId);
    const documentIds = userDocuments.map(doc => doc.id);
    
    if (documentIds.length === 0) return [];
    
    return await db.select().from(extractionJobs).where(
      inArray(extractionJobs.documentId, documentIds)
    );
  }

  async createExtractionJob(insertJob: InsertExtractionJob): Promise<ExtractionJob> {
    const [job] = await db
      .insert(extractionJobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async updateExtractionJob(id: string, updates: Partial<ExtractionJob>): Promise<ExtractionJob | undefined> {
    const [job] = await db
      .update(extractionJobs)
      .set(updates)
      .where(eq(extractionJobs.id, id))
      .returning();
    return job || undefined;
  }

  async deleteExtractionJob(id: string): Promise<void> {
    await db.delete(extractionJobs).where(eq(extractionJobs.id, id));
  }

  async deleteExtractionJobsByDocument(documentId: string): Promise<void> {
    await db.delete(extractionJobs).where(eq(extractionJobs.documentId, documentId));
  }

  // Schema template methods
  async getSchemaTemplate(id: string): Promise<SchemaTemplate | undefined> {
    const [template] = await db.select().from(schemaTemplates).where(eq(schemaTemplates.id, id));
    return template || undefined;
  }

  async getSchemaTemplatesByUser(userId: string): Promise<SchemaTemplate[]> {
    return await db.select().from(schemaTemplates).where(eq(schemaTemplates.userId, userId));
  }

  async createSchemaTemplate(insertTemplate: InsertSchemaTemplate): Promise<SchemaTemplate> {
    const [template] = await db
      .insert(schemaTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }
}

export const storage = new DatabaseStorage();
