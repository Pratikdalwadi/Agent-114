import { useMemo } from "react";
import { TextChunk, Grounding, GroundingBox } from "@shared/schema";
import { cn } from "@/lib/utils";

interface TextChunkOverlayProps {
  textChunks: TextChunk[];
  documentDimensions: { width: number; height: number };
  highlightedChunk?: string | null;
  hoveredChunk?: string | null;
  currentPage?: number;
  onChunkClick?: (chunk: TextChunk) => void;
  onChunkHover?: (chunkId: string | null) => void;
  showOverlay?: boolean;
}

interface ProcessedChunkOverlay {
  chunk: TextChunk;
  grounding: Grounding;
  pixelCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  groundingIndex: number; // Track which grounding region this represents
}

export default function TextChunkOverlay({
  textChunks,
  documentDimensions,
  highlightedChunk,
  hoveredChunk,
  currentPage = 0,
  onChunkClick,
  onChunkHover,
  showOverlay = true,
}: TextChunkOverlayProps) {
  // Process chunks for rendering - support multiple grounding regions per chunk
  const processedChunks = useMemo((): ProcessedChunkOverlay[] => {
    if (!showOverlay || !textChunks) return [];

    const overlays: ProcessedChunkOverlay[] = [];

    textChunks
      .filter(chunk => chunk.grounding && chunk.grounding.length > 0)
      .forEach(chunk => {
        // Create an overlay for each grounding region in the chunk
        chunk.grounding!.forEach((grounding, groundingIndex) => {
          // Transform Landing AI coordinates to pixel coordinates
          const pixelCoordinates = transformGroundingToPixels(
            grounding.box,
            documentDimensions.width,
            documentDimensions.height
          );

          overlays.push({
            chunk,
            grounding,
            pixelCoordinates,
            isVisible: grounding.page === currentPage,
            groundingIndex,
          });
        });
      });

    return overlays.filter(pc => pc.isVisible);
  }, [textChunks, documentDimensions, currentPage, showOverlay]);

  // Get overlay style for chunk
  const getChunkOverlayStyle = (processedChunk: ProcessedChunkOverlay) => {
    const { chunk, pixelCoordinates } = processedChunk;
    const isHighlighted = highlightedChunk === chunk.chunk_id;
    const isHovered = hoveredChunk === chunk.chunk_id;
    
    // Get color based on chunk type
    const colors = getChunkTypeColors(chunk.chunk_type);
    
    // Calculate opacity based on confidence and state
    const baseOpacity = isHighlighted ? 0.4 : isHovered ? 0.3 : 0.2;
    const confidence = chunk.confidence || 0.8;
    const finalOpacity = baseOpacity * confidence;

    return {
      backgroundColor: colors.background.replace('0.3', finalOpacity.toString()),
      border: `2px solid ${colors.border}`,
      borderRadius: '4px',
      boxShadow: isHighlighted 
        ? `0 0 12px ${colors.shadow}` 
        : isHovered 
        ? `0 0 8px ${colors.shadow}` 
        : 'none',
      transition: 'all 0.3s ease',
    };
  };

  if (!showOverlay || processedChunks.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" data-testid="text-chunk-overlay">
      {processedChunks.map((processedChunk) => {
        const { chunk, pixelCoordinates } = processedChunk;
        const isHighlighted = highlightedChunk === chunk.chunk_id;
        const isHovered = hoveredChunk === chunk.chunk_id;

        return (
          <div
            key={`${chunk.chunk_id}-${processedChunk.groundingIndex}`}
            className={cn(
              "absolute transition-all duration-300 cursor-pointer group pointer-events-auto",
              isHighlighted && "animate-pulse z-10",
              isHovered && "z-20"
            )}
            style={{
              left: `${(pixelCoordinates.x / documentDimensions.width) * 100}%`,
              top: `${(pixelCoordinates.y / documentDimensions.height) * 100}%`,
              width: `${(pixelCoordinates.width / documentDimensions.width) * 100}%`,
              height: `${(pixelCoordinates.height / documentDimensions.height) * 100}%`,
              ...getChunkOverlayStyle(processedChunk),
            }}
            onClick={() => onChunkClick?.(chunk)}
            onMouseEnter={() => onChunkHover?.(chunk.chunk_id)}
            onMouseLeave={() => onChunkHover?.(null)}
            title={`${chunk.chunk_type}: ${chunk.text.substring(0, 100)}${chunk.text.length > 100 ? '...' : ''} (${Math.round((chunk.confidence || 0) * 100)}%) [Region ${processedChunk.groundingIndex + 1}/${chunk.grounding?.length || 1}]`}
            data-testid={`overlay-chunk-${chunk.chunk_id}-${processedChunk.groundingIndex}`}
          >
            {/* Chunk type indicator */}
            <div className={cn(
              "absolute top-0 left-0 px-2 py-1 text-xs font-medium rounded-br transition-opacity",
              "bg-white dark:bg-gray-800 border border-border shadow-sm",
              "opacity-0 group-hover:opacity-100",
              isHighlighted && "opacity-100"
            )}>
              <div className="flex items-center gap-1">
                {getChunkTypeIcon(chunk.chunk_type)}
                <span className="capitalize">{chunk.chunk_type}</span>
                {chunk.confidence && (
                  <span className="text-muted-foreground">
                    {Math.round(chunk.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* Chunk ID indicator (bottom right) with region info */}
            <div className={cn(
              "absolute bottom-0 right-0 px-1 py-0.5 text-xs font-mono rounded-tl",
              "bg-black/70 text-white transition-opacity",
              "opacity-0 group-hover:opacity-100",
              isHighlighted && "opacity-100"
            )}>
              {chunk.chunk_id.split('-').pop()}{chunk.grounding && chunk.grounding.length > 1 ? `·${processedChunk.groundingIndex + 1}` : ''}
            </div>

            {/* Interactive overlay area */}
            <div className="absolute inset-0 bg-transparent" />
          </div>
        );
      })}
    </div>
  );
}

// Utility functions

/**
 * Transform Landing AI grounding coordinates to pixel coordinates
 */
function transformGroundingToPixels(
  grounding: GroundingBox,
  documentWidth: number,
  documentHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(grounding.l * documentWidth),
    y: Math.round(grounding.t * documentHeight),
    width: Math.round((grounding.r - grounding.l) * documentWidth),
    height: Math.round((grounding.b - grounding.t) * documentHeight),
  };
}

/**
 * Get colors for different chunk types
 */
function getChunkTypeColors(chunkType: string) {
  const colorMappings = {
    text: {
      background: 'rgba(59, 130, 246, 0.3)', // blue
      border: 'rgb(59, 130, 246)',
      shadow: 'rgba(59, 130, 246, 0.5)',
    },
    table: {
      background: 'rgba(239, 68, 68, 0.3)', // red
      border: 'rgb(239, 68, 68)',
      shadow: 'rgba(239, 68, 68, 0.5)',
    },
    title: {
      background: 'rgba(147, 51, 234, 0.3)', // purple
      border: 'rgb(147, 51, 234)',
      shadow: 'rgba(147, 51, 234, 0.5)',
    },
    figure: {
      background: 'rgba(34, 197, 94, 0.3)', // green
      border: 'rgb(34, 197, 94)',
      shadow: 'rgba(34, 197, 94, 0.5)',
    },
    list: {
      background: 'rgba(245, 158, 11, 0.3)', // amber
      border: 'rgb(245, 158, 11)',
      shadow: 'rgba(245, 158, 11, 0.5)',
    },
    header: {
      background: 'rgba(16, 185, 129, 0.3)', // emerald
      border: 'rgb(16, 185, 129)',
      shadow: 'rgba(16, 185, 129, 0.5)',
    },
    footer: {
      background: 'rgba(107, 114, 128, 0.3)', // gray
      border: 'rgb(107, 114, 128)',
      shadow: 'rgba(107, 114, 128, 0.5)',
    },
  };

  return colorMappings[chunkType as keyof typeof colorMappings] || colorMappings.text;
}

/**
 * Get icon for chunk type
 */
function getChunkTypeIcon(chunkType: string) {
  const icons = {
    text: '📝',
    table: '📊',
    title: '🔤',
    figure: '🖼️',
    list: '📋',
    header: '🏷️',
    footer: '⬇️',
  };

  return icons[chunkType as keyof typeof icons] || '📄';
}