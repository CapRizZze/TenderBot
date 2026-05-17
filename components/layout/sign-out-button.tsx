import { LogOut } from "lucide-react";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  async function handleSignOut() {
    "use server";

    await signOut({
      redirectTo: "/sign-in",
    });
  }

  return (
    <form action={handleSignOut}>
      <Button className="h-9 gap-2" size="sm" type="submit" variant="outline">
        <LogOut className="h-4 w-4" />
        <span>Выйти</span>
      </Button>
    </form>
  );
}
