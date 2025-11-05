export interface Notification {
  id: string;
  type: 'transaction' | 'service' | 'activity';
  title: string;
  message: string;
  timestamp: string;
  icon: string;
  read: boolean;
}

export const notifications: Notification[] = [
  {
    id: '1',
    type: 'transaction',
    title: 'Incoming Transfer Successful',
    message: 'MUHAMMED OLOSASA ADEBAYO has sent you ₦1000.00.',
    timestamp: '2 hours ago',
    icon: 'arrow-down',
    read: false,
  },
  {
    id: '2',
    type: 'transaction',
    title: 'Incoming Transfer Successful',
    message: 'IBRAHIM OLAJIDE ALAKA has sent you ₦50,000.00. Get up to 6% bonus on CPPay Airtime.',
    timestamp: '1 day ago',
    icon: 'arrow-down',
    read: false,
  },
  {
    id: '3',
    type: 'transaction',
    title: 'Incoming Transfer Successful',
    message: 'SALAUDEEN SALIU OLADEJO has sent you ₦2,500.00. Get up to 6% bonus on CPPay Airtime.',
    timestamp: '2 days ago',
    icon: 'arrow-down',
    read: false,
  },
  {
    id: '4',
    type: 'service',
    title: 'New Feature Available',
    message: 'Try our new Savings Plan feature and earn up to 15% interest per annum!',
    timestamp: '3 days ago',
    icon: 'information',
    read: true,
  },
  {
    id: '5',
    type: 'activity',
    title: 'Login Alert',
    message: 'Your account was accessed from a new device on Oct 5th, 2025.',
    timestamp: '5 days ago',
    icon: 'shield-check',
    read: true,
  },
];
