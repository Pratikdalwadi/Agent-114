import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  Page, 
  Block, 
  IntermediateRepresentation, 
  ExtractionResult,
  KeyValuePair,
  Table
} from "@shared/schema";
import { layoutEngine } from "./layoutEngine";

/**
 * Enhanced VLM Semantic Engine for document understanding
 * Implements Vision-Language Model processing with semantic lift capabilities
 */
export class VLMSemanticEngine {
  private static instance: VLMSemanticEngine;

  static getInstance(): VLMSemanticEngine {
    if (!VLMSemanticEngine.instance) {
      VLMSemanticEngine.instance = new VLMSemanticEngine();
    }
    return VLMSemanticEngine.instance;
  }

  /**
   * Perform VLM-aware semantic lift on document pages
   * @param pages Basic IR pages from text extraction
   * @param provider AI provider ('openai' | 'gemini')
   * @param apiKey API key for the provider
   * @returns Enhanced pages with semantic understanding
   */
  async performSemanticLift(
    pages: Page[], 
    provider: 'openai' | 'gemini', 
    apiKey: string
  ): Promise<IntermediateRepresentation> {
    console.log(`🧠 Starting VLM semantic lift with ${provider} for ${pages.length} pages`);

    const enhancedPages: Page[] = [];
    let processingTime = Date.now();

    for (const page of pages) {
      console.log(`🔍 Processing page ${page.pageNumber} with VLM semantic analysis`);
      
      // Step 1: Apply layout engine for spatial understanding
      const layoutEnhancedPage = await layoutEngine.processPageLayout(page);
      
      // Step 2: Apply VLM semantic analysis
      const semanticEnhancedPage = await this.applyVLMSemanticAnalysis(
        layoutEnhancedPage, 
        provider, 
        apiKey
      );
      
      // Step 3: Enhance with document understanding
      const documentUnderstandingPage = await this.enhanceWithDocumentUnderstanding(
        semanticEnhancedPage,
        provider,
        apiKey
      );
      
      enhancedPages.push(documentUnderstandingPage);
    }

    processingTime = Date.now() - processingTime;

    // Generate comprehensive document metrics
    const documentMetrics = this.generateDocumentMetrics(enhancedPages, processingTime);

    return {
      pages: enhancedPages,
      documentMetrics,
    };
  }

  /**
   * Apply VLM semantic analysis to enhance page understanding
   */
  private async applyVLMSemanticAnalysis(
    page: Page, 
    provider: 'openai' | 'gemini', 
    apiKey: string
  ): Promise<Page> {
    try {
      // Build semantic analysis prompt for VLM
      const semanticPrompt = this.buildSemanticAnalysisPrompt(page);
      
      // Call VLM for semantic understanding
      const semanticAnalysis = await this.callVLMForSemanticAnalysis(
        semanticPrompt, 
        page, 
        provider, 
        apiKey
      );

      // Apply semantic enhancements to blocks
      const enhancedBlocks = this.enhanceBlocksWithSemantics(page.blocks, semanticAnalysis);
      
      // Extract enhanced key-value pairs
      const enhancedKeyValuePairs = this.enhanceKeyValuePairs(
        page.keyValuePairs || [], 
        semanticAnalysis
      );

      // Enhance tables with semantic understanding
      const enhancedTables = this.enhanceTablesWithSemantics(
        page.tables, 
        semanticAnalysis
      );

      return {
        ...page,
        blocks: enhancedBlocks,
        keyValuePairs: enhancedKeyValuePairs,
        tables: enhancedTables,
      };
    } catch (error) {
      console.warn(`🔄 VLM semantic analysis failed for page ${page.pageNumber}, using layout-only analysis:`, error);
      return page; // Return page with layout engine enhancements only
    }
  }

  /**
   * Build semantic analysis prompt for VLM
   */
  private buildSemanticAnalysisPrompt(page: Page): string {
    return `🧠 ADVANCED DOCUMENT SEMANTIC ANALYZER

MISSION: Perform deep semantic analysis of document structure with precise understanding of:
- Textual content and meaning
- Visual features and hierarchy  
- Spatial relationships and layout patterns

DOCUMENT CONTEXT:
- Page ${page.pageNumber}
- ${page.blocks.length} blocks detected
- ${page.lines.length} lines analyzed
- ${page.words.length} words processed
- Layout type: ${page.documentStructure?.layoutType || 'unknown'}

SEMANTIC ANALYSIS REQUIREMENTS:

1. BLOCK SEMANTIC ROLES:
   - Identify precise semantic roles for each block
   - Detect headings, titles, addresses, amounts, dates, descriptions
   - Classify content by business meaning (invoice_header, item_list, total_section)

2. VISUAL HIERARCHY ANALYSIS:
   - Determine visual importance levels (1=highest, 5=lowest)
   - Analyze font sizes, weights, positioning for hierarchy
   - Identify document flow and reading order

3. KEY-VALUE RELATIONSHIP DETECTION:
   - Find label-value pairs with spatial relationships
   - Detect form fields and their associations
   - Identify semantic types (invoice_number, total_amount, customer_name)

4. TABLE SEMANTIC ENHANCEMENT:
   - Identify table headers and their semantic meaning
   - Classify table content types (items, pricing, contact_info)
   - Detect table relationships and hierarchies

5. DOCUMENT STRUCTURE UNDERSTANDING:
   - Identify document type and purpose
   - Detect logical sections and their relationships
   - Understand business context and workflow

Return JSON with semantic enhancements for each element.`;
  }

  /**
   * Call VLM for semantic analysis
   */
  private async callVLMForSemanticAnalysis(
    prompt: string, 
    page: Page, 
    provider: 'openai' | 'gemini', 
    apiKey: string
  ): Promise<any> {
    const pageData = this.buildCompactPageData(page);
    
    if (provider === 'openai') {
      return await this.callOpenAIForSemantics(prompt, pageData, apiKey);
    } else {
      return await this.callGeminiForSemantics(prompt, pageData, apiKey);
    }
  }

  /**
   * Call OpenAI for semantic analysis
   */
  private async callOpenAIForSemantics(
    prompt: string, 
    pageData: string, 
    apiKey: string
  ): Promise<any> {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: `Analyze this page data and provide semantic enhancements:\n\n${pageData}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.1, // Low temperature for consistent analysis
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  /**
   * Call Gemini for semantic analysis
   */
  private async callGeminiForSemantics(
    prompt: string, 
    pageData: string, 
    apiKey: string
  ): Promise<any> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent([
      prompt,
      `\n\nAnalyze this page data and provide semantic enhancements:\n\n${pageData}`
    ]);

    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      // If JSON parsing fails, return empty analysis
      return {};
    }
  }

  /**
   * Build compact page data for VLM analysis
   */
  private buildCompactPageData(page: Page): string {
    const blockSummaries = page.blocks.map(block => ({
      id: block.id,
      type: block.type,
      bbox: block.bbox,
      text: block.lines.map(line => 
        line.words.map(word => word.text).join(' ')
      ).join('\n'),
      readingOrder: block.readingOrder,
      confidence: block.confidence,
    }));

    const keyValueSummaries = (page.keyValuePairs || []).map(kv => ({
      key: kv.key.text,
      value: kv.value.text,
      relationship: kv.relationship,
    }));

    const tableSummaries = page.tables.map(table => ({
      id: table.id,
      rows: table.rows,
      cols: table.cols,
      title: table.title,
      sampleCells: table.cells.slice(0, 10).map(cell => ({
        text: cell.text,
        row: cell.row,
        col: cell.col,
        isHeader: cell.isHeader,
      })),
    }));

    return JSON.stringify({
      pageInfo: {
        pageNumber: page.pageNumber,
        layoutType: page.documentStructure?.layoutType,
        semanticRegions: page.semanticRegions?.map(r => r.type),
      },
      blocks: blockSummaries,
      keyValuePairs: keyValueSummaries,
      tables: tableSummaries,
      documentStructure: page.documentStructure,
    }, null, 2);
  }

  /**
   * Enhance blocks with semantic understanding
   */
  private enhanceBlocksWithSemantics(blocks: Block[], semanticAnalysis: any): Block[] {
    return blocks.map(block => {
      const blockEnhancement = semanticAnalysis.blocks?.find((b: any) => b.id === block.id);
      
      if (blockEnhancement) {
        return {
          ...block,
          semanticRole: blockEnhancement.semanticRole || block.semanticRole,
          visualHierarchy: blockEnhancement.visualHierarchy || block.visualHierarchy,
          confidence: Math.max(block.confidence, blockEnhancement.confidence || 0),
          semanticLabel: blockEnhancement.semanticLabel || block.semanticLabel,
        };
      }
      
      return block;
    });
  }

  /**
   * Enhance key-value pairs with semantic understanding
   */
  private enhanceKeyValuePairs(
    keyValuePairs: KeyValuePair[], 
    semanticAnalysis: any
  ): KeyValuePair[] {
    const enhancedPairs = [...keyValuePairs];
    
    // Add newly detected key-value pairs from semantic analysis
    if (semanticAnalysis.keyValuePairs) {
      for (const newPair of semanticAnalysis.keyValuePairs) {
        if (newPair.key && newPair.value && newPair.semanticType) {
          enhancedPairs.push({
            key: {
              text: newPair.key,
              bbox: newPair.keyBbox || { x: 0, y: 0, width: 0, height: 0 },
              confidence: newPair.confidence || 0.8,
            },
            value: {
              text: newPair.value,
              bbox: newPair.valueBbox || { x: 0, y: 0, width: 0, height: 0 },
              confidence: newPair.confidence || 0.8,
            },
            relationship: newPair.relationship || 'adjacent',
            semanticType: newPair.semanticType,
          });
        }
      }
    }
    
    return enhancedPairs;
  }

  /**
   * Enhance tables with semantic understanding
   */
  private enhanceTablesWithSemantics(tables: Table[], semanticAnalysis: any): Table[] {
    return tables.map(table => {
      const tableEnhancement = semanticAnalysis.tables?.find((t: any) => t.id === table.id);
      
      if (tableEnhancement) {
        return {
          ...table,
          title: tableEnhancement.title || table.title,
          caption: tableEnhancement.caption || table.caption,
          confidence: Math.max(table.confidence, tableEnhancement.confidence || 0),
          // Enhanced cells with semantic roles
          cells: table.cells.map(cell => {
            const cellEnhancement = tableEnhancement.cells?.find((c: any) => 
              c.row === cell.row && c.col === cell.col
            );
            
            return cellEnhancement ? {
              ...cell,
              isHeader: cellEnhancement.isHeader ?? cell.isHeader,
              confidence: Math.max(cell.confidence, cellEnhancement.confidence || 0),
            } : cell;
          }),
        };
      }
      
      return table;
    });
  }

  /**
   * Enhance with document understanding
   */
  private async enhanceWithDocumentUnderstanding(
    page: Page, 
    provider: 'openai' | 'gemini', 
    apiKey: string
  ): Promise<Page> {
    try {
      // Perform document-level understanding
      const documentUnderstanding = await this.performDocumentUnderstanding(
        page, 
        provider, 
        apiKey
      );

      // Apply document-level enhancements
      return {
        ...page,
        documentStructure: {
          ...page.documentStructure,
          ...documentUnderstanding.documentStructure,
        },
        semanticRegions: this.mergeSemanticRegions(
          page.semanticRegions || [], 
          documentUnderstanding.semanticRegions || []
        ),
      };
    } catch (error) {
      console.warn(`📄 Document understanding failed for page ${page.pageNumber}:`, error);
      return page;
    }
  }

  /**
   * Perform document-level understanding analysis
   */
  private async performDocumentUnderstanding(
    page: Page, 
    provider: 'openai' | 'gemini', 
    apiKey: string
  ): Promise<any> {
    const documentPrompt = `📄 DOCUMENT UNDERSTANDING EXPERT

MISSION: Analyze document structure and provide high-level understanding

DOCUMENT ANALYSIS:
- Identify document type (invoice, report, form, contract, receipt)
- Determine business context and purpose
- Analyze information hierarchy and flow
- Detect critical business entities and relationships

Provide structured analysis with document-level insights.`;

    const documentData = this.buildDocumentContextData(page);
    
    if (provider === 'openai') {
      return await this.callOpenAIForSemantics(documentPrompt, documentData, apiKey);
    } else {
      return await this.callGeminiForSemantics(documentPrompt, documentData, apiKey);
    }
  }

  /**
   * Build document context data for analysis
   */
  private buildDocumentContextData(page: Page): string {
    const allText = page.blocks
      .map(block => block.lines.map(line => 
        line.words.map(word => word.text).join(' ')
      ).join('\n'))
      .join('\n\n');

    const documentContext = {
      pageNumber: page.pageNumber,
      totalBlocks: page.blocks.length,
      hasKeyValuePairs: (page.keyValuePairs?.length || 0) > 0,
      hasTables: page.tables.length > 0,
      layoutType: page.documentStructure?.layoutType,
      textSample: allText.substring(0, 2000), // First 2000 characters
      structuralElements: page.blocks.map(b => b.type),
    };

    return JSON.stringify(documentContext, null, 2);
  }

  /**
   * Merge semantic regions from different analysis stages
   */
  private mergeSemanticRegions(existing: any[], additional: any[]): any[] {
    const merged = [...existing];
    
    for (const newRegion of additional) {
      const existingRegion = merged.find(r => r.type === newRegion.type);
      if (!existingRegion) {
        merged.push(newRegion);
      } else {
        // Merge with higher confidence
        if (newRegion.confidence > existingRegion.confidence) {
          Object.assign(existingRegion, newRegion);
        }
      }
    }
    
    return merged;
  }

  /**
   * Generate comprehensive document metrics
   */
  private generateDocumentMetrics(pages: Page[], processingTime: number): IntermediateRepresentation['documentMetrics'] {
    const totalWords = pages.reduce((sum, page) => sum + page.words.length, 0);
    const totalLines = pages.reduce((sum, page) => sum + page.lines.length, 0);
    const totalBlocks = pages.reduce((sum, page) => sum + page.blocks.length, 0);
    const totalTables = pages.reduce((sum, page) => sum + page.tables.length, 0);
    
    const coverageScores = pages.map(page => page.coverage.coveragePercent);
    const overallCoverage = coverageScores.reduce((sum, score) => sum + score, 0) / pages.length;

    return {
      totalWords,
      totalLines,
      totalBlocks,
      totalTables,
      overallCoverage,
      processingTime,
      extractionMethods: ['pdf_native', 'ocr_tesseract', 'vlm_semantic_lift', 'layout_engine'],
    };
  }
}

export const vlmSemanticEngine = VLMSemanticEngine.getInstance();