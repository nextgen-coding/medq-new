
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function LectureLoadingState() {
  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="flex items-center gap-2 px-4 py-2 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-xl">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Question skeleton */}
      <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg">
        <CardHeader className="p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-4 w-32 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-6">
          {/* Clinical case skeleton */}
          <div className="p-6 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>

          {/* Question options skeleton */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 border border-gray-200/60 dark:border-gray-700/60 rounded-xl backdrop-blur-sm bg-white/50 dark:bg-gray-800/50">
                <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                <Skeleton className="h-6 w-full rounded-lg" />
              </div>
            ))}
          </div>

          {/* Action buttons skeleton */}
          <div className="flex gap-3 justify-end pt-4">
            <Skeleton className="h-12 w-32 rounded-xl" />
            <Skeleton className="h-12 w-32 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
