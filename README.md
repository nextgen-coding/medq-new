# MedQ - Medical Education Platform

A comprehensive medical education platform built with Next.js, featuring custom JWT authentication, role-based access control, and interactive learning modules.

## Features

- 🔐 **Custom JWT Authentication** - Secure, HTTP-only cookie-based authentication
- 👥 **Role-Based Access Control** - Student and Admin roles with appropriate permissions
- 📚 **Interactive Learning** - MCQ and Open-ended questions with progress tracking
- 🎯 **Specialty Management** - Organize content by medical specialties
- 📊 **Progress Tracking** - Monitor learning progress and completion rates
- 🎨 **Modern UI** - Built with shadcn/ui and Tailwind CSS
- 🌍 **Internationalization** - Multi-language support
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom JWT with HTTP-only cookies
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Context + TanStack Query
- **Internationalization**: i18next
- **Type Safety**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd medq
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/medq"
   
   # JWT Secret (generate with: openssl rand -base64 32)
   JWT_SECRET="your-secret-key-here"
   ```

4. **Set up the database**
   ```bash
   # Push the schema to your database
   npx prisma db push
   
   # Generate Prisma client
   npx prisma generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── admin/             # Admin dashboard
│   └── dashboard/         # Student dashboard
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Authentication components
│   └── admin/            # Admin-specific components
├── contexts/             # React contexts
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and configurations
└── types/                # TypeScript type definitions
```

## Authentication System

The platform uses a custom JWT-based authentication system with the following security features:

- **HTTP-only cookies** for token storage (prevents XSS attacks)
- **bcrypt** for password hashing
- **Role-based access control** with middleware protection
- **Automatic token expiration** (7 days)
- **CSRF protection** via SameSite cookies

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `PUT /api/user/password` - Change password

### Content Management
- `GET /api/specialties` - List specialties
- `GET /api/lectures` - List lectures
- `GET /api/questions` - List questions
- `POST /api/questions` - Create question (admin only)

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Set up environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms
The application can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
