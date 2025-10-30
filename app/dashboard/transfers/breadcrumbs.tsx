"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbsProps {
  currentPage?: string;
}

export function Breadcrumbs({ currentPage }: BreadcrumbsProps) {
  return (
    <nav className="mb-6 flex items-center space-x-2 text-sm">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Dashboard
      </Link>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <Link
        href="/dashboard/transfers"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Transfers
      </Link>
      {currentPage && (
        <>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{currentPage}</span>
        </>
      )}
    </nav>
  );
}
