import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { AtualizarUsuarioDto } from './usuarios.dto';
import { UsuariosService } from './usuarios.service';

@Roles('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
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
  @Post(':id/resetar-senha')
  resetarSenha(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() atual: UsuarioAutenticado,
  ) {
    return this.usuarios.resetarSenha(id, atual);
  }
}
