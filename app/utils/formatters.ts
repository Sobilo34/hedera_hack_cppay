export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatAmount = (amount: number): string => {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}₦${formatCurrency(Math.abs(amount))}`;
};

export const formatCryptoAmount = (amount: number, decimals: number = 6): string => {
  if (amount === 0) return '0';
  if (amount < 0.000001) return '<0.000001';
  return amount.toFixed(decimals).replace(/\.?0+$/, '');
};

export const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatDate = (dateString: string): string => {
  return dateString;
};

export const formatAccountNumber = (accountNumber: string): string => {
  return accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
};
