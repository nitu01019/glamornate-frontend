'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidUpiVpa } from '@/lib/payments/card-format';

const upiFormSchema = z.object({
  vpa: z
    .string()
    .trim()
    .min(1, 'UPI ID is required.')
    .refine((value) => isValidUpiVpa(value), {
      message: 'Enter a valid UPI ID like name@bank.',
    }),
});

type UpiFormValues = z.infer<typeof upiFormSchema>;

export interface UpiIdFormProps {
  /**
   * Invoked with a validated VPA string when the form is submitted
   * successfully. The parent is responsible for any side-effects
   * (toast, optimistic state update, etc.).
   */
  readonly onSave: (vpa: string) => void;
}

export function UpiIdForm({ onSave }: UpiIdFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpiFormValues>({
    resolver: zodResolver(upiFormSchema),
    defaultValues: { vpa: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit((values) => {
    onSave(values.vpa.trim());
    reset();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate aria-label="Save UPI ID form">
      <div className="space-y-1.5">
        <Label htmlFor="vpa">UPI ID</Label>
        <Input
          id="vpa"
          inputMode="email"
          autoComplete="off"
          placeholder="name@bank"
          aria-invalid={Boolean(errors.vpa) || undefined}
          aria-describedby={errors.vpa ? 'vpa-error' : undefined}
          {...register('vpa')}
        />
        {errors.vpa ? (
          <p id="vpa-error" role="alert" className="text-xs text-brand-maroon-700">
            {errors.vpa.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        Save UPI ID
      </Button>
    </form>
  );
}

export default UpiIdForm;
