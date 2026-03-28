import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="text-center">
        <p className="font-display text-6xl text-foreground mb-4">404</p>
        <p className="text-muted mb-8">This page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
