import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "War Room Dashboard",
  description: "Orchestrate parallel AI agent lanes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900">
              War Room
            </h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
