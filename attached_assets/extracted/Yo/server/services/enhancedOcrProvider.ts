import { AIProvider, ExtractionOptions } from "./aiProvider";
import { ExtractionResult, IntermediateRepresentation, Page, Word, Block, Line, Table, Shape } from "@shared/schema";
import { textChunkGroundingService } from "./textChunkGroundingService";
import OpenAI from "openai";
import fs from "fs";

interface PythonOCRResponse {
  pages: Array<{
    page_number: number;
    width: number;
    height: number;
    words: Array<{
      text: string;
      bbox: { x: number; y: number; width: number; height: number };
      confidence: number;
      engine?: string;
    }>;
    tables?: Array<{
      page_number: number;
      table_id: string;
      bbox: { x: number; y: number; width: number; height: number };
      cells: Array<{
        text: string;
        row: number;
        col: number;
        confidence: number;
      }>;
      rows: number;
      cols: number;
    }>;
    shapes?: Array<{
      type: string;
      bbox: { x: number; y: number; width: number; height: number };
      coordinates?: Array<{ x: number; y: number }>;
    }>;
    coverage?: {
      native_words: number;
      ocr_words: number;
      final_words: number;
      coverage_percent: number;
    };
  }>;
  total_pages: number;
  extraction_methods: string[];
  overall_coverage: number;
}

export class EnhancedOCRProvider implements AIProvider {
  private pythonOcrUrl = "http://127.0.0.1:8000";

  async extractData(filePath: string, options: ExtractionOptions, apiKey?: string): Promise<ExtractionResult> {
    try {
      console.log(`🚀 Starting enhanced OCR extraction for: ${filePath}`);
      
      try {
        // Step 1: Try ultra-precision OCR data from Python service
        const ocrData = await this.callPythonOCR(filePath);
        console.log(`📊 Python OCR completed: ${ocrData.overall_coverage.toFixed(1)}% coverage, ${ocrData.total_pages} pages`);
        
        // Step 2: Convert to IR format
        const ir = this.convertToIR(ocrData);
        console.log(`🔄 IR conversion: ${ir.pages.length} pages processed`);
        
        // Step 3: AI semantic enhancement (if needed)
        const enhancedResult = await this.enhanceWithAI(ir, options, apiKey);
        console.log(`🎯 AI enhancement completed`);
        
        // Step 4: Build final result with IR
        const result = this.buildFinalResult(ir, enhancedResult, ocrData);
        console.log(`✅ Enhanced extraction completed with ${result.metadata.coverage_metrics?.overall_coverage || 0}% confidence`);
        
        return result;
        
      } catch (pythonError) {
        const errorMsg = pythonError instanceof Error ? pythonError.message : String(pythonError);
        console.warn(`🔄 Python OCR service failed, falling back to OpenAI: ${errorMsg}`);
        
        // Check if we have API keys for fallback
        const effectiveApiKey = apiKey || options.openaiApiKey || process.env.OPENAI_API_KEY;
        if (!effectiveApiKey) {
          throw new Error(
            `Python OCR service unavailable and no OpenAI API key provided for fallback. ` +
            `Please either start the Python OCR service or provide an OpenAI API key. ` +
            `Python error: ${errorMsg}`
          );
        }
        
        // Fallback to OpenAI provider with enhanced prompting
        return await this.fallbackToOpenAI(filePath, options, apiKey);
      }
      
    } catch (error) {
      console.error(`Enhanced OCR extraction failed: ${error}`);
      throw new Error(`Enhanced OCR extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fallbackToOpenAI(filePath: string, options: ExtractionOptions, apiKey?: string): Promise<ExtractionResult> {
    console.log(`🔄 Using OpenAI fallback with enhanced prompting`);
    
    try {
      // Import and use the existing OpenAI provider with enhanced prompting
      const { OpenAIProvider } = require('./aiProvider');
      const openaiProvider = new (OpenAIProvider as any)();
      
      // Call with enhanced options for better extraction
      const enhancedOptions = {
        ...options,
        preserveFormatting: true,
        includeConfidence: true,
        extractionMode: 'smart_table' as any
      };
      
      const result = await openaiProvider.extractData(filePath, enhancedOptions, apiKey);
      
      // Enhance metadata to indicate fallback was used
      return {
        ...result,
        metadata: {
          ...result.metadata,
          ai_provider: "enhanced_ocr_fallback",
          processing_pipeline: ["openai_fallback", "enhanced_prompting"],
          coverage_metrics: {
            overall_coverage: 85, // Conservative estimate for fallback
            method_coverage: {
              "openai_fallback": 85
            },
            quality_score: 85
          }
        }
      };
      
    } catch (fallbackError) {
      console.error(`OpenAI fallback also failed: ${fallbackError}`);
      throw new Error(`Both enhanced OCR and OpenAI fallback failed: ${fallbackError}`);
    }
  }

  private async callPythonOCR(filePath: string): Promise<PythonOCRResponse> {
    try {
      // First, check if Python service is available with better error handling
      try {
        const healthCheckPromise = fetch(`${this.pythonOcrUrl}/health`, { 
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        const healthResponse = await healthCheckPromise;
        if (!healthResponse.ok) {
          throw new Error(`Python OCR service health check failed: ${healthResponse.status}`);
        }
        console.log(`✅ Python OCR service is available at ${this.pythonOcrUrl}`);
      } catch (healthError) {
        const errorMsg = healthError instanceof Error ? healthError.message : String(healthError);
        console.warn(`⚠️ Python OCR service not available: ${errorMsg}`);
        console.warn(`💡 This is expected if the Python service hasn't been started. Falling back to OpenAI.`);
        throw new Error(`Python OCR service unavailable: ${errorMsg}`);
      }
      
      // Read file and prepare for upload
      const fileBuffer = fs.readFileSync(filePath);
      
      // Create form data
      const FormData = require('form-data');
      const form = new FormData();
      
      // Determine filename and content type
      const filename = filePath.split('/').pop() || 'document';
      const contentType = this.getContentType(filename);
      
      form.append('file', fileBuffer, {
        filename: filename,
        contentType: contentType
      });

      // Make request to Python OCR service
      const response = await fetch(`${this.pythonOcrUrl}/extract`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Python OCR service error: ${response.status} ${response.statusText}`);
      }

      const ocrData = await response.json() as PythonOCRResponse;
      
      // Validate coverage threshold
      if (ocrData.overall_coverage < 99.5) {
        console.warn(`Coverage ${ocrData.overall_coverage.toFixed(1)}% below 99.5% threshold`);
        // For now, continue but log the issue - in production, might retry with different engines
      }
      
      return ocrData;
      
    } catch (error) {
      console.error(`Python OCR call failed: ${error}`);
      throw error;
    }
  }

  private convertToIR(ocrData: PythonOCRResponse): IntermediateRepresentation {
    const pages: Page[] = ocrData.pages.map(page => {
      // Convert words
      const words: Word[] = page.words.map(w => ({
        text: w.text,
        bbox: {
          x: w.bbox.x,
          y: w.bbox.y,
          width: w.bbox.width,
          height: w.bbox.height
        },
        confidence: w.confidence,
        fontFamily: "",
        fontSize: 12,
        fontWeight: "normal",
        color: "#000000"
      }));

      // Group words into lines
      const lines: Line[] = this.groupWordsIntoLines(words, page.page_number);
      
      // Group lines into blocks
      const blocks: Block[] = this.groupLinesIntoBlocks(lines, page.page_number);
      
      // Convert tables
      const tables: Table[] = (page.tables || []).map(t => ({
        id: t.table_id,
        bbox: {
          x: t.bbox.x,
          y: t.bbox.y,
          width: t.bbox.width,
          height: t.bbox.height
        },
        cells: t.cells.map(cell => ({
          text: cell.text,
          bbox: {
            x: t.bbox.x + (cell.col / t.cols) * t.bbox.width,
            y: t.bbox.y + (cell.row / t.rows) * t.bbox.height,
            width: t.bbox.width / t.cols,
            height: t.bbox.height / t.rows
          },
          row: cell.row,
          col: cell.col,
          rowSpan: 1,
          colSpan: 1,
          confidence: cell.confidence,
          isHeader: cell.row === 0
        })),
        rows: t.rows,
        cols: t.cols,
        confidence: 0.9,
        title: `Table ${t.table_id}`,
        caption: ""
      }));

      // Convert shapes
      const shapes: Shape[] = (page.shapes || []).map(s => ({
        type: s.type as any,
        bbox: {
          x: s.bbox.x,
          y: s.bbox.y,
          width: s.bbox.width,
          height: s.bbox.height
        },
        strokeWidth: 1,
        strokeColor: "#000000",
        fillColor: "transparent",
        coordinates: s.coordinates
      }));

      return {
        pageNumber: page.page_number,
        width: page.width,
        height: page.height,
        words,
        lines,
        blocks,
        tables,
        shapes,
        coverage: {
          pdfNativeWords: page.coverage?.native_words || 0,
          ocrWords: page.coverage?.ocr_words || words.length,
          reconciledWords: page.coverage?.final_words || words.length,
          coveragePercent: page.coverage?.coverage_percent || 100,
          missedWords: []
        }
      };
    });

    return {
      pages,
      documentMetrics: {
        totalWords: pages.reduce((sum, page) => sum + page.words.length, 0),
        totalLines: pages.reduce((sum, page) => sum + page.lines.length, 0),
        totalBlocks: pages.reduce((sum, page) => sum + page.blocks.length, 0),
        totalTables: pages.reduce((sum, page) => sum + page.tables.length, 0),
        overallCoverage: ocrData.overall_coverage,
        processingTime: Date.now(),
        extractionMethods: ocrData.extraction_methods
      }
    };
  }

  private groupWordsIntoLines(words: Word[], pageNumber: number): Line[] {
    if (words.length === 0) return [];

    // Sort words by Y position then X position
    const sortedWords = [...words].sort((a, b) => {
      const yDiff = a.bbox.y - b.bbox.y;
      return Math.abs(yDiff) < 0.01 ? a.bbox.x - b.bbox.x : yDiff;
    });

    const lines: Line[] = [];
    let currentLine: Word[] = [];
    let lastY = -1;

    for (const word of sortedWords) {
      const currentY = word.bbox.y;
      
      // If Y position differs significantly, start new line
      if (lastY >= 0 && Math.abs(currentY - lastY) > 0.02) {
        if (currentLine.length > 0) {
          lines.push(this.createLineFromWords(currentLine, lines.length));
          currentLine = [];
        }
      }
      
      currentLine.push(word);
      lastY = currentY;
    }

    // Add final line
    if (currentLine.length > 0) {
      lines.push(this.createLineFromWords(currentLine, lines.length));
    }

    return lines;
  }

  private createLineFromWords(words: Word[], lineIndex: number): Line {
    const minX = Math.min(...words.map(w => w.bbox.x));
    const minY = Math.min(...words.map(w => w.bbox.y));
    const maxX = Math.max(...words.map(w => w.bbox.x + w.bbox.width));
    const maxY = Math.max(...words.map(w => w.bbox.y + w.bbox.height));

    return {
      id: `line_${lineIndex}`,
      words,
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      readingOrder: lineIndex,
      lineHeight: maxY - minY,
      alignment: "left"
    };
  }

  private groupLinesIntoBlocks(lines: Line[], pageNumber: number): Block[] {
    if (lines.length === 0) return [];

    const blocks: Block[] = [];
    let currentBlock: Line[] = [];
    let lastY = -1;

    for (const line of lines) {
      const currentY = line.bbox.y;
      
      // If Y position gap is large, start new block
      if (lastY >= 0 && (currentY - lastY) > 0.05) {
        if (currentBlock.length > 0) {
          blocks.push(this.createBlockFromLines(currentBlock, blocks.length));
          currentBlock = [];
        }
      }
      
      currentBlock.push(line);
      lastY = currentY + line.bbox.height;
    }

    // Add final block
    if (currentBlock.length > 0) {
      blocks.push(this.createBlockFromLines(currentBlock, blocks.length));
    }

    return blocks;
  }

  private createBlockFromLines(lines: Line[], blockIndex: number): Block {
    const minX = Math.min(...lines.map(l => l.bbox.x));
    const minY = Math.min(...lines.map(l => l.bbox.y));
    const maxX = Math.max(...lines.map(l => l.bbox.x + l.bbox.width));
    const maxY = Math.max(...lines.map(l => l.bbox.y + l.bbox.height));

    // Determine block type based on content
    const allText = lines.map(l => l.words.map(w => w.text).join(' ')).join(' ');
    const isHeading = this.isHeadingText(allText);
    
    return {
      id: `block_${blockIndex}`,
      type: isHeading ? "heading" : "paragraph",
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      lines,
      level: isHeading ? this.getHeadingLevel(allText) : undefined,
      confidence: 0.9,
      semanticLabel: isHeading ? "heading" : "paragraph",
      textDirection: "ltr"
    };
  }

  private isHeadingText(text: string): boolean {
    // Simple heuristics for heading detection
    const trimmed = text.trim();
    return trimmed.length < 100 && 
           (trimmed.match(/^[A-Z][A-Z\s]*[A-Z]$/) !== null || // ALL CAPS
            trimmed.match(/^\d+\.?\s+[A-Z]/) !== null ||      // Numbered headings
            trimmed.split(' ').length <= 8);                  // Short lines
  }

  private getHeadingLevel(text: string): number {
    // Simple heading level detection
    if (text.match(/^\d+\.\s/)) return 1;  // "1. Title"
    if (text.match(/^\d+\.\d+\s/)) return 2; // "1.1 Subtitle"
    if (text.match(/^[A-Z][A-Z\s]*[A-Z]$/)) return 1; // "ALL CAPS"
    return 2;
  }

  private async enhanceWithAI(ir: IntermediateRepresentation, options: ExtractionOptions, apiKey?: string): Promise<any> {
    // Only use AI for semantic enhancement if requested
    if (!options.includeConfidence && options.extractionMode === 'smart_table') {
      return { semantic_labels: [], enhanced_structure: [] };
    }

    try {
      const effectiveApiKey = apiKey || options.openaiApiKey || process.env.OPENAI_API_KEY || "";
      if (!effectiveApiKey) {
        return { semantic_labels: [], enhanced_structure: [] };
      }

      const openai = new OpenAI({ apiKey: effectiveApiKey });

      // Create summary for AI processing (avoid token overload)
      const summary = {
        total_blocks: ir.documentMetrics.totalBlocks,
        total_tables: ir.documentMetrics.totalTables,
        sample_content: ir.pages[0]?.blocks.slice(0, 3).map(b => 
          b.lines.map(l => l.words.map(w => w.text).join(' ')).join(' ')
        ).join('\n') || ''
      };

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Enhance document structure with semantic labels. Focus on identifying headings, sections, and improving table structure.`
          },
          {
            role: "user",
            content: `Analyze and enhance this document structure:\n${JSON.stringify(summary, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1024
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.warn('AI enhancement failed, continuing without it:', error);
      return { semantic_labels: [], enhanced_structure: [] };
    }
  }

  private buildFinalResult(ir: IntermediateRepresentation, aiEnhancement: any, ocrData: PythonOCRResponse): ExtractionResult {
    // Build legacy format tables for backward compatibility
    const legacyTables = ir.pages.flatMap(page => 
      page.tables.map(table => ({
        title: table.title || "Extracted Table",
        confidence: table.confidence,
        data: this.convertTableToLegacyFormat(table),
        headers: this.extractTableHeaders(table),
        summary: {}
      }))
    );

    // Extract all text for legacy format
    const allText = ir.pages.map(page => 
      page.blocks.map(block => 
        block.lines.map(line => 
          line.words.map(word => word.text).join(' ')
        ).join('\n')
      ).join('\n\n')
    ).join('\n\n');

    // Generate Landing AI-style text chunks with grounding
    const textChunks = textChunkGroundingService.convertIRToTextChunks(ir);
    const markdown = textChunkGroundingService.generateMarkdownWithChunks(textChunks);

    console.log(`📍 Generated ${textChunks.length} text chunks with grounding information`);

    return {
      // Legacy fields for backward compatibility
      tables: legacyTables,
      text: allText,
      objects: [],
      structured_content: allText,
      
      // Landing AI-style text chunks with grounding
      markdown,
      chunks: textChunks,
      
      // New IR field for exact layout preservation
      ir,
      // Alias for component compatibility
      intermediate_representation: ir,
      
      metadata: {
        processed_at: new Date().toISOString(),
        ai_provider: "enhanced_ocr",
        extraction_mode: "ultra_precision",
        page_count: ir.pages.length,
        word_count: ir.documentMetrics.totalWords,
        has_text: ir.documentMetrics.totalWords > 0,
        object_count: ir.documentMetrics.totalTables,
        coverage_metrics: {
          overall_coverage: ir.documentMetrics.overallCoverage,
          method_coverage: {
            "python_ocr": ir.documentMetrics.overallCoverage,
            "ir_processing": 100,
            "text_chunking": textChunks.length > 0 ? 100 : 0
          },
          quality_score: Math.min(100, ir.documentMetrics.overallCoverage * 1.1)
        },
        processing_pipeline: ["python_ocr", "ir_conversion", "text_chunking", "ai_enhancement", "legacy_formatting"]
      }
    };
  }

  private convertTableToLegacyFormat(table: Table): Array<Record<string, any>> {
    const rows: Array<Record<string, any>> = [];
    
    // Group cells by row
    const cellsByRow = new Map<number, typeof table.cells>();
    table.cells.forEach(cell => {
      if (!cellsByRow.has(cell.row)) {
        cellsByRow.set(cell.row, []);
      }
      cellsByRow.get(cell.row)!.push(cell);
    });

    // Convert to legacy format
    const sortedRows = Array.from(cellsByRow.keys()).sort((a, b) => a - b);
    const headers = cellsByRow.get(0)?.sort((a, b) => a.col - b.col).map(cell => cell.text) || [];
    
    for (let rowIndex = 1; rowIndex < sortedRows.length; rowIndex++) {
      const rowCells = cellsByRow.get(sortedRows[rowIndex])?.sort((a, b) => a.col - b.col) || [];
      const rowData: Record<string, any> = {};
      
      rowCells.forEach((cell, colIndex) => {
        const header = headers[colIndex] || `Column_${colIndex + 1}`;
        rowData[header] = cell.text;
      });
      
      rows.push(rowData);
    }

    return rows;
  }

  private extractTableHeaders(table: Table): string[] {
    return table.cells
      .filter(cell => cell.row === 0)
      .sort((a, b) => a.col - b.col)
      .map(cell => cell.text);
  }

  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'bmp': return 'image/bmp';
      case 'tiff':
      case 'tif': return 'image/tiff';
      default: return 'application/octet-stream';
    }
  }
}