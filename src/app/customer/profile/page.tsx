'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  User,
  Calendar,
  Heart,
  Bell,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  Loader2,
  Edit2,
  Trash2,
  Shield,
  Crown,
} from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { Skeleton } from '@/components/ui/LoadingState';
import { logger } from '@/lib/logger';
import { ChangePasswordSheet } from '@/components/account/ChangePasswordSheet';
import { DeleteAccountSheet } from '@/components/account/DeleteAccountSheet';

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
// PLAN.md decision D1 locked both flags to `true` for launch.
// TODO(phase4): wire to Firebase Remote Config / the Firestore `flags`
// collection once the Phase 4 feature-flag plumbing lands.
const ACCOUNT_FLAGS = {
  changePasswordEnabled: true,
  deleteEnabled: true,
} as const;

// Menu item component
interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
  iconColor?: string;
  danger?: boolean;
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
  iconColor = 'text-gray-500',
  danger,
}: MenuItemProps) {
  const content = (
    <div
      className={`flex items-center justify-between p-4 bg-white ${danger ? 'text-red-600' : 'text-gray-900'}`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${danger ? 'text-red-500' : iconColor}`} />
        <span className="font-medium">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300" />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:bg-gray-50">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="w-full text-left active:bg-gray-50">
      {content}
    </button>
  );
}

function ProfilePageContent() {
  const { user, firebaseUser, signOut, refreshUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [formData, setFormData] = useState({
    displayName: user?.profile?.displayName || '',
    phone: user?.profile?.phone || '',
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName: string; phone: string }) => {
      if (!firebaseUser?.uid) return;
      const db = getFirebaseFirestore();
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        'profile.displayName': data.displayName,
        'profile.phone': data.phone,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setEditDialogOpen(false);
      setFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      logger.error('Failed to update profile', err, { component: 'customer/profile' });
      setFeedback({ type: 'error', message: 'Failed to save profile. Please try again.' });
      setTimeout(() => setFeedback(null), 6000);
    },
  });

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(formData);
  };

  const displayName = user?.profile?.displayName || 'User';
  const displayEmail = user?.profile?.email || firebaseUser?.email || '';
  const userInitial = displayName.charAt(0).toUpperCase();

  // TODO: Wire to Firestore subscription status
  const isEliteMember = false;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-8 text-center">
          <Skeleton className="w-24 h-24 rounded-full mx-auto mb-4" />
          <Skeleton className="h-6 w-32 mx-auto mb-2" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mutation feedback banner */}
      {feedback && (
        <div
          className={`mx-4 mt-4 p-3 rounded-xl border ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <p className="text-sm font-medium">{feedback.message}</p>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-white px-4 pt-6 pb-8 text-center">
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {userInitial}
          </div>
          <button
            onClick={() => setEditDialogOpen(true)}
            className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center"
          >
            <Edit2 className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
          {isEliteMember && (
            <span className="inline-flex items-center gap-1 bg-brand-gold-500 text-brand-maroon-950 text-xs font-bold px-2 py-0.5 rounded-full">
              <Crown className="w-3 h-3" />
              Elite Member
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">{displayEmail}</p>
        {user?.role && (
          <span className="inline-block mt-2 px-3 py-1 bg-brand-maroon-50 text-brand-maroon-600 text-xs font-medium rounded-full capitalize">
            {user.role.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Menu Sections */}
      <div className="px-4 py-6">
        {/* Account Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 px-4 mb-2 uppercase tracking-wider">
            Account
          </h2>
          <div className="rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            <MenuItem
              icon={User}
              label="Edit Profile"
              onClick={() => setEditDialogOpen(true)}
              iconColor="text-brand-maroon-500"
            />
            <MenuItem
              icon={Calendar}
              label="My Bookings"
              href="/customer/bookings"
              iconColor="text-brand-gold-500"
            />
            <MenuItem
              icon={Heart}
              label="Favorites"
              href="/customer/favorites"
              iconColor="text-pink-500"
            />
          </div>
        </div>

        {/* Preferences Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 px-4 mb-2 uppercase tracking-wider">
            Preferences
          </h2>
          <div className="rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            <MenuItem
              icon={Bell}
              label="Notifications"
              href="/customer/notifications"
              iconColor="text-purple-500"
            />
          </div>
        </div>

        {/* Support Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 px-4 mb-2 uppercase tracking-wider">
            Support
          </h2>
          <div className="rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            <MenuItem
              icon={HelpCircle}
              label="Help & Support"
              href="/help"
              iconColor="text-green-500"
            />
            <MenuItem icon={Info} label="About" href="/about" iconColor="text-gray-500" />
          </div>
        </div>

        {/* Account Actions */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 px-4 mb-2 uppercase tracking-wider">
            Actions
          </h2>
          <div className="rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {ACCOUNT_FLAGS.changePasswordEnabled && (
              <MenuItem
                icon={Shield}
                label="Change Password"
                onClick={() => setChangePasswordOpen(true)}
                iconColor="text-indigo-500"
              />
            )}
            <MenuItem
              icon={LogOut}
              label="Sign Out"
              onClick={handleSignOut}
              iconColor="text-gray-500"
            />
            {ACCOUNT_FLAGS.deleteEnabled && (
              <MenuItem
                icon={Trash2}
                label="Delete Account"
                onClick={() => setDeleteAccountOpen(true)}
                danger
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 rounded-xl"
                placeholder="Enter phone number"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              className="bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500 text-white rounded-xl"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Sheet (Phase 3 — Agent 3B) */}
      {ACCOUNT_FLAGS.changePasswordEnabled && (
        <ChangePasswordSheet
          open={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
        />
      )}

      {/* Delete Account Sheet (Phase 3 — Agent 3B) */}
      {ACCOUNT_FLAGS.deleteEnabled && (
        <DeleteAccountSheet
          open={deleteAccountOpen}
          onClose={() => setDeleteAccountOpen(false)}
        />
      )}

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute requiredRoles={['customer']}>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}
