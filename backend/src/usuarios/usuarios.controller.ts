import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { AtualizarUsuarioDto, DominiosAprovadosDto } from './usuarios.dto';
import { UsuariosService } from './usuarios.service';

@Roles('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Get('dominios-aprovados')
  obterDominios() {
    return this.usuarios.obterDominiosAprovados();
  }

  @Put('dominios-aprovados')
  salvarDominios(@Body() dto: DominiosAprovadosDto) {
    return this.usuarios.salvarDominiosAprovados(dto.dominios);
  }

  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarUsuarioDto,
    @CurrentUser() atual: UsuarioAutenticado,
  ) {
    return this.usuarios.atualizar(id, dto, atual);
  }

  @HttpCode(200)
  @Post(':id/aprovar')
  aprovar(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.aprovar(id);
  }

  @Delete(':id/recusar')
  recusar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() atual: UsuarioAutenticado,
  ) {
    return this.usuarios.recusar(id, atual);
  }

  @HttpCode(200)
  @Post(':id/resetar-senha')
  resetarSenha(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() atual: UsuarioAutenticado,
  ) {
    return this.usuarios.resetarSenha(id, atual);
  }
}
