
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Image, Video, X, UploadCloud } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface MediaUploadProps {
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  onMediaChange: (url: string | undefined, type: 'image' | 'video' | undefined) => void;
  label?: string;
}

export function MediaUpload({ mediaUrl, mediaType, onMediaChange, label }: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { t } = useTranslation();
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    const fileType = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : null;
                     
    if (!fileType) {
      toast({
        title: t('common.error'),
        description: t('admin.unsupportedFileType'),
        variant: "destructive",
      });
      return;
    }
    
    // Check file size - 5MB limit
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      toast({
        title: t('common.error'),
        description: t('admin.fileTooLarge', { size: '5MB' }),
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // For now, create a local file URL (in production, you&apos;d upload to a cloud storage service)
      const fileUrl = URL.createObjectURL(file);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onMediaChange(fileUrl, fileType as 'image' | 'video');
      
      toast({
        title: t('admin.mediaUploaded'),
        description: t('admin.mediaUploadSuccess'),
      });
    } catch (error: unknown) {
      console.error('Error uploading file:', error);
      toast({
        title: t('common.error'),
        description: (error instanceof Error ? error.message : String(error)) || t('admin.mediaUploadFailed'),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset the input value so the same file can be uploaded again if needed
      e.target.value = '';
    }
  };
  
  const handleRemoveMedia = () => {
    onMediaChange(undefined, undefined);
  };
  
  return (
    <div className="space-y-4">
  <Label>{label ?? t('admin.questionMedia')}</Label>
      
      {mediaUrl ? (
        <div className="border rounded-md p-4 space-y-3">
          {mediaType === 'image' ? (
            <div className="aspect-video relative bg-muted rounded-md overflow-hidden">
              <img 
                src={mediaUrl} 
                alt="Question media preview" 
                className="w-full h-full object-contain"
              />
            </div>
          ) : mediaType === 'video' ? (
            <div className="aspect-video relative bg-muted rounded-md overflow-hidden">
              <video 
                src={mediaUrl} 
                controls 
                aria-label="Question media video"
                className="w-full h-full object-contain"
              />
            </div>
          ) : null}
          
          <div className="flex justify-end">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemoveMedia}
            >
              <X className="h-4 w-4 mr-2" />
              {t('admin.removeMedia')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed rounded-md p-6 flex flex-col items-center justify-center text-muted-foreground">
          <div className="mb-3 flex items-center gap-2">
            <Image className="h-6 w-6" />
            <span className="mx-1">/</span>
            <Video className="h-6 w-6" />
          </div>
          
          <p className="text-sm mb-3">{t('admin.dragAndDropOrClick')}</p>
          
          <div className="relative">
            <Button 
              type="button" 
              variant="outline" 
              disabled={isUploading}
              className="relative"
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              {isUploading ? t('admin.uploading') : t('admin.uploadMedia')}
              <input
                type="file"
                accept="image/*,video/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </Button>
          </div>
          
          <p className="text-xs mt-3">
            {t('admin.supportedFormats')}: PNG, JPG, GIF, MP4, WebM
          </p>
          <p className="text-xs">
            {t('admin.maxFileSize')}: 5MB
          </p>
        </div>
      )}
    </div>
  );
}
