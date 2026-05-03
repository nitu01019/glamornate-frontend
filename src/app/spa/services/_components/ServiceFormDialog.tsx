'use client';

/**
 * Add / Edit service dialog. Extracted from `spa/services/page.tsx` during
 * Phase 2 Agent-07 (F5 carve). Treat this as the "ServiceFilters" analogue
 * referenced in the plan — the actual CRUD dialog was the dominant LoC
 * contributor in the parent file.
 */

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ServiceWithId } from '@/hooks/useServices';
import type { SpaCategory } from '@/types';
import { categoryOptions, type ServiceFormData } from './useServicesData';

export interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingService: ServiceWithId | null;
  formData: ServiceFormData;
  setFormData: (next: ServiceFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitPending: boolean;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  editingService,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  submitPending,
}: ServiceFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Swedish Massage"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value: SpaCategory) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                step={5}
                placeholder="60"
                value={formData.baseDuration}
                onChange={(e) =>
                  setFormData({ ...formData, baseDuration: parseInt(e.target.value) || 60 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                placeholder="85"
                value={formData.basePrice}
                onChange={(e) =>
                  setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recommendedFor">Recommended For</Label>
              <Select
                value={formData.recommendedFor}
                onValueChange={(value: 'all' | 'men' | 'women') =>
                  setFormData({ ...formData, recommendedFor: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="men">Men</SelectItem>
                  <SelectItem value="women">Women</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ordering">Sort Order</Label>
              <Input
                id="ordering"
                type="number"
                min={0}
                placeholder="0"
                value={formData.ordering}
                onChange={(e) =>
                  setFormData({ ...formData, ordering: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the service"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="e.g., relaxing, therapeutic, popular"
                value={formData.tags.join(', ')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Service Images</Label>
              <ImageUpload
                storagePath={editingService ? `services/${editingService.id}` : 'services/new'}
                currentImages={formData.images}
                maxFiles={4}
                onUpload={(urls) => setFormData({ ...formData, images: urls })}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <Label htmlFor="isActive" className="font-normal">
                Service is active and bookable
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitPending}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              {submitPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingService ? 'Update Service' : 'Create Service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
