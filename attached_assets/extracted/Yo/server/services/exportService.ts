import { ExtractionResult } from "@shared/schema";

export class ExportService {
  static exportToJSON(result: ExtractionResult, pretty: boolean = true): string {
    return JSON.stringify(result, null, pretty ? 2 : 0);
  }

  static exportToCSV(result: ExtractionResult): string {
    let csvContent = "";
    
    // Handle objects from smart_image mode
    if (result.objects && result.objects.length > 0) {
      csvContent += "# Detected Objects\n";
      csvContent += "Label,Confidence,Category,Description\n";
      
      result.objects.forEach(obj => {
        const confidence = Math.round(obj.confidence * 100) + '%';
        const category = obj.category || '';
        const description = obj.description || '';
        csvContent += `"${this.escapeCsvValue(obj.label)}","${confidence}","${this.escapeCsvValue(category)}","${this.escapeCsvValue(description)}"\n`;
      });
      
      csvContent += "\n";
    }

    // Handle tables from other modes
    if (result.tables && result.tables.length > 0) {
      result.tables.forEach((table, tableIndex) => {
        if (table.title) {
        csvContent += `# ${table.title}\n`;
      }
      
      if (table.data && table.data.length > 0) {
        // Get headers from first row or explicit headers
        const headers = table.headers || Object.keys(table.data[0]);
        
        // Add headers
        csvContent += headers.map(header => `"${this.escapeCsvValue(header)}"`).join(",") + "\n";
        
        // Add data rows
        table.data.forEach(row => {
          const csvRow = headers.map(header => {
            const value = row[header] || "";
            return `"${this.escapeCsvValue(String(value))}"`;
          }).join(",");
          csvContent += csvRow + "\n";
        });
      }
      
      if (tableIndex < result.tables.length - 1) {
        csvContent += "\n"; // Add blank line between tables
      }
      });
    }

    return csvContent;
  }

  static exportToMarkdown(result: ExtractionResult): string {
    let markdown = "";
    const extractedTexts = new Set<string>(); // Track extracted text to avoid duplication

    // Add metadata header
    if (result.metadata) {
      markdown += `# Document Extraction Results\n\n`;
      markdown += `**Processed:** ${result.metadata.processed_at}\n`;
      markdown += `**AI Provider:** ${result.metadata.ai_provider}\n`;
      markdown += `**Extraction Mode:** ${result.metadata.extraction_mode}\n`;
      if (result.metadata.page_count) {
        markdown += `**Page Count:** ${result.metadata.page_count}\n`;
      }
      if (result.metadata.word_count) {
        markdown += `**Word Count:** ${result.metadata.word_count}\n`;
      }
      markdown += `\n`;
    }

    // COMPREHENSIVE MULTI-SOURCE TEXT EXTRACTION STRATEGY
    let documentContent = "";

    // SOURCE 1: Structured content (highest priority - often contains formatted text)
    if (result.structured_content && result.structured_content.trim()) {
      documentContent += result.structured_content.trim() + "\n\n";
      extractedTexts.add(result.structured_content.trim().substring(0, 100));
    }

    // SOURCE 2: Extract from Key-Value pairs (critical for forms and invoices)
    if (result.ir && result.ir.pages) {
      result.ir.pages.forEach((page: any) => {
        if (page.keyValuePairs && page.keyValuePairs.length > 0) {
          page.keyValuePairs.forEach((kvp: any) => {
            const keyText = kvp.key?.text || "";
            const valueText = kvp.value?.text || "";
            if (keyText && valueText) {
              documentContent += `**${keyText}:** ${valueText}\n\n`;
            } else if (keyText) {
              documentContent += `${keyText}\n\n`;
            } else if (valueText) {
              documentContent += `${valueText}\n\n`;
            }
          });
        }
      });
    }

    // SOURCE 3: Extract from ALL blocks with comprehensive text extraction
    if (result.ir && result.ir.pages) {
      result.ir.pages.forEach((page: any, pageIndex: number) => {
        if (result.ir!.pages.length > 1) {
          documentContent += `## Page ${pageIndex + 1}\n\n`;
        }
        
        // Extract from semantic regions first (header, footer, main content)
        if (page.semanticRegions && page.semanticRegions.length > 0) {
          page.semanticRegions.forEach((region: any) => {
            if (region.blockIds && region.blockIds.length > 0) {
              const regionBlocks = page.blocks?.filter((block: any) => 
                region.blockIds.includes(block.id)
              ) || [];
              
              if (regionBlocks.length > 0) {
                const regionText = regionBlocks.map((block: any) => 
                  this.extractTextFromBlock(block)
                ).filter((text: string) => text.trim()).join(' ').trim();
                
                if (regionText && !this.isDuplicate(regionText, extractedTexts)) {
                  documentContent += regionText + "\n\n";
                  extractedTexts.add(regionText.substring(0, 100));
                }
              }
            }
          });
        }

        // Extract from ALL blocks (comprehensive extraction)
        if (page.blocks && page.blocks.length > 0) {
          // Sort blocks by reading order or spatial position
          const sortedBlocks = page.blocks.sort((a: any, b: any) => {
            if (a.readingOrder !== undefined && b.readingOrder !== undefined) {
              return a.readingOrder - b.readingOrder;
            }
            if (a.bbox && b.bbox) {
              if (Math.abs(a.bbox.y - b.bbox.y) > 0.02) {
                return a.bbox.y - b.bbox.y;
              }
              return a.bbox.x - b.bbox.x;
            }
            return 0;
          });

          sortedBlocks.forEach((block: any) => {
            const blockText = this.extractTextFromBlock(block);
            if (blockText && !this.isDuplicate(blockText, extractedTexts)) {
              if (block.type === 'heading' && block.level) {
                const headingPrefix = '#'.repeat(Math.min(block.level + 2, 6));
                documentContent += `${headingPrefix} ${blockText}\n\n`;
              } else {
                documentContent += blockText + "\n\n";
              }
              extractedTexts.add(blockText.substring(0, 100));
            }
          });
        }

        // SOURCE 4: Extract from table cells in IR (often contains key information)
        if (page.tables && page.tables.length > 0) {
          page.tables.forEach((table: any) => {
            if (table.cells && table.cells.length > 0) {
              const tableText = table.cells.map((cell: any) => cell.text || '').filter((text: string) => text.trim()).join(' ').trim();
              if (tableText && !this.isDuplicate(tableText, extractedTexts)) {
                documentContent += tableText + "\n\n";
                extractedTexts.add(tableText.substring(0, 100));
              }
            }
          });
        }

        // SOURCE 5: Fallback - Extract from ALL words if blocks missed anything
        if (page.words && page.words.length > 0) {
          const allWordsText = page.words
            .sort((a: any, b: any) => {
              if (a.bbox && b.bbox) {
                if (Math.abs(a.bbox.y - b.bbox.y) > 0.01) {
                  return a.bbox.y - b.bbox.y;
                }
                return a.bbox.x - b.bbox.x;
              }
              return 0;
            })
            .map((word: any) => word.text || '')
            .filter((text: string) => text.trim())
            .join(' ')
            .trim();
          
          if (allWordsText && !this.isDuplicate(allWordsText, extractedTexts)) {
            documentContent += allWordsText + "\n\n";
            extractedTexts.add(allWordsText.substring(0, 100));
          }
        }
      });
    }

    // SOURCE 6: Fallback plain text extraction
    if (result.text && result.text.trim() && !this.isDuplicate(result.text.trim(), extractedTexts)) {
      documentContent += result.text.trim() + "\n\n";
    }

    // Add all document content
    if (documentContent.trim()) {
      markdown += `## Document Content\n\n${documentContent}`;
    }

    // Add objects from smart_image mode
    if (result.objects && result.objects.length > 0) {
      markdown += `## Detected Objects\n\n`;
      result.objects.forEach((obj, objIndex) => {
        markdown += `### ${obj.label}\n\n`;
        markdown += `**Confidence:** ${Math.round(obj.confidence * 100)}%\n\n`;
        if (obj.category) {
          markdown += `**Category:** ${obj.category}\n\n`;
        }
        if (obj.description) {
          markdown += `**Description:** ${obj.description}\n\n`;
        }
        markdown += "---\n\n";
      });
    }

    // Add tables (preserve existing functionality)
    if (result.tables && result.tables.length > 0) {
      result.tables.forEach((table, tableIndex) => {
        if (table.title) {
          markdown += `## ${table.title}\n\n`;
        } else {
          markdown += `## Table ${tableIndex + 1}\n\n`;
        }

        if (table.confidence) {
          markdown += `*Confidence: ${Math.round(table.confidence * 100)}%*\n\n`;
        }

        if (table.data && table.data.length > 0) {
          const headers = table.headers || Object.keys(table.data[0]);
          
          // Create table header
          markdown += "| " + headers.join(" | ") + " |\n";
          markdown += "|" + headers.map(() => "---").join("|") + "|\n";
          
          // Add data rows
          table.data.forEach(row => {
            const markdownRow = headers.map(header => {
              const value = row[header] || "";
              return this.escapeMarkdownValue(String(value));
            }).join(" | ");
            markdown += "| " + markdownRow + " |\n";
          });
          
          markdown += "\n";
        }

        // Add summary if present (preserve existing functionality)
        if (table.summary && Object.keys(table.summary).length > 0) {
          markdown += `### Summary\n\n`;
          Object.entries(table.summary).forEach(([key, value]) => {
            markdown += `- **${key}:** ${value}\n`;
          });
          markdown += "\n";
        }
      });
    }

    return markdown;
  }

  // Helper method to extract text from a block
  private static extractTextFromBlock(block: any): string {
    if (!block || !block.lines || block.lines.length === 0) {
      return "";
    }

    return block.lines.map((line: any) => {
      if (!line.words || line.words.length === 0) {
        return "";
      }
      return line.words.map((word: any) => word.text || '').join(' ');
    }).join(' ').trim();
  }

  // Helper method to check for duplicate content
  private static isDuplicate(text: string, existingTexts: Set<string>): boolean {
    const textSnippet = text.trim().substring(0, 100);
    return textSnippet.length > 10 && existingTexts.has(textSnippet);
  }

  private static escapeCsvValue(value: string): string {
    // Escape double quotes by doubling them
    return value.replace(/"/g, '""');
  }

  private static escapeMarkdownValue(value: string): string {
    // Escape pipe characters in markdown tables
    return value.replace(/\|/g, '\\|');
  }

  static getFileExtension(format: string): string {
    switch (format) {
      case 'json': return 'json';
      case 'csv': return 'csv';
      case 'markdown': return 'md';
      default: return 'txt';
    }
  }

  static getContentType(format: string): string {
    switch (format) {
      case 'json': return 'application/json';
      case 'csv': return 'text/csv';
      case 'markdown': return 'text/markdown';
      default: return 'text/plain';
    }
  }
}
