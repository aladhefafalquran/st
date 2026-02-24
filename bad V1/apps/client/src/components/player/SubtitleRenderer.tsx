interface SubtitleRendererProps {
  text: string | null;
}

export function SubtitleRenderer({ text }: SubtitleRendererProps) {
  if (!text) return null;

  return (
    <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-4">
      <div
        className="bg-black/75 text-white text-base sm:text-lg px-3 py-1.5 rounded text-center max-w-3xl leading-relaxed"
        style={{ textShadow: '1px 1px 2px black' }}
        dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br/>') }}
      />
    </div>
  );
}
