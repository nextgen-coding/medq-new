
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReportStatusActions } from './ReportStatusActions';
import { Report } from './types';

interface ReportCardProps {
  report: Report;
  onUpdateStatus: (reportId: string, newStatus: 'pending' | 'reviewed' | 'dismissed') => Promise<void>;
}

export function ReportCard({ report, onUpdateStatus }: ReportCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  
  const navigateToLecture = (lectureId: string) => {
    router.push(`/lecture/${lectureId}`);
  };
  
  return (
    <Card key={report.id} className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base">{report.question?.text || t('reports.questionNotFound')}</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{report.lecture?.title || t('reports.lectureNotFound')}</span>
              {report.status && (
                <Badge variant={
                  report.status === 'pending' ? 'outline' :
                  report.status === 'reviewed' ? 'default' : 'destructive'
                }>
                  {report.status}
                </Badge>
              )}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigateToLecture(report.lecture_id)}
            className="flex items-center gap-1"
          >
            {t('reports.viewQuestion')}
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pb-4">
        <div className="rounded-md bg-muted p-3 mb-4 text-sm">
          <p className="font-medium mb-1">{t('reports.reportMessage')}:</p>
          <p className="text-muted-foreground">{report.message}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            {new Date(report.created_at).toLocaleDateString()} - 
            {report.profile ? report.profile.email : t('reports.anonymousUser')}
          </p>
          
          <ReportStatusActions 
            reportId={report.id} 
            currentStatus={report.status} 
            onUpdateStatus={onUpdateStatus} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
