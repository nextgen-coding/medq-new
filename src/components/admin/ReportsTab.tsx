import { useTranslation } from 'react-i18next';
import { ReportsList } from './reports/ReportsList';

export function ReportsTab() {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{t('reports.reportedQuestions')}</h3>
      </div>
      <ReportsList />
    </div>
  );
}
