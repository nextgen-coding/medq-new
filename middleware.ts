import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow pdf.js worker (and other root-level static files) to pass through untouched
  if (pathname === '/pdf.worker.min.mjs' || pathname === '/pdf.worker.mjs') {
    return NextResponse.next();
  }
  
  // Public marketing/legal pages accessible without auth
  const publicRoutes = ['/', '/privacy', '/guide', '/terms', '/faq'];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth-token')?.value;
  const isAuthenticated = token ? verifyToken(token) : false;
  
  // Define protected routes - all routes that require authentication
  const protectedRoutes = [
    '/dashboard', 
    '/admin', 
    '/profile', 
    '/settings', 
    '/lecture', 
    '/specialty',
    '/matieres'
  ];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // Define auth routes
  const isAuthPage = pathname.startsWith('/auth');
  
  // If user is not authenticated and trying to access protected routes
  if (!isAuthenticated && isProtectedRoute) {
    const url = new URL('/auth', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
  
  // If user is authenticated and trying to access auth page
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Check admin routes
  if (pathname.startsWith('/admin') && isAuthenticated) {
    try {
      const decoded = jwt.verify(token!, JWT_SECRET) as { role: string };
      if (decoded.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }
  
  return NextResponse.next();
}

function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (error) {
    return false;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
  // Exclude pdf.worker files explicitly so they are not wrapped by auth middleware
  '/((?!api|_next/static|_next/image|favicon.ico|pdf.worker|min.worker|pdf.worker.min.mjs|public).*)',
  ],
}; 