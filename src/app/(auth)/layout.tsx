import Link from "next/link";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-bold tracking-tight">
          NoShow<span className="text-blue-600">Zero</span>
        </span>
      </Link>
      {children}
    </div>
  );
}
