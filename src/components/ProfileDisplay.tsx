'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ProfileDisplay() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-500">Name</label>
          <p className="text-lg">{user.name || 'Not provided'}</p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-500">Email</label>
          <p className="text-lg">{user.email}</p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-500">Gender</label>
          <p className="text-lg">
            {user.sexe === 'M' ? 'Male' : user.sexe === 'F' ? 'Female' : 'Not specified'}
          </p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-500">Level (Niveau)</label>
          <p className="text-lg">
            {user.niveau?.name || 'Not selected'}
          </p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-500">Profile Status</label>
          <Badge variant={user.profileCompleted ? 'default' : 'destructive'}>
            {user.profileCompleted ? 'Complete' : 'Incomplete'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
} 