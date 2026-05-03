import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function StaffSearchBar({
  searchQuery,
  onSearchChange,
  onAdd,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search staff..."
          className="pl-10 rounded-xl border-gray-200"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Button
        onClick={onAdd}
        className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full shadow-lg"
        size="sm"
      >
        <Plus className="w-4 h-4 mr-1" />
        Add
      </Button>
    </div>
  );
}
