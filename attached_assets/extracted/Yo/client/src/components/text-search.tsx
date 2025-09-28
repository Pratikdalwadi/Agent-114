import { useState, useCallback, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageData, TextChunk } from './pdf-processor';

interface SearchResult {
  chunk: TextChunk;
  pageNumber: number;
  matchIndex: number;
  beforeText: string;
  matchText: string;
  afterText: string;
}

interface TextSearchProps {
  pages: PageData[];
  onResultSelect: (chunkId: string) => void;
  className?: string;
}

const TextSearch = ({ pages, onResultSelect, className }: TextSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    const results: SearchResult[] = [];
    const query = searchQuery.toLowerCase();

    pages.forEach(page => {
      page.textChunks.forEach((chunk, chunkIndex) => {
        const text = chunk.text.toLowerCase();
        let startIndex = 0;
        let matchIndex = 0;

        while (true) {
          const foundIndex = text.indexOf(query, startIndex);
          if (foundIndex === -1) break;

          const beforeStart = Math.max(0, foundIndex - 30);
          const afterEnd = Math.min(text.length, foundIndex + query.length + 30);

          results.push({
            chunk,
            pageNumber: page.pageNumber,
            matchIndex: matchIndex++,
            beforeText: chunk.text.substring(beforeStart, foundIndex),
            matchText: chunk.text.substring(foundIndex, foundIndex + query.length),
            afterText: chunk.text.substring(foundIndex + query.length, afterEnd)
          });

          startIndex = foundIndex + 1;
        }
      });
    });

    return results;
  }, [searchQuery, pages]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentResultIndex(-1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setCurrentResultIndex(-1);
  }, []);

  const handleResultClick = useCallback((result: SearchResult, index: number) => {
    setCurrentResultIndex(index);
    onResultSelect(result.chunk.id);
  }, [onResultSelect]);

  const handleNextResult = useCallback(() => {
    if (searchResults.length > 0) {
      const nextIndex = (currentResultIndex + 1) % searchResults.length;
      setCurrentResultIndex(nextIndex);
      onResultSelect(searchResults[nextIndex].chunk.id);
    }
  }, [searchResults, currentResultIndex, onResultSelect]);

  const handlePrevResult = useCallback(() => {
    if (searchResults.length > 0) {
      const prevIndex = currentResultIndex <= 0 ? searchResults.length - 1 : currentResultIndex - 1;
      setCurrentResultIndex(prevIndex);
      onResultSelect(searchResults[prevIndex].chunk.id);
    }
  }, [searchResults, currentResultIndex, onResultSelect]);

  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return (
          <span key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  }, []);

  return (
    <Card className={className} data-testid="text-search">
      <div className="p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search through extracted text..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-10"
            data-testid="input-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Search Results Summary */}
        {searchQuery && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant={searchResults.length > 0 ? "default" : "secondary"} data-testid="text-results-count">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </Badge>
              {searchResults.length > 0 && currentResultIndex >= 0 && (
                <Badge variant="outline" data-testid="text-current-result">
                  {currentResultIndex + 1} of {searchResults.length}
                </Badge>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevResult}
                  disabled={searchResults.length <= 1}
                  data-testid="button-prev-result"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextResult}
                  disabled={searchResults.length <= 1}
                  data-testid="button-next-result"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  data-testid="button-toggle-results"
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Search Results List */}
        {searchQuery && searchResults.length > 0 && isExpanded && (
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-2">
              {searchResults.map((result, index) => (
                <div
                  key={`${result.chunk.id}-${result.matchIndex}`}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    currentResultIndex === index
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                      : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleResultClick(result, index)}
                  data-testid={`search-result-${index}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs" data-testid={`result-page-${index}`}>
                      Page {result.pageNumber}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Match {result.matchIndex + 1}
                    </span>
                  </div>
                  
                  <p className="text-sm leading-relaxed" data-testid={`result-text-${index}`}>
                    <span className="text-muted-foreground">
                      {result.beforeText}
                    </span>
                    <span className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded font-medium">
                      {result.matchText}
                    </span>
                    <span className="text-muted-foreground">
                      {result.afterText}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* No Results Message */}
        {searchQuery && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="text-center py-8 text-muted-foreground" data-testid="no-results-message">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No matches found for "{searchQuery}"</p>
            <p className="text-sm">Try different keywords or check spelling</p>
          </div>
        )}

        {/* Search Tips */}
        {!searchQuery && (
          <div className="text-center py-4 text-muted-foreground text-sm" data-testid="search-tips">
            <p>Enter at least 2 characters to search through extracted text</p>
            <p className="mt-1">Results will show context and page locations</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TextSearch;