export interface Transaction {
  id: string;
  type: 'bonus' | 'airtime' | 'transfer' | 'data' | 'withdrawal';
  title: string;
  date: string;
  amount: number;
  status: 'Successful' | 'Pending' | 'Failed';
  icon: string;
  iconColor?: string;
  transactionNo?: string;
  creditedTo?: string;
}

export const transactions: Transaction[] = [
  {
    id: '1',
    type: 'bonus',
    title: 'Bonus from Airtime Purchase',
    date: 'Oct 10th, 09:53:09',
    amount: 5.00,
    status: 'Successful',
    icon: 'gift',
    iconColor: '#8FD9FB',
    transactionNo: '25101019020060717390501T',
    creditedTo: 'Cashback',
  },
  {
    id: '2',
    type: 'airtime',
    title: 'Airtime',
    date: 'Oct 10th, 09:53:00',
    amount: -500.00,
    status: 'Successful',
    icon: 'phone',
    iconColor: '#8FD9FB',
    transactionNo: '25101019020060717390502T',
  },
  {
    id: '3',
    type: 'transfer',
    title: 'Transfer from MUHAMMED OLOSASA ADEBAYO',
    date: 'Oct 9th, 14:23:15',
    amount: 1000.00,
    status: 'Successful',
    icon: 'arrow-down',
    iconColor: '#8FD9FB',
    transactionNo: '25100914230060717390503T',
  },
  {
    id: '4',
    type: 'transfer',
    title: 'Transfer from IBRAHIM OLAJIDE ALAKA',
    date: 'Oct 8th, 10:15:30',
    amount: 50000.00,
    status: 'Successful',
    icon: 'arrow-down',
    iconColor: '#8FD9FB',
    transactionNo: '25100810150060717390504T',
  },
  {
    id: '5',
    type: 'transfer',
    title: 'Transfer from SALAUDEEN SALIU OLADEJO',
    date: 'Oct 7th, 16:45:22',
    amount: 2500.00,
    status: 'Successful',
    icon: 'arrow-down',
    iconColor: '#8FD9FB',
    transactionNo: '25100716450060717390505T',
  },
];
