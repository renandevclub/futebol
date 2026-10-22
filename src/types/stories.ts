export type StoryMediaType = 'image' | 'video';

export type OverlayStyle = 'solid' | 'neon' | 'pill' | 'outline' | 'gradient';

export interface StoryOverlay {
  id: string;
  type: 'text' | 'sticker';
  text?: string;
  color?: string;
  bgColor?: string;
  style?: OverlayStyle;
  fontSize?: number;
  sticker?: string;
  label?: string;
  x: number; // Porcentagem do topo/esquerda (0 a 100)
  y: number;
  rotation?: number;
}

export interface StoryMetadata {
  overlays?: StoryOverlay[];
  [key: string]: any;
}

export interface Story {
  id: string;
  author_id: string;
  organization_id?: string | null;
  media_url: string;
  media_type: StoryMediaType;
  caption?: string | null;
  duration_seconds: number;
  created_at: string;
  expires_at: string;
  is_deleted?: boolean;
  views_count?: number;
  likes_count?: number;
  is_viewed?: boolean;
  is_liked?: boolean;
  metadata?: StoryMetadata | null;
  author?: {
    id: string;
    nome: string;
    apelido?: string | null;
    avatar_url?: string | null;
  };
}

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorApelido?: string | null;
  authorAvatar?: string | null;
  hasUnviewed: boolean;
  stories: Story[];
  lastStoryCreatedAt: string;
  isCurrentUser?: boolean;
}

export interface StoryViewer {
  viewer_id: string;
  viewer_nome: string;
  viewer_apelido?: string | null;
  viewer_avatar?: string | null;
  viewed_at: string;
  has_liked?: boolean;
}

export interface CreateStoryPayload {
  file: File;
  caption?: string;
  durationSeconds?: number;
  organizationId?: string | null;
  overlays?: StoryOverlay[];
}
