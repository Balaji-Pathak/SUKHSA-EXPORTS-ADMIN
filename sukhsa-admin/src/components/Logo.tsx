import Image from "next/image";
import logoSrc from "@/assets/brand/sukhsa-logo.png";

/**
 * The full Sukhsa Exports logo (monogram, name and tagline).
 *
 * Imported statically, so Next.js:
 *  - gives it a content-hashed URL, cached by browsers and Vercel's CDN for a year,
 *  - serves a resized AVIF/WebP copy at the size shown instead of the full PNG,
 *  - knows its width/height, so the page never jumps while it loads.
 * It sits on a white card so the black "Exports" text stays readable in dark mode.
 * (The small browser-tab icon is src/app/icon.png, the monogram only.)
 */
export function BrandLogo({
  width = 200,
  priority = false,
  compact = false,
  className = "",
}: {
  width?: number;
  priority?: boolean;
  /** Tighter padding for top bars. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-block border border-line bg-white shadow-sm ${compact ? "rounded-xl px-1.5 py-1" : "rounded-2xl px-3 py-2"} ${className}`}>
      <Image
        src={logoSrc}
        alt="Sukhsa Exports – Your Trade Partner From INDIA"
        sizes={`${width}px`}
        priority={priority}
        style={{ width, height: "auto" }}
      />
    </span>
  );
}

/** Top-bar logo: the full logo sized to fit the 64px bar (about 54px tall). */
export function Logo({ priority = false }: { priority?: boolean }) {
  return <BrandLogo width={96} compact priority={priority} className="block" />;
}
