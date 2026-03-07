import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/utils/supabase/server";
import { AuthProvider } from "@/utils/AuthProvider";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/nav";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: "BDDash",
  description: "XX 1SIR Barrack Damage Reports Dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;

  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      profile = data;
    } else {
      console.error("Failed to fetch user profile:", error?.message);
    }
  }

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen w-full bg-background  text-foreground">
        <AuthProvider user={user} profile={profile}>
          <SidebarProvider>
            <AppSidebar />

            <main className="flex-1 flex flex-col min-h-screen w-full">
              {user && (
                <div className="sticky top-0 z-50 flex h-14 items-center border-b bg-background px-4">
                  <SidebarTrigger />
                   BDDash
                </div>
              )}

              <div className="flex-1 mx-auto w-full">
                {children}
              </div>
            </main>
          </SidebarProvider>
          <Toaster richColors={true} />
        </AuthProvider>
      </body>
    </html>
  );
}
