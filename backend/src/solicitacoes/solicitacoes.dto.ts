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
