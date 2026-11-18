import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Match, MatchExpense, MatchParticipant } from '@/types/database';

interface MatchFinancePdfOptions {
  match: Match;
  participants: MatchParticipant[];
  expenses: MatchExpense[];
  paidParticipantIds: string[];
  summary: {
    totalCollected: number;
    participantsPaid: number;
    participantsTotal: number;
    arenaCost: number;
    otherExpensesTotal: number;
    totalExpenses: number;
    netBalance: number;
  };
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);

export function generateMatchFinancePdf({
  match,
  participants,
  expenses,
  paidParticipantIds,
  summary,
}: MatchFinancePdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const dateParts = (match.data || '').split('-');
  const matchDate = dateParts.length === 3
    ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
    : match.data || 'A definir';
  const now = new Date();
  const generatedAt = now.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Cabeçalho
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('F&V Sports', margin, 16);
  doc.setTextColor(249, 115, 22);
  doc.setFontSize(8);
  doc.text('RESUMO FINANCEIRO', margin, 22);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  const matchTitle = doc.splitTextToSize(match.titulo || 'Partida', 105);
  doc.text(matchTitle.slice(0, 2), margin, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const metaLines = [
    `Data: ${matchDate} às ${(match.horario || '').substring(0, 5) || '--:--'}`,
    `Local: ${match.local || 'Não informado'}`,
    `Emitido em: ${generatedAt}`,
  ].flatMap((line) => doc.splitTextToSize(line, 68));
  doc.text(metaLines, pageWidth - margin, 15, { align: 'right' });

  // Indicadores financeiros em dois pares para manter boa leitura no papel.
  const cardGap = 5;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = 22;
  const cardRows = [
    [
      {
        title: 'TOTAL ARRECADADO',
        value: formatCurrency(summary.totalCollected),
        detail: `${summary.participantsPaid} de ${summary.participantsTotal} pagaram`,
        color: [5, 150, 105] as [number, number, number],
      },
      {
        title: 'ALUGUEL DA ARENA / SOCIETY',
        value: formatCurrency(summary.arenaCost),
        detail: match.local || 'Locação de quadra',
        color: [217, 119, 6] as [number, number, number],
      },
    ],
    [
      {
        title: 'OUTRAS DESPESAS',
        value: formatCurrency(summary.otherExpensesTotal),
        detail: `${expenses.length} item(ns) avulso(s)`,
        color: [220, 38, 38] as [number, number, number],
      },
      {
        title: 'SALDO FINAL',
        value: formatCurrency(summary.netBalance),
        detail: `Despesas: ${formatCurrency(summary.totalExpenses)}`,
        color: summary.netBalance >= 0
          ? [5, 150, 105] as [number, number, number]
          : [220, 38, 38] as [number, number, number],
      },
    ],
  ];

  const cardsStartY = 44;
  cardRows.forEach((row, rowIndex) => {
    row.forEach((card, columnIndex) => {
      const x = margin + columnIndex * (cardWidth + cardGap);
      const y = cardsStartY + rowIndex * (cardHeight + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(card.title, x + 3, y + 5);

      doc.setFontSize(11);
      doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      doc.text(card.value, x + 3, y + 12.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(doc.splitTextToSize(card.detail, cardWidth - 6).slice(0, 1), x + 3, y + 18.5);
    });
  });

  const drawSectionTitle = (title: string, y: number) => {
    doc.setFillColor(249, 115, 22);
    doc.rect(margin, y - 3.2, 1.2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 4, y + 1);
  };

  let currentY = cardsStartY + cardRows.length * cardHeight + 4 + 10;

  // Pagamentos dos participantes
  drawSectionTitle('1. Lista de Pagamento dos Participantes', currentY);
  currentY += 6;

  const paidIds = new Set(paidParticipantIds);
  const participantRows = participants.length
    ? participants.map((participant, index) => {
        const name = participant.user?.apelido
          ? `${participant.user.nome || participant.guest_name || 'Jogador'} (${participant.user.apelido})`
          : participant.user?.nome || participant.guest_name || 'Jogador';
        return [
          String(index + 1),
          name,
          formatCurrency(Number(match.valor || 0)),
          paidIds.has(participant.id) ? 'PAGO' : 'PENDENTE',
        ];
      })
    : [['—', 'Nenhum participante confirmado', '—', '—']];

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Nome do Participante', 'Valor Devido', 'Status']],
    body: participantRows,
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 87, fontStyle: 'bold' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 39, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'PAGO') {
          data.cell.styles.textColor = [21, 128, 61];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'PENDENTE') {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 20) + 10;
  if (currentY + 18 > pageHeight - 18) {
    doc.addPage();
    currentY = margin;
  }

  // Custos e despesas
  drawSectionTitle('2. Demonstrativo de Custos e Despesas', currentY);
  currentY += 6;

  const expenseRows = [
    [
      '1',
      `Aluguel da Arena / Society (${match.local || 'Quadra'})`,
      'Custo de locação',
      `- ${formatCurrency(summary.arenaCost)}`,
    ],
    ...expenses.map((expense, index) => [
      String(index + 2),
      expense.descricao || 'Despesa avulsa',
      'Despesa avulsa',
      `- ${formatCurrency(Number(expense.valor || 0))}`,
    ]),
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Descrição do Custo', 'Categoria', 'Valor']],
    body: expenseRows,
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 82 },
      2: { cellWidth: 48 },
      3: { cellWidth: 36, halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
    },
  });

  // Rodapé numerado em todas as páginas
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`F&V Sports - Fechamento Financeiro - ${match.titulo || 'Partida'}`, margin, pageHeight - 7);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  const sanitizedTitle = (match.titulo || 'Partida')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  doc.save(`Resumo_Financeiro_${sanitizedTitle}_${fileDate}.pdf`);
}
