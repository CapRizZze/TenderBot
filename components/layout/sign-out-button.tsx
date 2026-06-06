"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      aria-label="Выйти"
      className="h-9 gap-2"
      onClick={() => void signOut({ callbackUrl: "/sign-in" })}
      size="sm"
      type="button"
      variant="outline"
    >
      <LogOut className="h-4 w-4" />
      <span>Выйти</span>
    </Button>
  );
}
