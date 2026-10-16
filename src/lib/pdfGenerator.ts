import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Match, MatchParticipant } from '@/types/database';
import { getTeamInfo } from '@/lib/teamsHelper';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GenerateMatchPdfOptions {
  match: Match;
  participants: MatchParticipant[];
}

export function generateMatchPdf({ match, participants }: GenerateMatchPdfOptions) {
  // 1. Instanciar documento A4 retrato
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cores da paleta do app
  const brandEmerald = [5, 150, 105]; // #059669
  const darkSlate = [15, 23, 42]; // #0f172a
  const lightBg = [248, 250, 252]; // #f8fafc
  const textMuted = [100, 116, 139]; // #64748b
  const borderSlate = [226, 232, 240]; // #e2e8f0

  // ═══════════════════════════════════════════════════════════════════
  // 1. CABEÇALHO DO DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════
  // Faixa de destaque no topo
  doc.setFillColor(brandEmerald[0], brandEmerald[1], brandEmerald[2]);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Título e Subtítulo no topo
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FUTEBOL RESENHA APP — ESCALAÇÃO OFICIAL', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Relatório detalhado de times, jogadores e vagas da partida', 14, 18);

  // Data de emissão no topo direito
  const generationDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.setFontSize(8);
  doc.text(`Gerado em: ${generationDate}`, pageWidth - 14, 18, { align: 'right' });

  let currentY = 32;

  // ═══════════════════════════════════════════════════════════════════
  // 2. BOX DE DETALHES DA PARTIDA
  // ═══════════════════════════════════════════════════════════════════
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.roundedRect(14, currentY, pageWidth - 28, 30, 3, 3, 'FD');

  // Nome da Partida
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(match.titulo || 'Partida de Futebol', 18, currentY + 7);

  // Linha 1 de informações: Data, Horário, Local
  const dateFormatted = match.data
    ? (() => {
        const parts = match.data.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : match.data;
      })()
    : 'A definir';

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Data & Horário:', 18, currentY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${dateFormatted} às ${match.horario ? match.horario.substring(0, 5) : '--:--'}h`, 46, currentY + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('Local:', 110, currentY + 14);
  doc.setFont('helvetica', 'normal');
  const localText = `${match.local || 'Não informado'}${match.endereco ? ` (${match.endereco})` : ''}`;
  doc.text(doc.splitTextToSize(localText, pageWidth - 130), 122, currentY + 14);

  // Linha 2 de informações: Formato, Valor, Total de Confirmados
  const totalConfirmados = participants.length;
  const vagasRestantesGerais = Math.max(0, match.limite_participantes - totalConfirmados);

  doc.setFont('helvetica', 'bold');
  doc.text('Formato:', 18, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`${match.num_times} times × ${match.jogadores_por_time} jogadores (Limite: ${match.limite_participantes})`, 35, currentY + 22);

  doc.setFont('helvetica', 'bold');
  doc.text('Confirmados:', 110, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalConfirmados} inscritos (${vagasRestantesGerais} vagas restantes)`, 133, currentY + 22);

  currentY += 38;

  // ═══════════════════════════════════════════════════════════════════
  // 3. SEPARAÇÃO E PROCESSAMENTO DOS TIMES
  // ═══════════════════════════════════════════════════════════════════
  const teamGroups: Record<number, MatchParticipant[]> = {};
  const reserves: MatchParticipant[] = [];

  for (let t = 1; t <= match.num_times; t++) {
    teamGroups[t] = [];
  }

  participants.forEach((p) => {
    if (p.team && p.team >= 1 && p.team <= match.num_times) {
      teamGroups[p.team].push(p);
    } else {
      reserves.push(p);
    }
  });

  // Iterar por cada time e renderizar a tabela
  for (let teamNum = 1; teamNum <= match.num_times; teamNum++) {
    const teamColorObj = getTeamInfo(match, teamNum);

    const teamPlayers = teamGroups[teamNum] || [];
    const count = teamPlayers.length;
    const capacity = match.jogadores_por_time;
    const vagasRestantesTime = Math.max(0, capacity - count);

    // Verificar se cabe na página atual antes de criar a tabela (senão pula página)
    if (currentY + 45 > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }

    // Título da Seção do Time com Badge de Vagas
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, currentY, pageWidth - 28, 8, 1.5, 1.5, 'F');

    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`${teamColorObj.name.toUpperCase()}`, 18, currentY + 5.5);

    // Resumo de jogadores e vagas no lado direito
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    const statusVagas =
      vagasRestantesTime === 0
        ? 'Time Completo'
        : `${vagasRestantesTime} ${vagasRestantesTime === 1 ? 'vaga restante' : 'vagas restantes'}`;

    doc.text(
      `Jogadores: ${count}/${capacity}  |  ${statusVagas}`,
      pageWidth - 18,
      currentY + 5.5,
      { align: 'right' }
    );

    currentY += 10;

    const isMatchVolei = match.sport_type === 'volei';
    const dominanceLabel = isMatchVolei ? 'Mão' : 'Pé';

    // Montar linhas da tabela do time
    const tableBody = teamPlayers.map((p, idx) => {
      const nome = p.user?.nome || 'Jogador';
      const apelido = p.user?.apelido ? `"${p.user.apelido}"` : '—';
      const posicao = isMatchVolei
        ? (p.user?.volei_position || '—')
        : (p.user?.futebol_position || p.user?.posicao || '—');
      const dominancia = isMatchVolei
        ? (p.user?.volei_dominant_hand || '—')
        : (p.user?.futebol_dominant_foot || p.user?.pe_dominante || '—');
      const statusPix = p.paid ? 'Pago' : 'Pendente';

      return [
        (idx + 1).toString(),
        nome,
        apelido,
        posicao,
        dominancia,
        statusPix,
      ];
    });

    // Se o time estiver vazio
    if (tableBody.length === 0) {
      tableBody.push(['—', 'Nenhum jogador escalado para este time ainda', '—', '—', '—', '—']);
    }

    // Renderizar Tabela com jsPDF AutoTable
    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Nome do Jogador', 'Apelido', 'Posição', dominanceLabel, 'PIX']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 55, fontStyle: 'bold' },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22 },
        5: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        // Estilizar coluna de status de pagamento
        if (data.section === 'body' && data.column.index === 5) {
          if (data.cell.raw === 'Pago') {
            data.cell.styles.textColor = [16, 185, 129]; // Verde
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'Pendente') {
            data.cell.styles.textColor = [217, 119, 6]; // Âmbar
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // Atualizar cursor Y para a próxima tabela
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 20;
    currentY = finalY + 8;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. JOGADORES RESERVAS / SEM TIME ALOCADO (SE HOUVER)
  // ═══════════════════════════════════════════════════════════════════
  if (reserves.length > 0) {
    if (currentY + 40 > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(254, 243, 199); // Âmbar suave
    doc.roundedRect(14, currentY, pageWidth - 28, 8, 1.5, 1.5, 'F');

    doc.setTextColor(180, 83, 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`CONFIRMADOS SEM TIME / RESERVAS (${reserves.length} jogadores)`, 18, currentY + 5.5);

    currentY += 10;

    const isMatchVolei = match.sport_type === 'volei';
    const dominanceLabel = isMatchVolei ? 'Mão' : 'Pé';

    const reserveBody = reserves.map((p, idx) => [
      (idx + 1).toString(),
      p.user?.nome || 'Jogador',
      p.user?.apelido ? `"${p.user.apelido}"` : '—',
      isMatchVolei
        ? (p.user?.volei_position || '—')
        : (p.user?.futebol_position || p.user?.posicao || '—'),
      isMatchVolei
        ? (p.user?.volei_dominant_hand || '—')
        : (p.user?.futebol_dominant_foot || p.user?.pe_dominante || '—'),
      p.paid ? 'Pago' : 'Pendente',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Nome do Jogador', 'Apelido', 'Posição', dominanceLabel, 'PIX']],
      body: reserveBody,
      theme: 'grid',
      headStyles: {
        fillColor: [217, 119, 6],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [255, 251, 235],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 55, fontStyle: 'bold' },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22 },
        5: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 20;
    currentY = finalY + 8;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. NUMERAÇÃO DE PÁGINAS E RODAPÉ
  // ═══════════════════════════════════════════════════════════════════
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.text(
      'Futebol Resenha App — Gerenciamento Inteligente de Peladas e Amistosos',
      14,
      pageHeight - 7
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. DOWNLOAD DO ARQUIVO PDF
  // ═══════════════════════════════════════════════════════════════════
  const sanitizedTitle = (match.titulo || 'Partida')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  const fileName = `Escalacao_${sanitizedTitle}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
