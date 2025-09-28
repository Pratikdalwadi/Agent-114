import { apiRequest } from "./queryClient";
import { 
  UploadResponse, 
  JobResponse, 
  JobsResponse, 
  DocumentsResponse,
  StartExtractionRequest 
} from "@/types/api";

export const api = {
  // Document operations
  uploadDocuments: async (files: FileList): Promise<UploadResponse> => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    return response.json();
  },

  getDocuments: async (): Promise<DocumentsResponse> => {
    const response = await apiRequest('GET', '/api/documents');
    return response.json();
  },

  deleteDocument: async (documentId: string): Promise<{ message: string }> => {
    const response = await apiRequest('DELETE', `/api/documents/${documentId}`);
    return response.json();
  },

  // Extraction operations
  startExtraction: async (request: StartExtractionRequest): Promise<JobResponse> => {
    const response = await apiRequest('POST', '/api/extraction/start', request);
    return response.json();
  },

  getJob: async (jobId: string): Promise<JobResponse> => {
    const response = await apiRequest('GET', `/api/extraction/${jobId}`);
    return response.json();
  },

  getJobs: async (): Promise<JobsResponse> => {
    const response = await apiRequest('GET', '/api/extraction');
    return response.json();
  },

  downloadResult: async (jobId: string, format?: string): Promise<Blob> => {
    const url = format ? 
      `/api/extraction/${jobId}/download?format=${format}` : 
      `/api/extraction/${jobId}/download`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Download failed');
    }
    return response.blob();
  },

  // Health check
  health: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await apiRequest('GET', '/api/health');
    return response.json();
  }
};
