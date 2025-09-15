import React, { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getMedicalIcon, getAllMedicalIcons, DEFAULT_ICON_NAME } from '@/lib/medical-icons';
import { useTranslation } from 'react-i18next';
import { Upload, Palette, Image as ImageIcon, Check, X, Loader2, Hash } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SpecialtyIconCustomizerProps {
  value?: {
    icon?: string;
    iconColor?: string;
    iconType?: 'icon' | 'image';
    imageUrl?: string;
  };
  onChange: (value: {
    icon?: string;
    iconColor?: string;
    iconType: 'icon' | 'image';
    imageUrl?: string;
  }) => void;
  label?: string;
  className?: string;
}

const ICON_COLORS = [
  // Primary Colors
  { name: 'Rouge', value: '#dc2626', textClass: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300' },
  { name: 'Orange', value: '#ea580c', textClass: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300' },
  { name: 'Jaune', value: '#ca8a04', textClass: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300' },
  { name: 'Vert', value: '#16a34a', textClass: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300' },
  { name: 'Bleu', value: '#2563eb', textClass: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300' },
  { name: 'Indigo', value: '#4f46e5', textClass: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-300' },
  { name: 'Violet', value: '#7c3aed', textClass: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-violet-300' },
  { name: 'Rose', value: '#db2777', textClass: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-300' },
  
  // Extended Colors
  { name: 'Teal', value: '#0d9488', textClass: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-300' },
  { name: 'Cyan', value: '#0891b2', textClass: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-300' },
  { name: 'Emeraude', value: '#059669', textClass: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300' },
  { name: 'Lime', value: '#65a30d', textClass: 'text-lime-600', bg: 'bg-lime-100 dark:bg-lime-900/30', border: 'border-lime-300' },
  { name: 'Ambre', value: '#d97706', textClass: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300' },
  { name: 'Fuchsia', value: '#c026d3', textClass: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', border: 'border-fuchsia-300' },
  { name: 'Pourpre', value: '#9333ea', textClass: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-300' },
  
  // Neutral/Dark Colors
  { name: 'Ardoise', value: '#475569', textClass: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-900/30', border: 'border-slate-300' },
  { name: 'Gris', value: '#6b7280', textClass: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-900/30', border: 'border-gray-300' },
  { name: 'Zinc', value: '#71717a', textClass: 'text-zinc-600', bg: 'bg-zinc-100 dark:bg-zinc-900/30', border: 'border-zinc-300' },
  { name: 'Pierre', value: '#78716c', textClass: 'text-stone-600', bg: 'bg-stone-100 dark:bg-stone-900/30', border: 'border-stone-300' },
  { name: 'Neutre', value: '#525252', textClass: 'text-neutral-600', bg: 'bg-neutral-100 dark:bg-neutral-900/30', border: 'border-neutral-300' },
];

export function SpecialtyIconCustomizer({ 
  value = { iconType: 'icon', icon: DEFAULT_ICON_NAME, iconColor: '#2563eb' }, 
  onChange, 
  label, 
  className 
}: SpecialtyIconCustomizerProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState(value.iconType || 'icon');
  const [customHex, setCustomHex] = useState(value.iconColor || '#2563eb');
  
  const allIcons = getAllMedicalIcons();
  const selectedIcon = getMedicalIcon(value.icon || DEFAULT_ICON_NAME);
  const selectedColor = value.iconColor || '#2563eb';

  const handleIconSelect = (iconName: string) => {
    onChange({
      ...value,
      icon: iconName,
      iconType: 'icon'
    });
  };

  const handleColorSelect = (color: string) => {
    setCustomHex(color);
    onChange({
      ...value,
      iconColor: color,
      iconType: 'icon'
    });
  };

  const handleHexChange = (hex: string) => {
    setCustomHex(hex);
    // Validate hex color format
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      onChange({
        ...value,
        iconColor: hex,
        iconType: 'icon'
      });
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier image valide",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Erreur",
        description: "La taille du fichier doit être inférieure à 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { url } = await response.json();
      
      onChange({
        ...value,
        iconType: 'image',
        imageUrl: url
      });

      toast({
        title: "Succès",
        description: "Image téléchargée avec succès",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du téléchargement",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleTabChange = (tab: string) => {
    const tabValue = tab as 'icon' | 'image';
    setActiveTab(tabValue);
    if (tabValue === 'icon' && value.iconType !== 'icon') {
      onChange({
        ...value,
        iconType: 'icon',
        icon: value.icon || DEFAULT_ICON_NAME,
        iconColor: value.iconColor || '#2563eb'
      });
    } else if (tabValue === 'image' && value.iconType !== 'image') {
      onChange({
        ...value,
        iconType: 'image'
      });
    }
  };

  const renderPreview = () => {
    if (value.iconType === 'image' && value.imageUrl) {
      return (
        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden">
          <img 
            src={value.imageUrl} 
            alt="Specialty icon" 
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    const SelectedIconComponent = selectedIcon.icon;
    const hexColor = selectedColor;
    const bgColorData = ICON_COLORS.find(c => c.value === hexColor);
    
    return (
      <div className={cn(
        "w-16 h-16 rounded-lg flex items-center justify-center border-2",
        bgColorData?.bg || 'bg-blue-100 dark:bg-blue-900/30',
        bgColorData?.border || 'border-blue-300'
      )} style={{ backgroundColor: `${hexColor}20`, borderColor: `${hexColor}60` }}>
        <SelectedIconComponent className="w-8 h-8" style={{ color: hexColor }} />
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {label && <Label className="text-base font-medium">{label}</Label>}
      
      {/* Preview Section */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Aperçu
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4">
            {renderPreview()}
            <div className="flex-1">
              <div className="text-sm font-medium">
                {value.iconType === 'image' ? 'Image personnalisée' : selectedIcon.label}
              </div>
              <div className="text-xs text-muted-foreground">
                {value.iconType === 'image' 
                  ? (value.imageUrl ? 'Image téléchargée' : 'Aucune image sélectionnée')
                  : `Icône: ${selectedIcon.name}, Couleur: ${selectedColor}`
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customization Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="icon" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Icône
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Image
          </TabsTrigger>
        </TabsList>

        <TabsContent value="icon" className="space-y-4 mt-4">
          {/* Color Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Couleur de l'icône</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Preset Colors */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Couleurs prédéfinies</Label>
                <div className="grid grid-cols-5 gap-2">
                  {ICON_COLORS.map((color) => (
                    <Button
                      key={color.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleColorSelect(color.value)}
                      className={cn(
                        "h-12 w-full relative transition-all p-1 flex flex-col items-center gap-1",
                        selectedColor === color.value && "ring-2 ring-blue-500 ring-offset-2"
                      )}
                      title={color.name}
                    >
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: color.value }}
                      />
                      {selectedColor === color.value && (
                        <Check className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white rounded-full p-0.5" />
                      )}
                      <span className="text-xs truncate w-full text-center">{color.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Hex Input */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Couleur personnalisée (Hex)</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      value={customHex.replace('#', '')}
                      onChange={(e) => {
                        const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                        const fullHex = `#${hex}`;
                        setCustomHex(fullHex);
                        if (hex.length === 6) {
                          handleHexChange(fullHex);
                        }
                      }}
                      placeholder="2563eb"
                      className="pl-8 font-mono text-sm w-32"
                    />
                  </div>
                  <div 
                    className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: customHex }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleColorSelect(customHex)}
                    disabled={!/^#[0-9A-F]{6}$/i.test(customHex)}
                    className="text-xs"
                  >
                    Appliquer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Entrez un code couleur hexadécimal (ex: 2563eb pour bleu)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Icon Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Choisir une icône</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-64">
                <div className="grid grid-cols-4 gap-2 p-1">
                  {allIcons.map((iconData) => {
                    const IconComponent = iconData.icon;
                    const isSelected = value.icon === iconData.name;
                    
                    return (
                      <Button
                        key={iconData.name}
                        type="button"
                        variant={isSelected ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleIconSelect(iconData.name)}
                        className={cn(
                          "h-16 flex-col gap-1 p-2 transition-all duration-200 relative",
                          isSelected ? 
                            "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" :
                            "hover:bg-blue-50 dark:hover:bg-blue-900/10"
                        )}
                        title={iconData.label}
                      >
                        {isSelected && (
                          <Check className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                        )}
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded transition-colors"
                        )} style={{ color: selectedColor }}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-center leading-tight truncate w-full">
                          {iconData.label.split(' ')[0]}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Télécharger une image</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Upload Area */}
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                    isUploading 
                      ? "border-blue-300 bg-blue-50 dark:bg-blue-900/10" 
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                  )}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isUploading}
                  />
                  
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-sm text-blue-600">Téléchargement en cours...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Cliquez pour télécharger une image
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, WEBP jusqu'à 5MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Current Image Display */}
                {value.iconType === 'image' && value.imageUrl && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                    <img 
                      src={value.imageUrl} 
                      alt="Current specialty icon" 
                      className="w-12 h-12 rounded object-cover border"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Image téléchargée avec succès
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Cette image sera utilisée comme icône de la matière
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onChange({ ...value, imageUrl: undefined, iconType: 'image' })}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
