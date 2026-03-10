import Image from 'next/image';

export type EmotionType = 'neutral' | 'thinking' | 'satisfied' | 'skeptical' | 'angry' | 'impressed';

interface CharacterAvatarProps {
  emotion?: string; // 日本語が混ざる可能性があるので string で受け取る
}

export default function CharacterAvatar({ emotion = 'neutral' }: CharacterAvatarProps) {
  
  // 1. 日本語などをシステム用の英語名に変換する辞書
  const emotionMap: Record<string, EmotionType> = {
    "neutral": "neutral",
    "thinking": "thinking",
    "satisfied": "satisfied",
    "嬉しい": "satisfied",
    "喜び": "satisfied",
    "skeptical": "skeptical",
    "疑問": "skeptical",
    "angry": "angry",
    "怒り": "angry",
    "impressed": "impressed",
    "感銘": "impressed",
  };

  // 2. 変換後の安全な名前を決定する（辞書にない場合は neutral にする）
  const safeEmotion: EmotionType = emotionMap[emotion] || 'neutral';

  // 3. 設定の取得には、元の emotion ではなく「safeEmotion」を使う
  const emotionConfigs: Record<EmotionType, { bg: string; animation: string }> = {
    neutral:   { bg: 'bg-transparent', animation: '' },
    thinking:  { bg: 'bg-transparent', animation: 'animate-floating' },
    satisfied: { bg: 'bg-green-100/40', animation: '' },
    skeptical: { bg: 'bg-orange-100/40', animation: '' },
    angry:     { bg: 'bg-red-100/40',    animation: 'animate-shake' },
    impressed: { bg: 'bg-yellow-100/40', animation: '' },
  };

  const config = emotionConfigs[safeEmotion];

  return (
    <div className={`w-full flex justify-center p-4 transition-colors duration-300 ${config.bg}`}>
      <div className={`relative w-full h-48 md:h-60 transition-all duration-300 ${config.animation}`}>
        <Image
          // 画像ファイル名も変換後の safeEmotion を使う
          src={`/characters/${safeEmotion}.png`}
          alt={`Character emotion: ${safeEmotion}`}
          fill
          priority
          className="object-contain"
        />
      </div>
    </div>
  );
}