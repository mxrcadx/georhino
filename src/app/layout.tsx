import type { Metadata } from 'next';
import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

export const metadata: Metadata = {
  title: 'GeoRhino — GIS to Rhino Site File Generator',
  description: 'Generate Rhino-compatible site plan files from free global GIS data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-geo-bg text-geo-text antialiased">
        {children}
      </body>
    </html>
  );
}
