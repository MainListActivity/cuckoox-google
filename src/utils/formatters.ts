export const formatAmount = (amount: number): string => {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)}亿`;
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toLocaleString();
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}; 