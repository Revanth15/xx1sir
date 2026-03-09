'use client'
import { useState } from 'react'
import { MoreHorizontal, Key, Trash2, UserRoundPen, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteUser, updateUserPassword, updateUserInfo } from './actions'
import { notify } from '../../../utils/toast'
import { BD_ROLES_REF } from '@/lib/defaults'

interface UserActionsProps {
  userId: string
  username: string
  currentRole: string
}

type DialogType = 'rename' | 'role' | 'password' | 'delete' | null

const ROLES = BD_ROLES_REF

type RoleValue = typeof ROLES[number]['value']

export function UserActions({ userId, username, currentRole }: UserActionsProps) {
  const [openDialog, setOpenDialog] = useState<DialogType>(null)
  const [newName, setNewName] = useState(username)
  const [newRole, setNewRole] = useState<RoleValue>(currentRole as RoleValue)
  const [newPassword, setNewPassword] = useState('')

  const closeDialog = () => {
    setOpenDialog(null)
    setNewPassword('')
  }

  const handleRename = async () => {
    if (newName && newName !== username) {
      notify.promise(updateUserInfo(userId, { username: newName }), {
        loading: 'Renaming operative...',
        success: `Operative renamed to "${newName}"`,
        error: 'Failed to rename operative',
      })
    }
    closeDialog()
  }

  const handleRoleChange = async () => {
    if (newRole && newRole !== currentRole) {
      const label = ROLES.find((r) => r.value === newRole)?.label ?? newRole
      notify.promise(updateUserInfo(userId, { role: newRole }), {
        loading: 'Updating access level...',
        success: `Access level updated to "${label}"`,
        error: 'Failed to update access level',
      })
    }
    closeDialog()
  }

  const handleReset = async () => {
    if (newPassword && newPassword.length >= 6) {
      notify.promise(updateUserPassword(userId, newPassword), {
        loading: 'Resetting password...',
        success: 'Password reset successfully',
        error: 'Failed to reset password',
      })
    }
    closeDialog()
  }

  const handleDelete = async () => {
    notify.promise(deleteUser(userId), {
      loading: 'Deleting account...',
      success: `"${username}" has been deleted`,
      error: 'Failed to delete account',
    })
    closeDialog()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl border-border shadow-lg">
          <DropdownMenuLabel>Management</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => { setNewName(username); setOpenDialog('rename') }} className="cursor-pointer">
            <UserRoundPen className="mr-2 h-4 w-4 text-muted-foreground" /> Rename Operative
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => { setNewRole(currentRole as RoleValue); setOpenDialog('role') }} className="cursor-pointer">
            <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" /> Change Access Level
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setOpenDialog('password')} className="cursor-pointer">
            <Key className="mr-2 h-4 w-4 text-muted-foreground" /> Reset Password
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setOpenDialog('delete')}
            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete Account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={openDialog === 'rename'} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Operative</DialogTitle>
            <DialogDescription>
              Enter a new username for <span className="font-medium text-foreground">{username}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-username">Username</Label>
            <Input
              id="new-username"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleRename} disabled={!newName || newName === username}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={openDialog === 'role'} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Access Level</DialogTitle>
            <DialogDescription>
              Select a new role for <span className="font-medium text-foreground">{username}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="role-select">Role</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as RoleValue)}>
              <SelectTrigger id="role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleRoleChange} disabled={newRole === currentRole}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={openDialog === 'password'} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for <span className="font-medium text-foreground">{username}</span>. Must be at least 6 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReset()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleReset} disabled={newPassword.length < 6}>
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={openDialog === 'delete'} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{username}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}