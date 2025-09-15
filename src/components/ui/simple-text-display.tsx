interface SimpleTextDisplayProps {
  text: string;
}

export function SimpleTextDisplay({ text }: SimpleTextDisplayProps) {
  if (!text) return null;

  // Remove any image tags to display clean text only
  const cleanText = text
    .replace(/\[IMAGE:[^\]]+\]/g, '') // Remove new format [IMAGE:id]
    .replace(/\[IMAGE:[^|]+\|[^\]]+\]/g, '') // Remove legacy format [IMAGE:url|description]
    .trim();

  return (
    <div className=" text-sm sm:text-base leading-relaxed">
      {cleanText.split('\n').map((line, index) => (
        <p key={index} className="whitespace-pre-wrap">
          {line}
        </p>
      ))}
    </div>
  );
}
