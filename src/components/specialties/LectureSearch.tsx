
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LectureSearchProps {
  onSearch: (searchTerm: string) => void;
}

export function LectureSearch({ onSearch }: LectureSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useTranslation();
  
  // Update search results as user types with slight delay for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm, onSearch]);
  
  return (
    <div className="relative w-full md:w-80">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={t('lectures.searchPlaceholder')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}
