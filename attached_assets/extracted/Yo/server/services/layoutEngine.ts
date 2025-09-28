import { 
  Page, 
  Block, 
  Word, 
  Line, 
  BoundingBox, 
  SpatialRelationship, 
  KeyValuePair,
  Table,
  TableCell 
} from "@shared/schema";

/**
 * Enhanced Layout Engine for Vision-Language Model aware document processing
 * Implements advanced spatial relationship analysis and semantic understanding
 */
export class LayoutEngine {
  private static instance: LayoutEngine;

  static getInstance(): LayoutEngine {
    if (!LayoutEngine.instance) {
      LayoutEngine.instance = new LayoutEngine();
    }
    return LayoutEngine.instance;
  }

  /**
   * Process a page with enhanced layout analysis
   * @param page Page data with words and basic structure
   * @returns Enhanced page with VLM-aware features
   */
  async processPageLayout(page: Page): Promise<Page> {
    console.log(`🔍 Processing layout for page ${page.pageNumber}`);

    // Step 1: Normalize coordinates to [0,1] range
    const normalizedPage = this.normalizeCoordinates(page);

    // Step 2: Enhanced line detection with better clustering
    const enhancedLines = this.enhancedLineDetection(normalizedPage.words);

    // Step 3: Advanced block segmentation
    const enhancedBlocks = await this.advancedBlockSegmentation(enhancedLines, normalizedPage.words);

    // Step 4: Spatial relationship analysis
    const spatialGraph = this.buildSpatialRelationshipGraph(enhancedBlocks);

    // Step 5: Document structure analysis
    const documentStructure = this.analyzeDocumentStructure(enhancedBlocks, enhancedLines);

    // Step 6: Semantic region detection
    const semanticRegions = this.detectSemanticRegions(enhancedBlocks);

    // Step 7: Key-value pair extraction
    const keyValuePairs = this.extractKeyValuePairs(normalizedPage.words, enhancedBlocks);

    // Step 8: Enhanced table detection and structure analysis
    const enhancedTables = await this.enhancedTableDetection(normalizedPage.words, enhancedBlocks);

    return {
      ...normalizedPage,
      lines: enhancedLines,
      blocks: enhancedBlocks,
      tables: enhancedTables,
      keyValuePairs,
      documentStructure,
      spatialGraph,
      semanticRegions,
    };
  }

  /**
   * Normalize coordinates to [0,1] range with top-left origin
   */
  private normalizeCoordinates(page: Page): Page {
    const normalizeBox = (bbox: any): BoundingBox => ({
      x: Math.max(0, Math.min(1, bbox.x / page.width || bbox.x0 || 0)),
      y: Math.max(0, Math.min(1, bbox.y / page.height || bbox.y0 || 0)),
      width: Math.max(0, Math.min(1, (bbox.width / page.width) || ((bbox.x1 - bbox.x0) / page.width) || 0)),
      height: Math.max(0, Math.min(1, (bbox.height / page.height) || ((bbox.y1 - bbox.y0) / page.height) || 0)),
    });

    return {
      ...page,
      words: page.words.map(word => ({
        ...word,
        bbox: normalizeBox(word.bbox),
      })),
      lines: page.lines.map(line => ({
        ...line,
        bbox: normalizeBox(line.bbox),
        words: line.words.map(word => ({
          ...word,
          bbox: normalizeBox(word.bbox),
        })),
      })),
      blocks: page.blocks.map(block => ({
        ...block,
        bbox: normalizeBox(block.bbox),
      })),
    };
  }

  /**
   * Enhanced line detection using advanced clustering algorithms
   */
  private enhancedLineDetection(words: Word[]): Line[] {
    if (!words.length) return [];

    // Sort words by Y coordinate, then by X coordinate
    const sortedWords = [...words].sort((a, b) => {
      const yDiff = a.bbox.y - b.bbox.y;
      return Math.abs(yDiff) < 0.01 ? a.bbox.x - b.bbox.x : yDiff;
    });

    const lines: Line[] = [];
    let currentLine: Word[] = [];
    let lastY = -1;
    const lineThreshold = 0.015; // 1.5% of page height

    for (const word of sortedWords) {
      const wordY = word.bbox.y + word.bbox.height / 2; // Use center Y
      
      if (lastY < 0 || Math.abs(wordY - lastY) < lineThreshold) {
        currentLine.push(word);
      } else {
        if (currentLine.length > 0) {
          lines.push(this.createLineFromWords(currentLine, lines.length));
        }
        currentLine = [word];
      }
      lastY = wordY;
    }

    if (currentLine.length > 0) {
      lines.push(this.createLineFromWords(currentLine, lines.length));
    }

    return lines;
  }

  /**
   * Create a line object from a group of words
   */
  private createLineFromWords(words: Word[], lineIndex: number): Line {
    const sortedWords = words.sort((a, b) => a.bbox.x - b.bbox.x);
    const bbox = this.computeBoundingBox(sortedWords.map(w => w.bbox));
    
    return {
      id: `line_${lineIndex}`,
      words: sortedWords,
      bbox,
      readingOrder: lineIndex,
      lineHeight: bbox.height,
      alignment: this.detectAlignment(sortedWords),
    };
  }

  /**
   * Advanced block segmentation with semantic understanding
   */
  private async advancedBlockSegmentation(lines: Line[], words: Word[]): Promise<Block[]> {
    const blocks: Block[] = [];
    let processedLines = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      if (processedLines.has(lines[i].id)) continue;

      const blockLines: Line[] = [lines[i]];
      processedLines.add(lines[i].id);

      // Group adjacent lines into blocks based on spacing and alignment
      for (let j = i + 1; j < lines.length; j++) {
        if (processedLines.has(lines[j].id)) continue;

        if (this.shouldGroupLines(lines[i], lines[j], blockLines)) {
          blockLines.push(lines[j]);
          processedLines.add(lines[j].id);
        }
      }

      const block = this.createBlockFromLines(blockLines, blocks.length);
      blocks.push(block);
    }

    // Enhance blocks with semantic analysis
    return this.enhanceBlocksWithSemantics(blocks, words);
  }

  /**
   * Determine if two lines should be grouped into the same block
   */
  private shouldGroupLines(baseLine: Line, candidateLine: Line, existingLines: Line[]): boolean {
    const verticalSpacing = candidateLine.bbox.y - (baseLine.bbox.y + baseLine.bbox.height);
    const avgLineHeight = existingLines.reduce((sum, line) => sum + line.bbox.height, 0) / existingLines.length;
    
    // Group if spacing is less than 1.5x average line height
    if (verticalSpacing > avgLineHeight * 1.5) return false;

    // Check alignment similarity
    const alignmentMatch = baseLine.alignment === candidateLine.alignment;
    
    // Check horizontal overlap
    const overlap = this.calculateHorizontalOverlap(baseLine.bbox, candidateLine.bbox);
    
    return alignmentMatch && overlap > 0.3; // 30% overlap threshold
  }

  /**
   * Create a block from a group of lines
   */
  private createBlockFromLines(lines: Line[], blockIndex: number): Block {
    const bbox = this.computeBoundingBox(lines.map(l => l.bbox));
    const blockType = this.inferBlockType(lines);
    
    return {
      id: `block_${blockIndex}`,
      type: blockType,
      bbox,
      lines,
      confidence: 0.85, // Base confidence
      readingOrder: blockIndex,
      visualHierarchy: this.calculateVisualHierarchy(lines),
      semanticRole: this.inferSemanticRole(lines, blockType),
      textDirection: 'ltr',
      alignment: lines[0]?.alignment || 'left',
      styleProperties: this.extractStyleProperties(lines),
    };
  }

  /**
   * Infer block type from line characteristics
   */
  private inferBlockType(lines: Line[]): Block['type'] {
    if (lines.length === 0) return 'line';
    if (lines.length === 1) return 'line';

    const totalText = lines.map(l => l.words.map(w => w.text).join(' ')).join(' ');
    
    // Check for heading patterns
    if (lines.length <= 2 && this.isLikelyHeading(lines[0])) return 'heading';
    
    // Check for list patterns
    if (this.isLikelyList(lines)) return 'list';
    
    // Default to paragraph
    return 'paragraph';
  }

  /**
   * Build spatial relationship graph between elements
   */
  private buildSpatialRelationshipGraph(blocks: Block[]): Page['spatialGraph'] {
    const relationships: SpatialRelationship[] = [];
    const containers: any[] = [];

    // Analyze relationships between all block pairs
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const relation = this.analyzeBlockRelationship(blocks[i], blocks[j]);
        if (relation) {
          relationships.push(relation);
        }
      }
    }

    // Detect container relationships
    for (const block of blocks) {
      const contained = blocks.filter(other => 
        other.id !== block.id && this.isContained(other.bbox, block.bbox)
      );
      
      if (contained.length > 0) {
        containers.push({
          containerId: block.id,
          containedIds: contained.map(b => b.id),
          containerType: this.inferContainerType(block, contained),
        });
      }
    }

    return { relationships, containers };
  }

  /**
   * Analyze document structure and reading flow
   */
  private analyzeDocumentStructure(blocks: Block[], lines: Line[]): Page['documentStructure'] {
    const layoutType = this.detectLayoutType(blocks);
    const readingFlow = this.computeReadingFlow(blocks);
    const visualHierarchy = this.computeVisualHierarchy(blocks);

    return {
      layoutType,
      readingFlow,
      visualHierarchy,
    };
  }

  /**
   * Detect semantic regions in the document
   */
  private detectSemanticRegions(blocks: Block[]): Page['semanticRegions'] {
    const regions: any[] = [];

    // Detect header region (top 20% of page)
    const headerBlocks = blocks.filter(b => b.bbox.y < 0.2);
    if (headerBlocks.length > 0) {
      regions.push({
        id: 'header_region',
        type: 'header' as const,
        bbox: this.computeBoundingBox(headerBlocks.map(b => b.bbox)),
        confidence: 0.8,
        blockIds: headerBlocks.map(b => b.id),
      });
    }

    // Detect footer region (bottom 15% of page)
    const footerBlocks = blocks.filter(b => b.bbox.y + b.bbox.height > 0.85);
    if (footerBlocks.length > 0) {
      regions.push({
        id: 'footer_region',
        type: 'footer' as const,
        bbox: this.computeBoundingBox(footerBlocks.map(b => b.bbox)),
        confidence: 0.8,
        blockIds: footerBlocks.map(b => b.id),
      });
    }

    // Detect main content region
    const mainBlocks = blocks.filter(b => 
      b.bbox.y >= 0.2 && b.bbox.y + b.bbox.height <= 0.85
    );
    if (mainBlocks.length > 0) {
      regions.push({
        id: 'main_content_region',
        type: 'main_content' as const,
        bbox: this.computeBoundingBox(mainBlocks.map(b => b.bbox)),
        confidence: 0.9,
        blockIds: mainBlocks.map(b => b.id),
      });
    }

    return regions;
  }

  /**
   * Extract key-value pairs from document structure
   */
  private extractKeyValuePairs(words: Word[], blocks: Block[]): KeyValuePair[] {
    const pairs: KeyValuePair[] = [];
    
    // Look for common patterns like "Label: Value"
    for (const block of blocks) {
      const blockText = block.lines.map(l => 
        l.words.map(w => w.text).join(' ')
      ).join(' ');

      const colonMatches = blockText.match(/([^:]+):\s*([^:]+)/g);
      if (colonMatches) {
        for (const match of colonMatches) {
          const [keyPart, valuePart] = match.split(':').map(s => s.trim());
          if (keyPart && valuePart) {
            pairs.push({
              key: {
                text: keyPart,
                bbox: block.bbox, // Simplified - would need word-level detection
                confidence: 0.8,
              },
              value: {
                text: valuePart,
                bbox: block.bbox, // Simplified - would need word-level detection
                confidence: 0.8,
              },
              relationship: 'adjacent',
              semanticType: this.inferSemanticType(keyPart),
            });
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Enhanced table detection with structure analysis
   */
  private async enhancedTableDetection(words: Word[], blocks: Block[]): Promise<Table[]> {
    const tables: Table[] = [];
    
    // Detect table patterns based on alignment and spacing
    const potentialTableBlocks = blocks.filter(block => 
      this.isLikelyTableBlock(block, words)
    );

    for (const block of potentialTableBlocks) {
      const table = this.analyzeTableStructure(block, words);
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  // Helper methods

  private computeBoundingBox(boxes: BoundingBox[]): BoundingBox {
    if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    const minX = Math.min(...boxes.map(b => b.x));
    const minY = Math.min(...boxes.map(b => b.y));
    const maxX = Math.max(...boxes.map(b => b.x + b.width));
    const maxY = Math.max(...boxes.map(b => b.y + b.height));
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private detectAlignment(words: Word[]): Line['alignment'] {
    if (words.length === 0) return 'left';
    
    const leftX = Math.min(...words.map(w => w.bbox.x));
    const rightX = Math.max(...words.map(w => w.bbox.x + w.bbox.width));
    const centerX = (leftX + rightX) / 2;
    const pageCenter = 0.5;
    
    if (Math.abs(centerX - pageCenter) < 0.1) return 'center';
    if (rightX > 0.8) return 'right';
    return 'left';
  }

  private calculateHorizontalOverlap(bbox1: BoundingBox, bbox2: BoundingBox): number {
    const left = Math.max(bbox1.x, bbox2.x);
    const right = Math.min(bbox1.x + bbox1.width, bbox2.x + bbox2.width);
    const overlap = Math.max(0, right - left);
    const minWidth = Math.min(bbox1.width, bbox2.width);
    return minWidth > 0 ? overlap / minWidth : 0;
  }

  private calculateVisualHierarchy(lines: Line[]): number {
    // Simplified hierarchy calculation based on position and font characteristics
    const avgY = lines.reduce((sum, line) => sum + line.bbox.y, 0) / lines.length;
    
    // Earlier in document = higher hierarchy
    return Math.max(1, Math.floor((1 - avgY) * 5));
  }

  private inferSemanticRole(lines: Line[], blockType: Block['type']): string {
    const text = lines.map(l => l.words.map(w => w.text).join(' ')).join(' ').toLowerCase();
    
    if (text.includes('total') || text.includes('amount')) return 'amount';
    if (text.includes('date')) return 'date';
    if (text.includes('address')) return 'address';
    if (text.includes('invoice')) return 'invoice_number';
    if (blockType === 'heading') return 'title';
    
    return 'content';
  }

  private extractStyleProperties(lines: Line[]): Block['styleProperties'] {
    // Extract common style properties from words
    const words = lines.flatMap(l => l.words);
    const fontSizes = words.map(w => w.fontSize).filter(Boolean) as number[];
    const avgFontSize = fontSizes.length > 0 
      ? fontSizes.reduce((sum, size) => sum + size, 0) / fontSizes.length 
      : 12;
    
    return {
      fontWeight: avgFontSize > 14 ? 'bold' : 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
    };
  }

  private isLikelyHeading(line: Line): boolean {
    const words = line.words;
    const avgFontSize = words.reduce((sum, w) => sum + (w.fontSize || 12), 0) / words.length;
    const text = words.map(w => w.text).join(' ');
    
    return avgFontSize > 14 || text.length < 100;
  }

  private isLikelyList(lines: Line[]): boolean {
    return lines.some(line => {
      const text = line.words.map(w => w.text).join(' ').trim();
      return /^[\d•\-\*]/.test(text);
    });
  }

  private analyzeBlockRelationship(block1: Block, block2: Block): SpatialRelationship | null {
    const bbox1 = block1.bbox;
    const bbox2 = block2.bbox;
    
    const verticalDistance = Math.abs(bbox1.y - bbox2.y);
    const horizontalDistance = Math.abs(bbox1.x - bbox2.x);
    
    if (verticalDistance < 0.05) { // Same row
      if (bbox1.x < bbox2.x) {
        return {
          elementId: block2.id,
          relationshipType: 'left-of',
          confidence: 0.9,
          distance: horizontalDistance,
        };
      }
    }
    
    if (horizontalDistance < 0.05) { // Same column
      if (bbox1.y < bbox2.y) {
        return {
          elementId: block2.id,
          relationshipType: 'above',
          confidence: 0.9,
          distance: verticalDistance,
        };
      }
    }
    
    return null;
  }

  private isContained(inner: BoundingBox, outer: BoundingBox): boolean {
    return inner.x >= outer.x &&
           inner.y >= outer.y &&
           inner.x + inner.width <= outer.x + outer.width &&
           inner.y + inner.height <= outer.y + outer.height;
  }

  private inferContainerType(container: Block, contained: Block[]): any {
    if (contained.every(b => b.type === 'line')) return 'group';
    if (contained.some(b => b.type === 'table')) return 'table';
    return 'section';
  }

  private detectLayoutType(blocks: Block[]): any {
    const avgWidth = blocks.reduce((sum, b) => sum + b.bbox.width, 0) / blocks.length;
    
    if (avgWidth < 0.4) return 'multi_column';
    if (blocks.some(b => b.type === 'table')) return 'table_heavy';
    return 'single_column';
  }

  private computeReadingFlow(blocks: Block[]): string[] {
    return blocks
      .sort((a, b) => a.readingOrder! - b.readingOrder!)
      .map(b => b.id);
  }

  private computeVisualHierarchy(blocks: Block[]): any[] {
    return blocks.map(block => ({
      blockId: block.id,
      level: block.visualHierarchy || 1,
      importance: block.confidence,
    }));
  }

  private inferSemanticType(key: string): string {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('invoice')) return 'invoice_number';
    if (lowerKey.includes('total')) return 'total_amount';
    if (lowerKey.includes('date')) return 'date';
    if (lowerKey.includes('address')) return 'address';
    return 'general';
  }

  private isLikelyTableBlock(block: Block, words: Word[]): boolean {
    // Simplified table detection
    const lines = block.lines;
    if (lines.length < 2) return false;
    
    // Check for consistent column alignment
    const lineStartPositions = lines.map(line => line.words[0]?.bbox.x || 0);
    const uniquePositions = Array.from(new Set(lineStartPositions.map(x => Math.round(x * 20) / 20)));
    
    return uniquePositions.length >= 2 && lines.length >= 3;
  }

  private analyzeTableStructure(block: Block, words: Word[]): Table | null {
    const lines = block.lines;
    if (lines.length < 2) return null;
    
    // Create simplified table structure
    const cells: TableCell[] = [];
    let cellIndex = 0;
    
    for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
      const line = lines[rowIndex];
      const lineWords = line.words;
      
      // Simplistic cell detection - group words by horizontal spacing
      let colIndex = 0;
      for (const word of lineWords) {
        cells.push({
          text: word.text,
          bbox: word.bbox,
          row: rowIndex,
          col: colIndex++,
          rowSpan: 1,
          colSpan: 1,
          confidence: word.confidence,
          isHeader: rowIndex === 0,
        });
      }
    }
    
    const maxCols = Math.max(...cells.map(c => c.col + 1));
    
    return {
      id: `table_${block.id}`,
      bbox: block.bbox,
      cells,
      rows: lines.length,
      cols: maxCols,
      confidence: 0.8,
    };
  }

  private enhanceBlocksWithSemantics(blocks: Block[], words: Word[]): Block[] {
    // Add semantic enhancements to blocks
    return blocks.map((block, index) => ({
      ...block,
      spatialRelationships: [], // Will be populated in spatial graph
    }));
  }
}

export const layoutEngine = LayoutEngine.getInstance();