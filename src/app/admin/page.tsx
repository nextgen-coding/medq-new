import { redirect } from 'next/navigation';

// Server-side immediate redirect to avoid flash of intermediate page
export default function AdminIndex() {
  redirect('/admin/dashboard');
}