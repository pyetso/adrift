import './globals.css';

export const metadata = {
  title: 'adrift',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
