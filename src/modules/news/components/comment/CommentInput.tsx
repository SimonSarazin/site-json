import { useState } from "react";
import { Send, SmilePlus } from "lucide-react";
import { useLocalization } from "@/hooks/useLocalization";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";

interface CommentInputProps {
  userPhoto?: string;
  userName: string;
  placeholder: string;
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
  size?: "default" | "small";
  disabled?: boolean;
  initialValue?: string;
}

export function CommentInput({
  userPhoto,
  userName,
  placeholder,
  onSubmit,
  autoFocus = false,
  size = "default",
  disabled = false,
  initialValue = "",
}: CommentInputProps) {
  const { currentLocale } = useLocalization();
  const { theme } = useTheme();
  const [text, setText] = useState(initialValue);
  const [openEmojiPicker, setOpenEmojiPicker] = useState(false);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
      setText("");
      setOpenEmojiPicker(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setOpenEmojiPicker(false);
  };

  const isSmall = size === "small";
  const avatarSize = isSmall ? "size-10" : "md:size-12 size-8";
  const buttonSize = isSmall ? "size-6" : "size-8";
  const iconSize = isSmall ? "w-3 h-3" : "w-4 h-4";
  const textSize = isSmall ? "text-xs" : "md:text-sm text-xs";
  const padding = isSmall ? "pl-2" : "md:pl-4 pl-2";

  return (
    <div className={`w-full flex ${isSmall ? "px-3 py-3" : "px-5 py-5 md:px-5 md:py-5"}`}>
      <Avatar className={`${avatarSize} shrink-0`}>
        {userPhoto ? (
          <AvatarImage src={userPhoto} alt={userName} />
        ) : null}
        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-bold">
          {userName.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className={`relative ${padding} w-full`}>
        <div className="flex items-center bg-muted rounded-xl shadow-sm p-1">
          <div className="relative w-full">
            <Textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              autoFocus={autoFocus}
              disabled={disabled}
              className={`bg-transparent no-scrollbar border-0 shadow-none font-normal md:pl-5 pl-2 md:px-4 px-0 py-2 ${textSize} focus-visible:ring-0 p-3 md:pr-4 pr-1 mt-1 min-h-0 h-auto rounded-xl resize-none`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && text.trim() && !disabled) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
          <div className={`flex ${isSmall ? "space-x-1" : "space-x-2"} text-muted-foreground justify-center items-center mx-2`}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!text.trim() || disabled}
              aria-label="Send comment"
              onClick={handleSubmit}
              className={`transition-colors ${isSmall ? "" : "mr-1"} ${buttonSize} ${
                text.trim()
                  ? 'text-blue-500 hover:text-blue-600'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <Send className={iconSize} />
            </Button>
            <Popover open={openEmojiPicker} onOpenChange={setOpenEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={buttonSize}
                >
                  <SmilePlus className={`${iconSize} text-muted-foreground`} />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-auto p-0 border-0"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                  width={isSmall ? 300 : 320}
                  height={isSmall ? 350 : 400}
                  searchPlaceHolder={currentLocale === "fr" ? "Rechercher..." : "Search..."}
                  previewConfig={{ showPreview: false }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}