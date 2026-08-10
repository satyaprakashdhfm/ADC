/* Indian address validation shared by the checkout form and its address hook. */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
export const PIN_RE = /^[1-9]\d{5}$/; // Indian PIN: 6 digits, not starting with 0
export const PHONE_RE = /^(91)?[6-9]\d{9}$/; // Indian mobile, optional 91 country-code prefix
// Map a free-text (e.g. geocoded) state onto a canonical list entry.
export const matchState = (s?: string) => {
  const t = (s || '').toLowerCase().trim();
  if (!t) return '';
  return INDIAN_STATES.find(x => x.toLowerCase() === t)
    || INDIAN_STATES.find(x => t.includes(x.toLowerCase()) || x.toLowerCase().includes(t))
    || '';
};
