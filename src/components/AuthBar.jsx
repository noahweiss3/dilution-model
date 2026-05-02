import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'

// Shows a Sign In button when logged out, and Clerk's UserButton (avatar +
// dropdown menu with Sign Out, Manage Account) when logged in.
// Only renders if Clerk is configured (publishable key present).
export default function AuthBar({ clerkConfigured }) {
  if (!clerkConfigured) return null
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            style={{
              background: 'transparent', border: '1px solid var(--border-accent)',
              color: 'var(--text-muted)', fontSize: 11, borderRadius: 4,
              padding: '6px 14px', letterSpacing: '0.06em',
              fontFamily: 'DM Mono', cursor: 'pointer',
            }}
          >SIGN IN</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} />
      </SignedIn>
    </>
  )
}
