// src/services/fileUploadService.ts
export interface UploadedFileResponse {
  url: string;
  name: string;
  size: number;
  type: string;
}

export const uploadFile = async (file: File): Promise<UploadedFileResponse> => {
  console.log(`Mock uploading file: ${file.name} (${file.size} bytes, type: ${file.type})`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In a real scenario, this would be an API call to the backend,
  // which uploads to MinIO and returns the URL.
  // For mock, return a placeholder URL. Use a real image placeholder for testing.
  const mockImageUrl = `https://via.placeholder.com/300x200.png?text=Uploaded+${encodeURIComponent(file.name)}`;
  
  // If it's not an image, you might return a different kind of response or URL later
  // For now, this service is generic but imageHandler will use it for images.
  if (!file.type.startsWith('image/')) {
     // For non-images, we could return a generic "file uploaded" placeholder or error for this specific image handler
     // However, the imageHandler should ideally only be concerned with images.
     // Let's assume for the imageHandler, it will always get an image-like URL or handle error.
     console.warn("Attempting to upload a non-image file via image uploader. Mocking as image.");
  }

  return {
    url: mockImageUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  };
};
