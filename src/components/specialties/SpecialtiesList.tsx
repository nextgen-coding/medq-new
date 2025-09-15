
import { Specialty } from '@/types';
import { SpecialtyCard } from '@/components/specialties/SpecialtyCard';
import { Skeleton } from '@/components/ui/skeleton';

interface SpecialtiesListProps {
  specialties: Specialty[];
  isLoading: boolean;
}

export function SpecialtiesList({ specialties, isLoading }: SpecialtiesListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3 rounded" />
              <Skeleton className="h-4 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (specialties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-blue-300 dark:border-blue-700 backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 p-8 text-center animate-fade-in">
        <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">No specialties available</h3>
        <p className="text-muted-foreground mt-2">
          Please check back later or contact an administrator.
        </p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {specialties.map((specialty) => (
        <SpecialtyCard key={specialty.id} specialty={specialty} />
      ))}
    </div>
  );
}
