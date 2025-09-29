import { IntermediateRepresentation, TextChunk, GroundingBox, Grounding, BoundingBox, Block, Line, Word } from "@shared/schema";
import { nanoid } from "nanoid";

/**
 * Service for converting IR data to Landing AI-style text chunks with grounding information
 * Implements the coordinate-based system that maps extracted text to precise locations
 */
export class TextChunkGroundingService {
  private static instance: TextChunkGroundingService;

  static getInstance(): TextChunkGroundingService {
    if (!TextChunkGroundingService.instance) {
      TextChunkGroundingService.instance = new TextChunkGroundingService();
    }
    return TextChunkGroundingService.instance;
  }

  /**
   * Convert IR data to Landing AI-style text chunks with grounding
   * @param ir Intermediate representation from document extraction
   * @returns Array of text chunks with precise grounding information
   */
  convertIRToTextChunks(ir: IntermediateRepresentation): TextChunk[] {
    const chunks: TextChunk[] = [];

    for (const page of ir.pages) {
      // Process blocks into text chunks
      for (const block of page.blocks) {
        const textChunk = this.createTextChunkFromBlock(block, page.pageNumber);
        if (textChunk) {
          chunks.push(textChunk);
        }
      }

      // Process tables into text chunks
      for (const table of page.tables) {
        const tableChunk = this.createTextChunkFromTable(table, page.pageNumber);
        if (tableChunk) {
          chunks.push(tableChunk);
        }
      }

      // Process semantic regions if available
      if (page.semanticRegions) {
        for (const region of page.semanticRegions) {
          const regionChunk = this.createTextChunkFromSemanticRegion(region, page.pageNumber, page.blocks);
          if (regionChunk) {
            chunks.push(regionChunk);
          }
        }
      }
    }

    return chunks;
  }

  /**
   * Create a text chunk from a block
   */
  private createTextChunkFromBlock(block: Block, pageNumber: number): TextChunk | null {
    const text = this.extractTextFromBlock(block);
    if (!text.trim()) {
      return null;
    }

    const grounding = this.convertBoundingBoxToGrounding(block.bbox, pageNumber);
    
    return {
      chunk_id: block.id || nanoid(),
      text: text.trim(),
      chunk_type: this.mapBlockTypeToChunkType(block.type),
      grounding: [grounding],
      confidence: block.confidence,
      semantic_role: block.semanticRole,
    };
  }

  /**
   * Create a text chunk from a table
   */
  private createTextChunkFromTable(table: any, pageNumber: number): TextChunk | null {
    if (!table.cells || table.cells.length === 0) {
      return null;
    }

    // Create a readable text representation of the table
    const tableText = this.convertTableToText(table);
    const grounding = this.convertBoundingBoxToGrounding(table.bbox, pageNumber);

    return {
      chunk_id: table.id || nanoid(),
      text: tableText,
      chunk_type: 'table',
      grounding: [grounding],
      confidence: table.confidence,
    };
  }

  /**
   * Create a text chunk from a semantic region
   */
  private createTextChunkFromSemanticRegion(region: any, pageNumber: number, blocks: Block[]): TextChunk | null {
    // Find blocks that belong to this semantic region
    const regionBlocks = blocks.filter(block => 
      region.blockIds && region.blockIds.includes(block.id)
    );

    if (regionBlocks.length === 0) {
      return null;
    }

    const text = regionBlocks.map(block => this.extractTextFromBlock(block)).join('\n');
    if (!text.trim()) {
      return null;
    }

    const grounding = this.convertBoundingBoxToGrounding(region.bbox, pageNumber);

    return {
      chunk_id: region.id || nanoid(),
      text: text.trim(),
      chunk_type: this.mapSemanticTypeToChunkType(region.type),
      grounding: [grounding],
      confidence: region.confidence,
      semantic_role: region.type,
    };
  }

  /**
   * Extract text content from a block
   */
  private extractTextFromBlock(block: Block): string {
    if (!block.lines || block.lines.length === 0) {
      return '';
    }

    return block.lines
      .map((line: Line) => 
        line.words.map((word: Word) => word.text).join(' ')
      )
      .join('\n');
  }

  /**
   * Convert table data to readable text format
   */
  private convertTableToText(table: any): string {
    if (!table.cells || table.cells.length === 0) {
      return table.title || 'Table';
    }

    // Group cells by row
    const rows: { [key: number]: any[] } = {};
    for (const cell of table.cells) {
      if (!rows[cell.row]) {
        rows[cell.row] = [];
      }
      rows[cell.row][cell.col] = cell.text;
    }

    // Convert to text format
    const textRows = Object.keys(rows)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(rowKey => {
        const row = rows[parseInt(rowKey)];
        return row.join(' | ');
      });

    return textRows.join('\n');
  }

  /**
   * Convert IR bounding box to Landing AI-style grounding box
   * IR uses (x, y, width, height) while Landing AI uses (l, t, r, b)
   */
  private convertBoundingBoxToGrounding(bbox: BoundingBox, pageNumber: number): Grounding {
    const groundingBox: GroundingBox = {
      l: bbox.x,                    // Left edge
      t: bbox.y,                    // Top edge  
      r: bbox.x + bbox.width,       // Right edge
      b: bbox.y + bbox.height,      // Bottom edge
    };

    return {
      page: pageNumber - 1, // Convert to 0-based indexing
      box: groundingBox,
    };
  }

  /**
   * Map IR block types to Landing AI chunk types
   */
  private mapBlockTypeToChunkType(blockType: string): TextChunk['chunk_type'] {
    const mapping: { [key: string]: TextChunk['chunk_type'] } = {
      'paragraph': 'text',
      'heading': 'title',
      'list': 'list',
      'table': 'table',
      'image': 'figure',
      'line': 'text',
      'footer': 'footer',
      'header': 'header',
      'form_field': 'form_field',
      'signature': 'figure',
      'logo': 'figure',
      'caption': 'caption',
    };

    return mapping[blockType] || 'text';
  }

  /**
   * Map semantic region types to chunk types
   */
  private mapSemanticTypeToChunkType(semanticType: string): TextChunk['chunk_type'] {
    const mapping: { [key: string]: TextChunk['chunk_type'] } = {
      'header': 'header',
      'footer': 'footer',
      'main_content': 'text',
      'sidebar': 'text',
      'navigation': 'text',
      'form': 'form_field',
      'table': 'table',
      'figure': 'figure',
    };

    return mapping[semanticType] || 'text';
  }

  /**
   * Transform coordinates from one coordinate system to another
   * Utility function for frontend coordinate transformation
   */
  transformCoordinates(bbox: GroundingBox, imgWidth: number, imgHeight: number): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } {
    return {
      x1: Math.round(bbox.l * imgWidth),
      y1: Math.round(bbox.t * imgHeight),
      x2: Math.round(bbox.r * imgWidth),
      y2: Math.round(bbox.b * imgHeight),
    };
  }

  /**
   * Generate markdown representation with chunk references
   * Similar to Landing AI's markdown output
   */
  generateMarkdownWithChunks(chunks: TextChunk[]): string {
    const markdownSections: string[] = [];

    // Group chunks by type for better organization
    const chunksByType = chunks.reduce((acc, chunk) => {
      const type = chunk.chunk_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(chunk);
      return acc;
    }, {} as Record<string, TextChunk[]>);

    // Generate markdown sections
    Object.entries(chunksByType).forEach(([type, typeChunks]) => {
      if (typeChunks.length === 0) return;

      switch (type) {
        case 'title':
          typeChunks.forEach(chunk => {
            markdownSections.push(`# ${chunk.text}`);
          });
          break;
        
        case 'header':
          typeChunks.forEach(chunk => {
            markdownSections.push(`## ${chunk.text}`);
          });
          break;

        case 'text':
          typeChunks.forEach(chunk => {
            markdownSections.push(chunk.text);
          });
          break;

        case 'table':
          typeChunks.forEach(chunk => {
            markdownSections.push('### Table');
            markdownSections.push('```');
            markdownSections.push(chunk.text);
            markdownSections.push('```');
          });
          break;

        case 'list':
          typeChunks.forEach(chunk => {
            const listItems = chunk.text.split('\n').map(item => `- ${item}`);
            markdownSections.push(listItems.join('\n'));
          });
          break;
      }
    });

    return markdownSections.join('\n\n');
  }
}

export const textChunkGroundingService = TextChunkGroundingService.getInstance();