import { supabase } from '@/src/lib/supabase';

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
    satisfied: { bg: 'bg-green-100/60', animation: '' }, // 薄いグリーン
    skeptical: { bg: 'bg-orange-100/60', animation: '' }, // 薄いオレンジ
    angry:     { bg: 'bg-red-100/60',    animation: 'animate-shake' }, // 薄いレッド + 振動
    impressed: { bg: 'bg-yellow-100/60', animation: '' }, // 薄いゴールド系
  };

  const config = emotionConfigs[safeEmotion];

  // 4. SupabaseのPublic URLを取得する
  const { data } = supabase.storage.from('avatars').getPublicUrl(`default/${safeEmotion}.png`);
  const avatarUrl = data?.publicUrl || `/characters/${safeEmotion}.png`;

  return (
    <div className={`w-full flex justify-center p-4 transition-colors duration-300 ${config.bg}`}>
      <div className={`relative w-full h-20 sm:h-28 md:h-36 lg:h-44 xl:h-52 max-h-[22vh] transition-all duration-300 ${config.animation}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={`Character emotion: ${safeEmotion}`}
          className="object-contain w-full h-full"
          onError={(e) => {
              // URLが間違っていた場合やバケットが存在しない場合はローカル画像にフォールバック
              e.currentTarget.src = `/characters/${safeEmotion}.png`;
          }}
        />
      </div>
    </div>
  );
}