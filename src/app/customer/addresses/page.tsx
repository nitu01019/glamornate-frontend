'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { useAuth } from '@/lib/auth-provider';
import { useToastActions } from '@/lib/providers';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Home,
  Briefcase,
  Tag,
  Star,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { SavedAddress, AddressLabel } from '@/types';
import { AddressFormDialog } from './_components/AddressFormDialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_CONFIG: Record<
  AddressLabel,
  { icon: typeof Home; label: string; badgeBg: string; badgeText: string }
> = {
  home: {
    icon: Home,
    label: 'Home',
    badgeBg: 'bg-brand-maroon-50',
    badgeText: 'text-brand-maroon-600',
  },
  work: {
    icon: Briefcase,
    label: 'Work',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-600',
  },
  other: {
    icon: Tag,
    label: 'Other',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-600',
  },
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AddressesPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const toast = useToastActions();

  const [addresses, setAddresses] = useState<readonly SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);
  const [deleting, setDeleting] = useState(false);

  // -----------------------------------------------------------------------
  // Mount guard for hydration safety
  // -----------------------------------------------------------------------
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // -----------------------------------------------------------------------
  // Fetch addresses from Firestore
  // -----------------------------------------------------------------------
  const fetchAddresses = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    try {
      const db = getFirebaseFirestore();
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      const data = userDoc.data();
      setAddresses(data?.addresses ?? []);
    } catch {
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser?.uid, toast]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // -----------------------------------------------------------------------
  // Persist helper
  // -----------------------------------------------------------------------
  const persistAddresses = useCallback(
    async (next: readonly SavedAddress[]) => {
      if (!firebaseUser?.uid) throw new Error('Not authenticated');
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        addresses: next,
      });
      setAddresses(next);
    },
    [firebaseUser?.uid],
  );

  // -----------------------------------------------------------------------
  // Add / Edit submit
  // -----------------------------------------------------------------------
  const handleFormSubmit = useCallback(
    async (data: Omit<SavedAddress, 'id' | 'isDefault' | 'createdAt' | 'updatedAt'>) => {
      try {
        const now = new Date().toISOString();

        if (editingAddress) {
          // Edit: replace the matching address, keep default/createdAt intact
          const updated: readonly SavedAddress[] = addresses.map((a) =>
            a.id === editingAddress.id
              ? { ...a, ...data, updatedAt: now }
              : a,
          );
          await persistAddresses(updated);
          toast.success('Address updated');
        } else {
          // Add new address
          const isFirst = addresses.length === 0;
          const newAddr: SavedAddress = {
            ...data,
            id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            isDefault: isFirst,
            createdAt: now,
            updatedAt: now,
          };
          await persistAddresses([...addresses, newAddr]);
          toast.success('Address added');
        }
        setFormOpen(false);
        setEditingAddress(null);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    },
    [addresses, editingAddress, persistAddresses, toast],
  );

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const remaining = addresses.filter((a) => a.id !== deleteTarget.id);
      // If the deleted address was default, promote the first remaining
      const needsNewDefault =
        deleteTarget.isDefault && remaining.length > 0;
      const updated: readonly SavedAddress[] = needsNewDefault
        ? remaining.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a))
        : remaining;
      await persistAddresses(updated);
      toast.success('Address removed');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to remove address');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, addresses, persistAddresses, toast]);

  // -----------------------------------------------------------------------
  // Set Default
  // -----------------------------------------------------------------------
  const handleSetDefault = useCallback(
    async (id: string) => {
      try {
        const updated: readonly SavedAddress[] = addresses.map((a) => ({
          ...a,
          isDefault: a.id === id,
          updatedAt: a.id === id ? new Date().toISOString() : a.updatedAt,
        }));
        await persistAddresses(updated);
        toast.success('Default address updated');
      } catch {
        toast.error('Failed to update default address');
      }
    },
    [addresses, persistAddresses, toast],
  );

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const openAddDialog = () => {
    setEditingAddress(null);
    setFormOpen(true);
  };

  const openEditDialog = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setFormOpen(true);
  };

  const formatAddress = (a: SavedAddress): string =>
    [a.flatHouse, a.street, a.landmark, a.city, a.state, a.pincode]
      .filter(Boolean)
      .join(', ');

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (!hasMounted) return null;

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">My Addresses</h1>
          <button
            onClick={openAddDialog}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-maroon-500 text-white text-sm font-medium rounded-lg hover:bg-brand-maroon-600 active:scale-[0.98] transition-all min-h-[36px]"
          >
            <Plus className="w-4 h-4" />
            Add New
          </button>
        </div>
      </header>

      <main className="px-4 pt-5 max-w-lg mx-auto">
        {/* Loading skeleton */}
        {loading && <AddressSkeleton />}

        {/* Empty state */}
        {!loading && addresses.length === 0 && (
          <EmptyAddresses onAdd={openAddDialog} />
        )}

        {/* Address list */}
        {!loading && addresses.length > 0 && (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <AddressCard
                key={addr.id}
                address={addr}
                onEdit={() => openEditDialog(addr)}
                onDelete={() => setDeleteTarget(addr)}
                onSetDefault={() => handleSetDefault(addr.id)}
                formatAddress={formatAddress}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit Dialog */}
      <AddressFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingAddress(null);
        }}
        editingAddress={editingAddress}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Remove Address</DialogTitle>
            <DialogDescription className="text-gray-500 text-sm">
              Are you sure you want to remove this address? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-3 mt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddressCard
// ---------------------------------------------------------------------------

interface AddressCardProps {
  readonly address: SavedAddress;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onSetDefault: () => void;
  readonly formatAddress: (a: SavedAddress) => string;
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  formatAddress,
}: AddressCardProps) {
  const config = LABEL_CONFIG[address.label];
  const LabelIcon = config.icon;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Top row: label badge + default badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.badgeBg} ${config.badgeText}`}
          >
            <LabelIcon className="w-3.5 h-3.5" />
            {config.label}
          </span>
          {address.isDefault && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-gold-50 text-brand-gold-700 border border-brand-gold-200">
              <Star className="w-3 h-3 fill-brand-gold-500" />
              Default
            </span>
          )}
        </div>

        {/* Name + phone */}
        <p className="text-sm font-semibold text-gray-900">{address.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{address.phone}</p>

        {/* Address text */}
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {formatAddress(address)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {!address.isDefault && (
            <button
              onClick={onSetDefault}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-maroon-500 hover:bg-brand-maroon-50 rounded-lg transition-colors min-h-[44px]"
            >
              <MapPin className="w-3.5 h-3.5" />
              Set as Default
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onEdit}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            aria-label="Edit address"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
            aria-label="Delete address"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyAddresses
// ---------------------------------------------------------------------------

function EmptyAddresses({ onAdd }: { readonly onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-brand-maroon-50 flex items-center justify-center mb-4">
        <MapPin className="w-8 h-8 text-brand-maroon-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        No saved addresses
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-[260px]">
        Add your first address for quick and easy home service bookings.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-6 py-3 bg-brand-maroon-500 text-white text-sm font-semibold rounded-xl hover:bg-brand-maroon-600 active:scale-[0.98] transition-all min-h-[44px]"
      >
        <Plus className="w-4 h-4" />
        Add your first address
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function AddressSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
          <div className="flex gap-2 mb-3">
            <div className="h-6 w-16 bg-gray-100 rounded-lg" />
            <div className="h-6 w-20 bg-gray-100 rounded-lg" />
          </div>
          <div className="h-4 w-40 bg-gray-100 rounded mb-1.5" />
          <div className="h-4 w-28 bg-gray-100 rounded mb-3" />
          <div className="h-4 w-full bg-gray-100 rounded mb-1" />
          <div className="h-4 w-3/4 bg-gray-100 rounded" />
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="h-8 w-28 bg-gray-100 rounded-lg" />
            <div className="flex-1" />
            <div className="h-8 w-8 bg-gray-100 rounded-lg" />
            <div className="h-8 w-8 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
