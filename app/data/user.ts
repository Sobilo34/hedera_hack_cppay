export interface User {
  id: string;
  fullName: string;
  nickname: string;
  accountNumber: string;
  accountTier: string;
  mobileNumber: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  balance: number;
  walletBalance: number;
  owealthBalance: number;
}

export const user: User = {
  id: '1',
  fullName: 'BILAL OYELEKE SOLIU',
  nickname: 'SOBIL',
  accountNumber: '8121997368',
  accountTier: 'Tier 1',
  mobileNumber: '+2348121997368',
  email: 'b*@gmail.com',
  gender: 'Male',
  dateOfBirth: '**-**-25',
  address: '',
  balance: 100017.30,
  walletBalance: 99998.76,
  owealthBalance: 18.54,
};
