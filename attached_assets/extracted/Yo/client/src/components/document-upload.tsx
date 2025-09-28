import { useState, useCallback } from "react";
import { Upload, X, FileType, ShieldCheck, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Document } from "@shared/schema";
import { Link } from "wouter";

interface DocumentUploadProps {
  onDocumentSelect: (documentId: string) => void;
}

export default function DocumentUpload({ onDocumentSelect }: DocumentUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);

  const { data: documentsData } = useQuery({
    queryKey: ['/api/documents'],
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: api.uploadDocuments,
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `${data.documents.length} file(s) uploaded successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      // Auto-select the first uploaded document
      if (data.documents.length > 0) {
        onDocumentSelect(data.documents[0].id);
      }
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFiles = useCallback((files: FileList) => {
    if (files.length > 0) {
      uploadMutation.mutate(files);
    }
  }, [uploadMutation]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "Document has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeDocument = (documentId: string) => {
    deleteMutation.mutate(documentId);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileType className="w-5 h-5 text-red-600" />;
    }
    return <FileType className="w-5 h-5 text-blue-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576) + ' MB';
  };

  return (
    <Card data-testid="card-document-upload">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Upload Document</CardTitle>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Upload</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          data-testid="upload-zone"
        >
          <div className="space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full mx-auto flex items-center justify-center">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-medium">
                {uploadMutation.isPending ? "Uploading..." : "Drop files here or click to upload"}
              </p>
              <p className="text-sm text-muted-foreground">Supports PDF, JPG, PNG formats</p>
            </div>
          </div>
          <input
            id="file-input"
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={handleInputChange}
            disabled={uploadMutation.isPending}
            data-testid="input-file"
          />
        </div>

        {/* Uploaded Files List */}
        {(documentsData as { documents?: Document[] })?.documents && (documentsData as { documents: Document[] }).documents.length > 0 && (
          <div className="space-y-3" data-testid="uploaded-files-list">
            {(documentsData as { documents: Document[] }).documents.map((document: Document) => (
              <div
                key={document.id}
                className={`flex items-center justify-between p-3 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors ${
                  'hover:ring-2 hover:ring-primary'
                }`}
                onClick={() => onDocumentSelect(document.id)}
                data-testid={`file-item-${document.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-md flex items-center justify-center">
                    {getFileIcon(document.mimeType)}
                  </div>
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-filename-${document.id}`}>
                      {document.originalName}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-filesize-${document.id}`}>
                      {formatFileSize(document.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded">
                    Ready
                  </span>
                  <Link href={`/preview/${document.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-preview-${document.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDocument(document.id);
                    }}
                    data-testid={`button-remove-${document.id}`}
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
