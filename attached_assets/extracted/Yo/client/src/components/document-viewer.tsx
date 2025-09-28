import { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PageData, TextChunk } from './pdf-processor';

interface DocumentViewerProps {
  pages: PageData[];
  currentPage: number;
  onPageChange: (page: number) => void;
  selectedChunk?: string;
  onChunkClick?: (chunkId: string) => void;
  onTextCopy?: (text: string) => void;
}

const DocumentViewer = ({
  pages,
  currentPage,
  onPageChange,
  selectedChunk,
  onChunkClick,
  onTextCopy
}: DocumentViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

  const currentPageData = useMemo(() => {
    return pages.find(p => p.pageNumber === currentPage);
  }, [pages, currentPage]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleChunkClick = useCallback((chunk: TextChunk) => {
    onChunkClick?.(chunk.id);
    
    if (onTextCopy) {
      onTextCopy(chunk.text);
      toast({
        title: "Text copied",
        description: "Text has been copied to clipboard",
      });
    } else {
      // Fallback to browser clipboard API
      navigator.clipboard.writeText(chunk.text).then(() => {
        toast({
          title: "Text copied",
          description: "Text has been copied to clipboard",
        });
      }).catch(() => {
        toast({
          title: "Copy failed",
          description: "Could not copy text to clipboard",
          variant: "destructive",
        });
      });
    }
  }, [onChunkClick, onTextCopy, toast]);

  const handleCopyAllText = useCallback(() => {
    if (currentPageData) {
      const allText = currentPageData.textChunks.map(chunk => chunk.text).join(' ');
      if (onTextCopy) {
        onTextCopy(allText);
      } else {
        navigator.clipboard.writeText(allText);
      }
      
      toast({
        title: "Page text copied",
        description: "All text from this page has been copied",
      });
    }
  }, [currentPageData, onTextCopy, toast]);

  if (!currentPageData) {
    return (
      <Card className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No page data available</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="document-viewer">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Badge variant="secondary" data-testid="text-page-info">
            Page {currentPage} of {pages.length}
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(pages.length, currentPage + 1))}
            disabled={currentPage >= pages.length}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <Badge variant="outline" data-testid="text-zoom-level">
            {Math.round(zoom * 100)}%
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
            data-testid="button-rotate"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAllText}
            data-testid="button-copy-all"
          >
            <Copy className="w-4 h-4" />
            Copy All
          </Button>
        </div>
      </div>

      {/* Document Display */}
      <div className="relative overflow-auto bg-gray-100 dark:bg-gray-800" style={{ height: '600px' }}>
        <div className="flex items-center justify-center min-h-full p-4">
          <div 
            className="relative bg-white shadow-lg"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center',
              transition: 'transform 0.2s ease-in-out'
            }}
            data-testid="document-page-container"
          >
            {/* Page Image */}
            <img
              src={currentPageData.imageUrl}
              alt={`Page ${currentPage}`}
              className="block max-w-none"
              style={{ width: 'auto', height: 'auto' }}
              data-testid="document-page-image"
            />
            
            {/* Text Chunks Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {currentPageData.textChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className={`absolute pointer-events-auto cursor-pointer transition-all duration-200 hover:bg-blue-200/30 border-2 ${
                    selectedChunk === chunk.id
                      ? 'bg-yellow-200/50 border-yellow-400'
                      : 'border-transparent hover:border-blue-400'
                  }`}
                  style={{
                    left: `${chunk.geometry.x}%`,
                    top: `${chunk.geometry.y}%`,
                    width: `${chunk.geometry.w}%`,
                    height: `${chunk.geometry.h}%`,
                  }}
                  onClick={() => handleChunkClick(chunk)}
                  title={chunk.text}
                  data-testid={`text-chunk-${chunk.id}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Text Chunks Summary */}
      <div className="p-4 border-t bg-muted/10">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-sm">Extracted Text Regions</h4>
          <Badge variant="secondary" data-testid="text-chunk-count">
            {currentPageData.textChunks.length} regions
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
          {currentPageData.textChunks.slice(0, 12).map((chunk) => (
            <div
              key={chunk.id}
              className={`p-2 rounded text-xs cursor-pointer transition-colors ${
                selectedChunk === chunk.id
                  ? 'bg-yellow-100 border border-yellow-300'
                  : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600'
              }`}
              onClick={() => handleChunkClick(chunk)}
              data-testid={`chunk-preview-${chunk.id}`}
            >
              <p className="truncate font-mono" title={chunk.text}>
                {chunk.text}
              </p>
            </div>
          ))}
          
          {currentPageData.textChunks.length > 12 && (
            <div className="p-2 rounded text-xs bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-muted-foreground">
                +{currentPageData.textChunks.length - 12} more
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default DocumentViewer;