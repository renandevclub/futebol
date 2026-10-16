export type UserRole = 'player' | 'admin' | 'super_admin' | 'participant';

export type SportType = 'futebol' | 'volei';

export type FutebolPosition =
  | 'Goleiro'
  | 'Zagueiro'
  | 'Lateral'
  | 'Volante'
  | 'Meia'
  | 'Ponta'
  | 'Atacante';

export type FutebolDominantFoot = 'Destro' | 'Canhoto' | 'Ambidestro';

export type VoleiPosition =
  | 'Levantador'
  | 'Oposto'
  | 'Ponteiro'
  | 'Central'
  | 'Líbero'
  | 'Outra';

export type VoleiDominantHand = 'Destro' | 'Canhoto' | 'Ambidestro' | 'Direita' | 'Esquerda';

export interface Profile {
  id: string;
  auth_id?: string | null;
  nome: string;
  apelido?: string | null;
  whatsapp?: string | null;
  genero?: 'masculino' | 'feminino' | null;
  role: UserRole;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  cidade?: string | null;
  // Compatibilidade legada e Futebol
  posicao?: FutebolPosition | null;
  pe_dominante?: FutebolDominantFoot | null;
  // Estrutura multi-esportiva
  sport_types?: SportType[] | null;
  futebol_position?: FutebolPosition | null;
  futebol_dominant_foot?: FutebolDominantFoot | null;
  volei_position?: VoleiPosition | null;
  volei_dominant_hand?: VoleiDominantHand | null;
  time_coracao?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  cargo?: string | null;
  is_private?: boolean;
  can_create_leagues?: boolean;
  level?: string;
  nivel_qualidade?: number | null;
  last_activity?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id?: string | null;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: {
    old_role?: string;
    new_role?: string;
    target_name?: string;
    actor_name?: string;
    target_whatsapp?: string;
    [key: string]: any;
  } | null;
  created_at: string;
  user?: Profile;
}

export type PostVisibility = 'publica' | 'participantes' | 'amigos' | 'privada';

export interface Post {
  id: string;
  author_id: string;
  target_user_id?: string | null;
  texto?: string | null;
  imagem_url?: string | null;
  video_url?: string | null;
  visibilidade?: PostVisibility;
  location?: string | null;
  tagged_user_ids?: string[];
  original_post_id?: string | null;
  created_at: string;
  author?: Profile;
  target_user?: Profile;
  original_post?: Post;
  comments_count?: number;
  reactions_count?: number;
  shares_count?: number;
  user_reaction?: ReactionType | null;
}

export type ReactionType = 'like' | 'love' | 'strength' | 'congrats' | 'sad';

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  type: ReactionType;
  created_at: string;
  user?: Profile;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string | null;
  comentario: string;
  imagem_url?: string | null;
  created_at: string;
  user?: Profile;
  likes_count?: number;
  is_liked?: boolean;
  replies?: Comment[];
}

export interface CommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface Share {
  id: string;
  post_id: string;
  user_id: string;
  target_type: 'wall' | 'friend_wall' | 'main_feed';
  target_user_id?: string | null;
  created_at: string;
  post?: Post;
  user?: Profile;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'accepted';
  created_at: string;
  friend?: Profile;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

export interface Follower {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
  follower?: Profile;
  following?: Profile;
}

export interface Album {
  id: string;
  user_id: string;
  title: string;
  category: 'partidas' | 'pessoais' | 'campeoes' | 'videos';
  created_at: string;
  images_count?: number;
}

export interface AlbumImage {
  id: string;
  album_id: string;
  image_url?: string | null;
  video_url?: string | null;
  created_at: string;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface TimelineEvent {
  id: string;
  user_id: string;
  event_type: 'join_match' | 'confirm_presence' | 'became_mvp' | 'became_champion' | 'posted_photo' | 'posted_video' | 'earned_badge';
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  user?: Profile;
}

export interface LocationItem {
  id: string;
  nome: string;
  endereco?: string | null;
  maps_url?: string | null;
  created_at?: string;
}

export interface League {
  id: string;
  name: string;
  slug: string;
  sport_type?: SportType;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  chave_pix_padrao?: string | null;
  nome_recebedor_pix?: string | null;
  organizer_whatsapp?: string | null;
  plan_id?: string | null;
  owner_id?: string | null;
  access_password?: string | null;
  has_password?: boolean;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  caixinha_name?: string | null;
  caixinha_description?: string | null;
  created_at: string;
  updated_at?: string | null;
  owner?: Profile | null;
  admins?: Profile[] | null;
  matches_count?: number;
}

export type Organization = League;

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'moderator' | 'player' | 'member';
  nivel_qualidade?: number | null;
  created_at: string;
  user?: Profile;
  organization?: League;
}

export interface Match {
  id: string;
  titulo: string;
  local: string;
  sport_type?: SportType;
  endereco?: string | null;
  maps_url?: string | null;
  location_id?: string | null;
  organization_id?: string | null;
  data: string;
  horario: string;
  valor: number;
  custo_aluguel?: number | null;
  limite_participantes: number;
  num_times: number;
  jogadores_por_time: number;
  min_mulheres_por_time?: number | null;
  max_homens_por_time?: number | null;
  max_mulheres_por_time?: number | null;
  sorteio_raspadinha_ativo?: boolean;
  observacoes?: string | null;
  chave_pix?: string | null;
  nome_recebedor_pix?: string | null;
  organizer_whatsapp?: string | null;
  match_rules?: {
    track_assists?: boolean;
    track_cards?: boolean;
    stage_duration_minutes?: number;
    stages_count?: number;
    halftime_interval_minutes?: number;
  } | null;
  teams_custom_config?: (Record<string | number, { name: string; colorId: string; emoji?: string; badge_url?: string | null }> & {
    gender_limits?: {
      max_homens_por_time?: number | null;
      max_mulheres_por_time?: number | null;
    };
  }) | null;
  status: 'agendada' | 'em_andamento' | 'finalizada' | 'cancelada';
  created_at: string;
  participants_count?: number;
  is_user_joined?: boolean;
  organization?: League | null;
  mvp_player_id?: string | null;
  aninga_player_id?: string | null;
  mvp_notes?: string | null;
  aninga_notes?: string | null;
  mvp_player?: Profile | null;
  aninga_player?: Profile | null;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  user_id: string;
  team?: number | null;
  paid?: boolean;
  paid_at?: string | null;
  payment_proof_url?: string | null;
  payment_status?: 'pending' | 'waiting_approval' | 'approved' | 'rejected' | null;
  amount_informed?: number | null;
  amount_confirmed?: number | null;
  credit_destination?: 'wallet' | 'caixinha' | null;
  payment_method?: 'pix' | 'wallet' | 'cash' | 'admin' | null;
  is_mvp?: boolean;
  is_aninga?: boolean;
  created_at: string;
  user?: Profile;
  match?: Match;
}

export interface LeaguePlayerRanking {
  user_id: string;
  user: Profile;
  matches_played: number;
  // Futebol
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  // Vôlei
  points: number;
  aces: number;
  blocks: number;
  // Destaques da Rodada
  mvp_count: number; // Melhor da Partida 🏆
  aninga_count: number; // Pior da Partida (ANINGA 🐍)
  // Desempenho e Vitórias
  wins: number;
  draws: number;
  losses: number;
  goals_per_match?: number;
  points_per_match?: number;
}

export interface MatchExpense {
  id: string;
  match_id: string;
  descricao: string;
  valor: number;
  created_at: string;
}

export interface UserStats {
  matches_played: number;
  wins: number;
  losses: number;
  mvp_count: number;
  average_score: number;
  win_streak: number;
  monthly_frequency: number;
  total_time_played: string;
  total_paid: number;
  championships_won: number;
  gols?: number;
  pontos?: number;
  assistencias?: number;
  paid_matches_count?: number;
}

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export type NotificationCategory = 'matches' | 'payments' | 'teams' | 'feed' | 'system';

export type NotificationType =
  | 'match_created'
  | 'match_update'
  | 'match_cancelled'
  | 'match_reminder'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'player_joined'
  | 'player_left'
  | 'waitlist_promoted'
  | 'teams_drawn'
  | 'team_assigned'
  | 'game_started'
  | 'goal_scored'
  | 'champion_declared'
  | 'comment'
  | 'post_reaction'
  | 'friend_request'
  | 'badge_earned'
  | 'role_updated'
  | 'system_announcement'
  | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  read_at?: string | null;
  expires_at?: string | null;
  idempotency_key?: string | null;
  organization_id?: string | null;
  created_at: string;
  metadata?: Record<string, any> | null;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserNotificationPreferences {
  user_id: string;
  in_app_matches: boolean;
  in_app_payments: boolean;
  in_app_teams: boolean;
  in_app_feed: boolean;
  in_app_system: boolean;
  push_matches: boolean;
  push_payments: boolean;
  push_teams: boolean;
  push_feed: boolean;
  push_system: boolean;
  updated_at: string;
}

export type GameStatus = 'not_started' | 'in_progress' | 'paused' | 'finished';

export interface MatchGame {
  id: string;
  match_id: string;
  game_number: number;
  team_a: number;
  team_b: number;
  score_a: number;
  score_b: number;
  status: GameStatus;
  two_goals_rule: boolean;
  target_duration_minutes: number;
  duration_seconds: number;
  timer_started_at?: string | null;
  timer_is_running: boolean;
  winner_team?: number | null;
  is_draw: boolean;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  goals?: MatchGameGoal[];
}

export interface MatchGameGoal {
  id: string;
  game_id: string;
  match_id: string;
  team: number;
  player_id?: string | null;
  assist_player_id?: string | null;
  minute: number;
  point_type?: 'goal' | 'point' | 'card' | string;
  card_type?: 'yellow' | 'red' | null;
  point_number?: number;
  created_at: string;
  player?: Profile;
  assist_player?: Profile;
}

export interface TeamStanding {
  team: number;
  teamName: string;
  teamColor: string;
  teamEmoji: string;
  teamBadgeUrl?: string | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface PlayerScorer {
  playerId: string;
  player: Profile;
  team: number;
  goalsCount: number;
  pointsCount?: number;
  sportType?: SportType;
}

export interface MatchGameCard {
  id: string;
  game_id: string;
  match_id: string;
  team: number;
  player_id?: string | null;
  card_type: 'yellow' | 'red';
  minute: number;
  created_at: string;
  player?: Profile;
}

// ==========================================
// 🏆 SISTEMA DE TORNEIOS E CAMPEONATOS
// ==========================================

export type TournamentFormat = 'round_robin' | 'knockout';
export type TournamentStatus = 'registration_open' | 'registration_closed' | 'in_progress' | 'finished';

export interface Tournament {
  id: string;
  league_id: string;
  name: string;
  description?: string | null;
  sport_type: SportType;
  start_date?: string | null;
  end_date?: string | null;
  max_teams: number;
  players_per_team: number;
  format: TournamentFormat;
  entry_fee: number;
  society_cost: number;
  rules?: string | null;
  status: TournamentStatus;
  champion_team_id?: string | null;
  runner_up_team_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  league?: League;
  champion_team?: TournamentTeam | null;
  runner_up_team?: TournamentTeam | null;
  teams?: TournamentTeam[];
  teams_count?: number;
  matches_count?: number;
}

export type TournamentTeamRegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type TournamentTeamPaymentStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  league_id: string;
  name: string;
  badge_url?: string | null;
  color: string;
  coach_id: string;
  registration_status: TournamentTeamRegistrationStatus;
  payment_status: TournamentTeamPaymentStatus;
  payment_amount: number;
  payment_proof_url?: string | null;
  payment_notes?: string | null;
  rejection_reason?: string | null;
  registered_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  coach?: Profile;
  tournament?: Tournament;
  players?: TournamentTeamPlayer[];
  players_count?: number;
}

export interface TournamentTeamPlayer {
  id: string;
  tournament_id: string;
  tournament_team_id: string;
  user_id: string;
  number?: number | null;
  position?: string | null;
  is_captain: boolean;
  created_at: string;
  user?: Profile;
  team?: TournamentTeam;
}

export type TournamentMatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'cancelled';

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  league_id: string;
  phase: string;
  round_number: number;
  bracket_match_number?: number | null;
  next_match_id?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
  home_score: number;
  away_score: number;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
  winner_team_id?: string | null;
  match_date?: string | null;
  match_time?: string | null;
  location?: string | null;
  status: TournamentMatchStatus;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  home_team?: TournamentTeam | null;
  away_team?: TournamentTeam | null;
  winner_team?: TournamentTeam | null;
  events?: TournamentMatchEvent[];
}

export type TournamentMatchEventType = 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'point';

export interface TournamentMatchEvent {
  id: string;
  tournament_match_id: string;
  team_id: string;
  player_id?: string | null;
  assist_player_id?: string | null;
  event_type: TournamentMatchEventType;
  minute?: number | null;
  created_at: string;
  player?: Profile | null;
  assist_player?: Profile | null;
  team?: TournamentTeam | null;
}

export interface TournamentStandingRow {
  team_id: string;
  team_name: string;
  team_badge?: string | null;
  team_color: string;
  coach_name?: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface TournamentFinancialSummary {
  teams_count: number;
  entry_fee_per_team: number;
  total_collected: number;
  society_cost: number;
  prize_pool: number;
  paid_amount: number;
  pending_amount: number;
  net_balance: number;
}

export * from './finance';


