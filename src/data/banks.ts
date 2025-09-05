export type Bank = {
  id: string;
  name: string;
  type: 'Public' | 'Private' | 'Cooperative' | 'Foreign' | 'Small Finance' | 'Payments';
  state: string;
};

export const bankTypes = [
  'Public',
  'Private',
  'Cooperative',
  'Foreign',
  'Small Finance',
  'Payments',
] as const;

// Mock dataset. Replace with API-driven data when available.
export const banks: Bank[] = [
  { id: 'b1', name: 'State Bank of India', type: 'Public', state: 'Maharashtra' },
  { id: 'b2', name: 'HDFC Bank', type: 'Private', state: 'Maharashtra' },
  { id: 'b3', name: 'DBS Bank', type: 'Foreign', state: 'Maharashtra' },
];
