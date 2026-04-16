import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import { CREATE_BONUS_CHORE } from 'graphql/queries';

interface CreateBonusChoreFormProps {
  currentAdminId: number;
  onSuccess?: () => void;
}

const CreateBonusChoreForm: React.FC<CreateBonusChoreFormProps> = ({
  currentAdminId,
  onSuccess,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [bonusDate, setBonusDate] = useState(today);
  const [maxClaims, setMaxClaims] = useState('');

  const [createBonusChore, { loading }] = useMutation(CREATE_BONUS_CHORE, {
    onCompleted: () => {
      toast.success('Bonus chore created!');
      setName('');
      setAmountDollars('');
      setBonusDate(today);
      setMaxClaims('');
      onSuccess?.();
    },
    onError: () => {
      toast.error('Error creating bonus chore');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amountDollars || !bonusDate) return;

    const amountCents = Math.round(parseFloat(amountDollars) * 100);
    const parsedMaxClaims = maxClaims !== '' ? parseInt(maxClaims, 10) : null;

    await createBonusChore({
      variables: {
        input: {
          name: name.trim(),
          description: null,
          paymentType: 'daily',
          amountCents,
          requiredDays: 0,
          active: true,
          createdByAdminId: currentAdminId,
          bonusDate,
          maxClaims: parsedMaxClaims,
        },
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="bonusName" className="block text-sm font-medium text-gray-700 mb-1">
          Name *
        </label>
        <input
          id="bonusName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter bonus chore name"
          required
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="bonusAmount" className="block text-sm font-medium text-gray-700 mb-1">
          Amount ($) *
        </label>
        <input
          id="bonusAmount"
          type="number"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.00"
          min="0"
          step="0.01"
          required
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="bonusDate" className="block text-sm font-medium text-gray-700 mb-1">
          Date *
        </label>
        <input
          id="bonusDate"
          type="date"
          value={bonusDate}
          onChange={(e) => setBonusDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          min={today}
          required
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="bonusMaxClaims" className="block text-sm font-medium text-gray-700 mb-1">
          Max Claims (leave empty for unlimited)
        </label>
        <input
          id="bonusMaxClaims"
          type="number"
          value={maxClaims}
          onChange={(e) => setMaxClaims(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Unlimited"
          min="1"
          step="1"
          disabled={loading}
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !name.trim() || !amountDollars || !bonusDate}
        >
          {loading ? 'Creating...' : 'Create Bonus Chore'}
        </button>
      </div>
    </form>
  );
};

export default CreateBonusChoreForm;
