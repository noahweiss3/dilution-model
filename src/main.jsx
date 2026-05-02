import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const clerkConfigured = Boolean(CLERK_PUBLISHABLE_KEY)

const tree = clerkConfigured ? (
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    <App clerkConfigured />
  </ClerkProvider>
) : (
  // No Clerk key — render the app without auth (anon-only, localStorage-only).
  <App clerkConfigured={false} />
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{tree}</React.StrictMode>,
)
