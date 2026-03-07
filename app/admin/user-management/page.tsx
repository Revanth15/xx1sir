import { createClient } from '@/utils/supabase/server'
import { createAccount} from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserActions } from './UserActions'

export default async function AdminPage() {
  const supabase = await createClient()
  
  const { data: users } = await supabase
    .from('profiles')
    .select('user_id, username, role')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background p-6 font-sans text-foreground md:p-12 selection:bg-primary/20">
      <div className="mx-auto max-w-6xl space-y-10">
        
        {/* Page Header */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground md:text-base">Manage personnel access, roles, and system directory.</p>
        </div>
        
        {/* Grid Container */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
          
          {/* Left Side: Create User Form */}
          <Card className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm lg:col-span-5">
            <CardHeader className="p-8 pb-6">
              <CardTitle className="text-xl font-semibold tracking-tight text-card-foreground">Provision User</CardTitle>
              <CardDescription className="mt-1 text-muted-foreground">Create a new operative account and assign clearance.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <form action={createAccount} className="space-y-6">
                <div className="space-y-2.5">
                  <Label htmlFor="username" className="text-sm font-medium text-foreground">Username</Label>
                  <Input 
                    id="username" 
                    name="username" 
                    required 
                    className="h-12 rounded-xl border-input bg-background transition-all duration-200 hover:border-border focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring shadow-sm" 
                    placeholder="e.g. jdoe" 
                  />
                </div>
                
                <div className="space-y-2.5">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">Temporary Password</Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    required 
                    className="h-12 rounded-xl border-input bg-background transition-all duration-200 hover:border-border focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring shadow-sm" 
                    placeholder="••••••••" 
                  />
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="role" className="text-sm font-medium text-foreground">Access Level</Label>
                  <Select name="role" defaultValue="user">
                    <SelectTrigger className="h-12 rounded-xl border-input bg-background transition-all duration-200 hover:border-border focus:ring-2 focus:ring-ring shadow-sm">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-lg bg-popover text-popover-foreground">
                      <SelectItem value="user" className="cursor-pointer rounded-lg">Standard User</SelectItem>
                      <SelectItem value="coy_ic" className="cursor-pointer rounded-lg">Company IC</SelectItem>
                      <SelectItem value="s4_brn" className="cursor-pointer rounded-lg">S4 Branch</SelectItem>
                      <SelectItem value="admin" className="cursor-pointer rounded-lg">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="mt-4 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md">
                  Create Account
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right Side: User Directory */}
          <Card className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm lg:col-span-7">
            <CardHeader className="border-b border-border p-8 pb-4">
              <CardTitle className="text-xl font-semibold tracking-tight text-card-foreground">Directory</CardTitle>
              <CardDescription className="mt-1 text-muted-foreground">All authorized personnel currently in the system.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {users?.map((u) => {
                  let badgeCls = "bg-secondary text-secondary-foreground";
                  let roleLabel = "Standard User";
                  
                  if (u.role === 'admin') {
                    badgeCls = "bg-destructive/10 text-destructive dark:bg-destructive/20";
                    roleLabel = "Administrator";
                  } else if (u.role === 'coy_ic') {
                    badgeCls = "bg-primary/10 text-primary dark:bg-primary/20";
                    roleLabel = "Company IC";
                  } else if (u.role === 's4') {
                    badgeCls = "bg-primary/10 text-primary dark:bg-primary/20";
                    roleLabel = "S4 Branch";
                  }

                  return (
                    <li key={u.user_id} className="group flex items-center justify-between px-8 py-5 transition-colors duration-200 hover:bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/80 text-xs font-medium tracking-wider text-muted-foreground">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground ml-2">{u.username}</span>
                          <Badge className={`w-fit border-0 px-2 py-0 text-[13px] ${badgeCls}`}>
                            {roleLabel}
                          </Badge>
                        </div>
                      </div>
                  
                      <UserActions userId={u.user_id} username={u.username} currentRole={u.role} />
                    </li>
                  )
                })}
                
                {(!users || users.length === 0) && (
                  <li className="p-12 text-center text-sm font-medium text-muted-foreground">
                    No personnel records found.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}