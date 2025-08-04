import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface PhotoUploadModalProps {
  deliveryId: string;
  clientName: string;
  onClose: () => void;
  onComplete: (photoUrls: string[]) => void;
  onUpload: (deliveryId: string, files: File[]) => Promise<{ success: boolean; photoUrls?: string[]; error?: string }>;
}

interface PhotoPreview {
  file: File;
  url: string;
  id: string;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  deliveryId,
  clientName,
  onClose,
  onComplete,
  onUpload
}) => {
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  // Validate file before adding
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please select only image files (JPEG, PNG, WebP)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Image file is too large. Please select an image under 10MB.';
    }
    return null;
  };

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newPhotos: PhotoPreview[] = [];
    const errors: string[] = [];

    // Check if adding these files would exceed the limit
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`You can only upload up to ${MAX_PHOTOS} photos. Please remove some photos first.`);
      return;
    }

    Array.from(files).forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }

      const photoPreview: PhotoPreview = {
        file,
        url: URL.createObjectURL(file),
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      newPhotos.push(photoPreview);
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setError('');
    }

    if (newPhotos.length > 0) {
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  // Remove photo from preview
  const removePhoto = (photoId: string) => {
    setPhotos(prev => {
      const photoToRemove = prev.find(p => p.id === photoId);
      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.url);
      }
      return prev.filter(p => p.id !== photoId);
    });
    setError('');
  };

  // Handle camera capture
  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  // Handle file picker
  const handleFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (photos.length === 0) {
      setError('Please take at least one photo before completing the delivery.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const files = photos.map(photo => photo.file);
      const result = await onUpload(deliveryId, files);

      if (result.success && result.photoUrls) {
        // Clean up object URLs
        photos.forEach(photo => URL.revokeObjectURL(photo.url));
        onComplete(result.photoUrls);
      } else {
        setError(result.error || 'Failed to upload photos. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      setError('An error occurred while uploading photos. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isUploading) {
      onClose();
    }
  };

  // Clean up object URLs on unmount
  React.useEffect(() => {
    return () => {
      photos.forEach(photo => URL.revokeObjectURL(photo.url));
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-green-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Complete Delivery
              </h2>
              <p className="text-sm text-gray-600">
                {clientName}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Take photos as proof of delivery completion
              </p>
            </div>
            {!isUploading && (
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Photo Upload Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCameraCapture}
              disabled={isUploading || photos.length >= MAX_PHOTOS}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-green-700">Take Photo</span>
            </button>

            <button
              onClick={handleFilePicker}
              disabled={isUploading || photos.length >= MAX_PHOTOS}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-blue-700">Choose Files</span>
            </button>
          </div>

          {/* Photo Counter */}
          <div className="text-center">
            <span className="text-sm text-gray-600">
              {photos.length} of {MAX_PHOTOS} photos selected
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}

          {/* Photo Previews */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Photo Previews:</h4>
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt="Delivery proof"
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    {!isUploading && (
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Uploading photos...</p>
                  <p className="text-xs text-blue-600">Please wait while we upload your photos and complete the delivery.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-end space-x-3">
            {!isUploading && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isUploading || photos.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Delivery
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>
    </div>
  );
};