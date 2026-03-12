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
 * 提供されたロゴ画像を表示します。
 */
export default function Logo({ size = "medium", className = "", withLink = true }: LogoProps) {
  // 高さだけ決めておき、幅は auto で縦横比を維持
  const heights = {
    small:  24,
    medium: 72,
    large:  70, // ユーザーの要望で少し小さくしたもの
  };

  const h = heights[size];

  const content = (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Logeach Logo"
        style={{ height: h, width: "auto" }}
        className="object-contain"
      />
    </div>
  );

  if (withLink) {
    return <Link href="/">{content}</Link>;
  }

  return content;
}
