
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReportStatusActionsProps {
  reportId: string;
  currentStatus: 'pending' | 'reviewed' | 'dismissed';
  onUpdateStatus: (reportId: string, newStatus: 'pending' | 'reviewed' | 'dismissed') => Promise<void>;
}

export function ReportStatusActions({ reportId, currentStatus, onUpdateStatus }: ReportStatusActionsProps) {
  const { t } = useTranslation();
  
  if (currentStatus === 'pending') {
    return (
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
          onClick={() => onUpdateStatus(reportId, 'reviewed')}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          {t('reports.markAsReviewed')}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onUpdateStatus(reportId, 'dismissed')}
        >
          <XCircle className="h-4 w-4 mr-1" />
          {t('reports.dismiss')}
        </Button>
      </div>
    );
  }
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onUpdateStatus(reportId, 'pending')}
    >
      {t('reports.reopenReport')}
    </Button>
  );
}
