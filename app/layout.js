import './globals.css';

export const metadata = {
  title: 'Adrift — an ocean of unsent letters',
  description: 'Leave a thought in a bottle. Find a letter from someone, somewhere.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
