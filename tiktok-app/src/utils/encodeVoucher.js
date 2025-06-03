export function encodeVoucher(voucher) {
  if (!voucher) {
    throw new Error('Voucher is required');
  }
  
  if (!voucher.to || !voucher.amount || !voucher.nonce || !voucher.deadline) {
    throw new Error('Voucher is missing required fields (to, amount, nonce, deadline)');
  }
  
  return [
    voucher.to,
    voucher.amount,
    voucher.nonce,
    voucher.deadline
  ];
} 