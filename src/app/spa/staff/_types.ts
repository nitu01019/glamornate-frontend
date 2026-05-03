// Staff form data interface
export interface StaffFormData {
  name: string;
  displayName: string;
  photo: string;
  role: string;
  email: string;
  phone: string;
  specialties: string[];
  yearsOfExperience: number;
  gender: 'male' | 'female' | 'other';
  description: string;
}

// Initial form state
export const initialFormData: StaffFormData = {
  name: '',
  displayName: '',
  photo: '',
  role: '',
  email: '',
  phone: '',
  specialties: [],
  yearsOfExperience: 0,
  gender: 'other',
  description: '',
};

export type MutationFeedback = { type: 'success' | 'error'; message: string } | null;
