"use client";

import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "small" | "medium" | "large";
  className?: string;
  withLink?: boolean;
}

/**
 * Logeach ロゴコンポーネント
 * public/logo.png を使用して表示します。
 * height を固定し、width は画像の縦横比に合わせて自動調整されます。
 */
export default function Logo({ size = "medium", className = "", withLink = true }: LogoProps) {
  // 高さだけ決めておき、幅は auto で縦横比を維持
  const heights = {
    small:  48,
    medium: 72,
    large:  70,
  };

  const h = heights[size];

  const img = (
    <div className={`flex items-center justify-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Logeach Logo"
        style={{ height: h, width: "auto" }}
        className="object-contain"
      />
    </div>
  );

  return withLink ? <Link href="/">{img}</Link> : img;
}
