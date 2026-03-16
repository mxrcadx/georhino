'use client';

export function Header() {
  return (
    <header className="h-14 bg-geo-surface border-b border-geo-border flex items-center px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-geo-accent rounded-lg flex items-center justify-center text-white font-bold text-sm">
          GR
        </div>
        <div>
          <h1 className="text-sm font-semibold text-geo-text leading-none">GeoRhino</h1>
          <p className="text-[10px] text-geo-text-muted leading-none mt-0.5">GIS to Rhino Site File Generator</p>
        </div>
      </div>
    </header>
  );
}
