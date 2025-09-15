import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  FileText, 
  BookOpen, 
  AlertTriangle, 
  ArrowRight,
  Clock,
  User,
  HelpCircle,
  GraduationCap,
  Flag,
  Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RecentActivityProps {
  recentUsers?: Array<{
    id: string;
    email: string;
    name?: string;
    createdAt: string;
    role: string;
  }>;
  recentQuestions?: Array<{
    id: string;
    text: string;
    type: string;
    createdAt: string;
    lecture: {
      id: string;
      title: string;
      specialty: {
        id: string;
        name: string;
      };
    };
  }>;
  recentLectures?: Array<{
    id: string;
    title: string;
    createdAt: string;
    specialty: {
      id: string;
      name: string;
    };
    _count: {
      questions: number;
    };
  }>;
  recentReports?: Array<{
    id: string;
    message: string;
    status: string;
    createdAt: string;
    question: {
      id: string;
      text: string;
    };
    lecture: {
      id: string;
      title: string;
    };
    user: {
      id: string;
      email: string;
    };
  }>;
}

export function RecentActivity({ 
  recentUsers = [], 
  recentQuestions = [], 
  recentLectures = [], 
  recentReports = [] 
}: RecentActivityProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
  if (diffInHours < 1) return "À l'instant";
  if (diffInHours < 24) return `${diffInHours}h`;
  if (diffInHours < 48) return 'Hier';
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reviewed': return 'bg-green-100 text-green-800 border-green-200';
      case 'dismissed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Recent Users */}
      <Card className="border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
      Utilisateurs récents
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/admin?tab=users')}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
      Voir tout
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
      {recentUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800/30 dark:to-gray-700/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
        <p className="text-muted-foreground">Aucun nouvel utilisateur</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.name || user.email}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={user.role === 'admin' ? 'default' : 'secondary'}
                        className={user.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' : ''}
                      >
                        {user.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Questions */}
      <Card className="border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-blue-500" />
            </div>
      Questions récentes
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/admin?tab=questions')}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
      Voir tout
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            {recentQuestions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800/30 dark:to-gray-700/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="w-8 h-8 text-muted-foreground" />
                </div>
        <p className="text-muted-foreground">Aucune nouvelle question</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentQuestions.map((question) => (
                  <div key={question.id} className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all duration-200">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground line-clamp-2">{question.text}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {question.lecture.specialty.name} • {question.lecture.title}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                        {question.type}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(question.createdAt)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push(`/admin/lecture/${question.lecture.id}`)}
                        className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Voir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Lectures */}
      <Card className="border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-green-500" />
            </div>
      Cours récents
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/admin?tab=lectures')}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
      Voir tout
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            {recentLectures.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800/30 dark:to-gray-700/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-muted-foreground" />
                </div>
        <p className="text-muted-foreground">Aucun nouveau cours</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentLectures.map((lecture) => (
                  <div key={lecture.id} className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all duration-200">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground line-clamp-2">{lecture.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {lecture.specialty.name}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                        {lecture._count.questions} questions
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(lecture.createdAt)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push(`/admin/lecture/${lecture.id}`)}
                        className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Voir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card className="border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 rounded-xl flex items-center justify-center">
              <Flag className="w-5 h-5 text-orange-500" />
            </div>
      Signalements récents
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/admin?tab=reports')}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
      Voir tout
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            {recentReports.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800/30 dark:to-gray-700/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Flag className="w-8 h-8 text-muted-foreground" />
                </div>
        <p className="text-muted-foreground">Aucun signalement récent</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentReports.map((report) => (
                  <div key={report.id} className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all duration-200">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground line-clamp-2">{report.question.text}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {report.lecture.title} • {report.user?.email || 'Anonymous'}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(report.status)}`}>
                        {report.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(report.createdAt)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push(`/lecture/${report.lecture.id}`)}
                        className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Voir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
} 