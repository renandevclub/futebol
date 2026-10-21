import { createNotification, createBatchNotifications } from '@/lib/notifications';
import { Match, Profile } from '@/types/database';

/**
 * Despachante Centralizado de Notificações do F&V Sports
 */

// 1. Partida Criada -> Notificar todos os jogadores cadastrados no sistema / liga
export async function notifyMatchCreated(match: Match, allPlayerIds: string[]) {
  if (!allPlayerIds || allPlayerIds.length === 0) return;
  const isVolei = match.sport_type === 'volei' || match.organization?.sport_type === 'volei';
  const icon = isVolei ? '🏐' : '⚽';
  const dateFormatted = match.data.split('-').reverse().join('/');
  const leaguePrefix = match.organization?.name ? `[${match.organization.name}] ` : '';

  return createBatchNotifications(allPlayerIds, {
    type: 'match_created',
    category: 'matches',
    priority: 'normal',
    title: `${icon} Nova Partida: ${leaguePrefix}${match.titulo}`,
    message: `A resenha ${leaguePrefix ? `da ${match.organization?.name} ` : ''}está marcada para ${dateFormatted} às ${match.horario.substring(0, 5)} no ${match.local}. Garanta sua vaga!`,
    link: `/matches/${match.id}`,
    idempotencyKey: `match_created_${match.id}`,
    metadata: { match_id: match.id, organization_id: match.organization_id },
  });
}

// 2. Partida Atualizada -> Notificar participantes inscritos
export async function notifyMatchUpdated(match: Match, participantIds: string[], changesDescription?: string) {
  if (!participantIds || participantIds.length === 0) return;
  const isVolei = match.sport_type === 'volei' || match.organization?.sport_type === 'volei';
  const icon = isVolei ? '🏐' : '⚽';
  const dateFormatted = match.data ? match.data.split('-').reverse().join('/') : '';
  const timeFormatted = match.horario ? match.horario.substring(0, 5) : '';
  const leaguePrefix = match.organization?.name ? `[${match.organization.name}] ` : '';

  return createBatchNotifications(participantIds, {
    type: 'match_update',
    category: 'matches',
    priority: 'high',
    title: `⚠️ Partida Alterada: ${leaguePrefix}${match.titulo}`,
    message: changesDescription || `A partida (${isVolei ? 'Vôlei' : 'Futebol'}) foi atualizada para ${dateFormatted} às ${timeFormatted} no ${match.local}.`,
    link: `/matches/${match.id}`,
    metadata: { match_id: match.id, organization_id: match.organization_id },
  });
}

// 3. Partida Cancelada -> Notificar participantes inscritos
export async function notifyMatchCancelled(match: Match, participantIds: string[], reason?: string) {
  if (!participantIds || participantIds.length === 0) return;
  return createBatchNotifications(participantIds, {
    type: 'match_cancelled',
    category: 'matches',
    priority: 'critical',
    title: `🚨 Partida Cancelada: ${match.titulo}`,
    message: reason || `A partida marcada para o ${match.local} foi cancelada pelo organizador.`,
    link: `/matches/${match.id}`,
    metadata: { match_id: match.id },
  });
}

// 4. Inscrição Confirmada -> Notificar o próprio participante
export async function notifyPlayerJoined(match: Match, userId: string) {
  const isVolei = match.sport_type === 'volei' || match.organization?.sport_type === 'volei';
  const icon = isVolei ? '🏐' : '⚽';
  return createNotification({
    userId,
    type: 'player_joined',
    category: 'matches',
    priority: 'normal',
    title: `Inscrição Confirmada! ${icon}`,
    message: `Sua vaga para a partida "${match.titulo}" foi confirmada com sucesso. Bom jogo!`,
    link: `/matches/${match.id}`,
    idempotencyKey: `join_${match.id}_${userId}`,
    metadata: { match_id: match.id },
  });
}

// 5. Inscrição Cancelada -> Notificar o próprio participante
export async function notifyPlayerLeft(match: Match, userId: string) {
  return createNotification({
    userId,
    type: 'player_left',
    category: 'matches',
    priority: 'normal',
    title: 'Inscrição Cancelada',
    message: `Você cancelou sua presença na partida "${match.titulo}".`,
    link: `/matches/${match.id}`,
    idempotencyKey: `leave_${match.id}_${userId}`,
    metadata: { match_id: match.id },
  });
}

// 6. Pagamento Confirmado -> Notificar o participante
export async function notifyPaymentConfirmed(match: Match | { id?: string; titulo: string }, userId: string, amountFormatted?: string) {
  return createNotification({
    userId,
    type: 'payment_confirmed',
    category: 'payments',
    priority: 'normal',
    title: 'Pagamento Confirmado! 💵',
    message: amountFormatted
      ? `Seu pagamento de ${amountFormatted} para "${match.titulo}" foi aprovado pelo organizador. Bom jogo!`
      : `Seu pagamento para a partida "${match.titulo}" foi aprovado pelo organizador. Bom jogo!`,
    link: match.id ? `/matches/${match.id}` : undefined,
    idempotencyKey: match.id ? `pay_confirm_${match.id}_${userId}_${Date.now()}` : undefined,
    metadata: { match_id: match.id },
  });
}

// 7. Pagamento Recusado -> Notificar o participante
export async function notifyPaymentRejected(match: Match | { id?: string; titulo: string }, userId: string, reason?: string) {
  return createNotification({
    userId,
    type: 'payment_rejected',
    category: 'payments',
    priority: 'high',
    title: 'Pagamento Não Aprovado ⚠️',
    message: reason
      ? `Seu comprovante para "${match.titulo}" não foi aprovado: ${reason}`
      : `O comprovante para a partida "${match.titulo}" não pôde ser validado. Por favor, reenvie o comprovante.`,
    link: match.id ? `/matches/${match.id}` : undefined,
    metadata: { match_id: match.id, reason },
  });
}

// 8. Sorteio de Times / Raspadinha Liberada -> Notificar todos os participantes
export async function notifyTeamsDrawn(match: Match, participantIds: string[]) {
  if (!participantIds || participantIds.length === 0) return;
  return createBatchNotifications(participantIds, {
    type: 'teams_drawn',
    category: 'teams',
    priority: 'high',
    title: '🎲 Times Sorteados! Raspadinha Liberada!',
    message: `Os times da partida "${match.titulo}" foram definidos! Abra o app para raspar e descobrir seu time.`,
    link: `/matches/${match.id}`,
    idempotencyKey: `teams_drawn_${match.id}_${Date.now()}`,
    metadata: { match_id: match.id },
  });
}

// 9. Início de Jogo na Quadra -> Notificar participantes
export async function notifyGameStarted(match: Match, gameNumber: number, teamAName: string, teamBName: string, participantIds: string[]) {
  if (!participantIds || participantIds.length === 0) return;
  const isVolei = match.sport_type === 'volei' || match.organization?.sport_type === 'volei';
  return createBatchNotifications(participantIds, {
    type: 'game_started',
    category: 'teams',
    priority: 'normal',
    title: `⏱️ Jogo ${gameNumber} Iniciado!`,
    message: `Bola em jogo entre ${teamAName} e ${teamBName} (${isVolei ? 'Vôlei' : 'Futebol'}) na partida "${match.titulo}". Acompanhe o placar ao vivo!`,
    link: `/matches/${match.id}/tv`,
    metadata: { match_id: match.id, game_number: gameNumber },
  });
}

// 10. Gol / Ponto Marcado -> Notificar participantes e autor
export async function notifyGoalScored(match: Match, scorer: Profile, teamName: string, participantIds: string[], isVolei = false) {
  if (!scorer || !participantIds || participantIds.length === 0) return;
  const scorerName = scorer.apelido || scorer.nome;
  const actionText = isVolei ? `marcou um ponto de destaque` : `balançou as redes`;
  const icon = isVolei ? '🏐 Ponto!' : '⚽ GOOOL!';

  return createBatchNotifications(participantIds, {
    type: 'goal_scored',
    category: 'teams',
    priority: 'normal',
    title: `${icon} ${scorerName}`,
    message: `${scorerName} ${actionText} para o ${teamName} em "${match.titulo}"!`,
    link: `/matches/${match.id}/tv`,
    metadata: { match_id: match.id, scorer_id: scorer.id },
  });
}

// 11. Time Campeão Consagrado -> Notificar todos os participantes
export async function notifyChampionDeclared(match: Match, championTeamName: string, participantIds: string[]) {
  if (!participantIds || participantIds.length === 0) return;
  return createBatchNotifications(participantIds, {
    type: 'champion_declared',
    category: 'teams',
    priority: 'high',
    title: `🏆 ${championTeamName} é o Campeão!`,
    message: `Parabéns ao ${championTeamName} pela grande conquista na partida "${match.titulo}"! Confira a classificação final.`,
    link: `/matches/${match.id}`,
    idempotencyKey: `champion_${match.id}`,
    metadata: { match_id: match.id },
  });
}

// 12. Novo Comentário no Post -> Notificar o autor do post
export async function notifyPostComment(postAuthorId: string, commentAuthorName: string, commentSnippet: string, postId: string) {
  return createNotification({
    userId: postAuthorId,
    type: 'comment',
    category: 'feed',
    priority: 'normal',
    title: `💬 Novo comentário de ${commentAuthorName}`,
    message: `"${commentSnippet.substring(0, 80)}${commentSnippet.length > 80 ? '...' : ''}"`,
    link: `/?post=${postId}`,
    metadata: { post_id: postId },
  });
}

// 12b. Nova Publicação na Liga -> Notificar todos os participantes da liga (exceto o autor)
export async function notifyNewPost(
  postId: string,
  authorName: string,
  snippet: string,
  leagueId: string,
  leagueName: string,
  memberIds: string[],
  authorId: string,
) {
  // Filtrar para não notificar o próprio autor
  const recipientIds = memberIds.filter((id) => id !== authorId);
  if (recipientIds.length === 0) return;

  return createBatchNotifications(recipientIds, {
    type: 'comment', // Reusa tipo 'comment' que já é da categoria 'feed'
    category: 'feed',
    priority: 'normal',
    title: `📝 Nova publicação na ${leagueName}`,
    message: `${authorName} publicou: "${snippet.substring(0, 80)}${snippet.length > 80 ? '...' : ''}"`,
    link: `/?tab=feed`,
    idempotencyKey: `new_post_${postId}`,
    metadata: { post_id: postId, organization_id: leagueId },
  });
}

// 13. Solicitação de Amizade -> Notificar o destinatário
export async function notifyFriendRequest(senderProfile: Profile, receiverId: string) {
  const senderName = senderProfile.apelido || senderProfile.nome;
  return createNotification({
    userId: receiverId,
    type: 'friend_request',
    category: 'feed',
    priority: 'normal',
    title: `👥 Nova Solicitação de Amizade`,
    message: `${senderName} enviou uma solicitação de amizade para você no F&V Sports.`,
    link: `/profile/${senderProfile.id}`,
    idempotencyKey: `friend_req_${senderProfile.id}_${receiverId}`,
    metadata: { sender_id: senderProfile.id },
  });
}

// 14. Amizade Aceita -> Notificar quem enviou o pedido original
export async function notifyFriendAccepted(accepterProfile: Profile, targetUserId: string) {
  const accepterName = accepterProfile.apelido || accepterProfile.nome;
  return createNotification({
    userId: targetUserId,
    type: 'friend_request',
    category: 'feed',
    priority: 'normal',
    title: `🤝 Amizade Confirmada!`,
    message: `${accepterName} aceitou sua solicitação de amizade. Agora vocês são parceiros de jogo!`,
    link: `/profile/${accepterProfile.id}`,
    idempotencyKey: `friend_acc_${accepterProfile.id}_${targetUserId}`,
    metadata: { friend_id: accepterProfile.id },
  });
}

// 15. Alteração de Cargo de Usuário -> Notificar o usuário
export async function notifyRoleUpdated(userId: string, newRole: string) {
  const roleName =
    newRole === 'super_admin'
      ? 'Super Administrador 👑'
      : newRole === 'admin'
      ? 'Organizador / Admin 🛡️'
      : 'Jogador ⚽';

  return createNotification({
    userId,
    type: 'role_updated',
    category: 'system',
    priority: 'high',
    title: 'Cargo Atualizado no F&V Sports ✨',
    message: `Seu perfil foi atualizado para: ${roleName}. Aproveite suas novas permissões!`,
    link: `/profile/${userId}`,
    metadata: { new_role: newRole },
  });
}
