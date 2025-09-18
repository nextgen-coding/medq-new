'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Image from 'next/image';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sexe: z.enum(['M', 'F'], { required_error: 'Please select your gender' }),
  niveauId: z.string().min(1, 'Please select your level'),
  semesterId: z.string().optional().nullable(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface Niveau {
  id: string;
  name: string;
  order: number;
}

interface Semester {
  id: string;
  name: string;
  order: number;
  niveauId: string;
}

export default function CompleteProfilePage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNiveaux, setIsLoadingNiveaux] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
  resolver: zodResolver(profileSchema),
  mode: 'onChange',
    defaultValues: {
      name: user?.name || '',
    },
  });

  // Load niveaux on component mount
  useEffect(() => {
    const fetchNiveaux = async () => {
      try {
        setIsLoadingNiveaux(true);
        const response = await fetch('/api/niveaux');
        if (response.ok) {
          const data = await response.json();
          // The API returns the array directly, not wrapped in an object
          setNiveaux(Array.isArray(data) ? data : []);
        } else {
          console.error('Failed to fetch niveaux:', response.status);
          setNiveaux([]); // Set empty array on failure
          toast({
            title: t('common.error'),
            description: t('profile.failedToLoadLevels'),
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching niveaux:', error);
        setNiveaux([]); // Set empty array on error
        toast({
          title: t('common.error'),
          description: t('profile.failedToLoadLevels'),
          variant: 'destructive',
        });
      } finally {
        setIsLoadingNiveaux(false);
      }
    };

    fetchNiveaux();
  }, [toast, t]);

  // Redirect if profile is already complete
  useEffect(() => {
    if (user?.profileCompleted) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Load semesters for selected niveau
  const selectedNiveauId = watch('niveauId');
  const selectedSemesterId = watch('semesterId');
  const nameVal = watch('name');
  const sexeVal = watch('sexe');
  const requireSemester = semesters.length > 0;
  const isFormReady = Boolean(
    (nameVal || '').trim().length >= 2 &&
    !!sexeVal &&
    !!selectedNiveauId &&
    (!requireSemester || !!selectedSemesterId)
  );
  useEffect(() => {
    async function loadSemesters(niveauId?: string) {
  // Clear previous semester selection whenever niveau changes
  setValue('semesterId', null as any);
      if (!niveauId) { setSemesters([]); setValue('semesterId', null as any); return; }
      try {
        const res = await fetch(`/api/semesters?niveauId=${niveauId}`);
        if (!res.ok) { setSemesters([]); setValue('semesterId', null as any); return; }
        const data: Semester[] = await res.json();
        setSemesters(data);
        // If no semesters for this niveau, ensure semesterId is null
        if (!data.length) setValue('semesterId', null as any);
      } catch {
        setSemesters([]);
        setValue('semesterId', null as any);
      }
    }
    loadSemesters(selectedNiveauId);
  }, [selectedNiveauId, setValue]);

  // Don't show the form if user is not authenticated
  if (!user) {
    return null;
  }

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          sexe: data.sexe,
          niveauId: data.niveauId,
          // Only send semesterId if we actually have semesters for this niveau
          semesterId: semesters.length ? (data.semesterId || null) : null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        updateUser(result.user);
              toast({
        title: t('common.success'),
        description: t('profile.profileCompleted'),
      });
        router.push('/dashboard');
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update profile',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('common.error'),
        description: t('profile.failedToUpdateProfile'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingNiveaux) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden">
        {/* Left Panel - Marketing Content */}
        <div className="hidden md:flex w-full md:w-1/2 bg-gradient-to-br from-medblue-600 to-medblue-800 text-white p-8 lg:p-10 xl:p-12 flex-col justify-center relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4">
              La nouvelle plateforme de<br />
              <span className="text-medblue-200">Questions révolutionnaire !</span>
            </h1>
            
            <div className="flex items-center mb-8">
              <Image
                src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                alt="MedQ logo"
                width={200}
                height={48}
                sizes="200px"
                priority
                className="h-9 lg:h-10 xl:h-12 w-auto object-contain transition-opacity duration-300"
              />
            </div>
            
            <p className="text-medblue-200 text-base lg:text-lg xl:text-2xl mb-10 xl:mb-12">
              Destinée aux étudiants en médecine
            </p>
          </div>
        </div>

        {/* Right Panel - Loading */}
        <div className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-950 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="md:hidden bg-gradient-to-br from-medblue-600 to-medblue-800 text-white rounded-xl p-5 mb-6">
            <div className="flex items-center mb-3">
              <Image
                src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                alt="MedQ"
                width={180}
                height={40}
                sizes="(max-width: 640px) 160px, 180px"
                priority
                className="h-8 w-auto object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
              />
            </div>
            <p className="text-medblue-100 text-sm">
              La nouvelle plateforme de questions destinée aux étudiants en médecine
            </p>
          </div>
          
          <div className="max-w-md lg:max-w-lg mx-auto w-full flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>{t('common.loading')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden">
        {/* Left Panel - Marketing Content */}
        <div className="hidden md:flex w-full md:w-1/2 bg-gradient-to-br from-medblue-600 to-medblue-800 text-white p-8 lg:p-10 xl:p-12 flex-col justify-center relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4">
              La nouvelle plateforme de<br />
              <span className="text-medblue-200">Questions révolutionnaire !</span>
            </h1>
            
            <div className="flex items-center mb-8">
              <Image
                src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                alt="MedQ logo"
                width={200}
                height={48}
                sizes="200px"
                priority
                className="h-9 lg:h-10 xl:h-12 w-auto object-contain transition-opacity duration-300"
              />
            </div>
            
            <p className="text-medblue-200 text-base lg:text-lg xl:text-2xl mb-10 xl:mb-12">
              Destinée aux étudiants en médecine
            </p>
          </div>
          
          {/* Floating Elements for Depth */}
          <div className="hidden xl:block absolute top-1/3 right-1/4">
            <div className="w-6 h-6 bg-white bg-opacity-10 rounded-full animate-pulse"></div>
          </div>
          <div className="hidden xl:block absolute bottom-1/3 right-1/3">
            <div className="w-4 h-4 bg-medblue-300 bg-opacity-20 rounded-full animate-pulse delay-1000"></div>
          </div>
          <div className="hidden xl:block absolute top-1/2 left-1/3">
            <div className="w-3 h-3 bg-white bg-opacity-5 rounded-full animate-pulse delay-500"></div>
          </div>
        </div>

        {/* Right Panel - Profile Form */}
        <div className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-950 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          {/* Mobile Hero (visible on small screens only) */}
          <div className="md:hidden bg-gradient-to-br from-medblue-600 to-medblue-800 text-white rounded-xl p-5 mb-6">
            <div className="flex items-center mb-3">
              <Image
                src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                alt="MedQ"
                width={180}
                height={40}
                sizes="(max-width: 640px) 160px, 180px"
                priority
                className="h-8 w-auto object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
              />
              <span className="sr-only">MedQ</span>
            </div>
            <p className="text-medblue-100 text-sm">
              La nouvelle plateforme de questions destinée aux étudiants en médecine
            </p>
          </div>

          <div className="max-w-md lg:max-w-lg mx-auto w-full">
            <Card className="border-0 shadow-lg bg-white">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">{t('profile.completeProfile')}</CardTitle>
                <CardDescription>
                  {t('profile.completeProfileDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('profile.fullName')}</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder={t('profile.enterFullName')}
                      className={errors.name ? 'border-red-500' : ''}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Gender Field */}
                  <div className="space-y-2">
                    <Label>{t('profile.gender')}</Label>
                    <RadioGroup
                      onValueChange={(value) => setValue('sexe', value as 'M' | 'F')}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="M" id="male" />
                        <Label htmlFor="male">{t('profile.male')}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="F" id="female" />
                        <Label htmlFor="female">{t('profile.female')}</Label>
                      </div>
                    </RadioGroup>
                    {errors.sexe && (
                      <p className="text-sm text-red-500">{errors.sexe.message}</p>
                    )}
                  </div>

                  {/* Niveau Field */}
                  <div className="space-y-2">
                    <Label htmlFor="niveau">{t('profile.level')}</Label>
                    <Select value={selectedNiveauId || ''} onValueChange={(value) => setValue('niveauId', value)} disabled={isLoadingNiveaux}>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingNiveaux ? 'Loading levels...' : t('profile.selectLevel')} />
                      </SelectTrigger>
                      <SelectContent>
                        {niveaux && niveaux.length > 0 ? (
                          niveaux.map((niveau) => (
                            <SelectItem key={niveau.id} value={niveau.id}>
                              {niveau.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-levels" disabled>
                            {isLoadingNiveaux ? 'Loading levels...' : 'No levels available'}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.niveauId && (
                      <p className="text-sm text-red-500">{errors.niveauId.message}</p>
                    )}
                  </div>

                  {/* Semester Field (optional) */}
                  {!!semesters.length && (
                    <div className="space-y-2">
                      <Label htmlFor="semester">Semester (optional)</Label>
                      <Select
                        value={(selectedSemesterId as string | null | undefined) ?? 'none'}
                        onValueChange={(value) => setValue('semesterId', value === 'none' ? (null as any) : (value as any))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={requireSemester ? 'Select a semester (required)' : 'Select a semester (optional)'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No semester</SelectItem>
                          {semesters.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} {typeof s.order === 'number' ? `(S${s.order})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-medblue-600 to-medblue-700 hover:from-medblue-700 hover:to-medblue-800 text-white font-semibold"
                    disabled={isLoading || !isFormReady}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('profile.completingProfile')}
                      </>
                    ) : (
                      t('profile.completeProfile')
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 