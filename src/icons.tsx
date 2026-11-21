import {
  Anchor, Book, Building2, Castle, Church, Coins, Compass, Crown, Dices, Feather, FileText, Flag, Flame, Gem,
  Hammer, Heart, Hourglass, Key, Landmark, Languages, Leaf, MapPin, Moon, Mountain, PawPrint, Scroll, Shield,
  Ship, Skull, Sparkles, StickyNote, Sun, Swords, Telescope, Trees, User, Users, Wand2, Zap, Bug,
  type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  User, Users, MapPin, Shield, PawPrint, Church, Gem, Swords, Sparkles, Languages, Scroll, FileText, Flag, Dices,
  StickyNote, Castle, Landmark, Crown, Skull, Ship, Mountain, Trees, Flame, Book, Compass, Wand2, Hammer, Feather,
  Anchor, Moon, Sun, Building2, Coins, Heart, Zap, Hourglass, Telescope, Key, Bug, Leaf,
};

export function TemplateIcon({ name, size = 16, color }: { name?: string; size?: number; color?: string }) {
  const Icon = (name && ICONS[name]) || StickyNote;
  return <Icon size={size} color={color} aria-hidden />;
}
