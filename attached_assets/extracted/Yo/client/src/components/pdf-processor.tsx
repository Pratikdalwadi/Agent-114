import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { createWorker } from 'tesseract.js';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface TextChunk {
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

export interface PageData {
  pageNumber: number;
  imageUrl: string;
  textChunks: TextChunk[];
}

interface PDFProcessorProps {
  file: File;
  onProcessingComplete: (pages: PageData[]) => void;
  onProgressUpdate: (progress: number) => void;
  onError?: (error: string) => void;
}

const PDFProcessor = ({ file, onProcessingComplete, onProgressUpdate, onError }: PDFProcessorProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentProcessingPage, setCurrentProcessingPage] = useState<number>(0);
  const [allPages, setAllPages] = useState<PageData[]>([]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentProcessingPage(1);
    setAllPages([]);
    onProgressUpdate(10);
  }, [onProgressUpdate]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF document load error:', error);
    onError?.('Failed to load PDF document. Please ensure the file is a valid PDF.');
  }, [onError]);

  const onPageLoadSuccess = useCallback(async (page: any) => {
    try {
      const pageNum = currentProcessingPage;
      const progressBase = ((pageNum - 1) / numPages) * 80 + 10;
      const pageProgressStep = 80 / numPages / 6; // Divide each page into 6 steps for OCR
      
      onProgressUpdate(progressBase + pageProgressStep);
      
      // Get page dimensions with higher scale for better quality
      const scale = 2;
      const viewport = page.getViewport({ scale });
      
      // Create canvas to render PDF page as image
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      if (!context) {
        throw new Error('Failed to get canvas context');
      }
      
      onProgressUpdate(progressBase + pageProgressStep * 2);
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      onProgressUpdate(progressBase + pageProgressStep * 3);
      
      // Convert canvas to image URL
      const imageUrl = canvas.toDataURL('image/png', 0.95);
      
      // First try PDF.js text extraction
      const textContent = await page.getTextContent();
      let pdfTextChunks: TextChunk[] = [];
      let chunkIndex = 0;
      
      if (textContent && textContent.items && textContent.items.length > 0) {
        textContent.items.forEach((item: any) => {
          if (item.str && item.str.trim().length > 0 && item.transform && item.width && item.height) {
            const originalViewport = page.getViewport({ scale: 1 });
            
            const x = (item.transform[4] / originalViewport.width) * 100;
            const y = ((originalViewport.height - item.transform[5] - item.height) / originalViewport.height) * 100;
            const w = (item.width / originalViewport.width) * 100;
            const h = (item.height / originalViewport.height) * 100;
            
            if (x >= 0 && y >= 0 && w > 0 && h > 0 && x < 100 && y < 100 && 
                x + w <= 100 && y + h <= 100) {
              pdfTextChunks.push({
                id: `page-${pageNum}-pdf-${chunkIndex++}`,
                text: item.str.trim(),
                pageNumber: pageNum,
                geometry: { x, y, w, h }
              });
            }
          }
        });
      }
      
      onProgressUpdate(progressBase + pageProgressStep * 4);
      
      // If PDF.js extraction yielded few results or we want better accuracy, use OCR
      let finalTextChunks = pdfTextChunks;
      
      if (pdfTextChunks.length < 10 || shouldUseOCR(pdfTextChunks)) {
        console.log(`Using OCR for page ${pageNum} - PDF.js found ${pdfTextChunks.length} chunks`);
        
        try {
          // Perform OCR on the rendered image
          const ocrChunks = await performOCR(imageUrl, pageNum);
          onProgressUpdate(progressBase + pageProgressStep * 5);
          
          // If OCR found more text or better quality text, use it
          if (ocrChunks.length > pdfTextChunks.length || hasHigherQuality(ocrChunks, pdfTextChunks)) {
            finalTextChunks = ocrChunks;
            console.log(`OCR improved results: ${ocrChunks.length} chunks vs ${pdfTextChunks.length} from PDF.js`);
          }
        } catch (ocrError) {
          console.warn(`OCR failed for page ${pageNum}, using PDF.js results:`, ocrError);
          // Fallback to PDF.js results
        }
      }
      
      // Group nearby text chunks for better readability
      const groupedChunks = groupNearbyTextChunks(finalTextChunks);
      
      const pageData: PageData = {
        pageNumber: pageNum,
        imageUrl,
        textChunks: groupedChunks
      };
      
      setAllPages(prev => {
        const updated = [...prev, pageData].sort((a, b) => a.pageNumber - b.pageNumber);
        
        // Check if we've processed all pages
        if (updated.length === numPages) {
          onProgressUpdate(100);
          onProcessingComplete(updated);
        } else {
          // Move to next page
          setCurrentProcessingPage(pageNum + 1);
          onProgressUpdate(progressBase + pageProgressStep * 6);
        }
        
        return updated;
      });
      
    } catch (error) {
      console.error(`Error processing PDF page ${currentProcessingPage}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during PDF processing';
      onError?.(errorMessage);
    }
  }, [currentProcessingPage, numPages, onProcessingComplete, onProgressUpdate, onError]);

  // Perform OCR using Tesseract.js
  const performOCR = async (imageUrl: string, pageNum: number): Promise<TextChunk[]> => {
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress for page ${pageNum}: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    try {
      // Configure Tesseract for better accuracy
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;()-[]{}"\' /\\@#$%^&*+=<>|~`',
        preserve_interword_spaces: '1',
      });

      const { data } = await worker.recognize(imageUrl);
      
      const textChunks: TextChunk[] = [];
      let chunkIndex = 0;

      // Get image dimensions for coordinate conversion
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageUrl;
      });

      // Process recognized text data
      if (data && data.text && data.text.trim().length > 0) {
        // Try to use word-level data if available
        const words = (data as any).words;
        if (words && Array.isArray(words) && words.length > 0) {
          words.forEach((word: any) => {
            if (word.text && word.text.trim().length > 0 && word.confidence && word.confidence > 30 && word.bbox) {
              const x = (word.bbox.x0 / img.width) * 100;
              const y = (word.bbox.y0 / img.height) * 100;
              const w = ((word.bbox.x1 - word.bbox.x0) / img.width) * 100;
              const h = ((word.bbox.y1 - word.bbox.y0) / img.height) * 100;

              if (x >= 0 && y >= 0 && w > 0 && h > 0 && x < 100 && y < 100 && 
                  x + w <= 100 && y + h <= 100) {
                textChunks.push({
                  id: `page-${pageNum}-ocr-${chunkIndex++}`,
                  text: word.text.trim(),
                  pageNumber: pageNum,
                  geometry: { x, y, w, h }
                });
              }
            }
          });
        }

        // If word-level didn't work, try line-level
        if (textChunks.length === 0) {
          const lines = (data as any).lines;
          if (lines && Array.isArray(lines) && lines.length > 0) {
            lines.forEach((line: any) => {
              if (line.text && line.text.trim().length > 0 && line.confidence && line.confidence > 30 && line.bbox) {
                const x = (line.bbox.x0 / img.width) * 100;
                const y = (line.bbox.y0 / img.height) * 100;
                const w = ((line.bbox.x1 - line.bbox.x0) / img.width) * 100;
                const h = ((line.bbox.y1 - line.bbox.y0) / img.height) * 100;

                if (x >= 0 && y >= 0 && w > 0 && h > 0 && x < 100 && y < 100 && 
                    x + w <= 100 && y + h <= 100) {
                  textChunks.push({
                    id: `page-${pageNum}-ocr-line-${chunkIndex++}`,
                    text: line.text.trim(),
                    pageNumber: pageNum,
                    geometry: { x, y, w, h }
                  });
                }
              }
            });
          }
        }

        // If nothing worked, create a single chunk for the whole page
        if (textChunks.length === 0 && data.text.trim().length > 0) {
          textChunks.push({
            id: `page-${pageNum}-ocr-full`,
            text: data.text.trim(),
            pageNumber: pageNum,
            geometry: { x: 5, y: 5, w: 90, h: 90 } // Full page approximation
          });
        }
      }

      return textChunks;
    } catch (error) {
      console.error('OCR processing error:', error);
      return [];
    } finally {
      await worker.terminate();
    }
  };

  // Determine if we should use OCR based on PDF.js results quality
  const shouldUseOCR = (pdfChunks: TextChunk[]): boolean => {
    if (pdfChunks.length === 0) return true;
    
    // Check for signs that this might be a scanned document
    const avgTextLength = pdfChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / pdfChunks.length;
    const hasLongWords = pdfChunks.some(chunk => chunk.text.length > 20);
    const hasSpecialChars = pdfChunks.some(chunk => /[^\w\s.,!?;:()-]/.test(chunk.text));
    
    // Use OCR if text seems fragmented or contains unusual characters
    return avgTextLength < 3 || (!hasLongWords && pdfChunks.length > 50) || hasSpecialChars;
  };

  // Compare quality of OCR vs PDF.js results
  const hasHigherQuality = (ocrChunks: TextChunk[], pdfChunks: TextChunk[]): boolean => {
    if (ocrChunks.length === 0) return false;
    if (pdfChunks.length === 0) return true;
    
    const ocrAvgLength = ocrChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / ocrChunks.length;
    const pdfAvgLength = pdfChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / pdfChunks.length;
    
    // OCR is considered higher quality if it has longer average words and more complete text
    return ocrAvgLength > pdfAvgLength * 1.2 || ocrChunks.length > pdfChunks.length * 1.5;
  };

  const onPageLoadError = useCallback((error: Error) => {
    console.error(`PDF page ${currentProcessingPage} load error:`, error);
    onError?.(`Failed to load PDF page ${currentProcessingPage}. The PDF file may be corrupted or encrypted.`);
  }, [currentProcessingPage, onError]);

  // Group nearby text chunks for better readability with improved algorithm
  const groupNearbyTextChunks = (chunks: TextChunk[]): TextChunk[] => {
    if (chunks.length === 0) return [];
    
    // Sort chunks by position (top to bottom, left to right) with better precision
    const sortedChunks = [...chunks].sort((a, b) => {
      const yDiff = a.geometry.y - b.geometry.y;
      if (Math.abs(yDiff) < 0.8) { // More precise same-line detection
        return a.geometry.x - b.geometry.x;
      }
      return yDiff;
    });
    
    const grouped: TextChunk[] = [];
    const lineThreshold = 1.2; // More precise line detection
    const wordThreshold = 3; // Better word spacing detection
    const maxGapThreshold = 15; // Don't group words too far apart
    
    sortedChunks.forEach((chunk, index) => {
      if (index === 0) {
        grouped.push({ ...chunk });
        return;
      }
      
      const lastGroup = grouped[grouped.length - 1];
      const verticalDistance = Math.abs(chunk.geometry.y - lastGroup.geometry.y);
      const horizontalDistance = chunk.geometry.x - (lastGroup.geometry.x + lastGroup.geometry.w);
      
      // Check if chunks are on the same line and close enough horizontally
      const onSameLine = verticalDistance < lineThreshold;
      const closeHorizontally = horizontalDistance >= 0 && horizontalDistance < wordThreshold;
      const notTooFar = horizontalDistance < maxGapThreshold;
      
      // Additional checks for better grouping
      const sameFontSize = Math.abs(chunk.geometry.h - lastGroup.geometry.h) < 0.5;
      const reasonableTextLength = chunk.text.length < 50 && lastGroup.text.length < 200;
      
      if (onSameLine && closeHorizontally && notTooFar && sameFontSize && reasonableTextLength) {
        // Merge chunks with improved spacing logic
        const separator = horizontalDistance > 1 ? ' ' : '';
        lastGroup.text += separator + chunk.text;
        lastGroup.geometry.w = chunk.geometry.x + chunk.geometry.w - lastGroup.geometry.x;
        lastGroup.geometry.h = Math.max(lastGroup.geometry.h, chunk.geometry.h);
        
        // Adjust position to include both chunks
        const minY = Math.min(lastGroup.geometry.y, chunk.geometry.y);
        const maxH = Math.max(lastGroup.geometry.y + lastGroup.geometry.h, chunk.geometry.y + chunk.geometry.h) - minY;
        lastGroup.geometry.y = minY;
        lastGroup.geometry.h = maxH;
      } else {
        // Create new group
        grouped.push({ ...chunk });
      }
    });
    
    // Post-process: clean up text and remove very small or invalid chunks
    return grouped.filter(chunk => {
      const isValidSize = chunk.geometry.w > 0.1 && chunk.geometry.h > 0.1;
      const hasValidText = chunk.text.trim().length > 0;
      const notTooLong = chunk.text.length < 500; // Prevent extremely long merged text
      
      return isValidSize && hasValidText && notTooLong;
    }).map(chunk => ({
      ...chunk,
      text: chunk.text.replace(/\s+/g, ' ').trim() // Clean up whitespace
    }));
  };

  // Only render the current page being processed
  if (currentProcessingPage > 0 && currentProcessingPage <= numPages) {
    return (
      <div className="hidden">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div>Loading PDF...</div>}
          error={<div>Error loading PDF</div>}
        >
          <Page
            key={currentProcessingPage}
            pageNumber={currentProcessingPage}
            onLoadSuccess={onPageLoadSuccess}
            onLoadError={onPageLoadError}
            loading={<div>Rendering page {currentProcessingPage}...</div>}
            error={<div>Error rendering page {currentProcessingPage}</div>}
          />
        </Document>
      </div>
    );
  }

  return (
    <div className="hidden">
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={<div>Loading PDF...</div>}
        error={<div>Error loading PDF</div>}
      />
    </div>
  );
};

export default PDFProcessor;