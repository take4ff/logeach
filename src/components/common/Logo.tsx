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
  // サイズごとの幅と高さの定義（元画像の比率を維持）
  // 提供された画像は約 900x500 なので、1.8:1 程度の比率
  const dimensions = {
    small: { width: 120, height: 60 },
    medium: { width: 180, height: 90 },
    large: { width: 300, height: 150 },
  };

  const { width, height } = dimensions[size];

  const content = (
    <div className={`relative flex items-center justify-center ${className}`}>
      <Image
        src="/logo.png"
        alt="Logeach Logo"
        width={width}
        height={height}
        priority
        className="object-contain"
      />
    </div>
  );

  if (withLink) {
    return <Link href="/">{content}</Link>;
  }

  return content;
}
