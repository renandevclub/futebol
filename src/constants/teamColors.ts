export interface TeamColor {
  name: string;
  color: string;
  border: string;
  lightBg: string;
  text: string;
  emoji: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { name: 'Time A', color: 'bg-red-500', border: 'border-red-400', lightBg: 'bg-red-500/10', text: 'text-red-500', emoji: '🔴' },
  { name: 'Time B', color: 'bg-blue-500', border: 'border-blue-400', lightBg: 'bg-blue-500/10', text: 'text-blue-500', emoji: '🔵' },
  { name: 'Time C', color: 'bg-green-500', border: 'border-green-400', lightBg: 'bg-green-500/10', text: 'text-green-500', emoji: '🟢' },
  { name: 'Time D', color: 'bg-yellow-500', border: 'border-yellow-400', lightBg: 'bg-yellow-500/10', text: 'text-yellow-500', emoji: '🟡' },
  { name: 'Time E', color: 'bg-purple-500', border: 'border-purple-400', lightBg: 'bg-purple-500/10', text: 'text-purple-500', emoji: '🟣' },
  { name: 'Time F', color: 'bg-orange-500', border: 'border-orange-400', lightBg: 'bg-orange-500/10', text: 'text-orange-500', emoji: '🟠' },
  { name: 'Time G', color: 'bg-pink-500', border: 'border-pink-400', lightBg: 'bg-pink-500/10', text: 'text-pink-500', emoji: '🩷' },
  { name: 'Time H', color: 'bg-cyan-500', border: 'border-cyan-400', lightBg: 'bg-cyan-500/10', text: 'text-cyan-500', emoji: '🩵' },
  { name: 'Time I', color: 'bg-indigo-500', border: 'border-indigo-400', lightBg: 'bg-indigo-500/10', text: 'text-indigo-500', emoji: '💜' },
  { name: 'Time J', color: 'bg-teal-500', border: 'border-teal-400', lightBg: 'bg-teal-500/10', text: 'text-teal-500', emoji: '💚' },
];
