"use client";

import dynamic from 'next/dynamic';
import React from 'react';

// Disable SSR for react-pdf components to avoid DOMMatrix reference server-side.
const Document = dynamic(() => import('react-pdf').then(m => m.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(m => m.Page), { ssr: false });

export { Document, Page };
