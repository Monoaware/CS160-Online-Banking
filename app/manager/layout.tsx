import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current user from Supabase
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    notFound();
  }

  // Get user from database and verify manager role
  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { auth_user_id: supabaseUser.id },
    select: { role: true, first_name: true, last_name: true },
  });

  if (!dbUser || dbUser.role !== "bank_manager") {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {dbUser.first_name} {dbUser.last_name}
        </p>
      </div>
      {children}
    </div>
  );
}
