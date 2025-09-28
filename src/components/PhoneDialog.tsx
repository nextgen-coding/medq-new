import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PhoneDialogProps {
  open: boolean;
  onSave: (phone: string) => Promise<void>;
  loading?: boolean;
}

export function PhoneDialog({ open, onSave, loading }: PhoneDialogProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSave = async () => {
    const tunisianPhoneRegex = /^[2459][0-9]{7}$/;
    if (!tunisianPhoneRegex.test(phone)) {
      setError('Veuillez entrer un numéro de téléphone tunisien valide (8 chiffres, commence par 2, 4, 5 ou 9).');
      return;
    }
    setError('');
    await onSave(phone);
  };

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Numéro de téléphone requis</DialogTitle>
          <DialogDescription>
            Merci de renseigner votre numéro de téléphone tunisien pour continuer.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="ex: 20 123 456"
          pattern="[2459][0-9]{7}"
          maxLength={8}
          minLength={8}
          inputMode="numeric"
          required
        />
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
