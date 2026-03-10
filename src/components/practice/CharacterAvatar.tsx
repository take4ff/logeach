import Image from 'next/image';

export default function CharacterAvatar() {
  return (
    <div className="w-full flex justify-center bg-gray-50 rounded-lg p-4">
      <div className="relative w-full h-48 md:h-64">
        <Image
          src="/characters/default.png"
          alt="Character Avatar"
          fill
          priority
          className="object-contain"
        />
      </div>
    </div>
  );
}