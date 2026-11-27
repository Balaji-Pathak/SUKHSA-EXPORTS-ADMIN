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
  className = "",
}: {
  width?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-block rounded-2xl border border-line bg-white px-3 py-2 shadow-sm ${className}`}>
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

/** Header logo: the full logo at header size. */
export function Logo({ priority = false }: { priority?: boolean }) {
  return <BrandLogo width={150} priority={priority} />;
}
