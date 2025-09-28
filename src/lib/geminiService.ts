import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || ''
});

export interface GeminiTextExtractionResult {
  text: string;
  structuredData: {
    title?: string;
    headings: string[];
    paragraphs: string[];
    tables: string[];
    lists: string[];
  };
  confidence: number;
}

export async function extractTextWithGemini(imageDataUrl: string): Promise<GeminiTextExtractionResult> {
  try {
    // Convert data URL to base64
    const base64Data = imageDataUrl.split(',')[1];
    
    const prompt = `
Analyze this PDF page image and extract ALL text content with maximum precision. Focus on:

1. COMPLETE TEXT EXTRACTION: Extract every single piece of visible text including:
   - Main content text
   - Headers and titles
   - Footnotes and captions
   - Page numbers
   - Table content
   - Form fields
   - Watermarks or stamps
   - Any other visible text elements

2. PRESERVE STRUCTURE: Maintain original formatting, line breaks, and spatial relationships

3. CONTENT CLASSIFICATION: Identify different content types accurately

Return a JSON object with this structure:
{
  "text": "ALL extracted text with proper line breaks and spacing preserved",
  "structuredData": {
    "title": "main title if present",
    "headings": ["array of headings"],
    "paragraphs": ["array of paragraph texts"],
    "tables": ["array of table content"],
    "lists": ["array of list items"]
  },
  "confidence": 0.98
}

CRITICAL: Do not miss any text. Even small elements like page numbers, footnotes, and watermarks must be included.
`;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [prompt, ...imageParts],
    });
    
    const text = response.text || '';
    
    // Try to parse as JSON, fallback to plain text
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          text: parsed.text || text,
          structuredData: parsed.structuredData || {
            headings: [],
            paragraphs: [text],
            tables: [],
            lists: []
          },
          confidence: parsed.confidence || 0.95
        };
      }
    } catch (parseError) {
      console.warn('Could not parse Gemini response as JSON, using raw text');
    }
    
    // Fallback to raw text
    return {
      text: text,
      structuredData: {
        headings: [],
        paragraphs: [text],
        tables: [],
        lists: []
      },
      confidence: 0.85
    };
    
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function analyzeDocumentStructure(imageDataUrl: string, fallbackText?: string): Promise<{
  layout: string;
  elements: Array<{
    type: string;
    content: string;
    confidence: number;
  }>;
  completeText: string;
}> {
  try {
    const base64Data = imageDataUrl.split(',')[1];
    
    const prompt = `
Analyze this document page and identify its structural elements and layout. Return a JSON object describing:

1. Overall layout type (single-column, multi-column, mixed, etc.)
2. Individual elements with their types and content
3. Complete text content to ensure nothing is missed

Return JSON in this format:
{
  "layout": "layout description",
  "elements": [
    {
      "type": "header|paragraph|title|table|list|footer|image|caption",
      "content": "text content",
      "confidence": 0.95
    }
  ],
  "completeText": "all visible text including captions, footers, page numbers, etc."
}

Focus on capturing ALL text elements, especially small ones like captions, footnotes, page numbers, and headers/footers.
`;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [prompt, ...imageParts],
    });
    
    const text = response.text || '';
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Ensure we have complete text - use fallback if parsed doesn't include it
        let completeText = parsed.completeText || '';
        if (!completeText && fallbackText) {
          completeText = fallbackText;
        }
        
        // If we still don't have complete text, extract from elements
        if (!completeText && parsed.elements) {
          completeText = parsed.elements.map((el: any) => el.content || '').join('\n').trim();
        }
        
        // Final fallback to raw response text
        if (!completeText) {
          completeText = text;
        }
        
        return {
          layout: parsed.layout || 'single-column',
          elements: parsed.elements || [{
            type: 'paragraph',
            content: completeText,
            confidence: 0.7
          }],
          completeText: completeText
        };
      }
    } catch (parseError) {
      console.warn('Could not parse structure analysis response, using fallback');
    }
    
    // Fallback with complete text preservation
    const completeText = fallbackText || text;
    
    return {
      layout: 'single-column',
      elements: [{
        type: 'paragraph',
        content: completeText,
        confidence: 0.7
      }],
      completeText: completeText
    };
    
  } catch (error) {
    console.error('Document structure analysis error:', error);
    
    // Even in error cases, preserve the fallback text
    const completeText = fallbackText || '';
    
    return {
      layout: 'single-column',
      elements: [{
        type: 'paragraph',
        content: completeText,
        confidence: 0.5
      }],
      completeText: completeText
    };
  }
}