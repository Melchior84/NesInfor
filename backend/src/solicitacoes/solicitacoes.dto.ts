import { IsIn, IsInt, Max, Min } from 'class-validator';

export class DefinirQuantidadeDto {
  /** 0 remove o item do pedido. */
  @IsInt()
  @Min(0)
  @Max(5000)
  quantidade: number;
}

export class AlterarPagamentoDto {
  @IsIn(['PENDENTE', 'PAGO'])
  status: 'PENDENTE' | 'PAGO';
}

export class DefinirGorjetaDto {
  /** Quantidade de cafezinhos (0 a 3) para a caixinha Studios Melk. */
  @IsInt()
  @Min(0)
  @Max(3)
  cafezinhos: number;
}
