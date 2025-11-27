import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { MentionSuggestions } from "./MentionSuggestions";
import { User } from "@communecter/cocolight-api-client";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionAdd?: (slug: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onMentionAdd,
  placeholder,
  disabled = false,
  rows = 6,
  className,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    onChange(newValue);
    setCursorPosition(cursorPos);

    // Détecter @mention
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowSuggestions(true);
      setSearchQuery(mentionMatch[1]);
      setMentionStartPos(cursorPos - mentionMatch[0].length);
    } else {
      setShowSuggestions(false);
      setSearchQuery("");
    }
  };

  const selectMention = (user: User) => {
    const beforeMention = value.substring(0, mentionStartPos);
    const afterCursor = value.substring(cursorPosition);
    const newValue = `${beforeMention}@${user.serverData.slug} ${afterCursor}`;

    onChange(newValue);
    setShowSuggestions(false);
    setSearchQuery("");

    // Notifier l'ajout de la mention
    onMentionAdd?.(user.serverData.slug);

    // Repositionner le curseur après le nom inséré
    const newCursorPos = beforeMention.length + user.serverData.slug.length + 2; // +2 pour @ et espace
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Fermer les suggestions si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Ne pas fermer si on clique sur une suggestion
      if (!target.closest('[data-radix-popper-content-wrapper]')) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSuggestions) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions]);

  return (
    <div className="relative">
      <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
        <PopoverAnchor>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className={className}
          />
        </PopoverAnchor>

        <PopoverContent
          className="w-80 p-0"
          side="top"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <MentionSuggestions
            query={searchQuery}
            onSelect={selectMention}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}