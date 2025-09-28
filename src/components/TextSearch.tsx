import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MapPin, FileText, ArrowRight } from 'lucide-react';
import { TextChunk, PageData } from './PDFProcessor';

interface TextSearchProps {
  pages: PageData[];
  onChunkSelect: (chunkId: string) => void;
  selectedChunk: string | null;
}

const TextSearch = ({ pages, onChunkSelect, selectedChunk }: TextSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Flatten all text chunks from all pages
  const allTextChunks = useMemo(() => {
    return pages.flatMap(page => page.textChunks);
  }, [pages]);

  // Filter chunks based on search query
  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return allTextChunks;
    
    const query = searchQuery.toLowerCase();
    return allTextChunks.filter(chunk => 
      chunk.text.toLowerCase().includes(query)
    );
  }, [allTextChunks, searchQuery]);

  // Group chunks by page for better organization
  const groupedChunks = useMemo(() => {
    const groups: { [pageNumber: number]: TextChunk[] } = {};
    
    filteredChunks.forEach(chunk => {
      if (!groups[chunk.pageNumber]) {
        groups[chunk.pageNumber] = [];
      }
      groups[chunk.pageNumber].push(chunk);
    });
    
    return groups;
  }, [filteredChunks]);

  const handleChunkClick = (chunkId: string) => {
    onChunkSelect(chunkId === selectedChunk ? '' : chunkId);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const totalResults = filteredChunks.length;
  const pageCount = Object.keys(groupedChunks).length;

  return (
    <Card className="bg-viewer-surface border-viewer-border">
      <div className="p-4 border-b border-viewer-border">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-5 h-5 text-pdf-primary" />
          <h3 className="text-lg font-semibold text-foreground">Text Search</h3>
          <Badge variant="secondary" className="bg-pdf-primary/10 text-pdf-primary">
            {allTextChunks.length} total regions
          </Badge>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search text in document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-20 border-viewer-border focus:border-pdf-primary focus:ring-pdf-primary/20"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-3 text-xs hover:bg-pdf-primary/10"
            >
              Clear
            </Button>
          )}
        </div>

        {searchQuery && (
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-pdf-primary">{totalResults}</span> results
            </span>
            {pageCount > 0 && (
              <span>
                across <span className="font-semibold text-pdf-primary">{pageCount}</span> page{pageCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        <ScrollArea className="h-[400px]">
          {totalResults === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No matching text found' : 'Enter search terms to find text'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedChunks)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([pageNumber, chunks]) => (
                  <div key={pageNumber} className="space-y-2">
                    <div className="flex items-center gap-2 sticky top-0 bg-viewer-surface py-2 border-b border-viewer-border/50">
                      <MapPin className="w-4 h-4 text-pdf-accent" />
                      <span className="font-semibold text-pdf-accent">
                        Page {pageNumber}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {chunks.length} result{chunks.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {chunks.map((chunk) => (
                        <div
                          key={chunk.id}
                          onClick={() => handleChunkClick(chunk.id)}
                          className={`
                            p-3 rounded-lg border cursor-pointer transition-all duration-200
                            ${selectedChunk === chunk.id
                              ? 'border-highlight-primary bg-highlight-primary/10 shadow-sm'
                              : 'border-viewer-border hover:border-pdf-primary/50 hover:bg-pdf-primary/5'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground leading-relaxed break-words">
                                {searchQuery ? (
                                  // Highlight search terms
                                  chunk.text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, index) => 
                                    part.toLowerCase() === searchQuery.toLowerCase() ? (
                                      <mark key={index} className="bg-pdf-accent/30 text-pdf-accent font-semibold px-1 rounded">
                                        {part}
                                      </mark>
                                    ) : part
                                  )
                                ) : (
                                  chunk.text
                                )}
                              </p>
                              
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>Page {chunk.pageNumber}</span>
                                <span>•</span>
                                <span>{chunk.text.length} chars</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <ArrowRight className={`
                                w-4 h-4 transition-all duration-200
                                ${selectedChunk === chunk.id 
                                  ? 'text-highlight-primary transform translate-x-1' 
                                  : 'text-muted-foreground group-hover:text-pdf-primary'
                                }
                              `} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  );
};

export default TextSearch;