// Colour schemes. Index 0 is the default; players can cycle through the others on the title
// screen or while playing. The saved value is the index, so the order must never change.
export const SCHEMES = [
  { name: 'Default', stops: ['#15677c', '#0b3145', '#050f18'], text: '#eefaff' },
  { name: 'High contrast', stops: ['#000000', '#000000', '#000000'], text: '#ffffff', hc: true },
  { name: 'Ocean', stops: ['#1d4e7a', '#123556', '#0a1f36'], text: '#e8f4ff' },
  { name: 'Forest', stops: ['#1f5a44', '#153f30', '#0d2620'], text: '#eafaf1' },
  { name: 'Warm', stops: ['#6a3a2a', '#45261e', '#26150f'], text: '#fff1e6' },
  { name: 'Sunset', stops: ['#f97316', '#be185d', '#4c1d95'], text: '#fff7ed' },
  { name: 'Aurora', stops: ['#10b981', '#6d28d9', '#0f172a'], text: '#ecfdf5' },
  { name: 'Candy', stops: ['#ec4899', '#8b5cf6', '#3b0764'], text: '#fdf2f8' },
  { name: 'Midnight', stops: ['#1e3a8a', '#0f172a', '#020617'], text: '#dbeafe' },
  { name: 'Lavender', stops: ['#8b5cf6', '#5b21b6', '#2e1065'], text: '#f5f3ff' },
  { name: 'Rose', stops: ['#e11d48', '#9f1239', '#4c0519'], text: '#fff1f2' },
  { name: 'Teal', stops: ['#14b8a6', '#0f766e', '#042f2e'], text: '#f0fdfa' },
  { name: 'Gold', stops: ['#ca8a04', '#713f12', '#1c1917'], text: '#fefce8' },
  { name: 'Slate', stops: ['#64748b', '#334155', '#0f172a'], text: '#f1f5f9' },
];
