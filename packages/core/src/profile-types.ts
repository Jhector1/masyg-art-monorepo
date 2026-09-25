// Profile API response types

export type LastOrderSummary = {
  id: string;
  status: string;
  total: number;
  placedAt: string; // ISO date
};

export type AddressSummary = {
  id: string;
  label?: string | null;
  city: string;
  state: string;
  country: string;
  createdAt: string; // ISO date
};

export type EntitlementSummary = {
  exportQuota: number;
  editQuota: number;
  exportsUsed: number;
  editsUsed: number;
  exportRemaining: number;
  editRemaining: number;
};

export type ProfileCounts = {
  favorites: number;
  orders: number;
  reviews: number;
  designs: number;
  purchasedDesigns: number;
  cartItems: number;
};

export type UserProfile = {
  id: string;
  name?: string | null;
  email: string;
  avatarUrl?: string | null;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  downloadCount: number;
  counts: ProfileCounts;
  lastOrder: LastOrderSummary | null;
  addresses: AddressSummary[];
  entitlements: EntitlementSummary;
};

export type ProfileOk = { user: UserProfile };
export type ProfileError = { error: string; code?: string; [k: string]: unknown };

export type ProfileResponse = ProfileOk | ProfileError;

export const isProfileOk = (x: ProfileResponse): x is ProfileOk =>
  typeof (x as ProfileOk)?.user === "object" && !!(x as ProfileOk).user?.id;
