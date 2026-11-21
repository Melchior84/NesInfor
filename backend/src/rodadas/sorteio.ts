import { createHash, randomBytes } from 'crypto';

export interface ParticipanteSorteio {
  usuarioId: number;
  nome: string;
}

export interface ResultadoSorteio {
  seedPublica: string;
  entradaHash: string;
  hashAuditoria: string;
  indiceSorteado: number;
  vencedor: ParticipanteSorteio;
  participantesOrdenados: ParticipanteSorteio[];
}

/**
 * Sorteio criptograficamente aleatorio e 100% auditavel (Provably Fair).
 *
 * Qualquer pessoa pode conferir o resultado recalculando:
 *   entrada = `${seedPublica}|${rodadaId}|${brindeId}|${idsOrdenados.join(',')}`
 *   hash    = SHA-256(entrada) em hexadecimal minusculo
 *   indice  = Number(BigInt('0x' + hash.slice(0, 16)) % BigInt(participantes.length))
 *   vencedor = participantesOrdenados[indice]
 */
export function executarSorteioAuditavel(
  rodadaId: number,
  brindeId: number,
  participantes: ParticipanteSorteio[],
  seedOpcional?: string,
): ResultadoSorteio {
  if (participantes.length === 0) {
    throw new Error('Nao ha participantes elegiveis para o sorteio.');
  }

  const participantesOrdenados = [...participantes].sort(
    (a, b) => a.usuarioId - b.usuarioId,
  );
  const seedPublica = seedOpcional ?? randomBytes(32).toString('hex');
  const ids = participantesOrdenados.map((p) => p.usuarioId).join(',');
  const entradaHash = `${seedPublica}|${rodadaId}|${brindeId}|${ids}`;
  const hashAuditoria = createHash('sha256').update(entradaHash).digest('hex');

  const valor64 = BigInt(`0x${hashAuditoria.slice(0, 16)}`);
  const indiceSorteado = Number(
    valor64 % BigInt(participantesOrdenados.length),
  );

  return {
    seedPublica,
    entradaHash,
    hashAuditoria,
    indiceSorteado,
    vencedor: participantesOrdenados[indiceSorteado],
    participantesOrdenados,
  };
}
