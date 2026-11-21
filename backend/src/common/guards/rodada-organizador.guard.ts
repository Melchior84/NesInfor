import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * Permite a rota apenas ao organizador da rodada (:id) ou a um ADMIN.
 * Deve ser usado depois do JwtAuthGuard global (req.user ja preenchido).
 */
@Injectable()
export class RodadaOrganizadorGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rodadaId = Number(req.params.id);
    if (!Number.isInteger(rodadaId) || rodadaId <= 0) {
      throw new NotFoundException('Rodada nao encontrada.');
    }

    const [rodada] = await this.db.query<{ organizador_id: number | null }>(
      'SELECT organizador_id FROM rodadas_pedido WHERE id = ?',
      [rodadaId],
    );
    if (!rodada) throw new NotFoundException('Rodada nao encontrada.');

    const { user } = req;
    const ehOrganizador = rodada.organizador_id === user.id;
    if (!ehOrganizador && user.perfil !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas o organizador da rodada ou um ADMIN pode executar esta acao.',
      );
    }
    return true;
  }
}
