export type BranchesByBank = Record<string, string[]>;

// Seed branches for initial sample banks
export const seedBranchesByBank: BranchesByBank = {
  b1: ['Mumbai Main', 'Pune Camp', 'Nagpur Civil Lines'],
  b2: ['Mumbai Fort', 'Thane West', 'Pune Kothrud'],
  b3: ['Mumbai BKC', 'Navi Mumbai Vashi'],
};

export function loadBranches(bankId: string): string[] {
  try {
    const key = `bank_branches_${bankId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {}
  return seedBranchesByBank[bankId] || [];
}

export function saveBranches(bankId: string, branches: string[]): void {
  try {
    const key = `bank_branches_${bankId}`;
    localStorage.setItem(key, JSON.stringify(branches));
  } catch {}
}
